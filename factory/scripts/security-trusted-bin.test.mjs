// 보안 수정 B(daybreak project-local-vercel-command-shadowing · shell-path-command-injection):
// 외부 명령은 셸·작업 폴더를 거치지 않고 신뢰된 절대 경로로 부른다.
// 실행: node --test --test-force-exit --test-timeout=120000 factory/scripts/security-trusted-bin.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'
import { npmCommand, resolveTrustedBin, shimEntry, trustedCommand } from '../lib/trusted-bin.mjs'
import { defaultSpawn } from '../stamp/deploy-preview.mjs'
import { sh } from '../stamp/site-install.mjs'
import { root } from './lib/stamp-site-fixtures.mjs'

const WIN = process.platform === 'win32'
const tmp = (p) => mkdtempSync(join(tmpdir(), p))

/** PATH 에 놓을 가짜 CLI: Windows 는 npm 전역 설치 모양(vercel.cmd + node_modules/vercel/package.json bin), POSIX 는 실행 스크립트 */
function fakeGlobalCli(name, body) {
  const dir = tmp('wf-gbin-')
  if (WIN) {
    writeFileSync(join(dir, `${name}.cmd`), '@echo off\r\nexit /b 99\r\n') // 껍데기 내용은 읽지 않는다 — 진입은 package.json bin
    const pkg = join(dir, 'node_modules', name)
    mkdirSync(join(pkg, 'dist'), { recursive: true })
    writeFileSync(join(pkg, 'package.json'), JSON.stringify({ name, bin: { [name]: './dist/cli.js' } }))
    writeFileSync(join(pkg, 'dist', 'cli.js'), body)
  } else {
    writeFileSync(join(dir, name), `#!/usr/bin/env node\n${body}`, { mode: 0o755 })
  }
  return dir
}

test('B 재현: 사이트 폴더에 놓인 vercel 껍데기를 고르지 않고 PATH 의 진짜 CLI 를 부른다', async () => {
  const site = tmp('wf-site-')
  const marker = join(site, 'HIJACKED')
  // 악성 의존성·빌드 훅이 남긴 가짜 명령(셸이 작업 폴더에서 먼저 찾는 자리)
  if (WIN) writeFileSync(join(site, 'vercel.cmd'), `@echo off\r\necho hijacked> "${marker}"\r\n`)
  else writeFileSync(join(site, 'vercel'), `#!/bin/sh\necho hijacked > "${marker}"\n`, { mode: 0o755 })
  const real = fakeGlobalCli('vercel', 'process.stdout.write("REAL " + process.argv.slice(2).join(" "))')
  // PATH 앞에 상대 항목(.)과 사이트 폴더까지 넣어도 고르지 않는다
  const env = { ...process.env, PATH: ['.', site, real, process.env.PATH ?? process.env.Path ?? ''].join(delimiter) }
  delete env.Path
  const r = await defaultSpawn('vercel', ['build', '--yes'], { cwd: site, env, timeoutMs: 30_000 })
  assert.equal(existsSync(marker), false, '사이트 폴더의 가짜 vercel 이 실행됐다')
  assert.equal(r.code, 0, r.stderr)
  assert.equal(r.stdout, 'REAL build --yes', '정상: PATH 의 진짜 CLI 가 같은 인자로 돈다')
})

test('B: 신뢰된 위치에 CLI 가 없으면 띄우지 않고 127 과 설치 안내', async () => {
  const site = tmp('wf-site-')
  if (WIN) writeFileSync(join(site, 'vercel.cmd'), '@echo off\r\n')
  else writeFileSync(join(site, 'vercel'), '#!/bin/sh\n', { mode: 0o755 })
  const r = await defaultSpawn('vercel', ['whoami'], { cwd: site, env: { PATH: site, SystemRoot: process.env.SystemRoot ?? '' } })
  assert.equal(r.code, 127)
  assert.match(r.stderr, /신뢰된 위치/)
})

test('B: resolveTrustedBin 은 상대 PATH·작업 폴더 안 항목을 건너뛰고 Windows 는 PATHEXT 순서', () => {
  const files = new Set(['/w/node_modules/.bin/vercel', '/usr/local/bin/vercel', 'C:\\g\\vercel.CMD', 'C:\\g\\vercel.EXE'])
  const exists = (p) => files.has(p)
  assert.equal(resolveTrustedBin('vercel', { env: { PATH: '.:/w/node_modules/.bin:/usr/local/bin' }, cwd: '/w', platform: 'linux', fileExists: exists }), '/usr/local/bin/vercel')
  if (WIN) assert.equal(resolveTrustedBin('vercel', { env: { PATH: 'C:\\g', PATHEXT: '.EXE;.CMD' }, cwd: 'C:\\site', platform: 'win32', fileExists: exists }), 'C:\\g\\vercel.EXE')
  assert.throws(() => resolveTrustedBin('vercel & calc', {}), /명령 이름/)
})

test('B: shimEntry 는 package.json bin 이 패키지 밖을 가리키면 거절한다', () => {
  const dir = tmp('wf-shim-')
  mkdirSync(join(dir, 'node_modules', 'vercel'), { recursive: true })
  writeFileSync(join(dir, 'node_modules', 'vercel', 'package.json'), JSON.stringify({ bin: { vercel: '../../evil.js' } }))
  writeFileSync(join(dir, 'evil.js'), '')
  assert.equal(shimEntry(join(dir, 'vercel.cmd'), 'vercel'), null)
  assert.equal(trustedCommand('no-such-cli-xyz', [], { env: { PATH: dir }, cwd: tmpdir() }), null)
})

test('SB-5 재현: 폴더 이름의 $( )·백틱·따옴표가 명령으로 풀리지 않는다(셸 없는 인자 배열)', async () => {
  const base = tmp('wf-inj-')
  const pwn = join(base, 'PWNED')
  // POSIX 에서 큰따옴표 안 명령 치환이 풀리던 이름 + Windows 에서도 위험한 글자
  const evil = `out $(touch ${pwn}) \`touch ${pwn}\` & echo x > ${pwn}`
  const log = join(base, 'run.log')
  const code = await sh([process.execPath, ['-e', 'process.stdout.write(JSON.stringify(process.argv.slice(1)))', evil]], base, log)
  assert.equal(code, 0)
  assert.equal(existsSync(pwn), false, '폴더 이름이 명령으로 실행됐다')
  assert.deepEqual(JSON.parse(readFileSync(log, 'utf8')), [evil], '정상: 인자는 글자 그대로 간다')
})

test('SB-5 정상 선례: 공백·한글이 든 경로도 셸 없이 그대로 간다 · 옛 문자열 형식도 여전히 돈다', async () => {
  const base = tmp('wf-path-')
  const dir = join(base, '홍 길동의 사이트')
  mkdirSync(dir)
  const log = join(base, 'a.log')
  assert.equal(await sh([process.execPath, ['-e', 'process.stdout.write(process.cwd())']], dir, log), 0)
  assert.match(readFileSync(log, 'utf8'), /홍 길동의 사이트$/)
  assert.equal(await sh('node -e "process.stdout.write(String(1+1))"', base, log), 0)
  assert.equal(readFileSync(log, 'utf8'), '2')
})

test('SB-5: shadcn build·add 와 타입 검사가 경로를 셸 문자열에 끼우지 않는다', () => {
  const src = readFileSync(join(root, 'factory/stamp/site-install.mjs'), 'utf8')
  assert.doesNotMatch(src, /sh\(`npx[^`]*\$\{/, 'npx 명령 문자열에 값이 끼워져 있다')
  assert.doesNotMatch(src, /node_modules', '\.bin'/, '.bin 셸 껍데기를 부른다')
  assert.equal((src.match(/sh\(npx\(\[/g) ?? []).length, 3, 'build 두 곳 + add 한 곳이 배열 형식')
  const cmd = npmCommand('npx', ['-y', 'x'])
  if (cmd) assert.equal(cmd[0], process.execPath, 'npx 는 지금 node 로 npm 설치본을 부른다')
})
