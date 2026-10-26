// 상점 주문 확인 메일(계획 3a B5) — 줄 목록·합계·배송지·「내 주문 보기」. 형식 일반 규칙(G02·G07)은 mail-format.test.mjs 가 모든 템플릿에 돌린다.
import { test } from "node:test"
import assert from "node:assert/strict"
import { EmailRenderError, kindOf, renderEmail, TEMPLATE_META } from "../src/index.ts"
import { APP, inputs } from "./fixtures.mjs"

test("종류 표: 거래 안내이고 눈에 띄는 단추가 하나다", () => {
  assert.equal(kindOf("shopOrderConfirmation"), "transactional")
  assert.deepEqual(TEMPLATE_META.shopOrderConfirmation, { kind: "transactional", action: "one" })
})

test("ko: 주문 줄·수량·단가, 상품 금액·배송비·총 결제 금액(부가세), 배송지, 내 주문 링크가 평문에 모두 있다", async () => {
  const mail = await renderEmail("shopOrderConfirmation", inputs("ko").shopOrderConfirmation)
  for (const s of ["ord_01JH2X", "예시 머그컵 × 2", "₩15,000", "예시 컵받침 × 1", "₩4,000", "₩34,000", "₩3,000", "₩37,000 (부가세 포함)", "2026년 9월 30일", "김예시", "010-0000-0000", "(00000) 예시시 예시로 1 101동 202호", "문 앞에 놓아 주세요", "내 주문 보기", `${APP}/orders`]) {
    assert.ok(mail.text.includes(s), `ko 평문에 ${s}`)
  }
  assert.ok(mail.subject.includes("SampleCo") && mail.subject.includes("ord_01JH2X"))
  assert.ok(mail.html.includes(`href="${APP}/orders"`))
})

test("en: 같은 칸이 영어로 나온다", async () => {
  const mail = await renderEmail("shopOrderConfirmation", inputs("en").shopOrderConfirmation)
  for (const s of ["Sample mug × 2", "$15.00", "$34.00", "$5.00", "$39.00", "September 30, 2026", "Jamie Example", "(00000) 1 Example St Apt 2", "Leave at the door", "View my order", `${APP}/orders`]) {
    assert.ok(mail.text.includes(s), `en 평문에 ${s}`)
  }
})

test("배송비 0 은 숫자 대신 「무료」/「Free」로 말한다", async () => {
  for (const [locale, free] of [["ko", "무료"], ["en", "Free"]]) {
    const i = inputs(locale).shopOrderConfirmation
    const zero = { ...i.shipping, amount: 0 }
    const mail = await renderEmail("shopOrderConfirmation", { ...i, shipping: zero, total: { ...i.total, amount: i.subtotal.amount } })
    assert.match(mail.text, new RegExp(`(배송비|Shipping): ${free}`), locale)
  }
})

test("선택 칸(상세 주소·배송 메모)이 없으면 그 줄이 빠진다", async () => {
  const i = inputs("ko").shopOrderConfirmation
  const mail = await renderEmail("shopOrderConfirmation", { ...i, address: { ...i.address, address2: undefined, note: undefined } })
  assert.ok(mail.text.includes("(00000) 예시시 예시로 1"))
  assert.ok(!mail.text.includes("배송 메모"))
})

// 음성 대조: 입력이 틀리면 아무것도 만들지 않고 문제를 모두 알린다(값은 싣지 않고 칸 이름만).
const broken = [
  ["orderId 없음", (i) => ({ ...i, orderId: "" }), /orderId/],
  ["줄이 하나도 없음", (i) => ({ ...i, items: [] }), /items/],
  ["줄 이름 없음", (i) => ({ ...i, items: [{ ...i.items[0], name: "" }] }), /items\[0\]\.name/],
  ["수량 0", (i) => ({ ...i, items: [{ ...i.items[0], quantity: 0 }] }), /items\[0\]\.quantity/],
  ["수량 소수", (i) => ({ ...i, items: [{ ...i.items[0], quantity: 1.5 }] }), /items\[0\]\.quantity/],
  ["단가 소수", (i) => ({ ...i, items: [{ ...i.items[0], unitAmount: { ...i.items[0].unitAmount, amount: 9.5 } }] }), /items\[0\]\.unitAmount/],
  ["합계가 소계 + 배송비와 다름", (i) => ({ ...i, total: { ...i.total, amount: i.total.amount + 1 } }), /total must equal subtotal \+ shipping/],
  ["통화가 섞임", (i) => ({ ...i, shipping: { ...i.shipping, currency: "EUR" } }), /currency/],
  ["받는 분 없음", (i) => ({ ...i, address: { ...i.address, recipient: "" } }), /address\.recipient/],
  ["주소 없음", (i) => ({ ...i, address: { ...i.address, address1: " " } }), /address\.address1/],
  ["배송지 통째로 없음", (i) => ({ ...i, address: undefined }), /address/],
  ["주문일 날짜 아님", (i) => ({ ...i, orderedAt: "yesterday" }), /orderedAt/],
  ["ordersUrl 상대 경로", (i) => ({ ...i, ordersUrl: "/orders" }), /ordersUrl/],
  ["ordersUrl http", (i) => ({ ...i, ordersUrl: "http://insecure.example/orders" }), /ordersUrl/],
]
for (const [label, mutate, pattern] of broken) {
  test(`음성 대조 — ${label} → EmailRenderError`, async () => {
    for (const locale of ["ko", "en"]) {
      await assert.rejects(renderEmail("shopOrderConfirmation", mutate(inputs(locale).shopOrderConfirmation)), (e) => {
        assert.ok(e instanceof EmailRenderError, String(e))
        assert.equal(e.template, "shopOrderConfirmation")
        assert.match(e.problems.join("\n"), pattern)
        return true
      })
    }
  })
}

test("광고 블록 입력(promo)은 거절한다 — 거래 안내에 광고를 섞지 않는다", async () => {
  await assert.rejects(renderEmail("shopOrderConfirmation", { ...inputs("en").shopOrderConfirmation, promo: { text: "Save 20%" } }), (e) => e instanceof EmailRenderError && /promo/.test(e.message))
})

test("문구는 copy 로 덮어쓴다 — 자리표시에 값이 없으면 렌더 오류", async () => {
  const i = inputs("en").shopOrderConfirmation
  const mail = await renderEmail("shopOrderConfirmation", { ...i, copy: { subject: "Thanks! {productName} order {orderId}" } })
  assert.equal(mail.subject, "Thanks! SampleCo order ord_01JH2X")
  await assert.rejects(renderEmail("shopOrderConfirmation", { ...i, copy: { subject: "Order {nickname}" } }), (e) => e instanceof EmailRenderError && /nickname/.test(e.message))
})
