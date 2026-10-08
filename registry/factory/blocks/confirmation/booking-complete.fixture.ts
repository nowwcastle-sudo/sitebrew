import { mockAnalytics, type TrackedEvent } from "@/registry/factory/contract/adapter-mock"

import type { ConfirmationBookingCompleteCopy, ConfirmationBookingCompleteProps } from "./booking-complete"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 동네 미용실 「결미용실(예시)」 — 문의 폼으로 예약 요청을 보낸 뒤(자체 예약 시스템 없음, 운영자 결정 Q13).
const COPY: ConfirmationBookingCompleteCopy = {
  title: "예약 요청을 보냈어요",
  status: "요청이 가게에 닿았어요",
  detailsTitle: "요청한 내용",
  labels: { date: "날짜·시각", people: "인원", ref: "요청 번호" },
  peopleUnit: "{n}명",
  nextTitle: "앞으로 이렇게 돼요",
  next: [
    { title: "가게 확인", when: "영업시간 안 1시간 안에" },
    { title: "확정 문자", when: "확인하면 바로 보내요" },
    { title: "방문 전날 안내", when: "10월 2일 저녁 7시" },
  ],
  help: { title: "바꾸거나 취소하려면", phone: "02-000-5678", phoneLabel: "가게 전화", channel: { label: "카카오톡 채널로 묻기", href: "#kakao-channel" } },
  primary: { label: "오시는 길 보기", href: "#directions" },
  print: "인쇄·PDF로 저장",
  calendar: { legend: "캘린더에 넣기", ics: "캘린더 파일(.ics) 받기", google: "Google 캘린더에 넣기", eventTitle: "예약 {ref}(예시)", description: "변경·취소는 가게 전화나 카카오톡 채널로 알려 주세요(예시)." },
  rating: { legend: "요청 보내기는 쉬웠나요? (선택)", option: "{n}점", thanks: "알려 주셔서 고마워요. 더 편하게 고칠게요." },
}
const BOOKING = { at: "2026-10-03T05:00:00.000Z", people: 2, ref: "Q-1003-0042" }

export const fixture: ConfirmationBookingCompleteProps = { copy: COPY, booking: BOOKING }

export const fixtureMax: ConfirmationBookingCompleteProps = {
  copy: {
    ...COPY,
    title: "예약이 확정됐어요 — 가게가 확인하고 확정 문자를 보냈어요",
    status: "가게가 확인했어요. 이 시각으로 확정됐어요.",
    next: [...COPY.next, { title: "시술 뒤 관리 안내", when: "방문한 날 저녁, 집에서 할 관리 방법을 문자로 보내요(예시)" }],
  },
  booking: { ...BOOKING, people: 12, ref: "Q-1003-0042-FAMILY-GROUP", confirmed: true, minutes: 90, location: "밀가루공방 본점(예시)" },
}

export const fixtureMin: ConfirmationBookingCompleteProps = {
  copy: { ...COPY, next: [COPY.next[0]], help: { title: COPY.help.title, phone: COPY.help.phone, phoneLabel: COPY.help.phoneLabel }, rating: undefined },
  booking: BOOKING,
}

export const fixturePorts = (q: URLSearchParams, g: { fx: string; onTrack: (e: TrackedEvent) => void }): Partial<ConfirmationBookingCompleteProps> => {
  const a = mockAnalytics(q, { onTrack: g.onTrack })
  return { track: a.track }
}
