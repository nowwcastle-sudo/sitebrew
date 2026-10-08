// 선택 학습(factory v1 Task 4.4 · 합의안 D14) — 가중치 계산(범위 0.5~2) · 사용자 파일(밖으로 안 보냄) · 대표 씨앗 · chooseVariants 의 동점 가중치.
// 네트워크 호출 0 은 fetch 를 던지게 바꿔 놓고 모든 경로를 돌려 증명한다. chooseVariants 는 고정 사본(바꾸기 전 함수)과 글자 단위로 대조한다.
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, test } from 'node:test'
import { MAX_WEIGHT, MIN_WEIGHT, emptyPreferences, loadPreferences, recordPick, savePreferences, userPreferencesFile, weightOf } from '../board/preferences.mjs'
import { buildSeed, SEED_FILE, seedText } from '../board/gen-preferences-seed.mjs'
import { BOOSTED, DEMOTED, DENSITIES, blockDensities, chooseVariants, densityOf } from '../stamp/variants.mjs'
import { loadWeights, mulberry32, MIN_CONVERSIONS } from '../stamp/directions.mjs'
import { loadLibrary } from './style-presets.mjs'
import { buildSitemap } from '../stamp/sitemap.mjs'
import { archetypes, SAAS_BRIEF, localBrief, library } from './lib/stamp-site-fixtures.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const TMP = join(ROOT, '.tmp', 'prefs-test')
mkdirSync(TMP, { recursive: true })
let dir
beforeEach(() => { dir = mkdtempSync(join(TMP, 't-')) })
afterEach(() => { rmSync(dir, { recursive: true, force: true }) })

const A = 'block-hero-baseline-split'
const B = 'block-hero-step-band-orbit'
const pick = (prefs, winner, loser, extra = {}) => recordPick(prefs, { archetype: 'saas', winner, loser, kind: 'section', ...extra })

test('같은 짝을 3번 이긴 변형의 가중치가 오르고, 진 변형은 내리며, 상한 2·하한 0.5 를 넘지 않는다', () => {
  let p = emptyPreferences()
  assert.equal(weightOf(p, 'saas', A), 1)
  for (let i = 0; i < 3; i++) p = pick(p, A, B)
  assert.ok(weightOf(p, 'saas', A) > 1 && weightOf(p, 'saas', A) <= MAX_WEIGHT, `3승 뒤 ${weightOf(p, 'saas', A)}`)
  assert.ok(weightOf(p, 'saas', B) < 1 && weightOf(p, 'saas', B) >= MIN_WEIGHT)
  for (let i = 0; i < 50; i++) p = pick(p, A, B)
  assert.equal(weightOf(p, 'saas', A), MAX_WEIGHT)
  assert.equal(weightOf(p, 'saas', B), MIN_WEIGHT)
  assert.equal([MIN_WEIGHT, MAX_WEIGHT].join('~'), '0.5~2')
  assert.equal(weightOf(p, 'brand', A), 1, '원형이 다르면 다른 학습이다')
  assert.equal(weightOf(p, 'saas', 'block-never-seen'), 1, '본 적 없는 변형의 기본은 1')
})

test('recordPick 은 받은 값을 바꾸지 않고 새 값을 돌려준다 · 입력을 검사한다', () => {
  const p0 = emptyPreferences()
  const frozen = JSON.stringify(p0)
  const p1 = pick(p0, A, B)
  assert.equal(JSON.stringify(p0), frozen)
  assert.notEqual(p1, p0)
  assert.throws(() => pick(p0, A, A), /변형이 같다/)
  assert.throws(() => pick(p0, A, B, { kind: 'nope' }), /kind/)
  assert.throws(() => pick(p0, '', B), /winner/)
  assert.throws(() => recordPick(p0, { archetype: '', winner: A, loser: B, kind: 'section' }), /archetype/)
  for (const kind of ['direction', 'section', 'axis']) assert.doesNotThrow(() => pick(p0, A, B, { kind }))
})

test('사용자 파일이 없으면 씨앗만 쓴다 — 읽기만 하고 파일을 만들지 않는다', () => {
  const seedFile = join(dir, 'seed.json')
  writeFileSync(seedFile, JSON.stringify({ version: 1, counts: { saas: { [A]: { win: 2, loss: 0 } }, '*': { [B]: { win: 0, loss: 1 } } } }))
  const userFile = join(dir, 'nope', 'preferences.json')
  const p = loadPreferences({ seedFile, userFile })
  assert.equal(weightOf(p, 'saas', A), 1.5)
  assert.equal(weightOf(p, 'saas', B), 0.75, '「*」 칸은 모든 원형에 적용된다')
  assert.equal(weightOf(p, 'brand', B), 0.75)
  assert.equal(weightOf(p, 'brand', A), 1)
  assert.equal(existsSync(join(dir, 'nope')), false, '읽기가 폴더·파일을 만들지 않는다')
  assert.deepEqual(p.warnings, [])
  // 씨앗도 없으면 모두 1
  assert.equal(weightOf(loadPreferences({ seedFile: join(dir, 'x.json'), userFile }), 'saas', A), 1)
})

test('사용자 파일은 CLAUDE_PLUGIN_DATA 아래, 없으면 ~/.factory 아래 preferences.json 이다', () => {
  assert.equal(userPreferencesFile({ CLAUDE_PLUGIN_DATA: join(dir, 'plug') }), join(dir, 'plug', 'preferences.json'))
  assert.equal(userPreferencesFile({}), join(homedir(), '.factory', 'preferences.json'))
  assert.equal(userPreferencesFile({ CLAUDE_PLUGIN_DATA: '  ' }), join(homedir(), '.factory', 'preferences.json'), '빈 값은 없는 것으로 본다')
})

test('저장 → 다시 읽기: 사용자 몫만 파일에 쓰고(씨앗은 복사하지 않는다), 같은 가중치가 돌아온다', () => {
  const seedFile = join(dir, 'seed.json')
  writeFileSync(seedFile, JSON.stringify({ version: 1, counts: { saas: { [A]: { win: 1, loss: 0 } } } }))
  const userFile = join(dir, 'u', 'preferences.json')
  let p = loadPreferences({ seedFile, userFile })
  for (let i = 0; i < 2; i++) p = pick(p, B, A)
  savePreferences(p, { userFile })
  const saved = JSON.parse(readFileSync(userFile, 'utf8'))
  assert.deepEqual(saved.user.saas[B], { win: 2, loss: 0 })
  assert.deepEqual(saved.user.saas[A], { win: 0, loss: 2 })
  assert.equal(JSON.stringify(saved).includes('"seed"'), false)
  const again = loadPreferences({ seedFile, userFile })
  assert.equal(weightOf(again, 'saas', B), weightOf(p, 'saas', B))
  assert.equal(weightOf(again, 'saas', A), weightOf(p, 'saas', A))
  assert.equal(weightOf(again, 'saas', A), 1 + 0.25 * (1 - 2), '씨앗 1승 + 사용자 2패')
})

test('손상된 사용자 파일은 씨앗만 쓰고 경고를 남긴다(조용히 삼키지 않는다) · 덮어쓰지 않는다', () => {
  const userFile = join(dir, 'preferences.json')
  writeFileSync(userFile, '{ 깨진 json')
  const p = loadPreferences({ seedFile: join(dir, 'none.json'), userFile })
  assert.equal(p.warnings.length, 1)
  assert.match(p.warnings[0], /preferences\.json/)
  assert.equal(readFileSync(userFile, 'utf8'), '{ 깨진 json', '읽기는 파일을 건드리지 않는다')
  writeFileSync(userFile, JSON.stringify({ version: 1, user: { saas: { [A]: { win: 'x', loss: -3 } } } }))
  assert.equal(weightOf(loadPreferences({ seedFile: join(dir, 'none.json'), userFile }), 'saas', A), 1, '모양이 틀린 칸은 무시한다')
})

test('네트워크 호출 0 — fetch 를 던지게 바꿔도 읽기·기록·저장·고르기가 모두 통과한다', async () => {
  const realFetch = globalThis.fetch
  let calls = 0
  globalThis.fetch = () => { calls++; throw new Error('네트워크 금지') }
  try {
    const userFile = join(dir, 'preferences.json')
    let p = loadPreferences({ userFile })
    p = pick(p, A, B)
    savePreferences(p, { userFile })
    const sm = buildSitemap(archetypes.saas, SAAS_BRIEF)
    const out = chooseVariants(sm, [{ id: 'a', recipe: library[0].id }], { seed: 7, weights: [], preferences: loadPreferences({ userFile }) })
    assert.ok(out.a['home/hero'])
  } finally { globalThis.fetch = realFetch }
  assert.equal(calls, 0)
})

// ── 씨앗: pairs.jsonl + 레시피 보드 판정에서 생성한다 ─────────────────────────────

test('씨앗 생성: 결선 짝(이긴 쪽 승·진 쪽 패, 원형별)과 레시피 보드의 축 판정(「*」)을 센다', () => {
  const pairs = [
    { a: 'r8-dusk', b: 'x-1', winner: 'a', archetype: 'brand' },
    { a: 'r2-signal', b: 'r8-dusk', winner: 'b', archetype: 'brand' },
    { a: 'r1-measure', b: 'r2-signal', winner: 'a', archetype: 'saas' },
  ]
  const decisions = { decisions: [{ recipe: 'r2-signal', verdict: 'approve', axisPicks: { colorLogic: 'B', motion: 'A' } }, { recipe: 'r1-measure', verdict: 'approve', axisPicks: { colorLogic: 'A' } }] }
  const seed = buildSeed({ pairs, decisions })
  assert.equal(seed.version, 1)
  assert.deepEqual(seed.counts.brand['r8-dusk'], { win: 2, loss: 0 })
  assert.deepEqual(seed.counts.brand['x-1'], { win: 0, loss: 1 })
  assert.deepEqual(seed.counts.brand['r2-signal'], { win: 0, loss: 1 })
  assert.deepEqual(seed.counts.saas['r1-measure'], { win: 1, loss: 0 })
  assert.deepEqual(seed.counts['*']['colorLogic:B'], { win: 1, loss: 1 }, '축 판정: 고른 값 승·고르지 않은 값 패')
  assert.deepEqual(seed.counts['*']['colorLogic:A'], { win: 1, loss: 1 })
  assert.deepEqual(seed.counts['*']['motion:A'], { win: 1, loss: 0 })
  assert.deepEqual(seed.counts['*']['motion:B'], { win: 0, loss: 1 })
  assert.equal(JSON.stringify(seed).match(/20\d\d-\d\d-\d\d/), null, '날짜를 넣지 않는다 — 다시 만들어도 같은 글')
})

test('저장소의 씨앗 파일은 pairs.jsonl·레시피 보드 판정을 지금 다시 만든 것과 같다(낡으면 실패)', () => {
  assert.ok(existsSync(SEED_FILE), 'factory/board/preferences.seed.json 이 있어야 한다 — node factory/board/gen-preferences-seed.mjs')
  assert.equal(readFileSync(SEED_FILE, 'utf8'), seedText(), '씨앗이 낡았다 — node factory/board/gen-preferences-seed.mjs 로 다시 만든다')
  const seed = JSON.parse(readFileSync(SEED_FILE, 'utf8'))
  const nPairs = readFileSync(join(ROOT, 'factory', 'board', 'pairs.jsonl'), 'utf8').trim().split('\n').length
  const wins = Object.values(seed.counts).flatMap((c) => Object.values(c)).reduce((s, v) => s + v.win, 0)
  assert.ok(wins >= nPairs, `승 ${wins} ≥ 짝 ${nPairs}`)
  // 운영자가 반복해 이긴 라이브러리 레시피는 가중치가 오른다
  const p = loadPreferences({ seedFile: SEED_FILE, userFile: join(dir, 'none.json') })
  const best = Object.entries(seed.counts.brand ?? {}).sort((x, y) => (y[1].win - y[1].loss) - (x[1].win - x[1].loss))[0]
  assert.ok(weightOf(p, 'brand', best[0]) > 1, `${best[0]} ${JSON.stringify(best[1])}`)
  for (const c of Object.values(seed.counts)) for (const v of Object.values(c)) assert.ok(Number.isInteger(v.win) && Number.isInteger(v.loss) && v.win >= 0 && v.loss >= 0)
})

// ── chooseVariants: 가중치는 동점의 첫 꼬리표일 뿐 ───────────────────────────────

const ARCHS = ['brand', 'commerce', 'dashboard', 'detail', 'landing', 'local', 'portfolio', 'public', 'pwa', 'saas']
const briefOf = (a) => (a === 'saas' ? SAAS_BRIEF : a === 'local' ? localBrief() : { topic: '시험 주제(예시)', archetype: a, locale: 'ko', facts: { name: '시험 상점' } })

test('가중치를 안 주거나 모두 1 이면 고정 사본(바꾸기 전 chooseVariants)과 한 글자도 다르지 않다 — 원형 10종(씨앗 1~2) × 후보 3', () => {
  const heads = library.slice(0, 3).map((r, i) => ({ id: 'abc'[i], recipe: r.id }))
  let slots = 0
  for (const a of ARCHS) {
    const sm = buildSitemap(archetypes[a], briefOf(a))
    for (const seed of a === "saas" || a === "brand" ? [7, 99] : [7]) {
      const old = chooseVariantsV0(sm, heads, { seed, weights: [] })
      assert.deepEqual(chooseVariants(sm, heads, { seed, weights: [] }), old, `${a} seed ${seed}: 옵션 없음`)
      assert.deepEqual(chooseVariants(sm, heads, { seed, weights: [], preferences: emptyPreferences() }), old, `${a} seed ${seed}: 빈 학습`)
      slots += Object.keys(old.a).length
    }
  }
  assert.ok(slots > 70, `비교한 칸 ${slots}개`)
})

test('가중치는 앞 순서 기준이 같은 변형 사이에서만 고른다: 후보 하나일 때 새 선택은 옛 선택과 같은 앞 순서 기준 값을 가진다', () => {
  const sm = buildSitemap(archetypes.saas, SAAS_BRIEF)
  const cand = [{ id: 'a', recipe: library[0].id }]
  const base = chooseVariantsV0(sm, cand, { seed: 7, weights: [] }, { rankOut: [] })
  const ranks = []
  chooseVariantsV0(sm, cand, { seed: 7, weights: [] }, { rankOut: ranks })
  let changed = 0
  // 모든 변형에 번갈아 높은 가중치를 줘 본다 — 앞 순서 기준(readiness·leaks·내림·덜 쓰인 것·선호·올림)이 더 낫다고 한 변형은 가중치로 뒤집히지 않는다
  for (const r of ranks) {
    const tied = r.sorted.filter((s) => s.prefix.join() === r.sorted[0].prefix.join()).map((s) => s.block)
    if (r.sorted.length < 2) continue
    for (const target of [r.sorted[0], r.sorted[1], r.sorted.at(-1)].map((s) => s.block)) {
      let p = emptyPreferences()
      for (let i = 0; i < 8; i++) p = recordPick(p, { archetype: 'saas', winner: target, loser: 'block-zzz-nothing', kind: 'section' })
      const out = chooseVariants(sm, cand, { seed: 7, weights: [], preferences: p })
      const got = out.a[r.key]
      assert.ok(tied.includes(got), `${r.key}: ${got} 는 앞 순서 기준이 같은 무리(${tied.length}개)에 있어야 한다`)
      if (tied.includes(target)) assert.equal(got, target, `${r.key}: 앞 순서 기준이 같은 무리 안에서는 가중치가 큰 ${target} 를 고른다`)
      if (got !== base.a[r.key]) changed++
    }
  }
  assert.ok(changed > 0, '가중치가 실제로 고름을 바꾼 칸이 하나도 없으면 이 시험은 아무것도 증명하지 않는다')
})

// ── 고정 사본 ────────────────────────────────────────────────────────────────
// factory v1 Task 4.4 가 chooseVariants 에 선택 학습 가중치를 더하기 전의 함수(커밋 8e780e4 의 factory/stamp/variants.mjs) — 4.2 의 pickDirectionsV0 처럼 시험 안에 둔다.
// 이 함수의 논리는 고치지 않는다(기준이 흔들린다). 달라진 것은 셋뿐이다: ① DEMOTED·BOOSTED·밀도 표는 새 모듈에서 가져온다(4.4 가 건드리지 않는 값)
// ② 세 번째 인자 { rankOut } 이 배열이면 칸마다 「정렬된 변형 + 앞 순서 기준 6개」를 쌓는다(관찰용 — 고름에는 영향 없다) ③ 이름이 chooseVariantsV0 이다.
const fnv = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) } return h >>> 0 }
const jitter = (seed, key, block) => mulberry32(fnv(`${seed}|${key}|${block}`))()

function chooseVariantsV0(sitemap, candidates, { seed = 0, weights, readiness, leaks, prefer, hints = { DEMOTED, BOOSTED } } = {}, { rankOut } = {}) {
  const library = loadLibrary()
  const heads = new Map(candidates.map((c) => [c.id, typeof c.recipe === 'string' ? library.find((r) => r.id === c.recipe) : c.recipe]))
  for (const [id, h] of heads) if (!h) throw new Error(`후보 ${id}: 레시피 머리를 찾지 못했다 (${JSON.stringify(candidates.find((c) => c.id === id).recipe)?.slice(0, 60)})`)
  const rows = (weights ?? loadWeights()).filter((w) => w.scope === 'block' && (w.conversions ?? 0) >= MIN_CONVERSIONS && (!w.archetype || w.archetype === sitemap.archetype))
  const lift = (block) => rows.filter((w) => w.key === block).reduce((s, w) => s + (Number(w.lift) || 0), 0)
  const dens = blockDensities()
  const slots = [
    ...sitemap.pages.flatMap((p) => p.sections.map((s) => ({ key: `${p.id}/${s.kind}`, s }))),
    ...(sitemap.globals ?? []).map((g) => ({ key: `global/${g.kind}`, s: g })),
  ].filter(({ s }) => s.status === 'block')

  for (const [key, list] of Object.entries(prefer ?? {})) {
    const slot = slots.find((x) => x.key === key)
    if (!slot) throw new Error(`prefer: 섹션 ${key} 가 사이트맵의 블록 섹션이 아니다`)
    for (const b of list) if (!slot.s.allowedVariants.includes(b)) throw new Error(`prefer: ${key} 에 ${b} 는 허용 변형이 아니다(${slot.s.allowedVariants.join(', ')})`)
  }
  const out = Object.fromEntries(candidates.map((c) => [c.id, {}]))
  for (const { key, s } of slots) {
    const pref = prefer?.[key] ?? []
    const demoted = new Set(hints.DEMOTED?.[sitemap.archetype] ?? [])
    const boosted = new Set(hints.BOOSTED?.[sitemap.archetype] ?? [])
    const prefRank = (b) => (pref.includes(b) ? pref.indexOf(b) : pref.length)
    const used = new Map()
    for (const c of candidates) {
      const head = heads.get(c.id)
      const want = DENSITIES.indexOf(densityOf(head))
      const rank = (b) => [
        (readiness?.get(b) ?? 0) >= 2 ? 1 : 0,
        leaks?.get(`${key}\t${b}`) ?? 0,
        demoted.has(b) && !pref.includes(b) ? 1 : 0,
        used.get(b) ?? 0,
        prefRank(b),
        boosted.has(b) ? 0 : 1,
        -lift(b),
        b === `block-hero-${head.hero}` ? 0 : 1,
        Math.abs(DENSITIES.indexOf(dens.get(b) ?? 'comfortable') - want),
        jitter(seed, key, b),
      ]
      const sorted = [...s.allowedVariants].sort((a, b) => {
        const ra = rank(a), rb = rank(b)
        for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return ra[i] - rb[i]
        return 0
      })
      if (Array.isArray(rankOut)) rankOut.push({ key, cand: c.id, sorted: sorted.map((block) => ({ block, prefix: rank(block).slice(0, 6) })) })
      const best = sorted[0]
      used.set(best, (used.get(best) ?? 0) + 1)
      out[c.id][key] = best
    }
  }
  return out
}
