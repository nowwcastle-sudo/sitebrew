// WF-7 멱등 키 계약 전달(보안 항목 wf-idempotency-port-001): 폼이 만든 `idempotencyKey`(숨은 입력, site-template form-keys)가 블록을 거쳐 포트 입력에 실리고,
// 시간 초과 뒤 [다시 시도]가 같은 키로 가며, adapter-mock·적합성 묶음이 같은 키 한 번만 실행하는지 본다. 계약 판은 그대로 2다(선택 칸 추가).
//   ① 폼 훅(실제 usePortForm — 서버 렌더로 훅 객체를 꺼내 가짜 문서로 부른다): 키가 포트 입력에 실림 · 시간 초과 재시도 같은 키 · 성공하면 키를 썼다고 알림 · 실패는 키를 그대로 · 키 없는 폼은 예전과 같다
//   ② 블록: password-reset 의 실제 제출 처리기(jsx 를 가로채 꺼냄)가 키를 싣고, 다섯 블록의 소스가 포트 호출에 키를 펼친다
//   ③ adapter-mock requireIdempotency: 같은 키 두 번 → 한 번만 · 처리 중 같은 키 → in_progress · 실패한 키는 풀림 · 끄면 예전과 같다
//   ④ 적합성 묶음 requireIdempotency: 목이 통과하고, 키를 모르는 목은 같은 키 검사에서만 떨어진다(음성 대조) · 끄면 묶음이 그대로
//   ⑤ 정상 선례: 키 없는 호출·기존 적합성 묶음·CONTRACT_VERSION 2
// 수정 전 코드에서 떨어지는지는 WF_IDEM_SRC=<origin/main 원천을 푼 폴더> 로 같은 시험을 돌려 본다(원천만 그 폴더에서 읽는다).
// 실행: node --test --test-force-exit --test-timeout=120000 factory/scripts/security-idempotency.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SRC = process.env.WF_IDEM_SRC ? process.env.WF_IDEM_SRC : root
const OUT = join(root, '.tmp', process.env.WF_IDEM_SRC ? 'security-idempotency-test-old' : 'security-idempotency-test')
mkdirSync(OUT, { recursive: true })

// jsx 를 가로채는 런타임: <form onSubmit> 의 처리기를 globalThis.__forms 에 모은다(실제 렌더가 만든 처리기를 그대로 부르려고)
const JSX_STUB = join(OUT, 'jsx-capture.mjs')
writeFileSync(
  JSX_STUB,
  [
    "import * as real from 'react/jsx-runtime'",
    'export const Fragment = real.Fragment',
    "const grab = (t, p) => { if (t === 'form' && typeof p?.onSubmit === 'function') (globalThis.__forms ??= []).push({ id: p.id, onSubmit: p.onSubmit }) }",
    'export const jsx = (t, p, k) => (grab(t, p), real.jsx(t, p, k))',
    'export const jsxs = (t, p, k) => (grab(t, p), real.jsxs(t, p, k))',
    '',
  ].join('\n'),
)

const loaded = new Map()
function transpile(abs) {
  if (abs.endsWith('.mjs')) return abs
  if (loaded.has(abs)) return loaded.get(abs)
  const out = join(OUT, relative(SRC, abs).replace(/\.tsx?$/, '.mjs'))
  loaded.set(abs, out)
  let { outputText } = ts.transpileModule(readFileSync(abs, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } })
  outputText = outputText.replace(/(from\s+|import\s*\(\s*|import\s+)(["'])(@\/|\.\.?\/)([^"']+)\2/g, (_, kw, q, pre, p) => {
    const base = pre === '@/' ? join(SRC, p) : join(dirname(abs), pre, p)
    const src = [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts')].find((f) => existsSync(f) && /\.(mjs|tsx?)$/.test(f))
    if (!src) throw new Error(`import 대상 없음: ${pre}${p}`)
    return `${kw}${q}${pathToFileURL(transpile(src)).href}${q}`
  })
  outputText = outputText.replace(/(["'])react\/jsx-runtime\1/g, `"${pathToFileURL(JSX_STUB).href}"`)
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, outputText)
  return out
}
const load = (rel) => import(pathToFileURL(transpile(join(SRC, rel))).href)
const React = await import('react')
const { renderToStaticMarkup } = await import('react-dom/server')
const h = React.createElement
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const guard = await load('registry/factory/blocks/_shared/submit-guard.tsx')
const portForm = await load('registry/factory/blocks/_shared/port-form.tsx')
const mock = await load('registry/factory/contract/adapter-mock.ts')
const events = await load('registry/factory/contract/events.ts')
const { billingConformance } = await load('registry/factory/contract/conformance/billing.ts')
const { authConformance } = await load('registry/factory/contract/conformance/auth.ts')
const { notifyConformance } = await load('registry/factory/contract/conformance/notify.ts')
const { bookingConformance } = await load('registry/factory/contract/conformance/booking.ts')
const { failures } = await load('registry/factory/contract/conformance/conformance-core.ts')

const NOTICES = { rateLimited: '{seconds}초', timeout: { title: '늦어요', body: '다시 시도해 주세요.', retry: '다시 시도' }, unsupported: { title: '불가', link: '관리' } }
const SPENT = 'wf:idempotency-spent'

// ── 가짜 문서: 숨은 입력 하나를 가진 폼. dispatchEvent(SPENT)는 조립하는 쪽(form-keys)처럼 새 키를 준다 ─────────────────────────────
function fakePage({ key = 'form-key-1', withKey = true } = {}) {
  const input = { value: key }
  const log = { spent: 0, resubmits: 0 }
  const formEl = {
    querySelector: (sel) => (withKey && sel.includes('idempotencyKey') ? input : null),
    dispatchEvent: (ev) => {
      if (ev.type === SPENT) {
        log.spent += 1
        input.value = `${key}-rotated-${log.spent}`
      }
      return true
    },
    requestSubmit: () => {
      log.resubmits += 1
      return log.onResubmit?.()
    },
  }
  globalThis.document = { getElementById: (id) => (id === 'idem-form' ? formEl : null) }
  return { input, log, formEl }
}
function hook(options = {}) {
  let captured
  const Probe = () => {
    captured = portForm.usePortForm({ id: 'idem', notices: NOTICES, timeoutMs: 40, ...options })
    return null
  }
  renderToStaticMarkup(h(Probe))
  return captured
}
const recorder = (answer = async () => ({ ok: true, data: { done: true } })) => {
  const seen = []
  return { seen, call: async (input) => (seen.push(input), answer(input, seen.length)) }
}

// ① 폼 훅 ─────────────────────────────────────────────────────────────────
test('폼 훅: 숨은 입력의 키가 포트 입력의 idempotencyKey 로 실린다(수정 전: 키 칸이 비어 간다)', async () => {
  fakePage()
  const form = hook()
  const port = recorder()
  const data = await form.run((key) => port.call({ planId: 'basic', ...key }))
  assert.deepEqual(data, { done: true })
  assert.equal(port.seen.length, 1)
  assert.equal(port.seen[0].idempotencyKey, 'form-key-1', '폼의 키가 포트 입력에 실려야 한다')
  assert.equal(port.seen[0].planId, 'basic', '나머지 입력은 그대로')
})

test('폼 훅: 시간 초과 뒤 [다시 시도]는 같은 키 — 폼의 키가 그 사이 바뀌어도 시간 초과가 난 시도의 키를 쓴다(수정 전: 키 없이 두 번 부른다)', async () => {
  const page = fakePage()
  const form = hook()
  const port = recorder((input, n) => (n === 1 ? new Promise(() => {}) : Promise.resolve({ ok: true, data: { n } }))) // 첫 요청은 끝나지 않는다(?submit=timeout)
  assert.equal(await form.run((key) => port.call({ planId: 'basic', ...key })), null, '15초(시험은 40ms) 안에 답이 없으면 null')
  page.input.value = 'form-key-ROTATED' // 폼의 숨은 입력이 그 사이 달라져도
  assert.deepEqual(await form.run((key) => port.call({ planId: 'basic', ...key })), { n: 2 })
  assert.equal(port.seen.length, 2)
  assert.deepEqual(port.seen.map((i) => i.idempotencyKey), ['form-key-1', 'form-key-1'], '재시도는 처음과 같은 키여야 서버가 한 번만 실행한다')
})

test('폼 훅: [다시 시도](form.retry)는 폼을 다시 보내고, 다시 보낸 요청도 같은 키다', async () => {
  const page = fakePage()
  const form = hook()
  const port = recorder((input, n) => (n === 1 ? new Promise(() => {}) : Promise.resolve({ ok: true, data: { n } })))
  const submit = () => form.run((key) => port.call({ ...key }))
  page.log.onResubmit = submit // requestSubmit → 블록의 onSubmit → run
  assert.equal(await submit(), null)
  form.retry()
  await sleep(20)
  assert.equal(page.log.resubmits, 1)
  assert.deepEqual(port.seen.map((i) => i.idempotencyKey), ['form-key-1', 'form-key-1'])
})

test('폼 훅: 성공하면 키를 썼다고 알려 조립하는 쪽이 새 키를 주게 한다 — 같은 폼의 다음 요청은 새 키(앞 요청의 결과를 되받지 않는다)', async () => {
  const page = fakePage()
  const form = hook()
  const port = recorder()
  await form.run((key) => port.call({ ...key }))
  assert.equal(page.log.spent, 1)
  await form.run((key) => port.call({ ...key }))
  assert.deepEqual(port.seen.map((i) => i.idempotencyKey), ['form-key-1', 'form-key-1-rotated-1'])
})

test('폼 훅: 실패(칸 오류·서버 오류)는 키를 그대로 둔다 — 고쳐서 다시 보내는 같은 요청이다 · 키를 읽지 않은 요청(입력 검사만)은 키를 쓰지 않는다', async () => {
  const page = fakePage()
  const form = hook()
  const port = recorder((input, n) => (n === 1 ? { ok: false, fieldErrors: { email: ['x'] } } : { ok: true, data: {} }))
  assert.equal(await form.run((key) => port.call({ ...key })), null)
  assert.equal(page.log.spent, 0, '실패한 요청의 키는 쓴 것이 아니다')
  await form.run(async () => ({ ok: true, data: true })) // 키를 읽지 않는 검사
  assert.equal(page.log.spent, 0, '키를 읽지 않았으면 쓴 것이 아니다')
  await form.run((key) => port.call({ ...key }))
  assert.deepEqual(port.seen.map((i) => i.idempotencyKey), ['form-key-1', 'form-key-1'])
  assert.equal(page.log.spent, 1)
})

test('정상 선례: 숨은 입력이 없는 폼(키 없는 조립)은 예전과 같다 — 포트 입력에 키 칸이 없고 알림도 없다 · action 이 키를 받지 않아도 된다', async () => {
  const page = fakePage({ withKey: false })
  const form = hook()
  const port = recorder()
  await form.run((key) => port.call({ planId: 'basic', ...key }))
  assert.equal('idempotencyKey' in port.seen[0], false)
  await form.run(() => port.call({ planId: 'basic' })) // 옛 호출 모양 `run(() => port(...))`
  assert.deepEqual(port.seen, [{ planId: 'basic' }, { planId: 'basic' }])
  assert.equal(page.log.spent, 0)
  // 시간 제한이 없는 폼(notices 없음)도 같다
  const bare = hook({ notices: undefined })
  fakePage()
  const p2 = recorder()
  await bare.run((key) => p2.call({ ...key }))
  assert.equal(p2.seen[0].idempotencyKey, 'form-key-1')
})

test('createKeyLease(순수): 시간 초과의 키는 붙잡고 다른 결과면 놓는다 · 공백뿐인 숨은 입력은 키가 아니다', async () => {
  let current = 'k1'
  const spent = []
  const lease = guard.createKeyLease(() => current, (k) => spent.push(k))
  const hang = () => new Promise(() => {})
  assert.equal(await lease.settle(() => hang(), 20), guard.TIMED_OUT) // 키를 읽지 않아도 시간 초과면 그 시도의 키를 붙잡는다
  current = 'k2'
  const seen = []
  await lease.settle((key) => (seen.push(key.idempotencyKey), Promise.resolve({ ok: false, formError: 'x' })), 20)
  await lease.settle((key) => (seen.push(key.idempotencyKey), Promise.resolve({ ok: true, data: 1 })), 20)
  assert.deepEqual(seen, ['k1', 'k2'], '시간 초과 다음 한 번만 붙잡은 키, 그 뒤는 지금 폼의 키')
  assert.deepEqual(spent, ['k2'])
  assert.equal(guard.readIdempotencyKey({ querySelector: () => ({ value: '   ' }) }), undefined)
  assert.equal(guard.readIdempotencyKey(null), undefined)
  assert.equal(guard.readIdempotencyKey({ querySelector: () => ({ value: ' abc ' }) }), 'abc')
})

// ② 블록 ───────────────────────────────────────────────────────────────────
test('블록(password-reset): 실제 제출 처리기가 폼의 키를 포트 입력에 싣고, 다시 보내기(resend)는 성공 뒤 새 키를 쓴다(수정 전: 키 없이 두 번 보낸다)', async () => {
  class FakeForm {
    constructor() {
      this.entries = [['email', ' kim@example.com ']]
      this.input = { value: 'block-key-1' }
      this.spent = 0
    }
    querySelector(sel) {
      return sel.includes('idempotencyKey') ? this.input : null
    }
    dispatchEvent(ev) {
      if (ev.type === SPENT) this.input.value = `block-key-${2 + this.spent++}`
      return true
    }
  }
  globalThis.HTMLFormElement = FakeForm
  globalThis.FormData = class {
    constructor(f) {
      this.entries = f.entries
    }
    [Symbol.iterator]() {
      return this.entries[Symbol.iterator]()
    }
  }
  const formEl = new FakeForm()
  globalThis.document = { getElementById: (id) => (id === 'password-reset-form' ? formEl : null) }
  globalThis.__forms = []
  const { fixture } = await load('registry/factory/blocks/auth/password-reset.fixture.ts')
  const { AuthPasswordReset } = await load('registry/factory/blocks/auth/password-reset.tsx')
  const port = recorder(async () => ({ ok: true, data: { sent: true } }))
  renderToStaticMarkup(h(AuthPasswordReset, { ...fixture, requestPasswordReset: port.call }))
  const submit = globalThis.__forms.find((f) => f.id === 'password-reset-form')
  assert.ok(submit, '렌더가 폼 제출 처리기를 만들었다')
  await submit.onSubmit({ preventDefault() {} })
  assert.equal(port.seen.length, 1)
  assert.equal(port.seen[0].email, 'kim@example.com')
  assert.equal(port.seen[0].idempotencyKey, 'block-key-1', '블록이 폼의 키를 포트 입력에 실어야 한다')
  assert.equal(formEl.spent, 1, '성공하면 키를 썼다고 알린다 — 같은 폼의 다시 보내기가 앞 결과를 되받지 않게')
})

const BLOCK_CALLS = [
  ['trust/payment-trust-panel.tsx', /form\.run\(\(key\) => submit\(\{[^}]*\.\.\.key[^}]*\}\)\)/, '결제 판의 submit'],
  ['auth/password-reset.tsx', /requestPasswordReset\(\{ email: v\.email, \.\.\.key \}\)[\s\S]*requestPasswordReset\(\{ email: sentTo, \.\.\.key \}\)/, '재설정 메일 요청·다시 보내기'],
  ['auth/sign-up-consents.tsx', /form\.run\(async \(key\) => \{\s*const res = await signUp\([^\n]*\.\.\.key[^\n]*\.\.\.key/, '가입'],
  ['account/delete-account.tsx', /form\.run\(\(key\) => deleteAccount\(\{[^\n]*\.\.\.key \}\)\)/, '탈퇴'],
  ['lead-capture/inline-newsletter.tsx', /form\.run\(\(key\) => submit\(\{ email: v\.email, consent: true, \.\.\.key \}\)\)/, '뉴스레터 구독'],
]
test('블록 소스: 폼을 가진 블록의 변경 포트 호출이 폼의 키를 펼쳐 싣는다(결제 판·재설정·가입·탈퇴·뉴스레터) — 블록은 키를 만들지 않는다', () => {
  for (const [file, pattern, what] of BLOCK_CALLS) {
    const src = readFileSync(join(SRC, 'registry', 'factory', 'blocks', file), 'utf8')
    assert.match(src, pattern, `${file}: ${what} 호출에 ...key 가 없다`)
    assert.doesNotMatch(src, /randomUUID|crypto\.getRandomValues|uuid/i, `${file}: 블록이 키를 만들면 안 된다`)
  }
  for (const f of ['_shared/port-form.tsx', '_shared/submit-guard.tsx']) assert.doesNotMatch(readFileSync(join(SRC, 'registry', 'factory', 'blocks', f), 'utf8'), /randomUUID|getRandomValues/, `${f}: 키를 만들지 않는다`)
})

test('조립하는 쪽(site-template form-keys)은 폼마다 키를 한 번 만들고(나중에 열린 폼도), 성공 알림에 새 키를 준다 — 블록 규칙과 같은 글자', () => {
  const src = readFileSync(join(SRC, 'factory', 'stamp', 'site-template', 'components', 'site', 'form-keys.tsx'), 'utf8')
  assert.match(src, /crypto\.randomUUID\(\)/)
  assert.ok(src.includes(`"${guard.IDEMPOTENCY_SPENT_EVENT}"`), '블록이 보내는 이벤트 이름과 같다')
  assert.ok(src.includes(`"${guard.IDEMPOTENCY_FIELD}"`), '블록이 읽는 입력 이름과 같다')
  assert.match(src, /MutationObserver/, '단계 폼처럼 나중에 그려지는 폼도 키를 받는다')
})

// ③ adapter-mock ───────────────────────────────────────────────────────────
test('mockBilling requireIdempotency: 같은 키 두 번 → 상태는 한 번만 바뀌고 첫 결과를 돌려준다 · 메서드가 다르면 같은 키도 따로 · 키가 없으면 예전과 같다', async () => {
  const port = mock.mockBilling('?sub=none', { requireIdempotency: true })
  const first = await port.checkout({ planId: 'basic', idempotencyKey: 'k-1' })
  assert.equal(first.ok, true)
  const replay = await port.checkout({ planId: 'pro', idempotencyKey: 'k-1' }) // 같은 키 — 다른 입력이어도 첫 결과
  assert.deepEqual(replay, first, '첫 결과가 그대로 돌아온다')
  const sub = await port.subscription()
  assert.equal(sub.data.planId, 'basic', 'pro 로 바뀌지 않았다 — 두 번째 요청은 실행되지 않았다')
  await port.cancel({ when: 'period_end', idempotencyKey: 'k-1' }) // 같은 키·다른 메서드 — 따로 실행된다
  assert.ok((await port.subscription()).data.cancelAt, '메서드마다 키 범위가 따로다')
  const a = await port.checkout({ planId: 'pro' }) // 키 없음 — 예전처럼 매번 실행
  const b = await port.checkout({ planId: 'basic' })
  assert.equal(a.ok && b.ok, true)
  assert.equal((await port.subscription()).data.planId, 'basic')
})

test('mockBilling requireIdempotency: 처리 중에 같은 키가 오면 in_progress(다시 시도 가능) — 끝나면 첫 결과 · 실패한 요청의 키는 풀려 다시 실행된다', async () => {
  const port = mock.mockBilling('?sub=none', { requireIdempotency: true, delayMs: 40 })
  const slow = port.checkout({ planId: 'basic', idempotencyKey: 'k-2' })
  const dup = await port.checkout({ planId: 'basic', idempotencyKey: 'k-2' })
  assert.equal(dup.ok, false)
  assert.equal(dup.code, 'in_progress')
  assert.equal(dup.retryable, true)
  assert.ok(dup.formError)
  const done = await slow
  assert.equal(done.ok, true)
  assert.deepEqual(await port.checkout({ planId: 'basic', idempotencyKey: 'k-2' }), done, '끝난 뒤의 같은 키는 첫 결과')
  // 실패는 보관하지 않는다 — 없는 요금제로 실패한 키를 고쳐서 다시 보낼 수 있다
  const bad = await port.checkout({ planId: 'no-such-plan', idempotencyKey: 'k-3' })
  assert.equal(bad.ok, false)
  const fixed = await port.checkout({ planId: 'pro', idempotencyKey: 'k-3' })
  assert.equal(fixed.ok, true)
})

test('mockBilling: requireIdempotency 를 켜지 않으면 같은 키도 매번 실행된다(예전 동작 — 정상 선례)', async () => {
  const port = mock.mockBilling('?sub=none')
  await port.checkout({ planId: 'basic', idempotencyKey: 'same' })
  await port.checkout({ planId: 'pro', idempotencyKey: 'same' })
  assert.equal((await port.subscription()).data.planId, 'pro')
})

test('다른 목(가입·알림·예약·후기·뉴스레터·올리기 티켓·탈퇴·메일 요청)도 같은 키 한 번만 — 끄면 예전과 같다', async () => {
  const consents = { terms: true, privacy: true }
  const auth = mock.mockAuth('?auth=signed-in', { requireIdempotency: true })
  const signUp = await auth.signUp({ method: 'password', email: 'a@example.com', password: 'x1234567', consents, idempotencyKey: 'u-1' })
  assert.deepEqual(await auth.signUp({ method: 'kakao', consents, idempotencyKey: 'u-1' }), signUp, '가입: 첫 결과')
  const del = await auth.deleteAccount({ idempotencyKey: 'd-1' })
  assert.deepEqual(await auth.deleteAccount({ idempotencyKey: 'd-1' }), del, '탈퇴: 첫 결과')
  assert.equal((await auth.requestPasswordReset({ email: 'a@example.com', idempotencyKey: 'r-1' })).ok, true)

  const notify = mock.mockNotify('', { requireIdempotency: true })
  await notify.setConsents({ email: true, idempotencyKey: 'n-1' })
  await notify.setConsents({ email: false, idempotencyKey: 'n-2' })
  assert.equal((await notify.setConsents({ email: true, idempotencyKey: 'n-1' })).ok, true)
  assert.equal((await notify.consents()).data.email, false, '알림: 같은 키는 다시 켜지 않는다')

  const booking = mock.mockBooking('?booking=open', { requireIdempotency: true })
  const slots = (await booking.slots({ service: 'consult', from: '2026-10-05', days: 1 })).data.days[0].slots
  const book = await booking.book({ service: 'consult', startsAt: slots[0].startsAt, contact: 'kim@example.com', idempotencyKey: 'b-1' })
  assert.equal(book.ok, true)
  assert.deepEqual(await booking.book({ service: 'consult', startsAt: slots[0].startsAt, contact: 'kim@example.com', idempotencyKey: 'b-1' }), book, '예약: 같은 칸을 또 잡지 않고 첫 결과')
  const cancelled = await booking.cancel({ reference: book.data.id, contact: 'kim@example.com', idempotencyKey: 'c-1' })
  assert.deepEqual(await booking.cancel({ reference: book.data.id, contact: 'kim@example.com', idempotencyKey: 'c-1' }), cancelled, '취소: invalid_state 가 아니라 첫 결과')

  const reviews = mock.mockReviews('', { requireIdempotency: true })
  const rv = await reviews.submit({ subjectType: 'product', subjectId: 'p-1', rating: 5, body: '좋아요', idempotencyKey: 'v-1' })
  assert.deepEqual(await reviews.submit({ subjectType: 'product', subjectId: 'p-1', rating: 5, body: '좋아요', idempotencyKey: 'v-1' }), rv, '후기: 「이미 남겼어요」가 아니라 첫 결과')

  const news = mock.mockNewsletter('', { requireIdempotency: true })
  const sub = await news.subscribe({ email: 'a@example.com', consent: true, idempotencyKey: 's-1' })
  assert.deepEqual(await news.subscribe({ email: 'a@example.com', consent: true, idempotencyKey: 's-1' }), sub)

  const storage = mock.mockStorage('', { requireIdempotency: true })
  const t1 = await storage.createTicket({ kind: 'image', contentType: 'image/png', size: 100, idempotencyKey: 't-1' })
  const t2 = await storage.createTicket({ kind: 'image', contentType: 'image/png', size: 100, idempotencyKey: 't-1' })
  const t3 = await storage.createTicket({ kind: 'image', contentType: 'image/png', size: 100, idempotencyKey: 't-2' })
  assert.equal(t1.data.id, t2.data.id, '올리기 티켓: 같은 키는 같은 티켓')
  assert.notEqual(t1.data.id, t3.data.id, '다른 키는 새 티켓')

  // 끄면 예전과 같다: 같은 키로 후기를 두 번 쓰면 두 번째는 「이미 남겼어요」
  const off = mock.mockReviews('')
  await off.submit({ subjectType: 'product', subjectId: 'p-1', rating: 5, body: '좋아요', idempotencyKey: 'v-1' })
  assert.equal((await off.submit({ subjectType: 'product', subjectId: 'p-1', rating: 5, body: '좋아요', idempotencyKey: 'v-1' })).ok, false)
})

// ④ 적합성 묶음 ─────────────────────────────────────────────────────────────
const makers = (extra) => ({
  billing: ({ sub, retentionOffers }) => mock.mockBilling(`?sub=${sub}`, { ...extra, ...(retentionOffers ? { retentionOffers } : {}) }),
  auth: ({ auth }) => (auth === 'error' ? mock.mockAuth('?state=error') : mock.mockAuth(`?auth=${auth}`, extra)),
  notify: () => mock.mockNotify('', extra),
  booking: ({ scenario }) => mock.mockBooking(`?booking=${scenario}`, extra),
})
const SUITES = { billing: billingConformance, auth: authConformance, notify: notifyConformance, booking: bookingConformance }
const IDEM_IDS = {
  billing: ['billing.idempotency.same-key-replay', 'billing.idempotency.different-keys-both-apply', 'billing.idempotency.no-key-unchanged'],
  auth: ['auth.idempotency.sign-up-same-key-replay'],
  notify: ['notify.idempotency.same-key-replay', 'notify.idempotency.different-keys-both-apply', 'notify.idempotency.no-key-unchanged'],
  booking: ['booking.idempotency.book-same-key-replay', 'booking.idempotency.book-different-keys', 'booking.idempotency.book-no-key', 'booking.idempotency.cancel-same-key-replay'],
}
const failedIds = (results) => failures(results).map((r) => r.id).sort()
const explain = (results) => failures(results).map((r) => `${r.id}: ${r.message}`).join('\n')

test('적합성 묶음 requireIdempotency: 같은 키 한 번만 실행하는 목은 자기 묶음을 통과하고 *.idempotency.* 11개가 돈다(양성 대조)', async () => {
  const m = makers({ requireIdempotency: true })
  const counts = {}
  for (const [port, run] of Object.entries(SUITES)) {
    const results = await run(m[port], { requireIdempotency: true })
    assert.deepEqual(failedIds(results), [], `${port}\n${explain(results)}`)
    const ids = results.map((r) => r.id)
    assert.equal(new Set(ids).size, ids.length, `${port}: 검사 id 가 겹친다`)
    for (const id of IDEM_IDS[port]) assert.ok(ids.includes(id), `${id} 가 묶음에 없다`)
    counts[port] = ids.filter((id) => id.includes('.idempotency.')).length
  }
  assert.deepEqual(counts, { billing: 3, auth: 1, notify: 3, booking: 4 })
})

test('음성 대조: 키를 모르는(중복 방지 없는) 어댑터는 requireIdempotency 를 켜면 「같은 키 되풀이」 검사에서만 떨어진다 — 다른 키·키 없음 검사는 통과한다', async () => {
  const m = makers({})
  const opts = { requireIdempotency: true }
  assert.deepEqual(failedIds(await billingConformance(m.billing, opts)), ['billing.idempotency.same-key-replay'])
  assert.deepEqual(failedIds(await notifyConformance(m.notify, opts)), ['notify.idempotency.same-key-replay'])
  assert.deepEqual(failedIds(await bookingConformance(m.booking, opts)), ['booking.idempotency.book-same-key-replay', 'booking.idempotency.cancel-same-key-replay'])
  // 가입은 목이 계정을 기억하지 않아 두 번째도 성공한다 — 계정 표가 있는 실제 어댑터가 가려내는 검사다
  assert.deepEqual(failedIds(await authConformance(m.auth, opts)), [])
})

test('음성 대조: 키 없는 호출까지 되풀이로 막는(과한 중복 방지) 어댑터는 「키 없음」 검사에서 떨어진다', async () => {
  // 키가 없어도 같은 입력이면 첫 결과를 돌려주는 어댑터(과한 중복 방지)
  const overDedupe = (inner) => {
    const memo = new Map()
    return { ...inner, setConsents: async (input) => { const k = JSON.stringify(input); if (!memo.has(k)) memo.set(k, await inner.setConsents(input)); return memo.get(k) } }
  }
  assert.deepEqual(failedIds(await notifyConformance(() => overDedupe(mock.mockNotify('', { requireIdempotency: true })), { requireIdempotency: true })), ['notify.idempotency.no-key-unchanged'])
})

test('정상 선례: requireIdempotency 를 켜지 않으면 *.idempotency.* 검사가 돌지 않고 기존 묶음은 그대로 통과한다(키 없는 목도, 키를 지키는 목도)', async () => {
  for (const extra of [{}, { requireIdempotency: true }]) {
    const m = makers(extra)
    for (const [port, run] of Object.entries(SUITES)) {
      const results = await run(m[port])
      assert.equal(results.some((r) => r.id.includes('.idempotency.')), false, `${port}: 옵션이 없는데 멱등 검사가 돌았다`)
      assert.deepEqual(failedIds(results), [], `${port}\n${explain(results)}`)
    }
  }
})

test('계약 판은 그대로 2 — 선택 칸 추가는 판을 올리지 않는다(launch-factory CONTRACT_VERSION_EXPECTED 도 그대로)', () => {
  assert.equal(events.CONTRACT_VERSION, 2)
  const ports = readFileSync(join(SRC, 'registry', 'factory', 'contract', 'ports.ts'), 'utf8')
  assert.match(ports, /export type IdempotencyInput = \{ idempotencyKey\?: string \}/)
  // 읽기·signIn 에는 붙이지 않는다
  for (const line of ports.split('\n').filter((l) => /^\s+(slots|lookup|list|search|session|methods|plans|subscription|signIn)\(/.test(l))) assert.doesNotMatch(line, /IdempotencyInput/, line.trim())
  const marked = ['checkout', 'changePlan', 'cancel', 'pause', 'acceptPriceChange', 'applyRetentionOffer', 'signUp', 'requestPasswordReset', 'deleteAccount', 'setConsents', 'createTicket', 'subscribe']
  for (const m of marked) assert.ok(ports.split('\n').some((l) => new RegExp(`^\\s+${m}\\??\\(`).test(l) && /IdempotencyInput/.test(l)), `${m} 입력에 IdempotencyInput 이 없다`)
  for (const t of ['BookingRequest', 'BookingCancelInput', 'ReviewSubmitInput']) assert.match(ports, new RegExp(`${t} = [\\s\\S]*?IdempotencyInput`), `${t} 에 IdempotencyInput 이 없다`)
})
