// 관리 콘솔이 돌려주는 실패 문구(코드마다 한 줄) — 제품이 문구를 바꾼다(설치 때 한 번만 쓰이는 제품 소유 파일).
// 구획이 던진 오류는 이 중 action_failed 로만 나간다 — DB 글·개인정보·누가 왜 막혔는지(관리자 목록·계정 존재 여부)는 싣지 않는다.
import type { AdminFailureCode } from "@launch-factory/admin-console"

export const adminMessages: Record<AdminFailureCode, string> = {
  sign_in_required: "Please sign in to continue.",
  forbidden: "You don't have access to the admin pages.",
  two_factor_required: "Turn on two-factor authentication in your account to use the admin pages.",
  impersonation_blocked: "Admin pages aren't available while you're acting as another user.",
  provider_unavailable: "This part of the admin pages is turned off.",
  not_found: "We couldn't find that.",
  invalid_input: "That request wasn't valid. Please check it and try again.",
  confirmation_required: "Please confirm this action first.",
  invalid_state: "That can't be done in the current state. Reload and check again.",
  action_failed: "That didn't work. Please try again in a moment.",
}
