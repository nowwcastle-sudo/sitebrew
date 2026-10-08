// texture-contrast.mjs 의 순수 판정 함수 시험 — 양성(통과)·음성(문턱 미달·흐림 어김·불투명도 미달·측정 없음) 대조. 브라우저는 쓰지 않는다(qa:measure 가 실제 화면에서 잰다).
import test from 'node:test'
import assert from 'node:assert/strict'
import { textureCellFailures, reducedTransparencyFailures, summarize, TEXT_MIN, WASH_MIN, BLUR_MAX } from './texture-contrast.mjs'

const cell = (key, o = {}) => ({ key, overlay: false, backdrop: 'none', wash: 90, crop: 0, ...o })
const rows = (key, v = {}) => Object.keys(TEXT_MIN).map((role) => ({ key, role, p5: v[role] ?? 20, min: (v[role] ?? 20) - 1, n: 100 }))
const ok = (key, c = {}) => ({ cells: [cell(key, c)], rows: rows(key), boxes: 4, scrollW: 100, innerW: 100 })

test('texture-contrast: thresholds are body/muted 7 and title/button 4.5, wash 92, blur 20', () => {
  assert.deepEqual(TEXT_MIN, { body: 7, muted: 7, title: 4.5, button: 4.5 })
  assert.equal(WASH_MIN, 92); assert.equal(BLUR_MAX, 20)
})

test('texture-contrast: a good flowing cell passes', () => {
  assert.deepEqual(textureCellFailures(ok('X4|r1-measure|own'), { expectCells: 1 }), [])
})

test('texture-contrast: p5 below the line fails per role (7 for body/muted, 4.5 for title/button)', () => {
  const tc = { ...ok('X5|r8-dusk|own'), rows: rows('X5|r8-dusk|own', { body: 6.99, muted: 7.0, title: 4.4, button: 4.5 }) }
  const f = textureCellFailures(tc)
  assert.equal(f.length, 2)
  assert.ok(f.some((m) => m.includes('본문') && m.includes('6.99')))
  assert.ok(f.some((m) => m.includes('제목') && m.includes('4.40')))
})

test('texture-contrast: zero measured boxes or a missing role is a failure, not a pass', () => {
  assert.ok(textureCellFailures({ cells: [cell('X4|a|own')], rows: [], boxes: 0, scrollW: 1, innerW: 1 }).some((m) => m.includes('측정 없음')))
  const tc = ok('X4|a|own'); tc.rows = tc.rows.filter((r) => r.role !== 'button')
  assert.ok(textureCellFailures(tc).some((m) => m.includes('버튼') && m.includes('못 쟀다')))
})

test('texture-contrast: expected cell count is enforced', () => {
  assert.ok(textureCellFailures(ok('X4|a|own'), { expectCells: 33 }).some((m) => m.includes('칸 1개')))
})

test('texture-contrast: backdrop blur on a flowing (non-overlay) cell fails (allow condition 2)', () => {
  assert.ok(textureCellFailures(ok('X7|r1|own', { backdrop: 'blur(14px) saturate(1.35)' })).some((m) => m.includes('흐르는 구획')))
})

test('texture-contrast: overlay glass needs a blur up to 20px and wash >= 92%', () => {
  const good = ok('X8|r1|worst', { overlay: true, backdrop: 'blur(18px) saturate(1.35)', wash: 92 })
  assert.deepEqual(textureCellFailures(good), [])
  assert.ok(textureCellFailures(ok('X8|r1|worst', { overlay: true, backdrop: 'none', wash: 92 })).some((m) => m.includes('흐림이 없다')))
  assert.ok(textureCellFailures(ok('X8|r1|worst', { overlay: true, backdrop: 'blur(24px)', wash: 92 })).some((m) => m.includes('24px')))
  assert.ok(textureCellFailures(ok('X8|r1|worst', { overlay: true, backdrop: 'blur(18px)', wash: 90 })).some((m) => m.includes('90%')))
})

test('texture-contrast: horizontal overflow fails', () => {
  assert.ok(textureCellFailures(ok('X4|a|own', { crop: 12 })).some((m) => m.includes('넘친다')))
  assert.ok(textureCellFailures({ ...ok('X4|a|own'), scrollW: 120, innerW: 100 }).some((m) => m.includes('넘친다')))
})

test('texture-contrast: reduced transparency needs blur off and wash 100 on every glass cell', () => {
  assert.deepEqual(reducedTransparencyFailures([{ key: 'X7|a|glass-a', backdrop: 'none', wash: 100 }]), [])
  assert.equal(reducedTransparencyFailures([{ key: 'k', backdrop: 'blur(14px)', wash: 92 }]).length, 2)
  assert.ok(reducedTransparencyFailures([]).length === 1)
})

test('texture-contrast: summarize keeps p5 and min per cell and role', () => {
  const s = summarize({ rows: [{ key: 'k', role: 'body', p5: 9.876, min: 8.1, n: 3 }] })
  assert.deepEqual(s, { k: { body: { p5: 9.88, min: 8.1 } } })
})
