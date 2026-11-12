// 보안 수정 D 시험 — 로컬 서버·터널 수명(대장 wf-tunnel-session-race-001 · wf-qa-orphan-listener-001).
//   #5 미리보기 터널: 두 시작이 겹치면 공개 터널이 둘 생기고 하나만 상태 파일에 남았다. 이제 시작 잠금(start.lock)과 세션 id(상태 소유권)가 한 세션만 이기게 하고,
//      중지는 상태에 적힌 소유 PID 만 끄고 실제로 끝나기를 기다리며, 그 사이 다른 세션이 가져간 상태는 덮지 않는다.
//   #6 소비자 QA 서버: next start 를 -H 없이 띄워 모든 인터페이스(0.0.0.0)에 열렸고 정리는 Windows 전용 taskkill 뿐이라 POSIX 에서 서버가 남았다. 이제 127.0.0.1 에만 열고 나무째(POSIX 는 묶음째) 끈다.
// 진짜 프로세스는 가짜 next(http 서버 + 손자 프로세스 하나)와 잠자는 node 뿐이다 — 공개 터널·네트워크 밖 접속은 없다. 새 API 는 이름공간·동적 import 로 불러 옛 코드에서도 파일이 읽히고 시험이 실패로 갈린다.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, it } from 'node:test'
import * as consumerInstall from '../qa/consumer-install.mjs'
import { startSite } from '../stamp/qa.mjs'
import { startServer } from '../stamp/run-proc.mjs'
import { main } from '../tunnel/preview-link.mjs'
import { loadProviders } from '../tunnel/providers.mjs'
import { runSession } from '../tunnel/session.mjs'
import * as state from '../tunnel/state.mjs'

const lockMod = await import('../tunnel/start-lock.mjs').catch(() => null)

const dirs = []
const kids = []
const tmp = (prefix) => { const d = mkdtempSync(join(tmpdir(), prefix)); dirs.push(d); return d }
const makeSite = () => { const d = tmp('wf-sec-d-site-'); writeFileSync(join(d, 'package.json'), JSON.stringify({ name: 'x' })); return d }
afterEach(() => {
  while (kids.length) { try { process.kill(kids.pop(), 'SIGKILL') } catch { /* 이미 끝났다 */ } }
  while (dirs.length) rmSync(dirs.pop(), { recursive: true, force: true })
})

const SESSION_A = 'aaaaaaaa-0000-4000-8000-000000000001'
const SESSION_B = 'bbbbbbbb-0000-4000-8000-000000000002'
const lockPath = (site) => join(site, '.tmp', 'tunnel', 'start.lock')
const alive = (pid) => { try { process.kill(pid, 0); return true } catch (e) { return e?.code === 'EPERM' } }
const delay = (ms) => new Promise((r) => setTimeout(r, ms))
const freePort = () => new Promise((res) => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => res(port)) }) })

/** 다른 세션이 상태를 가져간 모양을 파일로 직접 만든다(상태 API 와 무관) */
function takeOver(site, sessionId) {
  mkdirSync(join(site, '.tmp', 'tunnel'), { recursive: true })
  writeFileSync(join(site, '.tmp', 'tunnel', 'state.json'), JSON.stringify({ sessionId, status: 'preparing', site, pids: { daemon: 999 } }))
}
const readJson = (site) => JSON.parse(readFileSync(join(site, '.tmp', 'tunnel', 'state.json'), 'utf8'))

const providers = loadProviders()
/** 입구 CLI 의 가짜 의존. 데몬은 띄우지 않고 spawn 만 기록한다. */
function fakes(over = {}) {
  const rec = { spawned: [], killed: [] }
  const deps = {
    rec,
    providers,
    platform: 'linux',
    env: { PATH: '/bin' },
    exists: () => true,
    osRelease: 'ID=ubuntu\n',
    spawn: (cmd, args) => { const pid = 4242 + rec.spawned.length; rec.spawned.push({ cmd, args }); return { pid, unref: () => {} } },
    kill: (pid) => { rec.killed.push(pid) },
    onSignals: () => () => {},
    isAlive: () => true,
    sleep: async () => {},
    now: () => 0,
    stderr: () => {},
    ...over,
  }
  return deps
}
const readyBy = (site) => () => state.writeState(site, { status: 'ready', site, provider: 'cloudflare', url: 'https://abc.trycloudflare.com', port: 3000, product: false, startedAt: 't', expiresAt: 'e', pids: { server: 11, tunnel: 22 } })

describe('#5 터널 시작 경쟁', () => {
  it('두 시작이 겹쳐도 데몬은 하나만 뜨고 다른 쪽은 그 세션을 알려 준다', async () => {
    const site = makeSite()
    // A 의 데몬이 준비를 마친다 — 한 틱 양보한 뒤라 B 가 시작 명령을 받는 시점에는 아직 상태 파일에 아무것도 없다(옛 코드의 틈)
    const a = fakes({ sleep: async () => { await Promise.resolve(); readyBy(site)() } })
    const b = fakes()
    const [ra, rb] = await Promise.all([main(['start', '--site', site], a), main(['start', '--site', site], b)])
    assert.equal(a.rec.spawned.length + b.rec.spawned.length, 1, '데몬(=공개 터널 주인)이 둘 이상 떴다')
    const flags = [ra.out.alreadyRunning === true, rb.out.alreadyRunning === true].sort()
    assert.deepEqual(flags, [false, true], '한 쪽은 새 세션, 다른 쪽은 alreadyRunning')
    assert.deepEqual([ra.code, rb.code], [0, 0])
  })

  it('살아 있는 소유자가 잡은 잠금이 있으면 풀릴 때까지 데몬을 띄우지 않는다', async () => {
    assert.ok(lockMod, '시작 잠금 모듈이 있다')
    const site = makeSite()
    mkdirSync(join(site, '.tmp', 'tunnel'), { recursive: true })
    writeFileSync(lockPath(site), JSON.stringify({ pid: 777, token: 'other', createdAt: 0 }))
    let sleeps = 0
    let spawnedAtFirstSleep = -1
    const d = fakes({
      isAlive: (pid) => pid === 777 || pid === 4242,
      sleep: async () => {
        sleeps += 1
        if (sleeps === 1) { spawnedAtFirstSleep = d.rec.spawned.length; rmSync(lockPath(site)) } // 소유자가 끝냈다
        else readyBy(site)()
      },
    })
    const r = await main(['start', '--site', site], d)
    assert.equal(spawnedAtFirstSleep, 0, '잠금이 풀리기 전에 데몬을 띄웠다')
    assert.equal(r.code, 0)
    assert.equal(d.rec.spawned.length, 1)
  })

  it('소유 PID 가 죽은 낡은 잠금은 빼앗고 시작한다(남은 잠금이 시작을 영영 막지 않는다)', async () => {
    const site = makeSite()
    mkdirSync(join(site, '.tmp', 'tunnel'), { recursive: true })
    writeFileSync(lockPath(site), JSON.stringify({ pid: 888, token: 'dead-owner', createdAt: 0 }))
    const d = fakes({ isAlive: (pid) => pid !== 888, sleep: async () => { readyBy(site)() } })
    const r = await main(['start', '--site', site], d)
    assert.equal(r.code, 0)
    assert.equal(d.rec.spawned.length, 1)
    assert.equal(existsSync(lockPath(site)), false, '시작이 끝나면 잠금이 남지 않는다')
  })

  it('소유 PID 가 살아 있어도 준비 한도를 넘긴 잠금은 빼앗는다', async () => {
    const site = makeSite()
    mkdirSync(join(site, '.tmp', 'tunnel'), { recursive: true })
    writeFileSync(lockPath(site), JSON.stringify({ pid: 777, token: 'hung-owner', createdAt: 0 }))
    const d = fakes({ now: () => 61 * 60_000, isAlive: () => true, sleep: async () => { readyBy(site)() } })
    const r = await main(['start', '--site', site], d)
    assert.equal(r.code, 0)
    assert.equal(d.rec.spawned.length, 1)
  })

  it('데몬을 띄우지 않고 끝나는 길(제품형 확인·도구 없음)에서도 잠금이 남지 않는다', async () => {
    const site = makeSite()
    writeFileSync(join(site, 'package.json'), JSON.stringify({ name: 'x', dependencies: { '@launch-factory/core': '1.0.0' } }))
    const r = await main(['start', '--site', site], fakes())
    assert.equal(r.code, 3)
    assert.equal(existsSync(lockPath(site)), false)
  })

  it('상태 쓰기: 다른 세션 id 로 쓰면 거절하고 파일은 그대로, 같은 id 와 id 없는 쓰기는 통과한다', () => {
    const site = makeSite()
    takeOver(site, SESSION_B)
    const before = readFileSync(join(site, '.tmp', 'tunnel', 'state.json'), 'utf8')
    assert.ok(state.StateOwnerError, '소유권 오류 타입이 있다')
    assert.throws(() => state.writeState(site, { status: 'ready', url: 'https://old.example.test' }, { owner: SESSION_A }), state.StateOwnerError)
    assert.equal(readFileSync(join(site, '.tmp', 'tunnel', 'state.json'), 'utf8'), before, '거절된 쓰기가 파일을 바꿨다')
    state.writeState(site, { status: 'building' }, { owner: SESSION_B })
    assert.equal(readJson(site).status, 'building')
    state.writeState(site, { status: 'starting' }) // owner 를 안 주는 옛 쓰기는 그대로 된다
    assert.equal(readJson(site).status, 'starting')
    assert.equal(readJson(site).sessionId, SESSION_B)
  })

  it('데몬이 소유권을 잃으면(새 세션이 상태를 가져감) 자기 터널·서버를 끄고 새 세션의 상태를 덮지 않는다', async () => {
    const site = makeSite()
    const calls = []
    let release
    const hold = new Promise((r) => { release = r })
    const d = {
      providers,
      kindOf: () => ({ product: false }),
      exportOf: () => null,
      envOf: () => ({}),
      prepare: async () => ({}),
      serve: async () => ({ port: 4321, pid: 111, stop: async () => { calls.push('server.stop') } }),
      open: async () => {
        takeOver(site, SESSION_B) // 터널을 여는 동안 새 세션이 상태를 가져갔다
        return { url: 'https://old.example.test', pid: 222, exited: hold, stop: async () => { calls.push('tunnel.stop') } }
      },
      find: () => ({ found: true }),
      wait: () => hold,
      now: () => 1_000_000,
    }
    state.writeState(site, { sessionId: SESSION_A, status: 'preparing', site })
    const run = runSession({ site, providerId: 'auto', minutes: 30, allowMock: false, lang: 'ko', sessionId: SESSION_A }, d)
    const settled = await Promise.race([run, delay(1500).then(() => 'hung')])
    release() // 옛 코드는 ready 로 쓰고 영원히 기다린다 — 시험이 풀어 준다
    assert.notEqual(settled, 'hung', '소유권을 잃고도 세션이 계속 돌았다')
    assert.deepEqual(calls.sort(), ['server.stop', 'tunnel.stop'], '기록되지 않은 터널·서버가 남았다')
    const s = readJson(site)
    assert.equal(s.sessionId, SESSION_B, '새 세션의 상태가 덮였다')
    assert.equal(s.status, 'preparing')
    assert.equal(s.url, undefined)
  })

  it('중지는 읽은 세션의 PID 만 끄고, 그 사이 새 세션이 가져간 상태를 stopped 로 덮지 않는다', async () => {
    const site = makeSite()
    state.writeState(site, { sessionId: SESSION_A, status: 'ready', site, url: 'https://abc.trycloudflare.com', pids: { daemon: 4242, server: 11, tunnel: 22 } })
    const d = fakes()
    d.isAlive = (pid) => !d.rec.killed.includes(pid)
    const kill = d.kill
    d.kill = (pid) => { kill(pid); if (d.rec.killed.length === 1) takeOver(site, SESSION_B) }
    const r = await main(['stop', '--site', site], d)
    assert.deepEqual(d.rec.killed, [4242, 22, 11], '읽은 세션의 PID 만')
    assert.equal(r.code, 0)
    const s = readJson(site)
    assert.equal(s.sessionId, SESSION_B, '새 세션의 상태가 덮였다')
    assert.equal(s.status, 'preparing')
  })

  it('중지는 이미 죽은 PID 를 건드리지 않는다(다른 프로세스가 PID 를 물려받았을 수 있다)', async () => {
    const site = makeSite()
    state.writeState(site, { sessionId: SESSION_A, status: 'ready', site, pids: { daemon: 4242, server: 11, tunnel: 22 } })
    const d = fakes()
    d.isAlive = (pid) => pid !== 22 && !d.rec.killed.includes(pid)
    const r = await main(['stop', '--site', site], d)
    assert.equal(r.code, 0)
    assert.deepEqual(d.rec.killed, [4242, 11])
  })

  it('중지는 소유 프로세스가 실제로 끝난 뒤에야 stopped 로 적는다', async () => {
    const site = makeSite()
    state.writeState(site, { sessionId: SESSION_A, status: 'ready', site, pids: { daemon: 4242, server: 11, tunnel: 22 } })
    let sleeps = 0
    let statusWhenLastDied = null
    const d = fakes({ sleep: async () => { sleeps += 1 } })
    d.isAlive = (pid) => {
      if (!d.rec.killed.includes(pid)) return true
      if (sleeps >= 3) { statusWhenLastDied = readJson(site).status; return false }
      return true // 끈 뒤에도 잠깐 살아 있다
    }
    const r = await main(['stop', '--site', site], d)
    assert.equal(r.code, 0)
    assert.equal(r.out.status, 'stopped')
    assert.ok(sleeps >= 3, '끝나기를 기다리지 않았다')
    assert.equal(statusWhenLastDied, 'ready', '프로세스가 끝나기 전에 stopped 로 적었다')
  })

  it('끝나지 않는 프로세스가 있으면 stopped 로 적지 않고 실패(종료 1)로 알린다', async () => {
    const site = makeSite()
    state.writeState(site, { sessionId: SESSION_A, status: 'ready', site, pids: { daemon: 4242, server: 11 } })
    const d = fakes({ isAlive: (pid) => pid === 11 }) // 서버가 안 죽는다
    const r = await main(['stop', '--site', site], d)
    assert.equal(r.code, 1)
    assert.equal(r.out.status, 'failed')
    assert.equal(readJson(site).status, 'ready', '끄지 못했는데 stopped 로 적었다')
  })
})

describe('#5 정상 경로 회귀', () => {
  it('시작 → 중지 → 다시 시작: 잠금이 남지 않고 세션 id 가 새로 바뀐다', async () => {
    const site = makeSite()
    const d1 = fakes({ sleep: async () => { readyBy(site)() } })
    const r1 = await main(['start', '--site', site], d1)
    assert.equal(r1.out.status, 'ready')
    const id1 = readJson(site).sessionId
    assert.match(id1, /^[0-9a-f-]{8,64}$/)
    assert.equal(existsSync(lockPath(site)), false)

    const d2 = fakes()
    d2.isAlive = (pid) => !d2.rec.killed.includes(pid)
    const stopped = await main(['stop', '--site', site], d2)
    assert.equal(stopped.out.status, 'stopped')
    assert.equal(readJson(site).status, 'stopped')
    assert.equal(existsSync(lockPath(site)), false)

    const d3 = fakes({ sleep: async () => { readyBy(site)() }, isAlive: (pid) => pid >= 4242 })
    const r2 = await main(['start', '--site', site], d3)
    assert.equal(r2.out.status, 'ready')
    assert.equal(d3.rec.spawned.length, 1)
    assert.notEqual(readJson(site).sessionId, id1)
  })

  it('진짜 프로세스: 중지가 상태에 적힌 PID 를 실제로 끄고(Windows 는 taskkill) 다른 프로세스는 그대로 둔다', async () => {
    const site = makeSite()
    const victim = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore', windowsHide: true, detached: process.platform !== 'win32' })
    const bystander = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore', windowsHide: true })
    kids.push(victim.pid, bystander.pid)
    state.writeState(site, { sessionId: SESSION_A, status: 'ready', site, pids: { daemon: victim.pid } })
    const r = await main(['stop', '--site', site], { sleep: (ms) => delay(ms) })
    assert.equal(r.code, 0)
    assert.equal(r.out.status, 'stopped')
    assert.equal(alive(victim.pid), false, '소유 프로세스가 안 죽었다')
    assert.equal(alive(bystander.pid), true, '상태에 없는 프로세스가 죽었다')
    assert.equal(readJson(site).status, 'stopped')
  })
})

// ── #6 QA 서버 ──────────────────────────────────────────────────────────────

/** 가짜 next: -H 를 안 받으면 진짜 next 처럼 0.0.0.0 에 열고, 손자 프로세스 하나를 띄운다. 연 주소와 PID 를 bound.json 에 적는다. */
const FAKE_NEXT = `
const http = require('node:http')
const fs = require('node:fs')
const { spawn } = require('node:child_process')
const a = process.argv
const val = (flag, dflt) => { const i = a.indexOf(flag); return i < 0 ? dflt : a[i + 1] }
const host = val('-H', '0.0.0.0')
const port = Number(val('-p', '3000'))
const grand = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' })
const srv = http.createServer((q, r) => { r.setHeader('content-type', 'text/plain'); r.end('ok') })
srv.listen(port, host, () => fs.writeFileSync('bound.json', JSON.stringify({ address: srv.address().address, pid: process.pid, grand: grand.pid })))
`
function fakeNextSite() {
  const dir = tmp('wf-sec-d-next-')
  const bin = join(dir, 'node_modules', 'next', 'dist', 'bin')
  mkdirSync(bin, { recursive: true })
  writeFileSync(join(bin, 'next'), FAKE_NEXT)
  mkdirSync(join(dir, '.next'), { recursive: true })
  writeFileSync(join(dir, '.next', 'BUILD_ID'), 'x')
  return { dir, nextBin: join(bin, 'next') }
}
const bound = (dir) => JSON.parse(readFileSync(join(dir, 'bound.json'), 'utf8'))

describe('#6 소비자 QA 서버', () => {
  it('쪽 검사 서버(startSite)는 127.0.0.1 에만 열고 stop 뒤 서버와 손자가 모두 사라진다', async () => {
    const { dir } = fakeNextSite()
    const srv = await startSite(dir, { timeoutMs: 15_000 })
    const b = bound(dir)
    kids.push(b.pid, b.grand)
    assert.equal(b.address, '127.0.0.1')
    await srv.stop()
    assert.equal(alive(b.pid), false, '서버가 남았다')
    assert.equal(alive(b.grand), false, '손자 프로세스가 남았다')
  })

  it('소비자 설치 검증의 서버(probe)는 127.0.0.1 에만 열고, 끝나면 나무째 끈다', async () => {
    assert.equal(typeof consumerInstall.probe, 'function', 'probe 를 시험할 수 있게 내보낸다')
    const { dir, nextBin } = fakeNextSite()
    const port = await freePort()
    const log = []
    const ok = await consumerInstall.probe(dir, port, [{ path: '/', type: 'text/plain' }], log, { nextBin, waitSeconds: 15, env: process.env })
    const b = bound(dir)
    kids.push(b.pid, b.grand)
    assert.equal(ok, true, JSON.stringify(log))
    assert.equal(b.address, '127.0.0.1', 'next 기본값 0.0.0.0 으로 열렸다')
    assert.equal(alive(b.pid), false, '서버가 남았다')
    assert.equal(alive(b.grand), false, '손자 프로세스가 남았다')
  })

  it('정상: 공용 startServer 도 같은 서버를 켜고, stop 은 끝날 때까지 기다린다', async () => {
    const { dir } = fakeNextSite()
    const srv = await startServer(dir, process.env, '/', { waitMs: 15_000 })
    const b = bound(dir)
    kids.push(b.pid, b.grand)
    assert.equal(b.address, '127.0.0.1')
    const r = await fetch(`http://127.0.0.1:${srv.port}/`)
    assert.equal(r.status, 200)
    await srv.stop()
    assert.equal(alive(b.pid), false)
    assert.equal(alive(b.grand), false)
  })
})
