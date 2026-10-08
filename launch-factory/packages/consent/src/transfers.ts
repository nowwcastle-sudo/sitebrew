// 개인정보 국외 이전 고지 표의 데이터(v0 Task 18, 대장 D29·D38). 화면은 템플릿이 그린다(Task 10) — 여기는 행과 메시지 키만 준다.
//
// 개인정보 보호법 제28조의8(MST 283839, 시행 2026-09-11, 2026-09-30 법령 API로 확인):
//   ①3 계약의 체결·이행에 필요한 처리위탁·보관은 ② 각 호를 처리방침에 공개하거나(가목) 전자우편 등으로 알리면(나목) 이전할 수 있다.
//   ② 알릴 것: 1 이전되는 항목, 2 나라·시기·방법, 3 받는 자의 명칭과 연락처, 4 받는 자의 이용 목적·보유 기간, 5 거부 방법·절차·효과.
// 열 → 조항: items(1) · country/place + whenHow(2) · recipient + contactUrl(3) · purpose + retention(4) · transfer.refuse(5).
//
// 값 출처(2026-09-30 확인, 보고서 표):
//   - PostHog: 지역별 나라·장소는 @launch-factory/analytics-posthog 의 POSTHOG_REGIONS(Task 8, posthog.com/handbook/company/security)
//   - Resend: resend.com/legal/privacy-policy 「we transfer the data … to the United States」
//   - Sentry: sentry.io/privacy 「United States, Canada and Europe」, 조직 데이터 지역 US·DE 중 하나
//   - Vercel: vercel.com/legal/privacy-notice(미국 법인). 함수 지역은 icn1(서울)이지만 로그·빌드·엣지는 미국 법인이 처리한다
//   받는 자 법인명은 PostHog 만 확인했다(POSTHOG_PROCESSOR). 나머지는 상표명이고 법인명은 확인 필요(대장).
import { POSTHOG_PROCESSOR, POSTHOG_REGIONS, type PostHogRegion } from "@launch-factory/analytics-posthog"
import type { MessageKey } from "@launch-factory/i18n"

export type TransferCountry = "US" | "DE" | "KR"
export type ProcessorId = "posthog" | "resend" | "supabase" | "sentry" | "vercel" | "cloudflare"

export interface OverseasTransferRow {
  id: ProcessorId
  /** 받는 자 이름(고유 명사 — 번역하지 않는다) */
  recipient: string
  /** 받는 자 연락처(개인정보 처리방침 주소) */
  contactUrl: string
  /** 나라 이름은 메시지 transfer.country.<코드> */
  countryCode: TransferCountry
  /** 알면 장소(도시·클라우드 지역) */
  place?: string
  items: MessageKey
  purpose: MessageKey
  whenHow: MessageKey
  retention: MessageKey
}

/** 표 머리글 키(열 순서). 거부 방법·효과는 표 아래 transfer.refuse({ contact }) 한 줄이다 */
export const TRANSFER_COLUMNS = ["recipient", "country", "items", "whenHow", "purpose", "retention"] as const
export const TRANSFER_COLUMN_KEYS: Record<(typeof TRANSFER_COLUMNS)[number], MessageKey> = {
  recipient: "transfer.column.recipient",
  country: "transfer.column.country",
  items: "transfer.column.items",
  whenHow: "transfer.column.whenHow",
  purpose: "transfer.column.purpose",
  retention: "transfer.column.retention",
}

export interface OverseasTransferOptions {
  /** PostHog 프로젝트 지역(Task 8 resolvePostHog 결과의 region) */
  posthogRegion: PostHogRegion
  /** Sentry 조직 데이터 지역. 기본 us */
  sentryRegion?: "us" | "de"
  /** Supabase 프로젝트를 둔 지역 — 제품마다 다르다(법정 쪽 변수 databaseRegion·databaseCountry). 기본은 서울 */
  database?: { countryCode: TransferCountry; place: string }
  /** 쓰지 않는 공급자는 빼고 싣는다. 기본 다섯 다 */
  include?: readonly ProcessorId[]
}

const common = { whenHow: "transfer.whenHow", retention: "transfer.retention" } as const

const DEFAULT_DATABASE = { countryCode: "KR", place: "Seoul, South Korea (AWS ap-northeast-2)" } as const

export function overseasTransfers({ posthogRegion, sentryRegion = "us", database = DEFAULT_DATABASE, include = ["posthog", "resend", "supabase", "sentry", "vercel", "cloudflare"] }: OverseasTransferOptions): OverseasTransferRow[] {
  const ph = POSTHOG_REGIONS[posthogRegion]
  if (!ph) throw new Error(`unknown PostHog region: ${String(posthogRegion)}`)
  const rows: OverseasTransferRow[] = [
    { id: "posthog", recipient: POSTHOG_PROCESSOR, contactUrl: "https://posthog.com/privacy", countryCode: ph.transfer.countryCode, place: `${ph.transfer.place} (${ph.transfer.provider} ${ph.transfer.providerRegion})`, items: "transfer.items.analytics", purpose: "transfer.purpose.analytics", ...common },
    { id: "resend", recipient: "Resend", contactUrl: "https://resend.com/legal/privacy-policy", countryCode: "US", items: "transfer.items.email", purpose: "transfer.purpose.email", ...common },
    // Supabase(2026-10-04 supabase.com/privacy 확인): 관리 주체 「Supabase Pte. Ltd.」(싱가포르 표기), 가입 때 데이터 저장 지역을 고르고 미리 알리지 않고는 옮기지 않는다고 적는다.
    // 저장 지역(나라·장소)은 제품 값이다 — 서울이면 나라는 KR 이다. 받는 자가 국외 법인이므로 원격 접근 가능성을 알리려고 표에 싣는다(방침 §6 이 한 줄 설명).
    { id: "supabase", recipient: "Supabase", contactUrl: "https://supabase.com/privacy", countryCode: database.countryCode, place: database.place, items: "transfer.items.database", purpose: "transfer.purpose.database", ...common },
    { id: "sentry", recipient: "Sentry", contactUrl: "https://sentry.io/privacy/", countryCode: sentryRegion === "de" ? "DE" : "US", items: "transfer.items.errors", purpose: "transfer.purpose.errors", ...common },
    { id: "vercel", recipient: "Vercel", contactUrl: "https://vercel.com/legal/privacy-notice", countryCode: "US", items: "transfer.items.hosting", purpose: "transfer.purpose.hosting", ...common },
    // Turnstile(v0 Task 15): 항목·목적은 https://www.cloudflare.com/turnstile-privacy-policy/ 「client IP address, TLS Fingerprint, User-Agent Header」.
    // 처리 나라는 그 문서에 없다(확인 안 됨 — 대장 D132). 미국 법인(Cloudflare, Inc.)이라 US 로 적는다. 봇 방어를 쓰지 않으면 include 에서 뺀다
    { id: "cloudflare", recipient: "Cloudflare", contactUrl: "https://www.cloudflare.com/turnstile-privacy-policy/", countryCode: "US", items: "transfer.items.botCheck", purpose: "transfer.purpose.botCheck", ...common },
  ]
  return rows.filter((r) => include.includes(r.id))
}
