// 관리 화면의 쓰기 제한은 한 곳이다(후속 이중 한도): 서버 액션 adminAct 가 입장 전에 세고, 콘솔 limit 훅은 읽기만 센다.
// 같은 행동을 adminAct 60/분 + admin:write 30/분 두 겹으로 세던 것을 하나로 합쳤다 — 두 번째 셈이 되살아나면 여기서 먼저 깨진다.
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import { RATE_LIMIT_DEFAULTS } from "@launch-factory/security/rate-limit"

const ROOT = join(fileURLToPath(import.meta.url), "..", "..", "..")
const read = (rel) => readFileSync(join(ROOT, rel), "utf8")

test("규칙표에는 쓰기 제한이 adminAct 하나뿐이다", () => {
  assert.deepEqual(RATE_LIMIT_DEFAULTS.adminAct, { max: 30, windowSec: 60 })
  assert.equal(Object.keys(RATE_LIMIT_DEFAULTS).filter((k) => k.startsWith("admin")).sort().join(","), "admin:read,adminAct")
})

for (const rel of ["registry/feature-admin-console/files/lib/launch/admin-console.ts", "template/lib/launch/admin-console.ts"]) {
  test(`${rel}: 콘솔 limit 훅은 읽기만 센다`, () => {
    const src = read(rel)
    const hook = /limit: async \(kind, actor\) => ([^\n]+)\n/.exec(src)?.[1] ?? ""
    assert.match(hook, /kind === "read" \? guardAction\("admin:read"/)
    assert.match(hook, /: null\)/, "쓰기는 null — 세지 않는다")
    assert.equal(src.includes("admin:write"), false)
  })
}

test("adminAct 서버 액션이 입장 전에 한 번 센다", () => {
  const src = read("registry/feature-admin-console/files/app/actions/admin-console.ts")
  assert.equal((src.match(/guardAction\("adminAct"/g) ?? []).length, 1)
})
