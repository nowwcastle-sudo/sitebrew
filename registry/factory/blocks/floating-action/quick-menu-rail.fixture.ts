import { mockAnalytics, type TrackedEvent } from "@/registry/factory/contract/adapter-mock"

import type { FloatingActionQuickMenuRailCopy, FloatingActionQuickMenuRailProps } from "./quick-menu-rail"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 구립 문화센터 「햇살문화센터(예시)」의 퀵 메뉴 — 전화·상담·위치와 맨 위로.
const COPY: FloatingActionQuickMenuRailCopy = {
  label: "빠른 메뉴",
  items: [
    { kind: "call", label: "전화", phone: "02-000-1234" },
    { kind: "link", icon: "chat", label: "상담", href: "#contact" },
    { kind: "link", icon: "map", label: "위치", href: "#location" },
  ],
  top: { label: "맨 위로" },
}

export const fixture: FloatingActionQuickMenuRailProps = { copy: COPY }

export const fixtureMax: FloatingActionQuickMenuRailProps = {
  copy: {
    ...COPY,
    label: "빠른 메뉴 — 전화 상담과 오시는 길을 한 번에",
    items: [
      { kind: "call", label: "전화 문의", phone: "02-000-1234" },
      { kind: "link", icon: "chat", label: "온라인 상담 신청", href: "#contact" },
      { kind: "link", icon: "map", label: "오시는 길 안내", href: "#location" },
      { kind: "link", icon: "calendar", label: "프로그램 일정", href: "#schedule" },
      { kind: "link", icon: "mail", label: "메일 문의", href: "#mail" },
    ],
    top: { label: "맨 위로 가기" },
  },
}

export const fixtureMin: FloatingActionQuickMenuRailProps = {
  copy: { ...COPY, items: [{ kind: "call", label: "전화", phone: "02-000-1234" }] },
}

export const fixturePorts = (q: URLSearchParams, g: { fx: string; onTrack: (e: TrackedEvent) => void }): Partial<FloatingActionQuickMenuRailProps> => {
  const a = mockAnalytics(q, { onTrack: g.onTrack })
  return { track: a.track }
}
