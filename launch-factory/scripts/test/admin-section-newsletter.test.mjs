// 관리 구획 newsletter(계획 3d L5) — 진짜 구획 파일(feature-newsletter/…/admin-sections/newsletter.ts) → 진짜 콘솔 조립(feature-admin-console) → 진짜 뉴스레터 서비스(PGlite).
// 세션·설정·DB 핸들만 대역이다. 구획은 시험이 콘솔 등록부(ADMIN_SECTIONS)에 밀어 넣는다(템플릿의 등록 줄은 아래 글자 검사로 본다).
// 지키는 것: 접근 벽(로그아웃 · 일반 사용자 · 2단계 없음 · 정지 · 대리 세션 · 입력의 role 무시) · 확인 입력 벽(수신거부 대행) ·
// 목록(상태 거르기·연락처 가림)→상세(동의 증빙·서명 링크/토큰 없음)→행동 한 바퀴 · 두 번 눌러도 한 번 · 접속 기록·행동 기록 · 주소에 이메일이 없다.
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { after, before, test } from "node:test"
import { fileURLToPath } from "node:url"
import YAML from "yaml"
import { accessLogs, adminActions, db, hitRateLimit, newsletterSubscribers, user as userTable } from "@launch-factory/db"
import { createMailer } from "@launch-factory/email"
import { createNewsletterService } from "@launch-factory/newsletter"
import { createRateLimiter } from "@launch-factory/security/rate-limit"
import { createTurnstile } from "@launch-factory/security/turnstile"
import { importRegistryFile, installGlueStubs, stubs } from "./registry-glue.mjs"

installGlueStubs({
  auth: ["authPort"],
  config: ["PRODUCT_NAME", "DEFAULT_LOCALE", "appUrl"],
  db: ["database"],
  env: ["env", "required"],
  enabled: ["hasPart"],
  security: ["guardAction"],
  newsletter: ["newsletter"],
  "@/content/copy.admin-messages.en": ["adminMessages"],
})

const ROOT = fileURLToPath(new URL("../..", import.meta.url))
const at = new Date("2026-10-22T00:00:00.000Z")
const day = 86_400_000
const MESSAGES = {
  sign_in_required: "sign in",
  forbidden: "forbidden",
  two_factor_required: "two factor",
  impersonation_blocked: "impersonation",
  provider_unavailable: "unavailable",
  not_found: "not found",
  invalid_input: "invalid input",
  confirmation_required: "confirm first",
  invalid_state: "invalid state",
  action_failed: "failed",
}

let d
let session = null
let service
let section
let actions
const sent = []
const serviceCalls = []
const setSession = (userId, extra = {}) => (session = userId ? { userId, impersonatedBy: null, ...extra } : null)

const mock = createMailer({ mode: "mock", log: () => {} })
const ids = {}

before(async () => {
  process.env.LF_CLIENT_IP_HEADER = "x-test-ip"
  d = await db.local()
  const rows = [
    ["plain", null, false, false],
    ["root", "admin", true, false],
    ["admin-no2fa", "admin", false, false],
    ["banned-admin", "admin", true, true],
  ]
  for (const [id, role, two, banned] of rows) await d.insert(userTable).values({ id, name: id, email: `${id}@example.com`, emailVerified: true, role, twoFactorEnabled: two, banned, createdAt: at, updatedAt: at })

  const real = createNewsletterService({
    db: d,
    mailer: { mode: mock.mode, send: (req) => (sent.push(req), mock.send(req)) },
    limiter: createRateLimiter({ store: { hit: (k, w, n) => hitRateLimit(d, k, w, n) }, now: () => at }),
    turnstile: createTurnstile({ mode: "mock" }),
    secret: "lf-test-secret-not-real-0123456789abcdef",
    baseUrl: "https://sampleco.test",
    productName: "SampleCo",
    now: () => at,
  })
  // 서비스를 부르는 곳을 세어 「벽에 막힌 요청은 서비스에 닿지 않는다」를 본다
  service = new Proxy(real, { get: (t, k) => (typeof t[k] === "function" ? (...a) => (serviceCalls.push(String(k)), t[k](...a)) : t[k]) })

  const seed = async (key, status, email) => {
    const consentAt = new Date(at.getTime() - day * (key.length + 1))
    const [row] = await d
      .insert(newsletterSubscribers)
      .values({ email, status, locale: "en", source: "footer-form", consentVersion: "2026-09", consentAt, createdAt: consentAt, confirmSentAt: consentAt, confirmedAt: status === "pending" ? null : consentAt, unsubscribedAt: status === "unsubscribed" ? consentAt : null, expiresAt: status === "subscribed" ? null : new Date(at.getTime() + 10 * day) })
      .returning()
    ids[key] = row.id
  }
  await seed("sub", "subscribed", "kim.reader@example.com")
  await seed("pend", "pending", "lee.waiting@example.com")
  await seed("gone", "unsubscribed", "park.gone@example.com")
  await seed("sub2", "subscribed", "choi.second@example.com")

  stubs.config = { PRODUCT_NAME: "Example", DEFAULT_LOCALE: "en", appUrl: () => "https://shop.example.test" }
  stubs.db = { database: async () => d }
  stubs.env = { env: () => ({ LF_MODE: "mock" }), required: (n) => `x-${n}` }
  stubs.enabled = { hasPart: () => true }
  stubs.auth = { authPort: async () => ({ session: async () => ({ ok: true, data: session }) }) }
  stubs["next/headers"] = { headers: async () => new Headers({ "x-test-ip": "203.0.113.90" }) }
  stubs["@/content/copy.admin-messages.en"] = { adminMessages: MESSAGES }
  stubs.newsletter = { newsletter: async () => service }
  const security = await importRegistryFile("feature-security/files/lib/launch/security.ts")
  stubs.security = { guardAction: (...a) => security.guardAction(...a) }
  section = (await importRegistryFile("feature-newsletter/files/lib/launch/admin-sections/newsletter.ts")).default
  const consoleMod = await importRegistryFile("feature-admin-console/files/lib/launch/admin-console.ts")
  consoleMod.ADMIN_SECTIONS.push(section)
  actions = await importRegistryFile("feature-admin-console/files/app/actions/admin-console.ts")
})
after(async () => {
  await d?.$client.close()
})

const ok = (r) => {
  assert.equal(r.ok, true, JSON.stringify(r))
  return r.data
}
const statusOf = async (id) => (await d.select().from(newsletterSubscribers)).find((r) => r.id === id).status

test("구획의 부품 이름은 features/outcomes.yaml 의 부품이고, 템플릿 등록부가 이 구획을 등록한다", () => {
  const parts = Object.keys(YAML.parse(readFileSync(`${ROOT}/features/outcomes.yaml`, "utf8")).parts)
  assert.ok(parts.includes("newsletter"))
  assert.equal(section.part, "newsletter")
  assert.equal(section.id, "newsletter")
  const reg = readFileSync(`${ROOT}/template/lib/launch/admin-console.ts`, "utf8")
  assert.match(reg, /import newsletterSection from "@\/lib\/launch\/admin-sections\/newsletter"/)
  assert.match(reg, /ADMIN_SECTIONS: readonly AdminSection\[\] = \[[^\]]*newsletterSection/)
})

test("접근 벽 — 로그아웃 · 일반 사용자 · 2단계 없음 · 정지 · 대리 세션은 명단에 닿지 못한다", async () => {
  serviceCalls.length = 0
  const cases = [
    [null, "sign_in_required"],
    ["plain", "forbidden"],
    ["admin-no2fa", "two_factor_required"],
    ["banned-admin", "forbidden"],
  ]
  for (const [who, code] of cases) {
    setSession(who)
    for (const call of [() => actions.adminTable({ section: "newsletter" }), () => actions.adminRecord({ section: "newsletter", id: ids.sub }), () => actions.adminAct({ section: "newsletter", id: ids.sub, action: "mark-unsubscribed", confirmed: true })]) {
      const r = await call()
      assert.equal(r.ok, false, String(who))
      assert.equal(r.code, code, String(who))
    }
    if (who === "plain") assert.deepEqual(ok(await actions.adminSections()), [], "볼 수 없는 구획은 목록에도 없다")
  }
  setSession("root", { impersonatedBy: "someone" })
  assert.equal((await actions.adminTable({ section: "newsletter" })).code, "impersonation_blocked")
  // 일반 사용자가 입력에 role 을 실어도 신원은 사용자 행에서만 온다
  setSession("plain")
  assert.equal((await actions.adminAct({ section: "newsletter", id: ids.sub, action: "mark-unsubscribed", confirmed: true, role: "admin", userId: "root", via: "admin" })).code, "forbidden")
  assert.deepEqual(serviceCalls, [], "벽에 막힌 요청은 서비스에 닿지 않는다")
  assert.equal(await statusOf(ids.sub), "subscribed")
})

test("쪽 매김 — 한 쪽 줄 수(limit)와 쪽 번호(page)로 이어 읽고, 쪽끼리 겹치지 않으며, 범위를 넘으면 빈 쪽이고, 틀린 쪽 번호는 막는다", async () => {
  setSession("root")
  const p1 = ok(await actions.adminTable({ section: "newsletter", limit: 2, page: 1 }))
  const p2 = ok(await actions.adminTable({ section: "newsletter", limit: 2, page: 2 }))
  const p3 = ok(await actions.adminTable({ section: "newsletter", limit: 2, page: 3 }))
  assert.deepEqual([p1.rows.length, p2.rows.length, p3.rows.length], [2, 2, 0])
  assert.deepEqual([p1.total, p2.total, p3.total], [4, 4, 4], "전체 건수는 쪽과 상관없이 같다")
  const seen = [...p1.rows, ...p2.rows].map((r) => r.id)
  assert.equal(new Set(seen).size, 4, "쪽끼리 겹치지 않는다")
  assert.deepEqual([...seen].sort(), Object.values(ids).sort(), "두 쪽을 이으면 전체다")
  // 쪽 번호를 안 주면 1쪽 — 예전 호출과 같다
  assert.deepEqual(ok(await actions.adminTable({ section: "newsletter", limit: 2 })).rows.map((r) => r.id), p1.rows.map((r) => r.id))
  for (const page of [0, -1, 1.5, 10_001, "2"]) assert.equal((await actions.adminTable({ section: "newsletter", page })).code, "invalid_input", String(page))
})

test("목록 — 상태로 거르고, 이메일은 가려서 나가며, 주소(href·id)에는 이메일이 없다", async () => {
  setSession("root")
  const info = ok(await actions.adminSections()).find((s) => s.id === "newsletter")
  assert.deepEqual(info, { id: "newsletter", label: "Newsletter", href: "/admin/newsletter" })

  const all = ok(await actions.adminTable({ section: "newsletter" }))
  assert.deepEqual(all.columns.filter((c) => c.primary).map((c) => c.id), ["email"])
  assert.equal(all.columns.find((c) => c.id === "email").kind, "contact")
  assert.equal(all.total, 4)
  const row = all.rows.find((r) => r.id === ids.sub)
  assert.equal(row.cells.email, "k***@example.com")
  assert.equal(row.cells.status, "subscribed")
  assert.equal(row.href, `/admin/newsletter/${ids.sub}`)
  assert.doesNotMatch(JSON.stringify(all), /kim\.reader|lee\.waiting|park\.gone|choi\.second/, "전체 이메일은 목록에 나가지 않는다")
  assert.doesNotMatch(JSON.stringify(all), /https?:|token|[?&]t=/i, "서명 링크·토큰이 없다")

  for (const status of ["pending", "subscribed", "unsubscribed"]) {
    const t = ok(await actions.adminTable({ section: "newsletter", status }))
    assert.ok(t.rows.length >= 1 && t.rows.every((r) => r.cells.status === status), status)
  }
  assert.deepEqual(ok(await actions.adminTable({ section: "newsletter", status: "pending" })).rows.map((r) => r.id), [ids.pend])
  assert.equal((await actions.adminTable({ section: "newsletter", status: "confirmed" })).code, "invalid_input", "모르는 상태값은 서비스에 닿지 않는다")
  // 이메일 일부로 찾는다(찾는 일은 가려지지 않은 값으로)
  assert.deepEqual(ok(await actions.adminTable({ section: "newsletter", search: "park.gone" })).rows.map((r) => r.id), [ids.gone])
})

test("상세 — 동의 증빙(판·시각)·확인 시각·보유 기한이 있고 서명 링크·토큰은 없다. 전체 이메일은 상세에서만 보인다", async () => {
  setSession("root")
  const rec = ok(await actions.adminRecord({ section: "newsletter", id: ids.sub }))
  assert.match(rec.title, /^Subscriber [0-9a-f]{8}$/, "제목에 이메일을 싣지 않는다")
  const by = Object.fromEntries(rec.summary.map((s) => [s.label, s.value]))
  assert.equal(by["Email"], "kim.reader@example.com")
  assert.equal(by["Status"], "subscribed")
  assert.equal(by["Consent version"], "2026-09")
  assert.match(by["Consent given"], /^2026-10-\d\d \d\d:\d\d UTC$/)
  assert.match(by["Confirmed"], /UTC$/)
  assert.equal(by["Unsubscribed"], "—")
  assert.equal(by["Record kept until"], "While subscribed")
  assert.doesNotMatch(JSON.stringify(rec), /https?:|token|unsubscribe\?/i)
  assert.deepEqual(rec.fields, [], "편집 칸이 없다 — 동의 증빙은 고치지 않는다")
  assert.equal(rec.save, undefined)
  assert.deepEqual(rec.actions, [])
  assert.deepEqual(rec.danger, { id: "mark-unsubscribed", label: "Unsubscribe" })

  const pend = Object.fromEntries(ok(await actions.adminRecord({ section: "newsletter", id: ids.pend })).summary.map((s) => [s.label, s.value]))
  assert.equal(pend["Confirmed"], "Not confirmed")
  assert.match(pend["Record kept until"], /UTC$|\d{4}-\d\d-\d\d/)

  // 이메일·uuid 아닌 글자·없는 id 는 모두 없는 기록
  for (const bad of ["kim.reader@example.com", "x", "00000000-0000-4000-8000-000000000000"]) assert.equal((await actions.adminRecord({ section: "newsletter", id: bad })).code, "not_found", bad)
  // 철회한 사람의 상세에는 위험 행동 단추가 없다(할 수 없는 행동은 단추도 없다)
  assert.equal(ok(await actions.adminRecord({ section: "newsletter", id: ids.gone })).danger, undefined)
})

test("수신거부 대행 — 확인 입력 없이는 실행되지 않고, 확인하면 철회 기록이 되며(증빙 유지) 처리 결과가 한 통 가고, 두 번 눌러도 한 번", async () => {
  setSession("root")
  for (const confirmed of [undefined, false, "true", 1]) {
    const r = await actions.adminAct({ section: "newsletter", id: ids.sub, action: "mark-unsubscribed", ...(confirmed === undefined ? {} : { confirmed }) })
    assert.equal(r.ok, false, String(confirmed))
    assert.ok(["confirmation_required", "invalid_input"].includes(r.code), String(confirmed))
  }
  assert.equal(await statusOf(ids.sub), "subscribed")
  assert.equal(sent.length, 0)

  const before = (await d.select().from(adminActions)).length
  const done = await actions.adminAct({ section: "newsletter", id: ids.sub, action: "mark-unsubscribed", confirmed: true })
  assert.equal(done.ok, true, JSON.stringify(done))
  assert.doesNotMatch(JSON.stringify(done), /kim\.reader/)
  const row = (await d.select().from(newsletterSubscribers)).find((r) => r.id === ids.sub)
  assert.equal(row.status, "unsubscribed")
  assert.equal(row.unsubscribedAt.toISOString(), at.toISOString())
  assert.equal(row.consentVersion, "2026-09", "동의 증빙은 지우지 않는다")
  assert.ok(row.confirmedAt)
  assert.deepEqual(sent.map((r) => [r.template, r.to]), [["marketingConsentNotice", "kim.reader@example.com"]])

  const again = await actions.adminAct({ section: "newsletter", id: ids.sub, action: "mark-unsubscribed", confirmed: true })
  assert.deepEqual([again.ok, again.code], [false, "invalid_state"])
  assert.equal(sent.length, 1)

  // 확인 전(대기)이었던 사람의 대행 수신거부는 통지가 없다
  ok(await actions.adminAct({ section: "newsletter", id: ids.pend, action: "mark-unsubscribed", confirmed: true }))
  assert.equal(await statusOf(ids.pend), "unsubscribed")
  assert.equal(sent.length, 1)
  assert.equal((await actions.adminAct({ section: "newsletter", id: "00000000-0000-4000-8000-000000000000", action: "mark-unsubscribed", confirmed: true })).code, "not_found")

  // 행동 기록: 구획.행동 · 기록 id · 성공 여부. 이메일은 없다
  const logs = (await d.select().from(adminActions)).slice(before).filter((r) => r.adminUserId === "root")
  assert.ok(logs.some((r) => r.action === "newsletter.mark-unsubscribed" && r.meta.recordId === ids.sub && r.meta.ok === true))
  assert.doesNotMatch(JSON.stringify(logs), /@example\.com/)
})

test("읽기마다 접속 기록 — 본 기록 id 만 남고 이메일은 남지 않는다", async () => {
  setSession("root")
  ok(await actions.adminTable({ section: "newsletter" }))
  ok(await actions.adminRecord({ section: "newsletter", id: ids.sub2 }))
  const access = await d.select().from(accessLogs)
  assert.ok(access.some((r) => r.actorId === "root" && r.target === "admin/newsletter/table"))
  assert.ok(access.some((r) => r.target === "admin/newsletter/record" && r.subjects.join() === ids.sub2))
  assert.doesNotMatch(JSON.stringify(access), /@example\.com/)
})
