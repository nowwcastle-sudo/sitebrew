import { mockAnalytics, type TrackedEvent } from "@/registry/factory/contract/adapter-mock"

import type { AnnouncementUpdateToastCopy, AnnouncementUpdateToastProps } from "./update-toast"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 가계부 앱 「모아가계부(예시)」의 새 판 알림.
const COPY: AnnouncementUpdateToastCopy = {
  title: "새 판이 나왔어요",
  body: "지금 새로 고치면 바뀐 기능을 바로 쓸 수 있어요. 입력 중인 내용은 먼저 저장해 주세요(예시).",
  update: "지금 새로 고침",
  later: "나중에",
}

export const fixture: AnnouncementUpdateToastProps = { copy: COPY, available: true, version: "2026.10.1" }

export const fixtureMax: AnnouncementUpdateToastProps = {
  ...fixture,
  copy: {
    ...COPY,
    title: "새 판이 나왔어요 — 가계부 목록이 더 빨라지고 영수증 사진 첨부가 추가됐어요",
    body: "지금 새로 고치면 바뀐 기능을 바로 쓸 수 있어요. 새로 고치면 입력 중인 내용이 사라질 수 있으니, 쓰던 내용은 먼저 저장하고 새로 고쳐 주세요. 지금 바쁘면 「나중에」를 눌러도 이번 방문 동안은 다시 묻지 않아요(예시).",
  },
}

export const fixtureMin: AnnouncementUpdateToastProps = { ...fixture, copy: { ...COPY, body: undefined } }

export const fixturePorts = (q: URLSearchParams, g: { fx: string; onTrack: (e: TrackedEvent) => void }): Partial<AnnouncementUpdateToastProps> => {
  const a = mockAnalytics(q, { onTrack: g.onTrack })
  return { track: a.track }
}
