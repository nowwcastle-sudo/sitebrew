// 수정 기록(09-revise) — 적용 전 되돌릴 파일 보관(snapshot), 「되돌려」(undoLast), 「둘 다 아니에요」(pickNone). 기록은 판(board.json)과 판 폴더의 before/ 뿐이고 새 로그 파일은 없다.
//   revise.mjs 의 applyRevision 이 적용 전에 snapshot 을 부르고, 던지면 restoreSnapshot 으로 처음 상태를 되살린다. 낡음 표시는 잎 모듈 revise-stale.mjs 를 함께 쓴다.
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, rmdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { loadPreferences, savePreferences, unrecordPick } from '../board/preferences.mjs'
import { markStale } from './revise-stale.mjs'

const NONE = 'none'
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'))
/** 임시 파일에 쓴 뒤 이름을 바꾼다 — 쓰다 끊겨도 반쯤 쓴 JSON 이 남지 않는다. 수정 쪽 모든 JSON 쓰기가 이 하나를 쓴다. */
export function writeJson(file, value) {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(`${file}.tmp`, `${JSON.stringify(value, null, 2)}\n`)
  renameSync(`${file}.tmp`, file)
}
const now = (opts) => (opts.now ?? (() => new Date().toISOString()))()

// 갈래마다 applyRevision 이 쓰는 파일(후보 폴더 기준). 나머지(remove·order·add)는 구조 수정이라 02 와 문구 파일까지 바꾼다.
const REVISE_FILES = {
  section: ['03-variants.json', '04-content.request.json'],
  design: ['01-direction.json', 'recipe/DESIGN.md'],
  copy: ['04-content.json'],
  structure: ['02-sitemap.json', '03-variants.json', '04-content.json', '04-content.request.json'],
}
const filesOf = (scope) => REVISE_FILES[scope] ?? REVISE_FILES.structure
const STATE_FILES = [...new Set(Object.values(REVISE_FILES).flat())] // 어느 갈래의 판이든 고르기가 쓸 수 있는 파일 전부

const reviseDir = (candDir, index) => join(candDir, '09-revise', String(index))

/**
 * 수정이 쓰는 파일 전부(01~04 와 레시피 머리)의 지금 내용 해시 — 판을 만들 때 적어 두고(boardBase) 고를 때 다시 견주어, 그 사이 사이트가 바뀌었는지(다른 안을 골랐다 · 되돌렸다) 안다.
 * 갈래를 가리지 않는다: 구획을 고른 뒤에는 그 전에 만든 문구·디자인 판도 낡은 판이다. 같은 상태에서 만든 두 판 중 하나를 고르면 나머지는 낡은 판이 된다 — 낡은 판의 안은 그 사이 바뀐 것을 되돌리거나 덮어쓰기 때문이다.
 */
export function stateHash(candDir) {
  const hash = createHash('sha256')
  for (const rel of STATE_FILES) {
    const file = join(candDir, rel)
    hash.update(rel).update('\0').update(existsSync(file) ? readFileSync(file) : 'absent').update('\n')
  }
  return hash.digest('hex')
}

/** 이 후보 폴더의 판 번호들(큰 것부터) */
function boardNumbers(candDir) {
  const dir = join(candDir, '09-revise')
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory() && /^\d+$/.test(e.name)).map((e) => Number(e.name)).sort((a, b) => b - a)
}

/** 다음에 적용할 판의 적용 순서 — 지금까지 고른 판의 가장 큰 seq 보다 하나 크다(번호가 아니라 적용한 순서로 되돌리기 위해). */
export function nextSeq(candDir) {
  let max = 0
  for (const index of boardNumbers(candDir)) {
    const file = join(reviseDir(candDir, index), 'board.json')
    if (existsSync(file)) max = Math.max(max, readJson(file).picked?.seq ?? 0)
  }
  return max + 1
}

/**
 * 적용 전 상태를 09-revise/<번호>/before/ 에 둔다 — 쓸 파일의 바이트(없던 파일은 없었다고 적는다).
 * @returns {{ dir: string }}
 */
export function snapshot(runDir, candId, index) {
  const candDir = join(runDir, candId)
  const board = readJson(join(reviseDir(candDir, index), 'board.json'))
  const dir = join(reviseDir(candDir, index), 'before')
  rmSync(dir, { recursive: true, force: true })
  const files = []
  const absent = []
  for (const rel of filesOf(board.scope)) {
    const from = join(candDir, rel)
    if (!existsSync(from)) { absent.push(rel); continue }
    mkdirSync(dirname(join(dir, rel)), { recursive: true })
    copyFileSync(from, join(dir, rel))
    files.push(rel)
  }
  writeJson(join(dir, 'manifest.json'), { files, absent })
  return { dir }
}

/** 보관한 파일을 바이트 그대로 되살리고, 없던 파일은 지운다(그 때문에 빈 폴더가 남으면 그것도 지운다). 돌려준 값 = 되살린 파일 수. */
export function restoreSnapshot(candDir, index) {
  const dir = join(reviseDir(candDir, index), 'before')
  const { files, absent } = readJson(join(dir, 'manifest.json'))
  for (const rel of files) { mkdirSync(dirname(join(candDir, rel)), { recursive: true }); copyFileSync(join(dir, rel), join(candDir, rel)) }
  for (const rel of absent) {
    rmSync(join(candDir, rel), { force: true })
    const parent = dirname(join(candDir, rel))
    if (parent !== candDir && existsSync(parent) && !readdirSync(parent).length) rmdirSync(parent)
  }
  return files.length + absent.length
}

/** 적용된 판인가 — 고른 안이 있고(「둘 다 아니에요」는 뺀다) 되돌리지 않았다. */
const isApplied = (board) => Boolean(board.picked) && board.picked.id !== NONE && !board.undone

/** 적용된 판 중 보관 파일(before/ 아래 rel)이 있는 것에서 seq 가 가장 큰 것(seq 가 없는 옛 판은 0, 같으면 큰 번호). */
function lastApplied(candDir, rel) {
  let best = null
  for (const index of boardNumbers(candDir)) {
    const file = join(reviseDir(candDir, index), 'board.json')
    if (!existsSync(file) || !existsSync(join(reviseDir(candDir, index), 'before', rel))) continue
    const board = readJson(file)
    if (!isApplied(board)) continue
    if (!best || (board.picked.seq ?? 0) > (best.board.picked.seq ?? 0)) best = { index, file, board }
  }
  return best
}

/** 적용한 뒤 되돌리지 않은 수정(디자인·구획·문구·구조 어느 것이든)이 있는가 — 방향 3안을 다시 고르면 03~07 이 다시 만들어져 그 수정이 사라진다. */
export const hasAppliedRevision = (candDir) => boardNumbers(candDir).some((index) => {
  const file = join(reviseDir(candDir, index), 'board.json')
  if (!existsSync(file)) return false
  const board = readJson(file)
  return isApplied(board)
})

/** 되돌릴 수 있는 가장 최근에 적용한 판. */
const lastUndoable = (candDir) => lastApplied(candDir, 'manifest.json')

/**
 * 「아까 게」가 가리키는 모양 — 가장 최근에 적용한 방향(디자인) 판이 적용 전에 보관한 01-direction 의 후보 칸(레시피 머리는 부르는 쪽이 꺼낸다).
 * 방향 파일을 보관하지 않은 판(구획·문구·구조)은 머리를 안 바꿨으므로 건너뛴다. 적용한 방향 판이 없으면 null.
 */
export function previousCandidate(candDir) {
  const hit = lastApplied(candDir, '01-direction.json')
  if (!hit) return null
  const saved = readJson(join(reviseDir(candDir, hit.index), 'before', '01-direction.json'))
  return 'inputHash' in saved && 'data' in saved ? saved.data : saved
}

/**
 * 가장 최근에 적용한 수정을 되돌린다 — 보관한 파일을 바이트 그대로 되살리고, 그 고르기가 학습에 더한 것을 덜어 내고, 적용 때와 같이 06·07 을 낡게 한다.
 * @param {{ now?: () => string, seedFile?: string, userFile?: string }} [opts]
 * @returns {{ restored: number, index: number, text: string|null } | { none: true }}
 */
export function undoLast(runDir, candId, opts = {}) {
  const candDir = join(runDir, candId)
  const hit = lastUndoable(candDir)
  if (!hit) return { none: true }
  const restored = restoreSnapshot(candDir, hit.index)
  const learned = hit.board.picked.learned
  if (learned) {
    const files = { ...(opts.seedFile ? { seedFile: opts.seedFile } : {}), ...(opts.userFile ? { userFile: opts.userFile } : {}) }
    let prefs = loadPreferences(files)
    for (const loser of learned.losers) prefs = unrecordPick(prefs, { archetype: learned.archetype, winner: learned.winner, loser })
    savePreferences(prefs, opts.userFile ? { userFile: opts.userFile } : {})
  }
  markStale(candDir, hit.index)
  writeJson(hit.file, { ...hit.board, undone: now(opts) })
  return { restored, index: hit.index, text: hit.board.request ?? null }
}

/** 「둘 다 아니에요」 — 고를 수 있는(ready) 판에 고른 안 `none` 만 적고 아무것도 적용하지 않는다. 돌려준 text = 판의 처음 요청 글(안내 언어를 정한다). */
export function pickNone(runDir, candId, index, opts = {}) {
  const file = join(runDir, candId, '09-revise', String(index), 'board.json')
  if (!existsSync(file)) throw new Error(`09-revise/${index} 보드가 없다: ${file}`)
  const board = readJson(file)
  if (board.picked) throw new Error(`09-revise/${index} 는 이미 골랐다(${board.picked.id})`)
  if (board.status !== 'ready') throw new Error(`09-revise/${index} 는 아직 고를 수 없다(상태 ${board.status})`)
  writeJson(file, { ...board, picked: { id: NONE, at: now(opts) } })
  return { index, id: NONE, text: board.request ?? null }
}
