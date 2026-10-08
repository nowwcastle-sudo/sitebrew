// D188: Vercel Cron 은 최선 노력 전달이고 같은 실행이 두 번 올 수 있다(Vercel 문서, 2026-08-11). `runScheduledChanges` 를 같은 시각으로 두 번 연달아(그리고 동시에) 돌려도
// 안전한지 단정한다 — 두 번째 실행은 DB 를 한 글자도 바꾸지 않고, 공급자(가짜 Paddle)에 쓰기 호출을 더하지 않고, 메일을 더 보내지 않는다.
import { test, before, after } from "node:test"
import assert from "node:assert/strict"
import { sql } from "drizzle-orm"
import { CD } from "../src/index.ts"
import { DAY, setup } from "./harness.mjs"

let h
before(async () => {
  h = await setup()
})
after(async () => {
  await h?.close()
})

async function subscribed(status = "active", priceId = "pri_pro") {
  const userId = await h.newUser()
  const s = h.fake.seed({ status, priceId, customData: { [CD.userId]: userId } })
  const r = await h.deliver(h.fake.envelope("subscription.created", s))
  assert.equal(r.status, 200)
  return { userId, subId: s.id }
}
async function row(subId) {
  const r = await h.d.execute(sql`select * from subscriptions where provider_sub_id = ${subId}`)
  return (r.rows ?? r)[0] ?? null
}
/** DB 전체 모양(구독·웹훅 이벤트 표의 모든 행) */
async function dbSnapshot() {
  const a = await h.d.execute(sql`select * from subscriptions order by id`)
  const b = await h.d.execute(sql`select * from webhook_events order by event_id`)
  return JSON.stringify([a.rows ?? a, b.rows ?? b])
}
const providerWrites = () => h.fake.calls.filter((c) => c.method !== "GET").length
const state = async (subId) => ({ db: await dbSnapshot(), writes: providerWrites(), mails: h.sent.length, provider: JSON.stringify(h.fake.get(subId)) })

/** 같은 시각으로 두 번째 실행: 보고는 비어 있고, DB·공급자·메일이 첫 실행 뒤와 같다 */
async function assertSecondRunIsNoop(at, subId, first) {
  const after1 = await state(subId)
  const second = await h.base().runScheduledChanges(at)
  for (const k of ["switched", "lapsed", "tooLate", "failed"]) assert.ok(!second[k].some((x) => (x.subId ?? x) === subId), `두 번째 실행이 ${k} 에 같은 구독을 또 올렸다: ${JSON.stringify(second[k])}`)
  assert.deepEqual(await state(subId), after1, "두 번째 실행이 DB·공급자 호출·메일 중 하나를 바꿨다")
  return { first, second }
}

test("D188 기간 끝 요금제 예약: 같은 시각으로 두 번 돌려도 항목 변경은 한 번이고 DB·메일은 그대로다", async () => {
  const { subId, userId } = await subscribed("active", "pri_pro")
  assert.ok((await h.base().port({ userId }).changePlan({ planId: "basic", when: "period_end" })).ok)
  const at = new Date(Date.parse((await row(subId)).current_period_end) - 3 * 3600_000)
  const itemPatches = () => h.fake.calls.filter((c) => c.method === "PATCH" && c.path.endsWith(subId) && c.body?.items).length
  const before = itemPatches()
  const first = await h.base().runScheduledChanges(at)
  assert.deepEqual(first.switched.find((s) => s.subId === subId), { subId, priceId: "pri_basic", reason: "scheduled_plan" })
  assert.equal(itemPatches(), before + 1)
  await assertSecondRunIsNoop(at, subId, first)
  assert.equal(itemPatches(), before + 1, "항목 변경 PATCH 가 한 번뿐이다")
  assert.equal(h.fake.get(subId).items[0].price.id, "pri_basic")
  assert.equal((await row(subId)).plan_id, "basic")
})

test("D188 동의받은 가격 인상: 두 번 돌려도 새 가격으로의 변경은 한 번이다", async () => {
  const { subId, userId } = await subscribed()
  const periodEnd = Date.parse((await row(subId)).current_period_end)
  const near = h.make({ now: () => new Date(periodEnd - 20 * DAY) })
  const money = (amount) => ({ amount, currency: "USD", vatIncluded: false })
  assert.ok((await near.schedulePriceChange({ providerSubId: subId, priceId: "pri_pro_2027", kind: "price_increase", from: money(2900), to: money(3300), consentBy: new Date(periodEnd - 7 * DAY).toISOString() })).ok)
  assert.ok((await near.port({ userId }).acceptPriceChange()).ok)
  const at = new Date(periodEnd - 2 * 3600_000)
  const first = await h.base().runScheduledChanges(at)
  assert.deepEqual(first.switched.find((x) => x.subId === subId), { subId, priceId: "pri_pro_2027", reason: "accepted_price" })
  await assertSecondRunIsNoop(at, subId, first)
  assert.equal(h.fake.get(subId).items[0].price.id, "pri_pro_2027")
})

test("D188 동의 기한이 지난 가격 인상·체험 후 유료 전환: 두 번 돌려도 예정 삭제·해지는 한 번이고 두 번째는 아무것도 쓰지 않는다", async () => {
  const money = (amount) => ({ amount, currency: "USD", vatIncluded: false })
  // 가격 인상(무응답): 예정을 지우고 옛 가격 유지
  const inc = await subscribed()
  const incEnd = Date.parse((await row(inc.subId)).current_period_end)
  const near = h.make({ now: () => new Date(incEnd - 20 * DAY) })
  const incConsentBy = new Date(incEnd - 7 * DAY)
  assert.ok((await near.schedulePriceChange({ providerSubId: inc.subId, priceId: "pri_pro_2027", kind: "price_increase", from: money(2900), to: money(3300), consentBy: incConsentBy.toISOString() })).ok)
  const incAt = new Date(incConsentBy.getTime() + 3600_000)
  const incFirst = await h.base().runScheduledChanges(incAt)
  assert.ok(incFirst.lapsed.some((x) => x.subId === inc.subId && x.kind === "price_increase"))
  await assertSecondRunIsNoop(incAt, inc.subId, incFirst)
  assert.equal((await row(inc.subId)).pending_price_change, null)
  assert.equal(h.fake.get(inc.subId).items[0].price.id, "pri_pro")

  // 체험 → 유료 전환(무응답): 유료로 넘어가지 않게 해지 예약
  const trial = await subscribed("trialing", "pri_pro_trial")
  const trialEnd = Date.parse((await row(trial.subId)).current_period_end)
  const nearT = h.make({ now: () => new Date(trialEnd - 10 * DAY) })
  const trialConsentBy = new Date(trialEnd - 7 * DAY)
  assert.ok((await nearT.schedulePriceChange({ providerSubId: trial.subId, priceId: "pri_pro", kind: "trial_to_paid", from: money(0), to: money(2900), consentBy: trialConsentBy.toISOString() })).ok)
  const cancels = () => h.fake.calls.filter((c) => c.method === "POST" && /\/cancel$/.test(c.path) && c.path.includes(trial.subId)).length
  const cancelsBefore = cancels()
  const trialAt = new Date(trialConsentBy.getTime() + 3600_000)
  const trialFirst = await h.base().runScheduledChanges(trialAt)
  assert.ok(trialFirst.lapsed.some((x) => x.subId === trial.subId && x.kind === "trial_to_paid"))
  assert.equal(cancels(), cancelsBefore + 1)
  await assertSecondRunIsNoop(trialAt, trial.subId, trialFirst)
  assert.equal(cancels(), cancelsBefore + 1, "해지 호출이 한 번뿐이다")
})

test("D188 같은 Cron 이 동시에 두 번 와도(Promise.all) 최종 상태는 한 번 돌린 것과 같고 메일은 늘지 않는다", async () => {
  const { subId, userId } = await subscribed("active", "pri_pro")
  assert.ok((await h.base().port({ userId }).changePlan({ planId: "basic", when: "period_end" })).ok)
  const at = new Date(Date.parse((await row(subId)).current_period_end) - 3 * 3600_000)
  const mailsBefore = h.sent.length
  const [a, b] = await Promise.all([h.base().runScheduledChanges(at), h.base().runScheduledChanges(at)])
  assert.equal(a.failed.length + b.failed.length, 0, JSON.stringify([a.failed, b.failed]))
  assert.equal(h.fake.get(subId).items[0].price.id, "pri_basic")
  const saved = await row(subId)
  assert.equal(saved.plan_id, "basic")
  assert.equal(h.sent.length, mailsBefore, "동시 실행이 메일을 보냈다")
  // 동시 실행 뒤 한 번 더: 아무것도 바뀌지 않는다
  const settled = await state(subId)
  await h.base().runScheduledChanges(at)
  assert.deepEqual(await state(subId), settled)
})
