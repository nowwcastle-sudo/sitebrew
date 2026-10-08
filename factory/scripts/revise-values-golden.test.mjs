// 값이 든 수정 요청의 골든 왕복(FIT-2) — 실제 06(shadcn add 까지, next build 는 안 한다)으로 사이트를 찍고
//   `--revise "메인 색을 #0B6E4F 로"` → `--revise-pick 1:v1` 뒤 06 을 다시 찍어, 사이트 CSS(app/globals.css)의 :root --primary 가 그 색인지 본다.
// 무거운 시험(템플릿 npm ci · shadcn build · 후보 설치 ×3)이라 REVISE_VALUES_GOLDEN=1 일 때만 돈다. 잠금 안에서:
//   REVISE_VALUES_GOLDEN=1 node --test --test-force-exit --test-timeout=1800000 factory/scripts/revise-values-golden.test.mjs
// 임시 폴더는 REVISE_VALUES_TMP(기본 저장소 .tmp/revise-values-golden). 문구는 COPY.md 대로 문구 에이전트가 쓰는 대신 시험용 saasContent 가 대신한다.
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { generateSite } from '../stamp/gen-pages.mjs'
import { applyRevision, parseRevision, revise } from '../stamp/revise.mjs'
import { primaryHexOf } from '../stamp/revise-values.mjs'
import { oklchToHex } from './style-presets.mjs'
import { SAAS_BRIEF, makeRun, root, saasContent } from './lib/stamp-site-fixtures.mjs'

const TMP = process.env.REVISE_VALUES_TMP ?? join(root, '.tmp', 'revise-values-golden')

/** 사이트 CSS 의 첫 `--primary:` 값(:root 의 라이트 주색)을 #RRGGBB 로. */
function sitePrimary(siteDir) {
  const css = readFileSync(join(siteDir, 'app', 'globals.css'), 'utf8')
  const m = css.match(/--primary:\s*([^;]+);/)
  assert.ok(m, 'app/globals.css 에 --primary 가 있다')
  const v = m[1].trim()
  return /^#/.test(v) ? v.toUpperCase() : oklchToHex(v)
}

test('골든: --revise "메인 색을 #0B6E4F 로" → --revise-pick 왕복 뒤 06 을 다시 찍은 사이트 CSS 의 --primary = 그 색', { skip: process.env.REVISE_VALUES_GOLDEN !== '1' }, async () => {
  mkdirSync(TMP, { recursive: true })
  const R = await makeRun(TMP, SAAS_BRIEF, saasContent)
  writeFileSync(join(R.runDir, 'a', '01-direction.json'), JSON.stringify({ inputHash: 'golden', producedAt: '2026-10-15T00:00:00.000Z', data: R.cand }, null, 2) + '\n')
  const log = (m) => console.error(`  ${m}`)

  const first = await generateSite(R.runDir, R.cand, { install: true, build: false, log })
  const before = sitePrimary(first.siteDir)
  console.error(`기준 사이트 --primary ${before}`)
  assert.notEqual(before, '#0B6E4F', '시험이 뜻을 가지려면 처음 주색이 요청 색과 달라야 한다')

  const request = parseRevision('메인 색을 #0B6E4F 로', JSON.parse(readFileSync(join(first.siteDir, 'content', 'site.json'), 'utf8')))
  assert.deepEqual([request.scope, request.target, request.intent, request.value.hex], ['axis', 'color', 'value', '#0B6E4F'])
  const out = await revise(R.runDir, 'a', request, { install: true, build: false, runGates: false, n: 1, log })
  assert.equal(out.status, 'ready')
  const proposed = sitePrimary(join(R.runDir, out.variants[0].siteRel))
  console.error(`안 v1 사이트 --primary ${proposed}`)
  assert.equal(proposed, '#0B6E4F', '안의 사이트 CSS 주색')

  const applied = await applyRevision(R.runDir, 'a', out.index, 'v1', { userFile: join(TMP, 'p.json'), seedFile: join(TMP, 'none.json') })
  assert.deepEqual(applied.stale, ['06', '07'])
  const cand = JSON.parse(readFileSync(join(R.runDir, 'a', '01-direction.json'), 'utf8')).data
  assert.equal(primaryHexOf(cand.recipe), '#0B6E4F')

  const again = await generateSite(R.runDir, cand, { install: true, build: false, log })
  const after = sitePrimary(again.siteDir)
  console.error(`왕복 뒤 사이트 --primary ${after}`)
  assert.equal(after, '#0B6E4F', '왕복 뒤 다시 찍은 사이트 CSS 의 --primary')
})
