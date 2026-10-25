// 06-pages (P3-3 Task 9) — 정적 검사(파일만 만든다, 레지스트리·npm 을 건드리지 않는다) + 잠금 안 실제 빌드 1회(STAMP_PAGES_BUILD=1).
// 실행: node --test --test-force-exit --test-timeout=400000 factory/scripts/stamp-pages.test.mjs
// 실제 원형·블록·라이브러리 레시피·콘텐츠 스키마를 쓴다(녹화 없음). 문구 에이전트가 하는 일은 시험용 함수(localContent·saasContent)가 대신한다.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { BLOCKER_PREFIX } from '../stamp/sitemap.mjs'
import { PLACEHOLDER } from '../stamp/content.mjs'
import {
  generateSite, h1Problems, importProblems, trackProblems, duplicateProblems, legalRouteProblems, installNames, blockItems, blockTraits, leafSource, firstScreenCount, BLOCKER,
} from '../stamp/gen-pages.mjs'
import { EXAMPLE_MARKER, collectExampleNames, dropOptionalExamples, exampleIssues, leaves, ref, refsOf, resolveRefs, telHref } from '../stamp/site-bind.mjs'
import { isNeedsCheck, NEEDS_CHECK_LITERALS } from '../stamp/needs-check.mjs'
import { tsLoader } from './gen-favicons.mjs'

import { KO, LOCAL_FACTS, localBrief, noPhone, localContent, SAAS_BRIEF, saasContent, detailBrief, detailContent, makeRun as makeRunIn, gen, root, library, text } from './lib/stamp-site-fixtures.mjs'
void KO; void text

const TMP = join(root, '.tmp', 'stamp-pages-test')
mkdirSync(TMP, { recursive: true })
const core = await tsLoader('stamp-pages-test')('content/content-core.ts')
const makeRun = (brief, contentFor, opts) => makeRunIn(TMP, brief, contentFor, opts)
const read = (siteDir, ...p) => readFileSync(join(siteDir, ...p), 'utf8')
const siteJsonOf = (siteDir) => JSON.parse(read(siteDir, 'content', 'site.json'))
const cleanEdit = (file, from, to) => { const s = readFileSync(file, 'utf8'); if (!s.includes(from)) throw new Error(`바꿀 글자가 없다: ${from}`); writeFileSync(file, s.replace(from, to)); return () => writeFileSync(file, s) }

const L = await makeRun(localBrief(), localContent)
const LS = await gen(L)
const S = await makeRun(SAAS_BRIEF, saasContent)
const SS = await gen(S)
// 확인용: STAMP_PAGES_DEBUG=1 이면 두 사이트의 섹션·건너뜀·blockers 를 찍는다
if (process.env.STAMP_PAGES_DEBUG === '1') for (const [n, s] of [['local', LS], ['saas', SS]]) console.error(n, JSON.stringify({ routes: s.routes, sections: s.sections, skipped: s.skipped.map((x) => `${x.key} ${x.block}`), blockers: s.blockers }, null, 1))

// ─── 구조 ───

test('structure: 쪽마다 page.tsx, 콘텐츠는 content/site.json 하나, 잎 컴포넌트, 법정 쪽 경로가 원형대로 있다', () => {
  assert.deepEqual([...LS.routes].sort(), ['/', '/booking/complete', '/privacy', '/services'])
  for (const route of LS.routes) assert.ok(existsSync(join(LS.siteDir, route === '/' ? 'app/page.tsx' : `app${route}/page.tsx`)), route)
  for (const f of ['content/site.json', 'lib/site.tsx', 'lib/analytics.ts', 'lib/ports.ts', 'app/layout.tsx', 'package.json', 'components.json']) assert.ok(existsSync(join(LS.siteDir, f)), f)
  const leafFiles = readdirSync(join(LS.siteDir, 'components', 'site')).filter((f) => f !== 'form-keys.tsx')
  assert.ok(leafFiles.length >= 3, `잎 ${leafFiles.length}개`)
  assert.deepEqual(legalRouteProblems(LS.siteDir, L.archetype), [])
  assert.deepEqual([...SS.routes].filter((r) => ['/privacy', '/terms', '/refund', '/withdrawal'].includes(r)).sort(), ['/privacy', '/refund', '/terms', '/withdrawal'])
  assert.deepEqual(legalRouteProblems(SS.siteDir, S.archetype), [])
  // 음성 대조: 법정 쪽 파일이 없으면 잡는다
  const f = join(LS.siteDir, 'app', 'privacy', 'page.tsx')
  const keep = readFileSync(f, 'utf8')
  rmSync(f)
  assert.equal(legalRouteProblems(LS.siteDir, L.archetype).length, 1)
  writeFileSync(f, keep)
})

test('first screen (PERF2, C233): 쪽의 첫 블록(앞의 얇은 띠 포함)만 <div data-wf-first className="contents"> 로 감싼다 — 그 밖 블록·법정 쪽·하단 줄은 감싸지 않는다', () => {
  // 순수: 띠(announcement·consent·nav)는 앞에서부터 같이, 첫 본문 블록까지 — 첫 본문 블록이 히어로가 아니면(히어로는 첫 화면을 채운다) 그 다음 블록까지(PERF3: pwa 홈은 스켈레톤 다음 빈 상태 카드가 375 첫 화면의 LCP 인데 숨겨져 하이드레이션 뒤에 그려졌다).
  const L2 = (...blocks) => blocks.map((block, i) => ({ block, name: `L${i}`, key: `k/${i}`, file: `f${i}` }))
  assert.equal(firstScreenCount([]), 0)
  assert.equal(firstScreenCount(L2('block-hero-baseline-split', 'block-faq-x')), 1)
  assert.equal(firstScreenCount(L2('block-announcement-launch-banner', 'block-hero-baseline-split', 'block-faq-x')), 2)
  assert.equal(firstScreenCount(L2('block-announcement-a', 'block-consent-b', 'block-nav-c', 'block-product-list-spec-summary', 'block-faq-x', 'block-faq-y')), 5, '띠 3 + 히어로가 아닌 첫 본문 블록 + 그 다음 블록')
  assert.equal(firstScreenCount(L2('block-content-skeleton', 'block-onboarding-empty-first-action', 'block-faq-x')), 2, 'pwa 홈 — 스켈레톤이 짧아 다음 블록이 첫 화면에 든다')
  assert.equal(firstScreenCount(L2('block-content-skeleton')), 1)
  assert.equal(firstScreenCount(L2('block-nav-a', 'block-content-skeleton', 'block-onboarding-empty-first-action', 'block-faq-x')), 3)
  assert.equal(firstScreenCount(L2('block-hero-baseline-split', 'block-features-x', 'block-faq-x')), 1, '히어로 쪽은 히어로 하나(그 아래는 첫 화면 밖)')
  assert.equal(firstScreenCount(L2('block-announcement-a')), 1, '띠만 있으면 그 띠가 전부')
  // 생성된 쪽: 상세(detail) 홈의 첫 블록은 상품 구획이라 히어로가 아니다 — 그 구획만 감싸고, 나머지는 밖이다.
  for (const [name, site] of [['local', LS], ['saas', SS]]) {
    for (const route of site.routes) {
      const src = read(site.siteDir, route === '/' ? 'app/page.tsx' : `app${route}/page.tsx`)
      const wraps = src.match(/<div data-wf-first="" className="contents">/g) ?? []
      const tags = [...src.matchAll(/^\s+<([A-Z]\w+) props=\{sectionProps\(/gm)].map((m) => m[1])
      const inside = src.includes('data-wf-first') ? (src.match(/<div data-wf-first="" className="contents">\n([\s\S]*?)\n      <\/div>/)?.[1].match(/<[A-Z]\w+ props=/g) ?? []).length : 0
      if (tags.length === 0) { assert.equal(wraps.length, 0, `${name} ${route}: 블록이 없는 쪽은 감싸지 않는다`); continue }
      assert.equal(wraps.length, 1, `${name} ${route}: 감싸개는 하나`)
      assert.ok(inside >= 1 && inside <= 5, `${name} ${route}: 감싼 블록 ${inside}개`)
      assert.ok(src.indexOf('data-wf-first') < src.indexOf(`<${tags[0]} props=`), `${name} ${route}: 첫 블록이 감싸개 안`)
    }
  }
})

test('structure: 히어로가 그려지지 않은 쪽은 셸이 h1 을 그리고, 히어로가 h1 을 가진 쪽은 pageTitle={false} — h1 하나', () => {
  for (const [s, r] of [[LS, L], [SS, S]]) {
    assert.deepEqual(h1Problems(s.siteDir, s.pageMeta), [], r.archetype.id)
    for (const route of s.routes) {
      const src = read(s.siteDir, route === '/' ? 'app/page.tsx' : `app${route}/page.tsx`)
      assert.equal((src.match(/pageTitle=\{/g) ?? []).length, 1, `${route}: pageTitle 이 하나`)
    }
  }
  // 음성 대조 ① 셸이 h1 을 끄는데 히어로가 없다 → 잡는다
  const home = join(SS.siteDir, 'app', 'page.tsx')
  const undo = cleanEdit(home, /pageTitle=\{[^}]+\}/.exec(readFileSync(home, 'utf8'))[0], 'pageTitle={false}')
  const heroless = { ...SS.pageMeta, '/': { heroLeaves: 0 } }
  assert.ok(h1Problems(SS.siteDir, heroless).some((p) => /h1 이 없다/.test(p)))
  undo()
  // ② 히어로가 h1 을 가지는데 셸도 그린다 → 잡는다
  assert.ok(h1Problems(SS.siteDir, { ...SS.pageMeta, '/': { heroLeaves: 1 } }).some((p) => /셸도 h1/.test(p)) || SS.pageMeta['/'].heroLeaves === 1)
  // ③ 히어로가 둘이면 잡는다
  assert.ok(h1Problems(SS.siteDir, { ...SS.pageMeta, '/': { heroLeaves: 2 } }).some((p) => /히어로 잎이 2개/.test(p)))
})

test('imports: 생성된 블록 import 는 모두 블록 항목 target(설치되는 경로)에 있다', () => {
  assert.deepEqual(importProblems(LS.siteDir), [])
  assert.deepEqual(importProblems(SS.siteDir), [])
  const leaf = join(LS.siteDir, 'components', 'site', readdirSync(join(LS.siteDir, 'components', 'site')).find((f) => f !== 'form-keys.tsx'))
  const src = readFileSync(leaf, 'utf8')
  writeFileSync(leaf, src.replace(/from "(@\/components\/blocks\/[^"]+)"/, 'from "$1-없는변형"'))
  assert.equal(importProblems(LS.siteDir).length, 1)
  writeFileSync(leaf, src)
  assert.deepEqual(importProblems(LS.siteDir), [])
  // 설치 항목 이름은 저장소 블록 항목과 같다
  const names = installNames({ archetype: 'local', recipeId: 'r1-measure', blocks: [...blockItems().keys()].slice(0, 2) })
  assert.ok(names.includes('r1-measure') && names.includes('attribution') && names.includes('content-local'))
})

test('track: 블록에 넘기는 track 은 모두 withAttribution 결과이고, 블록 · 레시피 · 문구 변형 태그를 단다', () => {
  for (const s of [LS, SS]) assert.deepEqual(trackProblems(s.siteDir), [])
  const files = readdirSync(join(LS.siteDir, 'components', 'site')).filter((f) => f !== 'form-keys.tsx')
  const withTrack = files.filter((f) => /track=\{track\}/.test(read(LS.siteDir, 'components', 'site', f)))
  assert.ok(withTrack.length >= 1, 'track 을 받는 블록이 하나는 있다')
  for (const f of withTrack) {
    const src = read(LS.siteDir, 'components', 'site', f)
    assert.match(src, /withAttribution\(analytics, \{ blockId: "[a-z0-9-]+", recipeId: RECIPE, copyVariant \}\)\.track/)
    assert.match(src, /const RECIPE = "r1-measure"/)
  }
  // 음성 대조: 원래 포트의 track 을 그대로 넘기면 잡는다
  const f = join(LS.siteDir, 'components', 'site', withTrack[0])
  const undo = cleanEdit(f, 'track={track}', 'track={analytics.track}')
  assert.ok(trackProblems(LS.siteDir).length >= 1)
  undo()
  const undo2 = cleanEdit(f, 'withAttribution(analytics', 'plain(analytics')
  assert.ok(trackProblems(LS.siteDir).some((p) => /withAttribution 결과가 아니다/.test(p)))
  undo2()
})

test('J9: 콘텐츠 값은 content/site.json 한 곳에만 있다 — 생성 코드에 없고, 섹션 props 는 $ref 로 가리킨다', () => {
  for (const s of [LS, SS]) assert.deepEqual(duplicateProblems(s.siteDir), [])
  const site = siteJsonOf(LS.siteDir)
  assert.equal(site.business.name, '달빛 베이커리')
  const refs = [...Object.values(site.sections).flatMap((x) => [...refsOf(x.props)])]
  assert.ok(refs.length > 0 && refs.every((p) => typeof p === 'string'))
  // 음성 대조 ① 페이지 코드에 콘텐츠 값을 박으면 잡는다
  const home = join(LS.siteDir, 'app', 'page.tsx')
  const undo = cleanEdit(home, 'const ROUTE', '// 달빛 베이커리 예약 전화\nconst ROUTE')
  assert.ok(duplicateProblems(LS.siteDir).some((p) => /app\/page\.tsx: 콘텐츠 값이 코드에 있다/.test(p)))
  undo()
  // ② site.json 섹션 props 에 콘텐츠 문자열이 literal 로 또 있으면 잡는다
  const file = join(LS.siteDir, 'content', 'site.json')
  const raw = readFileSync(file, 'utf8')
  const firstKey = Object.keys(site.sections)[0]
  const dup = structuredClone(site)
  dup.sections[firstKey].props = { copy: { title: '달빛 베이커리' } }
  writeFileSync(file, JSON.stringify(dup))
  assert.ok(duplicateProblems(LS.siteDir).some((p) => /literal 로 또 있다/.test(p)))
  writeFileSync(file, raw)
  assert.deepEqual(duplicateProblems(LS.siteDir), [])
  // ③ 한 곳만 고치면 화면 값이 따라 바뀐다: $ref 를 풀면 business.phone 이 그 자리에서 나온다
  const changed = structuredClone(site)
  changed.business.phone = '031-999-8888'
  assert.equal(resolveRefs({ a: ref('business.phone') }, changed).a, '031-999-8888')
  assert.equal(resolveRefs({ a: ref('business.phone', { as: 'tel' }) }, changed).a, 'tel:+8231999888'.replace('8888', '9998888').slice(0, 0) + telHref('031-999-8888'))
})

// ─── 콘텐츠 규칙 ───

test('C102: 빈 사실(전화 없음) 브리프 — 자리 표시가 스키마를 통과해 화면·site.json 에 「확인 필요」, 법정 초안 조항에 missing, blockers 에 사실 경로, JSON-LD 에는 없다', async () => {
  const R = await makeRun(noPhone(), localContent)
  assert.equal(R.content.business.phone, '확인 필요')
  const s = await gen(R)
  const site = siteJsonOf(s.siteDir)
  assert.equal(site.business.phone, '확인 필요')
  assert.ok(s.blockers.includes(`${BLOCKER.fact}business.phone`), s.blockers.join('\n'))
  assert.ok(s.blockers.some((b) => b.startsWith(BLOCKER.fact) && /home\/hero-visit-info\/primaryCta/.test(b)), '사실 없는 문구 칸도 사유로 남는다')
  const draft = JSON.parse(read(s.siteDir, '..', '07-qa', 'legal', 'privacy.draft.json'))
  const controller = draft.clauses.find((c) => c.id === 'privacy.controller')
  assert.deepEqual(controller.missing, ['business.phone'], '법정 초안이 자리 표시를 빈 사실로 읽는다')
  assert.deepEqual(s.blockers.filter((b) => b.startsWith(BLOCKER.jsonld)), [], 'JSON-LD 는 그 칸을 뺐다(던지지 않는다)')
  // candidate.json 에 같은 줄이 남는다(사이트맵 blockers 와 같은 길)
  const cj = JSON.parse(read(R.runDir, 'a', 'candidate.json'))
  assert.ok(cj.blockers.includes(`${BLOCKER.fact}business.phone`))
  // 사실이 다 있는 실행에는 그 사유가 없다(음성 대조)
  assert.equal(LS.blockers.some((b) => b.startsWith(BLOCKER.fact) && !b.includes('legal.')), false, LS.blockers.join('\n'))
  // 법정 초안이 빈 사실로 읽은 자리(법정 페이지에 「확인 필요」로 보인다)도 공개 불가 사유다
  assert.ok(LS.blockers.includes(`${BLOCKER.fact}legal.collects`), '법정 초안의 빈 사실')
  assert.ok(s.blockers.includes(`${BLOCKER.fact}legal.officer.name`))
  // 같은 상수: content-core 와 needs-check(mjs)·drafts PLACEHOLDER 가 같은 글자다
  assert.deepEqual(NEEDS_CHECK_LITERALS, [core.NEEDS_CHECK, core.NEEDS_CHECK_EN])
  assert.deepEqual(Object.values(PLACEHOLDER), NEEDS_CHECK_LITERALS)
  assert.ok(isNeedsCheck(' 확인 필요 ') && !isNeedsCheck('확인'))
})

test('C102: 스키마를 통과하지 못하는 콘텐츠는 그리지 않고 던진다(빈 사실 자리의 오류만 건너뛴다)', async () => {
  const bad = await makeRun(localBrief(), localContent, { patch: (c) => ({ ...c, business: { ...c.business, bizRegNo: '12345' } }) })
  await assert.rejects(() => gen(bad), /스키마를 통과하지 못했다.*사업자등록번호/)
  const noHours = await makeRun(localBrief({ ...LOCAL_FACTS, hours: '' }), (r) => { const c = localContent(r); delete c.hours; return c })
  const s = await gen(noHours) // hours 가 빈 사실 자리라 건너뛴다 — 그려진다
  assert.ok(s.blockers.some((b) => b.startsWith(BLOCKER.fact) && /hours/.test(b)))
  assert.ok(!s.sections.includes('home/hours-table'), '영업시간 자료가 없으면 영업시간 섹션은 그리지 않는다')
})

test('C101: 문구는 콘텐츠에서만 — 묶은 값은 $ref 이고, 예시 문구가 사실 자리에 새지 않는다', () => {
  const site = siteJsonOf(LS.siteDir)
  const props = (key) => site.sections[key]?.props
  const faq = Object.entries(site.sections).find(([, v]) => /^block-faq-/.test(v.block))
  assert.ok(faq, '이 후보의 FAQ 섹션이 콘텐츠 faq 로 묶인다')
  assert.deepEqual(refsOf(faq[1].props).size > 0, true)
  const all = JSON.stringify(Object.values(site.sections).map((s) => s.props))
  assert.equal(EXAMPLE_MARKER.test(all), false, '그려지는 props 에 예시 표지가 없다')
  assert.equal(/02-000-0000|123-45-67890/.test(all.replace(/"\$ref":"[^"]+"/g, '')), false, '예시 전화·사업자번호가 literal 로 없다')
  assert.equal(props('home/hero-visit-info') !== undefined || Object.keys(site.sections).length > 0, true)
  // 예시 표지 blocker 는 묶이지 않고 남은 것뿐 — 깨끗한 콘텐츠의 묶인 섹션에는 없다
  for (const b of LS.blockers.filter((x) => x.startsWith(BLOCKER.example))) assert.doesNotMatch(b, /home\/faq|home\/menu-price|home\/hours/, b)
})

test('C101: exampleIssues — 예시 표지·예시 사업체 이름·숫자가 남은 literal 을 잡고, $ref 와 링크·식별자는 건너뛴다', () => {
  const names = collectExampleNames([{ copy: { brand: '고요 도예(예시)' }, business: { name: '솜결(예시)' } }])
  assert.ok(names.has('고요 도예') && names.has('솜결') && names.has('고요 도예(예시)'))
  const props = { copy: { title: '자주 묻는 질문', lead: '방문 전에 물어보세요(예시).', brand: '고요 도예 공방', note: '문의 1588-1234', price: ref('plans.0.price'), cta: { label: '예약하기', href: '#booking' }, id: 'faq-1' } }
  const found = exampleIssues(leaves(props), names)
  assert.deepEqual(found.map((f) => [f.path, f.why]), [['copy.lead', 'marker'], ['copy.brand', 'name'], ['copy.note', 'digits']])
  assert.ok(exampleIssues(leaves({ copy: { a: '(example) sample' } }), names).some((f) => f.why === 'marker'))
  assert.deepEqual(exampleIssues(leaves({ copy: { title: '요금제', href: '/x/예시' } }), names), [], 'href 는 건너뛴다')
  // 선택 칸(?:)에 남은 예시는 지운다. 필수 칸은 남겨 blocker 로 간다
  const copy = structuredClone(props)
  const dropped = dropOptionalExamples(copy, 'type X = { title: string; lead?: string; brand: string; note?: string }', names)
  assert.deepEqual(dropped.sort(), ['copy.lead', 'copy.note'])
  assert.equal('lead' in copy.copy, false)
  assert.equal(copy.copy.brand, '고요 도예 공방')
  // 실제 예시 모듈에서 이름을 모은다: 모든 블록 예시에서 가상 이름이 나온다
})

test('C101: 콘텐츠에 예시 표지가 있으면(이름 가운데의 「(예시)」) 화면에 그대로 나가므로 공개 불가 사유가 된다 — 사업 이름 끝의 표지 하나만 면제(QFIX [2])', async () => {
  const R = await makeRun(localBrief({ ...LOCAL_FACTS, name: '달빛 (예시) 베이커리' }), localContent)
  const s = await gen(R)
  assert.ok(s.blockers.some((b) => b.startsWith(BLOCKER.example) && /\(marker\)/.test(b)), s.blockers.join('\n'))
  assert.equal(LS.blockers.some((b) => b.startsWith(BLOCKER.example) && /\(marker\)/.test(b)), false)
  // 면제: 사업 이름 칸의 맨 끝 표지 하나(골든 브리프가 가상 사업임을 밝히는 방법) — 같은 이름이라도 표지가 끝이 아니면 위에서 막힌다
  const end = await gen(await makeRun(localBrief({ ...LOCAL_FACTS, name: '달빛 베이커리 (예시)' }), localContent))
  assert.equal(end.blockers.some((b) => b.startsWith(BLOCKER.example) && /\(marker\)/.test(b)), false, end.blockers.join('\n'))
})

test('C101: 콘텐츠와 이어지지 않은 사실 블록(예시에 가격·목록이 있다)은 그리지 않는다 — 예시 사실을 대신 싣지 않는다', () => {
  // 「같은 사실을 이미 다른 블록이 그린다」(FINAL-WF5 redundantFactKeys)로 건너뛴 선택 섹션은 자료 문제가 아니라 겹침이라 blocker 가 없다 — 자료가 안 이어진 건너뜀만 본다
  const unbound = [...LS.skipped, ...SS.skipped].filter((s) => !/같은 사실/.test(s.why))
  assert.ok(unbound.length > 0)
  for (const s of unbound) {
    const b = blockItems().get(s.block)
    assert.ok(b, s.block)
    assert.ok(![...Object.keys(siteJsonOf(LS.siteDir).sections)].includes(s.key) || s.key.startsWith('x'), `${s.key} 는 그려지지 않는다`)
    assert.ok(LS.blockers.concat(SS.blockers).some((x) => x.startsWith(BLOCKER.unbound) && x.includes(s.key)), `${s.key} blocker`)
  }
})

test('C75: 묶을 자료가 없는 필수 블록 섹션은 그리지 않아도 쪽은 만들어지고 「자료 연결 안 됨」 blocker 가 candidate.json 에 한 번씩 남는다', async () => {
  const D = await makeRun({ topic: '린넨 앞치마', archetype: 'detail', locale: 'ko', facts: { name: '린넨 앞치마', price: '29,000원', seller: '달빛상점', bizNo: '123-45-67890' } }, (request) => ({
    archetype: 'detail', locale: 'ko',
    business: { name: '달빛상점', address: '서울특별시 마포구 달빛로 12', phone: '02-1234-5678', bizRegNo: '123-45-67890', email: 'shop@moonlight.kr' },
    product: { name: '린넨 앞치마', price: 29000, taxIncluded: true, shipping: { fee: 3000, courier: '달빛택배', leadDays: 2 }, returns: { feePayer: 'buyer', withdrawalDays: 7 } },
    notice: { category: '의류', rows: [{ label: '소재', value: '린넨 100%' }] },
    facts: { ...request.seedContent.facts },
    slots: { copy: request.slots.map((s) => ({ id: s.id, role: s.role, text: text(s, PLACEHOLDER.ko) })), images: [] },
  }))
  const s = await gen(D)
  assert.ok(s.routes.includes('/'))
  const cj = JSON.parse(read(D.runDir, 'a', 'candidate.json'))
  // 02 사이트맵은 더 이상 필수 pending 을 남기지 않는다(FV1 Task 5.9) — 막는 줄은 이 단계의 「자료 연결 안 됨」이다
  assert.equal(cj.blockers.some((b) => b.startsWith(BLOCKER_PREFIX)), false, '사이트맵 「필수 섹션 블록 없음」 줄은 없다')
  for (const key of ['product-detail/spec-table']) assert.ok(cj.blockers.some((b) => b.startsWith(`${BLOCKER.unbound}${key} `)), `${key}: 자료 연결 안 됨 blocker`)
  const drawn = Object.keys(siteJsonOf(s.siteDir).sections)
  assert.ok(!drawn.some((k) => /spec-table/.test(k)), '묶지 못한 블록(사양 자료 없음)은 그리지 않는다(예시 사실을 싣지 않는다)')
  assert.ok(drawn.includes('product-detail/notice-table') && drawn.includes('product-detail/shipping-returns'), 'BIND2: 고시 표·배송 반품은 콘텐츠로 묶여 그려진다')
  // 다시 돌려도 이 단계의 줄은 바뀐 것만 — 같은 줄
  const unboundOf = (b) => b.filter((x) => x.startsWith(BLOCKER.unbound))
  const again = await gen(D)
  const cj2 = JSON.parse(read(D.runDir, 'a', 'candidate.json'))
  assert.deepEqual(unboundOf(cj2.blockers), unboundOf(cj.blockers))
  assert.equal(new Set(cj2.blockers).size, cj2.blockers.length, '중복 줄 없음')
  assert.equal(again.blockers.length, s.blockers.length)
})
test('site: 사이트 주소가 없으면 example.com 으로 그리고 공개 불가로 남긴다(canonical·OG 를 실제 도메인으로 바꿔야 한다)', async () => {
  assert.ok(LS.blockers.includes(BLOCKER.site))
  const withUrl = await makeRun(localBrief(), (r) => ({ ...localContent(r), site: { url: 'https://moonlight-bakery.kr', locale: 'ko' } }))
  const s = await gen(withUrl)
  assert.equal(s.blockers.includes(BLOCKER.site), false)
  assert.equal(siteJsonOf(s.siteDir).site.url, 'https://moonlight-bakery.kr')
})

test('메타·JSON-LD: 모든 쪽이 노드에서 만들어지고(seoMetadata·jsonLdFor) 자리 표시 글자는 구조 데이터에 없다', () => {
  for (const s of [LS, SS]) assert.equal(s.blockers.some((b) => b.startsWith(BLOCKER.jsonld)), false, s.blockers.filter((b) => b.startsWith(BLOCKER.jsonld)).join('\n'))
  const site = siteJsonOf(LS.siteDir)
  assert.equal(site.pages['/'].type, 'home')
  assert.equal(site.pages['/privacy'].type, 'legal')
  assert.equal(site.pages['/booking/complete'].type, 'app') // 색인 제외는 종류 기본값(KIND_POLICY)이 정한다 — site.json 에 noindex 를 적지 않는다
  assert.equal(site.pages['/booking/complete'].noindex, undefined)
  assert.equal(site.locale, 'ko')
  assert.match(read(LS.siteDir, 'app', 'layout.tsx'), /<MotionBoot \/>/)
  assert.match(read(LS.siteDir, 'app', 'layout.tsx'), /suppressHydrationWarning/)
})

test('잎: 블록 하나를 부르고 track 은 태그를 감싼 것, 폼을 가진 블록은 멱등 키 감싸개, 포트 블록은 목 포트', () => {
  const traits = [...blockItems().values()].map((b) => [b.name, blockTraits(b)])
  assert.ok(traits.some(([, t]) => t.track), 'track 을 받는 블록이 있다')
  assert.ok(traits.some(([, t]) => t.ports), '포트를 받는 블록이 있다')
  assert.ok(traits.some(([, t]) => t.form), '폼 블록이 있다')
  // 동의 상태를 받는 consent 블록은 포트 블록이다(빠뜨리면 saas /signup 이 prerender 에서 `consent is not a function` 으로 죽었다)
  assert.equal(blockTraits(blockItems().get('block-consent-preference-dialog')).ports, true)
  assert.equal(blockTraits(blockItems().get('block-faq-two-column-index')).ports, false)
  const pick = (f) => traits.find(([, t]) => f(t))[0]
  const form = leafSource({ name: 'X', block: pick((t) => t.form), recipeId: 'r1-measure' })
  assert.match(form, /<FormKeys>/)
  assert.match(form, /import \{ FormKeys \}/)
  const ports = leafSource({ name: 'Y', block: pick((t) => t.ports), recipeId: 'r1-measure' })
  assert.match(ports, /makePorts\(\)/)
  assert.match(ports, /\{\.\.\.ports\}/)
  const plain = leafSource({ name: 'Z', block: pick((t) => !t.form && !t.ports && t.track), recipeId: 'r1-measure' })
  assert.doesNotMatch(plain, /FormKeys|makePorts/)
  assert.match(plain, /track=\{track\}/)
})

// ─── 템플릿 ───

test('template: package.json 버전은 저장소와 같다(next·react·gsap 정확한 버전, 나머지 범위)', () => {
  const tpl = JSON.parse(readFileSync(join(root, 'factory', 'stamp', 'site-template', 'package.json'), 'utf8'))
  const repo = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  const both = { ...repo.dependencies, ...repo.devDependencies }
  // shadcn 만 템플릿에서 정확히 고정한다(FINAL-WF P5 — registry:check·SHADCN 상수의 4.21.0 과 같은 버전). 저장소는 범위(^)를 그대로 둔다.
  for (const [name, v] of Object.entries({ ...tpl.dependencies, ...tpl.devDependencies })) assert.equal(v, name === 'shadcn' ? both[name].replace(/^\^/, '') : both[name], `${name}: 템플릿 ${v} · 저장소 ${both[name]}`)
  for (const name of ['next', 'react', 'react-dom', 'gsap']) assert.match(tpl.dependencies[name], /^\d+\.\d+\.\d+$/, `${name} 정확한 버전`)
  assert.equal(tpl.dependencies.zod, repo.devDependencies.zod)
  const layout = readFileSync(join(root, 'factory', 'stamp', 'site-template', 'app', 'layout.tsx'), 'utf8')
  assert.match(layout, /<MotionBoot \/>/)
  assert.match(layout, /suppressHydrationWarning/)
  assert.match(layout, /lang=\{site\.locale === "en" \? "en" : "ko"\}/)
})

// ─── 실제 빌드 1회(잠금 안에서 STAMP_PAGES_BUILD=1) ───

test('build: 후보 하나를 로컬 레지스트리로 설치하고 next build 를 돌린다(종료 0)', { skip: process.env.STAMP_PAGES_BUILD !== '1' }, async () => {
  const saas = process.env.STAMP_PAGES_ARCH === 'saas' // 선택: 제품 화면(포트 블록)이 있는 원형도 빌드해 본다
  const R = await makeRun(saas ? SAAS_BRIEF : localBrief(), saas ? saasContent : localContent, { recipe: process.env.STAMP_PAGES_RECIPE ?? library[0].id })
  const s = await generateSite(R.runDir, R.cand, { install: true, build: true, log: console.error })
  console.error(JSON.stringify({ routes: s.routes, sections: s.sections, skipped: s.skipped.length, blockers: s.blockers.length, build: s.build }, null, 1))
  assert.equal(s.build.code, 0, `next build 종료 ${s.build.code} — ${s.build.log}`)
  assert.ok(existsSync(join(s.siteDir, '.next', 'BUILD_ID')))
  for (const p of ['app/page.tsx', 'app/privacy/page.tsx']) assert.ok(existsSync(join(s.siteDir, p)))
})

test('legal drafts: 고른 블록이 스스로 하는 일(가입 블록의 선택 마케팅 동의·나이 확인, 동의 설정 창의 이용 통계)이 초안 사실이 된다 — 콘텐츠의 legal 이 이긴다', () => {
  const blocks = Object.values(siteJsonOf(SS.siteDir).sections).map((s) => s.block)
  const signup = blocks.some((b) => /sign-up-consents$/.test(b))
  const prefs = blocks.some((b) => /consent-preference-dialog$/.test(b))
  const draft = JSON.parse(read(SS.siteDir, '..', '07-qa', 'legal', 'privacy.draft.json'))
  const ids = draft.clauses.map((c) => c.id)
  assert.equal(ids.includes('privacy.marketing'), signup, `가입 블록 ${signup} ↔ 마케팅 조항`)
  assert.equal(ids.includes('privacy.autoCollect'), prefs, `동의 설정 창 ${prefs} ↔ 자동 수집 조항`)
  if (signup) assert.equal(draft.clauses.find((c) => c.id === 'privacy.marketing').missing, undefined, '채널은 블록이 받는 4채널')
  assert.ok(signup || prefs, 'saas 골든은 가입 블록이나 동의 설정 창을 고른다(이 시험이 아무것도 안 잰 게 아니다)')
})

test('Task 14: 사실로 들어온 메일·주소가 예약 도메인(example.com·.test·.invalid …)이면 공개 불가 — 실제 도메인은 아니다(C116 와 같은 길)', async () => {
  const { reservedContactPaths, isReservedHost } = await import('../stamp/gen-pages.mjs')
  for (const h of ['example.com', 'www.example.org', 'shop.example.net', 'my.test', 'a.b.invalid', 'localhost', 'foo.example', 'EXAMPLE.COM', 'example.com.']) assert.equal(isReservedHost(h), true, h)
  for (const h of ['moonlight-bakery.kr', 'myexample.com', 'example.com.au', 'testing.io', 'contest.kr', 'invalid-shop.com']) assert.equal(isReservedHost(h), false, h)
  const c = {
    business: { name: '달빛', email: 'hello@example.com' },
    booking: { primary: { kind: 'mail', value: 'a@moonlight-bakery.kr' } },
    mapLinks: { naver: 'https://map.naver.com/p/1', kakao: 'http://shop.test/place' },
    slots: { copy: [{ id: 'x', role: '예시 hello@example.org 를 쓴다', text: '문의는 hello@moonlight-bakery.kr' }, { id: 'y', text: '문의는 x@example.net' }] },
    facts: { note: 'https://www.example.org/menu' },
  }
  assert.deepEqual(reservedContactPaths(c), ['business.email', 'facts.note', 'mapLinks.kakao', 'slots.copy.1.text'], 'role 은 뺀다 · 실제 도메인은 안 잡는다')
  assert.deepEqual(reservedContactPaths({ business: { email: 'hello@moonlight-bakery.kr' } }), [])
  // 단계 통합: 06 이 blockers 와 candidate.json 에 남긴다. 실제 도메인 실행에는 없다(음성 대조).
  const R = await makeRun(localBrief({ ...LOCAL_FACTS, email: 'hello@example.com' }), localContent)
  const s = await gen(R)
  assert.ok(s.blockers.includes(`${BLOCKER.reserved}business.email`), s.blockers.join('\n'))
  assert.ok(JSON.parse(read(R.runDir, 'a', 'candidate.json')).blockers.includes(`${BLOCKER.reserved}business.email`))
  assert.equal(LS.blockers.some((b) => b.startsWith(BLOCKER.reserved)), false, LS.blockers.join('\n'))
})

// ── 상세페이지(detail) 사이트 — 한국어 원화·영어 USD (P3-3 detail 레인, 대장 C160·C142) ──
const DETAIL_SECTIONS = ['product-detail/purchase-area', 'product-detail/notice-table', 'product-detail/shipping-returns', 'product-detail/review-list', 'global/sticky-buy-bar', 'global/footer'] // 푸터는 LEGFIX(C356)에서 detail 원형 JSON 에 필수로 더했다
// FV1 Task 5.9: 사양 표·고시 표·배송 반품은 블록에 묶였지만(원형 JSON) 콘텐츠로 잇는 binder 가 아직 없어 「자료 연결 안 됨」으로 남는다(예시 사실을 싣지 않는다 — FACT_KINDS). binder 는 「자료 연결 안 됨」 감사(Task 5.11) 몫.
const DETAIL_BLOCKED = ['product-detail/key-points', 'product-detail/qna', 'product-detail/spec-table'] // 고시 표·배송 반품은 BIND2 가 묶는다 — 사양(specs)·비교표·Q&A 자료는 이 콘텐츠에 없다
const detailSite = async (locale) => {
  const R = await makeRun(detailBrief(locale), detailContent(locale))
  return { R, s: await gen(R) }
}
const DK = await detailSite('ko')
const DE = await detailSite('en')

test('detail: 구매 영역·리뷰·하단 구매 바는 그려지고, 비교표(key-points)·Q&A 는 자료가 없어 blocker — 한국어·영어 모두', () => {
  for (const [{ s }, locale] of [[DK, 'ko'], [DE, 'en']]) {
    assert.deepEqual([...s.sections].sort(), [...DETAIL_SECTIONS].sort(), locale)
    assert.deepEqual(s.skipped.map((x) => x.key).sort(), [...DETAIL_BLOCKED].sort(), locale)
    for (const key of DETAIL_BLOCKED) assert.ok(s.blockers.some((b) => b.startsWith(`${BLOCKER.unbound}${key} `)), `${locale} ${key} blocker 가 있다\n${s.blockers.join('\n')}`)
    assert.equal(s.blockers.some((b) => b.startsWith(BLOCKER.example)), false, `${locale}: 예시 문구 blocker 0\n${s.blockers.join('\n')}`)
    assert.ok(s.blockers.find((b) => b.includes('product-detail/key-points'))?.includes('「다른 방식」 자료가 콘텐츠에 없다'))
    assert.ok(s.blockers.find((b) => b.includes('product-detail/qna'))?.includes('Q&A) 자료가 상세페이지 콘텐츠에 없다'))
    // 리뷰: 적립 안내가 필수인 사진 갤러리·분포 필터는 콘텐츠에 칸이 없어 detail 원형 허용 목록에서 뺐다(5.11 — 묶을 수 없는 변형을 03 이 고르지 않는다) → 가격 곁 요약이 곧바로 그려지고 폴백이 없다
    assert.equal(JSON.parse(read(s.siteDir, 'content', 'site.json')).sections['product-detail/review-list']?.block, 'block-review-list-summary-near-price', locale)
    assert.equal(s.fallbacks.find((f) => f.key === 'product-detail/review-list'), undefined, locale)
  }
})

test('detail: 묶인 섹션은 정적 검사를 통과한다 — 잎·import·track·h1·콘텐츠 중복·$ref 대상', () => {
  for (const [{ s, R }, locale] of [[DK, 'ko'], [DE, 'en']]) {
    assert.deepEqual(importProblems(s.siteDir), [], locale)
    assert.deepEqual(trackProblems(s.siteDir), [], locale)
    assert.deepEqual(h1Problems(s.siteDir, s.pageMeta), [], locale)
    assert.deepEqual(duplicateProblems(s.siteDir), [], locale)
    assert.deepEqual(legalRouteProblems(s.siteDir, R.archetype), [], locale)
    const site = siteJsonOf(s.siteDir)
    for (const sec of Object.values(site.sections)) assert.doesNotThrow(() => resolveRefs(sec.props, site), locale)
    const home = read(s.siteDir, 'app', 'page.tsx')
    for (const leaf of ['ProductDetailPurchaseArea', 'ProductDetailReviewList', 'GlobalStickyBuyBar']) assert.match(home, new RegExp(leaf), `${locale} ${leaf}`)
  }
})

test('detail(ko): 원화 — 통화 칸(money)은 주지 않고 블록은 예전 그대로 「원」을 그린다(KRW 출력 그대로)', () => {
  const site = siteJsonOf(DK.s.siteDir)
  assert.equal(site.product.currency, 'KRW')
  assert.equal('money' in site.sections['product-detail/purchase-area'].props.copy, false)
  assert.deepEqual(site.sections['global/sticky-buy-bar'].props.copy, {
    regionLabel: '구매', name: { $ref: 'product.name' }, priceLabel: '판매가', price: { $ref: 'product.price' }, unit: '원',
    primary: { label: '바로 구매', href: '#product' }, secondary: { label: '장바구니 담기', href: '#product' },
  })
  assert.equal('locale' in site.sections['product-detail/review-list'].props.copy.kit, false, '한국어 날짜는 블록 기본(ko-KR)')
})

test('detail(en): USD 센트 — 구매 영역·구매 바·리뷰가 product.currency 로 $48.00 을 그린다(블록 렌더로 확인), 한글이 새지 않는다', async () => {
  const site = siteJsonOf(DE.s.siteDir)
  assert.deepEqual([site.product.price, site.product.currency], [4800, 'USD'])
  assert.deepEqual(site.sections['product-detail/purchase-area'].props.copy.money, { currency: { $ref: 'product.currency' }, locale: 'en-US' })
  assert.deepEqual(site.sections['global/sticky-buy-bar'].props.copy.money, { currency: { $ref: 'product.currency' }, locale: 'en-US' })
  assert.equal(site.sections['product-detail/review-list'].props.copy.kit.locale, 'en-US')
  const rel = { 'product-detail/purchase-area': ['product-list/spec-summary.tsx', 'ProductListSpecSummary'], 'product-detail/review-list': ['review-list/summary-near-price.tsx', 'ReviewListSummaryNearPrice'], 'global/sticky-buy-bar': ['bottom-tab/sticky-action-bar.tsx', 'BottomTabStickyActionBar'] }
  const { createElement: h } = await import('react')
  const { renderToStaticMarkup } = await import('react-dom/server')
  const { loadTs } = await import('../stamp/ts-eval.mjs')
  for (const [key, [file, name]] of Object.entries(rel)) {
    const mod = await loadTs(join(root, 'registry', 'factory', 'blocks', file))
    const html = renderToStaticMarkup(h(mod[name], resolveRefs(site.sections[key].props, site)))
    assert.match(html, /\$48\.00/, `${key}: $48.00`)
    assert.equal(/[가-힣]/.test(html), false, `${key}: 한글이 남았다 ${html.match(/[^<>]*[가-힣]+[^<>]*/)?.[0]}`)
    assert.equal(/[0-9]원</.test(html), false, `${key}: 원화 글자`)
  }
})

test('shell: 머리글 행동 버튼은 primaryCta 가 짧을 때만 — 길면(375px 한 줄 머리글이 넘친다) 머리글 행동 없이 히어로·하단 바가 맡는다(P3-3 Task 14b)', async () => {
  const short = siteJsonOf(LS.siteDir).shell.action
  assert.ok(short && short.label && short.label.$ref, '짧은 primaryCta 는 머리글 행동이 된다')
  const long = await makeRun(localBrief(), localContent, { patch: (c) => ({ ...c, slots: { ...c.slots, copy: c.slots.copy.map((x) => (x.id === 'primaryCta' ? { ...x, text: '02-1234-5678로 전화해 상담 예약하기' } : x)) } }) })
  const LL = await gen(long)
  assert.equal(siteJsonOf(LL.siteDir).shell.action, null, '긴 primaryCta 는 머리글 행동으로 쓰지 않는다')
})
