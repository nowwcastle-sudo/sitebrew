// 제출 보호와 계약 추가 묶음의 블록 쪽(P3-2 Task 10d, 대장 A52·A101·D136·D160): 시간 초과·요청 제한·지원 안 함 조각(_shared/submit-guard),
// 청약철회 체크(_shared/plan-offer)·「로그인 유지」·「최근 사용」·만 14세 체크의 정적 렌더, 폼을 가진 모든 블록이 notices 를 받는지·결제 시작 블록이 청약철회를 거치는지의 원천 규칙.
// 브라우저가 필요한 동작(15초 뒤 [다시 시도]·남은 초 세기)은 .tmp/t10d/check.mjs 로 잰다(보고서).
// 실행: node --test --test-force-exit --test-timeout=60000 factory/scripts/blocks-submit-guard.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = join(root, '.tmp', 'blocks-submit-guard-test')
const BLOCKS = join(root, 'registry', 'factory', 'blocks')
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
const guard = await load('registry/factory/blocks/_shared/submit-guard.tsx')
const React = await import('react')
const { renderToStaticMarkup } = await import('react-dom/server')
const h = React.createElement
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ① settleWithin ───────────────────────────────────────────────────────────
test('settleWithin: 제때 온 결과는 그대로, 늦으면 TIMED_OUT 이고 늦게 온 결과는 버린다, 거부·던짐은 다시 시도할 수 있는 실패로', async () => {
  const ok = { ok: true, data: 1 }
  assert.deepEqual(await guard.settleWithin(async () => ok, 200), ok)
  let late
  const slow = () => new Promise((r) => setTimeout(() => r((late = { ok: true, data: 2 })), 80))
  assert.equal(await guard.settleWithin(slow, 20), guard.TIMED_OUT)
  await sleep(120)
  assert.ok(late, '늦은 약속은 끝까지 돌지만 결과는 화면에 닿지 않는다(이미 TIMED_OUT 으로 끝났다)')
  assert.equal(await guard.settleWithin(() => new Promise(() => {}), 20), guard.TIMED_OUT) // 끝나지 않는 약속(?submit=timeout)
  assert.deepEqual(await guard.settleWithin(() => Promise.reject(new Error('x')), 200), { ok: false, retryable: true })
  assert.deepEqual(await guard.settleWithin(() => { throw new Error('sync') }, 200), { ok: false, retryable: true })
  assert.equal(guard.SUBMIT_TIMEOUT_MS, 15_000)
})

test('failureKind·safeManageUrl·cooldownSeconds: 아는 code 만 갈래, 관리 주소는 https 만, 초는 1~86400 정수', () => {
  assert.equal(guard.failureKind({ ok: false, code: 'rate_limited' }), 'rate_limited')
  assert.equal(guard.failureKind({ ok: false, code: 'provider_unsupported' }), 'unsupported')
  assert.equal(guard.failureKind({ ok: false, code: 'scenario_unsupported' }), 'unsupported')
  for (const code of ['bot_check_failed', 'bot_check_unavailable', 'in_progress', 'vendor_x', undefined]) assert.equal(guard.failureKind({ ok: false, code }), 'other', String(code))
  assert.equal(guard.safeManageUrl('https://example.com/manage'), 'https://example.com/manage')
  for (const bad of ['http://example.com', 'javascript:alert(1)', '//example.com', 'https://a b', '', undefined, 3]) assert.equal(guard.safeManageUrl(bad), undefined, String(bad))
  assert.deepEqual([7, 0, -3, 2.2, 1e9, undefined, NaN, '5'].map(guard.cooldownSeconds), [7, 1, 1, 3, 86400, 1, 1, 1])
})

// ② 알림 조각 ─────────────────────────────────────────────────────────────
const NOTICES = { rateLimited: '{seconds}초 뒤에 다시 보낼 수 있어요', timeout: { title: '응답이 늦어요', body: '다시 시도해 주세요.', retry: '다시 시도하기' }, unsupported: { title: '여기서는 바꿀 수 없어요', link: '직접 관리하는 곳으로 가기' } }
test('SubmitExtras: 남은 초 줄은 role="timer"(읽어 주지 않는 시간 표시), 시간 초과는 [다시 시도], 지원 안 함은 https 링크 — 알림이 없으면 아무것도 그리지 않는다', () => {
  const noop = () => {}
  const timer = renderToStaticMarkup(h(guard.SubmitExtras, { notice: null, notices: NOTICES, cooldown: 12, onRetry: noop }))
  assert.match(timer, /role="timer"/)
  assert.match(timer, /12초 뒤에 다시 보낼 수 있어요/)
  assert.doesNotMatch(timer, /aria-live|role="alert"|role="status"/)
  const timeout = renderToStaticMarkup(h(guard.SubmitExtras, { notice: { kind: 'timeout', text: '', canRetry: true }, notices: NOTICES, cooldown: 0, onRetry: noop }))
  assert.match(timeout, /다시 시도하기/)
  assert.doesNotMatch(renderToStaticMarkup(h(guard.SubmitExtras, { notice: { kind: 'timeout', text: '', canRetry: false }, notices: NOTICES, cooldown: 0, onRetry: noop })), /다시 시도하기/)
  const link = renderToStaticMarkup(h(guard.SubmitExtras, { notice: { kind: 'unsupported', text: '', manageUrl: 'https://example.com/manage' }, notices: NOTICES, cooldown: 0, onRetry: noop }))
  assert.match(link, /href="https:\/\/example\.com\/manage"/)
  assert.match(link, /rel="noopener noreferrer"/)
  assert.doesNotMatch(renderToStaticMarkup(h(guard.SubmitExtras, { notice: { kind: 'unsupported', text: '' }, notices: NOTICES, cooldown: 0, onRetry: noop })), /<a /, 'manageUrl 이 없으면 죽은 링크를 그리지 않는다')
  assert.equal(renderToStaticMarkup(h(guard.SubmitExtras, { notice: { kind: 'timeout', text: '', canRetry: true }, notices: undefined, cooldown: 9, onRetry: noop })), '')
  assert.equal(guard.noticeTitle({ kind: 'timeout', text: '' }, NOTICES, { field: 'F', server: 'S' }), '응답이 늦어요')
  assert.equal(guard.noticeTitle({ kind: 'rate_limited', text: '' }, NOTICES, { field: 'F', server: 'S' }), 'S')
  assert.equal(guard.noticeTitle({ kind: 'field', text: '' }, NOTICES, { field: 'F', server: 'S' }), 'F')
})

// ③ 원천 규칙: 폼을 가진 모든 블록이 notices 를 받는다 ─────────────────────────────────
function blockSources() {
  const out = []
  for (const kind of readdirSync(BLOCKS)) {
    if (kind.startsWith('_') || !statSync(join(BLOCKS, kind)).isDirectory()) continue
    for (const f of readdirSync(join(BLOCKS, kind))) if (f.endsWith('.tsx')) out.push({ name: `${kind}/${f}`, src: readFileSync(join(BLOCKS, kind, f), 'utf8') })
  }
  return out
}
// 규칙 함수(음성 대조가 같은 함수를 부른다): usePortForm( 호출마다 notices, useFormFlow( 호출마다 notices 가 있어야 한다
export function noticeProblems(files) {
  const bad = []
  for (const { name, src } of files) {
    for (const m of src.matchAll(/usePortForm\(\{([\s\S]*?)\}\)\n/g)) if (!/\bnotices\b/.test(m[1])) bad.push(`${name}: usePortForm 에 notices 가 없다`)
    for (const m of src.matchAll(/useFormFlow\(submit, \{([\s\S]*?)\n?\s*\}\)/g)) if (!/\bnotices\b/.test(m[1])) bad.push(`${name}: useFormFlow 에 notices 가 없다`)
  }
  return bad
}
test('원천 규칙: usePortForm·useFormFlow 를 부르는 블록은 모두 notices(copy)를 넘긴다 — 그래야 시간 초과·요청 제한·지원 안 함이 켜진다', () => {
  const files = blockSources()
  const users = files.filter((f) => /usePortForm\(|useFormFlow\(/.test(f.src))
  assert.ok(users.length >= 20, `폼 블록 ${users.length}개`)
  assert.deepEqual(noticeProblems(files), [])
  // 음성 대조: notices 를 지운 사본은 잡힌다
  const broken = users.map((f) => ({ ...f, src: f.src.replace(/notices: (?:copy|a|copy\.form)\.notices,? ?/g, '').replace(/, notices: copy\.form\.notices/g, '') }))
  const calls = users.reduce((n, f) => n + (f.src.match(/usePortForm\(\{|useFormFlow\(submit/g) ?? []).length, 0) // 한 블록에 폼 훅이 둘 이상일 수 있다(Task 7b)
  assert.equal(noticeProblems(broken).length, calls, '모든 사용처가 잡혀야 한다')
})

// ④ 청약철회: 결제를 시작하는 블록은 PlanOffer(체크 포함)를 거친다 ───────────────────────────
test('원천 규칙: BillingPort["checkout"] 을 받는 블록은 PlanOffer 로 체크를 받고 withdrawalConsent 를 그대로 checkout 에 싣는다', () => {
  const files = blockSources().filter((f) => f.src.includes('BillingPort["checkout"]'))
  assert.deepEqual(files.map((f) => f.name).sort(), ['paywall/limit-meter.tsx', 'paywall/onboarding-offer.tsx', 'paywall/trial-ending.tsx', 'paywall/upgrade-modal.tsx'])
  const rule = (f) => /<PlanOffer\b/.test(f.src) && /const start = async \(consent: \{ withdrawalConsent\?: true \}\)/.test(f.src) && /checkout\(\{ planId: \w+\.id, (?:\.\.\.\(skipTrial \? \{ trial: false \} : \{\}\), )?\.\.\.consent \}\)/.test(f.src)
  for (const f of files) assert.ok(rule(f), `${f.name}: PlanOffer 로 청약철회 체크를 받고 consent 를 checkout 에 실어야 한다`)
  // 음성 대조: consent 를 싣지 않는 사본은 규칙에 걸린다
  assert.equal(rule({ src: files[0].src.replace(', ...consent', '') }), false)
  assert.equal(rule({ src: files[0].src.replace('<PlanOffer', '<div') }), false)
})

// ⑤ 요청 제한 대기 중 버튼(대장 A72): usePortForm 을 쓰는데 SubmitButton 이 아니라 Button·ChoiceButton 으로 처리를 시작하는 블록은
// 남은 초를 폼 옆 role="timer" 줄뿐 아니라 버튼에도 보인다 — disabled 식에 form.holdLabel 이 들어 있다(눌러도 조용히 무시되지 않는다).
function disabledExprs(src) {
  const sf = ts.createSourceFile('b.tsx', src, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX)
  const out = []
  const visit = (n) => {
    if (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) {
      const name = n.tagName.getText(sf)
      if (name === 'Button' || name === 'ChoiceButton') {
        const attr = n.attributes.properties.find((p) => ts.isJsxAttribute(p) && p.name.getText(sf) === 'disabled')
        if (attr?.initializer) out.push(attr.initializer.getText(sf))
      }
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
  return out
}
const HOLD_USERS = ['account/billing-manage.tsx', 'account/profile-settings.tsx', 'retention/cancel-flow.tsx', 'retention/payment-failed-banner.tsx', 'retention/renewal-consent.tsx']
test('원천 규칙(A72): 폼 요청 제한 대기 중에는 Button 으로 처리를 시작하는 블록의 버튼도 form.holdLabel 로 잠기고 남은 초를 보인다', () => {
  const files = blockSources()
  for (const rel of HOLD_USERS) {
    const f = files.find((x) => x.name === rel)
    assert.ok(f, rel)
    const exprs = disabledExprs(f.src)
    assert.ok(exprs.length >= 1, `${rel}: disabled 버튼을 찾지 못했다`)
    for (const e of exprs) assert.match(e, /holdLabel/, `${rel}: ${e} — form.holdLabel 이 없다`)
    assert.match(f.src, /form\.holdLabel \?\?/, `${rel}: 남은 초 문구를 버튼 글로 보이지 않는다`)
  }
  // 음성 대조: holdLabel 을 지운 사본은 잡힌다
  const f = files.find((x) => x.name === 'retention/payment-failed-banner.tsx')
  assert.equal(disabledExprs(f.src.replaceAll(' || !!form.holdLabel', '')).filter((e) => !/holdLabel/.test(e)).length, 1)
})

test('PlanOffer: 청약철회 고지와 필수 체크(미리 켜지 않음) — 버튼 앞 같은 판에 있고, 요청 제한 중에는 남은 초 글로 잠긴다', async () => {
  const { PlanOffer } = await load('registry/factory/blocks/_shared/plan-offer.tsx')
  const copy = {
    perMonth: '월', perYear: '년', vatIncluded: 'VAT 포함', vatExcluded: '부가세 별도', equivalentMonth: '하루 약 {amount}', equivalentYear: '한 달 약 {amount}', trial: '처음 {days}일 무료', firstCharge: '{date}에 {amount}({vat})', chargeNow: '오늘 {amount}({vat})',
    autoRenewMonth: '매달 갱신', autoRenewYear: '매년 갱신', howToCancel: '언제든 해지', termsLabel: '약관', termsHref: '#t', privacyLabel: '개인정보', privacyHref: '#p', ctaTrial: '{days}일 체험', ctaPay: '{amount} 결제', decline: '나중에', pendingLabel: '여는 중',
    withdrawal: { notice: '디지털 서비스는 이용을 시작하면 청약철회가 제한돼요', trial: '체험을 드려요', consentLabel: '제한 안내를 확인했어요', consentRequired: '체크해 주세요' },
  }
  const plan = { id: 'pro', name: '프로', price: { amount: 29000, currency: 'KRW', vatIncluded: true }, interval: 'month', features: [] }
  const html = renderToStaticMarkup(h(PlanOffer, { plan, copy, onCheckout: () => {}, onDecline: () => {} }))
  assert.match(html, /data-terms="withdrawal"/)
  assert.match(html, /청약철회가 제한돼요/)
  assert.match(html, /체험을 드려요/)
  const box = html.match(/<[a-z]+\b[^>]*data-consent="required"[^>]*>/)?.[0]
  assert.ok(box, '필수 체크가 있다')
  assert.match(box, /aria-checked="false"/, '미리 체크하지 않는다')
  assert.match(box, /aria-required="true"/)
  assert.ok(html.indexOf('data-terms="withdrawal"') < html.indexOf('data-choice="primary"'), '고지·체크가 결제 버튼 앞에 있다')
  assert.doesNotMatch(html, /체크해 주세요/, '체크 전에는 오류 문구가 없다(눌렀을 때만)')
  // 운영자가 제한을 두지 않는 정책(legal.withdrawalPolicy "full")이면 06-pages 가 copy.withdrawal 을 뺀다 — 고지도 필수 체크도 그리지 않는다(P4CON 수정 4)
  const { withdrawal: _w, ...noWithdrawal } = copy
  const free = renderToStaticMarkup(h(PlanOffer, { plan, copy: noWithdrawal, onCheckout: () => {}, onDecline: () => {} }))
  assert.doesNotMatch(free, /data-terms="withdrawal"/)
  assert.doesNotMatch(free, /data-consent="required"/)
  assert.doesNotMatch(free, /name="withdrawalConsent"/)
  assert.match(free, /data-choice="primary"/, '결제 버튼은 그대로 있다')
  const held = renderToStaticMarkup(h(PlanOffer, { plan, copy, onCheckout: () => {}, onDecline: () => {}, holdLabel: '12초 뒤에 다시 보낼 수 있어요' }))
  assert.match(held, /12초 뒤에 다시 보낼 수 있어요/)
  assert.match(held, /data-choice="primary"[^>]*(aria-disabled="true"|data-disabled)|(aria-disabled="true"|data-disabled)[^>]*data-choice="primary"/)
})

// ⑤ 로그인 유지 · 최근 사용 ────────────────────────────────────────────────────
test('AuthSignIn: 「로그인 유지」는 해제로 시작하는 체크 하나(copy.rememberMe 가 있을 때만), 「최근 사용」은 지난 방법에만', async () => {
  const { AuthSignIn } = await load('registry/factory/blocks/auth/sign-in.tsx')
  const { fixture } = await load('registry/factory/blocks/auth/sign-in.fixture.ts')
  const base = { ...fixture, initial: { methods: ['password', 'kakao', 'naver', 'google'] } }
  const html = renderToStaticMarkup(h(AuthSignIn, base))
  const box = html.match(/<[a-z]+\b[^>]*data-remember=""[^>]*>/)?.[0]
  assert.ok(box, '로그인 유지 체크가 있다')
  assert.match(box, /aria-checked="false"/)
  assert.match(html, /로그인 유지/)
  assert.doesNotMatch(html, /최근 사용/, '지난 방법이 없으면 표시도 없다')
  assert.match(renderToStaticMarkup(h(AuthSignIn, { ...base, rememberMe: true })).match(/<[a-z]+\b[^>]*data-remember=""[^>]*>/)?.[0] ?? '', /aria-checked="true"/)
  const kakao = renderToStaticMarkup(h(AuthSignIn, { ...base, lastMethod: 'kakao' }))
  assert.match(kakao, /data-social="kakao"[\s\S]*?data-last-used=""[\s\S]*?최근 사용/)
  assert.equal((kakao.match(/data-last-used/g) ?? []).length, 1, '한 방법에만')
  const pw = renderToStaticMarkup(h(AuthSignIn, { ...base, lastMethod: 'password' }))
  assert.match(pw, /data-last-used="password"/)
  assert.match(pw, /지난번에는 이메일로 로그인했어요/)
  const noCopy = renderToStaticMarkup(h(AuthSignIn, { ...base, copy: { ...fixture.copy, rememberMe: undefined, lastUsed: undefined }, lastMethod: 'kakao' }))
  assert.doesNotMatch(noCopy, /rememberMe|최근 사용/, 'copy 가 없으면 칸도 표시도 없다')
})

// A41: 비밀번호 칸의 「비밀번호 보기」 토글(aria-pressed, 이름은 안 바뀐다)과 Caps Lock 안내 자리. copy 에 show 가 있을 때만.
test('비밀번호 칸(A41): 보기 토글은 aria-pressed=false 로 시작하고 이름이 고정이며, Caps Lock 안내 자리는 읽기 도구용 status 로 늘 있다 — copy.password.show 가 없으면 토글도 없다', async () => {
  const { AuthSignIn } = await load('registry/factory/blocks/auth/sign-in.tsx')
  const { AuthSignUpConsents } = await load('registry/factory/blocks/auth/sign-up-consents.tsx')
  const { ConfirmationOrderComplete } = await load('registry/factory/blocks/confirmation/order-complete.tsx')
  const si = await load('registry/factory/blocks/auth/sign-in.fixture.ts')
  const su = await load('registry/factory/blocks/auth/sign-up-consents.fixture.ts')
  const oc = await load('registry/factory/blocks/confirmation/order-complete.fixture.ts')
  const methods = { methods: ['password'] }
  const cases = [
    ['sign-in', AuthSignIn, { ...si.fixture, initial: methods }],
    ['sign-up-consents', AuthSignUpConsents, { ...su.fixture, initial: methods }],
    ['order-complete', ConfirmationOrderComplete, oc.fixture],
  ]
  for (const [name, C, props] of cases) {
    const html = renderToStaticMarkup(h(C, props))
    const btn = html.match(/<button\b[^>]*aria-pressed="false"[^>]*>/)?.[0]
    assert.ok(btn, `${name}: 비밀번호 보기 토글이 있다`)
    assert.match(btn, /aria-label="비밀번호 보기"/, `${name}: 이름은 고정 — 누른 상태는 aria-pressed 가 알린다`)
    assert.match(html, /type="password"/, `${name}: 처음에는 가려져 있다`)
    assert.match(html, /<span role="status" class="sr-only"><\/span>/, `${name}: Caps Lock 안내 자리(읽기 도구용, 비어 있다)`)
    assert.doesNotMatch(html, /data-caps-lock/, `${name}: Caps Lock 이 꺼져 있으면 보이는 안내도 없다`)
  }
  // 음성 대조: copy 가 없으면 토글도 안내도 없고 기존 그대로
  const bare = renderToStaticMarkup(h(AuthSignIn, { ...si.fixture, initial: methods, copy: { ...si.fixture.copy, password: { label: '비밀번호', marker: '(필수)' } } }))
  assert.doesNotMatch(bare, /aria-pressed|비밀번호 보기|role="status" class="sr-only"/)
  assert.match(bare, /type="password"/)
})

// A45: 복사 버튼 조각 — 알림 자리(role=status)가 늘 있고, 클립보드가 되면 true·막히면 false(조용히 실패하지 않고 manual 안내로 이어진다)
test('CopyButton(A45): 버튼 옆에 비어 있는 role="status" 자리가 늘 있고, copyText 는 클립보드 성공 true · 거부 false · 옛 방식도 못 쓰면 false — 주소 복사(hours-location)도 이 조각을 쓴다', async () => {
  const { CopyButton, copyText } = await load('registry/factory/blocks/_shared/copy-button.tsx')
  const html = renderToStaticMarkup(h(CopyButton, { text: 'x', copy: { copy: '복사', copied: '복사했어요', manual: '직접 복사해 주세요' } }))
  assert.match(html, /<button\b[^>]*data-copy-button=""[^>]*>[\s\S]*복사<\/button>/)
  assert.match(html, /<span role="status" data-copy-status="idle" class="[^"]*">\s*<\/span>|<span role="status" data-copy-status="idle" class="[^"]*"><\/span>/, '처음에는 비어 있다 — 자리만 있다')
  const saved = { navigator: Object.getOwnPropertyDescriptor(globalThis, 'navigator'), document: Object.getOwnPropertyDescriptor(globalThis, 'document') }
  try {
    let written
    Object.defineProperty(globalThis, 'navigator', { value: { clipboard: { writeText: async (t) => { written = t } } }, configurable: true })
    assert.equal(await copyText('백업 코드 1234'), true)
    assert.equal(written, '백업 코드 1234')
    Object.defineProperty(globalThis, 'navigator', { value: { clipboard: { writeText: async () => { throw new Error('denied') } } }, configurable: true })
    Object.defineProperty(globalThis, 'document', { value: undefined, configurable: true })
    assert.equal(await copyText('x'), false, '클립보드도 옛 방식도 안 되면 false — 호출한 쪽이 manual 안내를 낸다')
  } finally {
    for (const [k, d] of Object.entries(saved)) d ? Object.defineProperty(globalThis, k, d) : delete globalThis[k]
  }
  const hours = readFileSync(join(BLOCKS, 'hours-location', 'hours-table-map-link.tsx'), 'utf8')
  assert.match(hours, /<CopyButton\b/)
  assert.doesNotMatch(hours, /navigator\.clipboard/, '주소 복사가 조각 밖에서 클립보드를 직접 부르지 않는다')
})
