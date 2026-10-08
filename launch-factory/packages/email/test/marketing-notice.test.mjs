// D201: 광고성 정보 수신 의사 처리 결과 통지 메일 — 정보통신망법 제50조제7항·시행령 제62조의2(전송자 명칭·의사 표시 사실과 날짜·처리 결과).
// 조문은 국가법령정보센터 API 로 2026-09-30 확인(법 MST 283843 시행 2026-09-11 · 시행령 MST 288033 시행 2026-07-07).
import assert from "node:assert/strict"
import { test } from "node:test"
import { consentEmails, createMailer, EmailRenderError, renderEmail } from "../src/index.ts"
import { inputs } from "./fixtures.mjs"

test("통지에 법이 정한 세 가지가 있다 — 전송자 명칭·의사 표시 사실과 날짜·처리 결과(ko)", async () => {
  const mail = await renderEmail("marketingConsentNotice", inputs("ko").marketingConsentNotice)
  for (const s of ["SampleCo Inc.", "이메일 · 수신 동의", "문자(SMS) · 수신 거부(동의 철회)", "2026년 10월 1일", "처리 결과: 수신 동의를 반영했어요.", "처리 결과: 수신 거부를 반영했어요"]) {
    assert.ok(mail.text.includes(s), `ko 평문에 ${s}`)
  }
  assert.match(mail.subject, /SampleCo Inc\./)
  assert.ok(!/<a\s/i.test(mail.html), "광고가 되지 않게 링크·버튼을 싣지 않는다")
})

test("영어 통지(en) — 같은 세 가지, 날짜는 UTC 기본·사용자 시간대가 있으면 그 시간대의 날짜", async () => {
  const i = inputs("en").marketingConsentNotice
  const en = await renderEmail("marketingConsentNotice", i)
  for (const s of ["SampleCo Inc.", "Email · Opt-in", "Text message (SMS) · Opt-out (consent withdrawn)", "October 1, 2026", "Result: your opt-in has been applied.", "Result: your opt-out has been applied."]) {
    assert.ok(en.text.includes(s), `en 평문에 ${s}`)
  }
  // 2026-10-01T01:30Z 는 뉴욕에서 9월 30일이다 — 의사를 표시한 날짜가 받는 사람 시간대로 보인다
  const ny = await renderEmail("marketingConsentNotice", { ...i, timeZone: "America/New_York" })
  assert.ok(ny.text.includes("September 30, 2026"))
  assert.ok(!ny.text.includes("October 1, 2026"))
  // 전송자 명칭을 안 주면 서비스 이름이 전송자다
  const noSender = await renderEmail("marketingConsentNotice", { ...i, senderName: undefined })
  assert.ok(noSender.text.includes("Sender: SampleCo "))
})

test("잘못된 입력은 아무것도 만들지 않고 EmailRenderError", async () => {
  const i = inputs("ko").marketingConsentNotice
  for (const bad of [
    { ...i, changes: [] },
    { ...i, changes: undefined },
    { ...i, changes: [{ channel: "fax", granted: true }] },
    { ...i, changes: [{ channel: "email", granted: "yes" }] },
    { ...i, changedAt: "yesterday" },
    { ...i, senderName: "  " },
  ]) {
    await assert.rejects(renderEmail("marketingConsentNotice", bad), EmailRenderError)
  }
})

test("consentEmails.marketingResult: 받는 사람 칸(언어·이름·시간대)으로 템플릿을 채워 보내고, 실패는 던진다", async () => {
  const sent = []
  const mailer = { send: async (req) => (sent.push(req), { ok: true, id: "x" }) }
  const emails = consentEmails(mailer, { productName: "SampleCo", senderName: "SampleCo Inc.", defaultLocale: "en" })
  const at = new Date("2026-10-01T01:30:00.000Z")
  await emails.marketingResult("jamie@example.com", { changes: [{ channel: "kakao", granted: false }], at }, { name: "지민", locale: "ko", timeZone: "Asia/Seoul" })
  assert.equal(sent.length, 1)
  assert.equal(sent[0].to, "jamie@example.com")
  assert.equal(sent[0].template, "marketingConsentNotice")
  assert.deepEqual(sent[0].input, { locale: "ko", productName: "SampleCo", recipientName: "지민", timeZone: "Asia/Seoul", senderName: "SampleCo Inc.", changes: [{ channel: "kakao", granted: false }], changedAt: at.toISOString() })
  // 칸이 비면 기본 언어
  await emails.marketingResult("a@example.com", { changes: [{ channel: "email", granted: true }], at })
  assert.equal(sent[1].input.locale, "en")
  // 보내기 실패는 던진다(부르는 쪽이 onError 로만 알린다)
  const failing = consentEmails({ send: async () => ({ ok: false, error: { name: "validation_error" } }) }, { productName: "SampleCo", defaultLocale: "en" })
  await assert.rejects(failing.marketingResult("a@example.com", { changes: [{ channel: "email", granted: true }], at }), /marketingConsentNotice email failed: validation_error/)
})

test("mock 메일러로 실제 렌더까지 지난다(콘솔 출력 모드)", async () => {
  const logs = []
  const real = console.info
  console.info = (...a) => logs.push(a.join(" "))
  try {
    const emails = consentEmails(createMailer({ mode: "mock" }), { productName: "SampleCo", defaultLocale: "ko" })
    await emails.marketingResult("a@example.com", { changes: [{ channel: "push", granted: true }], at: new Date("2026-10-01T01:30:00.000Z") })
  } finally {
    console.info = real
  }
  assert.ok(logs.join("\n").length > 0)
})
