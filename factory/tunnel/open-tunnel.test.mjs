// open-tunnel.mjs 시험(sitebrew v0.2.0 계획 4 Task 7) — 진짜 자식 프로세스(fixtures/fake-tunnel.mjs 를 process.execPath 로)와 가짜 fetch 로 돈다. 진짜 터널은 열지 않는다.
//   모든 경로는 끝나고 남은 자식이 없음을 확인한다(process.kill(pid, 0) 이 던져야 한다).
import assert from 'node:assert/strict'
import { spawn as nodeSpawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { afterEach, test } from 'node:test'
import { openTunnel } from './open-tunnel.mjs'
import { loadProviders } from './providers.mjs'

const FAKE = fileURLToPath(new URL('./fixtures/fake-tunnel.mjs', import.meta.url))
const URL_OK = 'https://fake-abc-123.trycloudflare.com'
const base = loadProviders().providers.cloudflare
const prov = (over = {}) => ({ ...base, readyMs: 5000, reachMs: 3000, ...over })
const cmd = (mode) => [process.execPath, FAKE, mode]
const ok200 = async () => ({ status: 200 })

/** 띄운 자식 PID 를 모으는 spawn */
const pids = []
const recordingSpawn = (...a) => { const ch = nodeSpawn(...a); pids.push(ch.pid); return ch }
// 손자는 이 시험 프로세스의 자식이 아니라 컨테이너에서 거두는 이가 없으면 죽은 뒤 좀비로 남는다 — /proc 에서 Z 상태이면 끝난 것으로 본다(없는 환경은 kill(pid, 0) 만)
const zombie = (pid) => { try { return /^State:\s+Z/m.test(readFileSync(`/proc/${pid}/status`, 'utf8')) } catch { return false } }
const gone = (pid) => { try { process.kill(pid, 0) } catch { return true } return zombie(pid) }
const base_ctx = (over = {}) => ({ spawn: recordingSpawn, fetch: ok200, command: cmd('url'), intervalMs: 20, ...over })

afterEach(async () => {
  // 시험이 실패해도 남은 자식은 없어야 한다 — 남았으면 여기서 끄고 실패로 알린다
  const left = pids.filter((p) => p && !gone(p))
  for (const p of left) { try { process.kill(-p, 'SIGKILL') } catch { /* 이미 끝남 */ } }
  pids.length = 0
  await new Promise((r) => setTimeout(r, 50))
  assert.equal(left.length, 0, `남은 자식 프로세스: ${left.join(',')}`)
})

const rejects = async (promise) => { try { await promise } catch (e) { return e } throw new Error('던져야 했다') }

test('주소 출력 → 도달 → 성공, stop() 뒤 프로세스가 없다', async () => {
  const t = await openTunnel(prov(), 8080, base_ctx())
  assert.equal(t.url, URL_OK)
  assert.equal(typeof t.pid, 'number')
  assert.ok(!gone(t.pid))
  await t.stop()
  assert.ok(gone(t.pid))
  await t.stop() // 두 번째 호출도 안전하다
})

test('stop() 은 손자 프로세스까지 PID 나무째 끈다', async () => {
  const lines = []
  const t = await openTunnel(prov(), 8080, base_ctx({ command: cmd('grandchild'), onLine: (l) => lines.push(l) }))
  const g = Number(lines.join('\n').match(/grandchild=(\d+)/)?.[1])
  assert.ok(g > 0)
  pids.push(g)
  assert.ok(!gone(g))
  await t.stop()
  await new Promise((r) => setTimeout(r, 100))
  assert.ok(gone(t.pid))
  assert.ok(gone(g))
})

test('기본 인자는 [도구, ...providerArgs] — command 가 없으면 p.tool 을 그대로 부른다', async () => {
  const seen = []
  const e = await rejects(openTunnel(prov({ tool: 'definitely-not-a-real-tool-xyz' }), 8080, { spawn: (c, a, o) => { seen.push([c, a]); return recordingSpawn(c, a, o) }, fetch: ok200 }))
  assert.equal(e.reason, 'toolMissing')
  assert.equal(seen[0][0], 'definitely-not-a-real-tool-xyz')
  assert.deepEqual(seen[0][1], ['tunnel', '--no-autoupdate', '--url', 'http://127.0.0.1:8080'])
})

test('주소가 안 나오면 urlNotFound 이고 프로세스가 없다', async () => {
  const e = await rejects(openTunnel(prov({ readyMs: 400 }), 8080, base_ctx({ command: cmd('none') })))
  assert.equal(e.reason, 'urlNotFound')
  assert.match(e.tail, /still starting/)
  assert.ok(gone(pids[0]))
})

test('api.trycloudflare.com 만 나오면 urlNotFound', async () => {
  const e = await rejects(openTunnel(prov({ readyMs: 400 }), 8080, base_ctx({ command: cmd('api-only') })))
  assert.equal(e.reason, 'urlNotFound')
  assert.ok(gone(pids[0]))
})

test('주소는 나왔는데 fetch 가 계속 502 면 notReachable 이고 프로세스가 없다', async () => {
  let n = 0
  const e = await rejects(openTunnel(prov({ reachMs: 200 }), 8080, base_ctx({ fetch: async () => { n += 1; return { status: 502 } } })))
  assert.equal(e.reason, 'notReachable')
  assert.ok(n >= 2)
  assert.ok(gone(pids[0]))
})

test('fetch 가 던져도(연결 거부) 같은 notReachable', async () => {
  const e = await rejects(openTunnel(prov({ reachMs: 150 }), 8080, base_ctx({ fetch: async () => { throw new Error('ECONNREFUSED') } })))
  assert.equal(e.reason, 'notReachable')
  assert.ok(gone(pids[0]))
})

test('처음 두 번 502 뒤 200 이면 성공한다', async () => {
  const codes = [502, 502, 200]
  const t = await openTunnel(prov(), 8080, base_ctx({ fetch: async () => ({ status: codes.shift() }) }))
  assert.equal(t.url, URL_OK)
  assert.equal(codes.length, 0)
  await t.stop()
  assert.ok(gone(t.pid))
})

test('404 도 도달로 본다(500 아래)', async () => {
  const t = await openTunnel(prov(), 8080, base_ctx({ fetch: async () => ({ status: 404 }) }))
  await t.stop()
})

test('fetch 는 주소 그대로, 리다이렉트를 따라가지 않고 제한 시간 신호와 함께 부른다', async () => {
  const seen = []
  const t = await openTunnel(prov(), 8080, base_ctx({ fetch: async (u, o) => { seen.push([u, o]); return { status: 200 } } }))
  assert.equal(seen[0][0], URL_OK)
  assert.equal(seen[0][1].redirect, 'manual')
  assert.ok(seen[0][1].signal instanceof AbortSignal)
  await t.stop()
})

test('자식이 바로 종료하면 exited 와 출력 끝줄', async () => {
  const e = await rejects(openTunnel(prov(), 8080, base_ctx({ command: cmd('exit') })))
  assert.equal(e.reason, 'exited')
  assert.match(e.tail, /boom: cannot start/)
  assert.ok(gone(pids[0]))
})

test('주소를 찍고 바로 끝난 자식은 도달을 확인할 수 없어 exited', async () => {
  const e = await rejects(openTunnel(prov(), 8080, base_ctx({ command: cmd('url-exit'), fetch: async () => { throw new Error('refused') } })))
  assert.equal(e.reason, 'exited')
})

test('없는 명령은 toolMissing', async () => {
  const e = await rejects(openTunnel(prov(), 8080, base_ctx({ command: ['definitely-not-a-real-tool-xyz'] })))
  assert.equal(e.reason, 'toolMissing')
})

test('주소가 두 번에 나뉘어 와도 찾는다', async () => {
  const t = await openTunnel(prov(), 8080, base_ctx({ command: cmd('url-split') }))
  assert.equal(t.url, URL_OK)
  await t.stop()
})

test('onLine 이 출력을 줄 단위로 받는다', async () => {
  const lines = []
  const t = await openTunnel(prov(), 8080, base_ctx({ onLine: (l) => lines.push(l) }))
  await t.stop()
  assert.ok(lines.length >= 5)
  assert.ok(lines.every((l) => !l.includes('\n')))
  assert.ok(lines.some((l) => l.includes(URL_OK)))
})

test('exited 약속은 자식이 끝나면 풀린다', async () => {
  const t = await openTunnel(prov(), 8080, base_ctx())
  let done = false
  t.exited.then(() => { done = true })
  assert.equal(done, false)
  await t.stop()
  await t.exited
  assert.equal(done, true)
})

test('tail 에는 홈 폴더 경로가 없다', async () => {
  const e = await rejects(openTunnel(prov(), 8080, base_ctx({ command: cmd('home') })))
  assert.equal(e.reason, 'exited')
  assert.ok(!e.tail.includes(homedir()), e.tail)
  assert.match(e.tail, /cert\.pem/)
})

test('기본 자식 환경에는 비밀 이름이 없고, 넘긴 값이 출력에 나와도 tail 에서 가린다', async () => {
  const had = process.env.VERCEL_TOKEN
  process.env.VERCEL_TOKEN = 'secret-xyz-999'
  try {
    const a = await rejects(openTunnel(prov(), 8080, base_ctx({ command: cmd('env') })))
    assert.match(a.tail, /token=none/)
    assert.ok(!a.tail.includes('secret-xyz-999'))
    const b = await rejects(openTunnel(prov(), 8080, base_ctx({ command: cmd('env'), env: { ...process.env, VERCEL_TOKEN: 'secret-abc-111' } })))
    assert.ok(!b.tail.includes('secret-abc-111'))
    assert.match(b.tail, /token=\*\*\*/)
  } finally {
    if (had === undefined) delete process.env.VERCEL_TOKEN
    else process.env.VERCEL_TOKEN = had
  }
})

test('잘못된 포트는 자식을 띄우기 전에 던진다', async () => {
  const before = pids.length
  await assert.rejects(openTunnel(prov(), '80; rm', base_ctx({ command: undefined })), /port/)
  assert.equal(pids.length, before)
})
