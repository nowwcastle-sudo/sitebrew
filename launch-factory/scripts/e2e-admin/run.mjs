#!/usr/bin/env node
// 관리 화면 브라우저 시험 — `npm run e2e:admin`. 방문자가 남긴 기록(문의·예약·예약금·후기·뉴스레터·주문·가입자)을 운영자가 /admin 에서 다루는 길을 진짜 브라우저로 돈다.
//   1) template/ 를 .e2e-admin/ 로 복사(원본은 건드리지 않는다) → 사본에서만 관리자 스위치(AUTH_FEATURES)를 켠다
//   2) mock 으로 빌드 → 시험 전용 시드(admin-seed.preload.mjs)와 함께 `next start` → Playwright(admin.spec.ts)
//   node scripts/e2e-admin/run.mjs [--keep] [--skip-build]   (--keep: 끝나도 사본·빌드를 지우지 않는다 · --skip-build: 지난 사본·빌드를 그대로 쓴다 — 시험 코드만 고칠 때, 사본이 남아 있어야 한다)
// 종료 0 통과 · 1 실패 · 3 브라우저 없음(로컬에서만 — CI 는 브라우저가 없으면 실패).
// 서버는 기록(DB)을 메모리에 두므로 매 실행이 새 서버다. 띄운 서버·브라우저는 PID 나무째 끝낸다.
import { spawn, spawnSync } from "node:child_process"
import { cpSync, createWriteStream, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import net from "node:net"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { pickBrowser } from "../../template/scripts/ci/smoke-lib.mjs"
import { buildEnv, copyFilter, serverEnv, testEnv, withAdminFeatures } from "./plan.mjs"

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, "..", "..")
const WIN = process.platform === "win32"
const IN_CI = process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true"
const require = createRequire(import.meta.url)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const OUT = join(ROOT, ".tmp", "e2e-admin")
// 사본은 저장소 뿌리 바로 아래에 둔다 — next.config.ts 가 「한 칸 위에 packages/ 가 있으면 워크스페이스」로 Turbopack 뿌리를 잡기 때문이다(.gitignore 에 올라 있다)
const PRODUCT = join(ROOT, ".e2e-admin")

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

const freePort = () =>
  new Promise((ok, bad) => {
    const s = net.createServer()
    s.once("error", bad)
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address()
      s.close(() => ok(port))
    })
  })

/** 자식을 끝까지 돌리고 출력을 파일(과 화면)에 남긴다. { code, tail } */
function runLogged(args, { cwd, env, logFile, echo = false }) {
  return new Promise((done) => {
    mkdirSync(dirname(logFile), { recursive: true })
    const log = createWriteStream(logFile)
    const child = spawn(process.execPath, args, { cwd, env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"], detached: !WIN })
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
      killTree(child.pid)
      log.end()
      done({ code, tail: tail.join("").slice(-2500) })
    })
    child.on("error", (e) => done({ code: 1, tail: String(e) }))
  })
}

/** 1) 사본 만들기 + 관리자 스위치 켜기 */
function prepareProduct() {
  rmSync(PRODUCT, { recursive: true, force: true })
  mkdirSync(OUT, { recursive: true })
  const src = join(ROOT, "template")
  cpSync(src, PRODUCT, { recursive: true, filter: (p) => copyFilter(p.slice(src.length + 1)) })
  const features = join(PRODUCT, "lib", "launch", "features.ts")
  writeFileSync(features, withAdminFeatures(readFileSync(features, "utf8")))
}

/** 2) 서버를 띄워 응답이 올 때까지 기다린다 */
async function startServer(env, port) {
  const nextBin = createRequire(join(PRODUCT, "package.json")).resolve("next/dist/bin/next")
  const log = createWriteStream(join(OUT, "server.log"))
  const child = spawn(process.execPath, [nextBin, "start", "-p", String(port), "-H", "127.0.0.1"], { cwd: PRODUCT, env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"], detached: !WIN })
  let exited = null
  child.stdout.on("data", (d) => log.write(d))
  child.stderr.on("data", (d) => log.write(d))
  child.on("exit", (c) => (exited = c ?? "signal"))
  const stop = () => (killTree(child.pid), log.end())
  for (let i = 0; i < 120; i++) {
    if (exited !== null) return { ok: false, reason: `서버가 켜지다 종료 ${exited}`, stop }
    try {
      const res = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(5000), redirect: "manual" })
      await res.arrayBuffer()
      return { ok: true, stop }
    } catch {
      await sleep(500)
    }
  }
  stop()
  return { ok: false, reason: "서버가 60초 안에 응답하지 않았다", stop: () => {} }
}

async function pickChannel() {
  const { chromium } = await import("@playwright/test")
  const bundled = (() => {
    try {
      return chromium.executablePath()
    } catch {
      return null
    }
  })()
  return pickBrowser({ bundled })
}

export async function main(argv = process.argv.slice(2)) {
  const keep = argv.includes("--keep") || argv.includes("--skip-build")
  try {
    return await runAll(argv)
  } finally {
    // 사본(빌드 부산물 수만 파일)은 린트·검사 도구가 읽지 않도록 치운다. 로그와 보고서는 .tmp/e2e-admin 에 남는다
    if (!keep) rmSync(PRODUCT, { recursive: true, force: true })
  }
}

async function runAll(argv) {
  const skipBuild = argv.includes("--skip-build")
  try {
    require.resolve("@playwright/test/package.json")
  } catch {
    console.log("@playwright/test 가 설치돼 있지 않다 — npm ci 를 먼저")
    return 1
  }
  const browser = await pickChannel()
  if (!browser) {
    console.log("브라우저가 없다 — Chrome·Edge 를 설치하거나 `npx playwright install chromium` 을 한다(CI 는 워크플로가 설치한다)")
    return IN_CI ? 1 : 3
  }
  console.log(`브라우저: ${browser.label}`)

  if (!skipBuild || !existsSync(join(PRODUCT, ".next", "BUILD_ID"))) {
    prepareProduct()
    const nextBin = createRequire(join(PRODUCT, "package.json")).resolve("next/dist/bin/next")
    console.log("빌드(mock, 관리자 스위치 켬)…")
    let b = await runLogged([nextBin, "build"], { cwd: PRODUCT, env: buildEnv(), logFile: join(OUT, "build.log") })
    // Next 가 에이전트 환경에서 보안 권고를 한 번 보이고 멈추는 일이 있다(「같은 명령을 다시 실행하라」) — 코드 문제가 아니므로 한 번만 다시 돈다
    if (b.code !== 0 && b.tail.includes("internal-nudge-id")) {
      console.log("Next 의 보안 권고 안내로 멈췄다 — 같은 빌드를 한 번 다시 한다")
      b = await runLogged([nextBin, "build"], { cwd: PRODUCT, env: buildEnv(), logFile: join(OUT, "build.log") })
    }
    if (b.code !== 0) {
      console.log(`빌드 실패 — ${join(OUT, "build.log")}\n${b.tail}`)
      return 1
    }
  }

  const port = await freePort()
  const outbox = join(OUT, "outbox.jsonl")
  const twoFactorFile = join(OUT, "2fa")
  rmSync(outbox, { force: true })
  rmSync(twoFactorFile, { force: true })
  const server = await startServer(serverEnv({ outbox, twoFactorFile, preload: join(HERE, "admin-seed.preload.mjs") }), port)
  if (!server.ok) {
    console.log(`서버 시작 실패: ${server.reason} — ${join(OUT, "server.log")}`)
    return 1
  }
  try {
    const cli = require.resolve("@playwright/test/cli")
    const env = testEnv({ port, outbox, twoFactorFile, outDir: join(OUT, "run"), channel: browser.channel })
    const r = await runLogged([cli, "test", "-c", join(HERE, "playwright.config.ts")], { cwd: PRODUCT, env, logFile: join(OUT, "playwright.log"), echo: true })
    console.log(r.code === 0 ? "관리 화면 시험 통과" : `관리 화면 시험 실패 — ${join(OUT, "playwright.log")}`)
    return r.code === 0 ? 0 : 1
  } finally {
    server.stop()
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) process.exitCode = await main()
