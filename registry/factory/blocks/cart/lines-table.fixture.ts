import { mockAnalytics, type TrackedEvent } from "@/registry/factory/contract/adapter-mock"
import { MOCK_CATALOG, mockCommerce, mockTotalsOf } from "@/registry/factory/contract/adapter-mock-commerce"
import type { Cart, CartLine } from "@/registry/factory/contract/commerce"

import type { CartEmptyCopy, CartLineCopy, CartTotalsCopy } from "../_shared/cart-kit"
import { SUBMIT_NOTICES } from "../auth/sign-in.fixture"
import type { CartLinesTableCopy, CartLinesTableProps } from "./lines-table"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 상점 「모아상점(예시)」의 장바구니 줄 표. 상품은 목 상품표의 가상 상품이고 금액은 원화·부가세 포함(최소 단위 정수 = 원)이다.
// 갤러리 포트: ?cart=filled(기본)|empty · ?stock=out(첫 상품 품절 — [+]를 누르면 줄 아래에 재고 문구) · &state=(cart 읽기) · &submit=(setCartLine 결과).
// 이 모듈의 문구 조각(CART_LINE·CART_TOTALS·CART_EMPTY)과 예시 장바구니(SAMPLE_CART)는 cart 블록 넷이 같이 쓴다.
const line = (id: string, quantity: number): CartLine => {
  const item = MOCK_CATALOG.find((i) => i.id === id)!
  return { productId: id, name: item.name, unitPrice: item.price, quantity, ...(item.stock === null ? {} : { available: item.stock }) }
}
const LINES: CartLine[] = [line("sku-mug", 2), line("sku-beans", 1)]
/** 주문에 남기는 줄(남은 수량 `available` 은 지금 장바구니의 안내라 주문에는 없다) */
export const orderLineOf = (l: CartLine): CartLine => {
  const copy = { ...l }
  delete copy.available
  return copy
}
export const SAMPLE_CART: Cart = { lines: LINES, ...mockTotalsOf(LINES) }

export const CART_LINE: CartLineCopy = {
  product: "상품",
  unitPrice: "단가",
  quantity: "수량",
  lineTotal: "금액",
  remove: "빼기",
  removeOf: "{name} 장바구니에서 빼기",
  decrease: "{name} 수량 줄이기",
  increase: "{name} 수량 늘리기",
  quantityOf: "{name} 수량",
}
export const CART_TOTALS: CartTotalsCopy = {
  total: "결제할 금액",
  subtotal: "상품 금액",
  shipping: "배송비",
  shippingFree: "무료",
  vatIncluded: "VAT 포함",
  vatExcluded: "부가세 별도",
  note: "상품 금액이 5만 원 이상이면 배송비가 없어요(예시).",
}
export const CART_EMPTY: CartEmptyCopy = { title: "장바구니가 비어 있어요", body: "마음에 드는 상품을 담으면 여기에 모여요(예시).", label: "상품 둘러보기", href: "#products" }
export const CART_ALERT = { field: "확인이 필요해요", server: "처리하지 못했어요 — 잠시 뒤 다시 눌러 주세요" }

const COPY: CartLinesTableCopy = {
  title: "장바구니",
  lead: "담은 상품과 수량을 확인하고 바꿀 수 있어요(예시).",
  caption: "장바구니에 담은 상품, 단가, 수량, 금액",
  line: CART_LINE,
  totals: CART_TOTALS,
  checkout: { label: "주문하기", href: "#checkout" },
  continue: { label: "쇼핑 계속하기", href: "#products" },
  empty: CART_EMPTY,
  alert: CART_ALERT,
  notices: SUBMIT_NOTICES,
  loading: "장바구니를 불러오는 중이에요",
  error: "장바구니를 불러오지 못했어요",
  retry: "다시 불러오기",
}

export const fixture: CartLinesTableProps = {
  copy: COPY,
  cart: async () => ({ ok: true, data: SAMPLE_CART }),
  setCartLine: async () => ({ ok: true, data: SAMPLE_CART }),
}

export const fixtureMax: CartLinesTableProps = {
  ...fixture,
  copy: {
    ...COPY,
    title: "장바구니 — 담은 상품을 확인하고 수량을 바꿔요(예시)",
    lead: "담은 상품은 30일 동안 그대로 있어요. 수량을 바꾸면 합계와 배송비가 바로 다시 계산돼요. 재고가 모자라면 그 줄 아래에 남은 수량을 알려 드려요(예시).",
  },
}

export const fixtureMin: CartLinesTableProps = { ...fixture, copy: { ...COPY, lead: undefined, continue: undefined, totals: { ...CART_TOTALS, note: undefined } } }

/** 갤러리가 바꿔 끼우는 포트: ?cart= 가 없으면 담은 장바구니로 연다(빈 장바구니는 ?cart=empty) */
export const withCartDefaults = (q: URLSearchParams, defaults: Record<string, string>): URLSearchParams => {
  const next = new URLSearchParams(q)
  for (const [k, v] of Object.entries(defaults)) if (!next.has(k)) next.set(k, v)
  return next
}
export const fixturePorts = (q: URLSearchParams, g: { fx: string; onTrack: (e: TrackedEvent) => void }): Partial<CartLinesTableProps> => {
  const query = withCartDefaults(q, { cart: "filled" })
  const commerce = mockCommerce(query, { requireConfirmation: true })
  return { cart: commerce.cart, setCartLine: commerce.setCartLine, track: mockAnalytics(q, { onTrack: g.onTrack }).track }
}
