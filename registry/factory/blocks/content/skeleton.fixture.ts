import type { ContentSkeletonProps } from "./skeleton"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 앱 첫 화면 로딩 자리.
export const fixture: ContentSkeletonProps = { copy: { label: "불러오는 중" } }
export const fixtureMax: ContentSkeletonProps = { copy: { label: "불러오는 중" }, lines: 8 }
export const fixtureMin: ContentSkeletonProps = { copy: { label: "불러오는 중" }, lines: 1 }
