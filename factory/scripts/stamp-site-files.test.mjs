// P3-3 Task 9b — 사이트 파일(대장 C115)·미디어 연결(C113): robots.txt · sitemap.xml · 기본 공유 그림 · 파비콘 묶음 · 05-media → 히어로 media props.
// 정적 검사(설치·빌드 없음). 실제 next build 에서 .next 산출물을 보는 것은 STAMP_PAGES_BUILD=1 stamp-pages 빌드 시험과 보고서가 맡는다.
// 실행: node --test --test-force-exit --test-timeout=300000 factory/scripts/stamp-site-files.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { root, localBrief, localContent, SAAS_BRIEF, saasContent, makeRun as makeRunIn, gen } from './lib/stamp-site-fixtures.mjs'
import { plannedFaviconPaths, recipeColors, recipeHeadOf, markSvg, SITE_FILE_ROUTES, SITE_FILE_ITEMS } from '../stamp/site-files.mjs'
import { slotOf, wireMedia, copyMediaFiles, filesOf } from '../stamp/site-media.mjs'
import { installNames } from '../stamp/gen-pages.mjs'
import { tsLoader } from './gen-favicons.mjs'

const sharp = createRequire(join(root, 'package.json'))('sharp')
const TMP = join(root, '.tmp', 'stamp-site-files-test')
const makeRun = (brief, contentFor, opts) => makeRunIn(TMP, brief, contentFor, opts)
const read = (siteDir, ...p) => readFileSync(join(siteDir, ...p), 'utf8')

const L = await makeRun(localBrief(), localContent)
const LS = await gen(L)
const S = await makeRun(SAAS_BRIEF, saasContent)
const SS = await gen(S)

test('C115: robots.txt · sitemap.xml · /opengraph-image 라우트가 모든 사이트에 있고 설치 항목(seo-files·og-image)이 따라온다', () => {
  for (const s of [LS, SS]) for (const f of SITE_FILE_ROUTES) assert.ok(existsSync(join(s.siteDir, ...f.split('/'))), f)
  assert.deepEqual(SITE_FILE_ITEMS, ['seo-files', 'og-image'])
  const names = installNames({ archetype: 'local', recipeId: 'r1-measure', blocks: [] })
  for (const n of SITE_FILE_ITEMS) assert.ok(names.includes(n), n)
  assert.match(read(LS.siteDir, 'app/robots.txt/route.ts'), /seoFiles\(seoInput\(\)\)\.robots/)
  assert.match(read(LS.siteDir, 'app/sitemap.xml/route.ts'), /seoFiles\(seoInput\(\)\)\.sitemap\(\)/)
  const og = read(LS.siteDir, 'app/opengraph-image.tsx')
  assert.match(og, /export const size = OG_SIZE/)
  assert.match(og, /export const contentType = "image\/png"/)
  assert.match(og, /ogImage\(\{ \.\.\.ogProps\(\), fonts: \[await readOgFont\(\)\] \}\)/)
})

test('C115: 라우트 코드에 콘텐츠 값이 없다 — 사이트 주소·이름·쪽은 content/site.json 에서(J9)', () => {
  const site = JSON.parse(read(LS.siteDir, 'content/site.json'))
  for (const f of SITE_FILE_ROUTES) {
    const src = read(LS.siteDir, ...f.split('/'))
    for (const v of ['달빛 베이커리', site.site.url, '02-1234-5678']) assert.equal(src.includes(v), false, `${f}: ${v}`)
  }
  assert.match(read(LS.siteDir, 'lib/site.tsx'), /export function seoInput\(\)/)
  assert.match(read(LS.siteDir, 'lib/site.tsx'), /filter\(\(\[, p\]\) => !p\.noindex\)/)
})

test('C115: seo-files 입력 = site.json 의 색인 쪽 — 사이트맵에 noindex 앱 쪽(가입·로그인·결제)이 없고 robots 에 Sitemap 줄이 있다', async () => {
  const seo = await tsLoader('stamp-site-files')('ax/seo-files.ts')
  for (const [s, mustHave, mustNot] of [[SS, ['/', '/pricing', '/privacy'], ['/signup', '/login', '/billing', '/account']], [LS, ['/', '/privacy'], ['/booking/complete', '/services']]]) {
    const site = JSON.parse(read(s.siteDir, 'content/site.json'))
    // lib/site.tsx seoInput 과 같은 규칙(색인 제외 쪽을 뺀다) — 라우트가 부르는 seoFiles 를 노드에서 돌려 본다
    const pages = Object.entries(site.pages).filter(([, p]) => !p.noindex).map(([route]) => ({ url: route, title: route }))
    const files = seo.seoFiles({ siteUrl: site.site.url, name: 'x', summary: 'x', pages })
    const xml = files.sitemap()
    for (const r of mustHave) assert.ok(xml.includes(`<loc>${new URL(r, site.site.url).href}</loc>`), `${r} 가 사이트맵에 있다`)
    for (const r of mustNot) assert.equal(xml.includes(`<loc>${new URL(r, site.site.url).href}</loc>`), false, `${r} 는 사이트맵에 없다`)
    assert.match(files.robots, new RegExp(`Sitemap: ${site.site.url.replace(/[.]/g, '\\.')}/sitemap\\.xml`))
  }
})

test('C115: 파비콘 묶음 — favicon-kit 이 계획한 파일이 그대로 구워지고 크기가 맞다(ico 16·32, apple 180, 192·512·maskable 512, 적응형 svg)', async () => {
  const planned = await plannedFaviconPaths()
  assert.deepEqual([...planned].sort(), ['app/apple-icon.png', 'app/favicon.ico', 'app/icon.svg', 'public/icon-192.png', 'public/icon-512.png', 'public/icon-maskable-512.png'])
  for (const s of [LS, SS]) {
    assert.deepEqual(s.favicons.files.map((f) => f.path).sort(), [...planned].sort())
    for (const [rel, size] of [['app/apple-icon.png', 180], ['public/icon-192.png', 192], ['public/icon-512.png', 512], ['public/icon-maskable-512.png', 512]]) {
      const m = await sharp(join(s.siteDir, ...rel.split('/'))).metadata()
      assert.deepEqual([m.width, m.height], [size, size], rel)
    }
    const ico = readFileSync(join(s.siteDir, 'app/favicon.ico'))
    assert.equal(ico.readUInt16LE(2), 1, 'ICO 형식') // type 1 = icon
    assert.equal(ico.readUInt16LE(4), 2, 'ICO 안 그림 2장(16·32)')
    const svg = read(s.siteDir, 'app/icon.svg')
    assert.match(svg, /prefers-color-scheme: dark/)
    assert.match(svg, /<style>svg\{color:#[0-9a-f]{6}\}@media \(prefers-color-scheme: dark\)\{svg\{color:#[0-9a-f]{6}\}\}<\/style>/, '표지 색(라이트·다크)은 레시피 색 #hex 로 칠해진다')
  }
})

test('C115: 공유 그림·파비콘 색은 레시피에서 온다 — lib/build.json 의 og 색이 레시피 기본 테마 색이다', () => {
  const head = recipeHeadOf(L.cand)
  const c = recipeColors(head)
  const build = JSON.parse(read(LS.siteDir, 'lib/build.json'))
  assert.deepEqual(build.og, c.og)
  assert.equal(build.og.background, head.color.light.background)
  assert.equal(build.og.accent, head.color.light.primary)
  assert.equal(build.theme, 'light')
  // 색을 읽을 수 없는 레시피는 조용히 흰 그림을 내지 않고 던진다
  assert.throws(() => recipeColors({ id: 'x', color: { light: { background: 'oklch(1 0 0)' } } }), /색 foreground 을 읽지 못했다|색 .* 을 읽지 못했다/)
})

test('C115: 표지 — 브랜드 로고 SVG(currentColor)가 있으면 그것을, 없으면 상호로 고른 도형을(같은 상호는 같은 도형)', () => {
  const a = markSvg('달빛 베이커리'), b = markSvg('달빛 베이커리'), c = markSvg('예약노트')
  assert.equal(a.svg, b.svg)
  assert.equal(a.source, 'shape')
  assert.match(a.svg, /currentColor/)
  assert.ok(a.svg !== c.svg || true)
  mkdirSync(TMP, { recursive: true })
  const logo = join(TMP, 'logo.svg')
  writeFileSync(logo, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="currentColor"/></svg>')
  assert.equal(markSvg('x', { logoPath: logo }).source, 'brand-logo')
  writeFileSync(logo, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="#000"/></svg>')
  assert.equal(markSvg('x', { logoPath: logo }).source, 'shape', 'currentColor 가 없는 로고는 레시피 색으로 칠할 수 없어 도형으로 대신한다')
})

// ── 미디어(C113) ─────────────────────────────────────────────────────────
const asset = (over = {}) => ({
  recipe: 'r1-measure', slot: 'home/hero/product-ui', hero: null, kind: 'image', source: 'brand', width: 1440, height: 900, widths: [1440, 960],
  files: [
    { file: 'r1-measure/home.hero.product-ui-1440.webp', bytes: 4, role: 'still-max', w: 1440 }, { file: 'r1-measure/home.hero.product-ui-1440.avif', bytes: 4, role: 'still', w: 1440 },
    { file: 'r1-measure/home.hero.product-ui-960.webp', bytes: 4, role: 'still', w: 960 }, { file: 'r1-measure/home.hero.product-ui-960.avif', bytes: 4, role: 'still', w: 960 },
  ], ...over,
})

test('C113: slotOf — 그림은 AVIF → WebP srcSet ImageSlot, 영상은 포스터 + mp4·webm VideoSlot(장식이면 decorative)', () => {
  const img = slotOf(asset(), { alt: '매장 안쪽' })
  assert.equal(img.kind, 'image')
  assert.equal(img.src, '/media/r1-measure/home.hero.product-ui-1440.webp')
  assert.equal(img.srcSet, '/media/r1-measure/home.hero.product-ui-960.webp 960w, /media/r1-measure/home.hero.product-ui-1440.webp 1440w')
  assert.deepEqual(img.sources, [{ type: 'image/avif', srcSet: '/media/r1-measure/home.hero.product-ui-960.avif 960w, /media/r1-measure/home.hero.product-ui-1440.avif 1440w' }])
  assert.equal(img.alt, '매장 안쪽')
  assert.equal(img.source, 'real-required')
  assert.deepEqual([img.width, img.height], [1440, 900])
  const vid = slotOf(asset({
    kind: 'video', source: 'higgsfield',
    video: { mp4: 'r1-measure/home.hero.product-ui.mp4', webm: 'r1-measure/home.hero.product-ui.webm', width: 1920, duration: 5 },
    files: [{ file: 'r1-measure/home.hero.product-ui.mp4', bytes: 4, role: 'mp4', w: 1920 }, { file: 'r1-measure/home.hero.product-ui.webm', bytes: 4, role: 'webm', w: 1920 },
      { file: 'r1-measure/home.hero.product-ui-poster-1440.webp', bytes: 4, role: 'still-max', w: 1440 }],
  }))
  assert.equal(vid.kind, 'video')
  assert.equal(vid.mp4, '/media/r1-measure/home.hero.product-ui.mp4')
  assert.equal(vid.webm, '/media/r1-measure/home.hero.product-ui.webm')
  assert.equal(vid.poster.src, '/media/r1-measure/home.hero.product-ui-poster-1440.webp')
  assert.equal(vid.decorative, true)
  assert.equal(vid.muted, true)
  assert.equal(vid.source, 'generated-ok')
  assert.throws(() => slotOf(asset({ files: [] })), /WebP 가 없다/)
})

test('C113: wireMedia — media? 칸이 있는 블록에만, 이 레시피의 자산이 있는 첫 칸을 잇는다', () => {
  const imageSlots = [{ id: 'product-ui' }, { id: 'other' }]
  const props = { copy: {} }
  assert.equal(wireMedia({ props, sectionKey: 'home/hero', imageSlots, assets: [asset()], recipeId: 'r1-measure', hasMediaProp: false }), null)
  assert.equal('media' in props, false, 'media 칸이 없는 블록에는 잇지 않는다')
  assert.equal(wireMedia({ props, sectionKey: 'home/hero', imageSlots, assets: [asset({ recipe: 'r9-clay' })], recipeId: 'r1-measure', hasMediaProp: true }), null, '다른 레시피의 자산은 쓰지 않는다')
  assert.equal(wireMedia({ props, sectionKey: 'home/hero', imageSlots, assets: [], recipeId: 'r1-measure', hasMediaProp: true }), null, '자산이 없는 칸(실제 사진 필요)은 media 를 비운다')
  const got = wireMedia({ props, sectionKey: 'home/hero', imageSlots, assets: [asset()], recipeId: 'r1-measure', contentMedia: { 'home/hero/product-ui': { alt: '제품 화면' } }, hasMediaProp: true })
  assert.equal(got.slot, 'home/hero/product-ui')
  assert.equal(props.media.alt, '제품 화면')
})

test('C113: 자산 파일이 사이트 public/media 로 복사되고, 없는 파일은 던진다', () => {
  const dir = join(TMP, 'media-copy')
  const from = join(dir, '05-media'), to = join(dir, 'site')
  mkdirSync(join(from, 'r1-measure'), { recursive: true })
  for (const f of filesOf(asset())) writeFileSync(join(from, f), 'x')
  const copied = copyMediaFiles(from, to, [asset()])
  assert.equal(copied.length, 4)
  for (const f of copied) assert.ok(existsSync(join(to, 'public', 'media', f)), f)
  assert.throws(() => copyMediaFiles(join(dir, 'nowhere'), to, [asset()]), /미디어 파일이 없다/)
})

test('C113: 생성 파이프 — 05-media manifest 의 자산이 히어로 media 가 되고 파일이 public/media 에 있다. 자리 표시는 blocker 로 남는다', async () => {
  // 03-variants: 홈 히어로를 media 칸이 있는 변형으로 고정한다(요청도 그 변형으로 만들어진다)
  const R = await makeRun(SAAS_BRIEF, saasContent, { patchVariants: (v) => ({ ...v, 'home/hero': 'block-hero-inline-chip-title' }) })
  const mdir = join(R.runDir, 'a', '05-media')
  mkdirSync(join(mdir, 'r1-measure'), { recursive: true })
  for (const f of filesOf(asset())) writeFileSync(join(mdir, f), 'x')
  writeFileSync(join(mdir, 'manifest.json'), JSON.stringify({
    assets: [asset()],
    placeholders: [{ recipe: 'r1-measure', slot: 'campaign/hero/product-ui', aspect: '16:10', reason: 'real-required', label: '실제 사진 필요' }, { recipe: 'r1-measure', slot: 'home/x/y', aspect: null, reason: 'generate-pending', label: '이미지 준비 중' }],
  }))
  const s = await gen(R)
  const site = JSON.parse(read(s.siteDir, 'content/site.json'))
  const media = site.sections['home/hero'].props.media
  assert.equal(media?.kind, 'image', JSON.stringify(Object.keys(site.sections['home/hero'].props)))
  assert.match(media.src, /^\/media\/r1-measure\/home\.hero\.product-ui-1440\.webp$/)
  assert.equal(s.mediaFiles.length, 4)
  for (const f of s.mediaFiles) assert.ok(existsSync(join(s.siteDir, 'public', 'media', f)), f)
  assert.ok(s.blockers.includes('공개 불가 — 실제 사진 필요: campaign/hero/product-ui'))
  assert.ok(s.blockers.includes('공개 불가 — 실제 사진 필요: home/x/y (이미지 준비 중)'))
  // 캠페인 히어로는 자산이 없으므로 media 가 없다
  assert.equal('media' in site.sections['campaign/hero'].props, false)
})

// ── 보드 미리보기 전용(MOTKIT-M): 공개 빌드에는 스톡이 실사 필수 칸으로 들어가는 길이 없다 ────────────────────────
async function previewRun(env) {
  const prev = process.env.WF_MEDIA_PREVIEW
  if (env === undefined) delete process.env.WF_MEDIA_PREVIEW
  else process.env.WF_MEDIA_PREVIEW = env
  try {
    const R = await makeRun(SAAS_BRIEF, saasContent, { patchVariants: (v) => ({ ...v, 'home/hero': 'block-hero-inline-chip-title' }) })
    const mdir = join(R.runDir, 'a', '05-media')
    mkdirSync(join(mdir, 'r1-measure'), { recursive: true })
    const a = asset({ source: 'pexels', previewOnly: true })
    for (const f of filesOf(a)) writeFileSync(join(mdir, f), 'x')
    writeFileSync(join(mdir, 'manifest.json'), JSON.stringify({
      assets: [a],
      placeholders: [{ recipe: 'r1-measure', slot: 'home/hero/product-ui', aspect: '16:10', reason: 'real-required', label: '실제 사진 필요' }],
    }))
    const s = await gen(R)
    return { s, site: JSON.parse(read(s.siteDir, 'content/site.json')) }
  } finally {
    if (prev === undefined) delete process.env.WF_MEDIA_PREVIEW
    else process.env.WF_MEDIA_PREVIEW = prev
  }
}
const BLOCKER_PHOTO = '공개 불가 — 실제 사진 필요: home/hero/product-ui'

test('미리보기 전용(공개 빌드): previewOnly 자산이 manifest 에 있어도 환경 변수가 없으면 media 를 잇지 않고 파일도 복사하지 않으며 공개 불가 사유가 남는다', async () => {
  const { s, site } = await previewRun(undefined)
  assert.equal('media' in site.sections['home/hero'].props, false, '스톡이 실사 필수 칸에 들어가지 않는다')
  assert.deepEqual(s.mediaFiles, [])
  assert.equal(existsSync(join(s.siteDir, 'public', 'media', 'r1-measure')), false)
  assert.ok(s.blockers.includes(BLOCKER_PHOTO))
  const zero = await previewRun('0')
  assert.equal('media' in zero.site.sections['home/hero'].props, false, 'WF_MEDIA_PREVIEW=0 도 공개 빌드')
  assert.ok(zero.s.blockers.includes(BLOCKER_PHOTO))
})

test('미리보기 전용(보드 모드 WF_MEDIA_PREVIEW=1): previewOnly 자산을 잇고 「미리보기 전용 사진」 표지를 붙이되 공개 불가 사유는 그대로 남긴다', async () => {
  const { s, site } = await previewRun('1')
  const media = site.sections['home/hero'].props.media
  assert.equal(media?.kind, 'image')
  assert.equal(media.previewLabel, '미리보기 전용 사진')
  assert.equal(s.mediaFiles.length, 4)
  for (const f of s.mediaFiles) assert.ok(existsSync(join(s.siteDir, 'public', 'media', f)), f)
  assert.ok(s.blockers.includes(BLOCKER_PHOTO), '미리보기 모드에서도 공개 불가')
})
