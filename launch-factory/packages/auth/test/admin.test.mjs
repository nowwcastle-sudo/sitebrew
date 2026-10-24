// @launch-factory/auth — 관리자 서버 액션·관리자 벽·대리 로그인·행동 기록·CSV(v0 Task 16).
// 실제 Better Auth 1.7.6(admin·twoFactor 플러그인, PGlite 메모리 DB)로 돈다. 결제는 가짜 포트. 네트워크 없음.
import { test, before, after } from "node:test"
import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import { and, eq, sql } from "drizzle-orm"
import { accountDeletions, adminActions as adminActionsTable, db, session as sessionTable, user } from "@launch-factory/db"
import { exportMyData, requestAccountDeletion } from "@launch-factory/account-lifecycle"
import { messages } from "@launch-factory/i18n"
import {
  ADMIN_ACTION,
  AUTH_MESSAGES,
  BILLING_READS,
  CSV_BOM,
  EXPORT_MAX_ROWS,
  IMPERSONATION_BLOCKED_PATHS,
  adminActions,
  authAdapter,
  blockWhileImpersonating,
  createAuth,
  csvCell,
  seoulDateTime,
  toCsv,
} from "../src/index.ts"

// 고정 시험값 — 실제 비밀이 아니다.
const SECRET = "lf-test-secret-not-real-0123456789abcdef"
const BASE_URL = "http://localhost:3000"
const PASSWORD = "Correct-Horse-Battery-9"
const consents = { terms: true, privacy: true, ageOver14: true }
const A = AUTH_MESSAGES.admin

/** @type {Awaited<ReturnType<typeof db.local>>} */
let d
/** @type {ReturnType<typeof createAuth>} */
let auth
const errors = []
before(async () => {
  d = await db.local()
  auth = createAuth({ db: d, secret: SECRET, baseURL: BASE_URL, onError: (e) => errors.push(e), consentVersions: { terms: "t1", privacy: "p1" }, twoFactor: true, admin: true, appName: "LF Test" })
})
after(async () => {
  await d?.$client.close()
})

let ipSeq = 0
let emailSeq = 0
function memoryIO(ip = `203.0.113.${++ipSeq}`) {
  const jar = new Map()
  return {
    ip,
    jar,
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

function totp(base32, step = Math.floor(Date.now() / 30000)) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
  let bits = ""
  for (const ch of base32.replace(/=+$/, "").toUpperCase()) bits += alphabet.indexOf(ch).toString(2).padStart(5, "0")
  const key = Buffer.from(bits.match(/.{8}/g).map((b) => parseInt(b, 2)))
  const msg = Buffer.alloc(8)
  msg.writeBigUInt64BE(BigInt(step))
  const h = createHmac("sha1", key).update(msg).digest()
  const o = h[h.length - 1] & 0xf
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, "0")
}

/** Better Auth 경로를 바로 부른다(템플릿이 /api/auth/* 를 여는 길 — 서버 액션을 건너뛴 호출) */
async function raw(io, method, path, body) {
  const headers = io.headers()
  headers.set("origin", BASE_URL)
  if (body) headers.set("content-type", "application/json")
  const res = await auth.handler(new Request(BASE_URL + "/api/auth" + path, { method, headers, body: body ? JSON.stringify(body) : undefined }))
  io.setCookies(res.headers.getSetCookie())
  return res
}

/** 가입한 사용자. role·2단계는 선택 */
async function person({ role, twoFactor = false, account } = {}) {
  const io = memoryIO()
  const email = `person${++emailSeq}@example.com`
  const port = authAdapter(auth, io, { onError: () => {}, account })
  const up = await port.signUp({ method: "password", email, password: PASSWORD, consents })
  assert.ok(up.ok, JSON.stringify(up))
  const id = (await port.session()).data.userId
  if (twoFactor) {
    const enable = await raw(io, "POST", "/two-factor/enable", { password: PASSWORD })
    const secret = new URL((await enable.json()).totpURI).searchParams.get("secret")
    const ok = await port.verifyTwoFactor({ code: totp(secret) })
    assert.ok(ok.ok, JSON.stringify(ok))
  }
  if (role) await d.update(user).set({ role }).where(eq(user.id, id))
  const actions = adminActions({ auth, db: d, io, onError: (e) => errors.push(e) })
  return { io, email, id, port, actions }
}
const admin = () => person({ role: "admin", twoFactor: true })
const logOf = (where) => d.select().from(adminActionsTable).where(where)

test("설정: admin 조각은 2단계 조각 없이 켤 수 없다", () => {
  assert.throws(() => createAuth({ db: d, secret: SECRET, baseURL: BASE_URL, consentVersions: { terms: "t1", privacy: "p1" }, admin: true }), /admin needs twoFactor/)
})

test("관리자 벽: 로그인 안 함 401 · 일반 사용자 403 · 2단계를 안 켠 관리자 403 · 대리 세션 403 — 서버 액션 전부와 /api/auth/admin/* 직접 호출 모두", async () => {
  const target = await person()
  const before = (await d.select().from(adminActionsTable)).length
  const calls = (a) => [
    a.listUsers({}),
    a.userDetail({ userId: target.id }),
    a.banUser({ userId: target.id }),
    a.unbanUser({ userId: target.id }),
    a.bulkBan({ userIds: [target.id] }),
    a.bulkUnban({ userIds: [target.id] }),
    a.impersonate({ userId: target.id, reason: "support" }),
    a.exportUsersCsv({}),
  ]

  const anonIO = memoryIO()
  for (const r of await Promise.all(calls(adminActions({ auth, db: d, io: anonIO })))) assert.deepEqual(r, { ok: false, status: 401, code: "unauthenticated", formError: AUTH_MESSAGES.signInRequired })

  const plain = await person()
  for (const r of await Promise.all(calls(plain.actions))) assert.deepEqual(r, { ok: false, status: 403, code: "admin_required", formError: A.adminRequired })

  // 2단계를 켠 일반 사용자도 관리자가 아니다
  const plain2fa = await person({ twoFactor: true })
  for (const r of await Promise.all(calls(plain2fa.actions))) assert.equal(r.code, "admin_required")

  const no2fa = await person({ role: "admin" })
  for (const r of await Promise.all(calls(no2fa.actions))) assert.deepEqual(r, { ok: false, status: 403, code: "admin_two_factor_required", formError: A.twoFactorRequired })

  // 서버 액션을 건너뛰고 Better Auth 경로를 바로 불러도 같은 벽이다
  const direct = await raw(no2fa.io, "POST", "/admin/ban-user", { userId: target.id })
  assert.equal(direct.status, 403)
  assert.equal((await direct.json()).code, "ADMIN_TWO_FACTOR_REQUIRED")
  const directPlain = await raw(plain.io, "POST", "/admin/impersonate-user", { userId: target.id, reason: "x" })
  assert.equal(directPlain.status, 403)
  assert.equal((await directPlain.json()).code, "ADMIN_REQUIRED")
  const [t] = await d.select().from(user).where(eq(user.id, target.id))
  assert.equal(t.banned, false)
  assert.equal((await d.select().from(sessionTable).where(and(eq(sessionTable.userId, target.id), sql`${sessionTable.impersonatedBy} is not null`))).length, 0)
  // 막힌 시도는 기록이 없다(일어나지 않았다)
  assert.equal((await d.select().from(adminActionsTable)).length, before)

  // 양성 대조: role=admin + 2단계 켬이면 통과한다
  const boss = await admin()
  const list = await boss.actions.listUsers({})
  assert.equal(list.ok, true, JSON.stringify(list))
  // 세션 주인이 role=admin + 2단계 켬이어도, 그 세션이 대리 세션(impersonated_by 있음)이면 관리자가 아니다.
  // 대리 시작 경로로는 이 조합이 안 만들어지므로(다른 관리자는 대리 불가) session.impersonated_by 를 DB 로 직접 넣는다.
  const own = eq(sessionTable.userId, boss.id)
  await d.update(sessionTable).set({ impersonatedBy: plain.id }).where(own)
  for (const r of await Promise.all(calls(boss.actions))) assert.equal(r.code, "admin_required")
  const impersonatedDirect = await raw(boss.io, "POST", "/admin/ban-user", { userId: target.id })
  assert.equal(impersonatedDirect.status, 403)
  assert.equal((await impersonatedDirect.json()).code, "ADMIN_REQUIRED")
  assert.equal((await d.select().from(user).where(eq(user.id, target.id)))[0].banned, false)
  await d.update(sessionTable).set({ impersonatedBy: null }).where(own)
  assert.equal((await boss.actions.listUsers({})).ok, true, "표시를 지우면 다시 통과한다(양성 대조)")
  // v0 범위 밖 admin 경로(지우기·역할 바꾸기·비밀번호 설정·만들기·목록)는 관리자에게도 닫혀 있다
  for (const [path, body] of [
    ["/admin/remove-user", { userId: target.id }],
    ["/admin/set-role", { userId: plain.id, role: "admin" }],
    ["/admin/set-user-password", { userId: target.id, newPassword: "Another-Password-1" }],
    ["/admin/create-user", { email: "made@example.com", password: "Another-Password-1", name: "m" }],
    ["/admin/list-users", undefined],
  ]) {
    const r = await raw(boss.io, body ? "POST" : "GET", path, body)
    assert.equal(r.status, 403, path)
    assert.equal((await r.json()).code, "ADMIN_ENDPOINT_DISABLED", path)
  }
  assert.equal((await d.select().from(user).where(eq(user.id, target.id))).length, 1)
  assert.equal((await d.select().from(user).where(eq(user.id, plain.id)))[0].role, "user")
})

test("정지·해제: 세션이 끊기고 로그인이 막힌다 → 해제하면 다시 로그인 · 누가·누구를·무엇을·언제·IP 기록 · 자기 자신 정지 불가 · 일괄", async () => {
  const boss = await admin()
  const target = await person()
  const at = Date.now()
  assert.deepEqual(await boss.actions.banUser({ userId: target.id, reason: "spam", confirmed: true }), { ok: true, data: { userId: target.id } })
  // 정지된 사용자: 세션이 끊겼고 다시 로그인하지 못한다
  assert.deepEqual(await target.port.session(), { ok: true, data: null })
  assert.deepEqual(await target.port.signIn({ method: "password", email: target.email, password: PASSWORD }), { ok: false, formError: AUTH_MESSAGES.accountSuspended })
  const direct = await raw(memoryIO(), "POST", "/sign-in/email", { email: target.email, password: PASSWORD })
  assert.equal(direct.status, 403)
  assert.equal((await direct.json()).code, "BANNED_USER")

  const [ban] = await logOf(and(eq(adminActionsTable.targetUserId, target.id), eq(adminActionsTable.action, ADMIN_ACTION.ban)))
  assert.equal(ban.adminUserId, boss.id)
  assert.equal(ban.ipAddress, boss.io.ip)
  assert.equal(ban.reason, "spam")
  assert.equal(ban.meta.via, "server-action")
  assert.ok(ban.occurredAt.getTime() >= at - 1000 && ban.occurredAt.getTime() <= Date.now() + 1000)

  assert.deepEqual(await boss.actions.unbanUser({ userId: target.id, reason: "appeal" }), { ok: true, data: { userId: target.id } })
  assert.deepEqual(await target.port.signIn({ method: "password", email: target.email, password: PASSWORD }), { ok: true, data: {} })
  const [unban] = await logOf(and(eq(adminActionsTable.targetUserId, target.id), eq(adminActionsTable.action, ADMIN_ACTION.unban)))
  assert.deepEqual([unban.adminUserId, unban.ipAddress, unban.reason], [boss.id, boss.io.ip, "appeal"])

  assert.deepEqual(await boss.actions.banUser({ userId: boss.id, confirmed: true }), { ok: false, status: 400, code: "cannot_ban_self", formError: A.cannotBanSelf })
  assert.equal((await boss.actions.banUser({ userId: "no-such-user", confirmed: true })).code, "not_found")
  assert.equal((await logOf(eq(adminActionsTable.targetUserId, boss.id))).length, 0)
  assert.equal((await boss.actions.banUser({ userId: target.id, extra: 1 })).code, "invalid_input")

  // 일괄 정지·되돌리기: 사람마다 결과, 사람마다 기록(같은 bulkId)
  const u1 = await person()
  const u2 = await person()
  const bulk = await boss.actions.bulkBan({ userIds: [u1.id, u2.id, u2.id, "no-such-user"], reason: "wave", confirmed: true })
  assert.equal(bulk.ok, true)
  assert.deepEqual(bulk.data.succeeded, [u1.id, u2.id])
  assert.deepEqual(bulk.data.failed, [{ userId: "no-such-user", code: "not_found" }])
  const bulkRows = await d.select().from(adminActionsTable).where(sql`${adminActionsTable.meta}->>'bulkId' = ${bulk.data.bulkId}`)
  assert.deepEqual(bulkRows.map((r) => r.targetUserId).sort(), [u1.id, u2.id].sort())
  assert.ok(bulkRows.every((r) => r.action === ADMIN_ACTION.ban && r.reason === "wave"))
  const undo = await boss.actions.bulkUnban({ userIds: [u1.id, u2.id] })
  assert.deepEqual(undo.data.succeeded, [u1.id, u2.id])
  assert.equal((await d.select().from(user).where(eq(user.id, u2.id)))[0].banned, false)
  assert.equal((await boss.actions.bulkBan({ userIds: Array.from({ length: 101 }, (_, i) => `u${i}`) })).code, "invalid_input")
})

test("정지·일괄 정지는 사람 확인(confirmed: true) 없이는 실행하지 않는다 — 서버 액션과 콘솔 구획이 같은 벽을 지난다 · 해제는 확인 없이도 된다", async () => {
  const boss = await admin()
  const target = await person()
  const u1 = await person()
  const before = (await d.select().from(adminActionsTable)).length
  const expected = { ok: false, status: 400, code: "confirmation_required", formError: A.confirmationRequired, retryable: false }
  assert.deepEqual(await boss.actions.banUser({ userId: target.id }), expected)
  // true 가 아닌 값(false · "true" · 1)은 확인이 아니다 — 입력 모양 검사에서 막힌다
  for (const confirmed of [false, "true", 1]) assert.equal((await boss.actions.banUser({ userId: target.id, confirmed })).code, "invalid_input")
  assert.deepEqual(await boss.actions.bulkBan({ userIds: [u1.id] }), expected)
  assert.equal((await d.select().from(user).where(eq(user.id, target.id)))[0].banned, false, "확인 없이는 정지되지 않는다")
  assert.equal((await d.select().from(user).where(eq(user.id, u1.id)))[0].banned, false)
  assert.equal((await d.select().from(adminActionsTable)).length, before, "막힌 요청은 기록도 남기지 않는다")
  assert.deepEqual(await boss.actions.banUser({ userId: target.id, confirmed: true }), { ok: true, data: { userId: target.id } })
  assert.deepEqual(await boss.actions.unbanUser({ userId: target.id }), { ok: true, data: { userId: target.id } })
  assert.equal((await boss.actions.bulkUnban({ userIds: [u1.id] })).ok, true)
})

test("대리 로그인: 사유 필수 · 시작·종료가 기록된다 · 세션에 impersonatedBy · 대리 중에는 관리자 기능 불가 · 다른 관리자는 대리 불가 · 로그아웃도 종료로 남는다", async () => {
  const boss = await admin()
  const target = await person()
  const other = await admin()

  assert.deepEqual(await boss.actions.impersonate({ userId: target.id }), { ok: false, status: 400, code: "reason_required", formError: A.reasonRequired, fieldErrors: { reason: [A.reasonRequired] } })
  const noReason = await raw(boss.io, "POST", "/admin/impersonate-user", { userId: target.id })
  assert.equal(noReason.status, 400)
  assert.equal((await noReason.json()).code, "IMPERSONATION_REASON_REQUIRED")
  assert.equal((await boss.actions.impersonate({ userId: other.id, reason: "check" })).code, "cannot_impersonate_admin")
  assert.equal((await logOf(eq(adminActionsTable.action, ADMIN_ACTION.impersonateStart))).filter((r) => r.adminUserId === boss.id).length, 0)

  const started = await boss.actions.impersonate({ userId: target.id, reason: "ticket #42" })
  assert.equal(started.ok, true, JSON.stringify(started))
  assert.ok(Date.parse(started.data.expiresAt) > Date.now() + 59 * 60 * 1000)
  // 이 브라우저는 이제 대상 사용자의 대리 세션이다 — 화면은 impersonatedBy 로 띠를 띄운다
  const viewer = authAdapter(auth, boss.io, { onError: () => {} })
  const s = await viewer.session()
  assert.equal(s.data.userId, target.id)
  assert.equal(s.data.impersonatedBy, boss.id)
  // 대상 본인의 세션에는 표시가 없다
  assert.equal((await target.port.session()).data.impersonatedBy, undefined)
  const [start] = await logOf(and(eq(adminActionsTable.action, ADMIN_ACTION.impersonateStart), eq(adminActionsTable.adminUserId, boss.id)))
  assert.deepEqual([start.targetUserId, start.ipAddress, start.reason], [target.id, boss.io.ip, "ticket #42"])
  assert.equal(start.meta.expiresAt, started.data.expiresAt)

  // 대리 세션으로는 관리자 기능을 못 쓴다
  assert.equal((await boss.actions.listUsers({})).code, "admin_required")

  const stopped = await boss.actions.stopImpersonating()
  assert.deepEqual(stopped, { ok: true, data: { adminUserId: boss.id } })
  assert.equal((await viewer.session()).data.userId, boss.id)
  assert.equal((await viewer.session()).data.impersonatedBy, undefined)
  const stops = await logOf(and(eq(adminActionsTable.action, ADMIN_ACTION.impersonateStop), eq(adminActionsTable.adminUserId, boss.id)))
  assert.equal(stops.length, 1)
  assert.deepEqual([stops[0].targetUserId, stops[0].ipAddress, stops[0].meta.via], [target.id, boss.io.ip, "stop"])
  assert.deepEqual(await boss.actions.stopImpersonating(), { ok: false, status: 400, code: "not_impersonating", formError: A.notImpersonating })
  assert.equal((await boss.actions.listUsers({})).ok, true, "관리자 세션으로 돌아왔다")

  // 대리 중 로그아웃도 종료로 남긴다
  assert.ok((await boss.actions.impersonate({ userId: target.id, reason: "again" })).ok)
  assert.ok((await viewer.signOut()).ok)
  const viaSignOut = await logOf(and(eq(adminActionsTable.action, ADMIN_ACTION.impersonateStop), eq(adminActionsTable.adminUserId, boss.id)))
  assert.deepEqual(viaSignOut.map((r) => r.meta.via).sort(), ["sign-out", "stop"])
})

test("대리 로그인 중에는 결제·탈퇴·비밀번호·이메일·2단계·세션 끊기를 막는다(서버 액션과 Better Auth 경로 모두) — 본인이면 된다", async () => {
  const boss = await admin()
  const calls = { requestDeletion: 0, exportData: 0 }
  const account = {
    requestDeletion: async () => (calls.requestDeletion++, { ok: true, graceUntil: new Date().toISOString(), alreadyRequested: false }),
    exportData: async () => (calls.exportData++, { profile: {} }),
  }
  const target = await person({ account })
  assert.ok((await boss.actions.impersonate({ userId: target.id, reason: "billing question" })).ok)
  const asTarget = authAdapter(auth, boss.io, { onError: () => {}, account })
  const session = (await asTarget.session()).data
  assert.equal(session.impersonatedBy, boss.id)

  // 셀프 탈퇴·내려받기(어댑터): 처리기를 부르지 않는다
  assert.deepEqual(await asTarget.deleteAccount(), { ok: false, formError: AUTH_MESSAGES.impersonationBlocked })
  assert.deepEqual(await asTarget.exportMyData(), { ok: false, formError: AUTH_MESSAGES.impersonationBlocked })
  assert.deepEqual(calls, { requestDeletion: 0, exportData: 0 })

  // 결제 포트: 읽기만 통과, 나머지는 부르지 않는다(새 메서드도 기본으로 막힌다)
  const hit = []
  const fakeBilling = Object.fromEntries(
    ["plans", "subscription", "checkout", "changePlan", "cancel", "pause", "resume", "updatePaymentMethod", "acceptPriceChange", "applyRetentionOffer", "futureMethod"].map((m) => [m, async () => (hit.push(m), { ok: true, data: m })]),
  )
  const guarded = blockWhileImpersonating(fakeBilling, session, BILLING_READS)
  for (const m of ["checkout", "changePlan", "cancel", "pause", "resume", "updatePaymentMethod", "acceptPriceChange", "applyRetentionOffer", "futureMethod"]) {
    assert.deepEqual(await guarded[m]({ planId: "pro" }), { ok: false, status: 403, code: "impersonation_blocked", formError: AUTH_MESSAGES.impersonationBlocked }, m)
  }
  assert.deepEqual(await guarded.subscription(), { ok: true, data: "subscription" })
  assert.deepEqual(await guarded.plans(), { ok: true, data: "plans" })
  assert.deepEqual(hit, ["subscription", "plans"])
  // 본인 세션이면 그대로 통과(같은 객체)
  assert.equal(blockWhileImpersonating(fakeBilling, (await target.port.session()).data, BILLING_READS), fakeBilling)
  assert.equal(blockWhileImpersonating(fakeBilling, null, BILLING_READS), fakeBilling)
  // 문구 언어
  assert.equal((await blockWhileImpersonating(fakeBilling, session, BILLING_READS, "ko").checkout()).formError, messages("ko").auth.impersonationBlocked)

  // Better Auth 경로(템플릿이 /api/auth/* 로 연다): 자격 증명·탈퇴·세션 끊기
  const tries = [
    ["/change-password", { currentPassword: PASSWORD, newPassword: "Hijacked-Password-1", revokeOtherSessions: true }],
    ["/change-email", { newEmail: "attacker@example.com" }],
    ["/delete-user", { password: PASSWORD }],
    ["/two-factor/enable", { password: PASSWORD }],
    ["/two-factor/disable", { password: PASSWORD }],
    ["/revoke-sessions", {}],
    ["/revoke-other-sessions", {}],
    ["/unlink-account", { providerId: "credential" }],
  ]
  for (const [path, body] of tries) {
    assert.ok(IMPERSONATION_BLOCKED_PATHS.includes(path), path)
    const r = await raw(boss.io, "POST", path, body)
    assert.equal(r.status, 403, path)
    assert.equal((await r.json()).code, "IMPERSONATION_BLOCKED", path)
  }
  // 막혔으니 대상의 비밀번호·이메일·세션은 그대로다
  assert.equal((await target.port.session()).data.userId, target.id)
  const [t] = await d.select().from(user).where(eq(user.id, target.id))
  assert.equal(t.email, target.email)
  const again = authAdapter(auth, memoryIO(), { onError: () => {} })
  assert.deepEqual(await again.signIn({ method: "password", email: target.email, password: PASSWORD }), { ok: true, data: {} })
  assert.ok((await boss.actions.stopImpersonating()).ok)

  // 양성 대조: 본인 세션이면 같은 경로가 막히지 않는다(비밀번호를 바꾼다)
  const own = await raw(target.io, "POST", "/change-password", { currentPassword: PASSWORD, newPassword: "Owner-New-Password-1" })
  assert.equal(own.status, 200)
  assert.equal((await target.port.session()).data.userId, target.id)
})

test("대리 로그인은 대상의 탈퇴 유예를 취소하지 않는다(본인 로그인만 취소) — Task 14 훅과의 상호작용", async () => {
  const boss = await admin()
  const billing = { subscription: async () => ({ ok: true, data: { planId: "free", status: "none" } }), cancel: async () => ({ ok: true, data: {} }) }
  const account = { requestDeletion: (userId) => requestAccountDeletion({ db: d, billingFor: () => billing }, userId), exportData: (userId) => exportMyData(d, userId) }
  const target = await person({ account })
  assert.ok((await target.port.deleteAccount()).ok)
  const status = async () => (await d.select().from(accountDeletions).where(eq(accountDeletions.userId, target.id))).map((r) => r.status)
  assert.deepEqual(await status(), ["pending"])
  assert.ok((await boss.actions.impersonate({ userId: target.id, reason: "deletion question" })).ok)
  assert.deepEqual(await status(), ["pending"], "대리 로그인이 탈퇴를 취소하면 안 된다")
  assert.ok((await boss.actions.stopImpersonating()).ok)
  assert.deepEqual(await status(), ["pending"])
  // 양성 대조: 본인이 로그인하면 취소된다
  assert.ok((await target.port.signIn({ method: "password", email: target.email, password: PASSWORD })).ok)
  assert.deepEqual(await status(), ["cancelled"])
})

test("대리 로그인 시작을 기록하지 못하면 대리 세션을 남기지 않고 실패한다(기록 없는 대리 로그인 금지)", async () => {
  const boss = await admin()
  const target = await person()
  await d.execute(sql.raw(`CREATE FUNCTION lf_test_fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'audit down'; END $$`))
  await d.execute(sql.raw(`CREATE TRIGGER lf_test_fail_audit BEFORE INSERT ON admin_actions FOR EACH ROW WHEN (NEW.action = 'impersonate_start') EXECUTE FUNCTION lf_test_fail_audit()`))
  try {
    const n = errors.length
    const r = await boss.actions.impersonate({ userId: target.id, reason: "audit down" })
    assert.equal(r.ok, false)
    assert.equal(r.code, "unavailable")
    assert.ok(errors.length > n)
    const live = await d.select().from(sessionTable).where(and(eq(sessionTable.userId, target.id), sql`${sessionTable.impersonatedBy} is not null`))
    assert.equal(live.length, 0, "대리 세션이 남으면 안 된다")
    assert.equal((await authAdapter(auth, boss.io, { onError: () => {} }).session()).data?.userId === target.id, false)
  } finally {
    await d.execute(sql.raw(`DROP TRIGGER lf_test_fail_audit ON admin_actions`))
    await d.execute(sql.raw(`DROP FUNCTION lf_test_fail_audit()`))
  }
})

test("admin_actions 는 추가 전용이다(UPDATE·TRUNCATE·1년 안 DELETE 거부)", async () => {
  await d.insert(adminActionsTable).values({ adminUserId: "a", action: "ban", targetUserId: "t" })
  const fails = async (q) => {
    try {
      await d.execute(sql.raw(q))
      return "no-error"
    } catch (e) {
      return String(e.cause?.message ?? e.message)
    }
  }
  assert.match(await fails(`update admin_actions set reason = 'x'`), /append-only/)
  assert.match(await fails(`delete from admin_actions where admin_user_id = 'a'`), /younger than 1 year/)
  assert.match(await fails(`truncate admin_actions`), /append-only/)
})

test("사용자 목록: 검색·필터·정렬·쪽 — 정렬 값이 같아도 쪽 순서가 안정적이다(id 로 묶음, 빠짐·겹침 없음) · 검색어는 기록에 싣지 않는다", async () => {
  const boss = await admin()
  // 같은 가입 시각·같은 이름을 일부러 겹친다. id·email 은 ASCII 소문자(정렬 규칙 차이를 없앤다)
  const t0 = new Date("2026-01-01T00:00:00Z")
  const rows = Array.from({ length: 23 }, (_, i) => ({
    id: `pg-${String(i).padStart(3, "0")}`,
    name: `pgname-${i % 3}`,
    email: `pg-${String((i * 7) % 23).padStart(3, "0")}@list.example.com`,
    emailVerified: false,
    createdAt: new Date(t0.getTime() + Math.floor(i / 4) * 1000),
    updatedAt: t0,
    banned: i % 5 === 0,
    role: i === 22 ? "admin" : "user",
  }))
  await d.insert(user).values(rows)
  const q = "list.example.com"
  const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0)
  const expected = (field, dir) => {
    const key = (r) => (field === "createdAt" ? r.createdAt.getTime() : r[field])
    const s = dir === "asc" ? 1 : -1
    return [...rows].sort((a, b) => s * (cmp(key(a), key(b)) || cmp(a.id, b.id))).map((r) => r.id)
  }
  for (const [field, dir] of [["createdAt", "desc"], ["createdAt", "asc"], ["name", "asc"], ["name", "desc"], ["email", "asc"]]) {
    const seen = []
    let pageCount = 1
    for (let page = 1; page <= pageCount; page++) {
      const r = await boss.actions.listUsers({ q, sort: { field, dir }, page, pageSize: 5 })
      assert.equal(r.ok, true, JSON.stringify(r))
      assert.equal(r.data.total, 23)
      pageCount = r.data.pageCount
      seen.push(...r.data.rows.map((x) => x.id))
    }
    assert.equal(pageCount, 5)
    assert.deepEqual(seen, expected(field, dir), `${field} ${dir}`)
  }
  // 기본: 가입 최신순, 25개
  const def = await boss.actions.listUsers({ q })
  assert.deepEqual(def.data.query, { q, filter: {}, sort: { field: "createdAt", dir: "desc" }, page: 1, pageSize: 25 })
  assert.deepEqual(def.data.rows.map((r) => r.id), expected("createdAt", "desc"))
  // 필터(FormData 로도)
  const banned = await boss.actions.listUsers({ q, filter: { banned: true } })
  assert.deepEqual(banned.data.rows.map((r) => r.id).sort(), rows.filter((r) => r.banned).map((r) => r.id))
  const fd = new FormData()
  fd.set("q", q)
  fd.set("filter.role", "admin")
  const admins = await boss.actions.listUsers(fd)
  assert.deepEqual(admins.data.rows.map((r) => [r.id, r.isAdmin]), [["pg-022", true]])
  // 검색: 대소문자 무시, % _ 는 글자 그대로
  assert.equal((await boss.actions.listUsers({ q: "PGNAME-1" })).data.total, 8)
  assert.equal((await boss.actions.listUsers({ q: "pg%name" })).data.total, 0)
  assert.equal((await boss.actions.listUsers({ q: "pg_000" })).data.total, 0)
  assert.equal((await boss.actions.listUsers({ q: "pg-005" })).data.rows[0].id, "pg-005")
  // 끝을 지난 쪽은 빈 목록(오류 아님), 모양이 틀리면 400
  assert.deepEqual((await boss.actions.listUsers({ q, page: 9, pageSize: 5 })).data.rows, [])
  for (const bad of [{ pageSize: 101 }, { page: 0 }, { sort: { field: "password", dir: "asc" } }, { filter: { plan: "pro" } }, { q: "x".repeat(101) }, { extra: true }]) {
    const r = await boss.actions.listUsers(bad)
    assert.equal(r.code, "invalid_input", JSON.stringify(bad))
    assert.equal(r.status, 400)
  }
  const logs = await logOf(and(eq(adminActionsTable.adminUserId, boss.id), eq(adminActionsTable.action, ADMIN_ACTION.userList)))
  assert.ok(logs.length >= 10)
  assert.ok(logs.every((l) => l.meta.hasQuery === true && l.ipAddress === boss.io.ip))
  for (const l of logs) assert.doesNotMatch(JSON.stringify(l), /list\.example|pgname|PGNAME|pg%|pg_0|pg-005/, "검색어를 싣지 않는다")
})

test("사용자 상세: 구독 상태(결제 포트, 읽기 전용) · 세션 수 · 최근 관리자 행동 · 보기도 기록", async () => {
  const boss = await admin()
  const target = await person()
  await boss.actions.banUser({ userId: target.id, reason: "r1", confirmed: true })
  await boss.actions.unbanUser({ userId: target.id })
  const sub = { planId: "pro", status: "active" }
  const withBilling = adminActions({ auth, db: d, io: boss.io, subscriptionOf: async (id) => (id === target.id ? { ok: true, data: sub } : { ok: false }) })
  const r = await withBilling.userDetail({ userId: target.id })
  assert.equal(r.ok, true, JSON.stringify(r))
  assert.deepEqual(r.data.subscription, sub)
  assert.equal(r.data.subscriptionError, undefined)
  assert.equal(r.data.user.email, target.email)
  assert.deepEqual(r.data.recentActions.map((a) => a.action).sort(), [ADMIN_ACTION.ban, ADMIN_ACTION.unban])
  assert.ok(r.data.recentActions.every((a) => a.adminUserId === boss.id))
  assert.deepEqual(r.data.sessions, { active: 0, impersonation: 0 }) // 정지가 세션을 끊었다

  const none = await boss.actions.userDetail({ userId: target.id })
  assert.deepEqual([none.data.subscription, none.data.subscriptionError], [null, "billing_not_configured"])
  const broken = adminActions({ auth, db: d, io: boss.io, onError: () => {}, subscriptionOf: async () => { throw new Error("paddle down") } })
  assert.equal((await broken.userDetail({ userId: target.id })).data.subscriptionError, "billing_unavailable")
  assert.equal((await boss.actions.userDetail({ userId: "no-such-user" })).code, "not_found")
  const views = await logOf(and(eq(adminActionsTable.action, ADMIN_ACTION.userView), eq(adminActionsTable.targetUserId, target.id)))
  assert.equal(views.length, 3)
})

// ── CSV(대장 D90) ─────────────────────────────────────────────────────────────
function parseCsv(body) {
  const out = []
  let row = []
  let cell = ""
  let quoted = false
  for (let i = 0; i < body.length; i++) {
    const c = body[i]
    if (quoted) {
      if (c === '"' && body[i + 1] === '"') {
        cell += '"'
        i++
      } else if (c === '"') quoted = false
      else cell += c
    } else if (c === '"') quoted = true
    else if (c === ",") {
      row.push(cell)
      cell = ""
    } else if (c === "\r" && body[i + 1] === "\n") {
      row.push(cell)
      out.push(row)
      row = []
      cell = ""
      i++
    } else cell += c
  }
  return out
}

test("CSV 칸: 수식 시작 문자(= + - @ 탭 CR)에 작은따옴표 · RFC 4180 따옴표 · 서울 시각 · BOM", () => {
  for (const s of ["=1+1", "+1", "-2", "@SUM(A1)", "\tx", "\rx", '=HYPERLINK("http://evil","x")']) assert.ok(csvCell(s).replace(/^"/, "").startsWith("'"), s)
  // 양성 대조: 평범한 값은 그대로
  for (const s of ["hello", "1", "a=b", " =x", "홍길동"]) assert.equal(csvCell(s), s)
  assert.equal(csvCell('say "hi", ok'), '"say ""hi"", ok"')
  assert.equal(csvCell('=A1,"x"'), `"'=A1,""x"""`)
  assert.equal(csvCell(null), "")
  assert.equal(csvCell(true), "true")
  assert.equal(csvCell(new Date("2026-09-29T15:30:00Z")), "2026-09-30 00:30:00")
  assert.equal(seoulDateTime(new Date("2026-12-31T20:00:00Z")), "2027-01-01 05:00:00")
  const body = toCsv([{ a: "=x" }], [{ header: "이름", value: (r) => r.a }])
  assert.equal(body, `${CSV_BOM}이름\r\n'=x\r\n`)
  assert.equal(Buffer.from(body, "utf8").subarray(0, 3).toString("hex"), "efbbbf")
  assert.equal(toCsv([], [{ header: "h", value: () => 1 }]), `${CSV_BOM}h\r\n`)
})

test("사용자 CSV 내보내기: 관리자만 · BOM · 수식 무력화 · 한글 머리 · 목록과 같은 검색·정렬 · 기록 · 너무 많으면 413", async () => {
  const boss = await admin()
  const evil = [
    ["csv-1", "=HYPERLINK(\"http://evil.example\",\"click\")"],
    ["csv-2", "+cmd"],
    ["csv-3", "-2+3"],
    ["csv-4", "@SUM(1,2)"],
    ["csv-5", "\tTAB"],
    ["csv-6", "홍길동, \"대표\""],
  ]
  await d.insert(user).values(evil.map(([id, name], i) => ({ id, name, email: `${id}@csv.example.com`, emailVerified: i === 0, createdAt: new Date(Date.UTC(2026, 8, 29, 15, i)), updatedAt: new Date() })))
  const ko = adminActions({ auth, db: d, io: boss.io, locale: "ko", now: () => new Date("2026-09-30T01:02:03Z") })
  const r = await ko.exportUsersCsv({ q: "csv.example.com", sort: { field: "createdAt", dir: "asc" } })
  assert.equal(r.ok, true, JSON.stringify(r))
  assert.equal(r.data.filename, "users-20260930-1002.csv")
  assert.equal(r.data.contentType, "text/csv; charset=utf-8")
  assert.equal(r.data.rows, 6)
  assert.ok(r.data.body.startsWith(CSV_BOM))
  const table = parseCsv(r.data.body.slice(1))
  const C = messages("ko").auth.admin.csv
  assert.deepEqual(table[0], [C.id, C.email, C.name, C.role, C.banned, C.banReason, C.twoFactor, C.emailVerified, C.createdAt])
  assert.deepEqual(table.slice(1).map((row) => row[2]), ["'=HYPERLINK(\"http://evil.example\",\"click\")", "'+cmd", "'-2+3", "'@SUM(1,2)", "'\tTAB", "홍길동, \"대표\""])
  assert.deepEqual(table[1], ["csv-1", "csv-1@csv.example.com", "'=HYPERLINK(\"http://evil.example\",\"click\")", "user", C.no, "", C.no, C.yes, "2026-09-30 00:00:00"])
  assert.ok(table.slice(1).every((row) => !/^[=+\-@\t\r]/.test(row[2])), "수식으로 시작하는 칸이 없다")
  const [log] = await logOf(and(eq(adminActionsTable.adminUserId, boss.id), eq(adminActionsTable.action, ADMIN_ACTION.userExport)))
  assert.deepEqual([log.meta.rows, log.meta.hasQuery, log.ipAddress], [6, true, boss.io.ip])
  // 관리자가 아니면 파일이 없다
  const plain = await person()
  assert.equal((await plain.actions.exportUsersCsv({})).code, "admin_required")

  // 너무 많으면 만들지 않는다(413)
  await d.execute(sql.raw(`insert into "user" (id, name, email, email_verified, created_at, updated_at) select 'bulk-' || g, 'bulkrow', 'bulk-' || g || '@many.example.com', false, now(), now() from generate_series(1, ${EXPORT_MAX_ROWS + 1}) g`))
  try {
    const big = await boss.actions.exportUsersCsv({ q: "many.example.com" })
    assert.deepEqual(big, { ok: false, status: 413, code: "export_too_large", formError: A.exportTooLarge.replace("{max}", String(EXPORT_MAX_ROWS)) })
  } finally {
    await d.execute(sql.raw(`delete from "user" where email like '%@many.example.com'`))
  }
})
