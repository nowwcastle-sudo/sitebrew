import { MOCK_NOW, mockAnalytics, type TrackedEvent } from "@/registry/factory/contract/adapter-mock"

import type { AnnouncementDismissibleInlineCopy, AnnouncementDismissibleInlineProps } from "./dismissible-inline"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 예약 관리 서비스 「예약노트(예시)」 — 한 번 거절한 알림 켜기 권유를 다시 묻는 판.
const COPY: AnnouncementDismissibleInlineCopy = {
  title: "새 기능: 방문 전날 안내 문자",
  body: "예약한 손님에게 방문 전날 저녁 7시에 안내 문자가 가요. 켜 두면 노쇼가 줄어요.",
  until: "{date}까지 무료로 써 볼 수 있어요",
  action: { label: "안내 문자 설정 열기", href: "#reminder-settings" },
  decline: "괜찮아요",
  snooze: "7일간 보지 않기",
}

export const fixture: AnnouncementDismissibleInlineProps = { copy: COPY, announcementId: "reminder-sms-2026-10", endsAt: "2026-10-31T15:00:00.000Z", now: MOCK_NOW }

export const fixtureMax: AnnouncementDismissibleInlineProps = {
  ...fixture,
  copy: {
    ...COPY,
    title: "새 기능: 방문 전날 안내 문자 — 켜 두면 손님에게 주차·오시는 길 안내도 같이 가요",
    body: "예약한 손님에게 방문 전날 저녁 7시에 안내 문자가 가요. 문구는 가게에 맞게 바꿀 수 있고, 손님이 답장으로 예약을 바꾸면 예약표에 바로 반영돼요. 켜 두면 노쇼가 줄어요(예시).",
  },
}

export const fixtureMin: AnnouncementDismissibleInlineProps = { ...fixture, copy: { ...COPY, body: "방문 전날 안내 문자가 가요." } }

export const fixturePorts = (q: URLSearchParams, g: { fx: string; onTrack: (e: TrackedEvent) => void }): Partial<AnnouncementDismissibleInlineProps> => {
  const a = mockAnalytics(q, { onTrack: g.onTrack })
  return { track: a.track }
}
