// 알림 템플릿 — 문구는 코드가 아니라 이 데이터(`NotifyTemplates`)에 둔다. 제품이 자기 템플릿을 넘기면 내장 예시를 대신한다.
// 알림톡 템플릿 id(`alimtalkId`)는 Solapi 콘솔에서 카카오 심사를 받은 뒤 설정이 넣는다 — 코드에 박지 않는다.

export type SmsLocale = "ko" | "en"

export interface NotifyTemplate {
  /** 카카오 알림톡 템플릿 id(심사 통과 뒤). 없으면 문자(SMS/LMS)로만 보낸다 */
  alimtalkId?: string
  /** 템플릿이 쓰는 변수 이름 전부. 문자 본문의 `#{이름}` 과 알림톡 변수가 이 목록을 따른다 */
  vars: readonly string[]
  /** vars 중 없어도 되는 것(비면 빈 글로 채운다). 나머지는 빠지면 보내기 전에 거절한다 */
  optional?: readonly string[]
  /** 문자 대체·문자 전용 본문. `#{이름}` 자리에 변수가 들어간다 */
  sms: Record<SmsLocale, string>
}
export type NotifyTemplates = Record<string, NotifyTemplate>

const VAR_NAME = /^[A-Za-z][A-Za-z0-9_]*$/
const PLACEHOLDER = /#\{([A-Za-z][A-Za-z0-9_]*)\}/g

/** 예약 안내용 내장 예시(안내 전용 — 광고 문구 없음). 알림톡 id 는 설정이 넣는다 */
const BOOKING_VARS = ["name", "service", "when", "reference", "manageUrl"] as const
const BOOKING_OPTIONAL = ["name", "manageUrl"] as const
export const DEFAULT_BOOKING_TEMPLATES: NotifyTemplates = {
  bookingConfirmed: {
    vars: BOOKING_VARS,
    optional: BOOKING_OPTIONAL,
    sms: {
      ko: "[예약 확정] #{service} #{when}\n접수번호 #{reference}\n#{manageUrl}",
      en: "[Booking confirmed] #{service} on #{when}\nReference #{reference}\n#{manageUrl}",
    },
  },
  bookingRequested: {
    vars: BOOKING_VARS,
    optional: BOOKING_OPTIONAL,
    sms: {
      ko: "[예약 접수] #{service} #{when}\n확정되면 다시 알려 드려요. 접수번호 #{reference}\n#{manageUrl}",
      en: "[Booking received] #{service} on #{when}\nWe will confirm shortly. Reference #{reference}\n#{manageUrl}",
    },
  },
  bookingCancelled: {
    vars: BOOKING_VARS,
    optional: BOOKING_OPTIONAL,
    sms: {
      ko: "[예약 취소] #{service} #{when} 예약이 취소됐어요.\n접수번호 #{reference}",
      en: "[Booking cancelled] #{service} on #{when} was cancelled.\nReference #{reference}",
    },
  },
  bookingReminder: {
    vars: BOOKING_VARS,
    optional: BOOKING_OPTIONAL,
    sms: {
      ko: "[예약 알림] #{service} #{when}에 만나요.\n접수번호 #{reference}\n#{manageUrl}",
      en: "[Reminder] #{service} on #{when}.\nReference #{reference}\n#{manageUrl}",
    },
  },
}

/** 본문에 쓰인 변수 이름(중복 없이, 나온 순서) */
export function placeholdersOf(text: string): string[] {
  return [...new Set([...text.matchAll(PLACEHOLDER)].map((m) => m[1] as string))]
}

/** 템플릿 모음의 문제 목록(비면 정상). 시작할 때 한 번 부르면 오타가 보내는 순간이 아니라 설정 단계에서 걸린다 */
export function checkTemplates(templates: NotifyTemplates): string[] {
  const problems: string[] = []
  for (const [name, t] of Object.entries(templates)) {
    const at = `template "${name}"`
    if (!t || typeof t !== "object") {
      problems.push(`${at}: not an object`)
      continue
    }
    if (!Array.isArray(t.vars)) problems.push(`${at}: vars must be an array`)
    const vars = Array.isArray(t.vars) ? t.vars : []
    for (const v of vars) if (!VAR_NAME.test(v)) problems.push(`${at}: bad variable name "${v}"`)
    if (new Set(vars).size !== vars.length) problems.push(`${at}: duplicate variable names`)
    for (const o of t.optional ?? []) if (!vars.includes(o)) problems.push(`${at}: optional "${o}" is not in vars`)
    if (t.alimtalkId !== undefined && (typeof t.alimtalkId !== "string" || t.alimtalkId.trim() === "")) problems.push(`${at}: alimtalkId must be a non-empty string`)
    for (const locale of ["ko", "en"] as const) {
      const body = t.sms?.[locale]
      if (typeof body !== "string" || body.trim() === "") {
        problems.push(`${at}: sms.${locale} is required`)
        continue
      }
      for (const used of placeholdersOf(body)) if (!vars.includes(used)) problems.push(`${at}: sms.${locale} uses #{${used}} which is not in vars`)
    }
  }
  return problems
}

/** 빠진 필수 변수 이름들(빈 글·공백만 있는 값도 빠진 것으로 본다) */
export function missingVars(t: NotifyTemplate, vars: Record<string, string | undefined>): string[] {
  const optional = new Set(t.optional ?? [])
  return t.vars.filter((v) => !optional.has(v) && !(typeof vars[v] === "string" && vars[v].trim() !== ""))
}

const valueOf = (vars: Record<string, string | undefined>, key: string): string => {
  const v = vars[key]
  return typeof v === "string" ? v : ""
}

/** 문자 본문을 만든다. 한 번만 치환하므로 값 안의 `#{…}` 는 다시 풀리지 않는다. 비어 버린 끝 줄은 정리한다 */
export function renderSms(t: NotifyTemplate, vars: Record<string, string | undefined>, locale: SmsLocale = "ko"): string {
  return t.sms[locale]
    .replace(PLACEHOLDER, (_, key: string) => (t.vars.includes(key) ? valueOf(vars, key) : ""))
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

/** 알림톡 변수: 템플릿이 가진 변수 전부, 키는 `#{이름}` */
export function alimtalkVariables(t: NotifyTemplate, vars: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(t.vars.map((v) => [`#{${v}}`, valueOf(vars, v)]))
}
