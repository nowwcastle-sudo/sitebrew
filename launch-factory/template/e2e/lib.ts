// 빌드 스모크의 공용 부품(LFSMOKE). 쪽 목록은 앱 경로 template/app/**/page.tsx 에서 읽는다 — 새 쪽을 만들면 저절로 들어간다(scripts/template-screens 의 쪽 목록과 같은 규칙).
import { appendFileSync, mkdirSync, readdirSync, statSync } from "node:fs"
import { dirname, join, relative, sep } from "node:path"

export const SCENE_COOKIE = "wf_session"
export const SCENE_OUT = "signed-out"
export const SCENE_IN = "signed-in"
export const SCENE_PAST_DUE = "signed-in:sub=past_due"

/** 결제 화면 — 구독 상태(past_due)에서도 한 번 더 본다. 새 결제 쪽이 이름 규칙을 따르면 저절로 걸린다 */
export const BILLING_PATH = /(^|\/)(billing|upgrade|pricing|cancel|price-change)(\/|$)/

/** app/ 아래 page.tsx → 주소. 라우트 그룹 (x)·병렬 슬롯 @x 는 주소에 없고, [동적] 조각이 있는 쪽은 주소를 못 만들어 dynamic 으로 따로 센다 */
export function routesFromApp(appDir: string): { routes: string[]; dynamic: string[] } {
  const found: string[][] = []
  const walk = (dir: string) => {
    for (const name of readdirSync(dir).sort()) {
      const full = join(dir, name)
      if (statSync(full).isDirectory()) walk(full)
      else if (/^page\.(tsx|jsx|ts|js|mdx)$/.test(name)) found.push(relative(appDir, dir).split(sep).filter(Boolean))
    }
  }
  walk(appDir)
  const routes: string[] = []
  const dynamic: string[] = []
  for (const segs of found) {
    const parts = segs.filter((s) => !/^\(.*\)$/.test(s) && !s.startsWith("@"))
    const path = "/" + parts.join("/")
    if (parts.some((s) => /^\[.*\]$/.test(s))) dynamic.push(path)
    else routes.push(path)
  }
  return { routes: [...new Set(routes)].sort(), dynamic: [...new Set(dynamic)].sort() }
}

export const appRoutes = () => routesFromApp(join(process.cwd(), "app"))

/** 쪽 하나가 돌 장면: 로그아웃·로그인, 결제 쪽은 연체(past_due)까지 */
export const scenesFor = (path: string): string[] => [SCENE_OUT, SCENE_IN, ...(BILLING_PATH.test(path) ? [SCENE_PAST_DUE] : [])]

/** 장면 쿠키(값은 encodeURIComponent) */
export const sceneCookie = (scene: string, url: string) => ({ name: SCENE_COOKIE, value: encodeURIComponent(scene), url })
export const sceneHeader = (scene: string) => ({ cookie: `${SCENE_COOKIE}=${encodeURIComponent(scene)}` })

/** 응답 HTML 의 <html data-wf-session="…"> 값(없으면 null) */
export function sceneMarker(html: string): string | null {
  const tag = /<html\b[^>]*>/i.exec(html)?.[0] ?? ""
  return /\sdata-wf-session="([^"]*)"/.exec(tag)?.[1] ?? null
}

/** 로그인 안내(SignInRequired)가 그려졌는가 — 제목 id */
export const hasSignInPrompt = (html: string) => /id="sign-in-required-title"/.test(html)

/** 오류 경계가 그린 화면의 표지(app/error.tsx · global-error.tsx → data-error-code). not_found 는 없는 주소 화면 */
export const ERROR_BOUNDARY = '[data-error-code="server_error"], [data-error-code="client_error"], [data-error-code="not_found"]'

/** axe 결과 한 셀을 jsonl 에 남긴다(오케스트레이터가 기준선과 맞춘다). 재시도로 같은 셀이 두 번 적히면 마지막 줄이 이긴다 */
export function recordAxe(cell: string, violations: { id: string; impact?: string | null; nodes: unknown[] }[]) {
  const file = process.env.SMOKE_AXE_OUT
  if (!file) return
  mkdirSync(dirname(file), { recursive: true })
  appendFileSync(file, `${JSON.stringify({ cell, violations: violations.map((v) => ({ id: v.id, impact: v.impact ?? null, nodes: v.nodes.length })) })}\n`)
}
