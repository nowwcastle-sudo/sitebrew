import * as React from "react"

import type { Business } from "@/registry/factory/content/content-core"
import { normalizePhone } from "@/registry/factory/lib/phone"

import { breakable } from "../_shared/break-text"

// 한국 사업자 정보(전자상거래법 제10조 표시 사항 — 공유 조각 block-shared-business-info). footer 블록 세 변형이 같이 쓴다.
// 그리는 항목: 상호(법인명이 다르면 괄호)·대표자·사업자등록번호·통신판매업 신고번호·주소·전화(tel: 링크)·메일(mailto: 링크)
// + 정책 링크 줄: 공정위 사업자정보 확인·이용약관·개인정보 처리방침(법이 눈에 띄게 적으라는 링크라 굵게). 값이 있는 항목만 그린다.
// 항목 이름은 문구라 labels 로 받는다(블록 안 하드코딩 금지). 모양은 세 갈래: 줄(rows)·한 줄 흐름(inline)·법정 표(table).
export type BusinessLabels = {
  name: string
  representative: string
  bizRegNo: string
  mailOrderNo: string
  address: string
  phone: string
  email: string
  ftcLookup: string
  terms: string
  privacy: string
  // 정책 링크 줄의 이름(aria-label).
  policyNav: string
}

type Row = { key: string; term: string; value: React.ReactNode }

export function businessRows(b: Business, l: BusinessLabels): Row[] {
  // 값이 있는 항목만 그린다 — 회사 정보 칸이 없는 원형(portfolio)의 푸터는 상호·메일만 있어 주소·전화가 비어 있을 수 있다(없는 전화를 정규화하면 prerender 가 멈춘다)
  const tel = b.phone ? normalizePhone(b.phone) : null
  const rows: (Row | null)[] = [
    { key: "name", term: l.name, value: b.legalName && b.legalName !== b.name ? `${b.name}(${b.legalName})` : b.name },
    b.representative ? { key: "representative", term: l.representative, value: b.representative } : null,
    b.bizRegNo ? { key: "bizRegNo", term: l.bizRegNo, value: <span data-numeric="">{b.bizRegNo}</span> } : null,
    b.mailOrderNo ? { key: "mailOrderNo", term: l.mailOrderNo, value: b.mailOrderNo } : null,
    b.address ? { key: "address", term: l.address, value: b.address } : null,
    !b.phone ? null : {
      key: "phone",
      term: l.phone,
      value: tel ? (
        <a href={`tel:${tel}`} className="inline-flex min-h-11 min-w-0 items-center underline underline-offset-4 [overflow-wrap:anywhere]" data-numeric="">
          {breakable(b.phone)}
        </a>
      ) : (
        b.phone
      ),
    },
    b.email ? { key: "email", term: l.email, value: <a href={`mailto:${b.email}`} className="inline-flex min-h-11 min-w-0 items-center underline underline-offset-4 [overflow-wrap:anywhere]">{breakable(b.email)}</a> } : null,
  ]
  return rows.filter((r): r is Row => r !== null)
}

// 정책 링크 줄: 공정위 조회 → 이용약관 → 개인정보 처리방침(굵게). 링크가 하나도 없으면 그리지 않는다.
export function BusinessPolicyLinks({ business: b, labels: l }: { business: Business; labels: BusinessLabels }) {
  const links = [
    b.ftcLookupUrl ? { href: b.ftcLookupUrl, label: l.ftcLookup, strong: false } : null,
    b.termsUrl ? { href: b.termsUrl, label: l.terms, strong: false } : null,
    b.privacyUrl ? { href: b.privacyUrl, label: l.privacy, strong: true } : null,
  ].filter((x): x is { href: string; label: string; strong: boolean } => x !== null)
  if (!links.length) return null
  return (
    <nav aria-label={l.policyNav}>
      <ul className="flex flex-wrap gap-x-6 text-sm leading-[1.6]">
        {links.map((x) => (
          <li key={x.href}>
            {x.strong ? (
              <a href={x.href} className="inline-flex min-h-11 min-w-0 items-center underline underline-offset-4 [overflow-wrap:anywhere] font-bold">
                {x.label}
              </a>
            ) : (
              <a href={x.href} className="inline-flex min-h-11 min-w-0 items-center underline underline-offset-4 [overflow-wrap:anywhere]">
                {x.label}
              </a>
            )}
          </li>
        ))}
      </ul>
    </nav>
  )
}

// 줄: 항목 이름 · 값 쌍이 줄 바꿈하며 흐른다(링크 열 아래 사업자 칸).
export function BusinessRows({ business, labels }: { business: Business; labels: BusinessLabels }) {
  return (
    <div className="flex flex-col gap-4">
      <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm leading-[1.6]">
        {businessRows(business, labels).map((r) => (
          <div key={r.key} className="flex min-w-0 flex-wrap items-center gap-x-2 [overflow-wrap:anywhere]">
            <dt className="shrink-0">{r.term}</dt>
            <dd>{r.value}</dd>
          </div>
        ))}
      </dl>
      <BusinessPolicyLinks business={business} labels={labels} />
    </div>
  )
}

// 한 줄 흐름: 「이름 값 · 이름 값 …」이 문단처럼 이어진다(작은 사이트의 띠 푸터).
export function BusinessInline({ business, labels }: { business: Business; labels: BusinessLabels }) {
  return (
    <div className="flex flex-col gap-1">
      <dl className="flex flex-wrap items-center gap-x-4 text-sm leading-[1.6]">
        {businessRows(business, labels).map((r) => (
          <div key={r.key} className="inline-flex min-w-0 flex-wrap items-center gap-x-1.5 [overflow-wrap:anywhere]">
            <dt className="shrink-0">{r.term}</dt>
            <dd>{r.value}</dd>
          </div>
        ))}
      </dl>
      <BusinessPolicyLinks business={business} labels={labels} />
    </div>
  )
}

// 법정 표: 두 칸 표 모양(항목 이름 칸 · 값 칸, 줄마다 선). 공공·상세 페이지의 크게 보이는 사업자 칸.
export function BusinessTable({ business, labels }: { business: Business; labels: BusinessLabels }) {
  return (
    <dl className="grid border-t text-base leading-[1.6] md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
      {businessRows(business, labels).map((r) => (
        <div key={r.key} className="grid gap-1 border-b py-3 md:col-span-2 md:grid-cols-subgrid md:gap-6 md:py-4">
          <dt className="text-sm leading-[1.6] md:text-base">{r.term}</dt>
          <dd className="min-w-0 [overflow-wrap:anywhere]">{r.value}</dd>
        </div>
      ))}
    </dl>
  )
}
