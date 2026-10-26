// 구독 입력 검사(브라우저 PushSubscription.toJSON() 모양). 서버가 이 주소로 직접 POST 하므로 주소 검사가 SSRF 방어선이다.
import { z } from "zod"
import { fieldErrorsFrom, type ValidationResult } from "./field-errors.ts"
import { pushMessages, type PushLocale } from "./messages.ts"

export const ENDPOINT_MAX = 2048
/** P-256 비압축 공개키(0x04 + 64바이트) */
export const P256DH_BYTES = 65
/** Web Push 인증 비밀(16바이트) */
export const AUTH_BYTES = 16

export interface ValidSubscription {
  endpoint: string
  p256dh: string
  auth: string
  expirationTime: number | null
}

const BASE64URL = /^[A-Za-z0-9_-]+$/

/** 패딩 없는 base64url 이고 정확히 `bytes` 바이트로 풀리면 true */
function isBase64urlOf(value: string, bytes: number): boolean {
  if (!BASE64URL.test(value)) return false
  const decoded = Buffer.from(value, "base64url")
  return decoded.length === bytes && decoded.toString("base64url") === value // 되돌려 써서 같아야 정규 표기
}

/** 푸시 서비스가 될 수 없는 호스트(내부망·루프백·IP 직접 지정). 서버가 대신 요청을 보내므로 막는다 */
function hostAllowed(hostname: string): boolean {
  const h = hostname.toLowerCase()
  if (!h.includes(".")) return false // localhost·단일 라벨
  if (h.startsWith("[") || h.includes(":")) return false // IPv6 리터럴
  if (/^\d+(?:\.\d+){3}$/.test(h)) return false // IPv4 리터럴
  if (/(?:^|\.)(?:localhost|local|internal|localdomain|lan|home|corp)$/.test(h)) return false
  return true
}

function endpointIssue(raw: string, m: ReturnType<typeof pushMessages>): string | null {
  if (raw.length > ENDPOINT_MAX) return m.sub.endpointLong
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return m.sub.endpointHttps
  }
  if (url.protocol !== "https:") return m.sub.endpointHttps
  if (url.username || url.password || (url.port && url.port !== "443") || !hostAllowed(url.hostname)) return m.sub.endpointHost
  return null
}

function schemaFor(locale: PushLocale) {
  const m = pushMessages(locale)
  const bad = (message: string) => ({ error: message })
  return z.object({
    endpoint: z
      .string(bad(m.sub.endpointRequired))
      .min(1, bad(m.sub.endpointRequired))
      .superRefine((v, ctx) => {
        const issue = endpointIssue(v, m)
        if (issue) ctx.addIssue({ code: "custom", message: issue })
      }),
    expirationTime: z
      .number(bad(m.sub.expirationTime))
      .int(bad(m.sub.expirationTime))
      .min(0, bad(m.sub.expirationTime))
      .max(Number.MAX_SAFE_INTEGER, bad(m.sub.expirationTime))
      .nullish(),
    keys: z.object(
      {
        p256dh: z.string(bad(m.sub.p256dh)).refine((v) => isBase64urlOf(v, P256DH_BYTES) && v.startsWith("B"), bad(m.sub.p256dh)),
        auth: z.string(bad(m.sub.auth)).refine((v) => isBase64urlOf(v, AUTH_BYTES), bad(m.sub.auth)),
      },
      bad(m.sub.object),
    ),
  })
}

/** 칸 이름은 평평하게 `endpoint`·`p256dh`·`auth`·`expirationTime` (keys 는 한 겹 풀어 쓴다) */
export function validateSubscription(input: unknown, locale: PushLocale = "ko"): ValidationResult<ValidSubscription> {
  const parsed = schemaFor(locale).safeParse(input)
  if (parsed.success) {
    const { endpoint, keys, expirationTime } = parsed.data
    return { ok: true, value: { endpoint, p256dh: keys.p256dh, auth: keys.auth, expirationTime: expirationTime ?? null } }
  }
  return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error.issues, ["keys"]) }
}
