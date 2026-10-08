// LFSMALL — D17(공용 tsconfig 의 Node 타입)·D52(.env.example 의 Paddle 두 칸).
import assert from "node:assert/strict"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

const ROOT = fileURLToPath(new URL("../..", import.meta.url))
const read = (p) => readFileSync(join(ROOT, p), "utf8")

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (["node_modules", ".next", ".git", "dist"].includes(name)) continue
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(ts|tsx|mts)$/.test(name)) out.push(p)
  }
  return out
}

test("D17: tsconfig.base.json 이 types: [\"node\"] 를 갖고, 소스에 Node 타입 참조 줄이 남아 있지 않다", () => {
  const base = JSON.parse(read("tsconfig.base.json"))
  assert.deepEqual(base.compilerOptions.types, ["node"])
  const refLine = /^\s*\/\/\/\s*<reference\s+types="node"\s*\/>/m
  const left = [...walk(join(ROOT, "packages")), ...walk(join(ROOT, "template")), ...walk(join(ROOT, "registry"))].filter((f) => refLine.test(readFileSync(f, "utf8")))
  assert.deepEqual(left.map((f) => relative(ROOT, f).split("\\").join("/")), [])
})

test("D52: .env.example 에 PADDLE_CLIENT_TOKEN·LF_PADDLE_LIVE 가 값 없이 있고, 각각 설명 주석이 바로 위에 있다", () => {
  const lines = read(".env.example").split(/\r?\n/)
  for (const name of ["PADDLE_CLIENT_TOKEN", "LF_PADDLE_LIVE"]) {
    const i = lines.findIndex((l) => l.startsWith(`${name}=`))
    assert.ok(i > 0, `${name} 줄이 없다`)
    assert.equal(lines[i], `${name}=`, `${name} 은 값을 두지 않는다`)
    assert.match(lines[i - 1], /^#\s*\S/, `${name} 위에 설명 주석이 있어야 한다`)
  }
})
