import { MOCK_NOW, mockAnalytics, type TrackedEvent } from "@/registry/factory/contract/adapter-mock"

import type { AnnouncementPopupTodayCopy, AnnouncementPopupTodayProps } from "./popup-today"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 동네 한의원 「바른한의원(예시)」의 휴진 안내 창.
const COPY: AnnouncementPopupTodayCopy = {
  title: "10월 둘째 주 휴진 안내",
  body: "10월 12일(월)부터 14일(수)까지 학회 참석으로 진료를 쉬어요. 15일(목)부터 평소처럼 진료해요(예시).",
  until: "{date}까지 안내해요",
  action: { label: "진료 시간 보기", href: "#hours" },
  closeToday: "오늘 하루 보지 않기",
  close: "닫기",
}

export const fixture: AnnouncementPopupTodayProps = { copy: COPY, popupId: "closed-week-2026-10", endsAt: "2026-10-31T15:00:00.000Z", now: MOCK_NOW }

export const fixtureMax: AnnouncementPopupTodayProps = {
  ...fixture,
  copy: {
    ...COPY,
    title: "10월 둘째 주 휴진 안내 — 전화 예약과 처방전 재발급은 평소처럼 받아요",
    body: "10월 12일(월)부터 14일(수)까지 학회 참석으로 진료를 쉬어요. 이 기간에 남겨 주신 전화와 문자는 15일(목) 아침부터 순서대로 답해 드려요. 급한 증상은 가까운 응급실이나 119에 먼저 연락해 주세요(예시).",
  },
}

export const fixtureMin: AnnouncementPopupTodayProps = { ...fixture, copy: { ...COPY, until: undefined, action: undefined, body: "10월 12~14일은 쉬어요(예시)." } }

export const fixturePorts = (q: URLSearchParams, g: { fx: string; onTrack: (e: TrackedEvent) => void }): Partial<AnnouncementPopupTodayProps> => {
  const a = mockAnalytics(q, { onTrack: g.onTrack })
  return { track: a.track }
}
