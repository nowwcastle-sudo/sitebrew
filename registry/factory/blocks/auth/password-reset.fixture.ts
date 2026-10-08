import { mockAnalytics, mockAuth, type TrackedEvent } from "@/registry/factory/contract/adapter-mock"

import type { AuthPasswordResetCopy, AuthPasswordResetProps } from "./password-reset"
import { EMAIL_ERRORS, SUBMIT_NOTICES } from "./sign-in.fixture"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 서비스 「모아플랜(예시)」 비밀번호 재설정. 문구는 해요체.
// 갤러리 포트: &submit=ok|field-error|server-error|pending(재설정 요청 결과).
const COPY: AuthPasswordResetCopy = {
  title: "비밀번호를 다시 만들어요",
  lead: "가입한 이메일로 재설정 링크를 보내 드려요(예시).",
  steps: [
    { title: "메일 받기", body: "아래에 가입한 이메일을 적으면 링크를 보내요." },
    { title: "링크 누르기", body: "메일의 링크는 30분 동안만 열려요(예시)." },
    { title: "새 비밀번호 만들기", body: "새 비밀번호로 바로 로그인돼요." },
  ],
  email: { label: "가입한 이메일", marker: "(필수)", placeholder: "name@example.com" },
  errors: { emailRequired: EMAIL_ERRORS.emailRequired, emailFormat: EMAIL_ERRORS.emailFormat },
  submit: "재설정 링크 받기",
  pending: "보내는 중",
  alert: { field: "이메일 주소를 확인해 주세요", server: "링크를 보내지 못했어요 — 잠시 뒤 다시 눌러 주세요" },
  notices: SUBMIT_NOTICES,
  sent: { title: "메일을 확인해 주세요", body: "가입된 이메일이라면 재설정 링크가 방금 도착했어요. 스팸함도 한번 봐 주세요(예시)." },
  resend: "메일이 안 왔어요 — 다시 보내기",
  resent: "링크를 한 번 더 보냈어요. 먼저 받은 링크는 더 쓸 수 없어요.",
  back: { label: "로그인으로 돌아가기", href: "#sign-in" },
}

export const fixture: AuthPasswordResetProps = { copy: COPY, requestPasswordReset: async () => ({ ok: true, data: { sent: true } }) }

export const fixtureMax: AuthPasswordResetProps = {
  ...fixture,
  copy: {
    ...COPY,
    title: "비밀번호를 다시 만들어요 — 일정은 그대로 남아 있어요(예시)",
    lead: "가입한 이메일로 재설정 링크를 보내 드려요. 소셜 계정(카카오·네이버·구글)으로 가입했다면 그 서비스에서 로그인하면 되고, 여기서 비밀번호를 만들 필요가 없어요(예시).",
    steps: [
      { title: "가입한 이메일로 메일 받기", body: "아래에 가입할 때 쓴 이메일을 적으면 재설정 링크를 보내요. 회사 메일은 도착까지 몇 분 걸릴 수 있어요." },
      { title: "메일의 링크 누르기", body: "링크는 30분 동안만 열리고, 한 번 누르면 다시 쓸 수 없어요(예시)." },
      { title: "새 비밀번호 만들기", body: "8자 이상으로 새로 만들면 모든 기기에서 로그아웃되고 새 비밀번호로 바로 로그인돼요." },
    ],
  },
}

export const fixtureMin: AuthPasswordResetProps = { ...fixture, copy: { ...COPY, lead: undefined, steps: COPY.steps.slice(0, 1) } }

export const fixturePorts = (q: URLSearchParams, g: { fx: string; onTrack: (e: TrackedEvent) => void }): Partial<AuthPasswordResetProps> => {
  const auth = mockAuth(q, { fieldErrors: { email: ["이메일 주소를 다시 확인해 주세요. 예: name@example.com"] }, formError: "이메일 주소를 확인해 주세요." })
  return { requestPasswordReset: auth.requestPasswordReset, track: mockAnalytics(q, { onTrack: g.onTrack }).track }
}
