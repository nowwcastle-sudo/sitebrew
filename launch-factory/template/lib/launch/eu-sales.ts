// F10 EU 소비자 판매 스위치. 운영자 결정 2026-10-08: EU 에 판다(기본 열림) — 결제 대행사 질의는 하지 않는다.
// 스위치 LF_EU_SALES(기본 열림, off·0·false·no 로 닫는다). 결제 입구 셋(화면의 product.checkout · startCheckout · startGumroadCheckout)이 모두 이 관문을 지난다.
// 닫았을 때의 판정(v0.1.1 리뷰 P1-1): 접속 지역 머리와 사람이 고른 나라 중 **하나라도 EU 면 막는다** — 고른 나라로 차단을 풀 수 없다(풀 수 있으면 화면이 우회 길이 된다).
// 나라를 전혀 모르면(접속 지역 머리가 없는 로컬·목업) 통과한다. 한계: VPN 으로 접속 지역을 바꾸면 통과한다.
// 닫기: LF_EU_SALES=off (코드 변경 없음).

/** EU 회원국 27개(ISO 3166-1 alpha-2). EEA·영국·스위스는 들어 있지 않다 */
export const EU_COUNTRIES: ReadonlySet<string> = new Set(["AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE"])

/** 접속 지역 머리 이름(Vercel). 다른 호스트는 같은 뜻의 머리를 여기에 더한다 */
export const GEO_HEADER = "x-vercel-ip-country"

/** 스위치가 열렸는지 — 닫는 값은 off·0·false·no 뿐(대소문자·앞뒤 공백 무시). 빈 값·그 밖은 모두 열림 */
export function euSalesOpen(value: string | undefined | null): boolean {
  return !["off", "0", "false", "no"].includes(String(value ?? "").trim().toLowerCase())
}

export function isEuCountry(code: string | undefined | null): boolean {
  return typeof code === "string" && EU_COUNTRIES.has(code.trim().toUpperCase())
}

const NOT_COUNTRIES = new Set(["EU", "EZ", "UN", "XX", "ZZ", "T1", "AA", "QO"])
let regionNames: Intl.DisplayNames | null = null

/** 두 글자 지역 코드가 실제 나라·영토인지 — ICU 지역 이름표에 이름이 있는 것만(알 수 없는 코드는 코드 그대로 돌아온다) */
function isRegionCode(code: string): boolean {
  if (!/^[A-Z]{2}$/.test(code) || NOT_COUNTRIES.has(code)) return false
  regionNames ??= new Intl.DisplayNames(["en"], { type: "region", fallback: "code" })
  try {
    const name = regionNames.of(code)
    return !!name && name !== code && name !== "Unknown Region"
  } catch {
    return false // ICU 가 코드 모양을 거절하면(RangeError) 나라가 아니다
  }
}

function one(v: unknown): string | null {
  if (typeof v !== "string") return null // 배열(주소에 두 번 실린 값)은 믿지 않는다
  const c = v.trim().toUpperCase()
  return isRegionCode(c) ? c : null
}

export type RegionVerdict = { kind: "ok"; country: string | null } | { kind: "unavailable"; country: string }

/** 열려 있으면 통과. 닫혀 있으면 고른 나라나 접속 지역 중 EU 인 것이 있으면 막는다(그 나라를 돌려준다) */
export function regionVerdict({ open, declared, geo }: { open: boolean; declared?: unknown; geo?: unknown }): RegionVerdict {
  const d = one(declared)
  const g = one(geo)
  if (!open) {
    const eu = [d, g].find((c) => c && isEuCountry(c))
    if (eu) return { kind: "unavailable", country: eu }
  }
  return { kind: "ok", country: d ?? g }
}

/** 서버 거절 문구(화면 언어) — 입구 셋이 같은 말을 한다 */
export const EU_GATE_MESSAGES = {
  en: { invalid: "Something went wrong with this request. Please try again.", unavailable: "We can't sell to billing addresses in the European Union yet. Nothing was charged." },
  ko: { invalid: "요청을 처리하지 못했어요. 다시 시도해 주세요.", unavailable: "아직 유럽연합(EU) 결제 주소로는 판매하지 않아요. 결제된 금액은 없어요." },
} as const

type GateMessages = { invalid: string; unavailable: string }
export type GateResult<I> = { ok: true; input: I } | { ok: false; code: "region_unavailable" | "invalid_input"; retryable: false; formError: string }

/**
 * 결제 서버 입구. 닫힌 동안 EU 는 `region_unavailable` 로 막고 결제 포트를 부르지 않는다(아무것도 청구되지 않는다).
 * 통과하면 나라 칸(billingCountry)은 떼고 나머지 입력만 돌려준다 — 결제 포트 계약에는 그 칸이 없다.
 * 폼 제출(FormData)은 펼치면 값이 사라지므로 나라만 읽고 같은 FormData 를 넘긴다.
 */
export function gateCheckout<I extends object>(input: unknown, ctx: { open: boolean; geo?: unknown; messages: GateMessages }): GateResult<Omit<I, "billingCountry">> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false, code: "invalid_input", retryable: false, formError: ctx.messages.invalid }
  const refuse = { ok: false, code: "region_unavailable", retryable: false, formError: ctx.messages.unavailable } as const
  if (typeof FormData !== "undefined" && input instanceof FormData) {
    if (regionVerdict({ open: ctx.open, declared: input.get("billingCountry") ?? undefined, geo: ctx.geo }).kind === "unavailable") return refuse
    input.delete("billingCountry")
    return { ok: true, input: input as unknown as Omit<I, "billingCountry"> }
  }
  const { billingCountry, ...rest } = input as I & { billingCountry?: unknown }
  if (regionVerdict({ open: ctx.open, declared: billingCountry, geo: ctx.geo }).kind === "unavailable") return refuse
  return { ok: true, input: rest as Omit<I, "billingCountry"> }
}

/** 서버 액션에서 접속 지역 머리를 읽는다. 요청 밖(단위 시험)에서는 headers() 가 동기로 던진다 — 그때는 지역 모름 */
export async function geoFrom(read: () => Promise<{ get(name: string): string | null }>): Promise<string | undefined> {
  try {
    return (await read()).get(GEO_HEADER) ?? undefined
  } catch {
    return undefined
  }
}

/** 입구 셋이 쓰는 한 줄: 막히면 실패 결과, 통과하면 나라 칸을 뗀 입력 */
export async function euGate<I extends object>(input: unknown, read: () => Promise<{ get(name: string): string | null }>, locale: "en" | "ko" = "en"): Promise<GateResult<Omit<I, "billingCountry">>> {
  return gateCheckout<I>(input, { open: euSalesOpen(process.env.LF_EU_SALES), geo: await geoFrom(read), messages: EU_GATE_MESSAGES[locale] })
}
