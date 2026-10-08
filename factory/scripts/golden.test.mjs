// 골든 세트 20(P3-4 Task 4 + P4GD + factory v1 Task 5.5 landing) — 브리프 20개·씨앗·세 출처 섞기·결정성·세트 수준 다양성(생성 머리·팔레트 해시·라이브러리 덮기, 대장 C272)·CLI 인자·원형별 엄격 기준 표. 서버·Chrome·빌드 없음(01 방향은 0.3초, 01~03 배선은 ~9초).
// 골든 20 을 실제로 찍어내는 것(04 문구 에이전트·06 빌드·07 관문)은 이 시험이 아니라 별도 레인이다 — docs/qa/p3-4-golden.md.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadArchetypes } from './archetypes.mjs'
import { ARCHETYPE_IDS, BriefSchema, CONDITION_IDS, briefToSeed, conditionIdsOf } from '../stamp/brief.mjs'
import { SeedRequiredError, libraryPick, matchedConditions, pickDirections } from '../stamp/directions.mjs'
import { loadLibrary } from './style-presets.mjs'
import { GOLDEN_DIR, LIBRARY_PRIORITY, PER_ARCHETYPE, STRICT_BY_ARCHETYPE, checkGolden, checkGoldenSet, expectedSources, findSeed, goldenIds, goldenSet, libraryCoverage, paletteHash, runGolden } from '../stamp/golden.mjs'
import { FACT_KINDS } from '../qa/strict-archetype.mjs'
import { EXIT, PICKS, UsageError, defaultDeps, parseArgs } from '../stamp/stamp.mjs'
import { missingFacts } from '../intake/to-brief.mjs'
import { blockerClass } from '../stamp/blocker-class.mjs'
import { STRUCTURE_FACTS } from '../stamp/content-structure.mjs'
import { goldenRequest } from './lib/stamp-structure-fixtures.mjs'
import { COPY_TOPIC_REWRITTEN, copyFactProblems } from './lib/golden-copy-rule.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const BRIEFS = join(ROOT, 'factory', 'stamp', 'briefs')
const readJ = (f) => JSON.parse(readFileSync(f, 'utf8'))
const archetypes = await loadArchetypes()
const set = goldenSet()
const byId = Object.fromEntries(set.map((e) => [e.id, e]))

test('20개: 원형 10 × 2, 이름 <원형>-<n>, 파일마다 정수 씨앗(1 이상)·스키마 통과', () => {
  assert.equal(PER_ARCHETYPE, 2)
  assert.equal(goldenIds().length, 20)
  assert.deepEqual(set.map((e) => e.id), goldenIds())
  assert.deepEqual([...new Set(set.map((e) => e.archetype))].sort(), [...ARCHETYPE_IDS].sort())
  for (const a of ARCHETYPE_IDS) assert.deepEqual(set.filter((e) => e.archetype === a).map((e) => e.n), [1, 2], a)
  for (const e of set) {
    assert.ok(Number.isInteger(e.seed) && e.seed >= 1, `${e.id} seed ${e.seed}`)
    assert.equal(readJ(e.briefFile).seed, e.seed, '파일에 박힌 씨앗')
  }
})

test('goldenSet: 씨앗이 없거나 원형이 이름과 다른 브리프 파일은 던진다', () => {
  const dir = mkdtempSync(join(tmpdir(), 'golden-'))
  for (const e of set) writeFileSync(join(dir, `${e.id}.json`), JSON.stringify(readJ(e.briefFile)))
  assert.equal(goldenSet({ dir }).length, 20)
  const noSeed = { ...readJ(byId['local-1'].briefFile) }; delete noSeed.seed
  writeFileSync(join(dir, 'local-1.json'), JSON.stringify(noSeed))
  assert.throws(() => goldenSet({ dir }), /local-1 에 정수 seed 가 없다/)
  writeFileSync(join(dir, 'local-1.json'), JSON.stringify({ ...readJ(byId['saas-1'].briefFile) }))
  assert.throws(() => goldenSet({ dir }), /원형이 이름과 다르다/)
  rmSync(join(dir, 'local-1.json'))
  assert.throws(() => goldenSet({ dir }), /골든 브리프가 없다/)
  rmSync(dir, { recursive: true, force: true })
})

test('브리프 내용: 원형 locales 안 · en ≥ 4 · 브랜드 입력 ≥ 3(로고 파일은 실제로 있다) · 원형 필수 사실이 모두 있다(Task 6.2) · 가상 사업체 표시·예시 연락처', () => {
  for (const e of set) assert.ok(archetypes[e.archetype].locales.includes(e.brief.locale), `${e.id}: ${e.brief.locale} 는 ${e.archetype} 가 못 받는다(${archetypes[e.archetype].locales})`)
  assert.ok(set.filter((e) => e.brief.locale === 'en').length >= 4, 'en 브리프')
  assert.ok(set.filter((e) => e.archetype === 'local' || e.archetype === 'public').every((e) => e.brief.locale === 'ko'), 'local·public 은 ko 만')
  const branded = set.filter((e) => e.brief.brand)
  assert.ok(branded.length >= 3, `브랜드 입력 ${branded.length}`)
  const logos = branded.filter((e) => e.brief.brand.logo)
  assert.ok(logos.length >= 2, '로고 파일이 있는 브랜드 입력 2 이상')
  for (const e of logos) {
    assert.ok(isAbsolute(e.brief.brand.logo), 'loadBrief 가 브리프 파일 기준 절대 경로로 푼다')
    assert.ok(existsSync(e.brief.brand.logo), e.brief.brand.logo)
    const svg = readFileSync(e.brief.brand.logo, 'utf8')
    assert.match(svg, /viewBox/); assert.match(svg, /currentColor/, '레시피 색으로 칠할 수 있는 한 색 표지')
  }
  // FV1 Task 6.2: 사실이 빠진 브리프로 빈 칸 경로를 보던 골든(local-2·brand-2 …)도 사실을 채웠다 — 빈 칸 경로는 각 시험이 사실을 뺀 사본으로 본다.
  const missing = set.filter((e) => briefToSeed(e.brief, archetypes[e.archetype]).missing.length > 0)
  assert.deepEqual(missing.map((e) => e.id), [], '원형 필수 사실이 빠진 브리프')
  for (const e of set) {
    assert.match(e.brief.topic, /예시\)$|example\)$/, `${e.id} topic 끝에 가상 사업체 표시`)
    const email = e.brief.facts.email
    if (email) assert.match(email, /@example\.com$/, `${e.id} 이메일은 예약 도메인`)
  }
})

test('P3-3 골든 6개는 복사본이다: 원형·로캘·브랜드가 원본과 같고, 원본 사실은 같은 값이거나 덧붙인 문장·가상 값(Task 6.2)이며, 원본은 그대로 있다', () => {
  const PAIRS = { 'detail-1': 'detail-ko', 'detail-2': 'detail-en-brand', 'local-1': 'local-ko-ltc', 'local-2': 'local-ko-missing-facts', 'saas-1': 'saas-ko', 'saas-2': 'saas-en-sampleco-like' }
  for (const [id, orig] of Object.entries(PAIRS)) {
    const origFile = join(BRIEFS, `${orig}.json`)
    assert.ok(existsSync(origFile), `원본 ${orig} 가 없어졌다(14b 가 아직 쓴다)`)
    const o = readJ(origFile), g = readJ(byId[id].briefFile)
    assert.deepEqual(copyFactProblems(id, g.facts, o.facts), [], `${id}: 원본 사실이 어긋났다`); assert.equal(g.archetype, o.archetype); assert.equal(g.locale, o.locale)
    assert.deepEqual(g.brand, o.brand, id)
    if (COPY_TOPIC_REWRITTEN.includes(id)) assert.doesNotMatch(g.topic, /못 받음/, `${id}: 사실을 채웠으니 topic 이 못 받았다고 말하지 않는다`)
    else assert.ok(g.topic.startsWith(o.topic), `${id} topic 은 원본으로 시작하고 끝에 표시만 더한다`)
    assert.equal(o.seed, undefined, '원본에는 씨앗을 박지 않았다')
    assert.equal(g.conditions, undefined, `${id}: 복사본에는 조건을 붙이지 않는다(원본과 글자까지 같아야 한다)`)
    assert.equal(o.conditions, undefined)
  }
})

test('세 출처 섞기: 20개 모두 방향 3안이 라이브러리 1 + 생성 1 + (브랜드 입력이면 브랜드, 아니면 생성) — 팔레트 겹침 없음 · 같은 씨앗이면 글자까지 같다', async () => {
  let brandCount = 0
  for (const e of set) {
    const r = await checkGolden(e, { archetypes })
    assert.deepEqual(r.problems, [], e.id)
    assert.deepEqual(r.sources, expectedSources(e.brief), e.id)
    assert.equal(r.sources.filter((s) => s === 'library').length, 1, e.id)
    assert.ok(r.sources.includes('generated'), e.id)
    if (e.brief.brand) { brandCount++; assert.equal(r.sources[2], 'brand', `${e.id} 는 브랜드 입력이 있다`) } else assert.equal(r.sources.includes('brand'), false, `${e.id} 는 브랜드 입력이 없는데 브랜드 출처가 나왔다`)
    // 결정성: 같은 브리프·같은 씨앗 → 같은 3안(JSON 글자 단위)
    const a = await pickDirections({ brief: e.brief, archetype: archetypes[e.archetype], seed: e.seed })
    const b = await pickDirections({ brief: e.brief, archetype: archetypes[e.archetype], seed: e.seed })
    assert.equal(JSON.stringify(a), JSON.stringify(b), `${e.id} 두 번 골랐더니 달랐다`)
  }
  assert.ok(brandCount >= 3)
})

// ── 세트 수준(P4GD · 대장 C272) ─────────────────────────────────────────────
// 생성 후보 ②③도 씨앗을 따른다 → 20개 전체에서 (1) 같은 원형 안 생성 머리 되풀이 없음 (2) 생성 팔레트 해시 되풀이 없음 (3) 라이브러리 a 는 원형 적합도 안에서 r4 까지 덮는다.
const setResults = []
for (const e of set) setResults.push(await checkGolden(e, { archetypes }))
const library = loadLibrary()
const ALL_LIBRARY = library.map((r) => r.id).sort() // 라이브러리 전부(레시피 목록에서 읽는다 — 벌 수를 박지 않는다)
const goldenArchetypes = [...new Set(set.map((e) => e.archetype))]

test('세트 수준: 같은 원형 안 생성 머리 되풀이 없음 · 20개 전체 생성 팔레트 해시 되풀이 없음(생성 b·c 합 35 + 브랜드 머리 5)', () => {
  assert.deepEqual(checkGoldenSet(setResults), [])
  const gen = setResults.flatMap((r) => r.generated)
  const brand = setResults.flatMap((r) => r.heads.filter((h) => h.startsWith('brand-')))
  assert.equal(gen.length, 15 * 2 + 5, '브랜드 입력 5개는 c 안이 브랜드 출처라 생성 후보는 15 × 2 + 5')
  assert.equal(brand.length, 5)
  const keys = gen.map((g) => g.palette)
  assert.equal(new Set(keys).size, keys.length, `생성 팔레트 키 ${keys.length}개 중 겹침`)
  const hashes = gen.map((g) => paletteHash(g.palette))
  assert.equal(new Set(hashes).size, hashes.length, '표에 싣는 앞 8자 해시도 겹치지 않는다')
  for (const a of goldenArchetypes) {
    const heads = setResults.filter((r) => r.archetype === a).flatMap((r) => r.heads)
    assert.equal(new Set(heads).size, heads.length, `${a}: 생성계 머리가 되풀이된다 ${heads}`)
  }
  console.log(`# 생성 후보 ${gen.length} · 팔레트 해시 ${new Set(hashes).size}종 · 브랜드 머리 ${brand.length}`)
})

// 서술형 조건 문장(FV1 레인 DRAFTS 확정 — r12~r16 의 archetypeConditions 8문장 중 FV1 C390 이 r15 두 문장을 「식품」으로 읽히게 했다, 남은 6문장): 조건 낱말 id(heritage·food·living·kids)가 하나도 안 읽혀 브리프 조건이 맞을 수 없으니
// 그 원형 적합도는 늘 0.9 에 머문다. 그 원형만 적은 레시피(r12·r13)는 어떤 골든에서도 a 안 묶음에 못 든다 — 의도한 한계로 표에 이름을 둔다(새로 생기면 시험이 알린다).
const UNREADABLE_CONDITIONS = ['r12-spectrum/dashboard', 'r12-spectrum/public', 'r13-folio/portfolio', 'r13-folio/public', 'r14-concrete/saas', 'r16-tonal/brand']
const unreadableConditions = () => library.flatMap((r) => Object.entries(r.archetypeConditions ?? {}).filter(([, t]) => conditionIdsOf(t).length === 0).map(([a]) => `${r.id}/${a}`)).sort()
// 20개 브리프(조건 포함)의 a 안 묶음(fitting) 합집합 = 이 세트가 a 안으로 덮을 수 있는 레시피.
const reachableLibrary = () => [...new Set(set.flatMap((e) => libraryPick({ archetype: e.archetype, seed: 1, conditions: e.brief.conditions, mood: e.brief.facts.mood }).fitting))].sort()

test('세트 수준: 라이브러리 a 덮기 — a 안이 될 수 있는 레시피 전부(r8·r9 는 브리프 조건이 맞는 골든에서) · 못 덮는 것은 조건 낱말이 안 읽히는 원형만 적은 레시피뿐 · a 안은 원형 적합도 안에서만', () => {
  const cov = libraryCoverage(setResults)
  const reachable = reachableLibrary()
  console.log(`# 덮는 라이브러리 ${cov.length}벌 / 라이브러리 ${ALL_LIBRARY.length}벌: ${cov.join(' · ')}`)
  assert.deepEqual(cov, reachable, `a 안이 못 덮은 레시피: ${reachable.filter((r) => !cov.includes(r))}`)
  // 못 덮는 레시피 = 적은 원형이 모두 읽히지 않는 서술형 조건 문장 뒤에 있다(그 원형 적합도 0.9) — 다른 까닭으로 빠진 레시피가 없어야 한다.
  const blocked = new Set(unreadableConditions())
  const unreachable = ALL_LIBRARY.filter((id) => !reachable.includes(id))
  for (const id of unreachable) {
    const rec = library.find((x) => x.id === id)
    assert.ok(rec.archetypes.every((a) => blocked.has(`${id}/${a}`)), `${id}: a 안 묶음에 못 드는데 서술형 조건 탓이 아니다`)
  }
  assert.deepEqual(unreachable, ['r12-spectrum', 'r13-folio'])
  // 모든 a 안은 그 원형을 archetypes 에 적은 레시피이고, 조건 붙은 레시피(r8·r9)는 그 골든의 브리프 조건이 레시피 조건과 맞을 때만 뽑힌다.
  for (const [i, r] of setResults.entries()) {
    const rec = library.find((x) => x.id === r.library)
    assert.ok(rec.archetypes.includes(r.archetype), `${r.id}: ${r.library} 는 ${r.archetype} 원형이 아니다`)
    if (rec.archetypeConditions?.[r.archetype]) assert.ok(matchedConditions(rec, r.archetype, set[i].brief.conditions).length, `${r.id}: 조건이 안 맞는 ${r.library} 를 골랐다`)
  }
  const cond = set.filter((e) => e.brief.conditions)
  assert.deepEqual(cond.map((e) => e.id), ['brand-1', 'brand-2', 'commerce-1'], '조건은 새로 만든 12개 중 사실이 맞는 것에만(brand-2 는 차 회사라 food — r15 의 「식품」 조건)')
  assert.deepEqual(setResults.filter((r) => ['r8-dusk', 'r9-clay'].includes(r.library)).map((r) => r.id), ['brand-1', 'commerce-1'])
  for (const e of set.slice().filter((x) => /^(detail|local|saas)-/.test(x.id))) assert.equal(e.brief.conditions, undefined, `${e.id} 는 P3-3 복사본`)
})

test('브리프 조건: 모르는 id 는 스키마가 거절하고, 레시피 조건 문장 가운데 id 가 안 읽히는 것은 표에 이름이 있는 서술형뿐이다(도달할 수 없는 조건이 조용히 늘지 않는다)', () => {
  const ok = { topic: 't', archetype: 'brand', locale: 'ko', facts: {} }
  assert.equal(BriefSchema.safeParse({ ...ok, conditions: ['heritage'] }).success, true)
  assert.equal(BriefSchema.safeParse({ ...ok, conditions: [] }).success, true)
  const bad = BriefSchema.safeParse({ ...ok, conditions: ['heritage', 'luxury'] })
  assert.equal(bad.success, false)
  assert.match(bad.error.issues[0].message, /heritage·food·living·kids/)
  assert.equal(BriefSchema.safeParse({ ...ok, conditions: 'heritage' }).success, false)
  assert.deepEqual(CONDITION_IDS, ['heritage', 'food', 'living', 'kids'])
  const seen = new Set()
  for (const r of library) for (const text of Object.values(r.archetypeConditions ?? {})) conditionIdsOf(text).forEach((i) => seen.add(i))
  // 낱말이 안 읽히는 서술형 조건은 표(UNREADABLE_CONDITIONS)에 이름이 있는 것뿐이다 — 새로 생기거나 읽히게 된 문장이 있으면 표를 맞춘다(도달할 수 없는 조건이 조용히 늘지 않는다).
  assert.deepEqual(unreadableConditions(), UNREADABLE_CONDITIONS, '조건 낱말이 안 읽히는 문장 목록이 표와 다르다')
  assert.deepEqual([...seen].sort(), ['food', 'heritage', 'kids', 'living'], '레시피 조건 문장이 쓰는 낱말과 CONDITION_IDS 가 같다')
  assert.deepEqual(conditionIdsOf('식품·생활·키즈 몰에만'), ['food', 'living', 'kids'])
  assert.deepEqual(conditionIdsOf(undefined), [])
})

test('씨앗 → 생성 후보: 같은 씨앗은 글자까지 같고, 씨앗이 바뀌면 생성 b·c 의 팔레트가 바뀐다(이전엔 40씨앗 모두 같았다)', async () => {
  const e = byId['saas-1']
  const run = (seed) => pickDirections({ brief: e.brief, archetype: archetypes.saas, seed })
  assert.equal(JSON.stringify(await run(7)), JSON.stringify(await run(7)))
  const pals = { b: new Set(), c: new Set() }
  for (let seed = 1; seed <= 12; seed++) { const { candidates } = await run(seed); pals.b.add(candidates[1].palette); pals.c.add(candidates[2].palette) }
  assert.ok(pals.b.size >= 6 && pals.c.size >= 6, `씨앗 12개에서 b 팔레트 ${pals.b.size}종 · c 팔레트 ${pals.c.size}종 — 씨앗이 생성 후보를 못 바꾼다`)
})

test('libraryPick 은 pickDirections 의 a 안과 같다(씨앗 1~4 × 4원형, 조건 있는 브리프 포함) · fitting 은 원형 적합도 1 묶음(브리프 조건이 맞으면 조건부 레시피 포함)', async () => {
  for (const a of ['saas', 'dashboard', 'portfolio', 'public']) for (let seed = 1; seed <= 4; seed++) {
    const lp = libraryPick({ archetype: a, seed, mood: byId[`${a}-1`].brief.facts.mood }) // FIT-3: 분위기도 a 안 고름에 든다
    const picked = await pickDirections({ brief: byId[`${a}-1`].brief, archetype: archetypes[a], seed })
    assert.equal(picked.candidates[0].recipe, lp.id, `${a}/${seed}`)
    assert.ok(lp.fitting.includes(lp.id))
  }
  for (const id of ['brand-1', 'commerce-1']) for (let seed = 1; seed <= 6; seed++) {
    const e = byId[id]
    const lp = libraryPick({ archetype: e.archetype, seed, conditions: e.brief.conditions, mood: e.brief.facts.mood })
    const picked = await pickDirections({ brief: e.brief, archetype: archetypes[e.archetype], seed })
    assert.equal(picked.candidates[0].recipe, lp.id, `${id}/${seed}`)
  }
  assert.deepEqual(libraryPick({ archetype: 'saas', seed: 1 }).fitting, ['r1-measure', 'r4-evidence', 'r7-docs'])
  assert.deepEqual(libraryPick({ archetype: 'local', seed: 1 }).fitting, ['r3-woodblock'], '조건 없는 local 은 r8-dusk 가 a 안 묶음에 없다')
  assert.deepEqual(libraryPick({ archetype: 'brand', seed: 1, conditions: ['heritage'] }).fitting, ['r2-signal', 'r8-dusk'])
  assert.deepEqual(libraryPick({ archetype: 'commerce', seed: 1, conditions: ['food'] }).fitting, ['r15-atelier', 'r3-woodblock', 'r9-clay'], 'r15 commerce 는 고급 식품·식음에 맞는다(FV1 C390)')
  assert.deepEqual(libraryPick({ archetype: 'commerce', seed: 1, conditions: ['kids'] }).fitting, ['r3-woodblock', 'r9-clay'], 'r9 는 식품·생활·키즈 어느 쪽이든 맞는다')
  assert.deepEqual(libraryPick({ archetype: 'brand', seed: 1, conditions: ['food'] }).fitting, ['r15-atelier', 'r2-signal'], '식품이면 r15 가 든다 · 조건이 안 맞으면 0.9 그대로(r8 은 헤리티지에만)')
  assert.deepEqual(libraryPick({ archetype: 'brand', seed: 1, conditions: ['kids'] }).fitting, ['r2-signal'], 'r15·r8 모두 kids 와 안 맞는다')
  assert.deepEqual(libraryPick({ archetype: 'commerce', seed: 1, conditions: ['heritage'] }).fitting, ['r3-woodblock'])
  assert.deepEqual(libraryPick({ archetype: 'pwa', seed: 1, conditions: ['heritage'] }).fitting, ['r7-docs'])
})

test('음성 대조: 조건 칸을 지우면 r8·r9 가 다시 안 뽑힌다(같은 씨앗·씨앗 1~60 어디서도) — 조건이 있을 때는 뽑힌다', async () => {
  for (const [id, recipe, cond] of [['brand-1', 'r8-dusk', ['heritage']], ['commerce-1', 'r9-clay', ['food']]]) {
    const e = byId[id]
    const stripped = { ...e.brief }
    delete stripped.conditions
    assert.equal(libraryPick({ archetype: e.archetype, seed: e.seed, conditions: e.brief.conditions, mood: e.brief.facts.mood }).id, recipe, `${id}: 조건이 있으면 박힌 씨앗에서 ${recipe}`)
    const noCond = await checkGolden({ ...e, brief: stripped }, { archetypes })
    assert.notEqual(noCond.library, recipe, `${id}: 조건을 지웠는데도 ${recipe} 가 뽑혔다`)
    assert.deepEqual(noCond.problems, [])
    let withHits = 0
    for (let seed = 1; seed <= 60; seed++) {
      assert.notEqual(libraryPick({ archetype: e.archetype, seed, mood: e.brief.facts.mood }).id, recipe, `${id}/${seed}: 조건 없이 ${recipe} 가 뽑혔다`)
      if (libraryPick({ archetype: e.archetype, seed, conditions: cond, mood: e.brief.facts.mood }).id === recipe) withHits++
    }
    assert.ok(withHits >= 10, `${id}: 조건이 있어도 씨앗 60개 중 ${recipe} 가 ${withHits}번뿐 — 양성 대조가 약하다`)
  }
  // 세트 전체: 세 브리프(brand-1·brand-2·commerce-1)의 조건을 지우고 박힌 씨앗 그대로 점검하면 a 안 커버리지에서 r8·r9·r15 세 벌이 빠진다.
  const strippedResults = []
  for (const [i, e] of set.entries()) {
    if (!e.brief.conditions) { strippedResults.push(setResults[i]); continue }
    const b = { ...e.brief }; delete b.conditions
    strippedResults.push(await checkGolden({ ...e, brief: b }, { archetypes }))
  }
  const cov = libraryCoverage(strippedResults)
  assert.equal(cov.length, libraryCoverage(setResults).length - 3)
  assert.ok(!cov.includes('r8-dusk') && !cov.includes('r9-clay') && !cov.includes('r15-atelier'), cov.join())
})

test('음성 대조: 두 브리프를 같은 씨앗으로 돌리면 세트 점검이 실패한다(같은 원형 생성 머리·팔레트 되풀이) — 점검이 아무 때나 통과하지 않는다', async () => {
  const s1 = setResults.find((r) => r.id === 'saas-1')
  // FIT-3: 분위기도 방향을 바꾸므로 같은 머리를 되풀이시키려면 분위기도 같아야 한다.
  const forced = await checkGolden({ ...byId['saas-2'], brief: { ...byId['saas-2'].brief, facts: { ...byId['saas-2'].brief.facts, mood: byId['saas-1'].brief.facts.mood } }, seed: byId['saas-1'].seed }, { archetypes })
  assert.deepEqual(forced.heads, s1.heads, '같은 원형·같은 씨앗·같은 분위기면 생성 머리가 같다(브랜드 입력 없음)')
  const swapped = setResults.map((r) => (r.id === 'saas-2' ? forced : r))
  const problems = checkGoldenSet(swapped)
  assert.ok(problems.some((p) => /같은 원형\(saas\) 안 생성 머리 되풀이/.test(p)), problems.join(' | '))
  assert.ok(problems.some((p) => /생성 팔레트 해시 되풀이/.test(p)), problems.join(' | '))
  // 원형이 다른 두 브리프가 같은 생성 팔레트를 쓰면 세트 전체 점검이 잡는다(머리는 달라도).
  const other = setResults.find((r) => r.id === 'pwa-1')
  const clash = setResults.map((r) => (r.id === 'pwa-1' ? { ...other, generated: [{ ...other.generated[0], palette: s1.generated[0].palette }, ...other.generated.slice(1)] } : r))
  assert.ok(checkGoldenSet(clash).some((p) => /생성 팔레트 해시 되풀이/.test(p) && !/같은 원형/.test(p)))
  // 씨앗이 생성 후보와 무관하던 옛 동작(양성 대조): 20개 모두 씨앗을 1로 돌리면 세트 점검이 실패한다.
  const allSeed1 = []
  for (const e of set) allSeed1.push(await checkGolden({ ...e, seed: 1 }, { archetypes }))
  assert.ok(checkGoldenSet(allSeed1).length > 10, `씨앗 1 한 가지로는 겹침이 많아야 한다: ${checkGoldenSet(allSeed1).length}`)
})

test('씨앗은 세트 조건을 채우는 가장 작은 씨앗이다(findSeed): 박힌 씨앗이 앞 골든들의 상태에서 그대로 나온다 · 큰 씨앗 셋은 1부터 훑어 최소임을 본다', { timeout: 280_000 }, async () => {
  const covered = [], takenPalettes = [], takenLibraryBy = {}, takenHeadsBy = {}
  const fullScan = new Set(set.slice().sort((x, y) => y.seed - x.seed).slice(0, 3).map((x) => x.id)) // 가장 큰 씨앗 셋은 1부터 훑어 최소임을 본다
  const fits = set.map((x) => libraryPick({ archetype: x.archetype, seed: 1, conditions: x.brief.conditions, mood: x.brief.facts.mood }).fitting)
  for (const [i, e] of set.entries()) {
    const mustLibrary = fits[i].filter((r) => !covered.includes(r) && fits.slice(i + 1).every((f) => !f.includes(r)))
    const state = { archetypes, coveredLibrary: covered, preferLibrary: LIBRARY_PRIORITY, mustLibrary, takenPalettes, takenLibrary: takenLibraryBy[e.archetype] ?? [], takenHeads: takenHeadsBy[e.archetype] ?? [] }
    const r = await findSeed(e.brief, fullScan.has(e.id) ? state : { ...state, from: e.seed, to: e.seed })
    assert.equal(r.seed, e.seed, `${e.id}: 박힌 씨앗 ${e.seed} ≠ findSeed ${r.seed}`)
    assert.equal(r.library, setResults[i].library, e.id)
    covered.push(r.library); (takenLibraryBy[e.archetype] ??= []).push(r.library)
    takenPalettes.push(...r.result.generated.map((g) => g.palette)); (takenHeadsBy[e.archetype] ??= []).push(...r.result.heads)
  }
  assert.ok(LIBRARY_PRIORITY.includes(setResults.find((r) => r.id === 'dashboard-1').library), 'dashboard-1 은 우선 레시피(r4)')
  assert.equal(setResults.find((r) => r.id === 'dashboard-2').library, 'r10-console', 'r10 은 dashboard 두 브리프에만 맞아 dashboard-2 가 마지막 기회다')
  // 같은 원형 두 브리프는 원형에 맞는 레시피가 둘 이상이면 서로 다른 레시피다(이전 시험과 같은 약속).
  for (const a of ['dashboard', 'saas']) assert.notEqual(setResults.find((r) => r.id === `${a}-1`).library, setResults.find((r) => r.id === `${a}-2`).library, a)
})

test('나머지 원형(local·detail·brand·commerce·pwa)은 조건 없는 브리프로는 원형에 맞는 라이브러리 레시피가 하나뿐이라 씨앗이 a 안을 못 바꾼다 — 씨앗 8개 표본', async () => {
  for (const a of ['local', 'detail', 'brand', 'commerce', 'pwa']) {
    const seen = new Set()
    const plain = set.find((e) => e.archetype === a && !e.brief.conditions) ?? set.find((e) => e.archetype === a && e.id.endsWith('-2')) // brand 는 두 브리프 모두 조건이 있어 -2 에서 조건을 지운다
    const brief = { ...plain.brief }; delete brief.conditions
    for (let seed = 1; seed <= 8; seed++) seen.add((await pickDirections({ brief, archetype: archetypes[a], seed })).candidates[0].recipe)
    assert.equal(seen.size, 1, `${a}: 라이브러리 레시피가 씨앗에 따라 ${[...seen]}`)
  }
})

test('문서 표(docs/qa/p3-4-golden.md)가 실제 결과와 같다: 20행마다 씨앗·a 라이브러리·생성 머리·팔레트 해시가 그대로 적혀 있다', () => {
  const md = readFileSync(join(ROOT, 'docs', 'qa', 'p3-4-golden.md'), 'utf8')
  for (const [i, e] of set.entries()) {
    const row = md.split('\n').find((l) => l.startsWith(`| ${e.id} `))
    assert.ok(row, `${e.id} 행이 문서에 없다`)
    const cells = row.split('|').map((c) => c.trim())
    assert.ok(cells.includes(String(e.seed)), `${e.id} 씨앗 ${e.seed} 가 행에 없다: ${row}`)
    assert.ok(cells.includes(setResults[i].library), `${e.id} a 라이브러리 ${setResults[i].library}`)
    for (const g of setResults[i].generated) assert.ok(row.includes(paletteHash(g.palette)), `${e.id} 팔레트 해시 ${paletteHash(g.palette)}`)
  }
})

test('결정성 음성 대조: 씨앗을 바꾸면 라이브러리 고름이 바뀐다(dashboard-1: 씨앗 1~8 에 서로 다른 a 안이 있다) — 결정성 시험이 아무 때나 통과하지 않는다', async () => {
  const e = byId['dashboard-1']
  const picks = new Map()
  for (let seed = 1; seed <= 8; seed++) picks.set(seed, (await pickDirections({ brief: e.brief, archetype: archetypes.dashboard, seed })).candidates[0].recipe)
  assert.ok(new Set(picks.values()).size >= 2, `씨앗 1~8 이 모두 같은 a 안이다: ${[...picks.values()]}`)
})

test('씨앗 강제(directions.mjs): 인자도 브리프 씨앗도 없으면 SeedRequiredError, 정수가 아니어도 마찬가지 · 브리프 씨앗만 있어도 된다', async () => {
  const brief = byId['saas-1'].brief
  const { seed: _drop, ...noSeed } = brief
  await assert.rejects(() => pickDirections({ brief: noSeed, archetype: archetypes.saas }), (e) => e instanceof SeedRequiredError && /기본값 없음/.test(e.message))
  await assert.rejects(() => pickDirections({ brief: noSeed, archetype: archetypes.saas, seed: '7' }), SeedRequiredError)
  await assert.rejects(() => pickDirections({ brief: noSeed, archetype: archetypes.saas, seed: 1.5 }), SeedRequiredError)
  const viaBrief = await pickDirections({ brief, archetype: archetypes.saas })
  const viaArg = await pickDirections({ brief: noSeed, archetype: archetypes.saas, seed: brief.seed })
  assert.equal(JSON.stringify(viaBrief), JSON.stringify(viaArg))
  assert.ok((await pickDirections({ brief: noSeed, archetype: archetypes.saas, seed: 0 })).candidates.length === 3, '0 도 정수다(명시적으로 주면 된다)')
})

test('CLI 인자: --golden <id> · --all-golden 은 --brief 와 함께 못 쓰고, --all-golden 은 --pick 과도 못 쓴다', () => {
  assert.deepEqual(parseArgs(['--golden', 'saas-2', '--until', '3']), { brief: null, run: null, until: '03-variants', pick: null, deployPreview: false, golden: 'saas-2', allGolden: false })
  assert.equal(parseArgs(['--all-golden']).allGolden, true)
  assert.equal(parseArgs(['--golden', 'local-1', '--pick', 'a']).pick, 'a')
  for (const bad of [['--golden'], ['--golden', 'x', '--brief', 'b.json'], ['--all-golden', '--brief', 'b.json'], ['--all-golden', '--golden', 'saas-1'], ['--all-golden', '--pick', 'a'], ['--golden', 'saas-1', '--deploy-preview']]) {
    assert.throws(() => parseArgs(bad), UsageError, bad.join(' '))
  }
})

test('runGolden: 없는 id 는 던지고, 진짜 배선(01~03)은 씨앗이 박힌 브리프로 방향 3안을 만들며 다시 돌려도 글자가 같다 · 씨앗이 다르면 a 안이 다르다', { timeout: 170_000 }, async () => {
  await assert.rejects(() => runGolden('saas-9'), /골든 "saas-9" 이 없다/)
  const real = await defaultDeps({ say: () => {} })
  const deps = { ...real, doctor: async () => ({ ok: true, results: [] }) }
  const dir = mkdtempSync(join(tmpdir(), 'golden-run-'))
  try {
    const one = await runGolden('saas-2', { until: '03', runDir: join(dir, 'one'), deps })
    assert.equal(one.code, EXIT.done, JSON.stringify(one.summary.failures))
    assert.deepEqual(one.candidates.map((c) => c.source), ['library', 'generated', 'generated'])
    assert.equal(readJ(join(one.runDir, 'directions.json')).seed, byId['saas-2'].seed)
    const two = await runGolden('saas-2', { until: '03', runDir: join(dir, 'two'), deps })
    for (const c of PICKS) for (const s of ['01-direction', '02-sitemap', '03-variants']) {
      assert.equal(JSON.stringify(readJ(join(one.runDir, c, `${s}.json`)).data), JSON.stringify(readJ(join(two.runDir, c, `${s}.json`)).data), `${c}/${s} 이 두 실행에서 다르다`)
    }
    // 같은 브리프에서 씨앗만 바꾼 임시 브리프 → 라이브러리(a) 안이 바뀐다(음성 대조)
    const goldenDir = join(dir, 'golden-seed1')
    mkdirSync(goldenDir, { recursive: true })
    for (const e of set) writeFileSync(join(goldenDir, `${e.id}.json`), JSON.stringify(e.id === 'saas-2' ? { ...readJ(e.briefFile), seed: 1 } : readJ(e.briefFile)))
    const other = await runGolden('saas-2', { until: '01', runDir: join(dir, 'three'), deps, goldenDir })
    assert.notEqual(readJ(join(other.runDir, 'a', '01-direction.json')).data.recipe, readJ(join(one.runDir, 'a', '01-direction.json')).data.recipe)
    assert.ok(one.times.length >= 9 && one.times.every((t) => typeof t.seconds === 'number'), '단계 시간이 쌓인다')
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('STRICT_BY_ARCHETYPE: golden.mjs 가 그대로 내보낸다 · 골든 20 의 원형이 모두 기준을 갖고, 기준의 사실 종류는 FACT_KINDS 안이다', () => {
  assert.deepEqual(Object.keys(STRICT_BY_ARCHETYPE).sort(), [...ARCHETYPE_IDS].sort())
  for (const e of set) {
    assert.ok(STRICT_BY_ARCHETYPE[e.archetype]?.length >= 1, e.archetype)
    for (const r of STRICT_BY_ARCHETYPE[e.archetype]) for (const n of r.needs) assert.ok(n.kind in FACT_KINDS)
  }
})

// ── 사실 채움(factory v1 Task 6.2) ─────────────────────────────────────────────
// 골든 20 의 브리프는 04·06·법정 초안이 읽는 사실을 가상 값으로 채운다. 남는 빈 칸은 대표 입력 대기뿐이다 — 실제 사진·로고 파일, 사이트 주소, 실제 연락처, 법률 검토.
const RESERVED_HOST = /(^|\.)(example\.(com|org|net)|[a-z0-9-]+\.(test|invalid|localhost))$/i
const EXAMPLE_PHONE = /(?:1234567|12345678|00000000)$/ // 번호 끝이 1234567 류·0000 류 — 실제 국번 형식(02-312-4567)과 구별한다
const PHONE_LIKE = /\+?\d{2,4}[- ]\d{1,4}[- ]\d{3,4}(?:[- ]\d{4})?/g
const hostsOf = (text) => [
  ...[...String(text).matchAll(/https?:\/\/([^\s/;|,)]+)/gi)].map((m) => m[1]),
  ...[...String(text).matchAll(/[A-Za-z0-9._+-]+@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g)].map((m) => m[1]),
]
const isExamplePhone = (p) => EXAMPLE_PHONE.test(p.replace(/[\s-]/g, ''))
/** 브리프 한 개의 사실 안에서 실존 표지(실제 도메인·실제 국번 형식 전화)를 찾는다. */
function realMarkers(brief) {
  const bad = []
  for (const [k, v] of Object.entries(brief.facts)) {
    for (const h of hostsOf(v)) if (!RESERVED_HOST.test(h)) bad.push(`${k}: 실제 도메인 ${h}`)
    if (/^(phone|mainPhone)$/.test(k)) { if (!isExamplePhone(v)) bad.push(`${k}: 실제 국번 형식 ${v}`) }
    else for (const p of String(v).match(PHONE_LIKE) ?? []) if (/\d{3,4}[- ]\d{4}$/.test(p) && !isExamplePhone(p)) bad.push(`${k}: 실제 국번 형식 ${p}`)
  }
  return bad
}

// 04 요청에서 사실이 없어 남는 이름 — 사이트 주소(대표 입력 대기)뿐이어야 한다.
// organization.url·agency.accessibilityPolicyUrl = 이 사이트 주소(배포 뒤에야 안다), business.termsUrl·privacyUrl = 06 이 이 사이트의 /terms·/privacy 로 잇는 자리(ownPolicyLinks), business.ftcLookupUrl = 진짜 사업자등록번호로 만드는 공정위 조회 주소.
const SITE_ADDRESS_FACTS = new Set(['organization.url', 'agency.accessibilityPolicyUrl', 'business.termsUrl', 'business.privacyUrl', 'business.ftcLookupUrl'])

test('사실 채움: 20개 모두 입구가 물은 사실이 채워져 남는 빈 칸은 로고 파일뿐이다(missingFacts) — 그 로고는 대표 입력 대기', () => {
  for (const e of set) {
    const left = missingFacts(e.brief)
    assert.deepEqual(left.filter((m) => m !== 'logo'), [], `${e.id}: 입구가 물었는데 비어 있는 사실 ${left}`)
    assert.equal(e.brief.previewOnly, undefined, `${e.id}: previewOnly 표지는 입구가 빈 답을 만들 때만 단다`)
    assert.deepEqual(briefToSeed(e.brief, archetypes[e.archetype]).missing, [], `${e.id}: 원형 필수 사실`)
  }
  // 로고가 남는 것이 대표 입력 대기 갈래다: 로고 파일은 사진과 같은 「실제 파일 필요」 사유로 막힌다.
  assert.equal(blockerClass('공개 불가 — 실제 사진 필요: logo'), 'input')
})

test('사실 채움: 04 요청의 missing 은 사이트 주소(대표 입력 대기)뿐이고, 사실이 없어 비는 구조 칸은 0이다', () => {
  for (const e of set) {
    const { request } = goldenRequest(e.id)
    const rest = request.missing.filter((m) => !SITE_ADDRESS_FACTS.has(m))
    assert.deepEqual(rest, [], `${e.id}: 사실 없음으로 남은 칸 ${rest}`)
    for (const m of request.missing) assert.equal(blockerClass(`공개 불가 — 확인 필요 사실: ${m}`), 'input', m)
    const emptyStructure = (request.structureSlots ?? []).filter((s) => s.empty).map((s) => s.path)
    assert.deepEqual(emptyStructure, [], `${e.id}: 구조 칸이 사실 없이 비었다`)
  }
})

test('사실 채움: 원형 STRUCTURE_FACTS 의 구조 뿌리(brand 5 · public 2 · portfolio 2 · saas 1)는 해당 원형 골든 둘 모두 브리프에 사실이 있다', () => {
  const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9가-힣]/g, '')
  for (const e of set) {
    if (e.archetype === 'local') continue // 진료과·의료진은 의료 변형(병원·의원)의 사실이다 — 골든 local 은 의료가 아니다
    for (const [root, names] of Object.entries(STRUCTURE_FACTS[e.archetype] ?? {})) {
      const have = Object.keys(e.brief.facts).some((k) => names.some((n) => norm(n) === norm(k)))
      assert.ok(have, `${e.id}: 구조 뿌리 ${root} 의 사실(${names}) 이 브리프에 없다`)
    }
  }
})

test('사실 채움: 가상 사업체 표시 — 모든 topic 이 「예시」 로 끝나고, 못 받았다는 옛 문구가 남지 않으며, 실존 표지(실제 도메인·실제 국번 형식)가 없다', () => {
  for (const e of set) {
    assert.match(e.brief.topic, /예시\)$|example\)$/, e.id)
    assert.doesNotMatch(e.brief.topic, /못 받음|not provided/i, `${e.id}: 사실을 채웠는데 topic 이 아직 못 받았다고 말한다`)
    assert.deepEqual(realMarkers(e.brief), [], e.id)
  }
})

test('음성 대조: 실존 표지 검사는 실제 도메인·실제 국번 형식을 잡고, 예시 값은 통과시킨다', () => {
  const make = (facts) => ({ facts })
  assert.deepEqual(realMarkers(make({ email: 'hello@example.com', phone: '02-1234-5678', x: 'https://a.example.com/p' })), [])
  assert.deepEqual(realMarkers(make({ phone: '+82-2-1234-5678' })), [])
  assert.deepEqual(realMarkers(make({ phone: '+82 10-0000-0000' })), [])
  assert.deepEqual(realMarkers(make({ phone: '063-123-4567' })), [])
  assert.equal(realMarkers(make({ email: 'owner@gmail.com' })).length, 1, '실제 메일 도메인')
  assert.equal(realMarkers(make({ naverMapUrl: 'https://map.naver.com/p/entry/place/1' })).length, 1, '실제 지도 도메인')
  assert.equal(realMarkers(make({ phone: '02-312-4567' })).length, 1, '실제 국번 형식 전화')
  assert.equal(realMarkers(make({ phone: '010-2345-6789' })).length, 1)
  assert.equal(realMarkers(make({ transitNote: '대표 문의 02-312-4567' })).length, 1, '다른 사실 글 속 전화')
  assert.deepEqual(realMarkers(make({ price: '13,000원부터', bizNo: '123-45-67890', date: '2026-09-20 | 이용 안내' })), [], '금액·사업자번호·날짜는 전화가 아니다')
})
