// 스타일 축 값 파일(registry/factory/styles/axes/<축>/<값>.css)의 목록과 축별 훅 계열.
// 컴파일러는 훅 키 단위로 덮어쓴다(뒤 CSS 가 같은 키를 통째로 바꾼다). 그래서 축마다 자기 훅 계열만 가진다 —
// 한 축 값이 다른 축의 훅을 건드리면 레시피에서 순서에 따라 한쪽이 조용히 사라진다(axes.test.mjs 가 막는다).
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createStyleMap } from 'shadcn/utils'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const AXES_DIR = join(root, 'registry', 'factory', 'styles', 'axes')
export const BASE_CSS = join(root, 'registry', 'factory', 'styles', 'base.css')

// Task 6 buildRecipe 의 적용 순서(base → radius → button → input → surface → table → header → shadow → display → texture).
// display(D, 디스플레이 규모)·texture(X, 질감)는 P3-2 Task 16a 에서 더한 축이다 — 레시피 머리에 없으면 기본값(AXIS_DEFAULTS)을 쓴다.
export const AXIS_ORDER = ['radius', 'button', 'input', 'surface', 'table', 'header', 'shadow', 'display', 'texture']
// 레시피 머리 axes 에 적지 않아도 되는 축과 그 기본값(Task 16a, 접합면 J6). 기본값은 base.css 와 같은 모양이라 기존 레시피의 생성물이 바뀌지 않는다.
export const AXIS_DEFAULTS = { display: 'D1', texture: 'X0' }
// 레시피 머리의 축 값(적지 않은 선택 축은 기본값).
export const axisValue = (axes, axis) => axes?.[axis] ?? AXIS_DEFAULTS[axis]

// 훅 → 축. 위에서부터 첫 일치. 어느 계열에도 안 들면 radius(나머지 부품의 모서리)다.
export const FAMILIES = [
  // 블록 훅(P3-2, cn-block-*)은 어느 스타일 축에도 속하지 않는다 — 블록은 레시피마다 하나라 base 값으로만 컴파일된다(gen-blocks).
  // 맨 앞에 둔다: -shadow 로 끝나는 블록 훅이 그림자 축으로, 모서리가 있는 블록 훅이 반경 축 생성물(gen-radius-axis)로 새지 않게.
  ['block', [/^cn-block(-.+)?$/]],
  ['shadow', [/-shadow$/]],
  ['button', [/^cn-button(-.+)?$/]],
  ['input', [/^cn-input$/, /^cn-input-group(-.+)?$/, /^cn-textarea$/, /^cn-native-select(-.+)?$/, /^cn-select-trigger(-icon)?$/]],
  // 모달 배경(overlay)은 표면 축이 맡는다 — 글래스(C5)의 블러가 걸리는 유일한 자리(흐르는 카드에는 블러 금지).
  ['surface', [/^cn-card(-.+)?$/, /^cn-(dialog|alert-dialog|sheet|drawer)-overlay$/]],
  ['table', [/^cn-table(-.+)?$/]],
  // site-shell 헤더(Task 11)도 헤더 축이 맡는다: 바·안쪽 줄(고정 방식·높이)·내비 목록·내비 링크(모서리·현재 위치 표시). 모든 헤더 값이 이 넷을 쓴다.
  ['header', [/^cn-navigation-menu(-.+)?$/, /^cn-sidebar(-.+)?$/, /^cn-site-shell-(header|header-inner|nav-list|nav-link)$/]],
  // Task 16a: 디스플레이 규모(D) — 부품 display.tsx 의 제목 칸, 질감(X) — 부품 texture.tsx 의 면 구획.
  ['display', [/^cn-display(-.+)?$/]],
  ['texture', [/^cn-texture(-.+)?$/]],
]
export function axisOfHook(hook) {
  for (const [axis, res] of FAMILIES) if (res.some((r) => r.test(hook))) return axis
  return 'radius'
}

// [{ axis, id: 'B1', slug: 'b1-square', file }] — 축 순서, 값 순서.
export function listValues() {
  const out = []
  for (const axis of AXIS_ORDER) {
    let files = []
    try { files = readdirSync(join(AXES_DIR, axis)).filter((f) => f.endsWith('.css')).sort() } catch { continue }
    for (const f of files) {
      const slug = f.replace(/\.css$/, '')
      out.push({ axis, id: slug.split('-')[0].toUpperCase(), slug, file: join(AXES_DIR, axis, f) })
    }
  }
  return out
}

export const styleMapOf = (file) => createStyleMap(readFileSync(file, 'utf8'))

// 값 파일의 키 중 자기 축 계열 밖인 것.
export const outOfFamily = (axis, map) => Object.keys(map).filter((h) => axisOfHook(h) !== axis)

// T7-I1: 고정폭 글꼴은 숫자·코드·ID 에만 쓴다. 한글 글을 담는 훅(표 머리·캡션·이름 칸·입력·textarea·선택·내비 이름)에는
// 변형 없는 font-mono 를 두지 않는다. 숫자 전용 훅(NUMERIC_HOOKS)은 그대로 둘 수 있고, 그 밖의 훅은 숫자·코드를 가리키는
// 변형(NUMERIC_VARIANTS — inputmode·type 속성, 셀의 data-numeric) 아래에서만 쓴다. 검사: axes.test.mjs 「mono」.
export const NUMERIC_HOOKS = ['cn-input-otp-slot', 'cn-kbd']
export const NUMERIC_VARIANTS = ['[&[inputmode=decimal]]', '[&[inputmode=numeric]]', '[&[type=number]]', '[&[type=tel]]', 'data-numeric']
export function monoOnText(map) {
  const bad = []
  for (const [hook, cls] of Object.entries(map)) for (const t of String(cls).split(/\s+/).filter(Boolean)) {
    const parts = t.split(':')
    if (parts.at(-1) !== 'font-mono' || NUMERIC_HOOKS.includes(hook)) continue
    const variants = parts.slice(0, -1)
    if (!variants.length || !variants.every((v) => NUMERIC_VARIANTS.includes(v))) bad.push(`${hook} ${t}`)
  }
  return bad
}
