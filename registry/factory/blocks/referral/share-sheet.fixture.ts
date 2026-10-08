import { mockAnalytics, type TrackedEvent } from "@/registry/factory/contract/adapter-mock"

import { INVITE_URL, LINK_COPY, TEMPLATE } from "./invite-panel.fixture"
import type { ReferralShareSheetCopy, ReferralShareSheetProps } from "./share-sheet"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 동네 빵집 「밀가루공방(예시)」 신메뉴 소식 공유 — 채운 글과 채널.
const COPY: ReferralShareSheetCopy = {
  title: "이 소식을 친구에게 보내요",
  lead: "보낼 글은 아래처럼 채워져 있어요. 채널을 고르면 바로 보낼 수 있어요.",
  previewLabel: "보낼 글 미리 보기",
  message: "밀가루공방(예시)에 무화과 깜파뉴가 새로 나왔대요. 같이 가 볼래요? {link}",
  channelsLabel: "보낼 곳",
  kakao: "카카오톡으로 보내기",
  kakaoFallback: "카카오톡을 열 수 없어 링크를 복사했어요. 채팅방에 붙여 넣어 주세요.",
  sms: "문자로 보내기",
  email: { label: "메일로 보내기", subject: "밀가루공방(예시) 신메뉴 소식" },
  native: "다른 앱으로 보내기",
  link: LINK_COPY,
}

export const fixture: ReferralShareSheetProps = { copy: COPY, url: INVITE_URL, template: TEMPLATE }

export const fixtureMax: ReferralShareSheetProps = {
  copy: {
    ...COPY,
    title: "이 소식을 친구에게 보내요 — 보낼 글은 채워 두었고 채널만 고르면 돼요",
    message: "밀가루공방(예시)에 무화과 깜파뉴가 새로 나왔대요. 국산 밀로 48시간 발효한 반죽이라 속이 쫄깃하대요. 이번 주말 오후 2시에 두 번째로 구워 나온다니까 같이 가 볼래요? {link}",
  },
  url: "https://example.com/news/fig-campagne-2026-autumn-special-weekend-bake",
  template: TEMPLATE,
}

// 카카오 템플릿 이미지가 http 라 규격 밖 — 카카오 버튼 없이 문자·메일·링크만
export const fixtureMin: ReferralShareSheetProps = { copy: { ...COPY, lead: undefined }, url: INVITE_URL, template: { ...TEMPLATE, imageUrl: "http://example.com/og.png" } }

export const fixturePorts = (q: URLSearchParams, g: { fx: string; onTrack: (e: TrackedEvent) => void }): Partial<ReferralShareSheetProps> => {
  const a = mockAnalytics(q, { onTrack: g.onTrack })
  return { track: a.track }
}
