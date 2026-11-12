// 비교 대시보드 단위 시험(v0.2.6 T2·T3) — 브라우저 없음. 중계(proxy.mjs)는 가짜 상위 서버 위에서, 페이지(compare-page.mjs)·bridge 는 문자열로 본다.
// Chrome 으로 실제 iframe 을 움직이는 시험은 compare.behavior.test.mjs.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import net from 'node:net'
import { randomBytes, createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { startProxy, BRIDGE_TAG, rewriteCsp } from './proxy.mjs'
import { renderComparePage, pageCsp } from './compare-page.mjs'
import { bridgeSourceFor, ORIGIN_PLACEHOLDER } from './bridge-source.mjs'

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

// ── 페이지 · bridge (T3) ──
const O = { a: 'http://127.0.0.1:41001', b: 'http://127.0.0.1:41002', c: 'http://127.0.0.1:41003' }
const cand = (id, extra = {}) => ({
  id, name: `${id.toUpperCase()} · 시안`, kind: '추첨이 고른 안', origin: O[id],
  head: { thesis: '한 줄 주장', palette: ['#13234a', '#c9a24a', 'javascript:alert(1)'], fonts: 'Hahmlet · Pretendard', colorStrategy: 'K1' },
  badges: { aiTell: 0, qualityN: 1, inputN: 2, routesOpen: 5, routesTotal: 5 },
  blockers: { quality: ['관문 실패'], input: ['사업자 정보 확인 필요'] },
  row: { msg: `${id} 문장`, act: `${id} 행동`, sig: '', logo: '', risk: '' },
  ...extra,
})
const DATA = {
  run: '청춘', title: '솔결재 · 시안 3개 비교', briefLine: '대상: 운영자',
  routes: [{ path: '/', label: '홈' }, { path: '/pricing', label: '요금' }, { path: '/about', label: '소개' }],
  candidates: [cand('a'), cand('b'), cand('c')], scaleNote: true,
}

test('페이지: 폭·쪽·보기 단추와 칸 셋, 후보 출처+첫 쪽 주소의 iframe, 값 있는 비교표 행만, 확인창이 있다 · 외부 주소·style 속성은 0', () => {
  const html = renderComparePage(DATA)
  for (const w of [1440, 768, 390]) assert.match(html, new RegExp(`data-w="${w}"`))
  assert.equal((html.match(/data-p="/g) ?? []).length, 3)
  assert.equal((html.match(/data-l="/g) ?? []).length, 2)
  assert.match(html, /id="sync"/); assert.match(html, /data-scale/); assert.match(html, /<dialog id="dlg"/)
  for (const id of ['a', 'b', 'c']) {
    assert.match(html, new RegExp(`id="col-${id}"`))
    assert.ok(html.includes(`src="${O[id]}/"`), `iframe src ${id}`)
  }
  assert.equal((html.match(/<tr>/g) ?? []).length, 3, '머리 줄 하나 + 값 있는 행 둘')
  assert.match(html, /첫 화면 문장/); assert.match(html, /주 행동/); assert.ok(!html.includes('기억에 남는 동작'), '값이 하나도 없는 행은 숨긴다')
  assert.ok(!html.includes('https://'), '외부 요청 0'); assert.ok(!/ style=/.test(html), 'style 속성 0 — CSP 해시로 닫는다')
  assert.ok(!html.includes('javascript:'), '색 값이 아닌 것은 칩이 되지 않는다')
})

test('페이지: 후보가 준 글은 모두 이스케이프되고, 사이트를 못 띄운 후보는 iframe 대신 사진과 배지를 낸다 · CSP 해시는 인라인 script·style 그대로의 값이다', () => {
  const html = renderComparePage({ ...DATA, candidates: [cand('a', { name: '<img src=x onerror=alert(1)>', head: { thesis: '</script><b>', palette: [] } }), cand('b', { origin: undefined, fallbackImg: 'img/b.png' }), cand('c')] })
  assert.ok(!html.includes('<img src=x'), '이름 이스케이프'); assert.ok(!html.includes('</script><b>'), '스크립트 탈출 없음')
  const data = html.match(/<script type="application\/json" id="cmp-data">([\s\S]*?)<\/script>/)[1]
  assert.deepEqual(JSON.parse(data).candidates.map((c) => c.origin), [O.a, null, O.c])
  const col = html.match(/<section class="col" id="col-b"[\s\S]*?<\/section>/)[0]
  assert.ok(!col.includes('<iframe') && col.includes('src="img/b.png"') && col.includes('실사이트 못 띄움'))
  const csp = pageCsp(html, [O.a, O.c])
  const h = (s) => `'sha256-${createHash('sha256').update(s, 'utf8').digest('base64')}'`
  assert.ok(csp.includes(`script-src ${h(html.match(/<script>([\s\S]*?)<\/script>/)[1])}`) && csp.includes(`style-src ${h(html.match(/<style>([\s\S]*?)<\/style>/)[1])}`))
  assert.match(csp, new RegExp(`frame-src ${O.a} ${O.c}; `)); assert.match(csp, /frame-ancestors 'none'/); assert.ok(!csp.includes("'unsafe-inline'"))
  assert.throws(() => renderComparePage({ ...DATA, candidates: [cand('a', { origin: 'http://evil.example' })] }), /127\.0\.0\.1/)
})

test('bridge: 대시보드 출처가 박히고(127.0.0.1 만) 자리표시자는 남지 않는다 · bridge.js 와 page-client.js 는 문법이 맞다', () => {
  const src = bridgeSourceFor('http://127.0.0.1:53211')
  assert.ok(src.includes('const DASH = "http://127.0.0.1:53211"') && !src.includes(ORIGIN_PLACEHOLDER))
  assert.throws(() => bridgeSourceFor('http://localhost:53211'), /127\.0\.0\.1/)
  assert.throws(() => bridgeSourceFor('*'), /127\.0\.0\.1/)
  assert.doesNotMatch(src, /postMessage\([^)]*'\*'/, "targetOrigin 은 '*' 가 아니다")
  new vm.Script(src, { filename: 'bridge.js' })
  new vm.Script(readFileSync(new URL('./page-client.js', import.meta.url), 'utf8'), { filename: 'page-client.js' })
})
