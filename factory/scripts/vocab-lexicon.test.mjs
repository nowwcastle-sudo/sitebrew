// 디자인 어휘 사전 원본(factory/vocab/design-lexicon.yaml)과 검증 로더(lexicon.mjs).
// 파일 규칙(축·세기·범위 모양)은 zod, 항목 사이 규칙(낱말 유일·축 수·축 겹침·방향 어휘)은 따로 본다.
// 위반은 LexiconError.ids(문제 항목 id)로 확인한다 — 메시지 글자가 아니라 어느 항목이 걸렸는지를 고정한다.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AXES, KINDS, LexiconError, loadLexicon } from '../vocab/lexicon.mjs'
import { normalize } from '../vocab/normalize.mjs'

// 시험용 사전의 축 12개. ends 가 있는 축은 시험이 쓰는 방향 id 를 함께 둔다(실제 사전과 같은 id).
const ENDS = {
  'color-lightness': ['dark', 'bright'], 'color-saturation': ['muted', 'vivid'], 'color-temperature': ['cool', 'warm'],
  'palette-count': ['fewer', 'more'], contrast: ['soft', 'crisp'], 'type-scale': ['smaller', 'larger'],
  spacing: ['tight', 'airy'], shape: ['sharp', 'round'], depth: ['flat', 'lifted'], motion: ['static', 'dynamic'],
}
const axisLine = (a) => (ENDS[a] ? `  ${a}: { label: ${a}, ends: [${ENDS[a].join(', ')}] }` : `  ${a}: { label: ${a}, valueLabels: { some-value: 어떤 값, distinctive: 독특한 글꼴, blue: 파랑 } }`)
const HEAD = AXES.map(axisLine).join('\n')
const REVISE = 'revise:\n  sections: []\n  extraSections: []\n  pages: {}\n' // 구획·쪽 이름표가 필요 없는 시험용 사전의 빈 이름표
const lexOf = (entriesYaml, head = HEAD) => `axes:\n${head}\n${REVISE}entries:\n${entriesYaml}\n`
const entry = (id, words, reading, extra = '') =>
  `  - id: ${id}\n    kind: impression\n    label: ${id}\n    match: { ko: [${words.join(', ')}] }\n    reading: ${reading}\n${extra}`
// 그 축에서 유효한 reading 한 칸(플러스 끝 방향 · 값 축은 value)
const r = (axis, strength = 1) => (ENDS[axis]
  ? `{ axis: ${axis}, direction: ${ENDS[axis][1]}, strength: ${strength} }`
  : `{ axis: ${axis}, value: some-value, strength: ${strength} }`)

function withFile(yaml, fn) {
  const dir = mkdtempSync(join(tmpdir(), 'lexicon-test-'))
  try {
    const f = join(dir, 'lex.yaml')
    if (yaml !== null) writeFileSync(f, yaml)
    return fn(f)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}
const load = (yaml) => withFile(yaml, loadLexicon)
/** 던져야 하는 사전. LexiconError 인지 확인하고 { ids(정렬), message } 를 돌려준다. */
function fails(yaml) {
  try { load(yaml) } catch (e) {
    assert.ok(e instanceof LexiconError, `LexiconError 가 아니다: ${e}`)
    return { ids: [...e.ids].sort(), message: e.message }
  }
  return assert.fail('던져야 하는 사전이 통과했다')
}

test('사전 파일이 규칙대로 읽힌다', () => {
  const lex = loadLexicon()
  assert.deepEqual(Object.keys(lex.axes), [...AXES])
  assert.equal(AXES.length, 12)
  assert.deepEqual([...KINDS], ['modifier', 'reference', 'diagnosis', 'impression', 'axis'])
  assert.ok(lex.entries.length >= 14)
  assert.deepEqual(lex.axes.motion.order, ['M0', 'M1', 'M2', 'M3'])
  assert.deepEqual(lex.axes.shape.order, ['R0', 'R1', 'R2', 'R3'])
  assert.deepEqual(lex.axes['type-scale'].order, ['D1', 'D2', 'D3'])
})

test('방향 어휘는 축의 ends id 둘이고, 색·글꼴 축은 ends 가 없다', () => {
  const lex = loadLexicon()
  assert.deepEqual(lex.axes.spacing.ends, ['tight', 'airy'])
  assert.deepEqual(lex.axes['type-scale'].ends, ['smaller', 'larger'])
  assert.deepEqual(lex.axes.spacing.endLabels, ['빽빽하게', '시원하게'])
  assert.equal(lex.axes['color-hue'].ends, undefined)
  assert.equal(lex.axes['type-family'].ends, undefined)
  for (const e of lex.entries) {
    for (const x of [...(e.reading ?? []), ...(e.causes ?? []).flatMap((c) => c.reading)]) {
      assert.ok(x.direction !== undefined || x.value !== undefined, `${e.id}: direction·value 둘 다 없다`)
      if (x.direction !== undefined) assert.ok(lex.axes[x.axis].ends.includes(x.direction), `${e.id}: ${x.axis} ${x.direction}`)
    }
  }
})

test('분위기 13묶음이 impression 으로 옮겨졌다', () => {
  const lex = loadLexicon()
  const imp = lex.entries.filter((e) => e.kind === 'impression')
  assert.equal(imp.filter((e) => e.mood).length, 13, 'mood 가 있는 옛 13묶음(MOOD_TABLE 의 원천) — 새 인상 묶음(7b)에는 mood 를 달지 않는다')
  assert.ok(imp.some((e) => e.id === 'modern'))
  assert.ok(imp.length >= 30, '인상 묶음은 약 30개(7b)')
  const refined = lex.entries.find((e) => e.id === 'refined')
  assert.deepEqual(refined.mood.recipeTokens, ['절제된 고급', '정제', '지면', '여백'])
  assert.ok(refined.reading.some((x) => x.axis === 'spacing' && x.direction === 'airy' && x.strength === 1))
})

test('모던 은 confidence low 에 원인 2개를 갖고, dark 에는 모던이 없다', () => {
  const lex = loadLexicon()
  const modern = lex.entries.find((e) => e.id === 'modern')
  assert.equal(modern.confidence, 'low')
  assert.equal(modern.causes.length, 2)
  const dark = lex.entries.find((e) => e.id === 'dark')
  assert.ok(!dark.match.ko.includes('모던') && !dark.match.en.includes('modern'))
})

test('낱말은 한 항목에만 속한다', () => {
  const yaml = lexOf(entry('a', ['고급'], `[${r('spacing')}]`) + entry('b', ['고급'], `[${r('contrast')}]`))
  assert.deepEqual(fails(yaml).ids, ['a', 'b'])
})

test('정규화한 형태가 같아도 같은 낱말이다(「깔끔」과 「깔끔하게」)', () => {
  const yaml = lexOf(entry('a', ['깔끔'], `[${r('spacing')}]`) + entry('b', ['깔끔하게'], `[${r('contrast')}]`))
  assert.deepEqual(fails(yaml).ids, ['a', 'b'])
})

test('reading 축은 1~4개', () => {
  const five = ['spacing', 'contrast', 'depth', 'motion', 'shape'].map((a) => r(a)).join(', ')
  assert.deepEqual(fails(lexOf(entry('big', ['큼'], `[${five}]`))).ids, ['big'])
  assert.deepEqual(fails(lexOf(entry('none', ['없음'], '[]'))).ids, ['none'])
})

test('reading 축 3개 이상 같은 두 항목은 합쳐야 한다', () => {
  const three = ['spacing', 'contrast', 'depth']
  const yaml = lexOf(entry('x', ['가나'], `[${three.map((a) => r(a)).join(', ')}]`) + entry('y', ['다라'], `[${[...three, 'motion'].map((a) => r(a)).join(', ')}]`))
  assert.deepEqual(fails(yaml).ids, ['x', 'y'])
})

test('축 2개만 겹치면 통과한다', () => {
  const yaml = lexOf(entry('x', ['가나'], `[${r('spacing')}, ${r('contrast')}]`) + entry('y', ['다라'], `[${r('spacing')}, ${r('contrast')}, ${r('motion')}]`))
  assert.doesNotThrow(() => load(yaml))
})

test('causes 는 축 겹침(≥3) 규칙에서 빠진다 — 보여 주며 묻는 항목은 서로 겹친다', () => {
  const three = ['spacing', 'contrast', 'depth'].map((a) => r(a)).join(', ')
  const cause = `{ reading: [${three}], say: 이렇게 이해했어요. }`
  const low = (id, word) => `  - id: ${id}\n    kind: impression\n    label: ${id}\n    match: { ko: [${word}] }\n    confidence: low\n    causes: [${cause}, ${cause}]\n`
  assert.doesNotThrow(() => load(lexOf(low('p', '가나') + low('q', '다라'))))
})

test('모르는 축·범위는 zod 가 걸러 id 로 짚는다, 세기는 0..2 크기다', () => {
  const sp = (extra) => `[{ axis: spacing, direction: airy, ${extra} }]`
  assert.deepEqual(fails(lexOf(entry('a', ['가나'], '[{ axis: blur, direction: airy, strength: 1 }]'))).ids, ['a'])
  assert.deepEqual(fails(lexOf(entry('a', ['가나'], sp('strength: 3')))).ids, ['a'])
  assert.deepEqual(fails(lexOf(entry('a', ['가나'], sp('strength: -1')))).ids, ['a'], '세기는 크기다 — 부호는 direction 이 진다')
  assert.deepEqual(fails(lexOf(entry('a', ['가나'], sp("strength: 1, scope: 'section'")))).ids, ['a'])
  assert.deepEqual(fails(lexOf(entry('a', ['가나'], sp("strength: 1, scope: 'element:바닥'")))).ids, ['a'])
  assert.doesNotThrow(() => load(lexOf(entry('a', ['가나'], `[{ axis: spacing, direction: airy, strength: 1, scope: 'section:home/hero' }, { axis: contrast, direction: crisp, strength: 2, scope: 'element:제목' }]`))))
})

test('zod 위반이 여럿이어도 문제 항목 id 만 모은다(좋은 항목은 빠진다)', () => {
  const yaml = lexOf(entry('good', ['가나'], `[${r('spacing')}]`)
    + entry('bad1', ['다라'], "[{ axis: spacing, direction: airy, strength: 1, scope: 'nowhere' }]")
    + entry('bad2', ['마바'], '[{ axis: spacing, direction: airy, strength: 9 }]'))
  const f = fails(yaml)
  assert.deepEqual(f.ids, ['bad1', 'bad2'])
  assert.ok(f.message.includes('[bad1]') && f.message.includes('[bad2]') && !f.message.includes('[good]'))
})

test('reading 에 direction 도 value 도 없으면 거부', () => {
  const f = fails(lexOf(entry('a', ['가나'], '[{ axis: spacing, strength: 1 }]')))
  assert.deepEqual(f.ids, ['a'])
  assert.ok(f.message.includes('direction') && f.message.includes('value'))
})

test('direction 이 그 축 ends 에 없으면 거부 — 값 축(색·글꼴)에는 direction 이 없다', () => {
  const f = fails(lexOf(entry('a', ['가나'], '[{ axis: spacing, direction: huge, strength: 1 }]')))
  assert.deepEqual(f.ids, ['a'])
  assert.ok(f.message.includes('huge') && f.message.includes('tight airy'))
  assert.deepEqual(fails(lexOf(entry('a', ['가나'], '[{ axis: spacing, direction: bright, strength: 1 }]'))).ids, ['a'], '다른 축의 끝 id 도 안 된다')
  assert.deepEqual(fails(lexOf(entry('a', ['가나'], '[{ axis: type-family, direction: airy, strength: 1 }]'))).ids, ['a'])
  assert.deepEqual(fails(lexOf(entry('a', ['가나'], '[{ axis: spacing, direction: airy, value: x, strength: 1 }]'))).ids, ['a'], '둘 다 있어도 안 된다')
  assert.doesNotThrow(() => load(lexOf(entry('a', ['가나'], '[{ axis: spacing, direction: tight, strength: 1 }, { axis: color-hue, value: blue }]'))))
})

test('causes 안의 reading 도 같은 방향 규칙을 지킨다', () => {
  const low = (reading) => `  - id: m\n    kind: impression\n    label: m\n    match: { ko: [가나] }\n    confidence: low\n    causes:\n      - { reading: [${reading}], say: 하나. }\n      - { reading: [${r('contrast')}], say: 둘. }\n`
  assert.deepEqual(fails(lexOf(low('{ axis: spacing, strength: 1 }'))).ids, ['m'])
  assert.deepEqual(fails(lexOf(low('{ axis: spacing, direction: huge, strength: 1 }'))).ids, ['m'])
  assert.doesNotThrow(() => load(lexOf(low(r('spacing')))))
})

test('diagnosis 는 causes 1개 이상과 ask 를 갖는다', () => {
  const diag = (extra) => lexOf(`  - id: d\n    kind: diagnosis\n    label: d\n    match: { ko: [촌스러] }\n${extra}`)
  const cause = '{ reading: [{ axis: type-family, value: distinctive }], say: 글꼴이 흔해서 그래 보여요. }'
  assert.deepEqual(fails(diag('    ask: 어디가 가장 그래 보여요?\n')).ids, ['d'], 'causes 없음')
  assert.deepEqual(fails(diag(`    causes: [${cause}]\n`)).ids, ['d'], 'ask 없음')
  assert.doesNotThrow(() => load(diag(`    causes: [${cause}]\n    ask: 어디가 가장 그래 보여요?\n`)))
})

test('causes 의 reading 축이 1~4개를 벗어나면 거부', () => {
  const diag = (reading) => lexOf(`  - id: d\n    kind: diagnosis\n    label: d\n    match: { ko: [촌스러] }\n    ask: 어디가 그래 보여요?\n    causes: [{ reading: [${reading}], say: 이유. }]\n`)
  const five = ['spacing', 'contrast', 'depth', 'motion', 'shape'].map((a) => r(a)).join(', ')
  const f = fails(diag(five))
  assert.deepEqual(f.ids, ['d'])
  assert.ok(f.message.includes('causes'))
  assert.deepEqual(fails(diag('')).ids, ['d'], 'reading 이 비면 zod 가 거부')
  assert.doesNotThrow(() => load(diag(r('spacing'))))
})

test('confidence low 항목은 원인이 정확히 2개', () => {
  const low = (causes) => lexOf(`  - id: m\n    kind: impression\n    label: m\n    match: { ko: [가나] }\n    confidence: low\n    causes: [${causes}]\n`)
  const c1 = `{ reading: [${r('contrast')}], say: 또렷한 쪽으로 이해했어요. }`
  const c2 = `{ reading: [${r('depth')}], say: 떠 보이는 쪽으로 이해했어요. }`
  assert.deepEqual(fails(low(c1)).ids, ['m'])
  assert.deepEqual(fails(low(`${c1}, ${c2}, ${c1}`)).ids, ['m'], '3개도 안 된다')
  assert.doesNotThrow(() => load(low(`${c1}, ${c2}`)))
})

test('같은 id 가 둘이면 거부', () => {
  const yaml = lexOf(entry('a', ['가나'], `[${r('spacing')}]`) + entry('a', ['다라'], `[${r('contrast')}]`))
  assert.deepEqual(fails(yaml).ids, ['a'])
})

test('axes 는 12개가 정해진 순서로 있어야 한다(순서·개수 위반)', () => {
  const swapped = [...AXES]; [swapped[0], swapped[1]] = [swapped[1], swapped[0]]
  const f1 = fails(lexOf('  []', swapped.map(axisLine).join('\n')))
  assert.ok(f1.message.includes('axes') && f1.message.includes('순서'), f1.message)
  assert.deepEqual(f1.ids, [], '항목이 아니라 파일 전체의 문제다')
  const fewer = fails(lexOf('  []', AXES.slice(0, 11).map(axisLine).join('\n')))
  assert.ok(fewer.message.includes('12개'), fewer.message)
})

test('사전 파일이 없으면 LexiconError(ids 없음)', () => {
  withFile(null, (f) => {
    assert.throws(() => loadLexicon(f), (e) => e instanceof LexiconError && e.message.includes('읽지 못했다') && e.ids.length === 0)
  })
})

test('YAML 이 깨졌으면 LexiconError', () => {
  assert.throws(() => load('axes: [unclosed\n  : :'), (e) => e instanceof LexiconError && e.message.includes('읽지 못했다'))
})

test('최상위 모양이 틀리면(entries 없음) LexiconError', () => {
  assert.throws(() => load(`axes:\n${HEAD}\n`), (e) => e instanceof LexiconError && e.message.includes('모양'))
})

test('normalize: 조사·어미를 떼고 띄어쓰기 없는 사본과 영어 집합을 돌려준다', () => {
  assert.equal(normalize('깔끔하게').compact, '깔끔')
  assert.equal(normalize('좀 더 고급스럽게').compact, '더고급')
  assert.equal(normalize('따뜻하고 대담한').spaced, '따뜻 대담')
  assert.equal(normalize('재미').compact, '재미', '두 글자 낱말은 떼지 않는다')
  const n = normalize('Make it Warm, cozy')
  assert.deepEqual([...n.en].sort(), ['cozy', 'it', 'make', 'warm'])
  assert.deepEqual(normalize('').compact, '')
})

test('normalize: 낱말 구간(tokens)과 영어 낱말 구간(latin)을 compact 좌표로 돌려준다', () => {
  const n = normalize('좀 더 clean하게')
  assert.equal(n.compact, '더clean')
  assert.deepEqual(n.tokens, [{ start: 0, end: 1, raw: '더' }, { start: 1, end: 6, raw: 'clean하게' }])
  assert.deepEqual(n.latin, [{ word: 'clean', start: 1, end: 6 }])
  assert.deepEqual(normalize('unclean').latin, [{ word: 'unclean', start: 0, end: 7 }])
})

test('value 를 쓰는 reading 은 축의 valueLabels 에 한국어 이름이 있어야 한다', () => {
  const noLabels = AXES.map((a) => (ENDS[a] ? axisLine(a) : `  ${a}: { label: ${a} }`)).join('\n')
  const rd = '[{ axis: type-family, value: some-value, strength: 1 }]'
  assert.deepEqual(fails(lexOf(entry('needs-label', ['라벨'], rd), noLabels)).ids, ['needs-label'])
  assert.doesNotThrow(() => load(lexOf(entry('has-label', ['라벨'], rd))))
})

test('실제 사전: type-family 의 value 는 한국어 이름을 가진다', () => {
  assert.equal(loadLexicon().axes['type-family'].valueLabels['serif-or-thin-sans'], '명조나 가는 고딕')
})
