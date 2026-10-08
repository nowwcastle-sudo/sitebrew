import type { HeroMascotGreetingProps } from "./mascot-greeting"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 문구점의 캐릭터. 캐릭터 그림(media — 생성 허용 칸)은 예시에 싣지 않는다 — 없으면 muted 무대.
// 상표·저작권 확인 문구(rightsNote)는 사실이라 예시가 「예시」 표지를 단 채 둔다 — 찍어낸 사이트는 이 문구를 콘텐츠에서 받고, 없으면 이 블록을 쓰지 않는다.
export const fixture: HeroMascotGreetingProps = {
  copy: {
    label: "첫 화면",
    title: "안녕! 오늘은 어떤 펜을 찾아?",
    lede: "동네 문구점 마스코트 몽이가 필요한 필기구를 같이 골라 줘요. 모든 문구는 예시예요.",
    primaryCta: { label: "추천 받기", href: "#pick" },
    secondaryCta: { label: "매장 안내", href: "#store" },
    rightsLabel: "그림 권리",
    rightsNote: "마스코트 몽이(예시)는 가게가 직접 의뢰해 저작권을 가진 그림이에요. 상표 등록 여부는 확인 전(예시)이에요.",
    pauseLabel: "캐릭터 움직임 멈추기",
  },
}

// 최대: 긴 말풍선, 긴 문단, 긴 권리 문구.
export const fixtureMax: HeroMascotGreetingProps = {
  copy: {
    label: "첫 화면",
    title: "안녕! 오늘은 어떤 펜을 찾아? 같이 골라 보자!",
    lede: "동네 문구점 마스코트 몽이가 필요한 필기구를 같이 골라 줘요. 학교용인지 선물용인지만 알려 주면 가게에 있는 것 중에서 세 가지를 추천해요. 모든 문구는 예시예요.",
    primaryCta: { label: "몽이에게 추천 받기", href: "#pick" },
    secondaryCta: { label: "매장 안내 보기", href: "#store" },
    rightsLabel: "그림 권리",
    rightsNote: "마스코트 몽이(예시)는 가게가 직접 의뢰해 저작권을 가진 그림이에요. 상표 등록 여부는 확인 전(예시)이고, 이 그림을 가게 밖에서 쓰려면 먼저 문의해 주세요.",
    pauseLabel: "캐릭터 움직임 멈추기",
  },
}

// 최소: 짧은 말풍선, 보조 버튼 없음.
export const fixtureMin: HeroMascotGreetingProps = {
  copy: {
    label: "첫 화면",
    title: "안녕!",
    lede: "같이 골라요(예시).",
    primaryCta: { label: "추천", href: "#pick" },
    rightsLabel: "그림 권리",
    rightsNote: "가게가 만든 그림(예시).",
    pauseLabel: "캐릭터 움직임 멈추기",
  },
}
