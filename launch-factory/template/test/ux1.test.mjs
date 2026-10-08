// LFUX1(제품 화면 UX 감사 적용: A08·B01·B02·B03·B04·F01) 정적·단위 시험 — 빌드·서버 없이 돈다.
// 화면이 실제로 그려지는 것은 docs/qa/ux-audit/apply-lfux1.md 의 dev 서버 확인(HTML 응답)으로 본다.
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

const T = fileURLToPath(new URL("..", import.meta.url))
const read = (p) => readFileSync(join(T, p), "utf8")

test("B04 safeNext: 이 앱 안의 상대 경로(+쿼리·해시)만 받는다 — 남의 주소·스킴·//host·역슬래시·제어 문자·로그인 고리·너무 긴 값은 버린다", async () => {
  const { safeNext } = await import("../lib/auth-next.ts")
  // 양성 대조: 정상 경로는 그대로(쿼리·해시 포함)
  for (const ok of ["/account/billing", "/account/cancel", "/upgrade", "/billing/return?_ptxn=txn_01abcdefghijklmnopqrstuvwx", "/upgrade?plan=pro#plans", "/"]) assert.equal(safeNext(ok), ok, ok)
  assert.equal(safeNext(["/account/billing", "https://evil.example"]), "/account/billing", "배열이면 첫 값")
  // 음성
  const bad = [
    "https://evil.example/account",
    "http://evil.example",
    "//evil.example",
    "///evil.example",
    "/\\evil.example",
    "\\\\evil.example",
    "javascript:alert(1)",
    "data:text/html,x",
    "evil.example/path",
    "account/billing",
    "/\t/evil.example",
    "/\n/evil.example",
    "/ok\u0000",
    "",
    null,
    undefined,
    42,
    {},
    "/sign-in",
    "/sign-in?next=/account/billing",
    "/sign-up/",
    "/forgot-password",
    "/reset-password?token=x",
    "/" + "a".repeat(600),
  ]
  for (const b of bad) assert.equal(safeNext(b), null, JSON.stringify(b))
})

test("B04 signInHref: 안전한 돌아올 곳만 ?next= 에 싣고(인코딩) 아니면 그냥 /sign-in · withWelcomeMark 는 쿼리가 있어도 표지 하나만 붙인다", async () => {
  const { signInHref, withWelcomeMark } = await import("../lib/auth-next.ts")
  assert.equal(signInHref("/account/billing"), "/sign-in?next=%2Faccount%2Fbilling")
  assert.equal(signInHref("/billing/return?_ptxn=txn_1"), "/sign-in?next=%2Fbilling%2Freturn%3F_ptxn%3Dtxn_1")
  assert.equal(signInHref("https://evil.example"), "/sign-in")
  assert.equal(signInHref(null), "/sign-in")
  assert.equal(signInHref("/sign-in"), "/sign-in")
  assert.equal(withWelcomeMark("/account/billing", "signin"), "/account/billing?welcome=signin")
  assert.equal(withWelcomeMark("/billing/return?_ptxn=txn_1", "signin"), "/billing/return?_ptxn=txn_1&welcome=signin")
  assert.equal(withWelcomeMark("/x?welcome=old", "signin"), "/x?welcome=signin")
  // 확인 링크를 로그아웃 상태로 연 사람의 「Sign in」 링크는 계정으로 돌아오는 같은 모양이다(A08)
  const { welcomeCopy } = await import("../content/copy.en.ts")
  assert.equal(welcomeCopy.verifiedSignedOut.href, signInHref("/account/billing"))
})

test("B04 보호된 쪽: /account/billing·/account/cancel·/upgrade·/billing/return 은 세션이 없으면 블록 대신 로그인 안내(돌아올 곳 포함)를 그린다", () => {
  const pages = {
    "app/(product)/account/billing/page.tsx": 'next="/account/billing"',
    "app/(product)/account/cancel/page.tsx": 'next="/account/cancel"',
    // LFADB E01: 요금표가 실어 보낸 ?plan= 도 돌아올 주소에 싣는다(없으면 /upgrade 그대로)
    "app/(product)/upgrade/page.tsx": 'next={plan ? `/upgrade?plan=${encodeURIComponent(plan)}` : "/upgrade"}',
    "app/(product)/billing/return/page.tsx": 'kind="payment"',
  }
  for (const [file, needle] of Object.entries(pages)) {
    const src = read(file)
    assert.match(src, /if \(!\(await currentSession\(\)\)\) return <SignInRequired/, `${file}: 세션이 없을 때 안내`)
    assert.ok(src.includes(needle), `${file}: ${needle}`)
  }
  // 결제 복귀는 거래 id 를 들고 돌아온다(로그인 뒤 같은 확인을 이어 간다)
  assert.match(read("app/(product)/billing/return/page.tsx"), /\/billing\/return\?_ptxn=\$\{encodeURIComponent\(transactionId\)\}/)
  const c = read("components/product/sign-in-required.tsx")
  // LFADA: 화면은 web-factory 블록 state-screen/error-retry 의 로그인 변형이다 — copy.signIn 이 있으면 [다시 시도] 대신 로그인 링크
  assert.match(c, /<StateScreenErrorRetry\b/)
  assert.match(c, /signIn: \{ label: c\.label, href: signInHref\(next\) \}/, "로그인 링크는 ?next= 를 싣는다")
  assert.match(c, /id="sign-in-required"/, "제목 id sign-in-required-title 을 러너·시험이 읽는다")
  assert.match(c, /headingLevel=\{1\}/, "쪽마다 h1 하나")
  assert.match(read("components/blocks/state-screen/error-retry.tsx"), /needsSignIn && copy\.signIn \? \(/, "블록이 로그인 링크를 [다시 시도] 대신 보인다")
  assert.doesNotMatch(c.replace(/^\/\/.*$/gm, ""), /Reload|reload/, "소용없는 Reload 를 두지 않는다")
  const copy = read("content/copy.en.ts")
  assert.match(copy, /title: "Sign in to see your payment"/, "/billing/return 은 로그인 문제를 결제 확인 실패로 숨기지 않는다")
  assert.match(copy, /Your payment is not affected/)
})

test("B04 로그인 쪽: ?next= 를 같은 출처 경로로 거른 뒤 블록에 넘기고, 이메일 로그인이 끝나면 거기로 가며 소셜은 거기로 돌아온다", () => {
  const page = read("app/(product)/sign-in/page.tsx")
  assert.match(page, /const target = safeNext\(next\)/)
  assert.match(page, /<SignInBlock [^>]*next=\{target \?\? undefined\}/)
  const blocks = read("components/product/product-blocks.tsx")
  assert.match(blocks, /redirectTo: next \? withWelcomeMark\(next, "signin"\) : WELCOME_HREF\.signin/)
  assert.match(blocks, /if \(next\) router\.push\(next\)/)
  assert.match(blocks, /done: \{ \.\.\.signInCopy\.done, label: "Continue", href: next \}/)
})

test("B01 로그인 성공 글은 사실만 말한다 — 옮겨 가지 않는데 「Taking you to…」라고 하지 않는다", () => {
  const copy = read("content/copy.en.ts")
  assert.doesNotMatch(copy, /Taking you to your account/)
  assert.match(copy, /done: \{ title: "You're signed in", body: "Your account is ready\. Pick up where you left off\."/)
})

test("B02 로그인한 채 /sign-in·/sign-up·/forgot-password 를 열면 서버가 세션을 보고 폼 대신 「이미 로그인했어요」를 그린다", () => {
  for (const p of ["sign-in", "sign-up", "forgot-password"]) {
    const src = read(`app/(product)/${p}/page.tsx`)
    assert.match(src, /const s = await currentSession\(\)/, p)
    assert.match(src, /if \(s\) return <AlreadySignedIn email=\{s\.email\}/, p)
  }
  const c = read("components/product/already-signed-in.tsx")
  assert.match(c, /role="status"/)
  assert.match(c, /<h1\b/)
  const copy = read("content/copy.en.ts")
  assert.match(copy, /title: "You're already signed in"/)
  assert.match(copy, /href: "\/account\/billing"/)
})

test("B03 로그아웃 뒤: 위 띠가 시작 쪽으로 보내며 표지를 달고, 도착 화면이 role=status 로 「로그아웃했어요」를 한 번 보인다", async () => {
  const { welcomeKind, withoutWelcome, WELCOME_HREF } = await import("../lib/welcome.ts")
  assert.equal(WELCOME_HREF.signedout, "/?welcome=signedout")
  assert.equal(welcomeKind(new URLSearchParams("welcome=signedout")), "signedout")
  assert.equal(withoutWelcome("http://localhost:3000/?welcome=signedout", "signedout"), "/")
  assert.equal(welcomeKind(new URLSearchParams("welcome=SIGNEDOUT")), null, "모르는 값은 아무것도 안 보인다")
  // LFADA: 위 띠의 로그아웃은 블록 nav/account-bar 의 POST 폼 — 서버 액션이 로그아웃을 마치면 시작 쪽으로 보낸다(표지를 단다)
  assert.match(read("app/actions/shell.ts"), /redirect\(WELCOME_HREF\.signedout\)/)
  const notice = read("components/product/welcome-notice.tsx")
  assert.match(notice, /role=\{failed && view\.copy !== "alreadyVerified" \? "alert" : "status"\}/) // P1AB: 틀린·만료 링크는 alert, 이미 확인된 사람의 「이미 확인됨」은 status
  const { welcomeCopy } = await import("../content/copy.en.ts")
  assert.equal(welcomeCopy.signedout.title, "You're signed out")
  assert.equal(welcomeCopy.signedout.href, "/sign-in")
})

test("A08 확인 링크를 로그아웃 상태로 열면 다음 행동이 「Sign in」(계정으로 돌아옴)이다 — 로그인된 상태면 그대로 「See plans」", async () => {
  assert.match(read("components/product/product-shell.tsx"), /<WelcomeNotice signedIn=\{!!s\} emailVerified=\{s\?\.emailVerified\} again=\{sendVerificationEmail\} \/>/, "서버가 세션을 보고 넘긴다")
  assert.match(read("components/product/welcome-notice.tsx"), /welcomeView\(shown\.kind, \{ signedIn, emailVerified \}\)/) // P1AB: 로그아웃 처리는 welcomeView 표(verified + 로그아웃 → verifiedSignedOut)가 한다
  const { welcomeCopy } = await import("../content/copy.en.ts")
  assert.equal(welcomeCopy.verifiedSignedOut.label, "Sign in")
  assert.match(welcomeCopy.verifiedSignedOut.body, /Sign in/)
  assert.equal(welcomeCopy.verified.label, "See plans", "로그인된 사람의 안내는 그대로")
})

test("F01 결제 관리 글: 체험 종료 예고 메일은 판매 대행자가 「보낼 수 있다」고만 말한다(보장·7일 약속 없음, 날짜는 화면이 보여 준다)", () => {
  const copy = read("content/copy.en.ts")
  assert.doesNotMatch(copy, /We'll check with you before it ends/)
  assert.match(copy, /trialing: "Your free trial runs until \{date\}\. Our payment provider may email you a reminder before it ends\."/)
  assert.doesNotMatch(copy, /emails you a reminder 7 days/)
})

test("영어 화면에 한국어가 새지 않는다(B01~B04 문구)", () => {
  const src = read("content/copy.en.ts")
  for (const name of ["signInRequiredCopy", "alreadySignedInCopy"]) {
    const block = src.slice(src.indexOf(`export const ${name}`))
    assert.doesNotMatch(block.replace(/\/\/.*$|\/\*[\s\S]*?\*\//gm, ""), /[가-힣]/, name)
  }
})
