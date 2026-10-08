"use client"

import * as React from "react"

import { JsonLd } from "@/registry/factory/ax/json-ld"
import type { Business } from "@/registry/factory/content/content-core"
import { toOrganization } from "@/registry/factory/content/content-to-jsonld"
import type { BlockBase } from "@/registry/factory/contract/block-contract"
import type { IsoDate } from "@/registry/factory/contract/ports"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"

import { formatDateParts } from "../_shared/billing-format"

// 브랜드 사실표(마케팅 규칙 X11·X7·X4·T2·X2 — factory-rules.md §22-5·§22-7). AI 검색·에이전트가 그대로 읽을 수 있는 회사 소개: 한 줄 정의 · 수치가 있는 차별점 3~5개
// (값·단위·출처와 기준일 — T2) · 대표 실명과 역할 · <dl> 핵심 사실(설립·위치·사업자등록번호·대표자 …) · 자주 묻는 질문(선택). 모두 서버가 그린 글자다(X2 — 그림 속 글자 없음).
// Organization JSON-LD(X7)는 jsonLd 를 켤 때만(홈 한 곳) 같은 props(organization)에서 만든다 — taxID 는 사업자등록번호, founder 는 대표, foundingDate 는 설립일.
// 화면에 없는 값은 싣지 않는다(X4). 별점 마크업(AggregateRating)은 회사 자체 소개에 달지 않는다(X4) — 이 블록은 만들지 않는다.
export type TrustBrandFactSheetCopy = {
  title: string
  definition: string
  differentiatorsTitle: string
  differentiators: { value: string; unit?: string; label: string; source: string }[]
  representative: { label: string; role: string; quote?: string }
  factsTitle: string
  labels: { founded: string; location: string; representative: string; bizRegNo: string; mailOrderNo: string; phone: string; website: string; channels: string }
  faq?: { title: string; items: { q: string; a: string }[] }
}
export type BrandOrganization = Business & { foundedAt: IsoDate; url?: string; sameAs?: string[] }
export type TrustBrandFactSheetProps = BlockBase<TrustBrandFactSheetCopy> & {
  organization: BrandOrganization
  // Organization JSON-LD 를 싣는다(홈 한 곳에만 — X7)
  jsonLd?: boolean
}

const FOUNDED: Intl.DateTimeFormatOptions = { year: "numeric", month: "long" }
/** 설립 연월 — 2019-03-02 → 2019년 3월(locale "en" 이면 March 2019). 날짜만 있는 값은 시간대가 밀지 않게 그날 그대로 읽는다 */
export const formatFounded = (iso: IsoDate, locale?: string, timeZone?: string) =>
  iso.length === 10 ? formatDateParts(`${iso}T00:00:00Z`, FOUNDED, locale, "UTC") : formatDateParts(iso, FOUNDED, locale, timeZone)

/** 화면과 같은 props 로 만든 Organization JSON-LD(X7·X4) */
export function brandJsonLd(org: BrandOrganization, locale?: string): Record<string, unknown> {
  const out: Record<string, unknown> = { ...toOrganization(org, locale), foundingDate: org.foundedAt.slice(0, 10) }
  // 화면에 그리지 않는 칸은 싣지 않는다(X4) — 법인명·메일·로고
  delete out.legalName
  delete out.email
  delete out.logo
  if (org.bizRegNo && locale !== "en") out.taxID = org.bizRegNo // 사업자등록번호는 한국 전용 칸 — 영어 사이트 JSON-LD 에는 싣지 않는다(FINAL-WF4 EN10)
  if (org.representative) out.founder = { "@type": "Person", name: org.representative }
  return out
}

export function TrustBrandFactSheet({ copy, organization: org, jsonLd = false, locale, timeZone, id = "brand-facts", className }: TrustBrandFactSheetProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"))
  })
  const facts: { key: string; term: string; value: React.ReactNode }[] = [
    { key: "founded", term: copy.labels.founded, value: <time dateTime={org.foundedAt.slice(0, 10)}>{formatFounded(org.foundedAt, locale, timeZone)}</time> },
    { key: "location", term: copy.labels.location, value: org.address },
    ...(org.representative ? [{ key: "representative", term: copy.labels.representative, value: org.representative }] : []),
    ...(org.bizRegNo ? [{ key: "bizRegNo", term: copy.labels.bizRegNo, value: <span data-numeric>{org.bizRegNo}</span> }] : []),
    ...(org.mailOrderNo ? [{ key: "mailOrderNo", term: copy.labels.mailOrderNo, value: org.mailOrderNo }] : []),
    { key: "phone", term: copy.labels.phone, value: <span data-numeric>{org.phone}</span> },
    ...(org.sameAs?.length ? [{ key: "channels", term: copy.labels.channels, value: <span className="flex flex-wrap gap-x-3">{org.sameAs.map((u) => <a key={u} href={u} className="relative inline-flex min-h-11 items-center underline underline-offset-4">{u.replace(/^https?:\/\//, "")}</a>)}</span> }] : []),
    ...(org.url ? [{ key: "website", term: copy.labels.website, value: <a href={org.url} className="relative inline-flex min-h-11 items-center underline underline-offset-4">{org.url.replace(/^https?:\/\//, "")}</a> }] : []),
  ]
  return (
    <section ref={ref} id={id} data-block="trust-brand-fact-sheet" aria-labelledby={`${id}-title`} className={cn("mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-16 md:gap-12 md:px-8 md:py-24 in-data-[archetype=dashboard]:gap-6 in-data-[archetype=dashboard]:py-6 md:in-data-[archetype=dashboard]:gap-6 md:in-data-[archetype=dashboard]:py-8", className)}>
      <div data-enter className="flex max-w-3xl flex-col gap-4">
        <h2 id={`${id}-title`} className="text-[1.953rem] leading-[1.2] md:text-[2.441rem] md:leading-[1.15] font-heading-ko">
          {copy.title}
        </h2>
        <p data-definition="" className="text-[1.25rem] leading-[1.6]">
          {copy.definition}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[3fr_2fr]">
        <div data-enter className="flex min-w-0 flex-col gap-4">
          <h3 className="text-[1.25rem] leading-[1.35] font-heading-ko">{copy.differentiatorsTitle}</h3>
          <ul data-differentiators="" className="grid grid-cols-1 border-s border-t sm:grid-cols-2">
            {copy.differentiators.slice(0, 5).map((d, i) => (
              <li key={i} className="flex min-w-0 flex-col gap-1 border-e border-b px-5 py-5">
                <p className="flex items-baseline gap-1">
                  <span data-numeric className="text-[2.441rem] leading-none tabular-nums font-heading">
                    {d.value}
                  </span>
                  {d.unit ? <span className="text-[1.25rem] leading-none">{d.unit}</span> : null}
                </p>
                <p className="text-base leading-[1.6]">{d.label}</p>
                <p data-source="" className="text-base leading-[1.5]">
                  {d.source}
                </p>
              </li>
            ))}
          </ul>
        </div>
        <div data-enter className="flex min-w-0 flex-col gap-4">
          <div data-representative="" className="flex flex-col gap-1 border-s-4 border-primary ps-4">
            <p className="text-base leading-[1.5]">{copy.representative.label}</p>
            <p className="text-[1.563rem] leading-[1.25] font-heading-ko">{org.representative}</p>
            <p className="text-base leading-[1.5]">{copy.representative.role}</p>
            {copy.representative.quote ? <blockquote className="mt-2 text-base leading-[1.7]">{copy.representative.quote}</blockquote> : null}
          </div>
          <h3 className="text-[1.25rem] leading-[1.35] font-heading-ko">{copy.factsTitle}</h3>
          <dl data-key-facts="" className="flex flex-col border-t">
            {facts.map((f) => (
              <div key={f.key} data-fact={f.key} className="grid grid-cols-[7rem_1fr] items-baseline gap-3 border-b py-2 text-base leading-[1.6]">
                <dt className="text-base">{f.term}</dt>
                <dd className="min-w-0 break-words">{f.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
      {copy.faq?.items.length ? (
        <div data-enter className="flex max-w-3xl flex-col gap-4">
          <h3 className="text-[1.25rem] leading-[1.35] font-heading-ko">{copy.faq.title}</h3>
          <dl className="flex flex-col gap-4">
            {copy.faq.items.map((f, i) => (
              <div key={i} className="flex flex-col gap-1">
                <dt className="text-[1.125rem] leading-[1.4] font-heading-ko">{f.q}</dt>
                <dd className="text-base leading-[1.7]">{f.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
      {jsonLd ? <JsonLd id={`${id}-jsonld`} data={brandJsonLd(org, locale)} /> : null}
    </section>
  )
}
