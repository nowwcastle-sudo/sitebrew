// 띄운 후보 서버의 기록과 남은 서버 정리(v0.2.6 T4 · P2 F2). 파일은 <run>/direction-board/serve.pids.json = { version: 1, entries: [{ pid, port, siteDir, startedAt, startTime }] }.
// 정리는 안전한 쪽으로 틀린다: PID 가 살아 있고 · 시작 시각이 기록과 같고 · 명령줄에 siteDir 이 있을 때만 끈다. 하나라도 읽지 못하거나 다르면 끄지 않고 이유를 돌려준다.
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { killTree } from '../../stamp/run-proc.mjs'
import { inspectProcess } from './proc-info.mjs'

export const PIDS_FILE = 'serve.pids.json'
const WIN = process.platform === 'win32'

export function readPids(boardDir) {
  try {
    const j = JSON.parse(readFileSync(join(boardDir, PIDS_FILE), 'utf8'))
    return Array.isArray(j.entries) ? j.entries.filter((e) => Number.isInteger(e?.pid) && typeof e.siteDir === 'string') : []
  } catch { return [] }
}
export function writePids(boardDir, entries) {
  const file = join(boardDir, PIDS_FILE)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(`${file}.tmp`, JSON.stringify({ version: 1, entries }, null, 2) + '\n')
  renameSync(`${file}.tmp`, file)
}
export const clearPids = (boardDir) => rmSync(join(boardDir, PIDS_FILE), { force: true })

/** 경로 비교용 모양: 절대 경로로 풀고, Windows 는 구분자를 맞추고 소문자로. */
export const pathKey = (p, win = WIN) => { const r = resolve(p); return win ? r.replaceAll('/', '\\').toLowerCase() : r }
/** 명령줄 글에 siteDir 이 들어 있나(경로가 명령줄 한가운데 있다). */
export const cmdlineHasDir = (cmdline, siteDir, win = WIN) => {
  const hay = win ? String(cmdline).replaceAll('/', '\\').toLowerCase() : String(cmdline)
  return hay.includes(pathKey(siteDir, win))
}

/**
 * 지난 실행이 남긴 서버를 정리한다. 기록 파일은 처리 뒤 지운다(새 실행이 다시 쓴다).
 * @returns {{ killed: number[], gone: number[], skipped: { pid: number, why: string }[] }}
 */
export function cleanupStale(boardDir, { inspect = inspectProcess, kill = killTree, platform = process.platform } = {}) {
  const win = platform === 'win32'
  const out = { killed: [], gone: [], skipped: [] }
  for (const e of readPids(boardDir)) {
    const info = inspect(e.pid)
    if (!info) { out.gone.push(e.pid); continue }
    if (!info.startTime || !info.cmdline) { out.skipped.push({ pid: e.pid, why: '시작 시각이나 명령줄을 읽지 못했다' }); continue }
    if (!e.startTime) { out.skipped.push({ pid: e.pid, why: '기록에 시작 시각이 없다' }); continue }
    if (info.startTime !== e.startTime) { out.skipped.push({ pid: e.pid, why: 'PID 가 다른 프로세스에 재사용됐다(시작 시각이 다르다)' }); continue }
    if (!cmdlineHasDir(info.cmdline, e.siteDir, win)) { out.skipped.push({ pid: e.pid, why: '명령줄에 후보 사이트 경로가 없다' }); continue }
    kill(e.pid)
    out.killed.push(e.pid)
  }
  clearPids(boardDir)
  return out
}
