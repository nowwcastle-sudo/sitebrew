"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"

import { type PolicyCopy, type PolicyFacts, allRows, glance } from "../_shared/policy-kit"

// 한눈에 + 자세히(대장 A62). 위에 큰 칸 셋(배송비 · 출고 · 청약철회 기간 — 구매 판단에 가장 먼저 필요한 값), 아래에 나머지를 항목·값 <dl> 로.
// 큰 칸의 값은 표 안의 같은 행과 같은 글자다(요약이 다른 말을 하지 않는다 — 같은 계산에서 나온다). 「7일」이 법정 하한(제17조)보다 짧으면 이 블록이 아니라 policyIssues 가 잡는다.
// 값이 없으면 큰 칸에도 「확인 필요」가 보인다. 금액은 VAT 포함 안내(data-vat)와 같은 화면에.
export type ShippingReturnsAtAGlanceCardsCopy = {
  title: string
  lead?: string
  detailTitle: string
  policy: PolicyCopy
}
export type ShippingReturnsAtAGlanceCardsProps = BlockBase<ShippingReturnsAtAGlanceCardsCopy> & { facts: PolicyFacts }

export function ShippingReturnsAtAGlanceCards({ copy, facts, id = "shipping-returns", className }: ShippingReturnsAtAGlanceCardsProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"))
  })
  const big = glance(facts, copy.policy)
  const bigIds = new Set(big.map((b) => b.id))
  const rest = allRows(facts, copy.policy).filter((r) => !bigIds.has(r.id))
  return (
    <section ref={ref} id={id} data-block="shipping-returns-at-a-glance-cards" aria-labelledby={`${id}-title`} className={cn("mx-auto flex w-full max-w-6xl flex-col px-4 py-16 md:px-8 md:py-24 in-data-[archetype=dashboard]:gap-6 in-data-[archetype=dashboard]:py-6 md:in-data-[archetype=dashboard]:gap-6 md:in-data-[archetype=dashboard]:py-8 gap-8 md:gap-10", className)}>
      <div className="flex max-w-3xl flex-col gap-3">
        <h2 id={`${id}-title`} data-enter className="text-[1.953rem] leading-[1.2] md:text-[2.441rem] md:leading-[1.15] font-heading-ko">
          {copy.title}
        </h2>
        {copy.lead ? (
          <p data-enter className="text-base leading-[1.7]">
            {copy.lead}
          </p>
        ) : null}
      </div>
      <p data-enter data-vat="" className="text-base leading-[1.5] text-muted-foreground">
        {copy.policy.vatNote}
      </p>
      <dl data-glance="" data-enter className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {big.map((b) => (
          <div key={b.id} data-glance-item={b.id} className="flex min-w-0 flex-col gap-2 rounded-md border bg-muted p-5">
            <dt className="text-base leading-[1.5] text-muted-foreground">{b.label}</dt>
            <dd className="text-[1.25rem] leading-[1.45] break-words">{b.value}</dd>
          </div>
        ))}
      </dl>
      <div data-enter className="flex flex-col gap-4">
        <h3 className="text-[1.25rem] leading-[1.4] font-heading-ko">{copy.detailTitle}</h3>
        <dl data-policy-list="" className="flex flex-col">
          {rest.map((r) => (
            <div key={r.id} data-policy-row={r.id} className="grid grid-cols-1 gap-1 border-t py-3 md:grid-cols-[14rem_1fr] md:gap-6">
              <dt className="text-base leading-[1.5] text-muted-foreground">{r.label}</dt>
              <dd className="text-base leading-[1.6] break-words">{r.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
