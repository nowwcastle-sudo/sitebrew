import { APPROVAL_HINT } from "@/registry/factory/contract/human-actions"
import { MOCK_RESET_TOKEN, mockAnalytics, mockAuth, type TrackedEvent } from "@/registry/factory/contract/adapter-mock"

import type { AuthNewPasswordProps, AuthNewPasswordTwoFieldCopy } from "./new-password"
import { SUBMIT_NOTICES } from "./sign-in.fixture"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 서비스 「모아플랜(예시)」 새 비밀번호 정하기(재설정 메일 링크가 돌려보내는 쪽). 문구는 해요체.
// 최소(fx=min)는 한 칸 판이다. 갤러리 포트: &submit=ok|field-error|server-error|pending(재설정 결과) · &token=(주소의 ?token= — 안 주면 목의 가상 토큰, 빈 값이면 틀린 링크 안내, 그 밖의 값은 포트가 invalid_token 으로 거절).
const COPY: AuthNewPasswordTwoFieldCopy = {
  humanHint: APPROVAL_HINT.ko,
  title: "새 비밀번호를 만들어요",
  lead: "메일의 링크로 들어오셨어요. 새 비밀번호를 정하면 바로 로그인할 수 있어요(예시).",
  newPassword: { label: "새 비밀번호", marker: "(필수)", hint: "8자 이상으로 적어 주세요.", show: "비밀번호 보기", capsLock: "Caps Lock 이 켜져 있어요" },
  confirm: { label: "새 비밀번호 한 번 더", marker: "(필수)" },
  errors: { required: "비밀번호를 적어 주세요.", short: "새 비밀번호는 8자 이상으로 적어 주세요.", weak: "너무 흔한 비밀번호예요. 다른 단어나 문장으로 8자 이상 만들어 주세요.", mismatch: "두 칸의 비밀번호가 달라요. 같은 비밀번호를 한 번 더 적어 주세요." },
  submit: "비밀번호 바꾸기",
  pending: "바꾸는 중",
  alert: { field: "확인이 필요한 칸이 있어요", server: "비밀번호를 바꾸지 못했어요 — 잠시 뒤 다시 눌러 주세요" },
  notices: SUBMIT_NOTICES,
  done: { title: "비밀번호를 바꿨어요", body: "이제 새 비밀번호로 로그인할 수 있어요(예시).", next: { label: "로그인하기", href: "#sign-in" } },
  invalid: { title: "이 링크는 더 열리지 않아요", body: "링크가 만료됐거나 이미 썼어요. 재설정 링크를 다시 받아 주세요. 새 링크는 30분 동안 열려요(예시).", retry: { label: "재설정 링크 다시 받기", href: "#password-reset" } },
}

// 예시 거르개 — 앱은 여기서 흔한·유출 비밀번호 목록(예: 상위 N만 개)을 대조한다. 갤러리는 아주 짧은 목록만 쓴다
const COMMON = new Set(["password", "password1", "12345678", "123456789", "qwerty123", "11111111", "iloveyou"])
export const isCommonPassword = (pw: string) => COMMON.has(pw.toLowerCase())

export const fixture: AuthNewPasswordProps = { copy: COPY, isWeakPassword: isCommonPassword, token: MOCK_RESET_TOKEN, resetPassword: async () => ({ ok: true, data: {} }) }

export const fixtureMax: AuthNewPasswordProps = {
  ...fixture,
  copy: {
    ...COPY,
    title: "새 비밀번호를 만들어요 — 일정은 그대로 남아 있어요(예시)",
    lead: "메일의 링크로 들어오셨어요. 새 비밀번호를 정하면 모든 기기에서 로그아웃되고, 새 비밀번호로 바로 로그인할 수 있어요. 소셜 계정으로 가입했다면 그 서비스에서 로그인하면 되고 여기서 비밀번호를 만들 필요가 없어요(예시).",
    newPassword: { ...COPY.newPassword, hint: "8자 이상으로 적어 주세요. 다른 서비스에서 쓰는 비밀번호는 피해 주세요 — 한 곳이 새면 다른 곳도 위험해져요(예시)." },
  },
}

// 최소: 한 칸 판(confirmField: false — 「한 번 더」 칸 없음, 운영자 결정 2026-10-03). 한 번 더 칸이 없는 대신 「비밀번호 보기」 토글이 반드시 있다
export const fixtureMin: AuthNewPasswordProps = {
  ...fixture,
  confirmField: false,
  copy: { ...COPY, lead: undefined, newPassword: { label: COPY.newPassword.label, marker: COPY.newPassword.marker, hint: COPY.newPassword.hint, show: "비밀번호 보기" } },
}


export const fixturePorts = (q: URLSearchParams, g: { fx: string; onTrack: (e: TrackedEvent) => void }): Partial<AuthNewPasswordProps> => {
  const auth = mockAuth(q, { fieldErrors: { newPassword: ["새 비밀번호는 8자 이상으로 적어 주세요."] }, formError: "비밀번호를 바꾸지 못했어요. 잠시 뒤 다시 눌러 주세요." })
  return { resetPassword: auth.resetPassword, token: q.has("token") ? q.get("token") ?? "" : MOCK_RESET_TOKEN, track: mockAnalytics(q, { onTrack: g.onTrack }).track }
}
