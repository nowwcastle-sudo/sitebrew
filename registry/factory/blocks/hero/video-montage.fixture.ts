import type { HeroVideoMontageProps } from "./video-montage"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 자전거 공방. 컷(clips·media)은 예시에 싣지 않는다 — 없으면 muted 무대로 그려지고(공장은 키 없이 돈다),
// 찍어낸 사이트는 05-media 가 칸을 채운다. 소리 켜기 단추는 클립에 소리가 있을 때만 적는 칸이라 최대 예시에만 둔다.
export const fixture: HeroVideoMontageProps = {
  copy: {
    label: "첫 화면",
    title: "바퀴 하나가 하루를 바꿔요",
    lede: "새벽 조립대에서 오후 시승까지, 자전거 한 대가 완성되는 하루를 짧은 컷으로 이어 봤어요. 모든 문구는 예시예요.",
    primaryCta: { label: "시승 예약하기", href: "#ride" },
    secondaryCta: { label: "공방 둘러보기", href: "#shop" },
    pauseLabel: "컷 전환 멈추기",
  },
}

// 최대: 긴 제목, 긴 문단, 소리 켜기 단추.
export const fixtureMax: HeroVideoMontageProps = {
  copy: {
    label: "첫 화면",
    title: "바퀴 하나가 하루를 바꾸고 하루가 한 대의 자전거를 완성해요",
    lede: "새벽 조립대에서 오후 시승까지, 자전거 한 대가 완성되는 하루를 짧은 컷으로 이어 봤어요. 소리가 있는 컷은 아래 단추를 눌러야 들려요. 모든 문구는 예시예요.",
    primaryCta: { label: "시승 예약하기", href: "#ride" },
    secondaryCta: { label: "공방 둘러보기", href: "#shop" },
    pauseLabel: "컷 전환 멈추기",
    soundLabel: "소리 켜기",
  },
}

// 최소: 짧은 제목, 보조 버튼·소리 단추 없음.
export const fixtureMin: HeroVideoMontageProps = {
  copy: {
    label: "첫 화면",
    title: "바퀴 하나",
    lede: "하루를 이어 봤어요(예시).",
    primaryCta: { label: "예약", href: "#ride" },
    pauseLabel: "컷 전환 멈추기",
  },
}
