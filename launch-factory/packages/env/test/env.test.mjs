import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { isAbsolute } from "node:path"
import { z } from "zod"
import {
  loadEnv,
  loadAppEnv,
  appEnvSchema,
  PROVIDER_SECRET_NAMES,
  SECRET_NAMES,
  EnvError,
  readSecret,
  readSecrets,
  windowsUserEnv,
  maskSecrets,
  MockModeError,
  windowsPowerShellPath,
} from "../src/index.ts"

const LIVE_OK = {
  LF_MODE: "live",
  DATABASE_URL: "postgres://u:p@db.example.com:6543/postgres",
  BETTER_AUTH_SECRET: "x".repeat(32),
  PADDLE_API_KEY: "pdl_sdbx_apikey_test",
  PADDLE_WEBHOOK_SECRET: "pdl_ntfset_test",
  RESEND_API_KEY: "re_test",
  POSTHOG_PROJECT_KEY: "phc_test",
  SENTRY_DSN: "https://abc@o1.ingest.sentry.io/1",
  TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
}

test("빠진 키 3개가 오류 메시지 하나에 모두 나온다", () => {
  const schema = z.object({ A_KEY: z.string().min(1), B_KEY: z.string().min(1), C_KEY: z.string().min(1), D_KEY: z.string() })
  let err
  try {
    loadEnv(schema, { D_KEY: "ok" })
  } catch (e) {
    err = e
  }
  assert.ok(err instanceof EnvError, "EnvError 를 던진다")
  for (const name of ["A_KEY", "B_KEY", "C_KEY"]) assert.match(err.message, new RegExp(name))
  assert.doesNotMatch(err.message, /D_KEY/)
  assert.deepEqual(err.missing, ["A_KEY", "B_KEY", "C_KEY"])
})

test("빈 문자열도 빠진 것으로 본다", () => {
  const schema = z.object({ A_KEY: z.string().min(1) })
  assert.throws(() => loadEnv(schema, { A_KEY: "" }), (e) => e instanceof EnvError && e.missing.includes("A_KEY"))
})

test("live 모드에서 공급자 키 7개가 빠지면 7개 모두 한 번에 알린다", () => {
  let err
  try {
    loadAppEnv({ LF_MODE: "live" })
  } catch (e) {
    err = e
  }
  assert.ok(err instanceof EnvError)
  assert.deepEqual([...err.missing].sort(), [...PROVIDER_SECRET_NAMES].sort())
  for (const name of PROVIDER_SECRET_NAMES) assert.match(err.message, new RegExp(name))
})

test("mock 모드에서는 공급자 키가 없어도 통과한다", () => {
  const env = loadAppEnv({ LF_MODE: "mock" })
  assert.equal(env.LF_MODE, "mock")
  assert.equal(env.PADDLE_API_KEY, undefined)
})

test("live 모드에서 키가 다 있으면 통과한다", () => {
  const env = loadAppEnv(LIVE_OK)
  assert.equal(env.LF_MODE, "live")
  assert.equal(env.PADDLE_API_KEY, LIVE_OK.PADDLE_API_KEY)
})

test("LF_MODE 가 없거나 틀리면 오류다(조용히 mock 으로 켜지지 않는다)", () => {
  assert.throws(() => loadAppEnv({}), (e) => e instanceof EnvError && e.missing.includes("LF_MODE"))
  assert.throws(() => loadAppEnv({ LF_MODE: "prod" }), (e) => e instanceof EnvError && e.invalid.includes("LF_MODE"))
})

test("오류 메시지에는 이름만 있고 값은 없다", () => {
  const bad = { ...LIVE_OK, DATABASE_URL: "not-a-url-SECRETVALUE123", BETTER_AUTH_SECRET: "shortSECRET" }
  let err
  try {
    loadAppEnv(bad)
  } catch (e) {
    err = e
  }
  assert.ok(err instanceof EnvError)
  assert.deepEqual([...err.invalid].sort(), ["BETTER_AUTH_SECRET", "DATABASE_URL"])
  assert.doesNotMatch(err.message, /SECRETVALUE123|shortSECRET/)
})

test("mock 모드에서도 넣어 둔 값의 형식은 본다", () => {
  assert.throws(() => loadAppEnv({ LF_MODE: "mock", DATABASE_URL: "nope" }), (e) => e instanceof EnvError && e.invalid.includes("DATABASE_URL"))
})

test("appEnvSchema(mode) 는 mode 에 따라 요구가 다르다", () => {
  assert.equal(appEnvSchema("mock").safeParse({ LF_MODE: "mock" }).success, true)
  assert.equal(appEnvSchema("live").safeParse({ LF_MODE: "live" }).success, false)
})

test("readSecret: 프로세스 환경을 먼저, 없으면 사용자 환경을 읽는다", () => {
  const calls = []
  const userEnv = (name) => {
    calls.push(name)
    return name === "FROM_USER" ? "u-value" : null
  }
  assert.equal(readSecret("FROM_PROC", { FROM_PROC: "  p-value  " }, userEnv), "p-value")
  assert.deepEqual(calls, [], "프로세스 환경에 있으면 사용자 환경을 보지 않는다")
  assert.equal(readSecret("FROM_USER", {}, userEnv), "u-value")
  assert.equal(readSecret("NOWHERE", {}, userEnv), null)
  assert.equal(readSecret("BLANK", { BLANK: "   " }, () => null), null)
})

test("windowsUserEnv: LF_NO_USER_ENV=1 이면 사용자 환경을 읽지 않는다(키 없음 시험용)", () => {
  const before = process.env.LF_NO_USER_ENV
  process.env.LF_NO_USER_ENV = "1"
  try {
    // TEMP 는 Windows 사용자 환경에 늘 있는 이름이다 — 스위치가 없었다면 이 기계에서는 값이 읽힌다
    assert.deepEqual(windowsUserEnv(["TEMP", "PADDLE_API_KEY"]), { TEMP: null, PADDLE_API_KEY: null })
    assert.deepEqual(readSecrets(["TEMP"], {}), {})
  } finally {
    if (before === undefined) delete process.env.LF_NO_USER_ENV
    else process.env.LF_NO_USER_ENV = before
  }
})

test("readSecret: 이름은 대문자·숫자·밑줄만 받는다", () => {
  assert.throws(() => readSecret("bad-name", {}, () => null), /대문자/)
  assert.throws(() => readSecret("A');calc;('", {}, () => null), /대문자/)
})

test("maskSecrets: 값을 가리고 이름은 남긴다(URL 인코딩 모양 포함)", () => {
  const v = "s3cr3t/+=&x"
  const text = `PADDLE_API_KEY=${v} url=https://x?k=${encodeURIComponent(v)}`
  const out = maskSecrets(text, [v, null, ""])
  assert.equal(out, "PADDLE_API_KEY=*** url=https://x?k=***")
})

test("maskSecrets: 한 값이 다른 값을 품어도 조각이 남지 않는다", () => {
  assert.equal(maskSecrets("abcdef abc", ["abc", "abcdef"]), "*** ***")
})

test("D193: 앱이 선택적으로 읽는 이름은 있으면 형식을 보고(mock·live 모두), 없어도 통과한다", () => {
  const ok = { SUBJECT_REF_KEY: "s".repeat(32), CRON_SECRET: "c".repeat(16), POSTHOG_HOST: "https://us.i.posthog.com", POSTHOG_PROJECT_ID: "12345", EMAIL_FROM: "Paid <hi@example.com>", PADDLE_CLIENT_TOKEN: "test_x", POSTHOG_PERSONAL_API_KEY: "phx_x", GUMROAD_ACCESS_TOKEN: "g", GUMROAD_PING_SECRET: "g" }
  assert.equal(loadAppEnv({ LF_MODE: "mock", ...ok }).LF_MODE, "mock")
  assert.equal(loadAppEnv(LIVE_OK).LF_MODE, "live", "없어도 live 가 통과한다(설치한 항목만 required 로 요구한다)")
  for (const [name, bad] of [["SUBJECT_REF_KEY", "short"], ["CRON_SECRET", "short"], ["POSTHOG_HOST", "not a url"], ["POSTHOG_PROJECT_ID", "12a"]]) {
    assert.throws(() => loadAppEnv({ LF_MODE: "mock", ...ok, [name]: bad }), (e) => e instanceof EnvError && e.invalid.includes(name) && !e.message.includes(bad), name)
  }
})

test("LFOBS: SENTRY_DSN 은 live 에서도 없어도 통과하고(오류 수집만 꺼진다), 있는데 모양이 틀리면 이름만 대며 던진다", () => {
  const withoutDsn = { ...LIVE_OK }
  delete withoutDsn.SENTRY_DSN
  assert.equal(loadAppEnv(withoutDsn).LF_MODE, "live", "필수였을 때는 쓰지도 않는 이름 하나로 사이트가 멈췄다")
  assert.ok(!PROVIDER_SECRET_NAMES.includes("SENTRY_DSN"))
  assert.equal(loadAppEnv({ ...withoutDsn, SENTRY_DSN: "https://key@o1.ingest.sentry.io/456" }).LF_MODE, "live", "형식이 맞으면 통과")
  assert.equal(loadAppEnv({ ...withoutDsn, SENTRY_DSN: "https://key@sentry.example.test/prefix/42" }).LF_MODE, "live", "경로가 있는 자체 호스팅 모양도 받는다")
  for (const bad of ["not a url", "http://key@o1.ingest.sentry.io/1", "https://o1.ingest.sentry.io/1", "https://key@o1.ingest.sentry.io/notnumber"]) {
    assert.throws(() => loadAppEnv({ ...withoutDsn, SENTRY_DSN: bad }), (e) => e instanceof EnvError && e.invalid.includes("SENTRY_DSN") && !e.message.includes("ingest.sentry.io"), bad)
  }
  assert.equal(loadAppEnv({ ...withoutDsn, SENTRY_DSN: "" }).LF_MODE, "live", "빈 문자열은 없는 값")
})

test("LFOBS2: POSTHOG_PROJECT_KEY 는 live 에서도 없어도 통과하고(분석만 꺼진다), 있는데 공백이 섞였으면 이름만 대며 던진다", () => {
  const withoutKey = { ...LIVE_OK }
  delete withoutKey.POSTHOG_PROJECT_KEY
  assert.ok(!PROVIDER_SECRET_NAMES.includes("POSTHOG_PROJECT_KEY"), "공급자 필수 목록에서 빠졌다")
  assert.ok(SECRET_NAMES.includes("POSTHOG_PROJECT_KEY"), "그래도 값은 출력·로그에서 가린다")
  assert.equal(loadAppEnv(withoutKey).LF_MODE, "live", "필수였을 때는 이 이름 하나로 live 가 켜지지 않았다")
  assert.equal(loadAppEnv({ ...withoutKey, POSTHOG_PROJECT_KEY: "" }).LF_MODE, "live", "빈 문자열은 없는 값")
  assert.equal(loadAppEnv({ ...withoutKey, POSTHOG_PROJECT_KEY: "phc_test" }).LF_MODE, "live", "형식이 맞으면 통과")
  for (const bad of [" ", "phc test", "phc_\ttest"]) {
    assert.throws(() => loadAppEnv({ ...withoutKey, POSTHOG_PROJECT_KEY: bad }), (e) => e instanceof EnvError && e.invalid.includes("POSTHOG_PROJECT_KEY") && !e.message.includes("phc"), JSON.stringify(bad))
  }
})

// ── mock 모드는 운영 실행에서 막는다(최종 라운드 E1 — 새 사용자가 .env.example 을 복사해 배포해도 mock 으로 공개되지 않는다) ──

test("NODE_ENV=production 에서 LF_MODE=mock 이면 던진다 — 한국어·영어 안내와 해제 방법", () => {
  assert.throws(
    () => loadAppEnv({ LF_MODE: "mock", NODE_ENV: "production" }),
    (e) => e instanceof MockModeError && /공개할 수 없어요/.test(e.message) && /cannot be deployed/.test(e.message) && /LF_ALLOW_MOCK_PROD=1/.test(e.message),
  )
})

test("Vercel production·preview 배포도 NODE_ENV=production 이라 같이 막힌다", () => {
  for (const VERCEL_ENV of ["production", "preview"]) {
    assert.throws(() => loadAppEnv({ LF_MODE: "mock", NODE_ENV: "production", VERCEL_ENV }), MockModeError, VERCEL_ENV)
  }
})

test("LF_ALLOW_MOCK_PROD=1 일 때만 운영 실행의 mock 을 연다(내 기계의 운영 빌드 시험)", () => {
  assert.equal(loadAppEnv({ LF_MODE: "mock", NODE_ENV: "production", LF_ALLOW_MOCK_PROD: "1" }).LF_MODE, "mock")
  for (const v of ["0", "true", "yes", ""]) {
    assert.throws(() => loadAppEnv({ LF_MODE: "mock", NODE_ENV: "production", LF_ALLOW_MOCK_PROD: v }), MockModeError, `값 ${JSON.stringify(v)}`)
  }
})

test("개발·시험 실행(NODE_ENV=development·test·없음)의 mock 은 그대로 통과한다", () => {
  for (const NODE_ENV of ["development", "test", undefined]) assert.equal(loadAppEnv({ LF_MODE: "mock", NODE_ENV }).LF_MODE, "mock", String(NODE_ENV))
})

test("live 는 운영 실행에서 막히지 않는다", () => {
  assert.equal(loadAppEnv({ ...LIVE_OK, NODE_ENV: "production" }).LF_MODE, "live")
})

// ── E5: PowerShell 은 PATH 의 이름이 아니라 System32 의 절대 경로로 부른다(작업 폴더·PATH 앞쪽에 놓인 가짜 powershell.exe 를 막는다) ──

test("windowsPowerShellPath: SystemRoot 아래 System32 절대 경로, 없으면 C:\\Windows", () => {
  assert.equal(windowsPowerShellPath({ SystemRoot: "D:\\Win" }), "D:\\Win\\System32\\WindowsPowerShell\\v1.0\\powershell.exe")
  assert.equal(windowsPowerShellPath({ SystemRoot: "" }), "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe")
  assert.equal(windowsPowerShellPath({}), "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe")
  assert.ok(isAbsolute(windowsPowerShellPath(process.env)) || process.platform !== "win32", "절대 경로")
})

test("windowsUserEnv 는 execFileSync 에 windowsPowerShellPath() 를 넘긴다(상대 이름 \"powershell\" 이 아니다)", () => {
  const src = readFileSync(new URL("../src/secret.ts", import.meta.url), "utf8")
  assert.match(src, /execFileSync\(windowsPowerShellPath\(\)/)
  assert.doesNotMatch(src, /execFileSync\(\s*"powershell"/)
})
