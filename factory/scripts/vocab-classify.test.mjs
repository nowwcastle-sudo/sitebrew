// 대략 분류 classify — 사전이 잡으면 그대로(kind·lead 포함), 못 잡으면 비슷한 예문(near), 그것도 없으면 모름.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { classify, examplesFrom, expectedLeads, listsOf } from '../vocab/classify.mjs'
import { loadLexicon } from '../vocab/lexicon.mjs'

const lex = loadLexicon()
const CFG = { minScore: 0.5, topK: 2 }
const lead = (axis, direction) => ({ axis, direction })
const ex = (id, text, kind, l) => ({ id, text, kind, lead: l })
const R = (axis, direction, extra = {}) => ({ axis, direction, strength: 1, scope: 'site', ...extra })

test('사전이 잡은 문장은 interpret 결과 그대로 + kind·lead (예문은 쓰지 않는다)', () => {
  const r = classify('글씨 크게', lex, [ex('e1', '글씨 크게', 'impression', lead('motion', 'dynamic'))], CFG)
  assert.equal(r.result, 'confirmed')
  assert.equal(r.kind, 'axis')
  assert.deepEqual(r.lead, lead('type-scale', 'larger'))
})

test('사전에 안 맞은 문장 → near: 첫 후보의 kind·lead, 후보는 점수 큰 순서로 최대 topK', () => {
  const examples = [
    ex('e1', '가나다라마바사', 'impression', lead('spacing', 'airy')),
    ex('e2', '가나다라마바', 'axis', lead('shape', 'round')),
    ex('e3', '가나다라마', 'diagnosis', lead('depth', 'flat')),
  ]
  const r = classify('가나다라마바', lex, examples, CFG)
  assert.equal(r.result, 'near')
  assert.deepEqual(r.nearest.map((x) => x.id), ['e2', 'e1'], 'topK 2')
  assert.equal(r.kind, 'axis')
  assert.deepEqual(r.lead, lead('shape', 'round'))
  assert.ok(r.ask, '되물을 말도 남긴다')
})

test('후보 둘의 대표 읽기가 달라도 둘 다 nearest 에 남고 lead 는 첫 후보', () => {
  const examples = [ex('a', '가나다라마바', 'impression', lead('spacing', 'airy')), ex('b', '가나다라마바사', 'impression', lead('depth', 'flat'))]
  const r = classify('가나다라마바', lex, examples, CFG)
  assert.deepEqual(r.nearest.map((x) => x.lead), [lead('spacing', 'airy'), lead('depth', 'flat')])
  assert.deepEqual(r.lead, lead('spacing', 'airy'))
})

test('기준값을 넘는 예문이 없으면 그대로 모름', () => {
  const r = classify('가나다라마바', lex, [ex('e1', '힣힣힣힣힣', 'axis', lead('shape', 'round'))], CFG)
  assert.equal(r.result, 'unknown')
  assert.equal(classify('가나다라마바', lex, [], CFG).result, 'unknown')
})

test('낱말은 맞았는데 부딪치는 문장은 예문으로 넘기지 않고 되묻는다', () => {
  const r = classify('밝고 어둡게', lex, [ex('e1', '밝고 어둡게', 'axis', lead('color-lightness', 'bright'))], CFG)
  assert.equal(r.result, 'unknown')
})

test('expectedLeads: 확정형은 첫 읽기 하나 · 후보 둘은 목록마다 첫 읽기 · ask 는 없음', () => {
  assert.deepEqual(expectedLeads([R('shape', 'round'), R('depth', 'flat')]), [lead('shape', 'round')])
  assert.deepEqual(expectedLeads({ two: [[R('spacing', 'airy')], [R('motion', 'static'), R('depth', 'flat')]] }), [lead('spacing', 'airy'), lead('motion', 'static')])
  assert.deepEqual(expectedLeads('ask'), [])
  assert.deepEqual(expectedLeads([]), [])
  assert.deepEqual(expectedLeads([{ axis: 'type-family', value: 'mono', strength: 1 }]), [{ axis: 'type-family', value: 'mono' }], '값 읽기는 value')
})

test('examplesFrom: 정답에 읽기가 있고 probe 가 아닌 줄만 · 후보 둘 정답은 첫 목록의 대표 읽기', () => {
  const rows = [
    { id: 'a', text: '둥글게', kind: 'axis', expect: [R('shape', 'round')] },
    { id: 'b', text: '모름', kind: 'none', expect: 'ask' },
    { id: 'c', text: '답답해', kind: 'diagnosis', expect: { two: [[R('spacing', 'airy')], [R('type-scale', 'smaller')]] } },
    { id: 'd', text: '프로브', kind: 'axis', expect: [R('shape', 'round')], probe: true },
  ]
  assert.deepEqual(examplesFrom(rows), [
    { id: 'a', text: '둥글게', kind: 'axis', lead: lead('shape', 'round') },
    { id: 'c', text: '답답해', kind: 'diagnosis', lead: lead('spacing', 'airy') },
  ])
})

test('listsOf: 확정 = 목록 하나 · 후보 둘 = 목록 둘 · ask 와 빈 정답은 빈 목록', () => {
  const a = [{ axis: 'spacing', direction: 'airy' }]
  const b = [{ axis: 'spacing', direction: 'tight' }]
  assert.deepEqual(listsOf(a), [a])
  assert.deepEqual(listsOf({ two: [a, b] }), [a, b])
  assert.deepEqual(listsOf('ask'), [])
  assert.deepEqual(listsOf(undefined), [])
})
