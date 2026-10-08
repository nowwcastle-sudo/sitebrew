import type { FilterBarToolbarProps } from "./toolbar"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 로스터리 「산책로스터스(예시)」 상품 목록의 정렬 줄.
const COPY = { label: "상품 목록 도구", count: "상품 {shown}개", resetLabel: "정렬 초기화" }

export const fixture: FilterBarToolbarProps = {
  copy: COPY,
  controls: [
    {
      id: "sort",
      label: "정렬",
      param: "sort",
      options: [
        { value: "recommended", label: "추천순" },
        { value: "newest", label: "신상품순" },
        { value: "price-asc", label: "낮은 가격순" },
        { value: "price-desc", label: "높은 가격순" },
      ],
    },
  ],
  resultCount: { shown: 15, total: 15 },
}

// 최대: 가상 물류 창고 운영판 — 기간·비교 기준·단위 select 셋 + 비교 체크 + 기준 시각 줄, 긴 이름.
export const fixtureMax: FilterBarToolbarProps = {
  copy: {
    label: "기간과 비교 기준 고르기",
    count: "선택한 기간의 출고 {shown}건 / 전체 {total}건",
    compare: { label: "지난 기간과 나란히 비교하기" },
    asOf: { label: "기준 시각", value: "2026-10-10 14:05", iso: "2026-10-10T14:05:00+09:00" },
    resetLabel: "기간·비교 초기화",
  },
  controls: [
    {
      id: "period",
      label: "조회 기간",
      param: "period",
      defaultValue: "7d",
      options: [
        { value: "today", label: "오늘" },
        { value: "7d", label: "최근 7일" },
        { value: "30d", label: "최근 30일" },
        { value: "90d", label: "최근 90일(분기)" },
        { value: "custom", label: "직접 고른 기간 — 시작일과 끝일을 따로 정해요" },
      ],
    },
    {
      id: "unit",
      label: "묶어 보기",
      param: "unit",
      options: [
        { value: "day", label: "하루 단위" },
        { value: "week", label: "주 단위" },
        { value: "month", label: "월 단위" },
      ],
    },
    {
      id: "site",
      label: "창고",
      param: "site",
      options: [
        { value: "all", label: "전체 창고" },
        { value: "a", label: "A동(예시)" },
        { value: "b", label: "B동(예시)" },
      ],
    },
  ],
  resultCount: { shown: 1284, total: 5230 },
  initial: { period: "30d", compare: "1" },
}

// 최소: select 하나, 결과 수 없음(서버가 아직 안 줬다).
export const fixtureMin: FilterBarToolbarProps = {
  copy: { label: "도구", count: "{shown}건" },
  controls: [{ id: "sort", label: "정렬", param: "sort", options: [{ value: "new", label: "최신순" }] }],
}