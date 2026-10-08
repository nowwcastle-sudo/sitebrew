#!/usr/bin/env node
// 제품 화면 관문 러너(LFRUNNER · 감사 N02). launch-factory 템플릿을 mock 모드로 한 번 빌드해 next start 로 띄우고, web-factory 의 관문 도구를
// 모든 쪽 × 세션 장면 × {1440, 375} 에 돌려 .tmp/screens/summary.json 과 읽기 쉬운 표로 모은다. 하나라도 실패하면 종료 1.
//   npm run template:screens [-- --skip-build] [--only /pricing,/account] [--gates a11y,ux,lang,signed-out] [--concurrency 2] [--retries 1] [--out <폴더>]
// 환경 변수: WF_HOME(web-factory 체크아웃, 기본: 이 저장소의 뿌리) · LF_SCREENS_MIN_FREE_GB(기본 3.0 — 모자라면 2분씩 기다린다)
// 관문 4개(web-factory docs/agents/agent-guide.md 관문 표): a11y-gate(쪽×장면, 라이트·다크·강제 색 × 1440·375) · ux-gate(쪽×장면, 1440·375 × 라이트·다크) ·
//   qa:lang(장면×너비, 쪽을 묶어서, 로캘 en) · qa:signed-out(보호된 쪽, 로그아웃 고정). 관문은 둘까지만 동시에 돈다(메모리).
// 장면 계약은 docs/qa/template-screens.md — mock 모드가 쿠키 wf_session 을 읽는다(template/lib/mock-scene.ts). live 는 읽지 않는다.
import { spawn, spawnSync } from "node:child_process"
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import net from "node:net"
import os from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { aggregate, buildPlan, classifyExit, extractFindings, GATES, groupFindings, isProtected, readResult, redirectsToSignIn, renderTable, routesFromApp, SCENE_IN, SCENE_OUT, SCENE_UNVERIFIED } from "./template-screens/plan.mjs"

const ROOT = fileURLToPath(new URL("..", import.meta.url))
const TEMPLATE = join(ROOT, "template")
const NODE = process.execPath
const WIN = process.platform === "win32"
const PROVIDER_ENV = ["DATABASE_URL", "BETTER_AUTH_SECRET", "PADDLE_API_KEY", "PADDLE_WEBHOOK_SECRET", "RESEND_API_KEY", "POSTHOG_PROJECT_KEY", "SENTRY_DSN", "TURNSTILE_SECRET_KEY", "EMAIL_FROM", "NEXT_PUBLIC_APP_URL", "CRON_SECRET", "SUBJECT_REF_KEY", "TURNSTILE_SITE_KEY", "INQUIRY_OWNER_EMAIL", "PADDLE_CLIENT_TOKEN", "LF_MODE", "POSTHOG_HOST", "LF_MOCK_SUB", "NODE_ENV", "WF_SESSION"]
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ── 인자 ──────────────────────────────────────────────────────────────────────────────
export function parseArgs(argv) {
  const a = { rerun: [], resume: null, skipBuild: false, only: null, gates: [...GATES], concurrency: 2, retries: 1, out: join(ROOT, ".tmp", "screens") }
  const rest = [...argv]
  while (rest.length) {
    const t = rest.shift()
    if (t === "--skip-build") a.skipBuild = true
    else if (t === "--only") a.only = rest.shift().split(",").filter(Boolean)
    else if (t === "--gates") a.gates = rest.shift().split(",").filter(Boolean)
    else if (t === "--concurrency") a.concurrency = Number(rest.shift())
    else if (t === "--retries") a.retries = Number(rest.shift())
    else if (t === "--out") a.out = resolve(rest.shift())
    else if (t === "--resume") a.resume = resolve(rest.shift())
    else if (t === "--rerun") a.rerun = rest.shift().split(",").filter(Boolean)
    else throw new Error(`모르는 인자: ${t}`)
  }
  if (!a.gates.length || a.gates.some((g) => !GATES.includes(g))) throw new Error(`--gates 는 ${GATES.join("|")} 중에서`)
  if (!(a.concurrency >= 1 && a.concurrency <= 2)) throw new Error("--concurrency 는 1 또는 2 (메모리 — 규칙: 둘까지)")
  if (!(a.retries >= 0 && a.retries <= 3)) throw new Error("--retries 는 0~3")
  return a
}

// ── 프로세스·메모리 ─────────────────────────────────────────────────────────────────────
const killTree = (pid) => {
  if (pid === undefined) return
  if (WIN) spawnSync("taskkill", ["/pid", String(pid), "/T", "/F"], { stdio: "ignore" })
  else try { process.kill(-pid, "SIGKILL") } catch { /* 이미 끝남 */ }
}
const freeGb = () => os.freemem() / 2 ** 30

/** 빈 메모리가 문턱 이상이 될 때까지 2분 단계로 기다린다(규칙). 끝내 모자라면 던진다 — 모자란 채로 Chrome 을 띄우지 않는다 */
export async function waitForMemory(minGb, { steps = 15, stepMs = 120_000, free = freeGb, wait = sleep, log = console.log } = {}) {
  for (let i = 0; i <= steps; i++) {
    const g = free()
    if (g >= minGb) return g
    if (i === steps) break
    log(`  메모리 ${g.toFixed(1)} GB < ${minGb} GB — ${stepMs / 60_000}분 기다린다 (${i + 1}/${steps})`)
    await wait(stepMs)
  }
  throw new Error(`빈 메모리가 ${minGb} GB 아래로 ${(steps * stepMs) / 60_000}분 넘게 유지됨`)
}

const cleanEnv = (extra = {}) => {
  const env = { ...process.env, NEXT_TELEMETRY_DISABLED: "1", CI: "1" }
  for (const n of PROVIDER_ENV) delete env[n]
  return { ...env, ...extra }
}

const freePort = () =>
  new Promise((ok, bad) => {
    const s = net.createServer()
    s.once("error", bad)
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address()
      s.close(() => ok(port))
    })
  })

/** 자식을 띄워 끝날 때까지(또는 기한까지) 기다린다. 기한이 지나면 나무째 죽이고 code null. 출력 끝부분과 종료 코드를 돌려준다 */
function run(cmd, args, { cwd, env, timeoutMs, logFile }) {
  return new Promise((done) => {
    const child = spawn(cmd, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"], windowsHide: true })
    let text = ""
    const add = (d) => { text += d; if (text.length > 200_000) text = text.slice(-100_000) }
    child.stdout.on("data", add)
    child.stderr.on("data", add)
    let timedOut = false
    const timer = setTimeout(() => { timedOut = true; killTree(child.pid) }, timeoutMs)
    child.on("close", (code) => {
      clearTimeout(timer)
      killTree(child.pid) // 남은 자손(Chrome)이 있으면 같이
      if (logFile) writeFileSync(logFile, text)
      done({ code: timedOut ? null : code, timedOut, tail: text.slice(-1500) })
    })
    child.on("error", (e) => { clearTimeout(timer); done({ code: null, timedOut: false, tail: String(e) }) })
  })
}

// ── 빌드·서버 ───────────────────────────────────────────────────────────────────────────
async function build(a, minGb) {
  const hasBuild = existsSync(join(TEMPLATE, ".next", "BUILD_ID"))
  if (a.skipBuild && hasBuild) return { skipped: true, seconds: 0 }
  await waitForMemory(minGb)
  const t0 = Date.now()
  mkdirSync(a.out, { recursive: true })
  const npm = WIN ? "npm.cmd" : "npm"
  const child = spawn(npm, ["run", "build"], { cwd: TEMPLATE, env: cleanEnv({ LF_MODE: "mock", LF_ALLOW_MOCK_PROD: "1" }), shell: WIN, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] })
  let text = ""
  child.stdout.on("data", (d) => (text += d))
  child.stderr.on("data", (d) => (text += d))
  const code = await new Promise((r) => child.on("close", r))
  killTree(child.pid)
  writeFileSync(join(a.out, "build.log"), text)
  if (code !== 0 || !existsSync(join(TEMPLATE, ".next", "BUILD_ID"))) throw new Error(`mock 빌드 종료 ${code}\n${text.slice(-2000)}`)
  return { skipped: false, seconds: Math.round((Date.now() - t0) / 1000) }
}

async function startServer() {
  const port = await freePort()
  const nextBin = createRequire(join(TEMPLATE, "package.json")).resolve("next/dist/bin/next")
  const child = spawn(NODE, [nextBin, "start", "-p", String(port), "-H", "127.0.0.1"], { cwd: TEMPLATE, env: cleanEnv({ LF_MODE: "mock", LF_ALLOW_MOCK_PROD: "1", LF_MOCK_SCENES: "1" }), windowsHide: true, stdio: ["ignore", "pipe", "pipe"] })
  let text = ""
  child.stdout.on("data", (d) => (text += d))
  child.stderr.on("data", (d) => (text += d))
  const end = Date.now() + 90_000
  while (Date.now() < end && !/Ready in/.test(text)) {
    if (child.exitCode !== null) throw new Error(`next start 가 바로 끝남(${child.exitCode})\n${text.slice(-1500)}`)
    await sleep(300)
  }
  if (!/Ready in/.test(text)) { killTree(child.pid); throw new Error(`next start Ready 안 됨\n${text.slice(-1500)}`) }
  return { port, origin: `http://127.0.0.1:${port}`, pid: child.pid, child }
}

// ── 장면 정찰(관문 전에 서버가 장면을 정말 따르는지 본다 — 「안 걸렸는데 통과」 방지) ───────────────────
const sceneCookie = (scene) => (scene === SCENE_OUT ? null : `wf_session=${encodeURIComponent(scene)}`)

async function probe(origin, path, scene) {
  const res = await fetch(origin + path, { redirect: "manual", headers: sceneCookie(scene) ? { cookie: sceneCookie(scene) } : {}, signal: AbortSignal.timeout(120_000) })
  const html = await res.text()
  return { status: res.status, location: res.headers.get("location"), html, signInRedirect: redirectsToSignIn(res.status, res.headers.get("location"), html), prompt: /id="sign-in-required-title"/.test(html), marker: /<html[^>]*data-wf-session="([^"]*)"/.exec(html)?.[1] ?? null }
}

// ── 관문 작업 ───────────────────────────────────────────────────────────────────────────
const slug = (s) => s.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "root"

export function buildJobs(plan, origin, a, outDir) {
  const jobs = []
  const wf = (file) => join(WF_HOME(), "factory", "qa", file)
  const want = (g) => a.gates.includes(g)
  for (const p of plan) {
    for (const scene of p.scenes) {
      const url = origin + p.path
      const dir = (g) => join(outDir, "cells", `${slug(p.path)}__${slug(scene)}`, g)
      if (want("a11y")) jobs.push({ id: `a11y ${p.path} ${scene}`, gate: "a11y", pages: [p.path], scene, dir: dir("a11y"), timeoutMs: 8 * 60_000, args: [wf("a11y-gate.mjs"), url, "--out", dir("a11y"), "--widths", "1440,375", "--session", scene] })
      if (want("ux")) jobs.push({ id: `ux ${p.path} ${scene}`, gate: "ux", pages: [p.path], scene, dir: dir("ux"), timeoutMs: 6 * 60_000, args: [wf("ux-gate.mjs"), url, dir("ux"), "--session", scene] })
    }
  }
  if (want("lang")) {
    for (const scene of [SCENE_OUT, SCENE_IN, "signed-in:sub=past_due", SCENE_UNVERIFIED]) {
      const pages = plan.filter((p) => p.scenes.includes(scene)).map((p) => p.path)
      for (const width of [1440, 375]) {
        const dir = join(outDir, "cells", `lang__${slug(scene)}__${width}`)
        jobs.push({ id: `lang ${scene} ${width}`, gate: "lang", pages, scene, width, dir, timeoutMs: (3 + pages.length) * 60_000, args: [wf("lang-mix.mjs"), ...pages.map((x) => origin + x), "--locale", "en", "--width", String(width), "--out", dir, "--session", scene] })
      }
    }
  }
  const prot = plan.filter((p) => p.protected).map((p) => p.path)
  if (want("signed-out") && prot.length) {
    const dir = join(outDir, "cells", "signed-out")
    jobs.push({ id: "signed-out access", gate: "signed-out", pages: prot, scene: SCENE_OUT, dir, timeoutMs: (3 + prot.length) * 60_000, args: [wf("signed-out-access.mjs"), origin, "--paths", prot.join(","), "--out", dir, "--session", SCENE_OUT] })
  }
  return jobs
}

const WF_HOME = () => resolve(process.env.WF_HOME || resolve(dirname(fileURLToPath(import.meta.url)), "..", ".."))

/** 작업 하나를 돌려 셀(쪽×장면×관문)로 바꾼다. 도구 실패는 retries 번까지 다시(부하로 기한을 넘기는 경우) — 판정 실패·인자 오류는 다시 안 돌린다 */
async function runJob(job, a, minGb, tmpRoot, log) {
  let last
  for (let attempt = 1; attempt <= 1 + a.retries; attempt++) {
    await waitForMemory(minGb, { log })
    rmSync(job.dir, { recursive: true, force: true })
    mkdirSync(job.dir, { recursive: true })
    const tmp = join(tmpRoot, `${slug(job.id)}_${attempt}`)
    mkdirSync(tmp, { recursive: true })
    const t0 = Date.now()
    const r = await run(NODE, job.args, { cwd: WF_HOME(), env: cleanEnv({ TEMP: tmp, TMP: tmp, TMPDIR: tmp, WF_NAV_TIMEOUT_MS: process.env.WF_NAV_TIMEOUT_MS ?? "45000" }), timeoutMs: job.timeoutMs, logFile: `${job.dir}.log` })
    const status = classifyExit(job.gate, r.code, !!readResult(job.gate, job.dir))
    last = { job, r, status, attempt, seconds: Math.round((Date.now() - t0) / 100) / 10 }
    if (status !== "tool") break
    log(`  도구 실패 → ${attempt <= a.retries ? "다시" : "포기"}: ${job.id}`)
  }
  return last
}

function cellsOf({ job, r, status, attempt, seconds }) {
  const json = readResult(job.gate, job.dir)
  const note = status === "tool" ? (r.timedOut ? "기한 초과" : r.tail.split(/\r?\n/).filter(Boolean).slice(-2).join(" | ").slice(0, 300)) : status === "args" ? r.tail.slice(0, 300) : ""
  // 도구가 실패하면 쪽 단위 근거가 없다 — 작업에 든 모든 쪽의 셀을 같은 상태로 남긴다(통과로 읽히지 않게)
  const toolFinding = (gate) => (status === "pass" || status === "fail" ? [] : [{ gate, message: `도구 ${status === "tool" ? "실패" : "인자 오류"}: ${note}` }])
  const base = { gate: job.gate, scene: job.scene, width: job.width ?? null, attempt, seconds }
  if (job.gate === "lang") {
    return job.pages.map((path) => {
      const url = json?.pages?.find((p) => new URL(p.url).pathname === path)?.url
      const page = json?.pages?.find((p) => p.url === url)
      const pageStatus = status === "tool" || status === "args" ? status : page ? (page.status === "pass" ? "pass" : "fail") : "tool"
      return { ...base, page: path, status: pageStatus, findings: pageStatus === "pass" ? [] : status === "tool" || status === "args" || !page ? toolFinding("lang").concat(!page && status === "fail" ? [{ gate: "lang", message: "결과에 이 쪽이 없다" }] : []) : extractFindings("lang", json, { url }) }
    })
  }
  if (job.gate === "signed-out") {
    return job.pages.map((path) => {
      const page = json?.pages?.find((p) => p.path === path)
      const pageStatus = status === "tool" || status === "args" ? status : page ? (page.pass ? "pass" : "fail") : "tool"
      return { ...base, page: path, status: pageStatus, findings: pageStatus === "pass" ? [] : page ? extractFindings("signed-out", { pages: [page] }) : toolFinding("signed-out") }
    })
  }
  const findings = status === "pass" ? [] : status === "fail" ? extractFindings(job.gate, json) : toolFinding(job.gate)
  return [{ ...base, page: job.pages[0], status, findings }]
}

/** 간단한 풀: 작업을 n 개까지 동시에 */
async function pool(items, n, fn) {
  const out = []
  let i = 0
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) {
      const k = i++
      out[k] = await fn(items[k], k)
    }
  }))
  return out
}

/** 이전 실행의 셀: summary.json({ cells }) 또는 cells.jsonl(줄마다 셀 하나) */
export function readPrevCells(file) {
  const text = readFileSync(file, "utf8")
  if (file.endsWith(".jsonl")) return text.split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l))
  return JSON.parse(text).cells ?? []
}

/** 이 러너가 남긴 Chrome·node 가 없는지 명령줄 경로로 확인한다(임시 폴더가 내 것이라 이 경로만 본다) */
function leftovers(tmpRoot, serverPid) {
  if (!WIN) return []
  const ps = `Get-CimInstance Win32_Process | Where-Object { $_.ProcessId -ne $PID -and $_.CommandLine -and ($_.CommandLine -like '*${tmpRoot.replace(/'/g, "''")}*' -or $_.ProcessId -eq ${serverPid ?? 0}) } | | Where-Object { Get-Process -Id $_.ProcessId -ErrorAction SilentlyContinue } | ForEach-Object { "$($_.ProcessId) $($_.Name)" }` // CIM 은 막 끝난 프로세스를 잠시 더 보여 주므로 실제로 살아 있는 것만 센다
  const r = spawnSync("powershell", ["-NoProfile", "-Command", ps], { encoding: "utf8" })
  return (r.stdout ?? "").split(/\r?\n/).filter(Boolean)
}

export async function main(argv) {
  let a
  try { a = parseArgs(argv) } catch (e) { console.error(`template-screens: ${e.message}`); return 2 }
  const minGb = Number(process.env.LF_SCREENS_MIN_FREE_GB || 3)
  const log = (m) => console.log(m)
  const t0 = Date.now()
  if (!existsSync(join(WF_HOME(), "factory", "qa", "a11y-gate.mjs"))) { console.error(`template-screens: WF_HOME(${WF_HOME()}) 에 web-factory 관문 도구가 없다`); return 2 }
  mkdirSync(a.out, { recursive: true })
  // 아래에서 summary.json·cells.jsonl 을 지우기 전에 읽는다(같은 파일일 수 있다). summary.json 이나 cells.jsonl 둘 다 받는다
  const prevCells = a.resume ? readPrevCells(a.resume) : []
  const cellsFile = join(a.out, "cells.jsonl")
  rmSync(join(a.out, "summary.json"), { force: true })
  rmSync(cellsFile, { force: true })
  const tmpRoot = join(a.out, "tmp")
  rmSync(tmpRoot, { recursive: true, force: true })
  mkdirSync(tmpRoot, { recursive: true })
  const wfCommit = spawnSync("git", ["-C", WF_HOME(), "rev-parse", "--short", "HEAD"], { encoding: "utf8" }).stdout.trim()

  let server
  let cells = []
  let toolErrors = []
  let plan = []
  let dynamic = []
  let buildInfo
  try {
    buildInfo = await build(a, minGb)
    log(`빌드 ${buildInfo.skipped ? "건너뜀(--skip-build)" : `${buildInfo.seconds}초`}`)
    await waitForMemory(minGb, { log })
    server = await startServer()
    log(`서버 ${server.origin} (pid ${server.pid})`)

    // 쪽 목록: 앱 경로에서(새 쪽이 빠지지 않게). 보호된 쪽은 서버에 물어 정한다
    const found = routesFromApp(join(TEMPLATE, "app"))
    dynamic = found.dynamic
    let routes = found.routes
    if (a.only) routes = routes.filter((r) => a.only.includes(r))
    const protectedPaths = []
    let sentinel = null // 서버 응답만으로 「로그아웃」이 보이는 보호된 쪽 — 끝에서 다시 두드려 장면이 오염되지 않았는지 본다
    for (const path of routes) {
      const r = await probe(server.origin, path, SCENE_OUT)
      if (isProtected(path, r.status, r.location, r.html)) protectedPaths.push(path)
      if (!sentinel && (r.signInRedirect || r.prompt)) sentinel = path
    }
    plan = buildPlan(routes, { protectedPaths })
    log(`쪽 ${plan.length}개(보호 ${protectedPaths.length}개 · 동적 ${dynamic.length}개 제외) × 장면 → 작업을 만든다`)

    // 장면 정찰: 장면마다 서버가 표지를 달고(로그인 장면) 보호된 쪽이 열리는지(로그인) / 로그인으로 가는지(로그아웃)
    for (const p of plan) for (const scene of p.scenes) {
      const r = await probe(server.origin, p.path, scene)
      const signedIn = scene !== SCENE_OUT
      const problems = []
      if (signedIn && r.marker !== scene) problems.push(`data-wf-session 표지 ${JSON.stringify(r.marker)} (기대 ${scene})`)
      if (signedIn && (r.signInRedirect || r.prompt)) problems.push("로그인 장면인데 로그인 안내·이동이 나온다")
      if (!signedIn && r.marker) problems.push(`로그아웃 장면에 표지가 있다(${r.marker})`)
      if (r.status >= 400) problems.push(`HTTP ${r.status}`)
      if (problems.length) cells.push({ gate: "scene-probe", page: p.path, scene, width: null, status: "tool", attempt: 1, seconds: 0, findings: [{ gate: "scene-probe", message: problems.join("; ") }] })
    }

    let jobs = buildJobs(plan, server.origin, a, a.out)
    // --resume <이전 summary.json>: 도구 실패가 아니었던 작업의 셀은 그대로 가져오고 나머지만 다시 돌린다(부하로 기한을 넘긴 것만 다시)
    if (a.resume) {
      const prev = prevCells
      const keep = (j) => {
        const mine = prev.filter((c) => c.gate === j.gate && c.scene === j.scene && (c.width ?? null) === (j.width ?? null) && j.pages.includes(c.page))
        if (a.rerun.includes(j.gate) || a.rerun.includes(`scene:${j.scene}`)) return null // --rerun a11y,scene:signed-out
        return mine.length === j.pages.length && mine.every((c) => c.status === "pass" || c.status === "fail") ? mine : null
      }
      const carried = []
      jobs = jobs.filter((j) => {
        const k = keep(j)
        if (k) carried.push(...k)
        return !k
      })
      cells.push(...carried)
      if (carried.length) appendFileSync(cellsFile, carried.map((c) => JSON.stringify(c)).join("\n") + "\n")
      log(`--resume: 이전 셀 ${carried.length}개를 가져오고 ${jobs.length}개 작업만 다시 돈다`)
    }
    log(`작업 ${jobs.length}개(동시 ${a.concurrency})`)
    let done = 0
    // qa:signed-out 은 먼저, 혼자 돌린다 — 이 도구는 쪽을 연 직후 링크를 모으는데 스트리밍 쪽이 늦게 그려지면 부하에서 「링크 없음」으로 어긋난다(첫 전체 실행에서 7쪽이 모두 그렇게 나왔고, 혼자 돌리면 한 쪽만 실패했다)
    const first = jobs.filter((j) => j.gate === "signed-out")
    const rest = jobs.filter((j) => j.gate !== "signed-out")
    const run1 = async (job) => {
      const res = await runJob(job, a, minGb, tmpRoot, log)
      log(`[${++done}/${jobs.length}] ${res.status.toUpperCase().padEnd(4)} ${job.id} (${res.seconds}s${res.attempt > 1 ? ` · 시도 ${res.attempt}` : ""})`)
      // 작업이 끝날 때마다 셀을 줄 단위로 남긴다 — 러너가 중간에 죽어도 --resume 이 이어 받는다
      const mine = cellsOf(res)
      appendFileSync(cellsFile, mine.map((c) => JSON.stringify(c)).join("\n") + "\n")
      return mine
    }
    cells.push(...(await pool(first, 1, run1)).flat())
    cells.push(...(await pool(rest, a.concurrency, run1)).flat())
    // 오염 검사: 관문이 화면에서 로그인을 눌렀어도 로그아웃 장면은 여전히 로그아웃이어야 한다(LF_MOCK_SCENES=1 — template/lib/mock-scene.ts effectiveScene)
    if (sentinel) {
      const r = await probe(server.origin, sentinel, SCENE_OUT)
      if (!(r.signInRedirect || r.prompt)) cells.push({ gate: "scene-probe", page: sentinel, scene: SCENE_OUT, width: null, status: "tool", attempt: 1, seconds: 0, findings: [{ gate: "scene-probe", message: "관문을 다 돌린 뒤 로그아웃 장면이 로그인 안내를 안 그린다 — 장면이 오염됐다" }] })
    }
  } catch (e) {
    toolErrors.push(String(e.message ?? e))
    console.error(`template-screens: ${e.message}`)
  } finally {
    if (server) killTree(server.pid)
    await sleep(500)
  }
  const left = leftovers(tmpRoot, server?.pid)
  for (const l of left) { killTree(Number(l.split(" ")[0])) }
  let left2 = []
  if (left.length) { await sleep(3000); left2 = leftovers(tmpRoot, server?.pid) }
  // 임시 폴더는 Chrome 이 막 끝나도 잠시 잠겨 있다 — 못 지워도 결과를 잃지 않게 다시 시도하고, 그래도 안 되면 알린다(요약은 이 뒤에 쓴다)
  let tmpLeft = false
  for (let i = 0; i < 5; i++) {
    try { rmSync(tmpRoot, { recursive: true, force: true }); tmpLeft = false; break } catch { tmpLeft = true; await sleep(2000) }
  }
  if (tmpLeft) toolErrors.push(`임시 폴더를 못 지웠다: ${tmpRoot}`)

  const agg = aggregate(cells)
  const ok = agg.ok && toolErrors.length === 0 && left2.length === 0
  const summary = {
    ok,
    startedAt: new Date(t0).toISOString(),
    seconds: Math.round((Date.now() - t0) / 1000),
    wfHome: WF_HOME(),
    wfCommit,
    gates: a.gates,
    build: buildInfo ?? null,
    pages: plan.map((p) => ({ path: p.path, scenes: p.scenes, protected: p.protected, billing: p.billing })),
    dynamicPagesNotCovered: dynamic,
    counts: agg.counts,
    toolErrors,
    leftoverProcesses: left2,
    findings: agg.findings,
    findingGroups: groupFindings(agg.findings),
    cells,
  }
  writeFileSync(join(a.out, "summary.json"), JSON.stringify(summary, null, 2) + "\n")
  const table = renderTable(cells.filter((c) => c.gate !== "scene-probe"))
  const groups = summary.findingGroups.map((g) => `- [${g.gate}] ${g.message}\n  쪽 ${g.pages.length}: ${g.pages.join(", ")} · 장면: ${g.scenes.join(", ")} · 너비: ${g.widths.join(", ")}`).join("\n")
  writeFileSync(join(a.out, "summary.md"), `${table}\n\n## 발견(원인별)\n\n${groups || "없음"}\n`)
  console.log(`\n${table}\n`)
  console.log(`셀 ${agg.counts.cells} — 통과 ${agg.counts.pass} · 실패 ${agg.counts.fail} · 도구 실패 ${agg.counts.tool} · 인자 오류 ${agg.counts.args} · 발견 ${agg.findings.length}건 · ${summary.seconds}초`)
  if (left2.length) console.error(`남은 프로세스: ${left2.join(", ")}`)
  console.log(`결과: ${join(a.out, "summary.json")}`)
  return ok ? 0 : 1
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(await main(process.argv.slice(2)))
