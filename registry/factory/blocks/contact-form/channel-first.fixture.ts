import type { FixtureStates } from "@/registry/factory/contract/adapter-mock"
import { kakaoChannelSubmit, mailtoSubmit, telLink } from "@/registry/factory/contract/adapter-static"

import type { ContactFormChannelFirstProps } from "./channel-first"
import type { ContactFormInput } from "../_shared/form-flow"
import { FORM } from "./inline-short.fixture"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 꽃집, 문구마다 「예시」.
// 채널 연결은 소비자 몫이다 — 블록은 어댑터를 부르지 않고 props 로 받는다. 아래가 그 연결 예시(adapter-static, 서버 없는 배포):
//   call   = telLink(번호)                         → tel: 링크 결과
//   kakao  = kakaoChannelSubmit(채널 URL, 글 만들기) → 채팅방을 열고 글은 클립보드로(채널 채팅은 미리 채운 글을 받지 않는다)
//   submit = mailtoSubmit(받는 주소, 제목 만들기)     → 제목·본문을 채운 새 메일
// 포트는 함수라 서버 컴포넌트에서 넘길 수 없다 — 소비자는 이 연결을 'use client' 감싸개 안에서 만든다.
const PHONE = "02-555-0123"
const text = (i: ContactFormInput) => [i.name && `이름: ${i.name}`, i.contact && `연락처: ${i.contact}`, i.message].filter(Boolean).join("\n")
const WIRING = {
  call: telLink(PHONE),
  kakao: kakaoChannelSubmit<ContactFormInput>("https://pf.kakao.com/_WfExample", text),
  submit: mailtoSubmit<ContactFormInput>("hello@example.com", (i) => `꽃 주문 문의 — ${i.name || "이름 없음"}(예시)`, { body: text }),
}
const COPY = {
  title: "편한 방법으로 물어보세요",
  lead: "가장 빠른 건 카카오톡 채널이에요. 영업시간에는 전화도 받아요(예시).",
  channelsLabel: "상담 채널",
  kakao: { label: "카카오톡 채널로 상담", note: "아래에 적은 내용을 복사해 채팅방을 열어 드려요(예시)." },
  call: { label: "전화 걸기", note: "평일 오전 10시~오후 7시(예시)", number: PHONE },
  channelLinkLabel: "창이 열리지 않으면 여기를 눌러 주세요",
  formTitle: "또는 메일로 남기기",
  formLead: "메일 앱이 열리면 내용을 확인하고 보내기를 눌러 주세요(예시).",
  labels: { name: "이름(선택)", contact: "답장 받을 메일 주소", message: "문의 내용" },
  form: { ...FORM, submitLabel: "메일 앱 열기", pendingLabel: "여는 중", done: { title: "메일 앱을 열었어요", body: "메일 앱에서 보내기를 눌러 주세요(예시).", linkLabel: "메일 앱 다시 열기", again: "다시 쓰기" } },
}

export const fixture: ContactFormChannelFirstProps = { copy: COPY, ...WIRING }

// 최대: 문구 끝까지.
export const fixtureMax: ContactFormChannelFirstProps = {
  ...fixture,
  copy: {
    ...COPY,
    title: "편한 방법으로 물어보세요 — 카카오톡 채널·전화·메일 어느 쪽이든 답해요(예시)",
    lead: "가장 빠른 건 카카오톡 채널이에요. 영업시간에는 전화도 받고, 늦은 시간에 남긴 메일은 다음 날 오전에 답해요. 당일 배송 주문은 오후 2시까지 받아요(예시).",
    kakao: { label: "카카오톡 채널로 상담하기", note: "아래 칸에 적은 이름·연락처·문의 내용을 복사한 뒤 채팅방을 새 창으로 열어 드려요. 채팅방에 붙여넣어 보내 주세요(예시)." },
    call: { ...COPY.call, note: "평일 오전 10시~오후 7시, 토요일 오전 10시~오후 3시. 점심시간(12시~1시)에는 받지 못할 수 있어요(예시)." },
  },
}

// 최소: 전화 채널만(카카오 없음), 머리말 없이.
export const fixtureMin: ContactFormChannelFirstProps = {
  copy: { ...COPY, lead: undefined, formLead: undefined, kakao: undefined },
  call: WIRING.call,
  submit: WIRING.submit,
}

// 갤러리 상태 주입 재료(&submit=) — 필드 오류는 둘째 칸(메일 주소).
export const fixtureStates: FixtureStates<ContactFormChannelFirstProps> = {
  receipt: { nextStep: "메일 앱에서 내용을 확인한 뒤 보내기를 눌러 주세요(예시).", href: "mailto:hello@example.com" },
  fieldErrors: { contact: ["메일 주소 형식을 확인해 주세요(예: name@example.com)."] },
}
