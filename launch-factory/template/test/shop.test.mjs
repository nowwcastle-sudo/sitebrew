// 상점 쪽(계획 3a D2) 정적·단위 시험 — 빌드·서버 없이 돈다. 화면이 실제로 그려지는 것은 한 바퀴 시험(e2e/loop.mock.spec.ts 의 shop 단계)과 제품 화면 관문(npm run template:screens)이 본다.
// 지키는 것: 순수 주소 읽기 · 상점 쪽은 모두 같은 관문(로그인 → 상점 켜짐)을 지난다 · 담기는 눌러야만 일어난다(GET 부작용 없음) · 결제창 SDK 는 파일 하나 · 상점 쪽은 색인하지 않는다.
import assert from "node:assert/strict"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

const T = fileURLToPath(new URL("..", import.meta.url))
const read = (p) => readFileSync(join(T, p), "utf8")

test("parseAddParam: 상품 id 모양만 받는다", async () => {
  const { parseAddParam } = await import("../lib/shop-params.ts")
  assert.equal(parseAddParam("example-mug"), "example-mug")
  assert.equal(parseAddParam(["example-tote", "x"]), "example-tote", "배열이면 첫 값")
  for (const bad of [undefined, "", "a b", "../x", "a/b", "<script>", "x".repeat(101), "한글"]) assert.equal(parseAddParam(bad), null, String(bad))
})

test("parseOrderId: 주문 id 모양만 받는다(틀리면 쪽이 404)", async () => {
  const { parseOrderId } = await import("../lib/shop-params.ts")
  assert.equal(parseOrderId("0b8c1f2e-1111-4222-8333-444455556666"), "0b8c1f2e-1111-4222-8333-444455556666")
  for (const bad of [undefined, "", "a b", "a/b", "%2e%2e", "x".repeat(101)]) assert.equal(parseOrderId(bad), null, String(bad))
})

test("parseCheckoutReturn: 성공은 확정, 실패 code 는 실패, 번호가 없거나 깨지면 missing", async () => {
  const { parseCheckoutReturn } = await import("../lib/shop-params.ts")
  assert.deepEqual(parseCheckoutReturn({ orderId: "o-1", paymentId: "payment-1", txId: "tx", transactionType: "PAYMENT" }), { kind: "confirm", orderId: "o-1", paymentId: "payment-1" })
  // 실패는 code 가 있다(paymentId 가 같이 와도 확정하지 않는다)
  assert.deepEqual(parseCheckoutReturn({ orderId: "o-1", paymentId: "payment-1", code: "FAILURE_TYPE_PG", message: "x" }), { kind: "failed", orderId: "o-1", code: "FAILURE_TYPE_PG" })
  assert.equal(parseCheckoutReturn({ orderId: "o-1" }).kind, "missing", "paymentId 없음")
  assert.equal(parseCheckoutReturn({ paymentId: "payment-1" }).kind, "missing", "orderId 없음")
  assert.equal(parseCheckoutReturn({ orderId: "../x", paymentId: "payment-1" }).kind, "missing")
  assert.equal(parseCheckoutReturn({ orderId: "o-1", paymentId: "p q" }).kind, "missing")
  assert.equal(parseCheckoutReturn({}).kind, "missing")
  assert.ok(parseCheckoutReturn({ orderId: "o-1", code: "x".repeat(500) }).code.length <= 80, "code 는 길이를 자른다")
})

test("상점 쪽 다섯은 모두 shopGate(로그인 → 상점 켜짐)를 지나고, 돌아올 곳(next)을 싣는다", () => {
  const pages = {
    "app/(product)/cart/page.tsx": /shopGate\(add \? `\/cart\?add=\$\{encodeURIComponent\(add\)\}` : "\/cart"\)/,
    "app/(product)/checkout/page.tsx": /shopGate\("\/checkout"\)/,
    "app/(product)/checkout/return/page.tsx": /shopGate\(`\/checkout\/return/,
    "app/(product)/orders/page.tsx": /shopGate\("\/orders"\)/,
    "app/(product)/orders/[id]/page.tsx": /shopGate\(`\/orders\/\$\{encodeURIComponent\(id\)\}`\)/,
  }
  for (const [file, re] of Object.entries(pages)) assert.match(read(file), re, file)
  const gate = read("components/product/shop-gate.tsx")
  assert.match(gate, /if \(!\(await currentSession\(\)\)\) return <SignInRequired next=\{next\} \/>/, "로그아웃이면 로그인 안내")
  assert.match(gate, /if \(!commerceEnabled\(\)\) return <ShopUnavailable \/>/, "상점이 꺼져 있으면 닫힘 안내")
  assert.ok(gate.indexOf("currentSession()") < gate.indexOf("commerceEnabled()"), "로그인이 먼저다")
  assert.match(gate, /errorCode="provider_unavailable"/)
})

test("담기: 장바구니 쪽은 주소만으로 아무것도 담지 않는다 — setCartLine 은 확인 줄의 눌림(onClick)에서만 부른다", () => {
  assert.doesNotMatch(read("app/(product)/cart/page.tsx"), /setCartLine/, "쪽(서버)은 담지 않는다")
  const confirm = read("components/product/add-to-cart-confirm.tsx")
  assert.match(confirm, /onClick=\{\(\) => void add\(\)\}/)
  assert.equal(confirm.match(/setCartLine\(/g)?.length, 1, "담는 호출은 add() 안의 한 곳")
  assert.match(confirm, /async \(\) => \{[\s\S]*await setCartLine\(/)
  assert.doesNotMatch(confirm, /useEffect/, "마운트만으로 담기지 않는다")
})

test("담기: 담은 뒤 주소의 ?add= 를 지워도 「담았어요」 안내는 남는다 — 담은 상품을 CartPanel 이 쥔다", () => {
  const blocks = read("components/product/shop-blocks.tsx")
  assert.match(blocks, /const item = add \?\? held/, "주소의 add 가 사라져도 쥔 상품으로 확인 줄을 그린다")
  assert.match(blocks, /setHeld\(item\)/, "담긴 순간 상품을 쥔다")
  assert.doesNotMatch(blocks, /add && confirming/, "add 가 있을 때만 그리면 router.replace 직후 안내가 사라진다")
})

test("결제창 SDK(@portone/browser-sdk)는 portone-pay.ts 한 파일만 동적으로 부르고, 판은 정확히 고정이다", () => {
  const hits = []
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      if (["node_modules", ".next", ".tmp"].includes(name)) continue
      const path = join(dir, name)
      if (statSync(path).isDirectory()) walk(path)
      else if (/\.(tsx?|mjs)$/.test(name) && !path.includes(`${join("test", "")}`) && readFileSync(path, "utf8").includes("@portone/browser-sdk")) hits.push(relative(T, path).replaceAll("\\", "/"))
    }
  }
  walk(T)
  assert.deepEqual(hits, ["components/product/portone-pay.ts"])
  assert.match(read("components/product/portone-pay.ts"), /await import\("@portone\/browser-sdk\/v2"\)/, "동적 import")
  assert.doesNotMatch(read("components/product/portone-pay.ts"), /^import .*@portone/m, "정적 import 없음")
  assert.equal(JSON.parse(read("package.json")).dependencies["@portone/browser-sdk"], "0.1.13", "^·~ 없는 정확한 판")
})

test("openPortOne: portone 세션이 아니거나 값이 빠졌거나 원화가 아니면 SDK 를 부르지 않고 provider_unavailable 로 끝낸다(던지지 않는다)", async () => {
  const { openPortOne, returnUrl, CHECKOUT_RETURN_PATH } = await import("../components/product/portone-pay.ts")
  const total = { amount: 27000, currency: "KRW", vatIncluded: true }
  const base = { provider: "portone", paymentId: "payment-1", orderName: "Mug", total, client: { storeId: "store", channelKey: "channel", orderId: "order-1" } }
  const cases = [
    { ...base, provider: "mock" },
    { ...base, client: { storeId: "store", orderId: "order-1" } },
    { ...base, client: { channelKey: "channel", orderId: "order-1" } },
    { ...base, client: { storeId: "store", channelKey: "channel" } },
    { ...base, total: { ...total, currency: "USD" } },
  ]
  for (const session of cases) assert.deepEqual(await openPortOne(session), { ok: false, paymentId: "payment-1", code: "provider_unavailable" })
  assert.equal(returnUrl("https://shop.example.test", "order 1"), `https://shop.example.test${CHECKOUT_RETURN_PATH}?orderId=order%201`)
})

test("상점 쪽은 색인하지 않는다 — 공개 쪽 목록에 없고 NOINDEX_PREFIXES 에 있다", async () => {
  const { isNoIndexPath, sitemapPaths } = await import("../lib/seo.ts")
  for (const p of ["/cart", "/checkout", "/checkout/return", "/orders", "/orders/abc"]) {
    assert.equal(isNoIndexPath(p), true, p)
    assert.ok(!sitemapPaths().includes(p), `${p} 는 사이트맵에 없다`)
  }
})

test("모의 결제 칸은 서버 액션 payWithMock 한 길만 쓰고, 결제 세션의 provider 로만 갈린다(앱 모드를 모른다)", () => {
  const blocks = read("components/product/shop-blocks.tsx")
  assert.match(blocks, /session\.provider !== "mock"\) return openPortOne\(session\)/)
  assert.match(blocks, /pay=\{shop\.payWithMock\}/)
  assert.doesNotMatch(blocks, /productMode|LF_MODE/)
  assert.doesNotMatch(read("components/product/mock-pay-panel.tsx"), /productMode|LF_MODE/)
})

test("상품 목록(/products): 공개 쪽이고, 상점이 꺼져 있으면 닫힘 안내, 카드는 /cart?add=<id> 로 간다(담기는 그 쪽 확인 줄에서만)", async () => {
  const page = read("app/(product)/products/page.tsx")
  assert.match(page, /if \(!commerceEnabled\(\)\) return <ShopUnavailable \/>/)
  assert.doesNotMatch(page, /shopGate|currentSession|setCartLine/, "로그인 관문이 아니고 담지도 않는다")
  assert.doesNotMatch(page, /error\.message|e\.message/, "오류 글을 화면·기록에 싣지 않는다")
  const { sitemapPaths, isNoIndexPath } = await import("../lib/seo.ts")
  assert.ok(sitemapPaths().includes("/products"), "공개 쪽 — 사이트맵에 있다")
  assert.equal(isNoIndexPath("/products"), false)
  assert.match(read("content/copy.shop.en.ts"), /hrefTemplate: "\/cart\?add=\{slug\}"/, "카드 주소는 담기 확인 줄이다")
})

test("toProductCards: 상품표(CatalogItem)를 카드로 — id 는 주소 조각으로 인코딩, 사진이 없으면 src 없이 자리만, 가격은 서버 단가 그대로", async () => {
  const { toProductCards } = await import("../lib/shop-products.ts")
  const price = (amount) => ({ amount, currency: "KRW", vatIncluded: true })
  const cards = toProductCards([
    { id: "example-mug", name: "Mug", price: price(27000), stock: 5 },
    { id: "Tote_1.a", name: "Tote", price: price(18000), imageUrl: "https://img.example.test/t.jpg", stock: null },
    { id: "gone", name: "Gone", price: price(1000), stock: 0 },
  ])
  assert.equal(cards.length, 3, "품절도 숨기지 않는다")
  assert.deepEqual(cards.map((c) => [c.slug, c.price]), [["example-mug", 27000], ["Tote_1.a", 18000], ["gone", 1000]])
  assert.equal("src" in cards[0].thumbs[0], false)
  assert.equal(cards[1].thumbs[0].src, "https://img.example.test/t.jpg")
  // 주소에 실려도 parseAddParam 이 되돌려 받는 모양이다
  const { parseAddParam } = await import("../lib/shop-params.ts")
  for (const c of cards) assert.equal(parseAddParam(decodeURIComponent(c.slug)), decodeURIComponent(c.slug))
  assert.deepEqual(toProductCards([]), [])
})
