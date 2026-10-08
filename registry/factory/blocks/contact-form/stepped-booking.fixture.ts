import type { FixtureStates } from "@/registry/factory/contract/adapter-mock"

import { FORM } from "./inline-short.fixture"
import type { BookingOption, ContactFormSteppedBookingProps } from "./stepped-booking"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 미용실 예약, 문구마다 「예시」.
const DATES: BookingOption[] = [
  { value: "2026-10-01", label: "10월 1일 (목)" },
  { value: "2026-10-02", label: "10월 2일 (금)" },
  { value: "2026-10-03", label: "10월 3일 (토)", full: true },
  { value: "2026-10-04", label: "10월 4일 (일)" },
  { value: "2026-10-06", label: "10월 6일 (화)" },
  { value: "2026-10-07", label: "10월 7일 (수)" },
  { value: "2026-10-08", label: "10월 8일 (목)" },
]
const TIMES: BookingOption[] = ["11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00"].map((t, i) => ({ value: t, label: t, full: i === 2 || i === 6 }))
const COPY = {
  title: "예약 요청",
  lead: "날짜와 시간을 고르고 연락처를 남겨 주세요. 확정 문자를 보내 드려요(예시).",
  steps: ["날짜", "시간", "정보", "확인"] as [string, string, string, string],
  stepTemplate: "{total}단계 중 {n}단계",
  dateLegend: "방문 날짜를 골라 주세요",
  timeLegend: "시간을 골라 주세요",
  fullLabel: "마감",
  labels: { name: "이름", phone: "연락처", request: "요청 사항(선택)" },
  summaryLabel: "고른 때",
  next: "다음",
  back: "이전",
  review: { title: "이대로 요청할까요?", lead: "요청한 뒤에도 문자로 확정되기 전까지는 바꿀 수 있어요(예시).", dateLabel: "날짜", timeLabel: "시간", editLabel: "고치기", empty: "적지 않았어요" },
  form: { ...FORM, submitLabel: "예약 요청", done: { title: "예약 요청을 받았어요", body: "확정되면 문자로 알려 드려요(예시).", idLabel: "요청 번호", again: "다른 날짜로 요청" } },
}
const TOOL = { toolName: "request-booking", description: "날짜·시간·연락처로 예약을 요청해요. 요청은 사람이 눌러요(예시)." } as const

export const fixture: ContactFormSteppedBookingProps = {
  copy: COPY,
  tool: TOOL,
  dates: DATES,
  times: TIMES,
  submit: async () => ({ ok: true, data: { id: "BK-0001" } }),
}

// 최대: 문구 끝까지, 날짜 14개·시간 18개.
export const fixtureMax: ContactFormSteppedBookingProps = {
  ...fixture,
  copy: {
    ...COPY,
    title: "예약 요청 — 날짜와 시간을 고르고 연락처를 남기면 확정 문자를 보내 드려요(예시)",
    lead: "원하는 디자이너가 있으면 요청 사항에 적어 주세요. 같은 날 두 명 이상 예약하려면 한 명씩 따로 요청해 주세요. 요청만으로는 예약이 확정되지 않아요(예시).",
    dateLegend: "방문 날짜를 골라 주세요 — 마감된 날은 고를 수 없어요(예시)",
  },
  dates: Array.from({ length: 14 }, (_, i) => ({ value: `2026-10-${String(i + 1).padStart(2, "0")}`, label: `10월 ${i + 1}일 (${"목금토일월화수"[i % 7]})`, full: i % 5 === 2 })),
  times: Array.from({ length: 18 }, (_, i) => {
    const t = `${String(10 + Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`
    return { value: t, label: t, full: i % 4 === 1 }
  }),
}

// 최소: 머리말 없이 날짜 하나·시간 하나.
export const fixtureMin: ContactFormSteppedBookingProps = { ...fixture, tool: undefined, copy: { ...COPY, lead: undefined }, dates: [DATES[0]], times: [TIMES[0]] }

// 갤러리 상태 주입 재료(&submit=) — 필드 오류가 앞 단계(시간)와 정보 단계(연락처)에 있다: 시간 단계로 돌아가 첫 시간 칩에 포커스가 가는지 본다.
export const fixtureStates: FixtureStates<ContactFormSteppedBookingProps> = {
  receipt: { id: "BK-20261001-07", message: "확정되면 문자로 알려 드려요(예시)." },
  fieldErrors: { time: ["방금 다른 분이 예약했어요. 다른 시간을 골라 주세요(예시)."], phone: ["연락처 형식을 확인해 주세요."] },
  formError: "고른 시간을 다시 확인해 주세요.",
}
