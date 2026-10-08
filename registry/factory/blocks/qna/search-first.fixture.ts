import { mockAnalytics, type TrackedEvent } from "@/registry/factory/contract/adapter-mock"

import { CONTACT, CONTACT_COPY, ENTRY, ITEMS } from "./answered-list.fixture"
import type { QnaSearchFirstProps } from "./search-first"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 위 검색 칸 → 결과 개수 → 문의 목록, 결과가 없으면 「찾는 답이 없나요?」 판.
const COPY = {
  title: "궁금한 점을 찾아 보세요",
  lead: "상품 문의를 검색할 수 있어요. 검색어는 어디에도 보내지 않아요(예시).",
  searchLabel: "궁금한 점을 검색해 보세요",
  searchPlaceholder: "예: 세탁, 사이즈, 환불",
  clear: "검색어 지우기",
  result: "{count}개의 문의를 찾았어요",
  more: "{count}개 더 보기",
  notFoundTitle: "찾는 답이 없나요?",
  notFoundBody: "아래 채널로 물어보시면 판매자가 직접 답해 드려요(예시).",
  entry: ENTRY,
  contact: CONTACT_COPY,
}

export const fixture: QnaSearchFirstProps = { copy: COPY, items: ITEMS, contact: CONTACT }

// 최대: 긴 제목·안내 · 긴 답변 하나.
export const fixtureMax: QnaSearchFirstProps = {
  copy: {
    ...COPY,
    title: "궁금한 점을 찾아 보세요 — 세탁·사이즈·배송·교환 문의를 한 번에 검색할 수 있어요(예시)",
    lead: "질문과 답변 모두에서 찾아요. 찾는 답이 없으면 결과 자리에 문의 채널이 크게 나와요. 검색어는 어디에도 보내지 않아요(예시).",
    notFoundBody: "아래 채널로 물어보시면 판매자가 직접 답해 드려요. 평일 오전 10시~오후 6시에 남긴 문의는 보통 그날 안에 답해요(예시).",
  },
  items: ITEMS.map((it, i) => (i === 2 ? { ...it, answer: `${it.answer} 슈퍼싱글 두 장을 붙여 덮는 것보다는 퀸 한 장이 낫고, 침대 폭이 160cm보다 넓으면 킹을 골라 주세요. 덮는 사람이 둘이고 잠버릇이 큰 편이라면 킹을 더 권해요(예시).` } : it)),
  contact: CONTACT,
}

// 최소: 문의가 아직 없다 → 처음부터 「찾는 답이 없나요?」 · 채널은 전화 하나.
export const fixtureMin: QnaSearchFirstProps = {
  copy: { ...COPY, lead: undefined, searchPlaceholder: undefined, contact: { ...CONTACT_COPY, note: undefined } },
  items: [],
  contact: { phone: "02-1234-5678" },
}

// 갤러리 계측(&consent=…) — 채널 링크 클릭이 cta_click 으로 window.__wfTracked 에 쌓인다.
export const fixturePorts = (q: URLSearchParams, g: { fx: string; onTrack: (e: TrackedEvent) => void }): Partial<QnaSearchFirstProps> => {
  const a = mockAnalytics(q, { onTrack: g.onTrack })
  return { track: a.track }
}
