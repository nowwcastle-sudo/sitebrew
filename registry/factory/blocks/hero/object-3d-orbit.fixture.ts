import type { HeroObject3dOrbitProps } from "./object-3d-orbit"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 도자 공방. 무대의 모델(model)·원본 이미지(media)는 예시에 싣지 않는다 — 없으면 muted 무대로 그려지고(공장은 키 없이 돈다),
// 찍어낸 사이트는 05-media 가 칸을 채운다(생성 이미지 → 이미지-3D 변환 GLB). 갤러리 검수대만 app/qa/blocks/media.ts 에서 예시 생성 자산(코발트 유약 그릇)을 넣는다.
export const fixture: HeroObject3dOrbitProps = {
  copy: {
    label: "첫 화면",
    title: "손안에서 돌려 보는 도자 한 점",
    lede: "한 점씩 빚어 구운 도자 그릇을 3D 로 먼저 만져 보세요. 천천히 도는 모습을 보다가 마음에 들면 공방에 주문을 남겨요. 모든 문구는 예시예요.",
    primaryCta: { label: "주문 문의하기", href: "#order" },
    secondaryCta: { label: "공방 이야기", href: "#story" },
    stageLabel: "3D 로 돌려 볼 수 있는 도자 그릇 무대",
    pauseLabel: "그릇 돌리기 멈추기",
  },
}

// 최대: 긴 제목, 긴 문단.
export const fixtureMax: HeroObject3dOrbitProps = {
  copy: {
    label: "첫 화면",
    title: "손안에서 돌려 보고 마음에 들면 바로 주문하는 도자 그릇 한 점",
    lede: "한 점씩 빚어 구운 도자 그릇을 3D 로 먼저 만져 보세요. 천천히 도는 모습을 보며 유약의 빛과 굽의 흙빛을 살펴보고, 마음에 들면 공방에 주문을 남기면 작업 일정과 함께 답을 드려요. 모든 문구는 예시예요.",
    primaryCta: { label: "주문 문의 남기기", href: "#order" },
    secondaryCta: { label: "공방 이야기 보기", href: "#story" },
    stageLabel: "3D 로 돌려 볼 수 있는 도자 그릇 무대",
    pauseLabel: "그릇 돌리기 멈추기",
  },
}

// 최소: 짧은 제목, 보조 버튼 없음, 정지 단추 이름 없음.
export const fixtureMin: HeroObject3dOrbitProps = {
  copy: {
    label: "첫 화면",
    title: "도자 한 점",
    lede: "돌려 보세요(예시).",
    primaryCta: { label: "문의", href: "#order" },
    stageLabel: "3D 로 돌려 볼 수 있는 무대",
  },
}
