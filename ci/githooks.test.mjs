// .githooks/pre-commit · pre-push 시험(P3-8 추가) — 가짜 실행 파일(받은 인자를 적고 정해 둔 종료 코드로 끝난다)로 시험한다. 진짜 gitleaks 양성 대조는 docs/qa/vr-phase3.md §10.
// 양성 대조: 가짜 gitleaks 가 1(유출 발견)로 끝나면 훅이 실패한다 · 도구가 없으면 설치 방법을 알리고 통과한다 · 인자가 gitleaks 8.30.1 의 실제 플래그다(git --staged · --log-opts).
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { findSh } from './lib/posix-sh.mjs'
import { ROOT } from './lib/split.mjs'

// Windows PowerShell 에는 PATH 에 sh 가 없다 — Git for Windows 의 sh.exe 를 찾아 쓰고, 정말 없을 때만 이유를 적고 건너뛴다(LFGATE 와 같은 고침)
const SH = findSh()
const noSh = SH ? false : 'POSIX 셸(sh)을 못 찾았다 — PATH 에 sh 가 없고 Git for Windows 의 bin\sh.exe·usr\bin\sh.exe 도 없다(git --exec-path 기준). Git for Windows 를 설치하거나 PATH 에 sh 를 둔다'

const toSh = (p) => p.split(String.fromCharCode(92)).join('/')

function setup() {
  const tmp = mkdtempSync(join(tmpdir(), 'wf-hooks-'))
  const log = join(tmp, 'args.log')
  const stub = join(tmp, 'gitleaks-stub')
  writeFileSync(stub, `#!/bin/sh\necho "$@" >> "${toSh(log)}"\nexit "\${STUB_EXIT:-0}"\n`)
  chmodSync(stub, 0o755)
  // 훅이 git rev-parse 를 부르므로 임시 저장소를 만든다
  const git = spawnSync('git', ['init', '-q', tmp], { encoding: 'utf8' })
  assert.equal(git.status, 0, git.stderr)
  writeFileSync(join(tmp, '.gitleaks.toml'), "title = 't'\n")
  return { tmp, log, stub: toSh(stub) }
}
const hook = (name) => join(ROOT, '.githooks', name)
const runHook = (name, ctx, { env = {}, input = '' } = {}) => spawnSync(SH, [toSh(hook(name))], { cwd: ctx.tmp, input, encoding: 'utf8', env: { ...process.env, ...env } })

test('pre-commit: gitleaks 가 있으면 git --staged 로 스테이징한 변경을 훑고, 유출 발견(종료 1)이면 커밋을 막는다', { skip: noSh }, () => {
  const ctx = setup()
  try {
    const ok = runHook('pre-commit', ctx, { env: { WF_GITLEAKS_BIN: ctx.stub, STUB_EXIT: '0' } })
    assert.equal(ok.status, 0, ok.stderr)
    assert.match(readFileSync(ctx.log, 'utf8'), /^git --staged --config \S+\.gitleaks\.toml --redact --no-banner --verbose /m)
    const leak = runHook('pre-commit', ctx, { env: { WF_GITLEAKS_BIN: ctx.stub, STUB_EXIT: '1' } })
    console.log('  양성 대조 pre-commit(유출 발견): 종료', leak.status)
    assert.equal(leak.status, 1)
  } finally {
    rmSync(ctx.tmp, { recursive: true, force: true })
  }
})

test('pre-commit·pre-push: gitleaks 가 없으면 설치 방법을 알리고 통과시킨다(설치하지 않는다)', { skip: noSh }, () => {
  const ctx = setup()
  try {
    for (const name of ['pre-commit', 'pre-push']) {
      const r = runHook(name, ctx, { env: { WF_GITLEAKS_BIN: '/nonexistent/gitleaks' } })
      assert.equal(r.status, 0, `${name}: ${r.stderr}`)
      assert.match(r.stderr, /winget install Gitleaks\.Gitleaks/)
      assert.match(r.stderr, /scoop install gitleaks/)
    }
  } finally {
    rmSync(ctx.tmp, { recursive: true, force: true })
  }
})

test('SKIP_GITLEAKS=1 이면 검사를 건너뛰고 알린다', { skip: noSh }, () => {
  const ctx = setup()
  try {
    for (const name of ['pre-commit', 'pre-push']) {
      const r = runHook(name, ctx, { env: { WF_GITLEAKS_BIN: ctx.stub, STUB_EXIT: '1', SKIP_GITLEAKS: '1' } })
      assert.equal(r.status, 0, `${name}: ${r.stderr}`)
      assert.match(r.stderr, /SKIP_GITLEAKS=1/)
    }
  } finally {
    rmSync(ctx.tmp, { recursive: true, force: true })
  }
})

test('pre-push: 올리는 범위를 --log-opts 로 넘기고(새 가지는 원격에 없는 커밋만), 가지 삭제는 건너뛰며, 유출 발견이면 푸시를 막는다', { skip: noSh }, () => {
  const ctx = setup()
  const zero = '0'.repeat(40)
  const a = 'a'.repeat(40)
  const b = 'b'.repeat(40)
  try {
    const input = `refs/heads/x ${a} refs/heads/x ${b}\nrefs/heads/new ${a} refs/heads/new ${zero}\n(delete) ${zero} refs/heads/gone ${b}\n`
    const ok = runHook('pre-push', ctx, { env: { WF_GITLEAKS_BIN: ctx.stub, STUB_EXIT: '0' }, input })
    assert.equal(ok.status, 0, ok.stderr)
    const lines = readFileSync(ctx.log, 'utf8').trim().split('\n')
    assert.equal(lines.length, 2, '삭제 줄은 건너뛴다')
    assert.match(lines[0], new RegExp(`--log-opts=${b}\\.\\.${a}`))
    assert.match(lines[1], new RegExp(`--log-opts=${a} --not --remotes`))
    const leak = runHook('pre-push', ctx, { env: { WF_GITLEAKS_BIN: ctx.stub, STUB_EXIT: '1' }, input })
    console.log('  양성 대조 pre-push(유출 발견): 종료', leak.status)
    assert.equal(leak.status, 1)
  } finally {
    rmSync(ctx.tmp, { recursive: true, force: true })
  }
})

test('훅 파일은 LF 줄끝이고 실행 비트가 git 에 기록돼 있다', () => {
  for (const name of ['pre-commit', 'pre-push']) {
    assert.ok(!readFileSync(hook(name), 'utf8').includes('\r'), `${name}: CRLF`)
    const r = spawnSync('git', ['ls-files', '--stage', `.githooks/${name}`], { cwd: ROOT, encoding: 'utf8' })
    assert.match(r.stdout, /^100755 /, `${name}: 실행 비트(100755)가 없다 — git update-index --chmod=+x`)
  }
})
