// 알림 페이로드: 검사 + JSON 직렬화 + 크기 제한. 푸시 서비스는 암호화 뒤 약 4KB 까지만 받으므로 평문은 3,500바이트(UTF-8)로 막는다.
import { z } from "zod"
import { pushMessages, type PushLocale } from "./messages.ts"
import { fieldErrorsFrom, type ValidationResult } from "./field-errors.ts"

export const PAYLOAD_MAX_BYTES = 3500
export const TITLE_MAX = 120
export const BODY_MAX = 1000
export const TAG_MAX = 64

export interface PushPayload {
  title: string
  body?: string
  /** 눌렀을 때 열 곳 — 이 사이트 안 경로만 */
  url?: string
  tag?: string
  /** 같은 출처의 이미지 경로 */
  icon?: string
}

export interface PreparedPayload {
  value: PushPayload
  /** 전송기에 넘길 JSON 문자열 */
  json: string
  bytes: number
}

/** 제어 문자(C0·DEL)가 있는가. `allowNewline` 이면 줄바꿈(\n)은 봐준다 */
function hasControl(value: string, allowNewline = false): boolean {
  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i)
    if ((c < 0x20 && !(allowNewline && c === 0x0a)) || c === 0x7f) return true
  }
  return false
}

/** `/`로 시작하는 같은 출처 경로인가. `//host`·`/\host`·`scheme:`·제어 문자·`..` 로 밖에 닿는 모양은 거절 */
export function isSameOriginPath(value: string): boolean {
  if (value.length === 0 || value.length > 1024) return false
  if (value[0] !== "/" || value[1] === "/" || value[1] === "\\") return false
  if (value.includes("\\") || hasControl(value)) return false
  try {
    const base = "https://same-origin.invalid"
    return new URL(value, base).origin === base
  } catch {
    return false
  }
}

function schemaFor(locale: PushLocale) {
  const m = pushMessages(locale)
  const e = (message: string) => ({ error: message })
  const path = (message: string) => z.string(e(message)).refine(isSameOriginPath, e(message))
  return z.object(
    {
      title: z
        .string(e(m.payload.titleRequired))
        .trim()
        .min(1, e(m.payload.titleRequired))
        .max(TITLE_MAX, e(m.payload.titleLong))
        .refine((v) => !hasControl(v), e(m.payload.titleRequired)),
      body: z.string(e(m.payload.bodyLong)).max(BODY_MAX, e(m.payload.bodyLong)).refine((v) => !hasControl(v, true), e(m.payload.bodyLong)).optional(),
      url: path(m.payload.url).optional(),
      tag: z.string(e(m.payload.tag)).min(1, e(m.payload.tag)).max(TAG_MAX, e(m.payload.tag)).regex(/^[A-Za-z0-9._:-]+$/, e(m.payload.tag)).optional(),
      icon: path(m.payload.icon).optional(),
    },
    e(m.payload.object),
  )
}

/** 알려진 칸만 남겨 직렬화한다(모르는 칸은 버린다). 직렬화가 크기 한도를 넘으면 `payload` 칸 오류 */
export function preparePayload(input: unknown, locale: PushLocale = "ko"): ValidationResult<PreparedPayload> {
  const parsed = schemaFor(locale).safeParse(input)
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error.issues) }
  const { title, body, url, tag, icon } = parsed.data
  const value: PushPayload = { title, ...(body !== undefined && { body }), ...(url !== undefined && { url }), ...(tag !== undefined && { tag }), ...(icon !== undefined && { icon }) }
  const json = JSON.stringify(value)
  const bytes = Buffer.byteLength(json, "utf8")
  if (bytes > PAYLOAD_MAX_BYTES) return { ok: false, fieldErrors: { payload: [pushMessages(locale).payload.tooLarge] } }
  return { ok: true, value: { value, json, bytes } }
}
