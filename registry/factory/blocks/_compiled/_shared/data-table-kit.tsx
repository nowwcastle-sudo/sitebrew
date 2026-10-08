"use client"

import * as React from "react"

import type { AsyncState } from "@/registry/factory/contract/block-contract"
import type { Cta } from "@/registry/factory/content/content-core"
import { ArrowDown, ChevronDown, Search, SortAsc, X } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"
import { Badge } from "@/registry/factory/ui/badge"
import { Button } from "@/registry/factory/ui/button"
import { Input } from "@/registry/factory/ui/input"
import { NativeSelect, NativeSelectOption } from "@/registry/factory/ui/native-select"
import { Skeleton } from "@/registry/factory/ui/skeleton"
import { TableCell, TableHead } from "@/registry/factory/ui/table"

import { fillText } from "../_shared/billing-format"
import { ListEmpty, ListError } from "../_shared/list-status"

// 데이터 표 공유 조각(P3-2 Task 7b, 대장 A82 — block-shared-data-table-kit — data-table 네 변형이 같이 쓴다). NN/g Data Tables·Bulk Actions·Empty States.
//   · 데이터 모양 하나(TableData — 열 목록 + 행 목록). 행은 id 가 있고 칸 값은 글자·숫자·null 뿐이다(HTML 은 값이 아니라 열 종류가 정한다: text·numeric·date·status).
//   · 질의(검색·거르기·정렬·쪽)는 순수 함수(applyQuery·pageOf)와 훅(useTableQuery)이다. 서버가 쪽마다 주는 표는 조립하는 쪽이 onQueryChange 로 다시 읽어 state 를 바꾼다.
//   · 「결과 없음」(거른 결과가 0건)은 「처음부터 비어 있음」(empty)과 다른 화면이다 — 이유(검색어·필터)를 말하고 [필터 초기화]를 준다.
//   · 첫 열(primary)은 사람이 읽는 식별자다 — 행 머리(th scope=row)이고 href 가 있으면 그 행의 상세 링크다. 숫자 열은 data-numeric·오른쪽 정렬, 상태 열은 글자 배지(색만으로 알리지 않는다).
//   · 문구는 모두 블록 copy 가 준다(여기에 글자를 두지 않는다).

export type TableColumn = {
  id: string
  label: string
  kind?: "text" | "numeric" | "date" | "status"
  sortable?: boolean
  // 이 열의 값으로 거르는 선택 칸을 만든다(text·status 열)
  filter?: boolean
  // 사람이 읽는 식별자 열(행 머리·링크) — 표마다 하나
  primary?: boolean
  // 좁은 화면(md 미만)에서 숨긴다(가로 스크롤 대신 덜 중요한 열을 뺀다)
  secondary?: boolean
}
export type TableCellValue = string | number | null
export type TableRowData = { id: string; cells: Record<string, TableCellValue>; href?: string }
export type TableData = { columns: TableColumn[]; rows: TableRowData[] }
export type TableState = AsyncState<TableData>

export type TableQuery = { search: string; filters: Record<string, string>; sort: { column: string; dir: "asc" | "desc" } | null; page: number }
export const EMPTY_QUERY: TableQuery = { search: "", filters: {}, sort: null, page: 1 }

/** 표 문구(세 표 변형이 같이 쓴다). {…} 자리는 fillText 가 채운다 */
export type TableCopy = {
  caption: string
  regionLabel: string
  search?: { label: string; placeholder?: string }
  filterAll: string
  reset: string
  // 「{shown}건」·「전체 {total}건 중 {shown}건」
  count: string
  sort: { asc: string; desc: string; hint: string }
  pager: { label: string; prev: string; next: string; range: string; page: string }
  empty: { title: string; body?: string; action?: Cta }
  noResults: { title: string; body: string; reset: string }
  // 표가 칸보다 넓을 때만 보이는 「옆으로 밀어 보세요」 글(선택 — 없으면 부품 문구 표의 locale 값, _shared/scroll-hint)
  scrollHint?: string
  loading: string
  error: { title: string; retryLabel: string }
}

const NUMBER = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 2 })
const DATE = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "long", day: "numeric" })

/** 칸 글자(숫자는 자리 구분, 날짜는 서울 날짜, 빈 값은 —) */
export function cellText(col: TableColumn, v: TableCellValue | undefined): string {
  if (v === null || v === undefined || v === "") return "—"
  if (col.kind === "numeric" && typeof v === "number") return NUMBER.format(v)
  if (col.kind === "date" && typeof v === "string") return DATE.format(new Date(v))
  return String(v)
}

const compare = (col: TableColumn, a: TableCellValue | undefined, b: TableCellValue | undefined) => {
  const an = a === null || a === undefined || a === ""
  const bn = b === null || b === undefined || b === ""
  if (an || bn) return an === bn ? 0 : an ? 1 : -1 // 빈 값은 늘 뒤
  if (typeof a === "number" && typeof b === "number") return a - b
  return String(a).localeCompare(String(b), "ko")
}

/** 검색(글자·상태 열 부분 일치)·거르기(열 값 일치)·정렬을 적용한다. 쪽은 자르지 않는다(pageOf) */
export function applyQuery(data: TableData, q: TableQuery): TableRowData[] {
  const needle = q.search.trim().toLowerCase()
  const textCols = data.columns.filter((c) => (c.kind ?? "text") === "text" || c.kind === "status")
  let rows = data.rows.filter((r) => {
    if (needle && !textCols.some((c) => String(r.cells[c.id] ?? "").toLowerCase().includes(needle))) return false
    for (const [col, value] of Object.entries(q.filters)) if (value && String(r.cells[col] ?? "") !== value) return false
    return true
  })
  const sort = q.sort
  const col = sort ? data.columns.find((c) => c.id === sort.column) : undefined
  if (sort && col) {
    const dir = sort.dir === "asc" ? 1 : -1
    // 안정 정렬: 값이 같으면 처음 순서 그대로
    rows = rows
      .map((r, i) => ({ r, i }))
      .sort((x, y) => {
        const a = x.r.cells[col.id]
        const b = y.r.cells[col.id]
        const empty = (v: TableCellValue | undefined) => v === null || v === undefined || v === ""
        if (empty(a) || empty(b)) return compare(col, a, b) || x.i - y.i // 빈 값은 방향과 상관없이 뒤
        return compare(col, a, b) * dir || x.i - y.i
      })
      .map((x) => x.r)
  }
  return rows
}

/** 쪽 자르기 — page 는 범위 안으로 맞춘다(거른 결과가 줄어 없는 쪽을 가리키지 않게) */
export function pageOf<T>(rows: T[], page: number, pageSize: number) {
  const pages = Math.max(1, Math.ceil(rows.length / pageSize))
  const at = Math.min(Math.max(1, page), pages)
  const start = (at - 1) * pageSize
  return { rows: rows.slice(start, start + pageSize), page: at, pages, from: rows.length ? start + 1 : 0, to: Math.min(rows.length, start + pageSize), total: rows.length }
}

/** 열의 거르기 선택지(값 목록, 한글 순) */
export const filterOptions = (data: TableData, col: string): string[] => [...new Set(data.rows.map((r) => r.cells[col]).filter((v): v is string | number => v !== null && v !== undefined && v !== "").map(String))].sort((a, b) => a.localeCompare(b, "ko"))

/** 질의 상태. 바꿀 때마다 1쪽으로(정렬·거르기·검색) — 쪽 이동만 그 쪽으로 간다. onChange 는 조립하는 쪽 알림 */
export function useTableQuery(initial?: Partial<TableQuery>, onChange?: (q: TableQuery) => void) {
  const [query, setQuery] = React.useState<TableQuery>({ ...EMPTY_QUERY, ...initial })
  const set = (next: TableQuery) => {
    setQuery(next)
    onChange?.(next)
  }
  return {
    query,
    setSearch: (search: string) => set({ ...query, search, page: 1 }),
    setFilter: (col: string, value: string) => set({ ...query, filters: { ...query.filters, [col]: value }, page: 1 }),
    // 같은 열을 다시 누르면 오름차순 → 내림차순 → 정렬 없음
    toggleSort: (col: string) => set({ ...query, sort: query.sort?.column !== col ? { column: col, dir: "asc" } : query.sort.dir === "asc" ? { column: col, dir: "desc" } : null, page: 1 }),
    setPage: (page: number) => set({ ...query, page }),
    reset: () => set({ ...EMPTY_QUERY, sort: query.sort }),
    active: query.search.trim() !== "" || Object.values(query.filters).some(Boolean),
  }
}
export type TableQueryApi = ReturnType<typeof useTableQuery>

/** 검색 + 열 거르기 + 결과 수(role=status) + [필터 초기화]. 결과 수는 늘 그려 스크린리더가 거른 결과를 듣는다 */
export function TableToolbar({ id, data, api, copy, shown, total, className }: { id: string; data: TableData; api: TableQueryApi; copy: TableCopy; shown: number; total: number; className?: string }) {
  const filters = data.columns.filter((c) => c.filter)
  return (
    <div className={cn("flex flex-col gap-4 md:flex-row md:flex-wrap md:items-end", className)}>
      {copy.search ? (
        <div className="flex min-w-0 flex-col gap-2 md:w-80">
          <label htmlFor={`${id}-search`} className="text-base leading-[1.5] font-medium">
            {copy.search.label}
          </label>
          <div className="relative">
            <Search aria-hidden="true" className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2" />
            <Input id={`${id}-search`} type="search" name="q" autoComplete="off" value={api.query.search} placeholder={copy.search.placeholder} onChange={(e) => api.setSearch(e.target.value)} className="ps-9" />
          </div>
        </div>
      ) : null}
      {filters.map((c) => (
        <div key={c.id} className="flex min-w-0 flex-col gap-2 md:w-48">
          <label htmlFor={`${id}-filter-${c.id}`} className="text-base leading-[1.5] font-medium">
            {c.label}
          </label>
          <NativeSelect id={`${id}-filter-${c.id}`} value={api.query.filters[c.id] ?? ""} onChange={(e) => api.setFilter(c.id, e.target.value)} className="w-full">
            <NativeSelectOption value="">{copy.filterAll}</NativeSelectOption>
            {filterOptions(data, c.id).map((v) => (
              <NativeSelectOption key={v} value={v}>
                {v}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      ))}
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 md:ms-auto">
        <p role="status" data-result-count={shown} className="text-base leading-[1.5]">
          {fillText(copy.count, { shown: NUMBER.format(shown), total: NUMBER.format(total) })}
        </p>
        {api.active ? (
          <Button type="button" variant="ghost" onClick={api.reset} className="gap-1">
            <X aria-hidden="true" />
            {copy.reset}
          </Button>
        ) : null}
      </div>
    </div>
  )
}

/** 정렬 가능한 열 머리 — 안의 버튼이 정렬을 바꾸고 th 의 aria-sort 가 지금 상태를 알린다 */
export function SortHead({ col, api, copy }: { col: TableColumn; api: TableQueryApi; copy: Pick<TableCopy, "sort"> }) {
  const sort = api.query.sort?.column === col.id ? api.query.sort.dir : null
  if (!col.sortable)
    return (
      <TableHead scope="col" data-kind={col.kind ?? "text"} data-secondary={col.secondary ? "" : undefined} className="data-[kind=numeric]:text-end data-[secondary]:hidden md:data-[secondary]:table-cell">
        {col.label}
      </TableHead>
    )
  return (
    <TableHead scope="col" aria-sort={sort === "asc" ? "ascending" : sort === "desc" ? "descending" : "none"} data-kind={col.kind ?? "text"} data-secondary={col.secondary ? "" : undefined} className="data-[kind=numeric]:text-end data-[secondary]:hidden md:data-[secondary]:table-cell">
      <button type="button" data-sort={sort ?? "none"} onClick={() => api.toggleSort(col.id)} className="relative inline-flex min-h-11 items-center gap-1 text-start font-medium">
        <span>{col.label}</span>
        {sort === "asc" ? <SortAsc aria-hidden="true" className="size-4 shrink-0 data-[idle]:opacity-50" /> : sort === "desc" ? <ArrowDown aria-hidden="true" className="size-4 shrink-0 data-[idle]:opacity-50" /> : <ChevronDown aria-hidden="true" className="size-4 shrink-0 data-[idle]:opacity-50" data-idle="" />}
        <span className="sr-only">{fillText(sort === "asc" ? copy.sort.asc : sort === "desc" ? copy.sort.desc : copy.sort.hint, { column: col.label })}</span>
      </button>
    </TableHead>
  )
}

/** 칸 값 하나 — 열 종류대로(숫자 data-numeric·상태 글자 배지·날짜 time) */
export function CellValue({ col, value }: { col: TableColumn; value: TableCellValue | undefined }) {
  const text = cellText(col, value)
  if (col.kind === "status" && text !== "—") return <Badge variant="outline">{text}</Badge>
  if (col.kind === "numeric") return <span data-numeric>{text}</span>
  if (col.kind === "date" && typeof value === "string") return <time data-numeric dateTime={value}>{text}</time>
  return <>{text}</>
}
/** 행 하나의 칸들 — 첫 열(primary)은 행 머리(href 가 있으면 상세 링크), 나머지는 열 종류대로. name 은 링크 글자를 바꿔 쓸 때 */
export function RowCells({ columns, row, name }: { columns: TableColumn[]; row: TableRowData; name?: string }) {
  return (
    <>
      {columns.map((c) =>
        c.primary ? (
          <TableHead key={c.id} scope="row" data-kind={c.kind ?? "text"} data-secondary={c.secondary ? "" : undefined} className="data-[kind=numeric]:text-end data-[secondary]:hidden md:data-[secondary]:table-cell text-start font-medium break-words">
            {row.href ? (
              <a href={row.href} className="pointer-coarse:min-h-11 relative inline-flex min-h-11 items-center underline underline-offset-4">
                {name ?? String(row.cells[c.id] ?? "—")}
              </a>
            ) : (
              (name ?? String(row.cells[c.id] ?? "—"))
            )}
          </TableHead>
        ) : (
          <TableCell key={c.id} data-kind={c.kind ?? "text"} data-secondary={c.secondary ? "" : undefined} className="data-[kind=numeric]:text-end data-[secondary]:hidden md:data-[secondary]:table-cell">
            <CellValue col={c} value={row.cells[c.id]} />
          </TableCell>
        ),
      )}
    </>
  )
}

/** 「이전·다음」 + 「1–10 / 전체 47건」. 한 쪽뿐이면 그리지 않는다 */
export function TablePager({ copy, page, pages, from, to, total, onPage }: { copy: TableCopy; page: number; pages: number; from: number; to: number; total: number; onPage: (p: number) => void }) {
  if (pages <= 1) return null
  return (
    <nav aria-label={copy.pager.label} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-base leading-[1.5]">
        {fillText(copy.pager.range, { from: NUMBER.format(from), to: NUMBER.format(to), total: NUMBER.format(total) })}
      </p>
      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" disabled={page <= 1} focusableWhenDisabled onClick={() => onPage(page - 1)}>
          {copy.pager.prev}
        </Button>
        <span data-numeric aria-current="page" className="text-base leading-[1.5]">
          {fillText(copy.pager.page, { page, pages })}
        </span>
        <Button type="button" variant="outline" disabled={page >= pages} focusableWhenDisabled onClick={() => onPage(page + 1)}>
          {copy.pager.next}
        </Button>
      </div>
    </nav>
  )
}

/** 거른 결과가 0건 — 처음부터 비어 있는 것(empty)과 다르다: 무엇으로 걸렀는지 말하고 [필터 초기화]를 준다 */
export function NoResults({ copy, api, className }: { copy: TableCopy; api: TableQueryApi; className?: string }) {
  return (
    <div role="status" data-no-results="" className={cn("flex flex-col items-start gap-3 border px-6 py-8", className)}>
      <p className="text-[1.25rem] leading-[1.35] font-heading">{copy.noResults.title}</p>
      <p className="text-base leading-[1.6]">{copy.noResults.body}</p>
      <Button type="button" variant="outline" onClick={api.reset}>
        {copy.noResults.reset}
      </Button>
    </div>
  )
}

/** 읽는 중 자리(머리 + 줄들 — 준비 상태와 비슷한 높이) */
export function TableLoading({ label, rows = 6 }: { label: string; rows?: number }) {
  return (
    <div role="status" className="flex flex-col gap-2">
      <span className="sr-only">{label}</span>
      <Skeleton aria-hidden="true" className="h-11 w-full" />
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} aria-hidden="true" className="h-14 w-full" />
      ))}
    </div>
  )
}

/** 읽기 4상태 중 준비 밖(loading·error·empty)을 그린다. 준비면 null */
export function TableStatus({ state, copy, rows }: { state: TableState; copy: Pick<TableCopy, "empty" | "loading" | "error">; rows?: number }) {
  if (state.status === "loading") return <TableLoading label={copy.loading} rows={rows} />
  if (state.status === "error") return <ListError title={copy.error.title} message={state.message ?? ""} retryLabel={copy.error.retryLabel} retry={state.retry} />
  if (state.status === "empty" || (state.status === "ready" && state.data.rows.length === 0)) return <ListEmpty title={copy.empty.title} body={copy.empty.body} action={copy.empty.action} />
  return null
}
