// 관리 화면의 서버 조각(계획 3d): 쪽 제목(h1) · 접근 거절 한 줄 · 포트 실패 → 화면 고르기. 서버 컴포넌트다(클라이언트 잎은 admin-blocks.tsx).
// 거절은 사유마다 한 줄이고, 누가 왜 막혔는지(관리자가 누구인지·계정이 있는지)는 말하지 않는다.
import type * as React from "react"
import type { AdminResult } from "@launch-factory/admin-console"
import { StateScreenNotFound } from "@/components/blocks/state-screen/not-found"
import { SignInRequired } from "@/components/product/sign-in-required"
import type { AdminReadFailure } from "@/components/product/admin-blocks"
import { adminDenied, adminReadError } from "@/content/copy.admin.en"

/** 쪽 제목(h1): 블록 제목은 h2 라 블록만 놓인 쪽에는 h1 이 없다 — 화면 낭독기·문서 윤곽용으로 둔다 */
export function AdminPageTitle({ children }: { children: React.ReactNode }) {
  return <h1 className="sr-only">{children}</h1>
}

const REASONS = ["forbidden", "two_factor_required", "impersonation_blocked", "provider_unavailable", "nothing"] as const
type Reason = (typeof REASONS)[number]
const isReason = (code: unknown): code is Reason => typeof code === "string" && (REASONS as readonly string[]).includes(code)

/** 접근 거절 한 줄. 모르는 사유는 「열지 못했어요」 */
export function AdminDenied({ reason }: { reason?: string }) {
  const known = isReason(reason)
  return (
    <div data-admin-denied={known ? reason : "other"}>
      <StateScreenNotFound
        id="admin-denied"
        errorCode={known ? reason : "other"}
        headingLevel={1}
        copy={{ title: adminDenied.title, body: known ? adminDenied[reason] : adminDenied.other, home: { label: adminDenied.home, href: "/" }, support: { label: adminDenied.account, href: "/account" } }}
      />
    </div>
  )
}

/**
 * 포트 실패 중 「이 쪽을 못 연다」인 것(로그아웃·권한 없음·2단계 인증 없음·대리 세션·부품 꺼짐)은 화면 하나로 바꾼다. 그 밖의 실패(읽기 실패 등)는 null — 쪽이 잎에 상태로 넘긴다.
 * next 는 로그인 뒤 돌아올 곳이다.
 */
export function gateScreen(result: AdminResult<unknown>, next: string): React.ReactElement | null {
  if (result.ok) return null
  if (result.code === "sign_in_required") return <SignInRequired next={next} />
  if (isReason(result.code)) return <AdminDenied reason={result.code} />
  return null
}

/** 읽기 실패 → 잎에 넘기는 값(글은 콘솔이 가린 일반 문구, 없으면 기본 문구) */
export function readFailure(result: Extract<AdminResult<unknown>, { ok: false }>): AdminReadFailure {
  return { message: result.formError ?? adminReadError.title, ...(result.code ? { code: result.code } : {}), ...(result.retryable !== undefined ? { retryable: result.retryable } : {}) }
}
