// 얹기 엔진 무거운 시험 — 시안을 얹은 출력이 npm install · next build 를 끝내고, 켠 서버의 `/` HTML 이 시안의 lang·테마 클래스를 가진다.
// 두 번째 묶음(링크 시험): 고른 기능이 다른 두 구성으로 saas-1 을 얹고 빌드한 뒤 `/` 와 남은 모든 쪽에서 web-factory 의 link-check 를 돌려
// 지운 쪽으로 가는 링크가 0 이고, 동의 띠·계측 뿌리가 고른 대로 서버가 낸 HTML 에 있거나 없는지 본다.
// 일반 단위 시험 묶음(npm test)에는 들어가지 않는다. `npm run compose:verify` 로 따로 돈다(관리자가 네트워크가 되는 PC 에서).
// 시안은 web-factory 가 찍은 골든 출력이다: 환경 변수 COMPOSE_SITE_SAAS_1 · COMPOSE_SITE_LANDING_1 에 폴더를 준다(없으면 이유를 적고 실패한다).
// link-check 는 WF_DIR(web-factory 폴더) 또는 형제 배치(../web-factory, ../web-factory-main)에서 찾고, 없으면 링크 시험은 이유를 적고 건너뛴다.
// 메모리가 3 GB 미만이면 시험은 건너뛰고 값을 적는다(무거운 실행 한 번에 하나씩). 대표의 키는 쓰지 않는다 — 자식 프로세스 환경에서 공급자 이름을 뺀다.
import assert from "node:assert/strict"
import { spawn, spawnSync } from "node:child_process"
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { createServer } from "node:net"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { fileURLToPath, pathToFileURL } from "node:url"
import { freeGb } from "../../template/scripts/ci/smoke.mjs"
import { cleanEnv, modeEnv } from "../../template/scripts/ci/smoke-lib.mjs"
import { composeProduct } from "../compose/compose-product.mjs"
import { readJson } from "../compose/lib.mjs"
import { droppedOf, turnedOn } from "../compose/rules/drop.mjs"

const LF = fileURLToPath(new URL("../..", import.meta.url))
const NPM = process.platform === "win32" ? "npm.cmd" : "npm"
const NPX = process.platform === "win32" ? "npx.cmd" : "npx"
const MIN_FREE_GB = 3
const SITES = [
  ["saas-1", "COMPOSE_SITE_SAAS_1"],
  ["landing-1", "COMPOSE_SITE_LANDING_1"],
]
const features = { version: 1, table: "", outcomes: ["signup", "payments"] }
/** 링크 시험의 두 구성 — 가입만, 그리고 결제·마케팅·분석까지. analytics: 서버가 낸 HTML 에 동의 띠·계측 뿌리가 있어야 하는가 */
const LINK_CASES = [
  { site: "saas-1", env: "COMPOSE_SITE_SAAS_1", name: "signup", outcomes: ["signup"], analytics: false },
  { site: "saas-1", env: "COMPOSE_SITE_SAAS_1", name: "signup+payments+marketing+analytics", outcomes: ["signup", "payments", "marketing", "analytics"], analytics: true },
  { site: "landing-1", env: "COMPOSE_SITE_LANDING_1", name: "signup", outcomes: ["signup"], analytics: false },
]

const killTree = (pid) => {
  if (process.platform === "win32") spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" })
  else {
    try {
      process.kill(-pid, "SIGKILL")
    } catch {
      /* 이미 끝났다 */
    }
  }
}

/** 명령을 돌려 종료 코드와 끝 40줄을 돌려준다. 시간 제한이 넘으면 프로세스 나무째 끈다 */
function sh(cmd, args, { cwd, env, timeoutMs }) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd, env, shell: process.platform === "win32", detached: process.platform !== "win32" })
    let tail = ""
    const keep = (b) => (tail = `${tail}${b}`.split("\n").slice(-40).join("\n"))
    child.stdout.on("data", keep)
    child.stderr.on("data", keep)
    const timer = setTimeout(() => killTree(child.pid), timeoutMs)
    child.on("close", (code) => {
      clearTimeout(timer)
      killTree(child.pid)
      resolve({ code, tail })
    })
  })
}

const freePort = () =>
  new Promise((resolve) => {
    const s = createServer()
    s.listen(0, () => {
      const { port } = s.address()
      s.close(() => resolve(port))
    })
  })

async function fetchHome(port, deadline) {
  for (;;) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/`)
      if (res.ok) return await res.text()
    } catch {
      /* 아직 안 켜졌다 */
    }
    if (Date.now() > deadline) throw new Error("서버가 / 를 200 으로 주지 않았다")
    await new Promise((r) => setTimeout(r, 1000))
  }
}

/** 얹고 → 설치 → 빌드 → 켠다. body({ to, port, html }) 가 끝나면 서버를 나무째 끄고 임시 폴더를 지운다 */
async function composeBuildServe({ id, siteDir, outcomes }, body) {
  const work = mkdtempSync(join(tmpdir(), `lf-compose-heavy-${id}-`))
  let server
  try {
    const to = join(work, "out")
    composeProduct({ siteDir, features: { ...features, outcomes }, lfDir: LF, to })
    const env = modeEnv("mock")
    const install = await sh(NPM, ["install", "--no-audit", "--no-fund"], { cwd: to, env: cleanEnv(process.env), timeoutMs: 20 * 60_000 })
    assert.equal(install.code, 0, `npm install 종료 ${install.code}\n${install.tail}`)
    const build = await sh(NPX, ["next", "build"], { cwd: to, env, timeoutMs: 20 * 60_000 })
    assert.equal(build.code, 0, `next build 종료 ${build.code}\n${build.tail}`)
    const port = await freePort()
    server = spawn(NPX, ["next", "start", "-p", String(port)], { cwd: to, env, shell: process.platform === "win32", detached: process.platform !== "win32", stdio: "ignore" })
    const html = await fetchHome(port, Date.now() + 120_000)
    await body({ to, port, html })
  } finally {
    if (server) killTree(server.pid)
    rmSync(work, { recursive: true, force: true, maxRetries: 5, retryDelay: 1000 })
  }
}

for (const [id, envName] of SITES) {
  test(`${id}: 얹은 출력이 npm install · next build 를 끝내고 / 가 시안의 lang·테마 클래스를 가진다`, { timeout: 40 * 60_000 }, async (t) => {
    const free = freeGb()
    if (free < MIN_FREE_GB) return t.skip(`heavy batch(메모리)로 미룸: 여유 ${free.toFixed(2)} GB < ${MIN_FREE_GB} GB`)
    const siteDir = process.env[envName]
    assert.ok(siteDir, `${envName} 에 web-factory 골든 ${id} 출력 폴더를 준다`)
    await composeBuildServe({ id, siteDir, outcomes: features.outcomes }, ({ html }) => {
      const site = JSON.parse(readFileSync(join(siteDir, "content", "site.json"), "utf8"))
      const { theme } = JSON.parse(readFileSync(join(siteDir, "lib", "build.json"), "utf8"))
      const tag = html.match(/<html\b[^>]*>/)?.[0] ?? ""
      assert.match(tag, new RegExp(`lang="${site.locale === "en" ? "en" : "ko"}"`), tag)
      assert.equal(/class="[^"]*\bdark\b/.test(tag), theme === "dark", `theme ${theme}: ${tag}`)
      assert.match(html, /data-wf-first|data-enter/, "시안 홈 블록이 그려졌다")
    })
  })
}

const wfDir = [process.env.WF_DIR, join(LF, "..", "web-factory"), join(LF, "..", "web-factory-main")].filter(Boolean).find((d) => existsSync(join(d, "factory", "stamp", "link-check.mjs")))
const FILE_PATH = /\.[a-z0-9]{2,5}$/i

/** 서버가 낸 HTML 의 같은 사이트 링크 경로(쿼리·앵커·끝 슬래시를 뗀 것) */
const internalPaths = (hrefs) =>
  hrefs
    .filter((h) => h.startsWith("/") && !h.startsWith("//"))
    .map((h) => h.split(/[?#]/)[0].replace(/(.)\/+$/, "$1"))
    .filter((p) => p && !FILE_PATH.test(p))

/** seeds 에서 시작해 링크를 따라가며 서버가 주는 HTML 을 모은다. 리다이렉트는 따라가고 404 는 기록한다 */
async function crawl(port, seeds, anchorHrefs) {
  const base = `http://127.0.0.1:${port}`
  const pages = {}
  const status = {}
  const queue = [...seeds]
  while (queue.length) {
    const route = queue.shift()
    if (route in status) continue
    const res = await fetch(`${base}${route}`, { redirect: "manual" })
    status[route] = res.status
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location")
      if (loc) queue.push(new URL(loc, base).pathname)
      continue
    }
    const html = await res.text()
    if (res.status !== 200) continue
    pages[route] = html
    queue.push(...internalPaths(anchorHrefs(html)))
  }
  return { pages, status }
}

for (const c of LINK_CASES) {
  test(`링크: ${c.site} {${c.name}} — 지운 쪽으로 가는 링크 0, 동의 띠·계측 뿌리는 고른 대로`, { timeout: 60 * 60_000, skip: wfDir ? false : "web-factory link-check.mjs 를 못 찾았다(WF_DIR 또는 ../web-factory 에 둔다)" }, async (t) => {
    const free = freeGb()
    if (free < MIN_FREE_GB) return t.skip(`heavy batch(메모리)로 미룸: 여유 ${free.toFixed(2)} GB < ${MIN_FREE_GB} GB`)
    const siteDir = process.env[c.env]
    assert.ok(siteDir, `${c.env} 에 web-factory 골든 ${c.site} 출력 폴더를 준다`)
    const { anchorHrefs, deadLinks } = await import(pathToFileURL(join(wfDir, "factory", "stamp", "link-check.mjs")).href)
    const table = readJson(join(LF, "features", "outcomes.generated.json"))
    const on = turnedOn(table, { outcomes: c.outcomes })
    const goneUrls = new Set([...droppedOf(table.pages, on), ...droppedOf(table.routes, on)].map((p) => p.url))
    assert.ok(goneUrls.has("/pricing") === !c.outcomes.includes("payments"))

    await composeBuildServe({ id: `${c.site}-link-${c.outcomes.length}`, siteDir, outcomes: c.outcomes }, async ({ to, port, html }) => {
      const enabled = readJson(join(to, "lib", "launch", "enabled.json"))
      // 표에서 꺼진 쪽이라도 시안 쪽이 같은 주소로 남으면(url-map siteWhenOff — 쇼핑몰의 /refund) 지운 쪽이 아니다
      for (const u of enabled.urls) goneUrls.delete(u)
      const seeds = ["/", ...enabled.urls.filter((u) => !u.startsWith("/api/") && !u.includes("[") && !FILE_PATH.test(u))]
      const { pages, status } = await crawl(port, seeds, anchorHrefs)
      assert.ok(Object.keys(pages).length >= 5, `찾은 쪽 ${Object.keys(pages).length}개: ${JSON.stringify(status)}`)
      const toGone = Object.entries(pages).flatMap(([route, h]) => internalPaths(anchorHrefs(h)).filter((p) => goneUrls.has(p)).map((p) => `${route} → ${p}`))
      assert.deepEqual([...new Set(toGone)], [], "지운 쪽으로 가는 링크")
      // 링크 태그가 아닌 곳(블록에 넘기는 props — href·signedInHref 같은 칸)에 지운 쪽 주소가 실려 가는지: 서버가 낸 HTML 의 직렬화된 값에 없다. 글 속에 적힌 경로(법정 쪽 본문)는 링크가 아니라 보지 않는다
      const inPayload = Object.entries(pages).flatMap(([route, h]) => [...goneUrls].filter((u) => !u.startsWith("/api/") && !u.includes("[") && new RegExp(`[Hh]ref"\\s*:\\s*"${u.replace(/[/]/g, "[/]")}(?=[?#"/&])`).test(h.replaceAll("\\\"", '"').replaceAll("\\u0026", "&"))).map((u) => `${route} 에 ${u}`))
      assert.deepEqual(inPayload, [], "서버가 낸 HTML(props 포함)에 지운 쪽 주소")
      for (const u of goneUrls) {
        if (u.includes("[") || u.startsWith("/api/")) continue
        const res = await fetch(`http://127.0.0.1:${port}${u}`, { redirect: "manual" })
        assert.equal(res.status, 404, `지운 쪽 ${u} 은 404`)
      }
      const known = Object.entries(status).filter(([, code]) => code < 400).map(([route]) => route)
      const dead = deadLinks({ routes: known, pages }).filter((d) => d.why === "route")
      assert.deepEqual(dead, [], "남은 쪽 사이에 닿지 않는 링크")
      // 사이트맵: 지운 쪽은 없고, 템플릿 공개 쪽(lib/public-paths.json — seo.ts PUBLIC_PATHS 가 읽는 파일) 중 남은 것은 모두 있다
      const sitemap = await (await fetch(`http://127.0.0.1:${port}/sitemap.xml`)).text()
      const listed = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname.replace(/(.)\/+$/, "$1"))
      assert.deepEqual(listed.filter((p) => goneUrls.has(p)), [], "사이트맵에 지운 쪽")
      const publicPaths = JSON.parse(readFileSync(join(to, "lib", "public-paths.json"), "utf8"))
      assert.ok(Array.isArray(publicPaths) && publicPaths.length > 0, "공개 쪽 목록이 비었다 — 아래 검사가 아무것도 보지 않는다")
      assert.deepEqual(publicPaths.filter((p) => enabled.urls.includes(p) && !listed.includes(p)), [], "사이트맵에 빠진 남은 공개 쪽")
      // 동의 띠·계측 뿌리: 서버가 낸 HTML(서버 컴포넌트 트리의 클라이언트 참조 이름)에 있는가
      assert.equal(html.includes("ConsentBanner"), c.analytics, "ConsentBanner")
      assert.equal(html.includes("ProductAnalytics"), c.analytics, "ProductAnalytics")
      assert.match(html.match(/<html\b[^>]*>/)?.[0] ?? "", new RegExp(`data-analytics="${c.analytics ? "enabled" : "disabled"}"`))
    })
  })
}
