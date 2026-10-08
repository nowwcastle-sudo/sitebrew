// 06-pages 법정 쪽 초안의 회사 정보 뿌리(P4GR 골든 실측) — 초안(drafts.mjs)은 content.business 만 읽는데 brand·public·dashboard·portfolio·pwa 는
// 다른 칸(organization·agency·facts)에 회사 정보가 있어 처리방침이 상호·주소·메일을 전부 「확인 필요」로 읽었다.
// 실행: node --test --test-force-exit --test-timeout=60000 factory/scripts/stamp-legal-business.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadArchetypes } from './archetypes.mjs'
import { legalBusinessOf } from '../stamp/gen-pages.mjs'
import { draftLegalPages, PLACEHOLDER } from '../legal/drafts.mjs'

const archetypes = await loadArchetypes()
const privacyText = (content, id) => draftLegalPages(content, archetypes[id], 'ko').privacy.markdown
const FACTS = { name: '달림장', legalName: '달림장 스튜디오', representative: '한지후', bizNo: '123-45-67890', email: 'hello@example.com', address: '서울특별시 송파구 예시로 55', phone: '02-1234-5678', claim: '달리기 기록' }

test('legalBusinessOf: business 가 있으면 그대로, organization 이면 그것, agency 는 이름·주소·대표전화(mainPhone→phone)만, 없으면 facts 원문에서 읽는다', () => {
  const b = { name: 'B' }
  assert.equal(legalBusinessOf({ business: b }, FACTS), b)
  const org = { name: 'O', address: 'A' }
  assert.equal(legalBusinessOf({ organization: org }, FACTS), org)
  assert.deepEqual(legalBusinessOf({ agency: { name: '도서관', address: '주소', mainPhone: '02-1234-5678', phoneNote: 'x' }, facts: FACTS }, { email: 'e@example.com' }), { name: '도서관', address: '주소', phone: '02-1234-5678', email: 'e@example.com' })
  assert.deepEqual(legalBusinessOf({}, FACTS), { name: '달림장', legalName: '달림장 스튜디오', representative: '한지후', bizRegNo: '123-45-67890', address: '서울특별시 송파구 예시로 55', phone: '02-1234-5678', email: 'hello@example.com' })
  assert.equal(legalBusinessOf({}, {}), undefined)
  assert.equal(legalBusinessOf({}, undefined), undefined)
})

test('P4GR 처리방침: facts 만 있는 원형(pwa)은 별칭이 있어야 상호·메일이 글에 들어간다 — 별칭 없이는 「확인 필요」(음성 대조)', () => {
  const content = { archetype: 'pwa', locale: 'ko', facts: FACTS }
  const without = privacyText(content, 'pwa')
  assert.ok(!without.includes('hello@example.com'), '별칭 없이도 메일이 들어갔다 — 이 시험이 낡았다')
  assert.ok(without.includes(PLACEHOLDER.ko))
  const withAlias = privacyText({ ...content, business: legalBusinessOf(content, FACTS) }, 'pwa')
  assert.ok(withAlias.includes('hello@example.com'), '별칭을 붙였는데 메일이 없다')
  assert.ok(withAlias.includes('달림장'))
})

test('P4GR 처리방침: public(agency)·brand(organization) 도 같은 방식으로 회사 정보가 글에 들어간다', () => {
  const agency = { archetype: 'public', locale: 'ko', agency: { name: '해오름구립도서관', address: '서울특별시 해오름구 예시로 100', mainPhone: '02-1234-5678' }, facts: { email: 'lib@example.com' } }
  const a = privacyText({ ...agency, business: legalBusinessOf(agency, agency.facts) }, 'public')
  assert.ok(a.includes('해오름구립도서관') && a.includes('lib@example.com') && a.includes('02-1234-5678'))
  const brand = { archetype: 'brand', locale: 'ko', organization: { name: '솔결재', address: '전주시 완산구 예시로 1', phone: '063-123-4567', email: 'hello@example.com' } }
  const bt = privacyText({ ...brand, business: legalBusinessOf(brand, {}) }, 'brand')
  assert.ok(bt.includes('솔결재') && bt.includes('hello@example.com'))
})
