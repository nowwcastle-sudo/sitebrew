// 마케팅 관문 행 목록·요약(순수) 시험 — 브라우저 없음. 실행: node --test --test-force-exit --test-timeout=60000 factory/qa/marketing-blocks.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { blockRows, summarize, EXTRA_SCENES } from './marketing-blocks.mjs'
import { RULES } from './marketing-gate.mjs'

test('blockRows: 블록 × 레시피 × 폭, 모든 주소에 frame=1, 조건 화면은 한 행 더', () => {
  const rows = blockRows({
    origin: 'http://localhost:3961/',
    blocks: [{ kind: 'paywall', variant: 'trial-ending' }, { kind: 'faq', variant: 'grouped-by-topic' }],
    recipes: ['r1-measure', 'r7-docs'],
    widths: [1440, 375],
  })
  assert.equal(rows.length, (2 + 1) * 2 * 2)
  for (const r of rows) assert.match(r.url, /^http:\/\/localhost:3961\/qa\/blocks\?b=block-[a-z-]+&r=r[a-z0-9-]+&frame=1/)
  assert.equal(rows.filter((r) => r.query === 'sub=trialing').length, 4)
  assert.ok(rows.every((r) => !r.url.includes('//qa')))
  assert.deepEqual(Object.keys(EXTRA_SCENES).sort(), ['block-confirmation-upgrade-complete', 'block-paywall-trial-ending', 'block-retention-payment-failed-banner', 'block-retention-renewal-consent'])
})

test('summarize: 규칙별 fail·warn·pass·na 를 센다(na 는 통과와 따로)', () => {
  const rules = (status) => RULES.map((r) => ({ id: r.id, status }))
  const s = summarize([{ fail: ['cta-name'], warn: [], rules: rules('na').map((x) => (x.id === 'cta-name' ? { ...x, status: 'fail' } : x)) }, { fail: [], warn: ['flow-markers'], rules: rules('pass') }])
  assert.equal(s.rows, 2)
  assert.equal(s.failRows, 1)
  assert.equal(s.warnRows, 1)
  assert.deepEqual(s.perRule['cta-name'], { fail: 1, warn: 0, pass: 1, na: 0 })
  assert.deepEqual(s.perRule['escrow-notice'], { fail: 0, warn: 0, pass: 1, na: 1 })
})
