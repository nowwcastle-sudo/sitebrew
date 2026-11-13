// 관리 화면 브라우저 시험(scripts/e2e-admin)의 순수 부분 — 서버·브라우저 없이.
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { pathToFileURL } from "node:url"
import { ADMIN_EMAIL, buildEnv, copyFilter, serverEnv, withAdminFeatures } from "../e2e-admin/plan.mjs"

test("withAdminFeatures: 실제 template/lib/launch/features.ts 의 꺼진 스위치를 켠다", () => {
  const src = readFileSync(new URL("../../template/lib/launch/features.ts", import.meta.url), "utf8")
  const out = withAdminFeatures(src)
  assert.match(out, /twoFactor: true, admin: true/)
  assert.doesNotMatch(out, /twoFactor: false/)
})

test("withAdminFeatures: 모양이 달라졌으면 조용히 넘어가지 않고 던진다", () => {
  assert.throws(() => withAdminFeatures("export const AUTH_FEATURES = { twoFactor: true, admin: true }"), /찾지 못했다/)
})

test("copyFilter: 설치·빌드 부산물과 비밀값 파일은 사본에 가져가지 않는다", () => {
  for (const rel of ["node_modules/next/package.json", ".next/BUILD_ID", ".tmp/smoke/run.log", ".env", ".env.local", "app/.env.production"]) assert.equal(copyFilter(rel), false, rel)
  for (const rel of ["app/page.tsx", "e2e/loop-steps.json", "lib/launch/features.ts", "env.example.ts"]) assert.equal(copyFilter(rel), true, rel)
})

test("serverEnv: 이 PC 의 공급자 이름은 지우고 시험 계정·시드·요청 제한 머리말만 얹는다", () => {
  const env = serverEnv({
    outbox: "/o.jsonl",
    twoFactorFile: "/2fa",
    preload: "/p.mjs",
    base: { PATH: "/bin", DATABASE_URL: "postgres://x", PADDLE_API_KEY: "k", LF_MODE: "live", INQUIRY_OWNER_EMAIL: "other@example.com" },
  })
  assert.equal(env.PATH, "/bin")
  assert.equal(env.DATABASE_URL, undefined)
  assert.equal(env.PADDLE_API_KEY, undefined)
  assert.equal(env.LF_MODE, "mock")
  assert.equal(env.INQUIRY_OWNER_EMAIL, ADMIN_EMAIL)
  assert.equal(env.BOOKING_OWNER_EMAIL, ADMIN_EMAIL)
  assert.equal(env.ADMIN_SEED_EMAIL, ADMIN_EMAIL)
  assert.equal(env.LF_CLIENT_IP_HEADER, "x-test-ip")
  assert.equal(env.LF_MOCK_SUB, "none")
  assert.equal(env.NODE_OPTIONS, `--import=${pathToFileURL("/p.mjs").href}`)
})

test("serverEnv: 시드 경로를 file: 주소로 넘겨 Windows 드라이브 경로·공백이 든 폴더에서도 Node 가 시드를 싣는다", () => {
  // 예전에는 경로를 그대로 넘겨 Windows 에서 ERR_UNSUPPORTED_ESM_URL_SCHEME(protocol 'd:'),
  // 공백이 든 폴더에서는 NODE_OPTIONS 가 공백에서 갈라져 실패했다.
  const dir = mkdtempSync(join(tmpdir(), "e2e admin "))
  try {
    const preload = join(dir, "seed.mjs")
    writeFileSync(preload, "globalThis.__seeded = 1\n")
    const env = serverEnv({ outbox: "/o", twoFactorFile: "/2fa", preload, base: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot } })
    const r = spawnSync(process.execPath, ["-e", "process.stdout.write(String(globalThis.__seeded))"], { env: { ...env, NODE_OPTIONS: env.NODE_OPTIONS }, encoding: "utf8" })
    assert.equal(r.status, 0, r.stderr)
    assert.equal(r.stdout, "1")
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("serverEnv: 필요한 값이 빠지면 던진다 / buildEnv 는 mock 빌드", () => {
  assert.throws(() => serverEnv({ outbox: "/o", twoFactorFile: "", preload: "/p" }), /필요하다/)
  const env = buildEnv({ LF_MODE: "live", PATH: "/bin" })
  assert.equal(env.LF_MODE, "mock")
  assert.equal(env.LF_ALLOW_MOCK_PROD, "1")
})
