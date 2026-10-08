// LFUX2 — 문의 접수 확인 메일의 첫 응답 약속(K06)·접수 번호와, 비밀번호 변경 알림의 문의 버튼(C02).
import { test } from "node:test"
import assert from "node:assert/strict"
import { renderEmail, EmailRenderError } from "../src/index.ts"
import { inputs, APP } from "./fixtures.mjs"

test("문의 접수 확인(en): responseTime 을 주면 약속 한 줄과 접수 번호가 함께 실린다", async () => {
  const mail = await renderEmail("inquiryReceipt", { ...inputs("en").inquiryReceipt, responseTime: "1 business day" })
  assert.match(mail.text, /We usually reply within 1 business day/)
  assert.ok(mail.text.includes("Q-7K3M9P2A"), "접수 번호")
  assert.ok(mail.html.includes("1 business day"))
})

test("문의 접수 확인(ko): 같은 약속 한 줄이 한국어로 실린다", async () => {
  const mail = await renderEmail("inquiryReceipt", { ...inputs("ko").inquiryReceipt, responseTime: "영업일 1일" })
  assert.match(mail.text, /보통 영업일 1일 안에 답해 드려요/)
})

test("문의 접수 확인: responseTime 이 없으면 약속 줄이 없다(지킬 수 없는 약속을 싣지 않는다) — 양성 대조는 위 두 시험", async () => {
  const mail = await renderEmail("inquiryReceipt", inputs("en").inquiryReceipt)
  assert.ok(!/usually reply within/.test(mail.text))
})

test("문의 접수 확인: 비었거나 너무 긴 responseTime 은 렌더 오류다", async () => {
  for (const bad of ["", "   ", "x".repeat(81), 3]) {
    await assert.rejects(renderEmail("inquiryReceipt", { ...inputs("en").inquiryReceipt, responseTime: bad }), EmailRenderError, String(bad))
  }
})

test("이메일 변경 알림: contactUrl 이 있으면 「문의하기」 버튼이 실리고, 없으면 없다(C02)", async () => {
  const en = await renderEmail("emailChanged", { ...inputs("en").emailChanged, contactUrl: `${APP}/contact` })
  assert.ok(en.html.includes(`href="${APP}/contact"`))
  assert.match(en.html, /Contact us/)
  assert.ok(!(await renderEmail("emailChanged", inputs("en").emailChanged)).html.includes(`${APP}/contact`))
  await assert.rejects(renderEmail("emailChanged", { ...inputs("en").emailChanged, contactUrl: "http://insecure.example.test/x" }), EmailRenderError)
})

test("비밀번호 변경 알림: contactUrl 이 있으면 「문의하기」 버튼과 평문 링크가 실리고, 없으면 없다", async () => {
  const en = await renderEmail("passwordChanged", { ...inputs("en").passwordChanged, contactUrl: `${APP}/contact` })
  assert.ok(en.html.includes(`href="${APP}/contact"`), "버튼 링크")
  assert.ok(en.text.includes(`${APP}/contact`), "평문 링크")
  assert.match(en.html, /Contact us/)
  const ko = await renderEmail("passwordChanged", { ...inputs("ko").passwordChanged, contactUrl: `${APP}/contact` })
  assert.match(ko.html, /문의하기/)
  const none = await renderEmail("passwordChanged", inputs("en").passwordChanged)
  assert.ok(!none.html.includes(`${APP}/contact`))
  await assert.rejects(renderEmail("passwordChanged", { ...inputs("en").passwordChanged, contactUrl: "javascript:alert(1)" }), EmailRenderError)
})
