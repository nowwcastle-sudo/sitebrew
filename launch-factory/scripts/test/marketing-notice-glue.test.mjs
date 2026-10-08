// D201: 설치 항목(동의)의 진짜 조립 파일로, 마케팅 수신 동의를 바꿀 때마다 처리 결과 통지 메일이 나가는지 본다.
// 세션·메일러만 대역이고 DB(PGlite)·notifyAdapter·이메일 템플릿은 진짜다. 정보통신망법 제50조제7항 · 시행령 제62조의2.
import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import { db, user as userTable } from "@launch-factory/db"
import { createMailer } from "@launch-factory/email"
import { kakaoPlaceholderEmail } from "@launch-factory/auth"
import { importRegistryFile, installGlueStubs, stubs } from "./registry-glue.mjs"

installGlueStubs({ auth: ["authPort"], config: ["DEFAULT_LOCALE", "PRODUCT_NAME"], db: ["database"], mailer: ["mailer"], notices: ["sendMarketingNotice"] })

const at = new Date("2026-09-30T00:00:00.000Z")
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

before(async () => {
  d = await db.local()
  const mk = (id, extra) => ({ id, name: id, email: `${id}@example.com`, emailVerified: true, createdAt: at, updatedAt: at, ...extra })
  await d.insert(userTable).values([
    mk("ko-user", { name: "지민", locale: "ko", timeZone: "Asia/Seoul" }),
    mk("en-user", { name: "Jamie" }),
    mk("kakao-user", { email: kakaoPlaceholderEmail(4242) }),
  ])
  stubs.config = { DEFAULT_LOCALE: "en", PRODUCT_NAME: "SampleCo" }
  stubs.db = { database: async () => d }
  stubs.auth = { authPort: async () => ({ session: async () => ({ ok: true, data: session }) }) }
  stubs.mailer = { mailer: () => mailerStub }
  // 통지를 보내는 일은 인증 항목의 notices.ts(발신함 포함) 한 곳이다 — 진짜 파일로 위임한다(D210)
  const notices = await importRegistryFile("feature-auth-betterauth/files/lib/launch/notices.ts")
  stubs.notices = { sendMarketingNotice: (...a) => notices.sendMarketingNotice(...a) }
})
after(async () => {
  await d?.$client.close()
})

const setup = async () => {
  const lib = await importRegistryFile("feature-consents/files/lib/launch/consents.ts")
  sent = []
  failSend = false
  return lib
}

test("D201: 수신 동의·거부를 바꿀 때마다 그 사람에게 처리 결과 메일이 나간다 — 전송자·채널·사실·처리 결과(같은 값을 다시 표시해도)", async () => {
  const lib = await setup()
  session = { userId: "ko-user" }
  const port = await lib.notifyPort()
  assert.equal((await port.setConsents({ email: true })).ok, true)
  assert.equal(sent.length, 1)
  const first = sent[0]
  assert.equal(first.to, "ko-user@example.com")
  assert.equal(first.template, "marketingConsentNotice")
  assert.deepEqual(first.input.changes, [{ channel: "email", granted: true }])
  assert.equal(first.input.locale, "ko", "사용자 칸의 언어")
  assert.equal(first.input.timeZone, "Asia/Seoul")
  assert.equal(first.input.productName, "SampleCo")
  assert.match(first.input.changedAt, /^\d{4}-\d\d-\d\dT/)
  // 철회 + 다른 채널 동의 — 한 통에 채널별 사실이 다 있다
  assert.equal((await port.setConsents({ email: false, sms: true })).ok, true)
  assert.deepEqual(sent[1].input.changes, [{ channel: "email", granted: false }, { channel: "sms", granted: true }])
  // 같은 값을 다시 표시해도 의사 표시이므로 다시 알린다
  assert.equal((await port.setConsents({ sms: true })).ok, true)
  assert.equal(sent.length, 3)
})

test("D201: 통지 메일이 실제로 법정 세 가지를 담은 문구로 렌더된다(진짜 템플릿)", async () => {
  const lib = await setup()
  session = { userId: "en-user" }
  const lines = []
  try {
    stubs.mailer = { mailer: () => createMailer({ mode: "mock", log: (line) => lines.push(line) }) }
    assert.equal((await (await lib.notifyPort()).setConsents({ kakao: false })).ok, true)
  } finally {
    stubs.mailer = { mailer: () => mailerStub }
  }
  const out = lines.join("\n")
  assert.match(out, /template=marketingConsentNotice to=/) // 받는 주소는 로그에서 가려진다
  assert.match(out, /KakaoTalk · Opt-out \(consent withdrawn\)/)
  assert.match(out, /Sender: SampleCo/)
  assert.match(out, /Result: your opt-out has been applied/)
})

test("D201: 통지를 못 보내도 설정 저장은 되돌아가지 않고 오류만 로그로 남는다", async () => {
  const lib = await setup()
  session = { userId: "en-user" }
  failSend = true
  const errors = []
  const real = console.error
  console.error = (...a) => errors.push(a.map(String).join(" "))
  try {
    const port = await lib.notifyPort()
    assert.equal((await port.setConsents({ push: true })).ok, true)
    assert.deepEqual((await port.consents()).data.push, true, "저장은 됐다")
  } finally {
    console.error = real
  }
  assert.equal(sent.length, 1)
  assert.ok(errors.some((e) => e.includes("marketingConsentNotice email failed")), errors.join("\n"))
})

test("D201: 이메일이 없는 계정(대체 주소)·로그아웃·대리 세션·잘못된 입력에는 메일이 나가지 않는다", async () => {
  const lib = await setup()
  const port = await lib.notifyPort()
  session = { userId: "kakao-user" }
  assert.equal((await port.setConsents({ kakao: true })).ok, true)
  assert.deepEqual(sent, [], "대체 주소로는 보내지 않는다")
  session = null
  assert.equal((await port.setConsents({ email: true })).ok, false)
  session = { userId: "en-user", impersonatedBy: "boss" }
  assert.equal((await port.setConsents({ email: true })).ok, false)
  session = { userId: "en-user" }
  assert.equal((await port.setConsents({ fax: true })).ok, false)
  assert.equal((await port.setConsents({ email: "yes" })).ok, false)
  assert.deepEqual(sent, [])
})
