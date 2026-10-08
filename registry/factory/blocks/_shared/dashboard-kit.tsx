import * as React from "react"

import type { DashboardContent } from "@/registry/factory/content/schemas/dashboard"
import { cn } from "@/registry/factory/lib/utils"

// 대시보드 조각(P3-2 공유 조각 block-shared-dashboard-kit — dashboard-panel 세 변형이 같이 쓴다). factory-rules.md §21-7.
// 데이터 모양 하나(DashboardData)와 KPI 한 칸의 값·판단 기준·델타 글자. 숫자는 모두 HTML 글자(data-numeric, ko-KR 자리 구분).
// 기준 없는 숫자는 싣지 않는다 — KPI 는 dashboard 원형 스키마의 kpis 칸 그대로(목표·정상 범위·비교 기간 중 하나 이상).

export type Kpi = DashboardContent["kpis"][number]
export type TrendSeries = { kpi: string; points: { label: string; value: number }[] }
export type DashboardTable = NonNullable<DashboardContent["table"]>
export type ActionItem = {
  id: string
  severity: "critical" | "warning"
  title: string
  detail?: string
  owner?: string
  due?: string
  recordUrl: string
  actions: { label: string; href: string }[]
}
/** 대시보드 블록이 받는 읽기 데이터(state: AsyncState<DashboardData>). 변형마다 쓰는 칸만 채운다. */
export type DashboardData = {
  asOf: string
  kpis: Kpi[]
  // 1순위 결정 한 줄(kpi-first) — 없으면 순위 1 KPI 를 크게
  focus?: { title: string; detail?: string; action?: { label: string; href: string } }
  trends?: TrendSeries[]
  table?: DashboardTable
  actions?: ActionItem[]
}

/** KPI 문구 틀 — {v}·{a}·{b}·{p} 자리를 채운다. */
export type KpiCopy = {
  target: string // 「목표 {v}」
  range: string // 「정상 {a}~{b}」
  compare: string // 「{p} 대비」
  up: string // 「{v} 늘었어요」
  down: string // 「{v} 줄었어요」
  flat: string // 「변화 없음」
}

const fill = (t: string, v: Record<string, string>) => t.replace(/\{(\w+)\}/g, (_, k: string) => v[k] ?? "")
export const formatNumber = (n: number) => n.toLocaleString("ko-KR", { maximumFractionDigits: 2 })
export const withUnit = (n: number, unit: string) => `${formatNumber(n)}${unit}`

/** 판단 기준 한 줄(목표·정상 범위·비교 기간 — 있는 것을 모두). */
export function baselineText(k: Kpi, copy: KpiCopy): string {
  const b = k.baseline
  return [
    b.target !== undefined ? fill(copy.target, { v: withUnit(b.target, k.unit) }) : null,
    b.range ? fill(copy.range, { a: formatNumber(b.range[0]), b: withUnit(b.range[1], k.unit) }) : null,
    b.comparePeriod ? fill(copy.compare, { p: b.comparePeriod }) : null,
  ]
    .filter(Boolean)
    .join(" · ")
}

/** 델타: 부호 붙은 짧은 글자(+3.2%) + 읽기 도구용 말(「3.2% 늘었어요」). 색만으로 방향을 알리지 않는다. */
export function Delta({ k, copy, className }: { k: Kpi; copy: KpiCopy; className?: string }) {
  if (k.delta === undefined) return null
  const d = k.delta
  const v = withUnit(Math.abs(d), k.unit)
  const said = d > 0 ? fill(copy.up, { v }) : d < 0 ? fill(copy.down, { v }) : copy.flat
  return (
    <span className={cn("cn-block-dash-delta", className)} data-direction={d > 0 ? "up" : d < 0 ? "down" : "flat"}>
      <span data-numeric aria-hidden="true">
        {d > 0 ? "+" : d < 0 ? "−" : "±"}
        {v}
      </span>
      <span className="sr-only">{said}</span>
    </span>
  )
}

/** KPI 한 칸: 이름 · 값(단위) · 델타 · 판단 기준. size 는 큰 칸(1순위)과 보통 칸. */
export function KpiTile({ k, copy, size = "md", className }: { k: Kpi; copy: KpiCopy; size?: "md" | "lg"; className?: string }) {
  return (
    <div data-size={size} className={cn("cn-block-dash-kpi", className)}>
      <span className="cn-block-dash-kpi-label">{k.label}</span>
      <span className="cn-block-dash-kpi-row">
        <span data-numeric className="cn-block-dash-kpi-value font-heading">
          {formatNumber(k.value)}
          <span className="cn-block-dash-kpi-unit">{k.unit}</span>
        </span>
        <Delta k={k} copy={copy} />
      </span>
      <span className="cn-block-dash-kpi-base">{baselineText(k, copy)}</span>
    </div>
  )
}
