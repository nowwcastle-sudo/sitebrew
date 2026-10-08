import { mockAuth, type TrackedEvent } from "@/registry/factory/contract/adapter-mock"

import { SUBMIT_NOTICES } from "../auth/sign-in.fixture"
import type { ConfirmationVerifyEmailCopy, ConfirmationVerifyEmailProps } from "./verify-email"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 서비스 「모아플랜(예시)」 가입 직후 이메일 확인 안내. 사용자는 목의 가상 인물(김예시·example.com).
// 갤러리 포트: ?auth=signed-in(기본 — 아직 확인 안 한 계정)|signed-out · &state=(session 읽기) · &submit=(다시 보내기 결과 — rate-limited&retryAfter=<초> 는 그 초 동안 버튼이 잠긴다).
// 「이미 확인한 계정」 화면은 갤러리 쿼리가 없어 규칙 검사(blocks-rules-7b — session 에 emailVerified: true)가 본다.
const COPY: ConfirmationVerifyEmailCopy = {
  title: "메일함을 열어 이메일을 확인해 주세요",
  body: "{email} 주소로 확인 메일을 보냈어요. 메일의 링크를 눌러야 가입이 끝나요.",
  steps: ["메일함을 열어 「이메일 주소 확인」 메일을 찾아요.", "메일 안의 「이메일 확인하기」 버튼을 눌러요."],
  spam: "메일이 안 보이면 스팸함이나 프로모션함을 먼저 살펴보세요. 그래도 없으면 아래에서 다시 보낼 수 있어요.",
  resend: { label: "인증 메일 다시 보내기", pending: "보내는 중", wait: "{seconds}초 뒤에 다시 보낼 수 있어요", sent: "확인 메일을 다시 보냈어요. 몇 분 안에 도착해요.", errorTitle: "메일을 보내지 못했어요 — 잠시 뒤 다시 눌러 주세요" },
  wrongAddress: { text: "주소가 잘못됐나요?", label: "이메일 바꾸기", href: "#settings-credentials" },
  verified: { title: "이메일 확인이 끝났어요", body: "이제 모든 기능을 쓸 수 있어요.", label: "시작하기", href: "#today" },
  notices: SUBMIT_NOTICES,
  empty: { title: "로그인이 필요해요", body: "로그인하면 확인 메일 상태를 볼 수 있어요.", label: "로그인하기", href: "#sign-in" },
  loading: "확인 메일 상태를 불러오는 중이에요",
  error: "확인 메일 상태를 불러오지 못했어요",
  retry: "다시 불러오기",
}

const SESSION = { userId: "user-example-1", name: "김예시", email: "kim@example.com", twoFactor: false }

export const fixture: ConfirmationVerifyEmailProps = { copy: COPY, session: async () => ({ ok: true, data: SESSION }), resendAfter: 60 }
export const fixtureMax: ConfirmationVerifyEmailProps = {
  ...fixture,
  copy: {
    ...COPY,
    title: "메일함을 열어 이메일을 확인해 주세요 — 링크를 눌러야 가입이 끝나요(예시)",
    body: "{email} 주소로 확인 메일을 보냈어요. 메일의 링크를 눌러야 가입이 끝나고, 링크는 24시간 동안만 쓸 수 있어요.",
    spam: "메일이 안 보이면 스팸함이나 프로모션함, 회사 메일이라면 보안 격리함까지 먼저 살펴보세요. 그래도 없으면 아래에서 다시 보낼 수 있어요. 다시 보내면 앞에 보낸 메일의 링크는 쓸 수 없어요(예시).",
  },
}
// 최소: 다시 보내기 메서드 없음(어댑터가 지원하지 않으면 버튼이 없다), 걸음 하나
export const fixtureMin: ConfirmationVerifyEmailProps = { ...fixture, copy: { ...COPY, steps: [COPY.steps[0]] } }

export const fixturePorts = (q: URLSearchParams, g: { fx: string; onTrack: (e: TrackedEvent) => void }): Partial<ConfirmationVerifyEmailProps> => {
  const qq = new URLSearchParams(q)
  if (!qq.has("auth")) qq.set("auth", "signed-in")
  const auth = mockAuth(qq, { session: { ...SESSION, emailVerified: false } })
  // 결과 상태(&submit=)를 잴 때는 대기 시간 없이 시작한다 — 60초 잠금 안에서는 다시 보내기 버튼을 눌러 볼 수 없다
  const hold = q.has("submit") ? { resendAfter: 0 } : {}
  // &initialWait=<초>: 쪽을 연 순간의 잠금만 바꾼다(REL12 — 0 이면 가입 직후가 아닌 쪽처럼 처음부터 풀려 있다). 없으면 예전 그대로
  const iw = q.get("initialWait")
  const first = iw !== null && iw !== "" && Number.isFinite(Number(iw)) ? { initialWait: Number(iw) } : {}
  return g.fx === "min" ? { session: auth.session } : { session: auth.session, sendVerificationEmail: auth.sendVerificationEmail, ...hold, ...first }
}
