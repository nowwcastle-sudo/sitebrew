// gitleaks 트리 검사가 푸는 사본은 커밋 바이트 그대로(LF)여야 한다.
// Windows 기본 core.autocrlf=true 에서 git archive 가 CRLF 로 바꿔 쓰면, 빈 값 줄 `KEY=` 뒤의
// 다음 줄 변수 이름을 generic-api-key 가 값으로 읽어 .env.example 이 오탐된다(v0.2.7 릴리스 검증에서 실측).
import { test } from "node:test"
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { extractTree } from "../ci/run-steps.mjs"

const git = (cwd, ...args) => {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" })
  assert.equal(r.status, 0, `git ${args.join(" ")}: ${r.stderr}`)
}

test("extractTree: core.autocrlf=true 저장소에서도 커밋 바이트(LF) 그대로 푼다", () => {
  const repo = mkdtempSync(join(tmpdir(), "lf-eol-repo-"))
  const out = mkdtempSync(join(tmpdir(), "lf-eol-out-"))
  try {
    git(repo, "init", "-q")
    git(repo, "config", "core.autocrlf", "true")
    git(repo, "config", "user.email", "test@example.invalid")
    git(repo, "config", "user.name", "test")
    writeFileSync(join(repo, ".env.example"), "SAMPLE_API_KEY=\nSAMPLE_API_SECRET=\n")
    git(repo, "add", ".env.example")
    git(repo, "commit", "-q", "-m", "seed")

    assert.equal(extractTree(repo, out), null)
    assert.equal(readFileSync(join(out, ".env.example"), "utf8"), "SAMPLE_API_KEY=\nSAMPLE_API_SECRET=\n")
  } finally {
    rmSync(repo, { recursive: true, force: true })
    rmSync(out, { recursive: true, force: true })
  }
})
