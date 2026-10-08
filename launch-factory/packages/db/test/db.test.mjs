// @launch-factory/db — 마이그레이션·웹훅 중복·풀러 설정·occurred_at 순서·D10·보존 기간 (v0 Task 3, Review Focus 1).
// DB는 PGlite 메모리 하나를 파일 전체가 같이 쓴다(메모리 절약). docker·네트워크를 쓰지 않는다.
import { test, before, after } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { sql } from "drizzle-orm"
import { getTableConfig } from "drizzle-orm/pg-core"
import { migrate } from "drizzle-orm/pglite/migrator"
import * as lf from "../src/index.ts"

const { db, MIGRATIONS_DIR, connectionOptions, recordWebhookEvent, applySubscriptionState, retainUntil, ECOMMERCE_RETENTION } = lf

const EXPECTED_TABLES = [
  "account",
  "account_deletions",
  "access_logs",
  "admin_actions",
  "consent_records",
  "idempotency_keys",
  "inquiries",
  "invitation",
  "known_devices",
  "mail_ledger",
  "marketing_consents",
  "marketing_notice_outbox",
  "member",
  "organization",
  "rate_limit",
  "rate_limits",
  "retained_transactions",
  "session",
  "subscriptions",
  "two_factor",
  "user",
  "verification",
  "webhook_events",
].sort()

/** @type {Awaited<ReturnType<typeof db.local>>} */
let d
before(async () => {
  d = await db.local()
  await d.execute(sql`insert into "user" (id, name, email) values ('u1', 'Test', 'u1@example.com')`)
})
after(async () => {
  await d?.$client.close()
})

/** drizzle가 감싼 오류에서 Postgres SQLSTATE를 꺼낸다. */
async function sqlState(promise) {
  try {
    await promise
  } catch (e) {
    return e.cause?.code ?? e.code
  }
  return "no-error"
}

test("마이그레이션이 빈 DB에 적용된다 — 표 23개, 기록 수 = journal 항목 수, 다시 돌려도 그대로", async () => {
  const tables = await d.execute(sql`select table_name from information_schema.tables where table_schema = 'public' order by 1`)
  assert.deepEqual(tables.rows.map((r) => r.table_name).sort(), EXPECTED_TABLES)

  const journal = JSON.parse(readFileSync(join(MIGRATIONS_DIR, "meta", "_journal.json"), "utf8"))
  const applied = await d.execute(sql`select count(*)::int as n from drizzle.__drizzle_migrations`)
  assert.equal(applied.rows[0].n, journal.entries.length)
  assert.ok(journal.entries.length >= 1)

  await migrate(d, { migrationsFolder: MIGRATIONS_DIR })
  const again = await d.execute(sql`select count(*)::int as n from drizzle.__drizzle_migrations`)
  assert.equal(again.rows[0].n, journal.entries.length)
})

test("F11: 공개 표 전부가 마이그레이션만으로 RLS 가 켜져 있고(Supabase 자동 트리거 없이), 정책은 하나도 없다", async () => {
  // PGlite 에는 Supabase 의 rls_auto_enable 이벤트 트리거가 없다 — 켜져 있다면 0010 마이그레이션이 켠 것이다
  const rows = await d.execute(sql`select c.relname as name, c.relrowsecurity as rls, c.relforcerowsecurity as forced from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' order by 1`)
  assert.deepEqual(rows.rows.map((r) => r.name).sort(), EXPECTED_TABLES)
  assert.deepEqual(rows.rows.filter((r) => !r.rls).map((r) => r.name), [], "RLS 가 꺼진 표가 있다")
  assert.deepEqual(rows.rows.filter((r) => r.forced).map((r) => r.name), [], "FORCE 는 쓰지 않는다 — 앱은 표 소유자로 붙는다")
  const policies = await d.execute(sql`select count(*)::int as n from pg_policies where schemaname = 'public'`)
  assert.equal(policies.rows[0].n, 0, "정책을 만들어 접근을 바꾸지 않는다")
  // 소유자(앱 접속 사용자)는 RLS 를 지나 그대로 읽고 쓴다
  const n = await d.execute(sql`select count(*)::int as n from "user"`)
  assert.equal(n.rows[0].n, 1)
})

test("webhook_events(provider, event_id) 중복 삽입은 DB가 막는다(23505)", async () => {
  const row = sql`insert into webhook_events (provider, event_id, occurred_at, payload_hash) values ('paddle', 'evt_dup', now(), 'h')`
  assert.equal(await sqlState(d.execute(row)), "no-error")
  assert.equal(await sqlState(d.execute(row)), "23505")
  // 다른 공급자의 같은 id는 다른 이벤트다.
  assert.equal(
    await sqlState(d.execute(sql`insert into webhook_events (provider, event_id, occurred_at, payload_hash) values ('gumroad', 'evt_dup', now(), 'h')`)),
    "no-error",
  )
})

test("recordWebhookEvent: 두 번째는 duplicate, 트랜잭션이 되돌려지면 재전송을 처리한다", async () => {
  const e = { provider: "paddle", eventId: "evt_rec_1", occurredAt: new Date("2026-09-30T00:00:00Z"), payloadHash: "abc" }
  assert.deepEqual(await recordWebhookEvent(d, e), { duplicate: false })
  assert.deepEqual(await recordWebhookEvent(d, e), { duplicate: true })

  const retry = { ...e, eventId: "evt_rec_rollback" }
  await assert.rejects(
    d.transaction(async (tx) => {
      assert.deepEqual(await recordWebhookEvent(tx, retry), { duplicate: false })
      throw new Error("처리 중 실패")
    }),
    /처리 중 실패/,
  )
  // 실패한 처리는 기록도 남기지 않았으므로 공급자의 재전송이 처리된다.
  assert.deepEqual(await recordWebhookEvent(d, retry), { duplicate: false })
})

test("풀러 URL(6543)이면 prepare:false, 직접 연결(5432)이면 prepare:true", async () => {
  const pooler = "postgresql://postgres.ref:pw@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres"
  const direct = "postgresql://postgres:pw@db.ref.supabase.co:5432/postgres"
  assert.deepEqual(connectionOptions(pooler), { prepare: false })
  assert.deepEqual(connectionOptions(direct), { prepare: true })
  assert.deepEqual(connectionOptions(direct, { pooled: true }), { prepare: false })
  // 6543은 pooled:false로도 끌 수 없다(운영에서 깨지는 설정을 막는다).
  assert.deepEqual(connectionOptions(pooler, { pooled: false }), { prepare: false })

  // 실제 드라이버에 그 값이 들어간다(연결은 첫 쿼리 때라 네트워크를 쓰지 않는다).
  const p = db(pooler)
  assert.equal(p.$client.options.prepare, false)
  await p.$client.end({ timeout: 0 })
  const q = db(direct)
  assert.equal(q.$client.options.prepare, true)
  await q.$client.end({ timeout: 0 })
})

test("잘못된 DATABASE_URL 오류에 URL(비밀번호)이 들어가지 않는다", () => {
  assert.throws(
    () => connectionOptions("not a url s3cr3t-pass"),
    (err) => err instanceof Error && !err.message.includes("s3cr3t-pass"),
  )
})

/** 구독 상태 한 벌(재조회로 얻은 전체 상태 모양). */
function state(status, at, extra = {}) {
  return {
    userId: "u1",
    provider: "paddle",
    providerSubId: "sub_order",
    status,
    planId: "pro",
    updatedFromEventAt: new Date(at),
    ...extra,
  }
}
async function stored() {
  const r = await d.execute(sql`select status, plan_id, updated_from_event_at from subscriptions where provider_sub_id = 'sub_order'`)
  return r.rows[0]
}

test("occurred_at 순서: updated가 created보다 먼저 와도 늦게 온 옛 이벤트가 새 상태를 덮지 않는다", async () => {
  // subscription.updated(10:02, active)가 먼저 도착
  assert.deepEqual(await applySubscriptionState(d, state("active", "2026-09-30T10:02:00Z")), { applied: true })
  // subscription.created(10:00, trialing)가 나중에 도착 → 무시
  assert.deepEqual(await applySubscriptionState(d, state("trialing", "2026-09-30T10:00:00Z")), { applied: false })
  assert.equal((await stored()).status, "active")
  // 같은 시각은 반영하지 않는다
  assert.deepEqual(await applySubscriptionState(d, state("paused", "2026-09-30T10:02:00Z")), { applied: false })
  assert.equal((await stored()).status, "active")
  // 더 새 이벤트는 반영한다
  assert.deepEqual(await applySubscriptionState(d, state("past_due", "2026-09-30T10:05:00Z", { planId: "team" })), { applied: true })
  const s = await stored()
  assert.equal(s.status, "past_due")
  assert.equal(s.plan_id, "team")
  assert.equal(new Date(s.updated_from_event_at).toISOString(), "2026-09-30T10:05:00.000Z")
})

test("구독 상태는 계약의 6상태만 받는다(\"none\"은 행 없음으로 나타낸다)", async () => {
  const bad = (status) =>
    sqlState(
      d.execute(sql`insert into subscriptions (user_id, provider, provider_sub_id, status, plan_id, updated_from_event_at)
                    values ('u1', 'paddle', ${"sub_" + status}, ${status}, 'pro', now())`),
    )
  assert.equal(await bad("none"), "23514")
  assert.equal(await bad("bogus"), "23514")
  assert.equal(await bad("canceled"), "no-error")
})

test("탈퇴 요청: 한 사용자에게 진행 중(pending) 요청은 하나뿐이다", async () => {
  const req = sql`insert into account_deletions (user_id, grace_until) values ('u_del', now() + interval '7 days')`
  assert.equal(await sqlState(d.execute(req)), "no-error")
  assert.equal(await sqlState(d.execute(req)), "23505")
  await d.execute(sql`update account_deletions set status = 'cancelled', cancelled_at = now() where user_id = 'u_del'`)
  assert.equal(await sqlState(d.execute(req)), "no-error")
})

test("D10: 어느 표에도 주민등록번호 칸이 없다", () => {
  const tables = Object.values(lf).filter((v) => v && typeof v === "object" && Symbol.for("drizzle:IsDrizzleTable") in v)
  assert.equal(tables.length, EXPECTED_TABLES.length)
  const columns = tables.flatMap((t) => getTableConfig(t).columns.map((c) => `${getTableConfig(t).name}.${c.name}`))
  const suspicious = columns.filter((c) => /rrn|resident|jumin|ssn|주민/i.test(c))
  assert.deepEqual(suspicious, [])
  // 양성 대조: 검사식이 실제로 잡는지
  assert.ok(/rrn|resident|jumin|ssn|주민/i.test("user.resident_no"))
})

test("거래기록 보존 기간 = 전자상거래법 시행령 제6조제1항(6개월·5년·5년·3년)", () => {
  assert.deepEqual(
    Object.fromEntries(Object.entries(ECOMMERCE_RETENTION).map(([k, v]) => [k, v.months])),
    { advertising: 6, contract: 60, payment: 60, dispute: 36 },
  )
  const at = new Date("2026-01-15T03:00:00Z")
  assert.equal(retainUntil("payment", at).toISOString(), "2031-01-15T03:00:00.000Z")
  assert.equal(retainUntil("dispute", at).toISOString(), "2029-01-15T03:00:00.000Z")
  assert.equal(retainUntil("advertising", at).toISOString(), "2026-07-15T03:00:00.000Z")
  assert.equal(at.toISOString(), "2026-01-15T03:00:00.000Z") // 입력을 바꾸지 않는다
})

test("보존 거래기록: 같은 (provider, provider_ref, kind)는 한 번만, kind는 법 4갈래만", async () => {
  const ins = (kind) =>
    sqlState(
      d.execute(sql`insert into retained_transactions (subject_ref, kind, provider, provider_ref, occurred_at, retain_until, record)
                    values ('hmac:x', ${kind}, 'paddle', 'txn_1', now(), now() + interval '5 years', '{}'::jsonb)`),
    )
  assert.equal(await ins("payment"), "no-error")
  assert.equal(await ins("payment"), "23505")
  assert.equal(await ins("contract"), "no-error")
  assert.equal(await ins("refund"), "23514")
})

test("접속기록: security accessLog()의 AccessRecord 모양이 그대로 들어간다(고시 제2조제3호 다섯 칸 + 다운로드)", async () => {
  const record = {
    actorId: "admin_1",
    ip: "203.0.113.7",
    subjects: ["u1", "u2"],
    action: "export",
    target: "subscriptions",
    occurredAt: "2026-09-30T01:00:00.000Z",
    download: true,
  }
  await lf.insertAccessLog(d, record)
  const r = await d.execute(sql`select actor_id, ip, subjects, action, target, occurred_at, download from access_logs where actor_id = 'admin_1'`)
  assert.equal(r.rows.length, 1)
  assert.deepEqual(r.rows[0].subjects, ["u1", "u2"])
  assert.equal(r.rows[0].download, true)
  assert.equal(new Date(r.rows[0].occurred_at).toISOString(), record.occurredAt)
})

test("접속기록은 추가 전용이다: UPDATE·TRUNCATE·1년 안 된 행 DELETE 거부, 1년 지난 행 DELETE 허용(고시 제8조제3항)", async () => {
  const base = { ip: "203.0.113.8", subjects: ["u1"], action: "read", target: null, download: false }
  await lf.insertAccessLog(d, { ...base, actorId: "admin_young", occurredAt: new Date().toISOString() })
  const old = new Date()
  old.setUTCMonth(old.getUTCMonth() - 13)
  await lf.insertAccessLog(d, { ...base, actorId: "admin_old", occurredAt: old.toISOString() })

  assert.equal(await sqlState(d.execute(sql`update access_logs set action = 'tampered' where actor_id = 'admin_young'`)), "P0001")
  assert.equal(await sqlState(d.execute(sql`update access_logs set action = 'tampered' where actor_id = 'admin_old'`)), "P0001")
  assert.equal(await sqlState(d.execute(sql`delete from access_logs where actor_id = 'admin_young'`)), "P0001")
  assert.equal(await sqlState(d.execute(sql`truncate access_logs`)), "P0001")
  assert.equal(await sqlState(d.execute(sql`delete from access_logs where actor_id = 'admin_old'`)), "no-error")

  const left = await d.execute(sql`select actor_id, action from access_logs where actor_id in ('admin_young', 'admin_old')`)
  assert.deepEqual(left.rows, [{ actor_id: "admin_young", action: "read" }])
})

test("접속기록 보관 기간 설정: 기본 1년, 2년 선택(고시 제8조제1항)", () => {
  assert.equal(lf.DEFAULT_ACCESS_LOG_RETENTION, "1y")
  assert.deepEqual(lf.ACCESS_LOG_RETENTION, { "1y": 12, "2y": 24 })
  const now = new Date("2026-09-30T00:00:00Z")
  assert.equal(lf.accessLogPurgeBefore(now).toISOString(), "2025-09-30T00:00:00.000Z")
  assert.equal(lf.accessLogPurgeBefore(now, "2y").toISOString(), "2024-09-30T00:00:00.000Z")
})
