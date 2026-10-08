// 06-pages 의 미디어 연결(P3-3 Task 9b, 대장 C113) — 05-media manifest(factory/stamp/media.mjs)를 사이트에 잇는다.
//   · 자산 파일을 사이트 public/media/<recipe>/… 로 복사한다(manifest 의 files[].file 은 05-media 폴더 안 상대 경로 — 그대로 /media/<file> 주소가 된다).
//   · 그 칸의 자산을 히어로 블록의 media props(block-contract ImageSlot·VideoSlot)로 바꾼다 — app/qa/recipes/heroes/media.tsx 와 같은 규칙(AVIF → WebP srcSet, 영상은 포스터 + mp4·webm).
//   · 「실제 사진 필요」·「이미지 준비 중」 자리 표시는 media 를 비워 두고(블록은 media 없이 그려진다) 공개 불가 사유로 남는다(gen-pages BLOCKER.photo).
//   칸 이름은 "<쪽>/<섹션>/<칸 id>" — 05-media 의 slot 과 같다. 자산은 후보 레시피의 것만 쓴다(다른 레시피 자산이 섞여 들어오지 않게).
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'

const BASE = '/media/'
/** manifest 자산 출처 → block-contract MediaSource. */
export const SOURCE_POLICY = { brand: 'real-required', pexels: 'real-preferred', higgsfield: 'generated-ok', codex: 'generated-ok', hyperframes: 'real-preferred' }

const stills = (asset, ext, poster) => (asset.files ?? []).filter((f) => f.w && f.file.endsWith(`.${ext}`) && f.file.includes('-poster-') === poster).sort((a, b) => a.w - b.w)
const srcSetOf = (list) => list.map((f) => `${BASE}${f.file} ${f.w}w`).join(', ')

function imageSlotOf(asset, { poster = false, alt = '', source, focal } = {}) {
  const webp = stills(asset, 'webp', poster), avif = stills(asset, 'avif', poster)
  if (!webp.length) throw new Error(`미디어 자산에 WebP 가 없다: ${asset.slot}`)
  const top = webp.at(-1)
  return {
    kind: 'image', src: BASE + top.file, srcSet: srcSetOf(webp),
    ...(avif.length ? { sources: [{ type: 'image/avif', srcSet: srcSetOf(avif) }] } : {}),
    alt, width: asset.width, height: asset.height, ...(focal ? { focal } : {}), ...(source ? { source } : {}),
  }
}

/** 미리보기 전용 사진에 붙는 눈에 보이는 표지(block-contract ImageSlot·VideoSlot 의 previewLabel). */
export const PREVIEW_LABEL = { ko: '미리보기 전용 사진', en: 'Preview-only photo' }

/** manifest 자산 하나 → ImageSlot | VideoSlot. given = 콘텐츠 media[칸] 의 { alt?, focal? }. 영상은 장식(alt 없음)이면 decorative. previewLabel 은 미리보기 전용 자산에만. */
export function slotOf(asset, given = {}, { previewLabel } = {}) {
  const source = SOURCE_POLICY[asset.source]
  const focal = given.focal
  const label = previewLabel ? { previewLabel } : {}
  if (asset.kind === 'video' && asset.video) {
    const alt = given.alt ?? ''
    return {
      kind: 'video', mp4: BASE + asset.video.mp4, webm: BASE + asset.video.webm,
      poster: imageSlotOf(asset, { poster: true, alt: '', source, focal }), alt, ...(alt ? {} : { decorative: true }),
      loop: true, muted: true, width: asset.width, height: asset.height, ...(focal ? { focal } : {}), ...(source ? { source } : {}), ...label,
    }
  }
  return { ...imageSlotOf(asset, { alt: given.alt ?? '', source, focal }), ...label }
}

/** model 자산(이미지에서 만든 GLB + 원본 이미지) → block-contract ModelSlot. 포스터는 원본 이미지. 출처는 대표 파일이면 real-required, 그 밖은 generated-ok. */
export function modelSlotOf(asset, given = {}, { previewLabel } = {}) {
  return {
    src: BASE + asset.model.glb,
    poster: imageSlotOf(asset, { alt: '', source: SOURCE_POLICY[asset.source] }),
    source: asset.source === 'brand' ? 'real-required' : 'generated-ok',
    alt: given.alt ?? '',
    ...(previewLabel ? { previewLabel } : {}),
  }
}

/** 05-media 의 mediaPlan 이 칸마다 적는 레시피 이름(media.mjs recipeId 와 같은 규칙). */
export const mediaRecipeOf = (cand) => (typeof cand?.recipe === 'string' ? cand.recipe : cand?.recipe?.id ?? cand?.id)

/** 사이트에 복사할 자산 파일(05-media 안 상대 경로). */
export const filesOf = (asset) => [...new Set((asset.files ?? []).map((f) => f.file))]

/** 자산 파일을 05-media 폴더에서 siteDir/public/media 로 복사한다. → 복사한 상대 경로[] (없는 파일은 던진다). */
export function copyMediaFiles(mediaDir, siteDir, assets) {
  const copied = []
  for (const a of assets) for (const rel of filesOf(a)) {
    const from = join(mediaDir, rel)
    if (!existsSync(from)) throw new Error(`미디어 파일이 없다: ${from} — 05-media 를 다시 돈다`)
    const to = join(siteDir, 'public', 'media', rel)
    mkdirSync(dirname(to), { recursive: true })
    copyFileSync(from, to)
    copied.push(rel)
  }
  return copied
}

/**
 * 섹션 props 에 media 를 잇는다. 블록이 `media?:` 칸을 가졌고(hasMediaProp), 그 섹션의 이미지 칸(archetype section.imageSlots) 중 이 후보 레시피의
 * 자산이 있는 첫 칸이 있으면 props.media 를 채운다. 블록이 `stills?:` 칸을 가졌으면(hasStillsProp) 칸 이름 + `#0…` 자산들을 props.stills(ImageSlot[])로 채운다.
 * → 채운 자산(stills 는 자산 배열) 또는 null.
 *
 * 미리보기 전용 자산(manifest previewOnly: true — 실사 필수 칸을 스톡으로 채운 보드용 그림)은 엄격하게 다룬다:
 *   · allowPreview(보드 미리보기 모드 — 05·06 이 같은 WF_MEDIA_PREVIEW=1 을 읽는다)가 아니면 잇지 않는다 — 공개 빌드에 스톡이 들어갈 길이 없다.
 *   · 그 칸이 placeholders(공개 불가 사유 「실제 사진 필요」로 남는 칸 — 호출한 쪽이 blocker 를 만든다)에 있을 때만 잇는다. manifest 가 어긋나면(placeholders 에 없음) 잇지 않는다.
 *   · 이어진 슬롯에는 항상 previewLabel(「미리보기 전용 사진」)이 붙는다.
 */
export function wireMedia({ props, sectionKey, imageSlots = [], assets, recipeId, contentMedia = {}, hasMediaProp, hasStillsProp = false, hasModelProp = false, allowPreview = false, placeholders = [], locale = 'ko' }) {
  if (!hasMediaProp && !hasStillsProp && !hasModelProp) return null
  const open = new Set(placeholders.map((p) => p.slot))
  const label = (a) => (a.previewOnly ? { previewLabel: PREVIEW_LABEL[locale === 'en' ? 'en' : 'ko'] } : {})
  const usable = (a, slot) => !a.previewOnly || (allowPreview && open.has(slot))
  for (const img of imageSlots) {
    const slot = `${sectionKey}/${img.id}`
    const stills = hasStillsProp ? assets.filter((a) => a.recipe === recipeId && a.slot.startsWith(`${slot}#`)).sort((a, b) => Number(a.slot.split('#')[1]) - Number(b.slot.split('#')[1])) : []
    const useStills = stills.length > 0 && stills.every((a) => usable(a, slot))
    const asset = hasMediaProp || hasModelProp ? assets.find((a) => a.slot === slot && a.recipe === recipeId) : null
    const useMedia = Boolean(asset) && usable(asset, slot)
    if (!useStills && !useMedia) continue
    if (useStills) props.stills = stills.map((a) => slotOf(a, contentMedia[slot] ?? {}, label(a)))
    // 3D 오브젝트 칸: 모델 자산(GLB + 원본 이미지)은 model 로, 이미지만 있는 자산은 media(2.5D)로 잇는다. model 칸이 없는 블록은 원본 이미지를 media 로만 받는다.
    if (useMedia && asset.kind === 'model' && hasModelProp) props.model = modelSlotOf(asset, contentMedia[slot] ?? {}, label(asset))
    else if (useMedia && hasMediaProp) props.media = slotOf(asset, contentMedia[slot] ?? {}, label(asset))
    else if (!useStills) continue
    return useStills ? [...stills, ...(useMedia ? [asset] : [])] : asset
  }
  return null
}
