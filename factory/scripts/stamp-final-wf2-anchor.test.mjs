// FINAL-WF2 AB3 앵커 보정 — 03 이 고른 lead-capture 블록(magnet-preview, id lead-magnet)을 06 이 자료가 없어 다른 변형(inline-newsletter, id newsletter)으로 폴백하면
// 앵커 어림(#lead-magnet)이 틀려진다 — 대표 사이트 재생성에서 빌드 뒤 링크 검사가 「#lead-magnet 가 쪽에 없다」로 잡아냈다. 고침: 실제 그려진 블록의 id 로 보정.
// 실행: node --test --test-force-exit --test-timeout=300000 factory/scripts/stamp-final-wf2-anchor.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { makeRun, gen, root } from './lib/stamp-site-fixtures.mjs'
import { plainContent } from './lib/app-shell-fixtures.mjs'
import { goldenOf } from './lib/stamp-structure-fixtures.mjs'
import { leaves, resolveRefs } from '../stamp/site-bind.mjs'

const TMP = join(root, '.tmp', 'final-wf2-anchor-test')
const R = await makeRun(TMP, goldenOf('landing-1').brief, plainContent('landing', { oneLiner: '가을 북페어에 미리 등록해요' }), { patchVariants: (v) => ({ ...v, 'home/lead-capture': 'block-lead-capture-magnet-preview' }) })
const G = await gen(R)
const site = JSON.parse(readFileSync(join(G.siteDir, 'content', 'site.json'), 'utf8'))

test('앵커 보정: 03 이 고른 lead-capture 변형이 폴백으로 바뀌어도 CTA 앵커는 실제 그려진 블록의 id 로 간다', () => {
  const drawn = site.sections['home/lead-capture']
  assert.ok(drawn, '신청 폼이 그려진다')
  const id = drawn.block === 'block-lead-capture-inline-newsletter' ? 'newsletter' : drawn.block === 'block-lead-capture-magnet-preview' ? 'lead-magnet' : null
  assert.ok(id, drawn.block)
  const hrefs = [site.shell.action?.href, ...Object.values(site.sections).flatMap((s) => leaves(resolveRefs(s.props, site)).filter((l) => /(?:^|\.)href$/.test(l.path) && typeof l.value === 'string' && /lead-magnet|newsletter/.test(l.value)).map((l) => l.value))].filter(Boolean)
  assert.ok(hrefs.length > 0, '신청 폼으로 가는 링크가 있다')
  for (const h of hrefs) assert.ok(h.endsWith(`#${id}`), `${h} 는 #${id} 로 가야 한다(그려진 블록 ${drawn.block})`)
})
