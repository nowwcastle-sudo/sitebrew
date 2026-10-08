// 개발·시험용 시드(v0 Task 17): 사용자 3명(무료·체험·유료) + 관리자 1명, 요금제 2개. 이메일은 모두 @example.com.
// 두 번 돌려도 결과가 같다 — id 가 고정이고 모든 쓰기가 upsert 다. 같은 `now` 로 두 번 돌리면 표 내용이 바이트까지 같다.
//
//   node packages/db/src/seed.ts                         PGlite(.tmp/pglite)에 마이그레이션을 적용하고 시드를 넣는다
//   node packages/db/src/seed.ts --data-dir <폴더>        다른 PGlite 폴더
//   node packages/db/src/seed.ts --remote                 DATABASE_URL 에 넣는다(운영 DB 에 가짜 사용자를 넣지 않도록 이 플래그가 있어야만 원격에 쓴다)
//
// 요금제는 표가 아니라 설정이다(billing-paddle `PaddlePlan`). 그래서 SEED_PLANS 로 내보내고, 구독 행이 그 id 를 가리킨다.
// 비밀번호(credential 계정)는 넣지 않는다 — 해시는 Better Auth 가 만든다(db 가 auth 에 의존하지 않게). 로그인은 비밀번호 재설정·매직 링크로 한다.
import { sql } from "drizzle-orm"
import type { Plan } from "@launch-factory/contract"
import type { Database } from "./client.ts"
import { user } from "./schema/auth-base.ts"
import { subscriptions } from "./schema/subscriptions.ts"

const DAY = 86_400_000

/** billing-paddle `PaddlePlan` 과 같은 모양(db 가 billing-paddle 에 의존하지 않도록 여기서는 구조만 맞춘다 — 시험이 validateBillingConfig 로 검사한다) */
export interface SeedPlan extends Plan {
  paddle: { priceId: string; trialPriceId?: string }
  entitlements: string[]
}

export const SEED_PLANS: readonly SeedPlan[] = [
  {
    id: "starter",
    name: "Starter",
    price: { amount: 900, currency: "USD", vatIncluded: false },
    interval: "month",
    trialDays: 14,
    features: ["Core features", "Email support"],
    paddle: { priceId: "pri_seed_starter", trialPriceId: "pri_seed_starter_trial" },
    entitlements: ["core"],
  },
  {
    id: "pro",
    name: "Pro",
    price: { amount: 2900, currency: "USD", vatIncluded: false },
    interval: "month",
    features: ["Everything in Starter", "Priority support"],
    recommended: true,
    paddle: { priceId: "pri_seed_pro" },
    entitlements: ["core", "pro"],
  },
]

export const SEED_USERS = [
  { id: "seed_user_free", email: "free@example.com", name: "Free User", role: "user" },
  { id: "seed_user_trial", email: "trial@example.com", name: "Trial User", role: "user" },
  { id: "seed_user_paid", email: "paid@example.com", name: "Paid User", role: "user" },
  { id: "seed_user_admin", email: "admin@example.com", name: "Admin User", role: "admin" },
] as const

export interface SeedResult {
  users: number
  subscriptions: number
  plans: number
  /** 관리자 역할 칸(`user.role` — Better Auth admin 플러그인, Task 16)이 있으면 "set", 없으면 "column-missing"(대장 D152) */
  adminRole: "set" | "column-missing"
}

export async function seed(d: Database, { now = new Date() }: { now?: Date } = {}): Promise<SeedResult> {
  return d.transaction(async (tx) => {
    for (const u of SEED_USERS) {
      const row = { id: u.id, email: u.email, name: u.name, emailVerified: true, twoFactorEnabled: false, createdAt: now, updatedAt: now }
      await tx
        .insert(user)
        .values(row)
        .onConflictDoUpdate({ target: user.id, set: { email: row.email, name: row.name, emailVerified: true, twoFactorEnabled: false, updatedAt: now } })
    }

    const subs = [
      { userId: "seed_user_trial", providerSubId: "sub_seed_trial", status: "trialing" as const, planId: "starter", trialEnd: new Date(now.getTime() + 14 * DAY), currentPeriodEnd: new Date(now.getTime() + 14 * DAY) },
      { userId: "seed_user_paid", providerSubId: "sub_seed_paid", status: "active" as const, planId: "pro", trialEnd: null, currentPeriodEnd: new Date(now.getTime() + 30 * DAY) },
    ]
    for (const s of subs) {
      const row = {
        ...s,
        provider: "paddle",
        orgId: null,
        scheduledPlanId: null,
        pendingPriceChange: null,
        cancelAt: null,
        pausedUntil: null,
        paymentIssue: null,
        updatedFromEventAt: now,
        createdAt: now,
        updatedAt: now,
      }
      const { provider: _p, providerSubId: _s, createdAt: _c, ...set } = row
      void _p
      void _s
      void _c
      await tx.insert(subscriptions).values(row).onConflictDoUpdate({ target: [subscriptions.provider, subscriptions.providerSubId], set })
    }

    // user.role 은 Better Auth admin 플러그인이 더하는 칸이다(Task 16). 칸이 생기기 전에도 시드가 돌도록 있을 때만 쓴다.
    const hasRole = await tx.execute<{ n: number }>(
      sql`select count(*)::int as n from information_schema.columns where table_schema = current_schema() and table_name = 'user' and column_name = 'role'`,
    )
    const roleColumn = Number((rowsOf(hasRole)[0] as { n: number } | undefined)?.n ?? 0) > 0
    if (roleColumn) {
      for (const u of SEED_USERS) await tx.execute(sql`update "user" set role = ${u.role} where id = ${u.id}`)
    }
    return { users: SEED_USERS.length, subscriptions: subs.length, plans: SEED_PLANS.length, adminRole: roleColumn ? "set" : "column-missing" }
  })
}

/** postgres-js 는 배열, PGlite 는 { rows } 로 돌려준다 */
function rowsOf(r: unknown): unknown[] {
  return Array.isArray(r) ? r : ((r as { rows?: unknown[] }).rows ?? [])
}

async function main(argv: string[]) {
  const { db } = await import("./client.ts")
  const remote = argv.includes("--remote")
  const i = argv.indexOf("--data-dir")
  if (remote) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error("--remote needs DATABASE_URL")
    const d = db(url)
    try {
      console.log(JSON.stringify(await seed(d)))
    } finally {
      await d.$client.end()
    }
    return
  }
  const dataDir = i >= 0 ? argv[i + 1] : ".tmp/pglite"
  if (!dataDir) throw new Error("--data-dir needs a folder")
  const d = await db.local({ dataDir })
  try {
    console.log(JSON.stringify({ dataDir, ...(await seed(d)) }))
  } finally {
    await d.$client.close()
  }
}

if (import.meta.main) {
  main(process.argv.slice(2)).catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : e)
    process.exitCode = 1
  })
}
