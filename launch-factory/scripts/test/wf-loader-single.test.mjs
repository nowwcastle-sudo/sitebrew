// D195: 적합성 묶음을 꺼내는 곳은 scripts/lib/wf-conformance.mjs 하나다 — 패키지 시험이 자기 로더를 다시 만들지 못한다.
import assert from "node:assert/strict"
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import { WF_CONFORMANCE_COMMIT } from "../lib/wf-conformance.mjs"

const root = fileURLToPath(new URL("../..", import.meta.url))

test("D195: 적합성 로더는 하나이고 한 커밋(해시)에 고정돼 있다", () => {
  assert.match(WF_CONFORMANCE_COMMIT, /^[0-9a-f]{40}$/, "브랜치 이름이 아니라 커밋 해시")
  const tests = []
  for (const pkg of readdirSync(join(root, "packages"))) {
    const dir = join(root, "packages", pkg, "test")
    if (existsSync(dir)) for (const f of readdirSync(dir)) tests.push(join(dir, f))
  }
  for (const f of tests) {
    assert.doesNotMatch(f, /load-conformance/, `${f}: 로더는 scripts/lib/wf-conformance.mjs 하나`)
    if (!/\.(mjs|ts)$/.test(f)) continue
    const src = readFileSync(f, "utf8")
    assert.ok(!/["']show["']/.test(src), `${f}: web-factory 파일을 git show 로 직접 꺼내지 않는다`)
    assert.ok(!/LF_WF_CONFORMANCE_REF|WEB_FACTORY_DIR/.test(src), `${f}: 저장소·커밋 설정은 로더의 LF_WF_REPO·LF_WF_CONFORMANCE_COMMIT 하나`)
  }
  // 적합성 묶음을 쓰는 다섯 시험 파일이 모두 공용 로더를 부른다(결제 둘·계측·동의(알림)·인증)
  const users = tests.filter((f) => readFileSync(f, "utf8").includes("lib/wf-conformance.mjs"))
  assert.equal(users.length, 5, users.join("\n"))
})
