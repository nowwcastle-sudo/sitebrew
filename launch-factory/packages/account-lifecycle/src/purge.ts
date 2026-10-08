// 파기 Cron 본체(v0 Task 14). 경로 연결(app/api/cron/purge/route.ts)은 Task 10 이 이 함수를 부른다.
// 근거: 개인정보 보호법 제21조제1항(불필요해지면 지체 없이 파기, 다른 법령이 보존을 요구하면 예외)·제2항(복구·재생 안 되게)·
//       제3항(보존하는 것은 분리 저장), 시행령 제16조제1항제1호(전자 파일은 복원 불가능하게 영구 삭제). 2026-09-30 법령 API 확인.
//
// 한 요청의 단계(각 단계는 다시 돌려도 결과가 같다 — Cron 이 두 번 돌거나 중간에 죽어도 한 번만 처리된다):
//   1. 잡기: pending 이고 유예가 지난 요청을 purging 으로 바꾼다(한 문장 UPDATE). 이때부터 로그인해도 취소되지 않는다.
//   2. 결제: 구독이 아직 살아 있으면 즉시 해지한다. 실패하면 purging 으로 두고 다음 Cron 이 다시 한다(파기하지 않는다).
//   3. DB 파기(한 트랜잭션): 요청 행을 잠그고 다시 purging 인지 본다 → 보존 대상을 retained_transactions 로 옮긴다(가명 참조) →
//      이메일이 든 verification·초대, 사용자 키가 든 요청 제한 행을 지운다 → user 행을 지운다(세션·계정·2단계·구독·동의·마케팅 수신이 CASCADE) →
//      요청을 purged 로.
//   4. 계측: 계측 식별자(PostHog distinct id = 내부 사용자 id)를 지운다. 실패하면 다음 Cron 이 다시 한다.
//   5. 마무리: 계측까지 끝나면 completed_at 을 적고 요청 행의 user_id 를 비운다.
//   6. 기간이 지난 보존 거래기록·접속기록을 지운다(sweepExpired).
// 남기는 것(법정 보존): retained_transactions(가명), access_logs(고시 제8조 — 처리자 접속기록, 1·2년), admin_actions(관리자 처리 기록).
import { and, eq, isNotNull, isNull, lte, or, sql } from "drizzle-orm"
import { accountDeletions, invitation, rateLimits, user, verification, type AccessLogRetention, type Database } from "@launch-factory/db"
import { LIVE_SUBSCRIPTION_STATUSES, type DeletionDeps } from "./delete.ts"
import { DEFAULT_COLLECTORS, retainTransaction, sweepExpired, type RetentionCollector, type SweepReport, type Tx } from "./retention.ts"
import { assertSubjectKey, subjectRef } from "./subject.ts"

/** 계측 공급자의 사람·이벤트 삭제(PostHog bulk_delete 등). 실패는 던진다 */
export interface AnalyticsEraser {
  erase(distinctIds: readonly string[]): Promise<void>
}

/** 계측을 쓰지 않는 제품. 이름을 붙여 일부러 고르게 한다(빠뜨려서 조용히 건너뛰지 않게) */
export const NO_ANALYTICS_ERASER: AnalyticsEraser = { erase: async () => {} }

/** 파기 트랜잭션 안에서 제품이 더한 표의 행을 지운다(개인 식별 칸이 있는 새 표를 만들면 여기에 더한다) */
export type Purger = (tx: Tx, ctx: { userId: string; email: string }) => Promise<void>

export interface PurgeDeps extends Omit<DeletionDeps, "graceDays"> {
  /** SUBJECT_REF_KEY(32자 이상) */
  subjectKey: string
  analytics: AnalyticsEraser
  collectors?: readonly RetentionCollector[]
  purgers?: readonly Purger[]
  accessLogRetention?: AccessLogRetention
  /** 한 번에 잡는 요청 수(기본 50) — 짧게 사는 함수의 시간 안에 끝나게 */
  batchSize?: number
}

export interface PurgeFailure {
  deletionId: string
  stage: "billing" | "purge" | "analytics"
  error: string
}

export interface PurgeReport {
  claimed: number
  purged: number
  analyticsErased: number
  completed: number
  failures: PurgeFailure[]
  swept: SweepReport
}

/** 오류는 이름과 짧은 코드만 남긴다(메시지에 이메일이 섞일 수 있다) */
const errorCode = (e: unknown) => (e instanceof Error ? `${e.name}${(e as { code?: unknown }).code ? `:${String((e as { code?: unknown }).code)}` : ""}` : "unknown")

export async function runPurge(deps: PurgeDeps): Promise<PurgeReport> {
  assertSubjectKey(deps.subjectKey)
  if (!deps.analytics) throw new Error("analytics eraser is required (use NO_ANALYTICS_ERASER when the product has no analytics)")
  const { db } = deps
  const now = (deps.now ?? (() => new Date()))()
  const batch = deps.batchSize ?? 50
  const collectors = deps.collectors ?? DEFAULT_COLLECTORS
  const report: PurgeReport = { claimed: 0, purged: 0, analyticsErased: 0, completed: 0, failures: [], swept: { retained: { advertising: 0, contract: 0, payment: 0, dispute: 0 }, accessLogs: 0 } }
  const fail = async (id: string, stage: PurgeFailure["stage"], e: unknown) => {
    const code = `${stage}:${typeof e === "string" ? e : errorCode(e)}`
    report.failures.push({ deletionId: id, stage, error: code })
    await db.update(accountDeletions).set({ lastError: code }).where(eq(accountDeletions.id, id))
  }

  // 1. 잡기 — 한 문장이라 동시에 로그인해 취소한 요청은 잡히지 않는다
  const claimed = await db
    .update(accountDeletions)
    .set({ status: "purging" })
    .where(
      sql`${accountDeletions.id} in (select ${accountDeletions.id} from ${accountDeletions} where ${accountDeletions.status} = 'pending' and ${accountDeletions.graceUntil} <= ${now} order by ${accountDeletions.graceUntil} limit ${batch})`,
    )
    .returning({ id: accountDeletions.id })
  report.claimed = claimed.length

  // 이번에 잡은 것 + 지난번에 멈춘 것(purging 으로 남은 것)
  const work = await db.select().from(accountDeletions).where(eq(accountDeletions.status, "purging")).orderBy(accountDeletions.graceUntil).limit(batch)
  for (const del of work) {
    const userId = del.userId
    if (!userId) {
      await fail(del.id, "purge", "no_user_id")
      continue
    }
    // 2. 결제
    try {
      const billing = deps.billingFor(userId)
      const sub = await billing.subscription()
      if (!sub.ok) {
        await fail(del.id, "billing", "subscription_lookup")
        continue
      }
      if (LIVE_SUBSCRIPTION_STATUSES.includes(sub.data.status)) {
        const cancelled = await billing.cancel({ when: "now", reason: "other" })
        if (!cancelled.ok) {
          await fail(del.id, "billing", "cancel")
          continue
        }
      }
    } catch (e) {
      await fail(del.id, "billing", e)
      continue
    }
    // 3. DB 파기
    try {
      const done = await db.transaction(async (tx) => {
        const [locked] = await tx.select().from(accountDeletions).where(eq(accountDeletions.id, del.id)).for("update")
        if (locked?.status !== "purging") return false // 다른 Cron 이 먼저 끝냈다
        const [u] = await tx.select({ id: user.id, email: user.email }).from(user).where(eq(user.id, userId))
        let ref: string | null = locked.subjectRef
        if (u) {
          ref = subjectRef(deps.subjectKey, u.email)
          for (const collect of collectors) for (const item of await collect(tx, { userId, now })) await retainTransaction(tx, ref, item)
          await tx.delete(verification).where(or(eq(verification.value, userId), sql`position(lower(${u.email}) in lower(${verification.value})) > 0`, sql`position(lower(${u.email}) in lower(${verification.identifier})) > 0`))
          await tx.delete(invitation).where(sql`lower(${invitation.email}) = lower(${u.email})`)
          await tx.delete(rateLimits).where(sql`position(${userId} in ${rateLimits.key}) > 0`)
          for (const purge of deps.purgers ?? []) await purge(tx, { userId, email: u.email })
          await tx.delete(user).where(eq(user.id, userId))
        }
        await tx.update(accountDeletions).set({ status: "purged", purgedAt: now, subjectRef: ref, lastError: null }).where(eq(accountDeletions.id, del.id))
        return true
      })
      if (done) report.purged++
    } catch (e) {
      await fail(del.id, "purge", e)
    }
  }

  // 4. 계측 — 이번에 파기한 것과 지난번에 실패한 것
  const toErase = await db
    .select()
    .from(accountDeletions)
    .where(and(eq(accountDeletions.status, "purged"), isNull(accountDeletions.analyticsErasedAt), isNotNull(accountDeletions.userId)))
    .limit(batch)
  for (const del of toErase) {
    try {
      await deps.analytics.erase([del.userId as string])
      await db.update(accountDeletions).set({ analyticsErasedAt: now, lastError: null }).where(eq(accountDeletions.id, del.id))
      report.analyticsErased++
    } catch (e) {
      await fail(del.id, "analytics", e)
    }
  }

  // 5. 마무리 — 요청 행에서 사용자 id 를 비운다(남는 것은 가명 참조와 시각뿐)
  const completed = await db
    .update(accountDeletions)
    .set({ completedAt: now, userId: null })
    .where(and(eq(accountDeletions.status, "purged"), isNotNull(accountDeletions.analyticsErasedAt), isNull(accountDeletions.completedAt)))
    .returning({ id: accountDeletions.id })
  report.completed = completed.length

  // 6. 기간 지난 보존 기록
  // 트리거는 DB 의 실제 시각으로 막으므로, 앞당긴 now(시험·재처리)로 지우려 하면 트랜잭션이 깨진다 — 실제 시각을 넘기지 않는다.
  const wall = new Date()
  report.swept = await sweepExpired(db, now > wall ? wall : now, deps.accessLogRetention)
  return report
}

/** 유예가 지났는데 아직 파기되지 않은 요청 수(점검·알림용) */
export async function overdueDeletions(db: Database, now: Date = new Date()): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(accountDeletions)
    .where(or(and(eq(accountDeletions.status, "pending"), lte(accountDeletions.graceUntil, now)), eq(accountDeletions.status, "purging")))
  return row?.n ?? 0
}
