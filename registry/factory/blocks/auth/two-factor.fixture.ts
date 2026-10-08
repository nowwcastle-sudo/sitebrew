import { mockAnalytics, mockAuth, type TrackedEvent } from "@/registry/factory/contract/adapter-mock"

import type { AuthTwoFactorCopy, AuthTwoFactorProps } from "./two-factor"
import { SUBMIT_NOTICES } from "./sign-in.fixture"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 서비스 「모아플랜(예시)」의 2단계 인증. 문구는 해요체.
// 갤러리 포트: 인증 목을 ?auth=two-factor 로 만들고 비밀번호 로그인을 먼저 해 두어(코드 확인 대기) verifyTwoFactor 가 실제로 돈다.
// 6자리 숫자면 통과, 아니면 코드 칸 오류. &submit=field-error|server-error|pending 은 목이 그 결과를 준다.
const COPY: AuthTwoFactorCopy = {
  title: "인증 코드를 적어 주세요",
  lead: "인증 앱(예시)에 뜬 6자리 숫자를 적으면 로그인이 끝나요.",
  code: { label: "인증 코드 6자리", marker: "(필수)", hint: "30초마다 바뀌어요. 바뀌기 전에 적어 주세요." },
  backup: { label: "백업 코드", marker: "(필수)", hint: "가입할 때 받아 둔 10자리 코드 중 하나예요. 한 번 쓴 코드는 다시 못 써요." },
  useBackup: "휴대폰이 없어요 — 백업 코드로 인증하기",
  useCode: "인증 앱 코드로 인증하기",
  trust: { label: "이 기기에서 30일 동안 묻지 않기", hint: "여럿이 쓰는 컴퓨터라면 켜지 마세요." },
  errors: { codeRequired: "인증 코드를 적어 주세요.", codeFormat: "코드는 숫자 6자리예요. 앱에 뜬 숫자를 그대로 적어 주세요.", backupRequired: "백업 코드를 적어 주세요." },
  submit: "인증하고 로그인하기",
  pending: "확인하는 중",
  alert: { field: "코드를 다시 확인해 주세요", server: "인증하지 못했어요 — 잠시 뒤 다시 눌러 주세요" },
  notices: SUBMIT_NOTICES,
  help: { label: "인증 앱도 백업 코드도 없나요? 도움 받기", href: "#help-2fa" },
  done: { title: "인증했어요", body: "로그인이 끝났어요. 오늘 일정으로 이동할게요(예시).", label: "오늘 일정 보기", href: "#today" },
}

export const fixture: AuthTwoFactorProps = { copy: COPY, verifyTwoFactor: async () => ({ ok: true, data: { userId: "user-example-1", twoFactor: true } }) }

export const fixtureMax: AuthTwoFactorProps = {
  ...fixture,
  copy: {
    ...COPY,
    title: "인증 코드를 적어 주세요 — 계정을 지키는 마지막 단계예요(예시)",
    lead: "인증 앱(예시)에 뜬 6자리 숫자를 적으면 로그인이 끝나요. 코드는 30초마다 바뀌니, 숫자가 곧 바뀔 것 같으면 새 코드가 뜰 때까지 기다렸다 적어 주세요.",
    trust: { label: "이 기기에서 30일 동안 2단계 인증을 묻지 않기", hint: "회사·학교·PC방처럼 여럿이 쓰는 컴퓨터라면 켜지 마세요. 켠 기기는 설정 > 보안에서 언제든 지울 수 있어요." },
  },
}

export const fixtureMin: AuthTwoFactorProps = { ...fixture, copy: { ...COPY, lead: undefined, help: undefined, trust: { label: COPY.trust.label } } }

export const fixturePorts = (q: URLSearchParams, g: { fx: string; onTrack: (e: TrackedEvent) => void }): Partial<AuthTwoFactorProps> => {
  const qq = new URLSearchParams(q)
  if (!qq.has("auth")) qq.set("auth", "two-factor")
  const auth = mockAuth(qq, { fieldErrors: { code: ["코드가 맞지 않아요. 앱에 뜬 새 코드를 적어 주세요."] }, formError: "코드를 다시 확인해 주세요." })
  // 코드 확인 대기로 만든다(비밀번호 로그인이 needsTwoFactor 를 돌려준다) — 예시 계정이라 값은 가짜다
  void auth.signIn({ method: "password", email: "kim@example.com", password: "example-password" })
  return { verifyTwoFactor: auth.verifyTwoFactor, track: mockAnalytics(q, { onTrack: g.onTrack }).track }
}
