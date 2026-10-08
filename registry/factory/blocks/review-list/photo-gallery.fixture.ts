import { mockAnalytics, type TrackedEvent } from "@/registry/factory/contract/adapter-mock"

import { FIRST, KIT, makeReviews, summarize } from "./distribution-filter.fixture"
import type { ReviewListPhotoGalleryCopy, ReviewListPhotoGalleryProps } from "./photo-gallery"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 침구 가게 「솜결(예시)」 — 사진은 비워 둔다(비율을 지킨 빈 사진 자리, 대체 글은 그대로).
const COPY: ReviewListPhotoGalleryCopy = {
  title: "사진으로 보는 후기",
  kit: KIT,
  galleryTitle: "사진 리뷰",
  photoLink: "{author}님 리뷰의 사진 보기",
  reward: "사진 리뷰를 올리고 확인이 끝나면 적립금 2,000원을 드려요(쓴 뒤 지급 · 예시).",
  listTitle: "모든 리뷰",
  more: "리뷰 {n}개 더 보기",
  first: FIRST,
}

const R12 = makeReviews(12)
export const fixture: ReviewListPhotoGalleryProps = { copy: COPY, reviews: R12, summary: summarize(R12) }

const R40 = makeReviews(40)
export const fixtureMax: ReviewListPhotoGalleryProps = {
  copy: { ...COPY, title: "사진으로 보는 후기 — 실제로 산 분들이 올린 사진을 먼저 보여 드려요", reward: "사진 리뷰를 올리고 확인이 끝나면 적립금 2,000원을 드려요. 적립금은 리뷰를 쓴 뒤 지급하고, 별점과 상관없이 같아요(예시)." },
  reviews: R40,
  summary: summarize(R40),
  maxPhotos: 12,
}

// 리뷰 0개 — 첫 리뷰를 청한다(T6 · T9)
export const fixtureMin: ReviewListPhotoGalleryProps = { copy: COPY, reviews: [], summary: summarize([]) }

export const fixturePorts = (q: URLSearchParams, g: { fx: string; onTrack: (e: TrackedEvent) => void }): Partial<ReviewListPhotoGalleryProps> => {
  const a = mockAnalytics(q, { onTrack: g.onTrack })
  return { track: a.track }
}
