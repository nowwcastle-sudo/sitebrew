// LFAX 시험(M03 승인 행동의 확인 입력 · M04 기계 값 code·retryable). 빌드·서버 없이 돈다 — mock 모드의 진짜 서버 액션 파일을 불러 부수 효과를 본다.
// 별칭 `@/…` 만 풀어 주고(app/actions/product.ts · account-mock.ts 는 템플릿 파일 그대로) 포트는 web-factory 목 어댑터(진짜)다.
import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { registerHooks } from "node:module"
import test from "node:test"
import { fileURLToPath, pathToFileURL } from "node:url"

const T = fileURLToPath(new URL("..", import.meta.url))
const read = (p) => readFileSync(join(T, p), "utf8")

process.env.LF_MODE = "mock"
process.env.LF_MOCK_SUB = "active"
registerHooks({
  resolve(spec, ctx, next) {
    if (spec === "next/server") return next("next/server.js", ctx)
    // lib/ports.ts 가 mock 장면 쿠키(wf_session, lf-runner)를 읽으려 next/headers 를 부른다 — 순수 node 에서는 .js 로 풀어 준다
    if (spec === "next/headers") return next("next/headers.js", ctx)
    const m = /^@\/(.+)$/.exec(spec)
    if (!m) return next(spec, ctx)
    for (const cand of [`${m[1]}.ts`, `${m[1]}.tsx`, `${m[1]}/index.ts`, m[1]]) {
      const abs = join(T, cand)
      if (existsSync(abs) && /\.tsx?$/.test(abs)) return next(pathToFileURL(abs).href, ctx)
    }
    return next(spec, ctx)
  },
})

const product = await import("../app/actions/product.ts")
const { mockAccount } = await import("../app/actions/account-mock.ts")
const { markResult } = await import("../lib/action-result-marker.ts")

const REFUSED = (r, label) => {
  assert.equal(r.ok, false, label)
  assert.equal(r.code, "confirmation_required", label)
  assert.equal(r.retryable, false, label)
  assert.ok(r.formError && r.fieldErrors?.confirmed?.length, label)
}

const SIGN_UP = { method: "password", email: "lfax@example.com", password: "correct-horse-battery-9", consents: { terms: true, privacy: true, ageOver14: true } }

test("M03 결제 승인 행동(mock): 해지·요금제 변경·해지 대안·가격 변경 동의는 확인 입력 없이 실행되지 않고 구독이 그대로다", async () => {
  assert.equal((await product.signUp(SIGN_UP)).ok, true)
  const before = await product.subscription()
  assert.equal(before.ok, true)
  assert.equal(before.data.status, "active")
  assert.equal(before.data.cancelAt, undefined)
  const plans = (await product.plans()).data
  const other = plans.find((p) => p.id !== before.data.planId)
  for (const bad of [undefined, {}, { confirmed: false }, { confirmed: "yes" }]) {
    REFUSED(await product.cancel(bad ?? { when: "period_end" }), `cancel ${JSON.stringify(bad)}`)
    REFUSED(await product.changePlan({ planId: other.id, when: "now", ...(bad ?? {}) }), `changePlan ${JSON.stringify(bad)}`)
    REFUSED(await product.applyRetentionOffer({ offerId: "any", ...(bad ?? {}) }), `applyRetentionOffer ${JSON.stringify(bad)}`)
    REFUSED(await product.acceptPriceChange(bad), `acceptPriceChange ${JSON.stringify(bad)}`)
  }
  REFUSED(await product.cancel({ when: "period_end" }), "cancel without confirmed")
  REFUSED(await product.changePlan({ planId: other.id, when: "now" }), "changePlan without confirmed")
  const after = await product.subscription()
  assert.deepEqual(after.data, before.data, "거절된 요청은 구독을 건드리지 않는다")
  // 확인이 있으면 실행된다(양성 대조) — 해지는 예약(cancelAt)으로 보인다
  const changed = await product.changePlan({ planId: other.id, when: "now", confirmed: true })
  assert.equal(changed.ok, true, JSON.stringify(changed))
  assert.equal(changed.data.planId, other.id)
  const canceled = await product.cancel({ when: "period_end", confirmed: true })
  assert.equal(canceled.ok, true, JSON.stringify(canceled))
  assert.ok(canceled.data.cancelAt, "해지 예약이 보인다")
  // 가격 변경 동의: 동의할 것이 없으면 확인이 있어도 formError(실행되지 않음) — 이 경우도 기계 값이 있다
  const none = await product.acceptPriceChange({ confirmed: true })
  assert.equal(none.ok, false)
  assert.notEqual(none.code, "confirmation_required")
  assert.equal(typeof none.code, "string")
  assert.equal(typeof none.retryable, "boolean")
  await product.signOut()
})

test("M03 계정 승인 행동(mock): 이메일 바꾸기·탈퇴·내려받기·수신 동의 변경은 확인 입력 없이 실행되지 않는다 — 탈퇴는 입력한 이메일 주소도 서버가 본다", async () => {
  // 목 인증 포트는 고정된 데모 사용자로 로그인한다(가입한 주소가 세션 주소가 되지 않는다) — 세션의 주소를 읽어 쓴다
  assert.equal((await product.signUp({ ...SIGN_UP, email: "lfax-account@example.com" })).ok, true)
  const me = async () => (await product.session()).data
  const email = (await me()).email
  assert.match(email, /@/)

  // 이메일 바꾸기
  REFUSED(await mockAccount("changeEmail", { newEmail: "next@example.com", currentPassword: SIGN_UP.password }), "changeEmail")
  // 수신 동의 변경: 거절되면 값이 그대로
  const consentsBefore = (await mockAccount("consents")).data
  REFUSED(await mockAccount("setConsents", { email: true }), "setConsents")
  assert.deepEqual((await mockAccount("consents")).data, consentsBefore)
  // 내려받기
  REFUSED(await mockAccount("exportMyData"), "exportMyData")
  // 탈퇴: 확인 없음 · 주소 없음/다름 → 거절, 계정(세션)은 그대로
  REFUSED(await mockAccount("deleteAccount"), "deleteAccount ()")
  REFUSED(await mockAccount("deleteAccount", { confirmEmail: email }), "deleteAccount without confirmed")
  for (const confirmEmail of [undefined, "", "other@example.com"]) {
    const r = await mockAccount("deleteAccount", { confirmed: true, ...(confirmEmail === undefined ? {} : { confirmEmail }) })
    assert.deepEqual([r.ok, r.code, r.retryable], [false, "confirmation_required", false], String(confirmEmail))
    assert.ok(r.fieldErrors?.confirmEmail?.length)
  }
  assert.equal((await me())?.email, email, "거절된 탈퇴는 계정을 건드리지 않는다")

  // 확인이 있으면 실행된다(양성 대조)
  assert.equal((await mockAccount("changeEmail", { newEmail: "next@example.com", currentPassword: SIGN_UP.password, confirmed: true })).ok, true)
  assert.equal((await mockAccount("setConsents", { email: true, confirmed: true })).ok, true)
  assert.equal((await mockAccount("consents")).data.email, true)
  assert.equal((await mockAccount("exportMyData", { confirmed: true })).ok, true)
  const del = await mockAccount("deleteAccount", { confirmed: true, confirmEmail: ` ${email.toUpperCase()} ` })
  assert.equal(del.ok, true, JSON.stringify(del))
  assert.equal(await me(), null, "탈퇴하면 로그아웃된다")
  // 로그아웃 뒤: 기계 값이 있는 로그인 요구
  const out = await mockAccount("deleteAccount", { confirmed: true, confirmEmail: email })
  assert.deepEqual([out.ok, out.code, out.retryable], [false, "sign_in_required", false])
})

test("M04 mock 서버 액션 결과도 모든 실패에 code·retryable 이 있다(글만 주는 목 어댑터 포함)", async () => {
  // 목 결제는 청약철회 동의 칸이 없으면 거절한다(글만 주는 결과) — 서버 액션이 기계 값을 채운다
  await product.signUp(SIGN_UP)
  const noConsent = await product.checkout({ planId: (await product.plans()).data[0].id })
  assert.equal(noConsent.ok, false)
  assert.equal(noConsent.code, "invalid_input")
  assert.equal(noConsent.retryable, false)
  await product.signOut()
  const out = await mockAccount("listSessions")
  assert.deepEqual([out.ok, out.code, out.retryable], [false, "sign_in_required", false])
})

test("M04 markResult: 실패의 code·retryable·retryAfter 를 구획 속성으로 쓰고, 성공이 오면 지우며, 승인 대기는 오류로 표시하지 않는다", () => {
  const attrs = new Map()
  const el = { setAttribute: (k, v) => attrs.set(k, v), removeAttribute: (k) => attrs.delete(k) }
  const snap = () => Object.fromEntries(attrs)
  markResult(el, { ok: false, code: "rate_limited", retryable: true, retryAfter: 9.2 })
  assert.deepEqual(snap(), { "data-error-code": "rate_limited", "data-retryable": "true", "data-retry-after": "10" })
  markResult(el, { ok: false, code: "invalid_credentials", retryable: false })
  assert.deepEqual(snap(), { "data-error-code": "invalid_credentials", "data-retryable": "false" }, "이전 실패 표지가 남지 않는다")
  markResult(el, { ok: false, code: "confirmation_required", retryable: false })
  assert.deepEqual(snap(), { "data-awaiting-approval": "true" }, "승인 대기는 error-code 를 달지 않는다")
  markResult(el, { ok: false })
  assert.deepEqual(snap(), { "data-error-code": "action_failed", "data-retryable": "false" }, "code 가 없는 실패도 기계 값을 갖는다")
  markResult(el, { ok: true })
  assert.deepEqual(snap(), {}, "성공이면 모두 지운다")
})

test("조립: 확인 입력은 블록이 직접 싣는다(조립에 watch.confirmed 없음) — 결과 코드 구획(ActionScope)은 요청 제한이 날 수 있는 인증 화면·알림 구획에만 남는다", () => {
  // web-factory v0.0.11(AXC): 블록이 자기 확인 단계 뒤 confirmed: true(탈퇴는 confirmEmail 도)를 싣는다 — 조립의 감싸기가 필요 없다
  const blocks = read("components/product/product-blocks.tsx")
  assert.doesNotMatch(blocks, /watch\.confirmed\(/, "조립이 confirmed 를 싣지 않는다 — 블록이 한다")
  assert.doesNotMatch(read("components/product/action-scope.tsx"), /w\.confirmed\s*=|\bconfirmed<I/, "ActionScope 의 confirmed 감싸기는 걷었다")
  for (const f of ["changePlan", "cancel", "applyRetentionOffer", "acceptPriceChange"]) assert.match(blocks, new RegExp(`${f}: BillingPort\\["${f}"\\]`), `${f} 는 포트 모양 그대로 블록에 간다`)
  // 블록이 실제로 싣는다(설치본) — 해지·요금제 변경·가격 변경 동의·대안·이메일·탈퇴·내려받기·동의
  const loads = (f) => read("components/blocks/" + f + ".tsx")
  assert.match(loads("retention/cancel-flow"), /confirmed: true/)
  assert.match(loads("retention/renewal-consent"), /acceptPriceChange\(\{ confirmed: true \}\)/)
  assert.match(loads("account/billing-manage"), /changePlan\(\{[^}]*confirmed: true/)
  assert.match(loads("account/credentials"), /changeEmail\(\{[^}]*confirmed: true/)
  assert.match(loads("account/delete-account"), /deleteAccount\(\{ confirmed: true/)
  assert.match(loads("account/delete-account"), /exportMyData\(\{ confirmed: true \}\)/)
  assert.match(loads("account/notification-consents"), /confirmed: true/)
  // 탈퇴의 이메일 입력 확인은 블록의 copy.decision.typed 가 한다 — 조립에 바깥 입력 칸이 없다
  const account = read("components/product/account-blocks.tsx")
  assert.doesNotMatch(account, /delete-confirm|typedRef|deleteConfirmCopy/, "바깥 이메일 입력 칸·화면 쪽 주소 검사를 걷었다")
  assert.match(read("content/copy.account.en.ts"), /typed: \{\s*label: "Type your email address to confirm"/)
  // 결과 코드 구획: 결제 쪽(요청 제한 없음 — 블록 알림이 data-error-code 를 단다)은 걷고, 인증·알림 구획은 남긴다
  for (const name of ["sign-in", "sign-up", "password-reset-request", "reset-password"]) assert.match(blocks, new RegExp(`<ActionScope name="${name}">`), name)
  for (const name of ["upgrade", "billing", "cancel", "renewal-consent", "payment-failed"]) assert.doesNotMatch(blocks, new RegExp(`<ActionScope name="${name}">`), `${name} 의 구획은 걷었다`)
  for (const name of ["profile", "security", "notifications", "delete-account"]) assert.match(account, new RegExp(`<ActionScope name="${name}">`), name)
  // 서버 액션 입구는 확인 없이 포트를 직접 부르지 않는다: 승인 행동 네 개는 gated() 를 거친다
  const actions = read("app/actions/product.ts")
  for (const f of ["changePlan", "acceptPriceChange", "cancel", "applyRetentionOffer"]) assert.match(actions, new RegExp(`export const ${f} = async \\([^)]*\\) => \\(await gated\\(\\)\\)\\.${f}\\(`), f)
  assert.doesNotMatch(actions, /billing\.(changePlan|cancel|acceptPriceChange|applyRetentionOffer)\(/, "포트의 승인 메서드를 직접 부르지 않는다")
  // 로그인 필요 화면은 기계 값을 단다
  // (LFADA: 화면이 블록 state-screen/error-retry 가 되어 data-error-code 는 블록의 errorCode 칸이 단다)
  assert.match(read("components/product/sign-in-required.tsx"), /data-retryable="false"[\s\S]*errorCode="sign_in_required"/)
})
