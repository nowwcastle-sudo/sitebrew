import { mockAnalytics, type TrackedEvent } from "@/registry/factory/contract/adapter-mock"

import type { ConsentBottomBannerCopy, ConsentBottomBannerProps } from "./bottom-banner"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 동네 빵집 「밀가루공방(예시)」 사이트의 쿠키 동의 띠. 문구는 해요체.
// 갤러리 포트: ?consent=unset(기본 — 결정 전이라 띠가 보인다)|denied|analytics|all(결정했으면 띠가 없다). 누르면 목의 setConsent 로 저장된다.
const COPY: ConsentBottomBannerCopy = {
  title: "방문 기록을 모아도 될까요?",
  body: "어떤 메뉴를 많이 보는지 알면 사이트를 더 쓰기 좋게 고칠 수 있어요. 거부해도 모든 내용을 그대로 볼 수 있어요(예시).",
  policy: { label: "개인정보 처리방침", href: "#privacy" },
  settings: { label: "항목별로 고르기", href: "#cookie-settings" },
  preferences: {
    dialog: { title: "쿠키를 항목별로 골라요", description: "필수 쿠키 말고는 모두 선택이에요. 꺼도 사이트의 모든 내용을 볼 수 있어요(예시)." },
    necessary: { label: "필수", body: "로그인·장바구니처럼 사이트가 돌아가는 데 꼭 필요해요.", always: "늘 켜져 있어요" },
    categories: {
      analytics: { label: "방문 분석", body: "많이 보는 메뉴를 알아 사이트를 고치는 데 써요. 13개월 뒤 지워요." },
      marketing: { label: "마케팅", body: "다른 사이트에서 우리 빵집 광고를 보여 주는 데 써요." },
    },
    marker: "(선택)",
    save: "선택한 대로 저장하기",
    decline: "모두 거부하기",
    accept: "모두 허용하기",
  },
  decline: "모두 거부하기",
  accept: "모두 허용하기",
  saved: "쿠키 설정을 저장했어요.",
}

export const fixture: ConsentBottomBannerProps = {
  copy: COPY,
  consent: () => ({ analytics: false, marketing: false }),
  setConsent: () => undefined,
}

export const fixtureMax: ConsentBottomBannerProps = {
  ...fixture,
  copy: {
    ...COPY,
    title: "방문 기록과 광고 쿠키를 써도 될까요? 허용하지 않아도 모든 내용을 볼 수 있어요",
    body: "어떤 메뉴를 많이 보는지(분석)와 다른 사이트에서 보여 줄 광고(마케팅)에 쿠키를 써요. 분석 기록은 13개월 뒤 지우고, 거부해도 주문·예약을 포함한 모든 기능을 그대로 쓸 수 있어요(예시).",
  },
}

export const fixtureMin: ConsentBottomBannerProps = { ...fixture, copy: { ...COPY, settings: undefined, preferences: undefined } }

export const fixturePorts = (q: URLSearchParams, g: { fx: string; onTrack: (e: TrackedEvent) => void }): Partial<ConsentBottomBannerProps> => {
  const a = mockAnalytics(q, { onTrack: g.onTrack })
  return { consent: a.consent, setConsent: a.setConsent, track: a.track }
}
