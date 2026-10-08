// 레인 D 블록 규칙 검사(P3-2 Task 11 D1): 메타 rules 에 적은 마케팅·운영 규칙(factory-rules.md §22) 하나마다 정적 검사가 하나 이상 있다.
// 실행: node --test --test-force-exit --test-timeout=120000 factory/scripts/blocks-rules.test.mjs
// 방법: 소비자에게 나가는 컴파일본(registry/factory/blocks/_compiled/<kind>/<variant>.tsx — 훅이 실제 클래스로 풀린 것)을 typescript transpileModule 로
// .tmp/blocks-rules-test 에 옮겨 예시 콘텐츠(.fixture.ts) + 서버가 미리 읽은 값(initial)으로 정적 렌더(react-dom/server)한 뒤 마크업을 본다 — 브라우저 없음.
// 가짜로 바꾸는 모듈(정적 렌더에서 뜻이 없거나 서버에서 비어 있는 것): 모션 장면·기법(아무것도 안 함) · 대화상자(열림 상태면 제자리에 그린다 — base-ui 포털은
// 서버에서 비어 있다) · 며칠 쉬기(쉬지 않음 — localStorage 는 서버에 없다). 규칙이 흐름·클릭을 요구하는 부분(해지 ②③ 단계·닫기가 동의가 아님 등)은
// 순수 함수(pickRetentionOffer)로 보거나 브라우저 검사(레인 보고서)로 넘긴다.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'
import { loadBlocks, RULE_ID } from './blocks.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = join(root, '.tmp', 'blocks-rules-test')
const COMPILED = join(root, 'registry', 'factory', 'blocks', '_compiled')

// ── 가짜 모듈 ──────────────────────────────────────────────────────────────────────────────────────
const STUBS = {
  [join(root, 'registry', 'factory', 'motion', 'use-gsap-scene.ts')]: 'export function useGsapScene() {}\n',
  [join(root, 'registry', 'factory', 'motion', 'gsap-techniques.ts')]: 'export function rise() {}\n',
  [join(COMPILED, '_shared', 'snooze.tsx')]: 'export function useSnooze() { return { snoozed: false, snooze() {} } }\n',
  [join(root, 'registry', 'factory', 'ui', 'dialog.tsx')]: [
    'import * as React from "react"',
    'const Open = React.createContext(false)',
    'export function Dialog({ open, defaultOpen, children }) { return React.createElement(Open.Provider, { value: !!(open ?? defaultOpen) }, children) }',
    'export function DialogContent({ children, className }) { const open = React.useContext(Open); return open ? React.createElement("div", { role: "dialog", "aria-modal": "true", className, "data-stub-dialog": "" }, children, React.createElement("button", { type: "button", "data-dialog-close": "" }, "닫기")) : null }',
    'export function DialogHeader({ children }) { return React.createElement("div", null, children) }',
    'export function DialogTitle({ children, className }) { return React.createElement("h2", { className }, children) }',
    'export function DialogDescription({ children, className }) { return React.createElement("p", { className }, children) }',
    '',
  ].join('\n'),
}

const loaded = new Map()
function outPath(abs) {
  return join(OUT, relative(root, abs).replace(/\.tsx?$/, '.mjs'))
}
function resolveSource(base) {
  return [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts')].find((f) => existsSync(f) && /\.(mjs|tsx?)$/.test(f))
}
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
const mock = await load(join(root, 'registry', 'factory', 'contract', 'adapter-mock.ts'))
const { EVENTS } = await load(join(root, 'registry', 'factory', 'contract', 'events.ts'))

// Task 7b 블록(account/security·credentials·delete-account)은 blocks-rules-7b.test.mjs 가 본다
// account/permissions(FV1 Task 5.9)는 메타 rules 가 없다 — required-sections.test.mjs 가 본다
const T7B = new Set(['account/security', 'account/credentials', 'account/delete-account', 'account/permissions'])
const blocks = loadBlocks(root).filter((b) => b.meta.success && b.meta.data.rules?.length && !T7B.has(`${b.kind}/${b.variant}`))
const D1_KINDS = ['auth', 'account', 'paywall', 'retention', 'consent']
const byName = new Map(blocks.map((b) => [`${b.kind}/${b.variant}`, b]))

async function block(kind, variant) {
  const mod = await load(join(COMPILED, kind, `${variant}.tsx`))
  const fx = await load(join(root, 'registry', 'factory', 'blocks', kind, `${variant}.fixture.ts`))
  const name = variant.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join('')
  const C = mod[kind[0].toUpperCase() + kind.slice(1) + name]
  assert.equal(typeof C, 'function', `${kind}/${variant} 컴포넌트`)
  return { C, fx, mod }
}
const render = (C, props) => renderToStaticMarkup(React.createElement(C, props))

// ── 마크업 도우미 ─────────────────────────────────────────────────────────────────────────────────
const tags = (html, sel) => [...html.matchAll(new RegExp(`<([a-z0-9]+)(?=[^>]*${sel})[^>]*>`, 'g'))].map((m) => m[0])
const attr = (tag, name) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1]
const textOf = (html) => html.replace(/<\/?(span|time|strong|em|b|a)\b[^>]*>/g, '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/\s+/g, ' ').trim()
// data-choice-group 한 묶음씩: [{ decline: tag, primary: tag }]
function choiceGroups(html) {
  const out = []
  for (const m of html.matchAll(/data-choice-group=""[^>]*>([\s\S]*?)(?=data-choice-group=""|$)/g)) {
    const seg = m[1]
    out.push({ decline: tags(seg, 'data-choice="decline"'), primary: tags(seg, 'data-choice="primary"') })
  }
  return out
}
// 클래스 글에서 글자 크기(rem, 기본 폭 · md 폭). text-base 1 · text-lg 1.125 · text-[Nrem]
const SIZE = { 'text-sm': 0.875, 'text-base': 1, 'text-lg': 1.125, 'text-xl': 1.25, 'text-2xl': 1.5 }
function fontSizes(cls) {
  const out = { base: null, md: null }
  for (const t of cls.split(/\s+/)) {
    const [pre, tok] = t.includes(':') ? [t.slice(0, t.lastIndexOf(':')), t.slice(t.lastIndexOf(':') + 1)] : ['', t]
    const v = SIZE[tok] ?? (tok.match(/^text-\[(\d*\.?\d+)rem\]$/) ? Number(tok.match(/^text-\[(\d*\.?\d+)rem\]$/)[1]) : null)
    if (v === null) continue
    if (pre === '') out.base = v
    else if (pre === 'md') out.md = v
  }
  return out
}
const trackCalls = (source) => [...source.matchAll(/track\?\.\(\s*"([a-z_]+)"\s*,\s*(\{[^}]*\}|[a-zA-Z_]+)/g)].map((m) => ({ name: m[1], props: m[2] }))
const PERSONAL = /\b(email|phone|name|password|detail|address)\s*:/

// ── 예시 + 서버가 미리 읽은 값 ──────────────────────────────────────────────────────────────────────
const PLANS = [...mock.MOCK_PLANS]
const METHODS = ['password', 'kakao', 'naver', 'google']
const ACTIVE = { planId: 'pro', status: 'active', currentPeriodEnd: '2026-10-31T15:00:00.000Z', usage: { projects: { used: 17, limit: 20 } } }
const PENDING = { ...ACTIVE, currentPeriodEnd: '2026-10-30T15:00:00.000Z', pendingPriceChange: { from: { amount: 29000, currency: 'KRW', vatIncluded: true }, to: { amount: 33000, currency: 'KRW', vatIncluded: true }, effectiveAt: '2026-10-30T15:00:00.000Z', consentBy: '2026-10-23T15:00:00.000Z', kind: 'price_increase' } }
const PAST_DUE = { planId: 'pro', status: 'past_due', currentPeriodEnd: '2026-10-31T15:00:00.000Z', paymentIssue: { reason: 'card_declined', retryAt: '2026-10-03T15:00:00.000Z' } }
const TRIAL = { planId: 'pro', status: 'trialing', trialEnd: '2026-10-14T15:00:00.000Z', currentPeriodEnd: '2026-10-14T15:00:00.000Z' }

async function markup(kind, variant, extra = {}) {
  const { C, fx } = await block(kind, variant)
  return render(C, { ...fx.fixture, ...extra })
}

// ── 정적 렌더(모든 test 를 등록하기 전에 — 최상위 await 뒤에 등록한 test 는 실행기가 놓친다) ─────────────
const PROPS = {
  'auth/sign-in': { initial: { methods: METHODS } },
  'auth/sign-up-consents': { initial: { methods: METHODS } },
  'auth/two-factor': {},
  'auth/password-reset': {},
  'auth/new-password': {},
  'account/profile-settings': { initial: { session: { userId: 'u', name: '김예시', email: 'kim@example.com', twoFactor: false } } },
  'account/billing-manage': { initial: { subscription: ACTIVE, plans: PLANS } },
  'account/notification-consents': { initial: { consents: { email: false, sms: false, kakao: false, push: false } } },
  'paywall/upgrade-modal': { initial: { plans: PLANS }, defaultOpen: true },
  'paywall/limit-meter': { initial: { subscription: ACTIVE, plans: PLANS } },
  'paywall/trial-ending': { initial: { subscription: TRIAL, plans: PLANS } },
  'paywall/onboarding-offer': { initial: { plans: PLANS } },
  'retention/cancel-flow': { initial: { subscription: ACTIVE, plans: PLANS } },
  'retention/payment-failed-banner': { initial: { subscription: PAST_DUE } },
  'retention/renewal-consent': { initial: { subscription: PENDING } },
  'consent/bottom-banner': {},
  'consent/preference-dialog': { defaultOpen: true },
  'consent/inline-notice': {},
}
const html = new Map()
for (const kv of Object.keys(PROPS)) {
  const [k, v] = kv.split('/')
  html.set(kv, await markup(k, v, PROPS[kv]))
}
// 값이 처음 보이는 화면이 누른 뒤인 블록: 사용량 한도는 100% 화면(제안 판이 늘 보인다)에서 금액·선택지를 본다
const PRICED = { 'paywall/limit-meter': await markup('paywall', 'limit-meter', { initial: { subscription: { ...ACTIVE, usage: { projects: { used: 20, limit: 20 } } }, plans: PLANS } }) }
const view = (kv) => PRICED[kv] ?? html.get(kv)

// ── 메타 ────────────────────────────────────────────────────────────────────────────────────────
test('레인 D1 블록 18개가 모두 rules 를 적었고, 규칙 ID 모양이 맞다', () => {
  const d1 = loadBlocks(root).filter((b) => D1_KINDS.includes(b.kind) && !T7B.has(`${b.kind}/${b.variant}`))
  assert.equal(d1.length, 18)
  for (const b of d1) {
    assert.ok(b.meta.success, `${b.kind}/${b.variant} 메타`)
    assert.ok(b.meta.data.rules?.length, `${b.kind}/${b.variant} rules`)
    for (const r of b.meta.data.rules) assert.match(r, RULE_ID)
  }
})

// 규칙 ID → 검사 이름(아래 test 들). 적은 규칙마다 검사가 있어야 한다(없으면 이 표가 실패한다).
const CHECKS = {}
const check = (rule, kindVariant, fn) => {
  ;(CHECKS[rule] ??= new Set()).add(kindVariant)
  test(`${rule} · ${kindVariant}`, fn)
}

test('적은 규칙마다 정적 검사가 있다(rules × 블록 = 검사 표)', () => {
  const missing = []
  for (const b of blocks.filter((x) => D1_KINDS.includes(x.kind))) for (const r of b.meta.data.rules) if (!CHECKS[r]?.has(`${b.kind}/${b.variant}`)) missing.push(`${b.kind}/${b.variant} ${r}`)
  assert.deepEqual(missing, [])
})

// ── 공통 규칙: X1 · M1 · L3 · L1 ────────────────────────────────────────────────────────────────

for (const b of blocks.filter((x) => D1_KINDS.includes(x.kind))) {
  const kv = `${b.kind}/${b.variant}`
  const rules = new Set(b.meta.data.rules)
  const h = view(kv)
  if (rules.has('X1'))
    check('X1', kv, () => {
      assert.ok(h.length > 100, '그려졌다')
      // 누르는 것은 <a href>·<button> 뿐 — role=button 을 단 다른 요소가 없다, 링크는 주소가 있다, 버튼·링크는 이름이 있다
      assert.equal(tags(h, 'role="button"').filter((t) => !t.startsWith('<button')).length, 0, 'role=button 을 단 비버튼')
      assert.doesNotMatch(h, /\sonclick=/i)
      for (const a of [...h.matchAll(/<a\s[^>]*>/g)].map((m) => m[0])) assert.ok(attr(a, 'href'), `주소 없는 링크 ${a.slice(0, 80)}`)
      for (const m of h.matchAll(/<(button|a)\b([^>]*)>([\s\S]*?)<\/\1>/g)) {
        const name = attr(`<x ${m[2]}>`, 'aria-label') ?? textOf(m[3])
        assert.ok(name && name.length > 0, `이름 없는 ${m[1]}: ${m[0].slice(0, 120)}`)
      }
    })
  if (rules.has('M1'))
    check('M1', kv, () => {
      const calls = trackCalls(b.source)
      assert.ok(calls.length > 0, 'track 호출이 있다')
      for (const c of calls) {
        assert.ok(EVENTS.includes(c.name), `EVENTS 밖 이름 ${c.name}`)
        assert.doesNotMatch(c.props, PERSONAL, `개인정보 키 ${c.name} ${c.props}`)
      }
      assert.doesNotMatch(b.source, /\btrack\(\s*"/, 'track 은 선택 prop 이라 track?.( 로 부른다')
    })
  if (rules.has('L3'))
    check('L3', kv, () => {
      const groups = choiceGroups(h)
      if (!groups.length) {
        // 확인이 누른 뒤에 나타나는 블록(로그아웃 확인·요금제 변경 확인): 원천에서 그 확인이 choice-pair(같은 모양 두 버튼)인지 본다 —
        // ChoiceButton 이 두 선택지를 같은 클래스로 그리는 것은 마크업이 있는 다른 블록 검사가 본다
        assert.match(b.source, /<ChoiceRow\b/, '확인이 대등한 두 선택지 줄이다')
        assert.match(b.source, /choice="decline"/)
        assert.match(b.source, /choice="primary"/)
        return
      }
      for (const g of groups) {
        assert.equal(g.decline.length, 1, `거절 하나 ${kv}`)
        assert.equal(g.primary.length, 1, `주 하나 ${kv}`)
        // 같은 변형·크기·폭 — 클래스 글이 같다
        assert.equal(attr(g.decline[0], 'class'), attr(g.primary[0], 'class'), `두 선택지 클래스가 같다 ${kv}`)
        assert.match(attr(g.decline[0], 'class'), /\bmin-h-12\b/)
      }
      // 순서: 거절 먼저(왼쪽), 주 나중(오른쪽)
      const first = h.search(/data-choice="(decline|primary)"/)
      assert.match(h.slice(first, first + 30), /decline/)
    })
  if (rules.has('L1'))
    check('L1', kv, () => {
      const t = textOf(h)
      assert.match(t, /\d[\d,]*원/, '원화 금액이 있다')
      assert.match(t, /VAT 포함|부가세 별도/, '같은 화면에 VAT 표기')
    })
}

// ── auth ────────────────────────────────────────────────────────────────────────────────────────
function checkO2(kv, h) {
  const inputs = [...h.matchAll(/<input\b[^>]*>/g)].map((m) => m[0]).filter((t) => !/type="(hidden|checkbox|radio)"/.test(t) && !/aria-hidden="true"/.test(t))
  assert.ok(inputs.length > 0, '입력 칸이 있다')
  for (const i of inputs) {
    const id = attr(i, 'id')
    assert.ok(id, `id 없는 입력 ${i}`)
    const label = h.match(new RegExp(`<label[^>]*for="${id}"[^>]*>([\\s\\S]*?)</label>`))
    assert.ok(label, `라벨 없는 입력 #${id}`)
    assert.match(textOf(label[1]), /\((필수|선택)\)/, `필수·선택 표시 #${id}`)
    assert.doesNotMatch(i, /\srequired=/, '브라우저 기본 검증 대신 떠날 때 검사(noValidate)')
  }
  assert.match(h, /<form[^>]*novalidate/i, '폼은 noValidate')
  assert.match(h, /role="alert"[^>]*tabindex="-1"|tabindex="-1"[^>]*role="alert"/, '폼 위 알림 자리(포커스 받음)')
}
for (const kv of ['auth/sign-in', 'auth/sign-up-consents', 'auth/two-factor', 'auth/password-reset', 'auth/new-password']) if (byName.get(kv)?.meta.data.rules.includes('O2')) check('O2', kv, () => checkO2(kv, html.get(kv)))
for (const kv of ['auth/sign-in', 'auth/sign-up-consents'])
  check('O4', kv, () => {
    const h = html.get(kv)
    const social = h.indexOf('data-social-first')
    const form = h.indexOf('<form')
    assert.ok(social > -1 && form > -1 && social < form, '소셜 줄이 이메일 폼 위')
    assert.deepEqual(tags(h, 'data-social=').map((t) => attr(t, 'data-social')), ['kakao', 'naver', 'google'])
    // §17 규격 색(카카오 #FEE500 · 네이버 #03C75A · 구글 흰 바탕 + #747775 테두리) · 카카오 반경 12px · 라벨 있는 전체 폭
    const cls = Object.fromEntries(tags(h, 'data-social=').map((t) => [attr(t, 'data-social'), attr(t, 'class')]))
    assert.match(cls.kakao, /bg-\[#FEE500\]/)
    assert.match(cls.kakao, /rounded-\[12px\]/)
    assert.match(cls.naver, /bg-\[#03C75A\]/)
    assert.match(cls.google, /border-\[#747775\]/)
    for (const c of Object.values(cls)) assert.match(c, /\bw-full\b/)
  })
check('O1', 'auth/sign-up-consents', () => {
  const h = html.get('auth/sign-up-consents')
  const names = [...h.matchAll(/<input\b[^>]*name="([^"]+)"/g)].map((m) => m[1])
  assert.deepEqual(names.sort(), ['email', 'password'], '시작에 필요한 두 칸만(이름·회사·전화 없음)')
})
for (const rule of ['L2', 'L12'])
  check(rule, 'auth/sign-up-consents', async () => {
    const h = await markup('auth', 'sign-up-consents', { initial: { methods: METHODS, step: 2 } })
    const req = tags(h, 'data-consent="required"')
    const opt = tags(h, 'data-consent="optional"')
    assert.equal(req.length, 3, '필수 동의 셋(약관·개인정보·만 14세 이상 확인 — Task 10d, 대장 D60)이 따로')
    for (const n of ['terms', 'privacy', 'ageOver14']) assert.match(h, new RegExp(`<input\\b[^>]*name="${n}"`), `필수 칸 ${n}`)
    // A05(P3-6): 이 예시 제품이 쓰는 채널만 — 이메일·카카오톡·앱 알림(문자는 문구가 없어 그려지지 않는다)
    assert.equal(opt.length, 3, '선택 동의 셋(이메일·카카오톡·앱 알림 — 제품이 쓰는 채널만)')
    assert.doesNotMatch(h, /name="marketing-sms"/, '쓰지 않는 채널은 묻지 않는다')
    for (const t of opt) {
      assert.equal(attr(t, 'aria-checked'), 'false', `선택 동의는 해제로 시작 ${t}`)
      assert.equal(attr(t, 'data-checked'), undefined)
    }
    for (const t of req) assert.equal(attr(t, 'aria-checked'), 'false', '필수도 미리 체크하지 않는다')
    // 선택은 필수와 다른 묶음(fieldset)이고 「(선택)」 표시가 있다
    const fs = h.indexOf('data-consent-group="optional"')
    assert.ok(fs > h.lastIndexOf('data-consent="required"'), '선택 묶음이 필수 뒤 따로')
    assert.match(textOf(h.slice(fs)), /\(선택\)/)
    assert.doesNotMatch(textOf(h), /전체 동의/)
  })

// ── account ─────────────────────────────────────────────────────────────────────────────────────
check('L11', 'account/billing-manage', () => {
  const h = html.get('account/billing-manage')
  for (const k of ['plan', 'next-date', 'amount', 'change', 'cancel']) assert.match(h, new RegExp(`data-billing="${k}"`), k)
  const t = textOf(h)
  assert.match(t, /프로\(예시\)/)
  assert.match(t, /2026년 11월 1일/, '다음 결제일(기간 끝 다음 날)')
  assert.match(t, /29,000원/)
  assert.match(t, /구독 해지하기/)
})
check('P3', 'account/billing-manage', () => {
  const h = html.get('account/billing-manage')
  assert.match(h, /<table/)
  const ths = [...h.matchAll(/<th\b[^>]*>/g)].map((m) => m[0])
  assert.ok(ths.length >= 4)
  for (const t of ths) assert.match(t, /scope="(col|row)"/, `th scope ${t}`)
  // 금액 칸(data-numeric, 숫자만) 옆 칸에 주기·부가세
  assert.match(textOf(h), /9,900원\s+월 · VAT 포함/)
})
check('L12', 'account/notification-consents', () => {
  const h = html.get('account/notification-consents')
  const opt = tags(h, 'data-consent="optional"')
  assert.equal(opt.length, 4)
  for (const t of opt) {
    assert.equal(attr(t, 'role'), 'switch')
    assert.equal(attr(t, 'aria-checked'), 'false', '새 사용자는 모두 꺼짐')
  }
  assert.match(textOf(h), /\(선택\)/)
  assert.match(textOf(h), /결제·보안·일정 알림은/, '필수 알림은 이 목록 밖이라고 밝힌다')
})

// ── paywall ─────────────────────────────────────────────────────────────────────────────────────
function checkP1(h) {
  const billed = tags(h, 'data-price="billed"')
  const eq = tags(h, 'data-price="equivalent"')
  assert.ok(billed.length >= 1, 'billed 가 있다')
  const b = fontSizes(attr(billed[0], 'class'))
  assert.ok(b.base >= 2, `청구액이 크다(${b.base}rem)`)
  for (const e of eq) {
    const s = fontSizes(attr(e, 'class'))
    assert.ok((s.base ?? 1) < b.base, `환산가(${s.base}) < 청구액(${b.base})`)
  }
  // 다른 금액(환산·비교)도 청구액보다 크지 않다
  for (const t of tags(h, 'data-price="(?!billed)')) assert.ok((fontSizes(attr(t, 'class')).base ?? 1) <= b.base)
}
function checkP2(h) {
  const cta = h.search(/data-choice="primary"/)
  assert.ok(cta > -1)
  for (const k of ['first-charge', 'auto-renew', 'cancel', 'links']) {
    const at = h.search(new RegExp(`data-terms="${k}"`))
    assert.ok(at > -1 && at < cta, `${k} 가 버튼 앞 같은 판에`)
  }
  const links = h.slice(h.search(/data-terms="links"/), cta)
  assert.match(links, /href="#terms"/)
  assert.match(links, /href="#privacy"/)
}
for (const kv of ['paywall/upgrade-modal', 'paywall/limit-meter', 'paywall/trial-ending', 'paywall/onboarding-offer']) {
  const rules = byName.get(kv).meta.data.rules
  const pick = async () => (kv === 'paywall/limit-meter' ? markup('paywall', 'limit-meter', { initial: { subscription: { ...ACTIVE, usage: { projects: { used: 20, limit: 20 } } }, plans: PLANS } }) : html.get(kv))
  if (rules.includes('P1')) check('P1', kv, async () => checkP1(await pick()))
  if (rules.includes('P2')) check('P2', kv, async () => checkP2(await pick()))
}
check('P2', 'paywall/upgrade-modal', () => {
  // 체험이 있는 요금제: 체험 기간 줄 + 첫 결제일(오늘 + 14일, 서울 날짜)
  const t = textOf(html.get('paywall/upgrade-modal'))
  assert.match(t, /처음 14일은 무료예요/)
  assert.match(t, /2026년 10월 15일에 29,000원\(VAT 포함\)이 처음 결제돼요/)
})
check('P3', 'paywall/upgrade-modal', () => {
  const h = html.get('paywall/upgrade-modal')
  assert.match(h, /<table/)
  for (const m of h.matchAll(/<th\b[^>]*>/g)) assert.match(m[0], /scope="(col|row)"/)
  assert.match(textOf(h), /29,000원\s*\/월 · VAT 포함/)
})
for (const kv of ['paywall/upgrade-modal', 'consent/preference-dialog'])
  check('A6', kv, async () => {
    const [k, v] = kv.split('/')
    // 저절로 열리지 않는다(첫 화면 가림 모달 0) — 열면 대화상자이고 닫기가 있다
    const closed = await markup(k, v, { ...PROPS[kv], defaultOpen: false })
    assert.doesNotMatch(closed, /role="dialog"/)
    assert.match(closed, /aria-haspopup="dialog"/)
    assert.match(html.get(kv), /role="dialog"/)
    assert.match(html.get(kv), /data-dialog-close/)
    assert.match(byName.get(kv).source, /defaultOpen = false/, '기본은 닫힘')
  })
check('P6', 'paywall/upgrade-modal', () => {
  // 가치를 느낀 자리(잠긴 기능)에서 사용자가 열 때만 — 기본 렌더에는 대화상자가 없다(A6 와 같은 근거) + 잠긴 기능 판이 있다
  assert.match(textOf(html.get('paywall/upgrade-modal')), /보고서 내보내기는 프로 요금제에서 써요/)
})
check('P6', 'paywall/onboarding-offer', () => {
  const h = html.get('paywall/onboarding-offer')
  const g = choiceGroups(h)[0]
  assert.match(g.decline[0], /^<a\b/, '「무료로 계속」은 링크')
  assert.equal(attr(g.decline[0], 'href'), '#today')
  assert.match(textOf(h), /무료로 계속하기/)
  assert.match(textOf(h), /14일 무료 체험 시작하기/)
})
check('P7', 'paywall/limit-meter', async () => {
  const at = (used) => markup('paywall', 'limit-meter', { initial: { subscription: { ...ACTIVE, usage: { projects: { used, limit: 20 } } }, plans: PLANS } })
  const warn = await at(17)
  assert.match(warn, /data-limit="warn"/)
  assert.match(textOf(warn), /한도의 85%를 썼어요/)
  assert.match(textOf(warn), /팀\(예시\) 요금제로 올리면 프로젝트를 1,000개까지/)
  assert.doesNotMatch(warn, /data-soft-block/)
  const full = await at(20)
  assert.match(full, /data-limit="blocked"/)
  assert.match(full, /data-soft-block/)
  assert.match(full, /data-free-path=""[^>]*href="#archive"|href="#archive"[^>]*data-free-path/, '무료로 계속할 길')
  assert.match(textOf(full), /있는 프로젝트는 그대로 열고 고칠 수 있어요/)
  const low = await at(6)
  assert.match(low, /data-limit="ok"/)
  assert.doesNotMatch(low, /data-offer=|data-soft-block/)
})
check('P14', 'paywall/limit-meter', async () => {
  // 한도는 배수가 아니라 구체 수치(쓴 양 / 한도 · 올리면 몇 개까지)
  const warn = await markup('paywall', 'limit-meter', { initial: { subscription: ACTIVE, plans: PLANS } })
  const t = textOf(warn)
  assert.match(t, /프로젝트 17개 \/ 20개/)
  assert.match(t, /1,000개까지/)
  assert.doesNotMatch(t, /\d+\s*[×x배]/, '배수 표기 없음')
  assert.match(warn, /role="progressbar"[^>]*aria-label="프로젝트 17개 \/ 20개"|aria-label="프로젝트 17개 \/ 20개"[^>]*role="progressbar"/)
})
check('P9', 'paywall/limit-meter', async () => {
  const warn = await markup('paywall', 'limit-meter', { initial: { subscription: ACTIVE, plans: PLANS } })
  const s = tags(warn, 'data-snooze')
  assert.equal(s.length, 1)
  assert.match(textOf(warn), /3일 동안 안 보기/)
  assert.match(byName.get('paywall/limit-meter').source, /useSnooze\(/)
})
check('P8', 'paywall/trial-ending', async () => {
  const h = html.get('paywall/trial-ending')
  assert.match(textOf(h), /무료 체험이 3일 남았어요/)
  assert.match(textOf(h), /체험하는 동안 한 일/)
  assert.match(textOf(h), /프로젝트 2개를 만들었어요/)
  // 7·3·1 구간 밖(10일 전)이면 보이지 않는다
  const early = await markup('paywall', 'trial-ending', { initial: { subscription: TRIAL, plans: PLANS }, now: '2026-10-04T00:00:00.000Z' })
  assert.match(early, /<section[^>]*hidden/)
  assert.doesNotMatch(early, /data-countdown/)
})
check('L8', 'paywall/trial-ending', async () => {
  const h = html.get('paywall/trial-ending')
  const cd = tags(h, 'data-countdown')
  assert.equal(cd.length, 1)
  assert.equal(attr(cd[0], 'data-ends-at'), TRIAL.trialEnd, '남은 날은 실제 체험 끝(endsAt)에 묶인다')
  // 카운트다운 부품은 endsAt 이 필수 prop 이다
  const src = readFileSync(join(root, 'registry', 'factory', 'blocks', '_shared', 'billing-format.tsx'), 'utf8')
  assert.match(src, /export function DaysLeft\(\{ endsAt, now, template, className \}: \{ endsAt: IsoDate;/)
  // 체험 중이 아니면 카운트다운이 없다
  const act = await markup('paywall', 'trial-ending', { initial: { subscription: ACTIVE, plans: PLANS } })
  assert.doesNotMatch(act, /data-countdown/)
})
check('L6', 'paywall/trial-ending', () => {
  // 무료→유료는 명시 동의 — 동의하지 않으면 결제되지 않는다고 버튼 앞에 적고, 결제는 누를 때만(checkout)
  const t = textOf(html.get('paywall/trial-ending'))
  assert.match(t, /계속 쓰겠다고 하지 않으면 결제되지 않고 무료 요금제로 바뀌어요/)
  assert.match(t, /29,000원으로 계속 쓰기/)
})
check('L7', 'paywall/trial-ending', () => {
  const h = html.get('paywall/trial-ending')
  assert.match(textOf(h), /체험만 쓰고 끝내기/)
  assert.match(byName.get('paywall/trial-ending').source, /onDecline=\{snooze\}/, '거절하면 다음 예고 구간까지 쉰다')
})

// ── retention ───────────────────────────────────────────────────────────────────────────────────
check('L4', 'retention/cancel-flow', async () => {
  const cancel = html.get('retention/cancel-flow')
  const signup = html.get('auth/sign-up-consents')
  const steps = (h, flow) => Number(attr(tags(h, `data-flow="${flow}"`)[0], 'data-steps'))
  assert.ok(steps(cancel, 'cancel') <= steps(signup, 'signup'), `해지 ${steps(cancel, 'cancel')} ≤ 가입 ${steps(signup, 'signup')}`)
  assert.equal(attr(tags(cancel, 'data-flow="cancel"')[0], 'data-step'), '1')
  // 묻는 것은 사유 하나(선택) — 필수 표시·required 없음
  assert.equal(tags(cancel, 'data-optional-question').length, 1)
  assert.match(textOf(cancel), /\(선택\)/)
  assert.doesNotMatch(cancel, /aria-required="true"|\srequired=/)
  // 모든 단계에 해지 쪽 선택지가 있다(① 은 여기서, ② 는 대안 판 — 브라우저 검사)
  assert.equal(choiceGroups(cancel)[0].decline.length, 1)
  assert.match(textOf(cancel), /해지 계속하기/)
  // 혜택 반복 강조 없음 — 대안은 ② 에서 하나만
  assert.doesNotMatch(cancel, /data-alternative/)
})
check('L5', 'retention/cancel-flow', async () => {
  const both = html.get('retention/cancel-flow')
  assert.match(both, /data-cancel-when="both"/)
  assert.match(both, /data-when="period_end"/)
  assert.match(both, /data-when="now"/)
  assert.match(textOf(both), /일반 해지/)
  assert.match(textOf(both), /중도 해지/)
  const only = await markup('retention', 'cancel-flow', { ...PROPS['retention/cancel-flow'], terms: { midTerm: false } })
  assert.match(only, /data-cancel-when="period_end"/)
  assert.doesNotMatch(only, /data-when="now"/)
})
check('R2', 'retention/cancel-flow', async () => {
  const { mod } = await block('retention', 'cancel-flow')
  const pick = mod.pickRetentionOffer
  const ctx = { planId: 'pro', plans: PLANS }
  const O = mock.MOCK_RETENTION_OFFERS
  assert.equal(pick(O, ctx).kind, 'pause', '일시정지 먼저')
  assert.equal(pick([...O].reverse(), ctx).kind, 'pause', '주는 순서와 상관없이')
  assert.equal(pick(O.filter((o) => o.kind !== 'pause'), ctx).kind, 'downgrade')
  assert.equal(pick(O.filter((o) => o.kind === 'discount'), ctx).kind, 'discount')
  assert.equal(pick([{ id: 'd40', kind: 'discount', discount: { percent: 40, months: 3 } }], ctx), null, '30% 넘는 할인은 보이지 않는다')
  assert.equal(pick([{ id: 'dg', kind: 'downgrade', planId: 'team' }], ctx), null, '더 비싼 요금제로의 「다운그레이드」는 없다')
  assert.equal(pick([], ctx), null)
  // 대안은 하나만 — 결과는 배열이 아니다
  assert.equal(Array.isArray(pick(O, ctx)), false)
})
check('R1', 'retention/payment-failed-banner', async () => {
  const h = html.get('retention/payment-failed-banner')
  assert.match(h, /data-payment-issue="card_declined"/)
  assert.match(h, /data-access-kept/)
  const t = textOf(h)
  assert.match(t, /2026년 10월 4일에 다시 결제해요/)
  assert.match(t, /그때까지 모든 기능을 그대로 쓸 수 있어요/)
  assert.match(t, /결제 수단 바꾸기/)
  // 비차단 — 대화상자·가림막이 아니다
  assert.doesNotMatch(h, /role="dialog"|aria-modal|fixed inset-0/)
  // 복구(active)면 띠가 없다
  const ok = await markup('retention', 'payment-failed-banner', { initial: { subscription: ACTIVE } })
  assert.match(ok, /<section[^>]*hidden/)
  assert.doesNotMatch(ok, /data-payment-issue/)
})
check('L6', 'retention/renewal-consent', () => {
  const h = html.get('retention/renewal-consent')
  const t = textOf(h)
  assert.match(t, /29,000원/)
  assert.match(t, /33,000원/)
  assert.match(t, /VAT 포함/)
  assert.equal(tags(h, 'data-price="before"').length, 1)
  assert.equal(tags(h, 'data-price="after"').length, 1)
  assert.match(t, /2026년 10월 31일/, '적용일')
  assert.equal(attr(tags(h, 'data-consent-by')[0], 'data-consent-by'), PENDING.pendingPriceChange.consentBy)
  assert.match(t, /2026년 10월 23일까지 알려 주세요/)
  assert.match(t, /동의하지 않으면 오른 요금으로 결제되지 않아요/)
  // 닫기는 선택지가 아니다(동의 버튼과 따로, 이름 「나중에 결정하기」)
  const close = tags(h, 'data-close')
  assert.equal(close.length, 1)
  assert.equal(attr(close[0], 'data-choice'), undefined)
  assert.equal(attr(close[0], 'aria-label'), '나중에 결정하기')
  const src = byName.get('retention/renewal-consent').source
  assert.match(src, /onClick=\{\(\) => setClosed\(true\)\}/, '닫기는 접기만(포트를 부르지 않는다)')
})
check('A6', 'retention/renewal-consent', () => {
  const h = html.get('retention/renewal-consent')
  assert.doesNotMatch(h, /role="dialog"|aria-modal/)
  assert.match(h, /role="region"/)
})

// ── consent ─────────────────────────────────────────────────────────────────────────────────────
for (const kv of ['consent/bottom-banner', 'consent/preference-dialog', 'consent/inline-notice'])
  check('X3', kv, () => {
    const h = html.get(kv)
    const [, v] = kv.split('/')
    // 쿠키 창이 화면을 가리지 않는다: 가림막(inset-0) 없음, 모달 표시 없음(설정 대화상자는 사용자가 연 것만 — A6)
    assert.doesNotMatch(h, /fixed inset-0/)
    if (v !== 'preference-dialog') assert.doesNotMatch(h, /role="dialog"|aria-modal/)
    if (v === 'bottom-banner') {
      const sec = tags(h, 'data-block="consent-bottom-banner"')[0]
      assert.match(attr(sec, 'class'), /\bbottom-0\b/)
      const mh = attr(sec, 'class').match(/max-h-\[(\d+)dvh\]/)
      assert.ok(mh && Number(mh[1]) < 30, `높이 상한 < 30dvh (${mh?.[1]})`)
      // 거부해도 내용을 다 본다고 밝힌다(쿠키벽 없음)
      assert.match(textOf(h), /거부해도 모든 내용을 그대로 볼 수 있어요/)
    }
    if (v === 'inline-notice') assert.doesNotMatch(attr(tags(h, 'data-block=')[0], 'class') ?? '', /\bfixed\b/)
  })
check('L2', 'consent/preference-dialog', () => {
  const h = html.get('consent/preference-dialog')
  const opt = tags(h, 'data-consent="optional"')
  assert.equal(opt.length, 2)
  for (const t of opt) assert.equal(attr(t, 'aria-checked'), 'false', '결정 전 선택 쿠키는 꺼짐')
})
check('L7', 'consent/inline-notice', async () => {
  const h = html.get('consent/inline-notice')
  assert.equal(tags(h, 'data-snooze').length, 1)
  assert.match(textOf(h), /7일간 보지 않기/)
  assert.equal(choiceGroups(h)[0].decline.length, 1, '실제 거절 버튼')
  // 거부한 사람에게도 들를 때마다 다시 묻는다(그래서 쉬기가 있다)
  const denied = await markup('consent', 'inline-notice', { consent: () => ({ analytics: false, marketing: false, decidedAt: '2026-10-01T00:00:00.000Z' }) })
  assert.match(denied, /data-consent-view="ask"/)
  // 허용이면 내용 자리
  const ok = await markup('consent', 'inline-notice', { consent: () => ({ analytics: true, marketing: true, decidedAt: '2026-10-01T00:00:00.000Z' }) })
  assert.match(ok, /data-consent-view="allowed"/)
})

// ── 흐름 표지 · 다른 블록 ─────────────────────────────────────────────────────────────────────────
test('가입 흐름 표지: data-flow="signup" · data-steps 3 · 지금 단계 data-step', () => {
  const h = html.get('auth/sign-up-consents')
  const f = tags(h, 'data-flow="signup"')[0]
  assert.equal(attr(f, 'data-steps'), '3')
  assert.equal(attr(f, 'data-step'), '1')
})
test('결정한 쿠키 띠는 그리지 않는다(결정 전에만)', async () => {
  const h = await markup('consent', 'bottom-banner', { consent: () => ({ analytics: false, marketing: false, decidedAt: '2026-10-01T00:00:00.000Z' }) })
  assert.doesNotMatch(h, /data-choice=/)
})
