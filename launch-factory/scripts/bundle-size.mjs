#!/usr/bin/env node
// 템플릿 클라이언트 JS 크기 측정(LFOBS2). 빌드된 `.next` 를 mock 으로 켜서 쪽마다 HTML 이 처음 받는 스크립트(first-load)를 gzip 으로 더하고,
// `.next/static/chunks` 전체의 gzip 합도 낸다. 사용: node scripts/bundle-size.mjs <템플릿 폴더> [포트] — 먼저 `LF_MODE=mock npm run build -w template` 이 있어야 한다.
// 이미 켜 둔 서버(예: live 빌드)를 쓰려면 포트 자리에 `--url http://localhost:3000` 을 준다 — 이 스크립트는 서버를 켜지도 끄지도 않는다.
// first-load = 쪽 HTML 의 `<script src>`(nomodule 제외)와 `<link rel=preload as=script>` 의 서로 다른 .js 의 gzip 합. 동적 import 로 나중에 받는 조각은 넣지 않는다.
import { spawn, spawnSync } from "node:child_process"
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { join, resolve } from "node:path"
import { gzipSync } from "node:zlib"

const dir = resolve(process.argv[2] ?? "template")
const urlArg = process.argv[3] === "--url" ? process.argv[4]?.replace(/\/$/, "") : undefined
const port = Number(urlArg ? 0 : (process.argv[3] ?? 3431))
const base = urlArg ?? `http://localhost:${port}`
const ROUTES = ["/", "/pricing", "/sign-in", "/sign-up", "/forgot-password", "/contact", "/privacy", "/terms", "/refund"]
const next = join(dir, "..", "node_modules", "next", "dist", "bin", "next")
if (!existsSync(join(dir, ".next", "BUILD_ID"))) throw new Error(`${dir}/.next 가 없다 — 먼저 빌드한다`)

const gz = (file) => gzipSync(readFileSync(file)).length
function walk(d) {
  return readdirSync(d).flatMap((n) => {
    const p = join(d, n)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
}
const all = walk(join(dir, ".next", "static", "chunks")).filter((p) => p.endsWith(".js"))
const total = { files: all.length, raw: all.reduce((s, p) => s + statSync(p).size, 0), gzip: all.reduce((s, p) => s + gz(p), 0) }

const env = { ...process.env, LF_MODE: "mock", LF_ALLOW_MOCK_PROD: "1", NEXT_TELEMETRY_DISABLED: "1" }
const child = urlArg ? undefined : spawn(process.execPath, [next, "start", "-p", String(port)], { cwd: dir, env, stdio: ["ignore", "pipe", "pipe"] })
let log = ""
child?.stdout.on("data", (d) => (log += d))
child?.stderr.on("data", (d) => (log += d))
const stop = () => {
  if (child && child.exitCode === null && child.pid !== undefined) spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" })
}
process.on("exit", stop)
try {
  if (child) {
    for (let i = 0; i < 120 && !/Ready in/.test(log); i++) await new Promise((r) => setTimeout(r, 500))
    if (!/Ready in/.test(log)) throw new Error(`서버가 안 켜졌다: ${log.slice(-500)}`)
  }
  const rows = []
  for (const route of ROUTES) {
    const res = await fetch(`${base}${route}`)
    const html = await res.text()
    const urls = new Set()
    for (const m of html.matchAll(/<script\b[^>]*>/g)) {
      const tag = m[0]
      const src = /\bsrc="([^"]+\.js)[^"]*"/.exec(tag)
      if (src && !/no-?module/i.test(tag)) urls.add(src[1])
    }
    for (const m of html.matchAll(/<link\b[^>]*rel="preload"[^>]*as="script"[^>]*>/g)) {
      const href = /href="([^"]+\.js)[^"]*"/.exec(m[0])
      if (href) urls.add(href[1])
    }
    let raw = 0
    let gzip = 0
    const files = []
    for (const u of urls) {
      const rel = decodeURIComponent(u.replace(/^\/_next\//, ""))
      const p = join(dir, ".next", rel)
      if (!existsSync(p)) continue
      raw += statSync(p).size
      gzip += gz(p)
      files.push(rel.split("/").pop())
    }
    rows.push({ route, status: res.status, scripts: files.length, raw, gzip })
  }
  console.log(JSON.stringify({ dir, total, rows }, null, 1))
  console.log("\n| 쪽 | 상태 | 스크립트 | 원본 B | gzip B |\n|---|---|---|---|---|")
  for (const r of rows) console.log(`| ${r.route} | ${r.status} | ${r.scripts} | ${r.raw.toLocaleString("en-US")} | ${r.gzip.toLocaleString("en-US")} |`)
  console.log(`| (static/chunks 전체) | | ${total.files} | ${total.raw.toLocaleString("en-US")} | ${total.gzip.toLocaleString("en-US")} |`)
} finally {
  stop()
}
