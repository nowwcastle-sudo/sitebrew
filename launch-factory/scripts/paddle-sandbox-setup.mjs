// Paddle 샌드박스에 시험 상품 1개 + 가격 3개(월·연·체험 있는 월)를 만든다. 멱등: 같은 이름 상품·같은 표식 가격이 있으면 다시 만들지 않는다.
// 라이브(api.paddle.com)는 부르지 않는다 — 모든 요청 전에 호스트가 sandbox-api.paddle.com 인지 코드로 확인한다(LFPAY 승인 2026-10-02).
// 키는 doctor 와 같은 방식(프로세스 환경 → Windows 사용자 환경)으로 읽고 어디에도 출력하지 않는다. 만든 id 는 .tmp/paddle-sandbox.json(gitignore)에만 적는다.
// 공식 문서(2026-10-02 확인): POST /products(name·tax_category, product.write) · POST /prices(product_id·unit_price{amount 문자열 최소단위,currency_code}·billing_cycle{interval,frequency}·tax_mode, price.write)
//   https://developer.paddle.com/api-reference/products/create-product · https://developer.paddle.com/api-reference/prices/create-price
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"
import { pathToFileURL } from "node:url"
import { maskSecrets, readSecrets } from "../packages/env/src/index.ts"

export const SANDBOX_HOST = "sandbox-api.paddle.com"
export const PRODUCT_NAME = "launch-factory 시험 요금제"
const MARK = "launch-factory-test-plan"
export const WANTED = [
  { key: "month", description: "launch-factory 시험 요금제 — 월 결제", amount: "900", interval: "month" },
  { key: "year", description: "launch-factory 시험 요금제 — 연 결제", amount: "9000", interval: "year" },
  // 체험 있는 가격(PaddlePlan.paddle.trialPriceId). 공식 문서(2026-10-03 확인, https://developer.paddle.com/build/trials/create-trial.md): trial_period {interval, frequency} 만 주면 카드 필요 무료 체험이고 응답에 requires_payment_method: true 가 붙는다
  { key: "month-trial", description: "launch-factory 시험 요금제 — 월 결제(14일 체험)", amount: "900", interval: "month", trialDays: 14 },
]

/** 샌드박스 호스트가 아니면 던진다. 모든 요청 앞에서 부른다. */
export function assertSandboxUrl(url) {
  const u = new URL(url)
  if (u.protocol !== "https:" || u.hostname !== SANDBOX_HOST) throw new Error(`라이브/알 수 없는 호스트라 멈춘다: ${u.hostname}`)
  return u.href
}

export function client(key, fetchImpl) {
  if (key.startsWith("pdl_live_")) throw new Error("실결제 키(pdl_live_…)라 멈춘다")
  return async (method, path, body) => {
    const url = assertSandboxUrl(`https://${SANDBOX_HOST}${path}`)
    const res = await fetchImpl(url, {
      method,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
    const json = await res.json().catch(() => null)
    if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${json?.error?.code ?? ""} ${json?.error?.detail ?? ""}`.trim())
    return json
  }
}

/** 상품·가격을 보장하고 { productId, prices:{month,year,"month-trial"}, created:[…] } 를 돌려준다 */
export async function ensureSandboxCatalog({ key, fetch: fetchImpl = fetch, taxCategory = "saas" }) {
  const call = client(key, fetchImpl)
  const created = []
  const products = (await call("GET", "/products?status=active&per_page=200")).data ?? []
  let product = products.find((p) => p.name === PRODUCT_NAME)
  if (!product) {
    product = (await call("POST", "/products", { name: PRODUCT_NAME, tax_category: taxCategory, description: "launch-factory 결제 시험용(가상 상품)", custom_data: { lf: MARK } })).data
    created.push(product.id)
  }
  const existing = (await call("GET", `/prices?product_id=${product.id}&status=active&per_page=200`)).data ?? []
  const prices = {}
  for (const w of WANTED) {
    let price = existing.find((p) => p.custom_data?.lf === MARK && p.billing_cycle?.interval === w.interval && Boolean(p.trial_period) === Boolean(w.trialDays))
    if (!price) {
      price = (
        await call("POST", "/prices", {
          description: w.description,
          product_id: product.id,
          unit_price: { amount: w.amount, currency_code: "USD" },
          billing_cycle: { interval: w.interval, frequency: 1 },
          ...(w.trialDays ? { trial_period: { interval: "day", frequency: w.trialDays } } : {}),
          tax_mode: "external",
          custom_data: { lf: MARK },
        })
      ).data
      created.push(price.id)
    }
    prices[w.key] = price.id
  }
  return { productId: product.id, prices, created }
}

async function main() {
  const key = readSecrets(["PADDLE_API_KEY"]).PADDLE_API_KEY
  if (!key) throw new Error("PADDLE_API_KEY 가 없다")
  const out = process.argv.includes("--out") ? process.argv[process.argv.indexOf("--out") + 1] : ".tmp/paddle-sandbox.json"
  const r = await ensureSandboxCatalog({ key })
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, `${JSON.stringify({ env: "sandbox", ...r, at: new Date().toISOString() }, null, 2)}\n`)
  console.log(JSON.stringify({ productId: r.productId, prices: r.prices, createdNow: r.created.length }, null, 2))
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((e) => {
    console.error(`paddle-sandbox-setup 실패: ${maskSecrets(e instanceof Error ? e.message : e, [readSecrets(["PADDLE_API_KEY"]).PADDLE_API_KEY])}`)
    process.exitCode = 1
  })
}
