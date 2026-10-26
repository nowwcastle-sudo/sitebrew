// 기능 표 생성기 시험(오프라인). 실제 저장소를 읽어 계산 결과를 대조하고, 원본을 일부러 깨뜨려 던지는지 본다.
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { buildTable, main, OUT, readItems, render, ROOT, readFacts, readSource } from "../gen-outcomes.mjs"

const source = readSource(ROOT)
const facts = readFacts(ROOT)
const table = buildTable(source, facts)
const outcome = (id) => table.outcomes.find((o) => o.id === id)
const broken = (edit) => {
  const s = structuredClone(source)
  edit(s)
  return () => buildTable(s, facts)
}

test("closure: 부품의 @launch-factory/* 런타임 의존 전부 − infra", () => {
  assert.deepEqual(outcome("inquiry").closure, ["analytics-posthog", "consent", "db", "email", "i18n", "security"])
  assert.deepEqual(outcome("signup").closure, ["account-lifecycle", "db", "i18n", "security"])
  assert.deepEqual(outcome("payments").closure, ["db", "email", "i18n", "security"])
  assert.deepEqual(outcome("marketing").closure, ["analytics-posthog", "db", "i18n", "security"])
})

test("guides·requires·product·질문 순서", () => {
  assert.deepEqual(outcome("inquiry").guides, ["G-inquiry", "G-db", "G-email"])
  assert.deepEqual(outcome("payments").requires, ["signup"])
  assert.deepEqual(outcome("shop").guides, ["G-commerce", "G-db", "G-email", "G-payments-kr"])
  assert.deepEqual([outcome("shop").requires, outcome("shop").product, outcome("shop").archetypes], [["signup"], true, ["commerce", "detail"]])
  assert.deepEqual(outcome("signup").requires, [])
  assert.deepEqual([outcome("signup").product, outcome("payments").product, outcome("inquiry").product], [true, true, false])
  assert.deepEqual(table.outcomes.map((o) => o.order), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15])
  assert.deepEqual(outcome("my-requests").requires, ["signup", "inquiry"])
  assert.deepEqual(outcome("my-requests").guides, ["G-inquiry", "G-db", "G-email"])
  assert.deepEqual(outcome("my-requests").archetypes, ["public"])
  assert.ok(table.outcomes.every((o) => o.archetypes.length > 0 && o.say.ko && o.say.en && o.question.ko && o.question.en))
})

test("needs: (parts ∪ closure) 항목의 envVars 합집합 − baseEnv", () => {
  const needs = outcome("inquiry").needs
  assert.ok(needs.includes("RESEND_API_KEY") && needs.includes("INQUIRY_OWNER_EMAIL"))
  assert.ok(!needs.includes("LF_MODE"))
  assert.deepEqual(needs, [...needs].sort())
})

test("쪽 소유표: 주인이 둘인 쪽, 실제로 있는 파일", () => {
  assert.deepEqual(table.pages.find((p) => p.url === "/email").owners, ["auth", "consent"])
  assert.equal(table.pages.find((p) => p.url === "/account/billing/cancel").owners[0], "billing-paddle")
  assert.equal(table.pages.find((p) => p.url === "/refund").file, "app/(legal)/refund/page.tsx")
  assert.equal(table.pages.length, 29)
  // 관리 화면 세 쪽(계획 3d)은 관리 콘솔과 구획을 가진 부품이 함께 소유한다(하나라도 켜면 남는다)
  for (const url of ["/admin", "/admin/[section]", "/admin/[section]/[id]"]) assert.ok(table.pages.find((p) => p.url === url)?.owners.includes("admin-console"), url)
  // 상점 쪽 다섯(계획 3a D2)과 공개 상품 목록(/products, 계획 3d L4)은 commerce 가 소유한다 — 꺼진 상점의 쪽이 출력에 남지 않게 하는 표
  for (const url of ["/products", "/cart", "/checkout", "/checkout/return", "/orders", "/orders/[id]"]) assert.deepEqual(table.pages.find((p) => p.url === url)?.owners, ["commerce"], url)
})

test("경로 소유표: registry meta.launch.routes 에서, cron 은 app/api/cron/ 아래", () => {
  const billing = table.routes.find((r) => r.url === "/api/cron/billing")
  assert.deepEqual([billing.owners, billing.cron, billing.file], [["billing-paddle"], true, "app/api/cron/billing/route.ts"])
  assert.equal(table.routes.find((r) => r.url === "/api/inquiry").cron, false)
  assert.equal(table.routes.filter((r) => r.owners.includes("auth")).length, 3)
})

test("archetypes: landing 은 결제 질문에 있고, 방문자 수 질문은 10종을 명시한다", () => {
  assert.ok(outcome("payments").archetypes.includes("landing"))
  assert.equal(outcome("analytics").archetypes.length, 10)
})

test("hash 는 hash 칸을 뺀 생성본의 sha256 앞 12자", () => {
  assert.match(table.hash, /^[0-9a-f]{12}$/)
  const { hash, ...body } = table
  assert.equal(hash, createHash("sha256").update(JSON.stringify(body, null, 2) + "\n").digest("hex").slice(0, 12))
  assert.equal(render(table), readFileSync(join(ROOT, OUT), "utf8"))
  assert.notEqual(buildTable({ ...structuredClone(source), baseEnv: [] }, facts).hash, table.hash)
})

test("원본 검사: 모르는 것은 던진다", () => {
  assert.throws(broken((s) => s.infra.push("nope")), /nope/)
  assert.throws(broken((s) => s.baseEnv.push("NOT_IN_ANY_ITEM")), /NOT_IN_ANY_ITEM/)
  assert.throws(broken((s) => s.pages[0].files.push("app/(product)/ghost/page.tsx")), /ghost/)
  assert.throws(broken((s) => s.outcomes[0].parts.push("ghost")), /ghost/)
  assert.throws(broken((s) => (s.parts.auth.feature = "feature-ghost")), /feature-ghost/)
  assert.throws(broken((s) => s.parts.auth.guides.push("g-Bad")), /g-Bad/)
  assert.throws(broken((s) => (s.outcomes[1].requires = ["ghost"])), /ghost/)
  assert.throws(broken((s) => s.pages[0].owners.push("ghost")), /ghost/)
  assert.throws(broken((s) => s.outcomes.push({ ...s.outcomes[0] })), /같은 id/)
  assert.throws(broken((s) => delete s.outcomes.find((o) => o.id === "inquiry").say.en), /outcomes\.inquiry\.say\.en/)
  assert.throws(broken((s) => (s.outcomes.find((o) => o.id === "marketing").question.ko = "")), /outcomes\.marketing\.question\.ko/)
})

test("registry 항목에 envVars 배열이 없으면 항목 이름을 대며 던진다", () => {
  const dir = mkdtempSync(join(tmpdir(), "gen-outcomes-items-"))
  try {
    mkdirSync(join(dir, "registry", "feature-x"), { recursive: true })
    writeFileSync(join(dir, "registry", "feature-x", "item.json"), "{}")
    assert.throws(() => readItems(dir), /feature-x/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("--check: 생성본과 같으면 0, 한 글자 다르면 1", () => {
  const dir = mkdtempSync(join(tmpdir(), "gen-outcomes-"))
  try {
    const out = join(dir, "outcomes.generated.json")
    copyFileSync(join(ROOT, OUT), out)
    assert.equal(main(["--check"], ROOT, out), 0)
    writeFileSync(out, readFileSync(out, "utf8").replace('"order": 1', '"order": 9'))
    assert.equal(main(["--check"], ROOT, out), 1)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
