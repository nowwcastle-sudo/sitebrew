// FIT-3 — 인테이크 답이 방향 모양에 닿는다: 분위기 낱말(F1) · 브랜드 색(F2).
//   F1: facts.mood 가 01 방향 고르기의 가중 요소다(라이브러리 a 고름 · 생성 프리셋 점수 · 팔레트 점수). 표에 없는 낱말은 효과 없음 + why 에 이유.
//   회귀 가드: mood 가 없는 브리프의 01 출력은 FIT-3 전(abbe3be0)과 바이트 동일 — stamp-mood-baseline.json.
//   F2: 인테이크 답(색 코드 3개)이 질문 경로 끝까지 가서 c 안이 source:brand 가 된다.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { pickDirections, axisDistance, paletteKey } from '../stamp/directions.mjs'
import { goldenSet } from '../stamp/golden.mjs'
import { toBrief } from '../intake/to-brief.mjs'
import { loadArchetypes } from './archetypes.mjs'
import { loadLibrary } from './style-presets.mjs'

const archs = await loadArchetypes()
const library = loadLibrary()
// 브리프 로고는 저장소 기준 절대 경로로 풀려 01 출력에 실린다 — 저장소 뿌리를 <repo> 로 바꿔 재야 clone 자리·CI 와 무관한 기준이 된다
const REPO = fileURLToPath(new URL('../../', import.meta.url)).replace(/[\\/]$/, '')
// 뿌리 다음의 경로 구분자도 OS 마다 다르다(Windows `\` · Linux `/`) — JSON 안의 역슬래시를 / 로 맞춘다
const portable = (o) => [REPO, REPO.replaceAll('\\', '/')].reduce((s, r) => s.split(JSON.stringify(r).slice(1, -1)).join('<repo>'), JSON.stringify(o)).replaceAll('\\\\', '/')
const hash = (o) => createHash('sha256').update(portable(o)).digest('hex').slice(0, 12)
const probe = (mood) => ({ topic: '동네 빵집', archetype: 'local', locale: 'ko', facts: { name: '새벽빵', audience: '출근길 직장인', action: '전화 예약', ...(mood === undefined ? {} : { mood }), hours: '매일 07:00-20:00' }, previewOnly: true })
const run = (brief, seed = 0) => pickDirections({ brief, archetype: archs[brief.archetype], seed })
const noWhy = (r) => r.candidates.map((c) => { const o = { ...c }; delete o.why; return o })
const headOf = (c) => (typeof c.recipe === 'string' ? library.find((r) => r.id === c.recipe) : c.recipe)
const slotKey = (c) => `${typeof c.recipe === 'string' ? c.recipe : c.recipe.id}|${c.palette ?? ''}|${c.fonts.display}|${c.fonts.body}`

test('mood 표: 한국어·영어 동의어가 같은 항목으로 읽히고, 표에 없는 낱말은 null 이다', async () => {
  const { moodProfile } = await import('../stamp/mood.mjs')
  const warm = moodProfile('따뜻한')
  assert.ok(warm && warm.key && warm.tokens.length && warm.recipeTokens.length, '따뜻한')
  for (const w of ['포근한', '아늑한', 'warm', 'Warm!', ' 따뜻한 ']) assert.equal(moodProfile(w)?.key, warm.key, w)
  const bold = moodProfile('대담한')
  assert.ok(bold && bold.key !== warm.key)
  for (const w of ['과감한', '강렬한', 'bold']) assert.equal(moodProfile(w)?.key, bold.key, w)
  assert.equal(moodProfile('쨍그랑'), null)
  assert.equal(moodProfile(''), null)
  assert.equal(moodProfile(undefined), null)
})

test('회귀 가드: mood 가 없는 골든 20개의 01 출력은 FIT-3 전(abbe3be0)과 바이트 동일하다', { timeout: 120_000 }, async () => {
  const base = JSON.parse(readFileSync(new URL('./stamp-mood-baseline.json', import.meta.url), 'utf8')).cases
  const set = goldenSet()
  assert.equal(Object.keys(base).length, set.length, '기준 파일이 골든 수와 같다')
  for (const e of set) {
    const b = structuredClone(e.brief)
    delete b.facts.mood
    // 씨앗은 기준을 찍을 때의 값(파일에 고정) — 골든 씨앗을 다시 골라도 기준은 그대로다.
    assert.equal(hash(await pickDirections({ brief: b, archetype: archs[e.archetype], seed: base[e.id].seed })), base[e.id].hash, `${e.id}: mood 없는 01 출력이 기준과 다르다`)
  }
})

test('F1 양성 대조: 같은 브리프에서 분위기만 따뜻한 ↔ 대담한으로 바꾸면 적어도 한 칸의 방향이 바뀐다(씨앗 0·1·2)', { timeout: 120_000 }, async () => {
  for (const seed of [0, 1, 2]) {
    const w = await run(probe('따뜻한'), seed), b = await run(probe('대담한'), seed)
    const diff = w.candidates.map((c, i) => slotKey(c) !== slotKey(b.candidates[i])).filter(Boolean).length
    assert.ok(diff >= 1, `씨앗 ${seed}: 따뜻한 ↔ 대담한이 같은 방향 3안을 낸다`)
    assert.notEqual(hash(w), hash(b), `씨앗 ${seed}`)
  }
})

test('결정성: 같은 분위기 두 번은 글자까지 같다', async () => {
  assert.equal(hash(await run(probe('따뜻한'), 3)), hash(await run(probe('따뜻한'), 3)))
  assert.equal(hash(await run(probe('대담한'), 3)), hash(await run(probe('대담한'), 3)))
})

test('동의어: 영어 warm·포근한은 따뜻한과 같은 방향을 낸다(근거 글만 낱말대로 다르다)', async () => {
  const k = noWhy(await run(probe('따뜻한'), 1))
  assert.deepEqual(noWhy(await run(probe('warm'), 1)), k)
  assert.deepEqual(noWhy(await run(probe('포근한'), 1)), k)
})

test('why: 표에 있는 낱말은 모든 안에 「분위기 \'…\' 반영」 근거 한 줄, 표에 없는 낱말은 방향을 바꾸지 않고 「표에 없어 반영 못 함」을 남긴다', async () => {
  const w = await run(probe('따뜻한'), 0)
  for (const c of w.candidates) assert.match(c.why, /분위기 '따뜻한'/, `${c.id}: ${c.why}`)
  assert.ok(w.candidates.some((c) => /분위기 '따뜻한' 반영/.test(c.why)), '적어도 한 안은 실제로 반영했다')
  const none = await run(probe(), 0)
  const odd = await run(probe('쨍그랑'), 0)
  assert.deepEqual(noWhy(odd), noWhy(none), '표에 없는 낱말은 효과가 없다')
  for (const c of odd.candidates) assert.match(c.why, /분위기 '쨍그랑' 은 표에 없어 반영 못 함/, c.id)
  for (const c of none.candidates) assert.doesNotMatch(c.why, /분위기/, 'mood 가 없으면 why 도 그대로다')
})

test('제약 유지: 분위기가 있어도 출처 구성(라이브러리·생성·생성)·팔레트 겹침 없음·축 차이 2 이상·C10 예외 없음', async () => {
  for (const mood of ['따뜻한', '대담한', 'calm', '단정한', '고급스러운']) for (const seed of [0, 5]) {
    const r = await run(probe(mood), seed)
    assert.deepEqual(r.candidates.map((c) => c.source), ['library', 'generated', 'generated'], `${mood}/${seed}`)
    const keys = r.candidates.map((c) => paletteKey(c.palette)).filter(Boolean)
    assert.equal(new Set(keys).size, keys.length, `${mood}/${seed}: 팔레트 겹침`)
    const heads = r.candidates.map(headOf)
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) assert.ok(axisDistance(heads[i], heads[j]) >= 2, `${mood}/${seed}: ${i}~${j}`)
    for (const c of r.candidates) assert.doesNotMatch(c.why, /C10 예외/, `${mood}/${seed}`)
    assert.ok(library.find((x) => x.id === r.candidates[0].recipe).archetypes.includes('local'), `${mood}/${seed}: a 안은 local 에 맞는 레시피`)
  }
})

test('F2 질문 경로 끝까지: 인테이크 답의 브랜드 색 3개 → 브리프 brand.colors → c 안이 source:brand, 색 칸 없으면 생성', { timeout: 60_000 }, async () => {
  const answers = { name: '새벽빵', audience: '출근길 직장인', action: '전화 예약', mood: '따뜻한', hours: '매일 07:00-20:00' }
  const withColors = toBrief({ topic: '동네 빵집', archetype: 'local', answers: { ...answers, brandColors: '#0B6E4F, #F7F3EA, #1C1C1C' } })
  assert.deepEqual(withColors.brand.colors, ['#0B6E4F', '#F7F3EA', '#1C1C1C'])
  const r = await run(withColors, 0)
  assert.equal(r.candidates[2].source, 'brand')
  assert.equal(r.candidates[2].brand.input.colors.length, 3)
  const without = toBrief({ topic: '동네 빵집', archetype: 'local', answers })
  assert.equal(without.brand, undefined)
  assert.equal((await run(without, 0)).candidates[2].source, 'generated')
})
