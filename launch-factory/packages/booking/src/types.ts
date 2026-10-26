// 예약 서비스의 결과·행위자·알림 모양. 동작은 없다(타입과 상수만).
import type { BookingDepositStatus, BookingRow } from "@launch-factory/db"
import type { Locale } from "@launch-factory/i18n"
import type { LaunchFailure } from "@launch-factory/security/protect"

/** 보안 층의 알려진 실패 코드 + 예약만의 코드. web-factory ActionFailureCode 는 「알려진 값 + 공급자 문자열」 이라 더해도 계약을 지킨다 */
export type BookingFailureCode = NonNullable<LaunchFailure["code"]> | "slot_taken" | "not_found" | "cancel_closed" | "invalid_state" | "forbidden" | "deposit_failed" | "payment_pending" | "invalid_input"

/** 계약 ActionResult 실패 + A52 선택 칸(code·retryAfter). code 만 예약 코드로 넓혔다 */
export interface BookingFailure extends Omit<LaunchFailure, "code"> {
  code?: BookingFailureCode
}
export type BookingResult<T> = { ok: true; data: T; message?: string } | BookingFailure

/**
 * 결제창을 열 값. payments-kr 의 PaymentSession 과 구조가 같다(대입된다) — 이 패키지는 결제 공급자를 모르므로 구조만 적는다.
 * client 에는 공개해도 되는 값만 든다(storeId·channelKey 와 어느 예약의 결제인지 가리키는 orderId = 예약 번호).
 */
export interface DepositSession {
  provider: "portone" | "mock"
  paymentId: string
  orderName: string
  total: { amount: number; currency: "KRW" | "USD" | "EUR" | "JPY"; vatIncluded: boolean }
  client: Record<string, string>
}

/** 결제 대기 예약의 예약금 안내 — 금액·기한은 서버가 정한 값이고 session 으로 결제창을 연다 */
export interface BookingDepositOffer {
  amount: number
  currency: "KRW"
  /** 결제 기한(ISO) */
  payBy: string
  session: DepositSession
}

/** 접수 결과(블록의 receipt). id = 예약 번호 */
export interface BookingReceipt {
  id: string
  /** 예약 시작 시각(ISO) */
  startsAt: string
  status: "requested" | "confirmed"
  message: string
  /** 예약금이 있는 서비스의 접수일 때만 — 결제 대기이고, 결제가 끝나기 전에는 예약이 이어지지 않는다. 예약금 없는 접수의 결과에는 이 칸이 없다 */
  deposit?: BookingDepositOffer
}

/** 예약금 요약(조회·취소 결과). 예약금 없는 예약에는 없다 */
export interface BookingDepositView {
  status: BookingDepositStatus
  amount: number
  currency: "KRW"
  /** 결제 대기일 때 결제 기한(ISO) */
  payBy?: string
  /** 돌려준 금액(환불이 끝난 뒤) */
  refundedAmount?: number
  /** 이 시각(ISO)까지 취소하면 전액 환불 */
  fullRefundBy: string
  /** 그 뒤 취소하면 돌려주는 비율(%) */
  laterRefundPercent: number
}

/** 예약 번호 + 연락처가 맞는 사람에게 보이는 예약. 연락처는 돌려주지 않는다(이미 아는 값이다) */
export interface BookingView {
  id: string
  service: string
  serviceName: string
  startsAt: string
  endsAt: string
  partySize: number
  status: BookingRow["status"]
  /** 지금 직접 취소할 수 있는가(자리를 차지하는 상태 + 취소 마감 전) */
  canCancel: boolean
  /** 직접 취소할 수 있는 마지막 시각(ISO) */
  cancelBy: string
  deposit?: BookingDepositView
}

/**
 * 직원(대표·관리자)이 보는 예약 한 건 — 연락처·이름·메모까지 전부 든다(가리는 일은 부르는 쪽 몫).
 * 예약한 사람 쪽 모양(BookingView)과 달리 예약 번호를 reference 로, 예약금은 행의 값 그대로 준다.
 */
export interface BookingStaffRow {
  reference: string
  service: string
  serviceName: string
  startsAt: string
  endsAt: string
  partySize: number
  status: BookingRow["status"]
  name: string | null
  contact: string
  contactKind: "email" | "phone"
  /** 예약한 사람이 남긴 메모(직원 메모가 아니다) */
  note: string | null
  depositStatus: BookingDepositStatus
  /** 예약금(원). 예약금이 없으면 null */
  depositAmount: number | null
  depositRefundedAmount: number | null
  createdAt: string
  cancelledAt: string | null
  cancelledBy: "booker" | "owner" | "system" | null
}

/** 직원용 목록 질의. reference 는 접수 번호 일부(대소문자·헷갈리는 글자 느슨하게), search 는 접수 번호·연락처·이름 일부(관리 화면의 검색 칸), limit 은 1~200(기본 50) */
export interface BookingStaffQuery {
  status?: BookingRow["status"]
  reference?: string
  search?: string
  limit?: number
  offset?: number
}

/** 상태 바뀜의 결과 */
export interface BookingChange {
  id: string
  status: BookingRow["status"]
  message: string
  /** 예약금이 있던 예약의 마무리 */
  deposit?: { status: BookingDepositStatus; refundedAmount?: number }
}

/** 결제 확정 결과(반환 쪽·웹훅이 같은 함수로 얻는다) */
export interface DepositConfirmation {
  id: string
  status: BookingRow["status"]
  depositStatus: BookingDepositStatus
  /** 이번 호출이 상태를 바꿨는가(false = 이미 확정돼 있었다) */
  changed: boolean
  message: string
}

/** 웹훅에서 쓰는 결제 확정 결과. not_mine = 이 서비스의 결제가 아니다(상점 등 다른 곳의 것) */
export type DepositClaim = "confirmed" | "already_confirmed" | "pending" | "not_applicable" | "not_mine"

export interface SlotsResult {
  days: Array<{ date: string; slots: Array<{ startsAt: string; available: number }> }>
}

export interface SubmitContext {
  /** 요청 머리(IP). ip 를 직접 줘도 된다 */
  headers?: Headers
  ip?: string | null
  /** 로그인했으면 사용자 id — 요청 제한 키와 예약 행에 들어간다 */
  userId?: string | null
  locale?: Locale
}

/**
 * 상태를 바꾸는 사람. 서버가 세션으로 만든다(요청 본문이 정하지 않는다).
 * `{ system: true }` 는 Cron 같은 서버 내부 작업 — 취소만 할 수 있고 확정은 사람(대표·관리자)만 한다.
 */
export type BookingActor = { userId: string; role?: string | null; isOwner?: boolean } | { system: true }

/**
 * 알림 종류 = 예약한 사람이 알게 되는 상태. received: 접수(운영자 확인 대기) · confirmed: 확정 · cancelled: 취소 · reminder: 시작 전 알림.
 * 모두 안내용이다(광고성 아님). 실패해도 예약은 그대로고 onError 로만 알린다.
 */
export type BookingNoticeKind = "received" | "confirmed" | "cancelled" | "reminder"
export type BookingNotifier = (e: { kind: BookingNoticeKind; booking: BookingRow; locale: Locale }) => Promise<void>
