// v0.2.6 T20 — 포지셔닝 문장 → 방향 고르기 선호. 표 읽기·층별 상한·01 배선·질문 경로·COPY 규칙.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { positioningProfile, positioningMatches, positioningHits, positioningCapped, POS_LIBRARY_W, POS_PRESET_W, POS_PALETTE_W, POS_AXIS_CAP, POSITIONING_TABLE } from './positioning.mjs'
import { pickDirections, libraryPick } from './directions.mjs'
import { listPresets, pickPalettes, loadLibrary } from '../scripts/style-presets.mjs'
import { loadArchetypes } from '../scripts/archetypes.mjs'
import { questionsFor } from '../intake/questions.mjs'
import { toBrief, missingFacts } from '../intake/to-brief.mjs'
import { ARCHETYPE_IDS } from './brief.mjs'

const archs = await loadArchetypes()
const library = loadLibrary()
const probe = (positioning) => ({ topic: '동네 빵집', archetype: 'local', locale: 'ko', facts: { name: '새벽빵', audience: '출근길 직장인', action: '전화 예약', ...(positioning === undefined ? {} : { positioning }), hours: '매일 07:00-20:00' }, previewOnly: true })
const run = (brief, seed = 0) => pickDirections({ brief, archetype: archs[brief.archetype], seed })

test('표: 예시 문장 셋이 태그 하나씩으로 읽히고, 표에 없는 문장은 null 이다', () => {
  assert.deepEqual(positioningProfile('업계 최전선 기술').tags, ['frontier'])
  assert.deepEqual(positioningProfile('믿을 수 있는 동네 전문가').tags, ['trusted-local'])
  assert.deepEqual(positioningProfile('가장 쉬운 선택').tags, ['simplest'])
  assert.deepEqual(positioningProfile('Premium craft').tags, ['premium'])
  assert.deepEqual(positioningProfile('a playful brand').tags, ['playful'])
  assert.equal(positioningProfile('쨍그랑'), null)
  assert.equal(positioningProfile(''), null)
  assert.equal(positioningProfile(undefined), null)
  assert.deepEqual(POSITIONING_TABLE.map((t) => t.tag), ['frontier', 'trusted-local', 'simplest', 'premium', 'playful'])
})

test('표: 태그별 선호는 P1 표 그대로다 · 여러 태그는 합집합 · 테마가 엇갈리면 상관하지 않는다', () => {
  assert.deepEqual(positioningProfile('최전선').prefs, { motion: ['M2', 'M3'], colorLogic: ['K6', 'K7', 'K2'], display: ['D2', 'D3'], theme: 'dark' })
  assert.equal(positioningProfile('동네 전문가').prefs.theme, 'light')
  assert.equal(positioningProfile('premium').prefs.theme, undefined, 'premium 은 밝음·어두움 둘 다 괜찮다')
  const both = positioningProfile('최전선이면서 가장 쉬운')
  assert.deepEqual(both.tags, ['frontier', 'simplest'])
  assert.equal(both.prefs.theme, undefined, '어두움 ↔ 밝음이 엇갈리면 테마는 상관하지 않는다')
  assert.ok(both.prefs.motion.includes('M0') && both.prefs.motion.includes('M3'))
})

test('일치 세기: 축 하나마다 1, 층 상한은 2축, 모르는 선호는 0', () => {
  const frontier = positioningProfile('최전선').prefs
  const head = { motion: 'M3', colorLogic: 'K6', defaultTheme: 'dark', axes: { display: 'D3' } }
  assert.deepEqual(positioningMatches(frontier, head), ['motion', 'colorLogic', 'theme', 'display'])
  assert.equal(positioningHits(frontier, head), 4)
  assert.equal(positioningCapped(frontier, head), POS_AXIS_CAP)
  assert.equal(positioningHits(frontier, { motion: 'M0', colorLogic: 'K1', axes: {} }), 0)
  assert.equal(positioningHits(null, head), 0)
})

test('층별 가중은 원형 적합도 한 단계(0.1)를 뒤집지 못한다', () => {
  assert.ok(POS_AXIS_CAP * POS_LIBRARY_W < 0.1, '라이브러리 상한')
  assert.ok(POS_AXIS_CAP * POS_PRESET_W > 0 && POS_PALETTE_W > 0)
})

test('라이브러리 a 안: 포지셔닝이 맞는 축을 더 가진 쪽으로만 옮긴다(나빠지는 칸 없음, 바뀌는 칸 있음)', () => {
  let changed = 0
  for (const pos of ['업계 최전선 기술', '믿을 수 있는 동네 전문가']) {
    const prefs = positioningProfile(pos).prefs
    for (const a of ARCHETYPE_IDS) for (const seed of [0, 1, 2, 3]) {
      const base = libraryPick({ archetype: a, seed }), withPos = libraryPick({ archetype: a, seed, positioning: pos })
      if (base.id === withPos.id) continue
      changed++
      const hb = positioningCapped(prefs, library.find((r) => r.id === base.id)), hp = positioningCapped(prefs, library.find((r) => r.id === withPos.id))
      assert.ok(hp > hb, `${a}/${seed}: ${base.id}(${hb}) → ${withPos.id}(${hp})`)
    }
  }
  assert.ok(changed >= 3, `바뀐 칸 ${changed}`)
})

test('프리셋 점수: 포지셔닝 가산은 점수만 올리고 원형 적합도 0 은 그대로 뺀다', () => {
  const frontier = positioningProfile('최전선').prefs
  const base = listPresets({ archetype: 'saas' }), withPos = listPresets({ archetype: 'saas', positioning: frontier })
  assert.deepEqual(base.map((p) => p.id).sort(), withPos.map((p) => p.id).sort())
  const gain = (p) => withPos.find((q) => q.id === p.id).score - p.score
  for (const p of base) { const g = gain(p); assert.ok(g >= -1e-9 && g <= POS_AXIS_CAP * POS_PRESET_W + 1e-6, `${p.id} ${g}`) }
  assert.ok(base.some((p) => gain(p) > 0), '맞는 프리셋이 하나는 있다')
})

test('팔레트: 테마 가산은 선호 밝기 팔레트에만 붙지만 밝기 불일치(−1)를 뒤집지 못한다 — 같은 밝기 묶음 안에서는 모두에게 같아 순서가 그대로다', () => {
  const preset = listPresets({ archetype: 'saas' }).find((p) => p.recipeHints?.defaultTheme !== 'dark')
  const base = pickPalettes(preset, { n: 8 })
  const ids = (list) => list.map((p) => p.id)
  assert.deepEqual(ids(pickPalettes(preset, { n: 8, positioning: { theme: 'dark' } })), ids(base))
  assert.deepEqual(ids(pickPalettes(preset, { n: 8, positioning: { theme: 'light' } })), ids(base))
  assert.deepEqual(ids(pickPalettes(preset, { n: 8, positioning: positioningProfile('premium').prefs })), ids(base))
})

test('01: 포지셔닝이 없거나 표에 없으면 방향 3안이 같다(why 의 근거 한 줄만 다르다) · 있으면 모든 안에 근거가 남는다', async () => {
  const strip = (r) => r.candidates.map((c) => { const o = { ...c }; delete o.why; return o })
  const none = await run(probe(undefined)), unknown = await run(probe('쨍그랑'))
  assert.deepEqual(strip(none), strip(unknown))
  assert.ok(unknown.candidates.every((c) => /포지셔닝 '쨍그랑' 은 표에 없어 반영 못 함/.test(c.why)))
  assert.ok(none.candidates.every((c) => !/포지셔닝/.test(c.why)))
  const hit = await run(probe('업계 최전선 기술'))
  assert.ok(hit.candidates.every((c) => /포지셔닝 '업계 최전선 기술'/.test(c.why)))
  assert.ok(hit.candidates.every((c) => c.thesis.includes('업계 최전선 기술')), 'thesis 가 포지셔닝 문장을 목표로 쓴다')
})

test('01: 최전선은 맞는 축을 더 가진 후보를 낸다(모션 M2+·색 논리 K6+ 쪽)', async () => {
  const frontier = positioningProfile('업계 최전선 기술').prefs
  const score = (r) => r.candidates.reduce((s, c) => s + positioningHits(frontier, typeof c.recipe === 'string' ? library.find((x) => x.id === c.recipe) : c.recipe), 0)
  let better = 0
  for (const seed of [0, 1, 2, 3]) {
    const base = await run(probe(undefined), seed), withPos = await run(probe('업계 최전선 기술'), seed)
    assert.ok(score(withPos) >= score(base), `씨앗 ${seed}`)
    if (score(withPos) > score(base)) better++
  }
  assert.ok(better >= 1)
})

test('질문: 공통 9번째 positioning 은 선택이다 — 비어도 missing·previewOnly 가 안 바뀌고, 답하면 facts.positioning 으로 간다', () => {
  for (const a of ARCHETYPE_IDS) {
    const q = questionsFor(a)
    assert.equal(q[8].id, 'positioning', a)
    assert.equal(q[8].optional, true)
    assert.equal(q[8].fact, 'positioning')
  }
  const ans = { name: '새벽빵', audience: '출근길 직장인', action: '전화 예약', contact: '02-0000-0000', logo: 'logo.svg', mood: '따뜻한', hours: '매일 07:00-20:00' }
  const without = toBrief({ topic: '동네 빵집', archetype: 'local', answers: ans })
  assert.ok(!missingFacts(without).includes('positioning'))
  assert.equal(without.facts.positioning, undefined)
  const given = toBrief({ topic: '동네 빵집', archetype: 'local', answers: { ...ans, positioning: '믿을 수 있는 동네 전문가' } })
  assert.equal(given.facts.positioning, '믿을 수 있는 동네 전문가')
  assert.equal(given.previewOnly, without.previewOnly)
})

test('COPY.md: 「positioning은 전략 입력이지 게시 문구가 아니다」 규칙 줄이 있다', () => {
  assert.match(readFileSync(new URL('./COPY.md', import.meta.url), 'utf8'), /positioning은 전략 입력이지 게시 문구가 아니다/)
})
