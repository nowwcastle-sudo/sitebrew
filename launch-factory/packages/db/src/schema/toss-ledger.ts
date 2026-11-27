import { sql } from "drizzle-orm"
import { check, integer, pgTable, primaryKey, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core"
import { user } from "./auth-base.ts"

export const tossRegistrationIdentities = pgTable("toss_registration_identities", {
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "restrict" }),
  productId: text("product_id").notNull(),
}, (t) => [primaryKey({ columns: [t.userId, t.productId] })]).enableRLS()

export const tossLedgerSubscriptions = pgTable("toss_ledger_subscriptions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "restrict" }),
  productId: text("product_id").notNull(),
  customerKey: text("customer_key").notNull(),
  encryptedBillingKey: text("encrypted_billing_key"),
  planId: text("plan_id").notNull(),
  orderName: text("order_name").notNull(),
  amount: integer("amount").notNull(),
  status: text("status").notNull(),
  billingAnchor: timestamp("billing_anchor", { withTimezone: true }),
  periodStart: timestamp("period_start", { withTimezone: true }),
  periodEnd: timestamp("period_end", { withTimezone: true }),
  nextDueAt: timestamp("next_due_at", { withTimezone: true }),
  cancelAt: timestamp("cancel_at", { withTimezone: true }),
  retryCount: integer("retry_count").notNull().default(0),
  retryAt: timestamp("retry_at", { withTimezone: true }),
  scheduleHoldReason: text("schedule_hold_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check("toss_schedule_hold_reason_ck", sql`${t.scheduleHoldReason} is null or ${t.scheduleHoldReason} in ('legacy_paid', 'overdue', 'credential_unavailable')`),
  check("toss_subscription_amount_ck", sql`${t.amount} > 0`),
  check("toss_subscription_status_ck", sql`${t.status} in ('enabled', 'cancel_requested', 'canceled')`),
  uniqueIndex("toss_subscription_user_product_live_uq").on(t.userId, t.productId).where(sql`${t.status} in ('enabled', 'cancel_requested')`),
]).enableRLS()

export const tossLedgerCharges = pgTable("toss_ledger_charges", {
  orderId: text("order_id").primaryKey(),
  subscriptionId: text("subscription_id").notNull().references(() => tossLedgerSubscriptions.id),
  billingMonth: text("billing_month").notNull(),
  amount: integer("amount").notNull(),
  status: text("status").notNull(),
  paymentKey: text("payment_key"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  nextReconcileAt: timestamp("next_reconcile_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("toss_charge_month_active_uq").on(t.subscriptionId, t.billingMonth).where(sql`${t.status} in ('in_flight', 'paid')`),
  uniqueIndex("toss_charge_inflight_uq").on(t.subscriptionId).where(sql`${t.status} = 'in_flight'`),
  check("toss_charge_month_ck", sql`${t.billingMonth} ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'`),
  check("toss_charge_amount_ck", sql`${t.amount} > 0`),
  check("toss_charge_state_ck", sql`(${t.status} = 'paid' AND ${t.paymentKey} IS NOT NULL AND ${t.paidAt} IS NOT NULL) OR (${t.status} in ('in_flight', 'declined') AND ${t.paymentKey} IS NULL AND ${t.paidAt} IS NULL)`),
]).enableRLS()

export const tossRegistrationSessions = pgTable("toss_registration_sessions", {
  id: text("id").primaryKey(),
  stateHash: text("state_hash").notNull().unique(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "restrict" }),
  productId: text("product_id").notNull(),
  customerKey: text("customer_key").notNull().unique(),
  planId: text("plan_id").notNull(),
  orderName: text("order_name").notNull(),
  amount: integer("amount").notNull(),
  authKeyHash: text("auth_key_hash").unique(),
  status: text("status").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("toss_registration_user_product_open_uq").on(t.userId, t.productId).where(sql`${t.status} in ('pending', 'issuing', 'cancel_requested')`),
  check("toss_registration_amount_ck", sql`${t.amount} > 0`),
  check("toss_registration_status_ck", sql`${t.status} in ('pending', 'issuing', 'cancel_requested', 'registered', 'canceled', 'expired')`),
]).enableRLS()
