// 기능 포트(P3-2 Task 10): ports.ts·events.ts 타입, 포트 목(adapter-mock), 정적 결제 링크(adapter-static).
// 실행: node --test --test-force-exit --test-timeout=60000 "factory/scripts/*.test.mjs"
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'
import ts from 'typescript'
import { buildItems } from './gen-registry.mjs'
import { blockDeps } from './blocks.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const DIR = join(root, 'registry', 'factory', 'contract')
const OUT = join(root, '.tmp', 'ports-test')
const REPO = 'nowwcastle-sudo/sitebrew'
const lines = (s) => s.split(/\r?\n/)
const HANGUL = /[가-힣]/
const settles = (p) => Promise.race([p.then(() => true, () => true), new Promise((r) => setImmediate(() => r(false)))])
const js = (src) => ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText

// 계약 파일 → .tmp/ports-test/<이름>.mjs. 계약끼리의 import 는 타입만이라 사라지고, lib 값 import 는 파일 주소로 잇는다(contract.test 와 같은 방식).
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
const stat = await load('adapter-static')
const events = await load('events')
const offerLib = await import(pathToFileURL(transpile(join(root, 'registry', 'factory', 'lib', 'retention-offer.ts'), 'lib-retention-offer')).href)

// 계획 Task 10 의 이벤트 표(정본) — 순서까지 같다. web_vital 은 Task 10d(대장 D103·A52)가, booking_* 셋은 예약 포트(sitebrew v0.2.0 계획 3b)가, 맨 끝 add_to_cart·begin_checkout·purchase 셋은 계획 3a(판매·결제)가 판 2 안에서 더한 선택 이벤트다.
const PLAN_EVENTS = [
  'page_view', 'cta_click', 'form_start', 'form_submit', 'form_error',
  'signup_start', 'signup_complete', 'login', 'onboarding_step_complete', 'activation',
  'pricing_view', 'plan_select', 'checkout_start', 'checkout_complete', 'trial_start',
  'upgrade_prompt_view', 'upgrade_click', 'limit_reached',
  'cancel_start', 'cancel_alternative_view', 'cancel_alternative_accept', 'cancel_complete', 'pause', 'resume',
  'payment_failed_view', 'payment_method_update', 'referral_share', 'consent_update', 'web_vital',
  'app_install',
  'booking_view', 'booking_submit', 'booking_cancel',
  'add_to_cart', 'begin_checkout', 'purchase',
]

// ① 타입 파일 ─────────────────────────────────────────────────────────────
test('ports.ts is types only: every import is `import type`, and the transpiled module is empty', () => {
  const src = readFileSync(join(DIR, 'ports.ts'), 'utf8')
  for (const l of lines(src).filter((l) => /^\s*import\s/.test(l))) assert.match(l, /^\s*import type\s/, l)
  assert.equal(js(src).replace(/\/\/.*|\s|export\s*\{\s*\};?/g, ''), '')
})

// Task 10c(계약 판 2): 런타임 값이 둘 — 이벤트 표 EVENTS 와 판 번호 CONTRACT_VERSION. 감싸기 withAttribution 은 ports 타입이 필요해 attribution 항목에 있다.
test('events.ts holds exactly two runtime statements — `export const EVENTS = [...] as const` and `export const CONTRACT_VERSION` — and imports nothing', () => {
  const src = readFileSync(join(DIR, 'events.ts'), 'utf8')
  assert.doesNotMatch(src, /^\s*import\s/m)
  const out = ts.createSourceFile('events.js', js(src), ts.ScriptTarget.ES2022)
  const stmts = out.statements.filter((s) => !ts.isExportDeclaration(s) || s.exportClause?.elements?.length)
  assert.equal(stmts.length, 2, stmts.map((s) => s.getText(out)).join('\n'))
  const names = stmts.map((s) => (ts.isVariableStatement(s) ? s.declarationList.declarations[0].name.getText(out) : s.getText(out)))
  assert.deepEqual(names, ['EVENTS', 'CONTRACT_VERSION'])
  assert.match(src, /\]\s*as const/)
})

test('EVENTS: the plan table, unique, lower snake_case (object after the verb)', () => {
  assert.deepEqual([...events.EVENTS], PLAN_EVENTS)
  assert.equal(new Set(events.EVENTS).size, events.EVENTS.length)
  for (const e of events.EVENTS) assert.match(e, /^[a-z]+(_[a-z]+)*$/, e)
})

// tsc 타입 검사기로 EventProps 의 모든 키를 읽는다 — 이름마다 props 가 있고, 개인정보 키가 없다.
test('tsc: EventProps has a props type for every event name (and nothing else); no key carries personal data', () => {
  const file = join(DIR, 'events.ts')
  const program = ts.createProgram([file], { strict: true, noEmit: true, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext })
  const checker = program.getTypeChecker()
  const sf = program.getSourceFile(file)
  const iface = sf.statements.find((s) => ts.isInterfaceDeclaration(s) && s.name.text === 'EventProps')
  assert.ok(iface, 'EventProps 인터페이스가 없다')
  const type = checker.getTypeAtLocation(iface.name)
  const names = type.getProperties().map((p) => p.name)
  assert.deepEqual([...names].sort(), [...PLAN_EVENTS].sort())
  const PII = /e-?mail|phone|mobile|^tel$|^name$|user_?name|full_?name|address|birth|resident|rrn|ssn/i
  let keys = 0
  for (const p of type.getProperties()) {
    const props = checker.getTypeOfSymbolAtLocation(p, iface)
    for (const k of props.getProperties()) {
      keys++
      assert.doesNotMatch(k.name, PII, `${p.name}.${k.name}: 개인정보로 보이는 키`)
    }
  }
  assert.ok(keys >= PLAN_EVENTS.length, `props 키가 너무 적다: ${keys}`)
})

test('tsc: ports.typetest.ts compiles; without its @ts-expect-error lines it fails exactly on those lines (negative control)', () => {
  const src = readFileSync(join(root, 'app', 'qa', 'blocks', 'ports.typetest.ts'), 'utf8')
  const all = lines(src)
  const expected = new Set()
  const kept = []
  all.forEach((l) => {
    if (/^\s*\/\/ @ts-expect-error/.test(l)) expected.add(kept.length + 1) // 지운 뒤 다음 줄 번호(1부터)
    else kept.push(l)
  })
  assert.equal(expected.size, 9, '고정물의 @ts-expect-error 는 아홉 줄이다(Task 10b: 가격 변경 종류·해지 대안 종류·유입 종류 +3, Task 10c: props 안의 출처 태그 +1)')
  const neg = join(OUT, 'tsc-neg')
  rmSync(neg, { recursive: true, force: true })
  mkdirSync(neg, { recursive: true })
  writeFileSync(join(neg, 'ports-neg.ts'), kept.join('\n'))
  writeFileSync(join(neg, 'tsconfig.json'), JSON.stringify({ extends: '../../../tsconfig.json', compilerOptions: { incremental: false, noEmit: true, plugins: [] }, include: ['./*.ts'], exclude: [] }))
  const tsc = join(root, 'node_modules', 'typescript', 'bin', 'tsc')
  const r = spawnSync(process.execPath, [tsc, '-p', join(neg, 'tsconfig.json'), '--pretty', 'false'], { cwd: root, encoding: 'utf8' })
  const errors = lines(r.stdout).filter((l) => /error TS\d+/.test(l))
  assert.notEqual(r.status, 0, '음성 대조가 통과하면 울타리가 없다')
  const at = new Set(errors.map((e) => Number(e.match(/ports-neg\.ts\((\d+),\d+\)/)?.[1])))
  assert.deepEqual([...at].sort((a, b) => a - b), [...expected].sort((a, b) => a - b), errors.join('\n'))
})

// ② 결제 목 ───────────────────────────────────────────────────────────────
test('mockBilling: ?sub= makes all 7 subscription states (default none); an unknown value lists the allowed ones', async () => {
  assert.equal(mock.MOCK_SUBS.length, 7)
  for (const s of mock.MOCK_SUBS) {
    const r = await mock.mockBilling(`?sub=${s}`).subscription()
    assert.equal(r.ok, true, s)
    assert.equal(r.data.status, s)
    if (s === 'none') assert.equal(r.data.planId, null)
    else assert.equal(typeof r.data.planId, 'string', s)
  }
  assert.equal((await mock.mockBilling('').subscription()).data.status, 'none')
  assert.ok((await mock.mockBilling('?sub=past_due').subscription()).data.paymentIssue?.reason)
  assert.ok((await mock.mockBilling('?sub=trialing').subscription()).data.trialEnd)
  assert.ok((await mock.mockBilling('?sub=paused').subscription()).data.pausedUntil)
  assert.ok((await mock.mockBilling('https://x.test/qa/blocks?b=a&sub=active').subscription()).data.currentPeriodEnd)
  assert.throws(() => mock.mockBilling('?sub=gold'), /sub=gold.*none\|trialing\|active\|past_due\|paused\|canceled\|expired\|pending-price-change/)
})

// ②-1 가격 변경 동의(L6 — 무료→유료·가격 인상은 명시 동의, 무응답은 동의가 아니다) ─────────────────
test('mockBilling ?sub=pending-price-change: an active plan with a pending price increase inside 30 days; acceptPriceChange clears it; nothing pending → Korean formError', async () => {
  assert.deepEqual([...mock.MOCK_SUB_SCENARIOS], ['pending-price-change'])
  const b = mock.mockBilling('?sub=pending-price-change')
  const s = (await b.subscription()).data
  assert.equal(s.status, 'active')
  const pc = s.pendingPriceChange
  assert.ok(pc, 'pendingPriceChange')
  assert.equal(pc.kind, 'price_increase')
  for (const m of [pc.from, pc.to]) assert.ok(Number.isInteger(m.amount) && m.currency === 'KRW' && m.vatIncluded === true, JSON.stringify(m))
  assert.ok(pc.to.amount > pc.from.amount)
  const t = (d) => Date.parse(d)
  assert.ok(t(mock.MOCK_NOW) < t(pc.consentBy) && t(pc.consentBy) < t(pc.effectiveAt), '동의 기한은 지금과 적용일 사이')
  assert.ok(t(pc.effectiveAt) - t(mock.MOCK_NOW) <= 30 * 864e5, '청구 30일 전 안에 묻는다(L6)')
  // 서버 오류면 상태를 건드리지 않는다.
  const err = mock.mockBilling('?sub=pending-price-change&submit=server-error')
  assert.equal((await err.acceptPriceChange()).ok, false)
  assert.ok((await err.subscription()).data.pendingPriceChange)
  // 동의하면 예정된 변경이 사라지고(새 가격으로 이어 간다), 구독 상태는 그대로다.
  const a = await b.acceptPriceChange()
  assert.equal(a.ok, true)
  assert.equal(a.data.pendingPriceChange, undefined)
  assert.equal(a.data.status, 'active')
  assert.equal((await b.subscription()).data.pendingPriceChange, undefined)
  // 동의할 것이 없으면 한국어 오류(두 번째 동의 포함).
  for (const x of [b, mock.mockBilling('?sub=active')]) {
    const r = await x.acceptPriceChange()
    assert.equal(r.ok, false)
    assert.match(r.formError, HANGUL)
  }
  // 무료→유료 전환은 options.subscription 으로 덮어 그린다.
  const trial = mock.mockBilling('?sub=trialing', { subscription: { pendingPriceChange: { ...pc, kind: 'trial_to_paid', from: { ...pc.from, amount: 0 } } } })
  assert.equal((await trial.subscription()).data.pendingPriceChange.kind, 'trial_to_paid')
})

// ②-2 해지 대안(R2 — 일시정지 → 다운그레이드 → 할인 순, 할인은 30% 이하·2~3개월) ─────────────────────
test('retentionOfferIssues (lib retention-offer): discount ≤ 30% for 2–3 months, integers; each kind carries its own field; messages in Korean', () => {
  const ok = (o) => assert.deepEqual(offerLib.retentionOfferIssues(o), [], JSON.stringify(o))
  const bad = (o) => { const v = offerLib.retentionOfferIssues(o); assert.ok(v.length >= 1, JSON.stringify(o)); for (const m of v) assert.match(m, HANGUL) }
  assert.equal(offerLib.RETENTION_DISCOUNT_MAX_PERCENT, 30)
  assert.deepEqual([...offerLib.RETENTION_DISCOUNT_MONTHS], [2, 3])
  ok({ id: 'd', kind: 'discount', discount: { percent: 30, months: 3 } })
  ok({ id: 'd', kind: 'discount', discount: { percent: 10, months: 2 } })
  ok({ id: 'p', kind: 'pause', pauseMonths: 1 })
  ok({ id: 'g', kind: 'downgrade', planId: 'basic' })
  bad({ id: 'd', kind: 'discount', discount: { percent: 31, months: 3 } }) // 30% 초과
  bad({ id: 'd', kind: 'discount', discount: { percent: 50, months: 2 } })
  bad({ id: 'd', kind: 'discount', discount: { percent: 0, months: 2 } })
  bad({ id: 'd', kind: 'discount', discount: { percent: 20.5, months: 2 } })
  bad({ id: 'd', kind: 'discount', discount: { percent: 20, months: 1 } }) // 2~3개월 밖
  bad({ id: 'd', kind: 'discount', discount: { percent: 20, months: 4 } })
  bad({ id: 'd', kind: 'discount' })
  bad({ id: 'p', kind: 'pause' })
  bad({ id: 'p', kind: 'pause', pauseMonths: 0 })
  bad({ id: 'g', kind: 'downgrade' })
  bad({ id: '', kind: 'pause', pauseMonths: 1 })
})

test('mockBilling.applyRetentionOffer: default offers are pause → downgrade → discount and pass the R2 cap; accepting withdraws a scheduled cancel; unknown offer → Korean formError; invalid custom offers stop at setup', async () => {
  assert.deepEqual(mock.MOCK_RETENTION_OFFERS.map((o) => o.kind), ['pause', 'downgrade', 'discount'])
  for (const o of mock.MOCK_RETENTION_OFFERS) assert.deepEqual(offerLib.retentionOfferIssues(o), [], o.id)
  const [pause, down, disc] = mock.MOCK_RETENTION_OFFERS
  const cancelled = async () => { const b = mock.mockBilling('?sub=active'); await b.cancel({ when: 'period_end' }); return b }
  const p = await (await cancelled()).applyRetentionOffer({ offerId: pause.id })
  assert.equal(p.data.status, 'paused')
  assert.equal(p.data.cancelAt, undefined)
  const until = new Date(mock.MOCK_NOW); until.setUTCMonth(until.getUTCMonth() + pause.pauseMonths)
  assert.equal(p.data.pausedUntil, until.toISOString())
  const g = await (await cancelled()).applyRetentionOffer({ offerId: down.id })
  assert.deepEqual([g.data.status, g.data.scheduledPlanId, g.data.cancelAt], ['active', down.planId, undefined])
  const b = await cancelled()
  const d = await b.applyRetentionOffer({ offerId: disc.id })
  assert.deepEqual([d.ok, d.data.status, d.data.planId, d.data.cancelAt], [true, 'active', 'pro', undefined])
  assert.equal((await b.subscription()).data.cancelAt, undefined)
  const unknown = await mock.mockBilling('?sub=active').applyRetentionOffer({ offerId: 'nope' })
  assert.equal(unknown.ok, false)
  assert.match(unknown.formError, HANGUL)
  const none = await mock.mockBilling('?sub=none').applyRetentionOffer({ offerId: pause.id })
  assert.equal(none.ok, false)
  assert.throws(() => mock.mockBilling('?sub=active', { retentionOffers: [{ id: 'big', kind: 'discount', discount: { percent: 50, months: 3 } }] }), /big.*30%/)
  // ?submit= 은 상태를 건드리지 않는다.
  const e = mock.mockBilling('?sub=active&submit=server-error')
  assert.equal((await e.applyRetentionOffer({ offerId: pause.id })).ok, false)
  assert.equal((await e.subscription()).data.status, 'active')
})

test('mockBilling: plans are KRW integers with VAT included; state=empty → [], state=error → retryable Korean formError, state=loading never settles', async () => {
  const plans = (await mock.mockBilling('').plans()).data
  assert.ok(plans.length >= 2)
  for (const p of plans) {
    assert.ok(Number.isInteger(p.price.amount) && p.price.amount > 0, p.id)
    assert.equal(p.price.currency, 'KRW')
    assert.equal(p.price.vatIncluded, true)
    assert.match(p.name, /예시/)
  }
  assert.deepEqual((await mock.mockBilling('?state=empty').plans()).data, [])
  const e = await mock.mockBilling('?state=error').plans()
  assert.equal(e.ok, false)
  assert.equal(e.retryable, true)
  assert.match(e.formError, HANGUL)
  assert.equal(await settles(mock.mockBilling('?state=loading').plans()), false)
})

test('mockBilling: writes change the instance state — cancel at period end keeps access, now ends it; pause/resume; plan change now vs period end; checkout starts a trial', async () => {
  const b = mock.mockBilling('?sub=active')
  const before = (await b.subscription()).data
  const c = await b.cancel({ reason: 'too_expensive', when: 'period_end' })
  assert.equal(c.data.status, 'active')
  assert.equal(c.data.cancelAt, before.currentPeriodEnd)
  const r = await b.resume()
  assert.equal(r.data.status, 'active')
  assert.equal(r.data.cancelAt, undefined, 'resume 는 예약된 해지도 거둔다')
  const p = await b.pause({ until: '2026-12-01T00:00:00.000Z' })
  assert.deepEqual([p.data.status, p.data.pausedUntil], ['paused', '2026-12-01T00:00:00.000Z'])
  assert.equal((await b.resume()).data.status, 'active')
  const later = await b.changePlan({ planId: 'basic', when: 'period_end' })
  assert.deepEqual([later.data.planId, later.data.scheduledPlanId], [before.planId, 'basic'])
  const now = await b.changePlan({ planId: 'basic', when: 'now' })
  assert.deepEqual([now.data.planId, now.data.scheduledPlanId], ['basic', undefined])
  assert.equal((await b.cancel({ when: 'now' })).data.status, 'canceled')
  assert.equal((await b.subscription()).data.status, 'canceled')
  const fresh = mock.mockBilling('?sub=none')
  const t = await fresh.checkout({ planId: 'pro' })
  assert.equal(t.data.subscription.status, 'trialing')
  assert.ok(t.data.subscription.trialEnd)
  const bad = await fresh.checkout({ planId: 'nope' })
  assert.equal(bad.ok, false)
  assert.match(bad.formError, HANGUL)
  const u = await mock.mockBilling('?sub=past_due').updatePaymentMethod()
  assert.equal(typeof u.data.redirectUrl, 'string')
})

test('mockBilling: ?submit= forces write outcomes (server-error retryable, field-error, pending) without touching the state', async () => {
  const b = mock.mockBilling('?sub=active&submit=server-error')
  const r = await b.cancel({ when: 'now' })
  assert.equal(r.ok, false)
  assert.equal(r.retryable, true)
  assert.equal((await b.subscription()).data.status, 'active')
  assert.ok((await mock.mockBilling('?sub=active&submit=field-error').pause({ until: '2026-12-01' })).fieldErrors)
  assert.equal(await settles(mock.mockBilling('?sub=active&submit=pending').resume()), false)
})

// ③ 인증 목 ───────────────────────────────────────────────────────────────
test('mockAuth: ?auth=signed-out|signed-in|two-factor (default signed-out); two-factor sign-in asks for a code, then verifyTwoFactor opens a 2FA session', async () => {
  assert.deepEqual([...mock.MOCK_AUTHS], ['signed-out', 'signed-in', 'two-factor'])
  assert.equal((await mock.mockAuth('').session()).data, null)
  assert.equal((await mock.mockAuth('?auth=signed-out').session()).data, null)
  const s = (await mock.mockAuth('?auth=signed-in').session()).data
  assert.equal(s.twoFactor, false)
  assert.equal(typeof s.userId, 'string')
  const a = mock.mockAuth('?auth=two-factor')
  assert.equal((await a.session()).data, null)
  const si = await a.signIn({ method: 'password', email: 'kim@example.com', password: 'example-pass' })
  assert.equal(si.data.needsTwoFactor, true)
  const v = await a.verifyTwoFactor({ code: '123456' })
  assert.equal(v.data.twoFactor, true)
  assert.equal((await a.session()).data.twoFactor, true)
  const bad = await mock.mockAuth('?auth=two-factor').verifyTwoFactor({ code: '12' })
  assert.equal(bad.ok, false)
  assert.throws(() => mock.mockAuth('?auth=maybe'), /auth=maybe.*signed-out\|signed-in\|two-factor/)
})

test('mockAuth: social sign-in redirects, magic link sends an email, password reset never reveals whether the account exists, sign-out clears the session', async () => {
  const a = mock.mockAuth('?auth=signed-in')
  assert.deepEqual((await a.methods()).data, ['password', 'kakao', 'naver', 'google'])
  for (const m of ['kakao', 'naver', 'google']) assert.equal(typeof (await a.signIn({ method: m })).data.redirectUrl, 'string', m)
  assert.equal((await a.signIn({ method: 'magic-link', email: 'kim@example.com' })).data.emailSent, true)
  assert.deepEqual((await a.requestPasswordReset({ email: 'nobody@example.com' })).data, { sent: true })
  assert.equal((await a.signOut()).ok, true)
  assert.equal((await a.session()).data, null)
  const missing = await mock.mockAuth('').signIn({ method: 'password' })
  assert.equal(missing.ok, false)
  assert.ok(missing.fieldErrors?.email)
})

test('mockAuth.signUp rejects a call without the required terms/privacy consents (JS callers bypass the type) and accepts optional marketing left out', async () => {
  const a = mock.mockAuth('')
  const noTerms = await a.signUp({ method: 'password', email: 'kim@example.com', password: 'example-pass', consents: { terms: false, privacy: true } })
  assert.equal(noTerms.ok, false)
  assert.ok(noTerms.fieldErrors?.terms)
  for (const m of noTerms.fieldErrors.terms) assert.match(m, HANGUL)
  const noPrivacy = await a.signUp({ method: 'password', email: 'kim@example.com', password: 'example-pass', consents: { terms: true } })
  assert.ok(noPrivacy.fieldErrors?.privacy)
  const ok = await a.signUp({ method: 'password', email: 'kim@example.com', password: 'example-pass', consents: { terms: true, privacy: true } })
  assert.equal(ok.ok, true)
  assert.equal((await a.session()).data?.twoFactor, false)
})

// ④ 계측·알림·파일 목 ─────────────────────────────────────────────────────
test('mockAnalytics: with consent false nothing is recorded; ?consent=unset|denied|analytics|all; setConsent turns recording on', () => {
  assert.deepEqual([...mock.MOCK_CONSENTS], ['unset', 'denied', 'analytics', 'all'])
  const unset = mock.mockAnalytics('')
  assert.deepEqual(unset.consent(), { analytics: false, marketing: false })
  unset.track('page_view', { path: '/pricing' })
  assert.equal(unset.events.length, 0)
  const denied = mock.mockAnalytics('?consent=denied')
  assert.equal(denied.consent().analytics, false)
  assert.equal(typeof denied.consent().decidedAt, 'string')
  denied.track('cta_click', { id: 'a', label: 'b', section: 'c' })
  assert.equal(denied.events.length, 0)
  unset.setConsent({ analytics: true, marketing: false })
  unset.track('cta_click', { id: 'hero-primary', label: '시작하기(예시)', section: 'hero' })
  assert.deepEqual(unset.events, [{ name: 'cta_click', props: { id: 'hero-primary', label: '시작하기(예시)', section: 'hero' } }])
  assert.equal(typeof unset.consent().decidedAt, 'string')
  const all = mock.mockAnalytics('?consent=all')
  assert.deepEqual([all.consent().analytics, all.consent().marketing], [true, true])
  all.track('resume', {})
  assert.equal(all.events.length, 1)
  assert.equal(mock.mockAnalytics('?consent=analytics').consent().marketing, false)
  assert.throws(() => mock.mockAnalytics('?consent=yes'), /consent=yes/)
})

test('mockNotify: marketing channels default to false (no pre-selection); ?consent=all turns them on; setConsents merges and stamps updatedAt', async () => {
  const n = mock.mockNotify('')
  assert.deepEqual((await n.consents()).data, { email: false, sms: false, kakao: false, push: false })
  const r = await n.setConsents({ sms: true })
  assert.equal(typeof r.data.updatedAt, 'string')
  const after = (await n.consents()).data
  assert.deepEqual([after.email, after.sms, after.kakao, after.push], [false, true, false, false])
  assert.equal(after.updatedAt, r.data.updatedAt)
  const all = (await mock.mockNotify('?consent=all').consents()).data
  assert.deepEqual([all.email, all.sms, all.kakao, all.push], [true, true, true, true])
})

test('mockStorage: upload returns a url and key per kind; empty files and ?submit=server-error fail', async () => {
  const s = mock.mockStorage('')
  const r = await s.upload(new Blob(['x']), { kind: 'avatar' })
  assert.equal(r.ok, true)
  assert.match(r.data.key, /avatar/)
  assert.equal(typeof r.data.url, 'string')
  const r2 = await s.upload(new Blob(['y']), { kind: 'avatar' })
  assert.notEqual(r2.data.key, r.data.key)
  assert.equal((await s.upload(new Blob([]), { kind: 'image' })).ok, false)
  assert.equal((await mock.mockStorage('?submit=server-error').upload(new Blob(['x']), { kind: 'attachment' })).retryable, true)
})

test('port mocks use no timer unless a delay is given; &delay= is honoured', async () => {
  const saved = globalThis.setTimeout
  globalThis.setTimeout = () => { throw new Error('timer used') }
  try {
    assert.ok((await mock.mockBilling('?sub=active').cancel({ when: 'now' })).ok)
    assert.ok((await mock.mockAuth('?auth=signed-in').session()).ok)
    assert.ok((await mock.mockStorage('').upload(new Blob(['x']), { kind: 'image' })).ok)
  } finally { globalThis.setTimeout = saved }
  const t0 = performance.now()
  await mock.mockBilling('?sub=active&delay=30').resume()
  assert.ok(performance.now() - t0 >= 25, 'delay 가 적용되지 않았다')
})

// ⑤ 정적 결제 링크 ─────────────────────────────────────────────────────────
test('hostedCheckoutLink accepts only https links (developer error in Korean at setup) and returns the link as redirectUrl', async () => {
  for (const bad of ['http://pay.example.com/x', 'javascript:alert(1)', '/checkout', 'pay.example.com', 'https://user:pw@pay.example.com/x', '', { pro: 'http://x.test' }, {}])
    assert.throws(() => stat.hostedCheckoutLink(bad), /hostedCheckoutLink: .*[가-힣]/, JSON.stringify(bad))
  const one = stat.hostedCheckoutLink(' https://pay.example.com/l/abc ')
  assert.deepEqual(await one({ planId: 'anything' }), { ok: true, data: { redirectUrl: 'https://pay.example.com/l/abc' } })
})

test('hostedCheckoutLink with a per-plan map: known plan → its link; unknown or inherited key → Korean formError; never rejects; no network', async () => {
  const saved = globalThis.fetch
  globalThis.fetch = () => { throw new Error('network used') }
  try {
    const port = stat.hostedCheckoutLink({ basic: 'https://pay.example.com/basic', pro: 'https://pay.example.com/pro' })
    assert.equal((await port({ planId: 'pro' })).data.redirectUrl, 'https://pay.example.com/pro')
    for (const id of ['team', 'toString', '__proto__']) {
      const r = await port({ planId: id })
      assert.equal(r.ok, false, id)
      assert.match(r.formError, HANGUL)
    }
    assert.equal((await port(undefined)).ok, false)
  } finally { globalThis.fetch = saved }
  assert.doesNotMatch(readFileSync(join(DIR, 'adapter-static.ts'), 'utf8'), /\bfetch\s*\(|XMLHttpRequest|sendBeacon/)
})

// ⑥ 등록 ─────────────────────────────────────────────────────────────────
test('gen-registry: contract layer adds ports and events (registry:lib under @components/contract, no npm deps); ports → block-contract + events; blocks importing them depend on those items', () => {
  const items = buildItems(DIR, 'contract', REPO, DIR, 'v9.9.9', { zod: '^4.6.5' })
  const by = Object.fromEntries(items.map((i) => [i.name, i]))
  for (const n of ['ports', 'events']) {
    assert.ok(by[n], n)
    assert.equal(by[n].type, 'registry:lib')
    assert.deepEqual(by[n].files, [{ path: `${n}.ts`, type: 'registry:lib', target: `@components/contract/${n}.ts` }])
    assert.deepEqual(by[n].dependencies, [])
  }
  assert.deepEqual(by.ports.registryDependencies, [`${REPO}/block-contract#v9.9.9`, `${REPO}/events#v9.9.9`])
  assert.deepEqual(by.events.registryDependencies, [])
  const gen = JSON.parse(readFileSync(join(DIR, 'registry.json'), 'utf8'))
  assert.deepEqual(gen.items.map((i) => i.name).filter((n) => n === 'ports' || n === 'events').sort(), ['events', 'ports'])
  const src = 'import type { BillingPort } from "@/registry/factory/contract/ports"\nimport type { EventName } from "@/registry/factory/contract/events"\n'
  assert.deepEqual(blockDeps(src).registry, ['events', 'ports'])
})
