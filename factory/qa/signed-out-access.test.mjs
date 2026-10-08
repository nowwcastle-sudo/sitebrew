// 비로그인 접근 화면 관문(UXGATE1 · G13) — 순수 판정 + 고정 시험 서버(Chrome, 자식 프로세스를 비동기로 돌린다).
// 실행: node --test --test-force-exit --test-timeout=300000 factory/qa/signed-out-access.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runTool } from './fixtures/run-tool.mjs'
import { judgePage, parseArgs, signInTarget, summarize } from './signed-out-access.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const O = 'http://app.test'
const facts = (over) => ({ finalUrl: `${O}/account`, status: 200, links: [], textLength: 200, linkCount: 1, ...over })

// ── 순수 ────────────────────────────────────────────────────────────────────────────────────────────────
test('순수: 로그인 주소 판정 — /login·/sign-in·/auth 와 next·returnTo 를 본다(다른 경로·다른 이름은 아니다)', () => {
  assert.deepEqual(signInTarget('/login?next=%2Faccount', O), { signIn: true, param: 'next', value: '/account' })
  assert.deepEqual(signInTarget('/sign-in?returnTo=/upgrade', O), { signIn: true, param: 'returnTo', value: '/upgrade' })
  assert.deepEqual(signInTarget('/login', O), { signIn: true, param: null, value: null })
  assert.deepEqual(signInTarget('/pricing?next=/x', O), { signIn: false, param: null, value: null })
  assert.equal(signInTarget('/author', O).signIn, false)
  assert.equal(signInTarget('/login?redirect=/x', O).param, null) // 기본은 두 이름만 — --params 로 늘린다
  assert.equal(signInTarget('/login?redirect=/x', O, { params: ['redirect'] }).param, 'redirect')
  assert.equal(signInTarget('mailto:a@b.c', O).signIn, false)
})

test('순수: 판정 — 링크+next 통과 · 리다이렉트+returnTo 통과 · 링크만 있고 파라미터 없음 실패 · 링크 없음 실패 · 빈 쪽 · 404', () => {
  const link = judgePage('/account', O, facts({ links: ['/pricing', '/login?next=%2Faccount'] }))
  assert.equal(link.pass, true)
  assert.equal(link.via, 'link')
  assert.equal(link.returnToMatches, true)
  const redirect = judgePage('/billing', O, facts({ finalUrl: `${O}/login?returnTo=%2Fbilling`, links: [] }))
  assert.equal(redirect.pass, true)
  assert.equal(redirect.via, 'redirect')
  assert.equal(judgePage('/upgrade', O, facts({ links: ['/login'] })).fails[0].split(':')[0], 'no-return-param')
  assert.equal(judgePage('/x', O, facts({ links: ['/pricing'] })).fails[0].split(':')[0], 'no-signin-link')
  const empty = judgePage('/e', O, facts({ textLength: 0, linkCount: 0 }))
  assert.deepEqual(empty.fails.map((f) => f.split(':')[0]), ['empty-page', 'no-signin-link'])
  assert.ok(judgePage('/gone', O, facts({ status: 404, links: ['/login?next=/gone'] })).fails.some((f) => f.startsWith('http-error')))
  assert.equal(judgePage('/p', O, facts({ status: 401, links: ['/login?next=/p'] })).pass, true) // 401 안내 화면은 ①②를 채우면 통과
  // returnTo 가 다른 쪽을 가리키면 실패가 아니라 정보
  const other = judgePage('/account', O, facts({ links: ['/login?next=%2Fhome'] }))
  assert.equal(other.pass, true)
  assert.equal(other.returnToMatches, false)
})

test('순수: 인자·요약 — origin·out·paths 가 필요하다, 쪽 0 은 ok 가 아니다', () => {
  assert.throws(() => parseArgs(['--out', 'x', '--paths', '/a']), /origin/)
  assert.throws(() => parseArgs([O, '--paths', '/a']), /--out/)
  assert.throws(() => parseArgs([O, '--out', 'x']), /--paths/)
  assert.throws(() => parseArgs([O, '--out', 'x', '--paths', 'a']), /\/로 시작/)
  assert.deepEqual(parseArgs([O + '/', '--out', 'x', '--paths', '/a,/b']).paths, ['/a', '/b'])
  assert.equal(summarize([]).ok, false)
  assert.equal(summarize([{ pass: true }, { pass: false }]).fail, 1)
})

// ── 시험 서버(Chrome) ───────────────────────────────────────────────────────────────────────────────────
const page = (body) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>t</title></head><body>${body}</body></html>`
const FILL = '<p>This page is part of the account area of the product and needs a signed-in session.</p>'
function startServer() {
  const server = createServer((req, res) => {
    const u = new URL(req.url, 'http://x')
    const signedIn = /wf_session=signed-in/.test(req.headers.cookie ?? '')
    const html = (code, body, extra = {}) => { res.writeHead(code, { 'content-type': 'text/html; charset=utf-8', ...extra }); res.end(page(body)) }
    switch (u.pathname) {
      case '/account': return html(200, `${FILL}<a href="/login?next=%2Faccount">Sign in</a>`)
      case '/upgrade': return html(200, `${FILL}<a href="/login">Sign in</a>`) // 돌아올 곳이 없다
      case '/nolink': return html(200, `${FILL}<a href="/pricing">Pricing</a>`)
      case '/empty': return html(200, '')
      case '/gone': return html(404, `${FILL}<a href="/login?next=%2Fgone">Sign in</a>`)
      case '/billing': res.writeHead(302, { location: '/login?returnTo=%2Fbilling' }); return res.end()
      case '/login': return html(200, '<h1>Sign in</h1><form><input aria-label="Email"></form>')
      // 세션을 읽는 쪽: 로그인 쿠키가 있으면 환영 글, 없으면 로그인 안내 — G13 이 쿠키를 지우고 여는지 본다
      case '/session-aware': return signedIn ? html(200, `${FILL}<p>Welcome back</p><a href="/account">Account</a>`) : html(200, `${FILL}<a href="/login?next=%2Fsession-aware">Sign in</a>`)
      default: return html(404, '')
    }
  })
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ origin: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((r) => server.close(r)) })))
}
const run = (args, env = {}) => runTool(join(here, 'signed-out-access.mjs'), args, { WF_SESSION: '', ...env })
const outDir = () => mkdtempSync(join(tmpdir(), 'signed-out-'))
const readJson = (dir) => JSON.parse(readFileSync(join(dir, 'signed-out-access.json'), 'utf8'))

test('양성·음성 대조: 링크+next 와 리다이렉트+returnTo 는 통과하고, 파라미터 없음·링크 없음·빈 쪽·404 는 각자 이유로 실패한다(종료 1, 결과 파일 있음)', async () => {
  const s = await startServer()
  try {
    const out = outDir()
    const r = await run([s.origin, '--out', out, '--paths', '/account,/billing,/upgrade,/nolink,/empty,/gone'])
    assert.equal(r.code, 1, r.out + r.err)
    const j = readJson(out)
    const by = Object.fromEntries(j.pages.map((p) => [p.path, p]))
    assert.equal(by['/account'].pass, true)
    assert.equal(by['/account'].via, 'link')
    assert.equal(by['/billing'].pass, true)
    assert.equal(by['/billing'].via, 'redirect')
    assert.equal(by['/billing'].param, 'returnTo')
    assert.ok(by['/upgrade'].fails[0].startsWith('no-return-param'))
    assert.ok(by['/nolink'].fails[0].startsWith('no-signin-link'))
    assert.ok(by['/empty'].fails.some((f) => f.startsWith('empty-page')))
    assert.ok(by['/gone'].fails.some((f) => f.startsWith('http-error')))
    assert.deepEqual(j.summary, { pages: 6, pass: 2, fail: 4, na: 0, ok: false })
    assert.equal(j.scene, 'signed-out')
  } finally { await s.close() }
})

test('통과만 있는 목록은 종료 0 이고, 환경 변수 WF_SESSION=signed-in 이어도 이 관문은 로그아웃으로 연다(세션을 읽는 쪽이 안내를 낸다)', async () => {
  const s = await startServer()
  try {
    const out = outDir()
    const r = await run([s.origin, '--out', out, '--paths', '/account,/billing,/session-aware'], { WF_SESSION: 'signed-in' })
    assert.equal(r.code, 0, r.out + r.err)
    const j = readJson(out)
    assert.equal(j.summary.ok, true)
    assert.equal(j.pages.find((p) => p.path === '/session-aware').via, 'link') // 환영 글이 아니라 로그인 안내가 보였다 = 쿠키 없이 열렸다
  } finally { await s.close() }
})

test('--paths-file(배열·{paths})과 종료 코드: 인자 오류 2 · 닿지 않는 서버는 도구 실패 1(결과 파일 없음, 이전 파일도 지운다)', async () => {
  const s = await startServer()
  try {
    const dir = outDir()
    const f = join(dir, 'paths.json')
    writeFileSync(f, JSON.stringify({ paths: ['/account'] }))
    const out = outDir()
    const ok = await run([s.origin, '--out', out, '--paths-file', f])
    assert.equal(ok.code, 0, ok.out + ok.err)
    assert.equal(readJson(out).pages.length, 1)
  } finally { await s.close() }
  assert.equal((await run([])).code, 2)
  const out = outDir()
  writeFileSync(join(out, 'signed-out-access.json'), '{"stale":true}')
  const dead = await run(['http://127.0.0.1:1', '--out', out, '--paths', '/account'])
  assert.equal(dead.code, 1)
  assert.match(dead.err, /도구 실패/)
  assert.ok(!existsSync(join(out, 'signed-out-access.json')), '이전 실행의 결과가 남았다')
})
