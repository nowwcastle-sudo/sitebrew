"use client"
// 제품 페이지의 클라이언트 잎(v0 Task 10). 서버 페이지가 서버 액션(app/actions/product.ts)을 props 로 넘기고, 여기서 블록에 이어 준다.
// 블록은 공급자를 모른다 — 넘기는 것은 포트 메서드(서버 액션)와 track(withAttribution 으로 출처 태그를 붙인 것)뿐이다.
// 폼을 가진 블록은 <FormKeys> 로 감싼다(멱등 키는 조립하는 쪽이 만든다 — 계약 판 2).
import * as React from "react"
import { useRouter } from "next/navigation"
import { AccountBillingManage } from "@/components/blocks/account/billing-manage"
import { AuthNewPassword } from "@/components/blocks/auth/new-password"
import { AuthPasswordReset } from "@/components/blocks/auth/password-reset"
import { AuthSignIn } from "@/components/blocks/auth/sign-in"
import { AuthSignUpConsents } from "@/components/blocks/auth/sign-up-consents"
import { ConfirmationVerifyEmail } from "@/components/blocks/confirmation/verify-email"
import { ConsentBottomBanner } from "@/components/blocks/consent/bottom-banner"
import { PaywallUpgradeModal } from "@/components/blocks/paywall/upgrade-modal"
import { PricingThreeTierCards } from "@/components/blocks/pricing/three-tier-cards"
import { RetentionCancelFlow } from "@/components/blocks/retention/cancel-flow"
import { RetentionPaymentFailedBanner } from "@/components/blocks/retention/payment-failed-banner"
import { RetentionRenewalConsent } from "@/components/blocks/retention/renewal-consent"
import type { AuthPort, BillingPort, Plan, RetentionOffer } from "@/components/contract/ports"
import { billingCopy, cancelFlowCopy, consentCopy, COPY_LOCALE, passwordResetCopy, pricingCopy, resetPasswordCopy, signInCopy, signUpCopy, upgradeCopy } from "@/content/copy.en"
import { consentPreferencesCopy } from "@/content/copy.shell.en"
import { checkoutEmailCopy, euSalesCopy, pageTitles, paymentFailedCopy, renewalConsentCopy, verifyEmailPageCopy } from "@/content/copy.ux.en"
import { pricingFromPlans } from "@/content/pricing-from-plans"
import { useDisplayPrefs } from "@/components/product/display-prefs"
import { FormKeys } from "@/components/product/form-keys"
import { useAnalyticsEnabled, useBlockTrack, useProductAnalytics } from "@/components/product/analytics"
import { ActionScope } from "@/components/product/action-scope"
import { useCheckoutOverlay } from "@/components/product/checkout-overlay"
import { useTurnstile } from "@/components/product/turnstile"
import { TurnstileStatus } from "@/components/product/turnstile-status"
import { botCheckCopy } from "@/content/copy.en"
import { VerifyEmailNote } from "@/components/product/verify-email-note"
import { withWelcomeMark } from "@/lib/auth-next"
import { isWeakPassword } from "@/lib/weak-password"
import { announceSessionChanged, WELCOME_HREF } from "@/lib/welcome"

/**
 * 쪽의 제목(J04). 블록은 제목을 h2 로 그려서(h1 은 hero 블록만 갖는다) 블록만 놓인 쪽에는 h1 이 없다 — 그래서 조립하는 쪽이 쪽 이름의 h1 을 하나 둔다.
 * 눈에는 블록의 제목이 보이므로 이 h1 은 화면 낭독기·문서 윤곽용이다(sr-only). 블록 머리(BlockHeading)가 level 을 받게 되면 이 h1 을 걷고 블록 제목을 h1 으로 쓴다.
 */
function PageTitle({ children }: { children: React.ReactNode }) {
  return <h1 className="sr-only">{children}</h1>
}

/** 이 화면 안에서 로그인된 결과인지(쪽 이동·2단계·메일 확인이 남은 결과는 아니다) — 맞으면 위 띠에 알린다 */
const signedInHere = (r: { ok: boolean; data?: unknown }) => {
  const d = (r.ok ? r.data : null) as { redirectUrl?: string; needsTwoFactor?: boolean; emailSent?: boolean } | null
  return !!d && !d.redirectUrl && !d.needsTwoFactor && !d.emailSent
}

// 레시피(설치한 r1-measure)와 문구 판을 계측 태그로 싣는다. 문구를 바꾸면 copyVariant 를 올린다
const RECIPE = "r1-measure"
const COPY = "en-default"
const tag = (blockId: string) => ({ blockId, recipeId: RECIPE, copyVariant: COPY })

/**
 * 로그인. 소셜(구글 등)은 공급자 화면을 다녀와 새 쪽에서 끝나므로 돌아올 주소에 `?welcome=signin` 표지를 단다(UXOK — 도착 화면이 「로그인됐어요」를 한 번 보인다).
 * 이메일·비밀번호는 이 화면 안에서 끝나 완료 글이 있으므로 표지를 달지 않는다(달면 쪽 이동이 먼저 일어나 완료 글이 안 보인다)
 */
export function SignInBlock({ methods, signIn, next }: { methods: AuthPort["methods"]; signIn: AuthPort["signIn"]; next?: string }) {
  const track = useBlockTrack(tag("auth-sign-in"))
  const router = useRouter()
  // next: 로그인이 필요한 쪽이 보낸 「돌아올 곳」(B04 — 서버가 lib/auth-next.ts 의 safeNext 로 거른 값). 있으면 이메일 로그인이 끝나자 거기로 가고, 소셜은 거기로 돌아온다.
  const prefs = useDisplayPrefs()
  const withWelcome = React.useCallback<AuthPort["signIn"]>(
    async (input) => {
      const r = await signIn(input.method === "password" ? input : { ...input, redirectTo: next ? withWelcomeMark(next, "signin") : WELCOME_HREF.signin })
      if (signedInHere(r)) {
        announceSessionChanged()
        if (next) router.push(next)
      }
      return r
    },
    [signIn, next, router],
  )
  const copy = React.useMemo(() => (next ? { ...signInCopy, done: { ...signInCopy.done, label: "Continue", href: next } } : signInCopy), [next])
  return (
    <ActionScope name="sign-in">
      {(watch) => (
        <FormKeys>
          <PageTitle>{pageTitles.signIn}</PageTitle>
          <AuthSignIn copy={copy} methods={methods} signIn={watch(withWelcome)} track={track} {...prefs} />
        </FormKeys>
      )}
    </ActionScope>
  )
}

/**
 * 가입. 조립하는 쪽이 더하는 것: ① 봇 확인 토큰(`cf-turnstile-response`, 위젯 — siteKey 가 있을 때만) ② 사용자 언어·시간대
 * (확인 메일 같은 서버 문구가 화면 언어와 같게 — 브라우저 언어가 한국어여도 이 제품 화면은 영어다)
 * ③ (UXOK) 소셜 가입은 돌아올 주소에 `?welcome=signup` 표지를 단다 — 도착 화면이 「가입이 완료됐어요」를 한 번 보인다.
 * ④ (UXOK) 이메일 가입이 끝나면 완료 글 아래에 「확인 메일을 보냈어요 — <방금 적은 주소>」와 다시 보내기를 붙인다.
 */
export function SignUpBlock({
  methods,
  signUp,
  turnstileSiteKey,
  sendAgain,
  plan,
}: {
  methods: AuthPort["methods"]
  signUp: AuthPort["signUp"]
  turnstileSiteKey?: string
  sendAgain?: NonNullable<AuthPort["sendVerificationEmail"]>
  /** 요금표에서 고른 요금제 id(`?plan=` — 서버 쪽이 모양을 거른 값). 있으면 가입을 마친 화면의 다음 행동이 그 요금제의 결제 화면이다(E01) */
  plan?: string
}) {
  const track = useBlockTrack(tag("auth-sign-up-consents"))
  const prefs = useDisplayPrefs()
  const copy = React.useMemo(() => (plan ? { ...signUpCopy, done: { ...signUpCopy.done, label: "Continue to checkout", href: `/upgrade?plan=${encodeURIComponent(plan)}` } } : signUpCopy), [plan])
  const [emailed, setEmailed] = React.useState<string | null>(null)
  const withPrefs = React.useCallback<AuthPort["signUp"]>(
    (input) => {
      const prefs = { ...input, locale: COPY_LOCALE, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }
      return signUp((input.method === "password" ? prefs : { ...prefs, redirectTo: WELCOME_HREF.signup }) as typeof input)
    },
    [signUp],
  )
  const bot = useTurnstile(turnstileSiteKey, withPrefs, botCheckCopy)
  const remember = React.useCallback<AuthPort["signUp"]>(
    async (input) => {
      const r = await bot.signUp(input)
      if (r.ok && input.method === "password" && typeof input.email === "string") setEmailed(input.email.trim())
      if (signedInHere(r)) announceSessionChanged()
      return r
    },
    [bot],
  )
  return (
    <ActionScope name="sign-up">
      {(watch) => (
        <>
          <FormKeys>
            <PageTitle>{pageTitles.signUp}</PageTitle>
            <AuthSignUpConsents copy={copy} methods={methods} signUp={watch(remember)} track={track} isWeakPassword={isWeakPassword} {...prefs} />
          </FormKeys>
          {emailed && sendAgain ? <VerifyEmailNote email={emailed} again={() => sendAgain()} /> : null}
          <TurnstileStatus box={bot.box} status={bot.status} copy={botCheckCopy} />
        </>
      )}
    </ActionScope>
  )
}

/**
 * 요금 쪽: 결제가 쓰는 같은 요금제 목록에서 카드를 만든다(plans 가 없으면 문구 파일의 기본 카드).
 * E01: 단추는 로그인 상태를 따른다 — 로그아웃 = 가입(?plan=<id>), 로그인(signedIn) = 결제(/upgrade?plan=<id>), 지금 쓰는 요금제(currentPlanId) = 표지. 서버 쪽이 세션·구독을 읽어 값으로 넘긴다
 */
export function PricingBlock({ plans, signedIn, currentPlanId, euClosed }: { plans?: Plan[] | null; signedIn?: boolean; currentPlanId?: string | null; euClosed?: boolean }) {
  const prefs = useDisplayPrefs()
  return (
    <>
      <PageTitle>{pageTitles.pricing}</PageTitle>
      <PricingThreeTierCards copy={pricingFromPlans(pricingCopy, plans)} signedIn={signedIn} currentPlanId={currentPlanId} {...prefs} />
      {/* F10: EU 판매가 닫힌 동안 요금표 아래 한 줄(LF_EU_SALES) */}
      {euClosed ? <p className="mx-auto max-w-prose px-4 pb-8 text-center text-sm text-muted-foreground">{euSalesCopy.pricingNote}</p> : null}
    </>
  )
}

export function PasswordResetBlock({ requestPasswordReset }: { requestPasswordReset: AuthPort["requestPasswordReset"] }) {
  const track = useBlockTrack(tag("auth-password-reset"))
  const prefs = useDisplayPrefs()
  return (
    <ActionScope name="password-reset-request">
      {(watch) => (
        <FormKeys>
          <PageTitle>{pageTitles.forgotPassword}</PageTitle>
          <AuthPasswordReset copy={passwordResetCopy} requestPasswordReset={watch(requestPasswordReset)} track={track} {...prefs} />
        </FormKeys>
      )}
    </ActionScope>
  )
}

/**
 * 새 비밀번호 정하기(재설정 마무리) — web-factory `auth/new-password` 의 한 칸 판(`confirmField: false`, 운영자 결정 2026-10-03). 토큰은 주소의 `?token=`(서버 쪽이 읽어 넘긴다).
 * 토큰이 없거나 `?error=INVALID_TOKEN` 으로 왔으면 token 을 비워 「링크가 열리지 않아요」 + 재설정 다시 받기로 간다. 만료·이미 쓴 토큰은 어댑터가 `code: "invalid_token"` 으로 돌려주어 블록이 같은 안내로 바꾼다.
 */
export function NewPasswordBlock({ token, resetPassword }: { token?: string; resetPassword: NonNullable<AuthPort["resetPassword"]> }) {
  const track = useBlockTrack(tag("auth-new-password"))
  const prefs = useDisplayPrefs()
  return (
    <ActionScope name="reset-password">
      {(watch) => (
        <FormKeys>
          <PageTitle>{pageTitles.newPassword}</PageTitle>
          <AuthNewPassword copy={resetPasswordCopy} confirmField={false} token={token} resetPassword={watch(resetPassword)} track={track} isWeakPassword={isWeakPassword} {...prefs} />
        </FormKeys>
      )}
    </ActionScope>
  )
}

/** checkoutToken 이 있으면 결제 창을 이 화면 위에 오버레이로 연다(없으면 결제 링크로 이동). planId = 요금표에서 고른 요금제(`?plan=`), currentPlanId = 지금 쓰는 요금제(없으면 무료 — 비교표 머리가 「Free plan」, E04) */
export function UpgradeBlock({ plans, checkout, checkoutToken, planId, currentPlanId, email, emailVerified, billingCountry }: { plans: BillingPort["plans"]; checkout: (input: Parameters<BillingPort["checkout"]>[0] & { billingCountry?: string }) => ReturnType<BillingPort["checkout"]>; checkoutToken?: string; planId?: string; currentPlanId?: string | null; email?: string; emailVerified?: boolean; billingCountry?: string }) {
  const track = useBlockTrack(tag("paywall-upgrade-modal"))
  const prefs = useDisplayPrefs()
  const onRedirect = useCheckoutOverlay(checkoutToken, COPY_LOCALE)
  // F10: 사람이 고른 결제 국가(EU 안내에서 다른 나라를 골랐을 때)를 결제 서버 입구에 함께 싣는다 — 서버가 접속 지역보다 앞세운다
  const checkoutWithCountry = React.useCallback<BillingPort["checkout"]>((input) => checkout(billingCountry ? { ...input, billingCountry } : input), [checkout, billingCountry])
  // A11: 결제 창이 기본으로 열려 쪽 위의 받는 주소 안내(CheckoutEmailNote)를 덮는다 — 같은 주소(와 확인 안 됐다는 말)를 창의 설명에도 싣는다. 결제는 막지 않는다(운영자 결정 2026-10-07)
  const copy = React.useMemo(
    () =>
      email
        ? {
            ...upgradeCopy,
            dialog: { ...upgradeCopy.dialog, description: [upgradeCopy.dialog.description, checkoutEmailCopy.line.replace("{email}", email), emailVerified === false ? `${checkoutEmailCopy.unverified} ${checkoutEmailCopy.inDialog}` : null].filter(Boolean).join(" ") },
          }
        : upgradeCopy,
    [email, emailVerified],
  )
  // ActionScope 없음(LFPIN11): 결제 쪽 액션은 요청 제한(rate_limited)이 없고, 블록의 알림·읽기 오류가 `data-error-code`·`data-retryable` 을 직접 단다(v0.0.11)
  return (
    <FormKeys>
      <PageTitle>{pageTitles.upgrade}</PageTitle>
      <PaywallUpgradeModal copy={copy} plans={plans} checkout={checkoutWithCountry} track={track} onRedirect={onRedirect} planId={planId} currentPlanId={currentPlanId} trigger="pricing" defaultOpen {...prefs} />
    </FormKeys>
  )
}

/**
 * 결제 관리. 요금제 변경은 블록의 확인 단계(요약 → [확인])를 마친 사람이 누르면 블록이 `confirmed: true` 를 직접 싣는다(web-factory v0.0.11 — LFAX M03 의 `watch.confirmed` 조립을 걷었다).
 * 서버 액션은 그 칸이 없으면 실행하지 않는다(`gated()` — 방어 겹침 그대로).
 */
export function BillingBlock(props: {
  subscription: BillingPort["subscription"]
  plans: BillingPort["plans"]
  changePlan: BillingPort["changePlan"]
  updatePaymentMethod: BillingPort["updatePaymentMethod"]
  resume: BillingPort["resume"]
  portal: NonNullable<BillingPort["portal"]>
}) {
  const track = useBlockTrack(tag("account-billing-manage"))
  const prefs = useDisplayPrefs()
  return (
    <FormKeys>
      <PageTitle>{pageTitles.billing}</PageTitle>
      <AccountBillingManage copy={billingCopy} track={track} {...prefs} {...props} />
    </FormKeys>
  )
}

/**
 * 해지 실행 화면: 해지 방식 → (대안이 있을 때만) 대안 하나 → 완료. 대안이 없으면 확인 장 없이 두 단계(가입 3단계 이하, F12). 대안 목록은 서버(lib/offers.ts)가 정해 넘긴다.
 * 이미 해지가 예약된 구독이 오면 흐름 대신 상태와 [계속 쓰기] 하나(F05) — `resume` 이 그 단추가 부르는 포트다
 */
export function CancelBlock(props: {
  subscription: BillingPort["subscription"]
  plans: BillingPort["plans"]
  resume: BillingPort["resume"]
  cancel: BillingPort["cancel"]
  applyRetentionOffer: BillingPort["applyRetentionOffer"]
  offers: RetentionOffer[]
}) {
  const track = useBlockTrack(tag("retention-cancel-flow"))
  const prefs = useDisplayPrefs()
  // 해지·대안 적용은 블록의 확인 단계를 마친 사람이 누르면 블록이 `confirmed: true` 를 직접 싣는다(v0.0.11). 서버 액션은 그 칸이 없으면 실행하지 않는다
  return (
    <FormKeys>
      <PageTitle>{pageTitles.cancel}</PageTitle>
      <RetentionCancelFlow copy={cancelFlowCopy} terms={{ midTerm: false }} keepHref="/account/billing" track={track} {...prefs} {...props} />
    </FormKeys>
  )
}

/** 동의 띠 — 결정 전(unset)에는 계측이 아무것도 보내지 않는다(Review Focus 2). 결정하면 띠가 사라진다 */
export function ConsentBanner() {
  const enabled = useAnalyticsEnabled()
  const analytics = useProductAnalytics()
  const track = useBlockTrack(tag("consent-bottom-banner"))
  const prefs = useDisplayPrefs()
  // 결정은 이 브라우저의 localStorage 에 있어서 서버는 모른다 — 서버는 「결정 전」으로 그렸는데 이미 결정한 방문자의 첫 클라이언트 렌더가
  // 「결정함」(띠 없음)으로 그리면 하이드레이션이 어긋난다(React #418, LFFIX F9 — 결정한 방문자의 모든 쪽에서 났다). 서버와 첫 클라이언트 렌더는 둘 다 비우고,
  // 붙은 뒤에 읽은 결정으로 처음 그린다(블록의 decided 초기값이 그때 정해진다). 이미 결정한 방문자에게는 띠가 깜박이지도 않는다.
  const hydrated = React.useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  )
  if (!hydrated) return null
  // 분석이 꺼진 제품(LFOBS — 계측 호스트 없음)에는 동의를 구할 선택 쿠키가 없다: 띠가 켜지지 않은 분석을 약속하지 않도록 그리지 않는다
  if (!enabled) return null
  // copy.preferences(K04): 「Choose by category」가 항목별 설정 대화상자를 여는 단추가 되고, 바닥글의 「Cookie settings」(footer/product-legal)가 결정한 뒤에도 같은 대화상자를 다시 연다 — 철회가 동의만큼 쉽다
  return <ConsentBottomBanner copy={{ ...consentCopy, preferences: consentPreferencesCopy }} consent={analytics.consent} setConsent={analytics.setConsent} track={track} {...prefs} />
}

/**
 * 가격 변경 동의(F04). 메일의 [동의]·[거절] 링크가 닿는 두 쪽(/account/billing/price-change · /account/billing/cancel)이 같은 블록을 보인다 —
 * 전후 가격·적용일·동의 기한을 같이 보고, 사람이 두 단추 중 하나를 누른다(쪽을 열었다고 동의·해지가 실행되지 않는다).
 */
export function RenewalConsentBlock(props: {
  subscription: BillingPort["subscription"]
  acceptPriceChange: BillingPort["acceptPriceChange"]
  cancel: BillingPort["cancel"]
}) {
  const track = useBlockTrack(tag("retention-renewal-consent"))
  const prefs = useDisplayPrefs()
  // 두 단추(동의·거절) 중 하나를 사람이 누르면 블록이 `confirmed: true` 를 직접 싣는다(v0.0.11). 쪽을 열었다고는 아무것도 실행되지 않는다
  return (
    <FormKeys>
      <RetentionRenewalConsent copy={renewalConsentCopy} track={track} standalone {...prefs} {...props} />
    </FormKeys>
  )
}

/**
 * 결제 실패 띠(F02). 구독을 읽어 past_due 일 때만 보인다(아니면 아무것도 그리지 않는다). role="alert" 비차단 — 다시 결제하는 날·접근이 멈추는 날(graceEndsAt)·카드 변경 단추 하나.
 * 카드를 바꾸고 돌아오면 구독을 다시 읽어 띠가 사라지고 확인 글이 남는다. 우리가 보내는 결제 실패 메일(F11)과 같은 사실을 화면에서도 말한다.
 */
export function PaymentFailedBlock(props: { subscription: BillingPort["subscription"]; updatePaymentMethod: BillingPort["updatePaymentMethod"] }) {
  const track = useBlockTrack(tag("retention-payment-failed-banner"))
  const prefs = useDisplayPrefs()
  return (
    <FormKeys>
      <RetentionPaymentFailedBanner copy={paymentFailedCopy} track={track} {...prefs} {...props} />
    </FormKeys>
  )
}

/**
 * 이메일 확인 쪽(A10·A14·A18 — web-factory `confirmation/verify-email`). 로그인한 사람의 보낸 주소·다음 두 걸음·스팸함 안내·다시 보내기(대기 타이머)·주소 고치기 링크, 확인을 마쳤으면 「확인했어요」,
 * 로그아웃이면 로그인 안내(로그인하면 이 쪽으로 돌아온다). 서버 쪽(page.tsx)이 국내 포털 메일이면 스팸함 안내를 더한 문구(copy)를 넘긴다.
 */
export function VerifyEmailBlock({ session, sendVerificationEmail, copy = verifyEmailPageCopy }: { session: AuthPort["session"]; sendVerificationEmail: NonNullable<AuthPort["sendVerificationEmail"]>; copy?: typeof verifyEmailPageCopy }) {
  const prefs = useDisplayPrefs()
  return (
    <ActionScope name="verify-email">
      {(watch) => (
        <>
          <PageTitle>{pageTitles.verifyEmail}</PageTitle>
          <ConfirmationVerifyEmail copy={copy} session={session} sendVerificationEmail={watch(sendVerificationEmail)} initialWait={0} {...prefs} />
        </>
      )}
    </ActionScope>
  )
}
