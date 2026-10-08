"use client"

import * as React from "react"
import { cn } from "cn"
import { uiLabels, type UiLocale } from "@/registry/factory/r/r9-clay/ui/locale-labels"
import { LoaderCircle as Loader2Icon } from "@/registry/factory/icons/phosphor"

// 스피너는 늦게 켜고 오래 붙든다(DESIGN §3 309행 — 빠른 요청에서 깜빡이지 않게): 지연 150ms · 한 번 켜지면 최소 300ms.
// - <Spinner> 는 그려진 뒤 150ms 동안 자리만 잡고 보이지 않는다(글자가 밀리지 않는다). 그 사이에 사라지면 한 번도 보이지 않는다.
// - usePendingGate(pending) 는 「처리 중」 표시를 켤지 정한다 — 150ms 넘게 처리 중일 때만 켜지고, 켜졌으면 처리가 끝나도 300ms 채우고 꺼진다.
//   보내기 버튼처럼 스피너를 제 아이콘으로 그리는 곳(블록의 처리 중 표시)이 이 훅으로 같은 값을 쓴다.
export const SPINNER_DELAY_MS = 150
export const SPINNER_MIN_MS = 300

export function usePendingGate(pending: boolean, { delay = SPINNER_DELAY_MS, min = SPINNER_MIN_MS }: { delay?: number; min?: number } = {}) {
  const [shown, setShown] = React.useState(false)
  const since = React.useRef(0)
  React.useEffect(() => {
    if (!pending) return
    const t = setTimeout(() => {
      since.current = Date.now()
      setShown(true)
    }, delay)
    return () => clearTimeout(t)
  }, [pending, delay])
  React.useEffect(() => {
    if (pending || !shown) return
    const t = setTimeout(() => setShown(false), Math.max(0, min - (Date.now() - since.current)))
    return () => clearTimeout(t)
  }, [pending, shown, min])
  return shown
}

function Spinner({ className, delay = SPINNER_DELAY_MS, locale, ...props }: React.ComponentProps<"svg"> & { delay?: number; locale?: UiLocale }) {
  const on = usePendingGate(true, { delay })
  return (
    <Loader2Icon
      data-slot="spinner"
      role={on ? "status" : undefined}
      aria-label={on ? uiLabels(locale).loading : undefined}
      aria-hidden={on ? undefined : true}
      className={cn("size-4 animate-spin", !on && "invisible", className)}
      {...props}
    />
  )
}

export { Spinner }
