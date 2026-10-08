import type { ContentListProps } from "./list"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 공방 「결마루(예시)」의 소식.
const UNITS = { photoNeeded: "실제 사진 필요", imagePending: "이미지 준비 중", external: "다른 사이트", pages: "{n}쪽" }

export const fixture: ContentListProps = {
  copy: { title: "소식", units: UNITS },
  items: [
    { title: "가을 공방 견학 신청을 받아요(예시)", href: "/news", meta: [{ value: "2026-09-18", format: "date" }] },
    { title: "마루판 식탁이 지역 공예전에 걸려요(예시)", href: "https://news.invalid/a", external: true, meta: [{ value: "2026-08-30", format: "date" }] },
    { title: "새 작업실로 옮겼어요(예시)", href: "/news", meta: [{ value: "2026-07-02", format: "date" }] },
  ],
}

export const fixtureMax: ContentListProps = {
  copy: { title: "보도자료", lead: "공방이 직접 낸 글과 기사를 모았어요(예시).", units: UNITS },
  items: [
    {
      title: "오래된 기둥이 식탁이 되기까지 — 결마루 작업기(예시)",
      href: "https://news.invalid/b",
      external: true,
      summary: "철거 현장에서 받은 목재를 다듬는 과정을 지역 신문이 따라갔어요(예시).",
      meta: [{ value: "2026-09-18", format: "date" }, { value: "지역 신문(예시)" }],
      image: { id: "news-thumb", aspect: "16:9", source: "stock-ok", alt: "작업대 위 목재" },
    },
    { title: "공방 견학 일정 안내(예시)", href: "/news", summary: "매달 둘째 토요일 오전에 열어요(예시).", meta: [{ value: "2026-08-30", format: "date" }, { value: "공지(예시)" }] },
    { title: "지속가능성 보고서(예시)", href: "/report.pdf", meta: [{ value: 2025, format: "year" }, { value: 24, format: "pages" }, { value: "4.2MB" }] },
  ],
}

export const fixtureMin: ContentListProps = {
  copy: { title: "새 기능", units: UNITS },
  items: [{ title: "예약 알림을 메일로도 받아요(예시)", meta: [{ value: "2026-09-01", format: "date" }] }],
}
