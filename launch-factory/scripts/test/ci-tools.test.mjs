import assert from "node:assert/strict"
import { test } from "node:test"
import { TOOLS, currentTarget } from "../ci/tools.mjs"

test("도구마다 linux-x64·win32-x64 두 대상이 있고 sha256 은 64자리 16진, 주소는 GitHub 릴리스", () => {
  for (const [name, t] of Object.entries(TOOLS).filter(([k]) => !k.startsWith("_"))) {
    for (const target of ["linux-x64", "win32-x64"]) {
      const x = t.targets?.[target]
      assert.ok(x, `${name} ${target}`)
      assert.match(x.sha256, /^[0-9a-f]{64}$/, `${name} ${target} sha256`)
      assert.match(x.url, /^https:\/\/github\.com\/[^/]+\/[^/]+\/releases\/download\//, `${name} ${target} url`)
    }
  }
})

test("currentTarget: win32 x64 → win32-x64, 모르는 조합은 이유와 함께 던진다", () => {
  assert.equal(currentTarget({ platform: "win32", arch: "x64" }), "win32-x64")
  assert.equal(currentTarget({ platform: "linux", arch: "x64" }), "linux-x64")
  assert.throws(() => currentTarget({ platform: "darwin", arch: "arm64" }), /darwin-arm64/)
})
