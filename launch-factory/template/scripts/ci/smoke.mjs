#!/usr/bin/env node
// 빌드 스모크(LFSMOKE) — `npm run smoke`. 제품(여기서는 template/)을 실제로 빌드해 `next start` 로 띄우고 Playwright 로 본다.
//   1) mock 모드: LF_MODE=mock LF_MOCK_SCENES=1 빌드 → 장면 정찰 · 쪽 × 장면 200 · 오류 경계 없음 · axe(경고 + 기준선)
//   2) live 모드: 필수 환경 이름만 가짜 값(smoke-lib.mjs LIVE_DUMMY)으로 빌드 → 서버가 켜지고 `/` 가 그려지는가 — 「선택 이름이 없어도 켜진다」를 지킨다(INQUIRY_OWNER_EMAIL·POSTHOG_HOST 사고)
//   node scripts/ci/smoke.mjs [--mode mock|live|all] [--skip-build] [--update-axe-baseline]
// 종료 0 통과 · 1 실패 · 3 브라우저 없음(로컬에서만 — CI 는 브라우저가 없으면 실패다. ci:verify 가 「건너뜀(이유)」으로 표시한다).
// 환경: SMOKE_CHANNEL(설치된 브라우저: chrome·msedge) · LF_SMOKE_MIN_FREE_GB(빌드 전 빈 메모리 문턱, 기본 3.0 — 모자라면 2분씩 기다린다) · SMOKE_AXE_STRICT=1(새 axe 위반도 실패로 센다)
// 띄운 서버·브라우저는 PID 나무째 끝낸다(끝에 포트가 닫혔는지 확인). 다른 프로세스는 건드리지 않는다.
import { spawn, spawnSync } from "node:child_process"
import { appendFileSync, createWriteStream, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import net from "node:net"
import os from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { IN_CI, ROOT } from "./run-steps.mjs"
import { cleanEnv, compareAxe, modeEnv, pickBrowser, readAxeBaseline, readAxeRecords, summarizeStats } from "./smoke-lib.mjs"

const WIN = process.platform === "win32"
const NPM = WIN ? "npm.cmd" : "npm"
const OUT = join(ROOT, ".tmp", "smoke")
const require = createRequire(import.meta.url)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const sec = (t0) => Math.round((Date.now() - t0) / 100) / 10

export function parseArgs(argv) {
  const a = { mode: "all", skipBuild: false, updateAxe: false }
  const rest = [...argv]
  while (rest.length) {
    const t = rest.shift()
    if (t === "--mode") a.mode = rest.shift()
    else if (t === "--skip-build") a.skipBuild = true
    else if (t === "--update-axe-baseline") a.updateAxe = true
    else throw new Error(`모르는 인자: ${t}`)
  }
  if (!["mock", "live", "all"].includes(a.mode)) throw new Error("--mode 는 mock|live|all")
  return a
}

// ── 프로세스·메모리 ─────────────────────────────────────────────────────────────────────
/** 내가 띄운 PID 의 나무를 끝낸다(다른 프로세스는 건드리지 않는다) */
function killTree(pid) {
  if (pid === undefined) return
  if (WIN) spawnSync("taskkill", ["/pid", String(pid), "/T", "/F"], { stdio: "ignore" })
  else {
    try {
      process.kill(-pid, "SIGKILL")
    } catch {
      /* 이미 끝남 */
    }
  }
}

/** 쓸 수 있는 메모리(GB). 리눅스는 캐시를 뺀 MemFree 가 아니라 MemAvailable 을 읽는다 */
export function freeGb() {
  if (process.platform === "linux") {
    try {
      const m = /MemAvailable:\s+(\d+) kB/.exec(readFileSync("/proc/meminfo", "utf8"))
      if (m) return Number(m[1]) / 2 ** 20
    } catch {
      /* 아래로 */
    }
  }
  return os.freemem() / 2 ** 30
}

/** 빈 메모리가 문턱 이상이 될 때까지 2분 단계로 기다린다. 끝내 모자라면 던진다 — 모자란 채로 빌드·Chrome 을 띄우지 않는다 */
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

const freePort = () =>
  new Promise((ok, bad) => {
    const s = net.createServer()
    s.once("error", bad)
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address()
      s.close(() => ok(port))
    })
  })

const portOpen = (port) =>
  new Promise((ok) => {
    const s = net.connect({ port, host: "127.0.0.1" })
    s.once("connect", () => (s.destroy(), ok(true)))
    s.once("error", () => ok(false))
  })

/** 자식을 끝까지 돌리고 출력을 파일에 남긴다. 종료 코드를 돌려준다 */
function runLogged(cmd, args, { cwd, env, logFile, echo = false }) {
  return new Promise((done) => {
    mkdirSync(join(logFile, ".."), { recursive: true })
    const log = createWriteStream(logFile)
    // Windows 의 npm.cmd 는 셸이 필요하다 — 인자를 따로 주면 Node 가 경고(DEP0190)하므로 한 줄로 붙인다(인자는 모두 이 파일이 정한 고정값)
    const child = WIN && cmd.endsWith(".cmd") ? spawn(`${cmd} ${args.join(" ")}`, { cwd, env, shell: true, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }) : spawn(cmd, args, { cwd, env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"], detached: !WIN })
    const tail = []
    const onData = (d) => {
      log.write(d)
      if (echo) process.stdout.write(d)
      tail.push(String(d))
      if (tail.length > 40) tail.shift()
    }
    child.stdout.on("data", onData)
    child.stderr.on("data", onData)
    child.on("close", (code) => {
      killTree(child.pid) // 남은 자손이 있으면 같이
      log.end()
      done({ code, tail: tail.join("").slice(-2500) })
    })
    child.on("error", (e) => done({ code: 1, tail: String(e) }))
  })
}

// ── 빌드·서버 ───────────────────────────────────────────────────────────────────────────
async function buildFor(mode, env) {
  const t0 = Date.now()
  const r = await runLogged(NPM, ["run", "build"], { cwd: ROOT, env, logFile: join(OUT, mode, "build.log") })
  const ok = r.code === 0 && existsSync(join(ROOT, ".next", "BUILD_ID"))
  if (ok) writeFileSync(join(OUT, "last-build-mode"), mode)
  return { ok, seconds: sec(t0), tail: r.tail }
}

/** next start 를 띄워 응답이 올 때까지 기다린다. 응답이 오면 상태 코드는 따지지 않는다(그것은 시험이 본다). 먼저 죽으면 실패 */
async function startServer(mode, env, port) {
  const t0 = Date.now()
  const nextBin = require.resolve("next/dist/bin/next")
  const logFile = join(OUT, mode, "server.log")
  mkdirSync(join(OUT, mode), { recursive: true })
  const log = createWriteStream(logFile)
  const child = spawn(process.execPath, [nextBin, "start", "-p", String(port), "-H", "127.0.0.1"], { cwd: ROOT, env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"], detached: !WIN })
  let exited = null
  let tail = ""
  const onData = (d) => {
    log.write(d)
    tail = (tail + d).slice(-2500)
  }
  child.stdout.on("data", onData)
  child.stderr.on("data", onData)
  child.on("exit", (code) => (exited = code ?? "signal"))
  const stop = () => {
    killTree(child.pid)
    log.end()
  }
  for (let i = 0; i < 120; i++) {
    if (exited !== null) {
      stop()
      return { ok: false, seconds: sec(t0), reason: `서버가 켜지다 종료 ${exited}`, tail, stop: () => {} }
    }
    try {
      const res = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(5000), redirect: "manual" })
      await res.arrayBuffer()
      return { ok: true, seconds: sec(t0), stop, pid: child.pid, tail: () => tail }
    } catch {
      await sleep(500)
    }
  }
  stop()
  return { ok: false, seconds: sec(t0), reason: "서버가 60초 안에 응답하지 않았다", tail, stop: () => {} }
}

async function runPlaywright(mode, port, channel) {
  const t0 = Date.now()
  const outDir = join(OUT, mode)
  const axeOut = join(outDir, "axe.jsonl")
  rmSync(axeOut, { force: true })
  const cli = require.resolve("@playwright/test/cli")
  const env = {
    ...cleanEnv(process.env),
    SMOKE_BASE_URL: `http://127.0.0.1:${port}`,
    SMOKE_OUT: outDir,
    SMOKE_AXE_OUT: axeOut,
    SMOKE_CHANNEL: channel ?? "",
  }
  const r = await runLogged(process.execPath, [cli, "test", `--project=${mode}`], { cwd: ROOT, env, logFile: join(outDir, "playwright.log"), echo: true })
  let stats = null
  try {
    stats = JSON.parse(readFileSync(join(outDir, "results.json"), "utf8")).stats
  } catch {
    /* 보고서가 없으면 Playwright 가 시작도 못 한 것이다 */
  }
  return { code: r.code, seconds: sec(t0), stats, axeOut }
}

// ── axe ─────────────────────────────────────────────────────────────────────────────────
function reportAxe(axeOut, { update }) {
  const { file, known } = readAxeBaseline(ROOT)
  const records = readAxeRecords(axeOut)
  const cmp = compareAxe(records, known)
  const strict = process.env.SMOKE_AXE_STRICT === "1"
  const warn = (title, msg) => console.log(IN_CI ? `::warning title=${title}::${msg}` : `  경고 ${title}: ${msg}`)
  console.log(`\naxe: ${cmp.cells}개 셀 · 위반 ${cmp.seen.length}건(기준선 ${known.length}건) · 새 위반 ${cmp.fresh.length} · 기준선에서 사라짐 ${cmp.fixed.length}${strict ? " · 엄격(새 위반은 실패)" : " · 경고(막지 않음)"}`)
  for (const k of cmp.fresh.slice(0, 25)) warn("axe 새 위반", k)
  if (cmp.fresh.length > 25) console.log(`  … 새 위반 ${cmp.fresh.length - 25}건 더(.tmp/smoke/mock/axe.jsonl)`)
  for (const k of cmp.fixed.slice(0, 25)) warn("axe 고쳐짐 — 기준선에서 지운다", k)
  if (update) {
    writeFileSync(file, `${JSON.stringify({ note: "axe 알려진 위반(쪽|장면|규칙). 새 위반은 경고, 줄이기만 한다 — npm run smoke -- --mode mock --update-axe-baseline 로 갱신하고 diff 를 사람이 본다", known: cmp.seen }, null, 2)}\n`)
    console.log(`axe 기준선을 ${cmp.seen.length}건으로 썼다: ${file}`)
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `\n**axe**: 위반 ${cmp.seen.length}건 · 새 위반 ${cmp.fresh.length} · 기준선에서 사라짐 ${cmp.fixed.length}\n`)
  }
  return strict && (cmp.fresh.length > 0 || cmp.fixed.length > 0) ? 1 : 0
}

// ── 한 모드 ─────────────────────────────────────────────────────────────────────────────
async function runMode(mode, a, channel) {
  const res = { mode, ok: false, steps: {} }
  const env = modeEnv(mode)
  console.log(`\n::group::▶ smoke ${mode}`)
  const minGb = Number(process.env.LF_SMOKE_MIN_FREE_GB || 3)
  const lastBuilt = existsSync(join(OUT, "last-build-mode")) ? readFileSync(join(OUT, "last-build-mode"), "utf8").trim() : null
  if (a.skipBuild && lastBuilt === mode && existsSync(join(ROOT, ".next", "BUILD_ID"))) {
    console.log(`빌드 건너뜀(--skip-build, 마지막 빌드가 ${mode})`)
    res.steps.build = 0
  } else {
    if (!IN_CI) await waitForMemory(minGb).then((g) => console.log(`빈 메모리 ${g.toFixed(1)} GB ≥ ${minGb} GB`))
    console.log(`${mode} 빌드…`)
    const b = await buildFor(mode, env)
    res.steps.build = b.seconds
    if (!b.ok) {
      console.log(`::endgroup::✘ ${mode} 빌드 실패(${b.seconds}s)\n${b.tail}`)
      res.reason = "빌드 실패"
      return res
    }
    console.log(`${mode} 빌드 ${b.seconds}s`)
  }
  const port = await freePort()
  const srv = await startServer(mode, env, port)
  res.steps.start = srv.seconds
  if (!srv.ok) {
    console.log(`::endgroup::✘ ${mode} 서버 시작 실패 — ${srv.reason}\n${srv.tail}`)
    res.reason = srv.reason
    return res
  }
  try {
    console.log(`${mode} 서버 PID ${srv.pid} · 포트 ${port} · 켜지는 데 ${srv.seconds}s`)
    const p = await runPlaywright(mode, port, channel)
    res.steps.tests = p.seconds
    res.stats = p.stats ? summarizeStats(p.stats) : null
    res.ok = p.code === 0 && Boolean(res.stats) && res.stats.total > 0
    if (p.code === 0 && !res.stats?.total) res.reason = "시험이 0개 돌았다 — 통과가 아니다"
    else if (p.code !== 0) res.reason = `Playwright 종료 ${p.code}`
    if (mode === "mock") {
      if (reportAxe(p.axeOut, { update: a.updateAxe })) {
        res.ok = false
        res.reason = (res.reason ? `${res.reason} · ` : "") + "axe 엄격 모드: 새 위반 또는 기준선에서 안 지운 항목"
      }
    }
  } finally {
    srv.stop()
    await sleep(500)
    res.portClosed = !(await portOpen(port))
  }
  console.log(`::endgroup::${res.ok ? "✔" : "✘"} ${mode} ${res.stats?.line ?? res.reason ?? ""}`)
  return res
}

export async function main(argv = process.argv.slice(2)) {
  const a = parseArgs(argv)
  try {
    require.resolve("@playwright/test/package.json") // 워크스페이스에서는 저장소 뿌리 node_modules 에 올라와 있다
  } catch {
    console.log("@playwright/test 가 설치돼 있지 않다 — npm ci 를 먼저")
    return IN_CI ? 1 : 3
  }
  // 브라우저: CI 는 워크플로가 `npx playwright install --with-deps chromium` 한다(번들 chromium). 로컬은 번들 → 설치된 Chrome → Edge 순으로 찾는다
  let channel = null
  if (!IN_CI) {
    const { chromium } = await import("@playwright/test")
    const pick = pickBrowser({ bundled: chromium.executablePath() })
    if (!pick) {
      console.log("브라우저가 없다 — Chrome·Edge 를 설치하거나 `npx playwright install chromium` 을 한다(CI 는 워크플로가 설치한다). 이 PC 에서는 건너뛴다")
      return 3
    }
    channel = pick.channel
    console.log(`브라우저: ${pick.label}`)
  }
  mkdirSync(OUT, { recursive: true })
  const t0 = Date.now()
  const modes = a.mode === "all" ? ["mock", "live"] : [a.mode]
  const results = []
  for (const m of modes) {
    try {
      results.push(await runMode(m, a, channel))
    } catch (e) {
      console.log(e instanceof Error ? e.stack : String(e))
      results.push({ mode: m, ok: false, steps: {}, reason: String(e instanceof Error ? e.message : e) })
    }
  }
  const total = sec(t0)
  const lines = results.map((r) => `  ${r.ok ? "✔" : "✘"} ${r.mode.padEnd(5)} 빌드 ${r.steps.build ?? "-"}s · 켜기 ${r.steps.start ?? "-"}s · 시험 ${r.steps.tests ?? "-"}s · ${r.stats?.line ?? r.reason ?? ""}${r.portClosed === false ? " · 포트가 안 닫혔다!" : ""}`)
  console.log(`\nsmoke 요약\n${lines.join("\n")}\n  합계 ${total}s`)
  writeFileSync(join(OUT, "timings.json"), `${JSON.stringify({ total, results }, null, 2)}\n`)
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### smoke\n\n\`\`\`\n${lines.join("\n")}\n  합계 ${total}s\n\`\`\`\n`)
  const flaky = results.reduce((n, r) => n + (r.stats?.flaky ?? 0), 0)
  if (flaky) console.log(`::warning title=smoke flaky::재시도해서 통과한 시험 ${flaky}개 — 보고서(.tmp/smoke/*/report)에서 어떤 것인지 본다`)
  return results.every((r) => r.ok) ? 0 : 1
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) process.exitCode = await main()
