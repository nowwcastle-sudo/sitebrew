// static-server.mjs 시험 — 진짜 임시 폴더를 127.0.0.1 의 빈 포트로 서빙한다(공개 터널 아님).
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, test } from 'node:test'
import { startStaticServer } from './static-server.mjs'

const root = mkdtempSync(join(tmpdir(), 'wf-static-'))
const out = join(root, 'out')
let srv
const get = (path, init) => fetch(`http://127.0.0.1:${srv.port}${path}`, { redirect: 'manual', ...init })

before(async () => {
  mkdirSync(join(out, '_next', 'static'), { recursive: true })
  mkdirSync(join(out, 'about'), { recursive: true })
  mkdirSync(join(out, '한글 폴더'), { recursive: true })
  writeFileSync(join(out, 'index.html'), '<h1>home</h1>')
  writeFileSync(join(out, 'pricing.html'), '<h1>pricing</h1>')
  writeFileSync(join(out, 'about', 'index.html'), '<h1>about</h1>')
  writeFileSync(join(out, '404.html'), '<h1>missing</h1>')
  writeFileSync(join(out, '_next', 'static', 'app.js'), 'console.log(1)')
  writeFileSync(join(out, '한글 폴더', 'a b.txt'), 'hello')
  writeFileSync(join(root, 'secret.txt'), 'top secret')
  srv = await startStaticServer(out)
})
after(async () => { await srv.stop(); rmSync(root, { recursive: true, force: true }) })

test('/ 는 index.html, /pricing 은 pricing.html, /about 과 /about/ 는 about/index.html', async () => {
  assert.equal(await (await get('/')).text(), '<h1>home</h1>')
  assert.equal(await (await get('/pricing')).text(), '<h1>pricing</h1>')
  assert.equal(await (await get('/about')).text(), '<h1>about</h1>')
  assert.equal(await (await get('/about/')).text(), '<h1>about</h1>')
})

test('쿼리는 무시하고, 확장자로 content-type 을 정한다', async () => {
  const html = await get('/?utm=1')
  assert.equal(html.status, 200)
  assert.match(html.headers.get('content-type'), /^text\/html/)
  assert.match((await get('/_next/static/app.js')).headers.get('content-type'), /javascript/)
})

test('퍼센트 인코딩된 한글·공백 경로도 읽는다', async () => {
  assert.equal(await (await get(`/${encodeURIComponent('한글 폴더')}/${encodeURIComponent('a b.txt')}`)).text(), 'hello')
})

test('없는 경로는 404.html 내용으로 404 를 낸다', async () => {
  const r = await get('/nope')
  assert.equal(r.status, 404)
  assert.equal(await r.text(), '<h1>missing</h1>')
})

test('폴더 밖으로 나가는 경로는 막는다(.. 와 인코딩된 ..)', async () => {
  for (const p of ['/../secret.txt', '/%2e%2e/secret.txt', '/..%2fsecret.txt', '/_next/../../secret.txt']) {
    const r = await get(p)
    assert.notEqual(r.status, 200, p)
    assert.doesNotMatch(await r.text(), /top secret/, p)
  }
})

test('GET·HEAD 만 받는다', async () => {
  assert.equal((await get('/', { method: 'POST' })).status, 405)
  const head = await get('/', { method: 'HEAD' })
  assert.equal(head.status, 200)
  assert.equal(await head.text(), '')
})

test('127.0.0.1 에만 바인딩하고, stop 뒤에는 연결이 안 된다', async () => {
  const s = await startStaticServer(out)
  assert.ok(Number.isInteger(s.port) && s.port > 0)
  assert.ok(Number.isInteger(s.pid))
  assert.equal((await fetch(`http://127.0.0.1:${s.port}/`)).status, 200)
  await s.stop()
  await assert.rejects(fetch(`http://127.0.0.1:${s.port}/`))
})
