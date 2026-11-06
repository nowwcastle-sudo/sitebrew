// 마감 리뷰 루프(v0.2.6 T13) — 고른 안의 리뷰 파일 상태에서 「다음에 무엇을 하나」를 정하고, apply 일 때는 처방을 revise 로 옮겨 한 번 다시 만든다.
//   nextStep(runDir, pick) → { action: 'review'|'apply'|'verdict'|'ask-human'|'done', round, why? }   — 파일만 읽는다(부작용 없음). 판정 순서는 docs/superpowers/specs/2026-11-04-finish-review-mapping.md 6.2.
//   runFinishLoop(…) — nextStep 한 번 + 그 행동 하나. 출력 첫 줄은 늘 `REVIEW <action> <round>` 이고, 그 줄이 상태이다.
//   무인 상한은 2라운드다. 사람 대기는 새로 만들지 않는다: ask-human 은 알릴 뿐이고(종료 3) 자동 찍어내기 경로는 이 명령을 부르지 않는다. 06 코드 열쇠 밖이다.
//   이 파일은 stamp.mjs 를 import 하지 않는다(다시 만들기는 rebuild 로 주입 받는다 — 의존이 한 방향이다).
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ReviewFormatError, parseReview, parseVerdict, reviewDirOf, reviewFileOf, verdictFileOf } from './finish-review.mjs'
import { markStale } from './revise-stale.mjs'

export const MAX_ROUNDS = 2
/** stamp.mjs EXIT 와 같은 값 — 0 끝 · 1 도구 실패 · 3 사람이나 에이전트가 할 일이 남았다(오류가 아니다). */
export const FINISH_EXIT = { done: 0, fail: 1, waiting: 3 }

const readText = (file) => (existsSync(file) ? readFileSync(file, 'utf8') : null)
const readJsonMaybe = (file) => {
  try { return JSON.parse(readFileSync(file, 'utf8')) } catch { return null }
}
const writeJson = (file, value) => {
  mkdirSync(join(file, '..'), { recursive: true })
  writeFileSync(`${file}.tmp`, `${JSON.stringify(value, null, 2)}\n`)
  renameSync(`${file}.tmp`, file)
}
const appliedFileOf = (runDir, pick, round) => join(reviewDirOf(runDir, pick), `applied-${round}.json`)
/** recapture 로 치워 둔 리뷰 파일(review-<n>.recaptured-<k>.md)의 수. */
const recaptureCount = (runDir, pick, round) => {
  const dir = reviewDirOf(runDir, pick)
  return existsSync(dir) ? readdirSync(dir).filter((f) => new RegExp(`^review-${round}\\.recaptured-\\d+\\.md$`).test(f)).length : 0
}

function readParsed(file, parse, round) {
  const parsed = parse(readText(file))
  if (parsed.round !== round) throw new ReviewFormatError(`파일 번호는 ${round} 인데 문서 머리는 ${parsed.round} 이다`)
  return parsed
}

/**
 * 다음 행동. 형식이 틀린 리뷰·판정 파일은 던지지 않고 그 파일을 다시 쓰게 한다(action review|verdict, why 에 까닭).
 * 1 review-n 없음 → review · 2 ship → done · 3 recapture → 한 번만 review(두 번째는 ask-human) · 4 rebuild·human 처방 → ask-human
 * 5 fix: 적용 전 → apply · 적용 뒤 verdict 없음 → verdict · 6 모두 resolved 이고 regression 이 없으면 done · 아니면 n<2 면 다음 라운드 review, n=2 면 ask-human.
 */
export function nextStep(runDir, pick) {
  for (let round = 1; round <= MAX_ROUNDS; round++) {
    const reviewFile = reviewFileOf(runDir, pick, round)
    if (!existsSync(reviewFile)) return { action: 'review', round }
    let review
    try { review = readParsed(reviewFile, parseReview, round) } catch (e) {
      if (e instanceof ReviewFormatError) return { action: 'review', round, why: `review-${round}.md 형식 오류: ${e.message}` }
      throw e
    }
    if (review.disposition === 'ship') return { action: 'done', round }
    if (review.disposition === 'recapture') {
      return recaptureCount(runDir, pick, round) > 0
        ? { action: 'ask-human', round, why: '스크린샷을 다시 찍고도 리뷰어가 판단하지 못했다' }
        : { action: 'review', round, recapture: true, why: '스크린샷이 모자라 판단하지 못했다 — 07 을 다시 찍은 뒤 다시 리뷰한다' }
    }
    const humans = review.findings.filter((f) => f.prescription.kind === 'human')
    if (review.disposition === 'rebuild' || humans.length) {
      return { action: 'ask-human', round, why: review.disposition === 'rebuild' ? '새로 만들어야 한다고 리뷰어가 판정했다' : `사람이 정할 지적 ${humans.map((f) => f.id).join('·')}` }
    }
    const applied = readJsonMaybe(appliedFileOf(runDir, pick, round))
    if (!applied?.complete) return { action: 'apply', round }
    if (!Object.values(applied.outcomes ?? {}).some((o) => o.status === 'applied')) { // 되묻거나 낡아서 하나도 못 적용했다 — 다시 만들어도 같다
      return { action: 'ask-human', round, why: 'revise 처방을 하나도 적용하지 못했다 (되묻기나 낡은 판)' }
    }
    const verdictFile = verdictFileOf(runDir, pick, round)
    if (!existsSync(verdictFile)) return { action: 'verdict', round }
    let verdict
    try { verdict = readParsed(verdictFile, parseVerdict, round) } catch (e) {
      if (e instanceof ReviewFormatError) return { action: 'verdict', round, why: `verdict-${round}.md 형식 오류: ${e.message}` }
      throw e
    }
    const status = new Map(verdict.results.map((r) => [r.id, r.status]))
    const open = review.findings.filter((f) => status.get(f.id) !== 'resolved') // 판정에 없는 지적도 풀리지 않은 것이다
    if (!open.length && !verdict.regressions.length) return { action: 'done', round }
    if (round >= MAX_ROUNDS) {
      return { action: 'ask-human', round, why: `${MAX_ROUNDS}라운드 뒤에도 ${open.length ? `풀리지 않은 지적 ${open.map((f) => f.id).join('·')}` : '새로 생긴 문제'}${verdict.regressions.length ? ` · 새 문제 ${verdict.regressions.length}건` : ''}` }
    }
  }
  return { action: 'ask-human', round: MAX_ROUNDS, why: '라운드 상한' } // 도달하지 않는 줄 — 루프가 위에서 모두 돌려준다
}

// ── apply ────────────────────────────────────────────────────────────────────

const PICKS = ['a', 'b', 'c']

/**
 * 한 라운드의 revise 처방을 차례로 적용한다. 처방마다 사이트를 새로 읽고(앞 처방이 바꿨을 수 있다) revise(n: 1, install: false) → 첫 안을 고른다.
 * 진행은 applied-<n>.json 에 처방별로 남겨, 문구 응답을 기다리다 멈춘 뒤 같은 명령을 다시 돌려도 끝난 처방을 되풀이하지 않는다.
 * @param {{ parseRevision: Function, revise: Function, applyRevision: Function }} api  revise.mjs 의 세 함수(시험이 가짜를 준다)
 * @returns {Promise<{ waiting?: { id: string, file: string, status: string, problems?: string[] }, outcomes: Record<string, { status: 'applied'|'asked'|'outdated' }> }>}
 */
export async function applyRound(runDir, pick, round, api) {
  const review = parseReview(readText(reviewFileOf(runDir, pick, round)))
  const file = appliedFileOf(runDir, pick, round)
  const state = readJsonMaybe(file) ?? { round, outcomes: {}, complete: false }
  const siteFile = join(runDir, pick, 'site', 'content', 'site.json')
  for (const f of review.findings) {
    if (state.outcomes[f.id]) continue
    const request = api.parseRevision(f.prescription.command, JSON.parse(readFileSync(siteFile, 'utf8')), undefined, { candidates: PICKS })
    let outcome
    if (request.ask) outcome = { status: 'asked', ask: request.ask }
    else {
      const made = await api.revise(runDir, pick, request, { n: 1, install: false })
      if (made.ask) outcome = { status: 'asked', ask: made.ask }
      else {
        const waiting = (made.boards ?? [made]).find((b) => b.status === 'waiting-copy' || b.status === 'invalid-copy')
        if (waiting) {
          writeJson(file, state)
          return { waiting: { id: f.id, file: waiting.waiting?.requestFile ?? waiting.boardFile, status: waiting.status, problems: waiting.problems }, outcomes: state.outcomes }
        }
        const applied = []
        for (const board of made.boards ?? [made]) {
          const r = await api.applyRevision(runDir, pick, board.index, board.variants[0].id)
          if (r.outdated) { applied.push({ index: board.index, outdated: true }); continue }
          if (r.waitingCopy) {
            writeJson(file, state)
            return { waiting: { id: f.id, file: r.waitingCopy, status: 'waiting-copy' }, outcomes: state.outcomes }
          }
          applied.push({ index: board.index, variant: board.variants[0].id })
        }
        outcome = applied.some((a) => a.outdated) ? { status: 'outdated', applied } : { status: 'applied', applied }
      }
    }
    state.outcomes[f.id] = outcome
    writeJson(file, state)
  }
  return { outcomes: state.outcomes }
}

/** applyRound 가 끝났고 다시 만들기도 끝났을 때 라운드를 닫는다. */
const markComplete = (runDir, pick, round) => {
  const file = appliedFileOf(runDir, pick, round)
  writeJson(file, { ...(readJsonMaybe(file) ?? { round, outcomes: {} }), complete: true, at: new Date().toISOString() })
}

// ── 한 걸음 ──────────────────────────────────────────────────────────────────

/**
 * nextStep 한 번 + 그 행동 하나. 첫 출력 줄은 `REVIEW <action> <round>`.
 * - review·verdict·ask-human: 리뷰어(또는 사람)가 할 일이라 종료 3. recapture 이면 07 을 낡게 해 다음 찍어내기가 다시 찍게 한다.
 * - apply: 처방을 적용하고 rebuild() 로 06·07 을 한 번 다시 만든다. 끝나면 종료 0 — 다음 걸음은 `REVIEW verdict <n>` 이다. 문구 응답이 필요하면 종료 3.
 * - done: 종료 0.
 * @param {{ rebuild: () => Promise<{ ok: boolean, waiting?: boolean, message?: string }>, api?: object, say?: (line: string) => void }} deps
 */
export async function runFinishLoop({ runDir, pick }, { rebuild, api, say = console.log }) {
  const lines = []
  const out = (s) => { lines.push(s); say(s) }
  const step = nextStep(runDir, pick)
  out(`REVIEW ${step.action} ${step.round}`)
  if (step.why) out(`  ${step.why}`)
  const done = (code) => ({ code, lines, step })
  if (step.action === 'done') return done(FINISH_EXIT.done)
  if (step.action === 'ask-human') return done(FINISH_EXIT.waiting)
  if (step.action === 'review') {
    if (step.recapture) {
      const dir = reviewDirOf(runDir, pick)
      renameSync(reviewFileOf(runDir, pick, step.round), join(dir, `review-${step.round}.recaptured-${recaptureCount(runDir, pick, step.round) + 1}.md`))
      markStale(join(runDir, pick), 'finish', ['07-qa'])
      out(`  다음: npm run stamp -- --run ${runDir} --pick ${pick}   (07 을 다시 찍는다)`)
    }
    return done(FINISH_EXIT.waiting)
  }
  if (step.action === 'verdict') return done(FINISH_EXIT.waiting)

  // apply
  try {
    const impl = api ?? (await import('./revise.mjs'))
    const applied = await applyRound(runDir, pick, step.round, impl)
    if (applied.waiting) {
      out(`  대기: ${applied.waiting.id} 처방이 문구 응답을 기다린다 (${applied.waiting.file})`)
      for (const p of applied.waiting.problems ?? []) out(`  문제 ${p}`)
      out('  → factory/stamp/COPY.md 대로 응답을 쓴 뒤 같은 명령을 다시 돌린다.')
      return done(FINISH_EXIT.waiting)
    }
    for (const [id, o] of Object.entries(applied.outcomes)) out(`  ${id}: ${o.status}${o.ask ? ` — ${o.ask}` : ''}`)
    const built = await rebuild()
    if (built.waiting) {
      out(`  대기: ${built.message ?? '다시 만들기가 입력을 기다린다'}`)
      return done(FINISH_EXIT.waiting)
    }
    if (!built.ok) {
      out(`도구 실패: ${built.message ?? '06·07 을 다시 만들지 못했다'}`)
      return done(FINISH_EXIT.fail)
    }
    markComplete(runDir, pick, step.round)
    out(`  다음: 고친 안을 다시 보고 verdict-${step.round}.md 를 쓴다 (npm run stamp -- --run ${runDir} --pick ${pick} --finish-review)`)
    return done(FINISH_EXIT.done)
  } catch (e) {
    out(`도구 실패: ${String(e?.message ?? e).split(/\r?\n/).slice(0, 4).join(' | ')}`)
    return done(FINISH_EXIT.fail)
  }
}
