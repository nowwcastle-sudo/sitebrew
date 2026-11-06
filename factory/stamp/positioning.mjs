// 포지셔닝 문장 → 방향 고르기 선호(v0.2.6 T20 · P1 4.6절). 인테이크 선택 질문 9번 「어떤 자리를 노리나요?」(facts.positioning)를 다섯 태그로 읽고,
// 태그마다 정한 선호(모션·색 논리·테마·디스플레이 규모·재료 계열)를 01 방향 고르기의 가중 요소로 넘긴다. 분위기(mood.mjs)와 같은 자리에 같은 방식으로 붙는다.
// 전략 입력이지 게시 문구가 아니다 — 사이트 글에 그대로 쓰지 않는다(COPY.md).
// 낱말 매칭은 mood.mjs 와 같다: 한국어는 어간 포함, 영어는 낱말 단위. 표에 없으면 null → 효과 없음(why 에 이유).
import { axisValue } from '../scripts/axes.mjs'
import { materialFamily } from './material-family.mjs'

// 층별 가중(P1 확정) — 원형 적합도 한 단계(0.1)를 뒤집지 못하는 크기로 층마다 상한을 둔다.
export const POS_LIBRARY_W = 0.04 // 라이브러리 a 안: 일치한 축 하나마다(최대 POS_AXIS_CAP 축)
export const POS_PRESET_W = 0.06 // 프리셋 점수: 일치한 축 하나마다(최대 POS_AXIS_CAP 축)
export const POS_PALETTE_W = 0.1 // 팔레트: 밝기가 선호 테마와 맞을 때 한 번
export const POS_AXIS_CAP = 2

/** 태그 → 낱말(ko 어간 · en 낱말)과 선호 표. 선호가 없는 칸은 상관하지 않는다. */
export const POSITIONING_TABLE = [
  { tag: 'frontier', label: '업계 최전선', ko: ['최전선', '최첨단', '첨단', '선도', '혁신', '선구', '개척', '미래'], en: ['frontier', 'cutting-edge', 'pioneering', 'pioneer', 'innovative', 'leading', 'futuristic', 'next-gen'],
    prefs: { motion: ['M2', 'M3'], colorLogic: ['K6', 'K7', 'K2'], display: ['D2', 'D3'], theme: 'dark' } },
  { tag: 'trusted-local', label: '믿을 수 있는 동네 전문가', ko: ['동네', '믿을', '신뢰', '지역', '단골', '이웃', '전통', '믿음'], en: ['trusted', 'local', 'neighborhood', 'reliable', 'dependable', 'community'],
    prefs: { motion: ['M0', 'M1'], colorLogic: ['K1', 'K3'], theme: 'light', family: ['paper', 'editorial'] } },
  { tag: 'simplest', label: '가장 쉬운 선택', ko: ['가장 쉬운', '쉬운', '쉽게', '간편', '간단', '단순', '심플', '편한'], en: ['simple', 'simplest', 'easy', 'easiest', 'effortless', 'straightforward', 'minimal'],
    prefs: { motion: ['M0', 'M1'], colorLogic: ['K1', 'K9'], display: ['D1'], theme: 'light' } },
  { tag: 'premium', label: '프리미엄', ko: ['프리미엄', '고급', '럭셔리', '명품', '하이엔드'], en: ['premium', 'luxury', 'luxe', 'high-end', 'upscale', 'exclusive'],
    prefs: { motion: ['M1', 'M2'], colorLogic: ['K5', 'K1'], display: ['D1', 'D2'] } }, // 테마는 밝음·어두움 둘 다 괜찮다(감점 없음)
  { tag: 'playful', label: '재미있는', ko: ['재미', '발랄', '유쾌', '장난', '즐거', '귀여', '톡톡'], en: ['playful', 'fun', 'quirky', 'whimsical', 'cheerful'],
    prefs: { motion: ['M2', 'M3'], colorLogic: ['K8', 'K2'], display: ['D3'] } },
]

const norm = (s) => String(s ?? '').trim().toLowerCase()
const uniq = (xs) => [...new Set(xs)]

/**
 * 자유 문장 → 태그와 선호. 표에 없으면 null.
 * 여러 태그가 맞으면 선호를 합친다(배열은 합집합, 테마는 태그끼리 엇갈리면 상관하지 않는다).
 * @returns {{ text: string, tags: string[], labels: string[], prefs: { motion?: string[], colorLogic?: string[], theme?: 'light'|'dark', display?: string[], family?: string[] } } | null}
 */
export function positioningProfile(text) {
  const w = norm(text)
  if (!w) return null
  const en = new Set(w.split(/[^a-z-]+/).filter(Boolean))
  const hit = POSITIONING_TABLE.filter((t) => t.ko.some((k) => w.includes(k)) || t.en.some((e) => en.has(e)))
  if (!hit.length) return null
  const prefs = {}
  for (const key of ['motion', 'colorLogic', 'display', 'family']) {
    const merged = uniq(hit.flatMap((t) => t.prefs[key] ?? []))
    if (merged.length) prefs[key] = merged
  }
  const themes = uniq(hit.map((t) => t.prefs.theme).filter(Boolean))
  if (themes.length === 1) prefs.theme = themes[0]
  return { text: String(text).trim(), tags: hit.map((t) => t.tag), labels: hit.map((t) => t.label), prefs }
}

/**
 * 선호와 일치한 축 이름들(motion·colorLogic·theme·display·family). 층마다 상한은 호출하는 쪽이 적용한다.
 * 머리 비슷한 객체: { motion, colorLogic, defaultTheme, axes } — 레시피 머리 그대로 또는 프리셋에서 편 모양.
 * 테마 축은 선호가 있을 때 `defaultTheme`(없으면 light)이 같아야 일치다.
 */
export function positioningMatches(prefs, head) {
  if (!prefs) return []
  const out = []
  if (prefs.motion?.includes(head?.motion)) out.push('motion')
  if (prefs.colorLogic?.includes(head?.colorLogic)) out.push('colorLogic')
  if (prefs.theme && (head?.defaultTheme ?? 'light') === prefs.theme) out.push('theme')
  if (prefs.display?.includes(axisValue(head?.axes, 'display'))) out.push('display')
  if (prefs.family?.includes(materialFamily(head))) out.push('family')
  return out
}

/** 선호와 일치한 축 수. */
export const positioningHits = (prefs, head) => positioningMatches(prefs, head).length

/** 상한(POS_AXIS_CAP)을 적용한 일치 수 — 라이브러리·프리셋 층이 쓴다. */
export const positioningCapped = (prefs, head) => Math.min(POS_AXIS_CAP, positioningHits(prefs, head))
