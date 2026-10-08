import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { loadStyleMap, compileSource, compileDir, MARKER } from './compile-styles.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const script = join(here, 'compile-styles.mjs')
const fx = new URL('./fixtures/styles/', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')

const run = (args, cwd) => new Promise((resolve) => {
  const p = spawn(process.execPath, [script, ...args], { cwd, stdio: 'ignore' })
  p.on('exit', (code) => resolve(code))
})

test('later css overrides earlier keys', async () => {
  const m = await loadStyleMap([join(fx, 'a.css'), join(fx, 'b.css')])
  assert.equal(m['cn-button'], 'rounded-none h-11')          // b.css 값
  assert.equal(m['cn-card'], 'rounded-xl p-6')               // a.css 에만 있음
})

test('replaces hooks, drops unmapped hooks, keeps rule classes', async () => {
  const out = await compileSource(readFileSync(join(fx, 'comp.tsx'), 'utf8'), { 'cn-button': 'rounded-none h-11' })
  assert.doesNotMatch(out, /생성물|손으로 고치지 않는다/)     // 부품 파일에는 머리줄이 없다(설치본으로 따라간다)
  assert.match(out, /rounded-none h-11/)
  assert.doesNotMatch(out, /cn-button|cn-card/)
  assert.match(out, /focus-visible:ring-3/)                  // 규칙 클래스는 그대로
  assert.match(out, /after:inset-y-\[min\(0px,calc\(\(100%-44px\)\/2\)\)\]/)
})

test('compileDir writes every file and removes stale outputs', async () => {
  const out = mkdtempSync(join(tmpdir(), 'cs-'))
  writeFileSync(join(out, 'stale.tsx'), '//old')
  const r = await compileDir(fx, out, { 'cn-button': 'h-11' })
  assert.equal(r.files, 1)
  assert.ok(existsSync(join(out, 'comp.tsx')))
  assert.ok(!existsSync(join(out, 'stale.tsx')))
  // 생성물 표지는 폴더에 한 장: 생성기와 원천 폴더를 적는다.
  const marker = readFileSync(join(out, MARKER), 'utf8')
  assert.match(marker, /^생성물 — factory\/scripts\/compile-styles\.mjs 로 다시 만든다\. 손으로 고치지 않는다\. 원천: /)
  assert.ok(marker.includes(fx.split('\\').join('/').replace(/\/$/, '')), marker)
  assert.doesNotMatch(readFileSync(join(out, 'comp.tsx'), 'utf8'), /손으로 고치지 않는다/)
})

test('CLI exits 2 and creates no stray directory when --out is missing', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'cs-cli-'))
  const code = await run(['--src', fx, '--css', join(fx, 'a.css')], cwd)
  assert.equal(code, 2)
  assert.deepEqual(readdirSync(cwd), [])
})

test('CLI exits 2 and creates no stray directory when --src is missing', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'cs-cli-'))
  const outDir = join(cwd, 'out')
  const code = await run(['--out', outDir, '--css', join(fx, 'a.css')], cwd)
  assert.equal(code, 2)
  assert.deepEqual(readdirSync(cwd), [])
})

test('CLI exits 2 and creates no stray directory when --css is the last argument with no value (Task 13a 12a)', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'cs-cli-'))
  assert.equal(await run(['--src', fx, '--out', join(cwd, 'out'), '--css'], cwd), 2)
  assert.equal(await run(['--src', fx, '--out', join(cwd, 'out'), '--css', '--src'], cwd), 2)
  assert.deepEqual(readdirSync(cwd), [])
})

test('CLI exits 2 and creates no stray directory when --css is missing', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'cs-cli-'))
  const outDir = join(cwd, 'out')
  const code = await run(['--src', fx, '--out', outDir], cwd)
  assert.equal(code, 2)
  assert.deepEqual(readdirSync(cwd), [])
})
