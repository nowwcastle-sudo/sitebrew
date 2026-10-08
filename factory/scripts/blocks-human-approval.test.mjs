// 사람 승인 행동 표지·안내 글 + 실패·승인 대기 알림(P3-7 AXWF — 감사 M01·M04·M05, 규칙 R18·R21)의 블록 쪽: 폼 알림의 data-error-code·data-retryable·승인 대기(role=status,
// data-state="awaiting-approval", attempted → progress → 왜 → next → route), SubmitButton 의 approval 속성(안내 글 + data-requires-human + aria-describedby), ReadError 의 data-retryable.
// 브라우저가 필요한 동작은 factory/qa/agent-boundary.mjs(--gallery)와 blocks:states 가 잰다.
// 실행: node --test --test-force-exit --test-timeout=60000 factory/scripts/blocks-human-approval.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = join(root, '.tmp', 'blocks-human-approval-test')
const B = 'registry/factory/blocks'
const loaded = new Map()
function transpile(abs) {
  if (abs.endsWith('.mjs')) return abs
  if (loaded.has(abs)) return loaded.get(abs)
  const out = join(OUT, relative(root, abs).replace(/\.tsx?$/, '.mjs'))
  loaded.set(abs, out)
  let { outputText } = ts.transpileModule(readFileSync(abs, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } })
  outputText = outputText.replace(/(from\s+|import\s*\(\s*|import\s+)(["'])(@\/|\.\.?\/)([^"']+)\2/g, (_, kw, q, pre, p) => {
    const base = pre === '@/' ? join(root, p) : join(dirname(abs), pre, p)
    const src = [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts')].find((f) => existsSync(f) && /\.(mjs|tsx?)$/.test(f))
    if (!src) throw new Error(`import 대상 없음: ${pre}${p}`)
    return `${kw}${q}${pathToFileURL(transpile(src)).href}${q}`
  })
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, outputText)
  return out
}
const load = (rel) => import(pathToFileURL(transpile(join(root, rel))).href)
const src = (rel) => readFileSync(join(root, rel), 'utf8')
const guard = await load(`${B}/_shared/submit-guard.tsx`)
const portForm = await load(`${B}/_shared/port-form.tsx`)
const formFlow = await load(`${B}/_shared/form-flow.tsx`)
const portRead = await load(`${B}/_shared/port-read.tsx`)
const approval = await load(`${B}/_shared/human-approval.tsx`)
const actions = await load('registry/factory/contract/human-actions.ts')
const React = await import('react')
const { renderToStaticMarkup } = await import('react-dom/server')
const h = React.createElement

const NOTICES = {
  rateLimited: '{seconds}초 뒤에 다시 보낼 수 있어요',
  timeout: { title: '응답이 늦어요', body: '다시 시도해 주세요.', retry: '다시 시도하기' },
  unsupported: { title: '여기서는 바꿀 수 없어요', link: '직접 관리하는 곳으로 가기' },
  approval: { title: '직접 확인해 주세요', attempted: '요금제 변경을 요청했어요.', progress: '아직 아무것도 바뀌지 않았어요.', reason: '기본 이유', next: '화면의 [변경하기] 를 직접 눌러 주세요.', route: { label: '고객센터에 문의하기', href: '/contact' } },
}
const alertOf = (kind, extra = {}) => ({ kind, text: '', ...extra })

// ── 알림 속성(두 폼 알림이 같이 쓴다 — 한 곳) ─────────────────────────────────────────────
test('noticeAttrs: 실패 code·retryable 은 data-error-code·data-retryable 로, 승인 대기는 data-state="awaiting-approval" — 갈래로 정하는 기본값(시간 초과 true · 승인 대기·지원 안 함 false)', () => {
  assert.deepEqual(guard.noticeAttrs(alertOf('server', { code: 'vendor_x', retryable: true })), { 'data-kind': 'server', 'data-error-code': 'vendor_x', 'data-retryable': 'true', 'data-state': undefined })
  assert.equal(guard.noticeAttrs(alertOf('server'))['data-retryable'], undefined, '포트가 안 알려 준 서버 오류는 retryable 표지가 없다(거짓 약속 없음)')
  assert.equal(guard.noticeAttrs(alertOf('timeout'))['data-retryable'], 'true')
  assert.equal(guard.noticeAttrs(alertOf('unsupported'))['data-retryable'], 'false')
  const a = guard.noticeAttrs(alertOf('approval', { code: 'approval_required' }))
  assert.deepEqual([a['data-state'], a['data-retryable'], a['data-error-code']], ['awaiting-approval', 'false', 'approval_required'])
  assert.equal(guard.noticeAttrs(alertOf('field', { retryable: false }))['data-retryable'], 'false', '포트가 준 값이 갈래 기본값보다 앞선다')
})

test('failureKind: approval_required 는 승인 갈래 — 다른 code 는 그대로', () => {
  assert.equal(guard.failureKind({ ok: false, code: 'approval_required' }), 'approval')
  assert.equal(guard.failureKind({ ok: false, code: 'rate_limited' }), 'rate_limited')
  assert.equal(guard.failureKind({ ok: false, code: 'approval' }), 'other')
})

test('failureKind(AXC): confirmation_required(launch-factory 값) 도 승인 갈래 — approval_required 와 같은 뜻이고 noticeAttrs 는 같은 승인 표지를 단다', () => {
  assert.equal(guard.failureKind({ ok: false, code: 'confirmation_required' }), 'approval')
  assert.equal(guard.failureKind({ ok: false, code: 'confirmation_required', fieldErrors: { confirmed: ['x'] } }), 'approval', 'fieldErrors.confirmed 가 있어도 칸 오류가 아니라 승인 대기')
  const a = guard.noticeAttrs(alertOf('approval', { code: 'confirmation_required' }))
  assert.deepEqual([a['data-state'], a['data-retryable'], a['data-error-code']], ['awaiting-approval', 'false', 'confirmation_required'])
  for (const f of ['approval_required', 'confirmation_required']) assert.match(src(`${B}/_shared/submit-guard.tsx`), new RegExp(f))
})

// ── 폼 알림: 승인 대기는 실패가 아니다 ───────────────────────────────────────────────────────
const fakeForm = (formError) => ({ alertId: 'a', formError, notices: NOTICES, cooldown: 0, retry() {} })
for (const [name, el] of [
  ['port-form FormAlert', (fe) => h(portForm.FormAlert, { form: fakeForm(fe), fieldTitle: 'F', serverTitle: 'S' })],
  ['form-flow FormAlert', (fe) => h(formFlow.FormAlert, { flow: { ...fakeForm(fe), alertId: 'a' }, copy: { fieldErrorTitle: 'F', errorTitle: 'S' } })],
]) {
  test(`${name}: 승인 대기 — role="status"·data-state·data-retryable="false"·제목 「직접 확인해 주세요」·R21 순서(attempted → progress → 왜 → next → route), 오류 색 아이콘 없음`, () => {
    const html = renderToStaticMarkup(el(alertOf('approval', { code: 'approval_required', retryable: false, text: '서버가 말한 이유' })))
    assert.match(html, /role="status"/)
    assert.doesNotMatch(html, /role="alert"/)
    assert.match(html, /data-state="awaiting-approval"/)
    assert.match(html, /data-error-code="approval_required"/)
    assert.match(html, /data-retryable="false"/)
    assert.match(html, /직접 확인해 주세요/)
    const order = ['data-part="attempted"', 'data-part="progress"', 'data-part="why"', 'data-part="next"', 'data-part="human-route"'].map((p) => html.indexOf(p))
    assert.ok(order.every((i) => i > 0) && [...order].sort((x, y) => x - y).join() === order.join(), `순서가 어긋났다: ${order}`)
    assert.match(html, /서버가 말한 이유/)
    assert.match(html, /href="\/contact"/)
    assert.match(html, /data-wait=""/, '기다림 아이콘(오류 아이콘 아님)')
    assert.doesNotMatch(html, /data-retryable="true"/)
    // 포트가 이유를 안 줬으면 기본 이유
    assert.match(renderToStaticMarkup(el(alertOf('approval', { code: 'approval_required' }))), /기본 이유/)
  })
  test(`${name}: confirmation_required(AXC) — 승인 대기로 그린다: role="status"·data-state="awaiting-approval"·data-error-code="confirmation_required"·data-retryable="false"·오류 색 아님`, () => {
    const html = renderToStaticMarkup(el(alertOf('approval', { code: 'confirmation_required', retryable: false, text: '확인이 먼저예요' })))
    assert.match(html, /role="status"/)
    assert.doesNotMatch(html, /role="alert"/)
    assert.match(html, /data-state="awaiting-approval"/)
    assert.match(html, /data-error-code="confirmation_required"/)
    assert.match(html, /data-retryable="false"/)
    assert.match(html, /확인이 먼저예요/)
    assert.match(html, /data-wait=""/)
  })
  test(`${name}: 일반 오류는 예전 그대로 role="alert" + data-error-code·data-retryable(포트가 준 값만), 승인 문구가 없으면 approval 도 오류 칸으로`, () => {
    const html = renderToStaticMarkup(el(alertOf('server', { code: 'vendor_x', retryable: true, text: '실패했어요' })))
    assert.match(html, /role="alert"/)
    assert.doesNotMatch(html, /data-state=|awaiting/)
    assert.match(html, /data-error-code="vendor_x"/)
    assert.match(html, /data-retryable="true"/)
    assert.match(html, /실패했어요/)
    assert.doesNotMatch(renderToStaticMarkup(el(alertOf('server', { text: 'x' }))), /data-retryable|data-error-code/)
    const to = renderToStaticMarkup(el(alertOf('timeout', { text: NOTICES.timeout.body, canRetry: true })))
    assert.match(to, /data-retryable="true"/)
    assert.match(to, /다시 시도하기/)
  })
}

// ── 블록이 자기 확인 단계 뒤에 confirmed: true 를 싣는다(P3-7 AXC — launch-factory 의 watch.confirmed 조립이 필요 없어진다) ──────────────────
// 브라우저 쪽 증거: blocks:states(예시 포트가 requireConfirmation 이라 confirmed 를 안 실으면 승인 대기로 끝나 ok 행이 떨어진다)·window.__wfCalls
const CONFIRMED_CALLS = [
  ['retention/cancel-flow', [/cancel\(\{ when, \.\.\.\(reason \? \{ reason \} : \{\}\), confirmed: true \}\)/, /applyRetentionOffer\(\{ offerId: offer\.id, confirmed: true \}\)/]],
  ['retention/renewal-consent', [/acceptPriceChange\(\{ confirmed: true \}\)/, /cancel\(\{ when: "period_end", confirmed: true \}\)/]],
  ['account/billing-manage', [/changePlan\(\{ planId: target\.id, when: "period_end", confirmed: true \}\)/]],
  ['account/credentials', [/changeEmail\(\{ newEmail: v\.newEmail, currentPassword: v\.currentPassword, confirmed: true \}\)/]],
  ['account/delete-account', [/exportMyData\(\{ confirmed: true \}\)/, /deleteAccount\(\{ confirmed: true,/]],
  ['account/notification-consents', [/setConsents\(\{ \[ch\]: on, confirmed: true \}\)/]],
]
test('블록 6개는 승인 행동 호출에 confirmed: true 를 싣는다(원천·컴파일본 모두) — 확인 칸이 없는 호출(해지·가격 변경 동의·요금제 변경·이메일 변경·탈퇴·내려받기·동의 변경)이 하나도 남지 않았다', () => {
  for (const [kv, res] of CONFIRMED_CALLS) {
    for (const base of [B, `${B}/_compiled`]) {
      const code = src(`${base}/${kv}.tsx`)
      for (const re of res) assert.match(code, re, `${base}/${kv}: ${re}`)
    }
  }
  // 승인 행동 호출(AXWF 표의 포트 메서드)은 모두 confirmed 를 싣는다 — 새 호출이 생기면 이 표가 먼저 어긋난다
  const CALL = /\.run\(\(\) => (changePlan|cancel|applyRetentionOffer|acceptPriceChange|changeEmail|deleteAccount|exportMyData)\(|await setConsents\(/
  let calls = 0
  for (const [kv] of CONFIRMED_CALLS) {
    for (const line of src(`${B}/${kv}.tsx`).split(/\r?\n/)) {
      if (!CALL.test(line) || /^\s*(\/\/|\*)/.test(line)) continue
      calls++
      assert.match(line, /confirmed: true/, `${kv}: ${line.trim()} 에 confirmed: true 가 없다`)
    }
  }
  assert.equal(calls, 9, '승인 행동 호출 수(해지 2·가격 동의/거절 2·요금제 1·이메일 1·내려받기+탈퇴 2·동의 1) — 호출이 늘면 이 표도 늘린다')
})

test('sign_in_required(snake_case — AXC)도 signInRequired 와 같이 로그인 행동으로 그린다(ReadError)', () => {
  const state = { status: 'error', message: 'm', retry() {}, code: 'sign_in_required', retryable: false }
  const html = renderToStaticMarkup(h(portRead.ReadError, { state, title: 'T', retryLabel: 'R', signIn: { href: '/sign-in', label: '로그인하기' } }))
  assert.match(html, /data-sign-in-required=""/)
  assert.match(html, /data-error-code="sign_in_required"/)
  assert.match(html, /data-retryable="false"/)
  assert.match(html, /href="\/sign-in"/)
})

// ── 읽기 오류 ───────────────────────────────────────────────────────────────────────────
test('ReadError: retryable 은 data-retryable 로(L04 의 data-error-code 옆), 안 주면 표지가 없다', () => {
  const state = (o) => ({ status: 'error', message: 'm', retry() {}, ...o })
  const a = renderToStaticMarkup(h(portRead.ReadError, { state: state({ code: 'service_unavailable', retryable: true }), title: 'T', retryLabel: 'R' }))
  assert.match(a, /data-error-code="service_unavailable"/)
  assert.match(a, /data-retryable="true"/)
  assert.match(renderToStaticMarkup(h(portRead.ReadError, { state: state({ code: 'x', retryable: false }), title: 'T', retryLabel: 'R' })), /data-retryable="false"/)
  assert.doesNotMatch(renderToStaticMarkup(h(portRead.ReadError, { state: state({}), title: 'T', retryLabel: 'R' })), /data-retryable/)
  assert.match(src(`${B}/_shared/port-read.tsx`), /retryable: r\.retryable/, 'usePortRead 가 포트의 retryable 을 상태로 싣는다')
})

test('L04 확장(원천): 두 폼 알림은 noticeAttrs 로 data-error-code·data-retryable·data-state 를 한 곳에서 달고, 실패 갈래마다 code 를 싣는다 — 중복 구현 없음', () => {
  for (const f of ['port-form', 'form-flow']) {
    const code = src(`${B}/_shared/${f}.tsx`)
    assert.match(code, /\{\.\.\.noticeAttrs\(e\)\}/, f)
    assert.doesNotMatch(code, /data-error-code=/, `${f}: 속성은 noticeAttrs 한 곳이 단다`)
    assert.ok([...code.matchAll(/code: r\.code/g)].length >= 3, `${f}: 실패 갈래마다 code 를 싣는다`)
    assert.match(code, /gate === "approval" && notices\?\.approval/, `${f}: approval_required 는 승인 문구가 있을 때 승인 갈래`)
  }
  assert.match(src(`${B}/_shared/submit-guard.tsx`), /"data-error-code": n\.code \|\| undefined/)
})

// ── 승인 컨트롤: 안내 글 + 표지 ────────────────────────────────────────────────────────────
test('SubmitButton(approval): 버튼 앞에 안내 글 한 줄 + 버튼에 data-requires-human·aria-describedby — approval 이 없으면 예전 그대로(안내·표지 없음)', () => {
  const form = { formId: 'f', pending: false, cooldown: 0, notices: undefined }
  const html = renderToStaticMarkup(h(portForm.SubmitButton, { form, label: '바꾸기', pendingLabel: '바꾸는 중', approval: { action: 'change-email', hint: '직접 확인하고 눌러 주세요' } }))
  assert.match(html, /<p id="f-approval-hint" data-human-hint="" class="cn-block-human-hint">직접 확인하고 눌러 주세요<\/p>/)
  assert.match(html, /<button[^>]*data-requires-human="change-email"/)
  assert.match(html, /aria-describedby="f-approval-hint"/)
  assert.ok(html.indexOf('data-human-hint') < html.indexOf('<button'), '안내 글이 버튼 앞이다')
  const plain = renderToStaticMarkup(h(portForm.SubmitButton, { form, label: '바꾸기', pendingLabel: '바꾸는 중' }))
  assert.doesNotMatch(plain, /data-requires-human|data-human-hint|aria-describedby/)
  const flow = { formId: 'g', pending: false, cooldown: 0, notices: undefined }
  const copy = { submitLabel: '가입하기', pendingLabel: '가입하는 중' }
  const f = renderToStaticMarkup(h(formFlow.SubmitButton, { flow, copy, approval: { action: 'sign-up', hint: "You'll confirm this yourself" } }))
  assert.match(f, /data-requires-human="sign-up"/)
  assert.match(f, /aria-describedby="g-approval-hint"/)
  assert.match(f, /You&#x27;ll confirm this yourself/)
  assert.doesNotMatch(renderToStaticMarkup(h(formFlow.SubmitButton, { flow, copy })), /data-requires-human|data-human-hint/)
})

test('ApprovalHint·humanApprovalProps: 안내 글은 data-human-hint 표지 하나, 속성은 표의 승인 행동만(타입)', () => {
  assert.match(renderToStaticMarkup(h(approval.ApprovalHint, { id: 'x' }, '확인')), /^<p id="x" data-human-hint="" class="cn-block-human-hint">확인<\/p>$/)
  assert.deepEqual(actions.humanApprovalProps('delete-account', 'hint'), { 'data-requires-human': 'delete-account', 'aria-describedby': 'hint' })
  assert.equal(actions.APPROVAL_HINT.ko, '직접 확인하고 눌러 주세요')
  assert.equal(actions.APPROVAL_HINT.en, "You'll confirm this yourself")
})

// ── 블록 연결(원천 검사) ────────────────────────────────────────────────────────────────────
test('표에 적힌 사람 승인 블록은 copy.humanHint 칸을 타입에 두고 예시(fixture)가 채운다 — 안내 글을 블록 안에 하드코딩하지 않는다', () => {
  const blocks = [...new Set(actions.AGENT_ACTIONS.filter((a) => a.tier === 'human-approval').flatMap((a) => a.blocks ?? []))]
  assert.ok(blocks.length >= 15, `승인 블록 ${blocks.length}개`)
  const via = { 'paywall/limit-meter': 'plan-offer', 'paywall/onboarding-offer': 'plan-offer', 'paywall/trial-ending': 'plan-offer', 'paywall/upgrade-modal': 'plan-offer' } // PlanOfferCopy.humanHint 로 받는다
  for (const b of blocks) {
    const type = via[b] ? src(`${B}/_shared/${via[b]}.tsx`) : src(`${B}/${b}.tsx`)
    assert.match(type, /humanHint: string/, `${b}: copy 타입에 humanHint 칸이 없다`)
    const fx = src(`${B}/${b}.fixture.ts`)
    assert.ok(/humanHint: APPROVAL_HINT\.ko/.test(fx) || /OFFER_COPY|offer:/.test(fx), `${b}: 예시가 humanHint 를 채우지 않는다`)
    const own = src(`${B}/${b}.tsx`)
    assert.ok(!/직접 확인하고 눌러|You'll confirm/.test(own), `${b}: 안내 글을 블록에 직접 적지 않는다`)
  }
  // 에이전트 자율 행동에는 승인 표지를 달지 않는다(승인 피로 — M05): 로그인·로그아웃·재설정 메일 요청·확인 메일 다시 받기·청구서 보기·목록 필터
  for (const b of ['auth/sign-in', 'auth/two-factor', 'auth/password-reset', 'confirmation/verify-email', 'confirmation/signup-complete', 'data-table/compact', 'faq/single-accordion', 'pricing/plan-columns']) {
    if (existsSyncSafe(`${B}/${b}.tsx`)) assert.doesNotMatch(src(`${B}/${b}.tsx`), /humanApprovalProps|approval=\{\{/, `${b}: 에이전트 자율 행동에 승인 표지가 붙었다`)
  }
  assert.doesNotMatch(src(`${B}/_shared/billing-actions.tsx`).split('export function BillingInvoices')[1], /humanApprovalProps/, '청구서 보기는 읽기 전용 — 승인 표지 없음')
})
function existsSyncSafe(rel) { return existsSync(join(root, rel)) }
