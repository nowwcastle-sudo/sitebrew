import type { ContentProseProps } from "./prose"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 공방 「결마루(예시)」의 회사 요약.
const UNITS = { photoNeeded: "실제 사진 필요", imagePending: "이미지 준비 중" }

export const fixture: ContentProseProps = {
  copy: { title: "회사 요약", units: UNITS },
  paragraphs: ["결마루(예시)는 오래된 목재를 다시 다듬어 생활 가구로 만드는 공방이에요.\n버려질 뻔한 마루판과 기둥을 골라 손으로 고르고 기름칠해 식탁과 선반으로 바꿔요(예시)."],
}

export const fixtureMax: ContentProseProps = {
  copy: { title: "우리가 일하는 방식", lead: "작업 순서를 그대로 적었어요(예시).", units: UNITS },
  paragraphs: [
    "처음에는 목재가 어디서 왔는지부터 확인해요. 철거 현장에서 받은 나무는 못 자국과 칠을 하나씩 지우고, 갈라진 결은 그대로 살려 두어요(예시).",
    "다음으로 쓰임을 정해요. 같은 기둥이라도 식탁 다리가 될지 선반 받침이 될지는 나뭇결과 두께가 정해요. 손님과 함께 고르는 날을 따로 잡아요(예시).\n마지막으로 오일을 세 번 바르고 일주일 말린 뒤 보내요(예시).",
  ],
}

export const fixtureMin: ContentProseProps = {
  copy: { title: "미션", hideTitle: true, units: UNITS },
  paragraphs: ["버려질 나무에 두 번째 쓰임을 찾아 줘요(예시)."],
}
