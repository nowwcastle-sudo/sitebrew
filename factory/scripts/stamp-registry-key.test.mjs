// 저장소 로컬 레지스트리 캐시 키(ensureRepoRegistry) — 항목 json 이 파일 본문을 담지 않아, registry.json 만 해시하면 블록·부품 소스를 고쳐도 캐시가 안 바뀐다
// (P3-4 perf 실측: 히어로 keep 수정 뒤에도 옛 블록이 설치된 사이트가 빌드됐다 — 옛 캐시 .tmp/stamp-registry/r0). 키는 registry/factory 아래 모든 파일의 내용을 본다.
// 실행: node --test --test-force-exit --test-timeout=60000 factory/scripts/stamp-registry-key.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { repoRegistryKey } from '../stamp/site-install.mjs'

function fakeRoot() {
  const root = mkdtempSync(join(tmpdir(), 'reg-key-'))
  mkdirSync(join(root, 'registry', 'factory', 'blocks', '_compiled', 'hero'), { recursive: true })
  mkdirSync(join(root, 'registry', 'factory', 'r', 'r1', 'ui'), { recursive: true })
  writeFileSync(join(root, 'package.json'), '{"version":"0.0.5"}')
  writeFileSync(join(root, 'registry.json'), '{"items":[]}')
  writeFileSync(join(root, 'registry', 'factory', 'blocks', 'registry.json'), '{"items":[{"name":"b","files":[{"path":"registry/factory/blocks/_compiled/hero/a.tsx"}]}]}')
  writeFileSync(join(root, 'registry', 'factory', 'blocks', '_compiled', 'hero', 'a.tsx'), '<h1 data-enter="">x</h1>')
  writeFileSync(join(root, 'registry', 'factory', 'r', 'r1', 'ui', 'button.tsx'), 'export const B = 1')
  return root
}

test('repoRegistryKey: 같은 내용이면 같은 키, 블록·부품 소스 한 글자만 바뀌어도 다른 키(registry.json 은 그대로여도)', () => {
  const root = fakeRoot()
  const k0 = repoRegistryKey(root)
  assert.equal(repoRegistryKey(root), k0, '같은 트리는 같은 키')
  writeFileSync(join(root, 'registry', 'factory', 'blocks', '_compiled', 'hero', 'a.tsx'), '<h1 data-enter="keep">x</h1>')
  const k1 = repoRegistryKey(root)
  assert.notEqual(k1, k0, '컴파일된 블록 소스가 바뀌면 키가 바뀐다')
  writeFileSync(join(root, 'registry', 'factory', 'r', 'r1', 'ui', 'button.tsx'), 'export const B = 2')
  assert.notEqual(repoRegistryKey(root), k1, '레시피 부품 소스도')
  const k2 = repoRegistryKey(root)
  writeFileSync(join(root, 'package.json'), '{"version":"0.0.6"}')
  assert.notEqual(repoRegistryKey(root), k2, '버전이 바뀌면 키가 바뀐다')
})
