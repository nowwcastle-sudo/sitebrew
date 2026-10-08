import type { HeroKenBurnsStillsProps } from "./ken-burns-stills"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 찻집. 사진(stills)은 갤러리가 public/media(motkit/reel-0~3)에서 넘긴다 — 예시에는 싣지 않는다.
// 이름표 띠(captions)는 사진마다 하나 — 「예시」 표지를 단 채 둔다(04 화면 문구 칸 → 06).
export const fixture: HeroKenBurnsStillsProps = {
  copy: {
    label: "첫 화면",
    title: "골목 끝, 네 계절의 찻집",
    lede: "볕이 드는 창가 자리와 마당 자리가 있어요. 계절마다 차와 다과가 바뀌어요. 모든 문구는 예시예요.",
    primaryCta: { label: "자리 예약", href: "#booking" },
    secondaryCta: { label: "이번 계절 차림", href: "#menu" },
    captions: [
      { name: "창가 자리(예시)", role: "오전 볕 · 예시" },
      { name: "마당 자리(예시)", role: "처마 아래 · 예시" },
      { name: "다실(예시)", role: "조용한 방 · 예시" },
      { name: "부엌(예시)", role: "다과 굽는 곳 · 예시" },
    ],
    captionsLabel: "사진 속 자리",
    pauseLabel: "배경 움직임 멈추기",
  },
}

// 최대: 긴 제목, 긴 문단, 이름표 다섯.
export const fixtureMax: HeroKenBurnsStillsProps = {
  copy: {
    label: "첫 화면",
    title: "골목 끝에서 네 계절을 천천히 우려내는 작은 찻집",
    lede: "볕이 드는 창가 자리와 처마 아래 마당 자리, 문을 닫으면 조용해지는 다실이 있어요. 계절마다 차와 다과가 바뀌고 다과는 그날 아침 부엌에서 구워요. 모든 문구는 예시예요.",
    primaryCta: { label: "자리 예약하기", href: "#booking" },
    secondaryCta: { label: "이번 계절 차림 보기", href: "#menu" },
    captions: [
      { name: "창가 자리(예시)", role: "오전 볕 · 예시" },
      { name: "마당 자리(예시)", role: "처마 아래 · 예시" },
      { name: "다실(예시)", role: "조용한 방 · 예시" },
      { name: "부엌(예시)", role: "다과 굽는 곳 · 예시" },
      { name: "대문(예시)", role: "골목 끝 · 예시" },
    ],
    captionsLabel: "사진 속 자리",
    pauseLabel: "배경 움직임 멈추기",
  },
}

// 최소: 짧은 제목, 이름표 하나, 보조 버튼 없음.
export const fixtureMin: HeroKenBurnsStillsProps = {
  copy: {
    label: "첫 화면",
    title: "골목 찻집",
    lede: "계절 차를 내요(예시).",
    primaryCta: { label: "예약", href: "#booking" },
    captions: [{ name: "창가 자리(예시)" }],
    captionsLabel: "사진 속 자리",
    pauseLabel: "배경 움직임 멈추기",
  },
}
