import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { diversityReport, reportDiversity, isSkeleton, limitsFor, boardRequirement, diversityEnforced } from './recipes-diversity.mjs'
import { loadRecipeHeads } from './recipes-distinct.mjs'

// 가짜 머리: 거의 흰 바탕 + 잉크 주색 + 강조 한 점(골격) — 필요한 것만 바꿔 쓴다.
const SKELETON_LIGHT = { background: 'oklch(0.98 0.004 255)', primary: 'oklch(0.24 0.02 255)', 'primary-foreground': 'oklch(0.98 0.004 255)',
  secondary: 'oklch(0.93 0.008 255)', accent: 'oklch(0.925 0.035 255)', 'accent-foreground': 'oklch(0.34 0.11 255)', ring: 'oklch(0.47 0.15 255)' }
const head = (id, patch = {}, light = {}) => ({ id, colorLogic: 'K1', motion: 'M1', dynamics: ['clip-reveal'], ...patch,
  color: { light: { ...SKELETON_LIGHT, ...light }, dark: { background: 'oklch(0.17 0.02 255)' } } })
const quiet = { log: () => {}, warn: () => {}, error: () => {} }
const collect = () => { const out = { log: [], warn: [], error: [] }; return { out, log: { log: (m) => out.log.push(m), warn: (m) => out.warn.push(m), error: (m) => out.error.push(m) } } }

test('near-white skeleton (§5-B + review I3): light bg L >= 0.96 · C < 0.015 and at most one hue group among painted keys (primary·secondary·accent, C >= 0.08)', () => {
  assert.equal(isSkeleton(head('a')), true)
  assert.equal(isSkeleton(head('b', {}, { background: 'oklch(0.95 0.004 255)' })), false) // L 0.95
  assert.equal(isSkeleton(head('c', {}, { background: 'oklch(0.98 0.02 255)' })), false) // C 0.02
  assert.equal(isSkeleton(head('e', { colorLogic: 'K6' })), false) // 색 면 논리는 「한 점」이 아니다
  assert.equal(isSkeleton(head('f', { defaultTheme: 'dark' })), false) // 다크 기본
  // 대조 픽스처(리뷰 I3): ring·글자색 하나만 다른 색상각이어도 여전히 골격이다
  assert.equal(isSkeleton(head('g', {}, { ring: 'oklch(0.55 0.15 30)' })), true)
  assert.equal(isSkeleton(head('h', {}, { 'accent-foreground': 'oklch(0.45 0.15 140)' })), true)
  // 칠하는 면(accent)이 C 0.12 로 다른 색상각이면 골격이 아니다
  assert.equal(isSkeleton(head('i', { }, { primary: 'oklch(0.45 0.15 255)', accent: 'oklch(0.85 0.12 60)' })), false)
  // 옅은 틴트(C < 0.08)는 면이어도 세지 않는다
  assert.equal(isSkeleton(head('j', {}, { primary: 'oklch(0.45 0.15 255)', accent: 'oklch(0.93 0.04 60)' })), true)
})

// 성질로 본다(정확한 벌 수·문장을 박지 않는다 — Task 9 fix 1, 리뷰 M9): 집행 켜짐 · 문제 없음 · 벌 수가 limitsFor 문턱 안.
test('after the owner board decisions (Task 9, enforced): the real recipes meet the distribution — exit 0, no problem lines, counts inside limitsFor', () => {
  const heads = loadRecipeHeads()
  assert.ok(heads.length >= 1)
  assert.equal(diversityEnforced(), true, 'factory/board/recipe-decisions.json applied')
  const { counts, problems } = diversityReport(heads)
  assert.deepEqual(problems, [])
  assert.equal(counts.total, heads.length)
  const L = limitsFor(counts.total)
  assert.ok(counts.skeleton <= L.skeletonMax, `골격 ${counts.skeleton} > ${L.skeletonMax}`)
  assert.ok(counts.bold >= L.boldMin, `K6~K8 ${counts.bold} < ${L.boldMin}`)
  assert.ok(counts.darkDefault >= L.darkMin, `다크 기본 ${counts.darkDefault} < ${L.darkMin}`)
  assert.ok(counts.m3 >= L.m3Min, `M3 ${counts.m3} < ${L.m3Min}`)
  assert.ok(counts.m0 <= L.m0Max, `M0 ${counts.m0} > ${L.m0Max}`)
  assert.equal(counts.noDynamics, 0)
  const { out, log } = collect()
  assert.equal(reportDiversity(heads, log, { enforced: true }), 0)
  assert.equal(out.error.length + out.warn.length, 0)
  assert.equal(out.log.length, 1)
  assert.match(out.log[0], new RegExp(`^레시피 다양성 분포: ${heads.length}벌 — .* · 문제 없음$`))
})

test('the board snapshot (before the decisions): shortfalls are warnings with exit 0, plus the board line computed from the B options', async () => {
  const { loadBoardHeads } = await import('../board/recipe-board/jobs.mjs')
  const heads = loadBoardHeads()
  assert.ok(heads.length >= 7, `레시피 ${heads.length}벌`)
  const { counts, problems } = diversityReport(heads)
  assert.equal(counts.total, heads.length)
  assert.ok(problems.length >= 1, '지금 7벌은 분포 기준에 못 미친다(대표 진단)')
  assert.equal(counts.noDynamics, 0, '모든 레시피가 dynamics 를 고른다')
  const { out, log } = collect()
  assert.equal(reportDiversity(heads, log, { enforced: false }), 0)
  assert.equal(out.error.length, 0)
  assert.equal(out.warn.length, problems.length + 1)
  const board = out.warn.find((m) => m.includes('보드에서 B안'))
  assert.equal(board, 'WARN 레시피 다양성 경고: 보드에서 B안(비골격) 최소 2벌 필요 — 후보: r1-measure(K6), r2-signal(K7), r3-woodblock(K8), r4-evidence(K7), r5-celadon(K6), r6-civic(K6), r7-docs(K6)')
})

test('boardRequirement: need = skeletons over the cap; candidates are skeletons whose whole B is non-skeleton; short list is flagged', () => {
  const bold = { colorLogic: 'K6', color: { light: { 'field-1': 'oklch(0.36 0.12 255)' }, dark: { 'field-1': 'oklch(0.3 0.1 255)' } }, note: 'x' }
  const heads = [
    ...Array.from({ length: 6 }, (_, i) => head(`s${i}`)),
    head('b1', { alternates: bold }),
    head('b2', { alternates: { motion: 'M2', note: '모션만 — 골격 그대로' } }),
    head('b3', { alternates: { ...bold, colorLogic: 'K8' } }),
  ]
  const r = boardRequirement(heads)
  assert.equal(r.need, 4) // 골격 9벌 > 5
  assert.deepEqual(r.candidates, ['b1(K6)', 'b3(K8)'])
  assert.equal(r.line, '보드에서 B안(비골격) 최소 4벌 필요 — 후보: b1(K6), b3(K8) · 후보 2벌 < 4벌 — 묶음을 더 대담하게')
  assert.deepEqual(boardRequirement(heads.slice(0, 5)), { need: 0, candidates: [], line: null })
})

test('enforcement is data: factory/board/recipe-decisions.json with applied: true (Task 9); absent or false means warnings only', () => {
  const dir = mkdtempSync(join(tmpdir(), 'wf-div-'))
  try {
    const f = join(dir, 'recipe-decisions.json')
    assert.equal(diversityEnforced(f), false)
    writeFileSync(f, JSON.stringify({ applied: false, decisions: [] }))
    assert.equal(diversityEnforced(f), false)
    writeFileSync(f, JSON.stringify({ applied: true, decisions: [] }))
    assert.equal(diversityEnforced(f), true)
    writeFileSync(f, '{ not json')
    assert.equal(diversityEnforced(f), false)
  } finally { rmSync(dir, { recursive: true, force: true }) }
  assert.equal(diversityEnforced(), true, '저장소에는 보드 결정이 반영됐다(Task 9 — applied: true)')
})

test('a synthetic 10-recipe set of skeletons: warnings before enforcement, violations (non-zero) once enforced', () => {
  const heads = Array.from({ length: 10 }, (_, i) => head(`s${i}`, { motion: i < 4 ? 'M0' : 'M1', dynamics: i === 0 ? [] : ['clip-reveal'] }))
  const { counts, problems } = diversityReport(heads)
  assert.deepEqual(counts, { total: 10, skeleton: 10, bold: 0, darkDefault: 0, m3: 0, m0: 4, noDynamics: 1 })
  const rules = problems.map((p) => p.split(':')[0])
  assert.deepEqual(rules.sort(), ['div-01 bold', 'div-01 dark', 'div-01 skeleton', 'div-06 dynamics', 'div-06 m0', 'div-06 m3'])
  assert.equal(reportDiversity(heads, quiet, { enforced: false }), 0, '10벌이어도 보드 결정 반영 전에는 경고만')
  const { out, log } = collect()
  assert.equal(reportDiversity(heads, log, { enforced: true }), problems.length)
  assert.equal(out.error.length, problems.length)
})

test('a synthetic 10-recipe set that spreads the skeleton passes when enforced (exit 0, no problems)', () => {
  const heads = [
    head('p1'), head('p2'), head('p3'), head('p4'), head('p5', { motion: 'M0', dynamics: ['grain'] }),
    head('p6', { colorLogic: 'K6', motion: 'M3', dynamics: ['split-text', 'sticky-stack'] }),
    head('p7', { colorLogic: 'K7', motion: 'M3', dynamics: ['clip-reveal'] }),
    head('p8', { colorLogic: 'K8', motion: 'M2', dynamics: ['tilt-3d'] }),
    head('p9', { defaultTheme: 'dark', motion: 'M0', dynamics: ['grain'] }),
    head('p10', { motion: 'M2', dynamics: ['svg-draw'] }, { primary: 'oklch(0.45 0.15 255)', accent: 'oklch(0.85 0.12 60)' }),
  ]
  const { counts, problems } = diversityReport(heads)
  assert.deepEqual(problems, [])
  assert.deepEqual(counts, { total: 10, skeleton: 5, bold: 3, darkDefault: 1, m3: 2, m0: 2, noDynamics: 0 })
  assert.equal(reportDiversity(heads, quiet, { enforced: true }), 0)
})

test('limits (review M7): 10-set numbers below 10; minimums step by whole tens, caps scale down-rounded', () => {
  assert.deepEqual(limitsFor(7), { skeletonMax: 5, boldMin: 3, darkMin: 1, m3Min: 2, m0Max: 3 })
  assert.deepEqual(limitsFor(10), { skeletonMax: 5, boldMin: 3, darkMin: 1, m3Min: 2, m0Max: 3 })
  assert.deepEqual(limitsFor(11), { skeletonMax: 5, boldMin: 3, darkMin: 1, m3Min: 2, m0Max: 3 }) // 11번째가 문턱을 뛰게 하지 않는다
  assert.deepEqual(limitsFor(15), { skeletonMax: 7, boldMin: 3, darkMin: 1, m3Min: 2, m0Max: 4 })
  assert.deepEqual(limitsFor(20), { skeletonMax: 10, boldMin: 6, darkMin: 2, m3Min: 4, m0Max: 6 })
})
