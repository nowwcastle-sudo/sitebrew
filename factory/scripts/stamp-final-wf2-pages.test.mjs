// FINAL-WF2 06 묶기 고침 묶음(감사 B P1): AB6 빈 쪽·AB17 법정 쪽 메뉴 · AB10 요금제 버튼 글 · AB13 자리표시 링크 · AB14 마지막 행동 보조 버튼 …
// 실행: node --test --test-force-exit --test-timeout=300000 factory/scripts/stamp-final-wf2-pages.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { makeRun, gen, localBrief, localContent, SAAS_BRIEF, saasContent, root } from './lib/stamp-site-fixtures.mjs'

const TMP = join(root, '.tmp', 'final-wf2-pages-test')
const siteOf = (g) => JSON.parse(readFileSync(join(g.siteDir, 'content', 'site.json'), 'utf8'))
const L = await makeRun(TMP, localBrief(), localContent)
const S = await makeRun(TMP, SAAS_BRIEF, saasContent)
const LG = await gen(L)
const SG = await gen(S)
const local = siteOf(LG)
const saas = siteOf(SG)

test('AB6 local: 빈 상태 안내뿐인 쪽(/services)은 머리글 메뉴에서 빠지고 noindex', () => {
  const emptyRoutes = Object.entries(local.pages).filter(([, p]) => p.noindex && !['booking-complete'].includes(p.id)).map(([r]) => r)
  assert.ok(emptyRoutes.includes('/services'), JSON.stringify(Object.keys(local.pages)))
  assert.equal(local.shell.nav.some((l) => l.href === '/services'), false)
  assert.equal(local.pages['/services'].noindex, true)
  assert.equal(local.pages['/'].noindex, undefined, '홈은 빈 쪽이어도 색인 대상')
})

test('AB17 saas·local: 푸터가 법정 쪽 링크를 그리면 머리글 메뉴에는 법정 쪽이 없다', () => {
  for (const site of [local, saas]) {
    const legal = Object.entries(site.pages).filter(([, p]) => p.legal).map(([r]) => r)
    assert.ok(legal.length > 0)
    assert.deepEqual(site.shell.nav.filter((l) => legal.includes(l.href)), [], JSON.stringify(site.shell.nav))
    const footer = JSON.stringify(site.sections['global/footer']?.props ?? {})
    assert.ok(legal.some((r) => footer.includes(r) || footer.includes('termsUrl') || footer.includes('privacyUrl')), '푸터가 법정 쪽으로 이어진다')
  }
})
