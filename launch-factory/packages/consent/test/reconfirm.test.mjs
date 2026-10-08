// 2년 재확인 작업(A16). 다른 시험의 사용자가 섞이지 않게 DB 를 따로 쓴다.
import { test, before, after } from "node:test"
import assert from "node:assert/strict"
import { and, eq } from "drizzle-orm"
import { db, mailLedger, user as userTable, writeMarketingConsents } from "@launch-factory/db"
import { canSendMarketing, keepByToken, keepToken, runMarketingReconfirm, yearsAgo } from "../src/index.ts"

const SECRET = "lf-test-secret-not-real-0123456789abcdef"
const NOON_KST = new Date("2026-10-03T03:00:00.000Z")

/** @type {Awaited<ReturnType<typeof db.local>>} */
let d
let seq = 0
const newUser = async (email) => {
  const id = `r-${++seq}`
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

test("A16 재확인 작업: 2년 지난 이메일 동의자에게만 한 통씩 · 두 번 돌려도 한 통 · 실패는 기록하지 않아 다음에 이어서 · 보낸 뒤에는 canSendMarketing 이 다시 열린다", async () => {
  const now = NOON_KST
  const cutoff = yearsAgo(now, 2) // 2024-10-03T03:00Z
  const dueId = await newUser("due@example.com")
  const justUnder = await newUser("under@example.com")
  const withdrawnId = await newUser("withdrawn@example.com")
  const smsOnly = await newUser("sms@example.com")
  const failing = await newUser("failing@example.com")
  const placeholder = await newUser("kakao-1@kakao.invalid")
  await consent(dueId, true, new Date(cutoff.getTime() - 86_400_000))
  await consent(justUnder, true, new Date(cutoff.getTime() + 86_400_000))
  await consent(withdrawnId, true, new Date(cutoff.getTime() - 86_400_000 * 40))
  await consent(withdrawnId, false, new Date(cutoff.getTime() - 86_400_000 * 30), "settings")
  await writeMarketingConsents(d, { userId: smsOnly, changes: { sms: true }, source: "sign_up", at: new Date(cutoff.getTime() - 86_400_000) })
  await consent(failing, true, new Date(cutoff.getTime() - 86_400_000 * 5))
  await consent(placeholder, true, new Date(cutoff.getTime() - 86_400_000 * 6))

  const sentTo = []
  let failOnce = true
  const send = async (c) => {
    if (c.userId === failing && failOnce) {
      failOnce = false
      throw new Error("provider down")
    }
    sentTo.push([c.userId, c.email, c.consentAt.toISOString(), c.idempotencyKey])
  }
  const skip = (c) => c.email.endsWith("@kakao.invalid")
  const r1 = await runMarketingReconfirm({ db: d, now, send, skip })
  assert.deepEqual(r1, { due: 3, sent: 1 + 0, skipped: 1, failed: 1 })
  // 순서: 오래된 동의부터 — 아래 기록으로 확인
  assert.deepEqual(sentTo.map((x) => x[0]), [dueId])
  assert.equal(sentTo[0][3].startsWith("reconfirm:"), true)
  // 두 번째 실행: 성공·건너뜀은 다시 뽑히지 않고, 실패했던 사람만 이어서 보낸다
  const r2 = await runMarketingReconfirm({ db: d, now, send, skip })
  assert.deepEqual(r2, { due: 1, sent: 1, skipped: 0, failed: 0 })
  assert.deepEqual(sentTo.map((x) => x[0]), [dueId, failing])
  // 세 번째: 할 일 없음
  assert.deepEqual(await runMarketingReconfirm({ db: d, now, send, skip }), { due: 0, sent: 0, skipped: 0, failed: 0 })
  // 대상이 아닌 사람에게는 가지 않았다
  for (const id of [justUnder, withdrawnId, smsOnly]) assert.ok(!sentTo.some((x) => x[0] === id), id)
  // 기록: 기준 시각 = 그때의 동의 시각
  const [led] = await d.select().from(mailLedger).where(and(eq(mailLedger.userId, dueId), eq(mailLedger.key, "marketing_reconfirm")))
  assert.equal(led.refAt.toISOString(), sentTo[0][2])
  // 재확인 메일이 나간 뒤에는 보내기가 다시 열린다(답이 없으면 계속 — 규칙에 끊는다는 문구가 없다)
  assert.deepEqual(await canSendMarketing(d, dueId, { now }), { ok: true })
  // 계속 받기를 누르면 동의 시각이 갱신돼 다음 2년이 시작되고, 다시 뽑히지 않는다
  assert.ok((await keepByToken(d, keepToken(dueId, "email", SECRET, now), { secret: SECRET, now })).ok)
  assert.deepEqual(await runMarketingReconfirm({ db: d, now, send, skip }), { due: 0, sent: 0, skipped: 0, failed: 0 })
  // 2년 뒤에는 새 주기로 다시 대상이 된다
  const later = new Date(now.getTime() + 2 * 366 * 86_400_000)
  const r4 = await runMarketingReconfirm({ db: d, now: later, send, skip })
  assert.ok(r4.due >= 1 && r4.sent >= 1)
  assert.ok(sentTo.filter((x) => x[0] === dueId).length === 2)
})
