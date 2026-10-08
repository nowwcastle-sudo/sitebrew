import { APPROVAL_HINT } from "@/registry/factory/contract/human-actions"
import { mockAuth, type TrackedEvent } from "@/registry/factory/contract/adapter-mock"

import { SUBMIT_NOTICES } from "../auth/sign-in.fixture"
import type { AccountCredentialsCopy, AccountCredentialsProps } from "./credentials"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 서비스 「모아플랜(예시)」 로그인 정보 바꾸기. 사용자는 목의 가상 인물(김예시·example.com).
// 갤러리 포트: ?auth=signed-in(기본)|signed-out · &state=loading|empty|error|ready(session 읽기) · &submit=(이메일·비밀번호 바꾸기 결과 — 목은 새 이메일 형식·현재/새 비밀번호를 검사한다).
const COPY: AccountCredentialsCopy = {
  humanHint: APPROVAL_HINT.ko,
  title: "로그인 정보",
  lead: "이메일과 비밀번호를 바꿔요. 바꾸려면 지금 비밀번호가 필요해요(예시).",
  email: {
    title: "이메일 바꾸기",
    current: "지금 이메일",
    newEmail: { label: "새 이메일", marker: "(필수)", hint: "확인 메일이 이 주소로 가요. 메일의 링크를 눌러야 바뀌어요.", required: "새 이메일 주소를 적어 주세요.", format: "이메일 주소 형식이 맞지 않아요. 예: name@example.com" },
    password: { label: "지금 비밀번호", marker: "(필수)", required: "지금 쓰는 비밀번호를 적어 주세요." },
    submit: "확인 메일 보내기",
    pending: "보내는 중",
    done: { title: "확인 메일을 보냈어요", body: "{email} 주소로 보낸 메일의 링크를 눌러야 이메일이 바뀌어요. 그때까지는 지금 이메일로 로그인해요." },
  },
  password: {
    title: "비밀번호 바꾸기",
    current: { label: "지금 비밀번호", marker: "(필수)", required: "지금 쓰는 비밀번호를 적어 주세요." },
    next: { label: "새 비밀번호", marker: "(필수)", hint: "8자 이상으로 적어 주세요.", required: "새 비밀번호를 적어 주세요.", short: "새 비밀번호는 8자 이상으로 적어 주세요." },
    revokeOthers: { label: "다른 기기에서도 로그아웃하기", marker: "(선택)", hint: "누군가 내 계정에 들어왔을까 걱정될 때 켜 주세요. 이 기기는 로그인된 채로 있어요." },
    submit: "비밀번호 바꾸기",
    pending: "바꾸는 중",
    done: { title: "비밀번호를 바꿨어요", body: "다음 로그인부터 새 비밀번호를 써요.", others: "다른 기기는 모두 로그아웃했어요." },
  },
  alert: { field: "확인이 필요한 칸이 있어요", server: "바꾸지 못했어요 — 적은 내용은 그대로예요" },
  notices: SUBMIT_NOTICES,
  empty: { title: "로그인이 필요해요", body: "로그인하면 로그인 정보를 바꿀 수 있어요.", label: "로그인하기", href: "#sign-in" },
  loading: "로그인 정보를 불러오는 중이에요",
  error: "로그인 정보를 불러오지 못했어요",
  retry: "다시 불러오기",
}

export const fixture: AccountCredentialsProps = {
  copy: COPY,
  session: async () => ({ ok: true, data: { userId: "user-example-1", name: "김예시", email: "kim@example.com", twoFactor: false } }),
}
export const fixtureMax: AccountCredentialsProps = {
  ...fixture,
  copy: {
    ...COPY,
    title: "로그인 정보 — 이메일과 비밀번호를 바꾸는 곳(예시)",
    lead: "이메일과 비밀번호를 바꿔요. 바꾸려면 지금 비밀번호가 필요하고, 이메일은 확인 메일의 링크를 눌러야 바뀌어요. 소셜 계정으로만 로그인하는 분은 비밀번호가 없어서 이 화면에서 바꿀 수 없어요(예시).",
    password: { ...COPY.password, revokeOthers: { ...COPY.password.revokeOthers, hint: "누군가 내 계정에 들어왔을까 걱정될 때 켜 주세요. 이 기기는 로그인된 채로 있고, 다른 기기와 휴대폰 앱은 다시 로그인해야 해요. 진행 중이던 작업은 저장된 곳까지만 남아요." } },
  },
}
// 최소: 이메일 구역만(비밀번호 메서드 없음), 머리말 없음
export const fixtureMin: AccountCredentialsProps = { ...fixture, copy: { ...COPY, lead: undefined } }

export const fixturePorts = (q: URLSearchParams, g: { fx: string; onTrack: (e: TrackedEvent) => void }): Partial<AccountCredentialsProps> => {
  const qq = new URLSearchParams(q)
  if (!qq.has("auth")) qq.set("auth", "signed-in")
  const auth = mockAuth(qq, { requireConfirmation: true })
  return g.fx === "min" ? { session: auth.session, changeEmail: auth.changeEmail } : { session: auth.session, changeEmail: auth.changeEmail, changePassword: auth.changePassword }
}
