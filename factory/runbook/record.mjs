// 런북 상태 기록(sitebrew v0.2.0 계획 5 Task 11) — `.sitebrew/*` 의 유일한 읽기·쓰기(IO). 다른 모듈은 이 파일을 거쳐서만 .sitebrew 를 만진다.
//
//   createRecord({ secretShapes = [] } = {}) → { readDelivered, recordDelivery, readState, writeState }
//     secretShapes = 생성 데이터(runbook.generated.json)의 키 모양 표 `{ id, re }[]` — 주지 않아도 된다(빈 표). 값 패턴·이메일·전화 검사는 표와 상관없이 늘 돈다.
//   readDelivered({ run?, site? }) → Delivered | null          사용자 폴더(site)의 기록이 먼저(그 폴더에 넘겨진 것), 없거나 깨졌으면 실행 폴더(run)의 것(마지막 전달). 둘 다 없으면 null.
//   recordDelivery({ run, dest }, d: Delivered) → { saved, files }   <run>/.sitebrew/delivered.json + <dest>/.sitebrew/delivered.json(폴더가 있는 쪽만) + .gitignore(`*`). 통째로 바꾼다.
//   readState({ run?, site? }) → State                          두 기록(실행 폴더 · 사용자 폴더 사본)을 키별로 합친 값. 없거나 깨졌으면 기본값.
//   writeState({ run?, site? }, patch, at) → { saved, files } | { saved: false }
//     patch = { door?: 'use'|'skip'|null, level?: 'beginner'|'expert', lang?: 'ko'|'en', features?: { table, outcomes[] }, chapters?: { [gid]: 'doing'|'done'|'skipped' }, alternatives?: role[] }
//     at    = 쓰는 시각(ISO, 예 2026-10-22T01:00:00.000Z) — 시계는 부르는 쪽이 준다.
//   State = { door, level, lang, features, chapters: { [gid]: { status, at } }, alternatives: role[] }   (없는 칸은 null · {} · [])
//
//   규칙
//   · 키별 합치기: 칸마다(문·수준·언어·기능, 장 하나, 대안 역할 하나) `at` 이 붙고 같은 칸은 새 at 이 이긴다(같은 시각이면 글이 큰 쪽 — 어느 순서로 합쳐도 같은 값).
//     그래서 사본이 따로 쓰여도 다음 쓰기에서 같은 글로 수렴하고, 같은 쓰기를 되풀이하면 파일이 바뀌지 않는다(같은 글이면 쓰지 않는다). done → doing 도 새 at 이면 받는다.
//   · 자리: 실행 폴더가 기준이다 — <run>/.sitebrew 는 실행 폴더가 있으면 만든다. 사용자 폴더는 <site>/.sitebrew 가 이미 있을 때만 쓴다(deliver 가 만든다).
//     쓸 자리가 하나도 없으면(옛 폴더·챗봇) 아무것도 만들지 않고 { saved: false } — 부르는 쪽이 대화 안에서만 기억한다. 새로 만든 .sitebrew 에는 .gitignore(`*`).
//   · 원자적: 같은 폴더의 임시 파일에 쓰고 rename 한다. 실패하면 임시 파일을 지우고 던진다(반쪽 파일이 남지 않는다).
//   · 허용 목록: 위 칸만 쓴다. 모르는 칸·값은 쓰기에서 RecordError, 읽기에서 버린다. 값은 열거형·id·시각뿐이고 키 모양(표)·이메일·전화 모양이면 거절한다.
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export const RECORD_DIR = '.sitebrew'
const STATE_FILE = 'runbook.json'
const DELIVERED_FILE = 'delivered.json'
const GITIGNORE = '*\n'
const VERSION = 1

/** 넣으면 안 되는 값·모양 — 부르는 쪽의 결함이라 개발자용 영어 메시지로 던진다. */
export class RecordError extends Error {
  name = 'RecordError'
}

const ID = /^[a-z0-9][a-z0-9-]{0,63}$/ // 성과 id · 대안 역할
const GID = /^G-[a-z]+(?:-[a-z]+)*$/
const HASH = /^[A-Za-z0-9]{1,128}$/ // 표 해시
const TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/
const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/
const PHONE = /\+?\d(?:[\s-]?\d){8,13}/
const DOORS = ['use', 'skip', null]
const LEVELS = ['beginner', 'expert']
const LANGS = ['ko', 'en']
const STATUSES = ['doing', 'done', 'skipped']
const COMPLETIONS = ['site', 'composed']
const DELIVERED_KEYS = ['version', 'applied', 'unapplied', 'completion', 'locale', 'tableHash', 'deliveredAt']
const SCALARS = { door: DOORS, level: LEVELS, lang: LANGS }
const PATCH_KEYS = new Set([...Object.keys(SCALARS), 'features', 'chapters', 'alternatives'])

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const sortedKeys = (o) => Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]))
const isDir = (p) => existsSync(p) && statSync(p).isDirectory()

/** 파일 하나 읽기 — 없거나 깨졌으면 undefined(부르는 쪽이 기본값을 쓴다). */
function readJson(file) {
  try { return JSON.parse(readFileSync(file, 'utf8')) } catch { return undefined }
}

/** 원자적 쓰기: 같은 폴더의 임시 파일 → rename. 같은 글이면 쓰지 않는다. */
function writeAtomic(file, text) {
  try { if (readFileSync(file, 'utf8') === text) return } catch { /* 없거나 못 읽으면 새로 쓴다 */ }
  const tmp = `${file}.${process.pid}.${randomUUID()}.tmp`
  writeFileSync(tmp, text)
  try { renameSync(tmp, file) } catch (e) {
    rmSync(tmp, { force: true })
    throw e
  }
}

/** .sitebrew 폴더를 쓸 수 있게 한다: create 면 부모 폴더가 있을 때 만든다. 쓸 수 있으면 폴더 경로, 아니면 null. */
function recordDir(parent, { create }) {
  if (typeof parent !== 'string' || !parent) return null
  const dir = join(parent, RECORD_DIR)
  if (isDir(dir)) return dir
  if (!create || !isDir(parent)) return null
  mkdirSync(dir)
  return dir
}

/** 합치기: 새 at 이 이기고, 같은 시각이면 글이 큰 쪽(교환·결합·멱등 — 사본이 수렴한다). */
function newer(a, b) {
  if (!a) return b
  if (!b) return a
  if (a.at !== b.at) return a.at > b.at ? a : b
  return JSON.stringify(a) >= JSON.stringify(b) ? a : b
}

const EMPTY = () => ({ door: undefined, level: undefined, lang: undefined, features: undefined, chapters: {}, alternatives: {} })

function mergeStates(states) {
  const out = EMPTY()
  for (const s of states) {
    for (const k of ['door', 'level', 'lang', 'features']) out[k] = newer(out[k], s[k])
    for (const m of ['chapters', 'alternatives']) for (const [k, v] of Object.entries(s[m])) out[m][k] = newer(out[m][k], v)
  }
  return out
}

/** 저장 글: 칸 순서 고정, 맵 키 정렬, 2칸 들여쓰기, 끝 줄바꿈 — 같은 값이면 같은 바이트. */
function serializeState(s) {
  const o = { version: VERSION }
  for (const k of ['door', 'level', 'lang', 'features']) if (s[k]) o[k] = s[k]
  o.chapters = sortedKeys(s.chapters)
  o.alternatives = sortedKeys(s.alternatives)
  return `${JSON.stringify(o, null, 2)}\n`
}

export function createRecord({ secretShapes = [] } = {}) {
  const shapes = secretShapes.map(({ id, re }) => ({ id, re: new RegExp(re) }))

  /** 값 하나 검사 — 패턴 다음에 비밀 모양. phone 은 표 해시에는 보지 않는다(16진 해시에 숫자가 이어질 수 있다). */
  function guard(value, pattern, what, { phone = true } = {}) {
    if (typeof value !== 'string' || !pattern.test(value)) throw new RecordError(`${what}: not an allowed value: ${JSON.stringify(value)}`)
    const hit = shapes.find((s) => s.re.test(value))
    if (hit) throw new RecordError(`${what}: value has a secret shape (${hit.id})`)
    if (EMAIL.test(value)) throw new RecordError(`${what}: value looks like an e-mail address`)
    if (phone && PHONE.test(value)) throw new RecordError(`${what}: value looks like a phone number`)
    return value
  }
  const oneOf = (value, allowed, what) => {
    if (!allowed.includes(value)) throw new RecordError(`${what}: expected one of ${allowed.join('|')}, got ${JSON.stringify(value)}`)
    return value
  }
  const ids = (xs, what) => {
    if (!Array.isArray(xs)) throw new RecordError(`${what}: expected an array`)
    return xs.map((x) => guard(x, ID, what))
  }
  const features = (f) => {
    if (!isObject(f) || Object.keys(f).some((k) => k !== 'table' && k !== 'outcomes')) throw new RecordError('features: expected { table, outcomes }')
    return { table: guard(f.table, HASH, 'features.table', { phone: false }), outcomes: [...new Set(ids(f.outcomes, 'features.outcomes'))].sort() }
  }

  /** 쓰기 patch → 칸마다 at 이 붙은 부분 상태. 틀린 것이 하나라도 있으면 던진다(아무것도 쓰기 전에). */
  function stamp(patch, at) {
    guard(at, TIME, 'at', { phone: false })
    if (!isObject(patch)) throw new RecordError('patch: expected an object')
    const stray = Object.keys(patch).filter((k) => !PATCH_KEYS.has(k))
    if (stray.length) throw new RecordError(`patch: keys not allowed: ${stray.join(', ')}`)
    const s = EMPTY()
    for (const [k, allowed] of Object.entries(SCALARS)) if (k in patch) s[k] = { value: oneOf(patch[k], allowed, k), at }
    if ('features' in patch) s.features = { value: features(patch.features), at }
    if ('chapters' in patch) {
      if (!isObject(patch.chapters)) throw new RecordError('chapters: expected { [gid]: status }')
      for (const [gid, status] of Object.entries(patch.chapters)) s.chapters[guard(gid, GID, 'chapters')] = { status: oneOf(status, STATUSES, `chapters.${gid}`), at }
    }
    if ('alternatives' in patch) for (const role of ids(patch.alternatives, 'alternatives')) s.alternatives[role] = { at }
    return s
  }

  /** 파일의 저장 글 → 부분 상태. 틀린 칸은 버린다(모르는 칸·값·시각·비밀 모양). */
  function parseState(raw) {
    const s = EMPTY()
    if (!isObject(raw) || raw.version !== VERSION) return s
    const keep = (fn) => { try { return fn() || undefined } catch (e) { if (e instanceof RecordError) return undefined; throw e } }
    const timed = (e) => isObject(e) && guard(e.at, TIME, 'at', { phone: false })
    for (const [k, allowed] of Object.entries(SCALARS)) s[k] = keep(() => timed(raw[k]) && { value: oneOf(raw[k].value, allowed, k), at: raw[k].at })
    s.features = keep(() => timed(raw.features) && { value: features(raw.features.value), at: raw.features.at })
    for (const [gid, e] of Object.entries(isObject(raw.chapters) ? raw.chapters : {})) {
      const v = keep(() => timed(e) && guard(gid, GID, 'chapters') && { status: oneOf(e.status, STATUSES, gid), at: e.at })
      if (v) s.chapters[gid] = v
    }
    for (const [role, e] of Object.entries(isObject(raw.alternatives) ? raw.alternatives : {})) {
      const v = keep(() => timed(e) && guard(role, ID, 'alternatives') && { at: e.at })
      if (v) s.alternatives[role] = v
    }
    return s
  }

  /** Delivered 검사 — 칸이 정확히 맞아야 한다. */
  function delivered(d) {
    if (!isObject(d)) throw new RecordError('delivered: expected an object')
    const keys = Object.keys(d).sort()
    if (keys.join() !== [...DELIVERED_KEYS].sort().join()) throw new RecordError(`delivered: keys must be exactly ${DELIVERED_KEYS.join(', ')}`)
    if (d.version !== VERSION) throw new RecordError(`delivered.version: expected ${VERSION}`)
    return {
      version: VERSION,
      applied: d.applied === null ? null : ids(d.applied, 'delivered.applied'),
      unapplied: ids(d.unapplied, 'delivered.unapplied'),
      completion: oneOf(d.completion, COMPLETIONS, 'delivered.completion'),
      locale: oneOf(d.locale, LANGS, 'delivered.locale'),
      tableHash: d.tableHash === null ? null : guard(d.tableHash, HASH, 'delivered.tableHash', { phone: false }),
      deliveredAt: guard(d.deliveredAt, TIME, 'delivered.deliveredAt', { phone: false }),
    }
  }

  /** 쓸 자리들: [부모 폴더, .sitebrew 를 만들어도 되는가] 마다 쓸 수 있는 .sitebrew. 모두에 .gitignore(`*`)가 있게 한다. */
  function targets(parents) {
    const dirs = parents.map(([parent, create]) => recordDir(parent, { create })).filter(Boolean)
    for (const dir of dirs) if (!existsSync(join(dir, '.gitignore'))) writeAtomic(join(dir, '.gitignore'), GITIGNORE)
    return [...new Set(dirs)]
  }
  const readable = ({ run, site } = {}) => [site, run].map((p) => recordDir(p, { create: false })).filter(Boolean)

  return {
    readDelivered(where = {}) {
      for (const dir of readable(where)) {
        try { return delivered(readJson(join(dir, DELIVERED_FILE))) } catch (e) { if (!(e instanceof RecordError)) throw e }
      }
      return null
    },

    recordDelivery({ run, dest } = {}, d) {
      const text = `${JSON.stringify(delivered(d), null, 2)}\n`
      const dirs = targets([[run, true], [dest, true]])
      if (!dirs.length) return { saved: false }
      const files = dirs.map((dir) => join(dir, DELIVERED_FILE))
      for (const f of files) writeAtomic(f, text)
      return { saved: true, files }
    },

    readState(where = {}) {
      const s = mergeStates(readable(where).map((dir) => parseState(readJson(join(dir, STATE_FILE)))))
      return {
        door: s.door?.value ?? null,
        level: s.level?.value ?? null,
        lang: s.lang?.value ?? null,
        features: s.features?.value ?? null,
        chapters: sortedKeys(s.chapters),
        alternatives: Object.keys(s.alternatives).sort(),
      }
    },

    writeState({ run, site } = {}, patch, at) {
      const change = stamp(patch, at)
      const dirs = targets([[run, true], [site, false]])
      if (!dirs.length) return { saved: false }
      const files = dirs.map((dir) => join(dir, STATE_FILE))
      const text = serializeState(mergeStates([...files.map((f) => parseState(readJson(f))), change]))
      for (const f of files) writeAtomic(f, text)
      return { saved: true, files }
    },
  }
}
