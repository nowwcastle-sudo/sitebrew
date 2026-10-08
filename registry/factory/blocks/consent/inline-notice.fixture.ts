import { mockAnalytics, type TrackedEvent } from "@/registry/factory/contract/adapter-mock"

import type { ConsentInlineNoticeCopy, ConsentInlineNoticeProps } from "./inline-notice"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 동네 빵집 「밀가루공방(예시)」 오시는 길의 지도 자리 — 바깥 지도 서비스는 마케팅 쿠키 동의가 있어야 불러온다.
// 갤러리 포트: ?consent=unset(기본 — 묻는다)|denied(거부 — 다시 묻는다, 7일간 보지 않기)|all(허용 — 지도 자리).
const COPY: ConsentInlineNoticeCopy = {
  title: "지도를 보려면 쿠키 허용이 필요해요",
  body: "바깥 지도 서비스(예시)가 마케팅 쿠키를 써요. 허용하지 않아도 아래 주소로 길을 찾을 수 있어요.",
  decline: "거부하기",
  accept: "허용하고 지도 보기",
  snooze: "7일간 보지 않기",
  hidden: "쿠키를 허용하지 않아 지도를 표시하지 않았어요.",
  settings: { label: "쿠키 설정 바꾸기", href: "#cookie-settings" },
  allowed: { body: "지도를 불러왔어요. 새 창에서 크게 볼 수 있어요(예시).", label: "지도 크게 보기", href: "#map" },
}

export const fixture: ConsentInlineNoticeProps = {
  copy: COPY,
  category: "marketing",
  consent: () => ({ analytics: false, marketing: false }),
  setConsent: () => undefined,
}

export const fixtureMax: ConsentInlineNoticeProps = {
  ...fixture,
  copy: {
    ...COPY,
    title: "지도를 보려면 마케팅 쿠키 허용이 필요해요 — 허용하지 않아도 주소·찾아오는 길은 그대로 있어요",
    body: "바깥 지도 서비스(예시)는 지도를 보여 줄 때 마케팅 쿠키를 써서 방문 기록을 남겨요. 허용하지 않아도 아래 주소·주차 안내·대중교통 안내로 길을 찾을 수 있고, 허용은 쿠키 설정에서 언제든 거둘 수 있어요(예시).",
  },
}

export const fixtureMin: ConsentInlineNoticeProps = { ...fixture }

export const fixturePorts = (q: URLSearchParams, g: { fx: string; onTrack: (e: TrackedEvent) => void }): Partial<ConsentInlineNoticeProps> => {
  const a = mockAnalytics(q, { onTrack: g.onTrack })
  return { consent: a.consent, setConsent: a.setConsent, track: a.track }
}
