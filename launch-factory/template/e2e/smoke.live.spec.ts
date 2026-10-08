// 빌드 스모크 · live 모드 켜짐(LFSMOKE). 서버: **필수 환경 이름만** 가짜 값으로 빌드·실행한 `next start`(smoke-lib.mjs LIVE_DUMMY).
// 지키는 것: 선택 이름(INQUIRY_OWNER_EMAIL · POSTHOG_HOST · POSTHOG_PROJECT_KEY · SENTRY_DSN)이 없어도 사이트가 켜지고 쪽이 그려진다.
// 사고 두 건: 선택이어야 할 이름이 켜질 때 검사에 끼어 배포한 사이트가 전 쪽 500 이었다(LFENV · LFOBS). 서버가 아예 안 켜지면 오케스트레이터가 이 시험 전에 실패한다.
// 공급자는 부르지 않는다 — DB 주소는 닫힌 포트다. 그래서 DB 를 읽는 쪽(로그인한 쪽)은 여기서 보지 않는다.
import { expect, test } from "@playwright/test"
import { appRoutes, ERROR_BOUNDARY } from "./lib.ts"

test("live: `/` 가 그려진다 — 선택 이름 없이", async ({ page }) => {
  const thrown: string[] = []
  page.on("pageerror", (e) => thrown.push(e.message))
  const res = await page.goto("/")
  expect(res?.status(), "첫 응답").toBe(200)
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {})
  const html = page.locator("html")
  // 선택 이름이 없으니 분석·오류 수집은 꺼져 있어야 한다(켜져 있으면 이 시험의 전제가 깨진 것이다 — 가짜 값 표에 선택 이름이 들어갔다)
  await expect(html).toHaveAttribute("data-analytics", "disabled")
  await expect(html).toHaveAttribute("data-error-reporting", "disabled")
  await expect(html, "live 에는 mock 장면 표지가 없다").not.toHaveAttribute("data-wf-session", /.*/)
  await expect(page.locator(ERROR_BOUNDARY), "오류 경계 화면이 그려졌다").toHaveCount(0)
  await expect(page.locator("h1").first()).toBeVisible()
  expect(thrown, "브라우저에서 잡히지 않은 예외").toEqual([])
})

test("live: 공개 쪽이 모두 200 이다", async ({ request }) => {
  const { routes } = appRoutes()
  // 계정·결제 쪽은 DB 로 로그인 여부를 물어 가짜 DB 에서는 의미가 없다 — 로그인 없이 열리는 쪽만
  const open = routes.filter((r) => !/^\/(account|upgrade|billing)(\/|$)/.test(r))
  expect(open.length, "공개 쪽을 하나도 못 찾았다").toBeGreaterThan(0)
  const bad: string[] = []
  for (const r of open) {
    const res = await request.get(r)
    if (res.status() !== 200) bad.push(`${r} → ${res.status()}`)
  }
  expect(bad, "200 이 아닌 공개 쪽").toEqual([])
})
