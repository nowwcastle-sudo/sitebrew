import { mockAnalytics, type TrackedEvent } from "@/registry/factory/contract/adapter-mock"
import { mockCommerce } from "@/registry/factory/contract/adapter-mock-commerce"
import { APPROVAL_HINT } from "@/registry/factory/contract/human-actions"

import { SUBMIT_NOTICES } from "../auth/sign-in.fixture"
import { CART_TOTALS, withCartDefaults } from "../cart/lines-table.fixture"
import type { AccountOrderDetailCopy, AccountOrderDetailProps } from "./order-detail"
import { ORDER_NOTES, ORDER_STATUS, sampleOrder } from "./order-history.fixture"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 상점 「모아상점(예시)」의 주문 상세. 주문은 목의 씨앗 주문(mock-order-1)이다.
// 갤러리 포트: ?order=none|pending_payment|paid(기본)|preparing|shipped|delivered|canceled|refunded · &state=(order 읽기) · &submit=(cancelOrder 결과).
// 승인 행동: 취소 확인 칸의 [취소 확정]만 승인 행동(cancel-order)이다. 포트는 확인(confirmed)을 요구하게 열어 둔다(requireConfirmation) — 블록이 확인을 싣지 않으면 취소가 안 된다.
const COPY: AccountOrderDetailCopy = {
  title: "주문 상세",
  humanHint: APPROVAL_HINT.ko,
  lead: "주문 상태와 배송 상황을 확인하고, 아직 배송 전이면 여기서 취소할 수 있어요(예시).",
  orderLabel: "주문번호",
  status: ORDER_STATUS,
  notes: ORDER_NOTES,
  tracking: { label: "송장번호", link: { label: "배송 조회", href: "#tracking-{number}" } },
  items: { title: "주문 상품", listLabel: "주문한 상품", quantity: "{quantity}개" },
  totals: CART_TOTALS,
  shipping: { title: "받는 분", recipient: "이름", phone: "연락처", address: "주소", note: "배송 메모" },
  cancel: {
    title: "주문 취소",
    open: "주문 취소하기",
    questionUnpaid: "아직 결제하지 않은 주문이에요. 주문을 닫을까요?",
    questionPaid: "이 주문을 취소할까요? 결제한 금액은 환불돼요.",
    reasonLabel: "취소 사유",
    reasonMarker: "(선택)",
    reasonHint: "적어 주시면 서비스를 고치는 데 써요.",
    back: "돌아가기",
    confirm: "취소 확정",
    pending: "취소하는 중",
    errorTitle: "취소하지 못했어요",
    unavailable: "배송이 시작된 주문은 여기서 취소할 수 없어요. 받은 뒤 반품으로 접수해 주세요(예시).",
  },
  notices: SUBMIT_NOTICES,
  empty: { title: "주문을 찾을 수 없어요", body: "주문번호를 다시 확인하거나 주문 내역에서 골라 주세요(예시).", label: "주문 내역 보기", href: "#orders" },
  loading: "주문을 불러오는 중이에요",
  error: "주문을 불러오지 못했어요",
  retry: "다시 불러오기",
}

export const fixture: AccountOrderDetailProps = {
  copy: COPY,
  orderId: "mock-order-1",
  order: async () => ({ ok: true, data: sampleOrder("paid") }),
  cancelOrder: async () => ({ ok: true, data: { ...sampleOrder("refunded"), canceledAt: "2026-10-02T03:00:00.000Z" } }),
}

export const fixtureMax: AccountOrderDetailProps = {
  ...fixture,
  copy: {
    ...COPY,
    title: "주문 상세 — 상태와 배송 상황, 취소까지 한 곳에서(예시)",
    lead: "주문 상태가 바뀌면 이 화면이 바로 보여 드려요. 배송이 시작되기 전이면 사유를 적지 않고도 취소할 수 있고, 결제한 금액은 환불돼요(예시).",
    totals: { ...CART_TOTALS, note: "환불은 결제 수단에 따라 영업일 기준 3~5일 안에 처리돼요(예시)." },
  },
  order: async () => ({ ok: true, data: { ...sampleOrder("paid"), address: { ...sampleOrder("paid").address, note: "문 앞에 놓아 주세요" } } }),
}

export const fixtureMin: AccountOrderDetailProps = { ...fixture, copy: { ...COPY, lead: undefined, tracking: { label: COPY.tracking.label }, cancel: { ...COPY.cancel, reasonMarker: undefined, reasonHint: undefined } } }

export const fixturePorts = (q: URLSearchParams, g: { fx: string; onTrack: (e: TrackedEvent) => void }): Partial<AccountOrderDetailProps> => {
  const commerce = mockCommerce(withCartDefaults(q, { order: "paid" }), { requireConfirmation: true })
  return { orderId: "mock-order-1", order: commerce.order, cancelOrder: commerce.cancelOrder, track: mockAnalytics(q, { onTrack: g.onTrack }).track }
}
