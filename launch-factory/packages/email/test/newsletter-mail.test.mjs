// 뉴스레터 메일 둘 — 구독 확인(받는 주소를 방문자가 적었다)과 구독 완료 안내(정보통신망법 제50조제7항 처리 결과 통지를 겸한다).
// 둘 다 거래·법정 안내(transactional)다: 광고 문구·(광고) 표기가 없다. 형식 공통 규칙은 mail-format.test.mjs 가 모든 템플릿에 돌린다.
import { test } from "node:test"
import assert from "node:assert/strict"
import { renderEmail, kindOf, TEMPLATE_META, EmailRenderError } from "../src/index.ts"
import { inputs, APP } from "./fixtures.mjs"

test("구독 확인: 종류·행동·유효 시간 — 거래 안내이고 단추는 하나, 링크는 7일", async () => {
  assert.equal(kindOf("newsletterConfirm"), "transactional")
  assert.deepEqual(TEMPLATE_META.newsletterConfirm, { kind: "transactional", action: "one", expires: "duration" })
  const en = await renderEmail("newsletterConfirm", inputs("en").newsletterConfirm)
  assert.ok(en.html.includes(`href="${APP}/api/newsletter/confirm?t=test-confirm-token"`), "확인 단추")
  assert.match(en.text, /This link works for 7 days\./)
  assert.match((await renderEmail("newsletterConfirm", inputs("ko").newsletterConfirm)).text, /이 링크는 7일 동안만/)
})

test("구독 확인: 받는 주소를 방문자가 적으므로 이름 인사가 없고, 확인 전에는 보내지 않는다는 말과 무시해도 된다는 말이 있다", async () => {
  const en = await renderEmail("newsletterConfirm", { ...inputs("en").newsletterConfirm, recipientName: "Mallory" })
  assert.ok(!en.text.includes("Mallory"), "recipientName 을 받지 않는다")
  assert.match(en.text, /Hi there,/)
  assert.match(en.text, /we won't send you anything/i)
  assert.match(en.text, /just ignore this email/)
  const ko = await renderEmail("newsletterConfirm", inputs("ko").newsletterConfirm)
  assert.match(ko.text, /확인하기 전에는 아무 소식도 보내지 않아요/)
  assert.match(ko.text, /무시해 주세요/)
})

test("구독 완료: 전송자 명칭·동의한 날짜·처리 결과가 있고, 수신거부는 보조 단추 — 눈에 띄는 단추는 없다", async () => {
  assert.deepEqual(TEMPLATE_META.newsletterWelcome, { kind: "transactional", action: "none" })
  const en = await renderEmail("newsletterWelcome", inputs("en").newsletterWelcome)
  assert.match(en.text, /Sender: SampleCo Inc\./)
  assert.match(en.text, /October 1, 2026/)
  assert.match(en.text, /Result: your subscription is confirmed/)
  assert.match(en.text, /not an advertisement/)
  assert.ok(en.html.includes(`href="${APP}/api/newsletter/unsubscribe?t=test-unsubscribe-token"`))
  const ko = await renderEmail("newsletterWelcome", inputs("ko").newsletterWelcome)
  assert.match(ko.text, /전송자: SampleCo Inc\./)
  assert.match(ko.text, /2026년 10월 1일/)
  assert.match(ko.text, /광고가 아니에요/)
  // 전송자 명칭을 안 주면 서비스 이름
  const bare = await renderEmail("newsletterWelcome", { ...inputs("en").newsletterWelcome, senderName: undefined })
  assert.match(bare.text, /Sender: SampleCo —/)
})

test("음성 대조: 링크·날짜·전송자가 틀리면 렌더 오류, 광고 입력은 거절", async () => {
  const c = inputs("en").newsletterConfirm
  const w = inputs("en").newsletterWelcome
  await assert.rejects(renderEmail("newsletterConfirm", { ...c, confirmUrl: "javascript:alert(1)" }), EmailRenderError)
  await assert.rejects(renderEmail("newsletterConfirm", { ...c, confirmUrl: "http://insecure.example/x" }), EmailRenderError)
  await assert.rejects(renderEmail("newsletterConfirm", { ...c, linkValidMinutes: 0 }), EmailRenderError)
  await assert.rejects(renderEmail("newsletterWelcome", { ...w, unsubscribeUrl: "/api/newsletter/unsubscribe?t=x" }), EmailRenderError)
  await assert.rejects(renderEmail("newsletterWelcome", { ...w, consentAt: "yesterday" }), EmailRenderError)
  await assert.rejects(renderEmail("newsletterWelcome", { ...w, senderName: "  " }), EmailRenderError)
  await assert.rejects(renderEmail("newsletterWelcome", { ...w, promo: { text: "Save 20%" } }), EmailRenderError)
})
