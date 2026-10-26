// 상태 파일 시험(계획 4 Task 5) — 임시 폴더에서 쓰고 읽는다.
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import * as realFs from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, test } from 'node:test'
import { clearState, isAlive, readState, stateFile, writeState } from './state.mjs'

const root = mkdtempSync(join(tmpdir(), 'wf-state-'))
after(() => rmSync(root, { recursive: true, force: true }))
let n = 0
const site = () => join(root, `s${n++}`)

test('stateFile: <site>/.tmp/tunnel/state.json', () => {
  assert.equal(stateFile('/x/y'), join('/x/y', '.tmp', 'tunnel', 'state.json'))
})

test('쓰기 → 읽기 왕복', () => {
  const dir = site()
  assert.equal(readState(dir), null)
  const state = { status: 'preparing', site: dir, product: false, pids: { daemon: 11 }, startedAt: '2026-10-22T00:00:00.000Z' }
  writeState(dir, state)
  assert.deepEqual(readState(dir), state)
})

test('합치기: 바뀐 칸만 덮고 pids 는 칸 단위로 합친다', () => {
  const dir = site()
  writeState(dir, { status: 'starting', site: dir, pids: { daemon: 1 } })
  writeState(dir, { status: 'ready', url: 'https://a-b.trycloudflare.com', pids: { server: 2, tunnel: 3 } })
  assert.deepEqual(readState(dir), { status: 'ready', site: dir, url: 'https://a-b.trycloudflare.com', pids: { daemon: 1, server: 2, tunnel: 3 } })
  writeState(dir, { reason: null, pids: { tunnel: null } })
  assert.deepEqual(readState(dir).pids, { daemon: 1, server: 2 })
  assert.equal('reason' in readState(dir), false)
})

test('깨진 JSON 이나 객체가 아닌 파일은 null', () => {
  const dir = site()
  mkdirSync(join(dir, '.tmp', 'tunnel'), { recursive: true })
  writeFileSync(stateFile(dir), '{broken')
  assert.equal(readState(dir), null)
  writeFileSync(stateFile(dir), '[1,2]')
  assert.equal(readState(dir), null)
  writeState(dir, { status: 'ready' }) // 깨진 파일 위에도 쓸 수 있다
  assert.equal(readState(dir).status, 'ready')
})

test('허용 밖 키는 파일에 들어가지 않는다(비밀 이름 값 포함)', () => {
  const dir = site()
  writeState(dir, { status: 'ready', site: dir, VERCEL_TOKEN: 'secret-xyz', env: { A: 'secret-xyz' }, pids: { server: 5, evil: 6, tunnel: 'x' } })
  const raw = readFileSync(stateFile(dir), 'utf8')
  assert.doesNotMatch(raw, /secret-xyz|VERCEL_TOKEN|evil/)
  assert.deepEqual(readState(dir).pids, { server: 5 })
})

test('원자적 쓰기: 임시 파일에 쓰고 rename, 임시 파일이 남지 않는다', () => {
  const dir = site()
  const calls = []
  const fs = {
    ...realFs,
    writeFileSync: (p, ...rest) => { calls.push(['write', p]); return realFs.writeFileSync(p, ...rest) },
    renameSync: (a, b) => { calls.push(['rename', a, b]); return realFs.renameSync(a, b) },
  }
  writeState(dir, { status: 'opening' }, { fs })
  const write = calls.find((c) => c[0] === 'write')
  const rename = calls.find((c) => c[0] === 'rename')
  assert.notEqual(write[1], stateFile(dir), 'state.json 에 직접 쓰지 않는다')
  assert.equal(rename[1], write[1])
  assert.equal(rename[2], stateFile(dir))
  assert.deepEqual(readdirSync(join(dir, '.tmp', 'tunnel')), ['state.json'])
})

test('clearState: 파일을 지운다(없어도 던지지 않는다)', () => {
  const dir = site()
  writeState(dir, { status: 'ready' })
  clearState(dir)
  assert.equal(existsSync(stateFile(dir)), false)
  assert.equal(readState(dir), null)
  assert.doesNotThrow(() => clearState(dir))
})

test('isAlive: 내 PID 는 true, 없는 PID 는 false, EPERM 은 살아 있음', () => {
  assert.equal(isAlive(process.pid), true)
  assert.equal(isAlive(2147483646), false)
  for (const bad of [0, -1, 1.5, '12', null, undefined]) assert.equal(isAlive(bad), false, String(bad))
  const eperm = () => { throw Object.assign(new Error('x'), { code: 'EPERM' }) }
  const esrch = () => { throw Object.assign(new Error('x'), { code: 'ESRCH' }) }
  assert.equal(isAlive(10, eperm), true)
  assert.equal(isAlive(10, esrch), false)
})
