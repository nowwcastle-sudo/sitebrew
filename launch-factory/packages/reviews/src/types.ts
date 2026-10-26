// 서비스 입구·출구 타입(런타임 코드 없음). 서비스·HTTP 모듈이 서로를 부르지 않고 이 파일만 본다.
import type { Locale } from "@launch-factory/i18n"
import type { LaunchFailure } from "@launch-factory/security/protect"
import type { PublicReview, RatingSummary } from "./summary.ts"

/** 보안 항목의 실패 코드 + 후기 쪽 코드 둘 */
export type ReviewsFailure = Omit<LaunchFailure, "code"> & { code?: LaunchFailure["code"] | "sign_in_required" | "duplicate" }
export type ReviewsResult<T> = { ok: true; data: T; message?: string } | ReviewsFailure

export interface SubmitContext {
  /** 요청 머리(IP). ip 를 직접 줘도 된다 */
  headers?: Headers
  ip?: string | null
  /** 로그인했으면 사용자 id. 후기는 로그인이 필요하고, 질문은 없어도 된다 */
  userId?: string | null
  /** 로그인한 사용자의 표시 이름(세션에서 읽은 값). 입력에 이름이 없을 때만 쓰고, 어느 쪽이든 가려서 저장한다 */
  displayName?: string | null
  locale?: Locale
}

export interface SubmitReceipt {
  id: string
  /** pending 이면 검토 뒤에 보인다 */
  status: "published" | "pending"
}

export interface ReviewList {
  items: PublicReview[]
  total: number
  page: number
  pageCount: number
  /** 후기(kind review) 목록에만 */
  summary?: RatingSummary
}
