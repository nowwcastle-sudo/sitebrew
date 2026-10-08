// 빌드 스모크 설정(LFSMOKE). 직접 `npx playwright test` 를 부르지 말고 `npm run smoke`(scripts/ci/smoke.mjs)를 쓴다 — 빌드·서버·정리를 오케스트레이터가 한다.
// 설정 근거(Playwright 문서 「Continuous Integration」): workers 1(안정·재현성), retries 로 재시도해 통과한 시험은 「flaky」로 따로 보인다, forbidOnly 로 test.only 를 막는다.
// 환경: SMOKE_BASE_URL(서버 주소) · SMOKE_OUT(결과 폴더) · SMOKE_AXE_OUT(axe jsonl) · SMOKE_CHANNEL(설치된 브라우저 이름 — 비우면 번들 chromium).
import { defineConfig } from "@playwright/test"

const out = process.env.SMOKE_OUT || ".tmp/smoke/run"

export default defineConfig({
  testDir: "e2e",
  outputDir: `${out}/test-results`,
  fullyParallel: false,
  workers: 1,
  retries: 1,
  forbidOnly: true,
  // 한 곳이 무너지면 모든 쪽이 같이 빨개진다(장면 표지를 지운 실험: 48개 × 재시도 × 11초 ≈ 17분). 10개 실패에서 멈춘다 — 빨강은 이미 확정이고 CI 분을 아낀다
  maxFailures: 10,
  timeout: 60_000,
  expect: { timeout: 5_000 },
  reporter: [["list"], ["html", { open: "never", outputFolder: `${out}/report` }], ["json", { outputFile: `${out}/results.json` }], ...(process.env.GITHUB_ACTIONS ? ([["github"]] as const) : [])],
  use: {
    baseURL: process.env.SMOKE_BASE_URL,
    channel: process.env.SMOKE_CHANNEL || undefined,
    locale: "en-US",
    // 등장 효과가 색 대비 같은 측정을 흔들지 않게 한다
    reducedMotion: "reduce",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "mock", testMatch: "smoke.mock.spec.ts" },
    { name: "live", testMatch: "smoke.live.spec.ts" },
  ],
})
