import { mockAnalytics, type TrackedEvent } from "@/registry/factory/contract/adapter-mock"

import type { QnaContact, QnaContactCopy, QnaEntryCopy, QnaItem } from "../_shared/qna-kit"
import type { QnaAnsweredListProps } from "./answered-list"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 침구 가게 「솜결(예시)」 차렵이불 상품 문의 — 판매자가 미리 써 둔 자주 받는 문의. 다른 두 변형의 예시도 이 모듈의 ITEMS·COPY 조각을 쓴다.
export const ENTRY: QnaEntryCopy = { answerLabel: "판매자 답변", answeredOn: "{date} 답변" }
export const CONTACT_COPY: QnaContactCopy = { title: "원하는 답이 없나요?", kakao: "카카오톡 채널로 묻기", phone: "전화로 묻기", email: "메일로 묻기", note: "평일 오전 10시~오후 6시에 답해 드려요(예시)." }
export const CONTACT: QnaContact = { kakaoUrl: "https://pf.example.com/somgyeol", phone: "02-1234-5678", email: "help@example.com" }

export const ITEMS: QnaItem[] = [
  { id: "q1", category: "배송", question: "오늘 주문하면 언제 받을 수 있나요?", answer: "오후 2시 전에 주문하면 그날 출고하고 보통 다음 날 받아요. 제주·도서산간은 하루 더 걸려요(예시).", answeredAt: "2026-09-20T03:00:00.000Z" },
  { id: "q2", category: "배송", question: "송장 번호는 어디서 확인해요?", answer: "출고하면 문자로 송장 번호를 보내 드려요. 택배사 조회 화면에서 바로 볼 수 있어요(예시).", answeredAt: "2026-09-18T03:00:00.000Z" },
  { id: "q3", category: "사이즈", question: "퀸 사이즈에 성인 두 명이 덮어도 넉넉한가요?", answer: "퀸(210×230cm)은 성인 두 명이 함께 덮기에 넉넉해요. 키가 185cm를 넘으면 킹을 권해요(예시).", answeredAt: "2026-09-17T03:00:00.000Z" },
  { id: "q4", category: "사이즈", question: "베개 커버도 함께 오나요?", answer: "이불만 보내 드려요. 같은 원단 베개 커버는 따로 팔아요(예시).", answeredAt: "2026-09-15T03:00:00.000Z" },
  { id: "q5", category: "세탁", question: "세탁기에 돌려도 되나요?", answer: "30℃ 이하 물에 세탁망을 쓰면 울 코스로 돌릴 수 있어요. 표백제와 건조기는 피해 주세요(예시).", answeredAt: "2026-09-14T03:00:00.000Z" },
  { id: "q6", category: "세탁", question: "받자마자 원단 냄새가 나요.", answer: "포장 중에 생기는 원단 냄새예요. 하루 바람에 널어 두면 대부분 사라져요(예시).", answeredAt: "2026-09-12T03:00:00.000Z" },
  { id: "q7", category: "교환·반품", question: "색상을 바꾸고 싶어요.", answer: "받은 날부터 7일 안에, 쓰지 않은 상품이면 색상을 바꿔 드려요. 왕복 배송비는 구매자가 내요(예시).", answeredAt: "2026-09-10T03:00:00.000Z" },
  { id: "q8", category: "교환·반품", question: "반품하면 환불은 언제 되나요?", answer: "상품이 도착한 날부터 3영업일 안에 결제한 수단으로 돌려 드려요(예시).", answeredAt: "2026-09-08T03:00:00.000Z" },
]

export const COPY = {
  title: "상품 문의",
  lead: "판매자가 자주 받는 문의에 미리 답해 두었어요. 종류를 골라 보세요(예시).",
  categoryLegend: "문의 종류",
  all: "전체",
  result: "{count}개의 문의",
  empty: "아직 올라온 문의가 없어요",
  more: "{count}개 더 보기",
  entry: ENTRY,
  contact: CONTACT_COPY,
}

export const fixture: QnaAnsweredListProps = { copy: COPY, items: ITEMS, contact: CONTACT }

// 최대: 문의 열네 건(종류 다섯) · 긴 질문·답변 · 긴 제목.
const LONG: QnaItem[] = [
  ...ITEMS,
  { id: "q9", category: "소재", question: "충전재가 한쪽으로 쏠리지 않는지 궁금해요. 오래 쓰면 뭉치는 솜은 아닌가요?", answer: "충전재를 바둑판 모양으로 누벼서 고정해요. 한 해 넘게 쓰는 분들 중에서도 뭉친다는 문의는 드물었어요. 다만 세탁망 없이 돌리면 누빔이 늘어날 수 있으니 꼭 세탁망을 써 주세요(예시).", answeredAt: "2026-09-06T03:00:00.000Z" },
  { id: "q10", category: "소재", question: "알레르기가 있어도 괜찮을까요?", answer: "겉감은 면 100%, 충전재는 항균 가공한 폴리에스터예요. 특정 성분에 민감하시면 소재 정보에 있는 표를 보시고 의사와 상의해 주세요(예시).", answeredAt: "2026-09-05T03:00:00.000Z" },
  { id: "q11", category: "배송", question: "선물 포장이 되나요? 메시지 카드도 넣을 수 있는지 궁금해요.", answer: "선물 포장은 지원하지 않아요. 대신 주문할 때 받는 분 이름으로 보내면 가격표 없이 보내 드려요(예시).", answeredAt: "2026-09-03T03:00:00.000Z" },
  { id: "q12", category: "세탁", question: "드라이클리닝을 맡겨도 되나요?", answer: "드라이클리닝은 권하지 않아요. 충전재가 굳을 수 있어요(예시).", answeredAt: "2026-09-02T03:00:00.000Z" },
  { id: "q13", category: "교환·반품", question: "하자가 있으면 어떻게 하나요?", answer: "받은 날부터 3개월 안, 알게 된 날부터 30일 안에 문의해 주세요. 교환과 반품 배송비는 판매자가 내요(예시).", answeredAt: "2026-09-01T03:00:00.000Z" },
  { id: "q14", category: "사이즈", question: "슈퍼싱글 두 장을 붙여 덮어도 되나요?", answer: "두 장을 붙이면 사이에 틈이 생겨요. 함께 덮으실 거라면 퀸 이상을 권해요(예시).", answeredAt: "2026-08-30T03:00:00.000Z" },
]
export const fixtureMax: QnaAnsweredListProps = {
  copy: { ...COPY, title: "상품 문의 — 판매자가 자주 받는 문의에 미리 답해 두었어요. 종류를 골라 보세요(예시)", lead: "찾는 답이 없으면 아래 카카오톡 채널·전화·메일로 물어보세요. 사람이 직접 답해 드려요(예시)." },
  items: LONG,
  contact: CONTACT,
}

// 최소: 문의가 아직 없다 · 채널은 전화 하나.
export const fixtureMin: QnaAnsweredListProps = {
  copy: { ...COPY, lead: undefined, contact: { ...CONTACT_COPY, note: undefined } },
  items: [],
  contact: { phone: "02-1234-5678" },
}

// 갤러리 계측(&consent=…) — 채널 링크 클릭이 cta_click 으로 window.__wfTracked 에 쌓인다.
export const fixturePorts = (q: URLSearchParams, g: { fx: string; onTrack: (e: TrackedEvent) => void }): Partial<QnaAnsweredListProps> => {
  const a = mockAnalytics(q, { onTrack: g.onTrack })
  return { track: a.track }
}
