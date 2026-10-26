// 전송기: 푸시 서비스로 한 건을 보내는 일 하나만 한다. 서비스는 이 함수 모양에만 기대므로 시험·가짜 모드에서 갈아 끼운다.
// 던지지 않는다 — 어떤 실패든 값(`{ ok: false, statusCode?, message }`)으로 돌려주고, 메시지에서 비밀(개인키)·개인정보 모양을 뺀다.
import { maskPii } from "@launch-factory/security"
import type { VapidConfig } from "./vapid.ts"

export interface PushTarget {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

export type PushUrgency = "very-low" | "low" | "normal" | "high"

export interface SendOptions {
  /** 푸시 서비스가 기기가 꺼져 있을 때 들고 있을 시간(초). 기본 24시간 */
  ttlSeconds?: number
  urgency?: PushUrgency
  /** 소켓 제한 시간(ms). 기본 10초 */
  timeoutMs?: number
}

export type TransportResult = { ok: true } | { ok: false; statusCode?: number; message: string }
export type PushTransport = (sub: PushTarget, payloadJson: string, opts?: SendOptions) => Promise<TransportResult>

export const DEFAULT_TTL_SECONDS = 24 * 60 * 60
export const DEFAULT_TIMEOUT_MS = 10_000
const MESSAGE_MAX = 200

/** web-push 의 `sendNotification` 모양(시험에서 가짜를 넣는다) */
export type SendNotification = (
  sub: PushTarget,
  payload: string,
  options: { TTL: number; urgency: PushUrgency; timeout: number; vapidDetails: VapidConfig },
) => Promise<unknown>

async function defaultSendNotification(): Promise<SendNotification> {
  const mod = (await import("web-push")) as unknown as { default?: { sendNotification: SendNotification }; sendNotification?: SendNotification }
  const lib = mod.default ?? (mod as { sendNotification: SendNotification })
  return lib.sendNotification.bind(lib)
}

/** 오류 문구에서 비밀·개인정보 모양을 가리고 길이를 줄인다 */
export function safeMessage(error: unknown, secrets: readonly string[] = []): string {
  let text = error instanceof Error ? error.message : typeof error === "string" ? error : "send failed"
  for (const s of secrets) if (s) text = text.split(s).join("[redacted]")
  text = maskPii(text).replace(/\s+/g, " ").trim()
  return (text || "send failed").slice(0, MESSAGE_MAX)
}

/**
 * 진짜 전송기. VAPID 는 호출마다 옵션으로 넘긴다(web-push 의 전역 `setVapidDetails` 를 건드리지 않아 서로 다른 설정이 섞이지 않는다).
 * 푸시 서비스의 404·410 은 `statusCode` 에 담겨 나가 서비스가 구독을 지운다.
 */
export function webPushTransport(vapid: VapidConfig, deps: { sendNotification?: SendNotification } = {}): PushTransport {
  const secrets = [vapid.privateKey]
  let loaded = deps.sendNotification ? Promise.resolve(deps.sendNotification) : undefined
  return async (sub, payloadJson, opts = {}) => {
    try {
      loaded ??= defaultSendNotification()
      const send = await loaded
      await send(sub, payloadJson, {
        TTL: opts.ttlSeconds ?? DEFAULT_TTL_SECONDS,
        urgency: opts.urgency ?? "normal",
        timeout: opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        vapidDetails: vapid,
      })
      return { ok: true }
    } catch (e) {
      const statusCode = typeof (e as { statusCode?: unknown })?.statusCode === "number" ? (e as { statusCode: number }).statusCode : undefined
      return { ok: false, ...(statusCode !== undefined && { statusCode }), message: safeMessage(e, secrets) }
    }
  }
}

export interface RecordedPush {
  endpoint: string
  payload: string
  opts: SendOptions
}

/** 가짜 모드용 전송기: 외부 호출 없이 「보냄」만 쌓는다. `sent` 에는 키(p256dh·auth)를 담지 않는다 */
export function recordingTransport(): PushTransport & { sent: RecordedPush[]; clear(): void } {
  const sent: RecordedPush[] = []
  const transport: PushTransport = async (sub, payloadJson, opts = {}) => {
    sent.push({ endpoint: sub.endpoint, payload: payloadJson, opts: { ...opts } })
    return { ok: true }
  }
  return Object.assign(transport, { sent, clear: () => void sent.splice(0) })
}
