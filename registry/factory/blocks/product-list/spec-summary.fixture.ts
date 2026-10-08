import type { FixtureStates } from "@/registry/factory/contract/adapter-mock"

import { PRODUCTS } from "./grid-cards.fixture"
import type { ProductListSpecSummaryProps } from "./spec-summary"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 가게의 가상 상품, 문구마다 「예시」.
const thumb = (alt: string) => ({ id: "product-thumb", aspect: "1:1", source: "real-required" as const, alt })

const COPY = {
  title: "상품 요약",
  price: { discount: "{p}%", listPrice: "정가", unitPrice: "{per}당 {price}", vatNote: "부가세 포함" },
  soldOutLabel: "품절",
  shippingNote: "오후 3시 전 주문은 오늘 출고, 3만 원 이상 배송비 무료(예시)",
  buyCta: { label: "바로 구매", href: "#buy" },
  cartCta: { label: "장바구니 담기", href: "#cart" },
  specTitle: "상품 정보",
  originLabel: "원산지",
  unitPriceLabel: "단위 가격",
  specs: [
    { label: "중량", value: "1개 80g(예시)" },
    { label: "보관", value: "실온 이틀, 냉동 2주(예시)" },
  ],
  loadingLabel: "상품 정보를 불러오는 중이에요",
  empty: { title: "판매가 끝난 상품이에요", body: "비슷한 상품을 둘러보세요(예시).", action: { label: "전체 상품 보기", href: "/products" } },
  error: { title: "상품 정보를 불러오지 못했어요", retryLabel: "다시 시도" },
}

const MAIN = {
  ...PRODUCTS[0],
  options: [
    { name: "수량", values: [{ label: "6개입", soldOut: false }, { label: "12개입", soldOut: false }, { label: "24개입", soldOut: true }] },
    { name: "포장", values: [{ label: "기본 상자", soldOut: false }, { label: "선물 포장", soldOut: false }] },
  ],
  thumbs: [thumb("소금빵 여섯 개가 든 종이 상자"), thumb("소금빵 단면"), thumb("상자 포장 모습"), thumb("매장 진열대")],
}

export const fixture: ProductListSpecSummaryProps = { copy: COPY, state: { status: "ready", data: [MAIN] } }

// 최대: 긴 이름·옵션 값 많음·사양 줄 많음.
export const fixtureMax: ProductListSpecSummaryProps = {
  copy: {
    ...COPY,
    shippingNote: "오후 3시 전에 주문하면 오늘 출고하고, 3만 원 이상이면 배송비가 없어요. 제주·도서 지역은 3,000원이 더 붙고, 여름철에는 아이스팩을 함께 넣어요(예시)",
    specs: Array.from({ length: 8 }, (_, i) => ({ label: `보관 방법과 유통 기한 ${i + 1}`, value: "실온에서 이틀, 냉동하면 2주까지 두고 드실 수 있어요. 데울 때는 180도 오븐에서 3분이 알맞아요(예시)." })),
  },
  state: {
    status: "ready",
    data: [
      {
        ...MAIN,
        name: "국산 밀과 발효 버터로 매일 아침 굽는 소금빵 선물 상자 24개입 명절 한정 포장(예시)",
        price: 1239000,
        listPrice: 1500000,
        options: [
          { name: "수량", values: ["6개입", "12개입", "24개입", "36개입", "48개입", "60개입 단체 주문"].map((label, i) => ({ label, soldOut: i === 2 })) },
          { name: "포장", values: ["기본 상자", "선물 포장", "보자기 포장", "명절 한정 포장"].map((label) => ({ label, soldOut: false })) },
        ],
      },
    ],
  },
}

// 갤러리 상태 주입 재료(&state=).
export const fixtureStates: FixtureStates<ProductListSpecSummaryProps> = {
  reason: "판매를 마친 상품이에요(예시).",
  message: "상품 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요(예시).",
}

// 최소: 사진 1장·옵션 없음·배송 줄·장바구니·사양 없음.
export const fixtureMin: ProductListSpecSummaryProps = {
  copy: { ...COPY, shippingNote: undefined, cartCta: undefined, specs: undefined },
  state: { status: "ready", data: [{ slug: "milk-bread", name: "우유 식빵(예시)", price: 5500, options: [], thumbs: [thumb("우유 식빵")] }] },
}
