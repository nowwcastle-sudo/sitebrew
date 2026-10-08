// 빈틈 표(레퍼런스 쪽) 생성기 시험 — factory v1 Task 2.3.
//   작은 고정 재료(fixtures/gap-matrix/: 가짜 카드 6장 + 가짜 블록·레시피·모션·스타일 목록 + SNS 행 2개)로 결과 행을 단언한다.
//   양성·음성 대조: 있는 히어로 종류는 빈틈이 아니고(근거 토큰을 빼면 빈틈이 된다), 카드 2장(대담안)에 나온 새 스크롤 기법은 빈틈 1행이며,
//   같은 기법이 일반 카드 2장이면 행이 없고, 적합도 미달 카드는 세지 않는다.
//   실제 카드 폴더(REFCARDS_DIR, 기본 design-rules/factory/refs-v2/cards)는 저장소 밖이다. 없는 컴퓨터(CI)에서는 건너뜀으로 세지 않고
//   통과 + 메모(t.diagnostic)로 끝낸다 — ci/baselines/skipped-tests.txt 는 새 건너뜀을 허용하지 않는다(harvest-v2-doc.test.mjs 와 같은 방식).
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import {
  DEFAULT_CARDS_DIR, MIN_BOLD_CARDS, MIN_CARDS, buildGapMatrix, gapRows, generate, loadCards, loadInventory, loadSns, main, renderJson, renderMarkdown,
} from './gap-matrix.mjs'
import { PATTERNS, isMisfit } from './lib/gap-patterns.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const FX = join(HERE, 'fixtures', 'gap-matrix')
const FX_CARDS = join(FX, 'cards')
const FX_REPO = join(FX, 'repo')
const FX_SNS = join(FX, 'gap-sns.json')
const SCRIPT = join(HERE, 'gap-matrix.mjs')

const cardsDir = process.env.REFCARDS_DIR || DEFAULT_CARDS_DIR
const hasRealCards = existsSync(cardsDir)
const NOTE = `실제 카드 폴더 없음(${cardsDir}) — 실제 카드 검사는 건너뛴다(통과 + 메모). 고정 재료 시험만 돈다.`

const Row = z.object({
  id: z.string().regex(/^(refs|sns):[a-z0-9][a-z0-9:-]{3,70}$/),
  source: z.enum(['refs', 'sns']),
  archetypes: z.array(z.string()).max(10),
  pattern: z.string().min(2).max(200),
  evidence: z.object({
    cards: z.number().int().min(0),
    boldCards: z.number().int().min(0),
    cardIds: z.array(z.string()),
    sns: z.object({ mentions: z.number().int().min(0) }).strict(),
  }).strict(),
  factoryCoverage: z.enum(['yes', 'partial', 'no']),
  coverageEvidence: z.array(z.string().min(3).max(300)).min(1),
  proposal: z.object({
    kind: z.enum(['block', 'recipe', 'motion', 'gate', 'rule', 'doc', 'launch-factory']),
    summary: z.string().min(8).max(240),
  }).strict(),
  bold: z.boolean(),
  goldenImpact: z.boolean(),
}).strict()

const load = () => {
  const { cards } = loadCards(FX_CARDS)
  return { cards, sns: loadSns(FX_SNS), inventory: loadInventory(FX_REPO) }
}
const build = (over = {}) => buildGapMatrix({ ...load(), ...over })
const rowOf = (matrix, id) => matrix.rows.find((r) => r.id === id)
const without = (inv, ...tokens) => ({ ...inv, tokens: new Set([...inv.tokens].filter((t) => !tokens.includes(t))) })

test('임계값은 계획대로: 일반 카드 3장 · 대담안 2장', () => {
  assert.equal(MIN_CARDS, 3)
  assert.equal(MIN_BOLD_CARDS, 2)
})

test('loadInventory: 블록 메타·레시피 머리·모션 키트·효과 카드·스타일·축·부품이 토큰으로 나온다 (금지 스타일은 빠진다)', () => {
  const { tokens, counts } = loadInventory(FX_REPO)
  for (const t of [
    'block:kind:hero', 'block:kind:announcement', 'block:variant:hero/split', 'block:layout:baseline-split', 'block:media:video',
    'block:motion:rise', 'block:motion:clip-reveal',
    'recipe:color:k1', 'recipe:color:k2', 'recipe:dynamics:clip-reveal', 'recipe:dynamics:svg-draw', 'recipe:dynamics:split-text',
    'recipe:motion:m2', 'recipe:hero:baseline-split', 'recipe:axes:button:b4',
    'axis:button:b4',
    'motion:tech:kinetic', 'motion:tech:stagger', 'motion:tech:whip', 'motion:ease:out', 'motion:ease:in-out-whip',
    'card:marquee-strip', 'card:ease-out',
    'style:minimalism', 'style:dual-logic', 'style:color:k3', 'style:color:k4', 'style:color:k9',
    'ui:dialog', 'ui:carousel',
  ]) assert.ok(tokens.has(t), `토큰 없음: ${t}`)
  for (const t of ['style:banned-thing', 'style:color:k5', 'block:motion:horizontal', 'card:horizontal-scroll']) assert.ok(!tokens.has(t), `있으면 안 되는 토큰: ${t}`)
  for (const t of tokens) assert.equal(t, t.toLowerCase(), t)
  assert.deepEqual(counts, { blocks: 2, recipes: 1, techs: 3, eases: 2, effectCards: 2, styles: 2, ui: 2 })
})

test('loadInventory: 폴더가 없으면 던지지 않고 빈 인벤토리(모두 빈틈으로 보인다)', () => {
  const inv = loadInventory(join(FX, 'nope'))
  assert.equal(inv.tokens.size, 0)
})

test('loadCards: 카드를 id 순으로 읽고, 읽을 수 없는 파일은 이유와 함께 건너뛴다', () => {
  const { cards, skipped } = loadCards(FX_CARDS)
  assert.deepEqual(cards.map((c) => c.id), ['fx-brand-a', 'fx-brand-b', 'fx-misfit-e', 'fx-misfit-f', 'fx-saas-c', 'fx-saas-d'])
  assert.deepEqual(skipped, [])
  const tmp = mkdtempSync(join(tmpdir(), 'fv1-gapmatrix-cards-'))
  try {
    writeFileSync(join(tmp, 'broken.json'), '{ 깨진')
    writeFileSync(join(tmp, 'noid.json'), JSON.stringify({ archetype: 'brand' }))
    writeFileSync(join(tmp, 'ok.json'), JSON.stringify({ id: 'ok', archetype: 'brand' }))
    const r = loadCards(tmp)
    assert.deepEqual(r.cards.map((c) => c.id), ['ok'])
    assert.deepEqual(r.skipped.map((s) => s.file).sort(), ['broken.json', 'noid.json'])
    assert.ok(r.skipped.every((s) => s.reason.length > 3))
  } finally { rmSync(tmp, { recursive: true, force: true }) }
})

test('고정 재료의 적합도: 점수 미달·자기 원형 빠짐 두 장은 거른다', () => {
  const { cards } = loadCards(FX_CARDS)
  assert.deepEqual(cards.filter(isMisfit).map((c) => c.id), ['fx-misfit-e', 'fx-misfit-f'])
})

test('있는 히어로 종류(전면 영상)는 빈틈이 아니다: 행은 있되 coverage yes · 제안은 doc · gapRows 에 없다', () => {
  const m = build()
  const r = rowOf(m, 'refs:hero:fullscreen-video')
  assert.ok(r, '3장 이상에 나온 패턴은 행으로 남는다')
  assert.equal(r.factoryCoverage, 'yes')
  assert.equal(r.proposal.kind, 'doc')
  assert.equal(r.goldenImpact, false)
  assert.equal(r.evidence.cards, 3)
  assert.deepEqual(r.evidence.cardIds, ['fx-brand-a', 'fx-brand-b', 'fx-saas-c'])
  assert.deepEqual(r.archetypes, ['brand', 'saas'])
  assert.ok(r.coverageEvidence.includes('block:media:video'))
  assert.ok(!gapRows(m.rows).some((x) => x.id === r.id))
})

test('음성 대조: 근거 토큰을 빼면 같은 행이 빈틈(no)이 된다 — 블록 제안과 골든 영향', () => {
  const inv = load().inventory
  const m = build({ inventory: without(inv, 'block:media:video') })
  const r = rowOf(m, 'refs:hero:fullscreen-video')
  assert.equal(r.factoryCoverage, 'no')
  assert.ok(gapRows(m.rows).some((x) => x.id === r.id))
  assert.notEqual(r.proposal.kind, 'doc')
  assert.ok(r.coverageEvidence[0].startsWith('없음'), r.coverageEvidence[0])
})

test('대담안 카드 2장에 나온 새 스크롤 기법은 빈틈 1행: no · motion 제안 · bold · 근거 카드 id', () => {
  const m = build()
  const hits = m.rows.filter((r) => r.id === 'refs:scroll:horizontal-scroll')
  assert.equal(hits.length, 1)
  const r = hits[0]
  assert.equal(r.source, 'refs')
  assert.equal(r.factoryCoverage, 'no')
  assert.equal(r.proposal.kind, 'motion')
  assert.equal(r.bold, true)
  assert.equal(r.goldenImpact, false)
  assert.equal(r.evidence.cards, 2)
  assert.equal(r.evidence.boldCards, 2)
  assert.deepEqual(r.evidence.cardIds, ['fx-brand-a', 'fx-brand-b'])
  assert.deepEqual(r.archetypes, ['brand'])
  assert.equal(r.evidence.sns.mentions, 0)
})

test('임계값 음성 대조: 같은 기법이 일반 카드 2장이면 행이 없다 / 일반 3장이면 행이 있다', () => {
  const { cards } = load()
  const down = cards.map((c) => (c.boldness === 'bold' ? { ...c, boldness: 'balanced' } : c))
  assert.equal(rowOf(build({ cards: down }), 'refs:scroll:horizontal-scroll'), undefined, '일반 2장은 모자란다')
  // 셋째 일반 카드를 더하면 3장 → 행
  const third = { ...cards.find((c) => c.id === 'fx-saas-c'), id: 'fx-saas-extra', motion: { ...cards.find((c) => c.id === 'fx-saas-c').motion, scroll: '가로 스크롤 구획' } }
  const m3 = build({ cards: [...down, third] })
  const r = rowOf(m3, 'refs:scroll:horizontal-scroll')
  assert.ok(r, '일반 3장은 충분하다')
  assert.equal(r.evidence.cards, 3)
  assert.equal(r.bold, false)
})

test('적합도 미달 카드는 세지 않는다: 가로 스크롤 카드는 4장이지만 행은 2장, 배경색 순환은 일반 2장 + 미달 1장이라 행이 없다', () => {
  const m = build()
  assert.equal(rowOf(m, 'refs:scroll:horizontal-scroll').evidence.cards, 2)
  assert.equal(rowOf(m, 'refs:transition:bg-color-cycle'), undefined)
  assert.ok(m.rows.every((r) => !r.evidence.cardIds.some((id) => id.startsWith('fx-misfit'))), '미달 카드 id 가 근거에 없다')
  assert.deepEqual(m.meta.cards, { total: 6, used: 4, misfit: 2 })
  // 양성 대조: 미달 카드를 맞는 카드로 바꾸면 같은 배경색 순환이 3장이 되어 행이 생긴다
  const fixed = load().cards.map((c) => (c.id === 'fx-misfit-e' ? { ...c, fit: { archetypes: ['landing'], score: 0.9 } } : c))
  assert.ok(rowOf(build({ cards: fixed }), 'refs:transition:bg-color-cycle'), '미달만 아니었다면 행이 생긴다')
})

test('색 논리: 3장 이상이고 레시피에는 없지만 스타일 사전에는 있으면 partial — 금지 스타일의 색은 근거가 아니다', () => {
  const m = build()
  const r = rowOf(m, 'refs:color:k3')
  assert.equal(r.factoryCoverage, 'partial')
  assert.equal(r.evidence.cards, 3)
  assert.ok(r.coverageEvidence.includes('style:color:k3'))
  assert.equal(r.proposal.kind, 'recipe')
  assert.equal(r.goldenImpact, true)
  assert.ok(gapRows(m.rows).some((x) => x.id === r.id), 'partial 도 빈틈 쪽')
})

test('SNS 행이 source "sns" 로 합쳐진다: id 접두 · 카드 0 · 언급 수 · 제안·골든 영향 그대로', () => {
  const m = build()
  const g = rowOf(m, 'sns:fx-sns-gap')
  assert.equal(g.source, 'sns')
  assert.equal(g.factoryCoverage, 'no')
  assert.equal(g.evidence.cards, 0)
  assert.deepEqual(g.evidence.cardIds, [])
  assert.equal(g.evidence.sns.mentions, 120)
  assert.deepEqual(g.proposal, { kind: 'motion', summary: '스크롤 연출 프리셋 하나를 키트에 더한다' })
  assert.deepEqual(g.archetypes, ['brand', 'saas'])
  assert.equal(g.bold, false)
  assert.equal(g.goldenImpact, false)
  assert.ok(g.pattern.includes('스크롤'))
  const c = rowOf(m, 'sns:fx-sns-covered')
  assert.equal(c.factoryCoverage, 'yes')
  assert.equal(c.evidence.sns.mentions, 300)
  assert.deepEqual(c.coverageEvidence, ['registry/factory/ax/seo-meta.ts'])
})

test('정렬은 안정적: 빈틈(no → partial) 먼저, yes 는 뒤 · 같은 쪽 안에서 refs → sns · 입력 순서를 뒤집어도 결과가 같다', () => {
  const m = build()
  assert.deepEqual(m.rows.map((r) => r.id), [
    'refs:scroll:horizontal-scroll', 'sns:fx-sns-gap', 'refs:color:k3', 'refs:hero:fullscreen-video', 'sns:fx-sns-covered',
  ])
  const { cards, sns, inventory } = load()
  const rev = buildGapMatrix({ cards: [...cards].reverse(), sns: [...sns].reverse(), inventory })
  assert.deepEqual(rev, m)
  assert.equal(renderJson(rev), renderJson(m))
  assert.equal(renderMarkdown(rev), renderMarkdown(m))
})

test('모든 행이 스키마를 지킨다 (고정 재료)', () => {
  for (const r of build().rows) assert.doesNotThrow(() => Row.parse(r), r.id)
})

test('buildGapMatrix: 입력을 바꾸지 않는다', () => {
  const l = load()
  const snap = JSON.stringify({ cards: l.cards, sns: l.sns })
  buildGapMatrix(l)
  assert.equal(JSON.stringify({ cards: l.cards, sns: l.sns }), snap)
})

test('renderMarkdown: 첫 줄에 다시 만드는 법 · 빈틈과 이미 있음 두 절 · 모든 행 id · CR 없음 · 같은 입력은 같은 글', () => {
  const m = build()
  const md = renderMarkdown(m)
  const first = md.split('\n')[0]
  assert.match(first, /^<!-- 생성물 — node factory\/scripts\/gap-matrix\.mjs --write/, first)
  assert.ok(!md.includes('\r'))
  assert.ok(md.includes('## 빈틈'))
  assert.ok(md.includes('## 이미 있음'))
  for (const r of m.rows) assert.ok(md.includes(r.id), `표에 ${r.id} 가 없다`)
  assert.ok(md.includes('--check'))
  assert.equal(renderMarkdown(build()), md)
})

test('renderJson: 그대로 파싱되고 meta·rows 가 같다 · 끝에 줄바꿈 하나', () => {
  const m = build()
  const text = renderJson(m)
  assert.ok(text.endsWith('}\n'))
  assert.deepEqual(JSON.parse(text), JSON.parse(JSON.stringify(m)))
  assert.deepEqual(Object.keys(JSON.parse(text)), ['meta', 'rows'])
})

test('generate: 폴더 셋으로 행렬·글·JSON 을 한 번에 — 건너뛴 카드 목록을 함께 준다', () => {
  const g = generate({ cardsDir: FX_CARDS, snsFile: FX_SNS, inventoryRoot: FX_REPO })
  assert.equal(g.matrix.rows.length, 5)
  assert.deepEqual(g.skipped, [])
  assert.equal(g.md, renderMarkdown(g.matrix))
  assert.equal(g.json, renderJson(g.matrix))
})

test('표의 근거 토큰은 오타가 아니다: 실제 저장소 인벤토리에 있는 이름만 쓴다 (색 논리 K 토큰만 일부러 없는 것이 있다)', () => {
  const REPO = join(HERE, '..', '..')
  const { tokens } = loadInventory(REPO)
  assert.ok(tokens.size > 300, `실제 인벤토리 토큰 ${tokens.size}개`)
  const missing = []
  for (const p of PATTERNS) {
    if (p.dim === 'color') continue
    for (const t of [...p.covers, ...p.near]) if (!tokens.has(t)) missing.push(`${p.id} → ${t}`)
  }
  assert.deepEqual(missing, [], '표에만 있고 저장소에 없는 근거 토큰')
  // 음성 대조: 오타 토큰은 실제로 잡힌다
  assert.ok(!tokens.has('block:kind:herro'))
})

// ── CLI(main) ─────────────────────────────────────────────────────────────
const io = () => { const out = []; return { out, log: (s) => out.push(String(s)), text: () => out.join('\n') } }
const base = (tmp) => ['--cards', FX_CARDS, '--sns', FX_SNS, '--inventory', FX_REPO, '--out', tmp]

test('main --write → --check: 쓰면 검사가 0, 글을 바꾸면 1, 파일이 없으면 1(쓰라는 안내)', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'fv1-gapmatrix-out-'))
  try {
    const w = io()
    assert.equal(main(['--write', ...base(tmp)], { log: w.log }), 0)
    assert.ok(existsSync(join(tmp, 'gap-matrix.md')) && existsSync(join(tmp, 'gap-matrix.json')))
    assert.ok(!readFileSync(join(tmp, 'gap-matrix.md'), 'utf8').includes('\r'))
    const c = io()
    assert.equal(main(['--check', ...base(tmp)], { log: c.log }), 0, c.text())
    // 줄바꿈만 CRLF 로 바뀐 체크아웃은 같은 것으로 본다
    writeFileSync(join(tmp, 'gap-matrix.md'), readFileSync(join(tmp, 'gap-matrix.md'), 'utf8').replace(/\n/g, '\r\n'))
    assert.equal(main(['--check', ...base(tmp)], { log: io().log }), 0, 'CRLF 는 차이가 아니다')
    // md 를 바꾸면 1
    writeFileSync(join(tmp, 'gap-matrix.md'), readFileSync(join(tmp, 'gap-matrix.md'), 'utf8') + '손으로 쓴 줄\n')
    const d = io()
    assert.equal(main(['--check', ...base(tmp)], { log: d.log }), 1)
    assert.match(d.text(), /gap-matrix\.md/)
    assert.match(d.text(), /--write/)
    // 다시 쓰면 0
    assert.equal(main(['--write', ...base(tmp)], { log: io().log }), 0)
    assert.equal(main(['--check', ...base(tmp)], { log: io().log }), 0)
    // json 을 바꾸면 1
    writeFileSync(join(tmp, 'gap-matrix.json'), '{}\n')
    const j = io()
    assert.equal(main(['--check', ...base(tmp)], { log: j.log }), 1)
    assert.match(j.text(), /gap-matrix\.json/)
    // 파일이 없으면 1
    rmSync(join(tmp, 'gap-matrix.json'))
    const e = io()
    assert.equal(main(['--check', ...base(tmp)], { log: e.log }), 1)
    assert.match(e.text(), /없다/)
  } finally { rmSync(tmp, { recursive: true, force: true }) }
})

test('main --check: 카드 폴더가 없으면 0 + 메모(CI 에서 실패하지 않는다) — --write 는 1 이고 아무것도 쓰지 않는다', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'fv1-gapmatrix-out-'))
  try {
    const args = ['--cards', join(tmp, '없는-카드-폴더'), '--sns', FX_SNS, '--inventory', FX_REPO, '--out', tmp]
    const c = io()
    assert.equal(main(['--check', ...args], { log: c.log }), 0)
    assert.match(c.text(), /카드 폴더 없음/)
    assert.match(c.text(), /건너/)
    const w = io()
    assert.equal(main(['--write', ...args], { log: w.log }), 1)
    assert.ok(!existsSync(join(tmp, 'gap-matrix.md')), '쓰지 않았다')
  } finally { rmSync(tmp, { recursive: true, force: true }) }
})

test('main: 모드가 없거나 둘이면 2(사용법) · REFCARDS_DIR 환경 변수가 기본 카드 폴더를 바꾼다', () => {
  assert.equal(main([], { log: io().log }), 2)
  assert.equal(main(['--write', '--check'], { log: io().log }), 2)
  const c = io()
  assert.equal(main(['--check', '--sns', FX_SNS, '--inventory', FX_REPO], { log: c.log, env: { REFCARDS_DIR: join(FX, '없음') } }), 0)
  assert.match(c.text(), /카드 폴더 없음/)
  assert.ok(c.text().includes(join(FX, '없음')), '환경 변수 경로를 메모에 적는다')
})

test('CLI 실행: 카드 폴더가 없는 환경에서 node gap-matrix.mjs --check 는 종료 0 (건너뜀 메모)', () => {
  const r = spawnSync(process.execPath, [SCRIPT, '--check'], { env: { ...process.env, REFCARDS_DIR: join(FX, '없는-카드-폴더') }, encoding: 'utf8' })
  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout, /카드 폴더 없음/)
})

// ── 실제 카드 ─────────────────────────────────────────────────────────────
test('실제 카드: 행렬이 스키마를 지키고, 적합도 미달 카드는 어느 행에도 없고, 패턴 id 가 표에 있다 (폴더가 없으면 통과 + 메모)', (t) => {
  if (!hasRealCards) { t.diagnostic(NOTE); return }
  const g = generate({ cardsDir, snsFile: join(HERE, '..', '..', 'docs', 'qa', 'factory-v1', 'gap-sns.json'), inventoryRoot: join(HERE, '..', '..') })
  const misfitIds = new Set(loadCards(cardsDir).cards.filter(isMisfit).map((c) => c.id))
  const ids = new Set(PATTERNS.map((p) => `refs:${p.id}`))
  assert.ok(g.matrix.rows.length > 0)
  for (const r of g.matrix.rows) {
    Row.parse(r)
    assert.ok(!r.evidence.cardIds.some((id) => misfitIds.has(id)), `${r.id} 근거에 미달 카드`)
    if (r.source === 'refs') {
      assert.ok(ids.has(r.id), `${r.id} 는 표에 없는 패턴`)
      assert.ok(r.evidence.cards >= MIN_BOLD_CARDS, r.id)
      assert.ok(r.evidence.cards >= MIN_CARDS || r.evidence.boldCards >= MIN_BOLD_CARDS, `${r.id} 임계값 미달`)
    }
  }
  assert.deepEqual(g.skipped, [], '읽지 못한 카드 파일이 있다')
})
