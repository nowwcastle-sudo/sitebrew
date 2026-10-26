// 관리 포트 적합성 묶음(항목 contract-conformance — 계획 3d, J3). adapter-mock-admin 의 ?admin= 장면이 곧 시나리오 표다.
// 실제 어댑터(launch-factory packages/admin-console 의 createAdminConsole + 구획 모듈)는 make(setup) 이 그 장면의 새 포트(그 사람으로 로그인한 세션)를 돌려주게 해 같은 검사를 통과한다.
// 검사는 모양·접근 벽·확인 입력 벽·상태 전이만 본다 — 구획 이름·열·행 값·메시지 글은 가게마다 다르다. 구획은 sections() 가 알려 주는 것을 읽는다(이름을 박지 않는다).
// 쓰기 검사는 상태를 바꾸므로 검사마다 make 를 새로 부른다. 확인 입력 벽은 선택이 아니다 — 관리 화면은 되돌리기 어려운 행동을 늘 사람 확인 뒤에만 실행한다(options.requireConfirmation 과 무관).
import type { AdminActInput, AdminFailureCode, AdminPort, AdminRecord, AdminSectionInfo, AdminTable } from "@/registry/factory/contract/admin"
import type { ActionResult } from "@/registry/factory/contract/block-contract"
import { type ConformanceOptions, type ConformanceResult, confirmationProblem, deepEqual, runCheck, show } from "./conformance-core"

/** make 에 넘기는 준비 — 보는 사람. admin: 관리자 · 나머지는 관리자가 아니라 막히는 장면(목: ?admin=) */
export interface AdminSetup {
  scene: "admin" | "signed-out" | "forbidden" | "two-factor-required" | "impersonation"
}
export type MakeAdmin = (setup: AdminSetup) => AdminPort | Promise<AdminPort>

/** 관리자가 아닌 장면과 막히는 이유(AdminFailureCode). adapter-mock-admin 의 MOCK_ADMIN_DENIALS 와 같은 표 */
export const ADMIN_DENIED_SCENES = {
  "signed-out": "sign_in_required",
  forbidden: "forbidden",
  "two-factor-required": "two_factor_required",
  impersonation: "impersonation_blocked",
} as const satisfies Record<Exclude<AdminSetup["scene"], "admin">, AdminFailureCode>

const ADMIN: AdminSetup = { scene: "admin" }
const NO_SUCH_SECTION = "conf-no-such-section"
const NO_SUCH_RECORD = "conf-no-such-record"
const NO_SUCH_ACTION = "conf-no-such-action"
const SECTION_ID = /^[a-z][a-z0-9-]{0,31}$/
const COLUMN_KINDS = ["text", "numeric", "date", "status", "contact"]
const SUMMARY_KINDS = ["text", "numeric", "status", "contact"]
const FIELD_TYPES = ["text", "email", "tel", "textarea", "number"]

const isDate = (v: unknown) => typeof v === "string" && !Number.isNaN(Date.parse(v))
const isPath = (v: unknown) => typeof v === "string" && v.startsWith("/")
const dup = (ids: readonly string[]) => ids.find((id, i) => ids.indexOf(id) !== i)

function data<T>(r: ActionResult<T>, what: string): T {
  if (!r.ok) throw new Error(`${what} 실패: ${show(r)}`)
  return r.data
}
const failed = (r: ActionResult<unknown>, code: string): string | null => (r.ok ? `성공해 버렸어요(실패 code ${code} 여야 해요)` : r.code === code ? null : `code ${show(r.code)} — "${code}" 여야 해요: ${show(r)}`)

const sectionsOf = async (port: AdminPort) => data(await port.sections(), "sections()")
const tableOf = async (port: AdminPort, section: string) => data(await port.table({ section }), `table(${section})`)
const recordOf = async (port: AdminPort, section: string, id: string) => data(await port.record({ section, id }), `record(${section}, ${id})`)

/** 구획마다 표의 첫 줄 열기까지 한 번에 — 기록이 하나도 없는 구획은 rows 가 빈 채로 돌려준다 */
async function walk(port: AdminPort): Promise<{ section: AdminSectionInfo; table: AdminTable }[]> {
  const out: { section: AdminSectionInfo; table: AdminTable }[] = []
  for (const section of await sectionsOf(port)) out.push({ section, table: await tableOf(port, section.id) })
  return out
}

function tableProblem(t: AdminTable, at: string): string | null {
  if (!t.columns.length) return `${at} 열이 없어요`
  const colIds = t.columns.map((c) => c.id)
  const d = dup(colIds)
  if (d) return `${at} 열 id 가 겹쳐요: ${d}`
  for (const c of t.columns) {
    if (!c.id || !c.label) return `${at} 열에 id·label 이 없어요: ${show(c)}`
    if (c.kind !== undefined && !COLUMN_KINDS.includes(c.kind)) return `${at} 열 ${c.id} kind ${show(c.kind)} — ${COLUMN_KINDS.join("|")} 여야 해요`
  }
  const primaries = t.columns.filter((c) => c.primary)
  if (primaries.length !== 1) return `${at} primary 열이 ${primaries.length}개예요 — 표마다 정확히 하나여야 해요`
  const rowDup = dup(t.rows.map((r) => r.id))
  if (rowDup) return `${at} 행 id 가 겹쳐요: ${rowDup}`
  for (const r of t.rows) {
    if (!r.id) return `${at} 행에 id 가 없어요`
    const stray = Object.keys(r.cells).filter((k) => !colIds.includes(k))
    if (stray.length) return `${at} 행 ${r.id} 에 열에 없는 칸이 있어요: ${stray.join(", ")}`
    const bad = Object.entries(r.cells).find(([, v]) => !(v === null || typeof v === "string" || typeof v === "number"))
    if (bad) return `${at} 행 ${r.id} 칸 ${bad[0]} 값은 글자·숫자·null 이어야 해요: ${show(bad[1])}`
    if (r.href !== undefined && !isPath(r.href)) return `${at} 행 ${r.id} href 는 / 로 시작하는 경로여야 해요: ${show(r.href)}`
  }
  if (!Number.isInteger(t.total) || t.total < t.rows.length) return `${at} total ${show(t.total)} — rows.length(${t.rows.length}) 이상의 정수여야 해요`
  return null
}

function recordProblem(r: AdminRecord, id: string, at: string): string | null {
  if (r.id !== id) return `${at} id ${show(r.id)} — 열어 본 기록 ${id} 여야 해요`
  if (!r.title) return `${at} title 이 없어요`
  for (const s of r.summary) {
    if (!s.label || typeof s.value !== "string") return `${at} 요약에 label·value(글자)가 없어요: ${show(s)}`
    if (s.kind !== undefined && !SUMMARY_KINDS.includes(s.kind)) return `${at} 요약 kind ${show(s.kind)} — ${SUMMARY_KINDS.join("|")} 여야 해요`
  }
  const names = r.fields.map((f) => f.name)
  const nameDup = dup(names)
  if (nameDup) return `${at} 편집 칸 name 이 겹쳐요: ${nameDup}`
  for (const f of r.fields) {
    if (!f.name || !f.label || typeof f.value !== "string") return `${at} 편집 칸에 name·label·value(글자)가 없어요: ${show(f)}`
    if (f.type !== undefined && !FIELD_TYPES.includes(f.type)) return `${at} 편집 칸 ${f.name} type ${show(f.type)} — ${FIELD_TYPES.join("|")} 여야 해요`
  }
  if (r.fields.length && !r.save) return `${at} 편집 칸이 있는데 save(저장 행동 id)가 없어요`
  const actionIds = r.actions.map((a) => a.id)
  const actionDup = dup(actionIds)
  if (actionDup) return `${at} 행동 id 가 겹쳐요: ${actionDup}`
  if (r.actions.some((a) => !a.id || !a.label)) return `${at} 행동에 id·label 이 없어요`
  if (r.danger) {
    if (!r.danger.id || !r.danger.label) return `${at} danger 에 id·label 이 없어요`
    if (actionIds.includes(r.danger.id)) return `${at} danger(${r.danger.id}) 가 일반 행동에도 있어요 — 확인 단계를 건너뛰는 길이 생겨요`
    if (r.danger.id === r.save) return `${at} danger 가 저장 행동과 같아요`
  }
  return null
}

const withExtras = <T extends object>(input: T): T => ({ ...input, role: "admin", userId: "conf-other-user" }) // 서버는 입력의 role·userId 를 읽지 않는다 — 있어도 접근이 열리면 안 된다

/**
 * 관리 포트 적합성. make 는 보는 사람(관리자·로그아웃·권한 없음·2단계 꺼짐·대리 세션)마다 새 포트를 돌려준다
 * (목: `({ scene }) => mockAdmin("?admin=" + scene)`). 구획 이름·행 값은 가게마다 다르므로 sections() 와 표에서 읽는다.
 */
export async function adminConformance(make: MakeAdmin, options: ConformanceOptions = {}): Promise<ConformanceResult[]> {
  const out: ConformanceResult[] = []
  const check = async (id: string, body: () => Promise<string | null>) => out.push(await runCheck(id, body, options))
  /** 기록이 있는 구획·행 중 조건에 맞는 첫 것 (구획, 행 id, 열어 본 기록) */
  const find = async (port: AdminPort, pick: (r: AdminRecord) => boolean) => {
    for (const { section, table } of await walk(port)) {
      for (const row of table.rows) {
        const record = await recordOf(port, section.id, row.id)
        if (pick(record)) return { section, rowId: row.id, record }
      }
    }
    return null
  }

  // 구획 목록
  await check("admin.sections.shape", async () => {
    const list = await sectionsOf(await make(ADMIN))
    if (!list.length) return "관리자에게 보이는 구획이 하나도 없어요"
    if (dup(list.map((s) => s.id))) return `구획 id 가 겹쳐요: ${show(list.map((s) => s.id))}`
    for (const s of list) {
      if (!SECTION_ID.test(s.id)) return `구획 id ${show(s.id)} — 소문자로 시작하는 소문자·숫자·하이픈(32자 이하)이어야 해요`
      if (!s.label) return `구획 ${s.id} 에 label 이 없어요`
      if (!isPath(s.href) || !s.href.endsWith(`/${s.id}`)) return `구획 ${s.id} href ${show(s.href)} — /로 시작하고 /${s.id} 로 끝나야 해요`
    }
    return null
  })

  // 개요
  await check("admin.overview.shape", async () => {
    const o = data(await (await make(ADMIN)).overview(), "overview()")
    if (!isDate(o.asOf)) return `asOf 가 날짜가 아니에요: ${show(o.asOf)}`
    if (dup(o.todo.map((t) => t.id))) return "할 일 id 가 겹쳐요"
    if (dup(o.metrics.map((m) => m.id))) return "변화 id 가 겹쳐요"
    if (o.failed !== undefined && (!Array.isArray(o.failed) || o.failed.some((f) => typeof f !== "string" || !f))) return `failed 는 구획 id 글자의 목록이어야 해요: ${show(o.failed)}`
    for (const t of o.todo) {
      if (!t.id || !t.title) return `할 일에 id·title 이 없어요: ${show(t)}`
      if (t.severity !== "critical" && t.severity !== "warning") return `할 일 severity ${show(t.severity)} — critical|warning 여야 해요`
      if (!isPath(t.href)) return `할 일 ${t.id} href 는 / 로 시작하는 경로여야 해요: ${show(t.href)}`
      if (!Number.isInteger(t.count) || t.count < 1) return `할 일 ${t.id} count ${show(t.count)} — 1 이상의 정수여야 해요(처리할 것이 없으면 줄을 싣지 않는다)`
    }
    const firstWarning = o.todo.findIndex((t) => t.severity === "warning")
    if (firstWarning >= 0 && o.todo.slice(firstWarning).some((t) => t.severity === "critical")) return "긴급(critical)이 주의(warning)보다 먼저 와야 해요"
    for (const m of o.metrics) {
      if (!m.id || !m.label || !m.comparePeriod) return `변화에 id·label·comparePeriod 가 없어요: ${show(m)}`
      if (!Number.isFinite(m.value) || !Number.isFinite(m.previous)) return `변화 ${m.id} 의 value·previous 는 유한한 숫자여야 해요: ${show(m)}`
      if (typeof m.unit !== "string") return `변화 ${m.id} 의 unit 은 글자여야 해요`
    }
    return null
  })

  // 표
  await check("admin.table.shape", async () => {
    const rounds = await walk(await make(ADMIN))
    for (const { section, table } of rounds) {
      const bad = tableProblem(table, `표(${section.id})`)
      if (bad) return bad
    }
    return null
  })
  await check("admin.table.contact-masked", async () => {
    // kind "contact" 열의 값은 서버가 가려서 보낸다 — 가려지지 않은 전체 메일·전화가 화면으로 나가면 안 된다
    const RAW_EMAIL = /^[^@*•\s]+@[^*•\s]+\.[^*•\s]+$/
    for (const { section, table } of await walk(await make(ADMIN))) {
      for (const col of table.columns.filter((c) => c.kind === "contact")) {
        for (const row of table.rows) {
          const v = row.cells[col.id]
          if (typeof v !== "string") continue
          if (RAW_EMAIL.test(v) || v.replace(/\D/g, "").length >= 9 && !/[*•]/.test(v)) return `연락처 열 ${section.id}.${col.id} 의 ${row.id} 가 가려지지 않았어요: ${show(v)}`
        }
      }
    }
    return null
  })
  await check("admin.record.contact-masked", async () => {
    // 상세 요약의 kind "contact" 값도 표와 같이 가려서 보낸다
    const RAW_EMAIL = /^[^@*•\s]+@[^*•\s]+\.[^*•\s]+$/
    const port = await make(ADMIN)
    for (const { section, table } of await walk(port)) {
      for (const row of table.rows.slice(0, 3)) {
        const rec = data(await port.record({ section: section.id, id: row.id }), `record(${section.id}, ${row.id})`)
        for (const item of rec.summary.filter((i) => i.kind === "contact")) {
          if (RAW_EMAIL.test(item.value) || (item.value.replace(/\D/g, "").length >= 9 && !/[*•]/.test(item.value))) return `상세 연락처 ${section.id}/${row.id} 「${item.label}」 가 가려지지 않았어요: ${show(item.value)}`
        }
      }
    }
    return null
  })
  await check("admin.table.limit", async () => {
    const port = await make(ADMIN)
    for (const { section, table } of await walk(port)) {
      const one = data(await port.table({ section: section.id, limit: 1 }), `table(${section.id}, limit 1)`)
      if (one.rows.length > 1) return `limit 1 인데 줄이 ${one.rows.length}개예요(${section.id})`
      if (one.total !== table.total) return `limit 을 줬더니 total 이 ${table.total} → ${one.total} 로 달라졌어요(${section.id}) — total 은 잘리기 전 전체 수예요`
    }
    return null
  })
  await check("admin.table.search", async () => {
    const port = await make(ADMIN)
    let looked = 0
    for (const { section, table } of await walk(port)) {
      const none = data(await port.table({ section: section.id, search: "conf-no-match-zzz" }), `table(${section.id}, 없는 검색어)`)
      if (none.rows.length || none.total !== 0) return `없는 검색어인데 줄이 남았어요(${section.id}): rows ${none.rows.length}, total ${none.total}`
      const primary = table.columns.find((c) => c.primary)?.id
      const row = table.rows[0]
      const word = primary && row ? String(row.cells[primary] ?? "").trim() : ""
      if (!word) continue
      looked += 1
      const hit = data(await port.table({ section: section.id, search: word }), `table(${section.id}, ${word})`)
      if (!hit.rows.some((r) => r.id === row.id)) return `첫 줄의 식별자 「${word}」로 찾았는데 그 줄이 없어요(${section.id})`
    }
    return looked ? null : "식별자 글을 가진 줄이 있는 구획이 하나는 있어야 해요"
  })
  await check("admin.table.unknown-section", async () => {
    const port = await make(ADMIN)
    return failed(await port.table({ section: NO_SUCH_SECTION }), "not_found") ?? failed(await port.table({ section: "../etc" }), "not_found")
  })

  // 상세
  await check("admin.record.shape", async () => {
    const port = await make(ADMIN)
    let looked = 0
    for (const { section, table } of await walk(port)) {
      for (const row of table.rows) {
        looked += 1
        const bad = recordProblem(await recordOf(port, section.id, row.id), row.id, `상세(${section.id}/${row.id})`)
        if (bad) return bad
      }
    }
    return looked ? null : "기록이 하나도 없어서 상세를 못 봤어요 — 시나리오에 기록이 있어야 해요"
  })
  await check("admin.record.unknown", async () => {
    const port = await make(ADMIN)
    for (const s of await sectionsOf(port)) {
      const bad = failed(await port.record({ section: s.id, id: NO_SUCH_RECORD }), "not_found")
      if (bad) return `${s.id}: ${bad}`
    }
    return failed(await port.record({ section: NO_SUCH_SECTION, id: NO_SUCH_RECORD }), "not_found")
  })
  await check("admin.record.empty-id", async () => {
    const port = await make(ADMIN)
    const [s] = await sectionsOf(port)
    const r = await port.record({ section: s.id, id: "" })
    return r.ok ? `빈 id 로 상세가 읽혔어요: ${show(r.data)}` : null
  })

  // 접근 벽: 관리자가 아니면 어떤 메서드도 열리지 않는다(입력의 role·userId 를 믿지 않는다)
  for (const [scene, code] of Object.entries(ADMIN_DENIED_SCENES) as [keyof typeof ADMIN_DENIED_SCENES, string][]) {
    await check(`admin.access.${scene}`, async () => {
      const admin = await make(ADMIN)
      const target = await find(admin, (r) => Boolean(r.danger))
      if (!target) return "danger 가 있는 기록이 하나는 있어야 접근 벽을 시험할 수 있어요"
      const port = await make({ scene })
      const sid = target.section.id
      const listed = await port.sections()
      if (listed.ok && listed.data.length) return `${scene} 인데 구획이 보여요: ${show(listed.data)}`
      if (!listed.ok && listed.code !== code) return `sections() code ${show(listed.code)} — "${code}" 여야 해요`
      if (scene !== "forbidden" && listed.ok) return `${scene} 인데 sections() 가 실패하지 않았어요 — "${code}" 여야 해요(forbidden 뿐일 때만 빈 목록)`
      const problems = [
        failed(await port.overview(), code),
        failed(await port.table(withExtras({ section: sid })), code),
        failed(await port.record(withExtras({ section: sid, id: target.rowId })), code),
        failed(await port.act(withExtras({ section: sid, id: target.rowId, action: target.record.danger?.id ?? "x", confirmed: true as const })), code),
      ]
      const names = ["overview()", "table()", "record()", "act(확인 포함)"]
      const bad = problems.findIndex(Boolean)
      return bad >= 0 ? `${names[bad]}: ${problems[bad]}` : null
    })
  }

  // 행동: 모르는 기록·구획·행동
  await check("admin.act.unknown-target", async () => {
    const port = await make(ADMIN)
    const target = await find(port, (r) => Boolean(r.danger))
    if (!target) return "danger 가 있는 기록이 하나는 있어야 해요"
    const bad = failed(await port.act({ section: target.section.id, id: NO_SUCH_RECORD, action: target.record.danger?.id ?? "x", confirmed: true }), "not_found")
    if (bad) return `없는 기록: ${bad}`
    return failed(await port.act({ section: NO_SUCH_SECTION, id: NO_SUCH_RECORD, action: "x", confirmed: true }), "not_found") ?? null
  })
  await check("admin.act.unknown-action", async () => {
    const port = await make(ADMIN)
    const target = await find(port, () => true)
    if (!target) return "기록이 하나도 없어요"
    const before = target.record
    const r = await port.act({ section: target.section.id, id: target.rowId, action: NO_SUCH_ACTION, confirmed: true })
    if (r.ok) return `모르는 행동이 성공했어요: ${show(r.data)}`
    return deepEqual(before, await recordOf(port, target.section.id, target.rowId)) ? null : "거절했는데 기록이 바뀌었어요"
  })
  await check("admin.act.listed-action", async () => {
    const port = await make(ADMIN)
    const target = await find(port, (r) => r.actions.length > 0)
    if (!target) return "일반 행동(actions)이 있는 기록이 하나는 있어야 해요"
    const action = target.record.actions[0]
    // 일반 행동은 화면이 확인 단계 없이 바로 부른다 — 확인을 요구하거나(confirmation_required) 모르는 행동(invalid_input)이면 안 된다
    const r = await port.act({ section: target.section.id, id: target.rowId, action: action.id })
    if (r.ok) return null
    return r.code === "invalid_state" ? null : `목록에 있는 행동 ${action.id} 가 실패했어요(성공하거나 invalid_state 여야 해요): ${show(r)}`
  })
  await check("admin.act.save", async () => {
    const port = await make(ADMIN)
    const target = await find(port, (r) => r.fields.length > 0)
    if (!target) return "편집 칸이 있는 기록이 하나는 있어야 해요"
    const save = target.record.save as string
    const fields = Object.fromEntries(target.record.fields.map((f) => [f.name, f.value]))
    const r = await port.act({ section: target.section.id, id: target.rowId, action: save, fields })
    if (!r.ok) return `고치지 않고 저장했는데 거절됐어요: ${show(r)}`
    return deepEqual(target.record.fields, (await recordOf(port, target.section.id, target.rowId)).fields) ? null : "그대로 저장했는데 편집 칸 값이 바뀌었어요"
  })

  // 확인 입력 벽: danger 행동은 confirmed: true 없이는 상태를 건드리지 않는다
  await check("admin.confirm.wall", async () => {
    const port = await make(ADMIN)
    const target = await find(port, (r) => Boolean(r.danger))
    if (!target) return "danger 가 있는 기록이 하나는 있어야 해요"
    const base: AdminActInput = { section: target.section.id, id: target.rowId, action: target.record.danger?.id as string }
    const before = target.record
    // 확인이 없거나, true 가 아닌 값(글자 "true"·1·false)은 확인이 아니다
    for (const confirmed of [undefined, false, "true", 1]) {
      const r = await port.act(confirmed === undefined ? base : ({ ...base, confirmed } as unknown as AdminActInput))
      const problem = confirmationProblem(r)
      if (problem) return `confirmed ${show(confirmed)}: ${problem}`
      if (!deepEqual(before, await recordOf(port, target.section.id, target.rowId))) return `승인 대기인데 기록이 바뀌었어요(confirmed ${show(confirmed)})`
    }
    return null
  })
  await check("admin.confirm.confirmed", async () => {
    const port = await make(ADMIN)
    const target = await find(port, (r) => Boolean(r.danger))
    if (!target) return "danger 가 있는 기록이 하나는 있어야 해요"
    const r = await port.act({ section: target.section.id, id: target.rowId, action: target.record.danger?.id as string, confirmed: true })
    if (!r.ok) return `확인과 함께 부르면 성공해야 해요: ${show(r)}`
    const after = await port.record({ section: target.section.id, id: target.rowId })
    return after.ok && deepEqual(after.data, target.record) ? "확인과 함께 불렀는데 기록이 그대로예요" : null
  })
  await check("admin.confirm.again-invalid-state", async () => {
    const port = await make(ADMIN)
    const target = await find(port, (r) => Boolean(r.danger))
    if (!target) return "danger 가 있는 기록이 하나는 있어야 해요"
    const input: AdminActInput = { section: target.section.id, id: target.rowId, action: target.record.danger?.id as string, confirmed: true }
    data(await port.act(input), "act(1)")
    const again = await port.act(input)
    if (again.ok) return "이미 끝난 위험 행동을 또 불렀더니 성공했어요(이중 처리)"
    return again.code === "invalid_state" || again.code === "not_found" ? null : `두 번째 호출 code ${show(again.code)} — invalid_state 여야 해요(기록이 사라졌다면 not_found)`
  })
  return out
}
