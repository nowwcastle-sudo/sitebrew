"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import { ArrowRight } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"
import { Table, TableBody, TableHeader, TableRow } from "@/registry/factory/ui/table"

import { BlockHeading } from "../_shared/block-heading"
import { fillText } from "../_shared/billing-format"
import { RowCells, SortHead, TableStatus, applyQuery, useTableQuery, type TableCopy, type TableQuery, type TableState } from "../_shared/data-table-kit"
import { ExportActions, type ExportCopy } from "../_shared/export-actions"
import { ScrollHint } from "../_shared/scroll-hint"

// 데이터 표 — 작은 표(A82). 대시보드·설정 안에 끼는 「최근 N건」: 검색·거르기·쪽 이동 없이 열 머리 정렬만, 줄 높이는 촘촘하게(compact). 표에 다 못 담으면
// 위 N건만 보이고 아래 「전체 M건 보기」 링크가 전체 목록(admin-list)으로 간다 — 표 안에서 쪽을 넘기지 않는다. 읽기 4상태.
export type DataTableCompactCopy = Pick<TableCopy, "caption" | "regionLabel" | "sort" | "empty" | "loading" | "error" | "scrollHint"> & {
  title: string
  lead?: string
  // 거르고 정렬한 결과 전부를 CSV 로 받거나 복사하는 단추(선택 — 없으면 그리지 않는다)
  export?: ExportCopy
  // 「전체 {total}건 보기」 — 표에 다 담았으면 링크를 그리지 않는다
  viewAll: { label: string; href: string }
}
export type DataTableCompactProps = BlockBase<DataTableCompactCopy> & {
  state: TableState
  limit?: number
  initialQuery?: Partial<TableQuery>
}

export function DataTableCompact({ copy, locale, state, limit = 5, initialQuery, id = "compact-table", className }: DataTableCompactProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"))
  })
  const api = useTableQuery(initialQuery)
  const data = state.status === "ready" && state.data.rows.length ? state.data : null
  const all = data ? applyQuery(data, api.query) : []
  const rows = all.slice(0, limit)
  return (
    <section ref={ref} id={id} data-block="data-table-compact" data-state={state.status} aria-labelledby={`${id}-title`} aria-busy={state.status === "loading" || undefined} className={cn("mx-auto flex w-full max-w-6xl flex-col gap-[var(--wf-section-gap,calc(var(--spacing)*10))] px-4 py-[var(--wf-section-py,calc(var(--spacing)*16))] md:gap-[var(--wf-section-gap-md,calc(var(--spacing)*12))] md:px-8 md:py-[var(--wf-section-py-md,calc(var(--spacing)*24))] in-data-[archetype=dashboard]:gap-6 in-data-[archetype=dashboard]:py-6 md:in-data-[archetype=dashboard]:gap-6 md:in-data-[archetype=dashboard]:py-8", className)}>
      <BlockHeading id={`${id}-title`} title={copy.title} lead={copy.lead} />
      <div data-enter className="flex flex-col gap-2 [&_td]:py-1.5 [&_th[scope=row]]:py-1.5">
        <TableStatus state={state} copy={copy} rows={limit} />
        {data ? (
          <>
            {copy.export && all.length ? <ExportActions columns={data.columns} rows={all} copy={copy.export} /> : null}
            <ScrollHint locale={locale} text={copy.scrollHint} className="w-full min-w-0">
              <Table className="text-base">
                <caption className="sr-only">{copy.caption}</caption>
                <TableHeader>
                  <TableRow>
                    {data.columns.map((c) => (
                      <SortHead key={c.id} col={c} api={api} copy={copy} />
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id} data-row={r.id}>
                      <RowCells columns={data.columns} row={r} />
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollHint>
            {all.length > rows.length ? (
              <p className="flex justify-end">
                <a href={copy.viewAll.href} className="relative inline-flex min-h-11 items-center gap-1 text-base underline underline-offset-4">
                  {fillText(copy.viewAll.label, { total: all.length })}
                  <ArrowRight aria-hidden="true" className="size-4" />
                </a>
              </p>
            ) : null}
          </>
        ) : null}
      </div>
    </section>
  )
}
