"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import type { CommercePort, Order } from "@/registry/factory/contract/commerce"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/registry/factory/ui/table"

import { DateText, MoneyText, fillText, vatLabel } from "../_shared/billing-format"
import { BlockHeading } from "../_shared/block-heading"
import { ListEmpty } from "../_shared/list-status"
import { OrderStatusBadge, type OrderStatusCopy } from "../_shared/order-kit"
import { ReadError, ReadLoading, usePortRead } from "../_shared/port-read"

// 주문 내역 — 내가 한 주문을 새것부터 표로(주문번호 | 주문일 | 상품 | 결제 금액 | 상태 | 자세히). 읽기 전용이라 승인 행동이 없다(취소는 account/order-detail).
// 금액은 총액 먼저(결제 금액 칸에 합계 + VAT 문구), 상태는 배지의 글 + 기계가 읽는 data-status. 좁은 화면(sm 미만)은 줄 단위로 쌓는다.
// 포트: orders(읽기 4상태 — 로그아웃·만료면 ReadError 가 로그인 링크를 보인다). 주문 줄의 상품 이름은 주문 때의 값(포트 데이터)이고 화면 글은 모두 copy 다.
export type AccountOrderHistoryCopy = {
  title: string
  lead?: string
  caption: string
  columns: { order: string; date: string; items: string; total: string; status: string }
  status: OrderStatusCopy
  /** 상품 요약: 한 가지면 이름만, 둘 이상이면 {name} 외 {count}건 틀 */
  itemsMore: string
  vatIncluded: string
  vatExcluded: string
  /** 자세히 보기 링크: label 은 보이는 글, of 는 접근 이름({id} = 주문번호), href 의 {id} 자리에 주문번호가 들어간다 */
  detail: { label: string; of: string; href: string }
  empty: { title: string; body: string; label: string; href: string }
  loading: string
  error: string
  retry: string
}
export type AccountOrderHistoryProps = BlockBase<AccountOrderHistoryCopy> & {
  orders: CommercePort["orders"]
  initial?: { orders?: Order[] }
}

/** 주문 줄 요약: 첫 상품 이름 + 나머지 개수 */
export const itemsSummary = (order: Pick<Order, "lines">, template: string): string => {
  const [first, ...rest] = order.lines
  if (!first) return ""
  return rest.length ? fillText(template, { name: first.name, count: rest.length }) : first.name
}

export function AccountOrderHistory({ copy, locale, timeZone, orders, initial, id = "order-history", className }: AccountOrderHistoryProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"))
  })
  const read = usePortRead(orders, initial?.orders)
  const loading = read.state.status === "loading"
  const err = read.state.status === "error" ? read.state : null
  const list = read.state.status === "ready" ? read.state.data : null

  return (
    <section ref={ref} id={id} data-block="account-order-history" aria-labelledby={`${id}-title`} className={cn("mx-auto flex w-full max-w-6xl flex-col gap-[var(--wf-section-gap,calc(var(--spacing)*10))] px-4 py-[var(--wf-section-py,calc(var(--spacing)*16))] md:gap-[var(--wf-section-gap-md,calc(var(--spacing)*12))] md:px-8 md:py-[var(--wf-section-py-md,calc(var(--spacing)*24))] in-data-[archetype=dashboard]:gap-6 in-data-[archetype=dashboard]:py-6 md:in-data-[archetype=dashboard]:gap-6 md:in-data-[archetype=dashboard]:py-8", className)}>
      <BlockHeading id={`${id}-title`} title={copy.title} lead={copy.lead} />
      <div data-enter aria-busy={loading || undefined} className="flex flex-col gap-6">
        {loading ? <ReadLoading label={copy.loading} lines={3} /> : null}
        {err ? <ReadError state={err} title={copy.error} retryLabel={copy.retry} /> : null}
        {list && list.length === 0 ? <ListEmpty title={copy.empty.title} body={copy.empty.body} action={{ label: copy.empty.label, href: copy.empty.href }} /> : null}
        {list && list.length > 0 ? (
          <div className="w-full min-w-0">
            <Table role="table" className="text-base max-sm:block max-sm:[&_thead]:sr-only max-sm:[&_tbody]:block max-sm:[&_tr]:grid max-sm:[&_tr]:grid-cols-[repeat(var(--stack-cols,2),minmax(0,1fr))] max-sm:[&_tr]:gap-x-4 max-sm:[&_tr]:gap-y-1 max-sm:[&_tr]:py-3 max-sm:[&_caption]:block max-sm:[&_th]:block max-sm:[&_th]:h-auto max-sm:[&_th]:w-auto max-sm:[&_th]:border-0 max-sm:[&_th]:py-0 max-sm:[&_td]:block max-sm:[&_td]:min-w-0 max-sm:[&_td]:border-0 max-sm:[&_td]:py-0 max-sm:[&_[data-stack=skip]]:hidden max-sm:[&_th[scope=row]]:col-span-full max-sm:[&_td[colspan]]:col-span-full max-sm:[&_td[data-label]]:before:block max-sm:[&_td[data-label]]:before:text-sm max-sm:[&_td[data-label]]:before:font-normal max-sm:[&_td[data-label]]:before:text-muted-foreground max-sm:[&_td[data-label]]:before:content-[attr(data-label)]">
              <caption className="sr-only">{copy.caption}</caption>
              <TableHeader role="rowgroup">
                <TableRow role="row">
                  <TableHead scope="col" role="columnheader">{copy.columns.order}</TableHead>
                  <TableHead scope="col" role="columnheader">{copy.columns.date}</TableHead>
                  <TableHead scope="col" role="columnheader">{copy.columns.items}</TableHead>
                  <TableHead scope="col" role="columnheader">{copy.columns.total}</TableHead>
                  <TableHead scope="col" role="columnheader">{copy.columns.status}</TableHead>
                  <TableHead scope="col" role="columnheader">
                    <span className="sr-only">{copy.detail.label}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody role="rowgroup">
                {list.map((order) => (
                  <TableRow key={order.id} role="row" data-order={order.id} data-status={order.status}>
                    <TableHead scope="row" role="rowheader" data-numeric className="break-all text-base font-medium">
                      {order.id}
                    </TableHead>
                    <TableCell role="cell" data-label={copy.columns.date}>
                      <DateText iso={order.createdAt} as="since" locale={locale} timeZone={timeZone} />
                    </TableCell>
                    <TableCell role="cell" data-label={copy.columns.items}>
                      {itemsSummary(order, copy.itemsMore)}
                    </TableCell>
                    <TableCell role="cell" data-label={copy.columns.total} data-numeric>
                      <span data-total="" className="flex flex-wrap items-baseline gap-x-2 tabular-nums">
                        <MoneyText money={order.total} price="billed" locale={locale} />
                        <span data-vat="" className="text-base leading-[1.5]">
                          {vatLabel(order.total, copy)}
                        </span>
                      </span>
                    </TableCell>
                    <TableCell role="cell" data-label={copy.columns.status}>
                      <OrderStatusBadge status={order.status} labels={copy.status} />
                    </TableCell>
                    <TableCell role="cell" className="text-end max-sm:col-span-full max-sm:text-start">
                      <a href={fillText(copy.detail.href, { id: encodeURIComponent(order.id) })} aria-label={fillText(copy.detail.of, { id: order.id })} className="relative inline-flex min-h-11 items-center text-base underline underline-offset-4">
                        {copy.detail.label}
                      </a>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}
      </div>
    </section>
  )
}
