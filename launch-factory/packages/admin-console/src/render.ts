// 구획 선언 → 와이어 모양(순수, 내부). 주소·단추·가리기를 콘솔이 한 곳에서 만든다.
import type { AdminCell, AdminRecord, AdminRecordAction, AdminTable, AdminTodo } from "./port.ts"
import type { AdminMasker } from "./options.ts"
import { SAVE_ACTION, type AdminActor, type AnySectionDef, type TodoDef } from "./section.ts"

export const IDENTITY_MASK: AdminMasker = { contact: (v) => v, text: (v) => v }

/** 구획 주소 / 기록 주소 */
export const sectionHref = (base: string, sectionId: string): string => `${base}/${sectionId}`
export const rowHref = (base: string, sectionId: string, key: string): string => `${sectionHref(base, sectionId)}/${encodeURIComponent(key)}`

/** 표: 선언한 열만 내보내고(cells 가 더 돌려줘도 버린다), contact 열은 가린다 */
export function tableOf(def: AnySectionDef, items: readonly unknown[], total: number, limit: number, base: string, mask: AdminMasker): AdminTable {
  const rows = items.slice(0, limit).map((item) => {
    const raw = def.cells(item) as Record<string, AdminCell | undefined>
    const cells: Record<string, AdminCell> = {}
    for (const col of def.columns) {
      const v = raw[col.id] ?? null
      cells[col.id] = col.kind === "contact" && v !== null && v !== "" ? mask.contact(String(v)) : v
    }
    const id = def.key(item)
    return { id, cells, href: rowHref(base, def.id, id) }
  })
  return { columns: def.columns.map((c) => ({ ...c })), rows, total }
}

/** 상세: 가능한 일반 행동·위험 행동 하나·저장 단추를 선언에서 만든다. 소유자에게 adminOnly 단추는 안 보인다 */
export function recordOf(def: AnySectionDef, rec: unknown, id: string, actor: AdminActor, mask: AdminMasker): AdminRecord {
  const view = def.view(rec)
  const actions: AdminRecordAction[] = []
  let danger: AdminRecordAction | undefined
  for (const [aid, a] of Object.entries(def.actions ?? {})) {
    if (a.adminOnly && actor.via !== "admin") continue
    if (a.when && !a.when(rec)) continue
    if (a.danger) danger = { id: aid, label: a.label }
    else actions.push({ id: aid, label: a.label })
  }
  const fields = def.form?.fields(rec) ?? []
  return {
    id,
    title: view.title,
    summary: view.summary.map((s) => (s.kind === "contact" ? { ...s, value: mask.contact(s.value) } : s)),
    fields,
    ...(def.form ? { save: SAVE_ACTION } : {}),
    actions,
    ...(danger ? { danger } : {}),
  }
}

/** 개요의 할 일: 처리하러 가는 주소를 콘솔이 만든다(상태가 있으면 그 상태로 거른 표) */
export const todoOf = (def: AnySectionDef, t: TodoDef, base: string): AdminTodo => ({
  id: t.id,
  severity: t.severity,
  title: t.title,
  ...(t.detail !== undefined ? { detail: t.detail } : {}),
  href: sectionHref(base, def.id) + (t.status ? `?status=${encodeURIComponent(t.status)}` : ""),
  count: t.count,
})
