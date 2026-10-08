import { mockAnalytics, type TrackedEvent } from "@/registry/factory/contract/adapter-mock"

import type { FinalCtaStoreBadgesCopy, FinalCtaStoreBadgesProps } from "./store-badges"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 가계부 앱 「모아가계부(예시)」의 설치 안내 — 스토어 주소는 모두 example.com 이다.
const COPY: FinalCtaStoreBadgesCopy = {
  title: "휴대폰에서도 써 보세요",
  lead: "설치는 무료예요. 같은 계정으로 로그인하면 기록이 그대로 이어져요(예시).",
  badges: [
    { store: "app-store", label: "앱 스토어에서 받기", href: "https://example.com/app-store", hint: "iPhone · iPad" },
    { store: "google-play", label: "구글 플레이에서 받기", href: "https://example.com/google-play", hint: "안드로이드" },
    { store: "web-store", label: "브라우저 확장 설치", href: "https://example.com/web-store", hint: "크롬 · 엣지" },
  ],
  note: "스토어 이름과 로고는 각 스토어의 상표예요. 지원하는 기기와 운영체제는 스토어 안내를 확인해 주세요(예시).",
}

export const fixture: FinalCtaStoreBadgesProps = { copy: COPY }

export const fixtureMax: FinalCtaStoreBadgesProps = {
  copy: {
    ...COPY,
    title: "휴대폰·태블릿·브라우저 어디서든 같은 가계부를 이어서 써 보세요",
    lead: "설치는 무료예요. 같은 계정으로 로그인하면 기록과 설정이 그대로 이어지고, 한 곳에서 고친 내용은 다른 기기에도 바로 보여요. 오래된 기기는 지원하지 않을 수 있어요(예시).",
    badges: [
      { ...COPY.badges[0], label: "앱 스토어에서 모아가계부 앱 받기", hint: "iPhone · iPad · iOS 17 이상" },
      { ...COPY.badges[1], label: "구글 플레이에서 모아가계부 앱 받기", hint: "안드로이드 10 이상" },
      COPY.badges[2],
      { store: "direct", label: "설치 파일 직접 받기", href: "https://example.com/download", hint: "윈도우 · 맥" },
    ],
  },
}

export const fixtureMin: FinalCtaStoreBadgesProps = {
  copy: { title: COPY.title, badges: [COPY.badges[0]] },
}

export const fixturePorts = (q: URLSearchParams, g: { fx: string; onTrack: (e: TrackedEvent) => void }): Partial<FinalCtaStoreBadgesProps> => {
  const a = mockAnalytics(q, { onTrack: g.onTrack })
  return { track: a.track }
}
