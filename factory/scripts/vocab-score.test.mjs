// 적중률 채점기 score — 손으로 만든 작은 묶음으로 「대략 분류」 지표의 정의와 출시 판정(종료 2)을 확인한다.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadLexicon } from '../vocab/lexicon.mjs'
import { GATES, HOLDOUT_MIN, NOTE_VERDICT, REFERENCE, VERDICTS, VERDICT_DEFS, activeGates, failures, parseGates, score, run } from '../vocab/eval/score.mjs'

const SCORE = join(dirname(fileURLToPath(import.meta.url)), '..', 'vocab', 'eval', 'score.mjs')
const R = (axis, direction, strength = 1, extra = {}) => ({ axis, direction, strength, scope: 'site', ...extra })
const larger = [R('type-scale', 'larger')]
const smaller = [R('type-scale', 'smaller')]
const rounder = [R('shape', 'round')]
const CFG = { minScore: 0.5, topK: 2 }

// 실제 사전: 「글씨 크게」→확정(axis), 「제목만 크게」→확정(modifier), 「ㅋㅋㅋ」·「가나다라마바」→사전에 안 맞음
const ok = { id: 'a', text: '글씨 크게', kind: 'axis', expect: larger }
const unk = { id: 'u', text: 'ㅋㅋㅋ', kind: 'none', expect: 'ask' }
const near = { id: 'n', text: '가나다라마바', kind: 'impression', expect: smaller }
const example = { id: 'e1', text: '가나다라마바사', kind: 'impression', lead: { axis: 'type-scale', direction: 'smaller' } }

test('합격선은 gates.json 에서 읽는다(설계 7.2 표 그대로) · 참고 지표 이름도 거기서 온다', () => {
  assert.deepEqual({ ...GATES }, {
    kindAgreement: { min: 0.85 },
    leadAgreement: { min: 0.8 },
    oppositeApply: { max: 0.03 },
    unclassified: { max: 0.15 },
    twoHit: { min: 0.95, minSample: 40 },
  })
  assert.deepEqual([...REFERENCE], ['leadFirst', 'exactAgreement', 'contentApply'])
  const m = score([ok], undefined, { cfg: CFG })
  for (const k of [...Object.keys(GATES), ...REFERENCE]) assert.equal(typeof m[k], 'number', `${k} 지표가 있다`)
})

test('failures: 합격선을 넘나드는 지표만 이름으로 돌려준다', () => {
  const sample = { kindAgreement: 100, leadAgreement: 100, oppositeApply: 100, unclassified: 100, twoHit: 100 }
  const pass = { kindAgreement: 0.85, leadAgreement: 0.8, oppositeApply: 0.03, unclassified: 0.15, twoHit: 0.95, sample }
  assert.deepEqual(failures(pass), [], '경계값은 합격')
  assert.deepEqual(failures({ ...pass, kindAgreement: 0.84, oppositeApply: 0.04 }), ['kindAgreement', 'oppositeApply'])
  assert.deepEqual(failures({ ...pass, leadAgreement: 0.79, unclassified: 0.16, twoHit: 0.94 }), ['leadAgreement', 'unclassified', 'twoHit'])
  assert.deepEqual(failures({ ...pass, kindAgreement: 0.1, oppositeApply: 0.5 }, ['oppositeApply']), ['oppositeApply'], '걸기로 한 이름만 본다')
})

test('minSample: 분모가 모자란 지표는 합격선에서 빠져 참고로 찍힌다(표본이 되면 다시 건다)', () => {
  const sample = { kindAgreement: 100, leadAgreement: 100, oppositeApply: 100, unclassified: 100, twoHit: 39 }
  const m = { kindAgreement: 1, leadAgreement: 1, oppositeApply: 0, unclassified: 0, twoHit: 0, sample }
  assert.deepEqual(activeGates(m), ['kindAgreement', 'leadAgreement', 'oppositeApply', 'unclassified'])
  assert.deepEqual(failures(m), [], '표본 39 < 40 이면 twoHit 0% 도 실패가 아니다')
  assert.deepEqual(failures({ ...m, sample: { ...sample, twoHit: 40 } }), ['twoHit'], '40 이면 건다')
})

test('gates.json 검사(parseGates): 합격선마다 min 또는 max 하나, minSample 은 양의 정수, lexiconOnly 는 합격선 이름만, 판정·holdoutMin 모양', () => {
  const verdicts = [{ id: 'ok', label: '맞음' }, { id: 'fix', label: '고침', note: true }, { id: 'ask', label: '묻기', expect: 'ask' }]
  const good = { gates: { a: { min: 0.5 }, b: { max: 0.1, minSample: 10 } }, lexiconOnly: ['b'], reference: ['c'], verdicts, holdoutMin: 100 }
  assert.deepEqual(parseGates(good), good)
  const throwsWith = (json, re) => assert.throws(() => parseGates(json), re)
  throwsWith({ ...good, lexiconOnly: ['zzz'] }, /zzz.*gates 에 없다/)
  throwsWith({ ...good, gates: { a: {} } }, /a: min 또는 max/)
  throwsWith({ ...good, gates: { a: { min: 1, max: 2 } } }, /a: min 또는 max/)
  throwsWith({ ...good, gates: { a: { min: 'x' } } }, /a: min 또는 max/)
  throwsWith({ ...good, gates: { a: { min: 1, minSample: 0 } } }, /minSample/)
  throwsWith({ ...good, gates: {} }, /gates 가 비었다/)
  throwsWith({ ...good, lexiconOnly: undefined }, /lexiconOnly/)
  throwsWith({ ...good, reference: undefined }, /reference/)
  throwsWith({ ...good, holdoutMin: 0 }, /holdoutMin/)
  throwsWith({ ...good, holdoutMin: '100' }, /holdoutMin/)
  throwsWith({ ...good, verdicts: [] }, /verdicts 는 판정 목록/)
  throwsWith({ ...good, verdicts: [verdicts[0], { ...verdicts[1], id: 'ok' }] }, /서로 다른 글자/)
  throwsWith({ ...good, verdicts: [{ id: 'ok' }, verdicts[1]] }, /label/)
  throwsWith({ ...good, verdicts: [verdicts[0], verdicts[2]] }, /note: true 인 판정이 정확히 하나/)
  throwsWith({ ...good, verdicts: [verdicts[0], { ...verdicts[1], note: true }, { ...verdicts[1], id: 'x', note: true }] }, /note: true 인 판정이 정확히 하나/)
  throwsWith({ ...good, verdicts: [verdicts[1], { ...verdicts[2], expect: 'ok' }] }, /expect/)
})

test('검수 판정과 최소 문장 수는 gates.json 에서 온다 · 정답을 바꾸는 판정은 「ask」 하나', () => {
  const file = JSON.parse(readFileSync(new URL('../vocab/eval/gates.json', import.meta.url), 'utf8'))
  assert.deepEqual([...VERDICTS], file.verdicts.map((v) => v.id))
  assert.deepEqual([...VERDICT_DEFS], file.verdicts)
  assert.equal(HOLDOUT_MIN, file.holdoutMin)
  assert.equal(NOTE_VERDICT, file.verdicts.find((v) => v.note).id)
  assert.deepEqual(VERDICT_DEFS.filter((v) => v.expect !== undefined).map((v) => [v.id, v.expect]), [['ask', 'ask']])
})

test('갈래 일치율: 같은 갈래 맞음 · 다른 갈래 틀림 · none 은 확정하지 않을 때 맞음 · 정답이 ask 인 줄도 같다', () => {
  assert.equal(score([ok], undefined, { cfg: CFG }).kindAgreement, 1)
  assert.equal(score([{ ...ok, kind: 'impression' }], undefined, { cfg: CFG }).kindAgreement, 0)
  assert.equal(score([unk], undefined, { cfg: CFG }).kindAgreement, 1)
  assert.equal(score([{ ...ok, kind: 'none', expect: 'ask' }], undefined, { cfg: CFG }).kindAgreement, 0, 'none 인데 확정하면 틀림')
  assert.equal(score([{ ...unk, kind: 'reference' }], undefined, { cfg: CFG }).kindAgreement, 1, '정답이 ask 인 줄은 모름이어도 맞음')
  const scoped = { id: 'm', text: '제목만 크게', kind: 'modifier', expect: [R('type-scale', 'larger', 1, { scope: 'element:제목' })] }
  assert.equal(score([scoped], undefined, { cfg: CFG }).kindAgreement, 1, '범위가 붙으면 갈래는 modifier')
})

test('대표 축 일치율: 정답에 읽기가 있는 줄만 센다 — 확정·근사의 대표 읽기', () => {
  const m = score([ok, { ...ok, id: 'b', expect: rounder }, unk], undefined, { cfg: CFG })
  assert.equal(m.leadAgreement, 0.5, 'ask 줄은 분모에 안 든다')
  const viaNear = score([near], undefined, { examples: [example], cfg: CFG })
  assert.equal(viaNear.counts.near, 1)
  assert.equal(viaNear.leadAgreement, 1, '근사의 첫 후보가 정답의 대표 읽기')
  assert.equal(score([{ ...near, expect: larger }], undefined, { examples: [example], cfg: CFG }).leadAgreement, 0)
  assert.equal(score([unk], undefined, { cfg: CFG }).leadAgreement, 0, '읽기가 있는 줄이 없으면 0 — 못 잰 것을 합격으로 치지 않는다')
})

test('대표 축 일치율은 정답 목록 안 어디에 있어도 맞다 · 첫 읽기 일치(leadFirst)는 참고로 따로 센다', () => {
  const second = { ...ok, expect: [R('spacing', 'airy'), R('type-scale', 'larger')] }
  const m = score([second], undefined, { cfg: CFG })
  assert.equal(m.leadAgreement, 1, '「글씨 크게」의 larger 가 정답 목록 두 번째에 있다')
  assert.equal(m.leadFirst, 0, '첫 읽기(spacing airy)와는 다르다')
  const outside = score([{ ...ok, expect: [R('spacing', 'airy'), R('shape', 'round')] }], undefined, { cfg: CFG })
  assert.equal(outside.leadAgreement, 0, '목록에 없으면 틀림')
  const firstToo = score([ok], undefined, { cfg: CFG })
  assert.equal(firstToo.leadFirst, 1)
})

test('반대 방향 적용률: 확정한 읽기만 전체 n 에 견준다 — 근사의 대표 읽기는 적용한 읽기가 아니다(설계 7.2 「확정한 읽기 중」)', () => {
  const cases = [ok, { ...ok, id: 'b' }, { ...ok, id: 'c' }, { ...ok, id: 'd', expect: smaller }]
  const m = score(cases, undefined, { cfg: CFG })
  assert.equal(m.oppositeApply, 0.25)
  assert.equal(m.leadAgreement, 0.75)
  const viaNear = score([{ ...near, expect: larger }], undefined, { examples: [example], cfg: CFG })
  assert.equal(viaNear.counts.near, 1)
  assert.equal(viaNear.oppositeApply, 0, '근사의 대표 읽기(smaller)가 정답(larger)과 반대여도 확정이 아니라 적용한 읽기가 아니다')
  assert.equal(viaNear.leadAgreement, 0, '그 틀림은 대표 읽기 일치율이 잡는다')
  const valueAxis = [{ id: 'v', text: '글씨 크게', kind: 'axis', expect: [{ axis: 'type-family', value: 'mono', strength: 1, scope: 'site' }] }]
  assert.equal(score(valueAxis, undefined, { cfg: CFG }).oppositeApply, 0, '다른 축은 반대가 아니다')
})

test('반대 방향 적용률: 상한(cap)은 그 방향의 반대쪽으로 쏠리라는 뜻으로 센다', () => {
  const capExpect = [R('type-scale', 'larger', 0, { cap: true })] // 「크게 하지 마」
  assert.equal(score([{ ...ok, expect: capExpect }], undefined, { cfg: CFG }).oppositeApply, 1, '확정 larger(상한 없음)는 정답과 반대')
  const noCap = [{ id: 'c', text: '글씨 크게 하지 마', kind: 'modifier', expect: capExpect }]
  assert.equal(score(noCap, undefined, { cfg: CFG }).oppositeApply, 0, '둘 다 상한이면 같은 쪽')
})

test('반대 방향 적용률: 정답 목록에 적용한 읽기와 똑같은 읽기가 있으면 반대가 아니다 — 목록에 상한이 함께 있어도', () => {
  const both = [R('type-scale', 'larger', 1), R('type-scale', 'larger', 0, { cap: true })] // 「크게 하되 너무 크진 않게」
  assert.equal(score([{ ...ok, expect: both }], undefined, { cfg: CFG }).oppositeApply, 0, '확정 larger 는 정답의 첫 읽기 그대로')
  assert.equal(score([{ ...ok, expect: [R('type-scale', 'smaller', 1), R('type-scale', 'smaller', 0, { cap: true })] }], undefined, { cfg: CFG }).oppositeApply, 1, '목록에 같은 읽기가 없으면 반대')
  assert.equal(score([{ ...ok, expect: [R('type-scale', 'larger', 0, { cap: true })] }], undefined, { cfg: CFG }).oppositeApply, 1, '정답이 상한 하나뿐이면 같은 읽기가 없어 반대(그대로)')
})

test('반대 방향 적용률: 읽기가 닿는 곳이 겹칠 때만 반대다 — 같은 종류의 다른 범위(제목·본문)는 겹치지 않는다', () => {
  const title = (d) => R('type-scale', d, 1, { scope: 'element:제목' })
  const body = (d) => R('type-scale', d, 1, { scope: 'element:본문' })
  const both = { id: 's1', text: '제목은 크게 본문은 작게', kind: 'modifier', expect: [title('larger'), body('smaller')] }
  assert.equal(score([both], undefined, { cfg: CFG }).oppositeApply, 0, '제목 크게·본문 작게는 정답 그대로라 반대가 아니다')
  const sameSpot = { id: 's2', text: '제목은 크게', kind: 'modifier', expect: [title('smaller')] }
  assert.equal(score([sameSpot], undefined, { cfg: CFG }).oppositeApply, 1, '같은 곳에서 반대면 반대')
  const otherSpot = { id: 's3', text: '제목은 크게', kind: 'modifier', expect: [body('smaller')] }
  assert.equal(score([otherSpot], undefined, { cfg: CFG }).oppositeApply, 0, '다른 곳의 반대는 반대가 아니다')
  const wholeSite = { id: 's4', text: '제목은 크게', kind: 'modifier', expect: [R('type-scale', 'smaller')] }
  assert.equal(score([wholeSite], undefined, { cfg: CFG }).oppositeApply, 1, '사이트 전체는 어디와도 겹친다')
  const mixedLevel = { id: 's5', text: '제목은 크게', kind: 'modifier', expect: [R('type-scale', 'smaller', 1, { scope: 'section:hero' })] }
  assert.equal(score([mixedLevel], undefined, { cfg: CFG }).oppositeApply, 1, '요소와 구획은 포함할 수 있어 겹친다')
})

test('분류 실패율: 정답에 읽기가 있는데 확정·후보 둘·근사를 못 낸 줄 / 읽기가 있는 줄', () => {
  const m = score([ok, near, unk], undefined, { cfg: CFG })
  assert.equal(m.unclassified, 0.5, '근사 예문이 없으면 near 줄은 실패')
  assert.deepEqual(m.counts, { confirmed: 1, two: 0, near: 0, unknown: 2 })
  const withEx = score([ok, near, unk], undefined, { examples: [example], cfg: CFG })
  assert.equal(withEx.unclassified, 0)
  assert.deepEqual(withEx.counts, { confirmed: 1, two: 0, near: 1, unknown: 1 })
})

test('leave-one-out: 자기 id 의 예문은 쓰지 않는다', () => {
  const self = { ...example, id: near.id }
  const m = score([near], undefined, { examples: [self], cfg: CFG })
  assert.equal(m.counts.near, 0)
  assert.equal(m.unclassified, 1)
})

test('참고 숫자: 완전 일치율(축·방향·값·범위·cap, 세기는 보지 않음) · 내용 문장 확정률', () => {
  const strong = [{ ...ok, id: 's', expect: [R('type-scale', 'larger', 2)] }]
  assert.equal(score(strong, undefined, { cfg: CFG }).exactAgreement, 1)
  const m = score([ok, { ...ok, id: 'b', expect: rounder }, { ...ok, id: 'w', expect: 'ask' }, unk], undefined, { cfg: CFG })
  assert.equal(m.exactAgreement, 0.5)
  assert.equal(m.contentApply, 0.5, '정답이 ask 인 2줄 중 하나를 확정')
})

test('근사 줄은 확정 수에도 완전 일치에도 들지 않는다', () => {
  const m = score([ok, near], undefined, { examples: [example], cfg: CFG })
  assert.equal(m.counts.confirmed, 1)
  assert.equal(m.exactAgreement, 0.5)
})

// 「답답해」: 진단, 원인 둘 → two
const TWO_LEX = `
axes:
  color-hue: { label: 색 }
  color-lightness: { label: 밝기, ends: [dark, bright], endLabels: [어둡게, 밝게] }
  color-saturation: { label: 색의 진하기, ends: [muted, vivid], endLabels: [흐리게, 쨍하게] }
  color-temperature: { label: 색 온도, ends: [cool, warm], endLabels: [차갑게, 따뜻하게] }
  palette-count: { label: 색 가짓수, ends: [fewer, more], endLabels: [적게, 많게] }
  contrast: { label: 대비, ends: [soft, crisp], endLabels: [은은하게, 또렷하게] }
  type-family: { label: 글꼴 }
  type-scale: { label: 글자 크기, ends: [smaller, larger], endLabels: [작게, 크게], order: [D1, D2, D3] }
  spacing: { label: 여백, ends: [tight, airy], endLabels: [빽빽하게, 시원하게] }
  shape: { label: 모서리, ends: [sharp, round], endLabels: [각지게, 둥글게], order: [R0, R1, R2, R3] }
  depth: { label: 입체감, ends: [flat, lifted], endLabels: [납작하게, 떠 보이게] }
  motion: { label: 움직임, ends: [static, dynamic], endLabels: [정적으로, 역동적으로], order: [M0, M1, M2, M3] }
revise: { sections: [], extraSections: [], pages: {} }
entries:
  - id: stuffy
    kind: diagnosis
    label: 답답함
    match: { ko: ["답답"] }
    causes:
      - { reading: [{ axis: spacing, direction: airy, strength: 1 }], say: "여백이 좁아서" }
      - { reading: [{ axis: type-scale, direction: smaller, strength: 1 }], say: "글자가 커서" }
    ask: "어디가 답답해 보여요?"
`

test('후보 둘 적중률: 한쪽 선택지의 대표 읽기가 정답의 대표 읽기와 같으면 적중, 정답이 ask 인 줄은 분모에서 뺀다', () => {
  // 실제 사전에 두 원인짜리 진단을 시험하려고 시험용 사전을 만든다
  const dir = mkdtempSync(join(tmpdir(), 'score-two-'))
  try {
    const f = join(dir, 'lex.yaml')
    writeFileSync(f, TWO_LEX)
    const L = loadLexicon(f)
    const a = [R('spacing', 'airy')]
    const hit = score([{ id: 't1', text: '답답해', kind: 'diagnosis', expect: { two: [a, [R('motion', 'static')]] } }], L, { cfg: CFG })
    assert.equal(hit.twoHit, 1)
    assert.equal(hit.kindAgreement, 1, '후보 둘의 갈래는 진단')
    const hit2 = score([{ id: 't2', text: '답답해', kind: 'diagnosis', expect: smaller }], L, { cfg: CFG }) // 확정형 정답이 선택지 안에 있어도 적중
    assert.equal(hit2.twoHit, 1)
    const miss = score([{ id: 't3', text: '답답해', kind: 'diagnosis', expect: { two: [rounder, larger] } }], L, { cfg: CFG })
    assert.equal(miss.twoHit, 0)
    assert.equal(miss.counts.two, 1)
    assert.equal(miss.leadAgreement, 0)
    const askRow = score([{ id: 't4', text: '답답해', kind: 'diagnosis', expect: 'ask' }], L, { cfg: CFG })
    assert.equal(askRow.counts.two, 1)
    assert.equal(askRow.twoHit, 1, '맞힐 대표 읽기가 없는 줄이라 분모에서 빠지고, 후보 둘이 0건이면 1')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('비교는 cap 없음 = cap false, source 무시, 읽기 순서 무시', () => {
  const cases = [{ id: 'c', text: '글씨 크게', kind: 'axis', expect: [{ axis: 'type-scale', direction: 'larger', strength: 1, scope: 'site', cap: false, source: 'x' }] }]
  assert.equal(score(cases, undefined, { cfg: CFG }).exactAgreement, 1)
})

function evalDir(files) {
  const dir = mkdtempSync(join(tmpdir(), 'score-eval-'))
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body)
  return dir
}
const lines = (n, expect = larger) => Array.from({ length: n }, (_, i) => JSON.stringify({ id: `h-${i}`, text: '글씨 크게', kind: 'axis', expect })).join('\n') + '\n'

test('--release: 검수 파일이 없으면 「검수 대기: 0/M」 종료 2', () => {
  const dir = evalDir({ 'holdout.jsonl': lines(100) })
  try {
    const out = []
    assert.equal(run(['--release'], { dir, log: (s) => out.push(s) }), 2)
    assert.match(out.join('\n'), /검수 대기: 0\/100/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('--release: holdout 이 100줄 미만이면 판정이 다 있어도 종료 2', () => {
  const verdicts = Object.fromEntries(Array.from({ length: 99 }, (_, i) => [`h-${i}`, { verdict: 'ok' }]))
  const dir = evalDir({ 'holdout.jsonl': lines(99), 'holdout.review.json': JSON.stringify({ reviewedAt: '2026-10-16T00:00:00Z', verdicts }) })
  try {
    const out = []
    assert.equal(run(['--release'], { dir, log: (s) => out.push(s) }), 2)
    assert.match(out.join('\n'), /검수 대기: 99\/100/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('--release: 일부만 검수하면 종료 2, 전부 검수하면 잰다(합격 0, 미달 1)', () => {
  const all = Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`h-${i}`, { verdict: 'ok' }]))
  const part = Object.fromEntries(Object.entries(all).slice(0, 60))
  const dirPart = evalDir({ 'holdout.jsonl': lines(100), 'holdout.review.json': JSON.stringify({ verdicts: part }) })
  const dirOk = evalDir({ 'holdout.jsonl': lines(100), 'holdout.review.json': JSON.stringify({ verdicts: all }) })
  const dirFail = evalDir({ 'holdout.jsonl': lines(100, smaller), 'holdout.review.json': JSON.stringify({ verdicts: all }) }) // 정답이 반대 방향 → 대표 축 0%·반대 방향 100%
  try {
    const out = []
    assert.equal(run(['--release'], { dir: dirPart, log: (s) => out.push(s) }), 2)
    assert.match(out.join('\n'), /검수 대기: 60\/100/)
    assert.equal(run(['--release'], { dir: dirOk, log: () => {} }), 0)
    const fail = []
    assert.equal(run(['--release'], { dir: dirFail, log: (s) => fail.push(s) }), 1)
    assert.match(fail.join('\n'), /leadAgreement.*참고/, '사전 단독 관문에서 대표 축 일치율은 참고')
    assert.match(fail.join('\n'), /oppositeApply.*FAIL/)
  } finally {
    for (const d of [dirPart, dirOk, dirFail]) rmSync(d, { recursive: true, force: true })
  }
})

test('--release: 검수 판정 ask 는 정답을 ask 로 바꿔 잰다(내용 문장 확정률이 올라간다)', () => {
  const askAll = Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`h-${i}`, { verdict: 'ask' }]))
  const dir = evalDir({ 'holdout.jsonl': lines(100), 'holdout.review.json': JSON.stringify({ verdicts: askAll }) })
  try {
    const out = []
    run(['--release'], { dir, log: (s) => out.push(s) })
    assert.match(out.join('\n'), /contentApply\s+100\.0%/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('--release: ok|fix|ask 밖의 판정은 검수 안 한 것으로 세고 id 를 찍는다', () => {
  const v = Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`h-${i}`, { verdict: 'ok' }]))
  v['h-3'] = { verdict: 'maybe' }
  v['h-7'] = { verdict: '' }
  const dir = evalDir({ 'holdout.jsonl': lines(100), 'holdout.review.json': JSON.stringify({ verdicts: v }) })
  try {
    const out = []
    assert.equal(run(['--release'], { dir, log: (s) => out.push(s) }), 2)
    assert.match(out.join('\n'), /검수 대기: 98\/100/)
    assert.match(out.join('\n'), /h-3/)
    assert.match(out.join('\n'), /h-7/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('--release: holdout.jsonl 자체가 없으면 「검수 대기: 0/100」', () => {
  const dir = evalDir({})
  try {
    const out = []
    assert.equal(run(['--release'], { dir, log: (s) => out.push(s) }), 2)
    assert.match(out.join('\n'), /검수 대기: 0\/100/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('holdout 의 예문은 같은 폴더의 dev 전체다: dev 줄이 있으면 근사로 분류한다', () => {
  const dev = JSON.stringify({ id: 'd-1', text: '가나다라마바사', kind: 'impression', expect: smaller }) + '\n'
  const hold = JSON.stringify({ id: 'h-1', text: '가나다라마바', kind: 'impression', expect: smaller }) + '\n'
  const dir = evalDir({ 'dev.jsonl': dev, 'holdout.jsonl': hold })
  try {
    const out = []
    run(['--set', 'holdout'], { dir, log: (s) => out.push(s) })
    assert.match(out[0], /근사 1/)
    assert.match(out[0], /예문 1줄/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('실제 CLI: holdout.jsonl 이 없는 폴더에서 --release 는 종료 2', () => {
  const dir = evalDir({})
  const r = spawnSync(process.execPath, [SCORE, '--release', '--dir', dir], { encoding: 'utf8' })
  rmSync(dir, { recursive: true, force: true })
  assert.equal(r.status, 2)
  assert.match(r.stdout, /검수 대기/)
})

test('실제 CLI: dev 묶음을 읽어 지표 표를 찍는다(합격선 미달이면 종료 1, 아니면 0) · --misses 가 있으면 틀린 문장을 찍는다', () => {
  const r = spawnSync(process.execPath, [SCORE, '--set', 'dev'], { encoding: 'utf8' })
  assert.ok([0, 1].includes(r.status), `종료 코드 ${r.status}`)
  for (const k of [...Object.keys(GATES), ...REFERENCE]) assert.match(r.stdout, new RegExp(k))
  assert.doesNotMatch(r.stdout, /miss /)
  const more = spawnSync(process.execPath, [SCORE, '--set', 'dev', '--misses'], { encoding: 'utf8' })
  assert.match(more.stdout, /miss \S+ \[/)
})

test('minSample: 후보 둘이 적은 묶음의 twoHit 은 참고로 찍고 종료 코드에 영향이 없다', () => {
  const dir = mkdtempSync(join(tmpdir(), 'score-minsample-'))
  try {
    const f = join(dir, 'lex.yaml')
    writeFileSync(f, TWO_LEX)
    // 후보 둘 1건이고 정답이 서로 다른 축이라 twoHit 0%
    writeFileSync(join(dir, 'dev.jsonl'), JSON.stringify({ id: 't', text: '답답해', kind: 'diagnosis', expect: { two: [rounder, larger] } }) + '\n')
    const out = []
    const code = run(['--set', 'dev'], { dir, lex: loadLexicon(f), log: (s) => out.push(s) })
    const line = out.find((s) => s.includes('twoHit'))
    assert.match(line, /0\.0%.*참고 · 표본 1 < 40/)
    assert.doesNotMatch(line, /FAIL/)
    assert.equal(code, 1, '다른 지표(대표 축)는 그대로 걸린다')
    assert.match(out.join('\n'), /leadAgreement.*FAIL/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ── copyFrom(시안 비교 말) 결과: 분류됨 · 대표 읽기 없음 ──────────────────────────────────────────
const jsonlOf = (rows) => rows.map((r) => `${JSON.stringify(r)}\n`).join('')

test('score: copyFrom 결과는 분류됨, 대표 읽기 없음으로 세고 죽지 않는다', async () => {
  const { loadPredictions } = await import('../vocab/eval/predictions.mjs')
  const lex = loadLexicon()
  const cases = [
    { id: 'c1', text: '2번 시안처럼', kind: 'reference', expect: 'ask' },
    { id: 'c2', text: '크게', kind: 'axis', expect: larger },
  ]
  const dir = mkdtempSync(join(tmpdir(), 'score-copy-'))
  try {
    const file = join(dir, 'pred.jsonl')
    writeFileSync(file, jsonlOf([{ id: 'c1', result: 'confirmed', kind: 'reference', copyFrom: 'b' }, { id: 'c2', result: 'confirmed', kind: 'reference', copyFrom: 'previous' }]))
    const { predictions, problems } = loadPredictions(file, new Set(['c1', 'c2']), lex)
    assert.deepEqual(problems, [])
    assert.deepEqual(predictions.get('c1'), { result: 'confirmed', kind: 'reference', readings: [], lead: null, copyFrom: 'b' })
    const m = score(cases, lex, { predictions })
    assert.equal(m.counts.confirmed, 2, '분류됨(확정)으로 센다')
    assert.equal(m.unclassified, 0, '못 낸 것이 아니다')
    assert.equal(m.oppositeApply, 0, '읽기가 없으니 반대로 적용하지도 않는다')
    assert.equal(m.leadAgreement, 0, '정답에 읽기가 있는 c2 는 대표 읽기가 없어 틀린 것으로 센다(맞은 것으로 치지 않는다)')
    assert.equal(m.contentApply, 1, '정답이 ask 인 c1 을 확정했으니 내용 적용으로 센다')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('예측 파일: copyFrom 은 confirmed 의 글자 하나로만 — 읽기와 함께, 다른 결과에, 빈 값은 문제로 모은다 · 입력 검사는 { copyFrom } 하나만 받는다', async () => {
  const { loadPredictions, checkReadingsInput } = await import('../vocab/eval/predictions.mjs')
  const lex = loadLexicon()
  const dir = mkdtempSync(join(tmpdir(), 'score-copy-'))
  try {
    const file = join(dir, 'pred.jsonl')
    const rows = [
      { id: 'a', result: 'confirmed', kind: 'reference', copyFrom: 'b', readings: larger },
      { id: 'b', result: 'near', kind: 'reference', copyFrom: 'b' },
      { id: 'c', result: 'confirmed', kind: 'reference', copyFrom: '' },
      { id: 'd', result: 'confirmed', kind: 'reference', copyFrom: 3 },
    ]
    writeFileSync(file, jsonlOf(rows))
    const { problems } = loadPredictions(file, new Set(rows.map((r) => r.id)), lex)
    for (const id of ['a', 'b', 'c', 'd']) assert.ok(problems.some((p) => p.startsWith(`${id}:`)), `${id} 의 문제가 모였다: ${problems.join(' | ')}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
  assert.deepEqual(checkReadingsInput({ copyFrom: 'b' }, lex), [])
  assert.deepEqual(checkReadingsInput({ copyFrom: 'previous' }, lex), [])
  for (const input of [{ copyFrom: '' }, { copyFrom: 2 }, { copyFrom: 'b', readings: larger }, { copyFrom: 'b', options: [] }]) assert.ok(checkReadingsInput(input, lex).length > 0, JSON.stringify(input))
})
