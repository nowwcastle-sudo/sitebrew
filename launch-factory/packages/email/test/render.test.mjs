import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
import { renderEmail, TEMPLATE_NAMES, EmailRenderError } from "../src/index.ts"
import { inputs, APP } from "./fixtures.mjs"

// 렌더 스냅숏: 템플릿 11 × 언어 2(Task 15 에서 문의 둘, Task 19 에서 계정 보안 넷, Task 9b 에서 비밀번호 재설정 추가). 갱신은 `node --test --test-update-snapshots packages/email/test/render.test.mjs`.
for (const locale of ["ko", "en"]) {
  for (const name of TEMPLATE_NAMES) {
    test(`스냅숏: ${name} (${locale})`, async (t) => {
      const mail = await renderEmail(name, inputs(locale)[name])
      assert.match(mail.html, new RegExp(`<html[^>]*lang="${locale}"`))
      assert.ok(mail.subject.length > 0 && mail.text.length > 0)
      t.assert.snapshot(mail)
    })
  }
}

test("가격 변경(ko·en): 전후 가격·적용일·동의 기한(시각·시간대)·무응답≠동의·동의 링크·거절 링크가 모두 보인다", async () => {
  const ko = await renderEmail("priceChange", inputs("ko").priceChange)
  for (const s of ["₩9,900", "₩12,900", "2026년 11월 15일", "2026년 11월 1일 오후 11:59 GMT+9", "응답하지 않은 것은 동의가 아니에요", `${APP}/billing/cancel`, `${APP}/billing/price-change/accept`]) {
    assert.ok(ko.text.includes(s), `ko 평문에 ${s}`)
  }
  assert.ok(ko.html.includes(`href="${APP}/billing/cancel"`))
  const en = await renderEmail("priceChange", inputs("en").priceChange)
  for (const s of ["$9.00", "$12.00", "November 15, 2026", "November 1, 2026 at 2:59", "No response is not consent", `${APP}/billing/cancel`]) {
    assert.ok(en.text.includes(s), `en 평문에 ${s}`)
  }
  // 체험 → 유료: from 없이도 된다
  const trial = inputs("en").priceChange
  const t2 = await renderEmail("priceChange", { ...trial, change: { ...trial.change, from: undefined, kind: "trial_to_paid" } })
  assert.ok(t2.text.includes("Your free trial of Pro ends on November 15, 2026"))
})

// 음성 대조: 기한·거절 링크·적용일이 빠지거나 틀리면 렌더 오류(아무것도 만들지 않는다).
const broken = [
  ["consentBy 없음", (i) => ({ ...i, change: { ...i.change, consentBy: undefined } }), /consentBy/],
  ["consentBy 빈 문자열", (i) => ({ ...i, change: { ...i.change, consentBy: "" } }), /consentBy/],
  ["consentBy 날짜 아님", (i) => ({ ...i, change: { ...i.change, consentBy: "next week" } }), /consentBy/],
  ["effectiveAt 없음", (i) => ({ ...i, change: { ...i.change, effectiveAt: undefined } }), /effectiveAt/],
  ["기한이 적용일 뒤", (i) => ({ ...i, change: { ...i.change, consentBy: "2026-11-20T00:00:00.000Z" } }), /must not be after/],
  ["declineUrl 없음", (i) => ({ ...i, declineUrl: undefined }), /declineUrl/],
  ["declineUrl 빈 문자열", (i) => ({ ...i, declineUrl: "" }), /declineUrl/],
  ["declineUrl 상대 경로", (i) => ({ ...i, declineUrl: "/billing/cancel" }), /declineUrl/],
  ["declineUrl javascript:", (i) => ({ ...i, declineUrl: "javascript:alert(1)" }), /declineUrl/],
  ["acceptUrl 없음", (i) => ({ ...i, acceptUrl: undefined }), /acceptUrl/],
  ["change 없음", (i) => ({ ...i, change: undefined }), /change/],
  ["인상인데 from 없음", (i) => ({ ...i, change: { ...i.change, from: undefined } }), /change\.from/],
]
for (const [label, mutate, pattern] of broken) {
  test(`음성 대조 — 가격 변경 ${label} → EmailRenderError`, async () => {
    for (const locale of ["ko", "en"]) {
      await assert.rejects(renderEmail("priceChange", mutate(inputs(locale).priceChange)), (e) => {
        assert.ok(e instanceof EmailRenderError, String(e))
        assert.equal(e.template, "priceChange")
        assert.match(e.problems.join("\n"), pattern)
        return true
      })
    }
  })
}

test("가격 변경: 기한과 거절 링크가 함께 빠지면 문제를 한 번에 모두 알린다", async () => {
  const i = inputs("ko").priceChange
  await assert.rejects(renderEmail("priceChange", { ...i, declineUrl: undefined, change: { ...i.change, consentBy: undefined } }), (e) => {
    assert.equal(e.problems.length, 2)
    return true
  })
})

test("다른 템플릿도 필수 링크·날짜가 틀리면 렌더 오류", async () => {
  const i = inputs("en")
  await assert.rejects(renderEmail("welcome", { ...i.welcome, appUrl: "ftp://x" }), EmailRenderError)
  await assert.rejects(renderEmail("orderConfirmation", { ...i.orderConfirmation, orderedAt: "yesterday" }), EmailRenderError)
  await assert.rejects(renderEmail("orderConfirmation", { ...i.orderConfirmation, amount: { amount: 9.5, currency: "USD", vatIncluded: false } }), EmailRenderError)
  await assert.rejects(renderEmail("cancellation", { ...i.cancellation, accessUntil: "soon" }), EmailRenderError)
  await assert.rejects(renderEmail("welcome", { ...i.welcome, productName: " " }), EmailRenderError)
  await assert.rejects(renderEmail("welcome", { ...i.welcome, locale: "fr" }), EmailRenderError)
})

test("문구는 입력(copy)으로 덮어쓴다 — 자리표시에 값이 없으면 렌더 오류", async () => {
  const i = inputs("en").welcome
  const mail = await renderEmail("welcome", { ...i, copy: { subject: "Hello from {productName}!", body: "" } })
  assert.equal(mail.subject, "Hello from SampleCo!")
  assert.ok(mail.text.includes("your account is ready."), "빈 덮어쓰기는 기본 문구를 쓴다")
  await assert.rejects(renderEmail("welcome", { ...i, copy: { subject: "Hi {nickname}" } }), (e) => e instanceof EmailRenderError && /nickname/.test(e.message))
})

test("주문 확인은 영수증을 대신하지 않는다 — Paddle 영수증 안내가 있다", async () => {
  assert.ok((await renderEmail("orderConfirmation", inputs("ko").orderConfirmation)).text.includes("Paddle이 따로 메일로"))
  assert.ok((await renderEmail("orderConfirmation", inputs("en").orderConfirmation)).text.includes("separate email from Paddle"))
})

test("해지 확인: 기간 끝 해지면 날짜, 즉시 해지면 끝났다는 문구", async () => {
  const i = inputs("ko").cancellation
  assert.ok((await renderEmail("cancellation", i)).text.includes("2026년 11월 1일까지는"))
  const now = await renderEmail("cancellation", { ...i, accessUntil: undefined, resubscribeUrl: undefined })
  assert.ok(now.text.includes("유료 기능 이용이 끝났어요"))
  assert.ok(!now.html.includes(APP))
})

test("계정 보안 메일(Task 19): 링크·새 주소·시각이 틀리면 렌더 오류, 알림은 새 주소와 시각(시간대)을 보인다", async () => {
  const i = inputs("ko")
  await assert.rejects(renderEmail("verifyEmail", { ...i.verifyEmail, verifyUrl: "javascript:alert(1)" }), EmailRenderError)
  await assert.rejects(renderEmail("emailChangeConfirm", { ...i.emailChangeConfirm, newEmail: "not-an-email" }), EmailRenderError)
  await assert.rejects(renderEmail("passwordChanged", { ...i.passwordChanged, changedAt: "yesterday" }), EmailRenderError)
  const changed = await renderEmail("emailChanged", i.emailChanged)
  assert.ok(changed.text.includes("new-address@example.test"))
  const pw = await renderEmail("passwordChanged", { ...inputs("en").passwordChanged, timeZone: "America/New_York" })
  assert.match(pw.text, /September 29, 2026 at 11:00\s?PM EDT/)
  // 알림 버튼은 선택 — 없으면 앱 주소가 없다
  assert.ok(!(await renderEmail("emailChanged", { ...i.emailChanged, securityUrl: undefined })).html.includes(APP))
})

test("비밀번호 재설정 메일(D180): 재설정 링크가 버튼과 평문에 실리고, 링크가 안전하지 않으면 렌더 오류, 무시해도 된다는 안내가 있다", async () => {
  const i = inputs("en")
  const en = await renderEmail("passwordReset", i.passwordReset)
  assert.equal(en.subject, "Reset your SampleCo password")
  assert.ok(en.text.includes(i.passwordReset.resetUrl), "평문에 링크")
  assert.ok(en.html.includes(`href="${i.passwordReset.resetUrl}"`), "버튼 링크")
  assert.match(en.text, /you can ignore this email/)
  const ko = await renderEmail("passwordReset", inputs("ko").passwordReset)
  assert.match(ko.subject, /비밀번호를 재설정해 주세요/)
  assert.match(ko.text, /무시해도 돼요/)
  for (const bad of ["javascript:alert(1)", "http://insecure.example.test/x", "/relative", "", undefined]) {
    await assert.rejects(renderEmail("passwordReset", { ...i.passwordReset, resetUrl: bad }), (e) => e instanceof EmailRenderError && e.template === "passwordReset" && /resetUrl/.test(e.problems.join()))
  }
  assert.ok(TEMPLATE_NAMES.includes("passwordReset"))
})

test("템플릿·전송 원천에 한글 문자열이 없다(주석 제외) — 사용자 문구는 messages/ 에만", () => {
  const dir = new URL("../src/", import.meta.url)
  const files = ["render.ts", "send.ts", "format.ts", ...readdirSync(new URL("templates/", dir)).map((f) => `templates/${f}`)]
  assert.ok(files.length >= 7)
  for (const f of files) {
    const code = readFileSync(new URL(f, dir), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1")
    assert.doesNotMatch(code, /[가-힣]/, `${f} 에 한글 리터럴`)
  }
  // 양성 대조: 같은 검사가 메시지 목록(@launch-factory/i18n messages/ko.json)에서는 한글을 찾는다
  assert.match(readFileSync(new URL("../../i18n/messages/ko.json", dir), "utf8"), /[가-힣]/)
})

test("결제 실패(F11): 재시도 날짜·이용 마지막 날(알 때만)·카드 변경 링크가 보이고, 모르면 날짜 줄 없이 자동 재시도 문구만", async () => {
  const ko = await renderEmail("paymentFailed", inputs("ko").paymentFailed)
  for (const s of ["2026년 10월 5일에 카드를 다시 시도해요", "2026년 10월 8일까지는 유료 기능을 계속", `${APP}/account/billing`, "결제 수단 변경하기"]) assert.ok(ko.text.includes(s), `ko 평문에 ${s}`)
  assert.ok(ko.html.includes(`href="${APP}/account/billing"`))
  const en = await renderEmail("paymentFailed", inputs("en").paymentFailed)
  for (const s of ["try your card again on October 5, 2026", "until October 8, 2026", "Update payment method"]) assert.ok(en.text.includes(s), `en 평문에 ${s}`)
  // 모르는 날짜는 지어내지 않는다
  const unknown = await renderEmail("paymentFailed", { ...inputs("en").paymentFailed, retryAt: undefined, accessUntil: undefined })
  assert.ok(unknown.text.includes("automatically over the next few days"))
  assert.ok(!/October|until/.test(unknown.text.replace(/Update payment method/g, "")), "날짜 줄이 없다")
  // 필수 링크·날짜가 틀리면 렌더 오류
  const i = inputs("en").paymentFailed
  await assert.rejects(renderEmail("paymentFailed", { ...i, updateUrl: "javascript:alert(1)" }), EmailRenderError)
  await assert.rejects(renderEmail("paymentFailed", { ...i, retryAt: "soon" }), EmailRenderError)
  await assert.rejects(renderEmail("paymentFailed", { ...i, accessUntil: "later" }), EmailRenderError)
})
