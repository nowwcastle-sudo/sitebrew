// factory v1 Task 5.7 — 히어로 6변형(3D·그림 장면·지도·캐릭터·몽타주·제품 화면 창) + 소리 단추 조각.
// 원천 규칙(메타·첫 칠·동작 줄이기·3D 동적 import·소리 기본 꺼짐)과 서버 렌더 마크업을 본다. 브라우저 동작(3D 올림·끌기·몽타주 컷)은 갤러리 관문(blocks:gates)이 잰다.
// 실행: node --test --test-force-exit --test-timeout=120000 factory/scripts/hero-new.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'
import { BlockMeta, FV1_HEROES } from './blocks.mjs'
import { heroLcpProblems } from './hero-lcp.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = join(root, '.tmp', 'hero-new-test')
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
const readJson = (rel) => JSON.parse(readFileSync(join(root, rel), 'utf8'))
const read = (rel) => readFileSync(join(root, rel), 'utf8')
const css = read('registry/factory/styles/base.css')
const hook = (name) => css.match(new RegExp(`\\.${name} \\{\\s*@apply ([^;]*);`))?.[1] ?? ''

// 변형 → 기대 메타(계획 Task 5.7 · Global Constraints). boldMode layout 인 hero 는 titleWidth full(메타 검사 규칙).
const EXPECT = {
  'object-3d-orbit': { name: 'HeroObject3dOrbit', bold: 'motion', titleWidth: 'full', archetypes: ['landing', 'portfolio', 'saas', 'commerce', 'detail'], media: ['scene3d', 'image'] },
  'illustration-scene': { name: 'HeroIllustrationScene', bold: 'layout', titleWidth: 'full', archetypes: ['public', 'portfolio', 'landing', 'saas', 'pwa'] },
  'map-first': { name: 'HeroMapFirst', bold: 'layout', titleWidth: 'full', archetypes: ['public', 'dashboard', 'local'] },
  'mascot-greeting': { name: 'HeroMascotGreeting', bold: 'motion', titleWidth: 'column', archetypes: ['landing', 'commerce', 'local', 'saas', 'pwa'] },
  'video-montage': { name: 'HeroVideoMontage', bold: 'motion', titleWidth: 'full', archetypes: ['brand', 'portfolio', 'landing', 'local', 'saas'] },
  'screenshot-window': { name: 'HeroScreenshotWindow', bold: 'layout', titleWidth: 'full', archetypes: ['saas', 'dashboard', 'landing'] },
}
const NEW = Object.keys(EXPECT)

test('FV1_HEROES 표가 6변형과 같다', () => {
  assert.deepEqual([...FV1_HEROES].sort(), [...NEW].sort())
})

for (const v of NEW) {
  test(`hero/${v}: 메타·예시·원천 규칙`, () => {
    const meta = BlockMeta.parse(readJson(B(`hero/${v}.block.json`)))
    const src = read(B(`hero/${v}.tsx`))
    const e = EXPECT[v]
    assert.equal(meta.kind, 'hero')
    assert.equal(meta.layout, v)
    assert.equal(meta.boldness, 'bold', '대담안 표시')
    assert.equal(meta.boldMode, e.bold)
    assert.equal(meta.titleWidth, e.titleWidth)
    assert.deepEqual([...meta.archetypes].sort(), [...e.archetypes].sort())
    if (e.media) assert.deepEqual(meta.media, e.media)
    assert.deepEqual(heroLcpProblems(`hero/${v}`, src), [], '히어로 글·그림은 data-enter="keep"')
    assert.match(src, /useReducedMotion|prefers-reduced-motion|reducedMotion/)
    assert.match(src, new RegExp(`export function ${e.name}\\b`))
    assert.ok(existsSync(join(root, B(`hero/${v}.fixture.ts`))))
  })
}

test('3D·Lottie 는 정적 import 하지 않는다', () => {
  const src = read(B('hero/object-3d-orbit.tsx'))
  assert.doesNotMatch(src, /^import .* from ['"]three['"]/m)
  assert.match(src, /import\(['"]three['"]\)/)
  assert.doesNotMatch(src, /^import .* from ['"]@lottiefiles/m)
  // three 는 장면 안(등장이 끝난 뒤)에서만 불린다 — 동작 줄이기·M0 정지 갈래는 장면이 build 를 부르지 않아 three 를 내려받지 않는다.
  assert.match(src, /afterEnter\(/)
})

test('three: package.json 정확한 판 고정 + 라이선스 표 한 줄 + 좁은 모듈 선언', () => {
  const pkg = readJson('package.json')
  assert.match(pkg.dependencies.three, /^\d+\.\d+\.\d+$/, '^ 없이 정확히 고정')
  const lock = readJson('package-lock.json')
  assert.equal(lock.packages['node_modules/three']?.version, pkg.dependencies.three)
  assert.match(read('docs/qa/motion-licenses.md'), /three\.js \(`three`\) \| 0\.\d+\.\d+/)
  assert.match(read('types/three.d.ts'), /declare module "three"/)
})

test('object-3d-orbit: 포인터 기울임은 고운 포인터 겹(s.pointer) 안에서만 — 터치는 끌기·기울임 없이 세로 스크롤을 통과시킨다', () => {
  const src = read(B('hero/object-3d-orbit.tsx'))
  // 블록이 포인터 이벤트를 다는 곳은 s.pointer(...) 콜백 안뿐이다(고운 포인터일 때만 도는 겹). 그 겹을 지우면 남는 곳에 포인터 이벤트가 없어야 한다.
  const outside = src.replace(/s\.pointer\(\(p\) => \{[\s\S]*?\n {4}\}\)\n/g, '')
  assert.ok(outside.length < src.length - 200, 's.pointer 겹을 찾지 못했다')
  assert.doesNotMatch(outside, /pointerdown|touchstart|onTouch|addEventListener\(["']pointer|onPointer/, 'pointer 겹 밖에 포인터 이벤트가 있다')
  assert.doesNotMatch(src, /objectSwap3d|data-3d-swap/, '여러 도형을 바꿔 끼우던 길은 없다')
  assert.match(hook('cn-block-hero-object-3d-orbit-stage'), /touch-pan-y/)
})

test('video-montage 는 기본 음소거 + 소리 단추', () => {
  const src = read(B('hero/video-montage.tsx'))
  assert.match(src, /muted/)
  assert.match(src, /SoundToggle/)
  assert.doesNotMatch(src, /autoPlay|autoplay=/)
})

test('소리 단추 조각: 처음은 꺼짐(aria-pressed false) — 켜기는 사용자 조작 뒤에만', async () => {
  const src = read(B('_shared/sound-toggle.tsx'))
  assert.match(src, /useState\(false\)/, '처음 상태는 꺼짐')
  assert.doesNotMatch(src, /autoPlay|\.play\(\)/, '소리 단추는 재생을 시작하지 않는다 — 켜기는 이미 재생 중인 영상의 음소거만 푼다')
  const mod = await load(B('_shared/sound-toggle.tsx'))
  const html = renderToStaticMarkup(h(mod.SoundToggle, { on: false, onToggle() {}, label: '소리 켜기' }))
  assert.match(html, /<button[^>]*type="button"[^>]*aria-pressed="false"[^>]*aria-label="소리 켜기"/)
  assert.match(html, /data-wf-sound-toggle=""/)
  const on = renderToStaticMarkup(h(mod.SoundToggle, { on: true, onToggle() {}, label: '소리 켜기' }))
  assert.match(on, /aria-pressed="true"/)
})

test('kinetic-type-video 에도 소리 단추를 단다(soundLabel 이 있고 영상일 때만)', async () => {
  const src = read(B('hero/kinetic-type-video.tsx'))
  assert.match(src, /SoundToggle/)
  const mod = await load(B('hero/kinetic-type-video.tsx'))
  const fx = await load(B('hero/kinetic-type-video.fixture.ts'))
  const poster = { kind: 'image', src: '/m/p.webp', srcSet: '/m/p.webp 1440w', alt: '', width: 1440, height: 960 }
  const video = { kind: 'video', mp4: '/m/v.mp4', poster, alt: '', decorative: true, loop: true, muted: true, width: 1920, height: 1080 }
  const withSound = renderToStaticMarkup(h(mod.HeroKineticTypeVideo, { ...fx.fixture, copy: { ...fx.fixture.copy, soundLabel: '영상 소리 켜기' }, media: video }))
  assert.match(withSound, /data-wf-sound-toggle=""[^>]*/)
  assert.match(withSound, /aria-label="영상 소리 켜기"/)
  const noLabel = renderToStaticMarkup(h(mod.HeroKineticTypeVideo, { ...fx.fixture, media: video }))
  assert.doesNotMatch(noLabel, /data-wf-sound-toggle/)
  const noVideo = renderToStaticMarkup(h(mod.HeroKineticTypeVideo, { ...fx.fixture, copy: { ...fx.fixture.copy, soundLabel: '영상 소리 켜기' } }))
  assert.doesNotMatch(noVideo, /data-wf-sound-toggle/, '영상이 없으면 소리 단추도 없다')
})

const img = (n, alt = '') => ({ kind: 'image', src: `/media/x/p-${n}-1440.webp`, srcSet: `/media/x/p-${n}-1440.webp 1440w`, alt, width: 1440, height: 900 })
const clip = (n) => ({ kind: 'video', mp4: `/media/x/c-${n}.mp4`, webm: `/media/x/c-${n}.webm`, poster: img(n), alt: '', decorative: true, loop: true, muted: true, width: 1280, height: 720 })
async function render(v, extra = {}, fx = 'fixture') {
  const mod = await load(B(`hero/${v}.tsx`))
  const f = await load(B(`hero/${v}.fixture.ts`))
  return renderToStaticMarkup(h(mod[EXPECT[v].name], { ...f[fx], ...extra }))
}

for (const v of NEW) {
  test(`hero/${v}: 서버 렌더 — h1 하나, 숨기는 data-enter 없음, 예시·최대·최소 모두 그려진다`, async () => {
    for (const fx of ['fixture', 'fixtureMax', 'fixtureMin']) {
      const html = await render(v, {}, fx)
      assert.equal((html.match(/<h1[\s>]/g) ?? []).length, 1, `${v}/${fx} h1 하나`)
      assert.doesNotMatch(html, /data-enter="(true)?"/, `${v}/${fx} 첫 화면에 숨기는 등장 대상이 없다`)
      assert.match(html, new RegExp(`data-block="hero-${v}"`))
      assert.match(html, new RegExp(`data-hero="${v}"`))
      assert.doesNotMatch(html, /<canvas/, '서버 HTML 에는 3D 캔버스가 없다(포스터가 첫 칠)')
    }
  })
}

test('object-3d-orbit: 포스터 그림이 첫 칠(우선 받기) · 3D 가 올라오기 전에는 정지 단추가 없다', async () => {
  const html = await render('object-3d-orbit', { media: img(1, '코발트 유약 그릇이 놓인 예시 장면') }, 'fixtureMax')
  assert.match(html, /<img[^>]*fetchPriority="high"|<img[^>]*fetchpriority="high"/i)
  assert.match(html, /코발트 유약 그릇이 놓인 예시 장면/)
  assert.doesNotMatch(html, /data-wf-loop-pause/, '3D 가 올라오기 전(서버 HTML·동작 줄이기)에는 정지 단추를 그리지 않는다 — 포스터만')
  const none = await render('object-3d-orbit', {}, 'fixture')
  assert.match(none, /object-3d-orbit-fallback/, '포스터가 없으면 muted 무대')
})

test('object-3d-orbit 대체 순서 세 갈래의 서버 HTML: 모델 → 2.5D → 포스터만 (고르지 않음은 03 — object-3d-gen.test.mjs)', async () => {
  const poster = img(3, '')
  const model = await render('object-3d-orbit', { model: { src: '/media/motkit/o.glb', poster, source: 'generated-ok', alt: '도자 그릇 3D 모델' } })
  assert.match(model, /data-stage-mode="model"/)
  assert.match(model, /aria-label="도자 그릇 3D 모델"/, '무대 이름은 모델 설명')
  assert.match(model, /<img[^>]*(fetchPriority|fetchpriority)="high"/i, '모델의 포스터가 첫 칠')
  assert.doesNotMatch(model, /<canvas|data-wf-loop-pause|\.glb/, '서버 HTML 에는 캔버스도 정지 단추도 GLB 주소도 없다 — three·모델은 칠 뒤에 올라온다')
  assert.doesNotMatch(model, /o3-glare/)
  const parallax = await render('object-3d-orbit', { media: img(4, '코발트 그릇') })
  assert.match(parallax, /data-stage-mode="parallax"/)
  assert.match(parallax, /o3-glare/, '2.5D 의 반사광 층')
  assert.match(parallax, /<img[^>]*(fetchPriority|fetchpriority)="high"/i)
  assert.doesNotMatch(parallax, /<canvas/)
  const bare = await render('object-3d-orbit', {})
  assert.match(bare, /data-stage-mode="poster"/)
  assert.doesNotMatch(bare, /<img|<canvas|o3-glare/)
  // 둘 다 있으면 모델이 앞선다(모델의 포스터가 첫 칠)
  const both = await render('object-3d-orbit', { model: { src: '/m.glb', poster: img(5, ''), source: 'generated-ok', alt: 'x' }, media: img(6, '') })
  assert.match(both, /data-stage-mode="model"/)
  assert.match(both, /p-5-1440/)
  assert.doesNotMatch(both, /p-6-1440/)
})

test('object-3d-orbit: three·GLTFLoader 는 동적 import 로만, 모델은 칠 뒤 한가할 때, 멈춤 신호를 듣고, 정지 단추가 있다', () => {
  const src = read(B('hero/object-3d-orbit.tsx'))
  assert.doesNotMatch(src, /^import[^\n]*from ["']three/m, '정적 three import 없음')
  for (const m of ['three', 'three/examples/jsm/loaders/GLTFLoader.js', 'three/examples/jsm/loaders/DRACOLoader.js', 'three/examples/jsm/environments/RoomEnvironment.js']) assert.match(src, new RegExp(`await import\\("${m.replace(/[./]/g, '\\$&')}"\\)`), m)
  assert.match(src, /requestIdleCallback/)
  assert.match(src, /data-wf-paused/)
  assert.match(src, /LoopPause/)
  assert.match(src, /dracoPath \?\? "\/draco\/"/, 'Draco 디코더는 같은 출처 경로')
  assert.match(src, /PMREMGenerator/)
  assert.match(src, /forceContextLoss/)
})

test('illustration-scene: 그림이 있으면 우선 받는 전폭 그림, 없으면 muted 틀', async () => {
  const html = await render('illustration-scene', { media: img(2, '예시 일러스트') })
  assert.match(html, /<img[^>]*(fetchPriority|fetchpriority)="high"/i)
  assert.match(html, /data-enter="keep"/)
  const none = await render('illustration-scene')
  assert.match(none, /illustration-scene-fallback/)
  assert.doesNotMatch(none, /<img/)
})

test('map-first: 표지는 이름 있는 단추 목록 — 첫 지점 카드가 열려 있고 표지마다 aria-expanded', async () => {
  const html = await render('map-first', {}, 'fixtureMax')
  const pins = html.match(/<button[^>]*data-map-pin=""[^>]*>/g) ?? []
  assert.ok(pins.length >= 3, `표지 ${pins.length}`)
  assert.equal(pins.filter((p) => /aria-expanded="true"/.test(p)).length, 1, '카드가 열린 표지는 하나')
  assert.ok(pins.every((p) => /aria-controls="[^"]+"/.test(p)))
  assert.match(html, /<ul[^>]*aria-label="[^"]+"/, '키보드로 지나갈 표지 목록')
  assert.match(html, /aria-live="polite"/, '카드 바뀜을 읽어 준다')
  assert.doesNotMatch(html, /maps\.googleapis|kakao\.com\/v2|naver\.com\/openapi|<iframe/, '외부 지도 SDK·iframe 없음')
  const one = await render('map-first', {}, 'fixtureMin')
  assert.equal((one.match(/data-map-pin=""/g) ?? []).length, 1)
})

test('mascot-greeting: 말풍선 안 제목 + 상표·저작권 확인 문구가 서버 HTML 에 있다', async () => {
  const html = await render('mascot-greeting', { media: img(3, '예시 캐릭터') })
  assert.match(html, /data-bubble=""/)
  assert.match(html, /data-rights=""/)
  assert.match(html, /<img[^>]*(fetchPriority|fetchpriority)="high"/i)
  assert.doesNotMatch(await render('mascot-greeting'), /<img/)
})

test('video-montage: 첫 컷 포스터만 우선 받고 영상은 preload none · 컷이 둘 이상이면 정지 단추 · 소리 단추는 soundLabel 이 있고 영상이 있을 때만', async () => {
  const clips = [clip(1), clip(2), clip(3)]
  const html = await render('video-montage', { clips }, 'fixtureMax')
  assert.equal((html.match(/fetchPriority="high"|fetchpriority="high"/gi) ?? []).length, 1, '우선 받는 그림은 첫 컷 포스터 하나')
  assert.ok((html.match(/<video[^>]*preload="none"/g) ?? []).length >= 3)
  assert.equal((html.match(/data-wf-cut=""/g) ?? []).length, 3)
  assert.equal((html.match(/data-wf-cut=""[^>]*data-active=""|data-active=""[^>]*data-wf-cut=""/g) ?? []).length, 1, '켜진 컷은 하나')
  assert.match(html, /data-wf-loop-pause=""/)
  assert.match(html, /data-wf-sound-toggle=""[^>]*aria-pressed="false"/)
  const silent = await render('video-montage', { clips }, 'fixtureMin')
  assert.doesNotMatch(silent, /data-wf-sound-toggle/, 'soundLabel 이 없으면 소리 단추도 없다')
  const oneVideo = await render('video-montage', { clips: [clip(1)] }, 'fixtureMax')
  assert.match(oneVideo, /data-wf-loop-pause/, '컷이 하나여도 영상이면 돌아서 정지 단추가 있다')
  const oneStill = await render('video-montage', { clips: [img(5)] }, 'fixtureMax')
  assert.doesNotMatch(oneStill, /data-wf-loop-pause|data-wf-sound-toggle/, '컷이 한 장 사진이면 움직일 것도 소리도 없어 두 단추 모두 없다')
  const single = await render('video-montage', { media: clip(2) }, 'fixtureMin')
  assert.equal((single.match(/data-wf-cut=""/g) ?? []).length, 1, '05-media 의 단일 칸(media)은 한 컷 몽타주로 읽는다')
})

test('screenshot-window: 제품 화면이 없으면 「실제 화면 필요」 틀(가상 앱 글 없음) · 있으면 그 그림', async () => {
  const empty = await render('screenshot-window')
  assert.match(empty, /data-state="empty"/)
  assert.match(empty, /data-real-required=""/)
  assert.doesNotMatch(empty, /<img/)
  const fx = await load(B('hero/screenshot-window.fixture.ts'))
  assert.ok(empty.includes(fx.fixture.copy.emptyLabel))
  const full = await render('screenshot-window', { media: { ...img(4, '실제 제품 화면 예시'), source: 'real-required' } })
  assert.match(full, /<img[^>]*(fetchPriority|fetchpriority)="high"/i)
  assert.doesNotMatch(full, /data-state="empty"/)
  // 블록 예시에 앱 창 안쪽 글(가상 앱 글)이 없다 — 경로 이름도 목업 키(window·panel·screen·app …)가 아니다.
  const copyKeys = Object.keys(fx.fixture.copy)
  assert.ok(!copyKeys.some((k) => ['window', 'panel', 'terminal', 'workspace', 'app', 'screen', 'mockup', 'device', 'browser', 'console'].includes(k)), copyKeys.join())
})
