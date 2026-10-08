// FIT-3 F2 — 대화로 브랜드 색·서체를 받는다(brief.brand.colors · brief.brand.fonts). 서버·Chrome 없음.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadBriefObject } from '../stamp/brief.mjs'
import { INTAKE_ARCHETYPES, questionsFor } from './questions.mjs'
import { missingFacts, toBrief, toBriefReport } from './to-brief.mjs'

const ANS = { name: '새벽빵', audience: '출근길 직장인', action: '전화 예약', contact: '02-0000-0000', logo: 'logo.svg', mood: '따뜻한', hours: '매일 07:00-20:00' }
const make = (extra) => ({ topic: '동네 빵집', archetype: 'local', answers: { ...ANS, ...extra } })

test('질문: 모든 원형에서 mood 바로 뒤에 brandColors · brandFonts 가 온다(앞 6개 순서는 그대로)', () => {
  for (const a of INTAKE_ARCHETYPES) {
    const q = questionsFor(a)
    assert.deepEqual(q.slice(0, 8).map((x) => x.id), ['name', 'audience', 'action', 'contact', 'logo', 'mood', 'brandColors', 'brandFonts'], a)
    assert.match(q[6].ask, /색 코드로 최대 3개.*#0B6E4F.*비워 두세요/, a)
    assert.match(q[7].ask, /서체.*제목용·본문용 순서.*비워 두세요/, a)
  }
})

test('색: 올바른 hex(#rgb·#rrggbb, 대소문자 무관) 최대 3개만 brief.brand.colors 로 간다 · 로고와 같은 brand 객체에 합친다', () => {
  const b = toBrief(make({ brandColors: '#0b6e4f, #F7F3EA  #abc' }))
  assert.deepEqual(b.brand.colors, ['#0b6e4f', '#F7F3EA', '#abc'])
  assert.ok(b.brand.logo, '로고와 같은 brand 객체')
  assert.doesNotThrow(() => loadBriefObject(b))
  // 4개째부터는 받지 않고 알린다
  const r = toBriefReport(make({ brandColors: '#111111 #222222 #333333 #444444' }))
  assert.deepEqual(r.brief.brand.colors, ['#111111', '#222222', '#333333'])
  assert.equal(r.unread.length, 1)
  assert.equal(r.unread[0].id, 'brandColors')
})

test('색: hex 가 아닌 답(「초록」)은 지어내 바꾸지 않고 brief 에 넣지 않는다 — unread 로 돌려 에이전트가 코드로 다시 묻게 한다', () => {
  const r = toBriefReport(make({ brandColors: '초록' }))
  assert.equal(r.brief.brand?.colors, undefined)
  assert.deepEqual(r.unread, [{ id: 'brandColors', answer: '초록', why: '색 코드가 아님' }])
  // 섞인 답: hex 는 받고 나머지 낱말만 되돌린다. 5자리 hex 처럼 틀린 코드도 받지 않는다
  const m = toBriefReport(make({ brandColors: '초록, #0B6E4F, #12345' }))
  assert.deepEqual(m.brief.brand.colors, ['#0B6E4F'])
  assert.deepEqual(m.unread, [{ id: 'brandColors', answer: '초록, #12345', why: '색 코드가 아님' }])
  // toBrief 는 예전처럼 브리프만 돌려준다
  assert.equal(toBrief(make({ brandColors: '초록' })).brand?.colors, undefined)
})

test('서체: 이름을 제목·본문 순서로 brief.brand.fonts 에 싣는다 · 셋째부터는 받지 않고 알린다', () => {
  const b = toBrief(make({ brandFonts: 'Fraunces, Pretendard' }))
  assert.deepEqual(b.brand.fonts, ['Fraunces', 'Pretendard'])
  assert.doesNotThrow(() => loadBriefObject(b))
  const r = toBriefReport(make({ brandFonts: 'A서체 / B서체 / C서체' }))
  assert.deepEqual(r.brief.brand.fonts, ['A서체', 'B서체'])
  assert.equal(r.unread[0]?.id, 'brandFonts')
})

test('빈 답·「없음」은 지금처럼 빈 값이고, 두 칸은 필수 사실이 아니라 missing·previewOnly 를 바꾸지 않는다', () => {
  const full = toBrief(make({}))
  for (const empty of [undefined, '', '  ', '없음', 'none']) {
    assert.deepEqual(toBrief(make({ brandColors: empty, brandFonts: empty })), full, JSON.stringify(empty))
  }
  assert.equal(full.previewOnly, undefined)
  assert.deepEqual(missingFacts(full), [])
  const withBrand = toBrief(make({ brandColors: '#0B6E4F', brandFonts: 'Fraunces' }))
  assert.deepEqual(missingFacts(withBrand), [])
  assert.equal(withBrand.previewOnly, undefined)
  assert.deepEqual(toBriefReport(make({})).unread, [])
  // 로고가 없고 색만 있어도 brand 객체는 색만 갖는다
  const onlyColors = toBrief({ ...make({ brandColors: '#0B6E4F' }), answers: { name: '새벽빵', brandColors: '#0B6E4F' } })
  assert.deepEqual(onlyColors.brand, { colors: ['#0B6E4F'] })
})
