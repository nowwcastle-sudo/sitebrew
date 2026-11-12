// 터널 시작 잠금(보안 수정 D, 대장 wf-tunnel-session-race-001) — <사이트 폴더>/.tmp/tunnel/start.lock 을 `wx`(없을 때만 만들기)로 잡는다.
//   · 시작·중지 명령이 「살아 있는 세션 확인 → 상태 바꾸기 → 데몬 띄우기 → 소유 PID 기록」 구간을 한 번에 하나만 지나게 한다.
//     잠금이 없던 때는 두 시작이 겹치면 둘 다 확인을 통과해 공개 터널이 둘 생기고, 상태 파일에는 하나만 남았다.
//   · 낡은 잠금은 막지 않는다: 소유 PID 가 죽었거나 잠금이 staleMs(준비 한도)를 넘었으면 빼앗는다. 잠금 내용을 읽을 수 없으면(만드는 중인 빈 파일) 파일 수정 시각으로 나이를 잰다.
//   · 빼앗기는 잠금을 고유 이름으로 rename 해 한 명만 성공하게 하고, 옮긴 내용이 판정한 내용과 다르면(그 사이 새 소유자가 잡은 것) 되돌려 놓는다.
//   · 시계·PID 확인·fs 는 인자로 바꿔 끼운다(시험).
import * as nodeFs from 'node:fs'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { isAlive as defaultIsAlive } from './state.mjs'

export const lockFile = (site) => join(site, '.tmp', 'tunnel', 'start.lock')

/** 잠금을 한 번 시도한다. → { token, release } 를 얻었거나 null(살아 있는 소유자가 있다). */
export function tryAcquire(site, { pid = process.pid, now = Date.now, isAlive = defaultIsAlive, staleMs, fs = nodeFs } = {}) {
  const file = lockFile(site)
  const token = randomUUID()
  const body = JSON.stringify({ pid, token, createdAt: now() })
  fs.mkdirSync(join(site, '.tmp', 'tunnel'), { recursive: true })

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      fs.writeFileSync(file, body, { flag: 'wx' })
      return { token, release: () => release(file, token, fs) }
    } catch (e) {
      if (e?.code !== 'EEXIST') throw e
    }
    const seen = readRaw(file, fs)
    if (seen === null) continue // 그 사이 풀렸다 — 다시 만든다
    if (!isStale(seen, file, { now, isAlive, staleMs, fs })) return null
    reclaim(file, seen.raw, token, fs)
  }
  return null
}

/** 잠금 파일의 원문과 파싱한 값. 파일이 없으면 null. */
function readRaw(file, fs) {
  let raw
  try { raw = fs.readFileSync(file, 'utf8') } catch { return null }
  let value = null
  try { const v = JSON.parse(raw); if (v && typeof v === 'object') value = v } catch { /* 만드는 중이거나 깨졌다 */ }
  return { raw, value }
}

function isStale({ value }, file, { now, isAlive, staleMs, fs }) {
  if (!value || !Number.isInteger(value.pid) || typeof value.createdAt !== 'number') {
    // 읽을 수 없는 잠금: 막 만드는 중일 수 있으니 파일 수정 시각이 한도를 넘었을 때만 낡았다고 본다
    try { return now() - fs.statSync(file).mtimeMs > staleMs } catch { return false }
  }
  return !isAlive(value.pid) || now() - value.createdAt > staleMs
}

/** 낡은 잠금 하나를 치운다. 판정한 내용(raw)이 아닌 것을 옮겼으면(새 소유자의 잠금) 그대로 되돌린다. */
function reclaim(file, raw, token, fs) {
  const aside = `${file}.stale.${token}`
  try { fs.renameSync(file, aside) } catch { return } // 다른 쪽이 먼저 치웠다
  let moved = null
  try { moved = fs.readFileSync(aside, 'utf8') } catch { /* 읽기 실패 — 아래에서 지운다 */ }
  if (moved !== null && moved !== raw) {
    try { fs.writeFileSync(file, moved, { flag: 'wx' }) } catch { /* 이미 다른 소유자가 있다 */ }
  }
  try { fs.rmSync(aside, { force: true }) } catch { /* 남아도 잠금과 무관하다 */ }
}

/** 내 토큰이 든 잠금만 지운다(낡아서 빼앗긴 잠금은 건드리지 않는다). */
function release(file, token, fs) {
  const seen = readRaw(file, fs)
  if (seen?.value?.token === token) fs.rmSync(file, { force: true })
}

/**
 * 잠금을 얻을 때까지 기다린다. → { release } 또는 null(deadline 을 넘김).
 * 기다릴 때마다 sleep 을 부르고, 시계(now)가 deadlineAt 을 넘으면 포기한다.
 */
export async function acquireStartLock(site, { sleep, pollMs = 100, waitMs, ...opts } = {}) {
  const now = opts.now ?? Date.now
  const deadline = now() + waitMs
  for (;;) {
    const got = tryAcquire(site, opts)
    if (got) return got
    if (now() >= deadline) return null
    await sleep(pollMs)
  }
}
