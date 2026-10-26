// 관리 화면 브라우저 시험 설정. 직접 부르지 말고 `npm run e2e:admin`(scripts/e2e-admin/run.mjs)을 쓴다 — 템플릿 사본 빌드·서버·정리를 오케스트레이터가 한다.
// 환경: SMOKE_BASE_URL · SMOKE_OUT · SMOKE_CHANNEL · SMOKE_OUTBOX(서버의 메일 기록 파일) · ADMIN_SEED_EMAIL · ADMIN_SEED_2FA_FILE. 실행 폴더(cwd)는 템플릿 사본이다(e2e/loop-steps.json 을 거기서 읽는다).
import { dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig } from "@playwright/test"

const out = process.env.SMOKE_OUT || ".tmp/e2e-admin/run"

export default defineConfig({
  testDir: dirname(fileURLToPath(import.meta.url)),
  testMatch: "admin.spec.ts",
  outputDir: `${out}/test-results`,
  // 한 서버 안에 기록이 쌓이고 계정 가입은 한 번뿐이다 — 병렬·재시도 없음
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  timeout: 60_000,
  expect: { timeout: 5_000 },
  reporter: [["list"], ["json", { outputFile: `${out}/results.json` }], ...(process.env.GITHUB_ACTIONS ? ([["github"]] as const) : [])],
  use: {
    baseURL: process.env.SMOKE_BASE_URL,
    channel: process.env.SMOKE_CHANNEL || undefined,
    locale: "en-US",
    reducedMotion: "reduce",
    trace: "retain-on-failure",
  },
})
