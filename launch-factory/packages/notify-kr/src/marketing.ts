// 광고성 문자 규칙(정보통신망법 제50조·시행령 제61조 — 한국 법 근거는 packages/email/src/advertising.ts·packages/consent/src/marketing.ts 와 같다).
// 알림톡은 정보성 전용이라 광고성은 문자(SMS/LMS) 한 갈래뿐이다. 이 파일은 순수 함수만 둔다: 동의 조회(DB)는 consent-guard.ts, 보내기는 index.ts.
//   ① 본문 맨 앞 「(광고)」 ② 본문 끝 무료수신거부 문구 + 수신거부 번호 ③ 한국 시각 21:00~08:00 금지 ④ 채널(sms) 동의
//   조건이 하나라도 안 지켜지면 보내지 않는다(보내지 않는 쪽이 기본).
import { isNightKst } from "@launch-factory/consent"
import type { SmsLocale } from "./templates.ts"

export const AD_PREFIX = "(광고)"
/** 본문 끝 수신거부 문구. 한·영 모두 같은 번호를 쓴다 */
export const OPT_OUT_LABEL: Record<SmsLocale, string> = { ko: "무료수신거부", en: "Free opt-out" }

/** 야간(한국 21:00~08:00)인가 — 이메일 규칙(consent)과 같은 시간대를 쓴다 */
export const isNight = (now: Date): boolean => isNightKst(now)

/** 수신거부 번호 모양: 숫자·+·-·공백만, 숫자 7~15개(080-… · 1588-… 도 받는다) */
export function isOptOutNumber(value: unknown): value is string {
  if (typeof value !== "string" || !/^[0-9+\-\s]+$/.test(value)) return false
  const digits = value.replace(/\D/g, "").length
  return digits >= 7 && digits <= 15
}

/** 본문에 「(광고)」 머리와 수신거부 문구·번호를 붙인다. 이미 머리가 있으면 겹쳐 붙이지 않는다 */
export function composeMarketingText(body: string, optOutNumber: string, locale: SmsLocale = "ko"): string {
  const trimmed = body.trim()
  const head = trimmed.startsWith(AD_PREFIX) ? trimmed : `${AD_PREFIX} ${trimmed}`
  return `${head}\n${OPT_OUT_LABEL[locale]} ${optOutNumber.trim()}`
}

/** 완성된 광고 본문을 마지막으로 점검한다. 문제 이름(`ad_prefix_missing`·`opt_out_missing`)이나 null */
export function checkMarketingText(text: string, optOutNumber: unknown): "ad_prefix_missing" | "opt_out_missing" | null {
  if (!text.startsWith(AD_PREFIX)) return "ad_prefix_missing"
  if (!isOptOutNumber(optOutNumber)) return "opt_out_missing"
  const tail = text.trimEnd()
  const number = (optOutNumber as string).trim()
  return Object.values(OPT_OUT_LABEL).some((label) => tail.endsWith(`${label} ${number}`)) ? null : "opt_out_missing"
}
