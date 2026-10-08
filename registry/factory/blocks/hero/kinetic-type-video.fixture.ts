import type { HeroKineticTypeVideoProps } from "./kinetic-type-video"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 작업장. 영상은 갤러리가 public/media(motkit/kinetic-video)에서 넘긴다 — 예시에는 싣지 않는다
// (찍어낸 사이트는 05-media 가 칸을 채운다). 이름표 띠(captions)는 「예시」 표지를 단 채 둔다 — 04 가 화면 문구 칸(ui:)으로 요청해 06 이 잇는다.
export const fixture: HeroKineticTypeVideoProps = {
  copy: {
    label: "첫 화면",
    title: "바다가 정한 시간에 굽는다",
    lede: "썰물 때만 가마에 불을 넣는 작은 작업장이에요. 한 번에 여섯 점, 모두 손으로 다듬어요. 모든 문구는 예시예요.",
    primaryCta: { label: "작업장 방문 예약", href: "#booking" },
    secondaryCta: { label: "작업 노트", href: "#notes" },
    captions: [
      { name: "물때 작업장(예시)", role: "썰물 가마 · 예시" },
      { name: "유약 창고(예시)", role: "바닷바람 건조 · 예시" },
    ],
    captionsLabel: "영상 속 장소",
    pauseLabel: "배경 움직임 멈추기",
  },
}

// 최대: 긴 제목, 긴 문단, 이름표 셋, 소리 켜기 단추(영상에 소리가 있을 때만 적는다).
export const fixtureMax: HeroKineticTypeVideoProps = {
  copy: {
    label: "첫 화면",
    title: "바다가 정한 시간에만 가마에 불을 넣고 구워요",
    lede: "썰물 때만 가마에 불을 넣는 작은 작업장이에요. 한 번에 여섯 점, 모두 손으로 다듬고 유약은 바닷바람에 말려요. 방문은 물때표를 보고 하루 전까지 예약을 받아요. 모든 문구는 예시예요.",
    primaryCta: { label: "작업장 방문 예약하기", href: "#booking" },
    secondaryCta: { label: "지난 작업 노트 보기", href: "#notes" },
    captions: [
      { name: "물때 작업장(예시)", role: "썰물 가마 · 예시" },
      { name: "유약 창고(예시)", role: "바닷바람 건조 · 예시" },
      { name: "갯바위 가마터(예시)", role: "새벽 불 넣기 · 예시" },
    ],
    captionsLabel: "영상 속 장소",
    pauseLabel: "배경 움직임 멈추기",
    soundLabel: "영상 소리 켜기",
  },
}

// 최소: 짧은 제목, 이름표 하나, 보조 버튼 없음.
export const fixtureMin: HeroKineticTypeVideoProps = {
  copy: {
    label: "첫 화면",
    title: "썰물 가마",
    lede: "물때에 맞춰 구워요(예시).",
    primaryCta: { label: "예약", href: "#booking" },
    captions: [{ name: "물때 작업장(예시)" }],
    captionsLabel: "영상 속 장소",
    pauseLabel: "배경 움직임 멈추기",
  },
}
