// Gumroad 공식 API 문서의 예시 응답·알림 매개변수(가짜 Gumroad 가 이 모양으로 답한다).
// 출처(2026-09-30 확인, 라이브 번들 Api-DyZWPF2i.js·Ping-DBuUJQUn.js 와 같은 문구):
// - GET /subscribers/:id 예시: https://gumroad.com/api#get-/subscribers/:id
//   (원천 antiwork/gumroad@74d7314 app/javascript/components/ApiDocumentation/Endpoints/Subscribers.tsx)
// - GET /sales/:id 예시: https://gumroad.com/api#get-/sales/:id (같은 커밋 Endpoints/Sales.tsx)
// - 판매 알림(ping) 매개변수 표: https://gumroad.com/ping (같은 커밋 app/javascript/pages/Public/Ping.tsx)
// - 구독 알림(resource_subscriptions) 매개변수: https://gumroad.com/api#put-/resource_subscriptions (Endpoints/ResourceSubscriptions.tsx)
// 카드·주소·후기·제휴 칸은 옮기지 않았다(쓰지 않는다). 이메일은 문서 예시 값이다.

/** GET /subscribers/:id 응답(문서 예시 그대로 — 키가 「subscribers」인 단일 객체다) */
export const SUBSCRIBER_RESPONSE = {
  success: true,
  subscribers: {
    id: "P5ppE6H8XIjy2JSCgUhbAw==",
    product_id: "0ssD7adjRklGBjS5cwlWPq==",
    product_name: "Pencil Icon PSD",
    user_id: "3523953790232",
    user_email: "calvin@gumroad.com",
    purchase_ids: ["O4pjE6H8XNjy2JSCgKhbAw=="],
    created_at: "2015-06-30T17:38:04Z",
    user_requested_cancellation_at: null,
    charge_occurrence_count: null,
    recurrence: "monthly",
    cancelled_at: null,
    ended_at: null,
    failed_at: null,
    free_trial_ends_at: null,
    license_key: "85DB562A-C11D4B06-A2335A6B-8C079166",
    status: "alive",
  },
}

/** 구독 상태 7개(문서: 「A subscription's status can be one of: …」) */
export const SUBSCRIBER_STATUSES = ["alive", "payment_method_update_required", "pending_cancellation", "pending_failure", "failed_payment", "fixed_subscription_period_ended", "cancelled"]

/** GET /sales/:id 응답(문서 예시에서 쓰는 칸만) */
export const SALE_RESPONSE = {
  success: true,
  sale: {
    id: "FO8TXN-dvxYabdavG97Y-Q==",
    email: "calvin@gumroad.com",
    seller_id: "kL0paVL2SdmJSYsNs-OCMg==",
    created_at: "2021-01-05T19:38:56Z",
    product_name: "Pencil Icon PSD",
    price: 1000,
    tax_cents: 125,
    tax_included_in_price: false,
    subscription_duration: "monthly",
    currency: "usd",
    product_id: "32-nPainqpLj1B_WIwVlMw==",
    product_permalink: "XCBbJ",
    paid: false,
    is_recurring_billing: true,
    subscription_id: "GazW4_NBcQy-o7Gjjng7lw==",
    cancelled: false,
    ended: false,
    recurring_charge: false,
    quantity: 1,
  },
}

/** 오류 응답 모양(문서 「API Errors」) */
export const ERROR_RESPONSE = { success: false, message: "The product could not be found." }
