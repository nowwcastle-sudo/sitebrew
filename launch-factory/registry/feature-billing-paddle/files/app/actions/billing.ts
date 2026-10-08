"use server"
// launch-factory: 결제 서버 액션. 로그인한 사용자 자신의 구독에만 작용한다(세션에서 userId 를 읽는다 — 입력으로 받지 않는다).
// 결제 시작은 요청 제한(checkoutStart — 사용자·IP 별 60초 10번, D130)을 먼저 지나고, 청약철회 제한 고지에 동의해야 열린다(동의 기록 저장, 전자상거래법 제17조제2항). 유료 기능의 서버 쪽 입구는 requireEntitlement 로 막는다.
// 대리 로그인(관리자가 사용자 대신 들어온 세션) 중에는 읽기(구독 조회)만 되고 나머지는 결제 포트를 부르기 전에 403 으로 막는다(대장 D204).
// 가격 변경 동의·해지는 사람의 확인 입력(`confirmed: true`) 없이는 실행하지 않는다(LFAX M03) — 없으면 결제 포트를 부르지 않고 confirmation_required.
import { BILLING_READS, blockWhileImpersonating } from "@launch-factory/auth"
import { checkoutAction, confirmedBillingActions, withWithdrawalConsent } from "@launch-factory/consent"
import { coded, signInRequiredResult } from "@launch-factory/security/action"
import { headers } from "next/headers"
import { authPort } from "@/lib/launch/auth"
import { billing } from "@/lib/launch/billing"
import { DEFAULT_LOCALE } from "@/lib/launch/config"
import { database } from "@/lib/launch/db"
import { guardAction } from "@/lib/launch/security"
import { euGate } from "@/lib/launch/eu-sales"

async function session() {
  const s = await (await authPort()).session()
  return s.ok && s.data ? { userId: s.data.userId, ...(s.data.orgId ? { orgId: s.data.orgId } : {}), impersonatedBy: s.data.impersonatedBy } : null
}

/** 결제 포트. 대리 세션이면 읽기 밖의 메서드는 부르지 않고 막는다 */
async function port() {
  const s = await session()
  return s ? blockWhileImpersonating((await billing()).port(s), s, BILLING_READS, DEFAULT_LOCALE) : null
}

const signInRequired = () => signInRequiredResult(DEFAULT_LOCALE)
const locale = DEFAULT_LOCALE

export async function getSubscription() {
  return coded(async () => (await port())?.subscription() ?? signInRequired(), locale)()
}

export async function startCheckout(input: unknown) {
  const s = await session()
  if (!s) return signInRequired()
  // 요청 제한이 가장 바깥이다 — 한도 밖의 요청은 동의 기록도 결제 포트(= 거래 만들기)도 닿지 않는다(D130)
  const refused = await guardAction("checkoutStart", { headers: new Headers(await headers()), userId: s.userId })
  if (refused) return refused
  // F10: EU 판매가 닫힌 동안(LF_EU_SALES) EU 접속 지역·결제 국가는 여기서 끝난다 — 동의 기록·거래가 생기지 않는다(입구 셋 모두, v0.1.1 리뷰 P1-2)
  const eu = await euGate<{ planId: string }>(input, headers, DEFAULT_LOCALE)
  if (!eu.ok) return eu
  // 막는 벽이 동의 기록보다 바깥이다 — 막힌 결제에 청약철회 동의가 남지 않는다
  const withConsent = withWithdrawalConsent((await billing()).port(s), { db: await database(), userId: () => s.userId, locale: DEFAULT_LOCALE })
  return coded(checkoutAction(blockWhileImpersonating(withConsent, s, BILLING_READS, DEFAULT_LOCALE), { locale: DEFAULT_LOCALE }), locale)(eu.input)
}

export async function openPortal() {
  return coded(async () => (await port())?.portal() ?? signInRequired(), locale)()
}

/** 입력: { confirmed: true }. 확인 입력이 없으면 결제 포트를 부르지 않는다 */
export async function acceptPriceChange(input: { confirmed: true }) {
  return coded(async () => {
    const p = await port()
    return p ? confirmedBillingActions(p, { locale }).acceptPriceChange(input) : signInRequired()
  }, locale)()
}

/** 해지는 기간 끝에 한다. 사유·자유 글은 받지 않는다(계측 props 로 새지 않게). 입력: { confirmed: true } */
export async function cancelAtPeriodEnd(input: { confirmed: true }) {
  return coded(async () => {
    const p = await port()
    return p ? confirmedBillingActions(p, { locale }).cancel({ ...(input as { confirmed: true }), when: "period_end" }) : signInRequired()
  }, locale)()
}

export async function resumeSubscription() {
  return coded(async () => (await port())?.resume() ?? signInRequired(), locale)()
}
