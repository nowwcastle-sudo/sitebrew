// 레시피 보드 스크린샷: node factory/board/recipe-board/shots.mjs [origin=http://localhost:3000] [--only <id,id>] [--quality 70]
// `npm run build` 뒤 `npm start` 서버에서 찍는다(끝나면 서버를 멈춘다). 레시피마다:
//   대표 장면(signature) × 선택지(A, B 있으면 B) × 폭 1440·375 × 테마(다크 기본은 다크 먼저) → .tmp/board/<id>-<A|B>-<장면>-<폭>-<테마>.webp
//   공통 견본(/qa/recipes?r=<id>, A만) × 1440·375 × 테마 → .tmp/board/<id>-specimen-<폭>-<테마>.webp
// 찍기 전에 기다리는 것(Geist 먼저 그려지는 문제 — 레시피 서체 클래스는 페이지 effect 뒤에 붙는다):
//   ① 대상 칸(article[data-recipe])이 생기고 ② 제목·본문의 계산된 첫 글꼴이 레시피 서체 변수에서 온 이름이며(Geist 아님)
//   ③ 그 이름의 FontFace 가 loaded — 그다음 등장 연출(모션 토큰 × 최대 2.5)이 끝나도록 기다린다.
// 자르기: 대상 칸의 상자(clip). 1440 은 배율 1, 375 는 배율 2(휴대폰 화면 선명도). 형식 webp.
// --only 는 목록에서 그 레시피 줄만 바꾼다. 결과 목록: .tmp/board/manifest.json { origin, generatedAt, count, bytes, shots:[{ file, recipe, option, kind, scene, width, theme, w, h, bytes, fonts }] }.
// 종료: 0 = 모두 찍음, 1 = 도구 실패(「도구 실패:」) 또는 서체 대기 실패가 있음.
import { writeFileSync, mkdirSync, statSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { startChrome, connect, navigateAndWait } from '../../qa/cdp.mjs'
import { shotJobs, sceneUrl, specimenUrl, OUT, loadHeads } from './jobs.mjs'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// 페이지 안에서: 대상 칸과 레시피 서체가 준비될 때까지(기한 안에서) 기다린다.
// stack(보드 v2 — Task 10f): 제목의 글꼴 스택 가운데 문서에 등록된 서체(FontFace, 「Fallback」 제외)를 모두 기다린다 — 라틴 제목 서체 뒤의
// 한글 제목 서체(displayKo)까지. 한글 서체가 한글 없는 제목에서도 받아지도록 표본 글자에 한글을 더한다.
export const WAIT_FONTS = (sel, { stack = false } = {}) => `(async () => {
  const deadline = Date.now() + 20000
  const unq = (f) => f.trim().replace(/^['"]|['"]$/g, '')
  const first = (el) => unq(getComputedStyle(el).fontFamily.split(',')[0])
  const registered = (f) => !/fallback/i.test(f) && [...document.fonts].some((ff) => ff.family.replace(/['"]/g, '') === f)
  const stackOf = (el) => getComputedStyle(el).fontFamily.split(',').map(unq).filter(registered)
  for (;;) {
    const box = document.querySelector(${JSON.stringify(sel)})
    const head = box && (box.querySelector('h1.font-heading, h2.font-heading, .font-heading') || box.querySelector('h1, h2'))
    if (box && head) {
      await document.fonts.ready
      const fams = ${stack ? '[...new Set([first(head), ...stackOf(head), first(box)])]' : '[first(head), first(box)]'}
      const text = (head.textContent || '').slice(0, 40) + (box.textContent || '').slice(0, 80)${stack ? " + ' 가나다한글'" : ''}
      await Promise.all(fams.map((f) => document.fonts.load('400 32px "' + f + '"', text).catch(() => null)))
      const loaded = (f) => [...document.fonts].some((ff) => ff.family.replace(/['"]/g, '') === f && ff.status === 'loaded')
      const geist = fams.some((f) => /geist/i.test(f))
      if (!geist && fams.every(loaded)) return { ok: true, fonts: fams }
      if (Date.now() > deadline) return { ok: false, fonts: fams, why: geist ? 'Geist 가 아직 첫 글꼴' : '서체 파일이 loaded 가 아님' }
    } else if (Date.now() > deadline) return { ok: false, fonts: [], why: '대상 칸 없음' }
    await new Promise((r) => setTimeout(r, 150))
  }
})()`

// 등장 연출이 끝나는 시간: --duration-enter × 2.5(선 그리기) + 글자 분할 지연.
export const SETTLE = (sel) => `(() => { const b = document.querySelector(${JSON.stringify(sel)}); const d = parseFloat(getComputedStyle(b).getPropertyValue('--duration-enter')) || 300; return Math.round(d * 2.5 + 700) })()`

export async function capture(jobs, { origin, out = OUT, quality = 70, log = console } = {}) {
  mkdirSync(out, { recursive: true })
  const chrome = await startChrome(['--hide-scrollbars', '--force-color-profile=srgb'], { prefix: 'board-' })
  const shots = []
  let failures = 0
  try {
    const { ws, send, ev } = await connect(chrome.wsUrl)
    await send('Page.enable'); await send('Runtime.enable')
    for (const j of jobs) {
      const mobile = j.width < 768
      await send('Emulation.setDeviceMetricsOverride', { width: j.width, height: mobile ? 812 : 900, deviceScaleFactor: mobile ? 2 : 1, mobile })
      await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: j.theme }] })
      const url = j.kind === 'scene' ? sceneUrl(origin, j.recipe, j.scene, j, j.theme) : specimenUrl(origin, j.recipe)
      const sel = j.kind === 'scene' ? `article[data-scene="${j.scene}"]` : `article[data-recipe="${j.recipe}"]`
      const nav = await navigateAndWait(send, ev, url, { timeoutMs: 30000 })
      if (nav?.result?.errorText) throw new Error(`탐색 실패 ${url}: ${nav.result.errorText}`)
      const f = await ev(WAIT_FONTS(sel))
      if (!f?.ok) { failures++; log.error(`서체 대기 실패: ${j.file} — ${f?.why ?? '평가 실패'} (${(f?.fonts ?? []).join(', ')})`); continue }
      await sleep((await ev(SETTLE(sel))) ?? 2000)
      const rect = await ev(`(() => { const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return { x: r.left + scrollX, y: r.top + scrollY, width: r.width, height: r.height } })()`)
      const shot = await send('Page.captureScreenshot', { format: 'webp', quality, captureBeyondViewport: true, clip: { ...rect, scale: 1 } })
      if (!shot.result?.data) throw new Error(`captureScreenshot 실패 ${j.file}: ${JSON.stringify(shot.error ?? shot)}`)
      writeFileSync(join(out, j.file), Buffer.from(shot.result.data, 'base64'))
      const bytes = statSync(join(out, j.file)).size
      shots.push({ file: j.file, recipe: j.recipe, option: j.option, kind: j.kind, scene: j.scene, width: j.width, theme: j.theme, w: Math.round(rect.width), h: Math.round(rect.height), bytes, fonts: f.fonts })
      log.log(`${j.file} ${Math.round(rect.width)}×${Math.round(rect.height)} ${(bytes / 1024).toFixed(0)}KB · ${f.fonts.join(' / ')}`)
    }
    ws.close()
  } finally {
    await chrome.close()
  }
  return { shots, failures }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const argv = process.argv.slice(2)
  const flag = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv.splice(i, 2)[1] : null }
  const only = flag('--only')?.split(',')
  const quality = Number(flag('--quality') ?? 70)
  const origin = (argv[0] ?? 'http://localhost:3000').replace(/\/$/, '')
  const heads = loadHeads().filter((h) => !only || only.includes(h.id))
  const jobOrder = shotJobs(loadHeads()).map((j) => j.file)
  let code = 0
  try {
    const jobs = shotJobs(heads)
    const { shots, failures } = await capture(jobs, { origin, quality })
    // --only: 기존 목록에서 그 레시피 줄만 바꾼다(다시 찍은 레시피만 갈아 끼운다).
    const mf = join(OUT, 'manifest.json')
    const kept = only && existsSync(mf) ? JSON.parse(readFileSync(mf, 'utf8')).shots.filter((s) => !only.includes(s.recipe)) : []
    const all = [...kept, ...shots].sort((a, b) => jobOrder.indexOf(a.file) - jobOrder.indexOf(b.file))
    const bytes = all.reduce((a, s) => a + s.bytes, 0)
    writeFileSync(mf, JSON.stringify({ origin, generatedAt: new Date().toISOString(), count: all.length, bytes, shots: all }, null, 2) + '\n')
    console.log(`shots: 이번 ${shots.length}/${jobs.length}장 · 목록 전체 ${all.length}장 · ${(bytes / 1048576).toFixed(1)}MB → ${OUT}`)
    if (failures || shots.length !== jobs.length) code = 1
  } catch (e) {
    console.error(`도구 실패: ${e.message}`)
    code = 1
  }
  process.exit(code)
}
