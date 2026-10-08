import { FACTS, POLICY_COPY } from "./policy-tables.fixture"
import type { ShippingReturnsReturnStepsProps } from "./return-steps"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 왼쪽 반품 순서 4단계, 오른쪽 조건표(배송·반품 행 전부).
const STEPS = [
  { title: "반품 신청", body: "받은 날부터 정해진 기한 안에 고객센터 문의로 알려 주세요(예시)." },
  { title: "상품 보내기", body: "받은 상품을 처음 온 포장 그대로 보내 주세요. 회수 택배를 불러 드릴 수도 있어요(예시)." },
  { title: "상태 확인", body: "도착한 상품 상태를 확인하고 그 결과를 문자로 알려 드려요(예시)." },
  { title: "환불", body: "상품이 도착한 날부터 {days}영업일 안에 결제한 수단으로 돌려 드려요(예시)." },
]
const BASE = { title: "반품은 이렇게 해요", lead: "반품 순서와 조건을 나란히 적었어요(예시).", stepsTitle: "반품 순서", tableCaption: "배송·반품 조건", columns: { label: "항목", value: "안내" }, steps: STEPS, policy: POLICY_COPY }

export const fixture: ShippingReturnsReturnStepsProps = { copy: BASE, facts: FACTS }

// 최대: 단계 문구 길게 · 긴 제목 · 불가 사유 네 개.
export const fixtureMax: ShippingReturnsReturnStepsProps = {
  copy: {
    ...BASE,
    title: "반품은 이렇게 해요 — 신청부터 환불까지 네 단계와 배송비·기한 조건을 한 화면에 적었어요(예시)",
    lead: "순서는 왼쪽, 기한과 비용은 오른쪽 표에 있어요. 반품 배송비를 누가 내는지는 순서 안이 아니라 표에서 바로 찾을 수 있어요(예시).",
    steps: STEPS.map((s, i) => (i === 1 ? { ...s, body: `${s.body} 제주·도서산간에서 보내실 때는 편의점 택배로 접수하시면 배송비가 더 들 수 있어요(예시).` } : s)),
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

// 최소: 단계 둘 · 무료 배송·무료 반품 · 환불 영업일은 「확인 필요」(환불 단계 글에도 같이 나온다).
export const fixtureMin: ShippingReturnsReturnStepsProps = {
  copy: { ...BASE, lead: undefined, steps: [STEPS[0], STEPS[3]] },
  facts: {
    shipping: { method: "택배(예시택배)", leadDays: 0, fee: 0, remoteExtra: null },
    returns: { feePayer: "seller", withdrawalDays: 7, exclusions: [] },
  },
}
