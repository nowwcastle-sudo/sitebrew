// 광고성 문자 동의 확인. 어떤 동의 저장소를 쓸지는 제품이 정한다 — notify-kr 는 함수 하나(`CanMarketing`)만 받는다.
import { canSendMarketing } from "@launch-factory/consent"
import type { Database } from "@launch-factory/db"

export interface MarketingCheckContext {
  channel: "sms"
  now: Date
}
export type MarketingCheckResult = boolean | { ok: boolean; reason?: string }
/** 이 사람에게 광고 문자를 보내도 되는가. 거절 이유는 `{ ok: false, reason }` 로 남길 수 있다 */
export type CanMarketing = (userId: string, ctx: MarketingCheckContext) => MarketingCheckResult | Promise<MarketingCheckResult>

/** 동의 백엔드(@launch-factory/consent)로 sms 채널 동의·2년 재확인을 보는 확인기. 야간은 notify-kr 가 따로 점검한다 */
export function consentGuard(db: Database): CanMarketing {
  return async (userId, { now }) => {
    const decision = await canSendMarketing(db, userId, { channel: "sms", now, nightGuard: false })
    return decision.ok ? { ok: true } : { ok: false, reason: decision.reason }
  }
}

/** 확인기 결과를 하나의 모양으로. 확인기가 없거나 던지거나 이상한 값을 주면 모두 거절한다 */
export async function runCanMarketing(check: CanMarketing | undefined, userId: string, ctx: MarketingCheckContext): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!check) return { ok: false, reason: "no_consent" }
  try {
    const r = await check(userId, ctx)
    if (r === true) return { ok: true }
    if (r && typeof r === "object" && r.ok === true) return { ok: true }
    return { ok: false, reason: r && typeof r === "object" && typeof r.reason === "string" && r.reason ? r.reason : "no_consent" }
  } catch {
    return { ok: false, reason: "consent_check_failed" }
  }
}
