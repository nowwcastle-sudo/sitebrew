import type { FixtureStates } from "@/registry/factory/contract/adapter-mock"

import { SUBMIT_NOTICES } from "../auth/sign-in.fixture"
import { CONTACT, CONTACT_COPY, ENTRY, ITEMS } from "./answered-list.fixture"
import type { QnaAskFormProps } from "./ask-form"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 왼쪽 자주 받는 문의 3건, 오른쪽 「궁금한 점 남기기」 폼.
// 갤러리는 submit 을 목 포트로 바꿔 끼운다(&submit=ok|field-error|server-error|pending) — 아래 submit 은 예시 자리다.
const FORM = {
  required: "이 칸을 채워 주세요.",
  submitLabel: "문의 보내기",
  pendingLabel: "보내는 중",
  errorTitle: "보내지 못했어요 — 적은 내용은 그대로 있어요",
  fieldErrorTitle: "확인이 필요한 칸이 있어요",
  notices: SUBMIT_NOTICES,
  done: { title: "문의를 받았어요", body: "남겨 주신 연락처로 답해 드릴게요(예시).", idLabel: "접수 번호", again: "다른 문의 쓰기" },
}
const COPY = {
  title: "궁금한 점을 남겨 주세요",
  lead: "자주 받는 문의를 먼저 보시고, 없으면 남겨 주세요. 판매자가 직접 답해요(예시).",
  listTitle: "자주 받는 문의",
  formTitle: "궁금한 점 남기기",
  privacyNote: "답은 남겨 주신 연락처로만 보내 드려요. 다른 분께 공개되는 글이 아니에요(예시).",
  labels: { contact: "답변 받을 연락처 — 메일 또는 전화(필수)", question: "궁금한 점(필수)" },
  placeholders: { contact: "예: name@example.com 또는 010-1234-5678", question: "예: 퀸 사이즈가 침대 매트리스 160cm에 맞나요?" },
  consent: { label: "개인정보 수집·이용에 동의해요(필수)", detail: "연락처와 질문은 답변에만 쓰고 3개월 뒤 지워요(예시)." },
  entry: ENTRY,
  contact: CONTACT_COPY,
  form: FORM,
}

export const fixture: QnaAskFormProps = {
  copy: COPY,
  items: ITEMS,
  contact: CONTACT,
  submit: async () => ({ ok: true, data: { id: "Q-0001", message: "남겨 주신 연락처로 답해 드릴게요(예시)." } }),
}

// 최대: 긴 제목·안내·동의 설명 · 긴 문의.
export const fixtureMax: QnaAskFormProps = {
  ...fixture,
  copy: {
    ...COPY,
    title: "궁금한 점을 남겨 주세요 — 자주 받는 문의에 없는 질문은 판매자가 직접 답해 드려요(예시)",
    lead: "받은 문의는 평일 오전 10시~오후 6시에 확인하고 보통 하루 안에 답해요. 주말·공휴일에 남기면 다음 평일에 답해요(예시).",
    privacyNote: "답은 남겨 주신 연락처로만 보내 드려요. 다른 분께 공개되는 글이 아니고, 구매자끼리 보는 문의 게시판은 아직 없어요(예시).",
    consent: { label: "개인정보 수집·이용에 동의해요(필수) — 연락처·문의 내용", detail: "수집한 정보는 문의 답변에만 써요. 답변이 끝나고 3개월 뒤 지워요. 동의하지 않으면 문의를 보낼 수 없지만 위 전화·메일로 물어보실 수 있어요(예시)." },
  },
  items: ITEMS.map((it, i) => (i === 0 ? { ...it, question: `${it.question} 이번 주말 전에 꼭 받아야 하는데 가능한지 알고 싶어요.` } : it)),
}

// 최소: 자주 받는 문의 없이 폼만 · 채널·안내·동의 설명 없음.
export const fixtureMin: QnaAskFormProps = {
  ...fixture,
  copy: { ...COPY, lead: undefined, placeholders: undefined, consent: { label: COPY.consent.label } },
  items: [],
  contact: undefined,
}

// 갤러리 상태 주입 재료(&submit=) — 필드 오류는 연락처·질문 둘 다: 첫 오류 칸(연락처)으로 포커스가 가는지, 입력이 그대로인지 본다.
export const fixtureStates: FixtureStates<QnaAskFormProps> = {
  receipt: { id: "Q-20260930-007", message: "남겨 주신 연락처로 답해 드릴게요(예시)." },
  fieldErrors: { contact: ["연락처 형식을 확인해 주세요(예: name@example.com 또는 010-1234-5678)."], question: ["궁금한 점을 10자 이상 적어 주세요."] },
  formError: "확인이 필요한 칸이 있어요.",
}
