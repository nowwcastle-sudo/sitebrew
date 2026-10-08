// 가입 동의 검사(v0 Task 18). 어댑터(필드 오류를 돌려준다)와 Better Auth DB 훅(auth.handler 를 바로 불러도 막는다)이 같이 쓴다.
//
// 만 14세 확인 — 개인정보 보호법 제22조의2제1항(MST 283839, 시행 2026-09-11, 2026-09-30 법령 API로 확인):
//   「개인정보처리자는 만 14세 미만 아동의 개인정보를 처리하기 위하여 이 법에 따른 동의를 받아야 할 때에는
//    그 법정대리인의 동의를 받아야 하며, 법정대리인이 동의하였는지를 확인하여야 한다.」
//   v0 은 법정대리인 동의 절차를 만들지 않는다. 그래서 만 14세 이상만 가입을 받고, 가입 때 그 확인을 필수 칸으로 받는다.
//   계약 ConsentInput 에는 아직 이 칸이 없다 — 계약 밖 추가 입력 ageOver14 로 받는다(LaunchAuthPort 와 같은 방식, 대장 C5·D6x).
import type { ConsentInput } from "@launch-factory/contract"
import { DEFAULT_LOCALE, isLocale, messages, type Locale } from "@launch-factory/i18n"

/** 계약 ConsentInput + 만 14세 확인. web-factory 에 선택 칸 `ageOver14?: true` 를 요청했다(대장) */
export type LaunchConsentInput = ConsentInput & { ageOver14?: true }

export type MarketingChoices = Required<NonNullable<ConsentInput["marketing"]>>

export interface NormalizedConsents {
  terms: true
  privacy: true
  /** requireAgeOver14 가 꺼져 있으면 없다 */
  ageOver14?: true
  marketing: MarketingChoices
}

export interface ConsentCheckOptions {
  locale?: Locale
  /** 기본 true. 끄는 것은 법정대리인 동의 절차를 따로 갖춘 제품뿐이다 */
  requireAgeOver14?: boolean
}

type Fail = { ok: false; fieldErrors: Record<string, string[]> }

/** 약관·개인정보·만 14세 확인은 true 만 받는다. 마케팅은 채널마다 true 일 때만 true, 나머지는 false */
export function normalizeConsents(input: unknown, { locale = DEFAULT_LOCALE, requireAgeOver14 = true }: ConsentCheckOptions = {}): { ok: true; consents: NormalizedConsents } | Fail {
  const m = messages(locale).auth
  const c = (input && typeof input === "object" ? input : {}) as Record<string, unknown>
  const fieldErrors: Record<string, string[]> = {}
  for (const k of ["terms", "privacy"] as const) if (c[k] !== true) fieldErrors[k] = [m.consentRequired]
  if (requireAgeOver14 && c.ageOver14 !== true) fieldErrors.ageOver14 = [m.ageOver14Required]
  if (Object.keys(fieldErrors).length) return { ok: false, fieldErrors }
  const mk = (c.marketing && typeof c.marketing === "object" ? c.marketing : {}) as Record<string, unknown>
  const consents: NormalizedConsents = {
    terms: true,
    privacy: true,
    marketing: { email: mk.email === true, sms: mk.sms === true, kakao: mk.kakao === true, push: mk.push === true },
  }
  if (requireAgeOver14) consents.ageOver14 = true
  return { ok: true, consents }
}

/** 요청 본문·OAuth 상태에 실어 Better Auth DB 훅까지 보내는 모양 */
export interface SignUpConsentPayload extends NormalizedConsents {
  locale: Locale
}

/** 본문 칸 이름(Better Auth 는 모르는 칸을 사용자 표에 넣지 않는다 — parseUserInput 이 스키마 칸만 고른다) */
export const CONSENT_FIELD = "lfConsents"

/** DB 훅 쪽 검사: 모양이 맞으면 정규화한 값, 아니면 null */
export function readConsentPayload(raw: unknown, requireAgeOver14: boolean): SignUpConsentPayload | null {
  const r = normalizeConsents(raw, { requireAgeOver14 })
  if (!r.ok) return null
  const locale = (raw as Record<string, unknown>).locale
  return { ...r.consents, locale: isLocale(locale) ? locale : DEFAULT_LOCALE }
}
