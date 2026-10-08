// 블록 검수대의 실사 미디어(P3-5 MOTKIT): 모션 그래픽 히어로에 public/media(recipe 키 motkit — factory/media/media-sources.json)의
// 실사 영상·사진을 넘긴다. 예시 콘텐츠(fixture)에는 미디어를 싣지 않는다 — 찍어낸 사이트는 05-media 가 칸을 채우고, 검수대만 여기서 넣는다
// (레시피 검수대 app/qa/recipes/heroes/media.tsx 와 같은 원칙). 자산이 아직 없으면(media:build 전) 넣지 않고 블록은 muted 무대로 그려진다.
import type { ImageSlot, MediaSource, ModelSlot, VideoSlot } from "@/registry/factory/contract/block-contract"
import manifest from "@/public/media/manifest.json"

import { imageSlot, videoSlot } from "../recipes/heroes/media"

type Asset = { recipe: string; slot: string; kind: string; video?: unknown }
const ASSETS = manifest.assets as Asset[]
const R = "motkit"
const has = (slot: string, kind?: "video" | "image") => ASSETS.some((a) => a.recipe === R && a.slot === slot && (!kind || (kind === "video" ? !!a.video : !a.video)))
const video = (slot: string): VideoSlot | undefined => (has(slot, "video") ? videoSlot(R, slot, { alt: "", decorative: true, source: "real-preferred" }) : undefined)
const image = (slot: string, source: MediaSource = "real-preferred"): ImageSlot | undefined => (has(slot, "image") ? imageSlot(R, slot, { alt: "", source }) : undefined)

// 블록 이름 → 검수대가 더할 props. kinetic-type-video 는 실사 영상(없으면 켄 번스 렌더 영상), ken-burns-stills 는 사진 넷, punch-in-statement 는 생성 사진(없으면 첫 사진).
// 3D 오브젝트 히어로의 예시 자산(Higgsfield 생성 이미지 → 이미지-3D 변환 GLB, 갤러리 예시 전용 — credits.json 에 「공개 키트 포함 전 약관 확인 필요」 표시).
// 쿼리 o3: 없음·model = 모델(GLB + 포스터) · image = 원본 이미지만(2.5D) · none = 아무것도 없음(포스터 자리만) — 대체 순서 네 갈래를 검수대에서 본다.
function object3d(query?: string): Record<string, unknown> {
  const mode = new URLSearchParams(query ?? "").get("o3") ?? "model"
  const a = ASSETS.find((x) => x.recipe === R && x.slot === "object-3d-orbit") as (Asset & { model?: { glb: string } }) | undefined
  if (!a || mode === "none") return {}
  const poster = imageSlot(R, "object-3d-orbit", { alt: "코발트 빛 유약을 입힌 둥근 도자 그릇(예시 생성 이미지)", source: "generated-ok" })
  if (mode === "image" || !a.model) return { media: poster }
  const model: ModelSlot = { src: `/media/${a.model.glb}`, poster, source: "generated-ok", alt: "천천히 돌아가는 코발트 유약 도자 그릇의 3D 모델(예시)" }
  return { model }
}

// 쿼리 media=empty: 그림 칸을 src 가 빈 슬롯으로 납품한 모양(콘텐츠 규칙: 비우면 빈 슬롯) — _shared/hero-media 의 「실제 사진 필요」 판을 검수대에서 본다(FINAL-WF5).
const EMPTY_SLOT_HEROES = new Set(["block-hero-baseline-split", "block-hero-screenshot-window"])
export function galleryMedia(block: string, query?: string): Record<string, unknown> {
  if (new URLSearchParams(query ?? "").get("media") === "empty" && EMPTY_SLOT_HEROES.has(block)) return { media: { src: "", srcSet: "", alt: "지점 외관(예시)", width: 1600, height: 900, source: "real-required" } satisfies ImageSlot }
  if (block === "block-hero-object-3d-orbit") return object3d(query)
  if (block === "block-hero-kinetic-type-video") {
    const m = video("kinetic-video") ?? video("reel-montage")
    return m ? { media: m } : {}
  }
  if (block === "block-hero-ken-burns-stills") {
    const stills = [0, 1, 2, 3].map((i) => image(`reel-${i}`)).filter((x): x is ImageSlot => !!x)
    return stills.length ? { stills } : {}
  }
  if (block === "block-hero-punch-in-statement") {
    const m = image("punch", "generated-ok") ?? video("reel-montage") ?? image("reel-0")
    return m ? { media: m } : {}
  }
  // FV1 새 히어로(보드 A2): 몽타주는 실사 영상 한 컷 + 사진 셋, 그림 장면은 생성 허용 칸이라 사진 한 장을 그림 자리에 둔다.
  // mascot-greeting(브랜드가 주는 마스코트)·screenshot-window(실제 제품 화면 real-required)는 일부러 비워 「필요」 틀을 보인다.
  if (block === "block-hero-video-montage") {
    const clips = [video("reel-montage") ?? video("kinetic-video"), image("reel-0"), image("reel-1"), image("reel-2")].filter((x): x is VideoSlot | ImageSlot => !!x)
    return clips.length ? { clips } : {}
  }
  if (block === "block-hero-illustration-scene") {
    const m = image("reel-1", "generated-ok") ?? image("punch", "generated-ok")
    return m ? { media: m } : {}
  }
  return {}
}
