import { mockAnalytics, type TrackedEvent } from "@/registry/factory/contract/adapter-mock"

import { INVITE_URL, TEMPLATE } from "./invite-panel.fixture"
import type { ReferralSuccessMomentPromptCopy, ReferralSuccessMomentPromptProps } from "./success-moment-prompt"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 예약 관리 서비스 「예약노트(예시)」 — 첫 예약을 받은 순간에만 뜨는 초대 권유.
const COPY: ReferralSuccessMomentPromptCopy = {
  ask: { title: "옆 가게 사장님께도 알려 드릴까요?", body: "초대한 분이 가입하면 두 분 모두 프로 요금제를 한 달 무료로 써요." },
  later: "나중에",
  invite: "초대 링크 보내기",
  copied: "초대 링크를 복사했어요. 채팅방에 붙여 넣어 보내 주세요.",
  manual: "자동 복사가 막혔어요. 설정의 초대 화면에서 링크를 복사해 주세요.",
}
const MOMENT = { key: "first-booking", title: "첫 예약을 받았어요!", body: "10월 3일 오후 2시, 2명(예시)." }

export const fixture: ReferralSuccessMomentPromptProps = { copy: COPY, moment: MOMENT, url: INVITE_URL, template: TEMPLATE }

export const fixtureMax: ReferralSuccessMomentPromptProps = {
  copy: {
    ...COPY,
    ask: { title: "옆 가게 사장님께도 알려 드릴까요? 초대는 링크 하나면 돼요", body: "초대한 분이 가입해서 첫 예약을 받으면 두 분 모두 프로 요금제를 한 달 무료로 써요. 무료 기간은 쌓이고, 결제일에 먼저 쓰여요(예시)." },
  },
  moment: { ...MOMENT, title: "첫 예약을 받았어요! 예약 페이지를 연 지 두 시간 만이에요", body: "10월 3일 오후 2시, 2명 · 요청 사항: 창가 자리, 유모차 한 대(예시)." },
  url: INVITE_URL,
  template: TEMPLATE,
}

export const fixtureMin: ReferralSuccessMomentPromptProps = { copy: COPY, moment: { key: MOMENT.key, title: MOMENT.title }, url: INVITE_URL, template: TEMPLATE }

export const fixturePorts = (q: URLSearchParams, g: { fx: string; onTrack: (e: TrackedEvent) => void }): Partial<ReferralSuccessMomentPromptProps> => {
  const a = mockAnalytics(q, { onTrack: g.onTrack })
  return { track: a.track }
}
