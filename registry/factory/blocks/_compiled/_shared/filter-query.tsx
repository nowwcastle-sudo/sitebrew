"use client"

import * as React from "react"

// 거르기 상태를 주소 쿼리에 둔다(FV1 Task 5.9 공유 조각 block-shared-filter-query). 새로고침·공유·뒤로 가기에서 거른 모양이 그대로 남는다.
//   · 상태의 정본은 주소의 ?q=…&category=… 다. 바꿀 때는 history.replaceState 로 쓰고(기록을 쌓지 않는다) 같은 쪽의 다른 거르기 블록이 알아채도록 이벤트를 보낸다.
//   · 거르기를 바꾸면 쪽 번호(page)는 지운다 — 거른 결과가 줄어 없는 쪽을 가리키지 않게.
//   · 서버 렌더·하이드레이션 동안에는 주소를 모른다(window 가 없다) — 그동안은 initial(시작 값)을 쓰고, 하이드레이션 뒤에는 주소가 정본이다.
//   · 목록 항목을 이 블록이 직접 거르는 갈래(target): 같은 문서의 target 셀렉터에 맞는 요소를 찾아, 값에 안 맞으면 hidden 을 준다.
//       q 는 요소 글에 검색어가 있는가, 그 밖 이름은 요소의 data-filter-<이름> 속성(쉼표로 여러 값)에 값이 있는가(속성이 없으면 요소 글에서 찾는다).
//     서버가 거르는 목록(쪽마다 주는 표)은 target 을 주지 않고 조립하는 쪽이 onChange 로 다시 읽는다.
const EVENT = "wf:filter-query"

/** 주소 쿼리 글 → URLSearchParams */
export const paramsOf = (search: string): URLSearchParams => new URLSearchParams(search.startsWith("?") ? search.slice(1) : search)

/** 값을 바꾼 새 쿼리 글. 빈 값·null 은 지우고, drop(기본 page)도 지운다. 결과가 없으면 "" */
export function nextSearch(search: string, patch: Record<string, string | null | undefined>, drop: string[] = ["page"]): string {
  const p = paramsOf(search)
  for (const k of drop) p.delete(k)
  for (const [k, v] of Object.entries(patch)) {
    if (v === null || v === undefined || v === "") p.delete(k)
    else p.set(k, v)
  }
  const s = p.toString()
  return s ? `?${s}` : ""
}

/** 쉼표로 이은 여러 값 */
export const listOf = (raw: string | null | undefined): string[] => (raw ?? "").split(",").map((v) => v.trim()).filter(Boolean)
export const toList = (values: string[]): string => values.join(",")

export type FilterItem = { text: string; attr: (name: string) => string | null }

/**
 * 목록 항목 하나가 지금 거르기 값에 맞는가. q 는 글에 들어 있는지(대소문자 무시), 그 밖은 data-filter-<이름> 속성의 값 중 하나가 고른 값과 같은지
 * (속성이 없는 항목은 글에서 고른 값을 찾는다). 값이 비면 그 거르기는 걸지 않는다.
 */
export function itemVisible(item: FilterItem, values: Record<string, string | undefined>): boolean {
  for (const [name, raw] of Object.entries(values)) {
    if (!raw) continue
    if (name === "q") {
      if (!item.text.toLowerCase().includes(raw.trim().toLowerCase())) return false
      continue
    }
    const want = listOf(raw)
    if (!want.length) continue
    const has = item.attr(`data-filter-${name}`)
    if (has !== null) {
      const mine = listOf(has)
      if (!want.some((w) => mine.includes(w))) return false
    } else if (!want.some((w) => item.text.includes(w))) return false
  }
  return true
}

const subscribe = (cb: () => void) => {
  window.addEventListener("popstate", cb)
  window.addEventListener(EVENT, cb)
  return () => {
    window.removeEventListener("popstate", cb)
    window.removeEventListener(EVENT, cb)
  }
}
const noop = () => () => {}

/**
 * 거르기 상태 훅. get(이름) 은 하이드레이션 전에는 initial, 뒤에는 주소의 값이다. set(patch) 가 주소를 바꾼다(onChange 는 바꾼 뒤의 전체 값).
 * 서버 렌더에서 window 를 만지지 않는다 — 주소는 useSyncExternalStore 의 클라이언트 스냅숏에서만 읽는다.
 */
export function useQueryState(initial?: Record<string, string>, onChange?: (values: Record<string, string>) => void) {
  const ready = React.useSyncExternalStore(noop, () => true, () => false)
  const search = React.useSyncExternalStore(subscribe, () => window.location.search, () => "")
  const params = React.useMemo(() => paramsOf(search), [search])
  const get = React.useCallback((name: string): string => (ready ? (params.get(name) ?? "") : (initial?.[name] ?? "")), [ready, params, initial])
  const set = React.useCallback(
    (patch: Record<string, string | null | undefined>) => {
      const next = nextSearch(window.location.search, patch)
      try {
        window.history.replaceState(window.history.state, "", `${window.location.pathname}${next}${window.location.hash}`)
      } catch {
        // 주소를 못 바꾸는 곳(sandbox 문서 등) — 이번 화면의 이벤트로만 알린다
      }
      window.dispatchEvent(new Event(EVENT))
      onChange?.(Object.fromEntries(paramsOf(next).entries()))
    },
    [onChange],
  )
  return { ready, get, set, search }
}
/** 같은 훅의 다른 이름(블록 원천이 읽기 좋은 쪽을 쓴다) */
export const useFilterQuery = useQueryState

/** 정렬 값 「price-asc」 → { key: "price", dir: 1 }. 모르는 모양(「recommended」·빈 값)은 null — 원래 순서 */
export type SortSpec = { key: string; dir: 1 | -1 }
export function parseSort(value: string | null | undefined): SortSpec | null {
  const m = /^([a-z][a-z0-9]*)-(asc|desc)$/.exec(value ?? "")
  return m ? { key: m[1], dir: m[2] === "asc" ? 1 : -1 } : null
}
/** 항목마다의 정렬 값(숫자, 없으면 null) → 보일 순서(0부터). 값이 없는 항목은 뒤로, 같은 값은 원래 순서대로 */
export function sortRanks(values: (number | null)[], dir: 1 | -1): number[] {
  const order = values.map((v, i) => ({ v, i })).sort((a, b) => {
    if (a.v === null || b.v === null) return a.v === b.v ? a.i - b.i : a.v === null ? 1 : -1
    return (a.v - b.v) * dir || a.i - b.i
  })
  const ranks: number[] = []
  order.forEach((o, n) => {
    ranks[o.i] = n
  })
  return ranks
}

/**
 * target 셀렉터에 맞는 목록 항목을 정렬 값대로 늘어놓는다. 항목의 data-sort-<key> 속성(숫자)을 읽어 CSS order 로 순서만 바꾼다 — 요소를 옮기지 않아 React 가 그린 목록이 깨지지 않는다
 * (부모가 flex·grid 일 때 듣는다). 정렬 값이 없거나(추천순) 모르는 모양이면 order 를 지워 원래 순서로 돌린다.
 */
export function useDomSort(target: string | undefined, value: string, ready: boolean) {
  React.useEffect(() => {
    if (!target || !ready) return
    const apply = () => {
      const els = Array.from(document.querySelectorAll<HTMLElement>(target))
      const sort = parseSort(value)
      if (!sort) {
        for (const el of els) el.style.removeProperty("order")
        return
      }
      const nums = els.map((el) => {
        const raw = el.getAttribute(`data-sort-${sort.key}`)
        const n = raw === null || raw === "" ? NaN : Number(raw)
        return Number.isFinite(n) ? n : null
      })
      sortRanks(nums, sort.dir).forEach((rank, i) => {
        els[i].style.order = String(rank)
      })
    }
    apply()
    const raf = window.requestAnimationFrame(apply)
    return () => window.cancelAnimationFrame(raf)
  }, [target, value, ready])
}

/**
 * target 셀렉터에 맞는 목록 항목을 값대로 보이거나 숨긴다. 보이는 수·전체 수를 돌려준다(target 이 없거나 하이드레이션 전이면 null).
 * 목록이 늦게 그려지는 쪽을 위해 다음 프레임에 한 번 더 건다.
 */
export function useDomFilter(target: string | undefined, values: Record<string, string>, ready: boolean): { shown: number; total: number } | null {
  const [count, setCount] = React.useState<{ shown: number; total: number } | null>(null)
  const key = JSON.stringify(values)
  React.useEffect(() => {
    if (!target || !ready) return
    const apply = () => {
      const els = Array.from(document.querySelectorAll<HTMLElement>(target))
      let shown = 0
      for (const el of els) {
        const ok = itemVisible({ text: el.textContent ?? "", attr: (n) => el.getAttribute(n) }, JSON.parse(key) as Record<string, string>)
        el.hidden = !ok
        if (ok) shown++
      }
      setCount((c) => (c && c.shown === shown && c.total === els.length ? c : { shown, total: els.length }))
    }
    apply()
    const raf = window.requestAnimationFrame(apply)
    return () => window.cancelAnimationFrame(raf)
  }, [target, ready, key])
  return count
}
