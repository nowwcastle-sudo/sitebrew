import type { FilterBarChipsProps } from "./chips"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 로스터리 「산책로스터스(예시)」의 상품 분류 칩.
const COPY = { label: "분류", allLabel: "전체", count: "상품 {shown}개", resetLabel: "분류 거르기 풀기" }

export const fixture: FilterBarChipsProps = {
  copy: COPY,
  options: [
    { value: "원두", label: "원두", count: 8 },
    { value: "드립백", label: "드립백", count: 4 },
    { value: "선물세트", label: "선물세트", count: 3 },
  ],
  param: "category",
  resultCount: { shown: 15, total: 15 },
}

// 최대: 분류 열 개(긴 이름) · 여럿 고르기 · 이미 둘을 골라 둔 상태.
export const fixtureMax: FilterBarChipsProps = {
  copy: { ...COPY, label: "어떤 상품을 찾으세요? 분류를 골라 보세요(예시)" },
  options: [
    { value: "싱글오리진-원두", label: "싱글 오리진 원두", count: 12 },
    { value: "블렌드-원두", label: "블렌드 원두", count: 9 },
    { value: "디카페인", label: "디카페인 원두와 드립백", count: 5 },
    { value: "드립백", label: "드립백 10입 묶음", count: 7 },
    { value: "콜드브루", label: "콜드브루 원액", count: 3 },
    { value: "선물세트", label: "명절·기념일 선물세트", count: 6 },
    { value: "정기구독", label: "정기 배송 구독", count: 2 },
    { value: "커피용품", label: "핸드드립 커피용품", count: 11 },
    { value: "굿즈", label: "머그·텀블러·에코백 굿즈", count: 4 },
    { value: "체험팩", label: "처음 마셔 보는 체험팩", count: 2 },
  ],
  mode: "multi",
  param: "category",
  resultCount: { shown: 21, total: 61 },
  initial: { category: "싱글오리진-원두,디카페인" },
}

// 최소: 칩 하나, 결과 수 없음.
export const fixtureMin: FilterBarChipsProps = {
  copy: { label: "분류", allLabel: "전체" },
  options: [{ value: "원두", label: "원두" }],
}