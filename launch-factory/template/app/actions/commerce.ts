"use server"
// launch-factory: 상점 서버 액션 — 계약 CommercePort 의 메서드와 이름이 같다(catalog · cart · setCartLine · placeOrder · confirmPayment · orders · order · cancelOrder) + 모의 결제 payWithMock.
// 규칙(모든 액션 같다):
//   1. 로그인한 사람의 것만 다룬다. userId 는 세션에서 읽는다 — 입력으로 받지 않는다. 로그아웃이면 code sign_in_required.
//   2. 상점이 꺼져 있으면(live 에서 PortOne 값이 빠짐) code provider_unavailable · retryable false. 사이트는 켜져 있다.
//   3. 쓰는 액션은 요청 제한(guardAction, 사용자·IP 별)을 먼저 지난다. 한도 밖은 code rate_limited·retryAfter 로 막히고 상점 포트에 닿지 않는다.
//   4. 대리 로그인(관리자가 사용자 대신 들어온 세션) 중에는 읽기(catalog · cart · orders · order)만 된다. 나머지는 상점 포트를 부르기 전에 403 으로 막는다.
//   5. 주문하기(placeOrder)와 주문 취소(cancelOrder)는 사람의 확인 입력(`confirmed: true`) 없이는 아무것도 바꾸지 않는다 — code confirmation_required(승인 대기, 오류 아님).
import { blockWhileImpersonating } from "@launch-factory/auth"
import { ownedOrder } from "@launch-factory/commerce"
import type { CommercePort } from "@launch-factory/contract"
import { t } from "@launch-factory/i18n"
import { signInRequiredResult } from "@launch-factory/security/action"
import { headers } from "next/headers"
import { commerceEnabled, commerceFor } from "@/lib/launch/commerce"
import { DEFAULT_LOCALE } from "@/lib/launch/config"
// 세션 읽기는 한 곳(commerce-session.ts)이다 — 이름을 session 으로 받아 서버 액션 인증 검사(ci/server-action-guards.mjs)가 가드로 읽는다
import { shopSession as session, type ShopSession } from "@/lib/launch/commerce-session"
import { database } from "@/lib/launch/db"
import { payments } from "@/lib/launch/payments"
import { guardAction } from "@/lib/launch/security"

const locale = DEFAULT_LOCALE
/** 대리 로그인 중에도 되는 메서드(읽기뿐) */
const COMMERCE_READS = ["catalog", "cart", "orders", "order"] as const
/** 요청 제한 경로(RATE_LIMIT_DEFAULTS) — 읽기는 제한하지 않는다 */
type WriteRoute = "shopCart" | "shopOrder" | "shopConfirm" | "shopCancel"

const providerUnavailable = () => ({ ok: false as const, code: "provider_unavailable", retryable: false, formError: t(locale, "commerce.unavailable") })

/** 세션 → 상점 켜짐 → (쓰기면) 요청 제한 → 대리 로그인 차단 포트. 순서가 바깥에서 안쪽이다 */
async function withPort<R>(route: WriteRoute | null, use: (port: CommercePort, who: ShopSession) => Promise<R>) {
  const s = await session()
  if (!s) return signInRequiredResult(locale)
  if (!commerceEnabled()) return providerUnavailable()
  if (route) {
    const refused = await guardAction(route, { headers: new Headers(await headers()), userId: s.userId })
    if (refused) return refused
  }
  return use(blockWhileImpersonating(await commerceFor(s.userId), s, COMMERCE_READS, locale), s)
}

/** 판매 상품과 지금 살 수 있는 재고 */
export async function catalog() {
  return withPort(null, (port) => port.catalog())
}

/** 내 장바구니(가격은 서버의 상품표 기준) */
export async function cart() {
  return withPort(null, (port) => port.cart())
}

/** 입력: { productId, quantity } — 수량 0 이면 줄을 뺀다 */
export async function setCartLine(input: Parameters<CommercePort["setCartLine"]>[0]) {
  return withPort("shopCart", (port) => port.setCartLine(input))
}

/** 입력: { address, confirmed: true }. 성공하면 결제 대기 주문과 결제창 값(PaymentSession)을 돌려준다 */
export async function placeOrder(input: Parameters<CommercePort["placeOrder"]>[0]) {
  return withPort("shopOrder", (port) => port.placeOrder(input))
}

/** 입력: { orderId, paymentId } — 결제창을 닫은 뒤(리디렉션 반환). 서버가 결제 공급자에 다시 물어 확정한다(웹훅과 같은 경로) */
export async function confirmPayment(input: Parameters<CommercePort["confirmPayment"]>[0]) {
  return withPort("shopConfirm", (port) => port.confirmPayment(input))
}

export async function orders() {
  return withPort(null, (port) => port.orders())
}

/** 입력: { orderId } — 내 주문만 보인다(남의 주문 id 는 not_found) */
export async function order(input: Parameters<CommercePort["order"]>[0]) {
  return withPort(null, (port) => port.order(input))
}

/** 입력: { orderId, reason?, confirmed: true } — 결제 전이면 취소, 결제 후면 환불까지 성공해야 취소된다 */
export async function cancelOrder(input: Parameters<CommercePort["cancelOrder"]>[0]) {
  return withPort("shopCancel", (port) => port.cancelOrder(input))
}

/**
 * 모의 결제(LF_MODE=mock 미리보기 전용): 내 결제 대기 주문의 모의 결제를 「완료」로 만들고 같은 확정 경로(confirmPayment)로 마무리한다.
 * live 에서는 code provider_unsupported 로 거절한다 — 실결제는 PortOne 결제창과 웹훅뿐이다. 입력: { orderId }
 */
export async function payWithMock(input: { orderId: string }) {
  return withPort("shopConfirm", async (port, who) => {
    const pay = async () => {
      const config = payments()
      if (!config.enabled || config.mode !== "mock") return { ok: false as const, code: "provider_unsupported", retryable: false, formError: t(locale, "commerce.unavailable") }
      const orderId = typeof input?.orderId === "string" ? input.orderId : ""
      const mine = await ownedOrder(await database(), orderId, who.userId)
      const notFound = { ok: false as const, code: "not_found", retryable: false, formError: t(locale, "commerce.failure.not_found") }
      if (!mine?.paymentId) return notFound
      try {
        config.gateway.markPaid(mine.paymentId)
      } catch {
        // 서버가 다시 떠서 모의 결제 대기가 사라졌다 — 주문은 만료 Cron 이 정리한다
        return notFound
      }
      return port.confirmPayment({ orderId, paymentId: mine.paymentId })
    }
    // 대리 로그인 중에는 모의 결제도 일으키지 않는다(결제 확정 전에 막는다)
    return blockWhileImpersonating({ pay }, who, [], locale).pay()
  })
}
