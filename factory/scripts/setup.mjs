#!/usr/bin/env node
// npm run setup — 개발 환경 점검. 시스템 소프트웨어는 설치하지 않는다. 빠진 것과 이 OS 의 설치 명령만 알린다.
//   node factory/scripts/setup.mjs [--check]     --check 는 점검만 한다(git 설정·npm ci 를 하지 않는다)
// 하는 일: ① 필수·선택 도구 점검 ② .githooks 가 있으면 core.hooksPath 설정 ③ node_modules 가 없거나 package-lock.json 보다 오래됐으면 npm ci
// 종료 코드: 0 = 필수 모두 있음(선택 항목 경고는 있을 수 있다) · 1 = 필수 누락 또는 npm ci 실패
// 요구 판은 package.json 의 engines 가 정본이다. 선택 항목은 이 저장소에 해당 파일이 있을 때만 점검한다(.githooks · scripts/ci/tools.json · scripts/lib/wf-conformance.mjs).
import { spawnSync } from "node:child_process"
import { existsSync, lstatSync, readFileSync, statSync } from "node:fs"
import { freemem } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const findRoot = (d) => (existsSync(join(d, "package.json")) ? d : findRoot(dirname(d)))
export const ROOT = findRoot(here)

const WIN = "win32"
const PLATFORMS = [WIN, "darwin", "linux"]
const all = (cmd) => Object.fromEntries(PLATFORMS.map((p) => [p, cmd]))
const GB = 1024 ** 3

/** 설치 명령(이 PC 의 OS 것만 출력한다). 확인한 winget ID: Git.Git · OpenJS.NodeJS.LTS · Google.Chrome · GitHub.cli · Gitleaks.Gitleaks · rhysd.actionlint · zizmor.zizmor · Google.OSVScanner */
export const INSTALL = {
  node: { [WIN]: "winget install OpenJS.NodeJS.LTS --version 24.13.0", darwin: "nvm install 24.13.0 (nvm: https://github.com/nvm-sh/nvm)", linux: "nvm install 24.13.0 (nvm: https://github.com/nvm-sh/nvm)" },
  npm: { [WIN]: "Node 와 함께 온다 — Node 를 위 판으로 설치", darwin: "Node 와 함께 온다 — Node 를 위 판으로 설치", linux: "Node 와 함께 온다 — Node 를 위 판으로 설치" },
  git: { [WIN]: "winget install Git.Git", darwin: "brew install git", linux: "sudo apt install git" },
  chrome: { [WIN]: "winget install Google.Chrome", darwin: 'brew install --cask google-chrome 한 뒤 CHROME_PATH 에 실행 파일 경로를 넣는다', linux: "sudo apt install chromium 한 뒤 필요하면 CHROME_PATH 에 실행 파일 경로를 넣는다" },
  gh: { [WIN]: "winget install GitHub.cli", darwin: "brew install gh", linux: "sudo apt install gh" },
  vercel: all("npm i -g vercel"),
  gitleaks: { [WIN]: "winget install Gitleaks.Gitleaks", darwin: "brew install gitleaks", linux: null },
  actionlint: { [WIN]: "winget install rhysd.actionlint", darwin: "brew install actionlint", linux: null },
  zizmor: { [WIN]: "winget install zizmor.zizmor", darwin: "brew install zizmor", linux: "pipx install zizmor" },
  "osv-scanner": { [WIN]: "winget install Google.OSVScanner", darwin: "brew install osv-scanner", linux: null },
}

/** 선택 도구 → 그 도구가 없을 때 안 되는 일 */
const OPTIONAL_WHY = {
  chrome: "화면 관문(template:screens)·시각 검사에 필요",
  gh: "비공개 저장소 push·shadcn 레지스트리 설치(gh auth login)에 필요",
  vercel: "미리보기 배포·env:check --vercel 에 필요",
  gitleaks: "커밋 전 비밀값 검사(.githooks)에 필요. 없으면 훅이 안내만 하고 통과한다",
  actionlint: "ci:verify 의 워크플로 문법 단계가 건너뜀(SKIP)으로 표시된다",
  zizmor: "ci:verify 의 워크플로 보안 단계가 건너뜀(SKIP)으로 표시된다",
  "osv-scanner": "ci:verify 의 의존성 취약점 단계가 건너뜀(SKIP)으로 표시된다",
}

export const parseVersion = (s) => (/(\d+)\.(\d+)\.(\d+)/.exec(String(s)) ?? []).slice(1, 4).map(Number)
export function atLeast(have, want) {
  const a = parseVersion(have)
  const b = parseVersion(want)
  if (a.length < 3 || b.length < 3) return false
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i]
  return true
}
/** engines 값 `>=24.13.0` → `24.13.0` (다른 모양이면 null — 검사하지 않는다) */
const minOf = (range) => (typeof range === "string" && /^>=\s*\d+\.\d+\.\d+$/.test(range.trim()) ? range.replace(">=", "").trim() : null)

/** 실제 환경. 시험은 이 모양을 가짜로 바꿔 끼운다. */
export function realCtx(root = ROOT) {
  const win = process.platform === WIN
  const run = (cmd, args = []) => {
    // Windows 의 npm·vercel 은 .cmd 라 shell 이 필요하다. 인자는 상수라 한 줄 문자열로 넘긴다(shell + 인자 배열은 Node 24 가 경고한다).
    const r = win ? spawnSync([cmd, ...args].join(" "), { cwd: root, encoding: "utf8", shell: true, timeout: 60_000 }) : spawnSync(cmd, args, { cwd: root, encoding: "utf8", timeout: 60_000 })
    return { status: r.error ? null : r.status, stdout: `${r.stdout ?? ""}${r.stderr ?? ""}`.trim() }
  }
  return {
    root,
    platform: process.platform,
    env: process.env,
    nodeVersion: process.version,
    run,
    exists: existsSync,
    freeBytes: () => freemem(),
    readJson: (p) => JSON.parse(readFileSync(join(root, p), "utf8")),
    isLink: (p) => lstatSync(join(root, p)).isSymbolicLink(),
    mtime: (p) => statSync(join(root, p)).mtimeMs,
    // npm ci 는 몇 분 걸린다. 시간 제한을 두지 않고 진행 출력을 그대로 보인다(깨끗한 clone 에서 60초 제한에 걸려 null 로 끝난 적이 있다).
    npmCi: () => {
      const r = win ? spawnSync("npm ci", { cwd: root, stdio: "inherit", shell: true }) : spawnSync("npm", ["ci"], { cwd: root, stdio: "inherit" })
      return { status: r.error ? null : r.status, stdout: "" }
    },
    async wfCheckout() {
      const { loadWfConformance } = await import(pathToFileURL(join(root, "scripts/lib/wf-conformance.mjs")).href)
      const r = await loadWfConformance()
      r.cleanup?.()
      return r.skip ? { ok: false, detail: r.skip } : { ok: true, detail: `web-factory ${r.commit}` }
    },
  }
}

const chromeCandidates = (env) =>
  // web-factory factory/qa/cdp.mjs 가 찾는 순서와 같다. 여기에 없는 곳에 설치했으면 CHROME_PATH 를 쓴다.
  [env.CHROME_PATH, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "/usr/bin/google-chrome", "/usr/bin/chromium"].filter(Boolean)

const ok = (id, detail, level = "required") => ({ id, level, status: "ok", detail })
const miss = (id, detail, level, fix) => ({ id, level, status: "missing", detail, fix })
const did = (id, detail) => ({ id, level: "action", status: "ok", detail })

/** 점검 + 행동 → 항목 목록. 순서: 필수 도구 → 선택 도구 → git 설정 → 의존 설치 */
export async function runSetup(ctx, { check = false } = {}) {
  const pkg = ctx.readJson("package.json")
  const os = ctx.platform
  const fix = (name) => INSTALL[name]?.[os] ?? null
  const items = []
  const has = (cmd, args = ["--version"]) => ctx.run(cmd, args).status === 0

  // 필수
  const nodeMin = minOf(pkg.engines?.node)
  items.push(
    nodeMin && !atLeast(ctx.nodeVersion, nodeMin)
      ? miss("node", `${ctx.nodeVersion} — 필요 >=${nodeMin}`, "required", fix("node"))
      : ok("node", `${ctx.nodeVersion}${nodeMin ? ` (필요 >=${nodeMin})` : ""}`),
  )
  const npmOut = ctx.run("npm", ["--version"])
  const npmMin = minOf(pkg.engines?.npm)
  if (npmOut.status !== 0) items.push(miss("npm", "없음", "required", fix("npm")))
  else if (npmMin && !atLeast(npmOut.stdout, npmMin)) items.push(miss("npm", `${npmOut.stdout} — 필요 >=${npmMin}`, "required", `npm i -g npm@${npmMin} (또는 ${fix("npm")})`))
  else items.push(ok("npm", `${npmOut.stdout}${npmMin ? ` (필요 >=${npmMin})` : ""}`))
  const gitOut = ctx.run("git", ["--version"])
  items.push(gitOut.status === 0 ? ok("git", gitOut.stdout) : miss("git", "없음", "required", fix("git")))

  // 선택
  const optional = (name, bin, why, extra = "") => {
    const found = has(bin)
    items.push(found ? ok(name, `${bin} 있음${extra}`, "optional") : miss(name, `없음 — ${why}${extra}`, "optional", fix(name)))
  }
  const chrome = chromeCandidates(ctx.env).find((p) => ctx.exists(p))
  items.push(chrome ? ok("chrome", chrome, "optional") : miss("chrome", `없음 — ${OPTIONAL_WHY.chrome}`, "optional", fix("chrome")))
  optional("gh", "gh", OPTIONAL_WHY.gh)
  if (ctx.exists(join(ctx.root, "scripts/lib/wf-conformance.mjs"))) {
    // vercel 은 launch-factory 만 쓴다(미리보기 배포 스크립트가 있는 저장소)
    optional("vercel", "vercel", OPTIONAL_WHY.vercel)
    if (nodeMin && !atLeast(ctx.nodeVersion, nodeMin)) items.push({ id: "web-factory", level: "optional", status: "missing", detail: "Node 판이 맞지 않아 건너뜀", fix: null })
    else {
      const wf = await ctx.wfCheckout()
      items.push(wf.ok ? ok("web-factory", wf.detail, "optional") : miss("web-factory", `${wf.detail} — 적합성 시험이 건너뜀(SKIP)으로 표시된다`, "optional", "web-factory 를 clone 해 LF_WF_REPO 에 그 경로를 넣는다(README 필요 환경)"))
    }
  }
  if (ctx.exists(join(ctx.root, ".githooks"))) optional("gitleaks", "gitleaks", OPTIONAL_WHY.gitleaks)
  if (ctx.exists(join(ctx.root, "scripts/ci/tools.json"))) {
    const tools = ctx.readJson("scripts/ci/tools.json")
    for (const name of ["actionlint", "zizmor", "osv-scanner"]) {
      const before = items.length
      optional(name, name, OPTIONAL_WHY[name], tools[name] ? ` · CI 고정판 ${tools[name].version}` : "")
      const it = items[before]
      if (it.status === "missing" && !it.fix && tools[name]) it.fix = `릴리스 파일: ${tools[name].url}`
    }
    const gl = items.find((i) => i.id === "gitleaks")
    if (gl?.status === "missing" && !gl.fix && tools.gitleaks) gl.fix = `릴리스 파일: ${tools.gitleaks.url}`
  }
  const freeGb = ctx.freeBytes() / GB
  items.push(freeGb >= 3 ? ok("memory", `빈 메모리 ${freeGb.toFixed(1)}GB`, "optional") : miss("memory", `빈 메모리 ${freeGb.toFixed(1)}GB — 무거운 검사(빌드·화면 관문)는 약 3GB 필요`, "optional", "다른 프로그램을 닫는다"))

  // 행동 — 필수가 빠지면 하지 않는다
  const requiredOk = items.every((i) => i.level !== "required" || i.status === "ok")
  if (ctx.exists(join(ctx.root, ".githooks"))) {
    const cur = ctx.run("git", ["config", "--local", "--get", "core.hooksPath"]).stdout
    if (cur === ".githooks") items.push(did("hooks", "core.hooksPath=.githooks"))
    else if (check || !requiredOk) items.push(miss("hooks", "core.hooksPath 가 .githooks 가 아니다", "optional", "git config core.hooksPath .githooks"))
    else {
      const r = ctx.run("git", ["config", "core.hooksPath", ".githooks"])
      items.push(r.status === 0 ? did("hooks", "core.hooksPath=.githooks 로 설정함") : miss("hooks", "core.hooksPath 설정 실패(git 저장소가 아닌가?)", "required", "git config core.hooksPath .githooks"))
    }
  }
  const lock = "package-lock.json"
  if (ctx.exists(join(ctx.root, lock))) {
    const nm = "node_modules"
    const present = ctx.exists(join(ctx.root, nm))
    const link = present && ctx.isLink(nm)
    const hidden = join(nm, ".package-lock.json")
    const stale = !present || !ctx.exists(join(ctx.root, hidden)) || ctx.mtime(lock) > ctx.mtime(hidden)
    if (link) items.push(did("deps", "node_modules 가 링크라서 건드리지 않는다"))
    else if (!stale) items.push(did("deps", "node_modules 가 package-lock.json 과 맞다"))
    else if (!requiredOk && !check) items.push(miss("deps", "필수 도구가 빠져 npm ci 를 건너뜀 — 해결한 뒤 npm run setup 을 다시 돌린다", "optional", null))
    else if (check) items.push(miss("deps", "node_modules 가 없거나 package-lock.json 보다 오래됐다", "required", "npm ci"))
    else {
      const r = ctx.npmCi()
      items.push(r.status === 0 ? did("deps", "npm ci 완료") : miss("deps", `npm ci 실패(종료 ${r.status}) — 위 출력을 본다`, "required", "npm ci"))
    }
  }
  return { items, code: items.some((i) => i.level === "required" && i.status !== "ok") ? 1 : 0 }
}

export function render({ items, code }, ctx) {
  const mark = (i) => (i.status === "ok" ? "✔" : i.level === "required" ? "✘" : "○")
  const lines = [`setup — ${ctx.readJson("package.json").name} (${ctx.platform}, node ${ctx.nodeVersion})`]
  for (const i of items) {
    lines.push(`  ${mark(i)} ${i.id.padEnd(12)} ${i.detail}`)
    if (i.status !== "ok" && i.fix) lines.push(`      → ${i.fix}`)
  }
  const req = items.filter((i) => i.level === "required")
  const bad = items.filter((i) => i.status !== "ok")
  const reqBad = bad.filter((i) => i.level === "required")
  const warn = bad.filter((i) => i.level !== "required")
  lines.push(
    code === 0
      ? `setup: PASS — 필수 ${req.length}/${req.length}${warn.length ? ` · 경고 ${warn.length}(${warn.map((i) => i.id).join(", ")})` : ""}`
      : `setup: FAIL — 필수 누락 ${reqBad.length}(${reqBad.map((i) => i.id).join(", ")})${warn.length ? ` · 경고 ${warn.length}` : ""}`,
  )
  return lines.join("\n")
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const ctx = realCtx()
  const result = await runSetup(ctx, { check: process.argv.includes("--check") })
  console.log(render(result, ctx))
  process.exitCode = result.code
}
