import type { TrackedEvent } from "@/registry/factory/contract/adapter-mock"
import { mockCommerce } from "@/registry/factory/contract/adapter-mock-commerce"

import type { CartTotalsSummaryCopy, CartTotalsSummaryProps } from "./totals-summary"
import { CART_EMPTY, CART_TOTALS, SAMPLE_CART, withCartDefaults } from "./lines-table.fixture"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 상점 「모아상점(예시)」의 주문 요약(읽기 전용). 예시 장바구니·문구 조각은 줄 표(lines-table)와 같다.
// 갤러리 포트: ?cart=filled(기본)|empty · ?stock=out · &state=(cart 읽기).
const COPY: CartTotalsSummaryCopy = {
  title: "주문 요약",
  lead: "결제 전에 담은 상품과 금액을 한 번 더 확인해요(예시).",
  listLabel: "주문할 상품",
  quantity: "{quantity}개",
  totals: CART_TOTALS,
  edit: { label: "장바구니 고치기", href: "#cart" },
  empty: CART_EMPTY,
  loading: "주문 요약을 불러오는 중이에요",
  error: "주문 요약을 불러오지 못했어요",
  retry: "다시 불러오기",
}

export const fixture: CartTotalsSummaryProps = { copy: COPY, cart: async () => ({ ok: true, data: SAMPLE_CART }) }

export const fixtureMax: CartTotalsSummaryProps = {
  ...fixture,
  copy: { ...COPY, title: "주문 요약 — 담은 상품과 결제할 금액(예시)", lead: "결제 전에 담은 상품과 금액을 한 번 더 확인해요. 배송비는 상품 금액에 따라 정해지고, 합계에는 부가세가 이미 들어 있어요(예시)." },
}

export const fixtureMin: CartTotalsSummaryProps = { ...fixture, copy: { ...COPY, lead: undefined, edit: undefined, totals: { ...CART_TOTALS, note: undefined } } }

export const fixturePorts = (q: URLSearchParams, g: { fx: string; onTrack: (e: TrackedEvent) => void }): Partial<CartTotalsSummaryProps> => {
  void g
  return { cart: mockCommerce(withCartDefaults(q, { cart: "filled" })).cart }
}
