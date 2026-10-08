// REL12 5a — 하이드레이션 전(스크립트 없음) 제출: 비밀번호 칸이 든 폼 블록의 서버 렌더 HTML 을 스크립트 없이 진짜 Chrome 에 열고
// 진짜 마우스로 제출 단추를 누른다. 고친 뒤: POST — 주소에 쿼리가 없고 비밀번호는 요청 본문에만 있다.
// 양성 대조: 같은 HTML 에서 method="post" 만 지우면(=예전 마크업) GET 이 되어 비밀번호가 주소 쿼리로 나간다 — 시험이 그것을 잡는지 본다.
// 서버 없이 도는 시험이다(노드 http 서버 하나). 실행: node --test --test-force-exit --test-timeout=300000 factory/qa/rel12-browser.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { startChrome, connect, navigateAndWait, closeChrome } from './cdp.mjs'
import { h, html, load } from '../scripts/lib/base-compare.mjs'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const SECRET = 'Zq9-never-in-url-7731'
const EMAIL = 'someone@example.com'
const pascal = (s) => s.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join('')

async function pageHtml(kind, variant, props = {}) {
  const mod = await load(`registry/factory/blocks/${kind}/${variant}.tsx`)
  const fx = await load(`registry/factory/blocks/${kind}/${variant}.fixture.ts`)
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>t</title></head><body>${html(h(mod[pascal(kind) + pascal(variant)], { ...fx.fixture, ...props }))}</body></html>`
}

async function withServer(pages) {
  const log = []
  const server = createServer((req, res) => {
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => {
      if (req.url !== '/favicon.ico') log.push({ method: req.method, url: req.url, body }) // Chrome 이 따로 묻는 파비콘은 기록하지 않는다
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      res.end(req.method === 'GET' && pages[req.url.split('?')[0]] ? pages[req.url.split('?')[0]] : '<!doctype html><title>received</title><p>received</p>')
    })
  })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  return { log, port: server.address().port, close: () => new Promise((r) => server.close(r)) }
}

/** 비밀번호 칸이 든 첫 폼을 채우고 그 폼의 제출 단추를 진짜 마우스로 누른다 → 마지막 요청 */
async function submitWithoutScripts(s, port, path) {
  await navigateAndWait(s.send, s.ev, `http://127.0.0.1:${port}${path}`, { timeoutMs: 60000 })
  const placed = await s.ev(`(() => {
    const pw = [...document.querySelectorAll('input[type=password]')]
    if (!pw.length) return null
    const form = pw[0].closest('form')
    for (const i of form.querySelectorAll('input')) {
      if (i.type === 'password') i.value = ${JSON.stringify(SECRET)}
      else if (i.type === 'email' || /email/i.test(i.name)) i.value = ${JSON.stringify(EMAIL)}
      else if (i.type === 'text' && !i.value) i.value = 'abc'
    }
    const btn = form.querySelector('button[type=submit], input[type=submit]')
    if (!btn) return null
    btn.scrollIntoView({ block: 'center' })
    const r = btn.getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, forms: document.forms.length, method: form.getAttribute('method') }
  })()`)
  assert.ok(placed, '비밀번호 칸과 제출 단추가 있는 폼이 서버 HTML 에 있어야 한다')
  for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) {
    await s.send('Input.dispatchMouseEvent', { type, x: placed.x, y: placed.y, button: type === 'mouseMoved' ? 'none' : 'left', buttons: type === 'mousePressed' ? 1 : 0, clickCount: type === 'mouseMoved' ? 0 : 1 })
  }
  await sleep(1200)
  return placed
}

async function withChrome(fn) {
  const chrome = await startChrome(['--hide-scrollbars'], { prefix: 'rel12b-' })
  try {
    const { ws, send, ev } = await connect(chrome.wsUrl)
    await send('Page.enable'); await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1024, height: 900, deviceScaleFactor: 1, mobile: false })
    try { return await fn({ send, ev }) } finally { ws.close() }
  } finally {
    await closeChrome(chrome)
  }
}

const CASES = [
  ['auth', 'sign-in'],
  ['auth', 'sign-up-consents'],
  ['auth', 'new-password'],
]

for (const [kind, variant] of CASES) {
  test(`REL12 5a ${kind}/${variant}: 스크립트 없이 제출하면 POST — 비밀번호가 주소에 나가지 않는다 (양성 대조: method 를 지운 예전 마크업은 GET 으로 나간다)`, { timeout: 300000 }, async () => {
    const good = await pageHtml(kind, variant, kind === 'auth' && variant === 'new-password' ? { token: 'tok_123' } : {})
    const old = good.replace(/ method="post"/g, '')
    assert.notEqual(old, good, '예전 마크업 사본은 method 가 지워져 있어야 한다')
    const srv = await withServer({ '/good': good, '/old': old })
    try {
      await withChrome(async (s) => {
        const before = srv.log.length
        const placed = await submitWithoutScripts(s, srv.port, '/good')
        const after = srv.log.slice(before + 1) // 첫 요청은 쪽 열기(GET /good)
        console.log(`  ${kind}/${variant} 제출:`, JSON.stringify(after.map((r) => ({ m: r.method, u: r.url, bodyHasSecret: r.body.includes(SECRET) }))), 'method 속성', placed.method)
        assert.equal(placed.method, 'post')
        assert.equal(after.length, 1, '제출 요청이 한 번 나가야 한다')
        assert.equal(after[0].method, 'POST')
        assert.ok(!after[0].url.includes('?') && !after[0].url.includes(SECRET) && !after[0].url.includes(encodeURIComponent(EMAIL)), `주소에 쿼리·비밀번호·이메일이 없다: ${after[0].url}`)
        assert.ok(after[0].body.includes(SECRET), '비밀번호는 본문으로 갔다(양성 대조 — 제출이 실제로 일어났다)')
        // 양성 대조: 예전 마크업
        const b2 = srv.log.length
        await submitWithoutScripts(s, srv.port, '/old')
        const leaked = srv.log.slice(b2 + 1)
        assert.equal(leaked.length, 1)
        assert.equal(leaked[0].method, 'GET')
        assert.ok(leaked[0].url.includes(encodeURIComponent(SECRET)) || leaked[0].url.includes(SECRET), `예전 마크업은 비밀번호가 주소에 실린다(시험이 잡는 결함): ${leaked[0].url}`)
      })
    } finally {
      await srv.close()
    }
  })
}
