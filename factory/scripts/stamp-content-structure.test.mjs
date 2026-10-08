// 04 구조 칸(대장 C297, 레인 DATA04) — 본문 섹션 렌더러가 읽는 구조 자료를 04 요청이 요청하고 --check 가 사실 대조로 막는다.
//   ① 요청: 사이트맵에 든 본문 섹션의 render.from 뿌리마다 구조 칸(모양·사실 이름·empty)이 실린다. 렌더러가 읽는 뿌리는 표(STRUCTURE_FACTS)나 면제(STRUCTURE_EXEMPT)에 모두 있다.
//   ② 검사: 골든 사실만으로 쓴 콘텐츠는 0건(양성), 사실에 없는 이름·날짜·주소·숫자·경로, 사실 없는 칸 채움, 사실 있는 칸 비움은 각각 떨어진다(음성 — 옛 요청 모양에서는 같은 콘텐츠가 통과한다).
//   ③ 골든 브리프: 새 12개만 구조 사실을 더했고 P3-3 복사본 6개 사실은 원본과 글자까지 같다.
// 실행: node --test --test-force-exit --test-timeout=300000 factory/scripts/stamp-content-structure.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadBrief } from '../stamp/brief.mjs'
import { FACT_NAMES, validateContent, PLACEHOLDER } from '../stamp/content.mjs'
import { STRUCTURE_EXEMPT, STRUCTURE_FACTS, STRUCTURE_TRACE, checkStructure, factDates, renderReads } from '../stamp/content-structure.mjs'
import { SECTION_FACTS } from '../stamp/sitemap.mjs'
import { archetypes, root } from './lib/stamp-site-fixtures.mjs'
import { brand1, brand2, goldenOf, goldenRequest, portfolio1, public1 } from './lib/stamp-structure-fixtures.mjs'
import { copyFactProblems } from './lib/golden-copy-rule.mjs'

const problemsOf = (request, content) => validateContent(request, content)
const only = (list, id) => list.filter((p) => p.startsWith(`[${id}]`))
const slotOf = (request, path) => request.structureSlots.find((s) => s.path === path)
// FV1 Task 6.2 가 골든 브리프의 빈 사실을 채웠다 — 사실이 비는 길(empty 칸)은 골든에서 그 사실을 뺀 사본으로 본다.
const without = (id, ...names) => { const b = structuredClone(goldenOf(id).brief); for (const n of names) delete b.facts[n]; return b }

// ── ① 요청 ───────────────────────────────────────────────────────────────
test('요청: 사이트맵에 든 본문 섹션의 뿌리마다 구조 칸이 실린다 — 모양(스키마에서)·사실 이름·empty·읽는 칸', () => {
  const { request } = goldenRequest('brand-1')
  assert.deepEqual(request.structureSlots.map((s) => s.path).sort(), ['careersUrl', 'history', 'leaders', 'news', 'reports'])
  const news = slotOf(request, 'news')
  assert.deepEqual(news.sections, ['home/news', 'news/press-list'])
  assert.deepEqual(news.factsWanted, ['news'])
  assert.deepEqual(news.factsUsed, ['news'])
  assert.equal(news.empty, false)
  assert.deepEqual(news.reads, ['[].title', '[].date', '[].url', '[].thumb'])
  assert.equal(news.shape.type, 'array')
  assert.deepEqual(Object.keys(news.shape.item), ['date', 'title', 'url', 'thumb?'], '선택 칸은 이름 뒤 ?')
  assert.match(news.shape.item.date, /YYYY-MM-DD/)
  assert.deepEqual({ id: news.shape.item['thumb?'].id, aspect: news.shape.item['thumb?'].aspect, source: news.shape.item['thumb?'].source }, { id: 'news-thumb', aspect: '16:9', source: 'stock-ok' }, '이미지 칸 id·비율·출처는 원형 imageSlots 에서')
  const leaders = slotOf(request, 'leaders')
  assert.equal(leaders.shape.item.portrait.source, 'real-required')
  assert.match(leaders.shape.item.portrait.src, /적지 않는다/)
  assert.match(request.structureRule, /사실로만/)
  assert.ok(request.siteRoutes.includes('/about'))
  assert.deepEqual(request.checks.map((c) => c.id).filter((id) => id.startsWith('structure-')), ['structure-invented', 'structure-missing', 'structure-trace'])
})

test('요청: 사실이 없는 칸은 empty 이고 사실을 지어내지 말라는 지시(ifEmpty)가 붙는다 — brand-2 에서 채용 주소·보고서 사실을 뺀 사본', () => {
  const { request } = goldenRequest('brand-2', { brief: without('brand-2', 'careersUrl', 'reports') })
  const careers = slotOf(request, 'careersUrl')
  assert.equal(careers.empty, true)
  assert.deepEqual(careers.factsUsed, [])
  assert.match(careers.ifEmpty, /자료 연결 안 됨/)
  assert.equal(slotOf(request, 'news').empty, false)
  assert.equal(slotOf(request, 'reports'), undefined, '보고서 사실이 없으면 보고서 섹션이 사이트맵에 없다 — 칸도 없다')
  // 골든 brand-2 자체는 두 사실을 모두 가진다(Task 6.2) — 사실이 있으면 보고서 칸이 생기고 empty 가 아니다
  const full = goldenRequest('brand-2').request
  assert.equal(slotOf(full, 'careersUrl').empty, false)
  assert.equal(slotOf(full, 'reports').empty, false)
})

test('요청: public — 첫 화면 필수 바로가기(스키마 min 1)는 schemaRequired, 공지는 선택 · 정책 카드는 문구 칸 셋(히어로 title 과 겹치지 않게 섹션/칸 키)', () => {
  const { request } = goldenRequest('public-1')
  assert.equal(slotOf(request, 'quickLinks').schemaRequired, true)
  assert.equal(slotOf(request, 'quickLinks').shape.min, 1)
  assert.equal(slotOf(request, 'notices').schemaRequired, false)
  const slots = Object.fromEntries(request.slots.map((s) => [s.path, s]))
  for (const id of ['title', 'desc', 'deadline']) assert.deepEqual(slots[`main/policy-cards/${id}`].factsUsed, ['policyCards'], id)
  assert.equal(slots['main/hero/title'].factsWanted, undefined, '히어로 title 은 사실 칸이 아니다')
})

test('요청: portfolio — 사례 쪽은 첫 항목(0번)만 읽는다 — 읽는 칸 목록에 0.challenge … 0.slug', () => {
  const { request } = goldenRequest('portfolio-1')
  const cs = slotOf(request, 'caseStudies')
  for (const r of ['0.challenge', '0.role', '0.process', '0.solution', '0.results', '0.slug', '0.meta.client']) assert.ok(cs.reads.includes(r), r)
  assert.deepEqual(slotOf(request, 'works').reads.sort(), ['[].client', '[].disciplines', '[].thumb', '[].title', '[].year'].sort())
  assert.equal(slotOf(request, 'works').schemaRequired, true)
})

test('요청: 구조 칸이 없는 골든(commerce·saas·local — 렌더러가 스키마 필수 구조나 자료 없음 blocker 만 읽는다)은 구조 키가 아예 없고 dashboard 갱신 주기는 자리 표시 규칙(SCHEMA_FACTS)이 맡는다 (QFIX [3]: dashboard·pwa·detail 은 구조 칸이 생겼다 — stamp-qfix-body.test.mjs)', () => {
  // saas 는 후기·연동 구조 칸을 늘 요청한다(QFIX2 — 필수 섹션이 읽는다): 사실이 없으면 그 칸들은 모두 empty(지어내지 않는다)
  const bareSaas = goldenRequest('saas-1', { brief: without('saas-1', 'changelog', 'testimonials', 'integrations') }).request
  assert.deepEqual(bareSaas.structureSlots.map((s) => [s.path, s.empty]).sort(), [['integrations', true], ['testimonials', true]])
  for (const [id, brief] of [['commerce-2'], ['local-1', without('local-1', 'notices')]]) {
    const q = goldenRequest(id, { brief }).request
    assert.equal(q.structureSlots, undefined, id)
    assert.equal(q.siteRoutes, undefined, '구조 칸이 없는 요청은 옛 모양 그대로 — 요청 해시·이미 쓴 04 가 안 바뀐다')
    assert.equal(q.checks.some((c) => c.id.startsWith('structure-')), false, id)
  }
  const d1 = goldenRequest('dashboard-1').request
  assert.equal(d1.missing.includes('decision.refresh'), false, 'dashboard-1 은 refresh 사실이 있다')
  const noRefresh = structuredClone(goldenOf('dashboard-1').brief)
  delete noRefresh.facts.refresh
  const d2 = goldenRequest('dashboard-1', { brief: noRefresh }).request
  assert.ok(d2.missing.includes('decision.refresh'))
  assert.deepEqual(d2.factPaths['decision.refresh'], ['decision', 'refresh'])
})

test('가드: 원형 본문 섹션 렌더러가 읽는 콘텐츠 뿌리는 모두 STRUCTURE_FACTS 나 STRUCTURE_EXEMPT(까닭)에 있다 — 새 렌더러 자료를 더하고 요청에서 빠뜨릴 수 없다', () => {
  const missing = []
  for (const a of Object.values(archetypes)) for (const p of a.pages) for (const s of p.sections) {
    for (const { root: r } of renderReads(s.noBlock?.render)) {
      if (!(r in (STRUCTURE_FACTS[a.id] ?? {})) && !STRUCTURE_EXEMPT[`${a.id}.${r}`]) missing.push(`${a.id}.${r} (${p.id}/${s.kind})`)
    }
  }
  assert.deepEqual(missing, [])
  for (const [k, why] of Object.entries(STRUCTURE_EXEMPT)) assert.ok(why.length > 10, k)
  // 이 표의 사실 이름은 모두 FACT_NAMES 안(문구 에이전트·사이트맵이 아는 이름)
  const names = new Set(FACT_NAMES.map((n) => n.toLowerCase()))
  for (const m of Object.values(STRUCTURE_FACTS)) for (const list of Object.values(m)) for (const n of list) assert.ok(names.has(n.toLowerCase()), n)
  // 구조 사실 이름이 섹션을 여는 곳(SECTION_FACTS)과 같은 이름이다 — 사실을 주면 섹션이 들어오고 요청이 그 칸을 요구한다
  assert.ok(SECTION_FACTS.leadership.includes('leaders') && SECTION_FACTS.sustainability.includes('reports') && SECTION_FACTS.changelog.includes('changelog'))
})

test('가드: 모든 STRUCTURE_TRACE 칸은 STRUCTURE_FACTS 뿌리에 있다', () => {
  for (const [arch, m] of Object.entries(STRUCTURE_TRACE)) for (const r of Object.keys(m)) assert.ok(r in (STRUCTURE_FACTS[arch] ?? {}), `${arch}.${r}`)
})

// ── ② 검사 ───────────────────────────────────────────────────────────────
test('양성 대조: 골든 사실만으로 쓴 콘텐츠(brand-1·brand-2·public-1·portfolio-1)는 검사 0건 — 구조 규칙이 너무 엄격하지 않다', () => {
  for (const [id, fn] of [['brand-1', brand1], ['brand-2', brand2], ['public-1', public1], ['portfolio-1', portfolio1]]) {
    const { request } = goldenRequest(id)
    assert.deepEqual(problemsOf(request, fn(request)), [], id)
  }
})

test('음성 대조: 사실에 없는 소식 제목 · 사실에 없는 날짜 · 사실에 없는 주소 · 사실에 없는 숫자는 [structure-trace] 로 떨어진다', () => {
  const { request } = goldenRequest('brand-1')
  const ok = brand1(request)
  const bad = (mutate) => { const c = structuredClone(ok); mutate(c); return only(problemsOf(request, c), 'structure-trace') }
  assert.equal(bad((c) => { c.news.push({ date: '2026-09-03', title: '신제품 대상을 받았어요', url: 'https://example.com/news/autumn-tea' }) }).length, 1)
  assert.match(bad((c) => { c.news.push({ date: '2026-09-03', title: '신제품 대상을 받았어요', url: 'https://example.com/news/autumn-tea' }) })[0], /이름·제목 "신제품 대상을 받았어요"/)
  assert.match(bad((c) => { c.news[0].date = '2026-09-04' })[0], /날짜 2026-09-04/)
  assert.match(bad((c) => { c.news[0].url = 'https://example.com/news/other' })[0], /주소 https:\/\/example.com\/news\/other/)
  assert.match(bad((c) => { c.history[1].year = 2020 })[0], /연도 2020/)
  assert.match(bad((c) => { c.leaders[0].bio = '한옥 보존 설계를 20년 했어요' })[0], /숫자 20/)
  assert.match(bad((c) => { c.leaders.push({ name: '박지후', title: '이사', bio: '운영을 맡아요', portrait: { id: 'portrait', aspect: '4:5', source: 'real-required', alt: '박지후 사진' } }) })[0], /이름·제목 "박지후"/)
  assert.match(bad((c) => { c.reports[0].pages = 40 })[0], /숫자 40/)
  assert.match(bad((c) => { c.careersUrl = 'https://example.com/jobs' })[0], /주소 https:\/\/example.com\/jobs/)
})

test('음성 대조: 사실 없는 칸을 채우면 [structure-invented] — brand-2 에서 채용 주소·보고서 사실을 뺀 사본', () => {
  const { request } = goldenRequest('brand-2', { brief: without('brand-2', 'careersUrl', 'reports') })
  const c = brand2(request)
  delete c.careersUrl
  delete c.reports
  assert.deepEqual(problemsOf(request, c), [])
  const filled = { ...c, careersUrl: 'https://example.com/careers' }
  const p = only(problemsOf(request, filled), 'structure-invented')
  assert.equal(p.length, 1)
  assert.match(p[0], /careersUrl/)
  // 사실 없는 뿌리를 사이트맵에 없는 칸으로 채워도 같은 규칙이 본다(보고서 칸은 요청에 없으므로 스키마 검사만 — 구조 규칙은 요청 칸에만 걸린다)
  assert.deepEqual(only(problemsOf(request, { ...c, careersUrl: PLACEHOLDER.en }), 'structure-invented'), [], '자리 표시는 비운 것이다')
})

test('음성 대조: 사실이 있는 칸을 비우면 [structure-missing] — 소식·바로가기', () => {
  const { request } = goldenRequest('brand-1')
  const c = brand1(request)
  const p = only(problemsOf(request, { ...c, news: [] }), 'structure-missing')
  assert.equal(p.length, 1)
  assert.match(p[0], /news 가 비었다/)
  const { request: pr } = goldenRequest('public-1')
  const noLinks = public1(pr)
  delete noLinks.quickLinks
  assert.equal(only(problemsOf(pr, noLinks), 'structure-missing').length, 1)
})

test('public: 공지 주소는 사실에 있다 — 지어낸 /notice/1 경로·모르는 바깥 주소는 떨어지고, 사실에 주소가 없으면 자리 표시(Href 칸의 형식 오류는 건너뛴다)가 통과한다', () => {
  const { request } = goldenRequest('public-1')
  const ok = public1(request)
  assert.deepEqual(problemsOf(request, ok), [], '사실의 공지 주소 통과')
  const strippedBrief = structuredClone(goldenOf('public-1').brief)
  strippedBrief.facts.notices = strippedBrief.facts.notices.split(' ; ').map((r) => r.split(' | ').slice(0, 4).join(' | ')).join(' ; ')
  const { request: noUrlReq } = goldenRequest('public-1', { brief: strippedBrief })
  const placeholdered = public1(noUrlReq)
  placeholdered.notices.forEach((n) => { n.url = PLACEHOLDER.ko })
  assert.deepEqual(problemsOf(noUrlReq, placeholdered), [], '사실에 주소가 없으면 자리 표시 주소 통과')
  const withRoute = structuredClone(ok)
  withRoute.notices[0].url = '/notice/1'
  assert.match(only(problemsOf(request, withRoute), 'structure-trace')[0], /경로 \/notice\/1 가 이 사이트의 쪽도 브리프 사실도 아니다/)
  const withHost = structuredClone(ok)
  withHost.quickLinks[0].href = 'https://example.com/nope'
  assert.match(only(problemsOf(request, withHost), 'structure-trace')[0], /주소 https:\/\/example.com\/nope/)
  // 이 사이트의 쪽 경로(/guide)는 사실에 적혀 있어도 없어도 된다
  const siteRoute = structuredClone(ok)
  siteRoute.quickLinks[2] = { label: '이용 안내', href: '/privacy' }
  assert.deepEqual(only(problemsOf(request, siteRoute), 'structure-trace'), [])
})

test('음성 대조: public 지어낸 공지 날짜·부서 · portfolio 지어낸 작업·연도·slug', () => {
  const { request } = goldenRequest('public-1')
  const c = public1(request)
  const a = structuredClone(c); a.notices[0].date = '2026-10-01'
  assert.match(only(problemsOf(request, a), 'structure-trace')[0], /날짜 2026-10-01/)
  const b = structuredClone(c); b.notices[1].department = '기획예산과'
  assert.match(only(problemsOf(request, b), 'structure-trace')[0], /이름·제목 "기획예산과"/)
  const { request: pr } = goldenRequest('portfolio-1')
  const p = portfolio1(pr)
  const w = structuredClone(p); w.works[0].year = 2019
  assert.match(only(problemsOf(pr, w), 'structure-trace')[0], /연도 2019/)
  const s = structuredClone(p); s.works[1].slug = 'night-market'; s.caseStudies[0].next = 'night-market'
  assert.ok(only(problemsOf(pr, s), 'structure-trace').some((x) => /주소 조각 "night-market"/.test(x)))
  const t = structuredClone(p); t.caseStudies[0].results.push('매출이 30% 늘었어요')
  assert.match(only(problemsOf(pr, t), 'structure-trace')[0], /숫자 30/)
})

test('옛 동작 대조: 구조 칸이 없는 옛 요청 모양에서는 같은 지어낸 항목이 통과한다(= 이 검사가 막는 구멍)', () => {
  const { request } = goldenRequest('brand-1')
  const invented = brand1(request)
  invented.news.push({ date: '2026-12-31', title: '가짜 대상 수상', url: 'https://example.com/fake' })
  assert.ok(only(problemsOf(request, invented), 'structure-trace').length >= 3, '새 요청: 제목·날짜·주소 셋 다 잡힌다')
  const legacy = { ...request }
  delete legacy.structureSlots
  delete legacy.siteRoutes
  assert.deepEqual(problemsOf(legacy, invented).filter((p) => p.startsWith('[structure')), [], '옛 요청: 못 잡는다')
})

test('사실 없는 필수 구조 칸(public quickLinks min 1)은 비어도 스키마 오류로 막지 않고 채우면 [structure-invented]', () => {
  const brief = structuredClone(goldenOf('public-1').brief)
  delete brief.facts.quickLinks
  const { request } = goldenRequest('public-1', { brief })
  assert.equal(slotOf(request, 'quickLinks').empty, true)
  const c = public1(request)
  delete c.quickLinks
  assert.deepEqual(problemsOf(request, c), [], '키를 안 적어도 [schema] 가 없다 — 06 이 「자료 연결 안 됨」')
  assert.equal(only(problemsOf(request, public1(request)), 'structure-invented').length, 1, '지어낸 바로가기는 막힌다')
})

test('날짜 읽기: 사실 글의 날짜를 YYYY-MM-DD 로 읽는다(ISO·점·한글·영어 월)', () => {
  const d = factDates('2026-09-03 · 2025.4.7 · 2024년 11월 20일 · September 10, 2026 · 3 Mar 2023')
  for (const x of ['2026-09-03', '2025-04-07', '2024-11-20', '2026-09-10', '2023-03-03']) assert.ok(d.has(x), x)
  assert.equal(d.has('2026-09-04'), false)
})

test('checkStructure: 요청에 구조 칸이 없으면 아무것도 보지 않는다', () => {
  assert.deepEqual(checkStructure({ facts: {}, archetype: 'saas' }, { news: [{ title: '아무거나' }] }), [])
})

// ── ③ 골든 브리프 ────────────────────────────────────────────────────────
const BRIEFS = join(root, 'factory', 'stamp', 'briefs')
const COPIES = { 'detail-1': 'detail-ko', 'detail-2': 'detail-en-brand', 'local-1': 'local-ko-ltc', 'local-2': 'local-ko-missing-facts', 'saas-1': 'saas-ko', 'saas-2': 'saas-en-sampleco-like' }
test('골든 브리프: P3-3 복사본 6개의 원본 사실은 같은 값이거나 덧붙인 문장·가상 값이다(Task 6.2 가 빈 사실을 채웠다 — 규칙은 lib/golden-copy-rule.mjs)', () => {
  for (const [id, orig] of Object.entries(COPIES)) {
    const a = JSON.parse(readFileSync(join(BRIEFS, 'golden', `${id}.json`), 'utf8'))
    const b = JSON.parse(readFileSync(join(BRIEFS, `${orig}.json`), 'utf8'))
    assert.deepEqual(copyFactProblems(id, a.facts, b.facts), [], id)
    assert.deepEqual(Object.keys(b.facts), Object.keys(a.facts).filter((k) => k in b.facts), `${id} 원본 사실의 순서는 그대로`)
  }
})

test('골든 브리프: 새 12개 중 구조 사실을 더한 것 — 사실은 문자열이고 로드된다(brand 1·2, public 1·2, portfolio 1·2, commerce-1 origin, dashboard 1·2 refresh)', () => {
  const ADDED = {
    'brand-1': ['news', 'history', 'leaders', 'reports', 'careersUrl'], 'brand-2': ['news', 'history', 'leaders'],
    'public-1': ['quickLinks', 'notices', 'policyCards'], 'public-2': ['quickLinks', 'notices'],
    'portfolio-1': ['works', 'caseStudies'], 'portfolio-2': ['works', 'caseStudies'],
    'commerce-1': ['origin'], 'dashboard-1': ['refresh'], 'dashboard-2': ['refresh'],
  }
  for (const [id, names] of Object.entries(ADDED)) {
    const b = loadBrief(join(BRIEFS, 'golden', `${id}.json`))
    for (const n of names) assert.ok(typeof b.facts[n] === 'string' && b.facts[n].trim().length > 10, `${id}.${n}`)
  }
})

test('골든 브리프: 새 구조 사실에는 실존 브랜드가 아닌 가상 이름만 — 이메일은 example.com, 도메인은 example.com, 주소·전화·숫자 번호는 이 레인이 더하지 않았다', () => {
  for (const id of ['brand-1', 'brand-2', 'public-1', 'public-2', 'portfolio-1', 'portfolio-2']) {
    const b = JSON.parse(readFileSync(join(BRIEFS, 'golden', `${id}.json`), 'utf8'))
    const urls = JSON.stringify(b.facts).match(/https?:\/\/[^\s"]+/g) ?? []
    for (const u of urls) assert.match(u, /^https:\/\/(?:[\w-]+\.)?example\.com(?:\/|$)/, `${id} ${u}`)
  }
})
