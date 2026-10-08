"use client"

import * as React from "react"

import type { IsoDate, Money, Plan } from "@/components/contract/ports"
import { LoaderCircle } from "@/components/icons"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { usePendingGate } from "@/components/ui/spinner"

import { DateText, MoneyText, fill, vatLabel } from "../_shared/billing-format"
import { ChoiceButton, ChoiceRow } from "../_shared/choice-pair"
import { ApprovalHint } from "../_shared/human-approval"
import { humanApprovalProps } from "@/components/contract/human-actions"

// 요금제 제안 한 판(P3-2 레인 D1 공유 조각 block-shared-plan-offer — paywall 네 변형이 같이 쓴다). factory-rules.md §22-2:
//   · P1 실제 청구액(data-price="billed")이 가장 크고, 환산가(하루·한 달 꼴, data-price="equivalent")는 보조 크기다.
//   · P2 결제·체험을 시작하는 버튼 앞, 같은 판에 체험 기간 · 첫 청구 금액과 날짜 · 자동 갱신 · 해지 방법 · 약관·개인정보 링크를 둔다(data-terms).
//   · P3·L1 금액은 글자이고 통화(원)·주기·VAT 표기를 함께 쓴다.
//   · L3 두 선택지(나중에 · 시작하기)는 대등하다(choice-pair).
// 대화상자 안(pinActions, P3-6 E04): 스크롤해야 보이던 전환 고지(첫 결제일·금액·결제 수단·해지 방법)와 필수 체크를 [행동 줄]과 같은 고정 줄에 둔다 — 눌러야 아는 체크가 없고,
//   버튼 바로 위에서 날짜·금액·해지 방법을 읽고 동의한다. emphasis="primary" 면 주 선택지(체험 시작)는 채운 주 버튼이다(나중에 할게요 는 같은 크기·같은 줄의 외곽선 버튼 —
//   「나중에」는 동의를 거절하는 선택지가 아니라 제안을 닫는 선택지라 data-choice="dismiss"). 기본 "equal" 은 두 선택지가 같은 모양이다(choice-pair).
// 결제는 포트 checkout({ planId, withdrawalConsent: true }) 하나라(체험 여부를 고르는 인자가 없다) 체험 켬/끔 전환(P13)은 두지 않는다 — 체험이 있는 요금제는 체험으로 시작한다.
//   · 청약철회 제한 고지(Task 10d, 대장 D61·A52): 전자상거래법 제17조 제2항 제5호(디지털콘텐츠 제공이 시작되면 철회 제한)와 제6항 단서(제한 사실의 「표시」와 시험 사용 안내)에 따라
//     버튼 앞 같은 판에 고지 글(data-terms="withdrawal")과 필수 체크 1칸을 둔다. 체크는 미리 켜 두지 않는다(전자상거래법 §21-2①2와 같은 방향) —
//     체크 없이 [결제]를 누르면 결제를 시작하지 않고 그 자리에 오류를 보이며 체크 칸으로 포커스를 옮긴다. 시작할 때 onCheckout({ withdrawalConsent: true })를 부른다.

export type PlanOfferCopy = {
  /** 사람 승인 안내 글(R18) — 결제 버튼 곁에 한 줄. 권장: APPROVAL_HINT */
  humanHint: string
  perMonth: string // 「월」
  perYear: string // 「년」
  vatIncluded: string
  vatExcluded: string
  equivalentMonth: string // 월 요금제의 하루 꼴 — {amount}
  equivalentYear: string // 연 요금제의 한 달 꼴 — {amount}
  trial: string // {days}
  firstCharge: string // {date} · {amount} · {vat}
  chargeNow: string // {amount} · {vat}
  autoRenewMonth: string
  autoRenewYear: string
  howToCancel: string
  termsLabel: string
  termsHref: string
  privacyLabel: string
  privacyHref: string
  ctaTrial: string // {days}
  // 체험 시작 버튼 글에 체험이 끝난 뒤 금액을 함께 적는 틀(선택, P3-6 E04 — 전자상거래법 §13⑥: 버튼을 누르는 행동이 전환 동의이므로 버튼 글에서도 이후 결제가 보인다) — {days} · {amount} · {per}. 없으면 ctaTrial
  ctaTrialThen?: string
  ctaPay: string // {amount}
  decline: string
  pendingLabel: string
  // 청약철회 제한 고지(전자상거래법 제17조 — 디지털콘텐츠·용역 제공이 시작되면 철회를 제한한다): notice 제한 사실, trial 시험 사용 안내(체험·미리보기 등 — 있으면 함께 보인다),
  // consentLabel 체크 글, consentRequired 체크 없이 눌렀을 때 오류
  // 없으면 고지·체크를 그리지 않고 결제를 바로 시작한다 — 사업자가 제한을 두지 않을 때(legal.withdrawalPolicy "full", 06-pages 가 이 칸을 뺀다)
  withdrawal?: { notice: string; trial?: string; consentLabel: string; consentRequired: string }
}

/** 환산가: 월 요금제는 하루(÷30), 연 요금제는 한 달(÷12) — 10원 단위 반올림. 한 번 결제는 없다 */
export function equivalentOf(plan: Plan): Money | null {
  if (plan.interval === "once") return null
  const div = plan.interval === "month" ? 30 : 12
  const unit = plan.price.currency === "KRW" || plan.price.currency === "JPY" ? 10 : 1
  return { ...plan.price, amount: Math.round(plan.price.amount / div / unit) * unit }
}

/**
 * 단추 글 틀을 채우되 {amount} 가 든 낱말 덩어리(공백 없는 한 토막 — 「{amount}/{per}」·「{amount}」)를 한 덩어리로 묶는다 —
 * 좁은 단추에서 「29,000 / 원 / 월」처럼 금액·통화·기간이 갈라지지 않는다(REL12). 글 전체는 한 칸(span)에 담아 단추의 flex 가 조각마다 칸을 만들지 않게 한다.
 */
function fillPrice(template: string, vars: Record<string, React.ReactNode>): React.ReactNode[] {
  return template.split(/(\s+)/).map((tok, i) =>
    tok.includes("{amount}") ? (
      <span key={i} className="whitespace-nowrap">
        {fill(tok, vars)}
      </span>
    ) : (
      <React.Fragment key={i}>{fill(tok, vars)}</React.Fragment>
    ),
  )
}

export function PlanOffer({
  plan,
  copy,
  firstChargeAt,
  onCheckout,
  onDecline,
  pending = false,
  holdLabel,
  declineLabel,
  declineHref,
  ctaLabel,
  pinActions = false,
  emphasis = "equal",
  locale,
  timeZone,
  className,
}: {
  // 날짜(처음 결제일)를 읽는 로캘·시간대(선택, D234) — 블록의 locale·timeZone 을 그대로 넘긴다
  locale?: string
  timeZone?: string
  plan: Plan
  copy: PlanOfferCopy
  // 처음 결제되는 때. 체험이 있는 요금제는 블록이 오늘 + trialDays 로 셈한다(체험 줄이 붙는다). 체험 끝 예고처럼 체험 없이 줄 수도 있다
  // (그러면 「그날 처음 결제돼요」만). 없으면 「오늘 결제돼요」
  firstChargeAt?: IsoDate
  // 주 선택지 글(없으면 체험 시작하기·결제하고 시작하기)
  ctaLabel?: string
  // 청약철회 제한 고지에 체크했을 때만 부른다(결제 칸 withdrawalConsent 로 그대로 넘긴다)
  // 고지·체크가 없는 제안(copy.withdrawal 없음)은 빈 객체로 부른다(체크를 받지 않았으니 withdrawalConsent 를 싣지 않는다)
  onCheckout: (consent: { withdrawalConsent?: true }) => void
  onDecline: () => void
  pending?: boolean
  // 요청 제한 대기 중 버튼 글(남은 초) — 있으면 [결제]가 잠기고 이 글이 보인다
  holdLabel?: string
  declineLabel?: string
  // 주면 거절 선택지가 그 주소로 가는 링크다(무료로 계속 — 새 화면을 연다). 없으면 onDecline 버튼
  declineHref?: string
  // 대화상자 안에서 쓸 때: 내용이 스크롤 칸보다 길어도 [나중에 할게요][시작하기] 줄이 대화상자 아래에 붙어 늘 보이게 한다(스크롤 칸은 대화상자)
  pinActions?: boolean
  // "equal"(기본): 두 선택지가 대등한 외곽선(L3). "primary": 주 선택지만 채운 주 버튼(업그레이드 대화상자 — 감사 E04)
  emphasis?: "equal" | "primary"
  className?: string
}) {
  const trial = plan.trialDays && firstChargeAt ? plan.trialDays : 0
  const consentId = React.useId()
  const hintId = `${consentId}-human-hint`
  const consentBox = React.useRef<HTMLDivElement>(null)
  const [agreed, setAgreed] = React.useState(false)
  const [needConsent, setNeedConsent] = React.useState(false)
  const spin = usePendingGate(pending)
  const { withdrawal } = copy
  const start = () => {
    if (!withdrawal) {
      onCheckout({})
      return
    }
    if (!agreed) {
      setNeedConsent(true)
      consentBox.current?.querySelector<HTMLElement>("[role=checkbox]")?.focus()
      return
    }
    onCheckout({ withdrawalConsent: true })
  }
  const vat = vatLabel(plan.price, copy)
  const eq = equivalentOf(plan)
  const per = plan.interval === "year" ? copy.perYear : copy.perMonth
  const amount = <MoneyText money={plan.price} />
  const primaryLabel = pending
    ? copy.pendingLabel
    : holdLabel
      ? holdLabel
      : ctaLabel
        ? ctaLabel
        : trial
          ? copy.ctaTrialThen
            ? fillPrice(copy.ctaTrialThen, { days: trial, amount: <MoneyText money={plan.price} />, per })
            : fill(copy.ctaTrial, { days: trial })
          : fillPrice(copy.ctaPay, { amount: <MoneyText money={plan.price} /> })
  const spinner = spin ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" /> : null
  const actions =
    emphasis === "primary" ? (
      <>
        <ApprovalHint id={hintId}>{copy.humanHint}</ApprovalHint>
      <ChoiceRow>
        {declineHref ? (
          <Button variant="outline" size="lg" nativeButton={false} role="link" render={<a href={declineHref} />} onClick={onDecline} data-choice="dismiss" className="h-auto min-h-12 w-full min-w-0 px-4 py-2 text-base leading-[1.35] whitespace-normal">
            {declineLabel ?? copy.decline}
          </Button>
        ) : (
          <Button type="button" variant="outline" size="lg" onClick={onDecline} data-choice="dismiss" className="h-auto min-h-12 w-full min-w-0 px-4 py-2 text-base leading-[1.35] whitespace-normal">
            {declineLabel ?? copy.decline}
          </Button>
        )}
        <Button type="button" variant="default" size="lg" disabled={pending || !!holdLabel} focusableWhenDisabled onClick={start} data-choice="primary" data-primary-action="" className="h-auto min-h-12 w-full min-w-0 px-4 py-2 text-base leading-[1.35] whitespace-normal" {...humanApprovalProps("checkout", hintId)}>
          {spinner}
          <span className="min-w-0 text-center text-balance">{primaryLabel}</span>
        </Button>
      </ChoiceRow>
      </>
    ) : (
      <>
        <ApprovalHint id={hintId}>{copy.humanHint}</ApprovalHint>
      <ChoiceRow>
        {declineHref ? (
          <ChoiceButton choice="decline" nativeButton={false} role="link" render={<a href={declineHref} />} onClick={onDecline}>
            {declineLabel ?? copy.decline}
          </ChoiceButton>
        ) : (
          <ChoiceButton choice="decline" type="button" onClick={onDecline}>
            {declineLabel ?? copy.decline}
          </ChoiceButton>
        )}
        <ChoiceButton choice="primary" type="button" disabled={pending || !!holdLabel} focusableWhenDisabled onClick={start} {...humanApprovalProps("checkout", hintId)}>
          {spinner}
          <span className="min-w-0 text-center text-balance">{primaryLabel}</span>
        </ChoiceButton>
      </ChoiceRow>
      </>
    )
  // 고지 두 줄(첫 결제일·금액 / 해지 방법)과 필수 체크: 대화상자에서는 행동 줄 위의 고정 줄로 옮겨 스크롤 없이 버튼 곁에 보인다
  const firstChargeTerm = (
    <li data-terms="first-charge">{firstChargeAt ? fill(copy.firstCharge, { date: <DateText locale={locale} timeZone={timeZone} iso={firstChargeAt} as="since" />, amount, vat }) : fill(copy.chargeNow, { amount, vat })}</li>
  )
  const cancelTerm = <li data-terms="cancel">{copy.howToCancel}</li>
  const consentField = withdrawal ? (
    <div ref={consentBox} data-terms="consent" className="flex flex-col">
      <Field orientation="horizontal" data-invalid={needConsent && !agreed ? "true" : undefined} className="items-start gap-3">
        <Checkbox
          id={consentId}
          name="withdrawalConsent"
          data-consent="required"
          className="size-6 [&_[data-slot=checkbox-indicator]>svg]:size-4"
          checked={agreed}
          onCheckedChange={(v) => {
            setAgreed(v)
            if (v) setNeedConsent(false)
          }}
          aria-required="true"
          aria-invalid={needConsent && !agreed ? true : undefined}
          aria-describedby={needConsent && !agreed ? `${consentId}-error` : undefined}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <FieldLabel htmlFor={consentId}>{withdrawal.consentLabel}</FieldLabel>
          {needConsent && !agreed ? <FieldError id={`${consentId}-error`}>{withdrawal.consentRequired}</FieldError> : null}
        </div>
      </Field>
    </div>
  ) : null
  return (
    <div data-offer={plan.id} className={cn("flex w-full flex-col gap-4", className)}>
      <p className="text-[1.25rem] leading-[1.35] font-heading">{plan.name}</p>
      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <MoneyText money={plan.price} price="billed" className="text-[2.441rem] leading-none tabular-nums font-heading" />
        <span className="text-base leading-[1.5]">
          {plan.interval === "once" ? vat : `/${per} · ${vat}`}
        </span>
      </p>
      {eq ? <p className="text-base leading-[1.5]">{fill(plan.interval === "month" ? copy.equivalentMonth : copy.equivalentYear, { amount: <MoneyText money={eq} price="equivalent" className="text-base" /> })}</p> : null}
      <ul className="flex list-disc flex-col gap-1.5 border-t ps-5 pt-4 text-base leading-[1.6]">
        {trial ? <li data-terms="trial">{fill(copy.trial, { days: <span data-numeric>{trial}</span> })}</li> : null}
        {pinActions ? null : firstChargeTerm}
        {plan.interval !== "once" ? <li data-terms="auto-renew">{plan.interval === "year" ? copy.autoRenewYear : copy.autoRenewMonth}</li> : null}
        {pinActions ? null : cancelTerm}
      </ul>
      <p data-terms="links" className="flex flex-wrap gap-x-4">
        <a href={copy.termsHref} className="relative inline-flex min-h-11 items-center text-base underline underline-offset-4">
          {copy.termsLabel}
        </a>
        <a href={copy.privacyHref} className="relative inline-flex min-h-11 items-center text-base underline underline-offset-4">
          {copy.privacyLabel}
        </a>
      </p>
      {withdrawal ? (
        <div data-terms="withdrawal" className="flex flex-col gap-2 border-t pt-4">
          <p className="text-base leading-[1.6]">{withdrawal.notice}</p>
          {withdrawal.trial ? <p className="text-base leading-[1.6]">{withdrawal.trial}</p> : null}
          {pinActions ? null : consentField}
        </div>
      ) : null}
      {pinActions ? (
        <div data-pinned-bar="" className="sticky -bottom-4 z-10 -mx-4 -mb-4 flex w-auto flex-col gap-3 border-t bg-popover px-4 pt-3 pb-4">
          <ul data-pinned-terms="" className="flex list-disc flex-col gap-1 ps-5 text-base leading-[1.5]">
            {firstChargeTerm}
            {cancelTerm}
          </ul>
          {consentField}
          {actions}
        </div>
      ) : (
        actions
      )}
    </div>
  )
}
