#!/usr/bin/env node
// LFADB 걸어 보기용 mock 서버(docs/qa/ux-audit/apply-lfadb.md). template 을 LF_MODE=mock 으로 한 번 빌드하고(`--skip-build` 면 있는 빌드를 쓴다) `next start` 를 장면 모드(LF_MOCK_SCENES=1)로 띄운다.
// 출력의 첫 줄 `READY <origin> <서버 pid> <이 스크립트 pid>` 를 걷기 스크립트(adb-walk.mjs)가 읽는다. 끝낼 때는 pid 를 트리째 죽인다(taskkill /T) — 이 스크립트가 띄운 것만 PID 로 정리한다.
// 사용: node scripts/adb-serve.mjs [--skip-build] [--no-scenes [--sub none]] [--port 3461]
import { spawn, spawnSync } from "node:child_process"
import { existsSync } from "node:fs"
import { createRequire } from "node:module"
import net from "node:net"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = fileURLToPath(new URL("..", import.meta.url))
const TEMPLATE = join(ROOT, "template")
const WIN = process.platform === "win32"
const PROVIDER_ENV = ["DATABASE_URL", "BETTER_AUTH_SECRET", "PADDLE_API_KEY", "PADDLE_WEBHOOK_SECRET", "RESEND_API_KEY", "POSTHOG_PROJECT_KEY", "SENTRY_DSN", "TURNSTILE_SECRET_KEY", "EMAIL_FROM", "NEXT_PUBLIC_APP_URL", "CRON_SECRET", "SUBJECT_REF_KEY", "TURNSTILE_SITE_KEY", "INQUIRY_OWNER_EMAIL", "PADDLE_CLIENT_TOKEN", "LF_MODE", "POSTHOG_HOST", "LF_MOCK_SUB", "NODE_ENV", "WF_SESSION"]
const cleanEnv = (extra = {}) => {
  const env = { ...process.env, NEXT_TELEMETRY_DISABLED: "1", CI: "1" }
  for (const n of PROVIDER_ENV) delete env[n]
  return { ...env, ...extra }
}
const killTree = (pid) => {
  if (pid === undefined) return
  if (WIN) spawnSync("taskkill", ["/pid", String(pid), "/T", "/F"], { stdio: "ignore" })
  else try { process.kill(-pid, "SIGKILL") } catch { /* 이미 끝남 */ }
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

const args = process.argv.slice(2)
const skipBuild = args.includes("--skip-build")
// --no-scenes: 장면 쿠키 없이 예전 mock(프로세스 하나의 목 포트 — 화면에서 한 로그인·해지가 요청 사이에 이어진다). 해지 예약 같은 「여러 쪽을 거치는 상태」를 걸을 때 쓴다
const noScenes = args.includes("--no-scenes")
// --sub <상태>: 장면 쿠키 없는 서버의 처음 구독 상태(LF_MOCK_SUB — none·trialing·active …). 결제 뒤 상태가 쪽을 건너 이어지는 걷기(P1C)에 쓴다
const sub = args.indexOf("--sub") >= 0 ? args[args.indexOf("--sub") + 1] : ""
const portArg = args.indexOf("--port") >= 0 ? Number(args[args.indexOf("--port") + 1]) : 0

if (!(skipBuild && existsSync(join(TEMPLATE, ".next", "BUILD_ID")))) {
  console.error("build: LF_MODE=mock npm run build …")
  const b = spawn(WIN ? "npm.cmd" : "npm", ["run", "build"], { cwd: TEMPLATE, env: cleanEnv({ LF_MODE: "mock", LF_ALLOW_MOCK_PROD: "1" }), shell: WIN, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] })
  let log = ""
  b.stdout.on("data", (d) => (log += d))
  b.stderr.on("data", (d) => (log += d))
  const code = await new Promise((r) => b.on("close", r))
  killTree(b.pid)
  if (code !== 0) {
    console.error(log.slice(-3000))
    process.exit(1)
  }
  console.error("build: 종료 0")
}

const port = portArg || (await freePort())
const nextBin = createRequire(join(TEMPLATE, "package.json")).resolve("next/dist/bin/next")
const server = spawn(process.execPath, [nextBin, "start", "-p", String(port), "-H", "127.0.0.1"], { cwd: TEMPLATE, env: cleanEnv({ ...(noScenes ? { LF_MODE: "mock", LF_ALLOW_MOCK_PROD: "1" } : { LF_MODE: "mock", LF_ALLOW_MOCK_PROD: "1", LF_MOCK_SCENES: "1" }), ...(sub ? { LF_MOCK_SUB: sub } : {}) }), windowsHide: true, stdio: ["ignore", "pipe", "pipe"] })
let text = ""
server.stdout.on("data", (d) => (text += d))
server.stderr.on("data", (d) => (text += d))
const end = Date.now() + 90_000
while (Date.now() < end && !/Ready in/.test(text)) {
  if (server.exitCode !== null) {
    console.error(text.slice(-1500))
    process.exit(1)
  }
  await new Promise((r) => setTimeout(r, 300))
}
if (!/Ready in/.test(text)) {
  killTree(server.pid)
  console.error(text.slice(-1500))
  process.exit(1)
}
console.log(`READY http://127.0.0.1:${port} ${server.pid} ${process.pid}`)
const stop = () => {
  killTree(server.pid)
  process.exit(0)
}
process.on("SIGINT", stop)
process.on("SIGTERM", stop)
// 서버가 먼저 끝나면 같이 끝낸다
server.on("exit", () => process.exit(0))
setInterval(() => {}, 1 << 30)
