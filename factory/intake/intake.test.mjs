// 대화형 입구(factory v1 Task 4.1, 합의안 D3·D4) — 질문 표·브리프 변환·빠진 사실 목록. 서버·Chrome 없음.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { ARCHETYPE_IDS, BriefSchema, loadBriefObject } from '../stamp/brief.mjs'
import { INTAKE_ARCHETYPES, questionsFor } from './questions.mjs'
import { missingFacts, toBrief } from './to-brief.mjs'

test('원형 10종 모두 질문 5~11개', () => {
  for (const a of ['brand', 'commerce', 'dashboard', 'detail', 'local', 'portfolio', 'public', 'pwa', 'saas', 'landing']) {
    const q = questionsFor(a)
    assert.ok(q.length >= 5 && q.length <= 11, `${a}: ${q.length}`)
  }
})

test('로고·연락처·사진이 없으면 지어내지 않고 확인 필요로 남긴다(Review Focus 1)', () => {
  const b = toBrief({ topic: '동네 빵집', archetype: 'local', answers: { name: '새벽빵', audience: '출근길 직장인', action: '전화 예약', mood: '따뜻한' } })
  assert.doesNotThrow(() => loadBriefObject(b))
  assert.deepEqual(missingFacts(b).sort(), ['business.phone', 'hours', 'logo'].sort())
  assert.ok(!JSON.stringify(b).match(/010-\d{4}-\d{4}/), '지어낸 전화번호 없음')
})

// ── 계획 시험 밖 보강 ─────────────────────────────────────────────────────────

test('질문 표: 원형 목록은 브리프 원형 10종(landing 포함) 그대로, 질문 id 는 원형 안에서 유일하고 공통 질문이 앞에 온다', () => {
  assert.deepEqual([...INTAKE_ARCHETYPES].sort(), [...ARCHETYPE_IDS].sort())
  assert.ok(ARCHETYPE_IDS.includes('landing') && ARCHETYPE_IDS.length === 10)
  for (const a of INTAKE_ARCHETYPES) {
    const q = questionsFor(a)
    assert.equal(new Set(q.map((x) => x.id)).size, q.length, `${a}: 질문 id 중복`)
    assert.deepEqual(q.slice(0, 6).map((x) => x.id), ['name', 'audience', 'action', 'contact', 'logo', 'mood'], a)
    for (const x of q) assert.ok(x.ask && /[가-힣]/.test(x.ask), `${a}.${x.id}: 한국어 질문 글이 있다`)
  }
  assert.throws(() => questionsFor('nope'), /모르는 원형/)
})

test('원형별 질문: local 은 영업시간, commerce 는 대표 상품, saas 는 요금제를 더 묻는다', () => {
  const extra = (a) => questionsFor(a).slice(8).map((x) => x.id) // 공통 6 + FIT-3 브랜드 색·서체 2 뒤
  assert.deepEqual(extra('local'), ['hours'])
  assert.deepEqual(extra('commerce'), ['bestsellers'])
  assert.deepEqual(extra('saas'), ['price'])
})

test('답이 다 있으면 빠진 사실이 없고 previewOnly 표지도 없다 · 답은 앞뒤 공백만 다듬어 그대로 싣는다', () => {
  const b = toBrief({
    topic: '동네 빵집', archetype: 'local',
    answers: { name: ' 새벽빵 ', audience: '출근길 직장인', action: '전화 예약', contact: '02-0000-0000', logo: 'C:\\내 사이트\\logo.svg', mood: '따뜻한', hours: '매일 07:00-20:00' },
  })
  assert.deepEqual(missingFacts(b), [])
  assert.equal(b.previewOnly, undefined)
  assert.equal(b.facts.name, '새벽빵')
  assert.equal(b.facts.phone, '02-0000-0000')
  assert.equal(b.brand.logo, 'C:\\내 사이트\\logo.svg')
  assert.doesNotThrow(() => loadBriefObject(b))
})

test('빈 답·「없음」류는 사실로 싣지 않는다 · 빠진 게 있으면 previewOnly 표지', () => {
  const b = toBrief({ topic: '동네 빵집', archetype: 'local', answers: { name: '새벽빵', audience: '  ', action: '없음', contact: '모름', logo: '없음', mood: '따뜻한', hours: null } })
  assert.deepEqual(Object.keys(b.facts).sort(), ['mood', 'name'])
  assert.equal(b.brand, undefined)
  assert.equal(b.previewOnly, true)
  assert.deepEqual(missingFacts(b).sort(), ['action', 'audience', 'business.phone', 'hours', 'logo'].sort())
})

test('연락처: 전화가 주 연락처인 원형(local)은 phone, 아니면 email 로 가고 @ 가 있으면 email 이다', () => {
  assert.equal(toBrief({ topic: 't', archetype: 'local', answers: { contact: '02-0000-0000' } }).facts.phone, '02-0000-0000')
  assert.equal(toBrief({ topic: 't', archetype: 'saas', answers: { contact: 'hello@example.com' } }).facts.email, 'hello@example.com')
  assert.equal(toBrief({ topic: 't', archetype: 'saas', answers: { contact: '02-0000-0000' } }).facts.phone, '02-0000-0000')
  // local 은 이메일만 받아도 전화는 비어 있다 — 사실을 바꿔 채우지 않는다
  const b = toBrief({ topic: 't', archetype: 'local', answers: { contact: 'hello@example.com' } })
  assert.equal(b.facts.email, 'hello@example.com')
  assert.ok(missingFacts(b).includes('business.phone'))
})

test('토픽이 비면 던진다 · 알 수 없는 원형은 던진다 · 알 수 없는 답 키는 버리지 않고 던진다', () => {
  assert.throws(() => toBrief({ topic: ' ', archetype: 'local', answers: {} }), /주제/)
  assert.throws(() => toBrief({ topic: 't', archetype: 'nope', answers: {} }), /모르는 원형/)
  assert.throws(() => toBrief({ topic: 't', archetype: 'local', answers: { nmae: 'x' } }), /모르는 답 칸.*nmae/)
})

test('landing: 질문은 나오고 toBrief 는 넓히기 옵션 없이 스키마를 통과한다(landing 은 BriefSchema 원형이다, Task 5.5)', () => {
  assert.ok(questionsFor('landing').length >= 5)
  const b = toBrief({ topic: '신제품 출시 이벤트', archetype: 'landing', answers: { name: '봄결', audience: '20대', action: '사전 알림 신청', mood: '산뜻한' } })
  assert.equal(b.archetype, 'landing')
  assert.ok(BriefSchema.safeParse(b).success, 'landing 브리프가 BriefSchema 를 그대로 통과한다')
  assert.doesNotThrow(() => loadBriefObject(b))
  // extraArchetypes 는 ARCHETYPE_IDS 에 없는 원형을 시험용으로 넓힐 때만 남아 있다
  const odd = { ...b, archetype: 'zzz' }
  assert.throws(() => loadBriefObject(odd), /archetype/)
  assert.doesNotThrow(() => loadBriefObject(odd, { extraArchetypes: ['zzz'] }))
  assert.ok(missingFacts(b).includes('logo'))
})

// ── loadBriefObject (brief.mjs 새 내보내기) ───────────────────────────────────

test('loadBriefObject: 파일 로더와 같은 스키마 — 틀린 브리프는 칸 이름을 붙여 던지고, 맞는 것은 같은 값을 돌려준다', () => {
  const ok = { topic: '주제', archetype: 'saas', locale: 'ko', facts: { name: 'x' } }
  assert.deepEqual(loadBriefObject(ok), ok)
  assert.throws(() => loadBriefObject({ ...ok, topic: '' }), /브리프 모양이 틀렸다.*topic/)
  assert.throws(() => loadBriefObject({ ...ok, extra: 1 }), /브리프 모양이 틀렸다/)
  assert.throws(() => loadBriefObject({ ...ok, archetype: 'zzz' }), /원형\(archetype\)/)
  assert.throws(() => loadBriefObject(null), /브리프 모양이 틀렸다/)
  assert.throws(() => loadBriefObject({ ...ok, locale: 'jp' }, { label: '대화 입구' }), /\(대화 입구\)/)
})

// ── 흐름 5 Task 5.16 — 입구가 필요한 사진 수·권장 구도를 먼저 알린다(design-imagery-real) ─────────────────────

// 원형 JSON 의 imageSlots 에서 real-required 를 센다 — 같은 쪽·구획·칸 id 는 하나, 로고 칸(…logo)은 사진이 아니라 세지 않는다.
const photoSlots = (archetype) => {
  const j = JSON.parse(readFileSync(new URL(`../../registry/factory/archetypes/${archetype}.json`, import.meta.url), 'utf8'))
  const seen = new Map()
  for (const p of j.pages) for (const s of p.sections) for (const i of s.imageSlots) if (i.source === 'real-required' && !/logo/i.test(i.id)) seen.set(`${p.id}/${s.kind}/${i.id}`, i.aspect)
  return [...seen.values()]
}

test('실사 칸이 있는 원형은 입구가 필요한 사진 수를 알린다 — 로고 질문 바로 뒤, 원형 10종 모두', () => {
  for (const a of ARCHETYPE_IDS) {
    const q = questionsFor(a)
    const logo = q.find((x) => x.logo)
    const n = photoSlots(a).length
    assert.ok(n > 0, `${a}: real-required 사진 칸이 있다`)
    assert.match(logo.ask, new RegExp(`사진 ${n}장`), `${a}: 사진 ${n}장`)
    assert.match(logo.ask, /권장 구도/, a)
    assert.equal(q.filter((x) => /사진 \d+장/.test(x.ask)).length, 1, `${a}: 안내는 한 곳`)
  }
  assert.ok(questionsFor('local').some((q) => /사진 \d+장/.test(q.ask)))
})

test('사진 안내 수는 원형마다 다르다(고정 문구가 아니다) · 구도는 비율에서 나온다 · 질문 수·id 는 그대로다', () => {
  const nums = new Set(ARCHETYPE_IDS.map((a) => /사진 (\d+)장/.exec(questionsFor(a).find((x) => x.logo).ask)[1]))
  assert.ok(nums.size >= 4, [...nums].join())
  const local = questionsFor('local').find((x) => x.logo).ask
  assert.match(local, /가로 16:9/)
  assert.match(local, /정사각 1:1/)
  assert.equal(questionsFor('local').length, 9)
  assert.deepEqual(questionsFor('local').slice(0, 6).map((x) => x.id), ['name', 'audience', 'action', 'contact', 'logo', 'mood'])
})

test('사진 안내 줄은 답 칸이 아니다 — 로고 답은 그대로 brand.logo 로 가고 안내 글자는 브리프에 들어가지 않는다', () => {
  const b = toBrief({ topic: '동네 빵집', archetype: 'local', answers: { name: '새벽빵', logo: 'C:\\내 사이트\\logo.svg' } })
  assert.equal(b.brand.logo, 'C:\\내 사이트\\logo.svg')
  assert.doesNotMatch(JSON.stringify(b), /사진 \d+장|권장 구도/)
})
