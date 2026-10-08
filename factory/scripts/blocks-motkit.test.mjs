// P3-5 MOTKIT 모션 그래픽 블록 6종 — 서버 렌더 마크업(첫 칠·읽기 도구·첫 장만 그림)과 동작 줄이기 갈래(정지 단추 숨김·첫 장·첫 이름표만 보임),
// 보드 미리보기 전용 표지(previewLabel). 브라우저 동작(등장·켄 번스·휩 팬)은 갤러리 관문(blocks:gates·ssr-flash·a11y)이 잰다.
// 실행: node --test --test-force-exit --test-timeout=120000 factory/scripts/blocks-motkit.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'
import { heroLcpProblems } from './hero-lcp.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = join(root, '.tmp', 'blocks-motkit-test')
const loaded = new Map()
function transpile(abs) {
  if (abs.endsWith('.mjs')) return abs
  if (loaded.has(abs)) return loaded.get(abs)
  const out = join(OUT, relative(root, abs).replace(/\.tsx?$/, '.mjs'))
  loaded.set(abs, out)
  let { outputText } = ts.transpileModule(readFileSync(abs, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } })
  outputText = outputText.replace(/(from\s+|import\s*\(\s*|import\s+)(["'])(@\/|\.\.?\/)([^"']+)\2/g, (_, kw, q, pre, p) => {
    const base = pre === '@/' ? join(root, p) : join(dirname(abs), pre, p)
    const src = [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts')].find((f) => existsSync(f) && /\.(mjs|tsx?)$/.test(f))
    if (!src) throw new Error(`import 대상 없음: ${pre}${p}`)
    return `${kw}${q}${pathToFileURL(transpile(src)).href}${q}`
  })
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, outputText)
  return out
}
const load = (rel) => import(pathToFileURL(transpile(join(root, rel))).href)
const React = await import('react')
const { renderToStaticMarkup } = await import('react-dom/server')
const h = React.createElement
const B = (rel) => join('registry', 'factory', 'blocks', rel)
const css = readFileSync(join(root, 'registry', 'factory', 'styles', 'base.css'), 'utf8')
const hook = (name) => css.match(new RegExp(`\\.${name} \\{\\s*@apply ([^;]*);`))?.[1] ?? ''

const img = (n) => ({ kind: 'image', src: `/media/motkit/reel-${n}-1440.webp`, srcSet: `/media/motkit/reel-${n}-1440.webp 1440w`, alt: '', width: 1440, height: 960 })
const video = { kind: 'video', mp4: '/media/motkit/kinetic-video.mp4', webm: '/media/motkit/kinetic-video.webm', poster: img(9), alt: '', decorative: true, loop: true, muted: true, width: 1920, height: 1080 }
async function render(rel, name, extra = {}, fx = 'fixture') {
  const mod = await load(B(`${rel}.tsx`))
  const f = await load(B(`${rel}.fixture.ts`))
  return renderToStaticMarkup(h(mod[name], { ...f[fx], ...extra }))
}

test('히어로 3종: 첫 칠에 제목·문단·버튼이 보인다(숨기는 data-enter 없음 — hero-lcp 0), h1 하나, 제목 사본은 keep + 읽기 도구는 sr-only 원문', async () => {
  for (const [rel, name] of [['hero/kinetic-type-video', 'HeroKineticTypeVideo'], ['hero/ken-burns-stills', 'HeroKenBurnsStills'], ['hero/punch-in-statement', 'HeroPunchInStatement']]) {
    const src = readFileSync(join(root, B(`${rel}.tsx`)), 'utf8')
    assert.deepEqual(heroLcpProblems(rel, src), [], rel)
    const html = await render(rel, name)
    assert.equal((html.match(/<h1[\s>]/g) ?? []).length, 1, `${rel} h1 하나`)
    assert.match(html, /<span class="sr-only">[^<]+<\/span><span aria-hidden="true" data-wf-split="" data-enter="keep"/, `${rel} 제목 사본 keep`)
    assert.doesNotMatch(html, /data-enter="(true)?"/, `${rel} 첫 화면에 숨기는 등장 대상이 없다`)
  }
})

test('kinetic-type-video: 영상 칸은 포스터가 첫 칠(우선 받기)·영상은 preload none, 정지 단추는 움직이는 것이 있을 때만(영상 또는 이름표 둘 이상)', async () => {
  const html = await render('hero/kinetic-type-video', 'HeroKineticTypeVideo', { media: video })
  assert.match(html, /<img[^>]*fetchPriority="high"|<img[^>]*fetchpriority="high"/i, '포스터 우선')
  assert.match(html, /<video[^>]*preload="none"/)
  assert.match(html, /data-wf-loop-pause=""[^>]*aria-pressed="false"[^>]*aria-label="배경 움직임 멈추기"/)
  // 사진만 받으면 한 장 켄 번스 칸(kb-img) + 정지 단추(5초 넘게 움직인다)
  const still = await render('hero/kinetic-type-video', 'HeroKineticTypeVideo', { media: img(0) }, 'fixtureMin')
  assert.match(still, /<div data-kb-slide="" class="[^"]*"><div class="[^"]*kb-img"><picture>/)
  assert.match(still, /data-wf-loop-pause=""/)
  // 영상 없음 + 이름표 하나(최소) → 움직일 것이 없어 단추를 그리지 않는다
  const min = await render('hero/kinetic-type-video', 'HeroKineticTypeVideo', {}, 'fixtureMin')
  assert.doesNotMatch(min, /data-wf-loop-pause/)
  assert.match(min, /kinetic-type-video-fallback/, '영상이 없으면 muted 무대')
})

test('로어 서드: 읽기 도구는 sr-only 목록으로 모두 한 번, 보이는 띠는 aria-hidden 사본 — 둘째 항목부터는 훅 CSS 가 숨긴다(동작 줄이기·정지 갈래에서 첫 이름표만)', async () => {
  const html = await render('hero/kinetic-type-video', 'HeroKineticTypeVideo', {}, 'fixtureMax')
  assert.match(html, /<ul aria-label="영상 속 장소" class="sr-only"><li>물때 작업장\(예시\) — 썰물 가마 · 예시<\/li>/)
  assert.equal((html.match(/data-lt-item=""/g) ?? []).length, 3)
  assert.match(html, /<div data-lt="" data-enter="keep"/, '히어로 첫 화면 이름표는 keep')
  assert.match(html, /<div aria-hidden="true" class="cn-block-lower-third-stack/)
  assert.match(hook('cn-block-lower-third-item'), /\[&:not\(:first-child\)\]:invisible/)
})

test('ken-burns-stills: 서버 HTML 에는 첫 장 그림만(우선 받기) — 둘째 장부터는 첫 칠 뒤에 붙는다, 칸은 장 수만큼, 둘째 칸부터 CSS 가 숨긴다', async () => {
  const html = await render('hero/ken-burns-stills', 'HeroKenBurnsStills', { stills: [0, 1, 2, 3].map(img) })
  assert.equal((html.match(/data-kb-slide=""/g) ?? []).length, 4)
  assert.equal((html.match(/<img /g) ?? []).length, 1, '첫 장 그림 하나')
  assert.match(html, /reel-0-1440\.webp/)
  assert.match(html, /fetchPriority="high"|fetchpriority="high"/i)
  assert.match(hook('cn-block-hero-ken-burns-stills-slide'), /\[&:not\(:first-child\)\]:invisible \[&:not\(:first-child\)\]:opacity-0/)
  assert.match(html, /data-wf-loop-pause=""/, '두 장 이상이면 정지 단추')
  const one = await render('hero/ken-burns-stills', 'HeroKenBurnsStills', { stills: [img(0)] })
  assert.doesNotMatch(one, /data-wf-loop-pause/, '한 장이면 단추 없음(장면이 돌지 않는 M1 과 같은 모양)')
})

test('동작 줄이기 갈래: 정지 단추는 motion-reduce 에서 숨고, 히어로 공용 뿌리 훅이 전환·애니메이션을 끈다 — 장면은 정지 갈래(build 없음)라 끝 상태 그대로', () => {
  assert.match(hook('cn-block-loop-pause'), /motion-reduce:hidden/)
  assert.match(hook('cn-block-loop-pause'), /size-11/, '44px')
  assert.match(hook('cn-block-hero-root'), /motion-reduce:\[&_\*\]:\[transition:none\]!/)
  assert.match(hook('cn-block-stagger-card'), /motion-reduce:transition-none/)
})

test('보드 미리보기 전용 표지: previewLabel 이 있으면 그림 위에 늘 보이는 띠(사진·영상 포스터 한 번만), 없으면 그림 모양 그대로', async () => {
  const { MediaImage, MediaVideo } = await load(B('_shared/hero-media.tsx'))
  const plain = renderToStaticMarkup(h(MediaImage, { m: img(0), sizes: '100vw' }))
  assert.doesNotMatch(plain, /data-wf-preview-only/)
  assert.match(plain, /^<picture>/)
  const marked = renderToStaticMarkup(h(MediaImage, { m: { ...img(0), previewLabel: '미리보기 전용 사진' }, sizes: '100vw' }))
  assert.match(marked, /<span data-wf-preview-only="" class="cn-block-media-preview-badge">미리보기 전용 사진<\/span>/)
  const v = renderToStaticMarkup(h(MediaVideo, { m: { ...video, poster: { ...video.poster, previewLabel: '미리보기 전용 사진' } }, sizes: '100vw' }))
  assert.equal((v.match(/data-wf-preview-only/g) ?? []).length, 1, '영상은 포스터 표지를 한 번만')
})

// <div> 짝을 맞춰 needle 이 든 여는 태그의 안쪽 마크업을 돌려준다(확대·이동하는 층 안에 표지가 있는지 본다).
function innerDiv(html, needle) {
  const at = html.indexOf(needle)
  assert.ok(at >= 0, `층 없음: ${needle}`)
  const open = html.lastIndexOf('<div', at)
  let depth = 0
  const re = /<div[\s>]|<\/div>/g
  re.lastIndex = open
  for (let m; (m = re.exec(html)); ) {
    depth += m[0] === '</div>' ? -1 : 1
    if (depth === 0) return html.slice(open, m.index + 6)
  }
  throw new Error('div 짝 없음')
}

test('미리보기 표지는 확대·이동하는 층 밖 — 영상·켄 번스·펀치 인 히어로 모두 표지가 층 안에 없고(잘림 고침) 한 번만, 공개 빌드(변수 없음)에는 표지·자산이 없다', async () => {
  const cases = [
    ['hero/kinetic-type-video', 'HeroKineticTypeVideo', 'kt-media-s', (label) => ({ media: { ...video, poster: { ...video.poster, previewLabel: label } } })],
    ['hero/kinetic-type-video', 'HeroKineticTypeVideo', 'kt-media-s', (label) => ({ media: { ...img(0), previewLabel: label } })],
    ['hero/ken-burns-stills', 'HeroKenBurnsStills', 'kb-stage-s', (label) => ({ stills: [{ ...img(0), previewLabel: label }, { ...img(1), previewLabel: label }] })],
    ['hero/punch-in-statement', 'HeroPunchInStatement', 'pi-frame-s', (label) => ({ media: { ...video, poster: { ...video.poster, previewLabel: label } } })],
    ['hero/punch-in-statement', 'HeroPunchInStatement', 'pi-frame-s', (label) => ({ media: { ...img(0), previewLabel: label } })],
  ]
  for (const [rel, name, layer, props] of cases) {
    const tag = `${rel} ${layer}`
    const html = await render(rel, name, props('미리보기 전용 사진'))
    assert.equal((html.match(/data-wf-preview-only/g) ?? []).length, 1, `${tag} 표지 한 번만`)
    assert.match(html, /<span data-wf-preview-only="" class="cn-block-media-preview-badge">미리보기 전용 사진<\/span>/, tag)
    assert.doesNotMatch(innerDiv(html, layer), /data-wf-preview-only|cn-block-media-preview/, `${tag} 확대 층 안에 표지가 없다`)
    const pub = await render(rel, name, props(undefined))
    assert.doesNotMatch(pub, /data-wf-preview-only|cn-block-media-preview/, `${tag} 공개 빌드(표지 값 없음)`)
  }
  // 공유 조각: badge={false} 면 값이 있어도 그림 모양 그대로(표지는 부모가 그린다), 표지 조각은 값이 없으면 아무것도 안 그린다.
  const { MediaImage, MediaPreviewBadge } = await load(B('_shared/hero-media.tsx'))
  const bare = renderToStaticMarkup(h(MediaImage, { m: { ...img(0), previewLabel: '미리보기 전용 사진' }, sizes: '100vw', badge: false }))
  assert.match(bare, /^<picture>/)
  assert.doesNotMatch(bare, /data-wf-preview-only/)
  assert.equal(renderToStaticMarkup(h(MediaPreviewBadge, { m: img(0) })), '')
  assert.equal(renderToStaticMarkup(h(MediaPreviewBadge, {})), '')
})

test('섹션 3종: 화면에 들어올 때 등장(playOnView) — 등장 대상은 data-enter(서버 첫 칠 가림), 제목 h2 하나, 휩 후기는 자동 회전 없이 단추로만', async () => {
  for (const [rel, name] of [['features/stagger-cards', 'FeaturesStaggerCards'], ['social-proof/whip-quotes', 'SocialProofWhipQuotes'], ['final-cta/kinetic-band', 'FinalCtaKineticBand']]) {
    const src = readFileSync(join(root, B(`${rel}.tsx`)), 'utf8')
    assert.match(src, /playOnView\(s\)/, rel)
    const html = await render(rel, name)
    assert.equal((html.match(/<h2[\s>]/g) ?? []).length, 1, `${rel} h2 하나`)
    assert.doesNotMatch(html, /<h1[\s>]/)
    assert.match(html, /data-enter="(true)?"/, `${rel} 등장 대상(빈 값 또는 true — 가림 CSS 는 keep 아닌 [data-enter])`)
  }
  const wq = await render('social-proof/whip-quotes', 'SocialProofWhipQuotes')
  assert.equal((wq.match(/data-wq="/g) ?? []).length, 1, '한 장만 그린다')
  assert.match(wq, /aria-live="polite"[^>]*>1번째 후기, 모두 3개</)
  assert.match(wq, /aria-current="true"/)
  assert.doesNotMatch(readFileSync(join(root, B('social-proof/whip-quotes.tsx')), 'utf8'), /setInterval|s\.loop\(/, '자동 회전 없음')
  const min = await render('social-proof/whip-quotes', 'SocialProofWhipQuotes', {}, 'fixtureMin')
  assert.doesNotMatch(min, /aria-live/, '한 장이면 넘김 단추 없음')
})
