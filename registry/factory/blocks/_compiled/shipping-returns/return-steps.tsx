"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import { NEEDS_CHECK } from "@/registry/factory/content/content-core"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"

import { fill } from "../_shared/billing-format"
import { type PolicyCopy, type PolicyFacts, allRows } from "../_shared/policy-kit"

// 반품 순서 + 조건표(대장 A62). 왼쪽에 반품이 어떻게 돌아가는지 <ol> 순서(신청 → 회수 → 확인 → 환불 — 단계 문구는 사업자가 쓴다), 오른쪽에 조건을 <table> 한 장으로
// (배송·반품 행 전부 — 표는 순서가 못 말하는 값: 기한·비용·불가 사유). 「환불」 단계의 {days} 는 facts 의 환불 영업일(제18조 제2항 3영업일 이내)로 채우고, 값이 없으면 「확인 필요」다.
// 배송비를 누가 내나는 순서 안이 아니라 표에 있어 구매 전에 바로 찾는다. 금액은 VAT 포함 안내(data-vat)와 같은 화면에.
export type ShippingReturnsReturnStepsCopy = {
  title: string
  lead?: string
  stepsTitle: string
  // 단계: 제목 + 설명. 설명의 {days}(환불 영업일)는 facts 에서 채운다
  steps: { title: string; body: string }[]
  tableCaption: string
  columns: { label: string; value: string }
  policy: PolicyCopy
}
export type ShippingReturnsReturnStepsProps = BlockBase<ShippingReturnsReturnStepsCopy> & { facts: PolicyFacts }

export function ShippingReturnsReturnSteps({ copy, facts, id = "shipping-returns", className }: ShippingReturnsReturnStepsProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"))
  })
  const rd = facts.returns.refundDays
  const days =
    rd === undefined ? (
      <>
        <span data-needs-check="" className="inline-flex items-center rounded-sm border border-dashed px-2 text-base leading-[1.6]">
          {NEEDS_CHECK}
        </span>{" "}
      </>
    ) : (
      <span data-numeric="">{rd}</span>
    )
  return (
    <section ref={ref} id={id} data-block="shipping-returns-return-steps" aria-labelledby={`${id}-title`} className={cn("mx-auto flex w-full max-w-6xl flex-col px-4 py-[var(--wf-section-py,calc(var(--spacing)*16))] md:px-8 md:py-[var(--wf-section-py-md,calc(var(--spacing)*24))] in-data-[archetype=dashboard]:gap-6 in-data-[archetype=dashboard]:py-6 md:in-data-[archetype=dashboard]:gap-6 md:in-data-[archetype=dashboard]:py-8 gap-8 md:gap-10", className)}>
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
      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-12">
        <div data-enter className="flex min-w-0 flex-col gap-4">
          <h3 className="text-[1.25rem] leading-[1.4] font-heading-ko">{copy.stepsTitle}</h3>
          <ol data-return-steps="" className="flex flex-col">
            {copy.steps.map((st, i) => (
              <li key={st.title} className="grid grid-cols-[2.5rem_1fr] gap-3 border-s-2 ps-4 pb-6 last:pb-0">
                <span data-numeric="" aria-hidden="true" className="inline-flex size-10 items-center justify-center rounded-full border text-base leading-none tabular-nums">
                  {i + 1}
                </span>
                <div className="flex min-w-0 flex-col gap-1 pt-2">
                  <p className="text-[1.125rem] leading-[1.4] font-heading-ko">{st.title}</p>
                  <p className="text-base leading-[1.6]">{fill(st.body, { days })}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <div data-enter className="min-w-0 overflow-x-auto rounded-md border">
          <table data-policy-table="all" className="w-full border-collapse text-base leading-[1.6]">
            <caption className="caption-top px-4 py-3 text-start text-base leading-[1.5]">
              {copy.tableCaption}
              <span data-vat="" className="block text-base leading-[1.5] text-muted-foreground">
                {copy.policy.vatNote}
              </span>
            </caption>
            <thead className="bg-muted">
              <tr>
                <th scope="col" className="px-4 py-3 text-start text-base leading-[1.5] font-medium">
                  {copy.columns.label}
                </th>
                <th scope="col" className="px-4 py-3 text-start text-base leading-[1.5] font-medium">
                  {copy.columns.value}
                </th>
              </tr>
            </thead>
            <tbody>
              {allRows(facts, copy.policy).map((r) => (
                <tr key={r.id} data-policy-row={r.id} className="border-t align-middle">
                  <th scope="row" className="w-2/5 px-4 py-3 text-start text-base leading-[1.5] font-medium break-words md:w-1/3">
                    {r.label}
                  </th>
                  <td /* numeric-cell: 글자 열 */ className="px-4 py-3 text-base leading-[1.6] break-words">{r.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
