"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import type { AnalyticsPort, BillingPort, IsoDate, Plan } from "@/registry/factory/contract/ports"
import { CheckCircle, Lock } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"
import { Button } from "@/registry/factory/ui/button"
import { Switch } from "@/registry/factory/ui/switch"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/registry/factory/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/registry/factory/ui/table"

import { BlockHeading } from "../_shared/block-heading"
import { addDays, fillText, useNow } from "../_shared/billing-format"
import { InAppEscape, type InAppEscapeCopy } from "../_shared/inapp-escape"
import { PlanOffer, type PlanOfferCopy } from "../_shared/plan-offer"
import { usePinnedBarSpace } from "../_shared/pinned-bar-space"
import { ScrollHint } from "../_shared/scroll-hint"
import { FormAlert, goTo, usePortForm } from "../_shared/port-form"
import type { SubmitNotices } from "../_shared/submit-guard"
import { ReadError, ReadLoading, usePortRead } from "../_shared/port-read"

// 업그레이드 대화상자 — 잠긴 기능 자리의 안내 판(자물쇠 · 무엇이 잠겼나 · [○○ 요금제 살펴보기])을 누르면 대화상자가 열린다.
// 첫 화면에 저절로 뜨지 않는다(A6 — 사용자가 연다, 닫기·Esc·바깥 클릭으로 닫히고 포커스를 가둔다). 대화상자 안:
//   지금 요금제 ↔ 목표 요금제 비교표(<table>·<th scope> — P3) → 제안 한 판(plan-offer: 청구액이 가장 크고 환산가는 보조 — P1,
//   체험 기간·첫 결제 금액과 날짜·자동 갱신·해지 방법·약관 링크가 버튼 앞 — P2, 원·VAT 표기 — L1·P3, [나중에 할게요][시작하기] 대등 — L3).
// P3-6 E04: ① 전환 고지(첫 결제일·금액·결제 수단·해지 방법)와 필수 체크가 [행동 줄]과 같은 고정 줄에 있어 스크롤 없이 버튼 곁에 보인다(전자상거래법 §13⑥ — 명시 동의)
// ② 체험 시작은 채운 주 버튼(「이후 금액」까지 버튼 글에) ③ 지금 요금제가 무료(currentPlanId 가 null 이거나 무료 요금제)면 비교표 머리를 「무료 요금제」로
// ④ 닫으면 포커스가 연 버튼으로 돌아온다(finalFocus — 대화상자 부품의 초기·마지막 포커스 칸을 그대로 쓴다).
// 결제는 checkout({ planId }) → redirectUrl(호스팅 결제창)로 가거나 바로 열린 구독이면 완료 안내. 가치를 느낀 자리(잠긴 기능을 누른 순간)에서만
// 제안한다(P6) — 이 블록은 그 기능 자리에 둔다. 계측(선택): 열면 upgrade_prompt_view{trigger}, 시작하면 upgrade_click·checkout_start, 체험이면 trial_start.
export type PaywallUpgradeModalCopy = {
  title: string
  body: string
  open: string // {plan}
  dialog: { title: string; description?: string }
  // currentFree(선택): 지금 요금제가 무료일 때의 표 머리(예: 「무료 요금제」) — 없으면 current. 무료 사용자를 「지금(베이직)」처럼 부르지 않는다(E04)
  compare: { caption: string; feature: string; current: string; currentFree?: string; target: string; scrollHint?: string; rows: { label: string; current: string; target: string }[] }
  // 앱 안 브라우저(카카오톡·네이버·인스타그램 등)로 열렸을 때만 보이는 「기본 브라우저로 열어 주세요」 안내(대장 A61). 없으면 그리지 않는다
  inApp?: InAppEscapeCopy
  offer: PlanOfferCopy
  // 체험 켬/끔 전환(마케팅 규칙 P13, 대장 A6): 체험 기간이 있는 요금제에서 「체험 없이 바로 결제」를 고를 수 있다. 켠 채로 시작(체험이 기본), 끄면 checkout({ trial: false })
  trialChoice?: { label: string; hint: string }
  alert: { field: string; server: string }
  notices: SubmitNotices
  loading: string
  error: string
  retry: string
  done: { title: string; body: string }
}
export type PaywallUpgradeModalProps = BlockBase<PaywallUpgradeModalCopy> & {
  plans: BillingPort["plans"]
  checkout: BillingPort["checkout"]
  track?: AnalyticsPort["track"]
  onRedirect?: (url: string) => void
  // 권할 요금제(없으면 추천 요금제). trigger 는 계측에 싣는 잠긴 기능 이름
  planId?: string
  // 지금 쓰는 요금제 id(선택). null 이면 요금제가 없는 로그인 사용자(무료)다 — 비교표 머리가 copy.compare.currentFree 로 바뀐다. 무료 요금제(금액 0)의 id 여도 같다
  currentPlanId?: string | null
  trigger?: string
  now?: IsoDate
  defaultOpen?: boolean
  initial?: { plans?: Plan[] }
}

export function PaywallUpgradeModal({ copy, locale, timeZone, plans, checkout, track, onRedirect, planId, currentPlanId, trigger = "feature", now, defaultOpen = false, initial, id = "upgrade", className }: PaywallUpgradeModalProps) {
  const openRef = React.useRef<HTMLButtonElement>(null)
  // 행동 줄이 실제 높이만큼 스크롤 여백을 만든다 — 줄 바로 위 띠의 링크·칸이 줄 밑에 가린 채 포커스를 받지 않는다(2.4.11, REL11)
  const dialogRef = usePinnedBarSpace()
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"))
  })
  const today = useNow(now)
  const [open, setOpen] = React.useState(defaultOpen)
  const [done, setDone] = React.useState(false)
  const [trialOn, setTrialOn] = React.useState(true)
  const read = usePortRead(plans, initial?.plans)
  const list = read.state.status === "ready" ? read.state.data : null
  const plan = list ? (list.find((p) => p.id === planId) ?? list.find((p) => p.recommended) ?? list[list.length - 1] ?? null) : null
  const form = usePortForm({ id, notices: copy.notices, onError: (e) => track?.("form_error", { form: "upgrade", fields: e.fields, kind: e.kind }) })
  const openDialog = (next: boolean) => {
    setOpen(next)
    if (next) track?.("upgrade_prompt_view", { trigger })
  }
  const start = async (consent: { withdrawalConsent?: true }) => {
    if (!plan) return
    track?.("upgrade_click", { trigger, planId: plan.id })
    track?.("checkout_start", { planId: plan.id })
    const skipTrial = !!plan.trialDays && !trialOn
    const r = await form.run(() => checkout({ planId: plan.id, ...(skipTrial ? { trial: false } : {}), ...consent }), { retry: () => void start(consent) })
    if (!r) return
    if (r.redirectUrl) return goTo(r.redirectUrl, onRedirect)
    if (r.subscription?.status === "trialing" && plan.trialDays && !skipTrial) track?.("trial_start", { planId: plan.id, trialDays: plan.trialDays })
    setDone(true)
  }
  const planName = plan?.name ?? ""
  // 지금 요금제가 무료인가: 요금제 없음(null) 또는 금액 0 인 요금제. 모르면(undefined) 예전 머리 그대로
  const currentIsFree = currentPlanId === null || (currentPlanId !== undefined && !!list && (list.find((p) => p.id === currentPlanId)?.price.amount ?? 1) === 0)
  const currentHead = currentIsFree && copy.compare.currentFree ? copy.compare.currentFree : copy.compare.current
  // 체험을 끄면 제안 한 판이 「바로 결제」 모양이다(체험 줄·체험 문구 없이 첫 결제 = 오늘)
  const offerPlan = plan && plan.trialDays && !trialOn ? { ...plan, trialDays: undefined } : plan
  return (
    <section ref={ref} id={id} data-block="paywall-upgrade-modal" aria-labelledby={`${id}-title`} className={cn("cn-block-section", className)}>
      <div data-enter className="cn-block-lock">
        <Lock aria-hidden="true" className="cn-block-lock-icon" />
        <BlockHeading id={`${id}-title`} title={copy.title} lead={copy.body} className="cn-block-lock-head" />
        <Dialog open={open} onOpenChange={openDialog}>
          <Button ref={openRef} type="button" size="lg" onClick={() => openDialog(true)} aria-haspopup="dialog" className="cn-block-lock-open cn-block-btn-wrap">
            {fillText(copy.open, { plan: planName || "…" })}
          </Button>
          <DialogContent locale={locale} ref={dialogRef} finalFocus={openRef} className="cn-block-upgrade-dialog">
            <DialogHeader>
              <DialogTitle className="cn-block-upgrade-title">{fillText(copy.dialog.title, { plan: planName })}</DialogTitle>
              {copy.dialog.description ? <DialogDescription className="cn-block-upgrade-desc">{copy.dialog.description}</DialogDescription> : null}
            </DialogHeader>
            {read.state.status === "loading" ? <ReadLoading label={copy.loading} lines={4} /> : null}
            {read.state.status === "error" ? <ReadError state={read.state} title={copy.error} retryLabel={copy.retry} /> : null}
            {done ? (
              <div role="status" className="cn-block-auth-result">
                <CheckCircle aria-hidden="true" className="cn-block-auth-result-icon" />
                <p className="cn-block-auth-result-title font-heading">{copy.done.title}</p>
                <p className="cn-block-auth-result-body">{fillText(copy.done.body, { plan: planName })}</p>
              </div>
            ) : plan ? (
              <div className="cn-block-upgrade-body">
                {copy.compare.rows.length ? (
                  <ScrollHint locale={locale} text={copy.compare.scrollHint} className="cn-block-upgrade-table-wrap">
                    <Table className="cn-block-upgrade-table">
                      <caption className="sr-only">{copy.compare.caption}</caption>
                      <TableHeader>
                        <TableRow>
                          <TableHead scope="col">{copy.compare.feature}</TableHead>
                          <TableHead scope="col">{currentHead}</TableHead>
                          <TableHead scope="col">{fillText(copy.compare.target, { plan: planName })}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {copy.compare.rows.map((r) => (
                          <TableRow key={r.label}>
                            <TableHead scope="row" className="cn-block-upgrade-row-head">
                              {r.label}
                            </TableHead>
                            <TableCell /* numeric-cell: 글자 열 */>{r.current}</TableCell>
                            <TableCell /* numeric-cell: 글자 열 */ className="cn-block-upgrade-target">{r.target}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollHint>
                ) : null}
                <FormAlert form={form} fieldTitle={copy.alert.field} serverTitle={copy.alert.server} />
                {copy.inApp ? <InAppEscape copy={copy.inApp} /> : null}
                {plan.trialDays && copy.trialChoice ? (
                  <div data-trial-choice="" className="cn-block-upgrade-trial">
                    <Switch id={`${id}-trial`} checked={trialOn} onCheckedChange={setTrialOn} aria-describedby={`${id}-trial-hint`} />
                    <div className="cn-block-upgrade-trial-text">
                      <label htmlFor={`${id}-trial`} className="cn-block-upgrade-trial-label">
                        {copy.trialChoice.label}
                      </label>
                      <p id={`${id}-trial-hint`} className="cn-block-upgrade-trial-hint">
                        {copy.trialChoice.hint}
                      </p>
                    </div>
                  </div>
                ) : null}
                <PlanOffer locale={locale} timeZone={timeZone} plan={offerPlan ?? plan} copy={copy.offer} firstChargeAt={offerPlan?.trialDays ? addDays(today, offerPlan.trialDays) : undefined} onCheckout={start} onDecline={() => setOpen(false)} pinActions className="cn-block-upgrade-offer" pending={form.pending} holdLabel={form.holdLabel} />
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
      </div>
    </section>
  )
}
