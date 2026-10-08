import type { SocialProofRatingSummaryProps } from "./rating-summary"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 가게 후기, 문구마다 「예시」.
export const fixture: SocialProofRatingSummaryProps = {
  copy: {
    title: "방문 후기",
    lead: "방문한 분만 남길 수 있는 후기입니다(예시).",
    score: 4.8,
    outOf: 5,
    countTemplate: "후기 {n}개",
    scoreUnit: "점",
    distribution: [924, 231, 77, 31, 21],
    reviews: [
      { rating: 5, text: "빵이 매일 아침 나오는 시간이 정확해서 줄 서기 좋아요. 소금빵은 꼭 드셔 보세요(예시).", name: "김**", date: "2026-09-21" },
      { rating: 5, text: "주차가 편하고 직원분들이 친절합니다(예시).", name: "박**", date: "2026-09-18" },
      { rating: 4, text: "주말 오전에는 조금 붐벼요. 평일에 가면 여유롭습니다(예시).", name: "이**", date: "2026-09-12" },
    ],
  },
}

// 최대: 문구 끝까지, 후기 6개(긴 후기 섞음), 큰 수.
export const fixtureMax: SocialProofRatingSummaryProps = {
  copy: {
    title: "방문 후기 — 최근 1년, 방문 확인된 분만(예시)",
    lead: "영수증이나 예약 기록으로 방문을 확인한 분만 후기를 남길 수 있어요. 가게가 후기를 지우거나 고칠 수 없고, 별점 평균은 최근 1년 후기로 세요(예시).",
    score: 4.6,
    outOf: 5,
    countTemplate: "최근 1년 방문 후기 {n}개",
    scoreUnit: "점",
    distribution: [128400, 34210, 9020, 3110, 2870],
    reviews: Array.from({ length: 6 }, (_, i) => ({
      rating: 5 - (i % 3),
      text: "빵이 매일 아침 나오는 시간이 정확해서 줄 서기 좋아요. 주말 오전에는 조금 붐비지만 평일에는 여유롭고, 직원분들이 빵 고르는 것도 친절하게 도와주십니다. 소금빵과 무화과 깜파뉴는 꼭 드셔 보세요(예시).",
      name: `김**${i + 1}`,
      date: "2026-09-21",
    })),
  },
}

// 최소: 머리말 없이 후기 1개, 한쪽으로 쏠린 분포.
export const fixtureMin: SocialProofRatingSummaryProps = {
  copy: { title: "방문 후기", score: 5, outOf: 5, countTemplate: "후기 {n}개", scoreUnit: "점", distribution: [3, 0, 0, 0, 0], reviews: [{ rating: 5, text: "좋아요(예시).", name: "김**", date: "2026-09-21" }] },
}
