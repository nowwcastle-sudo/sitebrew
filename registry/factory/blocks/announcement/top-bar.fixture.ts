import { MOCK_NOW, mockAnalytics, type TrackedEvent } from "@/registry/factory/contract/adapter-mock"

import type { AnnouncementTopBarCopy, AnnouncementTopBarProps } from "./top-bar"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 침구 가게 「솜결(예시)」 추석 배송 공지 — 지금은 목 기준 시각(2026-10-01)으로 고정.
const COPY: AnnouncementTopBarCopy = {
  label: "공지",
  message: "추석 연휴(10월 3~6일)에는 출고를 쉬고, 10월 7일부터 차례로 보내요.",
  link: { label: "배송 일정 보기", href: "#shipping-schedule" },
  dismiss: "공지 닫기",
  countdown: "연휴까지 {days}일",
}

export const fixture: AnnouncementTopBarProps = { copy: COPY, announcementId: "chuseok-2026", startsAt: "2026-09-25T00:00:00.000Z", endsAt: "2026-10-06T15:00:00.000Z", now: MOCK_NOW }

export const fixtureMax: AnnouncementTopBarProps = {
  ...fixture,
  copy: { ...COPY, message: "추석 연휴(10월 3~6일)에는 출고를 쉬고 10월 7일부터 주문 순서대로 보내요. 연휴 전 출고는 10월 2일 오후 2시 주문까지예요(예시)." },
  showCountdown: true,
}

export const fixtureMin: AnnouncementTopBarProps = { ...fixture, copy: { label: COPY.label, message: COPY.message, dismiss: COPY.dismiss } }

export const fixturePorts = (q: URLSearchParams, g: { fx: string; onTrack: (e: TrackedEvent) => void }): Partial<AnnouncementTopBarProps> => {
  const a = mockAnalytics(q, { onTrack: g.onTrack })
  return { track: a.track }
}
