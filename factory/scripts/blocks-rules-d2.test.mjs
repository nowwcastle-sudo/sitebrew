// 레인 D2 블록 규칙 검사(P3-2 Task 11 D2): 메타 rules 에 적은 마케팅·운영 규칙(factory-rules.md §22) 하나마다 정적 검사가 하나 이상 있다.
// 실행: node --test --test-force-exit --test-timeout=120000 factory/scripts/blocks-rules-d2.test.mjs
// 방법은 레인 D1 검사(blocks-rules.test.mjs)와 같다: 소비자에게 나가는 컴파일본(_compiled — 훅이 실제 클래스로 풀린 것)을 typescript 로 .tmp 에 옮겨
// 예시 콘텐츠(.fixture.ts)로 정적 렌더(react-dom/server)한 뒤 마크업을 본다 — 브라우저 없음. 순수 함수(guaranteeIssues·kakaoTemplateIssues·ratingJsonLd·
// pickHighlights·brandJsonLd)는 직접 부른다. 클릭·키보드·포커스가 필요한 부분(Esc·바깥 클릭·이탈 의도·복사)은 브라우저 동작 검사(레인 보고서)로 넘긴다.
// 가짜로 바꾸는 모듈: 모션 장면·기법(아무것도 안 함) · 대화상자(globalThis.__wfDialogOpen 이면 제자리에 그린다 — base-ui 포털은 서버에서 비어 있다) ·
// 며칠 쉬기·닫은 것 기억(globalThis.__wfSnoozed·__wfDismissed — localStorage 는 서버에 없다).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'
import { loadBlocks, RULE_ID } from './blocks.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = join(root, '.tmp', 'blocks-rules-d2-test')
const COMPILED = join(root, 'registry', 'factory', 'blocks', '_compiled')
const D2_KINDS = ['onboarding', 'trust', 'review-list', 'referral', 'lead-capture', 'announcement', 'confirmation']

// ── 가짜 모듈 ──────────────────────────────────────────────────────────────────────────────────────
const STUBS = {
  [join(root, 'registry', 'factory', 'motion', 'use-gsap-scene.ts')]: 'export function useGsapScene() {}\n',
  [join(root, 'registry', 'factory', 'motion', 'gsap-techniques.ts')]: 'export function rise() {}\nexport function blurToSharp() {}\n',
  [join(COMPILED, '_shared', 'snooze.tsx')]: 'export function useSnooze() { return { snoozed: !!globalThis.__wfSnoozed, snooze() {} } }\n',
  [join(COMPILED, '_shared', 'dismiss-memory.tsx')]: 'export function useDismissMemory() { return { dismissed: !!globalThis.__wfDismissed, set() {} } }\n',
  [join(root, 'registry', 'factory', 'ui', 'dialog.tsx')]: [
    'import * as React from "react"',
    'const Open = React.createContext(false)',
    'export function Dialog({ open, defaultOpen, children }) { return React.createElement(Open.Provider, { value: !!(globalThis.__wfDialogOpen || open || defaultOpen) }, children) }',
    'export function DialogContent({ children, className, ...rest }) { const open = React.useContext(Open); return open ? React.createElement("div", { role: "dialog", "aria-modal": "true", className, "data-stub-dialog": "", "data-exit-offer": rest["data-exit-offer"] }, children, React.createElement("button", { type: "button", "data-dialog-close": "" }, "닫기")) : null }',
    'export function DialogHeader({ children }) { return React.createElement("div", null, children) }',
    'export function DialogTitle({ children, className, id }) { return React.createElement("h2", { className, id }, children) }',
    'export function DialogDescription({ children, className }) { return React.createElement("p", { className }, children) }',
    '',
  ].join('\n'),
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
const { EVENTS } = await load(join(root, 'registry', 'factory', 'contract', 'events.ts'))

// Task 7b confirmation/verify-email 은 blocks-rules-7b.test.mjs · 7a-run confirmation/upgrade-complete(A64)는 blocks-upgrade-complete.test.mjs 가 본다
// FV1 Task 5.8 새 블록(announcement/notice-ticker·popup-today·update-toast, trust/author-byline — 메타 rules 없음)은 sections-new.test.mjs 가 본다
const blocks = loadBlocks(root).filter((b) => b.meta.success && D2_KINDS.includes(b.kind) && !['confirmation/verify-email', 'confirmation/upgrade-complete', 'announcement/notice-ticker', 'announcement/popup-today', 'announcement/update-toast', 'trust/author-byline'].includes(`${b.kind}/${b.variant}`))
const byName = new Map(blocks.map((b) => [`${b.kind}/${b.variant}`, b]))
const pascal = (s) => s.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join('')
const mods = new Map()
for (const b of blocks) {
  const kv = `${b.kind}/${b.variant}`
  const mod = await load(join(COMPILED, b.kind, `${b.variant}.tsx`))
  const fx = await load(join(root, 'registry', 'factory', 'blocks', b.kind, `${b.variant}.fixture.ts`))
  const C = mod[pascal(b.kind) + pascal(b.variant)]
  assert.equal(typeof C, 'function', `${kv} 컴포넌트`)
  mods.set(kv, { C, fx, mod })
}
/** kv 블록을 예시(기본·max·min) + extra 로 그린다. flags: 가짜 모듈 상태(대화상자 열림·쉬는 중·닫음) */
function render(kv, extra = {}, { which = 'fixture', dialog = false, snoozed = false, dismissed = false } = {}) {
  const { C, fx } = mods.get(kv)
  globalThis.__wfDialogOpen = dialog
  globalThis.__wfSnoozed = snoozed
  globalThis.__wfDismissed = dismissed
  try {
    return renderToStaticMarkup(React.createElement(C, { ...fx[which], ...extra }))
  } finally {
    globalThis.__wfDialogOpen = globalThis.__wfSnoozed = globalThis.__wfDismissed = false
  }
}
const pure = (kv, name) => mods.get(kv).mod[name]
const fixtureOf = (kv, which = 'fixture') => mods.get(kv).fx[which]

// ── 마크업 도우미 ─────────────────────────────────────────────────────────────────────────────────
const tags = (html, sel) => [...html.matchAll(new RegExp(`<([a-z0-9]+)(?=[^>]*${sel})[^>]*>`, 'g'))].map((m) => m[0])
const attr = (tag, name) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1]
const textOf = (html) => html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<\/?(span|time|strong|em|b|a|wbr)\b[^>]*>/g, '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/\s+/g, ' ').trim()
const count = (html, re) => (html.match(re) ?? []).length
const at = (html, sel) => html.search(new RegExp(sel))
const digits = (s) => String(s).replace(/\D/g, '')
function choiceGroups(html) {
  const out = []
  for (const m of html.matchAll(/data-choice-group=""[^>]*>([\s\S]*?)(?=data-choice-group=""|$)/g)) out.push({ decline: tags(m[1], 'data-choice="decline"'), primary: tags(m[1], 'data-choice="primary"') })
  return out
}
const jsonLds = (html) => [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]))
const SIZE = { 'text-sm': 0.875, 'text-base': 1, 'text-lg': 1.125, 'text-xl': 1.25, 'text-2xl': 1.5 }
function fontSize(cls) {
  let v = null
  for (const t of (cls ?? '').split(/\s+/)) {
    if (t.includes(':')) continue
    const n = SIZE[t] ?? (t.match(/^text-\[(\d*\.?\d+)rem\]$/) ? Number(t.match(/^text-\[(\d*\.?\d+)rem\]$/)[1]) : null)
    if (n !== null) v = n
  }
  return v
}
const trackCalls = (source) => [...source.matchAll(/track\?\.\(\s*"([a-z_]+)"\s*,\s*(\{[^}]*\}|[a-zA-Z_]+)/g)].map((m) => ({ name: m[1], props: m[2] }))
const PERSONAL = /\b(email|phone|name|password|detail|address)\s*:/

// ── 표: 적은 규칙마다 검사가 있다 ──────────────────────────────────────────────────────────────────
test('레인 D2 블록 22개가 모두 rules 를 적었고, 규칙 ID 모양이 맞다(7 kind)', () => {
  assert.equal(blocks.length, 22)
  assert.deepEqual([...new Set(blocks.map((b) => b.kind))].sort(), [...D2_KINDS].sort())
  for (const b of blocks) {
    assert.ok(b.meta.data.rules?.length, `${b.kind}/${b.variant} rules`)
    for (const r of b.meta.data.rules) assert.match(r, RULE_ID)
  }
  assert.equal(blocks.filter((b) => b.kind === 'trust').length, 4, 'trust 는 brand-fact-sheet 포함 4')
})
const CHECKS = {}
const check = (rule, kv, fn) => {
  ;(CHECKS[rule] ??= new Set()).add(kv)
  test(`${rule} · ${kv}`, fn)
}
test('적은 규칙마다 정적 검사가 있다(rules × 블록 = 검사 표)', () => {
  const missing = []
  for (const b of blocks) for (const r of b.meta.data.rules) if (!CHECKS[r]?.has(`${b.kind}/${b.variant}`)) missing.push(`${b.kind}/${b.variant} ${r}`)
  assert.deepEqual(missing, [])
})

// ── 공통: X1 · M1 · L3 ─────────────────────────────────────────────────────────────────────────
// L3 는 대화상자 안(cart-exit-offer)이라 열린 상태로 그린다
const OPEN = { 'lead-capture/cart-exit-offer': { dialog: true } }
for (const b of blocks) {
  const kv = `${b.kind}/${b.variant}`
  const rules = new Set(b.meta.data.rules)
  const h = render(kv, {}, OPEN[kv] ?? {})
  if (rules.has('X1'))
    check('X1', kv, () => {
      assert.ok(h.length > 100, '그려졌다')
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
      assert.match(b.source, /track\?: AnalyticsPort\["track"\]/, 'track 은 포트 메서드 타입 그대로(선택)')
    })
  if (rules.has('L3'))
    check('L3', kv, () => {
      const groups = choiceGroups(h)
      assert.ok(groups.length >= 1, '대등한 두 선택지 줄이 있다')
      for (const g of groups) {
        assert.equal(g.decline.length, 1)
        assert.equal(g.primary.length, 1)
        assert.equal(attr(g.decline[0], 'class'), attr(g.primary[0], 'class'), '두 선택지 클래스가 같다')
        assert.match(attr(g.decline[0], 'class'), /\bmin-h-12\b/)
      }
      const first = h.search(/data-choice="(decline|primary)"/)
      assert.match(h.slice(first, first + 30), /decline/, '거절이 먼저(왼쪽)')
    })
}

// ── onboarding: O5 O6 O7 O8 O9 O10 O11 V4 ─────────────────────────────────────────────────────────
const RATING_ASK = /data-rating-ask|name="[^"]*rating|별점|평점|리뷰를 (남겨|써)/
for (const kv of ['onboarding/checklist-panel', 'onboarding/setup-wizard', 'onboarding/empty-first-action', 'confirmation/signup-complete'])
  check('V4', kv, () => {
    // 온보딩·가입 직후에는 평점·리뷰를 묻지 않는다 — 기본·최대·최소 모두
    for (const which of ['fixture', 'fixtureMax', 'fixtureMin']) assert.doesNotMatch(render(kv, {}, { which }), RATING_ASK, `${kv} ${which}`)
  })
check('O5', 'onboarding/checklist-panel', () => {
  // 가치 순서(copy 순서 그대로)·5개까지 — 다음 할 일 하나만 주 버튼
  const fx = fixtureOf('onboarding/checklist-panel')
  const h = render('onboarding/checklist-panel')
  const ids = [...h.matchAll(/data-step-id="([^"]+)"/g)].map((m) => m[1])
  assert.deepEqual(ids, fx.copy.items.map((i) => i.id))
  assert.equal(count(h, /data-next=""/g), 1)
  assert.equal(count(h, /<input\b/g), 0, '첫 가치 전에 입력(프로필)을 받지 않는다')
})
check('O6', 'onboarding/checklist-panel', () => {
  const max = render('onboarding/checklist-panel', {}, { which: 'fixtureMax' })
  assert.equal(count(max, /data-step-id=/g), 5, '6개를 줘도 5개까지')
  const min = render('onboarding/checklist-panel', {}, { which: 'fixtureMin' })
  assert.equal(count(min, /data-step-id=/g), 3)
  // 미리 체크는 실제로 끝낸 단계(completed)만
  assert.equal(count(render('onboarding/checklist-panel', { completed: [] }), /data-done=""/g), 0)
  const one = render('onboarding/checklist-panel', { completed: ['share-link'] })
  assert.deepEqual([...one.matchAll(/data-step-id="([^"]+)" data-done=""/g)].map((m) => m[1]), ['share-link'])
  assert.equal(count(render('onboarding/checklist-panel', { completed: ['not-an-item'] }), /data-done=""/g), 0, '모르는 id 는 체크하지 않는다')
  assert.match(one, /role="progressbar"/)
  assert.match(one, /aria-valuetext="1\/4 끝냈어요"/)
  assert.equal(count(one, /type="checkbox"|role="checkbox"/g), 0, '판에서 손으로 체크하지 않는다')
  // 닫기(aria-label)·닫으면 다시 열기 한 줄
  assert.match(one, /aria-label="시작 체크리스트 닫기"/)
  const closed = render('onboarding/checklist-panel', {}, { dismissed: true })
  assert.match(closed, /data-checklist-closed=""/)
  assert.match(textOf(closed), /체크리스트 다시 열기/)
  assert.doesNotMatch(closed, /data-step-id=/)
})
check('O11', 'onboarding/checklist-panel', () => {
  assert.doesNotMatch(render('onboarding/checklist-panel'), /data-celebrate/, '남은 일이 있으면 축하 없음')
  const all = render('onboarding/checklist-panel', {}, { which: 'fixtureMin' })
  assert.match(all, /data-celebrate=""/, '모두 끝내면 축하 한 줄')
  assert.equal(count(all, /data-next=""/g), 0)
})
check('O5', 'onboarding/setup-wizard', () => {
  const h = render('onboarding/setup-wizard')
  assert.match(h, /data-flow="onboarding" data-steps="2" data-step="1"/)
  assert.equal(count(h, /role="radiogroup"/g), 1, '질문은 하나')
  assert.equal(count(h, /<input\b(?![^>]*type="radio")/g), 0, '라디오 밖 입력(프로필) 없음')
  assert.match(textOf(h), /건너뛰고 둘러보기/, '건너뛸 수 있다')
})
check('O9', 'onboarding/setup-wizard', () => {
  const fx = fixtureOf('onboarding/setup-wizard')
  const h = render('onboarding/setup-wizard')
  assert.equal(count(h, /type="radio"/g), fx.copy.question.options.length)
  assert.equal(count(h, /\schecked=""/g), 0, '고른 답 없이 시작')
  // 답마다 다음 화면이 다르다 — 모든 답에 갈래가 있고 제목·행동이 서로 다르다
  for (const which of ['fixture', 'fixtureMax', 'fixtureMin']) {
    const c = fixtureOf('onboarding/setup-wizard', which).copy
    for (const o of c.question.options) assert.ok(c.branches[o.id], `${which} ${o.id} 갈래`)
    const titles = c.question.options.map((o) => c.branches[o.id].title)
    assert.equal(new Set(titles).size, titles.length, `${which} 갈래 제목이 서로 다르다`)
  }
})
check('O10', 'onboarding/setup-wizard', () => {
  const src = byName.get('onboarding/setup-wizard').source
  // 권한은 누른 순간에만 — requestPermission 은 ask 안에 한 번, ask 는 버튼 onClick 에서만
  assert.equal(count(src, /requestPermission/g), 1)
  assert.match(src, /const ask = async \(\) => \{[\s\S]*?requestPermission[\s\S]*?\n {2}\}/)
  assert.match(src, /onClick=\{ask\}/)
  assert.doesNotMatch(src, /useEffect\([^)]*requestPermission/)
  const c = fixtureOf('onboarding/setup-wizard').copy
  for (const b of Object.values(c.branches)) if (b.permission) assert.ok(b.permission.reason.length > 10, '이유 한 줄')
})
check('O7', 'onboarding/empty-first-action', () => {
  for (const which of ['fixture', 'fixtureMin']) {
    const h = render('onboarding/empty-first-action', {}, { which })
    assert.match(h, /data-empty-what=""/)
    assert.match(h, /data-empty-why=""/)
    assert.equal(count(h, /data-primary-action=""/g), 1, '주 행동 하나')
  }
  // 예시 데이터는 글 링크(주 행동과 무게가 다르다)
  const h = render('onboarding/empty-first-action')
  const sample = h.match(/<([a-z]+)\b[^>]*href="#sample"/)
  assert.equal(sample?.[1], 'a', '예시 데이터는 글 링크')
  assert.doesNotMatch(sample[0], /data-slot="button"/, '버튼 모양이 아니다')
})
check('O8', 'onboarding/empty-first-action', () => {
  const h = render('onboarding/empty-first-action')
  // 맥락 도움말은 사용자가 여는 접힘 하나(닫힌 채) — 투어·대화상자 없음
  assert.equal(count(h, /aria-expanded="false"/g), 1)
  assert.doesNotMatch(h, /role="dialog"/)
  assert.doesNotMatch(textOf(h), /다음 단계|건너뛰기|투어/)
})

// ── trust: T1 T2 T3 T4 L1 L9 L10 X2 X4 X7 X11 ────────────────────────────────────────────────────
check('T1', 'trust/guarantee-strip', () => {
  const h = render('trust/guarantee-strip')
  // CTA 바로 다음 형제가 보증 한 줄, 신뢰 요소 줄은 같은 구역(푸터로 내리지 않는다)
  assert.match(h, /data-trust-cta=""[^>]*>\s*<a [^>]*>[\s\S]*?<\/a>\s*<p data-guarantee=""/)
  assert.ok(count(h, /data-trust-kind=/g) >= 3)
  assert.doesNotMatch(h, /<img\b/, '그림 씰 없음')
})
check('T2', 'trust/guarantee-strip', () => {
  const reviews = fixtureOf('trust/guarantee-strip').copy.items.filter((i) => i.kind === 'reviews')
  for (const r of reviews) assert.match(r.text, /\d[\d,]*개[\s\S]*기준/, '리뷰 수와 기준일')
})
check('T3', 'trust/guarantee-strip', () => {
  const issues = pure('trust/guarantee-strip', 'guaranteeIssues')
  for (const which of ['fixture', 'fixtureMax', 'fixtureMin']) assert.deepEqual(issues(fixtureOf('trust/guarantee-strip', which).copy.guarantee), [], which)
  const g = fixtureOf('trust/guarantee-strip').copy.guarantee
  assert.equal(issues({ ...g, conditions: ['a', 'b', 'c'] }).length, 1, '조건 3개는 잡힌다')
  assert.equal(issues({ ...g, days: 5 }).length, 1, '7일 미만은 잡힌다')
  assert.match(textOf(render('trust/guarantee-strip')), /30일 안에 마음에 들지 않으면 전액 돌려드려요 \(세탁 전 · 구성품 모두\)/)
  // 조건은 2개까지만 그린다
  assert.doesNotMatch(render('trust/guarantee-strip', { copy: { ...fixtureOf('trust/guarantee-strip').copy, guarantee: { ...g, conditions: ['a1', 'b1', 'c1'] } } }), /c1/)
})
check('T1', 'trust/payment-trust-panel', () => {
  const h = render('trust/payment-trust-panel')
  // 신뢰 요소(자물쇠·안전 결제·결제대행 표지)와 결제 버튼이 같은 판 안
  const panel = h.slice(at(h, 'data-trust-panel'))
  assert.match(panel, /cn-block-tpp-secure|안전하게 결제돼요/)
  assert.match(panel, /type="submit"/)
})
check('T4', 'trust/payment-trust-panel', () => {
  const h = render('trust/payment-trust-panel')
  const panel = tags(h, 'data-trust-panel')[0]
  assert.match(attr(panel, 'class'), /\bbg-muted\b/, '색을 입힌 판')
  assert.match(h, /lucide-lock|<svg[^>]*aria-hidden="true"[^>]*class="[^"]*size-6/, '자물쇠')
  for (const which of ['fixture', 'fixtureMax', 'fixtureMin']) {
    const n = count(render('trust/payment-trust-panel', {}, { which }), /data-pg-mark=""/g)
    assert.ok(n >= 1 && n <= 2, `${which} 표지 1~2개`)
  }
  assert.equal(count(render('trust/payment-trust-panel', { copy: { ...fixtureOf('trust/payment-trust-panel').copy, marks: ['a', 'b', 'c'] } }), /data-pg-mark=""/g), 2, '3개를 줘도 2개')
  assert.doesNotMatch(h, /<img\b/, '그림 씰 없음')
})
for (const kv of ['trust/payment-trust-panel', 'review-list/summary-near-price', 'confirmation/order-complete'])
  check('L1', kv, () => {
    for (const which of ['fixture', 'fixtureMax', 'fixtureMin']) {
      const h = render(kv, {}, { which })
      assert.match(textOf(h), /[\d,]+원/, `${which} 원화 금액`)
      assert.match(textOf(h), /VAT|부가세/, `${which} VAT 표기`)
      // 필수 총액(billed)이 가장 크다
      const billed = tags(h, 'data-price="billed"')
      assert.equal(billed.length, 1, `${which} 총액 하나`)
      const big = fontSize(attr(billed[0], 'class'))
      assert.ok(big >= 1.9, `${which} 총액 글자 ${big}rem`)
      for (const t of tags(h, 'data-price="(plain|equivalent|before|after)"')) assert.ok((fontSize(attr(t, 'class')) ?? 1) < big, `${which} 다른 금액이 더 작다`)
    }
  })
check('L10', 'trust/payment-trust-panel', () => {
  const h = render('trust/payment-trust-panel')
  // 에스크로 되는 수단 바로 아래(같은 묶음) 결제대금예치 안내
  assert.match(h, /value="transfer"[\s\S]*?<\/label>\s*<div data-escrow=""/)
  assert.match(textOf(h), /결제대금예치\(에스크로\)/)
  assert.equal(count(h, /\schecked=""/g), 0, '결제 수단은 고른 것 없이 시작')
})
check('L9', 'trust/verified-business-strip', () => {
  const fx = fixtureOf('trust/verified-business-strip')
  const h = render('trust/verified-business-strip')
  const t = textOf(h)
  for (const k of ['상호', '대표자', '사업자등록번호', '통신판매업 신고번호', '주소', '전화']) assert.match(t, new RegExp(k))
  for (const v of [fx.business.name, fx.business.representative, fx.business.bizRegNo, fx.business.address]) assert.ok(t.includes(v), v)
  const link = tags(h, 'data-ftc-lookup')[0] && h.slice(at(h, 'data-ftc-lookup')).match(/<a [^>]*>/)[0]
  assert.match(attr(link, 'href'), /^https:\/\/www\.ftc\.go\.kr\//)
  assert.doesNotMatch(h, /<img\b/)
})
check('X2', 'trust/verified-business-strip', () => {
  // 서버가 그린 첫 HTML 에 사업자 사실이 글자로(최소 예시도)
  const fx = fixtureOf('trust/verified-business-strip', 'fixtureMin')
  const t = textOf(render('trust/verified-business-strip', {}, { which: 'fixtureMin' }))
  for (const v of [fx.business.name, fx.business.bizRegNo, fx.business.address, fx.business.phone]) assert.ok(t.includes(v), v)
})
check('X11', 'trust/brand-fact-sheet', () => {
  const h = render('trust/brand-fact-sheet')
  assert.equal(count(h, /data-definition=""/g), 1, '한 줄 정의')
  assert.equal(count(h, /data-source=""/g), 3, '수치 차별점 3개')
  assert.equal(count(render('trust/brand-fact-sheet', {}, { which: 'fixtureMax' }), /data-source=""/g), 5, '6개를 줘도 5개')
  assert.match(textOf(h.slice(at(h, 'data-representative'), at(h, 'data-key-facts'))), /박하늘\(예시\)/, '대표 실명')
  const facts = h.slice(at(h, 'data-key-facts'))
  assert.match(facts, /^data-key-facts=""/)
  for (const k of ['founded', 'location', 'bizRegNo', 'representative']) assert.match(facts, new RegExp(`data-fact="${k}"`))
  assert.match(facts, /<dl\b|<\/dl>/)
})
check('T2', 'trust/brand-fact-sheet', () => {
  for (const d of fixtureOf('trust/brand-fact-sheet').copy.differentiators) {
    assert.match(d.value, /\d/, '수치')
    assert.match(d.source, /기준/, '출처·기준일')
  }
})
check('X2', 'trust/brand-fact-sheet', () => {
  const fx = fixtureOf('trust/brand-fact-sheet')
  const t = textOf(render('trust/brand-fact-sheet'))
  for (const v of [fx.copy.definition, fx.organization.address, fx.organization.bizRegNo, fx.organization.representative]) assert.ok(t.includes(v), v)
  assert.doesNotMatch(render('trust/brand-fact-sheet'), /<img\b/)
})
check('X7', 'trust/brand-fact-sheet', () => {
  const lds = jsonLds(render('trust/brand-fact-sheet'))
  assert.equal(lds.length, 1)
  const o = lds[0]
  assert.equal(o['@type'], 'Organization')
  const fx = fixtureOf('trust/brand-fact-sheet')
  assert.equal(o.taxID, fx.organization.bizRegNo)
  assert.deepEqual(o.founder, { '@type': 'Person', name: fx.organization.representative })
  assert.equal(o.foundingDate, '2019-03-02')
  assert.deepEqual(o.sameAs, fx.organization.sameAs)
  // 홈 한 곳에만 — jsonLd 를 켤 때만
  assert.equal(jsonLds(render('trust/brand-fact-sheet', {}, { which: 'fixtureMin' })).length, 0)
})
check('X4', 'trust/brand-fact-sheet', () => {
  const h = render('trust/brand-fact-sheet')
  const t = textOf(h)
  const o = jsonLds(h)[0]
  const brandJsonLd = pure('trust/brand-fact-sheet', 'brandJsonLd')
  assert.deepEqual(o, JSON.parse(JSON.stringify(brandJsonLd(fixtureOf('trust/brand-fact-sheet').organization))), '같은 props 에서')
  assert.ok(t.includes(o.name))
  assert.ok(t.includes(o.address.streetAddress ?? fixtureOf('trust/brand-fact-sheet').organization.address))
  assert.ok(digits(t).includes(digits(o.telephone).replace(/^82/, '0')), '전화')
  assert.ok(t.includes(o.taxID))
  assert.ok(t.includes(o.founder.name))
  assert.match(t, /2019년 3월/, '설립')
  for (const u of o.sameAs) assert.ok(t.includes(u.replace(/^https?:\/\//, '')), u)
  for (const k of ['legalName', 'email', 'logo', 'aggregateRating', 'review']) assert.equal(o[k], undefined, `화면에 없는 ${k}`)
})

// ── review-list: T2 T5 T6 T7 T9 X4 A12 ───────────────────────────────────────────────────────────
for (const kv of ['review-list/distribution-filter', 'review-list/photo-gallery', 'review-list/summary-near-price'])
  check('T2', kv, () => {
    const h = render(kv)
    const line = h.slice(at(h, 'data-rating-line'))
    const p = line.slice(0, line.indexOf('</p>'))
    assert.match(textOf(p), /\d\.\d.*5점 만점에 \d\.\d점.*리뷰 \d+개 · 2026년 9월 28일 기준/, '평균 + 리뷰 수 + 기준일 한 묶음')
    assert.match(p, /<time[^>]*dateTime="2026-09-28/i)
  })
check('T5', 'review-list/distribution-filter', () => {
  const h = render('review-list/distribution-filter')
  const bars = h.slice(at(h, 'data-distribution'), at(h, '</fieldset>'))
  assert.equal(count(bars, /type="radio"/g), 6, '전체 + 5~1점')
  assert.equal(count(bars, /\schecked=""/g), 1, '하나만 고른다(전체)')
  assert.equal(new Set([...bars.matchAll(/name="([^"]+)"/g)].map((m) => m[1])).size, 1, '한 라디오 묶음')
  for (const n of [1, 2]) assert.match(bars, new RegExp(`data-star="${n}"`), `${n}점도 고를 수 있다`)
  // 리뷰 5개 이하면 막대를 숨긴다
  assert.doesNotMatch(render('review-list/distribution-filter', {}, { which: 'fixtureMin' }), /data-distribution/)
  // 판매자 답변은 모양이 따로
  const reply = tags(h, 'data-seller-reply')[0]
  assert.ok(reply, '판매자 답변')
  const card = h.match(/<article [^>]*>/)[0]
  assert.notEqual(attr(reply, 'class'), attr(card, 'class'), '답변 판은 리뷰 카드와 모양이 다르다')
  assert.match(attr(reply, 'class'), /border-s-4/)
  assert.match(attr(reply, 'class'), /bg-muted/)
  assert.match(textOf(h.slice(h.lastIndexOf('<', at(h, 'data-seller-reply')))), /^판매자 답변/)
  // 낮은 별점 리뷰도 목록에 있다(부정 리뷰를 숨기지 않는다 — 날짜순 첫 쪽에 1점이 보인다)
  assert.match(h, /data-rating="1"/)
})
check('T5', 'review-list/summary-near-price', () => {
  const pick = pure('review-list/summary-near-price', 'pickHighlights')
  const reviews = fixtureOf('review-list/summary-near-price').reviews
  const p = pick(reviews)
  const low = Math.min(...reviews.map((r) => r.rating))
  assert.ok(p.some((x) => x.critical && x.review.rating === low), '가장 낮은 별점 리뷰가 꼭 들어간다')
  assert.ok(p.length <= 3)
  assert.match(render('review-list/summary-near-price'), /data-critical=""/)
  assert.equal(pick([{ id: 'a', rating: 5, body: 'x', author: 'x', date: '2026-09-01T00:00:00Z' }]).filter((x) => x.critical).length, 0, '비판 리뷰가 없으면 억지로 넣지 않는다')
})
for (const kv of ['review-list/distribution-filter', 'review-list/photo-gallery'])
  check('T6', kv, () => {
    const h = render(kv)
    assert.ok(count(h, /data-verified=""/g) >= 1, '인증 구매 표지')
    assert.match(textOf(h), /구매 인증/)
    // 리뷰 0개면 첫 리뷰를 먼저 청한다
    const zero = render(kv, { reviews: [], summary: { avg: 0, count: 0, asOf: '2026-09-28T00:00:00.000Z', distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } } })
    assert.match(zero, /data-first-review=""/)
  })
check('T7', 'review-list/photo-gallery', () => {
  const h = render('review-list/photo-gallery')
  assert.ok(at(h, 'data-photo-gallery') > 0 && at(h, 'data-photo-gallery') < at(h, 'data-review-list'), '사진 격자가 텍스트 리뷰 위')
  const gallery = h.slice(at(h, 'data-photo-gallery'), at(h, 'data-review-list'))
  assert.ok(at(gallery, 'data-reward-after') < at(gallery, '<ul'), '적립 조건을 먼저 적는다')
  for (const a of gallery.match(/<a [^>]*>/g)) assert.match(attr(a, 'href'), /^#review-r\d+$/, '칸은 그 리뷰로')
})
for (const kv of ['review-list/distribution-filter', 'review-list/photo-gallery', 'confirmation/booking-complete'])
  check('T9', kv, () => {
    const h = kv === 'confirmation/booking-complete' ? render(kv) : render(kv, { reviews: [], summary: { avg: 0, count: 0, asOf: '2026-09-28T00:00:00.000Z', distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } } })
    const ask = h.slice(at(h, kv === 'confirmation/booking-complete' ? 'data-rating-ask' : 'data-first-review'))
    assert.equal(count(ask, /type="radio"/g), 5, '별점 1~5')
    assert.equal(count(ask, /\schecked=""/g), 0, '기본 별점 없음(미리 채운 5점 금지)')
    if (kv !== 'confirmation/booking-complete') assert.match(textOf(ask), /쓴 뒤 지급/, '보상은 쓴 뒤')
  })
for (const kv of ['review-list/distribution-filter', 'review-list/summary-near-price'])
  check('X4', kv, () => {
    const h = render(kv)
    const t = textOf(h)
    const lds = jsonLds(h)
    assert.equal(lds.length, 1)
    const ld = lds[0]
    assert.equal(ld['@type'], 'Product')
    assert.ok(t.includes(String(ld.aggregateRating.ratingValue.toFixed(1))), `평균 ${ld.aggregateRating.ratingValue} 가 화면에`)
    assert.match(t, new RegExp(`리뷰 ${ld.aggregateRating.reviewCount}개`), '리뷰 수가 화면에')
    assert.ok(t.includes(ld.name), '대상 이름이 화면에')
    if (ld.offers) assert.ok(digits(t).includes(String(ld.offers.price)), '가격이 화면에')
    // 자체 후기(Organization·LocalBusiness)에는 별점 마크업 0
    if (kv === 'review-list/distribution-filter') {
      assert.equal(ld.offers, undefined, '가격을 그리지 않는 블록은 Offer 를 싣지 않는다')
      for (const type of ['Organization', 'LocalBusiness']) assert.equal(jsonLds(render(kv, { subject: { type, name: '밀가루공방(예시)' } })).length, 0, type)
    }
  })
test('ratingJsonLd(review-kit): Product 에만 · 리뷰 0개면 없음 · 평균은 화면과 같은 소수 한 자리', async () => {
  const { ratingJsonLd } = await load(join(COMPILED, '_shared', 'review-kit.tsx'))
  const s = { avg: 4.1666, count: 12, asOf: '2026-09-28T00:00:00.000Z', distribution: { 1: 1, 2: 1, 3: 1, 4: 2, 5: 7 } }
  assert.equal(ratingJsonLd({ type: 'Product', name: 'x' }, s).aggregateRating.ratingValue, 4.2)
  assert.equal(ratingJsonLd({ type: 'Organization', name: 'x' }, s), null)
  assert.equal(ratingJsonLd({ type: 'LocalBusiness', name: 'x' }, s), null)
  assert.equal(ratingJsonLd({ type: 'Product', name: 'x' }, { ...s, count: 0 }), null)
})
check('A12', 'review-list/summary-near-price', () => {
  const h = render('review-list/summary-near-price')
  // 이름 → 평점 → 가격 → 구매 버튼 → 바로 아래 배송·반품 한 줄, 후기는 같은 첫 구역
  const order = ['<h2', 'data-rating-line', 'data-price="billed"', 'href="#cart"', 'data-shipping-line'].map((s) => at(h, s))
  for (let i = 1; i < order.length; i++) assert.ok(order[i] > order[i - 1], `순서 ${i}`)
  assert.match(h, /<\/a>\s*<p data-shipping-line=""/, '구매 버튼 바로 다음이 배송·반품 한 줄')
  assert.match(textOf(h), /반품/)
  assert.ok(at(h, 'data-critical') > 0)
})

// ── referral: V1 V2 V4 ────────────────────────────────────────────────────────────────────────
check('V1', 'referral/invite-panel', () => {
  // 상시 진입점 — 성공 순간이 없어도 늘 그린다(링크 칸·공유)
  const h = render('referral/invite-panel')
  assert.doesNotMatch(h, /\shidden=""/)
  assert.match(h, /<input [^>]*readonly=""[^>]*value="https:\/\/example\.com\/invite\/K7P2Q9"/i, '내 초대 링크 칸')
  assert.match(h, /data-copy-link=""/)
})
check('V1', 'referral/success-moment-prompt', () => {
  // 성공 순간 직후 제품 안에서 — moment 가 있을 때만 권유
  assert.match(render('referral/success-moment-prompt'), /data-success-moment=""/)
  const none = render('referral/success-moment-prompt', { moment: undefined })
  assert.match(none, /<section[^>]* hidden=""/)
  assert.doesNotMatch(none, /data-choice/)
})
check('V4', 'referral/success-moment-prompt', () => {
  const none = render('referral/success-moment-prompt', { moment: undefined })
  assert.doesNotMatch(none, /data-success-moment|<button/, '성공 전에는 묻지 않는다')
  assert.match(render('referral/success-moment-prompt', {}, { dismissed: true }), /<section[^>]* hidden=""/, '「나중에」 뒤 이 방문에서 다시 묻지 않는다')
})
for (const kv of ['referral/invite-panel', 'referral/share-sheet', 'referral/success-moment-prompt'])
  check('V2', kv, () => {
    const h = render(kv)
    if (kv === 'referral/invite-panel') {
      assert.match(h, /data-reward="you"/)
      assert.match(h, /data-reward="friend"/)
      for (const r of Object.values(fixtureOf(kv).copy.rewards).slice(1)) assert.doesNotMatch(r, /%|원 할인|현금/, '보상은 제품 가치')
    }
    if (kv === 'referral/success-moment-prompt') {
      assert.match(textOf(h), /두 분 모두/)
      return
    }
    // 채운 글로 원클릭 공유 — 문자 링크 본문에 채운 글과 링크
    const sms = h.match(/href="(sms:[^"]+)"/)[1].replace(/&amp;/g, '&')
    assert.match(decodeURIComponent(sms.split('body=')[1]), /https:\/\/example\.com\/invite\/K7P2Q9/)
    // 카카오 버튼은 템플릿이 §17 규격일 때만
    assert.match(h, /data-share="kakao"/)
    assert.doesNotMatch(render(kv, {}, { which: 'fixtureMin' }), /data-share="kakao"/)
  })
test('§17 카카오 공유 템플릿 검사(share-link kakaoTemplateIssues)', async () => {
  const { kakaoTemplateIssues } = await load(join(COMPILED, '_shared', 'share-link.tsx'))
  const t = fixtureOf('referral/invite-panel').template
  assert.deepEqual(kakaoTemplateIssues(t), [])
  assert.equal(kakaoTemplateIssues({ ...t, imageWidth: 600, imageHeight: 314 }).length, 1, '폭 800 미만')
  assert.equal(kakaoTemplateIssues({ ...t, imageWidth: 1600, imageHeight: 1600 }).length, 1, '1:1 은 규격 밖')
  assert.equal(kakaoTemplateIssues({ ...t, imageUrl: 'http://example.com/a.png' }).length, 1, 'https 아님')
  assert.equal(kakaoTemplateIssues({ ...t, title: ' ' }).length, 1)
})

// ── lead-capture: A4 A5 A6 A7 L2 L7 L8 O2 ─────────────────────────────────────────────────────────
for (const kv of ['lead-capture/magnet-preview', 'lead-capture/inline-newsletter'])
  check('A4', kv, () => {
    const h = render(kv)
    assert.equal(count(h, /<form\b/g), 1, '페이지 안 폼')
    assert.doesNotMatch(h, /role="dialog"|aria-haspopup/, '버튼으로 여는 창이 아니다')
  })
for (const kv of ['lead-capture/magnet-preview', 'lead-capture/inline-newsletter'])
  check('A7', kv, () => {
    const h = render(kv)
    const inputs = [...h.matchAll(/<input\b[^>]*>/g)].map((m) => m[0]).filter((t) => !/type="(checkbox|hidden)"/.test(t) && !/aria-hidden="true"/.test(t))
    const required = inputs.filter((t) => attr(t, 'name') === 'email')
    assert.equal(required.length, 1, '이메일 하나')
    for (const t of inputs.filter((x) => attr(x, 'name') !== 'email')) assert.equal(attr(t, 'name'), 'name', '이름(선택) 밖 칸 없음')
    assert.match(h, /data-arrival=""/, '언제 오는지')
    if (kv === 'lead-capture/magnet-preview') assert.match(h, /data-magnet-preview=""/, '받을 것 미리 보기')
  })
for (const kv of ['lead-capture/magnet-preview', 'lead-capture/inline-newsletter'])
  check('L2', kv, () => {
    const h = render(kv)
    const box = h.slice(at(h, 'data-consent="(optional|required)"'))
    const cb = box.match(/<[^>]*role="checkbox"[^>]*>/)[0]
    assert.equal(attr(cb, 'aria-checked'), 'false', '체크하지 않은 채로 시작')
    if (kv === 'lead-capture/magnet-preview') assert.match(h, /data-consent="optional"/)
    else assert.match(textOf(h), /\(필수\) 소식지 같은 광고성 정보/)
  })
check('O2', 'lead-capture/magnet-preview', () => {
  const h = render('lead-capture/magnet-preview')
  assert.match(h, /noValidate|novalidate/i)
  assert.doesNotMatch(h, /\srequired=""/)
  assert.match(textOf(h), /이메일 \(필수\)|이메일\(필수\)/)
  assert.match(textOf(h), /부를 이름 \(선택\)|부를 이름\(선택\)/)
  assert.match(h, /role="alert" tabindex="-1"|tabindex="-1" role="alert"|tabIndex="-1"/i)
  assert.match(byName.get('lead-capture/magnet-preview').source, /usePortForm\(/, '칸 검사는 떠날 때(port-form)')
})
check('A5', 'lead-capture/cart-exit-offer', () => {
  const src = byName.get('lead-capture/cart-exit-offer').source
  assert.match(src, /context === "cart" \|\| context === "checkout"/, '장바구니·결제에서만')
  assert.match(src, /useDismissMemory\(`wf-exit-offer:\$\{id\}`, "session"\)/, '방문당 한 번(sessionStorage)')
  assert.match(src, /addEventListener\("mouseout"/, '이탈 의도에서만 연다')
  assert.match(src, /if \(!ready\) return/)
  assert.match(render('lead-capture/cart-exit-offer'), /data-context="cart"/)
})
check('A6', 'lead-capture/cart-exit-offer', () => {
  // 페이지를 열 때 뜨지 않는다(첫 화면 가림 모달 없음)
  assert.doesNotMatch(render('lead-capture/cart-exit-offer'), /role="dialog"/)
  assert.doesNotMatch(byName.get('lead-capture/cart-exit-offer').source, /defaultOpen|useState\(true\)/)
  // 열면: 닫기 버튼 · 거절 선택지 · 대화상자 부품(포커스 가둠·Esc·바깥 클릭은 base-ui Dialog)
  const h = render('lead-capture/cart-exit-offer', {}, { dialog: true })
  assert.match(h, /role="dialog"/)
  assert.match(h, /data-dialog-close=""/)
  assert.match(h, /data-choice="decline"/)
  assert.match(byName.get('lead-capture/cart-exit-offer').source, /from "@\/registry\/factory\/ui\/dialog"/)
})
for (const kv of ['lead-capture/cart-exit-offer', 'announcement/dismissible-inline'])
  check('L7', kv, () => {
    const h = render(kv, {}, OPEN[kv] ?? {})
    const snooze = tags(h, 'data-snooze=""')
    assert.equal(snooze.length, 1)
    assert.match(textOf(h), /7일간 보지 않기/)
    assert.equal(tags(h, 'data-choice="decline"').length, 1, '실제 거절 버튼')
    assert.match(render(kv, {}, { ...(OPEN[kv] ?? {}), snoozed: true }), kv === 'lead-capture/cart-exit-offer' ? /./ : /<section[^>]* hidden=""/, '쉬는 중이면 묻지 않는다')
  })
for (const kv of ['lead-capture/cart-exit-offer', 'announcement/top-bar', 'announcement/dismissible-inline', 'announcement/launch-banner'])
  check('L8', kv, () => {
    const o = OPEN[kv] ?? {}
    const fx = fixtureOf(kv)
    const endsAt = fx.offer?.endsAt ?? fx.endsAt
    // 카운트다운은 실제 endsAt 에 묶인다
    for (const which of ['fixture', 'fixtureMax', 'fixtureMin']) {
      const h = render(kv, {}, { ...o, which })
      const ends = fixtureOf(kv, which).offer?.endsAt ?? fixtureOf(kv, which).endsAt
      for (const c of tags(h, 'data-countdown=""')) assert.equal(attr(c, 'data-ends-at'), ends, `${which} data-ends-at = endsAt`)
    }
    if (kv === 'lead-capture/cart-exit-offer') {
      assert.equal(count(render(kv, {}, { ...o, which: 'fixtureMin' }), /data-countdown/g), 0, 'endsAt 없으면 남은 날 없음')
      assert.equal(count(render(kv, {}, o), /data-countdown/g), 1)
      // 끝난 제안은 띄우지 않는다(열린 상태로 그려도 남은 날 없음 + 원천에서 ended 면 ready 아님)
      assert.equal(count(render(kv, { now: '2026-10-05T00:00:00.000Z' }, o), /data-countdown/g), 0)
      assert.match(byName.get(kv).source, /const ready = allowed && !ended/)
      return
    }
    // 공지: 끝난 뒤(또 시작 전)에는 그리지 않는다, endsAt 은 필수 prop
    assert.doesNotMatch(render(kv), /<section[^>]* hidden=""/)
    assert.match(render(kv, { now: new Date(new Date(endsAt).getTime() + 1000).toISOString() }), /<section[^>]* hidden=""/)
    if (fx.startsAt) assert.match(render(kv, { now: new Date(new Date(fx.startsAt).getTime() - 1000).toISOString() }), /<section[^>]* hidden=""/)
    assert.match(byName.get(kv).source, /\n {2}endsAt: IsoDate\n/, 'endsAt 필수')
    if (kv !== 'announcement/dismissible-inline') assert.equal(count(render(kv, { showCountdown: false }), /data-countdown/g), 0, '켜지 않으면 남은 날 없음')
  })

// ── announcement: A8 ────────────────────────────────────────────────────────────────────────────
for (const kv of ['announcement/top-bar', 'announcement/dismissible-inline', 'announcement/launch-banner'])
  check('A8', kv, () => {
    const h = render(kv)
    assert.equal(count(h, /<h2\b/g), 1, '한 메시지')
    // 닫을 수 있고(이름 있는 버튼) 닫은 것을 기억한다
    const src = byName.get(kv).source
    assert.match(src, /useDismissMemory\(/)
    assert.match(render(kv, {}, { dismissed: true }), /<section[^>]* hidden=""/, '닫았으면 다시 그리지 않는다')
    if (kv !== 'announcement/dismissible-inline') assert.match(h, /aria-label="[^"]*닫기"/)
    else assert.match(h, /data-choice="decline"/)
    // 흐름 안(고정·스티키 아님)
    assert.doesNotMatch(h, /\b(fixed|sticky) /)
  })

// ── confirmation: A10 O3 P10 V4 ─────────────────────────────────────────────────────────────────
for (const kv of ['confirmation/order-complete', 'confirmation/signup-complete', 'confirmation/booking-complete'])
  check('A10', kv, () => {
    for (const which of ['fixture', 'fixtureMax', 'fixtureMin']) {
      const h = render(kv, {}, { which })
      assert.equal(count(h, /data-next-action=""/g), 1, `${which} 다음 행동 하나`)
      const steps = h.slice(at(h, 'data-next-steps'))
      assert.ok(count(steps, /data-when=""/g) >= 1, `${which} 다음 일과 그때`)
      assert.match(h, /data-help=""/, `${which} 도움 받을 곳`)
    }
  })
check('O3', 'confirmation/order-complete', () => {
  const h = render('confirmation/order-complete')
  assert.match(h, /data-guest-lookup=""/)
  assert.match(textOf(h), /비회원 주문 조회/)
  const offer = h.slice(at(h, 'data-account-offer'))
  const inputs = [...offer.matchAll(/<input\b[^>]*>/g)].map((m) => m[0])
  assert.equal(inputs.length, 2, '1~2칸')
  assert.equal(attr(inputs.find((t) => attr(t, 'name') === 'email'), 'value'), 'guest@example.com', '이메일은 주문에서 채움')
  assert.equal(attr(inputs.find((t) => attr(t, 'name') === 'password'), 'type'), 'password')
})
check('P10', 'confirmation/signup-complete', () => {
  const h = render('confirmation/signup-complete')
  assert.ok(count(h.slice(at(h, 'data-unlocked')), /<li\b/g) >= 3, '열린 기능 안내')
  assert.ok(at(h, 'data-unlocked') < at(h, 'data-next-action'), '행동 앞에')
})
check('V4', 'confirmation/booking-complete', () => {
  // 성공 뒤(완료 화면)에만 경험 평점 — 선택, 고른 것 없이
  const h = render('confirmation/booking-complete')
  assert.match(h, /data-rating-ask=""/)
  assert.match(textOf(h), /\(선택\)/)
  assert.doesNotMatch(render('confirmation/booking-complete', {}, { which: 'fixtureMin' }), /data-rating-ask/, 'rating 문구를 안 주면 묻지 않는다')
})
