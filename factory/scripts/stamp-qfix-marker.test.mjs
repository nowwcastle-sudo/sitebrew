// FV1 Task 6.3 원인 고치기(QFIX) [2] — 골든 브리프 사실의 「예시」 표지가 06 「예시 문구 남음」 검사에 걸리던 충돌.
// 판단: 공개 불가 검사는 실제 사용자를 위해 엄격하게 둔다. 골든은 가상 사업이라는 표시가 사업 이름 끝 하나(「(예시)」·"(example)")로 충분하다 — 그 밖의 사실 값에서 「예시」를 뺀다.
// 실행: node --test --test-force-exit --test-timeout=200000 factory/scripts/stamp-qfix-marker.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { hasExampleMarker, hasExampleMarkerAt } from '../stamp/site-bind.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const GOLDEN = join(HERE, '..', 'stamp', 'briefs', 'golden')
const goldenBriefs = () => readdirSync(GOLDEN).filter((f) => f.endsWith('.json')).map((f) => ({ id: f.replace(/\.json$/, ''), brief: JSON.parse(readFileSync(join(GOLDEN, f), 'utf8')) }))

test('[2] 골든 브리프의 사실 값에는 「예시」 표지가 없다 — 사업 이름 끝 하나(「(예시)」·"(example)")만 허용(topic 은 사실이 아니다)', () => {
  const bad = []
  for (const { id, brief } of goldenBriefs()) {
    for (const [k, v] of Object.entries(brief.facts)) {
      const ok = k === 'name' || k === 'legalName' || k === 'seller' ? !hasExampleMarkerAt(`facts.${k}`, v) : !hasExampleMarker(v)
      if (!ok) bad.push(`${id}.${k} = ${v}`)
    }
  }
  assert.deepEqual(bad, [], `예시 표지가 든 사실:\n${bad.join('\n')}`)
})

test('[2] 면제는 사업 이름 칸 끝의 표지 하나뿐이다 — 다른 칸·이름 가운데·두 번째 표지는 그대로 표지다(실제 사용자를 위한 엄격 검사 유지)', () => {
  // 면제: 이름 칸(name·legalName·short_name)의 맨 끝 「(예시)」·"(example)" 하나
  assert.equal(hasExampleMarkerAt('business.name', '하루볶음 (예시)'), false)
  assert.equal(hasExampleMarkerAt('organization.legalName', '주식회사 솔결재 (예시)'), false)
  assert.equal(hasExampleMarkerAt('facts.name', 'Fernwick Tea Co. (example)'), false)
  assert.equal(hasExampleMarkerAt('manifest.short_name', '달림장(예시)'), false)
  // 엄격: 이름 가운데·앞·두 번 이상은 표지
  assert.equal(hasExampleMarkerAt('business.name', '예시 하루볶음'), true)
  assert.equal(hasExampleMarkerAt('business.name', '하루볶음 (예시) 본점'), true)
  assert.equal(hasExampleMarkerAt('business.name', '하루볶음 (예시) (예시)'), true)
  assert.equal(hasExampleMarkerAt('business.name', '예시보건지소'), true)
  // 엄격: 이름이 아닌 칸은 끝 표지도 표지다
  assert.equal(hasExampleMarkerAt('business.address', '서울특별시 성동구 성수로 12 (예시)'), true)
  assert.equal(hasExampleMarkerAt('shipping.courier', '택배 (예시)'), true)
  assert.equal(hasExampleMarkerAt('slots.copy.3.text', '하루볶음 (예시)'), true)
  // 기존 판정(번지 붙은 도로명)은 그대로
  assert.equal(hasExampleMarkerAt('business.address', '서울특별시 성동구 예시로 12, 1층'), false)
  assert.equal(hasExampleMarkerAt('business.address', '이 문구는 예시로 쓰세요'), true)
})
