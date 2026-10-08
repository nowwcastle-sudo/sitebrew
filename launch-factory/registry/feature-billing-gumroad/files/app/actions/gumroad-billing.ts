"use server"
// launch-factory: Gumroad 결제 서버 액션. 로그인한 사용자 자신에게만 작용한다. 결제 시작은 청약철회 제한 고지에 동의해야 열린다.
// 해지·결제수단 변경은 Gumroad 화면의 일이라 여기에 없다(어댑터가 provider_unsupported 를 돌려준다).
// 대리 로그인 중에는 읽기(구독 조회)만 되고 결제 시작은 동의 기록 전에 403 으로 막는다(대장 D204). 결제 시작은 요청 제한(checkoutStart — 사용자·IP 별 60초 10번)이 가장 바깥이다(대장 D130).
import { BILLING_READS, blockWhileImpersonating } from "@launch-factory/auth"
import { checkoutAction, withWithdrawalConsent } from "@launch-factory/consent"
import { coded, signInRequiredResult } from "@launch-factory/security/action"
import { headers } from "next/headers"
import { authPort } from "@/lib/launch/auth"
import { DEFAULT_LOCALE } from "@/lib/launch/config"
import { database } from "@/lib/launch/db"
import { gumroad } from "@/lib/launch/gumroad"
import { guardAction } from "@/lib/launch/security"
import { euGate } from "@/lib/launch/eu-sales"

async function session() {
  const s = await (await authPort()).session()
  return s.ok && s.data ? { userId: s.data.userId, ...(s.data.email ? { email: s.data.email } : {}), impersonatedBy: s.data.impersonatedBy } : null
}

const signInRequired = () => signInRequiredResult(DEFAULT_LOCALE)

export async function getGumroadSubscription() {
  const s = await session()
  return coded(async () => (s ? blockWhileImpersonating((await gumroad()).port(s), s, BILLING_READS, DEFAULT_LOCALE).subscription() : signInRequired()), DEFAULT_LOCALE)()
}

export async function startGumroadCheckout(input: unknown) {
  const s = await session()
  if (!s) return signInRequired()
  // 요청 제한이 가장 바깥이다 — 한도 밖의 요청은 동의 기록도 결제 포트(= 거래 만들기)도 닿지 않는다(D130)
  const refused = await guardAction("checkoutStart", { headers: new Headers(await headers()), userId: s.userId })
  if (refused) return refused
  // F10: EU 판매가 닫힌 동안(LF_EU_SALES) EU 접속 지역·결제 국가는 여기서 끝난다(입구 셋 모두, v0.1.1 리뷰 P1-2)
  const eu = await euGate<{ planId: string }>(input, headers, DEFAULT_LOCALE)
  if (!eu.ok) return eu
  // 막는 벽이 동의 기록보다 바깥이다 — 막힌 결제에 청약철회 동의가 남지 않는다
  const withConsent = withWithdrawalConsent((await gumroad()).port(s), { db: await database(), userId: () => s.userId, locale: DEFAULT_LOCALE })
  return coded(checkoutAction(blockWhileImpersonating(withConsent, s, BILLING_READS, DEFAULT_LOCALE), { locale: DEFAULT_LOCALE }), DEFAULT_LOCALE)(eu.input)
}
