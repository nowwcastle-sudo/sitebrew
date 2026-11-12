import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { TOOLS, currentTarget, fetchTool } from "../ci/tools.mjs"

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

test("fetchTool: 기본 다운로드가 실패하면 공개 REST asset 을 받고 같은 SHA-256 으로 검사한다", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "ci-tools-rest-"))
  const oldDir = process.env.LF_CI_TOOLS_DIR
  process.env.LF_CI_TOOLS_DIR = dir
  const x = TOOLS["osv-scanner"].targets["linux-x64"]
  const sha = x.sha256
  t.after(() => {
    if (oldDir === undefined) delete process.env.LF_CI_TOOLS_DIR
    else process.env.LF_CI_TOOLS_DIR = oldDir
    x.sha256 = sha
    rmSync(dir, { recursive: true, force: true })
  })
  const bytes = Buffer.from("고정 도구 대조")
  const fetch = t.mock.method(globalThis, "fetch", async (url) => (
    url === x.url ? new Response(null, { status: 504 }) : new Response(bytes)
  ))
  await assert.rejects(fetchTool("osv-scanner", "linux-x64"), /sha256 불일치/)
  assert.deepEqual(fetch.mock.calls.map(({ arguments: [url] }) => url), [x.url, x.restUrl])
  assert.equal(fetch.mock.calls[1].arguments[1].headers.Accept, "application/octet-stream")
  x.sha256 = createHash("sha256").update(bytes).digest("hex")
  const bin = await fetchTool("osv-scanner", "linux-x64")
  assert.deepEqual(readFileSync(bin), bytes)
})

test("currentTarget: win32 x64 → win32-x64, 모르는 조합은 이유와 함께 던진다", () => {
  assert.equal(currentTarget({ platform: "win32", arch: "x64" }), "win32-x64")
  assert.equal(currentTarget({ platform: "linux", arch: "x64" }), "linux-x64")
  assert.throws(() => currentTarget({ platform: "darwin", arch: "arm64" }), /darwin-arm64/)
})
