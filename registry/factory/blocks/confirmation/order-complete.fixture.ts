import { APPROVAL_HINT } from "@/registry/factory/contract/human-actions"
import { mockAnalytics, stateFromQuery, type TrackedEvent } from "@/registry/factory/contract/adapter-mock"

import type { ConfirmationOrderCompleteCopy, ConfirmationOrderCompleteProps } from "./order-complete"
import { SUBMIT_NOTICES } from "../auth/sign-in.fixture"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 침구 가게 「솜결(예시)」 비회원 주문 완료 — 이메일은 예시 도메인.
const COPY: ConfirmationOrderCompleteCopy = {
  humanHint: APPROVAL_HINT.ko,
  title: "주문을 받았어요",
  lead: "결제가 끝났고, 주문 확인 문자를 보냈어요.",
  orderLabel: "주문 번호",
  totalLabel: "결제 금액",
  vatIncluded: "VAT·배송비 포함",
  vatExcluded: "부가세 별도",
  guest: { text: "비회원 주문은 주문 번호와 휴대폰 번호로 조회해요.", link: { label: "비회원 주문 조회", href: "#guest-order" } },
  nextTitle: "앞으로 이렇게 돼요",
  next: [
    { title: "상품 준비", when: "오늘(10월 1일) 오후까지" },
    { title: "출고", when: "10월 2일(목) 오전", body: "출고되면 송장 번호를 문자로 보내요." },
    { title: "도착", when: "10월 3일(금)~4일(토)" },
  ],
  help: { title: "도움이 필요하면", body: "주문을 바꾸거나 취소하려면 출고 전에 알려 주세요.", phone: "02-000-0000", phoneLabel: "고객센터 전화", link: { label: "1:1 문의 남기기", href: "#contact" } },
  primary: { label: "주문 상세 보기", href: "#order-detail" },
  print: "인쇄·PDF로 저장",
  account: {
    title: "다음 주문을 더 빠르게 하려면(선택)",
    body: "이메일은 주문에서 채워 두었어요. 비밀번호만 정하면 계정이 생기고 이번 주문도 이어져요.",
    email: { label: "이메일", marker: "(필수)", required: "이메일을 적어 주세요." },
    password: { label: "비밀번호", marker: "(필수)", hint: "8자 이상", required: "비밀번호를 정해 주세요.", short: "비밀번호는 8자 이상이어야 해요.", show: "비밀번호 보기", capsLock: "Caps Lock이 켜져 있어요" },
    submit: "계정 만들기",
    pending: "만드는 중",
    fieldErrorTitle: "입력한 내용을 확인해 주세요",
    serverErrorTitle: "계정을 만들지 못했어요",
    notices: SUBMIT_NOTICES,
    done: { title: "계정을 만들었어요.", body: "이번 주문도 계정에 이어 두었어요." },
  },
}
const ORDER = { id: "20261001-0042", total: { amount: 89_000, currency: "KRW" as const, vatIncluded: true }, email: "guest@example.com" }

export const fixture: ConfirmationOrderCompleteProps = { copy: COPY, order: ORDER, submit: async () => ({ ok: true, data: {} }) }

export const fixtureMax: ConfirmationOrderCompleteProps = {
  ...fixture,
  copy: {
    ...COPY,
    title: "주문을 받았어요 — 결제가 끝났고 확인 문자를 보냈어요",
    lead: "결제가 끝났고 주문 확인 문자를 보냈어요. 추석 연휴(10월 3~6일)에는 택배사가 쉬어서 도착이 하루 이틀 늦을 수 있어요(예시).",
    next: [...COPY.next, { title: "7일 안 무료 반품", when: "받은 날부터 7일 안", body: "마음에 들지 않으면 반품 신청만 하면 기사님이 가지러 가요. 반품 배송비는 받지 않아요(예시)." }],
  },
  order: { ...ORDER, id: "20261001-0042-A7K2Q9", total: { ...ORDER.total, amount: 1_089_000 } },
}

export const fixtureMin: ConfirmationOrderCompleteProps = {
  ...fixture,
  copy: { ...COPY, next: [COPY.next[0]], help: { title: COPY.help.title, body: COPY.help.body, phoneLabel: COPY.help.phoneLabel, link: COPY.help.link } },
  order: { id: ORDER.id, total: ORDER.total },
}

export const fixturePorts = (q: URLSearchParams, g: { fx: string; onTrack: (e: TrackedEvent) => void }): Partial<ConfirmationOrderCompleteProps> => {
  const { submit } = stateFromQuery<never, unknown>(q, {
    receipt: {},
    fieldErrors: { password: ["이 비밀번호는 너무 흔해요. 다른 비밀번호를 정해 주세요."] },
    formError: q.get("submit") === "server-error" ? "계정 서버가 잠시 응답하지 않아요. 잠시 뒤 다시 눌러 주세요(예시)." : "입력한 내용을 다시 확인해 주세요.",
  })
  const a = mockAnalytics(q, { onTrack: g.onTrack })
  return { submit: () => submit(), track: a.track }
}
