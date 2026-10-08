// 「줄인 스타일」 검수대: node factory/qa/shrunk.mjs
// 기본 훅(base.css)의 높이·크기 토큰(h-*·min-h-*·size-*, ! 포함)을 24px(= 6)로, 세로 여백(p·py·pt·pb)을 0으로 줄인 스타일로 ui-src 를 컴파일해
// app/qa/shrunk/ (gitignore) 에 /qa/base 와 같은 페이지를 만든다. 레시피가 크기를 줄여도 히트 영역 규칙이 남는지
// hit-area.mjs 로 재기 위한 것이다. 이미 24px 이하인 토큰과 레이아웃 크기(h-full·h-(--x)·h-[calc()])는 그대로 둔다.
import { readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadStyleMap, compileDir } from '../scripts/compile-styles.mjs'

const MIN = 6 // Tailwind 간격 단위 6 = 24px (WCAG 2.5.8 최소)

// 'a:[&_x:y]:b' → 마지막 콜론(괄호 밖) 뒤가 유틸리티.
function splitUtil(token) {
  let depth = 0, cut = -1
  for (let i = 0; i < token.length; i++) {
    const c = token[i]
    if (c === '[' || c === '(') depth++
    else if (c === ']' || c === ')') depth--
    else if (c === ':' && depth === 0) cut = i
  }
  return [token.slice(0, cut + 1), token.slice(cut + 1)]
}

// 한 토큰 → 한 개 이상의 토큰. 높이·크기(h·min-h·size)는 24px 초과면 24px, 세로 여백(py·pt·pb)은 0,
// p-N 은 가로를 남기고 세로만 0(px-N py-0). 앞뒤 ! (important) 는 그대로 둔다.
export function shrinkToken(token) {
  const [variants, raw] = splitUtil(token)
  const bang = raw.match(/^(!?)(.*?)(!?)$/)
  const [pre, util, post] = [bang[1], bang[2], bang[3]]
  const wrap = (u) => `${variants}${pre}${u}${post}`
  const size = util.match(/^(h|min-h|size)-(?:(\d+(?:\.\d+)?)|\[(\d+(?:\.\d+)?)px\])$/)
  if (size) {
    const units = size[2] !== undefined ? Number(size[2]) : Number(size[3]) / 4
    return units > MIN ? wrap(`${size[1]}-${MIN}`) : token
  }
  const pad = util.match(/^(p|py|pt|pb)-((?:\d+(?:\.\d+)?|px)|\[[\d.]+px\])$/)
  if (pad) return pad[1] === 'p' ? `${wrap(`px-${pad[2]}`)} ${wrap('py-0')}` : wrap(`${pad[1]}-0`)
  return token
}

export function shrinkStyleMap(map) {
  const out = {}
  for (const [hook, value] of Object.entries(map)) out[hook] = value.split(/\s+/).filter(Boolean).map(shrinkToken).join(' ')
  return out
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const root = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..')
  const outDir = join(root, 'app', 'qa', 'shrunk')
  const uiDir = join(outDir, 'ui')
  rmSync(outDir, { recursive: true, force: true })
  const base = await loadStyleMap([join(root, 'registry', 'factory', 'styles', 'base.css')])
  const map = shrinkStyleMap(base)
  const changed = Object.keys(map).filter((k) => map[k] !== base[k])
  const r = await compileDir(join(root, 'registry', 'factory', 'ui-src'), uiDir, map)
  // 컴파일본끼리의 import 를 같은 폴더로 돌린다(기본 ui/ 가 섞이지 않게).
  for (const f of readdirSync(uiDir).filter((f) => f.endsWith('.tsx'))) {
    const p = join(uiDir, f)
    writeFileSync(p, readFileSync(p, 'utf8').replaceAll('"@/registry/factory/ui/', '"./'))
  }
  const page = readFileSync(join(root, 'app', 'qa', 'base', 'page.tsx'), 'utf8')
    .replace(/"@\/registry\/factory\/ui\/(?!registry\.json)/g, '"./ui/')
    .replace('// /qa/base —', '// /qa/shrunk (생성물 — factory/qa/shrunk.mjs, 크기 훅을 24px로 줄인 컴파일본) · 원본 /qa/base —')
  writeFileSync(join(outDir, 'page.tsx'), page)
  writeFileSync(join(outDir, 'layout.tsx'), readFileSync(join(root, 'app', 'qa', 'base', 'layout.tsx'), 'utf8').replace('QA · 기본 부품', 'QA · 줄인 스타일'))
  console.log(`shrunk: 훅 ${changed.length}개 줄임, 부품 ${r.files}개 → app/qa/shrunk/ui, 페이지 app/qa/shrunk/page.tsx`)
}
