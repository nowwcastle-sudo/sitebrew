import * as React from "react"

import type { Money } from "@/registry/factory/contract/ports"
import { cn } from "@/registry/factory/lib/utils"

import { blockLabels } from "../_shared/block-labels"

// 금액 표시(P3-2 공유 조각 block-shared-price-tag). 원화는 ko-KR 자리 구분 + 「원」(12,900원), 다른 통화는 Intl 통화 형식.
// 금액 칸은 data-numeric(숫자 열 규칙)과 고른 폭 숫자(tabular-nums, 훅 값) — 월·연 전환처럼 값이 바뀌어도 폭이 흔들리지 않는다.
// 콘텐츠 통화(detail product.currency — ports Money 와 같다): opts.minor 면 amount 가 최소 단위 정수(USD·EUR 는 센트, KRW·JPY 는 그대로)이고,
// opts.locale 이 자리·기호를 정한다(en-US USD → $48.00). 옵션이 없으면 예전과 같다 — KRW 출력은 글자 그대로(12,900원).
export type MoneyFormat = { currency: string; locale?: string }
export function formatPrice(amount: number, currency = "KRW", opts?: { minor?: boolean; locale?: string }) {
  if (currency === "KRW" && (!opts?.locale || opts.locale.startsWith("ko"))) return `${Math.round(amount).toLocaleString("ko-KR")}${blockLabels().won}`
  const locale = opts?.locale ?? "ko-KR"
  const fmt = new Intl.NumberFormat(locale, { style: "currency", currency })
  // 소수 자릿수는 Intl 이 통화별(ISO 4217)로 정한다 — 최소 단위 → 화면 단위
  const digits = opts?.minor ? fmt.resolvedOptions().maximumFractionDigits ?? 0 : 0
  return fmt.format(digits ? amount / 10 ** digits : amount)
}
/** 최소 단위 정수 → 화면 단위 숫자(JSON-LD Offer.price 처럼 숫자가 필요한 곳) */
export function toMajor(amount: number, currency = "KRW") {
  const digits = new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 0
  return digits ? amount / 10 ** digits : amount
}

export function PriceTag({ amount, currency = "KRW", per, className }: { amount: number; currency?: string; per?: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex flex-wrap items-baseline gap-x-1", className)}>
      <span data-numeric className="text-[2.441rem] leading-none tabular-nums font-heading">
        {formatPrice(amount, currency)}
      </span>
      {per ? <span className="text-base">{per}</span> : null}
    </span>
  )
}

// 현지 통화·세금 표시(P3-2 Task 7a, 대장 A66): 요금제 이름 → Money(최소 단위 정수·통화·vatIncluded). 서버가 방문자의 통화·세금으로 계산해 넘기면 화면 금액이 결제창(Paddle 등)과 같아진다
// — 안 넘기면 콘텐츠 값(monthlyPrice·currency)이라 결제 직전에 금액이 바뀌는 일이 생긴다(추가 비용을 뒤늦게 보이는 다크패턴, 전자상거래법 §21-2①1). 첫 HTML 텍스트에 그대로 실린다(서버 렌더).
export type PlanPrices = Record<string, Money>
// 소수 통화(USD·EUR)는 최소 단위(센트)를 화면 단위로 되돌린다 — KRW·JPY 는 그대로
const MINOR_UNITS = new Set(["USD", "EUR"])
export function planPrice(p: { name: string; monthlyPrice: number | null; currency: string; vatIncluded?: boolean }, prices?: PlanPrices): { amount: number | null; currency: string; vatIncluded?: boolean } {
  const m = prices?.[p.name]
  // 현지 가격이 없어도 콘텐츠가 세금 표기를 알면(plans[].vatIncluded) 그대로 보인다 — 원화 가격에 VAT 표기가 없으면 marketing price-notation 이 떨어진다
  if (!m) return { amount: p.monthlyPrice, currency: p.currency, ...(typeof p.vatIncluded === "boolean" ? { vatIncluded: p.vatIncluded } : {}) }
  return { amount: MINOR_UNITS.has(m.currency) ? m.amount / 100 : m.amount, currency: m.currency, vatIncluded: m.vatIncluded }
}
export type PlanVatCopy = { included: string; excluded: string }
/** 현지 가격에 세금 표기가 있으면 그 문구(없으면 null) */
export const planVatText = (price: { vatIncluded?: boolean }, copy?: PlanVatCopy) => (price.vatIncluded === undefined || !copy ? null : price.vatIncluded ? copy.included : copy.excluded)
