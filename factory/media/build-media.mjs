// 히어로 미디어 빌드(Task 12): node factory/media/build-media.mjs [--only <recipe/slot,…>] [--out <폴더> — 기본 public/media]
// media-sources.json 의 칸마다 원본(.tmp/media-src 의 Pexels 원본 · HIGGSFIELD_DIR 의 생성 영상)을 웹 자산으로 만든다 → public/media/<recipe>/<slot>…
//   정지 그림  sharp: 폭마다 AVIF + WebP(<slot>-<w>.avif|webp). 원본보다 크게 늘리지 않는다. 가장 큰 WebP 가 예산(STILL_BUDGET)을 넘으면 품질을 내린다.
//   hyperframes  source:"hyperframes" 칸(kind video)은 HYPERFRAMES_DIR/<recipe>/<slot>.mp4(render-hyperframes.mjs 가 만든 렌더)를 영상으로 빌드한다. template·inputs(원본 칸 id 목록)를 적으면 inputs 칸의 출처 줄이 credits 에 이어진다.
//   영상       ffmpeg: H.264 MP4(crf 23 부터, 소리 없음, +faststart) + WebM VP9(crf 36 부터) — 각 ≤ 3MB(VIDEO_BUDGET). 넘으면 crf 를 올리고, 그래도 넘으면 폭을 1280 으로.
//              포스터 = 영상 첫 프레임 → 정지 그림과 같은 폭별 AVIF + WebP(<slot>-poster-<w>.*). 포스터는 첫 칠·동작 줄이기·영상 전 자리에 쓴다.
//   기록       public/media/credits.json(자산마다 한 줄: recipe·slot·file·source·url·author·license·licenseUrl·fetchedAt) ·
//              public/media/manifest.json(히어로가 읽는 크기·파일 목록 — heroes/media.ts 가 ImageSlot·VideoSlot 으로 바꾼다).
// ffmpeg 는 PATH 에서, sharp 는 저장소 의존(next 가 싣는다)에서. 결과 표(파일·크기)를 찍고 합계를 낸다. 종료 0 = 모두 예산 안, 1 = 예산 초과·도구 실패.
import { readFileSync, writeFileSync, mkdirSync, statSync, existsSync, rmSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { designRulesPath } from '../lib/design-rules.mjs'

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const SOURCES = join(ROOT, 'factory', 'media', 'media-sources.json')
export const SRC_DIR = join(ROOT, '.tmp', 'media-src')
export const OUT_DIR = join(ROOT, 'public', 'media')
// Higgsfield 생성물 폴더(선택). HIGGSFIELD_DIR → $WF_DESIGN_RULES_DIR/factory/media/higgsfield → null. null 이면 생성 칸은 higgsfield.request.json 요청으로 남고 공장은 계속 돈다(D24).
export const HIGGSFIELD_DIR = process.env.HIGGSFIELD_DIR?.trim() || designRulesPath('factory/media/higgsfield') || null
// hyperframes 렌더 결과(영상 원본) 폴더 — <폴더>/<recipe>/<slot>.mp4. 렌더 래퍼(render-hyperframes.mjs)가 쓰고 build-media 가 읽는다.
export const HYPERFRAMES_DIR = process.env.HYPERFRAMES_DIR ?? join(ROOT, '.tmp', 'hyperframes')
export const HF_LICENSE = 'Apache-2.0 도구로 합성, 내용은 공장 생성'
export const HF_LICENSE_URL = 'https://www.apache.org/licenses/LICENSE-2.0'
export const STILL_BUDGET =250 * 1024 // 가장 큰 WebP(1440) 한 장
export const VIDEO_BUDGET = 3 * 1024 * 1024 // 8초 영상 한 형식
export const GLB_BUDGET = 2 * 1024 * 1024 // 3D 모델(GLB) 한 개 — object-3d-orbit 계약, 줄이는 도구는 optimize-glb.mjs
export const STILL_Q = { webp: [76, 70, 64, 58, 52], avif: 50 }
export const REPO_TARGET = 40 * 1024 * 1024

// 파일 이름(순수). public/media 기준 상대 경로.
export const stillName = (recipe, slot, w, ext, poster = false) => `${recipe}/${slot}${poster ? '-poster' : ''}-${w}.${ext}`
export const videoName = (recipe, slot, ext) => `${recipe}/${slot}.${ext}`

// 원본 폭보다 큰 폭은 빼고(늘리지 않는다), 남는 것이 없으면 원본 폭 하나(순수).
export function planWidths(widths, srcWidth) {
  const ok = [...new Set(widths)].filter((w) => w <= srcWidth).sort((a, b) => b - a)
  return ok.length ? ok : [srcWidth]
}

// 영상 인코딩 시도 순서(순수): [폭, crf] — 목표 폭에서 crf 두 단계, 그다음 1280 에서 세 단계.
export function videoSteps(codec, width) {
  const base = codec === 'h264' ? 23 : 36
  const at = (w) => [[w, base], [w, base + 2], [w, base + 4]]
  return width > 1280 ? [...at(width).slice(0, 2), ...at(1280)] : at(width)
}

// ffmpeg 인자(순수). 소리 없음(-an), 8초로 자름, 프레임률 30 상한(-fpsmax — 60fps 원본이 예산을 먹지 않게, 그 이하 원본은 그대로), 폭 맞춤(짝수 높이).
export function ffmpegArgs(src, out, { codec, width, crf, seconds = 8 }) {
  const common = ['-y', '-v', 'error', '-i', src, '-t', String(seconds), '-an', '-fpsmax', '30', '-vf', `scale=${width}:-2`]
  if (codec === 'h264') return [...common, '-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf), '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out]
  return [...common, '-c:v', 'libvpx-vp9', '-crf', String(crf), '-b:v', '0', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '2', out]
}
export const posterArgs = (src, out) => ['-y', '-v', 'error', '-i', src, '-frames:v', '1', out]

// 출처 한 줄(순수) — credits.json 의 모양 { recipe, slot, file, source, url, author, license, licenseUrl, fetchedAt }.
export function creditRow(slot, { pexels = null, higgsfield = null, hyperframes = null, license, licenseUrl = null, file }) {
  if (slot.source === 'hyperframes') {
    // 합성은 변환일 뿐 원본 라이선스를 지우지 않는다(GUIDE S10) — 원본 사진·영상의 출처 줄을 license 에 이어 적는다.
    if (!hyperframes?.template) throw new Error(`hyperframes 기록 없음 — ${slot.recipe}/${slot.slot}(template 이 필요)`)
    const from = (hyperframes.chain ?? []).map((c) => `${c.author} ${c.url} (${c.license})`).join(' · ')
    return { recipe: slot.recipe, slot: slot.slot, file, source: 'hyperframes', url: `hyperframes:template/${hyperframes.template}`, author: 'web-factory 합성(hyperframes)', license: from ? `${HF_LICENSE} — 원본: ${from}` : HF_LICENSE, licenseUrl: HF_LICENSE_URL, fetchedAt: hyperframes.created }
  }
  if (slot.source === 'pexels') {
    if (!pexels) throw new Error(`출처 기록 없음 — ${slot.recipe}/${slot.slot}(fetch-pexels.mjs get 을 먼저)`)
    return { recipe: slot.recipe, slot: slot.slot, file, source: 'pexels', url: pexels.url, author: pexels.author, license: pexels.license, licenseUrl: pexels.licenseUrl, fetchedAt: pexels.fetchedAt }
  }
  if (!higgsfield) throw new Error(`Higgsfield 기록 없음 — ${slot.file}`)
  return { recipe: slot.recipe, slot: slot.slot, file, source: 'higgsfield', url: `higgsfield:job/${higgsfield.job}`, author: `운영자 계정 Higgsfield(${higgsfield.model})`, license, licenseUrl, fetchedAt: higgsfield.created }
}

// 예산 판정(순수): 자산 행 → 넘은 것 목록.
export function overBudget(assets) {
  const out = []
  for (const a of assets) for (const f of a.files) {
    if (f.role === 'still-max' && f.bytes > STILL_BUDGET) out.push(`${f.file} ${f.bytes} > ${STILL_BUDGET}`)
    if ((f.role === 'mp4' || f.role === 'webm') && f.bytes > VIDEO_BUDGET) out.push(`${f.file} ${f.bytes} > ${VIDEO_BUDGET}`)
    if (f.role === 'glb' && f.bytes > GLB_BUDGET) out.push(`${f.file} ${f.bytes} > ${GLB_BUDGET}`)
  }
  return out
}

const size = (p) => statSync(p).size
const ff = (args) => execFileSync('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] })

// 정지 그림 폭별 AVIF + WebP → <outDir>/<recipe>/<slot>-<w>.*(기본 public/media). 찍어내기(05-media)는 후보 폴더를 넘긴다.
export async function stills(sharp, src, recipe, slot, widths, { poster = false, outDir = OUT_DIR } = {}) {
  const meta = await sharp(src).metadata()
  const ws = planWidths(widths, meta.width)
  const files = []
  mkdirSync(join(outDir, recipe), { recursive: true })
  for (const w of ws) {
    const webp = stillName(recipe, slot, w, 'webp', poster), avif = stillName(recipe, slot, w, 'avif', poster)
    let q = 0
    for (;;) {
      await sharp(src).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: STILL_Q.webp[q], effort: 5 }).toFile(join(outDir, webp))
      if (w !== ws[0] || size(join(outDir, webp)) <= STILL_BUDGET || q === STILL_Q.webp.length - 1) break
      q++
    }
    await sharp(src).rotate().resize({ width: w, withoutEnlargement: true }).avif({ quality: STILL_Q.avif, effort: 5 }).toFile(join(outDir, avif))
    files.push({ file: webp, bytes: size(join(outDir, webp)), role: w === ws[0] ? 'still-max' : 'still', w, q: STILL_Q.webp[q] }, { file: avif, bytes: size(join(outDir, avif)), role: 'still', w })
  }
  const h = Math.round((meta.height / meta.width) * ws[0])
  return { width: ws[0], height: h, widths: ws, files }
}

// 영상 한 칸: 포스터(첫 프레임 → stills) + H.264·VP9. 돌려주는 것은 manifest 자산의 크기·영상·파일 칸.
export async function videoAsset(sharp, src, recipe, slot, { widths, videoWidth, outDir = OUT_DIR, tmpDir = join(ROOT, '.tmp', 'media-src') }) {
  const tmpPoster = join(tmpDir, recipe, `${slot}-poster.png`)
  mkdirSync(dirname(tmpPoster), { recursive: true })
  ff(posterArgs(src, tmpPoster))
  const st = await stills(sharp, tmpPoster, recipe, slot, widths, { poster: true, outDir })
  const mp4 = encode(src, recipe, slot, 'h264', videoWidth, outDir), webm = encode(src, recipe, slot, 'vp9', videoWidth, outDir)
  const dur = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', join(outDir, mp4.file)], { encoding: 'utf8' }).trim())
  rmSync(tmpPoster, { force: true })
  return { width: st.width, height: st.height, widths: st.widths, video: { mp4: mp4.file, webm: webm.file, width: Math.min(mp4.w, webm.w), duration: +dur.toFixed(2) }, files: [mp4, webm, ...st.files] }
}

function encode(src, recipe, slot, codec, width, outDir = OUT_DIR) {
  const ext = codec === 'h264' ? 'mp4' : 'webm'
  const rel = videoName(recipe, slot, ext), out = join(outDir, rel)
  let last
  for (const [w, crf] of videoSteps(codec, width)) {
    ff(ffmpegArgs(src, out, { codec, width: w, crf }))
    last = { file: rel, bytes: size(out), role: ext, w, crf }
    if (last.bytes <= VIDEO_BUDGET) break
  }
  return last
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const argv = process.argv.slice(2)
  const i = argv.indexOf('--only')
  const only = i >= 0 ? argv[i + 1].split(',') : null
  const o = argv.indexOf('--out')
  const outDir = o >= 0 ? resolve(argv[o + 1]) : OUT_DIR
  try {
    const sharp = createRequire(join(ROOT, 'package.json'))('sharp')
    const cfg = JSON.parse(readFileSync(SOURCES, 'utf8'))
    const hfCredits = HIGGSFIELD_DIR && existsSync(join(HIGGSFIELD_DIR, 'credits.json')) ? JSON.parse(readFileSync(join(HIGGSFIELD_DIR, 'credits.json'), 'utf8')) : []
    const manPath = join(outDir, 'manifest.json'), credPath = join(outDir, 'credits.json')
    const prevAssets = existsSync(manPath) ? JSON.parse(readFileSync(manPath, 'utf8')).assets : []
    const prevCredits = existsSync(credPath) ? JSON.parse(readFileSync(credPath, 'utf8')) : []
    const assets = [], credits = []
    for (const s of cfg.slots) {
      const id = `${s.recipe}/${s.slot}`
      if (only && !only.includes(id)) {
        const a = prevAssets.find((x) => `${x.recipe}/${x.slot}` === id), c = prevCredits.find((x) => `${x.recipe}/${x.slot}` === id)
        if (a && c) { assets.push(a); credits.push(c) }
        continue
      }
      if (s.source === 'higgsfield' && !HIGGSFIELD_DIR) {
        // 선택 자료(D24): 생성물 폴더가 없으면 이 칸은 건너뛰고 이미 만든 자산이 있으면 그대로 둔다.
        const a = prevAssets.find((x) => `${x.recipe}/${x.slot}` === id), c = prevCredits.find((x) => `${x.recipe}/${x.slot}` === id)
        if (a && c) { assets.push(a); credits.push(c) }
        console.log(`${id}: 선택 자료 없음 — HIGGSFIELD_DIR 를 설정하면 생성물을 쓴다 / optional input absent — set HIGGSFIELD_DIR to use generated media${a && c ? ' (기존 자산 유지)' : ''}`)
        continue
      }
      mkdirSync(join(outDir, s.recipe), { recursive: true })
      let asset
      if (s.kind === 'model') {
        // 3D 모델 한 칸: 원본 이미지(s.file — 포스터·2.5D) + 이미지-3D 변환 GLB(s.model, 크면 optimize-glb 로 예산 안으로). 둘 다 HIGGSFIELD_DIR 안, 기록은 그 폴더 credits.json.
        const hfImg = hfCredits.find((x) => x.file === s.file), hfGlb = hfCredits.find((x) => x.file === s.model)
        if (!hfImg || !hfGlb) throw new Error(`Higgsfield 기록 없음 — ${s.file} / ${s.model}(HIGGSFIELD_DIR/credits.json)`)
        const st = await stills(sharp, join(HIGGSFIELD_DIR, s.file), s.recipe, s.slot, s.widths, { outDir })
        const rel = `${s.recipe}/${s.slot}.glb`, out = join(outDir, rel)
        const { optimizeGlb } = await import('./optimize-glb.mjs')
        const r = await optimizeGlb(join(HIGGSFIELD_DIR, s.model), out, { budget: GLB_BUDGET })
        console.log(`${id}: GLB ${r.before} → ${r.after} 바이트`)
        asset = { recipe: s.recipe, slot: s.slot, hero: s.hero, kind: 'model', source: s.source, model: { glb: rel, bytes: r.after }, ...st, files: [...st.files, { file: rel, bytes: r.after, role: 'glb' }] }
        credits.push(creditRow(s, { higgsfield: hfImg, license: `생성물 — 운영자 계정 Higgsfield 생성(${hfImg.created}) · 갤러리 예시 전용, 공개 키트 포함 전 약관 확인 필요`, licenseUrl: cfg.higgsfieldLicenseUrl ?? null, file: st.files[0].file }))
        credits.push(creditRow({ ...s, file: s.model }, { higgsfield: hfGlb, license: `생성물 — 운영자 계정 Higgsfield 생성(${hfGlb.created}) · 갤러리 예시 전용, 공개 키트 포함 전 약관 확인 필요`, licenseUrl: cfg.higgsfieldLicenseUrl ?? null, file: rel }))
      } else if (s.kind === 'image') {
        // 정지 그림 원본: pexels = .tmp/media-src/<recipe>/<slot>.jpg + 출처 기록 · higgsfield = HIGGSFIELD_DIR/<file>(png·jpg) + 그 폴더 credits.json
        const hf = s.source === 'higgsfield' ? hfCredits.find((x) => x.file === s.file) : null
        const src = s.source === 'higgsfield' ? join(HIGGSFIELD_DIR, s.file) : join(SRC_DIR, s.recipe, `${s.slot}.jpg`)
        const rec = s.source === 'pexels' ? JSON.parse(readFileSync(join(SRC_DIR, s.recipe, `${s.slot}.json`), 'utf8')) : null
        const st = await stills(sharp, src, s.recipe, s.slot, s.widths, { outDir })
        asset = { recipe: s.recipe, slot: s.slot, hero: s.hero, kind: 'image', source: s.source, ...st }
        credits.push(creditRow(s, { pexels: rec, higgsfield: hf, license: hf ? `생성물 — 운영자 계정 Higgsfield 생성(${hf.created})` : undefined, licenseUrl: cfg.higgsfieldLicenseUrl ?? null, file: st.files[0].file }))
      } else {
        const src = s.source === 'higgsfield' ? join(HIGGSFIELD_DIR, s.file) : s.source === 'hyperframes' ? join(HYPERFRAMES_DIR, s.file ?? `${s.recipe}/${s.slot}.mp4`) : join(SRC_DIR, s.recipe, `${s.slot}.mp4`)
        const v = await videoAsset(sharp, src, s.recipe, s.slot, { widths: s.widths, videoWidth: s.videoWidth, outDir })
        asset = { recipe: s.recipe, slot: s.slot, hero: s.hero, kind: 'video', source: s.source, ...v }
        const hf = s.source === 'higgsfield' ? hfCredits.find((x) => x.file === s.file) : null
        const pexels = s.source === 'pexels' ? JSON.parse(readFileSync(join(SRC_DIR, s.recipe, `${s.slot}.json`), 'utf8')) : null
        const idOf = (c) => `${c.recipe}/${c.slot}`
        const chain = (s.inputs ?? []).map((id) => credits.find((c) => idOf(c) === id) ?? prevCredits.find((c) => idOf(c) === id) ?? (() => { throw new Error(`${id}: ${s.slot} 의 원본 출처 줄이 없다(원본 칸을 먼저 빌드)`) })())
        const hyperframes = s.source === 'hyperframes' ? { template: s.template, chain, created: new Date().toISOString() } : null
        credits.push(creditRow(s, { higgsfield: hf, pexels, hyperframes, license: cfg.higgsfieldLicense, licenseUrl: cfg.higgsfieldLicenseUrl ?? null, file: v.video.mp4 }))
      }
      assets.push(asset)
      console.log(`${id}: ${asset.files.map((f) => `${f.file.split('/').pop()} ${(f.bytes / 1024).toFixed(0)}KB`).join(' · ')}`)
    }
    const total = assets.flatMap((a) => a.files).reduce((a, f) => a + f.bytes, 0)
    writeFileSync(manPath, JSON.stringify({ assets }, null, 2) + '\n')
    writeFileSync(credPath, JSON.stringify(credits, null, 2) + '\n')
    const over = overBudget(assets)
    console.log(`미디어: 자산 ${assets.length}칸 · 파일 ${assets.flatMap((a) => a.files).length}개 · 합 ${(total / 1048576).toFixed(2)}MB(목표 ≤ ${REPO_TARGET / 1048576}MB) · 예산 초과 ${over.length}`)
    for (const o of over) console.log(`  예산 초과: ${o}`)
    process.exitCode = over.length || total > REPO_TARGET ? 1 : 0
  } catch (e) {
    console.error(`도구 실패: ${e.message}`)
    process.exitCode = 1
  }
}
