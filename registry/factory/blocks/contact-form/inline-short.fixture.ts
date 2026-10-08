import type { FixtureStates } from "@/registry/factory/contract/adapter-mock"

import type { ContactFormInlineShortProps } from "./inline-short"
import { SUBMIT_NOTICES } from "../auth/sign-in.fixture"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 인테리어 공방의 문의, 문구마다 「예시」.
// 갤러리는 submit 을 목 포트로 바꿔 끼운다(&submit=ok|field-error|server-error|pending) — 아래 submit 은 예시 자리다.
export const FORM = {
  required: "이 칸을 채워 주세요.",
  submitLabel: "문의 보내기",
  pendingLabel: "보내는 중",
  errorTitle: "보내지 못했어요 — 적은 내용은 그대로 있어요",
  fieldErrorTitle: "확인이 필요한 칸이 있어요",
  notices: SUBMIT_NOTICES,
  done: { title: "문의를 받았어요", body: "평일 하루 안에 연락드릴게요(예시).", idLabel: "접수 번호", again: "새 문의 쓰기" },
}
const COPY = {
  title: "짧게 물어보세요",
  lead: "공간 크기와 원하는 날짜만 적어 주셔도 돼요(예시).",
  notes: ["평일 오전 10시~오후 6시, 하루 안에 답해요(예시)", "견적 상담은 무료예요(예시)"],
  labels: { name: "이름", phone: "연락처", message: "문의 내용" },
  placeholders: { message: "예: 거실 12평, 11월 첫 주 공사 가능할까요?" },
  consent: { label: "개인정보 수집·이용에 동의해요(필수)", detail: "이름·연락처는 답변에만 쓰고 3개월 뒤 지워요(예시)." },
  form: FORM,
}

export const fixture: ContactFormInlineShortProps = {
  copy: COPY,
  submit: async () => ({ ok: true, data: { id: "Q-0001", message: "문의를 받았어요(예시)." } }),
}

// 최대: 문구 끝까지.
export const fixtureMax: ContactFormInlineShortProps = {
  ...fixture,
  copy: {
    ...COPY,
    title: "짧게 물어보세요 — 공간 크기와 원하는 날짜만 알려 주셔도 견적을 드려요(예시)",
    lead: "사진이 있으면 답장 메일에 붙여 주세요. 현장 방문 상담은 서울·경기 지역만 가능하고, 다른 지역은 영상 통화로 먼저 상담해요(예시).",
    notes: ["평일 오전 10시~오후 6시, 하루 안에 답해요. 주말·공휴일에 받은 문의는 다음 평일에 답해요(예시)", "견적 상담은 무료이고, 현장 실측은 한 번에 3만 원이며 계약하면 공사비에서 빼요(예시)", "급한 누수·파손 수리는 전화로 먼저 알려 주세요(예시)"],
    consent: { label: "개인정보 수집·이용에 동의해요(필수) — 이름·연락처·문의 내용", detail: "수집한 정보는 문의 답변과 견적 안내에만 쓰고, 상담이 끝나고 3개월 뒤 지워요. 동의하지 않으면 문의를 보낼 수 없어요(예시)." },
  },
}

// 최소: 머리말·안내·동의 설명 없이.
export const fixtureMin: ContactFormInlineShortProps = {
  ...fixture,
  copy: { ...COPY, lead: undefined, notes: undefined, placeholders: undefined, consent: { label: COPY.consent.label } },
}

// 갤러리 상태 주입 재료(&submit=) — 필드 오류는 둘째·셋째 칸(연락처·내용): 첫 칸이 아니라 「첫 오류 칸」으로 포커스가 가는지 본다.
export const fixtureStates: FixtureStates<ContactFormInlineShortProps> = {
  receipt: { id: "Q-20260929-014", message: "평일 하루 안에 연락드릴게요(예시)." },
  fieldErrors: { phone: ["연락처 형식을 확인해 주세요(예: 010-1234-5678)."], message: ["문의 내용을 10자 이상 적어 주세요."] },
  formError: "확인이 필요한 칸이 있어요.",
}
