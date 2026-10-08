"use client"

import * as React from "react"

import type { AsyncState, BlockBase } from "@/registry/factory/contract/block-contract"
import type { Cta } from "@/registry/factory/content/content-core"
import { ArrowRight } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"
import { Button } from "@/registry/factory/ui/button"
import { Skeleton } from "@/registry/factory/ui/skeleton"

import { BlockHeading } from "../_shared/block-heading"
import { KpiTile, type DashboardData, type KpiCopy } from "../_shared/dashboard-kit"
import { ListEmpty, ListError } from "../_shared/list-status"

// 대시보드 — 1순위 결정 + KPI 줄. 맨 위 큰 칸: 지금 먼저 할 한 가지(focus — 없으면 순위 1 KPI) + 그 행동, 곁에 순위 1 KPI 큰 숫자.
// 아래 나머지 KPI(순위 순) 한 줄 격자. 네 상태: loading = 같은 모양 뼈대 + aria-busy, empty = 안내 + 행동, error = 메시지 + [다시 시도], ready.
export type DashboardPanelKpiFirstCopy = {
  title: string
  lead?: string
  asOfLabel: string
  focusLabel: string
  kpi: KpiCopy
  loadingLabel: string
  empty: { title: string; body?: string; action?: Cta }
  error: { title: string; retryLabel: string }
}
export type DashboardPanelKpiFirstProps = BlockBase<DashboardPanelKpiFirstCopy> & { state: AsyncState<DashboardData> }

export function DashboardPanelKpiFirst({ copy, state, id = "overview", className }: DashboardPanelKpiFirstProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"), { stagger: 0.05 })
  })
  const data = state.status === "ready" ? state.data : null
  const kpis = data ? [...data.kpis].sort((a, b) => a.rank - b.rank) : []
  const [top, ...rest] = kpis
  return (
    <section ref={ref} id={id} data-block="dashboard-panel-kpi-first" data-state={state.status} aria-labelledby={`${id}-title`} aria-busy={state.status === "loading" || undefined} className={cn("cn-block-section", className)}>
      <div className="cn-block-dash-head">
        <BlockHeading id={`${id}-title`} title={copy.title} lead={copy.lead} />
        {data ? (
          <p className="cn-block-dash-asof">
            {copy.asOfLabel} <span data-numeric>{data.asOf}</span>
          </p>
        ) : null}
      </div>
      {state.status === "loading" ? (
        <div key="loading" className="cn-block-dash-first">
          <span role="status" className="sr-only">
            {copy.loadingLabel}
          </span>
          <div aria-hidden="true" className="cn-block-dash-focus">
            <Skeleton className="cn-block-dash-skel-line" />
            <Skeleton className="cn-block-dash-skel-big" />
            <Skeleton className="cn-block-dash-skel-line-short" />
          </div>
          <div aria-hidden="true" className="cn-block-dash-kpi-row-grid">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="cn-block-dash-skel-tile" />
            ))}
          </div>
        </div>
      ) : state.status === "empty" ? (
        <ListEmpty title={copy.empty.title} body={state.reason ?? copy.empty.body} action={copy.empty.action} />
      ) : state.status === "error" ? (
        <ListError title={copy.error.title} message={state.message} retryLabel={copy.error.retryLabel} retry={state.retry} />
      ) : (
        <div key="ready" className="cn-block-dash-first">
          <div data-enter className="cn-block-dash-focus">
            <div className="cn-block-dash-focus-text">
              <p className="cn-block-dash-focus-label">{copy.focusLabel}</p>
              {data?.focus ? <p className="cn-block-dash-focus-title font-heading">{data.focus.title}</p> : null}
              {data?.focus?.detail ? <p className="cn-block-dash-focus-detail">{data.focus.detail}</p> : null}
              {data?.focus?.action ? (
                <Button nativeButton={false} render={<a href={data.focus.action.href} />} className="cn-block-dash-focus-action">
                  {data.focus.action.label}
                  <ArrowRight aria-hidden="true" />
                </Button>
              ) : null}
            </div>
            {top ? <KpiTile k={top} copy={copy.kpi} size="lg" className="cn-block-dash-focus-kpi" /> : null}
          </div>
          {rest.length ? (
            <ul className="cn-block-dash-kpi-row-grid">
              {rest.map((k) => (
                <li key={k.id} data-enter>
                  <KpiTile k={k} copy={copy.kpi} />
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
    </section>
  )
}
