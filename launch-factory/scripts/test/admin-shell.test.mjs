// 관리 셸(계획 3d L1)의 순수 부분 — 포트 → 블록 모양 매핑(lib/launch/to-blocks.ts) · 주소 값 검사(lib/admin-params.ts) · 쪽 파일·문구·소유·noindex 약속.
// 브라우저·서버 없이 돈다. 실제 화면 관문은 `npm run template:screens`.
import assert from "node:assert/strict"
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"
import { fileURLToPath, pathToFileURL } from "node:url"
import YAML from "yaml"

const ROOT = fileURLToPath(new URL("../..", import.meta.url))
const read = (rel) => readFileSync(join(ROOT, rel), "utf8")
const toBlocks = await import(pathToFileURL(join(ROOT, "template/lib/launch/to-blocks.ts")).href)
const params = await import(pathToFileURL(join(ROOT, "template/lib/admin-params.ts")).href)

// ── 매핑 ──────────────────────────────────────────────────────────────────────────────────

const table = {
  columns: [
    { id: "name", label: "Name", kind: "text", primary: true },
    { id: "email", label: "Email", kind: "contact", secondary: true },
    { id: "status", label: "Status", kind: "status", filter: true, sortable: true },
    { id: "total", label: "Total", kind: "numeric" },
  ],
  rows: [{ id: "r1", cells: { name: "Kim", email: "k***@example.com", status: "open", total: 12 }, href: "/admin/orders/r1" }, { id: "r2", cells: { name: "Lee", email: null, status: "done", total: 3 } }],
  total: 2,
}

test("toTableData — 열·행을 그대로 옮기고 contact 열은 text 로 읽는다", () => {
  const out = toBlocks.toTableData(table)
  assert.deepEqual(out.columns.map((c) => [c.id, c.kind]), [["name", "text"], ["email", "text"], ["status", "status"], ["total", "numeric"]])
  assert.equal(out.columns[0].primary, true)
  assert.equal(out.columns[1].secondary, true)
  assert.equal(out.columns[2].filter, true)
  assert.equal(out.columns[2].sortable, true)
  assert.deepEqual(out.rows[0], { id: "r1", cells: table.rows[0].cells, href: "/admin/orders/r1" })
  assert.deepEqual(Object.keys(out.rows[1]), ["id", "cells"], "href 가 없으면 키도 없다")
  assert.equal(toBlocks.statusColumnOf(table), "status")
  assert.equal(toBlocks.statusColumnOf({ ...table, columns: table.columns.slice(0, 2) }), null)
})

test("toRecordData — 칸 종류 number 는 text 로, 요약·행동은 그대로", () => {
  const record = {
    id: "r1",
    title: "Order r1",
    summary: [{ label: "Status", value: "open", kind: "status" }, { label: "Note", value: "x" }],
    fields: [{ name: "qty", label: "Qty", type: "number", value: "3", required: true }, { name: "memo", label: "Memo", type: "textarea", value: "" }, { name: "mail", label: "Mail", value: "a@example.com" }],
    save: "edit",
    actions: [{ id: "advance", label: "Mark shipped" }],
    danger: { id: "cancel", label: "Cancel order" },
  }
  const out = toBlocks.toRecordData(record)
  assert.deepEqual(out.fields.map((f) => [f.name, f.type, f.required === true]), [["qty", "text", true], ["memo", "textarea", false], ["mail", "text", false]])
  assert.deepEqual(out.summary, [{ label: "Status", value: "open", kind: "status" }, { label: "Note", value: "x" }])
  assert.deepEqual(toBlocks.toRecordActions(record), [{ id: "advance", label: "Mark shipped" }])
})

test("toDashboardData — 할 일 → 행동 목록·1순위, 변화 → KPI(변화 = 값 − 이전 값), 아무것도 없으면 null", () => {
  const overview = {
    asOf: "2026-10-22T15:00:00.000Z",
    todo: [{ id: "ship", severity: "critical", title: "Orders to ship", detail: "Oldest waiting 2 days", href: "/admin/orders", count: 3 }, { id: "reply", severity: "warning", title: "Messages", href: "/admin/inquiries", count: 1 }],
    metrics: [{ id: "orders", label: "Orders", value: 12, previous: 9, unit: "orders", comparePeriod: "last 7 days" }],
  }
  const out = toBlocks.toDashboardData(overview, { openLabel: "Open" })
  assert.match(out.asOf, /Oct 22, 2026/)
  assert.match(out.asOf, /UTC/)
  assert.deepEqual(out.kpis[0], { id: "orders", label: "Orders", value: 12, unit: "orders", baseline: { comparePeriod: "last 7 days" }, delta: 3, rank: 1 })
  assert.equal(out.focus.title, "Orders to ship (3)")
  assert.deepEqual(out.focus.action, { label: "Open", href: "/admin/orders" })
  assert.deepEqual(out.actions.map((a) => [a.id, a.severity, a.title, a.recordUrl]), [["ship", "critical", "Orders to ship (3)", "/admin/orders"], ["reply", "warning", "Messages (1)", "/admin/inquiries"]])
  assert.equal(out.actions[1].detail, undefined)
  assert.equal(toBlocks.toDashboardData({ asOf: overview.asOf, todo: [], metrics: [] }, { openLabel: "Open" }), null)
  // 변화만 있어도 그린다(할 일 없음 — 1순위·행동 목록 키는 없다)
  const onlyMetrics = toBlocks.toDashboardData({ ...overview, todo: [] }, { openLabel: "Open" })
  assert.equal(onlyMetrics.kpis.length, 1)
  assert.equal("focus" in onlyMetrics, false)
  assert.equal("actions" in onlyMetrics, false)
})

test("toSidebarItems — 개요가 첫 항목이고 구획은 id 로 아이콘을 고른다(모르면 문서 아이콘)", () => {
  const items = toBlocks.toSidebarItems([{ id: "orders", label: "Orders", href: "/admin/orders" }, { id: "bookings", label: "Bookings", href: "/admin/bookings" }, { id: "custom", label: "Custom", href: "/admin/custom" }], "Overview")
  assert.deepEqual(items, [
    { label: "Overview", href: "/admin", icon: "home" },
    { label: "Orders", href: "/admin/orders", icon: "orders" },
    { label: "Bookings", href: "/admin/bookings", icon: "calendar" },
    { label: "Custom", href: "/admin/custom", icon: "file" },
  ])
})

// ── 주소 값 ───────────────────────────────────────────────────────────────────────────────

test("parsePage — 1~10000 정수 글자만 받고, 틀리거나 비면 1쪽", () => {
  assert.equal(params.parsePage("3"), 3)
  assert.equal(params.parsePage(" 12 "), 12)
  assert.equal(params.parsePage(["4", "9"]), 4)
  assert.equal(params.parsePage("10000"), 10000)
  for (const bad of [undefined, "", "0", "-1", "1.5", "abc", "10001", "99999", "123456", "1e3", "٣"]) assert.equal(params.parsePage(bad), 1, String(bad))
})

test("주소 값 — 모양이 맞는 것만 통과한다", () => {
  assert.equal(params.parseSectionId("orders"), "orders")
  assert.equal(params.parseSectionId("my-section-2"), "my-section-2")
  for (const bad of ["", "Orders", "-x", "a b", "a/b", "../x", "x".repeat(41), undefined, ["orders"]]) assert.equal(params.parseSectionId(bad), null, String(bad))
  assert.equal(params.parseRecordId("ord_123-AB"), "ord_123-AB")
  for (const bad of ["", "_x", "a b", "a/b", "a%2Fb", "x".repeat(81), undefined]) assert.equal(params.parseRecordId(bad), null, String(bad))
  assert.equal(params.parseSearch("  kim  "), "kim")
  assert.equal(params.parseSearch(["a", "b"]), "a")
  assert.equal(params.parseSearch("   "), undefined)
  assert.equal(params.parseSearch("a\u0000b\nc"), "a b c")
  assert.equal(params.parseSearch("x".repeat(300)).length, 100)
  assert.equal(params.parseStatus("open"), "open")
  assert.equal(params.parseStatus("a b"), undefined)
  assert.equal(params.parseStatus("<script>"), undefined)
})

// ── 쪽·문구·소유·noindex ──────────────────────────────────────────────────────────────────

const PAGES = ["app/(product)/admin/page.tsx", "app/(product)/admin/[section]/page.tsx", "app/(product)/admin/[section]/[id]/page.tsx"]

test("쪽 파일 — 개요·구획·기록 세 쪽과 틀이 있고 모두 색인하지 않는다", () => {
  for (const p of [...PAGES, "app/(product)/admin/layout.tsx"]) {
    assert.ok(existsSync(join(ROOT, "template", p)), p)
    assert.match(read(`template/${p}`), /robots:\s*\{\s*index:\s*false/, `${p} 에 noindex 메타`)
  }
})

test("쪽·틀은 신원을 읽지 않는다 — role·userId 는 서버 액션과 콘솔의 몫이고 쪽은 결과만 그린다", () => {
  for (const p of [...PAGES, "app/(product)/admin/layout.tsx", "template/components/product/admin-screens.tsx", "template/components/product/admin-blocks.tsx"].map((x) => (x.startsWith("template/") ? x : `template/${x}`))) {
    const src = read(p)
    assert.doesNotMatch(src.replace(/\brole="[a-z]+"/g, ""), /\b(role|userId|isAdmin|impersonatedBy)\b/, `${p} 가 신원 값을 읽는다`)
    assert.doesNotMatch(src, /@launch-factory\/db|from "drizzle-orm"/, `${p} 가 DB 를 직접 부른다`)
  }
})

test("확인 입력 — confirmed: true 는 위험 행동 제거 하나에서만 싣는다", () => {
  const src = read("template/components/product/admin-blocks.tsx")
    .split("\n")
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .join("\n")
  const hits = src.match(/confirmed:\s*true/g) ?? []
  assert.equal(hits.length, 1)
  assert.match(src, /action:\s*record\.danger\.id,\s*confirmed:\s*true/)
})

test("소유 — /admin 쪽은 outcomes.yaml 에 있고 관리 콘솔과 구획을 가진 부품이 주인이다, layout 은 목록에 없다", () => {
  const outcomes = YAML.parse(read("features/outcomes.yaml"))
  assert.ok(outcomes.parts["admin-console"], "parts.admin-console")
  assert.equal(outcomes.parts["admin-console"].feature, "feature-admin-console")
  const entry = outcomes.pages.find((p) => p.files.includes("app/(product)/admin/page.tsx"))
  assert.ok(entry, "pages 항목")
  assert.deepEqual(entry.files.sort(), [...PAGES].sort())
  for (const owner of ["admin-console", "auth", "commerce", "booking", "inquiry", "reviews", "newsletter"]) assert.ok(entry.owners.includes(owner), owner)
  assert.ok(!entry.files.some((f) => /layout/.test(f)))
})

test("구획 부품 이름 — 구획 모듈(lib/launch/admin-sections/*.ts)의 part 는 모두 outcomes.yaml 의 부품 이름이다", () => {
  const outcomes = YAML.parse(read("features/outcomes.yaml"))
  const dir = join(ROOT, "template/lib/launch/admin-sections")
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".ts")) : []
  for (const f of files) {
    const part = /\bpart:\s*"([a-z0-9-]+)"/.exec(read(`template/lib/launch/admin-sections/${f}`))?.[1]
    assert.ok(part, `${f}: part 를 찾지 못했다`)
    assert.ok(outcomes.parts[part], `${f}: part "${part}" 는 outcomes.yaml 부품 이름이 아니다`)
  }
  // 등록부는 구획 모듈을 import 하는 한 줄씩만 더한다(wave 2 전에는 비어 있다)
  assert.match(read("template/lib/launch/admin-console.ts"), /ADMIN_SECTIONS:\s*readonly AdminSection\[\]\s*=/)
})

test("noindex — proxy 머리 목록에 /admin 이 있고 공개 쪽 목록에는 없다", () => {
  assert.match(read("template/lib/seo.ts"), /NOINDEX_PREFIXES[\s\S]*?"\/admin"/)
  const publicPaths = JSON.parse(read("template/lib/public-paths.json"))
  assert.ok(!publicPaths.some((p) => p === "/admin" || p.startsWith("/admin/")))
})

test("url-map — /admin 줄: 템플릿이 이기고 관리 기능을 안 고르면 시안 쪽을 쓴다", () => {
  const row = JSON.parse(read("scripts/compose/url-map.json")).rows.find((r) => r.site === "/admin")
  assert.deepEqual(row, { site: "/admin", template: "/admin", winner: "template", siteWhenOff: true })
})

test("패키징 — 부품 admin-console 의 항목 파일이 템플릿에 설치돼 있고, 구획 등록부는 제품 소유(OWNED)다", () => {
  const item = JSON.parse(read("registry/feature-admin-console/item.json"))
  const targets = item.files.filter((f) => f.startsWith("files/")).map((f) => f.slice("files/".length))
  for (const t of ["lib/launch/admin-identity.ts", "lib/launch/admin-console.ts", "app/actions/admin-console.ts"]) assert.ok(targets.includes(t), t)
  for (const t of targets) assert.ok(existsSync(join(ROOT, "template", t)), `template/${t}`)
  assert.match(read("scripts/template-sync.mjs"), /"lib\/launch\/admin-console\.ts"/)
  assert.ok(item.registryDependencies.includes("feature-security"))
})

test("문구 — 거절 사유마다 한 줄이 있고 CSV 내려받기는 연결하지 않았다", async () => {
  const copy = await import(pathToFileURL(join(ROOT, "template/content/copy.admin.en.ts")).href).catch(() => null)
  // 문구 모듈은 블록 형식을 import 하지만 값 export 는 순수 객체라 node 에서 읽힌다
  if (!copy) return assert.match(read("template/content/copy.admin.en.ts"), /adminDenied/)
  for (const k of ["forbidden", "two_factor_required", "impersonation_blocked", "provider_unavailable", "nothing", "other"]) assert.ok(copy.adminDenied[k]?.length > 10, k)
  assert.equal("export" in copy.listCopy, false)
  assert.doesNotMatch(read("template/components/product/admin-blocks.tsx"), /export:/)
})
