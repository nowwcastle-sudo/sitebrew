// 반경 축(R0·R1·R2·R3) 값 파일을 base.css 에서 만든다: node factory/scripts/gen-radius-axis.mjs [--check]
// 반경 축의 훅 = 다른 축 계열(버튼·입력·카드·표·헤더·그림자)에 들지 않는 나머지 부품 훅 중 모서리 토큰이 있는 것.
// 컴파일러가 훅을 통째로 덮어쓰므로 값 파일은 그 훅의 base 토큰을 모두 옮겨 적되 rounded-*·--cell-radius 만 바꾼다.
// 손으로 쓰면 base 가 바뀔 때 조용히 옛 여백을 되살리므로 생성한다. --check: 파일이 생성 결과와 다르면 종료 코드 1.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createStyleMap } from 'shadcn/utils'
import { AXES_DIR, BASE_CSS, axisOfHook } from './axes.mjs'

export const HEADER = '/* 생성물 — factory/scripts/gen-radius-axis.mjs 로 다시 만든다. 손으로 고치지 않는다. */'

// 'a:[&_x:y]:b' → ['a:[&_x:y]:', 'b'] — 괄호 안의 콜론은 자르지 않는다.
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
const ROUNDED = /^(!?)rounded(-(?:tl|tr|br|bl|ss|se|es|ee|t|r|b|l|s|e))?(?:-(.+?))?(!?)$/

// 상호작용 작은 컨트롤 — R2 에서 알약(rounded-full)이 되는 훅.
const PILL = [/^cn-badge$/, /^cn-tabs-list$/, /^cn-tabs-trigger$/, /^cn-toggle(-size-.+)?$/, /^cn-toggle-group(-item)?$/, /^cn-kbd$/, /^cn-avatar(-.+)?$/]

// size(없으면 기본 rounded = 0.25rem) → 값별 크기.
const SIZE = {
  R0: () => 'none',
  // 명세 12~16px: 작은 것·중간 12, lg 14, 큰 면 16.
  R1: (s) => ({ none: 'none', full: 'full', xs: '[12px]', sm: '[12px]', md: '[12px]', lg: '[14px]' })[s] ?? (/^(x|[234]x)l$/.test(s) ? '[16px]' : '[12px]'),
  R2: (s) => ({ none: 'none', full: 'full', xs: '[6px]', sm: '[6px]', md: '[8px]', lg: '[8px]' })[s] ?? (/^(x|[234]x)l$/.test(s) ? '[16px]' : '[8px]'),
}
// R3 유기 곡선(P3-2 Task 16a): 컨트롤·면은 R1 과 똑같이(컨트롤을 R1 계열에 둔다 — 브리프), 이미지 마스크(아바타 그림·대체 글자 칸)만 블롭 반경.
SIZE.R3 = SIZE.R1
export const MASK_HOOKS = /^cn-avatar(-image|-fallback)?$/
export const BLOB = '[42%_58%_63%_37%/41%_44%_56%_59%]'
const CELL = { R0: '0px', R1: '12px', R2: '9999px', R3: '12px' }
// R1 의 예외: 16px 체크박스에 12px 를 주면 원(라디오)처럼 보인다 — 네모 의미를 지키려 6px 로 둔다.
const R1_SMALL_BOX = { 'cn-checkbox': '[6px]' }
// R0 의 예외: 라디오 점은 둥글어야 체크박스와 구별된다(의미 모양).
const KEEP_ROUND_R0 = /^cn-radio-group-(item|indicator)$/

// 레시피 반경 토큰(P3-2 Task 8, 대장 A11): 블록 표면의 rounded-sm·md·lg·xl 은 소비자 @theme 의 calc(var(--radius) × 0.6·0.8·1·1.4)다.
// 그 네 단계가 이 값의 SIZE 표(sm·md·lg·xl)에 가장 가깝도록 --radius 를 최소제곱으로 고르고 px 정수로 반올림한다 —
// R0 0px · R1 13px · R2 10px(= shadcn 기본 0.625rem) · R3 = R1(컨트롤·면은 R1 과 같다, 블롭은 이미지 마스크 토큰만).
const SCALE = [['sm', 0.6], ['md', 0.8], ['lg', 1], ['xl', 1.4]]
const px = (size) => (size === 'none' ? 0 : Number(size.match(/^\[(\d+(?:\.\d+)?)px\]$/)?.[1]))
export function radiusToken(value) {
  if (!SIZE[value]) throw new Error(`반경 값 ${value} 를 모른다`)
  const r = SCALE.reduce((s, [k, m]) => s + px(SIZE[value](k)) * m, 0) / SCALE.reduce((s, [, m]) => s + m * m, 0)
  return `${Math.round(r)}px`
}
// 이미지 마스크 반경 토큰(대장 A11·A20): 블록의 둥근 그림 칸(원형 마스크)이 rounded-(--wf-mask-radius) 로 읽는다. R3 만 블롭, 나머지는 원(rounded-full 과 같은 값).
export const maskRadiusToken = (value) => (value === 'R3' ? BLOB.slice(1, -1).replaceAll('_', ' ') : 'calc(infinity * 1px)')

export function transformToken(token, value, hook) {
  const cell = token.match(/^\[--cell-radius:.+\]$/)
  if (cell) return `[--cell-radius:${CELL[value]}]`
  const [variants, util] = splitUtil(token)
  const m = util.match(ROUNDED)
  if (!m) return token
  const [, pre, side = '', size = '', post] = m
  if (size.startsWith('(')) return token // rounded-(--cell-radius) 는 변수로 따라간다
  const base = size || 'DEFAULT'
  let next
  if (value === 'R0' && KEEP_ROUND_R0.test(hook) && base === 'full') next = 'full'
  else if (value === 'R2' && PILL.some((r) => r.test(hook)) && base !== 'none') next = 'full'
  else if (value === 'R3' && MASK_HOOKS.test(hook) && base !== 'none') next = BLOB
  else if ((value === 'R1' || value === 'R3') && R1_SMALL_BOX[hook] && base !== 'none' && base !== 'full') next = R1_SMALL_BOX[hook]
  else next = SIZE[value](base === 'DEFAULT' ? 'sm' : base)
  return `${variants}${pre}rounded${side}-${next}${post}`
}

export const VALUES = [
  { id: 'R0', slug: 'r0-zero', note: '모든 모서리 90° — 계산된 border-radius 0(라디오 점만 원)' },
  { id: 'R1', slug: 'r1-soft', note: '전부 부드럽게 12~16px — 작은 것·중간 12·lg 14·큰 면 16px, 원은 원래 원이던 것만(체크박스는 네모 의미로 6px)' },
  { id: 'R2', slug: 'r2-pill-controls', note: '상호작용 작은 컨트롤(배지·탭·토글·kbd·아바타)만 알약, 큰 면 16·나머지 6~8px' },
  { id: 'R3', slug: 'r3-organic', note: '유기 곡선 — 이미지 마스크(아바타 그림·대체 글자 칸)만 블롭 반경, 컨트롤·면은 R1 과 같은 12~16px(컨트롤에는 블롭 금지)' },
]

export function radiusHooks(baseMap) {
  return Object.keys(baseMap).filter((h) => axisOfHook(h) === 'radius' && baseMap[h].split(/\s+/).some((t) => /(^|:)!?rounded|^\[--cell-radius:/.test(t)))
}

export function render(baseMap, v) {
  const lines = [HEADER, `/* ${v.id} · ${v.note}. 원천: base.css 의 반경 계열 훅(axes.mjs axisOfHook = radius). */`, '']
  for (const h of radiusHooks(baseMap)) {
    const toks = baseMap[h].split(/\s+/).filter(Boolean).map((t) => transformToken(t, v.id, h))
    lines.push(`.${h} {`, `  @apply ${toks.join(' ')};`, '}')
  }
  return lines.join('\n') + '\n'
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const check = process.argv.includes('--check')
  const baseMap = createStyleMap(readFileSync(BASE_CSS, 'utf8'))
  const dir = join(AXES_DIR, 'radius')
  mkdirSync(dir, { recursive: true })
  let stale = 0
  for (const v of VALUES) {
    const p = join(dir, `${v.slug}.css`), want = render(baseMap, v)
    let have = ''
    try { have = readFileSync(p, 'utf8').replace(/\r\n/g, '\n') } catch {} // autocrlf 체크아웃도 같은 내용으로 본다
    if (have === want) continue
    if (check) { stale++; console.error(`낡음: ${p}`) } else writeFileSync(p, want)
  }
  console.log(`gen-radius-axis: 훅 ${radiusHooks(baseMap).length}개 × 값 ${VALUES.length}${check ? `, 낡은 파일 ${stale}` : ''}`)
  process.exit(stale ? 1 : 0)
}
