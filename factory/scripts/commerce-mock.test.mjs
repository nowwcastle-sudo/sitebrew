// 판매 포트 목 mockCommerce(계획 3a Task A3): 한 바퀴(담기 → 합계 → 확인 없는 주문하기는 승인 대기 → 확인과 함께 결제 대기 주문 + 결제창 값 → 결제 확정 → 취소·환불),
// 재고 부족, 쿼리 장면(?cart= ?order= ?stock= ?state= ?submit=), 금액은 최소 단위 정수. 목은 결정적이고 호출마다 새 인스턴스라 상태가 새지 않는다.
// 실행: node --test --test-force-exit --test-timeout=60000 factory/scripts/commerce-mock.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const DIR = join(root, 'registry', 'factory', 'contract')
const OUT = join(root, '.tmp', 'commerce-mock-test')
const js = (src) => ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText

// 원천 .ts → .tmp/commerce-mock-test/<이름>.mjs. 계약 값 import(adapter-mock)와 lib 값 import 는 변환본 주소로 잇는다. 타입 import 는 사라진다.
function transpile(file, name) {
  mkdirSync(OUT, { recursive: true })
  const out = js(readFileSync(file, 'utf8'))
    .replace(/(from\s+)(["'])@\/registry\/factory\/lib\/([a-z-]+)\2/g, (_, kw, q, lib) => `${kw}${q}${pathToFileURL(transpile(join(root, 'registry', 'factory', 'lib', `${lib}.ts`), `lib-${lib}`)).href}${q}`)
    .replace(/(from\s+)(["'])@\/registry\/factory\/contract\/([a-z-]+)\2/g, (_, kw, q, c) => `${kw}${q}${pathToFileURL(transpile(join(DIR, `${c}.ts`), c)).href}${q}`)
  assert.doesNotMatch(out, /@\/registry\//, `${name}: 변환본에 계약 경로 import 가 남았다`)
  const path = join(OUT, `${name}.mjs`)
  writeFileSync(path, out)
  return path
}
const m = await import(pathToFileURL(transpile(join(DIR, 'adapter-mock-commerce.ts'), 'adapter-mock-commerce')).href)

const ADDRESS = { recipient: '김예시', phone: '010-0000-0000', postcode: '04524', address1: '서울시 가상구 예시로 1', address2: '101호' }
const sum = (lines) => lines.reduce((s, l) => s + l.unitPrice.amount * l.quantity, 0)
const isMinor = (n) => Number.isInteger(n) && n >= 0
const MUG = 'sku-mug'
const BEANS = 'sku-beans'

// ① 한 바퀴 ────────────────────────────────────────────────────────────────
test('한 바퀴: 빈 장바구니 → 담기 → 합계(배송비 규칙) → 확인 없는 주문하기는 승인 대기 → 확인과 함께 결제 대기 주문 + 결제창 값 → 결제 확정 → 취소는 환불', async () => {
  const c = m.mockCommerce('', { requireConfirmation: true })
  const empty = await c.cart()
  assert.deepEqual([empty.ok, empty.data.lines, empty.data.subtotal.amount, empty.data.shipping.amount, empty.data.total.amount], [true, [], 0, 0, 0])

  // 담기: 합계는 줄의 합, 소계가 무료 배송 기준 미만이면 배송비가 붙는다
  const one = await c.setCartLine({ productId: MUG, quantity: 2 })
  assert.equal(one.ok, true)
  assert.equal(one.data.lines.length, 1)
  assert.equal(one.data.subtotal.amount, sum(one.data.lines))
  assert.equal(one.data.shipping.amount, m.MOCK_SHIPPING.fee)
  assert.equal(one.data.total.amount, one.data.subtotal.amount + one.data.shipping.amount)
  // 무료 배송 기준 이상이면 배송비 0
  const big = await c.setCartLine({ productId: BEANS, quantity: 3 })
  assert.ok(big.data.subtotal.amount >= m.MOCK_SHIPPING.freeOver)
  assert.equal(big.data.shipping.amount, 0)
  // 수량 0 은 줄을 뺀다
  const removed = await c.setCartLine({ productId: BEANS, quantity: 0 })
  assert.deepEqual(removed.data.lines.map((l) => l.productId), [MUG])

  // 확인 없이 주문하기 → 승인 대기, 장바구니·재고 그대로
  const before = await c.cart()
  const wait = await c.placeOrder({ address: ADDRESS })
  assert.equal(wait.ok, false)
  assert.equal(wait.code, 'confirmation_required')
  assert.equal(wait.retryable, false)
  assert.ok(wait.fieldErrors.confirmed)
  assert.deepEqual((await c.cart()).data, before.data)
  assert.deepEqual((await c.orders()).data, [])

  // 확인과 함께 → 결제 대기 주문 + 결제창 값
  const placed = await c.placeOrder({ address: ADDRESS, confirmed: true })
  assert.equal(placed.ok, true)
  const { order, payment } = placed.data
  assert.equal(order.status, 'pending_payment')
  assert.deepEqual(order.address, ADDRESS)
  assert.deepEqual(order.lines.map((l) => [l.productId, l.quantity]), [[MUG, 2]])
  assert.equal(order.total.amount, before.data.total.amount)
  assert.equal(payment.provider, 'mock')
  assert.ok(payment.paymentId && payment.orderName)
  assert.deepEqual(payment.total, order.total)
  assert.deepEqual(payment.client, {})
  assert.equal((await c.cart()).data.lines.length, 0, '주문하면 장바구니가 비워진다')

  // 결제 확정 → paid (두 번째 호출도 같은 결과 — 멱등)
  const paid = await c.confirmPayment({ orderId: order.id, paymentId: payment.paymentId })
  assert.equal(paid.ok, true)
  assert.equal(paid.data.status, 'paid')
  assert.ok(paid.data.paidAt)
  assert.deepEqual((await c.confirmPayment({ orderId: order.id, paymentId: payment.paymentId })).data, paid.data)
  assert.equal((await c.confirmPayment({ orderId: order.id, paymentId: 'wrong' })).ok, false, '다른 결제 번호는 확정하지 않는다')

  // 내 주문 · 한 건
  assert.deepEqual((await c.orders()).data.map((o) => o.id), [order.id])
  assert.equal((await c.order({ orderId: order.id })).data.status, 'paid')
  assert.equal((await c.order({ orderId: 'nope' })).ok, false)

  // 취소: 확인 없이는 승인 대기, 확인과 함께면 결제 완료 주문은 환불
  const askCancel = await c.cancelOrder({ orderId: order.id })
  assert.equal(askCancel.code, 'confirmation_required')
  assert.equal((await c.order({ orderId: order.id })).data.status, 'paid')
  const refunded = await c.cancelOrder({ orderId: order.id, reason: '단순 변심', confirmed: true })
  assert.equal(refunded.data.status, 'refunded')
  assert.ok(refunded.data.canceledAt)
  // 끝난 주문은 다시 취소할 수 없다
  const again = await c.cancelOrder({ orderId: order.id, confirmed: true })
  assert.equal(again.ok, false)
  assert.equal(again.code, 'not_cancelable')
})

test('requireConfirmation 이 없으면(기본) 확인 입력 없이도 부를 수 있다 — 요구하는 어댑터만 승인 대기로 끝낸다', async () => {
  const c = m.mockCommerce('?cart=filled')
  const placed = await c.placeOrder({ address: ADDRESS })
  assert.equal(placed.ok, true)
  assert.equal((await c.cancelOrder({ orderId: placed.data.order.id })).data.status, 'canceled', '결제 전 주문의 취소는 canceled')
})

test('confirmed 는 true 만 확인으로 읽는다 — 문자열·1 은 승인 대기', async () => {
  const c = m.mockCommerce('?cart=filled', { requireConfirmation: true })
  for (const bad of ['true', 1, false]) assert.equal((await c.placeOrder({ address: ADDRESS, confirmed: bad })).code, 'confirmation_required')
})

// ② 입력 검사 ──────────────────────────────────────────────────────────────
test('주문 검사: 빈 장바구니는 empty_cart, 배송지 필수 칸(받는 분·전화·우편번호·주소)이 비면 fieldErrors — 둘 다 재고·장바구니를 건드리지 않는다', async () => {
  const c = m.mockCommerce('')
  const empty = await c.placeOrder({ address: ADDRESS, confirmed: true })
  assert.deepEqual([empty.ok, empty.code, empty.retryable], [false, 'empty_cart', false])
  await c.setCartLine({ productId: MUG, quantity: 1 })
  const bad = await c.placeOrder({ address: { recipient: ' ', phone: '', postcode: '', address1: '' }, confirmed: true })
  assert.equal(bad.ok, false)
  assert.deepEqual(Object.keys(bad.fieldErrors).sort(), ['address1', 'phone', 'postcode', 'recipient'])
  assert.equal((await c.cart()).data.lines.length, 1)
})

test('setCartLine 검사: 없는 상품 · 0~99 밖이거나 정수가 아닌 수량은 fieldErrors', async () => {
  const c = m.mockCommerce('')
  assert.deepEqual(Object.keys((await c.setCartLine({ productId: 'nope', quantity: 1 })).fieldErrors), ['productId'])
  for (const q of [-1, 1.5, 100, Number.NaN]) assert.deepEqual(Object.keys((await c.setCartLine({ productId: MUG, quantity: q })).fieldErrors), ['quantity'], String(q))
})

// ③ 재고 ───────────────────────────────────────────────────────────────────
test('재고 부족: 남은 수보다 많이 담으면 code out_of_stock + fieldErrors[상품 id], 재고 제한 없는 상품(stock null)은 걸리지 않는다', async () => {
  const c = m.mockCommerce('')
  const catalog = (await c.catalog()).data
  const limited = catalog.find((i) => i.stock !== null)
  const unlimited = catalog.find((i) => i.stock === null)
  assert.ok(limited && unlimited)
  const over = await c.setCartLine({ productId: limited.id, quantity: limited.stock + 1 })
  assert.deepEqual([over.ok, over.code, over.retryable], [false, 'out_of_stock', false])
  assert.ok(over.fieldErrors[limited.id])
  assert.equal((await c.setCartLine({ productId: limited.id, quantity: limited.stock })).ok, true)
  assert.equal((await c.setCartLine({ productId: unlimited.id, quantity: 99 })).ok, true)
})

test('?stock=out: 첫 상품이 품절 — 담을 수 없고, 이미 담긴 줄은 available 0 으로 보여 주문이 out_of_stock 으로 막힌다', async () => {
  const c = m.mockCommerce('?stock=out&cart=filled')
  const catalog = (await c.catalog()).data
  assert.equal(catalog[0].stock, 0)
  assert.equal((await c.setCartLine({ productId: catalog[0].id, quantity: 1 })).code, 'out_of_stock')
  const cart = (await c.cart()).data
  assert.equal(cart.lines.find((l) => l.productId === catalog[0].id).available, 0)
  const placed = await c.placeOrder({ address: ADDRESS, confirmed: true })
  assert.deepEqual([placed.ok, placed.code], [false, 'out_of_stock'])
  assert.deepEqual(Object.keys(placed.fieldErrors), [catalog[0].id], '오류 칸 이름은 상품 id 다')
  assert.equal((await c.orders()).data.length, 0)
})

test('주문하면 재고를 잡고, 결제 전 취소(canceled)하면 돌려준다', async () => {
  const c = m.mockCommerce('')
  const item = (await c.catalog()).data.find((i) => i.stock !== null)
  await c.setCartLine({ productId: item.id, quantity: item.stock })
  const placed = await c.placeOrder({ address: ADDRESS, confirmed: true })
  assert.equal((await c.catalog()).data.find((i) => i.id === item.id).stock, 0)
  assert.equal((await c.cancelOrder({ orderId: placed.data.order.id, confirmed: true })).data.status, 'canceled')
  assert.equal((await c.catalog()).data.find((i) => i.id === item.id).stock, item.stock)
})

// ④ 쿼리 장면 ──────────────────────────────────────────────────────────────
test('?cart=filled 는 담긴 장바구니로 시작하고 합계가 줄과 맞는다, ?cart=empty(기본)는 빈 장바구니', async () => {
  const filled = (await m.mockCommerce('?cart=filled').cart()).data
  assert.ok(filled.lines.length >= 2)
  assert.equal(filled.subtotal.amount, sum(filled.lines))
  assert.equal(filled.total.amount, filled.subtotal.amount + filled.shipping.amount)
  assert.equal((await m.mockCommerce('?cart=empty').cart()).data.lines.length, 0)
  assert.throws(() => m.mockCommerce('?cart=weird'), /cart=weird.*empty\|filled/)
})

test('?order=<상태> 는 그 상태의 주문 하나로 시작한다 — 일곱 상태 모두, 결제 뒤 상태는 paidAt, 배송 뒤는 송장번호, 취소·환불은 canceledAt', async () => {
  assert.deepEqual([...m.MOCK_ORDER_STATUSES], ['pending_payment', 'paid', 'preparing', 'shipped', 'delivered', 'canceled', 'refunded'])
  assert.deepEqual((await m.mockCommerce('').orders()).data, [])
  for (const s of m.MOCK_ORDER_STATUSES) {
    const list = (await m.mockCommerce(`?order=${s}`).orders()).data
    assert.equal(list.length, 1, s)
    const o = list[0]
    assert.equal(o.status, s)
    assert.equal(o.total.amount, o.subtotal.amount + o.shipping.amount, s)
    assert.equal(Boolean(o.paidAt), ['paid', 'preparing', 'shipped', 'delivered', 'refunded'].includes(s), `${s} paidAt`)
    assert.equal(Boolean(o.trackingNumber), ['shipped', 'delivered'].includes(s), `${s} trackingNumber`)
    assert.equal(Boolean(o.canceledAt), ['canceled', 'refunded'].includes(s), `${s} canceledAt`)
  }
  assert.throws(() => m.mockCommerce('?order=lost'), /order=lost.*pending_payment/)
})

test('?order=shipped 의 주문은 취소할 수 없다(not_cancelable) · paid 는 환불, pending_payment 는 canceled', async () => {
  const shipped = m.mockCommerce('?order=shipped')
  const id = (await shipped.orders()).data[0].id
  const r = await shipped.cancelOrder({ orderId: id, confirmed: true })
  assert.deepEqual([r.ok, r.code, r.retryable], [false, 'not_cancelable', false])
  assert.equal((await shipped.order({ orderId: id })).data.status, 'shipped')
  const paid = m.mockCommerce('?order=paid')
  assert.equal((await paid.cancelOrder({ orderId: (await paid.orders()).data[0].id, confirmed: true })).data.status, 'refunded')
  const pending = m.mockCommerce('?order=pending_payment')
  assert.equal((await pending.cancelOrder({ orderId: (await pending.orders()).data[0].id, confirmed: true })).data.status, 'canceled')
})

test('?state=loading 은 끝나지 않고, error 는 다시 시도할 수 있는 오류, empty 는 빈 값 — 읽기 메서드 모두', async () => {
  const never = (p) => Promise.race([p.then(() => 'settled'), new Promise((r) => setImmediate(() => r('pending')))])
  for (const read of ['catalog', 'cart', 'orders']) assert.equal(await never(m.mockCommerce('?state=loading')[read]()), 'pending', read)
  assert.equal(await never(m.mockCommerce('?state=loading').order({ orderId: 'x' })), 'pending')
  for (const read of ['catalog', 'cart', 'orders']) {
    const e = await m.mockCommerce('?state=error')[read]()
    assert.deepEqual([e.ok, e.retryable], [false, true], read)
  }
  assert.deepEqual((await m.mockCommerce('?state=empty').catalog()).data, [])
  assert.deepEqual((await m.mockCommerce('?state=empty&cart=filled').cart()).data.lines, [])
  assert.deepEqual((await m.mockCommerce('?state=empty').orders()).data, [])
})

test('?submit= 은 쓰기 메서드를 그 결과로 끝내고 상태를 건드리지 않는다(field-error·server-error·rate-limited·approval-required, pending·timeout 은 끝나지 않는다)', async () => {
  const never = (p) => Promise.race([p.then(() => 'settled'), new Promise((r) => setImmediate(() => r('pending')))])
  const fe = await m.mockCommerce('?submit=field-error').setCartLine({ productId: MUG, quantity: 1 })
  assert.equal(fe.ok, false)
  assert.ok(fe.fieldErrors)
  const se = await m.mockCommerce('?submit=server-error').placeOrder({ address: ADDRESS, confirmed: true })
  assert.deepEqual([se.ok, se.retryable], [false, true])
  assert.equal((await m.mockCommerce('?submit=rate-limited&retryAfter=7').setCartLine({ productId: MUG, quantity: 1 })).retryAfter, 7)
  assert.equal((await m.mockCommerce('?submit=approval-required').cancelOrder({ orderId: 'x' })).code, 'confirmation_required')
  for (const s of ['pending', 'timeout']) assert.equal(await never(m.mockCommerce(`?submit=${s}`).setCartLine({ productId: MUG, quantity: 1 })), 'pending', s)
  const c = m.mockCommerce('?submit=server-error&cart=filled')
  await c.placeOrder({ address: ADDRESS, confirmed: true })
  assert.ok((await c.cart()).data.lines.length > 0)
  assert.deepEqual((await c.orders()).data, [])
})

// ⑤ 금액·결정성 ────────────────────────────────────────────────────────────
test('금액은 최소 단위 정수(KRW 원)이고 vatIncluded 다 — 상품 가격·장바구니·주문·결제창 값 모두', async () => {
  const c = m.mockCommerce('?cart=filled&order=paid')
  const moneys = []
  for (const i of (await c.catalog()).data) moneys.push(i.price)
  const cart = (await c.cart()).data
  moneys.push(cart.subtotal, cart.shipping, cart.total, ...cart.lines.map((l) => l.unitPrice))
  const o = (await c.orders()).data[0]
  moneys.push(o.subtotal, o.shipping, o.total)
  const placed = await c.placeOrder({ address: ADDRESS, confirmed: true })
  moneys.push(placed.data.payment.total)
  for (const x of moneys) {
    assert.ok(isMinor(x.amount), JSON.stringify(x))
    assert.equal(x.currency, 'KRW')
    assert.equal(x.vatIncluded, true)
  }
})

test('결정적이다: 같은 쿼리의 새 인스턴스는 같은 처음 상태이고 서로의 상태가 새지 않는다 · 돌려준 값을 고쳐도 목 안은 그대로다', async () => {
  const a = m.mockCommerce('?cart=filled')
  const b = m.mockCommerce('?cart=filled')
  await a.setCartLine({ productId: MUG, quantity: 5 })
  assert.deepEqual((await b.cart()).data, (await m.mockCommerce('?cart=filled').cart()).data)
  const got = (await b.cart()).data
  got.lines.length = 0
  assert.ok((await b.cart()).data.lines.length > 0)
  const o1 = (await a.placeOrder({ address: ADDRESS, confirmed: true })).data.order.id
  const o2 = (await m.mockCommerce('?cart=filled').placeOrder({ address: ADDRESS, confirmed: true })).data.order.id
  assert.equal(o1, o2)
})

test('카탈로그·배송 규칙은 options 로 바꾼다(catalog·shipping) — 잘못된 가격(정수가 아님·0 이하)이나 중복 id 는 만들 때 한국어로 멈춘다', async () => {
  const c = m.mockCommerce('', { catalog: [{ id: 'x', name: '시험 상품(예시)', price: { amount: 1_000, currency: 'KRW', vatIncluded: true }, stock: null }], shipping: { fee: 2_500, freeOver: 5_000 } })
  assert.deepEqual((await c.catalog()).data.map((i) => i.id), ['x'])
  assert.equal((await c.setCartLine({ productId: 'x', quantity: 1 })).data.shipping.amount, 2_500)
  assert.equal((await c.setCartLine({ productId: 'x', quantity: 5 })).data.shipping.amount, 0)
  const item = { id: 'x', name: 'n', price: { amount: 1, currency: 'KRW', vatIncluded: true }, stock: null }
  assert.throws(() => m.mockCommerce('', { catalog: [{ ...item, price: { ...item.price, amount: 1.5 } }] }), /mock: .*가격/)
  assert.throws(() => m.mockCommerce('', { catalog: [item, item] }), /mock: .*중복/)
})

// ⑥ 경계 ───────────────────────────────────────────────────────────────────
test('mockCommerce 의 JSDoc 에 서버→클라이언트 경계 안내(「서버 컴포넌트」)가 있다 — shadcn 이 파일 머리 주석을 지운다', () => {
  const src = readFileSync(join(DIR, 'adapter-mock-commerce.ts'), 'utf8')
  const doc = src.match(/\/\*\*((?:(?!\*\/)[\s\S])*)\*\/\s*export function mockCommerce\b/)
  assert.ok(doc, 'JSDoc 이 없다')
  assert.match(doc[1], /서버 컴포넌트/)
})

test('목은 네트워크·타이머를 쓰지 않는다(지연 옵션 없이는) — fetch 가 던져도 한 바퀴가 돈다', async () => {
  const saved = globalThis.fetch
  globalThis.fetch = () => { throw new Error('network used') }
  try {
    const c = m.mockCommerce('?cart=filled')
    const placed = await c.placeOrder({ address: ADDRESS, confirmed: true })
    assert.equal((await c.confirmPayment({ orderId: placed.data.order.id, paymentId: placed.data.payment.paymentId })).data.status, 'paid')
  } finally { globalThis.fetch = saved }
})
