"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import type { AnalyticsPort, IsoDate } from "@/registry/factory/contract/ports"
import { X } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"
import { Button } from "@/registry/factory/ui/button"

import { DateText, fill, useNow } from "../_shared/billing-format"
import { ChoiceButton, ChoiceRow } from "../_shared/choice-pair"
import { useDismissMemory } from "../_shared/dismiss-memory"
import { ScrollText, useFloatingSpace } from "../_shared/floating-kit"

// 창 공지(휴무·점검·행사 안내 같은 알림 창). 「오늘 하루 보지 않기」 한국형 선택을 갖춘 비모달 창이다.
//   · 첫 화면 행동을 막지 않는다: 가림 막(scrim)이 없고 모달이 아니며(초점을 가두지 않는다), 화면 가장자리에 작게 앉는다(넓은 화면은 오른쪽 아래 카드, 좁은 화면은 아래 판).
//     높이는 화면의 35%(35dvh)를 넘지 않는다 — 글이 길면 본문 칸만 스크롤 칸(ScrollText)이 되고 제목 줄(제목 + 닫기 단추)과 행동 단추 줄은 늘 보인다(marketing first-screen-modal 문턱).
//     닫기 단추는 제목 줄 안에 있고 스크롤 칸과 겹치지 않는다(초점 칸이 된 스크롤 칸 위에 단추가 얹히면 누를 자리가 겹친다 — hit 겹침).
//     하이드레이션 뒤에 나타난다(기억을 읽기 전에는 그리지 않아 이미 닫은 방문자에게 번쩍 보이지 않는다).
//   · 닫는 길 셋: 닫기 단추(이번 방문 동안 — 세션 기억), 「오늘 하루 보지 않기」(오늘 날짜를 이 기기에만 적는다 — 자정이 지나면 다시 보인다), Esc. 닫은 것은 기억한다(A6).
//   · 서버로 보내는 것이 없다: 닫은 날짜는 이 브라우저의 localStorage 에만 쓴다(방문자 식별·분석 아님). 저장소를 못 쓰는 곳(사생활 보호 창)에서는 이번 화면에서만 닫힌다.
//   · 초점: 닫기 단추가 창의 첫 눌리는 요소이고, 창이 뜰 때 사용자가 아직 어디에도 초점을 두지 않았으면(body) 닫기 단추가 처음 초점을 받는다 — 키보드로 바로 닫을 수 있다. 이미 다른 곳에서 작업 중이면 초점을 빼앗지 않는다.
//   · 끝나는 날(endsAt, 필수)이 지나면 그리지 않는다(A8). 거절 「오늘 하루 보지 않기」와 권하는 행동은 대등한 크기·대비(choice-pair, L3). 계측(선택): cta_click.
export type AnnouncementPopupTodayCopy = {
  title: string
  body: string
  // 「{date}까지」(선택)
  until?: string
  action?: { label: string; href: string }
  closeToday: string
  close: string
}
export type AnnouncementPopupTodayProps = BlockBase<AnnouncementPopupTodayCopy> & {
  // 창 id — 닫은 것을 이 id 로 기억한다(문구를 바꾸면 id 도 바꾼다)
  popupId: string
  endsAt: IsoDate
  startsAt?: IsoDate
  now?: IsoDate
  track?: AnalyticsPort["track"]
}

// ── 오늘 하루 보지 않기: 닫은 날짜(YYYY-MM-DD)를 이 기기의 localStorage 에만 적는다 ──────────────────────────
const EVENT = "wf:popup-today"
const KEY = (popupId: string) => `wf-popup-today:${popupId}`
const subscribe = (cb: () => void) => {
  window.addEventListener("storage", cb)
  window.addEventListener(EVENT, cb)
  return () => {
    window.removeEventListener("storage", cb)
    window.removeEventListener(EVENT, cb)
  }
}
const readDay = (key: string): string => {
  try {
    return window.localStorage.getItem(key) ?? ""
  } catch {
    return ""
  }
}
/** 그 순간이 속한 날짜(YYYY-MM-DD) — timeZone 이 없으면 방문자 기기의 시간대 */
const dayOf = (iso: IsoDate, timeZone?: string) => new Intl.DateTimeFormat("sv-SE", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso))

export function AnnouncementPopupToday({ copy, locale, timeZone, popupId, endsAt, startsAt, now, track, id = "popup-today", className }: AnnouncementPopupTodayProps) {
  const root = React.useRef<HTMLElement>(null)
  const closeRef = React.useRef<HTMLButtonElement>(null)
  const nowIso = useNow(now)
  const stored = React.useSyncExternalStore(subscribe, () => readDay(KEY(popupId)), () => null)
  const { dismissed: sessionClosed, set: closeForSession } = useDismissMemory(`wf-popup:${popupId}`, "session")
  const [closedNow, setClosedNow] = React.useState(false)
  const at = new Date(nowIso).getTime()
  const live = at < new Date(endsAt).getTime() && (!startsAt || at >= new Date(startsAt).getTime())
  // 기억을 읽기 전(서버 렌더·하이드레이션 직전)에는 그리지 않는다
  const known = stored !== null && sessionClosed !== null
  const visible = known && live && !closedNow && sessionClosed !== true && stored !== dayOf(nowIso, timeZone)
  // 아래에 앉은 창이 가리는 높이만큼 문서 뿌리 scroll-padding-bottom — 키보드 초점이 창 뒤에 숨지 않는다(WCAG 2.4.11)
  useFloatingSpace(root, { active: visible })
  const close = React.useCallback(
    (why: "close" | "today") => {
      track?.("cta_click", { id: `popup-${why}-${popupId}`, label: why === "today" ? copy.closeToday : copy.close, section: id })
      setClosedNow(true)
      if (why === "today") {
        try {
          window.localStorage.setItem(KEY(popupId), dayOf(nowIso, timeZone))
        } catch {
          // 저장소를 못 쓰면 이번 화면에서만 닫는다
        }
        window.dispatchEvent(new Event(EVENT))
      } else closeForSession(true)
    },
    [track, popupId, copy.closeToday, copy.close, id, nowIso, timeZone, closeForSession],
  )
  React.useEffect(() => {
    if (!visible) return
    // 아직 아무 곳에도 초점이 없으면 닫기 단추가 처음 초점 — 이미 다른 곳에서 작업 중이면 빼앗지 않는다
    const active = document.activeElement
    if (!active || active === document.body) closeRef.current?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      const here = document.activeElement
      if (here === document.body || (root.current && root.current.contains(here))) close("close")
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [visible, close])
  return (
    <section
      ref={root}
      id={id}
      data-block="announcement-popup-today"
      data-popup={popupId}
      role="dialog"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-body`}
      hidden={!visible || undefined}
      className={cn("fixed inset-x-3 bottom-[calc(var(--wf-float-bar,0px)_+_var(--bottom-bar-height,0px)_+_env(safe-area-inset-bottom)_+_0.75rem)] z-50 flex max-h-[35dvh] flex-col gap-2 overflow-hidden rounded-lg border bg-background p-4 text-foreground shadow-(--wf-shadow-surface) md:inset-x-auto md:end-4 md:w-96", className)}
    >
      <div className="flex shrink-0 items-start justify-between gap-2">
        <h2 id={`${id}-title`} className="min-w-0 flex-1 text-[1.125rem] leading-[1.4] font-heading-ko">
          {copy.title}
        </h2>
        <Button ref={closeRef} type="button" variant="ghost" size="icon" data-popup-close="" aria-label={copy.close} onClick={() => close("close")} className="-me-2 -mt-2 shrink-0">
          <X aria-hidden="true" />
        </Button>
      </div>
      <ScrollText labelledBy={`${id}-title`} className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain">
        <p id={`${id}-body`} className="text-base leading-[1.6]">
          {copy.body}
        </p>
        {copy.until ? (
          <p data-until="" className="text-base leading-[1.5]">
            {fill(copy.until, { date: <DateText locale={locale} timeZone={timeZone} iso={endsAt} /> })}
          </p>
        ) : null}
      </ScrollText>
      <ChoiceRow label={copy.title} className="grid-cols-2 gap-2">
        <ChoiceButton choice="decline" type="button" data-popup-today="" onClick={() => close("today")}>
          {copy.closeToday}
        </ChoiceButton>
        {copy.action ? (
          <ChoiceButton choice="primary" nativeButton={false} role="link" render={<a href={copy.action.href} />} onClick={() => track?.("cta_click", { id: `popup-${popupId}`, label: copy.action?.label ?? "", section: id })}>
            {copy.action.label}
          </ChoiceButton>
        ) : null}
      </ChoiceRow>
    </section>
  )
}
