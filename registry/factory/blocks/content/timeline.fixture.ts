import type { ContentTimelineProps } from "./timeline"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 공방 「결마루(예시)」의 연혁.
const UNITS = { photoNeeded: "실제 사진 필요", imagePending: "이미지 준비 중" }

export const fixture: ContentTimelineProps = {
  copy: { title: "연혁", units: UNITS },
  entries: [
    { when: { value: 2016, format: "year" }, text: "작은 작업실에서 공방을 열었어요(예시)" },
    { when: { value: 2019, format: "year" }, text: "철거 현장 목재를 받아 쓰기 시작했어요(예시)" },
    { when: { value: 2024, format: "year" }, text: "지금의 작업실로 옮겼어요(예시)" },
  ],
}

export const fixtureMax: ContentTimelineProps = {
  copy: { title: "걸어온 길", lead: "해마다 한 일을 적었어요(예시).", units: UNITS },
  entries: [
    { when: { value: 2016, format: "year" }, text: "작은 작업실에서 공방을 열고 첫 식탁을 만들었어요(예시)" },
    { when: { value: 2018, format: "year" }, text: "동네 책방 벤치를 시작으로 가게 가구를 맡았어요(예시)" },
    { when: { value: 2019, format: "year" }, text: "철거 현장 목재를 받아 쓰기 시작했어요(예시)" },
    { when: { value: 2022, format: "year" }, text: "공방 견학을 매달 열었어요(예시)" },
    { when: { value: 2024, format: "year" }, text: "지금의 작업실로 옮기고 함께 일하는 사람이 셋이 됐어요(예시)" },
  ],
}

export const fixtureMin: ContentTimelineProps = {
  copy: { title: "연혁", units: UNITS },
  entries: [{ when: { value: 2016, format: "year" }, text: "공방을 열었어요(예시)" }],
}
