// 사전 틀 펼치기(factory/vocab/expand.mjs)와 yaml 틀 데이터(expansions). 틀로 줄인 사전이 줄이기 전과 같은 낱말·막는 말을 내는지 지문으로 고정한다.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { parse } from 'yaml'
import { expand } from '../vocab/expand.mjs'
import { AXES, DEFAULT_FILE, LexiconError, loadLexicon } from '../vocab/lexicon.mjs'
import { normalize } from '../vocab/normalize.mjs'

// 틀로 줄이기 전(커밋 f4bfaba8)의 사전이 해석기에 주던 낱말·막는 말의 지문. 줄 하나 = 「항목 id, 갈래(ko|en|not), 정규화한 낱말」. 목록 대신 개수와 해시만 둔다.
const SNAPSHOT = { count: 38248, sha256: 'ea576dcb14695397d609e8527416982e344f0cd45570286b170c7987aac1b517' }

function fingerprint(lex) {
  const lines = []
  for (const e of lex.entries) {
    for (const k of new Set((e.match.ko ?? []).map((w) => normalize(w).compact).filter(Boolean))) lines.push(`${e.id}\tko\t${k}`)
    for (const k of new Set((e.match.en ?? []).map((w) => w.trim().toLowerCase()).filter(Boolean))) lines.push(`${e.id}\ten\t${k}`)
    for (const k of new Set((e.not ?? []).map((w) => normalize(w).compact).filter(Boolean))) lines.push(`${e.id}\tnot\t${k}`)
  }
  return { count: lines.length, sha256: createHash('sha256').update(lines.sort().join('\n')).digest('hex') }
}

test('틀로 펼친 사전의 낱말·막는 말이 줄이기 전과 같다(개수와 해시)', () => {
  assert.deepEqual(fingerprint(loadLexicon()), SNAPSHOT)
})

test('실제 yaml 에 손으로 쓴 not 은 틀이 만들지 못하는 말만 남는다', () => {
  const doc = parse(readFileSync(DEFAULT_FILE, 'utf8'))
  const literal = doc.entries.reduce((n, e) => n + (e.not?.length ?? 0), 0)
  const expanded = loadLexicon().entries.reduce((n, e) => n + (e.not?.length ?? 0), 0)
  assert.ok(literal < 1000, `손으로 쓴 not 이 ${literal}개다 — 반복되는 말은 expansions 틀로 옮긴다`)
  assert.ok(expanded > 15000, `펼친 not 이 ${expanded}개로 줄었다`)
})

const entry = (id, kind, match, extra = {}) => ({ id, kind, label: id, match, ...extra })
const ex = (entries, expansions) => expand({ entries, expansions })
const byId = (r, id) => r.entries.find((e) => e.id === id)
const COPY = { nouns: ['문구', '소개 글'], forms: ['{n} {w}', '{n}도 {w}', '{n} 더 {w}'] }

test('copy: 글 이름 × 틀 × 낱말을 그 항목의 not 에 보탠다 · 낱말을 보태면 따라온다', () => {
  const r = ex([entry('warm', 'impression', { ko: ['따뜻'] }, { copyWords: ['따뜻', '포근'] })], { copy: COPY })
  assert.deepEqual(r.problems, [])
  assert.deepEqual([...byId(r, 'warm').not].sort(), ['문구 따뜻', '문구 포근', '문구 더 따뜻', '문구 더 포근', '문구도 따뜻', '문구도 포근', '소개 글 따뜻', '소개 글 포근', '소개 글 더 따뜻', '소개 글 더 포근', '소개 글도 따뜻', '소개 글도 포근'].sort())
})

test('dislike: 낱말 뒤에 싫다가 이어지는 말을 막는다', () => {
  const r = ex([entry('cramped', 'diagnosis', { ko: ['답답해'] }, { dislikeStems: ['답답해', '숨막혀'] })], { dislike: ['{w} 싫', '{w}서 싫'] })
  assert.deepEqual([...byId(r, 'cramped').not].sort(), ['답답해 싫', '답답해서 싫', '숨막혀 싫', '숨막혀서 싫'].sort())
})

test('reference: 모든 카드는 기능 이름을 막고, 짝 카드는 서로의 이름을 이은 말을 막는다', () => {
  const entries = [
    entry('ref-toss', 'reference', { ko: ['토스느낌'] }, { cardNames: ['토스', 'toss'] }),
    entry('ref-apple', 'reference', { ko: ['애플느낌'] }, { cardNames: ['애플'] }),
    entry('ref-medium', 'reference', { ko: ['미디엄스타일'] }),
  ]
  const r = ex(entries, { reference: { features: { styles: ['스타일'], nouns: ['결제'], forms: ['{s} {n}'] }, pairs: [['ref-toss', 'ref-apple']], pairForms: ['{a}이나{b}', '{a} or {b}'] } })
  assert.deepEqual(r.problems, [])
  assert.deepEqual([...byId(r, 'ref-toss').not].sort(), ['스타일 결제', '애플 or toss', '애플 or 토스', '애플이나toss', '애플이나토스'].sort())
  assert.deepEqual([...byId(r, 'ref-apple').not].sort(), ['스타일 결제', 'toss or 애플', 'toss이나애플', '토스 or 애플', '토스이나애플'].sort())
  assert.deepEqual(byId(r, 'ref-medium').not, ['스타일 결제'])
})

test('reference: 없는 카드나 cardNames 없는 카드는 problems 로 알린다', () => {
  const base = [entry('ref-a', 'reference', { ko: ['에이느낌'] }, { cardNames: ['에이'] }), entry('ref-b', 'reference', { ko: ['비느낌'] })]
  const reference = (pairs) => ({ features: { styles: ['스타일'], nouns: ['결제'], forms: ['{s} {n}'] }, pairs, pairForms: ['{a}이나{b}'] })
  assert.match(ex(base, { reference: reference([['ref-a', 'ref-none']]) }).problems.join(), /ref-none/)
  assert.match(ex(base, { reference: reference([['ref-a', 'ref-b']]) }).problems.join(), /ref-b.*cardNames/)
})

test('틀 재료가 있는데 그 틀이 없으면 problems 로 알린다', () => {
  assert.match(ex([entry('warm', 'impression', { ko: ['따뜻'] }, { copyWords: ['따뜻'] })], {}).problems.join(), /warm.*copy/)
  assert.match(ex([entry('dull', 'diagnosis', { ko: ['밋밋'] }, { dislikeStems: ['밋밋'] })], {}).problems.join(), /dull.*dislike/)
})

const LESS = { into: 'less-blocker', minStem: 2, forms: ['{w}한 거 줄', '덜 {w}'], liteForms: ['덜 {w}'] }
const lessEntries = () => [
  entry('warm', 'impression', { ko: ['따뜻', '맑', '포근 느낌'] }, { lessStems: true }),
  entry('cooler', 'axis', { ko: ['차갑', '덜 따뜻'] }, { lessLite: ['차갑'] }),
  entry('less-blocker', 'modifier', {}),
]

test('less: 항목의 낱말로 「덜 ~」 낱말을 만들어 into 항목에 넣는다 · 다른 항목이 가진 낱말과 한 글자·띄어쓰기 낱말은 뺀다', () => {
  const r = ex(lessEntries(), { less: LESS })
  assert.deepEqual(r.problems, [])
  const words = byId(r, 'less-blocker').match.ko
  assert.deepEqual([...words].sort(), ['따뜻한 거 줄', '덜 차갑'].sort()) // 「덜 따뜻」은 cooler 가 갖고, 「맑」은 한 글자, 「포근 느낌」은 띄어쓰기 낱말, 차갑은 lite 라 「덜 차갑」만
})

test('less: into 항목이 없으면 problems 로 알린다', () => {
  assert.match(ex(lessEntries().slice(0, 2), { less: LESS }).problems.join(), /less-blocker/)
})

test('끊긴 표현: 「X 나머지」가 세기 낱말에 끊긴 모양을 X 만 가진 항목의 not 에 보탠다', () => {
  const entries = [
    entry('airy', 'axis', { ko: ['여백'] }),
    entry('tight', 'axis', { ko: ['여백 줄'] }),
    entry('very', 'modifier', { ko: ['확', '많이'] }, { effect: { strength: 2 } }),
    entry('plain', 'modifier', { ko: ['그냥'] }),
  ]
  const r = ex(entries, {})
  assert.deepEqual([...byId(r, 'airy').not].sort(), ['여백 많이 줄', '여백 확 줄'].sort())
  assert.equal(byId(r, 'tight').not, undefined)
})

test('펼친 뒤 틀 재료 필드는 항목에서 지워진다 · 입력은 바뀌지 않는다', () => {
  const entries = lessEntries().map((e) => (e.id === 'warm' ? { ...e, copyWords: ['따뜻'] } : e))
  const before = JSON.stringify(entries)
  const r = ex(entries, { less: LESS, copy: COPY })
  for (const e of r.entries) for (const k of ['copyWords', 'dislikeStems', 'cardNames', 'lessStems', 'lessLite']) assert.equal(k in e, false, `${e.id}.${k}`)
  assert.equal(JSON.stringify(entries), before)
})

// ---- loadLexicon 이 틀을 펼친다 ----
const HEAD = AXES.map((a) => `  ${a}: { label: ${a}, ${['color-hue', 'type-family'].includes(a) ? 'valueLabels: { x: 엑스 }' : 'ends: [a, b]'} }`).join('\n')
function load(entriesYaml, expansionsYaml = '') {
  const dir = mkdtempSync(join(tmpdir(), 'expand-test-'))
  try {
    const f = join(dir, 'lex.yaml')
    writeFileSync(f, `axes:\n${HEAD}\nrevise: { sections: [], extraSections: [], pages: {} }\n${expansionsYaml}entries:\n${entriesYaml}\n`)
    return loadLexicon(f)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}
const WARM = `  - id: warm
    kind: impression
    label: 따뜻함
    match: { ko: ["따뜻"] }
    copyWords: ["따뜻"]
    lessStems: true
    reading: [{ axis: color-temperature, direction: b, strength: 1 }]
`
const BLOCKER = `  - id: less-blocker
    kind: modifier
    label: 덜
    match: {}
`
const EXPANSIONS = 'expansions:\n  copy: { nouns: ["문구"], forms: ["{n} {w}"] }\n  less: { into: less-blocker, minStem: 2, forms: ["덜 {w}"], liteForms: ["덜 {w}"] }\n'

test('loadLexicon: 틀 재료는 expansions 로 펼쳐지고 into 항목은 match 없이도 낱말이 채워진다', () => {
  const lex = load(WARM + BLOCKER, EXPANSIONS)
  assert.deepEqual(lex.entries[0].not, ['문구 따뜻'])
  assert.deepEqual(lex.entries[1].match.ko, ['덜 따뜻'])
})

test('loadLexicon: 다른 항목이 이미 가진 낱말은 펼침이 빼서 낱말 유일 규칙을 지킨다', () => {
  const twin = `  - id: twin\n    kind: impression\n    label: 쌍둥이\n    match: { ko: ["덜 따뜻"] }\n    reading: [{ axis: shape, direction: a, strength: 1 }]\n`
  const cool = WARM.replace('id: warm', 'id: cool').replace('따뜻함', '차가움').replaceAll('따뜻', '차갑').replace('    copyWords: ["차갑"]\n', '')
  assert.deepEqual(load(WARM + cool + BLOCKER + twin, EXPANSIONS).entries[2].match.ko, ['덜 차갑']) // 다른 항목이 가진 「덜 따뜻」은 less 틀이 뺀다
  assert.throws(() => load(WARM + cool + BLOCKER + twin.replace('"덜 따뜻"', '"차갑"'), EXPANSIONS), (e) => e instanceof LexiconError && /차갑/.test(e.message)) // 틀이 만든 게 아니라 손으로 쓴 겹침은 그대로 규칙 위반이다
})

test('loadLexicon: 틀 재료가 있는데 틀이 없으면 LexiconError', () => {
  assert.throws(() => load(WARM), (e) => e instanceof LexiconError && /copy/.test(e.message))
})
