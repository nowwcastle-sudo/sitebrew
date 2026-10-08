// FIT-5 — 고른 수정안이 06 에서 조용히 되돌려진다(실측 W1b C1).
//   한 낱말 히어로(grid-lines-baseline-word)를 수정으로 골랐는데 지금 04 제목이 그 블록의 길이 상한(titleMaxUnits 5.3em)을 넘으면 06 이 같은 섹션의 다른 변형으로 폴백한다 — 사용자에게 알림이 없었다.
//   ① 수정 제안(revise)이 지금 04 문구로 그 안이 살아남는지 미리 보고 안마다 알린다(조용히 내지 않는다).
//   ② 그래도 06 이 수정으로 고른 블록에서 폴백하면(수정 기록 09-revise 의 고른 안과 06 fallbacks 대조) 경고 한 줄과 자료로 남긴다.
//   ③ 음성 대조: 짧은 제목이면 적용되고 알림이 없다 · 수정으로 고르지 않은 폴백은 「수정으로 고른」 경고를 내지 않는다.
// 실제 06(generateSite, install: false)을 쓴다. 실행: node --test --test-force-exit --test-timeout=300000 factory/scripts/revise-fallback.test.mjs
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, test } from 'node:test'
import { applyRevision, revise } from '../stamp/revise.mjs'
import { boardData, runReviseCommand } from '../stamp/stamp.mjs'
import { reviseFallbacks } from '../stamp/revise-picks.mjs'
import { gen, localBrief, localContent, makeRun, root } from './lib/stamp-site-fixtures.mjs'

const TMP = join(root, '.tmp', 'revise-fallback-test')
mkdirSync(TMP, { recursive: true })
const KEY = 'home/hero-visit-info'
const GRID = 'block-hero-grid-lines-baseline-word'
const VTS = 'block-hero-vertical-title-slides'
const LONG = '망원동 동네 꽃집, 전화로 꽃다발 주문' // 실측 W1b 의 04 히어로 제목
const SHORT = '들꽃상회'

let dir
beforeEach(() => { dir = mkdtempSync(join(TMP, 't-')); process.env.CLAUDE_PLUGIN_DATA = join(dir, 'plugin-data') })
afterEach(() => { rmSync(dir, { recursive: true, force: true }) })
const prefsOpts = () => ({ seedFile: join(dir, 'no-seed.json'), userFile: join(dir, 'prefs', 'preferences.json') })

/** 06 까지 끝난 local 실행 폴더 — 03 이 지금 고른 변형은 세로 제목(VTS)이고 04 제목만 title 이다. */
async function setup(title) {
  const R = await makeRun(dir, localBrief(), localContent, {
    patchVariants: (v) => ({ ...v, [KEY]: VTS }),
    patch: (c) => { c.slots.copy.find((s) => s.id === 'tagline').text = title; return c },
  })
  writeFileSync(join(R.runDir, 'a', '01-direction.json'), JSON.stringify({ inputHash: 'fixture', producedAt: '2026-10-15T00:00:00.000Z', data: R.cand }, null, 2) + '\n')
  await gen(R)
  return R
}
const request = { scope: 'section', target: KEY, intent: 'different', text: '히어로를 다른 걸로' }
const siteBlock = (siteDir) => JSON.parse(readFileSync(join(siteDir, 'content', 'site.json'), 'utf8')).sections[KEY].block

test('FIT-5 ① 긴 제목: 한 낱말 히어로 안은 「지금 제목으로는 적용되지 않는다」를 안마다 알린다(조용히 내지 않는다)', async () => {
  const R = await setup(LONG)
  const out = await revise(R.runDir, 'a', request, { n: 3, install: false })
  const grid = out.variants.find((v) => v.block === GRID)
  assert.ok(grid, `한 낱말 히어로 안이 없다: ${out.variants.map((v) => v.block)}`)
  assert.equal(grid.warnings?.length, 1, JSON.stringify(grid.warnings))
  assert.match(grid.warnings[0], /적용되지 않아요/)
  assert.match(grid.warnings[0], /제목을 5자 이하/) // titleMaxUnits 5.3em → 한글 5자
  assert.match(grid.warnings[0], new RegExp(LONG))
  assert.equal(grid.diff.titleOverflow.block, GRID)
  assert.ok(out.notes.some((n) => n.includes(GRID) && n.includes('적용되지 않아요')), `notes: ${JSON.stringify(out.notes)}`)
  // 상한이 없는 다른 변형 안은 알릴 것이 없다
  for (const v of out.variants.filter((x) => x.block !== GRID)) assert.equal(v.warnings, undefined, v.block)
})

test('FIT-5 ① CLI 출력: --revise 안 목록에 「주의:」 줄이 붙는다', async () => {
  const R = await setup(LONG)
  const lines = []
  const r = await runReviseCommand({ run: R.runDir, pick: 'a', revise: '히어로를 더 대담하게' }, { say: (s) => lines.push(s), revOpts: { install: false, n: 3 } })
  assert.equal(r.code, 0, lines.join('\n'))
  const at = lines.findIndex((l) => new RegExp(`^  v\\d  ${GRID}`).test(l)) // 안 목록 줄(참고: 줄이 아니다)
  assert.ok(at >= 0, lines.join('\n'))
  assert.match(lines[at + 1] ?? '', /주의: .*적용되지 않아요.*5자 이하/, lines.join('\n'))
})

test('FIT-5 ① 음성 대조: 짧은 제목이면 안에 알림이 없다', async () => {
  const R = await setup(SHORT)
  const out = await revise(R.runDir, 'a', request, { n: 3, install: false })
  assert.ok(out.variants.some((v) => v.block === GRID))
  for (const v of out.variants) assert.equal(v.warnings, undefined, v.block)
  assert.deepEqual(out.notes.filter((n) => n.includes('적용되지 않아요')), [])
})

test('FIT-5 ② 고르면 알림이 다시 나오고, 다음 06 은 수정으로 고른 블록이 폴백했음을 경고·자료로 남긴다', async () => {
  const R = await setup(LONG)
  const out = await revise(R.runDir, 'a', request, { n: 3, install: false })
  const grid = out.variants.find((v) => v.block === GRID)
  const picked = await applyRevision(R.runDir, 'a', out.index, grid.id, prefsOpts())
  assert.equal(picked.warnings?.length, 1, JSON.stringify(picked))
  assert.match(picked.warnings[0], /적용되지 않아요/)
  const logs = []
  const g = await gen(R, { log: (m) => logs.push(m) })
  assert.notEqual(siteBlock(g.siteDir), GRID, '06 은 폴백했다(실측 C1 재현)')
  assert.equal(g.reviseFallbacks.length, 1, JSON.stringify(g.reviseFallbacks))
  assert.equal(g.reviseFallbacks[0].block, GRID)
  assert.equal(g.reviseFallbacks[0].key, KEY)
  assert.equal(g.reviseFallbacks[0].index, out.index)
  const warn = logs.filter((m) => m.startsWith('경고: 수정으로 고른'))
  assert.equal(warn.length, 1, logs.join('\n'))
  assert.match(warn[0], new RegExp(`수정으로 고른 ${GRID} 이\\(가\\) 적용되지 않음: 제목 .*em 이 이 변형의 상한 5\\.3em 을 넘는다`))
  assert.match(warn[0], /제목을 5자 이하/)
  assert.ok(warn[0].includes(g.reviseFallbacks[0].to))
  // 08 보드 자료에도 남는다
  const board = boardData({ cand: R.cand, qa: null, pages: { siteDir: g.siteDir, routes: g.routes, reviseFallbacks: g.reviseFallbacks } })
  assert.equal(board.reviseFallbacks.length, 1)
  assert.equal(boardData({ cand: R.cand, qa: null, pages: { siteDir: g.siteDir, routes: g.routes } }).reviseFallbacks, undefined, '없으면 키도 없다')
})

test('FIT-5 ② 음성 대조: 짧은 제목이면 고른 블록이 그대로 그려지고 경고가 없다', async () => {
  const R = await setup(SHORT)
  const out = await revise(R.runDir, 'a', request, { n: 3, install: false })
  const grid = out.variants.find((v) => v.block === GRID)
  await applyRevision(R.runDir, 'a', out.index, grid.id, prefsOpts())
  const logs = []
  const g = await gen(R, { log: (m) => logs.push(m) })
  assert.equal(siteBlock(g.siteDir), GRID)
  assert.deepEqual(g.reviseFallbacks, [])
  assert.deepEqual(logs.filter((m) => m.includes('수정으로 고른')), [])
})

test('FIT-5 ② 음성 대조: 수정으로 고르지 않은 폴백은 「수정으로 고른」 경고를 내지 않는다(없는 일을 지어내지 않는다)', async () => {
  const R = await setup(LONG)
  // 03 에 직접 한 낱말 히어로를 넣는다 — 09-revise 기록이 없다
  const f = join(R.runDir, 'a', '03-variants.json')
  const saved = JSON.parse(readFileSync(f, 'utf8'))
  saved.data[KEY] = GRID
  writeFileSync(f, JSON.stringify(saved))
  const logs = []
  const g = await gen(R, { log: (m) => logs.push(m) })
  assert.ok(g.fallbacks.some((x) => x.key === KEY && x.from === GRID), '폴백은 일어났다')
  assert.deepEqual(g.reviseFallbacks, [])
  assert.deepEqual(logs.filter((m) => m.includes('수정으로 고른')), [])
})

test('FIT-5 ② 대조 도우미: 같은 구획을 여러 번 고쳤으면 가장 나중 번호의 안과 대조한다', () => {
  const cand = join(dir, 'a')
  for (const [n, block] of [[1, GRID], [2, VTS]]) {
    mkdirSync(join(cand, '09-revise', String(n)), { recursive: true })
    writeFileSync(join(cand, '09-revise', String(n), 'board.json'), JSON.stringify({ scope: 'section', target: KEY, picked: { id: 'v1', block } }))
  }
  const fb = [{ key: KEY, from: GRID, to: VTS, why: '제목이 길다' }]
  assert.deepEqual(reviseFallbacks(cand, fb), [], '나중 수정이 다른 블록을 골랐으니 앞 안의 폴백은 수정 탓이 아니다')
  writeFileSync(join(cand, '09-revise', '2', 'board.json'), JSON.stringify({ scope: 'section', target: KEY, picked: { id: 'v1', block: GRID } }))
  assert.equal(reviseFallbacks(cand, fb).length, 1)
})
