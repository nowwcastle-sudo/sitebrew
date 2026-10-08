// FINAL-WF5 항목 1 — 한 쪽 안 섹션 id 중복 0 (대장 C410·C423).
// 같은 블록 종류(social-proof logo-rail 둘 등)를 한 쪽에 두면 기본 id 가 겹쳤다. 06 이 뒤 인스턴스에 `<기본>-<섹션 이름>` 을 props.id 로 준다.
// 실행: node --test --test-force-exit --test-timeout=600000 factory/scripts/stamp-final-wf5-ids.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gen, root } from './lib/stamp-site-fixtures.mjs'
import { OTHER_RUNS, dashboardRun, pwaRun } from './lib/app-shell-fixtures.mjs'
import { blockItems, sectionIdProblems, uniqueSectionIds } from '../stamp/gen-pages.mjs'

const TMP = join(root, '.tmp', 'final-wf5-ids-test')
const siteOf = (g) => JSON.parse(readFileSync(join(g.siteDir, 'content', 'site.json'), 'utf8'))
const defaultIdOf = (blk) => blockItems().get(blk)?.source?.match(/\bid = "([^"]+)"/)?.[1] ?? null

const RUNS = [...OTHER_RUNS, { id: 'dashboard', make: (tmp) => dashboardRun(tmp) }, { id: 'pwa', make: (tmp) => pwaRun(tmp) }]
const outs = new Map()
for (const r of RUNS) outs.set(r.id, await gen(await r.make(TMP)))

test('uniqueSectionIds: 쪽의 첫 인스턴스는 기본 id, 뒤 것은 <기본>-<섹션 이름>, 전역 잎의 id 는 예약', () => {
  const sections = {
    'home/clients': { block: 'block-social-proof-logo-rail', props: {} },
    'home/awards': { block: 'block-social-proof-logo-rail', props: {} },
    'home/press': { block: 'block-social-proof-logo-rail', props: {} },
    'about/clients': { block: 'block-social-proof-logo-rail', props: {} },
    'home/faq': { block: 'block-faq-single-accordion', props: {} },
    'global/footer': { block: 'block-footer-compact-strip', props: {} },
  }
  const pages = [[{ key: 'home/clients', block: 'block-social-proof-logo-rail' }, { key: 'home/awards', block: 'block-social-proof-logo-rail' }, { key: 'home/press', block: 'block-social-proof-logo-rail' }, { key: 'home/faq', block: 'block-faq-single-accordion' }], [{ key: 'about/clients', block: 'block-social-proof-logo-rail' }]]
  const changed = uniqueSectionIds({ pages, globals: [{ key: 'global/footer', block: 'block-footer-compact-strip' }], sections, defaultIdOf })
  assert.deepEqual(changed, { 'home/awards': 'social-proof-awards', 'home/press': 'social-proof-press' })
  assert.equal(sections['home/clients'].props.id, undefined, '첫 인스턴스는 기본 id 를 지킨다(앵커 보존)')
  assert.equal(sections['about/clients'].props.id, undefined, '다른 쪽은 따로 센다')
  // 전역 잎과 같은 기본 id 를 쓰는 쪽 잎은 비켜난다
  const s2 = { 'home/x': { block: 'block-faq-single-accordion', props: {} }, 'global/footer': { block: 'block-faq-single-accordion', props: {} } }
  const c2 = uniqueSectionIds({ pages: [[{ key: 'home/x', block: 'block-faq-single-accordion' }]], globals: [{ key: 'global/footer', block: 'block-faq-single-accordion' }], sections: s2, defaultIdOf })
  assert.deepEqual(c2, { 'home/x': 'faq-x' })
})

test('골든 06 출력: 쪽마다 섹션 id 중복 0 (원형 11 후보)', () => {
  const bad = []
  for (const [id, g] of outs) for (const line of sectionIdProblems(g.siteDir)) bad.push(`${id} ${line}`)
  assert.deepEqual(bad, [])
})

test('양성 대조: 중복을 일으키는 후보(portfolio-1 로고 줄 둘)가 실제로 이 모집단에 있고 둘째가 새 id 를 받았다', () => {
  const site = siteOf(outs.get('portfolio-1'))
  const logo = Object.entries(site.sections).filter(([, s]) => s.block === 'block-social-proof-logo-rail').map(([k, s]) => [k, s.props.id])
  assert.ok(logo.length >= 2, JSON.stringify(logo))
  assert.equal(new Set(logo.map(([, id]) => id ?? 'social-proof')).size, logo.length, JSON.stringify(logo))
  assert.ok(logo.some(([, id]) => id === undefined), '첫 인스턴스는 기본 id')
})

test('앵커: 신청 폼(lead-capture)으로 가는 같은 쪽 `#id` 는 모두 그 쪽에 실제로 있는 섹션 id 다(쪽 안 id 유일화 뒤에도)', () => {
  const bad = []
  for (const [id, g] of outs) {
    const site = siteOf(g)
    for (const [route, page] of Object.entries(site.pages ?? {})) {
      const ids = new Set(Object.entries(site.sections).filter(([k]) => k.startsWith(`${page.id}/`) || k.startsWith('global/')).map(([, s]) => s.props?.id ?? defaultIdOf(s.block)))
      for (const [key, sec] of Object.entries(site.sections)) {
        if (!key.startsWith(`${page.id}/`)) continue
        const walk = (v) => { if (typeof v === 'string') { const m = /^#([a-z][\w-]*)$/.exec(v); if (m && /^(?:newsletter|lead-magnet)$/.test(m[1]) && !ids.has(m[1])) bad.push(`${id} ${route} ${key} → #${m[1]}`) } else if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') Object.values(v).forEach(walk) }
        walk(sec.props)
      }
    }
  }
  assert.deepEqual(bad, [])
})
