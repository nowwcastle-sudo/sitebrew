// 보안 수정 G(daybreak SB-15 supply-chain.registry-semver-drift): 레지스트리 항목의 npm 의존은 package.json 의 ^ 범위가 아니라
// package-lock.json 에 실제로 검토·설치된 정확한 판으로 나간다. 소비자의 새 설치가 검토되지 않은 상위 판을 받지 않게 한다.
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as lib from './lib/registry-lib.mjs'
import { pkgVersions } from './recipe.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const made = []
after(() => { for (const d of made) rmSync(d, { recursive: true, force: true }) })

// 가짜 저장소: package.json 범위와 lock 의 실제 판을 따로 적는다.
function fakeRoot(deps, locked, { devDeps = {} } = {}) {
  const r = mkdtempSync(join(tmpdir(), 'wf-exact-deps-'))
  made.push(r)
  writeFileSync(join(r, 'package.json'), JSON.stringify({ name: 'fake', dependencies: deps, devDependencies: devDeps }))
  const packages = { '': { name: 'fake' } }
  for (const [name, version] of Object.entries(locked)) packages[`node_modules/${name}`] = { version }
  writeFileSync(join(r, 'package-lock.json'), JSON.stringify({ name: 'fake', lockfileVersion: 3, packages }))
  return r
}

test('재현: package.json 이 ^1.2.0 이어도 레지스트리 의존은 lock 의 1.2.7 로 나간다(수정 전에는 x@^1.2.0)', () => {
  const r = fakeRoot({ x: '^1.2.0' }, { x: '1.2.7' })
  // 생성기들이 실제로 버전 표를 만드는 경로(recipe.mjs pkgVersions)와 공용 창구(lockedVersions) 둘 다 같은 판을 낸다.
  assert.equal(lib.pinDependency('x', pkgVersions(r)), 'x@1.2.7')
  assert.equal(lib.pinDependency('x', lib.lockedVersions(r)), 'x@1.2.7')
})

test('범위였던 의존만 바뀐다: 이미 정확한 판이면 그대로, devDependencies 도 lock 판으로', () => {
  const r = fakeRoot({ exact: '2.0.0', ranged: '~3.1.0' }, { exact: '2.0.0', ranged: '3.1.9', dev: '0.4.2' }, { devDeps: { dev: '>=0.4.0' } })
  assert.deepEqual(lib.lockedVersions(r), { exact: '2.0.0', ranged: '3.1.9', dev: '0.4.2' })
})

test('lock 에 없는 의존이면 범위로 물러나지 않고 이름을 적어 던진다', () => {
  const r = fakeRoot({ x: '^1.2.0', ghost: '^9.0.0' }, { x: '1.2.7' })
  assert.throws(() => lib.lockedVersions(r), /package-lock\.json 에 없는 의존입니다: ghost/)
  const noVersion = fakeRoot({ x: '^1.2.0' }, {})
  assert.throws(() => lib.lockedVersions(noVersion), /: x /)
})

test('정상 선례: 이미 @버전이 붙은 dep 은 그대로, @scope/pkg 도 동작, 표에 없는 이름은 던지고 표가 없으면 이름만', () => {
  const versions = { 'plain': '1.0.0', '@scope/pkg': '4.5.6' }
  assert.equal(lib.pinDependency('plain', versions), 'plain@1.0.0')
  assert.equal(lib.pinDependency('@scope/pkg', versions), '@scope/pkg@4.5.6')
  assert.equal(lib.pinDependency('react-day-picker@10', versions), 'react-day-picker@10')
  assert.equal(lib.pinDependency('@scope/pkg@^2', versions), '@scope/pkg@^2')
  assert.throws(() => lib.pinDependency('left-pad', versions), /left-pad/)
  assert.equal(lib.pinDependency('plain', undefined), 'plain')
})

// 생성기가 버전 표를 따로 만들면(예전: { ...pkg.devDependencies, ...pkg.dependencies }) 범위가 다시 새어 나온다.
test('생성기 원천은 의존 버전 표를 직접 만들지 않는다(lockedVersions 한 곳)', () => {
  const dir = join(ROOT, 'factory', 'scripts')
  const offenders = readdirSync(dir).filter((f) => f.endsWith('.mjs') && !f.endsWith('.test.mjs'))
    .filter((f) => /\.\.\.\s*\w+\.devDependencies/.test(readFileSync(join(dir, f), 'utf8')))
  assert.deepEqual(offenders, [])
})

const EXACT = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/
function registryFiles(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) registryFiles(p, out)
    else if (e.name === 'registry.json') out.push(p)
  }
  return out
}

test('저장소 생성물: 모든 층의 registry.json 의존이 이름@정확한판이고 lock 의 판과 같다(범위·태그 없음)', () => {
  const lock = JSON.parse(readFileSync(join(ROOT, 'package-lock.json'), 'utf8'))
  const files = registryFiles(join(ROOT, 'registry'))
  assert.ok(files.length >= 10, `registry.json ${files.length}개`)
  let checked = 0
  const bad = []
  for (const f of files) {
    const j = JSON.parse(readFileSync(f, 'utf8'))
    for (const item of j.items ?? []) {
      for (const dep of item.dependencies ?? []) {
        checked++
        const at = dep.lastIndexOf('@')
        const name = at > 0 ? dep.slice(0, at) : dep
        const ver = at > 0 ? dep.slice(at + 1) : ''
        if (!EXACT.test(ver)) { bad.push(`${f}: ${item.name}: ${dep} — 정확한 판이 아님`); continue }
        const l = lock.packages?.[`node_modules/${name}`]?.version
        if (l !== ver) bad.push(`${f}: ${item.name}: ${dep} — lock 판 ${l}`)
      }
    }
  }
  assert.ok(checked > 100, `의존 ${checked}개`)
  assert.deepEqual(bad, [])
})
