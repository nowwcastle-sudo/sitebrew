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
        <span data-needs-check="" className="cn-block-notice-missing">
          {NEEDS_CHECK}
        </span>{" "}
      </>
    ) : (
      <span data-numeric="">{rd}</span>
    )
  return (
    <section ref={ref} id={id} data-block="shipping-returns-return-steps" aria-labelledby={`${id}-title`} className={cn("cn-block-section cn-block-srs-section", className)}>
      <div className="cn-block-pin-head">
        <h2 id={`${id}-title`} data-enter className="cn-block-title font-heading-ko">
          {copy.title}
        </h2>
        {copy.lead ? (
          <p data-enter className="cn-block-lead">
            {copy.lead}
          </p>
        ) : null}
      </div>
      <div className="cn-block-srs-grid">
        <div data-enter className="cn-block-srs-steps">
          <h3 className="cn-block-srs-sub font-heading-ko">{copy.stepsTitle}</h3>
          <ol data-return-steps="" className="cn-block-srs-list">
            {copy.steps.map((st, i) => (
              <li key={st.title} className="cn-block-srs-step">
                <span data-numeric="" aria-hidden="true" className="cn-block-srs-num">
                  {i + 1}
                </span>
                <div className="cn-block-srs-step-text">
                  <p className="cn-block-srs-step-title font-heading-ko">{st.title}</p>
                  <p className="cn-block-srs-step-body">{fill(st.body, { days })}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <div data-enter className="cn-block-srs-table cn-block-pin-frame">
          <table data-policy-table="all" className="cn-block-notice-table">
            <caption className="cn-block-notice-caption">
              {copy.tableCaption}
              <span data-vat="" className="cn-block-policy-sub">
                {copy.policy.vatNote}
              </span>
            </caption>
            <thead className="cn-block-notice-head">
              <tr>
                <th scope="col" className="cn-block-notice-th">
                  {copy.columns.label}
                </th>
                <th scope="col" className="cn-block-notice-th">
                  {copy.columns.value}
                </th>
              </tr>
            </thead>
            <tbody>
              {allRows(facts, copy.policy).map((r) => (
                <tr key={r.id} data-policy-row={r.id} className="cn-block-notice-row">
                  <th scope="row" className="cn-block-notice-rowhead">
                    {r.label}
                  </th>
                  <td /* numeric-cell: 글자 열 */ className="cn-block-notice-cell">{r.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
