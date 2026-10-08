"use client"

import * as React from "react"

// 화면 아래 고정 줄(bottom-tab 블록)의 자리 잡기(공유 조각 block-shared-bottom-bar-space).
// 고정 줄이 가리는 높이(줄 위끝부터 화면 아래끝까지 — 안전 영역 여백·떠 있는 줄의 아래 띄움 포함)를 재서 문서 뿌리에 --bottom-bar-height 로 싣고,
// scroll-padding-bottom 도 그만큼 준다 —
// 키보드로 옮긴 요소·앵커 목적지가 줄 뒤로 숨지 않는다(WCAG 2.4.11). 블록은 이 변수로 제자리에 같은 높이의 빈 칸을 두어 문서 끝 요소가
// 줄에 가리지 않게 한다(서버 렌더 첫 칠은 변수 기본값). 떠날 때 둘 다 되돌린다.
// pad(REL10B): 제자리에 둘 빈 칸이 없는 줄(쿠키 띠 — 문서 끝에 무엇이 오는지는 조립하는 쪽이 정한다)은 문서 뿌리 아래 여백(padding-bottom)을 **모자란 만큼만** 준다 —
// 문서 맨 아래 요소(푸터 링크)가 문서 끝까지 스크롤해도 줄 밑에 깔리면(WCAG 2.4.11, launch-factory 화면 관문 F3) 줄 높이에서 문서 끝의 남는 빈 자리를 뺀 만큼 늘린다.
// 문서 끝에 빈 자리가 줄만큼 있으면(맨 아래 요소가 줄 위에 있으면) 0 이다. 줄 말고 문서 안 요소의 맨 아래(고정·붙는 요소 제외)를 재서 정한다. 떠날 때 되돌린다.
export const BOTTOM_BAR_VAR = "--bottom-bar-height"

/** 줄(el) 밖 문서 요소 중 가장 아래 끝(문서 좌표). 화면에 그려지지 않거나(크기 0) 고정·붙는 요소(화면 기준이라 문서 끝과 무관)는 뺀다 */
function lowestContent(el: HTMLElement): number {
  const sy = window.scrollY
  let lowest = 0
  for (const n of document.body.querySelectorAll("*")) {
    if (el === n || el.contains(n) || n.contains(el)) continue
    const r = n.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) continue
    const bottom = r.bottom + sy
    if (bottom <= lowest) continue
    const pos = getComputedStyle(n).position
    if (pos === "fixed" || pos === "sticky") continue
    lowest = bottom
  }
  return lowest
}

export function useBottomBarSpace(ref: React.RefObject<HTMLElement | null>, { pad = false }: { pad?: boolean } = {}) {
  React.useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const html = document.documentElement
    const before = html.style.scrollPaddingBottom
    const padBefore = html.style.paddingBottom
    // 우리가 여백을 더하기 전 문서 뿌리의 아래 여백(스타일시트 값 포함) — 처음 잰 값이다
    const basePad = pad ? parseFloat(getComputedStyle(html).paddingBottom) || 0 : 0
    const sync = () => {
      const r = el.getBoundingClientRect()
      const covered = Math.ceil(Math.max(r.height, window.innerHeight - r.top))
      html.style.setProperty(BOTTOM_BAR_VAR, `${covered}px`)
      html.style.scrollPaddingBottom = `var(${BOTTOM_BAR_VAR})`
      if (pad) {
        // REL11: 여백을 걷었다 다시 재지 않는다. 동작 줄이기에서는 factory-base 가 모든 요소에 `transition-duration: 0.01ms` 를 걸어, 여백을 바꾼 직후 같은 틱에 읽으면
        // padding-bottom 의 전환 시작 값(걷기 전 여백)이 읽혀 「문서 끝에 빈 자리가 이미 있다」고 오판했다 — 여백이 0.0156px 로 떨어져 바닥글이 띠 밑에 남았다(launch-factory LFADA 실측).
        // 대신 지금 적용된 우리 여백(own)을 계산된 값에서 빼서 「우리 여백이 없을 때의 문서 끝」을 구한다 — 읽는 값 둘(계산된 여백·문서 크기)이 같은 스타일 계산에서 나와 전환 중에도 맞는다.
        const sy = window.scrollY
        const own = Math.max(0, (parseFloat(getComputedStyle(html).paddingBottom) || 0) - basePad)
        // 문서 끝: 스크롤 가능하면 scrollHeight, 아니면(화면보다 짧아 scrollHeight 가 화면 높이로 고정됨) 문서 뿌리 상자의 아래 끝 — 짧은 문서도 띠만큼 스크롤 가능하게 만든다
        const boxEnd = html.getBoundingClientRect().bottom + sy
        const end = Math.max(boxEnd, html.scrollHeight > html.clientHeight ? html.scrollHeight : 0) - own
        const slack = end - lowestContent(el)
        const need = Math.max(0, covered - Math.max(0, slack))
        html.style.paddingBottom = need > 0 ? `calc(${padBefore || `${basePad}px`} + ${need}px)` : padBefore
      }
    }
    sync()
    const ro = new ResizeObserver(sync)
    ro.observe(el)
    if (pad) ro.observe(document.body)
    window.addEventListener("resize", sync)
    return () => {
      ro.disconnect()
      window.removeEventListener("resize", sync)
      html.style.removeProperty(BOTTOM_BAR_VAR)
      html.style.scrollPaddingBottom = before
      if (pad) html.style.paddingBottom = padBefore
    }
  }, [ref, pad])
}
