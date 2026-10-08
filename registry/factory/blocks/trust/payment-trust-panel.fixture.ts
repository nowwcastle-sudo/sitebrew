import { APPROVAL_HINT } from "@/registry/factory/contract/human-actions"
import { mockAnalytics, stateFromQuery, type TrackedEvent } from "@/registry/factory/contract/adapter-mock"

import type { PaymentReceipt, TrustPaymentTrustPanelCopy, TrustPaymentTrustPanelProps } from "./payment-trust-panel"
import { SUBMIT_NOTICES } from "../auth/sign-in.fixture"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 침구 가게 「솜결(예시)」의 결제 단계 — 결제대행사 이름도 가상이다.
const won = (amount: number) => ({ amount, currency: "KRW" as const, vatIncluded: true })
const COPY: TrustPaymentTrustPanelCopy = {
  humanHint: APPROVAL_HINT.ko,
  title: "결제 수단을 골라 주세요",
  secure: { title: "안전하게 결제돼요", body: "카드 정보는 결제대행사(예시)가 직접 받고, 솜결은 저장하지 않아요." },
  marks: ["한빛결제(예시)", "구매안전 에스크로(예시)"],
  marksLabel: "결제를 처리하는 곳",
  summaryTitle: "결제할 금액",
  rows: [
    { label: "차렵이불 퀸(예시)", money: won(86_000) },
    { label: "배송비", money: won(3_000) },
  ],
  totalLabel: "총 결제 금액",
  vatIncluded: "VAT 포함",
  vatExcluded: "부가세 별도",
  methods: {
    legend: "결제 수단",
    options: [
      { id: "card", label: "신용·체크카드", hint: "할부는 결제창에서 골라요" },
      { id: "transfer", label: "실시간 계좌이체", hint: "이체한 돈은 배송이 끝날 때까지 예치돼요", escrow: true },
      { id: "easy", label: "간편결제(예시)" },
    ],
  },
  escrow: { title: "결제대금예치(에스크로)를 쓸 수 있어요.", body: "물건을 받을 때까지 결제 대금을 은행(예시)이 맡아 두어요.", link: { label: "구매안전서비스 가입 확인", href: "#escrow-check" } },
  pay: "{amount} 결제하기",
  inApp: {
    title: "이 화면에서는 결제가 막힐 수 있어요",
    guide: "지금은 앱 안 브라우저로 열려 있어요. 오른쪽 위 ⋯ 메뉴에서 「다른 브라우저로 열기」를 눌러 주세요.",
    open: "기본 브라우저로 열기",
    copy: { copy: "주소 복사", copied: "주소를 복사했어요", manual: "복사가 막혔어요. 주소창의 주소를 직접 복사해 주세요" },
  },
  pending: "결제창을 여는 중",
  required: "결제 수단을 하나 골라 주세요.",
  fieldErrorTitle: "결제 수단을 확인해 주세요",
  serverErrorTitle: "결제창을 열지 못했어요",
  notices: SUBMIT_NOTICES,
  done: { title: "결제가 끝났어요", body: "주문 확인 메일과 문자를 보냈어요(예시)." },
}

const RECEIPT: PaymentReceipt = {}
export const fixture: TrustPaymentTrustPanelProps = { copy: COPY, orderId: "order-example-1", total: won(89_000), submit: async () => ({ ok: true, data: RECEIPT }) }

export const fixtureMax: TrustPaymentTrustPanelProps = {
  ...fixture,
  copy: {
    ...COPY,
    title: "결제 수단을 골라 주세요 — 카드·계좌이체·간편결제 모두 결제 금액은 같아요",
    secure: { ...COPY.secure, body: "카드 정보는 결제대행사(예시)가 직접 받고 솜결은 저장하지 않아요. 결제 화면은 결제대행사 주소에서 열리고, 결제가 끝나면 이 화면으로 돌아와요(예시)." },
    rows: [...COPY.rows, { label: "베개 커버 2장 추가(예시)", money: won(18_000) }, { label: "선물 포장(예시)", money: won(2_000) }],
    methods: { ...COPY.methods, options: [...COPY.methods.options, { id: "deposit", label: "무통장 입금(가상계좌)", hint: "입금 기한은 주문 다음 날 자정이에요 — 예치 서비스가 적용돼요", escrow: true }] },
  },
  total: won(109_000),
}

export const fixtureMin: TrustPaymentTrustPanelProps = {
  ...fixture,
  copy: { ...COPY, marks: ["한빛결제(예시)"], rows: [{ label: "차렵이불 퀸(예시)", money: won(89_000) }], methods: { ...COPY.methods, options: COPY.methods.options.slice(0, 2).map((o) => ({ id: o.id, label: o.label, escrow: o.escrow })) } },
}

export const fixturePorts = (q: URLSearchParams, g: { fx: string; onTrack: (e: TrackedEvent) => void }): Partial<TrustPaymentTrustPanelProps> => {
  const { submit } = stateFromQuery<never, PaymentReceipt>(q, { receipt: RECEIPT, fieldErrors: { method: ["이 결제 수단은 지금 쓸 수 없어요. 다른 수단을 골라 주세요."] }, formError: q.get("submit") === "server-error" ? "결제대행사 응답이 늦어요. 잠시 뒤 다시 눌러 주세요(예시)." : "결제 수단을 다시 확인해 주세요." })
  const a = mockAnalytics(q, { onTrack: g.onTrack })
  return { submit: () => submit(), track: a.track }
}
