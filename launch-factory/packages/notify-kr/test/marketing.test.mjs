// 광고성 문자 규칙(순수) + 동의 확인기.
import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import { db, user as userTable, writeMarketingConsents } from "@launch-factory/db"
import { AD_PREFIX, checkMarketingText, composeMarketingText, consentGuard, isNight, isOptOutNumber, runCanMarketing } from "../src/index.ts"

test("composeMarketingText: (광고) 머리 + 끝에 수신거부 문구와 번호 · 머리를 겹쳐 붙이지 않는다", () => {
  assert.equal(composeMarketingText("가을 행사 안내", "080-123-4567"), "(광고) 가을 행사 안내\n무료수신거부 080-123-4567")
  assert.equal(composeMarketingText("(광고) 이미 있음", "080-123-4567"), "(광고) 이미 있음\n무료수신거부 080-123-4567")
  assert.equal(composeMarketingText("Sale", "080-123-4567", "en"), "(광고) Sale\nFree opt-out 080-123-4567")
})

test("checkMarketingText: 머리·문구·번호 중 하나라도 없으면 문제 이름", () => {
  const good = composeMarketingText("행사", "080-123-4567")
  assert.equal(checkMarketingText(good, "080-123-4567"), null)
  assert.equal(checkMarketingText("행사\n무료수신거부 080-123-4567", "080-123-4567"), "ad_prefix_missing")
  assert.equal(checkMarketingText(" (광고) 행사\n무료수신거부 080-123-4567", "080-123-4567"), "ad_prefix_missing", "맨 앞이어야 한다")
  assert.equal(checkMarketingText("(광고) 행사", "080-123-4567"), "opt_out_missing")
  assert.equal(checkMarketingText("(광고) 행사\n무료수신거부 080-999-0000", "080-123-4567"), "opt_out_missing")
  assert.equal(checkMarketingText("(광고) 행사\n무료수신거부 080-123-4567 끝", "080-123-4567"), "opt_out_missing", "번호가 끝에 와야 한다")
  assert.equal(checkMarketingText(good, undefined), "opt_out_missing")
  assert.equal(checkMarketingText(good, "abc"), "opt_out_missing")
  assert.equal(AD_PREFIX, "(광고)")
})

test("isOptOutNumber: 숫자 7~15개 · 080/1588 모양 허용 · 글자 거절", () => {
  for (const ok of ["080-123-4567", "0801234567", "1588-1234", "+82 80 123 4567"]) assert.ok(isOptOutNumber(ok), ok)
  for (const bad of ["", "080", "abc", "080-123-4567; x", undefined, 8012345678]) assert.ok(!isOptOutNumber(bad), String(bad))
})

test("isNight: 한국 시각 21:00 ~ 08:00", () => {
  assert.ok(!isNight(new Date("2026-10-22T03:00:00Z")), "12:00 KST")
  assert.ok(!isNight(new Date("2026-10-21T23:00:00Z")), "08:00 KST 정각부터 낮")
  assert.ok(isNight(new Date("2026-10-21T22:59:00Z")), "07:59 KST")
  assert.ok(!isNight(new Date("2026-10-22T11:59:00Z")), "20:59 KST")
  assert.ok(isNight(new Date("2026-10-22T12:00:00Z")), "21:00 KST")
})

test("runCanMarketing: 확인기가 없거나 던지거나 이상한 값을 주면 거절", async () => {
  const ctx = { channel: "sms", now: new Date() }
  assert.deepEqual(await runCanMarketing(undefined, "u", ctx), { ok: false, reason: "no_consent" })
  assert.deepEqual(await runCanMarketing(() => true, "u", ctx), { ok: true })
  assert.deepEqual(await runCanMarketing(async () => ({ ok: true }), "u", ctx), { ok: true })
  assert.deepEqual(await runCanMarketing(() => false, "u", ctx), { ok: false, reason: "no_consent" })
  assert.deepEqual(await runCanMarketing(() => ({ ok: false, reason: "reconfirm_pending" }), "u", ctx), { ok: false, reason: "reconfirm_pending" })
  assert.deepEqual(await runCanMarketing(() => { throw new Error("db down") }, "u", ctx), { ok: false, reason: "consent_check_failed" })
  assert.deepEqual(await runCanMarketing(() => "yes", "u", ctx), { ok: false, reason: "no_consent" })
  assert.deepEqual(await runCanMarketing(() => undefined, "u", ctx), { ok: false, reason: "no_consent" })
})

let d
before(async () => {
  d = await db.local()
})
after(async () => {
  await d?.$client.close()
})

test("consentGuard: sms 채널 동의가 있어야 통과 · 다른 채널 동의나 철회는 거절", async () => {
  const at = new Date("2026-10-01T00:00:00Z")
  const mk = async (id) => d.insert(userTable).values({ id, name: id, email: `${id}@example.com`, emailVerified: true, createdAt: at, updatedAt: at })
  await mk("g1")
  await mk("g2")
  await mk("g3")
  const guard = consentGuard(d)
  const ctx = { channel: "sms", now: new Date("2026-10-22T03:00:00Z") }
  assert.deepEqual(await guard("g1", ctx), { ok: false, reason: "no_consent" })
  await writeMarketingConsents(d, { userId: "g1", changes: { sms: true }, source: "sign_up", at })
  assert.deepEqual(await guard("g1", ctx), { ok: true })
  await writeMarketingConsents(d, { userId: "g2", changes: { email: true }, source: "sign_up", at })
  assert.equal((await guard("g2", ctx)).ok, false, "이메일 동의는 문자 동의가 아니다")
  await writeMarketingConsents(d, { userId: "g3", changes: { sms: true }, source: "sign_up", at })
  await writeMarketingConsents(d, { userId: "g3", changes: { sms: false }, source: "settings", at: new Date("2026-10-10T00:00:00Z") })
  assert.equal((await guard("g3", ctx)).ok, false, "철회")
})
