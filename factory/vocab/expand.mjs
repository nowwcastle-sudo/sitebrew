// 사전 틀 펼치기(설계 5.5): design-lexicon.yaml 은 막는 말(not)과 「덜 ~」 낱말을 낱말 하나하나가 아니라 틀(templates)로 적고, loadLexicon 이 모양 검사 뒤·항목 사이 규칙 앞에서 이 모듈로 펼친다.
//   그래서 새 낱말을 항목에 보태면 막는 말도 따라온다. 펼친 결과는 crossCheck(낱말 유일)와 해석기가 그대로 본다.
//   틀 다섯 가지(자리표시자는 {n}·{w}·{s}·{a}·{b}):
//     copy      글 속 말투를 가리키는 말(「문구 더 따뜻」)은 색이 아니라 글이다 — 항목의 copyWords 와 글 이름(nouns)을 forms 로 짝지어 그 항목의 not 에 보탠다.
//     dislike   진단 낱말 뒤에 싫다가 이어지는 말(「답답해서 싫」) — 항목의 dislikeStems 를 forms 로 not 에 보탠다.
//     reference 참고 서비스 카드: 모든 reference 항목은 「스타일 결제」 같은 기능 이름(features)을 막고, pairs 로 묶인 카드 둘은 서로의 이름이 접속어로 이어진 말(「애플이나토스」)을 막는다.
//     less      「덜 ~」·「~한 거 줄」: 항목의 lessStems(forms 꼴들)·lessLite(「덜 ~」 하나)로 낱말을 만들어 less.into 항목의 match.ko 에 넣는다. 다른 항목이 이미 가진 낱말은 뺀다(그쪽이 반대 방향으로 풀어 둔 말).
//   마지막으로 두 낱말 이상 표현 「X 나머지」가 세기 낱말에 끊긴 모양을 X 만 가진 항목의 not 에 보탠다(splitPhraseNots).
//   펼친 뒤 틀 전용 필드(copyWords 따위)는 지워서 항목 모양은 늘 같다. 네트워크 없음.
import { z } from 'zod'
import { fill } from './fill.mjs'
import { normalize } from './normalize.mjs'

const hole = (...names) => z.string().min(1).refine((t) => names.every((n) => t.includes(`{${n}}`)), `틀에 ${names.map((n) => `{${n}}`).join(' ')} 자리가 있어야 한다`)
const words = z.array(z.string().min(1)).min(1)

/** yaml 맨 위 expansions 모양. 없어도 된다(틀을 안 쓰는 사전). */
export const expansionsSchema = z.strictObject({
  copy: z.strictObject({ nouns: words, forms: z.array(hole('n', 'w')).min(1) }),
  dislike: z.array(hole('w')).min(1),
  reference: z.strictObject({
    features: z.strictObject({ styles: words, nouns: words, forms: z.array(hole('s', 'n')).min(1) }),
    pairs: z.array(z.tuple([z.string().min(1), z.string().min(1)])),
    pairForms: z.array(hole('a', 'b')).min(1),
  }),
  less: z.strictObject({ into: z.string().min(1), minStem: z.number().int().min(1), forms: z.array(hole('w')).min(1), liteForms: z.array(hole('w')).min(1) }),
}).partial()

/** 항목마다 둘 수 있는 틀 재료. lexicon.mjs 의 항목 모양에 펼쳐 넣는다. */
export const entryTemplateFields = {
  copyWords: words.optional(), // copy 틀의 낱말(예: 따뜻·포근)
  dislikeStems: words.optional(), // dislike 틀의 낱말(예: 답답해·숨막혀)
  cardNames: words.optional(), // reference 의 pairs 에 쓰는 이름들(예: 토스·toss)
  lessStems: z.union([z.literal(true), words]).optional(), // less.forms 의 낱말: true = match.ko 의 띄어쓰기 없는 낱말 전부(minStem 글자 이상), 목록 = 그 낱말만
  lessLite: words.optional(), // less.liteForms(「덜 ~」 하나)만 쓰는 낱말 — 「~한 거 줄」 꼴은 반대쪽 항목이 갖고 있는 축 낱말
}
const TEMPLATE_KEYS = Object.keys(entryTemplateFields)
const FIELD_TEMPLATE = { copyWords: 'copy', dislikeStems: 'dislike', cardNames: 'reference', lessStems: 'less', lessLite: 'less' } // 틀 재료 필드 → 그것을 펼치는 틀

const cross = (templates, lists) => {
  const keys = Object.keys(lists)
  const rows = keys.reduce((acc, k) => acc.flatMap((row) => lists[k].map((v) => ({ ...row, [k]: v }))), [{}])
  return templates.flatMap((t) => rows.map((row) => fill(t, row)))
}
const compactOf = (w) => normalize(w).compact

/**
 * 두 낱말 이상 표현 「X 나머지」(예: tight 의 「여백 줄」)가 세기 낱말에 끊긴 「X 세기낱말 나머지」(「여백 확 줄여」)가 되면
 * X 만 낱말로 가진 다른 항목(airy 의 「여백」)이 대신 맞아 반대 방향으로 읽힌다. 그 항목에서 끊긴 모양을 빼는 목록을 만든다.
 * 세기 낱말은 사전의 세기 modifier 항목(effect.strength)의 낱말 — 새 세기 낱말을 사전에 보태면 따라온다.
 * @returns {Map<string, string[]>} 항목 id → 뺄 표현들
 */
function splitPhraseNots(entries) {
  const intensifiers = entries.filter((e) => e.kind === 'modifier' && e.effect?.strength !== undefined).flatMap((e) => e.match.ko ?? [])
  const bare = new Map() // 낱말 하나짜리 한글 낱말 → 그 낱말을 가진 항목 id
  for (const e of entries) for (const w of e.match.ko ?? []) if (!/\s/.test(w.trim())) bare.set(w.trim(), e.id)
  const out = new Map()
  for (const e of entries) {
    for (const phrase of e.match.ko ?? []) {
      const [head, ...rest] = phrase.trim().split(/\s+/)
      const owner = bare.get(head)
      if (!rest.length || !owner || owner === e.id) continue
      out.set(owner, [...(out.get(owner) ?? []), ...intensifiers.map((w) => [head, w, ...rest].join(' '))])
    }
  }
  return out
}

/** less 틀의 낱말들: 항목마다 lessStems(true | 목록). */
function lessStemsOf(e, minStem) {
  if (e.lessStems === true) return (e.match.ko ?? []).map((w) => w.trim()).filter((w) => w.length >= minStem && !/\s/.test(w))
  return e.lessStems ?? []
}

/**
 * zod 를 통과한 { axes, entries, expansions? } 를 펼친다. 입력은 바꾸지 않고 새 항목 목록을 돌려준다.
 * 틀이 가리키는 곳이 없으면(없는 항목 id · cardNames 없는 카드) 던질 수 있게 problems 를 돌려준다.
 * @returns {{ entries: object[], problems: string[] }}
 */
export function expand({ entries: source, expansions = {} }) {
  const problems = []
  const notes = new Map() // id → 보탤 not
  const addNots = (id, list) => notes.set(id, [...(notes.get(id) ?? []), ...list])

  const { copy, dislike, reference, less } = expansions
  for (const e of source) {
    for (const [field, template] of Object.entries(FIELD_TEMPLATE)) if (e[field] !== undefined && !expansions[template]) problems.push(`${e.id}: ${field} 가 있는데 expansions.${template} 틀이 없다`)
    if (copy && e.copyWords) addNots(e.id, cross(copy.forms, { n: copy.nouns, w: e.copyWords }))
    if (dislike && e.dislikeStems) addNots(e.id, cross(dislike, { w: e.dislikeStems }))
    if (reference && e.kind === 'reference') addNots(e.id, cross(reference.features.forms, { s: reference.features.styles, n: reference.features.nouns }))
  }

  const byId = new Map(source.map((e) => [e.id, e]))
  for (const [x, y] of reference?.pairs ?? []) {
    const [ex, ey] = [byId.get(x), byId.get(y)]
    if (!ex || !ey) { problems.push(`reference.pairs 의 「${!ex ? x : y}」가 사전에 없다`); continue }
    if (!ex.cardNames?.length || !ey.cardNames?.length) { problems.push(`reference.pairs 의 ${!ex.cardNames?.length ? x : y} 에 cardNames 가 없다`); continue }
    addNots(x, cross(reference.pairForms, { a: ey.cardNames, b: ex.cardNames }))
    addNots(y, cross(reference.pairForms, { a: ex.cardNames, b: ey.cardNames }))
  }

  let lessWords = []
  if (less) {
    if (!byId.has(less.into)) problems.push(`less.into 「${less.into}」가 사전에 없다`)
    const owned = new Set(source.filter((e) => e.id !== less.into).flatMap((e) => (e.match.ko ?? []).map(compactOf)))
    const stems = [...new Set(source.flatMap((e) => lessStemsOf(e, less.minStem)))]
    const lite = [...new Set(source.flatMap((e) => e.lessLite ?? []))]
    lessWords = [...new Set([...cross(less.forms, { w: stems }), ...cross(less.liteForms, { w: lite })])].filter((w) => !owned.has(compactOf(w)))
  }

  const expanded = source.map((e) => {
    const out = { ...e, match: { ...e.match } }
    for (const k of TEMPLATE_KEYS) delete out[k]
    if (e.id === less?.into) out.match.ko = [...(e.match.ko ?? []), ...lessWords]
    if (notes.has(e.id)) out.not = [...(e.not ?? []), ...notes.get(e.id)]
    return out
  })

  for (const [id, list] of splitPhraseNots(expanded)) {
    const e = expanded.find((x) => x.id === id)
    e.not = [...(e.not ?? []), ...list]
  }
  return { entries: expanded, problems }
}
