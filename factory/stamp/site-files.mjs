// 06-pages 의 사이트 파일(P3-3 Task 9b, 대장 C115) — 검색·공유·아이콘: robots.txt · sitemap.xml · 기본 공유 그림(/opengraph-image) · 파비콘 묶음.
//   robots·sitemap·공유 그림 라우트는 템플릿에 한 벌로 있고(site-template/app/…) 값은 content/site.json 과 lib/build.json 에서 읽는다(J9 — 코드에 콘텐츠 없음).
//   이 파일은 후보마다 달라지는 것만 만든다: 레시피 색(공유 그림·파비콘)과 파비콘 래스터(gen-favicons — favicon-kit 계획대로 sharp 로 굽는다).
//   표지(mark): 브랜드 로고 SVG(currentColor 로 칠할 곳을 적은 것)가 있으면 그것, 없으면 상호로 고른 도형 표지(글자를 쓰지 않는다 — 래스터 도구가 한글 서체를 못 찾는다).
import { createHash } from 'node:crypto'
import { extname, isAbsolute, join, resolve } from 'node:path'
import sharp from 'sharp'
import { isNetworkOrDevicePath, readLocalInputFile } from '../lib/safe-path.mjs'
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

const LOGO_MAX_BYTES = 2 * 1024 * 1024

/** 표지 SVG 문자열. logoPath(브랜드 입력의 SVG — currentColor 가 있어야 레시피 색으로 칠한다)가 쓸 만하면 그것. */
export function markSvg(brandName, { logoPath, baseDir } = {}) {
  // 네트워크(UNC)·장치 경로는 파일 시스템을 건드리기 전에 거른다 — Windows 는 열기만 해도 외부 호스트에 SMB 접속을 시도한다. 링크·일반 파일 아님도 도형 표지로 대체한다(빌드는 계속).
  if (logoPath && !isNetworkOrDevicePath(logoPath)) {
    const file = isAbsolute(logoPath) ? logoPath : resolve(baseDir ?? process.cwd(), logoPath)
    if (!isNetworkOrDevicePath(file) && /\.svg$/i.test(file)) {
      let svg = null
      try { svg = readLocalInputFile(file, { maxBytes: LOGO_MAX_BYTES }).toString('utf8') } catch { /* 링크·큰 파일·일반 파일 아님 → 도형 표지 */ }
      if (svg && /currentColor/i.test(svg) && /viewBox/i.test(svg)) return { svg, source: 'brand-logo' }
    }
  }
  const h = createHash('sha256').update(String(brandName ?? '')).digest()
  return { svg: wrap(MARKS[h[0] % MARKS.length]), source: 'shape' }
}

// 머리글 로고(v0.2.6 T17, D10) — 브리프 로고 파일이 머리글에 쓸 만한지 판정한다. 파비콘·공유 그림의 markSvg 와 따로다(markSvg 는 그대로).
export const HEADER_LOGO = { maxBytes: 1024 * 1024, maxRatio: 6, formats: ['.svg', '.png', '.jpg', '.jpeg', '.webp'] }
const fileOf = (logoPath, baseDir) => (isAbsolute(logoPath) ? logoPath : resolve(baseDir ?? process.cwd(), logoPath))
/** 쓸 수 없는 이유를 한 줄로 돌려준다: { ok:false, reason }. 쓸 수 있으면 { ok:true, file, ext, width, height, mode:'mask'|'img' }. */
// 읽기 실패를 사용자가 고칠 수 있는 한 줄로(보안 수정 C — 링크·일반 파일 아님·네트워크 경로는 읽지 않는다).
const logoReadReason = (e) => {
  if (e?.code === 'ENOENT' || e?.code === 'ENOTDIR') return '파일을 찾지 못했어요'
  if (e?.reason === 'tooLarge') return '파일이 1MB 를 넘어요'
  if (e?.reason === 'link') return '바로가기(링크) 파일은 쓸 수 없어요 — 실제 파일을 골라 주세요'
  if (e?.reason === 'networkPath') return NETWORK_LOGO_REASON
  return '일반 그림 파일이 아니에요'
}
const NETWORK_LOGO_REASON = '네트워크·장치 경로의 파일은 쓸 수 없어요 — 이 컴퓨터 안의 파일을 골라 주세요'
async function probeLogoFile(file) {
  // 글자만 보는 검사를 파일 시스템 호출보다 먼저 한다 — Windows 는 UNC 경로를 열기만 해도 외부 호스트에 SMB 접속(NTLM 인증)을 시도한다(보안 수정 C, SB-9).
  if (isNetworkOrDevicePath(file) || isNetworkOrDevicePath(resolve(file))) return { ok: false, reason: NETWORK_LOGO_REASON }
  const ext = extname(file).toLowerCase()
  if (!HEADER_LOGO.formats.includes(ext)) return { ok: false, reason: `형식이 맞지 않아요(${ext || '확장자 없음'} — svg·png·jpg·webp 만 써요)` }
  // 한 번에 검사하고 읽는다(링크·일반 파일 아님·크기 상한·검사와 열기 사이 교체). 그림 해석도 읽은 바이트로 한다 — 경로를 두 번 열지 않는다.
  let bytes
  try { bytes = readLocalInputFile(file, { maxBytes: HEADER_LOGO.maxBytes }) } catch (e) { return { ok: false, reason: logoReadReason(e) } }
  let width, height, mode
  if (ext === '.svg') {
    const svg = bytes.toString('utf8')
    const vb = /viewBox\s*=\s*["']\s*([-\d.eE]+)[\s,]+([-\d.eE]+)[\s,]+([-\d.eE]+)[\s,]+([-\d.eE]+)\s*["']/i.exec(svg)
    if (!vb) return { ok: false, reason: 'SVG 에 viewBox 가 없어요' }
    width = Number(vb[3]); height = Number(vb[4])
    mode = /currentColor/i.test(svg) ? 'mask' : 'img'
  } else {
    try { ({ width, height } = await sharp(bytes).metadata()) } catch { return { ok: false, reason: '그림 파일을 읽지 못했어요' } }
    mode = 'img'
  }
  if (!(width > 0) || !(height > 0)) return { ok: false, reason: '그림 크기를 읽지 못했어요' }
  if (width / height > HEADER_LOGO.maxRatio) return { ok: false, reason: `가로가 세로의 ${HEADER_LOGO.maxRatio}배를 넘어요` }
  return { ok: true, file, ext, width: Math.round(width), height: Math.round(height), mode }
}

/** 머리글 로고 판정. 짝 파일 `<이름>.dark.<확장자>` 는 img 모드에서만 받는다(같은 검사를 통과해야). 값 모양: { ok, file, ext, width, height, mode, darkFile? } | { ok:false, reason }. */
export async function headerLogoOf(logoPath, { baseDir } = {}) {
  if (!logoPath) return { ok: false, reason: '로고 파일이 없어요' }
  if (isNetworkOrDevicePath(logoPath)) return { ok: false, reason: NETWORK_LOGO_REASON } // 상대 경로로 풀기 전에 원문부터 거른다
  const base = await probeLogoFile(fileOf(logoPath, baseDir))
  if (!base.ok) return base
  if (base.mode !== 'img') return base
  const dark = base.file.slice(0, -base.ext.length) + '.dark' + base.ext
  const pair = await probeLogoFile(dark) // 짝 파일이 없거나 링크이면 쓸 수 없는 것 — 짝 없이 base 만 쓴다
  return pair.ok && pair.mode === 'img' ? { ...base, darkFile: dark } : base
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
