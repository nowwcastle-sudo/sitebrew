// P3-5 MOTKIT — 모션 그래픽 기법 8종(키네틱 타이포·로어 서드·켄 번스·펀치 인·스태거·휩 팬·이징 토큰·ease-out 기본값)의 순수 수치(motion-scale)와
// 도우미 규칙(gsap-techniques — 정적 검사). 수치 근거는 references/motion/effects.json(MOTRES 카드)의 parameters 범위다.
// 실행: node --test --test-force-exit --test-timeout=60000 factory/scripts/motion-kit-tech.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const MOTION = join(root, 'registry', 'factory', 'motion')
const OUT = join(root, '.tmp', 'motion-kit-tech-test')
const CARDS = JSON.parse(readFileSync(join(root, 'references', 'motion', 'effects.json'), 'utf8')).effects
const card = (id) => CARDS.find((c) => c.id === id)?.parameters

async function loadScale() {
  mkdirSync(OUT, { recursive: true })
  const { outputText } = ts.transpileModule(readFileSync(join(MOTION, 'motion-scale.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } })
  const out = join(OUT, `motion-scale-${process.pid}-${Date.now()}.mjs`)
  writeFileSync(out, outputText)
  return import(pathToFileURL(out).href)
}
const m = await loadScale()
const tech = readFileSync(join(MOTION, 'gsap-techniques.ts'), 'utf8')
const hook = readFileSync(join(MOTION, 'use-gsap-scene.ts'), 'utf8')
const fnBody = (name) => {
  const i = tech.indexOf(`export function ${name}(`)
  assert.ok(i >= 0, `${name} 를 내보낸다`)
  const j = tech.indexOf('\nexport ', i + 10)
  return tech.slice(i, j < 0 ? undefined : j)
}
const within = (v, [a, b], what) => assert.ok(v >= a - 1e-9 && v <= b + 1e-9, `${what}: ${v} 가 [${a}, ${b}] 밖`)

test('이징 토큰: 모든 이름이 CustomEase 로 읽히는 cubic-bezier, 기본값은 out(ease-out), 들어옴 곡선은 out 계열·나감은 in', () => {
  assert.equal(m.DEFAULT_EASE, 'out')
  assert.equal(m.EASES.out, 'cubic-bezier(0.23, 1, 0.32, 1)', '기본 out 은 키트 --ease-standard 와 같다')
  for (const [k, v] of Object.entries(m.EASES)) assert.ok(m.bezierArgs(v), `${k} 를 읽는다`)
  assert.ok(m.isOutEase('out') && m.isOutEase('out-expo') && !m.isOutEase('in-exit') && !m.isOutEase('drift'))
  // 카드 수치 그대로(ease-out 강 .16,1,.3,1 · 휩 .76,0,.24,1 · 켄 번스 sine.inOut 근사 .37,0,.63,1 · 펀치 오버슈트 .34,1.56,.64,1)
  assert.equal(m.bezierArgs(m.EASES['out-expo']), '0.16,1,0.3,1')
  assert.equal(m.bezierArgs(m.EASES['in-out-whip']), '0.76,0,0.24,1')
  assert.equal(m.bezierArgs(m.EASES.drift), '0.37,0,0.63,1')
  assert.equal(m.bezierArgs(m.EASES['out-back']), '0.34,1.56,0.64,1')
  // out 곡선: 끝 기울기가 0 에 가깝게 끝난다(세 번째 점 y = 1) — 들어옴이 부드럽게 멈춘다
  for (const k of Object.keys(m.EASES).filter(m.isOutEase)) assert.equal(Number(m.bezierArgs(m.EASES[k]).split(',')[3]), 1, `${k} 끝 y`)
})

test('ease-out 기본값: 새 등장 도우미는 곡선을 주지 않으면 out 계열(namedEase 기본·out-* 이름)로만 들어온다 — in 곡선을 들어옴에 쓰지 않는다', () => {
  assert.match(tech, /export function namedEase\(name: EaseName = DEFAULT_EASE\)/)
  for (const fn of ['kineticType', 'lowerThird', 'punchIn', 'staggerIn', 'whipIn']) {
    const body = fnBody(fn)
    const used = [...body.matchAll(/namedEase\(([^)]*)\)/g)].map((x) => x[1])
    assert.ok(used.length, `${fn} 는 이름 붙인 곡선을 쓴다`)
    for (const u of used) {
      const names = [...u.matchAll(/"([a-z-]+)"/g)].map((x) => x[1]).filter((n) => n in m.EASES)
      for (const n of names) if (n !== 'in-exit') assert.ok(m.isOutEase(n), `${fn} 들어옴 곡선 ${n} 는 out 계열`)
    }
  }
  // 나감 곡선(in-exit)은 로어 서드가 빠질 때만
  assert.ok(!/in-exit/.test(fnBody('staggerIn') + fnBody('punchIn') + fnBody('whipIn')))
})

test('키네틱 타이포: 글자 20~30ms·낱말 60~120ms 연쇄, 마지막 조각이 1.2s(M3 2s) 안에 끝난다 — 글이 길면 간격을 줄인다', () => {
  const c = card('kinetic-typography')
  within(m.TECH.kinetic.chars, c.stagger.chars, '글자 간격')
  within(m.TECH.kinetic.words, c.stagger.words, '낱말 간격')
  within(m.TECH.kinetic.yPercent, c.distance.yPercentWithMask, '마스크 거리')
  assert.equal(m.kineticStagger(1, 'chars'), 0)
  assert.equal(m.kineticStagger(10, 'chars'), m.TECH.kinetic.chars, '짧으면 카드 값 그대로')
  for (const [n, by, show] of [[60, 'chars', false], [200, 'chars', false], [40, 'words', false], [120, 'chars', true]]) {
    const each = m.kineticStagger(n, by, show)
    const end = (n - 1) * each + m.TECH.kinetic.perUnit
    assert.ok(end <= (show ? c.durationMs.showpieceTotalMax : c.durationMs.headlineTotalMax) / 1000 + 1e-6, `${n} ${by}: 끝 ${end}s`)
  }
})

test('로어 서드: 들어옴 400~700ms·머무름 2.5~6s·나감 250~450ms, 막대 → 글 연쇄 80~150ms — 머무름은 읽을 시간 밖으로 나가지 않는다', () => {
  const c = card('lower-third')
  const t = m.lowerThirdTiming()
  within(t.in * 1000, c.durationMs.in, '들어옴')
  within(t.out * 1000, c.durationMs.out, '나감')
  within(t.hold * 1000, c.durationMs.hold, '머무름')
  within(m.TECH.lowerThird.stagger, c.stagger.barThenText, '막대 → 글')
  within(m.TECH.lowerThird.slidePx, c.distance.slideInPx, '거리')
  assert.equal(m.lowerThirdTiming({ hold: 1 }).hold, 2.5, '짧게 주어도 2.5s')
  assert.equal(m.lowerThirdTiming({ hold: 20 }).hold, 6)
  assert.equal(m.lowerThirdTiming().cycle, +(t.in + t.hold + t.out).toFixed(3))
})

test('켄 번스: 장마다 확대 ↔ 축소와 팬 방향을 번갈아, 모든 자세가 칸을 덮는다(가장자리가 비지 않는다), 확대는 1.08~1.2·팬 2~6% 안', () => {
  const c = card('ken-burns')
  within(m.TECH.kenBurns.perSlide * 1000, c.durationMs.perSlide, '장 길이')
  within(m.TECH.kenBurns.crossfade * 1000, c.durationMs.crossfade, '교차')
  for (const n of [1, 3, 4, 5]) for (const intensity of [0.6, 1, 1.4]) {
    const plan = m.kenBurnsPlan(n, { intensity })
    assert.equal(plan.length, n)
    for (const [i, p] of plan.entries()) {
      assert.ok(m.kbCovers(p.from) && m.kbCovers(p.to), `${n}장 ${i} 강도 ${intensity}: 덮는다`)
      const zoomIn = p.to.scale > p.from.scale
      assert.equal(zoomIn, i % 2 === 0, `${i} 번째는 ${i % 2 === 0 ? '확대' : '축소'}`)
      if (i) {
        const prev = plan[i - 1]
        const dir = (q) => [Math.sign(q.to.xPercent - q.from.xPercent), Math.sign(q.to.yPercent - q.from.yPercent)].join(',')
        assert.notEqual(dir(p), dir(prev), `${i}: 이웃한 장이 같은 쪽으로 가지 않는다`)
      }
    }
  }
  const base = m.kenBurnsPlan(4)
  for (const p of base) {
    within(Math.max(p.from.scale, p.to.scale), [c.distance.scaleTo[0], c.distance.scaleTo[1] + 0.07], '가장 큰 배율(덮개 여유 포함)')
    within(Math.abs(p.to.xPercent - p.from.xPercent) + Math.abs(p.to.yPercent - p.from.yPercent), c.distance.panPercent, '팬 거리')
  }
  // 음성 대조: 팬보다 배율이 작으면 덮지 못한다
  assert.equal(m.kbCovers({ scale: 1, xPercent: 2, yPercent: 0 }), false)
})

test('펀치 인: 글자는 1.1~1.3배(읽히는 크기 안), 사진·영상 층만 1.4~2.5배 — 강도를 곱해도 범위 밖으로 나가지 않는다', () => {
  const c = card('punch-in')
  for (const d of [0, 0.6, 1, 1.5, 3]) {
    within(m.punchFrom('text', d), c.distance.textScaleFrom, `글자 강도 ${d}`)
    within(m.punchFrom('media', d), c.distance.imageOrVideoScaleFrom, `그림 강도 ${d}`)
  }
  within(m.TECH.punchIn.overshoot, c.distance.overshoot, '오버슈트')
  within(m.TECH.punchIn.in * 1000, c.durationMs.in, '들어옴')
  assert.match(fnBody('punchIn'), /\.slice\(0, 3\)/, '한 화면 동시 펀치 3개 이하(카드 guards)')
})

test('스태거: 형제 30~80ms, 전체 1.2s 이내, 첫 화면은 지연 합 0.3s 이하, 8개 넘으면 묶음 수가 8 이하', () => {
  const c = card('stagger')
  within(m.TECH.stagger.each, c.stagger.each, '기본 간격')
  for (const n of [1, 3, 6, 8, 9, 20, 40]) for (const firstScreen of [false, true]) {
    const p = m.staggerPlan(n, { firstScreen })
    assert.ok(p.groups.length <= 8, `${n}: 묶음 ${p.groups.length}`)
    assert.deepEqual(p.groups.flat(), Array.from({ length: n }, (_, i) => i), `${n}: 모든 항목이 차례로 한 번씩`)
    const lastStart = (p.groups.length - 1) * p.each
    assert.ok(lastStart <= (firstScreen ? 0.3 : 1.2 - m.TECH.stagger.perItem) + 1e-9, `${n} 첫 화면 ${firstScreen}: 마지막 시작 ${lastStart}`)
    if (n <= 8 && !firstScreen) assert.equal(p.groups.length, n, '8개까지는 하나씩')
  }
})

test('휩 팬: 240~400ms(M3 만 350~700ms), 흐림은 가운데에서만 최대·양 끝 0, 방향을 바꾸면 나가고 들어오는 쪽이 뒤집힌다', () => {
  const c = card('whip-pan')
  for (const lv of ['M1', 'M2']) within(m.whipPlan(lv).duration * 1000, c.durationMs.total, lv)
  within(m.whipPlan('M3').duration * 1000, c.durationMs.showpiece, 'M3')
  for (const lv of ['M1', 'M2', 'M3']) {
    const p = m.whipPlan(lv)
    assert.equal(p.blur[0], 0); assert.equal(p.blur[2], 0)
    within(p.blur[1], [0, c.distance.blurPx[1]], `${lv} 흐림`)
    within(Math.abs(p.skew), [0, Math.abs(c.distance.skewXDeg[1])], `${lv} 기울임`)
  }
  const r = m.whipPlan('M2', 1), l = m.whipPlan('M2', -1)
  assert.equal(r.inX, -l.inX); assert.equal(r.outX, -l.outX); assert.ok(r.outX < 0 && r.inX > 0)
  within(Math.abs(r.inX), c.distance.xPercent, '가로 거리')
})

test('강조(accent)는 번쩍임 관문 창(등장 끝 + 0.8초) 뒤에 시작하고 글을 숨기지 않는다 — wave·punch accent 는 to(옮김)만, autoAlpha·opacity 없음', () => {
  assert.ok(m.ACCENT_DELAY >= 1.2, `ACCENT_DELAY ${m.ACCENT_DELAY} ≥ 1.2 (ssr-flash record: entered + 800ms)`)
  assert.match(fnBody('accent'), /s\.afterEnter\(/)
  assert.match(fnBody('accent'), /delayedCall\(delay/)
  const kt = fnBody('kineticType')
  const waveEnd = kt.indexOf('// scrub:')
  assert.ok(waveEnd > 0, 'scrub 절 표지')
  const wave = kt.slice(kt.indexOf('mode === "wave"'), waveEnd)
  assert.match(wave, /accent\(s, play\)/)
  assert.ok(!/autoAlpha|opacity/.test(wave), 'wave 는 글을 숨기지 않는다')
  const punch = fnBody('punchIn')
  const acc = punch.slice(punch.indexOf('const hit'))
  assert.ok(!/autoAlpha|opacity/.test(acc), 'punch accent 는 숨기지 않는다')
  // scrub 은 맨 위(스크롤 0)에서 제자리 — 대리 값 p 가 0 이면 쪼갠 것을 되돌린다(첫 칠 모양). 등장이 끝나고 물결이 돌지 않을 때만 쪼갠다.
  assert.match(kt, /if \(proxy\.p <= 0\.001\) return release\(\)/)
  assert.match(kt, /if \(!ready \|\| node\.dataset\.wfWave\) return/)
  assert.match(kt, /if \(node\.dataset\.wfWave \|\| node\.dataset\.wfScrub\) return/, '물결은 스크럽이 쪼갠 동안 돌지 않는다')
})

test('유휴 반복(켄 번스·로어 서드 순환)은 s.loop 로만 — M2~M3 에서만 돌고 화면 밖·숨은 탭·사용자 정지(data-wf-user-paused)에서 멈춘다', () => {
  for (const fn of ['kenBurns', 'lowerThird']) {
    const b = fnBody(fn)
    assert.match(b, /s\.loop\(\(\) =>/, `${fn} 는 s.loop`)
    assert.match(b, /repeat: -1/)
    assert.match(b, /delay: ACCENT_DELAY/, `${fn} 반복은 등장 끝 + ACCENT_DELAY 뒤 시작(첫 칠 그림 그대로)`)
  }
  // 반복을 만드는 순간(하이드레이션 직후 — ssr-flash 창 안) 그림에 시작 자세를 입히지 않는다: 첫 장은 제자리에서 출발하고 바퀴 끝에 제자리로 돌아온다.
  const kb = fnBody('kenBurns')
  assert.doesNotMatch(kb, /immediateRender: (true|i === 0)/)
  assert.match(kb, /tl\.fromTo\(imgs\[0\], REST,/)
  assert.match(kb, /\{ \.\.\.REST, duration: 0\.01, immediateRender: false \}/)
  assert.match(kb, /return gsap\.to\(imgs\[0\],/, '한 장이면 제자리 ↔ 끝 자세 왕복')
  assert.match(hook, /!root\.hasAttribute\("data-wf-user-paused"\)/, '사용자 정지는 화면에 다시 들어와도 유지')
  assert.match(hook, /attributeFilter: \["data-wf-user-paused"\]/)
  assert.match(hook, /userPause\?\.disconnect\(\)/)
  // M1 은 유휴 반복 없음(키트 규칙) — 켄 번스는 M1 에서 첫 장 정지
  assert.equal(m.scaleFor('M1').loop, false)
})

test('되돌리기: 쪼갠 글은 장면 정리 때 되돌리고(onCleanup revert), 휩 팬·강조 트윈은 장면 문맥(s.add)에 들어간다', () => {
  const kt = fnBody('kineticType')
  assert.match(kt, /s\.onCleanup\(\(\) => sp\.revert\(\)\)/, 'rise 는 정리 때 쪼갠 것을 되돌린다')
  assert.match(kt, /s\.afterEnter\(\(\) => sp\.revert\(\)\)/, 'rise 는 등장 전체가 끝난 뒤 되돌린다(같은 제목의 다른 등장이 도는 동안 안쪽 요소를 새로 만들지 않는다)')
  assert.match(kt, /s\.onCleanup\(release\)/, 'scrub 은 정리 때 되돌린다')
  assert.match(kt, /onComplete: \(\) => \{ sp\.revert\(\)/, 'wave 는 끝나면 되돌린다')
  assert.match(fnBody('whipPan'), /return s\.add\(\(\) =>/)
  assert.match(fnBody('accent'), /s\.add\(fn\)/)
  assert.match(fnBody('playOnView'), /once: true/)
})
