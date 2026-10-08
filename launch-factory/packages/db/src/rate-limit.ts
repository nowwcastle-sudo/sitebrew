// 요청 제한 계수 저장소(v0 Task 15). 규칙·키는 @launch-factory/security/rate-limit 이 정하고, 여기는 한 번 세기만 한다.
// 고정 창(fixed window): 창이 끝났으면 1부터 다시 센다. 한 문장(INSERT … ON CONFLICT DO UPDATE)이라 동시 요청에도 원자적이다.
// 막힌 요청도 센다 — 창 시작 시각은 바뀌지 않으므로 Retry-After 가 늘어나지는 않는다.
import { lt, sql } from "drizzle-orm"
import type { Database } from "./client.ts"
import { rateLimits } from "./schema.ts"

export interface RateCount {
  count: number
  windowStartedAt: Date
}

/** key 를 한 번 센다. 창(windowMs)이 지난 기록이면 새 창으로 시작한다. */
export async function hitRateLimit(d: Database, key: string, windowMs: number, now: Date): Promise<RateCount> {
  const cutoff = new Date(now.getTime() - windowMs)
  const expired = sql`${rateLimits.windowStartedAt} <= ${cutoff.toISOString()}::timestamptz`
  const [row] = await d
    .insert(rateLimits)
    .values({ key, count: 1, windowStartedAt: now })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`case when ${expired} then 1 else ${rateLimits.count} + 1 end`,
        windowStartedAt: sql`case when ${expired} then ${now.toISOString()}::timestamptz else ${rateLimits.windowStartedAt} end`,
      },
    })
    .returning({ count: rateLimits.count, windowStartedAt: rateLimits.windowStartedAt })
  return row as RateCount
}

/** 창이 끝난 지 오래된 행을 지운다(Cron). olderThan 보다 먼저 시작한 창만. 지운 수를 돌려준다 */
export async function purgeRateLimits(d: Database, olderThan: Date): Promise<number> {
  const rows = await d.delete(rateLimits).where(lt(rateLimits.windowStartedAt, olderThan)).returning({ key: rateLimits.key })
  return rows.length
}
