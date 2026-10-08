// 서버 렌더 첫 칠 번쩍임 검사(ssr-flash.mjs, Task 11 fix · fix 2 · Task 16)의 판정 — 서버 없이 돈다(마지막 검사 하나만 headless Chrome 으로 페이지 안 보임 탐침을 돌린다).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { judgeFlash, judgeFailsafe, judgeLeakPixels, keepFails, leakPick, leakPickSmall, gridPoints, insetCovers, HIDDEN_TARGETS, HIDE_ONE, hiddenAfterSkipFails, hiddenControlFails, MODES, judgeKeepChange, keepOnlyFails, KEEP_RECTS, KEEPPIX, KEEP_SHIFT, VIDEO_OFF } from './ssr-flash.mjs'
import { startChrome, connect, navigateAndWait } from '../../qa/cdp.mjs'

// 상자(등장 대상)마다 d 를 따로 잰다(fix 2 N5 — 평균이 아니라 상자별 최대). dStart·dFinal·dStartFinal 은 상자 순서 배열.
test('flash judge (per box): a pre-hydration frame much closer to the final state than to the entrance start in any box is a flash', () => {
  // 가림이 된 경우: 모든 상자에서 하이드레이션 전 프레임이 시작 자세(숨김)와 거의 같다.
  assert.deepEqual(judgeFlash({ pre: [{ dStart: [0.4, 0.2], dFinal: [38, 20] }, { dStart: [1.1, 0.3], dFinal: [36, 21] }], dStartFinal: [37, 20] }), { frames: 2, flashFrames: 0, flash: false, measurable: true, boxes: 2, flashBoxes: [] })
  // 양성 대조(가림 없음): 끝 모양이 먼저 보인다.
  const flash = judgeFlash({ pre: [{ dStart: [35], dFinal: [0.8] }], dStartFinal: [36] })
  assert.equal(flash.flash, true)
  assert.equal(flash.flashFrames, 1)
  assert.deepEqual(flash.flashBoxes, [0])
  // 부분 누출: 큰 숨긴 상자 셋 사이의 작은 상자 하나만 끝 모양 — 평균이면 묻히지만 상자별로는 잡힌다.
  const leak = judgeFlash({ pre: [{ dStart: [0.3, 0.5, 0.2, 24], dFinal: [40, 38, 35, 0.9] }], dStartFinal: [40, 38, 35, 24] })
  const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length
  assert.ok(mean([0.9, 40, 38, 35]) > mean([24, 0.3, 0.5, 0.2]), '평균이면 번쩍임으로 보이지 않는다')
  assert.equal(leak.flash, true)
  assert.deepEqual(leak.flashBoxes, [3])
  // transform 만 하는 등장(시작 자세가 보이는 자리에서 조금 비켜 있음): 숨긴 프레임은 시작·끝과 비슷하게 멀다 — 번쩍임이 아니다.
  assert.equal(judgeFlash({ pre: [{ dStart: [30.5], dFinal: [31.2] }, { dStart: [31], dFinal: [29.6] }], dStartFinal: [6] }).flash, false)
  // 하이드레이션 전 프레임이 없거나 모든 상자의 시작과 끝이 거의 같으면 잴 것이 없다.
  assert.equal(judgeFlash({ pre: [], dStartFinal: [30] }).measurable, false)
  assert.equal(judgeFlash({ pre: [{ dStart: [0.2], dFinal: [0.9] }], dStartFinal: [1.2] }).measurable, false)
  // 잴 수 없는 상자(시작 = 끝)는 번쩍임으로 세지 않는다.
  assert.equal(judgeFlash({ pre: [{ dStart: [1.8, 0.3], dFinal: [0.1, 30] }], dStartFinal: [1.9, 30] }).flash, false)
})

test('failsafe judge: revealed (late), the late scene skips its entrance, and no frame after the reveal goes back to the start pose', () => {
  assert.deepEqual(judgeFailsafe({ after: [{ dStartRef: 30, dFinal: 0.5 }, { dStartRef: 31, dFinal: 0.2 }], entered: 'skipped', motion: 'late' }).fails, [])
  const bad = judgeFailsafe({ after: [{ dStartRef: 30, dFinal: 0.5 }, { dStartRef: 0.8, dFinal: 30 }], entered: '', motion: 'late' })
  assert.equal(bad.rehidden, 1)
  assert.equal(bad.fails.length, 2)
  assert.match(bad.fails[0], /건너뛰지 않았다/)
  assert.match(bad.fails[1], /숨김 → 재등장/)
  assert.match(judgeFailsafe({ after: [{ dStartRef: 30, dFinal: 0 }], entered: 'skipped', motion: 'on' }).fails[0], /드러내지 않았다/)
  assert.match(judgeFailsafe({ after: [], entered: 'skipped', motion: 'late' }).fails[0], /프레임 0개/)
  // 시작 ≈ 끝(차가 작은) 장면: 어느 쪽이 가까운지는 잡음이다 — 잡음 여유(2) 안의 차이는 「시작 자세로 돌아감」으로 세지 않는다. 큰 차이는 그대로 센다.
  assert.equal(judgeFailsafe({ after: [{ dStartRef: 1.0, dFinal: 1.4 }, { dStartRef: 0.9, dFinal: 2.5 }], entered: 'skipped', motion: 'late' }).rehidden, 0)
  assert.equal(judgeFailsafe({ after: [{ dStartRef: 1.0, dFinal: 3.5 }], entered: 'skipped', motion: 'late' }).rehidden, 1)
  // keep 전용 히어로는 프레임 수를 밖에서 센다(keep 상자가 끝 프레임과 달라진 프레임).
  assert.match(judgeFailsafe({ after: [{}, {}], entered: 'skipped', motion: 'late', rehiddenFrames: 1 }).fails[0], /숨김 → 재등장/)
  assert.deepEqual(judgeFailsafe({ after: [{}, {}], entered: 'skipped', motion: 'late', rehiddenFrames: 0 }).fails, [])
})

// P3-4 perf 합침(대장 C173): 히어로의 글·그림이 data-enter="keep" 이라 숨김 대상이 없을 수 있다 — 그런 히어로는 keep 상자가 하이드레이션 전·뒤에 같은가를 잰다.
// 음성 대조: keep 이 하이드레이션 전에 가려져 있으면 · 하이드레이션 때 크게 바뀌면 실패한다. 잴 것이 하나도 없을 때(keep 도 숨김도 0)만 도구 실패다.
test('keep-only judge: keep boxes that stay the same pass; a keep box that changes at hydration, a hidden keep box and nothing-to-measure fail', () => {
  const frame = (...changed) => ({ boxes: changed.map((c) => ({ content: 20000, ink: 2000, changed: c })) })
  const probe = { scene: null, keep: 3, keepVisible: 3 }
  // 안정: 끝 프레임과 잡음 수준(JPEG·안티앨리어싱 몇십 점)만 다르다.
  const stable = judgeKeepChange([frame(30, 8), frame(12, 0), frame(0, 0)])
  assert.deepEqual({ flash: stable.flash, measurable: stable.measurable, boxes: stable.boxes, flashFrames: stable.flashFrames }, { flash: false, measurable: true, boxes: 2, flashFrames: 0 })
  assert.deepEqual(keepOnlyFails({ probeEarly: probe, probeMid: probe, change: stable }), [])
  // 하이드레이션 때 keep 상자가 크게 바뀐다(끝 프레임과 다른 점이 40개 이상이고 내용(ink)의 30% 이상): 번쩍임.
  const jump = judgeKeepChange([frame(25, 4800), frame(0, 0)])
  assert.deepEqual({ flash: jump.flash, flashBoxes: jump.flashBoxes, flashFrames: jump.flashFrames }, { flash: true, flashBoxes: [1], flashFrames: 1 })
  assert.match(keepOnlyFails({ probeEarly: probe, probeMid: probe, change: jump })[0], /keep 대상이 하이드레이션 때 바뀐다: 상자 1/)
  // 잡음 바닥: 39점이나 내용(ink)의 30% 미만은 바뀐 것으로 보지 않는다 — 큰 그림 상자의 몇천 점, 굵은 큰 글자 가장자리(실측 r8-dusk B: ink 의 8%).
  assert.equal(judgeKeepChange([frame(39)]).flash, false)
  assert.equal(judgeKeepChange([{ boxes: [{ content: 900000, ink: 600000, changed: 4000 }] }]).flash, false)
  assert.equal(judgeKeepChange([{ boxes: [{ content: 74160, ink: 30000, changed: 2368 }] }]).flash, false)
  // 글자가 성긴 작은 상자(캡션): 글자 점(ink 60) 거의 전부가 바뀌면 상자 넓이의 1% 도 안 돼도 잡는다. 바탕뿐인 면(ink 0)이 사라져도 잡는다.
  assert.equal(judgeKeepChange([{ boxes: [{ content: 7080, ink: 60, changed: 56 }] }]).flash, true)
  assert.equal(judgeKeepChange([{ boxes: [{ content: 20000, ink: 0, changed: 20000 }] }]).flash, true)
  // keep 대상이 하이드레이션 전에 가려져 있다(숨긴 [data-enter] 조상 아래): 실패 — 프레임이 같아도.
  assert.match(keepOnlyFails({ probeEarly: { scene: null, keep: 3, keepVisible: 1 }, probeMid: probe, change: stable })[0], /keep 대상 2\/3 개가 하이드레이션 전에 숨었다/)
  // 잴 것이 없다: 프레임이 없거나 잴 수 있는 keep 상자가 없다(내용 점 25개 미만) — 통과가 아니라 실패.
  assert.equal(judgeKeepChange([]).measurable, false)
  assert.equal(judgeKeepChange([{ boxes: [{ content: 10, ink: 0, changed: 0 }] }]).measurable, false)
  assert.match(keepOnlyFails({ probeEarly: probe, probeMid: probe, change: judgeKeepChange([]) }).at(-1), /잴 것이 없다/)
})

// fix 2 N5: keep 대상(숨기지 않는 누르는 요소 등)은 하이드레이션 전에도 보여야 한다 — 숨긴 [data-enter] 조상 아래에 들어가면 잡는다.
test('keep check: every data-enter="keep" element is visible before hydration', () => {
  assert.deepEqual(keepFails({ scene: null, keep: 3, keepVisible: 3 }), [])
  assert.deepEqual(keepFails({ scene: null, keep: 0, keepVisible: 0 }), [])
  assert.match(keepFails({ scene: null, keep: 3, keepVisible: 1 })[0], /keep 대상 2\/3 개가 하이드레이션 전에 숨었다/)
  // 이미 하이드레이션된 뒤의 탐침은 판정하지 않는다(장면이 시작하면 숨김이 풀린다).
  assert.deepEqual(keepFails({ scene: 'motion', keep: 3, keepVisible: 0 }), [])
  assert.deepEqual(keepFails(null), [])
})

// fix 2 N5: 픽셀 판정 — 하이드레이션 전 프레임이 끝 프레임과 같고, 등장 시작과 다르고(등장이 바꾸는 픽셀), 숨김 기준(ref: 등장 대상을 가림 CSS 와
// 따로 강제로 숨긴 프레임)과도 다른 픽셀 = 끝 모양이 샌 픽셀. 상자가 다른 숨긴 대상(뒤의 영상 등)으로 차 있어도 새어 나온 글자 픽셀만 센다. 가림이 맞으면 0 이다.
test('pixel leak judge: pixels that differ from the all-hidden reference but match the final frame; per box, with a floor against noise', () => {
  // 가림이 맞다: 새어 나온 픽셀 0.
  assert.deepEqual(judgeLeakPixels([{ content: 9000, leaked: 0 }, { content: 400, leaked: 3 }]), { flashBoxes: [], leaked: [0, 3] })
  // 큰 영상 위 제목 하나가 샜다: 상자 안 내용 픽셀의 대부분은 영상(숨김)이지만 글자 픽셀 수백 개가 끝 모양 — 잡는다.
  assert.deepEqual(judgeLeakPixels([{ content: 60000, leaked: 2400 }, { content: 5000, leaked: 0 }]).flashBoxes, [0])
  // 잡음 바닥: 몇 픽셀(< 40)이나 내용의 1% 미만은 새어 나온 것으로 보지 않는다.
  assert.deepEqual(judgeLeakPixels([{ content: 20000, leaked: 39 }, { content: 90000, leaked: 800 }]).flashBoxes, [])
  assert.deepEqual(judgeLeakPixels([{ content: 0, leaked: 0 }]).flashBoxes, [])
})

// fix 2 N5: 부분 누출 대조 — 가림은 켠 채 등장 대상 하나(와 그 아래 등장 대상)에서만 data-enter 를 뗀다. 고르는 대상은 같은 히어로의 양성 대조(가림 끔)에서
// 번쩍임이 잡힌 상자 가운데, 다른 등장 대상 아래가 아니고(숨는 조상이면 visibility 상속으로 여전히 숨고, keep 조상이면 settleKept 가 등장을 끝 상태로
// 둬 번쩍임 자체가 없다) keep 이 아닌 것 —
// 다른 대상 상자에 가장 덜 가려진 것(cover), 같으면 새어 나온 픽셀(leaked)이 많은 것 — 잡음 바닥(40) 아래는 빼고. (눈에 띄게 등장하는 대상 하나만 새면 상자별 판정이 그것을 잡는가 — 평균이면 나머지 숨긴 상자에 묻힌다.)
test('leak pick: from the full-control run, the least-covered top-level non-keep box that flashed (ties → most leaked pixels); nothing eligible → null', () => {
  const c = (sig, nth, leaked, extra = {}) => ({ sig, nth, leaked, flash: true, nested: false, keep: false, cover: 0, ...extra })
  assert.deepEqual(leakPick([c('h1|a', 0, 1200), c('p|b', 0, 3000), c('span|n', 0, 6000, { nested: true }), c('a|k', 0, 7000, { keep: true }), c('svg|g', 0, 9000, { flash: false })]), { sig: 'p|b', nth: 0 })
  assert.deepEqual(leakPick([c('p|b', 1, 200), c('p|b', 0, 400)]), { sig: 'p|b', nth: 0 })
  assert.equal(leakPick([c('div|m', 0, 90, { nested: true }), c('svg|g', 0, 9, { flash: false })]), null)
  assert.equal(leakPick([]), null)
  // 덜 가려진 대상이 먼저 — 겹친 층의 맨 뒤(하늘)는 제 픽셀이 앞 층에 가려 대조가 흐려진다. 같으면 새어 나온 픽셀이 많은 것.
  assert.deepEqual(leakPick([c('g|back', 0, 120000, { cover: 0.8 }), c('span|cta', 0, 1400, { cover: 0 }), c('p|tag', 0, 4000, { cover: 0 })]), { sig: 'p|tag', nth: 0 })
  // 잡음 바닥 아래(< 40 픽셀)는 고르지 않는다.
  assert.deepEqual(leakPick([c('span|tiny', 0, 30, { cover: 0 }), c('g|back', 0, 120000, { cover: 0.8 })]), { sig: 'g|back', nth: 0 })
})

test('modes: a hidden reference first; the gate, the partial-leak control and the full control share the hydration delay; the failsafe run holds JS past the reveal', () => {
  assert.deepEqual(Object.keys(MODES), ['ref', 'gate', 'keepctl', 'control', 'leak', 'leak2', 'failsafe'])
  assert.equal(MODES.keepctl.keepShift, true)
  assert.equal(MODES.keepctl.gate, true)
  assert.equal(MODES.keepctl.delay, MODES.gate.delay)
  assert.equal(MODES.leak2.leak, true)
  assert.equal(MODES.leak2.small, true)
  assert.equal(MODES.leak2.delay, MODES.gate.delay)
  assert.equal(MODES.ref.hideAll, true)
  for (const m of ['ref', 'control', 'leak']) assert.equal(MODES[m].delay, MODES.gate.delay, m)
  assert.equal(MODES.gate.gate, true)
  assert.equal(MODES.leak.gate, true)
  assert.equal(MODES.leak.leak, true)
  assert.equal(MODES.control.gate, false)
  assert.ok(MODES.gate.delay < 1500, '가림 구간은 안전장치(1.5초)보다 짧다')
  assert.ok(MODES.failsafe.delay > 1500 + 1000, '안전장치(DOMContentLoaded + 1.5초)가 드러낸 뒤 한동안 서버 HTML 만 보인다')
})

// ── Task 16(리뷰 14 #8·#9) ──
test('leak pick (second control): the smallest flashing top-level non-keep box other than the first pick; nothing else eligible → null', () => {
  const c = (sig, nth, area, leaked, extra = {}) => ({ sig, nth, area, leaked, flash: true, nested: false, keep: false, cover: 0, ...extra })
  const cands = [c('h1|t', 0, 90000, 5000), c('span|icon', 0, 196, 60), c('p|b', 0, 8000, 900), c('i|dot', 0, 16, 10), c('b|n', 0, 100, 80, { nested: true })]
  const first = leakPick(cands)
  assert.deepEqual(first, { sig: 'h1|t', nth: 0 }, '첫 대조: 덜 가려진 것 가운데 새어 나온 픽셀이 많은 것')
  assert.deepEqual(leakPickSmall(cands, first), { sig: 'span|icon', nth: 0 }, '둘째: 가장 작은 것(잡음 바닥 아래·다른 대상 아래는 뺀다)')
  assert.equal(leakPickSmall([c('p|b', 0, 8000, 900)], { sig: 'p|b', nth: 0 }), null)
  assert.deepEqual(leakPickSmall([c('a|x', 0, 500, 50), c('a|x', 1, 500, 70)]), { sig: 'a|x', nth: 1 }, '넓이가 같으면 새어 나온 픽셀이 많은 것')
})

test('sample grid: thin boxes (< 4 px) are sampled at every pixel — a 1 px line at x 621 is not skipped by a grid that starts at 620', () => {
  const W = 1440, H = 900
  const xs = (pts) => [...new Set(pts.map((p) => p % W))]
  assert.deepEqual(xs(gridPoints({ left: 621, right: 622, top: 100, bottom: 400 }, W, H, 4)), [621], '세로 1px 선')
  assert.equal(gridPoints({ left: 621, right: 622, top: 100, bottom: 400 }, W, H, 4).length, 300)
  assert.deepEqual([...new Set(gridPoints({ left: 100, right: 900, top: 380, bottom: 381 }, W, H, 2).map((p) => Math.floor(p / W)))], [380], '가로 1px 선')
  // 넓은 상자는 격자 그대로(4px).
  assert.equal(gridPoints({ left: 0, right: 16, top: 0, bottom: 16 }, W, H, 4).length, 16)
  // 옛 격자는 이 선을 놓쳤다(음성 대조 — 620 만 본다).
  const old = []; for (let x = Math.floor(621 / 4) * 4; x < 622; x += 4) old.push(x)
  assert.deepEqual(old, [620])
})

test('clip-path inset cover: fully inset (either axis) hides the box; partial insets and other shapes do not', () => {
  assert.equal(insetCovers('inset(0% 100% 0% 0%)', 200, 40), true)
  assert.equal(insetCovers('inset(0% 0% 100% 0%)', 200, 40), true)
  assert.equal(insetCovers('inset(50%)', 200, 40), true)
  assert.equal(insetCovers('inset(0px 120px 0px 80px)', 200, 40), true)
  assert.equal(insetCovers('inset(0% 60% 0% 0% round 4px)', 200, 40), false)
  assert.equal(insetCovers('inset(0% 0% 0% 0%)', 200, 40), false)
  assert.equal(insetCovers('none', 200, 40), false)
  assert.equal(insetCovers('circle(50%)', 200, 40), false)
  assert.equal(insetCovers(undefined, 200, 40), false)
})

test('failsafe final visibility judges: any hidden target fails; a hiding control that is not caught (or finds nothing to hide) fails', () => {
  assert.deepEqual(hiddenAfterSkipFails([]), [])
  assert.match(hiddenAfterSkipFails([{ t: 'p.dim-label', why: 'clip-path inset(0% 100% 0% 0%)' }])[0], /건너뛴 뒤 숨은 등장 대상: p\.dim-label\(clip-path/)
  assert.deepEqual(hiddenControlFails([{ how: 'clip', picked: 'h1.x', caught: true }, { how: 'opacity', picked: 'h1.x', caught: true }]), [])
  assert.match(hiddenControlFails([{ how: 'opacity', picked: 'h1.x', caught: false }])[0], /잡지 못했다/)
  assert.match(hiddenControlFails([{ how: 'clip', picked: null, caught: false }])[0], /숨길 등장 대상이 없다/)
})

// 페이지 안 보임 탐침(HIDDEN_TARGETS)과 숨김 대조(HIDE_ONE)를 실제 CSS 로 — 보이는 것·잘린 것·조상 불투명도 0·조상 clip-path·visibility hidden·display none(뺀다).
test('in-page visibility probe: catches clip-path fully inset (own or ancestor), zero effective opacity and visibility hidden; skips unrendered; HIDE_ONE controls are caught and undone', async () => {
  const PAGE = 'data:text/html;charset=utf-8,' + encodeURIComponent(`<!doctype html><html><body>
    <h1 data-enter class="ok">보임</h1>
    <p data-enter class="clipped" style="clip-path: inset(0% 100% 0% 0%)">잘림</p>
    <div style="opacity: 0"><span data-enter class="faded">흐림</span></div>
    <div style="clip-path: inset(0 0 100% 0)"><em data-enter class="anc">조상 잘림</em></div>
    <p data-enter class="hidden" style="visibility: hidden">숨김</p>
    <p data-enter class="none" style="display: none">안 그림</p>
    <p data-enter="keep" class="keep" style="opacity: 0.5">반투명 keep</p>
  </body></html>`)
  const chrome = await startChrome(['--hide-scrollbars'], { prefix: 'ssr-vis-' })
  try {
    const { ws, send, ev } = await connect(chrome.wsUrl)
    await send('Page.enable'); await send('Runtime.enable')
    await navigateAndWait(send, ev, PAGE, { timeoutMs: 20000 })
    const hidden = await ev(HIDDEN_TARGETS)
    assert.deepEqual(hidden.map((x) => x.t).sort(), ['em.anc', 'p.clipped', 'p.hidden', 'span.faded'])
    assert.match(hidden.find((x) => x.t === 'em.anc').why, /조상/)
    for (const how of ['clip', 'opacity', 'visibility']) {
      const picked = await ev(HIDE_ONE(how))
      assert.equal(picked, 'h1.ok', how)
      const after = await ev(HIDDEN_TARGETS)
      assert.ok(after.some((x) => x.hid && x.t === 'h1.ok'), `${how}: ${JSON.stringify(after)}`)
      await ev('window.__wfUnhide()')
      assert.equal((await ev(HIDDEN_TARGETS)).length, 4, `${how}: 되돌렸다`)
    }
    ws.close()
  } finally {
    await chrome.close()
  }
})

// keep 전용 판정의 페이지 안 재료 — KEEP_RECTS(안쪽 keep 만 · 화면 안으로 자름 · 안 그려진 것 뺌) · KEEPPIX(끝 프레임과 다른 점 수 + 숨김 대상 상자 빼기) ·
// KEEP_SHIFT(양성 대조: 장면 시작 때 글 있는 가장 큰 keep 을 옮긴다) · VIDEO_OFF(영상만 투명, visibility 는 그대로).
test('in-page keep probes: leaf keep boxes, frame diff with a mask, the keep-shift control and the video-off sheet', async () => {
  const PAGE = 'data:text/html;charset=utf-8,' + encodeURIComponent(`<!doctype html><html><body style="margin:0">
    <section data-enter="keep" style="position:absolute;left:10px;top:10px;width:300px;height:200px">
      <h1 data-enter="keep" style="margin:0;width:200px;height:40px">제목</h1>
      <p data-enter="keep" style="margin:0;width:100px;height:20px"></p>
    </section>
    <div data-enter style="position:absolute;left:350px;top:10px;width:50px;height:50px">숨김 대상</div>
    <div data-enter="keep" style="position:absolute;left:350px;top:100px;width:0;height:0"></div>
    <div data-enter="keep" style="position:absolute;left:10px;top:5000px;width:40px;height:40px">화면 밖</div>
    <video style="position:absolute;left:0;top:300px;width:100px;height:50px" data-enter="keep"></video>
  </body></html>`)
  const chrome = await startChrome(['--hide-scrollbars'], { prefix: 'ssr-keep-' })
  try {
    const { ws, send, ev } = await connect(chrome.wsUrl)
    await send('Page.enable'); await send('Runtime.enable')
    await navigateAndWait(send, ev, PAGE, { timeoutMs: 20000 })
    // KEEP_RECTS: section 은 안쪽 keep(h1·p)을 품어 빠진다. 폭 0 · 화면 밖(아래로 잘려 높이 0)도 빠진다. 영상 keep 은 남는다.
    const rects = await ev(KEEP_RECTS)
    assert.deepEqual(rects.map((r) => [Math.round(r.left), Math.round(r.top), r.text > 0]), [[10, 10, true], [10, 50, false], [0, 300, false]])
    // KEEPPIX: 같은 프레임은 0, 사각형이 옮겨 간 프레임은 크게 다르다, 숨김 대상 상자로 가리면 그 점은 세지 않는다.
    const [a, b] = await ev(`(() => { const mk = (y) => { const c = document.createElement('canvas'); c.width = 1440; c.height = 900; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 1440, 900); x.fillStyle = '#000'; x.fillRect(100, y, 300, 60); return c.toDataURL('image/jpeg', 0.9).split(',')[1] }; return [mk(100), mk(400)] })()`)
    const box = [{ left: 50, top: 50, right: 500, bottom: 500 }]
    const plain = await ev(KEEPPIX([a, a, b], box, []))
    assert.equal(plain[0].boxes[0].changed, 0)
    assert.ok(plain[1].boxes[0].changed > 8000, `옮긴 사각형 두 자리 ≈ 9000점: ${plain[1].boxes[0].changed}`)
    assert.ok(plain[1].boxes[0].content > 40000)
    assert.ok(plain[0].boxes[0].ink > 4000 && plain[0].boxes[0].ink < 5000, `검은 사각형 300×60 ÷ 격자 4 ≈ 4500점이 ink: ${plain[0].boxes[0].ink}`)
    const masked = await ev(KEEPPIX([a, b], box, [{ left: 90, top: 90, right: 410, bottom: 170 }, { left: 90, top: 390, right: 410, bottom: 470 }]))
    assert.ok(masked[0].boxes[0].changed < 100, `숨김 대상 상자로 가린 자리는 세지 않는다: ${masked[0].boxes[0].changed}`)
    // KEEP_SHIFT: data-wf-t0 가 붙는 순간 글이 있는 keep 전부(여기서는 제목 h1 과 화면 밖 div — 글 없는 p·영상은 뺀다)를 옮기고 지운다.
    await ev(KEEP_SHIFT)
    await ev(`document.body.appendChild(Object.assign(document.createElement('i'), { })).setAttribute('data-wf-t0', '1')`)
    await ev('new Promise((r) => setTimeout(r, 50))')
    assert.equal(await ev(`document.querySelector('[data-wf-shift]')?.tagName`), 'H1')
    assert.equal(await ev(`getComputedStyle(document.querySelector('[data-wf-shift]')).opacity`), '0')
    assert.equal(await ev(`document.querySelectorAll('[data-wf-shift]').length`), 2, '글이 있는 keep 둘(제목 h1·화면 밖 div) — 글 없는 p·영상은 뺀다')
    assert.equal((await ev(KEEP_RECTS)).findIndex((r) => r.shift), 0)
    // VIDEO_OFF: 영상만 투명 — keep 보임 탐침이 읽는 visibility 는 그대로.
    await ev(VIDEO_OFF)
    assert.equal(await ev(`getComputedStyle(document.querySelector('video')).opacity`), '0')
    assert.equal(await ev(`getComputedStyle(document.querySelector('video')).visibility`), 'visible')
    assert.equal(await ev(`getComputedStyle(document.querySelector('p')).opacity`), '1', '영상 밖의 요소는 그대로')
    ws.close()
  } finally {
    await chrome.close()
  }
})
