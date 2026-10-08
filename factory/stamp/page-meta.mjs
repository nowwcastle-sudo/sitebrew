// 쪽 메타 설명(FINAL-WF2 AB4·AB8) — 순수 함수. 06 이 쪽마다 설명을 그 쪽의 첫 본문 문단에서 만든다.
//   · AB4: 사이트 설명(site.description)이 없거나 「확인 필요」면 메타·OG 설명이 「확인 필요」로 나갔다 → 히어로 첫 문장·쪽 본문에서 대체한다.
//   · AB8: 사이트 전체가 설명 하나를 나눠 쓰던 길 → 쪽마다 그 쪽의 글에서 만든다(겹치면 ops 가 오류로 낸다).
//   설명은 검색 결과에서 잘리지 않게 160자 안쪽으로 문장 끝(없으면 낱말 끝)에서 자른다.
import { isNeedsCheck } from './needs-check.mjs'

/** 설명으로 쓸 만한 문구 칸 id — 앞일수록 먼저(부제·한 줄 소개 → 본문). 행동 문구(cta)·화면 문구 칸(ui:)·제목은 설명이 아니다. */
export const DESCRIPTION_SLOT_IDS = ['subhead', 'lede', 'tagline', 'oneLiner', 'intro', 'body', 'statement', 'headline', 'h1']
const NOT_PROSE = /(?:^ui:)|cta$|^cta|label$|^label|^title$/i
const MIN_FALLBACK = 15

/** 160자 안쪽으로 줄인다: 이미 짧으면 그대로, 길면 문장 끝(. ! ? 。 요.)에서, 없으면 낱말 끝에서 「…」 없이 자른다(문장 중간에서 끊기는 것을 피한다). */
export function cutDescription(text, max = 160) {
  const t = String(text).replace(/\s+/g, ' ').trim()
  if ([...t].length <= max) return t
  const head = [...t].slice(0, max).join('')
  const sentence = [...head.matchAll(/[.!?。]\s|[.!?。]$/g)].at(-1)
  if (sentence && sentence.index >= 40) return head.slice(0, sentence.index + 1).trim()
  const space = head.lastIndexOf(' ')
  return (space >= 40 ? head.slice(0, space) : head).trim()
}

/**
 * 한 쪽의 문구 칸들 → 설명으로 쓸 칸 하나(없으면 null).
 * @param {{ id: string, text: string, index: number }[]} entries  그 쪽의 칸(사이트맵 순서)
 * @returns {{ index: number, text: string }|null}
 */
export function pickDescriptionSlot(entries) {
  const usable = entries.filter((e) => typeof e.text === 'string' && e.text.trim() && !isNeedsCheck(e.text) && !NOT_PROSE.test(e.id))
  for (const id of DESCRIPTION_SLOT_IDS) {
    const hit = usable.find((e) => e.id === id && [...e.text.trim()].length >= 12)
    if (hit) return { index: hit.index, text: hit.text.trim() }
  }
  const longest = [...usable].sort((a, b) => [...b.text].length - [...a.text].length)[0]
  return longest && [...longest.text.trim()].length >= MIN_FALLBACK ? { index: longest.index, text: longest.text.trim() } : null
}
