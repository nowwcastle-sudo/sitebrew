// 시험 전용: 종료가 멈추면 성공으로 처리하지 않고 제한 시간 뒤 실패시킨다.
import { spawnSync } from "node:child_process"

export async function closeWithin(promise, label, timeoutMs = 10_000) {
  let timer
  try {
    await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs) })])
  } finally { clearTimeout(timer) }
}

export async function stopPostgres(pg, timeoutMs = 10_000) {
  const child = pg.process
  if (!child || child.exitCode !== null || child.signalCode !== null) {
    // embedded-postgres stop()은 이미 끝난 프로세스의 exit 이벤트를 다시 기다린다.
    pg.process = undefined
    return
  }
  try { await closeWithin(pg.stop(), "PostgreSQL stop", timeoutMs) }
  catch (error) {
    if (child.pid) {
      if (process.platform === "win32") spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" })
      else child.kill("SIGKILL")
    }
    pg.process = undefined
    throw error
  }
}
