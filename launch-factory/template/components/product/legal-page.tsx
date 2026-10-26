import { resolvePostHog } from "@launch-factory/analytics-posthog"
import { DEFAULT_INQUIRY_RETENTION, overseasTransfers, TRANSFER_COLUMNS, TRANSFER_COLUMN_KEYS } from "@launch-factory/consent"
import { businessInfo } from "@launch-factory/env"
import { fill, t } from "@launch-factory/i18n"
import { GRACE_DAYS } from "@/content/copy.account.en"
import { PRODUCT_NAME } from "@/content/copy.en"
import privacy from "@/content/legal/privacy.json"
import refund from "@/content/legal/refund.json"
import terms from "@/content/legal/terms.json"
import variables from "@/content/legal/variables.json"
import { hasUrl } from "@/lib/launch/enabled"
import { fillLegalDoc, legalDocWithoutContactPage, legalVars, type LegalDoc } from "@/lib/legal-tokens"

// 법정 페이지 자리(v0 Task 10). 본문은 web-factory 찍어내기(stamp)가 content/legal/<쪽>.json 에 쓴다 — 이 파일은 그것을 그리기만 한다.
// 형식: { status, contact, notice?, clauses: [{ title, text }] } (text 는 빈 줄이 문단, 「- 」로 시작하는 줄이 목록 — stamp 의 LegalBody 와 같다).
// status 는 셋이다: "placeholder"(본문 없음) · "draft"(초안을 검토했고 운영자 승인을 기다림) · "final"(운영자가 승인). final 이 아닌 동안 쪽 맨 위에 notice 가 보인다.
// 본문의 `{{business.name}}` 같은 자리표시는 여기서 채운다(lib/legal-tokens.ts) — business.* 는 LF_BUSINESS_* 설정, product.* 는 제품 코드, legal.* 는 content/legal/variables.json.
// final 인데 못 채운 자리표시가 있으면 던진다(공개 불가). 개인정보 국외 이전 고지(개인정보 보호법 제28조의8 제2항)는 처리방침 쪽에 표로 붙는다.
const LEGAL: Record<"privacy" | "terms" | "refund", LegalDoc> = { privacy, terms, refund }
const TITLES = { privacy: "Privacy Policy", terms: "Terms of Service", refund: "Refund Policy" } as const
const LOCALE = "en" as const

/** 한글 낱말(LFRUNFIX F5): 영어 쪽에 한국 법이 한국어로 적게 한 표시(예: 광고성 메일 제목의 「(광고)」)가 나오면 그 글만 lang="ko" 로 표시한다 — 글은 그대로 두고 언어만 알린다(스크린 리더 발음 · qa:lang 이 허용하는 표준 표지). 영어 문장 속 한글은 이것으로만 허용한다 */
const HANGUL_RUN = /([ㄱ-ㆎ가-힣]+(?: [ㄱ-ㆎ가-힣]+)*)/

export function KoMarked({ text }: { text: string }) {
  return (
    <>
      {text.split(HANGUL_RUN).map((part, i) =>
        i % 2 === 1 ? (
          <span key={i} lang="ko">
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  )
}

/** 글 속의 https 주소와 문의 경로(/contact)를 링크로 만든다. 그 밖의 글은 그대로(한글은 lang="ko" 로 표시) */
function Linked({ text }: { text: string }) {
  return (
    <>
      {text.split(/(https:\/\/[^\s),]+|\/(?:contact|terms|privacy|refund)\b)/).map((part, i) =>
        i % 2 === 1 && hasUrl(part) ? (
          <a key={i} href={part} className="underline underline-offset-4" {...(part.startsWith("http") ? { rel: "noreferrer noopener" } : {})}>
            {part}
          </a>
        ) : (
          <KoMarked key={i} text={part} />
        ),
      )}
    </>
  )
}

function Text({ text }: { text: string }) {
  return (
    <>
      {text.split(/\n{2,}/).map((para, i) => {
        const lines = para.split("\n")
        return lines.every((l) => l.startsWith("- ")) ? (
          <ul key={i} className="list-disc ps-5">
            {lines.map((l, j) => (
              <li key={j}>
                <Linked text={l.slice(2)} />
              </li>
            ))}
          </ul>
        ) : (
          <p key={i} className="whitespace-pre-line">
            <Linked text={para} />
          </p>
        )
      })}
    </>
  )
}

/** 국외 이전 고지 표 — PostHog 지역은 POSTHOG_HOST 로 정하고, 없으면 미국(mock·개발)으로 적는다. Sentry 는 쓴다(대표 확정 2026-10-04) — 쓰지 않는 제품은 include 에서 뺀다.
 *  Supabase 저장 지역은 제품 변수(variables.json 의 databaseRegion·databaseCountry)다 */
const COUNTRIES = ["US", "DE", "KR"] as const
export function OverseasNotice({ contact }: { contact: string }) {
  const posthog = process.env.POSTHOG_HOST ? resolvePostHog({ host: process.env.POSTHOG_HOST }) : resolvePostHog({ region: "us" })
  const country = COUNTRIES.find((c) => c === variables.databaseCountry)
  const database = country && variables.databaseRegion ? { countryCode: country, place: variables.databaseRegion } : undefined
  const rows = overseasTransfers({ posthogRegion: posthog.region, ...(database ? { database } : {}), include: ["posthog", "resend", "supabase", "sentry", "vercel", "cloudflare"] })
  return (
    <section aria-labelledby="overseas-title" className="flex flex-col gap-3">
      <h2 id="overseas-title" className="font-heading">
        {t(LOCALE, "transfer.title")}
      </h2>
      <p>{t(LOCALE, "transfer.intro")}</p>
      <div className="overflow-x-auto">
        <table className="w-full text-start">
          <thead>
            <tr>
              {TRANSFER_COLUMNS.map((c) => (
                <th key={c} scope="col" className="p-2 text-start">
                  {t(LOCALE, TRANSFER_COLUMN_KEYS[c])}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="p-2">
                  <a href={r.contactUrl} rel="noreferrer noopener">
                    {r.recipient}
                  </a>
                </td>
                <td className="p-2">
                  {t(LOCALE, `transfer.country.${r.countryCode}`)}
                  {r.place ? ` (${r.place})` : ""}
                </td>
                <td className="p-2">{t(LOCALE, r.items)}</td>
                <td className="p-2">{t(LOCALE, r.whenHow)}</td>
                <td className="p-2">{t(LOCALE, r.purpose)}</td>
                <td className="p-2">{t(LOCALE, r.retention)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>{fill(t(LOCALE, "transfer.refuse"), { contact })}</p>
    </section>
  )
}

export function LegalPage({ slug }: { slug: keyof typeof LEGAL }) {
  // 문의 보유 일수는 문의 접수 조립(lib/launch/inquiry.ts)이 쓰는 기본값과 같은 값이다 — 제품이 retain 을 바꾸면 여기도 함께 바꾼다
  const inquiryRetentionDays = DEFAULT_INQUIRY_RETENTION.kind === "days" ? DEFAULT_INQUIRY_RETENTION.days : undefined
  const vars = legalVars({ business: businessInfo(), product: { name: PRODUCT_NAME, deletionGraceDays: GRACE_DAYS, inquiryRetentionDays }, legal: variables })
  // 문의 화면이 없는 제품은 본문의 「Contact page (/contact)」 안내를 사업자 이메일로 바꾼다 — 템플릿 그대로면 본문 그대로다
  const { doc, unresolved } = fillLegalDoc(hasUrl("/contact") ? LEGAL[slug] : legalDocWithoutContactPage(LEGAL[slug]), vars)
  // 운영자가 승인한 쪽(final)에 빈 자리가 남으면 공개하지 않는다 — 값 없이 「to be confirmed」가 손님에게 보이는 것을 막는다. 이름만 싣는다
  if (doc.status === "final" && unresolved.length) throw new Error(`legal page "${slug}" is final but these placeholders have no value: ${unresolved.join(", ")}`)
  return (
    <article className="flex max-w-3xl flex-col gap-6">
      <h1 className="font-heading text-2xl">{TITLES[slug]}</h1>
      {doc.status !== "final" ? <p role="note">{doc.notice}</p> : null}
      {doc.clauses.map((c) => (
        <section key={c.title} className="flex flex-col gap-2">
          <h2 className="font-heading">{c.title}</h2>
          <Text text={c.text} />
        </section>
      ))}
      {slug === "privacy" ? <OverseasNotice contact={doc.contact} /> : null}
    </article>
  )
}
