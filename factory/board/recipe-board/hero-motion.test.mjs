// 히어로 모션 관문(hero-motion.mjs, Task 11 §3)의 판정 — 서버·Chrome 없이 돈다.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { runInNewContext } from 'node:vm'
import { judgeTextSizes, judgeLongTasks, judgeReduced, judgeMedia, judgePause, heroMotionJobs, QA_INIT, COLLECT_SIZES, SETTLED, FREEZE_IDLE, PAUSE_CHECK, ENTER_TIMEOUT, TEXT_MIN, LONGTASK_MAX, LOAD_WINDOW } from './hero-motion.mjs'
import { FRAMES, FAINT, COLLECT, COLLECT_WITH } from './hero-contrast.mjs'
import { loadHeads } from './jobs.mjs'

test('min text size: 14px floor, fails name the text, and zero measured texts is a failure', () => {
  assert.equal(TEXT_MIN, 14)
  const ok = judgeTextSizes([{ t: '본문', size: 16 }, { t: '캡션', size: 14 }])
  assert.deepEqual(ok.fails, [])
  assert.equal(ok.smallest, 14)
  // 양성 대조: 13.99px 는 실패다.
  const bad = judgeTextSizes([{ t: '작은 라벨', size: 13.99 }, { t: '본문', size: 16 }])
  assert.equal(bad.fails.length, 1)
  assert.match(bad.fails[0], /「작은 라벨」 13\.99px < 14px/)
  assert.deepEqual(judgeTextSizes([]).fails, ['잰 글자 0개'])
})

test('long tasks: only tasks overlapping the load window [t0, t0+2.5s] are judged (≤ 200ms); the overall max is reported', () => {
  assert.equal(LONGTASK_MAX, 200)
  assert.equal(LOAD_WINDOW, 2500)
  const entries = [{ s: 100, d: 900 }, { s: 1100, d: 120 }, { s: 2000, d: 180 }, { s: 5000, d: 400 }]
  const r = judgeLongTasks(entries, 1000)
  assert.equal(r.maxInLoad, 180)
  assert.equal(r.maxOverall, 900)
  assert.deepEqual(r.fails, [])
  // 등장 구간에 걸친(시작은 앞이지만 t0 뒤까지 이어진) 작업도 센다.
  assert.equal(judgeLongTasks([{ s: 900, d: 300 }], 1000).maxInLoad, 300)
  assert.match(judgeLongTasks([{ s: 1500, d: 260 }], 1000).fails[0], /260ms > 200ms/)
  assert.match(judgeLongTasks([], null).fails[0], /등장 시작 시각/)
})

test('reduced motion: 0 running animations and the static scene branch; a running animation or a motion branch fails', () => {
  assert.deepEqual(judgeReduced({ running: 0, scene: 'static' }).fails, [])
  assert.deepEqual(judgeReduced({ running: 0, scene: null }).fails, [], '모션 키트를 쓰지 않는 구성')
  assert.equal(judgeReduced({ running: 2, scene: 'static' }).fails.length, 1)
  assert.equal(judgeReduced({ running: 0, scene: 'motion' }).fails.length, 1)
})

test('page scripts: QA_INIT exposes the gate flag, records long tasks and pauses GSAP + CSS at t0 + pauseAt; SETTLED waits for the entered signal; mid frames exclude only text that is not yet visible', () => {
  assert.deepEqual(FRAMES, [0.6, 1.2])
  const init = QA_INIT(600)
  assert.match(init, /window\.__WF_QA = \{ pauseAt: 600 \}/)
  assert.match(init, /type: 'longtask', buffered: true/)
  assert.match(init, /globalTimeline\.pause\(\)/)
  assert.match(init, /for \(const a of document\.getAnimations\(\)\) a\.pause\(\)/)
  assert.match(init, /Number\(r\.dataset\.wfT0\) \+ 600/)
  assert.doesNotMatch(QA_INIT(null), /globalTimeline/)
  assert.match(COLLECT_SIZES, /closest\('\.sr-only'\)/)
  // 등장 끝: 고정 3.2초가 아니라 모션 키트의 등장 끝 신호(data-wf-entered)를 한도(10초)까지 기다린다.
  assert.doesNotMatch(SETTLED, /3200/)
  assert.match(SETTLED, /hasAttribute\('data-wf-entered'\)/)
  assert.equal(ENTER_TIMEOUT, 10000)
  assert.match(SETTLED, /> 10000\) \{ stuck = true/)
  // 끝 화면은 이전 그대로(불투명도 < 0.99 는 뺀다, clip-path 는 보지 않는다), 중간 프레임은 불투명도 < 0.1 만 빼고 clip-path 는 모양으로 자른다.
  assert.equal(FAINT, 0.1)
  assert.match(COLLECT, /if \(false \? op < 0\.1 : op < 0\.99\)/)
  assert.match(COLLECT, /if \(false\) for \(let a = el/, '끝 화면은 clip-path 를 보지 않는다')
  const mid = COLLECT_WITH({ midFrame: true })
  assert.match(mid, /if \(true \? op < 0\.1 : op < 0\.99\)/)
  assert.match(mid, /if \(true\) for \(let a = el/)
  assert.doesNotMatch(mid, /cut = true; break/, 'clip-path 조상이 있다고 통째로 빼지 않는다')
})

// 중간 프레임 글자 모으기를 가짜 DOM 에서 돌린다(Task 11 fix b1 M1 — 덜 빼기): 반쯤 떠오른 글자(0.5)는 섞어 재고, 0.05 는 빼고,
// 다 열린 clip-path(inset 0%) 아래 글자는 재고, 다 닫힌 clip-path(inset 0 100% 0 0) 아래 글자만 뺀다. 끝 화면은 0.5 도 뺀다(이전 그대로).
function fakePage(items) {
  const body = { tag: 'body' }
  const root = { tag: 'root', parentElement: body, style: {} }
  const els = items.map((it) => {
    const holder = it.clip ? { tag: 'clip', parentElement: root, style: { clipPath: it.clip }, rect: { left: 0, top: 0, right: 200, bottom: 40, width: 200, height: 40 } } : root
    return { ...it, el: { tag: 'p', parentElement: holder, style: { opacity: String(it.op ?? 1) }, closest: () => null } }
  })
  const styleOf = (e) => ({ opacity: e.style?.opacity ?? '1', clipPath: e.style?.clipPath ?? 'none', visibility: 'visible', color: 'rgb(0, 0, 0)', fontSize: '16px', fontWeight: '400', overflowX: 'visible', overflowY: 'visible', webkitTextStrokeColor: 'rgb(0, 0, 0)' })
  let i = -1
  const nodes = els.map((x) => ({ textContent: x.t, parentElement: x.el }))
  const ctx2d = { clearRect() {}, fillRect() {}, set fillStyle(v) {}, getImageData: () => ({ data: [0, 0, 0, 255] }) }
  return {
    innerWidth: 1440, innerHeight: 900, NodeFilter: { SHOW_TEXT: 4 }, Math, String, parseFloat, Number,
    window: {},
    getComputedStyle: styleOf,
    document: {
      body,
      querySelector: () => root,
      createElement: () => ({ getContext: () => ctx2d }),
      createTreeWalker: () => ({ nextNode: () => nodes[++i] ?? null }),
      createRange: () => ({ selectNodeContents() {}, getClientRects: () => [{ left: 10, top: 10, right: 110, bottom: 30 }] }),
    },
    _root: root,
    _set: (sb) => { for (const x of els) if (x.el.parentElement.rect) { const r = x.el.parentElement.rect; x.el.parentElement.getBoundingClientRect = () => r } root.getBoundingClientRect = () => ({ left: 0, top: 0, right: 1440, bottom: 900, width: 1440, height: 900 }); body.getBoundingClientRect = root.getBoundingClientRect; return sb },
  }
}
test('mid-frame contrast collection: measures half-faded and partly clipped text (blended), skips only faint (< 0.1) or fully clipped text', () => {
  const items = [{ t: '반쯤', op: 0.5 }, { t: '희미', op: 0.05 }, { t: '열림', clip: 'inset(0% 0% 0% 0%)' }, { t: '닫힘', clip: 'inset(0% 100% 0% 0%)' }, { t: '반열림', clip: 'inset(0% 50% 0% 0%)' }]
  const J = (x) => JSON.parse(JSON.stringify(x))
  const run = (src) => { const sb = fakePage(items); sb._set(sb); sb.document.body = sb._root.parentElement; const n = runInNewContext(src, sb); return { n, px: J(sb.window.__heroPx), skip: J(sb.window.__heroSkip) } }
  const mid = run(COLLECT_WITH({ midFrame: true }))
  assert.deepEqual(mid.px.map((b) => b.t), ['반쯤', '열림', '반열림'])
  assert.equal(mid.px.find((b) => b.t === '반쯤').op, 0.5, '반쯤 떠오른 글자는 불투명도를 실어 섞은 색으로 잰다')
  assert.equal(mid.px.find((b) => b.t === '반열림').w, 90, '반만 열린 clip 은 보이는 부분(오른쪽 끝 100px)까지만 잰다')
  assert.deepEqual(mid.skip, { faint: 1, clipped: 1 })
  const end = run(COLLECT)
  assert.deepEqual(end.px.map((b) => b.t), ['열림', '닫힘', '반열림'], '끝 화면은 이전 그대로 — 불투명도 < 0.99 만 빼고 clip-path 는 보지 않는다')
})

// 최소 글자 모으기를 가짜 DOM 에서 돌린다(Task 11 fix b1 M5): SVG <text> 는 화면 변환 배율을 곱한 크기로 잰다 — 14px 글자가 0.9 배로 그려지면 12.6px(실패).
test('min text size: SVG <text> is measured at its rendered size (font-size × screen CTM scale), HTML text at its computed size', () => {
  const mk = (t, parent) => ({ textContent: t, parentElement: parent })
  const html = { closest: () => null, style: {} }
  const svgText = { closest: (s) => (s === 'svg' || s === 'text' ? {} : null), getScreenCTM: () => ({ a: 0.9, b: 0, c: 0, d: 0.9 }), style: {} }
  const svgLabel = { closest: (s) => (s === 'svg' ? {} : null), style: {} }
  const nodes = [mk('본문', html), mk('배지 글자', svgText), mk('그림 안 이름표', svgLabel)]
  for (const n of nodes) n.parentElement.parentElement = null
  let i = -1
  const sb = {
    NodeFilter: { SHOW_TEXT: 4 }, Math, parseFloat, Number,
    getComputedStyle: (e) => ({ visibility: 'visible', display: 'inline', opacity: '1', fontSize: e === html ? '16px' : '14px' }),
    document: { querySelector: () => ({}), createTreeWalker: () => ({ nextNode: () => nodes[++i] ?? null }), createRange: () => ({ selectNodeContents() {}, getClientRects: () => [{ width: 20, height: 12 }] }) },
  }
  const list = JSON.parse(JSON.stringify(runInNewContext(COLLECT_SIZES, sb)))
  assert.deepEqual(list, [{ t: '본문', size: 16 }, { t: '배지 글자', size: 12.6, svg: true }], 'SVG 안 <text> 밖의 글자 조각(foreignObject 등)은 세지 않는다')
  const j = judgeTextSizes(list)
  assert.equal(j.fails.length, 1)
  assert.match(j.fails[0], /「배지 글자」 12\.6px < 14px/)
  assert.deepEqual(j.svgSizes, [12.6])
})

// 유휴 멈춤 판정(Task 11 fix b1 M6) — 숨은 탭·화면 밖에서 도는 반복이 남으면 실패, 표지가 없어도 실패, 돌아와서 다시 안 돌면 실패.
test('idle pause judge: loops must all pause (with the data-wf-paused mark) when the tab hides or the hero leaves the screen, and resume after', () => {
  const ok = { scene: 'motion', loops: 2, before: 2, hidden: 0, hiddenMark: true, shown: 2, shownMark: false, offscreen: 0, offscreenMark: true, back: 2, backMark: false }
  assert.deepEqual(judgePause(ok).fails, [])
  assert.deepEqual(judgePause({ ...ok, loops: 0, before: 0, shown: 0, back: 0 }).fails, [], 'M1(반복 없음)도 표지만 맞으면 통과')
  assert.match(judgePause({ ...ok, hidden: 1 }).fails[0], /숨은 탭에서 도는 유휴 반복 1\/2/)
  assert.match(judgePause({ ...ok, offscreenMark: false }).fails[0], /화면 밖에서 data-wf-paused 가 없다/)
  assert.match(judgePause({ ...ok, back: 1 }).fails[0], /화면에 돌아와도 반복 1\/2/)
  assert.deepEqual(judgePause({ scene: 'static' }).fails, [])
  assert.deepEqual(judgePause({ scene: null }).fails, [])
  assert.match(PAUSE_CHECK, /visibilityState/)
  assert.match(PAUSE_CHECK, /dispatchEvent\(new Event\('visibilitychange'\)\)/)
})

// 유채 픽셀 촬영 전 멈춤(Task 11 묶음 2 · fix): 페이지 스크립트를 가짜 gsap·getAnimations 로 돌린다 — 반복은 0에 멈추고, 끝나지 않은 것은
// totalProgress(전체 회차)로 끝내고 이름을 남긴다, 스크롤 연동은 그대로 둔다(스크롤 0 = 시작 값). CSS 무한 반복은 0에서 멈추고 유한 애니메이션은 끝낸다.
// 유한 반복(repeat 5·yoyo — r10 B 커서, 2회차 중간 totalProgress 0.3): 한 회차 progress 로는 끝나지 않으므로 totalProgress(1) 이 불려야 한다(b2 I2).
// 등장 줄(id wf-enter)이 남아 있으면 stuckEntrance 로 센다(b2 M1).
test('FREEZE_IDLE: idle loops pause at their first phase; finite tweens (incl. repeat 5 yoyo) finish via totalProgress and are logged; a stuck entrance is flagged; scrub tweens are left alone', async () => {
  const log = []
  const tw = (name, { repeat = 0, total = 1, tp = 1, id, scrollTrigger, target, paused = false } = {}) => ({ scrollTrigger, vars: id ? { id } : {}, paused: () => paused, targets: () => (target ? [target] : [{}]), repeat: () => repeat, totalDuration: () => total, totalProgress: (v) => { if (v === undefined) return tp; log.push(`${name}.totalProgress(${v})`) }, progress: (v) => { if (v === undefined) return tp; log.push(`${name}.progress(${v})`) }, pause: (v) => log.push(`${name}.pause(${v})`) })
  const caretEl = { nodeType: 1, tagName: 'SPAN', getAttribute: () => 'ct-caret ms-1 inline-block' }
  const children = [tw('loop', { repeat: -1, total: 1e10 }), tw('entrance', { tp: 0.7, id: 'wf-enter' }), tw('done'), tw('scrub', { tp: 0.3, scrollTrigger: {} }), tw('nested-loop', { total: 1e12 }), tw('caret', { repeat: 5, total: 6, tp: 0.3, target: caretEl }), tw('quickTo', { tp: 0, paused: true }), tw('stuck-paused-entrance', { tp: 0.4, id: 'wf-enter', paused: true })]
  const anim = (name, iterations, playState = 'running') => ({ effect: { getComputedTiming: () => ({ iterations }) }, playState, pause: () => log.push(`${name}.pause`), finish: () => log.push(`${name}.finish`), set currentTime(v) { log.push(`${name}.currentTime=${v}`) } })
  const sandbox = {
    window: { __wfGsap: { globalTimeline: { getChildren: (nested, tweens, timelines) => (assert.deepEqual([nested, tweens, timelines], [false, true, true]), children) } } },
    document: { getAnimations: () => [anim('css-loop', Infinity), anim('css-enter', 1), anim('css-done', 1, 'finished')], querySelectorAll: (sel) => (assert.equal(sel, '[data-hero] video'), videos) },
    requestAnimationFrame: (f) => setTimeout(f, 0),
    setTimeout,
  }
  // 영상(Task 12): 재생 중인 것은 멈추고 0초로 되감는다(seeked 를 기다린다), 이미 0초인 것은 멈추기만 한다.
  const video = (name, t) => { const ls = {}; return { get currentTime() { return t }, set currentTime(v) { t = v; log.push(`${name}.currentTime=${v}`); setTimeout(() => ls.seeked?.(), 0) }, pause: () => log.push(`${name}.pause`), addEventListener: (ev, fn) => { ls[ev] = fn } } }
  const videos = [video('v-playing', 3.2), video('v-start', 0)]
  const out = await runInNewContext(FREEZE_IDLE, sandbox)
  assert.deepEqual(JSON.parse(JSON.stringify(out)), {
    gsap: true, finished: 3, paused: 2, idle: 1, cssFinished: 1, cssPaused: 1, stuckEntrance: 2, videos: 2,
    forced: [{ name: 'wf-enter', totalProgress: 0.7, repeat: 0, entrance: true }, { name: 'span.ct-caret.ms-1', totalProgress: 0.3, repeat: 5, entrance: false }, { name: 'wf-enter', totalProgress: 0.4, repeat: 0, entrance: true }],
  })
  assert.deepEqual(log, ['loop.pause(0)', 'entrance.totalProgress(1)', 'nested-loop.pause(0)', 'caret.totalProgress(1)', 'stuck-paused-entrance.totalProgress(1)', 'css-loop.pause', 'css-loop.currentTime=0', 'css-enter.finish', 'v-playing.pause', 'v-playing.currentTime=0', 'v-start.pause'])
  assert.ok(!log.some((l) => /\.progress\(/.test(l)), '한 회차 progress 로 끝내지 않는다')
  assert.ok(!log.some((l) => l.startsWith('quickTo.')), '멈춰 쉬는 포인터 quickTo 는 건드리지 않는다(idle 로만 센다) — 멈춘 등장 줄은 멈춰 있어도 끝내고 경고한다')
})

// 미디어 판정(Task 12): 사진·영상이 일으킨 레이아웃 이동은 실패, 히어로 안 LCP 그림은 eager + srcset·sizes(양성 대조 포함). 동작 줄이기에서 도는 영상은 실패.
test('judgeMedia / judgeReduced: media layout shifts fail, a lazy or srcset-less hero LCP image fails, a playing video under reduced motion fails', () => {
  assert.deepEqual(judgeMedia({ shifts: [], lcp: { tag: 'img', inHero: true, loading: 'eager', srcset: true, sizes: '100vw' } }).fails, [])
  assert.deepEqual(judgeMedia({ shifts: [], lcp: { tag: 'h1', inHero: true } }).fails, [])
  assert.equal(judgeMedia({ shifts: [{ v: 0.12, tag: 'img' }] }).fails.length, 1)
  assert.equal(judgeMedia({ lcp: { tag: 'img', inHero: true, loading: 'lazy', srcset: true, sizes: '1px' } }).fails.length, 1)
  assert.equal(judgeMedia({ lcp: { tag: 'img', inHero: true, loading: null, srcset: false, sizes: null } }).fails.length, 1)
  assert.deepEqual(judgeReduced({ running: 0, scene: 'static', videos: 0 }).fails, [])
  assert.equal(judgeReduced({ running: 0, scene: 'static', videos: 1 }).fails.length, 1)
  assert.deepEqual(judgeReduced({ running: 0, scene: 'static' }).fails, [])
})

test('jobs: every recipe gets A and, when it has alternates, B — in its default theme', () => {
  const heads = loadHeads()
  const jobs = heroMotionJobs(heads)
  assert.equal(jobs.length, heads.reduce((n, h) => n + (h.alternates ? 2 : 1), 0))
  for (const j of jobs) {
    const h = heads.find((x) => x.id === j.recipe)
    assert.ok(j.query.startsWith(`&theme=${h.defaultTheme === 'dark' ? 'dark' : 'light'}`))
    assert.equal(j.query.endsWith('&alt=B'), j.option === 'B')
  }
})
