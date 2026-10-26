// 구획 이름표(사전 revise.sections·pages)와 구획 교체 계획(sectionPlan·scopeTargets) — 설계 5.10.
//   재료는 손으로 놓은 작은 사이트(구획 키만 있다)라 사이트 빌드가 필요 없다.
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fill } from '../vocab/fill.mjs'
import { grammar } from '../vocab/grammar.mjs'
import { DEFAULT_FILE, LexiconError, extraSectionWordsOf, loadLexicon, pageWordsOf, sectionWordsOf } from '../vocab/lexicon.mjs'
import { scopeTargets, sectionNameOf, sectionPlan } from '../stamp/section-plan.mjs'

const lex = loadLexicon()

test('sectionWordsOf·extraSectionWordsOf·pageWordsOf: 옛 표를 지운 뒤에는 사전 revise 가 유일본이다 — 칸은 RegExp 와 낱말 목록이다', () => {
  assert.ok(sectionWordsOf(lex).every((e) => e.kind instanceof RegExp && e.words.length > 0), '호출하는 쪽이 쓰는 칸은 RegExp 다')
  assert.ok(sectionWordsOf(lex).find((e) => e.kind.test('hero-visit-info')))
  assert.ok(extraSectionWordsOf(lex).find((e) => e.kind.test('changelog') && e.words.includes('changelog')))
  assert.deepEqual(Object.keys(pageWordsOf(lex)), ['home', 'campaign', 'pricing', 'signup', 'login'])
})

test('사전에 revise 가 없으면 사전을 거부한다', () => {
  const dir = mkdtempSync(join(tmpdir(), 'section-words-'))
  try {
    const f = join(dir, 'lex.yaml')
    const text = readFileSync(DEFAULT_FILE, 'utf8')
    writeFileSync(f, text.slice(0, text.indexOf('\nrevise:')) + text.slice(text.indexOf('\nexpansions:')))
    assert.throws(() => loadLexicon(f), (e) => e instanceof LexiconError && e.message.includes('revise'))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('사전 revise.sections 의 kind 가 정규식이 아니면 사전을 거부한다', () => {
  const dir = mkdtempSync(join(tmpdir(), 'section-words-'))
  try {
    const f = join(dir, 'lex.yaml')
    writeFileSync(f, readFileSync(DEFAULT_FILE, 'utf8').replace('"^hero"', '"^(hero"'))
    assert.throws(() => loadLexicon(f), (e) => e instanceof LexiconError && e.message.includes('정규식 원문'))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ── scopeTargets · sectionPlan ────────────────────────────────────────────────────────────────────────────────────────
const T = grammar.text
const read = (axis, o = {}) => ({ axis, scope: 'site', strength: 1, ...o })
const at = (scope, o) => read('type-scale', { direction: 'larger', scope, ...o })
const siteOf = (...keys) => ({ sections: Object.fromEntries(keys.map((k) => [k, {}])) })
const SITE = siteOf('home/hero', 'home/features', 'home/final-cta', 'pricing/pricing-table', 'pricing/faq')
const ctx = { lex, archetype: 'saas', palette: null, site: SITE }

test('scopeTargets: section:<kind> → 그 구획 kind 의 사이트 키 · page:<k> → 그 쪽의 모든 키(사이트 키 순서)', () => {
  assert.deepEqual(scopeTargets('section:hero', SITE, lex), { keys: ['home/hero'] })
  assert.deepEqual(scopeTargets('page:pricing', SITE, lex), { keys: ['pricing/pricing-table', 'pricing/faq'] })
  const two = siteOf('home/hero', 'pricing/hero', 'home/hero-visit-info')
  assert.deepEqual(scopeTargets('section:hero', two, lex), { keys: ['home/hero', 'pricing/hero', 'home/hero-visit-info'] }, '여러 쪽·같은 갈래 구획 모두(사전 kind 정규식)')
  assert.deepEqual(scopeTargets('section:testimonials', siteOf('home/social-proof', 'home/hero'), lex), { keys: ['home/social-proof'] }, '같은 구획을 가리키는 다른 이름')
  assert.deepEqual(scopeTargets('section:features', siteOf('home/workflow-features', 'home/features', 'home/faq'), lex), { keys: ['home/workflow-features', 'home/features'] }, '사전 kind 정규식이 맞추는 구획 모두')
})

test('scopeTargets: 사이트에 없는 구획·쪽은 grammar.noSection · site·요소 범위는 던진다', () => {
  assert.deepEqual(scopeTargets('section:social-proof', SITE, lex), { ask: T.plan.noSection })
  assert.deepEqual(scopeTargets('page:blog', SITE, lex), { ask: T.plan.noSection })
  assert.deepEqual(scopeTargets('section:hero', {}, lex), { ask: T.plan.noSection }, 'sections 가 없는 사이트')
  assert.throws(() => scopeTargets('site', SITE, lex), /section/)
  assert.throws(() => scopeTargets('element:제목', SITE, lex), /section/)
})

test('sectionPlan section:hero type-scale larger → keys [home/hero], intent bolder, density 없음', () => {
  const r = sectionPlan([at('section:hero')], ctx)
  assert.deepEqual(r, { keys: ['home/hero'], intent: 'bolder', say: fill(T.scope.section.ko, { key: '히어로' }) + fill(T.plan.sayReading, { label: '글자 크기', end: '크게', amount: '조금' }) })
  assert.equal(sectionPlan([at('section:hero', { direction: 'smaller' })], ctx).intent, 'calmer')
})

test('sectionPlan section:hero color-temperature warm → 구획 의도가 없는 축이라 grammar.siteWide', () => {
  assert.deepEqual(sectionPlan([read('color-temperature', { direction: 'warm', scope: 'section:hero' })], ctx), { ask: T.ask.siteWide.ko })
  assert.deepEqual(sectionPlan([read('type-family', { value: 'serif', scope: 'section:hero' })], ctx), { ask: T.ask.siteWide.ko }, '값 읽기도 같다')
  assert.deepEqual(sectionPlan([at('section:hero'), read('color-temperature', { direction: 'warm', scope: 'section:hero' })], ctx), { ask: T.ask.siteWide.ko }, '하나라도 못 하면 모두 묻는다')
})

test('sectionPlan page:pricing spacing airy → 그 쪽 키 모두, density spacious(intent 는 없다) · tight 는 compact', () => {
  const r = sectionPlan([read('spacing', { direction: 'airy', scope: 'page:pricing' })], ctx)
  assert.deepEqual(r.keys, ['pricing/pricing-table', 'pricing/faq'])
  assert.equal(r.density, 'spacious')
  assert.equal('intent' in r, false)
  assert.equal(sectionPlan([read('spacing', { direction: 'tight', scope: 'page:pricing' })], ctx).density, 'compact')
})

test('sectionPlan: 의도와 밀도는 함께 간다 · 같은 의도 읽기들은 하나로 합친다', () => {
  const r = sectionPlan([at('section:hero'), read('spacing', { direction: 'airy', scope: 'section:hero' })], ctx)
  assert.equal(r.intent, 'bolder')
  assert.equal(r.density, 'spacious')
  const same = sectionPlan([at('section:hero'), read('motion', { direction: 'dynamic', scope: 'section:hero' })], ctx)
  assert.equal(same.intent, 'bolder')
  assert.deepEqual(same.keys, ['home/hero'])
  const two = sectionPlan([at('section:hero'), read('depth', { direction: 'lifted', scope: 'page:pricing' })], ctx)
  assert.deepEqual(two.keys, ['home/hero', 'pricing/pricing-table', 'pricing/faq'], '범위가 달라도 의도가 같으면 합친다')
})

test('sectionPlan: 서로 다른 의도(또는 밀도)는 grammar.clash', () => {
  assert.deepEqual(sectionPlan([at('section:hero'), at('section:hero', { direction: 'smaller' })], ctx), { ask: fill(T.clash.ko, { a: '크게', b: '작게' }) })
  assert.deepEqual(sectionPlan([at('section:hero'), read('motion', { direction: 'static', scope: 'section:hero' })], ctx), { ask: fill(T.clash.ko, { a: '크게', b: '정적으로' }) })
  assert.deepEqual(sectionPlan([read('spacing', { direction: 'airy', scope: 'page:pricing' }), read('spacing', { direction: 'tight', scope: 'page:pricing' })], ctx), { ask: fill(T.clash.ko, { a: '시원하게', b: '빽빽하게' }) })
})

test('sectionPlan: 상한·세기 0 읽기는 구획을 밀지 않는다 — 그것뿐이면 바꿀 내용이 없다는 grammar.nothing', () => {
  const cap = read('color-temperature', { direction: 'warm', strength: 0, cap: true, scope: 'section:hero' })
  assert.equal(sectionPlan([at('section:hero'), cap], ctx).intent, 'bolder')
  assert.deepEqual(sectionPlan([cap], ctx), { ask: T.plan.nothing })
  assert.deepEqual(sectionPlan([at('section:hero', { strength: 0 })], ctx), { ask: T.plan.nothing })
})

test('sectionPlan: 사이트에 없는 구획은 grammar.noSection · 구획·쪽이 아닌 범위는 던진다', () => {
  assert.deepEqual(sectionPlan([at('section:social-proof')], ctx), { ask: T.plan.noSection })
  assert.throws(() => sectionPlan([at('site')], ctx), /section/)
  assert.throws(() => sectionPlan([at('element:제목')], ctx), /section/)
})

test('sectionPlan say: 읽기를 낸 항목의 사전 say 를 쓴다', () => {
  const r = sectionPlan([at('page:pricing', { source: 'larger' })], ctx)
  assert.equal(r.say, fill(T.scope.page.ko, { key: '요금제' }) + lex.entries.find((e) => e.id === 'larger').say.ko)
})

test('sectionPlan: 구획 말에서 사전이 낸 읽기(--explain 이 보인 것)를 그대로 받아 같은 뜻을 낸다 — 같은 낱말에서 나온 읽기는 한 요청이라 사이트 전체로 되묻지 않는다', async () => {
  const { parseRevision } = await import('../stamp/revise.mjs')
  const planOf = (text) => {
    const request = parseRevision(text, SITE)
    return { request, plan: sectionPlan(request.classification.readings, ctx) }
  }
  for (const [text, intent] of [['히어로 더 화려하게', 'bolder'], ['히어로 덜 화려하게', 'calmer'], ['히어로 더 차분하게', 'calmer'], ['히어로 크게', 'bolder']]) {
    const { request, plan } = planOf(text)
    assert.deepEqual([plan.ask, plan.keys, plan.intent], [undefined, ['home/hero'], intent], text)
    assert.equal(request.intent, intent, `${text}: 낱말 요청과 읽기 계획의 뜻이 같다`)
  }
})

test('sectionPlan: 짝(source)이 없는 읽기는 구획으로 못 하는 축이면 사이트 전체로 되묻는다 · 요청 언어로', () => {
  const lively = [at('section:hero', { axis: 'motion', direction: 'dynamic', source: 'lively' }), read('color-saturation', { direction: 'vivid', scope: 'section:hero', source: 'lively' })]
  assert.equal(sectionPlan(lively, ctx).intent, 'bolder', '같은 낱말의 짝은 따라간다')
  const alone = lively.map((r) => ({ ...r, source: undefined }))
  assert.deepEqual(sectionPlan(alone, ctx), { ask: T.ask.siteWide.ko }, 'source 가 없으면 짝을 알 수 없다')
  assert.deepEqual(sectionPlan(alone, { ...ctx, lang: 'en' }), { ask: T.ask.siteWide.en })
  const other = [at('section:hero', { source: 'larger' }), read('color-hue', { value: 'green', scope: 'section:hero', source: 'hue-green' })]
  assert.deepEqual(sectionPlan(other, ctx), { ask: T.ask.siteWide.ko }, '다른 낱말에서 나온 구획으로 못 하는 축은 따로 말한 것이다')
  const clash = sectionPlan([at('section:hero'), at('section:hero', { direction: 'smaller' })], { ...ctx, lang: 'en' })
  assert.match(clash.ask, /pull opposite ways/, '되묻는 글도 요청 언어')
})

test('sectionNameOf: 사이트 구획 키 → 사전 이름표의 첫 낱말(요청 언어) · 이름표가 없으면 「이 구획」', () => {
  assert.equal(sectionNameOf('home/hero', lex, 'ko'), '히어로')
  assert.equal(sectionNameOf('pricing/faq', lex, 'ko'), '자주 묻는 질문')
  assert.equal(sectionNameOf('home/hero', lex, 'en'), 'hero')
  assert.equal(sectionNameOf('home/mystery-block', lex, 'ko'), grammar.text.compare.sectionFallback.ko)
  assert.equal(sectionNameOf('home/mystery-block', lex, 'en'), grammar.text.compare.sectionFallback.en)
})
