// 찍어내기 CLI(P3-3 Task 14) — 한 줄 브리프 → 방향 3안 → 고른 안 완성 → 미리보기.
//   node factory/stamp/stamp.mjs --brief <file> [--run <dir>] [--until <step>] [--pick a|b|c] [--deploy-preview]
//   node factory/stamp/stamp.mjs --golden <id> | --all-golden [--run <dir>] [--until <step>]   (골든 세트 18 — factory/stamp/golden.mjs, 씨앗은 브리프 파일에 박혀 있다)
//   node factory/stamp/stamp.mjs --run <dir> --redraw-wider   (「너무 똑같아」 — 그 실행 폴더의 방향 3안을 지난번보다 더 넓게 다시 고르고 03~07 을 낡게 한다)
//
//   흐름: doctor --stage stamp → 01 방향 → 02 사이트맵 → 03 변형 → 04 문구 → 05 미디어 → 06 쪽 → (--pick 이면 법률 검토) → 07 관문 → 08 보드.
//   · --pick 이 없으면 3안 모두 08 까지 돌리고 보드 자료(08-board.json)를 낸다 — 법률 검토는 고른 안만 받으므로 「법률 검토 미완」이 보인다(§9 Q5 첫 개입).
//   · --pick c 면 02·03 은 3안이 함께 정한 그대로 두고, 04 부터는 고른 안 하나만 완성한다(둘째 개입 전까지). --deploy-preview 는 --pick 과 함께만 — 미리보기 배포만, 프로덕션은 없다.
//   · 단계는 <run>/<후보>/<단계>.json(J7)이다. 입력 해시가 같은 단계는 건너뛴다 — 죽었다 다시 돌리면 끝난 단계는 읽기만 한다.
//   · 문구·법률은 스크립트가 직접 LLM 을 부르지 않는다: 요청 파일을 내고 멈춘다(종료 3, 대기 파일 경로를 출력) → 에이전트가 쓴 뒤 같은 명령을 다시 돌린다.
//
//   종료 코드: 0 = 끝(요청한 단계까지) · 1 = 관문 실패 또는 도구 실패(<run>/stamp-summary.json 의 status 로 구분) · 2 = 인자 오류 · 3 = 사람·에이전트 입력 대기.
//     status: done · waiting · tool-failed(도구 예외·doctor·빌드·관문 도구) · gate-failed(--pick 한 안이 공개 불가 · 방향 3안을 못 채움) · bad-brief.
//     보드 실행(--pick 없음)에서는 공개 불가가 실패가 아니다(보드가 이유를 보인다) — 도구 실패만 1이다. --pick 실행에서는 그 안이 공개 불가이면 1이다.
//   실행 시간은 <run>/stamp-timings.json 에 단계마다 쌓인다(건너뛴 단계는 적지 않는다).
//   무거운 단계(06 next build · 07 서버·Chrome)는 실행 잠금 안에서 부른다 — 이 CLI 가 잠금을 잡지 않는다.
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { writePreviewUrl } from './deploy-preview.mjs'
import { STEP_NAMES, inputHash, openRun } from './run-dir.mjs'
import { pagesCodeKey } from './pages-key.mjs'
import { failMessage } from './fail-message.mjs'
import { isPendingReview } from '../legal/drafts.mjs'
import { askIn, grammar } from '../vocab/grammar.mjs'
import { MOCK_PREVIEW_NOTICE, splitBlockers, withMockPreviewBlocker } from './blocker-class.mjs'
import { REDRAW_FILES, markStale } from './revise-stale.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const EXIT = Object.freeze({ done: 0, fail: 1, args: 2, waiting: 3 })
export const PICKS = ['a', 'b', 'c']
export const COPY_GUIDE = 'factory/stamp/COPY.md'
export const LEGAL_GUIDE = 'factory/legal/AGENT.md'
export const MAX_SCREEN_ROUNDS = 5

export class UsageError extends Error {
  constructor(message) {
    super(message)
    this.name = 'UsageError'
  }
}

export const USAGE = '사용법: node factory/stamp/stamp.mjs (--brief <file> | --golden <id> | --all-golden) [--run <dir>] [--until <01..08>] [--pick a|b|c] [--deploy-preview]\n        node factory/stamp/stamp.mjs --run <dir> --pick a|b|c (--revise "<수정 요청>" [--explain] | --revise-readings "<읽기 JSON>" | --revise-pick <번호>:<안|none> | --revise-undo)   (수정 — factory/stamp/revise.mjs)\n        node factory/stamp/stamp.mjs --run <dir> --redraw-wider   (「너무 똑같아」 — 방향 3안을 더 넓게 다시 고른다)'

/** 단계 이름 「01」·「1」·「01-direction」 → 정식 이름. */
export function normalizeStep(v) {
  const s = String(v ?? '').trim()
  const found = STEP_NAMES.find((n) => n === s || n.slice(0, 2) === s.padStart(2, '0'))
  if (!found) throw new UsageError(`모르는 단계: ${JSON.stringify(v)} (${STEP_NAMES.join('·')})`)
  return found
}

export function parseArgs(argv) {
  const opts = { brief: null, run: null, until: null, pick: null, deployPreview: false, golden: null, allGolden: false }
  const take = (i, flag) => {
    const v = argv[i + 1]
    if (v === undefined || v.startsWith('--')) throw new UsageError(`${flag} 값이 없다`)
    return v
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--brief') opts.brief = take(i++, a)
    else if (a === '--run') opts.run = take(i++, a)
    else if (a === '--until') opts.until = normalizeStep(take(i++, a))
    else if (a === '--pick') {
      opts.pick = take(i++, a)
      if (!PICKS.includes(opts.pick)) throw new UsageError(`--pick 은 ${PICKS.join('|')} 중 하나다: ${JSON.stringify(opts.pick)}`)
    } else if (a === '--deploy-preview') opts.deployPreview = true
    else if (a === '--golden') opts.golden = take(i++, a)
    else if (a === '--all-golden') opts.allGolden = true
    else if (a === '--revise') opts.revise = take(i++, a)
    else if (a === '--revise-readings') opts.reviseReadings = take(i++, a)
    else if (a === '--explain') opts.explain = true
    else if (a === '--revise-undo') opts.reviseUndo = true
    else if (a === '--redraw-wider') opts.redrawWider = true
    else if (a === '--revise-pick') {
      const m = /^(\d+):([A-Za-z0-9_-]+)$/.exec(take(i++, a))
      if (!m) throw new UsageError(`--revise-pick 은 <번호>:<안> 모양이다(예: 1:v2): ${JSON.stringify(argv[i])}`)
      opts.revisePick = { index: Number(m[1]), id: m[2] }
    } else throw new UsageError(`모르는 인자: ${a}`)
  }
  if (opts.redrawWider) {
    // 「너무 똑같아」 — 이미 한 번 돈 실행 폴더의 방향 3안을 더 넓게 다시 고른다. 다른 모드와 함께 쓰지 않는다.
    if (!opts.run) throw new UsageError('--redraw-wider 는 --run <dir> 이 필요하다')
    if ([opts.brief, opts.golden, opts.allGolden, opts.until, opts.pick, opts.deployPreview, opts.revise != null, opts.reviseReadings != null, opts.revisePick, opts.reviseUndo, opts.explain].some(Boolean)) throw new UsageError('--redraw-wider 는 --run 과만 쓴다')
    return opts
  }
  if (opts.revise != null || opts.reviseReadings != null || opts.revisePick || opts.reviseUndo) {
    // 수정은 이미 06 까지 끝난 실행 폴더를 읽는다 — 브리프·골든이 필요 없다.
    if ([opts.revise != null, opts.reviseReadings != null, Boolean(opts.revisePick), Boolean(opts.reviseUndo)].filter(Boolean).length > 1) throw new UsageError('--revise · --revise-readings · --revise-pick · --revise-undo 는 하나만 쓴다(안을 만든 뒤에 고른다)')
    if (opts.explain && opts.revise == null) throw new UsageError('--explain 은 --revise "<수정 요청>" 과 함께만 쓴다')
    if (!opts.run) throw new UsageError('--revise / --revise-readings / --revise-pick / --revise-undo 는 --run <dir> 이 필요하다')
    if (!opts.pick) throw new UsageError('--revise / --revise-readings / --revise-pick / --revise-undo 는 --pick a|b|c 로 어느 안을 고칠지 알려야 한다')
    if (opts.brief || opts.golden || opts.allGolden || opts.deployPreview || opts.until) throw new UsageError('--revise / --revise-readings / --revise-pick / --revise-undo 는 --brief·--golden·--all-golden·--until·--deploy-preview 와 함께 쓰지 않는다')
    return opts
  }
  if (opts.explain) throw new UsageError('--explain 은 --revise "<수정 요청>" 과 함께만 쓴다')
  const sources = [opts.brief, opts.golden, opts.allGolden || null].filter(Boolean).length
  if (sources === 0) throw new UsageError('--brief <file> · --golden <id> · --all-golden 중 하나가 없다')
  if (sources > 1) throw new UsageError('--brief · --golden · --all-golden 은 하나만 쓴다')
  if (opts.allGolden && opts.pick) throw new UsageError('--all-golden 은 --pick 과 함께 쓰지 않는다(안 고르기는 브리프마다 따로)')
  if (opts.deployPreview && !opts.pick) throw new UsageError('--deploy-preview 는 --pick 과 함께만 쓴다(고른 안 하나만 배포한다)')
  return opts
}

const sha = (text) => createHash('sha256').update(text).digest('hex')
const writeAtomic = (file, text) => {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(`${file}.tmp`, text)
  renameSync(`${file}.tmp`, file)
}
const readJsonMaybe = (file) => {
  try { return JSON.parse(readFileSync(file, 'utf8')) } catch { return null }
}

export { isPendingReview } // 정의는 legal/drafts.mjs — 06 의 초안 낡음 검사와 같은 판정을 쓴다

/** 후보 폴더의 법정 쪽 검토 상태 — 초안·검토 파일 자리와 검토 파일 해시(06 입력에 넣는다: 검토가 끝나면 쪽 화면의 「초안」 안내가 사라져야 한다). */
export function legalState(runDir, candId, archetype) {
  const dir = join(runDir, candId, '07-qa', 'legal')
  const pages = (archetype?.legal?.pages ?? []).map((name) => {
    const draft = join(dir, `${name}.draft.json`)
    const review = join(dir, `${name}.review.json`)
    // 07-qa 가 검토 파일이 없는 쪽에 남기는 「검토 전」 자리 파일(pendingReview — 모든 조항 unverified)은 에이전트의 검토가 아니다 — 있어도 검토 대기다
    const text = existsSync(review) ? readFileSync(review, 'utf8') : null
    return { page: name, draft, review, hasDraft: existsSync(draft), reviewHash: text !== null && !isPendingReview(text) ? sha(text) : null }
  })
  return { pages, missing: pages.filter((p) => !p.reviewHash), hashes: Object.fromEntries(pages.map((p) => [p.page, p.reviewHash])) }
}

/**
 * 구획 더하기·빼기·순서 바꾸기(revise-structure.mjs)가 사이트맵을 바꾼 03 은 단계 파일에 그 사이트맵의 해시(revisedFor)를 적어 둔다.
 * 사이트맵이 바뀌면 03 의 입력 해시가 달라져 03 을 처음부터 다시 고르는데, 그러면 앞서 구획 수정으로 고른 안이 사라진다 — 해시가 지금 사이트맵과 맞으면 그 선택을 그대로 쓴다.
 */
export function revisedVariants(runDir, candId, sitemap) {
  const saved = readJsonMaybe(join(runDir, candId, '03-variants.json'))
  return saved && typeof saved.revisedFor === 'string' && saved.revisedFor === inputHash(sitemap) && 'data' in saved ? saved.data : null
}

const isMissingFactBlocker = (b) => /확인 필요 사실/.test(b)
const isLegalPendingBlocker = (b) => /법률 검토 미완/.test(b)

/**
 * 07 결과에서 「측정 못 함」(도구 실패)인 관문 id — 보드(boardData toolFailed)와 07 재측정 판단이 같은 목록을 쓴다.
 * 정보용 doctor 와 문턱 없는 ai-tell(경고만)은 세지 않는다.
 */
export function toolFailedGates(qa) {
  return (qa?.gates ?? []).filter((g) => g.toolFailure && g.tool !== 'doctor' && !(g.tool === 'ai-tell' && qa?.aiTell?.threshold == null)).map((g) => g.id)
}

/** 결선 보드가 읽는 후보 자료(08-board.json data) — 출처 배지·공개 불가 이유·법률 상태. 보드 도구(Task 12)는 이 모양을 그대로 읽는다. */
export function boardData({ cand, qa, pages, media, legal, mockPreview = false }) {
  const blockers = qa?.blockers ?? []
  const missingFacts = blockers.filter(isMissingFactBlocker).map((b) => b.replace(/^.*확인 필요 사실:\s*/, ''))
  const legalPending = blockers.some(isLegalPendingBlocker)
  const toolFailed = toolFailedGates(qa)
  // FV1 5.2(D19): 사유를 두 갈래로 센다 — 품질(공장이 고칠 것)이 먼저, 입력 대기(대표 자료·결정이 오면 풀림)가 뒤. 방향 보드 카드의 두 줄(품질 사유 N가지·입력 대기 N가지)과 같은 낱말이다.
  const kinds = splitBlockers(blockers)
  const blockerKinds = { input: kinds.input.length, quality: kinds.quality.length }
  const reasons = []
  if (blockerKinds.quality) reasons.push(`품질 사유 ${blockerKinds.quality}가지`)
  if (blockerKinds.input) reasons.push(`입력 대기 ${blockerKinds.input}가지`)
  return {
    candidate: cand.id, slot: cand.slot ?? null, source: cand.source ?? null, // 출처 배지: library=검증 · generated=생성 · brand=브랜드
    recipe: typeof cand.recipe === 'string' ? cand.recipe : cand.recipe?.id ?? null, preset: cand.preset ?? null, palette: cand.palette ?? null,
    fonts: cand.fonts ?? null, novelty: cand.novelty ?? null, why: cand.why ?? null, brand: cand.brand ?? null,
    publishable: qa ? qa.publishable === true : false,
    publishLabel: qa?.publishable ? '공개 가능' : `공개 불가${reasons.length ? `: ${reasons.join(' · ')}` : ''}`,
    blockers, blockerKinds, missingFacts, legalPending, toolFailed, warnings: qa?.warnings ?? [],
    legal: { reviewed: legal ? legal.missing.length === 0 && legal.pages.length > 0 : false, pages: legal?.pages.map((p) => p.page) ?? [] },
    routes: qa?.routes ?? pages?.routes ?? [], aiTell: qa?.aiTell ?? null,
    gates: (qa?.gates ?? []).map((g) => ({ id: g.id, verdict: g.verdict, exit: g.exit, toolFailure: g.toolFailure, seconds: g.seconds })),
    media: media ? { assets: media.assets, placeholders: media.placeholders, requests: media.requests } : null,
    qaSeconds: qa?.seconds ?? null, qaAt: qa?.finishedAt ?? null,
    siteDir: pages?.siteDir ? `${cand.id}/site` : null,
    // 수정으로 고른 블록이 06 에서 다른 변형으로 바뀐 곳(FIT-5) — 없으면 키도 없다
    ...(pages?.reviseFallbacks?.length ? { reviseFallbacks: pages.reviseFallbacks } : {}),
    // product 완성 후보의 미리보기 배포 — 인증·결제가 mock 이라는 표지(E6). 없으면 키도 없다.
    ...(mockPreview ? { mockNotice: MOCK_PREVIEW_NOTICE } : {}),
  }
}

/**
 * 실행 본체. deps 는 단계 함수 묶음이다(defaultDeps 가 진짜, 시험이 가짜로 바꿔 낀다).
 * @returns {Promise<{ code: number, summary: object, lines: string[] }>}
 */
export async function runStamp(opts, deps) {
  const lines = []
  const say = (s) => { lines.push(s); deps.say?.(s) }
  const runDir = resolve(opts.run ?? join(ROOT, '.tmp', 'stamp', basename(opts.brief).replace(/\.json$/i, '')))
  const now = deps.now ?? (() => new Date().toISOString())
  const summary = {
    kind: 'stamp-summary', version: 1, brief: resolve(opts.brief), run: runDir, mode: opts.pick ? 'complete' : 'board', pick: opts.pick ?? null, until: opts.until ?? null,
    exit: null, status: null, waiting: [], failures: [], candidates: [], updatedAt: null,
  }
  const finish = (code, status, extra = {}) => {
    Object.assign(summary, extra, { exit: code, status, updatedAt: now() })
    if (existsSync(runDir)) writeAtomic(join(runDir, 'stamp-summary.json'), JSON.stringify(summary, null, 2) + '\n')
    return { code, summary, lines }
  }

  // 0. 브리프·원형 — 틀리면 아무것도 돌리기 전에 종료 2.
  let brief, archetype
  try {
    brief = deps.loadBrief(opts.brief)
    archetype = await deps.loadArchetype(brief.archetype)
    if (!archetype) throw new Error(`원형을 모른다: ${brief.archetype}`)
  } catch (e) {
    say(`브리프 오류: ${e.message}`)
    return finish(EXIT.args, 'bad-brief', { failures: [{ stage: 'brief', message: e.message }] })
  }
  const seed = brief.seed ?? 0
  const untilIdx = opts.until ? STEP_NAMES.indexOf(opts.until) : null
  // product 완성 후보를 미리보기로 배포하는 실행인가(FINAL-WF E6) — 인증·결제가 mock 이라 공개 주소에서 실제 가입·결제가 안 된다.
  const mockPreview = !!(opts.pick && opts.deployPreview && archetype.completion === 'product')
  const reaches = (name) => untilIdx === null || STEP_NAMES.indexOf(name) <= untilIdx
  mkdirSync(runDir, { recursive: true })

  // 1. doctor — 키·도구가 실제로 도는지. 0 이 아니면 시작하지 않는다. 키가 **틀리면** 멈추고, 키가 **없으면** 미리보기 모드로 계속한다(D24 — 무엇이 꺼지는지 note 줄로 알린다.
  //    운영자가 없는 키도 막으려면 WF_REQUIRE_KEYS=1).
  const doc = await deps.doctor('stamp')
  for (const r of doc.results ?? []) {
    say(`doctor ${r.note ? 'note' : r.ok ? 'ok  ' : 'FAIL'} ${r.id} — ${r.message}`)
    if (r.note && r.messageEn) say(`doctor      ${r.id} — ${r.messageEn}`)
  }
  if (!doc.ok) return finish(EXIT.fail, 'tool-failed', { failures: [{ stage: 'doctor', message: 'doctor --stage stamp 실패 — 위 줄의 안내대로 고친 뒤 다시 돌린다' }] })

  const run = openRun(runDir)
  const timingsFile = join(runDir, 'stamp-timings.json')
  const timings = readJsonMaybe(timingsFile) ?? []
  const record = (cand, step, seconds, note) => {
    timings.push({ at: now(), cand, step, seconds, ...(note ? { note } : {}) })
    writeAtomic(timingsFile, JSON.stringify(timings, null, 2) + '\n')
    say(`[${cand}] ${step} ${seconds}초${note ? ` (${note})` : ''}`)
  }
  /** run.step 을 부르되, 실제로 만든 때만 걸린 시간을 적는다(건너뛴 단계는 조용히). */
  const step = async (cand, name, inputs, produce, opts) => {
    let ran = false
    const t0 = Date.now()
    const data = await run.step(cand, name, inputs, async () => { ran = true; return produce() }, opts)
    if (ran) record(cand, name, Math.round((Date.now() - t0) / 100) / 10)
    return data
  }
  const failures = []
  const tryEach = async (cands, stage, fn) => {
    for (const c of cands) {
      try { await fn(c) } catch (e) {
        const message = String(e?.message ?? e).split(/\r?\n/).slice(0, 6).join(' | ')
        failures.push({ stage, cand: c.id, message })
        say(`[${c.id}] ${stage} 실패 — ${message}`)
      }
    }
    return failures.length === 0
  }
  const stop = () => finish(EXIT.fail, 'tool-failed', { failures })
  const weights = deps.weights?.() ?? []

  // 2. 01 방향 3안 — 탈락 후보(lint 등 컴파일 관문)는 같은 칸의 다음 순위로 채운다(Review Focus 2). 끝까지 모자라면 종료 1, 이유를 남긴다.
  const state = {}
  let cands
  try {
    // 넓혀 다시 고른 실행 폴더(--redraw-wider)는 그 넓이가 directions.json 에 남아, 다음 평소 실행도 같은 넓이로 01 을 본다 — 아니면 평소 실행이 넓힌 3안을 되돌린다.
    // 넓이가 있을 때만 01 입력 해시에 들어간다(그래서 넓히면 01 이 새로 만들어지고, 넓힌 적 없는 실행의 해시는 예전 그대로다).
    const minAxes = opts.minAxes ?? readJsonMaybe(join(runDir, 'directions.json'))?.minAxes
    const wider = minAxes ? { minAxes } : {}
    const dirInputs = { brief, archetype: brief.archetype, seed, weights, ...wider }
    let all = null
    const compute = async () => {
      if (all) return all
      const exclude = []
      const rejected = []
      for (let round = 1; round <= MAX_SCREEN_ROUNDS; round++) {
        const picked = await deps.directions({ brief, archetype, seed, exclude, ...wider })
        rejected.push(...(picked.rejected ?? []))
        const bad = []
        for (const c of picked.candidates) {
          try { await deps.screen({ runDir, cand: c }) } catch (e) {
            if (!e?.reasons) throw e
            bad.push({ cand: c, reasons: e.reasons })
          }
        }
        if (!bad.length) return (all = { candidates: picked.candidates, rejected })
        for (const b of bad) {
          const key = typeof b.cand.recipe === 'object' ? b.cand.recipe.id : null
          rejected.push({ id: `screen:${b.cand.id}`, reasons: b.reasons })
          if (b.cand.source !== 'generated' || !key) throw Object.assign(new Error(`후보 ${b.cand.id}(${b.cand.source}) 컴파일 관문 탈락 — ${b.reasons.join(' · ')}`), { rejected })
          exclude.push({ id: key, reasons: b.reasons.map((r) => `screen:${r}`) })
        }
      }
      throw Object.assign(new Error(`방향 3안을 ${MAX_SCREEN_ROUNDS}번 다시 골라도 컴파일 관문을 못 넘었다 — ${rejected.filter((r) => r.id.startsWith('screen:')).map((r) => `${r.id}(${r.reasons.join(', ')})`).join(' · ')}`), { rejected })
    }
    cands = []
    for (let i = 0; i < PICKS.length; i++) {
      const id = PICKS[i]
      const data = await step(id, '01-direction', dirInputs, async () => (await compute()).candidates[i])
      cands.push(data)
    }
    if (all) writeAtomic(join(runDir, 'directions.json'), JSON.stringify({ seed, ...wider, rejected: all.rejected }, null, 2) + '\n')
  } catch (e) {
    const rejected = e.rejected ?? []
    say(`방향 3안을 채우지 못했다 — ${e.message}`)
    for (const r of rejected) say(`  탈락 ${r.id}: ${r.reasons.join(', ')}`)
    return finish(EXIT.fail, e.rejected ? 'gate-failed' : 'tool-failed', { failures: [{ stage: '01-direction', message: e.message, rejected }] })
  }
  const active = opts.pick ? cands.filter((c) => c.id === opts.pick) : cands
  if (opts.pick && !active.length) return finish(EXIT.args, 'bad-brief', { failures: [{ stage: 'pick', message: `--pick ${opts.pick} 후보가 없다` }] })
  const setCandidates = () => {
    summary.candidates = cands.map((c) => ({
      id: c.id, slot: c.slot, source: c.source, active: active.includes(c),
      publishable: state[c.id]?.qa ? state[c.id].qa.publishable === true : null,
      blockers: state[c.id]?.qa?.blockers ?? [],
      previewUrl: state[c.id]?.previewUrl ?? null,
    }))
  }
  const done = () => { setCandidates(); return {} }
  const halt = (status, code) => { setCandidates(); return finish(code, status, { failures, waiting: summary.waiting }) }
  if (!reaches('02-sitemap')) return finish(EXIT.done, 'done', done('01'))

  // 3. 02 사이트맵 · 03 변형 — 3안이 함께 골라야 서로 다르므로 pick 이어도 3안 모두 한다(보드 실행의 결과와 같아야 04 부터 이어진다).
  if (!(await tryEach(cands, '02-sitemap', async (c) => {
    const inputs = { archetype, brief }
    state[c.id] = { cand: c }
    state[c.id].sitemap = await step(c.id, '02-sitemap', inputs, () => deps.sitemap({ archetype, brief }))
    deps.afterSitemap?.({ runDir, cand: c, sitemap: state[c.id].sitemap })
  }))) return stop()
  if (!reaches('03-variants')) return finish(EXIT.done, 'done', done('02'))
  {
    // 사이트맵은 후보 셋이 같다고 보고 첫 후보의 것으로 3안을 함께 고른다. 구획 수정(revise-structure.mjs)이 한 후보의 사이트맵을 바꿨으면 바뀌지 않은 후보의 것을 쓴다 — 그래야 나머지 후보의 03 이 다시 돌지 않는다.
    const sitemap = state[(cands.find((c) => revisedVariants(runDir, c.id, state[c.id].sitemap) === null) ?? cands[0]).id].sitemap
    let all
    const compute = async () => (all ??= await deps.variants({ sitemap, archetype, candidates: cands, seed, weights, brief, ...(brief.prefer ? { prefer: brief.prefer } : {}) }))
    // 누설 예측 열쇠(EXLEAK): 03 이 피하는 변형 표가 바뀌면(06 binder·블록 예시가 바뀌면) 입력이 같아도 03 을 다시 돈다. 열쇠가 없는 묶음(가짜 단계)은 옛 입력 모양 그대로.
    const leaks = deps.variantsKey ? await deps.variantsKey({ sitemap, brief }) : null
    // 선택 학습(factory v1 4.4)의 가중치는 입력 해시에 넣지 않는다: 학습은 새로 시작하는 실행에 쓰이고, 이미 끝난 03(구획 수정으로 고른 안 포함)은 학습이 늘어도 다시 돌지 않는다.
    const shared = { sitemap, seed, weights, candidates: cands.map((c) => ({ id: c.id, recipe: c.recipe })), ...(leaks ? { leaks } : {}), ...(brief.prefer ? { prefer: brief.prefer } : {}) }
    if (!(await tryEach(cands, '03-variants', async (c) => {
      state[c.id].variants = revisedVariants(runDir, c.id, state[c.id].sitemap) ?? await step(c.id, '03-variants', shared, async () => (await compute())[c.id])
    }))) return stop()
  }
  if (!reaches('04-content')) return finish(EXIT.done, 'done', done('03'))

  // 4. 04 문구 — 에이전트가 쓴다. 요청 파일을 내고 끝나지 않은 후보가 하나라도 있으면 종료 3.
  const waiting = []
  if (!(await tryEach(active, '04-content', async (c) => {
    const s = state[c.id]
    const r = await deps.content({ run, cand: c, sitemap: s.sitemap, variants: s.variants, seed, archetype, brief })
    if (r.status === 'ok') { s.content = r.content; return }
    waiting.push({ stage: '04-content', cand: c.id, status: r.status, file: r.requestFile, output: join(runDir, c.id, '04-content.json'), guide: COPY_GUIDE, ...(r.problems?.length ? { problems: r.problems } : {}) })
  }))) return stop()
  if (waiting.length) {
    summary.waiting = waiting
    for (const w of waiting) {
      say(`대기: 04-content ${w.cand} (${w.status}) — 요청 파일 ${w.file}`)
      say(`  → 문구 에이전트가 ${COPY_GUIDE} 대로 ${w.output} 을 쓴다. 검사: node factory/stamp/content.mjs --check ${w.file} ${w.output}`)
      for (const p of w.problems ?? []) say(`  문제 ${p}`)
    }
    say('끝나면 같은 명령을 다시 돌린다(끝난 단계는 건너뛴다).')
    return halt('waiting', EXIT.waiting)
  }
  if (!reaches('05-media')) return finish(EXIT.done, 'done', done('04'))

  // 5. 05 미디어
  if (!(await tryEach(active, '05-media', async (c) => {
    const s = state[c.id]
    // variants: 고른 블록의 meta.media(video·stills)가 칸의 모양을 정한다. WF_MEDIA_PREVIEW=1(보드 미리보기 전용)은 입력 해시에도 들어 두 모드의 결과가 섞이지 않는다.
    const preview = process.env.WF_MEDIA_PREVIEW === '1'
    s.media = await step(c.id, '05-media', { cand: c, content: s.content, sitemap: s.sitemap, variants: s.variants, topic: brief.topic, ...(preview ? { preview } : {}) }, () => deps.media({ runDir, cand: c, archetype, content: s.content, sitemap: s.sitemap, variants: s.variants, preview, topic: brief.topic }))
  }))) return stop()
  if (!reaches('06-pages')) return finish(EXIT.done, 'done', done('05'))

  // 6. 06 쪽 — next build(실행 잠금 안에서). 검토 파일이 있으면 해시가 입력에 들어가 검토 뒤에 다시 만든다.
  if (!(await tryEach(active, '06-pages', async (c) => {
    const s = state[c.id]
    s.legal = legalState(runDir, c.id, archetype)
    // 코드 열쇠(C314): 입력이 같아도 블록·템플릿·06 코드가 바뀌면 06 을 다시 만든다. 열쇠가 없는 묶음(가짜 단계)은 옛 입력 모양 그대로.
    const code = deps.pagesKey ? await deps.pagesKey() : null
    s.pages = await step(c.id, '06-pages', { cand: c, sitemap: s.sitemap, variants: s.variants, content: s.content, media: s.media, legal: s.legal.hashes, ...(code ? { code } : {}) }, () => deps.pages({ runDir, cand: c }))
  }))) return stop()
  if (!reaches('07-qa')) return finish(EXIT.done, 'done', done('06'))

  // 7. 법률 검토(--pick 한 안만) → 07 관문. 검토 파일은 06 이 초안을 쓴 뒤에 에이전트가 쓴다.
  if (opts.pick) {
    const legalWaiting = []
    for (const c of active) {
      const s = state[c.id]
      s.legal = legalState(runDir, c.id, archetype)
      if (s.legal.missing.length) legalWaiting.push({ stage: 'legal', cand: c.id, status: 'needs-review', files: s.legal.missing.map((p) => p.draft), outputs: s.legal.missing.map((p) => p.review), guide: LEGAL_GUIDE })
    }
    if (legalWaiting.length) {
      summary.waiting = legalWaiting
      for (const w of legalWaiting) {
        for (const f of w.files) say(`대기: 법률 검토 ${w.cand} — 초안 ${f}`)
        say(`  → 법률 에이전트가 ${LEGAL_GUIDE} 대로 쪽마다 ${w.outputs.map((o) => basename(o)).join('·')} 을 07-qa/legal/ 에 쓴다.`)
      }
      say('끝나면 같은 명령을 다시 돌린다(06 이 검토 결과를 넣어 다시 만들고 07 이 재본다).')
      return halt('waiting', EXIT.waiting)
    }
  }
  if (!(await tryEach(active, '07-qa', async (c) => {
    const s = state[c.id]
    const qaInputs = { pages: s.pages, legal: s.legal.hashes }
    // 07 이 「측정 못 함」(도구 실패)으로 끝난 채 남아 있으면 입력이 같아도 다시 잰다(FIT-6) — 도구 실패는 입력 탓이 아니라 그때 PC 형편 탓이라 캐시가 거짓이 된다.
    // 판정 실패(측정은 했다)는 입력이 같으면 그대로다. 타임아웃 환경 변수(WF_NAV_TIMEOUT_MS·WF_CDP_TIMEOUT_MS)를 올려 같은 명령을 다시 돌리는 길이 이것이다.
    const prev = readJsonMaybe(join(runDir, c.id, '07-qa.json'))
    const prevFailed = prev && prev.inputHash === inputHash(qaInputs) ? toolFailedGates(prev.data) : []
    if (prevFailed.length) say(`[${c.id}] 07-qa 지난 실행에 측정 못 함 ${prevFailed.length}건(${prevFailed.slice(0, 3).join(' · ')}${prevFailed.length > 3 ? ' …' : ''}) — 07 을 다시 잰다`)
    s.qa = await step(c.id, '07-qa', qaInputs, () => deps.qa({ runDir, cand: c }), { refresh: prevFailed.length > 0 })
    // product 완성(saas·pwa)을 미리보기로 배포하면 공개 주소에서 실제 가입·결제가 안 된다 — 품질 사유로 더한다(E6). 단계 파일은 건드리지 않는다.
    if (mockPreview) { s.qa = withMockPreviewBlocker(s.qa); say(`[${c.id}] 미리보기 주의 — ${MOCK_PREVIEW_NOTICE}`) }
  }))) return stop()
  if (!reaches('08-board')) return finish(EXIT.done, 'done', done('07'))

  // 8. 08 보드 자료 → (--deploy-preview) 미리보기 배포. 배포 주소는 08-board.json 의 previewUrl 에 합쳐 적힌다.
  if (!(await tryEach(active, '08-board', async (c) => {
    const s = state[c.id]
    await step(c.id, '08-board', { qa: s.qa, cand: c, media: s.media, legal: s.legal.hashes }, async () => boardData({ cand: c, qa: s.qa, pages: s.pages, media: s.media, legal: s.legal, mockPreview }))
  }))) return stop()
  if (opts.pick && opts.deployPreview) {
    const c = active[0]
    const boardFile = join(runDir, c.id, '08-board.json')
    const cur = readJsonMaybe(boardFile)?.data?.previewUrl
    if (cur) { state[c.id].previewUrl = cur; say(`[${c.id}] 미리보기 배포는 이미 있다 — ${cur}`) } else {
      await tryEach([c], 'deploy-preview', async () => {
        const t0 = Date.now()
        const r = await deps.deploy(join(runDir, c.id, 'site'))
        writePreviewUrl(join(runDir, c.id), r.url) // 08-board.json data.previewUrl 에 합쳐 적는다(이미 적혔으면 같은 값)
        state[c.id].previewUrl = r.url
        record(c.id, 'deploy-preview', Math.round((Date.now() - t0) / 100) / 10, r.url)
      })
      if (failures.length) return stop()
    }
  }
  for (const c of active) if (state[c.id].previewUrl === undefined) state[c.id].previewUrl = readJsonMaybe(join(runDir, c.id, '08-board.json'))?.data?.previewUrl ?? null

  // 9. 판정. 관문 도구 실패는 어느 모드에서나 1, 공개 불가는 --pick 실행에서만 1(보드 실행은 이유를 보여 주는 것이 일이다).
  const toolFailed = active.flatMap((c) => {
    const d = readJsonMaybe(join(runDir, c.id, '08-board.json'))?.data
    return (d?.toolFailed ?? []).map((g) => ({ stage: '07-qa', cand: c.id, message: `관문 도구 실패(측정 못 함): ${g}` }))
  })
  setCandidates()
  for (const c of summary.candidates.filter((x) => x.active)) say(`[${c.id}] ${c.publishable ? '공개 가능' : `공개 불가 — blockers ${c.blockers.length}건`}${c.previewUrl ? ` · 미리보기 ${c.previewUrl}` : ''}`)
  if (toolFailed.length) {
    say(`관문 도구 실패(측정 못 함) ${toolFailed.length}건 — 같은 명령을 다시 돌리면 07 을 다시 잰다(느린 PC 는 WF_NAV_TIMEOUT_MS·WF_CDP_TIMEOUT_MS 를 늘린 뒤)`)
    return finish(EXIT.fail, 'tool-failed', { failures: [...failures, ...toolFailed] })
  }
  if (opts.pick && state[active[0].id].qa?.publishable !== true) return finish(EXIT.fail, 'gate-failed', { failures })
  return finish(EXIT.done, 'done', { failures })
}

// ── 진짜 단계 함수 묶음 ───────────────────────────────────────────────
/** preferences: false 면 선택 학습을 읽지 않는다(골든 세트는 씨앗·사용자 기록과 상관없이 같은 결과여야 한다). */
export async function defaultDeps({ say = console.log, preferences = true } = {}) {
  const objectMod = await import('./object-media.mjs')
  const [doctor, briefMod, archMod, dirMod, compileMod, sitemapMod, variantsMod, contentMod, uiCopyMod, mediaMod, pagesMod, qaMod, deployMod, presetsMod] = await Promise.all([
    import('../doctor.mjs'), import('./brief.mjs'), import('../scripts/archetypes.mjs'), import('./directions.mjs'), import('./compile-candidate.mjs'),
    import('./sitemap.mjs'), import('./variants.mjs'), import('./content.mjs'), import('./ui-copy.mjs'), import('./media.mjs'), import('./gen-pages.mjs'), import('./qa.mjs'),
    import('./deploy-preview.mjs'), import('../scripts/style-presets.mjs'),
  ])
  let archetypes = null
  const prefMod = preferences ? await import('../board/preferences.mjs') : null
  const prefs = prefMod ? prefMod.loadPreferences() : null
  for (const w of prefs?.warnings ?? []) say(`선택 학습 경고: ${w}`)
  const blockNames = (sitemap) => [...new Set([...sitemap.pages.flatMap((p) => p.sections), ...(sitemap.globals ?? [])].filter((s) => s.status === 'block').flatMap((s) => s.allowedVariants))]
  return {
    say,
    doctor: (stage) => doctor.runDoctor(stage, { strict: doctor.strictFromEnv() }),
    loadBrief: (file) => briefMod.loadBrief(file),
    loadArchetype: async (id) => (archetypes ??= await archMod.loadArchetypes())[id],
    weights: () => dirMod.loadWeights(),
    directions: (args) => dirMod.pickDirections(args),
    screen: ({ runDir, cand }) => compileMod.compileCandidate(cand, runDir),
    sitemap: ({ archetype, brief }) => sitemapMod.buildSitemap(archetype, brief),
    afterSitemap: ({ runDir, cand, sitemap }) => sitemapMod.writeCandidateBlockers(runDir, cand.id, sitemap),
    variants: async ({ sitemap, archetype, candidates, seed, weights, prefer, brief }) => {
      // 3D 오브젝트 히어로는 재료(Higgsfield 폴더 또는 Codex 이미지 생성)가 없는 사용자에게는 못 채우는 변형이다 — 다른 변형이 있으면 고르지 않는다(object-media.mjs).
      const readiness = objectMod.applyObjectReadiness(await uiCopyMod.readinessTable(blockNames(sitemap)), await objectMod.objectMediaTools(), { archetype, sitemap })
      // 업종에 맞지 않는 블록(돌봄·의료의 세로쓰기 히어로)도 못 채우는 변형과 같은 길로 뒤로 민다 — 다른 변형이 있으면 고르지 않는다(variants.mjs unfitBlocks)
      for (const b of variantsMod.unfitBlocks(brief)) readiness.set(b, Math.max(2, readiness.get(b) ?? 0))
      const leaks = await uiCopyMod.leakTable(sitemap)
      return variantsMod.chooseVariants(sitemap, candidates.map((c) => ({ id: c.id, recipe: c.recipe })), { seed, weights: weights.filter((w) => w.scope === 'block'), readiness, leaks, ...(prefer ? { prefer } : {}), ...(prefs ? { preferences: prefs } : {}) })
    },
    // 03 입력 해시에 든다 — 업종에 맞지 않는 블록 목록도 넣어, 브리프의 업종이 바뀌면 03 이 다시 돈다
    variantsKey: async ({ sitemap, brief }) => [...(await uiCopyMod.leakTable(sitemap))].sort().concat([...variantsMod.unfitBlocks(brief)].map((b) => `unfit:${b}`)),
    content: async ({ run, cand, sitemap, variants, seed, archetype, brief }) => {
      const uiSlots = await uiCopyMod.uiSlotTable(Object.values(variants), { locale: brief.locale })
      return contentMod.runContentStage(run, cand, sitemap, variants, seed, { archetype, brief, uiSlots })
    },
    media: async ({ runDir, cand, archetype, content, sitemap, variants, preview, topic }) => {
      const head = typeof cand.recipe === 'object' ? cand.recipe : presetsMod.loadLibrary().find((r) => r.id === cand.recipe)
      const plan = mediaMod.mediaPlan(archetype, content, { ...cand, head }, { sitemap, variants, preview, topic })
      const out = join(runDir, cand.id, '05-media')
      mkdirSync(out, { recursive: true })
      // Pexels 키가 없고 엄격 모드(WF_REQUIRE_KEYS=1)도 아니면 스톡 칸은 「이미지 준비 중」 틀로 두고 계속한다(D24 미리보기 모드).
      const r = await mediaMod.fetchMedia(plan, out, { pexelsOptional: !doctor.strictFromEnv(), locale: content?.locale === 'en' ? 'en' : 'ko' })
      return { plan: plan.length, assets: r.manifest.assets.length, placeholders: r.manifest.placeholders.length, requests: r.requests.length, credits: r.credits.length, ...(preview ? { preview } : {}), ...(r.hyperframesRequests?.length ? { hyperframesRequests: r.hyperframesRequests.length } : {}) }
    },
    pages: async ({ runDir, cand }) => {
      // 첫 실행은 템플릿 설치(npm ci)로 오래 걸린다(실측 W1b: 첫 후보 06 22.6분, 이어지는 후보 10~16분) — 조용히 기다리는 것처럼 보이지 않게 시작 때 한 줄(FINAL-WF P4).
      say(`06 쪽 만들기 시작 — 첫 후보는 템플릿 설치까지 20분 안팎, 이어지는 후보는 10~15분 걸린다(PC가 느리거나 다른 일이 겹치면 더) · 로그: ${join(runDir, cand.id)}`)
      say(`06 building pages - the first run installs the site template and takes about 20 minutes for the first candidate and 10 to 15 for each next one (longer on a slow or busy PC) - logs: ${join(runDir, cand.id)}`)
      const r = await pagesMod.generateSite(runDir, cand, { install: true, build: true, log: (m) => say(`  ${m}`) })
      if (r.build && r.build.code !== 0) throw new Error(failMessage('next build', r.build.code, join(runDir, cand.id, 'build.log')))
      // 수정으로 고른 블록이 폴백으로 바뀌었으면(FIT-5) 06 단계 자료에 남겨 08 보드·요약이 읽는다 — 경고 한 줄은 generateSite 가 이미 log 로 냈다
      const reviseFallbacks = (r.reviseFallbacks ?? []).map(({ key, block, to, why, index }) => ({ key, block, to, why, index }))
      return { siteDir: r.siteDir, routes: r.routes, blockers: r.blockers.length, skipped: r.skipped.length, build: r.build ? { code: r.build.code, seconds: r.build.seconds } : null, builtAt: new Date().toISOString(), ...(reviseFallbacks.length ? { reviseFallbacks } : {}) }
    },
    pagesKey: () => pagesCodeKey(),
    qa: ({ runDir, cand }) => qaMod.runCandidateQa(runDir, cand, { log: (m) => say(`  ${m}`) }),
    deploy: (siteDir) => deployMod.deployPreview(siteDir, {}),
  }
}

/** --revise-readings 의 JSON → { input: { readings } | { options } | { copyFrom } } | { problems } (JSON 모양과 사전 기준 검사 — 예측 파일 모양 choices 도 받는다). */
async function readingsInputOf(json) {
  let raw
  try { raw = JSON.parse(json) } catch (e) { return { problems: [`JSON 을 읽지 못했다: ${e.message}`] } }
  const { designLexicon } = await import('./design-context.mjs')
  const { checkReadingsInput } = await import('../vocab/eval/predictions.mjs')
  const { isLiteralValue } = await import('./revise-values.mjs')
  const problems = checkReadingsInput(raw, designLexicon(), isLiteralValue)
  if (problems.length) return { problems }
  return { input: raw.copyFrom !== undefined ? { copyFrom: raw.copyFrom } : raw.readings ? { readings: raw.readings } : { options: raw.options ?? raw.choices } }
}

/** --explain 이 보이는 해석 한 줄 — 확정은 이해한 내용, 후보 둘은 두 해석, 근사·모름은 되묻는 말. 디자인이 아닌 요청(구획·문구·구조)은 앞에 갈래와 대상을 붙인다. */
function interpretation(request) {
  const c = request.classification
  const said = !c ? null : c.result === 'confirmed' ? c.say : c.result === 'two' ? c.options.map((o) => o.say).join(' / ') : c.ask
  return [request.scope === 'design' ? null : `${request.scope} ${request.target}`, said].filter(Boolean).join(' — ')
}

/** --explain 이 보이는 JSON — 디자인 말은 분류(result·readings …), 그 밖(구획·문구·구조)은 요청({ scope, target, intent … }) 전체. 구획 말은 요청 안에 classification.readings 가 들어 있다. */
const explained = (request) => (request.scope === 'design' ? request.classification : request)

/**
 * 수정 명령(factory v1 4.3) — `--revise "<요청>"`(`--explain` 이면 해석만) · `--revise-readings '<읽기 JSON>'` · `--revise-pick <번호>:<안>`(안 `none` = 둘 다 아니에요) · `--revise-undo`. 06 까지 끝난 실행 폴더가 필요하다(브리프·01~04 단계는 다시 돌지 않는다).
 * 종료: 0 안을 냈거나 골랐다 · 2 읽기 입력이 사전 기준에 안 맞는다 · 3 입력 대기(되묻기 · 되돌릴 수정 없음 · 둘 다 아니에요 · --explain · 문구 응답 대기 · 문구 응답 검사 실패 — 아무것도 바뀌지 않았다 · --revise-readings 가 판을 만든 뒤 고르기 대기) · 1 도구 실패.
 * revOpts: revise() 옵션(시험이 { install: false } 를 준다).
 */
export async function runReviseCommand(opts, { say = console.log, revOpts = {} } = {}) {
  const lines = []
  const out = (s) => { lines.push(s); say(s) }
  const runDir = resolve(opts.run)
  const cmd = `npm run stamp -- --run ${runDir} --pick ${opts.pick}`
  try {
    const mod = await import('./revise.mjs')
    if (opts.reviseUndo) {
      const { undoLast } = await import('./revise-history.mjs')
      const r = undoLast(runDir, opts.pick)
      if (r.none) { out(askIn(grammar.text.nothingToUndo)); return { code: EXIT.waiting, lines } }
      const t = grammar.text
      out(`[${opts.pick}] ${askIn(t.undone, r.text)} (${askIn(t.undoneDetail, r.text).replace('{index}', r.index).replace('{count}', r.restored)})`)
      out(askIn(t.staleNote, r.text).replace('{stages}', mod.STALE_STAGES.join('·')))
      return { code: EXIT.done, lines, result: r }
    }
    if (opts.revisePick?.id === 'none') { // 둘 다 아니에요 — 아무것도 적용하지 않고 스킬이 C 갈래처럼 되묻게 한다
      const { pickNone } = await import('./revise-history.mjs')
      const r = pickNone(runDir, opts.pick, opts.revisePick.index)
      out(askIn(grammar.text.neitherAsk, r.text))
      return { code: EXIT.waiting, lines, result: r }
    }
    if (opts.revisePick) {
      const r = await mod.applyRevision(runDir, opts.pick, opts.revisePick.index, opts.revisePick.id)
      if (r.outdated) { // 안을 만든 뒤 사이트가 바뀌었다 — 아무것도 바꾸지 않았다
        out(askIn(grammar.text.ask.boardStale, r.text))
        return { code: EXIT.waiting, lines, result: r }
      }
      if (r.scope === 'design') {
        out(`[${opts.pick}] ${r.say} — 후보 레시피 머리를 바꿨다 (${r.recipe})`)
        for (const c of r.changes) out(`  ${c.axis}: ${c.from} → ${c.to}`)
      } else if (r.scope === 'copy') out(`[${opts.pick}] 문구 ${Object.keys(r.texts).length}칸을 바꿨다 (${Object.keys(r.texts).join(', ')})`)
      else if (r.scope === 'remove') out(`[${opts.pick}] ${r.target} 구획을 뺐다 (${r.pageOrder.before.join(' → ')} ⇒ ${r.pageOrder.after.join(' → ')})`)
      else if (r.scope === 'order') out(`[${opts.pick}] ${r.target} 구획의 자리를 옮겼다 (${r.pageOrder.before.join(' → ')} ⇒ ${r.pageOrder.after.join(' → ')})`)
      else if (r.scope === 'add') out(`[${opts.pick}] ${r.target} 구획을 더했다 → ${r.block} (${r.pageOrder.before.join(' → ')} ⇒ ${r.pageOrder.after.join(' → ')}; 학습에 기록: 진 변형 ${r.learned}개)`)
      else out(`[${opts.pick}] ${r.target} → ${r.block} 로 정했다 (학습에 기록: 진 변형 ${r.learned}개)`)
      out(`낡은 단계: ${r.stale.join('·')} (지금 사이트·관문 결과는 다음 찍어내기가 다시 만든다)`)
      for (const w of r.warnings ?? []) out(`주의: ${w}`)
      // 새 블록의 화면 문구 칸이 비어 있으면 입력 대기다 — 요청 파일 경로를 알리고 종료 3(찍어내기 04 대기와 같은 코드).
      if (r.waitingCopy) {
        out(`대기: 새 블록의 화면 문구 칸 요청 ${r.waitingCopy}`)
        out(`  → 문구 에이전트가 factory/stamp/COPY.md 대로 pendingSlots 를 채운 ${join(runDir, opts.pick, '04-content.json')} 을 쓴다. 끝나면 \`${cmd}\` 를 다시 돌린다.`)
        return { code: EXIT.waiting, lines, result: r }
      }
      out(`다음: ${r.next}`)
      return { code: EXIT.done, lines, result: r }
    }
    // 읽기를 직접 받으면 파일을 열기 전에 사전 기준으로 검사한다 — 틀리면 목록을 보이고 종료 2.
    const given = opts.reviseReadings == null ? null : await readingsInputOf(opts.reviseReadings)
    if (given?.problems) {
      out('읽기 입력이 틀렸다:')
      for (const p of given.problems) out(`  문제 ${p}`)
      return { code: EXIT.args, lines, problems: given.problems }
    }
    const siteFile = join(runDir, opts.pick, 'site', 'content', 'site.json')
    if (!existsSync(siteFile)) throw new Error(`사이트(06-pages)가 없다: ${siteFile} — 먼저 \`${cmd} --until 06\``)
    const request = given ? { scope: 'design', input: given.input, text: null } : mod.parseRevision(opts.revise, JSON.parse(readFileSync(siteFile, 'utf8')), undefined, { candidates: PICKS })
    if (request.ask) {
      out(`질문: ${request.ask}`)
      out('아무것도 바꾸지 않았다. 답을 넣어 같은 명령을 다시 돌린다.')
      return { code: EXIT.waiting, lines, ask: request.ask }
    }
    if (opts.explain) { // 해석만 보인다 — 파일은 바꾸지 않고, 사람이 맞는지 보고 이어 가도록 입력 대기(종료 3)로 끝낸다.
      out(JSON.stringify(explained(request), null, 2))
      out(`해석: ${interpretation(request)}`)
      return { code: EXIT.waiting, lines, explain: true, request }
    }
    const r = await mod.revise(runDir, opts.pick, request, { log: (m) => out(`  ${m}`), ...revOpts })
    if (r.ask) {
      out(`질문: ${r.ask}`)
      out('아무것도 바꾸지 않았다. 답을 넣어 같은 명령을 다시 돌린다.')
      return { code: EXIT.waiting, lines, ask: r.ask }
    }
    for (const board of r.boards ?? [r]) { // 쪽 범위 읽기는 구획마다 판이 따로다
      for (const n of board.notes ?? []) out(`참고: ${n}`)
      if (board.status === 'waiting-copy') {
        out(`대기: 문구 수정 요청 ${board.waiting.requestFile}`)
        out(`  → 문구 에이전트가 factory/stamp/COPY.md 대로 ${board.waiting.output} 을 쓴다. 끝나면 같은 명령을 다시 돌린다.`)
        return { code: EXIT.waiting, lines, result: board }
      }
      if (board.status === 'invalid-copy') {
        out(`문구 응답이 검사에서 떨어졌다 — 고쳐 쓴 뒤 같은 명령을 다시 돌린다 (${board.boardFile})`)
        for (const p of board.problems) out(`  문제 ${p}`)
        return { code: EXIT.waiting, lines, result: board }
      }
      out(`[${opts.pick}] ${board.scope} ${board.target} — ${board.variants.length}안 (전·후 보드 자료 ${board.boardFile})`)
      if (board.say) out(`  해석: ${board.say}`)
      for (const v of board.variants) {
        out(`  ${v.id}  ${v.block ?? v.label}${v.blockers.length ? ` — 공개 불가 사유 ${v.blockers.length}건 늘었다` : ''}${v.qa ? ` · 07 ${v.qa.publishable ? '공개 가능' : '공개 불가'}` : ''}`)
        for (const c of v.changes ?? []) out(`      ${c.axis}: ${c.from} → ${c.to}`)
        for (const w of v.warnings ?? []) out(`      주의: ${w}`) // 지금 04 문구로는 이 안이 06 에서 살아남지 못한다(FIT-5)
      }
      out(`고르려면: ${cmd} --revise-pick ${board.index}:<안>`)
    }
    return { code: given ? EXIT.waiting : EXIT.done, lines, result: r } // 읽기를 직접 준 흐름은 판을 만든 뒤 사람이 고르기를 기다린다(종료 3)
  } catch (e) {
    out(`도구 실패: ${String(e?.message ?? e).split(/\r?\n/).slice(0, 4).join(' | ')}`)
    return { code: EXIT.fail, lines }
  }
}

/**
 * 「너무 똑같아」 — 실행 폴더의 01 방향 3안을 지난번보다 더 다르게 다시 고르고, 그 위에 쌓인 단계를 낡게 한다.
 * 넓이 minAxes = 지난번 넓이(directions.json 에 남은 값, 처음엔 MIN_AXES) + handles.yaml redraw.minAxesDelta, 안 사이 거리가 셀 수 있는 칸 수(AXIS_COUNT)까지.
 * 이미 그 끝이면 아무것도 바꾸지 않고 더 못 넓힌다고 알린다(종료 3). 적용한 뒤 되돌리지 않은 디자인 수정이 있으면 다시 고르면 사라지므로 이것도 아무것도 바꾸지 않고 알린다(종료 3).
 * 01 을 다시 도는 길은 runStamp 하나뿐이라 그것을 `until: 01-direction` 으로 다시 부른다: 브리프는 지난 실행 요약(stamp-summary.json)이 적은 파일이고,
 * minAxes 가 01 의 입력 해시에 들어 01 만 새로 만들어진다. 02 는 01 에 기대지 않아 그대로 두고, 03~07 은 낡음 표시(markStale — 03 은 구획 수정이 남긴 열쇠까지)로 다시 돈다.
 * @returns {Promise<{ code: number, lines: string[] }>}
 */
export async function runRedrawWider(opts, deps) {
  const runDir = resolve(opts.run)
  const summary = readJsonMaybe(join(runDir, 'stamp-summary.json'))
  if (!summary?.brief) {
    const line = askIn(grammar.text.redrawNoRun)
    deps.say?.(line)
    return { code: EXIT.args, lines: [line] }
  }
  const { hasAppliedRevision } = await import('./revise-history.mjs')
  if (PICKS.some((cand) => hasAppliedRevision(join(runDir, cand)))) { // 적용한 수정은 새로 고른 방향 3안에 없다 — 아무것도 바꾸지 않고 먼저 되돌리게 한다
    const line = askIn(grammar.text.ask.redrawDrops)
    deps.say?.(line)
    return { code: EXIT.waiting, lines: [line] }
  }
  const [{ AXIS_COUNT, MIN_AXES }, { loadHandles }, { designLexicon }] = await Promise.all([import('./directions.mjs'), import('./handles.mjs'), import('./design-context.mjs')])
  const current = readJsonMaybe(join(runDir, 'directions.json'))?.minAxes ?? MIN_AXES
  const minAxes = Math.min(AXIS_COUNT, current + loadHandles(designLexicon()).redraw.minAxesDelta)
  if (minAxes <= current) {
    const line = askIn(grammar.text.redrawLimit)
    deps.say?.(line)
    return { code: EXIT.waiting, lines: [line] }
  }
  const r = await runStamp({ brief: summary.brief, run: runDir, until: '01-direction', minAxes }, deps)
  if (r.code !== EXIT.done) return r
  for (const cand of PICKS) markStale(join(runDir, cand), 'redraw', REDRAW_FILES)
  const line = askIn(grammar.text.redrawn).replace('{min}', String(minAxes))
  deps.say?.(line)
  return { ...r, lines: [...r.lines, line] }
}

// CLI
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  let opts
  try {
    opts = parseArgs(process.argv.slice(2))
  } catch (e) {
    console.error(`${e.message}\n${USAGE}`)
    process.exitCode = EXIT.args
  }
  if (opts && (opts.revise != null || opts.reviseReadings != null || opts.revisePick || opts.reviseUndo)) {
    const r = await runReviseCommand(opts)
    process.exitCode = r.code
  } else if (opts?.redrawWider) {
    const r = await runRedrawWider(opts, await defaultDeps())
    process.exitCode = r.code
  } else if (opts) {
    const deps = await defaultDeps({ preferences: !(opts.golden || opts.allGolden) })
    if (opts.golden || opts.allGolden) {
      // 골든 세트 — 브리프 파일·씨앗은 golden.mjs 가 정한다(--run 은 --all-golden 이면 골든마다 하위 폴더를 만드는 부모, 아니면 그 골든의 폴더. 기본 .tmp/stamp/golden/<id>)
      const golden = await import('./golden.mjs')
      if (opts.golden) {
        const r = await golden.runGolden(opts.golden, { until: opts.until, pick: opts.pick, runDir: opts.run ? resolve(opts.run) : undefined, deps, stamp: { runStamp, defaultDeps, normalizeStep } })
        console.log(`종료 ${r.code} (${r.status}) — 요약 ${join(r.runDir, 'stamp-summary.json')}`)
        process.exitCode = r.code
      } else {
        const r = await golden.runAllGolden({ until: opts.until, runDir: opts.run ? resolve(opts.run) : undefined, deps, stamp: { runStamp, defaultDeps, normalizeStep } })
        console.log(`골든 ${r.results.length}개 종료 — 가장 큰 종료 코드 ${r.code}`)
        process.exitCode = r.code
      }
    } else {
      const r = await runStamp(opts, deps)
      console.log(`종료 ${r.code} (${r.summary.status}) — 요약 ${join(r.summary.run, 'stamp-summary.json')}`)
      process.exitCode = r.code // process.exit() 는 fetch 소켓이 닫히는 중에 Windows 에서 죽는다
    }
  }
}
