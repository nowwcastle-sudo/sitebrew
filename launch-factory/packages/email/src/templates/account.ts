// 계정 보안 메일 넷(v0 Task 19): 이메일 확인(D70), 이메일 변경 승인·변경 알림(D71, OWASP — 옛 주소에 알린다), 비밀번호 변경 알림(D72).
// 링크(verifyUrl·approveUrl)는 Better Auth 가 만든 기한 있는 주소다. 이 파일은 받은 주소를 그대로 버튼에 싣는다.
import type { IsoDate } from "@launch-factory/contract"
import type { EmailMessages } from "../messages/index.ts"
import { fill, formatDate, isValidDate } from "../format.ts"
import { actions, checkBase, copyOf, DEFAULT_LINK_VALID_MINUTES, layout, p, requireLink, throwIfProblems, timeZoneOf, validityOf, type BaseInput, type BuiltEmail } from "./layout.ts"

const isEmail = (v: unknown): v is string => typeof v === "string" && /^[^\s@]+@[^\s@]+$/.test(v)

export interface VerifyEmailInput extends BaseInput<EmailMessages["email"]["verifyEmail"]> {
  verifyUrl: string
  /** 링크가 유효한 시간(분). 기본 60 — Better Auth 기본값과 같다(A12) */
  linkValidMinutes?: number
  /** 「제가 가입한 게 아니에요」 링크(서명 토큰 — 누르면 아직 확인되지 않은 그 계정을 지운다, A13). 없으면 이 줄을 싣지 않는다 */
  notMeUrl?: string
}

export function verifyEmail(input: VerifyEmailInput): BuiltEmail {
  const problems: string[] = []
  checkBase(input, problems)
  requireLink(input.verifyUrl, "verifyUrl", problems)
  if (input.notMeUrl !== undefined) requireLink(input.notMeUrl, "notMeUrl", problems)
  throwIfProblems("verifyEmail", problems)
  const t = copyOf(input, "verifyEmail")
  const v = { productName: input.productName }
  const duration = validityOf(input.linkValidMinutes ?? DEFAULT_LINK_VALID_MINUTES, input.locale)
  const notMe = input.notMeUrl ? [p(t.notMeNote), actions(input.locale, [{ href: input.notMeUrl, label: t.notMeCta, secondary: true }])] : []
  return {
    subject: fill(t.subject, v, "verifyEmail.subject"),
    element: layout(input, {
      preview: fill(t.preview, v, "verifyEmail.preview"),
      heading: t.heading,
      children: [p(t.body), actions(input.locale, [{ href: input.verifyUrl, label: t.cta }]), p(fill(t.expiryNote, { duration }, "verifyEmail.expiryNote")), p(t.ignoreNote), ...notMe],
    }),
  }
}

export interface EmailChangeConfirmInput extends BaseInput<EmailMessages["email"]["emailChangeConfirm"]> {
  newEmail: string
  approveUrl: string
  /** 링크가 유효한 시간(분). 기본 60 */
  linkValidMinutes?: number
}

/** 지금 주소로 보내는 변경 승인 요청(Better Auth sendChangeEmailConfirmation) */
export function emailChangeConfirm(input: EmailChangeConfirmInput): BuiltEmail {
  const problems: string[] = []
  checkBase(input, problems)
  if (!isEmail(input.newEmail)) problems.push("newEmail must be an email address")
  requireLink(input.approveUrl, "approveUrl", problems)
  throwIfProblems("emailChangeConfirm", problems)
  const t = copyOf(input, "emailChangeConfirm")
  const v = { productName: input.productName, newEmail: input.newEmail }
  return {
    subject: fill(t.subject, v, "emailChangeConfirm.subject"),
    element: layout(input, {
      preview: fill(t.preview, v, "emailChangeConfirm.preview"),
      heading: t.heading,
      children: [
        p(fill(t.body, v, "emailChangeConfirm.body")),
        p(t.nextStep),
        actions(input.locale, [{ href: input.approveUrl, label: t.cta }]),
        p(fill(t.expiryNote, { duration: validityOf(input.linkValidMinutes ?? DEFAULT_LINK_VALID_MINUTES, input.locale) }, "emailChangeConfirm.expiryNote")),
        p(t.securityNote, true),
      ],
    }),
  }
}

export interface EmailChangedInput extends BaseInput<EmailMessages["email"]["emailChanged"]> {
  newEmail: string
  /** 비밀번호 재설정·도움 화면(선택) */
  securityUrl?: string
  /** 「저희에게 알려 주세요」가 가리키는 문의 화면(C02). 없으면 버튼을 싣지 않는다 */
  contactUrl?: string
}

/** 바뀐 뒤 옛 주소로 보내는 알림 */
export function emailChanged(input: EmailChangedInput): BuiltEmail {
  const problems: string[] = []
  checkBase(input, problems)
  if (!isEmail(input.newEmail)) problems.push("newEmail must be an email address")
  if (input.securityUrl !== undefined) requireLink(input.securityUrl, "securityUrl", problems)
  if (input.contactUrl !== undefined) requireLink(input.contactUrl, "contactUrl", problems)
  throwIfProblems("emailChanged", problems)
  const t = copyOf(input, "emailChanged")
  const v = { productName: input.productName, newEmail: input.newEmail }
  const children = [p(fill(t.body, v, "emailChanged.body")), p(t.securityNote, true)]
  const buttons = [
    ...(input.securityUrl ? [{ href: input.securityUrl, label: t.cta, secondary: true }] : []),
    ...(input.contactUrl ? [{ href: input.contactUrl, label: t.contactCta, secondary: true }] : []),
  ]
  if (buttons.length) children.push(actions(input.locale, buttons))
  return {
    subject: fill(t.subject, v, "emailChanged.subject"),
    element: layout(input, { preview: fill(t.preview, v, "emailChanged.preview"), heading: t.heading, children }),
  }
}

export interface PasswordResetInput extends BaseInput<EmailMessages["email"]["passwordReset"]> {
  /** Better Auth 가 만든 기한 있는 재설정 주소(sendResetPassword 의 url). 받은 그대로 버튼에 싣는다 */
  resetUrl: string
  /** 링크가 유효한 시간(분). 기본 60 — Better Auth 기본값과 같다(A12 와 같은 규칙) */
  linkValidMinutes?: number
}

/** 비밀번호 재설정 링크(Better Auth emailAndPassword.sendResetPassword) */
export function passwordReset(input: PasswordResetInput): BuiltEmail {
  const problems: string[] = []
  checkBase(input, problems)
  requireLink(input.resetUrl, "resetUrl", problems)
  throwIfProblems("passwordReset", problems)
  const t = copyOf(input, "passwordReset")
  const v = { productName: input.productName }
  return {
    subject: fill(t.subject, v, "passwordReset.subject"),
    element: layout(input, {
      preview: fill(t.preview, v, "passwordReset.preview"),
      heading: t.heading,
      children: [p(fill(t.body, v, "passwordReset.body")), actions(input.locale, [{ href: input.resetUrl, label: t.cta }]), p(fill(t.expiryNote, { duration: validityOf(input.linkValidMinutes ?? DEFAULT_LINK_VALID_MINUTES, input.locale) }, "passwordReset.expiryNote")), p(t.ignoreNote)],
    }),
  }
}

export interface PasswordChangedInput extends BaseInput<EmailMessages["email"]["passwordChanged"]> {
  changedAt: IsoDate
  securityUrl?: string
  /** 「저희에게 알려 주세요」가 가리키는 문의 화면(C02). 없으면 버튼을 싣지 않는다 */
  contactUrl?: string
}

/** 비밀번호 변경·재설정 뒤 알림 */
export function passwordChanged(input: PasswordChangedInput): BuiltEmail {
  const problems: string[] = []
  checkBase(input, problems)
  if (!isValidDate(input.changedAt)) problems.push("changedAt must be an ISO date")
  if (input.securityUrl !== undefined) requireLink(input.securityUrl, "securityUrl", problems)
  if (input.contactUrl !== undefined) requireLink(input.contactUrl, "contactUrl", problems)
  throwIfProblems("passwordChanged", problems)
  const t = copyOf(input, "passwordChanged")
  const v = { productName: input.productName, changedAt: formatDate(input.changedAt, input.locale, timeZoneOf(input), true) }
  const children = [p(fill(t.body, v, "passwordChanged.body")), p(t.securityNote, true)]
  const buttons = [
    ...(input.securityUrl ? [{ href: input.securityUrl, label: t.cta, secondary: true }] : []),
    ...(input.contactUrl ? [{ href: input.contactUrl, label: t.contactCta, secondary: true }] : []),
  ]
  if (buttons.length) children.push(actions(input.locale, buttons))
  return {
    subject: fill(t.subject, v, "passwordChanged.subject"),
    element: layout(input, { preview: fill(t.preview, v, "passwordChanged.preview"), heading: t.heading, children }),
  }
}

export interface AccountDeletionRequestedInput extends BaseInput<EmailMessages["email"]["accountDeletionRequested"]> {
  /** 유예가 끝나 계정을 지우는 날(ISO) */
  graceUntil: IsoDate
  /** 로그인 화면 — 유예 안에 로그인하면 지우기가 취소된다(D09) */
  signInUrl: string
}

/** 탈퇴를 접수했다는 알림(D09). 무엇이 지워지고 무엇이 남는지, 언제까지 되돌릴 수 있는지를 밝힌다 */
export function accountDeletionRequested(input: AccountDeletionRequestedInput): BuiltEmail {
  const problems: string[] = []
  checkBase(input, problems)
  if (!isValidDate(input.graceUntil)) problems.push("graceUntil must be an ISO date")
  requireLink(input.signInUrl, "signInUrl", problems)
  throwIfProblems("accountDeletionRequested", problems)
  const t = copyOf(input, "accountDeletionRequested")
  const v = { productName: input.productName, graceUntil: formatDate(input.graceUntil, input.locale, timeZoneOf(input), true) }
  return {
    subject: fill(t.subject, v, "accountDeletionRequested.subject"),
    element: layout(input, {
      preview: fill(t.preview, v, "accountDeletionRequested.preview"),
      heading: t.heading,
      children: [
        p(fill(t.body, v, "accountDeletionRequested.body")),
        p(t.undo),
        p(t.kept),
        actions(input.locale, [{ href: input.signInUrl, label: t.cta }]),
        p(t.securityNote, true),
      ],
    }),
  }
}
