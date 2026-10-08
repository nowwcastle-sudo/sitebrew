// 검사 단계 실행기 + 보안 단계 묶음 — launch-factory 의 `ci:verify`(scripts/ci/verify.mjs)와 제품 템플릿의 `ci:verify`(template/scripts/ci/verify.mjs)가 같이 쓴다.
// 이 파일은 템플릿에 그대로 복사된다(template.lock.json 이 원천과 같은지 template:check 가 본다) — 저장소 구조를 가정하지 말고 ROOT(두 단계 위)만 쓴다.
// 단계 하나 = { id, title, run() }. run 은 종료 코드(0 = 통과)·"tool-missing"(외부 도구 없음)·"skip:이유"(할 일이 없어 건너뜀)를 돌려준다.
// 외부 도구가 없으면: CI 와 LF_CI_REQUIRE_TOOLS=1 에서는 실패, 그 밖(이 PC 처럼 설치하지 않은 곳)에서는 「SKIP(도구 없음)」으로 표시하고 통과로 세지 않는다.
import { spawnSync } from "node:child_process"
import { appendFileSync, existsSync, globSync, mkdirSync, mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { resolveTool } from "./tools.mjs"

export const ROOT = fileURLToPath(new URL("../..", import.meta.url))
export const IN_CI = process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true"
export const REQUIRE_TOOLS = IN_CI || process.env.LF_CI_REQUIRE_TOOLS === "1"
const NPM = process.platform === "win32" ? "npm.cmd" : "npm"

export const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { cwd: ROOT, stdio: "inherit", shell: process.platform === "win32" && cmd.endsWith(".cmd"), ...opts }).status ?? 1
export const npm = (script) => () => run(NPM, ["run", script])

export function installHint(name) {
  return name === "gitleaks"
    ? "운영자 몫: Windows `winget install Gitleaks.Gitleaks` 또는 `scoop install gitleaks`(자세히 docs/qa/vr-phase1.md). CI 는 고정판을 받아 쓴다"
    : "CI 가 고정판을 받아 쓴다(scripts/ci/tools.json). 이 PC 에는 설치하지 않는다"
}

/** 외부 도구 단계: 도구가 없으면 "tool-missing" 으로 돌려준다 */
export function withTool(name, fn) {
  return () => {
    const t = resolveTool(name)
    if (!t) {
      console.log(`${name} 실행 파일이 없다 — ${installHint(name)}`)
      return "tool-missing"
    }
    console.log(`${name}: ${t.path}${t.source === "pinned" ? " (CI 가 받아 sha256 을 맞춘 고정판)" : " (PATH 의 설치본)"}`)
    return fn(t.path)
  }
}

/** 비교 기준 커밋: LF_CI_BASE → origin/main → main. 현재 HEAD 가 그 위에 있으면 base..HEAD, main 자신이면 HEAD~1..HEAD */
export function rangeBase() {
  const git = (...a) => spawnSync("git", a, { cwd: ROOT, encoding: "utf8" })
  const ok = (ref) => git("rev-parse", "--verify", "--quiet", `${ref}^{commit}`).status === 0
  if (!ok("HEAD")) return null
  const head = git("rev-parse", "HEAD").stdout.trim()
  const env = process.env.LF_CI_BASE
  const cands = [env && !/^0+$/.test(env) ? env : null, "origin/main", "main"].filter(Boolean)
  for (const c of cands) {
    if (!ok(c)) continue
    const base = git("merge-base", c, "HEAD").stdout.trim()
    if (base && base !== head) return base
    if (ok("HEAD~1")) return git("rev-parse", "HEAD~1").stdout.trim()
  }
  return null
}

function gitleaksTree(bin) {
  // 추적 파일만(node_modules·.tmp 제외) 커밋 상태 그대로 푼 폴더를 훑는다
  const dir = mkdtempSync(join(tmpdir(), "lf-gitleaks-"))
  try {
    const arc = spawnSync("git", ["archive", "--format=tar", "HEAD"], { cwd: ROOT, maxBuffer: 512 << 20, encoding: "buffer" })
    if (arc.status !== 0) {
      console.log(`git archive 실패(종료 ${arc.status}): ${String(arc.stderr ?? "").trim() || String(arc.error ?? "")}`)
      return 1
    }
    // 풀 폴더는 -C 인자가 아니라 cwd 로 준다 — Git Bash 의 GNU tar 는 `C:` 로 시작하는 경로를 `호스트:경로`(원격)로 읽는다. 인자에 콜론 든 경로가 없으면 GNU tar·bsdtar·리눅스 어디서나 같다
    const x = spawnSync("tar", ["-xf", "-"], { cwd: dir, input: arc.stdout })
    if (x.status !== 0) {
      console.log(`tar 로 푸는 데 실패했다(종료 ${x.status}): ${String(x.stderr ?? "").trim() || String(x.error ?? "")}`)
      return 1
    }
    return run(bin, ["dir", dir, "--config", join(ROOT, ".gitleaks.toml"), "--redact", "--no-banner", "--verbose"])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

function gitleaksRange(bin) {
  const base = rangeBase()
  if (!base) {
    console.log("비교 기준 커밋을 못 찾아 이번 범위 검사는 건너뛴다(트리 검사는 이미 했다)")
    return 0
  }
  console.log(`범위: ${base.slice(0, 10)}..HEAD`)
  return run(bin, ["git", ROOT, "--config", join(ROOT, ".gitleaks.toml"), "--redact", "--no-banner", "--verbose", `--log-opts=${base}..HEAD`])
}

/** 워크플로가 있는 .github 폴더들(저장소 뿌리 + launch-factory 의 template/) */
const githubDirs = () => [".github", "template/.github"].filter((d) => existsSync(join(ROOT, d, "workflows")))
const wfFiles = () => githubDirs().flatMap((d) => globSync(`${d}/workflows/*.{yml,yaml}`, { cwd: ROOT })).sort()

export const SECURITY_STEPS = [
  { id: "actionlint", title: "워크플로 문법 actionlint", run: withTool("actionlint", (bin) => run(bin, wfFiles())) },
  {
    id: "zizmor",
    title: "워크플로 보안 zizmor(오프라인)",
    run: withTool("zizmor", (bin) => githubDirs().map((d) => run(bin, ["--offline", d])).reduce((a, b) => a || b, 0)),
  },
  { id: "gitleaks-tree", title: "비밀값 스캔: 커밋된 트리 전체", run: withTool("gitleaks", gitleaksTree) },
  { id: "gitleaks-range", title: "비밀값 스캔: 이번에 올리는 커밋 범위", run: withTool("gitleaks", gitleaksRange) },
  {
    id: "osv",
    title: "의존성 취약점 OSV-Scanner(osv-scanner.toml 예외는 만료일 있음)",
    run: () => {
      if (!existsSync(join(ROOT, "package-lock.json"))) return "skip:package-lock.json 없음"
      return withTool("osv-scanner", (bin) => run(bin, ["scan", "source", "-L", "package-lock.json", "--config", "osv-scanner.toml"]))()
    },
  },
  {
    id: "tool-selftest",
    title: "보안 도구 양성 대조(심은 결함을 도구가 아직 잡는가)",
    run: () => {
      const c = run(process.execPath, ["scripts/ci/selftest-tools.mjs"])
      return c === 3 ? "tool-missing" : c
    },
  },
]

const pick = (argv, flag) => {
  const i = argv.indexOf(flag)
  return i === -1 ? null : new Set(argv[i + 1].split(","))
}

/** 단계를 차례로 돌리고 요약 표를 낸다. 반환: 종료 코드(0 통과 · 1 실패 있음) */
export function runSteps(steps, label, argv = process.argv.slice(2)) {
  if (argv.includes("--list")) {
    for (const s of steps) console.log(`${s.id.padEnd(16)} ${s.title}`)
    return 0
  }
  const only = pick(argv, "--only")
  const skip = pick(argv, "--skip")
  const results = []
  const t0 = Date.now()
  for (const s of steps) {
    if ((only && !only.has(s.id)) || skip?.has(s.id)) continue
    console.log(`\n::group::▶ ${s.id} — ${s.title}`)
    const t = Date.now()
    let r
    try {
      r = s.run()
    } catch (e) {
      console.log(e instanceof Error ? e.stack : String(e))
      r = 1
    }
    const sec = Math.round((Date.now() - t) / 100) / 10
    let status
    if (r === 0) status = "PASS"
    else if (r === "tool-missing") status = REQUIRE_TOOLS ? "FAIL(도구 없음)" : "SKIP(도구 없음)"
    else if (typeof r === "string" && r.startsWith("skip:")) status = `SKIP(${r.slice(5)})`
    else status = `FAIL(exit ${r})`
    console.log(`::endgroup::${status.startsWith("PASS") ? "✔" : status.startsWith("SKIP") ? "○" : "✘"} ${s.id} ${status} ${sec}s`)
    results.push({ id: s.id, title: s.title, status, sec })
  }
  const failed = results.filter((r) => r.status.startsWith("FAIL"))
  const skipped = results.filter((r) => r.status.startsWith("SKIP"))
  const mark = (r) => (r.status.startsWith("PASS") ? "✔" : r.status.startsWith("SKIP") ? "○" : "✘")
  console.log(
    [
      "",
      `${label} 요약`,
      ...results.map((r) => `  ${mark(r)} ${r.id.padEnd(16)} ${r.status.padEnd(26)} ${String(r.sec).padStart(6)}s  ${r.title}`),
      `  통과 ${results.filter((r) => r.status === "PASS").length} · 실패 ${failed.length} · 건너뜀 ${skipped.length}${skipped.length ? ` (${skipped.map((r) => `${r.id}: ${r.status.slice(5, -1)}`).join(", ")})` : ""} · 합계 ${Math.round((Date.now() - t0) / 1000)}s`,
    ].join("\n"),
  )
  if (process.env.GITHUB_STEP_SUMMARY) {
    mkdirSync(resolve(process.env.GITHUB_STEP_SUMMARY, ".."), { recursive: true })
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### ${label}\n\n| 단계 | 결과 | 초 |\n|---|---|---|\n${results.map((r) => `| ${r.id} | ${r.status} | ${r.sec} |`).join("\n")}\n`)
  }
  return failed.length ? 1 : 0
}
