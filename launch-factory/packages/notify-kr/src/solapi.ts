// Solapi REST(메시지 v4) — SDK 없이 fetch + HMAC-SHA256. fetch 는 주입한다(시험은 가짜 fetch).
// 어떤 경로로도 던지지 않는다: 네트워크 오류·비 2xx·접수 실패는 모두 값(`{ ok: false, reason }`)이다.
// 오류 문자열에는 API 키·비밀키·전화번호 전체가 들어가지 않는다(scrub).
import { createHmac, randomBytes } from "node:crypto"
import { maskPii } from "@launch-factory/security"

export const SOLAPI_ENDPOINT = "https://api.solapi.com/messages/v4/send-many/detail"

export interface SolapiConfig {
  apiKey: string
  apiSecret: string
  /** 카카오 채널(알림톡 발신 프로필) id */
  pfId: string
  /** 발신번호(Solapi 에 등록한 번호) */
  sender: string
}

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>

/** 32자 난수(16바이트 hex) */
export const newSalt = (): string => randomBytes(16).toString("hex")

/** Authorization 머리. signature = hex(HMAC-SHA256(apiSecret, date + salt)), date 는 ISO 8601 */
export function authHeader(apiKey: string, apiSecret: string, now: Date, salt: string): string {
  const date = now.toISOString()
  const signature = createHmac("sha256", apiSecret).update(date + salt).digest("hex")
  return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`
}

export type SolapiMessage =
  | { to: string; from: string; type: "ATA"; text: string; kakaoOptions: { pfId: string; templateId: string; variables: Record<string, string>; disableSms: boolean } }
  | { to: string; from: string; type: "SMS" | "LMS"; text: string }

export type BuildInput =
  | { kind: "ata"; to: string; from: string; pfId: string; templateId: string; requiredVars: readonly string[]; vars: Record<string, string>; text: string; disableSms?: boolean }
  | { kind: "sms"; to: string; from: string; text: string }
export type BuildResult = { ok: true; message: SolapiMessage } | { ok: false; reason: string }

/** 90바이트(EUC-KR 기준: 한글 2바이트·그 밖 1바이트)를 넘으면 장문(LMS) */
export function smsType(text: string): "SMS" | "LMS" {
  let bytes = 0
  for (const ch of text) bytes += (ch.codePointAt(0) as number) > 0x7f ? 2 : 1
  return bytes > 90 ? "LMS" : "SMS"
}

const keyOf = (name: string): string => (name.startsWith("#{") ? name : `#{${name}}`)

/**
 * 보낼 메시지 한 건을 만든다. 알림톡은 템플릿이 요구한 변수가 하나라도 빠지면 만들지 않는다(`missing_vars:이름,…` — 값은 싣지 않는다).
 * 변수 키는 `#{이름}` 으로 감싸 보낸다(이미 감싸 있으면 그대로).
 */
export function buildMessage(input: BuildInput): BuildResult {
  if (input.kind === "sms") {
    if (!input.text.trim()) return { ok: false, reason: "empty_text" }
    return { ok: true, message: { to: input.to, from: input.from, type: smsType(input.text), text: input.text } }
  }
  const wrapped = Object.fromEntries(Object.entries(input.vars).map(([k, v]) => [keyOf(k), v]))
  const missing = input.requiredVars.filter((name) => typeof wrapped[keyOf(name)] !== "string" || wrapped[keyOf(name)]?.trim() === "")
  if (missing.length > 0) return { ok: false, reason: `missing_vars:${missing.join(",")}` }
  return {
    ok: true,
    message: {
      to: input.to,
      from: input.from,
      type: "ATA",
      text: input.text,
      kakaoOptions: { pfId: input.pfId, templateId: input.templateId, variables: wrapped, disableSms: input.disableSms ?? false },
    },
  }
}

export type SendOutcome = { ok: true; providerRef: string } | { ok: false; reason: string }

/** 키·비밀키·긴 숫자열(전화번호)을 가리고 길이를 줄인다. 오류 문자열은 모두 이것을 거친다 */
export function scrub(text: string, secrets: readonly string[] = []): string {
  let out = String(text)
  for (const s of secrets) if (s && s.length >= 4) out = out.split(s).join("[secret]")
  out = maskPii(out).replace(/\d{7,}/g, "[number]")
  return out.length > 160 ? `${out.slice(0, 160)}…` : out
}

export interface SendSolapiOptions {
  now?: Date
  salt?: string
  /** 응답을 기다리는 최대 시간(ms, 기본 10000) */
  timeoutMs?: number
}

/** 메시지를 Solapi 에 보낸다. 접수 실패(`failedMessageList`)·네트워크 오류·비 2xx 는 `{ ok: false, reason }` */
export async function sendSolapi(fetchFn: FetchLike, config: Pick<SolapiConfig, "apiKey" | "apiSecret">, messages: SolapiMessage[], options: SendSolapiOptions = {}): Promise<SendOutcome> {
  const secrets = [config.apiKey, config.apiSecret]
  let response: Response
  try {
    response = await fetchFn(SOLAPI_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: authHeader(config.apiKey, config.apiSecret, options.now ?? new Date(), options.salt ?? newSalt()),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messages }),
      signal: AbortSignal.timeout(options.timeoutMs ?? 10_000),
    })
  } catch (error) {
    const name = error instanceof Error ? error.name : "Error"
    return { ok: false, reason: `network_error:${scrub(name, secrets)}` }
  }
  let body: unknown
  try {
    body = await response.json()
  } catch {
    body = undefined
  }
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {}
  if (!response.ok) {
    const code = typeof record.errorCode === "string" ? `:${scrub(record.errorCode, secrets)}` : ""
    const message = typeof record.errorMessage === "string" ? `:${scrub(record.errorMessage, secrets)}` : ""
    return { ok: false, reason: `http_${response.status}${code}${message}` }
  }
  const failed = Array.isArray(record.failedMessageList) ? record.failedMessageList : undefined
  if (!failed || !record.groupInfo || typeof record.groupInfo !== "object") return { ok: false, reason: "bad_response" }
  if (failed.length > 0) {
    const first = (failed[0] ?? {}) as Record<string, unknown>
    const code = first.statusCode !== undefined ? scrub(String(first.statusCode), secrets) : "unknown"
    const message = typeof first.statusMessage === "string" ? `:${scrub(first.statusMessage, secrets)}` : ""
    return { ok: false, reason: `rejected:${code}${message}` }
  }
  const groupId = (record.groupInfo as Record<string, unknown>).groupId
  return { ok: true, providerRef: typeof groupId === "string" && groupId ? groupId : "unknown" }
}
