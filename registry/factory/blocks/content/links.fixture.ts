import type { ContentLinksProps } from "./links"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 구립 시설 「해밀문화관(예시)」의 바로가기.
const UNITS = { photoNeeded: "실제 사진 필요", imagePending: "이미지 준비 중", external: "다른 사이트" }

export const fixture: ContentLinksProps = {
  copy: { title: "자주 찾는 서비스", units: UNITS },
  links: [
    { label: "강좌 신청하기(예시)", href: "/guide" },
    { label: "대관 안내 보기(예시)", href: "/guide" },
    { label: "오시는 길(예시)", href: "/guide" },
    { label: "구청 누리집(예시)", href: "https://gov.invalid/" },
  ],
}

export const fixtureMax: ContentLinksProps = {
  copy: { title: "도움말과 약관", lead: "궁금한 점과 정책을 한곳에 모았어요(예시).", units: UNITS },
  links: [
    { label: "자주 묻는 질문(예시)", href: "/help" },
    { label: "개인정보 처리방침", href: "/privacy" },
    { label: "이용약관", href: "/terms" },
    { label: "고객센터 전화(예시)", href: "/help" },
    { label: "운영 소식(예시)", href: "/news" },
  ],
}

export const fixtureMin: ContentLinksProps = {
  copy: { title: "하위 메뉴", units: UNITS },
  mode: "menu",
  links: [
    { label: "홈", href: "/" },
    { label: "이용 안내(예시)", href: "/guide", current: true },
  ],
}
