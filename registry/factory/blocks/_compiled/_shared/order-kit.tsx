import * as React from "react"

import type { CartTotals, Order, OrderStatus } from "@/registry/factory/contract/commerce"
import type { IsoDate } from "@/registry/factory/contract/ports"
import { cn } from "@/registry/factory/lib/utils"
import { Badge } from "@/registry/factory/ui/badge"

import { DateText, fill } from "../_shared/billing-format"

// 주문 조각(공유 조각 block-shared-order-kit — account/order-history·order-detail 이 같이 쓴다). 주문 상태 일곱 개의 글·한 줄 안내·날짜 고르기·취소 가능 판정을 한 곳에 둔다.
// 상태 글은 모두 블록 copy 가 준다(블록 안 하드코딩 금지). 상태 전이는 launch-factory 의 order-states 가 정본이고 여기서는 화면이 필요한 두 가지만 읽는다:
//   · 취소할 수 있나 — pending_payment(결제 전: 결제하지 않은 주문을 닫는다) · paid · preparing(결제 완료: 환불까지 간다). 배송 중 이후는 서버가 not_cancelable 로 거절한다.
//   · 상태에 맞는 날짜 — 결제 전은 주문한 날, 결제 이후는 결제한 날, 취소·환불은 취소한 날.

export type OrderStatusCopy = Record<OrderStatus, string>
/** 상태별 한 줄 안내. {date} 자리에 상태에 맞는 날짜(statusDate)가 들어간다 */
export type OrderStatusNotes = Record<OrderStatus, string>

/** 취소(결제 전이면 주문 닫기, 결제 완료면 환불)를 시작할 수 있는 상태 */
export const CANCELABLE: readonly OrderStatus[] = ["pending_payment", "paid", "preparing"]
export const isCancelable = (status: OrderStatus): boolean => CANCELABLE.includes(status)
/** 결제가 이미 끝난 주문인가(취소하면 환불로 간다) */
export const isPaidStatus = (status: OrderStatus): boolean => status === "paid" || status === "preparing"

/** 상태에 맞는 날짜: 취소·환불 → 취소한 날, 결제 이후 → 결제한 날, 결제 전 → 주문한 날. 값이 없으면 주문한 날 */
export function statusDate(order: Pick<Order, "status" | "createdAt" | "paidAt" | "canceledAt">): IsoDate {
  if (order.status === "canceled" || order.status === "refunded") return order.canceledAt ?? order.createdAt
  if (order.status === "pending_payment") return order.createdAt
  return order.paidAt ?? order.createdAt
}

/** 상태 배지 — data-status 가 기계가 읽는 상태다(글은 copy) */
export function OrderStatusBadge({ status, labels, className }: { status: OrderStatus; labels: OrderStatusCopy; className?: string }) {
  return (
    <Badge variant="outline" data-status={status} className={cn("shrink-0 whitespace-nowrap", className)}>
      {labels[status]}
    </Badge>
  )
}

/** 상태 한 줄 안내(복사되는 글이 아니라 copy 틀 + 날짜) */
export function OrderStatusNote({ order, notes, locale, timeZone, className }: { order: Order; notes: OrderStatusNotes; locale?: string; timeZone?: string; className?: string }) {
  return (
    <p data-order-status={order.status} className={cn("text-base leading-[1.6]", className)}>
      {fill(notes[order.status], { date: <DateText iso={statusDate(order)} as="since" locale={locale} timeZone={timeZone} /> })}
    </p>
  )
}

/** 합계 줄 묶음에 쓰는 형: 주문은 합계 계산 결과를 그대로 가진다(Order extends CartTotals) */
export const totalsOf = (order: Order): CartTotals => ({ subtotal: order.subtotal, shipping: order.shipping, total: order.total })
