"use client"

import * as React from "react"
import { usePathname } from "next/navigation"

import type { AuthPort } from "@/components/contract/ports"
import { DEFAULT_TIME_ZONE, DISPLAY_LOCALE, displayTimeZone } from "@/lib/locale"
import { SESSION_CHANGED_EVENT } from "@/lib/welcome"

// 제품 화면의 표시 로캘·시간대를 블록에 넘기는 통(I01·I02·I03). 서버가 처음 그릴 때의 시간대(initialTimeZone — 로그인한 사용자의 user.timeZone)로 시작하고,
// 쪽을 옮기거나 이 화면 안에서 로그인·가입이 끝나면 위 띠(SessionSync 가 서버에게 다시 읽게 한다)처럼 세션을 다시 묻는다 — 레이아웃은 쪽 이동에서 다시 그려지지 않아서다.
// 서버가 첫 HTML 에 쓴 날짜와 클라이언트 첫 렌더가 같아야 하이드레이션이 어긋나지 않는다: 첫 렌더는 항상 initialTimeZone 이다.
export type DisplayPrefs = { locale: typeof DISPLAY_LOCALE; timeZone: string }

const Prefs = React.createContext<DisplayPrefs>({ locale: DISPLAY_LOCALE, timeZone: DEFAULT_TIME_ZONE })

/** 블록에 `{...useDisplayPrefs()}` 로 펼친다 */
export const useDisplayPrefs = () => React.useContext(Prefs)

export function DisplayPrefsProvider({ initialTimeZone, session, children }: { initialTimeZone?: string | null; session: AuthPort["session"]; children: React.ReactNode }) {
  const [timeZone, setTimeZone] = React.useState(displayTimeZone(initialTimeZone))
  const pathname = usePathname()
  const first = React.useRef(true)
  React.useEffect(() => {
    const ask = () =>
      void session()
        .then((r) => {
          if (r.ok) setTimeZone(displayTimeZone(r.data?.timeZone))
        })
        .catch(() => undefined)
    if (first.current) first.current = false
    else ask()
    window.addEventListener(SESSION_CHANGED_EVENT, ask)
    return () => window.removeEventListener(SESSION_CHANGED_EVENT, ask)
  }, [pathname, session])
  const value = React.useMemo<DisplayPrefs>(() => ({ locale: DISPLAY_LOCALE, timeZone }), [timeZone])
  return <Prefs.Provider value={value}>{children}</Prefs.Provider>
}
