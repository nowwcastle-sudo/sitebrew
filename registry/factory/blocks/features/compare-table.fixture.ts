import type { FeaturesCompareTableProps } from "./compare-table"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 서비스, 문구마다 「예시」. 경쟁사 이름 대신 방식 이름으로 비교한다.
export const fixture: FeaturesCompareTableProps = {
  copy: {
    title: "엑셀로 할 때와 비교하면",
    lead: "같은 월말 정산을 두 방식으로 해 본 결과예요(예시).",
    caption: "월말 정산 한 번을 기준으로 이 서비스와 엑셀 수작업을 비교한 표(예시)",
    criteriaLabel: "기준",
    us: "이 서비스(예시)",
    them: ["엑셀 수작업"],
    rows: [
      { label: "정산에 걸리는 시간", us: "40분", them: ["3일"] },
      { label: "지점별 합계 자동 계산", us: true, them: [false] },
      { label: "세금계산서 발행", us: true, them: [false] },
      { label: "월 비용", us: "12,900원", them: ["0원"] },
      { label: "직원별 권한 나누기", us: true, them: [false] },
    ],
    yesLabel: "있음",
    noLabel: "없음",
    footnote: "비용은 부가세 포함 월 금액이에요(예시).",
  },
}

// 최대: 문구 끝까지, 비교 대상 3개 · 기준 10줄.
export const fixtureMax: FeaturesCompareTableProps = {
  copy: {
    title: "엑셀·장부·다른 방식으로 할 때와 비교하면(예시)",
    lead: "같은 월말 정산을 네 가지 방식으로 해 본 결과예요. 시간은 직원 두 명이 지점 세 곳을 정산한 기준이고, 비용은 부가세를 포함한 월 금액이에요(예시).",
    caption: "월말 정산 한 번을 기준으로 이 서비스와 엑셀 수작업, 종이 장부, 설치형 프로그램을 비교한 표(예시)",
    criteriaLabel: "비교 기준",
    us: "이 서비스(예시)",
    them: ["엑셀 수작업", "종이 장부와 계산기", "설치형 회계 프로그램"],
    rows: Array.from({ length: 10 }, (_, i) => ({
      label: i % 2 ? "지점별 합계와 세금계산서를 자동으로 만들기" : "정산에 걸리는 시간",
      us: i % 2 ? true : "40분",
      them: i % 2 ? [false, false, true] : ["3일", "5일", "1일"],
    })),
    yesLabel: "있음",
    noLabel: "없음",
    footnote: "비용은 부가세 포함 월 금액이에요. 지점이 늘어도 요금이 오르지 않아요(예시).",
  },
}

// 최소: 머리말 없이 기준 1줄.
export const fixtureMin: FeaturesCompareTableProps = {
  copy: { title: "엑셀과 비교", caption: "정산 시간 비교(예시)", criteriaLabel: "기준", us: "이 서비스(예시)", them: ["엑셀"], rows: [{ label: "정산 시간", us: "40분", them: ["3일"] }], yesLabel: "있음", noLabel: "없음" },
}
