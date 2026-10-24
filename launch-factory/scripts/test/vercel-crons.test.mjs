// 템플릿의 Cron 경로(app/api/cron/*)는 vercel.json crons 에 모두 있어야 한다 — 빠지면 그 일(파기·색인·만료 정리)이 조용히 돌지 않는다.
import assert from "node:assert/strict"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const TEMPLATE = fileURLToPath(new URL("../../template", import.meta.url))
const routes = readdirSync(join(TEMPLATE, "app/api/cron"), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => `/api/cron/${e.name}`)
const crons = JSON.parse(readFileSync(join(TEMPLATE, "vercel.json"), "utf8")).crons

test("Cron 경로마다 vercel.json 에 일정이 하나 있다", () => {
  assert.ok(routes.length >= 10)
  for (const path of routes) assert.equal(crons.filter((c) => c.path === path).length, 1, `${path} 일정이 없거나 둘 이상이다`)
  assert.deepEqual(crons.map((c) => c.path).filter((p) => !routes.includes(p)), [], "vercel.json 에 있는데 경로 파일이 없는 Cron")
})

test("일정은 5칸 cron 식이다", () => {
  for (const c of crons) assert.match(c.schedule, /^(\S+ ){4}\S+$/, c.path)
})
