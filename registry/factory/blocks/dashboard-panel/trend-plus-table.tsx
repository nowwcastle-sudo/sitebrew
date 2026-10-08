"use client"

import * as React from "react"

import type { AsyncState, BlockBase } from "@/registry/factory/contract/block-contract"
import type { Cta } from "@/registry/factory/content/content-core"
import { cn } from "@/registry/factory/lib/utils"
import { rise, svgDraw } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"
import { Button } from "@/registry/factory/ui/button"
import { Skeleton } from "@/registry/factory/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/registry/factory/ui/table"

import { BlockHeading } from "../_shared/block-heading"
import { formatNumber, withUnit, type DashboardData, type TrendSeries } from "../_shared/dashboard-kit"
import { ListEmpty, ListError } from "../_shared/list-status"
import { ScrollHint } from "../_shared/scroll-hint"

// 대시보드 — 추세 차트 + 표(필터). 위: 지표 고르기(진짜 버튼, aria-pressed — 누르면 차트 지표가 바뀐다) + 한 문장 결론 제목 +
// SVG 선 차트(데이터 점으로만 그린다 — 장식 선·격자 없음, 목표값이 있을 때만 목표 선) · 최솟값·최댓값·처음·끝 글자는 HTML.
// 읽기 도구에는 점 목록(sr-only 표)을 준다. 아래: 필터(한 열의 값으로 거르기, 결과 수 role=status) + 데이터 표(첫 열은 사람이 읽는 식별자,
// 숫자 열은 data-numeric·오른쪽 정렬, 행 높이는 표 density). 네 상태는 product-list 와 같다.
export type DashboardPanelTrendPlusTableCopy = {
  title: string
  lead?: string
  asOfLabel: string
  metricsLabel: string
  // 차트 결론 제목 틀 — {label} 지표 이름, {first}·{last} 처음·끝 값, {from}·{to} 처음·끝 이름
  chartTitle: string
  targetLabel: string
  pointsCaption: string
  tableCaption: string
  filter?: { label: string; column: string; allLabel: string }
  resultTemplate: string
  // 표가 칸보다 넓을 때만 보이는 「옆으로 밀어 보세요」 글(선택 — 없으면 부품 문구 표의 locale 값, _shared/scroll-hint)
  scrollHint?: string
  loadingLabel: string
  empty: { title: string; body?: string; action?: Cta }
  error: { title: string; retryLabel: string }
}
export type DashboardPanelTrendPlusTableProps = BlockBase<DashboardPanelTrendPlusTableCopy> & { state: AsyncState<DashboardData> }

const W = 640
const H = 200
const fill = (t: string, v: Record<string, string>) => t.replace(/\{(\w+)\}/g, (_, k: string) => v[k] ?? "")

function TrendChart({ series, unit, label, target, copy, id }: { series: TrendSeries; unit: string; label: string; target?: number; copy: DashboardPanelTrendPlusTableCopy; id: string }) {
  const pts = series.points
  const values = pts.map((p) => p.value)
  const all = target !== undefined ? [...values, target] : values
  const lo = Math.min(...all)
  const hi = Math.max(...all)
  const span = hi - lo || 1
  const x = (i: number) => (pts.length === 1 ? W / 2 : (i / (pts.length - 1)) * W)
  const y = (v: number) => 8 + (1 - (v - lo) / span) * (H - 16)
  const d = pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(" ")
  const first = pts[0]
  const last = pts[pts.length - 1]
  const title = fill(copy.chartTitle, { label, first: withUnit(first.value, unit), last: withUnit(last.value, unit), from: first.label, to: last.label })
  return (
    <figure className="cn-block-trend-figure" aria-labelledby={`${id}-chart-title`}>
      <figcaption id={`${id}-chart-title`} className="cn-block-trend-title font-heading">
        {title}
      </figcaption>
      <div className="cn-block-trend-plot">
        <div aria-hidden="true" className="cn-block-trend-y">
          <span data-numeric>{withUnit(hi, unit)}</span>
          <span data-numeric>{withUnit(lo, unit)}</span>
        </div>
        <div className="cn-block-trend-canvas">
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true" focusable="false" className="cn-block-trend-svg">
            {target !== undefined ? <line x1={0} x2={W} y1={y(target)} y2={y(target)} vectorEffect="non-scaling-stroke" className="cn-block-trend-target" /> : null}
            <path d={d} pathLength={1} vectorEffect="non-scaling-stroke" data-trend-line className="cn-block-trend-line" />
          </svg>
          {target !== undefined ? (
            <span aria-hidden="true" className="cn-block-trend-target-label" style={{ top: `${(y(target) / H) * 100}%` }}>
              {copy.targetLabel} <span data-numeric>{withUnit(target, unit)}</span>
            </span>
          ) : null}
        </div>
        <div aria-hidden="true" className="cn-block-trend-x">
          <span>{first.label}</span>
          <span>{last.label}</span>
        </div>
      </div>
      <table className="sr-only">
        <caption>{copy.pointsCaption}</caption>
        <tbody>
          {pts.map((p) => (
            <tr key={p.label}>
              <th scope="row">{p.label}</th>
              <td data-numeric>{withUnit(p.value, unit)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}

export function DashboardPanelTrendPlusTable({ copy, locale, state, id = "trend", className }: DashboardPanelTrendPlusTableProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"))
    svgDraw(s, s.q("[data-trend-line]"), { at: 0.2 })
  })
  const data = state.status === "ready" ? state.data : null
  const withSeries = (data?.kpis ?? []).filter((k) => data?.trends?.some((t) => t.kpi === k.id)).sort((a, b) => a.rank - b.rank)
  const [metric, setMetric] = React.useState<string | null>(null)
  const current = withSeries.find((k) => k.id === metric) ?? withSeries[0]
  const series = current ? data?.trends?.find((t) => t.kpi === current.id) : undefined
  const table = data?.table
  const filterCol = copy.filter && table?.columns.some((c) => c.id === copy.filter?.column) ? copy.filter : undefined
  const options = filterCol && table ? [...new Set(table.rows.map((r) => r[filterCol.column]).filter((v): v is string | number => v !== null && v !== undefined).map(String))] : []
  const [pick, setPick] = React.useState<string | null>(null)
  const rows = table ? table.rows.filter((r) => !filterCol || pick === null || String(r[filterCol.column]) === pick) : []
  return (
    <section ref={ref} id={id} data-block="dashboard-panel-trend-plus-table" data-state={state.status} aria-labelledby={`${id}-title`} aria-busy={state.status === "loading" || undefined} className={cn("cn-block-section", className)}>
      <div className="cn-block-dash-head">
        <BlockHeading id={`${id}-title`} title={copy.title} lead={copy.lead} />
        {data ? (
          <p className="cn-block-dash-asof">
            {copy.asOfLabel} <span data-numeric>{data.asOf}</span>
          </p>
        ) : null}
      </div>
      {state.status === "loading" ? (
        <div key="loading" className="cn-block-trend">
          <span role="status" className="sr-only">
            {copy.loadingLabel}
          </span>
          <div aria-hidden="true" className="cn-block-trend-metrics">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="cn-block-trend-skel-chip" />
            ))}
          </div>
          {/* 준비 상태와 같은 높이 — 제목 한 줄 · 차트 · x 글자 줄 · 필터 줄 · 표 머리 + 줄(레이아웃 이동을 줄인다) */}
          <div aria-hidden="true" className="cn-block-trend-figure">
            <Skeleton className="cn-block-trend-skel-title" />
            <Skeleton className="cn-block-trend-skel-chart" />
          </div>
          <div aria-hidden="true" className="cn-block-trend-skel-rows">
            <Skeleton className="cn-block-trend-skel-bar" />
            {Array.from({ length: 9 }, (_, i) => (
              <Skeleton key={i} className="cn-block-trend-skel-row" />
            ))}
          </div>
        </div>
      ) : state.status === "empty" ? (
        <ListEmpty title={copy.empty.title} body={state.reason ?? copy.empty.body} action={copy.empty.action} />
      ) : state.status === "error" ? (
        <ListError title={copy.error.title} message={state.message} retryLabel={copy.error.retryLabel} retry={state.retry} />
      ) : (
        <div key="ready" className="cn-block-trend">
          {withSeries.length > 1 ? (
            <div data-enter role="group" aria-label={copy.metricsLabel} className="cn-block-trend-metrics">
              {withSeries.map((k) => (
                <Button key={k.id} type="button" size="sm" variant={k.id === current?.id ? "default" : "outline"} aria-pressed={k.id === current?.id} onClick={() => setMetric(k.id)}>
                  {k.label}
                </Button>
              ))}
            </div>
          ) : null}
          {current && series?.points.length ? (
            <div data-enter>
              <TrendChart series={series} unit={current.unit} label={current.label} target={current.baseline.target} copy={copy} id={id} />
            </div>
          ) : null}
          {table ? (
            <div data-enter className="cn-block-trend-table-wrap">
              <div className="cn-block-trend-table-bar">
                {filterCol && options.length > 1 ? (
                  <div role="group" aria-label={filterCol.label} className="cn-block-trend-filter">
                    {[null, ...options].map((o) => (
                      <Button key={o ?? "all"} type="button" size="sm" variant={pick === o ? "secondary" : "ghost"} aria-pressed={pick === o} onClick={() => setPick(o)}>
                        {o ?? filterCol.allLabel}
                      </Button>
                    ))}
                  </div>
                ) : null}
                <p role="status" className="cn-block-trend-count">
                  {fill(copy.resultTemplate, { n: formatNumber(rows.length) })}
                </p>
              </div>
              <ScrollHint locale={locale} text={copy.scrollHint} className="cn-block-trend-scroll">
                <Table data-density={table.density} className="cn-block-trend-table">
                  <caption className="sr-only">{copy.tableCaption}</caption>
                  <TableHeader>
                    <TableRow>
                      {table.columns.map((c) => (
                        <TableHead key={c.id} data-numeric={c.numeric ? "" : undefined} className="cn-block-trend-th">
                          {c.label}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r, i) => (
                      <TableRow key={i} className="cn-block-trend-tr">
                        {table.columns.map((c, ci) =>
                          ci === 0 ? (
                            <th key={c.id} scope="row" className="cn-block-trend-rowhead">
                              {r[c.id] ?? ""}
                            </th>
                          ) : c.numeric ? (
                            <TableCell key={c.id} data-numeric className="cn-block-trend-num">
                              {typeof r[c.id] === "number" ? formatNumber(r[c.id] as number) : (r[c.id] ?? "")}
                            </TableCell>
                          ) : (
                            <TableCell /* numeric-cell: 글자 열 */ key={c.id} className="cn-block-trend-td">
                              {r[c.id] ?? ""}
                            </TableCell>
                          ),
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollHint>
            </div>
          ) : null}
        </div>
      )}
    </section>
  )
}
