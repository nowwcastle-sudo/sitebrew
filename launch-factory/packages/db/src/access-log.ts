// 접속기록 쓰기. @launch-factory/security accessLog(event, sink)의 sink로 쓴다: `(r) => insertAccessLog(db, r)`.
// 표는 추가 전용이다(마이그레이션 0001 트리거) — 고칠 수 없고, 1년이 안 된 행은 지울 수 없다.
import type { Database } from "./client.ts"
import { ACCESS_LOG_RETENTION, DEFAULT_ACCESS_LOG_RETENTION, accessLogs, type AccessLogRetention } from "./schema/access-logs.ts"

/** security의 AccessRecord와 같은 모양(구조 타입이라 security 패키지에 의존하지 않는다). */
export interface AccessLogRecord {
  actorId: string
  ip: string
  subjects: readonly string[]
  action: string
  target: string | null
  occurredAt: string
  download: boolean
}

/** 한 줄을 쓴다. 실패는 그대로 던진다(조용히 넘기지 않는다). */
export async function insertAccessLog(d: Database, r: AccessLogRecord, orgId?: string): Promise<void> {
  await d.insert(accessLogs).values({ ...r, subjects: [...r.subjects], occurredAt: new Date(r.occurredAt), orgId })
}

/** 이 시각보다 오래된 접속기록은 지워도 된다(보관 기간이 지났다). 파기 작업(Task 14 Cron)이 쓴다. */
export function accessLogPurgeBefore(now: Date, retention: AccessLogRetention = DEFAULT_ACCESS_LOG_RETENTION): Date {
  const d = new Date(now.getTime())
  d.setUTCMonth(d.getUTCMonth() - ACCESS_LOG_RETENTION[retention])
  return d
}
