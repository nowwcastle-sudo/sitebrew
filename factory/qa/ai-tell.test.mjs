// AI 티 점수 관문(Task 12) — 헤드리스 Chrome 으로 fixture 를 렌더해 잰다. 한 번 렌더에 몇 초가 걸린다.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { CHECKS, SKIPPED, KAS_MAP, cssChecks, exempt, loadBanlist, loadExceptions, annotateLines, kasScanPath, scoreDistribution, URL_INACTIVE, DATA } from './ai-tell.mjs'
import { LINE_VALUES } from '../scripts/recipe.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const ROOT = join(here, '..', '..')
const TOOL = join(here, 'ai-tell.mjs')
const fx = (f) => join(here, 'fixtures', f)
const tmp = () => mkdtempSync(join(tmpdir(), 'ai-tell-t-'))
// 기본은 kill-ai-slop 없이(설치본 버전에 스위트가 묶이지 않게, 리뷰 M12) — kas 를 넣는 테스트만 KAS 로
const NO_KAS = { AI_TELL_KAS_SCAN: join(tmpdir(), 'ai-tell-no-such-scan.mjs') }
const KAS = { AI_TELL_KAS_SCAN: '' }
const run = (args, env = NO_KAS) => new Promise((res) => {
  const p = spawn(process.execPath, [TOOL, ...args], { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...env } })
  let out = ''
  p.stdout.on('data', (d) => { out += d }); p.stderr.on('data', (d) => { out += d })
  p.on('exit', (code) => res({ code, out }))
})
const report = (dir) => JSON.parse(readFileSync(join(dir, 'ai-tell.json'), 'utf8'))
const ids = (r) => r.hits.map((h) => h.id)
const page = (body, css = '') => `<!DOCTYPE html>\n<html lang="ko">\n<head>\n<meta charset="utf-8" />\n<title>예시</title>\n<style>\n${css}\n</style>\n</head>\n<body>\n<main>\n<h1>예시 가게의 이번 주 소식</h1>\n${body}\n</main>\n</body>\n</html>\n`

test('slop fixture: at least 5 checks hit, including the five named tells, each with a findable file:line', async () => {
  const out = tmp()
  const { code, out: log } = await run([fx('slop.html'), '--out', out])
  assert.equal(code, 0, log)
  const r = report(out)
  assert.ok(r.hits.length >= 5, ids(r).join(' '))
  // 보라 그라디언트 제목 · 이모지 불릿 · 01/02/03 · 글로우 · em dash 버튼
  for (const id of ['G093', 'G129', 'G132', 'G139', 'G094', 'G010']) assert.ok(ids(r).includes(id), `${id} 없음: ${ids(r).join(' ')}`)
  for (const h of r.hits.filter((x) => x.id.startsWith('G') && !['G025', 'G029', 'G126'].includes(x.id))) assert.match(h.where, /^factory\/qa\/fixtures\/slop\.html:\d+ /, `${h.id}: ${h.where}`)
  const em = r.hits.find((h) => h.id === 'G010')
  const line = readFileSync(fx('slop.html'), 'utf8').split(/\r?\n/).findIndex((l) => l.includes('지금 시작 — 무료')) + 1
  assert.ok(em.where.startsWith(`factory/qa/fixtures/slop.html:${line} `), em.where)
  assert.equal(r.score, r.hits.filter((h) => h.id.startsWith('G')).reduce((n, h) => n + h.weight, 0))
  assert.equal(r.scoreG, r.score); assert.equal(r.maxG, r.max); assert.equal(r.maxKas, 0)
  assert.ok(r.max >= r.score)
  assert.deepEqual(r.inactive, [])
})

test('clean fixture: zero hits and score 0', async () => {
  const out = tmp()
  const { code, out: log } = await run([fx('clean.html'), '--out', out])
  assert.equal(code, 0, log)
  const r = report(out)
  assert.deepEqual(ids(r), [], JSON.stringify(r.hits, null, 1))
  assert.equal(r.score, 0)
})

test('E12 overshoot curve is waived with its DESIGN reference; any other overshoot on a state element still hits (positive control)', async () => {
  const out = tmp()
  assert.equal((await run([fx('ai-tell-overshoot.html'), '--out', out], existsSync(kasScanPath()) ? KAS : NO_KAS)).code, 0)
  const r = report(out)
  assert.ok(!ids(r).includes('G118') && !ids(r).includes('kas-26'), ids(r).join(' '))
  assert.ok(r.waived.some((w) => w.id === 'G118' && w.exception === 'overshoot-curve'))
  const dir = tmp(), f = join(dir, 'other-curve.html')
  writeFileSync(f, readFileSync(fx('ai-tell-overshoot.html'), 'utf8').replace('cubic-bezier(0.34, 1.56, 0.64, 1)', 'cubic-bezier(0.5, 1.8, 0.5, 1)'))
  const out2 = tmp()
  assert.equal((await run([f, '--out', out2, '--no-kas'])).code, 0)
  assert.ok(ids(report(out2)).includes('G118'), ids(report(out2)).join(' '))
})

test('block mode exits 3 over the threshold, warn never does; both give the same deterministic hits', async () => {
  const warn = tmp(), block = tmp(), clean = tmp()
  assert.equal((await run([fx('slop.html'), '--out', warn, '--mode', 'warn', '--threshold', '0'])).code, 0)
  assert.equal((await run([fx('slop.html'), '--out', block, '--mode', 'block', '--threshold', '0'])).code, 3)
  assert.equal((await run([fx('clean.html'), '--out', clean, '--mode', 'block', '--threshold', '0'])).code, 0)
  const a = report(warn), b = report(block)
  assert.equal(a.over, true)
  assert.deepEqual(b.hits, a.hits) // 같은 입력 → 같은 점수·같은 적중 순서
  assert.equal(b.score, a.score)
})

test('bad arguments exit 2 (Task 2 CLI convention)', async () => {
  const out = tmp()
  for (const args of [[], [fx('slop.html')], [fx('slop.html'), '--out', out, '--mode', 'loud'], [fx('slop.html'), '--out', out, '--mode', 'block'],
    [fx('slop.html'), '--out', out, '--threshold', 'many'], [join(out, 'missing.html'), '--out', out], [fx('slop.html'), '--out', out, '--bogus']]) {
    assert.equal((await run(args)).code, 2, args.join(' '))
  }
})

test('axis-scoped exceptions: brutal offset only under S2/I3 at radius 0, line division only under C2/T4/H3', async () => {
  const css = `.hard { width: 200px; height: 80px; box-shadow: 4px 4px 0 0 #1c1b19; }
.round { border-radius: 8px; }
.ruled { height: 80px; background-image: repeating-linear-gradient(0deg, #1c1b19 0 1px, transparent 1px 24px); }`
  const body = `<div class="hard" id="bare">예시 칸</div>
<div data-axes="R0 S2"><div class="hard" id="brutal">예시 칸</div><div class="hard round" id="brutal-round">예시 칸</div></div>
<div class="ruled" id="ruled-bare"></div>
<div data-axes="C2"><div class="ruled" id="ruled-c2"></div></div>`
  const dir = tmp(), f = join(dir, 'axes.html')
  writeFileSync(f, page(body, css))
  const out = tmp()
  assert.equal((await run([f, '--out', out, '--no-kas'])).code, 0)
  const r = report(out)
  const where = (id) => { const h = r.hits.find((x) => x.id === id); return h ? [h.where, ...h.more].join('\n') : '' }
  assert.match(where('G113'), /#bare/)
  assert.match(where('G113'), /#brutal-round/)
  assert.doesNotMatch(where('G113'), /#brutal\b(?!-)/)
  assert.match(where('G026'), /#ruled-bare/)
  assert.doesNotMatch(where('G026'), /#ruled-c2/)
  assert.ok(r.waived.some((w) => w.exception === 'brutal-offset' && /#brutal\b/.test(w.where)))
  assert.ok(r.waived.some((w) => w.exception === 'line-division' && /#ruled-c2/.test(w.where)))
})

test('CRLF input gives the same hits and line numbers as LF', async () => {
  const dir = tmp(), f = join(dir, 'slop.html')
  writeFileSync(f, readFileSync(fx('slop.html'), 'utf8').replace(/\r?\n/g, '\r\n'))
  const [a, b] = [tmp(), tmp()]
  await run([fx('slop.html'), '--out', a, '--no-kas']); await run([f, '--out', b, '--no-kas'])
  // 파일 이름 자리만 다르다(저장소 상대 경로 vs 임시 폴더 절대 경로) — 줄 번호·선택자·순서는 같아야 한다
  const norm = (r) => JSON.stringify(r.hits).replaceAll(report(a).input, 'F').replaceAll(report(b).input, 'F')
  assert.equal(norm(report(b)), norm(report(a)))
})

// 작은 HTTP 서버(프로세스 안) — 도구는 비동기 spawn 이라 교착이 없다
const serve = (routes) => new Promise((res) => {
  const srv = createServer((req, rsp) => { const r = routes[req.url]; rsp.writeHead(r ? r[0] : 404, { 'content-type': 'text/html; charset=utf-8' }); rsp.end(r ? r[1] : '<h1>없는 쪽</h1>') })
  srv.listen(0, '127.0.0.1', () => res({ origin: `http://127.0.0.1:${srv.address().port}`, close: () => new Promise((c) => srv.close(c)) }))
})

test('C1: unreachable URL, HTTP 404 and 500 are tool failures — exit 1, no score, stale ai-tell.json removed; a real page scores and marks bundle-only checks inactive', async () => {
  const srv = await serve({ '/ok': [200, page('<p>예시 문단입니다.</p>')], '/boom': [500, page('<p>서버 오류 예시</p>')] })
  try {
    for (const [url, why] of [['http://127.0.0.1:9/', /탐색 실패/], [`${srv.origin}/missing`, /HTTP 404/], [`${srv.origin}/boom`, /HTTP 500/]]) {
      const out = tmp()
      writeFileSync(join(out, 'ai-tell.json'), '{"score":0,"stale":true}')
      const { code, out: log } = await run([url, '--out', out, '--mode', 'block', '--threshold', '999'])
      assert.equal(code, 1, `${url}\n${log}`)
      assert.match(log, why)
      assert.ok(!existsSync(join(out, 'ai-tell.json')), `${url}: 낡은 ai-tell.json 이 남았다`)
    }
    const out = tmp()
    assert.equal((await run([`${srv.origin}/ok`, '--out', out])).code, 0)
    assert.deepEqual(report(out).inactive, URL_INACTIVE)
  } finally { await srv.close() }
})

// 레시피 표지 CSS(recipe.mjs recipeMarkers 와 같은 꼴)
const MARK = (axes, tuned = '') => `--wf-axes: "${axes}"; --wf-font-tuned: "${tuned}";`
const STRIPE = 'height: 40px; background-image: repeating-linear-gradient(0deg, #1c1b19 0 1px, transparent 1px 24px);'

test('I1: in a gallery, html[data-recipe] markers do not reach scaffolding inside main — only the specimen and portals get the exception', async () => {
  const css = `[data-recipe="r-line"] { ${MARK('C2 T4 H3 R0')} } .stripe { ${STRIPE} }`
  const html = page(`<div class="stripe" id="frame-stripe"></div>
<section data-recipe="r-line"><div class="stripe" id="cell-stripe"></div></section>`, css)
    .replace('<html lang="ko">', '<html lang="ko" data-recipe="r-line">')
    .replace('</main>', '</main>\n<div class="stripe" id="portal-stripe"></div>')
  const f = join(tmp(), 'gallery.html'); writeFileSync(f, html)
  const out = tmp()
  assert.equal((await run([f, '--out', out])).code, 0)
  const r = report(out), h = r.hits.find((x) => x.id === 'G026')
  const hit = h ? [h.where, ...h.more].join('\n') : ''
  assert.match(hit, /#frame-stripe/)
  assert.doesNotMatch(hit, /#cell-stripe|#portal-stripe/)
  assert.ok(r.waived.some((w) => /#cell-stripe/.test(w.where)) && r.waived.some((w) => /#portal-stripe/.test(w.where)))
})

test('I2: a stamped page carries recipe markers on :root — axis exceptions and declared font tuning apply without data-* markup', async () => {
  const css = `:root { ${MARK('B1 I3 C2 T4 H3 R0 S2', 'display')} } body { font-family: Inter, sans-serif; } .stripe { ${STRIPE} }
.hard { width: 200px; height: 60px; box-shadow: 4px 4px 0 0 #1c1b19; }`
  const f = join(tmp(), 'stamped.html'); writeFileSync(f, page('<div class="stripe" id="s"></div><div class="hard" id="h">예시 칸</div><p>예시 본문 문단입니다.</p>', css))
  const out = tmp()
  assert.equal((await run([f, '--out', out])).code, 0)
  const r = report(out)
  assert.ok(!ids(r).includes('G026') && !ids(r).includes('G113'), ids(r).join(' '))
  const g122 = r.hits.find((x) => x.id === 'G122')
  assert.ok(g122 && /\(body\)/.test([g122.where, ...g122.more].join('\n')) && !/\(display\)/.test([g122.where, ...g122.more].join('\n')), JSON.stringify(g122))
  // 표지가 없으면 같은 페이지가 걸린다(양성 대조) — 계산값(자간 등)은 「조정」의 근거가 아니다
  const f2 = join(tmp(), 'unmarked.html'); writeFileSync(f2, page('<div class="stripe"></div>', 'h1 { font-family: Inter, sans-serif; letter-spacing: -0.02em; } .stripe { ' + STRIPE + ' }'))
  const out2 = tmp()
  assert.equal((await run([f2, '--out', out2])).code, 0)
  assert.ok(ids(report(out2)).includes('G026') && ids(report(out2)).includes('G122'), ids(report(out2)).join(' '))
})

test('rule precision (review I3·I4·M1·M2·M3·M4·M9): each probe hits or stays quiet as the source rule says', async () => {
  const css = `button { touch-action: manipulation; }
.fill { background: oklch(0.5 0.15 255); padding: 8px; }
.ink { color: oklch(0.99 0 0); } .grey { color: oklch(0.6 0 0); }
@keyframes grow { from { width: 10px } to { width: 100px } } .grower { animation: grow 1s 1; height: 10px; }
.ring { transition: box-shadow 200ms; } .ring:focus-visible { box-shadow: 0 0 0 3px #1c1b19; outline: none; }
.push:hover { padding: 12px; } .box h2 { margin-block: 0 12px; }
.wrap { display: flex; flex-wrap: wrap; gap: 12px; width: 220px; } .wrap button, .stack div { border: 1px solid #1c1b19; padding: 8px 16px; }
.wrap button { width: 200px; } .stack div { margin: 0; }`
  const body = `<span role="checkbox" aria-checked="false" id="bare-box" tabindex="0">예시</span>
<label><span role="checkbox" aria-checked="false" id="paired-box"></span><input type="checkbox" hidden />예시</label>
<div class="fill"><span class="ink" id="ink">짝 토큰 글자</span></div>
<div class="fill"><span class="grey" id="grey">회색 보조 글자</span></div>
<button type="button" id="dash-btn"><span>지금 시작 — 예시</span></button>
<p id="arrow">바로 가기 ↗ 표시</p><p id="rocket">🚀 발사 예시</p>
<ul><li id="date">05.10 공지</li><li id="marker">01.</li></ul>
<div class="box"><h2 id="first-h2">첫 제목</h2><p>예시 문단</p></div>
<div class="grower" id="grower"></div>
<button type="button" class="ring" id="ring">포커스 예시</button>
<a href="#x" class="push" id="push">밀리는 링크</a><p>뒤 문단 예시</p>
<div class="wrap"><button type="button" id="wrap-a">줄바꿈 버튼 가</button><button type="button" id="wrap-b">줄바꿈 버튼 나</button></div>
<div class="stack"><div id="row-a">붙은 행 가</div><div id="row-b">붙은 행 나</div></div>`
  const f = join(tmp(), 'precision.html'); writeFileSync(f, page(body, css))
  const out = tmp()
  assert.equal((await run([f, '--out', out])).code, 0)
  const r = report(out)
  const at = (id) => { const h = r.hits.find((x) => x.id === id); return h ? [h.where, ...h.more].join('\n') : '' }
  assert.match(at('G053'), /#bare-box/); assert.doesNotMatch(at('G053'), /#paired-box/)
  assert.match(at('G020'), /#grey/); assert.doesNotMatch(at('G020'), /#ink/)
  assert.match(at('G010'), /#dash-btn/)
  assert.match(at('G132'), /#rocket/); assert.doesNotMatch(at('G132'), /#arrow/)
  assert.match(at('G139'), /#marker/); assert.doesNotMatch(at('G139'), /#date/)
  assert.doesNotMatch(at('G137'), /#first-h2/)
  assert.match(at('G119'), /@keyframes grow: width/)
  assert.match(at('G042'), /#ring/)
  assert.match(at('G044'), /#push/)
  // G056(Task 5 리뷰 M1): 간격 12px로 줄바꿈된 테두리 버튼은 겹침이 아니다 · 붙어 쌓인 테두리 행은 겹침이다(양성 대조)
  assert.doesNotMatch(at('G056'), /#wrap-b/)
  assert.match(at('G056'), /#row-b/)
})

test('I2: recipe generator writes --wf-axes and --wf-font-tuned into the recipe CSS and registry cssVars (committed r1-measure output)', async () => {
  const { recipeMarkers, parseRecipe, RECIPES_DIR } = await import('../scripts/recipe.mjs')
  const r = parseRecipe(readFileSync(join(RECIPES_DIR, 'r1-measure', 'DESIGN.md'), 'utf8'))
  const m = recipeMarkers(r)
  assert.equal(m['wf-axes'], `"${Object.values(r.axes).join(' ')}"`)
  assert.equal(m['wf-font-tuned'], '"display body mono"')
  const css = readFileSync(join(ROOT, 'registry', 'factory', 'r', 'r1-measure', 'r1-measure.css'), 'utf8')
  assert.match(css, /:root \{[^}]*--wf-axes: "B1 I3 C2 T4 H3 R0 S0";[^}]*--wf-font-tuned: "display body mono";/)
  const base = JSON.parse(readFileSync(join(ROOT, 'registry', 'factory', 'r', 'registry.json'), 'utf8')).items.find((i) => i.name === 'r1-measure')
  assert.equal(base.cssVars.light['wf-axes'], m['wf-axes'])
  assert.equal(recipeMarkers({ axes: { button: 'B3' }, fonts: { display: { family: 'Inter' }, body: { family: 'Inter', tuned: ' ' } } })['wf-font-tuned'], '""')
})

test('kill-ai-slop installed: clean stays 0 and the kas scale is reported apart from the G scale', { skip: !existsSync(kasScanPath()) && 'kill-ai-slop 설치본 없음' }, async () => {
  const out = tmp()
  assert.equal((await run([fx('clean.html'), '--out', out], KAS)).code, 0)
  const r = report(out)
  assert.equal(r.kas.status, 'ok')
  assert.deepEqual(ids(r), [])
  assert.equal(r.maxKas, 35); assert.equal(r.scoreKas, 0)
})

test('kill-ai-slop absent: prints a skip line and still scores (Plan 1 M6)', async () => {
  const out = tmp()
  const { code, out: log } = await run([fx('slop.html'), '--out', out], { AI_TELL_KAS_SCAN: join(tmp(), 'no-such-scan.mjs') })
  assert.equal(code, 0, log)
  assert.match(log, /kill-ai-slop scan\.mjs .*건너뛴다/)
  assert.equal(report(out).kas.status, 'skip')
  assert.ok(report(out).hits.length >= 5)
})

// C124: kill-ai-slop 실패는 도구 실패 — 종료 1 + 결과 파일 없음(옛 파일도 지운다). docs/agents/agent-guide.md 표와 코드가 같은 말을 한다.
const stubScan = (body) => { const f = join(tmp(), 'stub-scan.mjs'); writeFileSync(f, body); return { AI_TELL_KAS_SCAN: f } }
test('C124: kill-ai-slop failure is a tool failure — exit 1, no ai-tell.json (stale one removed), even in warn; a working scan (negative control) still writes the file', async () => {
  const out = tmp()
  writeFileSync(join(out, 'ai-tell.json'), '{"score":0,"stale":true}')
  const bad = await run([fx('clean.html'), '--out', out], stubScan('console.error("scan 폭발"); process.exit(1)'))
  assert.equal(bad.code, 1, bad.out)
  assert.match(bad.out, /측정 없음\(도구 실패\).*kill-ai-slop 실패/)
  assert.ok(!existsSync(join(out, 'ai-tell.json')), 'kas 실패인데 ai-tell.json 이 남았다')
  const out2 = tmp()
  const ok = await run([fx('clean.html'), '--out', out2], stubScan('console.log(JSON.stringify({ filesScanned: 1, findings: [] }))'))
  assert.equal(ok.code, 0, ok.out)
  assert.equal(report(out2).kas.status, 'ok')
})

// C120 준비: block 문턱은 「초과」(>)에서만 3 — 같은 점수는 통과, 1 낮추면 실패. 분포 도우미는 문턱을 고르지 않고 재료만 낸다.
test('C120 prep: block --threshold boundary — score == threshold passes (0), threshold-1 exits 3, over flag follows', async () => {
  const warn = tmp()
  assert.equal((await run([fx('slop.html'), '--out', warn])).code, 0)
  const s = report(warn).score
  assert.ok(s >= 2, `slop 점수가 너무 낮다: ${s}`)
  const eq = tmp(), lo = tmp()
  assert.equal((await run([fx('slop.html'), '--out', eq, '--mode', 'block', '--threshold', String(s)])).code, 0)
  assert.equal(report(eq).over, false)
  assert.equal((await run([fx('slop.html'), '--out', lo, '--mode', 'block', '--threshold', String(s - 1)])).code, 3)
  assert.equal(report(lo).over, true)
})

test('C120 prep: scoreDistribution prints min·p50·p90·max (nearest-rank) from result files or folders; bad input is an error, not a guess', async () => {
  const dir = tmp()
  const put = (name, obj) => { const d = join(dir, name); mkdirSync(d); writeFileSync(join(d, 'ai-tell.json'), JSON.stringify(obj)); return d }
  const scores = [12, 3, 20, 8, 0, 9, 15, 4, 7, 5]
  const dirs = scores.map((v, i) => put(`g${i}`, i % 2 ? { score: v } : { score: v + 100, scoreG: v })) // scoreG 가 있으면 그 값(kas 합산 밖)
  const d = scoreDistribution([...dirs.slice(0, 9), join(dirs[9], 'ai-tell.json')]) // 폴더와 파일 경로 둘 다
  assert.deepEqual(d.scores, [0, 3, 4, 7, 8, 9, 12, 15, 20, 5].sort((x, y) => x - y))
  assert.equal(d.n, 10); assert.equal(d.min, 0); assert.equal(d.max, 20)
  assert.equal(d.p50, 7)  // ceil(0.5·10)=5번째 = [0,3,4,5,7,...]의 7
  assert.equal(d.p90, 15) // ceil(0.9·10)=9번째
  assert.equal(scoreDistribution([dirs[0]]).p90, 12) // 하나면 전부 그 값
  assert.throws(() => scoreDistribution([]), /결과 파일이 없다/)
  assert.throws(() => scoreDistribution([join(dir, 'missing')]), /결과 파일이 없다/)
  assert.throws(() => scoreDistribution([put('nan', { hits: [] })]), /점수가 없다/)
  const cli = await run(['--distribution', ...dirs])
  assert.equal(cli.code, 0, cli.out)
  assert.match(cli.out, /n=10\): min 0 · p50 7 · p90 15 · max 20/)
  assert.equal((await run(['--distribution', join(dir, 'missing')])).code, 2)
})

// ── 데이터·표 정합(렌더 없음) ──
const gateRows = () => readFileSync(join(ROOT, 'docs', 'inputs', 'ai_tell_gate.md'), 'utf8').split(/\r?\n/)
  .filter((l) => /^\| G\d{3} \|/.test(l)).map((l) => l.split(/(?<!\\)\|/).map((c) => c.trim())).map((c) => ({ id: c[1], type: c[4], weight: +c[6] }))

test('every static-regex and computed-style check in ai_tell_gate.md is either implemented or skipped with a reason, weights match', () => {
  const rows = gateRows()
  assert.equal(rows.length, 142)
  const scope = rows.filter((r) => ['정적 정규식', '계산된 스타일'].includes(r.type))
  assert.equal(scope.filter((r) => r.type === '정적 정규식').length, 67)
  assert.equal(scope.filter((r) => r.type === '계산된 스타일').length, 54)
  const impl = new Set(CHECKS.map((c) => c.id)), skip = new Set(Object.keys(SKIPPED))
  for (const r of scope) assert.ok(impl.has(r.id) !== skip.has(r.id), `${r.id}: 구현·건너뜀 중 정확히 하나`)
  for (const c of CHECKS) assert.equal(c.weight, rows.find((r) => r.id === c.id)?.weight, c.id)
  for (const id of [...impl, ...skip]) assert.ok(scope.some((r) => r.id === id), `${id} 는 정적·계산 유형이 아니다`)
  for (const reason of Object.values(SKIPPED)) assert.ok(reason.length > 10)
  for (const gs of Object.values(KAS_MAP)) for (const g of gs) assert.ok(rows.some((r) => r.id === g), g)
})

test('banlist keeps the Task 6 fonts and adds colors·layouts·updated; exceptions cite DESIGN and match compat line values', () => {
  const b = loadBanlist()
  assert.ok(b.$comment && b.fonts.some((f) => f.family === 'Inter' && f.untunedOnly === true && f.why))
  assert.ok(b.fonts.find((f) => f.family === 'system-ui').untunedOnly === false)
  assert.equal(b.updated, '2026-09-26')
  for (const c of b.colors) assert.ok(CHECKS.some((x) => x.id === c.check) && c.why, c.id)
  for (const l of b.layouts) assert.ok(CHECKS.some((x) => x.id === l.check) && l.min >= 2 && l.why, l.id)
  const ex = loadExceptions().exceptions
  for (const x of ex) assert.match(x.design, /DESIGN\.md §\d/, x.id)
  // 원천은 compat.json 하나 — 데이터는 값 목록 사본 없이 가리키기만 하고, 읽을 때 채운 값이 compat 의 선 구획 값과 같다(C6·C8·H5 포함)
  const raw = JSON.parse(readFileSync(join(DATA, 'ai-tell-exceptions.json'), 'utf8')).exceptions.find((x) => x.id === 'line-division')
  assert.equal(raw.axisValues, undefined)
  assert.equal(raw.axisValuesFrom, 'compat.requiresLineContrast')
  assert.deepEqual([...ex.find((x) => x.id === 'line-division').axisValues].sort(), [...LINE_VALUES].sort())
  for (const v of ['C6', 'C8', 'H5']) assert.ok(exempt({ id: 'G135', detail: '', axes: [v] }, ex), v)
  assert.ok(exempt({ id: 'G118', detail: 'cubic-bezier(0.34,1.56,0.64,1)' }, ex))
  assert.ok(!exempt({ id: 'G118', detail: 'cubic-bezier(0.34,1.8,0.64,1)' }, ex))
  assert.ok(!exempt({ id: 'G113', detail: 'hard-offset radius', axes: ['S2'] }, ex))
})

test('css text checks report file:line on CRLF text and annotateLines skips script/style/comments', () => {
  const css = 'a {\r\n  color: red;\r\n}\r\n.x:hover {\r\n  transform: scale(1.05);\r\n}\r\n.c { cursor: url(x.png), auto; }\r\n'
  const o = cssChecks('t.css', css)
  assert.deepEqual(o.filter((x) => x.id === 'G062').map((x) => x.line), [4])
  assert.deepEqual(o.filter((x) => x.id === 'G117').map((x) => x.line), [7])
  // G019 DESIGN §5 대역: :root 는 대역 안, .x 의 바탕 L 0.9 는 밖
  const bands = cssChecks('t.css', ':root {\r\n  --background: oklch(0.975 0.01 255);\r\n  --foreground: oklch(0.2 0.01 255);\r\n}\r\n.x {\r\n  --background: oklch(0.9 0.01 255);\r\n}\r\n')
  assert.deepEqual(bands.filter((x) => x.id === 'G019').map((x) => x.line), [5])
  const a = annotateLines('<body>\r\n<p>하나</p>\r\n<script>if (a<b) x()</script>\r\n<!-- <div> -->\r\n<div>둘</div></body>')
  assert.match(a, /<p data-ai-line="2">/)
  assert.match(a, /<div data-ai-line="5">/)
  assert.match(a, /if \(a<b\)/)
  assert.match(a, /<!-- <div> -->/)
})
