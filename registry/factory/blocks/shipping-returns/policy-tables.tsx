"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"

import { type PolicyCopy, type PolicyFacts, type PolicyRow, moneyFmt, returnRows, shippingRows } from "../_shared/policy-kit"

// 배송·반품 표 두 장(대장 A62, 전자상거래법 제13조 제2항 제4~6호·제17조·제18조 + 공정위 고시 Ⅲ.2). 「배송」 표(방법·출고·배송비와 무료 기준·도서산간)와 「반품·교환·환불」 표
// (청약철회 기한 7일 이상·반품 배송비 누가·청약철회 불가 사유·하자일 때·환불)를 실제 <table>(caption · th scope="row")로. 배송비가 어디까지 들고 누가 반품비를 내는지를
// 구매 전에 글자로 찾을 수 있게 한다(원형 핵심 과업 ① ②). 금액은 VAT 포함 안내(data-vat)와 같은 화면에. 값이 없으면 「확인 필요」.
export type ShippingReturnsPolicyTablesCopy = {
  title: string
  lead?: string
  shippingCaption: string
  returnsCaption: string
  columns: { label: string; value: string }
  policy: PolicyCopy
}
export type ShippingReturnsPolicyTablesProps = BlockBase<ShippingReturnsPolicyTablesCopy> & { facts: PolicyFacts }

function PolicyTable({ caption, rows, columns, id }: { caption: string; rows: PolicyRow[]; columns: { label: string; value: string }; id: string }) {
  return (
    <table data-policy-table={id} role="table" className="cn-block-notice-table cn-block-stack-table cn-block-stack-kv">
      <caption className="cn-block-notice-caption">{caption}</caption>
      <thead role="rowgroup" className="cn-block-notice-head">
        <tr role="row">
          <th scope="col" role="columnheader" className="cn-block-notice-th">
            {columns.label}
          </th>
          <th scope="col" role="columnheader" className="cn-block-notice-th">
            {columns.value}
          </th>
        </tr>
      </thead>
      <tbody role="rowgroup">
        {rows.map((r) => (
          <tr key={r.id} data-policy-row={r.id} role="row" className="cn-block-notice-row">
            <th scope="row" role="rowheader" className="cn-block-notice-rowhead">
              {r.label}
            </th>
            <td role="cell" /* numeric-cell: 글자 열 */ className="cn-block-notice-cell">{r.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function ShippingReturnsPolicyTables({ copy, facts, id = "shipping-returns", className }: ShippingReturnsPolicyTablesProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"))
  })
  return (
    <section ref={ref} id={id} data-block="shipping-returns-policy-tables" aria-labelledby={`${id}-title`} className={cn("cn-block-section cn-block-srt-section", className)}>
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
      <p data-enter data-vat="" className="cn-block-policy-vat">
        {copy.policy.vatNote}
      </p>
      <div className="cn-block-srt-grid">
        <div data-enter className="cn-block-srt-frame">
          <PolicyTable id="shipping" caption={copy.shippingCaption} rows={shippingRows(facts.shipping, copy.policy)} columns={copy.columns} />
        </div>
        <div data-enter className="cn-block-srt-frame">
          <PolicyTable id="returns" caption={copy.returnsCaption} rows={returnRows(facts.returns, copy.policy, moneyFmt(facts.shipping))} columns={copy.columns} />
        </div>
      </div>
    </section>
  )
}
