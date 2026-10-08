import type { HeroMapFirstProps } from "./map-first"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 제과점의 지점들. 지도 그림(media)은 예시에 싣지 않는다 — 없으면 도식 격자가 깔린다.
// 지점 이름·주소·전화는 모두 가짜 값이다(전화는 0000, 주소는 가상 길 이름) — 찍어낸 사이트는 콘텐츠의 주소·전화·지도 링크로 대신한다.
const labels = {
  label: "첫 화면",
  mapLabel: "지점 위치 지도",
  listLabel: "지점 표지 목록",
  addressLabel: "주소",
  hoursLabel: "오늘 영업",
  phoneLabel: "전화",
  mapLinkLabel: "지도 앱으로 길찾기",
}

export const fixture: HeroMapFirstProps = {
  copy: {
    ...labels,
    title: "가까운 가게를 지도에서 먼저 골라요",
    lede: "표지를 누르면 그 가게의 주소와 오늘 영업 시간이 열려요. 모든 문구는 예시예요.",
    primaryCta: { label: "가까운 가게 찾기", href: "#find" },
    secondaryCta: { label: "전체 가게 목록", href: "#list" },
    branches: [
      { id: "a", name: "예시빵집 본점(예시)", address: "가상시 달빛로 12, 1층(예시)", x: 32, y: 44, phone: "02-0000-0001", hours: "10:00 ~ 20:00", href: "https://example.com/map/a" },
      { id: "b", name: "예시빵집 강변점(예시)", address: "가상시 강변길 8(예시)", x: 62, y: 28, phone: "02-0000-0002", hours: "11:00 ~ 21:00", href: "https://example.com/map/b" },
      { id: "c", name: "예시빵집 언덕점(예시)", address: "가상시 언덕로 40(예시)", x: 78, y: 66, hours: "10:00 ~ 19:00" },
    ],
  },
}

// 최대: 긴 제목, 긴 문단, 지점 넷(전화·링크 칸을 모두 채운다).
export const fixtureMax: HeroMapFirstProps = {
  copy: {
    ...labels,
    title: "가까운 가게를 지도에서 먼저 골라 오늘 영업 시간까지 확인해요",
    lede: "표지를 누르면 그 가게의 주소와 오늘 영업 시간, 전화번호가 오른쪽 카드에 열려요. 길찾기는 쓰던 지도 앱으로 바로 이어져요. 모든 문구는 예시예요.",
    primaryCta: { label: "가까운 가게 찾기", href: "#find" },
    secondaryCta: { label: "전체 가게 목록 보기", href: "#list" },
    branches: [
      { id: "a", name: "예시빵집 본점(예시)", address: "가상시 달빛로 12, 1층(예시)", x: 24, y: 40, phone: "02-0000-0001", hours: "10:00 ~ 20:00", href: "https://example.com/map/a" },
      { id: "b", name: "예시빵집 강변점(예시)", address: "가상시 강변길 8(예시)", x: 52, y: 24, phone: "02-0000-0002", hours: "11:00 ~ 21:00", href: "https://example.com/map/b" },
      { id: "c", name: "예시빵집 언덕점(예시)", address: "가상시 언덕로 40(예시)", x: 74, y: 58, phone: "02-0000-0003", hours: "10:00 ~ 19:00", href: "https://example.com/map/c" },
      { id: "d", name: "예시빵집 역앞점(예시)", address: "가상시 역앞길 3(예시)", x: 40, y: 72, phone: "02-0000-0004", hours: "07:00 ~ 22:00", href: "https://example.com/map/d" },
    ],
  },
}

// 최소: 지점 하나, 문단·보조 버튼 없음.
export const fixtureMin: HeroMapFirstProps = {
  copy: {
    ...labels,
    title: "가게 위치",
    primaryCta: { label: "길찾기", href: "#find" },
    branches: [{ id: "a", name: "예시빵집(예시)", address: "가상시 달빛로 12(예시)", x: 50, y: 50 }],
  },
}
