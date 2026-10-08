import { mockAnalytics, mockBilling, type TrackedEvent } from "@/registry/factory/contract/adapter-mock"

import type { ConfirmationUpgradeCompleteCopy, ConfirmationUpgradeCompleteProps } from "./upgrade-complete"
import { SUBMIT_NOTICES } from "../auth/sign-in.fixture"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 서비스 「모아플랜(예시)」 프로 요금제 결제 직후.
// 갤러리 포트: ?sub=active(기본 — 요금제가 열린 화면) · ?sub=none 이면 웹훅 전 「결제를 확인하는 중」 → 잠시 뒤 「메일로 알려드릴게요」 · &state=(subscription 읽기).
const COPY: ConfirmationUpgradeCompleteCopy = {
  title: "프로 요금제가 열렸어요",
  body: "결제가 끝났어요. 지금부터 프로 요금제의 모든 기능을 쓸 수 있어요.",
  unlockedTitle: "새로 열린 기능",
  unlocked: ["예약 페이지 무제한", "방문 전날 안내 문자 월 1,000건", "직원 10명까지 같은 예약표 보기"],
  receipt: "영수증은 가입한 이메일로 보냈어요. 결제 내역은 언제든 결제 관리에서 볼 수 있어요.",
  receiptTo: "영수증은 {email}로 보냈어요. 결제 내역은 언제든 아래 버튼이나 결제 관리에서 볼 수 있어요.",
  invoices: { label: "청구서·영수증 보기", pending: "여는 중", hint: "결제 대행사(예시)의 새 창에서 열려요.", errorTitle: "청구서 화면을 열지 못했어요 — 잠시 뒤 다시 눌러 주세요" },
  notices: SUBMIT_NOTICES,
  primary: { label: "프로 기능 써 보기", href: "#pro-start" },
  manage: { text: "결제 수단이나 요금제를 바꾸려면", label: "결제 관리", href: "#billing" },
  confirming: { title: "결제를 확인하는 중이에요", body: "결제사에서 확인이 오면 요금제가 바로 열려요. 이 화면을 닫지 않아도 돼요." },
  late: { title: "메일로 알려드릴게요", body: "결제 확인이 조금 늦어지고 있어요. 확인이 끝나면 요금제가 열리고 이메일로 알려드릴게요. 결제는 한 번만 이루어져요.", label: "대시보드로 가기", href: "#dashboard" },
  loading: "결제 상태를 불러오는 중이에요",
  error: "결제 상태를 불러오지 못했어요",
  retry: "다시 불러오기",
}
const ACTIVE = { planId: "pro", status: "active" as const, currentPeriodEnd: "2026-10-31T15:00:00.000Z" }

// 갤러리·시험이 오래 기다리지 않게 다시 읽는 간격을 짧게 둔다(실제 기본은 3초 × 6번)
export const fixture: ConfirmationUpgradeCompleteProps = { copy: COPY, subscription: async () => ({ ok: true, data: ACTIVE }), pollEvery: 2, pollMax: 3 }

export const fixtureMax: ConfirmationUpgradeCompleteProps = {
  ...fixture,
  copy: {
    ...COPY,
    title: "프로 요금제가 열렸어요 — 지금부터 모든 기능을 쓸 수 있어요(예시)",
    body: "결제가 끝났어요. 지금부터 프로 요금제의 모든 기능을 쓸 수 있어요. 이번 달은 남은 날짜만큼만 계산했고, 다음 결제일은 결제 관리에서 볼 수 있어요.",
    unlocked: [...COPY.unlocked, "손님 메모와 방문 기록 무제한 보관", "예약금 받기와 환불 규칙 설정(결제 연결은 설정에서)"],
    receipt: "영수증은 가입한 이메일로 보냈어요. 메일이 안 보이면 스팸함이나 프로모션함을 살펴보시고, 결제 내역은 언제든 결제 관리에서 다시 받을 수 있어요.",
  },
}

export const fixtureMin: ConfirmationUpgradeCompleteProps = { ...fixture, copy: { ...COPY, unlocked: [] } }

export const fixturePorts = (q: URLSearchParams, g: { fx: string; onTrack: (e: TrackedEvent) => void }): Partial<ConfirmationUpgradeCompleteProps> => {
  const qq = new URLSearchParams(q)
  if (!qq.has("sub")) qq.set("sub", "active")
  const billing = mockBilling(qq)
  // 영수증 메일 주소(email)와 결제 포털(portal)을 이은 판 — 기본(fixture)은 옛 모양 그대로 두고 갤러리 포트에서만 잇는다(E09)
  return { subscription: billing.subscription, portal: billing.portal, email: "owner@example.com", track: mockAnalytics(q, { onTrack: g.onTrack }).track }
}
