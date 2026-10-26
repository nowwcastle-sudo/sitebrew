// 관리 콘솔(합성) — 구획 선언 목록으로 AdminPort 를 만든다. 벽은 구획이 아니라 여기 한 곳에 있다.
// 모든 입구가 같은 순서를 지난다:
//   구획 찾기(꺼진 부품·모르는 id 는 not_found) → 신원 읽기(호출당 한 번) → 입장(admit) → available() → 입력 검사(상태값·행동·칸 이름)
//   → 기록 읽기 + when(invalid_state) → 위험 행동은 confirmed === true → 요청 제한 → 실행 → 가리기 → 기록(audit).
// 구획이 던진 오류는 이름 없는 action_failed 로 바꿔 돌려준다(DB 메시지·개인정보가 화면에 나가지 않게) — onError 로 서버 로그에만 남긴다.
import { admit, DEFAULT_ADMIN_ROLES, type Admission } from "./admit.ts"
import { DEFAULT_ROWS, MAX_ROWS, parseActInput, parseTableQuery, recordIdOf, sectionIdOf } from "./input.ts"
import type { AdminConsoleOptions } from "./options.ts"
import type { AdminActOutcome, AdminFailureCode, AdminOverview, AdminPort, AdminResult, AdminSectionInfo, AdminTodo, AdminMetric, AdminTable, AdminRecord } from "./port.ts"
import { IDENTITY_MASK, recordOf, sectionHref, tableOf, todoOf } from "./render.ts"
import { definitionOf, isRefusal, SAVE_ACTION, type ActContext, type AdminActor, type AdminIdentity, type AnySectionDef, type ListQuery, type Refusal } from "./section.ts"

/** 로그인 안내가 필요한 거부 — 볼 수 있는 구획이 없을 때 빈 목록 대신 알려 주는 이유 */
const LEAD_DENIALS: readonly AdminFailureCode[] = ["sign_in_required", "two_factor_required", "impersonation_blocked"]

type Gate = { ok: true; def: AnySectionDef; actor: AdminActor } | { ok: false; result: AdminResult<never> }

export function createAdminConsole(options: AdminConsoleOptions): AdminPort {
  const base = options.basePath ?? "/admin"
  const now = options.now ?? (() => new Date())
  const roles = options.adminRoles ?? DEFAULT_ADMIN_ROLES
  const mask = options.mask ?? IDENTITY_MASK
  const messages = options.messages as Record<string, string | undefined>
  const all = options.sections.map(definitionOf)
  const dup = all.find((d, i) => all.findIndex((o) => o.id === d.id) !== i)
  if (dup) throw new Error(`admin-console: 구획 id '${dup.id}' 가 두 번 등록됐다`)
  const live = all.filter((d) => !options.enabledParts || options.enabledParts.includes(d.part))
  const onError = (error: unknown, where: string) => options.onError?.(error, where)

  const fail = (code: AdminFailureCode | (string & {}), extra: { fieldErrors?: Refusal["fieldErrors"]; formError?: string } = {}): AdminResult<never> => ({
    ok: false,
    code,
    formError: extra.formError !== undefined ? mask.text(extra.formError) : (messages[code] ?? messages.action_failed ?? ""),
    ...(extra.fieldErrors ? { fieldErrors: Object.fromEntries(Object.entries(extra.fieldErrors).map(([k, v]) => [k, v?.map(mask.text)])) } : {}),
    retryable: false,
  })
  const refusal = (r: Refusal): AdminResult<never> => fail(r.code, { formError: r.formError ?? messages[r.code] ?? messages.action_failed ?? "", ...(r.fieldErrors ? { fieldErrors: r.fieldErrors } : {}) })

  /** 포트 호출 하나의 신원 — 처음 필요할 때 한 번만 읽는다. 읽다 던지면 null(= forbidden) */
  function session(): () => Promise<AdminIdentity | null> {
    let memo: Promise<AdminIdentity | null> | undefined
    return () => (memo ??= Promise.resolve().then(options.identify).catch((error: unknown) => (onError(error, "identify"), null)))
  }
  async function admission(def: AnySectionDef, who: () => Promise<AdminIdentity | null>): Promise<Admission> {
    const identity = await who()
    if (!identity) return { ok: false, code: "forbidden" }
    try {
      return admit(identity, def.audience, roles)
    } catch (error) {
      onError(error, `${def.id}.admit`) // audience.owner() 가 던졌다 — 닫는다
      return { ok: false, code: "forbidden" }
    }
  }
  function unavailable(def: AnySectionDef): boolean {
    try {
      return def.available?.() === false
    } catch (error) {
      onError(error, `${def.id}.available`)
      return true
    }
  }
  /** 구획 찾기 → 입장 → available. 통과하면 구획과 행위자 */
  async function gate(sectionId: unknown, who: () => Promise<AdminIdentity | null>): Promise<Gate> {
    const key = sectionIdOf(sectionId)
    const def = key ? live.find((d) => d.id === key) : undefined
    if (!def) return { ok: false, result: fail("not_found") }
    const adm = await admission(def, who)
    if (!adm.ok) return { ok: false, result: fail(adm.code) }
    if (unavailable(def)) return { ok: false, result: fail("provider_unavailable") }
    return { ok: true, def, actor: adm.actor }
  }
  /** 구획 호출을 감싼다: 던지면 action_failed */
  async function guarded<T>(where: string, run: () => Promise<AdminResult<T>>): Promise<AdminResult<T>> {
    try {
      return await run()
    } catch (error) {
      onError(error, where)
      return fail("action_failed")
    }
  }
  async function overLimit(kind: "read" | "write", actor: AdminActor): Promise<AdminResult<never> | null> {
    return (await options.limit?.(kind, actor)) ?? null
  }
  /** 읽기 접속 기록. false 면 기록하지 못한 것 — 데이터를 내보내지 않는다 */
  async function logAccess(def: AnySectionDef, actor: AdminActor, kind: "table" | "record", ids: string[]): Promise<boolean> {
    if (!options.audit) return true
    try {
      await options.audit.access({ actorId: actor.userId, via: actor.via, section: def.id, kind, ids, at: now() })
      return true
    } catch (error) {
      onError(error, `${def.id}.audit.access`)
      return false
    }
  }
  async function logAction(def: AnySectionDef, actor: AdminActor, id: string, action: string, result: AdminResult<unknown>): Promise<void> {
    if (!options.audit) return
    try {
      await options.audit.action({ actorId: actor.userId, via: actor.via, section: def.id, id, action, ok: result.ok, ...(result.ok ? {} : { code: result.code ?? "action_failed" }), at: now() })
    } catch (error) {
      onError(error, `${def.id}.audit.action`) // 이미 실행됐다 — 결과를 잃는 쪽이 더 나쁘다
    }
  }

  return {
    async sections() {
      const who = session()
      const out: AdminSectionInfo[] = []
      let lead: AdminFailureCode | null = null
      for (const def of live) {
        const adm = await admission(def, who)
        if (!adm.ok) {
          if (LEAD_DENIALS.includes(adm.code)) lead ??= adm.code
          continue
        }
        if (!unavailable(def)) out.push({ id: def.id, label: def.label, href: sectionHref(base, def.id) })
      }
      // 볼 수 있는 구획이 하나도 없으면 가장 앞선 이유(로그인·2단계 인증·대리 세션)를 알려 준다 — 그냥 빈 목록이 아니다
      if (out.length === 0 && lead) return fail(lead)
      return { ok: true, data: out }
    },

    async overview() {
      const who = session()
      const todo: AdminTodo[] = []
      const metrics: AdminMetric[] = []
      const failed: string[] = []
      const denials: AdminFailureCode[] = []
      let admitted = 0
      for (const def of live) {
        const adm = await admission(def, who)
        if (!adm.ok) {
          denials.push(adm.code)
          continue
        }
        admitted += 1
        if (!def.overview || unavailable(def)) continue
        try {
          const part = await def.overview(adm.actor)
          todo.push(...(part.todo ?? []).map((t) => todoOf(def, t, base)))
          metrics.push(...(part.metrics ?? []))
        } catch (error) {
          onError(error, `${def.id}.overview`)
          failed.push(def.id) // 조용히 사라져 「할 일 없음」으로 보이지 않게
        }
      }
      // 입장할 수 있는 구획이 하나도 없으면 빈 개요가 아니라 그 이유
      if (admitted === 0 && denials.length > 0) return fail(denials.find((c) => LEAD_DENIALS.includes(c)) ?? denials[0]!)
      todo.sort((a, b) => (a.severity === b.severity ? b.count - a.count : a.severity === "critical" ? -1 : 1))
      const overview: AdminOverview = { asOf: now().toISOString(), todo, metrics, ...(failed.length ? { failed } : {}) }
      return { ok: true, data: overview }
    },

    async table(input) {
      const g = await gate((input as { section?: unknown } | null)?.section, session())
      if (!g.ok) return g.result
      const { def, actor } = g
      const parsed = parseTableQuery(input)
      if (!parsed) return fail("invalid_input")
      if (parsed.status !== undefined && !def.statuses?.includes(parsed.status)) return fail("invalid_input")
      // 한 쪽 줄 수는 구획이 선언한 pageSize 를 넘지 않는다. 읽기 시작 줄 = (쪽 - 1) × 줄 수
      const limit = Math.min(parsed.limit ?? def.pageSize ?? DEFAULT_ROWS, def.pageSize ?? MAX_ROWS)
      const { page: pageNo, ...rest } = parsed
      const query: ListQuery = { ...rest, limit, offset: ((pageNo ?? 1) - 1) * limit }
      return guarded<AdminTable>(`${def.id}.table`, async () => {
        const blocked = await overLimit("read", actor)
        if (blocked) return blocked
        const r = await def.list(actor, query)
        if (isRefusal(r)) return refusal(r)
        const table = tableOf(def, r.items, r.total, query.limit, base, mask)
        if (!(await logAccess(def, actor, "table", table.rows.map((row) => row.id)))) return fail("action_failed")
        return { ok: true, data: table }
      })
    },

    async record(input) {
      const g = await gate((input as { section?: unknown } | null)?.section, session())
      if (!g.ok) return g.result
      const { def, actor } = g
      const id = recordIdOf((input as { id?: unknown }).id)
      if (!id) return fail("invalid_input")
      return guarded<AdminRecord>(`${def.id}.record`, async () => {
        const blocked = await overLimit("read", actor)
        if (blocked) return blocked
        const rec = await def.load(actor, id)
        if (isRefusal(rec)) return refusal(rec)
        if (rec === null) return fail("not_found")
        const record = recordOf(def, rec, id, actor, mask)
        if (!(await logAccess(def, actor, "record", [id]))) return fail("action_failed")
        return { ok: true, data: record }
      })
    },

    async act(input) {
      const parsed = parseActInput(input)
      if (!parsed) return fail("invalid_input")
      const g = await gate(parsed.section, session())
      if (!g.ok) return g.result
      const { def, actor } = g
      const isSave = parsed.action === SAVE_ACTION
      const action = isSave || !Object.hasOwn(def.actions ?? {}, parsed.action) ? undefined : def.actions![parsed.action]
      if (isSave ? !def.form : !action) return fail("invalid_input") // 모르는 행동은 구획에 닿지 않는다
      if (action?.adminOnly && actor.via !== "admin") return fail("forbidden")
      return guarded<AdminActOutcome>(`${def.id}.act`, async () => {
        const rec = await def.load(actor, parsed.id)
        if (isRefusal(rec)) return refusal(rec)
        if (rec === null) return fail("not_found")
        if (action?.when && !action.when(rec)) return fail("invalid_state")
        // 확인 입력 벽: 위험 행동은 사람이 확인 단계를 거쳤다는 입력이 정확히 true 가 아니면 실행하지 않는다
        if (action?.danger && parsed.confirmed !== true) return fail("confirmation_required")
        // 칸 이름은 선언한 칸만, 저장이면 필수 칸은 비어 있지 않아야 한다
        const declared = def.form?.fields(rec) ?? []
        const names = new Set(declared.map((f) => f.name))
        if (parsed.fields && Object.keys(parsed.fields).some((k) => !names.has(k))) return fail("invalid_input")
        if (isSave) {
          const missing = declared.filter((f) => f.required && (parsed.fields?.[f.name] ?? "").trim() === "")
          if (missing.length > 0) return fail("invalid_input", { fieldErrors: Object.fromEntries(missing.map((f) => [f.name, [messages.invalid_input ?? ""]])) })
        }
        const blocked = await overLimit("write", actor)
        if (blocked) return blocked
        let result: AdminResult<AdminActOutcome>
        try {
          const ctx: ActContext = parsed.idempotencyKey ? { idempotencyKey: parsed.idempotencyKey } : {}
          const outcome = isSave ? await def.form!.save(actor, rec, parsed.fields ?? {}, ctx) : await action!.run(actor, rec, parsed.fields, ctx)
          if (isRefusal(outcome)) result = refusal(outcome)
          else result = { ok: true, data: typeof outcome?.message === "string" ? { message: mask.text(outcome.message) } : {} }
        } catch (error) {
          onError(error, `${def.id}.act`)
          result = fail("action_failed")
        }
        await logAction(def, actor, parsed.id, parsed.action, result)
        return result
      })
    },
  }
}
