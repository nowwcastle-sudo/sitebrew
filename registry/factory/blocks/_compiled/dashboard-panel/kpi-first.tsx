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
    <section ref={ref} id={id} data-block="dashboard-panel-kpi-first" data-state={state.status} aria-labelledby={`${id}-title`} aria-busy={state.status === "loading" || undefined} className={cn("mx-auto flex w-full max-w-6xl flex-col gap-[var(--wf-section-gap,calc(var(--spacing)*10))] px-4 py-[var(--wf-section-py,calc(var(--spacing)*16))] md:gap-[var(--wf-section-gap-md,calc(var(--spacing)*12))] md:px-8 md:py-[var(--wf-section-py-md,calc(var(--spacing)*24))] in-data-[archetype=dashboard]:gap-6 in-data-[archetype=dashboard]:py-6 md:in-data-[archetype=dashboard]:gap-6 md:in-data-[archetype=dashboard]:py-8", className)}>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between in-data-[archetype=dashboard]:gap-1">
        <BlockHeading id={`${id}-title`} title={copy.title} lead={copy.lead} />
        {data ? (
          <p className="shrink-0 text-base leading-[1.5]">
            {copy.asOfLabel} <span data-numeric>{data.asOf}</span>
          </p>
        ) : null}
      </div>
      {state.status === "loading" ? (
        <div key="loading" className="flex flex-col gap-6">
          <span role="status" className="sr-only">
            {copy.loadingLabel}
          </span>
          <div aria-hidden="true" className="grid gap-8 border-2 border-foreground px-6 py-8 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] md:items-end md:px-10 md:py-10">
            <Skeleton className="h-5 w-4/5" />
            <Skeleton className="h-16 w-3/5" />
            <Skeleton className="h-5 w-2/5" />
          </div>
          <div aria-hidden="true" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        </div>
      ) : state.status === "empty" ? (
        <ListEmpty title={copy.empty.title} body={state.reason ?? copy.empty.body} action={copy.empty.action} />
      ) : state.status === "error" ? (
        <ListError title={copy.error.title} message={state.message} retryLabel={copy.error.retryLabel} retry={state.retry} />
      ) : (
        <div key="ready" className="flex flex-col gap-6">
          <div data-enter className="grid gap-8 border-2 border-foreground px-6 py-8 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] md:items-end md:px-10 md:py-10">
            <div className="flex min-w-0 flex-col items-start gap-3">
              <p className="text-base leading-[1.5] font-medium">{copy.focusLabel}</p>
              {data?.focus ? <p className="text-[1.563rem] leading-[1.3] md:text-[1.953rem] font-heading">{data.focus.title}</p> : null}
              {data?.focus?.detail ? <p className="text-base leading-[1.7]">{data.focus.detail}</p> : null}
              {data?.focus?.action ? (
                <Button nativeButton={false} render={<a href={data.focus.action.href} />} className="mt-2">
                  {data.focus.action.label}
                  <ArrowRight aria-hidden="true" />
                </Button>
              ) : null}
            </div>
            {top ? <KpiTile k={top} copy={copy.kpi} size="lg" className="md:border-s md:ps-8" /> : null}
          </div>
          {rest.length ? (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
