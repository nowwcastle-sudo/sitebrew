"use client"

import * as React from "react"

// 스크롤 칸 아래에 붙는 고정 행동 줄의 자리 잡기(공유 조각 block-shared-pinned-bar-space — REL11, launch-factory LFADB 발견: WCAG 2.4.11 초점 가림 안 됨).
// 업그레이드 대화상자는 본문만 스크롤하고 행동 줄(`data-pinned-bar` — 전환 고지·필수 체크·버튼)은 대화상자 아래에 붙는다. 스크롤 칸의 `scroll-padding-bottom` 이
// 고정 값(scroll-pb-36 = 144px)이면 줄이 더 높을 때(고지 글이 길거나 영어·좁은 화면에서 줄바꿈이 늘 때 168~320px) 줄 바로 위 띠 안의 링크·칸은
// 브라우저가 「이미 보인다」고 보고 스크롤하지 않아 줄 밑에 통째로 가려진 채 포커스를 받는다.
// 그래서 줄의 실제 높이를 재서 스크롤 칸의 scroll-padding-bottom 에 싣는다 — 줄이 늘고 줄 때(체험 켜기 끄기·글자 크기·폭·언어)마다 다시 잰다.
// 쓰는 법: `const spaceRef = usePinnedBarSpace()` → 스크롤 칸(대화상자 내용)의 ref 로 준다. 줄이 아직 없으면(요금제를 불러오는 중) 나타날 때까지 지켜본다.
// 서버 렌더·첫 칠은 스타일의 기본 값(scroll-pb-36)이다. 떠날 때 되돌린다.
const BAR = "[data-pinned-bar]"

export function usePinnedBarSpace(): (node: HTMLElement | null) => void {
  const cleanup = React.useRef<(() => void) | null>(null)
  return React.useCallback((node: HTMLElement | null) => {
    cleanup.current?.()
    cleanup.current = null
    if (!node) return
    const before = node.style.scrollPaddingBottom
    let bar: HTMLElement | null = null
    const ro = new ResizeObserver(() => apply())
    const apply = () => {
      if (!bar) return
      // 줄의 높이 + 여유 8px(포커스 링·밑줄이 줄 가장자리에 닿지 않게). 줄이 대화상자 아래 가장자리를 넘게 붙는 만큼(-bottom-4)은 줄 높이에 이미 든다
      // offsetHeight: 대화상자가 열리며 커지는 동안(scale 애니메이션) getBoundingClientRect 는 줄어든 값을 준다 — 배치 높이를 쓴다
      node.style.scrollPaddingBottom = `${bar.offsetHeight + 8}px`
    }
    const find = () => {
      const next = node.querySelector<HTMLElement>(BAR)
      if (next === bar) return
      if (bar) ro.unobserve(bar)
      bar = next
      if (bar) {
        ro.observe(bar)
        apply()
      } else {
        node.style.scrollPaddingBottom = before
      }
    }
    const mo = new MutationObserver(find)
    mo.observe(node, { childList: true, subtree: true })
    find()
    cleanup.current = () => {
      mo.disconnect()
      ro.disconnect()
      node.style.scrollPaddingBottom = before
    }
  }, [])
}
