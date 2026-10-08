import type { ContentBreadcrumbProps } from "./breadcrumb"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 구립 시설 「해밀문화관(예시)」의 서브 쪽 경로.
export const fixture: ContentBreadcrumbProps = {
  copy: { label: "현재 위치" },
  trail: [{ label: "홈", href: "/" }, { label: "이용 안내(예시)" }],
}

export const fixtureMax: ContentBreadcrumbProps = {
  copy: { label: "현재 위치" },
  trail: [{ label: "홈", href: "/" }, { label: "시설 안내(예시)", href: "/guide" }, { label: "강좌와 대관 신청 방법 자세히 보기(예시)" }],
}

export const fixtureMin: ContentBreadcrumbProps = {
  copy: { label: "현재 위치" },
  trail: [{ label: "홈" }],
}
