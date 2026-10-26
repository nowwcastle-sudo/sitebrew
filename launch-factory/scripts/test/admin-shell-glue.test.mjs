// 관리 셸(계획 3d L1) — 레지스트리가 싣는 진짜 파일(app/actions/admin-console.ts · lib/launch/admin-identity.ts)과 진짜 요청 제한(feature-security + PGlite)을 그대로 불러 쓴다.
// 세션·DB 핸들·설정·콘솔(구획 등록부)만 대역이다. 구획 모듈은 아직 없다 — 콘솔 대역은 받은 입력을 기록만 하는 가짜 포트다.
// 지키는 것: 신원 판독(로그아웃 · 대리 세션 · 사용자 행의 역할·정지·2단계·확인된 메일 · 행 없음 = 정지) · 로그아웃이면 다섯 액션 모두 sign_in_required 이고 콘솔을 부르지 않음 ·
// 입력의 role·userId 는 읽지 않고 그대로 콘솔에 넘김(신원은 콘솔이 identify 로 읽는다) · adminAct 요청 제한(30/분, 쓰기 제한은 이 한 곳).
import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import { db, user as userTable } from "@launch-factory/db"
import { RATE_LIMIT_DEFAULTS } from "@launch-factory/security/rate-limit"
import { importRegistryFile, installGlueStubs, stubs } from "./registry-glue.mjs"

installGlueStubs({
  auth: ["authPort"],
  config: ["PRODUCT_NAME", "DEFAULT_LOCALE", "appUrl"],
  db: ["database"],
  env: ["env", "required"],
  security: ["guardAction"],
  "admin-console": ["adminConsole"],
})

const at = new Date("2026-10-22T00:00:00.000Z")
let d
let session = null
let ip = "203.0.113.60"
const calls = []
let actions
let identity

const setSession = (userId, extra = {}) => (session = userId ? { userId, impersonatedBy: null, ...extra } : null)

before(async () => {
  process.env.LF_CLIENT_IP_HEADER = "x-test-ip"
  d = await db.local()
  const rows = [
    { id: "plain", role: null, two: false, banned: false, verified: true },
    { id: "root", role: "admin", two: true, banned: false, verified: true },
    { id: "multi", role: "support,admin", two: true, banned: false, verified: true },
    { id: "banned-admin", role: "admin", two: true, banned: true, verified: true },
    { id: "unverified", role: null, two: false, banned: false, verified: false },
  ]
  for (const r of rows) await d.insert(userTable).values({ id: r.id, name: r.id, email: `${r.id}@example.com`, emailVerified: r.verified, role: r.role, twoFactorEnabled: r.two, banned: r.banned, createdAt: at, updatedAt: at })
  stubs.config = { PRODUCT_NAME: "예시 상점", DEFAULT_LOCALE: "en", appUrl: () => "https://shop.example.test" }
  stubs.db = { database: async () => d }
  stubs.env = { env: () => ({ LF_MODE: "mock" }), required: (n) => `x-${n}` }
  stubs.auth = { authPort: async () => ({ session: async () => ({ ok: true, data: session }) }) }
  stubs["next/headers"] = { headers: async () => new Headers({ "x-test-ip": ip }) }
  const security = await importRegistryFile("feature-security/files/lib/launch/security.ts")
  stubs.security = { guardAction: (...a) => security.guardAction(...a) }
  const record = (name) => async (input) => {
    calls.push({ name, input })
    return { ok: true, data: name === "sections" ? [] : {} }
  }
  stubs["admin-console"] = { adminConsole: () => ({ sections: record("sections"), overview: record("overview"), table: record("table"), record: record("record"), act: record("act") }) }
  actions = await importRegistryFile("feature-admin-console/files/app/actions/admin-console.ts")
  identity = await importRegistryFile("feature-admin-console/files/lib/launch/admin-identity.ts")
})
after(async () => {
  await d?.$client.close()
})

test("신원 — 세션이 없으면 signed_out, 대리 세션이면 impersonating", async () => {
  setSession(null)
  assert.deepEqual(await identity.identify(), { kind: "signed_out" })
  setSession("root", { impersonatedBy: "someone" })
  assert.deepEqual(await identity.identify(), { kind: "impersonating" })
})

test("신원 — 세션 읽기가 던져도 signed_out 이다(권한이 있는 것처럼 읽지 않는다)", async () => {
  const before = stubs.auth
  stubs.auth = { authPort: async () => ({ session: async () => { throw new Error("DB down: secret detail") } }) }
  try {
    assert.deepEqual(await identity.identify(), { kind: "signed_out" })
  } finally {
    stubs.auth = before
  }
})

test("신원 — 사용자 행에서 역할·정지·2단계·확인된 메일만 읽는다", async () => {
  setSession("plain")
  assert.deepEqual(await identity.identify(), { kind: "user", userId: "plain", role: null, banned: false, twoFactor: false, verifiedEmail: "plain@example.com" })
  setSession("root")
  assert.deepEqual(await identity.identify(), { kind: "user", userId: "root", role: "admin", banned: false, twoFactor: true, verifiedEmail: "root@example.com" })
  setSession("multi")
  assert.equal((await identity.identify()).role, "support,admin", "역할은 user.role 그대로(쉼표 목록) — 판정은 콘솔이 한다")
  setSession("banned-admin")
  assert.equal((await identity.identify()).banned, true)
  setSession("unverified")
  assert.equal((await identity.identify()).verifiedEmail, null, "확인 전 메일은 소유자 판정에 쓰지 않는다")
})

test("신원 — 사용자 행이 없으면 정지된 사람처럼 권한이 없다", async () => {
  setSession("ghost-user")
  assert.deepEqual(await identity.identify(), { kind: "user", userId: "ghost-user", role: null, banned: true, twoFactor: false, verifiedEmail: null })
})

test("서버 액션 다섯 — 이름과 순서", () => {
  assert.deepEqual(Object.keys(actions).sort(), ["adminAct", "adminOverview", "adminRecord", "adminSections", "adminTable"])
})

test("로그아웃이면 다섯 액션 모두 sign_in_required 이고 콘솔을 부르지 않는다", async () => {
  setSession(null)
  calls.length = 0
  const results = [
    await actions.adminSections(),
    await actions.adminOverview(),
    await actions.adminTable({ section: "orders" }),
    await actions.adminRecord({ section: "orders", id: "o1" }),
    await actions.adminAct({ section: "orders", id: "o1", action: "cancel", confirmed: true }),
  ]
  for (const r of results) {
    assert.equal(r.ok, false)
    assert.equal(r.code, "sign_in_required")
    assert.equal(r.retryable, false)
  }
  assert.equal(calls.length, 0)
})

test("로그인하면 입력을 그대로 콘솔에 넘긴다 — role·userId 같은 칸을 만들거나 읽지 않는다", async () => {
  setSession("plain")
  calls.length = 0
  const sneaky = { section: "orders", id: "o1", action: "cancel", fields: { note: "x" }, confirmed: true, role: "admin", userId: "root" }
  assert.equal((await actions.adminAct(sneaky)).ok, true)
  assert.deepEqual(calls, [{ name: "act", input: sneaky }], "액션은 입력을 건드리지 않는다 — 신원은 콘솔이 세션에서 읽는다")
  calls.length = 0
  await actions.adminSections()
  await actions.adminOverview()
  await actions.adminTable({ section: "orders", search: "kim", status: "open", limit: 5 })
  await actions.adminRecord({ section: "orders", id: "o1" })
  assert.deepEqual(
    calls.map((c) => c.name),
    ["sections", "overview", "table", "record"],
  )
  assert.deepEqual(calls[2].input, { section: "orders", search: "kim", status: "open", limit: 5 })
})

test("adminAct 는 요청 제한을 지난다 — 분당 30번, 넘으면 rate_limited(다른 사용자는 영향 없음). 쓰기 제한은 이 한 곳뿐이다", async () => {
  assert.deepEqual(RATE_LIMIT_DEFAULTS.adminAct, { max: 30, windowSec: 60 })
  assert.equal("admin:write" in RATE_LIMIT_DEFAULTS, false, "콘솔 안에서 쓰기를 한 번 더 세지 않는다")
  ip = "203.0.113.61"
  setSession("plain")
  calls.length = 0
  for (let i = 0; i < 30; i++) assert.equal((await actions.adminAct({ section: "orders", id: "o1", action: "note" })).ok, true, `${i + 1}번째`)
  const over = await actions.adminAct({ section: "orders", id: "o1", action: "note" })
  assert.equal(over.ok, false)
  assert.equal(over.code, "rate_limited")
  assert.ok(over.retryAfter > 0)
  assert.equal(calls.length, 30, "막힌 요청은 콘솔에 닿지 않는다")
  // 읽기 액션은 같은 제한을 받지 않는다(조회는 막지 않는다)
  assert.equal((await actions.adminSections()).ok, true)
  ip = "203.0.113.62"
  setSession("root")
  assert.equal((await actions.adminAct({ section: "orders", id: "o1", action: "note" })).ok, true)
})
