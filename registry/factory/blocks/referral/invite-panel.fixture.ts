import { mockAnalytics, type TrackedEvent } from "@/registry/factory/contract/adapter-mock"

import type { KakaoShareTemplate } from "../_shared/share-link"
import type { ReferralInvitePanelCopy, ReferralInvitePanelProps } from "./invite-panel"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 예약 관리 서비스 「예약노트(예시)」의 초대 판 — 보상은 제품 가치(한 달 무료).
export const INVITE_URL = "https://example.com/invite/K7P2Q9"
export const TEMPLATE: KakaoShareTemplate = {
  title: "예약노트(예시) 한 달 무료로 써 보세요",
  description: "이 링크로 가입하면 저도 한 달, 사장님도 한 달 무료예요(예시).",
  imageUrl: "https://example.com/og/invite-1600x836.png",
  imageWidth: 1600,
  imageHeight: 836,
  link: INVITE_URL,
  buttonTitle: "한 달 무료로 시작하기",
}
export const LINK_COPY = { label: "내 초대 링크", copy: "링크 복사", copied: "링크를 복사했어요. 채팅방에 붙여 넣어 보내 주세요.", manual: "자동 복사가 막혔어요. 링크 칸을 골라 두었으니 직접 복사해 주세요." }
const COPY: ReferralInvitePanelCopy = {
  title: "사장님 한 분을 초대하면 둘 다 한 달 무료예요",
  lead: "초대한 분이 가입해서 첫 예약을 받으면 두 분 모두에게 한 달이 더해져요.",
  rewards: { title: "받는 것", you: "나: 가입한 친구 한 명마다 프로 요금제 한 달", friend: "친구: 가입하면 바로 프로 요금제 한 달" },
  link: LINK_COPY,
  kakao: "카카오톡으로 초대하기",
  kakaoFallback: "카카오톡을 열 수 없어 링크를 복사했어요. 채팅방에 붙여 넣어 주세요.",
  sms: "문자로 초대하기",
  message: "예약노트(예시) 써 보세요. 이 링크로 가입하면 한 달 무료예요: {link}",
  progressTitle: "초대 현황",
  stats: { invited: "보낸 초대", joined: "가입한 친구", earned: "받은 무료 기간" },
  earnedUnit: "{n}개월",
  terms: { label: "초대 보상 조건 보기", href: "#referral-terms" },
}

export const fixture: ReferralInvitePanelProps = { copy: COPY, url: INVITE_URL, template: TEMPLATE, progress: { invited: 5, joined: 2, earnedMonths: 2 } }

export const fixtureMax: ReferralInvitePanelProps = {
  copy: {
    ...COPY,
    title: "사장님 한 분을 초대하면 두 분 모두 프로 요금제를 한 달 무료로 써요 — 초대는 몇 번이든 돼요",
    lead: "초대한 분이 가입해서 첫 예약을 받으면 두 분 모두에게 한 달이 더해져요. 무료 기간은 쌓이고, 쌓인 기간은 결제일에 먼저 쓰여요. 보상은 가입한 달 말일에 한 번에 들어와요(예시).",
  },
  url: "https://example.com/invite/K7P2Q9-very-long-campaign-code-2026-autumn",
  template: TEMPLATE,
  progress: { invited: 128, joined: 47, earnedMonths: 12 },
}

// 카카오 템플릿이 규격에 안 맞으면(폭 600px) 카카오 버튼을 그리지 않는다 — 문자·링크 복사만
export const fixtureMin: ReferralInvitePanelProps = { copy: COPY, url: INVITE_URL, template: { ...TEMPLATE, imageWidth: 600, imageHeight: 314 }, progress: { invited: 0, joined: 0, earnedMonths: 0 } }

export const fixturePorts = (q: URLSearchParams, g: { fx: string; onTrack: (e: TrackedEvent) => void }): Partial<ReferralInvitePanelProps> => {
  const a = mockAnalytics(q, { onTrack: g.onTrack })
  return { track: a.track }
}
