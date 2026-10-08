import type { HeroBandedFullBleedProps } from "./banded-full-bleed"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). P3-1 r5-celadon A 히어로의 문구 그대로. 영상은 검수대 틀만 넘긴다.
export const fixture: HeroBandedFullBleedProps = {
  copy: {
    label: "첫 화면",
    title: "A celadon vessel, fired thirty times.",
    paragraphs: ["굽 높이와 유약 두께를 바꿔 가며 서른 번 구웠습니다.", "비색은 가마 안쪽 자리에서만 나와 한 번에 여섯 점입니다.", "전시는 가을 한 달 작업실에서 엽니다. 모두 예시입니다."],
    primaryCta: { label: "전시 예약", href: "#booking" },
    secondaryCta: { label: "작업 노트", href: "#notes" },
  },
  faces: ["field-1"],
}

// 최대: 긴 제목, 문단 넷(긴 문장).
export const fixtureMax: HeroBandedFullBleedProps = {
  copy: {
    label: "첫 화면",
    title: "A celadon vessel, fired thirty times in the same kiln.",
    paragraphs: [
      "굽 높이와 유약 두께를 바꿔 가며 서른 번 구웠고, 굽는 날마다 가마 안쪽 온도를 적어 두었습니다.",
      "비색은 가마 안쪽 자리에서만 나와 한 번에 여섯 점입니다.",
      "전시는 가을 한 달 작업실에서 엽니다. 평일 오후와 주말 오전에 예약을 받습니다.",
      "모든 사진과 값은 예시입니다.",
    ],
    primaryCta: { label: "전시 예약", href: "#booking" },
    secondaryCta: { label: "작업 노트", href: "#notes" },
  },
  faces: ["field-1"],
}

// 최소: 문단 하나, 보조 버튼 없음, 면 없음(골격).
export const fixtureMin: HeroBandedFullBleedProps = {
  copy: {
    label: "첫 화면",
    title: "Celadon.",
    paragraphs: ["한 달에 여섯 점(예시)."],
    primaryCta: { label: "예약", href: "#booking" },
  },
}
