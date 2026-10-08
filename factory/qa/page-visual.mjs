// 쪽 시각 회귀(P3-4 Task 7): node factory/qa/page-visual.mjs <--capture | --compare | --accept> <golden> [--origin http://localhost:3000] [--routes /,/pricing] [--widths 1440,375] [--themes light,dark]
//   [--baseline <루트>] [--out <폴더>] [--at <ISO 시각>] [--timezone <IANA>] [--no-pin] [--owner-confirmed]
// 블록 행렬(block-board/visual.mjs)의 쪽 단위 짝이다 — 같은 비교 함수(diffImages·judgeDiff)·같은 문턱(채널 차 > 16 인 픽셀이 0.5% 를 넘으면 실패)·같은 차이 이미지·같은 accept 규칙을 쓴다.
// 대상은 라이브러리 레시피와 골든 세트의 고른 안뿐이다(생성 후보 중 고르지 않은 안은 대상이 아니다). 기준은 저장소 밖 —
//   <기준 루트>/<golden>/<route>-<폭>-<테마>.webp   (기본 루트 $WF_DESIGN_RULES_DIR/factory/visual-baseline/golden, 없으면 저장소 .tmp/visual-baseline/golden — WF_PAGE_VISUAL_BASELINE·--baseline 으로 바꾼다. 블록 기준 폴더 …\blocks\ 는 건드리지 않는다)
//   route 파일 이름: "/" → index, "/pricing" → pricing, "/a/b" → a_b (쓸 수 없는 글자는 _ 로).
// 촬영·비교는 같은 조건이다: 동작 줄이기(정지 화면)·테마 명시·시계 고정(clock-pin.mjs — 문서마다 Date 를 고정 시각으로, 시간대 고정. --no-pin 은 음성 대조용)·뷰포트를 문서 높이만큼 키운 한 장.
//   --capture  기준을 쓴다(무손실 WebP). 골든 기준 촬영은 골든 실행이 끝난 뒤(Step 2) — 이 도구는 주소만 받는다.
//   --compare  같은 칸을 새로 찍어 기준과 견준다. 기준 없음·크기 다름도 실패(통과로 읽지 않는다). 실패 칸은 <out>/new·<out>/diff 에 남긴다.
//   --accept   마지막 --compare 에서 어긋난 칸의 새 사진으로 기준을 갈아 끼운다 — **운영자가 의도한 변경이라고 확인한 뒤에만**(--owner-confirmed 없으면 인자 오류).
// 종료: 0 = 모두 문턱 안(또는 촬영·accept 성공) · 1 = 문턱 초과·기준 없음 또는 도구 실패(`도구 실패:`, summary.json 없음·이전 것도 지운다) · 2 = 인자 오류.
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { diffImages, judgeDiff, CHANNEL_DIFF, AREA_THRESHOLD } from '../board/block-board/visual.mjs'
import { openSession, setView, fullHeight, sleep, HEIGHT } from '../board/block-board/page.mjs'
import { navigateAndWait, assertOpened } from './cdp.mjs'
import { pinClock, PIN_AT, PIN_TIMEZONE } from './clock-pin.mjs'
import { designRulesPath } from '../lib/design-rules.mjs'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const PAGE_BASELINE_ROOT = process.env.WF_PAGE_VISUAL_BASELINE ?? designRulesPath('factory/visual-baseline/golden') ?? join(REPO, '.tmp', 'visual-baseline', 'golden')
export const PAGE_OUT = join(REPO, '.tmp', 'page-visual')
const WEBP = { lossless: true }

/** 주소의 경로 → 파일 이름 조각. "/" → index. */
export const routeSlug = (route) => {
  const s = String(route).split(/[?#]/)[0].replace(/^\/+|\/+$/g, '').replace(/[^\w.-]+/g, '_')
  return s || 'index'
}
export const pageFile = (golden, route, width, theme) => `${golden}/${routeSlug(route)}-${width}-${theme}.webp`

/** 칸 목록: 경로 × 폭 × 테마(순서 고정). */
export function pageJobs({ golden, routes, widths, themes }) {
  const jobs = []
  for (const route of routes) for (const width of widths) for (const theme of themes) jobs.push({ golden, route, width, theme, file: pageFile(golden, route, width, theme) })
  const seen = new Set()
  for (const j of jobs) { if (seen.has(j.file)) throw new Error(`칸 이름이 겹친다: ${j.file} (경로 ${j.route})`); seen.add(j.file) }
  return jobs
}

/**
 * 쪽 하나를 찍는다 → { png(Buffer), height, capped }. session = block-board/page.mjs openSession().
 * pin: { at, timezone } | null(고정 안 함 — 음성 대조). 시계 고정은 문서가 열리기 전에 걸린다.
 */
export async function capturePage(session, url, { width, theme = 'light', pin = { at: PIN_AT, timezone: PIN_TIMEZONE } } = {}) {
  const { send, ev } = session
  let pinned = null
  try {
    if (pin) pinned = await pinClock(send, pin)
    await setView(session, { width, theme, motion: 'reduce' })
    const nav = await navigateAndWait(send, ev, url, { timeoutMs: 30000 })
    await assertOpened(nav, ev, url)
    await ev('document.fonts.ready.then(() => 1)')
    await sleep(400)
    await ev(`(() => { const s = document.createElement('style'); s.textContent = '*{caret-color:transparent!important}'; document.head.appendChild(s); document.activeElement?.blur?.(); window.scrollTo(0, 0); return 1 })()`)
    await sleep(300)
    const { height, capped } = await fullHeight(session, width)
    await sleep(150)
    const shot = await send('Page.captureScreenshot', { format: 'png' })
    if (!shot.result?.data) throw new Error(`스크린샷을 못 받았다: ${url}`)
    await send('Emulation.setDeviceMetricsOverride', { width, height: HEIGHT[width] ?? 900, deviceScaleFactor: 1, mobile: false })
    return { png: Buffer.from(shot.result.data, 'base64'), height, capped }
  } finally {
    if (pinned) await pinned.unpin().catch(() => {}) // 다음 칸을 위해 — 고정은 칸마다 새로 건다
  }
}

const toWebp = (png) => sharp(png).webp(WEBP).toBuffer()
const urlOf = (origin, route) => `${origin}${route.startsWith('/') ? route : `/${route}`}`

async function main(argv) {
  const flag = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv.splice(i, 2)[1] : null }
  const has = (k) => { const i = argv.indexOf(k); if (i >= 0) argv.splice(i, 1); return i >= 0 }
  const modes = ['--capture', '--compare', '--accept'].filter(has)
  const origin = (flag('--origin') ?? 'http://localhost:3000').replace(/\/$/, '')
  const routes = (flag('--routes') ?? '/').split(',').filter(Boolean)
  const widths = (flag('--widths') ?? '1440,375').split(',').map(Number)
  const themes = (flag('--themes') ?? 'light,dark').split(',').filter(Boolean)
  const baseline = flag('--baseline') ?? PAGE_BASELINE_ROOT
  const out = flag('--out') ?? PAGE_OUT
  const at = flag('--at') ?? PIN_AT
  const timezone = flag('--timezone') ?? PIN_TIMEZONE
  const noPin = has('--no-pin')
  const confirmed = has('--owner-confirmed')
  const [golden] = argv.filter((a) => !a.startsWith('--'))
  const usage = () => { console.error('사용: page-visual.mjs <--capture|--compare|--accept> <golden> [--origin URL] [--routes /,/x] [--widths 1440,375] [--themes light,dark] [--baseline <루트>] [--out <폴더>] [--at ISO] [--timezone IANA] [--no-pin] [--owner-confirmed]'); return 2 }
  if (modes.length !== 1 || !golden || /[\\/]/.test(golden)) return usage()
  if (widths.some((w) => !Number.isInteger(w) || w <= 0) || !themes.every((t) => t === 'light' || t === 'dark')) return usage()
  const mode = modes[0]
  if (mode === '--accept' && !confirmed) { console.error('인자 오류: --accept 는 운영자가 의도한 변경이라고 확인한 뒤에만 쓴다 — 확인했다면 --owner-confirmed 를 함께 준다'); return 2 }
  const summaryFile = join(out, 'summary.json')
  mkdirSync(out, { recursive: true })

  if (mode === '--accept') {
    if (!existsSync(summaryFile)) { console.error('도구 실패: 먼저 --compare 를 돌려 summary.json 을 만든다'); return 1 }
    const s = JSON.parse(readFileSync(summaryFile, 'utf8'))
    if (s.mode !== 'compare' || s.baseline !== baseline || s.golden !== golden) { console.error(`도구 실패: 마지막 실행이 같은 기준·같은 골든의 --compare 가 아니다(${s.mode} · ${s.golden} · ${s.baseline})`); return 1 }
    const todo = s.rows.filter((r) => r.status !== 'ok' && r.newFile)
    for (const r of todo) { mkdirSync(dirname(join(baseline, r.file)), { recursive: true }); copyFileSync(r.newFile, join(baseline, r.file)) }
    console.log(`기준 갈아 끼움: ${todo.length}칸(차이 난 칸·기준 없는 칸만 — 나머지 ${s.rows.length - todo.length}칸은 그대로)`)
    return 0
  }

  rmSync(summaryFile, { force: true })
  let session
  try {
    const jobs = pageJobs({ golden, routes, widths, themes })
    if (!jobs.length) throw new Error('고른 칸이 0개다')
    session = await openSession()
    const pin = noPin ? null : { at, timezone }
    const rows = []
    let n = 0, bytes = 0
    for (const job of jobs) {
      let cap
      try { cap = await capturePage(session, urlOf(origin, job.route), { width: job.width, theme: job.theme, pin }) } catch (e1) {
        console.error(`재시도(도구 예외): ${job.file} — ${e1.message}`)
        await session.close().catch(() => {})
        session = await openSession()
        cap = await capturePage(session, urlOf(origin, job.route), { width: job.width, theme: job.theme, pin })
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
      if (n % 60 === 0) { await session.close(); session = await openSession() }
    }
    const failed = rows.filter((r) => r.status !== 'ok')
    const summary = { mode: mode.slice(2), golden, origin, baseline, channel: CHANNEL_DIFF, threshold: AREA_THRESHOLD, clock: noPin ? null : { at, timezone }, count: rows.length, failed: failed.length, noBaseline: rows.filter((r) => r.status === 'no-baseline').length, bytes: mode === '--capture' ? bytes : undefined, rows }
    writeFileSync(summaryFile, JSON.stringify(summary, null, 2) + '\n')
    console.log(mode === '--capture' ? `쪽 시각 기준 촬영: ${rows.length}칸 · ${(bytes / 1048576).toFixed(1)}MB → ${join(baseline, golden)}` : `쪽 시각 회귀 비교: ${rows.length}칸 중 실패 ${failed.length}(기준 없음 ${summary.noBaseline}) · 문턱 ${AREA_THRESHOLD * 100}%(채널 차 > ${CHANNEL_DIFF})`)
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
