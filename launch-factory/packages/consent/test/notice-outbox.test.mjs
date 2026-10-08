// D210: 마케팅 수신 처리 결과 통지(정보통신망법 제50조제7항 · 시행령 제62조의2 — 14일 안)의 신뢰성. 보내기가 실패하면 로그만 남기고 끝나던 것을
// 발신함(marketing_notice_outbox)에 남기고 Cron 이 다시 보낸다. PGlite 메모리 DB 하나, 보내기 함수는 시험 대역이다(실패·성공을 마음대로 낸다).
import assert from "node:assert/strict"
import { test, before, beforeEach, after } from "node:test"
import { eq } from "drizzle-orm"
import { db, marketingNoticeOutbox, user as userTable } from "@launch-factory/db"
import { deliverNotice, NOTICE_MAX_ATTEMPTS, NOTICE_RETRY_DELAYS_MS, runNoticeRetries } from "../src/index.ts"

/** @type {Awaited<ReturnType<typeof db.local>>} */
let d
let seq = 0
const T0 = new Date("2026-10-05T01:00:00.000Z")
const H = 3600_000
const newUser = async () => {
  const id = `n-${++seq}`
  await d.insert(userTable).values({ id, name: "x", email: `${id}@example.com`, emailVerified: true, createdAt: T0, updatedAt: T0 })
  return id
}
const rowsOf = (userId) => d.select().from(marketingNoticeOutbox).where(eq(marketingNoticeOutbox.userId, userId))
const event = (userId, at = T0) => ({ userId, changes: [{ channel: "email", granted: true }], at })

/** 보내기 대역: 부른 것을 적고, mode 에 따라 성공·실패("code"를 이름으로 던진다)·건너뜀 */
function sender(mode = "ok") {
  const calls = []
  const state = { mode, code: "validation_error" }
  const send = async (n) => {
    calls.push(n)
    if (state.mode === "fail") throw new Error(`marketingConsentNotice email failed: ${state.code}`)
    if (state.mode === "skip") return "skipped"
  }
  return { send, calls, state }
}
const quiet = () => {
  const lines = []
  return { log: (...a) => lines.push(a.map(String).join(" ")), lines }
}

before(async () => {
  d = await db.local()
})
beforeEach(async () => {
  await d.delete(marketingNoticeOutbox) // 시험마다 빈 발신함 — 다른 시험이 남긴 대기 통지가 「때가 된 수」를 흐리지 않게
})
after(async () => {
  await d?.$client.close()
})

test("보내기가 되면 발신함에 아무것도 남기지 않는다(양성 대조)", async () => {
  const u = await newUser()
  const s = sender("ok")
  const out = await deliverNotice({ db: d, event: event(u), source: "settings", send: s.send, now: () => T0 })
  assert.deepEqual(out, { outcome: "sent" })
  assert.equal(s.calls.length, 1)
  assert.equal((await rowsOf(u)).length, 0)
})

test("보내기가 실패하면 발신함에 남는다 — 시도 횟수·다음 시도 시각·마지막 오류 코드만, 메일 본문·주소는 없다", async () => {
  const u = await newUser()
  const s = sender("fail")
  const q = quiet()
  const out = await deliverNotice({ db: d, event: event(u), source: "sign_up", send: s.send, now: () => T0, log: q.log })
  assert.deepEqual(out, { outcome: "queued" })
  const [row] = await rowsOf(u)
  assert.equal(row.status, "pending")
  assert.equal(row.attempts, 1)
  assert.equal(row.source, "sign_up")
  assert.equal(row.lastErrorCode, "validation_error")
  assert.equal(row.nextAttemptAt.toISOString(), new Date(T0.getTime() + NOTICE_RETRY_DELAYS_MS[0]).toISOString())
  assert.deepEqual(row.changes, [{ channel: "email", granted: true }])
  assert.equal(row.changedAt.toISOString(), T0.toISOString())
  // 저장된 것에 주소·이름·메일 글이 없다(이미 저장된 사용자 id·채널·사실·시각뿐)
  const stored = JSON.stringify(row)
  assert.ok(!stored.includes("@example.com") && !/marketingConsentNotice|subject|body/i.test(stored), stored)
  assert.ok(q.lines.some((l) => l.includes("queued") && l.includes(row.id)), q.lines.join("\n"))
})

test("Cron: 때가 되기 전엔 아무것도 보내지 않고, 때가 되면 한 번 보내 sent 로 닫는다 — 같은 멱등 키가 메일에 간다", async () => {
  const u = await newUser()
  const fail = sender("fail")
  await deliverNotice({ db: d, event: event(u), source: "settings", send: fail.send, now: () => T0 })
  const [queued] = await rowsOf(u)

  const ok = sender("ok")
  const early = await runNoticeRetries({ db: d, send: ok.send, now: () => new Date(T0.getTime() + NOTICE_RETRY_DELAYS_MS[0] - 1) })
  assert.equal(early.due, 0)
  assert.equal(ok.calls.length, 0)

  const dueAt = new Date(T0.getTime() + NOTICE_RETRY_DELAYS_MS[0])
  const first = await runNoticeRetries({ db: d, send: ok.send, now: () => dueAt })
  assert.deepEqual({ due: first.due, sent: first.sent, failed: first.failed, exhausted: first.exhausted }, { due: 1, sent: 1, failed: 0, exhausted: 0 })
  assert.equal(ok.calls.length, 1)
  assert.equal(ok.calls[0].userId, u)
  assert.deepEqual(ok.calls[0].changes, [{ channel: "email", granted: true }])
  assert.equal(ok.calls[0].at.toISOString(), T0.toISOString(), "의사를 표시한 때가 그대로 간다(재시도한 때가 아니다)")
  assert.equal(ok.calls[0].idempotencyKey, `notice:${queued.id}`)
  assert.equal(ok.calls[0].attempt, 2)
  const [done] = await rowsOf(u)
  assert.equal(done.status, "sent")
  assert.equal(done.attempts, 2)
  assert.equal(done.settledAt.toISOString(), dueAt.toISOString())
})

test("Cron 을 또 돌려도(두 번째·세 번째) 이미 보낸 통지는 다시 보내지 않는다", async () => {
  const u = await newUser()
  await deliverNotice({ db: d, event: event(u), source: "settings", send: sender("fail").send, now: () => T0 })
  const ok = sender("ok")
  const at = new Date(T0.getTime() + 2 * H)
  await runNoticeRetries({ db: d, send: ok.send, now: () => at })
  const before = (await rowsOf(u))[0]
  for (const later of [at, new Date(at.getTime() + 5 * H), new Date(at.getTime() + 500 * H)]) {
    const r = await runNoticeRetries({ db: d, send: ok.send, now: () => later })
    assert.equal(r.due, 0)
  }
  assert.equal(ok.calls.length, 1, "두 번 이상 보냈다")
  assert.deepEqual((await rowsOf(u))[0], before, "닫힌 행이 바뀌었다")
})

test("Cron 두 개가 동시에 와도(Promise.all) 한 통만 나간다 — 먼저 잡은 쪽만 보낸다", async () => {
  const u = await newUser()
  await deliverNotice({ db: d, event: event(u), source: "settings", send: sender("fail").send, now: () => T0 })
  const ok = sender("ok")
  const at = new Date(T0.getTime() + 2 * H)
  const [a, b] = await Promise.all([runNoticeRetries({ db: d, send: ok.send, now: () => at }), runNoticeRetries({ db: d, send: ok.send, now: () => at })])
  assert.equal(ok.calls.length, 1, `두 실행이 ${ok.calls.length}통을 보냈다`)
  assert.equal(a.sent + b.sent, 1)
  assert.equal((await rowsOf(u))[0].status, "sent")
})

test("재시도가 계속 실패하면 늘어나는 간격으로 미루고, 시도 횟수 상한에서 멈추고(exhausted) 알린다 — 그 뒤로는 다시 보내지 않는다", async () => {
  const u = await newUser()
  const s = sender("fail")
  const q = quiet()
  const exhausted = []
  await deliverNotice({ db: d, event: event(u), source: "settings", send: s.send, now: () => T0, log: q.log })
  let now = T0
  const gaps = []
  for (let attempt = 2; attempt <= NOTICE_MAX_ATTEMPTS; attempt++) {
    const [row] = await rowsOf(u)
    gaps.push(row.nextAttemptAt.getTime() - now.getTime())
    now = row.nextAttemptAt
    s.state.code = attempt === NOTICE_MAX_ATTEMPTS ? "rate_limit_exceeded" : "validation_error"
    const r = await runNoticeRetries({ db: d, send: s.send, now: () => now, log: q.log, onExhausted: (n) => exhausted.push(n) })
    assert.equal(r.due, 1)
    assert.equal(r.sent, 0)
    if (attempt < NOTICE_MAX_ATTEMPTS) assert.deepEqual({ failed: r.failed, exhausted: r.exhausted }, { failed: 1, exhausted: 0 })
    else assert.deepEqual({ failed: r.failed, exhausted: r.exhausted }, { failed: 0, exhausted: 1 })
  }
  assert.deepEqual(gaps, NOTICE_RETRY_DELAYS_MS.slice(0, NOTICE_MAX_ATTEMPTS - 1), "간격이 정해진 순서로 늘어난다")
  for (let i = 1; i < gaps.length; i++) assert.ok(gaps[i] > gaps[i - 1], "간격은 줄지 않는다")
  const [row] = await rowsOf(u)
  assert.equal(row.status, "exhausted")
  assert.equal(row.attempts, NOTICE_MAX_ATTEMPTS)
  assert.equal(row.lastErrorCode, "rate_limit_exceeded")
  assert.equal(s.calls.length, NOTICE_MAX_ATTEMPTS, "처음 한 번 + 재시도")
  // 알림: 콜백 한 번(식별자·사용자·횟수·마지막 코드 — 메일 내용 없음) + 로그 한 줄
  assert.equal(exhausted.length, 1)
  assert.deepEqual(Object.keys(exhausted[0]).sort(), ["attempts", "changedAt", "id", "lastErrorCode", "source", "userId"])
  assert.equal(exhausted[0].id, row.id)
  assert.ok(q.lines.filter((l) => l.includes("exhausted") && l.includes(row.id)).length === 1, q.lines.join("\n"))
  // 상한 시간은 법정 기한(14일) 안이다
  const total = NOTICE_RETRY_DELAYS_MS.slice(0, NOTICE_MAX_ATTEMPTS - 1).reduce((a, b) => a + b, 0)
  assert.ok(total < 14 * 24 * H, `마지막 시도가 ${total / H}시간 뒤 — 14일 안이어야 한다`)
  // 이후 아무리 돌려도 보내지 않고 다시 알리지도 않는다
  const send2 = sender("ok")
  const later = await runNoticeRetries({ db: d, send: send2.send, now: () => new Date(now.getTime() + 1000 * H), onExhausted: (n) => exhausted.push(n) })
  assert.deepEqual({ due: later.due, sent: later.sent, exhausted: later.exhausted }, { due: 0, sent: 0, exhausted: 0 })
  assert.equal(send2.calls.length, 0)
  assert.equal(exhausted.length, 1)
})

test("보낼 곳이 없는 사용자(skipped)는 재시도 대상이 아니다 — 큐에 남기지 않는다", async () => {
  const u = await newUser()
  const s = sender("skip")
  const q = quiet()
  const out = await deliverNotice({ db: d, event: event(u), source: "settings", send: s.send, now: () => T0, log: q.log })
  assert.deepEqual(out, { outcome: "skipped" })
  assert.equal((await rowsOf(u)).length, 0)
  assert.ok(q.lines.some((l) => l.includes("skipped")), "건너뛴 사실은 로그로 남는다")
  // 재시도 중에 건너뜀이 나오면(주소가 사라진 경우) 행을 skipped 로 닫는다
  const u2 = await newUser()
  await deliverNotice({ db: d, event: event(u2), source: "settings", send: sender("fail").send, now: () => T0 })
  const r = await runNoticeRetries({ db: d, send: sender("skip").send, now: () => new Date(T0.getTime() + 2 * H) })
  assert.equal(r.skipped, 1)
  assert.equal((await rowsOf(u2))[0].status, "skipped")
})

test("보내기도 큐에 넣기도 안 되면 던진다 — 호출한 쪽이 로그로 남긴다(조용히 사라지지 않는다)", async () => {
  const broken = { insert: () => { throw new Error("db down") } }
  await assert.rejects(deliverNotice({ db: broken, event: event("nobody"), source: "settings", send: sender("fail").send, now: () => T0, log: () => {} }), /db down/)
})

test("사용자를 지우면(탈퇴) 그 사람의 발신함 행도 같이 지워진다", async () => {
  const u = await newUser()
  await deliverNotice({ db: d, event: event(u), source: "settings", send: sender("fail").send, now: () => T0 })
  assert.equal((await rowsOf(u)).length, 1)
  await d.delete(userTable).where(eq(userTable.id, u))
  assert.equal((await rowsOf(u)).length, 0)
})
