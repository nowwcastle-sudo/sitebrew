// Better Auth 설정(v0 Task 4). 요청 제한 저장소는 DB다(설계 §7-A 3). 소셜·2단계·조직은 선택 조각이고 기본은 끈다(§7-A 7).
// 요청 제한은 Better Auth 라우터(auth.handler) 안에서만 걸린다 — auth.api.* 직접 호출은 제한을 건너뛴다.
// 그래서 어댑터(adapter.ts)는 늘 auth.handler 로 요청을 보낸다.
import { betterAuth, type BetterAuthPlugin } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { APIError, createAuthMiddleware, getOAuthState, getSessionFromCtx } from "better-auth/api"
import { admin, lastLoginMethod, magicLink, organization, twoFactor } from "better-auth/plugins"
import { eq } from "drizzle-orm"
import { cancelAccountDeletion } from "@launch-factory/account-lifecycle"
import { claimMailOnce, recordDevice, recordSignUpConsents, releaseMailOnce, type ConsentVersions, type Database } from "@launch-factory/db"
import * as schema from "@launch-factory/db/schema"
import { DEFAULT_LOCALE } from "@launch-factory/i18n"
import type { Turnstile } from "@launch-factory/security/turnstile"
import { ADMIN_ROLE, lfAdminPlugin } from "./admin-plugin.ts"
import { CONSENT_FIELD, readConsentPayload, type MarketingChoices } from "./consents.ts"
import { deviceFingerprint, deviceLabel, roughLocation } from "./device.ts"

/** 가입 요청 본문에서 Turnstile 토큰을 싣는 칸(어댑터가 채운다) */
export const TURNSTILE_BODY_FIELD = "lfTurnstile"

import { socialEnvNames, type SocialProvider } from "./socials.ts"
export { SOCIAL_PROVIDERS, socialEnvNames, type SocialProvider } from "./socials.ts"

/**
 * 카카오 무이메일 규칙. 비즈 앱 인증 전에는 카카오가 이메일을 주지 않는다(동의 항목 account_email).
 * Better Auth 기본 동작은 이메일이 없으면 가입을 거절한다(error=email_not_found) — 그러면 카카오 로그인이 쓸모없다.
 * 우리 규칙: 카카오 회원번호로 만든 대체 주소(`kakao-<id>@kakao.invalid`, RFC 2606 예약 TLD — 어디로도 배달되지 않는다)로
 * 사용자를 만들고 emailVerified=false 로 둔다. 회원번호마다 하나라 다른 계정과 겹치거나 이어지지 않는다.
 * session() 은 이 주소를 email 로 내보내지 않고, 메일 발송(재설정·매직 링크)은 이 주소를 건너뛴다.
 */
export const KAKAO_NO_EMAIL_DOMAIN = "kakao.invalid"
export const kakaoPlaceholderEmail = (kakaoId: string | number): string => `kakao-${kakaoId}@${KAKAO_NO_EMAIL_DOMAIN}`
export const isPlaceholderEmail = (email: string | null | undefined): boolean => !!email && email.toLowerCase().endsWith(`@${KAKAO_NO_EMAIL_DOMAIN}`)

/** 카카오 프로필 → 사용자 칸 덮어쓰기. 이메일이 있으면 아무것도 바꾸지 않는다 */
export function kakaoUserOverride(profile: { id: string | number; kakao_account?: { email?: string } }): { email?: string; emailVerified?: boolean } {
  return profile.kakao_account?.email ? {} : { email: kakaoPlaceholderEmail(profile.id), emailVerified: false }
}

/**
 * 세션 길이(초). 값은 Better Auth 1.7.6 기본값 그대로다(dist/context/create-context.mjs, 문서 concepts/session-management):
 * 7일 동안 유지하고, 1일이 지난 뒤 쓰이면 만료를 「지금 + 7일」로 민다(sliding). 「로그인 유지」를 끄면 쿠키는 브라우저를 닫을 때 끝난다.
 */
export const SESSION_DEFAULTS = { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 } as const

/** 마지막 로그인 방법 쿠키(Better Auth lastLoginMethod 플러그인). 값은 email·google·kakao·naver·magic-link 뿐 — 개인정보 없음 */
export const LAST_METHOD_COOKIE = "better-auth.last_used_login_method"

/**
 * 인증·재설정·변경 승인 링크의 유효 시간(초). Better Auth 기본값(1시간)과 같다 — 기본값에 기대지 않고 설정에 **명시**한다(A12).
 * 메일 문구의 「1시간 동안」은 @launch-factory/email 의 DEFAULT_LINK_VALID_MINUTES(60분)에서 나오고, 둘이 같은지는 시험이 본다.
 */
export const LINK_EXPIRES_SECONDS = 60 * 60

/** 받는 사람의 이름·언어·시간대(사용자 칸 — D74). 메일 언어를 고른다 */
export interface Recipient {
  /** 사용자 id — 서명 링크를 만들 때만 쓴다(메일 본문에는 싣지 않는다) */
  id?: string | null
  name?: string | null
  locale?: string | null
  timeZone?: string | null
}

/**
 * 메일 보내기(Task 7 Resend가 채운다 — 계정 보안 넷은 @launch-factory/email `authEmails` 가 이 모양이다).
 * 실패는 던져도 된다 — 밖으로는 알리지 않고 onError 로만 보낸다(가입 여부 노출 방지).
 * verifyEmail 이 있으면 이메일 확인(D70)과 이메일 변경(D71)이 켜진다. 알림(emailChanged·passwordChanged)은 없으면 보내지 않는다.
 */
export interface AuthMailer {
  passwordReset(to: string, url: string, who?: Recipient): Promise<void>
  magicLink?(to: string, url: string, who?: Recipient): Promise<void>
  /** 이메일 확인 링크(가입 뒤·다시 보내기·이메일 변경의 새 주소). signUpEnumeration: "conceal" 이면 필수 */
  verifyEmail?(to: string, url: string, who?: Recipient): Promise<void>
  /** 이미 있는 이메일로 가입을 시도했다는 안내(conceal 에서만 — 주인은 알고, 시도한 사람은 모른다) */
  existingAccount?(to: string): Promise<void>
  /** 이메일 변경 승인 요청 — 지금(확인된) 주소로(D71) */
  changeEmailConfirm?(to: string, input: { newEmail: string; url: string }, who?: Recipient): Promise<void>
  /** 이메일이 바뀐 뒤 옛 주소로 알림(D71, OWASP) */
  emailChanged?(to: string, input: { newEmail: string }, who?: Recipient): Promise<void>
  /** 비밀번호 변경·재설정 뒤 알림(D72) */
  passwordChanged?(to: string, who?: Recipient): Promise<void>
  /** 이메일을 확인한 뒤 한 번 보내는 환영 메일(G05) */
  welcome?(to: string, who?: Recipient): Promise<void>
  /** 처음 보는 기기로 로그인했다는 알림(C06). location 은 알 때만 */
  newDeviceSignIn?(to: string, input: { device: string; at: Date; location?: string }, who?: Recipient): Promise<void>
}

/** 사용자 언어(D74). 메일 문구가 있는 언어만 받는다 */
export const USER_LOCALES = ["ko", "en"] as const
export type UserLocale = (typeof USER_LOCALES)[number]

/** IANA 시간대 이름인지(Intl 이 아는 이름만) */
export function isTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || !value || value.length > 64) return false
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value })
    return true
  } catch {
    return false
  }
}

/** accept-language 머리에서 지원 언어 하나(q 순). 없으면 null */
export function localeFromAcceptLanguage(header: string | null | undefined): UserLocale | null {
  if (!header) return null
  const ranked = header
    .split(",")
    .map((part, i) => {
      const [tag, ...params] = part.trim().split(";")
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="))
      return { lang: (tag ?? "").toLowerCase().split("-")[0], q: q ? Number(q.slice(2)) : 1, i }
    })
    .filter((x) => x.lang && Number.isFinite(x.q) && x.q > 0)
    .sort((a, b) => b.q - a.q || a.i - b.i)
  return (ranked.map((x) => USER_LOCALES.find((l) => l === x.lang)).find(Boolean) as UserLocale | undefined) ?? null
}

/** 민감 작업의 요청 제한(초·횟수). 비밀번호 추측을 막고, 인증 메일 다시 보내기 대기 시간의 기준이다(화면 A?-8) */
export const SENSITIVE_RATE_LIMITS = {
  "/change-password": { window: 60, max: 5 },
  "/change-email": { window: 60, max: 5 },
  "/send-verification-email": { window: 60, max: 3 },
} as const

/** 비밀번호가 없는(소셜 전용) 사용자가 이메일을 바꾸려면 이 시간(초) 안에 로그인한 세션이어야 한다(재인증 — OWASP) */
export const RECENT_SIGN_IN_SECONDS = 15 * 60

/**
 * /verify-email 요청의 토큰에서 이메일 변경(옛 주소 → 새 주소)을 읽는다. 서명 검증은 Better Auth 가 같은 요청에서 이미 했다 —
 * afterEmailVerification 이 부른 뒤에만 쓰므로 내용만 읽는다. 변경 확인 토큰이 아니면 null.
 */
export function changeOf(request: Request | undefined): { from: string; to: string } | null {
  try {
    const token = request ? new URL(request.url).searchParams.get("token") : null
    const payload = token ? (JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8")) as Record<string, unknown>) : null
    if (payload?.requestType !== "change-email-verification") return null
    return typeof payload.email === "string" && typeof payload.updateTo === "string" ? { from: payload.email, to: payload.updateTo } : null
  } catch {
    return null
  }
}

export interface CreateAuthOptions {
  db: Database
  /** BETTER_AUTH_SECRET(32자 이상) */
  secret: string
  /** 앱 주소(예: https://app.example.com). 쿠키·콜백·출처 검사의 기준 */
  baseURL: string
  socials?: SocialProvider[]
  twoFactor?: boolean
  organization?: boolean
  /** 없으면 비밀번호 재설정 메일이 나가지 않고 onError 로 알린다. magicLink 가 있으면 magic-link 로그인이 켜진다 */
  mailer?: AuthMailer
  /** 소셜 키를 읽는 곳(기본 process.env). 이름: GOOGLE_CLIENT_ID·GOOGLE_CLIENT_SECRET 등 */
  env?: Record<string, string | undefined>
  /** 세션 길이(초). 기본 SESSION_DEFAULTS */
  session?: { expiresIn?: number; updateAge?: number }
  /** 2단계 인증 앱에 보이는 이름 */
  appName?: string
  /** 사용자에게 알리지 않는 서버 쪽 실패(메일 발송 등) */
  onError?: (error: unknown) => void
  /**
   * 메일 발송처럼 응답을 기다리지 않는 일을 맡는 곳(대장 D202). Better Auth 공식 문서(concepts/email): 재설정·확인 메일 발송을 await 하면
   * 있는 계정의 응답만 느려져 이메일 존재 여부가 시간으로 드러난다 — 기다리지 말고, 서버리스에서는 waitUntil 로 끝까지 보낸다.
   * 기본은 기다리지 않고 실패만 onError 로 알린다(Node 서버). Vercel 은 `(task) => after(task)`(Next) 또는 `waitUntil`(@vercel/functions)을 넘긴다.
   */
  runInBackground?: (task: Promise<unknown>) => void
  /**
   * 요청 제한이 어느 머리의 IP 를 믿을지(대장 D205). `@launch-factory/security/rate-limit` 의 `ipAddressFromEnv(process.env)` 값을 요청 제한기와 같게 넘긴다.
   * 안 주면 Better Auth 기본(`x-forwarded-for` 한 값)이라 직접 노출된 서버에서는 속일 수 있다.
   */
  ipAddress?: { ipAddressHeaders?: string[]; trustedProxies?: string[]; ipv6Subnet?: 128 | 64 | 48 | 32 }
  /** 가입 때 동의 기록에 남길 약관·개인정보 처리방침의 판(대장 D40). 문서를 고치면 올린다 */
  consentVersions: ConsentVersions
  /**
   * 가입 때 마케팅 수신에 동의한 사람에게 처리 결과를 알리는 곳(A06 — 정보통신망법 제50조제7항 · 시행령 제62조의2: 의사를 표시한 날부터 14일 안에 전송자 명칭·사실과 날짜·처리 결과).
   * 동의한 채널이 하나라도 있을 때만 부른다(아무것도 켜지 않은 가입은 의사 표시가 없다). 대체 주소(카카오 이메일 없는 계정)는 부르지 않는다.
   * 응답을 기다리지 않고(runInBackground) 실패는 onError 로만 알린다 — 가입은 되돌리지 않는다.
   */
  onSignUpMarketing?: (event: SignUpMarketingEvent) => void | Promise<void>
  /** 가입에 만 14세 확인을 요구한다(기본 true — 개인정보 보호법 제22조의2제1항, consents.ts) */
  requireAgeOver14?: boolean
  /**
   * 이미 있는 이메일로 가입할 때(대장 D48).
   * - "reveal"(기본): 「이미 가입된 이메일이에요」 필드 오류. 가입 즉시 로그인된다.
   * - "conceal": 있는 계정·없는 계정 모두 { emailSent: true } 로 같다. 새 계정은 이메일 인증 뒤에 로그인되고,
   *   있는 계정의 주인에게는 mailer.existingAccount 로 알린다. mailer.verifyEmail 이 필요하다.
   */
  signUpEnumeration?: SignUpEnumeration
  /**
   * 비밀번호 가입의 봇 방어(v0 Task 15). 주면 `/sign-up/email` 앞에서 본문 `lfTurnstile` 토큰을 검증한다 —
   * 없거나 틀리면 400 BOT_CHECK_FAILED, Cloudflare 에 닿지 못하면 503 BOT_CHECK_UNAVAILABLE. `auth.handler` 직접 호출도 같다.
   * mock 모드 Turnstile 은 통과한다. 소셜 가입은 공급자 로그인 화면을 거치므로 걸지 않는다.
   */
  botCheck?: Turnstile
  /** 비밀번호 없는 사용자의 이메일 변경 재인증 창(초). 기본 RECENT_SIGN_IN_SECONDS(D71) */
  recentSignInSeconds?: number
  /**
   * 관리자 조각(v0 Task 16 — 선택, 기본 끔). 켜면 Better Auth admin 플러그인(정지·해제·대리 로그인)과 우리 관리자 벽·기록(admin-plugin.ts)이 걸린다.
   * 관리자는 role=admin 이고 2단계 인증을 켠 사람뿐이라 twoFactor: true 가 필요하다.
   * impersonationSeconds: 대리 세션 길이(기본 3600 — Better Auth 기본값과 같다)
   */
  admin?: boolean | { impersonationSeconds?: number }
}

/** 가입 때 마케팅 수신에 동의한 일(onSignUpMarketing 에 실린다) */
export interface SignUpMarketingEvent {
  userId: string
  email: string
  name: string | null
  locale: string | null
  timeZone: string | null
  /** 이번에 동의한 채널(동의한 것만) */
  changes: { channel: keyof MarketingChoices; granted: true }[]
  /** 의사를 표시한 때(= 가입 시각) */
  at: Date
}

export type SignUpEnumeration = "reveal" | "conceal"

/** 어댑터가 읽는 우리 쪽 설정(Better Auth 옵션 밖) */
export interface LaunchAuthSettings {
  requireAgeOver14: boolean
  signUpEnumeration: SignUpEnumeration
}

function socialProviders(socials: SocialProvider[], env: Record<string, string | undefined>) {
  const missing = socials.flatMap((p) => socialEnvNames(p).filter((n) => !env[n]))
  if (missing.length) throw new Error(`missing social sign-in keys: ${missing.join(", ")}`)
  const out: Record<string, unknown> = {}
  for (const p of socials) {
    const [id, secret] = socialEnvNames(p)
    // 소셜 로그인은 계정을 새로 만들지 않는다 — 가입(동의를 받은 signUp)만 requestSignUp 으로 만든다.
    out[p] = {
      clientId: env[id],
      clientSecret: env[secret],
      disableImplicitSignUp: true,
      ...(p === "kakao" ? { mapProfileToUser: kakaoUserOverride } : {}),
    }
  }
  return out
}

export function createAuth(options: CreateAuthOptions) {
  const { db, secret, baseURL, socials = [], mailer, env = process.env, onError = (e) => console.error("[auth]", e) } = options
  // 메일 실패·대체 주소는 밖으로 드러내지 않는다: 있는 계정과 없는 계정의 응답이 같아야 한다.
  const deliver = (send: ((to: string, url: string) => Promise<void>) | undefined, to: string, url: string) => {
    if (isPlaceholderEmail(to)) return Promise.resolve()
    if (!send) {
      onError(new Error("auth mailer is not configured; email not sent (Task 7)"))
      return Promise.resolve()
    }
    return send(to, url).catch(onError)
  }
  // Task 19 알림(optional): 메일러에 그 메서드가 없으면 조용히 건너뛴다(선택 기능). 대체 주소는 건너뛴다.
  const notify = (to: string, send: ((to: string) => Promise<void>) | undefined): Promise<void> => {
    if (isPlaceholderEmail(to) || !send) return Promise.resolve()
    return send(to).catch(onError)
  }
  const who = (u: unknown): Recipient => {
    const r = (u ?? {}) as Record<string, unknown>
    const s = (v: unknown) => (typeof v === "string" && v ? v : null)
    return { id: s(r.id), name: s(r.name), locale: s(r.locale), timeZone: s(r.timeZone) }
  }
  /** 응답을 기다리지 않는 일(메일). 실패는 onError 로만 알린다 */
  const background = (task: Promise<unknown>) => {
    const t = task.catch(onError)
    if (options.runInBackground) options.runInBackground(t)
    else void t
  }
  /**
   * 환영 메일(G05): 이메일이 확인된 사용자에게 한 번만. 「한 번」은 mail_ledger(welcome) 한 행이 정한다 — 먼저 자리를 잡은 요청만 보내고,
   * 보내기가 실패하면 자리를 돌려 다음에 다시 보낼 수 있게 한다. 대체 주소(카카오 이메일 없는 계정)는 건너뛴다.
   */
  const welcomeOnce = (u: { id: string; email: string; emailVerified?: boolean | null }) => {
    if (!mailer?.welcome || isPlaceholderEmail(u.email)) return
    const send = mailer.welcome.bind(mailer)
    background(
      (async () => {
        if (!(await claimMailOnce(db, u.id, "welcome", new Date()))) return
        try {
          await send(u.email, who(u))
        } catch (e) {
          await releaseMailOnce(db, u.id, "welcome").catch(onError)
          throw e
        }
      })(),
    )
  }
  const verifyOn = !!mailer?.verifyEmail
  const recentSignIn = (options.recentSignInSeconds ?? RECENT_SIGN_IN_SECONDS) * 1000
  const requireAgeOver14 = options.requireAgeOver14 ?? true
  const signUpEnumeration = options.signUpEnumeration ?? "reveal"
  const conceal = signUpEnumeration === "conceal"
  if (conceal && !mailer?.verifyEmail) throw new Error("signUpEnumeration 'conceal' needs mailer.verifyEmail (new accounts sign in after verifying their email)")
  /** 가입 경로의 동의: 비밀번호 가입은 요청 본문, 소셜 가입은 OAuth 상태(가입을 시작할 때 어댑터가 실었다)에서 읽는다 */
  const consentFrom = async (ctx: { path?: string; body?: unknown } | null | undefined) => {
    const raw = ctx?.path?.startsWith("/callback/") ? ((await getOAuthState()) as Record<string, unknown> | null)?.[CONSENT_FIELD] : (ctx?.body as Record<string, unknown> | undefined)?.[CONSENT_FIELD]
    return readConsentPayload(raw, requireAgeOver14)
  }
  const isSignUpPath = (path: string | undefined) => !!path && (path.startsWith("/sign-up/") || path.startsWith("/callback/"))
  // 2단계를 거치는 로그인도 /sign-in/email 에서 "email"로 적힌다(2단계 훅이 세션 쿠키를 지우는 응답에 플러그인이 반응한다 — 시험으로 확인).
  const plugins: BetterAuthPlugin[] = [lastLoginMethod({ cookieName: LAST_METHOD_COOKIE })]
  if (options.twoFactor) plugins.push(twoFactor({ issuer: options.appName }))
  if (options.organization) plugins.push(organization())
  if (options.admin) {
    if (!options.twoFactor) throw new Error("admin needs twoFactor: true (admins must turn on two-factor authentication)")
    const seconds = typeof options.admin === "object" ? options.admin.impersonationSeconds : undefined
    // 다른 관리자로는 대리 로그인할 수 없다(allowImpersonatingAdmins 기본 false). 관리자는 adminUserIds 가 아니라 role 로만 정한다.
    plugins.push(admin({ adminRoles: [ADMIN_ROLE], defaultRole: "user", impersonationSessionDuration: seconds ?? 3600 }))
    plugins.push(lfAdminPlugin({ db, onError }))
  }
  if (mailer?.magicLink) {
    const send = mailer.magicLink.bind(mailer)
    // 매직 링크는 있는 계정의 로그인만 한다 — 가입은 동의를 받는 signUp 경로로만.
    plugins.push(magicLink({ disableSignUp: true, sendMagicLink: ({ email, url }) => deliver(send, email, url) }))
  }
  // 새 기기 로그인 알림(C06): 로그인으로 세션이 생길 때 그 기기(브라우저·OS)를 기록하고, 이 사용자에게 다른 기기 기록이 있는데 이 기기는 처음이면 알림을 보낸다.
  // - 가입·로그인 경로만 본다(세션 갱신·조회로 newSession 이 생겨도 로그인이 아니다). 2단계 인증이 켜진 계정은 두 번째 단계가 끝난 요청에서 본다.
  // - 이 사용자의 첫 기기(기록 없음)는 조용히 기록만 한다 — 가입 직후·이 기능을 켠 직후 모두에게 알림이 쏟아지지 않게(첫 기기 기록 뒤의 다른 기기부터 알린다).
  // - 대리 로그인(관리자)은 본인 로그인이 아니라 건너뛴다. 응답을 기다리지 않고, 실패는 onError 로만 알린다.
  if (mailer?.newDeviceSignIn) {
    const send = mailer.newDeviceSignIn.bind(mailer)
    const SIGN_IN_PATHS = ["/sign-in/", "/sign-up/", "/callback/", "/magic-link/", "/two-factor/verify", "/verify-email"]
    plugins.push({
      id: "lf-new-device",
      hooks: {
        after: [
          {
            matcher: (ctx) => SIGN_IN_PATHS.some((p) => ctx.path?.startsWith(p)),
            handler: createAuthMiddleware(async (ctx) => {
              const session = ctx.context.newSession
              const u = session?.user as ({ id: string; email: string } & Record<string, unknown>) | undefined
              if (!u?.id || (session?.session as { impersonatedBy?: string | null } | undefined)?.impersonatedBy) return
              try {
                const headers = ctx.request?.headers ?? ctx.headers
                const ua = headers?.get("user-agent")
                const r = who(u)
                const locale = USER_LOCALES.find((l) => l === r.locale) ?? localeFromAcceptLanguage(headers?.get("accept-language")) ?? DEFAULT_LOCALE
                const at = new Date()
                const label = deviceLabel(ua, locale)
                const seen = await recordDevice(db, { userId: u.id, fingerprint: deviceFingerprint(u.id, ua), label, at })
                if (seen.known || !seen.hadOthers || isPlaceholderEmail(u.email)) return
                const location = roughLocation(headers)
                background(send(u.email, { device: label, at, ...(location ? { location } : {}) }, r))
              } catch (e) {
                onError(e) // 알림 실패가 로그인을 막지 않는다
              }
            }),
          },
        ],
      },
    })
  }
  // 탈퇴 유예 중 로그인하면 탈퇴를 취소한다(v0 Task 14). 「로그인」= 세션이 실제로 생긴 요청이다(비밀번호·소셜 콜백·매직 링크·2단계 확인).
  // 맨 뒤에 둔다: 2단계가 켜진 계정의 비밀번호 로그인은 twoFactor 의 after 훅이 세션을 지우고 newSession 을 null 로 만든다 —
  // 비밀번호만 아는 사람이 2단계 없이 탈퇴를 취소하지 못한다(시험으로 확인). 사용자 hooks.after 는 플러그인보다 먼저 돌아서 쓰지 않는다.
  plugins.push({
    id: "lf-account-deletion",
    hooks: {
      after: [
        {
          matcher: () => true,
          handler: createAuthMiddleware(async (ctx) => {
            // 대리 로그인(관리자가 만든 대상의 세션)과 대리 종료(관리자 세션 복원)는 본인 로그인이 아니다 — 탈퇴를 취소하지 않는다(v0 Task 16).
            if (ctx.path?.startsWith("/admin/") || (ctx.context.newSession?.session as { impersonatedBy?: string | null } | undefined)?.impersonatedBy) return
            const userId = ctx.context.newSession?.user?.id
            if (userId) await cancelAccountDeletion(db, userId)
          }),
        },
      ],
    },
  })
  const auth = betterAuth({
    appName: options.appName,
    secret,
    baseURL,
    advanced: {
      backgroundTasks: { handler: options.runInBackground ?? ((task) => void task.catch(onError)) },
      ...(options.ipAddress ? { ipAddress: options.ipAddress } : {}),
    },
    database: drizzleAdapter(db, { provider: "pg", schema }),
    session: { ...SESSION_DEFAULTS, ...options.session },
    emailAndPassword: {
      enabled: true,
      // A12: 재설정 링크 유효 시간을 명시한다(메일 문구의 「1시간」과 같은 값 — LINK_EXPIRES_SECONDS)
      resetPasswordTokenExpiresIn: LINK_EXPIRES_SECONDS,
      sendResetPassword: ({ user, url }) => deliver(mailer && ((to, u) => mailer.passwordReset(to, u, who(user))), user.email, url),
      // D72: 재설정하면 모든 세션을 끝낸다(훔친 세션도 같이 끝난다) + 알림 메일
      revokeSessionsOnPasswordReset: true,
      onPasswordReset: async ({ user }) => notify(user.email, mailer?.passwordChanged && ((to) => mailer.passwordChanged!(to, who(user)))),
      // conceal: Better Auth 1.7.6 은 requireEmailVerification 이면 있는 이메일에도 같은 모양(token: null)으로 답한다(api/routes/sign-up.mjs 155·197행).
      ...(conceal
        ? {
            requireEmailVerification: true,
            onExistingUserSignUp: async ({ user }: { user: { email: string } }) => {
              if (isPlaceholderEmail(user.email)) return
              if (!mailer?.existingAccount) return onError(new Error("auth mailer.existingAccount is not configured"))
              await mailer.existingAccount(user.email).catch(onError)
            },
          }
        : {}),
    },
    // D70: mailer.verifyEmail 이 있으면 가입 뒤 확인 메일을 보낸다. reveal 은 소프트 인증(로그인을 막지 않는다), conceal 은 확인 뒤 로그인(Task 18).
    ...(verifyOn
      ? {
          emailVerification: {
            sendOnSignUp: true,
            autoSignInAfterVerification: conceal,
            // A12: 확인·이메일 변경 링크 유효 시간을 명시한다(메일 문구의 「1시간」과 같은 값)
            expiresIn: LINK_EXPIRES_SECONDS,
            sendVerificationEmail: ({ user, url }: { user: { email: string }; url: string }) =>
              deliver(mailer?.verifyEmail && ((to, u) => mailer.verifyEmail!(to, u, who(user))), user.email, url),
            // D71: 새 주소 확인으로 이메일이 바뀐 순간 옛 주소에 알린다. 토큰은 이 요청에서 Better Auth 가 이미 검증했다(email-verification.mjs).
            afterEmailVerification: async (user: { id: string; email: string }, request?: Request) => {
              const change = changeOf(request)
              // 이메일 변경 확인이 아니면 가입 확인이다 → 환영 메일(G05, 한 번만)
              if (!change) return welcomeOnce(user)
              if (change.from.toLowerCase() === user.email.toLowerCase()) return
              await notify(change.from, mailer?.emailChanged && ((to) => mailer.emailChanged!(to, { newEmail: user.email }, who(user))))
            },
          },
        }
      : {}),
    user: {
      additionalFields: {
        // D74: 크론·웹훅 메일이 쓸 언어·시간대. 가입 때 accept-language·브라우저 시간대로 채운다(아래 훅)
        locale: { type: "string", required: false, input: true },
        timeZone: { type: "string", required: false, input: true },
      },
      // D71: 확인된 주소는 지금 주소 승인 → 새 주소 확인 → 옛 주소 알림. 확인 안 된 주소(카카오 대체 주소 포함)는 새 주소 확인만.
      ...(verifyOn
        ? {
            changeEmail: {
              enabled: true,
              ...(mailer?.changeEmailConfirm
                ? {
                    sendChangeEmailConfirmation: ({ user, newEmail, url }: { user: { email: string }; newEmail: string; url: string }) =>
                      notify(user.email, (to) => mailer.changeEmailConfirm!(to, { newEmail, url }, who(user))),
                  }
                : {}),
            },
          }
        : {}),
    },
    socialProviders: socialProviders(socials, env),
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        // 봇 방어를 동의 검사보다 먼저 본다(계정 유무와 상관없는 응답이라 conceal 의 같은 응답 규칙을 깨지 않는다)
        if (ctx.path === "/sign-up/email" && options.botCheck) {
          const token = (ctx.body as Record<string, unknown> | undefined)?.[TURNSTILE_BODY_FIELD]
          const bot = await options.botCheck.verify({ token: typeof token === "string" ? token : null })
          if (!bot.ok && bot.reason === "unavailable") throw new APIError("SERVICE_UNAVAILABLE", { code: "BOT_CHECK_UNAVAILABLE", message: "Bot check unavailable" })
          if (!bot.ok) throw new APIError("BAD_REQUEST", { code: "BOT_CHECK_FAILED", message: "Bot check failed" })
        }
        // 비밀번호 가입의 동의는 엔드포인트 앞에서 먼저 본다 — 있는 이메일인지 보기 전에 막아야 conceal 에서도 동의 누락 응답이 계정 유무와 상관없이 같다.
        if (ctx.path === "/sign-up/email" && !(await consentFrom(ctx))) {
          throw new APIError("BAD_REQUEST", { code: "CONSENT_REQUIRED", message: "Required consents are missing" })
        }
        // D71 재인증(OWASP): 비밀번호가 있으면 currentPassword 가 맞아야, 없으면(소셜 전용) 방금 로그인한 세션이어야 이메일을 바꾼다.
        // auth.handler 를 /api/auth/* 에 그대로 열기 때문에 어댑터가 아니라 여기서 막는다.
        if (ctx.path === "/change-email") {
          const s = await getSessionFromCtx(ctx)
          if (!s) return // 엔드포인트가 401 을 낸다
          // 대리 로그인 세션은 관리자 조각(lf-admin 플러그인)이 403 IMPERSONATION_BLOCKED 로 막는다 — 재인증 400 이 그 응답을 가리지 않게 넘긴다(v0 Task 16 병합)
          if ((s.session as { impersonatedBy?: string | null }).impersonatedBy) return
          const account = await ctx.context.internalAdapter.findCredentialAccount(s.user.id)
          if (account?.password) {
            const pw = (ctx.body as Record<string, unknown> | undefined)?.currentPassword
            const ok = typeof pw === "string" && pw.length <= 1024 && (await ctx.context.password.verify({ hash: account.password, password: pw }))
            if (!ok) throw new APIError("BAD_REQUEST", { code: "INVALID_PASSWORD", message: "Invalid password" })
          } else if (Date.now() - new Date(s.session.createdAt).getTime() > recentSignIn) {
            throw new APIError("FORBIDDEN", { code: "SESSION_NOT_FRESH", message: "Sign in again to continue" })
          }
        }
      }),
      // D72: 로그인 상태 비밀번호 변경이 끝나면 알림 메일(응답 본문의 user — Better Auth change-password 응답)
      after: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== "/change-password") return
        const returned = ctx.context.returned as { user?: { email?: string } } | undefined
        const user = returned && !(returned instanceof Error) ? returned.user : undefined
        if (user?.email) await notify(user.email, mailer?.passwordChanged && ((to) => mailer.passwordChanged!(to, who(user))))
      }),
    },
    databaseHooks: {
      user: {
        create: {
          before: async (u, ctx) => {
            // 대체 주소는 카카오 콜백만 만든다. 비밀번호 가입으로 남의 카카오 대체 주소를 선점하지 못하게 한다(auth.handler 직접 호출도 막힌다).
            if (isPlaceholderEmail(u.email) && !ctx?.path?.startsWith("/callback/")) {
              throw new APIError("BAD_REQUEST", { code: "INVALID_EMAIL", message: "Reserved email domain" })
            }
            // 가입 경로는 필수 동의(약관·개인정보·만 14세 확인)가 없으면 사용자를 만들지 않는다 — 어댑터를 건너뛰고 /api/auth/* 를 바로 불러도.
            if (isSignUpPath(ctx?.path) && !(await consentFrom(ctx))) {
              throw new APIError("BAD_REQUEST", { code: "CONSENT_REQUIRED", message: "Required consents are missing" })
            }
            // D74: 준 값이 틀리면 버리고, 언어는 accept-language 로 채운다. 시간대를 모르면 비워 둔다(메일은 언어 기본 시간대)
            const r = u as Record<string, unknown>
            const header = ctx?.request?.headers.get("accept-language") ?? ctx?.headers?.get("accept-language")
            const locale = USER_LOCALES.find((l) => l === r.locale) ?? localeFromAcceptLanguage(header)
            return { data: { ...u, locale, timeZone: isTimeZone(r.timeZone) ? r.timeZone : null } }
          },
          // 동의 기록(대장 D40): 사용자 행이 생긴 뒤 같은 요청 안에서 남긴다. 남기지 못하면 사용자도 지우고 실패로 끝낸다 —
          // 동의 증빙 없는 계정을 남기지 않는다.
          after: async (u, ctx) => {
            if (!isSignUpPath(ctx?.path)) return
            const c = await consentFrom(ctx)
            if (!c) return
            try {
              await recordSignUpConsents(db, { userId: u.id, ageOver14: c.ageOver14, marketing: c.marketing, versions: options.consentVersions, locale: c.locale, at: new Date(u.createdAt) })
            } catch (e) {
              await db.delete(schema.user).where(eq(schema.user.id, u.id))
              throw e
            }
            // G05: 공급자(구글 등)가 이미 확인한 이메일로 소셜 가입하면 확인 메일 단계가 없다 — 가입 직후 환영 메일(한 번만).
            if ((u as { emailVerified?: boolean }).emailVerified === true) welcomeOnce(u)
            // A06: 마케팅에 동의했으면 처리 결과를 메일로 알린다. 응답을 기다리지 않고, 실패해도 가입은 그대로다.
            const granted = (Object.keys(c.marketing) as (keyof MarketingChoices)[]).filter((ch) => c.marketing[ch])
            if (options.onSignUpMarketing && granted.length && !isPlaceholderEmail(u.email)) {
              const r = u as Record<string, unknown>
              const sf = (v: unknown) => (typeof v === "string" && v ? v : null)
              const task = Promise.resolve()
                .then(() => options.onSignUpMarketing!({ userId: u.id, email: u.email, name: sf(r.name), locale: sf(r.locale) ?? c.locale, timeZone: sf(r.timeZone), changes: granted.map((channel) => ({ channel, granted: true as const })), at: new Date(u.createdAt) }))
                .catch(onError)
              if (options.runInBackground) options.runInBackground(task)
              else void task
            }
          },
        },
        // D74: 언어·시간대를 바꿀 때 검사한다(/update-user 를 바로 불러도)
        update: {
          before: async (data) => {
            const r = data as Record<string, unknown>
            if ("locale" in r && r.locale !== null && !USER_LOCALES.some((l) => l === r.locale)) {
              throw new APIError("BAD_REQUEST", { code: "INVALID_LOCALE", message: "Unsupported locale" })
            }
            if ("timeZone" in r && r.timeZone !== null && !isTimeZone(r.timeZone)) {
              throw new APIError("BAD_REQUEST", { code: "INVALID_TIME_ZONE", message: "Unknown time zone" })
            }
          },
        },
      },
    },
    // 개발·테스트에서도 켠다(기본값은 production 에서만). 저장소는 DB의 rate_limit 표. 민감 경로는 더 좁게(Task 19).
    // 세션 읽기(/get-session)는 제한하지 않는다 — 쪽 하나를 그릴 때마다 서버 안에서 여러 번 부르는 읽기라 같은 주소(사무실·학교 공유 망)의 방문자들이 한도(10초 100번)를 나눠 쓰면 로그인한 사람이 로그아웃처럼 보인다. 쿠키 열쇠로만 열리는 읽기라 추측 공격 대상이 아니다
    rateLimit: { enabled: true, storage: "database", customRules: { ...SENSITIVE_RATE_LIMITS, "/get-session": false } },
    plugins,
  })
  const lf: LaunchAuthSettings = { requireAgeOver14, signUpEnumeration }
  return Object.assign(auth, { lf })
}

export type Auth = ReturnType<typeof createAuth>
