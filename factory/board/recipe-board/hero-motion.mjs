// 히어로 모션 관문(Task 11 §3): node factory/board/recipe-board/hero-motion.mjs [origin=http://localhost:3000] [--only <id,id>]
// 히어로(scene=hero)마다 — 레시피 A · B(있으면), 기본 테마:
//   ① 최소 글자 크기: 1440×900 · 375×812 의 등장 끝 화면에서 [data-hero] 안에 보이는 글자(sr-only·투명 제외)가 14px 미만이면 실패 —
//      HTML 은 계산 크기, SVG <text> 는 화면에 그려진 크기(Task 11 fix). 등장 끝은 모션 키트의 등장 끝 신호(data-wf-entered)로 안다(10초 안에 없으면 실패).
//   ② 동작 줄이기: prefers-reduced-motion: reduce 로 연 1440 첫 화면 1.5초 뒤 실행 중 CSS 애니메이션 0개 + GSAP 장면이면 정지 갈래(data-wf-scene="static").
//   ③ 긴 작업: 1440 보통 모션으로 열어 등장 구간(장면 시작 t0 ~ t0+2.5초 — 모션 키트를 쓰지 않는 구성은 히어로가 DOM 에 붙은 시각부터)에
//      겹친 longtask 최대 길이 ≤ 200ms(PerformanceObserver, buffered).
//      전체 최대(하이드레이션 포함)도 보고한다 — 판정은 등장 구간만.
//   ⑤ 미디어(Task 12): 동작 줄이기에서 재생 중인 영상 0(②에 합친다) · 사진·영상이 일으킨 레이아웃 이동 0 · 히어로 안 LCP 그림은 eager + srcset·sizes.
//      유휴 멈춤(④)은 보이는 영상도 반복으로 센다(숨은 탭·화면 밖에서 멈추고 돌아오면 다시 돈다).
//   ④ 유휴 멈춤(Task 11 fix): 숨은 탭·화면 밖에서 유휴 반복이 모두 멈추고(data-wf-paused), 돌아오면 다시 돈다(PAUSE_CHECK · judgePause).
// 등장 중간 프레임 대비(0.6초·1.2초)는 hero-contrast.mjs 가 이 모듈의 QA_INIT(pauseAt) 로 멈춘 화면을 잰다.
// 결과: .tmp/board/gates/hero-motion.json · 종료 0 = 모두 통과, 1 = 실패 있음 또는 도구 실패(「도구 실패:」, 결과 파일 없음).
// board:gates(gates.mjs)가 measureHeroMotion 을 불러 장면 관문과 함께 돈다.
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { startChrome, connect, navigateAndWait } from '../../qa/cdp.mjs'
import { loadHeads, optionsOf, OUT, GATE_CHROME_FLAGS } from './jobs.mjs'

export const TEXT_MIN = 14
export const LONGTASK_MAX = 200
export const LOAD_WINDOW = 2500
export const VIEWPORTS = [[1440, 900, false], [375, 812, true]]
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// 문서 시작 때 심는다: 관문 표지(모션 키트가 gsap 을 window.__wfGsap 으로 내어 준다), longtask 수집,
// pauseAt(ms)가 있으면 장면 시작(data-wf-t0) + pauseAt 에 GSAP 전체와 CSS 애니메이션을 멈춘다(rAF 한 프레임 정밀도).
export const QA_INIT = (pauseAt = null) => `(() => {
  window.__WF_QA = { pauseAt: ${pauseAt == null ? 'null' : Number(pauseAt)} }
  window.__wfLong = []
  const mo = new MutationObserver(() => { if (!window.__wfHeroAt && document.querySelector('[data-hero]')) { window.__wfHeroAt = performance.now(); mo.disconnect() } })
  mo.observe(document, { childList: true, subtree: true })
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__wfLong.push({ s: e.startTime, d: e.duration }) }).observe({ type: 'longtask', buffered: true }) } catch (e) {}
  // 미디어(Task 12): 히어로 안 사진·영상이 일으킨 레이아웃 이동(원인 노드가 img·video·picture 이거나 그것을 담은 칸)과 LCP 요소.
  window.__wfShifts = []; window.__wfLcp = null
  const isMedia = (n) => n && n.nodeType === 1 && !!n.closest('[data-hero]') && (n.matches('img, video, picture, [data-wf-media]') || !!n.querySelector('img, video'))
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) { if (e.hadRecentInput) continue; for (const s of e.sources || []) if (isMedia(s.node)) window.__wfShifts.push({ v: +e.value.toFixed(4), tag: s.node.tagName.toLowerCase(), cls: String(s.node.getAttribute('class') || '').slice(0, 60) }) } }).observe({ type: 'layout-shift', buffered: true }) } catch (e) {}
  try { new PerformanceObserver((l) => { const e = l.getEntries().at(-1); const el = e && e.element; if (!el) return; window.__wfLcp = { tag: el.tagName.toLowerCase(), inHero: !!el.closest('[data-hero]'), loading: el.getAttribute('loading'), fetchPriority: el.getAttribute('fetchpriority'), srcset: !!el.getAttribute('srcset'), sizes: el.getAttribute('sizes'), size: Math.round(e.size) } }).observe({ type: 'largest-contentful-paint', buffered: true }) } catch (e) {}
  ${pauseAt == null ? '' : `(function tick() {
    const r = document.querySelector('[data-wf-t0]')
    if (r && window.__wfGsap && performance.now() >= Number(r.dataset.wfT0) + ${Number(pauseAt)}) {
      window.__wfGsap.globalTimeline.pause()
      for (const a of document.getAnimations()) a.pause()
      window.__wfPaused = Math.round(performance.now() - Number(r.dataset.wfT0))
      return
    }
    requestAnimationFrame(tick)
  })()`}
})()`

// 새 문서 스크립트를 잠깐 심고 fn 을 돌린 뒤 뺀다.
export async function withInit(send, source, fn) {
  const r = await send('Page.addScriptToEvaluateOnNewDocument', { source })
  try { return await fn() } finally { await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: r.result.identifier }).catch(() => {}) }
}

// 등장 끝 신호를 기다리는 한도(ms, Task 11 fix — 고정 3.2초 대신 모션 키트의 data-wf-entered).
export const ENTER_TIMEOUT = 10000
// 등장이 끝날 때까지: 모션 키트 장면은 등장 끝 신호(data-wf-entered, 최대 ENTER_TIMEOUT)까지, 유한 CSS 애니메이션은 끝날 때까지(최대 4초).
// 장면이 3초 안에 붙지 않으면(모션 키트를 쓰지 않는 구성) CSS 만. 돌려주는 값: { scene, entered, stuck, waited(ms) } — stuck 이면 등장이 멈췄다.
export const SETTLED = `(async () => {
  const t0 = performance.now()
  let r
  for (;;) { r = document.querySelector('[data-hero]'); if ((r && r.dataset.wfScene) || performance.now() - t0 > 3000) break; await new Promise((q) => setTimeout(q, 50)) }
  const scene = r ? r.dataset.wfScene ?? null : null
  let stuck = false
  if (scene) for (;;) { if (r.hasAttribute('data-wf-entered')) break; if (performance.now() - t0 > ${ENTER_TIMEOUT}) { stuck = true; break } await new Promise((q) => setTimeout(q, 50)) }
  await Promise.race([Promise.all(document.getAnimations().filter((a) => a.effect && a.effect.getComputedTiming().iterations !== Infinity).map((a) => a.finished.catch(() => 0))), new Promise((q) => setTimeout(q, 4000))])
  return { scene, entered: r && r.hasAttribute('data-wf-entered') ? r.dataset.wfEntered : null, stuck, waited: Math.round(performance.now() - t0) }
})()`

// 유채 픽셀을 찍기 직전(Task 11 묶음 2 — 컨트롤러 판정): 등장은 끝내고 유휴 반복은 첫 위상(시작 값)에 멈춘다. 반복이 찍히는 순간의
// 위상에 따라 칠해진 면적이 흔들리지 않게 한다(묶음 1 r3 −0.08%p). 스크롤 연동(scrub)은 건드리지 않는다(스크롤 0 = 시작 값).
// 끝내기는 totalProgress(전체 회차) 기준이다 — progress(한 회차)로는 반복이 유한한 트윈(r10 B 커서 repeat 5·yoyo)이 끝나지 않는다(Task 11 fix b2 I2).
// 강제로 끝낸 것은 이름과 함께 남기고(forced), 등장 줄(모션 키트 id "wf-enter")이 아직 안 끝났으면 stuckEntrance 로 경고한다(b2 M1).
// GSAP 은 QA_INIT 이 내어 준 window.__wfGsap 으로 본다(없으면 CSS 만). 돌려주는 값: 끝낸 수·멈춘 수(GSAP·CSS)·forced·stuckEntrance.
export const FREEZE_IDLE = `(async () => {
  const out = { gsap: !!window.__wfGsap, finished: 0, paused: 0, idle: 0, cssFinished: 0, cssPaused: 0, forced: [], stuckEntrance: 0 }
  const g = window.__wfGsap
  const name = (a) => {
    if (a.vars && a.vars.id) return String(a.vars.id)
    const t = typeof a.targets === 'function' ? a.targets()[0] : null
    if (t && t.nodeType === 1) { const c = (t.getAttribute('class') || '').trim().split(/\\s+/).filter(Boolean).slice(0, 2).join('.'); return t.tagName.toLowerCase() + (c ? '.' + c : '') }
    return typeof a.getChildren === 'function' ? 'timeline(' + a.getChildren(false).length + ')' : 'tween'
  }
  if (g) for (const a of g.globalTimeline.getChildren(false, true, true)) {
    if (a.scrollTrigger) continue
    const entrance = a.vars && a.vars.id === 'wf-enter'
    if (a.repeat() === -1 || a.totalDuration() > 1e6) { a.pause(0); out.paused++ }
    // 멈춰 있는 등장 밖 트윈(포인터 겹의 quickTo — 포인터가 오기 전까지 0 에서 쉰다)은 돌지 않으므로 건드리지 않고 세기만 한다.
    else if (!entrance && a.paused()) out.idle++
    else if (a.totalProgress() < 1) {
      out.forced.push({ name: name(a), totalProgress: +a.totalProgress().toFixed(3), repeat: a.repeat(), entrance })
      if (entrance) out.stuckEntrance++
      a.totalProgress(1); out.finished++
    }
  }
  for (const a of document.getAnimations()) {
    const t = a.effect && a.effect.getComputedTiming(); if (!t) continue
    if (t.iterations === Infinity) { a.pause(); a.currentTime = 0; out.cssPaused++ }
    else if (a.playState !== 'finished') { try { a.finish(); out.cssFinished++ } catch (e) {} }
  }
  // 영상(Task 12): 첫 프레임(= 포스터)에 멈춘다 — 찍는 순간의 재생 위치에 따라 비율이 흔들리지 않게.
  out.videos = 0
  for (const v of document.querySelectorAll('[data-hero] video')) {
    v.pause(); out.videos++
    if (v.currentTime > 0) await new Promise((r) => { v.addEventListener('seeked', () => r(1), { once: true }); v.currentTime = 0; setTimeout(r, 3000) })
  }
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
  return out
})()`

// ① 보이는 글자 크기 목록. HTML 글자는 계산 font-size, SVG <text>(·tspan·textPath) 글자는 화면에 그려진 크기 = font-size × 화면 변환의 세로 배율
// (viewBox 배율·transform 이 반영된다 — Task 11 fix b1 M5, 예: r9 A 도는 배지). svg 가 true 인 줄이 SVG 글자다.
export const COLLECT_SIZES = `(() => {
  const root = document.querySelector('[data-hero]'); if (!root) return -1
  const out = []
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const t = n.textContent.replace(/\\s+/g, ' ').trim(); if (!t) continue
    const el = n.parentElement; if (el.closest('.sr-only')) continue
    const inSvg = !!el.closest('svg')
    if (inSvg && !el.closest('text')) continue
    const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none') continue
    let op = 1; for (let a = el; a; a = a.parentElement) op *= Number(getComputedStyle(a).opacity); if (op <= 0.01) continue
    const r = document.createRange(); r.selectNodeContents(n)
    if (![...r.getClientRects()].some((b) => b.width >= 1 && b.height >= 1)) continue
    let size = parseFloat(cs.fontSize)
    if (inSvg) { const m = typeof el.getScreenCTM === 'function' ? el.getScreenCTM() : null; if (m) size *= Math.hypot(m.c, m.d) }
    out.push({ t: t.slice(0, 40), size: +size.toFixed(2), ...(inSvg ? { svg: true } : {}) })
  }
  return out
})()`

// ④ 유휴 반복 멈춤(Task 11 fix b1 M6): 숨은 탭(visibilitychange — visibilityState 를 잠깐 hidden 으로 덮는다)과 화면 밖(히어로 아래에 빈 칸을 붙이고
// 히어로가 화면을 벗어날 때까지 스크롤)에서 장면의 유휴 반복(GSAP repeat -1)이 모두 paused 이고 뿌리에 data-wf-paused 가 붙는지, 돌아오면 다시 도는지.
// 반복이 없는 구성(M1)도 표지(data-wf-paused)가 붙고 떨어지는지는 본다. QA_INIT 으로 연 페이지에서 등장이 끝난 뒤 돈다(마지막 — 스크롤을 남긴다).
export const PAUSE_CHECK = `(async () => {
  const g = window.__wfGsap, r = document.querySelector('[data-hero]')
  if (!r || !r.dataset.wfScene) return { scene: null }
  const frame = () => new Promise((q) => requestAnimationFrame(() => requestAnimationFrame(q)))
  const loops = () => (g ? g.globalTimeline.getChildren(false, true, true).filter((a) => !a.scrollTrigger && (a.repeat() === -1 || a.totalDuration() > 1e6)) : [])
  // 영상(Task 12)도 유휴 반복으로 센다: 보이는(크기가 있는·부모가 멈추지 않은 — data-wf-hold 없음) 영상 수 = 돌아야 할 수, 재생 중인 영상 = 도는 수.
  const vids = () => [...r.querySelectorAll('video')].filter((v) => v.getClientRects().length && !v.hasAttribute('data-wf-hold'))
  const running = () => loops().filter((a) => !a.paused()).length + vids().filter((v) => !v.paused).length
  for (let i = 0; i < 40 && vids().some((v) => v.paused); i++) await new Promise((q) => setTimeout(q, 100))
  const out = { scene: r.dataset.wfScene, loops: loops().length + vids().length, videos: vids().length, before: running() }
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })
  document.dispatchEvent(new Event('visibilitychange'))
  await frame()
  out.hidden = running(); out.hiddenMark = r.hasAttribute('data-wf-paused')
  delete document.visibilityState
  document.dispatchEvent(new Event('visibilitychange'))
  await frame()
  out.shown = running(); out.shownMark = r.hasAttribute('data-wf-paused')
  const pad = document.createElement('div'); pad.style.height = (innerHeight * 3) + 'px'; document.body.appendChild(pad)
  scrollTo(0, scrollY + r.getBoundingClientRect().bottom + innerHeight)
  await frame(); await new Promise((q) => setTimeout(q, 300))
  out.offscreen = running(); out.offscreenMark = r.hasAttribute('data-wf-paused'); out.heroBottom = Math.round(r.getBoundingClientRect().bottom)
  scrollTo(0, 0)
  await frame(); await new Promise((q) => setTimeout(q, 300))
  out.back = running(); out.backMark = r.hasAttribute('data-wf-paused')
  pad.remove()
  return out
})()`

// ④ 판정: 숨은 탭·화면 밖에서 도는 반복 0 + 표지, 돌아오면 반복이 모두 다시 돌고 표지가 떨어진다. 장면이 없으면 판정하지 않는다.
export function judgePause(p) {
  const fails = []
  if (!p || p.scene == null) return { ...p, fails }
  if (p.scene === 'static') return { ...p, fails }
  if (p.hidden !== 0) fails.push(`숨은 탭에서 도는 유휴 반복 ${p.hidden}/${p.loops}`)
  if (!p.hiddenMark) fails.push('숨은 탭에서 data-wf-paused 가 없다')
  if (p.offscreen !== 0) fails.push(`화면 밖에서 도는 유휴 반복 ${p.offscreen}/${p.loops}`)
  if (!p.offscreenMark) fails.push(`화면 밖에서 data-wf-paused 가 없다(히어로 아래 끝 ${p.heroBottom}px)`)
  if (p.shown !== p.loops || p.shownMark) fails.push(`탭이 돌아와도 반복 ${p.shown}/${p.loops}${p.shownMark ? ' · 표지 남음' : ''}`)
  if (p.back !== p.loops || p.backMark) fails.push(`화면에 돌아와도 반복 ${p.back}/${p.loops}${p.backMark ? ' · 표지 남음' : ''}`)
  return { ...p, fails }
}

// 판정: 14px 미만이 하나라도 있으면 실패. 잰 글자가 0개면 「잰 것 없음」으로 실패한다.
export function judgeTextSizes(list, min = TEXT_MIN) {
  const small = list.filter((x) => x.size < min)
  const fails = small.map((x) => `글자 「${x.t}」 ${x.size}px < ${min}px`)
  if (!list.length) fails.push('잰 글자 0개')
  return { count: list.length, smallest: list.length ? Math.min(...list.map((x) => x.size)) : null, svgSizes: list.filter((x) => x.svg).map((x) => x.size), fails }
}

// ③ 판정: 등장 구간 [t0, t0+win]에 겹친 longtask 의 최대 길이 ≤ max. entries: [{ s, d }](ms, performance 시각).
export function judgeLongTasks(entries, t0, { win = LOAD_WINDOW, max = LONGTASK_MAX } = {}) {
  const inWin = t0 == null ? [] : entries.filter((e) => e.s < t0 + win && e.s + e.d > t0)
  const worst = inWin.reduce((a, e) => Math.max(a, e.d), 0)
  const overall = entries.reduce((a, e) => Math.max(a, e.d), 0)
  const fails = []
  if (t0 == null) fails.push('등장 시작 시각(data-wf-t0 · 히어로가 붙은 시각)이 없다')
  else if (worst > max) fails.push(`등장 구간 longtask ${Math.round(worst)}ms > ${max}ms`)
  return { t0, count: inWin.length, maxInLoad: Math.round(worst), maxOverall: Math.round(overall), fails }
}

// ② 판정: 실행 중 CSS 애니메이션 0개, GSAP 장면이면 정지 갈래.
// videos(Task 12): 동작 줄이기에서 재생 중인 히어로 영상 수(0 이어야 한다 — 멈춘 포스터).
export function judgeReduced({ running, scene, videos = 0 }) {
  const fails = []
  if (running !== 0) fails.push(`동작 줄이기에서 실행 중 애니메이션 ${running}개`)
  if (videos !== 0) fails.push(`동작 줄이기에서 재생 중인 영상 ${videos}개`)
  if (scene != null && scene !== 'static') fails.push(`동작 줄이기에서 장면 갈래 ${scene}`)
  return { running, scene, videos, fails }
}

// 미디어 판정(Task 12, 순수): 사진·영상이 일으킨 레이아웃 이동 0 · 히어로 안 LCP 가 그림이면 서둘러 받고(loading lazy 아님) srcset·sizes 가 있다.
export function judgeMedia({ shifts = [], lcp = null } = {}) {
  const fails = []
  if (shifts.length) fails.push(`미디어 레이아웃 이동 ${shifts.length}건(${shifts.map((s) => `${s.tag} ${s.v}`).join(', ')})`)
  if (lcp?.inHero && lcp.tag === 'img') {
    if (lcp.loading === 'lazy') fails.push('LCP 그림이 loading=lazy 다')
    if (!lcp.srcset || !lcp.sizes) fails.push('LCP 그림에 srcset·sizes 가 없다')
  }
  return { shifts: shifts.length, lcp, fails }
}

async function open(send, ev, url, [w, h, mobile], motion = 'no-preference') {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile })
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }, { name: 'prefers-reduced-motion', value: motion }] })
  await navigateAndWait(send, ev, url, { timeoutMs: 60000 })
  await ev('document.fonts.ready.then(() => 1)')
  for (let i = 0; i < 100 && !(await ev('!!document.querySelector("[data-hero]")')); i++) await sleep(50)
}

// 한 주소를 잰다 → { sizes: { [폭]: judgeTextSizes }, reduced: judgeReduced, longtask: judgeLongTasks, fails: [...] }.
export async function measureHeroMotion(send, ev, url) {
  const res = { sizes: {}, settled: {} }
  for (const vp of VIEWPORTS) {
    await open(send, ev, url, vp)
    res.settled[vp[0]] = await ev(SETTLED)
    const list = await ev(COLLECT_SIZES)
    if (list === -1) throw new Error(`[data-hero] 가 없다 — ${url}`)
    res.sizes[vp[0]] = judgeTextSizes(list)
  }
  await open(send, ev, url, VIEWPORTS[0], 'reduce')
  await sleep(1500)
  res.reduced = judgeReduced(await ev(`({ running: document.getAnimations().filter((a) => a.playState === 'running').length, scene: document.querySelector('[data-hero]')?.dataset.wfScene ?? null, videos: [...document.querySelectorAll('[data-hero] video')].filter((v) => !v.paused).length })`))
  await withInit(send, QA_INIT(null), async () => {
    await open(send, ev, url, VIEWPORTS[0])
    await ev(SETTLED)
    // 등장 시작: 모션 키트 장면이면 data-wf-t0, 아니면(CSS 등장 구성) 히어로가 DOM 에 붙은 시각.
    const got = await ev(`({ t0: document.querySelector('[data-wf-t0]') ? Number(document.querySelector('[data-wf-t0]').dataset.wfT0) : (window.__wfHeroAt ?? null), long: window.__wfLong || [], uncovered: window.__wfEnterUncovered ?? null })`)
    res.longtask = judgeLongTasks(got.long, got.t0)
    res.media = judgeMedia(await ev('({ shifts: window.__wfShifts || [], lcp: window.__wfLcp })'))
    // 첫 칠 전에 숨지 않는 등장 대상(서버 렌더에서 끝 모양이 먼저 보인다 — motion-boot, Task 11 fix) — 판정은 SSR 검사가, 여기서는 목록만 남긴다.
    res.enterUncovered = got.uncovered
    res.pause = judgePause(await ev(PAUSE_CHECK))
  })
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] })
  const stuck = Object.entries(res.settled).filter(([, x]) => x?.stuck).map(([w]) => `${w} 등장 끝 신호(data-wf-entered)가 ${ENTER_TIMEOUT / 1000}초 안에 없다`)
  res.fails = [...stuck, ...Object.entries(res.sizes).flatMap(([w, x]) => x.fails.map((f) => `${w} 글자 크기: ${f}`)), ...res.reduced.fails.map((f) => `동작 줄이기: ${f}`), ...res.longtask.fails.map((f) => `longtask: ${f}`), ...res.media.fails.map((f) => `미디어: ${f}`), ...res.pause.fails.map((f) => `유휴 멈춤: ${f}`)]
  return res
}

// 한 줄 요약(hero-motion 단독 실행·board:gates 가 같이 쓴다).
export const motionLine = (m) => {
  const svg = Object.values(m.sizes).flatMap((x) => x.svgSizes ?? [])
  const p = m.pause ?? {}
  return `최소 글자 ${Object.entries(m.sizes).map(([w, x]) => `${w}:${x.smallest}px`).join(' ')}${svg.length ? ` (SVG ${Math.min(...svg)}px)` : ''} · 등장 끝 ${Object.values(m.settled ?? {}).map((x) => (x?.stuck ? '멈춤' : `${x?.waited ?? '-'}ms`)).join('/')} · reduce 실행 ${m.reduced.running}(${m.reduced.scene ?? '장면 없음'})${m.reduced.videos != null ? ` 영상 ${m.reduced.videos}` : ''}${m.media ? ` · 미디어 이동 ${m.media.shifts} · LCP ${m.media.lcp ? `${m.media.lcp.tag}${m.media.lcp.inHero ? '(히어로)' : ''}${m.media.lcp.tag === 'img' ? ` ${m.media.lcp.loading ?? 'eager'}·${m.media.lcp.fetchPriority ?? '-'}` : ''}` : '-'}` : ''} · longtask 등장 ${m.longtask.maxInLoad}ms / 전체 ${m.longtask.maxOverall}ms · 유휴 멈춤 반복 ${p.loops ?? '-'}(숨김 ${p.hidden ?? '-'} · 화면 밖 ${p.offscreen ?? '-'} · 복귀 ${p.back ?? '-'})${m.enterUncovered?.length ? ` · 첫 칠 전 숨김 밖 ${m.enterUncovered.join(',')}` : ''}${m.fails.length ? `\n  ${m.fails.join('\n  ')}` : ''}`
}

// 잴 목록: 레시피마다 A · B(있으면), 기본 테마.
export const heroMotionJobs = (heads) => heads.flatMap((h) => optionsOf(h).map((o) => ({ recipe: h.id, option: o.key, query: `&theme=${h.defaultTheme === 'dark' ? 'dark' : 'light'}${o.query}` })))

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const argv = process.argv.slice(2)
  const flag = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv.splice(i, 2)[1] : null }
  const only = flag('--only')?.split(',')
  const origin = (argv.filter((a) => !a.startsWith('--'))[0] ?? 'http://localhost:3000').replace(/\/$/, '')
  const dir = join(OUT, 'gates')
  const file = join(dir, only ? `hero-motion-${only.join('_')}.json` : 'hero-motion.json')
  mkdirSync(dir, { recursive: true })
  rmSync(file, { force: true })
  let code = 0, chrome
  try {
    chrome = await startChrome(GATE_CHROME_FLAGS, { prefix: 'hero-motion-' })
    const { ws, send, ev } = await connect(chrome.wsUrl)
    await send('Page.enable'); await send('Runtime.enable')
    const rows = []
    for (const j of heroMotionJobs(loadHeads().filter((x) => !only || only.includes(x.id)))) {
      const url = `${origin}/qa/recipes?r=${j.recipe}&scene=hero${j.query}`
      const m = await measureHeroMotion(send, ev, url)
      rows.push({ ...j, url, pass: !m.fails.length, ...m })
      console.log(`${m.fails.length ? 'FAIL' : 'PASS'} ${j.recipe}-${j.option} ${motionLine(m)}`)
    }
    ws.close()
    const failed = rows.filter((r) => !r.pass)
    writeFileSync(file, JSON.stringify({ origin, textMin: TEXT_MIN, longtaskMax: LONGTASK_MAX, count: rows.length, failed: failed.length, rows }, null, 2) + '\n')
    console.log(`히어로 모션 관문: ${rows.length}개 중 실패 ${failed.length}`)
    code = failed.length ? 1 : 0
  } catch (e) {
    console.error(`도구 실패: ${e.message}`)
    rmSync(file, { force: true })
    code = 1
  } finally {
    await chrome?.close()
  }
  process.exit(code)
}
