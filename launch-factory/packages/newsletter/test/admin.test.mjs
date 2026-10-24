// 뉴스레터 직원용 읽기·수신거부 대행(계획 3d L5) — 관리 화면 구획이 부르는 서비스 쪽.
// 지키는 것: 상태 거르기·검색·건수 / 줄에 토큰·서명 링크가 없다 / 동의 증빙은 상세에만(지우지 않는다) / 대행 수신거부는 링크 수신거부와 같은 전이·통지 /
// 모르는 id·uuid 아닌 id 는 없는 기록(DB 오류 아님). 대행으로는 철회만 한다 — 구독을 만들거나 확인해 주는 길은 만들지 않는다(동의는 구독자 본인의 것).
import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import { eq } from "drizzle-orm"
import { db, hitRateLimit, newsletterSubscribers } from "@launch-factory/db"
import { createMailer } from "@launch-factory/email"
import { createRateLimiter } from "@launch-factory/security/rate-limit"
import { createTurnstile } from "@launch-factory/security/turnstile"
import { createNewsletterService, NEWSLETTER_RETENTION } from "../src/index.ts"

let d
before(async () => {
  d = await db.local()
})
after(async () => {
  await d?.$client.close()
})

const day = 86_400_000
const at = new Date("2026-10-10T00:00:00.000Z")
const clock = { at, now: () => clock.at }

const requests = []
const mock = createMailer({ mode: "mock", log: () => {} })
// 서비스는 DB 가 열린 뒤(before) 첫 시험에서 만든다
let service
const make = () =>
  (service ??= createNewsletterService({
    db: d,
    mailer: { mode: mock.mode, send: (req) => (requests.push(req), mock.send(req)) },
    limiter: createRateLimiter({ store: { hit: (k, w, n) => hitRateLimit(d, k, w, n) }, now: clock.now }),
    turnstile: createTurnstile({ mode: "mock" }),
    secret: "lf-test-secret-not-real-0123456789abcdef",
    baseUrl: "https://sampleco.test",
    productName: "SampleCo",
    now: clock.now,
  }))

let seq = 0
const seed = async (status, extra = {}) => {
  const n = ++seq
  const consentAt = new Date(at.getTime() - n * day)
  const [row] = await d
    .insert(newsletterSubscribers)
    .values({
      email: `Reader${n}@Example.com`.toLowerCase(),
      status,
      locale: "en",
      source: "footer-form",
      consentVersion: "2026-09",
      consentAt,
      createdAt: consentAt,
      confirmSentAt: consentAt,
      confirmedAt: status === "pending" ? null : consentAt,
      unsubscribedAt: status === "unsubscribed" ? consentAt : null,
      expiresAt: status === "subscribed" ? null : new Date(at.getTime() + 10 * day),
      ...extra,
    })
    .returning()
  return row
}

test("직원용 목록 — 상태로 거르고 이메일 일부로 찾으며, total 은 거른 전체 건수·limit 는 줄 수만 자른다", async () => {
  const s = make()
  const [p1, p2, c1, u1] = [await seed("pending"), await seed("pending"), await seed("subscribed"), await seed("unsubscribed", { email: "Findme.Special@Example.com".toLowerCase() })]
  const all = await s.listForAdmin({ limit: 100 })
  assert.ok(all.total >= 4)
  assert.deepEqual(new Set(all.items.map((i) => i.status)), new Set(["pending", "subscribed", "unsubscribed"]))

  const pending = await s.listForAdmin({ status: "pending", limit: 100 })
  assert.ok(pending.items.length >= 2 && pending.items.every((i) => i.status === "pending"))
  assert.equal(pending.total, pending.items.length)
  assert.ok([p1.id, p2.id].every((id) => pending.items.some((i) => i.id === id)))
  assert.ok(!pending.items.some((i) => i.id === c1.id))

  const cut = await s.listForAdmin({ status: "pending", limit: 1 })
  assert.equal(cut.items.length, 1)
  assert.equal(cut.total, pending.total, "total 은 자르기 전 건수")

  const found = await s.listForAdmin({ search: "FINDME.special", limit: 100 })
  assert.deepEqual(found.items.map((i) => i.id), [u1.id])
  // 와일드카드 글자는 글자 그대로 찾는다(모든 줄이 걸리지 않는다)
  assert.equal((await s.listForAdmin({ search: "%", limit: 100 })).items.length, 0)
  assert.equal((await s.listForAdmin({ search: "_", limit: 100 })).items.length, 0)
  // 최근 신청 순
  const times = all.items.map((i) => i.consentAt.getTime())
  assert.deepEqual(times, [...times].sort((a, b) => b - a))
})

test("직원용 줄·상세에는 서명 링크·토큰이 없다 — 동의 증빙(판·시각)과 보유 기한은 상세에 있다", async () => {
  const s = make()
  const row = await seed("subscribed")
  const [item] = (await s.listForAdmin({ search: row.email, limit: 5 })).items
  const detail = await s.getForAdmin(row.id)
  for (const v of [item, detail]) {
    assert.ok(v)
    assert.deepEqual(Object.keys(v).filter((k) => /url|token|link|secret/i.test(k)), [])
    assert.ok(!JSON.stringify(v).includes("https://"), "링크가 새지 않는다")
  }
  assert.equal(detail.consentVersion, "2026-09")
  assert.equal(detail.consentAt.toISOString(), row.consentAt.toISOString())
  assert.equal(detail.confirmedAt.toISOString(), row.confirmedAt.toISOString())
  assert.equal(detail.expiresAt, null)
})

test("모르는 id·uuid 모양이 아닌 id 는 없는 기록이다(DB 형 변환 오류로 새지 않는다)", async () => {
  const s = make()
  assert.equal(await s.getForAdmin("00000000-0000-4000-8000-000000000000"), null)
  for (const bad of ["x", "' or 1=1 --", "reader@example.com", ""]) {
    assert.equal(await s.getForAdmin(bad), null)
    assert.deepEqual(await s.withdraw(bad), { ok: false, reason: "not_found" })
  }
})

test("대행 수신거부 — 구독 중인 사람은 철회 기록이 되고 동의·확인 증빙은 남으며, 처리 결과 통지가 한 통 가고, 두 번째는 변화·메일이 없다", async () => {
  const s = make()
  const row = await seed("subscribed")
  const before = requests.length
  clock.at = new Date(at.getTime() + day)
  assert.deepEqual(await s.withdraw(row.id), { ok: true, changed: true })
  const after = (await d.select().from(newsletterSubscribers).where(eq(newsletterSubscribers.id, row.id)))[0]
  assert.equal(after.status, "unsubscribed")
  assert.equal(after.unsubscribedAt.toISOString(), clock.at.toISOString())
  assert.equal(after.expiresAt.getTime() - clock.at.getTime(), NEWSLETTER_RETENTION.unsubscribedDays * day)
  assert.equal(after.consentAt.toISOString(), row.consentAt.toISOString(), "동의 증빙은 지우지 않는다")
  assert.equal(after.confirmedAt.toISOString(), row.confirmedAt.toISOString())
  const sent = requests.slice(before)
  assert.equal(sent.length, 1)
  assert.equal(sent[0].template, "marketingConsentNotice")
  assert.equal(sent[0].to, row.email)

  assert.deepEqual(await s.withdraw(row.id), { ok: true, changed: false })
  assert.equal(requests.length, before + 1)
})

test("확인 전(대기)에 대행 수신거부해도 철회가 되고, 동의한 적이 없으니 통지 메일은 없다", async () => {
  const s = make()
  const row = await seed("pending")
  const before = requests.length
  assert.deepEqual(await s.withdraw(row.id), { ok: true, changed: true })
  assert.equal((await s.getForAdmin(row.id)).status, "unsubscribed")
  assert.equal(requests.length, before)
})
