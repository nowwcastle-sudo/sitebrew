// 사업자 정보·약관 링크(대장 C356, 전자상거래법 제10조) — 골든 실측:
//   · detail-1·2: 원형 JSON 에 푸터가 없어 사업자 정보(상호·대표자·주소·전화·사업자등록번호)가 사이트 어디에도 안 그려졌는데 08-board blockers 에 안 떴다.
//   · commerce-1·2: 푸터 약관·처리방침 링크의 href 가 「확인 필요」 글자 그대로였다(사이트가 /terms·/privacy 를 직접 만드는데도).
// 실행: node --test --test-force-exit --test-timeout=300000 factory/scripts/stamp-business-info.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { BLOCKER, businessInfoBlocker, ownPolicyLinks } from '../stamp/gen-pages.mjs'
import { detailBrief, detailContent, localBrief, localContent, makeRun, gen, root } from './lib/stamp-site-fixtures.mjs'

const TMP = join(root, '.tmp', 'stamp-business-info-test')
const NEEDS = '확인 필요'
const biz = { name: '하루볶음', representative: '이서준', bizRegNo: '123-45-67890', address: '서울특별시 성동구 예시로 12', phone: '02-1234-5678', email: 'hello@x.kr' }
const ref = (k) => ({ $ref: `business.${k}` })
const footerOf = (...keys) => ({ 'global/footer': { block: 'block-footer-stacked-legal', props: { copy: { business: Object.fromEntries(keys.map((k) => [k, ref(k)])) } } } })

test('BLOCKER.bizInfo 접두가 정해져 있다', () => {
  assert.equal(BLOCKER.bizInfo, '공개 불가 — 사업자 정보 표시 없음: ')
})

test('사업체 정보(business)가 있는데 사업자 항목을 둘 이상 그리는 구획이 없으면 사유 — 푸터가 있으면 없다', () => {
  assert.match(businessInfoBlocker({ archetype: 'detail', business: biz }, {}), /^공개 불가 — 사업자 정보 표시 없음: 전자상거래법 제10조/)
  assert.match(businessInfoBlocker({ archetype: 'detail', business: biz }, { 'x/hero': { props: { copy: { brand: ref('name') } } } }), /그려진 사업자 항목 0개/, '상호만 그리는 것은 사업자 정보가 아니다')
  assert.match(businessInfoBlocker({ archetype: 'detail', business: biz }, footerOf('representative')), /그려진 사업자 항목 1개/)
  assert.equal(businessInfoBlocker({ archetype: 'commerce', business: biz }, footerOf('representative', 'bizRegNo', 'address', 'phone')), null)
})

test('음성 대조: 사업체 정보(business)가 없는 원형(brand·public·portfolio·pwa·dashboard)은 이 사유가 없다', () => {
  assert.equal(businessInfoBlocker({ archetype: 'portfolio', contact: { email: 'a@b.kr' } }, {}), null)
  assert.equal(businessInfoBlocker({ archetype: 'brand', organization: { name: 'x' } }, {}), null)
})

const sitemap = (ids) => ({ pages: [{ id: 'home', route: '/', legal: false }, ...ids.map((id) => ({ id, route: `/${id}`, legal: true }))] })

test('약관·처리방침 링크: 자리 표시(「확인 필요」)면 이 사이트의 법정 쪽으로 잇고 그 경로의 사실 사유는 내지 않는다', () => {
  const r = ownPolicyLinks({ ...biz, ftcLookupUrl: NEEDS, termsUrl: NEEDS, privacyUrl: NEEDS }, sitemap(['privacy', 'terms', 'refund']))
  assert.equal(r.business.termsUrl, '/terms')
  assert.equal(r.business.privacyUrl, '/privacy')
  assert.equal(r.business.ftcLookupUrl, NEEDS, '공정위 사업자정보 조회 주소는 바깥 사실이라 이어 주지 않는다 — 계속 확인 필요 사실')
  assert.deepEqual(r.bound, ['business.termsUrl', 'business.privacyUrl'])
})

test('약관 링크 음성 대조: 값이 이미 있으면 덮지 않고 · 법정 쪽이 사이트맵에 없으면 잇지 않고 · 칸이 없으면 만들지 않는다', () => {
  const given = ownPolicyLinks({ ...biz, termsUrl: 'https://shop.kr/terms', privacyUrl: NEEDS }, sitemap(['privacy', 'terms']))
  assert.equal(given.business.termsUrl, 'https://shop.kr/terms')
  assert.deepEqual(given.bound, ['business.privacyUrl'])
  const noPage = ownPolicyLinks({ ...biz, termsUrl: NEEDS }, sitemap(['privacy']))
  assert.equal(noPage.business.termsUrl, NEEDS)
  assert.deepEqual(noPage.bound, [])
  const noKey = ownPolicyLinks(biz, sitemap(['privacy', 'terms']))
  assert.equal('termsUrl' in noKey.business, false)
  assert.deepEqual(ownPolicyLinks(undefined, sitemap(['terms'])), { business: undefined, bound: [] })
  // 원본 객체를 바꾸지 않는다
  const src = { ...biz, termsUrl: NEEDS }
  ownPolicyLinks(src, sitemap(['terms']))
  assert.equal(src.termsUrl, NEEDS)
})

test('실제 06(정적): detail 은 원형의 필수 푸터가 그려져 사업자 정보 사유가 없고, 푸터를 못 그리는 사이트(03 에서 푸터 빠짐)는 사유가 나며, local(푸터 있음)도 없다', async () => {
  const d = await makeRun(TMP, detailBrief('ko'), detailContent('ko'))
  const sd = await gen(d)
  assert.ok(sd.sections.includes('global/footer'), 'detail 에 푸터가 안 그려진다')
  assert.equal(sd.blockers.filter((b) => b.startsWith(BLOCKER.bizInfo)).length, 0, sd.blockers.join(' | '))
  // 푸터가 03 에서 빠진(원형 JSON 에서 푸터를 뺀 것과 같은) 사이트 — 사업자 정보를 그리는 곳이 없다
  const bare = await makeRun(TMP, detailBrief('ko'), detailContent('ko'), { patchVariants: (v) => { const { ['global/footer']: _drop, ...rest } = v; void _drop; return rest } })
  const sb = await gen(bare)
  const lines = sb.blockers.filter((b) => b.startsWith(BLOCKER.bizInfo))
  assert.equal(lines.length, 1, sb.blockers.join(' | '))
  assert.match(lines[0], /원형 detail/)
  const l = await makeRun(TMP, localBrief(), localContent)
  const sl = await gen(l)
  assert.equal(sl.blockers.filter((b) => b.startsWith(BLOCKER.bizInfo)).length, 0, sl.blockers.join(' | '))
})
