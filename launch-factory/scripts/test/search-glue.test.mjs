// 계획 3c Task 2: 검색 항목의 진짜 조립 파일(lib/launch/search.ts · app/api/search/route.ts · app/api/cron/search/route.ts)과 진짜 DB(PGlite)·서비스를 쓰고,
// 설정·환경·데이터베이스 연결만 대역이다. 색인 파일 읽기 → mock 첫 질의 자동 색인 → live 는 Cron 이 채움 → 잘못된 문서는 아무것도 바꾸지 않음.
import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { registerHooks } from "node:module"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { after, before, test } from "node:test"
import { fileURLToPath, pathToFileURL } from "node:url"
import { count } from "drizzle-orm"
import { db, searchDocuments } from "@launch-factory/db"
import { importRegistryFile, installGlueStubs, stubs } from "./registry-glue.mjs"

const ROOT = fileURLToPath(new URL("../..", import.meta.url))
const REG = (rel) => pathToFileURL(join(ROOT, "registry", rel)).href
const CRON = "Bearer lf-test-cron-secret-not-real"

let d
let mode = "mock"
let variant = 0
const here = process.cwd()
const siteWith = (docs) => {
  const dir = mkdtempSync(join(tmpdir(), "lf-search-"))
  if (docs !== undefined) {
    mkdirSync(join(dir, "content"))
    writeFileSync(join(dir, "content", "search-index.json"), typeof docs === "string" ? docs : JSON.stringify(docs))
  }
  return dir
}
const DOCS = [
  { kind: "page", ref: "about", locale: "ko", title: "회사 소개", body: "무선청소기를 만드는 작은 회사예요.", url: "/about" },
  { kind: "product", ref: "v1", locale: "ko", title: "무선청소기 V1", body: "가볍고 조용해요.", url: "/p/v1" },
]

installGlueStubs({ config: ["DEFAULT_LOCALE"], db: ["database"], env: ["env"], cron: ["cronAuthorized", "unauthorized"] })
// 시험 대상 자신(search 조립 모듈)은 대역이 아니라 진짜 파일이다. variant 로 모듈 캐시를 비켜 서비스를 새로 만든다
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "@/lib/launch/search") return { url: `${REG("feature-search/files/lib/launch/search.ts")}?v=${variant}`, shortCircuit: true }
    return next(specifier, context)
  },
})

before(async () => {
  process.env.CRON_SECRET = "lf-test-cron-secret-not-real"
  d = await db.local()
  stubs.config = { DEFAULT_LOCALE: "ko" }
  stubs.db = { database: async () => d }
  stubs.env = { env: () => ({ LF_MODE: mode }) }
  const cron = await importRegistryFile("_shared/lib/launch/cron.ts")
  stubs.cron = { cronAuthorized: cron.cronAuthorized, unauthorized: cron.unauthorized }
})
after(async () => {
  delete process.env.CRON_SECRET
  process.chdir(here)
  await d?.$client.close()
})

const fresh = async () => {
  variant += 1
  const lib = await import(`${REG("feature-search/files/lib/launch/search.ts")}?v=${variant}`)
  const api = await import(`${REG("feature-search/files/app/api/search/route.ts")}?r=${variant}`)
  const cronRoute = await import(`${REG("feature-search/files/app/api/cron/search/route.ts")}?r=${variant}`)
  return { lib, api, cronRoute }
}
const get = (route, path, headers = {}) => route.GET(new Request(`https://example.test${path}`, { headers: { "x-forwarded-for": "198.51.100.9", ...headers } }))
const n = async () => (await d.select({ n: count() }).from(searchDocuments))[0].n

test("색인 파일이 없으면 빈 색인이다 — 던지지 않고 질의는 빈 결과", async () => {
  process.chdir(siteWith(undefined))
  mode = "mock"
  const { lib, api } = await fresh()
  assert.deepEqual(await lib.loadSearchIndex(), [])
  const res = await get(api, "/api/search?q=%EC%B2%AD%EC%86%8C%EA%B8%B0")
  assert.equal(res.status, 200)
  assert.deepEqual((await res.json()).data, { items: [], total: 0, page: 1, pageCount: 0 })
})

test("mock: 서비스를 처음 만들 때 표가 비었으면 같은 파일로 색인하고, 첫 질의가 바로 결과를 낸다", async () => {
  process.chdir(siteWith(DOCS))
  mode = "mock"
  assert.equal(await n(), 0)
  const { api } = await fresh()
  const res = await get(api, "/api/search?q=%EC%B2%AD%EC%86%8C%EA%B8%B0&kinds=product")
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.deepEqual(body.data.items.map((i) => [i.kind, i.ref, i.url]), [["product", "v1", "/p/v1"]])
  assert.deepEqual(body.data.items[0].snippet.ranges.length, 0, "제목에서만 맞으면 본문 범위는 없다")
  assert.equal(await n(), 2)
})

test("live: 첫 질의가 색인하지 않는다 — Cron(CRON_SECRET)만 채운다. 비밀이 없거나 틀리면 401", async () => {
  await d.delete(searchDocuments)
  process.chdir(siteWith(DOCS))
  mode = "live"
  const { api, cronRoute } = await fresh()
  assert.deepEqual((await (await get(api, "/api/search?q=%EC%B2%AD%EC%86%8C%EA%B8%B0")).json()).data.total, 0)
  assert.equal((await get(cronRoute, "/api/cron/search")).status, 401)
  assert.equal((await get(cronRoute, "/api/cron/search", { authorization: "Bearer wrong" })).status, 401)
  assert.equal(await n(), 0)
  const ok = await get(cronRoute, "/api/cron/search", { authorization: CRON })
  assert.equal(ok.status, 200)
  assert.deepEqual(await ok.json(), { indexed: 2 })
  assert.equal((await (await get(api, "/api/search?q=%EC%B2%AD%EC%86%8C%EA%B8%B0")).json()).data.total, 2)
  // 다시 돌려도 같다(덮어쓴다)
  assert.deepEqual(await (await get(cronRoute, "/api/cron/search", { authorization: CRON })).json(), { indexed: 2 })
  assert.equal(await n(), 2)
})

test("Cron 은 파일에 든 종류만 바꾼다 — 코드로 따로 색인한 종류는 그대로", async () => {
  mode = "live"
  process.chdir(siteWith([DOCS[0]]))
  const { lib, cronRoute } = await fresh()
  const svc = await lib.search()
  await svc.indexDocuments([{ kind: "review", ref: "r1", locale: "ko", title: "후기", url: "/r/1" }])
  assert.deepEqual(await (await get(cronRoute, "/api/cron/search", { authorization: CRON })).json(), { indexed: 1 })
  const kinds = (await d.select().from(searchDocuments)).map((r) => r.kind).sort()
  assert.deepEqual(kinds, ["page", "product", "review"], "파일에 든 page 만 바꾼다 — 앞 시험이 색인한 product 와 코드가 색인한 review 는 그대로")
})

test("잘못된 문서가 하나라도 있으면 색인은 아무것도 바꾸지 않고 던진다 · 배열이 아닌 파일도 던진다", async () => {
  mode = "live"
  const before = await n()
  process.chdir(siteWith([...DOCS, { kind: "page", ref: "bad", locale: "ko", title: "나쁜 주소", body: "", url: "javascript:alert(1)" }]))
  const a = await fresh()
  await assert.rejects(a.lib.reindex(), /url/)
  assert.equal(await n(), before)
  process.chdir(siteWith({ not: "an array" }))
  const b = await fresh()
  await assert.rejects(b.lib.reindex(), /array/)
  process.chdir(siteWith("{ broken json"))
  const c = await fresh()
  await assert.rejects(c.lib.reindex(), SyntaxError)
  assert.equal(await n(), before)
})
