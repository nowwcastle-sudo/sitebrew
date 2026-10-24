// 분위기 낱말 → 방향 고르기가 쓰는 무드 어휘(FIT-3 F1). 인테이크가 「분위기를 한 단어로」(facts.mood)를 묻는데, 예전에는 04 문구 요청에만 들어가고
// 01 방향(레시피 고르기·프리셋 점수·팔레트 점수)에는 닿지 않았다 — 같은 브리프에서 따뜻한 ↔ 대담한을 바꿔도 방향 3안이 바이트까지 같았다.
//
// 어휘 실측(abbe3be0): 방향 고르기에는 무드 어휘가 둘 있다.
//   · 영어 일반어 — 프리셋 recipeHints.paletteMoods(balanced 31·warm 16·bold 15·muted 11·monochrome 9 …)와 팔레트 835개의 mood(warm 175·cool 169·bold 129·muted 103·dark 95 …)
//   · 한국어 레시피 낱말 — 라이브러리 레시피 15벌의 mood 3단어씩(차분·절제·명료·대담·친근·손맛 … 서른여 가지, 대부분 한 번씩) — 같은 낱말이 레시피 프리셋의 paletteMoods 와 레시피 팔레트의 mood 로도 흐른다.
// 아래 표는 사용자의 자유 낱말(한국어 어간·영어)을 두 어휘로 옮긴다. `tokens` = 영어 일반어, `recipeTokens` = 한국어 레시피 낱말.
// 표에 없는 낱말은 null — 효과 없음(방향 고르기가 그 사실을 why 에 적는다).

import { loadLexicon } from '../vocab/lexicon.mjs'

// 표는 디자인 어휘 사전(factory/vocab/design-lexicon.yaml)의 impression 항목 중 mood 가 있는 것에서 만든다(Sitebrew v0.2.0 · 설계 5.10).
// 모듈 로드 때 한 번 동기로 읽는다 — directions.mjs 가 이 모듈을 가져온다. 낱말을 늘리려면 사전에 항목을 더한다.
const LEXICON = loadLexicon()

/** @type {{ key: string, label: string, ko: string[], en: string[], tokens: string[], recipeTokens: string[] }[]} */
export const MOOD_TABLE = LEXICON.entries
  .filter((e) => e.kind === 'impression' && e.mood)
  .map((e) => ({ key: e.id, label: e.label, ko: e.match.ko ?? [], en: e.match.en ?? [], tokens: e.mood.tokens, recipeTokens: e.mood.recipeTokens }))

const norm = (s) => String(s ?? '').trim().toLowerCase()

/**
 * 자유 낱말 → 무드 어휘 묶음. 표에 없으면 null.
 * 한국어는 어간 포함(「따뜻한」 ∋ 「따뜻」), 영어는 낱말 단위로 맞춘다. 낱말 하나가 여러 항목에 맞으면(「따뜻하고 대담한」) 합쳐서 돌려준다.
 * @returns {{ word: string, key: string, keys: string[], labels: string[], tokens: string[], recipeTokens: string[] } | null}
 */
export function moodProfile(word) {
  const w = norm(word)
  if (!w) return null
  const en = new Set(w.split(/[^a-z-]+/).filter(Boolean))
  const hit = MOOD_TABLE.filter((m) => m.ko.some((k) => w.includes(k)) || m.en.some((e) => en.has(e)))
  if (!hit.length) return null
  const uniq = (xs) => [...new Set(xs)]
  return {
    word: String(word).trim(),
    key: hit.map((m) => m.key).join('+'),
    keys: hit.map((m) => m.key),
    labels: hit.map((m) => m.label),
    tokens: uniq(hit.flatMap((m) => m.tokens)),
    recipeTokens: uniq(hit.flatMap((m) => m.recipeTokens)),
  }
}

/** 두 어휘를 합친 집합 — 프리셋·팔레트의 mood 배열과 겹침을 세는 데 쓴다(영어 일반어와 한국어 레시피 낱말은 겹치지 않는다). */
export const moodSet = (profile) => (profile ? new Set([...profile.tokens, ...profile.recipeTokens]) : null)

/** list(문자열 배열)에서 집합에 든 서로 다른 낱말 수. */
export const moodOverlap = (list, set) => (set ? new Set((list ?? []).filter((m) => set.has(m))).size : 0)
