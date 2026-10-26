// 관리 구획 등록부(계획 3d D7): 템플릿에 있는 구획 모듈은 모두 제품 소유 등록부(ADMIN_SECTIONS)에 한 줄씩 올라 있고, 구획의 part 는 outcomes.yaml 부품 이름이다.
import assert from "node:assert/strict"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const ROOT = join(fileURLToPath(import.meta.url), "..", "..", "..")
const DIR = join(ROOT, "template", "lib", "launch", "admin-sections")
const files = readdirSync(DIR).filter((f) => f.endsWith(".ts")).map((f) => f.slice(0, -3)).sort()
const registry = readFileSync(join(ROOT, "template", "lib", "launch", "admin-console.ts"), "utf8")
const outcomes = readFileSync(join(ROOT, "features", "outcomes.yaml"), "utf8")

test("구획 모듈마다 등록부에 import 한 줄과 배열 한 칸이 있다", () => {
  assert.ok(files.length > 0)
  const list = /ADMIN_SECTIONS: readonly AdminSection\[\] = \[([^\]]*)\]/.exec(registry)?.[1] ?? ""
  for (const id of files) {
    const m = new RegExp(`^import (\\w+) from "@/lib/launch/admin-sections/${id}"$`, "m").exec(registry)
    assert.ok(m, `${id}: import 줄 없음`)
    assert.ok(new RegExp(`\\b${m[1]}\\b`).test(list), `${id}: ADMIN_SECTIONS 에 없음`)
  }
})

test("구획의 part 는 outcomes.yaml 의 부품 이름이다", () => {
  for (const id of files) {
    const part = /\bpart:\s*"([^"]+)"/.exec(readFileSync(join(DIR, `${id}.ts`), "utf8"))?.[1]
    assert.ok(part, `${id}: part 없음`)
    assert.ok(new RegExp(`^\\s*-?\\s*${part}:`, "m").test(outcomes) || outcomes.includes(`${part}:`), `${id}: part ${part} 가 outcomes.yaml 에 없음`)
  }
})
