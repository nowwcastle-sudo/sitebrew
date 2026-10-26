// 지금 사이트와 2안 비교 화면(계획 2 Task 8) — 판(version 2)을 읽어 09-revise/<번호>/compare.html 한 장을 쓴다.
//   칸: 「지금」 + 안마다 한 칸. 안 칸에는 해석 문장 · 바뀐 곳(사전 축 이름: 이전 → 이후) · 색이 바뀌면 이전·이후 견본 · 사이트 폴더 상대 링크.
//   화면 글은 grammar.yaml 의 text.compare(요청 언어로 고른다). 축 이름은 사전 axes.<축>.label — 영어 축 id 는 화면에 내지 않는다.
//   색은 판에 실린 값만 쓴다: before.head.color(지금)와 variants[].colors(안) = { background, foreground, accent }. 그 둘이 다르면 견본을 낸다.
//   외부 스크립트·글꼴 없이 한 파일로 끝난다.
import { readFileSync, writeFileSync } from 'node:fs'
import { join, posix } from 'node:path'
import { BLOCK_REGISTRY } from '../scripts/archetypes.mjs'
import { fill } from '../vocab/fill.mjs'
import { grammar } from '../vocab/grammar.mjs'
import { sectionNameOf } from './section-plan.mjs'

const T = grammar.text
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ESC[c])

const sameColors = (a, b) => ['background', 'foreground', 'accent'].every((k) => a?.[k] === b?.[k])

// 스타일 속성에 들어가는 색은 16진수나 숫자뿐인 oklch 만 받는다 — 그 밖의 값은 견본을 내지 않는다.
const NUM = String.raw`-?(?:\d+\.?\d*|\.\d+)`
const SAFE_COLOR = new RegExp(String.raw`^(?:#(?:[0-9a-f]{3}|[0-9a-f]{6})|oklch\(\s*${NUM}%?\s+${NUM}\s+${NUM}(?:deg)?(?:\s*/\s*${NUM}%?)?\s*\))$`, 'i')
const swatches = (label, colors) => `<div class="swatches"><span>${esc(label)}</span>${['background', 'foreground', 'accent'].filter((k) => SAFE_COLOR.test(colors[k] ?? '')).map((k) => `<i class="swatch" style="background:${esc(colors[k])}"></i>`).join('')}</div>`

let blockTitles
/** 블록 이름 — 레지스트리 제목의 「 — 」 뒤(그 블록이 어떤 구성인지 한국어로 적은 부분). 영어 화면이나 모르는 블록이면 「다른 구성」. 블록 id 는 사용자에게 내지 않는다. */
function blockNameOf(block, t, lang) {
  blockTitles ??= new Map(JSON.parse(readFileSync(BLOCK_REGISTRY, 'utf8')).items.filter((i) => i.type === 'registry:block').map((i) => [i.name, i.title]))
  const title = lang === 'ko' ? blockTitles.get(block) : null
  return title ? title.split(' — ').slice(1).join(' — ') || title : t.otherLayout
}

/** 축 이름은 사전 label(한국어뿐) — 영어 화면이나 사전에 없는 축이면 중립 글로 대신한다. 「지금」은 요청 언어의 글로 바꾼다. 구획 교체(c.section)는 구획 이름과 블록 이름으로 보인다. */
function changeLine(c, lex, t, lang) {
  const label = lang === 'ko' ? lex.axes[c.axis]?.label : undefined
  const vars = { label: label ?? t.axisFallback, from: !c.from || c.from === T.step.current || c.section ? t.now : c.from, to: c.section ? blockNameOf(c.to, t, lang) : c.to }
  return `<li class="change">${esc(c.section ? fill(t.changeIn, { ...vars, section: sectionNameOf(c.section, lex, lang) }) : fill(t.change, vars))}</li>`
}

const link = (href, t) => (href ? `<p><a href="${esc(href)}">${esc(t.open)}</a></p>` : '')

const CSS = `:root{--bg:#fff;--fg:#1a1a1a;--line:#d6d6d6;--card:#f6f6f6;--link:#0b57d0}
@media (prefers-color-scheme:dark){:root{--bg:#161616;--fg:#eee;--line:#3a3a3a;--card:#222;--link:#8ab4f8}}
*{box-sizing:border-box}body{margin:0;padding:24px 16px;background:var(--bg);color:var(--fg);font:16px/1.6 system-ui,sans-serif}
h1{font-size:1.4rem;margin:0 0 16px}h2{font-size:1.1rem;margin:0 0 8px}h3{font-size:.95rem;margin:16px 0 4px}
.cols{display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}
.col{border:1px solid var(--line);border-radius:8px;padding:16px;background:var(--card)}
.why{margin:0 0 16px}ul{margin:0;padding-left:20px}a{color:var(--link)}
.swatches{display:flex;align-items:center;gap:6px;margin:8px 0}.swatches span{flex:1 1 auto;font-size:.85rem}
.swatch{display:inline-block;width:28px;height:28px;border:1px solid var(--line);border-radius:4px}`

/**
 * @param {string} boardDir  09-revise/<번호> 폴더(board.json 이 있는 곳)
 * @param {object} board     version 2 판 — candidate · index · request · before.head.color · why · variants[{ say, changes, colors?, siteRel? }]
 * @param {object} lex       사전(axes.<축>.label)
 * @returns {string} 쓴 파일 경로
 */
export function writeCompare(boardDir, board, lex) {
  const lang = board.request && !/[가-힣]/.test(board.request) ? 'en' : 'ko'
  const t = Object.fromEntries(Object.entries(T.compare).map(([k, pair]) => [k, pair[lang]]))
  const from = posix.join(board.candidate, '09-revise', String(board.index))
  const rel = (to) => posix.relative(from, to)
  const nowColors = board.before?.head?.color
  const cols = board.variants.map((v, i) => {
    const colored = v.colors && nowColors && !sameColors(v.colors, nowColors)
    return `<section class="col"><h2>${esc(fill(t.option, { n: i + 1, id: v.id }))}</h2><p>${esc(v.say)}</p>
<h3>${esc(t.changed)}</h3><ul>${v.changes.map((c) => changeLine(c, lex, t, lang)).join('')}</ul>
${colored ? swatches(t.swatchBefore, nowColors) + swatches(t.swatchAfter, v.colors) : ''}${link(v.siteRel && rel(v.siteRel), t)}</section>`
  })
  const now = `<section class="col"><h2>${esc(t.now)}</h2><p>${esc(t.nowNote)}</p>${link(rel(posix.join(board.candidate, 'site')), t)}</section>`
  const line = board.why ?? (board.variants.length === 1 && lang === 'ko' ? T.plan.onlyOne : board.ask) // onlyOne 은 한국어 글뿐이라 영어 화면은 판의 까닭만 쓴다
  const why = line ? `<p class="why">${esc(line)}</p>` : ''
  const file = join(boardDir, 'compare.html')
  writeFileSync(file, `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(t.title)}</title><style>${CSS}</style></head>
<body><h1>${esc(t.title)}</h1>${why}<div class="cols">${now}${cols.join('')}</div></body></html>
`)
  return file
}
