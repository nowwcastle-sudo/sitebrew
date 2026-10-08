import type { TrustAuthorBylineCopy, TrustAuthorBylineProps } from "./author-byline"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 건강 정보 글 「겨울철 어깨 통증, 이렇게 관리해요(예시)」의 서명 — 사람 이름·경력은 모두 지어낸 예시다.
const COPY: TrustAuthorBylineCopy = {
  title: "이 글을 만든 사람들",
  authorLabel: "작성",
  reviewerLabel: "검수",
  sourcesTitle: "참고한 자료",
}

export const fixture: TrustAuthorBylineProps = {
  copy: COPY,
  author: { name: "한나래(예시)", role: "건강 칼럼 편집자", bio: "건강 정보 글 8년 · 동네 의원 안내문 100여 편 집필", url: "https://example.com/authors/hannarae" },
  reviewer: { name: "오세진(예시)", role: "재활의학과 전문의", bio: "임상 12년 · 지역 보건소 자문 4년" },
  updatedAt: "2026-10-03",
  sources: [
    { label: "근골격계 통증 관리 가이드(예시)", href: "https://example.com/sources/guide" },
    { label: "겨울철 활동량 변화 조사 보고서(예시)", href: "https://example.com/sources/report" },
  ],
}

export const fixtureMax: TrustAuthorBylineProps = {
  ...fixture,
  author: { ...fixture.author, name: "한나래(예시)", role: "건강 칼럼 편집자 · 의료 정보 글 검수 위원회 간사", bio: "건강 정보 글 8년 · 동네 의원 안내문 100여 편 집필 · 쉬운 우리말 의학 용어 사전 공동 편집" },
  reviewer: { name: "오세진(예시)", role: "재활의학과 전문의 · 대한 가상 재활의학회 정회원", bio: "임상 12년 · 지역 보건소 자문 4년 · 어깨 질환 환자 교육 자료 40편 감수", url: "https://example.com/reviewers/ohsejin" },
  sources: [
    ...fixture.sources!,
    { label: "어깨 통증 환자 교육 자료 모음, 가상 재활의학회 누리집(예시)", href: "https://example.com/sources/education" },
  ],
}

export const fixtureMin: TrustAuthorBylineProps = {
  copy: COPY,
  author: { name: "한나래(예시)" },
  updatedAt: "2026-10-03",
}
