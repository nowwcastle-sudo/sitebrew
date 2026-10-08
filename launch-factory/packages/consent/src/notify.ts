// NotifyPort 백엔드(v0 Task 18, 대장 D40). 채널별 마케팅 수신 동의를 DB(marketing_consents + consent_records 이력)에 둔다.
//
// 정보통신망법 제50조(MST 283843, 시행 2026-09-11, 2026-09-30 법령 API로 확인):
//   ① 광고성 정보는 수신자의 명시적인 사전 동의를 받아야 보낸다 → 채널별 기본 false, 준 채널만 바꾼다.
//   ② 수신거부·동의 철회 뒤에는 보내지 않는다 → consents() 가 현재 상태를 돌려준다(보내는 쪽이 읽는다).
//   ⑦ 수신동의·수신거부·철회 의사를 표시하면 처리 결과를 알려야 한다 → setConsents 가 onChange 로 넘긴다.
//      시행령 제62조의2(MST 288033): 의사를 표시한 날부터 14일 이내에 전송자 명칭·의사 표시 사실과 날짜·처리 결과를 알린다
//      → marketingResultNotice() 가 그 세 가지를 담은 문구를 만든다. 메일 발송은 템플릿 몫(대장).
//   ⑧ + 시행령 제62조의3: 2년마다 수신동의 여부 확인 → 동의한 날짜는 consent_records 에 남는다(재확인 작업은 v0.2, 계획 개정).
import type { ActionResult, IsoDate, NotifyPort } from "@launch-factory/contract"
import { MARKETING_CHANNELS, readMarketingConsents, writeMarketingConsents, type Database, type MarketingChannel } from "@launch-factory/db"
import { DEFAULT_LOCALE, fill, messages, type Locale } from "@launch-factory/i18n"

export interface MarketingChangeEvent {
  userId: string
  changes: { channel: MarketingChannel; granted: boolean }[]
  at: Date
  locale: Locale
}

export interface NotifyAdapterOptions {
  db: Database
  /** 지금 로그인한 사용자(없으면 null). 템플릿이 AuthPort.session() 으로 채운다 */
  userId: () => string | null | Promise<string | null>
  locale?: Locale
  now?: () => Date
  /** 처리 결과 통지(제50조제7항). 보내기 실패가 설정 저장을 되돌리지는 않는다 — onError 로 알린다 */
  onChange?: (event: MarketingChangeEvent) => void | Promise<void>
  onError?: (error: unknown) => void
}

export function notifyAdapter({ db, userId, locale = DEFAULT_LOCALE, now = () => new Date(), onChange, onError = (e) => console.error("[notify]", e) }: NotifyAdapterOptions): NotifyPort {
  const m = messages(locale)
  const who = async (): Promise<string | null> => {
    const id = await userId()
    return typeof id === "string" && id ? id : null
  }
  return {
    async consents() {
      const id = await who()
      if (!id) return { ok: false, formError: m.auth.signInRequired }
      try {
        const { updatedAt, ...channels } = await readMarketingConsents(db, id)
        return { ok: true, data: { ...channels, ...(updatedAt ? { updatedAt: updatedAt.toISOString() } : {}) } }
      } catch (e) {
        onError(e)
        return { ok: false, formError: m.auth.unavailable, retryable: true }
      }
    },
    async setConsents(input): Promise<ActionResult<{ updatedAt: IsoDate }>> {
      const id = await who()
      if (!id) return { ok: false, formError: m.auth.signInRequired }
      const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>
      const bad = Object.keys(raw).filter((k) => !(MARKETING_CHANNELS as readonly string[]).includes(k) || typeof raw[k] !== "boolean")
      const given = MARKETING_CHANNELS.filter((ch) => typeof raw[ch] === "boolean")
      if (bad.length || !given.length) return { ok: false, fieldErrors: Object.fromEntries((bad.length ? bad : ["form"]).map((k) => [k, [m.consent.marketing.invalid]])) }
      const at = now()
      let changes: MarketingChangeEvent["changes"]
      try {
        changes = await writeMarketingConsents(db, { userId: id, changes: raw as Partial<Record<MarketingChannel, boolean>>, source: "settings", locale, at })
      } catch (e) {
        onError(e)
        return { ok: false, formError: m.consent.marketing.saveFailed, retryable: true }
      }
      try {
        await onChange?.({ userId: id, changes, at, locale })
      } catch (e) {
        onError(e)
      }
      return { ok: true, data: { updatedAt: at.toISOString() } }
    },
  }
}

/**
 * 처리 결과 통지 문구(시행령 제62조의2 — 전송자 명칭, 의사 표시 사실과 날짜, 처리 결과). 채널마다 한 줄.
 * 날짜 시간대 기본값은 ko → Asia/Seoul, en → UTC(메일 패키지와 같다).
 */
export function marketingResultNotice(event: MarketingChangeEvent, { sender, timeZone }: { sender: string; timeZone?: string }): string[] {
  const m = messages(event.locale).consent.marketing
  const date = new Intl.DateTimeFormat(event.locale === "ko" ? "ko-KR" : "en-US", { dateStyle: "long", timeZone: timeZone ?? (event.locale === "ko" ? "Asia/Seoul" : "UTC") }).format(event.at)
  return event.changes.map(({ channel, granted }) => fill(m.resultNotice, { sender, channel: m[channel], status: granted ? m.granted : m.withdrawn, date }))
}
