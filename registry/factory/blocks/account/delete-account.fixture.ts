import { mockAuth, mockBilling, type TrackedEvent } from "@/registry/factory/contract/adapter-mock"
import { APPROVAL_HINT } from "@/registry/factory/contract/human-actions"

import { SUBMIT_NOTICES } from "../auth/sign-in.fixture"
import type { AccountDeleteAccountCopy, AccountDeleteAccountProps } from "./delete-account"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 서비스 「모아플랜(예시)」 탈퇴·내 데이터. 사용자는 목의 가상 인물(김예시·example.com).
// 갤러리 포트: ?auth=signed-in(기본)|signed-out · ?sub=(구독 상태 — 기본 active) · &state=(session 읽기) · &submit=(내 데이터 받기·지우기 결과).
// 보존 기간 4종은 전자상거래법 시행령 제6조①(표시·광고 6개월 · 계약·청약철회 5년 · 대금결제·공급 5년 · 불만·분쟁 3년, 대장 D21).
const COPY: AccountDeleteAccountCopy = {
  title: "탈퇴하기",
  humanHint: APPROVAL_HINT.ko,
  lead: "계정을 지우기 전에 내 데이터를 받고, 무엇이 지워지고 무엇이 남는지 확인하세요(예시).",
  export: {
    title: "내 데이터 받기",
    body: "프로필·로그인 방법·구독·동의 이력을 파일(JSON)로 받아요. 지운 뒤에는 받을 수 없으니 필요하면 먼저 받아 두세요.",
    label: "내 데이터 받기(JSON)",
    pending: "파일을 만드는 중",
    done: "「{file}」 파일을 내려받았어요. 받은 폴더에서 열어 보세요.",
    file: "내-정보.json",
    errorTitle: "내 데이터를 받지 못했어요 — 잠시 뒤 다시 눌러 주세요",
  },
  deleted: { title: "지워지는 것", items: ["프로필(이름·이메일)과 로그인 정보", "프로젝트·일정·할 일 같은 내가 만든 자료", "알림 수신 설정과 마케팅 동의 이력", "로그인된 기기와 사용 기록"] },
  retained: {
    title: "법에 따라 남는 것",
    body: "결제와 거래 기록은 법에서 보관하라고 한 기간 동안만 남기고, 기간이 지나면 지워요.",
    items: [
      { what: "표시·광고에 관한 기록", period: "6개월" },
      { what: "계약 또는 청약철회에 관한 기록", period: "5년" },
      { what: "대금 결제와 재화 공급에 관한 기록", period: "5년" },
      { what: "불만과 분쟁 처리에 관한 기록", period: "3년" },
    ],
    basis: "근거: 전자상거래법 시행령 제6조. 남는 기록에는 이름과 이메일 대신 가려진 식별값만 붙여 따로 보관해요.",
  },
  subscription: { title: "구독", live: "구독 중이에요. 계정을 지우면 {date}에 구독이 끝나고 그 뒤로는 결제되지 않아요.", scheduled: "이미 해지가 예약돼 있어요. {date}까지 쓸 수 있고 그 뒤로는 결제되지 않아요.", link: { label: "구독만 해지하려면 여기로", href: "#cancel" } },
  grace: { title: "유예 기간", body: "지우기를 누르면 {days}일 동안 기다려요. 그 안에 다시 로그인하면 지우기가 취소돼요. 기간이 끝나면 되돌릴 수 없어요." },
  decision: {
    question: "정말 계정을 지울까요?",
    cancel: "취소",
    confirm: "계정 지우기",
    pending: "접수하는 중",
    errorTitle: "계정 지우기를 접수하지 못했어요 — 아무것도 지워지지 않았어요",
    typed: { label: "지울 계정의 이메일 주소", marker: "(필수)", hint: "계정 주소 {email} 을(를) 그대로 입력해 주세요.", mismatch: "입력한 이메일 주소가 계정 주소와 달라요 — 계정 주소를 그대로 입력해 주세요" },
  },
  cancelled: { title: "계정을 지우지 않았어요", body: "아무것도 바뀌지 않았어요. 계정은 그대로예요.", label: "계정 설정으로 돌아가기", href: "#settings" },
  done: { title: "계정 지우기를 접수했어요", body: "{date}까지는 다시 로그인하면 취소할 수 있어요. 그 뒤에 계정이 지워져요.", note: "지금은 모든 기기에서 로그아웃됐어요(예시)." },
  notices: SUBMIT_NOTICES,
  empty: { title: "로그인이 필요해요", body: "로그인해야 계정을 지울 수 있어요.", label: "로그인하기", href: "#sign-in" },
  loading: "계정 정보를 불러오는 중이에요",
  error: "계정 정보를 불러오지 못했어요",
  retry: "다시 불러오기",
}

export const fixture: AccountDeleteAccountProps = {
  copy: COPY,
  session: async () => ({ ok: true, data: { userId: "user-example-1", name: "김예시", email: "kim@example.com", twoFactor: false } }),
  deleteAccount: async () => ({ ok: true, data: { graceUntil: "2026-10-08T00:00:00.000Z" } }),
  graceDays: 7,
}
export const fixtureMax: AccountDeleteAccountProps = {
  ...fixture,
  copy: {
    ...COPY,
    title: "탈퇴하기 — 내 데이터를 받고 무엇이 지워지는지 확인한 뒤 계정을 지워요(예시)",
    lead: "계정을 지우기 전에 내 데이터를 받고, 무엇이 지워지고 무엇이 남는지 확인하세요. 유예 기간 안에는 다시 로그인해서 되돌릴 수 있고, 회사 계정은 관리자에게 먼저 알려 주세요(예시).",
    deleted: { ...COPY.deleted, items: [...COPY.deleted.items, "공유 캘린더와 팀 구성원으로서의 기록(팀에 남은 사람이 있으면 팀 자료는 그대로 남아요)", "업로드한 파일과 첨부, 알림 기기 등록 정보"] },
  },
}
// 최소: 내 데이터 받기·구독 안내 없음(어댑터가 지원하지 않는 메서드는 props 를 주지 않는다)
export const fixtureMin: AccountDeleteAccountProps = { ...fixture, copy: { ...COPY, lead: undefined, subscription: { ...COPY.subscription, link: undefined } } }

export const fixturePorts = (q: URLSearchParams, g: { fx: string; onTrack: (e: TrackedEvent) => void }): Partial<AccountDeleteAccountProps> => {
  const qq = new URLSearchParams(q)
  if (!qq.has("auth")) qq.set("auth", "signed-in")
  const auth = mockAuth(qq, { requireConfirmation: true })
  const base = { session: auth.session, deleteAccount: auth.deleteAccount, graceDays: 7 }
  if (g.fx === "min") return base
  const sub = new URLSearchParams(q)
  if (!sub.has("sub")) sub.set("sub", "active")
  // 구독 읽기는 ?state= 를 따르지 않게 sub 만 넘긴다(구독 안내는 곁가지라 읽기 실패가 화면을 막지 않는다)
  const billing = mockBilling(new URLSearchParams({ sub: sub.get("sub") ?? "active" }))
  return { ...base, subscription: billing.subscription, exportMyData: auth.exportMyData }
}
