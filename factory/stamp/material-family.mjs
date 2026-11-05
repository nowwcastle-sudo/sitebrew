// 재료 계열 분류(v0.2.6 T21 · P1 4.6절) — 레시피 머리(또는 머리 비슷한 객체)를 여덟 계열 중 하나로 읽는다.
// 앞에서부터 첫 일치: glass → collage → print → paper → kinetic → editorial → terminal → plain.
// 순수 함수 — 판정이 아니라 「서로 다른 세계인가」를 말하는 이름표다(점수 가산·thesis 문장·why 경고에만 쓴다. 하드 규칙은 visual-distance.mjs 의 거리 하나).
import { axisValue } from '../scripts/axes.mjs'

export const FAMILIES = ['glass', 'collage', 'print', 'paper', 'kinetic', 'editorial', 'terminal', 'plain']

/** 계열 이름표(thesis 문장·대시보드 표시용). */
export const FAMILY_LABEL = { glass: '유리', collage: '콜라주', print: '인쇄', paper: '종이', kinetic: '키네틱', editorial: '편집', terminal: '터미널', plain: '기본 화면' }

/** @param {{ axes?: object, motion?: string, defaultTheme?: string }} head */
export function materialFamily(head) {
  const a = head?.axes ?? {}
  const surface = a.surface
  const texture = axisValue(a, 'texture')
  const display = axisValue(a, 'display')
  if (surface === 'C5' || texture === 'X7' || texture === 'X8') return 'glass'
  if (texture === 'X3' || surface === 'C8') return 'collage'
  if (texture === 'X2' || surface === 'C6') return 'print'
  if (['X1', 'X4', 'X5', 'X6'].includes(texture) || a.shadow === 'S3') return 'paper'
  if (display === 'D3' || head?.motion === 'M3') return 'kinetic'
  if (a.header === 'H5' || display === 'D2') return 'editorial'
  if (head?.defaultTheme === 'dark' && a.radius === 'R0' && ['T4', 'T1'].includes(a.table)) return 'terminal'
  return 'plain'
}

/** 색 전략(P1 확정): 색 논리 K1·K3·K5·K9 Restrained · K4·K6·K7 Committed · K2·K8 Full. 표에 없으면 Restrained. */
const STRATEGY = { K1: 'Restrained', K3: 'Restrained', K5: 'Restrained', K9: 'Restrained', K4: 'Committed', K6: 'Committed', K7: 'Committed', K2: 'Full', K8: 'Full' }
export const STRATEGY_LABEL = { Restrained: '절제한', Committed: '한 색에 힘을 준', Full: '다채로운' }
export const colorStrategy = (head) => STRATEGY[head?.colorLogic] ?? 'Restrained'
