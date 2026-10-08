// LFADB 시험(결제·인증 블록 도입 — web-factory v0.0.10 group B). 빌드·서버·Chrome 없이 돈다(실제 화면은 docs/qa/ux-audit/apply-lfadb.md 의 mock 걸어 보기가 본다).
import assert from "node:assert/strict"
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { registerHooks } from "node:module"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { fileURLToPath, pathToFileURL } from "node:url"

const T = fileURLToPath(new URL("..", import.meta.url))
const read = (p) => readFileSync(join(T, p), "utf8")

registerHooks({
  resolve: (spec, ctx, next) => {
    if (spec.startsWith("@/")) {
      for (const ext of [".ts", "/index.ts"]) {
        const file = join(T, spec.slice(2) + ext)
        if (existsSync(file)) return next(pathToFileURL(file).href, ctx)
      }
    }
    return next(spec === "next/headers" ? "next/headers.js" : spec === "next/server" ? "next/server.js" : spec, ctx)
  },
})

const { parseMockScene } = await import("../lib/mock-scene.ts")
const { buildMockPorts, MOCK_TAKEN_EMAIL } = await import("../lib/mock-ports.ts")
const { planParam, IN_USE_STATUSES } = await import("../lib/plan-param.ts")
const ports = (raw) => buildMockPorts({ scene: parseMockScene(raw), defaultSub: "active", getName: () => undefined })
const consents = { terms: true, privacy: true, ageOver14: true, marketing: {} }

// ── A02: 이미 있는 이메일 ─────────────────────────────────────────────────────────────

test("A02 mock 가입: 이미 있는 이메일은 live 어댑터와 같은 모양(칸 오류 + code email_exists)으로 거절하고, 다른 이메일은 그대로 통과한다", async () => {
  const p = ports("signed-out")
  const taken = await p.auth.signUp({ method: "password", email: ` ${MOCK_TAKEN_EMAIL.toUpperCase()} `, password: "correct horse battery", consents })
  assert.equal(taken.ok, false)
  assert.equal(taken.code, "email_exists")
  assert.equal(taken.retryable, false)
  assert.ok(taken.fieldErrors?.email?.length, "이메일 칸 오류가 있어야 한다 — 블록이 칸 오류 + 알림을 같이 그린다")
  const fresh = await p.auth.signUp({ method: "password", email: "new-person@example.com", password: "correct horse battery", consents })
  assert.equal(fresh.ok, true)
})

test("A02 live 어댑터 소스: USER_ALREADY_EXISTS 는 code email_exists 로 나간다(가입 블록이 로그인·비밀번호 찾기 링크를 붙인다)", () => {
  assert.match(readFileSync(join(T, "..", "packages", "auth", "src", "adapter.ts"), "utf8"), /USER_ALREADY_EXISTS"\)\) return \{ ok: false, fieldErrors: \{ email: \[AUTH\.userExists\] \}, retryable: false, code: "email_exists" \}/)
  const copy = read("content/copy.en.ts")
  assert.match(copy, /exists: \{\s*title: "That email already has an account"[\s\S]*?signIn: \{ label: "Sign in", href: "\/sign-in" \}[\s\S]*?reset: \{ label: "Reset your password", href: "\/forgot-password" \}/)
})

// ── 재설정: 한 칸 판 ───────────────────────────────────────────────────────────────────

test("재설정 마무리는 web-factory 새 비밀번호 블록의 한 칸 판이다 — 한 번 더 칸 문구가 없고 보기 토글 이름이 있다(운영자 결정 2026-10-03)", async () => {
  assert.ok(!existsSync(join(T, "components", "product", "reset-password.tsx")), "옛 LF 전용 폼은 지웠다")
  const blocks = read("components/product/product-blocks.tsx")
  assert.match(blocks, /<AuthNewPassword copy=\{resetPasswordCopy\} confirmField=\{false\}/)
  const page = read("app/(product)/reset-password/page.tsx")
  assert.match(page, /NewPasswordBlock/)
  assert.match(page, /typeof error !== "string"/, "?error= 로 온 틀린 링크는 token 을 비운다")
  const { resetPasswordCopy } = await import("../content/copy.en.ts")
  assert.equal(typeof resetPasswordCopy.newPassword.show, "string")
  assert.ok(resetPasswordCopy.newPassword.show.length > 0)
  assert.ok(!("confirm" in resetPasswordCopy), "한 칸 판에는 confirm 문구가 없다")
  assert.ok(!("mismatch" in resetPasswordCopy.errors))
})

// ── E01·E02: 요금표·결제 길 ───────────────────────────────────────────────────────────

test("E01 요금표: 요금제 id 가 카드에 실리고, 로그인한 사람은 /upgrade?plan=<id> 로, 로그아웃은 가입에 ?plan= 을 단다", async () => {
  const { pricingFromPlans } = await import("../content/pricing-from-plans.ts")
  const { pricingCopy } = await import("../content/copy.en.ts")
  // plan-cta.tsx 는 타입 import 뿐인 순수 함수 파일이라 .mts 사본으로 불러 실제 행동을 돌려 본다(Node 는 .tsx 를 못 읽는다)
  const copyDir = mkdtempSync(join(tmpdir(), "adb-plan-cta-"))
  const copyFile = join(copyDir, "plan-cta.mts")
  writeFileSync(copyFile, read("components/blocks/_shared/plan-cta.tsx"))
  const { resolvePlanCta } = await import(pathToFileURL(copyFile).href)
  rmSync(copyDir, { recursive: true, force: true }) // 불러온 뒤에는 사본이 필요 없다
  const mp = ports("signed-in")
  const list = await mp.billing.plans()
  assert.ok(list.ok)
  const copy = pricingFromPlans(pricingCopy, list.data)
  const monthly = list.data.filter((x) => x.interval === "month")
  assert.deepEqual(copy.planIds, monthly.map((x) => x.id))
  const i = copy.plans.findIndex((x) => x.monthlyPrice !== null && x.monthlyPrice > 0)
  assert.ok(i >= 0)
  const price = copy.plans[i].monthlyPrice
  const base = copy.planCtas[i]
  const out = resolvePlanCta(copy, { signedIn: false }, i, base, price)
  assert.equal(out.href, `/sign-up?plan=${encodeURIComponent(copy.planIds[i])}`)
  const inn = resolvePlanCta(copy, { signedIn: true }, i, base, price)
  assert.equal(inn.href, `/upgrade?plan=${encodeURIComponent(copy.planIds[i])}`)
  assert.equal(inn.current, false)
  const cur = resolvePlanCta(copy, { signedIn: true, currentPlanId: copy.planIds[i] }, i, base, price)
  assert.equal(cur.current, true, "지금 쓰는 요금제는 링크가 아니라 표지")
  assert.equal(cur.label, copy.currentLabel)
})

test("E01 쪽: /pricing 은 세션·구독을 읽어 값으로 넘기고, /upgrade 는 ?plan= 을 읽어 고른 채로 열며, 가입 쪽은 ?plan= 을 받아 다음 행동에 싣는다", () => {
  const pricing = read("app/(product)/pricing/page.tsx")
  assert.match(pricing, /signedIn=\{!!s\}/)
  assert.match(pricing, /currentPlanId=\{current\}/)
  const upgrade = read("app/(product)/upgrade/page.tsx")
  assert.match(upgrade, /planId=\{plan\}/)
  assert.match(upgrade, /currentPlanId=\{current\}/)
  assert.match(upgrade, /SignInRequired next=\{plan \?/, "로그인 전이면 돌아올 주소에도 ?plan= 이 실린다")
  assert.match(read("app/(product)/sign-up/page.tsx"), /plan=\{planParam\(/)
  assert.match(read("components/product/product-blocks.tsx"), /href: `\/upgrade\?plan=\$\{encodeURIComponent\(plan\)\}`/)
})

test("E01 요금제 id 주소 값: 모양이 맞는 것만 받고(길이·글자), 구독 상태 중 쓰는 중은 해지 예약·끝남이 아니다", () => {
  assert.equal(planParam("pro"), "pro")
  assert.equal(planParam("pri_01abc.v2-x"), "pri_01abc.v2-x")
  for (const bad of [undefined, "", "a b", "../x", "x".repeat(65), ["a"], "<script>", "a?b=c"]) assert.equal(planParam(bad), undefined, String(bad))
  assert.deepEqual([...IN_USE_STATUSES], ["trialing", "active", "past_due", "paused"])
})

test("E02 결제 관리의 「요금제 고르기」·「다시 시작」은 요금표를 거치지 않고 결제 화면으로 간다", async () => {
  const { billingCopy } = await import("../content/copy.en.ts")
  assert.equal(billingCopy.none.href, "/upgrade")
  assert.equal(billingCopy.restart.href, "/upgrade?plan={plan}")
})

// ── E04: 업그레이드 대화상자 ───────────────────────────────────────────────────────────

test("E04 업그레이드: 무료 머리·체험 뒤 금액이 든 단추 글·결제 수단이 든 첫 결제 문장이 있고, 두 선택지는 대등하다(L3 — 운영자 결정, 주 단추 강조를 넘기지 않는다)", async () => {
  const { upgradeCopy } = await import("../content/copy.en.ts")
  assert.equal(upgradeCopy.compare.currentFree, "Free plan")
  assert.match(upgradeCopy.offer.ctaTrialThen, /\{days\}.*\{amount\}.*\{per\}/)
  assert.match(upgrade_first(upgradeCopy), /payment method/)
  const blocks = read("components/product/product-blocks.tsx")
  assert.ok(!/emphasis=/.test(blocks), "emphasis 를 넘기지 않는다 — 기본은 대등한 두 선택지(L3)")
  assert.match(blocks, /planId=\{planId\} currentPlanId=\{currentPlanId\}/)
})
const upgrade_first = (c) => c.offer.firstCharge

// ── F02: 결제 실패 띠 ──────────────────────────────────────────────────────────────────

test("F02 결제 실패: mock past_due 구독에 접근 중지일이 있고, 띠·결제 관리가 같은 사실을 쓴다(우리 결제 실패 메일 F11 은 그대로)", async () => {
  const past = await ports("signed-in:sub=past_due").billing.subscription()
  assert.ok(past.ok && past.data)
  assert.equal(past.data.status, "past_due")
  assert.ok(past.data.graceEndsAt && new Date(past.data.graceEndsAt) > new Date(), "접근 중지일은 앞으로의 날짜")
  const active = await ports("signed-in:sub=active").billing.subscription()
  assert.ok(active.ok && active.data && !active.data.graceEndsAt, "다른 상태에는 더하지 않는다")
  const { billingCopy } = await import("../content/copy.en.ts")
  const { paymentFailedCopy } = await import("../content/copy.ux.en.ts")
  assert.match(billingCopy.notes.pastDue, /\{until\}/)
  assert.ok(billingCopy.labels.retry)
  assert.match(paymentFailedCopy.accessUntil, /\{date\}/)
  assert.ok(paymentFailedCopy.recovered)
  // 두 쪽(결제 관리·결제 화면) 위에 띠가 있다
  for (const page of ["app/(product)/account/billing/page.tsx", "app/(product)/upgrade/page.tsx"]) assert.match(read(page), /<PaymentFailedBlock /, page)
  // 우리가 보내는 결제 실패 메일은 그대로 있다(F11 — 이 레인은 건드리지 않는다)
  assert.match(readFileSync(join(T, "..", "packages", "billing-paddle", "src", "sync.ts"), "utf8"), /LF_PAYMENT_FAILED_EMAIL/)
  assert.match(read("lib/launch/billing.ts"), /LF_PAYMENT_FAILED_EMAIL/)
})

// ── F04·F05·F12·F13: 갱신 동의·해지 ────────────────────────────────────────────────────

test("F04 갱신 동의: 메일 링크가 닿는 쪽은 standalone 이고 결제 방법·해지 방법 고지가 단추 위에 있다", async () => {
  assert.match(read("components/product/product-blocks.tsx"), /<RetentionRenewalConsent copy=\{renewalConsentCopy\} track=\{track\} standalone/)
  const { renewalConsentCopy } = await import("../content/copy.ux.en.ts")
  for (const k of ["paymentMethod", "howToCancel", "loading", "error", "retry"]) assert.ok(renewalConsentCopy[k], k)
  assert.ok(renewalConsentCopy.empty?.href)
})

test("F05·F12·F13 해지: resume 을 이어 해지 예약 상태를 알고, 완료 글에 다음 결제 없음·다른 경로 안내가 있으며, 확인 입력은 블록이 싣는다(v0.0.11 — AXLF 래퍼 걷음)", async () => {
  const { cancelFlowCopy } = await import("../content/copy.en.ts")
  assert.ok(cancelFlowCopy.done.noMoreCharges)
  assert.match(cancelFlowCopy.done.otherChannels.body, /app store/i)
  assert.match(cancelFlowCopy.scheduled.body, /\{date\}/)
  assert.ok(!/three/i.test(cancelFlowCopy.lead), "흐름이 두 단계일 수 있으니 「세 단계」라고 못 박지 않는다")
  const page = read("app/(product)/account/cancel/page.tsx")
  assert.match(page, /resume=\{resume\}/)
  const blocks = read("components/product/product-blocks.tsx")
  assert.doesNotMatch(blocks, /watch\.confirmed\(/)
  assert.match(blocks, /<RetentionCancelFlow [^>]*\{\.\.\.props\}/, "해지 블록은 포트(cancel·applyRetentionOffer·resume)를 그대로 받는다")
})

test("AXLF 감싸개: 재설정 마무리(요청 제한이 날 수 있는 인증 화면)는 ActionScope 로 남고, 결제 실패 띠(결제 쪽)는 블록 알림이 기계 값을 단다", () => {
  const blocks = read("components/product/product-blocks.tsx")
  assert.match(blocks, /<ActionScope name="reset-password">[\s\S]*?resetPassword=\{watch\(resetPassword\)\}/)
  assert.doesNotMatch(blocks, /<ActionScope name="payment-failed">/)
  assert.match(blocks, /<RetentionPaymentFailedBanner [^>]*\{\.\.\.props\}/, "결제 실패 띠는 포트(subscription·updatePaymentMethod)를 그대로 받는다")
})

test("설치 목록: 새 비밀번호·결제 실패 띠 블록이 BLOCK_ITEMS 와 잠금에 있다", async () => {
  const { BLOCK_ITEMS } = await import("../../scripts/template-sync.mjs")
  for (const n of ["block-auth-new-password", "block-retention-payment-failed-banner"]) assert.ok(BLOCK_ITEMS.includes(n), n)
  const lock = JSON.parse(read("template.lock.json"))
  for (const f of ["components/blocks/auth/new-password.tsx", "components/blocks/retention/payment-failed-banner.tsx"]) assert.ok(f in (lock.files ?? lock.blocks?.files ?? {}) || JSON.stringify(lock).includes(f), f)
})
