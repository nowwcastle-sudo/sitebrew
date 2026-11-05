// 프로세스 신원 읽기(v0.2.6 T4 · P2 F2) — PID 하나의 「시작 시각」과 「명령줄」을 OS 에서 읽는다. 남은 서버를 정리할 때 PID 재사용으로 남의 프로세스를 끄지 않기 위한 재료다.
//   Linux: /proc/<pid>/stat 22번째 칸(부팅 뒤 시계 틱)과 /proc/<pid>/cmdline · 그 밖 POSIX: ps · Windows: Get-CimInstance Win32_Process(wmic 은 Windows 11 24H2 에 없다).
// 결과: null = 그 PID 가 없다 · { startTime, cmdline } = 있다(읽지 못한 칸은 null). startTime 은 OS 가 준 값을 문자열 그대로 둔다 — 같은 프로세스면 늘 같은 값이다.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const WIN_SCRIPT = (pid) => `[Console]::OutputEncoding=[Text.Encoding]::UTF8; $p=Get-CimInstance Win32_Process -Filter 'ProcessId=${Number(pid)}'; if($p){ @{t=$p.CreationDate.ToUniversalTime().ToString('o');c=$p.CommandLine}|ConvertTo-Json -Compress }`

/** @returns {{ startTime: string|null, cmdline: string|null } | null} */
export function inspectProcess(pid, { platform = process.platform, exec = execFileSync, read = readFileSync } = {}) {
  if (!Number.isInteger(pid) || pid <= 0) return null
  try {
    if (platform === 'linux') {
      const stat = read(`/proc/${pid}/stat`, 'utf8')
      const rest = stat.slice(stat.lastIndexOf(')') + 2).split(' ') // 3번째 칸(상태)부터
      if (rest[0] === 'Z' || rest[0] === 'X') return null // 끝났는데 거두지 않은 프로세스
      let cmdline = null
      try { cmdline = read(`/proc/${pid}/cmdline`, 'utf8').split('\0').filter(Boolean).join(' ') } catch { /* 읽기 못 함 */ }
      return { startTime: rest[19] ?? null, cmdline }
    }
    if (platform === 'win32') {
      const out = String(exec('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', WIN_SCRIPT(pid)], { encoding: 'utf8', windowsHide: true, timeout: 15_000 })).trim()
      if (!out) return null
      const j = JSON.parse(out)
      return { startTime: j.t ?? null, cmdline: j.c ?? null }
    }
    const ps = (col) => String(exec('ps', ['-o', `${col}=`, '-p', String(pid)], { encoding: 'utf8' })).trim()
    const startTime = ps('lstart')
    return startTime ? { startTime, cmdline: ps('command') || null } : null
  } catch (e) {
    if (platform === 'linux' && e?.code === 'ENOENT') return null // /proc/<pid> 없음 = 없는 PID
    if (platform !== 'win32' && platform !== 'linux' && e?.status === 1) return null // ps: 그런 PID 없음
    return { startTime: null, cmdline: null } // 있는지 몰라도 읽지 못했다 — 부르는 쪽이 「끄지 않음」으로 다룬다
  }
}
