// 서버 액션 몸통(v0 Task 4). 이 패키지는 Next를 불러오지 않는다 — 템플릿의 "use server" 파일이 감싼다(Task 10):
//   "use server"; export const signIn = async (f: FormData) => authActions(await authPort()).signIn(f)
// 서버 액션은 누구나 부를 수 있는 공개 입구다. 폼(FormData)·객체 어느 쪽이든 모양을 먼저 검사하고 포트로 넘긴다.
import { z } from "zod"
import type { ActionResult } from "@launch-factory/contract"
import type { Locale } from "@launch-factory/i18n"
import { coded, confirmEmailMismatchResult, confirmEmailOk, requireConfirmation, signInRequiredResult } from "@launch-factory/security/action"
import { authMessages, type LaunchAuthPort } from "./adapter.ts"
import type { LaunchConsentInput } from "./consents.ts"

const METHODS = ["password", "kakao", "naver", "google", "magic-link"] as const
const text = z.string().trim().max(320).optional()
/** 폼 체크박스는 "on", 객체는 true */
const checked = z.union([z.literal(true), z.literal("on"), z.literal("true")]).transform(() => true as const)
const flag = z.union([z.boolean(), z.literal("on"), z.literal("true")]).transform((v) => v !== false).optional()

/** 돌아갈 곳은 여기서 모양만 본다 — 같은 출처인지는 어댑터의 safeRedirect 가 판정한다 */
const redirectTo = z.string().max(2048).optional()
const signInSchema = z.object({ method: z.enum(METHODS), email: text, password: z.string().max(1024).optional(), rememberMe: flag, redirectTo })
const signUpSchema = signInSchema.extend({
  name: text,
  // D74: 브라우저가 숨은 칸으로 보낸다(Intl.DateTimeFormat().resolvedOptions().timeZone). 틀린 값은 서버 훅이 버린다
  locale: z.string().max(64).optional(),
  timeZone: z.string().max(64).optional(),
  consents: z.object({ terms: z.unknown(), privacy: z.unknown(), ageOver14: z.unknown(), marketing: z.object({ email: flag, sms: flag, kakao: flag, push: flag }).partial().optional() }).partial().optional(),
  // Turnstile 위젯이 폼에 넣는 숨은 입력(createAuth botCheck, v0 Task 15)
  "cf-turnstile-response": z.string().max(2048).optional(),
})
const twoFactorSchema = z.object({ code: z.string().trim().min(1).max(64), method: z.enum(["totp", "backup-code"]).optional(), trustDevice: flag, redirectTo })
const secret = z.string().min(1).max(1024)
const resetPasswordSchema = z.object({ token: z.string().trim().min(1).max(512), newPassword: z.string().min(1).max(1024) })
const changePasswordSchema = z.object({ currentPassword: secret, newPassword: secret, revokeOtherSessions: flag })
const changeEmailSchema = z.object({ newEmail: z.string().trim().min(3).max(320), currentPassword: z.string().max(1024).optional(), redirectTo })
const redirectOnlySchema = z.object({ redirectTo })
const revokeSessionSchema = z.object({ sessionId: z.string().trim().min(1).max(128) })
/** 빈 문자열은 「지우기」(null) */
const pref = z.string().trim().max(64).transform((v) => (v === "" ? null : v)).nullable().optional()
const preferencesSchema = z.object({ locale: pref, timeZone: pref })
/** 이름은 칸 하나, 80자 이하(빈 칸은 지우기) */
const profileSchema = z.object({ name: z.string().trim().max(80) })

/** FormData → 객체. 점 표기 이름(consents.terms)은 중첩으로 편다 */
export function formToObject(input: unknown): unknown {
  if (!(input instanceof FormData)) return input
  const out: Record<string, unknown> = {}
  for (const [key, value] of input.entries()) {
    if (typeof value !== "string") continue
    const parts = key.split(".")
    // 공개 입구다: `__proto__.x` 같은 이름이 Object.prototype 을 더럽히지 못하게 한다.
    if (parts.some((p) => p === "__proto__" || p === "constructor" || p === "prototype")) continue
    let node = out
    for (const p of parts.slice(0, -1)) {
      if (typeof node[p] !== "object" || node[p] === null) node[p] = {}
      node = node[p] as Record<string, unknown>
    }
    node[parts[parts.length - 1]] = value
  }
  return out
}

function invalid(error: z.ZodError, locale?: Locale): ActionResult<never> {
  const fieldErrors: Record<string, string[]> = {}
  for (const issue of error.issues) fieldErrors[String(issue.path[0] ?? "form")] = [authMessages(locale).required]
  return { ok: false, fieldErrors }
}

/** locale: 폼 모양 오류의 문구 언어(포트의 locale 과 맞춘다) */
export function authActions(port: LaunchAuthPort, { locale }: { locale?: Locale } = {}) {
  const invalidIn = (e: z.ZodError) => invalid(e, locale)
  return codedActions(locale, {
    async signIn(input: unknown) {
      const p = signInSchema.safeParse(formToObject(input))
      // 「로그인 유지」 체크박스: 폼에서 빠지면 체크하지 않은 것이다 → 브라우저를 닫으면 끝나는 세션
      return p.success ? port.signIn({ ...p.data, rememberMe: p.data.rememberMe === true }) : invalidIn(p.error)
    },
    async signUp(input: unknown) {
      const p = signUpSchema.safeParse(formToObject(input))
      if (!p.success) return invalidIn(p.error)
      const c = p.data.consents ?? {}
      // 필수 동의(약관·개인정보·만 14세 확인 consents.ageOver14)는 체크된 것만 true 로 바꾼다. 아니면 그대로 넘겨 포트가 terms·privacy 필드 오류를 낸다.
      const consents = {
        terms: checked.safeParse(c.terms).success ? true : c.terms,
        privacy: checked.safeParse(c.privacy).success ? true : c.privacy,
        ageOver14: checked.safeParse(c.ageOver14).success ? true : c.ageOver14,
        marketing: c.marketing,
      } as LaunchConsentInput
      const { "cf-turnstile-response": turnstileToken, ...fields } = p.data
      return port.signUp({ ...fields, consents, ...(turnstileToken ? { turnstileToken } : {}) })
    },
    // LFFIX F4: 재설정 메일 링크의 토큰으로 새 비밀번호를 정한다(공개 입구 — 모양을 먼저 본다. 로그인이 없어도 부른다)
    async resetPassword(input: unknown) {
      const p = resetPasswordSchema.safeParse(formToObject(input))
      return p.success ? port.resetPassword(p.data) : invalidIn(p.error)
    },
    signOut: () => port.signOut(),
    async verifyTwoFactor(input: unknown) {
      const p = twoFactorSchema.safeParse(formToObject(input))
      return p.success ? port.verifyTwoFactor(p.data) : invalidIn(p.error)
    },
    // ── Task 19 계정 편의(D70~D74). 모두 로그인한 사용자 자신에게만 작용한다(세션 쿠키) — 대상 사용자 id 를 입력으로 받지 않는다 ──
    async changePassword(input: unknown) {
      const p = changePasswordSchema.safeParse(formToObject(input))
      // 「다른 기기 로그아웃」 체크박스: 폼에서 빠지면 체크하지 않은 것
      return p.success ? port.changePassword({ ...p.data, revokeOtherSessions: p.data.revokeOtherSessions === true }) : invalidIn(p.error)
    },
    // LFAX M03: 이메일 바꾸기는 사람이 확인한 뒤에만(confirmed: true)
    async changeEmail(input: unknown) {
      const c = requireConfirmation(input, locale)
      if (!c.ok) return c.failure
      const p = changeEmailSchema.safeParse(c.rest)
      return p.success ? port.changeEmail(p.data) : invalidIn(p.error)
    },
    async sendVerificationEmail(input?: unknown) {
      const p = redirectOnlySchema.safeParse(formToObject(input ?? {}))
      return p.success ? port.sendVerificationEmail(p.data) : invalidIn(p.error)
    },
    listSessions: () => port.listSessions(),
    async revokeSession(input: unknown) {
      const p = revokeSessionSchema.safeParse(formToObject(input))
      return p.success ? port.revokeSession(p.data) : invalidIn(p.error)
    },
    revokeOtherSessions: () => port.revokeOtherSessions(),
    async updatePreferences(input: unknown) {
      const p = preferencesSchema.safeParse(formToObject(input))
      return p.success ? port.updatePreferences(p.data) : invalidIn(p.error)
    },
    async updateProfile(input: unknown) {
      const p = profileSchema.safeParse(formToObject(input))
      return p.success ? port.updateProfile(p.data) : invalidIn(p.error)
    },
    // LFAX M03: 사람이 확인한 뒤에만 실행한다(confirmed: true). 없으면 포트를 부르지 않는다
    async deleteAccount(input?: unknown) {
      const c = requireConfirmation(input, locale)
      if (!c.ok) return c.failure
      // 입력 확인(DESIGN §7-B): 화면이 이메일 주소를 그대로 입력받는다 — 서버도 같은 값을 본다(화면을 건너뛴 호출 대비). 이메일 없는 계정(카카오 등)은 확인 칸이 없다
      const me = await port.session()
      if (!me.ok) return me
      if (!me.data) return signInRequiredResult(locale)
      if (!confirmEmailOk(c.confirmEmail, me.data.email)) return confirmEmailMismatchResult(locale)
      return port.deleteAccount()
    },
    async exportMyData(input?: unknown) {
      const c = requireConfirmation(input, locale)
      return c.ok ? port.exportMyData() : c.failure
    },
  })
}

/** 모든 액션 결과가 code·retryable 을 갖고 나가게 한다(LFAX M04) */
function codedActions<T extends Record<string, (...args: never[]) => Promise<{ ok: boolean }>>>(locale: Locale | undefined, actions: T): T {
  return Object.fromEntries(Object.entries(actions).map(([k, f]) => [k, coded(f as (...a: unknown[]) => Promise<{ ok: boolean }>, locale)])) as unknown as T
}
