// @launch-factory/push — 웹 푸시(계획 3b, 설계서 9.5). 로그인한 사용자의 기기 구독을 저장하고 VAPID 로 알림을 보낸다(비로그인 방문자는 메일·알림톡, D6).
//
// 책임 나눔: validate(구독 입력) · payload(알림 내용) · transport(한 건 전송) · vapid(키 검사) · messages(문구) · port(NotifyPort 두 메서드) · 여기(서비스: 저장 + 정리 정책).
// 전송기는 주입한다 — 기본은 live 면 web-push, mock 이면 외부 호출 0 의 기록 전송기. DB 는 packages/db 의 push-subscriptions 도우미만 쓴다.
//
// 정리 정책: 푸시 서비스가 404/410 이면 그 기기는 폐기된 것이라 바로 지운다. 401/403(우리 VAPID 설정 문제)은 구독을 건드리지 않는다. 그 밖의 실패는 연속 실패 횟수를 올리고, MAX_CONSECUTIVE_FAILURES(5)를 넘으면 지운다.
// 성공하면 횟수를 0으로 돌린다. 만료 시각(expirationTime)이 지난 구독은 보내지 않고 지운다.
// sendToUser 의 sent·pruned·failed 는 서로 겹치지 않는다: 성공 / 지움(폐기·만료·한도 초과) / 지우지 않은 실패.
import type { ActionResult, IsoDate } from "@launch-factory/contract"
import { bumpPushFailure, deletePushSubscription, deletePushSubscriptionById, listPushSubscriptions, markPushSuccess, upsertPushSubscription, type Database } from "@launch-factory/db"
import { maskPii } from "@launch-factory/security"
import { DEFAULT_PUSH_LOCALE, pushMessages, type PushLocale } from "./messages.ts"
import { preparePayload } from "./payload.ts"
import { recordingTransport, webPushTransport, type PushTransport, type RecordedPush, type SendOptions } from "./transport.ts"
import { validateSubscription } from "./validate.ts"
import { isValidVapid, MOCK_VAPID_PUBLIC_KEY, type VapidConfig } from "./vapid.ts"

export { pushPortMethods } from "./port.ts"
export type { PushPortMethods, UserIdSource } from "./port.ts"
export { preparePayload, isSameOriginPath, PAYLOAD_MAX_BYTES } from "./payload.ts"
export type { PreparedPayload, PushPayload } from "./payload.ts"
export { validateSubscription } from "./validate.ts"
export type { ValidSubscription } from "./validate.ts"
export { recordingTransport, webPushTransport, safeMessage } from "./transport.ts"
export type { PushTarget, PushTransport, RecordedPush, SendNotification, SendOptions, TransportResult } from "./transport.ts"
export { isValidVapid, MOCK_VAPID_PUBLIC_KEY } from "./vapid.ts"
export type { VapidConfig } from "./vapid.ts"
export { pushMessages } from "./messages.ts"
export type { PushLocale, PushMessages } from "./messages.ts"
export type { FieldErrors, ValidationResult } from "./field-errors.ts"

/** 연속 실패가 이 값을 넘으면(6번째 실패) 구독을 지운다 */
export const MAX_CONSECUTIVE_FAILURES = 5
const SENDER_FAULT = new Set([401, 403])
/** 한 번에 동시에 보내는 기기 수 */
const SEND_CONCURRENCY = 5
/** 푸시 서비스가 「이 기기는 없다·폐기됐다」고 답하는 상태 */
const GONE = new Set([404, 410])

export interface PushServiceOptions {
  db: Database
  mode: "mock" | "live"
  /** live 에서만 필요하다. 없거나 모양이 틀리면 enabled=false 이고 subscribe·sendToUser 는 provider_unavailable */
  vapid?: VapidConfig
  /** 한 건 전송기. 없으면 live=web-push, mock=기록만(외부 호출 0). 주입하면 두 모드 모두 그것을 쓴다 */
  transport?: PushTransport
  now?: () => Date
  /** 오류 문구의 언어(기본 ko) */
  locale?: PushLocale
  /** DB 오류 알림. 기본은 개인정보 모양을 가린 한 줄 로그 */
  onError?: (error: unknown) => void
}

export type PushFailure = {
  ok: false
  code: "provider_unavailable" | "invalid_input"
  retryable: boolean
  formError?: string
  fieldErrors?: Partial<Record<string, string[]>>
}
export type PushSendResult = { ok: true; sent: number; pruned: number; failed: number } | PushFailure

export interface PushService {
  /** live 에서 쓸 수 있는 설정이 있다 / mock 이면 항상 true */
  readonly enabled: boolean
  /** 가짜 모드 기본 전송기가 쌓은 「보냄」 기록(주입한 전송기를 쓰면 빈 배열) */
  readonly recorded: readonly RecordedPush[]
  /**
   * 브라우저 `pushManager.subscribe({ applicationServerKey })` 에 줄 공개키.
   * live: 설정한 키(설정이 틀리면 null) · mock: 설정한 키가 있으면 그것, 없으면 MOCK_VAPID_PUBLIC_KEY(실제 P-256 점이지만 보낼 수 없는 키) — null 이면 기능을 끈다.
   */
  publicKey(): string | null
  /** 소유자 이전: 같은 기기(endpoint)를 다른 사용자가 등록하면 그 사용자 것이 된다 */
  subscribe(userId: string, input: unknown, opts?: { locale?: PushLocale }): Promise<ActionResult<{ subscribedAt: IsoDate }>>
  /** 내 기기만 지운다. 없거나 남의 것이어도 같은 성공을 돌려준다(존재 노출 금지) — removed 는 내 것을 지웠는지 */
  unsubscribe(userId: string, endpoint: unknown, opts?: { locale?: PushLocale }): Promise<ActionResult<{ removed: boolean }>>
  sendToUser(userId: string, payload: unknown, opts?: SendOptions & { locale?: PushLocale }): Promise<PushSendResult>
}

const defaultOnError = (error: unknown): void => {
  const text = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
  console.error("[push]", maskPii(text).slice(0, 300))
}

export function createPushService(options: PushServiceOptions): PushService {
  const { db, mode, now = () => new Date(), locale: defaultLocale = DEFAULT_PUSH_LOCALE, onError = defaultOnError } = options
  if (mode !== "mock" && mode !== "live") throw new TypeError(`push: mode 는 "mock" 또는 "live" (받은 값: ${String(mode)})`)

  const vapid = isValidVapid(options.vapid) ? options.vapid : undefined
  const enabled = mode === "mock" || vapid !== undefined
  const recorder = options.transport || mode === "live" ? undefined : recordingTransport()
  // live 인데 설정이 없으면 전송기를 만들지 않는다(enabled=false 로 모든 보내기가 막힌다)
  const transport: PushTransport | undefined = options.transport ?? recorder ?? (vapid ? webPushTransport(vapid) : undefined)

  const unavailable = (locale: PushLocale, configured: boolean): PushFailure => ({
    ok: false,
    code: "provider_unavailable",
    retryable: true,
    formError: configured ? pushMessages(locale).unavailable : pushMessages(locale).notConfigured,
  })
  const invalid = (locale: PushLocale, fieldErrors: Partial<Record<string, string[]>>): PushFailure => ({
    ok: false,
    code: "invalid_input",
    retryable: false,
    formError: pushMessages(locale).invalidInput,
    fieldErrors,
  })
  const validUser = (userId: unknown): userId is string => typeof userId === "string" && userId.length > 0

  return {
    enabled,
    get recorded() {
      return recorder?.sent ?? []
    },
    publicKey() {
      if (mode === "live") return vapid?.publicKey ?? null
      return isValidVapid(options.vapid) ? options.vapid.publicKey : MOCK_VAPID_PUBLIC_KEY
    },

    async subscribe(userId, input, opts) {
      const locale = opts?.locale ?? defaultLocale
      if (!enabled) return unavailable(locale, false)
      if (!validUser(userId)) return invalid(locale, { form: [pushMessages(locale).signInRequired] })
      const checked = validateSubscription(input, locale)
      if (!checked.ok) return invalid(locale, checked.fieldErrors)
      const at = now()
      try {
        await upsertPushSubscription(db, { ...checked.value, userId, createdAt: at })
      } catch (e) {
        onError(e)
        return { ok: false, code: "provider_unavailable", retryable: true, formError: pushMessages(locale).saveFailed }
      }
      return { ok: true, data: { subscribedAt: at.toISOString() } }
    },

    async unsubscribe(userId, endpoint, opts) {
      const locale = opts?.locale ?? defaultLocale
      if (!validUser(userId)) return invalid(locale, { form: [pushMessages(locale).signInRequired] })
      if (typeof endpoint !== "string" || endpoint.length === 0 || endpoint.length > 2048) return invalid(locale, { endpoint: [pushMessages(locale).sub.endpointRequired] })
      try {
        return { ok: true, data: { removed: await deletePushSubscription(db, userId, endpoint) } }
      } catch (e) {
        onError(e)
        return { ok: false, code: "provider_unavailable", retryable: true, formError: pushMessages(locale).saveFailed }
      }
    },

    async sendToUser(userId, payload, opts = {}) {
      const { locale = defaultLocale, ...sendOpts } = opts
      if (!enabled || !transport) return unavailable(locale, false)
      if (!validUser(userId)) return invalid(locale, { form: [pushMessages(locale).signInRequired] })
      const prepared = preparePayload(payload, locale)
      if (!prepared.ok) return invalid(locale, prepared.fieldErrors)
      const { json } = prepared.value

      let subs
      try {
        subs = await listPushSubscriptions(db, userId)
      } catch (e) {
        onError(e)
        return unavailable(locale, true)
      }

      const total = { sent: 0, pruned: 0, failed: 0 }
      const at = now()
      const deliver = async (sub: (typeof subs)[number]): Promise<keyof typeof total> => {
        try {
          if (sub.expirationTime !== null && sub.expirationTime <= at.getTime()) {
            await deletePushSubscriptionById(db, sub.id)
            return "pruned"
          }
          const result = await transport({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, json, sendOpts)
          if (result.ok) {
            await markPushSuccess(db, sub.id, now())
            return "sent"
          }
          if (result.statusCode !== undefined && GONE.has(result.statusCode)) {
            await deletePushSubscriptionById(db, sub.id)
            return "pruned"
          }
          if (result.statusCode !== undefined && SENDER_FAULT.has(result.statusCode)) {
            // 401/403 은 기기가 아니라 우리 VAPID 설정이 틀렸다는 뜻이다 — 구독을 세지도 지우지도 않고 운영자에게 알린다
            onError(new Error(`push service rejected our credentials (${result.statusCode})`))
            return "failed"
          }
          const failures = await bumpPushFailure(db, sub.id)
          if (failures > MAX_CONSECUTIVE_FAILURES) {
            await deletePushSubscriptionById(db, sub.id)
            return "pruned"
          }
          return "failed"
        } catch (e) {
          // 전송기는 던지지 않는 약속이지만, 주입된 전송기·DB 오류가 한 기기 때문에 나머지를 막지 않게 한다
          onError(e)
          return "failed"
        }
      }
      for (let i = 0; i < subs.length; i += SEND_CONCURRENCY) {
        for (const outcome of await Promise.all(subs.slice(i, i + SEND_CONCURRENCY).map(deliver))) total[outcome]++
      }
      return { ok: true, ...total }
    },
  }
}
