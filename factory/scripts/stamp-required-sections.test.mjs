// P4GR2 — 골든 07 전에 판정된 두 건(대장 C70·C96).
//  C70: 원형의 필수 섹션 중 06 이 그리지 않은 것(본문 content·부품 part 모드, 안 그려지는 전역 섹션)이 blocker 없이 조용히 빠져 공개 가능으로 읽혔다
//       → 「공개 불가 — 필수 섹션 그리지 않음: <쪽>/<섹션>」 한 줄씩. 이미 자기 줄이 있는 것(필수 pending·자료 연결 안 됨)·SiteShell 이 그리는 것·조건부 전역 섹션은 겹쳐 적지 않는다.
//  C96: detail review-list 는 리뷰 0건이면 막지 않고 빈 상태로 그린다 — 가짜·예시 리뷰는 넣지 않는다.
// 실행: node --test --test-force-exit --test-timeout=300000 factory/scripts/stamp-required-sections.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { BLOCKER, undrawnRequiredBlockers } from '../stamp/gen-pages.mjs'
import { PLACEHOLDER } from '../stamp/content.mjs'
import { root, text, detailBrief, detailContent, makeRun, gen } from './lib/stamp-site-fixtures.mjs'

const TMP = join(root, '.tmp', 'stamp-required-sections-test')
const siteOf = (s) => JSON.parse(readFileSync(join(s.siteDir, 'content', 'site.json'), 'utf8'))

// ── C70 순수 ─────────────────────────────────────────────────────────────
const SM = {
  pages: [
    { id: 'home', route: '/', sections: [
      { kind: 'hero', required: true, status: 'block' },
      { kind: 'news', required: true, status: 'content' },
      { kind: 'skeleton', required: true, status: 'part' },
      { kind: 'filters', required: true, status: 'pending' },
      { kind: 'faq', required: true, status: 'block' },
      { kind: 'awards', required: false, status: 'content' },
    ] },
    { id: 'privacy', route: '/privacy', legal: true, sections: [] },
  ],
  globals: [
    { kind: 'header', required: true, status: 'shell' },
    { kind: 'skip-link', required: true, status: 'none' },
    { kind: 'footer', required: true, status: 'block' },
    { kind: 'top-bar', required: true, status: 'none' },
    { kind: 'official-banner', required: true, condition: 'x', status: 'block' },
    { kind: 'kakao', required: false, status: 'none' },
  ],
}

test('C70: 그리지 않은 필수 섹션(content·part·안 그려진 전역)만 한 줄씩 — 그려진 것·필수 pending·선택·조건부·SiteShell 몫은 없다', () => {
  const drawn = { 'home/hero': {}, 'home/faq': {}, 'global/footer': {} }
  const out = undrawnRequiredBlockers(SM, drawn, [])
  assert.deepEqual(out, [`${BLOCKER.undrawn}home/news`, `${BLOCKER.undrawn}home/skeleton`, `${BLOCKER.undrawn}global/top-bar`])
  assert.equal(BLOCKER.undrawn, '공개 불가 — 필수 섹션 그리지 않음: ')
})

test('C70: 블록 섹션이 묶이지 않아 이미 「자료 연결 안 됨」 줄이 있으면 겹쳐 적지 않는다(음성 대조: 그 줄이 없으면 적는다)', () => {
  const drawn = { 'home/hero': {}, 'global/footer': {} }
  const covered = [`${BLOCKER.unbound}home/faq (block-faq-x) — 자료 없음`]
  assert.equal(undrawnRequiredBlockers(SM, drawn, covered).includes(`${BLOCKER.undrawn}home/faq`), false)
  assert.equal(undrawnRequiredBlockers(SM, drawn, []).includes(`${BLOCKER.undrawn}home/faq`), true)
})

// ── C70 통합: brand 원형(본문 모드 필수 섹션 다섯) ───────────────────────
const BRAND_BRIEF = { topic: '한옥 찻집 브랜드 소개', archetype: 'brand', locale: 'ko', facts: { name: '솔결재', legalName: '주식회사 솔결재', representative: '윤도현', bizNo: '123-45-67890', email: 'hello@solgyeol.kr', address: '전북 전주시 완산구 솔길 45', phone: '063-123-4567', founded: '2019년 문을 열었어요', story: '백 년 된 한옥을 고쳐 찻집을 열었어요', claim: '직접 덖은 차를 내어 드려요' } }
function brandContent(request) {
  const organization = { ...request.seedContent.organization }
  for (const name of request.missing) { const p = request.factPaths[name]; if (p[0] === 'organization') organization[p[1]] = PLACEHOLDER.ko }
  organization.url = PLACEHOLDER.ko
  return {
    archetype: 'brand', locale: 'ko', organization, tagline: '한옥에서 차 한 잔',
    history: [{ year: 2019, event: '한옥 찻집의 문을 열었어요' }],
    facts: { ...request.seedContent.facts },
    slots: { copy: request.slots.map((s) => ({ id: s.id, role: s.role, text: text(s, PLACEHOLDER.ko) })), images: [] },
  }
}

test('C70 통합(brand): 필수 본문 섹션은 06 이 그리거나(자료 있음) 「자료 연결 안 됨 … (본문)」 한 줄을 남긴다 — 「필수 섹션 그리지 않음」과 겹쳐 적지 않고, 그려진 섹션은 둘 다 없다(레인 CONTENT)', async () => {
  const R = await makeRun(TMP, BRAND_BRIEF, brandContent)
  const s = await gen(R)
  const required = R.sitemap.pages.filter((p) => !p.legal).flatMap((p) => p.sections.filter((x) => x.required).map((x) => ({ key: `${p.id}/${x.kind}`, status: x.status })))
  const content = required.filter((x) => x.status === 'content' || x.status === 'part')
  assert.ok(content.length >= 5, `brand 에는 필수 본문 섹션이 여럿이다: ${content.map((x) => x.key).join(', ')}`)
  // 자료가 있는 것은 그린다: 회사 요약(문구 칸 summary) — 연혁은 선택 섹션이라 브리프 사실이 있을 때만 사이트맵에 든다
  const all = s.blockers.join(' | ')
  assert.ok(s.sections.includes('about/summary'), all)
  const unboundContent = (k) => s.blockers.some((b) => b.startsWith(`${BLOCKER.unbound}${k} (본문) — `))
  for (const { key } of content) {
    const drawn = s.sections.includes(key)
    assert.equal(drawn || unboundContent(key), true, `${key}: 그리거나 「자료 연결 안 됨」 — ${all}`)
    assert.equal(s.blockers.includes(`${BLOCKER.undrawn}${key}`), false, `${key}: 「필수 섹션 그리지 않음」과 겹쳐 적지 않는다`)
    if (drawn) assert.equal(unboundContent(key), false, key)
  }
  // 소식·채용은 콘텐츠에 자료(news·careersUrl)가 없어 그리지 않는다 — 지어내지 않는다
  for (const k of ['home/news', 'news/press-list', 'home/careers', 'careers/job-list']) assert.equal(unboundContent(k), true, k)
  // candidate.json 에도 같은 줄이 남는다(보드가 읽는 곳)
  const cand = JSON.parse(readFileSync(join(R.runDir, 'a', 'candidate.json'), 'utf8'))
  for (const b of s.blockers.filter((x) => x.startsWith(BLOCKER.unbound))) assert.ok(cand.blockers.includes(b), b)
})

// ── C96 detail 리뷰 0건 ──────────────────────────────────────────────────
const noRating = (c) => { const { rating, ...product } = c.product; void rating; return { ...c, product } }

test('C96: detail 리뷰 0건 — review-list 는 빈 상태로 그려지고 공개를 막지 않는다(자료 연결 안 됨·예시 문구 blocker 없음, 리뷰·별점 지어내지 않음)', async () => {
  for (const locale of ['ko', 'en']) {
    const R = await makeRun(TMP, detailBrief(locale), detailContent(locale, { reviews: [] }), { patch: noRating })
    const s = await gen(R)
    assert.ok(s.sections.includes('product-detail/review-list'), `${locale}: review-list 가 그려진다\n${s.blockers.join('\n')}`)
    assert.equal(s.skipped.some((x) => x.key === 'product-detail/review-list'), false, locale)
    assert.equal(s.blockers.some((b) => b.includes('product-detail/review-list')), false, `${locale}: review-list blocker 0\n${s.blockers.join('\n')}`)
    assert.equal(s.blockers.some((b) => b.startsWith(BLOCKER.example)), false, `${locale}: 예시 문구 blocker 0\n${s.blockers.join('\n')}`)
    const p = siteOf(s).sections['product-detail/review-list'].props
    assert.deepEqual(p.reviews, [], `${locale}: 리뷰를 지어내지 않는다`)
    assert.equal(p.summary.count, 0, locale)
    assert.equal('avg' in p.summary, false, `${locale}: 평균을 댈 리뷰가 없으니 평균 수치도 없다`)
  }
})

test('C96 음성 대조: 리뷰가 있으면 그대로 묶는다(개수 2·기준일 ref) — 빈 상태 갈래가 있는 리뷰를 지우지 않는다', async () => {
  const R = await makeRun(TMP, detailBrief('ko'), detailContent('ko'))
  const s = await gen(R)
  const p = siteOf(s).sections['product-detail/review-list'].props
  assert.equal(p.reviews.length, 2)
  assert.ok(p.summary.asOf.$ref, '기준일은 가장 최근 리뷰 날짜 ref')
})

test('C96: 사이트 어디에도 안 나가는 자리 표시 문구 칸(detail 별점 칸 rating — 어떤 binder 도 안 쓴다)은 「확인 필요 사실」로 공개를 막지 않는다 — 나가는 칸은 그대로 막는다(음성 대조)', async () => {
  const { placeholderPaths } = await import('../stamp/gen-pages.mjs')
  const R = await makeRun(TMP, detailBrief('ko'), detailContent('ko', { reviews: [] }), { patch: noRating })
  const key = 'product-detail/purchase-area/rating'
  const raw = R.content
  const idx = raw.slots.copy.findIndex((c) => c.id === 'rating')
  assert.ok(idx >= 0 && raw.slots.copy[idx].text === PLACEHOLDER.ko, '별점 칸은 자리 표시 글자다')
  assert.ok(placeholderPaths(raw, R.request).includes(key), '참조 정보 없이는 예전 그대로 센다')
  assert.equal(placeholderPaths(raw, R.request, new Set()).includes(key), false, '아무 데도 안 나가면 안 센다')
  assert.ok(placeholderPaths(raw, R.request, new Set([idx])).includes(key), '사이트가 그 칸을 잇는다면 센다(음성 대조)')
  const s = await gen(R)
  assert.equal(s.blockers.includes(`${BLOCKER.fact}${key}`), false, s.blockers.join('\n'))
})
