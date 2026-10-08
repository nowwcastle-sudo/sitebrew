"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"
import { Table, TableBody, TableHeader, TableRow } from "@/registry/factory/ui/table"

import { BlockHeading } from "../_shared/block-heading"
import { NoResults, RowCells, SortHead, TablePager, TableStatus, TableToolbar, applyQuery, pageOf, useTableQuery, type TableCopy, type TableQuery, type TableState } from "../_shared/data-table-kit"
import { ExportActions, type ExportCopy } from "../_shared/export-actions"
import { ScrollHint } from "../_shared/scroll-hint"

// 데이터 표 — 관리자 목록(A82, NN/g Data Tables). 위: 검색 칸 + 열 거르기(선택) + 결과 수(role=status) + [필터 초기화]. 가운데: 표(첫 열은 사람이 읽는 식별자 = 행 머리·상세 링크,
// 정렬 가능한 열 머리는 진짜 버튼 + aria-sort, 숫자 열 오른쪽·data-numeric, 상태 열 글자 배지). 아래: 쪽 이동(「1–10 / 전체 47건」).
// 읽기 4상태 + 「결과 없음」(거른 결과 0건 — 처음부터 비어 있는 것과 다르게 이유·[필터 초기화])을 그린다.
// 서버가 쪽마다 주는 표는 조립하는 쪽이 onQueryChange 로 다시 읽어 state 를 바꾼다(클라이언트에서는 받은 행 안에서 거른다).
// export: 거르고 정렬한 결과 전부를 CSV 로 받거나 복사하는 단추(선택 — 없으면 그리지 않는다)
export type DataTableAdminListCopy = TableCopy & { title: string; lead?: string; export?: ExportCopy }
export type DataTableAdminListProps = BlockBase<DataTableAdminListCopy> & {
  state: TableState
  pageSize?: number
  initialQuery?: Partial<TableQuery>
  onQueryChange?: (query: TableQuery) => void
}

export function DataTableAdminList({ copy, locale, state, pageSize = 10, initialQuery, onQueryChange, id = "admin-list", className }: DataTableAdminListProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"))
  })
  const api = useTableQuery(initialQuery, onQueryChange)
  const data = state.status === "ready" && state.data.rows.length ? state.data : null
  const matched = data ? applyQuery(data, api.query) : []
  const page = pageOf(matched, api.query.page, pageSize)
  return (
    <section ref={ref} id={id} data-block="data-table-admin-list" data-state={state.status} aria-labelledby={`${id}-title`} aria-busy={state.status === "loading" || undefined} className={cn("cn-block-section", className)}>
      <BlockHeading id={`${id}-title`} title={copy.title} lead={copy.lead} />
      <div data-enter className="cn-block-dt">
        <TableStatus state={state} copy={copy} rows={Math.min(pageSize, 8)} />
        {data ? (
          <>
            <TableToolbar id={id} data={data} api={api} copy={copy} shown={matched.length} total={data.rows.length} />
            {copy.export && matched.length ? <ExportActions columns={data.columns} rows={matched} copy={copy.export} /> : null}
            {matched.length === 0 ? (
              <NoResults copy={copy} api={api} />
            ) : (
              <ScrollHint locale={locale} text={copy.scrollHint} className="cn-block-dt-wrap">
                <Table className="cn-block-dt-table">
                  <caption className="sr-only">{copy.caption}</caption>
                  <TableHeader>
                    <TableRow>
                      {data.columns.map((c) => (
                        <SortHead key={c.id} col={c} api={api} copy={copy} />
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {page.rows.map((r) => (
                      <TableRow key={r.id} data-row={r.id}>
                        <RowCells columns={data.columns} row={r} />
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollHint>
            )}
            <TablePager copy={copy} page={page.page} pages={page.pages} from={page.from} to={page.to} total={page.total} onPage={api.setPage} />
          </>
        ) : null}
      </div>
    </section>
  )
}
