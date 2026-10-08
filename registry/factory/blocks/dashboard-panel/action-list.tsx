"use client"

import * as React from "react"

import type { AsyncState, BlockBase } from "@/registry/factory/contract/block-contract"
import type { Cta } from "@/registry/factory/content/content-core"
import { AlertCircle, AlertTriangle, User } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"
import { Button } from "@/registry/factory/ui/button"
import { Skeleton } from "@/registry/factory/ui/skeleton"

import { BlockHeading } from "../_shared/block-heading"
import { formatNumber, type DashboardData } from "../_shared/dashboard-kit"
import { ListEmpty, ListError } from "../_shared/list-status"

// 대시보드 — 할 일 목록(심각도·담당). 지금 조치가 필요한 항목만, 긴급 먼저. 줄마다: 심각도(아이콘 + 글자 — 색만으로 알리지 않는다) ·
// 제목(레코드 링크) · 설명 · 담당 · 기한 · 조치 링크(열기·배정·연락). 머리에 건수(긴급 n · 주의 n). 네 상태는 product-list 와 같다 —
// 할 일이 0건이면 empty(「지금 조치할 일이 없습니다」).
export type DashboardPanelActionListCopy = {
  title: string
  lead?: string
  asOfLabel: string
  severity: { critical: string; warning: string }
  // 머리 건수 틀 — {critical}·{warning}
  countTemplate: string
  ownerLabel: string
  dueLabel: string
  loadingLabel: string
  empty: { title: string; body?: string; action?: Cta }
  error: { title: string; retryLabel: string }
}
export type DashboardPanelActionListProps = BlockBase<DashboardPanelActionListCopy> & { state: AsyncState<DashboardData> }

const ORDER = { critical: 0, warning: 1 } as const

export function DashboardPanelActionList({ copy, state, id = "actions", className }: DashboardPanelActionListProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"), { stagger: 0.04 })
  })
  const data = state.status === "ready" ? state.data : null
  const items = [...(data?.actions ?? [])].sort((a, b) => ORDER[a.severity] - ORDER[b.severity])
  const count = (s: "critical" | "warning") => formatNumber(items.filter((i) => i.severity === s).length)
  return (
    <section ref={ref} id={id} data-block="dashboard-panel-action-list" data-state={state.status} aria-labelledby={`${id}-title`} aria-busy={state.status === "loading" || undefined} className={cn("cn-block-section", className)}>
      <div className="cn-block-dash-head">
        <BlockHeading id={`${id}-title`} title={copy.title} lead={copy.lead} />
        {data ? (
          <div className="cn-block-alist-meta">
            <p data-enter className="cn-block-alist-count font-heading">
              {copy.countTemplate.replace("{critical}", count("critical")).replace("{warning}", count("warning"))}
            </p>
            <p className="cn-block-dash-asof">
              {copy.asOfLabel} <span data-numeric>{data.asOf}</span>
            </p>
          </div>
        ) : null}
      </div>
      {state.status === "loading" ? (
        <div key="loading" className="cn-block-alist">
          <span role="status" className="sr-only">
            {copy.loadingLabel}
          </span>
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} aria-hidden="true" className="cn-block-alist-row">
              <Skeleton className="cn-block-alist-skel-badge" />
              <div className="cn-block-alist-body">
                <Skeleton className="cn-block-dash-skel-line" />
                <Skeleton className="cn-block-dash-skel-line-short" />
              </div>
            </div>
          ))}
        </div>
      ) : state.status === "empty" ? (
        <ListEmpty title={copy.empty.title} body={state.reason ?? copy.empty.body} action={copy.empty.action} />
      ) : state.status === "error" ? (
        <ListError title={copy.error.title} message={state.message} retryLabel={copy.error.retryLabel} retry={state.retry} />
      ) : items.length === 0 ? (
        <ListEmpty title={copy.empty.title} body={copy.empty.body} action={copy.empty.action} />
      ) : (
        <ol className="cn-block-alist">
          {items.map((it) => (
            <li key={it.id} data-enter data-severity={it.severity} className="cn-block-alist-row">
              <span className="cn-block-alist-sev">
                {it.severity === "critical" ? <AlertCircle aria-hidden="true" className="cn-block-alist-sev-icon" /> : <AlertTriangle aria-hidden="true" className="cn-block-alist-sev-icon" />}
                {copy.severity[it.severity]}
              </span>
              <div className="cn-block-alist-body">
                <a href={it.recordUrl} className="cn-block-alist-title font-heading">
                  {it.title}
                </a>
                {it.detail ? <p className="cn-block-alist-detail">{it.detail}</p> : null}
                {it.owner || it.due ? (
                  <p className="cn-block-alist-facts">
                    {it.owner ? (
                      <span className="cn-block-alist-fact">
                        <User aria-hidden="true" className="cn-block-alist-fact-icon" />
                        <span className="sr-only">{copy.ownerLabel} </span>
                        {it.owner}
                      </span>
                    ) : null}
                    {it.due ? (
                      <span className="cn-block-alist-fact">
                        {copy.dueLabel} <span data-numeric>{it.due}</span>
                      </span>
                    ) : null}
                  </p>
                ) : null}
              </div>
              <div className="cn-block-alist-actions">
                {it.actions.map((a) => (
                  <Button key={a.label} variant="outline" size="sm" nativeButton={false} render={<a href={a.href} />}>
                    {a.label}
                    <span className="sr-only"> — {it.title}</span>
                  </Button>
                ))}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
