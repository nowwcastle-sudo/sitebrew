"use client"

import * as React from "react"

import type { ActionResult } from "@/components/contract/block-contract"
import { Check } from "@/components/icons"
import { Field, FieldDescription } from "@/components/ui/field"
import { bookCopy as copy } from "@/content/copy.ux.en"
import { formatDayLong, formatSlotName, formatTime, openDays, todayIn, type SlotDay } from "@/lib/booking-client"

// 예약 시간 고르기. 둘로 나눈다: useBookingSlots(읽기 — 서비스가 바뀌면 다시 읽는다) · SlotPicker(그리기 — 진짜 라디오 묶음, 읽기와 모르는 사이).
// 슬롯은 날마다 role="group" 으로 묶은 네이티브 라디오다(같은 name 이라 화살표 키가 날을 건너 움직인다). 접근 이름은 「날짜, 시각」 — 보이는 글(시각)이 이름 안에 들어 있다(WCAG 2.5.3).
export const SLOT_DAYS = 14

export type SlotsLoader = (input: { service: string; from: string; days: number }) => Promise<ActionResult<{ days: SlotDay[] }>>
export type SlotsState = { status: "loading" } | { status: "error" } | { status: "ready"; days: SlotDay[] }

/** 서비스의 앞으로 14일 슬롯. 서비스가 바뀌거나 reload() 를 부르면 다시 읽고, 그 사이는 loading 이다(낡은 답은 버린다) */
export function useBookingSlots({ load, service, timeZone }: { load: SlotsLoader; service: string; timeZone: string }): { state: SlotsState; reload: () => void } {
  const [tick, setTick] = React.useState(0)
  const [result, setResult] = React.useState<{ key: string; days: SlotDay[] | null } | null>(null)
  const key = `${service}|${tick}`
  React.useEffect(() => {
    if (!service) return
    let dead = false
    load({ service, from: todayIn(timeZone), days: SLOT_DAYS })
      .then((r) => !dead && setResult({ key, days: r.ok ? openDays(r.data.days) : null }))
      .catch(() => !dead && setResult({ key, days: null }))
    return () => {
      dead = true
    }
  }, [key, service, load, timeZone])
  const state: SlotsState = result?.key !== key ? { status: "loading" } : result.days ? { status: "ready", days: result.days } : { status: "error" }
  return { state, reload: () => setTick((t) => t + 1) }
}

export function SlotPicker({
  id,
  state,
  selected,
  onSelect,
  onRetry,
  timeZone,
  taken,
  invalid,
  required,
  describedBy,
}: {
  /** 라디오 묶음의 id — 폼 오류 요약 링크가 가리킨다 */
  id: string
  state: SlotsState
  selected: string
  onSelect: (startsAt: string) => void
  onRetry: () => void
  timeZone: string
  /** 고른 시간을 다른 사람이 잡아 목록을 다시 읽은 직후 */
  taken: boolean
  invalid?: true
  required?: true
  /** 오류 문구 id(있으면) — 안내 글 id 와 함께 잇는다 */
  describedBy?: string
}) {
  const labelId = `${id}-label`
  const hintId = `${id}-hint`
  const days = state.status === "ready" ? state.days : []
  const count = days.reduce((n, d) => n + d.slots.length, 0)
  // 읽는 중·읽은 뒤·못 읽음을 한 곳(aria-live="polite")에서 알린다 — 화면 낭독이 결과를 말해 준다
  const status =
    state.status === "loading" ? copy.slots.loading : state.status === "error" ? copy.slots.error : taken ? copy.slotTaken : count ? copy.slots.ready.replace("{count}", String(count)) : copy.slots.empty
  return (
    <Field data-invalid={invalid}>
      <p id={labelId} className="font-heading text-base leading-[1.5]">
        {copy.slots.legend}
        <span className="ms-1 text-base font-normal">{copy.slots.marker}</span>
      </p>
      <FieldDescription id={hintId} className="text-base leading-[1.6] text-foreground">
        {copy.slots.hint.replace("{timeZone}", timeZone)}
      </FieldDescription>
      <p role="status" aria-live="polite" data-testid="book-slots-status" data-state={state.status} className="min-h-6 text-base leading-[1.6]">
        {status}
      </p>
      {state.status === "error" ? (
        <button type="button" onClick={onRetry} className="relative inline-flex min-h-11 items-center self-start text-base underline underline-offset-4">
          {copy.slots.retry}
        </button>
      ) : null}
      <div
        id={id}
        role="radiogroup"
        tabIndex={-1}
        aria-labelledby={labelId}
        aria-describedby={[hintId, describedBy].filter(Boolean).join(" ")}
        aria-required={required}
        aria-invalid={invalid}
        aria-busy={state.status === "loading" || undefined}
        data-testid="book-slots"
        className="flex flex-col gap-4 outline-hidden focus-visible:ring-3 focus-visible:ring-ring"
      >
        {days.map((day) => {
          const headingId = `${id}-day-${day.date}`
          return (
            <div key={day.date} role="group" aria-labelledby={headingId} data-date={day.date} className="flex flex-col gap-2">
              <p id={headingId} className="text-base leading-[1.5] font-heading">
                {formatDayLong(day.slots[0]!.startsAt, timeZone)}
              </p>
              <div className="flex flex-wrap gap-2">
                {day.slots.map((slot) => (
                  <label key={slot.startsAt} className="relative inline-flex">
                    <input
                      type="radio"
                      name="startsAt"
                      value={slot.startsAt}
                      checked={selected === slot.startsAt}
                      onChange={() => onSelect(slot.startsAt)}
                      aria-label={formatSlotName(slot.startsAt, timeZone)}
                      data-testid="book-slot"
                      className="peer absolute inset-0 size-full cursor-pointer opacity-0"
                    />
                    {/* 고른 칸은 색만이 아니라 굵은 테두리와 체크 표시로도 드러난다 */}
                    <span className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1 border-2 border-input bg-background px-3 text-base peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-3 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background [&>svg]:hidden peer-checked:[&>svg]:block">
                      <Check aria-hidden="true" className="size-4" />
                      {formatTime(slot.startsAt, timeZone)}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </Field>
  )
}
