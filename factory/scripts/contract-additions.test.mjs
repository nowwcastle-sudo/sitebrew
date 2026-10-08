// 계약 판 2 안의 추가 묶음(P3-2 Task 10d, 대장 A52): 실패 code·retryAfter·manageUrl, ?submit=rate-limited|timeout, 로그인 유지·복귀 주소, 만 14세·청약철회 확인 칸,
// 2단계 켜기·끄기, 계정 편의 메서드, 푸시 구독, identify, web_vital, 「지원 안 함」 결과. 판 번호는 그대로 2다(이름을 바꾸거나 뺀 것이 없다).
// 실행: node --test --test-force-exit --test-timeout=60000 factory/scripts/contract-additions.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const DIR = join(root, 'registry', 'factory', 'contract')
const OUT = join(root, '.tmp', 'contract-additions-test')
const js = (src) => ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
const lines = (s) => s.split(/\r?\n/)

function transpile(file, name) {
  mkdirSync(OUT, { recursive: true })
  const out = js(readFileSync(file, 'utf8')).replace(/(from\s+)(["'])@\/registry\/factory\/lib\/([a-z-]+)\2/g, (_, kw, q, lib) =>
    `${kw}${q}${pathToFileURL(transpile(join(root, 'registry', 'factory', 'lib', `${lib}.ts`), `lib-${lib}`)).href}${q}`)
  assert.doesNotMatch(out, /@\/registry\//, `${name}: 변환본에 계약 경로 import 가 남았다(타입 import 여야 한다)`)
  const path = join(OUT, `${name}.mjs`)
  writeFileSync(path, out)
  return path
}
const load = (name) => import(pathToFileURL(transpile(join(DIR, `${name}.ts`), name)).href)
const mock = await load('adapter-mock')
const events = await load('events')

// 끝나지 않는 약속인지(ms 안에 결과가 없는지)
const settlesWithin = (p, ms) => Promise.race([p.then(() => true), new Promise((r) => setTimeout(() => r(false), ms))])
const CARD = { method: 'password', email: 'kim@example.com', password: 'password-1' }
const CONSENTS = { terms: true, privacy: true }

// ① 판 번호와 이름 ─────────────────────────────────────────────────────────
test('판은 그대로 2다: 추가는 선택 칸뿐이라 CONTRACT_VERSION 이 2이고, web_vital 이 EVENTS 에 더해졌고 옛 이벤트는 모두 남았다', () => {
  assert.equal(events.CONTRACT_VERSION, 2)
  assert.equal(new Set(events.EVENTS).size, events.EVENTS.length)
  assert.ok(events.EVENTS.includes('web_vital'))
  for (const e of ['page_view', 'cta_click', 'checkout_start', 'consent_update', 'referral_share', 'payment_method_update']) assert.ok(events.EVENTS.includes(e), `${e} 가 빠졌다`)
  const ports = readFileSync(join(DIR, 'ports.ts'), 'utf8')
  // 옛 메서드 이름은 모두 그대로(판을 올리지 않는 근거) — 선택이 아닌 메서드가 줄지 않았다
  for (const m of ['session()', 'methods()', 'signIn(', 'signUp(', 'verifyTwoFactor(', 'requestPasswordReset(', 'signOut()', 'plans()', 'subscription()', 'checkout(', 'changePlan(', 'cancel(', 'pause(', 'resume()', 'updatePaymentMethod()', 'acceptPriceChange(', 'applyRetentionOffer(', 'consents()', 'setConsents(', 'track<', 'consent()', 'setConsent(', 'upload(']) assert.ok(ports.includes(m), `${m} 가 빠졌다`)
})

test('새 메서드는 모두 선택(?)이다 — 어댑터가 하나도 구현하지 않아도 계약을 지킨다', () => {
  const ports = readFileSync(join(DIR, 'ports.ts'), 'utf8')
  for (const m of ['enableTwoFactor', 'disableTwoFactor', 'changePassword', 'changeEmail', 'sendVerificationEmail', 'listSessions', 'revokeSession', 'revokeOtherSessions', 'updatePreferences', 'deleteAccount', 'exportMyData', 'portal', 'subscribePush', 'unsubscribePush', 'identify']) {
    assert.match(ports, new RegExp(`\\n  ${m}\\?\\(`), `${m} 는 선택 메서드여야 한다`)
  }
  for (const f of ['rememberMe?', 'redirectTo?', 'ageOver14?', 'withdrawalConsent?', 'graceEndsAt?', 'emailVerified?']) assert.ok(ports.includes(f), `${f} 칸이 없다`)
  assert.match(readFileSync(join(DIR, 'block-contract.ts'), 'utf8'), /code\?: ActionFailureCode \| \(string & \{\}\)[\s\S]*retryAfter\?: number[\s\S]*manageUrl\?: string/)
})

// ② 요청 제한·시간 초과 ────────────────────────────────────────────────────
test('mockSubmit rate-limited: { code: rate_limited, retryAfter(기본 30), retryable } + 해요체 문구, retryAfter 는 1~3600 으로 자른다, 상태를 건드리지 않는다', async () => {
  const r = await mock.mockSubmit('rate-limited')()
  assert.deepEqual(r, { ok: false, code: 'rate_limited', retryAfter: 30, retryable: true, formError: '요청이 너무 많아요. 30초 뒤에 다시 시도해 주세요.' })
  assert.equal((await mock.mockSubmit('rate-limited', undefined, { retryAfter: 5 })()).retryAfter, 5)
  assert.equal((await mock.mockSubmit('rate-limited', undefined, { retryAfter: 0 })()).retryAfter, 1)
  assert.equal((await mock.mockSubmit('rate-limited', undefined, { retryAfter: 99999 })()).retryAfter, 3600)
  // 오류 문구 옵션(formError)은 field-error·server-error 몫이다 — 요청 제한은 남은 초가 든 문구가 늘 같다
  assert.match((await mock.mockSubmit('rate-limited', undefined, { formError: '직접 정한 문구', retryAfter: 9 })()).formError, /9초 뒤에/)
})

test('?submit=rate-limited&retryAfter=7 는 stateFromQuery·모든 포트 쓰기 메서드에 똑같이 간다. retryAfter 가 숫자가 아니면 멈춘다', async () => {
  const q = '?submit=rate-limited&retryAfter=7'
  const viaState = await mock.stateFromQuery(q, { receipt: { id: 'x' } }).submit()
  assert.deepEqual([viaState.ok, viaState.code, viaState.retryAfter], [false, 'rate_limited', 7])
  const a = await mock.mockAuth(`${q}&auth=signed-in`).signIn(CARD)
  const b = await mock.mockBilling(q).checkout({ planId: 'pro' })
  const n = await mock.mockNotify(q).setConsents({ email: true })
  for (const r of [a, b, n]) assert.deepEqual([r.ok, r.code, r.retryAfter, r.retryable], [false, 'rate_limited', 7, true])
  assert.throws(() => mock.stateFromQuery('?retryAfter=soon'), /retryAfter=soon/)
  // 쿼리가 없으면 옛 동작 그대로(ok)
  assert.equal((await mock.mockBilling('').checkout({ planId: 'pro' })).ok, true)
})

test('?submit=timeout 은 끝나지 않는다(서버가 답하지 않는 상황) — 응답이 늦는 것과 다르게 어떤 결과도 내지 않는다', async () => {
  assert.equal(await settlesWithin(mock.mockSubmit('timeout')(), 60), false)
  assert.equal(await settlesWithin(mock.mockBilling('?submit=timeout').checkout({ planId: 'pro' }), 60), false)
  assert.equal(await settlesWithin(mock.stateFromQuery('?submit=timeout', { receipt: 1 }).submit(), 60), false)
  // 양성 대조: ok 는 바로 끝난다
  assert.equal(await settlesWithin(mock.mockBilling('').checkout({ planId: 'pro' }), 60), true)
  assert.throws(() => mock.stateFromQuery('?submit=slow'), /rate-limited\|timeout/)
})

// ③ 로그인 유지·복귀 주소·만 14세 ─────────────────────────────────────────
test('mockAuth signIn: rememberMe·redirectTo 를 받고 redirectTo 는 data.redirectUrl 로 돌아온다 — 2단계가 필요하면 아직 안 돌려준다(코드 확인 뒤에)', async () => {
  const a = mock.mockAuth('?auth=signed-out')
  assert.deepEqual(await a.signIn({ ...CARD, rememberMe: false, redirectTo: '/today' }), { ok: true, data: { redirectUrl: '/today' } })
  assert.deepEqual(await mock.mockAuth('').signIn(CARD), { ok: true, data: {} }) // 옛 호출 그대로
  const tf = mock.mockAuth('?auth=two-factor')
  assert.deepEqual(await tf.signIn({ ...CARD, redirectTo: '/today' }), { ok: true, data: { needsTwoFactor: true } })
  const v = await tf.verifyTwoFactor({ code: '123456', redirectTo: '/today' })
  assert.deepEqual([v.ok, v.data.twoFactor, v.data.redirectUrl], [true, true, '/today'])
  // 소셜은 공급자 화면이 먼저
  assert.equal((await a.signIn({ method: 'kakao', redirectTo: '/today' })).data.redirectUrl, '#mock-oauth-kakao')
})

test('mockAuth signUp: requireAgeOver14 면 ageOver14: true 가 없을 때 fieldErrors.ageOver14 로 거절, 있으면 통과. 옵션이 없으면 옛 호출도 통과(계약은 선택 칸)', async () => {
  const strict = mock.mockAuth('?auth=signed-out', { requireAgeOver14: true })
  const no = await strict.signUp({ ...CARD, consents: CONSENTS })
  assert.equal(no.ok, false)
  assert.deepEqual(Object.keys(no.fieldErrors), ['ageOver14'])
  assert.match(no.fieldErrors.ageOver14[0], /만 14세/)
  assert.equal((await strict.signUp({ ...CARD, consents: { ...CONSENTS, ageOver14: false } })).ok, false) // 타입 밖 JS 호출도 막는다
  assert.equal((await strict.signUp({ ...CARD, consents: { ...CONSENTS, ageOver14: true } })).ok, true)
  assert.equal((await mock.mockAuth('').signUp({ ...CARD, consents: CONSENTS })).ok, true)
})

// ④ 청약철회·결제 포털·지원 안 함 ──────────────────────────────────────────
test('mockBilling checkout: requireWithdrawalConsent 면 withdrawalConsent: true 가 없을 때 fieldErrors.withdrawalConsent 로 거절(구독은 그대로), 있으면 통과', async () => {
  const b = mock.mockBilling('', { requireWithdrawalConsent: true })
  const no = await b.checkout({ planId: 'pro' })
  assert.equal(no.ok, false)
  assert.deepEqual(Object.keys(no.fieldErrors), ['withdrawalConsent'])
  assert.equal((await b.subscription()).data.status, 'none')
  assert.equal((await b.checkout({ planId: 'pro', withdrawalConsent: true })).ok, true)
  assert.equal((await b.subscription()).data.status, 'trialing')
  assert.equal((await mock.mockBilling('').checkout({ planId: 'pro' })).ok, true) // 옵션이 없으면 옛 동작
})

// 승인 행동 확인 입력(P3-7 AXC — launch-factory LFAX R20): 선택 칸 confirmed?: true, 옵션 requireConfirmation
const AWAITING = (r, field = 'confirmed') => {
  assert.equal(r.ok, false)
  assert.equal(r.code, 'confirmation_required')
  assert.equal(r.retryable, false)
  assert.ok(r.formError)
  assert.deepEqual(Object.keys(r.fieldErrors), [field])
}

test('mockBilling requireConfirmation: 승인 행동 넷은 confirmed: true 없이는 confirmation_required(retryable false·fieldErrors.confirmed)이고 구독은 그대로, 있으면 통과. 옵션이 없으면 옛 호출도 통과', async () => {
  const b = mock.mockBilling('?sub=active', { requireConfirmation: true })
  const before = (await b.subscription()).data
  AWAITING(await b.changePlan({ planId: 'team', when: 'now' }))
  AWAITING(await b.cancel({ when: 'now' }))
  AWAITING(await b.applyRetentionOffer({ offerId: 'pause-1m' }))
  AWAITING(await b.acceptPriceChange())
  AWAITING(await b.cancel({ when: 'now', confirmed: false })) // 타입 밖 JS 호출·참이 아닌 값도 거절
  AWAITING(await b.cancel({ when: 'now', confirmed: 'true' }))
  assert.deepEqual((await b.subscription()).data, before, '거절이 구독을 건드렸다')
  assert.equal((await b.changePlan({ planId: 'team', when: 'now', confirmed: true })).data.planId, 'team')
  assert.equal((await b.cancel({ when: 'now', confirmed: true })).data.status, 'canceled')
  const p = mock.mockBilling('?sub=pending-price-change', { requireConfirmation: true })
  AWAITING(await p.acceptPriceChange())
  assert.ok((await p.subscription()).data.pendingPriceChange, '거절이 동의를 처리했다')
  assert.equal((await p.acceptPriceChange({ confirmed: true })).data.pendingPriceChange, undefined)
  const o = mock.mockBilling('?sub=active', { requireConfirmation: true })
  assert.equal((await o.applyRetentionOffer({ offerId: 'pause-1m', confirmed: true })).data.status, 'paused')
  // 옵션이 없으면 옛 동작(확인 칸은 있어도 없어도 된다)
  const legacy = mock.mockBilling('?sub=active')
  assert.equal((await legacy.cancel({ when: 'period_end' })).ok, true)
  assert.equal((await mock.mockBilling('?sub=pending-price-change').acceptPriceChange()).ok, true)
  // 읽기·결제 시작·일시정지는 승인 행동 확인 입력과 무관하다
  assert.equal((await b.plans()).ok, true)
})

test('mockAuth requireConfirmation: changeEmail·deleteAccount·exportMyData 는 confirmed: true 가 필요하고(거절은 세션을 안 바꾼다) 탈퇴는 입력한 이메일(confirmEmail)을 로그인한 주소와 맞춘다(공백·대소문자 무시). 로그인이 먼저다', async () => {
  const a = mock.mockAuth('?auth=signed-in', { requireConfirmation: true })
  const me = (await a.session()).data
  AWAITING(await a.changeEmail({ newEmail: 'new@example.com', currentPassword: 'pw' }))
  AWAITING(await a.deleteAccount())
  AWAITING(await a.deleteAccount({ confirmEmail: me.email }))
  AWAITING(await a.exportMyData())
  assert.deepEqual((await a.session()).data, me)
  assert.equal((await a.changeEmail({ newEmail: 'new@example.com', currentPassword: 'pw', confirmed: true })).ok, true)
  assert.equal((await a.exportMyData({ confirmed: true })).ok, true)
  AWAITING(await a.deleteAccount({ confirmed: true, confirmEmail: 'other@example.com' }), 'confirmEmail')
  assert.equal((await a.deleteAccount({ confirmed: true, confirmEmail: ` ${me.email.toUpperCase()} ` })).data.graceUntil, '2026-10-08T00:00:00.000Z')
  assert.equal((await a.deleteAccount({ confirmed: true })).ok, true) // confirmEmail 은 선택 — 이메일을 안 주는 어댑터·소셜 계정은 confirmed 만
  // 로그아웃이면 확인보다 로그인이 먼저(launch-factory 와 같은 순서)
  const out = await mock.mockAuth('?auth=signed-out', { requireConfirmation: true }).deleteAccount()
  assert.equal(out.ok, false)
  assert.notEqual(out.code, 'confirmation_required')
  assert.match(out.formError, /로그인/)
  // 옵션이 없으면 옛 호출도 통과
  assert.equal((await mock.mockAuth('?auth=signed-in').deleteAccount()).ok, true)
})

test('mockNotify requireConfirmation: setConsents 는 동의·철회 모두 confirmed: true 가 필요하고 거절은 동의 상태를 안 바꾼다. 옵션이 없으면 옛 호출도 통과', async () => {
  const n = mock.mockNotify('', { requireConfirmation: true })
  const before = (await n.consents()).data
  AWAITING(await n.setConsents({ email: true }))
  assert.deepEqual((await n.consents()).data, before)
  assert.equal((await n.setConsents({ email: true, confirmed: true })).ok, true)
  assert.equal((await n.consents()).data.email, true)
  AWAITING(await n.setConsents({ email: false })) // 철회도 확인
  assert.equal((await n.consents()).data.email, true)
  assert.equal((await n.setConsents({ email: false, confirmed: true })).ok, true)
  assert.equal((await mock.mockNotify('').setConsents({ sms: true })).ok, true)
})

test('code 가 있는 목 실패는 retryable 도 준다(계약 문서화): trial_unavailable·invalid_token·지원 안 함·승인 대기·요청 제한', async () => {
  const trial = await mock.mockBilling('').checkout({ planId: 'basic', trial: true })
  assert.deepEqual([trial.code, trial.retryable], ['trial_unavailable', false])
  const token = await mock.mockAuth('').resetPassword({ token: 'nope', newPassword: 'password-1' })
  assert.deepEqual([token.code, token.retryable], ['invalid_token', false])
  const unsupported = await mock.mockBilling('?sub=active', { unsupported: { cancel: 'provider_unsupported' } }).cancel({ when: 'now' })
  assert.deepEqual([unsupported.code, unsupported.retryable], ['provider_unsupported', false])
  const approval = await mock.mockSubmit('approval-required')()
  assert.deepEqual([approval.code, approval.retryable], ['confirmation_required', false])
  assert.deepEqual([(await mock.mockSubmit('rate-limited')()).code, (await mock.mockSubmit('rate-limited')()).retryable], ['rate_limited', true])
})

test('ActionFailureCode: LFAX 값(confirmation_required·sign_in_required·provider_unavailable·invalid_input·invalid_credentials·action_failed)이 더해졌고 옛 값(approval_required·signInRequired 포함)은 그대로, retryable 문서화·확인 칸은 모두 선택(?)', () => {
  const contract = readFileSync(join(DIR, 'block-contract.ts'), 'utf8')
  const union = contract.match(/export type ActionFailureCode =([^\n]+)/)[1]
  for (const c of ['rate_limited', 'bot_check_failed', 'bot_check_unavailable', 'in_progress', 'provider_unsupported', 'scenario_unsupported', 'invalid_token', 'signInRequired', 'approval_required', 'confirmation_required', 'sign_in_required', 'provider_unavailable', 'invalid_input', 'invalid_credentials', 'action_failed']) assert.ok(union.includes(`"${c}"`), `${c} 가 ActionFailureCode 에 없다`)
  assert.match(contract, /confirmation_required — \*\*승인 대기\*\*[\s\S]*오류가 아니라 정해진 결과[\s\S]*`provider_unsupported` 와 같은 자리/)
  assert.match(contract, /\*\*`code` 가 있으면 어댑터는 `retryable` 도 준다\*\*/)
  assert.match(contract, /retryable\?: boolean/) // 타입은 선택 — 안 주는 옛 어댑터도 계약을 지킨다
  const ports = readFileSync(join(DIR, 'ports.ts'), 'utf8')
  assert.match(ports, /export type HumanConfirmation = \{ confirmed\?: true \}/)
  for (const sig of [
    /changePlan\(input: \{ planId: string; when: "now" \| "period_end" \} & HumanConfirmation\)/,
    /cancel\(input: \{[^}]*when: "period_end" \| "now" \} & HumanConfirmation\)/,
    /applyRetentionOffer\(input: \{ offerId: string \} & HumanConfirmation\)/,
    /acceptPriceChange\(input\?: HumanConfirmation\)/,
    /changeEmail\?\(input: \{[^}]*\} & HumanConfirmation\)/,
    /deleteAccount\?\(input\?: HumanConfirmation & \{ confirmEmail\?: string \}\)/,
    /exportMyData\?\(input\?: HumanConfirmation\)/,
    /setConsents\(input: NonNullable<ConsentInput\["marketing"\]> & HumanConfirmation\)/,
  ]) assert.match(ports, sig)
})

test('mockBilling portal: redirectUrl·paymentMethodUrl. ?submit= 결과도 따른다', async () => {
  const r = await mock.mockBilling('').portal()
  assert.deepEqual(r, { ok: true, data: { redirectUrl: '#mock-billing-portal', paymentMethodUrl: '#mock-billing-portal-payment-method' } })
  assert.equal((await mock.mockBilling('?submit=server-error').portal()).ok, false)
})

test('「지원 안 함」은 오류가 아니라 정해진 결과: provider_unsupported·scenario_unsupported + manageUrl, 상태는 그대로, 모르는 메서드는 멈춘다', async () => {
  const b = mock.mockBilling('?sub=active', { unsupported: { cancel: 'provider_unsupported', pause: 'scenario_unsupported' }, manageUrl: 'https://example.com/manage' })
  const c = await b.cancel({ when: 'period_end' })
  assert.deepEqual([c.ok, c.code, c.manageUrl], [false, 'provider_unsupported', 'https://example.com/manage'])
  assert.equal((await b.pause({ until: '2026-12-01T00:00:00.000Z' })).code, 'scenario_unsupported')
  assert.equal((await b.subscription()).data.cancelAt, undefined)
  assert.equal((await b.changePlan({ planId: 'team', when: 'now' })).ok, true) // 지원하는 메서드는 그대로
  assert.equal((await mock.mockBilling('?sub=active', { unsupported: { cancel: 'provider_unsupported' } }).cancel({ when: 'now' })).manageUrl, undefined) // manageUrl 은 있을 때만
  assert.throws(() => mock.mockBilling('', { unsupported: { plans: 'provider_unsupported' } }), /unsupported\.plans/)
})

// ⑤ 2단계 켜기·끄기·계정 편의 ───────────────────────────────────────────────
test('2단계 켜기: enableTwoFactor(비밀번호) → totpURI·백업 코드 → 첫 코드 verifyTwoFactor 뒤에야 켜진다 → disableTwoFactor. 로그아웃 상태·비밀번호 없음은 거절', async () => {
  const a = mock.mockAuth('?auth=signed-in')
  assert.equal((await a.session()).data.twoFactor, false)
  assert.equal((await a.verifyTwoFactor({ code: '123456' })).ok, false) // 켜는 중이 아니면 코드를 받지 않는다
  assert.deepEqual(Object.keys((await a.enableTwoFactor({})).fieldErrors), ['password'])
  const e = await a.enableTwoFactor({ password: 'password-1' })
  assert.equal(e.ok, true)
  assert.match(e.data.totpURI, /^otpauth:\/\/totp\//)
  assert.equal(e.data.backupCodes.length, 8)
  assert.equal((await a.session()).data.twoFactor, false, '첫 코드 확인 전에는 켜지지 않는다')
  assert.equal((await a.verifyTwoFactor({ code: '12ab56' })).ok, false)
  assert.equal((await a.verifyTwoFactor({ code: '123456' })).data.twoFactor, true)
  assert.equal((await a.session()).data.twoFactor, true)
  assert.equal((await a.disableTwoFactor({ password: 'password-1' })).ok, true)
  assert.equal((await a.session()).data.twoFactor, false)
  const out = await mock.mockAuth('?auth=signed-out').enableTwoFactor({ password: 'p' })
  assert.deepEqual([out.ok, out.formError], [false, '로그인이 필요해요. 다시 로그인해 주세요.'])
})

test('계정 편의: 비밀번호 변경(다른 기기 로그아웃)·이메일 변경·기기 목록·끊기·환경설정·탈퇴 유예·내 정보 — 로그인 상태에서만', async () => {
  const a = mock.mockAuth('?auth=signed-in')
  assert.equal((await a.listSessions()).data.length, 2)
  assert.equal((await a.revokeSession({ sessionId: 'nope' })).ok, false)
  assert.equal((await a.revokeSession({ sessionId: 'device-phone' })).ok, true)
  assert.deepEqual((await a.listSessions()).data.map((d) => d.id), ['device-current'])
  assert.ok(!('token' in (await a.listSessions()).data[0]), '기기 목록에 토큰이 없다')
  const bad = await a.changePassword({ currentPassword: '', newPassword: 'short' })
  assert.deepEqual(Object.keys(bad.fieldErrors).sort(), ['currentPassword', 'newPassword'])
  const b = mock.mockAuth('?auth=signed-in')
  assert.deepEqual((await b.changePassword({ currentPassword: 'old-password', newPassword: 'new-password-1', revokeOtherSessions: true })).data, { otherSessionsRevoked: true })
  assert.equal((await b.listSessions()).data.length, 1)
  assert.deepEqual((await b.changePassword({ currentPassword: 'old-password', newPassword: 'new-password-1' })).data, { otherSessionsRevoked: false })
  assert.equal((await a.changeEmail({ newEmail: 'not-an-email', currentPassword: 'p' })).ok, false)
  assert.deepEqual((await a.changeEmail({ newEmail: 'new@example.com', currentPassword: 'p' })).data, { emailSent: true })
  assert.deepEqual((await a.sendVerificationEmail()).data, { sent: true })
  assert.deepEqual((await a.updatePreferences({ locale: 'en', timeZone: 'Asia/Seoul' })).data, { locale: 'en', timeZone: 'Asia/Seoul' })
  assert.equal((await a.session()).data.locale, 'en')
  assert.match((await a.deleteAccount()).data.graceUntil, /^2026-10-08/)
  const my = await a.exportMyData()
  assert.equal(my.ok, true)
  assert.equal(my.data.account.email, 'kim@example.com')
  // 로그아웃 상태
  const out = mock.mockAuth('?auth=signed-out')
  for (const call of [() => out.listSessions(), () => out.deleteAccount(), () => out.exportMyData(), () => out.revokeOtherSessions(), () => out.sendVerificationEmail()]) assert.equal((await call()).ok, false)
})

test('기기 목록은 읽기 4상태를 따른다: ?state=empty → [], error → 다시 시도할 수 있는 오류, loading → 끝나지 않음', async () => {
  assert.deepEqual((await mock.mockAuth('?auth=signed-in&state=empty').listSessions()).data, [])
  const err = await mock.mockAuth('?auth=signed-in&state=error').listSessions()
  assert.deepEqual([err.ok, err.retryable], [false, true])
  assert.equal(await settlesWithin(mock.mockAuth('?auth=signed-in&state=loading').listSessions(), 60), false)
})

// ⑥ 푸시 구독·identify ─────────────────────────────────────────────────────
test('mockNotify 푸시 구독: https endpoint + keys 가 있어야 저장, 해제는 저장한 endpoint 만', async () => {
  const n = mock.mockNotify('')
  const sub = { endpoint: 'https://push.example/abc', expirationTime: null, keys: { p256dh: 'pk', auth: 'ak' } }
  assert.deepEqual((await n.subscribePush(sub)).data, { subscribedAt: mock.MOCK_NOW })
  assert.deepEqual(Object.keys((await n.subscribePush({ ...sub, endpoint: 'http://push.example/abc' })).fieldErrors), ['endpoint'])
  assert.deepEqual(Object.keys((await n.subscribePush({ endpoint: sub.endpoint, keys: { p256dh: '', auth: '' } })).fieldErrors), ['keys'])
  assert.equal((await n.unsubscribePush({ endpoint: sub.endpoint })).ok, true)
  assert.equal((await n.unsubscribePush({ endpoint: sub.endpoint })).ok, false)
})

test('mockAnalytics identify: 동의(analytics)가 있을 때만 기록, 빈 id 는 버린다. web_vital 도 track 처럼 동의를 따른다', () => {
  const off = mock.mockAnalytics('?consent=unset')
  off.identify('user-1')
  off.track('web_vital', { metric: 'INP', value: 180, rating: 'good', path: '/' })
  assert.deepEqual([off.identified, off.events], [[], []])
  const on = mock.mockAnalytics('?consent=analytics')
  on.identify('user-1')
  on.identify('')
  on.track('web_vital', { metric: 'LCP', value: 2100, rating: 'good', path: '/pricing' })
  assert.deepEqual(on.identified, ['user-1'])
  assert.deepEqual(on.events, [{ name: 'web_vital', props: { metric: 'LCP', value: 2100, rating: 'good', path: '/pricing' } }])
})

test('새 이벤트 props 에 개인정보 키가 없다: web_vital 의 필드 이름은 name 이 아니라 metric', () => {
  const src = readFileSync(join(DIR, 'events.ts'), 'utf8')
  const body = src.match(/web_vital: \{([^}]*)\}/)[1]
  assert.match(body, /metric:/)
  assert.doesNotMatch(body, /\b(name|email|phone)\b\s*:/)
})

// ⑦ 타입 울타리 음성 대조 ──────────────────────────────────────────────────
test('tsc: ports-additions.typetest.ts 는 통과하고, @ts-expect-error 줄을 지운 사본은 바로 그 줄들에서만 실패한다(음성 대조)', () => {
  const src = readFileSync(join(root, 'app', 'qa', 'blocks', 'ports-additions.typetest.ts'), 'utf8')
  const expected = new Set()
  const kept = []
  lines(src).forEach((l) => {
    if (/^\s*\/\/ @ts-expect-error/.test(l)) expected.add(kept.length + 1)
    else kept.push(l)
  })
  assert.equal(expected.size, 10, '고정물의 @ts-expect-error 는 열 줄이다(만 14세·청약철회 false, retryAfter 문자열, 성공 결과의 code, 푸시 키 없음, identify 특성, web_vital 지표·name, 확인 칸 false·confirmEmail 숫자 — P3-7 AXC)')
  const neg = join(OUT, 'tsc-neg')
  rmSync(neg, { recursive: true, force: true })
  mkdirSync(neg, { recursive: true })
  writeFileSync(join(neg, 'additions-neg.ts'), kept.join('\n'))
  writeFileSync(join(neg, 'tsconfig.json'), JSON.stringify({ extends: '../../../tsconfig.json', compilerOptions: { incremental: false, noEmit: true, plugins: [] }, include: ['./*.ts'], exclude: [] }))
  const tsc = join(root, 'node_modules', 'typescript', 'bin', 'tsc')
  const r = spawnSync(process.execPath, [tsc, '-p', join(neg, 'tsconfig.json'), '--pretty', 'false'], { cwd: root, encoding: 'utf8' })
  const errors = lines(r.stdout).filter((l) => /error TS\d+/.test(l))
  assert.notEqual(r.status, 0, '음성 대조가 통과하면 울타리가 없다')
  const at = new Set(errors.map((e) => Number(e.match(/additions-neg\.ts\((\d+),\d+\)/)?.[1])))
  assert.deepEqual([...at].sort((a, b) => a - b), [...expected].sort((a, b) => a - b), errors.join('\n'))
})
