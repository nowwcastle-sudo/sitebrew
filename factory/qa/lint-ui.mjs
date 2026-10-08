// 정적 바닥 규칙 검사: node factory/qa/lint-ui.mjs [생성물 폴더] [--src <원천 폴더>]
//   인자가 없으면 생성물 registry/factory/ui 와 원천 registry/factory/ui-src 를 모두 본다(경로로 정한다).
//   인자가 없으면 레시피 컴파일본 registry/factory/r/<id>/ui 도 전부 본다.
// 부품 소스의 클래스 문자열에서 DESIGN.md MUST 위반을 정규식으로 찾는다. 실패가 하나라도 있으면 종료 코드 1.
//  ring-1      포커스 표시가 1px (§7: 2px 이상)
//  ring-alpha  포커스 상태의 반투명 링(/NN) — 3:1 을 못 넘는다 (§7)
//  invalid-focus  aria-invalid 반투명 링이 있는데 포커스 때 불투명 링으로 덮는 규칙이 없다(캐스케이드에서 반투명이 이긴다)
//  small-text  text-xs·text-[0.xrem]·text-[Npx](N<14) — 14px 미만 (§2)
//  transition-all  (속도·접근성: 필요한 속성만 전환)
//  group-hit   묶음(ButtonGroup·ToggleGroup) 안에서 히트 영역이 옆 버튼을 덮는다 (§7 인접 타깃)
//  generated-marker  생성물 폴더에 표지 GENERATED.md 가 없거나, 부품 파일에 「손으로 고치지 않는다」 머리줄이 들어 있다(설치본으로 따라간다)
// 원천 폴더(--src) 규칙:
//  shape-outside-hook  모양 클래스가 cn-* 훅 밖에 남았다 — 인라인 모양은 훅을 이겨 스타일을 조용히 무력화한다
//  duplicate-hook  cva·mergeProps 자리의 훅 이름이 같은 파일에 또 나온다 — 컴파일러는 그런 훅을 한 번만 채우고 나머지는 지운다
//  icon-label  size="icon*" 버튼(아이콘만)에 aria-label·sr-only 이름이 없다(WCAG 4.1.2 — 아래 iconLabelProblems)
//  fixed-duration  고정 전환 길이(duration-300·duration-[250ms]·[transition:…500ms]·인라인 style) — 모션 토큰으로(부품·블록 원천·base.css)
// 블록 층(인자 없이 돌릴 때): block-token — 블록 훅 값(base.css .cn-block-*)·블록 원천의 제목 칸 고정 굵기·임의 반경·임의 그림자(아래 blockTokenProblems)
// 블록 층 폼·포커스 규칙(P3-2 Task 7a, 대장 A2·A42·A44·A100): disabled-focus · ime-enter · autocomplete (블록 원천), forced-colors-focus (모든 원천·컴파일본 — lintSource)
// 경고: animate-* 에 motion-reduce 가 없음 — factory-base 가 전역으로 동작 줄이기를 걸면 건너뛴다.
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { MARKER } from '../scripts/compile-styles.mjs'
import { shapeOutsideHooks, duplicateHooks } from '../scripts/hooks-audit.mjs'

const HAND_EDIT_BANNER = '손으로 고치지 않는다'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..')

// 크기 변형에 사방 히트 확장(after:-inset-N)이 있으면, 묶음 안에서는 좌우 확장을 없애야 한다.
export const GROUPED = { 'button.tsx': 'button-group', 'toggle.tsx': 'toggle-group' }

const tokens = (line) => line.split(/[\s"'`]+/).filter(Boolean)
const isFocusVariant = (t) => /(^|:|\[)(focus|focus-visible|focus-within)(:|\]|$)/.test(t) || /:focus(-visible|-within)?\]/.test(t)
const alphaRing = (t) => /(^|:)ring-[a-z]+(-[a-z]+)*\/\d+$/.test(t)
const opaqueRing = (t) => /(^|:)ring-(ring|destructive)$/.test(t)

export function lintSource(file, source, { motionCoveredGlobally = false, generated = false } = {}) {
  const fails = [], warns = []
  const lines = source.split('\n')
  if (generated) lines.forEach((l, i) => { if (l.includes(HAND_EDIT_BANNER)) fails.push({ rule: 'generated-marker', at: `${file}:${i + 1}`, hit: HAND_EDIT_BANNER }) })
  lines.forEach((line, i) => {
    const at = `${file}:${i + 1}`
    const ts = tokens(line)
    for (const m of line.matchAll(/focus[-a-z]*:ring-1\b/g)) fails.push({ rule: 'ring-1', at, hit: m[0] })
    for (const t of ts) if (isFocusVariant(t) && alphaRing(t)) fails.push({ rule: 'ring-alpha', at, hit: t })
    const invalidAlpha = ts.filter((t) => /aria-invalid|aria-\[invalid/.test(t) && !isFocusVariant(t) && alphaRing(t))
    const hasFocusRing = ts.some((t) => isFocusVariant(t) && /(^|:)ring-/.test(t))
    const invalidFocusOpaque = ts.some((t) => /aria-invalid|aria-\[invalid/.test(t) && isFocusVariant(t) && opaqueRing(t))
    if (invalidAlpha.length && hasFocusRing && !invalidFocusOpaque) fails.push({ rule: 'invalid-focus', at, hit: invalidAlpha.join(' ') })
    // 다크의 dark:aria-invalid:ring-*/40 이 라이트용 불투명 링을 이긴다 — 다크 짝이 있어야 포커스 링이 불투명하다(계획 1 재검토 minor).
    if (ts.includes('aria-invalid:focus-visible:ring-ring') && !ts.includes('dark:aria-invalid:focus-visible:ring-ring')) fails.push({ rule: 'invalid-focus-dark', at, hit: 'aria-invalid:focus-visible:ring-ring 의 dark: 짝이 없다' })
    // forced-colors-focus(A100): 링은 box-shadow 라 Windows 고대비에서 지워진다 — outline-none 이 같이 있으면 대체 윤곽까지 없어 포커스가 안 보인다(WCAG 2.4.7). outline-hidden 만 고대비에서 윤곽을 남긴다.
    if (ts.some((t) => /(^|:)outline-none$/.test(t)) && ts.some((t) => isFocusVariant(t) && /(^|:)ring-/.test(t))) fails.push({ rule: 'forced-colors-focus', at, hit: 'outline-none + focus ring — outline-hidden 으로(고대비 모드에서 포커스 윤곽이 남는다)' })
    for (const m of line.matchAll(/\btext-xs\b|text-\[0\.[0-9a-z]+\]/g)) fails.push({ rule: 'small-text', at, hit: m[0] })
    for (const m of line.matchAll(/text-\[(\d+(?:\.\d+)?)px\]/g)) if (Number(m[1]) < 14) fails.push({ rule: 'small-text', at, hit: m[0] })
    for (const m of line.matchAll(/\btransition-all\b/g)) fails.push({ rule: 'transition-all', at, hit: m[0] })
    const group = GROUPED[file]
    if (group && /(^|\s)after:-inset-(\[|[0-9])/.test(line) && !line.includes(`in-data-[slot=${group}]:after:inset-x-0`))
      fails.push({ rule: 'group-hit', at, hit: (line.match(/after:-inset-(\[[0-9.a-z]+\]|[0-9.]+)/) ?? [''])[0] })
    if (!motionCoveredGlobally && /\banimate-/.test(line) && !/motion-reduce:/.test(line)) warns.push({ rule: 'motion', at })
  })
  return { fails, warns }
}

// factory-base.css 가 prefers-reduced-motion 에서 animation-duration 을 끄면 전역으로 덮인 것으로 본다.
export function motionCovered(baseCss) {
  const m = baseCss.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{([\s\S]*?)\}\s*\}/)
  return !!m && /animation-duration/.test(m[1]) && /transition-duration/.test(m[1])
}

// ── icon-label: size="icon*" 버튼(아이콘만 있는 버튼)에 이름이 있는가(WCAG 4.1.2, DESIGN §6-A) ──────────────
// 이름으로 치는 것: 그 태그의 aria-label·aria-labelledby, 그 요소 안의 sr-only 글자. 태그가 render 로 넘겨지는 값이면
// (render={<Button size="icon-sm" />} 또는 기본값 render = <Button … />) 그것을 그리는 바깥 요소의 태그를 본다.
// 이름이 props 로 들어오는 곳은 태그 안에 /* icon-label: <이유> */ 주석을 단다(예: DayPicker 가 aria-label 을 넘기는 날짜 버튼).
// 태그 끝 '>' — 따옴표·중괄호 안의 '>' 는 건너뛴다.
function tagEnd(src, start) {
  let depth = 0, quote = null
  for (let i = start + 1; i < src.length; i++) {
    const c = src[i]
    if (quote) { if (c === quote) quote = null; continue }
    if (c === '"' || c === "'" || c === '`') quote = c
    else if (c === '{') depth++
    else if (c === '}') depth--
    else if (c === '>' && depth === 0 && src[i - 1] !== '=') return i
  }
  return -1
}
// idx 를 품는 가장 가까운 JSX 여는 태그 [시작, 끝].
function enclosingTag(src, idx) {
  for (let p = src.lastIndexOf('<', idx); p >= 0; p = src.lastIndexOf('<', p - 1)) {
    if (!/[A-Za-z]/.test(src[p + 1] ?? '')) continue
    const e = tagEnd(src, p)
    if (e >= idx) return [p, e]
  }
  return null
}
function elementBody(src, [s, e]) {
  if (src[e - 1] === '/') return ''
  const name = src.slice(s + 1).match(/^[A-Za-z][\w.]*/)[0]
  const close = src.indexOf(`</${name}>`, e)
  return close === -1 ? '' : src.slice(e + 1, close)
}
export function iconLabelProblems(source) {
  const out = []
  const NAMED = /\baria-label(ledby)?\s*=|icon-label:/
  // 잡는 모양: size="icon…" · size={"icon…"}(따옴표·백틱) · size={식}(변수 등 — 정적으로 아이콘이 아님을 증명할 수 없으면 아이콘으로 본다).
  // 식이 아이콘 크기가 될 수 없는 곳(예: 글자가 늘 보이는 버튼)은 태그 안에 /* icon-label: 이유 */ 를 단다. data-size 는 보지 않는다.
  // 한계: 스프레드({...props})로 들어오는 size 는 보지 못한다 — 그런 버튼의 이름은 IconButton(label 필수 타입)이 맡는다.
  const SIZE = /(?<![\w-])size=(?:(["'])icon[\w-]*\1|\{\s*(["'`])icon[\w-]*\2\s*\}|\{\s*(?!["'`])([^}]+?)\s*\})/g
  for (const m of source.matchAll(SIZE)) {
    // 식이 따옴표 문자열(아이콘 아님, 예: size={"sm"})이면 건너뛴다 — 위 세 번째 갈래는 따옴표로 시작하지 않는 식만 잡는다.
    const tag = enclosingTag(source, m.index)
    if (!tag) continue
    const texts = [source.slice(tag[0], tag[1] + 1)]
    let body = elementBody(source, tag)
    const before = source.slice(0, tag[0])
    const outerAt = /render\s*=\s*\{[^{}<>]*$/.test(before) ? tag[0]
      : /render\s*=\s*$/.test(before) ? source.indexOf('render={render}', tag[1]) : -1
    if (outerAt !== -1) {
      const outer = enclosingTag(source, outerAt === tag[0] ? tag[0] - 1 : outerAt)
      if (outer) { texts.push(source.slice(outer[0], outer[1] + 1)); body += elementBody(source, outer) }
    }
    if (texts.some((t) => NAMED.test(t)) || /\bsr-only\b/.test(body)) continue
    out.push({ line: source.slice(0, m.index).split('\n').length, hit: m[0] })
  }
  return out
}

// ── fixed-duration: 부품 원천의 고정 전환 길이 duration-<숫자>(0 제외, P3-2 Task 2) ──────────────────────────
// 고정 길이는 레시피 모션 토큰을 읽지 않아 M0 과 M3 레시피의 상호작용 결이 같아진다. 호버·포커스는 duration-(--duration-hover,…),
// 팝오버·메뉴는 duration-(--duration-popover,…), 시트·대화상자는 duration-(--duration-sheet,…)(쉼표 뒤는 토큰이 없을 때의 M2 값).
// duration-0(스와이프 중 전환 끄기)·duration-[calc(…)] 같은 계산 길이는 규칙이다 — 잡지 않는다.
// P3-2 Task 1c(리뷰 I-8): 임의 값도 잡는다 — duration-[250ms]·duration-[0.35s]·[transition:…500ms…]·[transition-duration:…]·[animation:…]·
// animate-[fade_300ms_ease], 인라인 style={{ transition·transitionDuration·animation·animationDuration: "…ms" }}. var(…)·calc(…) 안의 시간
// (토큰 대체값 duration-(--duration-hover,200ms) · [transition:opacity_var(--duration-popover,160ms)])은 토큰을 읽는 길이라 잡지 않는다.
// CSS(@apply … duration-300;)에도 쓴다 — 토큰 끝에 ; 를 받는다.
const stripCssFns = (v) => { let s = v, prev; do { prev = s; s = s.replace(/(?:var|calc)\([^()]*\)/g, '') } while (s !== prev); return s }
const TIME_LITERAL = /(?<![\w.-])\d*\.?\d+m?s(?![\w-])/
const hasFixedTime = (v) => TIME_LITERAL.test(stripCssFns(v.replace(/_/g, ' ')))
export function fixedDurationProblems(source) {
  const out = []
  source.split('\n').forEach((line, i) => {
    for (const m of line.matchAll(/(?<=^|[\s"'`])((?:[^\s"'`]*:)?duration-[1-9]\d*)(?=$|[\s"'`;])/g)) out.push({ line: i + 1, hit: m[1] })
    for (const m of line.matchAll(/(?<=^|[\s"'`])((?:[^\s"'`]*:)?(?:duration-\[[^\]\s"'`]*\]|\[(?:transition|transition-duration|animation|animation-duration):[^\s"'`]*\]|animate-\[[^\]\s"'`]*\]))(?=$|[\s"'`;])/g))
      if (hasFixedTime(m[1])) out.push({ line: i + 1, hit: m[1] })
    for (const m of line.matchAll(/\b(transition|transitionDuration|animation|animationDuration)\s*:\s*(["'`])([^"'`]*)\2/g))
      if (hasFixedTime(m[3])) out.push({ line: i + 1, hit: `${m[1]}: ${m[2]}${m[3]}${m[2]}` })
  })
  return out
}

// ── block-token: 블록이 제 모양을 내는 면은 레시피 토큰에서(P3-2 Task 1c — 리뷰 I-4) ─────────────────────────────
// 블록 훅은 base 값으로 굳어(gen-blocks) 레시피 축이 닿지 않는다. 그래서 블록 훅 값(base.css `.cn-block-*`)과 블록 원천 인라인 클래스에서:
//   · 제목·질문 칸(h1~h6 에 달린 훅, font-heading·font-heading-ko 와 함께 쓴 훅, 이름에 title·heading·question 이 든 훅)에 고정 굵기(font-bold 등·font-[700])
//     — 굵기는 레시피가 정한다(.font-heading·.font-heading-ko 의 --wf-heading-weight-ko → --wf-heading-weight, gotcha 「제목 굵기는 레시피가 정한다」).
//     유틸리티가 @layer base 규칙을 이긴다. font-heading-ko(Task 14c)는 라틴 제목 서체를 건너뛴 한글 제목 스택 — 제목 칸 서체로 font-heading 과 똑같이 허용한다.
//   · 임의 길이 반경 rounded-[12px]·rounded-t-[0.5rem] — 토큰 반경 rounded-sm…4xl(app/globals.css @theme: calc(var(--radius) × k))·rounded-(--radius)·
//     rounded-none·rounded-full 은 된다.
//   · 임의 그림자 shadow-[…]·drop-shadow-[…] — 토큰 그림자 shadow-sm·md·lg(Tailwind --shadow-*)·shadow-(--x)·shadow-none 은 된다.
const FIXED_WEIGHT = /(?:^|:)font-(?:thin|extralight|light|normal|medium|semibold|bold|extrabold|black|\[\d+\])!?$/
const ARBITRARY_RADIUS = /(?:^|:)rounded(?:-[a-z]{1,2})?-\[([^\]]*)\]!?$/
const ARBITRARY_SHADOW = /(?:^|:)(?:drop-|inset-)?shadow-\[/
// 이름으로 제목 칸을 추정한다. 「title」이 배치 이름의 한 조각인 훅(히어로의 cropped-title-list·vertical-title-slides·narrow-title-wide-window 꼴)은 제목 칸이 아니라
// 목록·띠·창 같은 배치라서 뺀다(P3-2 Task 12, 대장 A9 — 레인 A 의 오탐). 진짜 제목 칸은 h 태그·font-heading 으로도 잡힌다(headingClassTexts).
const HEADING_HOOK_NAME = /(?:^|-)(?:title(?!-(?:list|stack|grid|row|column|band|strip|slides|wide|window|word|left|right|top|bottom|first|last|only|split)(?:-|$))|heading|question)(?:-|$)/
// 플랫폼 로그인 버튼 규격(DESIGN §17, 대장 A5): 카카오 12px · 네이버 6px · 구글 4px 는 공식 값이라 임의 반경 검사에서 이 훅·이 값만 뺀다.
// 훅을 쓰는 곳은 _shared/social-login.tsx 하나뿐이다(auth 종류의 소셜 버튼) — 다른 원천이 이 훅을 부르면 실패다.
export const PLATFORM_HOOKS = { 'cn-block-social-kakao': '12px', 'cn-block-social-naver': '6px', 'cn-block-social-google': '4px' }
const PLATFORM_HOME = '_shared/social-login.tsx'
const platformRadius = (hook, t) => PLATFORM_HOOKS[hook] !== undefined && t.match(ARBITRARY_RADIUS)?.[1] === PLATFORM_HOOKS[hook]
const fixedRadius = (t) => { const m = t.match(ARBITRARY_RADIUS); return !!m && /\d(?:px|rem|em|%)/.test(stripCssFns(m[1])) }

// base.css 의 블록 훅: [{ hook, line, tokens }].
export function blockHookValues(css) {
  const out = []
  for (const m of css.matchAll(/\.(cn-block-[a-z0-9-]+)\s*\{([^{}]*)\}/g)) {
    const apply = m[2].match(/@apply\s+([^;]*);/)
    out.push({ hook: m[1], line: lineOf(css, m.index), tokens: apply ? apply[1].trim().split(/\s+/) : [] })
  }
  return out
}

// 블록 원천에서 제목 칸의 클래스 묶음: h1~h6 태그의 속성 글, font-heading·font-heading-ko 가 든 문자열.
function headingClassTexts(source) {
  const out = []
  for (const m of source.matchAll(/<h[1-6]\b/g)) { const e = tagEnd(source, m.index); if (e !== -1) out.push({ text: source.slice(m.index, e + 1), index: m.index }) }
  for (const m of source.matchAll(/(["'`])([^"'`]*\bfont-heading(?:-ko)?\b[^"'`]*)\1/g)) out.push({ text: m[2], index: m.index })
  return out
}

// sources: [{ rel, source }] (블록·_shared 원천). 돌려줌: 실패 목록.
export function blockTokenProblems(baseCss, sources) {
  const fails = []
  const headingHooks = new Set()
  const seen = new Set()
  for (const { rel, source } of sources) for (const { text, index } of headingClassTexts(source)) {
    for (const h of text.match(/\bcn-block-[a-z0-9-]+/g) ?? []) headingHooks.add(h)
    for (const t of tokens(text)) {
      const at = `${rel}:${lineOf(source, index)}`
      // h 태그와 그 안의 font-heading 문자열이 같은 토큰을 두 번 볼 수 있다 — 자리·토큰마다 한 번.
      if (FIXED_WEIGHT.test(t) && !seen.has(`${at} ${t}`)) { seen.add(`${at} ${t}`); fails.push({ rule: 'block-token', at, hit: `${t} — 제목 칸 굵기는 font-heading·font-heading-ko(레시피 제목 굵기 토큰)로` }) }
    }
  }
  for (const { hook, line, tokens: ts } of blockHookValues(baseCss)) {
    const at = `styles/base.css:${line}`
    for (const t of ts) {
      if ((headingHooks.has(hook) || HEADING_HOOK_NAME.test(hook.slice('cn-block-'.length))) && FIXED_WEIGHT.test(t)) fails.push({ rule: 'block-token', at, hit: `${hook} ${t} — 제목 칸 굵기는 font-heading·font-heading-ko(레시피 제목 굵기 토큰)로` })
      if (fixedRadius(t) && !platformRadius(hook, t)) fails.push({ rule: 'block-token', at, hit: `${hook} ${t} — 반경은 토큰(rounded-sm…4xl · rounded-(--radius))으로` })
      if (ARBITRARY_SHADOW.test(t)) fails.push({ rule: 'block-token', at, hit: `${hook} ${t} — 그림자는 토큰(shadow-sm·md·lg · shadow-(--…))으로` })
    }
  }
  for (const { rel, source } of sources) if (rel !== PLATFORM_HOME) for (const h of Object.keys(PLATFORM_HOOKS)) if (source.includes(h)) fails.push({ rule: 'block-token', at: `${rel}:${lineOf(source, source.indexOf(h))}`, hit: `${h} — 플랫폼 로그인 버튼 훅은 ${PLATFORM_HOME} 에서만 쓴다` })
  for (const { rel, source } of sources) source.split('\n').forEach((l, i) => {
    for (const t of tokens(l)) {
      if (fixedRadius(t)) fails.push({ rule: 'block-token', at: `${rel}:${i + 1}`, hit: `${t} — 반경은 토큰(rounded-sm…4xl · rounded-(--radius))으로` })
      if (ARBITRARY_SHADOW.test(t)) fails.push({ rule: 'block-token', at: `${rel}:${i + 1}`, hit: `${t} — 그림자는 토큰(shadow-sm·md·lg · shadow-(--…))으로` })
    }
  })
  return fails
}

// 원천 폴더(ui-src): 훅 밖에 남은 모양 클래스마다, 두 번 나온 한 번짜리 훅마다, 이름 없는 아이콘 버튼마다 실패 하나.
export function lintSrcDir(dir) {
  const fails = []
  let files = 0
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.tsx')).sort()) {
    files++
    const source = readFileSync(join(dir, f), 'utf8')
    for (const h of shapeOutsideHooks(source)) fails.push({ rule: 'shape-outside-hook', at: `${f}:${h.where.split(':')[0]}`, hit: h.cls })
    for (const d of duplicateHooks(source)) fails.push({ rule: 'duplicate-hook', at: `${f}:${d.where.split(':')[0]}`, hit: d.name })
    for (const p of iconLabelProblems(source)) fails.push({ rule: 'icon-label', at: `${f}:${p.line}`, hit: `${p.hit} 에 aria-label·sr-only 이름이 없다` })
    for (const p of fixedDurationProblems(source)) fails.push({ rule: 'fixed-duration', at: `${f}:${p.line}`, hit: `${p.hit} — 모션 토큰(--duration-hover·popover·sheet)으로` })
  }
  return { files, fails }
}

// 레시피 컴파일본 폴더 registry/factory/r/<id>/ui 전부(인자 없이 돌리면 이것까지 본다 — 레시피도 14px 미만 글자를 싣지 않는다).
export function recipeUiDirs(factoryDir) {
  const r = join(factoryDir, 'r')
  if (!existsSync(r)) return []
  return readdirSync(r, { withFileTypes: true }).filter((d) => d.isDirectory() && existsSync(join(r, d.name, 'ui'))).map((d) => join(r, d.name, 'ui')).sort()
}

export function lintDir(dir, opts = {}) {
  const fails = [], warns = []
  let files = 0
  if (opts.generated && !existsSync(join(dir, MARKER))) fails.push({ rule: 'generated-marker', at: join(dir, MARKER), hit: 'missing' })
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.tsx')).sort()) {
    files++
    const r = lintSource(basename(f), readFileSync(join(dir, f), 'utf8'), opts)
    fails.push(...r.fails); warns.push(...r.warns)
  }
  return { files, fails, warns }
}

// ── 블록 층(P3-2) ────────────────────────────────────────────────────────────────
// 블록 원천(registry/factory/blocks/<kind>/*.tsx · _shared/*.tsx)은 부품 원천과 같은 규칙(훅 밖 모양·훅 중복·아이콘 이름)에 더해
// 부품 바닥 규칙(ring-1·small-text·transition-all …)을 받는다. 컴파일본(blocks/_compiled)은 생성물 폴더 규칙을 받는다.
//  numeric-cell(경고)  <td>·<TableCell> 에 data-numeric 이 없는데 그 블록의 예시 콘텐츠에 숫자 값이 있다 — 정적 검사의 한계로 경고만 한다.
//  k7-gradient        K7(듀오톤) 레시피 사본(.tmp/blocks/<id>/…)에 그라디언트(linear/radial/conic-gradient, bg-gradient-*·bg-linear-* 등)가 있다
//                     — DESIGN §5-B K7 「두 색 사이에 그라디언트를 넣지 않는다」(로드맵 Task 6b 이월). `lint-ui --blocks-recipe <id>` 로 돈다.
const lineOf = (source, index) => source.slice(0, index).split('\n').length
const HAS_NUMBER = /:\s*-?\d[\d_.]*\s*[,}\]\n]|["'`]\s*[-+]?\d[\d,.]*\s*(?:%|원|개|건|명|회|점|kg|g|ml|L)?\s*["'`]/

// 예시 파일(.fixture.ts)과 그것이 상대 경로로 가져오는 예시 파일들의 글(A132 — 예시 데이터가 다른 .fixture.ts 에 있는 블록). 없으면 null.
export function fixtureTextWithImports(fxPath, seen = new Set()) {
  if (seen.has(fxPath) || !existsSync(fxPath)) return seen.size ? '' : null
  seen.add(fxPath)
  const text = readFileSync(fxPath, 'utf8')
  const parts = [text]
  for (const m of text.matchAll(/from\s+["'](\.{1,2}\/[^"']+\.fixture)["']/g)) parts.push(fixtureTextWithImports(join(dirname(fxPath), `${m[1]}.ts`), seen) ?? '')
  return parts.join('\n')
}
// 글자 열 칸은 태그 안에 `/* numeric-cell: 글자 열 */` 을 적어 경고에서 뺀다(예시에 숫자가 있어도 그 칸은 글자다).
export function numericCellWarnings(file, source, fixtureSource) {
  if (!fixtureSource || !HAS_NUMBER.test(fixtureSource)) return []
  return [...source.matchAll(/<(td|TableCell)\b[^>]*>/g)].filter((m) => !/\bdata-numeric\b/.test(m[0]) && !/numeric-cell:\s*글자 열/.test(m[0])).map((m) => ({ rule: 'numeric-cell', at: `${file}:${lineOf(source, m.index)}`, hit: `<${m[1]}> 에 data-numeric 이 없다 — 숫자 열이면 단다` }))
}

// K7 「두 색 사이에 그라디언트를 넣지 않는다」(DESIGN §5-B) — 두 유채색(주색·강조·면색 field-N·칸색 block-N·차트색·리터럴 색) 사이를 잇는 그라디언트만 잡는다
// (P3-2 Task 12, 대장 A9). 스크림(투명으로 잦아듦)·단단한 띠(하드 스톱)·머리카락 격자·마스크·같은 색 한 겹은 두 색 사이가 아니라서 된다:
// 그라디언트 안의 유채색 이름(var(--primary)·#hex·oklch(…)·red …)이 서로 다른 것 둘 이상일 때 실패다. transparent·currentColor·흑백·
// 중립 토큰(background·foreground·border·muted·card·popover·input)과 지역 변수(--gw-veil 등)는 세지 않는다.
const NEUTRAL_TOKEN = /^(?:background|foreground|border|input|muted|muted-foreground|card|card-foreground|popover|popover-foreground|transparent|current|currentcolor|white|black|inherit)$/i
const CHROMA_TOKEN = /^(?:primary|accent|secondary|destructive|ring|field-\d|block-\d|chart-\d)(?:-foreground)?$/
const COLOR_NAME = /\b(?:red|blue|green|yellow|orange|purple|pink|cyan|magenta|teal|indigo|violet|lime|amber|rose|sky|emerald|fuchsia|crimson|navy|gold|coral)\b/gi
function gradientCalls(line) {
  const out = []
  for (const m of line.matchAll(/(?:repeating-)?(?:linear|radial|conic)-gradient\(/g)) {
    let depth = 1, i = m.index + m[0].length
    for (; i < line.length && depth > 0; i++) { if (line[i] === '(') depth++; else if (line[i] === ')') depth-- }
    out.push(line.slice(m.index + m[0].length, i - 1))
  }
  return out
}
function chromaticColors(args) {
  const s = args.replace(/\bin\s+(?:oklch|oklab|srgb|srgb-linear|lab|lch|hsl|hwb)\b/gi, '') // color-mix 의 보간 공간 이름은 색이 아니다
  const set = new Set()
  for (const m of s.matchAll(/var\(--([a-z0-9-]+)/gi)) if (!NEUTRAL_TOKEN.test(m[1]) && CHROMA_TOKEN.test(m[1])) set.add(`var(--${m[1].replace(/-foreground$/, '')})`)
  for (const m of s.matchAll(/#[0-9a-f]{3,8}\b/gi)) set.add(m[0].toLowerCase())
  for (const m of s.matchAll(/\b(?:oklch|oklab|lch|lab|rgba?|hsla?|hwb)\([^)]*\)/gi)) set.add(m[0].replace(/\s+/g, ''))
  for (const m of s.matchAll(COLOR_NAME)) set.add(m[0].toLowerCase())
  return set
}
export function gradientFails(file, source) {
  const fails = []
  source.split('\n').forEach((l, i) => {
    const at = `${file}:${i + 1}`
    for (const args of gradientCalls(l)) {
      const colors = chromaticColors(args)
      if (colors.size >= 2) fails.push({ rule: 'k7-gradient', at, hit: `gradient(${[...colors].join(' ↔ ')})` })
    }
    // Tailwind 그라디언트 유틸리티: bg-linear-to-r from-primary to-field-1 — 같은 줄의 from-·via-·to- 이름이 유채색 둘 이상이면
    if (/(?:^|[\s"'`:])bg-(?:gradient|linear|radial|conic)-/.test(l)) {
      const names = new Set()
      for (const m of l.matchAll(/(?:^|[\s"'`:])(?:from|via|to)-([a-z0-9]+(?:-[a-z0-9]+)*)(?:\/\d+)?(?=[\s"'`]|$)/g)) if (!NEUTRAL_TOKEN.test(m[1])) names.add(m[1])
      if (names.size >= 2) fails.push({ rule: 'k7-gradient', at, hit: `bg-gradient(${[...names].join(' ↔ ')})` })
    }
  })
  return fails
}

// ── 폼·포커스 규칙(블록 원천, P3-2 Task 7a — 대장 A2·A42·A44) ──────────────────────────────────────────────
const tagsNamed = (source, re) => [...source.matchAll(re)].flatMap((m) => { const e = tagEnd(source, m.index); return e === -1 ? [] : [{ name: m[1], text: source.slice(m.index, e + 1), index: m.index }] })

// disabled-focus(A2): 눌러 처리 중인 버튼에 disabled 만 달면 포커스가 body 로 빠져 키보드 사용자가 자리를 잃는다 — Button·ChoiceButton·IconButton 은 focusableWhenDisabled 를,
// 네이티브 button 은 disabled 대신 aria-disabled 를 쓴다. 옵션 자체가 없는 표시(ToggleGroupItem·라디오 칸의 품절)는 이 규칙 밖이다.
// 정말 잠겨야 하면 태그 안에 /* disabled-ok: 이유 */ 를 단다.
export function disabledFocusProblems(source) {
  return tagsNamed(source, /<(Button|ChoiceButton|IconButton|button)\b/g)
    .filter((t) => /\sdisabled(?=[\s=/>{])/.test(t.text) && !/\bfocusableWhenDisabled\b|disabled-ok:/.test(t.text))
    .map((t) => ({ line: lineOf(source, t.index), hit: `<${t.name} disabled> 에 focusableWhenDisabled 가 없다 — 포커스가 body 로 빠진다(aria-disabled 나 focusableWhenDisabled)` }))
}

// ime-enter(A42): 한글 조합 중 Enter 는 글자를 확정하는 키다 — 처리기가 그대로 받으면 조합 중인 글자가 전송·선택된다(cmdk 이슈 #348 꼴).
// 소스에 "Enter" 키 비교가 있으면 _shared/ime-guard 의 isComposingEnter(e)를 불러야 한다(nativeEvent.isComposing || keyCode 229).
export function imeEnterProblems(source) {
  if (/\bisComposingEnter\s*\(/.test(source)) return []
  const out = []
  source.split('\n').forEach((l, i) => { if (/["'`]Enter["'`]/.test(l) && !/^\s*(\/\/|\*|\/\*)/.test(l)) out.push({ line: i + 1, hit: '"Enter" 처리에 isComposingEnter(e) 가드가 없다 — 한글 조합 중 Enter 가 글자를 확정하기 전에 실행된다' }) })
  return out
}

// autocomplete(A44): 글 입력 칸(Input·input·FormField·TextField)마다 autoComplete(값 "off" 도 명시)가 있어야 한다 — 브라우저·비밀번호 관리자 자동 채움이 되돌아가는 것을 막는다.
// 라디오·체크박스·읽기 전용 칸·여러 줄 칸은 건너뛴다. 이메일 칸(type="email")은 autoCapitalize·spellCheck 도 있어야 한다(대문자로 시작하는 이메일·빨간 밑줄 방지).
// 종류를 식으로 받는 <Input type={type}> 도 autoCapitalize·spellCheck 를 같이 다룬다. 칸 밖 이유는 태그 안에 /* autocomplete: 이유 */ 를 단다.
const NO_AUTOFILL_TYPE = /^(?:radio|checkbox|hidden|submit|button|reset|file|range|image|color)$/
export function autocompleteProblems(source) {
  const out = []
  for (const t of tagsNamed(source, /<(Input|InputGroupInput|input)\b/g)) {
    if (/\sreadOnly\b/.test(t.text)) continue
    const lit = t.text.match(/\stype="([^"]*)"/)?.[1]
    if (lit && NO_AUTOFILL_TYPE.test(lit)) continue
    const line = lineOf(source, t.index)
    if (!/\sautoComplete=|autocomplete:/.test(t.text)) out.push({ line, hit: `<${t.name}> 에 autoComplete 가 없다 — 값(예: "email"·"off")을 명시한다` })
    const emailish = lit === 'email' || /\stype=\{/.test(t.text)
    if (emailish && !(/\sautoCapitalize=/.test(t.text) && /\sspellCheck=/.test(t.text))) out.push({ line, hit: `<${t.name}> 이메일 칸에 autoCapitalize="off"·spellCheck={false} 가 없다(종류를 식으로 받으면 식으로 정한다)` })
  }
  for (const t of tagsNamed(source, /<(FormField|TextField)\b/g)) {
    if (/\smultiline\b/.test(t.text)) continue
    if (!/\sautoComplete=|autocomplete:/.test(t.text)) out.push({ line: lineOf(source, t.index), hit: `<${t.name}> 에 autoComplete 가 없다 — 값(예: "email"·"off")을 명시한다` })
  }
  return out
}

const tsxUnder = (dir, skip = new Set()) => (existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? (skip.has(d.name) ? [] : tsxUnder(join(dir, d.name), skip)) : d.name.endsWith('.tsx') ? [join(dir, d.name)] : [])).sort() : [])

// 블록 원천 폴더(registry/factory/blocks). 컴파일본 폴더(_compiled)는 따로 본다.
export function lintBlocksSrc(blocksDir, { motionCoveredGlobally = false } = {}) {
  const fails = [], warns = []
  const files = tsxUnder(blocksDir, new Set(['_compiled']))
  for (const p of files) {
    const rel = p.slice(blocksDir.length + 1).split('\\').join('/')
    const source = readFileSync(p, 'utf8')
    for (const h of shapeOutsideHooks(source)) fails.push({ rule: 'shape-outside-hook', at: `${rel}:${h.where.split(':')[0]}`, hit: h.cls })
    for (const d of duplicateHooks(source)) fails.push({ rule: 'duplicate-hook', at: `${rel}:${d.where.split(':')[0]}`, hit: d.name })
    for (const x of iconLabelProblems(source)) fails.push({ rule: 'icon-label', at: `${rel}:${x.line}`, hit: `${x.hit} 에 aria-label·sr-only 이름이 없다` })
    for (const x of fixedDurationProblems(source)) fails.push({ rule: 'fixed-duration', at: `${rel}:${x.line}`, hit: `${x.hit} — 모션 토큰(--duration-hover·popover·sheet)으로` })
    for (const x of disabledFocusProblems(source)) fails.push({ rule: 'disabled-focus', at: `${rel}:${x.line}`, hit: x.hit })
    for (const x of imeEnterProblems(source)) fails.push({ rule: 'ime-enter', at: `${rel}:${x.line}`, hit: x.hit })
    for (const x of autocompleteProblems(source)) fails.push({ rule: 'autocomplete', at: `${rel}:${x.line}`, hit: x.hit })
    const r = lintSource(rel, source, { motionCoveredGlobally })
    fails.push(...r.fails); warns.push(...r.warns)
    const fx = p.replace(/\.tsx$/, '.fixture.ts')
    warns.push(...numericCellWarnings(rel, source, fixtureTextWithImports(fx)))
  }
  return { files: files.length, fails, warns }
}

// 블록 컴파일본 폴더(blocks/_compiled — 생성물): 표지 GENERATED.md, 손으로 고치지 말라는 머리줄 없음, 바닥 규칙.
export function lintBlocksCompiled(dir, { motionCoveredGlobally = false } = {}) {
  const fails = [], warns = []
  if (!existsSync(join(dir, MARKER))) fails.push({ rule: 'generated-marker', at: join(dir, MARKER), hit: 'missing' })
  const files = tsxUnder(dir)
  for (const p of files) {
    const r = lintSource(p.slice(dir.length + 1).split('\\').join('/'), readFileSync(p, 'utf8'), { motionCoveredGlobally, generated: true })
    fails.push(...r.fails); warns.push(...r.warns)
  }
  return { files: files.length, fails, warns }
}

// 레시피 사본 폴더(.tmp/blocks/<id>): 바닥 규칙 + 색 논리 K7 이면 그라디언트 금지.
// ownHeroes: 이 레시피 머리의 hero·alternates.hero(카탈로그 변형 이름). 주면 hero/ 의 다른 변형(다른 레시피의 히어로)은 K7 그라디언트 검사에서 뺀다(A9).
export function lintBlocksCopy(dir, { colorLogic, motionCoveredGlobally = false, ownHeroes } = {}) {
  const fails = [], warns = []
  const files = tsxUnder(dir)
  for (const p of files) {
    const rel = p.slice(dir.length + 1).split('\\').join('/')
    const source = readFileSync(p, 'utf8')
    const r = lintSource(rel, source, { motionCoveredGlobally })
    fails.push(...r.fails); warns.push(...r.warns)
    const foreignHero = ownHeroes && rel.startsWith('hero/') && !ownHeroes.includes(rel.slice('hero/'.length).replace(/\.tsx$/, ''))
    if (colorLogic === 'K7' && !foreignHero) fails.push(...gradientFails(rel, source))
  }
  return { files: files.length, fails, warns }
}

// CLI: lint-ui --blocks-recipe <id> — .tmp/blocks/<id>(npm run qa:blocks 가 만든다)를 본다. 레시피 색 논리는 원천 DESIGN.md 에서 읽는다.
async function runBlocksRecipe(id) {
  const { parseRecipe } = await import('../scripts/recipe.mjs')
  const design = join(root, 'registry', 'factory', 'recipes', id, 'DESIGN.md')
  if (!existsSync(design)) { console.error(`lint-ui: 레시피 ${id} 원천이 없다(${design})`); return 2 }
  const head = parseRecipe(readFileSync(design, 'utf8'))
  const { colorLogic } = head
  const ownHeroes = [head.hero, head.alternates?.hero].filter(Boolean)
  const r = lintBlocksCopy(join(root, '.tmp', 'blocks', id), { colorLogic, motionCoveredGlobally: true, ownHeroes })
  for (const f of r.fails) console.error(`FAIL ${f.rule} ${f.at} ${f.hit}`)
  console.log(`lint-ui: blocks-recipe ${id}(${colorLogic}) ${r.files} files, ${r.fails.length} fail`)
  if (!r.files) { console.error('lint-ui: 검사한 파일이 0개입니다 — npm run qa:blocks 를 먼저 돌린다'); return 1 }
  return r.fails.length ? 1 : 0
}

// 블록 훅 값(base.css)과 블록 원천의 토큰 규칙 + base.css 의 고정 전환 길이(P3-2 Task 1c — 리뷰 I-4·I-8).
export function lintBlocksTokens(blocksDir, baseCssPath) {
  const css = readFileSync(baseCssPath, 'utf8')
  const sources = tsxUnder(blocksDir, new Set(['_compiled'])).map((p) => ({ rel: p.slice(blocksDir.length + 1).split('\\').join('/'), source: readFileSync(p, 'utf8') }))
  const fails = blockTokenProblems(css, sources)
  css.split('\n').forEach((l, i) => { const ts = tokens(l); if (ts.some((t) => /(^|:)outline-none$/.test(t)) && ts.some((t) => isFocusVariant(t) && /(^|:)ring-/.test(t))) fails.push({ rule: 'forced-colors-focus', at: `styles/base.css:${i + 1}`, hit: 'outline-none + focus ring — outline-hidden 으로(고대비 모드에서 포커스 윤곽이 남는다)' }) })
  for (const x of fixedDurationProblems(css)) fails.push({ rule: 'fixed-duration', at: `styles/base.css:${x.line}`, hit: `${x.hit} — 모션 토큰(--duration-hover·popover·sheet)으로` })
  return { hooks: blockHookValues(css).length, fails }
}

// 인자 없이 돌릴 때 블록 층 전체(원천 + 컴파일본 + 블록 훅 토큰). 블록 폴더가 없으면 건너뛴다(0개).
function runBlocksDefault(covered) {
  const blocksDir = join(root, 'registry', 'factory', 'blocks')
  if (!existsSync(blocksDir)) return { files: 0, fails: [], warns: [] }
  const src = lintBlocksSrc(blocksDir, { motionCoveredGlobally: covered })
  const tok = lintBlocksTokens(blocksDir, join(root, 'registry', 'factory', 'styles', 'base.css'))
  src.fails.push(...tok.fails)
  console.log(`lint-ui: block hooks ${tok.hooks}, ${tok.fails.length} block-token/fixed-duration fail`)
  const out = lintBlocksCompiled(join(blocksDir, '_compiled'), { motionCoveredGlobally: covered })
  // numeric-cell 경고는 여기서 제 문구로 찍는다(아래 공통 경고 줄은 animate-* 경고 문구다).
  const numeric = src.warns.filter((w) => w.rule === 'numeric-cell')
  for (const w of numeric) console.warn(`WARN ${w.rule} blocks/${w.at} ${w.hit}`)
  console.log(`lint-ui: blocks src ${src.files} files, ${src.fails.length} fail, ${numeric.length} numeric-cell warn · compiled ${out.files} files, ${out.fails.length} fail`)
  return { files: src.files + out.files, fails: [...src.fails, ...out.fails], warns: [...src.warns.filter((w) => w.rule !== 'numeric-cell'), ...out.warns] }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const args = process.argv.slice(2)
  const bi = args.indexOf('--blocks-recipe')
  if (bi !== -1) {
    if (!args[bi + 1] || args[bi + 1].startsWith('--') || args.length !== 2) { console.error('사용: lint-ui.mjs --blocks-recipe <레시피 id>'); process.exit(2) }
    process.exit(await runBlocksRecipe(args[bi + 1]))
  }
  const at = args.indexOf('--src')
  if (at !== -1 && (!args[at + 1] || args[at + 1].startsWith('--'))) { console.error('사용: lint-ui.mjs [생성물 폴더] [--src <원천 폴더>]'); process.exit(2) }
  const srcArg = at === -1 ? undefined : args[at + 1]
  const outArg = args.filter((a, i) => at === -1 || (i !== at && i !== at + 1))[0]
  const none = !outArg && !srcArg
  const dir = outArg ?? (none ? join(root, 'registry', 'factory', 'ui') : undefined)
  const srcDir = srcArg ?? (none ? join(root, 'registry', 'factory', 'ui-src') : undefined)
  const basePath = join(root, 'registry', 'factory', 'base', 'factory-base.css')
  const covered = existsSync(basePath) && motionCovered(readFileSync(basePath, 'utf8'))
  const { files, fails, warns } = dir ? lintDir(dir, { motionCoveredGlobally: covered, generated: true }) : { files: 0, fails: [], warns: [] }
  if (none) for (const d of recipeUiDirs(join(root, 'registry', 'factory'))) {
    const r = lintDir(d, { motionCoveredGlobally: covered, generated: true })
    if (!r.files) fails.push({ rule: 'generated-marker', at: d, hit: '부품 0개' })
    fails.push(...r.fails); warns.push(...r.warns)
    console.log(`lint-ui: ${d.slice(root.length + 1).split('\\').join('/')} ${r.files} files, ${r.fails.length} fail`)
  }
  if (none) { const r = runBlocksDefault(covered); fails.push(...r.fails); warns.push(...r.warns) }
  let srcFiles = 0
  if (srcDir) {
    const src = lintSrcDir(srcDir)
    srcFiles = src.files
    fails.push(...src.fails)
    console.log(`lint-ui: src ${src.files} files, ${src.fails.filter((f) => f.rule === 'shape-outside-hook').length} shape-outside-hook, ${src.fails.filter((f) => f.rule === 'duplicate-hook').length} duplicate-hook, ${src.fails.filter((f) => f.rule === 'icon-label').length} icon-label`)
  }
  for (const f of fails) console.error(`FAIL ${f.rule} ${f.at} ${f.hit}`)
  for (const w of warns) console.warn(`WARN ${w.rule} ${w.at} animate-* without motion-reduce`)
  console.log(`lint-ui: ${files} files, ${fails.length} fail, ${warns.length} warn${covered ? ' (reduced motion covered globally by factory-base)' : ''}`)
  if ((dir && files === 0) || (srcDir && srcFiles === 0)) { console.error('lint-ui: 검사한 파일이 0개입니다'); process.exit(1) }
  process.exit(fails.length ? 1 : 0)
}
