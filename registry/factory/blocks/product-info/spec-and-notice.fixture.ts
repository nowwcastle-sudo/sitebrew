import { NOTICE, NOTICE_COPY, ROWS } from "./notice-table.fixture"
import type { ProductInfoSpecAndNoticeProps } from "./spec-and-notice"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 고시 표는 notice-table 예시와 같은 침구 상품이고, 왼쪽 사양은 사는 사람이 고르는 값.
const SPECS = [
  { id: "size", label: "사이즈", value: "퀸 210×230cm" },
  { id: "weight", label: "무게", value: "약 2.1kg" },
  { id: "fill", label: "충전재", value: "폴리에스터 솜 400g/㎡" },
  { id: "season", label: "쓰는 철", value: "봄·가을(예시)" },
  { id: "wash", label: "세탁", value: "30℃ 손세탁·세탁망 울 코스" },
]
const COPY = { title: "상품 정보", lead: "왼쪽은 고르는 데 쓰는 사양, 오른쪽은 법이 정한 고시 항목이에요(예시).", specTitle: "사양", noticeTitle: "상품정보제공고시", notice: NOTICE_COPY }

export const fixture: ProductInfoSpecAndNoticeProps = { copy: COPY, notice: NOTICE, specs: SPECS }

// 최대: 사양 열 개 · 긴 값 · 긴 제목.
export const fixtureMax: ProductInfoSpecAndNoticeProps = {
  copy: {
    ...COPY,
    title: "상품 정보 — 고르는 데 필요한 사양과 법이 정한 고시 항목을 한 화면에 나란히 적었어요(예시)",
    lead: "왼쪽은 크기·무게·소재처럼 사는 사람이 견주는 값이고, 오른쪽은 판매자가 바꿀 수 없는 상품정보제공고시 항목이에요. 둘이 다르면 고시 항목이 먼저예요(예시).",
  },
  notice: { ...NOTICE, rows: NOTICE.rows.map((r) => (r.id === "material" ? { ...r, value: "겉감 면 100%(60수 트윌 직조), 충전재 폴리에스터 100%, 가공 정보: 항균 가공(예시)" } : r)) },
  specs: [
    ...SPECS,
    { id: "color", label: "색상", value: "크림·그레이·세이지·코랄 네 가지" },
    { id: "thread", label: "직조", value: "60수 트윌, 올 사이즈 동일 원단으로 통일(예시)" },
    { id: "cert", label: "안전 인증", value: "섬유제품 안전 확인 완료 — 인증번호는 고시 표에 적어요(예시)" },
    { id: "pack", label: "포장", value: "보관 가방 포함, 재활용 종이 상자(예시)" },
    { id: "set", label: "함께 쓰면 좋은 것", value: "같은 원단 베개 커버 2장 별도 판매(예시)" },
  ],
}

// 최소: 사양 둘(하나는 값 없음 → 확인 필요) + 고시 항목 셋.
export const fixtureMin: ProductInfoSpecAndNoticeProps = {
  copy: { title: "상품 정보", specTitle: "사양", noticeTitle: "상품정보제공고시", notice: NOTICE_COPY },
  notice: { category: "침구류·커튼", rows: [ROWS[4], ROWS[5], ROWS[8]] },
  specs: [SPECS[0], { id: "weight", label: "무게" }],
}
