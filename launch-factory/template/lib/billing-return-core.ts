// 결제 창을 마친 직후 구독을 바로 맞춘다(LFFIX F3) — 판단 부분. 공급자·DB 는 deps 로 받는다(시험이 가짜를 끼운다). 연결은 lib/billing-return.ts.
// Paddle 문서(2026-10-03): 거래 조회 GET /transactions/{id} 의 `subscription_id`·`custom_data` — 거래가 completed 가 돼야 subscription_id 가 붙는다(구독은 비동기로 만들어진다).
// 그래서 아직 없으면 실패가 아니라 「아직」이다(구독 상태 none 을 그대로 돌려준다) — 화면이 2초 간격으로 다시 부른다. 웹훅이 먼저 오면 resync 가 같은 행을 같은 값으로 덮을 뿐이다(순서 키가 막는다).
// 로그인한 본인의 거래만 받는다 — 거래의 custom_data.lf_user_id 가 세션 사용자와 다르면 거절한다.
import { CD } from "@launch-factory/billing-paddle"
import type { ActionResult } from "@/components/contract/block-contract"
import type { Subscription } from "@/components/contract/ports"

const TXN_ID = /^txn_[0-9a-z]{20,40}$/

/** receiptEmail: 공급자 고객 기록의 주소(E09 — 결제 창에서 바꿔 적을 수 있어 계정 이메일과 다를 수 있다). 읽지 못하면 없다 */
export type SyncResult = ActionResult<Subscription & { receiptEmail?: string }>

export interface SyncDeps {
  getTransaction(id: string): Promise<{ customData?: unknown; subscriptionId?: string | null; customerId?: string | null }>
  resync(subscriptionId: string): Promise<unknown>
  subscription(): Promise<ActionResult<Subscription>>
  /** 영수증이 가는 주소(E09). 못 읽는 것은 결제 확인의 실패가 아니다 */
  customerEmail?(customerId: string): Promise<string | null | undefined>
}

export async function syncAfterCheckout(userId: string, transactionId: unknown, deps: SyncDeps): Promise<SyncResult> {
  if (typeof transactionId !== "string" || !TXN_ID.test(transactionId)) return { ok: false, formError: "That payment reference isn't valid." }
  try {
    const txn = await deps.getTransaction(transactionId)
    if ((txn.customData as Record<string, unknown> | null | undefined)?.[CD.userId] !== userId) return { ok: false, formError: "That payment isn't on this account." }
    if (txn.subscriptionId) await deps.resync(txn.subscriptionId)
    const sub = await deps.subscription()
    // 구독이 아직 없으면(none) 영수증 이야기는 이르다 — 주소는 본인 거래이고 구독이 생긴 뒤에만 읽는다
    if (!sub.ok || sub.data.status === "none" || !txn.customerId || !deps.customerEmail) return sub
    const receiptEmail = await deps.customerEmail(txn.customerId).catch(() => null)
    return receiptEmail ? { ...sub, data: { ...sub.data, receiptEmail } } : sub
  } catch (e) {
    // 없는 거래는 다시 물어도 같다. 그 밖(네트워크·공급자 5xx)은 다시 시도할 수 있다
    if ((e as { code?: unknown } | null)?.code === "not_found") return { ok: false, formError: "We couldn't find that payment.", retryable: false }
    return { ok: false, formError: "We couldn't check the payment just now.", retryable: true }
  }
}
