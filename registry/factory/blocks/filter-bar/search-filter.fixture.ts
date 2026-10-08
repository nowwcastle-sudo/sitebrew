import type { FilterBarSearchFilterProps } from "./search-filter"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 물류 창고 「새벽창고(예시)」 출고 목록의 검색 줄.
const COPY = {
  label: "출고 목록 검색",
  search: { label: "출고 검색", placeholder: "주문번호나 받는 분 이름" },
  count: "출고 {shown}건",
  resetLabel: "필터 초기화",
}

export const fixture: FilterBarSearchFilterProps = {
  copy: COPY,
  facets: [
    {
      id: "status",
      label: "상태",
      param: "status",
      allLabel: "전체 상태",
      options: [
        { value: "ready", label: "출고 준비" },
        { value: "shipping", label: "배송 중" },
        { value: "done", label: "배송 완료" },
        { value: "hold", label: "보류" },
      ],
    },
  ],
  resultCount: { shown: 48, total: 48 },
}

// 최대: 거르기 select 셋(긴 이름) · 긴 안내 · 이미 검색어가 걸려 있다.
export const fixtureMax: FilterBarSearchFilterProps = {
  copy: { ...COPY, label: "출고 목록에서 주문번호·받는 분·상품명으로 찾기", search: { label: "주문번호, 받는 분, 상품명으로 검색", placeholder: "예: 20261010-0042 또는 김가나" } },
  facets: [
    { id: "status", label: "출고 상태", param: "status", allLabel: "모든 출고 상태", options: [{ value: "ready", label: "출고 준비" }, { value: "shipping", label: "배송 중" }, { value: "done", label: "배송 완료" }, { value: "hold", label: "보류 — 재고 확인이 필요해요" }] },
    { id: "carrier", label: "택배사", param: "carrier", allLabel: "모든 택배사", options: [{ value: "a", label: "가나택배(예시)" }, { value: "b", label: "다라택배(예시)" }, { value: "c", label: "마바택배(예시)" }] },
    { id: "site", label: "출고 창고", param: "site", allLabel: "모든 창고", options: [{ value: "a", label: "A동" }, { value: "b", label: "B동" }] },
  ],
  resultCount: { shown: 7, total: 1284 },
  initial: { q: "20261010", status: "hold" },
}

// 최소: 검색 칸만, 결과 수 모름.
export const fixtureMin: FilterBarSearchFilterProps = {
  copy: { label: "검색", search: { label: "검색" }, count: "{shown}건", resetLabel: "초기화" },
}