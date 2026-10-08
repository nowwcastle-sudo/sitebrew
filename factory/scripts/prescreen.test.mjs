// AI 예선(P3-4 Task 6) 시험 — 브라우저·서버 없음.
//   ① 채점: 가짜 예측으로 일치율·출처별 일치율·85% 문턱(84.9% → 꺼짐, 85% → 켜짐) · 예측 안 함은 맞고 틀림에서 빠지고 coverage 로 센다 · 표본이 작으면 켜지지 않는다
//   ② 출처별 표본(Review Focus 5): 한 출처 예시만 있는 묶음 → 다른 출처 짝은 「예측 안 함」 · 예시는 출처마다 상한을 두고 섞는다 · 묶음에 든 짝마다 출처 묶음이 하나
//   ③ 자료 묶음: 실행 폴더 → 짝 3개(ab·ac·bc), 정답이 짝에 없다, 사진·07-qa 요약이 실린다 · 하나 빼기 묶음은 그 예시의 정답을 싣지 않는다
//   ④ 예측 파일 검사(validatePredictions) · 예측 승자 합성(predictedWinner — 모순·빈 짝이면 없음)
//   ⑤ 보드: 꺼져 있으면 「AI 추천」이 없다 · 켜져 있고 출처 묶음이 85% 이상이면 예측 승자 카드에만 배지 · 묶음이 85% 미만이면 배지 없음 · 고르기(pick)는 그대로
//   ⑥ 실데이터: 지금 저장소의 운영자 선택에서 예시를 읽는다(개수 고정 — 새 판정이 들어오면 이 숫자를 고친다) · 측정 기록 prescreen-score.json 이 있으면 모양이 맞고 enabled 가 문턱 규칙과 같다
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  SOURCES, THRESHOLD_PCT, MIN_ANSWERED, MIN_PER_SOURCE, PER_SOURCE_CAP, ABSTAIN_LABEL, SCORE_FILE,
  pairSource, scorePrescreen, prescreenPacket, looPackets, mixExamples, countBySource, markPairs, validatePredictions,
  predictedWinner, loadRunPrescreen, loadScore, loadExamples, boardExamples, pairsExamples,
} from '../board/prescreen.mjs'
import { loadBoardData, buildDirectionBoard } from '../board/direction-board/build.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const write = (f, o) => { mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, typeof o === 'string' ? o : JSON.stringify(o, null, 2) + '\n') }

// ── 재료 ──────────────────────────────────────────────────────────────────────────────────
const ex = (i, source, winner = 'a', extra = {}) => ({ id: `e${i}`, a: `ra${i}`, b: `rb${i}`, winner, source, sources: source === 'library' ? ['library', 'library'] : ['library', source], origin: 'test', date: `2026-09-${String(10 + (i % 18)).padStart(2, '0')}`, ...extra })
// n 개 예시(출처 source), 그중 맞히게 만들 개수 good: 예측은 winner 그대로(맞음) 또는 뒤집음(틀림)
const held = (n, source = 'library', from = 0) => Array.from({ length: n }, (_, i) => ex(from + i, source))
const preds = (heldOut, good) => heldOut.map((h, i) => ({ id: h.id, a: h.a, b: h.b, winner: i < good ? h.winner : h.winner === 'a' ? 'b' : 'a' }))

// ── ① 채점 ────────────────────────────────────────────────────────────────────────────────
test('85% 문턱: 84.9% → 꺼짐, 85% → 켜짐(정수 비교 — 부동소수 경계 없음)', () => {
  assert.equal(THRESHOLD_PCT, 85)
  const h1000 = held(1000)
  const s849 = scorePrescreen(preds(h1000, 849), h1000)
  assert.equal(s849.overall, 0.849)
  assert.equal(s849.enabled, false)
  const s850 = scorePrescreen(preds(h1000, 850), h1000)
  assert.equal(s850.overall, 0.85)
  assert.equal(s850.enabled, true)
  // 작은 표본의 경계: 17/20 = 85% 켜짐, 16/20 = 80% 꺼짐, 169/200 = 84.5% 꺼짐
  const h20 = held(MIN_ANSWERED)
  assert.equal(scorePrescreen(preds(h20, 17), h20).enabled, true)
  assert.equal(scorePrescreen(preds(h20, 16), h20).enabled, false)
  const h200 = held(200)
  assert.equal(scorePrescreen(preds(h200, 169), h200).enabled, false)
  assert.equal(scorePrescreen(preds(h200, 170), h200).enabled, true)
})

test('표본이 작으면 100% 여도 켜지지 않는다(예측한 짝 < 최소)', () => {
  const h = held(MIN_ANSWERED - 1)
  const s = scorePrescreen(preds(h, h.length), h)
  assert.equal(s.overall, 1)
  assert.equal(s.answered, MIN_ANSWERED - 1)
  assert.equal(s.enabled, false)
})

test('출처별 일치율을 따로 센다 · 예시가 없는 출처는 「예측 안 함」(null)', () => {
  const heldOut = [...held(10, 'library', 0), ...held(10, 'generated', 100)]
  const p = [...preds(heldOut.slice(0, 10), 10), ...preds(heldOut.slice(10), 5)] // 라이브러리 10/10, 생성 5/10
  const s = scorePrescreen(p, heldOut, { minAnswered: 10 })
  assert.equal(s.bySource.library, 1)
  assert.equal(s.bySource.generated, 0.5)
  assert.equal(s.bySource.brand, null, '브랜드 예시가 없으면 일치율이 아니라 「예측 안 함」')
  assert.equal(s.bySourceDetail.brand.label, ABSTAIN_LABEL)
  assert.equal(s.bySourceDetail.brand.total, 0)
  assert.equal(s.overall, 0.75)
  assert.equal(s.enabled, false)
  // 전체가 85% 를 넘어도 자기 묶음이 85% 미만인 출처는 추천을 보이지 않는다
  const s2 = scorePrescreen([...preds(heldOut.slice(0, 10), 10), ...preds(heldOut.slice(10), 8)], heldOut, { minAnswered: 10, thresholdPct: 85 })
  assert.equal(s2.overall, 0.9)
  assert.equal(s2.enabled, true)
  assert.equal(s2.sourceEnabled.library, true)
  assert.equal(s2.sourceEnabled.generated, false, '생성 80% 는 자기 문턱 미달')
  assert.equal(s2.sourceEnabled.brand, false)
})

test('예측 안 함은 맞고 틀림에서 빠지고 coverage 로 센다 · 묶음에 없는 예측은 던진다', () => {
  const h = held(30)
  const p = preds(h, 30).map((x, i) => (i < 10 ? { ...x, winner: null } : x))
  const s = scorePrescreen(p, h)
  assert.equal(s.total, 30)
  assert.equal(s.answered, 20)
  assert.equal(s.abstained, 10)
  assert.equal(s.overall, 1)
  assert.ok(Math.abs(s.coverage - 20 / 30) < 1e-9)
  // 빠진 예측도 예측 안 함
  assert.equal(scorePrescreen(p.slice(0, 25), h).abstained, 15, '빠진 예측(25~29번)도 예측 안 함으로 센다')
  assert.throws(() => scorePrescreen([{ id: 'nope', a: 'x', b: 'y', winner: 'a' }], h), /없는 예측/)
  assert.throws(() => scorePrescreen([p[10], p[10]], h), /둘이다/)
  assert.throws(() => scorePrescreen([], [h[0], h[0]]), /두 번/)
})

test('예측이 전부 비면 overall 은 null(0 이 아니다) · 켜지지 않는다', () => {
  const h = held(25)
  const s = scorePrescreen([], h)
  assert.equal(s.overall, null)
  assert.equal(s.answered, 0)
  assert.equal(s.enabled, false)
})

// ── ② 출처별 표본 ─────────────────────────────────────────────────────────────────────────
test('pairSource: 브랜드 > 생성 > 라이브러리 — 짝은 묶음 하나에만 든다', () => {
  assert.equal(pairSource('library', 'library'), 'library')
  assert.equal(pairSource('library', 'generated'), 'generated')
  assert.equal(pairSource('generated', 'library'), 'generated')
  assert.equal(pairSource('generated', 'generated'), 'generated')
  assert.equal(pairSource('brand', 'generated'), 'brand')
  assert.equal(pairSource('library', 'brand'), 'brand')
  assert.throws(() => pairSource('x', 'library'), /알 수 없는 출처/)
})

test('한 출처 예시만 있는 묶음 → 다른 출처 짝은 예측 안 함(Review Focus 5)', () => {
  const libOnly = held(12) // 라이브러리 12개뿐
  const counts = countBySource(libOnly)
  assert.deepEqual(counts, { library: 12, generated: 0, brand: 0 })
  const pairs = markPairs([
    { a: 'a', b: 'b', sourceA: 'library', sourceB: 'library' },
    { a: 'a', b: 'c', sourceA: 'library', sourceB: 'generated' },
    { a: 'b', b: 'c', sourceA: 'library', sourceB: 'brand' },
  ], counts)
  assert.deepEqual(pairs.map((p) => p.predict), [true, false, false])
  assert.match(pairs[1].skip, /예측 안 함: generated 예시 0개/)
  assert.match(pairs[2].skip, /예측 안 함: brand 예시 0개/)
  // 출처마다 최소 n 개가 있으면 예측한다 — 경계: MIN_PER_SOURCE-1 개는 안 함, MIN_PER_SOURCE 개는 함
  const edge = (n) => markPairs([{ a: 'a', b: 'b', sourceA: 'library', sourceB: 'generated' }], { library: 12, generated: n, brand: 0 })[0].predict
  assert.equal(edge(MIN_PER_SOURCE - 1), false)
  assert.equal(edge(MIN_PER_SOURCE), true)
})

test('예시는 출처마다 상한을 두고 섞는다 — 한 출처가 묶음을 덮지 않는다', () => {
  const many = [...held(30, 'library', 0), ...held(8, 'generated', 100), ...held(6, 'brand', 200)]
  const mixed = mixExamples(many)
  const c = countBySource(mixed)
  assert.equal(c.library, PER_SOURCE_CAP)
  assert.equal(c.generated, 8)
  assert.equal(c.brand, 6)
  // 묶음 안에서는 최근 것 먼저
  const libDates = mixed.filter((e) => e.source === 'library').map((e) => e.date)
  assert.deepEqual([...libDates].sort().reverse(), libDates)
  assert.equal(mixExamples(many, { perSourceCap: 3 }).length, 3 + 3 + 3)
})

// ── ③ 자료 묶음 ───────────────────────────────────────────────────────────────────────────
let tmp
before(() => { tmp = mkdtempSync(join(tmpdir(), 'prescreen-test-')) })
after(() => { rmSync(tmp, { recursive: true, force: true }) })

const makeRun = (name, cands, { stills = true } = {}) => {
  const run = join(tmp, name)
  write(join(run, 'brief.json'), { archetype: 'saas', topic: '시험 브리프' })
  cands.forEach((c, i) => {
    const id = 'abc'[i]
    write(join(run, id, 'candidate.json'), { id, source: c.source, slot: ['safe', 'new', 'bold'][i], recipe: c.recipe, why: `${id} 의 이유`, blockers: c.blockers ?? [] })
    write(join(run, id, '07-qa', 'summary.json'), { publishable: !(c.blockers ?? []).length, blockers: c.blockers ?? [], gates: [{ verdict: 'pass' }, { verdict: 'pass' }], warnings: [] })
  })
  if (stills) write(join(run, 'direction-board', 'manifest.json'), { options: cands.map((c, i) => ({ recipe: 'abc'[i], option: 'A', stills: [{ width: 1440, file: `${'abc'[i]}-1440.webp` }, { width: 375, file: `${'abc'[i]}-375.webp` }] })) })
  return run
}

test('prescreenPacket: 짝 3개(ab·ac·bc) · 정답 없음 · 사진·07-qa 요약 · 출처 묶음 표기', () => {
  const run = makeRun('run-lib', [{ source: 'library', recipe: 'r1-measure' }, { source: 'library', recipe: 'r2-signal' }, { source: 'generated', recipe: 'x-run-c', blockers: ['공개 불가 — 확인 필요 사실: business.phone'] }])
  const examples = [...held(12, 'library', 0), ...held(2, 'generated', 100)]
  const packet = prescreenPacket(run, { examples })
  assert.equal(packet.pairs.length, 3)
  assert.deepEqual(packet.pairs.map((p) => `${p.a}${p.b}`), ['ab', 'ac', 'bc'])
  for (const p of packet.pairs) assert.equal('winner' in p, false, '짝에는 정답이 없다')
  assert.deepEqual(packet.pairs.map((p) => p.predict), [true, false, false], 'generated 예시 2개 < 5 → 생성이 낀 짝은 예측 안 함')
  assert.deepEqual(packet.pairs.map((p) => p.source), ['library', 'generated', 'generated'])
  assert.equal(packet.pairs[1].qa.b.publishable, false)
  assert.match(packet.pairs[1].qa.b.blockers[0], /business\.phone/)
  assert.equal(packet.pairs[0].qa.a.publishable, true)
  assert.ok(packet.pairs[0].shots.a.desktop.endsWith('a-1440.webp'))
  assert.ok(packet.pairs[0].shots.b.phone.endsWith('b-375.webp'))
  assert.deepEqual(packet.sourceCounts, { library: 12, generated: 2, brand: 0 })
  assert.deepEqual(packet.predictable, { library: true, generated: false, brand: false })
  assert.equal(packet.archetype, 'saas')
  assert.equal(packet.brief, '시험 브리프')
  assert.ok(packet.examples.every((e) => 'winner' in e), '예시에는 정답이 있다')
  assert.ok(packet.examples.length <= PER_SOURCE_CAP * SOURCES.length)
})

test('촬영 전(manifest 없음): 사진은 null, 묶음은 만들어진다', () => {
  const run = makeRun('run-nostill', [{ source: 'library', recipe: 'r1-measure' }, { source: 'library', recipe: 'r2-signal' }], { stills: false })
  const p = prescreenPacket(run, { examples: held(12) })
  assert.equal(p.pairs.length, 1)
  assert.equal(p.pairs[0].shots.a.desktop, null)
})

test('하나 빼기 묶음: 그 예시의 정답이 묶음 어디에도 없고, 나머지 예시만 센다', () => {
  const all = [...held(6, 'library', 0), ...held(3, 'generated', 50)]
  all[0] = { ...all[0], winner: 'b', ownerNote: '다른 예시의 메모' }
  const loo = looPackets(all)
  assert.equal(loo.length, all.length)
  const first = loo[0]
  assert.equal(first.held.id, 'e0')
  assert.equal(first.packet.pairs.length, 1)
  assert.equal(first.packet.pairs[0].id, 'e0')
  assert.equal('winner' in first.packet.pairs[0], false)
  assert.equal(first.packet.examples.some((e) => e.id === 'e0'), false, '빼낸 예시는 예시에 없다')
  assert.equal(first.packet.sourceCounts.library, 5)
  assert.equal(first.packet.pairs[0].predict, true)
  // 생성 예시가 3개뿐이면(< 5) 생성 짝은 예측 안 함, 사유에 개수
  const gen = loo.find((l) => l.held.source === 'generated')
  assert.equal(gen.packet.pairs[0].predict, false)
  assert.match(gen.packet.pairs[0].skip, /generated 예시 2개 \(< 5개\)/)
})

// ── ④ 예측 파일 검사·승자 합성 ─────────────────────────────────────────────────────────────
test('validatePredictions: 빠짐·겹침·예측하면 안 되는 짝·값 틀림·엉뚱한 짝을 잡는다', () => {
  const packet = { pairs: [{ a: 'a', b: 'b', predict: true }, { a: 'a', b: 'c', predict: false, skip: '예측 안 함: generated 예시 0개 (< 5개)' }, { a: 'b', b: 'c', predict: true }] }
  const ok = [{ a: 'a', b: 'b', winner: 'a' }, { a: 'a', b: 'c', winner: null }, { a: 'b', b: 'c', winner: 'b' }]
  assert.deepEqual(validatePredictions(ok, packet), [])
  assert.deepEqual(validatePredictions({ predictions: ok }, packet), [], '{ predictions } 감싸기도 받는다')
  assert.match(validatePredictions(ok.slice(1), packet).join(), /예측이 빠진 짝: a\|b/)
  assert.match(validatePredictions([...ok, ok[0]], packet).join(), /두 번 나온다/)
  assert.match(validatePredictions([ok[0], { a: 'a', b: 'c', winner: 'a' }, ok[2]], packet).join(), /예측하면 안 되는 짝/)
  assert.match(validatePredictions([{ a: 'a', b: 'b', winner: null }, ok[1], ok[2]], packet).join(), /예측해야 하는 짝인데 비웠다/)
  assert.match(validatePredictions([{ a: 'a', b: 'b', winner: 'x' }, ok[1], ok[2]], packet).join(), /winner 는/)
  assert.match(validatePredictions([...ok, { a: 'z', b: 'y', winner: 'a' }], packet).join(), /묶음에 없는 짝: z\|y/)
  assert.match(validatePredictions({}, packet).join(), /배열이 없다/)
})

test('predictedWinner: 가장 많이 이긴 후보 하나 · 모순(순환)·빈 짝이면 없음', () => {
  const ids = ['a', 'b', 'c']
  assert.equal(predictedWinner([{ a: 'a', b: 'b', winner: 'a' }, { a: 'a', b: 'c', winner: 'a' }, { a: 'b', b: 'c', winner: 'b' }], ids), 'a')
  assert.equal(predictedWinner([{ a: 'a', b: 'b', winner: 'b' }, { a: 'a', b: 'c', winner: 'a' }, { a: 'b', b: 'c', winner: 'c' }], ids), null, 'a>c, c>b, b>a 순환 — 1승씩')
  assert.equal(predictedWinner([{ a: 'a', b: 'b', winner: 'a' }, { a: 'a', b: 'c', winner: null }, { a: 'b', b: 'c', winner: 'b' }], ids), null, '빈 짝이 있으면 추천 없음')
  assert.equal(predictedWinner([{ a: 'a', b: 'b', winner: 'a' }], ['a', 'b']), 'a')
  assert.equal(predictedWinner([], ['a']), null)
})

// ── ⑤ 보드 ────────────────────────────────────────────────────────────────────────────────
const scoreFile = (name, o) => { const f = join(tmp, name); write(f, o); return f }
const ON = { enabled: true, overall: 0.9, answered: 40, sourceEnabled: { library: true, generated: false, brand: false } }
// winner 는 짝 안의 자리('a'|'b'): a·b 는 b 가, a·c 는 c 가(=자리 b), b·c 는 b 가(=자리 a) 이긴다 → b 2승
const preds3 = [{ a: 'a', b: 'b', winner: 'b', reason: 'board1:r6-civic — b 쪽이 면이 크다' }, { a: 'a', b: 'c', winner: 'b', reason: '…' }, { a: 'b', b: 'c', winner: 'a', reason: '…' }]

test('보드: 예선이 꺼져 있으면 「AI 추천」이 없다(측정 기록 없음 · enabled false)', () => {
  const run = makeRun('run-board-off', [{ source: 'library', recipe: 'r1-measure' }, { source: 'library', recipe: 'r2-signal' }, { source: 'library', recipe: 'r3-woodblock' }])
  write(join(run, 'prescreen.json'), { run: 'x', predictions: preds3 })
  assert.equal(loadRunPrescreen(run, { scoreFile: join(tmp, 'no-such-score.json') }), null)
  assert.equal(loadRunPrescreen(run, { scoreFile: scoreFile('off.json', { ...ON, enabled: false }) }), null)
  const html = buildDirectionBoard(loadBoardData(run, { scoreFile: join(tmp, 'no-such-score.json') }))
  assert.equal(html.includes('AI 추천'), false)
  assert.equal(html.includes('data-ai-pick'), false)
})

test('보드: 켜져 있고 라이브러리 묶음이 85% 이상이면 예측 승자 카드에만 배지 · 고르기 버튼은 그대로', () => {
  const run = makeRun('run-board-on', [{ source: 'library', recipe: 'r1-measure' }, { source: 'library', recipe: 'r2-signal' }, { source: 'library', recipe: 'r3-woodblock' }])
  write(join(run, 'prescreen.json'), { run: 'x', predictions: preds3 })
  const sf = scoreFile('on.json', ON)
  const ps = loadRunPrescreen(run, { scoreFile: sf })
  assert.equal(ps.winner, 'b', 'b>a, c>a, b>c → b 2승')
  const data = loadBoardData(run, { scoreFile: sf })
  assert.equal(data.cands.filter((c) => c.aiPick).map((c) => c.id).join(), 'b')
  const html = buildDirectionBoard(data)
  assert.equal((html.match(/data-ai-pick/g) ?? []).length, 1)
  const card = html.split('<article').find((s) => s.includes('id="card-b"'))
  assert.ok(card.includes('data-ai-pick') && card.includes('AI 추천'))
  for (const id of ['a', 'c']) assert.equal(html.split('<article').find((s) => s.includes(`id="card-${id}"`)).includes('AI 추천'), false)
  for (const id of ['a', 'b', 'c']) assert.ok(html.includes(`data-pick="${id}"`), '고르기 버튼은 예선과 상관없이 그대로')
  assert.ok(html.includes('90%'), '일치율·표본 수를 보인다')
})

test('보드: 생성이 낀 짝은 그 출처 묶음이 켜지지 않았으면 추천하지 않는다(추천이 한 출처 취향으로만 배운 것이 되지 않게)', () => {
  const run = makeRun('run-board-gen', [{ source: 'library', recipe: 'r1-measure' }, { source: 'library', recipe: 'r2-signal' }, { source: 'generated', recipe: 'x-run-c' }])
  write(join(run, 'prescreen.json'), { run: 'x', predictions: preds3 })
  const sf = scoreFile('on-lib-only.json', ON) // generated 묶음은 꺼짐
  assert.equal(loadRunPrescreen(run, { scoreFile: sf }).winner, null, 'ac·bc 가 생성 묶음이라 쓰지 않는다 → 짝이 모자라 추천 없음')
  assert.equal(buildDirectionBoard(loadBoardData(run, { scoreFile: sf })).includes('AI 추천'), false)
  const on = scoreFile('on-all.json', { ...ON, sourceEnabled: { library: true, generated: true, brand: false } })
  assert.equal(loadRunPrescreen(run, { scoreFile: on }).winner, 'b')
})

test('보드: 예측 파일이 없으면(켜져 있어도) 배지 없음', () => {
  const run = makeRun('run-board-nofile', [{ source: 'library', recipe: 'r1-measure' }, { source: 'library', recipe: 'r2-signal' }])
  assert.equal(loadRunPrescreen(run, { scoreFile: scoreFile('on2.json', ON) }), null)
})

// ── ⑥ 실데이터 ────────────────────────────────────────────────────────────────────────────
test('실데이터: 대표의 지금까지 선택 — 레시피 보드 판정 16쌍(1판 10 · 2판 2 · 3판 4), 모두 라이브러리 × 라이브러리, 결선 기록 없음', () => {
  const b = boardExamples()
  assert.equal(b.filter((e) => e.origin === 'recipe-board-v1').length, 10)
  assert.equal(b.filter((e) => e.origin === 'recipe-board-v2').length, 2)
  assert.equal(b.filter((e) => e.origin === 'recipe-board-v3').length, 4)
  assert.ok(b.every((e) => e.source === 'library'))
  assert.ok(b.every((e) => e.winner === 'a' || e.winner === 'b'))
  assert.equal(new Set(b.map((e) => e.id)).size, b.length, 'id 가 겹치지 않는다')
  // 판정 읽기 규칙 — r5 2판은 B 를 보고 A 를 골랐다(짝), r1 3판은 고르지 않았다(짝 아님)
  assert.equal(b.find((e) => e.id === 'board2:r5-celadon').winner, 'a')
  assert.equal(b.find((e) => e.id === 'board2:r2-signal').winner, 'b')
  assert.equal(b.some((e) => e.id === 'board3:r1-measure'), false)
  assert.equal(b.find((e) => e.id === 'board1:r9-clay').winner, 'a', 'axisPicks A·A·B 다수결')
  const counts = countBySource(loadExamples({ pairsFile: join(tmp, 'no-pairs.jsonl') }))
  assert.deepEqual(counts, { library: 16, generated: 0, brand: 0 })
  assert.deepEqual(pairsExamples(join(tmp, 'no-pairs.jsonl')), [])
})

test('실데이터: 결선 기록(pairs.jsonl)은 줄마다 출처 묶음을 얻는다', () => {
  const f = join(tmp, 'pairs.jsonl')
  const row = { a: 'r1-measure', b: 'x-run-c', winner: 'b', archetype: 'saas', brief: '시험', date: '2026-09-30', sourceA: 'library', sourceB: 'generated' }
  writeFileSync(f, JSON.stringify(row) + '\n' + JSON.stringify({ ...row, a: 'x-run-b', sourceA: 'brand', winner: 'a' }) + '\n')
  const e = pairsExamples(f)
  assert.deepEqual(e.map((x) => [x.id, x.source, x.winner]), [['pairs:1', 'generated', 'b'], ['pairs:2', 'brand', 'a']])
})

test('측정 기록(prescreen-score.json)이 있으면 모양이 맞고 enabled 가 문턱 규칙과 같다 — 없으면 꺼짐', () => {
  const s = loadScore()
  if (!existsSync(SCORE_FILE)) { assert.equal(s.enabled, false); return }
  assert.equal(s.method, 'leave-one-out')
  assert.equal(typeof s.answered, 'number')
  assert.equal(s.enabled, s.answered >= s.minAnswered && s.correct * 100 >= s.answered * s.thresholdPct, '기록한 enabled 가 문턱 규칙에서 나온 값이다')
  for (const src of SOURCES) assert.ok(src in s.bySourceDetail, `출처 ${src} 칸`)
  assert.deepEqual(Object.keys(s.sourceEnabled).sort(), [...SOURCES].sort())
})

test('저장된 하나 빼기 예측을 지금 예시로 다시 채점하면 측정 기록과 같다(재현)', () => {
  if (!existsSync(SCORE_FILE)) return
  const s = loadScore()
  const preds = JSON.parse(readFileSync(join(HERE, '..', 'board', 'prescreen-loo-20261001.json'), 'utf8')).predictions
  const again = scorePrescreen(preds, loadExamples({ pairsFile: join(tmp, 'no-pairs.jsonl') }))
  assert.equal(again.correct, s.correct)
  assert.equal(again.answered, s.answered)
  assert.equal(again.enabled, s.enabled)
  assert.equal(s.enabled, false, '표본 16쌍 < 20 · 81.3% < 85% — 꺼진 채가 정상')
})
