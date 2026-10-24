// launch-factory: 관리 포트(AdminPort)의 데이터를 web-factory 블록이 받는 모양으로 바꾸는 한 곳(계획 3d).
// 블록은 포트를 모르고 포트는 블록을 모른다 — 두 모양은 거의 같지만 같은 타입이 아니라서, 어긋나는 곳(레코드 칸 종류·개요의 숫자)을 여기서만 맞춘다.
// 순수 함수라 서버 쪽(페이지)에서도 클라이언트 잎에서도 부를 수 있다. 형식 import 만 쓴다(블록은 클라이언트 모듈이고, 형식은 지워진다).
import type { AdminOverview, AdminRecord, AdminSectionInfo, AdminTable } from "@launch-factory/admin-console"
import type { ActionItem, DashboardData, Kpi } from "@/components/blocks/_shared/dashboard-kit"
import type { TableData } from "@/components/blocks/_shared/data-table-kit"
import type { RecordAction, RecordData, RecordField } from "@/components/blocks/data-table/record-panel"
import type { NavAppSidebarItem } from "@/components/blocks/nav/app-sidebar"

/** 표: 열·행을 그대로 옮긴다. 블록 열 종류는 text·numeric·date·status 라 포트의 열 종류와 같다. 열 종류 contact 는 표시용으로 text 로 읽는다(가리는 일은 콘솔이 이미 했다) */
export function toTableData(table: AdminTable): TableData {
  return {
    columns: table.columns.map((c) => ({
      id: c.id,
      label: c.label,
      kind: c.kind === "contact" ? "text" : c.kind,
      ...(c.sortable !== undefined ? { sortable: c.sortable } : {}),
      ...(c.filter !== undefined ? { filter: c.filter } : {}),
      ...(c.primary !== undefined ? { primary: c.primary } : {}),
      ...(c.secondary !== undefined ? { secondary: c.secondary } : {}),
    })),
    rows: table.rows.map((r) => ({ id: r.id, cells: r.cells, ...(r.href ? { href: r.href } : {}) })),
  }
}

/** 상태 거르기에 쓰는 열(표의 status 종류이고 거르기를 켠 첫 열) */
export function statusColumnOf(table: AdminTable): string | null {
  return table.columns.find((c) => c.kind === "status" && c.filter)?.id ?? null
}

const FIELD_TYPE: Readonly<Record<string, RecordField["type"]>> = { text: "text", email: "email", tel: "tel", textarea: "textarea", number: "text" }

/** 기록: 칸 종류 number 는 블록에 없어 text 로 읽는다(값이 글자라 입력 모양만 다르다) */
export function toRecordData(record: AdminRecord): RecordData {
  return {
    title: record.title,
    summary: record.summary.map((s) => ({ label: s.label, value: s.value, ...(s.kind ? { kind: s.kind === "contact" ? ("text" as const) : s.kind } : {}) })),
    fields: record.fields.map((f) => ({ name: f.name, label: f.label, type: FIELD_TYPE[f.type ?? "text"] ?? "text", value: f.value, ...(f.required ? { required: true } : {}) })),
  }
}

/** 한 번에 누르는 행동 단추들(위험 행동은 따로 — 블록의 확인 단계를 지난다) */
export const toRecordActions = (record: AdminRecord): RecordAction[] => record.actions.map((a) => ({ id: a.id, label: a.label }))

/** 개요의 시각 글자: 「Oct 22, 2026, 3:00 PM UTC」 */
function asOfText(iso: string, locale: string, timeZone: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone, timeZoneName: "short" }).format(d)
}

/**
 * 개요: 할 일 → 행동 목록(건수는 제목 끝에), 가장 급한 할 일 → 1순위 결정, 최근 변화 → KPI(비교 기간이 판단 기준, 변화 = 값 − 이전 값).
 * 할 일도 변화도 없으면 null — 화면이 「지금 필요한 일이 없어요」 빈 상태를 그린다.
 */
export function toDashboardData(overview: AdminOverview, options: { openLabel: string; locale?: string; timeZone?: string }): DashboardData | null {
  const { openLabel, locale = "en", timeZone = "UTC" } = options
  if (overview.todo.length === 0 && overview.metrics.length === 0) return null
  const kpis: Kpi[] = overview.metrics.map((m, i) => ({
    id: m.id,
    label: m.label,
    value: m.value,
    unit: m.unit,
    baseline: { comparePeriod: m.comparePeriod },
    delta: Math.round((m.value - m.previous) * 100) / 100,
    rank: i + 1,
  }))
  const actions: ActionItem[] = overview.todo.map((t) => ({
    id: t.id,
    severity: t.severity,
    title: `${t.title} (${t.count})`,
    ...(t.detail ? { detail: t.detail } : {}),
    recordUrl: t.href,
    actions: [{ label: openLabel, href: t.href }],
  }))
  const first = overview.todo[0]
  return {
    asOf: asOfText(overview.asOf, locale, timeZone),
    kpis,
    ...(first ? { focus: { title: `${first.title} (${first.count})`, ...(first.detail ? { detail: first.detail } : {}), action: { label: openLabel, href: first.href } } } : {}),
    ...(actions.length ? { actions } : {}),
  }
}

type SidebarIcon = NavAppSidebarItem["icon"]
const SECTION_ICONS: Readonly<Record<string, SidebarIcon>> = { orders: "orders", bookings: "calendar", inquiries: "mail", reviews: "star", newsletter: "mail", users: "user" }

/** 사이드바 항목: 개요 + 볼 수 있는 구획들(아이콘은 구획 id 로 고르고 모르면 문서 아이콘) */
export function toSidebarItems(sections: readonly AdminSectionInfo[], overviewLabel: string): NavAppSidebarItem[] {
  return [{ label: overviewLabel, href: "/admin", icon: "home" }, ...sections.map((s) => ({ label: s.label, href: s.href, icon: SECTION_ICONS[s.id] ?? ("file" as const) }))]
}
