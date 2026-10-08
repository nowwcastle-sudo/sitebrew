// @launch-factory/consent — NotifyPort 백엔드(D40)·결제 직전 청약철회 동의·국외 이전 고지 표 데이터(D29·D38) (v0 Task 18).
// DB는 PGlite 메모리 하나. 사용자 행은 직접 넣는다(가입 흐름은 auth 테스트가 본다).
import { test, before, after } from "node:test"
import assert from "node:assert/strict"
import { and, eq } from "drizzle-orm"
import { consentRecords, db, marketingConsents, user as userTable } from "@launch-factory/db"
import { MESSAGES, t } from "@launch-factory/i18n"
import { checkoutAction, marketingResultNotice, notifyAdapter, overseasTransfers, TRANSFER_COLUMN_KEYS, WITHDRAWAL_NOTICE_VERSION, withWithdrawalConsent } from "../src/index.ts"

/** @type {Awaited<ReturnType<typeof db.local>>} */
let d
let seq = 0
const newUser = async () => {
  const id = `u-${++seq}`
  const at = new Date("2026-09-30T00:00:00.000Z")
  await d.insert(userTable).values({ id, name: "x", email: `${id}@example.com`, emailVerified: true, createdAt: at, updatedAt: at })
  return id
}
before(async () => {
  d = await db.local()
})
after(async () => {
  await d?.$client.close()
})

test("NotifyPort: 로그아웃이면 거부, 기본은 모두 false·updatedAt 없음, 바꾼 채널만 바뀌고 채널마다 updatedAt·이력이 남는다(정보통신망법 제50조)", async () => {
  const signedOut = notifyAdapter({ db: d, userId: () => null })
  assert.deepEqual(await signedOut.consents(), { ok: false, formError: MESSAGES.en.auth.signInRequired })
  assert.deepEqual(await signedOut.setConsents({ email: true }), { ok: false, formError: MESSAGES.en.auth.signInRequired })

  const id = await newUser()
  let clock = new Date("2026-10-01T01:00:00.000Z")
  const events = []
  const port = notifyAdapter({ db: d, userId: async () => id, locale: "ko", now: () => clock, onChange: (e) => void events.push(e) })
  assert.deepEqual(await port.consents(), { ok: true, data: { email: false, sms: false, kakao: false, push: false } })

  assert.deepEqual(await port.setConsents({ email: true }), { ok: true, data: { updatedAt: "2026-10-01T01:00:00.000Z" } })
  clock = new Date("2026-10-05T09:30:00.000Z")
  assert.deepEqual(await port.setConsents({ email: false, sms: true }), { ok: true, data: { updatedAt: "2026-10-05T09:30:00.000Z" } })
  assert.deepEqual(await port.consents(), { ok: true, data: { email: false, sms: true, kakao: false, push: false, updatedAt: "2026-10-05T09:30:00.000Z" } })

  const rows = await d.select().from(marketingConsents).where(eq(marketingConsents.userId, id))
  assert.deepEqual(Object.fromEntries(rows.map((r) => [r.channel, [r.granted, r.updatedAt.toISOString()]])), {
    email: [false, "2026-10-05T09:30:00.000Z"],
    sms: [true, "2026-10-05T09:30:00.000Z"],
  })
  const history = await d.select().from(consentRecords).where(eq(consentRecords.userId, id)).orderBy(consentRecords.createdAt)
  assert.deepEqual(
    history.map((r) => [r.kind, r.granted, r.source, r.locale, r.createdAt.toISOString()]),
    [
      ["marketing_email", true, "settings", "ko", "2026-10-01T01:00:00.000Z"],
      ["marketing_email", false, "settings", "ko", "2026-10-05T09:30:00.000Z"],
      ["marketing_sms", true, "settings", "ko", "2026-10-05T09:30:00.000Z"],
    ].sort((a, b) => a[4].localeCompare(b[4])),
  )
  // 처리 결과 통지(제50조제7항): 바꾼 채널과 시각이 넘어간다
  assert.equal(events.length, 2)
  assert.deepEqual(events[1].changes, [{ channel: "email", granted: false }, { channel: "sms", granted: true }])
})

test("NotifyPort: 모르는 채널·불리언이 아닌 값·빈 입력은 필드 오류이고 아무것도 쓰지 않는다", async () => {
  const id = await newUser()
  const port = notifyAdapter({ db: d, userId: () => id })
  const invalid = MESSAGES.en.consent.marketing.invalid
  assert.deepEqual(await port.setConsents({ email: "yes" }), { ok: false, fieldErrors: { email: [invalid] } })
  assert.deepEqual(await port.setConsents({ fax: true, sms: true }), { ok: false, fieldErrors: { fax: [invalid] } })
  assert.deepEqual(await port.setConsents({}), { ok: false, fieldErrors: { form: [invalid] } })
  assert.equal((await d.select().from(consentRecords).where(eq(consentRecords.userId, id))).length, 0)
})

test("처리 결과 통지 문구(시행령 제62조의2): 전송자·채널·결과·날짜를 담는다(ko·en)", () => {
  const event = { userId: "u", changes: [{ channel: "kakao", granted: false }], at: new Date("2026-10-05T16:00:00.000Z"), locale: "ko" }
  const [ko] = marketingResultNotice(event, { sender: "SampleCo" })
  assert.equal(ko, "SampleCo 광고성 정보 수신 설정을 처리했어요. 카카오톡: 수신 거부 (처리한 날: 2026년 10월 6일)")
  const [en] = marketingResultNotice({ ...event, locale: "en" }, { sender: "SampleCo" })
  assert.equal(en, 'SampleCo: your marketing preference for KakaoTalk was set to "Opted out" on October 5, 2026.')
})

function fakeBilling() {
  const calls = []
  return {
    calls,
    port: {
      plans: async () => ({ ok: true, data: [] }),
      checkout: async (input) => (calls.push(input), { ok: true, data: { redirectUrl: "https://sandbox-checkout.example/abc" } }),
    },
  }
}

test("청약철회 제한 동의 없이 결제를 시작하면 거부된다 — 결제창을 열지 않고 기록도 없다(전자상거래법 제17조②5·⑥)", async () => {
  const id = await newUser()
  const billing = fakeBilling()
  const port = withWithdrawalConsent(billing.port, { db: d, userId: () => id, locale: "ko" })
  const refused = { ok: false, fieldErrors: { withdrawalConsent: [MESSAGES.ko.checkout.withdrawal.consentRequired] } }
  assert.deepEqual(await port.checkout({ planId: "pro" }), refused)
  assert.deepEqual(await port.checkout({ planId: "pro", withdrawalConsent: false }), refused)
  assert.deepEqual(await port.checkout({ planId: "pro", withdrawalConsent: "on" }), refused)
  assert.equal(billing.calls.length, 0)
  assert.equal((await d.select().from(consentRecords).where(eq(consentRecords.userId, id))).length, 0)

  // 서버 액션: 체크박스가 폼에 없으면 거부, 있으면 결제창 주소
  const act = checkoutAction(port, { locale: "ko" })
  const form = (entries) => {
    const f = new FormData()
    for (const [k, v] of Object.entries(entries)) f.set(k, v)
    return f
  }
  assert.deepEqual(await act(form({ planId: "pro" })), refused)
  assert.equal(billing.calls.length, 0)
  assert.deepEqual(await act(form({ planId: "pro", withdrawalConsent: "on", trial: "false" })), { ok: true, data: { redirectUrl: "https://sandbox-checkout.example/abc" } })
  // 결제 포트에는 계약 칸만 간다
  assert.deepEqual(billing.calls, [{ planId: "pro", trial: false }])
  assert.equal((await act(form({ withdrawalConsent: "on" }))).ok, false)
})

test("청약철회 제한 동의는 판·요금제·언어·시각과 함께 기록되고, 그 뒤에 결제를 시작한다", async () => {
  const id = await newUser()
  const billing = fakeBilling()
  const at = new Date("2026-10-02T03:04:05.000Z")
  const port = withWithdrawalConsent(billing.port, { db: d, userId: () => id, locale: "en", now: () => at })
  assert.deepEqual(await port.checkout({ planId: "pro-yearly", trial: true, withdrawalConsent: true }), { ok: true, data: { redirectUrl: "https://sandbox-checkout.example/abc" } })
  assert.deepEqual(billing.calls, [{ planId: "pro-yearly", trial: true }])
  const [row] = await d.select().from(consentRecords).where(and(eq(consentRecords.userId, id), eq(consentRecords.kind, "withdrawal_limit")))
  assert.deepEqual(
    { granted: row.granted, version: row.version, source: row.source, locale: row.locale, subject: row.subject, at: row.createdAt.toISOString() },
    { granted: true, version: WITHDRAWAL_NOTICE_VERSION, source: "checkout", locale: "en", subject: "pro-yearly", at: at.toISOString() },
  )
  // 로그인하지 않았으면 동의가 있어도 거부(누구의 동의인지 남길 수 없다)
  const anon = withWithdrawalConsent(billing.port, { db: d, userId: () => null })
  assert.deepEqual(await anon.checkout({ planId: "pro", withdrawalConsent: true }), { ok: false, formError: MESSAGES.en.auth.signInRequired })
  // 나머지 메서드는 그대로 지나간다
  assert.deepEqual(await port.plans(), { ok: true, data: [] })
})

test("국외 이전 고지 표: PostHog 지역·Sentry 지역에 따라 나라가 바뀌고, 모든 칸의 메시지 키가 ko·en 에 있다(개인정보 보호법 제28조의8②)", () => {
  const us = overseasTransfers({ posthogRegion: "us" })
  assert.deepEqual(us.map((r) => r.id), ["posthog", "resend", "supabase", "sentry", "vercel", "cloudflare"])
  // Supabase 는 제품이 고른 저장 지역을 따른다(기본 서울 → KR), 나머지는 미국
  assert.deepEqual(us.map((r) => r.countryCode), ["US", "US", "KR", "US", "US", "US"])
  assert.match(us[2].place, /Seoul/)
  const frankfurt = overseasTransfers({ posthogRegion: "us", include: ["supabase"], database: { countryCode: "DE", place: "Frankfurt, Germany" } })
  assert.deepEqual(frankfurt.map((r) => [r.id, r.countryCode, r.place]), [["supabase", "DE", "Frankfurt, Germany"]])
  assert.equal(us[0].recipient, "PostHog, Inc.")
  assert.match(us[0].place, /Virginia/)
  const eu = overseasTransfers({ posthogRegion: "eu", sentryRegion: "de", include: ["posthog", "sentry"] })
  assert.deepEqual(eu.map((r) => [r.id, r.countryCode]), [["posthog", "DE"], ["sentry", "DE"]])
  assert.throws(() => overseasTransfers({ posthogRegion: "ap" }), /unknown PostHog region/)
  for (const locale of ["ko", "en"]) {
    for (const row of us.concat(eu)) {
      for (const key of [row.items, row.purpose, row.whenHow, row.retention, `transfer.country.${row.countryCode}`]) assert.ok(t(locale, key), `${locale} ${key}`)
      assert.match(row.contactUrl, /^https:\/\//)
    }
    for (const key of Object.values(TRANSFER_COLUMN_KEYS)) assert.ok(t(locale, key))
    assert.ok(t(locale, "transfer.refuse", { contact: "privacy@example.com" }).includes("privacy@example.com"))
  }
})
