import type { FinalCtaSplitFormHintProps } from "./split-form-hint"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 동네 한의원, 문구마다 「예시」. 채널 이름은 일반 명칭(실존 서비스 이름 대신).
export const fixture: FinalCtaSplitFormHintProps = {
  copy: {
    title: "편한 방법으로 물어보세요",
    lead: "진료 시간 안에는 전화가 가장 빨라요. 밤에는 채팅이나 메일을 남겨 주시면 다음 날 아침에 답해요(예시).",
    channelsLabel: "연락 방법",
    channels: [
      { kind: "tel", label: "전화", value: "02-4567-8901", note: "평일 09:00–18:00" },
      { kind: "kakao", label: "채팅 상담", value: "https://example.com/chat", note: "밤에도 남길 수 있어요" },
      { kind: "naver-booking", label: "예약 페이지", value: "https://example.com/booking", note: "빈 시간을 바로 골라요" },
      { kind: "mail", label: "메일", value: "clinic@example.com" },
    ],
  },
}

// 최대: 긴 제목·머리말, 채널 5개, 긴 값.
export const fixtureMax: FinalCtaSplitFormHintProps = {
  copy: {
    title: "진료 예약과 문의는 편한 방법으로 남겨 주세요(예시)",
    lead: "진료 시간 안에는 전화가 가장 빨라요. 밤이나 주말에는 채팅·메일·예약 페이지에 남겨 주시면 다음 진료일 아침에 차례로 답해요. 급한 통증은 가까운 응급실을 먼저 찾아 주세요(예시).",
    channelsLabel: "연락 방법",
    channels: [
      { kind: "tel", label: "대표 전화", value: "1588-4567", note: "평일 09:00–18:00 · 토요일 09:00–13:00" },
      { kind: "kakao", label: "채팅 상담", value: "https://example.com/chat/very-long-channel-name", note: "밤이나 주말에도 남길 수 있고 다음 진료일 아침에 답해요" },
      { kind: "naver-booking", label: "온라인 예약 페이지", value: "https://example.com/booking/clinic-mangwon" },
      { kind: "catchtable", label: "대기 번호표", value: "https://example.com/waitlist" },
      { kind: "mail", label: "메일 문의", value: "appointments-and-questions@example.com" },
    ],
  },
}

// 최소: 머리말 없음, 채널 하나.
export const fixtureMin: FinalCtaSplitFormHintProps = {
  copy: {
    title: "전화로 물어보세요",
    channelsLabel: "연락 방법",
    channels: [{ kind: "tel", label: "전화", value: "02-4567-8901" }],
  },
}
