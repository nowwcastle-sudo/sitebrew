import type { ContentGalleryProps } from "./gallery"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 찻집 「솔바람(예시)」의 공간 사진 칸 — 실사 필수라 src 가 없으면 빈 틀이다.
const UNITS = { photoNeeded: "실제 사진 필요", imagePending: "이미지 준비 중" }
const space = (alt: string) => ({ id: "space", aspect: "4:3", source: "real-required", alt })

export const fixture: ContentGalleryProps = {
  copy: { title: "공간", units: UNITS },
  images: [space("마루에 앉은 손님 자리"), space("찻잔이 놓인 창가"), space("마당 쪽 출입구")],
}

export const fixtureMax: ContentGalleryProps = {
  copy: { title: "상세 설명", lead: "조각 이미지마다 같은 글을 대체 텍스트로 붙였어요(예시).", units: UNITS },
  mode: "stack",
  caption: "실제 크기 비교는 손 사진으로 보여 드려요(예시).",
  images: [
    { src: "", alt: "첫 조각 — 왜 이 컵을 만들었나(예시)", width: 860, height: 1100, source: "real-required" },
    { alt: "둘째 조각 — 두 겹 유리(예시)", width: 860, height: 1000, source: "real-required" },
  ],
}

export const fixtureMin: ContentGalleryProps = {
  copy: { title: "사용 장면", units: UNITS },
  images: [{ id: "scene", aspect: "16:9", source: "stock-ok", alt: "책상 위에서 쓰는 모습" }],
}
