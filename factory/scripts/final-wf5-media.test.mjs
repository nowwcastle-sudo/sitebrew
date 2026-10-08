// FINAL-WF5 항목 4-9 — _shared/hero-media 의 빈 그림 칸(src 가 빈 슬롯)에 「실제 사진 필요」/"Real photo needed" 표지(_shared/product-thumb 와 같은 렌더·로캘 표).
// 실행: node --test --test-force-exit --test-timeout=120000 factory/scripts/final-wf5-media.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = join(root, '.tmp', 'final-wf5-media-test')
const loaded = new Map()
const resolveSource = (base) => [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts')].find((f) => existsSync(f) && /\.(mjs|tsx?)$/.test(f))
function transpile(abs) {
  if (abs.endsWith('.mjs')) return abs
  if (loaded.has(abs)) return loaded.get(abs)
  const out = join(OUT, relative(root, abs).replace(/\.tsx?$/, '.mjs'))
  loaded.set(abs, out)
  let text = ts.transpileModule(readFileSync(abs, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
  text = text.replace(/(from\s+|import\s*\(\s*|import\s+|export\s+\*\s+from\s+)(["'])(@\/|\.{1,2}\/)([^"']+)\2/g, (_, kw, q, pre, p) => {
    const base = pre === '@/' ? join(root, p) : resolve(dirname(abs), pre + p)
    const src = resolveSource(base)
    if (!src) throw new Error(`import 대상 없음: ${pre}${p} (${relative(root, abs)})`)
    return `${kw}${q}${pathToFileURL(transpile(src)).href}${q}`
  })
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, text)
  return out
}
const React = await import('react')
const { renderToStaticMarkup } = await import('react-dom/server')
const { MediaImage, MediaVideo, MediaEmpty } = await import(pathToFileURL(transpile(join(root, 'registry', 'factory', 'blocks', '_shared', 'hero-media.tsx'))).href)
const h = React.createElement
const html = (el) => renderToStaticMarkup(el)

const EMPTY = { src: '', srcSet: '', alt: '지점 외관', width: 1600, height: 900, source: 'real-required' }
const FULL = { src: '/a.webp', srcSet: '/a.webp 1x', alt: '지점 외관', width: 1600, height: 900 }

test('MediaImage: src 가 빈 슬롯은 깨진 <img> 가 아니라 비율을 지킨 판에 「실제 사진 필요」(ko 기본)', () => {
  const s = html(h(MediaImage, { m: EMPTY, sizes: '100vw' }))
  assert.doesNotMatch(s, /<img/)
  assert.match(s, /role="img"/)
  assert.match(s, /aria-label="지점 외관 — 실제 사진 필요"/)
  assert.match(s, /data-photo-needed/)
  assert.match(s, /aspect-ratio:1600 \/ 900/)
  assert.match(s, /cn-block-media-empty/)
})

test('MediaImage: locale en 은 "Real photo needed" — 글자는 blockLabels 표에서', () => {
  const s = html(h(MediaImage, { m: EMPTY, sizes: '100vw', locale: 'en' }))
  assert.match(s, /Real photo needed/)
  assert.doesNotMatch(s, /실제 사진 필요/)
})

test('MediaImage·MediaVideo: 그림이 있으면 예전 그대로(<img>, 표지 없음) — 양성 대조', () => {
  const s = html(h(MediaImage, { m: FULL, sizes: '100vw' }))
  assert.match(s, /<img/)
  assert.doesNotMatch(s, /data-photo-needed/)
  const v = html(h(MediaVideo, { m: { kind: 'video', mp4: '/a.mp4', alt: '영상', poster: FULL, width: 1600, height: 900, loop: true }, sizes: '100vw' }))
  assert.match(v, /<video/)
  assert.doesNotMatch(v, /data-photo-needed/)
})

test('MediaVideo: 포스터가 빈 슬롯이면 포스터 자리에 표지(영상만 있고 그림이 없는 칸이 회색 판으로 남지 않는다)', () => {
  const v = html(h(MediaVideo, { m: { kind: 'video', mp4: '/a.mp4', alt: '영상', poster: EMPTY, width: 1600, height: 900, loop: true }, sizes: '100vw', locale: 'en' }))
  assert.match(v, /Real photo needed/)
})

test('MediaEmpty: alt 가 없으면 표지 글이 이름', () => {
  assert.match(html(h(MediaEmpty, {})), /aria-label="실제 사진 필요"/)
})

test('히어로: 그림 칸을 그리는 모든 히어로가 locale 을 MediaImage·Media·MediaVideo 에 넘긴다', () => {
  const dir = join(root, 'registry', 'factory', 'blocks', 'hero')
  const bad = []
  let checked = 0
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.tsx'))) {
    const s = readFileSync(join(dir, f), 'utf8')
    for (const m of s.matchAll(/<(Media|MediaImage|MediaVideo)\b[^>]*?\bm=/g)) { checked++; if (!/locale=\{locale\}/.test(m[0])) bad.push(`${f}: ${m[0]}`) }
  }
  assert.ok(checked >= 17, `${checked}`)
  assert.deepEqual(bad, [])
})
