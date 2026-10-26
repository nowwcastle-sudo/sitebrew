// factory/scripts/archetypes.test.mjs — P3-3 Task 1 원형 JSON v1.
// 원형 10개는 registry/factory/archetypes/ 원천이다. 섹션은 블록 이름(allowedVariants)에 묶이고, 블록이 없는 섹션은 noBlock 으로 이유를 남긴다(C42·C55).
import { test } from "node:test"
import assert from "node:assert/strict"
import { readdirSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { loadArchetypes, checkArchetypes, ArchetypeSchema, loadBlockIndex, ARCHETYPE_DIR, ARCHETYPE_IDS, UI_PARTS_DIR } from "./archetypes.mjs"
import { EVENTS } from "../../registry/factory/contract/events.ts"
import { LEGAL_PAGES } from "../legal/drafts.mjs"
import { BLOCK_KINDS } from "./blocks.mjs"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const sections = (a) => a.pages.flatMap((p) => p.sections.map((s) => ({ ...s, page: p.id })))

test("10 archetypes load and parse", async () => {
  const all = await loadArchetypes()
  assert.deepEqual(Object.keys(all).sort(), ["brand", "commerce", "dashboard", "detail", "landing", "local", "portfolio", "public", "pwa", "saas"])
  assert.deepEqual([...ARCHETYPE_IDS].sort(), Object.keys(all).sort())
  for (const a of Object.values(all)) assert.equal(ArchetypeSchema.safeParse(a).success, true, a.id)
})

test("allowedVariants name real blocks of the same kind", async () => {
  const all = await loadArchetypes()
  const { names, fit } = loadBlockIndex()
  assert.deepEqual(checkArchetypes(all, names, fit), [])
})

test("negative control: unknown block and kind mismatch are reported", () => {
  const bad = { saas: { id: "saas", pages: [{ id: "home", route: "/", sections: [
    { kind: "hero", required: true, importance: 1, allowedVariants: ["block-hero-nope", "block-faq-accordion"], copySlots: [], imageSlots: [] }] }] } }
  const issues = checkArchetypes(bad, new Set(["block-faq-accordion"]))
  assert.equal(issues.length, 2)
  assert.match(issues[0], /block-hero-nope/)
  assert.match(issues[1], /kind/)
})

test("negative control: a block that does not list the archetype is reported when fit is given", () => {
  const one = { brand: { id: "brand", pages: [{ id: "home", route: "/", sections: [
    { kind: "faq", blockKinds: ["faq"], required: false, importance: 2, allowedVariants: ["block-faq-single-accordion"], copySlots: [], imageSlots: [] }] }] } }
  const issues = checkArchetypes(one, new Set(["block-faq-single-accordion"]), new Map([["block-faq-single-accordion", ["saas", "commerce"]]]))
  assert.equal(issues.length, 1)
  assert.match(issues[0], /brand/)
  assert.match(issues[0], /archetypes/)
})

test("negative control on the real data: rebind one section to a block of another kind and it is reported, then restored", async () => {
  const all = await loadArchetypes()
  const { names, fit } = loadBlockIndex()
  const sec = all.saas.pages[0].sections.find((s) => s.kind === "faq")
  const original = [...sec.allowedVariants]
  sec.allowedVariants = [...original, "block-pricing-three-tier-cards"]
  const broken = checkArchetypes(all, names, fit)
  assert.ok(broken.some((m) => /saas\/home\/faq/.test(m) && /kind/.test(m)), broken.join("\n"))
  sec.allowedVariants = [...original, "block-faq-not-a-variant"]
  assert.ok(checkArchetypes(all, names, fit).some((m) => /block-faq-not-a-variant/.test(m)))
  sec.allowedVariants = original
  assert.deepEqual(checkArchetypes(all, names, fit), [])
})

test("completion tier follows owner decision Q2", async () => {
  const all = await loadArchetypes()
  // 2026-09-30 운영자 판정(대장 C44): v0 commerce는 외부 판매처 링크형 → site. 자체 결제는 토스와 함께 v0.2
  for (const id of ["saas", "pwa"]) assert.equal(all[id].completion, "product")
  for (const id of ["local", "portfolio", "brand", "public", "detail", "dashboard", "commerce", "landing"]) assert.equal(all[id].completion, "site")
})

test("priority archetypes carry the lane-D pages (synthesis §4)", async () => {
  const all = await loadArchetypes()
  const kinds = (id) => new Set(all[id].pages.flatMap((p) => p.sections.map((s) => s.kind)))
  for (const k of ["auth", "account", "paywall", "retention", "consent", "onboarding", "confirmation"]) assert.ok(kinds("saas").has(k), `saas ${k}`)
  for (const k of ["review-list", "trust"]) assert.ok(kinds("detail").has(k), `detail ${k}`)
  assert.ok(kinds("local").has("confirmation"))
})

test("saas carries the routes the plan names, and /cancel holds the retention section", async () => {
  const { saas } = await loadArchetypes()
  const routes = Object.fromEntries(saas.pages.map((p) => [p.route, p]))
  for (const r of ["/", "/pricing", "/signup", "/onboarding", "/account", "/billing", "/cancel"]) assert.ok(routes[r], r)
  assert.ok(routes["/cancel"].sections.some((s) => s.kind === "retention" && s.required))
})

test("every section is bound to blocks or says why not (C42·C55) — no silent empty required section", async () => {
  const all = await loadArchetypes()
  let bound = 0, unbound = 0
  for (const a of Object.values(all)) for (const s of sections(a)) {
    const where = `${a.id}/${s.page}/${s.kind}`
    if (s.allowedVariants.length) { bound++; assert.equal(s.noBlock, undefined, where); assert.ok(s.blockKinds.length, where) }
    else {
      unbound++
      assert.ok(s.noBlock?.reason, `${where}: 블록이 없으면 noBlock.reason 이 있어야 한다`)
      assert.deepEqual(s.blockKinds, [], where)
      if (s.noBlock.mode === "pending") assert.ok(s.noBlock.register?.length, `${where}: 블록을 기다리는 섹션은 대장 행이 있어야 한다`)
    }
  }
  assert.ok(bound >= 80, `bound ${bound}`)
  assert.ok(unbound > 0)
})

test("block kinds are real kinds; a section keeps one kind name per page; page ids and routes are unique", async () => {
  const all = await loadArchetypes()
  for (const a of Object.values(all)) {
    assert.equal(new Set(a.pages.map((p) => p.id)).size, a.pages.length, `${a.id} page ids`)
    assert.equal(new Set(a.pages.map((p) => p.route)).size, a.pages.length, `${a.id} routes`)
    for (const p of a.pages) {
      assert.equal(new Set(p.sections.map((s) => s.kind)).size, p.sections.length, `${a.id}/${p.id} section kinds`)
      for (const s of p.sections) for (const k of s.blockKinds) assert.ok(BLOCK_KINDS.includes(k), `${a.id}/${p.id}/${s.kind}: ${k}`)
    }
  }
})

test("bound blocks list the archetype in their own meta (rule a) — no borrowed blocks", async () => {
  const all = await loadArchetypes()
  const { fit } = loadBlockIndex()
  for (const a of Object.values(all)) for (const s of sections(a)) for (const v of s.allowedVariants)
    assert.ok(fit.get(v)?.includes(a.id), `${a.id}/${s.page}/${s.kind}: ${v}`)
})

test("part-mode sections name ui parts that exist", async () => {
  const all = await loadArchetypes()
  const parts = new Set(readdirSync(UI_PARTS_DIR).filter((f) => f.endsWith(".tsx")).map((f) => f.slice(0, -4)))
  for (const a of Object.values(all)) for (const s of sections(a)) if (s.noBlock?.mode === "part") {
    assert.ok(s.noBlock.parts?.length, `${a.id}/${s.kind}`)
    for (const p of s.noBlock.parts) assert.ok(parts.has(p), `${a.id}/${s.kind}: ${p}`)
  }
})

test("noBlock schema: a section may not have both blocks and noBlock, nor neither", async () => {
  const { saas } = await loadArchetypes()
  const base = structuredClone(saas)
  const sec = base.pages[0].sections.find((s) => s.kind === "hero")
  sec.noBlock = { mode: "content", reason: "x" }
  assert.equal(ArchetypeSchema.safeParse(base).success, false, "both")
  delete sec.noBlock
  const no = base.pages[0].sections.find((s) => s.kind === "changelog")
  no.noBlock = undefined
  assert.equal(ArchetypeSchema.safeParse(base).success, false, "neither")
  no.noBlock = { mode: "pending", reason: "블록 없음" }
  assert.equal(ArchetypeSchema.safeParse(base).success, false, "pending without register")
  no.noBlock = { mode: "pending", reason: "블록 없음", register: ["A82"] }
  assert.equal(ArchetypeSchema.safeParse(base).success, true)
})

test("commerce v0 is the external-seller shape: every shop page (cart·checkout·orders) is v0.2 and bound to the cart/account blocks (3a C3)", async () => {
  const { commerce } = await loadArchetypes()
  const SHOP = { cart: ["line-items", "totals", "payment-options"], checkout: ["shipping-payment"], "order-complete": ["receipt"], orders: ["order-list"], "order-detail": ["order"] }
  assert.deepEqual(commerce.pages.filter((p) => p.phase === "v0.2").map((p) => p.id).sort(), Object.keys(SHOP).sort())
  assert.ok(commerce.pages.filter((p) => !(p.id in SHOP)).every((p) => (p.phase ?? "v0") === "v0"), "나머지 쪽은 v0 그대로 — 현재 외부 판매처 링크형 사이트의 출력이 바뀌지 않는다")
  for (const [id, kinds] of Object.entries(SHOP)) {
    const page = commerce.pages.find((p) => p.id === id)
    assert.deepEqual(page.sections.map((s) => s.kind), kinds, id)
    for (const s of page.sections) {
      assert.ok(!s.noBlock, `${id}/${s.kind}: 블록이 있다(예전 pending A60 은 풀렸다)`)
      assert.ok(s.allowedVariants.length > 0, `${id}/${s.kind}`)
    }
  }
  const cart = commerce.pages.find((p) => p.id === "cart")
  assert.deepEqual(cart.sections.map((s) => s.allowedVariants), [["block-cart-lines-table", "block-cart-lines-cards"], ["block-cart-totals-summary"], ["block-cart-checkout-form"]])
  assert.deepEqual(commerce.pages.map((p) => [p.id, p.route]).filter(([id]) => id in SHOP && id !== "cart"), [["checkout", "/checkout"], ["order-complete", "/checkout/complete"], ["orders", "/orders"], ["order-detail", "/orders/[id]"]])
  assert.deepEqual(commerce.pages.find((p) => p.id === "order-detail").sections[0].allowedVariants, ["block-account-order-detail"])
})

test("legal: pages are known legal pages, laws are named per locale, paid saas adds the Paddle terms (en)", async () => {
  const all = await loadArchetypes()
  for (const a of Object.values(all)) {
    assert.ok(a.legal.pages.length > 0, a.id)
    for (const p of a.legal.pages) assert.ok(LEGAL_PAGES.includes(p), `${a.id} ${p}`)
    assert.ok(a.legal.laws.ko.includes("개인정보 보호법"), a.id)
    assert.ok(a.legal.laws.en.includes("GDPR") && a.legal.laws.en.includes("CCPA"), a.id)
  }
  assert.ok(all.saas.legal.laws.en.includes("Paddle Buyer Terms"))
  assert.ok(!all.local.legal.laws.en.includes("Paddle Buyer Terms"))
  assert.deepEqual(all.local.locales, ["ko"])
  assert.deepEqual(all.public.locales, ["ko"])
  for (const id of ["saas", "pwa", "commerce", "detail", "brand", "portfolio", "dashboard", "landing"]) assert.deepEqual(all[id].locales, ["ko", "en"], id)
  // 기존 법적 요건 목록은 legalRequirements 로 남는다(ai/tasks 의 legal)
  for (const a of Object.values(all)) assert.ok(Array.isArray(a.legalRequirements), a.id)
})

test("seo defaults and conversion definitions (C43)", async () => {
  const all = await loadArchetypes()
  for (const a of Object.values(all)) {
    assert.ok(a.seo.titleTemplate.includes("%s"), a.id)
    for (const c of a.conversion) if ((c.phase ?? "v0") === "v0") assert.ok(EVENTS.includes(c.event), `${a.id}: ${c.event}`)
  }
  assert.equal(all.saas.conversion[0].event, "checkout_complete")
  assert.ok(all.saas.conversion.some((c) => c.event === "signup_complete"))
  assert.equal(all.local.conversion[0].event, "cta_click")
  assert.deepEqual(all.local.conversion[0].match.id, ["booking", "tel", "channel"])
  for (const id of ["portfolio", "brand", "public", "landing"]) assert.equal(all[id].conversion[0].event, "form_submit", id)
  // purchase 이벤트는 계약 판 2 에 더해졌다(3a) — 더 이상 v0.2 표시가 아니다
  assert.ok(all.commerce.conversion.some((c) => c.event === "purchase" && c.phase === undefined))
})

test("image slot sources use the four media values (C12) and mediaPlan accepts every archetype", async () => {
  const { mediaPlan } = await import("../stamp/media.mjs")
  const all = await loadArchetypes()
  for (const a of Object.values(all)) {
    for (const s of sections(a)) for (const m of s.imageSlots) assert.ok(["real-required", "stock-ok", "generated-ok", "none"].includes(m.source), `${a.id}/${s.kind}/${m.id}: ${m.source}`)
    assert.doesNotThrow(() => mediaPlan(a, {}, { id: "a", recipe: "r5-celadon" }), a.id)
  }
})

test("the archetype folder holds only archetype JSON, one per archetype id", () => {
  assert.deepEqual(readdirSync(join(ROOT, ARCHETYPE_DIR)).sort(), [...ARCHETYPE_IDS].sort().map((i) => `${i}.json`))
})
