// 미디어(05-media, P3-3 Task 8): 원형의 이미지 칸 → 칸마다 어디서 채울지 계획 → 받아서 웹 자산으로.
//   mediaPlan(archetype, content, cand, { sitemap? }) → 계획 줄[] (순수)
//   fetchMedia(plan, outDir, deps) → { manifest, credits, requests } — outDir 에 public/media 와 같은 모양의
//     manifest.json({ assets, placeholders })·credits.json 을 쓰고, 자산은 <outDir>/<recipe>/<칸>-<폭>.* 에 둔다.
//
// 칸 출처(원형 imageSlots.source)마다:
//   real-required  콘텐츠에 운영자가 준 파일(content.media[칸].file)이 있으면 그것(brand), 없으면 placeholder —
//                  화면은 「실제 사진 필요」 틀을 그린다. 스톡으로 대신하지 않는다(가게 사진을 스톡으로 채우면 거짓이다).
//   stock-ok       Pexels(검색어 content.media[칸].query, 없으면 섹션·칸 이름). 사람 없는 사진 → 폭 1440 이상 → 칸 비율 → 레시피 주색 색조 순.
//   generated-ok   Higgsfield — HIGGSFIELD_DIR 에 이미 있는 파일(content.media[칸].higgsfield)만 쓴다. 이름이 없으면 새로 만들지 않고
//                  요청 파일(higgsfield.request.json)에 올리고 그 칸은 「이미지 준비 중」 틀로 둔다. 생성은 에이전트가
//                  Higgsfield 로 하고(배치마다 장부 기록) credits.json 에 한 줄을 더한 뒤 다시 돈다 — 스크립트는 생성기를 부르지 않는다.
//   none           계획에 넣지 않는다.
//   3D 오브젝트 칸(FV1 3D-GEN): 고른 블록의 meta.media 에 `scene3d` 가 있으면(object-3d-orbit) 섹션의 첫 이미지 칸이 오브젝트 칸이다 — 3D 는 이미지에서 시작한다.
//                  ① 원본 이미지: 대표 파일(content.media[칸].file — real-required 칸은 이것뿐, 스톡·생성으로 대신하지 않는다) → HIGGSFIELD_DIR 의 content.media[칸].higgsfield → WF_CODEX_IMAGES=1 이면 Codex CLI 이미지 생성(실사 필수 칸 제외).
//                  ② GLB 모델: HIGGSFIELD_DIR 의 content.media[칸].higgsfieldModel(≤ 2 MB 로 줄여 둔 것이면 그대로, 크면 optimize-glb 로 줄인다).
//                  이미지가 없으면 higgsfield.request.json 에 「이미지 생성 → generate_3d」 두 줄, 이미지만 있으면 generate_3d 한 줄(그 칸은 2.5D 로 간다). 스톡(Pexels) 사진으로 3D 를 만들지 않는다 — 제3자 사진에서 만든 파생물이 된다.
// 03 변형(variants)을 알면(MOTKIT-M): 고른 블록의 meta.media 가 `video` 면 그 섹션의 첫 스톡·생성 칸을 Pexels 영상 한 줄로, `stills` 면 사진 4줄(`<칸>#0…#3`)로 바꾼다. 그 이름이 없으면 위 그대로.
// 보드 미리보기 전용 모드(WF_MEDIA_PREVIEW=1 → mediaPlan({ preview })): real-required 칸도 스톡으로 채우되 자산·출처 줄에 previewOnly: true 를 달고 칸은 placeholders 에 「실제 사진 필요」로 남긴다
//   (06 이 같은 변수가 켜져 있을 때만 사이트에 잇고 previewLabel 을 붙인다 — site-media.mjs wireMedia). 공개 빌드는 이 변수가 없다.
// 칸에 content.media[칸].hyperframes = { template, inputs: [앞선 칸…] } 를 적으면 hyperframes 렌더 칸이다 — WF_HYPERFRAMES=1 이면 렌더, 아니면 hyperframes.request.json + 「이미지 준비 중」 틀.
// 칸 이름은 "<page>/<section kind>/<slot id>". 예산은 build-media 와 같다(WebP 1440 ≤ 250KB, 영상 ≤ 3MB) — 넘으면 던진다.
// Pexels 키는 stock-ok 칸이 있을 때만 읽고, 없으면 doctor(--stage media)와 같은 문장으로 던진다. 오류 문장에서 키 값은 *** 로 가린다.
//   예외(D24 · 키 없는 미리보기): deps.pexelsOptional 이면 키가 없을 때 던지지 않고 스톡 칸을 placeholders(reason "stock-pending", 「이미지 준비 중」 틀)로 남긴다 —
//   06 이 「공개 불가 — 사진 필요」 blocker 로 받아 사이트는 만들어진다. Higgsfield 폴더(HIGGSFIELD_DIR)가 없어도 생성 칸은 요청 파일로 남고 계속된다.
import { mkdirSync, writeFileSync, existsSync, readFileSync, rmSync, copyFileSync, statSync } from 'node:fs'
import { join, extname, basename, resolve, dirname } from 'node:path'
import { createRequire } from 'node:module'
import { readSecret as readSecretEnv, maskSecrets } from '../lib/secret-env.mjs'
import { missingKey, PEXELS_WHERE } from '../doctor.mjs'
import { searchUrl, candidate, rankCandidates, filterMinDuration, pickVideoDownload, sourceRecord } from '../media/fetch-pexels.mjs'
import { ROOT, SOURCES, HIGGSFIELD_DIR, stills, videoAsset, creditRow, overBudget } from '../media/build-media.mjs'
import { hyperframesAvailable, renderTemplate } from '../media/render-hyperframes.mjs'
import { codexImage, codexImagesEnabled, defaultObjectPrompt, objectRequests, GLB_BUDGET } from './object-media.mjs'
import { BLOCK_REGISTRY } from '../scripts/archetypes.mjs'
import { parseOklch } from '../scripts/lib/palette-rules.mjs'
import { hexToOklch, hueDist, ACCENT_C } from '../scripts/lib/palette-lib.mjs'

export const IMAGE_SOURCES = ['real-required', 'stock-ok', 'generated-ok', 'none']
export const PLACEHOLDER_LABEL = { ko: '실제 사진 필요', en: 'Real photo needed', pending: { ko: '이미지 준비 중', en: 'Image in progress' } }
export const WIDTHS = [1440, 960, 480]
export const VIDEO_WIDTH = 1920
export const MIN_WIDTH = 1440
export const HUE_WEIGHT = 0.25 // 색조 차이(0~1)가 비율 차이(로그)에 더해지는 무게 — 같은 비율 사이 순서만 바꿀 만큼
export const REQUEST_FILE = 'higgsfield.request.json'
export const HF_REQUEST_FILE = 'hyperframes.request.json'
export const MIN_VIDEO_SECONDS = 8 // 히어로 영상 원본은 build-media 가 8초로 자르므로 그보다 짧으면 안 된다
export const STILLS_COUNT = 4 // `stills` 블록(켄 번스 몽타주)에 채우는 사진 수 — 계약은 3~5장
const VIDEO_EXT = new Set(['.mp4', '.webm', '.mov'])

// 보드 미리보기 전용 모드(WF_MEDIA_PREVIEW=1): 실사 필수 칸을 스톡으로 채우되 previewOnly 로 표시하고 「실제 사진 필요」 사유(placeholders)는 그대로 둔다.
// 공개 빌드는 이 변수가 없다 — 켜진 실행의 결과는 06 도 같은 변수가 켜져 있을 때만 사이트에 잇는다(site-media.mjs wireMedia).
export const previewMode = (env = process.env) => env.WF_MEDIA_PREVIEW === '1'

let blockMediaCache
/** 블록 이름 → 레지스트리 meta.media(그 블록이 받는 미디어 칸 이름). 모르는 블록은 []. */
export function blockMediaNames(block) {
  blockMediaCache ??= new Map(JSON.parse(readFileSync(BLOCK_REGISTRY, 'utf8')).items.filter((i) => i.type === 'registry:block').map((i) => [i.name, i.meta?.media ?? []]))
  return blockMediaCache.get(block) ?? []
}

// "16:9" → 1.78, "860x1000-1200" → 860/1100(높이 범위의 가운데), 그 밖 → null.
export function aspectRatio(a) {
  const r = /^(\d+):(\d+)$/.exec(a ?? '')
  if (r) return Number(r[1]) / Number(r[2])
  const x = /^(\d+)x(\d+)(?:-(\d+))?$/.exec(a ?? '')
  return x ? Number(x[1]) / ((Number(x[2]) + Number(x[3] ?? x[2])) / 2) : null
}
const orientation = (r) => (r == null ? undefined : r > 1.1 ? 'landscape' : r < 0.9 ? 'portrait' : 'square')

// 후보의 레시피 머리(생성 후보는 cand.recipe 가 머리, 라이브러리 후보는 부르는 쪽이 cand.head 로 넘긴다) → 주색 색조(무채색이면 null).
function recipeHue(cand) {
  const head = typeof cand?.recipe === 'object' ? cand.recipe : cand?.head
  const lch = parseOklch(head?.color?.light?.primary ?? '')
  return lch && lch[1] >= ACCENT_C ? lch[2] : null
}
const recipeId = (cand) => (typeof cand?.recipe === 'string' ? cand.recipe : cand?.recipe?.id ?? cand?.id)

/**
 * 원형 이미지 칸 → 계획 줄. sitemap 을 주면 그 페이지·섹션의 칸만.
 * variants(03 의 이 후보 변형표 "<쪽>/<섹션>" → 블록 이름)를 주면 고른 블록의 meta.media 이름으로 칸의 모양을 정한다 — `video` 는 Pexels **영상** 한 줄,
 *   `stills` 는 사진 4줄(`<칸>#0…#3`). 두 이름을 선언하지 않은 블록·변형표 없음은 예전 줄 그대로다(섹션에서 첫 번째 스톡·생성 칸 하나만 바뀐다).
 * preview(보드 미리보기 전용 모드, previewMode())면 실사 필수 칸을 스톡으로 채우는 줄(previewOnly)로 바꾼다 — 대표 파일(content.media[칸].file)이 있으면 그것이 먼저다.
 * content.media[칸].hyperframes = { template, inputs: [앞선 칸 이름…], variables? } 이면 그 칸은 hyperframes 렌더 줄이다(inputs 의 사진으로 합성).
 */
// 스톡 검색어(FINAL-WF2 AB2): 브리프 주제 낱말 + 칸 이름의 뜻 있는 낱말. 예전 검색어는 구조 이름뿐(「hero hero visual」)이라 Pexels 가 주제와 상관없는 사진(북페어 히어로에 배달 오토바이)을 돌려줬다.
// 레시피 이름은 검색어에 쓰지 않는다(레시피는 모양이지 사진 주제가 아니다). 주제가 없으면 예전 그대로. 사진이 주제에 맞는지는 자동 판정하지 않는다 — 검색어를 credits.json 에 남겨 사람이 본다.
const GENERIC_SLOT_WORDS = new Set(['hero', 'visual', 'background', 'feature', 'banner', 'cover', 'image', 'photo', 'thumb', 'thumbnail', 'main', 'bg', 'section', 'mobile', 'gallery', 'product'])
const TOPIC_NOISE = new Set(['가상', '예시', 'example', 'sample', 'fictional'])
const TOPIC_WORDS = 5
export function stockQuery({ topic, section, img }) {
  const slotWords = String(img.id).split(/[-_\s]+/).filter((w) => w && !GENERIC_SLOT_WORDS.has(w.toLowerCase())).slice(0, 2)
  const topicWords = String(topic ?? '').replace(/[(（][^)）]*[)）]/g, ' ').replace(/[—–·,.:;!?]+/g, ' ').split(/\s+/).filter((w) => w && !TOPIC_NOISE.has(w.toLowerCase())).slice(0, TOPIC_WORDS)
  if (!topicWords.length) return `${section.kind} ${img.id}`.replace(/-/g, ' ')
  return [...topicWords, ...slotWords].join(' ')
}

export function mediaPlan(archetype, content = {}, cand = {}, { sitemap, variants, preview = false, mediaOf = blockMediaNames, topic } = {}) {
  const locale = content?.locale === 'en' ? 'en' : 'ko'
  const keep = sitemap ? new Set(sitemap.pages.flatMap((p) => p.sections.map((s) => `${p.id}/${s.kind}`))) : null
  const recipe = recipeId(cand), hue = recipeHue(cand)
  const rows = []
  for (const page of archetype.pages ?? []) for (const section of page.sections ?? []) {
    if (keep && !keep.has(`${page.id}/${section.kind}`)) continue
    const names = variants?.[`${page.id}/${section.kind}`] ? mediaOf(variants[`${page.id}/${section.kind}`]) : []
    const shape = names.includes('video') ? 'video' : names.includes('stills') ? 'stills' : names.includes('scene3d') ? 'object' : null
    let shaped = false // 모양이 바뀐 칸은 섹션에서 하나뿐
    for (const img of section.imageSlots ?? []) {
      if (!IMAGE_SOURCES.includes(img.source)) throw new Error(`${archetype.id}/${page.id}/${section.kind}/${img.id}: 모르는 이미지 출처 ${img.source}(${IMAGE_SOURCES.join('·')})`)
      if (img.source === 'none') continue
      const slot = `${page.id}/${section.kind}/${img.id}`
      const given = content?.media?.[slot] ?? {}
      const base = { slot, recipe, aspect: img.aspect ?? null }
      const query = given.query ?? stockQuery({ topic, section, img })
      const mark = img.source === 'real-required' ? { previewOnly: true, label: PLACEHOLDER_LABEL[locale] } : {}
      const stock = () => {
        if (!shaped && shape === 'video') { shaped = true; return [{ ...base, source: 'pexels', kind: 'video', query, hue, ...mark }] }
        if (!shaped && shape === 'stills') { shaped = true; return Array.from({ length: STILLS_COUNT }, (_, i) => ({ ...base, slot: `${slot}#${i}`, source: 'pexels', query, hue, ...mark })) }
        return [{ ...base, source: 'pexels', query, hue, ...mark }]
      }
      if (shape === 'object' && !shaped) {
        shaped = true
        const realRequired = img.source === 'real-required'
        if (realRequired && !given.file) rows.push({ ...base, source: 'placeholder', label: PLACEHOLDER_LABEL[locale] }) // 판매 대상은 실제 사진에서 — 생성·스톡으로 대신하지 않는다
        else rows.push({ ...base, source: 'object3d', realRequired, query, file: given.file ?? null, higgsfield: given.higgsfield ?? null, model: given.higgsfieldModel ?? given.model ?? null, prompt: given.prompt ?? null, label: PLACEHOLDER_LABEL.pending[locale] })
        continue
      }
      if (given.file) rows.push({ ...base, source: 'brand', file: given.file })
      else if (img.source === 'real-required' && !preview) rows.push({ ...base, source: 'placeholder', label: PLACEHOLDER_LABEL[locale] })
      else if (given.hyperframes) rows.push({ ...base, source: 'hyperframes', template: given.hyperframes.template, inputs: given.hyperframes.inputs ?? [], variables: given.hyperframes.variables ?? null, label: PLACEHOLDER_LABEL.pending[locale], ...mark })
      else if (img.source === 'real-required' || img.source === 'stock-ok') rows.push(...stock())
      else if (shape && !shaped && !given.higgsfield) rows.push(...stock()) // generated-ok 칸이 video·stills 블록에 들어가면 Pexels 로
      else rows.push({ ...base, source: 'higgsfield', prompt: given.prompt ?? null, ...(given.higgsfield ? { file: given.higgsfield } : {}), label: PLACEHOLDER_LABEL.pending[locale] })
    }
  }
  return rows
}

/** Pexels 영상 고르기(순수): 최소 길이 미만·이미 쓴 것을 빼고, 사람 없음 → 폭 1920 이상 → 16:9 에 가까운 순. 없으면 null. */
export function pickVideo(videos, { aspect = 16 / 9, minDuration = MIN_VIDEO_SECONDS, exclude = new Set() } = {}) {
  const list = filterMinDuration(videos.filter((v) => !exclude.has(v.id)).map((v) => ({ ...candidate('videos', v), raw: v })), minDuration)
  return rankCandidates(list, { minWidth: VIDEO_WIDTH, aspect, minDuration })[0]?.raw ?? null
}

/** Pexels 사진 고르기(순수): rankCandidates 순서(사람 없음 → 폭 → 비율)에 레시피 색조를 같은 무리 안에서만 더한다. */
export function pickPhoto(photos, { aspect = null, hue = null, exclude = new Set() } = {}) {
  const list = rankCandidates(photos.filter((p) => !exclude.has(p.id)).map((p) => ({ ...candidate('photos', p), raw: p })), { minWidth: MIN_WIDTH, aspect })
  if (!list.length) return null
  if (hue == null) return list[0].raw
  const top = list[0], wide = (c) => c.width >= MIN_WIDTH
  const off = (c) => (aspect ? Math.abs(Math.log(c.width / c.height / aspect)) : 0)
  const tint = (c) => {
    const lch = /^#[0-9a-f]{6}$/i.test(c.avg ?? '') ? hexToOklch(c.avg.slice(1)) : null
    return lch && lch[1] >= 0.03 ? hueDist(lch[2], hue) / 180 : 0.5
  }
  const score = (c) => off(c) + HUE_WEIGHT * tint(c)
  return list.filter((c) => c.people === top.people && wide(c) === wide(top)).sort((a, b) => score(a) - score(b))[0].raw
}

const fileName = (slot) => slot.split('/').join('.').replace('#', '.') // 칸 이름의 / 는 파일 이름에서 . 으로(id 에는 . 이 없다), stills 의 # 도 . — 주소에서 # 은 조각(fragment)이라 파일 이름에 둘 수 없다
const now = () => new Date().toISOString()

/**
 * 계획을 받아 자산을 만든다. deps: { fetch, readSecret, sharp, higgsfieldDir, buildVideo, renderHyperframes, now } — 시험은 fetch·buildVideo·renderHyperframes 를 바꿔 끼운다.
 * hyperframes 줄은 deps.renderHyperframes 가 있거나 WF_HYPERFRAMES=1(+npx)일 때만 렌더하고, 아니면 hyperframes.request.json + 「이미지 준비 중」 틀로 둔다.
 * @returns {Promise<{ manifest: { assets: object[], placeholders: object[] }, credits: object[], requests: object[] }>}
 */
export async function fetchMedia(plan, outDir, deps = {}) {
  const fetch = deps.fetch ?? globalThis.fetch
  // null 은 「폴더 없음」을 뜻한다 — ?? 로 쓰면 null 이 기본 폴더($WF_DESIGN_RULES_DIR/…)로 바뀐다
  const hfDir = 'higgsfieldDir' in deps ? deps.higgsfieldDir : HIGGSFIELD_DIR
  const buildVideo = deps.buildVideo ?? videoAsset
  const at = deps.now ?? now
  const srcDir = join(outDir, '.src')
  mkdirSync(srcDir, { recursive: true })
  let sharp = deps.sharp
  const needSharp = () => (sharp ??= createRequire(join(ROOT, 'package.json'))('sharp'))

  let key = null
  let noStock = false // 키 없는 미리보기(D24): deps.pexelsOptional 이면 키가 없을 때 스톡 칸을 「이미지 준비 중」 틀로 두고 계속한다
  if (plan.some((r) => r.source === 'pexels')) {
    key = (deps.readSecret ?? readSecretEnv)('PEXELS_API_KEY')
    if (!key) {
      if (!deps.pexelsOptional) throw new Error(missingKey('PEXELS_API_KEY', PEXELS_WHERE))
      noStock = true
    }
  }
  const pendingLabel = PLACEHOLDER_LABEL.pending[deps.locale === 'en' ? 'en' : 'ko']
  const pexelsLocale = deps.locale === 'ko' ? 'ko-KR' : undefined // 한국어 사이트의 검색어는 한국어 주제어라 Pexels 에 언어를 알린다(없으면 예전 주소 그대로)
  const masked = (msg) => maskSecrets(msg, [key])
  const get = async (url, init) => {
    let r
    try {
      r = await fetch(url, init)
    } catch (e) {
      throw new Error(masked(`도구 실패: Pexels 호출 실패(${e?.message ?? e}) — ${url}`))
    }
    if (!r.ok) throw new Error(masked(`도구 실패: Pexels ${r.status} ${r.statusText ?? ''} — ${url}`))
    return r
  }

  const hfLicense = JSON.parse(readFileSync(SOURCES, 'utf8')).higgsfieldLicenseUrl ?? null
  let hfCredits = null
  const hfCredit = (file) => {
    hfCredits ??= hfDir && existsSync(join(hfDir, 'credits.json')) ? JSON.parse(readFileSync(join(hfDir, 'credits.json'), 'utf8')) : []
    return hfCredits.find((x) => x.file === file) ?? null
  }

  const assets = [], placeholders = [], credits = [], requests = [], hfRequests = [], used = new Set()
  const build = async (src, row) => {
    const name = fileName(row.slot)
    const kind = VIDEO_EXT.has(extname(src).toLowerCase()) ? 'video' : 'image'
    const made = kind === 'video'
      ? await buildVideo(needSharp(), src, row.recipe, name, { widths: WIDTHS, videoWidth: VIDEO_WIDTH, outDir, tmpDir: srcDir })
      : await stills(needSharp(), src, row.recipe, name, WIDTHS, { outDir })
    assets.push({ recipe: row.recipe, slot: row.slot, hero: null, kind, source: row.source, ...(row.previewOnly ? { previewOnly: true } : {}), ...made })
    return kind === 'video' ? made.video.mp4 : made.files[0].file
  }
  // 미리보기 전용(previewOnly) 행은 실사 필수 칸의 스톡 대용이다 — 칸은 placeholders 에 「실제 사진 필요」로 남고(stills 는 칸당 한 번), 출처 줄에도 표시한다.
  const creditOf = new Map() // 칸 → 출처 줄(hyperframes 합성이 원본 줄을 잇는다)
  const sourceFiles = new Map() // 칸 → 받은 원본 파일(hyperframes 입력)
  const pushCredit = (row, c) => {
    const credit = { ...c, ...(row.query && c.source === 'pexels' ? { query: row.query } : {}), ...(row.previewOnly ? { previewOnly: true } : {}) } // 검색어를 남겨 사람이 사진이 주제에 맞는지 본다(AB2)
    credits.push(credit)
    creditOf.set(row.slot, credit)
  }
  const markPreview = (row) => {
    if (!row.previewOnly || /#[1-9]\d*$/.test(row.slot)) return
    placeholders.push({ recipe: row.recipe, slot: row.slot.replace(/#0$/, ''), aspect: row.aspect, reason: 'real-required', label: row.label })
  }
  const searched = new Map() // 같은 검색 주소는 한 번만(stills 네 줄이 같은 검색어를 쓴다)
  const search = async (url) => {
    if (!searched.has(url)) searched.set(url, await (await get(url, { headers: { Authorization: key } })).json())
    return searched.get(url)
  }
  const hyperframesRender = deps.renderHyperframes ?? (hyperframesAvailable() ? renderTemplate : null)

  for (const row of plan) {
    if (row.source === 'placeholder') {
      placeholders.push({ recipe: row.recipe, slot: row.slot, aspect: row.aspect, reason: 'real-required', label: row.label })
    } else if (noStock && row.source === 'pexels') {
      // stills(`<칸>#0…#3`)는 칸당 한 번만 — previewOnly 와 같은 규칙(markPreview).
      if (!/#[1-9]\d*$/.test(row.slot)) placeholders.push({ recipe: row.recipe, slot: row.slot.replace(/#0$/, ''), aspect: row.aspect, reason: row.previewOnly ? 'real-required' : 'stock-pending', label: row.previewOnly ? row.label : pendingLabel })
    } else if (row.source === 'pexels' && row.kind === 'video') {
      const res = await search(searchUrl({ kind: 'videos', query: row.query, orientation: 'landscape', perPage: 15, locale: pexelsLocale }))
      const video = pickVideo(res.videos ?? [], { aspect: aspectRatio(row.aspect) ?? 16 / 9, exclude: used })
      if (!video) throw new Error(`도구 실패: Pexels 영상 검색 「${row.query}」 결과에 ${MIN_VIDEO_SECONDS}초 이상인 영상이 없다 — ${row.slot}`)
      const link = pickVideoDownload(video, { minDuration: MIN_VIDEO_SECONDS }).link
      used.add(video.id)
      const file = join(srcDir, `${fileName(row.slot)}.mp4`)
      writeFileSync(file, Buffer.from(await (await get(link)).arrayBuffer()))
      sourceFiles.set(row.slot, file)
      const main = await build(file, row)
      const rec = sourceRecord({ kind: 'videos', item: video, recipe: row.recipe, slot: row.slot, file: `.src/${basename(file)}`, fetchedAt: at() })
      pushCredit(row, creditRow({ recipe: row.recipe, slot: row.slot, source: 'pexels' }, { pexels: rec, file: main }))
      markPreview(row)
    } else if (row.source === 'pexels') {
      const ratio = aspectRatio(row.aspect)
      const res = await search(searchUrl({ kind: 'photos', query: row.query, orientation: orientation(ratio), perPage: 15, locale: pexelsLocale }))
      const photo = pickPhoto(res.photos ?? [], { aspect: ratio, hue: row.hue, exclude: used })
      if (!photo?.src?.original) throw new Error(`도구 실패: Pexels 검색 「${row.query}」 결과에 쓸 사진이 없다 — ${row.slot}`)
      used.add(photo.id)
      const file = join(srcDir, `${fileName(row.slot)}.jpg`)
      writeFileSync(file, Buffer.from(await (await get(`${photo.src.original}?auto=compress&cs=tinysrgb&w=2400`)).arrayBuffer()))
      sourceFiles.set(row.slot, file)
      const main = await build(file, row)
      const rec = sourceRecord({ kind: 'photos', item: photo, recipe: row.recipe, slot: row.slot, file: `.src/${basename(file)}`, fetchedAt: at() })
      pushCredit(row, creditRow({ recipe: row.recipe, slot: row.slot, source: 'pexels' }, { pexels: rec, file: main }))
      markPreview(row)
    } else if (row.source === 'hyperframes') {
      // 앞서 받은 칸의 원본 사진으로 합성한다. 렌더 도구가 없으면(WF_HYPERFRAMES=1 아님) 요청 파일 + 「이미지 준비 중」 틀 — 글자는 굽지 않는다(GUIDE 0.4).
      const inputs = row.inputs.map((s) => sourceFiles.get(s) ?? (() => { throw new Error(`hyperframes 입력 칸이 앞에 없다 — ${row.slot}: ${s}(계획에서 먼저 받는 칸이어야 한다)`) })())
      if (!hyperframesRender) {
        hfRequests.push({ slot: row.slot, recipe: row.recipe, aspect: row.aspect, template: row.template, inputs: row.inputs, variables: row.variables ?? null })
        placeholders.push({ recipe: row.recipe, slot: row.slot, aspect: row.aspect, reason: 'render-pending', label: row.label })
        continue
      }
      const out = join(srcDir, `${fileName(row.slot)}.mp4`)
      await hyperframesRender({ template: row.template, out, inputs, variables: row.variables ?? undefined })
      const main = await build(out, row)
      pushCredit(row, creditRow({ recipe: row.recipe, slot: row.slot, source: 'hyperframes' }, { hyperframes: { template: row.template, chain: row.inputs.map((s) => creditOf.get(s)), created: at() }, file: main }))
      markPreview(row)
    } else if (row.source === 'object3d') {
      // 3D 오브젝트 칸: 원본 이미지 → (있으면) GLB 모델. 이미지가 없으면 요청 줄을 남기고 「이미지 준비 중」 틀로 둔다.
      const inHf = (name) => (name && hfDir ? join(hfDir, name) : null)
      let imgSrc = null, kind = null, hf = null
      if (row.file) {
        imgSrc = resolve(row.file); kind = 'brand'
        if (!existsSync(imgSrc)) throw new Error(`대표 제공 파일이 없다 — ${row.slot}: ${row.file}`)
      } else if (row.higgsfield) {
        if (!hfDir) throw new Error(`Higgsfield 원본 폴더가 없다(HIGGSFIELD_DIR 미설정) — ${row.slot}: ${row.higgsfield} 를 쓰려면 폴더를 설정한다`)
        imgSrc = inHf(row.higgsfield); kind = 'higgsfield'; hf = hfCredit(row.higgsfield)
        if (!existsSync(imgSrc) || !hf) throw new Error(`Higgsfield 원본 또는 credits.json 기록이 없다 — ${row.slot}: ${imgSrc}`)
      } else if (!row.realRequired && (deps.codexImages ?? codexImagesEnabled())) {
        const made = await (deps.codexImage ?? codexImage)({ prompt: row.prompt ?? defaultObjectPrompt(row.query), workDir: join(srcDir, 'codex', fileName(row.slot)) })
        imgSrc = made.file; kind = 'codex'
      }
      if (!imgSrc) {
        requests.push(...objectRequests({ slot: row.slot, recipe: row.recipe, aspect: row.aspect, prompt: row.prompt ?? defaultObjectPrompt(row.query), haveImage: false }))
        placeholders.push({ recipe: row.recipe, slot: row.slot, aspect: row.aspect, reason: 'generate-pending', label: row.label })
        continue
      }
      const main = await build(imgSrc, { ...row, source: kind })
      const asset = assets.at(-1)
      if (kind === 'brand') credits.push({ recipe: row.recipe, slot: row.slot, file: main, source: 'brand', url: `owner:${basename(imgSrc)}`, author: '대표 제공', license: '대표 제공 자료 — 사용권은 운영자가 확인', licenseUrl: null, fetchedAt: at() })
      else if (kind === 'higgsfield') credits.push(creditRow({ recipe: row.recipe, slot: row.slot, source: 'higgsfield', file: row.higgsfield }, { higgsfield: hf, license: `생성물 — 운영자 계정 Higgsfield 생성(${hf.created})`, licenseUrl: hfLicense, file: main }))
      else credits.push({ recipe: row.recipe, slot: row.slot, file: main, source: 'codex', url: 'codex-exec:image_generation', author: 'Codex CLI 이미지 생성(OpenAI)', license: '생성물 — 사용 약관 확인 필요(docs/qa/factory-v1/asset-licenses.md)', licenseUrl: null, fetchedAt: at() })
      const modelSrc = row.model ? (inHf(row.model) && existsSync(inHf(row.model)) ? inHf(row.model) : resolve(row.model)) : null
      if (modelSrc && existsSync(modelSrc)) {
        const rel = `${row.recipe}/${fileName(row.slot)}.glb`, out = join(outDir, rel)
        mkdirSync(dirname(out), { recursive: true })
        if (statSync(modelSrc).size <= GLB_BUDGET) copyFileSync(modelSrc, out)
        else await (deps.optimizeGlb ?? (async (a, b) => (await import('../media/optimize-glb.mjs')).optimizeGlb(a, b)))(modelSrc, out)
        const bytes = statSync(out).size
        asset.kind = 'model'
        asset.model = { glb: rel, bytes }
        asset.files.push({ file: rel, bytes, role: 'glb' })
        const mhf = hfCredit(row.model)
        credits.push(mhf
          ? { recipe: row.recipe, slot: row.slot, file: rel, source: 'higgsfield', url: `higgsfield:job/${mhf.job}`, author: `운영자 계정 Higgsfield(${mhf.model})`, license: `생성물 — 운영자 계정 Higgsfield 생성(${mhf.created})`, licenseUrl: hfLicense, fetchedAt: mhf.created }
          : { recipe: row.recipe, slot: row.slot, file: rel, source: 'brand', url: `owner:${basename(modelSrc)}`, author: '대표 제공', license: '대표 제공 자료 — 사용권은 운영자가 확인', licenseUrl: null, fetchedAt: at() })
      } else {
        requests.push(...objectRequests({ slot: row.slot, recipe: row.recipe, aspect: row.aspect, haveImage: true, imageFile: row.higgsfield ?? row.file ?? basename(imgSrc) })) // 이미지는 있다 — 그 칸은 2.5D 로 그려지고 모델은 요청으로 남는다
      }
    } else if (row.source === 'brand') {
      const src = resolve(row.file)
      if (!existsSync(src)) throw new Error(`대표 제공 파일이 없다 — ${row.slot}: ${row.file}`)
      const main = await build(src, row)
      credits.push({ recipe: row.recipe, slot: row.slot, file: main, source: 'brand', url: `owner:${basename(src)}`, author: '대표 제공', license: '대표 제공 자료 — 사용권은 운영자가 확인', licenseUrl: null, fetchedAt: at() })
    } else if (row.source === 'higgsfield') {
      if (!row.file) {
        requests.push({ slot: row.slot, recipe: row.recipe, aspect: row.aspect, prompt: row.prompt })
        placeholders.push({ recipe: row.recipe, slot: row.slot, aspect: row.aspect, reason: 'generate-pending', label: row.label })
        continue
      }
      if (!hfDir) throw new Error(`Higgsfield 원본 폴더가 없다(HIGGSFIELD_DIR 미설정) — ${row.slot}: ${row.file} 를 쓰려면 폴더를 설정한다`)
      const src = join(hfDir, row.file)
      const hf = hfCredit(row.file)
      if (!existsSync(src) || !hf) throw new Error(`Higgsfield 원본 또는 credits.json 기록이 없다 — ${row.slot}: ${src}`)
      const main = await build(src, row)
      credits.push(creditRow({ recipe: row.recipe, slot: row.slot, source: 'higgsfield', file: row.file }, { higgsfield: hf, license: `생성물 — 운영자 계정 Higgsfield 생성(${hf.created})`, licenseUrl: hfLicense, file: main }))
    } else {
      throw new Error(`모르는 계획 출처: ${row.source} — ${row.slot}`)
    }
  }

  const over = overBudget(assets)
  if (over.length) throw new Error(`예산 초과(WebP 1440 ≤ 250KB · 영상 ≤ 3MB): ${over.join('; ')}`)
  const manifest = { assets, placeholders }
  writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
  writeFileSync(join(outDir, 'credits.json'), JSON.stringify(credits, null, 2) + '\n')
  const reqPath = join(outDir, REQUEST_FILE)
  if (requests.length) {
    writeFileSync(reqPath, JSON.stringify({
      how: `Higgsfield 로 칸마다 만들고(배치마다 장부 기록), 파일을 ${hfDir ?? 'HIGGSFIELD_DIR 로 정한 폴더'} 에 두고 그 폴더 credits.json 에 { file, job, model, credits, slot, created } 한 줄을 더한 뒤, 콘텐츠 media["<칸>"].higgsfield 에 파일 이름을 적고 05-media 를 다시 돈다. step 이 generate_image 면 이미지, generate_3d 면 그 이미지를 3D 모델(GLB)로 바꾸는 요청이다(결과 파일 이름은 media["<칸>"].higgsfieldModel). WF_CODEX_IMAGES=1 이면 이미지 줄은 Codex CLI 로도 만들 수 있다.`,
      requests,
    }, null, 2) + '\n')
  } else rmSync(reqPath, { force: true })
  const hfReqPath = join(outDir, HF_REQUEST_FILE)
  if (hfRequests.length) {
    writeFileSync(hfReqPath, JSON.stringify({
      how: 'WF_HYPERFRAMES=1 로 05-media 를 다시 돌리면 칸마다 렌더한다(또는 node factory/media/render-hyperframes.mjs --template <이름> --input <사진>… --out <mp4> 로 따로 렌더). 글자는 굽지 않는다. 렌더가 끝난 칸은 manifest 의 영상 자산이 된다.',
      requests: hfRequests,
    }, null, 2) + '\n')
  } else rmSync(hfReqPath, { force: true })
  return { manifest, credits, requests, hyperframesRequests: hfRequests }
}
