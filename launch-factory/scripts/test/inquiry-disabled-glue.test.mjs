// LFENV: 운영자 메일(INQUIRY_OWNER_EMAIL)이 없으면 사이트는 켜지고 문의 창구만 꺼진다(운영자 결정 2026-10-05).
// 미리보기 배포가 전 쪽 500 이었던 사고(live-env 가 이 이름을 필수로 요구)의 재현·회귀 시험이다. 진짜 레지스트리 파일을 그대로 불러
// (lib/launch/inquiry.ts · app/actions/inquiry.ts) 앱 조립 모듈(env·db·mailer·config·support)과 next/headers 만 대역으로 바꾼다.
// live 흐름의 봇 확인은 외부로 나가므로(Cloudflare) 접수가 되는 쪽의 대조군은 패키지 시험(packages/inquiry)과 mock 개발 서버 시험이 맡는다.
import assert from "node:assert/strict"
import { registerHooks } from "node:module"
import { join } from "node:path"
import { after, before, test } from "node:test"
import { count } from "drizzle-orm"
import { db, inquiries } from "@launch-factory/db"
import { createMailer } from "@launch-factory/email"
import { fileURLToPath, pathToFileURL } from "node:url"
import { importRegistryFile, installGlueStubs, stubs } from "./registry-glue.mjs"

const OWNER_VALUE = "ops@example.test" // 시험용 가짜 주소 — 실제 운영자 메일이 아니다

let d
const sent = []
let mode = "live"
before(async () => {
  d = await db.local()
  const mock = createMailer({ mode: "mock", log: () => {} })
  stubs.config = { PRODUCT_NAME: "TestProduct", DEFAULT_LOCALE: "en" }
  stubs.db = { database: async () => d }
  // env(): LF_MODE 는 시험이 정한다. optional(): 진짜 구현과 같다(process.env, 빈 문자열은 없음). required(): 이 시험에서 live 봇 확인 비밀을 요구하는 자리
  stubs.env = { env: () => ({ LF_MODE: mode }), optional: (n) => process.env[n] || undefined, required: (n) => (n === "TURNSTILE_SECRET_KEY" ? "unused-in-this-test" : (process.env[n] ?? "")) }
  stubs.mailer = { mailer: () => ({ mode: mock.mode, send: (req) => (sent.push(req), mock.send(req)) }) }
  stubs.support = { SUPPORT: { responseTime: null, receipt: false, email: null } }
})
after(async () => {
  await d?.$client.close()
})

installGlueStubs({ config: ["PRODUCT_NAME", "DEFAULT_LOCALE"], db: ["database"], env: ["env", "optional", "required"], mailer: ["mailer"], support: ["SUPPORT"] })
const INQUIRY_LIB = pathToFileURL(join(fileURLToPath(new URL("../..", import.meta.url)), "registry/feature-inquiry/files/lib/launch/inquiry.ts")).href
registerHooks({
  resolve(specifier, context, next) {
    // 시험 대상 자신(app/actions/inquiry.ts 가 부르는 조립 모듈)은 대역이 아니라 진짜 파일이다
    if (specifier === "@/lib/launch/inquiry") return { url: INQUIRY_LIB, shortCircuit: true }
    if (specifier !== "next/headers") return next(specifier, context)
    const src = 'export const headers = async () => new Headers({ "x-forwarded-for": "198.51.100.77" })'
    return { url: `data:text/javascript,${encodeURIComponent(src)}`, shortCircuit: true }
  },
})

const input = { name: "Jamie", contact: "visitor@example.test", message: "Do you offer team plans?" }

test("LFENV 회귀: live 에 INQUIRY_OWNER_EMAIL 이 없으면 — 켜진 사이트에서 문의만 꺼진다(inquiryEnabled false · 접수는 provider_unavailable · 저장·메일 없음)", async () => {
  mode = "live"
  delete process.env.INQUIRY_OWNER_EMAIL
  const lib = await importRegistryFile("feature-inquiry/files/lib/launch/inquiry.ts")
  const actions = await importRegistryFile("feature-inquiry/files/app/actions/inquiry.ts")
  assert.equal(lib.inquiryEnabled(), false)
  assert.equal(lib.inquiryOwnerEmail(), undefined, "live 는 가짜 주소로 대신하지 않는다")

  const before = (await d.select({ n: count() }).from(inquiries))[0].n
  const r = await actions.submitInquiry({ ...input })
  assert.deepEqual(r, { ok: false, code: "provider_unavailable", retryable: false, formError: "We're not accepting messages right now." })
  assert.equal((await d.select({ n: count() }).from(inquiries))[0].n, before, "받은 척 저장하지 않는다")
  assert.equal(sent.length, 0, "메일이 한 통도 안 나간다")

  const svc = await lib.inquiry()
  assert.equal(svc.enabled, false)
  const res = await svc.handler(new Request("https://x.test/api/inquiry", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) }))
  assert.equal(res.status, 503)
  assert.equal((await res.json()).code, "provider_unavailable")
  assert.equal(await svc.purgeExpired(), 0, "파기 Cron 은 창구가 꺼져도 돈다")
})

test("LFENV 대조군: 값이 있으면 켜진다 — live·mock 모두. 빈 문자열은 없는 것이고, mock 은 없어도 가짜 주소로 켜진다(기존 동작 그대로)", async () => {
  const lib = await importRegistryFile("feature-inquiry/files/lib/launch/inquiry.ts")
  process.env.INQUIRY_OWNER_EMAIL = OWNER_VALUE
  try {
    mode = "live"
    assert.equal(lib.inquiryEnabled(), true)
    assert.equal(lib.inquiryOwnerEmail(), OWNER_VALUE)
    mode = "mock"
    assert.equal(lib.inquiryOwnerEmail(), OWNER_VALUE)
    process.env.INQUIRY_OWNER_EMAIL = ""
    mode = "live"
    assert.equal(lib.inquiryEnabled(), false, "빈 값은 없는 값(loadEnv 와 같은 규칙)")
    mode = "mock"
    assert.equal(lib.inquiryEnabled(), true)
    assert.equal(lib.inquiryOwnerEmail(), "owner@example.test")
  } finally {
    delete process.env.INQUIRY_OWNER_EMAIL
  }
})
