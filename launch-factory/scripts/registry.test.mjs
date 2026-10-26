// 기능 레지스트리 시험(v0 Task 9). 빠르고 오프라인이다. 설치 닫힘(빈 Next 앱에 실제로 설치해 빌드)은 registry-install.test.mjs.
// 생성물(registry.json·registry/dist)은 디스크에서 읽는다 — 생성기 함수에 기대지 않고 원천(워크스페이스)과 따로 대조한다.
import assert from "node:assert/strict"
import { existsSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { MOCK_ONLY_NAMES } from "@launch-factory/env"
import { ITEM_ORDER, main } from "./gen-registry.mjs"

const ROOT = fileURLToPath(new URL("..", import.meta.url))
const json = (rel) => JSON.parse(readFileSync(join(ROOT, rel), "utf8"))
const text = (rel) => readFileSync(join(ROOT, rel), "utf8")

const PLAN_ITEMS = ["feature-auth-betterauth", "feature-billing-paddle", "feature-email-resend", "feature-analytics-posthog"]
const dist = Object.fromEntries(ITEM_ORDER.map((n) => [n, json(`registry/dist/${n}.json`)]))
const index = json("registry.json")
const workspace = readdirSync(join(ROOT, "packages")).map((d) => json(`packages/${d}/package.json`))
const versionOf = (name) => workspace.find((p) => p.name === name)?.version
const importsOf = (content) => [...content.matchAll(/(?:from\s+|import\s*\(\s*)["']([^"'.][^"']*)["']/g)].map((m) => m[1])
const pkgName = (spec) => (spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0])

/** 항목이 설치되면 앱에 생기는 의존 전체(registryDependencies 를 따라간다) */
function closure(name, seen = new Set()) {
  if (seen.has(name)) return seen
  seen.add(name)
  for (const d of dist[name].registryDependencies) closure(d.replace("@launch-factory/", ""), seen)
  return seen
}

test("생성물이 원천과 같다(gen-registry --check, 종료 0)", () => {
  assert.equal(main(["--check"]), 0)
})

test("계획의 네 항목이 있고, 색인은 shadcn 필수 필드 넷을 갖는다", () => {
  for (const n of PLAN_ITEMS) assert.ok(dist[n], `${n} missing`)
  for (const k of ["$schema", "name", "homepage", "items"]) assert.ok(index[k], `registry.json ${k}`)
  assert.deepEqual(index.items.map((i) => i.name), ITEM_ORDER)
  // registry.json 은 내용 없이 경로만, dist 는 내용이 있다
  for (const item of index.items) for (const f of item.files) assert.ok(!("content" in f) && existsSync(join(ROOT, f.path)), `${item.name}: ${f.path}`)
})

test("항목 모양: registry:file 은 target 필수·앱 안쪽 상대 경로·중복 없음·내용 있음", () => {
  for (const [name, item] of Object.entries(dist)) {
    assert.equal(item.type, "registry:item", name)
    assert.ok(item.title && item.description && item.docs, `${name}: title·description·docs`)
    const targets = item.files.map((f) => f.target)
    assert.equal(new Set(targets).size, targets.length, `${name}: duplicate target`)
    for (const f of item.files) {
      assert.equal(f.type, "registry:file", `${name}:${f.target}`)
      assert.ok(f.target && !f.target.startsWith("/") && !f.target.split("/").includes("..") && !/^[a-zA-Z]:/.test(f.target), `${name}: target ${f.target}`)
      assert.ok(typeof f.content === "string" && f.content.length > 0, `${name}:${f.target} empty`)
    }
  }
})

test("항목 하나에 어댑터·입구(경로 또는 서버 액션)가 있다 — 없는 항목은 이유를 적었다", () => {
  for (const [name, item] of Object.entries(dist)) {
    assert.ok(item.files.some((f) => /^lib\/launch\/(?!env|db|config|cron)[a-z-]+\.ts$/.test(f.target)), `${name}: adapter file (lib/launch/<adapter>.ts)`)
    const { routes, actions, noEntrypointReason } = item.meta.launch
    if (routes.length + actions.length === 0) assert.ok(noEntrypointReason && noEntrypointReason.length > 20, `${name}: no route/action and no reason`)
    else assert.equal(noEntrypointReason, null, `${name}: has entrypoints but also a reason`)
  }
  // 웹훅이 있는 공급자는 그 경로가 있다
  const targets = (n) => dist[n].files.map((f) => f.target)
  assert.ok(targets("feature-billing-paddle").includes("app/api/webhooks/paddle/route.ts"))
  assert.ok(targets("feature-billing-gumroad").includes("app/api/webhooks/gumroad/route.ts"))
  assert.ok(targets("feature-auth-betterauth").includes("app/api/auth/[...all]/route.ts"))
  assert.ok(targets("feature-inquiry").includes("app/api/inquiry/route.ts"))
})

test("서버 액션 파일은 'use server' 로 시작하고, 경로 파일은 요청 처리기를 내보낸다", () => {
  for (const [name, item] of Object.entries(dist)) {
    for (const f of item.files.filter((x) => x.target.startsWith("app/actions/"))) assert.match(f.content, /^["']use server["']/, `${name}:${f.target}`)
    for (const f of item.files.filter((x) => /\/route\.ts$/.test(x.target))) assert.match(f.content, /export (async )?function (GET|POST)|export const (GET|POST)/, `${name}:${f.target}`)
  }
  // 웹훅 경로는 서명 검증이 패키지 처리기 안에 있다 — 여기서 본문을 미리 읽지 않는다(원문이 깨진다)
  for (const n of ["feature-billing-paddle", "feature-billing-gumroad"]) {
    const route = dist[n].files.find((f) => f.target.startsWith("app/api/webhooks/"))
    assert.doesNotMatch(route.content, /\.(json|text|formData|arrayBuffer)\(\)/, `${n}: webhook route must not read the body`)
  }
})

test("표를 가진 항목은 마이그레이션 전체(순서 있는 한 줄기)와 스키마 조각을, 표 없는 항목은 아무것도 싣지 않는다", () => {
  const stream = readdirSync(join(ROOT, "packages/db/migrations")).filter((n) => n.endsWith(".sql")).sort().map((n) => `db/migrations/${n}`)
  for (const [name, item] of Object.entries(dist)) {
    const { tables, schema, migrations } = item.meta.launch
    const targets = item.files.map((f) => f.target)
    if (tables.length === 0) {
      assert.deepEqual([schema, migrations], [[], []], `${name}: no tables → no schema/migrations`)
      assert.ok(!targets.some((t) => t.startsWith("db/")), `${name}: db/ files without tables`)
      continue
    }
    assert.deepEqual(migrations, stream, `${name}: migrations must be the full ordered stream`)
    assert.ok(targets.includes("db/migrations/meta/_journal.json") && targets.includes("db/migrate.mjs"), `${name}: journal + migrate script`)
    const sql = item.files.filter((f) => f.target.endsWith(".sql")).map((f) => f.content).join("\n")
    for (const t of tables) assert.match(sql, new RegExp(`CREATE TABLE "${t}"`), `${name}: table ${t} not created by shipped SQL`)
    for (const s of schema) {
      const f = item.files.find((x) => x.target === s)
      assert.equal(f.content, text(`packages/db/src/schema/${s.split("/").pop()}`), `${name}: ${s} differs from packages/db`)
    }
    assert.match(item.docs, /node db\/migrate\.mjs/, `${name}: docs must give the migration command`)
  }
  assert.ok(stream.length >= 10)
})

test("싣는 마이그레이션·스키마는 packages/db 원본과 한 글자도 다르지 않다", () => {
  for (const item of Object.values(dist)) {
    for (const f of item.files.filter((x) => x.target.startsWith("db/migrations/"))) {
      assert.equal(f.content, text(`packages/db/${f.target.replace(/^db\//, "")}`), f.target)
    }
  }
})

test("패키지 판이 워크스페이스 판과 같고 정확 판이다(^·~ 없음)", () => {
  for (const [name, item] of Object.entries(dist)) {
    assert.ok(item.dependencies.length > 0, name)
    for (const dep of item.dependencies) {
      const at = dep.lastIndexOf("@")
      const [pkg, version] = [dep.slice(0, at), dep.slice(at + 1)]
      assert.match(version, /^\d+\.\d+\.\d+$/, `${name}: ${dep} must be exact`)
      if (pkg.startsWith("@launch-factory/")) assert.equal(version, versionOf(pkg), `${name}: ${pkg} workspace version is ${versionOf(pkg)}`)
      else {
        const declared = new Set(workspace.map((p) => p.dependencies?.[pkg]).filter(Boolean))
        assert.deepEqual([...declared], [version], `${name}: ${pkg} workspace pins ${[...declared].join(",")}`)
      }
    }
  }
})

test("설치 닫힘(정적): 파일이 부르는 패키지는 항목 또는 그 registryDependencies 가 싣는다", () => {
  const BUILTIN = new Set(["next", "react", "react-dom"]) // 제품 앱이 갖는다
  for (const name of ITEM_ORDER) {
    const provided = new Set()
    const targets = new Set()
    for (const n of closure(name)) {
      for (const d of dist[n].dependencies) provided.add(d.slice(0, d.lastIndexOf("@")))
      for (const f of dist[n].files) targets.add(f.target.replace(/\.(tsx?|mjs)$/, ""))
    }
    for (const f of dist[name].files.filter((x) => /\.(tsx?|mjs)$/.test(x.target))) {
      for (const spec of importsOf(f.content)) {
        if (spec.startsWith("node:")) continue
        if (spec.startsWith("@/")) {
          assert.ok(targets.has(spec.slice(2)), `${name}:${f.target} imports ${spec} which no installed item provides`)
          continue
        }
        const pkg = pkgName(spec)
        if (BUILTIN.has(pkg)) continue
        assert.ok(provided.has(pkg), `${name}:${f.target} imports ${pkg} which the item does not depend on`)
      }
    }
  }
})

test("envVars 는 이름만(값 없음)이고 .env.example 에 있으며, 파일이 읽는 이름은 모두 항목이 알린다", () => {
  const example = new Set(text(".env.example").split(/\r?\n/).map((l) => /^([A-Z][A-Z0-9_]+)=/.exec(l)?.[1]).filter(Boolean))
  const SECRETISH = /(api[_-]?key|secret|token|password)\s*[:=]\s*["'][A-Za-z0-9_\-+/]{12,}["']/i
  for (const [name, item] of Object.entries(dist)) {
    for (const [k, v] of Object.entries(item.envVars)) {
      assert.equal(v, "", `${name}: envVars ${k} must have no value`)
      assert.ok(example.has(k), `${name}: ${k} is not in .env.example`)
    }
    const known = new Set()
    for (const n of closure(name)) for (const k of Object.keys(dist[n].envVars)) known.add(k)
    for (const f of item.files) {
      assert.doesNotMatch(f.content, SECRETISH, `${name}:${f.target} looks like a hard-coded secret`)
      for (const m of f.content.matchAll(/(?:required|optional)\("([A-Z][A-Z0-9_]+)"\)|process\.env\.([A-Z][A-Z0-9_]+)/g)) {
        const k = m[1] ?? m[2]
        // LF_PADDLE_LIVE 는 운영자만 켜는 스위치라 목록에 두지 않는다(docs 에 적었다)
        if (k === "LF_PADDLE_LIVE") assert.match(item.docs, /LF_PADDLE_LIVE/, name)
        // mock 전용 개발·시험 이름은 사용자가 채울 값이 아니라 envVars(= 기능 표의 「필요한 것」)에 두지 않는다 — packages/env 의 MOCK_ONLY_NAMES 가 한 원천이고 env:check 가 .env.example 을 본다
        else if (!MOCK_ONLY_NAMES.includes(k)) assert.ok(known.has(k), `${name}:${f.target} reads ${k} but no item declares it in envVars`)
      }
    }
  }
})

test("공개 서버 액션·경로에서 사용자 id 를 입력으로 받지 않는다(세션에서 읽는다)", () => {
  for (const [name, item] of Object.entries(dist)) {
    for (const f of item.files.filter((x) => x.target.startsWith("app/actions/"))) {
      assert.doesNotMatch(f.content, /userId\s*:\s*(input|formData|body)/i, `${name}:${f.target}`)
      assert.doesNotMatch(f.content, /export async function \w+\([^)]*\b(userId|orgId)\b/, `${name}:${f.target}: userId as a parameter`)
    }
  }
})

test("Cron 경로는 CRON_SECRET 이 없으면 열리지 않는다", async () => {
  const src = dist["feature-billing-paddle"].files.find((f) => f.target === "lib/launch/cron.ts").content
  const dir = mkdtempSync(join(tmpdir(), "lf-cron-"))
  try {
    const file = join(dir, "cron.mts")
    writeFileSync(file, src)
    const { cronAuthorized } = await import(`file:///${file.split("\\").join("/")}`)
    const req = (auth) => new Request("https://x.test/api/cron", auth ? { headers: { authorization: auth } } : {})
    const saved = process.env.CRON_SECRET
    try {
      delete process.env.CRON_SECRET
      assert.equal(cronAuthorized(req("Bearer anything")), false, "secret unset → closed")
      assert.equal(cronAuthorized(req("Bearer ")), false)
      process.env.CRON_SECRET = "s3cret-value-for-test"
      assert.equal(cronAuthorized(req()), false)
      assert.equal(cronAuthorized(req("Bearer wrong-value-for-test!")), false)
      assert.equal(cronAuthorized(req("Bearer s3cret-value-for-test")), true)
    } finally {
      if (saved === undefined) delete process.env.CRON_SECRET
      else process.env.CRON_SECRET = saved
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("싣는 마이그레이션이 빈 PGlite 에 그대로 적용되고, 항목의 표가 모두 생긴다", async () => {
  const { PGlite } = await import("@electric-sql/pglite")
  const { drizzle } = await import("drizzle-orm/pglite")
  const { migrate } = await import("drizzle-orm/pglite/migrator")
  const withTables = Object.entries(dist).filter(([, i]) => i.meta.launch.tables.length)
  assert.ok(withTables.length >= 4)
  for (const [name, item] of withTables) {
    const dir = mkdtempSync(join(tmpdir(), "lf-mig-"))
    const client = new PGlite()
    try {
      for (const f of item.files.filter((x) => x.target.startsWith("db/migrations/"))) {
        const abs = join(dir, f.target.replace(/^db\//, ""))
        mkdirSync(dirname(abs), { recursive: true })
        writeFileSync(abs, f.content)
      }
      await migrate(drizzle({ client }), { migrationsFolder: join(dir, "migrations") })
      const { rows } = await client.query("select table_name from information_schema.tables where table_schema = 'public'")
      const have = new Set(rows.map((r) => r.table_name))
      for (const t of item.meta.launch.tables) assert.ok(have.has(t), `${name}: table ${t} missing after migrating shipped SQL`)
    } finally {
      await client.close()
      rmSync(dir, { recursive: true, force: true })
    }
  }
})

// ── Task 9b: 새 항목 넷(D181) · 재설정 메일 연결(D180) · 공통 설정(D183·D184) ─────────────────────────────────────────

const NEW_ITEMS = ["feature-security", "feature-consents", "feature-admin", "feature-account-lifecycle"]
const fileOf = (n, target) => dist[n].files.find((f) => f.target === target)?.content ?? assert.fail(`${n}: ${target} missing`)

test("Task 9b: 항목 넷이 있고 각자 입구·의존을 갖는다(관리자·탈퇴 파기·보안·동의)", () => {
  for (const n of NEW_ITEMS) assert.ok(dist[n] && index.items.some((i) => i.name === n), `${n} missing`)
  assert.deepEqual([...new Set(dist["feature-admin"].meta.launch.actions.concat(dist["feature-admin"].meta.launch.routes))].sort(), ["app/actions/admin.ts", "app/api/admin/users/export/route.ts"])
  assert.deepEqual(dist["feature-account-lifecycle"].meta.launch.routes, ["app/api/cron/purge/route.ts"])
  assert.deepEqual(dist["feature-account-lifecycle"].meta.launch.actions, ["app/actions/account.ts"])
  assert.deepEqual(dist["feature-security"].meta.launch.routes, ["app/api/cron/security/route.ts"])
  assert.deepEqual(dist["feature-consents"].meta.launch.actions, ["app/actions/consents.ts"])
  // 표를 더하지 않는다 — 마이그레이션 한 줄기는 인증 항목이 싣는다(설치되는 것이 보장돼야 하므로 의존으로 잇는다)
  for (const n of NEW_ITEMS) {
    assert.deepEqual(dist[n].meta.launch.tables, [], `${n}: no tables`)
    assert.ok(closure(n).has("feature-auth-betterauth"), `${n} must depend on the auth item (it ships the migrations)`)
  }
  assert.ok(closure("feature-account-lifecycle").has("feature-billing-paddle"), "탈퇴는 구독을 해지해야 하므로 결제 항목이 함께 온다(대장 D200)")
  // 인증 항목이 표를 싣는다 — 새 항목들이 쓰는 표가 그 마이그레이션에 모두 있다
  const sql = dist["feature-auth-betterauth"].files.filter((f) => f.target.endsWith(".sql")).map((f) => f.content).join("\n")
  for (const t of ["rate_limits", "idempotency_keys", "admin_actions", "account_deletions", "retained_transactions", "consent_records", "marketing_consents"]) assert.match(sql, new RegExp(`CREATE TABLE "${t}"`), `migrations must create ${t}`)
})

test("D180: 인증 항목은 재설정 메일을 던지는 함수로 막지 않고 authEmails 를 그대로 넘긴다", () => {
  const auth = fileOf("feature-auth-betterauth", "lib/launch/auth.ts")
  assert.doesNotMatch(auth, /not available yet/)
  assert.match(auth, /mailer: emails,/)
  assert.doesNotMatch(dist["feature-auth-betterauth"].docs, /서식은 @launch-factory\/email 에 아직 없다/)
})

test("D202: 인증 항목은 메일 발송을 Next after 로 응답 뒤에 끝낸다(기다리지 않는다)", () => {
  const auth = fileOf("feature-auth-betterauth", "lib/launch/auth.ts")
  assert.match(auth, /import \{ after \} from "next\/server"/)
  assert.match(auth, /after\(task\)/)
  assert.match(auth, /\n\s+runInBackground,\n/)
})

test("D205: 요청 제한 셋(인증·보안·문의)이 같은 ipAddressFromEnv 로 믿을 IP 머리를 정한다", () => {
  const files = [
    fileOf("feature-auth-betterauth", "lib/launch/auth.ts"),
    fileOf("feature-security", "lib/launch/security.ts"),
    fileOf("feature-inquiry", "lib/launch/inquiry.ts"),
  ]
  for (const c of files) assert.match(c, /ipAddress: ipAddressFromEnv\(process\.env\)/)
  assert.match(files[1], /onNoIp: warnNoIpOnce\(\)/)
  assert.match(files[2], /onNoIp: warnNoIpOnce\(\)/)
})

test("관리자: 모든 입구가 runAdmin 을 지나고, 조각이 꺼져 있으면 열지 않는다(503) — 손으로 adminActions 를 만들지 않는다", () => {
  const lib = fileOf("feature-admin", "lib/launch/admin.ts")
  assert.match(lib, /AUTH_FEATURES\.admin/)
  assert.match(lib, /AUTH_FEATURES\.twoFactor/)
  assert.match(lib, /throw new AdminDisabledError\(\)/)
  assert.match(lib, /status: 503/)
  for (const t of ["app/actions/admin.ts", "app/api/admin/users/export/route.ts"]) {
    const c = fileOf("feature-admin", t)
    assert.doesNotMatch(c, /adminActions\(/, `${t}: use runAdmin`)
    assert.match(c, /runAdmin\(/)
  }
  // 모든 서버 액션은 한 줄로 runAdmin 을 부른다(액션마다 벽을 다시 만들지 않는다)
  const actions = fileOf("feature-admin", "app/actions/admin.ts")
  assert.equal([...actions.matchAll(/export async function/g)].length, [...actions.matchAll(/return runAdmin\(/g)].length)
  // 스위치 파일은 인증 항목이 싣고 기본은 꺼짐이다
  assert.match(fileOf("feature-auth-betterauth", "lib/launch/features.ts"), /twoFactor: false, admin: false/)
  assert.match(fileOf("feature-auth-betterauth", "lib/launch/auth.ts"), /admin: AUTH_FEATURES\.admin/)
})

test("동의: 대리 로그인 세션은 본인이 아니다 — 관리자가 대신 동의를 바꾸지 못한다", () => {
  assert.match(fileOf("feature-consents", "lib/launch/consents.ts"), /s\.ok && s\.data && !s\.data\.impersonatedBy \? s\.data\.userId : null/)
})

test("Cron 경로는 모두 cronAuthorized 로 시작한다 — 비밀이 없으면 401", () => {
  const crons = ITEM_ORDER.flatMap((n) => dist[n].files.filter((f) => /^app\/api\/cron\/.+\/route\.ts$/.test(f.target)).map((f) => ({ n, f })))
  assert.ok(crons.length >= 5, `cron routes ${crons.length}`)
  for (const { n, f } of crons) {
    assert.match(f.content, /if \(!cronAuthorized\(request\)\) return unauthorized\(\)/, `${n}:${f.target}`)
    assert.ok(f.content.indexOf("cronAuthorized(request)") < f.content.search(/await /), `${n}:${f.target}: 인증이 처리보다 먼저`)
  }
})

test("탈퇴·파기: 키가 없으면 켜지지 않고(SUBJECT_REF_KEY 필수), 계측 삭제는 mock 에서만 건너뛴다", () => {
  const acc = fileOf("feature-account-lifecycle", "lib/launch/account.ts")
  assert.match(acc, /subjectKey: required\("SUBJECT_REF_KEY"\)/)
  assert.match(acc, /if \(env\(\)\.LF_MODE !== "live"\) return NO_ANALYTICS_ERASER/)
  // import · mock 분기 · LFOBS 분기(POSTHOG_HOST·지움 키가 모두 없음 = 분석을 켠 적이 없다). 일부만 있으면 던지는 지움기를 준다 — 조용히 건너뛰지 않는다
  assert.match(acc, /if \(!host && !personalApiKey && !projectId\) return NO_ANALYTICS_ERASER/)
  assert.equal([...acc.matchAll(/NO_ANALYTICS_ERASER/g)].length, 3, "import 와 mock 분기와 「분석을 켠 적 없음」 분기 — 다른 곳에서 조용히 쓰지 않는다")
  for (const k of ["SUBJECT_REF_KEY", "POSTHOG_PERSONAL_API_KEY", "POSTHOG_PROJECT_ID", "POSTHOG_HOST"]) assert.ok(k in dist["feature-account-lifecycle"].envVars, k)
  assert.match(fileOf("feature-account-lifecycle", "lib/launch/account-billing.ts"), /paddle\.port\(\{ userId \}\)/)
})

test("보안: 규칙 없는 경로는 던진다 — RATE_RULES 는 기본 비어 있고 막히면 429 + Retry-After 응답을 낸다", () => {
  const sec = fileOf("feature-security", "lib/launch/security.ts")
  assert.match(sec, /export const RATE_RULES: Record<string, RateRule> = \{\}/)
  assert.match(sec, /blockedResponse\(blocked/)
  assert.match(sec, /protect\(await limiter\(\)/)
})

test("D183·D184: 공통 설정 — transpilePackages 는 전이 의존까지 원천과 따로 센 목록과 같고, 파일이 부르는 @launch-factory/* 가 모두 들어 있다", () => {
  const byName = new Map(workspace.map((p) => [p.name, p]))
  for (const name of ITEM_ORDER) {
    const item = dist[name]
    const setup = item.meta.launch.setup
    // 독립 계산: 항목·의존 항목이 싣는 @launch-factory/* 에서 출발해 워크스페이스 의존을 따라간다
    const seen = new Set()
    const stack = [...closure(name)].flatMap((n) => dist[n].dependencies.map((d) => d.slice(0, d.lastIndexOf("@")))).filter((d) => d.startsWith("@launch-factory/"))
    while (stack.length) {
      const n = stack.pop()
      if (seen.has(n)) continue
      seen.add(n)
      for (const d of Object.keys(byName.get(n)?.dependencies ?? {})) if (d.startsWith("@launch-factory/")) stack.push(d)
    }
    assert.deepEqual(setup.transpilePackages, [...seen].sort(), `${name}: transpilePackages`)
    assert.deepEqual(setup.npmrc, ["save-exact=true"], name)
    assert.equal(setup.serverExternalPackages.length > 0, seen.has("@launch-factory/db"), `${name}: pglite external iff db`)
    for (const f of item.files.filter((x) => /\.(tsx?|mjs)$/.test(x.target))) {
      for (const spec of importsOf(f.content)) if (spec.startsWith("@launch-factory/")) assert.ok(setup.transpilePackages.includes(pkgName(spec)), `${name}:${f.target} imports ${pkgName(spec)} which transpilePackages omits`)
    }
    // 안내문에도 같은 목록이 있다
    for (const p of setup.transpilePackages) assert.ok(item.docs.includes(`"${p}"`), `${name}: docs lack ${p}`)
    assert.match(item.docs, /save-exact=true/, name)
  }
})
