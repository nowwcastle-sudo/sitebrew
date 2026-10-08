// FV1 3D-GROUND — object-3d-orbit 의 무대 바탕색: 포스터 가장자리 평균색을 --o3-ground 로 읽어 3D 가 올라올 때 바탕이 튀지 않게 한다.
//   ① edgeAverage: 단색 · 두 색 띠(안쪽은 무시) · 투명 픽셀 무시 · 전부 투명이면 null  ② groundOf: 읽기 실패(오염·그림 없음·디코드 실패)면 null → 변수를 두지 않는다
//   ③ 정적: 세 모드(model·parallax·poster)가 같은 바탕 변수를 쓴다 · 첫 칠 계약(three 동적 import · 한가할 때 읽기) 유지
// 실행: node --test --test-concurrency=3 --test-force-exit --test-timeout=120000 factory/scripts/object-3d-ground.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = join(root, '.tmp', 'object-3d-ground-test')
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
const { edgeAverage, groundOf } = await import(pathToFileURL(transpile(join(root, 'registry/factory/blocks/_shared/edge-ground.tsx'))).href)
const read = (rel) => readFileSync(join(root, rel), 'utf8')

// w×h RGBA 그림: paint(x, y) → [r,g,b,a]
const image = (w, h, paint) => {
  const d = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) d.set(paint(x, y), (y * w + x) * 4)
  return d
}

test('edgeAverage: 단색 그림은 그 색 그대로', () => {
  const d = image(16, 12, () => [200, 190, 180, 255])
  assert.deepEqual(edgeAverage(d, 16, 12), { r: 200, g: 190, b: 180 })
})

test('edgeAverage: 두 색 띠(위 절반 · 아래 절반)는 가장자리 평균 — 안쪽 색은 무시한다', () => {
  const w = 20, h = 20
  // 가장자리 띠(두께 2) 안쪽은 새빨강 — 평균에 들어가면 안 된다.
  const d = image(w, h, (x, y) => (x >= 2 && x < w - 2 && y >= 2 && y < h - 2 ? [255, 0, 0, 255] : y < h / 2 ? [100, 100, 100, 255] : [200, 200, 200, 255]))
  assert.deepEqual(edgeAverage(d, w, h, 0.1), { r: 150, g: 150, b: 150 })
})

test('edgeAverage: 투명 픽셀은 무시한다(가장자리 절반이 투명이어도 불투명 쪽 색만)', () => {
  const w = 16, h = 16
  const d = image(w, h, (x) => (x < w / 2 ? [0, 0, 0, 0] : [80, 120, 160, 255]))
  assert.deepEqual(edgeAverage(d, w, h), { r: 80, g: 120, b: 160 })
  // 전부 투명이면 읽을 색이 없다
  assert.equal(edgeAverage(image(8, 8, () => [10, 10, 10, 0]), 8, 8), null)
})

test('groundOf: 정상 그림이면 rgb() 문자열', () => {
  const img = { naturalWidth: 640, naturalHeight: 480 }
  const make = () => ({ getContext: () => ({ drawImage() {}, getImageData: (_x, _y, w, h) => ({ data: image(w, h, () => [200, 190, 180, 255]) }) }) })
  assert.equal(groundOf(img, make), 'rgb(200 190 180)')
})

test('groundOf: 잘려 보이는 영역(aspect · object-position 초점)만 읽는다 — 정사각 그림을 가로 무대에 맞추면 위아래가 잘린다', () => {
  let args
  const make = () => ({ getContext: () => ({ drawImage: (...a) => { args = a.slice(1) }, getImageData: (_x, _y, w, h) => ({ data: image(w, h, () => [1, 2, 3, 255]) }) }) })
  const img = { naturalWidth: 800, naturalHeight: 800 }
  groundOf(img, make, 2) // 가로 2:1 → 세로 400 만 보인다
  assert.deepEqual(args.slice(0, 4), [0, -12, 48, 48], '가운데 초점 — 그림 전체를 cover 로 깐다(위아래가 12씩 잘린다). source rect 는 쓰지 않는다: srcset 그림은 비트맵 크기 ≠ naturalWidth')
  groundOf(img, make, 2, { x: 0.5, y: 0 })
  assert.deepEqual(args.slice(0, 4).map((v) => v + 0), [0, 0, 48, 48], '위 초점')
})

test('groundOf: 읽기 실패(캔버스 오염 · 그림 없음 · 디코드 실패 · 컨텍스트 없음)는 null — 변수를 두지 않는다', () => {
  const tainted = () => ({ getContext: () => ({ drawImage() {}, getImageData() { throw new Error('SecurityError: tainted canvas') } }) })
  const ok = { naturalWidth: 640, naturalHeight: 480 }
  assert.equal(groundOf(ok, tainted), null, '다른 출처 그림')
  assert.equal(groundOf(null, tainted), null, '그림 없음')
  assert.equal(groundOf({ naturalWidth: 0, naturalHeight: 0 }, tainted), null, '디코드 실패(크기 0)')
  assert.equal(groundOf(ok, () => ({ getContext: () => null })), null, '2D 컨텍스트 없음')
  assert.equal(groundOf(ok, () => { throw new Error('no canvas') }), null, '캔버스를 못 만듦')
  const drawFails = () => ({ getContext: () => ({ drawImage() { throw new Error('broken image') }, getImageData() { return { data: new Uint8ClampedArray(4) } } }) })
  assert.equal(groundOf(ok, drawFails), null, '그리기 실패')
})

test('세 모드(model · parallax · poster)가 같은 바탕 변수 --o3-ground 를 쓴다 — 무대와 빈 포스터 칸 모두 var(--o3-ground, var(--muted))', () => {
  const css = read('registry/factory/styles/base.css')
  const hook = (name) => css.match(new RegExp(`\\.${name} \\{\\s*@apply ([^;]*);`))?.[1] ?? ''
  const GROUND = 'var(--o3-ground,var(--muted))'
  const stage = hook('cn-block-hero-object-3d-orbit-stage')
  assert.ok(stage.includes(`[background-color:${GROUND}]`), `무대 바탕이 ${GROUND}`)
  assert.doesNotMatch(stage, /\bbg-muted\b/, '변수 없는 bg-muted 가 남지 않았다')
  const fallback = hook('cn-block-hero-object-3d-orbit-fallback')
  assert.ok(fallback.includes(`[background-color:${GROUND}]`), '포스터 없는 모드의 빈 칸도 같은 변수')
  assert.doesNotMatch(fallback, /\bbg-muted\b/)
  assert.ok(stage.includes('motion-safe:[transition:background-color_var(--duration-enter)_var(--ease-standard)]'), '바탕색 전환(동작 줄이기면 즉시 — motion-safe 만)')
  const src = read('registry/factory/blocks/hero/object-3d-orbit.tsx')
  const call = src.match(/useEdgeGround\(/)
  assert.ok(call, 'useEdgeGround 를 부른다')
  // 읽기는 모드 갈래(if (mode === "model")) 밖, 컴포넌트 본문에서 불린다 — 세 모드 공통
  assert.equal((src.slice(0, call.index).match(/if \(mode === "model"/g) ?? []).length, 0, '모드 갈래 밖')
  assert.match(read('registry/factory/blocks/_shared/edge-ground.tsx'), /--o3-ground/)
})

test('첫 칠 계약: 색 읽기는 한가할 때 · three 는 동적 import 만 · 실패하면 변수를 걷는다', () => {
  const g = read('registry/factory/blocks/_shared/edge-ground.tsx')
  assert.match(g, /requestIdleCallback/, '한가할 때')
  assert.match(g, /removeProperty\(/, '실패·정리 때 변수를 걷는다')
  assert.match(g, /setProperty\(/)
  assert.doesNotMatch(g, /^import[^\n]*from ["']three/m)
  const src = read('registry/factory/blocks/hero/object-3d-orbit.tsx')
  assert.doesNotMatch(src, /^import[^\n]*from ["']three/m)
  assert.match(src, /await import\("three"\)/)
})
