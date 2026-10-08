import { MOCK_NOW, mockAnalytics, type TrackedEvent } from "@/registry/factory/contract/adapter-mock"

import type { AnnouncementLaunchBannerCopy, AnnouncementLaunchBannerProps } from "./launch-banner"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 동네 빵집 「밀가루공방(예시)」 가을 신메뉴 출시 — 기간은 실제 캠페인 값처럼, 지금은 목 기준 시각으로 고정.
const COPY: AnnouncementLaunchBannerCopy = {
  eyebrow: "가을 신메뉴",
  title: "무화과 깜파뉴가 나왔어요",
  body: "국산 밀로 48시간 발효한 반죽에 말린 무화과를 듬뿍 넣었어요.",
  period: "{start}부터 {end}까지 하루 30개만 구워요",
  cta: { label: "메뉴와 가격 보기", href: "#menu" },
  dismiss: "출시 소식 닫기",
  countdown: "{days}일 남았어요",
}

export const fixture: AnnouncementLaunchBannerProps = { copy: COPY, announcementId: "fig-campagne-2026", startsAt: "2026-09-30T15:00:00.000Z", endsAt: "2026-10-18T15:00:00.000Z", now: MOCK_NOW, showCountdown: true }

export const fixtureMax: AnnouncementLaunchBannerProps = {
  ...fixture,
  copy: {
    ...COPY,
    eyebrow: "가을 신메뉴 · 하루 30개 한정",
    title: "무화과 깜파뉴가 나왔어요 — 국산 밀로 48시간 발효한 가을 한정 빵",
    body: "국산 밀로 48시간 천천히 발효한 반죽에 말린 무화과와 호두를 듬뿍 넣었어요. 아침 8시와 오후 2시, 하루 두 번 15개씩 구워요. 예약하면 매장에서 바로 받아 갈 수 있어요(예시).",
  },
}

// 시작일·남은 날 없이 끝나는 날만
export const fixtureMin: AnnouncementLaunchBannerProps = { copy: { title: COPY.title, body: COPY.body, period: "{end}까지 팔아요", cta: COPY.cta, dismiss: COPY.dismiss }, announcementId: "fig-campagne-2026-min", endsAt: "2026-10-18T15:00:00.000Z", now: MOCK_NOW }

export const fixturePorts = (q: URLSearchParams, g: { fx: string; onTrack: (e: TrackedEvent) => void }): Partial<AnnouncementLaunchBannerProps> => {
  const a = mockAnalytics(q, { onTrack: g.onTrack })
  return { track: a.track }
}
