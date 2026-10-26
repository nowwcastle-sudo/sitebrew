// 관리 콘솔 합성 — 순수 시험(DB·세션 없음). 구획은 defineSection 으로 선언하고 신원·기록·제한은 가짜로 꽂는다.
import { test } from "node:test"
import assert from "node:assert/strict"
import { createAdminConsole, defineSection, hasServerSearch, pageSizeOf, refuse } from "../src/index.ts"

const CODES = ["sign_in_required", "forbidden", "two_factor_required", "impersonation_blocked", "provider_unavailable", "not_found", "invalid_input", "confirmation_required", "invalid_state", "action_failed"]
const messages = Object.fromEntries(CODES.map((c) => [c, `msg:${c}`]))

const ADMIN = { kind: "user", userId: "u-admin", role: "admin", banned: false, twoFactor: true, verifiedEmail: "boss@example.com" }
const OWNER = { kind: "user", userId: "u-owner", role: null, banned: false, twoFactor: false, verifiedEmail: "  Owner@Shop.example.com " }
const OWNER_EMAIL = "owner@shop.example.com"

/** 구획 하나 + 호출 기록. over 로 선언의 칸을 덮는다 */
function make(id, over = {}) {
  const calls = []
  const data = new Map([["a", { id: "a", name: "A", status: "open", phone: "010-1234-5678", note: "" }]])
  const def = {
    id,
    part: id,
    label: id,
    audience: "admin",
    statuses: ["open", "done"],
    columns: [
      { id: "name", label: "Name", primary: true },
      { id: "status", label: "Status", kind: "status", filter: true },
      { id: "phone", label: "Phone", kind: "contact" },
    ],
    list: async (actor, q) => (calls.push(["list", q]), { items: [...data.values()], total: data.size }),
    key: (r) => r.id,
    cells: (r) => ({ name: r.name, status: r.status, phone: r.phone }),
    load: async (actor, rid) => (calls.push(["load", rid]), data.get(rid) ?? null),
    view: (r) => ({ title: `Item ${r.name}`, summary: [{ label: "Phone", value: r.phone, kind: "contact" }, { label: "Status", value: r.status, kind: "status" }] }),
    form: {
      fields: (r) => [{ name: "note", label: "Note", type: "textarea", value: r.note }, { name: "title", label: "Title", required: true, value: "" }],
      save: async (actor, r, v, ctx) => (calls.push(["save", v, ctx]), { message: "saved" }),
    },
    actions: {
      ship: { label: "Ship", when: (r) => r.status === "open", run: async (actor, r, f, ctx) => (calls.push(["run:ship", actor.via, ctx]), { message: "shipped" }) },
      cancel: { label: "Cancel", danger: true, run: async () => (calls.push(["run:cancel"]), undefined) },
      purge: { label: "Purge", adminOnly: true, run: async () => (calls.push(["run:purge"]), undefined) },
    },
    ...over,
  }
  return { section: defineSection(def), calls, data }
}

/** identify 가 몇 번 불렸는지 세는 콘솔 */
function consoleOf(sections, identity = ADMIN, extra = {}) {
  const counter = { n: 0 }
  const port = createAdminConsole({ sections: sections.map((s) => s.section ?? s), identify: async () => (counter.n++, identity), messages, ...extra })
  return { port, counter }
}

test("구획 목록 — 입장 가능한 구획만, 등록 순서대로, 주소는 basePath 아래", async () => {
  const a = make("orders")
  const b = make("bookings", { audience: { owner: () => OWNER_EMAIL } })
  const c = make("reviews", { audience: { owner: () => OWNER_EMAIL } })
  const { port } = consoleOf([a, b, c], OWNER)
  const r = await port.sections()
  assert.ok(r.ok)
  assert.deepEqual(r.data.map((s) => [s.id, s.href]), [["bookings", "/admin/bookings"], ["reviews", "/admin/reviews"]])
  const custom = await consoleOf([b], OWNER, { basePath: "/console" }).port.sections()
  assert.equal(custom.data[0].href, "/console/bookings")
})

test("볼 수 있는 구획이 없으면 가장 앞선 이유를 알린다(로그인·2단계 인증·대리 세션), forbidden 뿐이면 빈 목록", async () => {
  const orders = make("orders")
  let r = await consoleOf([orders], { kind: "signed_out" }).port.sections()
  assert.equal(r.ok, false)
  assert.equal(r.code, "sign_in_required")
  r = await consoleOf([orders], { ...ADMIN, twoFactor: false }).port.sections()
  assert.equal(r.code, "two_factor_required")
  r = await consoleOf([orders], { kind: "impersonating" }).port.sections()
  assert.equal(r.code, "impersonation_blocked")
  r = await consoleOf([orders], OWNER).port.sections()
  assert.ok(r.ok)
  assert.deepEqual(r.data, [])
})

test("꺼진 부품의 구획은 목록에서도 직접 요청에서도 사라진다", async () => {
  const a = make("orders")
  const b = make("reviews")
  const { port } = consoleOf([a, b], ADMIN, { enabledParts: ["orders"] })
  assert.deepEqual((await port.sections()).data.map((s) => s.id), ["orders"])
  const r = await port.table({ section: "reviews" })
  assert.equal(r.ok, false)
  assert.equal(r.code, "not_found")
  assert.equal(b.calls.length, 0)
})

test("표 — 모르는 구획은 not_found, 권한 없음은 구획을 부르지 않고, 질의는 다듬어 넘긴다, 행 주소는 콘솔이 만든다", async () => {
  const a = make("orders")
  const denied = make("secret", { audience: { owner: () => "someone-else@example.com" } })
  const { port } = consoleOf([a, denied], OWNER, {})
  assert.equal((await port.table({ section: "nope" })).code, "not_found")
  assert.equal((await port.table({ section: "../etc" })).code, "not_found")
  assert.equal((await port.table({ section: "secret" })).code, "forbidden")
  assert.equal(denied.calls.length, 0)
  const admin = consoleOf([a], ADMIN).port
  const ok = await admin.table({ section: "orders", search: "  kim ", limit: 9999 })
  assert.ok(ok.ok)
  assert.deepEqual(a.calls[0], ["list", { search: "kim", limit: 200, offset: 0 }])
  assert.deepEqual(ok.data.rows[0], { id: "a", cells: { name: "A", status: "open", phone: "010-1234-5678" }, href: "/admin/orders/a" })
  assert.equal((await admin.table({ section: "orders", limit: "x" })).code, "invalid_input")
})

test("표 — 선언하지 않은 상태 거르기는 invalid_input 이고 구획을 부르지 않는다", async () => {
  const a = make("orders")
  const none = make("plain", { statuses: undefined })
  const { port } = consoleOf([a, none])
  assert.equal((await port.table({ section: "orders", status: "bogus" })).code, "invalid_input")
  assert.equal((await port.table({ section: "plain", status: "open" })).code, "invalid_input")
  assert.equal(a.calls.length + none.calls.length, 0)
  assert.ok((await port.table({ section: "orders", status: "done" })).ok)
  assert.deepEqual(a.calls[0], ["list", { status: "done", limit: 100, offset: 0 }])
})

test("행동 — 위험 행동은 confirmed: true 가 아니면 run 을 부르지 않는다(구획이 따로 적지 않아도)", async () => {
  const a = make("orders")
  const { port } = consoleOf([a])
  for (const confirmed of [undefined, false, "true", 1]) {
    const r = await port.act({ section: "orders", id: "a", action: "cancel", confirmed })
    assert.equal(r.ok, false)
    assert.equal(r.code, "confirmation_required")
    assert.equal(r.formError, "msg:confirmation_required")
  }
  assert.ok(!a.calls.some((c) => c[0] === "run:cancel"))
  assert.ok((await port.act({ section: "orders", id: "a", action: "cancel", confirmed: true })).ok)
  assert.deepEqual(a.calls.filter((c) => c[0] === "run:cancel").length, 1)
  assert.ok((await port.act({ section: "orders", id: "a", action: "ship" })).ok)
})

test("행동 — 지금 상태에서 안 되는 행동(when 이 false)은 invalid_state 이고 run 을 부르지 않는다", async () => {
  const a = make("orders")
  a.data.get("a").status = "done"
  const { port } = consoleOf([a])
  const r = await port.act({ section: "orders", id: "a", action: "ship" })
  assert.equal(r.code, "invalid_state")
  assert.ok(!a.calls.some((c) => c[0] === "run:ship"))
})

test("행동 — 입력 모양이 틀리면 invalid_input, 모르는 행동·없는 기록도 구획 실행 없이 막힌다", async () => {
  const a = make("orders")
  const { port } = consoleOf([a])
  for (const bad of [null, "x", {}, { section: "orders", id: "", action: "ship" }, { section: "orders", id: "a" }, { section: "orders", id: "a", action: "ship", fields: { k: 1 } }, { section: "orders", id: "a", action: "ship", fields: [] }]) {
    assert.equal((await port.act(bad)).code, "invalid_input", JSON.stringify(bad))
  }
  assert.equal((await port.act({ section: "orders", id: "a", action: "nope" })).code, "invalid_input")
  assert.equal((await port.act({ section: "orders", id: "zzz", action: "ship" })).code, "not_found")
  assert.ok(!a.calls.some((c) => c[0].startsWith("run:")))
})

test("행동 — 폼 저장은 선언한 칸 이름만 받고(모르는 칸 invalid_input), 필수 칸이 비면 칸 오류", async () => {
  const a = make("orders")
  const { port } = consoleOf([a])
  const base = { section: "orders", id: "a", action: "save" }
  assert.equal((await port.act({ ...base, fields: { title: "t", evil: "x" } })).code, "invalid_input")
  const empty = await port.act({ ...base, fields: { title: "   ", note: "n" } })
  assert.equal(empty.code, "invalid_input")
  assert.deepEqual(Object.keys(empty.fieldErrors), ["title"])
  assert.equal(a.calls.filter((c) => c[0] === "save").length, 0)
  const ok = await port.act({ ...base, fields: { title: "t", note: "n" } })
  assert.ok(ok.ok)
  assert.equal(ok.data.message, "saved")
  assert.deepEqual(a.calls.find((c) => c[0] === "save")[1], { title: "t", note: "n" })
  const noForm = consoleOf([make("plain", { form: undefined })]).port
  assert.equal((await noForm.act({ section: "plain", id: "a", action: "save", fields: {} })).code, "invalid_input")
})

test("행동 — adminOnly 행동은 소유자에게는 forbidden 이고 상세에도 단추가 나오지 않는다, 관리자는 된다", async () => {
  const mk = () => make("bookings", { audience: { owner: () => OWNER_EMAIL } })
  const a = mk()
  const owner = consoleOf([a], OWNER).port
  const r = await owner.act({ section: "bookings", id: "a", action: "purge", confirmed: true })
  assert.equal(r.code, "forbidden")
  assert.ok(!a.calls.some((c) => c[0] === "run:purge"))
  assert.deepEqual((await owner.record({ section: "bookings", id: "a" })).data.actions.map((x) => x.id), ["ship"])
  const b = mk()
  const admin = consoleOf([b], ADMIN).port
  assert.ok((await admin.act({ section: "bookings", id: "a", action: "purge" })).ok)
  assert.deepEqual((await admin.record({ section: "bookings", id: "a" })).data.actions.map((x) => x.id), ["ship", "purge"])
})

test("입장 — 소유자는 2단계 인증 없이 들어오고, 관리자는 없으면 막힌다(소유자 겸 관리자는 소유자로 들어온다)", async () => {
  const owned = make("inquiries", { audience: { owner: () => OWNER_EMAIL } })
  assert.ok((await consoleOf([owned], OWNER).port.table({ section: "inquiries" })).ok)
  const adminOnly = make("orders")
  const noTwoFa = { ...ADMIN, twoFactor: false }
  assert.equal((await consoleOf([adminOnly], noTwoFa).port.table({ section: "orders" })).code, "two_factor_required")
  // 관리자 역할 + 2단계 없음 + 같은 사람이 확인된 소유자 → 소유자 구획에는 들어오지만 관리자 행동은 못 한다
  const both = { ...noTwoFa, verifiedEmail: OWNER_EMAIL }
  const mix = make("inquiries", { audience: { owner: () => OWNER_EMAIL } })
  const { port } = consoleOf([mix], both)
  assert.ok((await port.table({ section: "inquiries" })).ok)
  assert.equal((await port.act({ section: "inquiries", id: "a", action: "purge" })).code, "forbidden")
  // 이메일이 같아 보여도 비어 있거나 설정이 없으면 소유자가 아니다
  for (const bad of [null, undefined, "", "   "]) {
    const s = make("x", { audience: { owner: () => bad } })
    assert.equal((await consoleOf([s], { ...OWNER, verifiedEmail: bad ?? "" }).port.table({ section: "x" })).code, "forbidden")
  }
  const unverified = make("y", { audience: { owner: () => OWNER_EMAIL } })
  assert.equal((await consoleOf([unverified], { ...OWNER, verifiedEmail: null }).port.table({ section: "y" })).code, "forbidden")
})

test("입장 — 차단된 사용자는 forbidden, 대리 세션은 impersonation_blocked, 로그아웃은 sign_in_required(구획은 부르지 않는다)", async () => {
  const a = make("orders")
  assert.equal((await consoleOf([a], { ...ADMIN, banned: true }).port.table({ section: "orders" })).code, "forbidden")
  assert.equal((await consoleOf([a], { kind: "impersonating" }).port.record({ section: "orders", id: "a" })).code, "impersonation_blocked")
  assert.equal((await consoleOf([a], { kind: "signed_out" }).port.act({ section: "orders", id: "a", action: "ship" })).code, "sign_in_required")
  assert.equal(a.calls.length, 0)
  const custom = make("orders")
  const staffRole = { ...ADMIN, role: "staff" }
  assert.equal((await consoleOf([custom], staffRole).port.table({ section: "orders" })).code, "forbidden")
  assert.ok((await consoleOf([custom], staffRole, { adminRoles: ["staff"] }).port.table({ section: "orders" })).ok)
})

test("신원은 포트 호출마다 한 번만 읽는다(구획 수와 상관없이)", async () => {
  const sections = [make("orders"), make("bookings"), make("reviews")]
  const { port, counter } = consoleOf(sections)
  await port.sections()
  assert.equal(counter.n, 1)
  await port.overview()
  assert.equal(counter.n, 2)
  await port.table({ section: "orders" })
  await port.record({ section: "orders", id: "a" })
  await port.act({ section: "orders", id: "a", action: "ship" })
  assert.equal(counter.n, 5)
})

test("identify 가 던지면 forbidden 으로 닫힌다(열려 있는 쪽으로 새지 않는다)", async () => {
  const a = make("orders")
  const seen = []
  const port = createAdminConsole({ sections: [a.section], identify: async () => { throw new Error("db down") }, messages, onError: (e, where) => seen.push(where) })
  assert.equal((await port.table({ section: "orders" })).code, "forbidden")
  assert.equal(a.calls.length, 0)
  assert.equal(seen.length, 1)
})

test("구획이 던지면 이름 없는 action_failed 로 바뀌고 오류는 onError 로만 간다", async () => {
  const boom = make("orders", { list: async () => { throw new Error("pg: password=hunter2 failed") } })
  const seen = []
  const { port } = consoleOf([boom], ADMIN, { onError: (e, where) => seen.push([String(e.message), where]) })
  const r = await port.table({ section: "orders" })
  assert.equal(r.ok, false)
  assert.equal(r.code, "action_failed")
  assert.equal(r.formError, "msg:action_failed")
  assert.ok(!JSON.stringify(r).includes("hunter2"))
  assert.deepEqual(seen, [["pg: password=hunter2 failed", "orders.table"]])
})

test("구획이 refuse() 로 거절하면 그 code 와 문구가 나가고, 문구가 없으면 messages 표에서 채운다", async () => {
  const a = make("orders", {
    load: async () => refuse("not_found"),
    list: async () => refuse("invalid_input", { fieldErrors: { search: ["bad"] } }),
  })
  const { port } = consoleOf([a])
  const t = await port.table({ section: "orders" })
  assert.deepEqual([t.code, t.formError, t.fieldErrors], ["invalid_input", "msg:invalid_input", { search: ["bad"] }])
  assert.equal((await port.record({ section: "orders", id: "a" })).code, "not_found")
  const custom = make("orders2", { actions: { go: { label: "Go", run: async () => refuse("invalid_token", { formError: "Token is gone" }) } } })
  const r = await consoleOf([custom]).port.act({ section: "orders2", id: "a", action: "go" })
  assert.deepEqual([r.code, r.formError], ["invalid_token", "Token is gone"])
})

test("연락처 열·요약은 내보내기 전에 가려지고, 나가는 문구(formError·message)도 가려진다", async () => {
  const mask = { contact: (v) => v.replace(/\d/g, "*"), text: (v) => v.replace(/[\w.]+@[\w.]+/g, "<email>") }
  const a = make("orders", {
    form: undefined,
    actions: {
      ok: { label: "Ok", run: async () => ({ message: "sent to kim@example.com" }) },
      bad: { label: "Bad", run: async () => refuse("action_failed", { formError: "no such user kim@example.com" }) },
    },
  })
  const { port } = consoleOf([a], ADMIN, { mask })
  const t = await port.table({ section: "orders" })
  assert.equal(t.data.rows[0].cells.phone, "***-****-****")
  assert.equal(t.data.rows[0].cells.name, "A")
  const rec = await port.record({ section: "orders", id: "a" })
  assert.deepEqual(rec.data.summary.map((s) => s.value), ["***-****-****", "open"])
  assert.equal((await port.act({ section: "orders", id: "a", action: "ok" })).data.message, "sent to <email>")
  assert.equal((await port.act({ section: "orders", id: "a", action: "bad" })).formError, "no such user <email>")
})

test("접속 기록 — 표·상세를 읽을 때마다 데이터를 돌려주기 전에 남기고, 기록이 실패하면 데이터 없이 action_failed", async () => {
  const logs = []
  const a = make("orders")
  const good = consoleOf([a], ADMIN, { audit: { access: async (r) => void logs.push(r), action: async () => {} } }).port
  await good.table({ section: "orders" })
  await good.record({ section: "orders", id: "a" })
  assert.equal(logs.length, 2)
  assert.deepEqual(logs.map((l) => [l.kind, l.section, l.ids, l.actorId]), [["table", "orders", ["a"], "u-admin"], ["record", "orders", ["a"], "u-admin"]])
  const errors = []
  const bad = consoleOf([make("orders")], ADMIN, { audit: { access: async () => { throw new Error("log db down") }, action: async () => {} }, onError: (e, w) => errors.push(w) }).port
  for (const r of [await bad.table({ section: "orders" }), await bad.record({ section: "orders", id: "a" })]) {
    assert.equal(r.ok, false)
    assert.equal(r.code, "action_failed")
    assert.equal(r.data, undefined)
    assert.ok(!JSON.stringify(r).includes("010-"))
  }
  assert.deepEqual(errors, ["orders.audit.access", "orders.audit.access"])
})

test("행동 기록 — 실행한 뒤 남기고, 기록이 실패해도 결과는 돌려주며 onError 로만 알린다", async () => {
  const logs = []
  const errors = []
  const a = make("orders")
  const ok = consoleOf([a], ADMIN, { audit: { access: async () => {}, action: async (r) => void logs.push(r) }, now: () => new Date("2026-10-22T00:00:00Z") }).port
  await ok.act({ section: "orders", id: "a", action: "ship", fields: undefined })
  await ok.act({ section: "orders", id: "a", action: "cancel" }) // 확인 벽에서 멈춘 것은 기록하지 않는다
  assert.equal(logs.length, 1)
  assert.deepEqual(logs[0], { actorId: "u-admin", via: "admin", section: "orders", id: "a", action: "ship", ok: true, at: new Date("2026-10-22T00:00:00Z") })
  const b = make("orders")
  const bad = consoleOf([b], ADMIN, { audit: { access: async () => {}, action: async () => { throw new Error("x") } }, onError: (e, w) => errors.push(w) }).port
  assert.ok((await bad.act({ section: "orders", id: "a", action: "ship" })).ok)
  assert.deepEqual(errors, ["orders.audit.action"])
})

test("제한 훅 — 읽기·쓰기 모두 구획 실행 앞에서 막을 수 있다, 막히면 그 결과가 그대로 나간다", async () => {
  const kinds = []
  const limited = { ok: false, code: "rate_limited", formError: "slow down", retryable: true }
  const a = make("orders")
  const { port } = consoleOf([a], ADMIN, { limit: async (kind, actor) => (kinds.push([kind, actor.userId]), kind === "write" ? limited : null) })
  assert.ok((await port.table({ section: "orders" })).ok)
  assert.ok((await port.record({ section: "orders", id: "a" })).ok)
  const w = await port.act({ section: "orders", id: "a", action: "ship" })
  assert.deepEqual(w, limited)
  assert.ok(!a.calls.some((c) => c[0] === "run:ship"))
  assert.deepEqual(kinds, [["read", "u-admin"], ["read", "u-admin"], ["write", "u-admin"]])
})

test("런타임에 부품이 꺼져 있으면(available false) provider_unavailable 이고 목록에서도 빠진다", async () => {
  const off = make("orders", { available: () => false })
  const on = make("reviews")
  const { port } = consoleOf([off, on])
  assert.equal((await port.table({ section: "orders" })).code, "provider_unavailable")
  assert.equal(off.calls.length, 0)
  assert.deepEqual((await port.sections()).data.map((s) => s.id), ["reviews"])
})

test("상세 — 단추는 콘솔이 만든다: 가능한 일반 행동 + 위험 행동 하나 + 저장, 상태가 바뀌면 단추도 바뀐다", async () => {
  const a = make("orders")
  const { port } = consoleOf([a])
  const r = await port.record({ section: "orders", id: "a" })
  assert.ok(r.ok)
  assert.equal(r.data.title, "Item A")
  assert.deepEqual(r.data.actions, [{ id: "ship", label: "Ship" }, { id: "purge", label: "Purge" }])
  assert.deepEqual(r.data.danger, { id: "cancel", label: "Cancel" })
  assert.equal(r.data.save, "save")
  assert.deepEqual(r.data.fields.map((f) => f.name), ["note", "title"])
  a.data.get("a").status = "done"
  assert.deepEqual((await port.record({ section: "orders", id: "a" })).data.actions.map((x) => x.id), ["purge"])
  const noForm = consoleOf([make("plain", { form: undefined, actions: undefined })]).port
  const p = (await noForm.record({ section: "plain", id: "a" })).data
  assert.deepEqual([p.fields, p.actions, p.save, p.danger], [[], [], undefined, undefined])
  assert.equal((await port.record({ section: "orders", id: "missing" })).code, "not_found")
  assert.equal((await port.record({ section: "orders", id: "" })).code, "invalid_input")
})

test("개요 — 입장 가능한 구획의 일·변화만 합치고(주소는 콘솔이), 심각한 일이 먼저, 같으면 건수 큰 순서; 던진 구획은 failed 에 남는다", async () => {
  const t = (id, severity, count, extra = {}) => ({ id, severity, title: id, count, ...extra })
  const owned = { audience: { owner: () => OWNER_EMAIL } }
  const withOverview = (id, todo, metrics = [], over = {}) => make(id, { ...owned, overview: async () => ({ todo, metrics }), ...over })
  const a = withOverview("orders", [t("ship", "warning", 3, { status: "open" })], [{ id: "orders-week", label: "Orders", value: 12, previous: 9, unit: "orders", comparePeriod: "last 7 days" }])
  const b = withOverview("inquiries", [t("reply", "critical", 1)])
  const c = make("reviews", { ...owned, overview: async () => { throw new Error("x") } })
  const d = withOverview("bookings", [t("hidden", "critical", 99)], [], { audience: "admin" }) // 소유자는 못 들어오는 구획
  const e = make("plain", owned)
  const seen = []
  const { port } = consoleOf([a, b, c, d, e], OWNER, { now: () => new Date("2026-10-22T00:00:00Z"), onError: (err, where) => seen.push(where) })
  const r = await port.overview()
  assert.ok(r.ok)
  assert.equal(r.data.asOf, "2026-10-22T00:00:00.000Z")
  assert.deepEqual(r.data.todo.map((x) => [x.id, x.href]), [["reply", "/admin/inquiries"], ["ship", "/admin/orders?status=open"]])
  assert.equal(r.data.metrics.length, 1)
  assert.deepEqual(r.data.failed, ["reviews"])
  assert.deepEqual(seen, ["reviews.overview"])
  const clean = await consoleOf([b], OWNER).port.overview()
  assert.equal(clean.data.failed, undefined)
})

test("개요 — 로그아웃이면 빈 개요가 아니라 sign_in_required", async () => {
  const a = make("orders", { overview: async () => ({}) })
  const r = await consoleOf([a], { kind: "signed_out" }).port.overview()
  assert.equal(r.ok, false)
  assert.equal(r.code, "sign_in_required")
})

test("defineSection — 정의 오류는 정의하는 자리에서 던진다", () => {
  const ok = { id: "orders", part: "orders", label: "Orders", audience: "admin", columns: [{ id: "n", label: "N", primary: true }], list: async () => ({ items: [], total: 0 }), key: (r) => r.id, cells: () => ({ n: "" }), load: async () => null, view: () => ({ title: "", summary: [] }) }
  assert.doesNotThrow(() => defineSection(ok))
  const act = { label: "x", run: async () => {} }
  const cases = {
    "bad id": { id: "Orders" },
    "id with slash": { id: "a/b" },
    "empty part": { part: "" },
    "no audience": { audience: undefined },
    "zero primary": { columns: [{ id: "n", label: "N" }] },
    "two primary": { columns: [{ id: "n", label: "N", primary: true }, { id: "m", label: "M", primary: true }] },
    "duplicate column": { columns: [{ id: "n", label: "N", primary: true }, { id: "n", label: "M" }] },
    "two danger": { actions: { a: { ...act, danger: true }, b: { ...act, danger: true } } },
    "reserved save": { actions: { save: act } },
    "bad action id": { actions: { "Bad Id": act } },
    "long status": { statuses: ["x".repeat(33)] },
  }
  for (const [name, patch] of Object.entries(cases)) assert.throws(() => defineSection({ ...ok, ...patch }), Error, name)
  assert.throws(() => createAdminConsole({ sections: [defineSection(ok), defineSection(ok)], identify: async () => ADMIN, messages }), /orders/)
})

test("역할이 쉼표 목록이어도(Better Auth 저장 방식) 관리자 역할이 하나라도 있으면 관리자다 — 2단계 인증은 그대로 요구한다", async () => {
  const a = make("orders")
  const multi = { ...ADMIN, role: "support, admin" }
  assert.ok((await consoleOf([a], multi).port.sections()).ok)
  const noTwoFactor = await consoleOf([a], { ...multi, twoFactor: false }).port.sections()
  assert.equal(noTwoFactor.code, "two_factor_required")
  const other = await consoleOf([a], { ...ADMIN, role: "support,editor" }).port.sections()
  assert.deepEqual(other.ok ? other.data : "fail", [], "관리자 역할이 없으면 구획이 보이지 않는다")
})

test("serverSearch 선언: 켠 구획만 서버 검색으로 읽힌다 · 모르는 id 는 false · 검색어는 구획 list 에 그대로 간다(가린 칸까지 서버가 맞춘다)", async () => {
  const on = make("users", { serverSearch: true })
  const off = make("orders")
  const all = [on.section, off.section]
  assert.equal(hasServerSearch(all, "users"), true)
  assert.equal(hasServerSearch(all, "orders"), false)
  assert.equal(hasServerSearch(all, "nope"), false)
  const mask = { contact: (v) => v.replace(/\d/g, "*"), text: (v) => v }
  const { port } = consoleOf([on], ADMIN, { mask })
  const t = await port.table({ section: "users", search: "boss@example.com" })
  assert.ok(t.ok)
  assert.equal(on.calls.find((c) => c[0] === "list")[1].search, "boss@example.com")
  assert.equal(t.data.rows[0].cells.phone.includes("1234-5678"), false, "연락처 칸은 여전히 가려서 나간다")
})

test("쪽 매김 — page 는 (page - 1) × 줄 수 번째 줄부터 읽게 하고(offset), 구획의 pageSize 를 넘지 않는다 · 모양이 틀린 page 는 invalid_input", async () => {
  const a = make("orders")
  const reviews = make("reviews", { pageSize: 50 })
  const { port } = consoleOf([a, reviews])
  assert.ok((await port.table({ section: "orders", page: 3 })).ok)
  assert.deepEqual(a.calls[0], ["list", { limit: 100, offset: 200 }])
  assert.ok((await port.table({ section: "orders", page: 2, limit: 20 })).ok)
  assert.deepEqual(a.calls[1], ["list", { limit: 20, offset: 20 }])
  // 구획이 한 쪽 50줄만 줄 수 있다고 선언하면 기본·요청 줄 수가 모두 50 이하로 접힌다
  assert.ok((await port.table({ section: "reviews", page: 2 })).ok)
  assert.deepEqual(reviews.calls[0], ["list", { limit: 50, offset: 50 }])
  assert.ok((await port.table({ section: "reviews", page: 2, limit: 200 })).ok)
  assert.deepEqual(reviews.calls[1], ["list", { limit: 50, offset: 50 }])
  assert.ok((await port.table({ section: "orders" })).ok)
  assert.equal(a.calls[2][1].offset, 0, "page 가 없으면 첫 쪽")
  for (const page of [0, -1, 1.5, "2", 10_001, null]) assert.equal((await port.table({ section: "orders", page })).code, "invalid_input", String(page))
  assert.equal(a.calls.length, 3, "틀린 page 는 구획에 닿지 않는다")
})

test("pageSizeOf — 선언한 구획만 그 줄 수, 아니면 기본 100", () => {
  const a = make("orders")
  const r = make("reviews", { pageSize: 50 })
  assert.equal(pageSizeOf([a.section, r.section], "reviews"), 50)
  assert.equal(pageSizeOf([a.section, r.section], "orders"), 100)
  assert.equal(pageSizeOf([a.section], "unknown"), 100)
  for (const pageSize of [0, 201, 1.5]) assert.throws(() => make("bad", { pageSize }), /pageSize/)
})

test("멱등 키 — 행동·폼 저장에 키가 있으면 구획의 run·save 가 ctx 로 받고, 없으면 빈 ctx · 모양이 틀린 키는 invalid_input 으로 구획에 닿지 않는다", async () => {
  const a = make("orders")
  const { port } = consoleOf([a])
  assert.ok((await port.act({ section: "orders", id: "a", action: "ship" })).ok)
  assert.deepEqual(a.calls.find((c) => c[0] === "run:ship")[2], {})
  assert.ok((await port.act({ section: "orders", id: "a", action: "ship", idempotencyKey: "key-aaaa1111" })).ok)
  assert.deepEqual(a.calls.filter((c) => c[0] === "run:ship")[1][2], { idempotencyKey: "key-aaaa1111" })
  assert.ok((await port.act({ section: "orders", id: "a", action: "save", fields: { title: "t" }, idempotencyKey: "0000aaaa-0000-4000-8000-0000aaaa0000" })).ok)
  assert.deepEqual(a.calls.find((c) => c[0] === "save")[2], { idempotencyKey: "0000aaaa-0000-4000-8000-0000aaaa0000" })
  const before = a.calls.length
  for (const idempotencyKey of ["short", "has space 12345", "x".repeat(101), 12345678, ""]) assert.equal((await port.act({ section: "orders", id: "a", action: "ship", idempotencyKey })).code, "invalid_input", String(idempotencyKey))
  assert.equal(a.calls.length, before)
})
