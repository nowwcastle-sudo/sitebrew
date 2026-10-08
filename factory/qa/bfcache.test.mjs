// bf-cache 복원 시험(factory v1 Task 5.10) — 진짜 Chrome 이 뒤로 가기 캐시에서 쪽을 되살리는지, 못 되살리면 이유가 무엇인지(CDP Page.backForwardCacheNotUsed).
//   · reasonsOf 는 순수 — 브라우저 없이.
//   · measureBfCache 는 작은 node http 서버 위의 픽스처 쪽 셋을 연다: 아무것도 막지 않는 쪽(복원됨) · unload 처리기(복원 안 됨, 이유 Unload…) · 첫 칠 뒤 지연 스크립트 로더(찍어낸 사이트의 모양 — 복원됨).
// 실행: node --test --test-force-exit --test-timeout=240000 factory/qa/bfcache.test.mjs   (Chrome 을 쓴다 — ci/tests-heavy.txt)
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import os from 'node:os'
import { closeChrome, startChrome } from './cdp.mjs'
import { measureBfCache, reasonsOf } from './bfcache.mjs'

// 기계가 붐비면(CPU 사용 40% 넘음 · 여유 메모리 3 GB 미만) Chrome 이 쪽을 제때 못 얼려 `TimeoutPuttingInCache`·`NavigationCancelledWhileRestoring` 로 복원이 안 될 수 있다 — 쪽 탓이 아니라(이유 형이 Circumstantial) 부하 탓이다
// (실측: 같은 픽스처가 한가한 때는 3/3 복원, 다른 레인이 CPU 를 60~85% 쓰는 때는 1/3). 그래서 「복원된다」는 긍정 주장은 한가한 때만 걸고, 「쪽이 고쳐야 하는 이유(PageSupportNeeded 등)가 나오지 않는다」는 부정 주장은 늘 건다.
async function isQuiet() {
  const snap = () => os.cpus().map((c) => c.times)
  const a = snap()
  await new Promise((r) => setTimeout(r, 600))
  const b = snap()
  let busy = 0
  let total = 0
  b.forEach((t, i) => { const d = (k) => t[k] - a[i][k]; const all = d('user') + d('nice') + d('sys') + d('idle') + d('irq'); busy += all - d('idle'); total += all })
  return os.freemem() > 3 * 2 ** 30 && busy / total < 0.4
}
const quiet = await isQuiet()

test('reasonsOf: 이벤트의 이유를 평평하게 펴고 같은 이유는 한 번만', () => {
  const r = reasonsOf({
    notRestoredExplanations: [{ type: 'PageSupportNeeded', reason: 'UnloadHandlerExistsInMainFrame' }],
    notRestoredExplanationsTree: { url: 'x', explanations: [{ type: 'PageSupportNeeded', reason: 'UnloadHandlerExistsInMainFrame' }], children: [{ url: 'y', explanations: [{ type: 'Circumstantial', reason: 'MainResourceHasCacheControlNoStore', context: 'iframe' }], children: [] }] },
  })
  assert.deepEqual(r.map((x) => x.reason), ['UnloadHandlerExistsInMainFrame', 'MainResourceHasCacheControlNoStore'])
  assert.deepEqual(reasonsOf(undefined), [])
})

const PAGE = (head = '', body = '<h1>픽스처</h1><a href="/other">다른 쪽</a>') => `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>t</title>${head}</head><body>${body}</body></html>`
// 찍어낸 사이트의 하이드레이션 로더와 같은 모양: 첫 칠(first-contentful-paint) 뒤 한 틱에 스크립트를 head 에 붙이고, 4초 안전장치 타이머를 둔다.
const DEFER = `<script>(function(L){var d=document,t=0;function go(){if(t)return;t=1;for(var i=0;i<L.length;i++){var s=d.createElement("script");s.src=L[i];s.async=!0;d.head.appendChild(s)}}try{new PerformanceObserver(function(l,o){if(l.getEntriesByName("first-contentful-paint").length){o.disconnect();setTimeout(go)}}).observe({type:"paint",buffered:!0})}catch(e){addEventListener("load",go)}setTimeout(go,4e3)})(["/boot.js"])</script>`

let server
let origin
before(async () => {
  server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x')
    const send = (type, body, extra = {}) => { res.writeHead(200, { 'content-type': type, ...extra }); res.end(body) }
    if (u.pathname === '/good') return send('text/html; charset=utf-8', PAGE())
    if (u.pathname === '/unload') return send('text/html; charset=utf-8', PAGE('<script>addEventListener("unload", function(){})</script>'))
    if (u.pathname === '/deferred') return send('text/html; charset=utf-8', PAGE('', '<h1>지연 로더</h1>' + DEFER))
    if (u.pathname === '/boot.js') return send('text/javascript', 'window.__booted = (window.__booted || 0) + 1')
    res.writeHead(404); res.end('no')
  })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  origin = `http://127.0.0.1:${server.address().port}`
})
after(() => new Promise((r) => server.close(r)))

test('measureBfCache: 아무것도 막지 않는 쪽은 복원된다(표지가 그대로)', { timeout: 120_000 }, async () => {
  const chrome = await startChrome([], { prefix: 'bfcache-test-' })
  try {
    // 기계가 붐비면 Chrome 이 쪽을 제때 못 얼려 한 번 실패할 수 있다(Circumstantial) — 세 번 안에 복원되면 된다.
    let r
    for (let i = 0; i < 3; i++) {
      r = await measureBfCache(`${origin}/good`, { chrome })
      if (r.restored) break
      assert.ok(r.reasons.every((x) => x.type === 'Circumstantial'), JSON.stringify(r.reasons))
    }
    if (quiet) { assert.equal(r.restored, true, JSON.stringify(r)); assert.deepEqual(r.reasons, []) }
  } finally { await closeChrome(chrome) }
})

test('measureBfCache: unload 처리기가 있는 쪽은 복원 안 되고 Chrome 이 이유를 Unload… 로 알려 준다', { timeout: 120_000 }, async () => {
  const chrome = await startChrome([], { prefix: 'bfcache-test-' })
  try {
    const r = await measureBfCache(`${origin}/unload`, { chrome })
    assert.equal(r.restored, false, JSON.stringify(r))
    assert.ok(r.reasons.some((x) => /Unload/i.test(x.reason)), JSON.stringify(r.reasons))
  } finally { await closeChrome(chrome) }
})

test('measureBfCache: 첫 칠 뒤 지연 스크립트 로더(찍어낸 사이트의 모양)는 쪽이 고쳐야 하는 이유를 한 번도 안 낸다 — 한가한 때는 세 번 중 두 번 이상 복원된다', { timeout: 240_000 }, async () => {
  const chrome = await startChrome([], { prefix: 'bfcache-test-' })
  try {
    let restored = 0
    for (let i = 0; i < 3; i++) {
      const r = await measureBfCache(`${origin}/deferred`, { chrome })
      if (r.restored) restored++
      assert.ok(r.reasons.every((x) => x.type === 'Circumstantial'), `${i + 1}번째: 쪽이 고쳐야 하는 이유 ${JSON.stringify(r.reasons)}`)
    }
    if (quiet) assert.ok(restored >= 2, `3번 중 ${restored}번 복원`)
  } finally { await closeChrome(chrome) }
})

test('bfCacheProbeDefault(ops-gate 의 직접 확인): unload 처리기가 있는 쪽은 ok 아님·0번 복원·이유를 돌려주고, 막지 않는 쪽은 쪽이 고쳐야 하는 이유가 없다(한가한 때는 ok)', { timeout: 240_000 }, async () => {
  const { bfCacheProbeDefault } = await import('./ops-gate.mjs')
  const chrome = await startChrome([], { prefix: 'bfcache-test-' })
  try {
    const bad = await bfCacheProbeDefault(`${origin}/unload`, { tries: 2, chrome })
    assert.equal(bad.ok, false, JSON.stringify(bad))
    assert.equal(bad.restored, 0)
    assert.ok(bad.reasons.some((r) => /Unload/i.test(r)), JSON.stringify(bad.reasons))
    const good = await bfCacheProbeDefault(`${origin}/good`, { tries: 5, chrome })
    assert.ok(!good.reasons.some((r) => /Unload|NoStore|WebSocket|BroadcastChannel/i.test(r)), JSON.stringify(good))
    if (quiet) { assert.equal(good.ok, true, JSON.stringify(good)); assert.ok(good.restored >= 2) }
  } finally { await closeChrome(chrome) }
})
