import type { FixtureStates } from "@/registry/factory/contract/adapter-mock"

import { PRODUCTS } from "./grid-cards.fixture"
import type { ProductListRankedListProps } from "./ranked-list"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 가게의 가상 상품, 문구마다 「예시」.
const COPY = {
  title: "많이 팔린 빵",
  lead: "지난 7일 동안 가장 많이 나간 순서예요(예시).",
  rankTemplate: "{n}위",
  basis: "2026년 9월 22일~28일 판매량 기준(예시)",
  hrefTemplate: "/products/{slug}",
  price: { discount: "{p}%", listPrice: "정가", unitPrice: "{per}당 {price}", vatNote: "부가세 포함" },
  loadingLabel: "순위를 불러오는 중이에요",
  empty: { title: "아직 순위가 없어요", body: "판매가 쌓이면 순위를 보여 드려요(예시).", action: { label: "전체 상품 보기", href: "/products" } },
  error: { title: "순위를 불러오지 못했어요", retryLabel: "다시 시도" },
}

export const fixture: ProductListRankedListProps = { copy: COPY, state: { status: "ready", data: PRODUCTS.slice(0, 5) } }

// 최대: 문구 끝까지, 10위까지(긴 이름).
export const fixtureMax: ProductListRankedListProps = {
  copy: { ...COPY, title: "많이 팔린 빵과 과자 — 지난 7일 판매량 순위(예시)", basis: "2026년 9월 22일부터 28일까지 온라인 주문과 매장 예약 주문을 합친 판매 수량 기준, 취소된 주문은 뺐어요(예시)" },
  state: {
    status: "ready",
    data: Array.from({ length: 10 }, (_, i) => ({ ...PRODUCTS[i % PRODUCTS.length], slug: `rank-${i + 1}`, name: `국산 밀과 발효 버터로 매일 아침 굽는 소금빵 선물 상자 6개입 ${i + 1}(예시)`, price: 1239000, listPrice: 1500000 })),
  },
}

// 갤러리 상태 주입 재료(&state=).
export const fixtureStates: FixtureStates<ProductListRankedListProps> = {
  reason: "이번 주 판매가 아직 집계되지 않았어요(예시).",
  message: "순위를 불러오지 못했어요. 잠시 후 다시 시도해 주세요(예시).",
}

// 최소: 머리말·기준 줄 없이 1위 하나.
export const fixtureMin: ProductListRankedListProps = {
  copy: { ...COPY, lead: undefined, basis: undefined },
  state: { status: "ready", data: [PRODUCTS[5]] },
}
