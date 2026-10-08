// P3-6 WFBLK-A — 결제·구독 화면 UX 감사(E01·E03·E04·E09·F02·F03·F04·F05·F12·F13) 검사.
// 실행: node --test --test-force-exit --test-timeout=120000 factory/scripts/blocks-billing-ux.test.mjs
// 방법은 blocks-upgrade-complete.test.mjs 와 같다 — 컴파일본을 typescript 로 .tmp 에 옮겨 정적 렌더한 마크업을 본다.
// 타이머·효과(결제 복구 확인·열고 닫기 포커스)는 브라우저 검사(blocks:states · blocks:a11y · blocks:gates)가 본다.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'
import { loadBlocks } from './blocks.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = join(root, '.tmp', 'blocks-billing-ux-test')
const COMPILED = join(root, 'registry', 'factory', 'blocks', '_compiled')
const SRC = join(root, 'registry', 'factory', 'blocks')

const STUBS = {
  [join(root, 'registry', 'factory', 'motion', 'use-gsap-scene.ts')]: 'export function useGsapScene() {}\n',
  [join(root, 'registry', 'factory', 'motion', 'gsap-techniques.ts')]: 'export function rise() {}\n',
}
const loaded = new Map()
const outPath = (abs) => join(OUT, relative(root, abs).replace(/\.tsx?$/, '.mjs'))
const resolveSource = (base) => [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts')].find((f) => existsSync(f) && /\.(mjs|tsx?)$/.test(f))
function transpile(abs) {
  if (abs.endsWith('.mjs')) return abs
  if (loaded.has(abs)) return loaded.get(abs)
  const out = outPath(abs)
  loaded.set(abs, out)
  let text
  if (STUBS[abs] !== undefined) text = STUBS[abs]
  else {
    text = ts.transpileModule(readFileSync(abs, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
    text = text.replace(/(from\s+|import\s*\(\s*|import\s+|export\s+\*\s+from\s+)(["'])(@\/|\.{1,2}\/)([^"']+)\2/g, (_, kw, q, pre, p) => {
      const base = pre === '@/' ? join(root, p) : resolve(dirname(abs), pre + p)
      const src = resolveSource(base)
      if (!src) throw new Error(`import 대상 없음: ${pre}${p} (${relative(root, abs)})`)
      return `${kw}${q}${pathToFileURL(transpile(src)).href}${q}`
    })
  }
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, text)
  return out
}
const load = async (abs) => import(pathToFileURL(transpile(abs)).href)

const React = await import('react')
const { renderToStaticMarkup } = await import('react-dom/server')
const textOf = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
// 태그를 지우되 사이에 공백을 넣지 않는다 — 날짜·금액 같은 인라인 칸이 문장 안에서 이어 읽히는 모양(「10월 4일에 다시」)
const flat = (html) => html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
const mod = (kind, name) => load(join(COMPILED, kind, `${name}.tsx`))
const fix = (kind, name) => load(join(SRC, kind, `${name}.fixture.ts`))
const src = (kind, name) => readFileSync(join(COMPILED, kind, `${name}.tsx`), 'utf8')
const el = (C, props) => renderToStaticMarkup(React.createElement(C, props))

const cta = await load(join(COMPILED, '_shared', 'plan-cta.tsx'))
const offer = await load(join(COMPILED, '_shared', 'plan-offer.tsx'))
const { MOCK_PLANS } = await load(join(root, 'registry', 'factory', 'contract', 'adapter-mock.ts'))

// ───────────────────────── E01·E03 요금제 행동 ─────────────────────────
const BASE = { label: '시작하기', href: '/sign-up' }
test('plan-cta: 로그아웃은 가입 주소 + ?plan=<id>, 로그인은 /upgrade?plan=<id>, 지금 요금제는 표지(E01)', () => {
  const copy = { planIds: ['free', 'team'] }
  assert.deepEqual(cta.resolvePlanCta(copy, {}, 1, BASE, 12900), { label: '시작하기', href: '/sign-up?plan=team', current: false })
  assert.equal(cta.resolvePlanCta(copy, { signedIn: true }, 1, BASE, 12900).href, '/upgrade?plan=team', '로그인이면 결제로, 고른 요금제가 실린다')
  assert.equal(cta.resolvePlanCta({ ...copy, signedInHref: '/checkout/{plan}?i={interval}' }, { signedIn: true }, 1, BASE, 12900, undefined, 'year').href, '/checkout/team?i=year')
  const cur = cta.resolvePlanCta({ ...copy, currentLabel: '지금 쓰는 요금제' }, { signedIn: true, currentPlanId: 'team' }, 1, BASE, 12900)
  assert.equal(cur.current, true)
  assert.equal(cur.label, '지금 쓰는 요금제')
})

test('plan-cta: 옛 동작은 그대로 — planIds 가 없으면 주소는 원래 것이고, 문의형·무료는 로그인해도 결제로 보내지 않는다', () => {
  assert.deepEqual(cta.resolvePlanCta({}, { signedIn: true }, 0, BASE, 12900), { label: '시작하기', href: '/sign-up', current: false })
  assert.equal(cta.resolvePlanCta({ planIds: ['a'] }, { signedIn: true }, 0, BASE, null).href, '/sign-up', '문의형(금액 null)')
  assert.equal(cta.resolvePlanCta({ planIds: ['a'] }, { signedIn: true }, 0, BASE, 0).href, '/sign-up', '무료(금액 0)')
  assert.equal(cta.resolvePlanCta({ planIds: ['a'] }, {}, 0, { label: '문의', href: '/contact' }, null).href, '/contact', '문의 쪽에 ?plan= 을 싣지 않는다')
  assert.equal(cta.resolvePlanCta({ planIds: ['a'] }, {}, 0, { label: '시작', href: '#signup' }, 100).href, '#signup', '해시 주소는 건드리지 않는다')
  assert.equal(cta.withQuery('/sign-up?plan=x', 'plan', 'y'), '/sign-up?plan=x', '이미 있으면 그대로')
  assert.equal(cta.withQuery('/sign-up#top', 'plan', 'y'), '/sign-up?plan=y#top')
})

for (const name of ['three-tier-cards', 'feature-matrix', 'toggle-annual']) {
  test(`pricing/${name}: signedIn 이면 결제 주소·요금제 id, 로그아웃이면 가입 + ?plan=, currentPlanId 는 비활성 표지(E01)`, async () => {
    const m = await mod('pricing', name)
    const f = await fix('pricing', name)
    const C = Object.values(m).find((v) => typeof v === 'function' && /^Pricing/.test(v.name))
    const copy = { ...f.fixture.copy, cta: { label: '시작하기', href: '/sign-up' }, planCtas: undefined, planIds: ['starter', 'team', 'multi'], currentLabel: '지금 쓰는 요금제' }
    const out = el(C, { copy })
    assert.match(out, /href="\/sign-up\?plan=team"/)
    assert.match(out, /href="\/sign-up\?plan=multi"/)
    assert.doesNotMatch(out, /\/upgrade/)
    const inn = el(C, { copy, signedIn: true })
    assert.match(inn, /href="\/upgrade\?plan=team"/)
    assert.match(inn, /href="\/upgrade\?plan=multi"/)
    assert.doesNotMatch(inn, /href="\/upgrade\?plan=starter"/, '무료 요금제는 결제로 보내지 않는다')
    assert.doesNotMatch(inn, /href="\/sign-up\?plan=/)
    const cur = el(C, { copy, signedIn: true, currentPlanId: 'team' })
    assert.match(cur, /data-current-plan=""[^>]*>[^<]*지금 쓰는 요금제/s, '지금 요금제는 표지')
    assert.doesNotMatch(cur, /href="\/upgrade\?plan=team"/)
    // 호환: signedIn·planIds 가 없으면 예시 그대로
    assert.doesNotMatch(el(C, { copy: f.fixture.copy }), /\?plan=|\/upgrade/)
  })
}

test('pricing/toggle-annual: 연 결제는 연 총액과 아끼는 금액을 돈으로 보이고, 연 요금제 id 가 행동에 실린다(E03)', async () => {
  const m = await mod('pricing', 'toggle-annual')
  const f = await fix('pricing', 'toggle-annual')
  const copy = { ...f.fixture.copy, cta: { label: '시작', href: '/sign-up' }, planIds: ['s', 't', 'm'], annualPlanIds: ['s-y', 't-y', 'm-y'] }
  const annual = el(m.PricingToggleAnnual, { copy, defaultPeriod: 'annual', signedIn: true })
  // 팀: 12,900 × 12 = 154,800 → 20% 할인 연 123,840, 아끼는 금액 30,960
  assert.match(textOf(annual), /연 123,840원 한 번에 결제/)
  assert.match(annual, /data-saving=""[^>]*>월 결제보다 연 30,960원 아껴요/)
  assert.match(annual, /href="\/upgrade\?plan=t-y"/, '연 결제로 보는 동안 행동은 연 요금제 id')
  const monthly = el(m.PricingToggleAnnual, { copy, defaultPeriod: 'monthly', signedIn: true })
  assert.doesNotMatch(monthly, /data-saving=/)
  assert.match(monthly, /href="\/upgrade\?plan=t"/)
  // 연 요금제의 실제 값(annualPrices)이 있으면 그것이 이긴다 — 결제창과 같은 금액
  const real = el(m.PricingToggleAnnual, { copy, defaultPeriod: 'annual', annualPrices: { 팀: { amount: 120000, currency: 'KRW', vatIncluded: true } } })
  assert.match(textOf(real), /연 120,000원 한 번에 결제/)
  assert.match(real, /월 결제보다 연 34,800원 아껴요/)
  // 연 요금제 id 가 따로 없으면 planIds + interval=year
  const noAnnualIds = el(m.PricingToggleAnnual, { copy: { ...copy, annualPlanIds: undefined }, defaultPeriod: 'annual' })
  assert.match(noAnnualIds, /href="\/sign-up\?plan=t&amp;interval=year"/)
})

// ───────────────────────── E04 업그레이드 대화상자의 제안 판 ─────────────────────────
test('plan-offer(pinActions): 전환 고지(첫 결제일·금액·해지 방법)와 필수 체크가 행동 줄과 같은 고정 줄에 있다 — 스크롤 없이 버튼 곁에 보인다(E04)', async () => {
  const f = await fix('paywall', 'upgrade-modal')
  const pro = MOCK_PLANS.find((p) => p.id === 'pro')
  const props = { plan: pro, copy: f.fixture.copy.offer, firstChargeAt: '2026-10-15T00:00:00.000Z', onCheckout() {}, onDecline() {}, pinActions: true, emphasis: 'primary' }
  const h = el(offer.PlanOffer, props)
  const at = (re) => h.search(re)
  const pinned = at(/data-pinned-terms=""/)
  assert.ok(pinned > 0)
  assert.ok(pinned < at(/data-terms="first-charge"/), '고정 줄 안에 첫 결제 고지')
  assert.ok(at(/data-terms="first-charge"/) < at(/data-terms="cancel"/))
  assert.ok(at(/data-terms="cancel"/) < at(/data-consent="required"/), '해지 방법 다음에 필수 체크')
  assert.ok(at(/data-consent="required"/) < at(/data-choice="dismiss"/), '체크는 행동 줄 위')
  assert.ok(at(/data-choice="dismiss"/) < at(/data-choice="primary"/), '순서: [나중에][시작]')
  // 본문 목록에는 같은 두 줄이 되풀이되지 않는다
  assert.equal((h.match(/data-terms="first-charge"/g) ?? []).length, 1)
  assert.equal((h.match(/data-terms="cancel"/g) ?? []).length, 1)
  const text = flat(h)
  assert.match(text, /체험이 끝나는 2026년 10월 15일에 29,000원\(VAT 포함\)이 처음 결제돼요/, '전환일·금액')
  assert.match(text, /결제 화면에서 입력한 결제 수단/, '결제 수단')
  assert.match(text, /계정 &gt; 결제 관리에서 언제든 해지/, '해지 방법')
  // 주 버튼 글에 체험이 끝난 뒤 금액이 함께 있다
  assert.match(flat(h.slice(h.indexOf('data-choice="primary"'))), /14일 무료 체험 시작 · 이후 29,000원\/월/)
})

test('plan-offer: emphasis="primary" 는 채운 주 버튼(외곽선 아님), 기본(equal)은 두 선택지가 같은 모양 — 기존 변형·관문은 그대로(L3)', async () => {
  const f = await fix('paywall', 'upgrade-modal')
  const pro = MOCK_PLANS.find((p) => p.id === 'pro')
  const base = { plan: pro, copy: f.fixture.copy.offer, firstChargeAt: '2026-10-15T00:00:00.000Z', onCheckout() {}, onDecline() {} }
  const primary = el(offer.PlanOffer, { ...base, pinActions: true, emphasis: 'primary' })
  const tag = (h, choice) => h.match(new RegExp(`<button[^>]*data-choice="${choice}"[^>]*>`))?.[0] ?? ''
  assert.match(tag(primary, 'primary'), /bg-primary/, '주 버튼은 채운 기본 변형')
  assert.doesNotMatch(tag(primary, 'primary'), /bg-background/)
  assert.match(tag(primary, 'dismiss'), /bg-background/, '「나중에」는 외곽선 — 같은 크기·같은 줄')
  // L3 에서 남기는 것: 두 선택지는 같은 크기 훅(cn-block-choice → min-h-12·같은 폭)이고 같은 ChoiceRow 안, 순서는 [나중에][시작]
  for (const c of ['primary', 'dismiss']) assert.match(tag(primary, c), /\bmin-h-12\b/, `${c} 크기`)
  assert.equal(primary.match(/data-choice-group=""/g)?.length, 1, '한 줄(ChoiceRow) 안')
  const equal = el(offer.PlanOffer, base)
  assert.match(tag(equal, 'decline'), /bg-background/)
  assert.match(tag(equal, 'primary'), /bg-background/, '기본은 두 선택지가 대등한 외곽선')
  // 고정 줄이 없으면 고지가 본문 목록에 그대로 있다
  assert.doesNotMatch(equal, /data-pinned-terms/)
  assert.match(equal, /data-terms="first-charge"/)
  assert.match(equal, /data-terms="withdrawal"[^]*data-consent="required"/, '고정하지 않은 판에서는 체크가 철회 고지 안에')
})

test('upgrade-modal: 닫으면 포커스가 연 버튼으로(finalFocus) · 무료 사용자는 「무료 요금제」 머리(E04)', async () => {
  const s = src('paywall', 'upgrade-modal')
  assert.match(s, /finalFocus=\{openRef\}/)
  assert.match(s, /ref=\{openRef\}/)
  assert.doesNotMatch(s, /emphasis="primary"/, '운영자 판정(10-04 「L3 따름」): 업그레이드 대화상자는 두 선택지가 대등하다')
  const meta = JSON.parse(readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../registry/factory/blocks/paywall/upgrade-modal.block.json'), 'utf8'))
  assert.ok(meta.rules.includes('L3'), '메타 rules 에 L3 가 있다')
  const f = await fix('paywall', 'upgrade-modal')
  assert.ok(f.fixtureMax.currentPlanId === null)
  assert.equal(f.fixture.copy.compare.currentFree, '지금(무료 요금제)')
  assert.doesNotMatch(JSON.stringify(f.fixture.copy.compare), /Starter/)
})

// ───────────────────────── F02 결제 실패 ─────────────────────────
const PAST_DUE = { planId: 'pro', status: 'past_due', currentPeriodEnd: '2026-10-31T15:00:00.000Z', graceEndsAt: '2026-10-10T15:00:00.000Z', paymentIssue: { reason: 'card_declined', retryAt: '2026-10-03T15:00:00.000Z' } }
test('payment-failed-banner: past_due 는 role=alert 비차단 띠 — 다시 결제하는 날·접근 마감일·카드 변경 한 번(F02)', async () => {
  const m = await mod('retention', 'payment-failed-banner')
  const f = await fix('retention', 'payment-failed-banner')
  const h = el(m.RetentionPaymentFailedBanner, { ...f.fixture, initial: { subscription: PAST_DUE } })
  assert.match(h, /<div[^>]*data-payment-issue="card_declined"[^>]*role="alert"|<div[^>]*role="alert"[^>]*data-payment-issue="card_declined"/)
  assert.doesNotMatch(h, /role="dialog"|aria-modal/, '접근을 막는 모달이 아니다')
  const t = textOf(h)
  assert.match(flat(h), /2026년 10월 4일에 다시 결제해요/, '재시도일')
  assert.match(flat(h), /2026년 10월 10일까지 모든 기능을 그대로 쓸 수 있어요/, '접근 마감일(graceEndsAt)')
  assert.match(t, /결제 수단 바꾸기/)
  assert.equal((h.match(/<button/g) ?? []).length, 1, '카드 변경은 단추 하나')
  // graceEndsAt 이 없으면 예전 글 그대로
  assert.match(flat(el(m.RetentionPaymentFailedBanner, { ...f.fixture, initial: { subscription: { ...PAST_DUE, graceEndsAt: undefined } } })), /그때까지 모든 기능을 그대로 쓸 수 있어요/)
  // 복구(active)면 띠가 없다(hidden)
  const ok = el(m.RetentionPaymentFailedBanner, { ...f.fixture, initial: { subscription: { planId: 'pro', status: 'active' } } })
  assert.match(ok, /<section[^>]*hidden/)
  assert.doesNotMatch(ok, /role="alert"/)
})

test('payment-failed-banner: 복구 확인 글 role=status 가 소스에 있다(복구 → 띠 사라짐 + 확인 글, 브라우저 검사가 이어서 본다)', () => {
  const s = src('retention', 'payment-failed-banner')
  assert.match(s, /data-recovered=""/)
  assert.match(s, /role="status"/)
  assert.match(s, /wasIssue/)
})

test('billing-manage: past_due 는 실패한 갱신일을 「다음 결제일」로 보이지 않는다 — 재결제 시도일 칸 + 접근 마감일(F02)', async () => {
  const m = await mod('account', 'billing-manage')
  const f = await fix('account', 'billing-manage')
  const plans = [...MOCK_PLANS]
  const h = el(m.AccountBillingManage, { ...f.fixture, initial: { subscription: PAST_DUE, plans } })
  assert.match(h, /data-billing="retry-date"/)
  assert.doesNotMatch(h, /data-billing="next-date"/)
  const t = flat(h)
  assert.match(t, /다시 결제를 시도하는 날2026년 10월 4일결제 금액/, '요약 칸: 재결제 시도일(부터 글자는 문장에서)')
  assert.doesNotMatch(t, /다음 결제일2026년 11월/)
  assert.match(t, /2026년 10월 4일에 다시 결제해요/)
  assert.match(t, /2026년 10월 10일까지 모든 기능을 그대로 쓸 수 있어요/)
  // 옛 문구(labels.retry 없음)는 날짜 칸이 「—」다 — 갱신일을 그대로 보이지 않는다
  const old = el(m.AccountBillingManage, { ...f.fixture, copy: { ...f.fixture.copy, labels: { ...f.fixture.copy.labels, retry: undefined } }, initial: { subscription: PAST_DUE, plans } })
  assert.doesNotMatch(flat(old), /다음 결제일2026년/)
  assert.match(flat(old), /다음 결제일—/)
})

// ───────────────────────── F03 해지·만료 뒤 다시 시작 ─────────────────────────
for (const status of ['canceled', 'expired']) {
  test(`billing-manage: ${status} 뒤에는 한 번에 닿는 「다시 시작」 — 요금제 id 가 실린 링크, 표는 「시작하기」(F03)`, async () => {
    const m = await mod('account', 'billing-manage')
    const f = await fix('account', 'billing-manage')
    const sub = status === 'canceled' ? { planId: 'pro', status, cancelAt: '2026-09-30T15:00:00.000Z' } : { planId: 'pro', status, currentPeriodEnd: '2026-09-30T15:00:00.000Z' }
    const h = el(m.AccountBillingManage, { ...f.fixture, initial: { subscription: sub, plans: [...MOCK_PLANS] } })
    assert.match(h, new RegExp(`data-restart="${status}"`))
    assert.match(h, /<a[^>]*href="#upgrade-pro"[^>]*data-restart-action=""|<a[^>]*data-restart-action=""[^>]*href="#upgrade-pro"/)
    assert.match(textOf(h), /프로\(예시\) 다시 시작/)
    assert.match(h, /href="#upgrade-basic"/, '표의 다른 요금제도 시작 링크')
    assert.doesNotMatch(h, /aria-pressed/, '변경할 구독이 없다 — 「바꾸기」 단추가 없다')
    assert.doesNotMatch(h, /data-billing="cancel"/, '해지 진입 링크도 없다')
    assert.doesNotMatch(textOf(h), /결제 수단 바꾸기/)
    assert.doesNotMatch(textOf(h), /지금 쓰는 중/, '끝난 구독을 지금 요금제로 표시하지 않는다')
  })
}
test('billing-manage: restart 문구가 없으면 예전 모양 그대로(호환)', async () => {
  const m = await mod('account', 'billing-manage')
  const f = await fix('account', 'billing-manage')
  const h = el(m.AccountBillingManage, { ...f.fixture, copy: { ...f.fixture.copy, restart: undefined }, initial: { subscription: { planId: 'pro', status: 'expired', currentPeriodEnd: '2026-09-30T15:00:00.000Z' }, plans: [...MOCK_PLANS] } })
  assert.doesNotMatch(h, /data-restart/)
  assert.match(h, /aria-pressed/)
})

// ───────────────────────── F05·F12·F13 해지 흐름 ─────────────────────────
const SUB = { planId: 'pro', status: 'active', currentPeriodEnd: '2026-10-31T15:00:00.000Z' }
test('cancel-flow: 대안이 없으면 확인 장이 없다 — ① 의 [해지하기] 가 바로 해지하고 두 단계다(F12)', async () => {
  const m = await mod('retention', 'cancel-flow')
  const f = await fix('retention', 'cancel-flow')
  const noOffer = el(m.RetentionCancelFlow, { ...f.fixture, offers: [], initial: { subscription: SUB, plans: [...MOCK_PLANS] } })
  assert.match(noOffer, /data-flow="cancel"[^>]*data-steps="2"|data-steps="2"[^>]*data-flow="cancel"/)
  assert.match(noOffer, /<button[^>]*data-choice="decline"[^>]*>해지하기<\/button>/, '① 의 거절 버튼이 곧 [해지하기]')
  assert.doesNotMatch(noOffer, /해지 계속하기/)
  const steps = (html) => (html.match(/<ol[^>]*>[^]*?<\/ol>/)?.[0].match(/<li\b/g) ?? []).length
  assert.equal(steps(noOffer), 2, '단계 줄은 둘')
  assert.doesNotMatch(noOffer, /다른 방법/)
  // 대안이 있으면 세 단계, ① 은 [해지 계속하기]
  const withOffer = el(m.RetentionCancelFlow, { ...f.fixture, initial: { subscription: SUB, plans: [...MOCK_PLANS] } })
  assert.match(withOffer, /data-steps="3"/)
  assert.equal(steps(withOffer), 3)
  assert.match(withOffer, /해지 계속하기/)
  assert.match(textOf(withOffer), /1 해지 방식 2 다른 방법 3 해지 완료/)
  // 사유는 선택(표시)이다
  assert.match(withOffer, /data-optional-question="reason"/)
})

test('cancel-flow: 이미 해지가 예약돼 있으면 흐름 대신 상태와 [계속 쓰기] — 해지 흐름을 다시 보이지 않는다(F05)', async () => {
  const m = await mod('retention', 'cancel-flow')
  const f = await fix('retention', 'cancel-flow')
  const sched = { ...SUB, cancelAt: SUB.currentPeriodEnd }
  const h = el(m.RetentionCancelFlow, { ...f.fixture, resume: async () => ({ ok: true, data: SUB }), initial: { subscription: sched, plans: [...MOCK_PLANS] } })
  assert.match(h, /data-cancel-scheduled=""/)
  assert.doesNotMatch(h, /data-flow="cancel"|data-choice="decline"/)
  assert.match(h, /data-end-date="2026-10-31T15:00:00.000Z"/)
  assert.match(textOf(h), /이미 해지를 예약했어요/)
  assert.match(flat(h), /2026년 10월 31일까지 쓸 수 있고/)
  assert.match(h, /<button[^>]*data-resume=""[^>]*>계속 쓰기<\/button>/)
  // resume 포트가 없으면 링크
  const link = el(m.RetentionCancelFlow, { ...f.fixture, initial: { subscription: sched, plans: [...MOCK_PLANS] } })
  assert.match(link, /<a[^>]*data-resume=""|<a[^>]*href="#billing"[^>]*data-resume=""/)
  // 옛 문구(scheduled 없음)는 흐름 그대로(호환)
  const old = el(m.RetentionCancelFlow, { ...f.fixture, copy: { ...f.fixture.copy, scheduled: undefined }, initial: { subscription: sched, plans: [...MOCK_PLANS] } })
  assert.match(old, /data-flow="cancel"/)
})

test('cancel-flow: 완료 화면에 「다음 결제는 없다」·종료일·다른 결제 경로 해지 안내가 있다(F13, 소스·문구)', async () => {
  const s = src('retention', 'cancel-flow')
  assert.match(s, /data-no-charge=""/)
  assert.match(s, /data-other-channels=""/)
  assert.match(s, /data-end-date=/)
  const f = await fix('retention', 'cancel-flow')
  assert.match(f.fixture.copy.done.noMoreCharges, /다음 결제는 없어요/)
  assert.match(f.fixture.copy.done.otherChannels.body, /앱을 지우는 것은 해지가 아니에요/)
})

// ───────────────────────── F04 가격 변경 동의 쪽 ─────────────────────────
test('renewal-consent: 메일에서 곧장 오는 쪽(standalone) — 전후 가격·적용일·고지·대등한 두 버튼, 동의할 것이 없어도 빈 화면이 아니다(F04)', async () => {
  const m = await mod('retention', 'renewal-consent')
  const f = await fix('retention', 'renewal-consent')
  const change = { from: { amount: 29000, currency: 'KRW', vatIncluded: true }, to: { amount: 33000, currency: 'KRW', vatIncluded: true }, effectiveAt: '2026-10-30T15:00:00.000Z', consentBy: '2026-10-23T15:00:00.000Z', kind: 'price_increase' }
  const h = el(m.RetentionRenewalConsent, { ...f.fixture, standalone: true, initial: { subscription: { planId: 'pro', status: 'active', pendingPriceChange: change } } })
  const t = textOf(h)
  assert.match(t, /29,000원/)
  assert.match(t, /33,000원/)
  assert.match(flat(h), /적용일2026년 10월 31일/, '적용일')
  assert.match(h, /data-consent-by=/)
  assert.match(h, /data-terms="payment-method"/)
  assert.match(h, /data-terms="cancel"/, '해지 방법·효과 고지')
  assert.ok(h.search(/data-terms="notice"/) < h.search(/data-choice="decline"/), '고지는 버튼 위')
  const tag = (c) => h.match(new RegExp(`<button[^>]*data-choice="${c}"[^>]*>`))?.[0] ?? ''
  assert.match(tag('decline'), /bg-background/)
  assert.match(tag('primary'), /bg-background/, '동의·거절은 같은 모양(L3)')
  // 직접 준 change 가 구독 읽기보다 앞선다
  const given = el(m.RetentionRenewalConsent, { ...f.fixture, standalone: true, change, initial: { subscription: { planId: 'pro', status: 'active' } } })
  assert.match(textOf(given), /33,000원/)
  // 동의할 것이 없으면 안내 + 링크(빈 화면 아님)
  const empty = el(m.RetentionRenewalConsent, { ...f.fixture, standalone: true, initial: { subscription: { planId: 'pro', status: 'active' } } })
  assert.match(empty, /data-standalone="empty"/)
  assert.match(textOf(empty), /동의할 가격 변경이 없어요/)
  assert.match(empty, /href="#billing"/)
  assert.doesNotMatch(empty, /<section[^>]*hidden/)
  // standalone 이 아니면 예전처럼 빈 채로 숨는다(다른 화면 안의 판)
  const hidden = el(m.RetentionRenewalConsent, { ...f.fixture, initial: { subscription: { planId: 'pro', status: 'active' } } })
  assert.match(hidden, /<section[^>]*hidden/)
  // 읽는 중에는 로딩
  const loading = el(m.RetentionRenewalConsent, { ...f.fixture, standalone: true, subscription: () => new Promise(() => {}) })
  assert.match(loading, /data-standalone="loading"/)
})

// ───────────────────────── E09 결제 직후 영수증 ─────────────────────────
test('upgrade-complete: 영수증이 가는 메일 주소와 청구서·영수증 보기 길을 잇는다(E09) — 없으면 예전 모양 그대로', async () => {
  const m = await mod('confirmation', 'upgrade-complete')
  const f = await fix('confirmation', 'upgrade-complete')
  const ACTIVE = { planId: 'pro', status: 'active', currentPeriodEnd: '2026-10-31T15:00:00.000Z' }
  const h = el(m.ConfirmationUpgradeComplete, { ...f.fixture, email: 'owner@example.com', portal: async () => ({ ok: true, data: { redirectUrl: '#p' } }), initial: { subscription: ACTIVE } })
  assert.match(flat(h), /영수증은 owner@example\.com로 보냈어요/)
  assert.match(h, /data-invoices=""/)
  assert.equal((h.match(/data-next-action=""/g) ?? []).length, 1, '다음 행동은 여전히 하나')
  const plain = el(m.ConfirmationUpgradeComplete, { ...f.fixture, initial: { subscription: ACTIVE } })
  assert.doesNotMatch(plain, /data-invoices=/)
  assert.match(textOf(plain), /영수증은 가입한 이메일로 보냈어요/)
})

test('메타·검사: 내 블록 메타가 통과하고 새 조각 plan-cta 가 조각 목록에 있다', () => {
  const mine = loadBlocks(root).filter((x) => ['billing-manage', 'payment-failed-banner', 'upgrade-modal', 'cancel-flow', 'renewal-consent', 'upgrade-complete', 'three-tier-cards', 'toggle-annual', 'feature-matrix'].includes(x.variant))
  assert.equal(mine.length, 9)
  for (const b of mine) assert.ok(b.meta.success, `${b.kind}/${b.variant} 메타`)
  assert.ok(existsSync(join(SRC, '_shared', 'plan-cta.tsx')))
})
