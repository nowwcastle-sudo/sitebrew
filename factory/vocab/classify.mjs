// 대략 분류(설계 5.11): 사전이 갈래(kind)와 대표 읽기(lead)까지만 정하고, 세부 해석은 다음 단계에서 Claude 가 한다.
//   1) interpret 가 확정(confirmed)·후보 둘(two)을 내면 그대로 쓴다(kind·lead 가 이미 들어 있다).
//   2) 사전 낱말이 하나도 안 맞은 모름(unmatched)이면 비슷한 예문(nearest)으로 분류한다: { result: 'near', nearest, kind, lead } — kind·lead 는 첫 후보의 것.
//      후보 둘이 대표 읽기가 달라도 둘 다 nearest 에 남는다(Claude 가 원문과 견준다). 기준값(minScore)을 넘는 예문이 없으면 그대로 모름.
//   3) 낱말은 맞았는데 부딪치거나 겹부정인 모름은 예문으로 넘기지 않는다 — 되묻는 게 맞다.
// 결과 모양은 아래 Classification 한 곳에서 정한다(해석기·채점기·힌트·계획 2가 모두 이 모양을 읽는다).
import { interpret, leadOf } from './interpret.mjs'
import { nearest } from './similar.mjs'

/**
 * @typedef {'modifier'|'reference'|'diagnosis'|'impression'|'axis'} Kind 낱말 항목의 갈래(lexicon.mjs 의 KINDS)
 * @typedef {{ axis: string, direction?: string, value?: string }} Lead 대표 읽기: 축 + 방향(color-hue·type-family 는 value)
 * @typedef {{ axis: string, direction?: string, value?: string, strength: number, scope: string, cap?: true, source: string }} Reading
 *   strength = 크기 0..2(부호는 direction) · scope = site | page:<키> | section:<키> | element:<이름> · cap = 그 방향으로 더 가지 않는 상한 · source = 읽기를 낸 항목 id
 *
 * @typedef {object} Confirmed 한 가지로 정해진 해석. 진단 낱말은 절대 확정이 되지 않는다.
 * @property {'confirmed'} result
 * @property {Reading[]} readings 합친 읽기 전부. 첫 읽기가 대표 읽기다
 * @property {string} say 이해한 내용(입력에 한글이 있으면 한국어, 아니면 영어)
 * @property {string[]} sources 맞은 낱말 항목들의 id
 * @property {Kind} kind 대표 읽기를 만든 항목의 갈래 — 범위·세기·부정이 붙었으면 'modifier'
 * @property {Lead|null} lead 첫 읽기의 축 + 방향|값 — copyFrom 결과는 읽기가 없어 null
 * @property {string} [copyFrom] 시안 비교 말(「2번 시안처럼」·「아까 게」)일 때만: 따라 할 시안 id 또는 'previous'. 이때 readings 는 빈 목록이다(복사는 계획 단계가 한다) — ctx.candidates 가 있을 때만 나온다
 *
 * @typedef {object} Two 후보 둘: 진단(원인 둘 이상)이나 confidence low 항목. 앞의 원인 둘만 선택지가 된다.
 * @property {'two'} result
 * @property {{ readings: Reading[], say: string, lead: Lead }[]} options 정확히 둘. 선택지마다 읽기 묶음·보여 줄 글·대표 읽기
 * @property {string[]} sources
 * @property {Kind} kind
 * @property {Lead} lead 첫 선택지의 대표 읽기
 *
 * @typedef {object} Near 사전 낱말은 안 맞았지만 비슷한 예문이 있는 경우(대략 분류). 읽기는 없다 — 세부 해석은 Claude 가 원문과 견주어 한다.
 * @property {'near'} result
 * @property {{ id: string, score: number, kind: Kind, lead: Lead }[]} nearest 겹침이 큰 순서(첫 후보가 kind·lead 를 정한다)
 * @property {Kind} kind 첫 후보의 갈래
 * @property {Lead} lead 첫 후보의 대표 읽기
 * @property {string} ask 해석기가 낸 되묻는 말(근사 후보를 쓰지 않는 쪽이 이어서 쓴다)
 *
 * @typedef {object} Unknown 모름: 되물어야 한다. 사전 낱말이 하나도 안 맞은 경우는 unmatched 로 표시한다(비슷한 예문으로 넘길 수 있다).
 * @property {'unknown'} result
 * @property {string} ask 되묻는 말
 * @property {string[]} choices 보여 줄 선택지 글(없으면 빈 목록)
 * @property {true} [unmatched] 사전 낱말이 하나도 안 맞았다
 * @property {Reading[]} [clash] 서로 반대로 읽혀 되물을 때, 부딪친 항목들의 읽기(값을 둘 말한 경우 두 값을 그대로 쓰라고 — 수정 명령이 읽는다)
 *
 * @typedef {Confirmed | Two | Near | Unknown} Classification
 */

/** 시험 줄의 정답이 받아들이는 읽기 목록들: 확정 = 목록 하나 · 후보 둘 = 목록 둘 · "ask" 는 빈 목록. */
export const listsOf = (expect) => (Array.isArray(expect) ? [expect] : expect?.two ?? [])

/** 시험 줄의 정답에서 대표 읽기(각 읽기 목록의 첫 읽기)들. 정답이 ask 이거나 읽기가 없으면 빈 목록. */
export function expectedLeads(expect) {
  return listsOf(expect).filter((l) => l.length).map((l) => leadOf(l[0]))
}

/** 시험 줄의 정답에 든 모든 읽기의 대표 꼴(축 + 방향·값). 대표 축 일치는 분류의 대표 읽기가 이 안에 있는지로 잰다(설계 7.2 — 정답 목록의 순서는 중요도가 아니다). */
export function answerLeads(expect) {
  return listsOf(expect).flat().map(leadOf)
}

/** 예문 묶음: 정답에 읽기가 있고 probe 가 아닌 줄. 정답이 후보 둘이면 첫 목록의 대표 읽기를 쓴다. */
export function examplesFrom(rows) {
  return rows.filter((r) => !r.probe && expectedLeads(r.expect).length).map((r) => ({ id: r.id, text: r.text, kind: r.kind, lead: expectedLeads(r.expect)[0] }))
}

/**
 * @param {string} text
 * @param {object} lex loadLexicon() 결과
 * @param {{ id: string, text: string, kind: string, lead: object }[]} examples examplesFrom() 결과
 * @param {{ minScore: number, topK: number }} cfg similar.json
 * @param {{ candidates?: string[] }} [ctx] interpret 의 시안 비교 문맥(없으면 예전과 같다)
 * @returns {Classification}
 */
export function classify(text, lex, examples, cfg, ctx = {}) {
  const r = interpret(text, lex, ctx)
  if (r.result !== 'unknown' || !r.unmatched) return r
  const near = nearest(text, examples, cfg)
  if (!near.length) return r
  return { result: 'near', nearest: near, kind: near[0].kind, lead: near[0].lead, ask: r.ask }
}
