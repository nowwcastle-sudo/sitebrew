// 테스트 조립: PGlite 메모리 DB + 가짜 Gumroad(진짜 fetch 클라이언트가 부르는 HTTP) + 녹화 메일러.
// 시계는 매번 1ms 씩 앞으로 가는 가짜다(순서 시각이 ms 단위라 같은 ms 두 처리의 두 번째가 버려지는 것을 테스트에서 피한다 — 보고 우려 참고).
import { sql } from "drizzle-orm"
import { db } from "@launch-factory/db"
import { createMailer } from "@launch-factory/email"
import { gumroadBilling } from "../src/index.ts"
import { createFakeGumroad, installFetch, pingRequest, TEST_ACCESS_TOKEN, TEST_PING_SECRET } from "./fake-gumroad.mjs"

export const DAY = 24 * 3600 * 1000

// Gumroad 상품(우리 설정의 productId 와 같은 키)
export const PRODUCTS = {
  prod_basic: { name: "Basic", price: 900, recurrence: "monthly" },
  prod_pro: { name: "Pro", price: 2900, recurrence: "monthly" },
  prod_pro_trial: { name: "Pro (trial)", price: 2900, recurrence: "monthly", trialDays: 7 },
  prod_team_year: { name: "Team", price: 99000, recurrence: "yearly" },
  prod_other: { name: "Unrelated ebook", price: 500, recurrence: "monthly" },
}

const usd = (amount) => ({ amount, currency: "USD", vatIncluded: false })

export const PLANS = [
  { id: "basic", name: "Basic", price: usd(900), interval: "month", features: ["3 projects"], gumroad: { productId: "prod_basic", url: "https://seller.gumroad.com/l/basic" }, entitlements: ["projects"] },
  {
    id: "pro",
    name: "Pro",
    price: usd(2900),
    interval: "month",
    trialDays: 7,
    features: ["20 projects", "Advanced reports"],
    gumroad: { productId: "prod_pro", url: "https://seller.gumroad.com/l/pro", trialProductId: "prod_pro_trial", trialUrl: "https://seller.gumroad.com/l/pro-trial" },
    entitlements: ["projects", "reports.advanced"],
  },
  { id: "team", name: "Team", price: usd(99000), interval: "year", features: ["Unlimited"], gumroad: { productId: "prod_team_year", url: "https://seller.gumroad.com/l/team" }, entitlements: ["projects", "reports.advanced", "team"] },
]

export const MAIL_URLS = {
  manage: "https://app.example.test/billing",
  acceptPriceChange: "https://app.example.test/billing/price-change",
  decline: "https://app.example.test/billing/cancel",
}

export async function setup() {
  const d = await db.local()
  const sent = []
  const inner = createMailer({ mode: "mock", log: () => {} })
  const mailer = {
    mode: "mock",
    async send(req) {
      const res = await inner.send(req)
      sent.push({ ...req, res })
      return res
    },
  }
  const mail = { mailer, locale: "en", productName: "SampleCo", urls: MAIL_URLS }
  let t = Date.now()
  const clock = { now: () => new Date((t += 1)), set: (ms) => (t = ms) }
  const fake = createFakeGumroad({ products: PRODUCTS, now: () => new Date(t) })
  const restore = installFetch(fake)
  const logs = []
  const make = (extra = {}) =>
    gumroadBilling({ db: d, plans: PLANS, accessToken: TEST_ACCESS_TOKEN, pingSecret: TEST_PING_SECRET, mail, now: clock.now, log: (l) => logs.push(l), ...extra })
  const base = make()

  let n = 0
  async function newUser() {
    n += 1
    const id = `user_${n}_${Date.now().toString(36)}`
    await d.execute(sql`insert into "user" (id, name, email) values (${id}, ${"Test " + n}, ${id + "@example.test"})`)
    return id
  }
  async function deliver(body, opts, billing = base) {
    const res = await billing.handlePing(pingRequest(body, opts))
    return { status: res.status, body: await res.json() }
  }
  async function count(table) {
    const r = await d.execute(sql.raw(`select count(*)::int as n from ${table}`))
    return (r.rows ?? r)[0].n
  }
  async function snapshot() {
    const subs = await d.execute(sql`select * from subscriptions where provider = 'gumroad' order by provider_sub_id`)
    const evs = await d.execute(sql`select provider, event_id from webhook_events where provider = 'gumroad' order by event_id`)
    return JSON.stringify([subs.rows ?? subs, evs.rows ?? evs])
  }
  /** 손님이 결제 링크로 결제를 끝낸 것처럼: 링크의 상품·lf_ref 로 가짜 Gumroad 에 구독을 만들고 판매 알림을 보낸다 */
  async function completeCheckout(redirectUrl, billing = base) {
    const u = new URL(redirectUrl)
    const plan = PLANS.find((p) => p.gumroad.url === u.origin + u.pathname || p.gumroad.trialUrl === u.origin + u.pathname)
    const trial = plan.gumroad.trialUrl === u.origin + u.pathname
    const productId = trial ? plan.gumroad.trialProductId : plan.gumroad.productId
    const urlParams = Object.fromEntries([...u.searchParams].filter(([k]) => k === "lf_ref"))
    const r = fake.purchase({ productId, urlParams, trial })
    const res = await deliver(r.ping, undefined, billing)
    if (res.status !== 200) throw new Error(`checkout ping → ${res.status} ${JSON.stringify(res.body)}`)
    return r
  }
  return {
    d,
    mail,
    fake,
    clock,
    make,
    base,
    sent,
    logs,
    newUser,
    deliver,
    count,
    snapshot,
    completeCheckout,
    async close() {
      restore()
      await d.$client.close()
    },
  }
}
