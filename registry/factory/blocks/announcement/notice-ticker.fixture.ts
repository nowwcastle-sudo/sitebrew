import { mockAnalytics, type TrackedEvent } from "@/registry/factory/contract/adapter-mock"

import type { AnnouncementNoticeTickerCopy, AnnouncementNoticeTickerProps } from "./notice-ticker"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 구립 도서관 「햇살도서관(예시)」의 공지 롤링 줄.
const ITEMS: AnnouncementNoticeTickerCopy["items"] = [
  { text: "10월 셋째 주 월요일은 시설 점검으로 쉬어요(예시)", href: "#notice-1", date: "2026-09-29T00:00:00+09:00" },
  { text: "어린이 책 읽기 교실 11월 수강생을 모집해요(예시)", href: "#notice-2", date: "2026-09-25T00:00:00+09:00" },
  { text: "대출 반납 알림 문자가 바뀌어요(예시)", href: "#notice-3", date: "2026-09-18T00:00:00+09:00" },
  { text: "야간 열람실이 평일 밤 10시까지 열려요(예시)", href: "#notice-4" },
]
const COPY: AnnouncementNoticeTickerCopy = {
  label: "공지",
  items: ITEMS,
  pause: "공지 자동 넘김",
  viewAll: { label: "공지 전체 보기", href: "#notices" },
}

export const fixture: AnnouncementNoticeTickerProps = { copy: COPY }

export const fixtureMax: AnnouncementNoticeTickerProps = {
  copy: {
    ...COPY,
    items: [
      { ...ITEMS[0], text: "10월 셋째 주 월요일(10월 19일)은 전체 시설 점검과 서가 정리로 쉬어요. 대출 반납은 정문 옆 무인 반납함을 이용해 주세요. 점검 때문에 불편을 드려 죄송해요(예시)" },
      ...ITEMS.slice(1),
    ],
  },
}

export const fixtureMin: AnnouncementNoticeTickerProps = { copy: { ...COPY, items: [ITEMS[0]], viewAll: undefined } }

export const fixturePorts = (q: URLSearchParams, g: { fx: string; onTrack: (e: TrackedEvent) => void }): Partial<AnnouncementNoticeTickerProps> => {
  const a = mockAnalytics(q, { onTrack: g.onTrack })
  return { track: a.track }
}
