// 해석기(설계 5.6~5.8): 초보자의 막연한 수정 문장 → 사전이 허락한 해석(축·방향·세기·범위). LLM 은 해석하지 않는다, 사전이 정한다.
//   1) 문장을 normalize 로 접는다(조사·어미·띄어쓰기 제거). 한글 낱말은 접힌 문장(compact) 위에서, 영어 낱말은 단어 경계로 찾는다.
//   2) KINDS 순서(modifier → reference → diagnosis → impression → axis)로 맞춘다. 앞 갈래가 쓴 구간은 뒤 갈래가 다시 쓰지 않는다. 같은 갈래 안에서는 긴 낱말이 먼저.
//   3) modifier 의 effect(strength·cap·scope)는 cap 이 있으면 바로 앞, 없으면 바로 뒤 낱말 묶음의 reading 에 붙인다.
//      부정(cap)이 앞 묶음과 모르는 낱말 하나(「세지 않게」) 건너에 있으면 걸린 말일 수 있어 버리지 않고 되묻는다. 둘 이상 건너면 다른 절의 말이라 버린다.
//   4) 결과: 확정(confirmed) · 후보 둘(two) · 모름(unknown). 진단은 절대 확정이 되지 않는다(5.6) — 원인 둘 이상이면 앞의 둘로 two, 하나뿐이면 질문.
//      confidence low 항목도 causes 두 개로 two 가 된다(Ruling 2). 같은 축 반대 방향이 남으면 unknown.
//      결과의 필드(kind·lead·options·unmatched 따위)는 classify.mjs 의 Classification 한 곳에 적혀 있다(설계 5.11 대략 분류).
// say·ask 는 입력에 한글이 있으면 한국어, 아니면 영어. 네트워크 없음.
import { fill } from './fill.mjs'
import { grammar } from './grammar.mjs'
import { KINDS, loadLexicon } from './lexicon.mjs'
import { normalize } from './normalize.mjs'

// 말본 낱말·숫자·되묻는 글은 grammar.yaml 에서 온다(낱말을 코드에 박지 않는다). 짧은 한글 낱말은 낱말 처음에 오고 그 뒤가 TAILS, DESIGN_SUFFIXES + TAILS,
// LINKS + TAILS 일 때만 맞춘다 — 「밝기는」「그 차가」「레드향」「화이트보드」「다크서클」처럼 다른 낱말의 일부로는 안 맞춘다(findSpans).
const HANGUL = /[ㄱ-ㆎ가-힣]/
const { match: G, limits: LIMITS, text: TEXT } = grammar
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const anyOf = (xs) => xs.map(escapeRe).join('|')
const DESIGN_SUFFIXES = G.designSuffixes
const LINKS = G.links
const LINK_BLOCK = new Set(G.linkBlock)
const TAILS = new Set(['', ...grammar.normalize.endings, ...G.tails])
const GAP_OK = new Set(G.gapOk)
const PRE_NEG = new Set(G.preNeg)
const PROHIBIT_WORDS = new Set(G.prohibitWords)
const DO_VERB = new RegExp(`^(${anyOf(G.doVerbStems)})`)
const PROHIBIT_REST = new RegExp(`^(${anyOf(G.prohibitStems)})(?!${anyOf(G.prohibitNotBefore)})`)
const QUESTION = new RegExp(`[${escapeRe(G.questionMarks.join(''))}]`)
const PREDICATE_END = new RegExp(`(${anyOf(G.predicateEnds)})$`)
// 시안 비교 말(갈래 D)의 틀 — grammar.yaml match.candidate. 번호가 든 틀은 번호 낱말도 받고, 「아까 것」은 번호가 없을 때만 본다.
const CAND = G.candidate
const loose = (piece) => [...piece].map(escapeRe).join('\\s*') // 글자 사이 띄어쓰기는 있어도 없어도 된다(「첫 번째」「previous one」)
const NUMBER = `\\s*(\\d+|${anyOf(Object.keys(CAND.numberWords))})\\s*`
const indexRe = (form, after = '') => new RegExp(`(?<![a-z])${form.split('{n}').map(loose).join(NUMBER)}${after}(?!\\d)`, 'g')
const BARE_MARK = `(?=\\s*(?:${CAND.bareMarks.map(loose).join('|')}))` // 「{n}번 안」은 바로 뒤에 비교 표지가 붙을 때만 시안 말이다
const INDEX_RES = [...CAND.indexForms.map((f) => indexRe(f)), ...CAND.bareForms.map((f) => indexRe(f, BARE_MARK))]
const PREVIOUS_RE = new RegExp(`(?<![a-z])(${CAND.previousWords.map(loose).join('|')})`)

let defaultLex
const uniq = (xs) => [...new Set(xs)]
const overlap = (a, b) => a[0] < b[1] && b[0] < a[1]

// 사전마다 한 번: 항목별 낱말 키(정규화한 형태). 사전 객체는 읽기 전용이라 WeakMap 으로 둔다.
const compiled = new WeakMap()

function compile(lex) {
  let c = compiled.get(lex)
  if (!c) {
    c = lex.entries.map((e) => ({
      e,
      ko: uniq((e.match.ko ?? []).map((w) => normalize(w).compact).filter(Boolean)),
      glued: new Set((e.match.ko ?? []).filter((w) => /\s/.test(w.trim())).map((w) => normalize(w).compact)), // 띄어쓰기가 든 낱말 — 짧아도 낱말 경계 규칙을 받지 않는다
      en: uniq((e.match.en ?? []).map((w) => w.trim().toLowerCase()).filter(Boolean)),
      not: uniq((e.not ?? []).map((w) => normalize(w).compact).filter(Boolean)), // 펼친 막는 말 전부(expand.mjs 가 끊긴 표현 막기까지 보탠 사전)
    }))
    compiled.set(lex, c)
  }
  return c
}

function spansOf(text, key) {
  const out = []
  for (let i = text.indexOf(key); i >= 0; i = text.indexOf(key, i + 1)) out.push([i, i + key.length])
  return out
}

const tailOk = (rest) => TAILS.has(rest) || DESIGN_SUFFIXES.some((x) => rest.startsWith(x) && TAILS.has(rest.slice(x.length))) || LINKS.some((x) => rest.startsWith(x) && !LINK_BLOCK.has(rest.slice(x.length)) && TAILS.has(rest.slice(x.length)))

/** 한 항목이 문장에서 맞는 구간들. 영어는 단어 통째로만, not 낱말과 겹치면 버린다. 짧은 한글 낱말(limits.shortKeyMax 이하·사전 표기에 띄어쓰기 없음)은 낱말 처음에서 시작해야 하고(여러 낱말에 걸쳐도 된다 — 「고 급」처럼 글자마다 띄운 입력), 낱말의 끝 글자가 든 낱말에서 키 뒤에 남는 부분이 tailOk(어미·조사 | 붙임말 + 어미 | 풀이 조각 + 어미)일 때만 맞춘다. */
function findSpans(c, n) {
  const spans = []
  for (const key of c.ko) {
    for (const sp of spansOf(n.compact, key)) {
      if (key.length <= LIMITS.shortKeyMax && !c.glued.has(key)) {
        const t0 = n.tokens.find((x) => x.start === sp[0]) // 낱말 처음에서 시작해야 한다
        const te = n.tokens.find((x) => x.start < sp[1] && sp[1] <= x.end) // 끝 글자가 든 낱말 — 그 낱말의 남은 부분이 어미·조사여야 한다
        if (!t0 || !te || !tailOk(n.compact.slice(sp[1], te.end))) continue
      }
      spans.push([...sp, 'ko'])
    }
  }
  for (const key of c.en) for (const l of n.latin) if (l.word === key) spans.push([l.start, l.end, 'en'])
  if (!c.not.length) return spans
  const nots = c.not.flatMap((k) => spansOf(n.compact, k))
  return spans.filter((sp) => !nots.some((x) => overlap(sp, x)))
}

/** KINDS 순서로 구간을 쓴다. 반환은 문장 순서. */
function matchAll(comp, n) {
  const consumed = []
  const hits = []
  for (const kind of KINDS) {
    const cands = []
    for (const c of comp) if (c.e.kind === kind) for (const [start, end, lang] of findSpans(c, n)) cands.push({ c, start, end, lang })
    cands.sort((a, b) => (b.end - b.start) - (a.end - a.start) || a.start - b.start)
    for (const h of cands) {
      if (consumed.some((x) => overlap([h.start, h.end], x))) continue
      consumed.push([h.start, h.end])
      hits.push(h)
    }
  }
  return hits.sort((a, b) => a.start - b.start)
}

/** reading 에 modifier 효과를 입혀 출력 모양으로. strength = 효과 → 항목 → 1, scope = 효과 → 항목 → site. */
function stamp(rs, source, ef) {
  return rs.map((r) => {
    const out = { axis: r.axis }
    if (r.direction !== undefined) out.direction = r.direction
    if (r.value !== undefined) out.value = r.value
    out.strength = ef.strength ?? r.strength ?? 1
    out.scope = ef.scope ?? r.scope ?? 'site'
    if (ef.cap ?? r.cap) out.cap = true
    out.source = source
    return out
  })
}

const keyOf = (x) => `${x.axis}|${x.direction ?? `v:${x.value}`}|${x.scope}|${x.cap ? 1 : 0}`
/** 같은 축·방향·범위·상한 여부가 같은 reading 은 하나로(세기는 큰 쪽, 출처는 먼저 나온 쪽). */
function merge(readings) {
  const seen = new Map()
  for (const x of readings) {
    const prev = seen.get(keyOf(x))
    if (!prev) seen.set(keyOf(x), { ...x })
    else if (x.strength > prev.strength) prev.strength = x.strength
  }
  return [...seen.values()]
}

/** 같은 축·범위에서 서로 다른 방향(값)이 함께 켜져 있거나, 상한이 붙은 방향을 다시 올리라는 reading 이 있으면 부딪친 항목 id 들을 돌려준다. */
function clash(readings) {
  const byAxis = new Map()
  for (const x of readings) {
    const k = `${x.axis}|${x.scope}`
    if (!byAxis.has(k)) byAxis.set(k, [])
    byAxis.get(k).push(x)
  }
  for (const xs of byAxis.values()) {
    const dir = (x) => x.direction ?? `v:${x.value}`
    const ups = xs.filter((x) => x.strength > 0 && !x.cap)
    const caps = xs.filter((x) => x.cap)
    const sources = []
    if (uniq(ups.map(dir)).length > 1) sources.push(...ups.map((x) => x.source))
    for (const c of caps) for (const u of ups) if (dir(c) === dir(u)) sources.push(c.source, u.source)
    if (sources.length) return uniq(sources)
  }
  return null
}

/** 구간 [a,b) 에 걸친 낱말 중 사전 낱말도 군말도 아닌 것의 수 */
function strays(n, hits, a, b) {
  return n.tokens.filter((t) => t.start < b && t.end > a && !hits.some((h) => h.start < t.end && h.end > t.start) && !GAP_OK.has(n.compact.slice(t.start, t.end))).length
}

/** 묶음이 걸친 낱말이 이미 서술어로 끝나는가(「그림자」는 아니고 「둥글게」는 맞다) */
function hasPredicate(n, g) {
  const t = n.tokens.find((x) => x.start < g.end && g.end - 1 < x.end)
  return Boolean(t) && PREDICATE_END.test(t.raw)
}

/** 범위가 붙은 말 앞에 놓는 글(사이트 전체면 빈 글). */
function scopeText(scope, lang) {
  const [kind, key] = (scope ?? 'site').split(/:(.*)/)
  return kind === 'site' ? '' : fill(TEXT.scope[kind][lang], { key })
}

/** 낱말 묶음 하나를 사용자에게 보일 문장으로. 상한이 붙은 묶음은 「그 쪽으로는 더 가지 않게」. */
function sayOf(g, lang) {
  const e = g.c.e
  const prefix = scopeText(g.effect.scope, lang)
  if (g.effect.cap) return prefix + fill(TEXT.say.cap[lang], { label: e.label })
  return prefix + (e.say?.[lang] ?? fill(TEXT.say.plain[lang], { label: e.label }))
}

const unknown = (ask, choices = []) => ({ result: 'unknown', ask, choices })

/** 문장이 가리킨 시안 — 번호가 든 말이 먼저(번호가 이긴다), 없으면 「아까 것」. 번호가 둘 이상 다르면 many. 가리킨 시안이 없으면 null. */
function candidateRef(n) {
  const numbers = uniq(INDEX_RES.flatMap((re) => [...n.spaced.matchAll(re)].map((m) => (/^\d+$/.test(m[1]) ? Number(m[1]) : CAND.numberWords[m[1]]))))
  if (numbers.length) return numbers.length > 1 ? { many: true } : { index: numbers[0] }
  return PREVIOUS_RE.test(n.spaced) ? { previous: true } : null
}

/** 시안 비교 말의 결과. 읽기는 없고(복사는 계획 단계가 한다) 어느 시안인지만 실린다. 다른 사전 낱말이 함께 있거나 없는 번호면 되묻는다. */
function copyResult(ref, candidates, hits, lang) {
  if (ref.many || hits.some((h) => h.c.e.kind !== 'modifier')) return unknown(TEXT.candidateMixed[lang])
  const copy = (copyFrom, say) => ({ result: 'confirmed', readings: [], say, sources: [], kind: 'reference', lead: null, copyFrom })
  if (ref.previous) return copy(CAND.previousId, TEXT.copy.previous[lang])
  const id = candidates[ref.index - 1]
  return id === undefined ? unknown(fill(TEXT.candidateMissing[lang], { max: String(candidates.length) })) : copy(id, TEXT.copy.candidate[lang])
}

/** 읽기 하나의 대표 읽기 모양: 축 + 방향(색·글꼴은 값). */
export const leadOf = (r) => (r.value !== undefined ? { axis: r.axis, value: r.value } : { axis: r.axis, direction: r.direction })

/** 대표 읽기를 낸 낱말 묶음의 갈래. 범위·세기·부정(modifier)이 붙었으면 문장의 갈래는 modifier(5.4 E)다. */
const kindOf = (g) => (Object.keys(g.effect).length ? 'modifier' : g.c.e.kind)

/**
 * @param {string} text 사용자의 수정 문장
 * @param {object} [lex] loadLexicon() 결과. 생략하면 기본 사전
 * @param {{ candidates?: string[] }} [ctx] 시안 비교(갈래 D)용 문맥 — 시안 id 목록(번호는 차례). 목록이 있을 때만 「N번 시안처럼」·「아까 게」를 읽고, 없으면 예전과 한 글자도 다르지 않다.
 * @returns {import('./classify.mjs').Confirmed | import('./classify.mjs').Two | import('./classify.mjs').Unknown}
 */
export function interpret(text, lex, ctx = {}) {
  const L = lex ?? (defaultLex ??= loadLexicon())
  const lang = HANGUL.test(String(text ?? '')) ? 'ko' : 'en'
  const n = normalize(text)
  const hits = matchAll(compile(L), n)
  const ref = ctx.candidates?.length ? candidateRef(n) : null
  if (ref) return copyResult(ref, ctx.candidates, hits, lang)

  const groups = hits.filter((h) => h.c.e.kind !== 'modifier').map((h) => ({ ...h, effect: {} }))
  const lostNeg = [] // 걸릴 곳을 못 찾은 부정이 가리키던 묶음
  for (const m of hits) {
    if (m.c.e.kind !== 'modifier') continue
    const ef = m.c.e.effect ?? {}
    // 한국어 부정(않게)은 앞 묶음에, 그 밖(세기·범위·영어 not)은 뒤 묶음에. 사이에 다른 낱말이 끼면 붙이지 않고 버린다.
    let back = ef.cap && m.lang !== 'en'
    const word = n.compact.slice(m.start, m.end)
    if (ef.cap && PROHIBIT_WORDS.has(word) && QUESTION.test(String(text))) continue // 「안돼요?」는 허락을 묻는 말이다
    if (back && PRE_NEG.has(word)) {
      // 「안」·「못」은 낱말 전체일 때만 부정이다(「안에」「안쪽」「안의」는 명사). 그리고 두 모양만 받는다:
      //   앞 모양 — 바로 뒤 묶음에 붙어 있는 「안 밝게」(사이에 낱말이 없다)
      //   뒤 모양 — 앞 묶음 뒤에서 「안 해도/했으면/하는」(하다 풀이) 또는 「하면 안 돼요」(금지, 물음표 없음)로 이어진다
      // 「안 될까요」「안 그러면」「느낌이 안 나요」 같은 부탁·조건·없다는 말은 부정이 아니다.
      const tok = n.tokens.find((t) => t.start === m.start)
      if (!tok || tok.end !== m.end) continue
      const ahead = groups.find((g) => g.start >= m.end)
      if (ahead && ahead.start === m.end) back = false
      else {
        const rest = n.compact.slice(m.end)
        if (!(DO_VERB.test(rest) || (PROHIBIT_REST.test(rest) && !QUESTION.test(String(text))))) continue
      }
    }
    const target = back ? groups.findLast((g) => g.end <= m.start) : groups.find((g) => g.start >= m.end)
    if (!target) continue
    const stray = strays(n, hits, ...(back ? [target.end, m.start] : [m.end, target.start]))
    if (stray) {
      // 사이 낱말이 하나뿐이면 부정이 바로 그 서술어(「세지 않게」)에 붙은 것이라 앞 묶음에 걸린 말일 수 있다. 버리면 반대로 읽히므로 그 묶음에 다른 부정도 안 붙었으면 아래에서 되묻는다.
      // 둘 이상이면 다른 절의 말(「하되 기능이 느려지지 않게」)이라 그대로 버린다. 앞 묶음이 이미 서술어로 끝났으면(「둥글게 너무 과하지 않게」) 그 말은 따로 선 덧붙임이라 역시 버린다.
      if (ef.cap && stray === LIMITS.lostNegStrays && target.c.e.kind !== 'diagnosis' && !hasPredicate(n, target)) lostNeg.push(target)
      continue
    }
    // 진단에 붙은 부정(「촌스럽지 않게」「AI 티 빼줘」)은 고쳐 달라는 말과 같다 — 상한을 달면 거꾸로 읽히므로 버린다.
    if (ef.cap && target.c.e.kind === 'diagnosis') continue
    if (ef.cap && target.effect.cap) target.doubleNeg = true // 부정이 겹치면(「안 밝게 하지 마」) 뜻이 갈린다
    Object.assign(target.effect, ef)
  }
  if (groups.some((g) => g.doubleNeg)) return unknown(TEXT.doubleNeg[lang])
  if (lostNeg.some((g) => !g.effect.cap)) return unknown(TEXT.lostNeg[lang])
  if (!groups.length) return { ...unknown(TEXT.askNone[lang]), unmatched: true }

  const sources = uniq(groups.map((g) => g.c.e.id))
  const pick = (g) => g.c.e.kind === 'diagnosis' || g.c.e.confidence === 'low'
  const sure = groups.filter((g) => !pick(g))
  const seenUnsure = new Set() // 같은 진단 낱말이 한 문장에 둘이어도(「뻔해」+「어디서 많이 본」) 모호 항목은 하나다
  const unsure = groups.filter((g) => pick(g) && !seenUnsure.has(g.c.e.id) && seenUnsure.add(g.c.e.id))
  const says = new Map(sure.map((g) => [g.c.e.id, sayOf(g, lang)]))
  const sureSays = uniq(sure.map((g) => says.get(g.c.e.id))) // 같은 항목이 한 문장에 둘이어도(「따뜻하고 따뜻하게」) 이해한 내용은 한 번만 말한다
  // 인상 묶음에 붙은 상한은 묶음의 첫 축(그 묶음을 대표하는 축: 어둡고 묵직함 → 밝기)에만 건다 — 「어두운 건 싫어요」가 대비·입체감까지 막지 않게.
  const base = sure.flatMap((g) => stamp(g.c.e.kind === 'impression' && g.effect.cap ? (g.c.e.reading ?? []).slice(0, 1) : g.c.e.reading ?? [], g.c.e.id, g.effect))

  const clashAsk = (ids, sayMap, readings) => {
    const labels = ids.map((id) => L.entries.find((e) => e.id === id)?.label ?? id)
    const choices = uniq(ids.map((id) => sayMap.get(id)).filter(Boolean)).slice(0, LIMITS.maxChoices)
    return { ...unknown(fill(TEXT.clash[lang], { a: labels[0], b: labels[1] ?? labels[0] }), choices), clash: readings.filter((r) => ids.includes(r.source)) } // clash = 부딪친 항목들의 읽기(되묻는 글을 쓰는 쪽이 읽기를 그대로 쓰도록 — 분류는 바뀌지 않는다)
  }

  const baseClash = clash(merge(base))
  if (baseClash) return clashAsk(baseClash, says, merge(base))

  if (!unsure.length) {
    const readings = merge(base)
    return { result: 'confirmed', readings, say: sureSays.join(' '), sources, kind: kindOf(sure[0]), lead: leadOf(readings[0]) }
  }

  const g = unsure[0]
  const e = g.c.e
  const causes = e.causes ?? []
  const causeSay = (c) => (lang === 'ko' ? c.say : c.sayEn ?? c.say)
  const askOf = () => (lang === 'ko' ? e.ask : e.askEn) ?? fill(TEXT.askPick[lang], { label: e.label })
  if (unsure.length > 1 || causes.length < 2) {
    return unknown(askOf(), causes.slice(0, LIMITS.maxChoices).map(causeSay)) // 한 번에 하나씩 · 원인이 하나뿐인 진단
  }

  const options = []
  for (const c of causes.slice(0, 2)) {
    const own = stamp(c.reading, e.id, g.effect)
    const readings = merge([...base, ...own])
    const bad = clash(readings)
    if (bad) return clashAsk(bad, new Map([...says, [e.id, causeSay(c)]]), readings)
    options.push({ readings, say: [...sureSays, scopeText(g.effect.scope, lang) + causeSay(c)].join(' '), lead: leadOf(readings[0]) })
  }
  return { result: 'two', options, sources, kind: kindOf(sure[0] ?? g), lead: options[0].lead }
}
