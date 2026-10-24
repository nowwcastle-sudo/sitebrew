// @launch-factory/notify-kr — 한국 알림 발송(Solapi 알림톡·문자).
//   • 정보성(transactional): 알림톡을 먼저 시도하고 실패하면 문자(SMS/LMS)로 대신한다. 알림톡 템플릿 id·카카오 채널이 없으면 처음부터 문자.
//   • 광고성(marketing): 알림톡은 쓰지 않는다. 문자만, 그리고 채널 동의·야간 금지·「(광고)」 머리·수신거부 문구와 번호가 모두 맞을 때만(아니면 skipped + 이유).
//   • 같은 멱등 키는 한 번만 보낸다(notifications 표에서 키를 먼저 차지한 쪽만 보낸다).
//   • mock 은 외부 호출 0 — 발송함 파일(JSONL)에 끝 4자리·템플릿·채널·시각만 남긴다.
// 모듈: phone(번호) · templates(문구 데이터) · solapi(서명·메시지·전송) · marketing(광고 규칙) · consent-guard(동의 확인) · outbox(가짜 발송함).
import { claimNotification, NOTIFICATION_RETENTION_DAYS, settleNotification, type Database, type NotificationChannel } from "@launch-factory/db"
import { maskPii } from "@launch-factory/security"
import { runCanMarketing, type CanMarketing } from "./consent-guard.ts"
import { checkMarketingText, composeMarketingText, isNight } from "./marketing.ts"
import { appendOutbox } from "./outbox.ts"
import { last4, normalizeKrMobile } from "./phone.ts"
import { buildMessage, scrub, sendSolapi, smsType, type FetchLike, type SolapiConfig } from "./solapi.ts"
import { alimtalkVariables, checkTemplates, missingVars, renderSms, type NotifyTemplate, type NotifyTemplates, type SmsLocale } from "./templates.ts"

export * from "./phone.ts"
export * from "./templates.ts"
export * from "./marketing.ts"
export * from "./consent-guard.ts"
export * from "./outbox.ts"
export { authHeader, buildMessage, newSalt, scrub, sendSolapi, smsType, SOLAPI_ENDPOINT } from "./solapi.ts"
export type { BuildInput, BuildResult, FetchLike, SendOutcome, SolapiConfig, SolapiMessage } from "./solapi.ts"

export type NotifyPurpose = "transactional" | "marketing"

export interface NotifyKrOptions {
  db: Database
  mode: "mock" | "live"
  /** live 에서 필요(apiKey·apiSecret·sender). pfId 가 없으면 알림톡 없이 문자만 */
  solapi?: SolapiConfig
  templates: NotifyTemplates
  /** 광고 문자 끝에 붙는 무료수신거부 번호. 없으면 광고성은 모두 skipped */
  optOut?: { number: string }
  /** 기본 globalThis.fetch. mock 에서는 주입해도 부르지 않는다 */
  fetch?: FetchLike
  /** mock 발송함 JSONL 경로 */
  outbox?: string
  now?: () => Date
  /** 광고성 동의 확인기(기본은 거절). 보통 `consentGuard(db)` */
  canMarketing?: CanMarketing
  /** 한 줄 로그(개인정보는 가려서 넘긴다) */
  log?: (line: string) => void
}

export interface SendInput {
  /** 받는 사람 휴대전화(`010-1234-5678` · `+82 10…`) */
  to: string
  template: string
  vars?: Record<string, string | undefined>
  purpose: NotifyPurpose
  /** 광고성이면 필수 — 동의 확인 대상 */
  userId?: string
  idempotencyKey: string
  /** 문자 본문 언어(기본 ko) */
  locale?: SmsLocale
}

export type SendResult = { ok: true; channel: NotificationChannel; providerRef: string } | { ok: false; status: "skipped" | "failed"; reason: string }

export interface NotifyKr {
  send(input: SendInput): Promise<SendResult>
}

const DAY_MS = 86_400_000
const SKIP_KEY = (reason: string, key: string) => `skipped:${reason}:${key}`

export function createNotifyKr(options: NotifyKrOptions): NotifyKr {
  const problems = checkTemplates(options.templates)
  if (problems.length > 0) throw new Error(`notify-kr: invalid templates\n- ${problems.join("\n- ")}`)
  if (options.mode !== "mock" && options.mode !== "live") throw new Error('notify-kr: mode must be "mock" or "live"')
  const { db, mode, templates } = options
  const now = options.now ?? (() => new Date())
  const secrets = [options.solapi?.apiKey ?? "", options.solapi?.apiSecret ?? ""]
  const solapiReady = Boolean(options.solapi?.apiKey && options.solapi.apiSecret && normalizeSender(options.solapi.sender))

  const log = (event: Record<string, string>): void => {
    try {
      options.log?.(maskPii(JSON.stringify({ scope: "notify-kr", ...event })))
    } catch {
      // 로그 때문에 보내기를 막지 않는다
    }
  }

  /** 보내지 않기로 한 건을 남긴다. 실제 멱등 키는 쓰지 않는다 — 야간처럼 나중에 같은 키로 다시 보낼 수 있어야 한다 */
  async function skip(input: SendInput, toLast4: string, reason: string): Promise<SendResult> {
    const at = now()
    try {
      await claimNotification(db, {
        idempotencyKey: SKIP_KEY(reason, input.idempotencyKey),
        channel: null,
        purpose: input.purpose,
        template: input.template,
        toLast4,
        userId: input.userId ?? null,
        status: "skipped",
        reason,
        createdAt: at,
        expiresAt: new Date(at.getTime() + NOTIFICATION_RETENTION_DAYS * DAY_MS),
      })
    } catch {
      // 기록 실패가 「보내지 않음」을 바꾸지 않는다
    }
    log({ status: "skipped", reason, template: input.template, to: `***${toLast4}` })
    return { ok: false, status: "skipped", reason }
  }

  const failed = (input: SendInput, reason: string, toLast4 = "????"): SendResult => {
    log({ status: "failed", reason, template: input.template, to: `***${toLast4}` })
    return { ok: false, status: "failed", reason }
  }

  return {
    async send(input) {
      // 1) 입력 검사 — 호출하는 쪽 실수라서 키를 차지하지 않는다(고쳐서 같은 키로 다시 보낼 수 있다)
      if (typeof input.idempotencyKey !== "string" || input.idempotencyKey.trim() === "") return failed(input, "invalid_idempotency_key")
      if (input.purpose !== "transactional" && input.purpose !== "marketing") return failed(input, "invalid_purpose")
      const to = normalizeKrMobile(input.to)
      if (!to) return failed(input, "invalid_phone")
      const toLast4 = last4(to)
      const template = Object.hasOwn(templates, input.template) ? templates[input.template] : undefined
      if (!template) return failed(input, "unknown_template", toLast4)
      const vars = input.vars ?? {}
      const missing = missingVars(template, vars)
      if (missing.length > 0) return failed(input, `missing_vars:${missing.join(",")}`, toLast4)
      const locale: SmsLocale = input.locale === "en" ? "en" : "ko"
      const current = now()

      // 2) 본문 — 광고성은 (광고) 머리와 수신거부 문구를 붙인다
      let smsText = renderSms(template, vars, locale)
      const marketing = input.purpose === "marketing"

      // 3) 광고성 규칙: 하나라도 안 맞으면 보내지 않는다
      if (marketing) {
        if (!input.userId) return skip(input, toLast4, "no_consent") // 누구의 동의인지 확인할 수 없다
        const consent = await runCanMarketing(options.canMarketing, input.userId, { channel: "sms", now: current })
        if (!consent.ok) return skip(input, toLast4, consent.reason)
        if (isNight(current)) return skip(input, toLast4, "night")
        const optOutNumber = options.optOut?.number
        if (typeof optOutNumber !== "string") return skip(input, toLast4, "opt_out_missing")
        smsText = composeMarketingText(smsText, optOutNumber, locale)
        const problem = checkMarketingText(smsText, optOutNumber)
        if (problem) return skip(input, toLast4, problem)
      }

      // 4) live 인데 보낼 곳이 없다
      if (mode === "live" && !solapiReady) return skip(input, toLast4, "provider_unavailable")

      // 5) 멱등 키를 먼저 차지한다 — 차지한 쪽만 보낸다
      const useAlimtalk = !marketing && Boolean(template.alimtalkId) && Boolean(options.solapi?.pfId)
      let row
      try {
        row = await claimNotification(db, {
          idempotencyKey: input.idempotencyKey,
          channel: null,
          purpose: input.purpose,
          template: input.template,
          toLast4,
          userId: input.userId ?? null,
          status: "failed",
          reason: "pending",
          createdAt: current,
          expiresAt: new Date(current.getTime() + NOTIFICATION_RETENTION_DAYS * DAY_MS),
        })
      } catch {
        return failed(input, "record_failed", toLast4)
      }
      if (!row) {
        log({ status: "skipped", reason: "duplicate", template: input.template, to: `***${toLast4}` })
        return { ok: false, status: "skipped", reason: "duplicate" } // 이미 처리한 키 — 기록을 더 쌓지 않는다
      }

      // 6) 보낸다
      let result: Delivery
      try {
        result = mode === "mock" ? sendMock(input, useAlimtalk, smsText, toLast4, row.id, current) : await sendLive(template, useAlimtalk, smsText, to, vars)
      } catch (error) {
        result = { ok: false, status: "failed", reason: `unexpected:${scrub(error instanceof Error ? error.name : "Error", secrets)}` }
      }

      // 7) 결과를 확정한다
      try {
        if (result.ok) await settleNotification(db, row.id, { status: "sent", channel: result.channel, reason: result.note ?? null, providerRef: result.providerRef })
        else await settleNotification(db, row.id, { status: result.status === "skipped" ? "skipped" : "failed", reason: scrub(result.reason, secrets) })
      } catch {
        log({ status: "unsettled", template: input.template, to: `***${toLast4}` })
      }
      log(result.ok ? { status: "sent", channel: result.channel, template: input.template, to: `***${toLast4}` } : { status: result.status, reason: result.reason, template: input.template, to: `***${toLast4}` })
      return result.ok ? { ok: true, channel: result.channel, providerRef: result.providerRef } : result
    },
  }

  /** mock: 외부 호출 없이 발송함에만 쓴다. 채널은 live 가 처음 시도할 채널과 같다 */
  function sendMock(input: SendInput, useAlimtalk: boolean, text: string, toLast4: string, id: string, at: Date): Delivery {
    const channel: NotificationChannel = useAlimtalk ? "alimtalk" : textChannel(text)
    if (options.outbox) {
      try {
        appendOutbox(options.outbox, { at: at.toISOString(), template: input.template, channel, purpose: input.purpose, toLast4 })
      } catch {
        return { ok: false, status: "failed", reason: "outbox_unwritable" }
      }
    }
    return { ok: true, channel, providerRef: `mock-${id}` }
  }

  async function sendLive(template: NotifyTemplate, useAlimtalk: boolean, text: string, to: string, vars: Record<string, string | undefined>): Promise<Delivery> {
    const solapi = options.solapi as SolapiConfig
    const fetchFn: FetchLike = options.fetch ?? ((url, init) => globalThis.fetch(url, init))
    const from = normalizeSender(solapi.sender)
    let fallbackNote: string | undefined
    if (useAlimtalk) {
      // 문자 대체는 Solapi 에 맡기지 않고(disableSms) 아래에서 직접 한다 — 어느 채널로 나갔는지 기록하려고
      const built = buildMessage({ kind: "ata", to, from, pfId: solapi.pfId, templateId: template.alimtalkId as string, requiredVars: template.vars.filter((v) => !(template.optional ?? []).includes(v)), vars: alimtalkVariables(template, vars), text, disableSms: true })
      if (!built.ok) return { ok: false, status: "failed", reason: built.reason }
      const sent = await sendSolapi(fetchFn, solapi, [built.message], { now: now() })
      if (sent.ok) return { ok: true, channel: "alimtalk", providerRef: sent.providerRef }
      fallbackNote = `alimtalk_failed:${sent.reason}`
    }
    const built = buildMessage({ kind: "sms", to, from, text })
    if (!built.ok) return { ok: false, status: "failed", reason: built.reason }
    const sent = await sendSolapi(fetchFn, solapi, [built.message], { now: now() })
    if (!sent.ok) return { ok: false, status: "failed", reason: fallbackNote ? `${fallbackNote}; sms_failed:${sent.reason}` : sent.reason }
    return { ok: true, channel: textChannel(text), providerRef: sent.providerRef, note: fallbackNote }
  }
}

const normalizeSender = (v: string | undefined): string => (v ?? "").replace(/\D/g, "")
const textChannel = (text: string): NotificationChannel => (smsType(text) === "LMS" ? "lms" : "sms")

/** 전송 결과(내부) — 성공에는 알림톡에서 문자로 물러난 이유(note)를 기록용으로 싣는다 */
type Delivery = { ok: true; channel: NotificationChannel; providerRef: string; note?: string } | { ok: false; status: "skipped" | "failed"; reason: string }
