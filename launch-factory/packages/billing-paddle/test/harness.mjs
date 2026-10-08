// 테스트 조립: PGlite 메모리 DB 하나 + 가짜 Paddle(진짜 SDK 가 부르는 HTTP) + 녹화 메일러(렌더는 진짜 — 입력 오류는 여기서도 잡힌다).
// 파일마다 한 번 만든다(메모리 절약). 사용자·구독은 테스트마다 새로 만들어 서로 섞이지 않는다.
import { sql } from "drizzle-orm"
import { db } from "@launch-factory/db"
import { createMailer } from "@launch-factory/email"
import { createPaddleClient, paddleBilling } from "../src/index.ts"
import { createFakePaddle, installFetch, TEST_WEBHOOK_SECRET, webhookRequest } from "./fake-paddle.mjs"

export const DAY = 24 * 3600 * 1000

export const PRICES = {
  pri_basic: { amount: 900, currency: "USD", interval: "month" },
  pri_pro: { amount: 2900, currency: "USD", interval: "month" },
  pri_pro_trial: { amount: 2900, currency: "USD", interval: "month", trialDays: 14 },
  pri_pro_2027: { amount: 3300, currency: "USD", interval: "month" },
  pri_team_year: { amount: 99000, currency: "USD", interval: "year" },
}

const usd = (amount) => ({ amount, currency: "USD", vatIncluded: false })

export const PLANS = [
  { id: "basic", name: "Basic", price: usd(900), interval: "month", features: ["3 projects"], paddle: { priceId: "pri_basic" }, entitlements: ["projects"] },
  {
    id: "pro",
    name: "Pro",
    price: usd(2900),
    interval: "month",
    trialDays: 14,
    recommended: true,
    features: ["20 projects", "Advanced reports"],
    paddle: { priceId: "pri_pro", trialPriceId: "pri_pro_trial", otherPriceIds: ["pri_pro_2027"] },
    entitlements: ["projects", "reports.advanced"],
  },
  { id: "team", name: "Team", price: usd(99000), interval: "year", features: ["Unlimited projects"], paddle: { priceId: "pri_team_year" }, entitlements: ["projects", "reports.advanced", "team"] },
]

export const MAIL_URLS = {
  manage: "https://app.example.test/billing",
  acceptPriceChange: "https://app.example.test/billing/price-change",
  decline: "https://app.example.test/billing/cancel",
  resubscribe: "https://app.example.test/pricing",
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
  const state = { autoComplete: true }
  let base
  const fake = createFakePaddle({
    prices: PRICES,
    // 호스팅 결제창에서 손님이 결제를 끝낸 것처럼: 구독을 만들고 서명된 웹훅을 우리 처리기로 보낸다(적합성 묶음 주석 — 「샌드박스에서 결제를 끝낸 뒤」)
    onCheckout: async (txn) => {
      if (!state.autoComplete) return
      for (const e of fake.completeCheckout(txn.id)) {
        const res = await base.handleWebhook(webhookRequest(e))
        if (res.status !== 200) throw new Error(`checkout webhook ${e.event_type} → ${res.status}`)
      }
    },
  })
  const restore = installFetch(fake)
  const paddle = createPaddleClient({ apiKey: "test-api-key-not-real", env: "sandbox" })
  const logs = []
  const make = (extra = {}) => paddleBilling({ db: d, plans: PLANS, paddle, webhookSecret: TEST_WEBHOOK_SECRET, mail, log: (l) => logs.push(l), ...extra })
  base = make()

  let n = 0
  async function newUser() {
    n += 1
    const id = `user_${n}_${Date.now().toString(36)}`
    await d.execute(sql`insert into "user" (id, name, email) values (${id}, ${"Test " + n}, ${id + "@example.test"})`)
    return id
  }
  async function deliver(envelope, opts) {
    const res = await base.handleWebhook(webhookRequest(envelope, opts))
    return { status: res.status, body: await res.json() }
  }
  async function count(table) {
    const r = await d.execute(sql.raw(`select count(*)::int as n from ${table}`))
    return (r.rows ?? r)[0].n
  }
  return {
    d,
    mail,
    fake,
    paddle,
    make,
    base: () => base,
    sent,
    logs,
    state,
    newUser,
    deliver,
    count,
    async close() {
      restore()
      await d.$client.close()
    },
  }
}
