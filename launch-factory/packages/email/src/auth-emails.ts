// 인증 메일 다리(v0 Task 19). Better Auth 설정(@launch-factory/auth createAuth 의 mailer)에 넣는 계정 보안 메일 넷을 이 패키지의 Mailer 로 보낸다.
// auth 패키지를 불러오지 않는다 — 모양(AuthMailer 의 선택 메서드)만 맞춘다. 받는 사람의 언어·시간대는 사용자 행(D74)에서 온다.
// 보내기 실패는 던진다: auth 쪽 deliver 가 받아 onError 로만 알린다(사용자 응답은 바뀌지 않는다).
import type { Mailer } from "./send.ts"
import { LOCALES, type Locale } from "./messages/index.ts"
import { DEFAULT_LINK_VALID_MINUTES } from "./templates/layout.ts"

/** 받는 사람. 언어·시간대는 사용자 칸(locale·timeZone)이고, 없거나 모르는 값이면 기본값을 쓴다 */
export interface Recipient {
  /** 사용자 id(서명 링크를 만들 때만 쓴다 — 메일에는 싣지 않는다) */
  id?: string | null
  name?: string | null
  locale?: string | null
  timeZone?: string | null
}

export interface AuthEmailsOptions {
  productName: string
  /** 사용자 칸이 비었을 때 쓰는 언어 */
  defaultLocale: Locale
  /** 알림 메일의 「계정 보호하기」 버튼(비밀번호 재설정 화면). 없으면 버튼을 싣지 않는다 */
  securityUrl?: string
  /** 비밀번호 변경 알림의 「문의하기」 버튼(문의 화면). 없으면 버튼을 싣지 않는다 */
  contactUrl?: string
  /** 확인·재설정·변경 승인 링크가 유효한 시간(분). 기본 60 — createAuth 가 같은 값을 Better Auth 설정에 넣는다(auth 패키지의 LINK_EXPIRES_SECONDS) */
  linkValidMinutes?: number
  /** 환영 메일의 시작 화면 주소(없으면 welcome 은 보내지 않고 던진다) */
  appUrl?: string
  /** 확인 메일의 「제가 가입한 게 아니에요」 서명 링크를 만든다(A13). 없으면 그 줄을 싣지 않는다 */
  notMeUrl?: (r: Recipient) => string | undefined
  now?: () => Date
}

export function localeOf(r: Recipient | undefined, fallback: Locale): Locale {
  return LOCALES.find((l) => l === r?.locale) ?? fallback
}

/** IANA 시간대 이름인지(Intl 이 아는 이름만) */
export function isTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || !value) return false
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value })
    return true
  } catch {
    return false
  }
}

/** 받는 사람 칸(언어·이름·시간대)을 템플릿 공통 입력으로 바꾼다 — 계정 보안 메일과 동의 통지 메일이 함께 쓴다 */
export function base(r: Recipient | undefined, o: { productName: string; defaultLocale: Locale }) {
  return {
    locale: localeOf(r, o.defaultLocale),
    productName: o.productName,
    ...(r?.name ? { recipientName: r.name } : {}),
    ...(isTimeZone(r?.timeZone) ? { timeZone: r.timeZone } : {}),
  }
}

export async function must(result: Promise<{ ok: boolean; error?: { name: string } }>, what: string): Promise<void> {
  const r = await result
  if (!r.ok) throw new Error(`${what} email failed: ${r.error?.name ?? "unknown"}`)
}

export function authEmails(mailer: Mailer, o: AuthEmailsOptions) {
  const now = o.now ?? (() => new Date())
  const security = o.securityUrl ? { securityUrl: o.securityUrl } : {}
  const contact = o.contactUrl ? { contactUrl: o.contactUrl } : {}
  const linkValidMinutes = o.linkValidMinutes ?? DEFAULT_LINK_VALID_MINUTES
  return {
    passwordReset: (to: string, url: string, r?: Recipient) => must(mailer.send({ to, template: "passwordReset", input: { ...base(r, o), resetUrl: url, linkValidMinutes } }), "passwordReset"),
    verifyEmail: (to: string, url: string, r?: Recipient) => {
      const notMeUrl = r && o.notMeUrl?.(r)
      return must(mailer.send({ to, template: "verifyEmail", input: { ...base(r, o), verifyUrl: url, linkValidMinutes, ...(notMeUrl ? { notMeUrl } : {}) } }), "verifyEmail")
    },
    changeEmailConfirm: (to: string, input: { newEmail: string; url: string }, r?: Recipient) =>
      must(mailer.send({ to, template: "emailChangeConfirm", input: { ...base(r, o), newEmail: input.newEmail, approveUrl: input.url, linkValidMinutes } }), "emailChangeConfirm"),
    emailChanged: (to: string, input: { newEmail: string }, r?: Recipient) =>
      must(mailer.send({ to, template: "emailChanged", input: { ...base(r, o), newEmail: input.newEmail, ...security, ...contact } }), "emailChanged"),
    /** D09: 탈퇴 접수 알림. 유예 안에 signInUrl 로 로그인하면 지우기가 취소된다 */
    accountDeletionRequested: (to: string, input: { graceUntil: string; signInUrl: string }, r?: Recipient) =>
      must(mailer.send({ to, template: "accountDeletionRequested", input: { ...base(r, o), graceUntil: input.graceUntil, signInUrl: input.signInUrl } }), "accountDeletionRequested"),
    passwordChanged: (to: string, r?: Recipient) =>
      must(mailer.send({ to, template: "passwordChanged", input: { ...base(r, o), changedAt: now().toISOString(), ...security, ...contact } }), "passwordChanged"),
    /** 이메일을 확인한 뒤 한 번 보내는 환영 메일(G05). 한 번만 보내는 일은 부르는 쪽이 맡는다(auth 패키지의 mail_once 기록) */
    welcome: (to: string, r?: Recipient) => {
      if (!o.appUrl) throw new Error("authEmails: appUrl is required to send the welcome email")
      return must(mailer.send({ to, template: "welcome", input: { ...base(r, o), appUrl: o.appUrl } }), "welcome")
    },
    /** 처음 보는 기기로 로그인했다는 알림(C06). location 은 알 때만 */
    newDeviceSignIn: (to: string, input: { device: string; at: Date; location?: string }, r?: Recipient) =>
      must(
        mailer.send({ to, template: "newDeviceSignIn", input: { ...base(r, o), device: input.device, signedInAt: input.at.toISOString(), ...(input.location ? { location: input.location } : {}), ...security } }),
        "newDeviceSignIn",
      ),
  }
}
