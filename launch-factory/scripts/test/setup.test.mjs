// npm run setup: 도구가 빠지면 어떤 문구와 종료 코드를 내는가. 실제 프로세스 시험 1개 + 가짜 환경 시험.
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { dirname } from "node:path"
import { test } from "node:test"
import { atLeast, realCtx, render, ROOT, runSetup } from "../setup.mjs"

const GB = 1024 ** 3
const PKG = { name: "demo", engines: { node: ">=24.13.0", npm: ">=11.6.2" } }

/** 모든 도구가 있고 아무 파일도 없는 가짜 환경. over 로 한 가지씩 바꾼다. */
function fake(over = {}) {
  const calls = { run: [], npmCi: 0 }
  const answer = over.run ?? ((cmd) => ({ status: 0, stdout: cmd === "npm" ? "11.6.2" : "ok" }))
  const ctx = {
    root: "/demo",
    platform: "win32",
    env: {},
    nodeVersion: "v24.13.0",
    exists: () => false,
    freeBytes: () => 8 * GB,
    readJson: () => PKG,
    isLink: () => false,
    mtime: () => 1,
    npmCi: () => (calls.npmCi++, { status: 0, stdout: "" }),
    wfCheckout: async () => ({ ok: true, detail: "wf" }),
    ...over,
    run: (cmd, args = []) => (calls.run.push([cmd, ...args].join(" ")), answer(cmd, args)),
  }
  return { ctx, calls }
}

test("git 이 없으면 이 OS 의 설치 명령을 알리고 종료 코드 1", async () => {
  const { ctx, calls } = fake({ run: (cmd) => ({ status: cmd === "git" ? 1 : 0, stdout: "11.6.2" }), exists: (p) => p.endsWith("package-lock.json") })
  const r = await runSetup(ctx)
  const out = render(r, ctx)
  assert.equal(r.code, 1)
  assert.match(out, /✘ git\s+없음/)
  assert.match(out, /→ winget install Git\.Git/)
  assert.match(out, /^setup: FAIL — 필수 누락 1\(git\)/m)
  assert.equal(calls.npmCi, 0, "필수가 빠지면 npm ci 를 돌리지 않는다")
})

test("OS 별 설치 명령: darwin 은 brew, linux 는 apt", async () => {
  for (const [platform, want] of [["darwin", /brew install git/], ["linux", /sudo apt install git/]]) {
    const { ctx } = fake({ platform, run: (cmd) => ({ status: cmd === "git" ? 1 : 0, stdout: "11.6.2" }) })
    assert.match(render(await runSetup(ctx), ctx), want)
  }
})

test("Node 판이 engines 보다 낮으면 필요 판을 알리고 종료 코드 1", async () => {
  const { ctx } = fake({ nodeVersion: "v22.1.0" })
  const r = await runSetup(ctx)
  assert.equal(r.code, 1)
  assert.match(render(r, ctx), /✘ node\s+v22\.1\.0 — 필요 >=24\.13\.0/)
})

test("npm 판이 낮으면 종료 코드 1", async () => {
  const { ctx } = fake({ run: (cmd) => ({ status: 0, stdout: cmd === "npm" ? "10.0.0" : "ok" }) })
  assert.equal((await runSetup(ctx)).code, 1)
})

test("선택 도구가 없으면 경고만 하고 종료 코드 0", async () => {
  const { ctx } = fake({ run: (cmd) => ({ status: ["git", "npm"].includes(cmd) ? 0 : 1, stdout: "11.6.2" }) })
  const r = await runSetup(ctx)
  const out = render(r, ctx)
  assert.equal(r.code, 0)
  assert.match(out, /○ chrome/)
  assert.match(out, /^setup: PASS — 필수 3\/3 · 경고 \d+\(chrome, gh\)/m)
})

test("선택 보안 도구는 scripts/ci/tools.json 이 있을 때만 점검하고 CI 고정판을 보여 준다", async () => {
  const tools = { actionlint: { version: "1.7.12", url: "u1" }, zizmor: { version: "1.30.1", url: "u2" }, "osv-scanner": { version: "2.6.0", url: "u3" } }
  const run = (cmd) => ({ status: ["git", "npm"].includes(cmd) ? 0 : 1, stdout: "11.6.2" })
  const withJson = fake({ run, exists: (p) => p.endsWith("tools.json"), readJson: (p) => (p.endsWith("tools.json") ? tools : PKG) })
  assert.match(render(await runSetup(withJson.ctx), withJson.ctx), /osv-scanner.*CI 고정판 2\.6\.0/)
  const without = fake({ run })
  assert.doesNotMatch(render(await runSetup(without.ctx), without.ctx), /osv-scanner/)
})

test("node_modules 가 없으면 npm ci 를 한 번 돌린다. 실패하면 종료 코드 1", async () => {
  const has = (p) => p.endsWith("package-lock.json")
  const a = fake({ exists: has })
  assert.equal((await runSetup(a.ctx)).code, 0)
  assert.equal(a.calls.npmCi, 1)
  const b = fake({ exists: has, npmCi: () => ({ status: 1, stdout: "" }) })
  const r = await runSetup(b.ctx)
  assert.equal(r.code, 1)
  assert.match(render(r, b.ctx), /npm ci 실패\(종료 1\)/)
})

test("node_modules 가 링크면 건드리지 않고, 최신이면 다시 설치하지 않는다", async () => {
  const exists = () => true
  const link = fake({ exists, isLink: () => true, mtime: (p) => (p.endsWith(".package-lock.json") ? 1 : 9) })
  await runSetup(link.ctx)
  assert.equal(link.calls.npmCi, 0)
  const fresh = fake({ exists, mtime: (p) => (p.endsWith(".package-lock.json") ? 9 : 1) })
  await runSetup(fresh.ctx)
  assert.equal(fresh.calls.npmCi, 0)
  const stale = fake({ exists, mtime: (p) => (p.endsWith(".package-lock.json") && p.includes("node_modules") ? 1 : 9) })
  await runSetup(stale.ctx)
  assert.equal(stale.calls.npmCi, 1)
})

test(".githooks 가 있으면 core.hooksPath 를 맞춘다. --check 는 바꾸지 않는다", async () => {
  const exists = (p) => p.endsWith(".githooks")
  const run = (cmd, args = []) => ({ status: 0, stdout: args.includes("--get") ? "" : "11.6.2" })
  const set = fake({ exists, run })
  await runSetup(set.ctx)
  assert.ok(set.calls.run.includes("git config core.hooksPath .githooks"))
  const chk = fake({ exists, run })
  const r = await runSetup(chk.ctx, { check: true })
  assert.ok(!chk.calls.run.includes("git config core.hooksPath .githooks"))
  assert.match(render(r, chk.ctx), /core\.hooksPath 가 \.githooks 가 아니다/)
})

test("빈 메모리가 3GB 미만이면 경고한다", async () => {
  const { ctx } = fake({ freeBytes: () => 1.5 * GB })
  const out = render(await runSetup(ctx), ctx)
  assert.match(out, /○ memory\s+빈 메모리 1\.5GB/)
})

test("npm ci 는 시간 제한 없이 돈다(깨끗한 clone 에서 60초 제한에 걸려 null 로 끝난 회귀)", () => {
  const src = realCtx().npmCi.toString()
  assert.doesNotMatch(src, /run\(|timeout/, "제한 시간이 있는 run() 을 거치지 않는다")
  assert.match(src, /stdio: "inherit"/, "진행 출력을 그대로 보인다")
})

test("atLeast: 판 비교", () => {
  assert.ok(atLeast("v24.13.0", "24.13.0"))
  assert.ok(atLeast("25.0.0", "24.13.0"))
  assert.ok(!atLeast("24.12.9", "24.13.0"))
  assert.ok(!atLeast("없음", "24.13.0"))
})

test("실제 프로세스: PATH 에 git 이 없으면 종료 코드 1 과 설치 명령이 나온다", () => {
  const r = spawnSync(process.execPath, ["scripts/setup.mjs", "--check"], { cwd: ROOT, encoding: "utf8", env: { PATH: dirname(process.execPath), SystemRoot: process.env.SystemRoot ?? "", ComSpec: process.env.ComSpec ?? "" } })
  assert.equal(r.status, 1, r.stdout + r.stderr)
  assert.match(r.stdout, /✘ git\s+없음/)
  assert.match(r.stdout, /setup: FAIL — 필수 누락 \d+\(.*git/)
  assert.match(r.stdout, process.platform === "win32" ? /winget install Git\.Git/ : /(brew|apt) install git/)
})

test("web-factory 를 못 찾으면 안내가 한 저장소(상위 ..)와 따로 받은 경우를 모두 말한다 — 선택 항목이라 종료 코드는 0 (A12)", async () => {
  const { ctx } = fake({
    exists: (p) => p.endsWith("package-lock.json") || /wf-conformance\.mjs$/.test(p),
    wfCheckout: async () => ({ ok: false, detail: "web-factory 체크아웃 없음(X)" }),
  })
  const r = await runSetup(ctx)
  const out = render(r, ctx)
  assert.equal(r.code, 0)
  assert.match(out, /상위\(`\.\.`/, "한 저장소 Sitebrew 안의 경우")
  assert.match(out, /따로 받았다면 web-factory 를 clone/, "이 폴더만 받은 경우")
  assert.match(out, /LF_WF_REPO/)
})
