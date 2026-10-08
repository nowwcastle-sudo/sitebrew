// 분위기 낱말 → 방향 고르기가 쓰는 무드 어휘(FIT-3 F1). 인테이크가 「분위기를 한 단어로」(facts.mood)를 묻는데, 예전에는 04 문구 요청에만 들어가고
// 01 방향(레시피 고르기·프리셋 점수·팔레트 점수)에는 닿지 않았다 — 같은 브리프에서 따뜻한 ↔ 대담한을 바꿔도 방향 3안이 바이트까지 같았다.
//
// 어휘 실측(abbe3be0): 방향 고르기에는 무드 어휘가 둘 있다.
//   · 영어 일반어 — 프리셋 recipeHints.paletteMoods(balanced 31·warm 16·bold 15·muted 11·monochrome 9 …)와 팔레트 835개의 mood(warm 175·cool 169·bold 129·muted 103·dark 95 …)
//   · 한국어 레시피 낱말 — 라이브러리 레시피 15벌의 mood 3단어씩(차분·절제·명료·대담·친근·손맛 … 서른여 가지, 대부분 한 번씩) — 같은 낱말이 레시피 프리셋의 paletteMoods 와 레시피 팔레트의 mood 로도 흐른다.
// 아래 표는 사용자의 자유 낱말(한국어 어간·영어)을 두 어휘로 옮긴다. `tokens` = 영어 일반어, `recipeTokens` = 한국어 레시피 낱말.
// 표에 없는 낱말은 null — 효과 없음(방향 고르기가 그 사실을 why 에 적는다). 낱말을 늘리려면 여기 한 줄을 더한다.

/** @type {{ key: string, label: string, ko: string[], en: string[], tokens: string[], recipeTokens: string[] }[]} */
export const MOOD_TABLE = [
  { key: 'warm', label: '따뜻함', ko: ['따뜻', '포근', '아늑', '정겨', '정감', '훈훈', '푸근'], en: ['warm', 'cozy', 'homey', 'snug', 'homely'], tokens: ['warm', 'earthy', 'cozy', 'sunset', 'sunshine'], recipeTokens: ['손맛', '저녁', '장터', '인쇄', '숲', '친근', '말랑', '손끝'] },
  { key: 'friendly', label: '친근함', ko: ['친근', '친절', '다정', '상냥', '정다', '살가'], en: ['friendly', 'kind', 'welcoming', 'approachable', 'gentle', 'inviting'], tokens: ['warm', 'soft', 'approachable', 'inviting', 'cheerful', 'pastel'], recipeTokens: ['친근', '말랑', '손끝'] },
  { key: 'bold', label: '대담함', ko: ['대담', '과감', '강렬', '역동', '도전', '파격', '묵직'], en: ['bold', 'strong', 'intense', 'daring', 'powerful', 'dramatic'], tokens: ['bold', 'neon', 'vibrant', 'intense', 'dramatic', 'high-contrast'], recipeTokens: ['대담', '거침', '직설', '대비', '신호'] },
  { key: 'lively', label: '활기참', ko: ['활기', '활발', '생동', '경쾌', '발랄', '신나', '유쾌', '에너지'], en: ['lively', 'energetic', 'playful', 'fun', 'cheerful', 'upbeat', 'vivid'], tokens: ['energetic', 'vibrant', 'playful', 'cheerful', 'bright', 'energy'], recipeTokens: ['신호', '말랑', '대담'] },
  { key: 'calm', label: '차분함', ko: ['차분', '고요', '조용', '평온', '잔잔', '편안', '평화'], en: ['calm', 'quiet', 'serene', 'peaceful', 'tranquil', 'relaxed'], tokens: ['calm', 'muted', 'cool', 'soft', 'hush', 'balanced'], recipeTokens: ['차분', '고요', '조용', '느림', '절제'] },
  { key: 'neat', label: '단정함', ko: ['단정', '깔끔', '정갈', '정돈', '심플', '간결', '미니멀', '명료', '명쾌'], en: ['neat', 'clean', 'simple', 'minimal', 'minimalist', 'tidy', 'clear', 'crisp'], tokens: ['minimal', 'minimalist', 'monochrome', 'muted', 'balanced', 'clarity'], recipeTokens: ['단정', '정돈', '명료', '절제', '여백'] },
  { key: 'refined', label: '고급스러움', ko: ['고급', '세련', '우아', '품격', '격조', '럭셔리', '프리미엄'], en: ['luxury', 'luxurious', 'premium', 'elegant', 'refined', 'sophisticated', 'classy', 'upscale'], tokens: ['luxe', 'luxury', 'quiet luxury', 'elegant', 'premium', 'refined', 'editorial'], recipeTokens: ['절제된 고급', '정제', '지면', '여백'] },
  { key: 'trust', label: '신뢰감', ko: ['신뢰', '믿음', '든든', '안정', '공신', '전문'], en: ['trust', 'trustworthy', 'reliable', 'stable', 'professional', 'serious', 'dependable'], tokens: ['trust', 'reliability', 'stable', 'professional', 'balanced', 'clarity'], recipeTokens: ['신뢰', '공식', '명료', '근거', '정확'] },
  { key: 'fresh', label: '산뜻함', ko: ['산뜻', '청량', '상쾌', '싱그', '맑', '청명'], en: ['fresh', 'airy', 'light', 'bright', 'refreshing', 'breezy'], tokens: ['fresh', 'cool', 'pastel', 'bright', 'light', 'nordic', 'marine'], recipeTokens: ['명료', '여백'] },
  { key: 'natural', label: '자연스러움', ko: ['자연', '내추럴', '소박', '투박', '흙', '숲', '순박', '수수'], en: ['natural', 'organic', 'rustic', 'earthy', 'humble', 'handmade'], tokens: ['earthy', 'nature', 'organic', 'green', 'forest', 'botanical', 'muted'], recipeTokens: ['숲', '재질', '손끝', '손맛'] },
  { key: 'retro', label: '복고', ko: ['복고', '레트로', '빈티지', '클래식', '고전', '앤티크', '추억'], en: ['retro', 'vintage', 'classic', 'nostalgic', 'timeless', 'antique'], tokens: ['retro', 'vintage', 'classic', 'timeless'], recipeTokens: ['인쇄', '손맛', '장터'] },
  { key: 'dark', label: '묵직한 모던', ko: ['시크', '모던', '어두', '도회', '미래', '몽환', '밤'], en: ['sleek', 'modern', 'dark', 'moody', 'futuristic', 'urban', 'night'], tokens: ['dark', 'night', 'deep', 'futuristic', 'tech', 'modern', 'cosmic'], recipeTokens: ['저녁', '대비'] },
  { key: 'playful', label: '발랄함', ko: ['귀여', '장난', '유머', '재미', '앙증', '아기자기'], en: ['cute', 'quirky', 'whimsical', 'humorous'], tokens: ['playful', 'pastel', 'cheerful', 'vibrant', 'soft'], recipeTokens: ['말랑', '친근'] },
]

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
