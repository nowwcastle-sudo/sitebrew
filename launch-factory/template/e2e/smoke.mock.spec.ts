// 빌드 스모크 · mock 모드(LFSMOKE). 서버: LF_MODE=mock LF_MOCK_SCENES=1 로 빌드한 `next start`(scripts/ci/smoke.mjs 가 띄운다).
//  1) 장면 정찰 — 응답의 <html data-wf-session> 표지가 장면과 같은지(「장면이 안 걸렸는데 통과」를 막는다. 첫 전체 실행에서 실제로 로그아웃 장면이 로그인으로 오염됐다)
//  2) 쪽 × 장면 — 모든 page.tsx 쪽이 모든 장면에서 200, 오류 경계 없음, 잡히지 않은 예외 없음
//  3) axe — 위반은 막지 않는다(경고). 기준선(e2e/a11y-known.json)과의 비교는 오케스트레이터가 한다
import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"
import { appRoutes, ERROR_BOUNDARY, hasSignInPrompt, recordAxe, SCENE_IN, SCENE_OUT, SCENE_PAST_DUE, sceneCookie, sceneHeader, sceneMarker, scenesFor } from "./lib.ts"

const { routes, dynamic } = appRoutes()

test.describe("장면 정찰", () => {
  test("표지가 장면과 같다: 로그아웃·로그인·연체", async ({ request }) => {
    for (const scene of [SCENE_OUT, SCENE_IN, SCENE_PAST_DUE]) {
      const html = await (await request.get("/", { headers: sceneHeader(scene) })).text()
      expect(sceneMarker(html), `장면 ${scene} 의 <html data-wf-session>`).toBe(scene)
    }
  })

  test("모르는 장면(위조·오타)은 로그아웃이다", async ({ request }) => {
    for (const forged of ["signed-in:sub=gold", "admin", "signed-in:sub=active;role=admin"]) {
      const res = await request.get("/account", { headers: sceneHeader(forged) })
      const html = await res.text()
      expect(hasSignInPrompt(html), `장면 ${forged} 가 로그인으로 읽혔다`).toBe(true)
    }
  })

  test("보호된 쪽: 로그아웃(쿠키 없음 포함)은 로그인 안내, 로그인은 안내 없음", async ({ request }) => {
    const none = await (await request.get("/account")).text()
    expect(hasSignInPrompt(none), "쿠키 없음 = 로그아웃(LF_MOCK_SCENES=1) 이어야 한다").toBe(true)
    const out = await (await request.get("/account", { headers: sceneHeader(SCENE_OUT) })).text()
    expect(hasSignInPrompt(out), "로그아웃 /account 가 「Sign in to continue」를 안 그린다").toBe(true)
    const inn = await (await request.get("/account", { headers: sceneHeader(SCENE_IN) })).text()
    expect(hasSignInPrompt(inn), "로그인 /account 가 로그인 안내를 그린다").toBe(false)
  })

  test("쪽 목록: 쪽이 있고 동적 쪽은 따로 센다", async () => {
    expect(routes.length, "app/**/page.tsx 에서 쪽을 하나도 못 읽었다").toBeGreaterThan(0)
    expect(routes).toContain("/")
    test.info().annotations.push({ type: "pages", description: `쪽 ${routes.length}개 · 동적 쪽(주소를 못 만들어 건너뜀) ${dynamic.length}개 ${dynamic.join(" ")}` })
  })
})

test("없는 주소는 404 이고 오류 경계(not_found)를 그린다", async ({ page }) => {
  const res = await page.goto("/__smoke_no_such_page__")
  expect(res?.status()).toBe(404)
  await expect(page.locator('[data-error-code="not_found"]').first()).toBeVisible()
})

test.describe("쪽 × 장면", () => {
  for (const route of routes) {
    for (const scene of scenesFor(route)) {
      test(`${route} · ${scene}`, async ({ page, context, baseURL }) => {
        await context.addCookies([sceneCookie(scene, baseURL!)])
        // 이 셀의 쪽이 잡히지 않은 예외를 던졌는가(수화 오류 포함)
        const thrown: string[] = []
        page.on("pageerror", (e) => thrown.push(e.message))

        const res = await page.goto(route)
        expect(res?.status(), `${route} 첫 응답`).toBe(200)
        // 수화·등장 효과가 가라앉을 때까지(외부 네트워크가 없어 오래 안 걸린다). 못 가라앉아도 아래 검사는 한다
        await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {})

        await expect(page.locator("html"), "장면 표지(<html data-wf-session>)").toHaveAttribute("data-wf-session", scene)
        await expect(page.locator(ERROR_BOUNDARY), "오류 경계 화면이 그려졌다").toHaveCount(0)
        await expect(page.locator("h1").first(), "쪽에 보이는 제목(h1)이 없다").toBeVisible()
        expect(thrown, "브라우저에서 잡히지 않은 예외").toEqual([])

        // 접근성: 막지 않는다. 결과만 남기고 오케스트레이터가 기준선과 맞춰 경고한다
        const axe = await new AxeBuilder({ page }).analyze()
        recordAxe(`${route}|${scene}`, axe.violations)
      })
    }
  }
})
