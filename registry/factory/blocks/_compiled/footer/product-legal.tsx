import * as React from "react"

import type { Cta } from "@/registry/factory/content/content-core"
import type { BlockBase } from "@/registry/factory/contract/block-contract"
import { cn } from "@/registry/factory/lib/utils"
import { normalizePhone } from "@/registry/factory/lib/phone"

import { consentOpenAttrs } from "../_shared/consent-open-attrs"
import { breakable } from "../_shared/break-text"

// 제품 푸터(P3-6 K03 — 모든 쪽 맨 아래): 한 줄 위 띠(제품 이름 · 약관·개인정보·환불·문의 링크 · 「쿠키 설정」) + 아래 사업자 정보 칸 + 저작권.
// **사업자 정보는 전부 선택이다** — 상호·대표자·주소·전화·메일·사업자등록번호·통신판매업 신고번호·호스팅 서비스 제공자 중 값이 있는 칸만 그린다. 하나도 없으면
// 칸 자체를 그리지 않는다. 값은 이 블록에도 예시에도 박지 않는다 — 제품 설정(환경 변수·설정 파일)에서 읽어 `business` 로 넘긴다(남도 쓰는 공장: 대표 값은 제품 쪽 몫).
// 「쿠키 설정」 링크는 `data-consent-open` 이 붙은 앵커다 — 같은 쪽의 consent/bottom-banner·preference-dialog 가 이것을 받아 선택을 다시 연다(K04).
// 그런 블록이 없거나 자바스크립트가 없으면 href 가 그대로 동작한다. 서버 컴포넌트다(JS 없이도 모든 글·링크가 서버 HTML 에 있다). 등장 모션 없음.
export type FooterBusiness = {
  /** 상호 */
  name?: string
  /** 대표자 */
  owner?: string
  address?: string
  /** 전화(tel: 링크로 — 번호 모양이 틀리면 글자만) */
  phone?: string
  email?: string
  /** 사업자등록번호 */
  registrationNo?: string
  /** 통신판매업 신고번호 — 면제 대상이면 비운다 */
  mailOrderNo?: string
  /** 호스팅 서비스 제공자 상호(전자상거래법 시행규칙 §7) */
  hostingProvider?: string
}
export type FooterBusinessLabels = {
  name: string
  owner: string
  address: string
  phone: string
  email: string
  registrationNo: string
  mailOrderNo: string
  hostingProvider: string
}
export type FooterProductLegalCopy = {
  /** 제품 이름(없으면 그 줄을 그리지 않는다) */
  brand?: string
  navLabel: string
  /** 이름 붙은 법정·지원 링크 — 있는 것만 그린다 */
  links: { terms?: Cta; privacy?: Cta; refund?: Cta; contact?: Cta }
  /** 「쿠키 설정」 — href 는 쿠키 블록이 없을 때 가는 곳(예: #cookie-settings · /privacy#cookies) */
  cookieSettings?: Cta
  businessTitle: string
  businessLabels: FooterBusinessLabels
  copyright?: string
}
export type FooterProductLegalProps = BlockBase<FooterProductLegalCopy> & {
  business?: FooterBusiness
}

const ORDER = ["name", "owner", "address", "phone", "email", "registrationNo", "mailOrderNo", "hostingProvider"] as const

export function FooterProductLegal({ copy, business, id = "site-footer", className }: FooterProductLegalProps) {
  const rows = ORDER.flatMap((key) => {
    const raw = business?.[key]
    const value = typeof raw === "string" ? raw.trim() : ""
    if (!value) return []
    let node: React.ReactNode = value
    if (key === "phone") {
      const tel = normalizePhone(value)
      node = tel ? (
        <a href={`tel:${tel}`} data-numeric="" className="inline-flex min-h-11 min-w-0 items-center underline underline-offset-4 [overflow-wrap:anywhere]">
          {breakable(value)}
        </a>
      ) : (
        breakable(value)
      )
    } else if (key === "email") {
      node = (
        <a href={`mailto:${value}`} className="inline-flex min-h-11 min-w-0 items-center underline underline-offset-4 [overflow-wrap:anywhere]">
          {breakable(value)}
        </a>
      )
    } else if (key === "registrationNo" || key === "mailOrderNo") {
      node = <span data-numeric="">{value}</span>
    }
    return [{ key, term: copy.businessLabels[key], node }]
  })
  const links = [copy.links.terms, copy.links.privacy, copy.links.refund, copy.links.contact].filter((l): l is Cta => !!l)
  const showNav = links.length > 0 || !!copy.cookieSettings
  return (
    <footer id={id} data-block="footer-product-legal" className={cn("border-t bg-background text-foreground", className)}>
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 md:px-8">
        {copy.brand || showNav ? (
          <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center md:justify-between md:gap-x-8">
            {copy.brand ? <p className="text-[1.25rem] leading-[1.3] font-heading">{copy.brand}</p> : null}
            {showNav ? (
              <nav aria-label={copy.navLabel}>
                <ul className="flex flex-wrap gap-x-4">
                  {links.map((l) => (
                    <li key={l.href}>
                      <a href={l.href} className="inline-flex min-h-11 min-w-11 items-center text-base leading-[1.4] underline-offset-4 hover:underline">
                        {l.label}
                      </a>
                    </li>
                  ))}
                  {copy.cookieSettings ? (
                    <li>
                      <a href={copy.cookieSettings.href} {...consentOpenAttrs} className="inline-flex min-h-11 min-w-11 items-center text-base leading-[1.4] underline-offset-4 hover:underline">
                        {copy.cookieSettings.label}
                      </a>
                    </li>
                  ) : null}
                </ul>
              </nav>
            ) : null}
          </div>
        ) : null}
        {rows.length ? (
          <section aria-label={copy.businessTitle} data-business="" className="flex flex-col gap-4">
            <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm leading-[1.6] max-sm:flex-col max-sm:gap-y-3">
              {rows.map((r) => (
                <div key={r.key} data-field={r.key} className="flex min-w-0 flex-wrap items-center gap-x-2 [overflow-wrap:anywhere] max-sm:flex-col max-sm:items-start max-sm:gap-y-0">
                  <dt className="shrink-0">{r.term}</dt>
                  <dd>{r.node}</dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}
        {copy.copyright ? <p className="text-sm leading-[1.6]">{copy.copyright}</p> : null}
      </div>
    </footer>
  )
}
