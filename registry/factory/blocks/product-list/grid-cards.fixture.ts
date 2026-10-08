import type { FixtureStates } from "@/registry/factory/contract/adapter-mock"
import type { Product } from "@/registry/factory/content/schemas/commerce"

import type { ProductListGridCardsProps } from "./grid-cards"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 가게의 가상 상품, 문구마다 「예시」. 사진은 비워 둔다(빈 사진 자리 — 실사가 들어갈 칸).
const thumb = (alt: string) => ({ id: "product-thumb", aspect: "1:1", source: "real-required" as const, alt })

export const PRODUCTS: Product[] = [
  { slug: "salt-bread", name: "소금빵 6개입(예시)", price: 12900, listPrice: 15000, unitPrice: { amount: 2150, per: "1개" }, options: [], thumbs: [thumb("소금빵 여섯 개가 든 종이 상자")], origin: "국산 밀(예시)" },
  { slug: "fig-campagne", name: "무화과 깜파뉴(예시)", price: 8500, options: [], thumbs: [thumb("단면에 무화과가 보이는 깜파뉴")] },
  { slug: "butter-roll", name: "버터롤 10개입(예시)", price: 9900, listPrice: 11000, options: [], thumbs: [thumb("버터롤 열 개")] },
  { slug: "rye-loaf", name: "호밀빵 한 덩이(예시)", price: 7000, unitPrice: { amount: 1400, per: "100g" }, options: [], thumbs: [thumb("호밀빵 한 덩이")] },
  { slug: "scone-set", name: "스콘 선물 세트(예시)", price: 24000, listPrice: 30000, options: [{ name: "맛", values: [{ label: "플레인", soldOut: false }, { label: "얼그레이", soldOut: true }] }], thumbs: [thumb("스콘 네 개와 잼 병")] },
  { slug: "milk-bread", name: "우유 식빵(예시)", price: 5500, options: [], thumbs: [thumb("결이 보이는 우유 식빵")] },
  { slug: "choco-cookie", name: "초코 쿠키 12개입(예시)", price: 14000, options: [], thumbs: [thumb("초코 쿠키 열두 개")] },
  { slug: "granola", name: "수제 그래놀라 500g(예시)", price: 16800, unitPrice: { amount: 3360, per: "100g" }, options: [], thumbs: [thumb("유리병에 담긴 그래놀라")] },
]

const COPY = {
  title: "이번 주 빵",
  lead: "매일 아침 8시에 구워요(예시).",
  countTemplate: "{n}개 상품",
  hrefTemplate: "/products/{slug}",
  price: { discount: "{p}%", listPrice: "정가", unitPrice: "{per}당 {price}", vatNote: "부가세 포함" },
  loadingLabel: "상품을 불러오는 중이에요",
  empty: { title: "오늘은 모두 팔렸어요", body: "내일 아침 8시에 다시 구워요(예시).", action: { label: "예약 주문하기", href: "#preorder" } },
  error: { title: "상품을 불러오지 못했어요", retryLabel: "다시 시도" },
}

export const fixture: ProductListGridCardsProps = { copy: COPY, state: { status: "ready", data: PRODUCTS } }

// 최대: 문구 끝까지, 상품 24개(긴 이름·할인·단위 가격).
export const fixtureMax: ProductListGridCardsProps = {
  copy: { ...COPY, title: "이번 주 빵과 과자 — 매일 아침 굽는 것만(예시)", lead: "매일 아침 8시에 그날 팔 만큼만 구워요. 오후 3시 전에 주문하면 그날 출고하고, 3만 원 이상이면 배송비가 없어요. 품절된 상품은 예약 주문으로 받아요(예시)." },
  state: {
    status: "ready",
    data: Array.from({ length: 24 }, (_, i) => ({
      ...PRODUCTS[i % PRODUCTS.length],
      slug: `item-${i + 1}`,
      name: `국산 밀과 발효 버터로 매일 아침 굽는 소금빵 선물 상자 6개입 ${i + 1}(예시)`,
      price: 1239000,
      listPrice: 1500000,
      unitPrice: { amount: 206500, per: "1개" },
    })),
  },
}

// 갤러리 상태 주입 재료(&state=): data 는 기본 예시의 ready 목록, 빈·오류 문구는 이 가게 말투로.
export const fixtureStates: FixtureStates<ProductListGridCardsProps> = {
  reason: "이 분류에는 아직 상품이 없어요(예시).",
  message: "상품 목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요(예시).",
}

// 최소: 머리말 없이 상품 1개(정가·단위 가격 없음).
export const fixtureMin: ProductListGridCardsProps = {
  copy: { ...COPY, lead: undefined },
  state: { status: "ready", data: [{ slug: "milk-bread", name: "우유 식빵(예시)", price: 5500, options: [], thumbs: [thumb("우유 식빵")] }] },
}
