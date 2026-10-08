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
    <table data-policy-table={id} role="table" className="w-full border-collapse text-base leading-[1.6] max-sm:block max-sm:[&_thead]:sr-only max-sm:[&_tbody]:block max-sm:[&_tr]:grid max-sm:[&_tr]:grid-cols-[repeat(var(--stack-cols,2),minmax(0,1fr))] max-sm:[&_tr]:gap-x-4 max-sm:[&_tr]:gap-y-1 max-sm:[&_tr]:py-3 max-sm:[&_caption]:block max-sm:[&_th]:block max-sm:[&_th]:h-auto max-sm:[&_th]:w-auto max-sm:[&_th]:border-0 max-sm:[&_th]:py-0 max-sm:[&_td]:block max-sm:[&_td]:min-w-0 max-sm:[&_td]:border-0 max-sm:[&_td]:py-0 max-sm:[&_[data-stack=skip]]:hidden max-sm:[&_th[scope=row]]:col-span-full max-sm:[&_td[colspan]]:col-span-full max-sm:[&_td[data-label]]:before:block max-sm:[&_td[data-label]]:before:text-sm max-sm:[&_td[data-label]]:before:font-normal max-sm:[&_td[data-label]]:before:text-muted-foreground max-sm:[&_td[data-label]]:before:content-[attr(data-label)] [--stack-cols:1]">
      <caption className="caption-top px-4 py-3 text-start text-base leading-[1.5]">{caption}</caption>
      <thead role="rowgroup" className="bg-muted">
        <tr role="row">
          <th scope="col" role="columnheader" className="px-4 py-3 text-start text-base leading-[1.5] font-medium">
            {columns.label}
          </th>
          <th scope="col" role="columnheader" className="px-4 py-3 text-start text-base leading-[1.5] font-medium">
            {columns.value}
          </th>
        </tr>
      </thead>
      <tbody role="rowgroup">
        {rows.map((r) => (
          <tr key={r.id} data-policy-row={r.id} role="row" className="border-t align-middle">
            <th scope="row" role="rowheader" className="w-2/5 px-4 py-3 text-start text-base leading-[1.5] font-medium break-words md:w-1/3">
              {r.label}
            </th>
            <td role="cell" /* numeric-cell: 글자 열 */ className="px-4 py-3 text-base leading-[1.6] break-words">{r.value}</td>
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
    <section ref={ref} id={id} data-block="shipping-returns-policy-tables" aria-labelledby={`${id}-title`} className={cn("mx-auto flex w-full max-w-6xl flex-col px-4 py-16 md:px-8 md:py-24 in-data-[archetype=dashboard]:gap-6 in-data-[archetype=dashboard]:py-6 md:in-data-[archetype=dashboard]:gap-6 md:in-data-[archetype=dashboard]:py-8 gap-8 md:gap-10", className)}>
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
      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-2 lg:gap-10">
        <div data-enter className="min-w-0 overflow-x-auto rounded-md border">
          <PolicyTable id="shipping" caption={copy.shippingCaption} rows={shippingRows(facts.shipping, copy.policy)} columns={copy.columns} />
        </div>
        <div data-enter className="min-w-0 overflow-x-auto rounded-md border">
          <PolicyTable id="returns" caption={copy.returnsCaption} rows={returnRows(facts.returns, copy.policy, moneyFmt(facts.shipping))} columns={copy.columns} />
        </div>
      </div>
    </section>
  )
}
