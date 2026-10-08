export const TITLE_FIT_WIDTH_VW = 96
/** 한 줄 상한을 넘으면 줄을 나눠서라도 이 비율 아래로는 줄이지 않는다(설계 크기의 60% — 17.8vw 설계면 10.7vw: 1440 에서 154px · 375 에서 40px). */
export const TITLE_FIT_MIN_SCALE = 0.6
export const TITLE_FIT_MAX_LINES = 3

// 낱자 폭(em). 한글·한자·전각은 1em. 로마자는 대문자로 그린다는 가정(uppercase) — 레시피 서체를 가리지 않게 넓은 쪽(0.68)으로 어림한다(응축 서체는 0.45~0.55 라 여유가 생긴다).
const WIDE = /[ᄀ-ᇿ⺀-〾ぁ-㏿㐀-䶿一-鿿가-힯豈-﫿＀-｠￠-￦]/
const unit = (ch: string) => (WIDE.test(ch) ? 1 : /\s/.test(ch) ? 0.28 : /[0-9]/.test(ch) ? 0.6 : /[A-Za-zÀ-ɏ]/.test(ch) ? 0.68 : /[.,:;!'"·‧•\-–—_]/.test(ch) ? 0.35 : 0.8)

/** 제목을 한 줄에 그렸을 때의 폭(em). */
export function titleUnits(text: string): number {
  let w = 0
  for (const ch of text.trim()) w += unit(ch)
  return +w.toFixed(2)
}

/** 가장 긴 낱말(공백으로 나눈 조각)의 폭(em) — 낱말은 중간에서 줄을 바꾸지 않는다. */
export function longestWordUnits(text: string): number {
  return Math.max(0, ...text.trim().split(/\s+/).map(titleUnits))
}

/** 설계 크기(designVw)로 한 줄에 들어가는 최대 폭(em). 이 블록의 제목 상한 메타(titleMaxUnits)가 이 값이다. */
export function maxTitleUnits(designVw: number): number {
  return Math.floor((TITLE_FIT_WIDTH_VW / designVw) * 10) / 10
}

/** 이 제목이 설계 크기 한 줄에 들어가는가(변형 고르기·폴백이 쓴다). */
export function fitsTitle(text: string, designVw: number): boolean {
  return titleUnits(text) <= maxTitleUnits(designVw)
}

/**
 * 글자 크기(vw)와 줄 수. 설계 크기로 한 줄에 들어가면 설계 크기 그대로(짧은 낱말은 설계 의도 그대로).
 * 넘치면 줄 수를 1→maxLines 로 늘려 가며 「설계 크기의 60% 이상」이 되는 첫 줄 수를 고르고, 없으면 maxLines 에서 줄인다.
 * 한 줄 폭은 max(가장 긴 낱말, 전체 폭 ÷ 줄 수 × 1.12(균형 나눔의 어긋남 여유)).
 */
export function titleFit(text: string, designVw: number, maxLines: number = TITLE_FIT_MAX_LINES): { vw: number; lines: number } {
  const total = titleUnits(text)
  const longest = longestWordUnits(text)
  if (total <= 0) return { vw: designVw, lines: 1 }
  const at = (lines: number) => Math.min(designVw, TITLE_FIT_WIDTH_VW / (lines === 1 ? Math.max(total, longest) : Math.max(longest, (total / lines) * 1.12)))
  for (let lines = 1; lines <= maxLines; lines++) {
    const vw = at(lines)
    if (lines === maxLines || vw >= designVw * TITLE_FIT_MIN_SCALE) return { vw: +vw.toFixed(2), lines }
  }
  return { vw: designVw, lines: 1 }
}
