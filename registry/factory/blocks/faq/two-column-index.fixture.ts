import type { FaqTwoColumnIndexProps } from "./two-column-index"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 가게, 문구마다 「예시」.
export const fixture: FaqTwoColumnIndexProps = {
  copy: {
    title: "자주 묻는 질문",
    lead: "방문 전에 많이 물어보시는 것을 모았어요(예시).",
    indexLabel: "질문 목록",
    items: [
      { q: "예약은 언제까지 바꿀 수 있나요?", a: "방문 하루 전 저녁 9시까지 바꿀 수 있어요(예시)." },
      { q: "주차가 되나요?", a: "건물 지하 2층에 2시간 무료 주차가 돼요(예시)." },
      { q: "현금영수증을 받을 수 있나요?", a: "결제할 때 번호를 알려 주시면 발급해요(예시)." },
      { q: "아이와 함께 가도 되나요?", a: "네, 유아 의자를 두 개 준비해 두었어요(예시)." },
    ],
  },
}

// 최대: 문구 칸 끝까지, 목록은 최대 개수(12).
export const fixtureMax: FaqTwoColumnIndexProps = {
  copy: {
    title: "자주 묻는 질문 — 예약·결제·방문 전 확인할 것 모음(예시)",
    lead: "예약 변경과 취소, 결제 수단, 주차와 대중교통, 단체 방문과 아이 동반까지 방문 전에 많이 물어보시는 것을 한곳에 모았어요. 여기 없는 내용은 전화로 물어봐 주세요(예시).",
    indexLabel: "질문 목록",
    items: Array.from({ length: 12 }, (_, i) => ({
      q: `예약을 바꾸거나 취소할 때 수수료가 붙는 경우가 있나요? (${i + 1})`,
      a: "방문 하루 전까지는 수수료가 없고, 당일 취소는 결제 금액의 10%가 붙어요. 단체 예약은 사흘 전까지 알려 주셔야 수수료 없이 바꿀 수 있어요. 자세한 기준은 약관을 확인해 주세요(예시).",
    })),
  },
}

// 최소: 선택 칸(머리말)을 비우고 목록 1개.
export const fixtureMin: FaqTwoColumnIndexProps = {
  copy: { title: "자주 묻는 질문", indexLabel: "질문 목록", items: [{ q: "주차가 되나요?", a: "네(예시)." }] },
}
