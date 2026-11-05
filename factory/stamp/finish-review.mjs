// 마감 리뷰의 입출력(v0.2.6 T12) — 리뷰어가 볼 재료를 모으고, 리뷰어가 쓴 두 문서(review-<n>.md · verdict-<n>.md)를 읽는다.
//   이 모듈은 파일을 읽기만 한다(부작용 없음). 무엇을 할지는 finish-loop.mjs 한 곳이 정한다. 06 코드 열쇠 밖이다.
//   문서 문법의 정본은 plugins/sitebrew/skills/new/references/review-format.md 이고, 파서는 그 문서의 예시를 그대로 읽는다(시험이 맞춰 본다).
//
//   collectReviewInputs(runDir, pick, opts?) → { shots: [{ path, width, kind }], head, brief, blockers }
//   parseReview(md)  → { round, disposition: 'ship'|'fix'|'rebuild'|'recapture', findings: [{ id, where, problem, prescription: { kind: 'revise'|'human', command?, note? } }] }
//   parseVerdict(md) → { round, results: [{ id, status: 'resolved'|'partial'|'unresolved' }], regressions: string[] }
//   형식이 어긋나면 ReviewFormatError 를 던진다.
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { recipeHeadOf } from './site-files.mjs'

export const DISPOSITIONS = ['ship', 'fix', 'rebuild', 'recapture']
export const VERDICT_STATUSES = ['resolved', 'partial', 'unresolved']
/** 리뷰 입력 이미지 상한(쪽이 많으면 홈을 먼저 넣고 넘는 쪽은 뺀다). */
export const MAX_SHOTS = 24
const TILES_PER_WIDTH = 2

export class ReviewFormatError extends Error {
  constructor(message) {
    super(message)
    this.name = 'ReviewFormatError'
  }
}

// ── 경로 ─────────────────────────────────────────────────────────────────────

export const reviewDirOf = (runDir, pick) => join(runDir, pick, '09-review')
export const reviewFileOf = (runDir, pick, round) => join(reviewDirOf(runDir, pick), `review-${round}.md`)
export const verdictFileOf = (runDir, pick, round) => join(reviewDirOf(runDir, pick), `verdict-${round}.md`)

// ── 문서 읽기 ────────────────────────────────────────────────────────────────

const lines = (md) => String(md ?? '').replace(/^﻿/, '').split(/\r?\n/)
const fail = (msg) => { throw new ReviewFormatError(msg) }

function readHeader(all, word) {
  const idx = all.findIndex((l) => l.trim() !== '')
  const m = idx < 0 ? null : new RegExp(`^#\\s+${word}\\s+(\\d+)\\s*$`).exec(all[idx].trim())
  if (!m || Number(m[1]) < 1) fail(`첫 줄이 "# ${word} <번호>" 가 아니다`)
  return { round: Number(m[1]), rest: all.slice(idx + 1) }
}

const QUOTED = /^(?:"([^"]+)"|“([^”]+)”)$/

/** `revise "<말>"` | `human [<한 줄>]` → { kind, command?, note? } */
function readPrescription(value, id) {
  const m = /^(revise|human)(?:\s+(.*))?$/.exec(value.trim())
  if (!m) fail(`${id}: prescription 은 revise "<말>" 이나 human <한 줄> 이다: ${JSON.stringify(value)}`)
  const rest = (m[2] ?? '').trim()
  if (m[1] === 'human') return { kind: 'human', ...(rest ? { note: rest } : {}) }
  const q = QUOTED.exec(rest)
  const command = (q?.[1] ?? q?.[2] ?? '').trim()
  if (!command) fail(`${id}: revise 처방은 큰따옴표로 감싼 말 하나가 필요하다: ${JSON.stringify(value)}`)
  return { kind: 'revise', command }
}

const FIELDS = ['where', 'problem', 'prescription']

/** review-<n>.md 를 읽는다. 소견 블록은 `## F<번호>` 이고 where·problem·prescription 세 줄이 모두 필요하다. */
export function parseReview(md) {
  const { round, rest } = readHeader(lines(md), 'Review')
  let disposition = null
  const findings = []
  let cur = null
  for (const raw of rest) {
    const line = raw.trim()
    if (!line) continue
    const block = /^##\s+(F\d+)\s*$/.exec(line)
    if (block) {
      if (disposition === null) fail('소견 블록 앞에 disposition 줄이 있어야 한다')
      if (findings.some((f) => f.id === block[1])) fail(`${block[1]} 이 두 번 나온다`)
      cur = { id: block[1], raw: {} }
      findings.push(cur)
      continue
    }
    const kv = /^([a-z]+):\s*(.*)$/.exec(line)
    if (!kv) fail(`읽을 수 없는 줄: ${JSON.stringify(line)}`)
    const [, key, value] = kv
    if (!cur) {
      if (key !== 'disposition') fail(`소견 블록 밖에는 disposition 줄만 둘 수 있다: ${JSON.stringify(line)}`)
      if (disposition !== null) fail('disposition 줄이 두 번 나온다')
      const word = /^([a-z]+)\s*(?:#.*)?$/.exec(value)?.[1]
      if (!DISPOSITIONS.includes(word)) fail(`disposition 은 ${DISPOSITIONS.join('|')} 중 하나다: ${JSON.stringify(value)}`)
      disposition = word
      continue
    }
    if (!FIELDS.includes(key)) fail(`${cur.id}: 모르는 칸 ${key} (${FIELDS.join('·')} 만 쓴다)`)
    if (key in cur.raw) fail(`${cur.id}: ${key} 줄이 두 번 나온다`)
    if (!value.trim()) fail(`${cur.id}: ${key} 줄이 비어 있다`)
    cur.raw[key] = value.trim()
  }
  if (disposition === null) fail('disposition 줄이 없다')
  const parsed = findings.map(({ id, raw }) => {
    for (const f of FIELDS) if (!(f in raw)) fail(`${id}: ${f} 줄이 없다`)
    return { id, where: raw.where, problem: raw.problem, prescription: readPrescription(raw.prescription, id) }
  })
  if (disposition === 'ship' && parsed.length) fail('disposition 이 ship 이면 소견 블록이 없어야 한다')
  if (disposition === 'fix' && !parsed.length) fail('disposition 이 fix 이면 소견이 하나 이상 있어야 한다')
  return { round, disposition, findings: parsed }
}

/** verdict-<n>.md 를 읽는다. 줄은 `F<번호>: resolved|partial|unresolved` 와 `regression: <글>`(여러 줄 가능)이다. */
export function parseVerdict(md) {
  const { round, rest } = readHeader(lines(md), 'Verdict')
  const results = []
  const regressions = []
  for (const raw of rest) {
    const line = raw.trim()
    if (!line) continue
    const reg = /^regression:\s*(.*)$/.exec(line)
    if (reg) {
      if (!reg[1].trim()) fail('regression 줄이 비어 있다')
      regressions.push(reg[1].trim())
      continue
    }
    const res = /^(F\d+):\s*([a-z]+)\s*$/.exec(line)
    if (!res) fail(`읽을 수 없는 줄: ${JSON.stringify(line)}`)
    if (!VERDICT_STATUSES.includes(res[2])) fail(`${res[1]}: 상태는 ${VERDICT_STATUSES.join('|')} 중 하나다: ${JSON.stringify(res[2])}`)
    if (results.some((r) => r.id === res[1])) fail(`${res[1]} 이 두 번 나온다`)
    results.push({ id: res[1], status: res[2] })
  }
  return { round, results, regressions }
}

// ── 리뷰 입력 ────────────────────────────────────────────────────────────────

const readJsonMaybe = (file) => {
  try { return JSON.parse(readFileSync(file, 'utf8')) } catch { return null }
}
const unwrap = (saved) => (saved && typeof saved === 'object' && 'inputHash' in saved && 'data' in saved ? saved.data : saved)

/** 쪽 하나의 캡처(07-qa/ux/<slug>/gate/)를 읽을 순서대로: 첫 화면 라이트·다크 1440 → 라이트·다크 375 → 768 → 폭마다 타일 앞 몇 장. */
function pageShots(gateDir) {
  const has = (name) => existsSync(join(gateDir, name))
  const out = []
  for (const [name, width, kind] of [
    ['hero-1440-light.png', 1440, 'hero-light'], ['hero-1440-dark.png', 1440, 'hero-dark'],
    ['hero-375-light.png', 375, 'hero-light'], ['hero-375-dark.png', 375, 'hero-dark'],
    ['hero-768-light.png', 768, 'hero-768'],
  ]) if (has(name)) out.push({ path: join(gateDir, name), width, kind })
  for (const width of [1440, 375]) {
    const tiles = readdirSync(gateDir).filter((f) => new RegExp(`^tile_${width}_\\d+\\.png$`).test(f)).sort().slice(0, TILES_PER_WIDTH)
    for (const t of tiles) out.push({ path: join(gateDir, t), width, kind: 'tile' })
  }
  return out
}

const HEAD_TEXT_KEYS = ['thesis', 'ownWorld', 'colorStrategy', 'materialFamily'] // 후보 머리 네 칸(T21) — 있으면 리뷰어에게 보인다

/** 후보 머리의 짧은 요약 — 리뷰어가 「후보가 말하는 세계」와 화면을 견주는 데 쓴다. */
function headSummary(cand, headOf) {
  let head = null
  try { head = headOf(cand) } catch { head = null }
  const h = head ?? {}
  return {
    id: h.id ?? (typeof cand.recipe === 'string' ? cand.recipe : null),
    source: cand.source ?? null,
    ...(h.colorLogic ? { colorLogic: h.colorLogic } : {}),
    ...(h.defaultTheme ? { defaultTheme: h.defaultTheme } : {}),
    ...(h.motion !== undefined ? { motion: h.motion } : {}),
    ...(h.axes ? { axes: h.axes } : {}),
    ...(h.mood ? { mood: h.mood } : {}),
    ...Object.fromEntries(HEAD_TEXT_KEYS.filter((k) => cand[k] != null).map((k) => [k, cand[k]])),
  }
}

/**
 * 리뷰어에게 줄 재료. 파일이 없거나 못 읽으면 던지지 않고 그만큼 뺀다(한 장도 없으면 shots: []).
 * 이미지는 MAX_SHOTS 장까지 — 홈 쪽을 먼저 넣고 넘치는 쪽은 통째로 뺀 뒤 blockers 에 알린다. 타일이 잘린 쪽(truncated)은 「일부만 봄」을 남긴다.
 * @param {{ headOf?: (cand: object) => object, maxShots?: number }} [opts]
 */
export function collectReviewInputs(runDir, pick, { headOf = recipeHeadOf, maxShots = MAX_SHOTS } = {}) {
  const candDir = join(runDir, pick)
  const cand = unwrap(readJsonMaybe(join(candDir, '01-direction.json'))) ?? {}
  const summary = readJsonMaybe(join(runDir, 'stamp-summary.json'))
  const briefRaw = summary?.brief ? readJsonMaybe(summary.brief) : null
  const brief = briefRaw ? { topic: briefRaw.topic ?? null, archetype: briefRaw.archetype ?? null, locale: briefRaw.locale ?? null, facts: briefRaw.facts ?? {} } : null
  const blockers = [...(readJsonMaybe(join(candDir, 'candidate.json'))?.blockers ?? [])]

  const uxDir = join(candDir, '07-qa', 'ux')
  const slugs = existsSync(uxDir) ? readdirSync(uxDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort() : []
  slugs.sort((a, b) => (a === 'home' ? -1 : b === 'home' ? 1 : 0)) // 안정 정렬: 홈 먼저, 나머지는 이름 순
  const shots = []
  const skipped = []
  for (const slug of slugs) {
    const gateDir = join(uxDir, slug, 'gate')
    if (!existsSync(gateDir)) continue
    const page = pageShots(gateDir)
    if (!page.length) continue
    if (shots.length + page.length > maxShots) { skipped.push(slug); continue }
    shots.push(...page)
    const report = readJsonMaybe(join(gateDir, 'ux_gate.json'))
    if (Object.values(report?.gate ?? {}).some((g) => g?.tiles?.truncated)) blockers.push(`리뷰 입력: ${slug} 쪽은 일부만 봄 (타일이 잘렸다)`)
  }
  if (skipped.length) blockers.push(`리뷰 입력: 일부 쪽 생략 (${skipped.length}쪽: ${skipped.join(', ')})`)
  return { shots, head: headSummary(cand, headOf), brief, blockers }
}
