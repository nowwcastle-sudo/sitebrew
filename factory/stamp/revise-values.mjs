// 값이 든 수정 요청(FIT-2) — 「색을 초록색으로」·「서체를 명조로」처럼 사용자가 값을 말한 읽기를 지킨다.
// 값 읽기는 사전(design-lexicon.yaml)이 하고, 이 모듈은 값 손잡이(handles/value.mjs)가 부르는 안 계획 본체다.
//
//   planAxisValue(head, request, { n }) → { ask, reason? } | { heads: [{ value, label, head, detail }], notes[] }
//     request = { target: "color"|"type", text, value } — color: { hex, from: "hex"|"name", name? }   type: { category } | { family }
//
// 색: 요청한 색(#rrggbb) 하나를 주색으로 한 안을 만든다. 색 이름은 해석이라(작은 표 COLOR_NAMES — 이름마다 대표 색 하나) 보드 안내에 「초록 → #xxxxxx 로 읽었어요」를 단다(지어낸 값이 아니다).
//   안 = brand.mjs brandToRecipeHead({ colors: [hex] }, 그 후보의 지금 레시피를 프리셋으로 만든 것) — 브랜드 색을 대비(4.5:1)·색조(2° 이내) 규칙에 맞춰 레시피 머리로 만든다.
//   (a) 그 색을 주색으로 · (b) 같은 색조에서 명도만 다른 짝. 맞출 수 없으면(blocked) 아무것도 바꾸지 않고 질문으로 돌려준다 — 조용히 다른 색을 내지 않는다.
//   바뀌는 것은 색(color·colorLogic)뿐이다 — 서체·축·히어로·모션은 지금 레시피 그대로.
// 서체: 범주(명조·고딕·손글씨·둥근·고정폭)나 서체 이름(폰트 키트·fonts.json)을 받는다. 안 = 그 범주에서 한글을 그리는(본문은 lint font-korean) 키트 서체 상위 2개를 제목(+본문)에 쓴 머리.
//   범주는 references/fonts/fonts.json 의 category 로, fonts.json 에 없는 키트 서체는 키트 항목의 generic 과 작은 보정표(KIT_CATEGORY)로 정한다. 맞는 서체가 없으면 질문.
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fill } from '../vocab/fill.mjs'
import { grammar } from '../vocab/grammar.mjs'
import { brandToRecipeHead, HUE_LIMIT } from './brand.mjs'
import { kitFont, lintRecipeReport } from '../scripts/recipe.mjs'
import { FONTS_FILE, css, oklchToHex, recipePreset } from '../scripts/style-presets.mjs'
import { ACCENT_C, hexToOklch, hueDist } from '../scripts/lib/palette-lib.mjs'
import { parseOklch } from '../scripts/lib/palette-rules.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const isKo = (raw) => /[가-힣]/.test(raw)
const V = grammar.text.value // 안이 고른 모양을 말하는 글(grammar.yaml text.value)
const say = (pair, ko, vars) => fill(pair[ko ? 'ko' : 'en'], vars)

// ── 색 읽기 ──────────────────────────────────────────────────────────────────

/** 색 이름 → 대표 색 하나. 주색(버튼·링크 글자)으로 쓰므로 밝은 바탕 위 4.5:1 에 닿는 중간 명도로 골랐다(노랑·베이지·흰색은 밝아서 맞추지 못해 질문으로 간다 — 정직하게). */
export const COLOR_NAMES = [
  { key: 'red', label: '빨강', en: 'red', hex: '#C62828' },
  { key: 'orange', label: '주황', en: 'orange', hex: '#B45309' },
  { key: 'yellow', label: '노랑', en: 'yellow', hex: '#F2C200' },
  { key: 'green', label: '초록', en: 'green', hex: '#2E7D32' },
  { key: 'teal', label: '청록', en: 'teal', hex: '#00796B' },
  { key: 'blue', label: '파랑', en: 'blue', hex: '#1565C0' },
  { key: 'navy', label: '남색', en: 'navy', hex: '#1F3A8A' },
  { key: 'purple', label: '보라', en: 'purple', hex: '#6A1B9A' },
  { key: 'pink', label: '분홍', en: 'pink', hex: '#D6336C' },
  { key: 'brown', label: '갈색', en: 'brown', hex: '#7B4A2D' },
  { key: 'beige', label: '베이지', en: 'beige', hex: '#D8C3A5' },
  { key: 'black', label: '검정', en: 'black', hex: '#111111' },
  { key: 'gray', label: '회색', en: 'gray', hex: '#707070' },
  { key: 'white', label: '흰색', en: 'white', hex: '#FFFFFF' },
]

// ── 서체 읽기 ─────────────────────────────────────────────────────────────────

// 서체 범주 — 사용자가 쓰는 낱말은 사전(type-family 값)이 맡고, 여기는 범주 이름표와 안 계획이 쓴다.
export const TYPE_CATEGORIES = [
  { key: 'sans', label: '고딕(산세리프)', en: 'sans-serif' },
  { key: 'serif', label: '명조(세리프)', en: 'serif' },
  { key: 'handwriting', label: '손글씨', en: 'handwriting' },
  { key: 'rounded', label: '둥근 서체', en: 'rounded' },
  { key: 'mono', label: '고정폭', en: 'monospace' },
]

let KOREAN_LIST, REF_FONTS, KIT_LIST
const koreanList = () => (KOREAN_LIST ??= JSON.parse(readFileSync(join(ROOT, 'factory', 'qa', 'data', 'korean-fonts.json'), 'utf8')).families)
const refFonts = () => (REF_FONTS ??= JSON.parse(readFileSync(FONTS_FILE, 'utf8')).fonts)
const kitFiles = () => (KIT_LIST ??= readdirSync(join(ROOT, 'registry', 'factory', 'fonts')).filter((f) => /^font-[a-z0-9-]+\.json$/.test(f)).map((f) => f.slice(0, -5)))

let FAMILIES
/** 서체 이름 → 설치 가능한 키트 항목(있으면). 키트 서체는 대소문자 없이, fonts.json 에만 있는 서체는 쓴 그대로의 대소문자일 때만 읽는다(「Stylish 하게」 같은 일반 낱말이 서체 이름으로 걸리지 않게). */
function families() {
  if (FAMILIES) return FAMILIES
  const map = new Map()
  const add = (name, entry) => { const k = name.trim().toLowerCase(); if (k.length >= 3 && !map.has(k)) map.set(k, { name: name.trim(), ...entry }) }
  for (const item of kitFiles()) { const k = kitFont(item); if (k?.title) add(k.title, { item, installable: true, korean: koreanList().some((f) => f.item === item) }) }
  for (const f of koreanList()) if (f.item && kitFont(f.item)) add(f.family, { item: f.item, installable: true, korean: true })
  for (const r of refFonts()) add(r.family, { item: null, installable: false, korean: false, exactCase: true })
  return (FAMILIES = map)
}

// ── 값으로 말한 #hex·서체 이름 ────────────────────────────────────────────────────
// 색 이름·서체 범주는 사전이 읽는다. 사전에 없는 두 가지 — 색 코드와 서체 이름 — 는 여기서 문장에서 찾아, 값 읽기(color-hue 는 「#rrggbb」, type-family 는 서체 이름)로 넘긴다.

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const HEX = /#([0-9a-f]{6}|[0-9a-f]{3})(?![0-9a-z])/gi
/** 문장의 색 코드(#rgb·#rrggbb) → 대문자 #RRGGBB, 겹침 없이. */
const hexesIn = (raw) => [...new Set([...String(raw ?? '').matchAll(HEX)].map((m) => {
  const h = m[1].toUpperCase()
  return `#${h.length === 3 ? h.split('').map((c) => c + c).join('') : h}`
}))]
/** 문장의 서체 이름 → 키트·fonts.json 항목. 더 긴 이름 안에 든 이름은 뺀다(Noto Serif KR 안의 Noto Serif). */
function familiesIn(raw) {
  const lc = raw.toLowerCase()
  const hits = []
  for (const [k, e] of families()) {
    if (!new RegExp(`(?<![a-z0-9])${esc(k)}(?![a-z0-9])`, 'i').test(lc)) continue
    if (e.exactCase && !new RegExp(`(?<![A-Za-z0-9])${esc(e.name)}(?![A-Za-z0-9])`).test(raw)) continue
    hits.push([k, e])
  }
  return hits.filter(([k]) => !hits.some(([k2]) => k2 !== k && k2.includes(k))).map(([, e]) => e)
}

/** 문장이 색 코드 하나나 서체 이름 하나만 말했으면 그 값 읽기의 축과 값. 둘 이상이거나 섞여 있으면 null(사전 분류가 되묻는다). */
export function literalValueIn(raw) {
  const [hexes, fams] = [hexesIn(raw), familiesIn(String(raw ?? ''))]
  if (hexes.length === 1 && !fams.length) return { axis: 'color-hue', value: hexes[0] }
  if (fams.length === 1 && !hexes.length) return { axis: 'type-family', value: fams[0].name }
  return null
}

/** 값 읽기의 값이 사전 표기가 아닌 직접 말한 값인가 — color-hue 는 #rrggbb, type-family 는 아는 서체 이름. */
export function isLiteralValue(axis, value) {
  if (axis === 'color-hue') return /^#[0-9a-f]{6}$/i.test(String(value))
  if (axis === 'type-family') return families().has(String(value).toLowerCase())
  return false
}

// ── 색 안 ────────────────────────────────────────────────────────────────────

const themeOf = (head) => (head.defaultTheme === 'dark' ? 'dark' : 'light')
const hexOfCss = (v) => oklchToHex(typeof v === 'string' ? v : css(v))
export const primaryHexOf = (head, theme = themeOf(head)) => hexOfCss(head.color[theme].primary)
const lchOfHex = (hex) => hexToOklch(hex.slice(1))

/** 주색 자리에 요청한 색이 들어갔는가 — 유채색이면 색조가 한도 안, 무채색이면 채도가 낮다. 아니면 이유 글. */
function primaryProblem(head, hex, tolerance = HUE_LIMIT) {
  const p = parseOklch(head.color[themeOf(head)].primary)
  const q = lchOfHex(hex)
  if (!p) return '주색을 읽지 못했다'
  // brand.mjs 는 채도가 옅고(C < 0.05) 밝은(L > 0.6) 색을 주색으로 쓰지 않고 바탕 프리셋의 팔레트로 물러난다 — 그 결과를 요청 색으로 속이지 않는다.
  if (q[1] < ACCENT_C && q[0] > 0.6) return '밝고 옅은 색(흰색·베이지 …)은 주색(버튼·링크 글자) 자리를 얻지 못한다'
  if (q[1] >= 0.02) return p[1] >= 0.02 && hueDist(p[2], q[2]) <= tolerance ? null : '이 색은 주색(버튼·링크 글자) 자리를 얻지 못했다(너무 밝거나 옅다)'
  return p[1] < 0.03 ? null : '무채색 요청인데 주색이 유채색이 되었다'
}

/** 그 후보의 지금 레시피 머리를 바탕으로 색 하나를 주색으로 둔 머리를 만든다. → { head, logicChanged, adjustments } | { blocked: 이유[] } */
export function tryColor(head, hex, { refHex = hex, tolerance = HUE_LIMIT } = {}) {
  const base = recipePreset(head)
  const reasons = []
  for (const logic of [...new Set([head.colorLogic, 'K1'])]) {
    const preset = logic === head.colorLogic ? base : { ...base, recipeHints: { ...base.recipeHints, colorLogic: [logic] } }
    const r = brandToRecipeHead({ colors: [hex] }, preset)
    if (r.blocked) { reasons.push(`${logic}: ${r.blocked}`); continue }
    const merged = { ...structuredClone(head), id: r.head.id, name: r.head.name, colorLogic: r.head.colorLogic, color: r.head.color }
    delete merged.alternates // B안 덮어쓰기는 옛 색 기준이라 새 색과 섞이지 않게 뺀다
    const miss = primaryProblem(merged, refHex, tolerance)
    if (miss) { reasons.push(`${logic}: ${miss}`); continue }
    const v = lintRecipeReport(merged).violations
    if (v.length) { reasons.push(`${logic}: ${String(v[0]).split(':')[0]}`); continue }
    return { head: merged, logicChanged: logic !== head.colorLogic, adjustments: r.adjustments ?? [] }
  }
  return { blocked: reasons }
}

/** 맞출 수 없는 색 가까이에서 명도(와 채도)를 조금씩 옮겨 맞는 첫 색을 찾는다. 유채색만(무채색의 「비슷한 색」은 뜻이 없다). */
function nearestFeasible(head, hex) {
  const [L, C, H] = lchOfHex(hex)
  if (C < 0.04) return null
  const dark = themeOf(head) === 'dark'
  for (const f of [1, 0.75]) {
    for (let i = 1; i <= 16; i++) {
      const L2 = dark ? L + 0.03 * i : L - 0.03 * i
      if (L2 < 0.3 || L2 > 0.92) break
      const hex2 = hexOfCss([L2, C * f, H])
      if (hex2 !== hex && tryColor(head, hex2, { refHex: hex2 }).head) return hex2
    }
  }
  return null
}

const nameLabel = (value, ko) => { const c = COLOR_NAMES.find((x) => x.key === value.name); return ko ? c?.label ?? value.label : c?.en ?? value.name } // 표 밖 이름(금색·하늘색 …)은 요청이 가져온 label 과 key 를 쓴다
const nameNote = (value, ko) => (value.from === 'name'
  ? (ko ? `${nameLabel(value, ko)} → ${value.hex} 로 읽었어요. 정확한 색 코드가 있으면 알려 주세요.` : `Read "${nameLabel(value, ko)}" as ${value.hex}. If you have an exact color code, tell me.`)
  : null)

function planColor(head, value, { lang }) {
  const ko = lang === 'ko'
  let reason = null
  const theme = themeOf(head)
  const a = tryColor(head, value.hex)
  const shown = value.from === 'name' ? `${nameLabel(value, ko)}(${value.hex})` : value.hex
  if (a.blocked) {
    const sug = nearestFeasible(head, value.hex)
    const ask = ko
      ? `${shown} 은 이 사이트의 글자 대비·색조 규칙을 맞출 수 없어요. 비슷한 색으로 바꿀까요?${sug ? ` 예: ${sug}` : ''}`
      : `${shown} can't meet this site's contrast and hue rules. Switch to a similar color?${sug ? ` e.g. ${sug}` : ''}`
    return { ask, reason: a.blocked.join(' | '), ...(sug ? { suggestion: sug } : {}) }
  }
  const notes = []
  const read = nameNote(value, ko)
  if (read) notes.push(read)
  if (a.logicChanged) notes.push(ko ? `이 레시피의 색 짜임(${head.colorLogic})은 색 하나로 맞추지 못해 기본 짜임(K1)으로 바꿨어요.` : `This recipe's color scheme (${head.colorLogic}) can't be built from one color, so it uses the plain scheme (K1).`)
  const shift = (x) => x.adjustments.filter((j) => j.role === 'primary' && String(j.to).startsWith('oklch')).map((j) => `${j.theme} ${hexOfCss(j.to)}`)
  const aShift = shift(a)
  if (aShift.length) notes.push(ko ? `주색을 명도만 조정했어요(바탕 위 4.5:1): ${aShift.join(' · ')}` : `Only lightness of the main color was adjusted (4.5:1 on the background): ${aShift.join(' · ')}`)

  const heads = [{
    value: value.hex, label: primaryHexOf(a.head) !== value.hex ? say(V.mainColorShown, ko, { hex: value.hex, shown: primaryHexOf(a.head) }) : say(V.mainColor, ko, { hex: value.hex }), head: a.head,
    detail: { read: value.from === 'name' ? { name: nameLabel(value, ko), hex: value.hex } : null, primary: { light: primaryHexOf(a.head, 'light'), dark: primaryHexOf(a.head, 'dark') }, colorLogic: a.head.colorLogic },
  }]
  // (b) 같은 색조에서 명도만 다른 짝 — 라이트 기본은 어둡게부터, 다크 기본은 밝게부터. 고쳐 맞춘 주색이 (a) 와 같아지면 쓰지 않는다.
  const [L, C, H] = lchOfHex(value.hex)
  let pair = null
  for (const d of theme === 'dark' ? [1, -1] : [-1, 1]) {
    const L2 = Math.min(0.92, Math.max(0.28, L + d * 0.12))
    const hex2 = hexOfCss([L2, C, H])
    if (Math.abs(L2 - L) < 0.05 || hex2 === value.hex) continue
    const b = tryColor(head, hex2, { refHex: value.hex, tolerance: HUE_LIMIT + 1 })
    if (b.head && primaryHexOf(b.head) !== primaryHexOf(a.head)) { pair = { hex: hex2, b, d }; break }
  }
  if (pair) {
    heads.push({
      value: primaryHexOf(pair.b.head), label: say(pair.d < 0 ? V.pairDarker : V.pairLighter, ko, { hex: primaryHexOf(pair.b.head) }), head: pair.b.head,
      detail: { pairOf: value.hex, requested: pair.hex, primary: { light: primaryHexOf(pair.b.head, 'light'), dark: primaryHexOf(pair.b.head, 'dark') }, colorLogic: pair.b.head.colorLogic },
    })
  } else reason = ko ? '같은 색조에서 명도만 다른 짝은 규칙을 맞추지 못해 한 안만 냈어요.' : 'No same-hue lightness pair met the rules, so there is one option.'
  return { heads, notes, ...(reason ? { reason } : {}) } // reason = 안이 하나뿐인 까닭(안내가 아니라 까닭 한 줄)
}

// ── 서체 안 ──────────────────────────────────────────────────────────────────

// fonts.json category → 사용자 범주. 그 밖의 category(display-heavy·retro-techno·experimental·pixel·stencil·slab)는 장식체(display)라 어느 범주 낱말에도 걸지 않는다.
const REF_CATEGORY = { 'editorial-serif': 'serif', 'serif-display': 'serif', 'script-handwriting': 'handwriting', brush: 'handwriting', rounded: 'rounded', mono: 'mono', geometric: 'sans', wide: 'sans', condensed: 'sans' }
// fonts.json 에 없는 한글 키트 서체의 범주(키트 항목에 generic 이 없거나 generic 만으로 모호한 것). 시험이 한글 키트 서체 전부에 범주가 있는지 본다.
export const KIT_CATEGORY = { 'font-pretendard': 'sans', 'font-pretendard-gov': 'sans', 'font-gowun-dodum': 'sans', 'font-jua': 'rounded', 'font-gasoek-one': 'display', 'font-black-han-sans': 'display', 'font-bm-euljiro': 'display' }
const GENERIC_CATEGORY = { serif: 'serif', 'sans-serif': 'sans', monospace: 'mono', cursive: 'handwriting' }

let POOL
/** 한글을 그리는 키트 서체 목록 — { family, item, category, tier, rank } 정렬됨(좋은 순). */
export function koreanKitFonts() {
  if (POOL) return POOL
  const seen = new Set()
  const out = []
  for (const f of koreanList()) {
    if (!f.item || seen.has(f.item)) continue
    const kit = kitFont(f.item)
    if (!kit) continue
    seen.add(f.item)
    const ref = refFonts().find((r) => r.family.toLowerCase() === f.family.toLowerCase())
    const generic = String(kit.font?.family ?? '').split(',').pop().trim().replace(/['"]/g, '')
    const category = ref ? (REF_CATEGORY[ref.category] ?? 'display') : (KIT_CATEGORY[f.item] ?? GENERIC_CATEGORY[generic])
    const roles = kit.meta?.role ?? []
    // 좋은 순: 본문 역할이 있는 서체 → 보통 글(generic 이 있고 장식체가 아님) → 나머지. 같은 칸은 rank_score(없으면 0.5, brand.mjs 와 같다)·이름 순.
    const plain = category !== 'display' && !(ref && ['serif-display', 'display-heavy', 'retro-techno', 'experimental', 'pixel'].includes(ref.category))
    const tier = roles.includes('body') ? 0 : plain && (GENERIC_CATEGORY[generic] || ref?.category === 'editorial-serif') ? 1 : 2
    out.push({ family: f.family, item: f.item, category, tier, rank: ref?.rank_score ?? 0.5, generic: Boolean(GENERIC_CATEGORY[generic]) })
  }
  out.sort((a, b) => a.tier - b.tier || Number(b.generic) - Number(a.generic) || b.rank - a.rank || (a.item < b.item ? -1 : 1))
  return (POOL = out)
}

/** 키트 항목의 서체 이름 — 한글 서체는 korean-fonts.json 이 아는 이름(lint font-korean 이 이 이름을 본다), 라틴 서체는 키트 제목. */
const faceOf = (item) => koreanList().find((x) => x.item === item && !/ Variable$/.test(x.family))?.family ?? kitFont(item).title
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
/** 서체 하나를 제목(+본문)에 쓴 머리 — 린트를 통과하지 못하면 null. */
function fontHead(head, font, { body }) {
  const h = structuredClone(head)
  delete h.alternates
  const pick = { family: font.family, item: font.item }
  h.fonts = { ...h.fonts, display: pick, ...(body ? { body: pick } : {}) }
  delete h.fonts.displayKo // 한글 제목체가 남으면 새 서체를 가린다
  h.id = `${head.id}-${slug(font.item.replace(/^font-/, ''))}`.slice(0, 60).replace(/-+$/, '')
  h.name = `${head.name} (${font.family})`
  return lintRecipeReport(h).violations.length === 0 ? h : null
}

const BODY_CATEGORIES = new Set(['serif', 'sans', 'mono']) // 본문까지 바꾸는 범주 — 손글씨·둥근 서체는 제목만(긴 글이 읽기 어렵다)

function planType(head, value, { lang, n }) {
  const ko = lang === 'ko'
  const cur = new Set([head.fonts?.display?.item, head.fonts?.body?.item])
  const heads = []
  const notes = []
  if (value.family) {
    const e = families().get(value.family.toLowerCase())
    if (!e?.installable) {
      const ref = refFonts().find((r) => r.family === value.family)
      const cat = ref ? REF_CATEGORY[ref.category] : null
      return { ask: ko ? `${value.family} 는 설치할 수 있는 서체가 아니에요.${cat ? ` 비슷한 ${TYPE_CATEGORIES.find((c) => c.key === cat).label} 계열로 바꿀까요?` : ' 비슷한 서체로 바꿀까요?'}` : `${value.family} isn't an installable font. Try a similar one?`, reason: 'font-not-installable' }
    }
    const f = { family: faceOf(e.item), item: e.item }
    const both = e.korean ? fontHead(head, f, { body: true }) : null
    const titleOnly = fontHead(head, f, { body: false })
    if (both) heads.push({ value: f.family, label: say(V.fontBoth, ko, { family: f.family }), head: both, detail: { applies: 'display+body' } })
    if (titleOnly) heads.push({ value: f.family, label: say(V.fontTitle, ko, { family: f.family }), head: titleOnly, detail: { applies: 'display' } })
    if (!e.korean) notes.push(ko ? `${f.family} 는 한글을 그리지 못해 본문은 그대로 두고 제목만 바꿔요.` : `${f.family} can't draw Korean, so only headings change.`)
    if (!heads.length) return { ask: ko ? `${f.family} 는 이 레시피의 서체 규칙을 맞출 수 없어요. 비슷한 서체로 바꿀까요?` : `${f.family} doesn't fit this recipe's font rules. Try a similar one?`, reason: 'lint' }
    return { heads: heads.slice(0, n), notes }
  }
  const cat = TYPE_CATEGORIES.find((c) => c.key === value.category)
  const pool = koreanKitFonts().filter((f) => f.category === value.category)
  const fresh = pool.filter((f) => !cur.has(f.item))
  if (fresh.length < pool.length) notes.push(ko ? `지금 쓰는 서체는 안에서 뺐어요(이미 ${cat.label} 계열).` : `The font already in use is left out (it is already ${cat.en}).`)
  const body = BODY_CATEGORIES.has(value.category)
  for (const f of fresh) {
    if (heads.length >= n) break
    const h = fontHead(head, f, { body })
    if (h) heads.push({ value: f.family, label: say(body ? V.fontBoth : V.fontTitle, ko, { family: f.family }), head: h, detail: { applies: body ? 'display+body' : 'display', category: value.category } })
  }
  if (!heads.length) return { ask: ko ? `${cat.label} 계열로는 이 레시피의 서체 규칙을 맞출 수 없어요. 다른 서체로 바꿀까요?` : `No ${cat.en} font fits this recipe's rules. Try another style?`, reason: 'no-font' }
  notes.unshift(ko ? `${cat.label} 계열 서체로 읽었어요. 정확한 서체 이름이 있으면 알려 주세요.` : `Read it as a ${cat.en} font. If you have an exact font name, tell me.`)
  if (!body) notes.push(ko ? '본문은 그대로 두고 제목만 바꿨어요(긴 글은 읽기 쉬운 서체가 낫다).' : 'Only headings change; body text keeps its readable font.')
  return { heads, notes }
}

/**
 * 값이 든 축 요청 → 안 계획. request = parseRevision 결과({ target: "color"|"type", value, text }), head = 후보의 지금 레시피 머리.
 * @returns {{ ask: string, reason?: string, suggestion?: string } | { heads: { value: string, label: string, head: object, detail: object }[], notes: string[] }}
 */
export function planAxisValue(head, request, { n = 2 } = {}) {
  const lang = isKo(request.text ?? '') ? 'ko' : 'en'
  if (request.target === 'color') return planColor(head, request.value, { lang })
  if (request.target === 'type') return planType(head, request.value, { lang, n })
  throw new Error(`값을 받는 축이 아니다: ${request.target}`)
}
