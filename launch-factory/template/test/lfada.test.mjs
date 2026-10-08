// LFADA — web-factory v0.0.10 쉘·동의·오류 화면 블록 채택의 정적·실행 시험(빌드·서버 없이 돈다). 브라우저 판정은 npm run template:screens 가 한다(docs/qa/ux-audit/apply-lfada.md).
// 채택한 것: 위 띠 nav/account-bar · 바닥글 footer/product-legal(사업자 정보는 제품 설정에서, 빈 칸 숨김) · 상태 화면 state-screen/{not-found,loading,error-retry} ·
// 읽기 오류의 로그인 슬롯(ReadErrorProvider·signInRequired) · 쿠키 환경설정 문구(copy.preferences) · 건너뛰기 링크.
import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

const T = fileURLToPath(new URL("..", import.meta.url))
const read = (p) => readFileSync(join(T, p), "utf8")

test("K03 사업자 정보: 값은 제품 설정(LF_BUSINESS_*)에서만 오고, 빈 칸은 안 그린다 — 칸 이름 regNo → registrationNo 만 옮긴다", async () => {
  const { footerBusiness } = await import("../lib/footer-business.ts")
  // 빈 설정: 모든 칸이 없다(블록이 구획 자체를 숨긴다)
  assert.deepEqual(Object.values(footerBusiness({})).filter((v) => v !== undefined), [])
  // 공백뿐인 값도 없는 것이다
  assert.equal(footerBusiness({ LF_BUSINESS_NAME: "   ", LF_BUSINESS_PHONE: "" }).name, undefined)
  // 값이 있으면 칸 이름만 맞춰 그대로 옮긴다(눈에 띄게 가짜인 시험 값)
  const b = footerBusiness({
    LF_BUSINESS_NAME: "Example Co.",
    LF_BUSINESS_OWNER: "Example Owner",
    LF_BUSINESS_ADDRESS: "1 Example Street",
    LF_BUSINESS_PHONE: "+82 10-0000-0000",
    LF_BUSINESS_EMAIL: "hello@example.test",
    LF_BUSINESS_REG_NO: "000-00-00000",
    LF_MAIL_ORDER_NO: "0000-Example-0000",
    LF_HOSTING_PROVIDER: "Example Hosting Inc.",
  })
  assert.deepEqual(b, {
    name: "Example Co.",
    owner: "Example Owner",
    address: "1 Example Street",
    phone: "+82 10-0000-0000",
    email: "hello@example.test",
    registrationNo: "000-00-00000",
    mailOrderNo: "0000-Example-0000",
    hostingProvider: "Example Hosting Inc.",
  })
  // 하드코딩 금지: 코드·문구에 사업자 값이 없다(환경 변수 이름과 라벨뿐)
  for (const f of ["lib/footer-business.ts", "components/product/product-footer.tsx", "content/copy.shell.en.ts"]) {
    assert.doesNotMatch(read(f), /LF_(BUSINESS|HOSTING|MAIL)[A-Z_]*\s*[:=]\s*["'][^"']+["']/, `${f}: 환경 변수에 값을 대입하지 않는다`)
    assert.doesNotMatch(read(f), /\b\d{3}-\d{2}-\d{5}\b/, `${f}: 사업자등록번호 모양의 값이 없다`)
  }
  // 바닥글은 서버 설정을 읽어 블록을 서버에서 바로 그린다(v0.0.11 — 클라이언트 껍데기 product-footer-client.tsx 는 걷었다)
  const footer = read("components/product/product-footer.tsx")
  // LFOBS: 분석이 꺼진 제품은 「Cookie settings」 링크를 뺀 같은 설정(copy)을 넘긴다 — 켜져 있으면 footerCopy 그대로다
  assert.match(footer, /<FooterProductLegal copy=\{copy\} business=\{footerBusiness\(\)\} \/>/)
  assert.match(footer, /analyticsEnabled\(process\.env\.LF_MODE, process\.env\.POSTHOG_HOST, process\.env\.POSTHOG_PROJECT_KEY\) \? footerCopy : withoutCookies/)
  assert.doesNotMatch(footer, /^"use client"/, "바닥글 조립은 서버 컴포넌트다")
  assert.ok(!existsSync(join(T, "components/product/product-footer-client.tsx")), "클라이언트 껍데기는 지웠다")
  // v0.0.11: 블록이 값으로 가져오는 consentOpenAttrs 의 출처 파일이 "use client" 밖으로 나왔다 — 서버 컴포넌트가 가져와도 속성이 붙는다(껍데기는 이제 필요 없다)
  assert.doesNotMatch(read("components/blocks/_shared/consent-open-attrs.tsx"), /^"use client"/)
  assert.match(read("components/blocks/footer/product-legal.tsx"), /import \{ consentOpenAttrs \} from "\.\.\/_shared\/consent-open-attrs"/)
  assert.doesNotMatch(read("components/blocks/footer/product-legal.tsx"), /^"use client"/, "블록은 서버 부품이다")
})

test("K03·K04 바닥글: 약관·개인정보·환불·문의 링크와 「Cookie settings」가 있고, 쿠키 띠에는 항목별 설정 문구가 있다", async () => {
  const { footerCopy, consentPreferencesCopy, navCopy, errorScreenCopy, notFoundCopy, loadingCopy } = await import("../content/copy.shell.en.ts")
  assert.deepEqual(Object.keys(footerCopy.links).sort(), ["contact", "privacy", "refund", "terms"])
  assert.deepEqual(
    ["terms", "privacy", "refund", "contact"].map((k) => footerCopy.links[k].href),
    ["/terms", "/privacy", "/refund", "/contact"],
  )
  assert.equal(footerCopy.cookieSettings.label, "Cookie settings")
  assert.equal(footerCopy.cookieSettings.href, "/privacy", "쿠키 띠·JS 가 없을 때 가는 곳 — 처리방침의 쿠키 항목")
  assert.equal(footerCopy.navLabel, "Help and legal", "랜드마크 이름이 예전 바닥글과 같다")
  // 쿠키 환경설정(K04): 필수·분석·마케팅 + 저장·모두 거부·모두 허용(대등)
  assert.deepEqual(Object.keys(consentPreferencesCopy.categories).sort(), ["analytics", "marketing"])
  for (const k of ["save", "decline", "accept", "marker"]) assert.ok(consentPreferencesCopy[k], k)
  // 띠가 이 문구를 받는다 — 받으면 「Choose by category」가 대화상자 단추가 된다
  const blocks = read("components/product/product-blocks.tsx")
  assert.match(blocks, /copy=\{\{ \.\.\.consentCopy, preferences: consentPreferencesCopy \}\}/)
  // 로그인 전·후 머리 문구(N10)와 화면 글 한 벌이 모두 영어다(한글 낱말 없음)
  for (const o of [navCopy, footerCopy, errorScreenCopy, notFoundCopy, loadingCopy, consentPreferencesCopy]) assert.doesNotMatch(JSON.stringify(o), /[가-힣]/)
})

test("N10·J01 위 띠: 서버가 읽은 세션으로 nav/account-bar 를 그리고, 로그아웃은 서버 액션 폼이며, 건너뛰기 링크의 목적지 main#main 이 있다", () => {
  const h = read("components/product/product-header.tsx")
  assert.match(h, /await currentSession\(\)/)
  assert.match(h, /s \? \{ status: "signed-in", name: s\.name, email: s\.email \} : \{ status: "signed-out" \}/)
  assert.match(h, /<NavAccountBar copy=\{navCopy\} session=\{session\} signOutAction=\{signOutFromHeader\} className="pt-\[env\(safe-area-inset-top\)\]" \/>/, "노치 안쪽 여백(F1)")
  // 블록 뿌리가 붙는 띠다(F1): sticky·top-0·불투명 배경·data-sticky-nav — scroll-padding 규칙이 이 표지를 본다
  const tag = /<header [^>]*>/.exec(read("components/blocks/nav/account-bar.tsx"))[0]
  for (const re of [/\bsticky\b/, /\btop-0\b/, /\bbg-background\b/, /data-sticky-nav/]) assert.match(tag, re, String(re))
  assert.doesNotMatch(tag, /\bfixed\b/)
  assert.match(h, /<SiteShellSkipLink /)
  assert.match(h, /<SessionSync \/>/)
  // 로그아웃: 포트의 signOut 을 부른 뒤 시작 쪽으로 — B03 표지를 단다
  const a = read("app/actions/shell.ts")
  assert.match(a, /^"use server"/)
  assert.match(a, /await signOut\(\)\.catch\(\(\) => undefined\)\s*redirect\(WELCOME_HREF\.signedout\)/)
  // 틀: 제품·법정 쪽 모두 같은 틀 — main#main(tabIndex -1)·건너뛰기·바닥글·읽기 오류의 로그인 슬롯
  const shell = read("components/product/product-shell.tsx")
  assert.match(shell, /<ProductHeader \/>/)
  assert.match(shell, /<main id="main" tabIndex=\{-1\}/)
  assert.match(shell, /<ReadErrorSignIn>\{children\}<\/ReadErrorSignIn>/)
  // 짧은 쪽에서도 바닥글이 문서 맨 아래에 놓인다(쿠키 띠가 바닥글을 가리지 않게 — 화면 관문 F3 의 남은 쪽): min-h-dvh 세로 칸 + main flex-1
  assert.match(shell, /<div className="flex min-h-dvh flex-col">/)
  assert.match(shell, /<main id="main" tabIndex=\{-1\} className="[^"]*\bflex-1\b/)
  assert.match(read("app/not-found.tsx"), /<div className="flex min-h-dvh flex-col">[\s\S]*<main id="main" tabIndex=\{-1\} className="flex-1/)
  assert.match(shell, /<ProductFooter \/>/)
  assert.doesNotMatch(shell, /<footer/, "바닥글은 블록이다(손으로 쓴 footer 가 없다)")
  // 404 도 같은 머리·바닥글
  const nf = read("app/not-found.tsx")
  assert.match(nf, /<ProductHeader \/>/)
  assert.match(nf, /<ProductFooter \/>/)
  assert.match(nf, /<StateScreenNotFound copy=\{notFoundCopy\} headingLevel=\{1\} \/>/)
})

test("위 띠의 세션 다시 읽기: 쪽을 옮길 때와 로그인·가입 신호 때 서버가 다시 그린다(router.refresh) · 띠 높이를 --site-header-h 로 알린다", () => {
  const s = read("components/product/session-sync.tsx")
  assert.match(s, /^"use client"/)
  assert.match(s, /\[pathname, router\]/, "쪽을 옮길 때 다시 읽는다")
  assert.match(s, /addEventListener\(SESSION_CHANGED_EVENT, ask\)/, "이 화면 안에서 끝난 로그인·가입 신호")
  assert.match(s, /router\.refresh\(\)/)
  assert.match(s, /first\.current/, "처음 그릴 때는 다시 읽지 않는다(서버가 방금 읽었다)")
  assert.match(s, /querySelector<HTMLElement>\("\[data-sticky-nav\]"\)/)
  assert.match(s, /--site-header-h/)
  assert.match(s, /new ResizeObserver\(set\)/)
})

test("H01·H02·H04 오류·로딩·404 화면은 web-factory 블록이다 — 엄격 CSP 에 안전하고(style 속성 없음) 오류 번호·지원 경로가 있다", () => {
  const view = read("components/product/error-screen.tsx")
  assert.match(view, /<StateScreenErrorRetry copy=\{errorScreenCopy\[kind\]\} onRetry=\{onRetry\}/)
  assert.match(view, /errorCode=\{digest \? "server_error" : "client_error"\}/)
  assert.match(view, /requestId=\{requestId\}/)
  assert.match(view, /headingLevel=\{1\}/, "쪽에 다른 h1 이 없다")
  assert.match(view, /<main id="main"/, "오류 화면에도 본문 랜드마크가 있다")
  assert.match(read("app/loading.tsx"), /<StateScreenLoading copy=\{loadingCopy\} \/>/)
  for (const f of ["app/error.tsx", "app/global-error.tsx", "app/loading.tsx", "app/not-found.tsx", "components/product/error-screen.tsx", "components/product/product-header.tsx", "components/product/product-footer.tsx", "components/product/product-shell.tsx"]) {
    assert.ok(!/\sstyle=/.test(read(f)), `${f}: style 속성은 엄격 CSP(style-src)에 막힌다`)
  }
  // 문구: 지원 경로(문의)와 오류 번호 라벨
  const c = read("content/copy.shell.en.ts")
  assert.match(c, /requestIdLabel: "Error number:"/)
  assert.match(c, /support: \{ label: "Contact us", href: "\/contact" \}/)
})

test("B04 읽기 오류의 로그인 행동: ReadErrorProvider 로 쪽 위에서 한 번 정하고, 구독 읽기가 계약 이름 signInRequired 를 돌려준다", async () => {
  const r = read("components/product/read-error-sign-in.tsx")
  assert.match(r, /<ReadErrorProvider signIn=\{signIn\}>\{children\}<\/ReadErrorProvider>/)
  assert.match(r, /signInHref\(pathname\)/, "지금 쪽을 ?next= 로 싣는다")
  assert.match(r, /label: "Sign in"/)
  // LF 기계 값은 sign_in_required 그대로고, 블록이 읽는 구독 읽기에서만 계약 이름으로 바꾼다
  const p = read("app/actions/product.ts")
  assert.match(p, /import \{ forReadBlock \} from "@\/lib\/read-block-result"/)
  assert.match(p, /export const subscription = async \(\) => forReadBlock\(coded\(/)
  const { forReadBlock } = await import("../lib/read-block-result.ts")
  assert.deepEqual(forReadBlock({ ok: false, code: "sign_in_required", formError: "x" }), { ok: false, code: "signInRequired", formError: "x" })
  assert.deepEqual(forReadBlock({ ok: false, code: "action_failed" }), { ok: false, code: "action_failed" }, "다른 실패는 그대로")
  assert.deepEqual(forReadBlock({ ok: true, data: 1 }), { ok: true, data: 1 }, "성공은 그대로")
  // 블록이 실제로 이 이름을 로그인 필요로 읽는다(설치본)
  assert.match(read("components/blocks/_shared/port-read.tsx"), /const SIGN_IN_CODES = \["signInRequired", /)
  // 위쪽 쪽(서버 안내)과 같은 돌아올 곳 규칙을 쓴다
  assert.match(r, /from "@\/lib\/auth-next"/)
})

test("F3 쿠키 띠: 문서 맨 아래 여백은 web-factory 의 bottom-bar-space pad 가 맡는다(v0.0.11 이 동작 줄이기 계산을 고쳤다) — 제품 쪽 body padding-bottom 규칙은 걷었다", () => {
  const css = read("app/globals.css")
  assert.doesNotMatch(css, /html:has\(\[data-consent-banner\]\) body/, "이중 여백을 만드는 제품 쪽 규칙은 없다")
  assert.doesNotMatch(css, /padding-bottom: var\(--bottom-bar-height/)
  // 속성은 떠 있는 띠에만 있다(결정한 뒤의 접힌 구획에는 없다) — 규칙이 결정 뒤에는 풀린다
  const banner = read("components/blocks/consent/bottom-banner.tsx")
  assert.equal([...banner.matchAll(/data-consent-banner=""/g)].length, 1)
  assert.match(banner, /BOTTOM_BAR_VAR|useBottomBarSpace\(decided \? none : ref, \{ pad: true \}\)/)
  assert.match(read("components/blocks/_shared/bottom-bar-space.tsx"), /export const BOTTOM_BAR_VAR = "--bottom-bar-height"/)
})

test("설치: 쉘 블록 5개가 BLOCK_ITEMS·잠금에 있고 설치 파일이 있다", async () => {
  const { BLOCK_ITEMS } = await import("../../scripts/template-sync.mjs")
  const items = ["block-footer-product-legal", "block-nav-account-bar", "block-state-screen-error-retry", "block-state-screen-not-found", "block-state-screen-loading"]
  for (const i of items) assert.ok(BLOCK_ITEMS.includes(i), i)
  const lock = JSON.parse(read("template.lock.json"))
  for (const i of items) assert.ok(lock.blocks.items.includes(i), `잠금 목록: ${i}`)
  for (const f of ["footer/product-legal", "nav/account-bar", "state-screen/error-retry", "state-screen/not-found", "state-screen/loading"]) assert.ok(existsSync(join(T, `components/blocks/${f}.tsx`)), f)
  // 손으로 쓴 옛 머리는 지웠다
  assert.ok(!existsSync(join(T, "components/product/site-header.tsx")))
})
