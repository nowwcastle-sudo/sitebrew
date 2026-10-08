import type { PolicyCopy, PolicyFacts } from "../_shared/policy-kit"
import type { ShippingReturnsPolicyTablesProps } from "./policy-tables"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 침구 가게 「솜결(예시)」의 배송·반품 안내. 다른 두 변형의 예시도 이 모듈의 POLICY_COPY·FACTS 를 쓴다.
// 법정 숫자(청약철회 7일·하자 3개월/30일·환불 3영업일)는 policy-kit LEGAL 이고, 배송비·출고일·반품비·불가 사유는 판매자가 정하는 값이다.
export const POLICY_COPY: PolicyCopy = {
  labels: { method: "배송 방법", lead: "출고", fee: "배송비", remote: "도서산간·제주", withdrawal: "단순 변심 반품 기한", returnFee: "반품 배송비", exclusions: "반품이 안 되는 경우", defect: "상품이 다르거나 하자가 있을 때", refund: "환불" },
  lead: "주문 후 {days}영업일 안에 보내요",
  leadSame: "주문한 날 바로 보내요",
  freeOver: "{threshold} 이상 주문하면 무료예요",
  free: "무료예요",
  remote: "{amount}이 더 들어요",
  remoteNone: "추가 비용이 없어요",
  withdrawal: "상품을 받은 날부터 {days}일 안에 신청할 수 있어요",
  returnFeeBuyer: "단순 변심이면 반품 배송비는 구매자가 내요",
  returnFeeBuyerAmount: "단순 변심이면 반품 배송비 {fee}을 구매자가 내요",
  returnFeeSeller: "반품 배송비는 판매자가 내요(무료 반품)",
  exclusionsNote: "전자상거래법 제17조 제2항에 따라 아래 경우에는 청약철회를 할 수 없어요",
  exclusionsNone: "따로 정한 불가 사유는 없어요",
  defect: "받은 날부터 {months}개월 안, 문제를 안 날부터 {days}일 안에 교환·반품할 수 있고 배송비는 판매자가 내요",
  refund: "반품 상품이 도착한 날부터 {days}영업일 안에 환불해요. 늦어지면 지연배상금을 드려요",
  vatNote: "표시한 금액은 모두 부가세(VAT)가 포함된 금액이에요",
}

export const FACTS: PolicyFacts = {
  shipping: { method: "택배(예시택배)", leadDays: 1, fee: 3000, freeThreshold: 50000, remoteExtra: 3000 },
  returns: {
    feePayer: "buyer",
    returnFee: 6000,
    withdrawalDays: 7,
    exclusions: ["포장을 열어 쓰거나 세탁해서 상품 가치가 크게 줄어든 경우(예시)", "시간이 지나 다시 팔기 어려울 만큼 상품 가치가 줄어든 경우(예시)"],
    refundDays: 3,
  },
}

const COLUMNS = { label: "항목", value: "안내" }
const BASE = { title: "배송·반품 안내", lead: "사기 전에 확인하는 배송비와 반품 조건이에요(예시).", shippingCaption: "배송", returnsCaption: "반품·교환·환불", columns: COLUMNS, policy: POLICY_COPY }

export const fixture: ShippingReturnsPolicyTablesProps = { copy: BASE, facts: FACTS }

// 최대: 문구 끝까지 · 긴 배송 방법 · 불가 사유 네 개.
export const fixtureMax: ShippingReturnsPolicyTablesProps = {
  copy: {
    ...BASE,
    title: "배송·반품 안내 — 사기 전에 배송비와 반품 조건을 모두 확인하세요(예시)",
    lead: "배송비가 얼마인지, 얼마 이상이면 무료인지, 반품할 때 누가 배송비를 내는지, 반품이 안 되는 경우는 무엇인지를 한곳에 적었어요. 이미지가 아니라 글자예요(예시).",
  },
  facts: {
    shipping: { ...FACTS.shipping, method: "택배(예시택배) — 오후 2시 전 주문은 오늘 출고하고, 제주·도서산간 지역은 하루 더 걸려요(예시)" },
    returns: {
      ...FACTS.returns,
      exclusions: [
        "포장을 열어 쓰거나 세탁해서 상품 가치가 크게 줄어든 경우(예시)",
        "시간이 지나 다시 팔기 어려울 만큼 상품 가치가 줄어든 경우(예시)",
        "주문을 받고 크기·자수를 따로 만든 상품은 만들기 시작한 뒤에는 철회할 수 없어요. 주문할 때 미리 알려 드려요(예시)",
        "구성품 일부가 없거나 훼손돼 다시 팔 수 없는 경우(예시)",
      ],
    },
  },
}

// 최소: 무료 배송·무료 반품·불가 사유 없음, 환불 영업일은 아직 정해지지 않아 「확인 필요」. 머리말 없음.
export const fixtureMin: ShippingReturnsPolicyTablesProps = {
  copy: { ...BASE, lead: undefined },
  facts: {
    shipping: { method: "택배(예시택배)", leadDays: 0, fee: 0, remoteExtra: null },
    returns: { feePayer: "seller", withdrawalDays: 7, exclusions: [] },
  },
}
