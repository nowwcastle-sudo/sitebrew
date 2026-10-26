// 별점 요약과 공개 모양 만들기(순수 함수). 모양은 web-factory `blocks/_shared/review-kit` 의 Review·RatingSummary 와 같다
// (계약이 블록을 부르지 않으므로 타입은 복사하지 않고, 필드 목록이 같은지는 시험이 비교한다).
import type { ReviewKind, ReviewRow } from "@launch-factory/db"

export type Rating = 1 | 2 | 3 | 4 | 5
const RATINGS: readonly Rating[] = [1, 2, 3, 4, 5]

export interface RatingSummary {
  /** 소수 한 자리 */
  avg: number
  count: number
  /** 이 숫자의 기준일 YYYY-MM-DD */
  asOf: string
  /** 별점별 수 — 합이 count 와 같다 */
  distribution: Record<Rating, number>
}

export interface PublicReview {
  id: string
  kind: ReviewKind
  /** 후기에만 */
  rating?: Rating
  title?: string
  body: string
  /** 가린 이름 */
  author: string
  /** YYYY-MM-DD */
  date: string
  verified?: true
  reply?: { author: string; body: string; date: string }
}

/** 시간대 안의 날짜(YYYY-MM-DD). en-CA 로케일이 이 모양을 준다 */
export function isoDate(at: Date, timeZone = "UTC"): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(at)
}

/** 별점별 수 → 평균·분포. 1~5 밖의 별점은 세지 않는다 */
export function summarize(counts: readonly { rating: number; count: number }[], asOf: Date, timeZone?: string): RatingSummary {
  const distribution: Record<Rating, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  for (const c of counts) if ((RATINGS as readonly number[]).includes(c.rating)) distribution[c.rating as Rating] += c.count
  const count = RATINGS.reduce((n, r) => n + distribution[r], 0)
  const sum = RATINGS.reduce((n, r) => n + r * distribution[r], 0)
  return { avg: count === 0 ? 0 : Math.round((sum / count) * 10) / 10, count, asOf: isoDate(asOf, timeZone), distribution }
}

type PublicSource = Pick<ReviewRow, "id" | "kind" | "rating" | "title" | "body" | "authorName" | "verified" | "answerBody" | "answeredAt" | "createdAt">

/** 행 → 공개 모양. 사용자 id·상태·숨김 사유·답변자 id 는 싣지 않는다 */
export function toPublic(row: PublicSource, o: { timeZone?: string; sellerName: string }): PublicReview {
  return {
    id: row.id,
    kind: row.kind,
    ...(row.kind === "review" && row.rating ? { rating: row.rating as Rating } : {}),
    ...(row.title ? { title: row.title } : {}),
    body: row.body,
    author: row.authorName,
    date: isoDate(row.createdAt, o.timeZone),
    ...(row.verified ? { verified: true as const } : {}),
    ...(row.answerBody && row.answeredAt ? { reply: { author: o.sellerName, body: row.answerBody, date: isoDate(row.answeredAt, o.timeZone) } } : {}),
  }
}
