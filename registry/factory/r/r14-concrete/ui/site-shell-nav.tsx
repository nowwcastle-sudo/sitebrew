"use client"

import * as React from "react"
import { cn } from "cn"
import { Menu, X } from "@/registry/factory/icons/lucide"

// SiteShell(서버 컴포넌트)의 유일한 클라이언트 조각(T11-N1). 좁은 폭에서 가로로 넘치는 메뉴는
// 키보드로 옮긴 항목이 가려진 채 남지 않게 보이는 칸으로 굴린다(DESIGN §7-B 포커스는 보여야 한다).
// 모양은 SiteShell 이 className 으로 넘기는 훅(cn-site-shell-nav-list)이 정한다.
function SiteShellNavList({ onFocus, ...props }: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="site-shell-nav-list"
      onFocus={(e) => {
        if (e.target instanceof HTMLElement) e.target.scrollIntoView({ block: "nearest", inline: "nearest" })
        onFocus?.(e)
      }}
      {...props}
    />
  )
}

// 좁은 폭(768px 미만)에서 유틸리티·검색·주 메뉴·행동이 한 줄로 가로 스크롤하는 띠(대장 A131). 768px 이상에서는 display: contents 라 자식이 헤더 안쪽 줄의 칸 그대로다.
// 띠 안에서 포커스가 가려진 채 남지 않게 굴린다(contents 일 때는 각 칸이 알아서 한다).
//
// FINAL-WF3 접이식 메뉴: 768px 미만에서 띠가 폭을 넘으면(서버 HTML 은 늘 펼친 띠다 — 하이드레이션 직후 잰다) 유틸리티·검색·주 메뉴를 「메뉴」 단추 뒤 패널로 접는다.
//   · 단추는 진짜 <button> — aria-expanded·aria-controls(패널 id). 패널은 닫히면 hidden 이라 탭 순서에서 빠진다. 행동(예약·가입 버튼)은 접지 않고 띠에 남긴다.
//   · Esc 가 닫고 초점을 단추로 돌려준다. 초점이 띠 밖으로 나가거나 패널 밖을 누르면 닫는다. 패널 안 링크를 누르면 닫는다(같은 쪽 앵커 이동).
//   · 폭이 바뀌면(회전·창 크기) 펼친 띠로 되돌려 다시 잰다 — 768px 이상은 접지 않는다.
//   · 접고도 띠가 폭을 넘으면(긴 로고 + 단추 + 행동 둘 — 접은 띠는 가로 스크롤이 없어 쪽 전체가 옆으로 밀린다) 행동도 패널 맨 아래로 옮긴다(FINAL-WF5). 행동 하나가 들어가면 띠에 남는다.
type SiteShellStripProps = Omit<React.ComponentProps<"div">, "children"> & {
  /** 접힐 수 있는 칸(DOM 순서: 유틸리티 → 검색 → 주 메뉴). 서버가 그린 요소를 그대로 받는다 */
  utility?: React.ReactNode
  search?: React.ReactNode
  nav?: React.ReactNode
  /** 접지 않는 칸 — 헤더 오른쪽 행동 */
  actions?: React.ReactNode
  /** 단추 글자(「메뉴」/"Menu") — 서버가 로캘 표에서 읽어 넘긴다 */
  menuLabel: string
}
const MOBILE = "(max-width: 767.98px)"

function SiteShellStrip({ utility, search, nav, actions, menuLabel, className, onFocus, ...props }: SiteShellStripProps) {
  const ref = React.useRef<HTMLDivElement>(null)
  const button = React.useRef<HTMLButtonElement>(null)
  const panelId = `${React.useId()}-menu`
  const [collapsed, setCollapsed] = React.useState(false)
  const [open, setOpen] = React.useState(false)
  const [actionsFolded, setActionsFolded] = React.useState(false)
  const foldable = Boolean(utility || search || nav)
  // 접을 수 있는 칸이 하나라도 있고 띠가 폭을 넘으면 접는다 — 펼친 상태에서만 잴 수 있어서 상태가 바뀔 때마다 레이아웃 효과에서 잰다(페인트 전).
  React.useLayoutEffect(() => {
    const el = ref.current
    if (!foldable || !el || collapsed) return
    if (window.matchMedia(MOBILE).matches && el.scrollWidth > el.clientWidth + 1) setCollapsed(true)
  }, [foldable, collapsed])
  // 접고도 띠가 폭을 넘으면 행동을 패널로 옮긴다(접은 띠는 overflow 가 보이는 채라 scrollWidth 가 넘친 길이를 말해 준다).
  React.useLayoutEffect(() => {
    const el = ref.current
    if (!foldable || !el || !collapsed || actionsFolded || !actions) return
    if (window.matchMedia(MOBILE).matches && el.scrollWidth > el.clientWidth + 1) setActionsFolded(true)
  }, [foldable, collapsed, actionsFolded, actions])
  // 폭이 바뀌면 펼친 띠로 되돌려 다시 잰다(접은 채로는 「들어가는가」를 알 수 없다).
  React.useEffect(() => {
    if (!foldable) return
    let width = window.innerWidth
    const onResize = () => {
      if (window.innerWidth === width) return
      width = window.innerWidth
      setOpen(false)
      setCollapsed(false)
      setActionsFolded(false)
    }
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [foldable])
  // 열려 있는 동안 패널 밖을 누르면 닫는다.
  React.useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (e.target instanceof Node && !ref.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener("pointerdown", onDown, true)
    return () => document.removeEventListener("pointerdown", onDown, true)
  }, [open])
  const close = (returnFocus: boolean) => {
    setOpen(false)
    if (returnFocus) button.current?.focus()
  }
  const folded = collapsed && foldable
  return (
    <div
      ref={ref}
      data-slot="site-shell-strip"
      data-collapsed={folded ? "" : undefined}
      className={cn(className, "max-md:data-[collapsed]:overflow-visible")}
      onFocus={(e) => {
        if (e.target instanceof HTMLElement && getComputedStyle(e.currentTarget).display !== "contents" && !folded) e.target.scrollIntoView({ block: "nearest", inline: "nearest" })
        onFocus?.(e)
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.stopPropagation()
          close(true)
        }
      }}
      onBlur={(e) => {
        // 초점이 띠 밖으로 나가면 닫는다(relatedTarget 이 없으면 창 밖으로 간 것 — 그대로 둔다)
        if (open && e.relatedTarget instanceof Node && !e.currentTarget.contains(e.relatedTarget)) setOpen(false)
      }}
      {...props}
    >
      {folded ? (
        <>
          <button
            ref={button}
            type="button"
            data-slot="site-shell-menu-button"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((v) => !v)}
            className="min-h-10 gap-2 rounded-none px-3 text-sm font-medium [&_svg]:size-5 relative inline-flex shrink-0 items-center hover:bg-muted after:absolute after:inset-y-[min(0px,calc((100%-44px)/2))] after:inset-x-[min(0px,calc((100%-44px)/2))]"
          >
            {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
            {menuLabel}
          </button>
          <div
            id={panelId}
            hidden={!open}
            data-slot="site-shell-menu-panel"
            onClick={(e) => {
              if (e.target instanceof Element && e.target.closest("a[href]")) setOpen(false)
            }}
            className="gap-3 border-b px-4 py-3 text-sm shadow-md absolute inset-x-0 top-full z-50 flex flex-col bg-background [&_[data-slot=site-shell-nav-list]]:h-auto [&_[data-slot=site-shell-nav-list]]:flex-col [&_[data-slot=site-shell-nav-list]]:items-stretch [&_[data-slot=site-shell-nav-list]]:overflow-visible [&_[data-slot=site-shell-nav]]:h-auto [&_[data-slot=site-shell-nav]]:flex-none [&_[data-slot=site-shell-actions]]:ms-0"
          >
            {utility}
            {search}
            {nav}
            {actionsFolded ? actions : null}
          </div>
        </>
      ) : (
        <>
          {utility}
          {search}
          {nav}
        </>
      )}
      {folded && actionsFolded ? null : actions}
    </div>
  )
}

export { SiteShellNavList, SiteShellStrip }
