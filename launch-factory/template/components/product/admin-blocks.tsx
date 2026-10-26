"use client"
// 관리 화면의 클라이언트 잎(계획 3d L1). 서버 쪽(app/(product)/admin/**)이 로그인·관리자 벽을 지나 서버 액션(app/actions/admin-console.ts)으로 읽은 데이터를 일반 값으로 넘기고,
// 여기서 web-factory 블록(data-table/admin-list · record-panel · dashboard-panel/* · nav/app-sidebar)에 이어 준다. 블록은 데이터 모양만 안다 — 포트 모양 → 블록 모양은 lib/launch/to-blocks.ts 한 곳이 바꾼다.
// 행동은 서버 액션 adminAct 다섯 중 하나뿐이다. 되돌리기 어려운 행동(기록의 danger)은 블록의 확인 단계를 지난 뒤에만 `confirmed: true` 를 싣는다(서버가 그 칸 없이는 실행하지 않는다).
// 블록의 읽기 실패·빈 상태는 서버가 준 결과를 그대로 상태로 바꿔 보인다(오류 글은 서버가 이미 가린 일반 문구다).
import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import type { AdminOverview, AdminRecord, AdminResult, AdminSectionInfo, AdminTable } from "@launch-factory/admin-console"
import { DashboardPanelActionList } from "@/components/blocks/dashboard-panel/action-list"
import { DashboardPanelKpiFirst } from "@/components/blocks/dashboard-panel/kpi-first"
import { Button } from "@/components/ui/button"
import { DataTableAdminList } from "@/components/blocks/data-table/admin-list"
import { DataTableRecordPanel } from "@/components/blocks/data-table/record-panel"
import { NavAppSidebar } from "@/components/blocks/nav/app-sidebar"
import { fillText } from "@/components/blocks/_shared/billing-format"
import type { TableQuery } from "@/components/blocks/_shared/data-table-kit"
import type { ContactReceipt } from "@/components/blocks/_shared/form-flow"
import type { ActionResult, AsyncState } from "@/components/contract/block-contract"
import * as admin from "@/app/actions/admin-console"
import { useDisplayPrefs } from "@/components/product/display-prefs"
import { adminNav, listCopy, listLead, listPager, listPastEnd, listRange, overviewCopy, overviewFailed, recordBackLabel, recordCopy, todoCopy, todoOpenLabel } from "@/content/copy.admin.en"
import { newIdempotencyKey } from "@/lib/admin-params"
import { adminListHref, adminPager, type AdminPager } from "@/lib/admin-paging"
import { statusColumnOf, toDashboardData, toRecordActions, toRecordData, toSidebarItems, toTableData } from "@/lib/launch/to-blocks"

/** 서버가 읽기에 실패했을 때 잎에 넘기는 값(글은 서버가 가린 일반 문구) */
export type AdminReadFailure = { message: string; code?: string; retryable?: boolean }

const errorState = (e: AdminReadFailure, retry: () => void): Extract<AsyncState<never>, { status: "error" }> => ({
  status: "error",
  message: e.message,
  retry,
  ...(e.code ? { code: e.code } : {}),
  ...(e.retryable !== undefined ? { retryable: e.retryable } : {}),
})

/** 포트 결과 → 블록 결과(실패는 그대로 — 글·칸 오류·코드·다시 시도 가능 여부) */
function toActionResult<T, U>(r: AdminResult<T>, map: (data: T) => U): ActionResult<U> {
  if (r.ok) return { ok: true, data: map(r.data), ...(r.message ? { message: r.message } : {}) }
  return { ok: false, ...(r.formError ? { formError: r.formError } : {}), ...(r.fieldErrors ? { fieldErrors: r.fieldErrors } : {}), ...(r.retryable !== undefined ? { retryable: r.retryable } : {}), ...(r.code ? { code: r.code } : {}) }
}

/** 지금 경로에 가장 길게 맞는 항목의 주소. 개요(/admin)는 정확히 같을 때만 맞는다 */
export function currentAdminHref(pathname: string, hrefs: readonly string[]): string | undefined {
  let best: string | undefined
  for (const h of hrefs) {
    const hit = h === "/admin" ? pathname === h : pathname === h || pathname.startsWith(`${h}/`)
    if (hit && (!best || h.length > best.length)) best = h
  }
  return best
}

/** 왼쪽 메뉴: 개요 + 이 사람이 볼 수 있는 구획들 */
export function AdminSidebar({ sections }: { sections: AdminSectionInfo[] }) {
  const pathname = usePathname()
  const items = toSidebarItems(sections, adminNav.overview)
  const { overview: _overview, ...nav } = adminNav
  void _overview
  return <NavAppSidebar copy={{ ...nav, groups: [{ items }] }} currentHref={currentAdminHref(pathname, items.map((i) => i.href))} />
}

/** 개요: 가장 급한 일 + 최근 변화(KPI) 위, 할 일 목록 아래. 할 일도 변화도 없으면 둘 다 「지금 필요한 일이 없어요」 빈 상태 */
export function AdminOverviewPanel({ overview, failure }: { overview: AdminOverview | null; failure?: AdminReadFailure }) {
  const prefs = useDisplayPrefs()
  const router = useRouter()
  const state = React.useMemo<AsyncState<NonNullable<ReturnType<typeof toDashboardData>>>>(() => {
    if (failure) return errorState(failure, () => router.refresh())
    const data = overview ? toDashboardData(overview, { openLabel: todoOpenLabel, locale: prefs.locale, timeZone: prefs.timeZone }) : null
    return data ? { status: "ready", data } : { status: "empty" }
  }, [overview, failure, prefs.locale, prefs.timeZone, router])
  return (
    <>
      {overview?.failed?.length ? (
        <p role="status" data-overview-failed="" className="mx-auto w-full max-w-6xl px-4 pt-6 text-base leading-[1.6] md:px-8">
          {fillText(overviewFailed, { sections: overview.failed.join(", ") })}
        </p>
      ) : null}
      <DashboardPanelKpiFirst copy={overviewCopy} state={state} {...prefs} />
      <DashboardPanelActionList copy={todoCopy} state={state} {...prefs} />
    </>
  )
}

/** 서버 쪽 이동 줄(구획의 pageSize 줄 단위). 표 블록 안의 10줄 쪽 이동과 따로이며, 이동은 주소(?page=)를 바꾸는 진짜 링크다 */
function ServerPager({ pager }: { pager: AdminPager }) {
  const link = (href: string | null, label: string) =>
    href ? (
      <Button nativeButton={false} role="link" variant="outline" render={<a href={href} />}>
        {label}
      </Button>
    ) : (
      <Button type="button" variant="outline" disabled focusableWhenDisabled>
        {label}
      </Button>
    )
  return (
    <nav aria-label={listPager.label} data-server-pager="" className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 pb-8 sm:flex-row sm:items-center sm:justify-between md:px-8">
      <p className="text-base leading-[1.5]">{pager.from > 0 ? fillText(listPager.range, { from: pager.from, to: pager.to, total: pager.total }) : fillText(listPastEnd, { total: pager.total })}</p>
      <div className="flex items-center gap-3">
        {link(pager.prevHref, listPager.prev)}
        <span data-numeric aria-current="page" className="text-base leading-[1.5]">
          {fillText(listPager.page, { page: pager.page, pages: pager.pages })}
        </span>
        {link(pager.nextHref, listPager.next)}
      </div>
    </nav>
  )
}

/**
 * 구획 목록. 받은 행 안에서는 블록이 바로 거른다. 행이 한 쪽(pageSize 줄)보다 길면 또는 서버 검색 중이면, 검색·상태 거르기를 주소(?q=&status=)에 실어 서버가 다시 읽게 한다.
 * 한 쪽보다 길면 표 아래에 서버 쪽 이동 줄(?page=)을 둔다 — 검색·상태를 바꾸면 쪽은 1로 돌아간다. 거르기를 안 바꾼 표 안 조작(10줄 쪽 이동·정렬)은 주소를 건드리지 않는다.
 * 서버 검색(구획의 serverSearch 선언)은 가려서 나가는 연락처 칸(메일·이름 등)도 맞춘다 — 그런 구획은 블록이 받은 행을 검색어로 다시 거르지 않고(블록 serverSearch) 항상 서버가 찾는다.
 * 선언이 없는 구획은 받은 행 안에서 보이는 칸으로만 거른다.
 */
export function AdminListPanel({ section, label, table, q, status, page = 1, pageSize = 100, serverSearch = false, failure }: { section: string; label: string; table: AdminTable | null; q?: string | undefined; status?: string | undefined; page?: number; pageSize?: number; serverSearch?: boolean; failure?: AdminReadFailure }) {
  const prefs = useDisplayPrefs()
  const router = useRouter()
  const statusColumn = table ? statusColumnOf(table) : null
  const truncated = Boolean(table && table.total > table.rows.length)
  const serverSide = truncated || serverSearch || Boolean(q) || Boolean(status)
  const pager = React.useMemo(() => (table ? adminPager({ section, q, status, page, pageSize, total: table.total, shown: table.rows.length }) : null), [table, section, q, status, page, pageSize])
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  React.useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )
  const state = React.useMemo<AsyncState<ReturnType<typeof toTableData>>>(() => {
    if (failure) return errorState(failure, () => router.refresh())
    if (!table || table.rows.length === 0) return { status: "empty" }
    return { status: "ready", data: toTableData(table) }
  }, [table, failure, router])
  const onQueryChange = React.useCallback(
    (query: TableQuery) => {
      if (!serverSide) return
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        const search = query.search.trim()
        const picked = (statusColumn ? query.filters[statusColumn] : "") ?? ""
        // 검색·상태가 지금 주소와 같으면 표 안 조작(정렬·10줄 쪽 이동)이다 — 주소를 건드리지 않는다(서버 쪽 번호를 지키려고)
        if (search === (q ?? "") && picked === (status ?? "")) return
        router.replace(adminListHref({ section, q: search || undefined, status: picked || undefined }), { scroll: false })
      }, 400)
    },
    [serverSide, statusColumn, section, q, status, router],
  )
  const initialQuery = React.useMemo<Partial<TableQuery>>(() => ({ search: q ?? "", filters: statusColumn && status ? { [statusColumn]: status } : {} }), [q, status, statusColumn])
  const lead = pager && pager.from > 0 ? fillText(listRange, { from: pager.from, to: pager.to, total: pager.total }) : listLead
  return (
    <>
      <DataTableAdminList id={`${section}-list`} copy={{ ...listCopy, title: label, lead }} state={state} initialQuery={initialQuery} onQueryChange={onQueryChange} serverSearch={serverSearch} {...prefs} />
      {pager ? <ServerPager pager={pager} /> : null}
    </>
  )
}

/**
 * 기록 하나. 편집 폼은 기록이 편집 칸과 저장 행동(save)을 둘 다 가질 때만 보이고, 위험 행동(danger)은 있을 때만 보인다(블록은 늘 두 영역을 그리므로 없는 영역은 가린다).
 * 위험 행동은 블록의 확인 단계 뒤에 `confirmed: true` 로 간다. 한 번에 누르는 행동(actions)은 확인 단계가 없다 — 확인이 필요한 행동은 기록의 danger 로 둔다.
 */
export function AdminRecordPanel({ section, label, record, failure }: { section: string; label: string; record: AdminRecord | null; failure?: AdminReadFailure }) {
  const prefs = useDisplayPrefs()
  const router = useRouter()
  const editable = Boolean(record && record.fields.length > 0 && record.save)
  const state = React.useMemo<AsyncState<ReturnType<typeof toRecordData>>>(() => {
    if (failure) return errorState(failure, () => router.refresh())
    if (!record) return { status: "empty" }
    const data = toRecordData(record)
    return { status: "ready", data: editable ? data : { ...data, fields: [] } }
  }, [record, failure, editable, router])
  const copy = React.useMemo(
    () => recordCopy({ title: record?.title ?? label, ...(record?.danger ? { danger: { label: record.danger.label } } : {}), editable, back: { label: fillText(recordBackLabel, { section: label }), href: `/admin/${section}` } }),
    [record, label, section, editable],
  )
  const id = record?.id ?? ""
  // 폼 저장의 중복 전송 방지 키: 성공할 때까지 같은 키로 다시 보내고(응답이 늦어 또 눌러도 서버가 한 번만 처리한다), 성공하면 비워 다음 저장은 새 키를 쓴다. 기록이 바뀌면 키도 버린다
  const saveKey = React.useRef<{ id: string; key: string } | null>(null)
  const submit = React.useCallback(
    async (fields: Record<string, string>): Promise<ActionResult<ContactReceipt>> => {
      if (!record?.save) return { ok: false, formError: "This record can't be edited.", retryable: false }
      const key = saveKey.current?.id === id ? saveKey.current.key : newIdempotencyKey()
      saveKey.current = { id, key }
      const r = await admin.adminAct({ section, id, action: record.save, fields, idempotencyKey: key })
      if (r.ok) {
        saveKey.current = null
        router.refresh()
      }
      return toActionResult(r, (d): ContactReceipt => (d.message ? { message: d.message } : {}))
    },
    [record, section, id, router],
  )
  const act = React.useCallback(
    async ({ action }: { action: string }) => {
      const r = await admin.adminAct({ section, id, action })
      if (r.ok) router.refresh()
      return toActionResult(r, (d): { message?: string } => (d.message ? { message: d.message } : {}))
    },
    [section, id, router],
  )
  const remove = React.useCallback(async (): Promise<ActionResult<{ message?: string }>> => {
    if (!record?.danger) return { ok: false, formError: "That action isn't available.", retryable: false }
    return toActionResult(await admin.adminAct({ section, id, action: record.danger.id, confirmed: true }), (d): { message?: string } => (d.message ? { message: d.message } : {}))
  }, [record, section, id])
  // 위험 행동이 없는 기록은 remove 를 안 준다 — 블록이 「위험한 작업」 구역을 그리지 않는다(편집 칸도 없으면 그 열 자체가 없다)
  return <DataTableRecordPanel id={`${section}-record`} copy={copy} state={state} submit={submit} actions={record ? toRecordActions(record) : []} act={act} remove={record?.danger ? remove : undefined} {...prefs} />
}
