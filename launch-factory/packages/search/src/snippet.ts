// 결과 조각과 하이라이트 범위(순수 함수). 하이라이트는 HTML 이 아니라 범위 배열이다 — 화면이 글자를 그대로 그리고
// 범위만 <mark> 로 감싸므로, 문서 글에 든 `<script>` 같은 것이 마크업으로 풀리지 않는다.
//
// 범위 `[start, end)` 는 `text` 안의 UTF-16 코드 유닛 위치다(JS `text.slice(start, end)` 와 같다).

export interface Snippet {
  text: string
  ranges: Array<[number, number]>
}

export const SNIPPET_LENGTH = 120
/** 첫 일치 앞에 남기는 글자 수 */
export const SNIPPET_LEAD = 30
const ELLIPSIS = "…"

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/** 낱말들이 맞는 자리(겹치거나 붙은 것은 하나로) */
function rangesIn(text: string, terms: readonly string[], offset = 0): Array<[number, number]> {
  if (terms.length === 0) return []
  // 긴 낱말을 먼저 두어 "청소"와 "청소기"가 함께 있으면 더 긴 쪽이 잡힌다
  const re = new RegExp([...terms].sort((a, b) => b.length - a.length).map(escapeRegExp).join("|"), "giu")
  const found: Array<[number, number]> = []
  for (const m of text.matchAll(re)) {
    const start = (m.index ?? 0) + offset
    const end = start + m[0].length
    const last = found[found.length - 1]
    if (last && start <= last[1]) last[1] = Math.max(last[1], end)
    else found.push([start, end])
  }
  return found
}

const isLow = (code: number) => code >= 0xdc00 && code <= 0xdfff
const isHigh = (code: number) => code >= 0xd800 && code <= 0xdbff

/** 본문에서 첫 일치 둘레를 잘라 낸다. 일치가 본문에 없으면(제목에서만 맞은 경우) 본문 앞부분이고 범위는 비어 있다 */
export function makeSnippet(body: string, terms: readonly string[]): Snippet {
  const flat = body.replace(/\s+/g, " ").trim()
  const first = rangesIn(flat, terms)[0]
  let start = first ? Math.max(0, first[0] - SNIPPET_LEAD) : 0
  let end = Math.min(flat.length, start + SNIPPET_LENGTH)
  if (start > 0 && isLow(flat.charCodeAt(start))) start += 1
  if (end < flat.length && isHigh(flat.charCodeAt(end - 1))) end -= 1
  const head = start > 0 ? ELLIPSIS : ""
  const tail = end < flat.length ? ELLIPSIS : ""
  const slice = flat.slice(start, end)
  return { text: `${head}${slice}${tail}`, ranges: rangesIn(slice, terms, head.length) }
}
