"use client"

import * as React from "react"

import type { ImageSlot, MediaSlot, VideoSlot } from "@/registry/factory/contract/block-contract"
import { Image as ImageIcon } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"

import { blockLabels } from "../_shared/block-labels"

// 히어로 미디어 칸 렌더(P3-2 Task 3 — 공유 조각 block-shared-hero-media). 값은 block-contract 의 ImageSlot·VideoSlot 이다.
//   MediaImage  <picture>(AVIF → WebP) — 자리 비(width·height)를 미리 잡는다. priority 면 첫 칠 대상(eager · fetchPriority high), 아니면 lazy.
//   MediaVideo  포스터 그림 위에 <video>(소리 없음·반복·inline, preload none). 보일 때만·탭이 보일 때만·동작 줄이기가 아닐 때만 재생한다.
//               재생이 시작되기 전·동작 줄이기에서는 포스터(첫 프레임)가 그대로 보인다 — 서버 HTML 에도 포스터가 있다(첫 칠).
// 부모 칸이 자리(비율·높이)를 잡고, 그림은 칸을 채운다(object-cover · focal).
const pos = (f?: { x: number; y: number }) => (f ? `${(f.x * 100).toFixed(0)}% ${(f.y * 100).toFixed(0)}%` : undefined)

// 보드 미리보기 전용 표지(P3-5 MOTKIT, 대장 C342): 실사 필수 칸을 결선 미리보기에서만 스톡·생성으로 채운 그림 위에 늘 보이는 띠. 공개본에는 이 값이 없다
// (05-media 가 공개 모드에서는 넣지 않고, 미리보기 모드에서도 06 이 「공개 불가 — 실제 사진 필요」 사유를 남긴다).
// 확대·이동하는 층 안에 두면 층과 함께 커지고 잘린다(brand-2 영상 히어로 「eview-only photo」) — 그런 히어로는 그림에 badge={false} 를 주고
// 층 밖(히어로 상자 — 위치 잡힌 조상)에서 MediaPreviewBadge 로 한 번만 그린다.
function PreviewBadge({ label }: { label?: string }) {
  return label ? <span data-wf-preview-only="" className="absolute start-3 top-3 z-10 bg-background px-2.5 py-1 text-sm leading-[1.4] text-foreground shadow-(--wf-shadow-surface)">{label}</span> : null
}

export function MediaPreviewBadge({ m }: { m?: MediaSlot }) {
  return <PreviewBadge label={m ? (m.kind === "video" ? (m.previewLabel ?? m.poster.previewLabel) : m.previewLabel) : undefined} />
}

// 빈 그림 칸(src 가 비어 납품된 슬롯 — 콘텐츠 규칙: 비우면 빈 슬롯)은 깨진 <img src=""> 도 글 없는 회색 판도 아니라 비율을 지킨 판에 「실제 사진 필요」를 보인다
// (_shared/product-thumb 와 같은 렌더·같은 글 — locale 표 blockLabels, FINAL-WF5). 그림이 아닌 자리 표지라 읽기 도구에는 한 이름(alt — 표지)으로 읽힌다.
export function MediaEmpty({ alt, width, height, locale, className = "" }: { alt?: string; width?: number; height?: number; locale?: "ko" | "en"; className?: string }) {
  const label = blockLabels(locale).photoNeeded
  return (
    <span role="img" aria-label={alt ? `${alt} — ${label}` : label} data-photo-needed="" style={width && height ? { aspectRatio: `${width} / ${height}` } : undefined} className={cn("flex size-full min-h-24 flex-col items-center justify-center gap-1 bg-muted p-2 text-center text-base leading-[1.3] text-muted-foreground", className)}>
      <ImageIcon aria-hidden="true" className="size-8 shrink-0" />
      <span aria-hidden="true">{label}</span>
    </span>
  )
}

export function MediaImage({ m, sizes, priority = false, badge = true, locale, className = "" }: { m: ImageSlot; sizes: string; priority?: boolean; badge?: boolean; locale?: "ko" | "en"; className?: string }) {
  if (!m.src) return <MediaEmpty alt={m.alt} width={m.width} height={m.height} locale={locale} className={className} />
  if (m.previewLabel && badge) {
    return (
      <span className="relative block size-full">
        <MediaImage m={{ ...m, previewLabel: undefined }} sizes={sizes} priority={priority} locale={locale} className={className} />
        <PreviewBadge label={m.previewLabel} />
      </span>
    )
  }
  return (
    <picture>
      {m.sources?.map((s) => <source key={s.type} type={s.type} srcSet={s.srcSet} sizes={sizes} />)}
      <img src={m.src} srcSet={m.srcSet} sizes={sizes} alt={m.alt} width={m.width} height={m.height} loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : "auto"} decoding="async" draggable={false} className={cn("block size-full object-cover", className)} style={{ objectPosition: pos(m.focal) }} />
    </picture>
  )
}

// 보일 때만 재생: 부모가 멈추지 않음 · 화면 안 · 탭이 보임 · 동작 줄이기 아님. 동작 줄이기로 바뀌면 멈추고 첫 프레임(포스터)으로 돌린다.
function useVisiblePlayback(ref: React.RefObject<HTMLVideoElement | null>, paused: boolean) {
  React.useEffect(() => {
    const v = ref.current
    if (!v) return
    const mq = matchMedia("(prefers-reduced-motion: reduce)")
    let visible = false
    const sync = () => {
      const on = !paused && visible && !mq.matches && document.visibilityState === "visible"
      if (on) {
        if (v.preload === "none") v.preload = "auto"
        v.play().catch(() => {})
      } else if (!v.paused) v.pause()
      if (mq.matches && v.hasAttribute("data-playing")) {
        v.removeAttribute("data-playing")
        v.currentTime = 0
      }
    }
    const playing = () => {
      if (!mq.matches) v.setAttribute("data-playing", "")
    }
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting
      sync()
    })
    io.observe(v)
    mq.addEventListener("change", sync)
    document.addEventListener("visibilitychange", sync)
    v.addEventListener("playing", playing)
    return () => {
      io.disconnect()
      mq.removeEventListener("change", sync)
      document.removeEventListener("visibilitychange", sync)
      v.removeEventListener("playing", playing)
      v.pause()
    }
  }, [ref, paused])
}

// 영상 한 칸 — 포스터 그림 위에 영상을 겹친다(재생이 시작되면 영상이 보인다). paused: 부모가 이 칸을 숨겼을 때(고르지 않은 슬라이드 등).
export function MediaVideo({ m, sizes, priority = false, paused = false, badge = true, locale, className = "" }: { m: VideoSlot; sizes: string; priority?: boolean; paused?: boolean; badge?: boolean; locale?: "ko" | "en"; className?: string }) {
  const ref = React.useRef<HTMLVideoElement>(null)
  useVisiblePlayback(ref, paused)
  return (
    <span data-wf-media="video" className={cn("relative block size-full", className)} aria-hidden={m.decorative || undefined} role={m.decorative ? undefined : "img"} aria-label={m.decorative ? undefined : m.alt}>
      <MediaImage m={m.poster.previewLabel ? { ...m.poster, previewLabel: undefined } : m.poster} sizes={sizes} priority={priority} locale={locale} />
      <video ref={ref} data-wf-hold={paused ? "" : undefined} muted loop={m.loop} playsInline preload="none" disablePictureInPicture tabIndex={-1} width={m.width} height={m.height} className="absolute inset-0 block size-full object-cover opacity-0 data-[playing]:opacity-100" style={{ objectPosition: pos(m.focal) }}>
        <source src={m.mp4} type="video/mp4" />
        {m.webm && <source src={m.webm} type="video/webm" />}
      </video>
      {badge ? <PreviewBadge label={m.previewLabel ?? m.poster.previewLabel} /> : null}
    </span>
  )
}

// paused: 영상 칸에만 뜻이 있다(정지 단추·고르지 않은 슬라이드) — 그림 칸은 받지 않는다.
export function Media({ m, paused, ...p }: { m: MediaSlot; sizes: string; priority?: boolean; paused?: boolean; locale?: "ko" | "en"; className?: string }) {
  return m.kind === "video" ? <MediaVideo m={m} paused={paused} {...p} /> : <MediaImage m={m} {...p} />
}
