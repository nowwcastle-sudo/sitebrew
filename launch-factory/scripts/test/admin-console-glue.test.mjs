// 관리 콘솔 조립(계획 3d L1) 한 바퀴 — 진짜 서버 액션(app/actions/admin-console.ts) → 진짜 조립(lib/launch/admin-console.ts · admin-identity.ts) → 콘솔 패키지 → 가짜 구획 하나.
// 진짜 요청 제한(feature-security)과 진짜 기록 표(access_logs · admin_actions, PGlite)를 쓴다. 세션·설정·DB 핸들만 대역이다. 구획은 시험이 ADMIN_SECTIONS 에 밀어 넣은 가짜 하나다.
// 지키는 것: 접근 벽(로그아웃 · 일반 사용자 · 2단계 없음 · 대리 세션 · 정지 · 입력의 role 무시) · 확인 입력 벽 · 목록→상세→저장→행동 한 바퀴 · 연락처 가리기 · 접속 기록·행동 기록 ·
// 쓰기 제한(분당 30) · 구획 오류는 일반 문구로만 · 등록부의 부품 이름은 features/outcomes.yaml 의 부품이다.
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { after, before, test } from "node:test"
import { fileURLToPath } from "node:url"
import YAML from "yaml"
import { defineSection, refuse } from "@launch-factory/admin-console"
import { accessLogs, adminActions, db, user as userTable } from "@launch-factory/db"
import { importRegistryFile, installGlueStubs, stubs } from "./registry-glue.mjs"

installGlueStubs({
  auth: ["authPort"],
  config: ["PRODUCT_NAME", "DEFAULT_LOCALE", "appUrl"],
  db: ["database"],
  env: ["env", "required"],
  enabled: ["hasPart"],
  mailer: ["mailer"], // 등록부가 상점 구획(orders · stock)을 불러오고, 그것이 상점 조립(commerce.ts)을 부른다
  security: ["guardAction"],
  "@/content/copy.admin-messages.en": ["adminMessages"],
})

const ROOT = fileURLToPath(new URL("../..", import.meta.url))
const at = new Date("2026-10-22T00:00:00.000Z")
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
let ip = "203.0.113.70"
let actions
let consoleMod
const store = new Map()
const calls = []
let explode = false

const setSession = (userId, extra = {}) => (session = userId ? { userId, impersonatedBy: null, ...extra } : null)
const reset = () => {
  store.clear()
  store.set("a1", { id: "a1", name: "Kim Minsu", email: "kim@example.com", status: "open", note: "first" })
  store.set("a2", { id: "a2", name: "Lee Jiwoo", email: "lee@example.com", status: "done", note: "" })
  calls.length = 0
  explode = false
}

const fake = defineSection({
  id: "fakes",
  part: "commerce",
  label: "Fakes",
  audience: "admin",
  columns: [
    { id: "name", label: "Name", kind: "text", primary: true },
    { id: "email", label: "Email", kind: "contact" },
    { id: "status", label: "Status", kind: "status", filter: true },
  ],
  statuses: ["open", "done"],
  list: async (_actor, q) => {
    if (explode) throw new Error("SELECT * FROM secret_table failed for kim@example.com")
    const items = [...store.values()].filter((r) => (q.status ? r.status === q.status : true) && (q.search ? r.name.toLowerCase().includes(q.search.toLowerCase()) : true))
    return { items: items.slice(0, q.limit), total: items.length }
  },
  key: (r) => r.id,
  cells: (r) => ({ name: r.name, email: r.email, status: r.status }),
  load: async (_actor, id) => store.get(id) ?? null,
  view: (r) => ({ title: `Fake ${r.id}`, summary: [{ label: "Status", value: r.status, kind: "status" }, { label: "Email", value: r.email, kind: "contact" }] }),
  form: {
    fields: (r) => [{ name: "note", label: "Note", type: "textarea", value: r.note }],
    save: async (_actor, r, values) => {
      calls.push({ action: "save", id: r.id, values })
      r.note = values.note ?? r.note
      return { message: "Saved for kim@example.com" }
    },
  },
  actions: {
    "mark-done": {
      label: "Mark done",
      when: (r) => r.status === "open",
      run: async (actor, r) => {
        calls.push({ action: "mark-done", id: r.id, via: actor.via })
        r.status = "done"
      },
    },
    cancel: {
      label: "Cancel",
      danger: true,
      run: async (_actor, r) => {
        calls.push({ action: "cancel", id: r.id })
        if (r.note === "refuse") return refuse("invalid_state", { formError: "Already cancelled" })
        store.delete(r.id)
      },
    },
  },
  overview: async () => ({ todo: [{ id: "open", severity: "warning", title: "Open fakes", count: [...store.values()].filter((r) => r.status === "open").length, status: "open" }] }),
})

before(async () => {
  process.env.LF_CLIENT_IP_HEADER = "x-test-ip"
  d = await db.local()
  const rows = [
    ["plain", null, false, false],
    ["root", "admin", true, false],
    ["root2", "admin", true, false],
    ["admin-no2fa", "admin", false, false],
    ["banned-admin", "admin", true, true],
  ]
  for (const [id, role, two, banned] of rows) await d.insert(userTable).values({ id, name: id, email: `${id}@example.com`, emailVerified: true, role, twoFactorEnabled: two, banned, createdAt: at, updatedAt: at })
  stubs.config = { PRODUCT_NAME: "Example", DEFAULT_LOCALE: "en", appUrl: () => "https://shop.example.test" }
  stubs.db = { database: async () => d }
  stubs.env = { env: () => ({ LF_MODE: "mock" }), required: (n) => `x-${n}` }
  stubs.enabled = { hasPart: () => true }
  stubs.mailer = { mailer: () => ({ mode: "mock", send: async () => ({ ok: true, mode: "mock" }) }) }
  stubs.auth = { authPort: async () => ({ session: async () => ({ ok: true, data: session }) }) }
  stubs["next/headers"] = { headers: async () => new Headers({ "x-test-ip": ip }) }
  stubs["@/content/copy.admin-messages.en"] = { adminMessages: MESSAGES }
  const security = await importRegistryFile("feature-security/files/lib/launch/security.ts")
  stubs.security = { guardAction: (...a) => security.guardAction(...a) }
  consoleMod = await importRegistryFile("feature-admin-console/files/lib/launch/admin-console.ts")
  consoleMod.ADMIN_SECTIONS.push(fake)
  actions = await importRegistryFile("feature-admin-console/files/app/actions/admin-console.ts")
})
after(async () => {
  await d?.$client.close()
})

const ok = (r) => {
  assert.equal(r.ok, true, JSON.stringify(r))
  return r.data
}

test("등록부의 부품 이름은 features/outcomes.yaml 의 부품 이름이다(어긋나면 구획이 영영 꺼진다)", () => {
  const parts = Object.keys(YAML.parse(readFileSync(`${ROOT}/features/outcomes.yaml`, "utf8")).parts)
  for (const s of consoleMod.ADMIN_SECTIONS) assert.ok(parts.includes(s.part), `${s.id} → part '${s.part}' 가 outcomes.yaml parts 에 없다`)
})

test("연락처 가리개 — 메일·전화·주소를 알아볼 만큼만", () => {
  assert.equal(consoleMod.maskContact("kim@example.com"), "k***@example.com")
  assert.equal(consoleMod.maskContact("010-1234-5678"), "***-5678")
  assert.equal(consoleMod.maskContact("+82 10 1234 5678"), "***-5678")
  assert.equal(consoleMod.maskContact("Seoul Gangnam 12-3"), "Seoul ***")
  assert.equal(consoleMod.maskContact(""), "")
  assert.equal(consoleMod.maskContact("홍길동"), "홍***", "낱말 하나는 이름일 수 있어 첫 글자만")
})

test("접근 벽 — 로그아웃 · 일반 사용자 · 2단계 없음 · 정지 · 대리 세션은 구획을 열지 못한다", async () => {
  reset()
  const cases = [
    [null, "sign_in_required"],
    ["plain", "forbidden"],
    ["admin-no2fa", "two_factor_required"],
    ["banned-admin", "forbidden"],
  ]
  for (const [who, code] of cases) {
    setSession(who)
    for (const call of [() => actions.adminSections(), () => actions.adminTable({ section: "fakes" }), () => actions.adminRecord({ section: "fakes", id: "a1" }), () => actions.adminAct({ section: "fakes", id: "a1", action: "mark-done" })]) {
      const r = await call()
      if (code === "forbidden" && r.ok) {
        // 구획 목록은 볼 수 있는 구획만 걸러 돌려준다 — 권한이 없으면 빈 목록이다(실패 코드는 로그인·2단계·대리 세션 같은 앞선 벽에만 난다)
        assert.deepEqual(r.data, [], `${who}`)
        continue
      }
      assert.equal(r.ok, false, `${who}`)
      assert.equal(r.code, code, `${who}`)
    }
  }
  setSession("root", { impersonatedBy: "someone" })
  assert.equal((await actions.adminTable({ section: "fakes" })).code, "impersonation_blocked")
  assert.equal(calls.length, 0, "벽에 막힌 요청은 구획에 닿지 않는다")
  assert.equal(store.get("a1").status, "open")
})

test("입력의 role·userId 는 읽지 않는다 — 일반 사용자가 role: admin 을 실어도 막힌다", async () => {
  reset()
  setSession("plain")
  const r = await actions.adminAct({ section: "fakes", id: "a1", action: "mark-done", role: "admin", userId: "root", via: "admin" })
  assert.equal(r.ok, false)
  assert.equal(r.code, "forbidden")
  assert.equal(store.get("a1").status, "open")
})

test("모르는 구획·행동·상태값은 구획에 닿지 않는다", async () => {
  reset()
  setSession("root")
  assert.equal((await actions.adminTable({ section: "nope" })).code, "not_found")
  assert.equal((await actions.adminTable({ section: "fakes", status: "weird" })).code, "invalid_input")
  assert.equal((await actions.adminAct({ section: "fakes", id: "a1", action: "constructor" })).code, "invalid_input")
  assert.equal((await actions.adminAct({ section: "fakes", id: "a1", action: "mark-done", fields: { evil: "x" } })).code, "invalid_input")
  assert.equal(calls.length, 0)
})

test("한 바퀴 — 구획 목록 → 표(연락처 가림) → 기록 → 저장 → 행동 → 개요, 읽기는 접속 기록·행동은 행동 기록", async () => {
  reset()
  setSession("root")
  // 등록부에는 진짜 구획(주문·재고)도 들어 있다 — 이 시험은 가짜 구획만 본다(진짜 구획은 commerce-admin-section-glue 가 시험한다)
  assert.deepEqual(ok(await actions.adminSections()).filter((s) => s.id === "fakes"), [{ id: "fakes", label: "Fakes", href: "/admin/fakes" }])
  const table = ok(await actions.adminTable({ section: "fakes" }))
  assert.deepEqual(table.rows.map((r) => r.id), ["a1", "a2"])
  assert.equal(table.rows[0].cells.email, "k***@example.com", "연락처 열은 콘솔이 가린다")
  assert.equal(table.rows[0].href, "/admin/fakes/a1")
  assert.deepEqual(ok(await actions.adminTable({ section: "fakes", status: "open" })).rows.map((r) => r.id), ["a1"])

  const rec = ok(await actions.adminRecord({ section: "fakes", id: "a1" }))
  assert.equal(rec.title, "Fake a1")
  assert.equal(rec.summary.find((s) => s.label === "Email").value, "k***@example.com")
  assert.equal(rec.save, "save")
  assert.deepEqual(rec.actions.map((a) => a.id), ["mark-done"], "위험 행동은 단추 목록이 아니라 danger 로 나간다")
  assert.deepEqual(rec.danger, { id: "cancel", label: "Cancel" })

  const saved = await actions.adminAct({ section: "fakes", id: "a1", action: "save", fields: { note: "second" } })
  assert.equal(saved.ok, true)
  assert.equal(saved.data.message, "Saved for [email]", "나가는 문구의 메일 모양은 가려진다")
  assert.equal(store.get("a1").note, "second")

  ok(await actions.adminAct({ section: "fakes", id: "a1", action: "mark-done" }))
  assert.equal(store.get("a1").status, "done")
  assert.equal((await actions.adminAct({ section: "fakes", id: "a1", action: "mark-done" })).code, "invalid_state", "두 번 눌러도 한 번")
  assert.deepEqual(ok(await actions.adminRecord({ section: "fakes", id: "a1" })).actions, [], "할 수 없는 행동은 단추도 없다")

  const overview = ok(await actions.adminOverview())
  assert.deepEqual(overview.todo.filter((t) => t.href.startsWith("/admin/fakes")).map((t) => [t.id, t.count, t.href]), [["open", 0, "/admin/fakes?status=open"]])

  const access = await d.select().from(accessLogs)
  assert.ok(access.some((r) => r.actorId === "root" && r.action === "view" && r.target === "admin/fakes/table" && r.subjects.includes("a1")))
  assert.ok(access.some((r) => r.target === "admin/fakes/record" && r.subjects.join() === "a1"))
  assert.ok(access.every((r) => r.ip === "203.0.113.70"))
  const done = (await d.select().from(adminActions)).filter((r) => r.adminUserId === "root")
  assert.deepEqual(done.map((r) => r.action).sort(), ["fakes.mark-done", "fakes.save"], "벽·상태 검사에 막혀 실행되지 않은 요청은 행동 기록을 남기지 않는다")
  assert.ok(done.every((r) => r.ipAddress === "203.0.113.70"))
  assert.doesNotMatch(JSON.stringify(done), /second|kim@example/, "행동 기록에 폼 값·개인정보는 없다")
})

test("확인 입력 벽 — 위험 행동은 confirmed: true 가 정확히 true 일 때만 실행된다", async () => {
  reset()
  setSession("root")
  for (const confirmed of [undefined, false, "true", 1]) {
    const r = await actions.adminAct({ section: "fakes", id: "a2", action: "cancel", ...(confirmed === undefined ? {} : { confirmed }) })
    assert.equal(r.ok, false, String(confirmed))
    assert.ok(["confirmation_required", "invalid_input"].includes(r.code), String(confirmed))
  }
  assert.equal(store.has("a2"), true)
  assert.equal(calls.length, 0)
  ok(await actions.adminAct({ section: "fakes", id: "a2", action: "cancel", confirmed: true }))
  assert.equal(store.has("a2"), false)
  // 구획이 돌려준 거절은 코드와 문구가 그대로 나간다
  store.set("a3", { id: "a3", name: "Park", email: "p@example.com", status: "open", note: "refuse" })
  const refused = await actions.adminAct({ section: "fakes", id: "a3", action: "cancel", confirmed: true })
  assert.deepEqual([refused.ok, refused.code, refused.formError], [false, "invalid_state", "Already cancelled"])
  assert.equal((await actions.adminAct({ section: "fakes", id: "missing", action: "mark-done" })).code, "not_found")
})

test("구획이 던진 오류는 일반 문구로만 나간다 — DB 글·개인정보 없이", async () => {
  reset()
  setSession("root")
  explode = true
  const logged = []
  const orig = console.error
  console.error = (...a) => logged.push(a.join(" "))
  try {
    const r = await actions.adminTable({ section: "fakes" })
    assert.deepEqual([r.ok, r.code, r.formError], [false, "action_failed", "failed"])
    assert.doesNotMatch(JSON.stringify(r), /secret_table|kim@example/)
    assert.deepEqual(logged, ["[admin] fakes.table: Error"], "서버 로그에는 위치와 오류 이름만")
  } finally {
    console.error = orig
  }
})

test("쓰기는 분당 30번까지 — 넘으면 rate_limited, 읽기 제한과 따로 센다", async () => {
  reset()
  ip = "203.0.113.71"
  setSession("root2")
  for (let i = 0; i < 30; i++) assert.equal((await actions.adminAct({ section: "fakes", id: "a1", action: "save", fields: { note: `n${i}` } })).ok, true, `${i + 1}번째`)
  const over = await actions.adminAct({ section: "fakes", id: "a1", action: "save", fields: { note: "x" } })
  assert.deepEqual([over.ok, over.code], [false, "rate_limited"])
  assert.ok(over.retryAfter > 0)
  assert.equal(store.get("a1").note, "n29", "막힌 쓰기는 구획에 닿지 않는다")
  assert.equal((await actions.adminTable({ section: "fakes" })).ok, true)
})
