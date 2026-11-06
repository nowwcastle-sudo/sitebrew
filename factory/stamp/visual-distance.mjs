// 「다른 세계」 거리(v0.2.6 T21 · P1 4.6절) — 후보 머리 둘이 눈으로 얼마나 다른지 센다.
// 셈하는 칸 7개: surface · header · shadow · display · texture · defaultTheme · hero. 칸마다 1점, 값이 없으면 AXIS_DEFAULTS(display D1 · texture X0 · 테마 light)로 채워 비교한다.
// 하드 규칙은 거리 하나(SPACE_RULE.minDistance)이고 계열(materialFamily)은 소프트다 — dashboard·public 은 프리셋 대부분이 plain 이라 계열을 하드로 두면 후보가 소수 조합에 몰린다(P2 F3).
import { axisValue } from '../scripts/axes.mjs'
import { FAMILY_LABEL, STRATEGY_LABEL, materialFamily, colorStrategy } from './material-family.mjs'

export const DISTANCE_FIELDS = ['surface', 'header', 'shadow', 'display', 'texture', 'defaultTheme', 'hero']
export const SPACE_RULE = { minDistance: 2, distinctFamily: false }

const fieldOf = (head, k) => (k === 'defaultTheme' ? head?.defaultTheme ?? 'light' : k === 'hero' ? head?.hero ?? '' : axisValue(head?.axes, k) ?? '')

/** 서로 다른 칸 수(정수). */
export const visualDistance = (a, b) => DISTANCE_FIELDS.filter((k) => fieldOf(a, k) !== fieldOf(b, k)).length

/** 다른 칸 이름들(후보 머리의 sig 한 줄·detail 에 쓴다). */
export const distanceFields = (a, b) => DISTANCE_FIELDS.filter((k) => fieldOf(a, k) !== fieldOf(b, k))

/**
 * 후보 머리 여럿이 모든 쌍에서 최소 거리를 지키는지.
 * @param {{ id: string }[]} heads
 * @returns {{ ok: boolean, violations: { pair: [string, string], rule: 'visual-distance', detail: string }[] }}
 */
export function checkWorldSpread(heads, rule = SPACE_RULE) {
  const violations = []
  for (let i = 0; i < heads.length; i++) for (let j = i + 1; j < heads.length; j++) {
    const d = visualDistance(heads[i], heads[j])
    if (d < rule.minDistance) violations.push({ pair: [heads[i].id, heads[j].id], rule: 'visual-distance', detail: `거리 ${d} < ${rule.minDistance}` })
  }
  return { ok: violations.length === 0, violations }
}

/** 소프트 경고: 두 머리가 같은 계열이면 why 에 적을 문구, 아니면 ''. */
export const familyClash = (a, b) => {
  const fa = materialFamily(a)
  return fa === materialFamily(b) ? `같은 ${FAMILY_LABEL[fa]} 계열` : ''
}

/** 원형별 한 줄 목표(thesis 의 「무엇을 보여 주나」 — 포지셔닝 답이 없을 때). */
export const ARCHETYPE_GOAL = {
  brand: '회사가 하는 일', commerce: '상품과 합계', dashboard: '오늘 할 조치', detail: '구매 판단 정보', landing: '제안과 신청',
  local: '여는 시간과 예약 길', portfolio: '실제 작업', public: '민원으로 가는 길', pwa: '앱처럼 쓰는 핵심 과업', saas: '제품이 맞는지와 가입',
}

// 받침 있는 낱말 뒤는 「을」, 없으면 「를」(영문·숫자로 끝나면 「를」로 둔다 — 읽는 소리를 모르기 때문).
const objectParticle = (w) => { const c = String(w).trim().slice(-1).charCodeAt(0); return c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 ? '을' : '를' }

/** thesis 한 문장: "{계열} 세계에서 {색 전략} 색으로 {포지셔닝 또는 원형 목표}를 보여 줘요." */
export const thesisOf = ({ family, strategy, goal }) => `${FAMILY_LABEL[family] ?? family} 세계에서 ${STRATEGY_LABEL[strategy] ?? strategy} 색으로 ${goal}${objectParticle(goal)} 보여 줘요.`

/** 후보 머리 4칸 — 판정에 쓰지 않고 대시보드 표시용. */
export function worldFields(head, { goal, others = [], warnings = [] } = {}) {
  const family = materialFamily(head)
  const strategy = colorStrategy(head)
  const diffs = others.map((o) => ({ n: visualDistance(head, o), fields: distanceFields(head, o) })).sort((x, y) => y.n - x.n)[0]
  return {
    thesis: thesisOf({ family, strategy, goal }),
    sig: diffs ? `가장 큰 차이: ${diffs.fields.join('·') || '없음'}(${diffs.n}칸)` : '',
    world: FAMILY_LABEL[family],
    risk: warnings[0] ?? '',
    // 대시보드·비교표·완성 리뷰·브랜드 노출 관문이 읽는 이름(T10·T12·T14 와 이어진다)
    ownWorld: FAMILY_LABEL[family],
    materialFamily: family,
    colorStrategy: strategy,
  }
}
