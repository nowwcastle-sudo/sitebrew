import { mockAnalytics, type TrackedEvent } from "@/registry/factory/contract/adapter-mock"
import { mockCommerce } from "@/registry/factory/contract/adapter-mock-commerce"

import { SUBMIT_NOTICES } from "../auth/sign-in.fixture"
import type { CartLinesCardsCopy, CartLinesCardsProps } from "./lines-cards"
import { CART_ALERT, CART_EMPTY, CART_LINE, CART_TOTALS, SAMPLE_CART, withCartDefaults } from "./lines-table.fixture"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 상점 「모아상점(예시)」의 장바구니 줄 카드. 줄 표(lines-table)와 같은 예시 장바구니·문구 조각을 쓴다.
// 갤러리 포트: ?cart=filled(기본)|empty · ?stock=out · &state=(cart 읽기) · &submit=(setCartLine 결과).
const COPY: CartLinesCardsCopy = {
  title: "장바구니",
  lead: "담은 상품을 확인하고 수량을 바꿔요(예시).",
  listLabel: "장바구니에 담은 상품",
  line: CART_LINE,
  totals: CART_TOTALS,
  summaryTitle: "주문 요약",
  checkout: { label: "주문하기", href: "#checkout" },
  continue: { label: "쇼핑 계속하기", href: "#products" },
  empty: CART_EMPTY,
  alert: CART_ALERT,
  notices: SUBMIT_NOTICES,
  loading: "장바구니를 불러오는 중이에요",
  error: "장바구니를 불러오지 못했어요",
  retry: "다시 불러오기",
}

export const fixture: CartLinesCardsProps = {
  copy: COPY,
  cart: async () => ({ ok: true, data: SAMPLE_CART }),
  setCartLine: async () => ({ ok: true, data: SAMPLE_CART }),
}

export const fixtureMax: CartLinesCardsProps = {
  ...fixture,
  copy: {
    ...COPY,
    title: "장바구니 — 담은 상품과 주문 요약(예시)",
    lead: "수량을 바꾸면 합계와 배송비가 바로 다시 계산돼요. 담은 상품은 30일 동안 그대로 있고, 재고가 모자라면 그 상품 아래에 남은 수량을 알려 드려요(예시).",
  },
}

export const fixtureMin: CartLinesCardsProps = { ...fixture, copy: { ...COPY, lead: undefined, continue: undefined, totals: { ...CART_TOTALS, note: undefined } } }

export const fixturePorts = (q: URLSearchParams, g: { fx: string; onTrack: (e: TrackedEvent) => void }): Partial<CartLinesCardsProps> => {
  const commerce = mockCommerce(withCartDefaults(q, { cart: "filled" }), { requireConfirmation: true })
  return { cart: commerce.cart, setCartLine: commerce.setCartLine, track: mockAnalytics(q, { onTrack: g.onTrack }).track }
}
