import { mockAnalytics, type TrackedEvent } from "@/registry/factory/contract/adapter-mock"

import type { FloatingActionChatLauncherCopy, FloatingActionChatLauncherProps } from "./chat-launcher"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 온라인 꽃집 「꽃다발집(예시)」의 문의 단추 — 메신저 채널 링크와 메일.
const COPY: FloatingActionChatLauncherCopy = {
  open: "문의하기",
  title: "문의 채널",
  note: "평일 10:00~18:00에 답해요(예시)",
  close: "닫기",
  channels: [
    { kind: "messenger", label: "메신저로 문의", href: "https://example.com/channel", hint: "채널을 추가하면 바로 물어볼 수 있어요" },
    { kind: "mail", label: "메일로 문의", href: "mailto:hello@example.com", hint: "hello@example.com" },
  ],
}

export const fixture: FloatingActionChatLauncherProps = { copy: COPY }

export const fixtureMax: FloatingActionChatLauncherProps = {
  copy: {
    ...COPY,
    open: "배송·주문 문의하기",
    title: "문의 채널 — 주문·배송·교환은 이쪽으로 알려 주세요",
    note: "평일 10:00~18:00에 순서대로 답해요. 주말·공휴일에 남기신 글은 다음 영업일에 확인해요(예시).",
    channels: [
      ...COPY.channels,
      { kind: "link", label: "자주 묻는 질문 먼저 보기", href: "#faq", hint: "배송 기간과 교환 방법을 모아 두었어요" },
    ],
  },
}

export const fixtureMin: FloatingActionChatLauncherProps = {
  copy: { ...COPY, note: undefined, channels: [COPY.channels[0]] },
}

export const fixturePorts = (q: URLSearchParams, g: { fx: string; onTrack: (e: TrackedEvent) => void }): Partial<FloatingActionChatLauncherProps> => {
  const a = mockAnalytics(q, { onTrack: g.onTrack })
  return { track: a.track }
}
