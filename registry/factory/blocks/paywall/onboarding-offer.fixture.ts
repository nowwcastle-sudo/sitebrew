import { MOCK_NOW, MOCK_PLANS, mockAnalytics, mockBilling, type TrackedEvent } from "@/registry/factory/contract/adapter-mock"

import type { PaywallOnboardingOfferCopy, PaywallOnboardingOfferProps } from "./onboarding-offer"
import { OFFER_COPY } from "./upgrade-modal.fixture"
import { SUBMIT_NOTICES } from "../auth/sign-in.fixture"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 서비스 「모아플랜(예시)」 첫 세션 설정을 막 끝낸 화면.
// 갤러리 포트: &state=(plans 읽기) · &submit=(checkout 결과).
const COPY: PaywallOnboardingOfferCopy = {
  title: "설정을 마쳤어요",
  lead: "이제 오늘 일정을 바로 볼 수 있어요(예시).",
  doneLabel: "방금 끝낸 설정",
  done: ["캘린더 연결", "첫 프로젝트 만들기", "알림 시간 정하기"],
  offerTitle: "{plan} 기능도 무료로 써 볼까요?",
  offerLead: "보고서 내보내기·정기 발송을 14일 동안 써 볼 수 있어요. 안 써도 지금 설정은 그대로예요.",
  offer: OFFER_COPY,
  continueFree: "무료로 계속하기",
  alert: { field: "확인이 필요해요", server: "체험을 시작하지 못했어요 — 잠시 뒤 다시 눌러 주세요" },
  notices: SUBMIT_NOTICES,
  loading: "요금제를 불러오는 중이에요",
  error: "요금제를 불러오지 못했어요",
  retry: "다시 불러오기",
  started: "{plan} 체험을 시작했어요. 오늘 일정으로 이동할게요(예시).",
}

export const fixture: PaywallOnboardingOfferProps = {
  copy: COPY,
  continueHref: "#today",
  now: MOCK_NOW,
  plans: async () => ({ ok: true, data: [...MOCK_PLANS] }),
  checkout: async () => ({ ok: true, data: { redirectUrl: "#checkout" } }),
}

export const fixtureMax: PaywallOnboardingOfferProps = {
  ...fixture,
  copy: {
    ...COPY,
    title: "설정을 마쳤어요 — 오늘부터 가족·팀 일정을 한곳에서 챙겨요(예시)",
    lead: "이제 오늘 일정을 바로 볼 수 있어요. 나머지 설정(공유 캘린더·색 지정·휴일 표시)은 쓰면서 언제든 바꿀 수 있어요(예시).",
    done: [...COPY.done, "팀원 초대하기", "휴일 표시 켜기", "주간 요약 메일 받기"],
    offerLead: "보고서 내보내기·정기 발송·무제한 보관을 14일 동안 써 볼 수 있어요. 체험하지 않아도 지금 설정과 일정은 그대로이고, 나중에 결제 관리에서 언제든 시작할 수 있어요.",
  },
}

export const fixtureMin: PaywallOnboardingOfferProps = { ...fixture, copy: { ...COPY, lead: undefined, done: [], offerLead: undefined } }

export const fixturePorts = (q: URLSearchParams, g: { fx: string; onTrack: (e: TrackedEvent) => void }): Partial<PaywallOnboardingOfferProps> => {
  const billing = mockBilling(q, { requireWithdrawalConsent: true })
  return { plans: billing.plans, checkout: billing.checkout, track: mockAnalytics(q, { onTrack: g.onTrack }).track }
}
