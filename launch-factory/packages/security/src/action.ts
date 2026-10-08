// 서버 액션 결과의 기계 값과 「승인 행동 확인 입력」(LFAX — 감사 M03·M04, 규칙 R20·R21, factory-rules.md §23-7 U20·U21).
//   1. 모든 실패 결과는 안정된 `code` 와 `retryable` 을 갖는다(machineResult). 글(formError·fieldErrors)은 사람용이고, 기계는 이 두 값만 읽는다.
//   2. 사람이 요약을 보고 확정해야 하는 행동(탈퇴·해지·요금제 변경·가격 변경 동의/거절·이메일 변경·마케팅 동의 변경·내 정보 내려받기)은
//      서버가 `confirmed: true` 없이는 실행하지 않는다(requireConfirmation). 없으면 code `confirmation_required` — 오류가 아니라 「승인 대기」다.
// 계약 ActionResult 는 이 칸들(confirmed·이 코드 값)을 아직 모른다. 계약 판 2 의 `code` 는 열린 문자열이라 값만 더해도 계약을 깨지 않는다
// (docs/qa/ux-audit/apply-lfax.md 에 web-factory 가 계약에 더할 것을 적었다).
import { isLocale, t, type Locale } from "@launch-factory/i18n"

/** 이 제품이 내는 실패 code 의 닫힌 목록. 앞 7개는 계약 ActionFailureCode 와 같고, 뒤는 LFAX 가 더한 값이다 */
export const ACTION_CODES = [
  "rate_limited",
  "bot_check_failed",
  "bot_check_unavailable",
  "in_progress",
  "invalid_token",
  "provider_unsupported",
  "scenario_unsupported",
  "sign_in_required",
  "confirmation_required",
  "provider_unavailable",
  "invalid_input",
  "invalid_credentials",
  "action_failed",
] as const
export type LaunchActionCode = (typeof ACTION_CODES)[number]

/**
 * 같은 요청을 그대로 다시 보내면 성공할 수 있는가. true 인 값에서만 화면이 [다시 시도]를 낸다.
 * 사람이 먼저 무언가 해야 하는 값(로그인·확인·입력 고치기)은 false 다.
 */
export const RETRYABLE: Readonly<Record<LaunchActionCode, boolean>> = {
  rate_limited: true,
  bot_check_failed: true,
  bot_check_unavailable: true,
  in_progress: true,
  invalid_token: false,
  provider_unsupported: false,
  scenario_unsupported: false,
  sign_in_required: false,
  confirmation_required: false,
  provider_unavailable: true,
  invalid_input: false,
  invalid_credentials: false,
  action_failed: false,
}

/** 계약 ActionResult 실패와 같은 모양(security 는 계약 패키지에 기대지 않는다) */
export interface ActionFailure {
  ok: false
  formError?: string
  fieldErrors?: Partial<Record<string, string[]>>
  retryable?: boolean
  code?: string
  retryAfter?: number
  manageUrl?: string
}

const loc = (locale: unknown): Locale => (isLocale(locale) ? locale : "en")
const isAction = (c: unknown): c is LaunchActionCode => (ACTION_CODES as readonly unknown[]).includes(c)

/** 「로그인이 필요해요」 — 로그인 없이 부른 본인 전용 액션의 결과 */
export function signInRequiredResult(locale?: Locale): ActionFailure & { code: "sign_in_required"; retryable: false } {
  return { ok: false, code: "sign_in_required", retryable: false, formError: t(loc(locale), "auth.signInRequired") }
}

/** 확인 입력이 없다 — 아무것도 실행하지 않았다. 「승인 대기」이지 서버 오류가 아니다(R21) */
export function confirmationRequiredResult(locale?: Locale, message?: string): ActionFailure & { code: "confirmation_required"; retryable: false } {
  const text = message ?? t(loc(locale), "protect.confirmationRequired")
  return { ok: false, code: "confirmation_required", retryable: false, formError: text, fieldErrors: { confirmed: [text] } }
}

/** 승인 대기(사람이 확인해야 멈춘 것)인가. 실패로 세지 않는다 */
export const isAwaitingApproval = (r: { ok: boolean; code?: unknown }): boolean => !r.ok && r.code === "confirmation_required"

const YES = new Set<unknown>([true, "on", "true"])

/** FormData 는 문자열 칸만 객체로 편다(점 표기 중첩은 쓰지 않는다 — 확인 입력은 최상위 칸이다) */
function asObject(input: unknown): Record<string, unknown> | null {
  if (input instanceof FormData) return Object.fromEntries([...input.entries()].filter(([, v]) => typeof v === "string"))
  return input && typeof input === "object" && !Array.isArray(input) ? { ...(input as Record<string, unknown>) } : null
}

export type Confirmation<R> = { ok: true; rest: R; confirmEmail?: string } | { ok: false; failure: ReturnType<typeof confirmationRequiredResult> }

/**
 * 승인 행동의 입구 검사. 입력의 `confirmed` 가 true("on"·"true" 포함)가 아니면 실패를 돌려준다 — 부른 쪽은 포트를 부르지 않는다.
 * 통과하면 `confirmed`·`confirmEmail` 을 뺀 나머지를 그대로 돌려준다(멱등 키 같은 다른 칸은 건드리지 않는다).
 * 입력이 없거나(undefined) 객체가 아니면 확인이 없는 것이다.
 */
export function requireConfirmation<R = Record<string, unknown>>(input: unknown, locale?: Locale): Confirmation<R> {
  const obj = asObject(input)
  if (!obj || !YES.has(obj.confirmed)) return { ok: false, failure: confirmationRequiredResult(locale) }
  const { confirmed: _confirmed, confirmEmail, ...rest } = obj
  void _confirmed
  return { ok: true, rest: rest as R, ...(typeof confirmEmail === "string" ? { confirmEmail } : {}) }
}

/**
 * 입력 확인(DESIGN §7-B)이 맞는가: 입력한 주소가 지금 로그인한 주소와 같다(앞뒤 공백·대소문자는 무시).
 * 이메일이 없는 계정(`want` 없음 — 카카오 등)은 확인 칸이 없어 통과한다.
 */
export const confirmEmailOk = (typed: string | undefined, want: string | undefined): boolean => !want || (typed ?? "").trim().toLowerCase() === want.toLowerCase()

/** 탈퇴처럼 입력 확인(이메일 주소를 그대로 입력)까지 받는 행동의 불일치 결과 */
export function confirmEmailMismatchResult(locale?: Locale): ActionFailure & { code: "confirmation_required"; retryable: false } {
  const text = t(loc(locale), "protect.confirmEmailMismatch")
  return { ok: false, code: "confirmation_required", retryable: false, formError: text, fieldErrors: { confirmEmail: [text] } }
}

/** 두 언어의 「로그인이 필요해요」 문구 — 코드 없이 문구만 오는 옛 결과를 알아보는 데 쓴다 */
const SIGN_IN_TEXT = new Set([t("en", "auth.signInRequired"), t("ko", "auth.signInRequired")])

/**
 * 실패 결과에 code·retryable 을 채운다(성공은 그대로). 이미 있는 값은 덮지 않는다.
 *   code 가 없을 때: 칸 오류가 있으면 invalid_input · 로그인 필요 문구면 sign_in_required · retryable 이 true 면 provider_unavailable · 그 밖은 action_failed
 *   retryable 이 없을 때: code 의 표(RETRYABLE)가 정한다. 모르는 code(공급자가 준 더 넓은 문자열)는 false
 * 글은 바꾸지 않는다. formError 와 fieldErrors 가 모두 없으면 일반 문구 하나를 더한다(빈 실패를 사람에게 보이지 않는다).
 */
export function machineResult<R extends { ok: boolean }>(result: R, locale?: Locale): R {
  if (result.ok) return result
  const r = { ...(result as unknown as ActionFailure) }
  if (!r.code) {
    if (r.fieldErrors && Object.keys(r.fieldErrors).length) r.code = "invalid_input"
    else if (r.formError && SIGN_IN_TEXT.has(r.formError)) r.code = "sign_in_required"
    else if (r.retryable === true) r.code = "provider_unavailable"
    else r.code = "action_failed"
  }
  if (r.retryable === undefined) r.retryable = isAction(r.code) ? RETRYABLE[r.code] : false
  if (!r.formError && !(r.fieldErrors && Object.keys(r.fieldErrors).length)) r.formError = t(loc(locale), "protect.actionFailed")
  return r as unknown as R
}

/** 액션 함수를 감싼다 — 어떤 실패든 기계 값을 갖고 나간다 */
export const coded =
  <A extends unknown[], R extends { ok: boolean }>(fn: (...args: A) => Promise<R>, locale?: Locale) =>
  async (...args: A): Promise<R> =>
    machineResult(await fn(...args), locale)
