// LOCALTBT — 서버 HTML 을 하이드레이션하는 구획의 첫 GSAP 장면은 커밋 안이 아니라 장면마다 새 작업에서 선다.
// 왜: 레이아웃 효과는 하이드레이션 커밋 안에서 한꺼번에 돈다. local 홈은 장면 일곱 개가 한 작업(실측 156 ms, 그중 GSAP 110 ms)에 몰려
// 모의 TBT 400~600 ms → lh-perf 87 이었다. 실행: node --test --test-force-exit --test-timeout=60000 factory/scripts/motion-scene-defer.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { runInNewContext } from 'node:vm'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import { MOTION_DIR } from './gen-kits.mjs'

// 훅 원천을 CommonJS 로 옮겨 가짜 React·gsap·문서 위에서 돌린다. serverSnapshot: useSyncExternalStore 가 하이드레이션 중이라고 답할지.
function loadHook({ hydrating, failFirst = false }) {
  const src = readFileSync(join(MOTION_DIR, 'use-gsap-scene.ts'), 'utf8')
  const { outputText } = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.Preserve, esModuleInterop: true } })
  const timers = []
  const calls = { matchMedia: 0, revert: 0, errors: [] }
  const effects = []
  const refs = []
  const React = {
    useRef: (v) => { const r = { current: v }; refs.push(r); return r },
    useSyncExternalStore: (_sub, client, server) => (hydrating ? server() : client()),
    useEffect: (fn) => effects.push(fn),
    useLayoutEffect: (fn) => effects.push(fn),
  }
  const gsap = {
    registerPlugin() {},
    matchMedia: () => { calls.matchMedia++; if (failFirst && calls.matchMedia === 1) throw new Error('boom'); return { add() {}, revert() { calls.revert++ } } },
  }
  const scale = { bezierArgs: () => null, entranceSkipped: () => false, levelFromEnter: () => 'M2', levelFromVar: () => null, parseDuration: () => 0.5, scaleFor: () => ({}), sceneBranch: () => 'full', scrubEnd: () => 0 }
  const mods = {
    react: React,
    gsap: { gsap },
    'gsap/CustomEase': { CustomEase: { create() {} } },
    'gsap/ScrollTrigger': { ScrollTrigger: {} },
    'gsap/SplitText': { SplitText: {} },
    '@/registry/factory/motion/motion-scale': scale,
  }
  const cjsModule = { exports: {} }
  const sandbox = {
    module: cjsModule, exports: cjsModule.exports, require: (id) => { if (!(id in mods)) throw new Error(`unexpected import ${id}`); return mods[id] },
    window: {}, document: { addEventListener() {}, removeEventListener() {}, documentElement: { dataset: {} } },
    process: { env: { NODE_ENV: 'production' } },
    console: { error: (...a) => calls.errors.push(a), info() {} },
    setTimeout: (fn) => { timers.push(fn); return timers.length },
  }
  runInNewContext(outputText, sandbox)
  return {
    useGsapScene: cjsModule.exports.useGsapScene,
    timers, calls, effects,
    // 훅 하나를 부르고 그 효과를 돌린다(뿌리 요소가 있다고 가정). 돌려주는 값 = 효과의 정리 함수.
    mount() {
      const before = effects.length
      const root = { dataset: {}, removeAttribute() {}, toggleAttribute() {}, hasAttribute: () => false }
      cjsModule.exports.useGsapScene({ current: root }, () => {}, {})
      const run = effects[before]
      assert.ok(run, '훅이 효과 하나를 등록한다')
      return run()
    },
  }
}

test('hydrating from server HTML: no scene is built inside the commit; each scene is built in its own task', () => {
  const h = loadHook({ hydrating: true })
  const cleanups = [h.mount(), h.mount(), h.mount()]
  assert.equal(h.calls.matchMedia, 0, '커밋(효과) 안에서는 gsap 장면을 세우지 않는다')
  assert.ok(h.timers.length >= 1, '장면을 새 작업으로 미룬다')
  // 작업 하나가 장면 하나만 세운다: 첫 작업 뒤 1, 둘째 뒤 2, 셋째 뒤 3.
  const seen = []
  for (let i = 0; i < 12 && h.calls.matchMedia < 3; i++) { h.timers.shift()(); seen.push(h.calls.matchMedia) }
  assert.deepEqual(seen.slice(0, 3), [1, 2, 3], '한 작업에 장면 하나')
  assert.equal(typeof cleanups[0], 'function')
})

test('a scene unmounted before its task runs is never built', () => {
  const h = loadHook({ hydrating: true })
  const off = h.mount()
  off()
  while (h.timers.length) h.timers.shift()()
  assert.equal(h.calls.matchMedia, 0)
})

test('a scene mounted on the client (no server HTML) is still built right inside the effect', () => {
  const h = loadHook({ hydrating: false })
  h.mount()
  assert.equal(h.calls.matchMedia, 1, '서버 HTML 이 없는 구획은 바로 선다(미룰 이유가 없다)')
  assert.equal(h.timers.length, 0)
})

test('cleanup of a deferred scene that did get built reverts it', () => {
  const h = loadHook({ hydrating: true })
  const off = h.mount()
  while (h.timers.length) h.timers.shift()()
  assert.equal(h.calls.matchMedia, 1)
  off()
  assert.equal(h.calls.revert, 1)
})

test('B1: a scene that throws while being built does not stall the queue — the next scenes are still built, the error is logged', () => {
  const h = loadHook({ hydrating: true, failFirst: true })
  h.mount(); h.mount(); h.mount()
  for (let i = 0; i < 12 && h.timers.length; i++) h.timers.shift()()
  assert.equal(h.calls.matchMedia, 3, 'first scene throws; the next two are still built')
  assert.equal(h.calls.errors.length, 1, 'error goes to console.error once')
  h.mount()
  assert.ok(h.timers.length >= 1, 'queue drained: pump is released and a new scene is scheduled again')
})
