// 뉴스레터 접착(registry/feature-newsletter): 진짜 레지스트리 파일(lib/launch/newsletter.ts · app/api/newsletter/**/route.ts · app/api/cron/newsletter/route.ts)을 그대로 불러
// mock 모드 흐름을 끝까지 돌린다 — 신청 → 확인 메일 → 확인 링크(GET 303) → 구독 완료 안내 → 수신거부(GET 303 · RFC 8058 POST) → Cron 파기 인증.
// 앱 조립 모듈 중 config·db·env·mailer 만 대역이고, link-secret·cron·newsletter 와 @launch-factory/* 는 진짜다.
import assert from "node:assert/strict"
import { registerHooks } from "node:module"
import { join } from "node:path"
import { after, before, test } from "node:test"
import { fileURLToPath, pathToFileURL } from "node:url"
import { eq } from "drizzle-orm"
import { db, newsletterSubscribers } from "@launch-factory/db"
import { createMailer } from "@launch-factory/email"
import { importRegistryFile, installGlueStubs, stubs } from "./registry-glue.mjs"

process.env.LF_CLIENT_IP_HEADER = "x-forwarded-for" // 요청 머리의 IP 를 믿는다(시험 환경) — 아니면 모두 한 통에 센다
process.env.CRON_SECRET = "lf-test-secret-not-real-0123456789abcdef"

const ROOT = fileURLToPath(new URL("../..", import.meta.url))
const real = (rel) => pathToFileURL(join(ROOT, "registry", rel)).href
const BASE = "https://glue.test"

let d
const sent = []
before(async () => {
  d = await db.local()
  const mock = createMailer({ mode: "mock", log: () => {} })
  stubs.config = { PRODUCT_NAME: "GlueProduct", appUrl: () => BASE }
  stubs.db = { database: async () => d }
  stubs.env = { env: () => ({ LF_MODE: "mock" }), required: (n) => process.env[n] ?? "" }
  stubs.mailer = { mailer: () => ({ mode: mock.mode, send: (req) => (sent.push(req), mock.send(req)) }) }
})
after(async () => {
  await d?.$client.close()
})

installGlueStubs({ config: ["PRODUCT_NAME", "appUrl"], db: ["database"], env: ["env", "required"], mailer: ["mailer"] })
const FILES = { newsletter: "feature-newsletter/files/lib/launch/newsletter.ts", cron: "_shared/lib/launch/cron.ts", "link-secret": "_shared/lib/launch/link-secret.ts" }
registerHooks({
  resolve(specifier, context, next) {
    const m = /^@\/lib\/launch\/(newsletter|cron|link-secret)$/.exec(specifier)
    return m ? { url: real(FILES[m[1]]), shortCircuit: true } : next(specifier, context)
  },
})

const route = (rel) => importRegistryFile(`feature-newsletter/files/app/api/${rel}/route.ts`)
const post = (body, ip = "198.51.100.10") => {
  const form = new FormData()
  for (const [k, v] of Object.entries(body)) form.set(k, v)
  return new Request(`${BASE}/api/newsletter`, { method: "POST", body: form, headers: { "x-forwarded-for": ip } })
}
const rowOf = async (email) => (await d.select().from(newsletterSubscribers).where(eq(newsletterSubscribers.email, email)))[0]
const tokenOf = (url) => new URL(url).searchParams.get("t")

test("신청 → 확인 → 구독 완료 → 수신거부: 라우트 파일이 그대로 이어진다", async () => {
  const subscribe = await route("newsletter")
  const confirm = await route("newsletter/confirm")
  const unsubscribe = await route("newsletter/unsubscribe")
  const email = "glue.reader@example.test"

  const res = await subscribe.POST(post({ email, consent: "yes", source: "glue-form" }))
  assert.equal(res.status, 200)
  assert.equal((await res.json()).ok, true)
  assert.equal((await rowOf(email)).status, "pending")
  const mail = sent.find((m) => m.template === "newsletterConfirm")
  assert.equal(mail.to, email)
  assert.ok(mail.input.confirmUrl.startsWith(`${BASE}/api/newsletter/confirm?t=`), "링크는 앱 주소에 서명 토큰")

  const ok = await confirm.GET(new Request(mail.input.confirmUrl))
  assert.equal(ok.status, 303)
  assert.equal(ok.headers.get("location"), "/email?list=newsletter&r=confirmed")
  assert.equal((await rowOf(email)).status, "subscribed")
  const welcome = sent.find((m) => m.template === "newsletterWelcome")
  assert.equal(welcome.to, email)
  assert.ok(welcome.input.unsubscribeUrl.startsWith(`${BASE}/api/newsletter/unsubscribe?t=`))

  const t = tokenOf(welcome.input.unsubscribeUrl)
  const one = await unsubscribe.POST(new Request(`${BASE}/api/newsletter/unsubscribe?t=${t}`, { method: "POST", body: "List-Unsubscribe=One-Click", headers: { "content-type": "application/x-www-form-urlencoded" } }))
  assert.deepEqual([one.status, await one.json()], [200, { ok: true }])
  assert.equal((await rowOf(email)).status, "unsubscribed")
  const again = await unsubscribe.GET(new Request(welcome.input.unsubscribeUrl))
  assert.equal(again.headers.get("location"), "/email?list=newsletter&r=unsubscribed")
  assert.equal(sent.filter((m) => m.template === "marketingConsentNotice").length, 1, "처리 결과 통지는 한 통")
  assert.equal((await unsubscribe.POST(new Request(`${BASE}/api/newsletter/unsubscribe?t=garbage`, { method: "POST" }))).status, 400)
})

test("동의 없이 보내면 400 — 저장·메일이 없다", async () => {
  const { POST } = await route("newsletter")
  const before = sent.length
  const res = await POST(post({ email: "no.consent@example.test" }, "198.51.100.11"))
  assert.equal(res.status, 400)
  assert.deepEqual(Object.keys((await res.json()).fieldErrors), ["consent"])
  assert.equal(await rowOf("no.consent@example.test"), undefined)
  assert.equal(sent.length, before)
})

test("파기 Cron: 비밀이 없거나 다르면 401, 맞으면 지운 수를 돌려준다", async () => {
  const { GET } = await route("cron/newsletter")
  assert.equal((await GET(new Request(`${BASE}/api/cron/newsletter`))).status, 401)
  assert.equal((await GET(new Request(`${BASE}/api/cron/newsletter`, { headers: { authorization: "Bearer wrong" } }))).status, 401)
  const ok = await GET(new Request(`${BASE}/api/cron/newsletter`, { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } }))
  assert.equal(ok.status, 200)
  assert.equal(typeof (await ok.json()).purged, "number")
})
