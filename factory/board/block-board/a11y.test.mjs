// 블록 갤러리 접근성 행렬 요약(순수) 시험 — 브라우저 없음. 실제 갤러리 실행은 `npm run blocks:a11y -- <origin>`.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { galleryUrl, summarizeRows } from './a11y.mjs'

const row = (block, violations, behaviors = [], exit = null) => ({
  block, exit: exit ?? (violations.some((v) => ['critical', 'serious'].includes(v.impact)) || behaviors.some((b) => b.status === 'fail') ? 1 : 0), warnings: [], matrix: [{}, {}, {}, {}, {}, {}], incomplete: [],
  violations: violations.map((v) => ({ mode: 'light', width: 1440, kwcag: null, count: 1, nodes: [], ...v })),
  behaviors: ['focus-not-obscured', 'redundant-entry', 'authentication', 'target-size'].map((id) => behaviors.find((b) => b.id === id) ?? { id, status: 'na', fail: [], warn: [] }),
})

test('galleryUrl: frame=1 gallery address of one block on one recipe', () => {
  assert.equal(galleryUrl('http://localhost:3000/', 'block-nav-a', 'r1-measure'), 'http://localhost:3000/qa/blocks?b=block-nav-a&r=r1-measure&frame=1')
})

test('summarizeRows: failing blocks, mode-only breaks, rule table (serious first), behavior counts with na separate', () => {
  const rows = [
    row('block-a', [{ rule: 'color-contrast', impact: 'serious', mode: 'dark' }]),
    row('block-b', [{ rule: 'color-contrast', impact: 'serious', mode: 'dark' }, { rule: 'color-contrast', impact: 'serious', mode: 'light' }]),
    row('block-c', [{ rule: 'region', impact: 'moderate', mode: 'light' }]),
    row('block-d', [], [{ id: 'target-size', status: 'fail', fail: ['20x20'], warn: [] }, { id: 'authentication', status: 'pass', fail: [], warn: [] }]),
    row('block-e', []),
  ]
  const s = summarizeRows(rows)
  assert.equal(s.blocks, 5)
  assert.equal(s.cells, 30)
  assert.deepEqual(s.failedBlockNames, ['block-a', 'block-b', 'block-d'])
  assert.equal(s.ok, false)
  assert.deepEqual(s.modeOnly.dark, ['block-a:color-contrast']) // block-b 는 라이트에서도 깨진다
  assert.equal(s.blocksFailingByMode.dark, 2)
  assert.equal(s.rules[0].rule, 'color-contrast')
  assert.equal(s.rules[0].fail, true)
  assert.equal(s.rules[0].blocks, 2)
  assert.deepEqual(s.rules[0].byMode, { dark: 2, light: 1 })
  assert.equal(s.rules[1].fail, false)
  assert.deepEqual([s.behaviors['target-size'].pass, s.behaviors['target-size'].fail, s.behaviors['target-size'].na], [0, 1, 4])
  assert.deepEqual([s.behaviors.authentication.pass, s.behaviors.authentication.na], [1, 4])
  assert.equal(summarizeRows([row('block-e', [])]).ok, true)
})
