// live 포트(v0 Task 10): 기능 번들 lib/launch/* 를 부른다. 이 파일은 live 일 때만 불러온다(lib/ports.ts 의 동적 import).
// 로그인한 본인에게만 작용한다 — 사용자 id 는 세션에서 읽고 입력으로 받지 않는다(app/actions/billing.ts 와 같은 규칙).
import { authActions } from "@launch-factory/auth"
import { contractPlans } from "@launch-factory/billing-paddle"
import { checkoutAction, withWithdrawalConsent } from "@launch-factory/consent"
import { messages } from "@launch-factory/i18n"
import { signInRequiredResult } from "@launch-factory/security/action"
import { headers } from "next/headers"
import { authPort } from "@/lib/launch/auth"
import { billing } from "@/lib/launch/billing"
import { DEFAULT_LOCALE } from "@/lib/launch/config"
import { database } from "@/lib/launch/db"
import { guardAction } from "@/lib/launch/security"
import { PLANS } from "@/lib/launch/paddle-plans"
import type { ProductPorts } from "@/lib/ports"

export async function livePorts(): Promise<ProductPorts> {
  const auth = await authPort()
  const actions = authActions(auth, { locale: DEFAULT_LOCALE })
  const signInRequired = () => signInRequiredResult(DEFAULT_LOCALE)
  const userId = async () => {
    const s = await auth.session()
    // 대리 로그인 세션은 본인이 아니다 — 결제를 대신 바꾸지 못한다(D204 는 LF hardening 레인이 잇는다)
    return s.ok && s.data && !s.data.impersonatedBy ? s.data.userId : null
  }
  const port = async () => {
    const id = await userId()
    return id ? (await billing()).port({ userId: id }) : null
  }
  return {
    auth: {
      methods: () => auth.methods(),
      session: () => auth.session(),
      signIn: (input) => actions.signIn(input),
      signUp: (input) => actions.signUp(input),
      signOut: () => actions.signOut(),
      verifyTwoFactor: (input) => actions.verifyTwoFactor(input),
      resetPassword: (input) => actions.resetPassword(input),
      sendVerificationEmail: (input) => actions.sendVerificationEmail(input),
      // 공개 입구다 — 모양을 먼저 본다(이메일 한 칸). 계정이 있든 없든 같은 결과가 나간다
      requestPasswordReset: async (input) => (typeof input?.email === "string" && input.email.length <= 320 ? auth.requestPasswordReset({ email: input.email }) : { ok: false as const, fieldErrors: { email: [messages(DEFAULT_LOCALE).auth.required] } }),
    },
    billing: {
      // 요금제 표는 설정이라 로그인 없이 읽는다(공개 요금 화면)
      plans: async () => ({ ok: true, data: contractPlans(PLANS) }),
      subscription: async () => (await port())?.subscription() ?? signInRequired(),
      // 결제 시작은 청약철회 제한 고지에 동의해야 열린다(withdrawalConsent) — 동의는 consent_records 에 남는다
      checkout: async (input) => {
        const id = await userId()
        if (!id) return signInRequired()
        // 요청 제한이 가장 바깥이다 — 한도 밖의 요청은 동의 기록도 결제 포트(= 거래 만들기)도 닿지 않는다(D130, app/actions/billing.ts 의 startCheckout 과 같은 규칙)
        const refused = await guardAction("checkoutStart", { headers: new Headers(await headers()), userId: id })
        if (refused) return refused
        const guarded = withWithdrawalConsent((await billing()).port({ userId: id }), { db: await database(), userId: () => id, locale: DEFAULT_LOCALE })
        return checkoutAction(guarded, { locale: DEFAULT_LOCALE })(input)
      },
      changePlan: async (input) => (await port())?.changePlan(input) ?? signInRequired(),
      cancel: async (input) => (await port())?.cancel(input) ?? signInRequired(),
      resume: async () => (await port())?.resume() ?? signInRequired(),
      applyRetentionOffer: async (input) => (await port())?.applyRetentionOffer(input) ?? signInRequired(),
      // 가격 변경 동의(F04) — 메일의 [동의] 링크가 닿는 쪽에서 사람이 누른다
      acceptPriceChange: async () => (await port())?.acceptPriceChange() ?? signInRequired(),
      // 결제 창을 마친 직후 구독을 바로 맞춘다(lib/billing-return.ts)
      syncCheckout: async ({ transactionId }) => {
        const id = await userId()
        return id ? (await import("@/lib/billing-return")).syncCheckoutFor(id, transactionId) : signInRequired()
      },
      updatePaymentMethod: async () => (await port())?.updatePaymentMethod() ?? signInRequired(),
      portal: async () => (await port())?.portal() ?? signInRequired(),
    },
  }
}
