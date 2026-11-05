// 로고 시안 생성(v0.2.6 T14 · S2·S13) — 브리프 확인 턴에서 운영자가 고를 시안 6개를 투명 PNG 로 만든다.
//   글자형 2(서체 2종) + 기호+글자 4(기하 3 + Codex 1, Codex 가 꺼졌거나 실패하면 기하 4). 시트 `sheet.png`·`sheet.html` 에 시안마다 1배·2배를 함께 보인다.
//   글자는 Chrome(factory/qa/cdp.mjs)으로 래스터한다. 서체는 node_modules/pretendard OTF 를 base64 data URL 로 HTML 에 넣는다 — 네트워크 0.
//   환경 변수 WF_LOGO_FONT_DIR 가 있으면 그 폴더의 .otf/.woff2 중 브랜드 서체 이름에 맞는 것(이름이 없으면 앞의 둘)을 글자형 시안으로 더한다.
//   Chrome 을 찾지 못하면 던지지 않고 { skipped: 'no-chrome', items: [] } 를 돌려준다. 이 모듈은 파이프라인 06 열쇠 닫힘 밖이다.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { extname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromePath, connect, navigateAndWait, startChrome } from '../qa/cdp.mjs'
import { extraFontFiles, FONT_FORMAT, fontDataUrl, PRETENDARD, whiteToAlpha } from './logo-assets.mjs'
import { logoPageHtml, logoSpecs, paletteOf, sheetHtml, softnessOf } from './logo-markup.mjs'

const rootSandboxFlag = () => (process.getuid?.() === 0 ? ['--no-sandbox'] : []) // 컨테이너의 root 는 Chrome 샌드박스를 못 쓴다

/** Codex 기호 한 장 → 투명 PNG data URL. 실패하면 null(호출한 쪽이 기하 기호로 채운다) + 까닭. */
async function codexMark({ name, mood, palette }, deps) {
  try {
    const codexImage = deps.codexImage ?? (await import('../stamp/object-media.mjs')).codexImage
    const workDir = mkdtempSync(join(tmpdir(), 'logo-codex-'))
    try {
      const prompt = `An original, simple logo symbol (icon only: no text, no letters, no words) for a brand named "${name}". Mood: ${mood || 'neutral'}. Flat clean vector style, one or two colors (${palette.ink}, ${palette.accent}), centered on a plain pure white background. Do not imitate any existing brand.`
      const { file } = await codexImage({ prompt, workDir })
      return { url: `data:image/png;base64,${(await whiteToAlpha(readFileSync(file))).toString('base64')}` }
    } finally { rmSync(workDir, { recursive: true, force: true }) }
  } catch (e) {
    return { error: String(e?.message ?? e).split(/\r?\n/)[0] }
  }
}

/**
 * @param {{ name: string, mood?: string, colors?: string[], fonts?: string[], outDir: string, codex?: boolean, headerHeight?: number }} input
 * @param {{ codexImage?: Function, chromePath?: Function }} [deps] 시험이 바꿔 끼우는 자리
 * @returns {Promise<{ sheet: string|null, items: { id: number, path: string, width: number, height: number, kind: 'wordmark'|'mark+wordmark', symbol: 'geometric'|'codex' }[], skipped?: 'no-chrome', warnings?: string[] }>}
 */
export async function makeLogoCandidates({ name, mood = '', colors = [], fonts = [], outDir, codex = false, headerHeight = 40 }, deps = {}) {
  if (!String(name ?? '').trim()) throw new Error('로고 시안에는 이름(name)이 필요해요')
  if (!outDir) throw new Error('outDir 가 필요해요')
  try { (deps.chromePath ?? chromePath)() } catch { return { sheet: null, items: [], skipped: 'no-chrome' } }

  const palette = paletteOf(colors)
  const softness = softnessOf(mood)
  const extras = extraFontFiles(process.env.WF_LOGO_FONT_DIR, fonts)
  const faces = [
    { family: 'LogoBold', url: fontDataUrl(PRETENDARD('ExtraBold')), format: 'opentype', weight: 800 },
    { family: 'LogoLight', url: fontDataUrl(PRETENDARD('Light')), format: 'opentype', weight: 300 },
    ...extras.map((file, i) => ({ family: `LogoExtra${i + 1}`, url: fontDataUrl(file), format: FONT_FORMAT[extname(file).toLowerCase()][1] })),
  ]
  const warnings = []
  let specs = logoSpecs({ codex, extraFonts: extras.map((_, i) => `LogoExtra${i + 1}`) })
  let codexUrl = null
  if (specs.some((s) => s.mark === 'codex')) {
    const made = await codexMark({ name, mood, palette }, deps)
    if (made.url) codexUrl = made.url
    else {
      warnings.push(`Codex 기호를 만들지 못해 기하 기호로 채웠어요: ${made.error}`)
      specs = specs.map((s) => (s.mark === 'codex' ? { ...s, symbol: 'geometric', face: 'light', mark: 'bars' } : s))
    }
  }

  mkdirSync(outDir, { recursive: true })
  const work = mkdtempSync(join(tmpdir(), 'logo-page-'))
  const chrome = await startChrome(['--hide-scrollbars', '--force-color-profile=srgb', ...rootSandboxFlag()], { prefix: 'logo-' })
  try {
    const { ws, send, ev } = await connect(chrome.wsUrl)
    await send('Page.enable')
    await send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } })
    await send('Emulation.setDeviceMetricsOverride', { width: 2400, height: specs.length * (headerHeight + 24) + 24, deviceScaleFactor: 2, mobile: false })
    const page = join(work, 'logos.html')
    writeFileSync(page, logoPageHtml({ specs, fonts: faces, name, palette, softness, headerHeight, codexUrl }))
    await navigateAndWait(send, ev, pathToFileURL(page).href)
    await ev(`Promise.all(${JSON.stringify(faces.map((f) => `${f.weight ?? 400} 20px '${f.family}'`))}.map((f) => document.fonts.load(f))).then(() => document.fonts.ready).then(() => true)`)
    const rects = JSON.parse(await ev(`JSON.stringify([...document.querySelectorAll('.logo')].map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height } }))`))
    if (rects.length !== specs.length) throw new Error(`도구 실패: 로고 시안 ${specs.length}개 중 ${rects.length}개만 그려졌다`)

    const items = []
    for (const [i, spec] of specs.entries()) {
      const r = rects[i]
      const shot = await send('Page.captureScreenshot', { format: 'png', clip: { x: r.x, y: r.y, width: Math.ceil(r.w), height: Math.ceil(r.h), scale: 1 } })
      if (!shot.result?.data) throw new Error(`도구 실패: 시안 ${spec.id} 캡처 실패 ${JSON.stringify(shot.error ?? shot)}`)
      const path = join(outDir, `${spec.id}.png`)
      writeFileSync(path, Buffer.from(shot.result.data, 'base64'))
      items.push({ id: spec.id, path, width: Math.ceil(r.w) * 2, height: Math.ceil(r.h) * 2, kind: spec.kind, symbol: spec.symbol })
    }

    // 시트: 1배(머리글 실제 크기)와 2배를 같은 줄에. 흰 바탕이라 투명 해제.
    writeFileSync(join(outDir, 'sheet.html'), sheetHtml({ items, name, headerHeight }))
    await send('Emulation.setDefaultBackgroundColorOverride')
    await send('Emulation.setDeviceMetricsOverride', { width: 900, height: 600, deviceScaleFactor: 1, mobile: false })
    await navigateAndWait(send, ev, pathToFileURL(join(outDir, 'sheet.html')).href)
    const size = await ev(`({ w: Math.ceil(document.documentElement.scrollWidth), h: Math.ceil(document.documentElement.scrollHeight) })`)
    await send('Emulation.setDeviceMetricsOverride', { width: size.w, height: size.h, deviceScaleFactor: 1, mobile: false })
    const sheetShot = await send('Page.captureScreenshot', { format: 'png' })
    if (!sheetShot.result?.data) throw new Error(`도구 실패: 시트 캡처 실패 ${JSON.stringify(sheetShot.error ?? sheetShot)}`)
    const sheet = join(outDir, 'sheet.png')
    writeFileSync(sheet, Buffer.from(sheetShot.result.data, 'base64'))
    ws.close()
    return { sheet, items, ...(warnings.length ? { warnings } : {}) }
  } finally {
    await chrome.close()
    rmSync(work, { recursive: true, force: true })
  }
}
