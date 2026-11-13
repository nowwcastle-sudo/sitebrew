// 해지 대안 사용 예약 — 같은 구독이 같은 대안을 두 번 받지 못하게 한다. 책임은 「한 번만 예약되게 하는 것」뿐이다(공급자 호출은 어댑터가 한다).
// 예약은 INSERT … ON CONFLICT DO NOTHING 이라 동시에 여러 번 불러도 한 번만 true 다. 공급자 호출이 실패하면 releaseRetentionOffer 로 풀고, 성공하면 markRetentionOfferApplied 로 확정한다.
import { and, eq } from "drizzle-orm"
import type { Database } from "./client.ts"
import { retentionOfferUses } from "./schema/subscriptions.ts"

export interface RetentionOfferUseKey {
  provider: string
  providerSubId: string
  offerId: string
}

const sameKey = (k: RetentionOfferUseKey) =>
  and(eq(retentionOfferUses.provider, k.provider), eq(retentionOfferUses.providerSubId, k.providerSubId), eq(retentionOfferUses.offerId, k.offerId))

/** 예약한다. 이 호출이 이겼으면 true, 이미 예약됐거나 받은 대안이면 false */
export async function reserveRetentionOffer(db: Database, key: RetentionOfferUseKey, at: Date): Promise<boolean> {
  const rows = await db.insert(retentionOfferUses).values({ ...key, reservedAt: at }).onConflictDoNothing().returning({ offerId: retentionOfferUses.offerId })
  return rows.length > 0
}

/** 공급자 호출이 실패했을 때 예약을 푼다(다시 받을 수 있게). 받기를 마친(applied_at 이 있는) 행은 지우지 않는다 */
export async function releaseRetentionOffer(db: Database, key: RetentionOfferUseKey): Promise<void> {
  const rows = await db.select({ appliedAt: retentionOfferUses.appliedAt }).from(retentionOfferUses).where(sameKey(key))
  if (rows[0] && rows[0].appliedAt === null) await db.delete(retentionOfferUses).where(and(sameKey(key)))
}

/** 공급자 호출이 성공했다고 확정한다 */
export async function markRetentionOfferApplied(db: Database, key: RetentionOfferUseKey, at: Date): Promise<void> {
  await db.update(retentionOfferUses).set({ appliedAt: at }).where(sameKey(key))
}
