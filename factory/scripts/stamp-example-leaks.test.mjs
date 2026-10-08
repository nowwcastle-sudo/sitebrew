// P3-4 일관성 레인(P4CON) 수정 3 — 예시 문구가 사이트로 새던 길(골든 saas: 「모아플랜 계정 만들기」·「다른 사이트에서 우리 빵집 광고…」).
// 원인: exampleIssues 가 예시 이름을 수출한 값의 brand·company… 칸에서만 모아 가입·로그인 제목의 이름과 쿠키 설명의 업종어를 못 잡았고,
// 사업 수치는 문자열만 봐서 숫자 칸(배송비 3,000원 등)은 아예 안 봤다.
// 실행: node --test --test-force-exit --test-timeout=200000 factory/scripts/stamp-example-leaks.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { collectExampleNamesFromSource, exampleIssues, FACT_NUMBER_KEYS, leaves } from '../stamp/site-bind.mjs'
import { exampleNames } from '../stamp/gen-pages.mjs'
import { readinessOf, uiLeavesOf } from '../stamp/ui-copy.mjs'
import { root, SAAS_BRIEF, saasContent, localBrief, LOCAL_FACTS, localContent, makeRun as makeRunIn, gen } from './lib/stamp-site-fixtures.mjs'

const TMP = join(root, '.tmp', 'stamp-example-leaks-test')
const siteOf = (s) => JSON.parse(readFileSync(join(s.siteDir, 'content', 'site.json'), 'utf8'))

test('collectExampleNamesFromSource: 예시 모듈 머리 주석의 가상 이름(「이름(예시)」·「가상 … 「이름」」)과 업종어(빵집·공방…)를 모은다', () => {
  const names = collectExampleNamesFromSource([
    '// 예시 콘텐츠. 가상 일정 관리 서비스 「모아플랜(예시)」 가입. 문구는 해요체.',
    '// 예시 콘텐츠. 가상 동네 빵집 「밀가루공방(예시)」의 쿠키 설정.',
    '// 패널 = 이 도구로 만든 예시 설명서(가상 정수기 「물빛 X2」). 목차는 그 설명서의 목차다.',
    '// 예시 콘텐츠. 가상 서비스, 문구마다 「예시」.',
    '// 예시 콘텐츠. 가상 인물·회사, 문구마다 「예시」.',
  ])
  for (const n of ['모아플랜', '밀가루공방', '빵집', '물빛 X2', '정수기']) assert.ok(names.has(n), `${n} — ${[...names].join(' | ')}`)
  for (const n of ['예시', '서비스', '회사', '인물', '']) assert.equal(names.has(n), false, `${JSON.stringify(n)} 는 이름이 아니다`)
})

test('exampleIssues: 가상 이름이 든 제목(「모아플랜 계정 만들기」)·업종어가 든 문구(「우리 빵집 광고」)를 잡고, 중립 문구는 놓아 둔다', async () => {
  const names = await exampleNames()
  assert.ok(names.has('모아플랜') && names.has('빵집'))
  const hit = exampleIssues(leaves({ copy: { title: '모아플랜 계정 만들기', categories: { marketing: { body: '다른 사이트에서 우리 빵집 광고를 보여 주는 데 써요.' } } } }), names)
  assert.deepEqual(hit.map((i) => [i.path, i.why]), [['copy.title', 'name'], ['copy.categories.marketing.body', 'name']])
  assert.deepEqual(exampleIssues(leaves({ copy: { title: '계정 만들기', body: '다른 사이트에서 광고를 보여 주는 데 써요.', submit: '가입하기' } }), names), [], '중립 문구는 그대로')
})

test('exampleIssues: 사업 사실 숫자 칸(가격·배송비·기간·인원)의 literal 은 예시 수치로 잡고, 화면 동작 숫자·$ref 는 놓아 둔다', () => {
  const found = exampleIssues(
    leaves({ facts: { shipping: { fee: 3000, leadDays: 1, freeThreshold: 50000 } }, copy: { price: 32900, defaultOpen: 0, pageSize: 10, resendAfter: 60, depth: 1, count: 5 }, order: { total: { amount: { $ref: 'x.y' } } } }),
    new Set(),
  )
  assert.deepEqual(found.map((i) => [i.path, i.why]).sort(), [['copy.price', 'number'], ['facts.shipping.fee', 'number'], ['facts.shipping.freeThreshold', 'number'], ['facts.shipping.leadDays', 'number']])
  for (const k of ['defaultOpen', 'pageSize', 'resendAfter', 'depth', 'count']) assert.equal(FACT_NUMBER_KEYS.test(k), false, k)
})

test('화면 블록 예시의 이름·업종어가 문구 칸으로 요청된다 — 가입 제목·로그인 제목·쿠키 마케팅 설명·시작 마법사 질문', async () => {
  const leavesOf = async (block) => (await uiLeavesOf(block)).map((l) => l.path)
  assert.ok((await leavesOf('block-auth-sign-up-consents')).includes('copy.title'), '가입 제목')
  assert.ok((await leavesOf('block-auth-sign-in')).includes('copy.title'), '로그인 제목')
  assert.ok((await leavesOf('block-consent-preference-dialog')).includes('copy.categories.marketing.body'), '쿠키 마케팅 설명')
  assert.ok((await leavesOf('block-onboarding-setup-wizard')).includes('copy.question.legend'), '시작 마법사 질문')
  // 숫자 칸 예시 수치는 문구로 못 채운다 — 문구 칸을 요청하지 않고 못 채움(2)
  assert.deepEqual(await uiLeavesOf('block-confirmation-order-complete'), [])
  assert.equal(await readinessOf('block-confirmation-order-complete'), 2)
})

test('생성한 saas 사이트: 가입·로그인·쿠키 화면에 가상 이름·업종어가 든 literal 이 없고 그 칸은 콘텐츠 문구로 이어진다', async () => {
  const names = await exampleNames()
  const r = await makeRunIn(TMP, SAAS_BRIEF, saasContent, { patchVariants: (v) => ({ ...v, 'signup/consent': 'block-consent-preference-dialog' }) })
  const s = await gen(r)
  const site = siteOf(s)
  const bad = []
  for (const [key, sec] of Object.entries(site.sections)) for (const l of leaves(sec.props)) if (typeof l.value === 'string' && [...names].some((n) => l.value.includes(n))) bad.push(`${key} ${l.path}=${l.value.slice(0, 30)}`)
  assert.deepEqual(bad, [], '가상 이름·업종어가 든 literal 이 남았다')
  assert.ok(site.sections['signup/auth'].props.copy.title.$ref, '가입 제목은 콘텐츠 문구 칸')
  assert.ok(site.sections['login/auth'].props.copy.title.$ref, '로그인 제목')
  assert.ok(site.sections['signup/consent'].props.copy.categories.marketing.body.$ref, '쿠키 마케팅 설명')
  assert.equal(s.blockers.some((b) => b.startsWith('공개 불가 — 예시 문구 남음') && /signup\/|login\//.test(b)), false, s.blockers.join('\n'))
})

test('P4GR2: 콘텐츠 값의 가상 도로명 「예시로 12」는 예시 표지가 아니다 — 「예시」 낱말·「(예시)」는 여전히 표지(음성 대조)', async () => {
  const { hasExampleMarker } = await import('../stamp/site-bind.mjs')
  assert.equal(hasExampleMarker('서울특별시 성동구 예시로 12, 1층'), false)
  assert.equal(hasExampleMarker('경기도 이천시 예시길 7'), false)
  assert.equal(hasExampleMarker('서울특별시 마포구 예시로 12 (예시)'), true)
  assert.equal(hasExampleMarker('이 문구는 예시로 쓰세요'), true)
  assert.equal(hasExampleMarker('예시 주소'), true)
  assert.equal(hasExampleMarker('Sample St (example)'), true)
  const footerMarker = async (address) => {
    const r = await makeRunIn(TMP, localBrief({ ...LOCAL_FACTS, address }), localContent)
    const s = await gen(r)
    return s.blockers.filter((b) => b.startsWith('공개 불가 — 예시 문구 남음') && /address/.test(b))
  }
  assert.deepEqual(await footerMarker('서울특별시 마포구 예시로 12'), [], '도로명 예시로 는 주소(푸터·영업시간·오시는 길)를 공개 불가로 만들지 않는다')
  assert.equal((await footerMarker('서울특별시 마포구 예시 거리 12')).length > 0, true, '예시 낱말이 든 주소는 여전히 공개 불가(음성 대조)')
})
