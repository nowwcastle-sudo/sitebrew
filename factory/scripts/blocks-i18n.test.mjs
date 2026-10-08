// FV1 Task 5.14 (C5 「다른 언어·다른 사업의 화면 문구」 33줄) — 블록 층의 한국어 직접 쓰기 검사와 영어 사이트 화면 이름표.
//   1) 블록 원천(.tsx)에는 `_shared/block-labels.tsx`(ko·en 문구 표)밖의 한국어 글자 literal 이 없다 — 부품의 part-labels.test.mjs 를 블록 층까지 넓힌 것.
//   2) 한국어 출력은 글자 하나 바뀌지 않는다: 바꾸기 전(c3f1e351)·뒤의 순수 함수 출력과 서버 렌더 글자를 대조한다.
//   3) 영어 사이트: 블록 예시의 일반 화면 이름표를 번역표로 바꾸고, 이 사업의 문장(한글 잎)은 04 화면 문구 칸으로 보낸다 — 푸터·오프라인 안내에 한글이 남지 않는다.
// 실행: node --test --test-force-exit --test-timeout=300000 factory/scripts/blocks-i18n.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { createRequire } from 'node:module'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { makeBaseLoader } from './lib/base-compare-at.mjs'
import { bindSection, blockItems } from '../stamp/gen-pages.mjs'
import { resolveRefs } from '../stamp/site-bind.mjs'
import { uiLeavesOf } from '../stamp/ui-copy.mjs'
import { loadTs } from '../stamp/ts-eval.mjs'
import { root } from './lib/stamp-site-fixtures.mjs'

const require = createRequire(import.meta.url)
const ts = require('typescript')
const BLOCKS = join(root, 'registry', 'factory', 'blocks')
const LABELS = join(BLOCKS, '_shared', 'block-labels.tsx')
const HANGUL = /[가-힣]/
const BASE = 'c3f1e351' // FV1 흐름 ⑤ QUALITY-B 의 기준 커밋 — 한국어 출력 기준
const { baseOk, load } = makeBaseLoader(BASE)

function blockSources() {
  const files = []
  const walk = (d) => {
    for (const e of readdirSync(d)) {
      if (e === '_compiled') continue
      const p = join(d, e)
      if (statSync(p).isDirectory()) walk(p)
      else if (/\.tsx?$/.test(e) && !/\.fixture\./.test(e) && p !== LABELS) files.push(p)
    }
  }
  walk(BLOCKS)
  return files.map((file) => ({ file: relative(root, file).split('\\').join('/'), src: readFileSync(file, 'utf8') }))
}
/** 주석 밖 문자열·템플릿·JSX 글자에 든 한글 literal. 식별자·객체 키·주석은 세지 않는다. */
function koreanLiterals(src, file) {
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const hits = []
  const visit = (n) => {
    const text = ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n) ? n.text : ts.isJsxText(n) ? n.text : null
    if (text !== null && HANGUL.test(text)) hits.push(text.replace(/\s+/g, ' ').trim().slice(0, 60))
    ts.forEachChild(n, visit)
  }
  visit(sf)
  return hits
}

// ── 1) 블록 층의 한국어 직접 쓰기 ──────────────────────────────────────────────────────
test('블록 원천에 문구 표(block-labels) 밖의 한국어 글자 literal 이 없다', () => {
  const offenders = blockSources().map(({ file, src }) => ({ file, hits: koreanLiterals(src, file) })).filter((o) => o.hits.length)
  assert.deepEqual(offenders.map((o) => `${o.file}: ${o.hits.slice(0, 2).join(' | ')}`), [])
})

test('양성 대조: 검사식은 한글 literal 을 실제로 잡는다(문구 표 파일에는 있다)', () => {
  assert.ok(koreanLiterals(readFileSync(LABELS, 'utf8'), LABELS).length >= 20, '문구 표 파일이 한글 literal 을 들고 있다')
  assert.deepEqual(koreanLiterals('const a = "닫기"; // 주석 한글\nconst b = <p>안내</p>', 'x.tsx'), ['닫기', '안내'])
  assert.deepEqual(koreanLiterals('const 월 = 1; const o = { 키: "k" }', 'x.ts'), [], '식별자·키는 세지 않는다')
})

test('문구 표: ko·en 이 같은 키를 갖고, en 에는 한글이 없다', async () => {
  const { BLOCK_LABELS, blockLabels } = await load('registry/factory/blocks/_shared/block-labels.tsx')
  assert.deepEqual(Object.keys(BLOCK_LABELS.ko).sort(), Object.keys(BLOCK_LABELS.en).sort())
  for (const [k, v] of Object.entries(BLOCK_LABELS.en)) {
    const text = typeof v === 'function' ? v(3, 5, 'x') : v
    assert.equal(HANGUL.test(String(text)), false, `en.${k}: ${text}`)
  }
  assert.equal(blockLabels().won, '원', '로캘이 없으면 ko')
  assert.equal(blockLabels('en').won, ' KRW')
})

// ── 2) 한국어 출력은 그대로 ────────────────────────────────────────────────────────────
test('한국어 출력 불변: 제작자용 점검 메시지(순수 함수)가 기준 커밋과 글자 단위로 같다', { skip: !baseOk && `기준 커밋 ${BASE} 없음` }, async () => {
  const both = async (rel) => [await load(rel, 'old'), await load(rel, 'new')]
  const [gOld, gNew] = await both('registry/factory/blocks/trust/guarantee-strip.tsx')
  for (const g of [{ conditions: ['a', 'b', 'c'], days: 3, text: '기간 없음' }, { conditions: ['a'], days: 14, text: '{days}일 보증' }]) assert.deepEqual(gNew.guaranteeIssues(g), gOld.guaranteeIssues(g))
  assert.equal(gNew.guaranteeIssues({ conditions: ['a', 'b', 'c'], days: 3, text: 'x' }).length, 3)
  const [nOld, nNew] = await both('registry/factory/blocks/_shared/notice-kit.tsx')
  const notice = { category: '', rows: [{ label: '제조국', value: '' }, { label: '제조국', value: '한국' }, { label: '문의', phone: 'abc' }] }
  assert.deepEqual(nNew.noticeIssues(notice), nOld.noticeIssues(notice))
  assert.equal(nNew.noticeIssues(notice).length >= 4, true)
  assert.deepEqual(nNew.noticeIssues({ category: '', rows: [] }), nOld.noticeIssues({ category: '', rows: [] }))
  const [pOld, pNew] = await both('registry/factory/blocks/_shared/policy-kit.tsx')
  const facts = { shipping: { freeThreshold: 50000, fee: 0 }, returns: { withdrawalDays: 3, refundDays: 9 } }
  assert.deepEqual(pNew.policyIssues(facts), pOld.policyIssues(facts))
  assert.deepEqual(pNew.policyIssues({ shipping: {}, returns: {} }), pOld.policyIssues({ shipping: {}, returns: {} }))
  assert.ok(pNew.policyIssues(facts).length >= 4)
  const [sOld, sNew] = await both('registry/factory/blocks/_shared/share-link.tsx')
  const share = { title: '', description: ' ', imageUrl: 'http://x', link: '/a', imageWidth: 400, imageHeight: 100 }
  assert.deepEqual(sNew.kakaoTemplateIssues(share), sOld.kakaoTemplateIssues(share))
  assert.equal(sNew.kakaoTemplateIssues(share).length, 7 - 1)
})

test('한국어 출력 불변: 원화 금액·24시·단위 가격이 기준 커밋과 같은 글자다 (서버 렌더)', { skip: !baseOk && `기준 커밋 ${BASE} 없음` }, async () => {
  const [tOld, tNew] = [await load('registry/factory/blocks/_shared/price-tag.tsx', 'old'), await load('registry/factory/blocks/_shared/price-tag.tsx', 'new')]
  for (const a of [0, 1200, 12900, 1239000]) assert.equal(tNew.formatPrice(a), tOld.formatPrice(a))
  assert.equal(tNew.formatPrice(12900), '12,900원')
  // 영업시간 표(24:00 → 24시)·단위 가격 줄(「100g당 5,000원」)
  const render = async (mode, rel, name, fx) => {
    const m = await load(`registry/factory/blocks/${rel}.tsx`, mode)
    const f = await load(`registry/factory/blocks/${rel}.fixture.ts`, mode)
    return renderToStaticMarkup(h(m[name], f[fx]))
  }
  const stripWf3 = (html) => (typeof html === 'string' ? html.replace(/ focus-visible:ring-offset-2 focus-visible:ring-offset-background/g, '').replace(/(<a\b[^>]*?) role="button"( tabindex="0")?/g, '$1').replace(/(<a\b[^>]*?) tabindex="0"(?= data-slot="button")/g, '$1').replace(/(<a\b[^>]*?) data-slot="button"/g, '$1').replace(/<span role="img"[^>]*data-photo-needed[^>]*><svg[^>]*>.*?<\/svg><span aria-hidden="true">[^<]*<\/span><\/span>/g, "").replace(/<svg[^>]*lucide-image[^>]*>.*?<\/svg>/g, "") : html)
  const renderN = async (...args) => stripWf3(await render(...args))
  for (const fx of ['fixture', 'fixtureMax', 'fixtureMin']) {
    assert.equal(await renderN('new', 'hours-location/hours-table-map-link', 'HoursLocationHoursTableMapLink', fx), await renderN('old', 'hours-location/hours-table-map-link', 'HoursLocationHoursTableMapLink', fx), `hours ${fx}`)
    assert.equal(await renderN('new', 'product-list/spec-summary', 'ProductListSpecSummary', fx), await renderN('old', 'product-list/spec-summary', 'ProductListSpecSummary', fx), `spec-summary ${fx}`)
    assert.equal(await renderN('new', 'trust/guarantee-strip', 'TrustGuaranteeStrip', fx), await renderN('old', 'trust/guarantee-strip', 'TrustGuaranteeStrip', fx), `guarantee ${fx}`)
  }
})

test('한국어 출력 불변: 폼 알림은 오류가 없으면 기준 커밋과 같은 마크업이다(요약은 칸 오류가 있을 때만 생긴다)', { skip: !baseOk && `기준 커밋 ${BASE} 없음` }, async () => {
  const flow = { formId: 'c-form', alertId: 'c-alert', formError: null, notices: undefined, cooldown: 0, retry() {}, fieldErrors: {} }
  const copy = { fieldErrorTitle: '입력한 내용을 확인해 주세요', errorTitle: '보내지 못했어요' }
  const a = renderToStaticMarkup(h((await load('registry/factory/blocks/_shared/form-flow.tsx', 'old')).FormAlert, { flow, copy }))
  const b = renderToStaticMarkup(h((await load('registry/factory/blocks/_shared/form-flow.tsx', 'new')).FormAlert, { flow, copy }))
  assert.equal(b, a)
  const form = { id: 'f', formId: 'f-form', alertId: 'f-alert', formError: null, notices: undefined, cooldown: 0, retry() {}, errorSummary: [] }
  const c = renderToStaticMarkup(h((await load('registry/factory/blocks/_shared/port-form.tsx', 'old')).FormAlert, { form, fieldTitle: 'x', serverTitle: 'y' }))
  const d = renderToStaticMarkup(h((await load('registry/factory/blocks/_shared/port-form.tsx', 'new')).FormAlert, { form, fieldTitle: 'x', serverTitle: 'y' }))
  assert.equal(d, c)
})

// ── 3) 영어 사이트 ────────────────────────────────────────────────────────────────────
const routes = { home: '/', pricing: '/pricing' }
const bindEn = (block, content, uiLeaves = []) =>
  bindSection({ key: 'global/footer', block, content, copyIndex: new Map(), routes, locale: 'en', navLinks: () => [{ label: 'Home', href: '/' }], primaryCta: () => ({ href: '/' }), secondaryHref: () => '/', uiLeaves })

test('번역표: 일반 화면 이름표만 싣고(사업 문장 없음), 영어 쪽에는 한글이 없으며, 자리 표시가 그대로다', async () => {
  const { EN_UI, localizeEnglishLabels } = await import('../stamp/ui-labels-en.mjs')
  for (const [ko, en] of Object.entries(EN_UI)) {
    assert.ok(HANGUL.test(ko), ko)
    assert.equal(HANGUL.test(en), false, `${ko} → ${en}`)
    assert.deepEqual(en.match(/\{\w+\}/g)?.sort() ?? [], ko.match(/\{\w+\}/g)?.sort() ?? [], `자리 표시: ${ko}`)
  }
  // 일반 이름표 「예약하기」·「전화와 예약」(예약 사업의 하단 단추)만 허용 — 예시 사업의 문장(「예약 받기 설정」·「이번 주 근무표」)은 표에 없다
  assert.deepEqual(Object.keys(EN_UI).filter((k) => /예약|손님|장부|근무표/.test(k) && !['예약하기', '전화와 예약'].includes(k)), [])
  // 「일」은 날 단위로도 쓰여 완전 일치로 바꾸지 않는다 — 요일은 days 칸 아래에서만
  const p = { copy: { days: { mo: '월', su: '일' }, unit: '일', label: '첫 화면' }, x: { $ref: 'a.b' } }
  assert.equal(localizeEnglishLabels(p), 3)
  assert.deepEqual(p.copy, { days: { mo: 'Mon', su: 'Sun' }, unit: '일', label: 'First screen' })
  assert.deepEqual(p.x, { $ref: 'a.b' })
})

test('영어 사이트 푸터: 영어 콘텐츠로 묶으면 서버 렌더에 한글이 없다(columns-business · compact-strip · stacked-legal)', async () => {
  const content = { archetype: 'brand', locale: 'en', organization: { name: 'Kiln & Kettle Studio', representative: 'Alex Kim', bizRegNo: '123-45-67890', address: '12 Studio Road, Seoul', phone: '+82-2-555-0100', email: 'hello@kiln.example.org' }, slots: { copy: [], images: [] } }
  for (const [block, kind, name] of [['block-footer-columns-business', 'footer', 'FooterColumnsBusiness'], ['block-footer-compact-strip', 'footer', 'FooterCompactStrip'], ['block-footer-stacked-legal', 'footer', 'FooterStackedLegal']]) {
    const r = await bindEn(block, content)
    assert.ok(r.props, block)
    const props = resolveRefs(r.props, content)
    const item = blockItems().get(block)
    const mod = await loadTs(join(BLOCKS, kind, `${item.variant}.tsx`))
    const html = renderToStaticMarkup(h(mod[name], props))
    assert.equal(HANGUL.test(html.replace(/<[^>]*>/g, ' ')), false, `${block}: ${html.match(/[^<>]*[가-힣]+[^<>]*/)?.[0]}`)
    assert.match(html, /Business|Site links|Terms|Privacy/i, block)
  }
})

test('영어 사이트 오프라인 안내: 일반 이름표는 표로, 이 사업의 문장(한글 잎)은 04 화면 문구 칸으로 — 둘이면 한글이 남지 않는다', async () => {
  const block = 'block-state-screen-offline-cached'
  const leaves = await uiLeavesOf(block, { locale: 'en' })
  assert.ok(leaves.length >= 2 && leaves.every((l) => l.why === 'locale' || ['marker', 'digits', 'name'].includes(l.why)), JSON.stringify(leaves))
  assert.ok(leaves.some((l) => /items\[/.test(l.path) || /근무표|안내 문자/.test(l.example)), '예시 사업의 문장은 문구 칸으로 간다')
  const content = { archetype: 'pwa', locale: 'en', slots: { copy: [{ id: 'x', role: '', text: 'Your saved schedule' }], images: [] } }
  const r = await bindSection({ key: 'offline/offline-fallback', block, content, copyIndex: new Map(), routes, locale: 'en', navLinks: () => [], primaryCta: () => ({ href: '/' }), secondaryHref: () => '/', uiLeaves: leaves.map((l) => ({ path: l.path, ref: 'slots.copy.0.text' })) })
  assert.ok(r.props)
  const props = resolveRefs(r.props, content)
  assert.equal(HANGUL.test(JSON.stringify(props)), false, JSON.stringify(props).match(/[^"]*[가-힣]+[^"]*/)?.[0])
  // 문구 칸 없이 표만이면 이 사업의 문장이 한글로 남아 사유가 된다(음성 대조)
  const bare = await bindSection({ key: 'offline/offline-fallback', block, content, copyIndex: new Map(), routes, locale: 'en', navLinks: () => [], primaryCta: () => ({ href: '/' }), secondaryHref: () => '/' })
  assert.ok(HANGUL.test(JSON.stringify(bare.props)))
})

test('C333 한국어 사이트: 제품 화면의 다른 사업(예약·일정) 문장은 예시 표지가 없어도 문구 칸으로 간다 · 일반 문장은 그대로', async () => {
  const empty = await uiLeavesOf('block-onboarding-empty-first-action', { locale: 'ko' })
  assert.ok(empty.some((l) => l.why === 'biz' && /예약/.test(l.example)), JSON.stringify(empty))
  const lang = await uiLeavesOf('block-state-screen-loading', { locale: 'ko' })
  assert.equal(lang.every((l) => l.why !== 'biz'), true)
  // 기본 요청(표지·이름·숫자 잎)은 예전 그대로 — 영어 확장이 한도를 넘기면 기본 요청만
  const big = await uiLeavesOf('block-auth-sign-up-consents', { locale: 'en' })
  const baseKo = await uiLeavesOf('block-auth-sign-up-consents', { locale: 'ko' })
  assert.ok(big.length <= 12 && baseKo.length <= 12)
  assert.equal(big.some((l) => l.why === 'locale'), false, '한글 잎이 한도(12)를 넘는 블록은 영어 확장을 접는다')
})
