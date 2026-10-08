// .githooks/pre-commit · pre-push 시험 — gitleaks 는 설치하지 않으므로 가짜 실행 파일(받은 인자를 적고 정해 둔 종료 코드로 끝난다)로 시험한다.
// 양성 대조: 가짜 gitleaks 가 1(유출 발견)로 끝나면 훅이 실패한다 · 도구가 없으면 설치 방법을 알리고 통과한다 · 인자가 gitleaks 8.30.1 의 실제 플래그다(git --staged · --log-opts).
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { chmodSync, copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { resolveTool } from "../ci/tools.mjs"
import { findSh } from "./posix-sh.mjs"

const ROOT = fileURLToPath(new URL("../..", import.meta.url))
const toSh = (p) => p.replace(/\\/g, "/")
// 훅은 sh 스크립트다 — 셸은 scripts/test/posix-sh.mjs 가 찾는다(PATH 의 sh → Git for Windows 의 sh.exe). 어디에도 없으면 이유를 적어 건너뛴다.
const SH = findSh()
const noSh = SH ? false : "POSIX 셸(sh)을 못 찾았다 — PATH 에 sh 가 없고 Git for Windows 의 bin\\sh.exe·usr\\bin\\sh.exe 도 없다(git --exec-path 기준). Git for Windows 를 설치하거나 PATH 에 sh 를 둔다"

function setup() {
  const tmp = mkdtempSync(join(tmpdir(), "lf-hooks-"))
  const log = join(tmp, "args.log")
  const stub = join(tmp, "gitleaks-stub")
  writeFileSync(stub, `#!/bin/sh\necho "$@" >> "${toSh(log)}"\nexit "\${STUB_EXIT:-0}"\n`)
  chmodSync(stub, 0o755)
  // 훅이 git rev-parse 를 부르므로 임시 저장소를 만든다
  const git = spawnSync("git", ["init", "-q", tmp], { encoding: "utf8" })
  assert.equal(git.status, 0, git.stderr)
  writeFileSync(join(tmp, ".gitleaks.toml"), "title = 't'\n")
  return { tmp, log, stub: toSh(stub) }
}
const hook = (name) => join(ROOT, ".githooks", name)
const runHook = (name, ctx, { env = {}, input = "" } = {}) => spawnSync(SH, [toSh(hook(name))], { cwd: ctx.tmp, input, encoding: "utf8", env: { ...process.env, ...env } })

test("pre-commit: gitleaks 가 있으면 git --staged 로 스테이징한 변경을 훑고, 유출 발견(종료 1)이면 커밋을 막는다", { skip: noSh }, () => {
  const ctx = setup()
  try {
    const ok = runHook("pre-commit", ctx, { env: { LF_GITLEAKS_BIN: ctx.stub, STUB_EXIT: "0" } })
    assert.equal(ok.status, 0, ok.stderr)
    const args = readFileSync(ctx.log, "utf8")
    assert.match(args, /^git --staged --config \S+\.gitleaks\.toml --redact --no-banner --verbose /m)
    const leak = runHook("pre-commit", ctx, { env: { LF_GITLEAKS_BIN: ctx.stub, STUB_EXIT: "1" } })
    console.log("  양성 대조 pre-commit(유출 발견):", "종료", leak.status)
    assert.equal(leak.status, 1)
  } finally {
    rmSync(ctx.tmp, { recursive: true, force: true })
  }
})

test("pre-commit·pre-push: gitleaks 가 없으면 설치 방법을 알리고 통과시킨다(설치하지 않는다)", { skip: noSh }, () => {
  const ctx = setup()
  try {
    for (const name of ["pre-commit", "pre-push"]) {
      const r = runHook(name, ctx, { env: { LF_GITLEAKS_BIN: "/nonexistent/gitleaks" } })
      assert.equal(r.status, 0, `${name}: ${r.stderr}`)
      assert.match(r.stderr, /winget install Gitleaks\.Gitleaks/)
      assert.match(r.stderr, /scoop install gitleaks/)
    }
  } finally {
    rmSync(ctx.tmp, { recursive: true, force: true })
  }
})

test("pre-push: 올리는 범위를 --log-opts 로 넘기고(새 가지는 원격에 없는 커밋만), 가지 삭제는 건너뛰며, 유출 발견이면 푸시를 막는다", { skip: noSh }, () => {
  const ctx = setup()
  const zero = "0".repeat(40)
  const a = "a".repeat(40)
  const b = "b".repeat(40)
  try {
    const input = `refs/heads/x ${a} refs/heads/x ${b}\nrefs/heads/new ${a} refs/heads/new ${zero}\n(delete) ${zero} refs/heads/gone ${b}\n`
    const ok = runHook("pre-push", ctx, { env: { LF_GITLEAKS_BIN: ctx.stub, STUB_EXIT: "0" }, input })
    assert.equal(ok.status, 0, ok.stderr)
    const lines = readFileSync(ctx.log, "utf8").trim().split("\n")
    assert.equal(lines.length, 2, "삭제 줄은 건너뛴다")
    assert.match(lines[0], new RegExp(`--log-opts=${b}\\.\\.${a}`))
    assert.match(lines[1], new RegExp(`--log-opts=${a} --not --remotes`))
    const leak = runHook("pre-push", ctx, { env: { LF_GITLEAKS_BIN: ctx.stub, STUB_EXIT: "1" }, input })
    console.log("  양성 대조 pre-push(유출 발견):", "종료", leak.status)
    assert.equal(leak.status, 1)
  } finally {
    rmSync(ctx.tmp, { recursive: true, force: true })
  }
})

test("훅 파일은 LF 줄끝이고 실행 비트가 git 에 기록돼 있다", () => {
  for (const name of ["pre-commit", "pre-push"]) {
    assert.ok(!readFileSync(hook(name), "utf8").includes("\r"), `${name}: CRLF`)
    const r = spawnSync("git", ["ls-files", "--stage", `.githooks/${name}`], { cwd: ROOT, encoding: "utf8" })
    assert.match(r.stdout, /^100755 /, `${name}: 실행 비트(100755)가 없다 — git update-index --chmod=+x`)
  }
})

// 진짜 gitleaks 로 훅을 돌린다. 위 시험의 가짜 실행 파일은 인자 모양만 본다 — 여기서는 심은 가짜 키가 훅을 거쳐 커밋을 실제로 막는지(양성 대조)와
// 평범한 파일이 통과하는지(음성 대조)를 본다. 가짜 값은 실행 때 조각을 이어 만든다(이 파일이 비밀값 모양을 담지 않게).
// gitleaks 가 없으면: CI·LF_CI_REQUIRE_TOOLS=1 에서는 실패, 그 밖에서는 이유를 적고 건너뛴다.
const REQUIRE = process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true" || process.env.LF_CI_REQUIRE_TOOLS === "1"
const realGitleaks = resolveTool("gitleaks")
const noGitleaks = realGitleaks || REQUIRE ? false : "gitleaks 실행 파일이 없다(PATH·scripts/ci/tools.json 받은 폴더 모두) — 설치하면 이 시험이 돈다"

test("pre-commit: 진짜 gitleaks 로 — 스테이징한 가짜 AWS 키는 커밋을 막고(종료 1), 평범한 파일은 통과한다", { skip: noSh || noGitleaks }, () => {
  assert.ok(realGitleaks, "CI·LF_CI_REQUIRE_TOOLS=1 에서는 gitleaks 가 있어야 한다")
  const ctx = setup()
  try {
    copyFileSync(join(ROOT, ".gitleaks.toml"), join(ctx.tmp, ".gitleaks.toml"))
    const env = { LF_GITLEAKS_BIN: toSh(realGitleaks.path) }
    const key = ["AKIA", "QJ4XM7HT2ZRB6WNP"].join("")
    writeFileSync(join(ctx.tmp, "leak.env"), `aws_access_key_id = ${key}\naws_region = us-east-1\n`)
    assert.equal(spawnSync("git", ["add", "leak.env"], { cwd: ctx.tmp }).status, 0)
    const leak = runHook("pre-commit", ctx, { env })
    const out = `${leak.stdout}${leak.stderr}`
    console.log("  양성 대조 pre-commit(진짜 gitleaks, 가짜 키):", "종료", leak.status)
    assert.equal(leak.status, 1, out)
    assert.match(out, /aws-access-token/)
    assert.ok(!out.includes(key), "--redact 인데 값이 출력에 나왔다")
    assert.equal(spawnSync("git", ["rm", "--cached", "-q", "leak.env"], { cwd: ctx.tmp }).status, 0)
    writeFileSync(join(ctx.tmp, "readme.txt"), "비밀값 없는 평범한 글\n")
    assert.equal(spawnSync("git", ["add", "readme.txt"], { cwd: ctx.tmp }).status, 0)
    const clean = runHook("pre-commit", ctx, { env })
    assert.equal(clean.status, 0, `${clean.stdout}${clean.stderr}`)
  } finally {
    rmSync(ctx.tmp, { recursive: true, force: true })
  }
})
