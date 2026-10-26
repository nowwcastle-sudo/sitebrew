// preview-link.mjs 시험(계획 4 Task 8) — 입구 CLI. 데몬·킬·시계는 가짜로 주입하고, 진짜 프로세스는 띄우지 않는다.
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, it } from 'node:test'
import { failure, notices, text } from './notices.mjs'
import { CLI_FILE, main } from './preview-link.mjs'
import { loadProviders } from './providers.mjs'
import { readState, stateFile, writeState } from './state.mjs'

const dirs = []
const makeSite = (pkg = { name: 'x' }) => {
  const dir = mkdtempSync(join(tmpdir(), 'tunnel-cli-'))
  dirs.push(dir)
  writeFileSync(join(dir, 'package.json'), JSON.stringify(pkg))
  return dir
}
afterEach(() => { while (dirs.length) rmSync(dirs.pop(), { recursive: true, force: true }) })

const providers = loadProviders()
/** 가짜 의존. spawned 에 띄운 데몬 인자를 쌓고, steps 는 sleep 호출마다 하나씩 실행한다(데몬이 상태를 쓰는 흉내). */
function fakes(over = {}) {
  const rec = { spawned: [], killed: [], stderr: [], unref: 0 }
  const steps = over.steps ?? []
  const deps = {
    rec,
    providers,
    platform: 'linux',
    env: { PATH: '/bin' },
    exists: () => true,
    osRelease: 'ID=ubuntu\n',
    spawn: (cmd, args, opts) => { rec.spawned.push({ cmd, args, opts }); return { pid: 4242, unref: () => { rec.unref += 1 } } },
    kill: (pid) => { rec.killed.push(pid) },
    onSignals: () => () => {},
    isAlive: () => true,
    sleep: async () => { steps.shift()?.() },
    now: () => 0,
    stderr: (line) => { rec.stderr.push(line) },
    ...over,
  }
  delete deps.steps
  return deps
}
const readyBy = (site, extra = {}) => () => writeState(site, { status: 'ready', site, provider: 'cloudflare', url: 'https://abc.trycloudflare.com', port: 3000, product: false, startedAt: 't', expiresAt: 'e', pids: { daemon: 4242, server: 11, tunnel: 22 }, ...extra })

describe('인자', () => {
  const bad = [
    ['명령 없음', []],
    ['모르는 명령', ['launch']],
    ['모르는 flag', ['tools', '--nope']],
    ['남는 인자', ['tools', 'extra']],
    ['--site 없음', ['start']],
    ['분 범위 밖(4)', ['notices', '--minutes', '4']],
    ['분 범위 밖(481)', ['notices', '--minutes', '481']],
    ['분이 숫자 아님', ['notices', '--minutes', '30m']],
    ['모르는 언어', ['notices', '--lang', 'fr']],
    ['모르는 공급자', ['tools', '--provider', 'ngrok']],
    ['모르는 종류', ['notices', '--kind', 'app']],
  ]
  for (const [name, argv] of bad) {
    it(`${name} → 종료 2 + JSON 오류`, async () => {
      const r = await main(argv, fakes())
      assert.equal(r.code, 2)
      assert.equal(r.out.status, 'error')
      assert.ok(typeof r.out.error === 'string' && r.out.error.length > 0)
    })
  }
})

describe('tools', () => {
  it('도구가 없으면 공급자마다 found false + 설치 계획(실행하지 않음)', async () => {
    const d = fakes({ exists: () => false, platform: 'win32', env: { PATH: 'C:\\x' } })
    const r = await main(['tools', '--lang', 'en'], d)
    assert.equal(r.code, 0)
    assert.deepEqual(r.out.providers.map((p) => p.id), ['cloudflare', 'localhostrun'])
    const cf = r.out.providers[0]
    assert.equal(cf.found, false)
    assert.equal(cf.plan.supported, true)
    assert.ok(cf.plan.steps.length > 0)
    for (const st of cf.plan.steps) assert.equal(st.text, text('en', st.textKey))
    assert.deepEqual(d.rec.spawned, [])
  })
  it('찾으면 found true + path, 계획은 없다. --provider 는 하나만', async () => {
    const r = await main(['tools', '--provider', 'cloudflare'], fakes({ exists: (f) => f.endsWith('cloudflared') }))
    assert.equal(r.out.providers.length, 1)
    assert.equal(r.out.providers[0].found, true)
    assert.match(r.out.providers[0].path, /cloudflared$/)
    assert.equal(r.out.providers[0].plan, undefined)
  })
  it('설치 계획을 못 만드는 환경이면 supported false + 사람이 할 안내 문장', async () => {
    const r = await main(['tools', '--provider', 'cloudflare', '--lang', 'en'], fakes({ exists: () => false, platform: 'freebsd' }))
    const plan = r.out.providers[0].plan
    assert.equal(plan.supported, false)
    assert.equal(plan.message, failure('en', 'manualInstall'))
  })
})

describe('notices', () => {
  it('알림 문장만 낸다', async () => {
    const r = await main(['notices', '--kind', 'product', '--provider', 'cloudflare', '--minutes', '30', '--lang', 'en'], fakes())
    assert.equal(r.code, 0)
    assert.deepEqual(r.out.notices, notices({ lang: 'en', kind: 'product', provider: 'cloudflare', minutes: 30 }))
  })
})

describe('start', () => {
  it('데몬을 serve 로 띄우고(detached·stdio ignore·windowsHide·unref) ready 가 되면 주소와 알림 4종을 낸다', async () => {
    const site = makeSite()
    const d = fakes({ steps: [() => writeState(site, { status: 'building', site, pids: { daemon: 4242 } }), readyBy(site)] })
    const r = await main(['start', '--site', site, '--minutes', '30', '--lang', 'en'], d)
    assert.equal(r.code, 0)
    assert.equal(r.out.status, 'ready')
    assert.equal(r.out.url, 'https://abc.trycloudflare.com')
    assert.equal(r.out.provider, 'cloudflare')
    assert.deepEqual(r.out.notices, notices({ lang: 'en', kind: 'site', provider: 'cloudflare', minutes: 30 }))
    const [s] = d.rec.spawned
    assert.equal(s.cmd, process.execPath)
    assert.deepEqual(s.args.slice(0, 2), [CLI_FILE, 'serve'])
    assert.deepEqual(s.args.slice(2), ['--site', site, '--provider', 'auto', '--minutes', '30', '--lang', 'en'])
    assert.equal(s.opts.detached, true)
    assert.equal(s.opts.stdio, 'ignore')
    assert.equal(s.opts.windowsHide, true)
    assert.equal(d.rec.unref, 1)
    assert.deepEqual(d.rec.stderr, ['step: building', 'step: ready'])
  })

  it('제품형은 --allow-mock 없이는 데몬을 띄우지 않고 종료 3(need allowMock) + 가짜 로그인 알림', async () => {
    const site = makeSite({ name: 'x', dependencies: { '@launch-factory/core': '1.0.0' } })
    const d = fakes()
    const r = await main(['start', '--site', site, '--lang', 'en'], d)
    assert.equal(r.code, 3)
    assert.equal(r.out.need, 'allowMock')
    assert.equal(r.out.reason, 'mockNeedsOk')
    assert.equal(r.out.message, failure('en', 'mockNeedsOk'))
    assert.ok(r.out.notices.includes(text('en', 'mockShared')))
    assert.deepEqual(d.rec.spawned, [])
  })

  it('제품형 + --allow-mock 이면 데몬 인자에 --allow-mock, 알림에 가짜 로그인 공유', async () => {
    const site = makeSite({ name: 'x', dependencies: { '@launch-factory/core': '1.0.0' } })
    const d = fakes({ steps: [readyBy(site, { product: true })] })
    const r = await main(['start', '--site', site, '--allow-mock', '--lang', 'en'], d)
    assert.equal(r.code, 0)
    assert.ok(d.rec.spawned[0].args.includes('--allow-mock'))
    assert.ok(r.out.notices.includes(text('en', 'mockShared')))
  })

  it('쓸 수 있는 터널 도구가 없으면 데몬을 띄우지 않고 종료 3(need install) + 설치 계획', async () => {
    const site = makeSite()
    const d = fakes({ exists: (f) => f.endsWith('package.json') })
    const r = await main(['start', '--site', site, '--lang', 'en'], d)
    assert.equal(r.code, 3)
    assert.equal(r.out.need, 'install')
    assert.equal(r.out.provider, 'cloudflare')
    assert.ok(r.out.plan.steps.length > 0)
    assert.deepEqual(d.rec.spawned, [])
  })

  it('auto 에서 우선 도구(cloudflared)만 없고 대체(ssh)가 있어도, 설치 계획이 있으면 조용히 대체로 가지 않고 종료 3', async () => {
    const site = makeSite()
    const noCf = (f) => !f.endsWith('cloudflared') && !f.endsWith('cloudflared.exe')
    const d = fakes({ exists: noCf })
    const r = await main(['start', '--site', site], d)
    assert.equal(r.code, 3)
    assert.equal(r.out.need, 'install')
    assert.deepEqual(d.rec.spawned, [])
    // 대체를 이름으로 고르면 진행한다
    const d2 = fakes({ exists: noCf, steps: [readyBy(site, { provider: 'localhostrun' })] })
    const r2 = await main(['start', '--site', site, '--provider', 'localhostrun'], d2)
    assert.equal(r2.code, 0)
    assert.equal(d2.rec.spawned.length, 1)
  })

  it('이미 살아 있는 세션이 있으면 새로 안 띄우고 그 상태를 alreadyRunning 과 함께 낸다(종료 0)', async () => {
    const site = makeSite()
    readyBy(site)()
    const d = fakes()
    const r = await main(['start', '--site', site], d)
    assert.equal(r.code, 0)
    assert.equal(r.out.alreadyRunning, true)
    assert.equal(r.out.status, 'ready')
    assert.equal(r.out.url, 'https://abc.trycloudflare.com')
    assert.deepEqual(d.rec.spawned, [])
  })

  it('남은 옛 상태(데몬이 죽은 ready)는 지우고 새로 띄운다', async () => {
    const site = makeSite()
    readyBy(site, { url: 'https://old.trycloudflare.com', pids: { daemon: 999, server: 11, tunnel: 22 } })()
    const d = fakes({ isAlive: (pid) => pid === 4242, steps: [readyBy(site, { url: 'https://new.trycloudflare.com' })] })
    const r = await main(['start', '--site', site], d)
    assert.equal(d.rec.spawned.length, 1)
    assert.equal(r.out.url, 'https://new.trycloudflare.com')
  })

  it('failed 가 되면 종료 1 + reason + 해요체 message + 로그 위치', async () => {
    const site = makeSite()
    const d = fakes({ steps: [() => writeState(site, { status: 'failed', reason: 'buildFailed', pids: { daemon: null } })] })
    const r = await main(['start', '--site', site, '--lang', 'ko'], d)
    assert.equal(r.code, 1)
    assert.equal(r.out.status, 'failed')
    assert.equal(r.out.reason, 'buildFailed')
    assert.equal(r.out.message, failure('ko', 'buildFailed'))
    assert.equal(r.out.log, join('.tmp', 'tunnel', 'tunnel.log'))
  })

  it('데몬이 상태 없이 죽으면 기다리지 않고 종료 1(unexpected)', async () => {
    const site = makeSite()
    const d = fakes({ isAlive: () => false })
    const r = await main(['start', '--site', site], d)
    assert.equal(r.code, 1)
    assert.equal(r.out.reason, 'unexpected')
  })

  it('준비 한도(60분)를 넘기면 데몬을 끄고 종료 1(timeout)', async () => {
    const site = makeSite()
    let t = 0
    const d = fakes({ now: () => (t += 20 * 60_000) })
    const r = await main(['start', '--site', site], d)
    assert.equal(r.code, 1)
    assert.equal(r.out.reason, 'timeout')
    assert.ok(d.rec.killed.includes(4242))
  })

  it('폴더가 없거나 package.json 이 없으면 noPackage 로 종료 1, 데몬은 없다', async () => {
    const empty = mkdtempSync(join(tmpdir(), 'tunnel-cli-empty-'))
    dirs.push(empty)
    for (const site of [empty, join(empty, 'nope')]) {
      const d = fakes({ exists: (f) => !f.endsWith('package.json') && !f.includes('nope') })
      const r = await main(['start', '--site', site], d)
      assert.equal(r.code, 1)
      assert.equal(r.out.reason, 'noPackage')
      assert.deepEqual(d.rec.spawned, [])
    }
  })
})

describe('status', () => {
  it('상태가 없으면 none', async () => {
    const r = await main(['status', '--site', makeSite()], fakes())
    assert.deepEqual([r.code, r.out.status], [0, 'none'])
  })
  it('ready 이고 데몬이 살아 있으면 alive true + 주소 + 알림', async () => {
    const site = makeSite()
    readyBy(site, { expiresAt: new Date(Date.now() + 30 * 60_000).toISOString() })()
    const r = await main(['status', '--site', site, '--lang', 'en'], fakes({ now: () => Date.now() }))
    assert.equal(r.out.status, 'ready')
    assert.equal(r.out.alive, true)
    assert.equal(r.out.url, 'https://abc.trycloudflare.com')
    assert.ok(r.out.notices.length >= 5)
  })
  it('파일은 ready 인데 데몬이 죽었으면 alive false, 주소·알림은 없다', async () => {
    const site = makeSite()
    readyBy(site)()
    const r = await main(['status', '--site', site], fakes({ isAlive: () => false }))
    assert.equal(r.out.alive, false)
    assert.equal(r.out.url, undefined)
    assert.equal(r.out.notices, undefined)
  })
})

describe('stop', () => {
  it('데몬 → 터널 → 서버 순으로 나무째 끄고 stopped 로 정리한다', async () => {
    const site = makeSite()
    readyBy(site)()
    const d = fakes()
    const r = await main(['stop', '--site', site], d)
    assert.equal(r.code, 0)
    assert.equal(r.out.status, 'stopped')
    assert.deepEqual(d.rec.killed, [4242, 22, 11])
    const s = readState(site)
    assert.equal(s.status, 'stopped')
    assert.equal(s.url, undefined)
    assert.equal(s.pids, undefined)
  })
  it('상태가 없으면 none, 아무것도 안 끈다', async () => {
    const d = fakes()
    const r = await main(['stop', '--site', makeSite()], d)
    assert.equal(r.out.status, 'none')
    assert.deepEqual(d.rec.killed, [])
  })
})

describe('serve(내부 명령)', () => {
  it('runSession 에 옵션과 종료 신호를 넘기고 출력은 없다', async () => {
    const site = makeSite()
    let seen
    const r = await main(['serve', '--site', site, '--provider', 'cloudflare', '--minutes', '30', '--allow-mock', '--lang', 'en'], fakes({ run: async (opts) => { seen = opts; return { status: 'stopped' } } }))
    assert.equal(r.code, 0)
    assert.equal(r.out, undefined)
    assert.deepEqual({ ...seen, signal: typeof seen.signal }, { site, providerId: 'cloudflare', minutes: 30, allowMock: true, lang: 'en', signal: 'object' })
  })
})

describe('비밀', () => {
  it('환경의 비밀 값은 출력·상태 파일·데몬 환경 어디에도 없다', async () => {
    const site = makeSite()
    const env = { PATH: '/bin', VERCEL_TOKEN: 'secret-xyz-123', PEXELS_API_KEY: 'secret-xyz-123' }
    const d = fakes({ env, steps: [readyBy(site)] })
    const r = await main(['start', '--site', site], d)
    const seen = JSON.stringify([r.out, d.rec.stderr, readFileSync(stateFile(site), 'utf8')])
    assert.doesNotMatch(seen, /secret-xyz-123/)
    assert.equal(d.rec.spawned[0].opts.env.VERCEL_TOKEN, undefined)
    assert.equal(d.rec.spawned[0].opts.env.PEXELS_API_KEY, undefined)
    assert.equal(d.rec.spawned[0].opts.env.PATH, '/bin')
  })
})
