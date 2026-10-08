import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative, sep } from 'node:path'
import { lintDir, lintSrcDir, lintSource, motionCovered, recipeUiDirs } from './lint-ui.mjs'
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'

const here = dirname(fileURLToPath(import.meta.url))
const fx = (d) => join(here, 'fixtures', 'lint', d)
const run = (args) => new Promise((res) => { const p = spawn(process.execPath, args, { stdio: 'ignore' }); p.on('exit', (c) => res(c)) })

test('lint-ui flags every rule on the bad fixture', () => {
  const { fails, warns } = lintDir(fx('bad'))
  const rules = fails.map((f) => f.rule)
  for (const r of ['ring-1', 'ring-alpha', 'invalid-focus', 'invalid-focus-dark', 'small-text', 'transition-all', 'group-hit']) assert.ok(rules.includes(r), `missing ${r}: ${rules.join(',')}`)
  assert.equal(rules.filter((r) => r === 'ring-alpha').length, 2)
  assert.equal(rules.filter((r) => r === 'small-text').length, 2)
  assert.deepEqual(warns.map((w) => w.rule), ['motion'])
})

test('lint-ui passes the good fixture', () => {
  const { files, fails, warns } = lintDir(fx('good'))
  assert.equal(files, 1)
  assert.deepEqual(fails, [])
  assert.deepEqual(warns, [])
})

test('a global reduced-motion rule silences the animate-* warning', () => {
  assert.deepEqual(lintDir(fx('bad'), { motionCoveredGlobally: true }).warns, [])
  assert.equal(motionCovered('@layer base { @media (prefers-reduced-motion: reduce) { * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } } }'), true)
  assert.equal(motionCovered('@layer base { body { color: red } }'), false)
})

test('shape-outside-hook: inline shape classes in ui-src fail, hooks-only source passes', () => {
  const bad = lintSrcDir(fx('src-bad'))
  assert.deepEqual(bad.fails.map((f) => f.hit), ['rounded-xl', 'h-8', 'px-3'])
  assert.ok(bad.fails.every((f) => f.rule === 'shape-outside-hook'))
  assert.deepEqual(lintSrcDir(fx('src-good')).fails, [])
})

test('icon-label: literal, quoted-expression and variable size="icon*" forms without a name fail; named, non-icon and data-size pass (T9-M4)', () => {
  const r = lintSrcDir(fx('src-icon-label'))
  assert.deepEqual(r.fails.map((f) => [f.rule, f.at]), [3, 4, 5, 6, 7].map((n) => ['icon-label', `buttons.tsx:${n}`]))
})

test('generated-marker: a generated folder needs GENERATED.md and no hand-edit banner in its files', () => {
  assert.deepEqual(lintDir(fx('good'), { generated: true }).fails.map((f) => f.rule), ['generated-marker'])   // 표지 없음
  assert.deepEqual(lintDir(fx('generated-banner'), { generated: true }).fails.map((f) => [f.rule, f.at]), [['generated-marker', 'button.tsx:1']])
  assert.deepEqual(lintDir(fx('generated-good'), { generated: true }).fails, [])
})

test('duplicate-hook: a hook reused across cva slots in one file fails', () => {
  assert.deepEqual(lintSrcDir(fx('src-dup')).fails.map((f) => [f.rule, f.hit]), [['duplicate-hook', 'cn-x']])
})

test('lint-ui CLI: exit 1 on the bad fixture, exit 0 on the real ui tree', async () => {
  assert.equal(await run([join(here, 'lint-ui.mjs'), fx('bad')]), 1)
  assert.equal(await run([join(here, 'lint-ui.mjs')]), 0)
})

test('lint-ui CLI: source rules run on the --src path, whatever the folder is called', async () => {
  assert.equal(await run([join(here, 'lint-ui.mjs'), '--src', fx('src-bad')]), 1)
  assert.equal(await run([join(here, 'lint-ui.mjs'), '--src', fx('src-dup')]), 1)
  assert.equal(await run([join(here, 'lint-ui.mjs'), '--src', fx('src-good')]), 0)
  assert.equal(await run([join(here, 'lint-ui.mjs'), fx('generated-good'), '--src', fx('src-good')]), 0)
})

test('small-text: arbitrary px/rem sizes under 14px fail, 14px and up pass (recipes must not ship text below 14px)', () => {
  const hits = (cls) => lintSource('x.tsx', `const a = cn("${cls}")`).fails.filter((f) => f.rule === 'small-text').map((f) => f.hit)
  assert.deepEqual(hits('text-[13px]'), ['text-[13px]'])
  assert.deepEqual(hits('md:text-[0.8rem]'), ['text-[0.8rem]'])
  assert.deepEqual(hits('text-[14px] text-[15.5px] text-sm'), [])
})

test('recipeUiDirs lists every compiled recipe folder r/<id>/ui (the CLI default lints them all)', () => {
  const f = mkdtempSync(join(tmpdir(), 'wf-lint-'))
  try {
    for (const d of ['r/a/ui', 'r/b/ui', 'r/c']) mkdirSync(join(f, d), { recursive: true })
    assert.deepEqual(recipeUiDirs(f).map((d) => relative(f, d).split(sep).join('/')), ['r/a/ui', 'r/b/ui'])
    assert.deepEqual(recipeUiDirs(join(f, 'nope')), [])
  } finally { rmSync(f, { recursive: true, force: true }) }
})

test('fixed-duration (P3-2 Task 2): a fixed duration-<n> in part source fails; 0, token and arbitrary durations pass; the real ui-src has none', async () => {
  const { fixedDurationProblems } = await import('./lint-ui.mjs')
  const hits = (cls) => fixedDurationProblems(`const a = cn("${cls}")`).map((p) => p.hit)
  assert.deepEqual(hits('transition-colors duration-100 hover:bg-muted'), ['duration-100'])
  assert.deepEqual(hits('data-[active=false]:duration-400 duration-1000'), ['data-[active=false]:duration-400', 'duration-1000'])
  assert.deepEqual(hits('duration-0 data-swiping:duration-0 duration-(--duration-hover,200ms) duration-[calc(var(--x)*400ms)] animation-duration-300'), [])
  const real = lintSrcDir(join(here, '..', '..', 'registry', 'factory', 'ui-src'))
  assert.deepEqual(real.fails.filter((f) => f.rule === 'fixed-duration'), [])
  assert.ok(real.files > 60)
})
