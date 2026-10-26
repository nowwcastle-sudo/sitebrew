// 주입 면 — 이 패키지가 밖에서 받는 것은 이 파일의 CommerceDeps 하나다. DB·결제 공급자·메일·시계·상품표는 모두 여기로 들어온다(전역 없음, 가져다 쓰는 쪽이 정한다).
import type { EventName, EventProps } from "@launch-factory/contract"
import type { Database } from "@launch-factory/db"
import type { Mailer } from "@launch-factory/email"
import type { Locale } from "@launch-factory/i18n"
import type { PaymentGateway } from "@launch-factory/payments-kr"
import type { Catalog } from "./catalog.ts"
import type { ShippingRule } from "./pricing.ts"

export type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0]
/** 트랜잭션 안팎 어디서든 받는 DB 핸들 */
export type Executor = Database | Tx

/** 판매가 내는 계측 이벤트(계약 EVENTS 의 부분집합). props 에 개인정보를 싣지 않는다 */
export type CommerceEventName = Extract<EventName, "add_to_cart" | "begin_checkout" | "purchase">
export type CommerceTrack = <N extends CommerceEventName>(name: N, props: EventProps[N]) => void

export interface CommerceDeps {
  db: Database
  /** 결제 중개. 키 없는 미리보기는 mockGateway, live 는 portoneGateway(payments-kr resolvePayments 가 고른다) */
  gateway: PaymentGateway
  mailer: Mailer
  /** 가격의 정본 — 서버의 상품표 */
  catalog: Catalog
  shipping: ShippingRule
  productName: string
  /** 「내 주문」 화면의 절대 주소(https, 로컬 개발은 localhost 허용) — 주문 확인 메일의 버튼 */
  ordersUrl: string
  /** 메일·주문 이름·오류 글의 언어(기본 ko) */
  locale?: Locale
  /** 메일의 날짜 시간대(IANA, 기본은 언어에 따름) */
  timeZone?: string
  now?: () => Date
  /** 주문 id 채번(기본 crypto.randomUUID) */
  newId?: () => string
  /** 계측(선택). 던져도 판매는 영향받지 않는다 */
  track?: CommerceTrack
  /** 메일 실패·환불 시도 실패처럼 판매를 막지는 않지만 운영자가 알아야 하는 일 */
  onError?: (error: Error) => void
}

/** 기본값을 채운 주입 면 — 모듈 안에서는 이것을 쓴다 */
export interface Ctx extends CommerceDeps {
  locale: Locale
  now: () => Date
  newId: () => string
  onError: (error: Error) => void
  /** 던지지 않는 계측 */
  emit: CommerceTrack
}

export function withDefaults(deps: CommerceDeps): Ctx {
  const onError = deps.onError ?? ((e: Error) => console.error(e.message))
  return {
    ...deps,
    locale: deps.locale ?? "ko",
    now: deps.now ?? (() => new Date()),
    newId: deps.newId ?? (() => crypto.randomUUID()),
    onError,
    emit: (name, props) => {
      try {
        deps.track?.(name, props)
      } catch (e) {
        onError(e instanceof Error ? e : new Error(String(e)))
      }
    },
  }
}
