// Task 11 모션 키트(motion-gsap) — 순수 부분(강도 배율·토큰 읽기·정지 갈래 고르기·포인터 수식)과 레지스트리 항목, 묶음 1 히어로가 CSS 등장에서 GSAP 로
// 옮겨졌는지. 실행: node --test --test-force-exit --test-timeout=60000 "factory/scripts/*.test.mjs"
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { runInNewContext } from 'node:vm'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'
import { motionItems, MOTION_DIR, MOTION_TOKENS, MOTION_GSAP_FILES } from './gen-kits.mjs'
import { DYNAMICS_IDS, HERO_IDS } from './recipe.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = join(root, '.tmp', 'motion-gsap-test')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))

async function loadScale() {
  mkdirSync(OUT, { recursive: true })
  const { outputText } = ts.transpileModule(readFileSync(join(MOTION_DIR, 'motion-scale.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } })
  const out = join(OUT, `motion-scale-${Date.now()}.mjs`)
  writeFileSync(out, outputText)
  return import(pathToFileURL(out).href)
}

test('M-level scaling: distance, stagger and depth grow M0 < M1 < M2 < M3; idle loops only at M2–M3; unknown levels fall back to M2', async () => {
  const m = await loadScale()
  const L = m.MOTION_LEVELS
  assert.deepEqual(L, ['M0', 'M1', 'M2', 'M3'])
  for (const k of ['distance', 'stagger', 'depth', 'rotate', 'scrub']) for (let i = 1; i < L.length; i++) assert.ok(m.LEVEL_SCALE[L[i]][k] > m.LEVEL_SCALE[L[i - 1]][k], `${k} ${L[i - 1]} < ${L[i]}`)
  assert.deepEqual(L.map((l) => m.LEVEL_SCALE[l].loop), [false, false, true, true])
  assert.equal(m.LEVEL_SCALE.M0.distance, 0)
  assert.deepEqual(m.scaleFor('M9'), m.LEVEL_SCALE.M2)
  assert.deepEqual(m.scaleFor(undefined), m.LEVEL_SCALE.M2)
  assert.deepEqual(m.scaleFor('M3'), m.LEVEL_SCALE.M3)
  assert.ok(m.isLevel('M1') && !m.isLevel('m1') && !m.isLevel(1))
})

test('reduced-motion branch selection: reduce → static at every level, M0 → static, otherwise motion', async () => {
  const m = await loadScale()
  for (const l of m.MOTION_LEVELS) assert.equal(m.sceneBranch(true, l), 'static', `reduce ${l}`)
  assert.equal(m.sceneBranch(false, 'M0'), 'static')
  for (const l of ['M1', 'M2', 'M3']) assert.equal(m.sceneBranch(false, l), 'motion', l)
})

test('token parsing: durations in ms/s → seconds, cubic-bezier → CustomEase args, anything else → null', async () => {
  const m = await loadScale()
  assert.equal(m.parseDuration('300ms'), 0.3)
  assert.equal(m.parseDuration(' 0.5s '), 0.5)
  assert.equal(m.parseDuration('700'), 0.7)
  for (const bad of ['', null, undefined, 'fast', 'calc(1s)']) assert.equal(m.parseDuration(bad), null, String(bad))
  assert.equal(m.bezierArgs('cubic-bezier(0.23, 1, 0.32, 1)'), '0.23,1,0.32,1')
  assert.equal(m.bezierArgs(' cubic-bezier(0.2,0,0,1) '), '0.2,0,0,1')
  for (const bad of ['ease-out', 'cubic-bezier(1,2,3)', 'cubic-bezier(a,b,c,d)', '']) assert.equal(m.bezierArgs(bad), null, bad)
  // 모든 레시피 곡선 토큰을 읽을 수 있다(읽지 못하면 GSAP 기본 곡선으로 떨어진다).
  for (const [lv, t] of Object.entries(MOTION_TOKENS)) for (const k of ['ease-standard', 'ease-emphasized', 'ease-in-screen']) assert.ok(m.bezierArgs(t[k]), `${lv} ${k}`)
})

test('level from tokens: --duration-enter of every motion level maps back to that level (consumers without a recipe head)', async () => {
  const m = await loadScale()
  for (const [lv, t] of Object.entries(MOTION_TOKENS)) assert.equal(m.levelFromEnter(m.parseDuration(t['duration-enter'])), lv)
  assert.equal(m.levelFromEnter(null), 'M2')
})

test('scroll window: 60% of the viewport, or the document end when it scrolls less — never 0', async () => {
  const m = await loadScale()
  assert.equal(m.scrubEnd(900, 2000), 540)
  assert.equal(m.scrubEnd(900, 205), 205)
  assert.equal(m.scrubEnd(900, 0), 1)
  assert.equal(m.scrubEnd(800, 1000, 0.5), 400)
})

test('pointer maths: tilt is 0 at the centre and ±max at the edges; magnetic pull is clamped and 0 outside the radius', async () => {
  const m = await loadScale()
  const box = { left: 100, top: 100, width: 200, height: 100 }
  assert.deepEqual(m.tiltAngles(200, 150, box, 6), { rx: 0, ry: 0 })
  assert.deepEqual(m.tiltAngles(300, 100, box, 6), { rx: 6, ry: 6 })
  assert.deepEqual(m.tiltAngles(100, 200, box, 6), { rx: -6, ry: -6 })
  assert.deepEqual(m.tiltAngles(-500, 900, box, 6), { rx: -6, ry: -6 }, '상자 밖은 가장자리 값')
  const b = { left: 0, top: 0, width: 100, height: 40 }
  assert.deepEqual(m.magneticOffset(50, 20, b), { x: 0, y: 0 })
  const near = m.magneticOffset(90, 20, b, { strength: 0.3, radius: 120, maxPx: 10 })
  assert.equal(near.x, 10, "40px × 0.3 = 12 → 상한 10")
  assert.equal(near.y, 0)
  assert.deepEqual(m.magneticOffset(900, 20, b), { x: 0, y: 0 }, '반경 밖')
})

test('motion-gsap registry item: five files under components/motion (incl. the SSR boot), gsap pinned to the exact package.json version, depends on motion-core', () => {
  assert.deepEqual(MOTION_GSAP_FILES, ['motion-scale.ts', 'use-gsap-scene.ts', 'gsap-techniques.ts', 'split-source.tsx', 'motion-boot.tsx'])
  assert.match(pkg.dependencies.gsap, /^\d+\.\d+\.\d+$/, 'gsap 은 정확한 버전으로 고정')
  const items = motionItems({ ref: 'v9.9.9', versions: { ...pkg.devDependencies, ...pkg.dependencies } })
  const it = items.find((x) => x.name === 'motion-gsap')
  assert.ok(it)
  assert.equal(it.type, 'registry:lib')
  assert.deepEqual(it.files.map((f) => f.path), MOTION_GSAP_FILES)
  for (const f of it.files) {
    assert.equal(f.target, `@components/motion/${f.path}`)
    assert.ok(existsSync(join(MOTION_DIR, f.path)), f.path)
  }
  assert.deepEqual(it.dependencies, [`gsap@${pkg.dependencies.gsap}`])
  assert.deepEqual(it.registryDependencies, ['nowwcastle-sudo/sitebrew/motion-core#v9.9.9'])
  // 생성물이 원천과 같다(gen:all 뒤).
  const reg = JSON.parse(readFileSync(join(MOTION_DIR, 'registry.json'), 'utf8'))
  assert.ok(reg.items.some((x) => x.name === 'motion-gsap'), 'registry.json 에 motion-gsap')
})

test('technique helpers cover the §8-6 catalogue; the scene hook reverts, pauses loops offscreen and builds nothing in the static branch; svg-draw leaves no dasharray', () => {
  const tech = readFileSync(join(MOTION_DIR, 'gsap-techniques.ts'), 'utf8')
  const hook = readFileSync(join(MOTION_DIR, 'use-gsap-scene.ts'), 'utf8')
  const HELPER = { 'split-text': 'splitReveal', 'clip-reveal': 'clipReveal', 'svg-draw': 'svgDraw', 'oversize-crop': 'oversizeCrop', 'sticky-stack': 'stickyStack', marquee: 'marquee', 'tilt-3d': 'tilt3d', 'magnetic-cta': 'magneticCta', 'variable-axis': 'variableAxis', 'mesh-gradient': 'ambientDrift', grain: 'ambientDrift', 'view-transition': 'viewTransition' }
  for (const [id, fn] of Object.entries(HELPER)) {
    assert.ok(DYNAMICS_IDS.includes(id), `${id} 는 카탈로그 id`)
    assert.match(tech, new RegExp(`export function ${fn}\\(`), `${id} → ${fn}`)
  }
  assert.match(tech, /export function parallax\(/)
  assert.match(tech, /clearProps: "strokeDasharray,strokeDashoffset"/, 'svg-draw 는 끝나면 대시를 지운다')
  assert.match(tech, /aria: "none"/, 'split-text 는 보이는 사본만 쪼갠다(원문은 sr-only)')
  assert.match(hook, /gsap\.matchMedia\(root\)/)
  assert.match(hook, /\(prefers-reduced-motion: reduce\)/)
  assert.match(hook, /if \(branch === "static"\) \{/)
  assert.match(hook, /mm\.revert\(\)/)
  assert.match(hook, /IntersectionObserver/)
  assert.match(hook, /visibilitychange/)
  assert.match(hook, /registerPlugin\(CustomEase, ScrollTrigger, SplitText\)/)
  assert.match(tech, /gsap\.registerPlugin\((CustomEase, )?ScrollTrigger, SplitText\)/, '도우미 파일만 불러도 플러그인이 켜진다(멱등 — P3-5 이름 붙인 곡선 CustomEase 포함)')
})

// Task 11 fix — 장면 훅: 등장 끝 신호, 포인터 종류가 바뀌어도 등장을 다시 돌리지 않음, 나중에 만드는 트윈의 문맥, 늦게 시작한 SSR 장면의 건너뛰기.
test('scene hook (fix): matchMedia watches reduced motion only (plus an always-true condition), signals entered, tracks post-entrance tweens, pointer layers attach and detach on their own', () => {
  const hook = readFileSync(join(MOTION_DIR, 'use-gsap-scene.ts'), 'utf8')
  const tech = readFileSync(join(MOTION_DIR, 'gsap-techniques.ts'), 'utf8')
  // 조건은 동작 줄이기 하나 + 늘 참("all") — 포인터 조건(fine)을 넣으면 마우스 ↔ 터치 전환에 등장 전체가 다시 돈다(b1 M4).
  assert.match(hook, /mm\.add\(\{ all: "all", reduce: REDUCE \}/)
  assert.doesNotMatch(hook, /mm\.add\(\{[^}]*fine/)
  // 포인터 겹: FINE 미디어 change 에서 그 겹의 문맥만 붙였다 뗀다.
  assert.match(hook, /fineMq\.addEventListener\("change", onFine\)/)
  assert.match(hook, /L\.ctx = gsap\.context\(/)
  assert.match(hook, /L\.ctx\?\.revert\(\)/)
  // 등장 끝 신호: data-wf-entered + wf:entered(정지 갈래는 곧바로), 등장 줄 id(관문의 유휴 정지가 알아본다).
  assert.match(hook, /export const ENTERED_EVENT = "wf:entered"/)
  assert.match(hook, /root\.dataset\.wfEntered =/)
  assert.match(hook, /tl\.eventCallback\("onComplete", finish\)/)
  assert.match(hook, /signalEntered\(root, \{ static: true \}\)/)
  assert.match(hook, /id: ENTRANCE_ID/)
  // 나중에 만드는 트윈(커서·유휴·포인터)은 장면 문맥 안(ctx.add) — 되돌릴 때 함께 되돌려진다(b1·b2 대기 항목).
  assert.match(hook, /afterEnter: \(fn: \(\) => void\) => \{ if \(entered\) ctx\.add\(fn\); else whenEntered\.push\(\(\) => ctx\.add\(fn\)\) \}/)
  // SSR: 안전장치가 먼저 드러낸 구획은 등장을 끝 상태로 건너뛰고, 서버 HTML 의 keep 대상은 튀지 않게 끝 상태로 둔다.
  assert.match(hook, /if \(entranceSkipped\(fromServer\.current, document\.documentElement\.dataset\.motion\)\) \{/)
  assert.match(hook, /if \(fromServer\.current\) settleKept\(tl\)/)
  // PERF2: 쪽의 첫 화면 구획([data-wf-first]) 안의 등장 대상도 keep 처럼 끝 상태로 둔다.
  assert.match(hook, /keptFromFirstPaint = \(e: Element\) => \{[\s\S]*?e\.closest\("\[data-wf-first\]"\) !== null[\s\S]*?getAttribute\("data-enter"\) === "keep"[\s\S]*?__wfFold/)
  assert.match(hook, /els\.filter\(keptFromFirstPaint\)/)
  // fix 2 (N2): 드러냄 판정은 요소 목록(안전장치 순간의 스냅숏)이 아니라 속성 상태 — 안전장치 뒤에 늦게 스트리밍된 서버 HTML 도 건너뛴다.
  assert.doesNotMatch(hook, /__wfMotionLate/)
  // fix 2 (N1): 건너뛰면 개발에서만 console.info 한 줄.
  // 한 구획에 한 줄 — 개발의 StrictMode 는 효과를 두 번 돌리므로 뿌리마다 한 번만 적는다(next dev 실측: 없으면 두 줄).
  assert.match(hook, /if \(process\.env\.NODE_ENV !== "production" && !skipLogged\.has\(root\)\) \{\s*skipLogged\.add\(root\)\s*console\.info\(/)
  assert.equal((hook.match(/console\.info\(/g) ?? []).length, 1)
  // 포인터 도우미는 포인터 겹에서 돈다(build 때 finePointer 를 읽어 영영 달지 않거나, 터치에서 남지 않게).
  for (const fn of ['tilt3d', 'pointerDepth', 'magneticCta']) assert.match(tech, new RegExp(`export function ${fn}\\([^]*?onPointer\\(s, \\(ps\\) =>`), fn)
  assert.doesNotMatch(tech, /if \(!s\.finePointer/)
})

// countUp(b2 I1): 세는 동안 끝 값의 폭(tabular-nums)을 최소 폭으로 붙들고, 끝나면 인라인 속성을 모두 지운다.
test('countUp holds the final width while counting (tabular-nums + min-inline-size from the final value) and clears it on complete or revert', () => {
  const tech = readFileSync(join(MOTION_DIR, 'gsap-techniques.ts'), 'utf8')
  const body = tech.slice(tech.indexOf('export function countUp'), tech.indexOf('// ── 스크롤 연동'))
  assert.match(body, /node\.style\.fontVariantNumeric = "tabular-nums"/)
  // fix 2 (N4): 최소 폭은 countUpHold(글자 폭 + border-box 면 안쪽 여백·테두리) — 계산 스타일을 넘긴다.
  assert.match(body, /node\.style\.minInlineSize = `\$\{countUpHold\(natural, tab, getComputedStyle\(node\)\)\}px`/)
  assert.match(body, /node\.textContent = text\s+const natural = inkWidth\(\)/, '끝 글자로 재고 나서 0 을 쓴다')
  assert.match(body, /range\.selectNodeContents\(node\); return range\.getBoundingClientRect\(\)\.width/, '블록 상자 폭이 아니라 글자 폭을 잰다')
  assert.match(body, /document\.fonts\?\.ready\.then\(hold\)/, '서체가 바뀌면 다시 잰다')
  assert.match(body, /onComplete: release/)
  assert.match(body, /s\.onCleanup\(release\)/)
  assert.match(body, /const HOLD = \["min-inline-size", "font-variant-numeric", "display"\]|HOLD\) node\.style\.removeProperty/)
})

// 서버 렌더 첫 칠 가림(motion-boot, b1 I3): 머리 스크립트를 가짜 window·document 에서 돌린다.
function bootSandbox({ reduce = false, readyState = 'loading' } = {}) {
  const attrs = {}
  const timers = []
  const listeners = []
  const html = { hasAttribute: (k) => k in attrs, getAttribute: (k) => attrs[k] ?? null, setAttribute: (k, v) => { attrs[k] = String(v) } }
  const w = { matchMedia: (q) => ({ matches: reduce && /reduce/.test(q) }), setTimeout: (f, ms) => timers.push({ f, ms }) }
  const doc = { documentElement: html, readyState, addEventListener: (type, f) => listeners.push({ type, f }), querySelectorAll: () => [] }
  const sb = { document: doc, window: w, WeakSet }
  return { sb, attrs, timers, listeners, w }
}
// motion-boot.tsx 를 그대로(react import 포함) 옮겨 싣는다 — .tmp 는 저장소 안이라 react 를 찾는다.
async function loadBoot() {
  const src = readFileSync(join(MOTION_DIR, 'motion-boot.tsx'), 'utf8')
  const { outputText } = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } })
  mkdirSync(OUT, { recursive: true })
  const file = join(OUT, `motion-boot-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`)
  writeFileSync(file, outputText)
  return import(pathToFileURL(file).href)
}
test('motion boot (SSR): hides entrance targets only when JS runs and motion is allowed; the failsafe timer starts at DOMContentLoaded and reveals by attribute', async () => {
  const m = await loadBoot()
  assert.equal(m.MOTION_FAILSAFE_MS, 1500)
  assert.equal(m.MOTION_FAILSAFE_DEV_MS, 8000)
  // CSS: 표지(data-motion="on") 아래에서만, 시작한 장면 안·keep·쪽의 첫 화면 구획(data-wf-first — PERF2)은 빼고 숨긴다.
  assert.equal(m.MOTION_GATE_CSS, 'html[data-motion="on"] [data-enter]:not([data-enter="keep"], [data-wf-first] [data-enter], [data-wf-first][data-enter], [data-wf-scene] [data-enter], [data-wf-scene][data-enter]){visibility:hidden}')
  // 동작 줄이기 → 아무것도 하지 않는다(표지 없음, 타이머 없음, DOMContentLoaded 도 듣지 않는다).
  const r = bootSandbox({ reduce: true })
  runInNewContext(m.motionBootScript(1500), r.sb)
  assert.deepEqual(r.attrs, {})
  assert.equal(r.timers.length, 0)
  assert.equal(r.listeners.length, 0)
  // fix 2 (N1): 머리 파싱 중(readyState loading) → 표지 on, 안전장치는 DOMContentLoaded 에서 켠다(느린 본문 내려받기가 예산을 먹지 않게).
  // Task 16(리뷰 14 #7): 머리 파싱 때 절대 상한(failsafeMs + 2.5초) 타이머 하나는 바로 건다 — 스트리밍으로 DOMContentLoaded 가 늦어도 그때 드러난다.
  assert.equal(m.MOTION_FAILSAFE_CAP_EXTRA_MS, 2500)
  const b = bootSandbox()
  runInNewContext(m.motionBootScript(1500), b.sb)
  assert.deepEqual(b.attrs, { 'data-motion': 'on' })
  assert.deepEqual(b.timers.map((t) => t.ms), [4000], '머리 파싱 때는 절대 상한 하나만')
  assert.deepEqual(b.listeners.map((l) => l.type), ['DOMContentLoaded'])
  b.listeners[0].f()
  assert.deepEqual(b.timers.map((t) => t.ms), [4000, 1500])
  b.timers[1].f()
  assert.equal(b.attrs['data-motion'], 'late')
  b.timers[0].f()
  assert.equal(b.attrs['data-motion'], 'late', '늦게 온 쪽은 아무것도 바꾸지 않는다')
  // 절대 상한이 먼저 오면(DOMContentLoaded 가 아직) 그것이 드러낸다.
  const cap = bootSandbox()
  runInNewContext(m.motionBootScript(1500), cap.sb)
  cap.timers[0].f()
  assert.equal(cap.attrs['data-motion'], 'late')
  assert.deepEqual(bootSandbox().timers, [])
  const custom = bootSandbox()
  runInNewContext(m.motionBootScript(8000, 1000), custom.sb)
  assert.deepEqual(custom.timers.map((t) => t.ms), [9000])
  // fix 2 (N2): 요소 목록을 기억하지 않는다 — 늦게 스트리밍된 서버 HTML 은 속성 상태(late)로 판정한다.
  assert.equal(b.w.__wfMotionLate, undefined)
  // 문서가 이미 파싱된 뒤에 돌면(늦게 끼운 스크립트) 곧바로 켠다. 값은 prop 으로 덮는다.
  const done = bootSandbox({ readyState: 'interactive' })
  runInNewContext(m.motionBootScript(3000), done.sb)
  assert.equal(done.listeners.length, 0)
  assert.deepEqual(done.timers.map((t) => t.ms), [5500, 3000])
  // 두 번 돌지 않는다(이미 표지가 있으면).
  const again = bootSandbox()
  again.sb.document.documentElement.setAttribute('data-motion', 'on')
  runInNewContext(m.motionBootScript(1500), again.sb)
  assert.equal(again.timers.length + again.listeners.length, 0)
  // 안전장치가 오기 전에 표지가 바뀌었으면(예: 다른 스크립트가 off) 건드리지 않는다.
  const off = bootSandbox({ readyState: 'complete' })
  runInNewContext(m.motionBootScript(1500), off.sb)
  off.attrs['data-motion'] = 'off'
  for (const t of off.timers) t.f()
  assert.equal(off.attrs['data-motion'], 'off')
})

// fix 2 (N1·N3): 기본 안전장치 길이는 환경으로(운영 1.5초 · 개발 8초 — next dev 는 청크가 커서 5초 안팎에 하이드레이션), prop 이 이긴다.
// nonce 를 받으면 인라인 script·style 둘 다에 단다(엄격 CSP). 서버 렌더 HTML 로 확인한다.
test('motion boot (fix 2): failsafe default by NODE_ENV with a prop override; nonce goes on both inline tags', async () => {
  const m = await loadBoot()
  assert.equal(m.failsafeDefault('production'), 1500)
  assert.equal(m.failsafeDefault('development'), 8000)
  assert.equal(m.failsafeDefault(undefined), 8000)
  const { renderToStaticMarkup } = await import('react-dom/server')
  const React = await import('react')
  const html = (props) => renderToStaticMarkup(React.createElement(m.MotionBoot, props))
  const withNonce = html({ nonce: 'n0nce-abc', failsafeMs: 2500 })
  assert.equal((withNonce.match(/nonce="n0nce-abc"/g) ?? []).length, 2, withNonce)
  assert.match(withNonce, /<style[^>]*nonce="n0nce-abc"[^>]*data-wf-motion-gate|<style[^>]*data-wf-motion-gate[^>]*nonce="n0nce-abc"/)
  assert.match(withNonce, /window,2500,2500\)/, 'prop 이 기본값을 이긴다(절대 상한은 그 위 2.5초)')
  assert.doesNotMatch(html({}), /nonce=/)
  const env = process.env.NODE_ENV
  try {
    process.env.NODE_ENV = 'production'
    assert.match(html({}), /window,1500,2500\)/)
    process.env.NODE_ENV = 'development'
    assert.match(html({}), /window,8000,2500\)/)
  } finally {
    if (env === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = env
  }
  // 브라우저는 로드 뒤 nonce 속성을 비운다 — 하이드레이션 경고가 나지 않게 style 에도 suppressHydrationWarning.
  const src = readFileSync(join(MOTION_DIR, 'motion-boot.tsx'), 'utf8')
  assert.match(src, /<style[^>]*nonce=\{nonce\}[^>]*suppressHydrationWarning|<style[^>]*suppressHydrationWarning[^>]*nonce=\{nonce\}/)
})

// fix 2 (nit): 이 저장소도 문서대로 설치한다 — 루트 레이아웃 <head> 에 MotionBoot, 서버 렌더 검사 페이지는 따로 두지 않는다(설치 그대로를 잰다).
test('MotionBoot is installed as documented: in the root layout <head> under <html suppressHydrationWarning>; the SSR check page adds none of its own', () => {
  const layout = readFileSync(join(root, 'app', 'layout.tsx'), 'utf8')
  assert.match(layout, /<html[^>]*suppressHydrationWarning/)
  assert.match(layout, /<head>\s*<MotionBoot \/>\s*<\/head>\s*<body>/)
  const page = readFileSync(join(root, 'app', 'qa', 'recipes', 'ssr', 'page.tsx'), 'utf8')
  assert.doesNotMatch(page, /<MotionBoot|import \{ MotionBoot/)
})

// fix 2 (N2): 건너뛰기는 「서버 HTML 로 칠해진 구획 + 안전장치가 이미 드러냄(late)」 — 클라이언트에서 처음 붙는 구획은 그대로 움직인다.
test('entrance skip (fix 2): server-rendered scene after the failsafe skips; client mounts and in-time hydration animate', async () => {
  const m = await loadScale()
  assert.equal(m.entranceSkipped(true, 'late'), true)
  assert.equal(m.entranceSkipped(true, 'on'), false)
  assert.equal(m.entranceSkipped(true, undefined), false, '가림이 없는 페이지(MotionBoot 없음)')
  assert.equal(m.entranceSkipped(false, 'late'), false, '클라이언트에서 처음 붙는 구획')
})

// fix 2 (N4): countUp 최소 폭 — border-box(Tailwind preflight)면 min-inline-size 가 안쪽 여백·테두리를 포함하므로 그만큼 더한다.
test('countUp hold (fix 2): border-box adds inline padding and border to the ink width; content-box holds the ink width', async () => {
  const m = await loadScale()
  const box = (boxSizing, pad = '0px', border = '0px') => ({ boxSizing, paddingLeft: pad, paddingRight: pad, borderLeftWidth: border, borderRightWidth: border })
  assert.equal(m.countUpHold(40.001, 42.5, box('content-box', '8px', '1px')), 42.5)
  assert.equal(m.countUpHold(40, 42.5, box('border-box', '8px', '1px')), 60.5)
  assert.equal(m.countUpHold(40.123, 30, box('border-box')), 40.13)
  assert.equal(m.countUpHold(10, 12, box('border-box', '6.5px', '0.5px')), 26)
})

// 히어로마다 첫 칠 전에 숨길 등장 대상을 표시한다(data-enter — motion-boot). 공공 원형(r6)의 누르는 것은 숨기지 않는다(keep, b2 M2).
// P3-2 Task 3: 장면·등장 대상은 히어로 블록 원천(blocks/hero/<id>.tsx)에 있고, 미디어 칸·출처·머리는 검수대 틀(app/qa/recipes/heroes/<id>.tsx)에 남는다.
test('heroes mark their entrance targets for the SSR gate; r6 shortcuts and main CTAs are never hidden (data-enter="keep", transform-only entrance)', () => {
  const dir = join(root, 'registry', 'factory', 'blocks', 'hero')
  const frames = join(root, 'app', 'qa', 'recipes', 'heroes')
  for (const id of HERO_IDS) {
    const src = readFileSync(join(dir, `${id}.tsx`), 'utf8')
    assert.match(src, /data-enter|SplitSource|\benter(=|\s|>)/, `${id}: 등장 대상 표시`)
    assert.doesNotMatch(src, /s\.tl\.call\(\(\) => pointerDepth/, `${id}: 포인터 겹은 afterEnter 로(손으로 kill 하지 않는다)`)
    assert.doesNotMatch(src, /onCleanup\(\(\) => b\.kill\(\)\)/, `${id}: 등장 뒤 트윈은 장면 문맥(afterEnter)`)
  }
  const r6a = readFileSync(join(dir, 'crosshair-quadrants.tsx'), 'utf8')
  const r6b = readFileSync(join(dir, 'identity-strip-banner.tsx'), 'utf8')
  assert.match(r6a, /enter="keep" className="[^"]*\bcq-fav-face\b/)
  assert.match(r6a, /data-enter="keep" className="[^"]*\bcq-ctas\b/)
  assert.doesNotMatch(r6a, /cq-fav-face"\), \{ clipPath/, '서비스 면을 clip-path 로 자르지 않는다')
  assert.doesNotMatch(r6a, /rise\(s, s\.q\("\.cq-(fav-face li|ctas > \*)"\)/, '누르는 것은 autoAlpha(visibility) 등장이 아니다')
  assert.match(r6b, /enter="keep" className="[^"]*\bisb-banner\b/)
  assert.match(r6b, /data-enter="keep" className="isb-cta"/)
  assert.match(r6b, /data-enter="keep" className="[^"]*\bisb-tiles\b/)
  assert.doesNotMatch(r6b, /isb-banner"\), \{ clipPath/, '「발급 신청」을 담은 배너를 자르지 않는다')
  // r9 B 포인터 깊이: 가까운 층이 크다(b2 M4).
  assert.match(readFileSync(join(dir, 'layered-landscape-logotype.tsx'), 'utf8'), /\(i \+ 1\) \* 2\.4/)
  // 한 요소의 transform 을 두 트윈이 함께 쓰지 않는다(b2 M3): 「+」 등장은 안쪽 g, 솔 기울기는 -r 겹.
  assert.match(r6a, /q\("\.cq-plus-in"\), \{ rotation: -90/)
  // Task 12: r8 B 의 그림 층(솔 -r 겹 포함)은 영상·사진 장면 층이 되었다 — 등장은 -e, 스크롤은 -s, 포인터는 -p 로 나뉜다.
  const vts = readFileSync(join(dir, 'vertical-title-slides.tsx'), 'utf8')
  assert.match(vts, /q\("\.vts-media-e"\), \{ scale:/)
  assert.match(vts, /el: q\("\.vts-media-s"\), y:/)
  assert.match(vts, /el: q\("\.vts-media-p"\), x:/)
  // Task 12: 미디어 히어로는 계약 타입(heroes/media.tsx MEDIA — ImageSlot·VideoSlot)으로 받고 출처를 단다. 파일 경로를 구성에 박지 않는다.
  for (const id of ['baseline-split', 'inline-chip-title', 'staggered-oval-frame', 'twin-panels', 'banded-full-bleed', 'grid-lines-baseline-word', 'vertical-title-slides', 'framed-card-outline-title']) {
    const src = readFileSync(join(frames, `${id}.tsx`), 'utf8')
    assert.match(src, /MEDIA\.r\d/, `${id}: MEDIA 칸`)
    assert.match(src, /<MediaCredit items=/, `${id}: 출처`)
    assert.doesNotMatch(src, /\/media\//, `${id}: 경로를 박지 않는다`)
  }
  // r1 A 쉼표가 강조 낱말에 붙는다(b1 I1).
  assert.match(readFileSync(join(dir, 'step-band-orbit.tsx'), 'utf8'), /\{copy\.title\.highlight\}<\/span>\s*\{copy\.title\.after\.match\(\/\^\[\^\\s\]\*\/\)\?\.\[0\]\}\s*<\/span>/)
})

// 묶음 1 히어로 9개(r1 A·B, r2 기본·대안, r3 A·B, r4 A·B, r5 A)와 묶음 2 히어로 10개(r6~r10 A·B)는 등장을 GSAP 장면이 맡는다 — heroes.css 의 그 구성 블록에
// 등장 키프레임이 남지 않는다(상태점 맥박은 세 번만 — 유휴 반복 없음). 두 방식이 겹치면 같은 요소를 CSS 와 GSAP 이 함께 움직인다.
const B1 = ['step-band-orbit', 'baseline-split', 'inline-chip-title', 'cropped-title-list', 'staggered-oval-frame', 'twin-panels', 'stepped-crop-figure', 'centered-proof-panel', 'banded-full-bleed']
const B2 = ['crosshair-quadrants', 'identity-strip-banner', 'leaking-app-panel', 'narrow-title-wide-window', 'grid-lines-baseline-word', 'vertical-title-slides', 'framed-card-outline-title', 'layered-landscape-logotype', 'baseline-news-app-window', 'crop-marks-typed-title']
// 묶음 3: FV1 레인 DRAFTS(2026-10-11) — 확정한 r12~r16 이 카탈로그에 올린 블록 히어로 5개. 블록은 그대로고 레시피 히어로로 쓰이게 됐을 뿐이다.
const B3 = ['map-first', 'illustration-scene', 'punch-in-statement', 'ken-burns-stills', 'video-montage']
test('heroes (batch 1 + 2 + 3): every one builds a GSAP scene, and heroes.css keeps no entrance keyframes for them', () => {
  const css = readFileSync(join(root, 'app', 'qa', 'recipes', 'heroes', 'heroes.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  // 두 묶음이 히어로 전부(HERO_IDS)다 — 새 구성이 생기면 이 목록에 넣어야 한다.
  assert.deepEqual([...B1, ...B2, ...B3].sort(), [...HERO_IDS].sort())
  for (const id of [...B1, ...B2, ...B3]) {
    const src = readFileSync(join(root, 'registry', 'factory', 'blocks', 'hero', `${id}.tsx`), 'utf8')
    assert.match(src, /useHeroScene\((ref|root), techniques, \(s\) =>/, `${id}: 장면 훅`)
    assert.match(src, /<div ref=\{(ref|root)\} id=\{id\} data-block="hero-/, `${id}: 뿌리에 ref`)
    const rules = [...css.matchAll(new RegExp(`\\[data-hero="${id}"\\][^{]*\\{([^}]*)\\}`, 'g'))].map((m) => m[1])
    const anims = rules.filter((r) => /(^|;|\s)animation\s*:/.test(r))
    // 남아도 되는 것: 상태점 맥박 세 번(r1 A), 그레인 씨앗 한 번 바꾸기(hover — 등장 아님, r3 A·B).
    const allowed = anims.filter((r) => /hero-pulse-dot [^;]* 3\s*;/.test(r) || /hero-reseed 160ms steps\(2\) 1/.test(r))
    assert.deepEqual(anims.filter((r) => !allowed.includes(r)), [], `${id}: CSS 등장 애니메이션이 남았다`)
  }
})
