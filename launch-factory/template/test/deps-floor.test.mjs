// 알려진 보안 공지가 고쳐진 바닥 판 아래로 내려가지 않게 막는다(제품이 이 템플릿을 그대로 찍어 나간다).
// next 바닥: 16.3.8 — 2026-10-08 공개 6건(GHSA-39w2-rjm5-chcv · 3w37-wq28-93x7 · 4jqv-mc3x-m676 · cjq9-62q9-8jv4(CVSS 8.3) · f87g-xv8r-7p7x · mcj8-r9mp-w47p), CI OSV 가 잡았다.
import assert from "node:assert/strict"
import { test } from "node:test"
import { readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const json = (p) => JSON.parse(readFileSync(join(ROOT, p), "utf8"))
const gte = (a, b) => {
  const [x, y] = [a.split(".").map(Number), b.split(".").map(Number)]
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i]
  return true
}
const FLOOR = { next: "16.3.8" }

test("템플릿 의존이 보안 바닥 판 이상이고 정확한 판으로 고정돼 있다(잠금 파일도 같다)", () => {
  const pkg = json("template/package.json")
  const lock = json("package-lock.json")
  for (const [name, floor] of Object.entries(FLOOR)) {
    const v = pkg.dependencies[name]
    assert.match(v, /^\d+\.\d+\.\d+$/, `${name} 는 정확한 판(${v})`)
    assert.ok(gte(v, floor), `${name} ${v} < ${floor}`)
    for (const [k, p] of Object.entries(lock.packages)) if (k.endsWith(`node_modules/${name}`)) assert.ok(gte(p.version, floor), `잠금 ${k} ${p.version} < ${floor}`)
  }
})
