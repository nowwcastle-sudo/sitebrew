import type { Order, PaymentSession } from "@/components/contract/commerce"

// 결제 한 바퀴의 순수 함수(공유 조각 block-shared-checkout-flow — cart/checkout-form 이 쓴다). React·DOM 이 없어 시험이 직접 부른다.
// 흐름: ① 주문 만들기(placeOrder — 승인 행동, 블록이 `confirmed: true` 를 싣는다) ② 결제창(onPay — 조립하는 쪽이 공급자 SDK 로 연다, 블록은 공급자를 모른다) ③ 결제 확정(confirmPayment — 서버가 공급자에 다시 묻는다).
// 이 함수는 ②③ 을 잇고 갈래를 정한다. 돈이 이미 나간 뒤(③ 실패)에는 다시 결제창을 열지 않고 확정만 다시 한다 — 같은 주문을 두 번 결제하지 않게.

/** 결제창 결과. ok 가 아니면 사용자가 닫았거나(code 에 cancel) 실패한 것. paymentId 는 결제창이 돌려준 번호(확정에 쓴다) */
export type PayResult = { paymentId: string; ok: boolean; code?: string }

export type PayOutcome =
  | { status: "paid"; order: Order }
  /** 결제창에서 안 끝났다. canceled 는 사용자가 닫은 것(오류가 아니다) — 같은 주문으로 다시 결제창을 연다 */
  | { status: "pay-failed"; canceled: boolean; code?: string }
  /** 결제는 끝났지만 서버 확정을 못 받았다 — paymentId 로 확정만 다시 한다(결제창은 다시 열지 않는다) */
  | { status: "confirm-failed"; paymentId: string }

/** 결제창을 사용자가 닫은 코드인가(공급자마다 이름이 달라 cancel 이 든 코드를 취소로 읽는다) */
export const isCanceledPayment = (code?: string): boolean => !!code && /cancel/i.test(code)

/** 결제창을 열고(pay) 끝나면 확정한다(confirm). pay 가 던져도 결제 실패로 다룬다. confirm 은 실패하면 null 을 돌려준다(오류는 부른 쪽이 이미 그렸다) */
export async function payAndConfirm({ session, pay, confirm }: { session: PaymentSession; pay: (session: PaymentSession) => Promise<PayResult>; confirm: (paymentId: string) => Promise<Order | null> }): Promise<PayOutcome> {
  let result: PayResult
  try {
    result = await pay(session)
  } catch {
    return { status: "pay-failed", canceled: false }
  }
  if (!result.ok) return { status: "pay-failed", canceled: isCanceledPayment(result.code), code: result.code }
  const paymentId = result.paymentId || session.paymentId
  const order = await confirm(paymentId)
  return order ? { status: "paid", order } : { status: "confirm-failed", paymentId }
}

/** 배송지 칸 검사용: 전화번호의 숫자만 센 자릿수가 이 안인가(국내 번호 9~11자리) */
export const PHONE_DIGITS = { min: 9, max: 11 } as const
export const phoneDigitsOk = (value: string): boolean => {
  const n = value.replace(/\D/g, "").length
  return n >= PHONE_DIGITS.min && n <= PHONE_DIGITS.max
}
