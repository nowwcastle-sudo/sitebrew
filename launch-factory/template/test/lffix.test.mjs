// LFFIX(관통 1회차 결함 F1~F11) 정적·단위 시험 — 빌드·서버 없이 돈다. 브라우저 걷기는 docs/qa/lffix.md.
import assert from "node:assert/strict"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { registerHooks } from "node:module"
import test from "node:test"
import { fileURLToPath } from "node:url"

registerHooks({ resolve: (spec, ctx, next) => next(spec === "next/server" ? "next/server.js" : spec, ctx) })

const T = fileURLToPath(new URL("..", import.meta.url))
const ROOT = join(T, "..")
const read = (p) => readFileSync(join(T, p), "utf8")

/** 환경 값을 되돌린다(없었으면 지운다) */
function restore(name, value) {
  if (value === undefined) delete process.env[name]
  else process.env[name] = value
}

/** 환경 값을 잠깐 바꿔 proxy 를 부르고 CSP 의 지시어를 {이름: 출처 목록} 으로 돌려준다 */
async function cspWith(env) {
  // LFCI: POSTHOG_*·SENTRY_DSN 도 비운다 — 이 PC 의 환경 변수에 있으면 시험이 우연히 통과하고, CI 처럼 깨끗한 곳에서는 PostHog 출처가 안 열려 실패했다
  const keys = ["LF_MODE", "TURNSTILE_SITE_KEY", "PADDLE_CLIENT_TOKEN", "POSTHOG_HOST", "POSTHOG_PROJECT_KEY", "SENTRY_DSN"]
  const before = Object.fromEntries(keys.map((k) => [k, process.env[k]]))
  for (const k of keys) delete process.env[k]
  Object.assign(process.env, env)
  try {
    const { proxy } = await import("../proxy.ts")
    const { NextRequest } = await import("next/server")
    const csp = proxy(new NextRequest("http://localhost:3000/sign-up")).headers.get("content-security-policy") ?? ""
    return Object.fromEntries(csp.split(";").map((d) => d.trim().split(/\s+/)).filter((p) => p[0]).map(([name, ...src]) => [name, src]))
  } finally {
    for (const k of keys) restore(k, before[k])
  }
}

test("F1 CSP: 사이트 키가 있는 live 만 Turnstile 출처(script·frame)를 연다 — 없으면 frame-src 는 'none' 그대로", async () => {
  const on = await cspWith({ LF_MODE: "live", TURNSTILE_SITE_KEY: "1x00000000000000000000AA" })
  assert.ok(on["script-src"].includes("https://challenges.cloudflare.com"))
  assert.deepEqual(on["frame-src"], ["https://challenges.cloudflare.com"])
  for (const env of [{ LF_MODE: "mock", TURNSTILE_SITE_KEY: "1x00000000000000000000AA" }, { LF_MODE: "live" }]) {
    const off = await cspWith(env)
    assert.deepEqual(off["frame-src"], ["'none'"], JSON.stringify(env))
    assert.ok(!off["script-src"].includes("https://challenges.cloudflare.com"))
  }
})

test("F2 CSP: Paddle 출처는 토큰 종류에 맞는 것만(샌드박스 test_ ↔ 실결제 live_), 토큰이 없으면 아무것도 안 연다", async () => {
  const sandbox = await cspWith({ LF_MODE: "live", PADDLE_CLIENT_TOKEN: "test_abc" })
  assert.deepEqual(sandbox["frame-src"], ["https://sandbox-buy.paddle.com"])
  assert.ok(sandbox["script-src"].includes("https://cdn.paddle.com"))
  assert.ok(!JSON.stringify(sandbox).includes("//buy.paddle.com"), "샌드박스에 실결제 출처를 열지 않는다")
  const live = await cspWith({ LF_MODE: "live", PADDLE_CLIENT_TOKEN: "live_abc" })
  assert.deepEqual(live["frame-src"], ["https://buy.paddle.com"])
  assert.ok(!JSON.stringify(live).includes("sandbox-"), "실결제에 샌드박스 출처를 열지 않는다")
  const none = await cspWith({ LF_MODE: "live" })
  assert.deepEqual(none["frame-src"], ["'none'"])
  assert.ok(!none["script-src"].includes("https://cdn.paddle.com"))
  // 둘 다 켜도 서로 섞이고 PostHog 는 그대로 남는다
  const both = await cspWith({ LF_MODE: "live", PADDLE_CLIENT_TOKEN: "test_abc", TURNSTILE_SITE_KEY: "k", POSTHOG_HOST: "https://eu.i.posthog.com", POSTHOG_PROJECT_KEY: "phc_fake_test_key" })
  assert.deepEqual([...both["frame-src"]].sort(), ["https://challenges.cloudflare.com", "https://sandbox-buy.paddle.com"])
  assert.ok(both["connect-src"].some((s) => s.includes("posthog.com")))
  assert.ok(!JSON.stringify(both).includes("unsafe-inline"), "unsafe-inline 은 두지 않는다")
})

test("F2 CSP: 오버레이의 스타일시트·인라인 style 해시를 연다(브라우저 위반 보고로 잰 값), 연결(connect-src)은 열지 않는다, 근거 표와 같다", { skip: "asserts text of an internal QA document that is not part of the public export" }, async () => {
  const { PADDLE_STYLE_ATTR_HASHES } = await import("../lib/product-csp.ts")
  const sandbox = await cspWith({ LF_MODE: "live", PADDLE_CLIENT_TOKEN: "test_abc" })
  assert.ok(sandbox["style-src"].includes("https://sandbox-cdn.paddle.com"))
  assert.ok(!sandbox["style-src"].includes("https://cdn.paddle.com"), "샌드박스에 실결제 스타일 출처를 열지 않는다")
  for (const h of PADDLE_STYLE_ATTR_HASHES) assert.ok(sandbox["style-src"].includes(`'${h}'`), h)
  assert.ok(sandbox["style-src"].includes("'unsafe-hashes'"))
  assert.ok(sandbox["style-src"].some((s) => s.startsWith("'nonce-")), "nonce 는 그대로 있다")
  assert.deepEqual(sandbox["connect-src"].filter((s) => /paddle/.test(s)), [])
  const live = await cspWith({ LF_MODE: "live", PADDLE_CLIENT_TOKEN: "live_abc" })
  assert.ok(live["style-src"].includes("https://cdn.paddle.com") && !live["style-src"].includes("https://sandbox-cdn.paddle.com"))
  const none = await cspWith({ LF_MODE: "live" })
  assert.ok(!none["style-src"].some((s) => /paddle|DZJGI/.test(s)))
  const doc = readFileSync(join(ROOT, "docs", "qa", "lffix.md"), "utf8")
  for (const h of PADDLE_STYLE_ATTR_HASHES) assert.ok(doc.includes(h), `${h} 의 근거가 docs/qa/lffix.md 에 없다`)
  for (const o of ["https://cdn.paddle.com", "https://sandbox-buy.paddle.com", "https://buy.paddle.com", "https://sandbox-cdn.paddle.com", "https://challenges.cloudflare.com"]) assert.ok(doc.includes(o), `${o} 가 근거 표에 없다`)
})

test("F1 mock 에서는 위젯 키도 결제 토큰도 없다(예전 경로 그대로)", async () => {
  const { turnstileSiteKey, checkoutClientToken } = await import("../lib/site-keys.ts")
  const saved = { m: process.env.LF_MODE, t: process.env.TURNSTILE_SITE_KEY, p: process.env.PADDLE_CLIENT_TOKEN }
  try {
    Object.assign(process.env, { LF_MODE: "mock", TURNSTILE_SITE_KEY: "k", PADDLE_CLIENT_TOKEN: "test_x" })
    assert.equal(turnstileSiteKey(), undefined)
    assert.equal(checkoutClientToken(), undefined)
    process.env.LF_MODE = "live"
    assert.equal(turnstileSiteKey(), "k")
    assert.equal(checkoutClientToken(), "test_x")
    process.env.TURNSTILE_SITE_KEY = ""
    assert.equal(turnstileSiteKey(), undefined, "빈 문자열은 없는 것")
  } finally {
    for (const [k, v] of [["LF_MODE", saved.m], ["TURNSTILE_SITE_KEY", saved.t], ["PADDLE_CLIENT_TOKEN", saved.p]]) restore(k, v)
  }
})

test("F1 live 환경 검사: 사이트 키가 없으면 빠진 이름으로 알린다", async () => {
  const { TEMPLATE_LIVE_NAMES } = await import("../lib/live-env.ts")
  assert.ok(TEMPLATE_LIVE_NAMES.includes("TURNSTILE_SITE_KEY"))
})

test("F1 signUp 감싸기: 토큰 칸을 싣고, 제출마다 위젯을 새로 풀며, 토큰을 두 번 쓰지 않는다", async () => {
  const { signWithToken } = await import("../components/product/turnstile.ts")
  const calls = []
  let token = "tok-1"
  let resets = 0
  const io = {
    signUp: async (input) => (calls.push(input), { ok: true, data: {} }),
    enabled: true,
    peekToken: () => token,
    takeToken: () => {
      const t = token
      token = ""
      return t
    },
    reset: () => resets++,
    waitMs: 60,
    stepMs: 10,
  }
  await signWithToken({ method: "password", email: "a@b.co" }, io)
  assert.equal(calls[0]["cf-turnstile-response"], "tok-1")
  assert.equal(calls[0].email, "a@b.co")
  assert.equal(resets, 1)
  // 두 번째 제출: 새 토큰이 올 때까지 기다린다(토큰은 1회용이라 비어 있다)
  setTimeout(() => (token = "tok-2"), 25)
  await signWithToken({ method: "password" }, io)
  assert.equal(calls[1]["cf-turnstile-response"], "tok-2")
  assert.equal(resets, 2)
  // A07: 끝까지 토큰이 없으면 서버를 부르지 않는다 — 보이는 확인이 없으니 「확인을 마치라」가 아니라 기다렸다 다시 시도하라는 글로 실패를 돌려준다(위젯은 새로 푼다)
  const waits = []
  const notReady = await signWithToken({ method: "password" }, { ...io, onWaiting: (w) => waits.push(w), notReady: "Wait a moment, then try again." })
  assert.deepEqual(notReady, { ok: false, formError: "Wait a moment, then try again.", retryable: true })
  assert.equal(calls.length, 2, "서버(signUp)를 부르지 않았다")
  assert.deepEqual(waits, [true, false], "기다리는 동안 상태가 보였다가 끝났다")
  assert.equal(resets, 3, "실패해도 위젯을 새로 푼다")
  // 위젯이 없으면(mock) 입력 그대로, 토큰 칸 없음
  await signWithToken({ method: "password" }, { ...io, enabled: false })
  assert.equal("cf-turnstile-response" in calls[2], false)
  // signUp 이 던져도 위젯은 다시 푼다
  const before = resets
  token = "tok-3"
  await assert.rejects(signWithToken({ method: "password" }, { ...io, signUp: async () => { throw new Error("x") } }))
  assert.equal(resets, before + 1)
})

test("F1 가입 블록: 조립하는 쪽이 토큰·언어·시간대를 더한다(블록은 안 건드린다)", () => {
  const blocks = read("components/product/product-blocks.tsx")
  assert.match(blocks, /useTurnstile\(turnstileSiteKey, withPrefs, botCheckCopy\)/)
  // A07: 확인 중·기다리는 중 글이 보이는 자리(TurnstileStatus)와, 보이는 확인이 없는데 「Complete the check」라고 쓰지 않는 문구
  assert.match(blocks, /<TurnstileStatus box=\{bot\.box\} status=\{bot\.status\} copy=\{botCheckCopy\} \/>/)
  assert.match(read("components/product/turnstile-status.tsx"), /role="status"/)
  assert.match(read("content/copy.en.ts"), /checking: "Checking that you're human…"/)
  assert.ok(!/complete the check/i.test(read("content/copy.en.ts") + readFileSync(join(T, "../packages/i18n/messages/en.json"), "utf8")), "보이는 확인이 없는데 확인을 마치라고 쓰지 않는다")
  // UXOK: 블록에는 봇 확인을 거친 signUp 을 감싼 remember 가 간다(감싸도 토큰을 싣는 bot.signUp 을 거친다)
  assert.match(blocks, /await bot\.signUp\(input\)/)
  // LFAX: 결과의 code·retryable 을 구획 속성으로 다는 watch 로 한 번 더 감싼다(ActionScope)
  assert.match(blocks, /signUp=\{watch\(remember\)\}/)
  assert.match(blocks, /locale: COPY_LOCALE, timeZone: Intl\.DateTimeFormat\(\)\.resolvedOptions\(\)\.timeZone/)
  assert.match(read("app/(product)/sign-up/page.tsx"), /turnstileSiteKey=\{turnstileSiteKey\(\)\}/)
  assert.match(read("content/copy.en.ts"), /export const COPY_LOCALE = "en"/)
})

test("F2 결제 오버레이: 결제 주소의 _ptxn 을 읽고, 업그레이드 블록이 onRedirect 로 이어 준다", async () => {
  const { transactionIdOf } = await import("../components/product/checkout-overlay.ts")
  assert.equal(transactionIdOf("https://localhost/?_ptxn=txn_01abc"), "txn_01abc")
  assert.equal(transactionIdOf("https://localhost/pay"), null)
  assert.equal(transactionIdOf("not a url"), null)
  const blocks = read("components/product/product-blocks.tsx")
  assert.match(blocks, /onRedirect=\{onRedirect\}/)
  const overlay = read("components/product/checkout-overlay.ts")
  assert.match(overlay, /https:\/\/cdn\.paddle\.com\/paddle\/v2\/paddle\.js/)
  assert.match(overlay, /checkout\.completed/)
  assert.match(overlay, /checkout: \{ settings: \{ locale \} \}/, "결제 창 언어를 화면 언어로 고정한다")
  assert.match(blocks, /useCheckoutOverlay\(checkoutToken, COPY_LOCALE\)/)
  assert.match(overlay, /\/billing\/return/)
})

test("F3 /billing/return: 쪽이 있고, 서버는 로그인한 본인의 거래만 맞추며, 구독이 아직 없으면 「아직」으로 답한다", async () => {
  assert.ok(existsSync(join(T, "app", "(product)", "billing", "return", "page.tsx")))
  assert.match(read("app/(product)/billing/return/page.tsx"), /_ptxn/)
  assert.match(read("lib/ports.live.ts"), /syncCheckout: async/)
  const { syncAfterCheckout } = await import("../lib/billing-return-core.ts")
  const TXN = "txn_01abcdefghijklmnopqrstuvwx"
  const calls = []
  const deps = (txn, over = {}) => ({
    getTransaction: async (id) => (calls.push(["get", id]), txn),
    resync: async (id) => void calls.push(["resync", id]),
    subscription: async () => (calls.push(["sub"]), { ok: true, data: { planId: "pro", status: "active" } }),
    ...over,
  })
  // 본인의 거래 + 구독이 만들어졌다 → 공급자 상태를 다시 읽어 저장하고 구독을 돌려준다
  const own = await syncAfterCheckout("u1", TXN, deps({ customData: { lf_user_id: "u1" }, subscriptionId: "sub_1" }))
  assert.deepEqual(own, { ok: true, data: { planId: "pro", status: "active" } })
  assert.deepEqual(calls.map((c) => c[0]), ["get", "resync", "sub"])
  // 아직 구독이 안 붙었다 → resync 없이 지금 상태를 돌려준다(화면이 다시 묻는다)
  calls.length = 0
  await syncAfterCheckout("u1", TXN, deps({ customData: { lf_user_id: "u1" }, subscriptionId: null }))
  assert.deepEqual(calls.map((c) => c[0]), ["get", "sub"])
  // 남의 거래·custom_data 없는 거래 → 거절하고 아무것도 맞추지 않는다
  for (const txn of [{ customData: { lf_user_id: "someone-else" }, subscriptionId: "sub_1" }, { customData: null, subscriptionId: "sub_1" }, {}]) {
    calls.length = 0
    const r = await syncAfterCheckout("u1", TXN, deps(txn))
    assert.equal(r.ok, false)
    assert.deepEqual(calls.map((c) => c[0]), ["get"], "resync·구독 읽기까지 가지 않는다")
  }
  // 모양이 틀린 거래 id 는 공급자에 묻지도 않는다
  calls.length = 0
  for (const bad of ["", "txn_x", "../etc", 5, null, `${TXN}'; drop table`]) assert.equal((await syncAfterCheckout("u1", bad, deps({}))).ok, false)
  assert.deepEqual(calls, [])
  // 없는 거래(not_found)는 다시 묻지 않고, 그 밖의 오류는 다시 시도할 수 있다
  const gone = await syncAfterCheckout("u1", TXN, deps({}, { getTransaction: async () => { throw Object.assign(new Error("x"), { code: "not_found" }) } }))
  assert.deepEqual([gone.ok, gone.retryable], [false, false])
  const flaky = await syncAfterCheckout("u1", TXN, deps({}, { getTransaction: async () => { throw new Error("network") } }))
  assert.deepEqual([flaky.ok, flaky.retryable], [false, true])
})

test("F4 /forgot-password: 쪽이 있고 로그인 화면의 링크가 그곳을 가리킨다", () => {
  assert.ok(existsSync(join(T, "app", "(product)", "forgot-password", "page.tsx")))
  const copy = read("content/copy.en.ts")
  assert.match(copy, /forgot: \{ label: "Forgot your password\?", href: "\/forgot-password" \}/)
  assert.match(copy, /passwordResetCopy[\s\S]*back: \{ label: "Back to sign in", href: "\/sign-in" \}/)
  assert.match(read("lib/ports.live.ts"), /requestPasswordReset: async/)
  // 마무리 쪽: 메일 링크가 닿는 /reset-password 가 있고(없으면 메일 링크가 막다른 길), 어댑터가 그 경로를 메일 링크에 싣는다
  assert.ok(existsSync(join(T, "app", "(product)", "reset-password", "page.tsx")))
  assert.match(read("app/(product)/reset-password/page.tsx"), /token/)
  assert.match(read("lib/launch/auth.ts"), /resetPasswordPath: "\/reset-password"/)
  assert.match(read("lib/ports.live.ts"), /resetPassword: \(input\) => actions\.resetPassword\(input\)/)
  // LFADB: 재설정 마무리 폼은 web-factory `auth/new-password` 블록(한 칸 판)이다 — 틀림·만료·이미 쓴 토큰은 블록이 code invalid_token 으로 알아본다
  assert.match(read("components/blocks/auth/new-password.tsx"), /invalid_token/)
  assert.match(read("components/product/product-blocks.tsx"), /confirmField=\{false\}/)
})

test("F5 해지: 결제 관리의 해지 링크가 해지 화면으로 가고, 해지 단계 수 ≤ 가입 단계 수이며, 대안 목록은 화면과 서버가 같다", () => {
  assert.match(read("content/copy.en.ts"), /cancel: \{ label: "Cancel subscription", href: "\/account\/cancel"/)
  assert.ok(existsSync(join(T, "app", "(product)", "account", "cancel", "page.tsx")))
  const cancelSteps = Number(/export const CANCEL_STEPS = (\d+)/.exec(read("components/blocks/retention/cancel-flow.tsx"))?.[1])
  const signUpSteps = Number(/export const SIGN_UP_STEPS = (\d+)/.exec(read("components/blocks/auth/sign-up-consents.tsx"))?.[1])
  assert.ok(cancelSteps > 0 && signUpSteps > 0 && cancelSteps <= signUpSteps, `해지 ${cancelSteps}단계 ≤ 가입 ${signUpSteps}단계`)
  // 서버(어댑터)와 화면이 같은 목록: billing.ts 가 RETENTION_OFFERS 를 어댑터에 주고, lib/offers.ts 가 같은 목록을 화면에 준다
  assert.match(read("lib/launch/billing.ts"), /retentionOffers: RETENTION_OFFERS/)
  assert.match(read("lib/offers.ts"), /import\("@\/lib\/launch\/paddle-plans"\)\)\.RETENTION_OFFERS/)
  assert.match(read("lib/ports.live.ts"), /applyRetentionOffer: async/)
})

test("F5 해지 대안은 정책 한도 안이다(할인 30% 이하·2~3개월)", async () => {
  const { retentionOfferIssues } = await import("../lib/retention-offer.ts")
  const plans = read("lib/launch/paddle-plans.ts")
  const offers = [...plans.matchAll(/\{ id: "([^"]+)", kind: "(\w+)"(?:, pauseMonths: (\d+))?(?:, discount: \{ percent: (\d+), months: (\d+) \})? \}/g)]
  assert.ok(offers.length >= 1)
  for (const [, id, kind, pause, percent, months] of offers) {
    const offer = { id, kind, ...(pause ? { pauseMonths: Number(pause) } : {}), ...(percent ? { discount: { percent: Number(percent), months: Number(months) } } : {}) }
    assert.deepEqual(retentionOfferIssues(offer), [], id)
  }
})

test("F6 가입은 화면 언어를 사용자 언어로 함께 보낸다(영어 제품에 한국어 확인 메일이 가지 않게)", () => {
  assert.match(read("components/product/product-blocks.tsx"), /locale: COPY_LOCALE/)
  // 사용자 언어가 서버 훅까지 받아들여지는 입구는 authActions 의 signUp 스키마(locale·timeZone) — 같은 칸 이름인지 본다
  const schema = readFileSync(join(ROOT, "packages", "auth", "src", "server-actions.ts"), "utf8")
  assert.match(schema, /locale: z\.string\(\)\.max\(64\)\.optional\(\)/)
  assert.match(schema, /timeZone: z\.string\(\)\.max\(64\)\.optional\(\)/)
})

test("F7 /pricing: 카드가 결제와 같은 요금제 목록에서 만들어진다(이름·금액·세금·기능), 월 요금제가 없으면 기본 카드", async () => {
  const { pricingFromPlans } = await import("../content/pricing-from-plans.ts")
  const base = { title: "Pricing", plans: [{ name: "Static", monthlyPrice: 29, currency: "USD", features: ["x"] }], recommended: "Static", recommendedLabel: "R", perMonth: "/mo", contactLabel: "C", cta: { label: "go", href: "/sign-up" } }
  const live = [
    { id: "pro", name: "Pro", price: { amount: 900, currency: "USD", vatIncluded: false }, interval: "month", features: ["20 projects"], recommended: true },
    { id: "pro-y", name: "Pro yearly", price: { amount: 9000, currency: "USD", vatIncluded: false }, interval: "year", features: [] },
    { id: "kr", name: "Seoul", price: { amount: 12900, currency: "KRW", vatIncluded: true }, interval: "month", features: [] },
  ]
  const r = pricingFromPlans(base, live)
  assert.deepEqual(r.plans, [
    { name: "Pro", monthlyPrice: 9, currency: "USD", vatIncluded: false, features: ["20 projects"] },
    { name: "Seoul", monthlyPrice: 12900, currency: "KRW", vatIncluded: true, features: [] },
  ])
  assert.equal(r.recommended, "Pro")
  assert.deepEqual(r.planCtas.map((c) => c.label), ["Get Pro", "Get Seoul"])
  assert.equal(r.footnote, base.footnote)
  assert.equal(pricingFromPlans(base, null), base)
  assert.equal(pricingFromPlans(base, []), base)
  assert.equal(pricingFromPlans(base, [live[1]]), base, "월 요금제가 없으면 기본 카드")
  // LFADB E01: 세션·구독과 함께 읽는다(Promise.all) — 요금제 목록을 서버가 읽는 것은 그대로다
  assert.match(read("app/(product)/pricing/page.tsx"), /await Promise\.all\(\[plans\(\)\.catch/)
})

test("F8 헤더: 로그인 상태를 알고(서버가 처음 그리고 쪽 이동마다 다시 읽는다) 로그아웃이 있다 — LFADA 이후 web-factory nav/account-bar", async () => {
  const layout = read("components/product/product-shell.tsx")
  assert.match(layout, /await currentSession\(\)/)
  assert.match(layout, /<ProductHeader \/>/)
  const header = read("components/product/product-header.tsx")
  assert.match(header, /await currentSession\(\)/)
  assert.match(header, /<NavAccountBar [^>]*session=\{session\}[^>]*signOutAction=\{signOutFromHeader\}/)
  const sync = read("components/product/session-sync.tsx")
  assert.match(sync, /usePathname/)
  assert.match(sync, /\[pathname, router\]/, "쪽을 옮길 때 다시 읽는다")
  const { navCopy } = await import("../content/copy.shell.en.ts")
  assert.equal(navCopy.signedIn.signOutLabel, "Sign out")
  assert.deepEqual(navCopy.signedIn.links.map((l) => l.label), ["Account", "Billing"])
  assert.ok(existsSync(join(T, "app", "actions", "product.ts")) && /export const signOut/.test(read("app/actions/product.ts")))
})

test("F9 하이드레이션(#418): 동의 띠는 서버·첫 클라이언트 렌더에서 비우고, 붙은 뒤에 읽은 결정으로 처음 그린다", () => {
  const blocks = read("components/product/product-blocks.tsx")
  const banner = blocks.slice(blocks.indexOf("export function ConsentBanner"))
  // useSyncExternalStore 의 서버 스냅샷·첫 클라이언트 스냅샷이 false 라 두 렌더가 같고, 구독 뒤 true 로 바뀐다
  assert.match(banner, /useSyncExternalStore\(\s*\(\) => \(\) => undefined,\s*\(\) => true,\s*\(\) => false,?\s*\)/)
  assert.match(banner, /if \(!hydrated\) return null/)
  // 원인이 된 읽기(localStorage 결정)는 그대로 클라이언트 전용이다 — 서버는 모른다
  assert.match(read("components/product/analytics.tsx"), /typeof window === "undefined" \? undefined : readConsent\(\)/)
})

test("F11 마이그레이션: 공개 표를 만드는 모든 CREATE TABLE 에 짝이 되는 명시적 ENABLE ROW LEVEL SECURITY 가 있다, 정책은 만들지 않는다", () => {
  const dir = join(T, "db", "migrations")
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()
  assert.ok(files.includes("0010_explicit_rls.sql"))
  const all = files.map((f) => readFileSync(join(dir, f), "utf8")).join("\n")
  const created = new Set([...all.matchAll(/CREATE TABLE "([a-z_]+)"/g)].map((m) => m[1]))
  // 0010 이 그때까지의 표를 켜고, 그 뒤 새 표(0011~·0012 발신함·0013 상점 표 넷·0014 예약·푸시·알림 표 셋·0015 후기·검색·파일·뉴스레터 표 넷·0016 예약금 열·0017 문의 답변 표)는 자기 마이그레이션이 같은 규칙으로 켠다
  const rls = new Set([...all.matchAll(/ALTER TABLE "([a-z_]+)" ENABLE ROW LEVEL SECURITY/g)].map((m) => m[1]))
  assert.equal(created.size, 35)
  assert.deepEqual([...rls].sort(), [...created].sort())
  const statements = all.split(/\r?\n/).filter((l) => !l.startsWith("--")).join(" ")
  assert.doesNotMatch(statements, /CREATE POLICY|FORCE ROW LEVEL SECURITY/i, "주석 말고 문장에")
  const journal = JSON.parse(readFileSync(join(dir, "meta", "_journal.json"), "utf8"))
  assert.equal(journal.entries.at(-1).tag, "0017_inquiry_replies")
  const whens = journal.entries.map((e) => e.when)
  assert.deepEqual(whens, [...whens].sort((a, b) => a - b), "journal 의 when 은 늘어난다")
})
