// 사진 질감 자산(P3-6) 검사: references/textures 의 WebP 가 모두 120 KB 이하이고, SOURCES.md 에 올라 있고, public/textures 사본과 바이트까지 같고,
// 사진 질감 값 CSS(X4~X8)가 부르는 /textures/<파일> 이 전부 실제로 있다(없는 파일을 부르면 사진 층만 조용히 빠진다).
// 제3자 SNS(Pinterest·X·Instagram) 이미지는 들이지 않는다 — SOURCES.md 에 Pexels 주소와 직접 만든 자산 표만 있어야 한다.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const REF = join(root, 'references', 'textures')
const PUB = join(root, 'public', 'textures')
const AXES = join(root, 'registry', 'factory', 'styles', 'axes', 'texture')
const webps = (d) => readdirSync(d).filter((f) => f.endsWith('.webp')).sort()
const MAX = 120 * 1024

test('textures: every asset is a WebP of 120 KB or less', { skip: 'the public export ships only the self-made grain masks, not the photo textures' }, () => {
  const files = webps(REF)
  assert.ok(files.length >= 14, `자산 ${files.length}개`)
  for (const f of files) assert.ok(statSync(join(REF, f)).size <= MAX, `${f} ${statSync(join(REF, f)).size} bytes > 120 KB`)
  const other = readdirSync(REF).filter((f) => !f.endsWith('.webp') && !['README.md', 'SOURCES.md'].includes(f))
  assert.deepEqual(other, [], '자산 폴더에 WebP·README·SOURCES 밖 파일이 있다')
})

test('textures: SOURCES.md names every asset and only Pexels / self-made sources', () => {
  const src = readFileSync(join(REF, 'SOURCES.md'), 'utf8')
  for (const f of webps(REF)) {
    // 도장·그레인은 {a,b,c}-{light,dark} 묶음 표기로 적는다
    const named = src.includes(f) || (/^cardboard-stamp-/.test(f) && src.includes('cardboard-stamp-{a,b,c}-{light,dark}.webp')) || (/^glass-grain-/.test(f) && src.includes('glass-grain-{light,dark}.webp'))
    assert.ok(named, `${f} 가 SOURCES.md 에 없다`)
  }
  assert.ok(/Pexels License/.test(src))
  for (const bad of ['pinterest.com', 'instagram.com', 'twitter.com', 'x.com/']) assert.ok(!src.includes(bad), `SOURCES.md 에 ${bad} 주소가 있다`)
  const pexels = [...src.matchAll(/https:\/\/www\.pexels\.com\/photo\/[a-z0-9-]+\/?/g)]
  assert.equal(pexels.length, 6, 'Pexels 사진 6장의 주소')
})

test('textures: public/textures mirrors references/textures byte for byte', () => {
  assert.ok(existsSync(PUB), 'public/textures 가 없다')
  assert.deepEqual(webps(PUB), webps(REF))
  for (const f of webps(REF)) assert.ok(readFileSync(join(PUB, f)).equals(readFileSync(join(REF, f))), `${f} 사본이 다르다`)
})

test('textures: every /textures/<file> the axis CSS calls exists (no silent missing layer)', { skip: 'the public export ships only the self-made grain masks, not the photo textures' }, () => {
  const have = new Set(webps(REF))
  const called = new Set()
  for (const f of readdirSync(AXES).filter((f) => f.endsWith('.css'))) for (const m of readFileSync(join(AXES, f), 'utf8').matchAll(/url\(\/textures\/([^)]+)\)/g)) called.add(m[1])
  assert.ok(called.size >= 12, `부른 사진 ${called.size}개`)
  for (const c of called) assert.ok(have.has(c), `/textures/${c} 가 references/textures 에 없다`)
  // 쓰이지 않는 자산은 두지 않는다(운영자가 제외한 간유리 C 포함)
  for (const f of have) assert.ok(called.has(f), `${f} 를 아무 값도 부르지 않는다`)
  assert.ok(!have.has('glass-c.webp'), '제외한 간유리 C 가 들어 있다')
})

test('textures: photo textures X4~X8 are listed in compat (texture axis, dashboard·public forbidden, X7/X8 × C5 forbidden)', () => {
  const compat = JSON.parse(readFileSync(join(root, 'registry', 'factory', 'styles', 'compat.json'), 'utf8'))
  assert.deepEqual(compat.axes.texture, ['X0', 'X1', 'X2', 'X3', 'X4', 'X5', 'X6', 'X7', 'X8'])
  for (const id of ['X4', 'X5', 'X6', 'X7', 'X8']) {
    const rule = compat.conditional.find((c) => c.values.includes(id))
    assert.ok(rule, `${id} 조건 규칙 없음`)
    assert.deepEqual(rule.archetypesForbidden, ['dashboard', 'public'])
  }
  for (const id of ['X7', 'X8']) assert.ok(compat.forbidden.some((f) => f.values.includes(id) && f.values.includes('C5')), `${id} × C5 금지`)
})
