"use client"

import * as React from "react"

import type { AnalyticsPort } from "@/components/contract/ports"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"

import { ChoiceButton, ChoiceRow } from "../_shared/choice-pair"

// 쿠키 항목별 설정 대화상자(P3-6 K04 — 공유 조각 block-shared-consent-prefs). consent/preference-dialog 의 대화상자 쪽을 그대로 꺼냈다 —
// consent/bottom-banner 도 같은 대화상자를 쓰므로(띠의 「항목별로 고르기」·푸터의 「쿠키 설정」이 둘 다 이것을 연다) 한 곳에 둔다.
// 필수(늘 켜짐 — 끌 수 없음을 글로) · 분석 · 마케팅 스위치(선택 — 결정 전에는 꺼짐, data-consent="optional", L2) · [선택한 대로 저장하기] ·
// [모두 거부하기][모두 허용하기] 대등(L3). 저장은 setConsent(포트), 닫기·Esc 는 저장하지 않는다. 계측(consent_update)은 부르는 블록이 onSaved 에서 한다(M1 — 블록 원천이 이벤트 이름을 직접 부른다). 열린 상태는 부르는 쪽이 쥔다(open·onOpenChange).
export type ConsentCategory = "analytics" | "marketing"
export type ConsentPrefsCopy = {
  dialog: { title: string; description: string }
  necessary: { label: string; body: string; always: string }
  categories: Record<ConsentCategory, { label: string; body: string }>
  marker: string
  save: string
  decline: string
  accept: string
}
export type ConsentPrefsDialogProps = {
  copy: ConsentPrefsCopy
  locale?: "ko" | "en"
  id: string
  open: boolean
  onOpenChange: (open: boolean) => void
  consent: AnalyticsPort["consent"]
  setConsent: AnalyticsPort["setConsent"]
  // 저장한 직후(setConsent 뒤) — 부르는 쪽이 요약 판·띠 상태를 새 결정으로 맞춘다.
  onSaved?: (next: Record<ConsentCategory, boolean>) => void
  // 닫을 때 포커스를 돌려줄 요소(푸터 링크처럼 DialogTrigger 가 아닌 곳에서 연 경우). 없으면 연 요소를 부품이 알아서 돌려준다.
  returnFocusTo?: React.RefObject<Element | null>
}

const pick = (c: { analytics: boolean; marketing: boolean }): Record<ConsentCategory, boolean> => ({ analytics: c.analytics, marketing: c.marketing })

export function ConsentPrefsDialog({ copy, locale, id, open, onOpenChange, consent, setConsent, onSaved, returnFocusTo }: ConsentPrefsDialogProps) {
  const [draft, setDraft] = React.useState<Record<ConsentCategory, boolean>>(() => pick(consent()))
  // 열릴 때마다 지금 저장된 결정으로 시작한다(렌더 중 상태 맞추기)
  const [wasOpen, setWasOpen] = React.useState(open)
  if (wasOpen !== open) {
    setWasOpen(open)
    if (open) setDraft(pick(consent()))
  }
  const save = (next: Record<ConsentCategory, boolean>) => {
    setConsent(next)
    onSaved?.(next)
    onOpenChange(false)
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        locale={locale}
        className="max-h-[calc(100dvh-2rem)] gap-5 overflow-y-auto sm:max-w-xl"
        finalFocus={returnFocusTo ? () => (returnFocusTo.current instanceof HTMLElement && returnFocusTo.current.isConnected ? returnFocusTo.current : true) : undefined}
      >
        <DialogHeader>
          <DialogTitle className="text-[1.563rem] leading-[1.25]">{copy.dialog.title}</DialogTitle>
          <DialogDescription className="text-base leading-[1.6] text-foreground">{copy.dialog.description}</DialogDescription>
        </DialogHeader>
        <ul className="flex flex-col border-y">
          <li className="flex items-start justify-between gap-4 border-b py-4 last:border-b-0">
            <div className="flex min-w-0 flex-col gap-1">
              <p className="text-base leading-[1.5] font-heading">{copy.necessary.label}</p>
              <p className="text-base leading-[1.6]">{copy.necessary.body}</p>
            </div>
            <span className="shrink-0 text-base">{copy.necessary.always}</span>
          </li>
          {(["analytics", "marketing"] as const).map((c) => (
            <li key={c} className="flex items-start justify-between gap-4 border-b py-4 last:border-b-0">
              <div className="flex min-w-0 flex-col gap-1">
                <label htmlFor={`${id}-${c}`} className="text-base leading-[1.5] font-heading">
                  {copy.categories[c].label}
                  <span className="ms-1 text-base">{copy.marker}</span>
                </label>
                <p id={`${id}-${c}-desc`} className="text-base leading-[1.6]">
                  {copy.categories[c].body}
                </p>
              </div>
              <Switch id={`${id}-${c}`} data-consent="optional" checked={draft[c]} aria-describedby={`${id}-${c}-desc`} onCheckedChange={(v) => setDraft((d) => ({ ...d, [c]: v }))} />
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-3">
          <Button type="button" variant="outline" size="lg" onClick={() => save(draft)} className="w-full">
            {copy.save}
          </Button>
          <ChoiceRow label={copy.dialog.title}>
            <ChoiceButton choice="decline" type="button" onClick={() => save({ analytics: false, marketing: false })}>
              {copy.decline}
            </ChoiceButton>
            <ChoiceButton choice="primary" type="button" onClick={() => save({ analytics: true, marketing: true })}>
              {copy.accept}
            </ChoiceButton>
          </ChoiceRow>
        </div>
      </DialogContent>
    </Dialog>
  )
}
