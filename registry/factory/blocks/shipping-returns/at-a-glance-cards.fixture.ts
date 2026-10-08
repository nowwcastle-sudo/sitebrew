import { FACTS, POLICY_COPY } from "./policy-tables.fixture"
import type { ShippingReturnsAtAGlanceCardsProps } from "./at-a-glance-cards"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 위 큰 칸 셋(배송비·출고·청약철회 기간)과 아래 나머지 항목 dl.
const BASE = { title: "배송·반품 안내", lead: "가장 먼저 궁금한 세 가지를 위에 크게 적었어요(예시).", detailTitle: "자세한 조건", policy: POLICY_COPY }

export const fixture: ShippingReturnsAtAGlanceCardsProps = { copy: BASE, facts: FACTS }

// 최대: 긴 문구 · 긴 배송 방법 · 불가 사유 네 개.
export const fixtureMax: ShippingReturnsAtAGlanceCardsProps = {
  copy: {
    ...BASE,
    title: "배송·반품 안내 — 배송비와 출고일과 반품 기한을 먼저 크게 보여 드려요(예시)",
    lead: "아래 자세한 조건에는 반품 배송비를 누가 내는지, 반품이 안 되는 경우, 환불 시점이 있어요. 위 세 값과 아래 값은 같은 숫자예요(예시).",
  },
  facts: {
    shipping: { ...FACTS.shipping, method: "택배(예시택배) — 오후 2시 전 주문은 오늘 출고하고, 제주·도서산간 지역은 하루 더 걸려요(예시)" },
    returns: {
      ...FACTS.returns,
      exclusions: [
        "포장을 열어 쓰거나 세탁해서 상품 가치가 크게 줄어든 경우(예시)",
        "시간이 지나 다시 팔기 어려울 만큼 상품 가치가 줄어든 경우(예시)",
        "주문을 받고 크기·자수를 따로 만든 상품은 만들기 시작한 뒤에는 철회할 수 없어요(예시)",
        "구성품 일부가 없거나 훼손돼 다시 팔 수 없는 경우(예시)",
      ],
    },
  },
}

// 최소: 무료 배송·당일 출고·무료 반품, 청약철회 기간 7일, 불가 사유 없음, 환불 영업일은 「확인 필요」.
export const fixtureMin: ShippingReturnsAtAGlanceCardsProps = {
  copy: { title: "배송·반품 안내", detailTitle: "자세한 조건", policy: POLICY_COPY },
  facts: {
    shipping: { method: "택배(예시택배)", leadDays: 0, fee: 0, remoteExtra: null },
    returns: { feePayer: "seller", withdrawalDays: 7, exclusions: [] },
  },
}
