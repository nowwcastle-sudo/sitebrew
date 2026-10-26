#!/usr/bin/env node
// 단위 시험 묶음 — `npm test` 와 `npm run ci:verify` 가 같은 파일 묶음을 같은 방식으로 돌린다.
//   node scripts/ci/run-tests.mjs [--tap <파일>]
// --tap 이 있으면 spec 은 화면에, TAP 은 파일에 남긴다(건너뛴 시험 세기에 쓴다). 동시 실행은 3(이 저장소 규칙).
import { spawnSync } from "node:child_process"
import { mkdirSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

export const ROOT = fileURLToPath(new URL("../..", import.meta.url))

/** node --test 가 직접 푸는 글롭(따옴표 없이 인자로 넘긴다) */
export const TEST_GLOBS = [
  "packages/*/test/*.test.mjs",
  "scripts/test/*.test.mjs",
  "scripts/registry.test.mjs",
  "template/test/template.test.mjs",
  "template/test/lffix.test.mjs",
  "template/test/ux1.test.mjs",
  "template/test/ux2.test.mjs",
  "template/test/legal.test.mjs",
  "template/test/lfax.test.mjs",
  "template/test/runner.test.mjs",
  "template/test/runfix.test.mjs",
  "template/test/lfada.test.mjs",
  "template/test/adb.test.mjs",
  "template/test/book-push-client.test.mjs",
  "template/test/lfobs.test.mjs",
  "template/test/p1c.test.mjs",
  "template/test/p1ab.test.mjs",
  "template/test/p1ab-b2.test.mjs",
  "template/test/p1b4.test.mjs",
  "template/test/deps-floor.test.mjs",
]

/** 이 PC 의 셸에 걸려 있을 수 있는 공급자·모드 이름. CI 러너에는 없다 — 시험이 이 값에 우연히 기대면 CI 에서만 깨진다(LFCI: lffix F2 CSP 가 POSTHOG_HOST 에 기대 있었다) */
const AMBIENT = /^(?:LF_(?!WF_|CI_)|PADDLE_|PORTONE_|POSTHOG_|SENTRY_|RESEND_|TURNSTILE_|GUMROAD_|GOOGLE_CLIENT_|KAKAO_CLIENT_|NAVER_CLIENT_|DATABASE_URL$|BETTER_AUTH_|CRON_SECRET$|SUBJECT_REF_KEY$|EMAIL_FROM$|INQUIRY_OWNER_EMAIL$|BOOKING_OWNER_EMAIL$|SOLAPI_|VAPID_|NEXT_PUBLIC_)/
export const cleanEnv = (env = process.env) => Object.fromEntries(Object.entries(env).filter(([k]) => !AMBIENT.test(k)))

export function runTests({ tap } = {}) {
  const args = ["--test", "--test-concurrency=3", "--import", "./scripts/test/no-user-env.mjs", "--test-reporter=spec", "--test-reporter-destination=stdout"]
  if (tap) {
    mkdirSync(dirname(resolve(tap)), { recursive: true })
    args.push("--test-reporter=tap", `--test-reporter-destination=${resolve(tap)}`)
  }
  const r = spawnSync(process.execPath, [...args, ...TEST_GLOBS], { cwd: ROOT, stdio: "inherit", env: cleanEnv() })
  return r.status ?? 1
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const i = process.argv.indexOf("--tap")
  process.exitCode = runTests({ tap: i === -1 ? undefined : process.argv[i + 1] })
}
