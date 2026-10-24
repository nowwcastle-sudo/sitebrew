// 예약 메일 셋(계획 3b Task 1): 접수·확정·알림 문구, 방문자 글 미포함, 입력 검사.
import { test } from "node:test"
import assert from "node:assert/strict"
import { renderEmail, EmailRenderError, kindOf, TEMPLATE_META } from "../src/index.ts"
import { inputs, APP } from "./fixtures.mjs"

test("세 예약 메일은 거래·법정 안내 종류이고, 광고 입력(promo)은 거절한다", async () => {
  for (const name of ["bookingConfirmation", "bookingCancellation", "bookingNotice"]) {
    assert.equal(kindOf(name), "transactional")
    await assert.rejects(renderEmail(name, { ...inputs("en")[name], promo: { text: "Save 20%" } }), EmailRenderError, name)
  }
  assert.equal(TEMPLATE_META.bookingNotice.action, "one")
  assert.equal(TEMPLATE_META.bookingConfirmation.action, "none")
})

test("예약 확인: 상태가 requested 면 「접수」 문구, confirmed 면 「확정」 문구(ko·en)", async () => {
  const ko = (patch) => renderEmail("bookingConfirmation", { ...inputs("ko").bookingConfirmation, ...patch })
  const en = (patch) => renderEmail("bookingConfirmation", { ...inputs("en").bookingConfirmation, ...patch })
  const confirmedKo = await ko({ status: "confirmed" })
  assert.equal(confirmedKo.subject, "SampleCo 예약이 확정됐어요")
  assert.match(confirmedKo.text, /예약이 확정됐어요/)
  const requestedKo = await ko({ status: "requested" })
  assert.equal(requestedKo.subject, "SampleCo 예약 요청을 받았어요")
  assert.match(requestedKo.text, /예약 요청을 받았어요\. 확인이 끝나면 확정 안내를 다시 보내 드려요/)
  assert.ok(!/확정됐어요/.test(requestedKo.text), "접수 메일은 확정이라고 말하지 않는다")
  const requestedEn = await en({ status: "requested" })
  assert.equal(requestedEn.subject, "We received your SampleCo booking request")
  assert.match(requestedEn.text, /We will email you again once it is confirmed/)
  assert.ok(!/booking is confirmed/i.test(requestedEn.text), "접수 메일은 확정이라고 말하지 않는다")
  assert.equal((await en({ status: "confirmed" })).subject, "Your SampleCo booking is confirmed")
})

test("예약 확인: 알림 모양(reminder)은 확정된 예약에만 쓰고, 문구가 바뀐다", async () => {
  const base = inputs("en").bookingConfirmation
  const mail = await renderEmail("bookingConfirmation", { ...base, reminder: true })
  assert.equal(mail.subject, "Your SampleCo booking is coming up")
  assert.match(mail.text, /Your booking is coming up soon/)
  await assert.rejects(renderEmail("bookingConfirmation", { ...base, status: "requested", reminder: true }), (e) => e instanceof EmailRenderError && /reminder/.test(e.message))
})

test("예약 확인: 예약 번호·서비스·일시(가게 시간대)·인원이 실리고, 취소 마감 줄과 관리 링크는 선택이다", async () => {
  const base = inputs("ko").bookingConfirmation
  const mail = await renderEmail("bookingConfirmation", base)
  for (const s of ["B-7K3M9P2A", "커트", "2026년 11월 2일 오전 10:00 GMT+9", "인원: 2", "오전 8:00 GMT+9까지는 직접 취소할 수 있어요"]) assert.ok(mail.text.includes(s), s)
  assert.ok(mail.html.includes(`href="${APP}/book/manage"`))
  const bare = await renderEmail("bookingConfirmation", { ...base, cancelBy: undefined, manageUrl: undefined })
  assert.ok(!bare.text.includes("직접 취소") && !bare.html.includes(APP))
  // 시간대를 안 주면 ko 는 서울, en 은 UTC 기본값
  const en = await renderEmail("bookingConfirmation", { ...inputs("en").bookingConfirmation, timeZone: undefined })
  assert.match(en.text, /10:00 AM UTC|1:00 AM UTC/)
})

test("예약 확인·취소는 방문자가 쓴 이름·메모를 싣지 않는다 — 남의 주소로 임의의 글을 보내는 통로가 되지 않게", async () => {
  const evil = { name: "EVIL-NAME", note: "EVIL-NOTE", recipientName: "EVIL-RECIPIENT", contact: "EVIL-CONTACT" }
  for (const name of ["bookingConfirmation", "bookingCancellation"]) {
    const mail = await renderEmail(name, { ...inputs("en")[name], ...evil })
    assert.ok(!/EVIL/.test(mail.html + mail.text), name)
  }
  const notice = await renderEmail("bookingNotice", { ...inputs("en").bookingNotice, name: "Kim <b>", note: "<script>x</script>" })
  assert.ok(notice.html.includes("Kim &lt;b&gt;") && !notice.html.includes("<script>x"), "대표용은 싣되 HTML 은 이스케이프")
})

test("예약 취소: 누가 취소했는지에 따라 한 줄이 다르다", async () => {
  const base = inputs("ko").bookingCancellation
  assert.match((await renderEmail("bookingCancellation", { ...base, cancelledBy: "booker" })).text, /요청하신 대로 예약을 취소했어요/)
  assert.match((await renderEmail("bookingCancellation", { ...base, cancelledBy: "owner" })).text, /사정이 생겨 예약을 취소하게 됐어요/)
  assert.match((await renderEmail("bookingCancellation", { ...base, cancelledBy: "system" })).text, /예약이 취소됐어요\. 궁금한 점은/)
  assert.ok(!(await renderEmail("bookingCancellation", { ...base, bookUrl: undefined })).html.includes(APP))
})

test("대표 알림: 상태에 따라 제목이 다르고(접수 요청·확정), 메모가 없으면 줄이 없다", async () => {
  const base = inputs("en").bookingNotice
  assert.equal((await renderEmail("bookingNotice", { ...base, status: "requested" })).subject, "New booking request B-7K3M9P2A on SampleCo")
  const instant = await renderEmail("bookingNotice", { ...base, status: "confirmed", note: undefined, name: undefined })
  assert.equal(instant.subject, "New booking B-7K3M9P2A on SampleCo")
  assert.match(instant.text, /confirmed right away/)
  assert.ok(!instant.text.includes("Note:") && !instant.text.includes("Name:"))
})

test("입력이 틀리면 렌더 오류(문제를 한 번에 모두 알린다): 예약 번호·서비스 이름·일시·인원·상태·링크", async () => {
  const cases = [
    ["bookingConfirmation", { reference: "7-7K3M9P2A" }, /reference/],
    ["bookingConfirmation", { reference: "" }, /reference/],
    ["bookingConfirmation", { serviceName: " " }, /serviceName/],
    ["bookingConfirmation", { startsAt: "tomorrow" }, /startsAt/],
    ["bookingConfirmation", { partySize: 0 }, /partySize/],
    ["bookingConfirmation", { partySize: 1.5 }, /partySize/],
    ["bookingConfirmation", { status: "pending" }, /status/],
    ["bookingConfirmation", { cancelBy: "soon" }, /cancelBy/],
    ["bookingConfirmation", { manageUrl: "javascript:alert(1)" }, /manageUrl/],
    ["bookingCancellation", { cancelledBy: "nobody" }, /cancelledBy/],
    ["bookingCancellation", { bookUrl: "/book" }, /bookUrl/],
    ["bookingNotice", { contact: " " }, /contact/],
    ["bookingNotice", { deleteOn: "never" }, /deleteOn/],
    ["bookingNotice", { adminUrl: "http://insecure.example/x" }, /adminUrl/],
    ["bookingNotice", { status: undefined }, /status/],
  ]
  for (const [name, patch, pattern] of cases) {
    for (const locale of ["ko", "en"]) {
      await assert.rejects(renderEmail(name, { ...inputs(locale)[name], ...patch }), (e) => e instanceof EmailRenderError && e.template === name && pattern.test(e.problems.join("\n")), `${name} ${JSON.stringify(patch)}`)
    }
  }
  await assert.rejects(renderEmail("bookingConfirmation", { ...inputs("en").bookingConfirmation, reference: "x", serviceName: "", startsAt: "no" }), (e) => e.problems.length === 3)
})

test("문구는 입력(copy)으로 덮어쓴다 — 자리표시에 값이 없으면 렌더 오류", async () => {
  const base = inputs("en").bookingConfirmation
  const mail = await renderEmail("bookingConfirmation", { ...base, copy: { subject: "See you soon at {productName}" } })
  assert.equal(mail.subject, "See you soon at SampleCo")
  await assert.rejects(renderEmail("bookingConfirmation", { ...base, copy: { subject: "Hi {nickname}" } }), (e) => e instanceof EmailRenderError && /nickname/.test(e.message))
})

// ── 예약금(계획 3d L3): 금액·기한·환불 규정 문장. 예약금 칸이 없으면 예전 메일 그대로다 ──────────────────────────
const KRW = (amount) => ({ amount, currency: "KRW", vatIncluded: true })

test("예약 확인(예약금): 결제 대기는 결제 안내 모양 — 금액·기한·환불 규정이 실리고, 확정이라고 말하지 않는다", async () => {
  const base = { ...inputs("ko").bookingConfirmation, status: "requested", deposit: { state: "pending", amount: KRW(20000), payBy: "2026-10-30T03:30:00.000Z", refund: { fullBefore: "2026-11-01T01:00:00.000Z", laterPercent: 0 } } }
  const mail = await renderEmail("bookingConfirmation", base)
  assert.equal(mail.subject, "SampleCo 예약금을 결제해 주세요")
  for (const s of ["예약금: ₩20,000", "오후 12:30 GMT+9까지 결제해 주세요", "청구되는 금액은 없어요", "전부 돌려드려요. 그 뒤에는 돌려드리지 않아요"]) assert.ok(mail.text.includes(s), s)
  assert.ok(!/확정됐어요/.test(mail.text))
  const en = await renderEmail("bookingConfirmation", { ...inputs("en").bookingConfirmation, status: "requested", deposit: { ...base.deposit, amount: { amount: 2000, currency: "USD", vatIncluded: false }, refund: { fullBefore: "2026-11-01T01:00:00.000Z", laterPercent: 50 } } })
  assert.equal(en.subject, "Pay the deposit for your SampleCo booking")
  assert.match(en.text, /Deposit: \$20\.00/)
  assert.match(en.text, /After that, 50% of the deposit is refunded/)
})

test("예약 확인(예약금): 결제가 끝나면 보통 확정 모양 + 예약금 줄 · 입력이 틀리면 거절한다", async () => {
  const paid = await renderEmail("bookingConfirmation", { ...inputs("ko").bookingConfirmation, deposit: { state: "paid", amount: KRW(20000), refund: { fullBefore: "2026-11-01T01:00:00.000Z", laterPercent: 30 } } })
  assert.equal(paid.subject, "SampleCo 예약이 확정됐어요")
  assert.match(paid.text, /예약금: ₩20,000/)
  assert.match(paid.text, /예약금 결제가 끝났어요/)
  assert.match(paid.text, /예약금의 30%를 돌려드려요/)
  const base = inputs("ko").bookingConfirmation
  const bad = (patch, re) => assert.rejects(renderEmail("bookingConfirmation", { ...base, ...patch }), (e) => e instanceof EmailRenderError && re.test(e.message))
  await bad({ status: "requested", deposit: { state: "pending", amount: KRW(20000) } }, /payBy/)
  await bad({ status: "confirmed", deposit: { state: "pending", amount: KRW(20000), payBy: "2026-10-30T03:30:00.000Z" } }, /pending deposit/)
  await bad({ deposit: { state: "paid", amount: KRW(0) } }, /amount/)
  await bad({ deposit: { state: "paid", amount: KRW(1000), refund: { fullBefore: "2026-11-01T01:00:00.000Z", laterPercent: 100 } } }, /laterPercent/)
  // 예약금 칸이 없으면 예전 메일과 글자까지 같다
  const plain = await renderEmail("bookingConfirmation", base)
  assert.ok(!plain.text.includes("예약금"))
})

test("예약 취소(예약금): 닫힘·전액·일부·환불 없음 문장 — 환불 금액은 돌려준 경우에만", async () => {
  const base = inputs("ko").bookingCancellation
  const run = (deposit) => renderEmail("bookingCancellation", { ...base, deposit })
  assert.match((await run({ outcome: "expired" })).text, /결제하지 않았으니 청구되는 금액은 없어요/)
  const refunded = await run({ outcome: "refunded", refunded: KRW(20000) })
  assert.match(refunded.text, /돌려드린 예약금: ₩20,000/)
  assert.match(refunded.text, /예약금을 돌려드렸어요/)
  const partial = await run({ outcome: "partial", refunded: KRW(6000) })
  assert.match(partial.text, /돌려드린 예약금: ₩6,000/)
  assert.match(partial.text, /일부만 돌려드렸어요/)
  const forfeited = await run({ outcome: "forfeited" })
  assert.match(forfeited.text, /예약금은 돌려드리지 않아요/)
  assert.ok(!forfeited.text.includes("돌려드린 예약금"))
  await assert.rejects(run({ outcome: "refunded" }), (e) => e instanceof EmailRenderError && /refunded/.test(e.message))
  await assert.rejects(run({ outcome: "nope" }), EmailRenderError)
})

test("새 예약 알림(예약금): 결제가 끝난 예약에만 예약금 줄이 붙는다", async () => {
  const base = inputs("en").bookingNotice
  assert.ok(!(await renderEmail("bookingNotice", base)).text.includes("Deposit"))
  const mail = await renderEmail("bookingNotice", { ...base, depositPaid: { amount: 2000, currency: "USD", vatIncluded: false } })
  assert.match(mail.text, /Deposit: \$20\.00/)
  assert.match(mail.text, /deposit for this booking has been paid/)
  await assert.rejects(renderEmail("bookingNotice", { ...base, depositPaid: { amount: 0, currency: "USD", vatIncluded: false } }), EmailRenderError)
})
