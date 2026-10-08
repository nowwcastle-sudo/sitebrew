import type { FixtureStates } from "@/registry/factory/contract/adapter-mock"

import { SUBMIT_NOTICES } from "../auth/sign-in.fixture"
import type { DataTableRecordPanelCopy, DataTableRecordPanelProps, RecordData } from "./record-panel"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 서비스 「모아플랜(예시)」 관리자가 사용자 한 명을 연 패널(대장 D140: 구독·정지·대리 로그인). 이메일은 example.com.
const COPY: DataTableRecordPanelCopy = {
  title: "사용자 정보",
  lead: "목록에서 연 사용자예요. 고친 내용은 저장해야 반영돼요(예시).",
  summaryTitle: "요약",
  actionsTitle: "이 사용자에게 하는 작업",
  editTitle: "정보 고치기",
  required: "(필수)",
  optional: "(선택)",
  form: {
    required: "이 칸은 꼭 적어 주세요.",
    submitLabel: "저장하기",
    pendingLabel: "저장하는 중",
    errorTitle: "저장하지 못했어요 — 적은 내용은 그대로예요",
    fieldErrorTitle: "확인이 필요한 칸이 있어요",
    notices: SUBMIT_NOTICES,
    done: { title: "저장했어요", body: "고친 내용을 저장했어요(예시)." },
  },
  saved: "저장했어요(예시).",
  actionDone: "작업을 마쳤어요(예시).",
  danger: {
    title: "위험한 작업",
    body: "사용자를 지우면 로그인 정보와 사용 기록이 모두 사라지고, 결제 기록처럼 법에서 보관하라고 한 것만 따로 남아요(예시).",
    trigger: "이 사용자 지우기",
    question: "정말 이 사용자를 지울까요? 되돌릴 수 없어요",
    cancel: "취소",
    confirm: "이 사용자 지우기",
    pending: "지우는 중",
    errorTitle: "작업을 마치지 못했어요",
    done: { title: "사용자를 지웠어요", body: "목록에서도 사라졌어요(예시).", link: { label: "사용자 목록으로 돌아가기", href: "#users" } },
  },
  empty: { title: "이 사용자를 찾을 수 없어요", body: "이미 지워졌거나 주소가 바뀌었을 수 있어요(예시).", action: { label: "사용자 목록 보기", href: "#users" } },
  loading: "사용자 정보를 불러오는 중이에요",
  error: { title: "사용자 정보를 불러오지 못했어요", retryLabel: "다시 시도" },
}

const DATA: RecordData = {
  title: "kim.example3@example.com",
  summary: [
    { label: "이메일", value: "kim.example3@example.com" },
    { label: "가입일", value: "2026년 8월 12일" },
    { label: "계정 상태", value: "활성", kind: "status" },
    { label: "구독", value: "프로(예시)", kind: "status" },
    { label: "2단계 인증", value: "켜짐", kind: "status" },
    { label: "최근 30일 접속", value: "18회", kind: "numeric" },
  ],
  fields: [
    { name: "name", label: "이름", value: "김예시", required: true },
    { name: "email", label: "이메일", type: "email", value: "kim.example3@example.com", required: true },
    { name: "phone", label: "전화번호", type: "tel", value: "010-0000-0000" },
    { name: "memo", label: "운영 메모", type: "textarea", value: "결제 수단을 바꿔 달라고 문의한 적이 있어요(예시)." },
  ],
}

export const fixture: DataTableRecordPanelProps = {
  copy: COPY,
  state: { status: "ready", data: DATA },
  submit: async () => ({ ok: true, data: { message: "저장했어요(예시)." } }),
  actions: [
    { id: "suspend", label: "정지하기" },
    { id: "impersonate", label: "대리 로그인" },
  ],
  act: async () => ({ ok: true, data: { message: "작업을 마쳤어요(예시)." } }),
  remove: async () => ({ ok: true, data: {} }),
}
export const fixtureMax: DataTableRecordPanelProps = {
  ...fixture,
  copy: {
    ...COPY,
    title: "사용자 정보 — 요약과 작업, 정보 고치기, 지우기를 한 자리에서 하는 관리자 패널(예시)",
    lead: "목록에서 연 사용자예요. 고친 내용은 저장해야 반영돼요. 저장하지 않고 창을 닫으면 브라우저가 한 번 물어봐요(예시).",
    danger: { ...COPY.danger, body: "사용자를 지우면 로그인 정보와 사용 기록, 동의 기록이 모두 사라지고, 결제 기록처럼 법에서 보관하라고 한 것만 이름 없이 따로 남아요. 지우기 전에 위의 내용을 다시 한번 확인해 주세요(예시)." },
  },
  state: {
    status: "ready",
    data: { ...DATA, fields: DATA.fields.map((f) => (f.name === "memo" ? { ...f, value: "결제 수단을 바꿔 달라고 문의한 적이 있어요. 카드 유효기간이 지나 결제가 한 번 실패했고 다시 시도해 성공했어요. 다음 달부터 연간 요금제로 바꾸고 싶다고 했어요(예시)." } : f)) },
  },
}
// 최소: 요약 둘·칸 둘, 작업 버튼 없음
export const fixtureMin: DataTableRecordPanelProps = {
  ...fixture,
  copy: { ...COPY, lead: undefined },
  actions: undefined,
  act: undefined,
  state: { status: "ready", data: { title: DATA.title, summary: DATA.summary.slice(0, 2), fields: DATA.fields.slice(0, 2) } },
}
export const fixtureStates: FixtureStates<DataTableRecordPanelProps> = {
  reason: "이 사용자를 찾을 수 없어요(예시).",
  message: "서버 응답이 늦어요. 잠시 뒤 다시 시도해 주세요(예시).",
  receipt: { message: "저장했어요(예시)." },
  fieldErrors: { email: ["이메일 형식을 확인해 주세요. 예: name@example.com"] },
}
