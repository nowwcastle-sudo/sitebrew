"use server"
// launch-factory: 관리자 서버 액션. 서버 액션은 누구나 부를 수 있는 공개 입구다 — 모든 액션이 먼저 관리자 벽(관리자 + 2단계 인증 + 대리 세션 아님)을 지난다.
// 화면(표·상세)은 제품이 web-factory 블록으로 짠다. 읽기(목록·상세·CSV)는 admin_actions 에 남고, 쓰기(정지·해제·대리 로그인)는 Better Auth 훅이 남긴다.
import { runAdmin } from "@/lib/launch/admin"

export async function listUsers(input?: unknown) {
  return runAdmin((a) => a.listUsers(input))
}

export async function userDetail(input: unknown) {
  return runAdmin((a) => a.userDetail(input))
}

/** 정지는 사람 확인이 필요하다 — input.confirmed 가 정확히 true 가 아니면 confirmation_required(콘솔 구획의 정지와 같은 벽) */
export async function banUser(input: unknown) {
  return runAdmin((a) => a.banUser(input))
}

export async function unbanUser(input: unknown) {
  return runAdmin((a) => a.unbanUser(input))
}

/** 일괄 정지도 input.confirmed: true 가 필요하다 */
export async function bulkBan(input: unknown) {
  return runAdmin((a) => a.bulkBan(input))
}

export async function bulkUnban(input: unknown) {
  return runAdmin((a) => a.bulkUnban(input))
}

/** 대리 로그인은 사유가 필수다. 시작·종료가 모두 admin_actions 에 남는다 */
export async function impersonate(input: unknown) {
  return runAdmin((a) => a.impersonate(input))
}

export async function stopImpersonating() {
  return runAdmin((a) => a.stopImpersonating())
}
