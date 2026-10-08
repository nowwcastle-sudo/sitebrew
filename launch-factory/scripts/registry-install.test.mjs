// 설치 닫힘 시험(v0 Task 9). 무겁고 네트워크가 필요하다(npm·shadcn CLI·next build) — `npm run registry:install` 로 따로 돌린다.
//   1. 워크스페이스 패키지를 npm pack 으로 묶는다(아직 게시하지 않았으므로 tarball 이 게시본 대역이다)
//   2. 빈 Next 앱(next 16.3.8)을 만들고, 여섯 항목을 **진짜 shadcn CLI(4.21.0)** 로 설치한다 — 네임스페이스 @launch-factory/<이름>
//   3. 설치된 파일 = 항목이 싣는 파일(내용까지), .env.local 에 envVars 이름만, 마이그레이션이 PGlite 에 적용
//   4. next build 종료 0(타입 검사 포함) → next start 로 경로가 실제로 답한다(문의 접수 200·Cron 401·웹훅 키 없음 500)
// 무거운 실행이라 web-factory 공용 잠금 원장 아래에서 돌린다(호출하는 쪽 책임). LF_REGISTRY_KEEP=1 이면 작업 폴더를 남긴다.
import assert from "node:assert/strict"
import { spawn, spawnSync } from "node:child_process"
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { randomBytes } from "node:crypto"
import { createServer } from "node:http"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { ITEM_ORDER } from "./gen-registry.mjs"

const ROOT = fileURLToPath(new URL("..", import.meta.url))
const SHADCN = "4.21.0"
const NPM = process.platform === "win32" ? "npm.cmd" : "npm"
const NPX = process.platform === "win32" ? "npx.cmd" : "npx"
const json = (p) => JSON.parse(readFileSync(p, "utf8"))
const dist = Object.fromEntries(ITEM_ORDER.map((n) => [n, json(join(ROOT, `registry/dist/${n}.json`))]))
const packages = readdirSync(join(ROOT, "packages")).map((d) => ({ dir: join(ROOT, "packages", d), ...json(join(ROOT, "packages", d, "package.json")) }))

/** 항목이 알리는 공통 설정(D183·D184)의 합집합 — 앱은 이 안내대로만 설정한다(안내에 빠진 것이 있으면 빌드가 실패해 드러난다) */
const union = (pick) => [...new Set(Object.values(dist).flatMap((i) => i.meta.launch.setup[pick]))].sort()
const setup = { npmrc: union("npmrc"), transpilePackages: union("transpilePackages"), serverExternalPackages: union("serverExternalPackages") }

const work = mkdtempSync(join(tmpdir(), "lf-registry-install-"))
const app = join(work, "app")
const tgz = join(work, "tgz")
const log = (m) => console.log(`[registry-install] ${m}`)

function run(cmd, args, options = {}) {
  const r = spawnSync(cmd, args, { encoding: "utf8", shell: process.platform === "win32", maxBuffer: 64 * 1024 * 1024, ...options, env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1", CI: "1", ...options.env } })
  return { ...r, out: `${r.stdout ?? ""}${r.stderr ?? ""}` }
}
const ok = (r, what) => assert.equal(r.status, 0, `${what} failed (exit ${r.status}):\n${r.out.slice(-3500)}`)

test.after(() => {
  if (process.env.LF_REGISTRY_KEEP === "1") log(`kept ${work}`)
  else rmSync(work, { recursive: true, force: true })
})

/** 비동기 실행(같은 프로세스의 대역 저장소가 응답해야 하므로 spawnSync 를 쓰지 않는다) */
function runAsync(cmd, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { shell: process.platform === "win32", ...options, env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1", CI: "1", ...options.env } })
    let out = ""
    child.stdout.on("data", (d) => (out += d))
    child.stderr.on("data", (d) => (out += d))
    child.on("close", (status) => resolve({ status, out }))
  })
}

/**
 * 게시본 대역: @launch-factory/* 만 답하는 최소 npm 저장소(packument + tarball). 아직 게시하지 않은 패키지를 shadcn CLI 가
 * 하는 그대로(`npm install @launch-factory/x@0.0.0`) 받게 한다. 나머지 패키지는 진짜 npm 저장소에서 받는다(.npmrc 는 이 범위만 바꾼다).
 */
function startStandInRegistry(meta) {
  const server = createServer((req, res) => {
    const url = decodeURIComponent(req.url ?? "")
    const name = /^\/(@launch-factory\/[a-z0-9-]+)$/.exec(url)?.[1]
    const m = name ? meta.get(name) : undefined
    if (m) {
      const base = `http://127.0.0.1:${server.address().port}`
      res.setHeader("content-type", "application/json")
      res.end(JSON.stringify({ name, "dist-tags": { latest: m.version }, versions: { [m.version]: { ...m.manifest, dist: { tarball: `${base}/-/tgz/${m.file}`, shasum: m.shasum, integrity: m.integrity } } } }))
      return
    }
    const file = /^\/-\/tgz\/(.+\.tgz)$/.exec(url)?.[1]
    if (file && existsSync(join(tgz, file))) {
      res.setHeader("content-type", "application/octet-stream")
      res.end(readFileSync(join(tgz, file)))
      return
    }
    res.statusCode = 404
    res.end("{}")
  })
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)))
}

let standIn

test.after(() => {
  standIn?.close()
})

test("빈 Next 앱을 만들고 패키지를 묶는다", { timeout: 600_000 }, async () => {
  mkdirSync(join(app, "app"), { recursive: true })
  mkdirSync(tgz, { recursive: true })
  const meta = new Map()
  for (const p of packages) {
    const r = run(NPM, ["pack", "--pack-destination", tgz, "--ignore-scripts", "--json"], { cwd: p.dir })
    ok(r, `npm pack ${p.name}`)
    const packed = JSON.parse(r.stdout)[0]
    const { dir, ...manifest } = p
    void dir
    meta.set(p.name, { version: p.version, manifest, file: packed.filename, shasum: packed.shasum, integrity: packed.integrity })
  }
  const ours = [...meta.keys()]
  standIn = await startStandInRegistry(meta)
  // save-exact=true 는 항목 docs 의 공통 설정(meta.launch.setup.npmrc) 안내다 — 없으면 CLI 의 npm install 이 package.json 에 ^ 범위를 적는다
  writeFileSync(join(app, ".npmrc"), `@launch-factory:registry=http://127.0.0.1:${standIn.address().port}/\n${setup.npmrc.join("\n")}\n`)
  writeFileSync(join(app, "package.json"), JSON.stringify({
    name: "lf-scratch", private: true, version: "0.0.0", type: "module",
    dependencies: { next: "16.3.8", react: "19.3.0", "react-dom": "19.3.0" },
    devDependencies: { typescript: "6.0.3", "@types/react": "19.3.0", "@types/react-dom": "19.3.0", "@types/node": "24.19.0" },
  }, null, 2))
  writeFileSync(join(app, "tsconfig.json"), JSON.stringify({
    compilerOptions: {
      target: "ES2023", lib: ["dom", "dom.iterable", "esnext"], module: "esnext", moduleResolution: "bundler", jsx: "preserve", strict: true, noEmit: true, skipLibCheck: true,
      allowImportingTsExtensions: true, resolveJsonModule: true, isolatedModules: true, incremental: true, types: ["node"], plugins: [{ name: "next" }], paths: { "@/*": ["./*"] },
    },
    include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"], exclude: ["node_modules", "tgz", "reg"],
  }, null, 2))
  // 패키지는 TypeScript 원본을 내보낸다 → transpilePackages. mock 모드 메모리 DB(PGlite)는 번들하지 않는다 → serverExternalPackages.
  // 둘 다 항목이 알리는 공통 설정(meta.launch.setup — docs 에도 같은 목록이 있다)만 쓴다. 손으로 고른 목록이 아니다(D183)
  assert.ok(setup.transpilePackages.every((p) => ours.includes(p)), "setup lists an unknown package")
  writeFileSync(join(app, "next.config.mjs"), `export default { transpilePackages: ${JSON.stringify(setup.transpilePackages)}, serverExternalPackages: ${JSON.stringify(setup.serverExternalPackages)} }\n`)
  writeFileSync(join(app, "components.json"), JSON.stringify({
    $schema: "https://ui.shadcn.com/schema.json", style: "new-york", rsc: true, tsx: true, tailwind: { config: "", css: "app/globals.css", baseColor: "neutral", cssVariables: true },
    registries: { "@launch-factory": "./reg/{name}.json" }, aliases: { components: "@/components", utils: "@/lib/utils", ui: "@/components/ui", lib: "@/lib", hooks: "@/hooks" },
  }, null, 2))
  mkdirSync(join(app, "reg"))
  for (const n of ITEM_ORDER) cpSync(join(ROOT, `registry/dist/${n}.json`), join(app, `reg/${n}.json`))
  writeFileSync(join(app, "app/globals.css"), "")
  writeFileSync(join(app, "app/layout.tsx"), `export default function RootLayout({ children }: { children: React.ReactNode }) {\n  return (\n    <html lang="en">\n      <body>{children}</body>\n    </html>\n  )\n}\n`)
  writeFileSync(join(app, "app/page.tsx"), `export default function Page() {\n  return <main>scratch</main>\n}\n`)
  log(`stand-in registry on :${standIn.address().port} (${ours.length} packages)`)
  log("npm install (next 16.3.8)")
  ok(await runAsync(NPM, ["install", "--ignore-scripts", "--no-audit", "--no-fund"], { cwd: app }), "npm install")
})

test("열 항목을 shadcn CLI 로 한 번에 설치한다 — 파일이 그대로 놓이고 envVars 는 이름만 들어간다", { timeout: 600_000 }, async () => {
  // 명령줄의 로컬 항목은 파일 경로로 준다(@네임스페이스 이름은 원격 URL 로만 풀린다). 그 항목들의 registryDependencies(@launch-factory/…)는 components.json 의 로컬 주소 규칙으로 풀린다
  const names = ITEM_ORDER.map((n) => `./reg/${n}.json`)
  log(`shadcn@${SHADCN} add ${names.length} items`)
  const r = await runAsync(NPX, ["--yes", `shadcn@${SHADCN}`, "add", ...names, "--yes", "--cwd", "."], { cwd: app })
  ok(r, "shadcn add")
  for (const p of packages) assert.ok(existsSync(join(app, "node_modules", p.name, "package.json")) || !Object.values(dist).some((i) => i.dependencies.some((d) => d.startsWith(`${p.name}@`))), `${p.name} not installed`)
  // 항목이 싣는 모든 파일이, 내용까지 같게 놓였다(여러 항목이 같은 파일을 실어도 하나)
  const want = new Map()
  for (const item of Object.values(dist)) for (const f of item.files) {
    if (want.has(f.target)) assert.equal(want.get(f.target), f.content, `${f.target}: items disagree on shared file`)
    want.set(f.target, f.content)
  }
  for (const [target, content] of want) {
    assert.ok(existsSync(join(app, target)), `not installed: ${target}`)
    assert.equal(readFileSync(join(app, target), "utf8"), content, `content differs: ${target}`)
  }
  // .env.local: 이름만, 값 없음
  const envNames = new Set(Object.values(dist).flatMap((i) => Object.keys(i.envVars)))
  const lines = readFileSync(join(app, ".env.local"), "utf8").split(/\r?\n/).filter(Boolean)
  for (const line of lines) assert.match(line, /^[A-Z][A-Z0-9_]*=$/, `.env.local line must be NAME= (no value): ${line.replace(/=.*/, "=…")}`)
  assert.deepEqual(new Set(lines.map((l) => l.slice(0, -1))), envNames)
  // 의존은 정확한 판으로 package.json 에 들어갔다
  const deps = { ...json(join(app, "package.json")).dependencies }
  for (const d of Object.values(dist).flatMap((i) => i.dependencies)) {
    const at = d.lastIndexOf("@")
    if (!d.startsWith("@launch-factory/")) assert.equal(deps[d.slice(0, at)], d.slice(at + 1), `${d} in package.json`)
  }
  log(`installed ${want.size} files, ${envNames.size} env names`)
})

test("설치된 마이그레이션이 빈 PGlite 에 적용된다", { timeout: 120_000 }, () => {
  const script = `import { PGlite } from "@electric-sql/pglite"\nimport { drizzle } from "drizzle-orm/pglite"\nimport { migrate } from "drizzle-orm/pglite/migrator"\nconst c = new PGlite()\nawait migrate(drizzle({ client: c }), { migrationsFolder: "./db/migrations" })\nconst { rows } = await c.query("select count(*)::int as n from information_schema.tables where table_schema = 'public'")\nconsole.log("TABLES=" + rows[0].n)\nawait c.close()\n`
  writeFileSync(join(app, "migrate-check.mjs"), script)
  const r = run(process.execPath, ["migrate-check.mjs"], { cwd: app, shell: false })
  ok(r, "migrate on PGlite")
  const n = Number(/TABLES=(\d+)/.exec(r.out)?.[1])
  const want = new Set(Object.values(dist).flatMap((i) => i.meta.launch.tables))
  assert.ok(n >= want.size, `tables ${n} < ${want.size}`)
  rmSync(join(app, "migrate-check.mjs"))
})

test("next build 종료 0(타입 검사 포함)", { timeout: 900_000 }, () => {
  // 스크래치 전용 경로(레지스트리 밖): 인증 조립(authPort 의 쿠키 입출력)을 한 요청 안에서 끝까지 돌린다 — 가입 → 세션 → 로그아웃 → 세션 없음
  mkdirSync(join(app, "app/api/scratch-flow"), { recursive: true })
  writeFileSync(join(app, "app/api/scratch-flow/route.ts"), [
    'import { authPort } from "@/lib/launch/auth"',
    'export const dynamic = "force-dynamic"',
    "export async function POST() {",
    "  const port = await authPort()",
    '  const up = await port.signUp({ method: "password", email: "flow@example.com", password: "correct horse battery staple", name: "Flow", consents: { terms: true, privacy: true, ageOver14: true } })',
    "  const s1 = await port.session()",
    "  const out = await port.signOut()",
    "  const s2 = await port.session()",
    "  return Response.json({ up, s1, out, s2 })",
    "}",
    "",
  ].join("\n"))
  // Task 9b: 새 항목 넷(관리자·탈퇴/파기·보안·동의)을 부르는 스크래치 경로 — 진짜 경로는 HTTP 로 그대로 부른다
  mkdirSync(join(app, "app/api/scratch-9b"), { recursive: true })
  cpSync(join(ROOT, "scripts/fixtures/scratch-9b-route.txt"), join(app, "app/api/scratch-9b/route.ts"))
  log("next build")
  const r = run(NPX, ["next", "build"], { cwd: app, env: { LF_MODE: "mock", LF_ALLOW_MOCK_PROD: "1" } })
  ok(r, "next build")
  assert.ok(existsSync(join(app, ".next/BUILD_ID")), "BUILD_ID")
  for (const route of ["/api/auth/[...all]", "/api/webhooks/paddle", "/api/webhooks/gumroad", "/api/inquiry", "/api/cron/billing", "/api/cron/gumroad", "/api/cron/inquiry", "/api/admin/users/export", "/api/cron/purge", "/api/cron/security"]) {
    assert.ok(r.out.includes(route), `route ${route} missing from build output`)
  }
})

test("빌드한 앱이 실제로 답한다: 문의 접수 200·검증 오류 400·Cron 401·키 없는 웹훅 500(조용히 성공하지 않는다)", { timeout: 180_000 }, async () => {
  const port = 4900 + Math.floor(Math.random() * 90)
  const env = { ...process.env, LF_MODE: "mock", LF_ALLOW_MOCK_PROD: "1", INQUIRY_OWNER_EMAIL: "owner@example.com", CRON_SECRET: "cron-secret-for-scratch-run", PORT: String(port), NEXT_TELEMETRY_DISABLED: "1" }
  delete env.PADDLE_API_KEY
  // 앱은 프로세스 환경에 없는 키를 Windows 사용자 환경에서 다시 읽는다(@launch-factory/env readSecrets). 개발 기계에 키가 있으면 위 delete 가
  // 소용없어 「키 없음」이 아니게 된다(웹훅이 500 대신 401) — 사용자 환경 읽기를 꺼서 이 시험이 정말 키 없는 앱을 부르게 한다.
  env.LF_NO_USER_ENV = "1"
  const child = spawn(process.execPath, [join(app, "node_modules/next/dist/bin/next"), "start", "-p", String(port)], { cwd: app, env, stdio: ["ignore", "pipe", "pipe"] })
  let out = ""
  child.stdout.on("data", (d) => (out += d))
  child.stderr.on("data", (d) => (out += d))
  try {
    const base = `http://127.0.0.1:${port}`
    for (let i = 0; i < 60; i++) {
      try { if ((await fetch(`${base}/`)).ok) break } catch { /* 아직 안 켜짐 */ }
      await new Promise((r) => setTimeout(r, 1000))
      if (i === 59) assert.fail(`server did not start:\n${out.slice(-1500)}`)
    }
    const post = (path, body, headers = {}) => fetch(`${base}${path}`, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) })
    const bad = await post("/api/inquiry", { contact: "", message: "" })
    const badText = await bad.text()
    assert.equal(bad.status, 400, `empty inquiry → 400 (got ${bad.status}: ${badText.slice(0, 300)})`)
    const good = await post("/api/inquiry", { contact: "visitor@example.com", message: "hello from the scratch app", idempotencyKey: "scratch-1", "cf-turnstile-response": "mock-token" })
    const goodText = await good.text()
    assert.equal(good.status, 200, `valid inquiry → 200 (got ${good.status}: ${goodText.slice(0, 300)}\n${out.slice(-1200)})`)
    const receipt = JSON.parse(goodText)
    assert.ok(JSON.stringify(receipt).includes('"ok":true') || receipt.ok === true, `receipt ${JSON.stringify(receipt).slice(0, 200)}`)
    const again = await post("/api/inquiry", { contact: "visitor@example.com", message: "hello from the scratch app", idempotencyKey: "scratch-1", "cf-turnstile-response": "mock-token" })
    assert.equal(again.status, 200, "same idempotency key → same result")
    assert.equal((await fetch(`${base}/api/cron/inquiry`)).status, 401, "cron without secret → 401")
    const cron = await fetch(`${base}/api/cron/inquiry`, { headers: { authorization: "Bearer cron-secret-for-scratch-run" } })
    assert.equal(cron.status, 200, "cron with secret → 200")
    const hook = await post("/api/webhooks/paddle", { event_type: "x" })
    assert.equal(hook.status, 500, "paddle webhook without PADDLE_API_KEY must fail loudly")
    const flowRes = await post("/api/scratch-flow", {})
    const flowText = await flowRes.text()
    assert.ok(flowRes.ok && flowText, `scratch flow ${flowRes.status}: ${flowText.slice(0, 300)}\n--- server output ---\n${out.slice(-2500)}`)
    const flow = JSON.parse(flowText)
    assert.equal(flow.up?.ok, true, `sign-up: ${JSON.stringify(flow.up).slice(0, 300)}\n${out.slice(-1500)}`)
    assert.ok(flow.s1?.ok && flow.s1.data?.userId, `session after sign-up must exist (cookie jar): ${JSON.stringify(flow.s1).slice(0, 300)}`)
    assert.equal(flow.out?.ok, true, `sign-out: ${JSON.stringify(flow.out).slice(0, 200)}`)
    assert.ok(flow.s2?.ok && flow.s2.data === null, `session after sign-out must be null: ${JSON.stringify(flow.s2).slice(0, 300)}`)
    const auth = await fetch(`${base}/api/auth/ok`)
    assert.ok(auth.status < 500, `auth handler answers (got ${auth.status})`)
  } finally {
    child.kill()
    await new Promise((r) => setTimeout(r, 500))
  }
})

/** 시험용 쿠키 통 — 서버가 준 Set-Cookie 를 다음 요청에 실어 보낸다(브라우저 대역) */
function cookieJar() {
  const m = new Map()
  return {
    header: () => [...m].map(([k, v]) => `${k}=${v}`).join("; "),
    take(res) {
      for (const line of res.headers.getSetCookie()) {
        const [pair = "", ...attrs] = line.split(";")
        const i = pair.indexOf("=")
        const name = pair.slice(0, i).trim()
        const value = pair.slice(i + 1).trim()
        if (value === "" || attrs.some((a) => /^\s*max-age=0\s*$/i.test(a))) m.delete(name)
        else m.set(name, value)
      }
    },
  }
}

test("새 항목 넷을 실제로 돌린다(Task 9b): 관리자 403·CSV·대리 로그인 기록 · 탈퇴→로그인 취소→파기 Cron · 요청 제한 429·멱등 키 · 동의 기록·만 14세", { timeout: 300_000 }, async () => {
  const port = 4700 + Math.floor(Math.random() * 90)
  const cronSecret = randomBytes(16).toString("hex")
  // 실제 키가 아니다: 결제 조립(billing())이 이름을 요구할 뿐 구독이 없는 사용자에게는 Paddle 을 부르지 않는다. 파기 키는 이 실행에서만 쓰는 무작위 값
  const env = { ...process.env, LF_MODE: "mock", LF_ALLOW_MOCK_PROD: "1", CRON_SECRET: cronSecret, SUBJECT_REF_KEY: randomBytes(24).toString("hex"), PADDLE_API_KEY: "scratch-not-a-real-key", PADDLE_WEBHOOK_SECRET: "scratch-not-a-real-secret", NEXT_PUBLIC_APP_URL: `http://127.0.0.1:${port}`, PORT: String(port), NEXT_TELEMETRY_DISABLED: "1" }
  const child = spawn(process.execPath, [join(app, "node_modules/next/dist/bin/next"), "start", "-p", String(port)], { cwd: app, env, stdio: ["ignore", "pipe", "pipe"] })
  let out = ""
  child.stdout.on("data", (d) => (out += d))
  child.stderr.on("data", (d) => (out += d))
  try {
    const base = `http://127.0.0.1:${port}`
    for (let i = 0; i < 60; i++) {
      try { if ((await fetch(`${base}/`)).ok) break } catch { /* 아직 안 켜짐 */ }
      await new Promise((r) => setTimeout(r, 1000))
      if (i === 59) assert.fail(`server did not start:\n${out.slice(-1500)}`)
    }
    const why = (extra = "") => `${extra}\n--- server output ---\n${out.slice(-1800)}`
    const get = (path, jar, headers = {}) => fetch(`${base}${path}`, { headers: { ...(jar ? { cookie: jar.header() } : {}), ...headers } })
    async function call(jar, op, body = {}) {
      const res = await fetch(`${base}/api/scratch-9b`, { method: "POST", headers: { "content-type": "application/json", cookie: jar.header() }, body: JSON.stringify({ op, ...body }) })
      jar.take(res)
      const text = await res.text()
      let json
      try { json = JSON.parse(text) } catch { assert.fail(`scratch ${op} ${res.status}: ${text.slice(0, 300)}${why()}`) }
      return { status: res.status, headers: res.headers, json }
    }
    const EXPORT = "/api/admin/users/export"
    const anon = cookieJar()
    const adminJar = cookieJar()
    const userJar = cookieJar()
    const [adminEmail, userEmail] = ["admin-9b@example.com", "user-9b@example.com"]

    // ── 관리자 ──────────────────────────────────────────────────────────────
    const off = await get(EXPORT)
    assert.equal(off.status, 503, "관리자 조각이 꺼져 있으면 경로는 닫혀 있다(열려 있지 않다)")
    assert.equal((await off.json()).code, "unavailable")
    await call(anon, "features") // lib/launch/features.ts 를 고치는 것과 같다
    assert.equal((await get(EXPORT, anon)).status, 401, "로그인 안 함 → 401")
    assert.equal((await call(adminJar, "signup", { email: adminEmail })).json.ok, true, why("admin sign-up"))
    assert.equal((await call(userJar, "signup", { email: userEmail })).json.ok, true, why("user sign-up"))
    let r = await get(EXPORT, userJar)
    assert.equal(r.status, 403, "관리자 아님 → 403")
    assert.equal((await r.json()).code, "admin_required")
    await call(adminJar, "promote", { email: adminEmail }) // role 만 — 2단계 인증이 없다
    r = await get(EXPORT, adminJar)
    assert.equal(r.status, 403, "관리자여도 2단계 인증이 없으면 403")
    assert.equal((await r.json()).code, "admin_two_factor_required")
    await call(adminJar, "promote", { email: adminEmail, twoFactor: true })
    r = await get(`${EXPORT}?q=user-9b`, adminJar)
    const csv = Buffer.from(await r.arrayBuffer()).toString("utf8") // r.text() 는 BOM 을 벗긴다 — 바이트로 읽어야 BOM 을 볼 수 있다
    assert.equal(r.status, 200, `관리자 + 2단계 → CSV 200 (got ${r.status}: ${csv.slice(0, 200)})`)
    assert.match(r.headers.get("content-type") ?? "", /^text\/csv/)
    assert.match(r.headers.get("content-disposition") ?? "", /^attachment; filename="users-\d{8}-\d{4}\.csv"$/)
    assert.ok(csv.startsWith("﻿"), "CSV 는 BOM 으로 시작한다(엑셀 한글)")
    assert.ok(csv.includes(userEmail) && !csv.includes(adminEmail), "검색어(q)로 걸러진다")
    let st = (await call(anon, "state", { email: userEmail })).json
    assert.ok(st.adminActionNames.includes("user_export"), `내려받기는 admin_actions 에 남는다: ${JSON.stringify(st.adminActionNames)}`)
    // 대리 로그인: 사유가 없으면 막히고, 있으면 시작·종료가 기록된다. 대리 세션에서는 관리자 벽이 닫힌다
    const noReason = await call(adminJar, "impersonate", { target: userEmail })
    assert.equal(noReason.json.ok, false)
    assert.equal(noReason.json.code, "reason_required")
    const start = await call(adminJar, "impersonate", { target: userEmail, reason: "support ticket 9b" })
    assert.equal(start.json.ok, true, `impersonate: ${JSON.stringify(start.json).slice(0, 300)}${why()}`)
    assert.equal((await get(EXPORT, adminJar)).status, 403, "대리 세션은 관리자가 아니다")
    // 대리 세션의 주인은 대상 사용자다 — 관리자가 대신 동의를 바꾸거나 탈퇴를 요청하지 못한다
    const proxyConsent = await call(adminJar, "consents-set", { input: { sms: true } })
    assert.equal(proxyConsent.json.ok, false, `대리 세션에서 마케팅 동의를 바꿀 수 없다: ${JSON.stringify(proxyConsent.json).slice(0, 200)}`)
    const proxyDelete = await call(adminJar, "delete", { confirmEmail: userEmail })
    assert.equal(proxyDelete.json.ok, false, `대리 세션에서 탈퇴를 요청할 수 없다: ${JSON.stringify(proxyDelete.json).slice(0, 200)}`)
    assert.equal((await call(anon, "state", { email: userEmail })).json.deletions.length, 0, "대리 세션의 탈퇴 요청이 기록되지 않았다")
    const stop = await call(adminJar, "stop")
    assert.equal(stop.json.ok, true, `stop: ${JSON.stringify(stop.json).slice(0, 300)}`)
    assert.equal((await get(EXPORT, adminJar)).status, 200, "대리 종료 뒤 관리자 세션으로 돌아온다")
    st = (await call(anon, "state", { email: userEmail })).json
    assert.ok(st.adminActionNames.includes("impersonate_start") && st.adminActionNames.includes("impersonate_stop"), `대리 로그인 시작·종료가 남는다: ${JSON.stringify(st.adminActionNames)}`)

    // ── 동의 ────────────────────────────────────────────────────────────────
    const under14 = await call(cookieJar(), "signup", { email: "kid-9b@example.com", consents: { terms: true, privacy: true, ageOver14: false } })
    assert.equal(under14.json.ok, false, "만 14세 확인 없이는 가입할 수 없다")
    assert.ok(under14.json.fieldErrors?.ageOver14, `ageOver14 field error: ${JSON.stringify(under14.json).slice(0, 200)}`)
    const before = await call(userJar, "consents-get")
    assert.equal(before.json.ok, true, JSON.stringify(before.json))
    assert.equal(before.json.data.email, false, "마케팅 수신은 기본 거부")
    assert.equal(before.json.data.sms, false, "대리 세션이 문자 수신 동의를 바꾸지 못했다")
    const set = await call(userJar, "consents-set", { input: { email: true } })
    assert.equal(set.json.ok, true, JSON.stringify(set.json))
    assert.equal((await call(userJar, "consents-get")).json.data.email, true)
    const badSet = await call(userJar, "consents-set", { input: { phone: true } })
    assert.equal(badSet.json.ok, false, "모르는 채널은 받지 않는다")
    assert.ok(badSet.json.fieldErrors?.phone)
    const history = await call(userJar, "consents-history")
    assert.equal(history.json.ok, true)
    const kinds = new Set(history.json.data.map((h) => h.kind))
    for (const k of ["terms", "privacy", "age_over_14"]) assert.ok(kinds.has(k), `가입 동의 기록에 ${k}: ${[...kinds].join(",")}`)
    assert.ok(history.json.data.some((h) => h.kind.startsWith("marketing") && h.granted === true), `마케팅 동의 이력: ${JSON.stringify(history.json.data).slice(0, 300)}`)
    assert.equal((await call(anon, "consents-get")).json.ok, false, "로그인 안 함 → 실패")

    // ── 보안: 요청 제한 429·멱등 키·정리 Cron ───────────────────────────────
    const limited = []
    for (let i = 0; i < 4; i++) limited.push(await call(anon, "limit"))
    assert.deepEqual(limited.map((x) => x.status), [200, 200, 200, 429], "signUp 한도는 10초에 3번 — 넷째는 429")
    assert.ok(Number(limited[3].headers.get("retry-after")) >= 1, "429 는 Retry-After 를 준다")
    assert.equal(limited[3].json.code, "rate_limited")
    const once = (await call(anon, "once", { key: "9b-once-key" })).json
    assert.equal(once.runs, 1, "같은 키는 한 번만 처리한다")
    assert.equal(once.second.replayed, true)
    st = (await call(anon, "state", { email: userEmail })).json
    assert.ok(st.rateLimits >= 1 && st.idempotencyKeys >= 1, `표에 계수·키가 남는다: ${JSON.stringify(st)}`)
    assert.equal((await get("/api/cron/security")).status, 401, "security cron 비밀 없이 → 401")
    const sec = await get("/api/cron/security", null, { authorization: `Bearer ${cronSecret}` })
    assert.equal(sec.status, 200)
    const secBody = await sec.json()
    assert.ok(Number.isInteger(secBody.rateLimits) && Number.isInteger(secBody.idempotencyKeys), JSON.stringify(secBody))

    // ── 탈퇴 → 유예 → 로그인하면 취소 → 다시 탈퇴 → 파기 Cron ────────────────
    const exported = await call(userJar, "export")
    assert.equal(exported.json.ok, true, JSON.stringify(exported.json).slice(0, 300))
    assert.ok(JSON.stringify(exported.json).includes(userEmail), "내려받기에 본인 정보가 있다")
    assert.doesNotMatch(JSON.stringify(exported.json), /"password"|"token"/, "비밀번호 해시·세션 토큰은 싣지 않는다")
    const del = await call(userJar, "delete", { confirmEmail: userEmail })
    assert.equal(del.json.ok, true, `deleteAccount: ${JSON.stringify(del.json).slice(0, 300)}${why()}`)
    assert.ok(del.json.data.graceUntil)
    st = (await call(anon, "state", { email: userEmail })).json
    assert.deepEqual(st.deletions.map((d) => d.status), ["pending"])
    assert.equal((await call(userJar, "session")).json.data, null, "탈퇴를 요청하면 세션이 모두 끊긴다")
    assert.equal((await call(userJar, "signin", { email: userEmail })).json.ok, true, "유예 중 다시 로그인")
    st = (await call(anon, "state", { email: userEmail })).json
    assert.deepEqual(st.deletions.map((d) => d.status), ["cancelled"], "유예 중 로그인하면 탈퇴가 취소된다")
    assert.equal((await call(userJar, "delete", { confirmEmail: userEmail })).json.ok, true)
    assert.equal((await get("/api/cron/purge")).status, 401, "purge cron 비밀 없이 → 401")
    const early = await get("/api/cron/purge", null, { authorization: `Bearer ${cronSecret}` })
    const earlyText = await early.text()
    assert.equal(early.status, 200, earlyText)
    assert.equal(JSON.parse(earlyText).purged, 0, "유예 중인 계정은 지우지 않는다")
    st = (await call(anon, "state", { email: userEmail })).json
    assert.equal(st.userExists, true)
    await call(anon, "backdate")
    const purged = await get("/api/cron/purge", null, { authorization: `Bearer ${cronSecret}` })
    const report = await purged.json()
    assert.equal(purged.status, 200, JSON.stringify(report))
    assert.deepEqual([report.claimed, report.purged, report.completed, report.failures.length], [1, 1, 1, 0], `파기 보고: ${JSON.stringify(report).slice(0, 400)}${why()}`)
    st = (await call(anon, "state", { email: userEmail })).json
    assert.equal(st.userExists, false, "유예가 지나면 사용자 행이 없다")
    assert.ok(st.deletions.some((d) => d.status === "purged" && !d.hasUser), `파기된 요청은 사용자 id 를 비운다: ${JSON.stringify(st.deletions)}`)
    const again = await (await get("/api/cron/purge", null, { authorization: `Bearer ${cronSecret}` })).json()
    assert.deepEqual([again.claimed, again.purged], [0, 0], "Cron 이 두 번 와도 한 번만 처리한다")
  } finally {
    child.kill()
    await new Promise((r) => setTimeout(r, 500))
  }
})
