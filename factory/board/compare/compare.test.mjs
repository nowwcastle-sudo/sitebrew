// 비교 대시보드 단위 시험(v0.2.6 T2·T3) — 브라우저 없음. 중계(proxy.mjs)는 가짜 상위 서버 위에서, 페이지(page.mjs)는 문자열로 본다.
// Chrome 으로 실제 iframe 을 움직이는 시험은 compare.behavior.test.mjs.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import net from 'node:net'
import { randomBytes } from 'node:crypto'
import { startProxy, BRIDGE_TAG, rewriteCsp } from './proxy.mjs'

const DASH = 'http://127.0.0.1:45555'
const CSP = "default-src 'self'; script-src 'self' 'sha256-abc='; frame-ancestors 'none'"
const HTML = '<!doctype html><html><head><meta charset="utf-8"><title>한글 제목</title></head><body><h1>청춘</h1></body></html>'
const PNG = randomBytes(2_000_000) // 0x80 이상 바이트가 많이 든다 — 문자열로 바꿔 쓰면 깨진다

let upstream, proxy, base
before(async () => {
  upstream = http.createServer((req, res) => {
    const url = req.url.split('?')[0]
    if (url === '/') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'content-security-policy': CSP, etag: '"v1"' }); res.end(HTML); return }
    if (url === '/chunked') { // </head> 가 청크 사이에 걸린다
      res.writeHead(200, { 'content-type': 'text/html', 'content-security-policy': CSP })
      res.write('<html><head><title>t</title></he'); setTimeout(() => { res.write('ad><body>'); res.end('끝</body></html>') }, 20); return
    }
    if (url === '/nocsp') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(HTML); return }
    if (url === '/multi') { res.setHeader('content-security-policy', ["frame-ancestors 'none'", "default-src 'self'; frame-ancestors 'none'"]); res.writeHead(200, { 'content-type': 'text/html' }); res.end(HTML); return }
    if (url === '/img.png') { res.writeHead(200, { 'content-type': 'image/png', 'content-security-policy': CSP }); res.end(PNG); return }
    if (url === '/go') { res.writeHead(307, { location: '/pricing', 'content-security-policy': CSP }); res.end(); return }
    if (url === '/cached') { res.writeHead(304, { etag: '"v1"' }); res.end(); return }
    if (url === '/echo-encoding') { res.writeHead(200, { 'content-type': 'text/plain' }); res.end(`${req.headers['accept-encoding']}|${req.headers.host}`); return }
    res.writeHead(404, { 'content-type': 'text/plain' }); res.end('없음')
  })
  await new Promise((r) => upstream.listen(0, '127.0.0.1', r))
  proxy = await startProxy({ upstreamPort: upstream.address().port, dashboardOrigin: DASH, bridgeSource: 'window.__bridge = 1' })
  base = proxy.origin
})
after(async () => { await proxy.close(); upstream.closeAllConnections(); await new Promise((r) => upstream.close(r)) })

test('중계 HTML: frame-ancestors 만 대시보드 출처로 바뀌고(다른 지시문 그대로), bridge 태그가 </head> 앞에 한 번 들어가며, content-length 가 새 본문과 맞는다', async () => {
  const r = await fetch(`${base}/`)
  const csp = r.headers.get('content-security-policy')
  assert.equal(csp, `default-src 'self'; script-src 'self' 'sha256-abc='; frame-ancestors ${DASH}`)
  assert.ok(!csp.includes("'none'"))
  const body = await r.text()
  assert.equal(body, HTML.replace('</head>', `${BRIDGE_TAG}</head>`), '한글 본문은 그대로 있고 태그 하나만 더해진다')
  assert.equal((body.match(/__sitebrew\/bridge\.js/g) ?? []).length, 1)
  assert.equal(Number(r.headers.get('content-length')), Buffer.byteLength(body), 'fetch 가 길이 불일치를 오류로 보지만 값도 직접 대조한다')
  assert.equal(r.headers.get('etag'), null, '고친 HTML 에는 옛 검증자를 남기지 않는다')
  assert.equal(r.headers.get('cache-control'), 'no-store')
})

test('중계 HTML: 청크로 오는 응답도 </head> 가 청크 사이에 걸려 있어도 고친다 · 헤더가 여러 줄이어도 모두 고친다 · CSP 가 없으면 만들지 않는다', async () => {
  const chunked = await (await fetch(`${base}/chunked`)).text()
  assert.equal(chunked, `<html><head><title>t</title>${BRIDGE_TAG}</head><body>끝</body></html>`)
  const multi = await fetch(`${base}/multi`)
  const csp = multi.headers.get('content-security-policy')
  assert.ok(!csp.includes("'none'") && csp.split(`frame-ancestors ${DASH}`).length === 3, `두 줄 모두 바뀐다: ${csp}`)
  const none = await fetch(`${base}/nocsp`)
  assert.equal(none.headers.get('content-security-policy'), null)
  assert.match(await none.text(), /bridge\.js/)
})

test('중계 비 HTML: 큰 PNG 는 바이트까지 같고(본문 손대지 않음, bridge 태그 없음) CSP 헤더만 고쳐진다', async () => {
  const r = await fetch(`${base}/img.png`)
  const bytes = Buffer.from(await r.arrayBuffer())
  assert.equal(bytes.length, PNG.length)
  assert.ok(bytes.equals(PNG))
  assert.match(r.headers.get('content-security-policy'), new RegExp(`frame-ancestors ${DASH}`))
})

test('중계 본문 없는 응답: HEAD 는 본문 없이 CSP 만 고쳐지고, 304 와 리다이렉트(상대 Location)는 그대로 흐른다', async () => {
  const head = await fetch(`${base}/`, { method: 'HEAD' })
  assert.equal(head.status, 200); assert.equal(await head.text(), '')
  assert.match(head.headers.get('content-security-policy'), new RegExp(`frame-ancestors ${DASH}`))
  const cached = await fetch(`${base}/cached`, { headers: { 'if-none-match': '"v1"' } })
  assert.equal(cached.status, 304); assert.equal(cached.headers.get('etag'), '"v1"')
  const go = await fetch(`${base}/go`, { redirect: 'manual' })
  assert.equal(go.status, 307); assert.equal(go.headers.get('location'), '/pricing')
})

test('중계 요청: 압축은 끄고(identity) Host 는 그대로 넘기며, bridge.js 는 중계가 직접 답한다 · 상위가 죽으면 502', async () => {
  const echoed = await (await fetch(`${base}/echo-encoding`, { headers: { 'accept-encoding': 'gzip, br' } })).text()
  assert.equal(echoed, `identity|127.0.0.1:${proxy.port}`)
  const br = await fetch(`${base}/__sitebrew/bridge.js`)
  assert.equal(br.status, 200); assert.match(br.headers.get('content-type'), /^text\/javascript/); assert.equal(await br.text(), 'window.__bridge = 1')
  const dead = await startProxy({ upstreamPort: 9, dashboardOrigin: DASH, bridgeSource: '' }) // 9 번 포트는 비어 있다
  try { assert.equal((await fetch(`${dead.origin}/`)).status, 502) } finally { await dead.close() }
})

test('중계 close(): 포트가 닫히고 다시 연결할 수 없다 · rewriteCsp 는 지시문이 없는 값을 건드리지 않는다', async () => {
  assert.equal(rewriteCsp("default-src 'self'", DASH), "default-src 'self'")
  const p = await startProxy({ upstreamPort: upstream.address().port, dashboardOrigin: DASH, bridgeSource: '' })
  assert.equal((await fetch(`${p.origin}/nocsp`)).status, 200)
  await p.close()
  await assert.rejects(new Promise((res, rej) => { const s = net.connect(p.port, '127.0.0.1', () => { s.destroy(); res() }); s.on('error', rej) }), /ECONNREFUSED/)
})
