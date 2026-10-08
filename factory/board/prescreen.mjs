// AI 예선(P3-4 Task 6) — 결선 보드 앞에서 운영자가 고를 안을 미리 예측하고, 일치율이 85% 미만이면 스스로 꺼진다.
//   node factory/board/prescreen.mjs packet <run> [--out <파일>]      예측 자료 묶음(예시 + 후보 짝) — 예선 에이전트가 PRESCREEN.md 대로 읽는다
//   node factory/board/prescreen.mjs check <run|packet.json> <predictions.json>   예측 파일이 묶음과 맞는지(짝 빠짐·엉뚱한 칸) 검사
//   node factory/board/prescreen.mjs loo-packets --out <폴더>          하나 빼기(leave-one-out) 측정용 묶음: 예시마다 그 예시만 뺀 묶음 한 개 + heldout.json(정답, 에이전트에게 주지 않는다)
//   node factory/board/prescreen.mjs score <predictions.json> [--heldout <heldout.json>] [--write]   일치율·출처별 일치율·85% 문턱. --write 면 prescreen-score.json(보드가 읽는 스위치)을 쓴다
//   node factory/board/prescreen.mjs status                            지금 스위치(켜짐·꺼짐)와 근거
// 예측 자체는 에이전트가 한다(이 파일은 API 를 부르지 않는다). 이 파일이 하는 일은 자료 묶음·채점·스위치다.
// 예시(examples): 대표의 과거 선택 — factory/board/pairs.jsonl(J8 결선 기록) + 레시피 보드 판정(recipe-decisions.json = 1판, recipe-board2·3-decisions.json).
//   한 예시 = { id, a, b, winner: 'a'|'b', source, sources[], origin, … }. source = 그 짝의 출처 묶음 — 브랜드 > 생성 > 라이브러리 가운데 짝에 든 가장 「파생된」 것
//   (라이브러리끼리 = library, 생성이 끼면 generated, 브랜드가 끼면 brand). 한 짝은 묶음 하나에만 든다 — 묶음별 개수가 합쳐서 전체가 된다.
// 출처별 표본(Review Focus 5): 묶음마다 예시가 minPerSource 개 이상일 때만 그 묶음의 짝을 예측한다 — 모자라면 「예측 안 함」. 예시는 묶음마다 상한(perSourceCap)을 두고 섞어 한 출처가 묶음을 덮지 않게 한다.
// 스위치: overall(예측한 것 중 맞은 비율) ≥ 85% 이고 예측한 수 ≥ minAnswered 일 때만 enabled. 출처별 일치율은 따로 세고, 묶음마다 자기 일치율이 85% 이상일 때만 보드가 그 묶음에 「AI 추천」을 보인다.
//   84.9% → 꺼짐, 85% → 켜짐(정수 비교 — 부동소수 경계 없음). 표본이 모자라 꺼진 채 출시하는 것이 정상이다.
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveRun, PAIRS_FILE } from './promote.mjs'
import { readPairs, loadCandidates } from './direction-board/record.mjs'
import { loadBoardHeads } from './recipe-board/jobs.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
export const SOURCES = ['library', 'generated', 'brand']
export const THRESHOLD_PCT = 85
export const MIN_PER_SOURCE = 5
export const MIN_ANSWERED = 20
export const PER_SOURCE_CAP = 10
export const SCORE_FILE = join(HERE, 'prescreen-score.json')
export const PRESCREEN_FILE = 'prescreen.json'
export const ABSTAIN_LABEL = '예측 안 함'
const DERIVED_ORDER = ['brand', 'generated', 'library'] // 앞이 더 파생된 출처

const readJson = (f, d = null) => (existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : d)
const pairKey = (x) => x.id ?? `${x.a}|${x.b}`

/** 짝의 출처 묶음(브랜드 > 생성 > 라이브러리). */
export function pairSource(sourceA, sourceB) {
  const have = [sourceA, sourceB]
  if (!have.every((s) => SOURCES.includes(s))) throw new Error(`알 수 없는 출처: ${sourceA}·${sourceB}`)
  return DERIVED_ORDER.find((s) => have.includes(s))
}

// ── 예시 읽기 ──────────────────────────────────────────────────────────────────────────────
/** 결선 기록 pairs.jsonl → 예시(줄마다). 없으면 빈 목록. */
export function pairsExamples(pairsFile = PAIRS_FILE) {
  return readPairs(pairsFile).map((r, i) => ({
    id: `pairs:${i + 1}`, a: r.a, b: r.b, winner: r.winner, source: pairSource(r.sourceA, r.sourceB), sources: [r.sourceA, r.sourceB],
    origin: 'pairs.jsonl', archetype: r.archetype, brief: r.brief, date: r.date,
  }))
}

// 레시피 보드 판정의 글자(A·B)가 가리키는 머리 — 1판 보드(8541c6f 고정본)만 재구성할 수 있다(heads-at-board.json). A = 머리, B = alternates 를 적용한 안.
const headText = (h, alt) => {
  const a = alt ? h.alternates : null
  const f = h.fonts?.display?.family
  return alt
    ? `B안 — 색 논리 ${a.colorLogic ?? h.colorLogic}, 역동 ${(a.dynamics ?? h.dynamics).join('+')}, 모션 ${a.motion ?? h.motion}${a.note ? `. ${a.note}` : ''}`
    : `A안 — 색 논리 ${h.colorLogic}, 역동 ${h.dynamics.join('+')}, 모션 ${h.motion}, 제목 서체 ${f ?? '?'}, 분위기 ${(h.mood ?? []).join('·')}`
}
const shotDirs = () => [process.env.WF_BOARD_SHOTS, join(ROOT, '.tmp', 'board')].filter(Boolean)
const findShot = (recipe, letter, scene) => {
  for (const d of shotDirs()) for (const theme of ['light', 'dark']) {
    const f = join(d, `${recipe}-${letter}-${scene}-1440-${theme}.webp`)
    if (existsSync(f)) return f
  }
  return null
}

const letterOf = (o) => (o === 'A' || o === 'B' ? o : null)
const winnerOfDoc = (d) => {
  const pick = letterOf(d.pick)
  if (pick) {
    const other = pick === 'A' ? 'B' : 'A'
    // 짝이 있어야 한다 — 고른 것 말고 다른 글자가 같은 문서에서 보였을 때만(r5 는 A 하나뿐이라 짝이 아니다).
    const seen = [d.likes, d.aspects, d.notes].some((x) => x && other in x)
    return seen ? pick : null
  }
  const liked = Object.entries(d.likes ?? {}).filter(([, v]) => v === 'like').map(([k]) => k)
  const disliked = Object.entries(d.likes ?? {}).filter(([, v]) => v === 'dislike').map(([k]) => k)
  return liked.length === 1 && disliked.length === 1 ? liked[0] : null
}
const noteOf = (d) => [d.note, ...Object.entries(d.notes ?? {}).map(([k, v]) => `${k}안: ${v}`)].filter(Boolean).join(' / ') || undefined

/** 레시피 보드 판정 파일 → 예시. 1판(recipe-decisions.json)은 axisPicks 다수결, 2·3판은 pick(또는 좋다/별로가 갈린 것). 모두 library × library. */
export function boardExamples(dir = HERE) {
  const out = []
  const v1 = readJson(join(dir, 'recipe-decisions.json'))
  if (v1) {
    const heads = new Map(loadBoardHeads().map((h) => [h.id, h]))
    for (const d of v1.decisions ?? []) {
      const picks = Object.values(d.axisPicks ?? {}).filter(letterOf)
      const nA = picks.filter((p) => p === 'A').length, nB = picks.length - nA
      if (!picks.length || nA === nB) continue
      const winner = nA > nB ? 'a' : 'b'
      const h = heads.get(d.recipe)
      const view = h?.alternates ? { a: { desc: headText(h, false), shot: findShot(d.recipe, 'A', h.signature?.[0] ?? 'hero') }, b: { desc: headText(h, true), shot: findShot(d.recipe, 'B', h.signature?.[0] ?? 'hero') } } : undefined
      out.push({ id: `board1:${d.recipe}`, a: `${d.recipe}#A`, b: `${d.recipe}#B`, winner, source: 'library', sources: ['library', 'library'], origin: 'recipe-board-v1', recipe: d.recipe, date: String(d.decidedAt ?? '').slice(0, 10) || undefined, ...(view ? { view } : {}) })
    }
  }
  for (const [n, file] of [[2, 'recipe-board2-decisions.json'], [3, 'recipe-board3-decisions.json']]) {
    const j = readJson(join(dir, file))
    if (!j) continue
    for (const [recipe, d] of Object.entries(j)) {
      if (!/^r\d+-/.test(recipe) || typeof d !== 'object') continue
      const w = winnerOfDoc(d)
      if (!w) continue
      const note = noteOf(d)
      out.push({ id: `board${n}:${recipe}`, a: `${recipe}#A`, b: `${recipe}#B`, winner: w === 'A' ? 'a' : 'b', source: 'library', sources: ['library', 'library'], origin: `recipe-board-v${n}`, recipe, date: String(d.decidedAt ?? '').slice(0, 10) || undefined, ...(note ? { ownerNote: note } : {}) })
    }
  }
  return out
}

/** 지금까지의 모든 운영자 선택: 결선 기록 + 레시피 보드 판정. */
export const loadExamples = ({ pairsFile = PAIRS_FILE, boardDir = HERE } = {}) => [...pairsExamples(pairsFile), ...boardExamples(boardDir)]

// ── 자료 묶음 ──────────────────────────────────────────────────────────────────────────────
export const countBySource = (examples) => Object.fromEntries(SOURCES.map((s) => [s, examples.filter((e) => e.source === s).length]))

/** 출처 묶음마다 상한(perSourceCap)을 두고 섞는다 — 묶음 안은 최근 것 먼저(날짜 → id 내림차순). 모자란 묶음의 예시도 그대로 싣는다(참고용, 그 묶음은 예측하지 않는다). */
export function mixExamples(examples, { perSourceCap = PER_SOURCE_CAP } = {}) {
  const recent = (x, y) => String(y.date ?? '').localeCompare(String(x.date ?? '')) || String(y.id).localeCompare(String(x.id))
  return SOURCES.flatMap((s) => examples.filter((e) => e.source === s).sort(recent).slice(0, perSourceCap))
}

/** 묶음별 「예측해도 되는가」. */
export const predictableBy = (counts, minPerSource = MIN_PER_SOURCE) => Object.fromEntries(SOURCES.map((s) => [s, counts[s] >= minPerSource]))

const skipReason = (source, counts, min) => `${ABSTAIN_LABEL}: ${source} 예시 ${counts[source]}개 (< ${min}개)`

/**
 * 짝 목록 → 예측 대상 표기. 짝 = { a, b, sourceA, sourceB, … }(a·b = 후보 id). 예시가 모자란 출처 묶음의 짝은 predict false + skip 사유.
 */
export function markPairs(pairs, counts, minPerSource = MIN_PER_SOURCE) {
  const ok = predictableBy(counts, minPerSource)
  return pairs.map((p) => {
    const source = pairSource(p.sourceA, p.sourceB)
    return ok[source] ? { ...p, source, predict: true } : { ...p, source, predict: false, skip: skipReason(source, counts, minPerSource) }
  })
}

const stillOf = (manifest, id, width) => manifest?.options?.find((o) => o.recipe === id && o.option === 'A')?.stills?.find((s) => s.width === width)?.file ?? null
const qaOf = (dir) => {
  const q = readJson(join(dir, '07-qa', 'summary.json'))
  if (!q) return null
  const gates = (q.gates ?? []).reduce((n, g) => ({ ...n, [g.verdict ?? 'pass']: (n[g.verdict ?? 'pass'] ?? 0) + 1 }), {})
  return { publishable: q.publishable === true, blockers: (q.blockers ?? []).slice(0, 8), gates, warnings: (q.warnings ?? []).length }
}

/**
 * 실행 폴더 → 예측 자료 묶음. 후보 a·b·c 의 모든 짝(ab·ac·bc)을 둔다.
 *   { run, archetype, brief, minPerSource, sourceCounts, predictable, pairs[{ a, b, aName, bName, sourceA, sourceB, source, predict, skip?, shots{ a{desktop,phone}, b{…} }, qa{ a, b } }], examples[] }
 * 정답(winner)은 짝에 없다 — 예시에만 있다. 사진은 <실행>/direction-board/manifest.json 의 첫 화면 정지(1440·375)를 가리키는 절대 경로(없으면 null — 촬영 전).
 */
export function prescreenPacket(runDir, { pairsFile = PAIRS_FILE, boardDir = HERE, minPerSource = MIN_PER_SOURCE, perSourceCap = PER_SOURCE_CAP, examples: given } = {}) {
  const dir = resolveRun(runDir)
  const all = given ?? loadExamples({ pairsFile, boardDir })
  const counts = countBySource(all)
  const cands = loadCandidates(dir)
  const brief = readJson(join(dir, 'brief.json'), {})
  const work = join(dir, 'direction-board')
  const manifest = readJson(join(work, 'manifest.json'))
  const shot = (id, w) => { const f = stillOf(manifest, id, w); return f ? join(work, f) : null }
  const side = (c) => ({ desktop: shot(c.id, 1440), phone: shot(c.id, 375) })
  const raw = []
  for (let i = 0; i < cands.length; i++) for (let j = i + 1; j < cands.length; j++) {
    const [x, y] = [cands[i], cands[j]]
    raw.push({ a: x.id, b: y.id, aName: x.name, bName: y.name, sourceA: x.source, sourceB: y.source, shots: { a: side(x), b: side(y) }, qa: { a: qaOf(join(dir, x.id)), b: qaOf(join(dir, y.id)) } })
  }
  return {
    run: dir.split(/[\\/]/).pop(), archetype: brief.archetype ?? null, brief: brief.topic ?? null, minPerSource,
    sourceCounts: counts, predictable: predictableBy(counts, minPerSource),
    pairs: markPairs(raw, counts, minPerSource), examples: mixExamples(all, { perSourceCap }),
  }
}

/** 하나 빼기 묶음들: 예시 하나를 정답 없이 짝으로 내놓고, 나머지로 묶음을 만든다. → [{ held: { id, a, b, source, sources }, packet }] */
export function looPackets(examples, { minPerSource = MIN_PER_SOURCE, perSourceCap = PER_SOURCE_CAP } = {}) {
  return examples.map((h) => {
    const rest = examples.filter((e) => e.id !== h.id)
    const counts = countBySource(rest)
    const ok = predictableBy(counts, minPerSource)[h.source]
    const pair = { a: h.a, b: h.b, aName: h.a, bName: h.b, sourceA: h.sources[0], sourceB: h.sources[1], source: h.source, id: h.id, ...(h.view ? { view: h.view } : {}), predict: ok, ...(ok ? {} : { skip: skipReason(h.source, counts, minPerSource) }) }
    return { held: { id: h.id, a: h.a, b: h.b, source: h.source, sources: h.sources, origin: h.origin }, packet: { run: `loo:${h.id}`, archetype: h.archetype ?? null, brief: h.brief ?? null, minPerSource, sourceCounts: counts, predictable: predictableBy(counts, minPerSource), pairs: [pair], examples: mixExamples(rest, { perSourceCap }) } }
  })
}

// ── 예측 검사·채점 ─────────────────────────────────────────────────────────────────────────
const isAbstain = (p) => !p || p.winner === null || p.winner === undefined || p.winner === 'abstain'

/** 예측 파일 ↔ 묶음 맞춤: 예측할 짝은 빠짐없이(a|b 하나씩), 예측 안 할 짝은 winner null, winner 는 'a'|'b'. → 문제 목록(비면 맞다) */
export function validatePredictions(predictions, packet) {
  const problems = []
  const list = Array.isArray(predictions) ? predictions : predictions?.predictions
  if (!Array.isArray(list)) return ['predictions 배열이 없다']
  const seen = new Map()
  for (const p of list) {
    const k = pairKey(p)
    if (seen.has(k)) problems.push(`짝이 두 번 나온다: ${k}`)
    seen.set(k, p)
    if (!isAbstain(p) && p.winner !== 'a' && p.winner !== 'b') problems.push(`winner 는 "a"·"b"·null 이다: ${k} = ${JSON.stringify(p.winner)}`)
  }
  for (const pr of packet.pairs) {
    const k = pairKey(pr)
    const p = seen.get(k)
    if (!p) { problems.push(`예측이 빠진 짝: ${k}`); continue }
    if (!pr.predict && !isAbstain(p)) problems.push(`예측하면 안 되는 짝인데 예측했다(${pr.skip}): ${k}`)
    if (pr.predict && isAbstain(p)) problems.push(`예측해야 하는 짝인데 비웠다: ${k}`)
  }
  const known = new Set(packet.pairs.map(pairKey))
  for (const k of seen.keys()) if (!known.has(k)) problems.push(`묶음에 없는 짝: ${k}`)
  return problems
}

/**
 * 채점. predictions = [{ id?, a, b, winner: 'a'|'b'|null }], heldOut = 예시들({ id?, a, b, winner, source }).
 * 예측 안 함(winner null·빠짐)은 맞고 틀림에서 빼고 coverage 로 따로 센다. 묶음에 없는 예측은 던진다(조용히 버리지 않는다).
 * → { total, answered, correct, abstained, coverage, overall(null = 예측한 것 0), enabled, bySource{ 출처: 일치율|null }, bySourceDetail{ 출처: { total, answered, correct, label } }, sourceEnabled{ 출처: bool } }
 */
export function scorePrescreen(predictions, heldOut, { thresholdPct = THRESHOLD_PCT, minAnswered = MIN_ANSWERED, minPerSource = MIN_PER_SOURCE } = {}) {
  const held = new Map(heldOut.map((h) => [pairKey(h), h]))
  if (held.size !== heldOut.length) throw new Error('채점 대상에 같은 짝(id 또는 a|b)이 두 번 있다')
  const preds = new Map()
  for (const p of predictions) {
    const k = pairKey(p)
    if (!held.has(k)) throw new Error(`채점 대상에 없는 예측: ${k}`)
    if (preds.has(k)) throw new Error(`같은 짝의 예측이 둘이다: ${k}`)
    preds.set(k, p)
  }
  const detail = Object.fromEntries(SOURCES.map((s) => [s, { total: 0, answered: 0, correct: 0 }]))
  for (const [k, h] of held) {
    const d = detail[h.source] ?? (detail[h.source] = { total: 0, answered: 0, correct: 0 })
    d.total++
    const p = preds.get(k)
    if (isAbstain(p)) continue
    d.answered++
    if (p.winner === h.winner) d.correct++
  }
  const sum = (f) => Object.values(detail).reduce((n, d) => n + d[f], 0)
  const total = sum('total'), answered = sum('answered'), correct = sum('correct')
  const enabled = answered >= minAnswered && correct * 100 >= answered * thresholdPct
  for (const d of Object.values(detail)) d.label = d.total === 0 ? ABSTAIN_LABEL : d.answered === 0 ? `${ABSTAIN_LABEL} (${d.total}쌍 모두 비움)` : `${d.correct}/${d.answered}`
  const bySource = Object.fromEntries(Object.entries(detail).map(([s, d]) => [s, d.answered ? d.correct / d.answered : null]))
  const sourceEnabled = Object.fromEntries(Object.entries(detail).map(([s, d]) => [s, enabled && d.answered >= minPerSource && d.correct * 100 >= d.answered * thresholdPct]))
  return { total, answered, correct, abstained: total - answered, coverage: total ? answered / total : 0, overall: answered ? correct / answered : null, enabled, thresholdPct, minAnswered, bySource, bySourceDetail: detail, sourceEnabled }
}

// ── 스위치·보드 ────────────────────────────────────────────────────────────────────────────
/** 측정 결과 파일(스위치). 없으면 꺼짐. */
export const loadScore = (file = SCORE_FILE) => readJson(file) ?? { enabled: false, reason: '측정 기록이 없다(prescreen-score.json 없음)' }

/** 짝별 예측 → 후보 하나(예측 승자). 모든 짝에 답이 있을 때만(하나라도 비면 null), 가장 많이 이긴 후보가 하나뿐일 때만. */
export function predictedWinner(predictions, candidateIds) {
  if (candidateIds.length < 2) return null
  const wins = Object.fromEntries(candidateIds.map((c) => [c, 0]))
  const expected = candidateIds.length * (candidateIds.length - 1) / 2
  const done = predictions.filter((p) => !isAbstain(p) && p.a in wins && p.b in wins)
  if (done.length !== expected) return null
  for (const p of done) wins[p.winner === 'a' ? p.a : p.b]++
  const top = Math.max(...Object.values(wins))
  const leaders = Object.keys(wins).filter((c) => wins[c] === top)
  return leaders.length === 1 ? leaders[0] : null
}

/**
 * 보드가 읽는 예선 상태. 꺼져 있으면 null(보드는 아무것도 보이지 않는다). 켜져 있고 실행 폴더에 prescreen.json 이 있으면
 * { winner(후보 id|null), rate, answered, reasons{ 후보|짝: 글 } }. 켜져 있어도 그 짝의 출처 묶음이 자기 일치율 85% 미만이면(sourceEnabled) 추천하지 않는다.
 */
export function loadRunPrescreen(runDir, { scoreFile = SCORE_FILE } = {}) {
  const score = loadScore(scoreFile)
  if (!score.enabled) return null
  const doc = readJson(join(runDir, PRESCREEN_FILE))
  if (!doc?.predictions) return null
  const cands = loadCandidates(runDir)
  const byId = new Map(cands.map((c) => [c.id, c]))
  const usable = doc.predictions.filter((p) => {
    const x = byId.get(p.a), y = byId.get(p.b)
    return x && y && score.sourceEnabled?.[pairSource(x.source, y.source)]
  })
  const winner = predictedWinner(usable, cands.map((c) => c.id))
  return { winner, rate: score.overall, answered: score.answered, reasons: Object.fromEntries(doc.predictions.filter((p) => p.reason).map((p) => [`${p.a}|${p.b}`, String(p.reason)])) }
}

// ── CLI ────────────────────────────────────────────────────────────────────────────────────
const pct = (x) => (x === null ? '—' : `${(x * 100).toFixed(1)}%`)
export function formatScore(s) {
  const lines = [`예선 일치율: ${pct(s.overall)} (${s.correct}/${s.answered}쌍 예측, 전체 ${s.total}쌍 중 ${s.abstained}쌍은 ${ABSTAIN_LABEL}) · 문턱 ${s.thresholdPct}% · 최소 ${s.minAnswered}쌍 → ${s.enabled ? '켜짐' : '꺼짐'}`]
  for (const [src, d] of Object.entries(s.bySourceDetail)) lines.push(`  ${src.padEnd(9)} ${d.label}${d.answered ? ` = ${pct(s.bySource[src])}` : ''}${s.sourceEnabled[src] ? ' · 추천 보임' : ''}`)
  return lines.join('\n')
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const argv = process.argv.slice(2)
  const flag = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv.splice(i, 2)[1] : undefined }
  const has = (k) => { const i = argv.indexOf(k); if (i >= 0) argv.splice(i, 1); return i >= 0 }
  const out = flag('--out'), heldFile = flag('--heldout'), note = flag('--note'), write = has('--write')
  const [cmd, ...rest] = argv
  const usage = () => { console.error('사용: prescreen.mjs packet <run> [--out f] | check <run|packet.json> <predictions.json> | loo-packets --out <폴더> | score <predictions.json> [--heldout f] [--note 글] [--write] | status'); process.exit(2) }
  try {
    if (cmd === 'packet') {
      if (!rest[0]) usage()
      const packet = prescreenPacket(rest[0])
      const file = out ?? join(resolveRun(rest[0]), 'prescreen-packet.json')
      writeFileSync(file, JSON.stringify(packet, null, 2) + '\n')
      console.log(`예선 자료 묶음: 짝 ${packet.pairs.length}개(예측 ${packet.pairs.filter((p) => p.predict).length}개) · 예시 ${packet.examples.length}개 · 출처별 ${JSON.stringify(packet.sourceCounts)} → ${file}`)
    } else if (cmd === 'check') {
      if (rest.length < 2) usage()
      const packet = rest[0].endsWith('.json') ? readJson(rest[0]) : prescreenPacket(rest[0])
      const problems = validatePredictions(readJson(rest[1]), packet)
      for (const p of problems) console.error(`문제: ${p}`)
      console.log(problems.length ? `예측 파일에 문제 ${problems.length}개` : `예측 파일이 묶음과 맞다(짝 ${packet.pairs.length}개)`)
      process.exit(problems.length ? 1 : 0)
    } else if (cmd === 'loo-packets') {
      if (!out) usage()
      const examples = loadExamples()
      const all = looPackets(examples)
      mkdirSync(out, { recursive: true })
      for (const { held, packet } of all) writeFileSync(join(out, `packet-${held.id.replace(/[^\w.-]+/g, '_')}.json`), JSON.stringify(packet, null, 2) + '\n')
      writeFileSync(join(out, 'heldout.json'), JSON.stringify(examples, null, 2) + '\n')
      console.log(`하나 빼기 묶음 ${all.length}개 → ${out} (heldout.json 은 정답 — 예측 에이전트에게 주지 않는다) · 출처별 ${JSON.stringify(countBySource(examples))}`)
    } else if (cmd === 'score') {
      if (!rest[0]) usage()
      const preds = readJson(rest[0])
      const heldOut = heldFile ? readJson(heldFile) : loadExamples()
      const s = scorePrescreen(Array.isArray(preds) ? preds : preds.predictions, heldOut)
      console.log(formatScore(s))
      if (write) {
        writeFileSync(SCORE_FILE, JSON.stringify({ measuredAt: new Date().toISOString().slice(0, 10), method: 'leave-one-out', predictionsFile: rest[0].replace(/\\/g, '/'), ...(note ? { note } : {}), ...s }, null, 2) + '\n')
        console.log(`스위치 기록: ${SCORE_FILE} → ${s.enabled ? '켜짐' : '꺼짐'}`)
      }
    } else if (cmd === 'status') {
      const s = loadScore()
      console.log(s.enabled ? `예선 켜짐 — 일치율 ${pct(s.overall)}(${s.correct}/${s.answered}쌍, ${s.measuredAt})` : `예선 꺼짐 — ${s.reason ?? `일치율 ${pct(s.overall)}(${s.correct}/${s.answered}쌍) — 문턱 ${THRESHOLD_PCT}%·최소 ${s.minAnswered}쌍`}`)
    } else usage()
  } catch (e) {
    console.error(`도구 실패: ${e.message}`)
    process.exit(1)
  }
}
