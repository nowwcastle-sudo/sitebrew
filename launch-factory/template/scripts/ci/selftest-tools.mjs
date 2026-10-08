#!/usr/bin/env node
// 보안 도구 양성 대조 — 「0건 통과」는 도구가 죽었을 때도 나온다. 그래서 매번 심은 결함을 임시 폴더에 만들어 도구가 정말 빨간불을 내는지 본다.
//   actionlint  틀린 표현식(github.evnt)         → 종료 1 + 메시지에 evnt
//   zizmor      고정 안 된 액션·주입·권한 없음   → 종료 11 이상 + unpinned-uses · template-injection
//   gitleaks    AWS 모양 키·GitHub 토큰 모양 값   → 종료 1 + aws-access-token (이 저장소의 .gitleaks.toml 을 그대로 쓴다 — 허용 목록이 탐지를 죽이지 않았는지)
//   osv-scanner 알려진 취약 버전(lodash 4.17.20)   → 종료 1 + lodash
// 가짜 값은 실행할 때 조각을 이어 만든다 — 이 파일 자체가 비밀값 모양을 담지 않는다(gitleaks 트리 스캔에 걸리지 않게).
// 종료 코드: 0 = 모두 기대대로 빨강 · 1 = 하나라도 안 잡혔다(도구·설정이 죽었다) · 3 = 로컬에 도구가 없어 건너뜀(CI 에서는 없으면 1)
import { spawnSync } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { resolveTool } from "./tools.mjs"

const ROOT = fileURLToPath(new URL("../..", import.meta.url))
const IN_CI = process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true"
const REQUIRE = IN_CI || process.env.LF_CI_REQUIRE_TOOLS === "1"

const exec = (bin, args, cwd = ROOT) => {
  const r = spawnSync(bin, args, { cwd, encoding: "utf8", maxBuffer: 64 << 20 })
  return { code: r.status ?? -1, out: `${r.stdout ?? ""}${r.stderr ?? ""}` }
}
const tmp = () => mkdtempSync(join(tmpdir(), "lf-selftest-"))
const results = []
const record = (name, ok, detail) => {
  results.push({ name, ok })
  console.log(`${ok ? "✔ 잡았다(기대대로 빨강)" : "✘ 못 잡았다"}  ${name}${detail ? ` — ${detail}` : ""}`)
}
const tail = (s, n = 14) => s.trim().split("\n").slice(-n).join("\n")

function check(name, bin, args, { cwd, expect, codeOk }) {
  const r = exec(bin, args, cwd)
  const hit = codeOk(r.code) && expect.every((re) => re.test(r.out))
  record(name, hit, `종료 ${r.code}`)
  console.log(tail(r.out).replace(/^/gm, "    | "))
  return hit
}

const tools = Object.fromEntries(["actionlint", "zizmor", "gitleaks", "osv-scanner"].map((n) => [n, resolveTool(n)]))
const missing = Object.entries(tools).filter(([, v]) => !v).map(([k]) => k)
if (missing.length) console.log(`도구 없음: ${missing.join(", ")}`)

const BAD_WORKFLOW = `name: bad
on: pull_request
jobs:
  j:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@main
      - run: echo "\${{ github.event.pull_request.title }}"
      - run: echo "\${{ github.evnt.number }}"
`

const dirs = []
try {
  if (tools.actionlint) {
    const d = tmp()
    dirs.push(d)
    mkdirSync(join(d, ".github", "workflows"), { recursive: true })
    writeFileSync(join(d, ".github", "workflows", "bad.yml"), BAD_WORKFLOW)
    check("actionlint: 틀린 표현식 github.evnt", tools.actionlint.path, [".github/workflows/bad.yml"], { cwd: d, expect: [/evnt/], codeOk: (c) => c === 1 })
  }
  if (tools.zizmor) {
    const d = tmp()
    dirs.push(d)
    mkdirSync(join(d, ".github", "workflows"), { recursive: true })
    writeFileSync(join(d, ".github", "workflows", "bad.yml"), BAD_WORKFLOW)
    check("zizmor: @main 고정 안 됨 + 템플릿 주입", tools.zizmor.path, ["--offline", ".github"], { cwd: d, expect: [/unpinned-uses/, /template-injection/], codeOk: (c) => c >= 11 && c <= 14 })
  }
  if (tools.gitleaks) {
    const d = tmp()
    dirs.push(d)
    const key = ["AKIA", "QJ4XM7HT2ZRB6WNP"].join("")
    writeFileSync(join(d, "leak.env"), `aws_access_key_id = ${key}\naws_region = us-east-1\n`)
    const cfg = join(ROOT, ".gitleaks.toml")
    check("gitleaks: AWS 모양 키(이 저장소 .gitleaks.toml 적용)", tools.gitleaks.path, ["dir", d, "--config", cfg, "--redact", "--no-banner", "--verbose"], { expect: [/aws-access-token/], codeOk: (c) => c === 1 })
    // 허용 목록이 좁은지: 허용된 파일 경로라도 허용된 줄 모양(license_key: "…")이 아니면 같은 규칙이 다시 잡아야 한다
    const narrow = tmp()
    dirs.push(narrow)
    mkdirSync(join(narrow, "packages", "billing-gumroad", "fixtures"), { recursive: true })
    const secret = ["x8Fk2Qm9", "ZpL4vRt7", "WnB3cYd6", "HsJ1aGe5"].join("")
    writeFileSync(join(narrow, "packages", "billing-gumroad", "fixtures", "gumroad-examples.mjs"), `export const x = {\n    api_secret: "${secret}",\n}\n`)
    check("gitleaks: 허용된 파일 안의 다른 모양 줄은 여전히 잡힌다", tools.gitleaks.path, ["dir", narrow, "--config", cfg, "--redact", "--no-banner", "--verbose"], { expect: [/generic-api-key/], codeOk: (c) => c === 1 })
    const clean = tmp()
    dirs.push(clean)
    writeFileSync(join(clean, "readme.txt"), "비밀값 없는 평범한 글\n")
    const r = exec(tools.gitleaks.path, ["dir", clean, "--config", cfg, "--redact", "--no-banner"])
    record("gitleaks 음성 대조: 평범한 파일은 통과", r.code === 0, `종료 ${r.code}`)
  }
  if (tools["osv-scanner"]) {
    const d = tmp()
    dirs.push(d)
    const lock = {
      name: "selftest",
      lockfileVersion: 3,
      requires: true,
      packages: { "": { name: "selftest", dependencies: { lodash: "4.17.20" } }, "node_modules/lodash": { version: "4.17.20", resolved: "https://registry.npmjs.org/lodash/-/lodash-4.17.20.tgz" } },
    }
    writeFileSync(join(d, "package-lock.json"), JSON.stringify(lock))
    // -L 은 `파서:경로` 모양도 받는다 — Windows 절대 경로(`C:` 로 시작)의 콜론을 피해 상대 경로 + cwd 로 준다
    check("osv-scanner: 알려진 취약 버전 lodash@4.17.20", tools["osv-scanner"].path, ["scan", "source", "-L", "package-lock.json"], { cwd: d, expect: [/lodash/i], codeOk: (c) => c === 1 })
  }
} finally {
  for (const d of dirs) rmSync(d, { recursive: true, force: true })
}

const bad = results.filter((r) => !r.ok)
console.log(`\n양성 대조 ${results.length - bad.length}/${results.length} 잡음${missing.length ? ` · 도구 없어 건너뜀: ${missing.join(", ")}` : ""}`)
if (bad.length) process.exitCode = 1
else if (missing.length) process.exitCode = REQUIRE ? 1 : 3
