// D210: 마케팅 수신 처리 결과 통지 메일(정보통신망법 제50조제7항 · 시행령 제62조의2 — 14일 안)이 실패하면 발신함에 남고 Cron(/api/cron/notices)이 다시 보낸다.
// 설치 항목의 진짜 조립 파일(인증 항목의 lib/launch/notices.ts·app/api/cron/notices/route.ts, 동의 항목의 consents.ts)과 진짜 DB(PGlite)·notifyAdapter·createAuth 를 쓰고, 메일러·세션·설정만 대역이다.
// 보내기 실패 → 발신함 → Cron 한 번에 한 통 → Cron 또 → 중복 없음 → 상한을 다 쓰면 멈추고 알림.
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { after, before, beforeEach, test } from "node:test"
import { fileURLToPath } from "node:url"
import { eq, sql } from "drizzle-orm"
import { authAdapter, createAuth, kakaoPlaceholderEmail } from "@launch-factory/auth"
import { NOTICE_MAX_ATTEMPTS } from "@launch-factory/consent"
import { db, marketingNoticeOutbox, user as userTable } from "@launch-factory/db"
import { importRegistryFile, installGlueStubs, stubs } from "./registry-glue.mjs"

const ROOT = fileURLToPath(new URL("../..", import.meta.url))
const read = (p) => readFileSync(join(ROOT, p), "utf8")

installGlueStubs({
  auth: ["authPort"],
  config: ["DEFAULT_LOCALE", "PRODUCT_NAME"],
  db: ["database"],
  mailer: ["mailer"],
  notices: ["sendMarketingNotice", "retryMarketingNotices"],
  cron: ["cronAuthorized", "unauthorized"],
})

const at = new Date("2026-09-30T00:00:00.000Z")
const CRON = "Bearer lf-test-cron-secret-not-real"
let d
let session = null
let sent = []
let failSend = false
const mailerStub = {
  send: async (req) => {
    sent.push(req)
    return failSend ? { ok: false, error: { name: "validation_error" } } : { ok: true, id: `m${sent.length}` }
  },
}
let lib // 진짜 notices.ts
let route // 진짜 cron 경로

before(async () => {
  process.env.CRON_SECRET = "lf-test-cron-secret-not-real"
  d = await db.local()
  const mk = (id, extra) => ({ id, name: id, email: `${id}@example.com`, emailVerified: true, createdAt: at, updatedAt: at, ...extra })
  await d.insert(userTable).values([mk("ko-user", { name: "지민", locale: "ko", timeZone: "Asia/Seoul" }), mk("en-user"), mk("kakao-user", { email: kakaoPlaceholderEmail(777) })])
  stubs.config = { DEFAULT_LOCALE: "en", PRODUCT_NAME: "SampleCo" }
  stubs.db = { database: async () => d }
  stubs.auth = { authPort: async () => ({ session: async () => ({ ok: true, data: session }) }) }
  stubs.mailer = { mailer: () => mailerStub }
  const cron = await importRegistryFile("_shared/lib/launch/cron.ts")
  stubs.cron = { cronAuthorized: cron.cronAuthorized, unauthorized: cron.unauthorized }
  lib = await importRegistryFile("feature-auth-betterauth/files/lib/launch/notices.ts")
  stubs.notices = { sendMarketingNotice: (...a) => lib.sendMarketingNotice(...a), retryMarketingNotices: (...a) => lib.retryMarketingNotices(...a) }
  route = await importRegistryFile("feature-auth-betterauth/files/app/api/cron/notices/route.ts")
})
after(async () => {
  delete process.env.CRON_SECRET
  await d?.$client.close()
})
beforeEach(async () => {
  sent = []
  failSend = false
  session = null
  await d.delete(marketingNoticeOutbox)
})

const rows = () => d.select().from(marketingNoticeOutbox)
const makeDue = () => d.execute(sql`update marketing_notice_outbox set next_attempt_at = now() - interval '1 minute' where status = 'pending'`)
const cronCall = async (auth = CRON) => {
  const res = await route.GET(new Request("https://x.test/api/cron/notices", { headers: auth ? { authorization: auth } : {} }))
  return { status: res.status, body: await res.json() }
}
const quiet = async (fn) => {
  const lines = []
  const real = console.error
  console.error = (...a) => lines.push(a.map(String).join(" "))
  try {
    return { value: await fn(), lines }
  } finally {
    console.error = real
  }
}

test("D210 설정 화면: 통지를 못 보내도 저장은 그대로이고 발신함에 남는다 → Cron 이 한 통을 보내 닫고 → 다시 돌려도 더 보내지 않는다", async () => {
  const consents = await importRegistryFile("feature-consents/files/lib/launch/consents.ts")
  session = { userId: "ko-user" }
  failSend = true
  const { lines } = await quiet(async () => {
    const port = await consents.notifyPort()
    assert.equal((await port.setConsents({ email: true })).ok, true)
    assert.equal((await port.consents()).data.email, true, "저장은 됐다")
  })
  assert.equal(sent.length, 1)
  const [queued] = await rows()
  assert.equal(queued.status, "pending")
  assert.equal(queued.source, "settings")
  assert.equal(queued.userId, "ko-user")
  assert.equal(queued.lastErrorCode, "validation_error")
  assert.ok(lines.some((l) => l.includes("queued") && l.includes(queued.id)), lines.join("\n"))
  const originalAt = sent[0].input.changedAt

  // 때가 되기 전 Cron: 아무것도 안 한다. 인증 없이는 401
  assert.equal((await cronCall(null)).status, 401)
  assert.equal((await cronCall("Bearer wrong")).status, 401)
  const early = await cronCall()
  assert.deepEqual(early.body, { due: 0, sent: 0, skipped: 0, failed: 0, exhausted: 0, raced: 0 })
  assert.equal(sent.length, 1)

  failSend = false
  await makeDue()
  const first = await cronCall()
  assert.equal(first.status, 200)
  assert.deepEqual(first.body, { due: 1, sent: 1, skipped: 0, failed: 0, exhausted: 0, raced: 0 })
  assert.equal(sent.length, 2)
  const retry = sent[1]
  assert.equal(retry.to, "ko-user@example.com")
  assert.equal(retry.template, "marketingConsentNotice")
  assert.equal(retry.idempotencyKey, `notice:${queued.id}`)
  assert.deepEqual(retry.input.changes, [{ channel: "email", granted: true }])
  assert.equal(retry.input.changedAt, originalAt, "통지에 실리는 날짜는 의사를 표시한 날이다(재시도한 날이 아니다)")
  assert.equal(retry.input.locale, "ko")
  assert.equal(retry.input.timeZone, "Asia/Seoul")
  assert.equal((await rows())[0].status, "sent")

  const second = await cronCall()
  assert.equal(second.body.due, 0)
  assert.equal(second.body.sent, 0)
  await makeDue() // pending 이 없으니 아무 행도 바뀌지 않는다
  assert.equal((await cronCall()).body.sent, 0)
  assert.equal(sent.length, 2, "Cron 을 또 돌렸는데 메일이 더 나갔다")
})

test("D210 가입: 가입 때 마케팅 동의의 통지가 실패해도 가입은 되고, 발신함에 남아 Cron 이 한 번만 보낸다", async () => {
  const mailSent = []
  const background = []
  const auth = createAuth({
    db: d,
    secret: "lf-test-secret-not-real-0123456789abcdef",
    baseURL: "http://localhost:3000",
    consentVersions: { terms: "terms-2026-09-30", privacy: "privacy-2026-09-30" },
    onError: () => {},
    runInBackground: (task) => void background.push(task),
    // lib/launch/auth.ts 의 연결과 같은 모양(아래 정적 시험이 그 파일에서 이 호출을 확인한다)
    onSignUpMarketing: (e) => lib.sendMarketingNotice({ userId: e.userId, changes: e.changes, at: e.at }, "sign_up"),
  })
  void mailSent
  const jar = new Map()
  const io = { headers: () => new Headers({ "x-forwarded-for": "198.51.100.88", "user-agent": "lf-test", ...(jar.size ? { cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; ") } : {}) }), setCookies: () => {} }
  const port = authAdapter(auth, io, { onError: () => {}, errorCallbackURL: "/sign-in", locale: "en" })
  failSend = true
  const { value: r } = await quiet(() => port.signUp({ method: "password", email: "new-signup@example.com", password: "Correct-Horse-Battery-9", consents: { terms: true, privacy: true, ageOver14: true, marketing: { email: true } } }))
  assert.equal(r.ok, true, JSON.stringify(r))
  await quiet(() => Promise.all(background.splice(0)))
  const [u] = await d.select({ id: userTable.id }).from(userTable).where(eq(userTable.email, "new-signup@example.com"))
  const queued = (await rows()).filter((x) => x.userId === u.id)
  assert.equal(queued.length, 1)
  assert.equal(queued[0].source, "sign_up")
  assert.deepEqual(queued[0].changes, [{ channel: "email", granted: true }])
  assert.equal(sent.length, 1, "가입 때 한 번 시도했다")

  failSend = false
  await makeDue()
  assert.equal((await cronCall()).body.sent, 1)
  assert.equal(sent.length, 2)
  assert.equal(sent[1].to, "new-signup@example.com")
  assert.equal((await cronCall()).body.sent, 0)
  assert.equal(sent.length, 2)
  // 가입 연결이 정말 이 호출이다
  const authTs = read("registry/feature-auth-betterauth/files/lib/launch/auth.ts")
  assert.match(authTs, /onSignUpMarketing: \(e\) => sendMarketingNotice\(\{ userId: e\.userId, changes: e\.changes, at: e\.at \}, "sign_up"\)/)
})

test("D210 수신거부 링크: 철회 통지(source unsubscribe_link)도 같은 발신함을 쓴다 — 실패하면 남고 Cron 이 보낸다", async () => {
  const consents = await importRegistryFile("feature-consents/files/lib/launch/consents.ts")
  failSend = true
  await quiet(() => consents.sendResultNotice({ userId: "en-user", changes: [{ channel: "email", granted: false }], at, locale: "en" }, "unsubscribe_link"))
  const [q] = await rows()
  assert.equal(q.source, "unsubscribe_link")
  failSend = false
  await makeDue()
  assert.equal((await cronCall()).body.sent, 1)
  assert.deepEqual(sent.at(-1).input.changes, [{ channel: "email", granted: false }])
  assert.match(read("registry/feature-consents/files/app/api/marketing/unsubscribe/route.ts"), /sendResultNotice\(\{[^)]*\}, "unsubscribe_link"\)/)
})

test("D210 상한: 계속 실패하면 시도 횟수를 다 쓴 뒤 멈추고(exhausted) 알린다 — Cron 응답에도 보이고, 그 뒤로는 메일이 나가지 않는다", async () => {
  const consents = await importRegistryFile("feature-consents/files/lib/launch/consents.ts")
  session = { userId: "en-user" }
  failSend = true
  await quiet(async () => (await consents.notifyPort()).setConsents({ sms: true }))
  const [q] = await rows()
  const results = []
  let allLines = []
  for (let i = 2; i <= NOTICE_MAX_ATTEMPTS; i++) {
    await makeDue()
    const { value, lines } = await quiet(() => cronCall())
    results.push(value.body)
    allLines = allLines.concat(lines)
  }
  assert.equal(results.at(-1).exhausted, 1)
  assert.equal(results.slice(0, -1).every((r) => r.failed === 1 && r.exhausted === 0), true)
  const [done] = await rows()
  assert.equal(done.status, "exhausted")
  assert.equal(done.attempts, NOTICE_MAX_ATTEMPTS)
  assert.equal(sent.length, NOTICE_MAX_ATTEMPTS)
  assert.equal(allLines.filter((l) => l.includes("exhausted") && l.includes(q.id)).length, 1, allLines.join("\n"))
  failSend = false
  await makeDue()
  const after = await quiet(() => cronCall())
  assert.deepEqual(after.value.body, { due: 0, sent: 0, skipped: 0, failed: 0, exhausted: 0, raced: 0 })
  assert.equal(sent.length, NOTICE_MAX_ATTEMPTS, "멈춘 통지에는 더 보내지 않는다")
})

test("D210 이메일 없는 대체 주소 계정(카카오)은 큐에 남지 않고 로그 한 줄만 — 메일도 나가지 않는다", async () => {
  const consents = await importRegistryFile("feature-consents/files/lib/launch/consents.ts")
  session = { userId: "kakao-user" }
  const { lines } = await quiet(async () => (await consents.notifyPort()).setConsents({ kakao: true }))
  assert.deepEqual(sent, [])
  assert.deepEqual(await rows(), [])
  assert.ok(lines.some((l) => l.includes("skipped")), lines.join("\n"))
})

test("D210 Cron 연결: vercel.json 에 /api/cron/notices 가 있고 경로는 cronAuthorized 로 시작하며, 설치 항목 문서가 이를 알린다", () => {
  const vercel = JSON.parse(read("template/vercel.json"))
  const cron = vercel.crons.find((c) => c.path === "/api/cron/notices")
  assert.ok(cron, "vercel.json crons 에 /api/cron/notices 가 없다")
  assert.match(cron.schedule, /^\d+ \* \* \* \*$/, "한 시간 주기(재시도 간격의 가장 작은 단위)")
  const src = read("registry/feature-auth-betterauth/files/app/api/cron/notices/route.ts")
  assert.match(src, /if \(!cronAuthorized\(request\)\) return unauthorized\(\)/)
  // 발신함에 넣는 길(notices.ts)과 다시 보내는 길(Cron 경로)은 같은 설치 항목(인증)이 싣는다 — 한쪽만 설치되는 일이 없다
  const auth = JSON.parse(read("registry/feature-auth-betterauth/item.json"))
  for (const f of ["files/lib/launch/notices.ts", "files/app/api/cron/notices/route.ts", "../_shared/lib/launch/cron.ts"]) assert.ok(auth.files.includes(f), f)
  assert.match(auth.docs.join("\n"), /\/api\/cron\/notices/)
  const consents = JSON.parse(read("registry/feature-consents/item.json"))
  assert.ok(!/다시 보내지 않으며 \(대장 D210\)|다시 보내지 않는다 \(대장 D210\)/.test(consents.docs.join("\n")), "옛 문구(다시 보내지 않는다)가 남아 있다")
  assert.match(consents.docs.join("\n"), /\/api\/cron\/notices/)
})
