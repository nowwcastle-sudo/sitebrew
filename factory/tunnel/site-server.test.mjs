// site-server.mjs 시험(sitebrew v0.2.0 계획 4 Task 6) — 가짜 run·exists·start 로 설치·빌드 순서, 환경 전달, 실패 이유, 경로·비밀 가림을 본다. 진짜 npm 은 부르지 않는다.
import assert from 'node:assert/strict'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { prepareSite, scrubTail, serveSite } from './site-server.mjs'

const DIR = join(homedir(), 'sites', 'my-shop')
const NEXT = join(DIR, 'node_modules', 'next')
const BUILD_ID = join(DIR, '.next', 'BUILD_ID')
const BUILT_FOR = join(DIR, '.tmp', 'tunnel', 'built-for')

/** 가짜 환경: 있는 파일 집합 + 기록된 글 + run 호출 기록. */
function rig({ files = [], written = {}, results = [], produce = [] } = {}) {
  const have = new Set(files)
  const store = { ...written }
  const calls = []
  const steps = []
  const queue = [...results]
  return {
    calls, steps, store,
    ctx: {
      env: { PATH: '/usr/bin', NEXT_TELEMETRY_DISABLED: '1' },
      platform: 'linux',
      exists: (p) => have.has(p) || p in store,
      read: (p) => { if (!(p in store)) throw new Error('ENOENT'); return store[p] },
      write: (p, text) => { store[p] = text },
      run: async (cmd, args, opts) => { calls.push({ cmd, args, ...opts }); if (args[0] === 'run') for (const f of produce) have.add(f); return queue.shift() ?? { code: 0, tail: '', timedOut: false } },
      onStep: (s) => steps.push(s),
    },
  }
}

test('node_modules 와 BUILD_ID 가 있고 기록이 맞으면 설치·빌드를 건너뛴다', async () => {
  const r = rig({ files: [NEXT, BUILD_ID], written: { [BUILT_FOR]: 'site' } })
  const out = await prepareSite(DIR, { product: false }, r.ctx)
  assert.deepEqual(out, { installed: false, built: false })
  assert.equal(r.calls.length, 0)
  assert.deepEqual(r.steps, [])
})

test('아무것도 없으면 설치 → 빌드 순서와 고정된 인자로 돈다', async () => {
  const r = rig()
  const out = await prepareSite(DIR, { product: false }, r.ctx)
  assert.deepEqual(out, { installed: true, built: true })
  assert.deepEqual(r.calls.map((c) => [c.cmd, c.args]), [
    ['npm', ['install', '--no-audit', '--no-fund', '--prefer-offline']],
    ['npm', ['run', 'build']],
  ])
  assert.equal(r.calls[0].cwd, DIR)
  assert.equal(r.calls[0].timeoutMs, 20 * 60_000)
  assert.equal(r.calls[1].timeoutMs, 30 * 60_000)
  assert.deepEqual(r.steps, ['preparing', 'building'])
  assert.equal(r.store[BUILT_FOR], 'site')
})

test('Windows 에서는 npm.cmd 를 부른다', async () => {
  const r = rig()
  r.ctx.platform = 'win32'
  await prepareSite(DIR, { product: false }, r.ctx)
  assert.deepEqual(r.calls.map((c) => c.cmd), ['npm.cmd', 'npm.cmd'])
})

test('받은 환경을 설치·빌드에 그대로 넘긴다(제품형 mock 환경 포함)', async () => {
  const r = rig()
  r.ctx.env = { LF_MODE: 'mock', LF_ALLOW_MOCK_PROD: '1', LF_MOCK_SUB: 'none', LF_MOCK_OUTBOX: '/x/outbox.jsonl' }
  await prepareSite(DIR, { product: true }, r.ctx)
  assert.equal(r.calls.length, 2)
  for (const c of r.calls) {
    assert.equal(c.env, r.ctx.env)
    assert.equal(c.env.LF_MODE, 'mock')
    assert.equal(c.env.LF_ALLOW_MOCK_PROD, '1')
    assert.equal(c.env.LF_MOCK_SUB, 'none')
    assert.equal(c.env.LF_MOCK_OUTBOX, '/x/outbox.jsonl')
  }
  assert.equal(r.store[BUILT_FOR], 'product')
})

test('node_modules 가 있으면 설치는 건너뛰고 빌드만 한다', async () => {
  const r = rig({ files: [NEXT] })
  const out = await prepareSite(DIR, { product: false }, r.ctx)
  assert.deepEqual(out, { installed: false, built: true })
  assert.deepEqual(r.calls.map((c) => c.args[0]), ['run'])
})

test('소개형으로 빌드한 폴더를 제품형으로 열면 다시 빌드한다(반대도 같다)', async () => {
  const r = rig({ files: [NEXT, BUILD_ID], written: { [BUILT_FOR]: 'site' } })
  const out = await prepareSite(DIR, { product: true }, r.ctx)
  assert.deepEqual(out, { installed: false, built: true })
  assert.equal(r.store[BUILT_FOR], 'product')
  const r2 = rig({ files: [NEXT, BUILD_ID], written: { [BUILT_FOR]: 'product' } })
  assert.equal((await prepareSite(DIR, { product: false }, r2.ctx)).built, true)
})

test('빌드 기록이 없으면 다시 빌드한다', async () => {
  const r = rig({ files: [NEXT, BUILD_ID] })
  assert.equal((await prepareSite(DIR, { product: false }, r.ctx)).built, true)
})

test('설치 실패 → reason installFailed, 빌드는 부르지 않는다', async () => {
  const r = rig({ results: [{ code: 1, tail: 'npm ERR! boom', timedOut: false }] })
  await assert.rejects(prepareSite(DIR, { product: false }, r.ctx), (e) => e.reason === 'installFailed' && e.tail.includes('npm ERR! boom'))
  assert.equal(r.calls.length, 1)
  assert.equal(BUILT_FOR in r.store, false)
})

test('빌드 실패 → reason buildFailed, 기록을 남기지 않는다', async () => {
  const r = rig({ files: [NEXT], results: [{ code: 2, tail: 'Type error', timedOut: false }] })
  await assert.rejects(prepareSite(DIR, { product: false }, r.ctx), (e) => e.reason === 'buildFailed')
  assert.equal(BUILT_FOR in r.store, false)
})

test('시간 초과는 어느 단계든 timeout', async () => {
  const a = rig({ results: [{ code: null, tail: '', timedOut: true }] })
  await assert.rejects(prepareSite(DIR, { product: false }, a.ctx), (e) => e.reason === 'timeout' && e.step === 'install')
  const b = rig({ files: [NEXT], results: [{ code: null, tail: '', timedOut: true }] })
  await assert.rejects(prepareSite(DIR, { product: false }, b.ctx), (e) => e.reason === 'timeout' && e.step === 'build')
})

test('tail 에는 홈 폴더·사이트 폴더 경로와 비밀값이 없고 끝 20줄만 남는다', async () => {
  const lines = Array.from({ length: 50 }, (_, i) => `line ${i}`)
  lines.push(`error at ${join(DIR, 'app', 'page.tsx')}`, `cache ${homedir()}/.npm/_logs`, 'token secret-xyz-123 leaked')
  const r = rig({ files: [NEXT], results: [{ code: 1, tail: lines.join('\n'), timedOut: false }] })
  r.ctx.env = { VERCEL_TOKEN: 'secret-xyz-123' }
  r.ctx.home = homedir()
  await assert.rejects(prepareSite(DIR, { product: false }, r.ctx), (e) => {
    assert.ok(!e.tail.includes(homedir()), e.tail)
    assert.ok(!e.tail.includes('secret-xyz-123'))
    assert.ok(e.tail.includes('<site>'))
    assert.equal(e.tail.split('\n').length, 20)
    assert.ok(!e.message.includes(homedir()))
    return true
  })
})

test('scrubTail: 슬래시·역슬래시 두 모양과 HIGGSFIELD_ 값도 가린다', () => {
  const out = scrubTail('<home>\\site\\a.js <home>/site/b.js key=hf-secret-1', { dir: '<home>\\site', home: '<home>', env: { HIGGSFIELD_KEY: 'hf-secret-1' } })
  assert.ok(!/Users/.test(out), out)
  assert.ok(!out.includes('hf-secret-1'))
})

test('serveSite 는 start 에 폴더와 환경을 그대로 넘기고 { port, pid, stop } 을 돌려준다', async () => {
  let seen
  let stopped = 0
  const env = { LF_MODE: 'mock' }
  const out = await serveSite(DIR, env, { start: async (dir, e, path, opts) => { seen = { dir, e, path, opts }; return { port: 4321, pid: 99, stop: () => { stopped += 1 }, extra: 1 } } })
  assert.equal(seen.dir, DIR)
  assert.equal(seen.e, env)
  assert.deepEqual(Object.keys(out).sort(), ['pid', 'port', 'stop'])
  assert.equal(out.port, 4321)
  out.stop()
  assert.equal(stopped, 1)
})

test('serveSite: 서버가 켜지지 않아 던지면 그대로 올라온다', async () => {
  await assert.rejects(serveSite(DIR, {}, { start: async () => { throw new Error('boom') } }), /boom/)
})

// ── 정적 내보내기(output: "export") 사이트 ──
const STATIC = { product: false, outDir: 'out' }
const OUT_INDEX = join(DIR, 'out', 'index.html')
const STATIC_FOR = 'site-static'

test('정적 사이트: out/index.html 이 있고 기록이 맞으면 설치·빌드를 건너뛴다(.next 가 없어도)', async () => {
  const r = rig({ files: [NEXT, OUT_INDEX], written: { [BUILT_FOR]: STATIC_FOR } })
  assert.deepEqual(await prepareSite(DIR, STATIC, r.ctx), { installed: false, built: false })
  assert.equal(r.calls.length, 0)
})

test('정적 사이트: out 이 없으면 빌드하고, 빌드가 out/index.html 을 만들면 기록을 남긴다', async () => {
  const r = rig({ files: [NEXT, join(DIR, '.next', 'BUILD_ID')], produce: [OUT_INDEX] })
  assert.deepEqual(await prepareSite(DIR, STATIC, r.ctx), { installed: false, built: true })
  assert.deepEqual(r.calls.map((c) => c.args), [['run', 'build']])
  assert.equal(r.store[BUILT_FOR], STATIC_FOR)
})

test('정적 사이트: 서버형으로 빌드한 기록이면 다시 빌드한다', async () => {
  const r = rig({ files: [NEXT, OUT_INDEX], written: { [BUILT_FOR]: 'site' } })
  assert.equal((await prepareSite(DIR, STATIC, r.ctx)).built, true)
})

test('정적 사이트: 빌드가 끝났는데 out/index.html 이 없으면 reason outputMissing, 기록을 남기지 않는다', async () => {
  const r = rig({ files: [NEXT], results: [{ code: 0, tail: 'Compiled', timedOut: false }] })
  await assert.rejects(prepareSite(DIR, STATIC, r.ctx), (e) => e.reason === 'outputMissing' && e.step === 'build')
  assert.equal(BUILT_FOR in r.store, false)
})

test('serveSite: 정적 사이트는 next start 대신 out 폴더를 정적 서버로 켠다', async () => {
  let started
  const out = await serveSite(DIR, { A: '1' }, {
    kind: STATIC,
    start: async () => { throw new Error('next start must not run') },
    startStatic: async (root) => { started = root; return { port: 7000, pid: 5, stop: () => {}, extra: 1 } },
  })
  assert.equal(started, join(DIR, 'out'))
  assert.deepEqual(Object.keys(out).sort(), ['pid', 'port', 'stop'])
  assert.equal(out.port, 7000)
})

test('serveSite: 서버형은 정적 서버를 부르지 않고 next start 에 끝줄 수집을 요청한다', async () => {
  let opts
  await serveSite(DIR, {}, { kind: { product: false, outDir: null }, startStatic: async () => { throw new Error('static must not run') }, start: async (d, e, p, o) => { opts = o; return { port: 1, pid: 2, stop: () => {} } } })
  assert.equal(opts.tail, true)
})

test('serveSite: next start 가 export 설정 때문에 거절하면 reason exportNeedsStatic, 그 밖은 serverFailed', async () => {
  const exportErr = Object.assign(new Error('서버가 켜지다 종료 1'), { tail: `error  "next start" does not work with "output: export" configuration. Use "npx serve@latest out" instead.\nat ${DIR}/x` })
  await assert.rejects(serveSite(DIR, {}, { start: async () => { throw exportErr } }), (e) => e.reason === 'exportNeedsStatic' && e.step === 'serve' && !e.tail.includes(DIR))
  const other = Object.assign(new Error('서버가 켜지다 종료 1'), { tail: `Error: listen EADDRINUSE ${DIR}` })
  await assert.rejects(serveSite(DIR, {}, { start: async () => { throw other } }), (e) => e.reason === 'serverFailed' && !e.tail.includes(DIR))
  await assert.rejects(serveSite(DIR, {}, { start: async () => { throw new Error('답하지 않았다') } }), (e) => e.reason === 'serverFailed' && e.tail === '')
})

test('이 모듈이 던지는 reason 은 모두 copy.json failures 에 있다', async () => {
  const { readFileSync } = await import('node:fs')
  const { REASONS } = await import('./site-server.mjs')
  const copy = JSON.parse(readFileSync(new URL('./copy.json', import.meta.url), 'utf8'))
  for (const key of REASONS) assert.ok(copy.failures[key], key)
})
