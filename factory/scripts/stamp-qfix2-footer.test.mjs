// FV1 Task 6.3 2차(QFIX2) 원인 6 — 「공개 불가 — 사업자 정보 표시 없음」 분류와 원인.
// 분류(근거): 골든 브리프 20개는 모두 가상 사업자 사실(상호·대표자·사업자번호·주소·전화·메일)을 갖고 있다. 그런데도 표시 없음이 뜬 후보(commerce-1 c · commerce-2 a · landing-1 b · landing-2 b · saas-1 b)는
//   전부 푸터 변형이 `block-footer-product-legal` 이다. 이 블록은 사업자 정보를 `copy.business` 가 아니라 최상위 `business` 로 받는데 binder(bindFooter)가 그 칸을 몰라
//   (a) 사실이 있는데 못 그렸고(품질 갈래 — 입력 대기가 아니다) (b) 예시 값(Example Owner·Example Hosting)이 남았으며 (c) 한국어 사이트에 영어 이름표가 나갔다.
// 판단: 사실이 있으면 잇는다. 사실이 없는 칸(호스팅 업체)은 뺀다. 사업자 정보를 못 그리는 푸터는 고르지 않는다. 브리프에 사실이 없으면 입력 대기(확인 필요 사실) 갈래가 그대로다.
// 실행: node --test --test-force-exit --test-timeout=300000 factory/scripts/stamp-qfix2-footer.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bindSection, businessInfoBlocker } from '../stamp/gen-pages.mjs'
import { resolveRefs } from '../stamp/site-bind.mjs'
import { loadTs } from '../stamp/ts-eval.mjs'
import { join } from 'node:path'
import { root } from './lib/stamp-site-fixtures.mjs'

// 실제 next build(portfolio-1 a)가 잡은 결함: 회사 정보 칸이 없는 원형(portfolio)의 푸터는 상호·메일만 있는데 공유 조각 business-info 가 주소·전화를 늘 읽어
// `normalizePhone(undefined)` 으로 prerender 가 멈췄다(정적 06 은 못 본다). 값이 있는 항목만 그린다는 조각의 약속대로 주소·전화도 값이 있을 때만 그린다.
test('[6] 공유 조각 business-info: 상호·메일만 있어도 던지지 않고, 값이 없는 주소·전화 줄은 그리지 않는다', async () => {
  const { businessRows } = await loadTs(join(root, 'registry', 'factory', 'blocks', '_shared', 'business-info.tsx'))
  const labels = { name: '상호', representative: '대표자', bizRegNo: '사업자등록번호', mailOrderNo: '통신판매업 신고번호', address: '주소', phone: '전화', email: '메일', ftcLookup: '', terms: '', privacy: '', policyNav: '' }
  const rows = businessRows({ name: '하은 사진', email: 'hello@example.com' }, labels)
  assert.deepEqual(rows.map((r) => r.key), ['name', 'email'])
  const full = businessRows({ name: '달빛', address: '서울', phone: '02-1234-5678' }, labels)
  assert.deepEqual(full.map((r) => r.key), ['name', 'address', 'phone'], '값이 있으면 예전 그대로 그린다')
})

const routes = { home: '/', terms: '/terms', privacy: '/privacy', refund: '/refund', contact: '/contact' }
const biz = { name: '달빛 로스터리', representative: '이서준', bizRegNo: '123-45-67890', mailOrderNo: '제2026-서울마포-0000호', address: '서울특별시 마포구 달빛로 12, 1층', phone: '02-1234-5678', email: 'hello@example.com' }
const content = (locale = 'ko', business = biz) => ({ archetype: 'commerce', locale, business, slots: { copy: [], images: [] } })
const footer = (c, { locale = 'ko', r = routes } = {}) =>
  bindSection({ key: 'global/footer', block: 'block-footer-product-legal', content: c, copyIndex: new Map(), routes: r, locale, navLinks: () => [{ label: '홈', href: '/' }], primaryCta: () => ({ href: '#' }), secondaryHref: () => '#' })

test('[6] product-legal 푸터: 사업자 사실이 있으면 최상위 business 칸을 콘텐츠 $ref 로 잇는다 — 예시 값이 남지 않는다', async () => {
  const r = await footer(content())
  assert.ok(r.props, r.why)
  assert.deepEqual(Object.keys(r.props.business).sort(), ['address', 'email', 'mailOrderNo', 'name', 'owner', 'phone', 'registrationNo'])
  assert.deepEqual(r.props.business.owner, { $ref: 'business.representative' })
  assert.deepEqual(r.props.business.registrationNo, { $ref: 'business.bizRegNo' })
  assert.equal('hostingProvider' in r.props.business, false, '호스팅 업체는 사실이 없어 뺀다')
  assert.equal(resolveRefs(r.props.business.owner, content()), '이서준')
  assert.deepEqual(r.issues, [], JSON.stringify(r.issues))
  // 이 푸터가 사업자 정보를 그리는 구획이다 — 표시 없음 사유가 없다
  const sections = { 'global/footer': { block: 'block-footer-product-legal', props: r.props } }
  assert.equal(businessInfoBlocker(content(), sections), null)
})

test('[6] 값이 없는 사업자 칸은 잇지 않는다(지어내지 않는다) · 두 칸 미만이면 푸터 변형을 고르지 않게 null', async () => {
  const some = await footer(content('ko', { name: '달빛 로스터리', representative: '이서준', address: '서울특별시 마포구 달빛로 12, 1층', phone: '02-1234-5678' }))
  assert.deepEqual(Object.keys(some.props.business).sort(), ['address', 'name', 'owner', 'phone'])
  const few = await footer(content('ko', { name: '달빛 로스터리' }))
  assert.equal(few.props, null)
  assert.match(few.why, /사업자 정보/)
})

test('[6] 한국어 사이트의 푸터 이름표는 한국어 · 영어 사이트는 영어 · 사이트에 없는 쪽으로 가는 링크는 뺀다', async () => {
  const ko = await footer(content('ko'))
  assert.equal(ko.props.copy.links.terms.label, '이용약관')
  assert.equal(ko.props.copy.businessTitle, '사업자 정보')
  assert.equal(ko.props.copy.businessLabels.owner, '대표자')
  assert.doesNotMatch(JSON.stringify(ko.props.copy), /Terms of Service|Business information|Legal and support/)
  const en = await footer(content('en'), { locale: 'en' })
  assert.equal(en.props.copy.links.terms.label, 'Terms of Service')
  assert.doesNotMatch(JSON.stringify(en.props.copy), /[가-힣]/)
  const noRefund = await footer(content('ko'), { r: { home: '/', terms: '/terms', privacy: '/privacy' } })
  assert.equal(noRefund.props.copy.links.refund, undefined)
  assert.equal(noRefund.props.copy.links.contact, undefined)
  assert.equal(noRefund.props.copy.links.terms.href, '/terms')
})
