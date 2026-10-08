// 04-content (P3-3 Task 7) — 저장소의 실제 원형·블록·레시피·콘텐츠 스키마를 쓴다.
// 「녹화 콘텐츠 3벌」(정상·지어낸 사실·글자 수 초과)은 파일이 아니라 요청에서 만든다 — 원형이 바뀌어도 낡지 않는다.
// 문구 에이전트가 하는 일을 시험용 함수(okContent)가 대신한다: 요청 칸마다 알맞은 짧은 문구를 채운다.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { loadArchetypes } from './archetypes.mjs'
import { loadLibrary } from './style-presets.mjs'
import { openRun } from '../stamp/run-dir.mjs'
import { briefToSeed, factPath, REQUIRED_FACTS } from '../stamp/brief.mjs'
import { buildSitemap, SECTION_FACTS } from '../stamp/sitemap.mjs'
import { validatedContent } from '../stamp/gen-pages.mjs'
import { chooseVariants } from '../stamp/variants.mjs'
import {
  contentRequest, validateContent, bindCopy, copyVariantFor, runContentStage, loadContentSchema, ruleList, extractFacts,
  FACT_NAMES, SLOT_FACTS, PLACEHOLDER, KO_BANNED, EN_BANNED, COMMON_BANNED,
} from '../stamp/content.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const archetypes = await loadArchetypes()
const library = loadLibrary()
const cands = library.slice(0, 3).map((r, i) => ({ id: 'abc'[i], recipe: r.id }))
const cand = cands[0]
const PH = PLACEHOLDER

// ── 브리프 ────────────────────────────────────────────────────────────────
const KO_FACTS = {
  name: '달빛베이커리(예시)', phone: '02-1234-5678', address: '서울특별시 마포구 예시로 12, 1층',
  hours: '화-수 10:00-20:00, 토 11:00-18:00', bizNo: '123-45-67890', email: 'hello@example.com', menu: '우유식빵 4,800원',
  transit: '예시역 2번 출구에서 걸어서 3분', parking: '주차는 어려워요', naverMapUrl: 'https://map.naver.com/p/entry/place/0', kakaoMapUrl: 'https://place.map.kakao.com/0',
}
const koBrief = (facts = KO_FACTS) => ({ topic: '동네 식빵집(예시)', archetype: 'local', locale: 'ko', facts })
const noPhone = () => koBrief(Object.fromEntries(Object.entries(KO_FACTS).filter(([k]) => k !== 'phone')))
const enBrief = () => ({
  topic: 'Neighbourhood bakery (sample)', archetype: 'local', locale: 'en',
  facts: { name: 'Moonlight Bakery (sample)', phone: '+82-2-1234-5678', address: '12 Example Street, Seoul', hours: 'Tue-Wed 10:00-20:00', bizNo: '123-45-67890', email: 'hello@example.com', transit: 'Three minutes from Example Station', parking: 'No parking', naverMapUrl: 'https://map.naver.com/p/entry/place/0', kakaoMapUrl: 'https://place.map.kakao.com/0' },
})
const saasBrief = () => ({ topic: '예약 관리 도구(예시)', archetype: 'saas', locale: 'ko', facts: { name: '예약노트(예시)', bizNo: '123-45-67890', email: 'hello@example.com', price: '월 9,900원', address: '서울특별시 마포구 예시로 12, 3층', phone: '02-1234-5678', productUrl: 'https://yeyaknote.example.com' } })

function setup(brief) {
  const archetype = archetypes[brief.archetype]
  const sitemap = buildSitemap(archetype, brief)
  const variants = chooseVariants(sitemap, cands, { seed: 7, weights: [] })
  return { archetype, brief, sitemap, variants, request: contentRequest(cand, sitemap, variants, 7, { archetype, brief }) }
}
const S = setup(koBrief())
const NP = setup(noPhone())
const EN = setup(enBrief())

// 칸마다 알맞은 짧은 문구(ko)
const KO_TEXT = {
  tagline: '매일 아침 굽는 동네 식빵집', todayHours: '오늘 10:00~20:00에 열어요', addressLine: '서울특별시 마포구 예시로 12, 1층',
  primaryCta: '전화로 자리 예약하기', item: '우유식빵 4,800원', address: '서울특별시 마포구 예시로 12, 1층', transit: '예시역 2번 출구에서 걸어서 3분이에요',
  parking: '주차는 어려워요',
}
const EN_TEXT = { tagline: 'Fresh bread every morning', todayHours: 'Open today 10:00 to 20:00', addressLine: '12 Example Street, Seoul', primaryCta: 'Call to book a table', item: 'Milk loaf', address: '12 Example Street, Seoul', transit: 'Three minutes from Example Station', parking: 'No parking' }
const copyText = (request, slot) => {
  if (slot.placeholder) return PH[request.locale]
  const table = request.locale === 'ko' ? KO_TEXT : EN_TEXT
  return table[slot.id] ?? (request.locale === 'ko' ? '자세한 내용은 매장에 물어봐 주세요.' : 'Ask us in the shop.')
}
function okContent({ request }, patch = {}) {
  const ph = PH[request.locale]
  const business = { ...request.seedContent.business }
  for (const name of request.missing) { const p = request.factPaths[name]; if (p[0] === 'business') business[p[1]] = ph }
  const c = {
    archetype: request.archetype, locale: request.locale,
    business,
    hours: [{ day: 'tu', opens: '10:00', closes: '20:00' }, { day: 'we', opens: '10:00', closes: '20:00' }, { day: 'sa', opens: '11:00', closes: '18:00' }],
    booking: { primary: { kind: 'tel', value: request.missing.includes('booking') ? ph : '02-1234-5678' } },
    mapLinks: { naver: request.missing.includes('mapLinks.naver') ? ph : 'https://map.naver.com/p/entry/place/0', kakao: request.missing.includes('mapLinks.kakao') ? ph : 'https://place.map.kakao.com/0' },
    directions: { transit: request.missing.includes('directions.transit') ? ph : request.locale === 'ko' ? '예시역 2번 출구에서 걸어서 3분이에요' : 'Three minutes from Example Station', parking: request.missing.includes('directions.parking') ? ph : request.locale === 'ko' ? '주차는 어려워요' : 'No parking' },
    facts: { ...request.seedContent.facts },
    slots: { copy: request.slots.map((s) => ({ id: s.id, role: s.role, text: copyText(request, s) })), images: [] },
  }
  return { ...c, ...patch }
}
const withCopy = (content, id, text, k = 0) => {
  const c = structuredClone(content)
  c.slots.copy.filter((x) => x.id === id)[k].text = text
  return c
}
const has = (problems, re) => problems.some((p) => re.test(p))

// ─── 요청 ───

test('request: slots carry path/role/maxChars/block/factsUsed from archetype copySlots, blocks from 03-variants', () => {
  const r = S.request
  assert.equal(r.candidate, 'a')
  assert.equal(r.locale, 'ko')
  assert.equal(r.placeholder, '확인 필요')
  const tag = r.slots.find((s) => s.path === 'home/hero-visit-info/tagline')
  assert.ok(tag, 'local home hero tagline slot')
  assert.equal(tag.maxChars, 28)
  assert.equal(tag.block, S.variants.a['home/hero-visit-info'])
  assert.ok(tag.role.length > 0)
  const addr = r.slots.find((s) => s.id === 'addressLine')
  assert.deepEqual(addr.factsUsed, ['address'])
  assert.equal(addr.placeholder, false)
  assert.equal(r.facts.phone, '02-1234-5678')
  assert.deepEqual(r.missing, [])
  assert.deepEqual(r.factPaths.phone, ['business', 'phone'])
  assert.ok(r.sections.includes('home/hero-visit-info'))
  assert.ok(r.checks.some((c) => c.id === 'invented-fact'))
  for (const s of r.slots) assert.ok(s.path.split('/').length === 3 && 'block' in s && Array.isArray(s.factsUsed), s.path)
})

test('request: deterministic; the seed picks a candidate voice (3 adjectives), other inputs stay equal', () => {
  const again = contentRequest(cand, S.sitemap, S.variants, 7, { archetype: S.archetype, brief: S.brief })
  assert.deepEqual(again, S.request)
  const other = contentRequest(cands[1], S.sitemap, S.variants, 7, { archetype: S.archetype, brief: S.brief })
  assert.equal(S.request.voice.adjectives.length, 3)
  assert.equal(new Set(S.request.voice.adjectives).size, 3)
  assert.deepEqual(other.slots.map((s) => s.path), S.request.slots.map((s) => s.path))
  assert.notDeepEqual(other.slots.map((s) => s.block), S.request.slots.map((s) => s.block), '후보마다 블록이 다르다')
  const reseeded = contentRequest(cand, S.sitemap, S.variants, 8, { archetype: S.archetype, brief: S.brief })
  assert.deepEqual({ ...reseeded, voice: null }, { ...S.request, voice: null })
})

test('request: accepts the whole chooseVariants map or one candidate map; needs { archetype, brief }; stale variants throw', () => {
  const one = contentRequest(cand, S.sitemap, S.variants.a, 7, { archetype: S.archetype, brief: S.brief })
  assert.deepEqual(one, S.request)
  assert.throws(() => contentRequest(cand, S.sitemap, S.variants, 7), /archetype, brief/)
  assert.throws(() => contentRequest(cand, S.sitemap, {}, 7, { archetype: S.archetype, brief: S.brief }), /03-variants/)
  assert.throws(() => contentRequest(cand, S.sitemap, S.variants, 7, { archetype: archetypes.saas, brief: S.brief }), /원형이 맞지 않는다/)
})

test('request: missing facts are listed; slots whose facts are all absent demand the placeholder; pending sections are skipped', () => {
  const r = NP.request
  assert.deepEqual(r.missing, ['phone', 'booking'], '전화가 없으면 예약 채널 자리도 비다(스키마가 요구한다)')
  const cta = r.slots.find((s) => s.id === 'primaryCta')
  assert.deepEqual(cta.factsWanted, ['phone', 'booking', 'bookingUrl'])
  assert.equal(cta.placeholder, true)
  // QFIX2 — 공지 섹션은 끝나는 날이 있는 공지 사실(notices)이 있어야 사이트맵에 든다: 날짜 없는 notice 사실만 있으면 섹션도 문구 칸도 없다(끝나는 날을 지어내지 않는다)
  assert.equal(r.slots.find((s) => s.id === 'notice'), undefined)
  for (const sk of r.skipped) assert.ok(NP.sitemap.pages.some((p) => p.sections.some((s) => `${p.id}/${s.kind}` === sk.path && s.status === 'pending')), sk.path)
  // FV1 Task 5.9 로 detail 의 필수 섹션은 모두 블록에 묶였다 — 블록을 기다리는 섹션(pending)은 사실이 있을 때만 들어오는 선택 섹션(related)이 남아 그것으로 본다
  const detail = setup({ topic: '린넨 앞치마(예시)', archetype: 'detail', locale: 'ko', facts: { name: '린넨 앞치마(예시)', price: '29,000원', seller: '예시상점', bizNo: '123-45-67890', related: '같은 시리즈 앞치마 3종' } })
  assert.deepEqual(detail.request.skipped.map((x) => x.path), ['product-detail/related'])
  for (const sk of detail.request.skipped) assert.ok(!detail.request.slots.some((s) => s.path.startsWith(`${sk.path}/`)), `${sk.path} 는 문구를 요청하지 않는다`)
  const saas = setup(saasBrief()).request
  assert.deepEqual(saas.missing, [])
  assert.ok(saas.slots.filter((s) => s.id === 'headline').length >= 2, 'saas headline 은 여러 섹션이 같은 id 를 쓴다')
})

// ─── 통과·실패(계획의 녹화 3벌) ───

test('recorded 1 — ok content passes (schema + slots + facts + register)', () => {
  assert.deepEqual(validateContent(S.request, okContent(S)), [])
})

test('recorded 2 — invented phone number is caught', () => {
  const bad = okContent(S)
  bad.business.phone = '02-987-6543'
  const p = validateContent(S.request, bad)
  assert.ok(has(p, /지어낸 사실|invented fact/), p.join('\n'))
  assert.ok(has(p, /02-987-6543/))
})

test('recorded 3 — over-length copy is caught (tagline max 28)', () => {
  const bad = withCopy(okContent(S), 'tagline', '매일 아침 직접 반죽해서 굽는 우리 동네 작은 식빵집 달빛베이커리입니다요')
  const p = validateContent(S.request, bad)
  assert.ok(has(p, /\[copy-slot\].*tagline.*28자/), p.join('\n'))
})

test('invented facts: address, price (prose and numeric), business number, email — each compared against the brief', () => {
  const base = okContent(S)
  const addr = structuredClone(base); addr.business.address = '서울특별시 마포구 가짜로 99'
  assert.ok(has(validateContent(S.request, addr), /주소 "서울특별시 마포구 가짜로 99"/))
  const price = withCopy(base, 'item', '우유식빵 5,500원')
  assert.ok(has(validateContent(S.request, price), /가격 "5,500원"/))
  const priceNum = structuredClone(base); priceNum.menu = [{ name: '우유식빵', price: 5500 }]
  assert.ok(has(validateContent(S.request, priceNum), /가격 5500/))
  const biz = structuredClone(base); biz.business.bizRegNo = '999-88-77777'
  assert.ok(has(validateContent(S.request, biz), /사업자등록번호 "999-88-77777"/))
  const mail = structuredClone(base); mail.business.email = 'ceo@fake.example'
  assert.ok(has(validateContent(S.request, mail), /메일 "ceo@fake.example"/))
  // 양성 대조군: 브리프에 있는 값은 표기가 달라도 통과한다
  const same = structuredClone(base); same.business.phone = '+82-2-1234-5678'; same.menu = [{ name: '우유식빵', price: 4800 }]
  assert.deepEqual(validateContent(S.request, same), [])
})

test('extractFacts: phones normalise (+82, hyphens), amounts (원·만원·$), addresses key on road + number', () => {
  const f = extractFacts('전화 +82-2-1234-5678 또는 02.1234.5678, 1588-1234, 1만원, 9,900원, $12.50, 마포구 예시로 12')
  assert.deepEqual([...new Set(f.phones.map((p) => p.key))].sort(), ['0212345678', '15881234'])
  assert.deepEqual(f.amounts.map((a) => a.key).sort((a, b) => a - b), [12.5, 9900, 10000])
  assert.equal(f.addresses[0].key, '예시로12', '구·시·군 뒤 도로명 + 번호')
  assert.equal(extractFacts('서울특별시 마포구 예시로 12').addresses[0].key, '예시로12')
  assert.equal(extractFacts('다음으로 3가지를 알려요').addresses.length, 0)
  assert.equal(extractFacts('2026-09-30 10:00 주문번호 20260930123456').phones.length, 0)
})

// ─── 빈 사실 ───

test('missing fact renders placeholder, not empty: the schema skips only the empty-fact place', () => {
  assert.deepEqual(validateContent(NP.request, okContent(NP)), [])
  const empty = okContent(NP); empty.business.phone = ''
  assert.ok(has(validateContent(NP.request, empty), /\[placeholder\].*확인 필요.*business\.phone/))
  const absent = okContent(NP); delete absent.business.phone
  assert.ok(has(validateContent(NP.request, absent), /\[placeholder\].*확인 필요/))
  const guessed = okContent(NP); guessed.business.phone = '02-111-2222'
  const p = validateContent(NP.request, guessed)
  assert.ok(has(p, /\[placeholder\].*확인 필요/) && has(p, /지어낸 사실/), p.join('\n'))
  const wrongLocale = okContent(NP); wrongLocale.business.phone = 'To be confirmed'
  assert.ok(has(validateContent(NP.request, wrongLocale), /\[placeholder\].*확인 필요/))
})

test('schema errors elsewhere still surface when a fact is missing (only the empty-fact place is tolerated)', () => {
  const c = okContent(NP)
  c.business.email = 'not-an-email'
  const p = validateContent(NP.request, c)
  assert.ok(has(p, /\[schema\].*business\.email/), p.join('\n'))
  assert.ok(!has(p, /business\.phone/), '빈 사실 자리는 스키마에서 건너뛴다')
  const d = okContent(NP); delete d.mapLinks
  assert.ok(has(validateContent(NP.request, d), /\[schema\].*mapLinks/))
})

test('structured fact (local hours) missing: the hours array may be left out, facts.hours carries the placeholder', () => {
  const NH = setup(koBrief(Object.fromEntries(Object.entries(KO_FACTS).filter(([k]) => k !== 'hours'))))
  assert.deepEqual(NH.request.missing, ['hours'])
  assert.deepEqual(NH.request.factPaths.hours, ['facts', 'hours'])
  const c = okContent(NH); delete c.hours; c.facts.hours = PH.ko
  assert.deepEqual(validateContent(NH.request, c), [])
  const bare = okContent(NH); delete bare.hours; delete bare.facts.hours
  assert.ok(has(validateContent(NH.request, bare), /\[placeholder\].*hours/))
  const guessed = okContent(NH); guessed.facts.hours = '매일 9-18'
  assert.ok(has(validateContent(NH.request, guessed), /\[placeholder\].*hours/))
})

test('fact slot: placeholder is required when all its facts are absent, and forbidden when they exist', () => {
  const left = withCopy(okContent(S), 'addressLine', PH.ko)
  assert.ok(has(validateContent(S.request, left), /\[placeholder\].*addressLine.*자리 표시/))
  const factLeft = okContent(S); factLeft.business.address = PH.ko
  assert.ok(has(validateContent(S.request, factLeft), /\[placeholder\].*address.*자리 표시/))
})

// ─── 칸 묶기 ───

test('copy slots must match the request in order and count (same id → request order)', () => {
  const c = okContent(S)
  const gone = structuredClone(c); gone.slots.copy = gone.slots.copy.filter((x) => x.id !== 'tagline')
  assert.ok(has(validateContent(S.request, gone), /\[copy-slot\] 문구 칸이 없다: home\/hero-visit-info\/tagline/))
  const extra = structuredClone(c); extra.slots.copy.push({ id: 'tagline', role: 'x', text: '하나 더예요' })
  assert.ok(has(validateContent(S.request, extra), /\[copy-slot\] 요청에 없는 문구 칸/))
  const blank = withCopy(c, 'tagline', '  ')
  assert.ok(has(validateContent(S.request, blank), /\[copy-slot\] 문구가 비었다/))
  const bound = bindCopy(S.request, c)
  assert.equal(bound.size, S.request.slots.length)
  assert.equal(bound.get('home/hero-visit-info/tagline').entry.text, KO_TEXT.tagline)
  const saas = setup(saasBrief())
  const sc = { slots: { copy: saas.request.slots.map((s, i) => ({ id: s.id, text: `문구 ${i}` })) } }
  const sb = bindCopy(saas.request, sc)
  const heads = saas.request.slots.filter((s) => s.id === 'headline')
  assert.deepEqual(heads.map((s) => sb.get(s.path).entry.text), heads.map((s) => `문구 ${saas.request.slots.indexOf(s)}`))
})

test('CTA slot: bare 「확인·제출·더보기」 is rejected (A3), verb + object passes', () => {
  for (const bare of ['확인', '제출', '더보기', '더 보기', '클릭']) assert.ok(has(validateContent(S.request, withCopy(okContent(S), 'primaryCta', bare)), /\[cta\]/), bare)
  assert.ok(!has(validateContent(S.request, withCopy(okContent(S), 'primaryCta', '전화로 자리 예약하기')), /\[cta\]/))
  assert.ok(has(validateContent(EN.request, withCopy(okContent(EN), 'primaryCta', 'Submit')), /\[cta\]/))
})

// ─── 문체·금지어 ───

test('ko: 해요체 — 합쇼체 and 해라체 endings are caught; 해요체, nouns and labels pass', () => {
  const reg = (t) => has(validateContent(S.request, withCopy(okContent(S), 'tagline', t)), /\[ko-register\]/)
  assert.ok(reg('매일 아침 식빵을 굽습니다'))
  assert.ok(reg('저희는 동네 빵집입니다.'))
  assert.ok(reg('아침마다 빵을 굽는다.'))
  assert.ok(!reg('매일 아침 식빵을 구워요'))
  assert.ok(!reg('매일 아침 굽는 동네 식빵집'))
  assert.ok(!reg('바다'), '마침표 없는 명사 라벨은 해라체가 아니다')
})

test('ko: banned copy patterns (DESIGN §9·§14-C) are caught, each with its own rule id', () => {
  const cases = {
    'ko-innovate': '혁신적인 빵집', 'ko-smarter': '더 스마트하게 굽는 빵이에요', 'ko-you': '당신의 아침을 책임져요', 'ko-new-standard': '식빵의 새로운 기준이에요', 'ko-experience': '갓 구운 빵을 경험하세요',
    'ko-at-a-glance': '메뉴를 한눈에 봐요', 'ko-contrast': '단순한 빵집이 아니라 동네 사랑방이에요', 'ko-negation-list': '비싸지도 흔하지도 아닌 빵이에요',
    'ko-drama': '빠르게. 쉽게. 따뜻하게.', 'ko-rhetorical-question': '만약 아침이 즐거워진다면?', 'ko-throat-clearing': '결론적으로 맛있어요',
    'ko-authority': '전문가들은 추천해요', 'ko-filler-emphasis': '정말 맛있어요', 'ko-thousands-chose': '수천 명이 선택했어요', 'ko-power': '밀가루의 힘이에요',
    'ko-empty-adjectives': '원활한 예약이에요', 'placeholder-text': 'lorem ipsum',
  }
  for (const [id, text] of Object.entries(cases)) {
    const p = validateContent(S.request, withCopy(okContent(S), 'tagline', text))
    assert.ok(has(p, new RegExp(`\\[${id}\\]`)), `${id}: ${text}\n${p.join('\n')}`)
  }
  assert.equal(new Set(KO_BANNED.map(([id]) => id)).size, KO_BANNED.length)
  for (const [id, re] of KO_BANNED) assert.ok(Object.values(cases).some((t) => re.test(t)), `규칙 ${id} 를 겨냥한 사례가 없다`)
})

test('common: emoji, exclamation mark, em dash are caught in both locales', () => {
  for (const [id, text] of [['emoji', '갓 구운 빵 🍞이에요'], ['exclamation', '맛있어요!'], ['em-dash', '식빵 — 갓 구워요']]) {
    assert.ok(has(validateContent(S.request, withCopy(okContent(S), 'tagline', text)), new RegExp(`\\[${id}\\]`)), id)
  }
  assert.ok(has(validateContent(EN.request, withCopy(okContent(EN), 'tagline', 'Fresh bread — daily')), /\[em-dash\]/))
  assert.ok(has(validateContent(EN.request, withCopy(okContent(EN), 'tagline', 'Fresh bread! Daily')), /\[exclamation\]/))
  assert.equal(COMMON_BANNED.length, 3)
})

test('prose scan skips business facts (a Korean name ending in 다 or containing banned syllables is not copy)', () => {
  const c = okContent(S)
  c.business.name = '달빛베이커리(예시)'
  assert.deepEqual(validateContent(S.request, c), [])
  const facts = { ...KO_FACTS, name: '혁신당 베이커리(예시)', menu: '혁신 우유식빵 4,800원' }
  const s2 = setup(koBrief(facts))
  const ok = withCopy(okContent(s2), 'item', '혁신 우유식빵 4,800원')
  assert.deepEqual(validateContent(s2.request, ok), [], '사실 그대로인 글자는 금지어 검사에서 뺀다(브리프가 준 값이다)')
  const legal = okContent(s2); legal.business.legalName = '혁신 주식회사(예시)'
  assert.deepEqual(validateContent(s2.request, legal), [], '사업자 정보 아래는 문구가 아니다')
  assert.ok(has(validateContent(s2.request, withCopy(okContent(s2), 'item', '혁신 우유식빵 4,800원이에요')), /\[ko-innovate\]/), '사실이 아니라 문구가 되면 검사한다')
})

test('en: passes clean English; en banned words and contrasts are caught; ko rules do not run', () => {
  assert.deepEqual(validateContent(EN.request, okContent(EN)), [])
  const bad = {
    'en-words': 'We leverage robust ovens', 'en-contrast': 'Not just a bakery, it’s a home', 'en-theater': 'No more growth theater',
    'en-filler': 'At the end of the day it is bread', 'en-throat-clearing': 'Here’s the thing about bread', 'en-jargon': 'Let’s circle back on the loaf',
  }
  for (const [id, text] of Object.entries(bad)) assert.ok(has(validateContent(EN.request, withCopy(okContent(EN), 'tagline', text)), new RegExp(`\\[${id}\\]`)), id)
  for (const [id, re] of EN_BANNED) assert.ok(Object.values(bad).some((t) => re.test(t)), `규칙 ${id} 를 겨냥한 사례가 없다`)
  const korean = validateContent(EN.request, withCopy(okContent(EN), 'tagline', '매일 아침 굽습니다'))
  assert.ok(has(korean, /\[locale\].*한글/))
  assert.ok(!has(korean, /\[ko-/), 'en 브리프에는 해요체·ko 금지어 검사를 돌리지 않는다')
  assert.ok(ruleList('en').every((r) => !r.id.startsWith('ko-')))
  assert.ok(ruleList('ko').some((r) => r.id === 'ko-register'))
  assert.ok(has(validateContent(EN.request, { ...okContent(EN), locale: 'ko' }), /\[locale\]/))
  assert.equal(validateContent(EN.request, { ...okContent(EN), business: { ...okContent(EN).business, phone: '02-1234-5678' } }).length, 0, '+82 형식 사실은 국내 표기로 써도 같은 번호다')
  const missingEn = { ...EN.brief, facts: { ...EN.brief.facts } }; delete missingEn.facts.phone
  const en2 = setup(missingEn)
  assert.deepEqual(validateContent(en2.request, okContent(en2)), [])
  const koPh = okContent(en2); koPh.business.phone = '확인 필요'
  assert.ok(has(validateContent(en2.request, koPh), /\[placeholder\].*To be confirmed/))
})

// ─── 문구 변형(J2) ───

test('copyVariant: tag goes on a section key, ends up on the attribution of a wrapped track (J2)', async () => {
  const key = 'home/hero-visit-info'
  const tagged = { ...okContent(S), copyVariants: { [key]: 'b', 'home/menu-price': 'long-1' } }
  assert.deepEqual(validateContent(S.request, tagged), [])
  assert.equal(copyVariantFor(tagged, key), 'b')
  assert.equal(copyVariantFor(tagged, 'home/nothing'), undefined)
  const unknown = { ...okContent(S), copyVariants: { 'home/nothing': 'b' } }
  assert.ok(has(validateContent(S.request, unknown), /\[copy-variant\] 요청에 없는 섹션/))
  for (const bad of ['B', 'a b', '', 7, 'x'.repeat(33)]) assert.ok(has(validateContent(S.request, { ...okContent(S), copyVariants: { [key]: bad } }), /\[copy-variant\] id/), String(bad))
  assert.ok(has(validateContent(S.request, { ...okContent(S), copyVariants: ['b'] }), /\[copy-variant\]/))
  assert.equal(copyVariantFor({ copyVariants: { [key]: 'B!' } }, key), undefined, '형식이 틀린 태그는 계측에 싣지 않는다')
  // withAttribution 에 실제로 실린다 — 계약 파일을 변환해 불러온다(@/registry/factory/… import 는 변환본 주소로 잇는다)
  const ts = createRequire(import.meta.url)('typescript')
  const outDir = join(root, '.tmp', 'stamp-content-attribution')
  mkdirSync(outDir, { recursive: true })
  const factory = join(root, 'registry', 'factory')
  const done = new Map()
  const emit = (abs) => {
    if (done.has(abs)) return done.get(abs)
    const out = join(outDir, abs.slice(factory.length + 1).replace(/[\\/]/g, '_').replace(/\.tsx?$/, '.mjs'))
    done.set(abs, out)
    const js = ts.transpileModule(readFileSync(abs, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
    writeFileSync(out, js.replace(/(from\s+)(["'])@\/registry\/factory\/([^"']+)\2/g, (_, kw, q, p) => {
      const base = join(factory, p)
      return `${kw}${q}${pathToFileURL(emit(['.ts', '.tsx'].map((e) => base + e).find(existsSync))).href}${q}`
    }))
    return out
  }
  const { withAttribution } = await import(pathToFileURL(emit(join(factory, 'contract', 'attribution.ts'))).href)
  const { mockAnalytics } = await import(pathToFileURL(emit(join(factory, 'contract', 'adapter-mock.ts'))).href)
  const a = mockAnalytics('?consent=all')
  withAttribution(a, { blockId: S.variants.a[key], recipeId: cand.recipe, copyVariant: copyVariantFor(tagged, key) }).track('cta_click', { id: 'hero-primary', label: '예약', section: 'hero' })
  assert.equal(a.events[0].attribution.copyVariant, 'b')
  assert.equal(a.events[0].attribution.blockId, S.variants.a[key])
})

// ─── 이름 맞추기(C91) ───

test('C91: every fact name that sitemap SECTION_FACTS, SLOT_FACTS and REQUIRED_FACTS use is a documented FACT_NAME', () => {
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9가-힣]/g, '')
  const known = new Set(FACT_NAMES.map(norm))
  const used = new Set([
    ...Object.values(SECTION_FACTS).flat(),
    ...Object.values(SLOT_FACTS).flatMap((t) => Object.values(t).flat()),
    ...Object.values(REQUIRED_FACTS).flat(),
  ])
  assert.deepEqual([...used].filter((n) => !known.has(norm(n))), [])
  assert.equal(new Set(FACT_NAMES.map(norm)).size, FACT_NAMES.length, 'FACT_NAMES 에 겹치는 이름이 있다')
})

test('factPath: briefToSeed puts every fact where factPath says (04-content looks in the same place)', () => {
  for (const [id, a] of Object.entries(archetypes)) {
    const facts = { name: 'N', phone: '02-1234-5678', address: 'A', email: 'a@b.co', bizNo: '123-45-67890', seller: 'S', price: '100원', hours: 'h', extra: 'x' }
    const { content } = briefToSeed({ topic: 't', archetype: id, locale: 'ko', facts }, a)
    for (const k of Object.keys(facts)) {
      const v = factPath(id, k).reduce((o, p) => o?.[p], content)
      assert.equal(v, facts[k], `${id}/${k}`)
    }
  }
})

test('placeholder texts are the ones the renderers use (content-core NEEDS_CHECK, legal drafts)', () => {
  loadContentSchema('local')
  const core = createRequire(import.meta.url)(join(root, '.tmp', 'stamp-content', 'content', 'content-core.cjs'))
  assert.equal(core.NEEDS_CHECK, PH.ko)
  assert.equal(PH.en, 'To be confirmed')
})

test('loadContentSchema: every archetype schema loads and rejects an empty object', () => {
  for (const id of Object.keys(archetypes)) {
    const s = loadContentSchema(id)
    assert.equal(s.safeParse({}).success, false, id)
  }
})

// ─── 단계(J7) ───

test('runContentStage: needs-copy → invalid → ok (rewritten as a J7 step file) → skips → stale when the request changes', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'wf-content-'))
  const run = openRun(dir)
  const args = [cand, S.sitemap, S.variants, 7, { archetype: S.archetype, brief: S.brief }]
  const first = runContentStage(run, ...args)
  assert.equal(first.status, 'needs-copy')
  assert.ok(existsSync(join(dir, 'a', '04-content.request.json')))
  assert.deepEqual(JSON.parse(readFileSync(first.requestFile, 'utf8')), first.request)
  const file = join(dir, 'a', '04-content.json')
  writeFileSync(file, JSON.stringify(withCopy(okContent(S), 'tagline', '혁신적인 빵집')))
  const bad = runContentStage(run, ...args)
  assert.equal(bad.status, 'invalid')
  assert.ok(has(bad.problems, /ko-innovate/))
  writeFileSync(file, JSON.stringify(okContent(S)))
  const ok = runContentStage(run, ...args)
  assert.equal(ok.status, 'ok')
  const saved = JSON.parse(readFileSync(file, 'utf8'))
  assert.ok(saved.inputHash && saved.producedAt && saved.data.archetype === 'local')
  const again = runContentStage(run, ...args)
  assert.equal(again.status, 'ok')
  assert.deepEqual(again.content, ok.content)
  const changed = { ...S.brief, facts: { ...S.brief.facts, hours: '매일 9-18' } }
  const sm2 = buildSitemap(S.archetype, changed)
  const stale = runContentStage(run, cand, sm2, chooseVariants(sm2, cands, { seed: 7, weights: [] }), 7, { archetype: S.archetype, brief: changed })
  assert.equal(stale.status, 'stale')
  writeFileSync(file, '{ nope')
  assert.equal(runContentStage(run, ...args).status, 'invalid')
})

test('CLI --check: exit 0 for ok content, 1 with the problem lines for bad content, 2 for wrong arguments or unreadable files', () => {
  const dir = mkdtempSync(join(tmpdir(), 'wf-content-cli-'))
  const req = join(dir, '04-content.request.json'), good = join(dir, 'good.json'), bad = join(dir, 'bad.json')
  writeFileSync(req, JSON.stringify(S.request))
  writeFileSync(good, JSON.stringify(okContent(S)))
  writeFileSync(bad, JSON.stringify(withCopy(okContent(S), 'tagline', '혁신적인 빵집')))
  const cli = join(root, 'factory', 'stamp', 'content.mjs')
  const run = (...args) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', timeout: 60000 })
  const ok = run('--check', req, good)
  assert.equal(ok.status, 0, ok.stdout + ok.stderr)
  assert.match(ok.stdout, /문제 0건/)
  const no = run('--check', req, bad)
  assert.equal(no.status, 1)
  assert.match(no.stdout, /\[ko-innovate\]/)
  assert.equal(run('--check', req).status, 2)
  assert.equal(run('--check', req, join(dir, 'nope.json')).status, 2)
})

// ─── 스키마가 요구하는데 사실이 없는 자리(P3-3 Task 14 골든 — 문구 에이전트 6명이 막히거나 값을 지어냈다) ───

const bareLocal = () => setup(koBrief({ name: '봄결꽃집', hours: '화-토 10:00-19:00', email: 'hello@example.com', menu: '우유식빵 4,800원' }))
const bareSaas = () => setup({ topic: '예약 도구', archetype: 'saas', locale: 'ko', facts: { name: '예약노트', bizNo: '123-45-67890', email: 'hello@example.com', price: '월 9,900원' } })

test('request: 스키마가 요구하는데 사실이 없는 자리(예약 채널·지도 링크·오시는 길·사업장 주소·전화·제품 주소)는 missing·factPaths 에 오른다', () => {
  const r = bareLocal().request
  for (const name of ['booking', 'mapLinks.naver', 'mapLinks.kakao', 'directions.transit', 'directions.parking']) assert.ok(r.missing.includes(name), name)
  assert.deepEqual(r.factPaths['mapLinks.naver'], ['mapLinks', 'naver'])
  assert.deepEqual(r.factPaths.booking, ['booking', 'primary', 'value'])
  const s = bareSaas().request
  assert.deepEqual([...s.missing].sort(), ['address', 'phone', 'product.url'])
  assert.deepEqual(s.factPaths['product.url'], ['product', 'url'])
  assert.deepEqual(s.factPaths.address, ['business', 'address'])
  // 사실이 있으면 오르지 않는다
  for (const name of ['booking', 'mapLinks.naver', 'directions.transit']) assert.ok(!S.request.missing.includes(name), `${name} 는 사실이 있다`)
  assert.deepEqual(setup(saasBrief()).request.missing, [])
})

test('validate: 그 자리는 정확히 자리 표시여야 한다 — 값을 지어내거나(https://example.com) 비우면 떨어지고, 자리 표시는 스키마(Url)도 통과한다', () => {
  const B = bareLocal()
  const ok = okContent(B)
  assert.equal(ok.mapLinks.naver, PH.ko)
  assert.deepEqual(validateContent(B.request, ok), [], '자리 표시를 적으면 통과')
  const invented = okContent(B); invented.mapLinks.naver = 'https://example.com'
  assert.ok(has(validateContent(B.request, invented), /\[placeholder\].*mapLinks\.naver/), '지어낸 주소')
  const noBooking = okContent(B); delete noBooking.booking
  assert.ok(has(validateContent(B.request, noBooking), /booking/), '예약 채널 칸을 비우면 떨어진다')
  const garbage = okContent(B); garbage.mapLinks.kakao = '카카오맵 링크는 나중에'
  assert.ok(has(validateContent(B.request, garbage), /\[(placeholder|schema)\].*mapLinks\.kakao/), '주소도 자리 표시도 아닌 글자')
  // 사실이 있는 자리에 자리 표시가 남으면 떨어진다
  const left = okContent(S); left.mapLinks.naver = PH.ko
  assert.ok(has(validateContent(S.request, left), /\[(placeholder|schema)\]/), '사실이 있는데 자리 표시')
})

test('validate: 브리프가 무료를 말하면 가격 0 은 지어낸 가격이 아니다 — 말하지 않으면 그대로 떨어진다', () => {
  const free = setup(koBrief({ ...KO_FACTS, claim: '첫 시식은 무료' }))
  const c = okContent(free); c.plans = [{ name: '시식', monthlyPrice: 0 }]
  assert.ok(!has(validateContent(free.request, c), /invented-fact/), '무료 사실이 있다')
  const paid = okContent(S); paid.plans = [{ name: '시식', monthlyPrice: 0 }]
  assert.ok(has(validateContent(S.request, paid), /\[invented-fact\].*가격 0/), '무료라는 사실이 없다')
  const priced = okContent(free); priced.plans = [{ name: '시식', monthlyPrice: 5000 }]
  assert.ok(has(validateContent(free.request, priced), /\[invented-fact\].*5000/), '무료 사실이 다른 가격을 허락하지 않는다')
})

test('request: saas 씨앗에 product(이름=상호·주소=productUrl 사실)가 있고, 주소 사실이 없으면 이름만(주소는 missing)', () => {
  const full = setup(saasBrief()).request
  assert.deepEqual(full.seedContent.product, { name: '예약노트(예시)', url: 'https://yeyaknote.example.com' })
  const bare = bareSaas().request
  assert.deepEqual(bare.seedContent.product, { name: '예약노트' })
  assert.ok(bare.missing.includes('product.url'))
  assert.equal(S.request.seedContent.product, undefined, 'saas 가 아닌 원형에는 product 를 넣지 않는다')
})

// ─── 골든 14b 발견: ui: 숫자 칸 · 알 수 없는 최상위 칸 · detail 중첩 필수 자리 ───

test('ui: 칸의 숫자 종류 — 기능·구조 이름(2단계 인증·6자리·만 14세)은 예시 그대로 가능, 사업 수치(3개·월 300건)는 그대로 안 되고 못 쓰면 빈 문자열', () => {
  const block = S.variants.a['home/hero-visit-info']
  const uiSlots = new Map([[block, [
    { path: 'copy.rows.twoFactor', example: '2단계 인증', why: 'digits' },
    { path: 'copy.password.hint', example: '8자 이상으로 만들어 주세요.', why: 'digits' },
    { path: 'copy.ageOver14.label', example: '만 14세 이상이에요', why: 'digits' },
    { path: 'copy.compare.rows[0].current', example: '3개', why: 'digits' },
    { path: 'copy.unlocked[1]', example: '방문 전날 안내 문자 월 300건', why: 'digits' },
    { path: 'copy.title', example: '모아플랜(예시) 시작하기', why: 'marker' },
  ]]])
  const r = contentRequest(cand, S.sitemap, S.variants, 7, { archetype: S.archetype, brief: S.brief, uiSlots })
  const ui = (p) => r.slots.find((x) => x.id === `ui:${p}`)
  assert.equal(ui('copy.rows.twoFactor').ui.numbers, 'structural')
  assert.equal(ui('copy.password.hint').ui.numbers, 'structural')
  assert.equal(ui('copy.ageOver14.label').ui.numbers, 'structural')
  assert.equal(ui('copy.compare.rows[0].current').ui.numbers, 'business')
  assert.equal(ui('copy.unlocked[1]').ui.numbers, 'business')
  assert.equal('numbers' in ui('copy.title').ui, false, 'marker 칸에는 숫자 종류가 없다')

  const S2 = { request: r }
  const base = okContent(S2)
  const set = (c, p, text) => withCopy(c, `ui:${p}`, text)
  const problems = (c) => validateContent(r, c).filter((p) => /ui-copy|copy-slot/.test(p))
  // 구조 이름은 예시 그대로 통과
  let c = set(set(base, 'copy.rows.twoFactor', '2단계 인증'), 'copy.ageOver14.label', '만 14세 이상이에요')
  assert.equal(problems(c).some((p) => /copy\.rows\.twoFactor|copy\.ageOver14/.test(p)), false, problems(c).join('\n'))
  // 사업 수치는 예시 그대로면 떨어지고, 숫자 없이 쓰거나 빈 문자열이면 통과
  assert.ok(problems(set(base, 'copy.compare.rows[0].current', '3개')).some((p) => /예시 문장 그대로/.test(p)), '사업 수치 예시 그대로')
  assert.equal(problems(set(base, 'copy.compare.rows[0].current', '')).some((p) => /비었다/.test(p)), false, '사업 수치 칸은 비울 수 있다')
  assert.ok(validateContent(r, set(base, 'copy.rows.twoFactor', '')).some((p) => /비었다/.test(p)), '구조 이름 칸은 비울 수 없다')
  // 예시 표지가 남은 marker 칸은 그대로 두면 여전히 떨어진다
  assert.ok(problems(set(base, 'copy.title', '모아플랜(예시) 시작하기')).some((p) => /예시 표지/.test(p)))
})

test('P4GR validate: 사업 수치 ui: 칸을 빈 문자열로 남기는 방법(COPY.md)이 스키마(문구가 비었습니다)에서도 통과한다 — 구조 이름 칸·일반 칸은 여전히 스키마가 거절한다(음성 대조)', () => {
  const block = S.variants.a['home/hero-visit-info']
  const uiSlots = new Map([[block, [
    { path: 'copy.rows.twoFactor', example: '2단계 인증', why: 'digits' },
    { path: 'copy.compare.rows[0].current', example: '3개', why: 'digits' },
  ]]])
  const r = contentRequest(cand, S.sitemap, S.variants, 7, { archetype: S.archetype, brief: S.brief, uiSlots })
  const base = okContent({ request: r })
  const blank = (id) => withCopy(base, `ui:${id}`, '')
  const hard = (c) => validateContent(r, c).filter((p) => /^\[(schema|copy-slot)\]/.test(p))
  assert.deepEqual(hard(base), [])
  assert.deepEqual(hard(blank('copy.compare.rows[0].current')), [], '사업 수치 칸을 비웠는데 스키마에서 떨어진다')
  assert.ok(has(hard(blank('copy.rows.twoFactor')), /^\[schema\] 문구가 비었습니다/), '구조 이름 칸은 비우면 스키마가 거절한다')
  assert.ok(has(hard(blank('copy.rows.twoFactor')), /^\[copy-slot\]/), '구조 이름 칸은 비우면 검사도 거절한다')
  const plain = structuredClone(base)
  plain.slots.copy[0].text = ''
  assert.ok(has(hard(plain), /^\[schema\] 문구가 비었습니다/), '일반 문구 칸은 비울 수 없다')
  // 06 이 읽는 검사(validatedContent)도 같은 규칙이다
  assert.doesNotThrow(() => validatedContent(blank('copy.compare.rows[0].current'), r))
  assert.throws(() => validatedContent(blank('copy.rows.twoFactor'), r), /문구가 비었습니다/)
})

test('validate: 알 수 없는 최상위 칸은 떨어진다 — 스키마에도 봉투(locale·facts·copyVariants·media·site)에도 없는 이름이 조용히 통과하지 않는다', () => {
  const ok = okContent(S)
  assert.deepEqual(validateContent(S.request, ok), [])
  for (const k of ['product', 'extras', 'notes']) {
    const bad = { ...ok, [k]: { x: 1 } }
    assert.ok(has(validateContent(S.request, bad), new RegExp(`알 수 없는 최상위 칸이다.*${k}`)), k)
  }
  const envelope = { ...ok, copyVariants: {}, media: {}, site: { url: 'https://moonlight.example.kr' } }
  assert.equal(has(validateContent(S.request, envelope), /알 수 없는 최상위 칸/), false, '봉투 칸은 통과')
})

test('request: detail 의 중첩 필수 자리(택배사·고시 품목·고시 항목)와 숫자·구조로만 받는 사실(배송·반품)은 missing 에 오르고, 사실→구조 표(structures)가 실린다', () => {
  const bare = setup({ topic: '린넨 앞치마', archetype: 'detail', locale: 'ko', facts: { name: '린넨 앞치마', price: '29,000원', seller: '결이 공방', bizNo: '123-45-67890' } }).request
  for (const name of ['shipping', 'returns', 'notice.category', 'notice.rows']) assert.ok(bare.missing.includes(name), name)
  assert.ok(!bare.missing.includes('product.shipping.courier'), '배송 구조를 통째로 뺄 때는 택배사 자리가 없다(unless)')
  assert.deepEqual(bare.factPaths.shipping, ['facts', 'shipping'], '숫자·구조 사실의 자리 표시는 facts.<이름>')
  assert.deepEqual(bare.factPaths['notice.category'], ['notice', 'category'])
  assert.deepEqual(bare.factPaths['notice.rows'], ['notice', 'rows', 0, 'value'])
  assert.deepEqual(bare.structures.price, ['product.price', 'product.taxIncluded', 'product.currency'])
  assert.deepEqual(bare.structures.shipping, ['product.shipping'])
  assert.deepEqual(bare.structures.returns, ['product.returns'])

  const withShip = setup({ topic: '린넨 앞치마', archetype: 'detail', locale: 'ko', facts: { name: '린넨 앞치마', price: '29,000원', seller: '결이 공방', bizNo: '123-45-67890', shipping: '배송비 3,000원, 5만원 이상 무료, 3일 안에 출고', returns: '7일 안 반품, 반품 배송비는 구매자 부담' } }).request
  for (const n of ['product.shipping.courier', 'product.shipping.fee', 'product.returns.feePayer']) assert.ok(withShip.missing.includes(n), `배송·반품 사실이 있으면 ${n} 자리가 필요하다`)
  assert.ok(!withShip.missing.includes('shipping') && !withShip.missing.includes('returns'))
  const full = setup({ topic: '린넨 앞치마', archetype: 'detail', locale: 'ko', facts: { name: '린넨 앞치마', price: '29,000원', seller: '결이 공방', bizNo: '123-45-67890', shipping: '배송비 3,000원', returns: '7일 안 반품', address: '서울특별시 성동구 예시로 3, 2층', phone: '02-555-0100', shippingFee: '3000', returnsFeePayer: 'buyer', courier: '한진택배', noticeCategory: '의류', specs: '린넨 100%' } }).request
  assert.deepEqual(full.missing, [], '사실이 다 있으면 빠진 자리가 없다')
})

// ── P3-3 Task 14b: detail 의 숫자·고정 목록 칸(배송비·반품 배송비 부담·택배사·고시 품목) ──
const bareDetail = () => setup({ topic: 'Ceramic dripper', archetype: 'detail', locale: 'en', facts: { name: 'Dripper', price: '$48', seller: 'Kiln Studio', bizNo: '123-45-67890', email: 'hello@example.com', shipping: 'Ships in 3 days, free over $80', returns: 'Return within 14 days' } })

test('request: detail — 스키마가 숫자·enum 으로 요구하는 배송비·반품 배송비 부담 주체는 사실이 없으면 missing 에 오른다(문구 에이전트가 막히거나 지어내지 않는다)', () => {
  const r = bareDetail().request
  for (const name of ['product.shipping.fee', 'product.returns.feePayer', 'product.shipping.courier', 'notice.category']) assert.ok(r.missing.includes(name), name)
  assert.deepEqual(r.factPaths['product.shipping.fee'], ['product', 'shipping', 'fee'])
  assert.deepEqual(r.factPaths['product.returns.feePayer'], ['product', 'returns', 'feePayer'])
  const full = setup({ topic: 'Ceramic dripper', archetype: 'detail', locale: 'en', facts: { name: 'Dripper', price: '$48', seller: 'Kiln Studio', bizNo: '123-45-67890', email: 'hello@example.com', shippingFee: '5', returnsFeePayer: 'buyer', courier: 'CJ', noticeCategory: 'Kitchenware' } }).request
  for (const name of ['product.shipping.fee', 'product.returns.feePayer', 'product.shipping.courier', 'notice.category']) assert.ok(!full.missing.includes(name), `${name} 는 사실이 있다`)
})

test('validate: detail 의 숫자·enum 칸은 자리 표시 글자만 받는다 — 스키마 형식 오류는 그 칸만 건너뛰고, 비우거나 0 을 지어 넣으면 떨어진다', () => {
  const { request } = bareDetail()
  const ph = PH.en
  const base = { archetype: 'detail', locale: 'en', product: { name: 'Dripper', price: 48, taxIncluded: true, shipping: { fee: ph, courier: ph, leadDays: 3, freeThreshold: 80 }, returns: { feePayer: ph, withdrawalDays: 14 } }, notice: { category: ph, rows: [{ label: 'Seller', value: 'Kiln Studio' }] }, slots: { copy: [], images: [] } }
  const problems = (c) => validateContent(request, c)
  assert.ok(!has(problems(base), /product\.shipping\.fee|product\.returns\.feePayer/), '자리 표시는 형식 오류를 내지 않는다')
  const noFee = structuredClone(base); delete noFee.product.shipping.fee
  assert.ok(has(problems(noFee), /\[placeholder\].*product\.shipping\.fee/), '비우면 자리 표시 규칙에 떨어진다')
  const invented = structuredClone(base); invented.product.shipping.fee = 0; invented.product.returns.feePayer = 'buyer'
  assert.ok(has(problems(invented), /\[placeholder\].*product\.shipping\.fee/), '0 을 지어 넣으면 떨어진다')
  assert.ok(has(problems(invented), /\[placeholder\].*product\.returns\.feePayer/), 'buyer 를 지어 넣으면 떨어진다')
})

// ─── P3-3 Task 14a 2차: detail 가격의 통화(ports Money — 최소 단위 정수 + currency + vatIncluded) ───
test('request: detail 은 브리프 가격에서 통화를 읽어 currency 로 싣고($→USD·€→EUR·원→KRW·없으면 null), 가격 구조 칸에 product.currency 가 든다', () => {
  const cur = (price, locale = 'en') => setup({ topic: 'Dripper', archetype: 'detail', locale, facts: { name: 'Dripper', price, seller: 'Kiln Studio', bizNo: '123-45-67890' } }).request.currency
  assert.equal(cur('$48'), 'USD')
  assert.equal(cur('48 USD'), 'USD')
  assert.equal(cur('€39.50'), 'EUR')
  assert.equal(cur('29,000원', 'ko'), 'KRW')
  assert.equal(cur('₩29,000', 'ko'), 'KRW')
  assert.equal(cur(''), null)
  assert.ok(bareDetail().request.structures.price.includes('product.currency'))
  assert.equal(S.request.currency, undefined, 'detail 이 아닌 원형에는 통화 칸이 없다')
})

test('validate: detail 의 product.currency 는 브리프 가격의 통화와 같아야 하고, USD·EUR 가격은 센트 값도 지어낸 가격이 아니다', () => {
  const { request } = bareDetail()
  const ph = PH.en
  const mk = (product) => ({ archetype: 'detail', locale: 'en', product: { name: 'Dripper', taxIncluded: true, shipping: { fee: ph, courier: ph, leadDays: 3 }, returns: { feePayer: ph, withdrawalDays: 14 }, ...product }, notice: { category: ph, rows: [{ label: 'Seller', value: 'Kiln Studio' }] }, slots: { copy: [], images: [] } })
  const bad = (c) => validateContent(request, c).filter((p) => /\[currency\]|invented-fact/.test(p))
  assert.deepEqual(bad(mk({ price: 4800, currency: 'USD' })), [], '센트 4800 = $48')
  assert.ok(bad(mk({ price: 48, currency: 'USD' })).some((p) => /invented-fact/.test(p)), '달러 값 48 을 그대로 넣으면 48센트라 브리프 가격 $48(=4800센트)과 다르다(P3-3 Task 14b — 예전에는 통과했다)')
  assert.ok(bad(mk({ price: 4800, currency: 'USD', shipping: { fee: 0, courier: ph, leadDays: 3, freeThreshold: 80 } })).some((p) => /invented-fact/.test(p)), '무료배송 기준도 최소 단위여야 한다(80 → 8000)')
  assert.ok(bad(mk({ price: 4800 })).some((p) => /\[currency\].*USD/.test(p)), '통화를 빼면(KRW 기본값) $ 브리프와 어긋난다')
  assert.ok(bad(mk({ price: 4800, currency: 'KRW' })).some((p) => /\[currency\]/.test(p)), 'KRW 로 쓰면 어긋난다')
  assert.ok(bad(mk({ price: 5100, currency: 'USD' })).some((p) => /invented-fact/.test(p)), '브리프에 없는 가격은 여전히 떨어진다')
  // 원화 브리프는 통화를 안 적어도(기본 KRW) 통과하고, USD 로 적으면 어긋난다
  const ko = setup({ topic: '린넨 앞치마', archetype: 'detail', locale: 'ko', facts: { name: '린넨 앞치마', price: '29,000원', seller: '결이 공방', bizNo: '123-45-67890' } }).request
  const koC = (product) => validateContent(ko, { archetype: 'detail', locale: 'ko', product: { name: '린넨 앞치마', taxIncluded: true, ...product } }).filter((p) => /\[currency\]|invented-fact/.test(p))
  assert.deepEqual(koC({ price: 29000 }), [])
  assert.ok(koC({ price: 29000, currency: 'USD' }).some((p) => /\[currency\]/.test(p)))
})

test('validate: saas price 사실이 부가세 포함·별도를 말하면 요금제 vatIncluded 가 그 값이어야 한다 — 말하지 않으면 요구하지 않는다(P3-3 Task 14b)', () => {
  const mk = (price) => setup({ topic: '예약 도구', archetype: 'saas', locale: 'ko', facts: { name: '예약노트', bizNo: '123-45-67890', email: 'hello@example.com', price, address: '서울특별시 마포구 예시로 12', phone: '02-1234-5678', productUrl: 'https://x.example.com' } }).request
  const base = (vat) => ({ archetype: 'saas', locale: 'ko', plans: [{ name: '월', monthlyPrice: 9900, currency: 'KRW', features: [], ...(vat === undefined ? {} : { vatIncluded: vat }) }], slots: { copy: [], images: [] } })
  const vat = (request, c) => validateContent(request, c).filter((p) => /^\[vat\]/.test(p))
  const incl = mk('월 9,900원(부가세 포함)')
  assert.equal(vat(incl, base(true)).length, 0, '포함 + true')
  assert.equal(vat(incl, base()).length, 1, '포함인데 칸이 없다')
  assert.equal(vat(incl, base(false)).length, 1, '포함인데 false')
  const excl = mk('월 9,900원, 부가세 별도')
  assert.equal(vat(excl, base(false)).length, 0, '별도 + false')
  assert.equal(vat(excl, base(true)).length, 1, '별도인데 true')
  assert.equal(vat(mk('월 9,900원'), base()).length, 0, '세금 사실이 없으면 요구하지 않는다')
  assert.equal(vat(mk('$9 per month including VAT'), base(true)).length, 0, '영어 포함')
  // 영어의 다른 말투(골든 saas-en 「VAT not included」가 감지되지 않아 요금제에 세금 표기가 빠졌다)
  for (const t of ['Pro $12 per month; VAT not included', 'Pro $12 per month, VAT is extra', 'Pro $12 per month (prices exclude VAT)', 'Pro $12 per month, tax not included', 'Pro $12 per month, not including VAT']) {
    assert.equal(vat(mk(t), base()).length, 1, `${t} — 별도인데 칸이 없다`)
    assert.equal(vat(mk(t), base(false)).length, 0, `${t} — 별도 + false`)
    assert.equal(vat(mk(t), base(true)).length, 1, `${t} — 별도인데 true`)
  }
  for (const t of ['Pro $12 per month, VAT included', 'Pro $12 per month, tax is included', 'Pro $12 per month, all prices include VAT']) {
    assert.equal(vat(mk(t), base(true)).length, 0, `${t} — 포함 + true`)
    assert.equal(vat(mk(t), base()).length, 1, `${t} — 포함인데 칸이 없다`)
  }
})

test('schema: detail 콘텐츠는 판매자 사업자 정보(business)를 잃지 않는다 — 스키마에 없으면 파싱이 조용히 지워 푸터·법정 쪽이 「확인 필요」가 된다(P3-3 Task 14b)', () => {
  const b = { name: '결이 공방', bizRegNo: '123-45-67890', address: '서울특별시 마포구 월드컵로 120', phone: '02-1234-5678', email: 'hello@example.com' }
  const parsed = loadContentSchema('detail').safeParse({ archetype: 'detail', locale: 'ko', business: b, product: { name: 'x', price: 1000, taxIncluded: true, shipping: { fee: 0, courier: 'CJ', leadDays: 1 }, returns: { feePayer: 'buyer', withdrawalDays: 7 } }, notice: { category: 'c', rows: [{ label: 'a', value: 'b' }] } })
  assert.equal(parsed.success, true, JSON.stringify(parsed.error?.issues))
  assert.equal(parsed.data.business.name, '결이 공방')
})

// ─── 회사 정보 뿌리가 원형마다 다르다(P4GR 골든 실측 — 문구 에이전트가 brand·public·commerce 에서 막히거나 값을 정했다) ───

const roleBrief = (archetype, facts, locale = 'ko') => ({ topic: `${archetype} 시험`, archetype, locale, facts })

test('P4GR factPath: 회사 정보 뿌리 — brand = organization · public = agency(이름·주소·대표전화만) · dashboard·portfolio·pwa = facts(스키마에 회사 정보 칸이 없다)', () => {
  assert.deepEqual(factPath('brand', 'email'), ['organization', 'email'])
  assert.deepEqual(factPath('brand', 'bizNo'), ['organization', 'bizRegNo'])
  assert.deepEqual(factPath('public', 'name'), ['agency', 'name'])
  assert.deepEqual(factPath('public', 'phone'), ['agency', 'mainPhone'])
  assert.deepEqual(factPath('public', 'email'), ['facts', 'email'])
  for (const id of ['dashboard', 'portfolio', 'pwa']) assert.deepEqual(factPath(id, 'email'), ['facts', 'email'], id)
  // 옛 뿌리를 쓰는 원형은 그대로
  for (const id of ['commerce', 'detail', 'local', 'saas']) assert.deepEqual(factPath(id, 'email'), ['business', 'email'], id)
  // 씨앗도 같은 자리에 둔다 — 스키마가 모르는 최상위 칸 business 를 만들지 않는다
  const facts = { name: 'N', email: 'a@b.co', phone: '02-1234-5678', address: 'A' }
  for (const [id, a] of Object.entries(archetypes)) {
    const { content } = briefToSeed(roleBrief(id, facts), a)
    const schemaTop = Object.keys(loadContentSchema(id).shape)
    for (const k of Object.keys(content)) assert.ok(schemaTop.includes(k) || k === 'facts', `${id}: 씨앗의 최상위 칸 ${k} 는 스키마에 없다`)
  }
})

test('P4GR request: brand — 회사 정보는 organization 에, 필수인데 사실이 없는 공식 회사명·대표 주소·전화·메일도 missing 에 올라 자리 표시를 받는다(business 칸을 쓰라고 하지 않는다)', () => {
  const r = setup(roleBrief('brand', { name: '솔결재', tagline: '한옥 찻집' })).request
  assert.equal(r.seedContent.business, undefined)
  assert.equal(r.seedContent.organization.name, '솔결재')
  for (const name of ['organization.url', 'legalName', 'address', 'phone', 'email']) assert.ok(r.missing.includes(name), `${name} 가 missing 에 없다: ${r.missing}`)
  assert.deepEqual(r.factPaths['organization.url'], ['organization', 'url'])
  assert.deepEqual(r.factPaths.address, ['organization', 'address'])
  assert.deepEqual(r.factPaths.email, ['organization', 'email'])
  // 사실이 있으면 오르지 않는다
  const full = setup(roleBrief('brand', { name: '솔결재', legalName: '솔결재 주식회사', email: 'hello@example.com', address: '전주시 완산구 예시로 1', phone: '063-123-4567', companyUrl: 'https://example.com' })).request
  assert.deepEqual(full.missing, [])
})

test('P4GR validate: brand — organization 에 자리 표시를 쓰면 통과하고, 예전처럼 business 에 쓰면 알 수 없는 최상위 칸으로 떨어진다(음성 대조)', () => {
  const s = setup(roleBrief('brand', { name: '솔결재', tagline: '한옥 찻집' }))
  const ph = PH.ko
  const org = { name: '솔결재', legalName: ph, address: ph, phone: ph, email: ph, url: ph }
  const base = {
    archetype: 'brand', locale: 'ko', tagline: '한옥에서 차 한 잔', organization: org, facts: { ...s.request.seedContent.facts },
    slots: { copy: s.request.slots.map((x) => ({ id: x.id, role: x.role, text: x.placeholder ? ph : x.id === 'tagline' ? '한옥에서 차 한 잔' : '자세한 내용은 문의해 주세요.' })), images: [] },
  }
  const hard = (c) => validateContent(s.request, c).filter((p) => /^\[(placeholder|schema)\]/.test(p))
  assert.deepEqual(hard(base), [])
  const { organization, ...rest } = base
  assert.ok(has(hard({ ...rest, business: org }), /알 수 없는 최상위 칸/), '옛 방식(business 칸)이 통과했다')
})

test('P4GR request: commerce — 공정위 조회·약관·처리방침 주소와 택배사가 필수인데 사실이 없으면 missing 에 오른다(문구 에이전트가 임의로 채우지 않는다)', () => {
  const base = { name: '하루볶음', legalName: '하루볶음 커피로스터스', representative: '이서준', bizNo: '123-45-67890', mailOrderNo: '2026-서울성동-0456', address: '서울특별시 성동구 예시로 12', phone: '02-1234-5678', email: 'hello@example.com', shipping: '배송비 3,500원', shippingFee: '3,500원', products: '원두', bestsellers: '하루 블렌드 13,000원' }
  const r = setup(roleBrief('commerce', base)).request
  for (const name of ['business.ftcLookupUrl', 'business.termsUrl', 'business.privacyUrl', 'shipping.courier']) assert.ok(r.missing.includes(name), `${name}: ${r.missing}`)
  assert.deepEqual(r.factPaths['business.termsUrl'], ['business', 'termsUrl'])
  const given = setup(roleBrief('commerce', { ...base, ftcLookupUrl: 'https://www.ftc.go.kr/example', termsUrl: 'https://example.com/terms', privacyUrl: 'https://example.com/privacy', courier: '예시택배' })).request
  assert.deepEqual(given.missing, [])
})

test('P4GR request: public — 처리방침 링크는 사이트맵의 법정 쪽 경로를 씨앗에서 잇고, 전화 안내·접근성 정책·저작권 문구는 사실이 없으면 missing(자리 표시)', () => {
  const r = setup(roleBrief('public', { name: '해오름구립도서관', address: '서울특별시 해오름구 예시로 100', phone: '02-1234-5678', email: 'hello@example.com' })).request
  assert.equal(r.seedContent.agency.privacyPolicyUrl, '/privacy')
  assert.equal(r.seedContent.agency.mainPhone, '02-1234-5678')
  assert.equal(r.seedContent.business, undefined)
  for (const name of ['agency.phoneNote', 'agency.accessibilityPolicyUrl', 'agency.copyright']) assert.ok(r.missing.includes(name), `${name}: ${r.missing}`)
  assert.deepEqual(r.factPaths['agency.accessibilityPolicyUrl'], ['agency', 'accessibilityPolicyUrl'])
})

test('P4GR request: dashboard·portfolio·pwa — 이름·메일이 없으면 facts 자리에 자리 표시를 쓴다(회사 정보 칸이 없는 원형)', () => {
  for (const id of ['dashboard', 'portfolio', 'pwa']) {
    const r = setup(roleBrief(id, { name: '시험' })).request
    assert.ok(r.missing.includes('email'), `${id}: ${r.missing}`)
    assert.deepEqual(r.factPaths.email, ['facts', 'email'], id)
    assert.equal(r.seedContent.business, undefined, id)
  }
})
