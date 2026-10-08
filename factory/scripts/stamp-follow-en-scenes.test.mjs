// FV1 FOLLOW — 영어 장면 fixtureEn: 큰 제품 화면(가입·로그인·계정·결제·해지·온보딩) 블록의 예시 모듈이 영어 장면을 내보내고,
// 영어 사이트의 06 만 그것을 쓴다. 한국어 출력은 글자 하나 바뀌지 않는다(기준 커밋 29b96a9c 의 한국어 예시 해시와 대조).
// 실행: node --test --test-force-exit --test-timeout=300000 factory/scripts/stamp-follow-en-scenes.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { bindSection, blockItems, fixtureOf } from '../stamp/gen-pages.mjs'
import { foreignTextIssue, leaves } from '../stamp/site-bind.mjs'
import { uiLeavesOf } from '../stamp/ui-copy.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const HANGUL = /[가-힣]/
const sha = (v) => createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 16)

// 영어 장면이 있는 블록 14개(saas 골든 6안의 영어·한국어 제품 화면이 쓰는 큰 제품 화면)
const EN_SCENE_BLOCKS = [
  'block-auth-sign-up-consents', 'block-auth-sign-in', 'block-confirmation-signup-complete',
  'block-onboarding-checklist-panel', 'block-onboarding-setup-wizard',
  'block-account-profile-settings', 'block-account-notification-consents', 'block-account-billing-manage',
  'block-paywall-upgrade-modal', 'block-paywall-limit-meter', 'block-paywall-trial-ending',
  'block-retention-renewal-consent', 'block-retention-cancel-flow', 'block-retention-payment-failed-banner',
]

test('한국어 예시는 기준 커밋과 같다 — 모든 블록의 fixtureOf(ko) JSON 해시가 고정 기록과 일치한다(영어 장면을 더해도 한국어 출력은 그대로)', async () => {
  const want = Object.fromEntries(readFileSync(join(here, 'fixtures', 'stamp-follow', 'ko-fixture-hashes.txt'), 'utf8').trim().split(/\r?\n/).map((l) => { const [h, n] = l.split('  '); return [n, h] }))
  const got = {}
  for (const [name, b] of blockItems()) got[name] = sha(await fixtureOf(b))
  assert.deepEqual(got, want)
})

test('영어 장면: 14개 블록 모두 fixtureEn 이 있고 한글이 한 글자도 없으며, 한국어 예시와 잎 경로가 같다', async () => {
  for (const name of EN_SCENE_BLOCKS) {
    const b = blockItems().get(name)
    const ko = await fixtureOf(b)
    const en = await fixtureOf(b, { locale: 'en' })
    assert.notDeepEqual(en, ko, `${name}: fixtureEn 이 없다`)
    const enLeaves = leaves(en)
    assert.deepEqual(enLeaves.filter((l) => typeof l.value === 'string' && HANGUL.test(l.value)).map((l) => l.path), [], `${name}: 영어 장면에 한글이 남음`)
    assert.deepEqual(enLeaves.map((l) => l.path), leaves(ko).map((l) => l.path), `${name}: 잎 경로가 한국어 예시와 다르다`)
  }
})

// T22: 영어 장면은 「사업 중립」이어야 한다 — 한글 0 만으로는 예약·카페 같은 업종 낱말이 영어로 새는 것을 못 잡는다.
// 음성 대조: 같은 훑기가 업종 낱말이 든 글은 잡는다(정규식이 아무것도 안 걸러 통과하는 일을 막는다).
const BUSINESS_WORDS = /(?<![a-z])(?:book(?:ing|ings|ed|s)?|reserv[a-z]*|appointments?|bakery|bakeries|caf[eé]s?|clinics?|restaurants?|salons?|barber[a-z]*|hair[a-z]*|patients?|dentist[a-z]*|hospital[a-z]*)(?![a-zé])/i
test('영어 장면: 14개 블록 모두 업종 낱말(예약·booking·bakery·cafe·clinic …)이 없다 — 사업 중립 문장이다', async () => {
  for (const sample of ['Book a table', 'Your booking is confirmed', 'Moonlight Bakery', 'Visit our café', 'Clinic hours', 'Reservation ready', 'Next appointment']) assert.match(sample, BUSINESS_WORDS, `음성 대조: ${sample}`)
  for (const sample of ['Open the ⋯ menu at the top right', 'Sign in', 'Your trial ends soon']) assert.doesNotMatch(sample, BUSINESS_WORDS, `양성 대조: ${sample}`)
  for (const name of EN_SCENE_BLOCKS) {
    const en = await fixtureOf(blockItems().get(name), { locale: 'en' })
    const hits = leaves(en).filter((l) => typeof l.value === 'string' && BUSINESS_WORDS.test(l.value)).map((l) => `${l.path}: ${l.value}`)
    assert.deepEqual(hits, [], `${name}: 영어 장면에 업종 낱말이 있다`)
  }
})

test('영어 장면이 없는 블록은 영어 사이트에서도 한국어 예시 그대로다(예전 길 — 번역표·문구 칸)', async () => {
  const b = blockItems().get('block-hero-banded-full-bleed')
  assert.deepEqual(await fixtureOf(b, { locale: 'en' }), await fixtureOf(b))
})

test('06 bindSection: 영어 사이트는 영어 장면을 쓰고(한글 0), 한국어 사이트는 한국어 예시 그대로다', async () => {
  const content = { archetype: 'saas', locale: 'en', business: { name: 'Example Co.' }, site: { name: 'Example Co.' } }
  const args = { key: 'login/auth', block: 'block-auth-sign-in', content, copyIndex: new Map(), routes: { home: '/' }, navLinks: () => [], primaryCta: () => null, secondaryHref: () => '/' }
  const en = await bindSection({ ...args, locale: 'en' })
  assert.ok(en.props, en.why)
  assert.equal(foreignTextIssue(leaves(en.props), { locale: 'en', kind: 'auth' }), null, '영어 사이트에 한글 글이 남지 않는다')
  assert.match(JSON.stringify(en.props), /Sign in/)
  const ko = await bindSection({ ...args, content: { ...content, locale: 'ko' }, locale: 'ko' })
  assert.deepEqual(leaves(ko.props).filter((l) => l.ref === null && typeof l.value === 'string' && HANGUL.test(l.value)).length > 20, true, '한국어 사이트는 한국어 예시 글이 그대로다')
})

test('06 bindSection(영어): 14개 블록 모두 04 가 요청하는 화면 문구 칸만 채우면 한글 글이 한 곳도 남지 않는다 — 문구 칸을 안 쓰는 잎은 영어 장면에서 온다', async () => {
  const content = { archetype: 'saas', locale: 'en', business: { name: 'Example Co.' }, site: { name: 'Example Co.' }, slots: { copy: [{ id: 'x', role: '', text: 'Sample text' }] } }
  for (const name of EN_SCENE_BLOCKS) {
    const uiLeaves = (await uiLeavesOf(name, { locale: 'en' })).map((l) => ({ path: l.path, ref: 'slots.copy.0.text' }))
    const r = await bindSection({ key: 'x/y', block: name, content, copyIndex: new Map(), routes: { home: '/' }, locale: 'en', navLinks: () => [], primaryCta: () => null, secondaryHref: () => '/', uiLeaves })
    assert.ok(r.props, `${name}: ${r.why}`)
    assert.equal(foreignTextIssue(leaves(r.props), { locale: 'en', kind: blockItems().get(name).kind }), null, name)
  }
})

test('화면 문구 칸 확장(영어): 영어 장면이 있는 블록은 한글이 없으니 「locale」 잎을 더 요청하지 않는다', async () => {
  for (const name of EN_SCENE_BLOCKS) {
    const extra = (await uiLeavesOf(name, { locale: 'en' })).filter((l) => l.why === 'locale')
    assert.deepEqual(extra, [], name)
  }
})
