// FINAL-WF3 항목 16 — 관문 도구가 실패 경로로 끝나도(close() 를 못 부르고 process.exit) 헤드리스 Chrome 트리와 임시 프로필이 남지 않는다.
// 가짜 실패: fixtures/exit-chrome.mjs 가 Chrome 을 띄운 채 바로 exit(1). 끝난 뒤 이름표 접두가 든 chrome.exe 0개·임시 프로필 폴더 0개여야 한다.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

const PREFIX = 'cdpexit-'
const left = (prefix) => Number(execFileSync('powershell', ['-NoProfile', '-Command',
  `@(Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -like '*${prefix}*' } | Where-Object { $p = Get-Process -Id $_.ProcessId -ErrorAction SilentlyContinue; $p -and -not $p.HasExited }).Count`], { encoding: 'utf8' }).trim())

test('close() 없이 process.exit 로 끝나도 Chrome 트리와 임시 프로필이 남지 않는다', { skip: process.platform !== 'win32' }, async () => {
  const r = spawnSync(process.execPath, [fileURLToPath(new URL('./fixtures/exit-chrome.mjs', import.meta.url))], { encoding: 'utf8', env: { ...process.env, EXIT_CHROME_PREFIX: PREFIX }, timeout: 60000 })
  assert.equal(r.status, 1)
  assert.match(r.stdout, /chrome-up \d+/, 'Chrome 이 떠 있는 채로 끝나야 시험이 의미가 있다')
  await new Promise((res) => setTimeout(res, 2500))
  assert.equal(left(PREFIX), 0, '남은 chrome.exe')
  assert.deepEqual(readdirSync(tmpdir()).filter((n) => n.startsWith(PREFIX)), [], '남은 임시 프로필')
})
