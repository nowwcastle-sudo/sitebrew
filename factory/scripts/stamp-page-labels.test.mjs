// C304 — 쪽 이름표(PAGE_LABELS) 가드. 원형 JSON 9개의 모든 쪽 id(법정 쪽 포함)가 ko·en 이름표를 가져야 한다.
// 빠지면 pageLabel 이 id 를 영문 그대로(「sub detail」「offline」) 제목·메뉴에 내보낸다(골든 pwa-2/a 실물).
// 실행: node --test --test-force-exit --test-timeout=60000 factory/scripts/stamp-page-labels.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PAGE_LABELS, pageLabel } from '../stamp/site-bind.mjs'

const root = join(import.meta.dirname, '..', '..')
const dir = join(root, 'registry', 'factory', 'archetypes')
const archetypes = readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')))

test('C304: 원형 JSON 10개를 읽었다(양성 대조 — 훑을 모집단이 비어 있지 않다)', () => {
  assert.equal(archetypes.length, 10)
  assert.ok(archetypes.every((a) => a.pages.length > 0))
})

test('C304: 모든 원형 쪽 id·법정 쪽 id 가 ko·en 이름표를 가진다(id 영문 그대로 나가지 않는다)', () => {
  const missing = []
  const ids = new Set()
  for (const a of archetypes) {
    for (const p of a.pages) ids.add(p.id)
    for (const id of a.legal?.pages ?? []) ids.add(id)
  }
  assert.ok(ids.size >= 25, `쪽 id ${ids.size}개 — 모집단이 너무 작다`)
  for (const id of ids) for (const loc of ['ko', 'en']) {
    const l = PAGE_LABELS[id]?.[loc]
    if (!l || typeof l !== 'string' || !l.trim()) missing.push(`${id}/${loc}`)
    else if (l === id.replace(/-/g, ' ')) missing.push(`${id}/${loc}(id 그대로)`)
  }
  assert.deepEqual(missing, [])
})

test('C304: 한국어 이름표에 영문이 새지 않고, 영어 이름표는 비어 있지 않다(음성 대조 포함)', () => {
  for (const [id, l] of Object.entries(PAGE_LABELS)) {
    assert.ok(!/[A-Za-z]/.test(l.ko), `${id} ko 에 영문: ${l.ko}`)
    assert.ok(/[A-Za-z]/.test(l.en), `${id} en: ${l.en}`)
  }
  // 이름표가 없는 id 는 옛 대체값(영문 id)으로 떨어진다 — 가드가 잡는 모양
  assert.equal(pageLabel('no-such-page', 'ko'), 'no such page')
  assert.notEqual(pageLabel('sub-detail', 'ko'), 'sub detail')
  assert.notEqual(pageLabel('offline', 'en'), 'offline')
})
