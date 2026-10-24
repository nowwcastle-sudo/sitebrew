// 말본 데이터(factory/vocab/grammar.yaml)와 로더(grammar.mjs): 해석기·정규화가 쓰는 낱말·숫자·되묻는 글이 한 파일에 있고, 코드는 그 목록으로 집합·정규식을 만든다.
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fill } from '../vocab/fill.mjs'
import { GRAMMAR_FILE, grammar, loadGrammar } from '../vocab/grammar.mjs'
import { interpret } from '../vocab/interpret.mjs'
import { normalize } from '../vocab/normalize.mjs'

test('grammar.yaml 이 모양대로 읽힌다 · 목록에 겹치는 낱말이 없다', () => {
  const { normalize: n, match: m } = loadGrammar()
  for (const [name, list] of [['endings', n.endings], ['fillers', n.fillers], ['tails', m.tails], ['gapOk', m.gapOk], ['links', m.links], ['designSuffixes', m.designSuffixes]]) {
    assert.equal(new Set(list).size, list.length, `${name} 에 같은 낱말이 둘이다`)
  }
  assert.ok(!m.tails.includes('') && n.endings.every((e) => !m.tails.includes(e)), 'tails 는 빈 꼬리와 endings 를 코드가 더하므로 두지 않는다')
})

test('「하다」「하지」 꼬리는 tails 에 없어도 links 의 「하」 + 「다」「지」로 짧은 낱말에 붙는다', () => {
  assert.ok(!grammar.match.tails.includes('하다') && !grammar.match.tails.includes('하지'))
  assert.equal(interpret('심플하다').result, 'confirmed')
  assert.equal(interpret('심플하지').result, 'confirmed')
})

test('정규화는 grammar.yaml 의 어미·군말·남는 길이를 쓴다', () => {
  assert.equal(normalize('따뜻하게 좀').compact, '따뜻') // 어미 「하게」와 군말 「좀」
  assert.equal(normalize('재미').compact, '재미') // 남는 길이가 minRest 미만이면 떼지 않는다
})

test('말본 파일이 틀리면 던진다', () => {
  const dir = mkdtempSync(join(tmpdir(), 'grammar-test-'))
  try {
    const f = join(dir, 'grammar.yaml')
    writeFileSync(f, readFileSync(GRAMMAR_FILE, 'utf8').replace(/^limits:[\s\S]*?\n\n/m, 'limits:\n  shortKeyMax: 3\n\n'))
    assert.throws(() => loadGrammar(f), /limits/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('한국어 글은 변하는 말 뒤에 받침에 따라 달라지는 조사를 두지 않는다', () => {
  const korean = []
  const walk = (node) => {
    if (typeof node?.ko === 'string') korean.push(node.ko)
    else if (node && typeof node === 'object') Object.values(node).forEach(walk)
  }
  walk(grammar.text)
  assert.ok(korean.length >= 8)
  for (const t of korean) assert.doesNotMatch(t, /\{\w+\}」?\s?(은|는|이|가|을|를|와|과|으로)(?![가-힣])/, t)
})

test('되묻는 글: 반대로 읽히는 두 말은 조사 없이 라벨을 채운다', () => {
  const r = interpret('밝고 어둡게')
  assert.equal(r.result, 'unknown')
  assert.equal(r.ask, '「밝게」 말과 「어둡게」 말은 서로 반대예요. 어느 쪽인가요?')
  assert.match(interpret('bright and dark please').ask, /^"[^"]+" and "[^"]+" pull opposite ways\. Which one\?$/)
})

test('범위가 붙은 말 앞 글과 상한 글은 grammar.yaml 의 틀로 채운다', () => {
  assert.match(interpret('버튼 쪽만 둥글게').say, /^「버튼」에만 /)
  assert.equal(fill(grammar.text.scope.page.en, { key: 'home' }), 'For the home page only: ')
})

test('fill: 값이 없는 자리는 던진다', () => {
  assert.equal(fill('{a}와 {b}', { a: '1', b: '2' }), '1와 2')
  assert.throws(() => fill('{a} {c}', { a: '1' }), /\{c\}/)
})
