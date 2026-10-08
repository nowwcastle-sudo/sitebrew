// 06 설치: 저장소 레지스트리 캐시 키(registryInputsKey)는 항목이 가리키는 원천 파일의 내용까지 본다(P3-3 Task 14b — 층 registry.json 은 파일 이름만 적어,
// 원천을 고쳐도 낡은 shadcn build 결과를 계속 써서 후보 빌드가 옛 사본으로 떨어졌다).
// 실행: node --test --test-force-exit --test-timeout=60000 factory/scripts/stamp-install-key.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { registryInputsKey } from '../stamp/site-install.mjs'

function fakeRoot() {
  const root = mkdtempSync(join(tmpdir(), 'wf-regkey-'))
  mkdirSync(join(root, 'registry', 'factory', 'ax'), { recursive: true })
  writeFileSync(join(root, 'package.json'), '{"name":"x","version":"0.0.0"}')
  writeFileSync(join(root, 'registry.json'), '{"items":[]}')
  writeFileSync(join(root, 'registry', 'factory', 'ax', 'registry.json'), JSON.stringify({ items: [{ name: 'seo-meta', files: [{ path: 'seo-meta.ts' }] }] }))
  writeFileSync(join(root, 'registry', 'factory', 'ax', 'seo-meta.ts'), 'export const a = 1\n')
  return root
}

test('registryInputsKey: 같은 입력은 같은 키, 항목이 가리키는 원천 파일 내용이 바뀌면 키가 바뀐다', () => {
  const root = fakeRoot()
  try {
    const k1 = registryInputsKey(root)
    assert.equal(registryInputsKey(root), k1, '그대로면 같은 키')
    writeFileSync(join(root, 'registry', 'factory', 'ax', 'seo-meta.ts'), 'export const a = 2\n')
    const k2 = registryInputsKey(root)
    assert.notEqual(k2, k1, '원천 내용을 고치면 키가 바뀐다(낡은 build 를 쓰지 않는다)')
    writeFileSync(join(root, 'package.json'), '{"name":"x","version":"0.0.1"}')
    assert.notEqual(registryInputsKey(root), k2, 'package.json(고정 버전)도 키에 든다')
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('registryInputsKey: 항목이 가리키는 파일이 없어도 던지지 않는다(shadcn build 가 그 오류를 낸다) — 있고 없음이 키에 든다', () => {
  const root = fakeRoot()
  try {
    const withFile = registryInputsKey(root)
    rmSync(join(root, 'registry', 'factory', 'ax', 'seo-meta.ts'))
    assert.notEqual(registryInputsKey(root), withFile)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('registryInputsKey: 진짜 저장소에서 계산된다(64자 해시)', () => {
  assert.match(registryInputsKey(), /^[0-9a-f]{64}$/)
})
