// LFUX2 시험(제품 화면 개선 — 문의·가격 변경 동의·오류 화면·머리말·로캘). 빌드·서버 없이 돈다(실제 화면은 verify.heavy.mjs 가 서버로 본다).
import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { registerHooks } from "node:module"
import test from "node:test"
import { fileURLToPath } from "node:url"

registerHooks({ resolve: (spec, ctx, next) => next(spec === "next/server" ? "next/server.js" : spec, ctx) })

const T = fileURLToPath(new URL("..", import.meta.url))
const read = (p) => readFileSync(join(T, p), "utf8")
const has = (p) => existsSync(join(T, p))

// ── I01·I02·I03: 로캘·시간대 ────────────────────────────────────────────────────────────────

test("표시 로캘은 화면 문구 판의 언어와 같고, 시간대 기본은 메일 템플릿의 영어 기본과 같다(화면과 메일이 같은 날을 말한다)", async () => {
  const { DISPLAY_LOCALE, DEFAULT_TIME_ZONE, displayTimeZone } = await import("../lib/locale.ts")
  assert.match(read("content/copy.en.ts"), new RegExp(`export const COPY_LOCALE = "${DISPLAY_LOCALE}"`), "화면 문구 판의 언어와 같아야 한다")
  const { timeZoneOf } = await import("../../packages/email/src/templates/layout.ts")
  assert.equal(timeZoneOf({ locale: DISPLAY_LOCALE, productName: "x" }), DEFAULT_TIME_ZONE)
  // 사용자 값이 올바르면 그것, 틀리거나 없으면 제품 기본
  assert.equal(displayTimeZone("America/New_York"), "America/New_York")
  for (const bad of [undefined, null, "", "Nowhere/Land", 5]) assert.equal(displayTimeZone(bad), DEFAULT_TIME_ZONE, String(bad))
})

test("화면 블록의 날짜 서식(en)과 메일의 날짜 서식이 같은 시간대에서 같은 날을 말한다 — 시각이 자정 언저리여도", async () => {
  const { formatDate } = await import("../../packages/email/src/format.ts")
  // 블록(billing-format.tsx dateFormat)이 쓰는 서식과 같은 모양인지 원본에서 확인한다
  const src = read("components/blocks/_shared/billing-format.tsx")
  assert.match(src, /locale === "en" \? "en-US"/)
  assert.match(src, /new Intl\.DateTimeFormat\(tag, \{ timeZone: zone, year: "numeric", month: "long", day: "numeric" \}\)/)
  const screen = (iso, tz) => new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "long", day: "numeric" }).format(new Date(iso))
  for (const tz of ["UTC", "Asia/Seoul", "America/New_York", "Pacific/Auckland"]) {
    for (const iso of ["2026-10-31T15:00:00.000Z", "2026-11-01T00:00:00.000Z", "2026-11-15T23:59:59.000Z", "2026-03-08T07:30:00.000Z"]) {
      assert.equal(formatDate(iso, "en", tz), screen(iso, tz), `${iso} ${tz}`)
    }
  }
  // 양성 대조: 시간대를 어긋나게 쓰면 같은 시각이 다른 날이 된다(시험이 날짜 차이를 잡는다)
  assert.notEqual(screen("2026-10-31T15:00:00.000Z", "Asia/Seoul"), screen("2026-10-31T15:00:00.000Z", "UTC"))
})

test("제품 블록 래퍼가 모든 블록에 locale·timeZone 을 넘긴다(영어 화면에 한국어 날짜·「닫기」가 남지 않는다)", () => {
  const src = read("components/product/product-blocks.tsx")
  const blocks = ["AuthSignIn", "AuthSignUpConsents", "PricingThreeTierCards", "AuthPasswordReset", "PaywallUpgradeModal", "AccountBillingManage", "RetentionCancelFlow", "ConsentBottomBanner", "RetentionRenewalConsent"]
  for (const b of blocks) {
    const el = new RegExp(`<${b} [^>]*\\{\\.\\.\\.prefs\\}`)
    assert.match(src, el, `<${b}> 에 {...prefs} 가 없다`)
  }
  // 양성 대조: 넘기지 않은 요소는 이 식에 걸리지 않는다
  assert.doesNotMatch("<AuthSignIn copy={x} />", new RegExp("<AuthSignIn [^>]*\\{\\.\\.\\.prefs\\}"))
  // 레이아웃이 통을 두고, 사용자 시간대(session 의 timeZone)로 시작한다
  const layout = read("components/product/product-shell.tsx")
  // currentSession()(lf-ux1, lib/session-server.ts)은 세션 데이터를 바로 돌려준다 — 병합 때 { ok, data } 모양에서 바꿨다
  assert.match(layout, /<DisplayPrefsProvider initialTimeZone=\{s\?\.timeZone \?\? null\}/)
})

// ── K05·G01·K06·K10: 문의 ─────────────────────────────────────────────────────────────────

test("문의: 쪽·서버 액션·접수 경로·Cron 이 있고, 첫 응답 약속은 제품 설정(SUPPORT)에서 읽는다", () => {
  for (const f of ["app/(product)/contact/page.tsx", "app/actions/inquiry.ts", "app/api/inquiry/route.ts", "app/api/cron/inquiry/route.ts", "lib/launch/inquiry.ts", "lib/launch/support.ts", "components/product/contact-form.tsx"]) assert.ok(has(f), f)
  const page = read("app/(product)/contact/page.tsx")
  assert.match(page, /SUPPORT\.responseTime/)
  assert.match(page, /<h1 /, "쪽이 h1 을 가진다")
  assert.match(page, /submit=\{submitInquiry\}/)
  const inquiry = read("lib/launch/inquiry.ts")
  assert.match(inquiry, /receipt: SUPPORT\.receipt/)
  assert.match(inquiry, /responseTime: SUPPORT\.responseTime/)
  // mock 은 운영자 메일이 없어도 가짜 주소로 켜지고, live 는 없으면 문의 창구만 꺼진다(사이트는 켜진다 — 2026-10-05 결정, LFENV)
  assert.match(inquiry, /export function inquiryOwnerEmail\(\)/)
  assert.match(inquiry, /LF_MODE === "live" \? undefined : "owner@example\.test"/)
  assert.doesNotMatch(inquiry, /required\("INQUIRY_OWNER_EMAIL"\)/, "live 에서 이 이름이 없다고 던지면 사이트 전체가 멈춘다")
  assert.match(inquiry, /\.\.\.\(ownerAddress \? \{ owner:/, "주소가 없으면 owner 를 빼 접수만 끈다")
  assert.ok(JSON.parse(read("vercel.json")).crons.some((c) => c.path === "/api/cron/inquiry"))
  const copy = read("content/copy.ux.en.ts")
  assert.match(copy, /response: "We usually reply within \{responseTime\}\."/)
})

test("문의 폼: 멱등 키·봇 토큰을 싣고, 필수 칸은 이름이 있는 라벨과 오류 알림(role=alert)을 쓴다", () => {
  const form = read("components/product/contact-form.tsx")
  assert.match(form, /<FormKeys>/)
  assert.match(form, /"cf-turnstile-response"/)
  assert.match(form, /useTurnstileWidget\(turnstileSiteKey\)/)
  assert.match(form, /<FormAlert /)
  assert.match(form, /role="status"/, "접수 번호는 화면에 남는 글로 알린다")
  assert.ok(!/\sstyle=/.test(form), "style 속성이 없다(엄격 CSP)")
})

test("비밀번호 변경 메일이 「contact us」 가 가리킬 문의 화면 링크를 받는다(C02)", () => {
  assert.match(read("lib/launch/config.ts"), /contact: "\/contact"/)
  assert.match(read("lib/launch/auth.ts"), /contactUrl: `\$\{appUrl\(\)\}\$\{ROUTES\.contact\}`/)
})

// ── F04: 가격 변경 동의 ───────────────────────────────────────────────────────────────────

test("가격 변경 두 쪽: 메일이 가리키는 경로에 있고, 로그인 전이면 next 를 달아 로그인으로 보내며, 쪽을 여는 것만으로 동의·해지를 부르지 않는다", () => {
  const cfg = read("lib/launch/config.ts")
  const accept = /acceptPriceChange: "([^"]+)"/.exec(cfg)[1]
  const decline = /decline: "([^"]+)"/.exec(cfg)[1]
  for (const route of [accept, decline]) assert.ok(has(`app/(product)${route}/page.tsx`), `${route} 쪽이 없다`)
  const screen = read("components/product/price-change-screen.tsx")
  // (LFADA) 로그인 전이면 다른 보호된 쪽과 같은 로그인 안내 — 링크에 next 를 단다(redirect() 는 스트리밍 응답에서 클라이언트 이동이라 관문이 이동 전에 쟀다)
  assert.match(screen, /if \(!\(s\?\.ok && s\.data\)\) return <SignInRequired next=\{path\} \/>/)
  assert.doesNotMatch(screen.replace(/^\/\/.*$/gm, ""), /redirect\(/)
  // 서버가 그리는 동안 포트를 부르는 것은 읽기(subscription)뿐이다 — 동의·해지는 블록의 단추가 부른다(props 로만 넘긴다)
  assert.doesNotMatch(screen, /await (acceptPriceChange|cancel)\(/)
  assert.match(screen, /<RenewalConsentBlock subscription=\{subscription\} acceptPriceChange=\{acceptPriceChange\} cancel=\{cancel\} \/>/)
  // 두 쪽 모두 같은 화면을 쓰고 경로를 설정(ROUTES)에서 읽는다
  assert.match(read("app/(product)/account/billing/price-change/page.tsx"), /mode="accept" path=\{ROUTES\.acceptPriceChange\}/)
  assert.match(read("app/(product)/account/billing/cancel/page.tsx"), /mode="decline" path=\{ROUTES\.decline\}/)
})

test("가격 변경 동의: 동의 단추는 블록의 type=button 이라 폼 제출·자동 실행이 없다(블록 원본에서 확인)", () => {
  const block = read("components/blocks/retention/renewal-consent.tsx")
  assert.match(block, /choice="decline" type="button"/)
  assert.match(block, /choice="primary" type="button"/)
  assert.doesNotMatch(block, /useEffect\([^)]*(acceptPriceChange|cancel)\(/)
})

test("mock·live 포트 모두 acceptPriceChange 가 있다(ProductBilling)", () => {
  assert.match(read("lib/ports.ts"), /"applyRetentionOffer" \| "acceptPriceChange"/)
  assert.match(read("lib/ports.live.ts"), /acceptPriceChange: async \(\) =>/)
  assert.match(read("app/actions/product.ts"), /export const acceptPriceChange/)
})

// ── H01·H02: 오류·로딩·404 ───────────────────────────────────────────────────────────────

test("오류·전역 오류·로딩·404 화면이 있고, 엄격 CSP 에 안전하다(style 속성 없음) — 지원 링크와 오류 번호가 있다", () => {
  for (const f of ["app/error.tsx", "app/global-error.tsx", "app/loading.tsx", "app/not-found.tsx", "components/product/error-screen.tsx"]) {
    assert.ok(has(f), f)
    assert.ok(!/\sstyle=/.test(read(f)), `${f}: style 속성은 엄격 CSP(style-src)에 막힌다`)
  }
  assert.match(read("app/error.tsx"), /^"use client"/)
  assert.match(read("app/global-error.tsx"), /^"use client"[\s\S]*<html lang="en">[\s\S]*<body>/)
  // LFADA: 화면은 web-factory 블록 state-screen/* 이다 — 읽는 도구의 상태 글(role=status)은 블록이 그린다
  assert.match(read("app/loading.tsx"), /<StateScreenLoading copy=\{loadingCopy\} \/>/)
  assert.match(read("components/blocks/state-screen/loading.tsx"), /role="status"/)
  const nf = read("app/not-found.tsx")
  assert.match(nf, /export const metadata = \{ title: errorCopy\.notFound\.title \}/, "404 에 쪽 제목이 있다")
  assert.match(nf, /<ProductHeader \/>/, "404 에 위 띠(내비)가 있다")
  assert.match(nf, /<StateScreenNotFound /)
  assert.match(read("content/copy.shell.en.ts"), /support: \{ label: "Still stuck\? Contact us", href: "\/contact" \}/)
  const view = read("components/product/error-screen.tsx")
  assert.match(view, /errorCode=/)
  assert.match(view, /href="\/contact"/, "위 띠에 문의 링크")
  assert.match(read("content/copy.shell.en.ts"), /support: \{ label: "Contact us", href: "\/contact" \}/)
  assert.match(view, /digest/)
})

// ── L01·L02: 머리말·색인 ──────────────────────────────────────────────────────────────────

test("머리말: 제목 템플릿 「쪽 · 제품」·설명·OG 가 제품 설정에서 온다(운영자 값을 박지 않는다)", () => {
  const layout = read("app/layout.tsx")
  assert.match(layout, /template: `%s · \$\{PRODUCT_NAME\}`/)
  assert.match(layout, /description: metaCopy\.description/)
  assert.match(layout, /openGraph:/)
  assert.match(layout, /metadataBase: new URL\(appUrl\(\)\)/)
  for (const f of ["app/robots.ts", "app/sitemap.ts", "app/manifest.ts", "app/icon.tsx", "app/apple-icon.tsx"]) assert.ok(has(f), f)
  // 주소·메일·사람 이름이 박혀 있지 않다
  for (const f of ["app/layout.tsx", "app/robots.ts", "app/sitemap.ts", "app/manifest.ts", "content/copy.ux.en.ts", "lib/launch/support.ts"]) {
    assert.doesNotMatch(read(f), /https?:\/\/(?!localhost)[a-z0-9.-]+\.[a-z]{2,}|@[a-z0-9-]+\.(com|io|kr|net)/i, `${f}: 실제 주소·메일을 박지 않는다`)
  }
})

test("색인 정책: 공개 쪽은 실제 경로이고 색인 제외 목록과 겹치지 않으며, proxy 가 색인 제외 쪽에만 X-Robots-Tag 를 붙인다", async () => {
  const { PUBLIC_PATHS, NOINDEX_PREFIXES, isNoIndexPath } = await import("../lib/seo.ts")
  for (const p of PUBLIC_PATHS) {
    const dir = p === "/" ? "" : p
    assert.ok(has(`app/(product)${dir}/page.tsx`) || has(`app/(legal)${dir}/page.tsx`), `${p} 쪽이 없다`)
    assert.equal(isNoIndexPath(p), false, `${p} 는 공개 쪽이다`)
  }
  for (const p of NOINDEX_PREFIXES.filter((x) => x !== "/api")) assert.ok(has(`app/(product)${p}/page.tsx`) || has(`app/(product)${p}/billing/page.tsx`) || has(`app/(product)${p}/cancel/page.tsx`) || has(`app/(product)${p}/return/page.tsx`), `${p} 아래 쪽이 없다`)
  assert.equal(isNoIndexPath("/account/billing/price-change"), true)
  assert.equal(isNoIndexPath("/accounting"), false, "접두사는 경로 경계에서 자른다")
  const { proxy } = await import("../proxy.ts")
  const { NextRequest } = await import("next/server")
  const tag = (path) => proxy(new NextRequest(`http://localhost:3000${path}`)).headers.get("x-robots-tag")
  for (const p of ["/sign-in", "/account/billing", "/upgrade", "/api/inquiry"]) assert.equal(tag(p), "noindex", p)
  for (const p of ["/", "/pricing", "/contact", "/terms"]) assert.equal(tag(p), null, p)
})

// ── J04: h1 ───────────────────────────────────────────────────────────────────────────────

test("블록만 놓인 쪽은 래퍼가 h1 하나를 둔다 — 쪽 제목(metadata.title)과 같은 말이다", () => {
  const src = read("components/product/product-blocks.tsx")
  // LFADB: 새 비밀번호 쪽(reset-password)도 블록(web-factory auth/new-password)으로 바뀌어 래퍼가 h1 을 둔다
  const titles = { signIn: "sign-in", signUp: "sign-up", forgotPassword: "forgot-password", newPassword: "reset-password", pricing: "pricing", upgrade: "upgrade", billing: "account/billing", cancel: "account/cancel", verifyEmail: "verify-email" }
  const copy = /export const pageTitles = \{[^}]*\}/.exec(read("content/copy.ux.en.ts"))[0]
  for (const [key, route] of Object.entries(titles)) {
    assert.match(src, new RegExp(`<PageTitle>\\{pageTitles\\.${key}\\}</PageTitle>`), `${key} 래퍼에 PageTitle 이 없다`)
    const text = new RegExp(`${key}: "([^"]+)"`).exec(copy)[1]
    assert.match(read(`app/(product)/${route}/page.tsx`), new RegExp(`title: "${text}"`), `${route} 의 metadata.title 과 h1 이 같은 말이어야 한다`)
  }
  // 한 래퍼 안에 h1 이 둘 이상 생기지 않는다: PageTitle 은 래퍼 하나에 한 번
  assert.equal((src.match(/<PageTitle>/g) ?? []).length, Object.keys(titles).length)
})
