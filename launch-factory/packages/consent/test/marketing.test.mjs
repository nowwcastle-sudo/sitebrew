// 광고성 메일 점검·수신거부·2년 재확인(LFMAIL — G03·G07·A16). DB 는 PGlite 메모리. 시험 비밀·시각은 고정값이다.
import { test, before, after } from "node:test"
import assert from "node:assert/strict"
import { and, eq } from "drizzle-orm"
import { consentRecords, db, marketingConsents, user as userTable, writeMarketingConsents } from "@launch-factory/db"
import { signToken } from "@launch-factory/security/signed-token"
import { RECONFIRM_LINK_VALID_DAYS } from "@launch-factory/email"
import { canSendMarketing, isNightKst, keepByToken, keepToken, marketingLinks, nextSendTime, RECONFIRM_KEEP_DAYS, unsubscribeToken, withdrawByToken } from "../src/index.ts"

const SECRET = "lf-test-secret-not-real-0123456789abcdef"
/** 한국 시각 낮 12시 = 03:00Z */
const NOON_KST = new Date("2026-10-03T03:00:00.000Z")

/** @type {Awaited<ReturnType<typeof db.local>>} */
let d
let seq = 0
const newUser = async (email) => {
  const id = `m-${++seq}`
  const at = new Date("2026-01-01T00:00:00.000Z")
  await d.insert(userTable).values({ id, name: `User ${seq}`, email: email ?? `${id}@example.com`, emailVerified: true, createdAt: at, updatedAt: at })
  return id
}
const consent = (userId, granted, at, source = "sign_up") => writeMarketingConsents(d, { userId, changes: { email: granted }, source, at })
before(async () => {
  d = await db.local()
})
after(async () => {
  await d?.$client.close()
})

test("메일 템플릿의 「계속 받기」 유효 일수와 토큰 기한이 같다(링크 약속 = 실제 기한)", () => {
  assert.equal(RECONFIRM_LINK_VALID_DAYS, RECONFIRM_KEEP_DAYS)
})

test("수신거부 링크: 로그인 없이 그 채널 동의를 바로 철회하고 이력(unsubscribe_link)을 남긴다 · 다시 눌러도 이력이 늘지 않는다", async () => {
  const id = await newUser()
  await consent(id, true, new Date("2026-06-01T00:00:00.000Z"))
  const token = unsubscribeToken(id, "email", SECRET)
  const r1 = await withdrawByToken(d, token, { secret: SECRET, now: NOON_KST })
  assert.deepEqual(r1, { ok: true, userId: id, channel: "email", changed: true, at: NOON_KST })
  const [row] = await d.select().from(marketingConsents).where(and(eq(marketingConsents.userId, id), eq(marketingConsents.channel, "email")))
  assert.equal(row.granted, false)
  assert.equal(row.updatedAt.toISOString(), NOON_KST.toISOString())
  const hist = await d.select().from(consentRecords).where(eq(consentRecords.userId, id)).orderBy(consentRecords.createdAt)
  assert.deepEqual(hist.map((h) => [h.kind, h.granted, h.source]), [["marketing_email", true, "sign_up"], ["marketing_email", false, "unsubscribe_link"]])
  // 같은 링크를 다시 누르거나 보안 프로그램이 미리 열어도: 성공, 변경 없음(통지 메일 되풀이 없음), 이력 그대로
  const r2 = await withdrawByToken(d, token, { secret: SECRET, now: new Date(NOON_KST.getTime() + 1000) })
  assert.deepEqual(r2, { ok: true, userId: id, channel: "email", changed: false, at: new Date(NOON_KST.getTime() + 1000) })
  assert.equal((await d.select().from(consentRecords).where(eq(consentRecords.userId, id))).length, 2)
  // 만료 없음: 몇 년 뒤의 오래된 메일 링크도 통한다
  const id2 = await newUser()
  await consent(id2, true, new Date("2026-06-01T00:00:00.000Z"))
  assert.ok((await withdrawByToken(d, unsubscribeToken(id2, "email", SECRET), { secret: SECRET, now: new Date("2031-01-01T00:00:00.000Z") })).ok)
})

test("수신거부 링크 음성: 위조·다른 용도(계속 받기 토큰)·다른 비밀·모르는 채널·없는 사용자·빈 값은 모두 invalid 이고 아무것도 바꾸지 않는다", async () => {
  const id = await newUser()
  await consent(id, true, new Date("2026-06-01T00:00:00.000Z"))
  const good = unsubscribeToken(id, "email", SECRET)
  const bad = [
    keepToken(id, "email", SECRET, NOON_KST),
    unsubscribeToken(id, "email", "lf-other-secret-not-real-0123456789abcd"),
    signToken({ u: id, c: "fax" }, { secret: SECRET, purpose: "marketing-unsubscribe" }),
    signToken({ u: "no-such-user", c: "email" }, { secret: SECRET, purpose: "marketing-unsubscribe" }),
    `${good}x`,
    "",
    undefined,
    null,
  ]
  for (const t of bad) assert.deepEqual(await withdrawByToken(d, t, { secret: SECRET, now: NOON_KST }), { ok: false, reason: "invalid" }, String(t))
  const [row] = await d.select().from(marketingConsents).where(and(eq(marketingConsents.userId, id), eq(marketingConsents.channel, "email")))
  assert.equal(row.granted, true, "동의는 그대로")
})

test("계속 받기 링크: 동의 시각이 지금으로 갱신되고(새 2년) 이력(reconfirm)이 남는다 · 철회한 사람은 다시 동의시키지 않는다 · 기한이 지나면 invalid", async () => {
  const id = await newUser()
  await consent(id, true, new Date("2024-06-01T00:00:00.000Z"))
  const token = keepToken(id, "email", SECRET, NOON_KST)
  const ok = await keepByToken(d, token, { secret: SECRET, now: new Date(NOON_KST.getTime() + 86_400_000) })
  assert.deepEqual(ok, { ok: true, userId: id, channel: "email", at: new Date(NOON_KST.getTime() + 86_400_000) })
  const hist = await d.select().from(consentRecords).where(eq(consentRecords.userId, id)).orderBy(consentRecords.createdAt)
  assert.equal(hist.at(-1).source, "reconfirm")
  // 기한(60일) 뒤
  assert.deepEqual(await keepByToken(d, token, { secret: SECRET, now: new Date(NOON_KST.getTime() + 61 * 86_400_000) }), { ok: false, reason: "invalid" })
  // 철회 뒤에는 계속 받기 링크로 되살리지 않는다
  await withdrawByToken(d, unsubscribeToken(id, "email", SECRET), { secret: SECRET, now: NOON_KST })
  assert.deepEqual(await keepByToken(d, keepToken(id, "email", SECRET, NOON_KST), { secret: SECRET, now: NOON_KST }), { ok: false, reason: "withdrawn" })
  const [row] = await d.select().from(marketingConsents).where(and(eq(marketingConsents.userId, id), eq(marketingConsents.channel, "email")))
  assert.equal(row.granted, false)
  // 수신거부 토큰으로 계속 받기를 할 수 없다
  assert.deepEqual(await keepByToken(d, unsubscribeToken(id, "email", SECRET), { secret: SECRET, now: NOON_KST }), { ok: false, reason: "invalid" })
})

test("marketingLinks: 같은 경로 상수·서명 토큰으로 두 링크를 만든다", () => {
  const l = marketingLinks({ baseUrl: "https://app.example.test/", secret: SECRET, userId: "u1", now: NOON_KST })
  assert.match(l.unsubscribeUrl, /^https:\/\/app\.example\.test\/api\/marketing\/unsubscribe\?t=[\w-]+\.[\w-]+$/)
  assert.match(l.keepUrl, /^https:\/\/app\.example\.test\/api\/marketing\/keep\?t=[\w-]+\.[\w-]+$/)
})

test("G07 야간 점검: 한국 시각 21:00~08:00 이 야간(경계 포함·미포함), 다시 보낼 시각은 그날 아침 8시", () => {
  const kst = (iso) => new Date(`${iso}+09:00`)
  assert.equal(isNightKst(kst("2026-10-03T20:59:59")), false)
  assert.equal(isNightKst(kst("2026-10-03T21:00:00")), true)
  assert.equal(isNightKst(kst("2026-10-03T23:59:59")), true)
  assert.equal(isNightKst(kst("2026-10-04T00:00:00")), true)
  assert.equal(isNightKst(kst("2026-10-04T07:59:59")), true)
  assert.equal(isNightKst(kst("2026-10-04T08:00:00")), false)
  assert.equal(isNightKst(kst("2026-10-03T12:00:00")), false)
  assert.equal(nextSendTime(kst("2026-10-03T22:30:00")).toISOString(), kst("2026-10-04T08:00:00").toISOString())
  assert.equal(nextSendTime(kst("2026-10-04T03:00:00")).toISOString(), kst("2026-10-04T08:00:00").toISOString())
  assert.equal(nextSendTime(kst("2026-10-04T12:00:00")).toISOString(), kst("2026-10-04T12:00:00").toISOString())
  // 월말·연말 경계
  assert.equal(nextSendTime(kst("2026-12-31T23:00:00")).toISOString(), kst("2027-01-01T08:00:00").toISOString())
})

test("canSendMarketing: 동의 없음·철회 → no_consent / 2년 넘음+재확인 전 → reconfirm_pending / 야간 → night / 그 밖에는 ok · 야간 점검은 끌 수 있다", async () => {
  const none = await newUser()
  assert.deepEqual(await canSendMarketing(d, none, { now: NOON_KST }), { ok: false, reason: "no_consent" })

  const fresh = await newUser()
  await consent(fresh, true, new Date("2026-06-01T00:00:00.000Z"))
  assert.deepEqual(await canSendMarketing(d, fresh, { now: NOON_KST }), { ok: true })
  const night = new Date("2026-10-03T14:00:00.000Z") // 한국 23:00
  const dec = await canSendMarketing(d, fresh, { now: night })
  assert.equal(dec.reason, "night")
  assert.equal(dec.retryAt.toISOString(), "2026-10-03T23:00:00.000Z") // 한국 다음 날 08:00
  assert.deepEqual(await canSendMarketing(d, fresh, { now: night, nightGuard: false }), { ok: true })

  const withdrawn = await newUser()
  await consent(withdrawn, true, new Date("2026-06-01T00:00:00.000Z"))
  await consent(withdrawn, false, new Date("2026-07-01T00:00:00.000Z"), "settings")
  assert.deepEqual(await canSendMarketing(d, withdrawn, { now: NOON_KST }), { ok: false, reason: "no_consent" })

  // 2년 넘은 동의: 재확인 메일 전에는 보내지 않는다
  const old = await newUser()
  const oldAt = new Date("2024-09-01T00:00:00.000Z")
  await consent(old, true, oldAt)
  assert.deepEqual(await canSendMarketing(d, old, { now: NOON_KST }), { ok: false, reason: "reconfirm_pending" })
  // 2년 직전(1년 11개월)은 아직 괜찮다
  assert.deepEqual(await canSendMarketing(d, old, { now: new Date("2026-08-31T03:00:00.000Z") }), { ok: true })
})
