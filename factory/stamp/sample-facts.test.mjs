// 예시 정보(v0.2.6 T5) — 키트 고정 표가 빈 필수 사실만 채우는지 본다.
// 실행: node --test --test-force-exit --test-timeout=120000 factory/stamp/sample-facts.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadArchetypes } from '../scripts/archetypes.mjs'
import { ARCHETYPE_IDS, SCHEMA_BUSINESS_ROOT, briefToSeed, requiredFacts } from './brief.mjs'
import { loadContentSchema } from './content.mjs'
import { SAMPLE_KEYS, buildSampleFacts, mergeFacts, readSampleFacts, remainingSamples, sampleFilePath, sampleValuesIn, writeSampleFacts } from './sample-facts.mjs'

const arch = await loadArchetypes()
const brief = (archetype, locale = 'ko', facts = { name: '가상상점' }) => ({ topic: '예시', archetype, locale, facts })
const sampleOf = (b) => buildSampleFacts({ archetype: arch[b.archetype], brief: b })

test('빈 필수 사실을 채운다 — 합친 브리프에는 04 가 「확인 필요」로 남길 필수 사실이 없다(원형 10 × 언어 2)', () => {
  for (const locale of ['ko', 'en']) for (const id of ARCHETYPE_IDS) {
    const b = brief(id, locale)
    const merged = mergeFacts(sampleOf(b), b)
    assert.deepEqual(briefToSeed(merged, arch[id]).missing, [], `${id}/${locale}`)
  }
})

test('영어 전화·메일·사업자번호·주소도 콘텐츠 스키마의 사업체 칸을 통과한다(영어 전화는 +82 꼴)', () => {
  for (const locale of ['ko', 'en']) for (const id of ARCHETYPE_IDS) {
    const b = brief(id, locale)
    const { content } = briefToSeed(mergeFacts(sampleOf(b), b), arch[id])
    const r = loadContentSchema(id).safeParse({ ...content, archetype: id, locale })
    const root = SCHEMA_BUSINESS_ROOT[id]
    // 주소(url)는 사이트 주소라 04 가 채운다 — briefToSeed 가 직접 잇는 연락 칸만 본다(phoneNote 같은 스키마 칸은 04 가 사실에서 쓴다)
    const bad = r.success ? [] : r.error.issues.filter((i) => i.path[0] === root && /^(phone|email|bizRegNo|address)$/.test(String(i.path.at(-1)))).map((i) => `${i.path.join('.')}: ${i.message}`)
    assert.deepEqual(bad, [], `${id}/${locale}`)
  }
})

test('답한 사실은 건드리지 않는다 — 키가 있으면 빈 문자열(우리에게 없는 사실)도 답이다', () => {
  const b = brief('local', 'ko', { name: '달빛', phone: '', address: '서울 어딘가 1' })
  const s = sampleOf(b)
  assert.ok(!('phone' in s.facts) && !('address' in s.facts) && !('name' in s.facts))
  assert.ok('hours' in s.facts && 'bizNo' in s.facts, '비어 있는 필수는 채운다')
  assert.deepEqual(remainingSamples(s, b).sort(), Object.keys(s.facts).sort())
})

test('채우지 않는 것: 사회적 증거·법정 사실·사이트 주소·상호', () => {
  for (const id of ARCHETYPE_IDS) for (const locale of ['ko', 'en']) {
    const keys = Object.keys(sampleOf(brief(id, locale)).facts)
    for (const k of keys) assert.ok(!/^legal(\.|$)|^(reviews|testimonials|clients|awards|rating)$|Url$/.test(k) || ['naverMapUrl', 'kakaoMapUrl', 'accessibilityPolicyUrl', 'productUrl', 'companyUrl'].includes(k), `${id}: ${k}`)
    assert.ok(!keys.includes('name'), `${id}: 상호는 지어내지 않는다`)
  }
  assert.ok(!SAMPLE_KEYS.some((k) => /^legal\.|termsUrl|privacyUrl|ftcLookupUrl|reviews|testimonials/.test(k)))
})

test('가상 값 규칙: 사업자번호는 검증 숫자가 틀리고 메일은 example.com', () => {
  const f = sampleOf(brief('local')).facts
  const d = f.bizNo.replace(/-/g, '').split('').map(Number)
  const sum = [1, 3, 7, 1, 3, 7, 1, 3].reduce((a, w, i) => a + w * d[i], 0) + Math.floor((5 * d[8]) / 10)
  assert.notEqual((10 - (sum % 10)) % 10, d[9], '검증 숫자가 맞으면 실제 번호일 수 있다')
  assert.match(f.email ?? sampleOf(brief('saas')).facts.email, /@example\.com$/)
})

test('한 번 채우면 새로 필수가 되는 칸까지 채운다(detail 배송 → 배송비·택배사·반품 배송비 부담)', () => {
  const f = sampleOf(brief('detail')).facts
  for (const k of ['shipping', 'returns', 'shippingFee', 'courier', 'returnsFeePayer']) assert.ok(k in f, k)
})

test('같은 입력이면 같은 출력 · 합치면 실제 값이 이기고 받은 브리프는 그대로', () => {
  const b = brief('saas', 'ko', { name: '가상', price: '월 9,900원' })
  const frozen = JSON.stringify(b)
  const s = sampleOf(b)
  assert.deepEqual(s, sampleOf(b))
  assert.equal(mergeFacts(s, b).facts.price, '월 9,900원')
  assert.equal(JSON.stringify(b), frozen)
  assert.equal(remainingSamples(s, mergeFacts(s, b)).length, 0, '합친 브리프로 세면 남은 예시가 없다 — 센 것은 합치기 전 브리프로 한다')
})

test('remainingSamples: 대표가 실제 값(빈 문자열 포함)을 주면 그 키는 예시에서 빠진다', () => {
  const b = brief('saas')
  const s = sampleOf(b)
  const left = remainingSamples(s, { ...b, facts: { ...b.facts, email: 'real@acme.test', price: '' } })
  assert.ok(!left.includes('email') && !left.includes('price') && left.includes('bizNo'))
  assert.deepEqual(remainingSamples(null, b), [])
})

test('파일: 쓰고 읽으면 같고 · 없거나 모양이 틀리면 null', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sample-'))
  assert.equal(readSampleFacts(dir), null)
  const s = sampleOf(brief('local'))
  writeSampleFacts(dir, s)
  assert.deepEqual(readSampleFacts(dir), s)
  assert.ok(!existsSync(`${sampleFilePath(dir)}.tmp`))
  writeFileSync(sampleFilePath(dir), '{ nope')
  assert.equal(readSampleFacts(dir), null)
  writeFileSync(sampleFilePath(dir), JSON.stringify({ version: 1, label: 'x', facts: { phone: 3 } }))
  assert.equal(readSampleFacts(dir), null)
})

test('값 스캔: 예시 값이 글자 그대로 있으면 키를 돌려주고, 열거형(returnsFeePayer)은 뺀다', () => {
  const s = sampleOf(brief('detail'))
  const hit = sampleValuesIn(`배송 ${s.facts.seller} / buyer / 번호 ${s.facts.bizNo}`, s)
  assert.deepEqual(hit.sort(), ['bizNo', 'seller'])
  assert.ok(!sampleValuesIn('buyer', s).includes('returnsFeePayer'))
  assert.deepEqual(sampleValuesIn('아무 글', s), [])
})

test('requiredFacts 에 든 키는 모두 표에서 값을 얻는다(상호 제외) — 표에 구멍이 없다', () => {
  for (const id of ARCHETYPE_IDS) for (const k of requiredFacts(id, { archetype: id, facts: {}, topic: '' })) {
    if (k === 'name') continue
    assert.ok(SAMPLE_KEYS.includes(k), `${id}: ${k}`)
  }
})
