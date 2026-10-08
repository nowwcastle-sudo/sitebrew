import type { FixtureStates } from "@/registry/factory/contract/adapter-mock"

import { SUBMIT_NOTICES } from "../auth/sign-in.fixture"
import { COPY as LIST_COPY, DATA, DATA_MAX, DATA_MIN, EXPORT_COPY } from "./admin-list.fixture"
import type { BulkSubmit, BulkUndo, DataTableBulkSelectCopy, DataTableBulkSelectProps } from "./bulk-select"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 같은 가상 사용자 목록에 묶음 작업: 정지하기(바로, 되돌리기) · 보관하기(목록에서 빼고 되돌리기) · 지우기(되돌릴 수 없어 대등 확인).
// 갤러리 주소에 &submit=server-error 를 주면 묶음 작업이 실패한다(블록 밖 예시 함수가 주소를 읽는다 — 블록은 주소를 모른다).
const COPY: DataTableBulkSelectCopy = {
  ...LIST_COPY,
  title: "사용자 묶음 관리",
  lead: "여러 명을 골라 한 번에 정지·보관·지울 수 있어요. 고른 뒤에 작업 줄이 나타나요(예시).",
  select: { all: "이 쪽 {n}명 모두 고르기", row: "{name} 고르기", page: "이 쪽 {n}명을 골랐어요.", allMatching: "조건에 맞는 {total}명 모두 고르기", everything: "조건에 맞는 {total}명을 모두 골랐어요.", clear: "선택 지우기" },
  bar: { label: "고른 사용자에게 할 작업", selected: "{n}명을 골랐어요", hint: "사용자를 고르면 할 수 있는 작업이 여기에 나와요" },
  actions: [
    { id: "suspend", label: "정지하기" },
    { id: "archive", label: "보관하기", effect: "remove" },
    { id: "delete", label: "지우기", destructive: true, effect: "remove" },
  ],
  confirm: { question: "「{action}」 작업을 {n}명에게 적용할까요? 이 작업은 되돌릴 수 없어요", cancel: "취소", confirm: "{n}명 {action}", pending: "처리하는 중" },
  done: { template: "「{action}」 작업을 {n}명에게 적용했어요", undo: "되돌리기", undoPending: "되돌리는 중", undone: "되돌렸어요" },
  errorTitle: "묶음 작업을 마치지 못했어요 — 고른 사용자는 그대로예요",
  notices: SUBMIT_NOTICES,
}

const outcome = () => (typeof window === "undefined" ? "ok" : (new URLSearchParams(window.location.search).get("submit") ?? "ok"))
const bulk: BulkSubmit = async ({ action, selection }) => {
  if (outcome() === "server-error") return { ok: false, formError: "서버가 작업을 받지 못했어요. 잠시 뒤 다시 눌러 주세요(예시)." }
  const done = selection.mode === "ids" ? selection.ids.length : selection.expectedTotal
  return { ok: true, data: { done, ...(action === "delete" ? {} : { undoToken: `undo-${action}` }) } }
}
const undo: BulkUndo = async () => ({ ok: true, data: { restored: 1 } })

export const fixture: DataTableBulkSelectProps = { copy: COPY, state: { status: "ready", data: DATA }, bulk, undo, pageSize: 10 }
export const fixtureMax: DataTableBulkSelectProps = {
  ...fixture,
  copy: { ...COPY, export: EXPORT_COPY, title: "사용자 묶음 관리 — 조건으로 좁힌 사용자 전체에 정지·보관·지우기 작업을 한 번에 적용해요(예시)", lead: "한 쪽을 모두 고르면 조건에 맞는 전체를 고르는 제안이 나와요. 검색·거르기를 바꾸면 고른 것은 지워져요(예시)." },
  state: { status: "ready", data: DATA_MAX },
}
// 최소: 작업 하나(되돌리기 있음), 검색·거르기 없음, 세 줄
export const fixtureMin: DataTableBulkSelectProps = { ...fixture, copy: { ...COPY, lead: undefined, search: undefined, actions: [{ id: "archive", label: "보관하기", effect: "remove" }] }, state: { status: "ready", data: DATA_MIN } }
export const fixtureStates: FixtureStates<DataTableBulkSelectProps> = { reason: "아직 가입한 사용자가 없어요(예시).", message: "서버 응답이 늦어요. 잠시 뒤 다시 시도해 주세요(예시)." }
