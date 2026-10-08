// FV1 5.1: startChrome 의 close() 가 Windows 에서 Chrome 자식(렌더러·GPU)까지 트리째 끝낸다 — 고아 Chrome 이 남지 않는다.
// Windows 에서만 의미가 있다(그 밖은 건너뜀). 이름표 접두 'cdpclose-' 가 든 chrome.exe 명령줄을 센다.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { startChrome, closeChrome } from './cdp.mjs'

// 이름표 접두가 명령줄에 든 chrome.exe 중 아직 살아 있는 것만 센다(끝났지만 핸들만 남은 항목은 HasExited 가 걸러 낸다).
const left = (prefix) => Number(execFileSync('powershell', ['-NoProfile', '-Command',
  `@(Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -like '*${prefix}*' } | Where-Object { $p = Get-Process -Id $_.ProcessId -ErrorAction SilentlyContinue; $p -and -not $p.HasExited }).Count`], { encoding: 'utf8' }).trim() || 0)

test('close() 가 Chrome 자식까지 끝낸다', { skip: process.platform !== 'win32' }, async () => {
  const c = await startChrome([], { prefix: 'cdpclose-a-' })
  // about:blank 페이지가 이미 열려 있어 렌더러·GPU·유틸리티 자식이 떠 있다 — 뿌리 하나보다 많아야 시험이 의미가 있다.
  await new Promise((r) => setTimeout(r, 1000))
  assert.ok(left('cdpclose-a-') > 1, '자식 프로세스가 떠 있어야 시험이 의미가 있다')
  await c.close()
  await new Promise((r) => setTimeout(r, 1500))
  assert.equal(left('cdpclose-a-'), 0)
})

test('closeChrome 은 close() 를 부르는 옛 이름이다', { skip: process.platform !== 'win32' }, async () => {
  const c = await startChrome([], { prefix: 'cdpclose-b-' })
  await closeChrome(c)
  await new Promise((r) => setTimeout(r, 1500))
  assert.equal(left('cdpclose-b-'), 0)
})

test('runTool 시간 초과는 멈춘 도구와 그 Chrome 트리를 끝낸다', { skip: process.platform !== 'win32' }, async () => {
  const { runTool } = await import('./fixtures/run-tool.mjs')
  const t0 = Date.now()
  const r = await runTool(fileURLToPath(new URL('./fixtures/hang-chrome.mjs', import.meta.url)), [], { HANG_CHROME_PREFIX: 'cdphang-' }, { attempts: 1, timeoutMs: 12000 })
  assert.equal(r.timedOut, true)
  assert.equal(r.code, null)
  assert.match(r.out, /chrome-up/, 'Chrome 이 떠 있는 채로 기한을 넘겨야 시험이 의미가 있다')
  assert.ok(Date.now() - t0 < 30000)
  await new Promise((res) => setTimeout(res, 1500))
  assert.equal(left('cdphang-'), 0)
})
