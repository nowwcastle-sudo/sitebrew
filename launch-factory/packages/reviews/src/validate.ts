// 제출·목록 입력 검사(순수 함수) — DB·시계·네트워크를 쓰지 않는다. 결과는 다듬은 값 또는 칸 이름별 오류 문구.
// 입력에서 읽는 칸은 아래 목록뿐이다(status·verified·userId 같은 칸은 보내도 읽지 않는다).
import { t, type Locale } from "@launch-factory/i18n"
import { REVIEW_KINDS, type ReviewKind } from "@launch-factory/db"

export const LIMITS = { name: 40, title: 100, bodyMin: 5, body: 5000, subjectType: 32, subjectId: 100, pageSize: 50 } as const
export const DEFAULT_MAX_LINKS = 2
export const DEFAULT_PAGE_SIZE = 10
export const SORTS = ["latest", "rating-desc", "rating-asc"] as const
export type Sort = (typeof SORTS)[number]

const SUBJECT_TYPE = /^[a-z][a-z0-9_-]{0,31}$/
const SUBJECT_ID = /^[A-Za-z0-9._:-]{1,100}$/
const LINK = /(?:https?:\/\/|www\.)\S+/gi

export type Fields = Record<string, string[]>
export type Parsed<T> = { ok: true; value: T } | { ok: false; fieldErrors: Fields }
export type SubmitInput = FormData | Record<string, unknown>

export interface ParsedSubmit {
  kind: ReviewKind
  subjectType: string
  subjectId: string
  rating?: number
  title?: string
  body: string
  authorName?: string
}

export interface ParsedList {
  subjectType: string
  subjectId: string
  kind: ReviewKind
  sort: Sort
  rating?: number
  page: number
  pageSize: number
}

/** FormData·객체에서 문자열 칸만 읽는다(자기 속성만, 문자열이 아닌 값은 없는 것으로) */
export function readFields(input: SubmitInput | URLSearchParams): Map<string, string> {
  const out = new Map<string, string>()
  const entries = input instanceof FormData || input instanceof URLSearchParams ? [...input.entries()] : Object.entries(input ?? {})
  for (const [k, v] of entries) if (typeof v === "string") out.set(k, v.trim())
  return out
}

const length = (s: string) => Array.from(s).length
const intIn = (s: string | undefined, min: number, max: number): number | undefined => (s !== undefined && /^\d{1,6}$/.test(s) && Number(s) >= min && Number(s) <= max ? Number(s) : undefined)

export function parseSubmit(input: SubmitInput, o: { locale: Locale; maxLinks?: number }): Parsed<ParsedSubmit> {
  const f = readFields(input)
  const errors: Fields = {}
  const err = (field: string, text: string) => (errors[field] ??= []).push(text)
  const kindText = f.get("kind") ?? ""
  const kind = REVIEW_KINDS.find((k) => k === kindText)
  if (!kind) err("kind", t(o.locale, "reviews.kindInvalid"))
  const subjectType = f.get("subjectType") ?? ""
  if (!SUBJECT_TYPE.test(subjectType)) err("subjectType", t(o.locale, "reviews.subjectInvalid"))
  const subjectId = f.get("subjectId") ?? ""
  if (!SUBJECT_ID.test(subjectId)) err("subjectId", t(o.locale, "reviews.subjectInvalid"))

  let rating: number | undefined
  if (kind === "review") {
    rating = intIn(f.get("rating"), 1, 5)
    if (rating === undefined) err("rating", t(o.locale, "reviews.ratingRequired"))
  }
  const title = f.get("title") || undefined
  if (title && length(title) > LIMITS.title) err("title", t(o.locale, "reviews.tooLong", { max: LIMITS.title }))
  const authorName = f.get("authorName") || undefined
  if (authorName && length(authorName) > LIMITS.name) err("authorName", t(o.locale, "reviews.tooLong", { max: LIMITS.name }))
  const body = f.get("body") ?? ""
  const maxLinks = o.maxLinks ?? DEFAULT_MAX_LINKS
  if (!body) err("body", t(o.locale, "reviews.required"))
  else if (length(body) < LIMITS.bodyMin) err("body", t(o.locale, "reviews.bodyTooShort", { min: LIMITS.bodyMin }))
  else if (length(body) > LIMITS.body) err("body", t(o.locale, "reviews.tooLong", { max: LIMITS.body }))
  else if ((body.match(LINK) ?? []).length > maxLinks) err("body", t(o.locale, "reviews.tooManyLinks", { max: maxLinks }))

  if (Object.keys(errors).length || !kind) return { ok: false, fieldErrors: errors }
  return { ok: true, value: { kind, subjectType, subjectId, ...(rating !== undefined ? { rating } : {}), ...(title ? { title } : {}), body, ...(authorName ? { authorName } : {}) } }
}

export function parseListQuery(input: URLSearchParams | Record<string, unknown>, o: { locale: Locale }): Parsed<ParsedList> {
  const f = readFields(input)
  const errors: Fields = {}
  const err = (field: string, text: string) => (errors[field] ??= []).push(text)
  const subjectType = f.get("subjectType") ?? ""
  if (!SUBJECT_TYPE.test(subjectType)) err("subjectType", t(o.locale, "reviews.subjectInvalid"))
  const subjectId = f.get("subjectId") ?? ""
  if (!SUBJECT_ID.test(subjectId)) err("subjectId", t(o.locale, "reviews.subjectInvalid"))
  const kindText = f.get("kind") ?? "review"
  const kind = REVIEW_KINDS.find((k) => k === kindText)
  if (!kind) err("kind", t(o.locale, "reviews.kindInvalid"))
  const sortText = f.get("sort") ?? "latest"
  const sort = SORTS.find((s) => s === sortText)
  if (!sort) err("sort", t(o.locale, "reviews.queryInvalid"))
  const ratingText = f.get("rating")
  const rating = ratingText ? intIn(ratingText, 1, 5) : undefined
  if (ratingText && rating === undefined) err("rating", t(o.locale, "reviews.queryInvalid"))
  if (Object.keys(errors).length || !kind || !sort) return { ok: false, fieldErrors: errors }
  const page = intIn(f.get("page"), 1, 100_000) ?? 1
  const pageSize = Math.min(intIn(f.get("pageSize"), 1, 100_000) ?? DEFAULT_PAGE_SIZE, LIMITS.pageSize)
  return { ok: true, value: { subjectType, subjectId, kind, sort, ...(kind === "review" && rating !== undefined ? { rating } : {}), page, pageSize } }
}
