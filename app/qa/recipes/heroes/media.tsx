// 히어로 미디어(Task 12): 레퍼런스 DNA 가 사진·영상이던 히어로 칸의 실사 사진·영상. 값은 block-contract 의 ImageSlot·VideoSlot 이고,
// 크기·파일은 빌드 결과(public/media/manifest.json — factory/media/build-media.mjs)에서 읽는다. 출처는 public/media/credits.json(보이지 않는 표기 — Credit).
//   MediaImage  <picture>(AVIF → WebP) — 자리 비(width·height)를 미리 잡는다. priority 면 첫 칠 대상(eager · fetchPriority high), 아니면 lazy.
//   MediaVideo  포스터 그림 위에 <video>(소리 없음·반복·inline, preload none). 보일 때만(IntersectionObserver)·탭이 보일 때만·동작 줄이기가 아닐 때만 재생한다.
//               재생이 시작되기 전·동작 줄이기에서는 포스터(첫 프레임)가 그대로 보인다 — 서버 HTML 에도 포스터가 있다(첫 칠).
import * as React from "react"

import type { ImageSlot, MediaSource, VideoSlot } from "@/registry/factory/contract/block-contract"
import manifest from "@/public/media/manifest.json"
import credits from "@/public/media/credits.json"

type Asset = { recipe: string; slot: string; kind: string; width: number; height: number; widths: number[]; video?: { mp4: string; webm: string } }
const ASSETS = manifest.assets as Asset[]
const BASE = "/media/"

function asset(recipe: string, slot: string) {
  const a = ASSETS.find((x) => x.recipe === recipe && x.slot === slot)
  if (!a) throw new Error(`미디어 없음 ${recipe}/${slot} — npm run media:build`)
  return a
}
const set = (a: Asset, ext: string, poster: boolean) => a.widths.map((w) => `${BASE}${a.recipe}/${a.slot}${poster ? "-poster" : ""}-${w}.${ext} ${w}w`).join(", ")
const one = (a: Asset, ext: string, poster: boolean) => `${BASE}${a.recipe}/${a.slot}${poster ? "-poster" : ""}-${a.widths[0]}.${ext}`

type SlotOpts = { alt: string; focal?: { x: number; y: number }; source?: MediaSource }
function stillOf(a: Asset, poster: boolean, { alt, focal, source }: SlotOpts): ImageSlot {
  return { kind: "image", src: one(a, "webp", poster), srcSet: set(a, "webp", poster), sources: [{ type: "image/avif", srcSet: set(a, "avif", poster) }], alt, width: a.width, height: a.height, focal, source }
}
export const imageSlot = (recipe: string, slot: string, o: SlotOpts): ImageSlot => stillOf(asset(recipe, slot), false, o)
export function videoSlot(recipe: string, slot: string, o: SlotOpts & { decorative?: boolean }): VideoSlot {
  const a = asset(recipe, slot)
  if (!a.video) throw new Error(`영상이 아니다 ${recipe}/${slot}`)
  return { kind: "video", mp4: BASE + a.video.mp4, webm: BASE + a.video.webm, poster: stillOf(a, true, { ...o, alt: "" }), alt: o.alt, decorative: o.decorative, loop: true, muted: true, width: a.width, height: a.height, focal: o.focal, source: o.source }
}

// 히어로마다의 미디어 칸. alt 는 장식이면 빈 문자열(글자가 없는 분위기 그림) — 뜻을 싣는 그림만 이름을 준다.
export const MEDIA = {
  r1Field: imageSlot("r1-measure", "field", { alt: "", focal: { x: 0.4, y: 0.5 }, source: "real-preferred" }),
  // 칩의 초점은 CSS(--chip-x — 스크롤·포인터가 옮긴다)가 정한다.
  r2Chip: imageSlot("r2-signal", "chip", { alt: "", source: "real-preferred" }),
  r3Oval: videoSlot("r3-woodblock", "oval", { alt: "", decorative: true, focal: { x: 0.5, y: 0.55 }, source: "generated-ok" }),
  r3Left: imageSlot("r3-woodblock", "panel-left", { alt: "목판으로 찍은 집 그림 두 장과 먹, 붓(예시 상품 사진)", focal: { x: 0.5, y: 0.45 }, source: "real-required" }),
  r3Right: imageSlot("r3-woodblock", "panel-right", { alt: "주홍 바탕에 놓인 식물 그림 엽서(예시 상품 사진)", focal: { x: 0.5, y: 0.4 }, source: "real-required" }),
  r5Band: videoSlot("r5-celadon", "band", { alt: "", decorative: true, focal: { x: 0.55, y: 0.5 }, source: "generated-ok" }),
  r8Grid: videoSlot("r8-dusk", "grid", { alt: "", decorative: true, focal: { x: 0.5, y: 0.5 }, source: "generated-ok" }),
  r8Slides: [
    imageSlot("r8-dusk", "slide-0", { alt: "", focal: { x: 0.5, y: 0.55 }, source: "real-preferred" }),
    videoSlot("r8-dusk", "slide-1", { alt: "", decorative: true, focal: { x: 0.78, y: 0.3 }, source: "generated-ok" }),
    imageSlot("r8-dusk", "slide-2", { alt: "", focal: { x: 0.5, y: 0.5 }, source: "real-preferred" }),
  ] as (ImageSlot | VideoSlot)[],
  r9Still: videoSlot("r9-clay", "still", { alt: "", decorative: true, focal: { x: 0.47, y: 0.5 }, source: "generated-ok" }),
}

// 출처 표기(보이지 않게 — 읽기 도구에는 읽힌다). recipe·slot 목록의 credits.json 줄.
export function MediaCredit({ items }: { items: [string, string][] }) {
  const rows = (credits as { recipe: string; slot: string; source: string; author: string; url: string }[]).filter((c) => items.some(([r, s]) => c.recipe === r && c.slot === s))
  if (!rows.length) return null
  return (
    <p className="sr-only">
      {rows.map((c) => (
        <span key={`${c.recipe}/${c.slot}`}>{c.source === "pexels" ? `사진·영상: ${c.author}, Pexels(${c.url}). ` : "영상: 생성 예시 영상. "}</span>
      ))}
    </p>
  )
}

const pos = (f?: { x: number; y: number }) => (f ? `${(f.x * 100).toFixed(0)}% ${(f.y * 100).toFixed(0)}%` : undefined)

// 그림 한 장 — 부모 칸을 채운다(object-cover · focal). 부모가 자리(비율·높이)를 잡는다.
export function MediaImage({ m, sizes, priority = false, className = "" }: { m: ImageSlot; sizes: string; priority?: boolean; className?: string }) {
  return (
    <picture>
      {m.sources?.map((s) => <source key={s.type} type={s.type} srcSet={s.srcSet} sizes={sizes} />)}
      <img src={m.src} srcSet={m.srcSet} sizes={sizes} alt={m.alt} width={m.width} height={m.height} loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : "auto"} decoding="async" draggable={false} className={`block size-full object-cover ${className}`} style={{ objectPosition: pos(m.focal) }} />
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
    const playing = () => { if (!mq.matches) v.setAttribute("data-playing", "") }
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; sync() })
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

// 영상 한 칸 — 포스터 그림 위에 영상을 겹친다(재생이 시작되면 영상이 보인다). 부모가 자리를 잡는다.
// paused: 부모가 이 칸을 숨겼을 때(예: 고르지 않은 슬라이드) — 화면 안이어도 돌지 않는다.
export function MediaVideo({ m, sizes, priority = false, paused = false, className = "" }: { m: VideoSlot; sizes: string; priority?: boolean; paused?: boolean; className?: string }) {
  const ref = React.useRef<HTMLVideoElement>(null)
  useVisiblePlayback(ref, paused)
  return (
    <span data-wf-media="video" className={`relative block size-full ${className}`} aria-hidden={m.decorative || undefined} role={m.decorative ? undefined : "img"} aria-label={m.decorative ? undefined : m.alt}>
      <MediaImage m={m.poster} sizes={sizes} priority={priority} />
      <video ref={ref} data-wf-hold={paused ? "" : undefined} muted loop={m.loop} playsInline preload="none" disablePictureInPicture tabIndex={-1} width={m.width} height={m.height} className="absolute inset-0 block size-full object-cover opacity-0 data-[playing]:opacity-100" style={{ objectPosition: pos(m.focal) }}>
        <source src={m.mp4} type="video/mp4" />
        {m.webm && <source src={m.webm} type="video/webm" />}
      </video>
    </span>
  )
}

export function Media({ m, ...p }: { m: ImageSlot | VideoSlot; sizes: string; priority?: boolean; className?: string }) {
  return m.kind === "video" ? <MediaVideo m={m} {...p} /> : <MediaImage m={m} {...p} />
}
