// shadcn 버전 핀 — 루트 package.json 이 주인이다(lib/pins.mjs). 케이스마다 다른 사고 하나를 잡는다.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SHADCN_VERSION, exactPin, shadcnSpec } from './lib/pins.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const readJson = (rel) => JSON.parse(readFileSync(join(root, rel), 'utf8'))

// 지난 판 기록이라 옛 숫자가 남는 것이 맞는 곳
const HISTORY = /^(docs\/qa\/|docs\/superpowers\/|docs\/backlog|docs\/deferred-register\.md|CHANGELOG)/

test('손으로 쓴 문장이 낡지 않는다 — 추적 파일의 `shadcn@x.y.z` 는 모두 핀과 같다(지난 판 기록 제외)', () => {
  const files = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).split('\0').filter(Boolean)
  const stale = []
  for (const f of files) {
    if (HISTORY.test(f) || /\.(png|jpe?g|webp|ico|woff2?|lock)$/.test(f) || f === 'package-lock.json' || f.endsWith('/package-lock.json')) continue
    let text
    try { text = readFileSync(join(root, f), 'utf8') } catch { continue }
    for (const m of text.matchAll(/shadcn@(\d+\.\d+\.\d+)/g)) if (m[1] !== SHADCN_VERSION) stale.push(`${f}: shadcn@${m[1]}`)
  }
  assert.deepEqual([...new Set(stale)], [], `핀(${SHADCN_VERSION})과 다른 shadcn 버전 문장`)
})

test('사이트 템플릿 package.json · 잠금 파일의 shadcn 이 핀과 같다 — 템플릿이 따로 놀지 않는다', () => {
  const pkg = readJson('factory/stamp/site-template/package.json')
  const lock = readJson('factory/stamp/site-template/package-lock.json')
  assert.equal(pkg.dependencies.shadcn, SHADCN_VERSION)
  assert.equal(lock.packages['node_modules/shadcn'].version, SHADCN_VERSION)
  assert.equal(lock.packages[''].dependencies.shadcn, SHADCN_VERSION)
})

test('범위(^·~)나 비어 있는 핀은 거부한다 — 범위의 하한을 읽다가 설치된 판과 어긋나는 사고', () => {
  for (const bad of ['^4.22.1', '~4.22.1', '4.22', 'latest', undefined]) {
    assert.throws(() => exactPin({ dependencies: { shadcn: bad } }, 'shadcn'), /정확한 x\.y\.z/, String(bad))
  }
  assert.equal(exactPin({ dependencies: { shadcn: "4.22.1" } }, 'shadcn'), '4.22.1')
  assert.equal(shadcnSpec(), `shadcn@${SHADCN_VERSION}`)
})

test('Dependabot 은 shadcn 단독 PR 을 받지 않는다 — 핀은 출시 단위로 사람이 올린다', () => {
  const yml = readFileSync(join(root, '.github', 'dependabot.yml'), 'utf8')
  assert.match(yml, /ignore:[\s\S]*dependency-name: shadcn/)
})
