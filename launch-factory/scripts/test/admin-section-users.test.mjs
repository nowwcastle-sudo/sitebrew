// 관리 구획 users(계획 3d L5) — 진짜 구획 파일(feature-auth-betterauth/…/admin-sections/users.ts) → 진짜 콘솔 조립 → 진짜 Better Auth(admin·2단계 플러그인, PGlite).
// 세션 대역은 없다: 로그인한 사람의 쿠키 통(memoryIO)이 곧 요청이다. 설정·DB 핸들만 대역이다. 구획은 시험이 콘솔 등록부(ADMIN_SECTIONS)에 밀어 넣는다(템플릿의 등록 줄은 글자 검사로 본다).
// 지키는 것: 접근 벽(로그아웃 · 일반 사용자 · 2단계 없음 · 정지 · 대리 세션 · 입력의 role 무시) · 관리자 조각이 꺼져 있으면 열리지 않음 ·
// 확인 입력 벽(정지) · 목록(연락처 가림)→상세→정지→해제 한 바퀴 · 상태 불가 · 자기 정지 불가 · 비밀번호 해시·세션 토큰이 어디에도 안 나감 · 기록(콘솔 + 인증 서비스).
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { after, before, test } from "node:test"
import { fileURLToPath } from "node:url"
import { eq } from "drizzle-orm"
import YAML from "yaml"
import { authAdapter, createAuth } from "@launch-factory/auth"
import { accessLogs, account as accountTable, adminActions, db, session as sessionTable, user as userTable } from "@launch-factory/db"
import { importRegistryFile, installGlueStubs, stubs } from "./registry-glue.mjs"

installGlueStubs({
  auth: ["authPort", "getAuth", "authIO"],
  config: ["PRODUCT_NAME", "DEFAULT_LOCALE", "appUrl"],
  db: ["database"],
  env: ["env", "required"],
  enabled: ["hasPart"],
  features: ["AUTH_FEATURES"],
  security: ["guardAction"],
  "@/content/copy.admin-messages.en": ["adminMessages"],
})

const ROOT = fileURLToPath(new URL("../..", import.meta.url))
const SECRET = "lf-test-secret-not-real-0123456789abcdef"
const BASE_URL = "http://localhost:3000"
const PASSWORD = "Correct-Horse-Battery-9"
const consents = { terms: true, privacy: true, ageOver14: true }
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
let auth
let section
let actions
let current = null
const features = { admin: true, twoFactor: true }
let ipSeq = 0
let emailSeq = 0

/** 쿠키 통 하나 = 브라우저 하나. 요청 머리·응답 쿠키를 그대로 주고받는다 */
function memoryIO(ip = `203.0.113.${100 + ++ipSeq}`) {
  const jar = new Map()
  return {
    ip,
    headers() {
      const h = new Headers({ "x-forwarded-for": ip, "user-agent": "lf-test" })
      if (jar.size) h.set("cookie", [...jar].map(([k, v]) => `${k}=${v}`).join("; "))
      return h
    },
    setCookies(list) {
      for (const line of list) {
        const [pair, ...attrs] = line.split(";")
        const i = pair.indexOf("=")
        const name = pair.slice(0, i).trim()
        const value = pair.slice(i + 1).trim()
        if (attrs.some((a) => /^\s*max-age=0\s*$/i.test(a)) || value === "") jar.delete(name)
        else jar.set(name, value)
      }
    },
  }
}

function totp(base32) {
  return import("node:crypto").then(({ createHmac }) => {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
    let bits = ""
    for (const ch of base32.replace(/=+$/, "").toUpperCase()) bits += alphabet.indexOf(ch).toString(2).padStart(5, "0")
    const key = Buffer.from(bits.match(/.{8}/g).map((b) => parseInt(b, 2)))
    const msg = Buffer.alloc(8)
    msg.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)))
    const h = createHmac("sha1", key).update(msg).digest()
    const o = h[h.length - 1] & 0xf
    return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, "0")
  })
}

async function raw(io, method, path, body) {
  const headers = io.headers()
  headers.set("origin", BASE_URL)
  if (body) headers.set("content-type", "application/json")
  const res = await auth.handler(new Request(BASE_URL + "/api/auth" + path, { method, headers, body: body ? JSON.stringify(body) : undefined }))
  io.setCookies(res.headers.getSetCookie())
  return res
}

/** 가입한 사람. role·2단계는 선택 */
async function person({ role, twoFactor = false, name } = {}) {
  const io = memoryIO()
  const email = `person${++emailSeq}@example.com`
  const port = authAdapter(auth, io, { onError: () => {} })
  const up = await port.signUp({ method: "password", email, password: PASSWORD, consents, ...(name ? { name } : {}) })
  assert.ok(up.ok, JSON.stringify(up))
  const id = (await port.session()).data.userId
  if (twoFactor) {
    const enable = await raw(io, "POST", "/two-factor/enable", { password: PASSWORD })
    const secret = new URL((await enable.json()).totpURI).searchParams.get("secret")
    const ok = await port.verifyTwoFactor({ code: await totp(secret) })
    assert.ok(ok.ok, JSON.stringify(ok))
  }
  if (role) await d.update(userTable).set({ role }).where(eq(userTable.id, id))
  return { io, email, id, port }
}
const login = (p) => (current = p ? p.io : memoryIO())

before(async () => {
  process.env.LF_CLIENT_IP_HEADER = "x-test-ip"
  d = await db.local()
  auth = createAuth({ db: d, secret: SECRET, baseURL: BASE_URL, onError: () => {}, consentVersions: { terms: "t1", privacy: "p1" }, twoFactor: true, admin: true, appName: "LF Test" })
  stubs.config = { PRODUCT_NAME: "Example", DEFAULT_LOCALE: "en", appUrl: () => BASE_URL }
  stubs.db = { database: async () => d }
  stubs.env = { env: () => ({ LF_MODE: "mock" }), required: (n) => `x-${n}` }
  stubs.enabled = { hasPart: () => true }
  stubs.features = { AUTH_FEATURES: features }
  stubs.auth = {
    authPort: async () => authAdapter(auth, current ?? memoryIO(), { onError: () => {} }),
    getAuth: async () => auth,
    authIO: async () => current ?? memoryIO(),
  }
  stubs["next/headers"] = { headers: async () => new Headers({ "x-test-ip": "203.0.113.200" }) }
  stubs["@/content/copy.admin-messages.en"] = { adminMessages: MESSAGES }
  const security = await importRegistryFile("feature-security/files/lib/launch/security.ts")
  stubs.security = { guardAction: (...a) => security.guardAction(...a) }
  section = (await importRegistryFile("feature-auth-betterauth/files/lib/launch/admin-sections/users.ts")).default
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
const bannedOf = async (id) => (await d.select().from(userTable).where(eq(userTable.id, id)))[0].banned

test("구획의 부품 이름은 features/outcomes.yaml 의 부품이고, 템플릿 등록부가 이 구획을 등록한다", () => {
  const parts = Object.keys(YAML.parse(readFileSync(`${ROOT}/features/outcomes.yaml`, "utf8")).parts)
  assert.ok(parts.includes("auth"))
  assert.deepEqual([section.id, section.part], ["users", "auth"])
  const reg = readFileSync(`${ROOT}/template/lib/launch/admin-console.ts`, "utf8")
  assert.match(reg, /import usersSection from "@\/lib\/launch\/admin-sections\/users"/)
  assert.match(reg, /ADMIN_SECTIONS: readonly AdminSection\[\] = \[[^\]]*usersSection/)
})

test("접근 벽 — 로그아웃 · 일반 사용자 · 2단계 없음 · 정지 · 대리 세션은 사용자 명단에 닿지 못한다. 입력의 role 은 읽지 않는다", async () => {
  const target = await person()
  const plain = await person()
  const no2fa = await person({ role: "admin" })
  const bannedBoss = await person({ role: "admin", twoFactor: true })
  await d.update(userTable).set({ banned: true }).where(eq(userTable.id, bannedBoss.id))
  const before = (await d.select().from(adminActions)).length

  const cases = [
    [null, "sign_in_required"],
    [plain, "forbidden"],
    [no2fa, "two_factor_required"],
    [bannedBoss, "forbidden"],
  ]
  for (const [who, code] of cases) {
    login(who)
    for (const call of [() => actions.adminTable({ section: "users" }), () => actions.adminRecord({ section: "users", id: target.id }), () => actions.adminAct({ section: "users", id: target.id, action: "ban", confirmed: true })]) {
      const r = await call()
      assert.equal(r.ok, false)
      assert.equal(r.code, code)
    }
  }
  login(plain)
  assert.equal((await actions.adminAct({ section: "users", id: target.id, action: "ban", confirmed: true, role: "admin", userId: "root", via: "admin" })).code, "forbidden")
  assert.deepEqual(ok((await login(plain), await actions.adminSections())).filter((s) => s.id === "users"), [])

  // 대리 세션: 관리자의 쿠키로 들어와도 그 세션이 대리 세션이면 관리자가 아니다
  const boss = await person({ role: "admin", twoFactor: true })
  await d.update(sessionTable).set({ impersonatedBy: plain.id }).where(eq(sessionTable.userId, boss.id))
  login(boss)
  assert.equal((await actions.adminTable({ section: "users" })).code, "impersonation_blocked")
  await d.update(sessionTable).set({ impersonatedBy: null }).where(eq(sessionTable.userId, boss.id))

  assert.equal(await bannedOf(target.id), false)
  assert.equal((await d.select().from(adminActions)).length, before, "벽에 막힌 요청은 인증 서비스에 닿지 않아 어떤 기록도 남기지 않는다")
})

test("관리자 조각이 꺼져 있으면 관리자여도 열리지 않는다(provider_unavailable) — 구획 목록에서도 사라진다", async () => {
  const boss = await person({ role: "admin", twoFactor: true })
  login(boss)
  features.admin = false
  try {
    assert.equal((await actions.adminTable({ section: "users" })).code, "provider_unavailable")
    assert.deepEqual(ok(await actions.adminSections()).filter((s) => s.id === "users"), [])
  } finally {
    features.admin = true
  }
  assert.ok(ok(await actions.adminSections()).some((s) => s.id === "users"))
})

test("목록·상세 — 이메일·이름은 가려서, 역할·정지·2단계는 그대로. 비밀번호 해시·세션 토큰은 어디에도 없다", async () => {
  const boss = await person({ role: "admin", twoFactor: true })
  const target = await person({ name: "Kim Minsu" })
  const [acc] = await d.select().from(accountTable).where(eq(accountTable.userId, target.id))
  const [sess] = await d.select().from(sessionTable).where(eq(sessionTable.userId, target.id))
  const secrets = [acc.password, sess.token].filter(Boolean)
  assert.ok(secrets.length >= 2, "시험 재료: 해시와 토큰이 실제로 있다")

  login(boss)
  assert.deepEqual(ok(await actions.adminSections()).find((s) => s.id === "users"), { id: "users", label: "Users", href: "/admin/users" })
  const table = ok(await actions.adminTable({ section: "users", search: target.email }))
  assert.equal(table.total, 1)
  const row = table.rows[0]
  assert.equal(row.id, target.id)
  assert.equal(row.cells.email, "p***@example.com")
  assert.equal(row.cells.name, "Kim ***")
  assert.equal(row.cells.role, "user")
  assert.equal(row.cells.status, "active")
  assert.equal(row.cells.twoFactor, "off")
  assert.equal(row.href, `/admin/users/${target.id}`)
  const bossRow = ok(await actions.adminTable({ section: "users", search: boss.email })).rows[0]
  assert.deepEqual([bossRow.cells.role, bossRow.cells.twoFactor], ["admin", "on"])
  assert.doesNotMatch(JSON.stringify(table), new RegExp(`${target.email.replace(".", "\\.")}|Kim Minsu`))

  const rec = ok(await actions.adminRecord({ section: "users", id: target.id }))
  assert.equal(rec.title, `User ${target.id.slice(0, 8)}`)
  const by = Object.fromEntries(rec.summary.filter((s) => s.label !== "Admin action").map((s) => [s.label, s.value]))
  assert.equal(by["Email"], target.email, "전체 이메일은 상세에서만")
  assert.deepEqual([by["Role"], by["Status"], by["2-step sign-in"], by["Active sessions"]], ["user", "active", "off", "1"])
  assert.deepEqual(rec.danger, { id: "ban", label: "Ban user" })
  assert.deepEqual(rec.actions, [], "정지 중이 아니면 해제 단추는 없다")
  for (const s of secrets) {
    assert.ok(!JSON.stringify(table).includes(s) && !JSON.stringify(rec).includes(s), "해시·토큰이 새지 않는다")
  }
  assert.doesNotMatch(JSON.stringify(rec), /password|token|secret/i)

  // 상태 거르기: 정지된 사람만 / 정지 안 된 사람만
  assert.ok(ok(await actions.adminTable({ section: "users", status: "active" })).rows.every((r) => r.cells.status === "active"))
  assert.equal(ok(await actions.adminTable({ section: "users", status: "banned" })).rows.filter((r) => r.id === target.id).length, 0)
  assert.equal((await actions.adminRecord({ section: "users", id: "no-such-user" })).code, "not_found")
  assert.equal((await actions.adminTable({ section: "users", status: "weird" })).code, "invalid_input")
})

test("정지 — 확인 입력 없이는 실행되지 않고, 확인하면 세션이 끊기고 로그인이 막히며, 해제하면 다시 들어온다. 두 번 눌러도 한 번", async () => {
  const boss = await person({ role: "admin", twoFactor: true })
  const target = await person()
  login(boss)
  for (const confirmed of [undefined, false, "true", 1]) {
    const r = await actions.adminAct({ section: "users", id: target.id, action: "ban", ...(confirmed === undefined ? {} : { confirmed }) })
    assert.equal(r.ok, false, String(confirmed))
    assert.ok(["confirmation_required", "invalid_input"].includes(r.code), String(confirmed))
  }
  assert.equal(await bannedOf(target.id), false)

  const done = await actions.adminAct({ section: "users", id: target.id, action: "ban", confirmed: true })
  assert.equal(done.ok, true, JSON.stringify(done))
  assert.equal(await bannedOf(target.id), true)
  assert.deepEqual(await target.port.session(), { ok: true, data: null }, "정지되면 세션이 끊긴다")

  const again = await actions.adminAct({ section: "users", id: target.id, action: "ban", confirmed: true })
  assert.deepEqual([again.ok, again.code], [false, "invalid_state"], "두 번 눌러도 한 번")
  const rec = ok(await actions.adminRecord({ section: "users", id: target.id }))
  assert.equal(rec.danger, undefined, "정지 중이면 정지 단추는 없다")
  assert.deepEqual(rec.actions, [{ id: "unban", label: "Lift ban" }])
  assert.ok(ok(await actions.adminTable({ section: "users", status: "banned" })).rows.some((r) => r.id === target.id))
  assert.equal((await actions.adminAct({ section: "users", id: boss.id, action: "unban" })).code, "invalid_state", "정지 중이 아닌 사람은 해제할 수 없다")

  ok(await actions.adminAct({ section: "users", id: target.id, action: "unban" }))
  assert.equal(await bannedOf(target.id), false)
  assert.equal((await target.port.signIn({ method: "password", email: target.email, password: PASSWORD })).ok, true)

  // 기록: 콘솔의 행동 기록 + 인증 서비스의 정지/해제 기록. 이메일·폼 값은 콘솔 기록에 없다
  const rows = await d.select().from(adminActions)
  const mine = rows.filter((r) => r.adminUserId === boss.id)
  assert.ok(mine.some((r) => r.action === "users.ban" && r.meta.recordId === target.id && r.meta.ok === true))
  assert.ok(mine.some((r) => r.action === "users.unban" && r.meta.recordId === target.id))
  assert.ok(mine.some((r) => r.action === "ban" && r.targetUserId === target.id), "인증 서비스 쪽 기록")
  assert.doesNotMatch(JSON.stringify(rows.filter((r) => r.action.startsWith("users."))), /@example\.com/)
  const access = await d.select().from(accessLogs)
  assert.ok(access.some((r) => r.actorId === boss.id && r.target === "admin/users/table"))
  assert.ok(access.some((r) => r.actorId === boss.id && r.target === "admin/users/record" && r.subjects.join() === target.id))
  assert.doesNotMatch(JSON.stringify(access), /@example\.com/)
})

test("자기 자신은 정지할 수 없다 — 인증 서비스의 거절이 invalid_state 로 나가고 상태는 그대로", async () => {
  const boss = await person({ role: "admin", twoFactor: true })
  login(boss)
  const r = await actions.adminAct({ section: "users", id: boss.id, action: "ban", confirmed: true })
  assert.deepEqual([r.ok, r.code], [false, "invalid_state"])
  assert.match(r.formError, /yourself|own/i)
  assert.equal(await bannedOf(boss.id), false)
  assert.equal((await actions.adminTable({ section: "users" })).ok, true, "자기 정지가 거절돼도 세션은 그대로다")
})
