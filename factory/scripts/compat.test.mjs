import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { checkCompat, checkCompatWarnings, checkRecipeRules, checkAxisRecipeRules, COMPAT } from './compat.mjs'

// 브리프 Step 1 의 네 경우 — 음성 대조 셋, 양성(0) 하나.
test('B4 pill button with C2 line-division surface → 1 violation (radius family)', () => {
  const v = checkCompat({ button: 'B4', surface: 'C2' })
  assert.equal(v.length, 1, v.join('\n'))
  assert.match(v[0], /반경 계열/)
})

test('S2 hard offset shadow with R1 radius → violation', () => {
  const v = checkCompat({ shadow: 'S2', radius: 'R1' })
  assert.equal(v.length, 1, v.join('\n'))
  assert.match(v[0], /S2/)
})

test('C5 glass surface on a dashboard archetype → violation', () => {
  const v = checkCompat({ surface: 'C5' }, 'dashboard')
  assert.equal(v.length, 1, v.join('\n'))
  assert.match(v[0], /C5/)
  assert.deepEqual(checkCompat({ surface: 'C5' }, 'saas'), [])
})

test('a mid-family selection with R1 → 0 violations (mid × large is allowed)', () => {
  assert.deepEqual(checkCompat({ button: 'B3', input: 'I1', surface: 'C1', table: 'T2', header: 'H1', radius: 'R1', shadow: 'S1' }), [])
})

// 더: 표의 나머지 줄과 입력 검사.
test('explicit forbidden pairs outside the radius families', () => {
  assert.equal(checkCompat({ table: 'T1', surface: 'C4' }).length, 1)
  assert.equal(checkCompat({ input: 'I4', table: 'T1' }).length, 1)
  assert.equal(checkCompat({ header: 'H4', button: 'B4' }).length, 1)
})

test('S3 clay only with R1; H4 side rail only on dashboard', () => {
  assert.equal(checkCompat({ shadow: 'S3', radius: 'R0' }).length, 1)
  assert.equal(checkCompat({ shadow: 'S3', radius: 'R2' }).length, 1)
  assert.deepEqual(checkCompat({ shadow: 'S3', radius: 'R1' }), [])
  assert.equal(checkCompat({ header: 'H4' }, 'saas').length, 1)
  assert.deepEqual(checkCompat({ header: 'H4', table: 'T1', surface: 'C1' }, 'dashboard'), [])
})

test('a full brutal selection is compatible', () => {
  assert.deepEqual(checkCompat({ button: 'B1', input: 'I3', surface: 'C2', table: 'T4', header: 'H3', radius: 'R0', shadow: 'S2' }), [])
})

test('line-division values need 3:1 line contrast when a ratio is given', () => {
  assert.deepEqual(checkCompat({ surface: 'C2' }, undefined, { lineContrast: 7.1 }), [])
  const v = checkCompat({ surface: 'C2', table: 'T4' }, undefined, { lineContrast: 2.4 })
  assert.equal(v.length, 1, v.join('\n'))
  assert.match(v[0], /3:1/)
})

test('unknown values and values on the wrong axis are violations', () => {
  assert.equal(checkCompat({ button: 'B9' }).length, 1)
  assert.equal(checkCompat({ button: 'C1' }).length, 1)
  assert.equal(checkCompat({ colour: 'K1' }).length, 1)
})

// 리뷰 1회차: 반경 축이 없는 부분 선택에서도 계열 검사가 돈다(S2 0 계열, S3·C5 큰 반경, H4 중간).
test('S2/S3/C5/H4 carry a radius family, so partial selections are checked (review I3, M9)', () => {
  for (const sel of [{ shadow: 'S2', button: 'B4' }, { shadow: 'S2', surface: 'C4' }, { shadow: 'S3', button: 'B1' }, { shadow: 'S3', surface: 'C2' },
    { button: 'B1', surface: 'C5' }, { radius: 'R0', surface: 'C5' }]) {
    const v = checkCompat(sel)
    assert.equal(v.length, 1, `${JSON.stringify(sel)} → ${v.join(' | ')}`)
    assert.match(v[0], /반경 계열/)
  }
  assert.equal(checkCompat({ header: 'H4', button: 'B1', radius: 'R0' }, 'dashboard').length, 1)
})

test('T1 pairs only with C1 or C2 (review I4)', () => {
  for (const s of ['C3', 'C4', 'C5']) assert.equal(checkCompat({ table: 'T1', surface: s }).length, 1, s)
  for (const s of ['C1', 'C2']) assert.deepEqual(checkCompat({ table: 'T1', surface: s }), [], s)
})

test('ruling M16: zero × mid radius families are forbidden', () => {
  const v = checkCompat({ radius: 'R0', button: 'B3', surface: 'C1' })
  assert.equal(v.length, 1, v.join('\n'))
  assert.match(v[0], /zero\(R0\) × mid\(B3·C1\)/)
  assert.deepEqual(checkCompat({ radius: 'R1', button: 'B3', surface: 'C1' }), []) // 중간 × 큰 반경은 허용
})

test('cautions come back as warnings, not violations (review M14)', () => {
  assert.deepEqual(checkCompat({ input: 'I2', surface: 'C3' }), [])
  assert.equal(checkCompatWarnings({ input: 'I2', surface: 'C3' }).length, 1)
  assert.match(checkCompatWarnings({ header: 'H4' }).join('\n'), /dashboard 전용/)
  assert.deepEqual(checkCompatWarnings({ header: 'H4' }, 'dashboard'), [])
  assert.match(checkCompatWarnings({ surface: 'C5' }).join('\n'), /모달 배경에만/)
})

test('CLI: first selection argument counts, exit 1 on violation, --archetype applies', () => {
  const run = (...a) => spawnSync(process.execPath, [fileURLToPath(new URL('./compat.mjs', import.meta.url)), ...a], { encoding: 'utf8' })
  assert.equal(run('button=B4', 'surface=C2').status, 1)
  assert.equal(run('button=B1', 'input=I3', 'surface=C2', 'table=T4', 'header=H3', 'radius=R0', 'shadow=S2').status, 0)
  assert.equal(run('surface=C5', '--archetype', 'dashboard').status, 1)
  assert.equal(run().status, 2)
})

test('every value named in compat.json exists on some axis', () => {
  const all = new Set(Object.values(COMPAT.axes).flat())
  for (const v of Object.values(COMPAT.families).flat()) assert.ok(all.has(v), v)
  for (const pair of COMPAT.forbidden) for (const v of pair.values) assert.ok(all.has(v), v)
  for (const c of COMPAT.conditional) for (const v of c.values) assert.ok(all.has(v), v)
  for (const c of COMPAT.cautions) for (const v of c.values) assert.ok(all.has(v), v)
})

// Task 6b: 레시피 필드(motion·colorLogic) × 원형 — DESIGN §8-6 div-06(M3), §5-B 색 논리.
test('recipeRules: M3 × dashboard·public and K8 × public are violations; K6·K7·K8 × dashboard are cautions', () => {
  assert.equal(checkRecipeRules({ motion: 'M3' }, 'dashboard').violations.length, 1)
  assert.equal(checkRecipeRules({ motion: 'M3' }, 'public').violations.length, 1)
  assert.deepEqual(checkRecipeRules({ motion: 'M3' }, 'saas'), { violations: [], warnings: [] })
  assert.equal(checkRecipeRules({ colorLogic: 'K8' }, 'public').violations.length, 1)
  for (const k of ['K6', 'K7', 'K8']) {
    const r = checkRecipeRules({ colorLogic: k }, 'dashboard')
    assert.deepEqual(r.violations, [], k)
    assert.equal(r.warnings.length, 1, k)
  }
  assert.deepEqual(checkRecipeRules({ motion: 'M2', colorLogic: 'K1' }, 'dashboard'), { violations: [], warnings: [] })
  for (const rule of [...COMPAT.recipeRules.forbidden, ...COMPAT.recipeRules.cautions]) assert.ok(['motion', 'colorLogic'].includes(rule.field), rule.field)
})

// ── Task 16a: 새 축 값의 호환 규칙(음성 대조 포함) ──
test('C6 bold-border colour card: only with R0 and S2 — the neo-brutal set passes, other shadows or radii are named violations', () => {
  assert.deepEqual(checkCompat({ button: 'B1', input: 'I3', surface: 'C6', table: 'T4', header: 'H3', radius: 'R0', shadow: 'S2' }), [])
  const s0 = checkCompat({ surface: 'C6', radius: 'R0', shadow: 'S0' })
  assert.equal(s0.length, 1, s0.join('\n'))
  assert.match(s0[0], /C6 는 shadow=S2/)
  const r1 = checkCompat({ surface: 'C6', radius: 'R1', shadow: 'S2' })
  assert.ok(r1.some((m) => /반경 계열 충돌/.test(m)) && r1.some((m) => /C6 는 radius=R0/.test(m)), r1.join('\n'))
  // 선 구획 예외: 잉크 테두리 3:1
  assert.equal(checkCompat({ surface: 'C6', radius: 'R0', shadow: 'S2' }, undefined, { lineContrast: 2.4 }).length, 1)
})

test('C8 · H5 · D2 · D3 · X1~X3 archetype limits (negative controls) and positive cases', () => {
  assert.equal(checkCompat({ surface: 'C8' }, 'public').length, 1)
  assert.deepEqual(checkCompat({ surface: 'C8', radius: 'R0' }, 'brand'), [])
  assert.equal(checkCompat({ header: 'H5' }, 'dashboard').length, 1)
  assert.deepEqual(checkCompat({ header: 'H5', button: 'B2', surface: 'C1', radius: 'R1' }, 'brand'), [])
  assert.equal(checkCompat({ header: 'H5', button: 'B1' }).length, 1, 'H5 is mid family — clashes with zero')
  for (const d of ['D2', 'D3']) { assert.equal(checkCompat({ display: d }, 'dashboard').length, 1, d); assert.equal(checkCompat({ display: d }, 'public').length, 1, d); assert.deepEqual(checkCompat({ display: d }, 'portfolio'), [], d) }
  assert.deepEqual(checkCompat({ display: 'D1', texture: 'X0' }, 'dashboard'), [])
  assert.equal(checkCompat({ texture: 'X1' }, 'dashboard').length, 1)
  assert.deepEqual(checkCompat({ texture: 'X1' }, 'public'), [])
  for (const x of ['X2', 'X3']) assert.equal(checkCompat({ texture: x }, 'public').length, 1, x)
  assert.equal(checkCompat({ display: 'D9' }).length, 1)
  assert.equal(checkCompat({ texture: 'D2' }).length, 1)
})

test('R3 organic is in the large family (controls stay R1): fine with R1-family parts, clashes with zero values', () => {
  assert.deepEqual(checkCompat({ radius: 'R3', button: 'B4', surface: 'C3', shadow: 'S1' }), [])
  assert.equal(checkCompat({ radius: 'R3', button: 'B1' }).length, 1)
  assert.deepEqual(checkCompat({ radius: 'R3', shadow: 'S3' }), [], 'clay stays allowed — R3 controls are R1')
})

test('axisRecipeRules: D3 kinetic × motion M0 is a violation; M1+ passes; other axes do not trigger it', () => {
  assert.equal(checkAxisRecipeRules({ display: 'D3' }, { motion: 'M0' }).length, 1)
  assert.match(checkAxisRecipeRules({ display: 'D3' }, { motion: 'M0' })[0], /D3 × motion=M0/)
  assert.deepEqual(checkAxisRecipeRules({ display: 'D3' }, { motion: 'M1' }), [])
  assert.deepEqual(checkAxisRecipeRules({ display: 'D2' }, { motion: 'M0' }), [])
  assert.deepEqual(checkAxisRecipeRules({}, { motion: 'M0' }), [])
})
