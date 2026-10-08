// 빌드 스모크의 순수 부분(LFSMOKE) — 서버·브라우저 없이 시험한다(launch-factory scripts/test/smoke.test.mjs). 오케스트레이터는 smoke.mjs.
// 제품 템플릿이 그대로 실어 준다(template.lock.json 이 해시를 잠근다). 저장소 구조를 가정하지 않는다 — 인자로 받은 폴더만 읽는다.
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

/**
 * live 가 켜질 때 요구하는 환경 이름 전부(LF_MODE + 공급자 비밀 여섯 + 템플릿 live 필수 다섯)와 **형식이 맞는 가짜 값**.
 * 값은 이 스모크의 빌드·서버에만 들어간다 — 실제 공급자에 닿지 않는다(DB 주소는 닫힌 포트, 나머지는 쓰이지 않는 글자).
 * 선택 이름(INQUIRY_OWNER_EMAIL · POSTHOG_HOST · POSTHOG_PROJECT_KEY · SENTRY_DSN)은 **일부러 넣지 않는다** — 「선택 이름이 없어도 사이트가 켜진다」를 보려는 것이다
 * (LFENV·LFOBS 사고: 선택이어야 할 이름이 켜질 때 검사에 끼어 배포한 사이트가 전 쪽 500 이었다).
 * 새 필수 이름을 live-env.ts 나 packages/env 에 더하면 이 표에도 더해야 한다 — 안 더하면 live 스모크가 서버가 켜지지 않아 빨강이고,
 * launch-factory 의 scripts/test/smoke.test.mjs 가 이 표의 이름 집합을 실제 필수 목록과 맞춰 본다(env-check 의 liveRequirements).
 */
/** 길이만 채우는 가짜 값(같은 글자를 이어 붙인다) — 비밀값 스캐너가 진짜 키로 읽는 무작위 모양을 일부러 피한다 */
const fill = (label, length) => `smoke-${label}-`.padEnd(length, "x")

export const LIVE_DUMMY = Object.freeze({
  LF_MODE: "live",
  DATABASE_URL: "postgres://smoke:smoke@127.0.0.1:1/smoke",
  BETTER_AUTH_SECRET: fill("auth", 40),
  PADDLE_API_KEY: "smoke-paddle-api-key",
  PADDLE_WEBHOOK_SECRET: "smoke-paddle-webhook-secret",
  RESEND_API_KEY: "smoke-resend-api-key",
  TURNSTILE_SECRET_KEY: "smoke-turnstile-secret-key",
  EMAIL_FROM: "Smoke <smoke@example.invalid>",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  CRON_SECRET: fill("cron", 24),
  SUBJECT_REF_KEY: fill("subject", 40),
  TURNSTILE_SITE_KEY: "smoke-turnstile-site-key",
})

/** 스모크 서버·빌드에 새는 걸 막으려고 지우는 이 PC·러너의 환경 이름(시험이 자기 환경을 소유한다 — run-tests.mjs 의 AMBIENT 와 같은 발상) */
export const AMBIENT_ENV = /^(?:LF_(?!CI_|SMOKE_)|PADDLE_|POSTHOG_|SENTRY_|RESEND_|TURNSTILE_|GUMROAD_|GOOGLE_CLIENT_|KAKAO_CLIENT_|NAVER_CLIENT_|DATABASE_URL$|BETTER_AUTH_|CRON_SECRET$|SUBJECT_REF_KEY$|EMAIL_FROM$|INQUIRY_OWNER_EMAIL$|NEXT_PUBLIC_|WF_SESSION$|NODE_ENV$)/

/** 환경에서 공급자·모드 이름을 지우고 extra 를 얹는다 */
export function cleanEnv(base, extra = {}) {
  const env = Object.fromEntries(Object.entries(base).filter(([k]) => !AMBIENT_ENV.test(k)))
  return { ...env, NEXT_TELEMETRY_DISABLED: "1", CI: "1", ...extra }
}

/** mode 별 빌드·서버 환경. mock = 장면 쿠키를 믿고 「쿠키 없음 = 로그아웃」(LF_MOCK_SCENES=1), live = 필수 이름만 가짜 값으로 */
export function modeEnv(mode, base = process.env) {
  if (mode === "mock") return cleanEnv(base, { LF_MODE: "mock", LF_ALLOW_MOCK_PROD: "1", LF_MOCK_SCENES: "1" })
  if (mode === "live") return cleanEnv(base, { ...LIVE_DUMMY })
  throw new Error(`모르는 모드: ${mode}`)
}

// ── axe 기준선(알려진 실패 목록) ─────────────────────────────────────────────────────────

/** 한 셀(쪽 × 장면)의 axe 위반 한 건의 키 */
export const axeKey = (cell, ruleId) => `${cell}|${ruleId}`

/**
 * axe 결과를 기준선과 맞춘다. 기준선 = { known: string[] } (키: `쪽|장면|규칙`).
 *  fresh — 기준선에 없는 위반(새 실패)  ·  fixed — 기준선에는 있는데 이번에 잰 셀에서 사라진 것(「기준선에서 지워라」)
 * fixed 는 이번에 실제로 잰 셀(measuredCells)에 대해서만 센다 — 잴 수 없었던 셀(테스트가 실패해 axe 가 안 돈 셀)을 「고쳐졌다」로 읽지 않는다.
 */
export function compareAxe(records, known) {
  const measured = new Set(records.map((r) => r.cell))
  const seen = new Set(records.flatMap((r) => r.violations.map((v) => axeKey(r.cell, v.id))))
  const base = new Set(known)
  const fresh = [...seen].filter((k) => !base.has(k)).sort()
  const fixed = [...base].filter((k) => measured.has(k.split("|").slice(0, 2).join("|")) && !seen.has(k)).sort()
  return { fresh, fixed, seen: [...seen].sort(), cells: measured.size }
}

/** jsonl(줄마다 { cell, violations: [{ id, impact, nodes }] })을 읽는다. 재시도로 같은 셀이 두 번 적혔으면 마지막 줄이 이긴다 */
export function readAxeRecords(file) {
  if (!existsSync(file)) return []
  const byCell = new Map()
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (!line.trim()) continue
    const r = JSON.parse(line)
    byCell.set(r.cell, r)
  }
  return [...byCell.values()]
}

export function readAxeBaseline(dir) {
  const file = join(dir, "e2e", "a11y-known.json")
  if (!existsSync(file)) return { file, known: [] }
  const j = JSON.parse(readFileSync(file, "utf8"))
  return { file, known: Array.isArray(j.known) ? j.known : [] }
}

// ── 브라우저 고르기 ──────────────────────────────────────────────────────────────────────

/**
 * 어떤 브라우저로 돌릴까. 순서: SMOKE_CHANNEL 로 지정 → 번들 chromium(`npx playwright install chromium` 한 것 — CI 와 같은 브라우저) → 설치된 Chrome → 설치된 Edge → null(없음).
 * 반환: { channel: string|null, label } — channel null 이면 번들 chromium 을 쓴다. 아무것도 없으면 undefined.
 */
export function pickBrowser({ env = process.env, exists = existsSync, platform = process.platform, bundled = null } = {}) {
  if (env.SMOKE_CHANNEL) return { channel: env.SMOKE_CHANNEL, label: `SMOKE_CHANNEL=${env.SMOKE_CHANNEL}` }
  if (bundled && exists(bundled)) return { channel: null, label: "Playwright 번들 chromium" }
  const win = (name, ...parts) => [env.PROGRAMFILES, env["PROGRAMFILES(X86)"], env.LOCALAPPDATA].filter(Boolean).map((b) => join(b, ...parts, name))
  const candidates =
    platform === "win32"
      ? [["chrome", win("chrome.exe", "Google", "Chrome", "Application")], ["msedge", win("msedge.exe", "Microsoft", "Edge", "Application")]]
      : platform === "darwin"
        ? [["chrome", ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"]], ["msedge", ["/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"]]]
        : [["chrome", ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/opt/google/chrome/chrome"]], ["msedge", ["/usr/bin/microsoft-edge"]]]
  for (const [channel, paths] of candidates) if (paths.some((p) => exists(p))) return { channel, label: `설치된 ${channel}` }
  return undefined
}

/** `npx playwright test` JSON 보고서의 stats 에서 한 줄 요약. flaky = 재시도해서 통과한 것(따로 센다) */
export function summarizeStats(stats) {
  const s = { expected: 0, unexpected: 0, flaky: 0, skipped: 0, ...stats }
  return { ...s, total: s.expected + s.unexpected + s.flaky + s.skipped, line: `통과 ${s.expected} · 실패 ${s.unexpected} · flaky(재시도 뒤 통과) ${s.flaky} · 건너뜀 ${s.skipped}` }
}
