import { test } from "node:test"
import assert from "node:assert/strict"
import { spawn, spawnSync } from "node:child_process"
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises"
import { createServer } from "node:net"
import { createRequire } from "node:module"
import { join, resolve } from "node:path"
import { randomBytes } from "node:crypto"
import { setTimeout as delay } from "node:timers/promises"
import https from "node:https"
import { cleanEnv } from "../../../scripts/ci/run-tests.mjs"

const require = createRequire(import.meta.url)
const template = resolve("template")
function get(url, authorization) {
  return new Promise((done, fail) => {
    const request = https.get(url, { rejectUnauthorized: false, headers: authorization ? { authorization } : {}, timeout: 30000 }, (res) => {
      let body = ""; res.on("data", (chunk) => { body += chunk }); res.on("end", () => done({ status: res.statusCode, body }))
    })
    request.on("error", fail); request.on("timeout", () => request.destroy(new Error("timeout")))
  })
}

test("실제 Next fake Cron 경로는 인증하고 빈 배치를 실행한다", { timeout: 120_000 }, async () => {
  const root = resolve(".tmp"); await mkdir(root, { recursive: true })
  const temp = await mkdtemp(join(root, "toss-cron-app-"))
  const tag = randomBytes(8).toString("hex"), dist = `.next-toss-e2e-${tag}`, config = `.tsconfig-toss-e2e-${tag}.json`
  const key = join(temp, "key.pem"), cert = join(temp, "cert.pem"), tsconfig = join(template, config), distPath = join(template, dist)
  let child, cleanupFailure = false
  try {
    const openssl = process.env.TOSS_E2E_OPENSSL || "openssl"
    assert.equal(spawnSync(openssl, ["req", "-x509", "-newkey", "rsa:2048", "-sha256", "-nodes", "-keyout", key, "-out", cert, "-days", "1", "-subj", "/CN=127.0.0.1"], { env: { ...process.env, MSYS_NO_PATHCONV: "1" }, stdio: "ignore", windowsHide: true }).status, 0)
    await writeFile(tsconfig, await readFile(join(template, "tsconfig.json")), { flag: "wx" })
    const server = createServer(); await new Promise((done) => server.listen(0, "127.0.0.1", done)); const port = server.address().port; await new Promise((done) => server.close(done))
    const origin = `https://127.0.0.1:${port}`
    const env = { ...cleanEnv(process.env), NODE_ENV: "development", LF_MODE: "mock", LF_TOSS_TEST: "1", LF_TOSS_TEST_FAKE: "1", TOSS_TEST_CLIENT_KEY: "test_ck_fake", TOSS_TEST_SECRET_KEY: "test_sk_fake", TOSS_TEST_ENCRYPTION_KEY: "55".repeat(32), NEXT_PUBLIC_APP_URL: origin, CRON_SECRET: "fake-cron-secret", LF_TOSS_TEST_DIST: dist, LF_TOSS_TEST_TSCONFIG: config, NEXT_TELEMETRY_DISABLED: "1" }
    child = spawn(process.execPath, [require.resolve("next/dist/bin/next"), "dev", "-H", "127.0.0.1", "-p", String(port), "--experimental-https", "--experimental-https-key", key, "--experimental-https-cert", cert], { cwd: template, env, stdio: "ignore", windowsHide: true })
    let response
    for (let i = 0; i < 120; i++) { if (child.exitCode !== null) throw new Error("server exited"); try { response = await get(`${origin}/api/cron/toss-test`); break } catch { await delay(500) } }
    assert.equal(response?.status, 401)
    assert.equal((await get(`${origin}/api/cron/toss-test`, "Bearer wrong")).status, 401)
    const valid = await get(`${origin}/api/cron/toss-test`, "Bearer fake-cron-secret")
    assert.equal(valid.status, 200)
    assert.deepEqual(JSON.parse(valid.body), { examined: 0, paid: 0, declined: 0, unresolved: 0 })
  } finally {
    if (child && child.exitCode === null) {
      if (process.platform === "win32") spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true }); else child.kill("SIGTERM")
      await Promise.race([new Promise((done) => child.once("exit", done)), delay(5000)])
      if (child.exitCode === null) cleanupFailure = true
    }
    for (const [path, parent] of [[temp, root], [distPath, template], [tsconfig, template]]) {
      try { const actual = await realpath(path), base = await realpath(parent); if (!actual.startsWith(`${base}\\`) && !actual.startsWith(`${base}/`)) cleanupFailure = true; else await rm(actual, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 }) }
      catch (error) { if (error.code !== "ENOENT") cleanupFailure = true }
    }
  }
  if (cleanupFailure) throw new Error("Unexpected temporary path")
})
