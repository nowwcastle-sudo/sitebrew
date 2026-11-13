// 구독 상태(Task 5가 쓴다). 한 행 = 공급자 구독 하나. 상태는 웹훅 + 공급자 재조회로만 바뀐다(Review Focus 1).
import { sql } from "drizzle-orm"
import { check, index, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core"
import type { PendingPriceChange, Subscription, SubscriptionStatus } from "@launch-factory/contract"
import { user } from "./auth-base.ts"

/** DB에 저장하는 상태. 계약의 "none"(구독 없음)은 행이 없는 것으로 나타낸다. */
export const SUBSCRIPTION_STATUSES = ["trialing", "active", "past_due", "paused", "canceled", "expired"] as const
export type StoredSubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number]
// 계약에 상태가 더해지면 여기서 타입 오류가 난다(판 검사와 같은 방식).
type MissingStatus = Exclude<Exclude<SubscriptionStatus, "none">, StoredSubscriptionStatus>
const _statusesCoverContract: [MissingStatus] extends [never] ? true : never = true
void _statusesCoverContract

const tz = { withTimezone: true } as const

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** D9 조직 구분. 조직 플러그인(선택 조각)을 켠 제품만 채운다 — 그래서 외래키가 없다. */
    orgId: text("org_id"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    providerSubId: text("provider_sub_id").notNull(),
    status: text("status").$type<StoredSubscriptionStatus>().notNull(),
    planId: text("plan_id").notNull(),
    scheduledPlanId: text("scheduled_plan_id"),
    pendingPriceChange: jsonb("pending_price_change").$type<PendingPriceChange>(),
    currentPeriodEnd: timestamp("current_period_end", tz),
    // 계획의 칸 목록 밖이지만 계약 Subscription이 요구한다(Task 5가 DB에서 바로 돌려준다).
    trialEnd: timestamp("trial_end", tz),
    cancelAt: timestamp("cancel_at", tz),
    pausedUntil: timestamp("paused_until", tz),
    paymentIssue: jsonb("payment_issue").$type<NonNullable<Subscription["paymentIssue"]>>(),
    /**
     * past_due 가 시작된 때(그 상태를 처음 실은 이벤트의 occurred_at). past_due 가 이어지는 동안 바뀌지 않고, 벗어나면 null(대장 D57 유예).
     * applySubscriptionState 가 같은 한 문장 안에서 정한다 — 순서 보호를 그대로 받는다.
     */
    pastDueSince: timestamp("past_due_since", tz),
    /** 이 행을 마지막으로 쓴 이벤트의 occurred_at. 이보다 옛 이벤트는 반영하지 않는다. */
    updatedFromEventAt: timestamp("updated_from_event_at", tz).notNull(),
    createdAt: timestamp("created_at", tz).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", tz).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("subscriptions_provider_sub_uq").on(t.provider, t.providerSubId),
    index("subscriptions_user_idx").on(t.userId),
    index("subscriptions_org_idx").on(t.orgId),
    check("subscriptions_status_ck", sql.raw(`status in (${SUBSCRIPTION_STATUSES.map((s) => `'${s}'`).join(", ")})`)),
  ],
)

/**
 * 해지 대안 사용 예약표. 한 행 = (공급자, 공급자 구독, 대안) 하나를 이미 받았거나 받는 중이다.
 * 공급자를 부르기 전에 INSERT … ON CONFLICT DO NOTHING 으로 먼저 예약한다 — 이긴 쪽만 공급자를 부르고 두 번째부터는 거절된다(같은 대안의 반복 적용 막기).
 * 공급자 호출이 실패하면 예약 행을 지워 정상 고객이 다시 받을 수 있게 한다. 성공하면 applied_at 을 채운다 —
 * applied_at 이 비어 있는 오래된 행이 「결과를 알 수 없는 채 남은 예약」(처리가 중간에 끊긴 것)이라 사람이 대조해 지운다.
 * 구독 행(subscriptions)과 외래키로 잇지 않는다 — 구독이 해지·교체돼도 사용 기록은 남아야 하고, 공급자 구독 id 가 같으면 같은 구독이다.
 */
export const retentionOfferUses = pgTable(
  "retention_offer_uses",
  {
    provider: text("provider").notNull(),
    providerSubId: text("provider_sub_id").notNull(),
    offerId: text("offer_id").notNull(),
    reservedAt: timestamp("reserved_at", tz).notNull(),
    appliedAt: timestamp("applied_at", tz),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerSubId, t.offerId] })],
).enableRLS() // 공개 표는 RLS 를 명시로 켠다(정책은 만들지 않는다 — 0010_explicit_rls)
