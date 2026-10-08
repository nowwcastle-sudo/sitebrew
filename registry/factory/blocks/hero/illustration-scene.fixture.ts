import type { HeroIllustrationSceneProps } from "./illustration-scene"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 동네 도서관. 일러스트(media — 생성 허용 칸)는 예시에 싣지 않는다: 없으면 muted 틀로 그려지고
// 찍어낸 사이트는 05-media 가 칸을 채운다(키 없는 실행은 「이미지 준비 중」).
export const fixture: HeroIllustrationSceneProps = {
  copy: {
    label: "첫 화면",
    title: "골목 끝에 책 읽는 마당이 열려요",
    lede: "아이와 어른이 같은 탁자에 앉아 책을 펼치는 작은 도서관이에요. 대출은 무료이고 모임은 매주 열려요. 모든 문구는 예시예요.",
    primaryCta: { label: "이번 주 모임 보기", href: "#events" },
    secondaryCta: { label: "오시는 길", href: "#visit" },
  },
}

// 최대: 긴 제목, 긴 문단.
export const fixtureMax: HeroIllustrationSceneProps = {
  copy: {
    label: "첫 화면",
    title: "골목 끝에 아이와 어른이 함께 책 읽는 마당이 새로 열려요",
    lede: "아이와 어른이 같은 탁자에 앉아 책을 펼치는 작은 도서관이에요. 대출은 무료이고 모임은 매주 열리며, 처음 오시는 분께는 사서가 읽을 책을 함께 골라 드려요. 모든 문구는 예시예요.",
    primaryCta: { label: "이번 주 모임 일정 보기", href: "#events" },
    secondaryCta: { label: "오시는 길 안내", href: "#visit" },
  },
}

// 최소: 짧은 제목, 보조 버튼 없음.
export const fixtureMin: HeroIllustrationSceneProps = {
  copy: {
    label: "첫 화면",
    title: "책 마당",
    lede: "무료로 빌려요(예시).",
    primaryCta: { label: "모임 보기", href: "#events" },
  },
}
