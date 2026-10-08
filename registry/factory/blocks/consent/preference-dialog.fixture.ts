import { mockAnalytics, type TrackedEvent } from "@/registry/factory/contract/adapter-mock"

import type { ConsentPreferenceDialogCopy, ConsentPreferenceDialogProps } from "./preference-dialog"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 동네 빵집 「밀가루공방(예시)」의 쿠키 설정. 문구는 해요체.
// 갤러리 포트: ?consent=unset(기본)|denied|analytics|all — 요약 판과 대화상자 스위치의 처음 값. 대화상자는 [쿠키 설정 바꾸기]를 눌러야 열린다.
const COPY: ConsentPreferenceDialogCopy = {
  title: "쿠키 설정",
  lead: "이 사이트가 쓰는 쿠키를 항목별로 켜고 끌 수 있어요(예시).",
  summary: { analytics: "방문 분석", marketing: "마케팅", on: "허용", off: "거부", undecided: "아직 정하지 않았어요(꺼짐)", decidedAt: "마지막으로 정한 날: {date}" },
  open: "쿠키 설정 바꾸기",
  dialog: { title: "쿠키를 항목별로 골라요", description: "필수 쿠키 말고는 모두 선택이에요. 꺼도 사이트의 모든 내용을 볼 수 있어요." },
  necessary: { label: "필수", body: "로그인·장바구니처럼 사이트가 돌아가는 데 꼭 필요해요.", always: "늘 켜져 있어요" },
  categories: {
    analytics: { label: "방문 분석", body: "많이 보는 메뉴를 알아 사이트를 고치는 데 써요. 13개월 뒤 지워요." },
    marketing: { label: "마케팅", body: "다른 사이트에서 우리 빵집 광고를 보여 주는 데 써요." },
  },
  marker: "(선택)",
  save: "선택한 대로 저장하기",
  decline: "모두 거부하기",
  accept: "모두 허용하기",
  saved: "쿠키 설정을 저장했어요.",
}

export const fixture: ConsentPreferenceDialogProps = {
  copy: COPY,
  consent: () => ({ analytics: false, marketing: false }),
  setConsent: () => undefined,
}

export const fixtureMax: ConsentPreferenceDialogProps = {
  ...fixture,
  copy: {
    ...COPY,
    title: "쿠키 설정 — 방문 분석·마케팅 쿠키를 항목별로 켜고 꺼요(예시)",
    lead: "이 사이트가 쓰는 쿠키를 항목별로 켜고 끌 수 있어요. 바꾼 설정은 이 브라우저에 1년 동안 기억하고, 그 뒤에는 다시 여쭤봐요(예시).",
    categories: {
      analytics: { label: "방문 분석", body: "많이 보는 메뉴·자주 나가는 화면을 알아 사이트를 고치는 데 써요. 이름·연락처는 모으지 않고, 기록은 13개월 뒤 지워요." },
      marketing: { label: "마케팅", body: "다른 사이트에서 우리 빵집 광고를 보여 주고, 광고를 보고 들어온 방문을 세는 데 써요." },
    },
  },
}

export const fixtureMin: ConsentPreferenceDialogProps = { ...fixture, copy: { ...COPY, lead: undefined } }

export const fixturePorts = (q: URLSearchParams, g: { fx: string; onTrack: (e: TrackedEvent) => void }): Partial<ConsentPreferenceDialogProps> => {
  const a = mockAnalytics(q, { onTrack: g.onTrack })
  return { consent: a.consent, setConsent: a.setConsent, track: a.track }
}
