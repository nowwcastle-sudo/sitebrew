// P4GR2 — 사이트 템플릿 next.config.ts 의 빌드 병렬도 환경 변수 WF_BUILD_CPUS(메모리가 모자란 머신에서 06-pages 빌드 작업자 수를 낮춘다).
// 이 변수가 없거나 양의 정수가 아니면 설정이 예전과 똑같아야 한다(평소 빌드와 출력이 같다) — 근거 Next.js 문서 「Memory Usage」·staticGeneration(experimental.cpus 기본값 cores − 1, 환경 변수 없음).
// 실행: node --test --test-force-exit --test-timeout=60000 factory/scripts/stamp-build-cpus.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { root } from './lib/stamp-site-fixtures.mjs'

const CONFIG = pathToFileURL(join(root, 'factory', 'stamp', 'site-template', 'next.config.ts')).href
let n = 0
// 모듈은 읽을 때 환경 변수를 한 번 본다 — 질의 문자열로 캐시를 피해 값마다 새로 읽는다.
async function configWith(value) {
  const before = process.env.WF_BUILD_CPUS
  if (value === undefined) delete process.env.WF_BUILD_CPUS
  else process.env.WF_BUILD_CPUS = value
  try { return (await import(`${CONFIG}?case=${n++}`)).default } finally { if (before === undefined) delete process.env.WF_BUILD_CPUS; else process.env.WF_BUILD_CPUS = before }
}

test('WF_BUILD_CPUS 없음 → experimental 칸이 없다(예전 설정 그대로)', async () => {
  const c = await configWith(undefined)
  assert.equal('experimental' in c, false)
  assert.equal(c.turbopack.root.length > 0, true)
})

test('WF_BUILD_CPUS=1·2 → experimental.cpus 가 그 값', async () => {
  assert.deepEqual((await configWith('1')).experimental, { cpus: 1 })
  assert.deepEqual((await configWith('2')).experimental, { cpus: 2 })
})

test('음성 대조: 0·음수·소수·글자·빈 값은 무시한다(설정이 예전과 같다)', async () => {
  for (const v of ['0', '-1', '1.5', 'abc', '']) assert.equal('experimental' in (await configWith(v)), false, `값 ${JSON.stringify(v)}`)
})

test('정적 내보내기(WF_STATIC_EXPORT=1)와 함께여도 서로 간섭하지 않는다', async () => {
  const before = process.env.WF_STATIC_EXPORT
  process.env.WF_STATIC_EXPORT = '1'
  try {
    const c = await configWith('1')
    assert.equal(c.output, 'export')
    assert.deepEqual(c.experimental, { cpus: 1 })
  } finally { if (before === undefined) delete process.env.WF_STATIC_EXPORT; else process.env.WF_STATIC_EXPORT = before }
})

test('WF_BUILD_LOWMEM=1 → experimental.turbopackPluginRuntimeStrategy 가 workerThreads · cpus 와 함께 합쳐진다 · 1 이 아니면 칸이 없다(음성 대조)', async () => {
  const before = process.env.WF_BUILD_LOWMEM
  try {
    for (const v of [undefined, '0', 'true', '']) {
      if (v === undefined) delete process.env.WF_BUILD_LOWMEM; else process.env.WF_BUILD_LOWMEM = v
      assert.equal('experimental' in (await configWith(undefined)), false, `값 ${JSON.stringify(v)}`)
    }
    process.env.WF_BUILD_LOWMEM = '1'
    assert.deepEqual((await configWith(undefined)).experimental, { turbopackPluginRuntimeStrategy: 'workerThreads' })
    assert.deepEqual((await configWith('1')).experimental, { cpus: 1, turbopackPluginRuntimeStrategy: 'workerThreads' })
  } finally { if (before === undefined) delete process.env.WF_BUILD_LOWMEM; else process.env.WF_BUILD_LOWMEM = before }
})

test('WF_BUILD_SKIP_TYPECHECK=1 → typescript.ignoreBuildErrors 만 켠다 · 없거나 1 이 아니면 typescript 칸 자체가 없다(음성 대조)', async () => {
  const before = process.env.WF_BUILD_SKIP_TYPECHECK
  try {
    delete process.env.WF_BUILD_SKIP_TYPECHECK
    assert.equal('typescript' in (await configWith(undefined)), false)
    for (const v of ['0', 'true', '']) { process.env.WF_BUILD_SKIP_TYPECHECK = v; assert.equal('typescript' in (await configWith(undefined)), false, `값 ${JSON.stringify(v)}`) }
    process.env.WF_BUILD_SKIP_TYPECHECK = '1'
    assert.deepEqual((await configWith(undefined)).typescript, { ignoreBuildErrors: true })
  } finally { if (before === undefined) delete process.env.WF_BUILD_SKIP_TYPECHECK; else process.env.WF_BUILD_SKIP_TYPECHECK = before }
})
