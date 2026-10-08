"use server"
// 제품 서버 액션(v0 Task 10). 블록 props 로 넘기는 포트 메서드 — 서버 컴포넌트가 이 함수들을 클라이언트 블록에 그대로 넘긴다
// (서버 액션은 직렬화된다. 목 어댑터의 함수는 안 된다). 두 모드 모두 lib/ports.ts 를 부르므로 블록 쪽 코드는 같다.
// 공개 입구다: 로그인한 사용자 자신에게만 작용하고, 입력 모양은 어댑터(live 는 authActions·checkoutAction)가 먼저 검사한다.
// LFAX(M03·M04): ① 사람 승인 행동(요금제 변경·해지·가격 변경 동의/거절·해지 대안 적용)은 입력의 `confirmed: true` 없이는 실행하지 않는다 —
//   화면을 건너뛴 호출은 포트에 닿기 전에 code `confirmation_required`(승인 대기)로 끝난다. 화면은 자기 확인 단계 뒤에 블록이 `confirmed: true` 를 직접 싣는다(web-factory v0.0.11 — 조립의 `watch.confirmed` 는 걷었다).
//   서명(타입)은 블록 props 모양(계약 포트 입력 — 확인 칸 선택)이고, 확인 칸 검사는 런타임 `gated()` 가 한다.
//   ② 모든 결과가 `code`·`retryable` 을 갖고 나간다(machineResult) — mock 어댑터가 준 글뿐인 실패도 같다.
import { confirmedBillingActions, type Confirmed } from "@launch-factory/consent"
import { machineResult } from "@launch-factory/security/action"
import type { AuthPort, BillingPort } from "@/components/contract/ports"
import { DEFAULT_LOCALE } from "@/lib/launch/config"
import { ports } from "@/lib/ports"
import { onlyOffered } from "@/lib/plan-param"
import { forReadBlock } from "@/lib/read-block-result"
import { euGate } from "@/lib/launch/eu-sales"
import { headers } from "next/headers"

const coded = <R extends { ok: boolean }>(r: R): R => machineResult(r, DEFAULT_LOCALE)
const gated = async () => confirmedBillingActions((await ports()).billing, { locale: DEFAULT_LOCALE })

export const methods = async () => coded(await (await ports()).auth.methods())
export const signIn = async (input: Parameters<AuthPort["signIn"]>[0]) => coded(await (await ports()).auth.signIn(input))
export const signUp = async (input: Parameters<AuthPort["signUp"]>[0]) => coded(await (await ports()).auth.signUp(input))
// E03: 결제·요금표 화면이 보는 요금제는 내는 주기(OFFERED_INTERVALS — 월)만. 설정에 연 가격이 있어도 화면에 나오지 않는다
export const plans = async () => {
  const r = coded(await (await ports()).billing.plans())
  return r.ok ? { ...r, data: onlyOffered(r.data) } : r
}
// B04: 블록이 읽는 이 읽기 액션만 계약 이름 `signInRequired` 로 로그인 필요를 알린다(lib/read-block-result.ts). 쓰기 액션은 `sign_in_required` 그대로다.
export const subscription = async () => forReadBlock(coded(await (await ports()).billing.subscription()))
// F10: 결제 서버 입구에서 EU 결제 국가를 막는다(LF_EU_SALES 기본 열림 · off 로 닫음 — lib/launch/eu-sales.ts). 막히면 결제 포트를 부르지 않는다
export const checkout = async (input: Parameters<BillingPort["checkout"]>[0] & { billingCountry?: string }) => {
  const g = await euGate<typeof input>(input, headers, DEFAULT_LOCALE)
  if (!g.ok) return coded(g)
  return coded(await (await ports()).billing.checkout(g.input))
}
/** 입력에 confirmed: true 가 있어야 한다(사람이 요금제 변경 요약을 확인했다는 뜻) */
export const changePlan = async (input: Parameters<BillingPort["changePlan"]>[0]) => (await gated()).changePlan(input as Confirmed<typeof input>)
/** 입력: { confirmed: true } — 가격 변경 동의(L6). 무응답은 동의가 아니다 */
export const acceptPriceChange = async (input?: Parameters<BillingPort["acceptPriceChange"]>[0]) => (await gated()).acceptPriceChange(input as { confirmed: true })
export const resume = async () => coded(await (await ports()).billing.resume())
export const updatePaymentMethod = async () => coded(await (await ports()).billing.updatePaymentMethod())
export const portal = async () => coded(await (await ports()).billing.portal())
export const session = async () => coded(await (await ports()).auth.session())
export const signOut = async () => coded(await (await ports()).auth.signOut())
export const sendVerificationEmail = async (input?: Parameters<NonNullable<AuthPort["sendVerificationEmail"]>>[0]) => coded(await (await ports()).auth.sendVerificationEmail(input))
export const requestPasswordReset = async (input: Parameters<AuthPort["requestPasswordReset"]>[0]) => coded(await (await ports()).auth.requestPasswordReset(input))
/** 입력에 confirmed: true 가 있어야 한다. 가격 변경 거절(해지)도 이 입구다 */
export const cancel = async (input: Parameters<BillingPort["cancel"]>[0]) => (await gated()).cancel(input as Confirmed<typeof input>)
/** 입력에 confirmed: true 가 있어야 한다(해지 흐름에서 고른 대안을 적용한다) */
export const applyRetentionOffer = async (input: Parameters<BillingPort["applyRetentionOffer"]>[0]) => (await gated()).applyRetentionOffer(input as Confirmed<typeof input>)
export const syncCheckout = async (input: { transactionId: string }) => coded(await (await ports()).billing.syncCheckout(input))
export const resetPassword = async (input: { token: string; newPassword: string }) => coded(await (await ports()).auth.resetPassword(input))
