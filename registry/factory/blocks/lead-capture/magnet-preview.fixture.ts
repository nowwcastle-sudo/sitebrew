import { APPROVAL_HINT } from "@/registry/factory/contract/human-actions"
import { mockAnalytics, stateFromQuery, type TrackedEvent } from "@/registry/factory/contract/adapter-mock"

import type { LeadCaptureMagnetPreviewCopy, LeadCaptureMagnetPreviewProps } from "./magnet-preview"
import { SUBMIT_NOTICES } from "../auth/sign-in.fixture"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 예약 관리 서비스 「예약노트(예시)」의 무료 자료 — 표지 그림은 비워 둔다(비율을 지킨 빈 자리).
const COPY: LeadCaptureMagnetPreviewCopy = {
  humanHint: APPROVAL_HINT.ko,
  title: "노쇼를 줄이는 예약 운영 체크리스트",
  lead: "작은 가게 사장님 40분께 여쭤 만든 12쪽짜리 점검표예요. 이메일만 적으면 바로 보내 드려요(예시).",
  preview: {
    cover: { id: "magnet-cover", aspect: "3:4", source: "generated-ok", alt: "체크리스트 표지 — 달력과 체크 표시 그림(예시)" },
    name: "예약 운영 체크리스트(예시)",
    meta: "PDF · 12쪽 · 3MB",
    contentsTitle: "담긴 것",
    contents: ["방문 전날 안내 문자 문구 5가지", "예약금 받는 기준 정하기", "노쇼 손님 다시 받을 때 확인할 것", "주말 예약표 짜는 법"],
  },
  email: { label: "이메일", marker: "(필수)", placeholder: "name@example.com", required: "자료를 보낼 이메일을 적어 주세요.", invalid: "이메일 형식이 맞지 않아요. @와 도메인을 확인해 주세요." },
  name: { label: "부를 이름", marker: "(선택)" },
  consent: "(선택) 새 자료가 나오면 메일로 받을게요",
  privacy: "이메일은 자료를 보내는 데만 쓰고, 선택 동의를 하지 않으면 다른 메일은 보내지 않아요.",
  submit: "체크리스트 메일로 받기",
  pending: "보내는 중",
  arrival: "메일은 1분 안에 도착해요.",
  fieldErrorTitle: "입력한 내용을 확인해 주세요",
  serverErrorTitle: "메일을 보내지 못했어요",
  notices: SUBMIT_NOTICES,
  done: { title: "메일을 보냈어요", body: "{email}로 1분 안에 도착해요. 스팸함도 확인해 주세요." },
}

export const fixture: LeadCaptureMagnetPreviewProps = { copy: COPY, submit: async () => ({ ok: true, data: {} }) }

export const fixtureMax: LeadCaptureMagnetPreviewProps = {
  ...fixture,
  copy: {
    ...COPY,
    title: "노쇼를 줄이는 예약 운영 체크리스트 — 작은 가게 사장님 40분의 방법을 모았어요",
    lead: "작은 가게 사장님 40분께 여쭤 만든 12쪽짜리 점검표예요. 방문 전날 문자, 예약금, 노쇼 손님 다시 받기까지 바로 따라 할 수 있는 순서로 정리했어요. 이메일만 적으면 바로 보내 드려요(예시).",
    preview: { ...COPY.preview, contents: [...COPY.preview.contents, "단체 예약(8명 이상) 받을 때 미리 물어볼 것", "예약 취소 규정 문구 예시와 손님에게 알리는 방법", "직원과 예약표를 나눠 볼 때 권한 나누기"] },
  },
}

export const fixtureMin: LeadCaptureMagnetPreviewProps = {
  ...fixture,
  copy: { ...COPY, name: undefined, preview: { ...COPY.preview, contents: [COPY.preview.contents[0]] } },
}

export const fixturePorts = (q: URLSearchParams, g: { fx: string; onTrack: (e: TrackedEvent) => void }): Partial<LeadCaptureMagnetPreviewProps> => {
  const { submit } = stateFromQuery<never, unknown>(q, {
    receipt: {},
    fieldErrors: { email: ["이 이메일로는 보낼 수 없어요. 다른 주소를 적어 주세요."] },
    formError: q.get("submit") === "server-error" ? "메일 서버가 잠시 응답하지 않아요. 잠시 뒤 다시 눌러 주세요(예시)." : "입력한 내용을 다시 확인해 주세요.",
  })
  const a = mockAnalytics(q, { onTrack: g.onTrack })
  return { submit: () => submit(), track: a.track }
}
