// 레시피 보드 v2 촬영(Task 10f · Task 11 에서 8초로): node factory/board/recipe-board/video.mjs [origin=http://localhost:3000] [--only <id,id>] [--out <폴더>]
// --out: 다른 폴더에 찍는다(검토용 — 예: 스크래치 motion/). 그 폴더의 목록은 이번에 찍은 선택지만 싣고 그 수로 검사한다.
// `npm run build` 뒤 `npm start` 서버에서 찍는다. 레시피(r1 … r10 자연 순서) × 선택지(A = 머리, B = alternates 전체)마다, 레시피 기본 테마(defaultTheme, 없으면 light) 하나로:
//   영상  1440×900 첫 화면 8초 · 30fps 두 형식 — H.264 MP4(.mp4, 보드가 먼저 고른다) + WebM VP9(.webm) → .tmp/board2/<id>-<A|B>.<mp4|webm>
//   정지  1440×900 · 375×812(둘 다 배율 2) WebP → .tmp/board2/<id>-<A|B>-<1440|375>.webp
//   동작 줄이기 검사  prefers-reduced-motion: reduce 로 연 첫 화면이 멈춰 있는가(글꼴 준비 뒤 0.3초와 2.8초 두 장이 같은가). 캡처가 실패하면 「멈춤」이 아니라 오류로 적는다.
// 주소는 갤러리의 틀 없는 장면(/qa/recipes?r=<id>&scene=hero[&alt=B]&theme=<t>&frame=1) — 실제 사이트 첫 화면처럼 칸만 화면 폭으로.
// 녹화(컨트롤러 시제품 rec.mjs 를 옮김): 빈 페이지에서 CDP Page.startScreencast(jpeg q95)를 먼저 켜고 탐색해 등장 연출을 담는다 →
//   프레임(시각 포함) → 앞쪽 자르기(히어로 칸이 DOM 에 붙기 전 — 갤러리가 ?r= 를 effect 에서 읽기 전의 검수대 프레임 — 과 빈 프레임) → ffmpeg concat 목록(프레임마다 길이) → 두 형식 인코딩
//   · -t 8(마지막 concat 항목이 길이를 부풀린다). 작은 글자가 번지지 않게(대표 피드백 「글씨가 안 보여」, 2026-09-28) 화질 우선 값을 쓴다:
//   VP9 crf 26(-b:v 0 -row-mt 1 -deadline good -cpu-used 2) · H.264 crf 22(libx264 -preset slow -pix_fmt yuv420p -movflags +faststart, 소리 없음).
//   파일 하나가 4MB 를 넘으면 그 형식만 crf 를 올려 다시 인코딩한다(CRF_STEPS). 합계 예산 60MB(아티팩트 한 판 64MB 안).
// 8초 안의 순서(Task 11): 탐색 → 서체 대기(shots.mjs WAIT_FONTS, stack — 한글 제목 서체 displayKo 포함) → 등장 연출 약 3초 → 화면 높이 60%(문서가
//   짧으면 끝)까지 1.2초에 천천히 내렸다 1초에 올림(SLOW_SCROLL) → 주 CTA 위에 0.9초 → 그림([data-wf-art], 없으면 첫 화면 칸) 위를 포인터로 한 번 쓸기(약 1.2초).
//   시각은 목록 timeline(첫 프레임 기준 초)에 남는다.
// 결과 목록 .tmp/board2/manifest.json: 파일마다 { file, kind, codec?, recipe, option, bytes, duration, fonts } + 선택지마다 동작 줄이기·displayKo 결과(manifestOf).
//   전체 실행은 시작할 때 옛 목록을 지우고, 도구 실패로 끝나면 목록을 남기지 않는다(build2 가 옛 목록으로 보드를 만들지 않게 — 리뷰 L4).
// 종료: 0 = 모두 찍었고 목록 검사(checkManifest) 통과, 1 = 도구 실패(「도구 실패:」) 또는 검사 문제(서체 대기·displayKo·동작 줄이기 오류·예산 초과·길이).
import { writeFileSync, mkdirSync, statSync, existsSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { startChrome, connect, navigateAndWait } from '../../qa/cdp.mjs'
import { loadHeads, ROOT } from './jobs.mjs'
import { WAIT_FONTS, SETTLE } from './shots.mjs'
import { SETTLED } from './hero-motion.mjs'
import { ENTERED_WAIT } from '../../qa/hit-area.mjs'

export const OUT2 = join(ROOT, '.tmp', 'board2')
export const SPAN = 8
export const FPS = 30
export const VIDEO = { width: 1440, height: 900 }
export const STILLS = [{ width: 1440, height: 900, mobile: false }, { width: 375, height: 812, mobile: true }]
export const STILL_DPR = 2
export const VIDEO_MAX = 4 * 1048576
export const TOTAL_MAX = 60 * 1048576
// 형식마다 화질 우선 값에서 시작해 파일이 VIDEO_MAX 를 넘을 때만 올린다.
export const CODECS = ['h264', 'vp9']
export const CRF_STEPS = { vp9: [26, 28, 31, 34], h264: [22, 23, 25, 28] }
export const EXT = { h264: 'mp4', vp9: 'webm' }
const SEL = 'article[data-scene="hero"]'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export const themeOf = (h) => (h.defaultTheme === 'dark' ? 'dark' : 'light')
export const fileNames = (recipe, option) => ({ video: `${recipe}-${option}.webm`, mp4: `${recipe}-${option}.mp4`, 1440: `${recipe}-${option}-1440.webp`, 375: `${recipe}-${option}-375.webp` })
// 레시피 id 의 자연 순서(r1, r2, … r10 — 문자열 정렬이면 r10 이 r1 뒤에 온다).
export const recipeNum = (id) => Number(String(id).match(/^r(\d+)/)?.[1] ?? Infinity)
export const naturalOrder = (heads) => [...heads].sort((a, b) => recipeNum(a.id) - recipeNum(b.id) || String(a.id).localeCompare(String(b.id)))
// 본 서체 목록에 한글 제목 서체(displayKo)가 있는가. 기대가 없으면 null.
const norm = (f) => String(f ?? '').toLowerCase().replace(/[^a-z0-9가-힣]/g, '')
export const sawFont = (fonts, expected) => (expected ? (fonts ?? []).some((x) => norm(x).includes(norm(expected)) || norm(expected).includes(norm(x))) : null)

// 찍을 선택지: 레시피 자연 순서 → A, B(alternates 가 있을 때).
export function optionJobs(heads = loadHeads()) {
  return naturalOrder(heads).flatMap((h) => [
    { recipe: h.id, option: 'A', theme: themeOf(h), query: '', hero: h.hero, displayKo: h.fonts?.displayKo?.family ?? null },
    ...(h.alternates ? [{ recipe: h.id, option: 'B', theme: themeOf(h), query: '&alt=B', hero: h.alternates.hero ?? h.hero, displayKo: (h.alternates.fonts?.displayKo ?? h.fonts?.displayKo)?.family ?? null }] : []),
  ]).map((j) => ({ ...j, files: fileNames(j.recipe, j.option) }))
}
export const frameUrl = (origin, j) => `${origin}/qa/recipes?r=${j.recipe}&scene=hero${j.query}&theme=${j.theme}&frame=1`

// 앞쪽 빈 프레임 자르기: 탐색 시각(from) 전 프레임과, 그 뒤라도 빈 페이지 프레임(blankBytes)의 ratio 배 이하 크기인 프레임을
// 첫 「그려진」 프레임이 나올 때까지 버린다. frames 는 시각순 [{ t, bytes }].
export function trimLeading(frames, { from = -Infinity, blankBytes = null, ratio = 1.2 } = {}) {
  const i = frames.findIndex((f) => f.t >= from && !(blankBytes != null && f.bytes <= blankBytes * ratio))
  return i < 0 ? [] : frames.slice(i)
}

// ffmpeg concat 목록: 첫 프레임부터 span 초 안의 프레임만, 프레임마다 다음 프레임까지의 길이(screencast 는 다시 그릴 때만 프레임을 낸다).
// 마지막 프레임은 span 끝까지. concat 은 마지막 항목의 duration 을 무시하므로 마지막 파일을 한 번 더 적는다(길이는 ffmpeg -t 가 자른다).
// 길이는 시각 차 그대로다(합 = span). 최소 길이로 채우면 몰려 온 프레임마다 길이가 늘어 영상 시간이 벽시계보다 밀린다(r2 시험: 6초 → 7.77초).
// 다음 프레임과 시각이 사실상 같은(< 1ms) 프레임은 버린다 — 같은 순간의 뒤 프레임이 이긴다.
export function concatList(frames, { span = SPAN, sameMs = 1 } = {}) {
  if (!frames.length) throw new Error('프레임 0개')
  const end = frames[0].t + span
  const inSpan = frames.filter((f) => f.t < end)
  const kept = inSpan.filter((f, i) => !(inSpan[i + 1] && inSpan[i + 1].t - f.t < sameMs / 1000))
  const durations = kept.map((f, i) => (kept[i + 1]?.t ?? end) - f.t)
  const text = kept.map((f, i) => `file '${f.name}'\nduration ${durations[i].toFixed(4)}\n`).join('') + `file '${kept.at(-1).name}'\n`
  return { text, frames: kept.length, durations, span }
}

// 형식별 인코더 인자. 두 형식 모두 입력(concat)·-t span(입력 뒤 = 출력 쪽)·fps·yuv420p·소리 없음이 같다.
export const ffmpegArgs = (list, out, { codec = 'vp9', crf = CRF_STEPS[codec][0], span = SPAN, fps = FPS } = {}) => [
  '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-t', String(span),
  '-vf', `fps=${fps},format=yuv420p`,
  ...(codec === 'h264'
    ? ['-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf), '-pix_fmt', 'yuv420p', '-movflags', '+faststart']
    : ['-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', String(crf), '-row-mt', '1', '-deadline', 'good', '-cpu-used', '2']),
  '-an', out,
]

// 결과 목록: 선택지 결과(options) → 파일마다 한 줄 + 합계. 동작 줄이기는 선택지마다 한 번.
// 옛 목록(영상 한 형식 — o.video)도 읽는다: o.videos 가 없으면 [o.video].
export function manifestOf({ origin, commit = null, generatedAt = new Date().toISOString(), options }) {
  const files = options.flatMap((o) => [
    ...(o.videos ?? [o.video]).map((v) => ({ file: v.file, kind: 'video', codec: v.codec ?? 'vp9', recipe: o.recipe, option: o.option, width: VIDEO.width, height: VIDEO.height, bytes: v.bytes, duration: v.duration, crf: v.crf, fonts: o.fonts })),
    ...o.stills.map((s) => ({ file: s.file, kind: 'still', recipe: o.recipe, option: o.option, width: s.width, height: s.height, dpr: s.dpr, bytes: s.bytes, duration: null, fonts: s.fonts })),
  ])
  const bytes = files.reduce((a, f) => a + f.bytes, 0)
  const videos = files.filter((f) => f.kind === 'video')
  const maxVideoBytes = Math.max(0, ...videos.map((f) => f.bytes))
  const moving = options.filter((o) => o.reducedMotion?.still === false).map((o) => `${o.recipe}-${o.option}`)
  const failed = options.filter((o) => o.reducedMotion && o.reducedMotion.still !== true && o.reducedMotion.still !== false).map((o) => `${o.recipe}-${o.option}`)
  return {
    origin, commit, generatedAt, count: files.length, bytes,
    totalMB: +(bytes / 1048576).toFixed(2), maxVideoBytes, maxVideoMB: +(maxVideoBytes / 1048576).toFixed(2),
    byKind: Object.fromEntries(['mp4', 'webm', 'webp'].map((x) => [x, +(files.filter((f) => f.file.endsWith(`.${x}`)).reduce((a, f) => a + f.bytes, 0) / 1048576).toFixed(2)])),
    budget: { videoMaxBytes: VIDEO_MAX, totalMaxBytes: TOTAL_MAX },
    reducedMotion: { checked: options.length, still: options.filter((o) => o.reducedMotion?.still === true).length, moving, failed },
    files, options,
  }
}

// 목록 검사: 선택지마다 영상 2(MP4 + WebM) + 정지 2, 영상 길이 span ±0.25초, 예산, 서체·displayKo, 동작 줄이기 기록. 문제 목록을 돌려준다(빈 목록 = 통과).
export function checkManifest(m, { expectOptions } = {}) {
  const p = []
  if (expectOptions != null && m.options.length !== expectOptions) p.push(`선택지 ${m.options.length} ≠ ${expectOptions}`)
  if (m.count !== m.files.length) p.push(`count ${m.count} ≠ 파일 ${m.files.length}`)
  if (m.bytes !== m.files.reduce((a, f) => a + f.bytes, 0)) p.push('bytes 합이 다르다')
  if (m.bytes > TOTAL_MAX) p.push(`합계 ${(m.bytes / 1048576).toFixed(1)}MB > ${TOTAL_MAX / 1048576}MB`)
  for (const o of m.options) {
    const mine = m.files.filter((f) => f.recipe === o.recipe && f.option === o.option)
    const v = mine.filter((f) => f.kind === 'video'), s = mine.filter((f) => f.kind === 'still')
    const tag = `${o.recipe}-${o.option}`
    const exts = v.map((f) => f.file.split('.').pop()).sort().join('+')
    if (exts !== 'mp4+webm' || s.length !== 2) p.push(`${tag}: 영상 ${exts || '없음'} · 정지 ${s.length}`)
    for (const f of v) {
      if (f.bytes > VIDEO_MAX) p.push(`${tag}: 영상 ${f.file} ${(f.bytes / 1048576).toFixed(2)}MB > ${VIDEO_MAX / 1048576}MB`)
      if (!(Math.abs(f.duration - SPAN) <= 0.25)) p.push(`${tag}: 영상 길이 ${f.duration} ≠ ${SPAN}초`)
    }
    for (const f of mine) if (!f.bytes || !Array.isArray(f.fonts) || !f.fonts.length) p.push(`${tag}: ${f.file} 크기·서체 기록 없음`)
    if (!o.reducedMotion) p.push(`${tag}: 동작 줄이기 검사 없음`)
    else if (typeof o.reducedMotion.still !== 'boolean') p.push(`${tag}: 동작 줄이기 검사 실패 — ${o.reducedMotion.error ?? '결과 없음'}`)
    if (o.fontsOk === false) p.push(`${tag}: 서체 대기 실패 — ${o.fontsWhy}`)
    // 한글 제목 서체(리뷰 L3): 영상과 정지 두 장 모두에서 보였는가(기대가 있을 때만).
    const ko = o.displayKo
    if (ko?.expected && (ko.seen !== true || (ko.stills ?? []).some((x) => x !== true))) p.push(`${tag}: 한글 제목 서체 ${ko.expected} 가 보이지 않았다(영상 ${ko.seen} · 정지 ${(ko.stills ?? []).join('/') || '없음'})`)
  }
  return p
}

// 페이지 안: 주 CTA 고르기 — 히어로 안, 첫 화면 안에 다 보이는 a·button 가운데 층 순서로, 같은 층에서는 가장 넓은 것.
// 「주색 칠」 = 바탕색이 그 자리의 --primary(면 스코프면 면의 짝)와 같다. 「밖」 = header·nav 밖. 「큰」 = 높이 40 이상.
// ① 버튼 부품·주색 칠·밖·큰 ② 버튼 부품·주색 칠·머리/내비 안(머리의 주 CTA — 앱 창 속 작은 주색 버튼보다 먼저) ③ 버튼 부품·주색 칠
// ④ 버튼 부품·밖·불투명·큰 ⑤ 버튼 부품·밖·큰 ⑥ 버튼 부품·불투명 ⑦ 버튼 부품 ⑧ 밖·큰 ⑨ 아무거나.
export const PRIMARY_CTA = `(() => {
  const root = document.querySelector('[data-hero]') || document.body
  const cv = document.createElement('canvas'); cv.width = cv.height = 1; const cx = cv.getContext('2d', { willReadFrequently: true })
  const rgba = (c) => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); return [...cx.getImageData(0, 0, 1, 1).data] }
  const alpha = (c) => { if (c === 'transparent') return 0; const m = c.match(/\\/\\s*([\\d.]+)\\s*\\)$/) || c.match(/^rgba\\([^)]*,\\s*([\\d.]+)\\s*\\)$/); return m ? parseFloat(m[1]) : 1 }
  const all = [...root.querySelectorAll('a[href], button')].map((e) => ({ e, r: e.getBoundingClientRect(), cs: getComputedStyle(e) }))
    .filter(({ r, cs }) => r.width >= 24 && r.height >= 24 && r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.5)
  const btn = (x) => x.e.getAttribute('data-slot') === 'button'
  const out = (x) => !x.e.closest('header, nav')
  const big = (x) => x.r.height >= 40
  const opaque = (x) => alpha(x.cs.backgroundColor) >= 0.5
  const primary = (x) => {
    if (!opaque(x)) return false
    const p = document.createElement('span'); p.style.backgroundColor = 'var(--primary)'; x.e.parentElement.appendChild(p)
    const a = rgba(getComputedStyle(p).backgroundColor), b = rgba(x.cs.backgroundColor); p.remove()
    return a.every((v, i) => Math.abs(v - b[i]) <= 3)
  }
  const tiers = [(x) => btn(x) && primary(x) && out(x) && big(x), (x) => btn(x) && primary(x) && !out(x), (x) => btn(x) && primary(x), (x) => btn(x) && out(x) && opaque(x) && big(x), (x) => btn(x) && out(x) && big(x), (x) => btn(x) && opaque(x), btn, (x) => out(x) && big(x), () => true]
  for (const t of tiers) {
    const c = all.filter(t).sort((a, b) => b.r.width * b.r.height - a.r.width * a.r.height)[0]
    if (c) return { text: (c.e.textContent || c.e.getAttribute('aria-label') || '').replace(/\\s+/g, ' ').trim().slice(0, 40), x: Math.round(c.r.left + c.r.width / 2), y: Math.round(c.r.top + c.r.height / 2), tier: tiers.indexOf(t) + 1 }
  }
  return null
})()`

// 페이지 안: 두 PNG(b64)의 다른 픽셀 비율(2px 표본).
const DIFF = (a, b) => `(async () => {
  const load = async (s) => { const i = new Image(); i.src = 'data:image/png;base64,' + s; await i.decode(); const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(i, 0, 0); return x.getImageData(0, 0, c.width, c.height) }
  const A = await load(${JSON.stringify(a)}), B = await load(${JSON.stringify(b)})
  if (A.width !== B.width || A.height !== B.height) return 1
  let d = 0, t = 0
  for (let y = 0; y < A.height; y += 2) for (let x = 0; x < A.width; x += 2) { const i = (y * A.width + x) * 4; t++; if (A.data[i] !== B.data[i] || A.data[i + 1] !== B.data[i + 1] || A.data[i + 2] !== B.data[i + 2]) d++ }
  return +(d / t).toFixed(5)
})()`
// 문서 시작 때 심는다: 히어로 칸이 DOM 에 처음 붙은 시각(epoch ms). 갤러리는 ?r=·&scene= 를 정적 렌더 뒤 effect 에서 읽어서,
// 그 전 프레임에는 검수대 전체가 잠깐 보인다 — 그 프레임을 자르는 기준이다(히어로 등장 연출은 칸이 붙을 때 시작하므로 잃는 것이 없다).
export const heroMark = (sel) => `(() => { const sel = ${JSON.stringify(sel)}; const mo = new MutationObserver(() => { if (!window.__heroAt && document.querySelector(sel)) { window.__heroAt = performance.timeOrigin + performance.now(); mo.disconnect() } }); mo.observe(document, { childList: true, subtree: true }) })()`
export const HERO_MARK = heroMark(SEL)
// 페이지 안: ms 동안 천천히 스크롤(ease-in-out) — 브라우저 smooth 스크롤은 너무 빨라 scrub 이 한순간에 지나간다(Task 11).
export const SLOW_SCROLL = (toExpr, ms) => `new Promise((res) => { const from = scrollY, to = ${toExpr}, t0 = performance.now(); const step = (t) => { const k = Math.min(1, (t - t0) / ${ms}); const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; scrollTo(0, Math.round(from + (to - from) * e)); if (k < 1) requestAnimationFrame(step); else res(Math.round(scrollY)) }; requestAnimationFrame(step) })`
// 페이지 안: 포인터로 쓸 그림 상자 — 히어로가 [data-wf-art] 로 표시한 그림(없으면 첫 화면 칸), 화면 안으로 자른다.
export const ART_RECT = `(() => {
  const el = document.querySelector('[data-hero] [data-wf-art]') || document.querySelector('[data-hero] section') || document.querySelector('[data-hero]')
  if (!el) return null
  const r = el.getBoundingClientRect()
  const left = Math.max(0, r.left), top = Math.max(0, r.top), right = Math.min(innerWidth, r.right), bottom = Math.min(innerHeight, r.bottom)
  return right - left > 40 && bottom - top > 40 ? { left, top, width: right - left, height: bottom - top, marked: el.hasAttribute('data-wf-art') } : null
})()`
const RUNNING = `document.getAnimations().filter((a) => a.playState === 'running').length`
const FINITE = `Promise.race([Promise.all(document.getAnimations().filter((a) => a.effect && a.effect.getComputedTiming().iterations !== Infinity).map((a) => a.finished.catch(() => 0))), new Promise((r) => setTimeout(r, 4000))]).then(() => 1)`

async function media(send, theme, motion) {
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: theme }, { name: 'prefers-reduced-motion', value: motion }] })
}
// 마우스를 첫 화면 오른쪽 아래 구석으로(앞 녹화의 hover 가 남지 않게).
const park = (send, w, h) => send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: w - 1, y: h - 1 })

// 선택지 하나: 영상 → 정지 두 장 → 동작 줄이기 검사.
async function captureOption(c, j, origin, out, log) {
  const { send, ev } = c
  const url = j.url ?? frameUrl(origin, j) // j.url: 후보 사이트 주소(방향 보드 — direction-board/build.mjs), j.sel: 그 쪽의 대상 칸 선택자
  const sel = j.sel ?? SEL
  const tmp = join(out, `frames-${j.recipe}-${j.option}`)
  rmSync(tmp, { recursive: true, force: true })
  mkdirSync(tmp, { recursive: true })
  const res = { recipe: j.recipe, option: j.option, theme: j.theme, hero: j.hero, url }
  try {
    // ── 영상 ──
    await send('Emulation.setDeviceMetricsOverride', { width: VIDEO.width, height: VIDEO.height, deviceScaleFactor: 1, mobile: false })
    await media(send, j.theme, 'no-preference')
    // 데우기: 청크·서체를 한 번 받아 둔다(녹화 중 서체 교체가 덜 보이게).
    await navigateAndWait(send, ev, url, { timeoutMs: 60000 })
    await ev(WAIT_FONTS(sel, { stack: true }))
    await navigateAndWait(send, ev, 'about:blank', { timeoutMs: 15000 })
    await park(send, VIDEO.width, VIDEO.height)
    const frames = []
    c.onFrame = (p) => frames.push({ t: p.metadata.timestamp, bytes: p.data.length, data: p.data })
    await send('Page.startScreencast', { format: 'jpeg', quality: 95, maxWidth: VIDEO.width, maxHeight: VIDEO.height, everyNthFrame: 1 })
    await sleep(500)
    const blankBytes = frames.length ? frames.at(-1).bytes : null
    const now = () => Date.now() / 1000
    const T = now()
    const nav = await navigateAndWait(send, ev, url, { timeoutMs: 30000 })
    if (nav?.result?.errorText) throw new Error(`탐색 실패 ${url}: ${nav.result.errorText}`)
    const f = await ev(WAIT_FONTS(sel, { stack: true }))
    const tl = { fontsReady: now() }
    const heroAt = ((await ev('window.__heroAt || 0')) ?? 0) / 1000
    if (!heroAt) log.error(`${j.recipe}-${j.option}: 히어로가 붙은 시각을 못 읽었다 — 탐색 시각부터 자른다`)
    const from = Math.max(T, heroAt)
    res.fonts = f?.fonts ?? []
    res.fontsOk = !!f?.ok
    if (!f?.ok) res.fontsWhy = f?.why ?? '평가 실패'
    res.displayKo = { expected: j.displayKo, seen: sawFont(res.fonts, j.displayKo), stills: [] }
    const settle = Math.min((await ev(SETTLE(sel))) ?? 2000, 2400)
    const until = async (t) => { const d = t - now(); if (d > 0) await sleep(d * 1000) }
    // 등장 연출(Task 11 — 0~2.5초 안무): 모션 키트의 등장 끝 신호(data-wf-entered, Task 11 fix)를 기다리고, 히어로가 붙고 3초(또는 서체 준비 뒤
    // 연출 길이의 60%) 뒤까지 둔다. 신호가 3.3초를 넘으면 8초 안에 스크롤·hover·쓸기가 다 들어가지 않는다 — 경고를 남긴다.
    res.entered = await ev(ENTERED_WAIT)
    tl.entered = now()
    if (res.entered === 'stuck' || tl.entered > from + 3.3) log.error(`${j.recipe}-${j.option}: 등장 끝 신호가 늦다(${res.entered}, 붙은 뒤 ${(tl.entered - from).toFixed(2)}초)`)
    const a = Math.max(from + 3.0, tl.fontsReady + settle / 1000 * 0.6, res.entered === 'entered' ? tl.entered : 0)
    await until(a)
    // 천천히 화면 높이 60%(문서가 짧으면 끝)까지 내렸다 올린다 — 스크롤 연동(scrub)이 보이게.
    tl.scrollDown = now()
    await ev(SLOW_SCROLL('Math.min(Math.round(innerHeight * 0.6), document.documentElement.scrollHeight - innerHeight)', 1200))
    res.scrollReached = await ev('Math.round(scrollY)')
    await until(a + 1.35)
    tl.scrollUp = now()
    await ev(SLOW_SCROLL('0', 1000))
    await until(a + 2.5)
    const cta = await ev(PRIMARY_CTA)
    res.cta = cta
    tl.hoverStart = now()
    if (cta) {
      for (let k = 1; k <= 6; k++) { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: Math.round(VIDEO.width - 1 + (cta.x - VIDEO.width + 1) * k / 6), y: Math.round(VIDEO.height - 1 + (cta.y - VIDEO.height + 1) * k / 6) }); await sleep(30) }
    }
    await until(a + 3.4)
    tl.hoverEnd = now()
    // 그림 위로 포인터를 한 번 쓴다(왼쪽 → 오른쪽, 위아래로 한 번 흔들며) — 기울임·깊이·자석·조준선 같은 포인터 겹이 보이게.
    const art = await ev(ART_RECT)
    res.art = art
    tl.sweepStart = now()
    if (art) {
      const n = 24
      for (let k = 0; k <= n; k++) {
        await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: Math.round(art.left + art.width * (0.1 + 0.8 * k / n)), y: Math.round(art.top + art.height * (0.5 + 0.2 * Math.sin((k / n) * Math.PI * 2))) })
        await sleep(40)
      }
    }
    await until(a + 4.7)
    tl.sweepEnd = now()
    await park(send, VIDEO.width, VIDEO.height)
    const kept0 = trimLeading(frames, { from: from + 0.05, blankBytes })
    if (!kept0.length) throw new Error(`그려진 프레임 0개(프레임 ${frames.length})`)
    await until(kept0[0].t + SPAN + 0.3)
    await send('Page.stopScreencast')
    await sleep(200)
    c.onFrame = null
    const kept = trimLeading(frames, { from: from + 0.05, blankBytes })
    const t0 = kept[0].t
    res.timeline = Object.fromEntries(Object.entries({ nav: T, ...(heroAt ? { heroMounted: heroAt } : {}), ...tl }).map(([k, v]) => [k, +(v - t0).toFixed(2)]))
    res.trimmed = frames.length - kept.length
    kept.forEach((k, i) => { k.name = `f${String(i).padStart(5, '0')}.jpg`; writeFileSync(join(tmp, k.name), Buffer.from(k.data, 'base64')) })
    const list = concatList(kept)
    writeFileSync(join(tmp, 'list.txt'), list.text)
    // 두 형식: H.264 MP4(보드가 먼저 고른다 — 하드웨어 디코드 경로에서 VP9 가 멈추는 브라우저 대비) + WebM VP9. 형식마다 VIDEO_MAX 를 넘을 때만 crf 를 올린다.
    res.videos = []
    for (const codec of CODECS) {
      const file = codec === 'h264' ? j.files.mp4 : j.files.video
      const vfile = join(out, file)
      let crf
      for (crf of CRF_STEPS[codec]) {
        execFileSync('ffmpeg', ffmpegArgs(join(tmp, 'list.txt'), vfile, { codec, crf }))
        if (statSync(vfile).size <= VIDEO_MAX) break
      }
      const duration = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', vfile]).toString().trim())
      res.videos.push({ file, codec, bytes: statSync(vfile).size, duration, crf, frames: list.frames })
    }
    res.video = res.videos.find((v) => v.codec === 'vp9')
    const duration = res.video.duration
    res.hoverInSpan = res.timeline.hoverEnd <= SPAN
    res.sweepInSpan = res.timeline.sweepEnd <= SPAN

    // ── 정지 두 장(배율 2) ──
    res.stills = []
    for (const s of STILLS) {
      await send('Emulation.setDeviceMetricsOverride', { width: s.width, height: s.height, deviceScaleFactor: STILL_DPR, mobile: s.mobile })
      await media(send, j.theme, 'no-preference')
      await navigateAndWait(send, ev, url, { timeoutMs: 30000 })
      await park(send, s.width, s.height)
      const sf = await ev(WAIT_FONTS(sel, { stack: true }))
      if (!sf?.ok) { res.fontsOk = false; res.fontsWhy = `정지 ${s.width}: ${sf?.why ?? '평가 실패'}` }
      await sleep(Math.min((await ev(SETTLE(sel))) ?? 2000, 3000))
      // 모션 키트 GSAP 장면은 getAnimations 에 잡히지 않는다 — 등장 끝 신호(data-wf-entered)까지(Task 11 fix).
      await ev(SETTLED)
      await ev(FINITE)
      const shot = await send('Page.captureScreenshot', { format: 'webp', quality: 80 })
      if (!shot.result?.data) throw new Error(`captureScreenshot 실패 ${j.files[s.width]}`)
      writeFileSync(join(out, j.files[s.width]), Buffer.from(shot.result.data, 'base64'))
      res.stills.push({ file: j.files[s.width], width: s.width, height: s.height, dpr: STILL_DPR, bytes: statSync(join(out, j.files[s.width])).size, fonts: sf?.fonts ?? [] })
      // 한글 제목 서체(리뷰 L3): 정지도 영상과 같은 대기(WAIT_FONTS stack) 뒤 본 서체 목록에서 확인한다.
      res.displayKo.stills.push(sawFont(sf?.fonts, j.displayKo))
    }

    // ── 동작 줄이기: reduce 로 연 첫 화면이 멈춰 있는가 ──
    await send('Emulation.setDeviceMetricsOverride', { width: VIDEO.width, height: VIDEO.height, deviceScaleFactor: 1, mobile: false })
    await media(send, j.theme, 'reduce')
    await navigateAndWait(send, ev, url, { timeoutMs: 30000 })
    await park(send, VIDEO.width, VIDEO.height)
    await ev(WAIT_FONTS(sel, { stack: true }))
    await sleep(300)
    const s1 = (await send('Page.captureScreenshot', { format: 'png' }).catch(() => null))?.result?.data
    await sleep(2500)
    const s2 = (await send('Page.captureScreenshot', { format: 'png' }).catch(() => null))?.result?.data
    const running = await ev(RUNNING)
    // 캡처가 하나라도 없으면 「멈춤」이 아니라 오류다(리뷰 L2 — 둘 다 undefined 면 같다고 읽혔다). 비교 평가가 실패해도 오류.
    const diff = !s1 || !s2 ? null : s1 === s2 ? 0 : await ev(DIFF(s1, s2))
    res.reducedMotion = typeof diff === 'number' ? { still: diff === 0, diff, running } : { still: null, error: !s1 || !s2 ? '동작 줄이기 캡처 실패' : '비교 실패', running }
    await media(send, j.theme, 'no-preference')
    log.log(`${j.recipe}-${j.option} ${res.videos.map((v) => `${v.codec} ${(v.bytes / 1048576).toFixed(2)}MB crf ${v.crf}`).join(' · ')} ${duration.toFixed(2)}s 프레임 ${list.frames}(잘라냄 ${res.trimmed}) · CTA 「${cta?.text ?? '없음'}」 · 스크롤 ${res.scrollReached}px · 서체 ${res.fonts.join(' / ')}${res.fontsOk ? '' : ` · 서체 대기 실패(${res.fontsWhy})`} · reduce ${res.reducedMotion.still === true ? '멈춤' : res.reducedMotion.still === false ? `움직임 ${(diff * 100).toFixed(2)}%` : `오류(${res.reducedMotion.error})`}(실행 중 ${running})`)
    return res
  } finally {
    c.onFrame = null
    rmSync(tmp, { recursive: true, force: true })
  }
}

export async function captureAll(jobs, { origin, out = OUT2, log = console, heroSel = SEL } = {}) {
  mkdirSync(out, { recursive: true })
  const chrome = await startChrome(['--hide-scrollbars', '--force-color-profile=srgb'], { prefix: 'board2-' })
  const results = []
  try {
    const c = { onFrame: null }
    const conn = await connect(chrome.wsUrl, {
      onEvent: (d) => {
        if (d.method !== 'Page.screencastFrame') return
        c.onFrame?.(d.params)
        // 닫힌 뒤의 ack 는 CDP 기한(45초)에 거절된다 — 삼킨다(시제품에서 실제로 났다).
        conn.send('Page.screencastFrameAck', { sessionId: d.params.sessionId }).catch(() => {})
      },
    })
    Object.assign(c, conn)
    await c.send('Page.enable'); await c.send('Runtime.enable')
    await c.send('Page.addScriptToEvaluateOnNewDocument', { source: heroMark(heroSel) })
    for (const j of jobs) results.push(await captureOption(c, j, origin, out, log))
    conn.ws.close()
  } finally {
    await chrome.close()
  }
  return results
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const argv = process.argv.slice(2)
  const flag = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv.splice(i, 2)[1] : null }
  const only = flag('--only')?.split(',')
  const outDir = flag('--out')
  const OUT = outDir ?? OUT2
  const origin = (argv[0] ?? 'http://localhost:3000').replace(/\/$/, '')
  const all = optionJobs()
  const jobs = all.filter((j) => !only || only.includes(j.recipe))
  let code = 0
  const mf = join(OUT, 'manifest.json')
  // 전체 실행은 옛 목록을 먼저 지운다 — 도중에 실패하면 목록이 없어 build2 가 옛 목록(일부만 새 파일)으로 보드를 만들지 못한다(리뷰 L4).
  // --only 는 목록의 다른 줄을 이어 쓰므로 읽어 둔 뒤에만 다시 쓴다.
  const previous = only && !outDir && existsSync(mf) ? JSON.parse(readFileSync(mf, 'utf8')) : null
  rmSync(mf, { force: true })
  try {
    const got = await captureAll(jobs, { origin, out: OUT })
    const kept = previous ? previous.options.filter((o) => !only.includes(o.recipe)) : []
    const order = all.map((j) => `${j.recipe}-${j.option}`)
    const options = [...kept, ...got].sort((a, b) => order.indexOf(`${a.recipe}-${a.option}`) - order.indexOf(`${b.recipe}-${b.option}`))
    let commit = null
    // 커밋 전 작업 트리에서 찍으면 「+dirty」를 붙인다 — 목록의 커밋이 촬영한 코드와 다르다는 표시(리뷰 b1 N4).
    try { commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT }).toString().trim(); if (execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: ROOT }).toString().trim()) commit += '+dirty' } catch {}
    const m = manifestOf({ origin, commit, options })
    writeFileSync(mf, JSON.stringify(m, null, 2) + '\n')
    const problems = checkManifest(m, { expectOptions: outDir ? jobs.length : all.length })
    console.log(`board2: 파일 ${m.count}개 · ${m.totalMB}MB(mp4 ${m.byKind.mp4} · webm ${m.byKind.webm} · webp ${m.byKind.webp}) · 영상 최대 ${m.maxVideoMB}MB · 동작 줄이기 멈춤 ${m.reducedMotion.still}/${m.reducedMotion.checked}${m.reducedMotion.moving.length ? `(움직임: ${m.reducedMotion.moving.join(', ')})` : ''}${m.reducedMotion.failed.length ? `(검사 실패: ${m.reducedMotion.failed.join(', ')})` : ''} → ${OUT}`)
    for (const p of problems) console.error(`문제: ${p}`)
    if (problems.length) code = 1
  } catch (e) {
    console.error(`도구 실패: ${e.message}`)
    rmSync(mf, { force: true })
    code = 1
  }
  process.exit(code)
}
