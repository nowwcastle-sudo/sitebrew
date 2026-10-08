// 시드(v0 Task 17): 사용자 3명(무료·체험·유료) + 관리자 1명, 요금제 2개, @example.com 만, 두 번 돌려도 같은 결과.
import { test, before, after } from "node:test"
import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"
import { sql } from "drizzle-orm"
import { db } from "../src/index.ts"
import { seed, SEED_PLANS, SEED_USERS } from "../src/seed.ts"
import { validateBillingConfig, requireEntitlement } from "@launch-factory/billing-paddle"

const NOW = new Date("2026-09-30T00:00:00Z")
let d

before(async () => {
  d = await db.local()
})
after(async () => {
  await d.$client.close()
})

const snapshot = async (x) => {
  const users = (await x.execute(sql`select * from "user" order by id`)).rows
  const subs = (await x.execute(sql`select * from subscriptions order by provider_sub_id`)).rows
  return JSON.stringify({ users, subs })
}

test("시드: 4명(무료·체험·유료·관리자)·구독 2개·요금제 2개, 이메일은 모두 @example.com", async () => {
  const r = await seed(d, { now: NOW })
  assert.deepEqual(r, { users: 4, subscriptions: 2, plans: 2, adminRole: "set" }) // 마이그레이션 0009(Task 16 admin 플러그인)가 user.role 칸을 만든다
  const users = (await d.execute(sql`select id, email from "user" order by id`)).rows
  assert.equal(users.length, 4)
  for (const u of users) assert.match(u.email, /^[a-z]+@example\.com$/)
  const subs = Object.fromEntries((await d.execute(sql`select user_id, status, plan_id from subscriptions`)).rows.map((s) => [s.user_id, s]))
  assert.equal(subs.seed_user_free, undefined, "무료 사용자는 구독 행이 없다(계약 none)")
  assert.equal(subs.seed_user_admin, undefined)
  assert.equal(subs.seed_user_trial.status, "trialing")
  assert.equal(subs.seed_user_paid.status, "active")
  assert.equal(SEED_USERS.filter((u) => u.role === "admin").length, 1)
})

test("시드 요금제는 billing-paddle 설정 검사를 통과하고, 권한이 사용자별로 갈린다", async () => {
  assert.equal(SEED_PLANS.length, 2)
  validateBillingConfig(SEED_PLANS)
  assert.ok(SEED_PLANS.some((p) => (p.trialDays ?? 0) > 0), "체험 사용자를 위한 체험 요금제")
  const opts = { db: d, plans: SEED_PLANS }
  await assert.rejects(requireEntitlement({ userId: "seed_user_free" }, "core", opts), /does not include/)
  assert.deepEqual(await requireEntitlement({ userId: "seed_user_trial" }, "core", opts), { planId: "starter" })
  await assert.rejects(requireEntitlement({ userId: "seed_user_trial" }, "pro", opts), /does not include/)
  assert.deepEqual(await requireEntitlement({ userId: "seed_user_paid" }, "pro", opts), { planId: "pro" })
})

test("두 번 돌려도 같다: 같은 now 면 표 내용이 바이트까지 같고, 바꾼 값은 시드 값으로 돌아온다", async () => {
  const first = await snapshot(d)
  await d.execute(sql`update "user" set name = 'changed' where id = 'seed_user_paid'`)
  await d.execute(sql`update subscriptions set status = 'canceled' where provider_sub_id = 'sub_seed_paid'`)
  assert.notEqual(await snapshot(d), first, "양성 대조: 바꾸면 달라진다")
  await seed(d, { now: NOW })
  assert.equal(await snapshot(d), first)
  await seed(d, { now: new Date(NOW.getTime() + 3_600_000) })
  const counts = (await d.execute(sql`select (select count(*)::int from "user") u, (select count(*)::int from subscriptions) s`)).rows[0]
  assert.deepEqual(counts, { u: 4, s: 2 }, "다른 시각으로 다시 돌려도 행이 늘지 않는다")
})

test("관리자 역할: 마이그레이션 0009 의 user.role 칸에 관리자만 admin, 나머지는 user", async () => {
  const x = await db.local()
  try {
    // 마이그레이션 0009 가 만든 user.role 칸이 있다 → 관리자에게 admin
    assert.equal((await seed(x, { now: NOW })).adminRole, "set")
    const roles = Object.fromEntries((await x.execute(sql`select id, role from "user"`)).rows.map((r) => [r.id, r.role]))
    assert.deepEqual(roles, { seed_user_free: "user", seed_user_trial: "user", seed_user_paid: "user", seed_user_admin: "admin" })
  } finally {
    await x.$client.close()
  }
})

test("CLI: PGlite 폴더에 두 번 돌리면 같은 출력·종료 0", { timeout: 120_000 }, async () => {
  const dir = mkdtempSync(join(tmpdir(), "lf-seed-"))
  const cli = fileURLToPath(new URL("../src/seed.ts", import.meta.url))
  try {
    const run = () => promisify(execFile)(process.execPath, [cli, "--data-dir", join(dir, "pg")], { encoding: "utf8" })
    const a = await run()
    const b = await run()
    assert.equal(a.stdout, b.stdout)
    const out = JSON.parse(a.stdout)
    assert.equal(out.users, 4)
    assert.equal(out.subscriptions, 2)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
