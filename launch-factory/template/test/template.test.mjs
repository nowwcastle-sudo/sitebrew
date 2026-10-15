// 템플릿 정적 시험(v0 Task 10) — 빌드·서버 없이 돈다. 빌드·기동 시험은 verify.heavy.mjs(`npm run template:verify`).
// 여기서 잠그는 것: 함수 지역(icn1)·proxy 의 nonce 와 보안 헤더·환경 검사가 빠진 이름을 모두 알림(Review Focus 5)·블록 쪽 코드가 모드를 모름·
// track 이 withAttribution 으로 감싸짐·법정 경로 자리·잠금(template.lock.json)과 디스크 일치.
import assert from "node:assert/strict"
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { registerHooks } from "node:module"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { check } from "../../scripts/template-sync.mjs"

// Node 의 ESM 은 next/server 를 확장자 없이 못 푼다(Next 번들러는 푼다) — 시험에서만 next/server.js 로 바꿔 proxy.ts 를 그대로 불러온다
registerHooks({ resolve: (spec, ctx, next) => next(spec === "next/server" ? "next/server.js" : spec, ctx) })

const T = fileURLToPath(new URL("..", import.meta.url))
const read = (p) => readFileSync(join(T, p), "utf8")
const walk = (dir) => readdirSync(join(T, dir)).flatMap((e) => (statSync(join(T, dir, e)).isDirectory() ? walk(join(dir, e)) : [join(dir, e).replaceAll("\\", "/")]))

test("vercel.json: 함수 지역은 서울(icn1) 하나이고, Cron 경로마다 경로 파일이 있다", () => {
  const v = JSON.parse(read("vercel.json"))
  assert.deepEqual(v.regions, ["icn1"])
  assert.ok(v.crons.length >= 1)
  for (const c of v.crons) assert.ok(existsSync(join(T, "app", ...c.path.split("/").filter(Boolean), "route.ts")), `${c.path} 의 route.ts 가 없다`)
})

test("proxy: 요청마다 새 nonce 를 CSP 와 요청 머리 x-nonce 에 싣고 보안 머리를 붙인다", async () => {
  const { proxy } = await import("../proxy.ts")
  const { NextRequest } = await import("next/server")
  const seen = new Set()
  for (let i = 0; i < 3; i++) {
    const res = proxy(new NextRequest("http://localhost:3000/sign-in"))
    const csp = res.headers.get("content-security-policy") ?? ""
    const nonce = /'nonce-([^']+)'/.exec(csp)?.[1]
    assert.ok(nonce, "CSP 에 nonce 가 없다")
    assert.match(csp, /script-src [^;]*'strict-dynamic'/)
    assert.doesNotMatch(csp, /'unsafe-inline'/, "unsafe-inline 은 두지 않는다")
    assert.equal(res.headers.get("x-middleware-request-x-nonce"), nonce, "요청 머리 x-nonce 가 CSP 의 nonce 와 다르다")
    assert.equal(res.headers.get("x-middleware-request-content-security-policy"), csp, "요청 머리에도 CSP 를 실어야 Next 가 자기 스크립트에 nonce 를 붙인다")
    assert.ok(res.headers.get("strict-transport-security") && res.headers.get("x-content-type-options"), "보안 머리가 빠졌다")
    assert.match(csp, /style-src [^;]*'unsafe-hashes' 'sha256-[^']+'/, "서버가 그리는 style 속성은 해시로 연다(nonce 는 속성에 안 된다 — D14)")
    assert.match(csp, /posthog\.com/, "PostHog 출처가 connect-src 에 있어야 한다(D27)")
    seen.add(nonce)
  }
  assert.equal(seen.size, 3, "nonce 가 요청마다 달라야 한다")
})

test("layout: proxy 의 x-nonce 를 MotionBoot 에 넘긴다", () => {
  const layout = read("app/layout.tsx")
  assert.match(layout, /\(await headers\(\)\)\.get\("x-nonce"\)/)
  assert.match(layout, /<MotionBoot nonce=\{nonce\} \/>/)
})

test("환경 검사: live 인데 키가 없으면 빠진 이름을 모두 한 번에 알린다(Review Focus 5)", async () => {
  const { templateEnv, TEMPLATE_LIVE_NAMES } = await import("../lib/live-env.ts")
  const { PROVIDER_SECRET_NAMES, EnvError } = await import("@launch-factory/env")
  assert.throws(
    () => templateEnv({ LF_MODE: "live" }),
    (e) => {
      assert.ok(e instanceof EnvError)
      for (const name of [...PROVIDER_SECRET_NAMES, ...TEMPLATE_LIVE_NAMES]) assert.ok(e.missing.includes(name), `${name} 이 알림에 없다`)
      assert.equal(e.missing.length, PROVIDER_SECRET_NAMES.length + TEMPLATE_LIVE_NAMES.length, "빠진 이름이 더도 덜도 아니어야 한다")
      return true
    },
  )
  // mock 은 키 없이 켜진다. LF_MODE 자체는 늘 필수다
  assert.equal(templateEnv({ LF_MODE: "mock" }).LF_MODE, "mock")
  assert.throws(() => templateEnv({}), (e) => e instanceof EnvError && e.missing.includes("LF_MODE"))
  // 값은 오류에 싣지 않는다
  assert.throws(
    () => templateEnv({ LF_MODE: "live", DATABASE_URL: "postgres://user:secret-value-1@h/db" }),
    (e) => !String(e.message).includes("secret-value-1"),
  )
})

test("LFENV 환경 검사: INQUIRY_OWNER_EMAIL 이 없어도 live 가 켜진다(문의만 꺼진다) — 있으면 형식을 보고, 틀리면 켜질 때 멈춘다", async () => {
  const { templateEnv, TEMPLATE_LIVE_NAMES, TEMPLATE_OPTIONAL_NAMES } = await import("../lib/live-env.ts")
  const { EnvError } = await import("@launch-factory/env")
  // 시험용 값만 — 형식(길이·주소 모양)만 맞춘다. 실제 키가 아니다
  const live = {
    LF_MODE: "live",
    DATABASE_URL: "postgres://u:p@h/db",
    BETTER_AUTH_SECRET: "a".repeat(32),
    PADDLE_API_KEY: "k",
    PADDLE_WEBHOOK_SECRET: "k",
    RESEND_API_KEY: "k",
    SENTRY_DSN: "https://x@sentry.example.test/1",
    TURNSTILE_SECRET_KEY: "k",
    EMAIL_FROM: "Name <hello@example.test>",
    NEXT_PUBLIC_APP_URL: "https://preview.example.test",
    CRON_SECRET: "c".repeat(16),
    SUBJECT_REF_KEY: "s".repeat(32),
    TURNSTILE_SITE_KEY: "site",
  }
  assert.deepEqual(TEMPLATE_OPTIONAL_NAMES, ["INQUIRY_OWNER_EMAIL", "POSTHOG_HOST", "POSTHOG_PROJECT_KEY", "SENTRY_DSN"], "문의 메일(LFENV)·분석 호스트·Sentry DSN(LFOBS)·분석 프로젝트 키(LFOBS2) 는 선택이다")
  assert.ok(!TEMPLATE_LIVE_NAMES.includes("INQUIRY_OWNER_EMAIL"), "필수 목록에 없다 — 없으면 사이트 전체가 500 이던 사고(LFENV)")
  // 재현: 다른 이름이 모두 있고 이 이름만 없는 live. 고치기 전에는 EnvError(없음 1개: INQUIRY_OWNER_EMAIL)로 던졌다
  assert.doesNotThrow(() => templateEnv(live))
  assert.doesNotThrow(() => templateEnv({ ...live, INQUIRY_OWNER_EMAIL: "" }), "빈 값은 없는 값")
  // 대조군: 있으면 읽힌다
  assert.equal(templateEnv({ ...live, INQUIRY_OWNER_EMAIL: "ops@example.test" }).INQUIRY_OWNER_EMAIL, "ops@example.test")
  // 틀린 값은 여전히 켜질 때 멈춘다(이름만 알린다)
  assert.throws(
    () => templateEnv({ ...live, INQUIRY_OWNER_EMAIL: "not-an-email" }),
    (e) => e instanceof EnvError && e.invalid.includes("INQUIRY_OWNER_EMAIL") && !String(e.message).includes("not-an-email"),
  )
  // 필수 이름이 빠지면 여전히 켜지지 않는다(이 변경이 다른 이름의 보호를 풀지 않았다)
  assert.throws(() => templateEnv({ ...live, CRON_SECRET: undefined }), (e) => e instanceof EnvError && e.missing.length === 1 && e.missing[0] === "CRON_SECRET")
})

test("블록 쪽 코드는 모드를 모른다:제품 페이지·잎에 공급자·LF_MODE 참조가 없다(포트는 서버 액션으로만 온다)", () => {
  const files = [...walk("app/(product)"), "components/product/product-blocks.tsx"]
  assert.ok(files.length >= 6)
  for (const f of files) {
    const src = read(f)
    assert.doesNotMatch(src, /LF_MODE|productMode|adapter-mock|@launch-factory\/|paddle|better-auth|resend(?!After|_)|posthog/i, `${f} 가 모드나 공급자를 안다`) // resendAfter 는 이메일 확인 블록의 속성 이름이지 공급자(Resend)가 아니다(P1AB)
  }
  // 어댑터 고르기는 lib/ports.ts 한 곳: mock 은 web-factory 목, live 는 ports.live(동적 import)
  const ports = read("lib/ports.ts")
  assert.match(ports, /components\/contract\/adapter-mock/)
  assert.match(ports, /import\("@\/lib\/ports\.live"\)/)
  assert.match(read("lib/ports.live.ts"), /@launch-factory\/auth/)
})

test("track 은 withAttribution 으로 감싼 것만 블록에 간다(J2)", () => {
  const analytics = read("components/product/analytics.tsx")
  assert.match(analytics, /withAttribution\(port, JSON\.parse\(key\) as Attribution\)\.track/)
  const blocks = read("components/product/product-blocks.tsx")
  const uses = [...blocks.matchAll(/track=\{(\w+)\}/g)].map((m) => m[1])
  assert.ok(uses.length >= 5, "track 을 받는 블록이 5개 이상이어야 한다")
  assert.deepEqual([...new Set(uses)], ["track"], "블록에는 useBlockTrack 이 만든 track 변수만 넘긴다")
  assert.equal([...blocks.matchAll(/const track = useBlockTrack\(tag\("/g)].length, uses.length, "track 을 넘기는 블록마다 useBlockTrack(tag(...)) 이 있어야 한다")
  assert.doesNotMatch(blocks, /analytics\.track|\.track\b(?!\})/, "원래 포트의 track 을 그대로 넘기지 않는다")
})

test("법정 경로 /privacy /terms /refund 는 찍어내기 결과를 받는 자리 JSON 을 그린다, 처리방침에는 국외 이전 고지가 붙는다", () => {
  for (const slug of ["privacy", "terms", "refund"]) {
    assert.ok(existsSync(join(T, "app", "(legal)", slug, "page.tsx")), `/${slug} 쪽이 없다`)
    const doc = JSON.parse(read(`content/legal/${slug}.json`))
    assert.ok(["placeholder", "draft", "final"].includes(doc.status) && typeof doc.contact === "string" && Array.isArray(doc.clauses), `${slug}.json 모양`)
  }
  assert.match(read("components/product/legal-page.tsx"), /slug === "privacy" \? <OverseasNotice/)
})

test("제품 화면: 로그인·가입·요금·업그레이드·결제 관리 쪽이 실제 블록을 쓴다", () => {
  const expected = {
    "app/(product)/sign-in/page.tsx": "SignInBlock",
    "app/(product)/sign-up/page.tsx": "SignUpBlock",
    "app/(product)/pricing/page.tsx": "PricingBlock",
    "app/(product)/upgrade/page.tsx": "UpgradeBlock",
    "app/(product)/account/billing/page.tsx": "BillingBlock",
  }
  for (const [file, name] of Object.entries(expected)) assert.match(read(file), new RegExp(`<${name}\\b`), `${file}`)
  const blocks = read("components/product/product-blocks.tsx")
  for (const b of ["AuthSignIn", "AuthSignUpConsents", "PricingThreeTierCards", "PaywallUpgradeModal", "AccountBillingManage", "ConsentBottomBanner"]) assert.match(blocks, new RegExp(`<${b}\\b`))
  // 결제·가입 블록은 멱등 키 숨은 입력(FormKeys)으로 감싼다(계약 판 2 — 키는 조립하는 쪽이 만든다)
  // 여섯 + 가격 변경 동의 래퍼(RenewalConsentBlock, LFUX2 F04) + 새 비밀번호 래퍼(NewPasswordBlock)·결제 실패 띠 래퍼(PaymentFailedBlock, LFADB)
  assert.equal([...blocks.matchAll(/^[ ]+<FormKeys>$/gm)].length, 9)
})

test("소셜 로그인 배선: auth.ts 는 키가 둘 다 있는 공급자만 createAuth 에 넘기고, 어댑터의 실패 경로는 /sign-in 이며, 로그인 화면은 그 오류를 안내한다(주소의 글자를 싣지 않는다)", () => {
  const auth = read("lib/launch/auth.ts")
  assert.match(auth, /socialsFromEnv\(socialEnv\)/)
  assert.match(auth, /readSecrets\(SOCIAL_ENV_NAMES\)/)
  assert.match(auth, /\n\s+socials,\n\s+env: socialEnv,/)
  assert.match(auth, /errorCallbackURL: SOCIAL_ERROR_PATH/)
  assert.match(auth, /SOCIAL_ERROR_PATH = "\/sign-in"/)
  assert.match(read("app/(product)/sign-in/page.tsx"), /<SocialErrorNotice code=\{error\} \/>/)
  const notice = read("components/product/social-error.tsx")
  for (const code of ["signup_disabled", "consent_required", "account_not_linked", "access_denied", "unable_to_link_account", "email_not_found", "email_not_verified", "state_mismatch", "state_not_found", "invalid_code", "unable_to_get_user_info", "oauth_provider_not_found", "account_already_linked_to_different_user", "email_does_not_match"]) assert.ok(notice.includes(code), code)
  // B05: account_not_linked 에는 비밀번호 찾기 링크, 안내는 포커스를 받고(tabIndex -1) 읽은 뒤 주소의 ?error= 를 지운다
  assert.match(notice, /account_not_linked: \{[^}]*links: \[RESET\]/s)
  assert.match(notice, /tabIndex=\{-1\}/)
  const effects = read("components/product/social-error-effects.tsx")
  assert.match(effects, /\.focus\(/)
  assert.match(effects, /searchParams\.delete\("error"\)/)
  assert.match(effects, /history\.replaceState/)
  // 모르는 코드는 일반 문구 — code 값을 그대로 화면에 내보내는 줄이 없다
  assert.ok(!/\{code\}/.test(notice.replace("data-social-error={known ? code.toLowerCase() : \"other\"}", "")))
})

test("템플릿 잠금: 가져온 파일이 잠금과 같고, 기능 번들이 지금 registry/dist 와 같다", () => {
  const r = check()
  assert.deepEqual(r.problems, [])
  assert.match(r.blocks ?? "", /^906a788/, "web-factory 는 태그 v0.1.0(커밋 906a788)에 고정한다 — 다음 태그로 올릴 때만 바꾼다(대장 D10)")
})

// ── UXOK: 가입·로그인 성공을 알려 준다 ─────────────────────────────────────────

test("UXOK 표지 읽기: signup·signin·verified 만 보이고, 틀린 확인 링크(error=)는 성공 글이 아니라 실패 글이다 · 표지를 지운 주소는 다른 쿼리·해시를 지킨다", async () => {
  const { welcomeKind, withoutWelcome, WELCOME_HREF, WELCOME_PARAM } = await import("../lib/welcome.ts")
  const of = (q) => welcomeKind(new URLSearchParams(q))
  assert.equal(of("welcome=signup"), "signup")
  assert.equal(of("welcome=signin"), "signin")
  assert.equal(of("welcome=verified"), "verified")
  assert.equal(of("welcome=verified&error=invalid_token"), "failed")
  assert.equal(of("welcome=signup&error=x"), "signup", "error 는 확인 링크에만 뜻이 있다")
  // 음성: 표지가 없거나 모르는 값이면 아무것도 보이지 않는다(주소의 글자를 화면에 싣지도 않는다 — 종류만 돌려준다)
  for (const q of ["", "error=invalid_token", "welcome=", "welcome=<script>", "welcome=failed", "welcome=SIGNUP"]) assert.equal(of(q), null, q)
  // 두 소셜 표지의 주소는 이름·값 규칙과 같다
  assert.equal(WELCOME_HREF.signup, `/?${WELCOME_PARAM}=signup`)
  assert.equal(WELCOME_HREF.signin, `/?${WELCOME_PARAM}=signin`)
  // 표지를 지운 경로(새로고침해도 다시 안 뜬다)
  assert.equal(withoutWelcome("http://localhost:3000/?welcome=signup", "signup"), "/")
  assert.equal(withoutWelcome("http://localhost:3000/pricing?plan=pro&welcome=verified#plans", "verified"), "/pricing?plan=pro#plans")
  assert.equal(withoutWelcome("http://localhost:3000/?welcome=verified&error=invalid_token", "failed"), "/")
  assert.equal(withoutWelcome("http://localhost:3000/?error=keep&welcome=signin", "signin"), "/?error=keep")
})

test("UXOK 배선: 소셜만 표지를 달고(이메일은 제 화면의 완료 글) · 확인 메일 링크는 표지로 닿고 · 도착 화면은 제품 틀 안에서 한 번 읽는다 · 이메일 가입 직후 확인 메일 안내와 다시 보내기가 있다", () => {
  const blocks = read("components/product/product-blocks.tsx")
  // 가입·로그인: 이메일(password)에는 redirectTo 를 달지 않는다(달면 쪽 이동이 먼저 일어나 완료 글이 안 보인다)
  assert.match(blocks, /input\.method === "password" \? input : \{ \.\.\.input, redirectTo: next \? withWelcomeMark\(next, "signin"\) : WELCOME_HREF\.signin \}/)
  assert.match(blocks, /input\.method === "password" \? prefs : \{ \.\.\.prefs, redirectTo: WELCOME_HREF\.signup \}/)
  // 이메일 가입이 끝나면 방금 적은 주소로 안내한다
  assert.match(blocks, /r\.ok && input\.method === "password" && typeof input\.email === "string"\) setEmailed\(input\.email\.trim\(\)\)/)
  assert.match(blocks, /<VerifyEmailNote email=\{emailed\} again=/)
  assert.match(read("app/(product)/sign-up/page.tsx"), /sendAgain=\{sendVerificationEmail\}/)
  assert.match(read("app/actions/product.ts"), /export const sendVerificationEmail/)
  assert.match(read("lib/ports.live.ts"), /sendVerificationEmail: \(input\) => actions\.sendVerificationEmail\(input\)/)
  // 확인 메일 링크의 도착지는 안내가 읽는 표지와 같다(한 곳에서 어긋나면 링크를 눌러도 안내가 안 뜬다)
  const auth = read("lib/launch/auth.ts")
  assert.match(auth, /export const EMAIL_VERIFIED_PATH = "\/\?welcome=verified"/)
  assert.match(auth, /emailVerifiedPath: EMAIL_VERIFIED_PATH/)
  // 도착 화면: 시작 쪽(/)은 제품 틀(위 띠 = 로그인 상태, 안내 자리) 안에 있다 — app/page.tsx 가 아니라 (product)/page.tsx
  assert.ok(!existsSync(join(T, "app", "page.tsx")), "app/page.tsx 가 남아 있으면 위 띠·안내가 없는 시작 쪽이 된다")
  assert.ok(existsSync(join(T, "app", "(product)", "page.tsx")))
  const layout = read("components/product/product-shell.tsx")
  assert.match(layout, /<Suspense fallback=\{null\}>\s*<WelcomeNotice signedIn=\{!!s\} emailVerified=\{s\?\.emailVerified\} again=\{sendVerificationEmail\} \/>\s*<\/Suspense>/)
  // 안내: 글로 남는다(role=status — 사라지는 토스트가 아니다) · 실패는 alert · 다음 행동 링크 하나 · 주소에서 표지를 지운다
  const notice = read("components/product/welcome-notice.tsx")
  assert.match(notice, /role=\{failed && view\.copy !== "alreadyVerified" \? "alert" : "status"\}/) // P1AB: 틀린·만료 링크는 alert, 이미 확인된 사람의 「이미 확인됨」은 status
  assert.match(notice, /history\.replaceState\(window\.history\.state, "", withoutWelcome\(window\.location\.href, kind\)\)/)
  assert.match(notice, /<Link href=\{c\.href\}/)
  assert.match(read("components/product/verify-email-note.tsx"), /role="status"/)
  // 이 화면 안에서 끝나는 이메일 로그인·가입: 위 띠가 「Sign in」으로 남지 않게 성공 때 알리고, 위 띠는 그 신호에도 세션을 다시 묻는다
  assert.equal([...blocks.matchAll(/announceSessionChanged\(\)\n/g)].length, 2, "로그인·가입 둘 다 알린다")
  assert.match(read("components/product/session-sync.tsx"), /addEventListener\(SESSION_CHANGED_EVENT, ask\)/)
})

test("UXOK 문구: 안내마다 제목·본문·다음 행동 하나가 있고 영어 화면 문구 판(copy.en.ts)에서 온다", () => {
  const src = read("content/copy.en.ts")
  assert.match(src, /export const welcomeCopy = \{/)
  assert.match(src, /export const verifyEmailCopy = \{/)
  for (const k of ["signup", "signin", "verified", "verifiedSignedOut", "signedout", "failed"]) assert.match(src, new RegExp(`\\n  ${k}: \\{`), `welcomeCopy.${k}`)
  assert.match(src, /body: "Open the link in the email we sent to \{email\} to confirm your address\."/)
  assert.match(src, /title: "You're all set"/)
  // 한국어가 영어 화면에 새지 않는다(주석을 뺀 문구 줄)
  const added = src.slice(src.indexOf("export const welcomeCopy"))
  assert.doesNotMatch(added.replace(/\/\/.*$|\/\*[\s\S]*?\*\//gm, ""), /[가-힣]/)
})
