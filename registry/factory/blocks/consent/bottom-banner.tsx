"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import type { AnalyticsPort } from "@/registry/factory/contract/ports"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"

import { useBottomBarSpace } from "../_shared/bottom-bar-space"
import { ChoiceButton, ChoiceRow } from "../_shared/choice-pair"
import { useConsentOpener } from "../_shared/consent-open"
import { ConsentPrefsDialog, type ConsentPrefsCopy } from "../_shared/consent-prefs"

// 쿠키 동의 아래 띠 — 화면 아래에 붙는 한 줄 띠(가림막 없음, 첫 화면의 30% 미만 — 넘치면 띠 안에서만 스크롤, 마케팅 규칙 X3·A6):
// 한 줄 제목 · 무엇을 모으고 왜 묻는지 · 개인정보 처리방침 링크 · [모두 거부하기][모두 허용하기] 대등(L3) · 「항목별로 고르기」 링크(설정 대화상자).
// 결정 전(consent().decidedAt 없음)에만 보이고, 누르면 setConsent 로 저장한 뒤 사라진다(저장은 포트 — 계측 동의는 어댑터가 따른다).
// 거부해도 사이트의 모든 내용을 그대로 쓴다(쿠키벽 없음). 계측(선택): 결정하면 consent_update{analytics, marketing}.
// 다시 열기(P3-6 K04·J07): 푸터의 「쿠키 설정」 링크(`data-consent-open`, _shared/consent-open)가 결정한 뒤에도 항목별 설정 대화상자(copy.preferences — 있으면)를 열어
// 분석·마케팅을 카테고리별로 바꾸거나 철회한다(동의만큼 쉽게 — GDPR Art.7(3)). copy.preferences 가 없으면 띠가 다시 떠서 모두 허용·모두 거부를 고르게 한다.
// 375px 에서 띠는 화면 높이의 1/5(20dvh)를 넘지 않는다 — 넘치면 띠 안에서만 스크롤하고, 가림막·초점 가두기는 없다.
export type ConsentBottomBannerCopy = {
  title: string
  body: string
  policy: { label: string; href: string }
  settings?: { label: string; href: string }
  // 항목별 설정 대화상자 글(선택) — 있으면 「항목별로 고르기」가 이 쪽 대화상자를 여는 단추가 되고(href 는 자바스크립트 없는 길), 푸터 링크도 이것을 연다
  preferences?: ConsentPrefsCopy
  decline: string
  accept: string
  saved: string
}
export type ConsentBottomBannerProps = BlockBase<ConsentBottomBannerCopy> & {
  consent: AnalyticsPort["consent"]
  setConsent: AnalyticsPort["setConsent"]
  track?: AnalyticsPort["track"]
}

export function ConsentBottomBanner({
  copy,
  locale,
  consent,
  setConsent,
  track,
  id = "cookie-banner",
  className,
}: ConsentBottomBannerProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"), { y: 12 })
  })
  const [decided, setDecided] = React.useState(() => !!consent().decidedAt)
  const [saved, setSaved] = React.useState(false)
  // 띠가 떠 있는 동안 그 높이만큼 scroll-padding-bottom 을 주어 키보드로 옮긴 요소가 띠 뒤에 숨지 않게 한다(대장 A107, WCAG 2.4.11) — 결정하면 되돌린다
  const none = React.useRef<HTMLElement>(null)
  useBottomBarSpace(decided ? none : ref, { pad: true })
  // 동의 포트가 바뀌면(다른 사용자·다른 목) 그 결정 상태로 다시 맞춘다
  const [source, setSource] = React.useState(() => consent)
  if (source !== consent) {
    setSource(() => consent)
    setDecided(!!consent().decidedAt)
    setSaved(false)
  }
  // 항목별 설정 대화상자 — 띠에서도 푸터 링크에서도 연다. 푸터에서 열었으면 닫을 때 그 링크로 포커스를 돌려준다.
  const [prefsOpen, setPrefsOpen] = React.useState(false)
  const returnRef = React.useRef<Element | null>(null)
  const hasPrefs = !!copy.preferences
  useConsentOpener((from) => {
    returnRef.current = from
    if (hasPrefs) setPrefsOpen(true)
    else {
      setDecided(false)
      setSaved(false)
    }
  }, hasPrefs ? 2 : 1)
  const prefs = copy.preferences ? (
    <ConsentPrefsDialog
      id={id}
      locale={locale}
      open={prefsOpen}
      onOpenChange={setPrefsOpen}
      copy={copy.preferences}
      consent={consent}
      setConsent={setConsent}
      onSaved={(next) => {
        track?.("consent_update", next)
        setDecided(true)
        setSaved(true)
      }}
      returnFocusTo={returnRef}
    />
  ) : null
  const decide = (all: boolean) => {
    const next = { analytics: all, marketing: all }
    setConsent(next)
    track?.("consent_update", next)
    setDecided(true)
    setSaved(true)
  }
  // 띠는 섹션 자체가 화면 아래에 붙는다 — 장면 뿌리가 늘 화면 안에 있어 등장이 곧바로 돈다(문서 끝에 두어도 스크롤을 기다리지 않는다).
  if (decided)
    return (
      <section
        ref={ref}
        id={id}
        data-block="consent-bottom-banner"
        aria-labelledby={`${id}-title`}
        className={cn("cn-block-cookie-done", className)}
      >
        <h2 id={`${id}-title`} className="sr-only">
          {copy.title}
        </h2>
        <p role="status" className="sr-only">
          {saved ? copy.saved : ""}
        </p>
        {prefs}
      </section>
    )
  return (
    <section
      ref={ref}
      id={id}
      data-block="consent-bottom-banner"
      data-consent-banner=""
      aria-labelledby={`${id}-title`}
      className={cn("cn-block-cookie", className)}
    >
      <div data-enter className="cn-block-cookie-body-wrap">
        <div className="cn-block-cookie-inner">
          <div className="cn-block-cookie-text">
            <h2
              id={`${id}-title`}
              className="cn-block-cookie-title font-heading"
            >
              {copy.title}
            </h2>
            <p className="cn-block-cookie-body">
              {copy.body}{" "}
              <a href={copy.policy.href} className="cn-block-cookie-link">
                {copy.policy.label}
              </a>
              {copy.settings ? (
                <>
                  {" · "}
                  {hasPrefs ? (
                    <button
                      type="button"
                      aria-haspopup="dialog"
                      className="cn-block-cookie-link"
                      onClick={() => {
                        returnRef.current = null
                        setPrefsOpen(true)
                      }}
                    >
                      {copy.settings.label}
                    </button>
                  ) : (
                    <a href={copy.settings.href} className="cn-block-cookie-link">
                      {copy.settings.label}
                    </a>
                  )}
                </>
              ) : null}
            </p>
          </div>
          <div className="cn-block-cookie-actions">
            <ChoiceRow label={copy.title}>
              <ChoiceButton
                choice="decline"
                type="button"
                onClick={() => decide(false)}
              >
                {copy.decline}
              </ChoiceButton>
              <ChoiceButton
                choice="primary"
                type="button"
                onClick={() => decide(true)}
              >
                {copy.accept}
              </ChoiceButton>
            </ChoiceRow>
          </div>
        </div>
      </div>
      {prefs}
    </section>
  )
}
