// 런북 모듈의 바깥 면(sitebrew v0.2.0 계획 5 Task 14) — factory/ 의 다른 모듈은 factory/runbook/ 에서 이 파일만 import 한다(boundary.test.mjs 가 막는다).
//   recordDelivery(at, d) — deliver.mjs 만 부른다: 넘겨진 것(Delivered)을 <run>/.sitebrew/delivered.json 과 <dest>/.sitebrew/delivered.json(+ .gitignore)에 남긴다.
//   openRunbook({ site?, run?, lf?, today, lang?, env?, now?, wfRoot? }) → Runbook
//     LF 위치는 resolveLf(--lf → LF_DIR → <wfRoot>/launch-factory → <wfRoot>/../launch-factory), 데이터는 <lf>/docs/runbook/runbook.generated.json.
//     데이터는 처음 쓰일 때 읽는다 — 문(door·answerDoor)은 LF 없이도 돈다(deliver 끝의 문 질문). 데이터 문제는 본문 메서드에서 RunbookToolError(noData|badVersion|hashMismatch).
//     시계는 읽지 않는다: today(YYYY-MM-DD)·now(ISO, 상태 기록 시각 — 없으면 today 의 0시)를 받는다. 한 객체 안의 쓰기는 1ms 씩 늦춰 뒤에 쓴 것이 이긴다.
//
//   Runbook
//     door() → 'ask'|'skip'|'use'                         상태(record.mjs)의 문. 없으면 'ask'. 문은 실행 단위다(<run>/.sitebrew 가 기준).
//     answerDoor('yes'|'no'|'unsure') → 'use'|'skip'      잘 모르겠어요 = 아니요. 기록할 자리가 없으면 이 객체 안에서만 기억한다.
//     canStore() → boolean                                상태를 남길 자리가 있는가(<run> 폴더 또는 <site>/.sitebrew).
//     answerFeatures(ids) → { features, saved }           사용자가 알려 준 켠 기능(성과 id) — requires 를 닫아 기록한다. 문을 열지 않는다.
//     ── 아래는 문이 'use' 가 아니면 DoorClosed ──
//     overview(features?) → { text, plan, level, progress } | NeedsFeatures
//     chapter(gid|'all', level?, { out? }) → { text } | { brief } | { file } | NeedsFeatures      out = 새 파일만(있으면 OutExists)
//     check(gid, draft) → (Problem & { text })[] | NeedsFeatures       detail 에 키 모양 글자가 실리지 않는다
//     alternatives(gid, want?) → alternativesFor 결과 | NeedsFeatures   물어본 역할을 기록한다
//     mark({ gid, status } | { level }) → { saved }
//     redact(text) → text                                  데이터의 키 모양 표에 걸리는 글자를 가린다(CLI 출력의 마지막 방어선)
//
//   선택의 출처 순서: delivered.applied(표 해시가 맞을 때) → 기록된 사용자 답(features, 해시가 맞을 때) → NeedsFeatures(ask.why = noRecord|unknownChoice|tableChanged).
//   소개형으로 추정하지 않는다. 사용자 문장은 데이터(rubric·성과 question)에서만 온다 — 이 파일의 메시지는 개발자용 영어다.
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describeFeatures, loadOutcomes, TableVersionError, toFeatures } from '../intake/features.mjs'
import { resolveLf, TABLE_FILE } from '../intake/resolve-lf.mjs'
import { beginnerBrief, checkBeginner, problemText } from './beginner.mjs'
import { alternativesFor, expertText, overviewText, planRunbook } from './plan.mjs'
import { createRecord, RECORD_DIR, RecordError } from './record.mjs'

const WF_ROOT = join(import.meta.dirname, '..', '..')
export const DATA_FILE = join('docs', 'runbook', 'runbook.generated.json')
const DATA_VERSION = 1
const DAY = /^\d{4}-\d{2}-\d{2}$/
const LANGS = ['ko', 'en']
const LEVELS = ['beginner', 'expert']
const STATUSES = ['doing', 'done', 'skipped']
const WANTS = ['free', 'cheaper', 'better', 'ko']
const ANSWERS = { yes: 'use', no: 'skip', unsure: 'skip' }

/** 데이터·키트 문제(CLI 종료 1). code = noData | badVersion | hashMismatch, next = 다음 행동(개발자용 영어). */
export class RunbookToolError extends Error {
  name = 'RunbookToolError'
  constructor(code, message, next) {
    super(`${message} — next: ${next}`)
    this.code = code
    this.next = next
  }
}
/** 문이 'use' 가 아닌데 본문 메서드를 불렀다(CLI 종료 5). */
export class DoorClosed extends Error {
  name = 'DoorClosed'
  constructor(door) {
    super(`the runbook door is ${door} — ask the door question first (gate)`)
    this.door = door
  }
}
/** 부르는 쪽의 인자가 틀렸다(CLI 종료 2). 메시지는 받은 값을 되풀이하지 않는다(키 모양이 섞일 수 있다). */
export class RunbookArgError extends Error {
  name = 'RunbookArgError'
}
/** --out 파일이 이미 있다(CLI 종료 4) — 덮어쓰지 않는다. */
export class OutExists extends Error {
  name = 'OutExists'
  constructor(file) {
    super(`file already exists, not overwritten: ${file}`)
    this.file = file
  }
}

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const isDir = (p) => existsSync(p) && statSync(p).isDirectory()

/** LF 를 찾아 결과 표와 런북 데이터를 읽는다. 문제는 RunbookToolError 로. */
function loadKit({ lf, env, wfRoot }) {
  // 이름을 댄 --lf 가 키트가 아니면 다른 자리로 넘어가지 않는다(엉뚱한 키트로 런북을 만들지 않게).
  if (lf !== undefined && !existsSync(join(resolve(lf), TABLE_FILE))) throw new RunbookToolError('noData', `--lf is not a launch-factory folder (no ${TABLE_FILE})`, 'pass the launch-factory folder to --lf')
  const lfDir = resolveLf({ arg: lf, env, wfRoot })
  if (!lfDir) throw new RunbookToolError('noData', 'launch-factory not found (tried --lf, LF_DIR, <web-factory>/launch-factory, <web-factory>/../launch-factory)', 'pass --lf <launch-factory folder> or set LF_DIR')
  let table
  try { table = loadOutcomes(lfDir) } catch (e) {
    if (e instanceof TableVersionError) throw new RunbookToolError('badVersion', 'launch-factory outcome table has a version this web-factory does not know', 'use matching web-factory and launch-factory versions')
    throw new RunbookToolError('noData', `launch-factory outcome table is unreadable: ${e.message}`, 'regenerate it in launch-factory (npm run gen:outcomes)')
  }
  const file = join(lfDir, DATA_FILE)
  let data
  try { data = JSON.parse(readFileSync(file, 'utf8')) } catch {
    throw new RunbookToolError('noData', `runbook data missing or unreadable: ${file}`, 'run `npm run runbook:gen` in launch-factory')
  }
  if (data?.version !== DATA_VERSION) throw new RunbookToolError('badVersion', `runbook data version ${JSON.stringify(data?.version)} is not ${DATA_VERSION}: ${file}`, 'use matching web-factory and launch-factory versions')
  const shaped = typeof data.outcomesHash === 'string' && Array.isArray(data.order) && isObject(data.chapters) && isObject(data.outcomes)
    && isObject(data.alternatives) && isObject(data.rubric) && Array.isArray(data.secretShapes)
  if (!shaped) throw new RunbookToolError('noData', `runbook data has the wrong shape: ${file}`, 'run `npm run runbook:gen` in launch-factory')
  if (data.outcomesHash !== table.hash) throw new RunbookToolError('hashMismatch', 'runbook data was generated from another outcome table (outcomesHash differs from the table hash)', 'run `npm run runbook:gen` in launch-factory')
  return { data, table }
}

/** 데이터의 성과 질문 — 결과 표 순서, 표에 없는 것은 id 순으로 뒤에. */
function questionsOf(data, table) {
  const ids = [...table.outcomes].sort((a, b) => a.order - b.order).map((o) => o.id).filter((id) => Object.hasOwn(data.outcomes, id))
  const rest = Object.keys(data.outcomes).filter((id) => !ids.includes(id)).sort()
  return [...ids, ...rest].map((id) => ({ id, ko: data.outcomes[id].question.ko, en: data.outcomes[id].question.en }))
}

/** 글에서 키 모양에 걸리는 조각들. */
const secretHits = (text, shapes) => shapes.flatMap(({ re }) => [...String(text).matchAll(new RegExp(re, 'g'))].map((m) => m[0]))

export function recordDelivery(at, d) {
  return createRecord().recordDelivery(at, d)
}

export function openRunbook({ site, run, lf, today, lang, env = process.env, now, wfRoot = WF_ROOT } = {}) {
  if (!site && !run) throw new RunbookArgError('openRunbook: give site or run')
  if (typeof today !== 'string' || !DAY.test(today)) throw new RunbookArgError('openRunbook: today must be YYYY-MM-DD')
  if (lang !== undefined && !LANGS.includes(lang)) throw new RunbookArgError(`openRunbook: lang must be one of ${LANGS.join('|')}`)
  const base = Date.parse(now ?? `${today}T00:00:00.000Z`)
  if (Number.isNaN(base)) throw new RunbookArgError('openRunbook: now must be an ISO time')
  const where = { run: run ? resolve(run) : undefined, site: site ? resolve(site) : undefined }

  // ── 데이터(처음 쓰일 때 한 번) ──
  let kit
  const tryKit = () => {
    if (kit === undefined) {
      try { kit = loadKit({ lf, env, wfRoot }) } catch (e) {
        if (!(e instanceof RunbookToolError)) throw e
        kit = e
      }
    }
    return kit
  }
  const needKit = () => {
    const k = tryKit()
    if (k instanceof Error) throw k
    return k
  }
  const shapes = () => (tryKit() instanceof Error ? [] : kit.data.secretShapes)

  // ── 상태(record.mjs 위임 + 남길 자리가 없을 때의 기억) ──
  let rec
  const record = () => (rec ??= createRecord({ secretShapes: shapes() }))
  let tick = 0
  const at = () => new Date(base + tick++).toISOString()
  const memory = { door: undefined, level: undefined, features: undefined, chapters: {}, alternatives: [] }

  function write(patch) {
    let r
    try { r = record().writeState(where, patch, at()) } catch (e) {
      if (e instanceof RecordError) throw new RunbookArgError('a value was not accepted by the state record (only ids, enums and times are stored)')
      throw e
    }
    if (!r.saved) {
      for (const k of ['door', 'level']) if (k in patch) memory[k] = patch[k]
      if (patch.features) memory.features = { table: patch.features.table, outcomes: [...new Set(patch.features.outcomes)].sort() }
      for (const [gid, status] of Object.entries(patch.chapters ?? {})) memory.chapters[gid] = { status, at: at() }
      memory.alternatives = [...new Set([...memory.alternatives, ...(patch.alternatives ?? [])])].sort()
    }
    return { saved: r.saved }
  }

  function state() {
    const s = record().readState(where)
    return {
      door: memory.door !== undefined ? memory.door : s.door,
      level: memory.level ?? s.level,
      features: memory.features ?? s.features,
      chapters: { ...s.chapters, ...memory.chapters },
      alternatives: [...new Set([...s.alternatives, ...memory.alternatives])].sort(),
    }
  }

  const door = () => state().door ?? 'ask'
  function requireDoor() {
    const d = door()
    if (d !== 'use') throw new DoorClosed(d)
  }

  // ── 선택과 계획 ──
  function selection() {
    const { data, table } = needKit()
    const hash = data.outcomesHash
    const d = record().readDelivered(where)
    const useLang = lang ?? d?.locale ?? 'ko'
    if (d && Array.isArray(d.applied) && d.tableHash === hash) return { delivered: d, lang: useLang }
    const told = state().features
    if (told && told.table === hash) {
      const completion = d?.completion ?? (describeFeatures(told, table, { loopSteps: {} }).product ? 'composed' : 'site')
      return { delivered: { applied: told.outcomes, unapplied: d?.unapplied ?? [], completion, locale: d?.locale ?? useLang }, lang: useLang }
    }
    const changed = (d && d.tableHash !== null && d.tableHash !== hash) || (told && told.table !== hash)
    const why = changed ? 'tableChanged' : d ? 'unknownChoice' : 'noRecord'
    return { ask: { why, questions: questionsOf(data, table) } }
  }

  function planned() {
    const sel = selection()
    if (sel.ask) return sel
    const plan = planRunbook(kit.data, sel.delivered, { lang: sel.lang, today })
    const unapplied = new Set(sel.delivered.unapplied)
    return { plan, applied: sel.delivered.applied.filter((id) => !unapplied.has(id)) }
  }

  const inPlan = (plan, gid) => {
    if (!plan.chapters.includes(gid)) throw new RunbookArgError(`chapter is not in this site's runbook — chapters: ${plan.chapters.join(', ')}`)
  }

  function writeNew(file, text) {
    const target = resolve(file)
    try { writeFileSync(target, text, { flag: 'wx' }) } catch (e) {
      if (e.code === 'EEXIST') throw new OutExists(target)
      if (e.code === 'ENOENT') throw new RunbookArgError('the folder for --out does not exist')
      throw e
    }
    return target
  }

  function answerFeatures(ids) {
    const { data, table } = needKit()
    const known = (id) => Object.hasOwn(data.outcomes, id) && table.outcomes.some((o) => o.id === id)
    if (!Array.isArray(ids) || !ids.every((id) => typeof id === 'string' && known(id))) {
      throw new RunbookArgError(`unknown feature id — known: ${Object.keys(data.outcomes).join(', ')}`)
    }
    const { outcomes } = toFeatures(Object.fromEntries(ids.map((id) => [id, true])), table)
    const { saved } = write({ features: { table: data.outcomesHash, outcomes } })
    return { features: outcomes, saved }
  }

  return {
    door,
    canStore: () => Boolean((where.run && isDir(where.run)) || (where.site && isDir(join(where.site, RECORD_DIR)))),

    answerDoor(answer) {
      if (!Object.hasOwn(ANSWERS, answer)) throw new RunbookArgError(`answer must be one of ${Object.keys(ANSWERS).join('|')}`)
      write({ door: ANSWERS[answer] })
      return ANSWERS[answer]
    },

    answerFeatures,

    overview(features) {
      requireDoor()
      if (features !== undefined) answerFeatures(features)
      const p = planned()
      if (p.ask) return p
      const s = state()
      return {
        text: overviewText(p.plan, kit.data, { lang: p.plan.lang, today }),
        plan: p.plan,
        level: s.level,
        progress: Object.fromEntries(Object.entries(s.chapters).map(([gid, v]) => [gid, v.status])),
      }
    },

    chapter(gid, level, { out } = {}) {
      requireDoor()
      if (level !== undefined && !LEVELS.includes(level)) throw new RunbookArgError(`level must be one of ${LEVELS.join('|')}`)
      const p = planned()
      if (p.ask) return p
      const { plan } = p
      const useLevel = level ?? (gid === 'all' ? 'expert' : state().level ?? 'expert')
      let text
      if (gid === 'all') {
        if (useLevel !== 'expert') throw new RunbookArgError('the beginner level goes one chapter at a time — give a chapter id')
        text = expertText(plan, kit.data, { lang: plan.lang, today })
      } else {
        inPlan(plan, gid)
        if (useLevel === 'beginner') {
          if (out !== undefined) throw new RunbookArgError('--out saves expert text only')
          return { brief: beginnerBrief(plan, kit.data, { lang: plan.lang, gid }) }
        }
        const one = { ...plan, chapters: [gid], missing: [], stale: plan.stale.filter((g) => g === gid) }
        text = expertText(one, kit.data, { lang: plan.lang, today })
      }
      if (out !== undefined) return { file: writeNew(out, text) }
      return { text }
    },

    check(gid, draft) {
      requireDoor()
      if (typeof draft !== 'string') throw new RunbookArgError('check: draft must be text')
      const p = planned()
      if (p.ask) return p
      inPlan(p.plan, gid)
      const { data } = kit
      const lang = p.plan.lang
      const { chapter } = beginnerBrief(p.plan, data, { lang, gid })
      const hits = secretHits(draft, data.secretShapes)
      const hidden = (detail) => hits.some((h) => h.includes(detail) || detail.includes(h))
      return checkBeginner(draft, chapter, { lang, today }).map((pr) => ({
        rule: pr.rule,
        detail: pr.rule !== 'secret-shape' && hidden(pr.detail) ? 'secret-shape' : pr.detail,
        text: problemText(pr, data, lang),
      }))
    },

    alternatives(gid, want) {
      requireDoor()
      if (want !== undefined && !WANTS.includes(want)) throw new RunbookArgError(`want must be one of ${WANTS.join('|')}`)
      const { data } = needKit()
      const role = data.chapters[gid]?.card?.role
      if (!role) throw new RunbookArgError(`no chapter card for that id — chapters: ${Object.keys(data.chapters).join(', ')}`)
      const p = planned()
      if (p.ask) return p
      const result = alternativesFor(data, gid, { want, applied: p.applied })
      write({ alternatives: [role] })
      return result
    },

    mark(c) {
      requireDoor()
      if (!isObject(c)) throw new RunbookArgError('mark: expected { gid, status } or { level }')
      if ('level' in c) {
        if (!LEVELS.includes(c.level)) throw new RunbookArgError(`level must be one of ${LEVELS.join('|')}`)
        return write({ level: c.level })
      }
      const { data } = needKit()
      if (!Object.hasOwn(data.chapters, c.gid)) throw new RunbookArgError(`no chapter with that id — chapters: ${Object.keys(data.chapters).join(', ')}`)
      if (!STATUSES.includes(c.status)) throw new RunbookArgError(`status must be one of ${STATUSES.join('|')}`)
      return write({ chapters: { [c.gid]: c.status } })
    },

    redact(text) {
      let out = String(text)
      for (const h of secretHits(out, shapes())) out = out.split(h).join('[secret-shape]')
      return out
    },
  }
}
