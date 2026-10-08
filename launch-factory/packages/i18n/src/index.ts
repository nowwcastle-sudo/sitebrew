// @launch-factory/i18n — 사용자에게 보이는 문구의 정본(v0 Task 18, 설계 §7-A 6 「하드코딩 금지」).
// 어댑터·서버 액션·메일 템플릿은 문구를 여기서만 읽는다. 원천에 한글 문자열 리터럴이 없는지는 test/i18n.test.mjs 가 검사한다.
// 값은 `{name}` 자리표시만 쓰는 평문이다. ko 는 해요체다. 자리표시 바로 뒤에는 받침에 따라 바뀌는 조사(을/를·이/가·으로/로)를 붙이지 않는다.
// ko 가 en 과 같은 모양인지는 MESSAGES 의 타입(Record<Locale, Messages>)이 typecheck 에서, 남는 키는 테스트가 잡는다.
import en from "../messages/en.json" with { type: "json" }
import ko from "../messages/ko.json" with { type: "json" }

export type Messages = typeof en
export type Locale = "ko" | "en"
export const LOCALES: readonly Locale[] = ["ko", "en"]
/** 첫 제품이 영어다(Task 4 AUTH_MESSAGES 와 같은 기본) */
export const DEFAULT_LOCALE: Locale = "en"

export const MESSAGES: Readonly<Record<Locale, Messages>> = { en, ko }

export const isLocale = (value: unknown): value is Locale => value === "ko" || value === "en"

export function messages(locale: Locale = DEFAULT_LOCALE): Messages {
  const m = MESSAGES[locale]
  if (!m) throw new Error(`unknown locale: ${String(locale)}`)
  return m
}

type Leaves<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>
}[keyof T & string]
/** 점 표기 키(예: "auth.required") */
export type MessageKey = Leaves<Messages>

/** 문구 안의 자리표시 이름(정렬) */
export function placeholders(text: string): string[] {
  return [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()
}

/** 자리표시를 채운다. 값이 없거나 빈 자리표시가 있으면 던진다 — 빈칸 문구를 사용자에게 보이지 않는다 */
export function fill(text: string, vars: Record<string, string | number> = {}): string {
  const missing = placeholders(text).filter((k) => vars[k] === undefined || vars[k] === "")
  if (missing.length) throw new Error(`missing placeholder value: ${missing.join(", ")}`)
  return text.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k]))
}

/** 키로 문구를 읽는다. 모르는 키는 던진다(타입이 막지만 동적 키 대비) */
export function t(locale: Locale, key: MessageKey, vars?: Record<string, string | number>): string {
  let node: unknown = messages(locale)
  for (const part of key.split(".")) node = (node as Record<string, unknown> | undefined)?.[part]
  if (typeof node !== "string") throw new Error(`unknown message key: ${key}`)
  return vars ? fill(node, vars) : node
}
