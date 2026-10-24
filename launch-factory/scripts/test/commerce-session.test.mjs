// 상점의 세션 읽기(lib/launch/commerce-session.ts) — 기본판(Better Auth)과 제품 템플릿판(mock 이면 화면의 목 로그인 + user 행 한 번)을 시험한다.
// 지키는 것: live 는 목 포트를 건드리지 않는다 · mock 로그아웃은 null · mock 로그인은 user 행이 한 번만 생기고 주문 표 외래 키가 걸린다.
import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import { db, user as userTable } from "@launch-factory/db"
import { importRegistryFile, importTemplateFile, installGlueStubs, stubs } from "./registry-glue.mjs"

installGlueStubs({ auth: ["authPort"], db: ["database"], env: ["env"], "@/lib/ports": ["ports"] })

let d
let mode = "mock"
let betterAuth = null
let mockUi = null
let portsCalls = 0
let base
let owned

before(async () => {
  d = await db.local()
  stubs.db = { database: async () => d }
  stubs.env = { env: () => ({ LF_MODE: mode }) }
  stubs.auth = { authPort: async () => ({ session: async () => ({ ok: true, data: betterAuth }) }) }
  stubs["@/lib/ports"] = { ports: async () => (portsCalls++, { auth: { session: async () => (mockUi ? { ok: true, data: mockUi } : { ok: true, data: null }) } }) }
  base = await importRegistryFile("feature-commerce/files/lib/launch/commerce-session.ts")
  owned = await importTemplateFile("lib/launch/commerce-session.ts")
})
after(async () => {
  await d?.$client.close()
})

test("기본판: Better Auth 세션의 userId·대리 로그인 표지를 그대로 읽고, 로그아웃은 null", async () => {
  betterAuth = null
  assert.equal(await base.shopSession(), null)
  betterAuth = { userId: "u1", impersonatedBy: "admin-1" }
  assert.deepEqual(await base.shopSession(), { userId: "u1", impersonatedBy: "admin-1" })
})

test("템플릿판 live: Better Auth 만 읽고 목 포트는 건드리지 않는다", async () => {
  mode = "live"
  portsCalls = 0
  betterAuth = { userId: "u2", impersonatedBy: null }
  mockUi = { userId: "mock-1", email: "mock@example.com", name: "Mock" }
  assert.deepEqual(await owned.shopSession(), { userId: "u2", impersonatedBy: null })
  assert.equal(portsCalls, 0)
  betterAuth = null
  assert.equal(await owned.shopSession(), null)
})

test("템플릿판 mock: 로그아웃이면 null 이고 user 행을 만들지 않는다", async () => {
  mode = "mock"
  mockUi = null
  betterAuth = { userId: "must-not-be-read", impersonatedBy: null }
  assert.equal(await owned.shopSession(), null)
  assert.equal((await d.select().from(userTable)).length, 0)
})

test("템플릿판 mock: 화면의 목 로그인을 읽고 user 행을 한 번만 만든다(여러 번 불러도 한 행)", async () => {
  mode = "mock"
  mockUi = { userId: "user-example-1", email: "kim@example.com", name: "Alex Example" }
  assert.deepEqual(await owned.shopSession(), { userId: "user-example-1" })
  assert.deepEqual(await owned.shopSession(), { userId: "user-example-1" })
  const rows = await d.select().from(userTable)
  assert.equal(rows.length, 1)
  assert.deepEqual([rows[0].id, rows[0].email, rows[0].name, rows[0].emailVerified], ["user-example-1", "kim@example.com", "Alex Example", true])
})
