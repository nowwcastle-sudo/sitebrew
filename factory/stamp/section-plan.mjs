// 구획·쪽 범위의 읽기 → 구획 교체 계획(설계 5.10) — 머리(레시피)는 건드리지 않고, 그 구획 블록을 더 대담한/차분한 변형으로 바꿀 키와 뜻을 정한다.
//   scopeTargets(scope, site, lex)  → { keys: string[] } | { ask }   section:<kind>·page:<k> → 사이트 구획 키("<쪽>/<kind>")
//   traitsOf(readings, { lex, lang }) → { traits, live } | { ask }   축의 sectionIntent(사전)로 읽기를 구획 뜻으로 옮긴다 — 말을 구획 요청으로 읽는 쪽(revise-parse.mjs)과 계획이 같은 뜻을 쓴다
//   sectionPlan(readings, ctx)      → { keys, intent?, density?, say } | { ask }   ctx = { lex, site, lang? }
//   intent 'bolder'|'calmer' 는 변형 고르기(revise.mjs rankSection)의 뜻이고, density 'compact'|'spacious' 는 여백만 말한 읽기의 뜻이다.
//   sectionNameOf(key, lex, lang)   사이트 구획 키 → 사용자에게 보이는 구획 이름(사전 revise 이름표의 첫 낱말)
import { grammar } from '../vocab/grammar.mjs'
import { extraSectionWordsOf, sectionWordsOf } from '../vocab/lexicon.mjs'
import { clashAsk, sayOf } from './plan-readings.mjs'

const T = grammar.text

/** 구획·쪽 범위 읽기인가 — 읽기를 사이트 전체·요소 범위와 가르는 한 곳. */
export const isPartScope = (reading) => /^(?:section|page):/.test(reading.scope)

/** @returns {{ keys: string[] } | { ask: string }} 사이트 구획 키는 사전 revise.sections 의 kind 정규식으로 맞춘다. */
export function scopeTargets(scope, site, lex) {
  const [kind, name] = scope.split(':')
  const keys = Object.keys(site.sections ?? {})
  const kindOf = (key) => key.split('/')[1]
  let hit
  if (kind === 'page') hit = keys.filter((k) => k.startsWith(`${name}/`))
  else if (kind === 'section') {
    const same = [...sectionWordsOf(lex), ...extraSectionWordsOf(lex)].filter((e) => e.kind.test(name)) // 그 이름과 같은 구획을 가리키는 이름표들
    hit = keys.filter((k) => kindOf(k) === name || same.some((e) => e.kind.test(kindOf(k))))
  } else throw new Error(`범위 ${scope} 는 section:<kind> 나 page:<쪽> 이 아니다`)
  return hit.length ? { keys: hit } : { ask: T.plan.noSection }
}

/** 사이트 구획 키("home/hero")의 사용자 이름 — 사전 이름표 중 그 구획 kind 에 맞는 첫 낱말(요청 언어), 없으면 「이 구획」. */
export function sectionNameOf(key, lex, lang) {
  const kind = key.split('/')[1]
  const words = [...sectionWordsOf(lex), ...extraSectionWordsOf(lex)].find((e) => e.kind.test(kind))?.words ?? []
  return words.find((w) => (lang === 'en' ? /^[a-z]/i.test(w) : /[가-힣]/.test(w))) ?? T.compare.sectionFallback[lang]
}

/**
 * 읽기들이 구획에 바라는 뜻 { intent?, density? } 와 밀고 있는 읽기(live: 상한·세기 0 은 구획을 밀지 않는다).
 * 같은 낱말(source)에서 나온 읽기는 한 요청이다 — 「화려하게」가 낳은 색의 진하기·색 가짓수처럼 구획으로 못 하는 축은 뜻이 있는 짝을 따라간다.
 * source 가 없는 읽기는 짝이 없어, 구획으로 못 하는 축이면 사이트 전체에 적용된다고 되묻는다.
 * @returns {{ traits: { intent?: string, density?: string }, live: object[] } | { ask: string }}
 */
export function traitsOf(readings, { lex, lang = 'ko' }) {
  const live = readings.filter((r) => !r.cap && r.strength > 0)
  if (!live.length) return { ask: T.plan.nothing }
  const wantOf = (r) => lex.axes[r.axis].sectionIntent?.[r.direction]
  const rides = (r) => r.source !== undefined && live.some((o) => wantOf(o) !== undefined && o.source === r.source)
  const found = {} // 뜻 이름(intent·density) → { value, reading }
  for (const r of live) {
    const want = wantOf(r)
    if (want === undefined) {
      if (rides(r)) continue
      return { ask: T.ask.siteWide[lang] }
    }
    for (const [name, value] of Object.entries(typeof want === 'string' ? { intent: want } : want)) {
      if (found[name] && found[name].value !== value) return clashAsk(found[name].reading, r, lex, lang)
      found[name] ??= { value, reading: r }
    }
  }
  return { traits: Object.fromEntries(Object.entries(found).map(([name, t]) => [name, t.value])), live }
}

/** @param {object[]} readings 범위가 section·page 인 읽기 @param {{ lex: object, site: object, lang?: 'ko'|'en' }} ctx */
export function sectionPlan(readings, ctx) {
  const { lex, site, lang } = ctx
  const t = traitsOf(readings, { lex, lang })
  if (t.ask) return t
  const keys = new Set()
  for (const r of t.live) {
    const targets = scopeTargets(r.scope, site, lex)
    if (targets.ask) return targets
    targets.keys.forEach((k) => keys.add(k))
  }
  return { keys: [...keys], ...t.traits, say: sayOf(t.live, lex) }
}
