// 적중률 채점기와 출시 판정(설계 7.2). 시험 문장 묶음(jsonl)을 classify 에 넣고 「대략 분류」의 다섯 지표를 잰다.
//   시험 한 줄: { id, text, kind, expect, probe?, ctx? }   expect = Reading[](확정) | "ask"(모름이 정답) | { two: [Reading[], Reading[]] }
//   대표 읽기(lead) = 축 + 방향(색·글꼴은 값). 분류의 대표 읽기: 확정 = 첫 읽기 · 후보 둘 = 두 선택지 각각 · 근사 = 첫 후보.
//   그중 하나라도 정답 목록 안의 읽기(answerLeads)와 같으면 맞다 — 정답을 쓴 사람은 목록 순서를 중요도로 정하지 않았다(설계 7.2, 대표 2026-10-17).
//   합격선과 지표 이름은 gates.json 한 곳에서 정한다(GATES · REFERENCE; parseGates 가 검사). minSample 이 있는 지표는 분모가 그보다 작으면 참고로 돌린다. 지표(분모):
//     kindAgreement  = 분류 갈래가 정답 갈래와 같은 수 / 전체 n   (정답 갈래가 none 이면 확정하지 않을 때 맞다)
//     leadAgreement  = 대표 읽기가 맞은 수 / 정답에 읽기가 있는 수   (0건이면 0 — 못 잰 것을 합격으로 치지 않는다)
//     oppositeApply  = 확정한 읽기(확정의 읽기 전부)에 정답과 같은 축의 반대 방향이 있는 수 / 전체 n   (근사의 대표 읽기는 적용이 아니라 후보라 세지 않는다 — 그 틀림은 leadAgreement 가 잡는다)
//                      (상한 cap 은 그 방향의 반대쪽으로 쏠리라는 뜻이라 반대쪽으로 센다)
//                      (같은 정답 목록 안에 적용한 읽기와 똑같은 읽기가 있으면 반대가 아니다 — 정답이 [밝게 한 칸, 밝게 상한]이면 적용한 밝게 한 칸은 정답 그대로다)
//     unclassified   = 확정·후보 둘·근사 어느 것도 못 낸 수 / 정답에 읽기가 있는 수
//     twoHit         = 후보 둘 중 대표 읽기가 맞은 수 / 정답에 읽기가 있는 문장의 후보 둘 수   (정답이 ask 면 맞힐 대표 읽기가 없어 뺀다 · 0건이면 1 — 맞힐 것이 없는 것이지 틀린 것이 아니다)
//   참고 숫자(합격선 없음): leadFirst = 대표 읽기가 정답 목록의 첫 읽기(expectedLeads)와 같은 수 / 정답에 읽기가 있는 수 ·
//                           exactAgreement = 확정·후보 둘 선택지의 읽기 묶음이 정답과 축·방향·값·범위·cap 까지 같은 수 / 정답에 읽기가 있는 수 ·
//                           contentApply = 정답이 ask 인데 확정한 수 / 정답이 ask 인 수.
//   예문은 dev 묶음이다. dev 를 잴 때는 자기 id 의 줄을 예문에서 뺀다(leave-one-out) — holdout 은 id 가 달라 dev 전체가 예문이 된다.
//   출시 판정(--release): holdout.jsonl 이 holdoutMin(gates.json)줄 이상이고 holdout.review.json 의 verdicts 가 모든 id 에 있어야 잰다. 아니면 「검수 대기: N/M」 후 종료 2.
//   검수 판정(gates.json 의 verdicts: id·label·note·expect) 중 expect 가 "ask" 인 판정(「이건 물어봐야 함」)을 받은 문장은 정답을 "ask" 로 바꿔 잰다. 나머지 판정은 파일의 expect 를 그대로 쓴다.
//   출시 관문은 「Claude + 사전」(설계 7.2): --predictions <파일> 이면 classify 를 부르지 않고 예측 파일(predictions.mjs)을 같은 규칙으로 잰다 — 다섯 합격선을 모두 건다.
//   예측 없는 --set holdout·--release 는 사전 단독 관문이라 gates.json 의 lexiconOnly 지표만 합격선으로 걸고 나머지는 참고로 찍는다. dev 는 늘 다섯 모두(회귀 방지).
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { answerLeads, classify, examplesFrom, expectedLeads, listsOf } from '../classify.mjs'
import { loadLexicon } from '../lexicon.mjs'
import { loadSimilarConfig } from '../similar.mjs'
import { UNKNOWN, loadPredictions } from './predictions.mjs'

export const EVAL_DIR = dirname(fileURLToPath(import.meta.url))

/**
 * gates.json 검사. 합격선마다 min 또는 max 하나(숫자)·minSample 은 양의 정수, lexiconOnly 의 이름은 모두 합격선이어야 한다. 어긋나면 던진다.
 * minSample = 그 지표의 분모(score 의 sample)가 이보다 작으면 표본이 모자라 참고로만 찍고 합격선으로 걸지 않는다.
 */
export function parseGates(json) {
  const { gates = {}, lexiconOnly, reference, verdicts, holdoutMin } = json
  const bad = []
  if (!Object.keys(gates).length) bad.push('gates 가 비었다')
  for (const [k, g] of Object.entries(gates)) {
    const bounds = ['min', 'max'].filter((b) => g[b] !== undefined)
    if (bounds.length !== 1 || typeof g[bounds[0]] !== 'number') bad.push(`${k}: min 또는 max 중 하나만, 숫자로 있어야 한다`)
    if (g.minSample !== undefined && !(Number.isInteger(g.minSample) && g.minSample > 0)) bad.push(`${k}: minSample 은 양의 정수여야 한다`)
  }
  if (!Array.isArray(lexiconOnly)) bad.push('lexiconOnly 는 지표 이름 목록이어야 한다')
  else for (const k of lexiconOnly) if (!gates[k]) bad.push(`lexiconOnly 의 「${k}」는 gates 에 없다`)
  if (!Array.isArray(reference)) bad.push('reference 는 지표 이름 목록이어야 한다')
  if (!Number.isInteger(holdoutMin) || holdoutMin < 1) bad.push('holdoutMin 은 양의 정수여야 한다')
  if (!Array.isArray(verdicts) || !verdicts.length) bad.push('verdicts 는 판정 목록이어야 한다')
  else {
    const ids = verdicts.map((v) => v?.id)
    if (ids.some((id) => typeof id !== 'string' || !id) || new Set(ids).size !== ids.length) bad.push('verdicts 의 id 는 서로 다른 글자여야 한다')
    if (verdicts.some((v) => typeof v?.label !== 'string' || !v.label)) bad.push('verdicts 마다 label 이 있어야 한다')
    if (verdicts.filter((v) => v?.note === true).length !== 1) bad.push('note: true 인 판정이 정확히 하나여야 한다(메모를 받는 판정)')
    if (verdicts.some((v) => v?.expect !== undefined && v.expect !== 'ask')) bad.push('expect 는 「ask」만 쓴다(정답을 「물어봐야 함」으로 바꾸는 판정)')
  }
  if (bad.length) throw new Error(`gates.json 이 잘못됐다:\n- ${bad.join('\n- ')}`)
  return json
}

const { gates, lexiconOnly, reference, verdicts: verdictDefs, holdoutMin } = parseGates(JSON.parse(readFileSync(join(EVAL_DIR, 'gates.json'), 'utf8')))
export const GATES = Object.freeze(gates) // { 지표: { min } | { max } }
export const LEXICON_ONLY = Object.freeze(lexiconOnly) // 사전 단독 관문에서 합격선으로 거는 지표 이름
export const REFERENCE = Object.freeze(reference) // 합격선 없는 참고 지표 이름
export const OUT_DIR = join(EVAL_DIR, '..', '..', '..', 'out') // 만든 파일을 두는 곳(저장소 루트의 out/, git 이 무시한다)
export const HOLDOUT_MIN = holdoutMin // 시험 문장 최소 수(gates.json). review.mjs 도 이 상수를 쓴다
export const VERDICT_DEFS = Object.freeze(verdictDefs) // 검수 판정 { id, label, note?, expect? } (gates.json) — review.mjs 의 버튼 글자도 여기서 온다
export const VERDICTS = Object.freeze(verdictDefs.map((v) => v.id)) // 검수 판정으로 받는 값
export const DEV_SET = 'dev'
export const HOLDOUT_SET = 'holdout'
export const SETS = Object.freeze([DEV_SET, HOLDOUT_SET]) // --set 으로 고르는 묶음 이름
export const setFile = (set) => `${set}.jsonl` // 묶음의 시험 문장 파일 이름 — hints.mjs 도 이 이름을 쓴다
export const HOLDOUT_FILE = setFile(HOLDOUT_SET) // review.mjs 도 이 이름을 쓴다
export const REVIEW_FILE = `${HOLDOUT_SET}.review.json` // 대표 검수 결과 파일 이름
export const NOTE_VERDICT = verdictDefs.find((v) => v.note).id // 메모를 받는 판정(gates.json 에서 note: true)
const DEV_FILE = setFile(DEV_SET)

const keyOf = (r) => [r.axis, r.direction ?? '', r.value ?? '', r.scope ?? 'site', r.cap ? 1 : 0].join('|')
const setOf = (rs) => [...new Set((rs ?? []).map(keyOf))].sort().join('\n')
const sameLead = (a, b) => a.axis === b.axis && a.direction === b.direction && a.value === b.value

/** 읽기가 실제로 쏠리는 쪽. 상한(cap)은 그 방향의 반대쪽이다. 값 읽기(색조·글꼴)는 방향이 없어 null. */
function lean(r, lex) {
  if (r.direction === undefined) return null
  return r.cap ? lex.axes[r.axis].ends.find((e) => e !== r.direction) : r.direction
}

/** 두 읽기가 닿는 곳이 겹치는가. 사이트 전체는 어디와도 겹치고, 같은 종류의 다른 범위(제목·본문 / 히어로·푸터)는 서로 안 겹친다. 종류가 다르면(page·section) 포함할 수 있어 겹친다고 본다. */
function overlaps(a, b) {
  const [sa, sb] = [a.scope ?? 'site', b.scope ?? 'site']
  const kind = (s) => s.split(':')[0]
  return sa === sb || kind(sa) !== kind(sb)
}
const same = (a, b) => a.axis === b.axis && a.direction === b.direction && a.value === b.value && Boolean(a.cap) === Boolean(b.cap) && overlaps(a, b) // 축·방향(값)·상한 여부가 같고 닿는 곳이 겹친다
const opposes = (a, b, lex) => a.axis === b.axis && overlaps(a, b) && lean(a, lex) !== null && lean(b, lex) !== null && lean(a, lex) !== lean(b, lex)

/** 한 문장을 분류한다. 예문에서 자기 id 의 줄은 뺀다(leave-one-out) — holdout 은 id 가 달라 dev 전체가 예문이 된다. */
export const classifyCase = (c, lex, examples, cfg) => classify(c.text, lex, examples.filter((e) => e.id !== c.id), cfg)

/** 폴더의 dev.jsonl 로 만든 예문 묶음(없으면 빈 묶음). */
export const loadExamples = (dir) => (existsSync(join(dir, DEV_FILE)) ? examplesFrom(loadCases(join(dir, DEV_FILE))) : [])

/** 명령줄 옵션 값: `--set dev` → flagValue(args, '--set') = 'dev'. 옵션이 없으면 undefined. */
export const flagValue = (args, name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined)

/** 한 문장 판정. r = 분류 결과(classify 가 낸 것, 또는 예측 파일에서 바꾼 같은 모양) */
function judge(c, lex, r) {
  const want = answerLeads(c.expect)
  const firsts = expectedLeads(c.expect)
  const lists = listsOf(c.expect)
  const leads = r.result === 'two' ? r.options.map((o) => o.lead) : r.result === 'unknown' || r.lead === null ? [] : [r.lead] // 시안 비교 말(copyFrom)은 분류됨이지만 대표 읽기가 없다(lead null)
  const applied = r.result === 'confirmed' ? r.readings : [] // 적용한 읽기 = 확정한 읽기만(설계 7.2). 근사는 Claude 가 원문과 견주기 전의 후보라 적용이 아니다
  const optionReadings = r.result === 'confirmed' ? [r.readings] : r.result === 'two' ? r.options.map((o) => o.readings) : []
  return {
    status: r.result,
    hasReadings: want.length > 0,
    kindOk: r.kind === c.kind || ((c.kind === 'none' || c.expect === 'ask') && r.result !== 'confirmed'),
    leadOk: leads.some((l) => want.some((w) => sameLead(l, w))),
    leadFirstOk: leads.some((l) => firsts.some((w) => sameLead(l, w))),
    classified: r.result !== 'unknown',
    opposite: applied.some((a) => lists.some((l) => l.some((w) => opposes(a, w, lex)) && !l.some((w) => same(a, w)))),
    exact: optionReadings.some((rs) => lists.some((l) => setOf(rs) === setOf(l))),
    askRow: c.expect === 'ask',
  }
}

/** predictions(Map id → 결과)가 있으면 classify 대신 그것을 잰다. 예측이 없는 id 는 모름. */
export function score(cases, lex = loadLexicon(), { examples = [], cfg = loadSimilarConfig(), predictions } = {}) {
  const n = cases.length
  const t = { kind: 0, withReadings: 0, lead: 0, leadFirst: 0, opposite: 0, unclassified: 0, two: 0, twoHit: 0, exact: 0, askRows: 0, askConfirmed: 0 }
  const counts = { confirmed: 0, two: 0, near: 0, unknown: 0 }
  const misses = []
  for (const c of cases) {
    const j = judge(c, lex, predictions ? predictions.get(c.id) ?? UNKNOWN : classifyCase(c, lex, examples, cfg))
    counts[j.status]++
    if (j.kindOk) t.kind++
    if (j.hasReadings) {
      t.withReadings++
      if (j.leadOk) t.lead++
      if (j.leadFirstOk) t.leadFirst++
      if (!j.classified) t.unclassified++
      if (j.exact) t.exact++
    }
    if (j.opposite) t.opposite++
    if (j.status === 'two' && j.hasReadings) { t.two++; if (j.leadOk) t.twoHit++ }
    if (j.askRow) { t.askRows++; if (j.status === 'confirmed') t.askConfirmed++ }
    const why = [!j.kindOk && 'kind', j.hasReadings && !j.leadOk && 'lead', j.opposite && 'opposite'].filter(Boolean)
    if (why.length) misses.push({ id: c.id, text: c.text, why: why.join('+') })
  }
  const ratio = (a, b, empty = 0) => (b ? a / b : empty)
  return {
    n,
    kindAgreement: ratio(t.kind, n),
    leadAgreement: ratio(t.lead, t.withReadings),
    oppositeApply: ratio(t.opposite, n),
    unclassified: ratio(t.unclassified, t.withReadings),
    twoHit: ratio(t.twoHit, t.two, 1),
    leadFirst: ratio(t.leadFirst, t.withReadings),
    exactAgreement: ratio(t.exact, t.withReadings),
    contentApply: ratio(t.askConfirmed, t.askRows),
    sample: { kindAgreement: n, leadAgreement: t.withReadings, oppositeApply: n, unclassified: t.withReadings, twoHit: t.two }, // 합격선 지표마다 분모 — minSample 과 견준다
    counts,
    misses,
  }
}

/** 실제로 합격선으로 거는 지표 이름들. gated = 걸기로 한 이름(기본은 다섯 모두). minSample 이 있는 지표는 분모가 그보다 작으면 참고로 돌린다. */
export function activeGates(m, gated = Object.keys(GATES)) {
  return Object.entries(GATES).filter(([k, g]) => gated.includes(k) && !(g.minSample !== undefined && m.sample[k] < g.minSample)).map(([k]) => k)
}

/** 합격선 밑인 지표 이름들(activeGates 만 본다) */
export function failures(m, gated) {
  return activeGates(m, gated).filter((k) => (GATES[k].min !== undefined ? m[k] < GATES[k].min : m[k] > GATES[k].max))
}

export function loadCases(file) {
  return readFileSync(file, 'utf8').split(/\r?\n/).filter((l) => l.trim()).map((l) => JSON.parse(l))
}

const pct = (x) => `${(x * 100).toFixed(1)}%`

/**
 * CLI 본체(시험하기 쉽게 종료 코드를 돌려준다). args = process.argv 의 뒷부분.
 * opts: { dir: eval 폴더, lex, log }   --misses 를 주면 틀린 문장을 모두 찍는다.
 */
export function run(args, { dir: dir0 = EVAL_DIR, lex, log = console.log } = {}) {
  const dir = flagValue(args, '--dir') ?? dir0 // 시험용: 다른 폴더의 묶음을 읽는다
  const release = args.includes('--release')
  const set = release ? HOLDOUT_SET : flagValue(args, '--set') ?? DEV_SET
  if (!SETS.includes(set)) { log(`알 수 없는 --set: ${set} (${SETS.join('|')})`); return 2 }
  const file = join(dir, setFile(set))
  if (!existsSync(file)) {
    if (release) { log(`검수 대기: 0/${HOLDOUT_MIN}`); return 2 }
    log(`시험 파일이 없어요: ${file}`); return 2
  }
  let cases = loadCases(file)
  if (release) {
    const review = join(dir, REVIEW_FILE)
    const verdicts = existsSync(review) ? JSON.parse(readFileSync(review, 'utf8')).verdicts ?? {} : {}
    const valid = (c) => VERDICTS.includes(verdicts[c.id]?.verdict)
    const done = cases.filter(valid).length
    const total = Math.max(cases.length, HOLDOUT_MIN) // 분모는 최소 100 — 99줄 파일도 99/100
    if (cases.length < HOLDOUT_MIN || done < cases.length) {
      log(`검수 대기: ${done}/${total}`)
      const bad = cases.filter((c) => verdicts[c.id]?.verdict !== undefined && !valid(c)).map((c) => c.id)
      if (bad.length) log(`판정 값이 ${VERDICTS.join('|')} 가 아닌 문장: ${bad.join(', ')}`)
      return 2
    }
    const replaced = new Map(VERDICT_DEFS.filter((v) => v.expect !== undefined).map((v) => [v.id, v.expect])) // 정답을 바꾸는 판정(「이건 물어봐야 함」)
    cases = cases.map((c) => (replaced.has(verdicts[c.id].verdict) ? { ...c, expect: replaced.get(verdicts[c.id].verdict) } : c))
  }
  const lexicon = lex ?? loadLexicon()
  const predictionsFile = flagValue(args, '--predictions')
  let source = '' // 헤더에 찍는 입력 설명
  let m
  if (predictionsFile) {
    if (!existsSync(predictionsFile)) { log(`예측 파일이 없어요: ${predictionsFile}`); return 2 }
    const { predictions, problems } = loadPredictions(predictionsFile, new Set(cases.map((c) => c.id)), lexicon)
    if (problems.length) { log(`예측 파일에 고칠 곳이 ${problems.length}건 있어요:`); problems.forEach((p) => log(`  ${p}`)); return 2 }
    m = score(cases, lexicon, { predictions })
    source = `예측 ${predictions.size}줄`
  } else {
    const examples = loadExamples(dir)
    m = score(cases, lexicon, { examples })
    source = `예문 ${examples.length}줄`
  }
  const gated = !predictionsFile && set === HOLDOUT_SET ? LEXICON_ONLY : Object.keys(GATES) // 사전 단독 holdout 관문만 좁다
  const active = activeGates(m, gated)
  const bad = failures(m, gated)
  log(`[${set}] n=${m.n}  확정 ${m.counts.confirmed} · 후보 둘 ${m.counts.two} · 근사 ${m.counts.near} · 모름 ${m.counts.unknown}  (${source})`)
  for (const [k, g] of Object.entries(GATES)) {
    const up = g.min !== undefined
    const line = `${up ? '≥' : '≤'} ${pct(up ? g.min : g.max)}`
    const why = gated.includes(k) ? `표본 ${m.sample[k]} < ${g.minSample} · ` : '' // 걸기로 했는데 표본이 모자라 참고로 돌린 경우
    log(`  ${k.padEnd(14)} ${pct(m[k]).padStart(7)}  ${active.includes(k) ? `(합격선 ${line})  ${bad.includes(k) ? 'FAIL' : 'ok'}` : `(참고 · ${why}합격선 ${line})`}`)
  }
  for (const k of REFERENCE) log(`  ${k.padEnd(14)} ${pct(m[k]).padStart(7)}  (참고)`)
  if (args.includes('--misses')) for (const x of m.misses) log(`  miss ${x.id} [${x.why}]: ${x.text}`)
  return bad.length ? 1 : 0
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exitCode = run(process.argv.slice(2))
