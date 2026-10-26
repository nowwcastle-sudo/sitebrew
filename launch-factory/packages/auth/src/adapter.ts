// AuthPort 어댑터(v0 Task 4). 모든 호출은 auth.handler(Request) 로 간다 — 요청 제한(DB 저장)·출처 검사·쿠키가
// 브라우저에서 온 요청과 똑같이 걸린다. auth.api.* 를 직접 부르면 요청 제한을 건너뛴다(Better Auth 1.7.6 router onRequest).
import type { DeletionRequestResult, MyData } from "@launch-factory/account-lifecycle"
import type { ActionResult, AuthMethod, AuthPort, IsoDate, Session } from "@launch-factory/contract"
import { DEFAULT_LOCALE, fill, messages, type Locale, type Messages } from "@launch-factory/i18n"
import { isPlaceholderEmail, LAST_METHOD_COOKIE, SOCIAL_PROVIDERS, TURNSTILE_BODY_FIELD, type LaunchAuthSettings, type SocialProvider } from "./config.ts"
import { deviceParts } from "./device.ts"
import { CONSENT_FIELD, normalizeConsents, type LaunchConsentInput, type SignUpConsentPayload } from "./consents.ts"

/**
 * 로그인 뒤 돌아갈 곳. 같은 출처만 받고 경로(+쿼리·해시)로 돌려준다 — 다른 곳이면 fallback(열린 리디렉트 막기).
 * 브라우저와 같은 WHATWG URL 규칙으로 풀어서 본다: 탭·줄바꿈·역슬래시(`/\evil`)·`//evil`·`/.//evil` 모두 걸린다.
 */
export function safeRedirect(target: unknown, baseURL: string, fallback = "/"): string {
  if (typeof target !== "string" || !target) return fallback
  let url: URL
  try {
    url = new URL(target, baseURL)
  } catch {
    return fallback
  }
  if (url.origin !== new URL(baseURL).origin) return fallback
  const path = url.pathname + url.search + url.hash
  return path.startsWith("//") || path.startsWith("/\\") ? fallback : path
}

/** 마지막 로그인 방법(서버에서 쿠키로 읽는다). 계약 값으로 바꿔 준다(email → password). 모르는 값은 null */
export function lastSignInMethod(headers: Headers): AuthMethod | null {
  const pair = (headers.get("cookie") ?? "").split(";").map((c) => c.trim().split("=")).find(([k]) => k === LAST_METHOD_COOKIE)
  const value = pair?.[1] === "email" ? "password" : pair?.[1]
  return (["password", ...SOCIAL_PROVIDERS, "magic-link"] as const).find((m) => m === value) ?? null
}

/**
 * 계약에 아직 없는 편의 입력(web-factory에 선택 칸을 요청함 — 대장). 계약만 아는 블록은 이 칸 없이 불러도 된다.
 * rememberMe: 없으면 true(Better Auth 기본). false 면 세션 쿠키가 브라우저를 닫을 때 끝난다.
 * redirectTo: 로그인·가입·2단계 확인이 끝나면 data.redirectUrl 로 돌려준다(safeRedirect 를 거친다).
 * consents.ageOver14: 만 14세 확인(consents.ts). 계약 ConsentInput 에 선택 칸을 요청했다(대장 C5·D6x).
 */
export interface LaunchAuthPort extends AuthPort {
  /** session 에 편의 칸: 이메일 확인 여부(D70), 언어·시간대(D74) */
  session(): Promise<ActionResult<LaunchSession | null>>
  signIn(input: Parameters<AuthPort["signIn"]>[0] & { rememberMe?: boolean; redirectTo?: string }): ReturnType<AuthPort["signIn"]>
  /**
   * locale·timeZone: 사용자 설정(D74) — 브라우저가 아는 값(Intl). 틀리면 서버 훅이 버리고 언어는 accept-language 로 채운다
   * turnstileToken: 폼의 `cf-turnstile-response`(createAuth botCheck 를 켰을 때, v0 Task 15)
   */
  signUp(
    input: Omit<Parameters<AuthPort["signUp"]>[0], "consents"> & { consents: LaunchConsentInput; redirectTo?: string; locale?: string; timeZone?: string; turnstileToken?: string },
  ): ReturnType<AuthPort["signUp"]>

  // ── Task 19 계정 편의(계약에 아직 없다 — web-factory 에 선택 메서드를 요청함, 대장 D110) ──
  /** D72: 지금 비밀번호가 맞아야 바꾼다. revokeOtherSessions 면 이 기기 말고 모두 로그아웃 */
  changePassword(input: { currentPassword: string; newPassword: string; revokeOtherSessions?: boolean }): Promise<ActionResult<{ otherSessionsRevoked: boolean }>>
  /** LFFIX F4: 재설정 메일 링크(토큰)로 새 비밀번호를 정한다. 토큰이 틀리거나 만료됐으면 invalidResetToken. 성공하면 다른 기기의 세션은 끝난다(revokeSessionsOnPasswordReset) */
  resetPassword(input: { token: string; newPassword: string }): Promise<ActionResult<Record<string, never>>>
  /** D71: 비밀번호가 있으면 currentPassword 필수, 없으면(소셜 전용) 방금 로그인한 세션만. 메일이 나간다 — 바로 바뀌지 않는다 */
  changeEmail(input: { newEmail: string; currentPassword?: string; redirectTo?: string }): Promise<ActionResult<{ emailSent: true }>>
  /** D70: 지금 세션 주소로 확인 메일을 다시 보낸다 */
  sendVerificationEmail(input?: { redirectTo?: string }): Promise<ActionResult<{ sent: true }>>
  /** D73: 로그인된 기기 목록(토큰은 내보내지 않는다) */
  listSessions(): Promise<ActionResult<DeviceSession[]>>
  /** D73: 내 세션 하나를 끝낸다. 목록에 없는 id(남의 세션 포함)는 sessionNotFound */
  revokeSession(input: { sessionId: string }): Promise<ActionResult<Record<string, never>>>
  /** D73·D72: 이 기기 말고 모두 로그아웃 */
  revokeOtherSessions(): Promise<ActionResult<Record<string, never>>>
  /** D74: 언어·시간대 저장 */
  updatePreferences(input: { locale?: string | null; timeZone?: string | null }): Promise<ActionResult<{ locale: string | null; timeZone: string | null }>>
  /** D02: 이름 저장(빈 문자열은 지움). 로그인한 본인만 — 가입 화면의 「이름은 나중에 적어도 돼요」가 지키는 길 */
  updateProfile(input: { name: string }): Promise<ActionResult<{ name: string }>>
  verifyTwoFactor(input: Parameters<AuthPort["verifyTwoFactor"]>[0] & { redirectTo?: string }): Promise<ActionResult<Session & { redirectUrl?: string }>>
  /**
   * 셀프 탈퇴(v0 Task 14 — 계약 AuthPort 밖, web-factory 계약 추가 묶음 A52 에 요청). 로그인한 본인만.
   * 구독을 먼저 해지하고 유예(기본 7일)를 둔 뒤 모든 세션을 끊는다. 유예 중 다시 로그인하면 취소된다.
   */
  deleteAccount(): Promise<ActionResult<{ graceUntil: IsoDate }>>
  /** 내 정보 내려받기(JSON — GDPR 접근권·이동권, 개인정보 보호법 제35조). 로그인한 본인만 */
  exportMyData(): Promise<ActionResult<MyData>>
}

export interface LaunchSession extends Session {
  emailVerified?: boolean
  locale?: string
  timeZone?: string
  /**
   * 대리 로그인 표시(v0 Task 16 — 계약 밖 칸). 있으면 관리자(그 id)가 이 사용자로 대리 로그인한 세션이다 —
   * 화면은 「대리 로그인 중」 띠와 끝내기 버튼(adminActions.stopImpersonating)을 띄운다.
   */
  impersonatedBy?: string
}

/** 기기 목록 한 줄. device 는 사람이 읽는 이름(메시지 auth.deviceName — 예: "Chrome on Windows"), ip 는 끝자리를 가린다 */
export interface DeviceSession {
  id: string
  current: boolean
  device: string
  ip?: string
  createdAt: string
  lastActiveAt: string
  expiresAt: string
}

/** User-Agent → 사람이 읽는 기기 이름(브라우저·OS 이름은 고유명사라 그대로, 잇는 말은 메시지 목록에서) */
export function deviceName(ua: string | null | undefined, m: Pick<AuthMessages, "deviceName" | "unknownDevice"> = AUTH_MESSAGES): string {
  const { browser, os } = deviceParts(ua)
  if (browser && os) return fill(m.deviceName, { browser, os })
  return browser ?? os ?? m.unknownDevice
}

/** IP 끝자리 가리기(IPv4 마지막 옥텟, IPv6 뒤 묶음) — 기기 목록은 알아보기용이다 */
export function maskIp(ip: string | null | undefined): string | undefined {
  if (!ip) return undefined
  if (ip.includes(".") && !ip.includes(":")) return ip.replace(/\.\d+$/, ".*")
  const parts = ip.split(":")
  return parts.length > 4 ? [...parts.slice(0, 4), "*"].join(":") : ip
}

/** 탈퇴·내려받기 실제 처리(@launch-factory/account-lifecycle). 템플릿이 db·결제 포트를 묶어 넘긴다(Task 10) */
export interface AccountLifecycleLike {
  requestDeletion(userId: string): Promise<DeletionRequestResult>
  exportData(userId: string): Promise<MyData | null>
}

/** 사용자에게 보이는 인증 문구. 정본은 메시지 목록 @launch-factory/i18n 의 auth 이름공간이다(Task 18) */
export type AuthMessages = Messages["auth"]
export const authMessages = (locale: Locale = DEFAULT_LOCALE): AuthMessages => messages(locale).auth
/** 영어 기본 문구(Task 4 이름 그대로) */
export const AUTH_MESSAGES: AuthMessages = authMessages("en")

/**
 * 요청마다 붙는 입출력. Next 서버 액션에서는 템플릿이 next/headers 로 만든다(Task 10).
 * headers() 는 setCookies 로 받은 쿠키를 다음 호출부터 반영해야 한다(로그아웃 뒤 session() 이 null 이 되도록).
 */
export interface AuthIO {
  headers(): Headers | Promise<Headers>
  setCookies(setCookie: string[]): void | Promise<void>
}

/** 어댑터가 쓰는 Better Auth 부분만(테스트에서 끼우기 쉽게) */
export interface AuthHandlerLike {
  handler(request: Request): Promise<Response>
  /** createAuth 가 붙이는 우리 설정. 없으면 기본(만 14세 확인 필수·reveal) */
  lf?: LaunchAuthSettings
  options: { baseURL?: unknown; basePath?: string; plugins?: readonly { id: string }[]; socialProviders?: object; advanced?: { ipAddress?: { ipAddressHeaders?: readonly string[] } } }
}

export interface AuthAdapterOptions {
  /** 소셜·매직 링크 로그인 뒤 돌아갈 경로 */
  callbackURL?: string
  /** 소셜 로그인 실패 때 갈 경로(?error=… 가 붙는다) */
  errorCallbackURL?: string
  /**
   * 비밀번호 재설정 메일 링크가 닿는 같은 출처 경로. 주면 요청 때 redirectTo 로 보내고, Better Auth 가 링크를 열면 이 경로로 `?token=…`(틀리거나 만료면 `?error=INVALID_TOKEN`)을 붙여 보낸다
   * (Better Auth 문서 「Password reset」, 2026-10-03 확인). 안 주면 예전처럼 redirectTo 없이 요청한다
   */
  resetPasswordPath?: string
  /**
   * 확인 메일의 링크를 누른 뒤 닿는 같은 출처 경로(쿼리 가능, 예 `/?welcome=verified`). 주면 가입·확인 메일 다시 보내기 요청에 callbackURL 로 실린다
   * (Better Auth: 링크가 `/verify-email?token=…&callbackURL=<이 경로>` 가 되고, 확인이 끝나면 이 경로로 보낸다 — 토큰이 틀리면 `error=` 를 덧붙여 같은 경로로 보낸다). 안 주면 예전처럼 `/` 로 간다
   */
  emailVerifiedPath?: string
  onError?: (error: unknown) => void
  /** 오류 문구의 언어(기본 en) */
  locale?: Locale
  /** 없으면 deleteAccount·exportMyData 가 deletionUnavailable 로 끝난다(조용히 성공하지 않는다) */
  account?: AccountLifecycleLike
}

const FORWARDED_HEADERS = ["cookie", "x-forwarded-for", "user-agent", "accept-language", "x-vercel-ip-city", "x-vercel-ip-country"]

type Reply = { status: number; body: Record<string, unknown> | null }
// code·retryAfter 는 계약 밖 선택 칸이다(대장 D104 — web-factory A52 묶음이 ActionResult 에 더한다). 블록은 지금 formError 만 읽는다
type Fail = Extract<ActionResult<never>, { ok: false }>

export function authAdapter(auth: AuthHandlerLike, io: AuthIO, { callbackURL = "/", errorCallbackURL, resetPasswordPath, emailVerifiedPath, onError =(e) => console.error("[auth]", e), locale = DEFAULT_LOCALE, account }: AuthAdapterOptions = {}): LaunchAuthPort {
  const AUTH = authMessages(locale)
  const { requireAgeOver14, signUpEnumeration } = auth.lf ?? { requireAgeOver14: true, signUpEnumeration: "reveal" }
  const baseURL = String(auth.options.baseURL)
  const basePath = auth.options.basePath ?? "/api/auth"
  const pluginIds = new Set((auth.options.plugins ?? []).map((p) => p.id))
  // 요청 제한이 방문자 주소를 읽는 머리(LF_CLIENT_IP_HEADER · vercel)도 넘긴다 — 안 넘기면 서버 안 세션 읽기가 모두 한 통(주소 모름)에 쌓여 429 가 나고 로그인한 사람이 로그아웃처럼 보인다
  const forwardedHeaders = [...new Set([...FORWARDED_HEADERS, ...(auth.options.advanced?.ipAddress?.ipAddressHeaders ?? []).map((h) => h.toLowerCase())])]
  const socials = SOCIAL_PROVIDERS.filter((p) => p in (auth.options.socialProviders ?? {}))
  const twoFactorOn = pluginIds.has("two-factor")
  const magicLinkOn = pluginIds.has("magic-link")
  const back = (target: unknown) => safeRedirect(target, baseURL, callbackURL)
  /** 확인 메일 링크가 닿는 곳. 설정이 없으면 callbackURL 을 싣지 않는다(예전 동작 — Better Auth 기본 `/`) */
  const verifiedBack = emailVerifiedPath ? { callbackURL: back(emailVerifiedPath) } : {}
  /** redirectTo 를 준 호출만 redirectUrl 을 돌려준다 */
  const withBack = (target: unknown) => (target === undefined ? {} : { redirectUrl: back(target) })

  async function call(method: "GET" | "POST", path: string, body?: object): Promise<Reply | Fail> {
    const incoming = await io.headers()
    const headers = new Headers({ origin: new URL(baseURL).origin })
    for (const name of forwardedHeaders) {
      const v = incoming.get(name)
      if (v) headers.set(name, v)
    }
    if (body) headers.set("content-type", "application/json")
    let res: Response
    try {
      res = await auth.handler(new Request(new URL(basePath + path, baseURL), { method, headers, body: body ? JSON.stringify(body) : undefined }))
    } catch (e) {
      onError(e)
      return { ok: false, formError: AUTH.unavailable, retryable: true, code: "provider_unavailable" }
    }
    const setCookie = res.headers.getSetCookie()
    if (setCookie.length) await io.setCookies(setCookie)
    if (res.status === 429) {
      // Better Auth 1.7.6 은 남은 초를 X-Retry-After 로 준다(dist/api/rate-limiter/index.mjs rateLimitResponse)
      const retryAfter = Number(res.headers.get("x-retry-after"))
      return { ok: false, formError: AUTH.tooManyRequests, retryable: true, code: "rate_limited", ...(retryAfter > 0 ? { retryAfter } : {}) }
    }
    if (res.status >= 500) {
      onError(new Error(`auth ${path} → ${res.status}`))
      return { ok: false, formError: AUTH.unavailable, retryable: true, code: "provider_unavailable" }
    }
    const parsed: unknown = await res.json().catch(() => null)
    return { status: res.status, body: parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null }
  }

  const isFail = (r: Reply | Fail): r is Fail => "ok" in r

  /** Better Auth 오류 코드 → 포트 오류. 모르는 코드는 일반 문구(서버 문구를 그대로 보이지 않는다) */
  function toFail(r: Reply): Fail {
    const code = String(r.body?.code ?? "")
    // LFAX M04: 기계가 읽는 값(code·retryable) — 같은 비밀번호로 다시 보내도 같은 결과라 retryable false. 계정 유무는 드러내지 않는다(없는 계정도 같은 코드)
    if (code === "INVALID_EMAIL_OR_PASSWORD") return { ok: false, formError: AUTH.invalidCredentials, retryable: false, code: "invalid_credentials" }
    // LFADB A02: 기계가 읽는 code — 가입 블록이 이 값을 보면 이메일 칸 오류에 [로그인하기]·[비밀번호 찾기] 링크를 붙인다(web-factory v0.0.10 sign-up-consents)
    if (code.startsWith("USER_ALREADY_EXISTS")) return { ok: false, fieldErrors: { email: [AUTH.userExists] }, retryable: false, code: "email_exists" }
    if (code === "PASSWORD_TOO_SHORT" || code === "PASSWORD_TOO_LONG") return { ok: false, fieldErrors: { password: [AUTH.weakPassword] } }
    if (code === "EMAIL_NOT_VERIFIED") return { ok: false, formError: AUTH.emailNotVerified }
    if (code === "CONSENT_REQUIRED") return { ok: false, formError: AUTH.consentRequired }
    if (code === "BOT_CHECK_FAILED") return { ok: false, formError: messages(locale).protect.botCheckFailed, retryable: true, code: "bot_check_failed" }
    if (code === "INVALID_EMAIL") return { ok: false, fieldErrors: { email: [AUTH.invalidEmail] } }
    if (code === "INVALID_PASSWORD") return { ok: false, fieldErrors: { currentPassword: [AUTH.invalidPassword] } }
    if (code === "SESSION_NOT_FRESH") return { ok: false, formError: AUTH.reauthRequired }
    if (code === "CREDENTIAL_ACCOUNT_NOT_FOUND") return { ok: false, formError: AUTH.noPassword }
    if (code === "EMAIL_ALREADY_VERIFIED") return { ok: false, formError: AUTH.alreadyVerified }
    if (code === "EMAIL_IS_THE_SAME" || r.body?.message === "Email is the same") return { ok: false, fieldErrors: { newEmail: [AUTH.sameEmail] } }
    if (code === "INVALID_LOCALE") return { ok: false, fieldErrors: { locale: [AUTH.invalidLocale] } }
    if (code === "INVALID_TIME_ZONE") return { ok: false, fieldErrors: { timeZone: [AUTH.invalidTimeZone] } }
    // 관리자 조각(v0 Task 16): 정지된 계정의 로그인, 대리 로그인 중 막힌 자격 증명 변경
    if (code === "BANNED_USER") return { ok: false, formError: AUTH.accountSuspended }
    if (code === "IMPERSONATION_BLOCKED") return { ok: false, formError: AUTH.impersonationBlocked }
    if (/CODE|OTP|BACKUP|TWO_FACTOR/.test(code)) return { ok: false, fieldErrors: { code: [AUTH.invalidCode] } }
    // 2단계 코드 오류도 401 이라 그 뒤에 본다
    if (r.status === 401) return { ok: false, formError: AUTH.signInRequired, retryable: false, code: "sign_in_required" }
    if (r.status === 400 && code === "VALIDATION_ERROR") return { ok: false, formError: AUTH.required }
    onError(new Error(`auth response ${r.status} ${code}`))
    return { ok: false, formError: AUTH.failed }
  }

  const needs = (fields: Record<string, unknown>): Fail | null => {
    const missing = Object.entries(fields).filter(([, v]) => typeof v !== "string" || !v.trim())
    return missing.length ? { ok: false, fieldErrors: Object.fromEntries(missing.map(([k]) => [k, [AUTH.required]])) } : null
  }

  async function social(provider: SocialProvider, signUpConsents: SignUpConsentPayload | null, redirectTo: unknown): Promise<ActionResult<{ redirectUrl: string }>> {
    if (!socials.includes(provider)) return { ok: false, formError: AUTH.methodUnavailable }
    const r = await call("POST", "/sign-in/social", {
      provider,
      callbackURL: back(redirectTo),
      errorCallbackURL,
      requestSignUp: signUpConsents ? true : undefined,
      // 가입이면 동의를 OAuth 상태에 실어 콜백의 DB 훅까지 보낸다(검사·기록은 거기서 한 번 더)
      additionalData: signUpConsents ? { [CONSENT_FIELD]: signUpConsents } : undefined,
    })
    if (isFail(r)) return r
    if (r.status !== 200 || typeof r.body?.url !== "string") return toFail(r)
    return { ok: true, data: { redirectUrl: r.body.url } }
  }

  const port: LaunchAuthPort = {
    async session() {
      const r = await call("GET", "/get-session")
      if (isFail(r)) return r
      if (r.status !== 200) return toFail(r)
      const user = r.body?.user as Record<string, unknown> | undefined
      const sess = r.body?.session as Record<string, unknown> | undefined
      if (!user || !sess) return { ok: true, data: null }
      const data: LaunchSession = { userId: String(user.id), twoFactor: user.twoFactorEnabled === true }
      if (typeof sess.impersonatedBy === "string" && sess.impersonatedBy) data.impersonatedBy = sess.impersonatedBy
      if (typeof user.name === "string" && user.name) data.name = user.name
      if (typeof user.email === "string" && !isPlaceholderEmail(user.email)) data.email = user.email
      if (typeof sess.activeOrganizationId === "string") data.orgId = sess.activeOrganizationId
      // 대체 주소는 확인할 수 없는 주소라 emailVerified 를 싣지 않는다(화면은 「이메일 추가」를 보인다 — D43)
      if (data.email) data.emailVerified = user.emailVerified === true
      if (typeof user.locale === "string" && user.locale) data.locale = user.locale
      if (typeof user.timeZone === "string" && user.timeZone) data.timeZone = user.timeZone
      return { ok: true, data }
    },

    async methods() {
      const list: AuthMethod[] = ["password", ...socials]
      if (magicLinkOn) list.push("magic-link")
      return { ok: true, data: list }
    },

    async signIn({ method, email, password, rememberMe, redirectTo }) {
      if (method === "password") {
        const bad = needs({ email, password })
        if (bad) return bad
        const r = await call("POST", "/sign-in/email", { email, password, rememberMe: rememberMe !== false })
        if (isFail(r)) return r
        if (r.status !== 200) return toFail(r)
        return { ok: true, data: r.body?.twoFactorRedirect === true ? { needsTwoFactor: true } : withBack(redirectTo) }
      }
      if (method === "magic-link") {
        if (!magicLinkOn) return { ok: false, formError: AUTH.methodUnavailable }
        const bad = needs({ email })
        if (bad) return bad
        const r = await call("POST", "/sign-in/magic-link", { email, callbackURL: back(redirectTo) })
        if (isFail(r)) return r
        return r.status === 200 ? { ok: true, data: { emailSent: true } } : toFail(r)
      }
      return social(method, null, redirectTo)
    },

    async signUp({ method, email, password, name, consents, redirectTo, locale: userLocale, timeZone, turnstileToken }) {
      // 동의가 먼저다: 방법과 상관없이 필수 동의가 없으면 아무것도 만들지 않는다.
      const consent = normalizeConsents(consents, { locale, requireAgeOver14 })
      if (!consent.ok) return consent
      const payload: SignUpConsentPayload = { ...consent.consents, locale }
      if (method === "password") {
        const bad = needs({ email, password })
        if (bad) return bad
        // D74 언어·시간대는 틀려도 가입을 막지 않는다 — 서버 훅(user.create.before)이 버리고 accept-language 로 채운다
        const prefs = { ...(typeof userLocale === "string" ? { locale: userLocale } : {}), ...(typeof timeZone === "string" ? { timeZone } : {}) }
        const r = await call("POST", "/sign-up/email", { email, password, name: name ?? "", ...verifiedBack, ...prefs, [CONSENT_FIELD]: payload, ...(turnstileToken ? { [TURNSTILE_BODY_FIELD]: turnstileToken } : {}) })
        if (isFail(r)) return r
        if (r.status !== 200) return toFail(r)
        // conceal: 새 계정·있는 계정 모두 token 이 null 이다 — 인증 메일(새 계정) 또는 안내 메일(있는 계정)이 간다
        return signUpEnumeration === "conceal" || r.body?.token === null ? { ok: true, data: { emailSent: true } } : { ok: true, data: withBack(redirectTo) }
      }
      if (method === "magic-link") return { ok: false, formError: magicLinkOn ? AUTH.magicLinkSignUp : AUTH.methodUnavailable }
      return social(method, payload, redirectTo)
    },

    async verifyTwoFactor({ code, method = "totp", trustDevice = false, redirectTo }) {
      if (!twoFactorOn) return { ok: false, formError: AUTH.twoFactorDisabled }
      const bad = needs({ code })
      if (bad) return bad
      const r = await call("POST", method === "backup-code" ? "/two-factor/verify-backup-code" : "/two-factor/verify-totp", { code, trustDevice })
      if (isFail(r)) return r
      if (r.status !== 200) return toFail(r)
      const s = await port.session()
      if (!s.ok) return s
      return s.data ? { ok: true, data: { ...s.data, ...withBack(redirectTo) } } : { ok: false, formError: AUTH.failed }
    },

    async requestPasswordReset({ email }) {
      const bad = needs({ email })
      if (bad) return bad
      const r = await call("POST", "/request-password-reset", { email, ...(resetPasswordPath ? { redirectTo: back(resetPasswordPath) } : {}) })
      if (isFail(r)) return r
      if (r.status === 200) return { ok: true, data: { sent: true } }
      return String(r.body?.code) === "VALIDATION_ERROR" ? { ok: false, fieldErrors: { email: [AUTH.invalidEmail] } } : toFail(r)
    },

    async resetPassword({ token, newPassword }) {
      const bad = needs({ token, newPassword })
      if (bad) return bad
      const r = await call("POST", "/reset-password", { token, newPassword })
      if (isFail(r)) return r
      if (r.status === 200) return { ok: true, data: {} }
      if (String(r.body?.code) === "INVALID_TOKEN") return { ok: false, formError: AUTH.invalidResetToken, code: "invalid_token" }
      const f = toFail(r)
      // 새 비밀번호 길이 오류는 newPassword 칸에
      return f.fieldErrors?.password ? { ok: false, fieldErrors: { newPassword: f.fieldErrors.password } } : f
    },

    async signOut() {
      const r = await call("POST", "/sign-out", {})
      if (isFail(r)) return r
      return r.status === 200 ? { ok: true, data: {} } : toFail(r)
    },

    async deleteAccount() {
      const me = await signedInUserId()
      if (typeof me !== "string") return me
      if (!account) return unavailable()
      let r: DeletionRequestResult
      try {
        r = await account.requestDeletion(me)
      } catch (e) {
        onError(e)
        return { ok: false, formError: AUTH.deletionUnavailable, retryable: true }
      }
      if (!r.ok) {
        if (r.reason === "billing_failed") return { ok: false, formError: AUTH.subscriptionCancelFailed, retryable: r.retryable }
        return { ok: false, formError: AUTH.signInRequired }
      }
      // 세션은 서버에서 이미 모두 끊겼다. 이 브라우저의 쿠키도 지운다(결과는 보지 않는다 — 세션이 없어 실패해도 된다).
      await call("POST", "/sign-out", {})
      return { ok: true, data: { graceUntil: r.graceUntil } }
    },

    async exportMyData() {
      const me = await signedInUserId()
      if (typeof me !== "string") return me
      if (!account) return unavailable()
      try {
        const data = await account.exportData(me)
        return data ? { ok: true, data } : { ok: false, formError: AUTH.signInRequired }
      } catch (e) {
        onError(e)
        return { ok: false, formError: AUTH.deletionUnavailable, retryable: true }
      }
    },

    async changePassword({ currentPassword, newPassword, revokeOtherSessions = false }) {
      const bad = needs({ currentPassword, newPassword })
      if (bad) return bad
      const r = await call("POST", "/change-password", { currentPassword, newPassword, revokeOtherSessions: revokeOtherSessions === true })
      if (isFail(r)) return r
      if (r.status !== 200) {
        const f = toFail(r)
        // 새 비밀번호 길이 오류는 newPassword 칸에
        return f.fieldErrors?.password ? { ok: false, fieldErrors: { newPassword: f.fieldErrors.password } } : f
      }
      return { ok: true, data: { otherSessionsRevoked: revokeOtherSessions === true } }
    },

    async changeEmail({ newEmail, currentPassword, redirectTo }) {
      const bad = needs({ newEmail })
      if (bad) return bad
      const body: Record<string, unknown> = { newEmail: newEmail.trim(), callbackURL: back(redirectTo) }
      if (typeof currentPassword === "string" && currentPassword) body.currentPassword = currentPassword
      const r = await call("POST", "/change-email", body)
      if (isFail(r)) return r
      if (r.status !== 200) {
        const f = toFail(r)
        return f.fieldErrors?.email ? { ok: false, fieldErrors: { newEmail: f.fieldErrors.email } } : f
      }
      // 이미 쓰이는 주소여도 같은 응답이다(Better Auth change-email — 가입 여부를 드러내지 않는다)
      return { ok: true, data: { emailSent: true } }
    },

    async sendVerificationEmail(input = {}) {
      const s = await call("GET", "/get-session")
      if (isFail(s)) return s
      const email = (s.body?.user as Record<string, unknown> | undefined)?.email
      if (typeof email !== "string") return { ok: false, formError: AUTH.signInRequired, retryable: false, code: "sign_in_required" }
      if (isPlaceholderEmail(email)) return { ok: false, formError: AUTH.addEmailFirst }
      const r = await call("POST", "/send-verification-email", { email, callbackURL: back(input.redirectTo ?? emailVerifiedPath) })
      if (isFail(r)) return r
      return r.status === 200 ? { ok: true, data: { sent: true } } : toFail(r)
    },

    async listSessions() {
      const cur = await call("GET", "/get-session")
      if (isFail(cur)) return cur
      const currentId = (cur.body?.session as Record<string, unknown> | undefined)?.id
      const r = await call("GET", "/list-sessions")
      if (isFail(r)) return r
      if (r.status !== 200) return toFail(r)
      const rows = (Array.isArray(r.body) ? r.body : []) as Record<string, unknown>[]
      const iso = (v: unknown) => new Date(String(v)).toISOString()
      const list = rows.map((x): DeviceSession => {
        const ip = maskIp(typeof x.ipAddress === "string" ? x.ipAddress : null)
        return {
          id: String(x.id),
          current: x.id === currentId,
          device: deviceName(typeof x.userAgent === "string" ? x.userAgent : null, AUTH),
          ...(ip ? { ip } : {}),
          createdAt: iso(x.createdAt),
          lastActiveAt: iso(x.updatedAt ?? x.createdAt),
          expiresAt: iso(x.expiresAt),
        }
      })
      // 지금 기기를 맨 위에, 나머지는 최근 사용 순
      list.sort((a, b) => Number(b.current) - Number(a.current) || b.lastActiveAt.localeCompare(a.lastActiveAt))
      return { ok: true, data: list }
    },

    async revokeSession({ sessionId }) {
      const bad = needs({ sessionId })
      if (bad) return bad
      // 내 세션 목록에서만 찾는다 — 토큰은 밖으로 내보내지 않고, 남의 세션 id 는 목록에 없어 여기서 끝난다
      const r = await call("GET", "/list-sessions")
      if (isFail(r)) return r
      if (r.status !== 200) return toFail(r)
      const mine = ((Array.isArray(r.body) ? r.body : []) as Record<string, unknown>[]).find((x) => x.id === sessionId)
      if (!mine || typeof mine.token !== "string") return { ok: false, formError: AUTH.sessionNotFound }
      const res = await call("POST", "/revoke-session", { token: mine.token })
      if (isFail(res)) return res
      return res.status === 200 ? { ok: true, data: {} } : toFail(res)
    },

    async revokeOtherSessions() {
      const r = await call("POST", "/revoke-other-sessions", {})
      if (isFail(r)) return r
      return r.status === 200 ? { ok: true, data: {} } : toFail(r)
    },

    async updateProfile({ name }) {
      const r = await call("POST", "/update-user", { name })
      if (isFail(r)) return r
      if (r.status !== 200) return toFail(r)
      const s = await port.session()
      if (!s.ok) return s
      return { ok: true, data: { name: s.data?.name ?? "" } }
    },

    async updatePreferences({ locale: nextLocale, timeZone }) {
      const body: Record<string, unknown> = {}
      if (nextLocale !== undefined) body.locale = nextLocale
      if (timeZone !== undefined) body.timeZone = timeZone
      if (!Object.keys(body).length) return { ok: false, formError: AUTH.required }
      const r = await call("POST", "/update-user", body)
      if (isFail(r)) return r
      if (r.status !== 200) return toFail(r)
      const s = await port.session()
      if (!s.ok) return s
      return { ok: true, data: { locale: s.data?.locale ?? null, timeZone: s.data?.timeZone ?? null } }
    },
  }

  /** 로그인한 본인 id. 아니면 포트 실패(signInRequired). 대리 로그인 세션은 본인이 아니다 — 탈퇴·내려받기를 막는다(v0 Task 16) */
  async function signedInUserId(): Promise<string | Fail> {
    const s = await port.session()
    if (!s.ok) return s
    if (s.data?.impersonatedBy) return { ok: false, formError: AUTH.impersonationBlocked }
    return s.data ? s.data.userId : { ok: false, formError: AUTH.signInRequired, retryable: false, code: "sign_in_required" }
  }
  function unavailable(): Fail {
    onError(new Error("account lifecycle is not configured: pass authAdapter(..., { account })"))
    return { ok: false, formError: AUTH.deletionUnavailable }
  }
  return port
}
