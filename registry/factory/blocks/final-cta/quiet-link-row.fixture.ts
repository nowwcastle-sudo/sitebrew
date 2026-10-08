import type { FinalCtaQuietLinkRowProps } from "./quiet-link-row"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 디자이너 포트폴리오, 문구마다 「예시」.
export const fixture: FinalCtaQuietLinkRowProps = {
  copy: {
    title: "다음 작업을 함께 하고 싶다면(예시)",
    linksLabel: "연락과 다음 읽을 것",
    links: [
      { label: "메일 보내기", href: "mailto:studio@example.com" },
      { label: "작업 목록", href: "#works" },
      { label: "이력", href: "#cv" },
    ],
  },
}

// 최대: 긴 제목, 링크 5개.
export const fixtureMax: FinalCtaQuietLinkRowProps = {
  copy: {
    title: "브랜드 정체성과 출판물 작업을 함께 할 곳을 찾고 있어요(예시)",
    linksLabel: "연락과 다음 읽을 것",
    links: [
      { label: "메일로 작업 문의하기", href: "mailto:studio@example.com" },
      { label: "전체 작업 목록 보기", href: "#works" },
      { label: "이력과 수상", href: "#cv" },
      { label: "강연·인터뷰", href: "#talks" },
      { label: "작업 노트 구독", href: "#notes" },
    ],
  },
}

// 최소: 링크 하나.
export const fixtureMin: FinalCtaQuietLinkRowProps = {
  copy: {
    title: "연락 주세요(예시)",
    linksLabel: "연락",
    links: [{ label: "메일 보내기", href: "mailto:studio@example.com" }],
  },
}
