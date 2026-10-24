// 비슷한 예문 찾기 similar — 두 글자 조각 Jaccard 점수 · 상위 k개 · 기준값 · 빈 입력, 그리고 similar.json 설정.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadSimilarConfig, nearest } from '../vocab/similar.mjs'

const lead = (axis, direction) => ({ axis, direction })
const ex = (id, text, kind = 'impression', l = lead('spacing', 'airy')) => ({ id, text, kind, lead: l })
const CFG = { minScore: 0.3, topK: 2 }

test('같은 글자면 점수 1, 후보에는 id·점수·갈래·대표 읽기가 실린다', () => {
  const r = nearest('가나다라마', [ex('e1', '가나다라마', 'axis', lead('shape', 'round'))], CFG)
  assert.deepEqual(r, [{ id: 'e1', score: 1, kind: 'axis', lead: lead('shape', 'round') }])
})

test('점수는 정규화한 붙여쓴 글자의 두 글자 조각 Jaccard: 띄어쓰기와 어미 차이는 점수에 안 든다', () => {
  // 「가나다라마」 조각 4개, 「가나다라마바사」 조각 6개, 겹침 4 → 4/6
  const r = nearest('가나다라마', [ex('e1', '가나다라마바사')], { minScore: 0.1, topK: 1 })
  assert.ok(Math.abs(r[0].score - 4 / 6) < 1e-9)
  const spaced = nearest('가나다 라마', [ex('e1', '가나다라마')], CFG)
  assert.equal(spaced[0].score, 1, '띄어쓰기는 접힌다')
})

test('점수 큰 순서로 topK 개만 · 같은 점수는 예문 순서', () => {
  const examples = [ex('far', '가나마바사아'), ex('mid', '가나다라바사'), ex('best', '가나다라마바'), ex('tie', '가나다라마바')]
  const r = nearest('가나다라마바', examples, { minScore: 0.1, topK: 3 })
  assert.deepEqual(r.map((x) => x.id), ['best', 'tie', 'mid'])
  assert.equal(nearest('가나다라마바', examples, { minScore: 0.1, topK: 1 }).length, 1)
})

test('기준값(minScore) 미만은 뺀다 · 같으면 든다', () => {
  const examples = [ex('e1', '가나다라마바사')] // 4/6 = 0.666…
  assert.equal(nearest('가나다라마', examples, { minScore: 0.67, topK: 2 }).length, 0)
  assert.equal(nearest('가나다라마', examples, { minScore: 0.66, topK: 2 }).length, 1)
  assert.equal(nearest('힣힣힣힣', examples, CFG).length, 0, '겹침이 없으면 후보 없음')
  assert.equal(nearest('가나다라마바사', examples, { minScore: 1, topK: 2 }).length, 1, '점수가 기준값과 같으면 든다')
})

test('빈 예문 · 빈 문장 · 한 글자 문장은 후보가 없다', () => {
  assert.deepEqual(nearest('가나다라마', [], CFG), [])
  assert.deepEqual(nearest('', [ex('e1', '가나다라마')], CFG), [])
  assert.deepEqual(nearest('가', [ex('e1', '가')], CFG), [], '두 글자 조각이 없으면 견줄 수 없다')
})

test('영어도 소문자·접힌 글자로 견준다', () => {
  const r = nearest('Soft And Warm', [ex('e1', 'soft and warm')], CFG)
  assert.equal(r[0].score, 1)
})

test('similar.json: 기준값과 후보 수를 읽는다 · 잘못된 값은 거부한다', () => {
  const cfg = loadSimilarConfig()
  assert.ok(cfg.minScore > 0 && cfg.minScore <= 1)
  assert.equal(cfg.topK, 2)
  const dir = mkdtempSync(join(tmpdir(), 'similar-cfg-'))
  try {
    for (const bad of [{ minScore: 0, topK: 2 }, { minScore: 0.2, topK: 0 }, { minScore: 1.5, topK: 2 }, { topK: 2 }]) {
      const f = join(dir, 'bad.json')
      writeFileSync(f, JSON.stringify(bad))
      assert.throws(() => loadSimilarConfig(f), /similar\.json/)
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
