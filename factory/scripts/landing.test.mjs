// landing 원형(factory v1 흐름 5 · Task 5.5) — 원형 JSON·브리프 스키마·01~03 배선.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadArchetypes, loadBlockIndex, checkArchetypes } from './archetypes.mjs'
import { loadBriefObject } from '../stamp/brief.mjs'
import { runGolden } from '../stamp/golden.mjs'
import { defaultDeps } from '../stamp/stamp.mjs'
import { EVENTS } from '../../registry/factory/contract/events.ts'

test('landing 원형: 필수 섹션마다 허용 블록이 있다', async () => {
  const a = (await loadArchetypes()).landing
  assert.ok(a, 'landing.json 없음')
  const home = a.pages.find((p) => p.id === 'home')
  assert.ok(home, 'home 쪽 없음')
  for (const s of home.sections.filter((x) => x.required)) assert.ok(s.allowedVariants.length > 0 || s.noBlock, `${s.kind} 블록 없음`)
})

test('landing 원형: 블록 묶음 검사 통과 · 전환 이름은 계약 EVENTS 안 · 법정 쪽 privacy·terms', async () => {
  const all = await loadArchetypes()
  const { names, fit } = loadBlockIndex()
  assert.deepEqual(checkArchetypes({ landing: all.landing }, names, fit), [])
  for (const c of all.landing.conversion) assert.ok(EVENTS.includes(c.event), `계약에 없는 전환 ${c.event}`)
  assert.deepEqual([...all.landing.legal.pages].sort(), ['privacy', 'terms'])
  assert.equal(all.landing.completion, 'site')
  assert.deepEqual(all.landing.locales, ['ko', 'en'])
})

test('입구 답 → 브리프가 넓히기 없이 landing 을 받는다', () => {
  assert.doesNotThrow(() => loadBriefObject({ topic: '행사 사전 등록 예시', archetype: 'landing', locale: 'ko', facts: { name: '예시 행사' } }))
})

test('landing 브리프로 01~03 이 세 안을 낸다', { timeout: 170_000 }, async () => {
  const real = await defaultDeps({ say: () => {} })
  const deps = { ...real, doctor: async () => ({ ok: true, results: [] }) }
  const dir = mkdtempSync(join(tmpdir(), 'landing-run-'))
  try {
    const r = await runGolden('landing-1', { until: '03', runDir: join(dir, 'one'), deps })
    assert.equal(r.candidates.length, 3, JSON.stringify(r.summary.failures))
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
