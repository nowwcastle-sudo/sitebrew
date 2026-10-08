"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import type { AnalyticsPort } from "@/registry/factory/contract/ports"
import { Check, CheckCircle, Clock, Lock, Star } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"
import { Button } from "@/registry/factory/ui/button"

import { fillText } from "../_shared/billing-format"
import { blockLabels } from "../_shared/block-labels"

// 보증 띠(마케팅 규칙 T1·T3 — factory-rules.md §22-5). 구매 CTA 바로 아래 한 줄에 보증(기간·범위, 조건 2개 이하)을 두고, 그 곁에 신뢰 요소(반품 조건·결제 보안·
// 리뷰 수와 기준일·배송)를 늘어놓는다 — 푸터로 내리지 않는다(T1). 보증 기간은 청약철회 법정 기간(7일)보다 짧게 쓰지 않는다(guaranteeIssues 가 잡는다).
// 가짜 인증 씰 그림은 받지 않는다(글자만). 계측(선택): CTA 를 누르면 cta_click.
export type TrustItemKind = "returns" | "secure" | "reviews" | "delivery"
export type TrustGuaranteeStripCopy = {
  title: string
  lead?: string
  cta: { label: string; href: string }
  // 「{days}일 안에 …」 — days 는 guarantee.days
  guarantee: { text: string; days: number; conditions: string[]; link?: { label: string; href: string } }
  items: { kind: TrustItemKind; text: string }[]
}
export type TrustGuaranteeStripProps = BlockBase<TrustGuaranteeStripCopy> & { track?: AnalyticsPort["track"] }

/** 보증 문구 검사(T3): 조건 2개 이하 · 기간이 청약철회 법정 기간(7일) 이상. 빈 배열이면 통과 */
export function guaranteeIssues(g: TrustGuaranteeStripCopy["guarantee"], locale?: string): string[] {
  const L = blockLabels(locale)
  const out: string[] = []
  if (g.conditions.length > 2) out.push(L.guaranteeConditions(g.conditions.length))
  if (!(g.days >= 7)) out.push(L.guaranteeDays)
  if (!g.text.includes("{days}")) out.push(L.guaranteeText)
  return out
}

const ICON = { returns: CheckCircle, secure: Lock, reviews: Star, delivery: Clock } as const

export function TrustGuaranteeStrip({ copy, track, id = "guarantee", className }: TrustGuaranteeStripProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"))
  })
  const g = copy.guarantee
  return (
    <section ref={ref} id={id} data-block="trust-guarantee-strip" aria-labelledby={`${id}-title`} className={cn("cn-block-tgs-section", className)}>
      <div data-enter className="cn-block-tgs-strip">
        <div className="cn-block-tgs-text">
          <h2 id={`${id}-title`} className="cn-block-tgs-title font-heading-ko">
            {copy.title}
          </h2>
          {copy.lead ? <p className="cn-block-tgs-lead">{copy.lead}</p> : null}
        </div>
        <div data-trust-cta="" className="cn-block-tgs-cta-col">
          <Button size="lg" nativeButton={false} role="link" render={<a href={copy.cta.href} />} onClick={() => track?.("cta_click", { id: "guarantee-cta", label: copy.cta.label, section: id })} className="cn-block-tgs-cta">
            {copy.cta.label}
          </Button>
          <p data-guarantee="" data-guarantee-days={g.days} className="cn-block-tgs-guarantee">
            <Check aria-hidden="true" className="cn-block-tgs-guarantee-icon" />
            <span>
              {fillText(g.text, { days: g.days })}
              {g.conditions.length ? <span className="cn-block-tgs-conditions"> ({g.conditions.slice(0, 2).join(" · ")})</span> : null}
              {g.link ? (
                <>
                  {" "}
                  <a href={g.link.href} className="cn-block-tgs-link">
                    {g.link.label}
                  </a>
                </>
              ) : null}
            </span>
          </p>
        </div>
      </div>
      {copy.items.length ? (
        <ul data-enter data-trust-items="" className="cn-block-tgs-items">
          {copy.items.map((it, i) => {
            const Icon = ICON[it.kind]
            return (
              <li key={i} data-trust-kind={it.kind} className="cn-block-tgs-item">
                <Icon aria-hidden="true" className="cn-block-tgs-item-icon" />
                <span>{it.text}</span>
              </li>
            )
          })}
        </ul>
      ) : null}
    </section>
  )
}
