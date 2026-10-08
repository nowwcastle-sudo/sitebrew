// mock 포트 조립(LFRUNNER — lib/ports.ts 에서 옮겼다). 장면(lib/mock-scene.ts)이 있으면 그 장면의 세션·구독으로, 없으면 기존 동작(로그아웃에서 시작, 구독은 LF_MOCK_SUB)으로 만든다.
// 서버·Next 없이 시험할 수 있게 next/headers·env 를 부르지 않는다(모드·쿠키 읽기는 lib/ports.ts 가 한다).
import { MOCK_SESSION, mockAuth, mockBilling } from "@/components/contract/adapter-mock"
import type { ActionResult } from "@/components/contract/block-contract"
import type { Session } from "@/components/contract/ports"
import type { ProductPorts } from "@/lib/ports"
import { MOCK_PLANS, MOCK_RETENTION_OFFERS } from "@/lib/mock-plans"
import type { MockScene } from "@/lib/mock-scene"

/** mock 사용자 이름은 제품 화면 언어(en)로 쓴다 — web-factory 목 어댑터의 기본 이름(한국어)이 영어 화면에 그려지면 qa:lang 이 잡는다(LFRUNFIX F6). mock 에서만 쓴다 */
export const MOCK_USER_NAME = "Alex Example"

/** 이미 가입된 이메일로 가입하는 장면(LFADB A02)을 mock 에서 걸어 볼 수 있게 하는 주소 — 이 주소로 가입하면 live 어댑터처럼 code `email_exists` 로 거절한다. example.com 은 예약 도메인이다 */
export const MOCK_TAKEN_EMAIL = "taken@example.com"
/** 결제 실패(past_due) 장면의 접근 중지일(graceEndsAt)까지 남은 날 — live 어댑터는 실패 시각 + 유예(기본 7일)를 준다. mock 은 오늘 + 5일 */
const MOCK_GRACE_DAYS = 5

export interface MockPortsInput {
  /** 장면. null = 장면 없음(기존 동작) */
  scene: MockScene | null
  /** 장면이 구독을 정하지 않을 때의 상태(앱 기본값 — LF_MOCK_SUB 또는 active) */
  defaultSub: string
  /** 계정 화면에서 저장한 이름(mock 전용) — 세션에 덮어 보인다. live 는 Better Auth 가 이름을 저장한다 */
  getName: () => string | undefined
}

/** 목 포트 한 벌. 장면이 없으면 프로세스 하나에 쓰는 것을 전제로 하고(로그인이 요청 사이에 이어진다), 장면이 있으면 요청마다 새로 만들어 장면이 늘 같은 처음 상태다 */
export function buildMockPorts({ scene, defaultSub, getName }: MockPortsInput): ProductPorts {
  // 장면이 없는 기본 mock 도 로그인하면 이 이름을 보인다(F6) — 세션은 늘 넘긴다
  const session: Session = { ...MOCK_SESSION, name: MOCK_USER_NAME, ...(scene?.signedIn ? { emailVerified: scene.verified } : {}) }
  const base = mockAuth(scene?.signedIn ? "auth=signed-in" : "", { requireAgeOver14: true, session })
  const resend = base.sendVerificationEmail!.bind(base)
  const baseSession = base.session.bind(base)
  const baseSignUp = base.signUp.bind(base)
  const auth = Object.assign(base, {
    // 계정 화면에서 저장한 이름을 세션에 덮어 보인다
    session: async () => {
      const r = await baseSession()
      const name = getName()
      return r.ok && r.data && name !== undefined ? { ...r, data: { ...r.data, name } } : r
    },
    // 목에도 확인 메일 다시 보내기가 있다(로그인한 상태에서만 — 가입 직후는 로그인돼 있다)
    sendVerificationEmail: (input?: { redirectTo?: string }) => resend(input),
    // 이미 가입된 이메일: live 어댑터(packages/auth)와 같은 모양으로 거절한다 — 칸 오류 + code email_exists(가입 블록이 로그인·비밀번호 찾기 링크를 붙인다)
    signUp: (async (input: Parameters<typeof baseSignUp>[0]) =>
      input.method === "password" && typeof input.email === "string" && input.email.trim().toLowerCase() === MOCK_TAKEN_EMAIL
        ? { ok: false as const, fieldErrors: { email: ["An account with this email already exists."] }, retryable: false, code: "email_exists" }
        : baseSignUp(input)) as typeof baseSignUp,
    // 목에는 재설정 완료가 없다 — 토큰이 "invalid" 면 live 어댑터처럼 code invalid_token(블록이 만료 안내로 바꾼다), 아니면 성공(시험용)
    resetPassword: async ({ token }: { token: string; newPassword: string }): Promise<ActionResult<Record<string, never>>> => (token === "invalid" ? { ok: false, formError: "This reset link has expired or was already used. Ask for a new one.", retryable: false, code: "invalid_token" } : { ok: true, data: {} }),
  })
  // 구독 상태: 장면 > LF_MOCK_SUB(mock 전용: none·trialing·active·past_due·paused·canceled·expired) > active
  const sub = scene?.sub ?? defaultSub
  // 결제 실패(past_due)에는 접근이 멈추는 날을 더한다(목의 past_due 에는 없다 — live 는 늘 준다) — 결제 실패 띠·결제 관리가 마감일을 보인다(F02)
  const grace = sub === "past_due" ? { subscription: { graceEndsAt: new Date(Date.now() + MOCK_GRACE_DAYS * 86_400_000).toISOString() } } : {}
  const billing = mockBilling(`sub=${sub}`, { requireWithdrawalConsent: true, plans: MOCK_PLANS, retentionOffers: MOCK_RETENTION_OFFERS, ...grace })
  // 결제 창이 없는 mock 에서는 지금 구독을 그대로 돌려준다(/billing/return 화면 시험용)
  // 영수증 주소(E09)는 live 에서는 공급자 고객 기록에서 읽고, mock 에서는 목 사용자의 주소다
  const syncCheckout = async () => {
    const r = await billing.subscription()
    return r.ok && r.data.status !== "none" && session.email ? { ...r, data: { ...r.data, receiptEmail: session.email } } : r
  }
  return { auth, billing: Object.assign(billing, { syncCheckout }) }
}
