// 뉴스레터 구독 명단 — 요청 제한·멱등 키·Turnstile → 이중 동의(확인 메일) → 구독 완료 안내 → 서명 수신거부(RFC 8058 POST 포함) → 내보내기용 목록 → 파기.
// PGlite 메모리 DB 하나를 모든 시험이 나눠 쓴다(메모리 절약). 시계는 시험마다 가짜로 돌린다.
import { test, before, after } from "node:test"
import assert from "node:assert/strict"
import { count, eq } from "drizzle-orm"
import { db, hitRateLimit, idempotencyKeys, newsletterSubscribers } from "@launch-factory/db"
import { createMailer } from "@launch-factory/email"
import { MESSAGES } from "@launch-factory/i18n"
import { createRateLimiter, RATE_LIMIT_DEFAULTS } from "@launch-factory/security/rate-limit"
import { createTurnstile } from "@launch-factory/security/turnstile"
import { createNewsletterHandlers, createNewsletterService, NEWSLETTER_CONSENT_VERSION, NEWSLETTER_RETENTION, newsletterLinks } from "../src/index.ts"
import { DUMMY_TOKEN, fakeSiteverify, RECORDED, TEST_SECRET_PASS } from "../../security/test/turnstile-fixtures.mjs"

/** @type {Awaited<ReturnType<typeof db.local>>} */
let d
before(async () => {
  d = await db.local()
})
after(async () => {
  await d?.$client.close()
})

const SECRET = "lf-test-secret-not-real-0123456789abcdef"
const BASE = "https://sampleco.test"
const day = 86_400_000
const clock = (iso) => {
  const c = { at: new Date(iso) }
  c.now = () => c.at
  c.tick = (ms) => (c.at = new Date(c.at.getTime() + ms))
  return c
}
let seq = 0
const freshIp = () => `198.51.100.${++seq}`
const freshEmail = () => `reader${++seq}@example.com`
const store = () => ({ hit: (k, w, n) => hitRateLimit(d, k, w, n) })

function setup({ turnstile, now = clock("2026-10-01T03:00:00.000Z"), mailer: custom, ...rest } = {}) {
  const lines = []
  const mock = createMailer({ mode: "mock", log: (l) => lines.push(l) })
  const requests = []
  const mailer = custom ?? { mode: mock.mode, send: (req) => (requests.push(req), mock.send(req)) }
  const cf = fakeSiteverify({ spent: RECORDED.duplicate })
  const errors = []
  const svc = createNewsletterService({
    db: d,
    mailer,
    limiter: createRateLimiter({ store: store(), now: now.now }),
    turnstile: turnstile ?? createTurnstile({ mode: "live", secretKey: TEST_SECRET_PASS, fetch: cf.fetch }),
    secret: SECRET,
    baseUrl: BASE,
    productName: "SampleCo",
    now: now.now,
    onError: (e) => errors.push(e.message),
    ...rest,
  })
  const sent = (template) => requests.filter((r) => r.template === template)
  return { svc, requests, sent, cf, errors, now, lines }
}
const form = (extra = {}) => ({ email: freshEmail(), consent: "yes", "cf-turnstile-response": DUMMY_TOKEN, ...extra })
const rowOf = async (email) => (await d.select().from(newsletterSubscribers).where(eq(newsletterSubscribers.email, email.toLowerCase())))[0]
const tokenOf = (url) => new URL(url).searchParams.get("t")
/** 구독 확인 메일에서 확인 토큰을 꺼낸다 */
const confirmTokenFrom = (req) => tokenOf(req.input.confirmUrl)

// ── 구독 신청 ────────────────────────────────────────────────────────────────

test("신청하면 대기(pending) 행이 생긴다 — 이메일은 소문자, 동의 문구 판·시각·언어·출처가 남고, 확인 메일이 정확히 한 통 간다", async () => {
  const { svc, sent, now } = setup()
  const input = form({ email: "  Jamie.Reader@Example.COM ", source: "footer-form" })
  const r = await svc.subscribe(input, { ip: freshIp(), locale: "ko" })
  assert.deepEqual(r, { ok: true, data: { message: MESSAGES.ko.newsletter.subscribed } })

  const row = await rowOf("jamie.reader@example.com")
  assert.deepEqual([row.status, row.locale, row.source, row.consentVersion], ["pending", "ko", "footer-form", NEWSLETTER_CONSENT_VERSION])
  assert.equal(row.consentAt.toISOString(), now.at.toISOString())
  assert.equal(row.confirmedAt, null)
  assert.equal(row.unsubscribedAt, null)
  assert.equal(row.confirmSentAt.toISOString(), now.at.toISOString())
  assert.equal(row.expiresAt.getTime() - now.at.getTime(), NEWSLETTER_RETENTION.pendingDays * day, "확인하지 않은 신청은 기한이 지나면 파기")
  // 저장하지 않는 것: IP·브라우저 정보·토큰
  assert.deepEqual(Object.keys(row).filter((k) => /(^ip|Ip$|ipAddress|agent|token)/i.test(k)), [])

  const mails = sent("newsletterConfirm")
  assert.equal(mails.length, 1)
  assert.equal(mails[0].to, "jamie.reader@example.com")
  assert.equal(mails[0].input.locale, "ko")
  assert.equal(mails[0].input.linkValidMinutes, 7 * 24 * 60)
  assert.match(mails[0].idempotencyKey, new RegExp(`^newsletter-confirm:${row.id}:`))
  assert.deepEqual(sent("newsletterWelcome"), [], "확인 전에는 구독 완료 안내도 없다")
})

test("동의 체크가 없으면 칸 오류 — 저장·메일·Turnstile 검증이 모두 없다", async () => {
  const { svc, requests, cf } = setup()
  const email = freshEmail()
  const r = await svc.subscribe({ email, "cf-turnstile-response": DUMMY_TOKEN }, { ip: freshIp(), locale: "en" })
  assert.deepEqual(r, { ok: false, fieldErrors: { consent: [MESSAGES.en.newsletter.consentRequired] } })
  assert.equal(await rowOf(email), undefined)
  assert.deepEqual(requests, [])
  assert.equal(cf.calls.length, 0, "칸을 고쳐 다시 보낼 때 토큰을 태우지 않는다")
  const bad = await svc.subscribe({ email: "nope", consent: "yes" }, { ip: freshIp() })
  assert.deepEqual(bad.fieldErrors, { email: [MESSAGES.en.newsletter.emailInvalid] })
})

test("이미 구독 중인 주소로 신청해도 같은 응답 — 메일도, 행의 변화도 없다(존재 여부를 알리지 않는다)", async () => {
  const { svc, sent } = setup()
  const email = freshEmail()
  const first = await svc.subscribe(form({ email }), { ip: freshIp() })
  const token = confirmTokenFrom(sent("newsletterConfirm")[0])
  assert.deepEqual(await svc.confirm(token), { ok: true, changed: true })
  const before = await rowOf(email)

  const again = await svc.subscribe(form({ email: email.toUpperCase() }), { ip: freshIp() })
  assert.deepEqual(again, first, "처음 신청과 글자 하나 다르지 않은 응답")
  assert.equal(sent("newsletterConfirm").length, 1)
  assert.deepEqual(await rowOf(email), before)
})

test("대기 중인 주소로 다시 신청하면 5분 안에는 메일을 또 보내지 않고, 지나면 새 확인 메일(새 멱등 키) — 메일 폭탄 방지", async () => {
  const c = clock("2026-10-02T00:00:00.000Z")
  const { svc, sent } = setup({ now: c })
  const email = freshEmail()
  await svc.subscribe(form({ email }), { ip: freshIp() })
  c.tick(60_000)
  const second = await svc.subscribe(form({ email }), { ip: freshIp() })
  assert.equal(second.ok, true)
  assert.equal(sent("newsletterConfirm").length, 1, "1분 뒤: 보내지 않는다")
  c.tick(5 * 60_000)
  await svc.subscribe(form({ email }), { ip: freshIp() })
  const mails = sent("newsletterConfirm")
  assert.equal(mails.length, 2)
  assert.notEqual(mails[0].idempotencyKey, mails[1].idempotencyKey, "공급자 중복 제거에 먹히지 않게 보낼 때마다 다른 키")
  assert.equal((await d.select({ n: count() }).from(newsletterSubscribers).where(eq(newsletterSubscribers.email, email))).at(0).n, 1)
})

test("멱등 키: 같은 키로 두 번(연달아) 보내면 행 하나·확인 메일 한 통 — Turnstile 도 다시 검증하지 않는다", async () => {
  const { svc, sent, cf } = setup()
  const ip = freshIp()
  const input = form({ idempotencyKey: "form-open-news-0001" })
  const first = await svc.subscribe(input, { ip })
  const again = await svc.subscribe(input, { ip })
  assert.deepEqual(again, first)
  assert.equal(sent("newsletterConfirm").length, 1)
  assert.equal(cf.calls.length, 1)
  // 칸 오류로 막힌 제출은 키에 남지 않는다
  const key = "form-open-news-0002"
  assert.equal((await svc.subscribe(form({ idempotencyKey: key, consent: "" }), { ip })).ok, false)
  assert.equal((await d.select({ n: count() }).from(idempotencyKeys).where(eq(idempotencyKeys.key, key)))[0].n, 0)
})

test("요청 제한: 한도를 넘으면 429 + Retry-After(라우트), 서버 액션은 code·retryAfter — 막힌 요청은 저장되지 않는다", async () => {
  const { svc, requests } = setup()
  const ip = freshIp()
  const handlers = createNewsletterHandlers(svc)
  const post = (fields) => {
    const body = new FormData()
    for (const [k, v] of Object.entries(fields)) body.set(k, v)
    return handlers.subscribe(new Request(`${BASE}/api/newsletter`, { method: "POST", body, headers: { "x-forwarded-for": ip } }))
  }
  const { max, windowSec } = RATE_LIMIT_DEFAULTS.newsletter
  for (let i = 0; i < max; i++) assert.equal((await post(form())).status, 200, `${i + 1}번째`)
  const blockedInput = form()
  const blocked = await post(blockedInput)
  assert.equal(blocked.status, 429)
  assert.equal(blocked.headers.get("retry-after"), String(windowSec))
  assert.equal(await rowOf(blockedInput.email), undefined)
  assert.equal(requests.length, max)
  const viaAction = await svc.action({ ip, locale: "ko" })(form())
  assert.equal(viaAction.code, "rate_limited")
  assert.equal(viaAction.retryAfter, windowSec)
})

test("라우트 처리기: 봇 확인 실패 400, 칸 오류 400, 성공 200(JSON), POST 아니면 405, 처리 중 409", async () => {
  const { svc, now } = setup()
  const handlers = createNewsletterHandlers(svc)
  const post = (fields, ip = freshIp()) => {
    const body = new FormData()
    for (const [k, v] of Object.entries(fields)) body.set(k, v)
    return handlers.subscribe(new Request(`${BASE}/api/newsletter`, { method: "POST", body, headers: { "x-forwarded-for": ip } }))
  }
  const noToken = form()
  delete noToken["cf-turnstile-response"]
  const r1 = await post(noToken)
  assert.equal(r1.status, 400)
  assert.equal((await r1.json()).code, "bot_check_failed")
  assert.equal((await post(form({ "cf-turnstile-response": "forged" }))).status, 400)
  assert.equal((await post(form({ consent: "" }))).status, 400)
  const ok = await post(form())
  assert.equal(ok.status, 200)
  assert.equal((await ok.json()).ok, true)
  assert.equal((await handlers.subscribe(new Request(`${BASE}/api/newsletter`))).status, 405)
  // JSON 본문도 받는다
  const json = await handlers.subscribe(new Request(`${BASE}/api/newsletter`, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": freshIp() }, body: JSON.stringify(form()) }))
  assert.equal(json.status, 200)
  // 죽은 요청이 남긴 처리 중 표시
  await d.insert(idempotencyKeys).values({ scope: "newsletter:newsletter", key: "form-open-stuck-news", result: null, createdAt: now.at })
  const stuck = await post(form({ idempotencyKey: "form-open-stuck-news" }))
  assert.equal(stuck.status, 409)
})

test("mock 모드 Turnstile 은 토큰 없이 통과한다(키 없는 개발 흐름)", async () => {
  const { svc } = setup({ turnstile: createTurnstile({ mode: "mock" }) })
  const input = form()
  delete input["cf-turnstile-response"]
  assert.equal((await svc.subscribe(input, { ip: freshIp() })).ok, true)
})

test("메일 공급자가 실패해도 신청은 받는다 — 응답은 같고(존재 여부를 알리지 않는다), 보낸 시각은 비고, 오류에 이메일 주소·비밀값이 없다. 다시 신청하면 보낸다", async () => {
  const failing = { mode: "live", send: async () => ({ ok: false, mode: "live", error: { name: "rate_limit_exceeded", statusCode: 429, message: "slow down" } }) }
  const f = setup({ mailer: failing })
  const email = freshEmail()
  const r = await f.svc.subscribe(form({ email }), { ip: freshIp() })
  assert.equal(r.ok, true)
  const row = await rowOf(email)
  assert.equal(row.confirmSentAt, null)
  assert.equal(f.errors.length, 1)
  assert.match(f.errors[0], /confirm mail failed \(rate_limit_exceeded\)/)
  for (const e of f.errors) assert.ok(!e.includes(email) && !e.includes(SECRET) && !e.includes("@"), e)
  // 보낸 적 없으니 쿨다운 없이 바로 다시 보낼 수 있다
  const ok = setup({ now: f.now })
  await ok.svc.subscribe(form({ email }), { ip: freshIp() })
  assert.equal(ok.sent("newsletterConfirm").length, 1)
  assert.ok((await rowOf(email)).confirmSentAt)
})

// ── 구독 확인 ────────────────────────────────────────────────────────────────

test("확인 링크를 누르면 구독 완료 — 확인 시각이 남고 기한이 풀리며, 구독 완료 안내(전송자·동의일·수신거부 링크)가 한 통 간다. 다시 눌러도 그대로", async () => {
  const c = clock("2026-10-03T00:00:00.000Z")
  const { svc, sent } = setup({ now: c, senderName: "SampleCo Inc." })
  const email = freshEmail()
  await svc.subscribe(form({ email }), { ip: freshIp(), locale: "en" })
  const token = confirmTokenFrom(sent("newsletterConfirm")[0])
  c.tick(2 * day)
  assert.deepEqual(await svc.confirm(token), { ok: true, changed: true })
  const row = await rowOf(email)
  assert.deepEqual([row.status, row.expiresAt], ["subscribed", null])
  assert.equal(row.confirmedAt.toISOString(), c.at.toISOString())
  assert.equal(row.consentAt.toISOString(), "2026-10-03T00:00:00.000Z", "동의한 날은 신청한 날이다 — 확인한 날이 아니다")

  const welcome = sent("newsletterWelcome")
  assert.equal(welcome.length, 1)
  assert.equal(welcome[0].to, email)
  assert.deepEqual([welcome[0].input.senderName, welcome[0].input.consentAt], ["SampleCo Inc.", "2026-10-03T00:00:00.000Z"])
  assert.equal(welcome[0].input.unsubscribeUrl, newsletterLinks({ baseUrl: BASE, secret: SECRET, id: row.id, consentAt: row.consentAt }).unsubscribeUrl)
  assert.match(welcome[0].idempotencyKey, new RegExp(`^newsletter-welcome:${row.id}`))

  assert.deepEqual(await svc.confirm(token), { ok: true, changed: false })
  assert.equal(sent("newsletterWelcome").length, 1, "두 번째 클릭(메일 보안 프로그램의 미리 열기 포함)은 메일을 또 보내지 않는다")
})

test("확인 링크는 7일 뒤 닫히고, 위조·깨진 값·다른 용도의 토큰은 invalid — 행은 그대로 대기", async () => {
  const c = clock("2026-10-04T00:00:00.000Z")
  const { svc, sent } = setup({ now: c })
  const email = freshEmail()
  await svc.subscribe(form({ email }), { ip: freshIp() })
  const token = confirmTokenFrom(sent("newsletterConfirm")[0])
  for (const bad of [null, undefined, "", "abc.def", `${token}x`]) assert.deepEqual(await svc.confirm(bad), { ok: false, reason: "invalid" }, String(bad))
  const row = await rowOf(email)
  assert.deepEqual(await svc.confirm(newsletterLinks({ baseUrl: BASE, secret: SECRET, id: row.id, consentAt: row.consentAt }).unsubscribeUrl.split("t=")[1]), { ok: false, reason: "invalid" }, "수신거부 토큰으로는 확인할 수 없다")
  c.tick(7 * day + 1000)
  assert.deepEqual(await svc.confirm(token), { ok: false, reason: "invalid" })
  assert.equal((await rowOf(email)).status, "pending")
  assert.deepEqual(sent("newsletterWelcome"), [])
})

// ── 수신거부 ────────────────────────────────────────────────────────────────

/** 구독 완료까지 간 구독자와 그의 두 토큰 */
async function subscribed(ctx, email = freshEmail()) {
  await ctx.svc.subscribe(form({ email }), { ip: freshIp(), locale: "en" })
  const confirm = confirmTokenFrom(ctx.sent("newsletterConfirm").at(-1))
  await ctx.svc.confirm(confirm)
  const row = await rowOf(email)
  const unsub = tokenOf(ctx.sent("newsletterWelcome").at(-1).input.unsubscribeUrl)
  return { email, row, confirm, unsub }
}

test("수신거부: 로그인 없이 링크만으로 즉시 철회 — 몇 년 지난 링크도 열리고, 처리 결과 통지 메일이 한 통 가며, 다시 눌러도 변화·메일이 없다", async () => {
  const c = clock("2026-10-05T00:00:00.000Z")
  const ctx = setup({ now: c })
  const { email, unsub, row } = await subscribed(ctx)
  c.tick(5 * 365 * day)
  assert.deepEqual(await ctx.svc.unsubscribe(unsub), { ok: true, changed: true })
  const after = await rowOf(email)
  assert.deepEqual([after.status, after.unsubscribedAt.toISOString()], ["unsubscribed", c.at.toISOString()])
  assert.equal(after.expiresAt.getTime() - c.at.getTime(), NEWSLETTER_RETENTION.unsubscribedDays * day, "철회 기록은 정해진 기간만 둔다")
  assert.equal(after.confirmedAt.toISOString(), row.confirmedAt.toISOString(), "동의·확인 증빙은 지우지 않는다")

  const notices = ctx.sent("marketingConsentNotice")
  assert.equal(notices.length, 1)
  assert.equal(notices[0].to, email)
  assert.deepEqual(notices[0].input.changes, [{ channel: "email", granted: false }])
  assert.equal(notices[0].input.changedAt, c.at.toISOString())
  assert.equal(notices[0].input.copy.manageNote, MESSAGES.en.newsletter.unsubscribedNote, "계정 설정이 없는 구독자라 다시 받는 방법을 사이트 신청으로 안내")

  assert.deepEqual(await ctx.svc.unsubscribe(unsub), { ok: true, changed: false })
  assert.equal(ctx.sent("marketingConsentNotice").length, 1)
  for (const bad of [null, "", "x.y", unsub.slice(0, -2)]) assert.deepEqual(await ctx.svc.unsubscribe(bad), { ok: false, reason: "invalid" })
})

test("수신거부한 사람은 옛 확인 링크로 다시 구독되지 않는다(withdrawn) — 다시 받으려면 새로 신청해 새 확인을 거친다", async () => {
  const c = clock("2026-10-06T00:00:00.000Z")
  const ctx = setup({ now: c })
  const { email, confirm, unsub } = await subscribed(ctx)
  await ctx.svc.unsubscribe(unsub)
  assert.deepEqual(await ctx.svc.confirm(confirm), { ok: false, reason: "withdrawn" })
  assert.equal((await rowOf(email)).status, "unsubscribed")

  // 새 신청: 대기로 돌아가고 새 동의 시각·확인 메일. 옛 확인 링크는 신청 시각이 달라 열리지 않는다
  c.tick(10 * 60_000)
  await ctx.svc.subscribe(form({ email }), { ip: freshIp(), locale: "en" })
  const row = await rowOf(email)
  assert.deepEqual([row.status, row.unsubscribedAt, row.confirmedAt], ["pending", null, null])
  assert.equal(row.consentAt.toISOString(), c.at.toISOString())
  assert.deepEqual(await ctx.svc.confirm(confirm), { ok: false, reason: "invalid" })
  const fresh = confirmTokenFrom(ctx.sent("newsletterConfirm").at(-1))
  assert.deepEqual(await ctx.svc.confirm(fresh), { ok: true, changed: true })
  assert.equal(ctx.sent("newsletterWelcome").length, 2)
})

test("아직 확인하지 않은 대기 상태에서도 수신거부 링크를 처리한다 — 구독 목록에 들 일이 없다", async () => {
  const ctx = setup()
  const email = freshEmail()
  await ctx.svc.subscribe(form({ email }), { ip: freshIp() })
  const row = await rowOf(email)
  const unsub = newsletterLinks({ baseUrl: BASE, secret: SECRET, id: row.id, consentAt: row.consentAt }).unsubscribeUrl.split("t=")[1]
  assert.deepEqual(await ctx.svc.unsubscribe(unsub), { ok: true, changed: true })
  assert.equal((await rowOf(email)).status, "unsubscribed")
})

test("라우트 처리기: 확인·수신거부 GET 은 결과 쪽으로 303, 수신거부 POST(RFC 8058 한 번에 수신거부)는 쿠키·로그인 없이 JSON 200/400", async () => {
  const ctx = setup()
  const handlers = createNewsletterHandlers(ctx.svc)
  const { confirm, unsub } = await (async () => {
    const email = freshEmail()
    await ctx.svc.subscribe(form({ email }), { ip: freshIp(), locale: "en" })
    const confirm = confirmTokenFrom(ctx.sent("newsletterConfirm").at(-1))
    return { confirm, unsub: newsletterLinks({ baseUrl: BASE, secret: SECRET, id: (await rowOf(email)).id, consentAt: (await rowOf(email)).consentAt }).unsubscribeUrl.split("t=")[1] }
  })()
  const get = (path, t) => new Request(`${BASE}${path}?t=${t}`)
  const loc = (res) => res.headers.get("location")

  const ok = await handlers.confirm(get("/api/newsletter/confirm", confirm))
  assert.equal(ok.status, 303)
  assert.equal(loc(ok), "/email?list=newsletter&r=confirmed")
  assert.equal(ok.headers.get("cache-control"), "no-store")
  assert.equal(loc(await handlers.confirm(get("/api/newsletter/confirm", "garbage"))), "/email?list=newsletter&r=invalid")

  const unGet = await handlers.unsubscribe(get("/api/newsletter/unsubscribe", unsub))
  assert.equal(unGet.status, 303)
  assert.equal(loc(unGet), "/email?list=newsletter&r=unsubscribed")
  // 이미 철회됐어도 같은 결과(메일 보안 프로그램이 미리 열어도 같다)
  assert.equal(loc(await handlers.unsubscribe(get("/api/newsletter/unsubscribe", unsub))), "/email?list=newsletter&r=unsubscribed")

  const post = (t) => handlers.unsubscribe(new Request(`${BASE}/api/newsletter/unsubscribe?t=${t}`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "List-Unsubscribe=One-Click" }))
  const p1 = await post(unsub)
  assert.equal(p1.status, 200)
  assert.deepEqual(await p1.json(), { ok: true })
  const p2 = await post("garbage")
  assert.equal(p2.status, 400)
  assert.deepEqual(await p2.json(), { ok: false })
  assert.equal((await handlers.unsubscribe(new Request(`${BASE}/api/newsletter/unsubscribe`, { method: "PUT" }))).status, 405)

  // 확인 단추를 쪽에서 POST 로 받는 제품(메일 보안 프로그램의 미리 열기 대비)도 같은 처리
  const another = await (async () => {
    const email = freshEmail()
    await ctx.svc.subscribe(form({ email }), { ip: freshIp() })
    return confirmTokenFrom(ctx.sent("newsletterConfirm").at(-1))
  })()
  const postConfirm = await handlers.confirm(new Request(`${BASE}/api/newsletter/confirm?t=${another}`, { method: "POST" }))
  assert.equal(postConfirm.status, 200)
  assert.deepEqual(await postConfirm.json(), { ok: true })
})

// ── 내보내기용 목록 · 파기 ──────────────────────────────────────────────────

test("구독자 목록: 구독 중인 사람만, 커서로 나눠 읽고, 줄마다 서명 수신거부 링크가 있다 — 대기·철회는 없다", async () => {
  const ctx = setup()
  // 이 파일의 다른 시험이 만든 행과 섞이지 않게 목록 전체를 한 번 읽어 기준을 잡는다
  const baseline = new Set()
  for (let after; ; ) {
    const page = await ctx.svc.listSubscribed({ after, limit: 100 })
    page.items.forEach((i) => baseline.add(i.id))
    if (!page.next) break
    after = page.next
  }
  const mine = []
  for (let i = 0; i < 3; i++) mine.push((await subscribed(ctx)).row)
  const pending = freshEmail()
  await ctx.svc.subscribe(form({ email: pending }), { ip: freshIp() })
  const gone = await subscribed(ctx)
  await ctx.svc.unsubscribe(gone.unsub)

  const seen = []
  let pages = 0
  for (let after; ; ) {
    const page = await ctx.svc.listSubscribed({ after, limit: 2 })
    pages++
    assert.ok(page.items.length <= 2)
    seen.push(...page.items)
    if (!page.next) break
    after = page.next
  }
  const added = seen.filter((i) => !baseline.has(i.id))
  assert.deepEqual(added.map((i) => i.id).sort(), mine.map((r) => r.id).sort())
  assert.ok(!seen.some((i) => i.email === pending || i.email === gone.email))
  assert.ok(pages >= 2, "커서로 나눠 읽었다")
  assert.equal(new Set(seen.map((i) => i.id)).size, seen.length, "겹치지 않는다")
  for (const item of added) {
    assert.deepEqual(Object.keys(item).sort(), ["consentAt", "confirmedAt", "email", "id", "locale", "source", "unsubscribeUrl"].sort())
    assert.equal(item.unsubscribeUrl, ctx.svc.unsubscribeUrl(item.id))
  }
  assert.equal(ctx.svc.unsubscribeUrl(mine[0].id).startsWith(`${BASE}/api/newsletter/unsubscribe?t=`), true)
})

test("파기: 확인하지 않은 신청은 기한 뒤, 수신거부 기록은 보유 기간 뒤에 지운다 — 구독 중인 사람은 지우지 않는다", async () => {
  const c = clock("2026-11-01T00:00:00.000Z")
  const ctx = setup({ now: c })
  const stale = freshEmail()
  await ctx.svc.subscribe(form({ email: stale }), { ip: freshIp() })
  const active = (await subscribed(ctx)).email
  const left = await subscribed(ctx)
  await ctx.svc.unsubscribe(left.unsub)
  const fresh = freshEmail()

  c.tick((NEWSLETTER_RETENTION.pendingDays + 1) * day)
  await ctx.svc.subscribe(form({ email: fresh }), { ip: freshIp() })
  assert.ok((await ctx.svc.purgeExpired()) >= 1)
  assert.equal(await rowOf(stale), undefined, "확인하지 않은 옛 신청은 지워졌다")
  assert.ok(await rowOf(fresh), "새 신청은 남았다")
  assert.ok(await rowOf(active), "구독 중인 사람은 남았다")
  assert.ok(await rowOf(left.email), "철회 기록은 아직 보유 기간 안")

  c.tick(NEWSLETTER_RETENTION.unsubscribedDays * day)
  await ctx.svc.purgeExpired()
  assert.equal(await rowOf(left.email), undefined)
  assert.ok(await rowOf(active))
})

test("서비스를 만들 때: 짧은 비밀·앱 주소 없음은 던진다 — 서명 없는 링크를 만들지 않는다", () => {
  const base = { db: d, mailer: createMailer({ mode: "mock", log: () => {} }), limiter: createRateLimiter({ store: store() }), turnstile: createTurnstile({ mode: "mock" }), productName: "SampleCo" }
  assert.throws(() => createNewsletterService({ ...base, secret: "short", baseUrl: BASE }), /secret/)
  assert.throws(() => createNewsletterService({ ...base, secret: SECRET, baseUrl: "" }), /baseUrl/)
  assert.throws(() => createNewsletterService({ ...base, secret: SECRET, baseUrl: BASE, productName: "" }), /productName/)
  assert.throws(() => createNewsletterService({ ...base, secret: SECRET, baseUrl: BASE, senderName: " " }), /senderName/)
})
