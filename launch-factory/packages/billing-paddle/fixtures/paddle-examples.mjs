// Paddle 공식 문서의 예시 페이로드(2026-09-30 Context7 /websites/developer_paddle 로 가져옴). 대표 샌드박스 키(O3)가 없어 녹화 대신 이것으로 시작한다.
// 가짜 Paddle(test/fake-paddle.mjs)은 이 모양을 복제해 응답을 만든다 — 칸 이름·중첩·시각 형식이 실제 API 와 같아야 SDK 엔터티 변환이 실제처럼 돈다.
// 카드 소유자 이름·결제수단 세부는 옮기지 않았다(쓰지 않는 칸이고 개인정보처럼 보인다). 키·비밀값은 없다.

/**
 * 구독 엔터티. 출처: https://developer.paddle.com/build/subscriptions/pause-subscriptions.md
 * 「Pause a subscription on the next billing period」 응답의 data(그대로, 항목의 product 만 subscription.created 예시에서 가져와 붙임).
 */
export const SUBSCRIPTION_ENTITY = {
  id: "sub_01h8bxswamxysj44zt5n48njwh",
  status: "active",
  customer_id: "ctm_01h8441jn5pcwrfhwh78jqt8hk",
  address_id: "add_01h848pep46enq8y372x7maj0p",
  business_id: "biz_01h84a7hr4pzhsajkm8tev89ev",
  currency_code: "USD",
  created_at: "2023-08-21T11:31:10.292Z",
  updated_at: "2023-09-27T10:54:24.066Z",
  started_at: "2023-08-21T11:31:08.689295Z",
  first_billed_at: "2023-08-21T11:31:08.689295Z",
  next_billed_at: null,
  paused_at: null,
  canceled_at: null,
  collection_mode: "automatic",
  billing_details: null,
  current_billing_period: { starts_at: "2023-09-21T11:31:08.689295Z", ends_at: "2023-10-21T11:31:08.689295Z" },
  billing_cycle: { frequency: 1, interval: "month" },
  scheduled_change: { action: "pause", effective_at: "2023-10-21T11:31:08.689295Z", resume_at: null },
  items: [
    {
      status: "active",
      quantity: 30,
      recurring: true,
      created_at: "2023-08-21T11:31:10.292Z",
      updated_at: "2023-09-21T11:32:06.153Z",
      previously_billed_at: "2023-09-21T11:31:08.689295Z",
      next_billed_at: null,
      trial_dates: null,
      price: {
        id: "pri_01gsz8x8sawmvhz1pv30nge1ke",
        product_id: "pro_01gsz4t5hdjse780zja8vvr7jg",
        description: "Monthly (per seat)",
        tax_mode: "account_setting",
        billing_cycle: { frequency: 1, interval: "month" },
        trial_period: null,
        unit_price: { amount: "3266", currency_code: "USD" },
        // 아래 셋은 subscription.created 예시(https://developer.paddle.com/webhooks/subscriptions/subscription-created.md)의 price 칸
        unit_price_overrides: [],
        quantity: { maximum: 999, minimum: 1 },
        status: "active",
      },
      product: {
        id: "pro_01gsz4t5hdjse780zja8vvr7jg",
        name: "AeroEdit Pro",
        type: "standard",
        tax_category: "standard",
        description: "Designed for professional pilots.",
        image_url: null,
        custom_data: null,
        status: "active",
        import_meta: null,
        created_at: "2023-02-23T12:43:46.605Z",
        updated_at: "2024-04-05T15:53:44.687Z",
      },
    },
  ],
  custom_data: null,
  management_urls: {
    update_payment_method: "https://buyer-portal.paddle.com/subscriptions/sub_01h8bxswamxysj44zt5n48njwh/update-payment-method",
    cancel: "https://buyer-portal.paddle.com/subscriptions/sub_01h8bxswamxysj44zt5n48njwh/cancel",
  },
  discount: null,
}

/**
 * 이벤트 봉투. 출처: https://developer.paddle.com/webhooks/subscriptions/subscription-created.md 예시의 최상위 칸
 * (event_id·event_type·occurred_at·notification_id·data). 스키마: event_id 는 ^evt_[a-z\d]{26}$.
 */
export const SUBSCRIPTION_CREATED_ENVELOPE = {
  event_id: "evt_01hv8x2acma2gz7he8kg2s0hna",
  event_type: "subscription.created",
  occurred_at: "2024-04-12T10:18:49.621022Z",
  notification_id: "ntf_01hv8x2af22vrrz7k67g06x1kq",
}

/**
 * 결제 실패 시도. 출처: https://developer.paddle.com/webhooks/transactions/transaction-payment-failed.md 예시 data.payments[0]
 * (method_details 는 카드 종류·끝 4자리만 남기고 소유자 이름을 뺐다).
 */
export const FAILED_PAYMENT = {
  amount: "65215",
  status: "error",
  created_at: "2024-04-12T10:15:57.888183Z",
  error_code: "declined",
  captured_at: null,
  method_details: { type: "card", underlying_details: null, south_korea_local_card: null, card: { type: "visa", last4: "0002", expiry_year: 2025, expiry_month: 1, cardholder_name: null }, paypal: null },
  payment_method_id: "paymtd_01hv8wx2mka7dfsqjjsxh1ne7z",
  payment_attempt_id: "8f72cfa6-26b4-4a57-91dc-8f2708f7822d",
  stored_payment_method_id: "a78ece50-356f-4e0c-b72d-ad5368b0a0d9",
}

/** 거래 합계. 출처: 같은 transaction.payment_failed 예시 data.details.totals */
export const TRANSACTION_TOTALS = {
  fee: null,
  tax: "5315",
  total: "65215",
  credit: "0",
  balance: "65215",
  discount: "0",
  earnings: null,
  subtotal: "59900",
  grand_total: "65215",
  grand_total_tax: "5315",
  currency_code: "USD",
  credit_to_balance: "0",
}

/** 기본 결제 링크가 없을 때의 오류 응답. 출처: https://developer.paddle.com/errors/transactions/transaction_default_checkout_url_not_set.md */
export const ERROR_DEFAULT_CHECKOUT_URL_NOT_SET = {
  error: {
    type: "request_error",
    code: "transaction_default_checkout_url_not_set",
    detail: "Cannot create a transaction or open a checkout as no default payment link has been set for this account. Set in the Paddle dashboard, then try again.",
    documentation_url: "https://developer.paddle.com/errors/transactions/transaction_default_checkout_url_not_set",
  },
  meta: { request_id: "00000000-0000-0000-0000-000000000000" },
}
