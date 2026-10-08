"use client"

import * as React from "react"

// 포스터 가장자리 평균색 → 무대 바탕 변수 --o3-ground (FV1 3D-GROUND, 공유 조각 block-shared-edge-ground).
// 3D 가 올라오면 포스터가 불투명도 0 으로 내려가고 투명 캔버스 뒤로 무대 바탕이 드러난다. 바탕이 포스터 가장자리 색이면 그 전환에서 바탕색이 튀지 않는다.
// 포스터 그림(이미 받은 <img>)을 작은 캔버스에 그려 가장자리 띠를 평균낸다. 읽기가 실패하면(다른 출처 그림이라 캔버스가 오염됨 · 그림 없음 · 디코드 실패) 변수를 두지 않고
// CSS 가 var(--o3-ground, var(--muted)) 로 레시피 테마색에 남는다. 읽기는 브라우저가 한가할 때(첫 칠 뒤)만 한다.
export const GROUND_VAR = "--o3-ground"
const SAMPLE = 48 // 작은 캔버스의 긴 변 — 가장자리 평균에는 이 정도면 충분하다
const BAND = 0.08 // 가장자리 띠 두께(짧은 변 대비)

export type Rgb = { r: number; g: number; b: number }

// RGBA 픽셀(w×h)의 가장자리 띠 평균색. 투명(알파 16 미만) 픽셀은 무시하고, 불투명 픽셀이 하나도 없으면 null.
export function edgeAverage(data: ArrayLike<number>, w: number, h: number, band: number = BAND): Rgb | null {
  const t = Math.max(1, Math.round(Math.min(w, h) * band))
  let r = 0, g = 0, b = 0, n = 0
  for (let y = 0; y < h; y++) {
    const inner = y >= t && y < h - t
    for (let x = 0; x < w; x++) {
      if (inner && x >= t && x < w - t) { x = w - t - 1; continue } // 안쪽은 건너뛴다
      const i = (y * w + x) * 4
      if (data[i + 3] < 16) continue
      r += data[i]; g += data[i + 1]; b += data[i + 2]; n++
    }
  }
  return n ? { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) } : null
}

type Ctx2d = { drawImage: (...a: unknown[]) => void; getImageData: (x: number, y: number, w: number, h: number) => { data: ArrayLike<number> } }
type CanvasLike = { width: number; height: number; getContext: (kind: string, opts?: unknown) => Ctx2d | null }
const defaultCanvas = (): CanvasLike => document.createElement("canvas") as unknown as CanvasLike

// 그림 하나의 가장자리 평균색을 "rgb(r g b)" 로. 읽을 수 없으면 null(던지지 않는다). aspect 를 주면 object-cover 로 잘려 보이는 영역(object-position 초점 기준)만 읽는다.
export function groundOf(img: { naturalWidth: number; naturalHeight: number } | null | undefined, makeCanvas: () => CanvasLike = defaultCanvas, aspect?: number, focal: { x: number; y: number } = { x: 0.5, y: 0.5 }): string | null {
  try {
    if (!img || !img.naturalWidth || !img.naturalHeight) return null
    const nw = img.naturalWidth, nh = img.naturalHeight
    // 캔버스는 무대 비율(aspect, 없으면 그림 비율). 그림 전체를 cover 로 깔아 그린다 — 원본 잘라 그리기(source rect)는 쓰지 않는다:
    // srcset·sizes 그림은 naturalWidth(밀도 보정값)와 실제 비트맵 크기가 달라 source rect 좌표가 어긋난다(실측 806 ↔ 960).
    const ar = aspect && aspect > 0 ? aspect : nw / nh
    const w = ar >= 1 ? SAMPLE : Math.max(1, Math.round(SAMPLE * ar))
    const h = ar >= 1 ? Math.max(1, Math.round(SAMPLE / ar)) : SAMPLE
    const k = Math.max(w / nw, h / nh)
    const dw = nw * k, dh = nh * k
    const cv = makeCanvas()
    cv.width = w
    cv.height = h
    const ctx = cv.getContext("2d", { willReadFrequently: true })
    if (!ctx) return null
    ctx.drawImage(img, (w - dw) * focal.x, (h - dh) * focal.y, dw, dh)
    const c = edgeAverage(ctx.getImageData(0, 0, w, h).data, w, h)
    return c ? `rgb(${c.r} ${c.g} ${c.b})` : null
  } catch {
    return null // 캔버스 오염(SecurityError) · 그리기 실패
  }
}

// stage 안의 포스터 <img> 가장자리색을 한가할 때 읽어 stage 의 --o3-ground 로 둔다. 읽기 실패·그림 없음이면 변수를 걷는다(CSS 가 레시피 테마색으로 남는다).
// src: 포스터가 바뀌면 다시 읽도록 하는 열쇠.
export function useEdgeGround(stageRef: React.RefObject<HTMLElement | null>, src?: string) {
  React.useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    let dead = false
    let img: HTMLImageElement | null = null
    const clear = () => stage.style.removeProperty(GROUND_VAR)
    const read = () => {
      if (dead) return
      const r = stage.getBoundingClientRect()
      const pos = img ? /([\d.]+)%\s+([\d.]+)%/.exec(getComputedStyle(img).objectPosition) : null
      const c = groundOf(img, undefined, r.width && r.height ? r.width / r.height : undefined, pos ? { x: Number(pos[1]) / 100, y: Number(pos[2]) / 100 } : undefined)
      if (c) stage.style.setProperty(GROUND_VAR, c)
      else clear()
    }
    const run = () => {
      if (dead) return
      img = stage.querySelector("img")
      if (!img) return clear()
      if (img.complete) return read()
      img.addEventListener("load", read, { once: true })
      img.addEventListener("error", clear, { once: true })
    }
    let cancel: () => void
    if (window.requestIdleCallback) {
      const h = window.requestIdleCallback(run, { timeout: 2000 })
      cancel = () => window.cancelIdleCallback(h)
    } else {
      const h = window.setTimeout(run, 200)
      cancel = () => window.clearTimeout(h)
    }
    return () => {
      dead = true
      cancel()
      img?.removeEventListener("load", read)
      img?.removeEventListener("error", clear)
      clear()
    }
  }, [stageRef, src])
}
