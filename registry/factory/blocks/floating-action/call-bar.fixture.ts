import { mockAnalytics, type TrackedEvent } from "@/registry/factory/contract/adapter-mock"

import type { FloatingActionCallBarCopy, FloatingActionCallBarProps } from "./call-bar"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 동네 치과 「맑은치과(예시)」 — 좁은 화면 아래 고정 전화 줄.
const COPY: FloatingActionCallBarCopy = {
  regionLabel: "전화 상담",
  note: "평일 09:00~18:00 · 점심 13:00~14:00(예시)",
  call: { label: "전화 상담", phone: "02-000-1234" },
}

export const fixture: FloatingActionCallBarProps = { copy: COPY }

export const fixtureMax: FloatingActionCallBarProps = {
  copy: {
    ...COPY,
    regionLabel: "전화 상담과 온라인 예약",
    note: "평일 09:00~18:00, 토요일 09:00~13:00에 받아요. 점심시간(13:00~14:00)과 일요일·공휴일에는 남겨 주신 번호로 다음 날 전화드려요(예시).",
    call: { label: "전화로 예약 문의하기", phone: "+82 2-0000-1234" },
    secondary: { label: "온라인 예약", href: "#booking" },
  },
}

export const fixtureMin: FloatingActionCallBarProps = {
  copy: { regionLabel: "전화", call: { label: "전화", phone: "02-000-1234" } },
}

export const fixturePorts = (q: URLSearchParams, g: { fx: string; onTrack: (e: TrackedEvent) => void }): Partial<FloatingActionCallBarProps> => {
  const a = mockAnalytics(q, { onTrack: g.onTrack })
  return { track: a.track }
}
