// 메일 기본 문구. 정본은 메시지 목록 @launch-factory/i18n 의 `email` 이름공간이다(v0 Task 18, 대장 D35 — 템플릿은 그대로).
import { LOCALES, MESSAGES, type Locale, type Messages } from "@launch-factory/i18n"

export type EmailMessages = Pick<Messages, "email">
export type { Locale }
export { LOCALES }

export const DEFAULT_MESSAGES: Record<Locale, EmailMessages> = { en: { email: MESSAGES.en.email }, ko: { email: MESSAGES.ko.email } }

export function messagesFor(locale: Locale): EmailMessages["email"] {
  const m = DEFAULT_MESSAGES[locale]
  if (!m) throw new Error(`unknown email locale: ${String(locale)}`)
  return m.email
}
