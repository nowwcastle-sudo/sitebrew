export type AgentActionTier = "agent-ok" | "fill-human-press" | "human-approval"

export interface AgentActionDef {
  /** 행동 id — data-requires-human 값·toolname 후보. 영문 소문자 kebab */
  readonly id: string
  readonly tier: AgentActionTier
  /** 이 행동을 부르는 포트 메서드(`BillingPort.checkout` 처럼) — 소스 검사가 `.run(() => <메서드>(` 호출을 이 표와 맞춘다 */
  readonly ports?: readonly string[]
  /** 이 행동의 제출·확정 컨트롤을 가진 블록(`kind/variant`) — 관문이 갤러리에서 표지·안내 글이 있는지 본다 */
  readonly blocks?: readonly string[]
  /** 왜 이 단계인가(한 줄) */
  readonly why: string
}

export const AGENT_ACTIONS = [
  // ── 사람 승인 ─────────────────────────────────────────────────────────────────────────────
  { id: "checkout", tier: "human-approval", ports: ["checkout"], blocks: ["paywall/upgrade-modal", "paywall/limit-meter", "paywall/onboarding-offer", "paywall/trial-ending", "trust/payment-trust-panel"], why: "결제 — 돈이 나가고 청약철회 동의가 걸린다" },
  { id: "change-plan", tier: "human-approval", ports: ["changePlan"], blocks: ["account/billing-manage"], why: "요금제 변경 — 청구 금액이 바뀐다" },
  { id: "update-payment-method", tier: "human-approval", ports: ["updatePaymentMethod"], blocks: ["account/billing-manage", "retention/payment-failed-banner"], why: "결제수단 제공 — 카드·계좌 정보를 넘기는 화면으로 간다" },
  { id: "cancel-subscription", tier: "human-approval", ports: ["cancel"], blocks: ["retention/cancel-flow", "retention/renewal-consent"], why: "해지 — 구독이 끝난다" },
  { id: "resume-subscription", tier: "human-approval", ports: ["resume"], blocks: ["retention/cancel-flow"], why: "구독 재개 — 청구가 다시 시작된다" },
  { id: "accept-price-change", tier: "human-approval", ports: ["acceptPriceChange"], blocks: ["retention/renewal-consent"], why: "가격 변경 동의 — 새 금액에 동의한다" },
  { id: "accept-retention-offer", tier: "human-approval", ports: ["applyRetentionOffer"], blocks: ["retention/cancel-flow"], why: "해지 대신 할인·일시정지 제안 수락 — 구독 조건이 바뀐다" },
  { id: "delete-account", tier: "human-approval", ports: ["deleteAccount"], blocks: ["account/delete-account"], why: "탈퇴 — 유예가 지나면 되돌릴 수 없다" },
  { id: "export-personal-data", tier: "human-approval", ports: ["exportMyData"], blocks: ["account/delete-account"], why: "개인정보 내보내기 — 개인 데이터가 파일로 나간다" },
  { id: "change-email", tier: "human-approval", ports: ["changeEmail"], blocks: ["account/credentials"], why: "이메일 변경 — 계정 되찾기 수단이 바뀐다" },
  { id: "change-password", tier: "human-approval", ports: ["changePassword", "resetPassword"], blocks: ["account/credentials", "auth/new-password"], why: "비밀번호 변경 — 계정 접근 수단이 바뀐다" },
  { id: "change-security", tier: "human-approval", ports: ["enableTwoFactor", "disableTwoFactor", "revokeSession", "revokeOtherSessions"], blocks: ["account/security"], why: "2단계 인증·로그인 기기 변경 — 계정 보안이 바뀐다" },
  { id: "sign-up", tier: "human-approval", ports: ["signUp"], blocks: ["auth/sign-up-consents", "confirmation/order-complete"], why: "가입 — 계정을 만들고 약관·개인정보 동의를 함께 보낸다" },
  { id: "marketing-consent", tier: "human-approval", ports: ["setConsents"], blocks: ["account/notification-consents", "lead-capture/inline-newsletter"], why: "마케팅·알림 수신 동의 — 동의 이력이 남는다" },
  { id: "provide-personal-data", tier: "human-approval", blocks: ["lead-capture/magnet-preview"], why: "개인정보 제공 — 이메일·이름을 넘기고 자료를 받는다" },
  { id: "send-message", tier: "human-approval", why: "다른 사람에게 메시지 발송 — 내 이름으로 나가고 회수되지 않는다. 지금 블록 중 이 행동을 하는 것은 없다(공유·초대 블록은 링크 복사·기기 공유창까지, 보내기는 사람이 기기에서 한다). 조립하는 쪽이 서버 발송을 만들면 이 id 를 단다" },
  { id: "delete-record", tier: "human-approval", why: "자료·항목 삭제·일괄 처리 — 관리 표 블록(data-table/bulk-select·record-panel)의 확정 단계. 표 부품이 모바일 정리 중이라 표지 적용은 그 병합 뒤 후속(docs/qa/p3-7-ax.md)" },
  // ── 사람이 마지막에 누름(WebMCP toolname 허용) ─────────────────────────────────────────────
  { id: "request-booking", tier: "fill-human-press", blocks: ["contact-form/stepped-booking"], why: "예약 요청 — 에이전트가 채우고 사람이 보낸다(확정이 아니라 요청)" },
  { id: "contact-inquiry", tier: "fill-human-press", blocks: ["contact-form/channel-first"], why: "문의 — 에이전트가 초안을 채우고 사람이 보낸다(inline-short 는 필수 개인정보 동의 칸이 있어 WebMCP 를 달지 않는다 — 운영자 결정 2026-10-04)" },
  { id: "ask-question", tier: "fill-human-press", why: "질문 — 지금 블록(qna/ask-form)은 필수 개인정보 동의 칸이 있어 WebMCP 를 달지 않는다(운영자 결정 2026-10-04). 동의 칸 없는 질문 폼을 만들면 이 단계로 옵트인한다" },
  // ── 에이전트 자율 ─────────────────────────────────────────────────────────────────────────
  { id: "browse-search-filter", tier: "agent-ok", why: "조회·검색·필터·정렬 — 읽기만 한다" },
  { id: "fill-draft", tier: "agent-ok", why: "칸 채우기·초안·미리보기 — 보내기 전까지 아무것도 바뀌지 않는다" },
  { id: "sign-in", tier: "agent-ok", ports: ["signIn", "verifyTwoFactor"], why: "로그인 — 사람이 준 자격으로 들어간다(자격을 만들거나 바꾸지 않는다)" },
  { id: "sign-out", tier: "agent-ok", ports: ["signOut"], why: "로그아웃 — 다시 로그인하면 되돌아온다" },
  { id: "request-password-reset", tier: "agent-ok", ports: ["requestPasswordReset"], why: "재설정 메일 요청 — 계정 주인에게만 가고 비밀번호는 바뀌지 않는다" },
  { id: "resend-verification", tier: "agent-ok", ports: ["sendVerificationEmail"], why: "확인 메일 다시 받기 — 계정 주인에게만 간다(요청 제한이 막는다)" },
  { id: "view-invoices", tier: "agent-ok", ports: ["portal"], why: "청구서·영수증 보기 — 읽기 전용 새 창" },
  { id: "start-cancel-or-plan-compare", tier: "agent-ok", why: "해지 시작·요금제 비교 — 안내 화면으로 가는 링크일 뿐 확정은 그 안의 승인 컨트롤이 한다" },
] as const satisfies readonly AgentActionDef[]

export type AgentActionId = (typeof AGENT_ACTIONS)[number]["id"]
export type HumanApprovalAction = Extract<(typeof AGENT_ACTIONS)[number], { tier: "human-approval" }>["id"]

export const HUMAN_APPROVAL_ACTIONS: readonly HumanApprovalAction[] = AGENT_ACTIONS.flatMap((a) => (a.tier === "human-approval" ? [a.id] : []))
export const FILL_HUMAN_PRESS_ACTIONS: readonly string[] = AGENT_ACTIONS.flatMap((a) => (a.tier === "fill-human-press" ? [a.id] : []))

/**
 * 안내 글 권장 기본값(짧게 — 한 줄). 블록은 글을 하드코딩하지 않고 `copy.humanHint` 로 받는다 — 조립하는 쪽이 로캘에 맞춰 이 값(또는 같은 뜻의 자기 글)을 준다.
 * 길이는 관문이 본다(HINT_MAX_CHARS).
 */
export const APPROVAL_HINT = { ko: "직접 확인하고 눌러 주세요", en: "You'll confirm this yourself" } as const
/** 안내 글이 이보다 길면 관문이 「짧지 않다」고 본다(읽기 도구·좁은 화면에서 한 줄 안쪽) */
export const HINT_MAX_CHARS = 60

/** 승인 컨트롤에 펼쳐 넣는 속성: 기계 표지 + 안내 글 연결. hintId 는 같은 블록의 <ApprovalHint id> 와 같은 값 */
export function humanApprovalProps(action: HumanApprovalAction, hintId: string): { "data-requires-human": HumanApprovalAction; "aria-describedby": string } {
  return { "data-requires-human": action, "aria-describedby": hintId }
}
