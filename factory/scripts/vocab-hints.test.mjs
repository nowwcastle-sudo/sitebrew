// 눈가림 분류기에게 줄 힌트 파일(hints.mjs) — 정답·페르소나·probe 가 새지 않고, dev 는 자기 줄을 뺀 예문을 쓴다.
// 진짜 holdout 은 열지 않는다 — 가짜 묶음을 임시 폴더에 만들어 쓴다.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SHEET_FILE, defaultOut, renderSheet, run } from '../vocab/eval/hints.mjs'
import { loadLexicon, scopesOf } from '../vocab/lexicon.mjs'

const HINTS = join(dirname(fileURLToPath(import.meta.url)), '..', 'vocab', 'eval', 'hints.mjs')
const R = (axis, direction) => ({ axis, direction, strength: 1, scope: 'site' })
const jsonl = (rows) => rows.map((r) => JSON.stringify(r)).join('\n') + '\n'
const read = (f) => readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))

// 비밀 표시(SECRET)가 든 정답·페르소나·probe 가 출력에 보이면 샌 것이다.
const SECRET = 'SECRET-마커'
const rows = [
  { id: 'a', text: '글씨 크게', kind: 'axis', expect: [R('type-scale', 'larger')], persona: SECRET },
  { id: 'b', text: '제목만 크게', kind: 'modifier', expect: [R('type-scale', 'larger')], persona: SECRET, probe: SECRET },
  { id: 'c', text: '가나다라마바', kind: 'impression', expect: [R('shape', 'round')] }, // 사전에 없음 → 근사 후보는 d
  { id: 'd', text: '가나다라마바사', kind: 'impression', expect: [R('shape', 'round')] },
  { id: 'e', text: 'ㅋㅋㅋ', kind: 'none', expect: 'ask' },
]
const keysOf = (o) => Object.keys(o).sort()

function withDir(files, fn) {
  const dir = mkdtempSync(join(tmpdir(), 'vocab-hints-'))
  try {
    for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body)
    return fn(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

test('힌트 줄은 id·text·hint 만 갖고 정답(expect)·갈래(kind 의 정답)·페르소나·probe 가 새지 않는다', () => {
  withDir({ 'dev.jsonl': jsonl(rows) }, (dir) => {
    const out = join(dir, 'h.jsonl')
    assert.equal(run(['--set', 'dev', '--out', out], { dir, log: () => {} }), 0)
    const lines = read(out)
    assert.equal(lines.length, rows.length)
    for (const l of lines) {
      assert.deepEqual(keysOf(l), ['hint', 'id', 'text'])
      assert.ok(['confirmed', 'two', 'near', 'unknown'].includes(l.hint.result))
    }
    const raw = readFileSync(out, 'utf8')
    assert.doesNotMatch(raw, new RegExp(SECRET))
    for (const k of ['"expect"', '"persona"', '"probe"']) assert.ok(!raw.includes(k), `${k} 가 없다`)
    assert.deepEqual(lines.map((l) => l.text), rows.map((r) => r.text))
  })
})

test('힌트는 classify 결과: 확정은 kind·lead·readings, 근사는 예문 글·kind·lead, 모름은 result 만', () => {
  withDir({ 'dev.jsonl': jsonl(rows) }, (dir) => {
    const out = join(dir, 'h.jsonl')
    run(['--set', 'dev', '--out', out], { dir, log: () => {} })
    const by = Object.fromEntries(read(out).map((l) => [l.id, l.hint]))
    assert.deepEqual(keysOf(by.a), ['kind', 'lead', 'readings', 'result'])
    assert.equal(by.a.result, 'confirmed')
    assert.deepEqual(by.a.lead, { axis: 'type-scale', direction: 'larger' })
    assert.equal(by.b.kind, 'modifier')
    assert.deepEqual(keysOf(by.c), ['kind', 'lead', 'nearest', 'result'])
    assert.equal(by.c.result, 'near')
    assert.deepEqual(keysOf(by.c.nearest[0]), ['kind', 'lead', 'score', 'text'])
    assert.equal(by.c.nearest[0].text, '가나다라마바사', '예문의 글이 들어 있다')
    assert.deepEqual(by.c.nearest[0].lead, { axis: 'shape', direction: 'round' })
    assert.deepEqual(by.e, { result: 'unknown' })
  })
})

test('후보 둘 힌트는 choices 마다 lead·readings', () => {
  // 「답답해」는 두 원인 진단 — 실제 사전에 있는 문장이 아니라서 시험용 사전을 쓴다
  const lex = {
    axes: Object.fromEntries(['color-hue', 'color-lightness', 'color-saturation', 'color-temperature', 'palette-count', 'contrast', 'type-family', 'type-scale', 'spacing', 'shape', 'depth', 'motion'].map((k) => [k, { label: k }])),
    entries: [{
      id: 'stuffy', kind: 'diagnosis', label: '답답함', match: { ko: ['답답'] },
      causes: [{ reading: [R('spacing', 'airy')], say: '여백이 좁아서' }, { reading: [R('type-scale', 'smaller')], say: '글자가 커서' }],
      ask: '어디가 답답해 보여요?',
    }],
  }
  withDir({ 'dev.jsonl': jsonl([{ id: 'x', text: '답답해', kind: 'diagnosis', expect: 'ask' }]) }, (dir) => {
    const out = join(dir, 'h.jsonl')
    run(['--set', 'dev', '--out', out], { dir, lex, log: () => {} })
    const [{ hint }] = read(out)
    assert.equal(hint.result, 'two')
    assert.deepEqual(keysOf(hint), ['choices', 'kind', 'lead', 'result'])
    assert.equal(hint.choices.length, 2)
    assert.deepEqual(keysOf(hint.choices[0]), ['lead', 'readings'])
    assert.deepEqual(hint.choices[1].lead, { axis: 'type-scale', direction: 'smaller' })
  })
})

test('dev 는 leave-one-out: 자기 줄은 예문에서 빠지고, holdout 은 같은 폴더의 dev 전체를 예문으로 쓴다', () => {
  withDir({ 'dev.jsonl': jsonl([rows[3]]), 'holdout.jsonl': jsonl([{ ...rows[3], id: 'h1' }]) }, (dir) => {
    const dev = join(dir, 'dev.out')
    run(['--set', 'dev', '--out', dev], { dir, log: () => {} })
    assert.equal(read(dev)[0].hint.result, 'unknown', '자기 자신을 예문으로 쓰면 안 된다')
    const hold = join(dir, 'hold.out')
    run(['--set', 'holdout', '--out', hold], { dir, log: () => {} })
    assert.equal(read(hold)[0].hint.result, 'near')
    assert.equal(read(hold)[0].hint.nearest[0].text, rows[3].text)
  })
})

test('기본 출력 경로는 out/ 아래 집합 이름으로 만든다 · --out 이 있으면 없는 폴더도 만들어 쓴다', () => {
  assert.equal(defaultOut('dev').replaceAll('\\', '/').split('/out/')[1], 'vocab-hints-dev.jsonl')
  assert.equal(defaultOut('holdout').replaceAll('\\', '/').split('/out/')[1], 'vocab-hints-holdout.jsonl')
  withDir({ 'dev.jsonl': jsonl(rows) }, (dir) => {
    const out = []
    const code = run(['--set', 'dev', '--out', join(dir, 'x', 'y.jsonl')], { dir, log: (s) => out.push(s) })
    assert.equal(code, 0)
    assert.ok(existsSync(join(dir, 'x', 'y.jsonl')), '없는 폴더도 만든다')
    assert.match(out.join('\n'), /5줄/)
  })
})

test('--set 이 없거나 모르는 이름이면 종료 2', () => {
  withDir({ 'dev.jsonl': jsonl(rows) }, (dir) => {
    assert.equal(run([], { dir, log: () => {} }), 2)
    assert.equal(run(['--set', 'test'], { dir, log: () => {} }), 2)
    assert.equal(run(['--set', 'holdout'], { dir, log: () => {} }), 2, '시험 파일이 없으면 종료 2')
  })
})

test('실제 CLI: dev 로 기본 경로 없이 --out 에 쓴다', () => {
  withDir({}, (dir) => {
    const out = join(dir, 'real.jsonl')
    const r = spawnSync(process.execPath, [HINTS, '--set', 'dev', '--out', out], { encoding: 'utf8' })
    assert.equal(r.status, 0)
    assert.ok(read(out).length > 100)
  })
})

test('CLASSIFIER.md: 범위 목록은 사전에서 만든 것과 같고(손으로 베끼지 않음), 60줄 안이다', () => {
  const lex = loadLexicon()
  const text = readFileSync(SHEET_FILE, 'utf8')
  assert.equal(renderSheet(text, lex), text, '어긋났다면: npm run vocab:hints -- --write-sheet')
  for (const scope of scopesOf(lex)) assert.ok(text.includes(`\`${scope}\``), scope)
  assert.ok(text.split('\n').length <= 60)
})
