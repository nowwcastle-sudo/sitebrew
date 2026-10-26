// 도구 찾기·설치 계획 시험(계획 4 Task 2) — 가짜 exists 와 환경으로 돌린다. 셸도 파일 시스템도 부르지 않는다.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadProviders } from './providers.mjs'
import { findTool, installPlan } from './tools.mjs'

const { providers } = loadProviders()
const cf = providers.cloudflare
const lhr = providers.localhostrun
const has = (...files) => (p) => files.includes(p)

test('findTool: PATH 에 있으면 그 경로', () => {
  const ctx = { platform: 'linux', env: { PATH: '/usr/bin:/opt/tools' }, exists: has('/opt/tools/cloudflared') }
  assert.deepEqual(findTool(cf, ctx), { found: true, path: '/opt/tools/cloudflared' })
})

test('findTool: PATH 에 없고 알려진 자리에 있으면 그 경로', () => {
  const ctx = { platform: 'darwin', env: { PATH: '/usr/bin' }, exists: has('/opt/homebrew/bin/cloudflared') }
  assert.deepEqual(findTool(cf, ctx), { found: true, path: '/opt/homebrew/bin/cloudflared' })
})

test('findTool: 둘 다 없으면 found false', () => {
  assert.deepEqual(findTool(cf, { platform: 'linux', env: { PATH: '/usr/bin' }, exists: () => false }), { found: false })
  assert.deepEqual(findTool(cf, { platform: 'linux', env: {}, exists: () => false }), { found: false })
})

test('findTool: Windows 는 PATHEXT 확장자를 각각 본다(Path 이름도 받는다)', () => {
  const dir = 'C:\\Tools'
  const ctx = { platform: 'win32', env: { Path: `C:\\Windows;${dir}`, PATHEXT: '.COM;.EXE;.BAT' }, exists: has('C:\\Tools\\cloudflared.EXE') }
  assert.deepEqual(findTool(cf, ctx), { found: true, path: 'C:\\Tools\\cloudflared.EXE' })
})

test('findTool: Windows PATH 에 없으면 알려진 자리', () => {
  const known = 'C:\\Program Files (x86)\\cloudflared\\cloudflared.exe'
  const ctx = { platform: 'win32', env: { PATH: 'C:\\Windows' }, exists: has(known) }
  assert.deepEqual(findTool(cf, ctx), { found: true, path: known })
})

test('findTool: 알려진 자리가 없는 공급자(ssh)는 PATH 만 본다', () => {
  assert.deepEqual(findTool(lhr, { platform: 'linux', env: { PATH: '/usr/bin' }, exists: has('/usr/bin/ssh') }), { found: true, path: '/usr/bin/ssh' })
  assert.deepEqual(findTool(lhr, { platform: 'linux', env: { PATH: '/usr/bin' }, exists: () => false }), { found: false })
})

test('installPlan: win32 는 winget 한 단계', () => {
  const plan = installPlan(cf, { platform: 'win32', env: {}, exists: () => false })
  assert.equal(plan.supported, true)
  assert.equal(plan.steps.length, 1)
  assert.deepEqual(plan.steps[0].argv, ['winget', 'install', '--id', 'Cloudflare.cloudflared', '-e'])
})

test('installPlan: darwin 은 brew', () => {
  const plan = installPlan(cf, { platform: 'darwin', env: {}, exists: () => false })
  assert.deepEqual(plan.steps.map((s) => s.argv), [['brew', 'install', 'cloudflared']])
})

test('installPlan: ubuntu·debian 계열은 4단계(관리자 필요)', () => {
  for (const osRelease of ['ID=ubuntu\nID_LIKE=debian\n', 'ID=debian\n', 'NAME="Linux Mint"\nID=linuxmint\nID_LIKE="ubuntu debian"\n']) {
    const plan = installPlan(cf, { platform: 'linux', env: {}, exists: () => false, osRelease })
    assert.equal(plan.supported, true, osRelease)
    assert.equal(plan.steps.length, 4)
    assert.ok(plan.steps.every((s) => s.needsAdmin))
    assert.deepEqual(plan.steps.map((s) => s.textKey), ['installApt1', 'installApt2', 'installApt3', 'installApt4'])
  }
})

test('installPlan: fedora 나 os-release 가 없는 리눅스는 직접 설치 안내', () => {
  for (const osRelease of ['ID=fedora\nID_LIKE="rhel"\n', undefined, '']) {
    const plan = installPlan(cf, { platform: 'linux', env: {}, exists: () => false, osRelease })
    assert.deepEqual({ supported: plan.supported, steps: plan.steps, manual: plan.manual }, { supported: false, steps: [], manual: 'manualInstall' })
  }
})

test('installPlan: 설치 단계가 없는 공급자(ssh)는 지원 안 함', () => {
  const plan = installPlan(lhr, { platform: 'win32', env: {}, exists: () => false })
  assert.equal(plan.supported, false)
  assert.deepEqual(plan.steps, [])
})

test('installPlan: 단계는 표의 사본이라 바꿔도 표가 안 변한다', () => {
  const plan = installPlan(cf, { platform: 'darwin', env: {}, exists: () => false })
  plan.steps[0].argv.push('x')
  assert.deepEqual(cf.install.darwin[0].argv, ['brew', 'install', 'cloudflared'])
})
