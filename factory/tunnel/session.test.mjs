// session.mjs 시험(계획 4 Task 8) — 모듈 가짜로 흐름만 본다. 진짜 프로세스·네트워크 없음(마지막 통합 시험만 진짜 자식 프로세스, 공개 터널 아님).
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { loadProviders } from './providers.mjs'
import { DEFAULT_MINUTES, MAX_MINUTES, MIN_MINUTES, runSession } from './session.mjs'
import { readState } from './state.mjs'

const dirs = []
const makeSite = (pkg = { name: 'x' }) => {
  const dir = mkdtempSync(join(tmpdir(), 'tunnel-session-'))
  dirs.push(dir)
  writeFileSync(join(dir, 'package.json'), JSON.stringify(pkg))
  return dir
}
afterEach(() => { while (dirs.length) rmSync(dirs.pop(), { recursive: true, force: true }) })

const providers = loadProviders()
/** 가짜 의존. calls 에 순서를 쌓고, 시계와 대기는 시험이 푼다. */
function fakes(over = {}) {
  const calls = []
  let release
  const hold = new Promise((r) => { release = r })
  const deps = {
    providers,
    calls,
    release,
    kindOf: () => ({ product: false }),
    exportOf: () => null,
    envOf: () => ({ MARK: 'env' }),
    prepare: async (dir, kind, ctx) => { calls.push('prepare'); ctx.onStep?.('preparing'); ctx.onStep?.('building'); return { installed: true, built: true } },
    serve: async () => { calls.push('serve'); return { port: 4321, pid: 111, stop: async () => { calls.push('server.stop') } } },
    open: async (p) => { calls.push(`open:${p.id}`); return { url: `https://${p.id}.example.test`, pid: 222, exited: hold, stop: async () => { calls.push('tunnel.stop') } } },
    find: (p) => ({ found: p.id !== 'none' }),
    wait: () => hold,
    now: () => 1_000_000,
    ...over,
  }
  return deps
}

describe('runSession', () => {
  it('정상 흐름: preparing → building → starting → opening → ready → stopped 순으로 상태를 쓰고 세 PID 를 남긴다', async () => {
    const site = makeSite()
    const seen = []
    const d = fakes({ onState: (s) => seen.push(s.status) })
    const run = runSession({ site, providerId: 'auto', minutes: 30, allowMock: false, lang: 'ko' }, d)
    await new Promise((r) => setTimeout(r, 50))
    const ready = readState(site)
    assert.equal(ready.status, 'ready')
    assert.equal(ready.url, 'https://cloudflare.example.test')
    assert.equal(ready.provider, 'cloudflare')
    assert.equal(ready.port, 4321)
    assert.deepEqual([ready.pids.server, ready.pids.tunnel], [111, 222])
    assert.equal(Date.parse(ready.expiresAt) - 1_000_000, 30 * 60_000)
    d.release()
    const final = await run
    assert.equal(final.status, 'stopped')
    assert.deepEqual(seen.filter((s, i) => s !== seen[i - 1]), ['preparing', 'building', 'starting', 'opening', 'ready', 'stopped'])
    assert.deepEqual(d.calls, ['prepare', 'serve', 'open:cloudflare', 'tunnel.stop', 'server.stop'])
    assert.equal(readState(site).status, 'stopped')
    assert.equal(readState(site).pids, undefined)
  })

  it('제품형은 allowMock 없이는 서버를 부르지 않고 mockNeedsOk 로 끝낸다', async () => {
    const site = makeSite()
    const d = fakes({ kindOf: () => ({ product: true }) })
    const final = await runSession({ site, providerId: 'auto', minutes: 30, allowMock: false, lang: 'ko' }, d)
    assert.equal(final.status, 'failed')
    assert.equal(final.reason, 'mockNeedsOk')
    assert.deepEqual(d.calls, [])
  })

  it('제품형 + allowMock 이면 mock 환경(envOf)을 설치·빌드·서버에 같게 넘긴다', async () => {
    const site = makeSite()
    const envs = []
    const d = fakes({
      kindOf: () => ({ product: true }),
      envOf: (kind) => ({ product: kind.product }),
      prepare: async (dir, kind, ctx) => { envs.push(ctx.env); return {} },
      serve: async (dir, env) => { envs.push(env); return { port: 1, pid: 1, stop: async () => {} } },
    })
    const run = runSession({ site, providerId: 'auto', minutes: 30, allowMock: true, lang: 'ko' }, d)
    await new Promise((r) => setTimeout(r, 50))
    d.release()
    await run
    assert.deepEqual(envs, [{ product: true }, { product: true }])
  })

  it('빌드 실패 → failed + reason, 서버·터널은 부르지 않는다', async () => {
    const site = makeSite()
    const d = fakes({ prepare: async () => { throw Object.assign(new Error('x'), { reason: 'buildFailed', tail: 'boom' }) } })
    const final = await runSession({ site, providerId: 'auto', minutes: 30, allowMock: false, lang: 'ko' }, d)
    assert.equal(final.status, 'failed')
    assert.equal(final.reason, 'buildFailed')
    assert.deepEqual(d.calls, [])
  })

  it('터널이 실패하면 서버를 끄고 failed', async () => {
    const site = makeSite()
    const calls = []
    const d = fakes({
      serve: async () => ({ port: 1, pid: 9, stop: async () => { calls.push('server.stop') } }),
      open: async () => { throw Object.assign(new Error('x'), { reason: 'notReachable' }) },
    })
    const final = await runSession({ site, providerId: 'cloudflare', minutes: 30, allowMock: false, lang: 'ko' }, d)
    assert.equal(final.status, 'failed')
    assert.equal(final.reason, 'notReachable')
    assert.deepEqual(calls, ['server.stop'])
  })

  it('auto 는 첫 공급자가 주소 단계에서 실패하면 다음 공급자로 한 번 더 시도한다', async () => {
    const site = makeSite()
    const tried = []
    const d = fakes({
      open: async (p) => {
        tried.push(p.id)
        if (p.id === 'cloudflare') throw Object.assign(new Error('x'), { reason: 'urlNotFound' })
        return { url: 'https://b.example.test', pid: 5, exited: new Promise(() => {}), stop: async () => {} }
      },
      wait: () => Promise.resolve(),
    })
    const final = await runSession({ site, providerId: 'auto', minutes: 30, allowMock: false, lang: 'ko' }, d)
    assert.deepEqual(tried, ['cloudflare', 'localhostrun'])
    assert.equal(final.status, 'stopped')
  })

  it('이름을 준 공급자는 대체 없이 그것만 시도한다', async () => {
    const site = makeSite()
    const tried = []
    const d = fakes({ open: async (p) => { tried.push(p.id); throw Object.assign(new Error('x'), { reason: 'urlNotFound' }) } })
    const final = await runSession({ site, providerId: 'cloudflare', minutes: 30, allowMock: false, lang: 'ko' }, d)
    assert.deepEqual(tried, ['cloudflare'])
    assert.equal(final.reason, 'urlNotFound')
  })

  it('쓸 수 있는 도구가 하나도 없으면 서버를 띄우기 전에 toolMissing', async () => {
    const site = makeSite()
    const d = fakes({ find: () => ({ found: false }) })
    const final = await runSession({ site, providerId: 'auto', minutes: 30, allowMock: false, lang: 'ko' }, d)
    assert.equal(final.reason, 'toolMissing')
    assert.deepEqual(d.calls, ['prepare'].filter(() => false))
  })

  it('만료·중지 신호·터널 종료 중 먼저 오는 쪽에서 모두 정리하고 stopped', async () => {
    for (const wake of ['wait', 'exited']) {
      const site = makeSite()
      const d = fakes()
      if (wake === 'wait') d.wait = () => Promise.resolve()
      else d.open = async () => ({ url: 'https://x.test', pid: 2, exited: Promise.resolve(0), stop: async () => { d.calls.push('tunnel.stop') } })
      d.wait = wake === 'wait' ? d.wait : () => new Promise(() => {})
      const final = await runSession({ site, providerId: 'cloudflare', minutes: 30, allowMock: false, lang: 'ko' }, d)
      assert.equal(final.status, 'stopped', wake)
      assert.ok(d.calls.includes('server.stop') && d.calls.includes('tunnel.stop'), wake)
    }
  })

  it('opts 검사: 분은 정수 MIN..MAX, 언어는 ko/en', async () => {
    const site = makeSite()
    await assert.rejects(runSession({ site, providerId: 'auto', minutes: MIN_MINUTES - 1, lang: 'ko' }, fakes()), /minutes/)
    await assert.rejects(runSession({ site, providerId: 'auto', minutes: MAX_MINUTES + 1, lang: 'ko' }, fakes()), /minutes/)
    await assert.rejects(runSession({ site, providerId: 'auto', minutes: 1.5, lang: 'ko' }, fakes()), /minutes/)
    await assert.rejects(runSession({ site, providerId: 'auto', minutes: 30, lang: 'fr' }, fakes()), /lang/)
    assert.equal(DEFAULT_MINUTES, 120)
  })

  it('터널 출력 줄은 비밀 값을 가려 .tmp/tunnel/tunnel.log 에 남긴다', async () => {
    const site = makeSite()
    const d = fakes({
      env: { VERCEL_TOKEN: 'secret-xyz-123' },
      open: async (p, port, ctx) => { ctx.onLine('hello secret-xyz-123 world'); ctx.onLine('visit https://a.test'); return { url: 'https://a.test', pid: 2, exited: new Promise(() => {}), stop: async () => {} } },
      wait: () => Promise.resolve(),
    })
    await runSession({ site, providerId: 'cloudflare', minutes: 30, allowMock: false, lang: 'ko' }, d)
    const log = readFileSync(join(site, '.tmp', 'tunnel', 'tunnel.log'), 'utf8')
    assert.match(log, /hello \*\*\* world/)
    assert.doesNotMatch(log, /secret-xyz-123/)
  })
})

describe('runSession — 정적 내보내기 사이트와 로그', () => {
  it('내보내기 폴더가 있으면 prepare·serve 가 outDir 이 든 종류를 받는다', async () => {
    const site = makeSite()
    const seen = {}
    const d = fakes({
      exportOf: () => 'out',
      prepare: async (dir, kind) => { seen.prepare = kind; return {} },
      serve: async (dir, env, opts) => { seen.serve = opts.kind; return { port: 1, pid: 1, stop: async () => {} } },
      wait: () => Promise.resolve(),
    })
    await runSession({ site, providerId: 'cloudflare', minutes: 30, lang: 'ko' }, d)
    assert.equal(seen.prepare.outDir, 'out')
    assert.equal(seen.serve.outDir, 'out')
    assert.equal(seen.serve.product, false)
  })

  it('진짜 정적 서버로 out 폴더를 서빙하고 닫으면 포트가 닫힌다', async () => {
    const { serveSite } = await import('./site-server.mjs')
    const site = makeSite()
    mkdirSync(join(site, 'out'), { recursive: true })
    writeFileSync(join(site, 'out', 'index.html'), '<h1>intro</h1>')
    let port
    const d = fakes({
      exportOf: () => 'out',
      prepare: async () => ({}),
      serve: serveSite,
      open: async (p, serverPort) => {
        port = serverPort
        const res = await fetch(`http://127.0.0.1:${port}/`)
        assert.equal(res.status, 200)
        assert.equal(await res.text(), '<h1>intro</h1>')
        return { url: 'https://a.test', pid: 2, exited: Promise.resolve(), stop: async () => {} }
      },
    })
    const final = await runSession({ site, providerId: 'cloudflare', minutes: 30, lang: 'ko' }, d)
    assert.equal(final.status, 'stopped')
    await assert.rejects(fetch(`http://127.0.0.1:${port}/`))
  })

  it('이유 없는 예외로 실패해도 로그 파일이 남고 이유와 끝줄이 들어 있다', async () => {
    const site = makeSite()
    const d = fakes({ prepare: async () => { throw new Error(`weird crash in ${site}/app`) } })
    const final = await runSession({ site, providerId: 'cloudflare', minutes: 30, lang: 'ko' }, d)
    assert.equal(final.reason, 'unexpected')
    const log = readFileSync(join(site, '.tmp', 'tunnel', 'tunnel.log'), 'utf8')
    assert.match(log, /unexpected/)
    assert.match(log, /weird crash/)
    assert.ok(!log.includes(site))
  })

  it('서버가 켜지지 않으면 이유 키와 여러 줄 끝줄을 로그에 남긴다', async () => {
    const site = makeSite()
    const d = fakes({ serve: async () => { throw Object.assign(new Error('serve serverFailed'), { reason: 'serverFailed', tail: 'line one\nline two\nline three' }) } })
    const final = await runSession({ site, providerId: 'cloudflare', minutes: 30, lang: 'ko' }, d)
    assert.equal(final.reason, 'serverFailed')
    const log = readFileSync(join(site, '.tmp', 'tunnel', 'tunnel.log'), 'utf8')
    for (const t of ['serverFailed', 'line one', 'line two', 'line three']) assert.match(log, new RegExp(t))
  })

  it('성공한 세션도 시작 줄이 있는 로그 파일을 남기고 비밀 값은 가린다', async () => {
    const site = makeSite()
    const d = fakes({ wait: () => Promise.resolve(), env: { VERCEL_TOKEN: 'secret-xyz-123' } })
    await runSession({ site, providerId: 'cloudflare', minutes: 30, lang: 'ko' }, d)
    const log = readFileSync(join(site, '.tmp', 'tunnel', 'tunnel.log'), 'utf8')
    assert.match(log, /session start/)
    assert.match(log, /session end/)
  })

  it('도구를 못 찾아 일찍 실패해도 로그 파일이 있다', async () => {
    const site = makeSite()
    const final = await runSession({ site, providerId: 'cloudflare', minutes: 30, lang: 'ko' }, fakes({ find: () => ({ found: false }) }))
    assert.equal(final.reason, 'toolMissing')
    assert.match(readFileSync(join(site, '.tmp', 'tunnel', 'tunnel.log'), 'utf8'), /toolMissing/)
  })
})

describe('runSession — 진짜 자식 프로세스 한 바퀴(공개 터널 아님)', () => {
  it('가짜 사이트 서버 + 가짜 터널로 ready 를 거쳐 stopped, 남은 프로세스 0', async () => {
    const { openTunnel } = await import('./open-tunnel.mjs')
    const { spawn } = await import('node:child_process')
    const { isAlive } = await import('./state.mjs')
    const site = makeSite()
    mkdirSync(join(site, '.tmp'), { recursive: true })
    const fake = fileURLToPath(new URL('./fixtures/fake-tunnel.mjs', import.meta.url)) // .pathname 은 Windows 에서 /D:/… 가 된다
    const pids = {}
    const d = fakes({
      prepare: async () => ({}),
      serve: async () => {
        const child = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { stdio: 'ignore', detached: process.platform !== 'win32' })
        pids.server = child.pid
        return { port: 5555, pid: child.pid, stop: async () => { try { process.kill(process.platform === 'win32' ? child.pid : -child.pid, 'SIGKILL') } catch { /* 이미 끝남 */ } } } // 음수 pid(프로세스 그룹)는 POSIX 만 — Windows 는 자식 하나를 직접 끈다
      },
      open: (p, port, ctx) => openTunnel({ ...p, readyMs: 5000, reachMs: 2000 }, port, { ...ctx, command: [process.execPath, fake, 'url'], fetch: async () => ({ status: 200 }) }),
      wait: () => new Promise((r) => setTimeout(r, 300)),
    })
    const final = await runSession({ site, providerId: 'cloudflare', minutes: 30, allowMock: false, lang: 'ko' }, d)
    assert.equal(final.status, 'stopped')
    await new Promise((r) => setTimeout(r, 200))
    assert.equal(isAlive(pids.server), false)
  })
})
