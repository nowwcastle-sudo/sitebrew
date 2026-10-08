// P4GR2 — 06 빌드의 타입 검사 분리(WF_BUILD_SPLIT_TYPECHECK=1): `next typegen && tsc --noEmit` 을 먼저 하고(타입 검사는 여전히 강제), 통과하면 빌드를 WF_BUILD_SKIP_TYPECHECK=1 로 돌려 내장 타입 검사를 건너뛴다.
// 변수가 없으면 예전과 똑같이 `npm run build` 한 번이다. 가짜 next·tsc(윈도우 .cmd·그 밖은 sh 껍데기)로 흐름만 본다 — 진짜 빌드·타입 오류 음성 대조는 골든 실행 잠금 안(.tmp/p4gr2-split-check.mjs)에서 한다.
// 실행: node --test --test-force-exit --test-timeout=120000 factory/scripts/stamp-split-typecheck.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { root } from './lib/stamp-site-fixtures.mjs'
import { nextBuild } from '../stamp/site-install.mjs'

const win = process.platform === 'win32'
const TMP = join(root, '.tmp', 'stamp-split-typecheck-test')

function fakeSite(tscExit) {
  mkdirSync(TMP, { recursive: true })
  const dir = mkdtempSync(join(TMP, 'site-'))
  const bin = join(dir, 'node_modules', '.bin')
  mkdirSync(bin, { recursive: true })
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'fake', version: '0.0.0', scripts: { build: 'node build.mjs' } }))
  writeFileSync(join(dir, 'build.mjs'), "import { appendFileSync } from 'node:fs'\nappendFileSync('calls.txt', `build skip=${process.env.WF_BUILD_SKIP_TYPECHECK ?? ''}\\n`)\n")
  if (win) {
    writeFileSync(join(bin, 'next.cmd'), '@echo off\r\necho next %* >> calls.txt\r\nexit /b 0\r\n')
    writeFileSync(join(bin, 'tsc.cmd'), `@echo off\r\necho tsc %* >> calls.txt\r\nexit /b ${tscExit}\r\n`)
  } else {
    // Linux·macOS(P3-8 이식성): 같은 가짜 껍데기를 실행 파일(sh)로 둔다 — nextBuild 는 따옴표 친 `.bin/next` 경로를 sh 로 부른다.
    writeFileSync(join(bin, 'next'), '#!/bin/sh\necho "next $*" >> calls.txt\nexit 0\n', { mode: 0o755 })
    writeFileSync(join(bin, 'tsc'), `#!/bin/sh\necho "tsc $*" >> calls.txt\nexit ${tscExit}\n`, { mode: 0o755 })
  }
  return dir
}
const calls = (dir) => (existsSync(join(dir, 'calls.txt')) ? readFileSync(join(dir, 'calls.txt'), 'utf8').split(/\r?\n/).map((l) => l.trim()).filter(Boolean) : [])
async function withEnv(value, fn) {
  const before = process.env.WF_BUILD_SPLIT_TYPECHECK
  if (value === undefined) delete process.env.WF_BUILD_SPLIT_TYPECHECK
  else process.env.WF_BUILD_SPLIT_TYPECHECK = value
  try { return await fn() } finally { if (before === undefined) delete process.env.WF_BUILD_SPLIT_TYPECHECK; else process.env.WF_BUILD_SPLIT_TYPECHECK = before }
}

test('변수 없음 → npm run build 한 번(평소와 같다) — typegen·tsc 도 SKIP 변수도 없다', async () => {
  const dir = fakeSite(0)
  const r = await withEnv(undefined, () => nextBuild(dir, join(dir, 'build.log')))
  assert.equal(r.code, 0)
  assert.equal(r.typecheck, 'next')
  assert.deepEqual(calls(dir), ['build skip='])
})

test('WF_BUILD_SPLIT_TYPECHECK=1 · tsc 통과 → typegen → tsc → 빌드(WF_BUILD_SKIP_TYPECHECK=1) 순서', async () => {
  const dir = fakeSite(0)
  const r = await withEnv('1', () => nextBuild(dir, join(dir, 'build.log')))
  assert.equal(r.code, 0)
  assert.equal(r.typecheck, 'split')
  assert.deepEqual(calls(dir), ['next typegen', 'tsc --noEmit', 'build skip=1'])
})

test('음성 대조: tsc 가 실패하면 그 자리에서 실패 — 빌드는 돌리지 않고 로그에 까닭이 남는다', async () => {
  const dir = fakeSite(2)
  const r = await withEnv('1', () => nextBuild(dir, join(dir, 'build.log')))
  assert.equal(r.code, 2)
  assert.equal(r.typecheck, 'split')
  assert.deepEqual(calls(dir), ['next typegen', 'tsc --noEmit'], '빌드가 안 돈다')
  assert.match(readFileSync(join(dir, 'build.log'), 'utf8'), /타입 검사 실패 — tsc 단계/)
})
