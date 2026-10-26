// 조회 요청 → DB 에 보낼 조회 명세(순수 함수). 낱말 정리·쪽 번호·종류 걸러내기를 한 곳에서 정한다.
import { isLocale } from "@launch-factory/i18n"
import { isKind, likePattern, normalizeQuery } from "./normalize.ts"

export const DEFAULT_PAGE_SIZE = 10
export const MAX_PAGE_SIZE = 50
const MAX_KINDS = 10

export interface SearchInput {
  q: unknown
  /** 이 종류의 문서만. 모양이 틀린 이름은 버리고, 하나도 남지 않으면 결과는 비어 있다 */
  kinds?: readonly unknown[]
  /** "ko"|"en". 다른 값은 무시한다(모든 언어) */
  locale?: unknown
  page?: unknown
  pageSize?: unknown
}

export interface SearchQuery {
  /** 정리한 낱말(스니펫 하이라이트에 쓴다) */
  terms: string[]
  /** `terms` 마다 이스케이프한 LIKE 패턴 */
  patterns: string[]
  kinds?: string[]
  locale?: "ko" | "en"
  page: number
  pageSize: number
  offset: number
}

const positiveInt = (value: unknown, fallback: number, max = Number.MAX_SAFE_INTEGER): number => {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value
  return typeof n === "number" && Number.isInteger(n) && n >= 1 ? Math.min(n, max) : fallback
}

/** 조회 명세. 찾을 것이 없는 요청(빈 질의·쓸 수 있는 종류가 하나도 없음)은 null — 부르는 쪽이 빈 결과를 돌려준다 */
export function buildQuery(input: SearchInput): SearchQuery | null {
  const terms = normalizeQuery(input.q)
  if (terms.length === 0) return null
  let kinds: string[] | undefined
  if (input.kinds !== undefined && input.kinds.length > 0) {
    kinds = [...new Set(input.kinds.filter(isKind))].slice(0, MAX_KINDS)
    if (kinds.length === 0) return null
  }
  const page = positiveInt(input.page, 1)
  const pageSize = positiveInt(input.pageSize, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE)
  return {
    terms,
    patterns: terms.map(likePattern),
    ...(kinds ? { kinds } : {}),
    ...(isLocale(input.locale) ? { locale: input.locale } : {}),
    page,
    pageSize,
    offset: (page - 1) * pageSize,
  }
}
