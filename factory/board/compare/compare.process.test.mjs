// 비교 서버의 프로세스 위생 시험(v0.2.6 T4 · P2 F1·F2) — 진짜 프로세스로 본다. 브라우저 없음.
//  ① startSite().stop() 이 `next start` 와 그 자식까지 끈다(예전에는 child 객체를 killTree 에 넘겨 남았다).
//  ② 남은 서버 정리는 PID 가 살아 있고 · 시작 시각이 기록과 같고 · 명령줄에 siteDir 이 있을 때만 끈다.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { startSite } from '../../stamp/qa.mjs'
import { cleanupStale, readPids, writePids, PIDS_FILE } from './pids.mjs'
import { inspectProcess } from './proc-info.mjs'

const alive = (pid) => { try { process.kill(pid, 0); return true } catch { return false } }
const until = async (fn, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await fn()) return true; await new Promise((r) => setTimeout(r, 50)) } return false }
const sleeper = (...extra) => spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)', '--', ...extra], { stdio: 'ignore', detached: process.platform !== 'win32', windowsHide: true })

test('startSite: stop() 뒤 `next start` 와 그 자식 프로세스가 모두 사라진다 (공백·한글 경로)', async () => {
  const root = mkdtempSync(join(tmpdir(), 'cmp-proc-'))
  try {
    const siteDir = join(root, '런 폴더 공백', 'site')
    const bin = join(siteDir, 'node_modules', 'next', 'dist', 'bin')
    mkdirSync(bin, { recursive: true }); mkdirSync(join(siteDir, '.next'), { recursive: true })
    writeFileSync(join(siteDir, '.next', 'BUILD_ID'), 'x')
    // 가짜 next: 인자 `start -p <포트>` 로 서버를 열고, 자식 하나를 더 띄워 그 번호를 파일에 적는다(진짜 next 도 일꾼 프로세스를 둔다).
    writeFileSync(join(bin, 'next'), `
      const { spawn } = require('node:child_process'), http = require('node:http'), fs = require('node:fs')
      const port = Number(process.argv[process.argv.indexOf('-p') + 1])
      const kid = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' })
      fs.writeFileSync(${JSON.stringify(join(root, 'kid.pid'))}, String(kid.pid))
      http.createServer((q, r) => r.end('ok')).listen(port, '127.0.0.1')`)
    const site = await startSite(siteDir, { timeoutMs: 20_000 })
    const kid = Number(readFileSync(join(root, 'kid.pid'), 'utf8'))
    assert.ok(alive(site.pid) && alive(kid), '띄운 직후에는 둘 다 살아 있다')
    assert.equal(site.url, `http://127.0.0.1:${site.port}`)
    await site.stop()
    assert.ok(await until(() => !alive(site.pid) && !alive(kid)), `stop() 뒤에도 남음: next=${alive(site.pid)} 자식=${alive(kid)}`)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('남은 서버 정리: 신원이 모두 맞는 것만 끄고(PID 재사용·다른 명령줄·읽지 못함은 건드리지 않는다), 죽은 것은 기록에서 지운다', async () => {
  const root = mkdtempSync(join(tmpdir(), 'cmp-stale-'))
  const kids = []
  try {
    const board = join(root, 'direction-board'); mkdirSync(board)
    const dirA = join(root, '런 폴더 공백', 'a', 'site'), dirB = join(root, '런 폴더 공백', 'b', 'site'), dirC = join(root, '런 폴더 공백', 'c', 'site')
    const mine = sleeper(dirA), reused = sleeper(dirB), other = sleeper('다른-경로') // other: 기록은 dirC 인데 명령줄엔 없다
    kids.push(mine, reused, other)
    await until(() => inspectProcess(mine.pid)?.cmdline?.includes('런 폴더 공백'))
    const t = (p) => inspectProcess(p.pid).startTime
    const gone = sleeper(); const gonePid = gone.pid; gone.kill('SIGKILL'); await until(() => !alive(gonePid))
    writePids(board, [
      { pid: mine.pid, port: 1, siteDir: dirA, startedAt: 'x', startTime: t(mine) },
      { pid: reused.pid, port: 2, siteDir: dirB, startedAt: 'x', startTime: 'PID-재사용-흉내' }, // 시작 시각이 다르다
      { pid: other.pid, port: 3, siteDir: dirC, startedAt: 'x', startTime: t(other) },
      { pid: gonePid, port: 4, siteDir: dirA, startedAt: 'x', startTime: 'x' },
    ])
    const r = cleanupStale(board)
    assert.deepEqual(r.killed, [mine.pid]); assert.deepEqual(r.gone, [gonePid])
    assert.deepEqual(r.skipped.map((s) => s.pid).sort(), [reused.pid, other.pid].sort())
    assert.ok(await until(() => !alive(mine.pid)), '신원이 맞는 서버는 꺼진다')
    assert.ok(alive(reused.pid) && alive(other.pid), '신원이 다른 프로세스는 살아 있다')
    assert.ok(!existsSync(join(board, PIDS_FILE)) && readPids(board).length === 0, '기록은 처리 뒤 지운다')
  } finally { for (const k of kids) { try { process.kill(process.platform === 'win32' ? k.pid : -k.pid, 'SIGKILL') } catch { /* 이미 끝남 */ } } rmSync(root, { recursive: true, force: true }) }
})
