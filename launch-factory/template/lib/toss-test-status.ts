import type { LedgerDatabase } from "@launch-factory/billing-toss"

/** 레거시 화면용 조회: 승인된 현재 기간에만 paid이며 진행 중 주문은 pending이다. */
export async function tossTestStatus(db: Pick<LedgerDatabase, "query">, userId: string, productId: string) {
  const rows = await db.query<{ registered: boolean; paid: boolean; pending: boolean }>("SELECT EXISTS (SELECT 1 FROM toss_ledger_subscriptions WHERE user_id=$1 AND product_id=$2 AND status='enabled' AND (cancel_at IS NULL OR cancel_at>now())) AS registered, EXISTS (SELECT 1 FROM toss_ledger_charges c JOIN toss_ledger_subscriptions s ON s.id=c.subscription_id WHERE s.user_id=$1 AND s.product_id=$2 AND s.status='enabled' AND c.status='paid' AND c.amount=s.amount AND s.period_start<=now() AND s.period_end>now() AND (s.cancel_at IS NULL OR s.cancel_at>now())) AS paid, (EXISTS (SELECT 1 FROM toss_registration_sessions WHERE user_id=$1 AND product_id=$2 AND (status IN ('issuing','cancel_requested') OR (status='pending' AND expires_at > now()))) OR EXISTS (SELECT 1 FROM toss_ledger_charges c JOIN toss_ledger_subscriptions s ON s.id=c.subscription_id WHERE s.user_id=$1 AND s.product_id=$2 AND c.status='in_flight')) AS pending", [userId, productId])
  if (!rows.rows[0]) throw new Error("Test registration status unavailable")
  return rows.rows[0]
}


type DisplayState = {
  phase: string
  paymentPending: boolean
  cancelPending: boolean
  scheduleHoldReason: "legacy_paid" | "overdue" | "credential_unavailable" | null
  paymentDeclined: boolean
  retryAt: string | null
  retryLimitReached: boolean
}

/** 원장에 기록된 사실만 화면 문구로 바꾼다. */
export function describeTossTestState(state: DisplayState) {
  const statusMessage = state.cancelPending ? "해지 요청을 접수했습니다. 기존 시험 청구 결과를 확인 중입니다." : state.paymentPending ? "시험 청구 확인 중입니다. 기존 주문만 조회합니다." : state.phase === "active" ? "시험 청구가 확인되었습니다." : state.phase === "registered_unpaid" ? "카드 등록 완료 · 결제 전" : state.phase === "registering" ? "진행 중이거나 확인이 필요한 등록이 있습니다." : state.phase === "canceled" ? "시험 구독이 해지되었습니다." : state.phase === "expired" ? "시험 이용 기간이 끝났습니다." : "등록된 시험 카드가 없습니다."
  const holdMessage = state.scheduleHoldReason === "overdue" ? "장기간 청구가 중단되어 자동 청구를 보류했습니다. 확인이 필요합니다." : state.scheduleHoldReason === "legacy_paid" ? "이전 결제의 이용 기간을 확인할 수 없어 자동 청구를 보류했습니다." : state.scheduleHoldReason === "credential_unavailable" ? "등록된 결제 정보를 확인할 수 없어 자동 청구를 보류했습니다." : null
  const retryMessage = !state.paymentDeclined ? null : state.retryLimitReached ? "시험 청구가 거절되어 재시도 횟수를 모두 사용했습니다." : state.retryAt ? `시험 청구가 거절되었습니다. 다음 시도 가능 시각: ${state.retryAt}` : "시험 청구가 거절되었습니다."
  return { statusMessage, holdMessage, retryMessage }
}
