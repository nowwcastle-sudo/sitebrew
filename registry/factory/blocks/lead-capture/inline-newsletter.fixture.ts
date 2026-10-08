import { APPROVAL_HINT } from "@/registry/factory/contract/human-actions"
import { mockAnalytics, stateFromQuery, type TrackedEvent } from "@/registry/factory/contract/adapter-mock"

import type { LeadCaptureInlineNewsletterCopy, LeadCaptureInlineNewsletterProps } from "./inline-newsletter"
import { SUBMIT_NOTICES } from "../auth/sign-in.fixture"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 동네 빵집 「밀가루공방(예시)」의 주간 소식지.
const COPY: LeadCaptureInlineNewsletterCopy = {
  humanHint: APPROVAL_HINT.ko,
  title: "이번 주 구울 빵을 먼저 알려 드려요",
  what: "새로 나오는 빵과 한정 메뉴를 한 통에 모아 보내요.",
  when: "매주 목요일 아침 7시에 와요.",
  sample: { label: "지난 호 보기", href: "#newsletter-sample" },
  email: { label: "이메일", marker: "(필수)", placeholder: "name@example.com", required: "소식지를 받을 이메일을 적어 주세요.", invalid: "이메일 형식이 맞지 않아요. @와 도메인을 확인해 주세요." },
  consent: { label: "(필수) 소식지 같은 광고성 정보를 메일로 받는 데 동의해요", required: "소식지를 받으려면 수신 동의에 체크해 주세요." },
  unsubscribe: "메일 맨 아래 「구독 끊기」를 누르면 언제든 바로 끊겨요.",
  submit: "소식지 구독하기",
  pending: "구독하는 중",
  fieldErrorTitle: "입력한 내용을 확인해 주세요",
  serverErrorTitle: "구독하지 못했어요",
  notices: SUBMIT_NOTICES,
  done: { title: "구독했어요", body: "{email}로 확인 메일을 보냈어요. 이번 주 목요일부터 받아요." },
}

export const fixture: LeadCaptureInlineNewsletterProps = { copy: COPY, submit: async () => ({ ok: true, data: {} }) }

export const fixtureMax: LeadCaptureInlineNewsletterProps = {
  ...fixture,
  copy: {
    ...COPY,
    title: "이번 주 구울 빵과 한정 메뉴를 목요일 아침에 먼저 알려 드려요",
    what: "새로 나오는 빵, 주말 한정 메뉴, 휴무 안내를 한 통에 모아 보내요. 광고 메일은 한 주에 한 통을 넘지 않아요(예시).",
    when: "매주 목요일 아침 7시에 와요. 명절 주간은 하루 앞당겨 수요일에 보내요.",
  },
}

export const fixtureMin: LeadCaptureInlineNewsletterProps = { ...fixture, copy: { ...COPY, what: "새 빵 소식을 보내요." } }

export const fixturePorts = (q: URLSearchParams, g: { fx: string; onTrack: (e: TrackedEvent) => void }): Partial<LeadCaptureInlineNewsletterProps> => {
  const { submit } = stateFromQuery<never, unknown>(q, {
    receipt: {},
    fieldErrors: { email: ["이미 구독 중인 이메일이에요. 다른 주소를 적어 주세요."] },
    formError: q.get("submit") === "server-error" ? "구독 서버가 잠시 응답하지 않아요. 잠시 뒤 다시 눌러 주세요(예시)." : "입력한 내용을 다시 확인해 주세요.",
  })
  const a = mockAnalytics(q, { onTrack: g.onTrack })
  return { submit: () => submit(), track: a.track }
}
