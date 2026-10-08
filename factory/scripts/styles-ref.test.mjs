// UI 스타일 사전 references/styles/styles.json 검사(P3-2 Task 15m, 접합면 J4). 모양·검사 함수는 styles-ref.mjs.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { StyleRef, Proposal, Implemented, styleProblems, axisValuesOnDisk, loadStyles, VERDICTS } from './styles-ref.mjs'
import { COMPAT } from './compat.mjs'

const doc = loadStyles()
const { styles, proposals } = doc
const disk = axisValuesOnDisk()

test('at least 30 styles, unique kebab ids in id order', () => {
  assert.ok(styles.length >= 30, `${styles.length}`)
  const ids = styles.map((s) => s.id)
  assert.equal(new Set(ids).size, ids.length)
  assert.deepEqual(ids, [...ids].sort())
})

test('every style has the required fields (zod StyleRef)', () => {
  for (const s of styles) {
    const r = StyleRef.safeParse(s)
    assert.ok(r.success, `${s.id}: ${r.success ? '' : r.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ')}`)
  }
})

test('axis values exist in registry/factory/styles/axes/*, and the folder agrees with compat.json', () => {
  for (const [axis, vals] of Object.entries(COMPAT.axes)) assert.deepEqual([...disk[axis]].sort(), [...vals].sort(), axis)
  for (const s of styles) for (const sel of [s.axes, ...s.axesVariants]) for (const [axis, v] of Object.entries(sel)) assert.ok(disk[axis]?.includes(v), `${s.id} ${axis}=${v}`)
})

test('no compat.json conflict: base set, variant sets, and each fitting archetype (axes + recipe fields)', () => {
  const problems = styles.flatMap((s) => styleProblems(s, disk))
  assert.deepEqual(problems, [])
})

test('verdicts are allow · allow-with-rules · ban, each with a reason; the counts line matches', () => {
  for (const s of styles) { assert.ok(VERDICTS.includes(s.verdict), s.id); assert.ok(s.verdictReason.length > 10, s.id) }
  for (const v of VERDICTS) assert.equal(doc.counts.byVerdict[v], styles.filter((s) => s.verdict === v).length, v)
  assert.equal(doc.counts.total, styles.length)
})

test('controller rulings: glassmorphism · liquid glass · neumorphism · mesh gradient stay banned', () => {
  for (const id of ['glassmorphism', 'liquid-glass', 'neumorphism', 'aurora-mesh-gradient']) assert.equal(styles.find((s) => s.id === id)?.verdict, 'ban', id)
})

test('evidence and rank: every style cites evidence; rank_score is the merged score of its rank parts', () => {
  for (const s of styles) {
    assert.ok(s.evidence.every((e) => e.type && (e.url || e.signal != null)), s.id)
    const parts = Object.values(s.rank_parts)
    const expect = (parts.reduce((t, p) => t + p.weight * p.pct, 0) + 0.5) / (parts.reduce((t, p) => t + p.weight, 0) + 1)
    assert.ok(Math.abs(expect - s.rank_score) < 0.002, `${s.id} ${expect} vs ${s.rank_score}`)
  }
  const drib = styles.filter((s) => s.rank_parts.dribbble)
  assert.ok(drib.length > 0 && drib.every((s) => s.rank_parts.dribbble.weight === 0.2), 'Dribbble weight 0.2 (spec §4)')
  assert.ok(styles.some((s) => s.rank_parts.curation), 'siteinspire category counts are in the rank')
  assert.ok(styles.some((s) => s.rank_parts.sns), 'SNS engagement is in the rank')
})

test('proposals: one section, all not implemented, every newAxisValues id resolves both ways', () => {
  const ids = new Set(proposals.map((p) => p.id))
  for (const p of proposals) {
    const r = Proposal.safeParse(p)
    assert.ok(r.success, p.id)
    for (const id of p.from) assert.ok(styles.find((s) => s.id === id)?.newAxisValues.includes(p.id), `${p.id} ← ${id}`)
  }
  for (const s of styles) for (const id of s.newAxisValues) assert.ok(ids.has(id), `${s.id} → ${id}`)
  // 건너뛴 제안(Task 16a 판단: S4·C5 렌즈 금지 스타일 전용, C9·H6 근거 적음)은 제안으로 남는다.
  for (const id of ['C9', 'H6', 'S4', 'S5', 'C5-lens']) assert.ok(ids.has(id), `brief proposal ${id}`)
  // 제안 값은 축 폴더에 아직 없다(구현되면 이 사전의 제안을 갱신한다).
  for (const p of proposals.filter((q) => /^[A-Z]\d$/.test(q.id))) assert.ok(!Object.values(disk).flat().includes(p.id), `${p.id} is implemented — update the proposal`)
})

test('Task 16a: implemented proposals (C6·C8·H5·R3·K9·D·X) left proposals and live in the styles that asked for them', () => {
  assert.deepEqual(doc.implemented.map((p) => p.id), ['C6', 'C8', 'H5', 'R3', 'K9', 'D', 'X'])
  const ids = new Set(proposals.map((p) => p.id))
  for (const p of doc.implemented) {
    assert.ok(Implemented.safeParse(p).success, p.id)
    assert.ok(!ids.has(p.id), `${p.id} still a proposal`)
    assert.ok(p.usedBy.length > 0, `${p.id} used by no style`)
    for (const sid of p.usedBy) {
      const s = styles.find((x) => x.id === sid)
      const sets = [s.axes, ...s.axesVariants]
      const uses = p.id === 'K9' ? s.recipeFields.colorLogic?.includes('K9') : p.id === 'D' ? sets.some((v) => v.display) : p.id === 'X' ? sets.some((v) => v.texture) : sets.some((v) => Object.values(v).includes(p.id))
      assert.ok(uses, `${sid} does not use ${p.id}`)
      assert.ok(!s.newAxisValues.includes(p.id), `${sid} still lists ${p.id} as new`)
    }
  }
  for (const [axis, vals] of [['display', ['D1', 'D2', 'D3']], ['texture', ['X0', 'X1', 'X2', 'X3', 'X4', 'X5', 'X6', 'X7', 'X8']]]) assert.deepEqual(disk[axis], vals, axis)
  // 웹툰 컷(C8, 0 계열)은 레인 벌(B2·H1 중간)과 부딪혀 기본 벌을 0 계열로 바꾸고 원래 벌을 변형으로 남겼다.
  const w = styles.find((s) => s.id === 'webtoon-panel')
  assert.equal(w.axes.surface, 'C8')
  assert.ok(w.axesNotes.some((n) => /C8\(zero 계열\)/.test(n)), w.axesNotes.join(' / '))
})

// ── 음성 대조: 검사가 실제로 잡는지 ──
const good = structuredClone(styles.find((s) => s.id === 'neo-brutalism') ?? styles[0])

test('negative control: a missing field and an unknown verdict fail the schema', () => {
  const noReason = structuredClone(good)
  delete noReason.verdictReason
  assert.equal(StyleRef.safeParse(noReason).success, false)
  assert.equal(StyleRef.safeParse({ ...good, verdict: 'maybe' }).success, false)
  assert.equal(StyleRef.safeParse({ ...good, extra: 1 }).success, false)
  assert.equal(StyleRef.safeParse(good).success, true)
})

test('negative control: an axis value not on disk and a radius-family clash are reported', () => {
  assert.ok(styleProblems({ ...good, axes: { ...good.axes, surface: 'C9' } }, disk).some((m) => /C9/.test(m)))
  assert.ok(styleProblems({ ...good, axes: { button: 'B4', radius: 'R0' }, axesVariants: [], archetypes: [] }, disk).some((m) => /반경 계열 충돌/.test(m)))
  assert.ok(styleProblems({ ...good, axes: { button: 'B1', radius: 'R0' }, axesVariants: [{ button: 'B4', radius: 'R0' }], archetypes: [] }, disk).some((m) => /변형 1/.test(m)))
})

test('negative control: archetype rules (C5 × dashboard, H4 outside dashboard, M3 × public, K8 × public) are reported', () => {
  const base = { id: 'x', axes: {}, axesVariants: [], recipeFields: {} }
  assert.ok(styleProblems({ ...base, axes: { surface: 'C5' }, archetypes: ['dashboard'] }, disk).length > 0)
  assert.ok(styleProblems({ ...base, axes: { header: 'H4' }, archetypes: ['saas'] }, disk).length > 0)
  assert.ok(styleProblems({ ...base, recipeFields: { motion: 'M3' }, archetypes: ['public'] }, disk).length > 0)
  assert.ok(styleProblems({ ...base, recipeFields: { colorLogic: ['K1', 'K8'] }, archetypes: ['public'] }, disk).length > 0)
  assert.deepEqual(styleProblems({ ...base, axes: { surface: 'C5' }, archetypes: ['brand'] }, disk), [])
})
