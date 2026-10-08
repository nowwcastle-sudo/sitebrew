// 부품 접근 이름 문구 표(P3-5, 대장 D235) — 부품이 스스로 그리는 접근 이름(aria-label·sr-only 글)과 기본 안내 글을 로캘별로 한곳에 둔다.
// 부품은 `locale` prop("ko" | "en", 기본 ko)을 받아 `uiLabels(locale)` 에서 읽는다 — 한국어 값은 예전 부품 코드의 글자 그대로라 기본 출력은 바이트 단위로 같다.
// 부품이 이미 가진 문구 prop(navLabel·aria-label·text·title …)을 주면 그 값이 표보다 앞선다. 순수 함수·상수뿐이라 서버·클라이언트 부품 어디서나 쓴다("use client" 를 달지 않는다).
// 새 부품이 접근 이름을 하나라도 직접 그리면 여기에 두 로캘 값을 함께 더한다 — `locale-labels.test.mjs` 가 두 표의 키가 같은지·영어 값에 한글이 없는지 본다.

export type UiLocale = "ko" | "en"

const KO = {
  close: "닫기",
  breadcrumb: "이동 경로",
  breadcrumbMore: "더 보기",
  carouselPrev: "이전 슬라이드",
  carouselNext: "다음 슬라이드",
  comboboxOpen: "목록 열기",
  comboboxClear: "입력 지우기",
  comboboxChipRemove: "선택 해제",
  commandTitle: "명령 팔레트",
  commandDescription: "실행할 명령을 검색하세요…",
  scrollToEnd: "마지막으로 이동",
  scrollToStart: "처음으로 이동",
  scrollHint: "옆으로 밀어 보세요",
  paginationNav: "쪽 이동",
  paginationPrev: "이전",
  paginationNext: "다음",
  paginationPrevAria: "이전 쪽으로",
  paginationNextAria: "다음 쪽으로",
  paginationMore: "쪽 더 있음",
  stepPrev: "이전",
  stepNext: "다음",
  stepSkip: "Skip", // 예전 부품 코드의 글자 그대로(한국어 출력 불변) — 영어 값도 같다
  resize: "크기 조절",
  sidebar: "사이드바",
  sidebarDescription: "모바일 사이드바를 표시한다.",
  sidebarToggle: "사이드바 열고 닫기",
  sliderValue: "값",
  loading: "불러오는 중",
  toastRegion: "알림",
  toastClose: "알림 닫기",
  siteNav: "주 메뉴",
  siteMenu: "메뉴",
  siteBanner: "공식 배너",
  siteSkip: "본문 바로가기",
  bizName: "상호",
  bizRepresentative: "대표자",
  bizRegNo: "사업자등록번호",
  bizMailOrderNo: "통신판매업신고번호",
  bizLookup: "사업자정보 확인",
  bizAddress: "주소",
  bizContact: "연락처",
  terms: "이용약관",
  privacy: "개인정보 처리방침",
} as const

export type UiLabels = { [K in keyof typeof KO]: string }

const EN: UiLabels = {
  close: "Close",
  breadcrumb: "Breadcrumb",
  breadcrumbMore: "More",
  carouselPrev: "Previous slide",
  carouselNext: "Next slide",
  comboboxOpen: "Open list",
  comboboxClear: "Clear input",
  comboboxChipRemove: "Remove selection",
  commandTitle: "Command palette",
  commandDescription: "Search for a command to run…",
  scrollToEnd: "Go to the end",
  scrollToStart: "Go to the start",
  scrollHint: "Swipe to see more",
  paginationNav: "Pagination",
  paginationPrev: "Previous",
  paginationNext: "Next",
  paginationPrevAria: "Go to previous page",
  paginationNextAria: "Go to next page",
  paginationMore: "More pages",
  stepPrev: "Back",
  stepNext: "Next",
  stepSkip: "Skip",
  resize: "Resize",
  sidebar: "Sidebar",
  sidebarDescription: "Shows the mobile sidebar.",
  sidebarToggle: "Toggle sidebar",
  sliderValue: "Value",
  loading: "Loading",
  toastRegion: "Notifications",
  toastClose: "Dismiss notification",
  siteNav: "Main menu",
  siteMenu: "Menu",
  siteBanner: "Official banner",
  siteSkip: "Skip to main content",
  bizName: "Business name",
  bizRepresentative: "Representative",
  bizRegNo: "Business registration no.",
  bizMailOrderNo: "Mail-order business no.",
  bizLookup: "Verify business information",
  bizAddress: "Address",
  bizContact: "Contact",
  terms: "Terms of Service",
  privacy: "Privacy Policy",
}

export const UI_LABELS: Record<UiLocale, UiLabels> = { ko: KO, en: EN }

/** locale 의 문구 표(없거나 모르는 값이면 한국어 — 예전 출력 그대로) */
export function uiLabels(locale?: UiLocale): UiLabels {
  return UI_LABELS[locale ?? "ko"] ?? KO
}
