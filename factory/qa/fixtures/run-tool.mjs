// UXGATE1 시험 공용: 관문 도구를 자식 프로세스로 **비동기**로 돌린다(spawnSync 는 쓰지 않는다 — 이 저장소 시험 규약).
// 부하가 큰 기계에서는 headless Chrome 의 첫 호출(Network.setCookie 가 0.02초~수십 초로 들쭉날쭉했다)과 문서 읽기가 기한을 넘겨 도구가 「도구 실패」로 끝난다 —
// 판정이 아니라 측정 환경 문제다. 그 기한 초과 메시지가 stderr 에 있을 때만 같은 명령을 최대 3번 시도한다. 판정 실패(결과 파일 있음)·인자 오류·기한과 무관한
// 도구 실패는 다시 돌리지 않는다. 기한은 환경 변수로 넉넉히 준다(판정 기준은 같다 — docs/agents/agent-guide.md WF_NAV_TIMEOUT_MS).
import { spawn } from 'node:child_process'

export const LOAD_TIMEOUT = /안에 답하지 않았다|안에 새 문서를 다 읽지 못했다|안에 끝나지 않았다|no DevToolsActivePort|no page target/

// 시도 하나의 기한(timeoutMs, 기본 240000)을 넘으면 자식을 트리째 끝낸다 — Windows 는 taskkill /T /F(자식이 띄운 Chrome 까지), 그 밖은 SIGKILL.
// 자식만 죽이면 그 Chrome 이 고아로 남는다(시험 기한에 죽은 관문 도구가 크롬 수십 개를 남긴 일, 대장 G18).
export const KILL_TREE_DEFAULT_MS = 240000

export function killTree(p) {
  if (process.platform === 'win32' && p.pid) {
    return new Promise((res) => {
      const k = spawn('taskkill', ['/PID', String(p.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true })
      k.on('exit', res); k.on('error', res)
    })
  }
  try { p.kill('SIGKILL') } catch {}
  return Promise.resolve()
}

const once = (script, args, env, timeoutMs) => new Promise((res) => {
  const p = spawn(process.execPath, [script, ...args], { env: { WF_NAV_TIMEOUT_MS: '60000', WF_CDP_TIMEOUT_MS: '120000', ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] })
  let out = '', err = '', timedOut = false, done = false
  p.stdout.on('data', (d) => { out += d }); p.stderr.on('data', (d) => { err += d })
  const finish = (code) => { if (done) return; done = true; clearTimeout(timer); res(timedOut ? { code: null, timedOut: true, out, err } : { code, out, err }) }
  const timer = setTimeout(async () => { timedOut = true; await killTree(p); finish(null) }, timeoutMs)
  timer.unref()
  p.on('exit', (code) => finish(code))
})

// onAttempt(i): 시도마다 앞서 부른다(서버가 받은 기록을 비우는 데 쓴다 — 실패한 시도의 요청이 다음 판정에 섞이지 않게).
// timeoutMs: 시도 하나의 기한. 넘으면 { code: null, timedOut: true } 를 돌려주고 다시 시도하지 않는다(기한을 넘긴 도구는 멈춘 것이다).
export async function runTool(script, args, env = {}, { attempts = 3, onAttempt, timeoutMs = KILL_TREE_DEFAULT_MS } = {}) {
  let r
  for (let i = 1; i <= attempts; i++) {
    onAttempt?.(i)
    r = await once(script, args, env, timeoutMs)
    r.attempts = i
    if (r.code === 0 || r.timedOut || !LOAD_TIMEOUT.test(r.err)) return r
  }
  return r
}
