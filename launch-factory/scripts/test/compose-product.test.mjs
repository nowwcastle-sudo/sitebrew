// 얹기 엔진(scripts/compose) 가벼운 시험. 무거운 빌드(npm install · next build)는 compose-product.heavy.mjs 에서 따로 돈다.
// 시안은 web-factory 를 부르지 않고 실측 모양을 줄인 작은 폴더로 만든다 — 규칙표가 실측 파일 전부를 덮는지는 inventory.json 으로 본다.
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { after, describe, test } from "node:test"
import { fileURLToPath } from "node:url"
import { checkFeatures, composeProduct } from "../compose/compose-product.mjs"
import { globToRegExp, isSkipped, isTextFile, matchesAny, urlOf, walk, withSecrets } from "../compose/lib.mjs"
import { BLOCKS } from "../compose/rules/index.mjs"
import { mergeTheme, parseCss } from "../compose/rules/cssTheme.mjs"
import { mergeLayout } from "../compose/rules/layoutMerge.mjs"
import { dropCrons, droppedOf, filterLoopSteps, planCtaBlocks, pruneLinks, publicPaths, scanGoneLinks, turnedOn } from "../compose/rules/drop.mjs"
import { mergeLines, reincludesSecret } from "../compose/rules/mergeLines.mjs"
import { makeEnabled } from "../../template/lib/launch/enabled.ts"
import { applyCatalog } from "../compose/rules/catalogFromSite.mjs"
import * as packageNameBlock from "../compose/rules/packageName.mjs"
import * as rootMetaBlock from "../compose/rules/rootMeta.mjs"
import * as plan from "../compose/rules/plan.mjs"
import * as scriptsBlock from "../compose/rules/scripts.mjs"
import * as vendorBlock from "../compose/rules/vendor.mjs"
import * as templateBlock from "../compose/rules/template.mjs"
import { rewriteLinks } from "../compose/rules/urlMap.mjs"
import { loadLoopSteps, planLoop, routesFromApp } from "../../template/e2e/lib.ts"

const HERE = dirname(fileURLToPath(import.meta.url))
const LF = join(HERE, "..", "..")
const COMPOSE = join(LF, "scripts", "compose")
const readJson = (f) => JSON.parse(readFileSync(f, "utf8"))
const rules = readJson(join(COMPOSE, "rules.json"))
const urlMap = readJson(join(COMPOSE, "url-map.json"))
const inventory = readJson(join(COMPOSE, "inventory.json"))
const table = readJson(join(LF, "features", "outcomes.generated.json"))

const tmp = mkdtempSync(join(tmpdir(), "lf-compose-test-"))
after(() => rmSync(tmp, { recursive: true, force: true }))
let n = 0
const fresh = (name) => join(tmp, `${name}-${n++}`)

const LAYOUT = `import "./globals.css"
import { MotionBoot } from "@/components/motion/motion-boot"
import { cn } from "@/lib/utils"
import build from "@/lib/build.json"
import site from "@/content/site.json"
import { Besley } from "next/font/google";

const besleyWf = Besley({subsets:['latin'],variable:'--font-besley-wf'});

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang={site.locale === "en" ? "en" : "ko"} suppressHydrationWarning className={cn("antialiased", build.theme === "dark" && "dark", besleyWf.variable)}>
      <head><MotionBoot /></head>
      <body>{children}</body>
    </html>
  )
}
`
const CSS = `@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";
@import "./fonts/fonts.css";

@custom-variant dark (&:is(.dark *));

@theme inline {
    --font-sans: var(--font-site-wf);
}

:root {
    --site-root-marker: 1;
}

.dark {
    --site-dark-marker: 1;
}

@layer base {
  svg.tabler-icon { stroke-width: 1.5; }
}

@layer base {
  [data-face="field-1"] { --site-face-marker: 1; }
}
`
const SITE_FILES = {
  "app/layout.tsx": LAYOUT,
  "app/globals.css": CSS,
  "app/page.tsx": 'export default function Page() { return <main data-site-home>site home</main> }\n',
  "app/login/page.tsx": 'export default function Page() { return <p>site login</p> }\n',
  "app/signup/page.tsx": 'export default function Page() { return <p>site signup</p> }\n',
  "app/pricing/page.tsx": 'export default function Page() { return <p>site pricing</p> }\n',
  "app/campaign/page.tsx": 'export default function Page() { return <p>site campaign</p> }\n',
  "app/fonts/fonts.css": "/* fonts */\n",
  "components/site/login-auth.tsx": 'import { makePorts } from "@/lib/ports"\nexport const ports = makePorts\n',
  "components/site/signup-auth.tsx": "import { makePorts } from '@/lib/ports'\nexport const ports = makePorts\n",
  "lib/ports.ts": "export function makePorts() { return {} }\n",
  "lib/build.json": '{ "theme": "dark" }\n',
  "content/site.json": JSON.stringify({ locale: "ko", site: { url: "https://www.Gyeonjeok.example.com" }, shell: { action: { href: "/signup" }, nav: [{ href: "/login" }, { href: "/pricing#plans" }, { href: "/login-help" }] } }, null, 2),
  "package.json": JSON.stringify({ name: "wf-stamp-site", dependencies: { next: "16.3.8", pretendard: "^1.3.9" }, devDependencies: {} }, null, 2),
  "package-lock.json": JSON.stringify({ lockfileVersion: 3, packages: { "node_modules/next": { version: "16.3.8" }, "node_modules/pretendard": { version: "1.3.9" } } }, null, 2),
  ".pkg-hash": "abc\n",
  ".gitignore": "/node_modules\n/site-only-ignore\n",
  "next.config.ts": "export default {}\n",
}
function makeSite(extra = {}) {
  const dir = fresh("site")
  for (const [rel, text] of Object.entries({ ...SITE_FILES, ...extra })) {
    mkdirSync(dirname(join(dir, rel)), { recursive: true })
    writeFileSync(join(dir, rel), text)
  }
  return dir
}
const features = { version: 1, table: table.hash, outcomes: ["signup", "payments"] }

let composed
const compose = () => (composed ??= (() => {
  const to = fresh("out")
  return { to, result: composeProduct({ siteDir: makeSite(), features, table, to }) }
})())
const out = (rel) => readFileSync(join(compose().to, rel), "utf8")

describe("규칙표", () => {
  test("rules.json 이 inventory.json 의 모든 경로를 덮고, 안 쓰이는 규칙은 없다", () => {
    const paths = Object.keys(inventory.paths)
    assert.ok(paths.length > 200, `실측 경로 ${paths.length}개`)
    const unmatched = paths.filter((p) => !rules.rules.some((r) => matchesAny(r.match, p)))
    assert.deepEqual(unmatched, [])
    const first = new Map(paths.map((p) => [p, rules.rules.find((r) => matchesAny(r.match, p))]))
    const unused = rules.rules.filter((r) => ![...first.values()].includes(r))
    assert.deepEqual(unused.map((r) => r.match), [], "첫 줄로 쓰이는 파일이 하나도 없는 규칙")
  })

  test("inventory.json 은 원형 10종 골든 시안(<원형>-1)의 실측과 그 출력 해시를 적는다", () => {
    assert.deepEqual(Object.keys(inventory.sources), ["brand-1", "commerce-1", "dashboard-1", "detail-1", "landing-1", "local-1", "portfolio-1", "public-1", "pwa-1", "saas-1"])
    for (const s of Object.values(inventory.sources)) {
      assert.match(s.hash, /^[0-9a-f]{64}$/)
      assert.match(s.command, /golden/)
    }
    assert.ok(Object.values(inventory.paths).every((ids) => ids.length >= 1))
  })

  test("모든 규칙 종류에 블록이 있고, urlMap 규칙의 쪽은 url-map.json 에 줄이 있다", () => {
    const ids = BLOCKS.map((b) => b.id)
    for (const kind of new Set(rules.rules.map((r) => r.kind))) assert.ok(ids.includes(kind), `블록 없음: ${kind}`)
    for (const id of ["keep", "replace", "copy", "rename", "cssTheme", "layoutMerge", "mergeDeps", "mergeLines", "packageName", "rootMeta", "vendor", "urlMap", "scripts", "drop"]) assert.ok(ids.includes(id), `등록부에 없음: ${id}`)
    const rows = new Set(urlMap.rows.map((r) => r.site))
    const pages = Object.keys(inventory.paths).filter((p) => rules.rules.find((r) => matchesAny(r.match, p))?.kind === "urlMap")
    assert.ok(pages.length >= 9)
    for (const p of pages) assert.ok(rows.has(urlOf(p)), `${p} 의 URL 줄 없음`)
  })

  test("url-map: 실측 saas 시안의 쪽이 문서대로 정해져 있다", () => {
    const to = Object.fromEntries(urlMap.rows.map((r) => [r.site, [r.template, r.winner]]))
    assert.deepEqual(to["/login"], ["/sign-in", "template"])
    assert.deepEqual(to["/signup"], ["/sign-up", "template"])
    assert.deepEqual(to["/billing"], ["/account/billing", "template"])
    assert.deepEqual(to["/cancel"], ["/account/cancel", "template"])
    for (const u of ["/pricing", "/account", "/privacy", "/refund", "/terms"]) assert.deepEqual(to[u], [u, "template"])
    assert.deepEqual(to["/"], ["/", "site"])
  })

  test("url-map: 상점 쪽은 템플릿이 이기고, /products(공개 상품 목록)는 시안이 자기 것을 가지면 시안이 이긴다", () => {
    const to = Object.fromEntries(urlMap.rows.map((r) => [r.site, [r.template, r.winner]]))
    for (const u of ["/cart", "/checkout", "/orders", "/orders/[id]"]) assert.deepEqual(to[u], [u, "template"], u)
    assert.deepEqual(to["/checkout/complete"], ["/orders", "template"])
    assert.deepEqual(to["/products"], ["/products", "site"], "시안의 /products 는 템플릿의 공개 상품 목록과 같은 URL — 시안이 이긴다")
    const templateUrls = new Set(walk(join(LF, "template"), rules.templateExclude).map(urlOf).filter(Boolean))
    assert.ok(templateUrls.has("/products"), "템플릿에 공개 상품 목록이 있다")
    for (const u of ["/cart", "/checkout", "/checkout/return", "/orders", "/orders/[id]"]) assert.ok(templateUrls.has(u), `템플릿에 ${u} 가 있다`)
  })
})

describe("글롭·URL", () => {
  test("글롭: ** 는 폴더를 넘고 * 는 한 폴더 안, 괄호는 글자다", () => {
    assert.ok(globToRegExp("components/site/**").test("components/site/a/b.tsx"))
    assert.ok(!globToRegExp("lib/*").test("lib/a/b.ts"))
    assert.ok(globToRegExp("app/(product)/page.tsx").test("app/(product)/page.tsx"))
  })
  test("urlOf: route group 은 URL 에 들지 않고 page·route 파일만 URL 이 있다", () => {
    assert.equal(urlOf("app/(product)/page.tsx"), "/")
    assert.equal(urlOf("app/(legal)/privacy/page.tsx"), "/privacy")
    assert.equal(urlOf("app/robots.txt/route.ts"), "/robots.txt")
    assert.equal(urlOf("app/api/auth/[...all]/route.ts"), "/api/auth/[...all]")
    assert.equal(urlOf("app/error.tsx"), null)
    assert.equal(urlOf("lib/page.tsx"), null)
  })
  test("rewriteLinks: 따옴표 맨 앞의 URL 만 바꾸고 ?·# 꼬리는 남긴다", () => {
    const moves = [{ site: "/login", template: "/sign-in" }]
    assert.equal(rewriteLinks('"/login" "/login?next=/a" \'/login#x\' `/login` "/login-help" "/a/login" "x/login"', moves), '"/sign-in" "/sign-in?next=/a" \'/sign-in#x\' `/sign-in` "/login-help" "/a/login" "x/login"')
  })
})

describe("composeProduct", () => {
  test("출력 / 는 시안 홈이고 템플릿 홈은 없다, /sign-up·/pricing 은 템플릿 것, /login 은 없다", () => {
    const to = compose().to
    assert.match(out("app/page.tsx"), /data-site-home/)
    assert.ok(!existsSync(join(to, "app/(product)/page.tsx")))
    assert.ok(existsSync(join(to, "app/(product)/sign-up/page.tsx")))
    assert.ok(existsSync(join(to, "app/(product)/sign-in/page.tsx")))
    assert.ok(existsSync(join(to, "app/(product)/pricing/page.tsx")))
    for (const gone of ["app/login", "app/signup", "app/pricing"]) assert.ok(!existsSync(join(to, gone)), gone)
    assert.match(out("app/campaign/page.tsx"), /site campaign/)
    assert.deepEqual(compose().result.dropped.sort(), ["app/login/page.tsx", "app/pricing/page.tsx", "app/signup/page.tsx"])
    assert.deepEqual(
      compose().result.removed,
      ["app/(product)/page.tsx", "app/(product)/contact/page.tsx", "app/(product)/book/page.tsx", "app/(product)/book/manage/page.tsx", "app/(product)/book/return/page.tsx", "app/(product)/account/notifications/page.tsx", "app/(product)/products/page.tsx", "app/(product)/cart/page.tsx", "app/(product)/checkout/page.tsx", "app/(product)/checkout/return/page.tsx", "app/(product)/orders/page.tsx", "app/(product)/orders/[id]/page.tsx", "app/api/booking/route.ts", "app/api/booking/slots/route.ts", "app/api/cron/booking/route.ts", "app/api/cron/commerce/route.ts", "app/api/cron/consents/route.ts", "app/api/cron/inquiry/route.ts", "app/api/cron/newsletter/route.ts", "app/api/cron/search/route.ts", "app/api/cron/storage/route.ts", "app/api/inquiry/route.ts", "app/api/marketing/keep/route.ts", "app/api/marketing/unsubscribe/route.ts", "app/api/newsletter/confirm/route.ts", "app/api/newsletter/route.ts", "app/api/newsletter/unsubscribe/route.ts", "app/api/reviews/route.ts", "app/api/search/route.ts", "app/api/storage/complete/route.ts", "app/api/storage/local/[...key]/route.ts", "app/api/storage/ticket/route.ts", "app/api/webhooks/portone/route.ts"],
      "홈 교체 + 고르지 않은 문의·동의·상점·후기·검색·파일·뉴스레터 기능의 쪽·API",
    )
    assert.deepEqual(compose().result.kept.sort(), [".pkg-hash", "next.config.ts"])
    assert.ok(compose().result.vendored.includes("@launch-factory/auth") && compose().result.vendored.length >= 10)
  })

  test("시안 안의 링크가 템플릿 URL 로 바뀐다 (/login → /sign-in, /signup → /sign-up)", () => {
    const site = readJson(join(compose().to, "content/site.json"))
    assert.equal(site.shell.action.href, "/sign-up")
    assert.deepEqual(site.shell.nav.map((l) => l.href), ["/sign-in", "/pricing#plans", "/login-help"])
  })

  test("rename: 가져온 시안 파일은 @/lib/ports 를 import 하지 않고 @/lib/site-ports 를 쓴다", () => {
    for (const f of ["components/site/login-auth.tsx", "components/site/signup-auth.tsx"]) {
      assert.doesNotMatch(out(f), /@\/lib\/ports/)
      assert.match(out(f), /["']@\/lib\/site-ports["']/)
    }
    assert.match(out("lib/site-ports.ts"), /makePorts/)
    assert.equal(out("lib/ports.ts"), readFileSync(join(LF, "template", "lib", "ports.ts"), "utf8"), "템플릿 ports() 는 그대로")
    assert.match(out("app/layout.tsx"), /from "@\/lib\/ports"/, "템플릿 layout 의 import 는 건드리지 않는다")
  })

  test("layout: 템플릿 layout 에 시안의 lang·dark 클래스·글꼴 로더가 들고 nonce 는 그대로다", () => {
    const layout = out("app/layout.tsx")
    assert.match(layout, /<html lang=\{site\.locale === "en" \? "en" : "ko"\} className=\{cn\("antialiased", build\.theme === "dark" && "dark", besleyWf\.variable\)\}/)
    assert.match(layout, /const besleyWf = Besley\(/)
    assert.match(layout, /import \{ Besley \} from "next\/font\/google"/)
    assert.match(layout, /<MotionBoot nonce=\{nonce\} \/>/)
    assert.match(layout, /data-wf-session=/)
  })

  test("globals.css: 시안의 :root·.dark·@theme inline·글꼴 import 가 들고 템플릿의 @custom-variant 는 남는다", () => {
    const css = out("app/globals.css")
    for (const marker of ["--font-site-wf", "--site-root-marker", "--site-dark-marker", "svg.tabler-icon", "--site-face-marker", "svg.lucide", '@import "./fonts/fonts.css"']) assert.ok(css.includes(marker), marker)
    assert.ok(!css.includes("@fontsource"), "템플릿 글꼴 import 는 시안 것으로 바뀐다")
    assert.ok(css.includes("@custom-variant dark"))
    assert.ok(css.includes("prefers-reduced-motion"), "템플릿의 나머지 블록")
  })

  test("package.json: @launch-factory/* 는 상대 file:, 시안 의존이 더해지고 템플릿 판·저장소 전용 스크립트는 정리된다", () => {
    const pkg = JSON.parse(out("package.json"))
    const lf = Object.entries({ ...pkg.dependencies, ...pkg.devDependencies }).filter(([n]) => n.startsWith("@launch-factory/"))
    assert.ok(lf.length >= 10)
    for (const [name, spec] of lf) {
      assert.equal(spec, `file:./vendor/launch-factory/${name.slice("@launch-factory/".length)}`)
      assert.ok(existsSync(join(compose().to, spec.slice("file:./".length), "package.json")), name)
    }
    assert.equal(pkg.dependencies["@launch-factory/inquiry"], "file:./vendor/launch-factory/inquiry", "템플릿 소스가 import 하는데 package.json 에 없는 패키지도 벤더한다")
    assert.equal(pkg.dependencies.pretendard, "1.3.9")
    assert.equal(pkg.devDependencies["playwright-core"], pkg.devDependencies["@playwright/test"], "playwright-core 판이 @playwright/test 와 같다(잠금 없는 출력에서 타입이 갈라지지 않게)")
    assert.equal(pkg.dependencies.next, readJson(join(LF, "template", "package.json")).dependencies.next, "템플릿 판이 이긴다")
    assert.ok("ci:verify" in pkg.scripts && "smoke" in pkg.scripts, "출력의 .github/workflows/ci.yml 이 부르는 스크립트가 남는다")
    assert.equal(pkg.name, "gyeonjeok", "이름은 시안 주소의 첫 마디")
    assert.equal(pkg.devDependencies["playwright-core"], readJson(join(LF, "template", "package.json")).devDependencies["playwright-core"], "템플릿에 고정된 판")
    const auth = readJson(join(compose().to, "vendor/launch-factory/auth/package.json"))
    assert.equal(auth.dependencies["@launch-factory/db"], "file:../db", "벤더 패키지끼리도 상대 경로")
    assert.ok(!existsSync(join(compose().to, "vendor/launch-factory/auth/test")))
    assert.ok(!JSON.stringify(pkg).includes(tmp) && !/file:[A-Za-z]:|file:\//.test(JSON.stringify(pkg)), "절대 경로 없음")
  })

  test(".env.local 은 LF_MODE=mock 한 줄뿐이다", () => {
    assert.equal(out(".env.local"), "LF_MODE=mock\n")
  })

  test("e2e·scripts/ci 는 남고 시안의 보안 헤더·후처리는 오지 않는다", () => {
    const to = compose().to
    assert.ok(existsSync(join(to, "e2e/loop.mock.spec.ts")) && existsSync(join(to, "scripts/ci/smoke.mjs")))
    for (const f of ["security-headers.mjs", ".pkg-hash", "scripts/csp-hashes.mjs"]) assert.ok(!existsSync(join(to, f)), f)
    assert.equal(out("next.config.ts"), readFileSync(join(LF, "template", "next.config.ts"), "utf8"))
  })

  test("템플릿 복사는 node_modules·.next·.tmp 를 빼고 e2e·scripts/ci 는 남긴다", () => {
    const templateDir = fresh("tpl")
    for (const f of ["package.json", "node_modules/x/index.js", "a/node_modules/y.js", ".next/a.js", ".tmp/b.txt", "e2e/a.ts", "scripts/ci/b.mjs", ".github/workflows/ci.yml"]) {
      mkdirSync(dirname(join(templateDir, f)), { recursive: true })
      writeFileSync(join(templateDir, f), "x")
    }
    const to = fresh("out")
    templateBlock.run({ templateDir, to, rules })
    assert.deepEqual(walk(to), [".github/workflows/ci.yml", "e2e/a.ts", "package.json", "scripts/ci/b.mjs"])
  })

  test("CLI: --site --features --to 로 같은 결과를 만들고 인자가 빠지면 종료 2다", () => {
    const featuresFile = join(fresh("f"), "features.json")
    mkdirSync(dirname(featuresFile), { recursive: true })
    writeFileSync(featuresFile, JSON.stringify(features))
    const to = fresh("cli")
    const ok = spawnSync(process.execPath, [join(COMPOSE, "compose-product.mjs"), "--site", makeSite(), "--features", featuresFile, "--to", to], { encoding: "utf8" })
    assert.equal(ok.status, 0, ok.stderr)
    assert.match(ok.stdout, /npm install → npm run dev/)
    assert.equal(readFileSync(join(to, ".env.local"), "utf8"), "LF_MODE=mock\n")
    const bad = spawnSync(process.execPath, [join(COMPOSE, "compose-product.mjs"), "--site", "x"], { encoding: "utf8" })
    assert.equal(bad.status, 2)
    assert.match(bad.stderr, /--features --to/)
  })
})

describe("던지는 경우", () => {
  test("requires 로 닫히지 않은 features 는 던진다 (payments 는 signup 이 있어야 한다)", () => {
    assert.throws(() => checkFeatures({ version: 1, table: "", outcomes: ["payments"] }, table), /payments 는 signup 가 있어야 한다/)
    assert.doesNotThrow(() => checkFeatures({ version: 1, table: "", outcomes: ["signup", "payments"] }, table))
    const to = fresh("never")
    assert.throws(() => composeProduct({ siteDir: makeSite(), features: { version: 1, table: "", outcomes: ["payments"] }, table, to }), /닫혀 있지 않다/)
    assert.ok(!existsSync(to), "던지기 전에 아무것도 쓰지 않는다")
  })

  test("표에 없는 기능 id 는 던진다", () => {
    assert.throws(() => checkFeatures({ version: 1, table: "", outcomes: ["signup", "teleport"] }, table), /표에 없는 기능 id: teleport/)
  })

  test("규칙에 없는 시안 파일은 목록으로 던지고 출력 폴더를 만들지 않는다", () => {
    const to = fresh("never")
    const siteDir = makeSite({ "app/mystery/odd.txt": "x", "weird.cfg": "y" })
    assert.throws(() => composeProduct({ siteDir, features, table, to }), (e) => /규칙\(rules\.json\)에 없는 시안 파일 2개/.test(e.message) && e.message.includes("app/mystery/odd.txt") && e.message.includes("weird.cfg"))
    assert.ok(!existsSync(to))
  })

  test("compose: 시안의 .env.example 은 시안 걷기에서 빠진다", () => {
    const siteDir = makeSite({ ".env.example": "SOME_KEY=\n" })
    const state = { siteDir, templateDir: join(LF, "template"), rules, urlMap }
    assert.doesNotThrow(() => plan.run(state))
    assert.ok(!state.plan.some((p) => p.file === ".env.example"))
  })

  test("rules: 명시한 쪽 항목은 일반 규칙과 겹치지 않는다", () => {
    const all = JSON.stringify(rules.rules.filter((r) => r.kind === "copy").map((r) => r.match))
    for (const p of ["app/campaign/page.tsx", "app/onboarding/page.tsx", "app/withdrawal/page.tsx"]) assert.ok(!all.includes(p), p)
  })

  test("compose: 한 바퀴 단계가 없는 집합은 출력 폴더를 만들기 전에 멈춘다", () => {
    const to = fresh("noloop")
    assert.throws(() => composeProduct({ siteDir: makeSite(), features: { version: 1, table: table.hash, outcomes: ["analytics"] }, table, to }), /한 바퀴 단계/)
    assert.equal(existsSync(to), false)
  })

  test("url-map 에 없는 URL 충돌은 던진다 (copy 규칙인데 템플릿에 같은 URL, urlMap 규칙인데 줄이 없음)", () => {
    const siteDir = makeSite({ "app/contact/page.tsx": "x", "app/extra/page.tsx": "y" })
    const state = {
      siteDir,
      templateDir: join(LF, "template"),
      rules: { ...rules, rules: [{ kind: "copy", match: ["app/contact/page.tsx"] }, { kind: "urlMap", match: ["app/extra/page.tsx"] }, { kind: "keep", match: ["**"] }] },
      urlMap,
    }
    assert.throws(() => plan.run(state), (e) => /URL 충돌 2개/.test(e.message) && e.message.includes("app/contact/page.tsx (/contact)") && e.message.includes("app/extra/page.tsx (/extra)"))
  })

  test("copy 규칙인데 템플릿에 다른 내용의 같은 경로가 있으면 던진다", () => {
    assert.throws(() => composeProduct({ siteDir: makeSite({ "lib/utils.ts": "export const different = 1\n" }), features, table, to: fresh("clash") }), /다른 내용의 같은 경로가 있다 1개[\s\S]*lib\/utils\.ts/)
  })

  test("출력 폴더가 비어 있지 않으면 던진다", () => {
    const to = fresh("busy")
    mkdirSync(to)
    writeFileSync(join(to, "keep.txt"), "x")
    assert.throws(() => composeProduct({ siteDir: makeSite(), features, table, to }), /비어 있지 않다/)
  })

  test("mergeLayout: 시안 layout 에서 lang 이 없으면 던진다", () => {
    const tpl = readFileSync(join(LF, "template", "app", "layout.tsx"), "utf8")
    assert.throws(() => mergeLayout(tpl, LAYOUT.replace(/lang=\{[^{}]*\}/, ""), { imports: ["@/lib/utils"] }), /lang/)
  })
})

describe("cssTheme", () => {
  test("parseCss: 문자열·주석 안의 괄호와 세미콜론을 세지 않는다", () => {
    const parts = parseCss('@import url("https://x/a;b.css");\n/* } */\n.a { content: "}"; }\n')
    assert.deepEqual(parts.map((p) => [p.kind, p.prelude]), [["statement", '@import url("https://x/a;b.css");'], ["block", ".a"]])
  })
  test("mergeTheme: 이름 지은 블록만 시안 것이고 템플릿에만 있는 블록은 남으며, 시안에만 있는 블록은 더한다", () => {
    const tpl = '@import "core";\n@import "tpl-font";\n\n:root { --a: 1; }\n\n.keep { x: 1; }\n'
    const site = '@import "core";\n@import "site-font";\n\n:root { --a: 2; }\n\n@layer utilities { .u { y: 1; } }\n'
    const css = mergeTheme(tpl, site, { replace: [":root"], append: ["@layer utilities"], coreImports: ["core"] })
    assert.equal(css, '@import "core";\n@import "site-font";\n\n:root { --a: 2; }\n\n.keep { x: 1; }\n\n@layer utilities { .u { y: 1; } }\n')
  })
})

describe("수정 1차", () => {
  test("출력 .gitignore: 템플릿 줄(.env*)에 시안 줄이 더해져 .env.local 이 무시된다", () => {
    const text = out(".gitignore")
    assert.ok(text.includes("/site-only-ignore"), "시안에만 있는 줄")
    const to = compose().to
    assert.equal(spawnSync("git", ["init", "-q"], { cwd: to }).status, 0)
    for (const [name, ignored] of [[".env.local", true], [".env.production.local", true], [".env", true], [".env.example", false], ["node_modules/x", true], [".vercel/project.json", true]]) {
      assert.equal(spawnSync("git", ["check-ignore", "-q", name], { cwd: to }).status === 0, ignored, name)
    }
  })

  test("mergeLines: 템플릿 줄이 먼저고 시안에만 있는 줄이 뒤에 붙으며 겹치는 줄은 한 번이다", () => {
    assert.equal(mergeLines("a\nb\n", "b\nc\n\nd\n"), "a\nb\n\nc\nd\n")
    assert.equal(mergeLines("a\n", "a\n"), "a\n")
  })

  test("템플릿 복사: git 이 추적하는 파일만 가져온다 — 추적 안 한 .env.production.local 은 출력에 닿지 않는다", () => {
    const templateDir = fresh("tracked")
    mkdirSync(join(templateDir, "app"), { recursive: true })
    writeFileSync(join(templateDir, "app", "a.ts"), "x")
    writeFileSync(join(templateDir, "b.ts"), "x")
    spawnSync("git", ["init", "-q"], { cwd: templateDir })
    spawnSync("git", ["add", "."], { cwd: templateDir })
    writeFileSync(join(templateDir, ".env.production.local"), "SECRET=1")
    writeFileSync(join(templateDir, "untracked.ts"), "x")
    const to = fresh("out")
    templateBlock.run({ templateDir, to, rules })
    assert.deepEqual(walk(to), ["app/a.ts", "b.ts"])
  })

  test("템플릿 복사: git 이 없는 폴더는 걸어서 가져오되 .env*(.env.example 은 남김)·.vercel 은 뺀다", () => {
    const templateDir = fresh("plain")
    for (const f of [".env", ".env.local", ".env.production.local", ".env.example", ".vercel/project.json", "ok.ts"]) {
      mkdirSync(dirname(join(templateDir, f)), { recursive: true })
      writeFileSync(join(templateDir, f), "x")
    }
    const to = fresh("out")
    templateBlock.run({ templateDir, to, rules })
    assert.deepEqual(walk(to), [".env.example", "ok.ts"])
    const skip = withSecrets(rules, rules.templateExclude)
    assert.ok(isSkipped(".env.staging", skip) && !isSkipped(".env.example", skip))
  })

  test("cssTheme: 시안의 @layer base 블록은 모두 템플릿 것 뒤에 더해지고 템플릿 것은 남는다", () => {
    const css = out("app/globals.css")
    const base = parseCss(css).filter((s) => s.prelude === "@layer base")
    assert.ok(base.length >= 3, `@layer base ${base.length}개 (템플릿 1 + 시안 2)`)
    assert.ok(base[0].text.includes("svg.lucide") && base.at(-1).text.includes("--site-face-marker"))
    assert.ok(css.includes("svg.tabler-icon"))
  })

  test("mergeTheme: replace 는 시안의 같은 이름 블록 전부로 바꾸고 append 는 같은 이름 블록 전부를 마지막 템플릿 블록 뒤에 더한다", () => {
    const tpl = ":root { --a: 1; }\n\n@layer base { .t1 { x: 1; } }\n\n@layer base { .t2 { x: 1; } }\n\n.tail { y: 1; }\n"
    const site = ":root { --a: 2; }\n\n:root { --b: 3; }\n\n@layer base { .s1 { x: 2; } }\n\n@layer base { .s2 { x: 2; } }\n"
    const css = mergeTheme(tpl, site, { replace: [":root"], append: ["@layer base"], coreImports: [] })
    assert.equal(css, ":root { --a: 2; }\n\n:root { --b: 3; }\n\n@layer base { .t1 { x: 1; } }\n\n@layer base { .t2 { x: 1; } }\n\n@layer base { .s1 { x: 2; } }\n\n@layer base { .s2 { x: 2; } }\n\n.tail { y: 1; }\n")
  })

  test("vendor: package.json 에 없는 @launch-factory import 는 던지고(주석 안은 세지 않고 .js·.jsx 도 본다), 적힌 것은 벤더한다", () => {
    const make = (files, deps) => {
      const to = fresh("vend")
      mkdirSync(to, { recursive: true })
      writeFileSync(join(to, "package.json"), JSON.stringify({ dependencies: deps, devDependencies: {} }))
      for (const [rel, text] of Object.entries(files)) {
        mkdirSync(dirname(join(to, rel)), { recursive: true })
        writeFileSync(join(to, rel), text)
      }
      return { to, lfDir: LF, rules, vendored: [] }
    }
    const comment = make({ "a.ts": '// import x from "@launch-factory/db"\n/* "@launch-factory/inquiry" */\nexport {}\n' }, {})
    assert.doesNotThrow(() => vendorBlock.run(comment))
    for (const rel of ["a.js", "b.jsx", "c.mjs"]) {
      const bad = make({ [rel]: 'import { x } from "@launch-factory/inquiry/sub"\n' }, {})
      assert.throws(() => vendorBlock.run(bad), (e) => e.message.includes("@launch-factory/inquiry") && e.message.includes(rel), rel)
    }
    const ok = make({ "a.ts": 'import { x } from "@launch-factory/env"\n' }, { "@launch-factory/env": "0.0.0" })
    vendorBlock.run(ok)
    assert.deepEqual(ok.vendored, ["@launch-factory/env"])
    assert.equal(readJson(join(ok.to, "package.json")).dependencies["@launch-factory/env"], "file:./vendor/launch-factory/env")
  })

  test("vendor: 추적 안 한 패키지 파일은 벤더하지 않는다", () => {
    const lfDir = fresh("lf")
    const pkg = join(lfDir, "packages", "env")
    mkdirSync(join(pkg, "src"), { recursive: true })
    writeFileSync(join(pkg, "package.json"), JSON.stringify({ name: "@launch-factory/env" }))
    writeFileSync(join(pkg, "src", "index.ts"), "x")
    spawnSync("git", ["init", "-q"], { cwd: pkg })
    spawnSync("git", ["add", "."], { cwd: pkg })
    writeFileSync(join(pkg, ".env.local"), "SECRET=1")
    writeFileSync(join(pkg, "src", "scratch.ts"), "x")
    const to = fresh("out")
    mkdirSync(to)
    writeFileSync(join(to, "package.json"), JSON.stringify({ dependencies: { "@launch-factory/env": "0.0.0" } }))
    vendorBlock.run({ to, lfDir, rules, vendored: [] })
    assert.deepEqual(walk(join(to, "vendor/launch-factory/env")), ["package.json", "src/index.ts"])
  })

  test("vendor: 추적하는 파일이어도 .env*(.env.example 만 빼고)·.vercel 은 벤더하지 않고, git 이 아닌 패키지도 같다", () => {
    for (const tracked of [true, false]) {
      const lfDir = fresh("lf")
      const pkg = join(lfDir, "packages", "env")
      mkdirSync(join(pkg, ".vercel"), { recursive: true })
      mkdirSync(join(pkg, "src"), { recursive: true })
      writeFileSync(join(pkg, "package.json"), JSON.stringify({ name: "@launch-factory/env" }))
      writeFileSync(join(pkg, "src", "index.ts"), "x")
      for (const f of [".env", ".env.local", ".env.example", ".vercel/project.json"]) writeFileSync(join(pkg, f), "x")
      if (tracked) {
        spawnSync("git", ["init", "-q"], { cwd: pkg })
        assert.equal(spawnSync("git", ["add", "-f", "."], { cwd: pkg }).status, 0)
      }
      const to = fresh("out")
      mkdirSync(to)
      writeFileSync(join(to, "package.json"), JSON.stringify({ dependencies: { "@launch-factory/env": "0.0.0" } }))
      vendorBlock.run({ to, lfDir, rules, vendored: [] })
      assert.deepEqual(walk(join(to, "vendor/launch-factory/env")), [".env.example", "package.json", "src/index.ts"], tracked ? "git 추적" : "걷기")
    }
  })

  test("mergeLines: 시안의 ! 줄이 .env*·.vercel 을 다시 넣지 못하고(.env.example 은 허용) 출력은 .env.local 을 계속 무시한다", () => {
    const tpl = readFileSync(join(LF, "template", ".gitignore"), "utf8")
    const siteText = "!.env.local\n!/.env.production\n!**/.env\n!.vercel/\n!config/.vercel\n!.env.example\n!keep-me.txt\nsite-only\n"
    const merged = mergeLines(tpl, siteText)
    for (const dropped of ["!.env.local", "!/.env.production", "!**/.env", "!.vercel/", "!config/.vercel"]) assert.ok(!merged.split("\n").includes(dropped), dropped)
    for (const kept of ["!keep-me.txt", "site-only"]) assert.ok(merged.split("\n").includes(kept), kept)
    const to = fresh("ign")
    mkdirSync(to)
    writeFileSync(join(to, ".gitignore"), merged)
    assert.equal(spawnSync("git", ["init", "-q"], { cwd: to }).status, 0)
    for (const [name, ignored] of [[".env.local", true], [".env.production", true], [".env", true], [".env.example", false], [".vercel/project.json", true]]) {
      assert.equal(spawnSync("git", ["check-ignore", "-q", name], { cwd: to }).status === 0, ignored, name)
    }
  })

  test("template/package.json 은 소스가 import 하는 @launch-factory/inquiry 를 적고 next.config 가 transpile 한다, playwright-core 는 @playwright/test 와 같다", () => {
    const pkg = readJson(join(LF, "template", "package.json"))
    assert.equal(pkg.dependencies["@launch-factory/inquiry"], "0.0.0")
    assert.equal(pkg.devDependencies["playwright-core"], pkg.devDependencies["@playwright/test"])
    assert.match(readFileSync(join(LF, "template", "next.config.ts"), "utf8"), /"@launch-factory\/inquiry"/)
  })

  test("plan: url-map 줄의 template URL 이 템플릿에 없으면 던진다", () => {
    const state = { siteDir: makeSite(), templateDir: join(LF, "template"), rules, urlMap: { rows: [{ site: "/x", template: "/does-not-exist", winner: "template" }] } }
    assert.throws(() => plan.run(state), /template URL 이 템플릿에 없다 1개[\s\S]*\/x → \/does-not-exist/)
  })

  test("rewriteLinks: 끝 슬래시가 붙은 링크도 바꾼다", () => {
    assert.equal(rewriteLinks('"/login/" "/login/?a=1" "/login/callback"', [{ site: "/login", template: "/sign-in" }]), '"/sign-in/" "/sign-in/?a=1" "/login/callback"')
  })

  test("isTextFile: md·mdx·js 도 링크를 고치는 글자 파일이다", () => {
    for (const f of ["a.md", "a.mdx", "a.js", "a.jsx", "a.tsx"]) assert.ok(isTextFile(f), f)
    assert.ok(!isTextFile("a.png"))
  })

  test("layoutMerge: 읽을 수 없는 여러 줄 const 는 파일 경로를 적어 던지고, 같은 모듈 import 는 이름을 합친다", () => {
    const tpl = 'import { a } from "@/lib/utils"\n\nexport default function L() { return <html lang="en"></html> }\n'
    const site = (consts) => `import { a, cn } from "@/lib/utils"\n${consts}\nexport default function L() { return <html lang={x} className={cn("y")}></html> }\n`
    assert.throws(() => mergeLayout(tpl, site("const f = Font({\n  subsets: [],\n})\n"), { imports: ["@/lib/utils"] }, "app/layout.tsx"), /app\/layout\.tsx.*const f = Font/)
    const merged = mergeLayout(tpl, site('const f = { variable: "" };'), { imports: ["@/lib/utils"] }, "app/layout.tsx")
    assert.equal(merged.match(/from "@\/lib\/utils"/g).length, 1)
    assert.match(merged, /import \{ a, cn \} from "@\/lib\/utils"/)
    assert.match(merged, /const f = \{ variable: "" \};/)
  })

  test("packageName: 주소의 첫 마디, 없으면 영문 이름, 한글만이면 fallback", () => {
    assert.equal(packageNameBlock.slugOf("https://www.Gyeonjeok.example.com/x"), "gyeonjeok")
    assert.equal(packageNameBlock.slugOf("Fresh Bread Co."), "fresh-bread-co")
    assert.equal(packageNameBlock.slugOf("견적노트"), "")
    const to = fresh("pn")
    mkdirSync(join(to, "c"), { recursive: true })
    writeFileSync(join(to, "package.json"), JSON.stringify({ name: "@launch-factory/template", version: "0.0.0" }))
    const siteDir = fresh("pnsite")
    mkdirSync(join(siteDir, "content"), { recursive: true })
    writeFileSync(join(siteDir, "content/site.json"), JSON.stringify({ site: { url: { $ref: "business.url" } }, business: { name: "견적노트", url: "https://quote.example.com" } }))
    packageNameBlock.run({ to, siteDir, rules })
    assert.equal(readJson(join(to, "package.json")).name, "quote", "$ref 를 푼다")
    writeFileSync(join(siteDir, "content/site.json"), JSON.stringify({ business: { name: "견적노트" } }))
    packageNameBlock.run({ to, siteDir, rules })
    assert.equal(readJson(join(to, "package.json")).name, "product")
  })

  test("rootMeta: 출력의 PRODUCT_NAME 은 시안 이름, OG locale 은 시안 언어다", () => {
    const site = JSON.stringify({ locale: "ko", business: { name: "확인 필요" }, product: { name: "견적노트" }, site: { name: "무시" } })
    const to = fresh("rm")
    const r = composeProduct({ siteDir: makeSite({ "content/site.json": site }), features, table, to })
    assert.deepEqual(r.rootMetaSkipped, [])
    assert.match(readFileSync(join(to, "content/copy.en.ts"), "utf8"), /^export const PRODUCT_NAME = "견적노트"$/m)
    const layout = readFileSync(join(to, "app/layout.tsx"), "utf8")
    assert.match(layout, /locale: "ko_KR"/)
    assert.doesNotMatch(layout, /en_US/)
  })

  test("rootMeta: 이름 경로 순서·자리 표시 건너뜀·name 대체 이름·찾는 글자가 없으면 던지지 않고 목록에", () => {
    const spec = rules.steps.rootMeta
    assert.deepEqual(spec.nameFrom, ["business.name", "product.name", "organization.name", "agency.name", "site.name"])
    assert.equal(rootMetaBlock.siteNameOf({ business: { name: "To be confirmed" }, agency: { name: " 에이전시 " } }, spec), "에이전시")
    assert.equal(rootMetaBlock.siteNameOf({ business: { name: { $ref: "site.name" } }, site: { name: "참조" } }, spec), "참조")
    assert.equal(rootMetaBlock.siteNameOf({ site: { name: "확인 필요" } }, spec), undefined)
    const run = (site, name) => {
      const to = fresh("rm2")
      mkdirSync(join(to, "content"), { recursive: true })
      mkdirSync(join(to, "app"), { recursive: true })
      writeFileSync(join(to, "content/copy.en.ts"), 'export const PRODUCT_NAME = "Example App"\n')
      writeFileSync(join(to, "app/layout.tsx"), 'x = { locale: "en_US" }\n')
      const siteDir = fresh("rmsite")
      mkdirSync(join(siteDir, "content"), { recursive: true })
      writeFileSync(join(siteDir, "content/site.json"), JSON.stringify(site))
      const state = rootMetaBlock.run({ to, siteDir, rules, name })
      return { state, copy: readFileSync(join(to, "content/copy.en.ts"), "utf8"), layout: readFileSync(join(to, "app/layout.tsx"), "utf8"), to }
    }
    const fb = run({ locale: "en", site: { name: "확인 필요" } }, "my-folder")
    assert.match(fb.copy, /PRODUCT_NAME = "my-folder"/)
    assert.match(fb.layout, /en_US/)
    const none = run({ locale: "ko" })
    assert.deepEqual(none.state.rootMetaSkipped, ["content/copy.en.ts"])
    assert.match(none.copy, /Example App/)
    assert.match(none.layout, /ko_KR/)
    const odd = run({ locale: "fr", business: { name: "A" } })
    assert.deepEqual(odd.state.rootMetaSkipped, ["app/layout.tsx"])
  })

  test("rootMeta: 템플릿에 find 글자가 그대로 있다 — 템플릿이 바뀌면 여기서 실패한다(M5)", () => {
    for (const e of rules.steps.rootMeta.edits) assert.ok(readFileSync(join(LF, "template", e.file), "utf8").includes(e.find), `${e.file}: ${e.find}`)
    assert.ok(readFileSync(join(LF, "template/content/copy.en.ts"), "utf8").includes('PRODUCT_NAME = "Example App"'))
  })

  test("scripts: rules.json 목록의 스크립트만 뺀다 (지금 목록은 비어 있다)", () => {
    assert.deepEqual(rules.steps.scripts.remove, [])
    const to = fresh("sc")
    mkdirSync(to)
    writeFileSync(join(to, "package.json"), JSON.stringify({ scripts: { dev: "a", "repo-only": "b" } }))
    scriptsBlock.run({ to, rules: { steps: { scripts: { remove: ["repo-only"] } } } })
    assert.deepEqual(readJson(join(to, "package.json")).scripts, { dev: "a" })
  })

  test("composeProduct 는 runCmd 를 셸 && 없이 명령 배열로 돌려준다", () => {
    const { to, result } = compose()
    assert.deepEqual(result.runCmd, [
      { cwd: to, command: "npm", args: ["install"] },
      { cwd: to, command: "npm", args: ["run", "dev"] },
    ])
  })

  test("CLI: 드라이브 글자 대소문자가 달라도(Windows) 같은 파일로 알아본다", () => {
    const script = join(COMPOSE, "compose-product.mjs")
    const odd = process.platform === "win32" ? script.replace(/^[A-Za-z]/, (c) => (c === c.toLowerCase() ? c.toUpperCase() : c.toLowerCase())) : script
    const r = spawnSync(process.execPath, [odd], { encoding: "utf8" })
    assert.equal(r.status, 2, "인자 오류(종료 2)면 main 으로 알아본 것이다")
    assert.match(r.stderr, /빠진 인자/)
  })
})

describe("drop — 고르지 않은 기능의 쪽·API·cron·링크", () => {
  const DROP_SITE = {
    locale: "ko",
    site: { url: "https://x.example.com" },
    shell: { nav: [{ href: "/" }, { href: "/pricing" }, { href: "/privacy" }] },
    secondaryTop: { label: "top", href: "/pricing" },
    pages: { "/": { id: "home" }, "/pricing": { id: "pricing" }, "/refund": { id: "refund" }, "/privacy": { id: "privacy" }, "/account/billing": { id: "billing" }, "/sign-up": { id: "signup", noindex: true } },
    sections: {
      hero: { props: { copy: { primary: { label: "a", href: "/pricing" }, secondaryCta: { label: "b", href: "/pricing#plans" } } } },
      footer: { props: { copy: { columns: [{ links: [{ label: "p", href: "/pricing" }, { label: "t", href: "/terms" }, { label: "r", href: "/refund" }] }] } } },
      contactBand: { props: { copy: { primary: { label: "c", href: "/contact" }, billing: { label: "b", href: "/account/billing" } } } },
    },
  }
  const SIGNUP = ["signup"]
  const FULL = ["signup", "payments", "marketing", "analytics"]
  const composeWith = (ids, extra = {}) => {
    const to = fresh("drop")
    const result = composeProduct({ siteDir: makeSite({ "content/site.json": JSON.stringify(DROP_SITE, null, 2), ...extra }), features: { version: 1, table: table.hash, outcomes: ids }, table, to })
    return { to, result, enabled: readJson(join(to, "lib/launch/enabled.json")), vercel: readJson(join(to, "vercel.json")), site: readJson(join(to, "content/site.json")) }
  }
  const signup = composeWith(SIGNUP)
  const full = composeWith(FULL)
  const inquiry = composeWith(["signup", "inquiry"])
  const booked = composeWith(["signup", "booking"])
  const exists = (c, rel) => existsSync(join(c.to, rel))
  const appUrls = (c) => walk(join(c.to, "app")).map((rel) => urlOf(`app/${rel}`)).filter(Boolean).sort()
  /** 출력 폴더에서 템플릿 문구 모듈을 실제로 읽어 화면이 쓰는 값을 JSON 으로 받는다 */
  const screens = (c) => {
    const code = [
      'import { navCopy, footerCopy, notFoundCopy, errorScreenCopy } from "./content/copy.shell.en.ts"',
      'import { welcomeCopy, signUpCopy, signInCopy } from "./content/copy.en.ts"',
      'import { sitemapPaths } from "./lib/seo.ts"',
      'import { hasUrl } from "./lib/launch/enabled.ts"',
      "console.log(JSON.stringify({ nav: navCopy.links.map((l) => l.href), account: navCopy.signedIn.links.map((l) => l.href), footer: Object.keys(footerCopy.links), notFound: notFoundCopy.links.map((l) => l.href), notFoundSupport: Boolean(notFoundCopy.support), errorSupport: Boolean(errorScreenCopy.error.support), welcome: welcomeCopy.signup, signUpDone: signUpCopy.done, signInDone: signInCopy.done.href, verifiedSignedOut: welcomeCopy.verifiedSignedOut.href, sitemap: sitemapPaths(), contact: hasUrl('/contact') }))",
    ].join(";")
    const r = spawnSync(process.execPath, ["--input-type=module", "-e", code], { cwd: c ? c.to : join(LF, "template"), encoding: "utf8" })
    assert.equal(r.status, 0, r.stderr)
    return JSON.parse(r.stdout)
  }

  test("{signup}: pricing·upgrade·billing·account/billing·account/cancel·refund·contact 는 지워지고 email·account·sign-in 은 남는다", () => {
    for (const gone of ["pricing", "upgrade", "billing/return", "account/billing", "account/billing/cancel", "account/billing/price-change", "account/cancel", "contact"]) assert.ok(!exists(signup, `app/(product)/${gone}/page.tsx`), gone)
    assert.ok(!exists(signup, "app/(legal)/refund/page.tsx"))
    for (const kept of ["email", "account", "sign-in", "sign-up", "forgot-password", "reset-password", "verify-email"]) assert.ok(exists(signup, `app/(product)/${kept}/page.tsx`), kept)
    assert.ok(exists(signup, "app/(legal)/terms/page.tsx") && exists(signup, "app/(legal)/privacy/page.tsx"))
    assert.ok(!exists(signup, "app/(product)/account/billing"), "비게 된 폴더도 남기지 않는다")
    for (const route of ["api/webhooks/paddle", "api/cron/billing", "api/marketing/keep", "api/marketing/unsubscribe", "api/inquiry"]) assert.ok(!exists(signup, `app/${route}/route.ts`), route)
    for (const route of ["api/auth/[...all]", "api/account/not-me", "api/cron/purge", "api/cron/security", "api/cron/notices"]) assert.ok(exists(signup, `app/${route}/route.ts`), route)
    assert.ok(signup.result.pruned.includes("/pricing") && signup.result.pruned.includes("/api/cron/billing") && !signup.result.pruned.includes("/email"))
  })

  test("{signup, booking}: 예약 쪽·API·cron 만 더해지고 푸시·결제·문의는 없다 — 고르지 않은 구성에는 예약 흔적이 없다", () => {
    for (const kept of ["book", "book/manage"]) assert.ok(exists(booked, `app/(product)/${kept}/page.tsx`), kept)
    for (const route of ["api/booking", "api/booking/slots", "api/cron/booking"]) assert.ok(exists(booked, `app/${route}/route.ts`), route)
    assert.ok(booked.vercel.crons.some((c) => c.path === "/api/cron/booking"), "예약 알림·파기 cron 줄")
    assert.ok(!exists(booked, "app/(product)/account/notifications/page.tsx"), "푸시는 고르지 않았다")
    for (const gone of ["pricing", "upgrade", "contact"]) assert.ok(!exists(booked, `app/(product)/${gone}/page.tsx`), gone)
    for (const c of [signup, full, inquiry]) {
      for (const rel of ["app/(product)/book", "app/api/booking", "app/api/cron/booking", "app/(product)/account/notifications"]) assert.ok(!exists(c, rel), `예약을 고르지 않은 구성에 ${rel}`)
      assert.ok(!c.vercel.crons.some((x) => x.path === "/api/cron/booking"))
      assert.ok(!c.enabled.urls.includes("/book") && !c.enabled.urls.includes("/book/manage"))
    }
    assert.ok(booked.enabled.urls.includes("/book") && booked.enabled.urls.includes("/book/manage"))
  })

  test("표 하나로 정한다: 모든 쪽·API 파일은 소유자가 켜졌을 때만 있다 (두 구성 모두)", () => {
    for (const [c, ids] of [[signup, SIGNUP], [full, FULL]]) {
      const on = turnedOn(table, { outcomes: ids })
      for (const item of [...table.pages, ...table.routes]) assert.equal(exists(c, item.file), item.owners.some((o) => on.has(o)), `${ids.join()}: ${item.file}`)
    }
  })

  test("email 의 주인(auth·consent)이 둘 다 꺼지면 dropped, 하나라도 켜지면(closure 포함) 남는다", () => {
    const urlsOf = (ids) => droppedOf(table.pages, turnedOn(table, { outcomes: ids })).map((p) => p.url)
    assert.ok(urlsOf(["analytics"]).includes("/email"))
    assert.ok(!urlsOf(["inquiry"]).includes("/email"), "inquiry 의 closure 에 consent 가 있다")
    assert.ok(!urlsOf(["signup"]).includes("/email"))
    assert.deepEqual(urlsOf(SIGNUP).sort(), ["/account/billing", "/account/billing/cancel", "/account/billing/price-change", "/account/cancel", "/account/notifications", "/billing/return", "/book", "/book/manage", "/book/return", "/cart", "/checkout", "/checkout/return", "/contact", "/orders", "/orders/[id]", "/pricing", "/products", "/refund", "/upgrade"])
  })

  test("vercel.json: 지운 cron 경로의 줄만 빠지고 남은 줄은 그대로다", () => {
    assert.deepEqual(signup.vercel.crons.map((c) => c.path), ["/api/cron/purge", "/api/cron/security", "/api/cron/notices"])
    assert.deepEqual(full.vercel.crons.map((c) => c.path), ["/api/cron/billing", "/api/cron/purge", "/api/cron/consents", "/api/cron/security", "/api/cron/notices"])
    const vercel = { crons: [{ path: "/a" }, { path: "/b" }] }
    assert.equal(dropCrons(vercel, new Set(["/a"])), true, "남은 API 가 아닌 경로의 줄을 뺀다")
    assert.deepEqual(vercel.crons, [{ path: "/a" }])
    assert.equal(dropCrons(vercel, new Set(["/a", "/x"])), false)
    const stray = { crons: [{ path: "/api/cron/unknown" }] }
    assert.equal(dropCrons(stray, new Set(["/api/cron/purge"])), true, "표에 없는 cron 경로도 라우트가 없으면 빠진다")
  })

  test("enabled.json: parts 는 고른 기능의 parts ∪ closure, urls 는 출력에 실제로 남은 쪽·API 주소와 같다", () => {
    assert.deepEqual(signup.enabled.parts, ["account-lifecycle", "auth", "db", "i18n", "security"])
    assert.ok(full.enabled.parts.includes("analytics-posthog") && full.enabled.parts.includes("consent") && full.enabled.parts.includes("billing-paddle"))
    for (const c of [signup, full]) assert.deepEqual(c.enabled.urls, appUrls(c))
    assert.ok(!signup.enabled.urls.includes("/pricing") && full.enabled.urls.includes("/pricing") && full.enabled.urls.includes("/refund"))
    assert.ok(signup.enabled.urls.includes("/email") && signup.enabled.urls.includes("/campaign") && signup.enabled.urls.includes("/"))
  })

  test("site.json 링크: 배열 안 링크와 선택 버튼은 빼고 하나뿐인 필수 버튼은 /로 바꾸며, 사이트맵이 읽는 pages 에서 지운 쪽이 빠진다", () => {
    const s = signup.site
    assert.deepEqual(s.shell.nav.map((l) => l.href), ["/", "/privacy"])
    assert.equal("secondaryCta" in s.sections.hero.props.copy, false)
    assert.equal("secondaryTop" in s, false, "최상위 secondary* 도 진짜 객체에서 빠진다")
    assert.equal(s.sections.hero.props.copy.primary.href, "/sign-up", "fallbacks 에서 남은 첫 쪽")
    assert.deepEqual(s.sections.footer.props.copy.columns[0].links.map((l) => l.href), ["/terms"])
    assert.equal(s.sections.contactBand.props.copy.billing.href, "/account", "billing → account")
    assert.equal(s.sections.contactBand.props.copy.primary.href, "/", "fallbacks 에 없으면 rewriteTo")
    assert.deepEqual(Object.keys(s.pages).sort(), ["/", "/privacy", "/sign-up", "/terms"], "지운 쪽은 빠지고 남은 공개 쪽(/terms)은 더해진다")
    assert.equal(s.pages["/sign-up"].noindex, true)
    assert.equal(s.pages["/terms"].title, "Terms of Service")
    assert.deepEqual(full.site, readJson(join(full.to, "content/site.json")))
    assert.deepEqual(Object.keys(full.site.pages).sort(), ["/", "/account/billing", "/pricing", "/privacy", "/refund", "/sign-up", "/terms"], "결제를 고르면 그대로(+ 공개 쪽)")
    assert.equal(full.site.sections.hero.props.copy.secondaryCta.href, "/pricing#plans")
    assert.equal(full.site.shell.nav.length, 3)
    assert.equal(full.site.secondaryTop.href, "/pricing")
  })

  test("사이트맵 쪽 목록: 문의를 고르면 /contact 가 더해지고 고르지 않으면 없다", () => {
    assert.equal(inquiry.site.pages["/contact"].title, "Contact us")
    assert.equal(inquiry.site.pages["/contact"].type, "other")
    assert.equal("/contact" in signup.site.pages, false)
    assert.equal("/contact" in full.site.pages, false)
    assert.equal(inquiry.site.sections.contactBand.props.copy.primary.href, "/contact", "남아 있는 쪽으로 가는 링크는 그대로")
    assert.deepEqual(inquiry.site.pages["/pricing"], undefined)
  })

  test("고친 링크는 결과에 모이고, 대신할 쪽이 없어 /로 보낸 곳은 경고한다", () => {
    const where = (c) => c.result.rewritten.map((r) => `${r.action} ${r.path}`).sort()
    assert.deepEqual(where(signup), [
      "remove secondaryTop",
      "remove sections.footer.props.copy.columns[0].links[0]",
      "remove sections.footer.props.copy.columns[0].links[2]",
      "remove sections.hero.props.copy.secondaryCta",
      "remove shell.nav[1]",
      "rewrite sections.contactBand.props.copy.billing",
      "rewrite sections.contactBand.props.copy.primary",
      "rewrite sections.hero.props.copy.primary",
    ])
    assert.deepEqual(signup.result.rewritten.find((r) => r.path === "sections.hero.props.copy.primary").to, "/sign-up")
    assert.equal(signup.result.warnings.length, 1)
    assert.match(signup.result.warnings[0], /sections\.contactBand\.props\.copy\.primary: \/contact → \//)
    assert.deepEqual(inquiry.result.warnings, [])
  })

  test("시안 글자 파일에 지운 쪽 주소가 따옴표 글자로 남아 있으면 파일:주소를 적어 던진다 (블록 코드도 훑고, 건너뛰는 것은 rules.json 에 까닭이 적힌 파일뿐이다)", () => {
    assert.throws(
      () => composeWith(SIGNUP, { "components/site/leftover.tsx": 'export const href = "/pricing"\n' }),
      (e) => e.message.includes("components/site/leftover.tsx — /pricing"),
    )
    assert.throws(
      () => composeWith(SIGNUP, { "components/blocks/example.tsx": 'export const href = "/pricing"\n' }),
      (e) => e.message.includes("components/blocks/example.tsx — /pricing"),
      "블록 코드도 훑는다",
    )
    for (const skip of rules.steps.drop.scanSkip) assert.ok(skip.reason.length > 20 && skip.match.length, "건너뛰는 파일마다 까닭")
    assert.deepEqual(scanGoneLinks(["a.ts"], new Set(["/pricing", "/account/billing"]), () => 'x("/pricing/") y(`/account/billing?a=1`) z("/pricing-faq") w("/api/pricing")'), ["a.ts — /pricing", "a.ts — /account/billing"])
    assert.deepEqual(scanGoneLinks(["a.ts"], new Set(), () => '"/pricing"'), [])
  })

  test("요금제 행동 블록(plan-cta): 결제 쪽이 없으면 그 블록을 쓰는 섹션의 signedInHref 를 남은 쪽으로 덮고 블록 코드는 그대로다 — 결제를 고르면 그대로", () => {
    const tpl = (rel) => readFileSync(join(LF, "template", rel), "utf8")
    const pricing = (copy) => ({ block: "block-pricing-three-tier-cards", props: { copy } })
    const site = {
      ...DROP_SITE,
      sections: {
        ...DROP_SITE.sections,
        "campaign/pricing": pricing({ planIds: ["a", "b"], signedInCtas: [{ label: "x", href: "/upgrade?plan=a" }, { label: "y", href: "/account" }] }),
        "pricing/own": pricing({ signedInHref: "/upgrade?plan={plan}&interval={interval}" }),
        "pricing/ok": pricing({ signedInHref: "/account?plan={plan}" }),
        "home/faq": { block: "block-faq-two-column-index", props: { copy: {} } },
      },
    }
    const files = {
      "content/site.json": JSON.stringify(site, null, 2),
      "components/blocks/_shared/plan-cta.tsx": tpl("components/blocks/_shared/plan-cta.tsx"),
      "components/blocks/pricing/three-tier-cards.tsx": tpl("components/blocks/pricing/three-tier-cards.tsx"),
    }
    const s = composeWith(SIGNUP, files)
    assert.deepEqual(planCtaBlocks(s.to, "components/blocks/_shared/plan-cta.tsx"), new Set(["block-pricing-three-tier-cards"]))
    assert.equal(s.site.sections["campaign/pricing"].props.copy.signedInHref, "/sign-up?plan={plan}", "블록 기본값(/upgrade?plan={plan})을 남은 쪽으로")
    assert.deepEqual(s.site.sections["campaign/pricing"].props.copy.signedInCtas.map((c) => c.href), ["/sign-up", "/account"], "순서에 묶인 배열은 원소를 빼지 않고 주소만 바꾼다")
    assert.equal(s.site.sections["pricing/own"].props.copy.signedInHref, "/sign-up?plan={plan}&interval={interval}")
    assert.equal(s.site.sections["pricing/ok"].props.copy.signedInHref, "/account?plan={plan}")
    assert.deepEqual(s.site.sections["home/faq"].props.copy, {})
    assert.equal(readFileSync(join(s.to, "components/blocks/_shared/plan-cta.tsx"), "utf8"), files["components/blocks/_shared/plan-cta.tsx"], "동기화한 블록 코드는 그대로")
    assert.ok(s.result.rewritten.some((r) => r.path === "sections.campaign/pricing.props.copy.signedInHref" && r.to === "/sign-up"))
    const paid = composeWith(["signup", "payments"], files)
    assert.equal("signedInHref" in paid.site.sections["campaign/pricing"].props.copy, false, "결제를 고르면 그대로")
    assert.equal(paid.site.sections["campaign/pricing"].props.copy.signedInCtas[0].href, "/upgrade?plan=a")
    assert.equal(paid.site.sections["pricing/own"].props.copy.signedInHref, "/upgrade?plan={plan}&interval={interval}")
  })

  test("문의 메일 링크: 비밀번호 변경 알림의 contactUrl 은 문의 쪽이 남을 때만 싣고, 템플릿·레지스트리 사본이 같다", () => {
    const pattern = "contactUrl: hasUrl(ROUTES.contact) ? `${appUrl()}${ROUTES.contact}` : undefined"
    const registryCopy = readFileSync(join(LF, "registry/feature-auth-betterauth/files/lib/launch/auth.ts"), "utf8")
    assert.ok(registryCopy.includes(pattern) && registryCopy.includes('import { hasUrl } from "@/lib/launch/enabled"'))
    assert.equal(readFileSync(join(LF, "template/lib/launch/auth.ts"), "utf8"), registryCopy)
    for (const f of ["enabled.ts", "enabled.json"]) assert.equal(readFileSync(join(LF, "template/lib/launch", f), "utf8"), readFileSync(join(LF, "registry/_shared/lib/launch", f), "utf8"), f)
    const item = readJson(join(LF, "registry/feature-auth-betterauth/item.json"))
    assert.ok(item.files.includes("../_shared/lib/launch/enabled.ts") && item.files.includes("../_shared/lib/launch/enabled.json"))
    assert.equal(screens(signup).contact, false)
    assert.equal(screens(inquiry).contact, true)
    assert.equal(screens(null).contact, true)
    assert.ok(readFileSync(join(signup.to, "lib/launch/auth.ts"), "utf8").includes(pattern))
  })

  test("pruneLinks: 지운 쪽만 보며 ?·#·끝 슬래시는 같은 쪽이고, 바깥 주소와 비슷한 이름은 건드리지 않는다", () => {
    const gone = (href) => /^[/]/.test(href) && !href.startsWith("//") && ["/pricing"].includes(href.split(/[?#]/)[0].replace(/(.)[/]+$/, "$1"))
    const node = { nav: [{ href: "/pricing/" }, { href: "/pricing-faq" }, { href: "https://x.example.com/pricing" }, { href: "//cdn.example.com/pricing" }], cta: { href: "/pricing?a=1" }, secondary: { href: "/pricing#x" } }
    assert.equal(pruneLinks(node, { gone, optional: [/^secondary/], target: () => "/" }), 3)
    assert.deepEqual(node, { nav: [{ href: "/pricing-faq" }, { href: "https://x.example.com/pricing" }, { href: "//cdn.example.com/pricing" }], cta: { href: "/" } })
  })

  test("화면 문구: {signup} 출력은 지운 쪽으로 가는 링크·문구가 없고, 가입이 끝나면 계정으로 보낸다", () => {
    const s = screens(signup)
    assert.deepEqual(s.nav, [])
    assert.deepEqual(s.account, ["/account"])
    assert.deepEqual(s.footer, ["terms", "privacy"])
    assert.deepEqual(s.notFound, ["/sign-in", "/account"])
    assert.equal(s.notFoundSupport, false)
    assert.equal(s.errorSupport, false)
    assert.deepEqual([s.welcome.href, s.welcome.label, s.welcome.body], ["/account", "Go to your account", "Your account is ready."])
    assert.equal(s.signUpDone.href, "/account")
    assert.equal(s.signInDone, "/account")
    assert.equal(s.verifiedSignedOut, "/sign-in?next=%2Faccount")
    assert.deepEqual(s.sitemap, ["/", "/terms", "/privacy"], "사이트맵 후보에도 지운 쪽이 없다")
  })

  test("화면 문구: 결제를 고른 출력은 요금제·결제 관리 링크가 그대로 있다 (문의는 고르지 않아 없다)", () => {
    const s = screens(full)
    assert.deepEqual(s.nav, ["/pricing"])
    assert.deepEqual(s.account, ["/account", "/account/billing"])
    assert.deepEqual(s.footer, ["terms", "privacy", "refund"])
    assert.deepEqual([s.welcome.href, s.welcome.label], ["/pricing", "See plans"])
    assert.deepEqual(s.sitemap, ["/", "/pricing", "/terms", "/privacy", "/refund"])
  })

  test("템플릿 그대로(enabled.json 이 null)면 화면은 예전과 같다: 링크·문구·사이트맵이 전부 남는다", () => {
    assert.deepEqual(readJson(join(LF, "template", "lib/launch/enabled.json")), { parts: null, urls: null })
    const s = screens(null)
    assert.deepEqual(s.nav, ["/pricing"])
    assert.deepEqual(s.account, ["/account", "/account/billing"])
    assert.deepEqual(s.footer, ["terms", "privacy", "refund", "contact"])
    assert.deepEqual(s.notFound, ["/pricing", "/sign-in", "/account"])
    assert.deepEqual([s.notFoundSupport, s.errorSupport], [true, true])
    assert.deepEqual([s.welcome.href, s.welcome.label, s.welcome.body], ["/pricing", "See plans", "Your account is ready. Pick a plan to get started."])
    assert.equal(s.signInDone, "/account/billing")
    assert.equal(s.verifiedSignedOut, "/sign-in?next=%2Faccount%2Fbilling")
    assert.deepEqual(s.sitemap, ["/", "/pricing", "/products", "/contact", "/book", "/terms", "/privacy", "/refund"])
  })

  test("mergeLines: ! 글롭이 비밀 견본(.env·.env.local·.env.production·.vercel) 하나라도 맞히면 뺀다 — !*.local · !* · !.env* · !**/.env.local", () => {
    for (const bad of ["!*.local", "!*", "!.env*", "!**/.env.local", "!.env.*", "!.vercel", "!.v*", "!/.env"]) {
      assert.ok(reincludesSecret(bad), bad)
      assert.ok(!mergeLines("a\n", `${bad}\n`).includes(bad), `${bad} 가 합쳐진 파일에 남았다`)
    }
    for (const ok of ["!.env.example", "!keep-me.txt", "!src/*.ts", "!public/", "site-only", "# !*"]) assert.ok(!reincludesSecret(ok), ok)
    const to = fresh("ign2")
    mkdirSync(to)
    writeFileSync(join(to, ".gitignore"), mergeLines(readFileSync(join(LF, "template", ".gitignore"), "utf8"), "!*.local\n!*\n!.env.example\n"))
    assert.equal(spawnSync("git", ["init", "-q"], { cwd: to }).status, 0)
    for (const [name, ignored] of [[".env.local", true], [".env.production", true], [".env", true], [".env.example", false]]) assert.equal(spawnSync("git", ["check-ignore", "-q", name], { cwd: to }).status === 0, ignored, name)
  })

  test("makeEnabled: null 이면 전부 켜짐, 목록이 있으면 경로만 본다(쿼리·앵커·끝 슬래시는 같은 쪽, 바깥 주소는 늘 참)", () => {
    const all = makeEnabled({ parts: null, urls: null })
    assert.ok(all.hasPart("anything") && all.hasUrl("/anything") && all.go("/a", "/b") === "/a")
    const e = makeEnabled({ parts: ["auth"], urls: ["/", "/account", "/email"] })
    assert.ok(e.hasPart("auth") && !e.hasPart("consent"))
    assert.ok(e.hasUrl("/account/") && e.hasUrl("/account?x=1#y") && e.hasUrl("/"))
    assert.ok(!e.hasUrl("/pricing") && !e.hasUrl("/pricing#plans") && !e.hasUrl("/account/billing"))
    assert.ok(e.hasUrl("https://x.example.com/pricing") && e.hasUrl("mailto:a@b.c") && e.hasUrl("#top") && e.hasUrl("//cdn.example.com/p"))
    assert.deepEqual(e.linksOn([{ href: "/account" }, { href: "/pricing" }]), [{ href: "/account" }])
    assert.equal(e.go("/account/billing", "/account"), "/account")
    assert.equal(e.go("/email?r=ok", "/"), "/email?r=ok")
  })
})

describe("최종 검토 수정 (C1·I1·I3·M7)", () => {
  const sourceIds = Object.keys(inventory.sources)
  const archetypeOf = (id) => id.replace(/-\d+$/, "")
  const siteFromInventory = (id) => {
    const dir = fresh(`inv-${id}`)
    for (const [rel, ids] of Object.entries(inventory.paths)) {
      if (!ids.includes(id)) continue
      mkdirSync(dirname(join(dir, rel)), { recursive: true })
      writeFileSync(join(dir, rel), "")
    }
    return dir
  }

  test("C1: 제품형 질문을 받는 원형마다 실측 시안이 있다", () => {
    const asked = new Set(table.outcomes.filter((o) => o.product).flatMap((o) => o.archetypes))
    const measured = new Set(sourceIds.map(archetypeOf))
    assert.deepEqual([...asked].filter((a) => !measured.has(a)), [], "outcomes.yaml 이 가입·결제를 묻는 원형인데 inventory.json 에 실측이 없다")
  })

  test("C1: 실측한 모든 원형의 시안이 {signup}·{signup,payments} 계획 단계를 던지지 않고 지나간다", () => {
    for (const id of sourceIds) {
      const siteDir = siteFromInventory(id)
      for (const outcomes of [["signup"], ["signup", "payments"]]) {
        const state = { siteDir, templateDir: join(LF, "template"), rules, urlMap, features: { version: 1, table: table.hash, outcomes }, table }
        assert.doesNotThrow(() => plan.run(state), `${id} ${outcomes}`)
        assert.equal(state.plan.length, inventory.sources[id].files, `${id}: 모든 시안 파일에 규칙이 정해졌다`)
        assert.ok(state.plan.every((p) => p.rule))
      }
    }
  })

  test("C1: 템플릿과 URL 이 겹치지 않는 시안 쪽(route group 포함)은 가져오고, 겹치면 url-map 에 줄이 없다고 던진다", () => {
    const to = fresh("pages")
    const siteDir = makeSite({ "app/services/page.tsx": "export default function P() { return <h1>s</h1> }\n", "app/(info)/about/page.tsx": "export default function P() { return <h1>a</h1> }\n" })
    const r = composeProduct({ siteDir, features, table, to })
    assert.ok(existsSync(join(to, "app/services/page.tsx")) && existsSync(join(to, "app/(info)/about/page.tsx")))
    assert.ok(r.copied.includes("app/services/page.tsx"))
    assert.throws(() => composeProduct({ siteDir: makeSite({ "app/(x)/contact/page.tsx": "x" }), features, table, to: fresh("never") }), /url-map\.json 이 정하지 않았다/)
  })

  test("I3: 시안 폴더의 .vercel·.env.local 은 계획에 걸리지 않고 출력에도 가지 않는다", () => {
    const to = fresh("secrets")
    const siteDir = makeSite({ ".vercel/project.json": "{}", ".vercel/README.txt": "x", ".env.local": "SECRET_TOKEN=abc\n", ".env.production.local": "SECRET_TOKEN=abc\n" })
    assert.doesNotThrow(() => composeProduct({ siteDir, features, table, to }))
    assert.ok(!existsSync(join(to, ".vercel")))
    assert.ok(!existsSync(join(to, ".env.production.local")))
    assert.equal(readFileSync(join(to, ".env.local"), "utf8").trim(), "LF_MODE=mock")
  })

  const LOOP_CASES = [["signup"], ["signup", "payments"], ["signup", "inquiry"], ["signup", "booking"], ["signup", "booking", "push"], ["signup", "booking", "booking-deposit"], ["signup", "shop"], ["signup", "payments", "inquiry", "booking", "shop", "marketing", "analytics"]]
  test("I1: 출력의 e2e/loop-steps.json 은 고른 기능의 단계만 남기고, 한 바퀴·스모크가 지워진 쪽을 방문하지 않는다", () => {
    const full = readJson(join(LF, "template", "e2e", "loop-steps.json"))
    const urlOwners = new Map(table.pages.map((p) => [p.url, p.owners]))
    for (const outcomes of LOOP_CASES) {
      const to = fresh("loop")
      composeProduct({ siteDir: makeSite(), features: { version: 1, table: table.hash, outcomes }, table, to })
      const spec = loadLoopSteps(join(to, "e2e", "loop-steps.json"))
      const want = Object.keys(full.steps).filter((f) => outcomes.includes(f))
      assert.deepEqual(planLoop(undefined, spec).features, want, `${outcomes} — LOOP_FEATURES 없이 돌려도 고른 기능뿐`)
      assert.deepEqual(Object.keys(spec.mail), want)
      assert.deepEqual(Object.keys(spec.requires), Object.keys(full.requires).filter((f) => want.includes(f)))
      const leftIds = Object.values(spec.steps).flat()
      for (const f of Object.keys(full.steps).filter((f) => !want.includes(f))) for (const id of full.steps[f]) assert.ok(!leftIds.includes(id), `${outcomes}: 고르지 않은 ${f} 의 단계 ${id} 가 남았다`)
      // 스모크가 방문하는 쪽 = 출력 app/ 의 쪽 목록 — 남은 쪽뿐이고 지워진 쪽(소유 부품이 꺼진 표의 쪽)은 없다
      const { urls } = readJson(join(to, "lib/launch/enabled.json"))
      const { routes } = routesFromApp(join(to, "app"))
      for (const r of routes) assert.ok(urls.includes(r), `${outcomes}: 스모크가 방문할 ${r} 은 남은 쪽 목록에 있다`)
      const on = turnedOn(table, { outcomes })
      for (const [url, owners] of urlOwners) if (!owners.some((o) => on.has(o))) assert.ok(!routes.includes(url), `${outcomes}: 지워진 ${url} 이 스모크 쪽 목록에 있다`)
      assert.ok(routes.includes("/") && routes.includes("/account"), "스모크가 늘 보는 / 와 /account 는 남는다")
    }
    assert.deepEqual(Object.keys(full.steps), ["signup", "payments", "inquiry", "booking", "booking-deposit", "shop"], "템플릿 원본은 줄이지 않는다")
  })

  test("I1: filterLoopSteps — 고른 기능이 한 바퀴 단계를 하나도 못 가지면 던진다 · 선택자·기대 글은 그대로", () => {
    const full = readJson(join(LF, "template", "e2e", "loop-steps.json"))
    const one = filterLoopSteps(full, new Set(["signup", "marketing"]))
    assert.deepEqual(Object.keys(one.steps), ["signup"])
    assert.deepEqual(one.selectors, full.selectors)
    assert.deepEqual(one.expect, full.expect)
    assert.throws(() => filterLoopSteps(full, new Set(["analytics"])), /한 바퀴 단계가 있는 것이 없다/)
  })

  test("M7: 공개 쪽 목록은 template/lib/public-paths.json 한 곳이고 seo.ts 가 같은 파일을 읽는다", async () => {
    const paths = readJson(join(LF, "template", "lib", "public-paths.json"))
    assert.ok(Array.isArray(paths) && paths.includes("/") && paths.every((p) => typeof p === "string"))
    const { PUBLIC_PATHS } = await import("../../template/lib/seo.ts")
    assert.deepEqual([...PUBLIC_PATHS], paths)
  })
})

describe("LF 수정 재검토 (N2·N3·N5·N7)", () => {
  test("N2: 빌드를 마친 시안 폴더의 결과물(next-env.d.ts·tsbuildinfo·.next-export·.turbo·.tmp)은 계획에 걸리지 않고 출력에도 가지 않는다", () => {
    const to = fresh("built")
    const siteDir = makeSite({ "next-env.d.ts": "/// <reference types=\"next\" />\n", "tsconfig.tsbuildinfo": "{}", ".next-export/index.html": "x", ".turbo/cache.json": "{}", ".tmp/x.json": "{}", ".next/BUILD_ID": "x" })
    assert.doesNotThrow(() => composeProduct({ siteDir, features, table, to }))
    for (const rel of [".next-export", ".turbo", "tsconfig.tsbuildinfo"]) assert.ok(!existsSync(join(to, rel)), rel)
  })

  test("N3: 템플릿 쪽의 기능을 고르지 않으면 같은 URL 의 시안 쪽이 이긴다(쇼핑몰 {signup} 의 /refund) — 고르면 템플릿 쪽", () => {
    const refund = { "app/refund/page.tsx": "export default function P() { return <h1>site refund</h1> }\n" }
    const to = fresh("refund")
    const r = composeProduct({ siteDir: makeSite(refund), features: { version: 1, table: table.hash, outcomes: ["signup"] }, table, to })
    assert.equal(readFileSync(join(to, "app/refund/page.tsx"), "utf8"), refund["app/refund/page.tsx"])
    assert.ok(!existsSync(join(to, "app/(legal)/refund/page.tsx")), "템플릿 /refund 는 지워진다(같은 URL 둘 금지)")
    assert.ok(readJson(join(to, "lib/launch/enabled.json")).urls.includes("/refund"))
    assert.ok(r.copied.includes("app/refund/page.tsx"))
    const paid = fresh("refund-paid")
    composeProduct({ siteDir: makeSite(refund), features, table, to: paid })
    assert.ok(existsSync(join(paid, "app/(legal)/refund/page.tsx")) && !existsSync(join(paid, "app/refund/page.tsx")), "결제를 고르면 템플릿 쪽")
  })

  test("N5: app/**/page.tsx 는 폴더 깊이 0 이상의 page.tsx 만 맞히고 app/homepage.tsx 는 아니다", () => {
    const re = globToRegExp("app/**/page.tsx")
    for (const ok of ["app/page.tsx", "app/a/page.tsx", "app/(g)/a/b/page.tsx"]) assert.ok(re.test(ok), ok)
    for (const no of ["app/homepage.tsx", "app/a/subpage.tsx"]) assert.ok(!re.test(no), no)
    assert.ok(globToRegExp("lib/**").test("lib/a/b.ts"))
  })

  test("N7: 출력에 lib/public-paths.json 이 없으면 drop 이 말없이 넘어가지 않고 던진다", () => {
    const dir = fresh("no-public")
    mkdirSync(dir, { recursive: true })
    assert.throws(() => publicPaths(dir), /public-paths\.json/)
  })
})

describe("catalogFromSite — 상점이 켜진 출력의 상품표는 시안 products 에서 나온다", () => {
  const catalogBlock = BLOCKS.find((b) => b.id === "catalogFromSite")
  const PRODUCTS = [
    { slug: "beans-250", name: "원두 250g (예시)", price: 14000 },
    { slug: "drip-bag-10", name: " 드립백 10입 (예시) ", price: 9500, listPrice: 11000 },
  ]
  const shopSite = (over = {}) => JSON.stringify({ locale: "ko", site: { url: "https://shop.example.com" }, products: PRODUCTS, shipping: { fee: 3500, freeThreshold: 40000, courier: "예시택배", leadDays: 2 }, ...over })
  const shopFeatures = { version: 1, table: table.hash, outcomes: ["signup", "shop"] }
  const catalogOf = (to) => readFileSync(join(to, "lib/launch/catalog.ts"), "utf8")

  test("등록부에 있고 drop 뒤에 선다(켜짐 표를 같이 읽는다)", () => {
    const ids = BLOCKS.map((b) => b.id)
    assert.ok(catalogBlock, "등록부에 없음")
    assert.ok(ids.indexOf("catalogFromSite") > ids.indexOf("drop"))
    assert.equal(rules.steps.catalogFromSite.requires, "commerce")
  })

  test("템플릿 catalog.ts 에 바꿀 선언 둘이 그대로 있다 — 템플릿이 바뀌면 여기서 실패한다", () => {
    const text = readFileSync(join(LF, "template", rules.steps.catalogFromSite.file), "utf8")
    assert.doesNotThrow(() => applyCatalog(text, { products: [{ id: "a", name: "A", price: 1 }], shipping: { fee: 0, freeOver: null } }))
    assert.match(text, /^\/\/ 아래는 예시다/m)
  })

  test("상점이 켜졌으면 id·이름·가격·배송비를 시안에서 옮기고 머리 주석·ORDERS_PATH 는 그대로 둔다", () => {
    const to = fresh("cat")
    const r = composeProduct({ siteDir: makeSite({ "content/site.json": shopSite() }), features: shopFeatures, table, to })
    assert.deepEqual(r.catalogFromSite, { status: "applied", count: 2 })
    const text = catalogOf(to)
    assert.match(text, /\{ id: "beans-250", name: "원두 250g \(예시\)", price: 14000 \},/)
    assert.match(text, /\{ id: "drip-bag-10", name: "드립백 10입 \(예시\)", price: 9500 \},/, "이름 앞뒤 공백은 뗀다")
    assert.match(text, /^export const SHIPPING: ShippingRule = \{ fee: 3500, freeOver: 40000 \}$/m)
    assert.match(text, /^export const ORDERS_PATH = "\/orders"$/m)
    assert.doesNotMatch(text, /example-mug|example-tote|아래는 예시다/, "예시 상품과 예시 안내가 남지 않는다")
    assert.match(text, /^\/\/ 아래 상품표와 배송비는 시안/m)
    assert.doesNotMatch(text, /listPrice|stock: |imageUrl: /, "정가·재고·사진은 옮기지 않는다")
  })

  test("무료 배송 기준이 없거나 0 이면 freeOver 는 null 이다", () => {
    for (const shipping of [{ fee: 0, courier: "x", leadDays: 1 }, { fee: 2500, freeThreshold: 0, courier: "x", leadDays: 1 }]) {
      const to = fresh("cat-null")
      composeProduct({ siteDir: makeSite({ "content/site.json": shopSite({ shipping }) }), features: shopFeatures, table, to })
      assert.match(catalogOf(to), new RegExp(`^export const SHIPPING: ShippingRule = \\{ fee: ${shipping.fee}, freeOver: null \\}$`, "m"))
    }
  })

  test("상점이 꺼졌거나 시안에 products 가 없으면 상품표를 건드리지 않는다", () => {
    const off = fresh("cat-off")
    const r = composeProduct({ siteDir: makeSite({ "content/site.json": shopSite() }), features, table, to: off })
    assert.equal(r.catalogFromSite.status, "skipped")
    assert.match(r.catalogFromSite.reason, /꺼져/)
    const none = fresh("cat-none")
    const r2 = composeProduct({ siteDir: makeSite({ "content/site.json": shopSite({ products: undefined }) }), features: shopFeatures, table, to: none })
    assert.match(r2.catalogFromSite.reason, /products/)
    assert.match(catalogOf(none), /example-mug/, "예시 상품이 그대로")
  })

  test("상품표 규칙을 어기면 모아서 한 번에 던진다(id 모양·중복·가격·이름·배송비)", () => {
    const { catalogOf: build } = catalogBlock
    assert.throws(
      () => build({ products: [{ slug: "Bad Slug", name: "a", price: 100 }, { slug: "ok", name: " ", price: 0 }, { slug: "ok", name: "b", price: 1.5 }], shipping: { fee: -1 } }),
      (e) => {
        for (const part of ["products[0].slug", "products[1].name", "products[1].price", "products[2].slug: 같은 상품 id", "products[2].price", "shipping.fee"]) assert.ok(e.message.includes(part), `${part}\n${e.message}`)
        return true
      },
    )
    assert.equal(build({}), null)
    assert.equal(build({ products: [] }), null)
  })
})
