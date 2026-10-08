// QFIX3-PERF — lh-perf 실패 줄에도 측정 환경(benchmarkIndex·모의 스로틀)과 TBT 를 적는다: PC 가 붐볐는지(낮은 benchmarkIndex)와 LCP 가 아닌 원인(TBT)을 줄 하나에서 가린다.
// 문턱은 그대로다(보고만 늘었다). 실행: node --test --test-force-exit --test-timeout=60000 factory/scripts/stamp-qfix3-perf-env.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { lhrToChecks, THRESHOLDS } from '../qa/ops-gate.mjs'

const lhr = (perf, tbt) => ({
  categories: { performance: { score: perf }, seo: { score: 1 }, accessibility: { score: 1 } },
  environment: { benchmarkIndex: 1922 },
  configSettings: { throttlingMethod: 'simulate', throttling: { cpuSlowdownMultiplier: 4 } },
  audits: {
    'largest-contentful-paint': { numericValue: 1750 },
    'cumulative-layout-shift': { numericValue: 0 },
    'total-blocking-time': { numericValue: tbt },
    'bf-cache': { score: 1, scoreDisplayMode: 'binary' },
    'resource-summary': { details: { items: [{ resourceType: 'script', requestCount: 6, transferSize: 90_000 }] } },
  },
})

test('lh-perf 실패 줄: LCP 말고 TBT 와 측정 환경(benchmarkIndex)을 적고, 통과 줄은 조용하다', () => {
  const bad = lhrToChecks(lhr(0.69, 858), '/').find((c) => c.id === 'lh-perf')
  assert.equal(bad.status, 'fail')
  assert.match(bad.detail.join(' | '), /TBT 858 ms/)
  assert.match(bad.detail.join(' | '), /benchmarkIndex 1922/)
  const ok = lhrToChecks(lhr(0.95, 80), '/').find((c) => c.id === 'lh-perf')
  assert.equal(ok.status, 'pass')
  assert.deepEqual(ok.detail, [])
  assert.equal(THRESHOLDS['lh-perf'], 90, '문턱은 그대로')
})
