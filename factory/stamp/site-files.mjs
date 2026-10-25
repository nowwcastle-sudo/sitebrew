// 06-pages 의 사이트 파일(P3-3 Task 9b, 대장 C115) — 검색·공유·아이콘: robots.txt · sitemap.xml · 기본 공유 그림(/opengraph-image) · 파비콘 묶음.
//   robots·sitemap·공유 그림 라우트는 템플릿에 한 벌로 있고(site-template/app/…) 값은 content/site.json 과 lib/build.json 에서 읽는다(J9 — 코드에 콘텐츠 없음).
//   이 파일은 후보마다 달라지는 것만 만든다: 레시피 색(공유 그림·파비콘)과 파비콘 래스터(gen-favicons — favicon-kit 계획대로 sharp 로 굽는다).
//   표지(mark): 브랜드 로고 SVG(currentColor 로 칠할 곳을 적은 것)가 있으면 그것, 없으면 상호로 고른 도형 표지(글자를 쓰지 않는다 — 래스터 도구가 한글 서체를 못 찾는다).
import { existsSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { isAbsolute, join, resolve } from 'node:path'
import { loadLibrary } from '../scripts/style-presets.mjs'
import { genFavicons, tsLoader } from '../scripts/gen-favicons.mjs'

/** 후보의 레시피 머리(라이브러리 id → 머리, 생성·브랜드 후보는 머리 객체 그대로). */
export function recipeHeadOf(cand) {
  if (cand.recipe && typeof cand.recipe === 'object') return cand.recipe
  const head = loadLibrary().find((r) => r.id === cand.recipe)
  if (!head) throw new Error(`레시피 머리를 찾지 못했다: ${cand.recipe}`)
  return head
}

/** 기본 테마 쪽 색(공유 그림·파비콘) — 레시피 color.<테마>. 쓸 수 없으면 던진다(조용히 흰 그림을 내지 않는다). */
export function recipeColors(head) {
  const theme = head.defaultTheme === 'dark' ? 'dark' : 'light'
  const pick = (t) => head.color?.[t]
  const cur = pick(theme)
  const light = pick('light')
  const dark = pick('dark') ?? light
  for (const [name, v] of [['background', cur?.background], ['foreground', cur?.foreground], ['primary', cur?.primary], ['light.primary', light?.primary], ['dark.primary', dark?.primary]]) {
    if (typeof v !== 'string' || !v.trim()) throw new Error(`레시피 ${head.id} 의 색 ${name} 을 읽지 못했다 — 공유 그림·파비콘을 칠할 수 없다`)
  }
  return { theme, og: { background: cur.background, foreground: cur.foreground, accent: cur.primary }, icon: { color: light.primary, darkColor: dark.primary, background: light.background } }
}

// 도형 표지 셋(viewBox 64, 한 색 — currentColor, evenodd 구멍).
const MARKS = [
  'M14 6h36a8 8 0 0 1 8 8v36a8 8 0 0 1-8 8H14a8 8 0 0 1-8-8V14a8 8 0 0 1 8-8zM32 20a12 12 0 1 0 0 24 12 12 0 0 0 0-24z',
  'M32 4a28 28 0 1 0 0 56 28 28 0 0 0 0-56zM32 18l14 14-14 14-14-14z',
  'M14 6h36a8 8 0 0 1 8 8v36a8 8 0 0 1-8 8H14a8 8 0 0 1-8-8V14a8 8 0 0 1 8-8zM20 28h24v8H20z',
]
const wrap = (d) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path fill="currentColor" fill-rule="evenodd" d="${d}"/></svg>`

/** 표지 SVG 문자열. logoPath(브랜드 입력의 SVG — currentColor 가 있어야 레시피 색으로 칠한다)가 쓸 만하면 그것. */
export function markSvg(brandName, { logoPath, baseDir } = {}) {
  if (logoPath) {
    const file = isAbsolute(logoPath) ? logoPath : resolve(baseDir ?? process.cwd(), logoPath)
    if (/\.svg$/i.test(file) && existsSync(file)) {
      const svg = readFileSync(file, 'utf8')
      if (/currentColor/i.test(svg) && /viewBox/i.test(svg)) return { svg, source: 'brand-logo' }
    }
  }
  const h = createHash('sha256').update(String(brandName ?? '')).digest()
  return { svg: wrap(MARKS[h[0] % MARKS.length]), source: 'shape' }
}

/** 파비콘 묶음을 siteDir 에 굽는다(favicon-kit 목록 그대로: app/icon.svg·app/favicon.ico·app/apple-icon.png·public/icon-192·512·maskable-512.png). */
export async function writeFavicons(siteDir, head, brandName, opts = {}) {
  const { icon } = recipeColors(head)
  const mark = markSvg(brandName, opts)
  const written = await genFavicons({ svg: mark.svg, ...icon, out: siteDir })
  return { markSource: mark.source, svg: mark.svg, files: written }
}

/** favicon-kit 이 계획하는 파일 경로(시험이 비교한다). */
export async function plannedFaviconPaths() {
  const kit = await tsLoader('stamp-site-files')('ax/favicon-kit.ts')
  return kit.faviconSet(wrap(MARKS[0]), { color: '#000000', darkColor: '#ffffff' }).map((f) => f.path)
}

export const SITE_FILE_ROUTES = ['app/robots.txt/route.ts', 'app/sitemap.xml/route.ts', 'app/opengraph-image.tsx', 'app/manifest.ts', 'app/not-found.tsx', 'app/error.tsx', 'app/global-error.tsx']
/** 설치해야 하는 항목(라우트가 부르는 것). */
export const SITE_FILE_ITEMS = ['seo-files', 'og-image']
export const siteFilePath = (siteDir, rel) => join(siteDir, ...rel.split('/'))
