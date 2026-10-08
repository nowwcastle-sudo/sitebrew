import { NOTICE, NOTICE_COPY, ROWS } from "./notice-table.fixture"
import type { ProductInfoKeyFactsFirstProps } from "./key-facts-first"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 원형 핵심 과업의 답 — 제조국 · A/S 연락처 · 품질보증기준 — 을 표 위에 큰 글씨로 먼저 둔다.
const COPY = { title: "상품 정보", lead: "제조국과 A/S 연락처는 먼저, 고시 항목 전체는 아래 표에 있어요(예시).", factsTitle: "먼저 확인할 것", tableTitle: "상품정보제공고시 전체", notice: NOTICE_COPY }

export const fixture: ProductInfoKeyFactsFirstProps = { copy: COPY, notice: NOTICE, highlight: ["origin", "as", "warranty"] }

// 최대: 강조 네 칸(넘치는 다섯째는 무시) · 긴 값 · 긴 제목.
export const fixtureMax: ProductInfoKeyFactsFirstProps = {
  copy: {
    ...COPY,
    title: "상품 정보 — 제조국·A/S 연락처·품질보증기준을 표보다 먼저 크게 보여 드려요(예시)",
    lead: "고시 항목 전체는 아래 표에 그대로 있어요. 값이 아직 확인되지 않은 칸은 확인 필요로 보여요(예시).",
  },
  notice: {
    ...NOTICE,
    rows: NOTICE.rows.map((r) => (r.id === "warranty" ? { ...r, value: "구입 후 1년 — 소비자분쟁해결기준(공정거래위원회 고시)에 따라 교환·환불해요. 사용감이 있는 상품은 보증 대상이 아니에요(예시)" } : r)),
  },
  highlight: ["origin", "as", "warranty", "maker", "care"],
}

// 최소: 강조 둘 중 하나는 값이 없어 「확인 필요」 — 핵심 사실이 비었다는 것이 먼저 보인다.
export const fixtureMin: ProductInfoKeyFactsFirstProps = {
  copy: { title: "상품 정보", factsTitle: "먼저 확인할 것", tableTitle: "상품정보제공고시 전체", notice: NOTICE_COPY },
  notice: { category: "침구류·커튼", rows: [ROWS[5], { id: "as", label: "A/S 책임자와 전화번호" }] },
  highlight: ["origin", "as"],
}
