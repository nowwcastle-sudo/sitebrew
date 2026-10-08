// 계약 판 2(P3-2 Task 10c, 접합면 J2): 계측 출처 태그 withAttribution · CONTRACT_VERSION · 목 계측의 attribution 기록,
// 그리고 같은 판에 든 결제 checkout 의 선택 trial(마케팅 규칙 P13)과 목 기본 문구 해요체.
// 실행: node --test --test-force-exit --test-timeout=60000 "factory/scripts/*.test.mjs"
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const DIR = join(root, 'registry', 'factory', 'contract')
const OUT = join(root, '.tmp', 'contract-v2-test')
const js = (src) => ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText

// 계약 파일 → .tmp/contract-v2-test/<이름>.mjs(ports.test 와 같은 방식 — 계약끼리 import 는 타입만, lib 값 import 는 파일 주소로 잇는다).
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
const { withAttribution } = await load('attribution')

const CTA = { id: 'hero-primary', label: '시작하기(예시)', section: 'hero' }

// ① 판 번호 ────────────────────────────────────────────────────────────────
test('CONTRACT_VERSION is 2 and lives in events.ts (the runtime module with no imports)', () => {
  assert.equal(events.CONTRACT_VERSION, 2)
  assert.doesNotMatch(readFileSync(join(DIR, 'events.ts'), 'utf8'), /^\s*import\s/m)
})

// ② 출처 태그 ──────────────────────────────────────────────────────────────
test('withAttribution: a wrapped track adds the tags; the mock records the exact attribution beside untouched props', () => {
  const a = mock.mockAnalytics('?consent=analytics')
  const w = withAttribution(a, { blockId: 'hero-split', recipeId: 'r1-measure', copyVariant: 'b', experiment: { key: 'hero-cta', arm: 'b' } })
  w.track('cta_click', CTA)
  assert.deepEqual(a.events, [{ name: 'cta_click', props: CTA, attribution: { blockId: 'hero-split', recipeId: 'r1-measure', copyVariant: 'b', experiment: { key: 'hero-cta', arm: 'b' } } }])
})

test('A17: empty tags leave no attribution key — wrapping with {} or all-undefined tags records the same event as an unwrapped call', () => {
  const a = mock.mockAnalytics('?consent=all')
  withAttribution(a, {}).track('cta_click', CTA)
  withAttribution(a, { blockId: undefined }).track('cta_click', CTA, { attribution: {} })
  withAttribution(withAttribution(a, {}), {}).track('cta_click', CTA)
  assert.deepEqual(a.events, [{ name: 'cta_click', props: CTA }, { name: 'cta_click', props: CTA }, { name: 'cta_click', props: CTA }])
  for (const e of a.events) assert.equal(Object.hasOwn(e, 'attribution'), false)
  // 양성 대조: 칸이 하나라도 있으면 싣는다
  withAttribution(a, {}).track('cta_click', CTA, { attribution: { blockId: 'x' } })
  assert.deepEqual(a.events.at(-1).attribution, { blockId: 'x' })
})

test('negative control: a plain 2-argument call through an unwrapped mock records no attribution key (old callers unchanged)', () => {
  const a = mock.mockAnalytics('?consent=all')
  a.track('cta_click', CTA)
  assert.deepEqual(a.events, [{ name: 'cta_click', props: CTA }])
  assert.equal(Object.hasOwn(a.events[0], 'attribution'), false)
  // 셋째 인자에 attribution 이 없어도 키를 달지 않는다
  a.track('form_start', { form: 'contact' }, {})
  assert.equal(Object.hasOwn(a.events[1], 'attribution'), false)
})

test('double wrap: the inner (block) tag wins, the outer (page) tag is kept, fields unset inside come from outside; explicit meta wins over both', () => {
  const a = mock.mockAnalytics('?consent=analytics')
  const page = withAttribution(a, { recipeId: 'r1-measure', blockId: 'page', copyVariant: 'a' })
  const block = withAttribution(page, { blockId: 'faq-single-accordion', copyVariant: undefined })
  block.track('cta_click', CTA)
  assert.deepEqual(a.events.at(-1).attribution, { recipeId: 'r1-measure', blockId: 'faq-single-accordion', copyVariant: 'a' })
  block.track('cta_click', CTA, { attribution: { blockId: 'explicit', experiment: { key: 'k', arm: 'x' } } })
  assert.deepEqual(a.events.at(-1).attribution, { recipeId: 'r1-measure', blockId: 'explicit', copyVariant: 'a', experiment: { key: 'k', arm: 'x' } })
  // 감싼 쪽의 태그 객체를 나중에 바꿔도 이미 감싼 포트는 흔들리지 않는다
  const tags = { blockId: 'before' }
  const w = withAttribution(a, tags)
  tags.blockId = 'after'
  w.track('cta_click', CTA)
  assert.equal(a.events.at(-1).attribution.blockId, 'before')
})

test('consent false: nothing is recorded — tags included; consent/setConsent pass straight through the wrapper', () => {
  const a = mock.mockAnalytics('?consent=denied')
  const w = withAttribution(withAttribution(a, { recipeId: 'r1-measure' }), { blockId: 'hero-split' })
  w.track('cta_click', CTA)
  w.track('cta_click', CTA, { attribution: { copyVariant: 'b' } })
  assert.deepEqual(a.events, [])
  assert.deepEqual(w.consent(), a.consent())
  assert.equal(w.consent().analytics, false)
  w.setConsent({ analytics: true, marketing: false })
  assert.equal(a.consent().analytics, true)
  assert.deepEqual(w.consent(), a.consent())
  w.track('cta_click', CTA)
  assert.deepEqual(a.events, [{ name: 'cta_click', props: CTA, attribution: { recipeId: 'r1-measure', blockId: 'hero-split' } }])
})

test('withAttribution: track is one stable function per wrap (built once, not per call or per read); props are forwarded untouched', () => {
  const calls = []
  const port = { track: (...args) => calls.push(args), consent: () => ({ analytics: true, marketing: false }), setConsent: () => {} }
  const w = withAttribution(port, { blockId: 'x' })
  assert.equal(w.track, w.track)
  const { track } = w
  track('cta_click', CTA)
  assert.equal(calls.length, 1)
  assert.equal(calls[0][1], CTA, 'props 객체를 그대로 넘긴다(태그를 props 에 섞지 않는다)')
  assert.deepEqual(calls[0][2], { attribution: { blockId: 'x' } })
  // 메서드를 떼어 써도(블록은 track 만 props 로 받는다) 원래 포트의 this 가 필요한 어댑터가 깨지지 않는다
  class ClassPort {
    constructor() { this.seen = [] }
    track(n, p, m) { this.seen.push([n, m]) }
    consent() { return { analytics: true, marketing: false } }
    setConsent() {}
  }
  const cp = new ClassPort()
  const cw = withAttribution(cp, { recipeId: 'r' })
  const { track: t, consent } = cw
  t('form_start', { form: 'contact' })
  assert.deepEqual(cp.seen, [['form_start', { attribution: { recipeId: 'r' } }]])
  assert.deepEqual(consent(), { analytics: true, marketing: false })
})

// ③ 결제 checkout 의 trial(P13 체험 켬/끔) ─────────────────────────────────
test('mockBilling.checkout trial: true → trialing (trial_unavailable on a plan without trialDays), false → active even for a plan with trialDays; left out → plan decides (unchanged); ?sub= unchanged', async () => {
  const on = await mock.mockBilling('?sub=none').checkout({ planId: 'pro', trial: true })
  assert.equal(on.data.subscription.status, 'trialing')
  assert.ok(on.data.subscription.trialEnd)
  // 체험 기간 없는 요금제에 trial: true 는 오류 trial_unavailable(10c 판정, P3-3 Task 15) — 구독은 그대로
  const none = mock.mockBilling('?sub=none')
  const unavailable = await none.checkout({ planId: 'basic', trial: true })
  assert.equal(unavailable.ok, false)
  assert.equal(unavailable.code, 'trial_unavailable')
  assert.match(unavailable.formError, /체험/)
  assert.equal((await none.subscription()).data.status, 'none')
  const off = await mock.mockBilling('?sub=none').checkout({ planId: 'pro', trial: false })
  assert.equal(off.data.subscription.status, 'active')
  assert.equal(Object.hasOwn(off.data.subscription, 'trialEnd'), false)
  assert.equal((await mock.mockBilling('').checkout({ planId: 'pro' })).data.subscription.status, 'trialing')
  assert.equal((await mock.mockBilling('').checkout({ planId: 'basic' })).data.subscription.status, 'active')
  for (const s of mock.MOCK_SUBS) assert.equal((await mock.mockBilling(`?sub=${s}`).subscription()).data.status, s)
  // 쓰기 결과 강제는 trial 과 무관하게 그대로
  assert.equal((await mock.mockBilling('?submit=server-error').checkout({ planId: 'pro', trial: true })).ok, false)
})

// ④ 목 기본 문구는 해요체 ─────────────────────────────────────────────────
// adapter-mock.ts 의 문자열(따옴표·템플릿 조각)에서 한글이 든 것만 모아 합니다체 끝(「니다.」·「니다」」)을 찾는다.
const HAPNIDA = /니다[.」]/
function hangulStrings(src) {
  const sf = ts.createSourceFile('m.ts', src, ts.ScriptTarget.ES2022, true)
  const out = []
  const visit = (n) => {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) {
      if (/[가-힣]/.test(n.text)) out.push(n.text)
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
  return out
}

test('adapter-mock default Korean messages are 해요체: no string literal ends a sentence in 니다 (negative control: an old 합니다체 string is caught)', () => {
  const strings = hangulStrings(readFileSync(join(DIR, 'adapter-mock.ts'), 'utf8'))
  assert.ok(strings.length >= 15, `한글 문자열을 너무 적게 찾았다: ${strings.length}`)
  assert.deepEqual(strings.filter((s) => HAPNIDA.test(s)), [])
  // 음성 대조: 옛 문구 하나를 같은 검사기에 넣으면 잡힌다
  assert.deepEqual(hangulStrings('const NO_SUB = "이용 중인 구독이 없습니다."').filter((s) => HAPNIDA.test(s)), ['이용 중인 구독이 없습니다.'])
  assert.deepEqual(hangulStrings('throw new Error(`mock: ${k} 는 쓸 수 없습니다. 허용 값`)').filter((s) => HAPNIDA.test(s)).length, 1)
})

// P3-2 Task 7a(대장 A7·A108, DESIGN 「한 화면 한 문체」): 정적 어댑터·공통 lib 문구와 블록 예시(.fixture.ts)는 합쇼체·해요체를 한 파일에 섞지 않는다.
// 합쇼체 끝: 「…니다」 뒤가 문장 끝(마침표·물음표·닫는 괄호 앞…). 인용·후기(후기 본문은 남이 쓴 말)·공유 글 예시는 예외 목록에 이유와 함께 둔다.
const HAP_END = /(?:[가-힣]니다|십시오)(?=[.?!"'`\s,;)\]—(]|$)/
const HAE_END = /(?:[가-힣]요|세요|죠)(?=[.?!"'`\s,;)\]—(]|$)/
const TONE_EXEMPT = new Map([
  ['social-proof/quote-wall.fixture.ts', '후기 본문은 후기를 준 사람의 말이다(인용)'],
  ['social-proof/rating-summary.fixture.ts', '후기 본문은 후기를 준 사람의 말이다(인용)'],
])
function toneOf(src) {
  const strings = hangulStrings(src)
  return { hap: strings.filter((s) => HAP_END.test(s)), hae: strings.filter((s) => HAE_END.test(s)) }
}

test('tone (A7·A108): adapter-static and retention-offer speak 해요체 only; a 합쇼체 sentence is caught (negative control)', () => {
  for (const f of [join(DIR, 'adapter-static.ts'), join(root, 'registry', 'factory', 'lib', 'retention-offer.ts')]) {
    const { hap, hae } = toneOf(readFileSync(f, 'utf8'))
    assert.ok(hae.length >= 4, `${f}: 한글 문장을 너무 적게 찾았다(${hae.length})`)
    assert.deepEqual(hap, [], f)
  }
  assert.equal(toneOf('const A = "저장하지 못했습니다."').hap.length, 1)
  assert.equal(toneOf('const A = "곧 열어요. 잠시만 기다려 주세요."').hap.length, 0)
})

test('tone (A108): no block fixture mixes 합쇼체 and 해요체 sentences (exempt files: quoted reviews)', () => {
  const dir = join(root, 'registry', 'factory', 'blocks')
  const files = []
  const walk = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) { if (e.name === '_compiled') continue; const p = join(d, e.name); if (e.isDirectory()) walk(p); else if (e.name.endsWith('.fixture.ts')) files.push(p) } }
  walk(dir)
  assert.ok(files.length >= 100, `예시 파일을 너무 적게 찾았다(${files.length})`)
  const mixed = []
  for (const f of files) {
    const rel = f.slice(dir.length + 1).split('\\').join('/')
    const { hap, hae } = toneOf(readFileSync(f, 'utf8'))
    if (hap.length && hae.length && !TONE_EXEMPT.has(rel)) mixed.push(`${rel} — 합쇼체 ${hap.length}줄 · 해요체 ${hae.length}줄`)
  }
  assert.deepEqual(mixed, [])
  // 예외는 실제로 섞여 있을 때만 둔다(고쳤으면 목록에서 뺀다)
  for (const [rel, why] of TONE_EXEMPT) {
    const { hap, hae } = toneOf(readFileSync(join(dir, rel), 'utf8'))
    assert.ok(hap.length && hae.length, `${rel}: 예외(${why})가 필요 없어졌다 — 목록에서 뺀다`)
  }
})

test('the mock still speaks Korean in 해요체 at runtime (a default error and a port formError)', async () => {
  const s = mock.mockState('error')
  assert.match(s.message, /[가-힣]/)
  assert.doesNotMatch(s.message, HAPNIDA)
  const r = await mock.mockBilling('').cancel({ when: 'now' })
  assert.equal(r.ok, false)
  assert.equal(r.formError, '이용 중인 구독이 없어요.')
})
