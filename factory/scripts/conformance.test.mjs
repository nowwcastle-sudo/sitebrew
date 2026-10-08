// 어댑터 적합성 묶음(P3-3 Task 15, 접합면 J3): 목 어댑터가 자기 묶음을 통과하고(자기 일관성), 일부러 틀린 목은 정해진 검사 id 에서 떨어진다(음성 대조).
// 묶음은 프레임워크 중립이다 — 여기서 node:test 로 돌리지만 launch-factory 는 같은 함수를 어느 실행기로도 부른다.
// 실행: node --test --test-force-exit --test-timeout=60000 "factory/scripts/*.test.mjs"
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'
import { buildItems } from './gen-registry.mjs'
import { buildItems as closureItems, checkItem } from './install-closure.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const DIR = join(root, 'registry', 'factory', 'contract')
const CONF = join(DIR, 'conformance')
const OUT = join(root, '.tmp', 'conformance-test')
const REPO = 'nowwcastle-sudo/sitebrew'
const js = (src) => ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText

// 원천 .ts → .tmp/conformance-test/<이름>.mjs. 계약끼리의 import 는 타입만이라 사라지고, lib 값 import 는 파일 주소로,
// 묶음 안 상대 import(./x)는 ./x.mjs 로 잇는다.
function transpile(file, name) {
  mkdirSync(OUT, { recursive: true })
  const out = js(readFileSync(file, 'utf8'))
    .replace(/(from\s+)(["'])@\/registry\/factory\/lib\/([a-z-]+)\2/g, (_, kw, q, lib) =>
      `${kw}${q}${pathToFileURL(transpile(join(root, 'registry', 'factory', 'lib', `${lib}.ts`), `lib-${lib}`)).href}${q}`)
    .replace(/(from\s+)(["'])\.\/([a-z-]+)\2/g, (_, kw, q, m) => `${kw}${q}./conf-${m}.mjs${q}`)
  assert.doesNotMatch(out, /@\/registry\//, `${name}: 변환본에 계약 경로 import 가 남았다(타입 import 여야 한다)`)
  const path = join(OUT, `${name}.mjs`)
  writeFileSync(path, out)
  return path
}
const CONF_FILES = readdirSync(CONF).filter((f) => f.endsWith('.ts')).sort()
for (const f of CONF_FILES) transpile(join(CONF, f), `conf-${f.replace(/\.ts$/, '')}`)
const conf = async (name) => import(pathToFileURL(join(OUT, `conf-${name}.mjs`)).href)
const mock = await import(pathToFileURL(transpile(join(DIR, 'adapter-mock.ts'), 'adapter-mock')).href)
const events = await import(pathToFileURL(transpile(join(DIR, 'events.ts'), 'events')).href)
const { billingConformance, BILLING_SCENARIO_IDS } = await conf('billing')
const { authConformance, AUTH_SCENARIO_IDS } = await conf('auth')
const { notifyConformance, NOTIFY_CHANNELS } = await conf('notify')
const { analyticsConformance, SAMPLE_EVENTS, piiPaths } = await conf('analytics')
const { runCheck, failures } = await conf('conformance-core')

// 목 어댑터를 묶음의 make 로(launch-factory 는 여기에 실제 어댑터를 끼운다).
const mockMakers = {
  billing: ({ sub, retentionOffers }) => mock.mockBilling(`?sub=${sub}`, retentionOffers ? { retentionOffers } : {}),
  auth: ({ auth }) => (auth === 'error' ? mock.mockAuth('?state=error') : mock.mockAuth(`?auth=${auth}`)),
  notify: () => mock.mockNotify(''),
  analytics: ({ consent }) => {
    const port = mock.mockAnalytics(`?consent=${consent}`)
    return { port, sent: () => port.events }
  },
}
const failedIds = (results) => failures(results).map((r) => r.id).sort()
const explain = (results) => failures(results).map((r) => `${r.id}: ${r.message}`).join('\n')

// ① 시나리오 표가 목과 같다 ──────────────────────────────────────────────────
test('scenario tables mirror adapter-mock: ?sub= 7 states + pending-price-change, ?auth= modes, notify channels, one sample per event name', () => {
  assert.deepEqual([...BILLING_SCENARIO_IDS], [...mock.MOCK_SUBS, ...mock.MOCK_SUB_SCENARIOS])
  for (const a of AUTH_SCENARIO_IDS.filter((a) => a !== 'error')) assert.ok(mock.MOCK_AUTHS.includes(a), a)
  assert.deepEqual([...NOTIFY_CHANNELS].sort(), ['email', 'kakao', 'push', 'sms'])
  assert.deepEqual(Object.keys(SAMPLE_EVENTS).sort(), [...events.EVENTS].sort())
})

// ② 자기 일관성: 목은 자기 묶음을 모두 통과한다 ─────────────────────────────
test('the mock passes its own conformance suite — billing, auth, notify, analytics — with unique ids', async () => {
  const all = {
    billing: await billingConformance(mockMakers.billing),
    auth: await authConformance(mockMakers.auth),
    notify: await notifyConformance(mockMakers.notify),
    analytics: await analyticsConformance(mockMakers.analytics),
  }
  for (const [port, results] of Object.entries(all)) {
    assert.deepEqual(failedIds(results), [], `${port}\n${explain(results)}`)
    for (const r of results) {
      assert.equal(typeof r.id, 'string')
      assert.ok(r.id.startsWith(`${port}.`), r.id)
      assert.equal(r.ok, true)
      assert.equal(typeof r.message, 'string')
    }
  }
  const ids = Object.values(all).flat().map((r) => r.id)
  assert.equal(new Set(ids).size, ids.length, '검사 id 가 겹친다')
  // 브리프가 요구한 경우가 모두 묶음에 있다
  for (const id of [
    ...BILLING_SCENARIO_IDS.map((s) => `billing.state.${s}`),
    'billing.price-change.accept', 'billing.retention.refuse.conf-discount-40-3m', 'billing.retention.refuse.conf-discount-30-1m', 'billing.retention.refuse.conf-discount-30-4m',
    'billing.cancel.parity.trial-signup', 'billing.cancel.parity.paid-signup', 'billing.cancel.active.now', 'billing.cancel.none.refused',
    'billing.trial.trial-on', 'billing.trial.trial-off', 'billing.trial.trial-unavailable',
    'auth.signed-in.session', 'auth.signed-out.session', 'auth.error.session', 'auth.signed-out.reset-password-unknown-token', 'auth.signed-out.reset-password-empty-token',
    'notify.consents.default-false', 'notify.set-consents.partial',
    'analytics.track.dropped-without-consent', 'analytics.meta.attribution-passthrough', ...events.EVENTS.map((e) => `analytics.props.no-pii.${e}`),
  ]) assert.ok(ids.includes(id), `묶음에 ${id} 가 없다`)
  // 검사 수(표가 늘면 여기도 고친다): billing 요금제 짝 1 + 장면 8 + 해지 11 + 대칭 2 + 체험 5 + 가격 변경 3 + 해지 대안 10
  assert.deepEqual(Object.fromEntries(Object.entries(all).map(([k, v]) => [k, v.length])), { billing: 40, auth: 9, notify: 4, analytics: 6 + events.EVENTS.length })
})

// ③ 음성 대조: 일부러 틀린 목은 정해진 id 에서만 떨어진다 ─────────────────────
test('negative control: a notify mock that keeps pre-selected marketing consent fails notify.consents.default-false only', async () => {
  const preselected = () => mock.mockNotify('?consent=all')
  assert.deepEqual(failedIds(await notifyConformance(preselected)), ['notify.consents.default-false'])
})

test('negative control: an analytics mock whose consent starts with marketing pre-selected fails analytics.consent.default-false only', async () => {
  const make = ({ consent }) => {
    const port = mock.mockAnalytics(`?consent=${consent}`)
    return { port: { ...port, track: port.track, consent: () => (consent === 'unset' ? { ...port.consent(), marketing: true } : port.consent()) }, sent: () => port.events }
  }
  assert.deepEqual(failedIds(await analyticsConformance(make)), ['analytics.consent.default-false'])
})

test('negative control: an analytics mock that ignores consent in track fails the two dropped-* checks only', async () => {
  const make = ({ consent }) => {
    const recorder = mock.mockAnalytics('?consent=all') // 동의를 보지 않고 늘 기록한다
    const state = mock.mockAnalytics(`?consent=${consent}`)
    return { port: { track: recorder.track, consent: state.consent, setConsent: state.setConsent }, sent: () => recorder.events }
  }
  assert.deepEqual(failedIds(await analyticsConformance(make)), ['analytics.track.dropped-after-withdrawal', 'analytics.track.dropped-without-consent'])
})

test('negative control: an analytics adapter that adds the user email to props fails every analytics.props.no-pii.<event> and nothing else', async () => {
  const make = ({ consent }) => {
    const port = mock.mockAnalytics(`?consent=${consent}`)
    return { port: { ...port, track: (name, props, meta) => port.track(name, { ...props, userEmail: mock.MOCK_SESSION.email }, meta) }, sent: () => port.events }
  }
  assert.deepEqual(failedIds(await analyticsConformance(make)), events.EVENTS.map((e) => `analytics.props.no-pii.${e}`).sort())
})

test('negative control: a billing mock without trial_unavailable (trial: true on a plan without trialDays starts a trial) fails billing.trial.trial-unavailable only', async () => {
  const make = (setup) => {
    const port = mockMakers.billing(setup)
    // 10c 이전 동작: trial: true 면 체험 기간이 없는 요금제도 체험으로 시작한다
    const checkout = async ({ planId, trial }) => {
      if (trial !== true) return port.checkout(trial === undefined ? { planId } : { planId, trial })
      const r = await port.checkout({ planId, trial: false })
      return r.ok ? { ok: true, data: { subscription: { ...r.data.subscription, status: 'trialing', trialEnd: r.data.subscription.currentPeriodEnd } } } : r
    }
    return { ...port, checkout }
  }
  assert.deepEqual(failedIds(await billingConformance(make)), ['billing.trial.trial-unavailable'])
})

test('negative control: a billing adapter that quietly clamps over-limit retention discounts (instead of refusing) fails the three billing.retention.refuse.* checks only', async () => {
  const clamp = (o) => (o.kind === 'discount' ? { ...o, discount: { percent: Math.min(o.discount.percent, 30), months: 3 } } : o)
  const make = ({ sub, retentionOffers }) => mockMakers.billing({ sub, retentionOffers: retentionOffers?.map(clamp) })
  assert.deepEqual(failedIds(await billingConformance(make)), ['billing.retention.refuse.conf-discount-30-1m', 'billing.retention.refuse.conf-discount-30-4m', 'billing.retention.refuse.conf-discount-40-3m'])
})

test('negative control: an auth adapter whose error scenario still answers fails auth.error.session only', async () => {
  const make = ({ auth }) => mock.mockAuth(`?auth=${auth === 'error' ? 'signed-out' : auth}`)
  assert.deepEqual(failedIds(await authConformance(make)), ['auth.error.session'])
})

// ③b 승인 행동 확인 입력(G11(d), P3-7 AXC) — options.requireConfirmation 인 어댑터만 받는다 ───────────────────────
const confirmMakers = {
  billing: ({ sub, retentionOffers }) => mock.mockBilling(`?sub=${sub}`, { requireConfirmation: true, ...(retentionOffers ? { retentionOffers } : {}) }),
  auth: ({ auth }) => (auth === 'error' ? mock.mockAuth('?state=error') : mock.mockAuth(`?auth=${auth}`, { requireConfirmation: true })),
  notify: () => mock.mockNotify('', { requireConfirmation: true }),
}
const CONFIRM_IDS = {
  billing: ['billing.confirmation.change-plan', 'billing.confirmation.cancel', 'billing.confirmation.apply-retention-offer', 'billing.confirmation.accept-price-change'],
  auth: ['auth.confirmation.change-email', 'auth.confirmation.delete-account', 'auth.confirmation.export-my-data'],
  notify: ['notify.confirmation.set-consents'],
}

test('confirmation checks run only when options.requireConfirmation is set — the default suite is unchanged (existing adapters keep passing)', async () => {
  for (const [port, run] of [['billing', billingConformance], ['auth', authConformance], ['notify', notifyConformance]]) {
    const off = await run(mockMakers[port])
    assert.equal(off.some((r) => r.id.includes('.confirmation.')), false, `${port}: 옵션이 없는데 확인 검사가 돌았다`)
    assert.deepEqual(failedIds(off), [], `${port}\n${explain(off)}`)
  }
})

test('a mock with requireConfirmation passes its own suite with requireConfirmation on: old checks auto-confirm, the new checks pass (positive control)', async () => {
  const opts = { requireConfirmation: true }
  const all = { billing: await billingConformance(confirmMakers.billing, opts), auth: await authConformance(confirmMakers.auth, opts), notify: await notifyConformance(confirmMakers.notify, opts) }
  for (const [port, results] of Object.entries(all)) {
    assert.deepEqual(failedIds(results), [], `${port}\n${explain(results)}`)
    const ids = results.map((r) => r.id)
    assert.equal(new Set(ids).size, ids.length, `${port}: 검사 id 가 겹친다`)
    for (const id of CONFIRM_IDS[port]) assert.ok(ids.includes(id), `${id} 가 묶음에 없다`)
  }
  assert.deepEqual(Object.fromEntries(Object.entries(all).map(([k, v]) => [k, v.length])), { billing: 44, auth: 12, notify: 5 })
})

test('negative control: an adapter that does not require confirmation fails every *.confirmation.* check (and only those) when requireConfirmation is on', async () => {
  const opts = { requireConfirmation: true }
  assert.deepEqual(failedIds(await billingConformance(mockMakers.billing, opts)), [...CONFIRM_IDS.billing].sort())
  assert.deepEqual(failedIds(await authConformance(mockMakers.auth, opts)), [...CONFIRM_IDS.auth].sort())
  assert.deepEqual(failedIds(await notifyConformance(mockMakers.notify, opts)), [...CONFIRM_IDS.notify].sort())
})

test('negative control: refusing with the right code but changing state first fails only that confirmation check (billing.cancel · notify.setConsents · auth.deleteAccount)', async () => {
  // 확인을 요구하는 척하는 어댑터: 모든 승인 행동을 문 앞에서 거절하지만 sloppy 로 고른 메서드는 거절하기 전에 상태를 먼저 바꿔 버린다
  const refusal = { ok: false, code: 'confirmation_required', retryable: false, formError: 'x', fieldErrors: { confirmed: ['x'] } }
  const gateAll = (inner, methods, sloppy = {}) => ({
    ...inner,
    ...Object.fromEntries(methods.map((m) => [m, async (input) => (input?.confirmed === true ? inner[m](input) : (await sloppy[m]?.(inner, input), refusal))])),
  })
  const billing = ({ sub, retentionOffers }) => gateAll(mock.mockBilling(`?sub=${sub}`, retentionOffers ? { retentionOffers } : {}), ['changePlan', 'cancel', 'applyRetentionOffer', 'acceptPriceChange'], { cancel: (inner) => inner.cancel({ when: 'period_end' }) })
  const notify = () => gateAll(mock.mockNotify(''), ['setConsents'], { setConsents: (inner) => inner.setConsents({ email: true }) })
  const auth = ({ auth }) => gateAll(auth === 'error' ? mock.mockAuth('?state=error') : mock.mockAuth(`?auth=${auth}`), ['changeEmail', 'deleteAccount', 'exportMyData'], { deleteAccount: (inner) => inner.signOut() })
  const opts = { requireConfirmation: true }
  assert.deepEqual(failedIds(await billingConformance(billing, opts)), ['billing.confirmation.cancel'])
  assert.deepEqual(failedIds(await notifyConformance(notify, opts)), ['notify.confirmation.set-consents'])
  assert.deepEqual(failedIds(await authConformance(auth, opts)), ['auth.confirmation.delete-account'])
})

test('negative control: a wrong refusal shape (code approval_required, or retryable true) fails the confirmation check — the judge reads confirmation_required + retryable:false only', async () => {
  const wrongCode = () => {
    const gated = mock.mockNotify('', { requireConfirmation: true })
    return { ...gated, setConsents: async (input) => { const r = await gated.setConsents(input); return r.ok ? r : { ...r, code: 'approval_required' } } }
  }
  const retryable = () => {
    const gated = mock.mockNotify('', { requireConfirmation: true })
    return { ...gated, setConsents: async (input) => { const r = await gated.setConsents(input); return r.ok ? r : { ...r, retryable: true } } }
  }
  const opts = { requireConfirmation: true }
  assert.deepEqual(failedIds(await notifyConformance(wrongCode, opts)), ['notify.confirmation.set-consents'])
  assert.deepEqual(failedIds(await notifyConformance(retryable, opts)), ['notify.confirmation.set-consents'])
})

test('autoConfirmed adds confirmed: true to approval methods only and keeps this; confirmationProblem reads ok/code/retryable', async () => {
  const { autoConfirmed, confirmationProblem, CONFIRMED_METHODS } = await conf('conformance-core')
  const seen = []
  const port = { setConsents: async function (i) { seen.push(['setConsents', i, this === port]); return { ok: true, data: {} } }, consents: async (i) => { seen.push(['consents', i]); return { ok: true, data: {} } } }
  const wrapped = autoConfirmed(port, CONFIRMED_METHODS.notify)
  await wrapped.setConsents({ email: true })
  await wrapped.consents()
  assert.deepEqual(seen, [['setConsents', { email: true, confirmed: true }, true], ['consents', undefined]])
  assert.equal(confirmationProblem({ ok: false, code: 'confirmation_required', retryable: false }), null)
  assert.match(confirmationProblem({ ok: true }), /성공/)
  assert.match(confirmationProblem({ ok: false, code: 'action_failed', retryable: false }), /confirmation_required/)
  assert.match(confirmationProblem({ ok: false, code: 'confirmation_required' }), /retryable: false/)
})

// ④ 도구 ───────────────────────────────────────────────────────────────────
test('piiPaths flags email/phone/name/address keys (nested) and email-shaped values; the event sample table is clean', () => {
  assert.deepEqual(piiPaths({ email: 'x', nested: { phoneNumber: '1', list: [{ homeAddress: 'y' }] }, userName: 'z', note: 'kim@example.com', label: '시작하기', fields: ['email'] }),
    ['email', 'nested.phoneNumber', 'nested.list[0].homeAddress', 'userName', 'note'])
  for (const [name, props] of Object.entries(SAMPLE_EVENTS)) assert.deepEqual(piiPaths(props), [], name)
})

test('runCheck turns a throw, a rejection and a never-settling promise into failed results (the suite never throws or hangs)', async () => {
  assert.deepEqual(await runCheck('x.throw', async () => { throw new Error('boom') }), { id: 'x.throw', ok: false, message: '던짐: boom' })
  const hang = await runCheck('x.hang', () => new Promise(() => {}), { timeoutMs: 30 })
  assert.equal(hang.ok, false)
  assert.match(hang.message, /30ms/)
  assert.deepEqual(await runCheck('x.ok', async () => null), { id: 'x.ok', ok: true, message: 'ok' })
  // 끝나지 않는 목(?state=loading)도 묶음은 끝난다 — 모든 검사가 실패로
  const stuck = await notifyConformance(() => mock.mockNotify('?state=loading'), { timeoutMs: 20 })
  assert.ok(stuck.length > 0 && stuck.every((r) => !r.ok))
})

// ⑤ 레지스트리 항목 ─────────────────────────────────────────────────────────
test('registry: contract-conformance is one registry:lib item bundling conformance/*.ts under @components/contract/conformance, depends on contract types + lib retention-offer (not adapter-mock), no npm deps, installs closed', () => {
  const items = buildItems(DIR, 'contract', REPO, DIR, 'v9.9.9', { zod: '^4.6.5' })
  const it = items.find((i) => i.name === 'contract-conformance')
  assert.ok(it)
  assert.equal(it.type, 'registry:lib')
  assert.deepEqual(it.files, CONF_FILES.map((f) => ({ path: `conformance/${f}`, type: 'registry:lib', target: `@components/contract/conformance/${f}` })))
  assert.deepEqual(CONF_FILES, ['analytics.ts', 'auth.ts', 'billing.ts', 'conformance-core.ts', 'notify.ts'])
  assert.deepEqual(it.dependencies, [])
  assert.deepEqual(it.registryDependencies, ['block-contract', 'events', 'ports', 'retention-offer'].map((d) => `${REPO}/${d}#v9.9.9`))
  // 커밋된 생성물에도 같은 항목(고정 태그는 package.json 판)
  const gen = JSON.parse(readFileSync(join(DIR, 'registry.json'), 'utf8')).items.find((i) => i.name === 'contract-conformance')
  assert.deepEqual(gen.files.map((f) => f.target), it.files.map((f) => f.target))
  // 설치 닫힘: 묶음 안 상대 import·계약 타입·lib 가 소비자 자리에서 모두 풀린다
  const all = closureItems()
  const r = checkItem('contract-conformance', new Map(all.map((i) => [i.name, i])))
  assert.deepEqual(r, { unresolved: [], undeclared: [], missing: [] })
  // 프레임워크 중립: 실행기를 부르지 않는다
  for (const f of CONF_FILES) assert.doesNotMatch(readFileSync(join(CONF, f), 'utf8'), /from\s+["'](node:test|vitest|jest|@jest\/|mocha|node:assert)/, f)
})
