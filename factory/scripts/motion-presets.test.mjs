// FV1 Task 5.6 (C2) — 모션 프리셋 7종(scroll-hint·preloader-intro·blur-to-sharp·lottie-playback·view-transition-page·object-swap-3d·preview-follow)과 효과 카드 32장.
// 도우미마다 순수 계획 함수(motion-scale.ts — xxxPlan(opts) → { animates, hidesText, durationMs, … })와 GSAP 실행부(gsap-techniques.ts)가 나뉜다.
// 시험은 계획 함수만 부른다(브라우저 없음) + 원천의 모양을 정적으로 본다.
// 실행: node --test --test-force-exit --test-timeout=60000 factory/scripts/motion-presets.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'
import { motionItems, MOTION_DIR } from './gen-kits.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = join(root, '.tmp', 'motion-presets-test')
const effects = JSON.parse(readFileSync(join(root, 'references', 'motion', 'effects.json'), 'utf8'))
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const tech = readFileSync(join(MOTION_DIR, 'gsap-techniques.ts'), 'utf8')
const NEW = ['scroll-hint', 'preloader-intro', 'blur-to-sharp', 'lottie-playback', 'view-transition-page', 'object-swap-3d', 'preview-follow']

async function loadScale() {
  mkdirSync(OUT, { recursive: true })
  const { outputText } = ts.transpileModule(readFileSync(join(MOTION_DIR, 'motion-scale.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } })
  const out = join(OUT, `motion-scale-${process.pid}-${Date.now()}.mjs`)
  writeFileSync(out, outputText)
  return import(pathToFileURL(out).href)
}
const m = await loadScale()
const plan = (id, opts) => m.presetPlan(id, opts)
const fnBody = (name) => {
  const i = tech.indexOf(`export function ${name}(`)
  assert.ok(i >= 0, `${name} 를 내보낸다`)
  const j = tech.indexOf('\nexport ', i + 10)
  return tech.slice(i, j < 0 ? undefined : j)
}

test('효과 카드가 25장보다 많다(C2) — 새 카드 일곱이 기존 카드와 같은 칸 모양', () => {
  assert.ok(effects.effects.length > 25, String(effects.effects.length))
  assert.equal(effects.effects.length, 32)
  const ids = effects.effects.map((c) => c.id)
  assert.equal(new Set(ids).size, ids.length, '카드 id 는 겹치지 않는다')
  const SHAPE = ['id', 'name', 'ko', 'what', 'whereOnWeb', 'parameters', 'implementation', 'a11y', 'perf', 'fit', 'sources', 'factoryGate', 'kit']
  for (const id of NEW) {
    const c = effects.effects.find((x) => x.id === id)
    assert.ok(c, `${id} 카드`)
    for (const k of SHAPE) assert.ok(k in c, `${id}.${k}`)
    assert.ok(c.a11y.reducedMotion && c.perf.lcpRisk, `${id} 접근성·성능 칸이 비지 않는다`)
    assert.ok(['baseline', 'dynamic', 'signature'].includes(c.factoryGate.tier), `${id} tier`)
    assert.ok(Array.isArray(c.fit.archetypes) && c.fit.archetypes.length, `${id} fit`)
    // sources 는 공개 문서 주소만 — https, 허용 도메인
    assert.ok(c.sources.length >= 2, `${id} sources`)
    for (const u of c.sources) assert.match(u, /^https:\/\/(developer\.mozilla\.org|web\.dev|developer\.chrome\.com|gsap\.com|www\.w3\.org|dotlottie\.io|developers\.lottiefiles\.com|threejs\.org|github\.com\/LottieFiles)\//, `${id} 출처 ${u}`)
  }
  // 기존 25장은 그대로(앞 25장 id 순서 고정)
  assert.deepEqual(ids.slice(0, 3), ['kinetic-typography', 'lower-third', 'ken-burns'])
})

for (const id of NEW) test(`${id}: 동작 줄이기에서 정지·글을 숨기지 않는다(C2)`, () => {
  const p = plan(id, { reducedMotion: true })
  assert.equal(p.animates, false)
  assert.equal(p.hidesText, false)
  assert.equal(typeof p.durationMs, 'number')
})

for (const id of NEW) test(`${id}: 모션 허용이면 글을 숨기지 않는다(양성 대조 — 계획이 실제로 움직임을 말한다)`, () => {
  const p = plan(id, { reducedMotion: false, items: 3 })
  assert.equal(p.hidesText, false)
  assert.ok(p.animates || id === 'preloader-intro', `${id} 은 허용 때 움직인다`)
})

test('M0(레시피 정지 단계)에서도 모든 계획이 정지다', () => {
  for (const id of NEW) assert.equal(plan(id, { level: 'M0', items: 3 }).animates, false, id)
})

test('previewFollow 는 hover 없는 기기에서 아무것도 움직이지 않고 탭이 링크를 막지 않는다', () => {
  const none = plan('preview-follow', { hover: false })
  assert.equal(none.animates, false)
  assert.equal(none.staticImage, true, '그림은 정지로 남는다')
  assert.equal(none.blocksTap, false)
  assert.equal(plan('preview-follow', { pointerFine: false }).animates, false)
  const on = plan('preview-follow', { hover: true, pointerFine: true })
  assert.equal(on.animates, true)
  assert.equal(on.blocksTap, false, '움직여도 탭·클릭을 막지 않는다')
})

test('pageTransition: 전환 뒤 초점을 새 쪽 h1 로(UX J03) — 동작 줄이기·미지원에서도', () => {
  for (const o of [{}, { reducedMotion: true }, { supported: false }, { level: 'M0' }]) {
    const p = plan('view-transition-page', o)
    assert.equal(p.focusTarget, 'h1', JSON.stringify(o))
    assert.equal(p.moveFocus, true)
  }
  assert.equal(plan('view-transition-page', {}).animates, true)
  assert.equal(plan('view-transition-page', { supported: false }).animates, false, 'API 가 없으면 바로 바꾼다')
  assert.ok(plan('view-transition-page', {}).durationMs <= 400)
})

test('preloaderIntro: 첫 방문만·1.2초 이내·건너뛰기 단추·LCP 를 막지 않음, 동작 줄이기에서는 아예 그리지 않는다', () => {
  const p = plan('preloader-intro', {})
  assert.equal(p.renders, true)
  assert.ok(p.durationMs <= 1200, String(p.durationMs))
  assert.equal(p.skipButton, true)
  assert.equal(p.blocksLcp, false)
  assert.equal(p.coversText, false)
  assert.equal(plan('preloader-intro', { maxMs: 5000 }).durationMs, 1200, '상한 1.2초를 넘기지 않는다')
  assert.equal(plan('preloader-intro', { firstVisit: false }).renders, false, '재방문은 그리지 않는다')
  const r = plan('preloader-intro', { reducedMotion: true })
  assert.equal(r.renders, false)
  assert.equal(r.animates, false)
})

test('blurToSharp: 흐림은 휩 팬(whipPlan)의 값 재사용, 글을 숨기지 않고 흐림이 끝에서 0', () => {
  const p = plan('blur-to-sharp', { level: 'M2' })
  assert.equal(p.fromBlurPx, m.whipPlan('M2').blur[1] / 3)
  assert.equal(p.toBlurPx, 0)
  assert.equal(p.hidesText, false)
  assert.ok(p.fromBlurPx > 0 && p.fromBlurPx <= 10)
  assert.ok(plan('blur-to-sharp', { level: 'M3' }).fromBlurPx >= p.fromBlurPx)
  assert.equal(plan('blur-to-sharp', { reducedMotion: true }).fromBlurPx, 0)
})

test('scrollHint: 5초 넘는 반복이면 멈춤 단추, 아니면 3번만 반복하고 스크롤하면 멈춘다', () => {
  const p = plan('scroll-hint', {})
  assert.equal(p.stopsOnScroll, true)
  assert.ok(p.durationMs * p.repeats <= 5000 ? p.pauseButton === false : p.pauseButton === true)
  const long = plan('scroll-hint', { cycleMs: 2500, repeats: 4 })
  assert.equal(long.pauseButton, true, '10초 반복은 멈춤 단추')
})

test('objectSwap3d: 동작 줄이기면 포스터만, 끌어 돌리기는 고운 포인터에서만, 한 개면 바꿀 것이 없다', () => {
  const r = plan('object-swap-3d', { reducedMotion: true, items: 3, pointerFine: true })
  assert.equal(r.posterOnly, true)
  assert.equal(r.drag, false)
  assert.equal(r.animates, false)
  const fine = plan('object-swap-3d', { items: 3, pointerFine: true })
  assert.equal(fine.posterOnly, false)
  assert.equal(fine.drag, true)
  assert.equal(plan('object-swap-3d', { items: 3, pointerFine: false }).drag, false, '터치에서는 끌지 않는다(스크롤을 가로채지 않는다)')
  assert.equal(plan('object-swap-3d', { items: 1 }).animates, false)
  assert.equal(fine.autoplays, false, '스스로 돌지 않는다 — 5초 반복 없음')
})

test('lottiePlayback: 동작 줄이기면 첫 프레임 정지, 화면 밖이면 멈춤, 5초 넘는 반복은 멈춤 단추', () => {
  const r = plan('lottie-playback', { reducedMotion: true, loopSeconds: 8 })
  assert.equal(r.autoplay, false)
  assert.equal(r.firstFrameOnly, true)
  assert.equal(r.pauseButton, false, '정지 상태에는 단추가 필요 없다')
  const p = plan('lottie-playback', { loopSeconds: 8 })
  assert.equal(p.autoplay, true)
  assert.equal(p.pausesOffscreen, true)
  assert.equal(p.pauseButton, true)
  assert.equal(plan('lottie-playback', { loopSeconds: 3, loop: true }).pauseButton, true, '무한 반복은 길이와 상관없이 5초를 넘긴다')
  assert.equal(plan('lottie-playback', { loopSeconds: 3, loop: false }).pauseButton, false)
})

test('presetPlan: 모르는 id 는 던진다', () => {
  assert.throws(() => plan('nope', {}), /nope/)
})

// ── 실행부(GSAP) 원천 규칙 ──
test('gsap-techniques: 도우미 여섯이 이름 그대로 내보내지고 각자 계획 함수를 쓴다', () => {
  const PLAN = { scrollHint: 'scrollHintPlan', preloaderIntro: 'preloaderIntroPlan', blurToSharp: 'blurToSharpPlan', objectSwap3d: 'objectSwap3dPlan', previewFollow: 'previewFollowPlan', pageTransition: 'pageTransitionPlan' }
  for (const [fn, planFn] of Object.entries(PLAN)) {
    assert.match(fnBody(fn), new RegExp(`${planFn}\\(`), `${fn} → ${planFn}`)
    assert.match(m[planFn].toString(), /animates/, planFn)
  }
  // 계획 함수는 motion-scale 에 둔다(순수) — gsap-techniques 에는 export 하지 않아 기법 id 표(blocks.mjs techniqueIds)가 부풀지 않는다
  assert.doesNotMatch(tech, /export (function|const) \w+Plan\b/)
  // svgDraw 는 있는 것 그대로
  assert.match(tech, /export function svgDraw\(s: Scene, paths: Targets,/)
})

test('previewFollow 는 고운 포인터 겹(s.pointer)에서만 달리고 클릭·탭을 막지 않는다', () => {
  const b = fnBody('previewFollow')
  assert.match(b, /onPointer\(s,/)
  assert.doesNotMatch(b, /preventDefault/)
  assert.doesNotMatch(b, /s\.finePointer/)
})

test('pageTransition: View Transitions API 를 쓰고 끝난 뒤 새 쪽 h1 로 초점을 옮긴다 — 동작 줄이기에서는 전환만 끈다', () => {
  const b = fnBody('pageTransition')
  assert.match(b, /startViewTransition/)
  assert.match(b, /focusHeading\(p\.focusTarget\)/, '끝난 뒤(전환이 꺼진 경우도) 계획이 정한 대상으로 초점')
  assert.match(tech, /function focusHeading\([^]*?setAttribute\("tabindex", "-1"\)[^]*?\.focus\(\{ preventScroll: true \}\)/, 'h1 은 tabindex=-1 을 얻고 초점을 받는다')
})

test('preloaderIntro: 첫 방문 표지·건너뛰기 단추·글 위에 덮지 않는 띠(hidden 으로 시작, 정지 갈래에서는 열리지 않는다)', () => {
  const b = fnBody('preloaderIntro')
  assert.match(b, /data-preloader-skip/)
  assert.match(b, /try \{/, '저장소 접근은 try/catch')
  assert.match(b, /hidden/)
})

test('scrollHint 는 스크롤하면 멈추고, blurToSharp 는 autoAlpha 로 숨기지 않는다', () => {
  assert.match(fnBody('scrollHint'), /scroll/)
  assert.doesNotMatch(fnBody('blurToSharp'), /autoAlpha|opacity/)
  assert.match(fnBody('blurToSharp'), /clearProps/)
})

test('objectSwap3d 는 three 를 부르지 않는다(좁은 로컬 타입) — 포인터 끌기는 고운 포인터 겹에서만', () => {
  const b = fnBody('objectSwap3d')
  assert.doesNotMatch(tech, /from "three"|import\("three"\)/)
  assert.match(b, /onPointer\(s,/)
})

// ── motion-lottie(선택 설치) ──
test('motion-lottie: 동적 import 만(정적 import 없음), 입력 타입은 좁은 로컬 타입, 첫 프레임 정지·화면 밖 정지·멈춤 단추 알림', () => {
  const f = join(MOTION_DIR, 'motion-lottie.tsx')
  assert.ok(existsSync(f), 'motion-lottie.tsx')
  const src = readFileSync(f, 'utf8')
  assert.doesNotMatch(src, /from\s+["']@lottiefiles/, '정적 import 금지')
  // 번들러가 풀 수 있게 글자 그대로 동적 import(문자열 변수·webpackIgnore 는 맨 specifier 를 브라우저가 못 풀어 실제로는 깨진다) — 설치 전 typecheck 는 types/ 의 좁은 모듈 선언이 맡는다
  assert.match(src, /await import\("@lottiefiles\/dotlottie-web"\)/, '동적 import')
  assert.doesNotMatch(src, /@ts-expect-error|@ts-ignore/)
  const shim = readFileSync(join(root, 'types', 'dotlottie-web.d.ts'), 'utf8')
  assert.match(shim, /declare module "@lottiefiles\/dotlottie-web"/)
  assert.match(src, /lottiePlan\(/)
  assert.match(src, /usePauseOffscreen|IntersectionObserver/)
  assert.match(src, /setFrame\(0\)|firstFrameOnly/)
  assert.match(src, /onNeedsPause/)
  assert.match(src, /destroy\(\)/)
})

test('motion-lottie 항목: 정확한 판 고정·package.json·잠금 파일·라이선스 한 줄·게이트가 이어진다', () => {
  const ver = pkg.dependencies['@lottiefiles/dotlottie-web']
  assert.match(ver, /^\d+\.\d+\.\d+$/, '정확한 판으로 고정(^ 없음)')
  const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'))
  assert.equal(lock.packages['node_modules/@lottiefiles/dotlottie-web']?.version, ver, '잠금 파일이 같은 판')
  const lic = readFileSync(join(root, 'docs', 'qa', 'motion-licenses.md'), 'utf8')
  const line = lic.split('\n').find((l) => l.includes('motion-lottie') && l.startsWith('|'))
  assert.ok(line, '라이선스 표에 motion-lottie 한 줄')
  assert.ok(line.includes(ver) && /MIT/.test(line) && /https:\/\//.test(line))
  const items = motionItems({ ref: 'v9.9.9', versions: { ...pkg.devDependencies, ...pkg.dependencies } })
  const it = items.find((x) => x.name === 'motion-lottie')
  assert.ok(it, 'gen-kits 항목')
  assert.equal(it.type, 'registry:lib')
  assert.deepEqual(it.files.map((x) => x.path), ['motion-lottie.tsx'])
  assert.equal(it.files[0].target, '@components/motion/motion-lottie.tsx')
  assert.deepEqual(it.dependencies, [`@lottiefiles/dotlottie-web@${ver}`])
  assert.ok(it.registryDependencies.includes('nowwcastle-sudo/sitebrew/motion-gsap#v9.9.9'))
  assert.ok(it.registryDependencies.includes('nowwcastle-sudo/sitebrew/motion-core#v9.9.9'))
  // motion-gsap 쪽은 그대로(다섯 파일 — lottie 의존이 번지지 않는다)
  assert.deepEqual(items.find((x) => x.name === 'motion-gsap').dependencies, [`gsap@${pkg.dependencies.gsap}`])
})
