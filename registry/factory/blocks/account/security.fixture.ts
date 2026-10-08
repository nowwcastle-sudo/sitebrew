import { APPROVAL_HINT } from "@/registry/factory/contract/human-actions"
import { mockAuth, type TrackedEvent } from "@/registry/factory/contract/adapter-mock"

import { SUBMIT_NOTICES } from "../auth/sign-in.fixture"
import type { AccountSecurityCopy, AccountSecurityProps } from "./security"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 서비스 「모아플랜(예시)」 계정 보안. 사용자는 목의 가상 인물(김예시·example.com), 기기는 목의 가상 기기 둘.
// 갤러리 포트: ?auth=signed-in(기본)|signed-out · &state=loading|empty|error|ready(session·listSessions 읽기) · &submit=(끊기·2단계 쓰기 결과).
// 2단계 켜기는 비밀번호 아무 글자 → 설정 키·백업 코드 → 6자리 숫자 코드(목이 받는다)를 거친다.
const COPY: AccountSecurityCopy = {
  humanHint: APPROVAL_HINT.ko,
  title: "보안",
  lead: "로그인된 기기를 살피고 2단계 인증을 켜서 계정을 지켜요(예시).",
  sessions: {
    title: "로그인된 기기",
    body: "모르는 기기가 보이면 바로 로그아웃하고 비밀번호를 바꿔 주세요.",
    current: "이 기기",
    lastActive: "마지막 사용 {date}",
    signedIn: "로그인 {date}",
    revoke: "로그아웃",
    revokeLabel: "{device} 기기 로그아웃",
    revokeOthers: "다른 기기 모두 로그아웃",
    pending: "로그아웃하는 중",
    revokedOne: "{device} 기기를 로그아웃했어요",
    revokedOthers: "다른 기기 {n}곳에서 로그아웃했어요",
    empty: "로그인된 기기가 없어요",
    errorTitle: "로그아웃하지 못했어요 — 목록은 그대로예요",
  },
  twoFactor: {
    title: "2단계 인증",
    on: "켜져 있어요",
    off: "꺼져 있어요",
    bodyOn: "로그인할 때 비밀번호 말고 인증 앱의 6자리 코드를 한 번 더 확인해요.",
    bodyOff: "켜면 비밀번호가 새어 나가도 다른 사람이 로그인하지 못해요. 인증 앱이 필요해요.",
    enable: "2단계 인증 켜기",
    disable: "2단계 인증 끄기",
    password: { label: "비밀번호", marker: "(필수)", hint: "지금 쓰는 비밀번호로 본인인지 확인해요.", required: "비밀번호를 적어 주세요." },
    cancel: "취소",
    continueEnable: "다음으로",
    continueDisable: "2단계 인증 끄기",
    pending: "확인하는 중",
    setupTitle: "인증 앱에 등록하기",
    setupBody: "인증 앱에서 「키 직접 입력」을 고르고 아래 설정 키를 적어 주세요. 스마트폰이면 링크를 눌러 바로 열 수도 있어요.",
    keyLabel: "설정 키",
    openApp: "인증 앱에서 열기",
    backupTitle: "백업 코드",
    backupBody: "휴대폰을 잃어버렸을 때 한 번씩 쓸 수 있는 코드예요. 지금만 보여 드리니 안전한 곳에 적어 두세요.",
    code: { label: "인증 앱의 6자리 코드", marker: "(필수)", hint: "코드가 맞으면 2단계 인증이 켜져요.", required: "6자리 코드를 적어 주세요.", format: "숫자 6자리로 적어 주세요. 예: 123456" },
    verify: "확인하고 켜기",
    verifying: "확인하는 중",
    enabled: "2단계 인증을 켰어요",
    disabled: "2단계 인증을 껐어요",
    errorTitle: "2단계 인증을 바꾸지 못했어요",
  },
  notices: SUBMIT_NOTICES,
  empty: { title: "로그인이 필요해요", body: "로그인하면 보안 설정을 볼 수 있어요.", label: "로그인하기", href: "#sign-in" },
  loading: "보안 설정을 불러오는 중이에요",
  error: "보안 설정을 불러오지 못했어요",
  retry: "다시 불러오기",
}

export const fixture: AccountSecurityProps = { copy: COPY, session: async () => ({ ok: true, data: { userId: "user-example-1", name: "김예시", email: "kim@example.com", twoFactor: false } }) }

export const fixtureMax: AccountSecurityProps = {
  ...fixture,
  copy: {
    ...COPY,
    title: "보안 — 로그인된 기기 관리와 2단계 인증 설정(예시)",
    lead: "로그인된 기기를 살피고 모르는 기기는 바로 로그아웃하세요. 2단계 인증을 켜면 비밀번호가 새어 나가도 계정을 지킬 수 있어요. 회사 계정은 관리자가 정한 보안 정책이 우선이에요(예시).",
    sessions: { ...COPY.sessions, body: "모르는 기기가 보이면 바로 로그아웃하고 비밀번호를 바꿔 주세요. 기기 이름은 브라우저와 운영체제로 짐작한 값이라 실제와 조금 다를 수 있고, IP 주소는 끝자리를 가려서 보여 줘요(예시)." },
  },
}
// 최소: 기기 목록만(2단계 메서드 없음 — 어댑터가 지원하지 않으면 그 구역이 나오지 않는다), 머리말 없음
export const fixtureMin: AccountSecurityProps = { ...fixture, copy: { ...COPY, lead: undefined } }

export const fixturePorts = (q: URLSearchParams, g: { fx: string; onTrack: (e: TrackedEvent) => void }): Partial<AccountSecurityProps> => {
  const qq = new URLSearchParams(q)
  if (!qq.has("auth")) qq.set("auth", "signed-in")
  const auth = mockAuth(qq)
  const base = { session: auth.session, listSessions: auth.listSessions, revokeSession: auth.revokeSession, revokeOtherSessions: auth.revokeOtherSessions }
  // min: 기기 구역만 — 2단계 메서드를 주지 않는다
  return g.fx === "min" ? base : { ...base, enableTwoFactor: auth.enableTwoFactor, disableTwoFactor: auth.disableTwoFactor, verifyTwoFactor: auth.verifyTwoFactor }
}
