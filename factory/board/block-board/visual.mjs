// 시각 회귀(P3-2 Task 7a Step 4): node factory/board/block-board/visual.mjs <--capture | --compare | --accept> [origin=http://localhost:3000] [--only <블록|kind>,…] [--recipes id,id] [--widths 1440,375] [--themes light,dark] [--limit N] [--baseline <폴더>] [--out <폴더>]
// npm run blocks:visual -- --compare <origin> · blocks:visual:accept. 촬영 행렬(jobs.mjs blockJobs full)의 칸마다 블록 전체를 찍는다 —
//   동작 줄이기(정지 화면)·다크/라이트 명시·fx 기본, 뷰포트를 문서 높이만큼 키워 한 장(captureBeyondViewport 는 진행 중 등장을 다시 시작시킨다 — 레인 A 발견).
//   --capture  기준 폴더(BASELINE_DIR — WF_VISUAL_BASELINE → $WF_DESIGN_RULES_DIR/factory/visual-baseline/blocks → 저장소 .tmp/visual-baseline/blocks)에 <블록>/<레시피>-<폭>-<테마>.webp 로 쓴다(무손실).
//   --compare  같은 칸을 새로 찍어 기준과 비교한다. sharp raw RGBA 에서 채널 차이 > 16 인 픽셀의 비율이 0.5% 를 넘으면 실패 — 실패 목록 + 차이 이미지(<out>/diff/…) + 새 사진(<out>/new/…).
//              기준이 없는 칸도 실패다(「기준 없음」 — 통과로 읽지 않는다). 크기가 다르면 실패다.
//   장면(P3-8 — jobs.mjs SCENE_STEPS): 가입 2단계·해지 2단계·창 열기 화면도 같은 행렬로 찍는다. 파일 이름은 <레시피>-<폭>-<테마>@<단계>.webp 이고, 열린 창은 뷰포트 크기 그대로 찍는다.
//              기준이 없으면 「기준 없음」 실패다 — 새 장면의 첫 사진은 <out>/new/ 에 쌓이고, 운영자가 보고 --accept(또는 --compare 뒤 blocks:visual:accept)를 해야 기준이 된다. --scenes-only · --no-scenes 로 나눠 돈다.
//   --accept   마지막 --compare 에서 실패한 칸의 새 사진으로 기준을 갈아 끼운다(운영자가 의도한 변경이라고 확인한 뒤에만 쓴다).
// 종료: 0 = 모두 문턱 안(또는 촬영·accept 성공) · 1 = 문턱 초과·기준 없음 또는 도구 실패(`도구 실패:`, summary.json 없음) · 2 = 인자 오류.
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { loadBlocks } from '../../scripts/blocks.mjs'
import { loadHeads } from '../recipe-board/jobs.mjs'
import { blockJobs, absUrl, BASELINE_DIR, VISUAL_OUT, ROOT } from './jobs.mjs'
import { openSession, openBlock, fullHeight, sleep, HEIGHT } from './page.mjs'
import { STEPS } from './gates.mjs'

export const CHANNEL_DIFF = 16
export const AREA_THRESHOLD = 0.005
const WEBP = { lossless: true }

// 경로는 버퍼로 읽어서 넘긴다 — sharp 가 파일을 붙잡고 있으면 Windows 에서 기준 파일을 갈아 끼울 수 없다(accept).
const raw = async (input) => {
  const { data, info } = await sharp(typeof input === 'string' ? readFileSync(input) : input).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  return { data, width: info.width, height: info.height }
}

/**
 * 두 이미지(파일 경로·버퍼)의 차이. 채널(R·G·B·A) 하나라도 차이 > channel 인 픽셀을 센다.
 * → { width, height, total, changed, ratio, sizeMismatch, diff(PNG 버퍼 — 바뀐 곳 빨강, 나머지는 옅은 기준) }
 * 크기가 다르면 비교할 수 없어 ratio 1(실패)이다.
 */
export async function diffImages(a, b, { channel = CHANNEL_DIFF } = {}) {
  const [x, y] = await Promise.all([raw(a), raw(b)])
  if (x.width !== y.width || x.height !== y.height) return { width: y.width, height: y.height, baseWidth: x.width, baseHeight: x.height, total: Math.max(x.width * x.height, y.width * y.height), changed: null, ratio: 1, sizeMismatch: true, diff: null }
  const total = x.width * x.height
  const out = Buffer.alloc(total * 4)
  let changed = 0
  for (let i = 0; i < total; i++) {
    const p = i * 4
    const d = Math.max(Math.abs(x.data[p] - y.data[p]), Math.abs(x.data[p + 1] - y.data[p + 1]), Math.abs(x.data[p + 2] - y.data[p + 2]), Math.abs(x.data[p + 3] - y.data[p + 3]))
    if (d > channel) { changed++; out[p] = 255; out[p + 1] = 0; out[p + 2] = 0; out[p + 3] = 255 }
    else { out[p] = 200 + (x.data[p] >> 2); out[p + 1] = 200 + (x.data[p + 1] >> 2); out[p + 2] = 200 + (x.data[p + 2] >> 2); out[p + 3] = 255 }
  }
  const diff = changed ? await sharp(out, { raw: { width: x.width, height: x.height, channels: 4 } }).png().toBuffer() : null
  return { width: x.width, height: x.height, total, changed, ratio: changed / total, sizeMismatch: false, diff }
}
export const judgeDiff = (d, threshold = AREA_THRESHOLD) => d.sizeMismatch || d.ratio > threshold

// 칸 하나를 찍는다 → PNG 버퍼(문서 높이만큼 키운 뷰포트 한 장).
export async function captureRow(session, origin, job) {
  const { send, ev } = session
  const o = await openBlock(session, absUrl(origin, job), { width: job.width, theme: job.theme, motion: 'reduce' }, { waitEntered: false })
  if (!o.ready) throw new Error(`촬영할 블록이 그려지지 않았다(${job.block} ${job.recipe}): ${o.error}`)
  // 장면(SCENE_STEPS — 가입 2단계·해지 2단계·창 열기): 같은 쪽을 연 뒤 gates.mjs STEPS 가 그 단계로 들어간 화면을 찍는다. 못 들어가면 도구 실패다(닫힌 화면을 열린 장면으로 찍지 않는다).
  let scene = null
  if (job.step) {
    if (!STEPS[job.step]) throw new Error(`알 수 없는 장면 단계: ${job.step}`)
    scene = await STEPS[job.step](session)
    if (!scene.ok) throw new Error(`장면 ${job.step} 에 못 들어갔다(${job.block} ${job.recipe} ${job.width}): ${scene.note}`)
  }
  await ev(`(() => { const s = document.createElement('style'); s.textContent = '*{caret-color:transparent!important}'; document.head.appendChild(s); document.activeElement?.blur?.(); window.scrollTo(0, 0); return 1 })()`)
  await sleep(300)
  // 창(role=dialog)은 보는 화면에 붙어 있으므로 뷰포트 크기 그대로 찍는다(문서 높이만큼 키우면 창이 키운 화면 한가운데로 간다). 그 밖에는 문서 높이만큼.
  const viewportShot = scene?.rootSel === '[role=dialog]'
  const { height, capped } = viewportShot ? { height: HEIGHT[job.width] ?? 900, capped: false } : await fullHeight(session, job.width)
  await sleep(150)
  const shot = await send('Page.captureScreenshot', { format: 'png' })
  if (!shot.result?.data) throw new Error(`스크린샷을 못 받았다: ${job.id}`)
  await send('Emulation.setDeviceMetricsOverride', { width: job.width, height: HEIGHT[job.width] ?? 900, deviceScaleFactor: 1, mobile: false })
  return { png: Buffer.from(shot.result.data, 'base64'), height, capped }
}

const toWebp = (png) => sharp(png).webp(WEBP).toBuffer()

async function main(argv) {
  const flag = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv.splice(i, 2)[1] : null }
  const has = (k) => { const i = argv.indexOf(k); if (i >= 0) argv.splice(i, 1); return i >= 0 }
  const modes = ['--capture', '--compare', '--accept'].filter(has)
  const only = flag('--only')?.split(',').filter(Boolean)
  const recipes = flag('--recipes')?.split(',').filter(Boolean)
  const widths = flag('--widths')?.split(',').map(Number)
  const themes = flag('--themes')?.split(',').filter(Boolean)
  const limit = Number(flag('--limit') ?? 0) || null
  const scenesOnly = has('--scenes-only') // 장면(SCENE_STEPS)만
  const noScenes = has('--no-scenes') // 장면을 빼고(기본 화면만 — 예전 행렬)
  const baseline = flag('--baseline') ?? BASELINE_DIR
  const out = flag('--out') ?? VISUAL_OUT
  const origin = (argv.filter((a) => !a.startsWith('--'))[0] ?? 'http://localhost:3000').replace(/\/$/, '')
  if (modes.length !== 1) { console.error('사용: visual.mjs <--capture|--compare|--accept> [origin] [--only …] [--recipes …] [--widths …] [--themes …] [--scenes-only | --no-scenes] [--limit N] [--baseline <폴더>] [--out <폴더>]'); return 2 }
  const mode = modes[0]
  const summaryFile = join(out, 'summary.json')
  mkdirSync(out, { recursive: true })

  if (mode === '--accept') {
    if (!existsSync(summaryFile)) { console.error('도구 실패: 먼저 --compare 를 돌려 summary.json 을 만든다'); return 1 }
    const s = JSON.parse(readFileSync(summaryFile, 'utf8'))
    if (s.mode !== 'compare' || s.baseline !== baseline) { console.error(`도구 실패: 마지막 실행이 같은 기준 폴더의 --compare 가 아니다(${s.mode} · ${s.baseline})`); return 1 }
    const todo = s.rows.filter((r) => r.status !== 'ok' && r.newFile && (!only || only.some((o) => r.file.startsWith(`${o}/`))))
    for (const r of todo) { mkdirSync(dirname(join(baseline, r.file)), { recursive: true }); copyFileSync(r.newFile, join(baseline, r.file)) }
    console.log(`기준 갈아 끼움: ${todo.length}칸(차이 난 칸·기준 없는 칸만 — 나머지 ${s.rows.length - todo.length}칸은 그대로)`)
    return 0
  }

  rmSync(summaryFile, { force: true })
  let session
  try {
    const blocks = loadBlocks(ROOT).filter((b) => b.meta.success && (!only || only.includes(`block-${b.kind}-${b.variant}`) || only.includes(b.kind)))
    if (!blocks.length) throw new Error('고른 블록이 0개다')
    let jobs = blockJobs({ blocks, recipes: loadHeads().filter((h) => !recipes || recipes.includes(h.id)), full: true })
    if (scenesOnly && noScenes) throw new Error('--scenes-only 와 --no-scenes 를 같이 줄 수 없다')
    if (scenesOnly) jobs = jobs.filter((j) => j.step)
    if (noScenes) jobs = jobs.filter((j) => !j.step)
    if (widths) jobs = jobs.filter((j) => widths.includes(j.width))
    if (themes) jobs = jobs.filter((j) => themes.includes(j.theme))
    if (limit) jobs = jobs.slice(0, limit)
    if (!jobs.length) throw new Error('고른 칸이 0개다')
    session = await openSession()
    const rows = []
    let n = 0, bytes = 0
    for (const job of jobs) {
      let cap
      try { cap = await captureRow(session, origin, job) } catch (e1) {
        console.error(`재시도(도구 예외): ${job.file} — ${e1.message}`)
        await session.close().catch(() => {})
        session = await openSession()
        cap = await captureRow(session, origin, job)
      }
      const basePath = join(baseline, job.file)
      if (mode === '--capture') {
        const webp = await toWebp(cap.png)
        mkdirSync(dirname(basePath), { recursive: true })
        writeFileSync(basePath, webp)
        bytes += webp.length
        rows.push({ file: job.file, status: 'ok', bytes: webp.length, height: cap.height, capped: cap.capped })
        console.log(`[${++n}/${jobs.length}] 촬영 ${job.file} ${(webp.length / 1024).toFixed(0)}KB h${cap.height}${cap.capped ? ' (높이 상한)' : ''}`)
      } else {
        let row
        if (!existsSync(basePath)) {
          const nf = join(out, 'new', job.file)
          mkdirSync(dirname(nf), { recursive: true })
          writeFileSync(nf, await toWebp(cap.png))
          row = { file: job.file, status: 'no-baseline', newFile: nf }
        } else {
          const d = await diffImages(basePath, cap.png)
          row = { file: job.file, status: judgeDiff(d) ? 'fail' : 'ok', ratio: +d.ratio.toFixed(5), changed: d.changed, sizeMismatch: d.sizeMismatch, ...(d.sizeMismatch ? { base: `${d.baseWidth}x${d.baseHeight}`, now: `${d.width}x${d.height}` } : {}) }
          if (row.status === 'fail') {
            const nf = join(out, 'new', job.file)
            const df = join(out, 'diff', job.file.replace(/\.webp$/, '.png'))
            mkdirSync(dirname(nf), { recursive: true }); mkdirSync(dirname(df), { recursive: true })
            writeFileSync(nf, await toWebp(cap.png))
            if (d.diff) writeFileSync(df, d.diff)
            Object.assign(row, { newFile: nf, diffFile: d.diff ? df : null })
          }
        }
        rows.push(row)
        console.log(`[${++n}/${jobs.length}] ${row.status === 'ok' ? 'PASS' : 'FAIL'} ${job.file} ${row.status === 'no-baseline' ? '기준 없음' : row.sizeMismatch ? `크기 다름 ${row.base} → ${row.now}` : `${(row.ratio * 100).toFixed(3)}%`}`)
      }
      if (n % 100 === 0) { await session.close(); session = await openSession() }
    }
    const failed = rows.filter((r) => r.status !== 'ok')
    const summary = { mode: mode.slice(2), origin, baseline, channel: CHANNEL_DIFF, threshold: AREA_THRESHOLD, count: rows.length, failed: failed.length, noBaseline: rows.filter((r) => r.status === 'no-baseline').length, bytes: mode === '--capture' ? bytes : undefined, rows }
    writeFileSync(summaryFile, JSON.stringify(summary, null, 2) + '\n')
    console.log(mode === '--capture' ? `시각 기준 촬영: ${rows.length}칸 · ${(bytes / 1048576).toFixed(1)}MB → ${baseline}` : `시각 회귀 비교: ${rows.length}칸 중 실패 ${failed.length}(기준 없음 ${summary.noBaseline}) · 문턱 ${AREA_THRESHOLD * 100}%(채널 차 > ${CHANNEL_DIFF})`)
    return mode === '--capture' ? 0 : failed.length ? 1 : 0
  } catch (e) {
    console.error(`도구 실패: ${e.message}`)
    rmSync(summaryFile, { force: true })
    return 1
  } finally {
    await session?.close().catch(() => {})
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exit(await main(process.argv.slice(2)))
