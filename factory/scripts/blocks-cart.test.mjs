// 장바구니·주문 블록(계획 3a C1~C2 — cart 4종 + account/order-history·order-detail) 정적 검사.
// 실행: node --test --test-force-exit --test-timeout=120000 factory/scripts/blocks-cart.test.mjs
// 방법: 블록 원천(.tsx)과 예시(.fixture.ts)를 typescript 로 .tmp 에 옮겨 정적 렌더(react-dom/server)한 뒤 마크업을 본다 — 브라우저 없음.
// 모션 장면은 아무것도 안 하는 가짜로 바꾼다. 클릭·포커스·결제창이 필요한 동작은 브라우저 검사(blocks:gates·agent-boundary)로 넘긴다.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = join(root, '.tmp', 'blocks-cart-test')
const B = 'registry/factory/blocks'
const STUBS = {
  [join(root, 'registry', 'factory', 'motion', 'use-gsap-scene.ts')]: 'export function useGsapScene() {}\n',
  [join(root, 'registry', 'factory', 'motion', 'gsap-techniques.ts')]: 'export function rise() {}\n',
}
const loaded = new Map()
const resolveSource = (base) => [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts')].find((f) => existsSync(f) && /\.(mjs|tsx?)$/.test(f))
function transpile(abs) {
  if (abs.endsWith('.mjs')) return abs
  if (loaded.has(abs)) return loaded.get(abs)
  const out = join(OUT, relative(root, abs).replace(/\.tsx?$/, '.mjs'))
  loaded.set(abs, out)
  let text = STUBS[abs]
  if (text === undefined) {
    text = ts.transpileModule(readFileSync(abs, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
    text = text.replace(/(from\s+|import\s*\(\s*|import\s+|export\s+\*\s+from\s+)(["'])(@\/|\.{1,2}\/)([^"']+)\2/g, (_, kw, q, pre, p) => {
      const base = pre === '@/' ? join(root, p) : resolve(dirname(abs), pre + p)
      const src = resolveSource(base)
      if (!src) throw new Error(`import 대상 없음: ${pre}${p} (${relative(root, abs)})`)
      return `${kw}${q}${pathToFileURL(transpile(src)).href}${q}`
    })
  }
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, text)
  return out
}
const load = (rel) => import(pathToFileURL(transpile(join(root, rel))).href)
const src = (rel) => readFileSync(join(root, rel), 'utf8')
const React = await import('react')
const { renderToStaticMarkup } = await import('react-dom/server')
const h = React.createElement
const HANGUL = /[가-힣]/

/** 블록 하나를 예시(fixture) 그대로(+ props 덮어쓰기) 그린다 */
async function render(kind, variant, Name, overrides = {}, which = 'fixture') {
  const mod = await load(`${B}/${kind}/${variant}.tsx`)
  const fx = await load(`${B}/${kind}/${variant}.fixture.ts`)
  return renderToStaticMarkup(h(mod[Name], { ...fx[which], ...overrides }))
}
const fixtureOf = async (kind, variant) => load(`${B}/${kind}/${variant}.fixture.ts`)
const kit = await load(`${B}/_shared/cart-kit.tsx`)
const commerceFx = await load(`${B}/cart/lines-table.fixture.ts`)
const CART = commerceFx.SAMPLE_CART

// ── 공유 조각 ──────────────────────────────────────────────────────────────────────────────────
test('cart-kit lineTotal: 단가 × 수량(최소 단위 정수 · 통화·VAT 표기는 단가 그대로)', () => {
  assert.deepEqual(kit.lineTotal({ unitPrice: { amount: 12000, currency: 'KRW', vatIncluded: true }, quantity: 3 }), { amount: 36000, currency: 'KRW', vatIncluded: true })
})

test('cart-kit CartTotalsList: 결제할 금액(data-total)이 상품 금액·배송비보다 먼저 나오고 VAT 문구가 같은 줄에 있다 — 배송비 0 은 「무료」', () => {
  const html = renderToStaticMarkup(h(kit.CartTotalsList, { totals: { ...CART, shipping: { ...CART.shipping, amount: 0 } }, copy: commerceFx.CART_TOTALS }))
  assert.match(html, /data-total=""/)
  assert.ok(html.indexOf('data-total') < html.indexOf('상품 금액') && html.indexOf('상품 금액') < html.indexOf('배송비'))
  assert.match(html, /data-price="billed"[^>]*>[^<]*원/)
  assert.match(html, /data-vat=""[^>]*>VAT 포함</)
  assert.match(html, /data-cart-shipping[\s\S]*무료/)
  assert.match(html, /aria-live="polite"/, '합계가 바뀌면 읽는다')
})

// ── cart/lines-table ──────────────────────────────────────────────────────────────────────────
const T = ['cart', 'lines-table', 'CartLinesTable']
test('cart/lines-table: 뿌리 data-block · 제목 h2(h1 없음) · 줄마다 data-cart-line · 수량 칸 id 는 id 에서 파생(재고 오류가 닿는 자리) · 합계 먼저', async () => {
  const html = await render(...T, { initial: { cart: CART } })
  assert.match(html, /data-block="cart-lines-table"/)
  assert.match(html, /<h2[^>]*id="cart-title"/)
  assert.doesNotMatch(html, /<h1/)
  assert.equal((html.match(/data-cart-line=/g) ?? []).length, 2)
  for (const l of CART.lines) assert.match(html, new RegExp(`id="cart-${l.productId}"[^>]*aria-label="${l.name} 수량"|aria-label="${l.name} 수량"[^>]*id="cart-${l.productId}"`.replace(/[()]/g, '\\$&')))
  assert.match(html, /data-total=""/)
  assert.match(html, /href="#checkout"/)
  assert.doesNotMatch(html, /data-requires-human/, '결제 전 장바구니 편집은 승인 행동이 아니다')
})
test('cart/lines-table: 빈 장바구니는 안내(role=status)와 상품 둘러보기 링크만 — 표·합계 없음', async () => {
  const html = await render(...T, { initial: { cart: { ...CART, lines: [] } } })
  assert.match(html, /role="status"/)
  assert.match(html, /장바구니가 비어 있어요/)
  assert.doesNotMatch(html, /<table|data-total/)
})
test('cart/lines-table: 읽는 중 aria-busy · 최소 예시도 그려진다', async () => {
  const html = await render(...T, {}, 'fixtureMin')
  assert.match(html, /aria-busy="true"/)
})

// ── cart/lines-cards ──────────────────────────────────────────────────────────────────────────
const C = ['cart', 'lines-cards', 'CartLinesCards']
test('cart/lines-cards: 뿌리 data-block · h2 · 카드마다 data-cart-line · 주문 요약 칸(h3)은 합계 먼저 · 승인 표지 없음', async () => {
  const html = await render(...C, { initial: { cart: CART } })
  assert.match(html, /data-block="cart-lines-cards"/)
  assert.match(html, /<h2[^>]*id="cart-title"/)
  assert.doesNotMatch(html, /<h1/)
  assert.equal((html.match(/data-cart-line=/g) ?? []).length, 2)
  assert.match(html, /<aside[^>]*aria-labelledby="cart-summary"/)
  assert.ok(html.indexOf('data-total') < html.indexOf('data-cart-shipping'))
  assert.doesNotMatch(html, /data-requires-human/)
})
test('cart/lines-cards: 빈 장바구니는 안내만(카드·요약 칸 없음)', async () => {
  const html = await render(...C, { initial: { cart: { ...CART, lines: [] } } })
  assert.match(html, /장바구니가 비어 있어요/)
  assert.doesNotMatch(html, /data-cart-line|<aside/)
})

// ── cart/totals-summary ───────────────────────────────────────────────────────────────────────
const S = ['cart', 'totals-summary', 'CartTotalsSummary']
test('cart/totals-summary: 읽기 전용 — 수량 칸·단추 없이 줄 요약과 합계 먼저, 쓰기 포트 prop 이 없다', async () => {
  const html = await render(...S, { initial: { cart: CART } })
  assert.match(html, /data-block="cart-totals-summary"/)
  assert.match(html, /<h2[^>]*id="cart-summary-title"/)
  assert.equal((html.match(/data-cart-line=/g) ?? []).length, 2)
  assert.match(html, /2개/)
  assert.doesNotMatch(html, /<input|<button|data-requires-human/)
  assert.ok(html.indexOf('data-total') < html.indexOf('data-cart-shipping'))
  assert.match(html, /href="#cart"/)
  assert.doesNotMatch(src(`${B}/cart/totals-summary.tsx`), /setCartLine|placeOrder|cancelOrder/, '쓰기 포트를 받지 않는다')
})
test('cart/totals-summary: 빈 장바구니는 안내만', async () => {
  const html = await render(...S, { initial: { cart: { ...CART, lines: [] } } })
  assert.match(html, /장바구니가 비어 있어요/)
  assert.doesNotMatch(html, /data-total/)
})

// ── cart/checkout-form ────────────────────────────────────────────────────────────────────────
const F = ['cart', 'checkout-form', 'CartCheckoutForm']
const flow = await load(`${B}/_shared/checkout-flow.tsx`)
const actions = await load('registry/factory/contract/human-actions.ts')
const { leaves } = await import(pathToFileURL(join(root, 'factory', 'stamp', 'site-bind.mjs')).href)

test('cart/checkout-form: 뿌리 data-block · h2 · 배송지 폼 · 결제 단추가 합계를 말하고 승인 표지(data-requires-human="place-order")와 안내 글이 곁에 있다', async () => {
  const html = await render(...F, { initial: { cart: CART } })
  assert.match(html, /data-block="cart-checkout-form"/)
  assert.match(html, /<h2[^>]*id="checkout-title"/)
  assert.doesNotMatch(html, /<h1/)
  assert.match(html, /<form[^>]*id="checkout-form"/)
  for (const name of ['recipient', 'phone', 'postcode', 'address1', 'address2', 'note']) assert.match(html, new RegExp(`name="${name}"`), name)
  assert.match(html, /<button[^>]*data-requires-human="place-order"[^>]*>[^<]*45,500원 결제하기/)
  const hint = html.match(/aria-describedby="([^"]+)"/)
  assert.ok(hint, '결제 단추가 안내 글을 가리킨다')
  assert.match(html, new RegExp(`id="${hint[1]}"[^>]*data-human-hint=""[^>]*>${actions.APPROVAL_HINT.ko}<`))
  assert.ok(html.indexOf('data-total') < html.indexOf('data-cart-shipping'), '주문 요약은 합계 먼저')
})
test('cart/checkout-form: 배송지 필수 칸은 필수 표시(marker)가 붙고 선택 칸은 선택 표시가 붙는다', async () => {
  const html = await render(...F, { initial: { cart: CART } })
  assert.equal((html.match(/\(필수\)/g) ?? []).length, 4)
  assert.equal((html.match(/\(선택\)/g) ?? []).length, 2)
})
test('cart/checkout-form: 빈 장바구니는 안내만 — 폼·결제 단추 없음', async () => {
  const html = await render(...F, { initial: { cart: { ...CART, lines: [] } } })
  assert.match(html, /장바구니가 비어 있어요/)
  assert.doesNotMatch(html, /<form|data-requires-human/)
})
test('cart/checkout-form: placeOrder 호출은 confirmed: true 를 싣고 안내 글을 블록에 하드코딩하지 않으며 한글 literal 이 없다(copy 로 받는다)', () => {
  const code = src(`${B}/cart/checkout-form.tsx`)
  const line = code.split(/\r?\n/).find((l) => /\.run\(\(\) => placeOrder\(/.test(l) && !/^\s*(\/\/|\*)/.test(l))
  assert.ok(line, 'placeOrder 호출 줄')
  assert.match(line, /placeOrder\(\{ address, confirmed: true \}\)/)
  assert.doesNotMatch(code, /직접 확인하고 눌러|You'll confirm/)
  assert.match(code, /approval=\{\{ action: "place-order", hint: copy\.humanHint \}\}/)
  assert.doesNotMatch(code.replace(/\/\/.*$/gm, ''), /PortOne|portone|IMP\./i, '블록은 결제 공급자를 모른다')
})
test('cart/checkout-form: place-order 승인 행동 표에 이 블록이 적혀 있다', () => {
  const row = actions.AGENT_ACTIONS.find((a) => a.id === 'place-order')
  assert.deepEqual([...row.blocks], ['cart/checkout-form'])
  assert.equal(row.tier, 'human-approval')
})

// 결제 한 바퀴(순수) — 결제창 결과로 갈래가 정해진다
const SESSION = { provider: 'mock', paymentId: 'p1', orderName: 'x', total: { amount: 1, currency: 'KRW', vatIncluded: true }, client: {} }
const ORDER = { id: 'o1', status: 'paid' }
test('payAndConfirm: 결제창이 ok 면 결제 번호로 확정하고 paid — 확정이 실패(null)면 confirm-failed(결제 번호를 남긴다, 결제창은 다시 열지 않는다)', async () => {
  const seen = []
  const out = await flow.payAndConfirm({ session: SESSION, pay: async () => ({ ok: true, paymentId: 'from-window' }), confirm: async (id) => (seen.push(id), ORDER) })
  assert.deepEqual(out, { status: 'paid', order: ORDER })
  assert.deepEqual(seen, ['from-window'], '결제창이 돌려준 번호로 확정한다')
  const noId = await flow.payAndConfirm({ session: SESSION, pay: async () => ({ ok: true, paymentId: '' }), confirm: async (id) => (seen.push(id), ORDER) })
  assert.equal(noId.status, 'paid')
  assert.equal(seen[1], 'p1', '결제창이 번호를 안 주면 주문의 결제 번호')
  assert.deepEqual(await flow.payAndConfirm({ session: SESSION, pay: async () => ({ ok: true, paymentId: 'z' }), confirm: async () => null }), { status: 'confirm-failed', paymentId: 'z' })
})
test('payAndConfirm: 결제창을 닫음(cancel 이 든 code)은 canceled — 그 밖의 실패·던짐은 canceled 가 아니다, 확정은 부르지 않는다', async () => {
  let confirmed = 0
  const confirm = async () => (confirmed++, ORDER)
  for (const code of ['canceled', 'PAY_PROCESS_CANCELED', 'user_cancel']) assert.deepEqual(await flow.payAndConfirm({ session: SESSION, pay: async () => ({ ok: false, paymentId: '', code }), confirm }), { status: 'pay-failed', canceled: true, code })
  assert.deepEqual(await flow.payAndConfirm({ session: SESSION, pay: async () => ({ ok: false, paymentId: '', code: 'card_declined' }), confirm }), { status: 'pay-failed', canceled: false, code: 'card_declined' })
  assert.deepEqual(await flow.payAndConfirm({ session: SESSION, pay: async () => { throw new Error('sdk') }, confirm }), { status: 'pay-failed', canceled: false })
  assert.equal(confirmed, 0)
})
test('phoneDigitsOk: 국내 번호 9~11자리(하이픈·공백은 세지 않는다)', () => {
  for (const ok of ['010-0000-0000', '02-123-4567', '01012345678', '031 123 4567']) assert.equal(flow.phoneDigitsOk(ok), true, ok)
  for (const bad of ['', '123', '010-0000', '010-0000-00000-1']) assert.equal(flow.phoneDigitsOk(bad), false, bad)
})

const BUSINESS_WORDS = /(?<![a-z])(?:book(?:ing|ings|ed|s)?|reserv[a-z]*|appointments?|bakery|bakeries|caf[eé]s?|clinics?|restaurants?|salons?|barber[a-z]*|hair[a-z]*|patients?|dentist[a-z]*|hospital[a-z]*)(?![a-zé])/i
test('cart/checkout-form fixtureEn: 한글이 없고 한국어 예시와 잎 경로가 같으며 업종 낱말이 없다 — 영어 화면이 그려지고 승인 안내 글도 영어다', async () => {
  const fx = await fixtureOf('cart', 'checkout-form')
  const ko = leaves(fx.fixture)
  const en = leaves(fx.fixtureEn)
  assert.deepEqual(en.filter((l) => typeof l.value === 'string' && HANGUL.test(l.value)).map((l) => l.path), [])
  assert.deepEqual(en.map((l) => l.path), ko.map((l) => l.path))
  assert.deepEqual(en.filter((l) => typeof l.value === 'string' && BUSINESS_WORDS.test(l.value)).map((l) => l.path), [])
  const enCart = { ...CART, lines: CART.lines.map((l, i) => ({ ...l, name: i ? 'Beans 200g (example)' : 'Mug (example)' })) } // 상품 이름은 포트(서버)가 주는 값이다
  const html = await render(...F, { initial: { cart: enCart }, locale: 'en' }, 'fixtureEn')
  assert.deepEqual(html.match(/.{0,30}[가-힣]+.{0,30}/g) ?? [], [], "영어 화면에 한글이 새지 않는다(금액 표기 포함)")
  assert.match(html, /Pay ₩45,500/)
  assert.match(html, new RegExp(actions.APPROVAL_HINT.en.replace(/'/g, "&#x27;")))
})

// ── 주문 조각·account/order-history·order-detail (계획 3a C2) ──────────────────────────────────
const orderKit = await load(`${B}/_shared/order-kit.tsx`)
const histFx = await load(`${B}/account/order-history.fixture.ts`)
const ORDERS = histFx.SAMPLE_ORDERS
const STATUSES = ['pending_payment', 'paid', 'preparing', 'shipped', 'delivered', 'canceled', 'refunded']

test('order-kit isCancelable: 결제 전·결제 완료·준비 중만 취소할 수 있다(배송 중 이후·이미 취소는 아니다)', () => {
  assert.deepEqual(STATUSES.filter((s) => orderKit.isCancelable(s)), ['pending_payment', 'paid', 'preparing'])
  assert.deepEqual(STATUSES.filter((s) => orderKit.isPaidStatus(s)), ['paid', 'preparing'])
})
test('order-kit statusDate: 취소·환불은 취소한 날, 결제 이후는 결제한 날, 결제 전(또는 값 없음)은 주문한 날', () => {
  const o = { createdAt: 'C', paidAt: 'P', canceledAt: 'X' }
  assert.equal(orderKit.statusDate({ ...o, status: 'canceled' }), 'X')
  assert.equal(orderKit.statusDate({ ...o, status: 'refunded' }), 'X')
  assert.equal(orderKit.statusDate({ ...o, status: 'shipped' }), 'P')
  assert.equal(orderKit.statusDate({ ...o, status: 'pending_payment' }), 'C')
  assert.equal(orderKit.statusDate({ createdAt: 'C', status: 'paid' }), 'C')
  assert.equal(orderKit.statusDate({ createdAt: 'C', status: 'canceled' }), 'C')
})

const H = ['account', 'order-history', 'AccountOrderHistory']
test('account/order-history: 뿌리 data-block · h2 · 주문마다 행(data-order·data-status) · 결제 금액은 합계 먼저 + VAT · 자세히 링크에 주문번호', async () => {
  const html = await render(...H, { initial: { orders: ORDERS } })
  assert.match(html, /data-block="account-order-history"/)
  assert.match(html, /<h2[^>]*id="order-history-title"/)
  assert.doesNotMatch(html, /<h1/)
  assert.equal((html.match(/data-order="/g) ?? []).length, ORDERS.length)
  assert.match(html, /data-status="paid"/)
  assert.match(html, /결제 완료/)
  assert.match(html, /data-total=""/)
  assert.match(html, /VAT 포함/)
  assert.match(html, /href="#order-mock-order-3"/)
  assert.match(html, /aria-label="주문 mock-order-3 자세히 보기"/)
  assert.match(html, /외 1건/, '둘 이상이면 첫 상품 이름 + 외 N건')
  assert.doesNotMatch(html, /data-requires-human/, '읽기 전용 — 승인 행동 없음')
})
test('account/order-history: 주문이 없으면 안내(role=status)와 상품 둘러보기만 — 표 없음 · 읽는 중 aria-busy', async () => {
  const html = await render(...H, { initial: { orders: [] } })
  assert.match(html, /아직 주문이 없어요/)
  assert.doesNotMatch(html, /<table/)
  assert.match(await render(...H, {}), /aria-busy="true"/)
})
test('account/order-history: 상품 요약은 한 가지면 이름만', async () => {
  const mod = await load(`${B}/account/order-history.tsx`)
  assert.equal(mod.itemsSummary({ lines: [{ name: 'A' }] }, '{name} 외 {count}건'), 'A')
  assert.equal(mod.itemsSummary({ lines: [{ name: 'A' }, { name: 'B' }, { name: 'C' }] }, '{name} 외 {count}건'), 'A 외 2건')
  assert.equal(mod.itemsSummary({ lines: [] }, '{name} 외 {count}건'), '')
})

const D = ['account', 'order-detail', 'AccountOrderDetail']
const detail = (status) => render(...D, { initial: { order: histFx.sampleOrder(status) } })
test('account/order-detail: 뿌리 data-block · h2 · 주문번호·상태 배지·상태 줄(role=status)·상품 줄·합계 먼저·받는 분', async () => {
  const html = await detail('paid')
  assert.match(html, /data-block="account-order-detail"/)
  assert.match(html, /<h2[^>]*id="order-detail-title"/)
  assert.doesNotMatch(html, /<h1/)
  assert.match(html, /data-order-id="mock-order-1"/)
  assert.match(html, /data-status="paid"/)
  assert.match(html, /data-order-status="paid"/)
  assert.match(html, /role="status"/)
  assert.equal((html.match(/data-cart-line=/g) ?? []).length, 2)
  assert.ok(html.indexOf('data-total') < html.indexOf('data-cart-shipping'))
  assert.match(html, /김예시/)
  assert.doesNotMatch(html, /data-tracking/, '송장번호는 배송 중 이후에만')
})
test('account/order-detail: 취소할 수 있는 상태(결제 전·결제 완료·준비 중)에는 열기 단추만 — 확인 칸(승인 표지)은 눌러야 열린다', async () => {
  for (const s of ['pending_payment', 'paid', 'preparing']) {
    const html = await detail(s)
    assert.match(html, /data-order-cancel-open=""/, s)
    assert.doesNotMatch(html, /data-requires-human/, `${s}: 열기 단추는 승인 컨트롤이 아니다`)
  }
})
test('account/order-detail: 배송 중·완료는 송장번호와 안내 글만 — 취소 단추 없음 · 이미 취소·환불도 없음', async () => {
  for (const s of ['shipped', 'delivered']) {
    const html = await detail(s)
    assert.match(html, /data-tracking="1234567890"/, s)
    assert.match(html, /data-part="cancel-unavailable"/, s)
    assert.doesNotMatch(html, /data-order-cancel-open/, s)
  }
  for (const s of ['canceled', 'refunded']) {
    const html = await detail(s)
    assert.match(html, new RegExp(`data-order-status="${s}"`))
    assert.doesNotMatch(html, /data-order-cancel-open|data-part="cancel/, s)
  }
})
test('account/order-detail: 상태 한 줄에 상태에 맞는 날짜(<time>)가 든다 — 취소는 취소한 날', async () => {
  assert.match(await detail('canceled'), /<time[^>]*dateTime="2026-10-02T03:00:00.000Z"/)
  assert.match(await detail('paid'), /<time[^>]*dateTime="2026-10-01T03:05:00.000Z"/)
})
test('account/order-detail: 없는 주문(not_found)은 오류가 아니라 빈 상태 — 읽기 오류 상태에서 code 로 가른다(소스)', () => {
  const s = src(`${B}/account/order-detail.tsx`)
  assert.match(s, /err\?\.code === "not_found"/)
  assert.match(s, /ListEmpty/)
})
test('account/order-detail: cancelOrder 호출은 confirmed: true 를 싣고, 승인 표지·안내 글은 확정 단추에 붙으며 안내 글을 하드코딩하지 않고 PortOne 도 모른다', () => {
  const s = src(`${B}/account/order-detail.tsx`)
  assert.match(s, /cancelOrder\(\{ orderId: data\.id, \.\.\.\(reason \? \{ reason \} : \{\}\), confirmed: true \}\)/)
  assert.match(s, /humanApprovalProps\("cancel-order", `\$\{id\}-cancel-hint`\)/)
  assert.match(s, /<ApprovalHint id=\{`\$\{id\}-cancel-hint`\}>\{copy\.humanHint\}<\/ApprovalHint>/)
  assert.doesNotMatch(s.replace(/\/\/.*$/gm, ''), /직접 확인하고|portone/i)
  const code = (rel) => src(rel).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
  for (const rel of ['account/order-detail', 'account/order-history', '_shared/order-kit']) assert.doesNotMatch(code(`${B}/${rel}.tsx`), HANGUL, `${rel} 블록 코드에 한글 literal`)
})
test('account/order-detail: cancel-order 승인 행동 표에 이 블록이 적혀 있다 · 안내 글 예시는 권장값', async () => {
  const table = await load('registry/factory/contract/human-actions.ts')
  assert.deepEqual([...table.AGENT_ACTIONS.find((x) => x.id === 'cancel-order').blocks], ['account/order-detail'])
  const fx = await fixtureOf('account', 'order-detail')
  assert.equal(fx.fixture.copy.humanHint, table.APPROVAL_HINT.ko)
})
test('주문 블록 예시: 최소·최대 예시도 그려지고 포트 기본 장면이 있다', async () => {
  for (const [v, N] of [['order-history', 'AccountOrderHistory'], ['order-detail', 'AccountOrderDetail']]) {
    const fx = await fixtureOf('account', v)
    assert.equal(typeof fx.fixturePorts, 'function', v)
    for (const which of ['fixture', 'fixtureMax', 'fixtureMin']) assert.ok((await render('account', v, N, {}, which)).includes(`data-block="account-${v}"`), `${v} ${which}`)
  }
})

// ── confirmation/order-complete: 로그인한 구매자용(계정 만들기·비회원 조회 선택) ──────────────────
test('confirmation/order-complete: copy.account·submit·copy.guest 를 주지 않으면 계정 만들기 칸과 비회원 조회 안내만 빠지고 나머지는 그대로다 — 예시 그대로는 둘 다 있다', async () => {
  const fx = await fixtureOf('confirmation', 'order-complete')
  const full = await render('confirmation', 'order-complete', 'ConfirmationOrderComplete')
  assert.match(full, /data-account-offer/)
  assert.match(full, /data-guest-lookup/)
  const copy = { ...fx.fixture.copy }
  delete copy.account
  delete copy.guest
  const html = await render('confirmation', 'order-complete', 'ConfirmationOrderComplete', { copy, submit: undefined })
  assert.doesNotMatch(html, /data-account-offer|data-guest-lookup|data-requires-human|<form/)
  for (const keep of ['data-order=""', 'data-next-steps', 'data-help', 'data-next-action', 'data-vat']) assert.match(html, new RegExp(keep))
  // submit 만 없어도(또는 account 만 없어도) 계정 칸은 그리지 않는다 — 제출할 곳이 없는 폼을 그리지 않는다
  assert.doesNotMatch(await render('confirmation', 'order-complete', 'ConfirmationOrderComplete', { submit: undefined }), /data-account-offer/)
})
