// 말 → 요청 — 「히어로를 더 대담하게」 같은 말 한 줄을 구획·문구 요청으로, 그 밖의 디자인 말은 사전 분류(design)로 사상한다.
//   parseRevision(text, site, { lex, examples, cfg }?) 의 계약은 revise.mjs 머리 주석을 본다. 낱말 표는 사전(design-lexicon.yaml revise)에서 와서 구조 조작(revise-structure.mjs)에 넘겨진다.
import { isDeepStrictEqual } from 'node:util'
import { classify } from '../vocab/classify.mjs'
import { askIn, grammar } from '../vocab/grammar.mjs'
import { axesNamedIn, extraSectionWordsOf, pageWordsOf, sectionWordsOf } from '../vocab/lexicon.mjs'
import { designContext } from './design-context.mjs'
import { sayOf } from './plan-readings.mjs'
import { literalValueIn } from './revise-values.mjs'
import { parseStructure } from './revise-structure.mjs'
import { isPartScope, traitsOf } from './section-plan.mjs'

// ── 말 → 요청 ───────────────────────────────────────────────────────────────

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
/** 낱말 목록(문자열 | RegExp) 중 하나라도 있는가. 영어 낱말은 단어 경계로, 한글은 포함으로 본다. */
function has(text, words) {
  return words.some((w) => (w instanceof RegExp ? w.test(text) : /^[a-z][a-z' -]*$/i.test(w) ? new RegExp(`(?<![a-z])${esc(w)}(?![a-z])`, 'i').test(text) : text.includes(w)))
}

const COPY_WORDS =['문구', '카피', '문장', '텍스트', '슬로건', '헤드라인', '제목', '말투', '글귀', 'copy', 'wording', 'headline', 'tagline', 'slogan', 'text', 'message', 'title', 'sentence', 'sentences']

const INTENT_WORDS = {
  bolder: ['대담', '과감', '강렬', '강하게', '세게', '임팩트', '눈에 띄', '화려', '크게', '많이', 'bold', 'bolder', 'louder', 'stronger', 'dramatic', 'more impact', 'striking', 'more'],
  calmer: ['차분', '조용', '절제', '약하게', '부드럽', '단순', '심플', '줄여', '낮춰', '덜', '없애', 'calm', 'calmer', 'quiet', 'quieter', 'subtle', 'softer', 'simpler', 'minimal', 'less', 'tone down', 'reduce'],
  shorter: ['짧게', '간결', '줄여', '압축', 'shorter', 'concise', 'brief', 'shorten'],
  warmer: ['친근', '따뜻', '다정', '캐주얼', 'friendly', 'friendlier', 'warmer', 'casual'],
  formal: ['정중', '공식', '격식', '딱딱', 'formal', 'professional'],
  different: ['다르게', '다른', '바꿔', '바꾸', '교체', '새로', '다시', 'change', 'swap', 'different', 'another', 'alternative', 'replace', 'redo', 'rewrite'],
}
const COPY_INTENTS = ['shorter', 'warmer', 'formal']

const ASK = {
  ko: {
    vague: '어느 부분을 바꿀까요? 구획(예: 히어로)이나 문구를 알려 주세요.',
    copyWhere: '문구를 바꿀 구획을 알려 주세요. 예: 히어로',
    noSection: (names) => `이 사이트에 그 구획이 없어요. 구획: ${names}`,
    pages: (names) => `그 구획이 여러 쪽에 있어요. 어느 쪽인가요? ${names}`,
    kinds: (names) => `구획이 여러 개로 읽혀요. 하나만 알려 주세요: ${names}`,
  },
  en: {
    vague: 'Which part? A section (e.g. hero) or the copy.',
    copyWhere: 'Which section’s copy should change? e.g. hero',
    noSection: (names) => `No such section here. Sections: ${names}`,
    pages: (names) => `That section is on several pages. Which? ${names}`,
    kinds: (names) => `More than one section matches. Pick one: ${names}`,
  },
}
const ASK_MAX = 79
/** 질문을 80자 미만으로 맞춘다 — 목록은 길면 잘라 …로 닫는다. */
function clip(prefix, list, suffix = '') {
  let names = list.join(', ')
  while ((prefix + names + suffix).length > ASK_MAX && list.length > 1) { list = list.slice(0, -1); names = `${list.join(', ')}…` }
  return (prefix + names + suffix).slice(0, ASK_MAX)
}

const T = grammar.text.ask

/** 읽기 목록들(확정은 하나, 후보 둘은 선택지마다). */
const listsOf = (c) => (c.result === 'confirmed' ? [c.readings] : c.result === 'two' ? c.options.map((o) => o.readings) : [])

/**
 * 한 축에서 서로 다른 값을 둘 말해 사전이 「서로 반대예요」로 되물은 말(「빨강이랑 파랑」) → 두 값을 모두 읽은 확정 분류.
 * 해석기가 되물으며 실어 준 부딪친 읽기(clash)를 그대로 쓴다 — 같은 축·같은 범위의 값 읽기 둘, 상한 없음, 값이 다름. planReadings 가 값마다 한 안으로 낸다(안 a = 첫 값, 안 b = 둘째 값).
 * 값을 빼 달라는 말(「빨강 말고 파랑」)은 이 길이 아니다.
 */
export function valuePair(classification, lex, lc) {
  const [a, b] = classification.clash ?? []
  if (classification.result !== 'unknown' || classification.clash?.length !== 2 || has(lc, grammar.match.negationWords)) return null
  if (a.axis !== b.axis || a.scope !== b.scope || a.value === undefined || b.value === undefined || a.cap || b.cap || a.value === b.value) return null
  return { result: 'confirmed', readings: classification.clash, say: sayOf(classification.clash, lex), sources: classification.clash.map((r) => r.source), kind: 'modifier', lead: { axis: a.axis, value: a.value } }
}

/** 분류가 읽은 서로 다른 값(색 이름·서체 범주)의 집합 — 되묻기로 실린 부딪친 읽기(clash)도 센다. */
function valuesOf(classification) {
  const readings = [...listsOf(classification).flat(), ...(classification.clash ?? [])]
  return new Set(readings.filter((r) => r.value !== undefined && !r.cap).map((r) => r.value))
}

/**
 * 「빨강을 파랑으로」「빨간 색에서 파란 색으로」「빨강 대신 파랑으로」「빨간색을 좀 더 파란색으로」처럼 원래 값을 먼저, 바뀔 값을 뒤에 말한 틀이면
 * { rest: 원래 값 표지 뒤의 글, text: 원래 값 덩이를 뺀 글 } 을 짧게 뺀 것부터 차례로 낸다(grammar.yaml match.fromTo) — 부르는 쪽이 text 에 rest 와 같은 값만 남는 첫 글을 쓴다. 틀이 아니면 하나도 내지 않는다.
 * 바뀔 값 낱말(targetMarks 로 끝남 · 영어 toWords) 앞에서 원래 값 표지(sourceMarks)가 붙은 낱말을 찾아, 그 낱말과 앞 덩이, 둘 사이의 낱말(좀 더 …)을 뺀다.
 * 둘 사이에 나란히 말하는 표지(togetherMarks·togetherWords)가 있으면(「빨강이랑 파랑으로」) 원래→바뀔 틀이 아니라 값 둘이다.
 */
function* withoutSources(raw) {
  const { sourceMarks, targetMarks, togetherMarks, togetherWords, toWords } = grammar.match.fromTo
  const tokens = raw.split(/\s+/)
  const bare = (tok) => tok.replace(/[.,!?]+$/, '').toLowerCase()
  const endsWith = (tok, marks) => marks.some((m) => bare(tok).endsWith(m))
  const together = (tok) => endsWith(tok, togetherMarks) || togetherWords.includes(bare(tok))
  for (let j = tokens.length - 1; j >= 1; j--) {
    const english = toWords.includes(bare(tokens[j]))
    if (!english && !endsWith(tokens[j], targetMarks)) continue
    for (let marker = j - 1; marker >= 0; marker--) {
      if (tokens.slice(marker + 1, j).some(together)) break
      if (!english && !endsWith(tokens[marker], sourceMarks)) continue
      const after = tokens.slice(marker + 1) // 원래 값 표지 뒤 — 바뀔 값은 여기서 읽힌다
      for (let from = marker; from >= 0; from--) yield { rest: after.join(' '), text: [...tokens.slice(0, from), ...after].join(' ') } // 원래 값 덩이가 어디서 시작하는지 몰라 짧게 뺀 것부터
      return
    }
  }
}

/** 문장의 분류 — 색 코드나 서체 이름을 하나 말했으면(literal) 그 값 읽기(사전에 없는 값), 아니면 사전 분류(나란히 말한 값 둘이면 두 값을 모두, 원래 값→바뀔 값이면 바뀔 값만). */
function classifyText(raw, { lex, examples, cfg }, literal, ctx) {
  if (literal) {
    const readings = [{ ...literal, strength: 1, scope: 'site', source: 'literal' }]
    return { result: 'confirmed', readings, say: sayOf(readings, lex), sources: [], kind: 'modifier', lead: literal }
  }
  let classification = classify(raw, lex, examples, cfg, ctx)
  if (valuesOf(classification).size > 1) {
    for (const { rest, text } of withoutSources(raw)) {
      const target = valuesOf(classify(rest, lex, examples, cfg, ctx))
      if (target.size !== 1) break // 표지 뒤에서 값 하나가 읽히지 않으면 원래→바뀔 틀로 보지 않는다
      const reduced = classify(text, lex, examples, cfg, ctx)
      if (isDeepStrictEqual(valuesOf(reduced), target)) { classification = reduced; break } // 바뀔 값만 남는 첫 글
    }
  }
  return valuePair(classification, lex, raw.toLowerCase()) ?? classification
}

/** 색 값 읽기가 주색이 아닌 자리(배경·글자 색 …)를 말한 문장이면 주색만 바꿀 수 있다는 되물음. */
function roleAsk(lc, raw, classification) {
  const colour = listsOf(classification).flat().some((r) => r.axis === 'color-hue' && r.value !== undefined)
  return colour && has(lc, grammar.match.otherRoleWords) ? { ask: askIn(T.otherRole, raw) } : null
}

/**
 * 구조(더하기·빼기·옮기기)·문구·구획 이름이 붙은 교체가 아닌 말은 사전 분류로 넘긴다: { scope: 'design', classification, text }.
 * 분류가 확정·후보 둘이 아니면(근사·모름) 되묻는 일은 revise() 가 한다 — 여기서는 분류를 그대로 싣는다(--explain 이 보여 준다).
 * @param {string} text  사용자 말 한 줄
 * @param {{ sections?: Record<string, { block?: string }> }} site  content/site.json (섹션 키 목록만 쓴다)
 * @param {{ lex: object, examples: object[], cfg: object }} [design]  사전·예문·유사도 설정(없으면 기본 재료)
 * @param {{ candidates?: string[] }} [ctx]  시안 비교 말(「2번 시안처럼」)을 읽을 시안 id 목록(없으면 읽지 않는다)
 */
export function parseRevision(text, site, design, ctx = {}) {
  const raw = String(text ?? '').trim()
  const lang = /[가-힣]/.test(raw) ? 'ko' : 'en'
  const A = ASK[lang]
  const keys = Object.keys(site?.sections ?? {})
  const lc = raw.toLowerCase()
  if (!raw) return { ask: A.vague }

  const { lex, examples, cfg } = design ?? designContext()
  const SECTION_WORDS = sectionWordsOf(lex)
  const PAGE_WORDS = pageWordsOf(lex)
  const wantsCopy = has(lc, COPY_WORDS)

  // 구획 더하기·빼기·순서 바꾸기(FIT-1) — 「FAQ 빼줘」가 FAQ 를 다른 변형으로 바꾸지 않게, 기존 낱말 판정보다 먼저 본다. 구조 말이 아니면 undefined 라 아래 사상으로 간다.
  const structural = parseStructure({ raw, lc, lang, site, wantsCopy, t: { has, esc, SECTION_WORDS, EXTRA_SECTION_WORDS: extraSectionWordsOf(lex), PAGE_WORDS } })
  if (structural) return structural

  // 구획 찾기: 이름표 → kind 정규식 → 사이트에 실제로 있는 키
  const named = SECTION_WORDS.filter((e) => has(lc, e.words))
  const generic = [...new Set(keys.map((k) => k.split('/')[1]))].filter((kind) => kind.includes('-') && new RegExp(`(?<![a-z])${esc(kind)}(?![a-z])`, 'i').test(lc)) // 「workflow-features」처럼 kind 이름을 그대로 쓴 말
  const sectionHits = new Set([...named.flatMap((e) => keys.filter((k) => e.kind.test(k.split('/')[1]))), ...keys.filter((k) => generic.includes(k.split('/')[1]))])
  const namedSomething = named.length > 0 || generic.length > 0

  // 값으로 말한 색 코드·서체 이름은 사전에 없어 문장에서 직접 읽는다. 문구 낱말(제목·헤드라인 …)만 있고 축 이름이 없는 말은 문구 말이라 읽지 않는다(「Ultra bold headline」).
  const axesNamed = axesNamedIn(lex, raw)
  const literal = wantsCopy && !axesNamed.length ? null : literalValueIn(raw)
  if (literal && has(lc, grammar.match.negationWords)) return { ask: askIn(T.valueNegated, raw) } // 「#0B6E4F 말고」 — 그 값을 그대로 적용하면 반대로 간다

  // 구획 이름도 없으면 디자인 말이다 — 사전이 분류한다. 「제목을 크게」처럼 문구 낱말이 요소(제목)로 읽혔으면 디자인이고, 못 읽은 문구 말만 문구를 바꿀 구획을 묻는다.
  if (!namedSomething) {
    if (axesNamed.length > 1) return { ask: askIn(T.oneAxisAtATime, raw) } // 「색이랑 서체 바꿔줘」 — 한 번에 하나씩
    const classification = classifyText(raw, { lex, examples, cfg }, literal, ctx)
    if (wantsCopy && !axesNamed.length && !listsOf(classification).flat().some((r) => r.scope.startsWith('element:'))) return { ask: A.copyWhere }
    const role = roleAsk(lc, raw, classification)
    if (role) return role
    return { scope: 'design', classification, text: raw }
  }

  // 구획 이름이 있을 때만 「크게·화려·단순·줄여·덜·많이」 같은 말이 구획 교체 의도(더 대담/더 차분)다.
  //   사전이 방향을 읽었으면 그 방향이 뜻을 정한다(아래 readIntent) — 이 낱말 표는 읽은 것이 없을 때와 문구 말에만 쓴다.
  //   대담 낱말과 차분 낱말이 함께 있거나, 방향을 뒤집는 말(덜·않 · 부정 낱말)이 방향 낱말과 함께 있으면 추측하지 않는다(unclearIntent) — 「히어로 덜 대담하게」를 대담하게로 읽지 않고 묻는다.
  let unclearIntent = false
  const wordIntent = (() => {
    const found = Object.entries(INTENT_WORDS).filter(([, w]) => has(lc, w)).map(([i]) => i)
    if (wantsCopy) { const c = COPY_INTENTS.find((i) => found.includes(i)); if (c) return c }
    const { lessWords, negationWords } = grammar.match
    const [bold, calm, flip] = [found.includes('bolder'), INTENT_WORDS.calmer.some((w) => !lessWords.includes(w) && has(lc, [w])), has(lc, [...lessWords, ...negationWords])]
    unclearIntent = (bold && calm) || ((bold || calm) && flip)
    return bold ? 'bolder' : calm || found.includes('calmer') ? 'calmer' : 'different'
  })()
  let readIntent = null // 사전이 읽은 방향이 정한 뜻(bolder|calmer) — 낱말보다 앞선다(「히어로 덜 화려하게」 → calmer)
  let readClass = null // 그 읽기를 담은 분류 — 요청에 실어 --explain 이 읽기를 보인다(그 읽기를 그대로 --revise-readings 에 넘겨도 같은 판이 나온다)

  // 구획 이름이 있어도 먼저 사전이 이 말을 어떻게 읽는지 본다(문구 말은 아래 문구 사상이 맡는다).
  //   · 구획·쪽 범위 읽기와 사이트 전체 읽기가 섞였으면(「히어로 글자 크게 하고 색은 초록으로」) 한 번에 하나씩 묻는다.
  //   · 읽은 축이 모두 구획 교체로 못 하는 축(색·글꼴·모서리 …)이면 사이트 전체에 적용된다고 되묻는다 — 구획 블록만 바꿔 놓고 적용한 척하지 않는다.
  //   · 여백을 구획·쪽 범위로 말했으면(후보 둘이면 같은 범위의 여백끼리) 구획 교체 계획(sectionPlan)이 밀도로 고른다.
  //   · 아무것도 못 읽었어도 축 이름(색·서체 …)만 말하고 방향이 없으면(바꿔줘) 같은 질문이다.
  //   · 그 밖(구획 교체로 할 수 있는 축을 읽었거나, 대담·차분 같은 말뿐)은 아래 구획 교체 사상으로 간다.
  if (!wantsCopy || axesNamed.length) { // 축 이름(색·서체 …)이 있으면 문구 낱말(제목)이 함께 있어도 디자인 말이다
    const classification = classifyText(raw, { lex, examples, cfg }, literal, ctx)
    const intentOf = (r) => lex.axes[r.axis].sectionIntent?.[r.direction]
    const hasIntent = (r) => Boolean(lex.axes[r.axis].sectionIntent)
    // 구획 이름이 하나뿐이면 범위 없이(사이트 전체로) 읽힌 읽기도 그 구획의 것이다 — 분류기는 구획 낱말을 가까운 낱말 묶음에만 붙인다. 사이트 전체를 분명히 말했으면 그대로 둔다.
    const kindsHit = [...new Set([...sectionHits].map((k) => k.split('/')[1]))]
    const sectionWords = named.flatMap((e) => e.words).filter((w) => lc.includes(w.toLowerCase()))
    const withoutSectionAll = sectionWords.length ? lc.replace(new RegExp(`(?:${sectionWords.map(esc).join('|')})\\s*전체`, 'g'), ' ') : lc // 구획 이름 바로 뒤의 전체(「히어로 전체」)는 그 구획 전체지 사이트 전체가 아니다
    const ownScope = kindsHit.length === 1 && !has(withoutSectionAll, grammar.match.siteWords) ? `section:${kindsHit[0]}` : null
    const own = (list) => {
      const seen = new Set()
      return list.map((r) => (ownScope && r.scope === 'site' ? { ...r, scope: ownScope } : r)).filter((r) => { const key = [r.axis, r.direction, r.value, r.scope, r.cap].join('|'); return !seen.has(key) && seen.add(key) })
    }
    const lists = listsOf(classification).map(own)
    const readings = lists.flat()
    const partAxes = new Set(readings.filter(isPartScope).map((r) => r.axis))
    if (partAxes.size && readings.some((r) => !isPartScope(r) && !partAxes.has(r.axis))) return { ask: askIn(T.oneKindAtATime, raw) } // 사이트 전체를 분명히 말한 읽기가 구획 읽기와 섞였다
    if (readings.length && !readings.some(hasIntent)) return { ask: askIn(T.siteWide, raw) }
    // 구획 교체로 못 하는 축을 따로 말했다(「글자 크게 하고 색은 초록으로」) — 같은 낱말에서 나온 읽기들(「화려하게」)은 한 요청이다
    if (readings.some((r) => !hasIntent(r) && !readings.some((o) => hasIntent(o) && o.source === r.source))) return { ask: askIn(T.siteWide, raw) }
    const density = (r) => isPartScope(r) && typeof intentOf(r) === 'object'
    if (classification.result === 'confirmed' && readings.some(density)) return { scope: 'design', classification: { ...classification, readings: readings.filter(isPartScope) }, text: raw }
    if (classification.result === 'two' && lists.every((l) => l.length && l.every(density)) && new Set(readings.map((r) => r.scope)).size === 1) return { scope: 'design', classification: { ...classification, options: classification.options.map((o, i) => ({ ...o, readings: lists[i] })) }, text: raw }
    if (classification.result === 'confirmed' && !wantsCopy && readings.some((r) => !r.cap && r.strength > 0 && intentOf(r) !== undefined)) {
      const traits = traitsOf(readings, { lex, lang })
      if (traits.ask) return { ask: traits.ask } // 읽기끼리 반대(더 대담하게 + 차분하게)
      readIntent = traits.traits.intent ?? null
      readClass = { ...classification, readings }
    }
    if (!readings.length && wordIntent === 'different' && axesNamed.length) return { ask: askIn(T.siteWide, raw) }
  }

  if (!sectionHits.size) return { ask: clip(A.noSection(''), [...new Set(keys.map((k) => k.split('/')[1]))]) }

  // 같은 이름이 여러 kind 로 읽히면(요금제 FAQ) 하나만 묻는다
  const kinds = [...new Set([...sectionHits].map((k) => k.split('/')[1]))]
  if (kinds.length > 1) return { ask: clip(A.kinds(''), kinds) }

  // 여러 쪽에 있으면: 쪽 이름이 나왔으면 그 쪽, 아니면 home, 그래도 여럿이면 묻는다
  let hits = [...sectionHits]
  if (hits.length > 1) {
    const kind = kinds[0]
    const pageIds = hits.map((k) => k.split('/')[0])
    const pageMentioned = (id) => (PAGE_WORDS[id] && has(lc, PAGE_WORDS[id])) || (id !== kind && /^[a-z-]+$/.test(id) && new RegExp(`(?<![a-z])${esc(id)}(?![a-z])`, 'i').test(lc))
    const mentioned = pageIds.filter(pageMentioned)
    if (mentioned.length === 1) hits = hits.filter((k) => k.startsWith(`${mentioned[0]}/`))
    else if (mentioned.length === 0 && pageIds.includes('home')) hits = hits.filter((k) => k.startsWith('home/'))
    else return { ask: clip(A.pages(''), pageIds) }
  }
  const target = hits[0]
  if (unclearIntent && !readIntent && !wantsCopy) return { ask: askIn(T.intentUnclear, raw) }
  return { scope: wantsCopy ? 'copy' : 'section', target, intent: readIntent ?? wordIntent, text: raw, ...(readIntent ? { classification: readClass } : {}) }
}
