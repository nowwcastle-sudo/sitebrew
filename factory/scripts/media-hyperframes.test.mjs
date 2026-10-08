// hyperframes 연결(GUIDE S9) — 브리프 사실 → rows.json 변환기 · 렌더 래퍼(init 없음·lint→check→render 순서·실패 시 렌더 안 함) · 글자 없는 켄 번스 템플릿.
// 실제 렌더는 하지 않는다(exec 주입). 실행: node --test --test-force-exit --test-timeout=60000 factory/scripts/media-hyperframes.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseVariables, rowsFromBriefs, TEMPLATE_SPECS, factValue } from '../media/hf-rows.mjs'
import { HF_VERSION, hfArgs, renderArgs, prepareWork, renderTemplate, hyperframesAvailable, readTemplateInfo, TEMPLATES_DIR } from '../media/render-hyperframes.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const POSTER_HTML = readFileSync(join(ROOT, 'references/motion/hyperframes/examples/kinetic-name-poster-loop/index.html'), 'utf8')
const VARS = parseVariables(POSTER_HTML)
const SPEC = TEMPLATE_SPECS['kinetic-name-poster-loop']
const briefFacts = () => {
  const dir = join(ROOT, 'factory/stamp/briefs')
  return readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')).facts)
}

test('rows: variable declarations are read from the template html (id, maxLength)', () => {
  const byId = Object.fromEntries(VARS.map((v) => [v.id, v]))
  for (const id of ['name', 'store_name', 'tagline', 'detail']) assert.ok(byId[id], id)
  assert.equal(typeof byId.store_name.maxLength, 'number')
  assert.deepEqual(parseVariables('<html>no variables</html>'), [])
})

test('rows: every fact key in a template spec is a real brief fact key, and every mapped variable is declared by the template', () => {
  const known = new Set(briefFacts().flatMap((f) => Object.keys(f)))
  const declared = new Set(VARS.map((v) => v.id))
  for (const [tpl, spec] of Object.entries(TEMPLATE_SPECS)) {
    for (const [variable, expr] of Object.entries(spec.map)) {
      assert.ok(declared.has(variable), `${tpl}: ${variable} not declared`)
      for (const k of expr.split('+')) assert.ok(known.has(k), `${tpl}: fact key ${k} appears in no brief`)
    }
  }
})

test('rows: complete facts become a row with the output name; the template defaults never leak into a row', () => {
  const facts = { name: '하늘 치과', claim: '아프지 않게, 정확하게', address: '성남 분당구', hours: '평일 09:00-18:00' }
  const { rows, flagged } = rowsFromBriefs([{ id: 'clinic', facts }], SPEC, VARS)
  assert.deepEqual(flagged, [])
  assert.deepEqual(rows, [{ name: 'clinic', store_name: '하늘 치과', tagline: '아프지 않게, 정확하게', detail: '성남 분당구 · 평일 09:00-18:00' }])
  const withColor = rowsFromBriefs([{ id: 'clinic', facts }], SPEC, VARS, { extra: { accent: '#6fd3c6' } })
  assert.equal(withColor.rows[0].accent, '#6fd3c6')
  assert.throws(() => rowsFromBriefs([], SPEC, VARS, { extra: { nope: 'x' } }), /선언되지 않은 변수/)
  assert.throws(() => rowsFromBriefs([], { map: { missing_var: 'name' } }, VARS), /선언되지 않은 변수/)
  assert.throws(() => rowsFromBriefs([], SPEC, VARS.filter((v) => v.id !== 'name')), /name 변수/)
})

test('rows: empty and whitespace-only facts flag the row (no row, no default); one empty piece of a joined fact is enough', () => {
  const full = { name: 'A', claim: 'B', address: 'C', hours: 'D' }
  const cases = [
    ['empty name', { ...full, name: '' }, 'store_name'],
    ['spaces only', { ...full, claim: '   ' }, 'tagline'],
    ['missing hours', { name: 'A', claim: 'B', address: 'C' }, 'detail'],
  ]
  for (const [label, facts, variable] of cases) {
    const { rows, flagged } = rowsFromBriefs([{ id: 'x', facts }], SPEC, VARS)
    assert.deepEqual(rows, [], label)
    assert.deepEqual(flagged.map((f) => [f.id, f.variable, f.reason]), [['x', variable, 'empty']], label)
  }
  assert.equal(factValue({ a: ' x ', b: '' }, 'a+b'), null)
})

test('rows: text longer than maxLength is flagged (not truncated) and only that row is dropped', () => {
  const max = VARS.find((v) => v.id === 'store_name').maxLength
  const ok = { name: '짧은 이름', claim: '한 줄', address: '주소', hours: '시간' }
  const long = { ...ok, name: '가'.repeat(max + 1) }
  const { rows, flagged } = rowsFromBriefs([{ id: 'ok', facts: ok }, { id: 'long', facts: long }], SPEC, VARS)
  assert.deepEqual(rows.map((r) => r.name), ['ok'])
  assert.deepEqual(flagged, [{ id: 'long', variable: 'store_name', fact: 'name', reason: 'overflow', length: max + 1, max }])
  const exact = rowsFromBriefs([{ id: 'exact', facts: { ...ok, name: '가'.repeat(max) } }], SPEC, VARS)
  assert.equal(exact.rows.length, 1, 'exactly maxLength passes')
})

test('wrapper: render args pin the version, quality looks and one worker; batch needs strict variables; no init anywhere', () => {
  assert.deepEqual(hfArgs('lint').slice(0, 3), ['--yes', `hyperframes@${HF_VERSION}`, 'lint'])
  const one = renderArgs({ output: '/o/x.mp4' })
  assert.deepEqual(one.slice(2, 3), ['render'])
  assert.equal(one[one.indexOf('--workers') + 1], '1')
  assert.equal(one[one.indexOf('--quality') + 1], 'looks')
  assert.equal(one.includes('--strict-variables'), false, 'single render without variables')
  const vars = renderArgs({ output: 'o.mp4', variables: { a: 'b' } })
  assert.ok(vars.includes('--strict-variables') && vars.includes('--variables'))
  const batch = renderArgs({ output: 'renders/{name}.mp4', rows: 'rows.json' })
  for (const f of ['--batch', '--strict-variables', '--batch-concurrency']) assert.ok(batch.includes(f), f)
  assert.throws(() => renderArgs({}), /output/)
  const src = readFileSync(join(ROOT, 'factory/media/render-hyperframes.mjs'), 'utf8')
  assert.equal(/hfArgs\(\s*['"]init['"]/.test(src), false, 'the wrapper never calls hyperframes init')
})

test('wrapper: prepareWork copies the template folder and numbers the inputs; wrong input count and missing files throw', () => {
  const tdir = mkdtempSync(join(tmpdir(), 'hf-t-'))
  mkdirSync(join(tdir, 'demo'))
  writeFileSync(join(tdir, 'demo', 'index.html'), '<html></html>')
  writeFileSync(join(tdir, 'demo', 'wf-template.json'), JSON.stringify({ inputs: 2 }))
  const a = join(tdir, 'a.jpg'), b = join(tdir, 'b.jpg')
  writeFileSync(a, 'A'); writeFileSync(b, 'B')
  const work = join(tdir, 'work')
  prepareWork({ template: 'demo', workDir: work, inputs: [a, b], templatesDir: tdir })
  assert.equal(readFileSync(join(work, 'assets', 's1.jpg'), 'utf8'), 'A')
  assert.equal(readFileSync(join(work, 'assets', 's2.jpg'), 'utf8'), 'B')
  assert.ok(existsSync(join(work, 'index.html')))
  assert.throws(() => prepareWork({ template: 'demo', workDir: work, inputs: [a], templatesDir: tdir }), /2장이 필요/)
  assert.throws(() => prepareWork({ template: 'demo', workDir: work, inputs: [a, join(tdir, 'none.jpg')], templatesDir: tdir }), /입력 사진이 없다/)
  assert.throws(() => readTemplateInfo('nope', tdir), /템플릿이 없다/)
  assert.throws(() => readTemplateInfo('../x', tdir), /소문자/)
})

test('wrapper: renderTemplate runs lint, check, then render in that order; a failed gate stops before render', () => {
  const tdir = mkdtempSync(join(tmpdir(), 'hf-t-'))
  mkdirSync(join(tdir, 'demo'))
  writeFileSync(join(tdir, 'demo', 'index.html'), '<html></html>')
  const out = join(tdir, 'out', 'v.mp4')
  const calls = []
  const exec = (cmd, args) => {
    calls.push(args[2])
    if (args[2] === 'render') { mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, 'mp4') }
    return { status: 0, stdout: '', stderr: '' }
  }
  const r = renderTemplate({ template: 'demo', out, exec, templatesDir: tdir, workDir: join(tdir, 'w1') })
  assert.deepEqual(calls, ['lint', 'check', 'render'])
  assert.equal(r.out, out)
  const calls2 = []
  const failing = (cmd, args) => { calls2.push(args[2]); return args[2] === 'check' ? { status: 1, stdout: '', stderr: 'text_box_overflow' } : { status: 0, stdout: '', stderr: '' } }
  assert.throws(() => renderTemplate({ template: 'demo', out: join(tdir, 'o2.mp4'), exec: failing, templatesDir: tdir, workDir: join(tdir, 'w2') }), /hyperframes check 종료 1.*text_box_overflow/)
  assert.deepEqual(calls2, ['lint', 'check'], 'render was never called')
  const silent = () => ({ status: 0, stdout: '', stderr: '' })
  assert.throws(() => renderTemplate({ template: 'demo', out: join(tdir, 'o3.mp4'), exec: silent, check: false, templatesDir: tdir, workDir: join(tdir, 'w3') }), /렌더 출력이 없다/, 'exit 0 without a file is not a success')
})

test('wrapper: rendering in the 05 stage is opt-in (WF_HYPERFRAMES=1) and needs npx', () => {
  const ok = () => ({ status: 0 }), no = () => ({ status: 1 })
  assert.equal(hyperframesAvailable({ env: {}, exec: ok }), false)
  assert.equal(hyperframesAvailable({ env: { WF_HYPERFRAMES: '0' }, exec: ok }), false)
  assert.equal(hyperframesAvailable({ env: { WF_HYPERFRAMES: '1' }, exec: ok }), true)
  assert.equal(hyperframesAvailable({ env: { WF_HYPERFRAMES: '1' }, exec: no }), false)
})

test('template ken-burns-stills: no text baked in, 4 numbered stills, local gsap, every late fromTo is immediateRender:false (poster = finished pose)', () => {
  const dir = join(TEMPLATES_DIR, 'ken-burns-stills')
  const html = readFileSync(join(dir, 'index.html'), 'utf8')
  const info = JSON.parse(readFileSync(join(dir, 'wf-template.json'), 'utf8'))
  const body = html.slice(html.indexOf('<body>'), html.indexOf('</body>')).replace(/<script[\s\S]*?<\/script>/g, '')
  assert.equal(body.replace(/<[^>]*>/g, '').trim(), '', 'no visible text nodes in the hero background render')
  assert.equal(info.textBaked, false)
  assert.equal(info.inputs, 4)
  for (let i = 1; i <= info.inputs; i++) assert.ok(html.includes(`src="assets/s${i}.jpg"`), `s${i}`)
  assert.ok(html.includes('src="assets/gsap.min.js"') && !/https?:\/\//.test(html.replace(/<!--[\s\S]*?-->/g, '').replace(/xmlns="[^"]*"/g, '')), 'no network at render time')
  const tweens = html.match(/\.fromTo\([^;]*\);/g) ?? []
  assert.ok(tweens.length >= 7)
  for (const t of tweens) assert.ok(t.includes('immediateRender: false'), t.slice(0, 40))
  assert.match(html, /data-duration="8" data-width="1920" data-height="1080"/)
  for (const f of ['hyperframes.json', 'meta.json']) assert.ok(existsSync(join(dir, f)), f)
})
