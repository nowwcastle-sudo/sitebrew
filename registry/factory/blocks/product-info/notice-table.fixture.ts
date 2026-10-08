import type { NoticeCopy, NoticeData, NoticeRow } from "../_shared/notice-kit"
import type { ProductInfoNoticeTableProps } from "./notice-table"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 침구 가게 「솜결(예시)」의 차렵이불 — 고시 품목 「침구류·커튼」의 항목 이름 그대로(항목 이름은 콘텐츠가 준다).
// 다른 두 변형의 예시도 이 모듈의 NOTICE·NOTICE_COPY 를 쓴다.
export const NOTICE_COPY: NoticeCopy = {
  caption: "상품정보제공고시 — {category}",
  columns: { label: "항목", value: "내용" },
  unavailable: "제공할 수 없어요 — {reason}",
}

export const ROWS: NoticeRow[] = [
  { id: "material", label: "제품 소재", value: "겉감 면 100%, 충전재 폴리에스터 100%(예시)" },
  { id: "color", label: "색상", value: "크림·그레이·세이지(예시)" },
  { id: "size", label: "치수", value: "퀸 210×230cm, 무게 약 2.1kg(예시)" },
  { id: "composition", label: "제품구성", value: "이불 1장, 보관 가방 1개(예시)" },
  { id: "maker", label: "제조자(수입자)", value: "솜결침구(예시)" },
  { id: "origin", label: "제조국", value: "대한민국(예시)" },
  { id: "care", label: "세탁방법 및 취급시 주의사항", value: "30℃ 이하 물에 손세탁하고 표백제는 쓰지 마세요(예시)" },
  { id: "warranty", label: "품질보증기준", value: "소비자분쟁해결기준(공정거래위원회 고시)에 따라 교환·환불해요(예시)" },
  { id: "as", label: "A/S 책임자와 전화번호", value: "솜결침구 고객지원", phone: "02-1234-5678" },
]
export const NOTICE: NoticeData = { category: "침구류·커튼", rows: ROWS }

export const fixture: ProductInfoNoticeTableProps = {
  copy: { title: "상품 정보", lead: "법이 정한 상품정보제공고시 항목이에요. 이미지가 아니라 글자로 적었어요(예시).", notice: NOTICE_COPY, asOf: "{date} 기준" },
  notice: NOTICE,
  asOf: "2026-09-28T00:00:00.000Z",
}

// 최대: 문구 끝까지 + 긴 값 + 제공할 수 없는 항목(사유) 하나.
export const fixtureMax: ProductInfoNoticeTableProps = {
  ...fixture,
  copy: {
    ...fixture.copy,
    title: "상품 정보 — 법이 정한 상품정보제공고시 항목을 모두 적었어요(예시)",
    lead: "고시 항목은 판매자가 바꿀 수 없는 항목 이름 그대로예요. 값이 아직 확인되지 않은 칸은 확인 필요로 보이고, 제공할 수 없는 항목은 그 이유를 적었어요(예시).",
  },
  notice: {
    category: "침구류·커튼",
    rows: [
      { ...ROWS[0], value: "겉감 면 100%(60수 트윌 직조), 안감 면 100%, 충전재 폴리에스터 100%(항균 가공 — 가공 정보 포함, 예시)" },
      ROWS[1],
      { ...ROWS[2], value: "퀸 210×230cm, 슈퍼싱글 150×210cm, 킹 240×230cm 세 가지 — 무게는 사이즈별로 1.6~2.6kg(예시)" },
      ROWS[3],
      ROWS[4],
      ROWS[5],
      { ...ROWS[6], value: "30℃ 이하 물에 손세탁하거나 세탁망에 넣어 울 코스로 돌리세요. 표백제·섬유유연제는 쓰지 마세요. 건조기는 저온 15분까지만 쓸 수 있어요(예시)" },
      { id: "made", label: "제조연월", unavailable: "주문을 받은 뒤 만들어 보내서 미리 알 수 없어요. 상품과 함께 오는 라벨에 적혀 있어요(예시)" },
      ROWS[7],
      ROWS[8],
    ],
  },
}

// 최소: 항목 셋, 마지막은 값이 아직 없어 「확인 필요」. 머리말·기준일 없음.
export const fixtureMin: ProductInfoNoticeTableProps = {
  copy: { title: "상품 정보", notice: NOTICE_COPY },
  notice: { category: "침구류·커튼", rows: [ROWS[4], ROWS[5], { id: "as", label: "A/S 책임자와 전화번호" }] },
}
