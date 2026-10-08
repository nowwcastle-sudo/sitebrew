// 세션 장면(UXGATE1 · G1) — 순수 함수(Chrome 없음) + 쿠키·쿼리가 실제로 서버에 닿는지(Chrome, 탐침 자식 프로세스를 비동기로 돌린다) + 기본값 불변.
// 실행: node --test --test-force-exit --test-timeout=300000 factory/qa/session-scene.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { runTool } from './fixtures/run-tool.mjs'
import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { COOKIE_NAME, SUBS, applyScene, extractSessionArg, parseScene, sceneCookie, sceneQuery, sceneUrl } from './session-scene.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..')

// ── 순수 ────────────────────────────────────────────────────────────────────────────────────────────────
test('순수: 장면 문법 — signed-out · signed-in · :sub=<상태> · :unverified(이어 붙이면 정규화)', () => {
  assert.equal(parseScene('signed-out').canonical, 'signed-out')
  assert.equal(parseScene('signed-in').signedIn, true)
  assert.equal(parseScene('signed-in:sub=past_due').sub, 'past_due')
  assert.equal(parseScene('signed-in:unverified').unverified, true)
  assert.equal(parseScene('signed-in:sub=trialing:unverified').canonical, 'signed-in:unverified:sub=trialing') // 정규화 순서
  for (const sub of ['none', 'trialing', 'active', 'past_due', 'paused', 'canceled', 'expired']) assert.equal(parseScene(`signed-in:sub=${sub}`).sub, sub)
})

test('순수: 모르는 장면은 던진다 — 오타가 「로그아웃 화면을 잰 통과」가 되지 않게', () => {
  for (const bad of ['', 'signedin', 'signed-in:sub=gold', 'signed-in:sub', 'signed-in:verified', 'signed-out:sub=active', 'signed-in:unverified:bogus'])
    assert.throws(() => parseScene(bad), /모르는|덧붙일/, bad)
})

test('순수: 구독 상태 표는 adapter-mock.ts MOCK_SUBS + MOCK_SUB_SCENARIOS 와 같다(갤러리가 읽는 값과 어긋나면 여기서 잡힌다)', () => {
  const src = readFileSync(join(root, 'registry', 'factory', 'contract', 'adapter-mock.ts'), 'utf8')
  const list = (name) => [...src.match(new RegExp(`export const ${name} = \\[([^\\]]*)\\] as const`))[1].matchAll(/"([^"]+)"/g)].map((m) => m[1])
  assert.deepEqual(SUBS, [...list('MOCK_SUBS'), ...list('MOCK_SUB_SCENARIOS')])
})

test('순수: argv 에서 --session 을 떼어 낸다(위치 인자 수가 그대로) · =형 · 환경 변수 · 값 없음은 던진다', () => {
  const a = ['node', 'tool.mjs', 'http://x/', '--session', 'signed-in', 'out']
  assert.equal(extractSessionArg(a, {}), 'signed-in')
  assert.deepEqual(a, ['node', 'tool.mjs', 'http://x/', 'out'])
  const b = ['node', 'tool.mjs', '--session=signed-out', 'u', 'o']
  assert.equal(extractSessionArg(b, { WF_SESSION: 'signed-in' }), 'signed-out') // 인자가 환경 변수보다 앞선다
  assert.deepEqual(b, ['node', 'tool.mjs', 'u', 'o'])
  const c = ['node', 'tool.mjs', 'u']
  assert.equal(extractSessionArg(c, { WF_SESSION: 'signed-in:unverified' }), 'signed-in:unverified')
  assert.equal(extractSessionArg(['node', 'tool.mjs', 'u'], {}), null)
  assert.throws(() => extractSessionArg(['node', 'tool.mjs', '--session'], {}), /장면이 없다/)
  assert.throws(() => extractSessionArg(['node', 'tool.mjs', '--session', '--out', 'x'], {}), /장면이 없다/)
})

test('순수: 쿠키·쿼리 — signed-out 은 쿠키를 지우고, signed-in 은 wf_session 값(인코딩)과 auth/sub 쿼리를 낸다', () => {
  assert.equal(sceneCookie('signed-out'), null)
  assert.deepEqual(sceneCookie('signed-in:sub=past_due'), { name: COOKIE_NAME, value: 'signed-in%3Asub%3Dpast_due' })
  assert.deepEqual(sceneQuery('signed-out'), { auth: 'signed-out' })
  assert.deepEqual(sceneQuery('signed-in'), { auth: 'signed-in' })
  assert.deepEqual(sceneQuery('signed-in:sub=paused'), { auth: 'signed-in', sub: 'paused' })
  assert.deepEqual(sceneQuery('signed-in:unverified'), { auth: 'signed-in' }) // 갤러리 목에 확인 전 사용자가 없다 — 쿠키만 간다
})

test('순수: 주소 — 갤러리(/qa/blocks)에만 덧붙이고, 주소에 이미 있는 키는 건드리지 않고, file:·다른 경로는 그대로', () => {
  assert.equal(sceneUrl('http://h:1/qa/blocks?b=x&r=y', 'signed-in:sub=active'), 'http://h:1/qa/blocks?b=x&r=y&auth=signed-in&sub=active')
  assert.equal(sceneUrl('http://h:1/qa/blocks?b=x&auth=two-factor&sub=expired', 'signed-in:sub=active'), 'http://h:1/qa/blocks?b=x&auth=two-factor&sub=expired')
  assert.equal(sceneUrl('http://h:1/account', 'signed-in'), 'http://h:1/account')
  assert.equal(sceneUrl('http://h:1/qa/recipes?r=r1', 'signed-in'), 'http://h:1/qa/recipes?r=r1')
  assert.equal(sceneUrl('file:///x/qa/blocks', 'signed-in'), 'file:///x/qa/blocks')
  assert.equal(sceneUrl('not a url', 'signed-in'), 'not a url')
})

test('순수: applyScene — 쿠키를 못 심으면(응답 success false·오류) 도구 실패로 던진다, file: 주소는 CDP 호출이 없다', async () => {
  const calls = []
  const ok = async (m, p) => { calls.push([m, p]); return { result: { success: true } } }
  assert.equal(await applyScene(ok, 'http://h:1/qa/blocks?b=x', 'signed-in'), 'http://h:1/qa/blocks?b=x&auth=signed-in')
  assert.deepEqual(calls.map((c) => c[0]), ['Network.enable', 'Network.setCookie']) // 켠 뒤에 심는다 — 안 켜면 headless Chrome 에서 setCookie 가 답하지 않았다
  assert.deepEqual(calls[1], ['Network.setCookie', { name: 'wf_session', value: 'signed-in', url: 'http://h:1/', path: '/', sameSite: 'Lax' }])
  await assert.rejects(applyScene(async () => ({ result: { success: false } }), 'http://h:1/', 'signed-in'), /쿠키를 심지 못했다/)
  await assert.rejects(applyScene(async () => ({ error: { message: 'boom' } }), 'http://h:1/', 'signed-in'), /boom/)
  calls.length = 0
  await applyScene(ok, 'http://h:1/', 'signed-out')
  assert.deepEqual(calls.map((c) => c[0]), ['Network.enable', 'Network.deleteCookies'])
  calls.length = 0
  assert.equal(await applyScene(ok, 'file:///a.html', 'signed-in'), 'file:///a.html')
  assert.equal(calls.length, 0)
})

// ── 쪽(Chrome) — 서버가 실제로 받은 쿠키·주소를 본다 ────────────────────────────────────────────────────────────
function startServer() {
  const seen = []
  const server = createServer((req, res) => {
    seen.push({ url: req.url, cookie: req.headers.cookie ?? null })
    res.setHeader('content-type', 'text/html; charset=utf-8')
    res.end(`<!doctype html><meta charset="utf-8"><title>probe</title><body><p>path ${req.url}</p></body>`)
  })
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ seen, origin: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((r) => server.close(r)) })))
}
// seen: 서버가 받은 요청 기록 — 시도마다 비워 실패한 시도의 요청이 판정에 섞이지 않게 한다.
const probe = async (args, env = {}, seen) => {
  const r = await runTool(join(here, 'fixtures', 'session-probe.mjs'), args, { WF_SESSION: '', ...env }, { onAttempt: () => { if (seen) seen.length = 0 } })
  return { ...r, json: r.code === 0 ? JSON.parse(r.out.trim().split('\n').pop()) : null }
}

test('기본값 불변: --session 이 없으면 서버가 받은 주소·쿠키가 예전과 같다(쿠키 없음·쿼리 그대로), 탐침 argv 도 그대로', async () => {
  const s = await startServer()
  try {
    const gallery = `${s.origin}/qa/blocks?b=block-x&r=r1-measure`
    const r = await probe([gallery, `${s.origin}/account`], {}, s.seen)
    assert.equal(r.code, 0, r.err)
    assert.equal(r.json.scene, null)
    assert.deepEqual(r.json.argv, [gallery, `${s.origin}/account`])
    assert.deepEqual(s.seen.filter((x) => !x.url.includes('favicon')), [{ url: '/qa/blocks?b=block-x&r=r1-measure', cookie: null }, { url: '/account', cookie: null }])
  } finally { await s.close() }
})

test('--session signed-in:sub=past_due: 쿠키 wf_session 이 모든 쪽에 가고 갤러리 주소에만 auth·sub 쿼리가 붙는다, 위치 인자는 그대로 남는다', async () => {
  const s = await startServer()
  try {
    const r = await probe(['--session', 'signed-in:sub=past_due', `${s.origin}/qa/blocks?b=block-x`, `${s.origin}/account`], {}, s.seen)
    assert.equal(r.code, 0, r.err)
    assert.equal(r.json.scene, 'signed-in:sub=past_due')
    assert.deepEqual(r.json.argv, [`${s.origin}/qa/blocks?b=block-x`, `${s.origin}/account`]) // flag 가 떼어져 위치 인자가 안 밀린다
    const pages = s.seen.filter((x) => !x.url.includes('favicon'))
    assert.deepEqual(pages.map((x) => x.url), ['/qa/blocks?b=block-x&auth=signed-in&sub=past_due', '/account'])
    for (const p of pages) assert.equal(p.cookie, 'wf_session=signed-in%3Asub%3Dpast_due')
  } finally { await s.close() }
})

test('환경 변수 WF_SESSION 이 같은 효과이고 인자가 앞선다 · signed-out 은 앞서 심은 쿠키를 지운다 · 주소가 가진 쿼리가 이긴다', async () => {
  const s = await startServer()
  try {
    const a = await probe([`${s.origin}/x`], { WF_SESSION: 'signed-in:unverified' }, s.seen)
    assert.equal(a.code, 0, a.err)
    assert.equal(a.json.scene, 'signed-in:unverified')
    assert.equal(s.seen.find((x) => x.url === '/x').cookie, 'wf_session=signed-in%3Aunverified')
    s.seen.length = 0
    const b = await probe(['--session', 'signed-in', `${s.origin}/1`, `${s.origin}/2`, `${s.origin}/qa/blocks?b=x&auth=two-factor`], { WF_SESSION: 'signed-out', PROBE_SCENES: JSON.stringify([null, 'signed-out', null]) }, s.seen)
    assert.equal(b.code, 0, b.err)
    const by = Object.fromEntries(s.seen.filter((x) => !x.url.includes('favicon')).map((x) => [x.url, x.cookie]))
    assert.equal(by['/1'], 'wf_session=signed-in') // 인자 signed-in 이 환경 변수 signed-out 을 이긴다
    assert.equal(by['/2'], null) // 같은 Chrome 에서 signed-out 을 명시하면 쿠키가 지워진다
    assert.equal(by['/qa/blocks?b=x&auth=two-factor'], 'wf_session=signed-in') // 쿼리는 주소 것이 이기고 쿠키는 간다
  } finally { await s.close() }
})

test('모르는 --session 은 인자 오류(종료 2) — Chrome 을 띄우기 전에 멈춘다', async () => {
  const r = await probe(['--session', 'signed-in:sub=gold', 'http://127.0.0.1:1/'])
  assert.equal(r.code, 2)
  assert.match(r.err, /인자 오류: 모르는 구독 상태/)
})
