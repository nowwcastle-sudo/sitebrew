import { mockAnalytics, type TrackedEvent } from "@/registry/factory/contract/adapter-mock"

import type { FirstReviewCopy, Rating, RatingSummary, Review, ReviewKitCopy, ReviewSubject } from "../_shared/review-kit"
import type { ReviewListDistributionFilterCopy, ReviewListDistributionFilterProps } from "./distribution-filter"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 침구 가게 「솜결(예시)」 차렵이불 리뷰 — 이름은 가린 가상 이름, 문구마다 「예시」.
// 세 변형(분포 필터·사진 갤러리·가격 곁 요약)이 같은 리뷰 묶음을 쓴다. 요약(분포·평균)은 리뷰 목록에서 계산한다 — 화면 숫자와 목록이 어긋나지 않게.
export const KIT: ReviewKitCopy = {
  starsLabel: "5점 만점에 {avg}점",
  countLine: "리뷰 {count}개 · {date} 기준",
  verified: "구매 인증",
  reply: "판매자 답변",
  ratingShort: "5점 만점에 {rating}점",
  photoSlot: "사진 자리",
}
export const FIRST: FirstReviewCopy = {
  title: "아직 리뷰가 없어요",
  body: "첫 리뷰를 남겨 주시면 다음 손님이 고르는 데 큰 도움이 돼요.",
  legend: "별점을 먼저 골라 주세요",
  option: "{n}점",
  reward: "리뷰를 올리고 확인이 끝나면 적립금 1,000원을 드려요(쓴 뒤 지급 · 예시).",
  write: { label: "리뷰 쓰러 가기", href: "#write-review" },
}
export const SUBJECT: ReviewSubject = { type: "Product", name: "솜결 차렵이불 퀸(예시)", price: 89000, currency: "KRW" }

const photo = (alt: string) => ({ id: "review-photo", aspect: "1:1", source: "real-required" as const, alt })
const BODIES: Record<Rating, string[]> = {
  5: ["가볍고 따뜻해요. 세탁기에 돌려도 솜이 뭉치지 않았어요(예시).", "색이 사진과 똑같아요. 두 번째 샀어요(예시).", "여름에도 덥지 않아서 사계절 쓰고 있어요(예시).", "포장이 깔끔하고 냄새가 없어요(예시)."],
  4: ["좋은데 퀸 치고 폭이 살짝 좁게 느껴져요(예시).", "촉감은 좋은데 처음에 먼지가 조금 나왔어요(예시)."],
  3: ["무난해요. 가격을 생각하면 보통이에요(예시)."],
  2: ["두 번 빨았더니 모서리 바느질이 조금 풀렸어요(예시)."],
  1: ["배송이 닷새 걸렸고 상자가 젖어서 왔어요(예시)."],
}
const NAMES = ["김**", "이**", "박**", "최**", "정**", "강**", "조**", "윤**", "장**", "임**"]

/** n 개 리뷰 — 별점 비율은 5점이 많고 1점까지 있다. 날짜는 9월 27일부터 하루씩 거슬러 간다 */
export function makeReviews(n: number, withPhotos = true): Review[] {
  const pattern: Rating[] = [5, 5, 4, 5, 1, 5, 3, 5, 4, 2, 5, 5]
  return Array.from({ length: n }, (_, i) => {
    const rating = pattern[i % pattern.length]
    const bodies = BODIES[rating]
    const day = new Date(Date.UTC(2026, 8, 27 - i, 3)).toISOString()
    const r: Review = { id: `r${i + 1}`, rating, body: bodies[i % bodies.length], author: NAMES[i % NAMES.length], date: day, verified: i % 4 !== 3, option: i % 3 === 0 ? "퀸 · 크림(예시)" : undefined }
    if (withPhotos && (rating >= 4 ? i % 3 === 0 : i % 2 === 0)) r.photos = [photo(`${r.author}님이 올린 차렵이불 사진 ${i + 1}(예시)`)]
    if (rating <= 2) r.reply = { author: "솜결(예시)", body: "불편을 드려 죄송해요. 교환 안내를 문자로 보내 드렸어요(예시).", date: new Date(Date.UTC(2026, 8, 28 - i, 6)).toISOString() }
    if (i === 0) r.title = "사계절 쓰기 좋아요"
    return r
  })
}
/** 리뷰 목록에서 요약(평균·수·분포)을 계산한다 */
export function summarize(reviews: Review[], asOf = "2026-09-28T00:00:00.000Z"): RatingSummary {
  const distribution: Record<Rating, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  for (const r of reviews) distribution[r.rating]++
  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0
  return { avg, count: reviews.length, asOf, distribution }
}

const COPY: ReviewListDistributionFilterCopy = {
  title: "구매 후기",
  kit: KIT,
  filterLegend: "별점으로 거르기",
  all: "전체",
  starOption: "{n}점",
  resultLine: "{label} 리뷰 {count}개",
  emptyFilter: "이 별점의 리뷰는 아직 없어요.",
  more: "리뷰 {n}개 더 보기",
  write: { label: "리뷰 쓰기", href: "#write-review", reward: "리뷰를 올리고 확인이 끝나면 적립금 1,000원을 드려요(쓴 뒤 지급 · 예시)." },
  first: FIRST,
}

const R12 = makeReviews(12)
export const fixture: ReviewListDistributionFilterProps = { copy: COPY, reviews: R12, summary: summarize(R12), subject: SUBJECT }

const R40 = makeReviews(40)
export const fixtureMax: ReviewListDistributionFilterProps = {
  copy: { ...COPY, title: "구매 후기 — 구매 인증 리뷰를 먼저, 낮은 별점도 그대로 보여 드려요" },
  reviews: R40.map((r, i) => (i === 1 ? { ...r, title: "두 번째 구매예요. 색상은 크림보다 그레이가 먼지가 덜 보여서 이번엔 그레이로 골랐어요(예시)", body: `${r.body} 세탁은 찬물 울 코스로 했고 건조기는 쓰지 않았어요. 한 달 써 본 뒤 다시 남길게요(예시).` } : r)),
  summary: summarize(R40),
  subject: SUBJECT,
}

// 리뷰 5개 이하 — 막대를 숨긴다(T5)
const R3 = makeReviews(3, false)
export const fixtureMin: ReviewListDistributionFilterProps = { copy: COPY, reviews: R3, summary: summarize(R3), subject: SUBJECT }

export const fixturePorts = (q: URLSearchParams, g: { fx: string; onTrack: (e: TrackedEvent) => void }): Partial<ReviewListDistributionFilterProps> => {
  const a = mockAnalytics(q, { onTrack: g.onTrack })
  return { track: a.track }
}
