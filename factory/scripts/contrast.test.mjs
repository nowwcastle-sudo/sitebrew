import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { ratio, alphaOf } from './lib/contrast-lib.mjs'
import { readFileSync } from 'node:fs'
import { STATUS_THEME } from './recipe.mjs'

const CLI = fileURLToPath(new URL('./contrast.mjs', import.meta.url))
const run = (...a) => spawnSync(process.execPath, [CLI, ...a], { encoding: 'utf8' })

test('default run checks the theme body pairs in both themes', () => {
  const r = run()
  assert.equal(r.status, 0, r.stdout + r.stderr)
  assert.match(r.stdout, /필수 20쌍 모두 통과/)
  // 상태 토큰(T7r1-c3): 세 상태 × (글자/상태 4.5 · 상태/배경 3) × 두 테마
  for (const s of ['success', 'warning', 'info']) assert.equal(r.stdout.split('--' + s + '-foreground / --' + s + ' ').length - 1, 2, s)
})

test('--pair measures one pair in light and dark against 3:1 (line-division lines)', () => {
  const ok = run('--pair', 'foreground', 'background')
  assert.equal(ok.status, 0, ok.stdout)
  assert.match(ok.stdout, /light --foreground \/ --background/)
  assert.match(ok.stdout, /dark {2}--foreground \/ --background/)
  // 음성 대조: 기본 테마의 --border 는 1.3:1 — 선 구획 선으로 쓸 수 없다.
  const bad = run('--pair', 'border', 'background')
  assert.equal(bad.status, 1, bad.stdout)
  assert.match(bad.stdout, /FAIL/)
  assert.equal(run('--pair', 'border', 'background', '--min', '1.2').status, 0)
  assert.equal(run('--pair', 'nope', 'background').status, 2)
})

test('a theme file given alone is the file that gets measured (Task 5 review open issue 3 regression)', () => {
  // r2-signal 라이트 글자/바탕 18.82(선택 보드 3판·Task 14 — 2판(f00aee5)에서 승격했던 옛 B 팔레트를 다시 옛 A 빨강·코발트 팔레트로 되돌렸다,
  // 2판 값 13.63 은 그 사이 잠깐의 상태였다) — 기본 테마(16.54)가 아니라 준 파일을 잰다.
  const file = fileURLToPath(new URL('../../registry/factory/r/r2-signal/r2-signal.css', import.meta.url))
  const r = run(file)
  assert.equal(r.status, 0, r.stdout + r.stderr)
  assert.match(r.stdout, /light --foreground \/ --background +18\.82/)
  assert.doesNotMatch(r.stdout, /16\.54/)
  // --pair 와 함께 줘도 그 파일을 잰다
  assert.match(run('--pair', 'ring', 'background', file).stdout, /light --ring \/ --background +5\.76/)
})

test('contrast-lib ratio: black on white is 21, a color on itself is 1', () => {
  assert.ok(Math.abs(ratio('oklch(0 0 0)', 'oklch(1 0 0)') - 21) < 0.01)
  assert.equal(ratio('oklch(0.5 0.1 200)', 'oklch(0.5 0.1 200)'), 1)
  assert.throws(() => ratio('#fff', 'oklch(1 0 0)'), /OKLCH/)
})

test('contrast-lib refuses translucent colours instead of measuring them as opaque (T6-M6)', () => {
  assert.throws(() => ratio('oklch(0.4 0.1 200 / 0.5)', 'oklch(1 0 0)'), /반투명/)
  assert.throws(() => ratio('oklch(0.4 0.1 200)', 'oklch(1 0 0 / 40%)'), /반투명/)
  assert.ok(ratio('oklch(0 0 0 / 1)', 'oklch(1 0 0 / 100%)') > 20)
  assert.equal(alphaOf('oklch(0.4 0.1 200 / 50%)'), 0.5)
  assert.equal(alphaOf('oklch(0.4 0.1 200 / .25)'), 0.25)
  assert.equal(alphaOf('oklch(0.4 0.1 200)'), 1)
})

// 리뷰 M7: factory-default 테마 항목도 상태 토큰을 @theme 에 잇는다(레시피 항목의 STATUS_THEME 과 같은 여섯 줄).
test('factory-default theme item wires the status tokens into @theme (cssVars.theme = STATUS_THEME)', () => {
  const reg = JSON.parse(readFileSync(fileURLToPath(new URL('../../registry/factory/themes/registry.json', import.meta.url)), 'utf8'))
  const item = reg.items.find((i) => i.name === 'factory-default')
  assert.deepEqual(item.cssVars.theme, STATUS_THEME)
  assert.equal(Object.keys(STATUS_THEME).length, 6)
})
