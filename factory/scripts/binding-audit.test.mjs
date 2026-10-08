// FV1 Task 5.11 (C5 자료 연결) — binder 빈자리 감사. 「골든 브리프의 사실이 모두 있다」고 가정한 콘텐츠로 실제 bindSection 을 돌려
// 원형 10 × 사이트맵 섹션 × 허용 변형마다 「자료 연결 안 됨」이 나는 자리를 센다(factory/stamp/binding-audit.mjs — 03 의 leakTable 과 같은 방식).
// 실행: node --test --test-force-exit --test-timeout=300000 factory/scripts/binding-audit.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bindingAudit, rowKey, KNOWN_GAPS } from '../stamp/binding-audit.mjs'

test('골든 사실이 다 있으면 필수 섹션에 「자료 연결 안 됨」이 없다(C5 자료 연결)', async () => {
  const rows = await bindingAudit({ requiredOnly: true })
  assert.deepEqual(rows.filter((r) => r.issue === 'unbound').map((r) => `${r.archetype}:${r.section}:${r.variant}`), [])
})

test('binder 가 던지는 자리도 없다(감사가 binder 를 끝까지 돌렸다)', async () => {
  const rows = await bindingAudit({ requiredOnly: false })
  assert.deepEqual(rows.filter((r) => r.issue === 'throws').map(rowKey), [])
})

test('알려진 빈자리(KNOWN_GAPS)는 이유와 대장 행이 있고, 감사에 실제로 나타난다 — 낡은 항목이 남지 않는다', async () => {
  const rows = await bindingAudit({ requiredOnly: false })
  const seen = new Set(rows.filter((r) => r.issue === 'known-gap').map((r) => `${r.archetype}:${r.section}`))
  for (const g of KNOWN_GAPS) {
    assert.ok(g.why && g.why.length >= 10, `${g.archetype}:${g.section} 이유`)
    assert.ok(Array.isArray(g.register) && g.register.length, `${g.archetype}:${g.section} 대장 행`)
    assert.ok(seen.has(`${g.archetype}:${g.section}`), `${g.archetype}:${g.section} 는 이제 감사에서 사라졌다 — 목록에서 뺀다`)
  }
})

test('감사는 원형 10종을 모두 돈다(landing 포함) — 손으로 적은 표가 아니다', async () => {
  const rows = await bindingAudit({ requiredOnly: false, includeBound: true })
  const archetypes = new Set(rows.map((r) => r.archetype))
  assert.deepEqual([...archetypes].sort(), ['brand', 'commerce', 'dashboard', 'detail', 'landing', 'local', 'portfolio', 'public', 'pwa', 'saas'])
  assert.ok(rows.some((r) => r.issue === 'bound'), '묶인 자리도 센다(양성 대조)')
})

test('감사 콘텐츠(maxContent)는 원형 10종 모두 콘텐츠 스키마 검사를 통과한다 — 06 이 받는 콘텐츠와 같은 모양이라 감사가 믿을 만하다', async () => {
  const { maxContent } = await import('../stamp/binding-audit.mjs')
  const { loadContentSchema } = await import('../stamp/content.mjs')
  for (const id of ['brand', 'commerce', 'dashboard', 'detail', 'local', 'portfolio', 'public', 'pwa', 'saas', 'landing']) {
    const r = loadContentSchema(id).safeParse(maxContent(id))
    assert.equal(r.success, true, `${id}: ${r.success ? '' : r.error.issues.slice(0, 3).map((i) => `${i.path.join('.')} — ${i.message}`).join(' | ')}`)
  }
})

test('묶인 props 의 $ref 는 모두 콘텐츠에 있는 경로다 — 원형 × 허용 변형 전수(landing plans.0.price 어긋남이 06 에서야 터졌다)', async () => {
  const rows = await bindingAudit({ requiredOnly: false })
  assert.deepEqual(rows.filter((r) => r.issue === 'dangling-ref').map((r) => `${rowKey(r)} → ${r.why}`), [])
})

test('감사의 dangling-ref 검사는 양성 대조가 있다 — 없는 경로를 가리키면 잡는다', async () => {
  const { dangling } = await import('../stamp/binding-audit.mjs')
  assert.deepEqual(dangling({ a: { $ref: 'plans.0.monthlyPrice' } }, { plans: [{ price: 1 }] }), ['plans.0.monthlyPrice'])
  assert.deepEqual(dangling({ a: { $ref: 'plans.0.price' } }, { plans: [{ price: null }] }), [])
})
