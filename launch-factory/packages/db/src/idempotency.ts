// 폼 제출 멱등 키(v0 Task 15, 대장 D105 — Stripe 멱등 요청 방식). 폼을 열 때 만든 키로 다시 보내면 24시간 같은 결과를 돌려준다.
//   1) (scope, key) 행을 먼저 차지한다(INSERT … ON CONFLICT DO NOTHING — 동시에 두 번 와도 한쪽만 차지한다).
//   2) 차지했으면 처리하고, 성공 결과만 저장한다. 실패면 행을 지운다 — 고친 뒤 같은 키로 다시 보낼 수 있게.
//   3) 못 차지했으면 저장된 결과를 돌려준다. 아직 처리 중(result null)이면 in_progress. 처리 중인 채 오래된 행(프로세스가 죽음)은 다시 차지한다.
import { and, eq, isNull, lt, or } from "drizzle-orm"
import type { Database } from "./client.ts"
import { idempotencyKeys } from "./schema.ts"

export const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000
/** 처리 중 표시가 이보다 오래되면 죽은 요청으로 보고 다시 차지한다 */
export const IDEMPOTENCY_STALE_MS = 60 * 1000

export type IdempotentOutcome<R> = { replayed: false; result: R } | { replayed: true; result: R } | { replayed: false; inProgress: true }

export interface IdempotencyOptions {
  scope: string
  key: string
  now: Date
  /** 결과를 저장할지(기본: ok === true 인 결과만) */
  keep?: (result: unknown) => boolean
}

const defaultKeep = (r: unknown) => typeof r === "object" && r !== null && (r as { ok?: unknown }).ok === true

/** run 을 키당 한 번만 성공시킨다. 키 모양 검사는 부르는 쪽이 한다 */
export async function withIdempotency<R>(d: Database, o: IdempotencyOptions, run: () => Promise<R>): Promise<IdempotentOutcome<R>> {
  const keep = o.keep ?? defaultKeep
  const where = and(eq(idempotencyKeys.scope, o.scope), eq(idempotencyKeys.key, o.key))
  // 만료된 결과·죽은 처리 중 표시는 먼저 치운다(이 키 하나만)
  const expiredBefore = new Date(o.now.getTime() - IDEMPOTENCY_TTL_MS)
  const staleBefore = new Date(o.now.getTime() - IDEMPOTENCY_STALE_MS)
  await d.delete(idempotencyKeys).where(and(where, or(lt(idempotencyKeys.createdAt, expiredBefore), and(isNull(idempotencyKeys.result), lt(idempotencyKeys.createdAt, staleBefore)))))

  const claimed = await d
    .insert(idempotencyKeys)
    .values({ scope: o.scope, key: o.key, result: null, createdAt: o.now })
    .onConflictDoNothing()
    .returning({ key: idempotencyKeys.key })
  if (claimed.length === 0) {
    const [row] = await d.select({ result: idempotencyKeys.result }).from(idempotencyKeys).where(where)
    if (!row || row.result === null) return { replayed: false, inProgress: true }
    return { replayed: true, result: row.result as R }
  }
  let result: R
  try {
    result = await run()
  } catch (e) {
    await d.delete(idempotencyKeys).where(where)
    throw e
  }
  if (keep(result)) await d.update(idempotencyKeys).set({ result }).where(where)
  else await d.delete(idempotencyKeys).where(where)
  return { replayed: false, result }
}

/** 보존 기간(24시간)이 지난 키를 지운다(Cron). 지운 수를 돌려준다 */
export async function purgeIdempotencyKeys(d: Database, now: Date): Promise<number> {
  const rows = await d
    .delete(idempotencyKeys)
    .where(lt(idempotencyKeys.createdAt, new Date(now.getTime() - IDEMPOTENCY_TTL_MS)))
    .returning({ key: idempotencyKeys.key })
  return rows.length
}
