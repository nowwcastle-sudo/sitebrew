import { APPROVAL_HINT } from "@/registry/factory/contract/human-actions"
import { mockAnalytics, type TrackedEvent } from "@/registry/factory/contract/adapter-mock"
import { MOCK_ADDRESS, mockCommerce } from "@/registry/factory/contract/adapter-mock-commerce"
import type { Order, PaymentSession } from "@/registry/factory/contract/commerce"

import { SUBMIT_NOTICES } from "../auth/sign-in.fixture"
import type { CartCheckoutFormCopy, CartCheckoutFormProps } from "./checkout-form"
import { CART_ALERT, CART_EMPTY, CART_TOTALS, SAMPLE_CART, orderLineOf, withCartDefaults } from "./lines-table.fixture"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 상점 「모아상점(예시)」의 배송지 + 결제. 문구는 해요체.
// 갤러리 포트: ?cart=filled(기본)|empty · ?stock=out(주문 때 재고 부족) · &submit=ok|field-error|server-error|pending|rate-limited|timeout|approval-required(placeOrder·confirmPayment 결과).
// 승인 행동이라 목은 `confirmed: true` 없이는 아무것도 바꾸지 않는다(requireConfirmation) — 이 블록은 [결제하기]를 누른 뒤에만 싣는다.
// onPay 는 결제창을 대신하는 예시다(항상 성공 — 갤러리에는 결제 공급자가 없다). 조립하는 쪽은 공급자 SDK 로 구현한다.
const COPY: CartCheckoutFormCopy = {
  humanHint: APPROVAL_HINT.ko,
  title: "주문하기",
  lead: "받는 곳을 적고 결제하면 주문이 끝나요(예시).",
  shippingTitle: "배송지",
  fields: {
    recipient: { label: "받는 분", placeholder: "홍길동" },
    phone: { label: "연락처", placeholder: "010-0000-0000" },
    postcode: { label: "우편번호", placeholder: "04524" },
    address1: { label: "주소", placeholder: "도로명 주소" },
    address2: { label: "상세 주소", placeholder: "동·호수" },
    note: { label: "배송 메모", placeholder: "문 앞에 놓아 주세요" },
  },
  marker: { required: "(필수)", optional: "(선택)" },
  errors: { recipient: "받는 분 이름을 적어 주세요.", phone: "연락처를 적어 주세요.", phoneFormat: "연락처 자릿수가 맞지 않아요. 예: 010-0000-0000", postcode: "우편번호를 적어 주세요.", address1: "주소를 적어 주세요." },
  summaryTitle: "주문 요약",
  quantity: "{quantity}개",
  listLabel: "주문할 상품",
  totals: CART_TOTALS,
  submit: "{amount} 결제하기",
  pending: "주문을 만드는 중",
  payNote: "결제 버튼을 누르면 결제창이 열려요. 카드 정보는 이 화면에 저장되지 않아요(예시).",
  pay: {
    waiting: "결제창에서 결제를 마쳐 주세요. 창을 닫으면 같은 주문으로 다시 결제할 수 있어요.",
    canceledTitle: "결제를 마치지 않았어요",
    canceled: "결제창을 닫았어요. 아직 결제되지 않았고, 주문은 그대로 있어요.",
    failedTitle: "결제하지 못했어요",
    failed: "결제가 끝나지 않았어요. 아직 돈이 나가지 않았어요. 같은 주문으로 다시 결제할 수 있어요.",
    retry: "다시 결제하기",
    confirmTitle: "결제 확인이 아직이에요",
    confirmFailed: "결제는 끝났지만 주문 확인을 받지 못했어요. 다시 결제하지 말고 아래 버튼으로 확인만 다시 해 주세요.",
    confirmRetry: "결제 확인 다시 하기",
  },
  done: { title: "주문이 끝났어요", body: "주문 번호는 {orderId}예요. 배송이 시작되면 알려 드려요(예시).", orderLabel: "주문 번호", totalLabel: "결제한 금액", link: { label: "주문 내역 보기", href: "#orders/{id}" }, continue: { label: "쇼핑 계속하기", href: "#products" } },
  empty: CART_EMPTY,
  alert: CART_ALERT,
  notices: SUBMIT_NOTICES,
  loading: "주문 정보를 불러오는 중이에요",
  error: "주문 정보를 불러오지 못했어요",
  retry: "다시 불러오기",
}

const ORDER: Order = { id: "mock-order-1", status: "pending_payment", lines: SAMPLE_CART.lines.map(orderLineOf), address: MOCK_ADDRESS, createdAt: "2026-10-01T03:00:00.000Z", subtotal: SAMPLE_CART.subtotal, shipping: SAMPLE_CART.shipping, total: SAMPLE_CART.total }
const PAYMENT: PaymentSession = { provider: "mock", paymentId: "mock-pay-1", orderName: "머그컵(예시) 외 1건", total: SAMPLE_CART.total, client: {} }

export const fixture: CartCheckoutFormProps = {
  copy: COPY,
  cart: async () => ({ ok: true, data: SAMPLE_CART }),
  placeOrder: async () => ({ ok: true, data: { order: ORDER, payment: PAYMENT } }),
  confirmPayment: async () => ({ ok: true, data: { ...ORDER, status: "paid", paidAt: "2026-10-01T03:01:00.000Z" } }),
  onPay: async (session) => ({ ok: true, paymentId: session.paymentId }),
}

export const fixtureMax: CartCheckoutFormProps = {
  ...fixture,
  copy: {
    ...COPY,
    title: "주문하기 — 받는 곳을 적고 결제해요(예시)",
    lead: "받는 곳을 적고 결제하면 주문이 끝나요. 결제 전에는 재고만 잡아 두고, 결제가 끝나야 주문이 확정돼요. 결제창을 닫아도 주문은 그대로 있어서 같은 주문으로 다시 결제할 수 있어요(예시).",
    payNote: "결제 버튼을 누르면 결제창이 열려요. 카드 정보는 이 화면에 저장되지 않고, 결제가 끝나면 주문 확인 메일을 보내 드려요. 합계에는 부가세가 이미 들어 있어요(예시).",
  },
}

export const fixtureMin: CartCheckoutFormProps = { ...fixture, copy: { ...COPY, lead: undefined, payNote: undefined, done: { ...COPY.done, continue: undefined }, totals: { ...CART_TOTALS, note: undefined } } }

// 영어 장면(FV1 FOLLOW 와 같은 규칙) — 한국어 예시와 짜임이 같고 글만 영어다. 사업 이름·업종 낱말 없이 쓴다.
export const fixtureEn: CartCheckoutFormProps = {
  ...fixture,
  copy: {
    humanHint: APPROVAL_HINT.en,
    title: "Check out",
    lead: "Enter where to send it and pay to finish your order.",
    shippingTitle: "Shipping address",
    fields: {
      recipient: { label: "Recipient", placeholder: "Jane Doe" },
      phone: { label: "Phone", placeholder: "010-0000-0000" },
      postcode: { label: "Postal code", placeholder: "04524" },
      address1: { label: "Address", placeholder: "Street address" },
      address2: { label: "Address line 2", placeholder: "Unit or floor" },
      note: { label: "Delivery note", placeholder: "Leave it at the door" },
    },
    marker: { required: "(required)", optional: "(optional)" },
    errors: { recipient: "Enter the recipient's name.", phone: "Enter a phone number.", phoneFormat: "The phone number has the wrong number of digits. Example: 010-0000-0000", postcode: "Enter the postal code.", address1: "Enter the address." },
    summaryTitle: "Order summary",
    quantity: "Qty {quantity}",
    listLabel: "Items to order",
    totals: { total: "Amount to pay", subtotal: "Items", shipping: "Shipping", shippingFree: "Free", vatIncluded: "VAT included", vatExcluded: "VAT excluded", note: "Shipping is free when items come to 50,000 KRW or more (example)." },
    submit: "Pay {amount}",
    pending: "Creating your order",
    payNote: "A payment window opens when you press Pay. Your card details are not stored on this page (example).",
    pay: {
      waiting: "Finish paying in the payment window. If you close it, you can pay again for the same order.",
      canceledTitle: "Payment not finished",
      canceled: "You closed the payment window. Nothing was charged and your order is still here.",
      failedTitle: "We couldn't take the payment",
      failed: "The payment did not go through and nothing was charged. You can pay again for the same order.",
      retry: "Pay again",
      confirmTitle: "Payment not confirmed yet",
      confirmFailed: "The payment went through but we haven't received the order confirmation. Don't pay again — use the button below to check once more.",
      confirmRetry: "Check payment again",
    },
    done: { title: "Your order is placed", body: "Your order number is {orderId}. We'll let you know when it ships (example).", orderLabel: "Order number", totalLabel: "Amount paid", link: { label: "View order", href: "#orders/{id}" }, continue: { label: "Keep shopping", href: "#products" } },
    empty: { title: "Your cart is empty", body: "Items you add will show up here (example).", label: "Browse items", href: "#products" },
    alert: { field: "Please check the highlighted fields", server: "We couldn't finish that — please try again in a moment" },
    notices: {
      rateLimited: "You can send again in {seconds} seconds",
      timeout: { title: "Taking longer than expected", body: "The server has not answered yet. What you wrote is still here, so please try again.", retry: "Try again" },
      unsupported: { title: "This cannot be changed here", link: "Go to where you manage it" },
      approval: { title: "Please confirm this yourself", attempted: "We received your order request.", progress: "Nothing has been ordered yet.", reason: "A person has to review the order and press the button.", next: "Press the Pay button on the screen yourself.", route: { label: "Contact support", href: "#contact" } },
    },
    loading: "Loading your order",
    error: "We couldn't load your order",
    retry: "Try again",
  },
}

export const fixturePorts = (q: URLSearchParams, g: { fx: string; onTrack: (e: TrackedEvent) => void }): Partial<CartCheckoutFormProps> => {
  const commerce = mockCommerce(withCartDefaults(q, { cart: "filled" }), { requireConfirmation: true })
  return { cart: commerce.cart, placeOrder: commerce.placeOrder, confirmPayment: commerce.confirmPayment, track: mockAnalytics(q, { onTrack: g.onTrack }).track }
}
