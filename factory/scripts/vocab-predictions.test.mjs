// 예측 파일 채점(설계 7.2 출시 관문: Claude + 사전)과 사전 단독 관문 선택(gates.json 의 lexiconOnly).
// 진짜 holdout 은 열지 않는다 — 모든 시험은 임시 폴더의 가짜 묶음을 쓴다.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { GATES, LEXICON_ONLY, loadCases, run, score } from '../vocab/eval/score.mjs'
import { loadLexicon, scopesOf } from '../vocab/lexicon.mjs'
import { examplesFrom } from '../vocab/classify.mjs'
import { loadPredictions } from '../vocab/eval/predictions.mjs'
import { run as runHints } from '../vocab/eval/hints.mjs'

const SCORE = join(dirname(fileURLToPath(import.meta.url)), '..', 'vocab', 'eval', 'score.mjs')
const R = (axis, direction, strength = 1) => ({ axis, direction, strength, scope: 'site' })
const larger = [R('type-scale', 'larger')]
const smaller = [R('type-scale', 'smaller')]
const rounder = [R('shape', 'round')]
const sharper = [R('shape', 'sharp')]
const jsonl = (rows) => rows.map((r) => JSON.stringify(r)).join('\n') + '\n'

// 가짜 holdout: p1 정답 larger · p2 정답 round · p3 정답 ask · p4 정답 후보 둘
const holdout = [
  { id: 'p1', text: '가나다', kind: 'axis', expect: larger },
  { id: 'p2', text: '라마바', kind: 'impression', expect: rounder },
  { id: 'p3', text: '사아자', kind: 'none', expect: 'ask' },
  { id: 'p4', text: '차카타', kind: 'diagnosis', expect: { two: [larger, rounder] } },
]
const good = [
  { id: 'p1', result: 'confirmed', kind: 'axis', readings: larger },
  { id: 'p2', result: 'near', kind: 'impression', readings: rounder },
  { id: 'p3', result: 'unknown' },
  { id: 'p4', result: 'two', kind: 'diagnosis', choices: [{ readings: rounder }, { readings: smaller }] },
]

function setup(rows, predictions) {
  const dir = mkdtempSync(join(tmpdir(), 'vocab-pred-'))
  writeFileSync(join(dir, 'dev.jsonl'), jsonl(rows))
  writeFileSync(join(dir, 'pred.jsonl'), typeof predictions === 'string' ? predictions : jsonl(predictions))
  return { dir, file: join(dir, 'pred.jsonl') }
}
const runWith = (rows, predictions, extra = []) => {
  const { dir, file } = setup(rows, predictions)
  try {
    const out = []
    const code = run(['--set', 'dev', '--predictions', file, ...extra], { dir, log: (s) => out.push(s) })
    return { code, text: out.join('\n') }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

test('예측 파일: 좋은 파일은 classify 를 부르지 않고 같은 규칙·다섯 합격선으로 잰다', () => {
  const { code, text } = runWith(holdout, good)
  assert.equal(code, 0)
  assert.match(text, /확정 1 · 후보 둘 1 · 근사 1 · 모름 1/)
  assert.match(text, /예측 4줄/)
  assert.match(text, /leadAgreement\s+100\.0%/, '확정·근사·후보 둘 모두 대표 읽기가 맞음')
  assert.match(text, /twoHit\s+100\.0%/)
  assert.match(text, /oppositeApply\s+0\.0%/)
  for (const k of Object.keys(GATES)) assert.match(text, new RegExp(`${k}.*합격선`))
})

test('예측 파일: 반대 방향으로 확정하면 oppositeApply 가 걸려 종료 1', () => {
  const bad = good.map((p) => (p.id === 'p1' ? { ...p, readings: smaller } : p))
  const { code, text } = runWith(holdout, bad)
  assert.equal(code, 1)
  assert.match(text, /oppositeApply.*FAIL/)
  assert.match(text, /leadAgreement.*FAIL/)
})

test('예측 파일: 예측이 없는 문장은 모름으로 센다', () => {
  const { code, text } = runWith(holdout, good.slice(0, 2))
  assert.match(text, /확정 1 · 후보 둘 0 · 근사 1 · 모름 2/)
  assert.equal(code, 1, '읽기가 있는 p4 를 못 냈으니 분류 실패율이 걸린다')
  assert.match(text, /unclassified.*FAIL/)
})

test('예측 파일: 사전에 없는 id 는 종료 2 와 id 목록', () => {
  const { code, text } = runWith(holdout, [...good, { id: 'zz-1', result: 'unknown' }, { id: 'zz-2', result: 'unknown' }])
  assert.equal(code, 2)
  assert.match(text, /zz-1/)
  assert.match(text, /zz-2/)
})

test('예측 파일: 사전에 없는 축·방향·값 이름은 종료 2 와 이름 목록', () => {
  const bad = [
    { id: 'p1', result: 'confirmed', kind: 'axis', readings: [{ axis: 'font-size', direction: 'larger', strength: 1, scope: 'site' }] },
    { id: 'p2', result: 'near', kind: 'impression', readings: [R('shape', 'pointy')] },
    { id: 'p3', result: 'confirmed', kind: 'axis', readings: [{ axis: 'color-hue', value: 'ultraviolet', strength: 1, scope: 'site' }] },
    { id: 'p4', result: 'two', kind: 'diagnosis', choices: [{ readings: larger }, { readings: [{ axis: 'shape', strength: 1, scope: 'site' }] }] },
  ]
  const { code, text } = runWith(holdout, bad)
  assert.equal(code, 2)
  for (const name of ['font-size', 'pointy', 'ultraviolet']) assert.match(text, new RegExp(name))
  assert.match(text, /p4/, '방향도 값도 없는 읽기도 잡는다')
})

test('예측 파일: 결과 이름·읽기 빠짐·후보 개수·깨진 줄·같은 id 중복도 종료 2', () => {
  const cases = [
    [[{ id: 'p1', result: 'maybe' }], /p1.*maybe/],
    [[{ id: 'p1', result: 'confirmed', kind: 'axis' }], /p1/],
    [[{ id: 'p4', result: 'two', kind: 'diagnosis', choices: [{ readings: larger }] }], /p4/],
    [[good[0], good[0]], /p1.*둘|p1.*중복/],
  ]
  for (const [rows, re] of cases) {
    const r = runWith(holdout, rows)
    assert.equal(r.code, 2)
    assert.match(r.text, re)
  }
  const broken = runWith(holdout, '{"id":"p1"\n')
  assert.equal(broken.code, 2)
  assert.match(broken.text, /1줄/)
})

test('예측 파일: 후보 둘의 한쪽만 맞아도 적중, 둘 다 틀리면 twoHit 0', () => {
  const miss = good.map((p) => (p.id === 'p4' ? { ...p, choices: [{ readings: sharper }, { readings: smaller }] } : p))
  assert.match(runWith(holdout, miss).text, /twoHit\s+0\.0%/)
  assert.match(runWith(holdout, good).text, /twoHit\s+100\.0%/)
})

test('lexiconOnly: gates.json 이 정하고, 예측 없는 holdout 은 반대 방향 하나만 합격선·나머지는 참고', () => {
  assert.deepEqual([...LEXICON_ONLY], ['oppositeApply'])
  const dir = mkdtempSync(join(tmpdir(), 'vocab-lexonly-'))
  try {
    // 사전이 아무것도 못 잡는 문장뿐 → 분류 실패 100%(참고) 이지만 반대 방향은 0 → 종료 0
    writeFileSync(join(dir, 'holdout.jsonl'), jsonl(holdout.map((r) => ({ ...r, text: 'ㅋㅋㅋ' }))))
    const out = []
    assert.equal(run(['--set', 'holdout'], { dir, log: (s) => out.push(s) }), 0)
    const text = out.join('\n')
    assert.match(text, /oppositeApply.*합격선/)
    assert.match(text, /unclassified.*100\.0%.*참고/)
    for (const k of Object.keys(GATES).filter((g) => !LEXICON_ONLY.includes(g))) assert.match(text, new RegExp(`${k}.*참고`))
    assert.doesNotMatch(text, /FAIL/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('lexiconOnly: 사전 단독 holdout 은 반대 방향이 합격선을 넘으면 종료 1', () => {
  const dir = mkdtempSync(join(tmpdir(), 'vocab-lexonly-'))
  try {
    writeFileSync(join(dir, 'holdout.jsonl'), jsonl([{ id: 'x', text: '글씨 크게', kind: 'axis', expect: smaller }]))
    const out = []
    assert.equal(run(['--set', 'holdout'], { dir, log: (s) => out.push(s) }), 1)
    assert.match(out.join('\n'), /oppositeApply.*FAIL/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('예측 파일: 범위는 사전이 쓰는 id 만 받는다 — 한글로 풀어 쓴 section:히어로 는 겹침 검사를 빠져나가므로 종료 2', () => {
  const lex = loadLexicon()
  assert.ok(scopesOf(lex).includes('section:hero') && scopesOf(lex).includes('site'))
  const at = (scope) => [R('type-scale', 'larger', 1)].map((r) => ({ ...r, scope }))
  const row = (readings, extra = {}) => [{ id: 'p1', result: 'confirmed', kind: 'axis', readings, ...extra }, ...good.slice(1)]
  assert.equal(runWith(holdout, row(at('section:hero'))).code, 0, '사전의 범위는 통과')
  for (const scope of ['section:히어로', 'section:Hero', 'page:main', 'element:헤더', 'everywhere']) {
    const r = runWith(holdout, row(at(scope)))
    assert.equal(r.code, 2, scope)
    assert.match(r.text, new RegExp(`p1.*${scope}`))
  }
  const bad = [
    [row(larger, { kind: 'mood' }), /kind 「mood」/],
    [row([R('type-scale', 'larger', 3)]), /strength 3/],
    [row([R('type-scale', 'larger', 1.5)]), /strength 1\.5/],
    [row([{ ...R('type-scale', 'larger'), cap: false }]), /cap/],
  ]
  for (const [rows, re] of bad) {
    const r = runWith(holdout, rows)
    assert.equal(r.code, 2)
    assert.match(r.text, re)
  }
  assert.equal(runWith(holdout, row([R('type-scale', 'larger', 0)])).code === 2, false, 'strength 0 은 상한용으로 허용')
})

test('예측 파일 왕복: 힌트를 classify 모양 그대로 예측으로 옮겨 채점하면 classify 경로와 같은 지표다', () => {
  const dir = mkdtempSync(join(tmpdir(), 'vocab-roundtrip-'))
  try {
    const rows = loadCases(join(dirname(SCORE), 'dev.jsonl')).slice(0, 150)
    writeFileSync(join(dir, 'dev.jsonl'), jsonl(rows))
    const hints = join(dir, 'hints.jsonl')
    assert.equal(runHints(['--set', 'dev', '--out', hints], { dir, log: () => {} }), 0)
    const predictions = loadCases(hints).map(({ id, hint: h }) => {
      if (h.result === 'unknown') return { id, result: 'unknown' }
      if (h.result === 'two') return { id, result: 'two', kind: h.kind, choices: h.choices.map((c) => ({ readings: c.readings })) }
      return { id, result: h.result, kind: h.kind, readings: h.readings ?? [h.lead] }
    })
    const file = join(dir, 'pred.jsonl')
    writeFileSync(file, jsonl(predictions))
    const lex = loadLexicon()
    const { predictions: byId, problems } = loadPredictions(file, new Set(rows.map((r) => r.id)), lex)
    assert.deepEqual(problems, [])
    const viaClassify = score(rows, lex, { examples: examplesFrom(rows) })
    const viaPredictions = score(rows, lex, { predictions: byId })
    assert.ok(viaClassify.counts.near > 0 && viaClassify.counts.two > 0 && viaClassify.counts.confirmed > 0, '세 종류가 모두 들어 있는 묶음')
    assert.deepEqual(viaPredictions, viaClassify)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('dev 는 예측이 없어도 다섯 합격선을 모두 건다(회귀 방지)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'vocab-devgates-'))
  try {
    writeFileSync(join(dir, 'dev.jsonl'), jsonl([{ id: 'x', text: 'ㅋㅋㅋ', kind: 'axis', expect: larger }]))
    const out = []
    assert.equal(run(['--set', 'dev'], { dir, log: (s) => out.push(s) }), 1)
    assert.match(out.join('\n'), /unclassified.*FAIL/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('--predictions 와 --release: 검수 대기는 그대로 종료 2, 검수 끝나면 ask 판정을 적용해 다섯 합격선으로 잰다', () => {
  const dir = mkdtempSync(join(tmpdir(), 'vocab-predrel-'))
  try {
    writeFileSync(join(dir, 'holdout.jsonl'), jsonl(Array.from({ length: 100 }, (_, i) => ({ id: `h-${i}`, text: '가나다', kind: 'axis', expect: larger }))))
    const preds = join(dir, 'pred.jsonl')
    writeFileSync(preds, jsonl(Array.from({ length: 100 }, (_, i) => ({ id: `h-${i}`, result: 'confirmed', kind: 'axis', readings: larger }))))
    const waiting = []
    assert.equal(run(['--release', '--predictions', preds], { dir, log: (s) => waiting.push(s) }), 2)
    assert.match(waiting.join('\n'), /검수 대기: 0\/100/)

    const ok = Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`h-${i}`, { verdict: i < 10 ? 'ask' : 'ok' }]))
    writeFileSync(join(dir, 'holdout.review.json'), JSON.stringify({ verdicts: ok }))
    const out = []
    assert.equal(run(['--release', '--predictions', preds], { dir, log: (s) => out.push(s) }), 0)
    const text = out.join('\n')
    assert.match(text, /contentApply\s+100\.0%/, 'ask 판정 10줄을 확정했으니 내용 문장 확정률 100%')
    for (const k of Object.keys(GATES)) assert.match(text, new RegExp(`${k}.*합격선`))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('실제 CLI: 없는 id 가 든 예측 파일은 종료 2', () => {
  const { dir, file } = setup(holdout, [{ id: 'nope', result: 'unknown' }])
  const r = spawnSync(process.execPath, [SCORE, '--set', 'dev', '--dir', dir, '--predictions', file], { encoding: 'utf8' })
  rmSync(dir, { recursive: true, force: true })
  assert.equal(r.status, 2)
  assert.match(r.stdout, /nope/)
})
