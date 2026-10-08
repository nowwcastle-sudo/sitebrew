// P1C 시험(감사 B3 — E07 통화 문구 · E09 결제 직후 영수증 · H05 로그인 뒤 첫 화면). 빌드·서버 없이 돈다(실제 화면은 docs/qa/ux-audit/apply-p1c.md 의 걷기가 본다).
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { registerHooks } from "node:module"
import test from "node:test"
import { fileURLToPath } from "node:url"

registerHooks({ resolve: (spec, ctx, next) => next(spec === "next/server" ? "next/server.js" : spec, ctx) })

const T = fileURLToPath(new URL("..", import.meta.url))
const read = (p) => readFileSync(join(T, p), "utf8")

// ── E07: 통화는 USD 하나, 카드사가 현지 통화로 바꿀 수 있다는 평문(운영자 결정 2026-10-07) ─────────────────────────────

const ISSUER = /card issuer may convert/i

test("E07 요금표 꼬리말·업그레이드 대화상자 안내·결제 동의 줄이 USD 청구와 카드사 환전 가능성을 같은 말로 알린다", async () => {
  const { pricingCopy, upgradeCopy } = await import("../content/copy.en.ts")
  const lines = {
    "요금표 꼬리말": pricingCopy.footnote,
    "업그레이드 안내": upgradeCopy.dialog.description,
    "체험 뒤 첫 결제 줄": upgradeCopy.offer.firstCharge,
    "오늘 결제 줄": upgradeCopy.offer.chargeNow,
  }
  for (const [name, text] of Object.entries(lines)) {
    assert.match(text, /USD/, `${name}: USD 가 없다`)
    assert.match(text, ISSUER, `${name}: 카드사 환전 문구가 없다`)
  }
  // 자리표시자는 그대로다(블록이 금액·날짜를 채운다) — 문구를 더하다 지우지 않았는지
  assert.match(upgradeCopy.offer.firstCharge, /\{amount\}.*\{vat\}.*\{date\}/)
  assert.match(upgradeCopy.offer.chargeNow, /\{amount\}.*\{vat\}/)
})

test("E03 월 요금제만 — 요금표 문구에 연 요금제 토글·문구가 없다(운영자 결정 2026-10-07)", async () => {
  const { pricingCopy } = await import("../content/copy.en.ts")
  assert.doesNotMatch(JSON.stringify(pricingCopy), /annual|yearly|per year|\/yr/i)
})

// ── E09: 결제 직후 화면 — 영수증이 가는 주소 + 청구서·영수증 보기 ───────────────────────────────────────────────

const TXN = "txn_01abcdefghijklmnopqrstuvwx"
const mkDeps = (txn, over = {}) => {
  const calls = []
  return {
    calls,
    deps: {
      getTransaction: async (id) => (calls.push(["get", id]), txn),
      resync: async () => void calls.push(["resync"]),
      subscription: async () => (calls.push(["sub"]), { ok: true, data: { planId: "pro", status: "active" } }),
      customerEmail: async (id) => (calls.push(["email", id]), "payer@example.com"),
      ...over,
    },
  }
}

test("E09 결제 직후: 거래의 고객 주소를 읽어 구독과 함께 돌려준다(영수증이 실제로 가는 주소)", async () => {
  const { syncAfterCheckout } = await import("../lib/billing-return-core.ts")
  const { calls, deps } = mkDeps({ customData: { lf_user_id: "u1" }, subscriptionId: "sub_1", customerId: "ctm_1" })
  const r = await syncAfterCheckout("u1", TXN, deps)
  assert.deepEqual(r, { ok: true, data: { planId: "pro", status: "active", receiptEmail: "payer@example.com" } })
  assert.deepEqual(calls.map((c) => c[0]), ["get", "resync", "sub", "email"])
  assert.deepEqual(calls.at(-1), ["email", "ctm_1"])
})

test("E09 주소를 못 읽어도(공급자 오류·고객 없음) 결제 확인은 성공이고 주소 칸만 빈다", async () => {
  const { syncAfterCheckout } = await import("../lib/billing-return-core.ts")
  for (const [txn, over] of [
    [{ customData: { lf_user_id: "u1" }, subscriptionId: "sub_1", customerId: "ctm_1" }, { customerEmail: async () => { throw new Error("paddle 503") } }],
    [{ customData: { lf_user_id: "u1" }, subscriptionId: "sub_1", customerId: null }, {}],
    [{ customData: { lf_user_id: "u1" }, subscriptionId: "sub_1", customerId: "ctm_1" }, { customerEmail: async () => "" }],
  ]) {
    const { deps } = mkDeps(txn, over)
    const r = await syncAfterCheckout("u1", TXN, deps)
    assert.deepEqual(r, { ok: true, data: { planId: "pro", status: "active" } })
  }
})

test("E09 남의 거래·구독 아직 없음에서는 주소를 읽지 않는다(남의 주소가 새지 않는다)", async () => {
  const { syncAfterCheckout } = await import("../lib/billing-return-core.ts")
  const other = mkDeps({ customData: { lf_user_id: "someone-else" }, subscriptionId: "sub_1", customerId: "ctm_9" })
  assert.equal((await syncAfterCheckout("u1", TXN, other.deps)).ok, false)
  assert.ok(!other.calls.some((c) => c[0] === "email"), "남의 거래인데 주소를 물었다")
  // 구독이 아직 안 만들어졌을 때(status none)는 영수증 이야기를 하기 이르다 — 주소를 싣지 않는다
  const pending = mkDeps({ customData: { lf_user_id: "u1" }, subscriptionId: null, customerId: "ctm_1" }, { subscription: async () => ({ ok: true, data: { planId: null, status: "none" } }) })
  assert.deepEqual(await syncAfterCheckout("u1", TXN, pending.deps), { ok: true, data: { planId: null, status: "none" } })
  assert.ok(!pending.calls.some((c) => c[0] === "email"))
})

test("E09 연결: live 가 Paddle 고객 조회를 넘기고, 결제 직후 화면이 영수증 줄과 「청구서·영수증 보기」를 낸다", async () => {
  const live = read("lib/billing-return.ts")
  assert.match(live, /customerEmail: .*paddle\.customers\.get/)
  const clientSrc = read("components/product/billing-return.tsx")
  assert.match(clientSrc, /BillingInvoices/, "청구서·영수증 버튼은 결제 관리가 쓰는 같은 조각이다")
  assert.match(clientSrc, /portal/)
  const page = read("app/(product)/billing/return/page.tsx")
  assert.match(page, /portal=\{portal\}/)
  const { billingReturnCopy: c, billingCopy } = await import("../content/copy.en.ts")
  // 주소를 아는 말과 모르는 말이 따로 있다 — 모르면서 주소를 꾸며 말하지 않는다
  assert.match(c.receipt.toEmail, /\{email\}/)
  assert.doesNotMatch(c.receipt.unknown, /\{email\}/)
  assert.ok(billingCopy.invoices.label, "재사용하는 버튼 문구가 있다")
})

// ── H05: 로그인 뒤 첫 화면 — 구독 상태 한 줄 + 다음 행동, 유료 사용자에게 「Upgrade」 없음 ──────────────────────────

const day = (s) => `D(${s.slice(0, 10)})`

test("H05 구독 상태마다 한 줄과 다음 행동이 정해진다 — 「Upgrade 행동」은 유료 요금제가 아닐 때만", async () => {
  const { homeStatus } = await import("../lib/home-status.ts")
  const at = (sub, name = "Pro") => homeStatus(sub, name, day)
  // 무료·없음·끝남
  for (const sub of [{ planId: null, status: "none" }, { planId: "pro", status: "expired" }]) {
    const h = at(sub)
    assert.match(h.text, /free plan/i, sub.status)
    assert.deepEqual(h.action, { label: "Upgrade to a paid plan", href: "/upgrade" }, sub.status)
  }
  // 유료
  const active = at({ planId: "pro", status: "active", currentPeriodEnd: "2026-11-01T00:00:00Z" })
  assert.match(active.text, /Pro plan.*D\(2026-11-01\)/)
  assert.notEqual(active.action.href, "/upgrade")
  assert.equal(active.action.href, "/account/billing")
  const trial = at({ planId: "pro", status: "trialing", trialEnd: "2026-10-20T00:00:00Z" })
  assert.match(trial.text, /trial.*D\(2026-10-20\)/i)
  assert.notEqual(trial.action.href, "/upgrade")
  // 결제 실패: 다음 행동이 카드 갱신이다
  const due = at({ planId: "pro", status: "past_due" })
  assert.match(due.text, /payment didn't go through/i)
  assert.equal(due.action.href, "/account/billing")
  assert.match(due.action.label, /payment method/i)
  assert.notEqual(due.action.href, "/upgrade")
  // 해지 예약: 기간 끝까지 쓴다 — 되살리는 길이 다음 행동이다
  const canceled = at({ planId: "pro", status: "canceled", cancelAt: "2026-11-05T00:00:00Z" })
  assert.match(canceled.text, /ends.*D\(2026-11-05\)/i)
  assert.notEqual(canceled.action.href, "/upgrade")
  assert.equal(canceled.action.href, "/account/billing")
  const paused = at({ planId: "pro", status: "paused", pausedUntil: "2026-12-01T00:00:00Z" })
  assert.match(paused.text, /paused.*D\(2026-12-01\)/i)
  assert.notEqual(paused.action.href, "/upgrade")
})

test("H05 날짜·요금제 이름이 없어도 말이 깨지지 않고, 구독을 못 읽었으면 상태를 지어내지 않는다", async () => {
  const { homeStatus } = await import("../lib/home-status.ts")
  for (const sub of [{ planId: "pro", status: "active" }, { planId: "pro", status: "trialing" }, { planId: "pro", status: "canceled" }, { planId: "pro", status: "paused" }]) {
    const h = homeStatus(sub, undefined, day)
    assert.doesNotMatch(h.text, /undefined|null|NaN|\{|\}|D\(/, JSON.stringify(sub))
    assert.ok(h.text.length > 10)
  }
  const unknown = homeStatus(null, undefined, day)
  assert.equal(unknown.text, null, "못 읽었으면 상태 줄이 없다")
  assert.equal(unknown.action, null)
})

test("H05 시작 쪽: 로그인하면 환영·상태 줄·다음 행동, Upgrade 링크는 상태가 정한다(고정 목록에 없다)", () => {
  const page = read("app/(product)/page.tsx")
  assert.match(page, /homeStatus\(/)
  assert.match(page, /subscription\(\)/)
  const signedIn = /const SIGNED_IN[\s\S]*?\n\]/.exec(page)?.[0] ?? ""
  assert.ok(signedIn, "SIGNED_IN 목록이 있다")
  assert.doesNotMatch(signedIn, /Upgrade|\/upgrade/, "유료 사용자에게도 보이는 고정 Upgrade 링크가 남아 있다")
  assert.match(signedIn, /\/account"/, "계정 홈 링크가 있다")
})
