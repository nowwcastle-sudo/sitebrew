// 터널 세션 상태 파일(계획 4 Task 5, 모듈 R) — <사이트 폴더>/.tmp/tunnel/state.json 을 원자적으로 읽고 쓴다.
//   · 데몬(session.mjs)이 단계마다 쓰고, 입구 CLI(preview-link.mjs)가 읽어 사용자에게 보인다. 두 프로세스가 만나는 유일한 자리다.
//   · 허용 목록 모양만 파일에 들어간다(ALLOWED, PID_KEYS) — 환경 변수·비밀 이름 값이 실수로 섞여도 걸러진다.
//   · 쓰기는 임시 파일 → rename 이라 읽는 쪽이 반쪽 파일을 보지 않는다. fs 와 kill 은 인자로 바꿔 끼울 수 있다.
import * as nodeFs from 'node:fs'
import { join } from 'node:path'

/** 파일에 들어갈 수 있는 최상위 키 */
export const ALLOWED = Object.freeze(['status', 'site', 'provider', 'url', 'port', 'product', 'pids', 'startedAt', 'expiresAt', 'reason'])
/** pids 안에서 들어갈 수 있는 키 */
export const PID_KEYS = Object.freeze(['daemon', 'server', 'tunnel'])

/** 상태 파일 경로 */
export const stateFile = (site) => join(site, '.tmp', 'tunnel', 'state.json')

/** 허용 목록 모양만 남긴 사본. pids 는 알려진 키의 정수만. */
function pick(obj) {
  const out = {}
  for (const k of ALLOWED) if (obj?.[k] !== undefined && k !== 'pids') out[k] = obj[k]
  if (obj?.pids && typeof obj.pids === 'object') {
    const pids = {}
    for (const k of PID_KEYS) if (Number.isInteger(obj.pids[k])) pids[k] = obj.pids[k]
    if (Object.keys(pids).length) out.pids = pids
  }
  return out
}

/** 상태를 읽는다. 파일이 없거나 깨졌거나 객체가 아니면 null. */
export function readState(site, { fs = nodeFs } = {}) {
  try {
    const raw = JSON.parse(fs.readFileSync(stateFile(site), 'utf8'))
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? pick(raw) : null
  } catch {
    return null
  }
}

/** patch 를 읽은 상태에 합쳐(pids 는 칸 단위, null 은 칸 지우기) 허용 모양만 원자적으로 쓰고, 쓴 상태를 돌려준다. */
export function writeState(site, patch, { fs = nodeFs } = {}) {
  const current = readState(site, { fs }) ?? {}
  const merged = { ...current }
  for (const [k, v] of Object.entries(patch ?? {})) {
    if (k === 'pids') continue
    if (v === null) delete merged[k]
    else merged[k] = v
  }
  const pids = { ...(current.pids ?? {}) }
  for (const [k, v] of Object.entries(patch?.pids ?? {})) {
    if (v === null) delete pids[k]
    else pids[k] = v
  }
  merged.pids = pids
  const next = pick(merged)
  const file = stateFile(site)
  fs.mkdirSync(join(site, '.tmp', 'tunnel'), { recursive: true })
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`
  fs.writeFileSync(tmp, `${JSON.stringify(next, null, 2)}\n`)
  fs.renameSync(tmp, file)
  return next
}

/** 상태 파일을 지운다(없어도 던지지 않는다). */
export function clearState(site, { fs = nodeFs } = {}) {
  fs.rmSync(stateFile(site), { force: true })
}

/** PID 가 살아 있는가. 권한이 없어 신호를 못 보내는 경우(EPERM)는 살아 있는 것이다. */
export function isAlive(pid, kill = process.kill) {
  if (!Number.isInteger(pid) || pid < 1) return false
  try {
    kill(pid, 0)
    return true
  } catch (e) {
    return e?.code === 'EPERM'
  }
}
