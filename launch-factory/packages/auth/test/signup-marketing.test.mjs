// A06: 가입 때 마케팅 수신에 동의하면 처리 결과 통지 메일이 나간다(정보통신망법 제50조제7항 · 시행령 제62조의2 — 전송자·사실과 날짜·처리 결과).
// DB 는 PGlite 메모리, 메일은 보내기 호출을 모으는 가짜 전송기(진짜 consentEmails·템플릿 이름·입력 모양이 그대로 지나간다).
import { test, before, after } from "node:test"
import assert from "node:assert/strict"
import { db } from "@launch-factory/db"
import { consentEmails } from "@launch-factory/email"
import { authAdapter, createAuth } from "../src/index.ts"

// 고정 시험값 — 실제 비밀이 아니다.
const SECRET = "lf-test-secret-not-real-0123456789abcdef"
const BASE_URL = "http://localhost:3000"
const PASSWORD = "Correct-Horse-Battery-9"
const CONSENT_VERSIONS = { terms: "terms-2026-09-30", privacy: "privacy-2026-09-30" }
const consents = { terms: true, privacy: true, ageOver14: true }

let d
before(async () => {
  d = await db.local()
})
after(async () => {
  await d?.$client.close()
})

let seq = 0
const nextEmail = () => `signup-marketing-${++seq}@example.com`
function memoryIO() {
  const jar = new Map()
  const ip = `198.51.100.${++seq}`
  return {
    headers() {
      const h = new Headers({ "x-forwarded-for": ip, "user-agent": "lf-test" })
      if (jar.size) h.set("cookie", [...jar].map(([k, v]) => `${k}=${v}`).join("; "))
      return h
    },
    setCookies(list) {
      for (const line of list) {
        const [pair] = line.split(";")
        const i = pair.indexOf("=")
        jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim())
      }
    },
  }
}

/** auth + 가짜 전송기. sent 에는 consentEmails 가 만든 보내기 요청이 쌓인다 */
function setup({ fail = false } = {}) {
  const sent = []
  const errors = []
  const mailer = {
    send: async (req) => {
      sent.push(req)
      return fail ? { ok: false, error: { name: "validation_error" } } : { ok: true, id: `m${sent.length}` }
    },
  }
  const emails = consentEmails(mailer, { productName: "Example App", defaultLocale: "en" })
  const background = []
  const auth = createAuth({
    db: d,
    secret: SECRET,
    baseURL: BASE_URL,
    consentVersions: CONSENT_VERSIONS,
    onError: (e) => errors.push(e),
    runInBackground: (task) => void background.push(task),
    onSignUpMarketing: (e) => emails.marketingResult(e.email, { changes: e.changes, at: e.at }, { name: e.name, locale: e.locale, timeZone: e.timeZone }),
  })
  const flush = () => Promise.all(background.splice(0))
  return { auth, sent, errors, flush, port: () => authAdapter(auth, memoryIO(), { onError: () => {}, errorCallbackURL: "/sign-in", locale: "en" }) }
}

test("A06: 가입에서 이메일 마케팅에 동의하면 그 주소로 결과 통지 메일 한 통 — 템플릿·채널·사실·시각(가입 시각)", async () => {
  const { port, sent, flush } = setup()
  const email = nextEmail()
  const r = await port().signUp({ method: "password", email, password: PASSWORD, consents: { ...consents, marketing: { email: true } } })
  assert.equal(r.ok, true)
  await flush()
  assert.equal(sent.length, 1)
  const [mail] = sent
  assert.equal(mail.to, email)
  assert.equal(mail.template, "marketingConsentNotice")
  assert.deepEqual(mail.input.changes, [{ channel: "email", granted: true }])
  assert.equal(mail.input.productName, "Example App")
  assert.match(mail.input.changedAt, /^\d{4}-\d{2}-\d{2}T/, "의사를 표시한 날짜(ISO)")
  assert.ok(Date.now() - new Date(mail.input.changedAt).getTime() < 60_000, "방금 가입한 시각")
})

test("A06: 동의한 채널만 실린다(email·push 켜고 sms·kakao 끔 → 두 채널, 모두 granted)", async () => {
  const { port, sent, flush } = setup()
  await port().signUp({ method: "password", email: nextEmail(), password: PASSWORD, consents: { ...consents, marketing: { email: true, push: true, sms: false } } })
  await flush()
  assert.equal(sent.length, 1)
  assert.deepEqual(
    sent[0].input.changes.map((c) => c.channel).sort(),
    ["email", "push"],
  )
  assert.ok(sent[0].input.changes.every((c) => c.granted === true))
})

test("A06 음성 대조: 마케팅을 아무것도 켜지 않은 가입에는 통지를 보내지 않는다(의사 표시가 없다)", async () => {
  const { port, sent, flush } = setup()
  assert.equal((await port().signUp({ method: "password", email: nextEmail(), password: PASSWORD, consents })).ok, true)
  await flush()
  assert.equal(sent.length, 0)
})

test("A06: 통지 메일 보내기가 실패해도 가입은 그대로 성공하고 실패는 onError 로만 알린다", async () => {
  const { port, sent, errors, flush } = setup({ fail: true })
  const r = await port().signUp({ method: "password", email: nextEmail(), password: PASSWORD, consents: { ...consents, marketing: { email: true } } })
  assert.equal(r.ok, true, "가입은 되돌리지 않는다")
  await flush()
  assert.equal(sent.length, 1, "보내기는 시도했다")
  assert.equal(errors.length, 1, "실패를 알렸다")
})
