// 인증 포트 적합성 묶음(항목 contract-conformance — P3-3 Task 15, J3). 장면은 로그인 전(signed-out)·로그인(signed-in)·오류(error).
// 목에서는 ?auth=signed-out · ?auth=signed-in · ?state=error 다. 실제 어댑터(Better Auth 등)는 make 가 그 장면의 새 포트를 돌려준다 —
// error 는 백엔드가 응답하지 않는 포트(샌드박스 주소를 막거나 녹화한 5xx)다.
import type { AuthMethod, AuthPort, ConsentInput, Session } from "@/registry/factory/contract/ports"
import { type ConformanceOptions, type ConformanceResult, confirmationProblem, runCheck, show } from "./conformance-core"

const isDate = (v: unknown) => typeof v === "string" && !Number.isNaN(Date.parse(v))

export const AUTH_SCENARIO_IDS = ["signed-out", "signed-in", "error"] as const
export type AuthScenarioId = (typeof AUTH_SCENARIO_IDS)[number]
export type MakeAuth = (setup: { auth: AuthScenarioId }) => AuthPort | Promise<AuthPort>

/** ports AuthMethod 와 같은 값 */
export const AUTH_METHODS: readonly AuthMethod[] = ["password", "kakao", "naver", "google", "magic-link"]

/** 적합성 검사가 쓰는 가상 계정(example.com — 실제로 보내지지 않는 주소) */
export const CONFORMANCE_EMAIL = "conformance@example.com"

/**
 * 인증 포트 적합성. make 는 장면마다 새 포트를 돌려준다
 * (목: `({ auth }) => auth === "error" ? mockAuth("?state=error") : mockAuth("?auth=" + auth)`).
 */
export async function authConformance(make: MakeAuth, options: ConformanceOptions = {}): Promise<ConformanceResult[]> {
  const out: ConformanceResult[] = []
  const check = async (id: string, body: () => Promise<string | null>) => out.push(await runCheck(id, body, options))

  await check("auth.signed-out.session", async () => {
    const r = await (await make({ auth: "signed-out" })).session()
    return r.ok && r.data === null ? null : `로그인 전 session() 은 { ok: true, data: null } 이어야 해요: ${show(r)}`
  })
  await check("auth.signed-out.methods", async () => {
    const r = await (await make({ auth: "signed-out" })).methods()
    if (!r.ok) return `methods() 실패: ${show(r)}`
    if (!r.data.length) return "로그인 방법이 하나도 없어요"
    const unknown = r.data.filter((m) => !AUTH_METHODS.includes(m))
    return unknown.length ? `모르는 로그인 방법: ${unknown.join(", ")}` : null
  })
  // 필수 동의(약관·개인정보)가 없으면 계정을 만들지 않고 두 칸 모두 필드 오류다(타입을 건너뛴 호출도)
  await check("auth.signed-out.signup-requires-consents", async () => {
    const port = await make({ auth: "signed-out" })
    const r = await port.signUp({ method: "password", email: CONFORMANCE_EMAIL, password: "conformance-Example-1", consents: {} as unknown as ConsentInput })
    if (r.ok) return "필수 동의 없이 가입이 성공했어요"
    const missing = (["terms", "privacy"] as const).filter((k) => !r.fieldErrors?.[k]?.length)
    if (missing.length) return `필드 오류가 없는 필수 동의: ${missing.join(", ")}`
    const s = await port.session()
    return s.ok && s.data === null ? null : `거절했는데 세션이 열렸어요: ${show(s)}`
  })
  // 비밀번호 재설정은 계정이 있든 없든 같은 결과다(가입 여부를 드러내지 않는다)
  await check("auth.signed-out.password-reset-no-enumeration", async () => {
    const r = await (await make({ auth: "signed-out" })).requestPasswordReset({ email: "conformance-no-account@example.com" })
    return r.ok && r.data.sent === true ? null : `없는 계정에도 { ok: true, data: { sent: true } } 여야 해요: ${show(r)}`
  })
  // 재설정 마무리 resetPassword 는 선택 메서드(D236) — 없는 어댑터는 이 둘을 통과로 본다. 있으면 모르는 토큰·빈 토큰으로는 비밀번호를 정할 수 없다
  await check("auth.signed-out.reset-password-unknown-token", async () => {
    const port = await make({ auth: "signed-out" })
    if (!port.resetPassword) return null
    const r = await port.resetPassword({ token: "conformance-not-a-real-token", newPassword: "conformance-Example-1" })
    if (r.ok) return "모르는 토큰으로 비밀번호가 바뀌었어요"
    return r.code === "invalid_token" ? null : `모르는 토큰은 code: "invalid_token" 으로 거절해야 해요: ${show(r)}`
  })
  await check("auth.signed-out.reset-password-empty-token", async () => {
    const port = await make({ auth: "signed-out" })
    if (!port.resetPassword) return null
    const r = await port.resetPassword({ token: "", newPassword: "conformance-Example-1" })
    return r.ok ? "빈 토큰으로 비밀번호가 바뀌었어요" : null
  })

  await check("auth.signed-in.session", async () => {
    const r = await (await make({ auth: "signed-in" })).session()
    if (!r.ok || !r.data) return `로그인 장면인데 세션이 없어요: ${show(r)}`
    if (typeof r.data.userId !== "string" || !r.data.userId) return `userId 가 비었어요: ${show(r.data)}`
    return typeof r.data.twoFactor === "boolean" ? null : `twoFactor 가 참/거짓이 아니에요: ${show(r.data.twoFactor)}`
  })
  await check("auth.signed-in.sign-out", async () => {
    const port = await make({ auth: "signed-in" })
    const r = await port.signOut()
    if (!r.ok) return `signOut() 실패: ${show(r)}`
    const s = await port.session()
    return s.ok && s.data === null ? null : `로그아웃 뒤에도 세션이 있어요: ${show(s)}`
  })

  // 오류 장면: 읽기는 거부(reject)하지 않고 다시 시도할 수 있는 실패로 끝난다(블록이 [다시 시도]를 그린다)
  await check("auth.error.session", async () => {
    const r = await (await make({ auth: "error" })).session()
    if (r.ok) return `오류 장면인데 session() 이 성공했어요: ${show(r)}`
    if (r.retryable !== true) return "오류가 retryable: true 가 아니에요"
    return typeof r.formError === "string" && r.formError.trim() ? null : "화면에 보일 formError 가 없어요"
  })

  // 승인 행동의 확인 입력(G11(d), P3-7 AXC — options.requireConfirmation 인 어댑터만). 선택 메서드가 없는 어댑터는 그 검사를 통과로 본다(resetPassword 와 같다).
  // ① 확인 없이 부르면 confirmation_required(retryable false)이고 세션·계정이 그대로 ② 확인과 함께 부르면 성공. 새 포트 하나로 이어서 — 거절이 상태를 건드렸다면 ② 가 달라진다.
  if (options.requireConfirmation) {
    const signedIn = async () => {
      const port = await make({ auth: "signed-in" })
      const s = await port.session()
      if (!s.ok || !s.data) throw new Error(`로그인 장면인데 세션이 없어요: ${show(s)}`)
      return { port, session: s.data }
    }
    const sameSession = async (port: AuthPort, before: Session): Promise<string | null> => {
      const s = await port.session()
      return s.ok && s.data && s.data.userId === before.userId && s.data.email === before.email ? null : `승인 대기인데 세션·계정이 바뀌었어요: ${show(s)}`
    }
    await check("auth.confirmation.change-email", async () => {
      const { port, session } = await signedIn()
      if (!port.changeEmail) return null
      const input = { newEmail: "conformance-new@example.com", currentPassword: "conformance-Example-1" }
      const refused = await port.changeEmail(input)
      const problem = confirmationProblem(refused) ?? (await sameSession(port, session))
      if (problem) return problem
      // 현재 비밀번호의 맞고 틀림은 공급자의 판단이다 — 확인 입력이 문 앞에서 막히지 않았다는 것만 본다
      const done = await port.changeEmail({ ...input, confirmed: true })
      return !done.ok && done.code === "confirmation_required" ? `확인과 함께 불렀는데 승인 대기로 끝났어요: ${show(done)}` : null
    })
    await check("auth.confirmation.delete-account", async () => {
      const { port, session } = await signedIn()
      if (!port.deleteAccount) return null
      const refused = await port.deleteAccount()
      const problem = confirmationProblem(refused) ?? (await sameSession(port, session))
      if (problem) return problem
      // 이메일이 있는 계정은 입력한 주소(confirmEmail)도 같이 — 화면이 사람에게서 받은 값이다
      const done = await port.deleteAccount({ confirmed: true, ...(session.email ? { confirmEmail: session.email } : {}) })
      if (!done.ok) return `확인과 함께 부르면 성공해야 해요: ${show(done)}`
      return isDate(done.data.graceUntil) ? null : `graceUntil 이 날짜가 아니에요: ${show(done.data)}`
    })
    await check("auth.confirmation.export-my-data", async () => {
      const { port, session } = await signedIn()
      if (!port.exportMyData) return null
      const refused = await port.exportMyData()
      const problem = confirmationProblem(refused) ?? (await sameSession(port, session))
      if (problem) return problem
      const done = await port.exportMyData({ confirmed: true })
      return done.ok && typeof done.data === "object" && done.data !== null ? null : `확인과 함께 부르면 데이터 객체가 와야 해요: ${show(done)}`
    })
  }
  return out
}
