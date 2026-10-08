// LFENV: 배포 전 환경 이름 점검(scripts/env-check.mjs)의 시험. 값은 읽지 않는다 — 이름만.
// 사고: INQUIRY_OWNER_EMAIL 이 필수로 더해졌는데 배포 환경에 없어 전 쪽 500 → 새 필수 이름이 .env.example·배포 환경에 없으면 배포 전에 알린다.
import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { UNCHECKED_AT_BOOT, checkOffline, compare, liveRequirements, main, parseEnvNames, parseVercelEnvLs, requiredInCode } from "../env-check.mjs"

/** 작은 가짜 저장소: live 이름 목록·.env.example·코드 한 줄 */
function fixture({ example, live = 'export const TEMPLATE_LIVE_NAMES = ["NEW_REQUIRED"]\nexport const TEMPLATE_OPTIONAL_NAMES = ["OPT_NAME"]\n', code = "" }) {
  const root = mkdtempSync(join(tmpdir(), "lf-envcheck-"))
  mkdirSync(join(root, "template/lib"), { recursive: true })
  writeFileSync(join(root, "package.json"), '{"type":"module"}')
  writeFileSync(join(root, "template/lib/live-env.ts"), live)
  writeFileSync(join(root, "template/lib/uses.ts"), code)
  writeFileSync(join(root, ".env.example"), example)
  return root
}
const ALL_PROVIDER = "DATABASE_URL BETTER_AUTH_SECRET PADDLE_API_KEY PADDLE_WEBHOOK_SECRET RESEND_API_KEY TURNSTILE_SECRET_KEY LF_MODE"
const exampleOf = (names) => `${names.map((n) => `${n}=`).join("\n")}\n`

test("이 저장소: live 이름(필수·선택)이 모두 .env.example 에 있고 코드의 required(\"…\") 이름도 모두 있다", async () => {
  const { errors } = await checkOffline()
  assert.deepEqual(errors, [])
  const { required, optional } = await liveRequirements()
  assert.ok(required.includes("LF_MODE") && required.includes("CRON_SECRET") && required.includes("SUBJECT_REF_KEY"))
  assert.deepEqual(optional, ["INQUIRY_OWNER_EMAIL", "POSTHOG_HOST", "POSTHOG_PROJECT_KEY", "SENTRY_DSN"], "문의 메일(LFENV)·분석 호스트(LFOBS)·분석 프로젝트 키(LFOBS2)·Sentry DSN 은 선택 — 없으면 그 기능만 꺼진다")
  assert.ok(!required.includes("POSTHOG_PROJECT_KEY"), "프로젝트 키는 공급자 필수 목록에서 빠졌다(LFOBS2)")
  for (const n of optional) assert.ok(!required.includes(n), `${n} 은 필수가 아니다`)
  assert.ok(requiredInCode().has("TURNSTILE_SECRET_KEY"), "코드 훑기가 실제 템플릿 코드를 읽는다(양성 대조군)")
})

test("새로 필수가 된 이름이 .env.example 에 없으면 실패한다(음성): 필수·선택 모두, 코드가 required 로 읽는 이름도", async () => {
  const root = fixture({ example: exampleOf(ALL_PROVIDER.split(" ")), code: 'const x = required("USED_IN_CODE")\n' })
  try {
    const { errors } = await checkOffline(root)
    const text = errors.join("\n")
    assert.match(text, /NEW_REQUIRED/)
    assert.match(text, /OPT_NAME/)
    assert.match(text, /USED_IN_CODE/)
    assert.equal(errors.length, 3, text)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test("이름을 .env.example 에 적으면 통과한다(양성) — 주석 줄은 이름으로 치지 않는다", async () => {
  const names = [...ALL_PROVIDER.split(" "), "NEW_REQUIRED", "OPT_NAME", "USED_IN_CODE"]
  const root = fixture({ example: `${exampleOf(names)}# COMMENTED_ONLY=\n`, code: 'const x = required("USED_IN_CODE")\nconst y = required("COMMENTED_ONLY")\n' })
  try {
    const { errors, notes } = await checkOffline(root)
    assert.deepEqual(errors.length, 1, "주석 속 이름은 없는 것이다")
    assert.match(errors[0], /COMMENTED_ONLY/)
    assert.match(notes.join("\n"), /USED_IN_CODE/, "코드가 읽지만 켜질 때 검사에는 없는 이름은 안내만 한다")
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test("parseEnvNames·parseVercelEnvLs: 이름만 꺼내고 값은 버린다", () => {
  const dotenv = ['# Created by Vercel CLI', 'LF_MODE="[SENSITIVE]"', "DATABASE_URL=[SENSITIVE]", "export EMAIL_FROM='x <y@example.test>'", "  # COMMENTED=1", "", "lower_case=1"].join("\n")
  assert.deepEqual([...parseEnvNames(dotenv)].sort(), ["DATABASE_URL", "EMAIL_FROM", "LF_MODE", "lower_case"])
  const ls = ["Vercel CLI 61.0.0", "Retrieving project…", "> Environment Variables found for demo [120ms]", "", " name                    value               environments        created", " LF_MODE                 Encrypted           Preview             2d ago", " INQUIRY_OWNER_EMAIL     Encrypted           Preview             1m ago", " NEXT_PUBLIC_APP_URL     Encrypted           Production, Preview 9d ago"].join("\n")
  assert.deepEqual([...parseVercelEnvLs(ls)].sort(), ["INQUIRY_OWNER_EMAIL", "LF_MODE", "NEXT_PUBLIC_APP_URL"])
})

test("compare: 필수가 빠지면 missingRequired, 선택만 빠지면 missingOptional 만 — INQUIRY_OWNER_EMAIL 이 없는 배포 환경은 경고이지 실패가 아니다", async () => {
  const reqs = await liveRequirements()
  const all = new Set(reqs.required)
  const unchecked = Object.keys(UNCHECKED_AT_BOOT)
  const optional = ["INQUIRY_OWNER_EMAIL", "POSTHOG_HOST", "POSTHOG_PROJECT_KEY", "SENTRY_DSN"]
  // 선택 이름이 모두 없는 배포: 분석이 꺼져 있으므로 PostHog 지움 키도 요구하지 않는다(LFOBS)
  assert.deepEqual(compare(all, reqs), { missingRequired: [], missingOptional: optional, missingUnchecked: [], eraseWithoutHost: false })
  // 호스트만 있거나 프로젝트 키만 있으면 분석은 꺼져 있다(LFOBS2: 둘 다 있어야 켜진다) — 없는 쪽을 알리고 지움 키는 요구하지 않는다
  assert.deepEqual(compare(new Set([...all, "POSTHOG_HOST"]), reqs), { missingRequired: [], missingOptional: ["INQUIRY_OWNER_EMAIL", "POSTHOG_PROJECT_KEY", "SENTRY_DSN"], missingUnchecked: [], eraseWithoutHost: false })
  assert.deepEqual(compare(new Set([...all, "POSTHOG_PROJECT_KEY"]), reqs), { missingRequired: [], missingOptional: ["INQUIRY_OWNER_EMAIL", "POSTHOG_HOST", "SENTRY_DSN"], missingUnchecked: [], eraseWithoutHost: false })
  // 분석을 켰는데(호스트·프로젝트 키 둘 다 있음) 지움 키가 없으면 경고 대상이다
  assert.deepEqual(compare(new Set([...all, "POSTHOG_HOST", "POSTHOG_PROJECT_KEY"]), reqs), { missingRequired: [], missingOptional: ["INQUIRY_OWNER_EMAIL", "SENTRY_DSN"], missingUnchecked: unchecked, eraseWithoutHost: false })
  // 반대쪽: 분석이 꺼져 있는데 지움 키만 있다(분석을 껐다면 옛 데이터를 못 지운다) — 호스트만 있어도 마찬가지
  assert.equal(compare(new Set([...all, "POSTHOG_PERSONAL_API_KEY"]), reqs).eraseWithoutHost, true)
  assert.equal(compare(new Set([...all, "POSTHOG_HOST", "POSTHOG_PERSONAL_API_KEY"]), reqs).eraseWithoutHost, true)
  assert.deepEqual(compare(new Set([...all, ...optional, ...unchecked]), reqs), { missingRequired: [], missingOptional: [], missingUnchecked: [], eraseWithoutHost: false })
  const lacking = new Set(all)
  lacking.delete("CRON_SECRET")
  assert.deepEqual(compare(lacking, reqs).missingRequired, ["CRON_SECRET"])
})

test("main --names-file: 선택 이름만 없으면 종료 0 + ::warning::, 필수가 없으면 종료 1 + ::error::", async () => {
  const reqs = await liveRequirements()
  const dir = mkdtempSync(join(tmpdir(), "lf-envnames-"))
  const logs = []
  const orig = { log: console.log, error: console.error }
  console.log = (...a) => logs.push(a.join(" "))
  console.error = (...a) => logs.push(a.join(" "))
  try {
    const okFile = join(dir, "ok.env")
    writeFileSync(okFile, `${reqs.required.map((n) => `${n}="[SENSITIVE]"`).join("\n")}\n`)
    assert.equal(await main(["--names-file", okFile]), 0)
    assert.ok(logs.some((l) => l.startsWith("::warning") && l.includes("INQUIRY_OWNER_EMAIL")), logs.join("\n"))
    // LFOBS·LFOBS2: POSTHOG_HOST·POSTHOG_PROJECT_KEY·SENTRY_DSN 도 선택 — 없으면 경고(실패 아님), 그 기능이 꺼진다고 알린다. 분석이 꺼져 있으니 지움 키 경고는 없다
    const optionalWarning = logs.find((l) => l.startsWith("::warning title=Optional env names missing"))
    assert.ok(optionalWarning && optionalWarning.includes("POSTHOG_HOST(분석(PostHog)이 꺼진다") && optionalWarning.includes("POSTHOG_PROJECT_KEY(분석(PostHog)이 꺼진다") && optionalWarning.includes("SENTRY_DSN(오류 수집(Sentry)이 꺼진다"), logs.join("\n"))
    assert.ok(!logs.some((l) => l.includes("Env name not checked at boot")), "분석이 꺼져 있으면 PostHog 지움 키는 필요 없다")
    assert.ok(!logs.some((l) => l.startsWith("::error")))

    // 호스트만 있고 프로젝트 키가 없으면(LFOBS2) 분석은 꺼져 있다 — 없는 이름(POSTHOG_PROJECT_KEY)을 알리고 호스트는 알리지 않는다, 지움 키 경고는 없다, 종료 0
    logs.length = 0
    const hostOnlyFile = join(dir, "host-only.env")
    writeFileSync(hostOnlyFile, `${[...reqs.required, "POSTHOG_HOST"].map((n) => `${n}="[SENSITIVE]"`).join("\n")}\n`)
    assert.equal(await main(["--names-file", hostOnlyFile]), 0)
    const hostOnlyWarning = logs.find((l) => l.startsWith("::warning title=Optional env names missing"))
    assert.ok(hostOnlyWarning && hostOnlyWarning.includes("POSTHOG_PROJECT_KEY(분석(PostHog)이 꺼진다") && !hostOnlyWarning.includes("POSTHOG_HOST("), logs.join("\n"))
    assert.ok(!logs.some((l) => l.includes("Env name not checked at boot")), "분석이 꺼져 있으면 지움 키는 필요 없다")

    // 분석을 켜면(호스트·프로젝트 키 둘 다 있음) 지움 키가 없을 때 경고한다 — 그래도 종료 0
    logs.length = 0
    const onFile = join(dir, "on.env")
    writeFileSync(onFile, `${[...reqs.required, "POSTHOG_HOST", "POSTHOG_PROJECT_KEY"].map((n) => `${n}="[SENSITIVE]"`).join("\n")}\n`)
    assert.equal(await main(["--names-file", onFile]), 0)
    assert.ok(logs.some((l) => l.startsWith("::warning") && l.includes("POSTHOG_PERSONAL_API_KEY") && l.includes("지움 단계가 실패")), logs.join("\n"))
    assert.ok(!logs.join("\n").includes("POSTHOG_HOST(분석") && !logs.join("\n").includes("POSTHOG_PROJECT_KEY(분석"), "둘 다 있으면 분석 꺼짐 경고가 없다")

    logs.length = 0
    const badFile = join(dir, "bad.env")
    writeFileSync(badFile, `${reqs.required.filter((n) => n !== "SUBJECT_REF_KEY").map((n) => `${n}=x`).join("\n")}\n`)
    assert.equal(await main(["--names-file", badFile]), 1)
    assert.ok(logs.some((l) => l.startsWith("::error") && l.includes("SUBJECT_REF_KEY")), logs.join("\n"))
    assert.ok(!logs.join("\n").includes("=x"), "값은 출력하지 않는다")
  } finally {
    console.log = orig.log
    console.error = orig.error
    rmSync(dir, { recursive: true, force: true })
  }
})
