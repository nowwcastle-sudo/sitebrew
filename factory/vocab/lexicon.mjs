// 디자인 어휘 사전 로더(설계 5.2~5.5). 원본 factory/vocab/design-lexicon.yaml 을 읽어 모양(zod)과 항목 사이 규칙을 검사한다.
//   모양: 축 12개(AXES 순서)·세기 0..strengthMax(grammar.yaml)·범위 문자열·갈래(KINDS).
//   항목 사이: 낱말(정규화한 형태)은 한 항목에만 · reading 축은 1~4개 · 두 항목이 축 3개 이상 겹치면 합친다 · id 유일.
//   Ruling 2: confidence low 항목은 causes 가 정확히 2개(진단 causes 와 같은 모양).
//   Ruling 3: reading 은 direction(축 ends 둘 중 하나) 또는 value(ends 없는 축) 중 정확히 하나를 갖는다. strength 는 0..strengthMax 크기다(부호는 direction 이 지닌다).
//   Ruling 5: 축 겹침(≥3) 규칙은 reading 에만 건다. causes 는 제외 — 보여 주며 묻는 항목은 서로 겹치는 게 설계다.
//   틀: yaml 의 expansions(막는 말·「덜 ~」 낱말의 틀)는 모양 검사 뒤 항목 사이 규칙 앞에서 expand.mjs 가 펼친다. 해석기는 펼친 사전을 본다.
// 네트워크 없음. 의존성은 yaml·zod 뿐.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'
import { z } from 'zod'
import { entryTemplateFields, expand, expansionsSchema } from './expand.mjs'
import { grammar } from './grammar.mjs'
import { normalize } from './normalize.mjs'

export const AXES = Object.freeze([
  'color-hue', 'color-lightness', 'color-saturation', 'color-temperature', 'palette-count', 'contrast',
  'type-family', 'type-scale', 'spacing', 'shape', 'depth', 'motion',
])
/** 맞추는 순서(설계 5.8: E 먼저 떼고 D → C → B → A). */
export const KINDS = Object.freeze(['modifier', 'reference', 'diagnosis', 'impression', 'axis'])
export const DEFAULT_FILE = join(dirname(fileURLToPath(import.meta.url)), 'design-lexicon.yaml')

export class LexiconError extends Error {
  constructor(message, ids = []) {
    super(message)
    this.name = 'LexiconError'
    this.ids = ids
  }
}

const SCOPE = /^(site|page:[^\s:]+|section:[^\s:]+|element:(제목|본문|버튼|사진|배경|아이콘))$/
const scope = z.string().regex(SCOPE, '범위는 site | page:<키> | section:<키> | element:<제목|본문|버튼|사진|배경|아이콘>')
const strength = z.number().int().min(0).max(grammar.limits.strengthMax)
const reading = z.strictObject({
  axis: z.enum(AXES),
  direction: z.string().min(1).optional(),
  value: z.string().min(1).optional(),
  strength: strength.optional(),
  scope: scope.optional(),
  cap: z.literal(true).optional(),
})
const readings = z.array(reading)
const cause = z.strictObject({ reading: readings.min(1), say: z.string().min(1), sayEn: z.string().min(1).optional() })

const entry = z.strictObject({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/, 'id 는 영어 소문자·숫자·-'),
  kind: z.enum(KINDS),
  label: z.string().min(1),
  match: z.strictObject({ ko: z.array(z.string().min(1)).optional(), en: z.array(z.string().min(1)).optional() }),
  not: z.array(z.string()).optional(),
  reading: readings.optional(),
  causes: z.array(cause).optional(),
  ask: z.string().min(1).optional(),
  askEn: z.string().min(1).optional(), // 영어 입력에 되물을 때의 질문(없으면 해석기의 기본 영어 질문)
  say: z.strictObject({ ko: z.string().min(1), en: z.string().min(1) }).optional(),
  confidence: z.enum(['high', 'low']).optional(),
  mood: z.strictObject({ tokens: z.array(z.string()), recipeTokens: z.array(z.string()) }).optional(),
  effect: z.strictObject({ strength: strength.optional(), cap: z.literal(true).optional(), scope: scope.optional() }).optional(),
  ...entryTemplateFields, // 막는 말·「덜 ~」 낱말의 틀 재료 — expand.mjs 가 펼친 뒤 지운다
})

const axisDef = z.strictObject({
  label: z.string().min(1),
  ends: z.tuple([z.string().min(1), z.string().min(1)]).optional(),
  endLabels: z.tuple([z.string().min(1), z.string().min(1)]).optional(),
  valueLabels: z.record(z.string().min(1), z.string().min(1)).optional(), // ends 없는 축(color-hue·type-family)의 값 id → 사용자에게 보일 한국어
  order: z.array(z.string().min(1)).min(2).optional(), // 순서형 축의 값 줄(낮은 쪽 → 높은 쪽)
  rank: z.record(z.string().min(1), z.number().int().min(0)).optional(), // 등급형 축의 값 → 등급(같은 등급은 같은 칸, 낮은 등급 = ends[0] 쪽)
  names: z.array(z.string().min(1).refine((k) => { try { return !!new RegExp(k, 'i') } catch { return false } }, '정규식 원문이어야 한다')).min(1).optional(), // 사용자가 이 축을 이름으로 부르는 말(정규식 원문 · 대소문자 무시)
  sectionIntent: z.record(z.string().min(1), z.union([z.string().min(1), z.record(z.string().min(1), z.string().min(1))])).optional(), // 구획 교체로 실행할 때 방향(ends) → 구획 의도
})
const names = z.array(z.string().min(1)).min(1)
// 말 → 구획·쪽 이름표: kind = 사이트 구획 kind 에 맞추는 정규식 원문, extraSections 는 구조 조작만 쓰는 이름표, pages = 쪽 키 → 쪽을 가리키는 말
const sectionNames = z.array(z.strictObject({ kind: z.string().min(1).refine((k) => { try { return !!new RegExp(k) } catch { return false } }, '정규식 원문이어야 한다'), words: names }))
const reviseWords = z.strictObject({ sections: sectionNames, extraSections: sectionNames, pages: z.record(z.string().min(1), names) })
const file = z.strictObject({ axes: z.record(z.string(), axisDef), revise: reviseWords, expansions: expansionsSchema.optional(), entries: z.array(entry) })

const axesOf = (rs) => new Set((rs ?? []).map((r) => r.axis))
const wordKeys = (e) => [
  ...(e.match.ko ?? []).map((w) => normalize(w).compact),
  ...(e.match.en ?? []).map((w) => w.trim().toLowerCase()),
].filter(Boolean)

/** 모양(zod)을 통과한 뒤의 항목 사이 규칙. 위반을 모아 한 번에 던진다. */
function crossCheck(lex) {
  const problems = []
  const ids = []
  const bad = (msg, ...who) => { problems.push(`${msg} [${who.join(', ')}]`); ids.push(...who) }

  const keys = Object.keys(lex.axes)
  if (keys.length !== AXES.length || keys.some((k, i) => k !== AXES[i])) bad(`axes 는 ${AXES.join(' ')} 12개가 이 순서로 있어야 한다(지금: ${keys.join(' ')})`)

  // direction 은 그 축 ends 둘 중 하나, value 는 ends 없는 축(color-hue·type-family)의 값. 둘 다 없거나 둘 다 있으면 거부.
  const checkReading = (x, id) => {
    const ends = lex.axes[x.axis]?.ends
    if (x.direction === undefined && x.value === undefined) return bad(`reading(${x.axis})에 direction 도 value 도 없다`, id)
    if (x.direction !== undefined && x.value !== undefined) return bad(`reading(${x.axis})에 direction 과 value 가 함께 있다`, id)
    if (x.direction !== undefined && !ends?.includes(x.direction)) bad(`reading(${x.axis})의 direction 「${x.direction}」이 축 ends(${ends?.join(' ') ?? '없음'})에 없다`, id)
    if (x.value !== undefined && !lex.axes[x.axis]?.valueLabels?.[x.value]) bad(`reading(${x.axis})의 value 「${x.value}」에 valueLabels 한국어 이름이 없다`, id)
  }

  // 순서·등급·구획 의도는 ends 가 있는 축의 사실이다. 순서형(order)과 등급형(rank)은 한 축에 함께 두지 않는다. sectionIntent 의 키는 그 축 ends 중 하나.
  for (const [axis, def] of Object.entries(lex.axes)) {
    if ((def.order || def.rank || def.sectionIntent) && !def.ends) bad(`축 ${axis}: order·rank·sectionIntent 는 ends 가 있는 축에만 둘 수 있다`)
    if (def.order && def.rank) bad(`축 ${axis}: order 와 rank 를 함께 둘 수 없다`)
    for (const k of Object.keys(def.sectionIntent ?? {})) if (!def.ends?.includes(k)) bad(`축 ${axis}: sectionIntent 키 「${k}」가 ends(${def.ends?.join(' ') ?? '없음'})에 없다`)
  }

  const seenId = new Map()
  const owner = new Map() // 정규화한 낱말 → 항목 id
  for (const e of lex.entries) {
    if (seenId.has(e.id)) bad('id 가 둘이다', e.id)
    seenId.set(e.id, e)

    if (!wordKeys(e).length) bad('match 낱말이 없다', e.id)
    for (const w of new Set(wordKeys(e))) {
      const prev = owner.get(w)
      if (prev && prev !== e.id) bad(`낱말 「${w}」가 두 항목에 있다`, prev, e.id)
      else owner.set(w, e.id)
    }

    const n = axesOf(e.reading).size
    if (e.reading) {
      if (n > 4) bad(`reading 축이 ${n}개다(1~4개)`, e.id)
      if (n === 0 && e.kind !== 'modifier') bad('reading 축이 0개다(1~4개)', e.id)
    } else if (!['diagnosis', 'modifier'].includes(e.kind) && e.confidence !== 'low') {
      bad('reading 이 없다', e.id)
    }
    for (const c of e.causes ?? []) {
      const cn = axesOf(c.reading).size
      if (cn < 1 || cn > 4) bad(`causes 의 reading 축이 ${cn}개다(1~4개)`, e.id)
      for (const x of c.reading) checkReading(x, e.id)
    }
    for (const x of e.reading ?? []) checkReading(x, e.id)
    if (e.kind === 'diagnosis') {
      if (!e.causes?.length) bad('diagnosis 는 causes 가 1개 이상이어야 한다', e.id)
      if (!e.ask) bad('diagnosis 는 ask 가 있어야 한다', e.id)
    }
    if (e.confidence === 'low' && e.causes?.length !== 2) bad(`confidence low 항목은 causes 가 정확히 2개여야 한다(지금 ${e.causes?.length ?? 0}개)`, e.id)
  }

  // 겹침 규칙은 reading 에만 건다 — causes 는 제외(Ruling 5): 보여 주며 묻는 항목은 서로 겹치는 게 설계다.
  const withReading = lex.entries.filter((e) => e.reading?.length)
  for (let i = 0; i < withReading.length; i++) {
    for (let j = i + 1; j < withReading.length; j++) {
      const a = axesOf(withReading[i].reading)
      const shared = [...axesOf(withReading[j].reading)].filter((x) => a.has(x))
      if (shared.length >= 3) bad(`reading 축 ${shared.length}개(${shared.join(' ')})가 같다 — 합쳐야 한다`, withReading[i].id, withReading[j].id)
    }
  }

  if (problems.length) throw new LexiconError(`사전 규칙 위반 ${problems.length}건:\n- ${problems.join('\n- ')}`, [...new Set(ids)])
}

/** @param {string} [path] 기본은 factory/vocab/design-lexicon.yaml */
export function loadLexicon(path = DEFAULT_FILE) {
  let doc
  try { doc = parse(readFileSync(path, 'utf8')) } catch (err) { throw new LexiconError(`사전 파일을 읽지 못했다: ${err.message}`) }
  const r = file.safeParse(doc)
  if (!r.success) {
    const lines = r.error.issues.map((i) => {
      const at = i.path.join('.')
      const idx = i.path[0] === 'entries' && typeof i.path[1] === 'number' ? doc.entries?.[i.path[1]]?.id : undefined
      return `${idx ? `[${idx}] ` : ''}${at}: ${i.message}`
    })
    const ids = r.error.issues.map((i) => (i.path[0] === 'entries' && typeof i.path[1] === 'number' ? doc.entries?.[i.path[1]]?.id : undefined)).filter(Boolean)
    throw new LexiconError(`사전 모양 위반 ${lines.length}건:\n- ${lines.join('\n- ')}`, [...new Set(ids)])
  }
  const { entries, problems } = expand(r.data) // 틀을 펼친 뒤에 검사한다 — 펼친 낱말도 한 항목에만 있어야 한다
  if (problems.length) throw new LexiconError(`사전 틀 위반 ${problems.length}건:\n- ${problems.join('\n- ')}`)
  const lex = { axes: r.data.axes, revise: r.data.revise, entries }
  crossCheck(lex)
  return lex
}

/** 사전이 쓰는 범위 id 전부(site 포함, 사전에 나온 순서). 예측 파일 검사와 분류기 지시서가 같은 곳에서 가져온다. */
export function scopesOf(lex) {
  const used = lex.entries.flatMap((e) => [e.effect?.scope, ...(e.reading ?? []).map((r) => r.scope)])
  return ['site', ...new Set(used.filter((s) => s && s !== 'site'))]
}

const tableOf = (rows) => rows.map((e) => ({ kind: new RegExp(e.kind), words: e.words }))
/** 구획 이름표 — [{ kind: RegExp(사이트 구획 kind 에 맞춘다), words }]. 사전 revise.sections 가 유일본이다. */
export const sectionWordsOf = (lex) => tableOf(lex.revise.sections)
/** 구조 조작만 쓰는 구획 이름표 — sectionWordsOf 와 같은 모양. 사전 revise.extraSections. */
export const extraSectionWordsOf = (lex) => tableOf(lex.revise.extraSections)
/** 쪽 이름표 — 쪽 키 → 그 쪽을 가리키는 낱말. 사전 revise.pages. */
export const pageWordsOf = (lex) => lex.revise.pages

/** 문장이 이름으로 부른 축들(axes.<축>.names 정규식에 맞는 축 id). 방향 낱말과 별개다 — 「색 바꿔줘」의 색. */
export const axesNamedIn = (lex, text) => Object.entries(lex.axes).filter(([, def]) => (def.names ?? []).some((n) => new RegExp(n, 'i').test(text))).map(([id]) => id)
