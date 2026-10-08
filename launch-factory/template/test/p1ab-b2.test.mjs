// P1AB B2 — 이메일 확인 마무리(A10 A11 A14 A09 A18)와 E03(월 요금제만)의 시험. B1 시험은 p1ab.test.mjs.
// 빌드·서버 없이 돈다(문구·순수 함수는 실행, 이음은 소스 정규식). 브라우저 판정은 scripts/adb-walk.mjs 의 p1ab_b2 와 npm run template:screens 가 한다(docs/qa/ux-audit/apply-p1ab.md).
// 메일이 실제로 닿는지는 여기서 보지 않는다 — Resend 발신 도메인(O4)이 있어야 확인된다. 링크가 어떤 코드로 돌아오는지는 packages/auth/test/account.test.mjs 가 진짜 Better Auth 로 잠근다.
import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { registerHooks } from "node:module"
import { join } from "node:path"
import test from "node:test"
import { fileURLToPath, pathToFileURL } from "node:url"

const T = fileURLToPath(new URL("..", import.meta.url))
const read = (p) => readFileSync(join(T, p), "utf8")

// copy.ux.en.ts 가 `@/` 별칭으로 copy.en 을 가져온다 — 시험이 별칭을 풀어 준다(adb.test.mjs 와 같은 훅)
registerHooks({
  resolve: (spec, ctx, next) => {
    if (spec.startsWith("@/")) {
      for (const ext of [".ts", "/index.ts"]) {
        const file = join(T, spec.slice(2) + ext)
        if (existsSync(file)) return next(pathToFileURL(file).href, ctx)
      }
    }
    return next(spec, ctx)
  },
})

test("A10·A09 확인 링크의 결과를 가른다 — 만료(TOKEN_EXPIRED)와 그 밖의 틀린 링크를 구별하고, 이미 확인된 사람에게는 「이미 확인됨」을 말한다", async () => {
  const { welcomeKind, welcomeView } = await import("../lib/welcome.ts")
  const q = (s) => new URLSearchParams(s)
  assert.equal(welcomeKind(q("welcome=verified")), "verified")
  assert.equal(welcomeKind(q("welcome=verified&error=TOKEN_EXPIRED")), "expired")
  assert.equal(welcomeKind(q("welcome=verified&error=INVALID_TOKEN")), "failed")
  assert.equal(welcomeKind(q("welcome=verified&error=USER_NOT_FOUND")), "failed")
  // 안내 표: [종류 × 로그인 상태 × 확인 여부] → 보일 문구와 「새 확인 메일 받기」 단추가 있는지
  const v = (kind, signedIn, emailVerified) => welcomeView(kind, { signedIn, emailVerified })
  assert.deepEqual(v("expired", true, false), { copy: "expired", resend: true })
  assert.deepEqual(v("failed", true, false), { copy: "failed", resend: true })
  assert.deepEqual(v("expired", true, true), { copy: "alreadyVerified", resend: false }, "A09: 이미 확인했는데 옛 링크를 열었다")
  assert.deepEqual(v("failed", true, true), { copy: "alreadyVerified", resend: false })
  assert.deepEqual(v("expired", false, undefined), { copy: "failedSignedOut", resend: false }, "로그아웃 상태는 로그인이 먼저(로그인하면 배너가 재전송을 준다)")
  assert.deepEqual(v("failed", false, undefined), { copy: "failedSignedOut", resend: false })
  // 성공·다른 종류는 그대로
  assert.deepEqual(v("verified", true, true), { copy: "verified", resend: false })
  assert.deepEqual(v("verified", false, undefined), { copy: "verifiedSignedOut", resend: false })
  assert.deepEqual(v("signin", true, true), { copy: "signin", resend: false })
  const { welcomeCopy } = await import("../content/copy.en.ts")
  assert.match(welcomeCopy.expired.title, /expired/i)
  assert.match(welcomeCopy.alreadyVerified.title, /already/i)
  assert.match(welcomeCopy.failedSignedOut.href, /^\/sign-in\?next=/)
  // 알림 컴포넌트가 그 표를 쓰고 단추를 낸다
  const wn = read("components/product/welcome-notice.tsx")
  assert.match(wn, /welcomeView\(/)
  assert.match(wn, /<ResendVerification\b/)
})

test("A11 확인 안 된 사람에게 배너 — 결제는 막지 않는다(운영자 결정 2026-10-07)", async () => {
  const { showVerifyBanner } = await import("../lib/verify-email.ts")
  assert.equal(showVerifyBanner(false, "/"), true)
  assert.equal(showVerifyBanner(false, "/upgrade"), true)
  assert.equal(showVerifyBanner(false, "/verify-email"), false, "확인 쪽은 제 안내가 있다")
  assert.equal(showVerifyBanner(true, "/"), false)
  assert.equal(showVerifyBanner(undefined, "/"), false, "카카오 대체 주소처럼 확인할 수 없는 주소는 배너 대상이 아니다")
  const shell = read("components/product/product-shell.tsx")
  assert.match(shell, /<UnverifiedBanner\b/)
  assert.match(shell, /emailVerified === false/)
  // 막지 않는다: 결제 입구(서버 액션)는 확인 여부를 보지 않고, 결제 쪽은 확인 여부로 블록을 숨기지 않는다
  assert.doesNotMatch(read("app/actions/product.ts"), /emailVerified/)
  const up = read("app/(product)/upgrade/page.tsx")
  assert.doesNotMatch(up, /if \([^\n]*emailVerified[^\n]*\)\s*return/, "확인 여부로 결제 화면을 돌려보내지 않는다")
  assert.match(up, /<UpgradeBlock\b/)
})

test("A11 결제 직전에 받는 주소를 보인다 — 확인 안 됐으면 그 사실과 고치는 길까지", async () => {
  const { checkoutEmailCopy } = await import("../content/copy.ux.en.ts")
  assert.match(checkoutEmailCopy.line, /\{email\}/)
  assert.match(checkoutEmailCopy.unverified, /isn.t confirmed/i)
  assert.equal(checkoutEmailCopy.fix.href, "/account#credentials-email-form")
  assert.equal(checkoutEmailCopy.confirm.href, "/verify-email")
  assert.match(checkoutEmailCopy.inDialog, /close this window/i, "결제 창 안에서는 링크를 못 둔다 — 창을 닫고 고치라고 말한다")
  const up = read("app/(product)/upgrade/page.tsx")
  assert.ok(up.indexOf("<CheckoutEmailNote") !== -1 && up.indexOf("<CheckoutEmailNote") < up.indexOf("<UpgradeBlock"), "주소 안내가 결제 블록 앞에 있다")
  // 결제 창(블록 PaywallUpgradeModal)은 defaultOpen 이라 쪽 위 안내를 덮는다 — 같은 주소가 창의 설명(dialog.description)에도 실린다
  assert.match(up, /<UpgradeBlock\b[^>]*email=\{me\.email\}[^>]*emailVerified=\{me\.emailVerified\}/)
  const pb = read("components/product/product-blocks.tsx")
  assert.match(pb, /checkoutEmailCopy\.line\.replace\("\{email\}", email\)/)
  assert.match(pb, /dialog: \{ \.\.\.upgradeCopy\.dialog, description:/)
})

test("A14 확인 안내에 보낸 주소와 「주소 고치기」 길이 있다", async () => {
  const { verifyEmailCopy } = await import("../content/copy.en.ts")
  assert.equal(verifyEmailCopy.wrongAddress.href, "/account#credentials-email-form")
  assert.match(verifyEmailCopy.wrongAddress.label, /fix|change/i)
  assert.match(read("components/product/verify-email-note.tsx"), /wrongAddress/)
  // 그 주소는 계정 화면 이메일 변경 폼의 실제 자리다(확인 안 된 주소는 새 주소 확인만 거친다 — D71)
  assert.match(read("content/copy.account.en.ts"), /href: "#credentials-email-form"/)
})

test("A18 국내 포털 메일(네이버·다음·카카오 …)에는 스팸함·지연 안내를 더한다 — 도메인이 정확히 맞을 때만", async () => {
  const { isKoreanPortalMail } = await import("../lib/verify-email.ts")
  for (const ok of ["a@naver.com", "A.B@NAVER.COM", "x@daum.net", "x@hanmail.net", "x@kakao.com", "x@nate.com"]) assert.equal(isKoreanPortalMail(ok), true, ok)
  for (const no of ["a@gmail.com", "a@naver.com.evil.test", "a@notnaver.com", "naver.com", "", undefined, "a@sub.naver.com"]) assert.equal(isKoreanPortalMail(no), false, String(no))
  const { verifyEmailCopy } = await import("../content/copy.en.ts")
  assert.match(verifyEmailCopy.koreanPortal, /spam/i)
  assert.match(read("components/product/verify-email-note.tsx"), /isKoreanPortalMail/)
  assert.match(read("components/product/unverified-banner.tsx"), /isKoreanPortalMail/)
})

test("A10 확인 쪽(/verify-email)은 블록 confirmation/verify-email 로 — 로그인 뒤에도 다시 보낼 자리이고 확인 전·후·로그아웃을 모두 말한다", async () => {
  assert.ok(read("components/blocks/confirmation/verify-email.tsx").includes('data-block="confirmation-verify-email"'))
  assert.match(read("app/(product)/verify-email/page.tsx"), /VerifyEmailBlock/)
  const pb = read("components/product/product-blocks.tsx")
  assert.match(pb, /<ConfirmationVerifyEmail\b[^>]*session=\{session\}[^>]*sendVerificationEmail=\{watch\(sendVerificationEmail\)\}/)
  assert.match(pb, /<PageTitle>\{pageTitles\.verifyEmail\}<\/PageTitle>/)
  // v0.0.12(REL12 5d): 이 쪽은 가입 직후가 아니다(배너·만료 안내에서 연다 — 가입 직후는 가입 화면의 verify-email-note 가 맡는다) → 처음엔 잠그지 않는다(initialWait 0).
  // 보낸 뒤 잠금은 블록 기본(60초)이고 서버 요청 제한 창(/send-verification-email window 60)과 같다 — 줄여 쓰던 VERIFY_RESEND_SECONDS(20)는 없다
  assert.match(pb, /<ConfirmationVerifyEmail\b[^>]*initialWait=\{0\}/)
  assert.doesNotMatch(pb, /<ConfirmationVerifyEmail\b[^>]*resendAfter=/, "보낸 뒤 잠금은 블록 기본값을 쓴다")
  const verifyLib = await import("../lib/verify-email.ts")
  assert.equal(verifyLib.VERIFY_RESEND_SECONDS, undefined, "줄여 쓰던 대기 초 상수는 없다")
  const blk = read("components/blocks/confirmation/verify-email.tsx")
  assert.match(blk, /initialWait\?: number/, "설치된 블록이 initialWait 를 받는다(v0.0.12)")
  assert.match(blk, /resendAfter = 60/, "블록 기본 잠금은 60초")
  assert.match(readFileSync(join(T, "../packages/auth/src/config.ts"), "utf8"), /"\/send-verification-email": \{ window: 60, max: 3 \}/, "서버 요청 제한 창이 블록 기본 잠금과 같다")
  const { verifyEmailPageCopy } = await import("../content/copy.ux.en.ts")
  assert.equal(verifyEmailPageCopy.wrongAddress.href, "/account#credentials-email-form")
  assert.equal(verifyEmailPageCopy.empty.href.startsWith("/sign-in?next="), true)
  assert.match(verifyEmailPageCopy.spam, /spam/i)
})

test("E03 월 요금제만 낸다(운영자 결정 2026-10-07) — 결제·요금표가 쓰는 요금제 목록에서 월이 아닌 것을 거르고, 연 토글이 없다", async () => {
  const { onlyOffered, OFFERED_INTERVALS } = await import("../lib/plan-param.ts")
  assert.deepEqual([...OFFERED_INTERVALS], ["month"])
  const plans = [{ id: "pro", interval: "month" }, { id: "pro-yearly", interval: "year" }, { id: "team", interval: "month" }]
  assert.deepEqual(onlyOffered(plans).map((p) => p.id), ["pro", "team"])
  assert.deepEqual(onlyOffered([]), [])
  assert.match(read("app/actions/product.ts"), /export const plans = async \(\) => \{[\s\S]*?onlyOffered/)
  assert.match(read("content/pricing-from-plans.ts"), /OFFERED_INTERVALS|onlyOffered/)
  const { pricingCopy } = await import("../content/copy.en.ts")
  assert.deepEqual(Object.keys(pricingCopy).filter((k) => /annual|yearly|toggle|interval|period/i.test(k)), [])
  assert.doesNotMatch(read("components/product/product-blocks.tsx"), /annual|yearly/i)
})
