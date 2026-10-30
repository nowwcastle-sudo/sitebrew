"use client"

import * as React from "react"

import type { ActionResult, BlockBase } from "@/registry/factory/contract/block-contract"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"
import { Button } from "@/registry/factory/ui/button"
import { Checkbox } from "@/registry/factory/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/registry/factory/ui/table"

import { BlockHeading } from "../_shared/block-heading"
import { fillText } from "../_shared/billing-format"
import { ChoiceButton, ChoiceRow } from "../_shared/choice-pair"
import { NoResults, RowCells, SortHead, TablePager, TableStatus, TableToolbar, applyQuery, pageOf, useTableQuery, type TableCopy, type TableQuery, type TableState } from "../_shared/data-table-kit"
import { ListEmpty } from "../_shared/list-status"
import { FormAlert, usePortForm } from "../_shared/port-form"
import { ExportActions, type ExportCopy } from "../_shared/export-actions"
import type { SubmitNotices } from "../_shared/submit-guard"
import { ScrollHint } from "../_shared/scroll-hint"

// 데이터 표 — 묶음 선택(A82, NN/g Bulk Actions). 첫 열 체크칸 · 머리 체크칸(이 쪽 전체 고르기, 일부면 반쯤 표시) · 한 쪽을 다 고르면 「전체 N건 모두 고르기」 제안 ·
// 고른 뒤에는 표 위 작업 줄(고른 수 role=status + 작업 버튼들). 지우기처럼 되돌리기 어려운 작업은 그 자리에서 [취소][N건 지우기] 대등 확인(L3),
// 나머지는 바로 하고 결과 줄에 [되돌리기]를 둔다(NN/g: 확인보다 되돌리기). 처음에는 아무것도 고르지 않는다(미리 체크 없음).
// 「전체 N건」은 화면 밖 행까지 뜻한다 — 서버에는 id 목록이 아니라 { mode: "query", query, expectedTotal }로 보낸다(개수가 다르면 서버가 거절 — D141).
// 검색·거르기를 바꾸면 고른 것을 지운다(안 보이는 행에 작업이 가지 않게).
export type BulkAction = { id: string; label: string; destructive?: boolean; effect?: "remove" }
export type BulkSelection = { mode: "ids"; ids: string[] } | { mode: "query"; query: { search: string; filters: Record<string, string> }; expectedTotal: number }
export type BulkSubmit = (input: { action: string; selection: BulkSelection }) => Promise<ActionResult<{ done: number; undoToken?: string }>>
export type BulkUndo = (input: { token: string }) => Promise<ActionResult<{ restored: number }>>

export type DataTableBulkSelectCopy = TableCopy & {
  // 거르고 정렬한 결과 전부를 CSV 로 받거나 복사하는 단추(선택 — 없으면 그리지 않는다)
  export?: ExportCopy
  title: string
  lead?: string
  select: { all: string; row: string; page: string; allMatching: string; everything: string; clear: string }
  bar: { label: string; selected: string; hint: string }
  actions: BulkAction[]
  confirm: { question: string; cancel: string; confirm: string; pending: string }
  done: { template: string; undo: string; undoPending: string; undone: string }
  errorTitle: string
  notices: SubmitNotices
}
export type DataTableBulkSelectProps = BlockBase<DataTableBulkSelectCopy> & {
  state: TableState
  bulk: BulkSubmit
  undo?: BulkUndo
  pageSize?: number
  initialQuery?: Partial<TableQuery>
  onQueryChange?: (query: TableQuery) => void
}

type Selection = { scope: string; ids: string[]; all: boolean }
const NONE = (scope: string): Selection => ({ scope, ids: [], all: false })

export function DataTableBulkSelect({ copy, locale, timeZone, state, bulk, undo, pageSize = 10, initialQuery, onQueryChange, id = "bulk-select", className }: DataTableBulkSelectProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"))
  })
  const api = useTableQuery(initialQuery, onQueryChange)
  const form = usePortForm({ id, notices: copy.notices })
  const scope = JSON.stringify([api.query.search, api.query.filters])
  const [picked, setPicked] = React.useState<Selection>(() => NONE(scope))
  const sel = picked.scope === scope ? picked : NONE(scope)
  const [hidden, setHidden] = React.useState<string[]>([])
  const [confirming, setConfirming] = React.useState<BulkAction | null>(null)
  const [result, setResult] = React.useState<{ text: string; undoToken?: string; ids: string[] } | null>(null)
  const resultRef = React.useRef<HTMLParagraphElement>(null)
  const confirmRef = React.useRef<HTMLParagraphElement>(null)
  React.useEffect(() => {
    if (confirming) confirmRef.current?.focus()
  }, [confirming])
  React.useEffect(() => {
    if (result) resultRef.current?.focus()
  }, [result])

  const data = state.status === "ready" && state.data.rows.length ? state.data : null
  const matched = data ? applyQuery(data, api.query, { locale }).filter((r) => !hidden.includes(r.id)) : []
  const page = pageOf(matched, api.query.page, pageSize)
  const pageIds = page.rows.map((r) => r.id)
  const count = sel.all ? matched.length : sel.ids.length
  const pageAll = pageIds.length > 0 && pageIds.every((i) => sel.ids.includes(i))
  const pageSome = pageIds.some((i) => sel.ids.includes(i))
  const primary = data?.columns.find((c) => c.primary)

  const choose = (next: Partial<Selection>) => {
    setPicked({ ...sel, ...next })
    setResult(null)
    setConfirming(null)
  }
  const togglePage = (on: boolean) => choose({ all: false, ids: on ? [...new Set([...sel.ids, ...pageIds])] : sel.ids.filter((i) => !pageIds.includes(i)) })
  const toggleRow = (rid: string, on: boolean) => choose({ all: false, ids: on ? [...sel.ids, rid] : sel.ids.filter((i) => i !== rid) })

  const run = async (action: BulkAction) => {
    const ids = sel.all ? matched.map((r) => r.id) : sel.ids
    const selection: BulkSelection = sel.all ? { mode: "query", query: { search: api.query.search, filters: api.query.filters }, expectedTotal: matched.length } : { mode: "ids", ids }
    const r = await form.run(() => bulk({ action: action.id, selection }))
    if (!r) return
    setConfirming(null)
    setPicked(NONE(scope))
    if (action.effect === "remove") setHidden((h) => [...h, ...ids])
    setResult({ text: fillText(copy.done.template, { n: r.done, action: action.label }), undoToken: r.undoToken, ids: action.effect === "remove" ? ids : [] })
  }
  const restore = async () => {
    if (!result?.undoToken || !undo) return
    const token = result.undoToken
    const r = await form.run(() => undo({ token }))
    if (!r) return
    setHidden((h) => h.filter((i) => !result.ids.includes(i)))
    setResult({ text: copy.done.undone, ids: [] })
  }

  return (
    <section ref={ref} id={id} data-block="data-table-bulk-select" data-state={state.status} aria-labelledby={`${id}-title`} aria-busy={state.status === "loading" || undefined} className={cn("mx-auto flex w-full max-w-6xl flex-col gap-[var(--wf-section-gap,calc(var(--spacing)*10))] px-4 py-[var(--wf-section-py,calc(var(--spacing)*16))] md:gap-[var(--wf-section-gap-md,calc(var(--spacing)*12))] md:px-8 md:py-[var(--wf-section-py-md,calc(var(--spacing)*24))] in-data-[archetype=dashboard]:gap-6 in-data-[archetype=dashboard]:py-6 md:in-data-[archetype=dashboard]:gap-6 md:in-data-[archetype=dashboard]:py-8", className)}>
      <BlockHeading id={`${id}-title`} title={copy.title} lead={copy.lead} />
      <div data-enter className="flex flex-col gap-4">
        <TableStatus state={state} copy={copy} rows={Math.min(pageSize, 8)} />
        {data ? (
          <>
            <TableToolbar id={id} data={data} api={api} copy={copy} shown={matched.length} total={data.rows.length - hidden.length} locale={locale} />
            {copy.export && matched.length ? <ExportActions columns={data.columns} rows={matched} copy={copy.export} /> : null}
            <div role="region" aria-label={copy.bar.label} data-bulk-bar="" data-count={count} className="flex min-h-18 flex-col justify-center gap-3 border px-4 py-3 md:flex-row md:items-center md:justify-between">
              {count > 0 && !confirming ? (
                <>
                  <p role="status" className="text-base leading-[1.5] font-medium">
                    {fillText(copy.bar.selected, { n: count })}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {copy.actions.map((a) => (
                      <Button key={a.id} type="button" variant="outline" disabled={form.pending} focusableWhenDisabled data-bulk-action={a.id} data-destructive={a.destructive ? "" : undefined} onClick={() => (a.destructive ? setConfirming(a) : run(a))}>
                        {a.label}
                      </Button>
                    ))}
                  </div>
                </>
              ) : null}
              {count > 0 && confirming ? (
                <div className="flex w-full flex-col gap-3 md:max-w-2xl">
                  <p ref={confirmRef} tabIndex={-1} className="text-[1.125rem] leading-[1.4] outline-hidden focus-visible:ring-3 focus-visible:ring-ring font-heading">
                    {fillText(copy.confirm.question, { n: count, action: confirming.label })}
                  </p>
                  <ChoiceRow label={fillText(copy.confirm.question, { n: count, action: confirming.label })}>
                    <ChoiceButton choice="decline" type="button" onClick={() => setConfirming(null)}>
                      {copy.confirm.cancel}
                    </ChoiceButton>
                    <ChoiceButton choice="primary" type="button" disabled={form.pending} focusableWhenDisabled onClick={() => run(confirming)}>
                      {form.pending ? copy.confirm.pending : fillText(copy.confirm.confirm, { n: count, action: confirming.label })}
                    </ChoiceButton>
                  </ChoiceRow>
                </div>
              ) : null}
              {count === 0 ? <p className="text-base leading-[1.5]">{copy.bar.hint}</p> : null}
            </div>
            <FormAlert form={form} fieldTitle={copy.errorTitle} serverTitle={copy.errorTitle} />
            {result ? (
              <div role="status" data-bulk-result="" className="flex flex-col items-start gap-3 border-s-4 bg-muted/40 px-4 py-3 sm:flex-row sm:items-center">
                <p ref={resultRef} tabIndex={-1} className="min-w-0 text-base leading-[1.6] outline-hidden focus-visible:ring-3 focus-visible:ring-ring">
                  {result.text}
                </p>
                {result.undoToken && undo ? (
                  <Button type="button" variant="outline" disabled={form.pending} focusableWhenDisabled onClick={restore} data-bulk-undo="">
                    {form.pending ? copy.done.undoPending : copy.done.undo}
                  </Button>
                ) : null}
              </div>
            ) : null}
            {pageAll && matched.length > page.rows.length && !sel.all ? (
              <p role="status" data-select-all-offer="" className="flex flex-col items-start gap-1 border px-4 py-2 text-base leading-[1.5] sm:flex-row sm:items-center sm:gap-3">
                <span>{fillText(copy.select.page, { n: pageIds.length })}</span>
                <Button type="button" variant="link" onClick={() => choose({ all: true })} className="min-h-11 px-0 text-base">
                  {fillText(copy.select.allMatching, { total: matched.length })}
                </Button>
              </p>
            ) : null}
            {sel.all ? (
              <p role="status" data-select-all="" className="flex flex-col items-start gap-1 border px-4 py-2 text-base leading-[1.5] sm:flex-row sm:items-center sm:gap-3">
                <span>{fillText(copy.select.everything, { total: matched.length })}</span>
                <Button type="button" variant="link" onClick={() => choose({ all: false, ids: [] })} className="min-h-11 px-0 text-base">
                  {copy.select.clear}
                </Button>
              </p>
            ) : null}
            {matched.length === 0 && !api.active ? (
              <ListEmpty title={copy.empty.title} body={copy.empty.body} action={copy.empty.action} />
            ) : matched.length === 0 ? (
              <NoResults copy={copy} api={api} />
            ) : (
              <ScrollHint locale={locale} text={copy.scrollHint} className="w-full min-w-0">
                <Table className="text-base">
                  <caption className="sr-only">{copy.caption}</caption>
                  <TableHeader>
                    <TableRow>
                      <TableHead scope="col" className="w-14 min-w-14 px-0 text-center [&_[data-slot=checkbox]]:mx-auto">
                        <Checkbox checked={pageAll || sel.all} indeterminate={pageSome && !pageAll && !sel.all} onCheckedChange={(v) => togglePage(v === true)} aria-label={fillText(copy.select.all, { n: pageIds.length })} data-select-page="" />
                      </TableHead>
                      {data.columns.map((c) => (
                        <SortHead key={c.id} col={c} api={api} copy={copy} />
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {page.rows.map((r) => {
                      const on = sel.all || sel.ids.includes(r.id)
                      const name = primary ? String(r.cells[primary.id] ?? r.id) : r.id
                      return (
                        <TableRow key={r.id} data-row={r.id} data-selected={on ? "" : undefined}>
                          <TableCell /* numeric-cell: 글자 열 */ data-kind="select" className="w-14 min-w-14 px-0 text-center [&_[data-slot=checkbox]]:mx-auto">
                            <Checkbox checked={on} disabled={sel.all} onCheckedChange={(v) => toggleRow(r.id, v === true)} aria-label={fillText(copy.select.row, { name })} data-select-row="" />
                          </TableCell>
                          <RowCells columns={data.columns} row={r} fmt={{ locale, timeZone }} name={name} />
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </ScrollHint>
            )}
            <TablePager copy={copy} page={page.page} pages={page.pages} from={page.from} to={page.to} total={page.total} onPage={api.setPage} locale={locale} />
          </>
        ) : null}
      </div>
    </section>
  )
}
