// factory/scripts/stamp-core.test.mjs
import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { BriefSchema, briefToSeed } from "../stamp/brief.mjs"
import { openRun } from "../stamp/run-dir.mjs"
import { runDoctor } from "../doctor.mjs"
import { maskSecrets } from "../lib/secret-env.mjs"

const local = { id: "local", pages: [], legal: { pages: ["privacy"], laws: { ko: [], en: [] } } }

test("brief: locale is ko or en only", () => {
  assert.equal(BriefSchema.safeParse({ topic: "t", archetype: "local", locale: "ja", facts: {} }).success, false)
})

test("brief: missing required facts are listed, never invented", () => {
  const { content, missing } = briefToSeed({ topic: "장기요양기관 홈페이지", archetype: "local", locale: "ko", facts: { name: "예시 요양원" } }, local)
  assert.ok(missing.includes("phone"))
  assert.equal(content.business.phone, undefined)
})

test("run-dir: second run with same inputs skips produce; changed inputs re-run", async () => {
  const dir = await mkdtemp(join(tmpdir(), "run-"))
  let calls = 0
  const produce = async () => (++calls, { v: calls })
  await openRun(dir).step("a", "01-direction", { x: 1 }, produce)
  assert.deepEqual(await openRun(dir).step("a", "01-direction", { x: 1 }, produce), { v: 1 })
  assert.deepEqual(await openRun(dir).step("a", "01-direction", { x: 2 }, produce), { v: 2 })
})

test("doctor: missing LAW_API_OC fails legal stage with guidance", async () => {
  const r = await runDoctor("legal", { readSecret: () => null, fetch: async () => { throw new Error("no") } })
  assert.equal(r.ok, false)
  assert.match(r.results.find(x => x.id === "LAW_API_OC").message, /open\.law\.go\.kr/)
})

test("doctor: key present but API returns 0 results fails (positive-consequence check)", async () => {
  const r = await runDoctor("legal", { readSecret: () => "k", fetch: async () => ({ ok: true, json: async () => ({ LawSearch: { totalCnt: "0" } }) }) })
  assert.equal(r.ok, false)
})

test("secrets never appear in logs", () => {
  assert.equal(maskSecrets("x?OC=abc123&q=1", ["abc123"]), "x?OC=***&q=1")
})

// 아래는 위 계획 테스트의 대조군(양성 대조·가림·인자 오류·빈 칸).
test("doctor: positive control — key present and totalCnt ≥ 1 passes, key never echoed", async () => {
  let url = ""
  const r = await runDoctor("legal", { readSecret: () => "sekret7", fetch: async (u) => ((url = u), { ok: true, json: async () => ({ LawSearch: { totalCnt: "2" } }) }) })
  assert.equal(r.ok, true)
  assert.match(url, /lawSearch\.do\?OC=sekret7&target=law&type=JSON&query=/)
  assert.ok(!JSON.stringify(r).includes("sekret7"))
})

test("doctor: a thrown error carrying the key is masked", async () => {
  const r = await runDoctor("legal", { readSecret: () => "sekret7", fetch: async (u) => { throw new Error(`boom ${u}`) } })
  assert.equal(r.ok, false)
  assert.ok(!r.results[0].message.includes("sekret7"))
  assert.match(r.results[0].message, /OC=\*\*\*/)
})

test("doctor: stamp = legal + media; unknown stage throws", async () => {
  const r = await runDoctor("stamp", { readSecret: () => null, isDir: () => false })
  assert.deepEqual(r.results.map((x) => x.id), ["LAW_API_OC", "PEXELS_API_KEY", "HIGGSFIELD_DIR", "3D_OBJECT_HERO"])
  await assert.rejects(runDoctor("nope"))
})

test("doctor CLI: bad stage exits 2", async () => {
  const { spawn } = await import("node:child_process")
  const code = await new Promise((done) => spawn(process.execPath, ["factory/doctor.mjs", "--stage", "nope"], { stdio: "ignore" }).on("close", done))
  assert.equal(code, 2)
})

test("brief: blank facts count as missing; detail maps name → product, seller → business", () => {
  const detail = { id: "detail" }
  const { content, missing } = briefToSeed({ topic: "t", archetype: "detail", locale: "en", facts: { name: "Example mug", seller: "Example Co", price: "  ", bizNo: "123-45-67890" } }, detail)
  assert.deepEqual(missing, ["price"])
  assert.equal(content.product.name, "Example mug")
  assert.equal(content.business.name, "Example Co")
  assert.equal(content.business.bizRegNo, "123-45-67890")
  assert.throws(() => briefToSeed({ topic: "t", archetype: "saas", locale: "ko", facts: {} }, detail))
})

test("run-dir: a half-written step file is rebuilt", async () => {
  const { writeFile, mkdir } = await import("node:fs/promises")
  const dir = await mkdtemp(join(tmpdir(), "run-"))
  await mkdir(join(dir, "a"), { recursive: true })
  await writeFile(join(dir, "a", "02-sitemap.json"), "{\"inputHash\":")
  assert.deepEqual(await openRun(dir).step("a", "02-sitemap", { y: 1 }, async () => ({ ok: 1 })), { ok: 1 })
  await assert.rejects(openRun(dir).step("a", "09-nope", {}, async () => 1))
})
