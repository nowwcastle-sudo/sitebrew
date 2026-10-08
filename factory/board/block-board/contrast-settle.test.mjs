// 대비 측정기가 블록의 정지 상태를 기다리는가(CFLAKE — hero/baseline-news-app-window 의 1.4초 뒤 자동 선택 전환이 표본에 걸려 6.99·1 이 나왔다).
// 실제 Chrome 한 개로 measureContrast 를 직접 부른다(가짜 서버 픽스처). 실행: node --test --test-force-exit --test-timeout=400000 factory/board/block-board/contrast-settle.test.mjs
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { openSession } from './page.mjs'
import { navigateAndWait } from '../../qa/cdp.mjs'
import { measureContrast, BUSY } from './checks.mjs'

const ROOT = '[data-qa-block] [data-block]'
const TEXT = '이 문단은 대비를 재기 위한 스무 글자가 넘는 시험 글입니다. 바탕은 흰색입니다.'
// go() 가 전환을 시작한다 — 시험이 go() 를 부른 바로 뒤에 재기 시작하면 표본 도중에 전환이 돈다(블록의 1.4초 뒤 자동 선택과 같은 모양).
const page = (body, { css = '', js = '' } = {}) => `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;background:#fff;color:#000}${css}</style></head><body><div data-qa-block="b" data-qa-ready><section data-block="x">${body}</section></div><script>${js}</script></body></html>`
const PAGES = {
  // ① 글자색 CSS 전환(흰 → 검정 900ms): 중간에 재면 연한 회색 글자 대 흰 바탕이라 실패, 끝난 뒤에 재면 검정 대 흰색 21 로 통과.
  fadeIn: page(`<p id="t" style="color:#fff;transition:color 900ms linear">${TEXT}</p>`, { js: "window.go = () => { document.getElementById('t').style.color = '#000' }" }),
  // ① 의 View Transition 판(실제 원인 모양): 문서 전환이 도는 동안 화면은 옛 모습 스냅샷과 새 모습의 겹침이다. 글자는 늘 검정이고 새 모습에서 5px 옆으로 간다 —
  // 글자를 투명하게 한 화면에도 옛 스냅샷의 검은 글자가 비쳐 바탕 표본이 더러워진다(블록의 행 선택 전환과 같은 모양).
  viewTransition: page(`<p id="t" style="margin:20px 0 0 0">${TEXT}</p>`, {
    css: '::view-transition-group(root),::view-transition-old(root),::view-transition-new(root){animation-duration:900ms;animation-timing-function:linear}',
    js: "window.go = () => { document.startViewTransition(() => { document.getElementById('t').style.marginLeft = '5px' }) }",
  }),
  // ② 음성 대조: 정지 상태에서도 대비가 낮은 글(#bbb 대 흰색 ≈ 1.9) + 딴 곳의 400ms 전환. 기다린 뒤에도 실패해야 한다.
  lowAfterSettle: page(`<p style="color:#bbb">${TEXT}</p><div id="d" style="width:20px;height:20px;border:4px solid #fff;transition:border-color 400ms linear"></div>`, { js: "window.go = () => { document.getElementById('d').style.borderColor = '#000' }" }),
  // ③ 무한 애니메이션 + 정지 상태가 좋은 글: 기다리지 않고 통과해야 한다.
  infinite: page(`<p>${TEXT}</p><div style="width:10px;height:10px;background:#000;animation:spin 1s linear infinite"></div>`, { css: '@keyframes spin{to{transform:rotate(1turn)}}' }),
  // ④ 접힌 <details>(GATES2 — nav/top-bar 계정 메뉴): 닫힌 details 의 내용은 그려지지 않는데(::details-content content-visibility hidden) Range 줄 상자는 낡은 자리에 남는다.
  // 그 자리의 바탕 표본이 글자색과 같은 쪽이면 보이지 않는 글자가 대비 실패로 잡혔다(「도움말」 p5 1.81). 안 그려지는 글은 재지 않는다.
  closedDetails: page(`<details><summary style="color:#000">계정 메뉴</summary><p style="color:#bbb">${TEXT}</p></details>`),
  openDetails: page(`<details open><summary style="color:#000">계정 메뉴</summary><p style="color:#bbb">${TEXT}</p></details>`),
  closedLowSummary: page(`<details><summary style="color:#bbb">${TEXT}</summary><p style="color:#000">숨은 내용</p></details>`),
  // ③' 한도를 넘는 유한 전환(8초): 한도(settleMs)에서 멈추고 그 사실을 남긴다. 글은 검정이라 통과.
  longFinite: page(`<p>${TEXT}</p><div id="d" style="width:20px;height:20px;border:4px solid #fff;transition:border-color 8s linear"></div>`, { js: "window.go = () => { document.getElementById('d').style.borderColor = '#000' }" }),
}
let server, origin, s
before(async () => {
  server = createServer((req, res) => { res.setHeader('content-type', 'text/html; charset=utf-8'); res.end(PAGES[req.url.slice(1)] ?? 'no') })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  origin = `http://127.0.0.1:${server.address().port}`
  s = await openSession()
  await s.send('Emulation.setDeviceMetricsOverride', { width: 1000, height: 700, deviceScaleFactor: 1, mobile: false })
})
after(async () => { await s?.close(); server?.close() })

const open = async (name) => { await navigateAndWait(s.send, s.ev, `${origin}/${name}`); await s.ev('document.fonts.ready.then(() => 1)') }
const run = async (name, { trigger = true, ...opts } = {}) => {
  await open(name)
  if (trigger) await s.ev('window.go()')
  const t0 = Date.now()
  const j = await measureContrast(s, ROOT, { height: 700, ...opts })
  return { j, ms: Date.now() - t0 }
}

test('BUSY 양성·음성: 전환이 돌 때만 잡고 무한 애니메이션은 세지 않는다', async () => {
  await open('fadeIn')
  assert.equal((await s.ev(BUSY(ROOT))).n, 0, '아직 아무것도 안 돈다')
  await s.ev('window.go()')
  await new Promise((r) => setTimeout(r, 100))
  const b = await s.ev(BUSY(ROOT))
  assert.ok(b.n >= 1 && b.what.some((x) => x.startsWith('color@')), JSON.stringify(b))
  await open('infinite')
  await new Promise((r) => setTimeout(r, 100))
  assert.equal((await s.ev('document.getAnimations().filter((a) => a.playState === "running").length')) >= 1, true, '무한 애니메이션은 실제로 돈다')
  assert.equal((await s.ev(BUSY(ROOT))).n, 0, '무한 애니메이션은 기다릴 대상이 아니다')
})

test('① 글자색 전환 도중이면 끝날 때까지 기다린 뒤 잰다 — 통과 + 기다린 시간이 남는다', async () => {
  const { j } = await run('fadeIn')
  assert.deepEqual(j.fails, [], JSON.stringify(j))
  assert.ok(j.boxes >= 1)
  assert.ok(j.lowestBody >= 7, `정지 상태 대비 ${j.lowestBody}`)
  assert.ok(j.settle.waitedMs >= 300, `전환이 끝나길 기다렸다: ${j.settle.waitedMs}ms`)
  assert.equal(j.settle.unsettled, 0)
})

test('① View Transition(블록의 실제 원인 모양) 도중이면 기다린 뒤 잰다', async () => {
  const { j } = await run('viewTransition')
  assert.deepEqual(j.fails, [], JSON.stringify(j))
  assert.ok(j.lowestBody >= 7, `정지 상태 대비 ${j.lowestBody}`)
  assert.ok(j.settle.waitedMs >= 300, `전환이 끝나길 기다렸다: ${j.settle.waitedMs}ms`)
  assert.equal(j.settle.unsettled, 0)
})

test('② 음성 대조: 정지 상태에서도 대비가 낮은 글은 기다린 뒤에도 여전히 실패한다', async () => {
  const { j } = await run('lowAfterSettle')
  assert.ok(j.fails.length >= 1 && j.fails.every((f) => /p5 [\d.]+ < 7/.test(f)), JSON.stringify(j.fails))
  assert.ok(j.lowestBody < 7)
  assert.ok(j.settle.waitedMs >= 100, '딴 곳의 전환도 기다렸다')
})

test('② 음성 대조(전환 없음): 같은 글을 기다릴 것 없이 재도 실패한다', async () => {
  const { j } = await run('lowAfterSettle', { trigger: false })
  assert.ok(j.fails.length >= 1, JSON.stringify(j))
  assert.equal(j.settle.waitedMs < 150, true, `기다릴 것이 없다: ${j.settle.waitedMs}ms`)
})

test('③ 무한 애니메이션 위에서 멈추지 않는다 — 기다림 0·한도 안에 끝·통과', async () => {
  const { j, ms } = await run('infinite', { trigger: false })
  assert.deepEqual(j.fails, [], JSON.stringify(j))
  assert.ok(j.settle.waitedMs < 150, `무한 애니메이션을 기다렸다: ${j.settle.waitedMs}ms`)
  assert.equal(j.settle.unsettled, 0)
  assert.ok(ms < 3000, `${ms}ms`)
})

test('③ 한도를 넘는 유한 전환: 한도에서 멈추고 unsettled 에 사실을 남긴다(통과·실패 판정은 그대로)', async () => {
  const { j, ms } = await run('longFinite', { settleMs: 600 })
  assert.deepEqual(j.fails, [], JSON.stringify(j))
  assert.equal(j.settle.unsettled, 1)
  assert.ok(j.settle.still.length >= 1 && /border/.test(j.settle.still.join()), j.settle.still.join())
  assert.ok(j.settle.waitedMs >= 600 && j.settle.waitedMs < 1500, `${j.settle.waitedMs}ms`)
  assert.ok(ms < 5000, `${ms}ms — 8초 전환을 끝까지 기다리지 않았다`)
})

// 픽스처가 정말 그 결함을 재현하는가 — 기다리지 않으면(settleMs 0 = 예전 동작) 같은 화면이 전환 중간 표본으로 실패한다.
for (const name of ['fadeIn', 'viewTransition']) {
  test(`양성 대조: 기다리지 않으면(settleMs 0) ${name} 픽스처는 전환 도중 표본으로 실패한다`, async () => {
    const { j } = await run(name, { settleMs: 0 })
    assert.ok(j.fails.length >= 1, `예전 동작으로도 통과했다 — 픽스처가 결함을 재현하지 못한다: ${JSON.stringify(j)}`)
    assert.ok(j.settle.unsettled >= 1)
  })
}

// ── 접힌 <details> 안 글(GATES2) ───────────────────────────────────────────────────────────────
test('④ 접힌 details 안의 글은 안 그려지므로 재지 않는다(닫힌 메뉴 안 연한 글이 실패로 잡히지 않는다) — 열린 details 의 같은 글은 여전히 실패한다', async () => {
  const closed = (await run('closedDetails', { trigger: false })).j
  assert.deepEqual(closed.fails, [], JSON.stringify(closed))
  assert.ok(closed.boxes >= 1, '요약(summary) 글은 잰다')
  const open = (await run('openDetails', { trigger: false })).j
  assert.ok(open.fails.length >= 1 && open.fails.every((f) => /p5 [\d.]+ < 7/.test(f)), `음성 대조: 열린 details 의 연한 글은 실패해야 한다 ${JSON.stringify(open.fails)}`)
})

test('④ 접힌 details 의 요약(summary) 글은 보이므로 잰다 — 연하면 실패', async () => {
  const { j } = await run('closedLowSummary', { trigger: false })
  assert.ok(j.fails.length >= 1, JSON.stringify(j))
})
