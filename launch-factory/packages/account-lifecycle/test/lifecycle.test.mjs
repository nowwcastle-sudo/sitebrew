// @launch-factory/account-lifecycle — 탈퇴 요청·유예·파기 Cron·분리 보존·내려받기 (v0 Task 14).
// DB는 PGlite 메모리 하나를 파일 전체가 같이 쓴다. 결제·계측은 가짜(호출 기록). 네트워크를 쓰지 않는다.
import { test, before, after } from "node:test"
import assert from "node:assert/strict"
import { eq, sql } from "drizzle-orm"
import {
  accessLogs,
  account,
  accountDeletions,
  adminActions,
  consentRecords,
  db,
  invitation,
  marketingConsents,
  member,
  organization,
  rateLimits,
  retainedTransactions,
  session,
  subscriptions,
  twoFactor,
  user,
  verification,
} from "@launch-factory/db"
import {
  ACCOUNT_DELETION_DEFAULTS,
  NO_ANALYTICS_ERASER,
  cancelAccountDeletion,
  exportMyData,
  findRetainedByEmail,
  identifyingKeys,
  normalizeEmail,
  pendingDeletion,
  requestAccountDeletion,
  retainTransaction,
  runPurge,
  subjectRef,
  sweepExpired,
} from "../src/index.ts"

// 고정 시험값 — 실제 비밀이 아니다.
const KEY = "lf-test-subject-key-not-real-0123456789"
const OTHER_KEY = "lf-test-subject-key-not-real-9876543210"
const DAY = 24 * 3600 * 1000
/** 법정 보존(분리 저장)으로 남기는 표 — 파기 검사에서 뺀다. 이유는 보고서 「남기는 것」 */
const LEGALLY_RETAINED_TABLES = new Set(["access_logs", "admin_actions"])

/** @type {Awaited<ReturnType<typeof db.local>>} */
let d
before(async () => {
  d = await db.local()
})
after(async () => {
  await d?.$client.close()
})

let seq = 0
/** 개인 식별 칸이 들어갈 수 있는 모든 곳에 행을 만든다 */
async function seedUser({ subscription = "active", withdrawal = true } = {}) {
  const n = ++seq
  const id = `usr_lc_${n}_${Math.random().toString(36).slice(2, 10)}`
  const email = `Person.${n}@Example.com`
  const name = `Hong Gildong Test${n}`
  const at = new Date(Date.now() - 30 * DAY)
  // 공급자·다른 사용자·조직 id 는 사용자 id 와 무관한 값이다(실제와 같다 — 검사가 우연히 겹친 글자를 잡지 않게)
  const other = () => Math.random().toString(36).slice(2, 12)
  const subId = `sub_${other()}`
  const orgId = `org_${other()}`
  await d.insert(user).values({ id, name, email, emailVerified: true, createdAt: at, updatedAt: at, twoFactorEnabled: true })
  await d.insert(account).values({ id: `acc_${id}`, accountId: id, providerId: "credential", userId: id, password: `hash-secret-${id}`, createdAt: at, updatedAt: at })
  await d.insert(session).values({ id: `ses_${id}`, token: `tok-secret-${id}`, userId: id, expiresAt: new Date(Date.now() + DAY), createdAt: at, updatedAt: at, ipAddress: "203.0.113.9", userAgent: `agent-${id}` })
  await d.insert(twoFactor).values({ id: `tf_${id}`, secret: `totp-secret-${id}`, backupCodes: `backup-${id}`, userId: id })
  const base = { userId: id, source: "sign_up", locale: "ko", createdAt: at }
  await d.insert(consentRecords).values([
    { ...base, kind: "terms", granted: true, version: "terms-2026-09-30" },
    { ...base, kind: "privacy", granted: true, version: "privacy-2026-09-30" },
    { ...base, kind: "age_over_14", granted: true },
    { ...base, kind: "marketing_email", granted: true },
    ...(withdrawal ? [{ ...base, kind: "withdrawal_limit", granted: true, version: "withdrawal-v1", source: "checkout", subject: "pro" }] : []),
  ])
  await d.insert(marketingConsents).values({ userId: id, channel: "email", granted: true, updatedAt: at })
  if (subscription) {
    await d.insert(subscriptions).values({ userId: id, provider: "paddle", providerSubId: subId, status: subscription, planId: "pro", currentPeriodEnd: new Date(Date.now() + 20 * DAY), updatedFromEventAt: at })
  }
  await d.insert(verification).values([
    { id: `ver1_${id}`, identifier: `reset-password:${id}-token`, value: id, expiresAt: new Date(Date.now() + DAY) },
    { id: `ver2_${id}`, identifier: `magic-${id}`, value: JSON.stringify({ email: email.toLowerCase() }), expiresAt: new Date(Date.now() + DAY) },
  ])
  // 다른 사람이 이 사용자에게 보낸 초대(이메일이 남는다)
  const inviter = `usr_inviter_${other()}`
  await d.insert(user).values({ id: inviter, name: "Inviter", email: `${inviter}@example.com`, createdAt: at, updatedAt: at })
  await d.insert(organization).values({ id: orgId, name: "Org", slug: orgId, createdAt: at })
  await d.insert(member).values({ id: `mem_${id}`, organizationId: orgId, userId: id, role: "member", createdAt: at })
  await d.insert(invitation).values({ id: `inv_${id}`, organizationId: orgId, email: email.toUpperCase(), inviterId: inviter, expiresAt: new Date(Date.now() + DAY), createdAt: at })
  await d.insert(rateLimits).values({ key: `203.0.113.9|/api/contact|${id}`, count: 1, windowStartedAt: at })
  // 법정 보존 대상(파기하지 않는다): 처리자 접속기록·관리자 처리 기록
  await d.insert(accessLogs).values({ actorId: "admin_1", ip: "198.51.100.1", subjects: [id], action: "view", target: "user", occurredAt: at })
  await d.insert(adminActions).values({ adminUserId: "admin_1", action: "impersonate_start", targetUserId: id })
  return { id, email, name, inviter, subId }
}

/** 가짜 결제 포트. state 를 바꿔 실패·상태를 흉내 낸다. cancel 이 불린 순간 탈퇴 요청 행이 있었는지 남긴다 */
function fakeBilling(init = {}) {
  const state = { status: "active", cancelAt: undefined, failSubscription: false, failCancel: false, calls: [], ...init }
  const billingFor = (userId) => ({
    async subscription() {
      state.calls.push({ op: "subscription", userId })
      if (state.failSubscription) return { ok: false, formError: "x", retryable: true }
      return { ok: true, data: { planId: state.status === "none" ? null : "pro", status: state.status, ...(state.cancelAt ? { cancelAt: state.cancelAt } : {}) } }
    },
    async cancel(input) {
      const rows = await d.select().from(accountDeletions).where(eq(accountDeletions.userId, userId))
      state.calls.push({ op: "cancel", userId, when: input.when, deletionRowsAtCall: rows.length })
      if (state.failCancel) return { ok: false, formError: "x", retryable: true }
      if (input.when === "now") state.status = "canceled"
      else state.cancelAt = new Date(Date.now() + 20 * DAY).toISOString()
      return { ok: true, data: { planId: "pro", status: state.status, cancelAt: state.cancelAt } }
    },
  })
  return { state, billingFor }
}

function fakeEraser() {
  const calls = []
  let fail = false
  return {
    calls,
    failNext(v = true) {
      fail = v
    },
    async erase(ids) {
      calls.push([...ids])
      if (fail) {
        fail = false
        throw Object.assign(new Error("posthog down"), { code: "http_503" })
      }
    },
  }
}

const cancels = (state, when) => state.calls.filter((c) => c.op === "cancel" && (!when || c.when === when))

/** 모든 공개 표의 글자·json·배열 칸에서 needle 이 든 행을 센다(법정 보존 표 제외). 결과: { "표.칸": 행 수 } */
async function identifyingHits(needles, { includeRetained = false } = {}) {
  const cols = await d.execute(sql`select table_name, column_name from information_schema.columns
    where table_schema = 'public' and (data_type in ('text', 'character varying', 'jsonb', 'json') or data_type = 'ARRAY')`)
  const hits = {}
  for (const { table_name: t, column_name: c } of cols.rows) {
    if (!includeRetained && LEGALLY_RETAINED_TABLES.has(t)) continue
    for (const needle of needles) {
      const r = await d.execute(sql`select count(*)::int as n from ${sql.identifier(t)} where position(lower(${needle}) in lower(${sql.identifier(c)}::text)) > 0`)
      const count = r.rows[0].n
      if (count) hits[`${t}.${c}`] = (hits[`${t}.${c}`] ?? 0) + count
    }
  }
  return hits
}

/** 앞 시험이 남긴 진행 중 요청을 치운다(DB 를 같이 쓰므로 Cron 시험끼리 섞이지 않게) */
async function isolate() {
  await d.execute(sql`update account_deletions set status = 'cancelled', cancelled_at = now() where status in ('pending', 'purging')`)
}

async function deletionOf(userId) {
  return (await d.select().from(accountDeletions).where(eq(accountDeletions.userId, userId)))[0]
}

const purgeDeps = (billing, analytics, now) => ({ db: d, billingFor: billing.billingFor, subjectKey: KEY, analytics, now: () => now })

test("subject_ref: 키 있는 해시 — 같은 키·정규화한 이메일이면 같고, 키가 다르면 다르다 · 짧은 키는 거부", () => {
  const a = subjectRef(KEY, "  Person.1@Example.COM ")
  assert.equal(a, subjectRef(KEY, "person.1@example.com"))
  assert.match(a, /^h1:[0-9a-f]{64}$/)
  assert.notEqual(a, subjectRef(OTHER_KEY, "person.1@example.com"))
  assert.notEqual(a, subjectRef(KEY, "person.2@example.com"))
  assert.ok(!a.includes("person"), "이메일이 해시 밖으로 새지 않는다")
  assert.throws(() => subjectRef("short", "a@example.com"), /at least 32/)
  assert.throws(() => subjectRef(undefined, "a@example.com"), /at least 32/)
  assert.equal(normalizeEmail(" A@B.COM "), "a@b.com")
})

test("탈퇴 요청: 살아 있는 구독을 먼저 해지(기간 끝)한 뒤 기록하고, 세션을 모두 끊는다 · 두 번 눌러도 해지·기록은 한 번", async () => {
  const u = await seedUser()
  const billing = fakeBilling()
  const now = new Date()
  const r = await requestAccountDeletion({ db: d, billingFor: billing.billingFor, now: () => now }, u.id)
  assert.equal(r.ok, true)
  assert.equal(r.alreadyRequested, false)
  assert.equal(new Date(r.graceUntil).getTime(), now.getTime() + ACCOUNT_DELETION_DEFAULTS.graceDays * DAY)
  // 해지가 먼저다: cancel 이 불린 순간 탈퇴 요청 행은 0개였다
  assert.deepEqual(cancels(billing.state).map((c) => [c.when, c.deletionRowsAtCall]), [["period_end", 0]])
  assert.equal((await deletionOf(u.id)).status, "pending")
  assert.equal((await d.select().from(session).where(eq(session.userId, u.id))).length, 0)
  assert.equal((await pendingDeletion(d, u.id)).status, "pending")

  const again = await requestAccountDeletion({ db: d, billingFor: billing.billingFor }, u.id)
  assert.deepEqual(again, { ok: true, graceUntil: r.graceUntil, alreadyRequested: true })
  assert.equal(cancels(billing.state).length, 1)
})

test("탈퇴 요청: 구독 조회·해지가 실패하면 탈퇴를 기록하지 않고 세션도 그대로 · 이미 해지 예약된 구독과 구독 없음은 다시 해지하지 않는다", async () => {
  for (const fail of [{ failSubscription: true }, { failCancel: true }]) {
    const u = await seedUser()
    const billing = fakeBilling(fail)
    assert.deepEqual(await requestAccountDeletion({ db: d, billingFor: billing.billingFor }, u.id), { ok: false, reason: "billing_failed", retryable: true })
    assert.equal(await deletionOf(u.id), undefined)
    assert.equal((await d.select().from(session).where(eq(session.userId, u.id))).length, 1)
  }
  for (const init of [{ status: "none" }, { status: "canceled" }, { status: "active", cancelAt: "2026-12-01T00:00:00.000Z" }]) {
    const u = await seedUser({ subscription: init.status === "none" ? null : init.status })
    const billing = fakeBilling(init)
    assert.equal((await requestAccountDeletion({ db: d, billingFor: billing.billingFor }, u.id)).ok, true)
    assert.equal(cancels(billing.state).length, 0, JSON.stringify(init))
  }
  assert.deepEqual(await requestAccountDeletion({ db: d, billingFor: fakeBilling().billingFor }, "usr_missing"), { ok: false, reason: "user_not_found" })
})

test("유예: 유예 전 Cron 은 아무것도 하지 않고, 유예 중 취소(로그인)하면 유예가 지나도 파기하지 않는다", async () => {
  const u = await seedUser()
  const billing = fakeBilling()
  const eraser = fakeEraser()
  await isolate()
  const t0 = new Date()
  await requestAccountDeletion({ db: d, billingFor: billing.billingFor, now: () => t0 }, u.id)
  const early = await runPurge(purgeDeps(billing, eraser, new Date(t0.getTime() + 6 * DAY)))
  assert.equal(early.claimed, 0)
  assert.equal((await deletionOf(u.id)).status, "pending")

  assert.equal(await cancelAccountDeletion(d, u.id), true)
  assert.equal(await cancelAccountDeletion(d, u.id), false) // 두 번째는 할 일이 없다
  const late = await runPurge(purgeDeps(billing, eraser, new Date(t0.getTime() + 30 * DAY)))
  assert.equal(late.purged, 0)
  assert.equal((await d.select().from(user).where(eq(user.id, u.id))).length, 1)
  assert.equal((await deletionOf(u.id)).status, "cancelled")
  assert.deepEqual(eraser.calls, [])
})

test("유예가 지나면: 개인 식별 칸 0개(법정 보존 표 밖) · 보존 거래기록은 남되 이름·이메일 없음 · 키 해시로 찾는다 · 구독은 파기 전에 즉시 해지", async () => {
  const u = await seedUser()
  const bystander = await seedUser() // 같은 DB 의 다른 사용자 — 건드리지 않아야 한다
  const billing = fakeBilling()
  const eraser = fakeEraser()
  await isolate()
  const t0 = new Date()
  const needles = [u.id, u.email, u.name]

  // 양성 대조: 파기 전에는 여러 표에서 잡힌다
  const beforeHits = await identifyingHits(needles)
  for (const t of ["user.email", "user.name", "account.user_id", "session.user_id", "two_factor.user_id", "consent_records.user_id", "marketing_consents.user_id", "subscriptions.user_id", "verification.value", "invitation.email", "rate_limits.key", "member.user_id"]) {
    assert.ok(beforeHits[t] > 0, `양성 대조 ${t}: ${JSON.stringify(beforeHits)}`)
  }
  await requestAccountDeletion({ db: d, billingFor: billing.billingFor, now: () => t0 }, u.id)

  const at = new Date(t0.getTime() + 8 * DAY)
  const r = await runPurge(purgeDeps(billing, eraser, at))
  assert.deepEqual([r.claimed, r.purged, r.analyticsErased, r.completed, r.failures], [1, 1, 1, 1, []])
  // 결제: 요청 때 기간 끝 해지, 파기 때 남은 기간을 즉시 해지 — 둘 다 DB 파기보다 먼저
  assert.deepEqual(cancels(billing.state).map((c) => c.when), ["period_end", "now"])
  // 계측: 내부 사용자 id(PostHog distinct id)로 지웠다
  assert.deepEqual(eraser.calls, [[u.id]])

  assert.deepEqual(await identifyingHits(needles), {}, "파기 뒤 개인 식별 칸")
  // 법정 보존 표에는 남는다(접속기록 고시 제8조 — 처리자의 기록)
  const kept = await identifyingHits([u.id], { includeRetained: true })
  assert.deepEqual(Object.keys(kept).sort(), ["access_logs.subjects", "admin_actions.target_user_id"])
  // 초대한 사람(다른 사용자)과 구경꾼은 그대로다
  assert.equal((await d.select().from(user).where(eq(user.id, u.inviter))).length, 1)
  assert.equal((await d.select().from(user).where(eq(user.id, bystander.id))).length, 1)
  assert.equal((await d.select().from(session).where(eq(session.userId, bystander.id))).length, 1)

  // 요청 행: 가명 참조·시각만 남고 user_id 는 비었다
  const [del] = await d.select().from(accountDeletions).where(eq(accountDeletions.subjectRef, subjectRef(KEY, u.email)))
  assert.equal(del.status, "purged")
  assert.equal(del.userId, null)
  assert.ok(del.purgedAt && del.analyticsErasedAt && del.completedAt)

  // 보존 거래기록: 계약(구독)·청약철회 제한 동의 — 5년 · 마케팅 수신 동의 이력 — 3년(운영자 결정 2026-10-08, D127), 이름·이메일·사용자 id 없음
  const kept2 = await findRetainedByEmail(d, KEY, u.email.toUpperCase())
  assert.deepEqual(kept2.map((k) => k.kind).sort(), ["contract", "contract", "dispute"])
  const mk = kept2.find((k) => k.record.type === "marketing_consent")
  assert.deepEqual([mk.record.channel, mk.record.granted], ["email", true])
  assert.equal(mk.retainUntil.getTime(), new Date(at).setUTCMonth(at.getUTCMonth() + 36), "민법 제766조① — 안 날부터 3년")
  // 약관·개인정보·만 14세 동의는 옮기지 않는다(파기)
  assert.ok(!kept2.some((k) => ["terms_consent", "privacy_consent", "age_over_14_consent"].includes(k.record.type)))
  const sub = kept2.find((k) => k.record.type === "subscription")
  assert.equal(sub.providerRef, u.subId)
  assert.equal(sub.record.planId, "pro")
  assert.deepEqual(sub.record.termsAccepted.map((t) => t.version), ["terms-2026-09-30"])
  assert.equal(sub.retainUntil.getTime(), new Date(at).setUTCMonth(at.getUTCMonth() + 60))
  const wd = kept2.find((k) => k.record.type === "withdrawal_limit_consent")
  assert.equal(wd.record.version, "withdrawal-v1")
  const text = JSON.stringify(kept2)
  for (const needle of [u.email, u.email.toLowerCase(), u.name, u.id]) assert.ok(!text.toLowerCase().includes(needle.toLowerCase()), `보존 기록에 ${needle}`)
  // 키가 없으면(다른 키) 찾지 못한다
  assert.deepEqual(await findRetainedByEmail(d, OTHER_KEY, u.email), [])
})

test("Cron 이 두 번 돌아도 한 번만 처리한다(결제 해지·계측 삭제·보존 기록 모두 한 번)", async () => {
  const u = await seedUser()
  const billing = fakeBilling()
  const eraser = fakeEraser()
  await isolate()
  const t0 = new Date()
  await requestAccountDeletion({ db: d, billingFor: billing.billingFor, now: () => t0 }, u.id)
  const at = new Date(t0.getTime() + 8 * DAY)
  const first = await runPurge(purgeDeps(billing, eraser, at))
  const second = await runPurge(purgeDeps(billing, eraser, new Date(at.getTime() + 60_000)))
  assert.deepEqual([first.claimed, first.purged, first.analyticsErased, first.completed], [1, 1, 1, 1])
  assert.deepEqual([second.claimed, second.purged, second.analyticsErased, second.completed, second.failures], [0, 0, 0, 0, []])
  assert.equal(cancels(billing.state, "now").length, 1)
  assert.deepEqual(eraser.calls, [[u.id]])
  assert.equal((await findRetainedByEmail(d, KEY, u.email)).length, 3)
})

test("계측 삭제 뒤·마무리 전에 죽은 요청은 다음 Cron 이 계측을 다시 부르지 않고 마무리만 한다", async () => {
  const eraser = fakeEraser()
  await isolate()
  const now = new Date()
  // 4단계(계측 삭제 기록)까지 하고 5단계(마무리) 전에 멈춘 모양
  await d.insert(accountDeletions).values({ userId: "usr_crashed_after_erase", status: "purged", graceUntil: now, purgedAt: now, analyticsErasedAt: now, subjectRef: "h1:test" })
  const r = await runPurge(purgeDeps(fakeBilling(), eraser, now))
  assert.deepEqual([r.analyticsErased, r.completed], [0, 1])
  assert.deepEqual(eraser.calls, [])
})

test("실패는 다음 Cron 이 이어서 한다: 즉시 해지 실패 → 파기하지 않음, 계측 실패 → 파기는 끝, 계측만 다시", async () => {
  const u = await seedUser()
  const billing = fakeBilling()
  const eraser = fakeEraser()
  await isolate()
  const t0 = new Date()
  await requestAccountDeletion({ db: d, billingFor: billing.billingFor, now: () => t0 }, u.id)
  const at = new Date(t0.getTime() + 8 * DAY)

  billing.state.failCancel = true
  const r1 = await runPurge(purgeDeps(billing, eraser, at))
  assert.deepEqual(r1.failures.map((f) => f.error), ["billing:cancel"])
  assert.equal((await deletionOf(u.id)).status, "purging")
  assert.equal((await deletionOf(u.id)).lastError, "billing:cancel")
  assert.equal((await d.select().from(user).where(eq(user.id, u.id))).length, 1, "해지 실패면 계정을 지우지 않는다")
  // purging 이 된 뒤에는 로그인해도 취소되지 않는다(파기가 이미 시작됐다)
  assert.equal(await cancelAccountDeletion(d, u.id), false)

  billing.state.failCancel = false
  eraser.failNext()
  const r2 = await runPurge(purgeDeps(billing, eraser, at))
  assert.deepEqual([r2.claimed, r2.purged, r2.analyticsErased, r2.completed], [0, 1, 0, 0])
  assert.deepEqual(r2.failures.map((f) => f.error), ["analytics:Error:http_503"])
  assert.equal((await d.select().from(user).where(eq(user.id, u.id))).length, 0)
  const mid = await deletionOf(u.id)
  assert.equal(mid.status, "purged")
  assert.equal(mid.completedAt, null)

  const r3 = await runPurge(purgeDeps(billing, eraser, at))
  assert.deepEqual([r3.purged, r3.analyticsErased, r3.completed, r3.failures], [0, 1, 1, []])
  assert.deepEqual(eraser.calls, [[u.id], [u.id]])
  assert.equal(await deletionOf(u.id), undefined, "끝나면 user_id 가 비어 id 로는 찾을 수 없다")
})

test("보존 기간은 종류마다 제 기간으로 끝난다(6개월·5년·5년·3년) · 기간 전 삭제·수정은 DB 가 막는다", async () => {
  const now = new Date()
  const months = { advertising: 6, contract: 60, payment: 60, dispute: 36 }
  const shift = (m, days) => {
    const x = new Date(now.getTime())
    x.setUTCMonth(x.getUTCMonth() - m)
    return new Date(x.getTime() + days * DAY)
  }
  const ref = subjectRef(KEY, "retention@example.com")
  for (const [kind, m] of Object.entries(months)) {
    await retainTransaction(d, ref, { kind, provider: "test", providerRef: `${kind}-expired`, occurredAt: shift(m, -1), record: { n: 1 } })
    await retainTransaction(d, ref, { kind, provider: "test", providerRef: `${kind}-live`, occurredAt: shift(m, +1), record: { n: 2 } })
  }
  // 같은 기록을 다시 넣어도 하나다
  assert.equal(await retainTransaction(d, ref, { kind: "dispute", provider: "test", providerRef: "dispute-live", occurredAt: shift(36, 1), record: { n: 2 } }), false)

  // 트리거: 기간 전 삭제·수정 거부
  await assert.rejects(d.execute(sql`delete from retained_transactions where provider_ref = 'advertising-live'`), (e) => /before retain_until/.test(e.cause?.message ?? e.message))
  await assert.rejects(d.execute(sql`update retained_transactions set record = '{}' where provider_ref = 'advertising-expired'`), (e) => /append-only/.test(e.cause?.message ?? e.message))

  const swept = await sweepExpired(d, now)
  assert.deepEqual(swept.retained, { advertising: 1, contract: 1, payment: 1, dispute: 1 })
  const left = await d.select({ ref: retainedTransactions.providerRef }).from(retainedTransactions).where(eq(retainedTransactions.provider, "test"))
  assert.deepEqual(left.map((x) => x.ref).sort(), ["advertising-live", "contract-live", "dispute-live", "payment-live"])
})

test("보존 기록에 개인 식별 칸을 넣으면 거부한다(중첩·배열 포함)", async () => {
  assert.deepEqual(identifyingKeys({ planId: "pro", buyer: { email: "x" }, items: [{ userName: "y" }], ipAddress: "1", membership: true }), ["buyer.email", "items.userName", "ipAddress"])
  await assert.rejects(
    retainTransaction(d, subjectRef(KEY, "x@example.com"), { kind: "payment", provider: "test", providerRef: "bad", occurredAt: new Date(), record: { amount: 1, customer_email: "x@example.com" } }),
    /identifying fields: customer_email/,
  )
})

test("동의 이력은 고칠 수 없고(UPDATE 거부), 파기(DELETE)는 된다", async () => {
  const u = await seedUser({ subscription: null })
  await assert.rejects(d.execute(sql`update consent_records set granted = false where user_id = ${u.id}`), (e) => /append-only/.test(e.cause?.message ?? e.message))
  await d.execute(sql`delete from consent_records where user_id = ${u.id} and kind = 'marketing_email'`)
  assert.equal((await d.select().from(consentRecords).where(eq(consentRecords.userId, u.id))).length, 4)
})

test("내려받기: 본인 데이터만, 비밀(비밀번호 해시·세션 토큰·2단계 비밀)은 없다", async () => {
  const a = await seedUser()
  const b = await seedUser()
  const now = new Date("2026-09-30T00:00:00.000Z")
  const out = await exportMyData(d, a.id, now)
  assert.equal(out.profile.id, a.id)
  assert.equal(out.profile.email, a.email)
  assert.equal(out.exportedAt, now.toISOString())
  assert.equal(out.subscriptions[0].providerSubscriptionId, a.subId)
  assert.deepEqual(out.consents.map((c) => c.kind).sort(), ["age_over_14", "marketing_email", "privacy", "terms", "withdrawal_limit"])
  assert.equal(out.sessions.length, 1)
  assert.equal(out.organizations.length, 1)
  const text = JSON.stringify(out)
  for (const other of [b.id, b.email, b.name]) assert.ok(!text.includes(other), `다른 사용자 ${other}`)
  for (const secret of [`hash-secret-${a.id}`, `tok-secret-${a.id}`, `totp-secret-${a.id}`, `backup-${a.id}`]) assert.ok(!text.includes(secret), `비밀 ${secret}`)
  assert.equal(await exportMyData(d, "usr_missing"), null)
})

test("계측 삭제기를 빠뜨리면 Cron 이 켜지지 않는다(조용히 건너뛰지 않는다) · 계측 없는 제품은 이름으로 고른다", async () => {
  const billing = fakeBilling()
  await assert.rejects(runPurge({ db: d, billingFor: billing.billingFor, subjectKey: KEY }), /analytics eraser is required/)
  await assert.rejects(runPurge({ db: d, billingFor: billing.billingFor, subjectKey: "short", analytics: NO_ANALYTICS_ERASER }), /at least 32/)
  const r = await runPurge({ db: d, billingFor: billing.billingFor, subjectKey: KEY, analytics: NO_ANALYTICS_ERASER })
  assert.deepEqual(r.failures, [])
})
