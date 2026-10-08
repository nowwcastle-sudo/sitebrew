// 단일 HTML 내보내기·Vercel 미리보기 배포(P3-3 Task 13).
// 실행: node --test --test-force-exit --test-timeout=120000 factory/scripts/stamp-export.test.mjs
// 실제 내보내기 1회(사이트 빌드 + 정적 내보내기 빌드 + Chrome 4장)는 실행 잠금 안에서 STAMP_EXPORT_REAL=1 (결과 JSON 은 STAMP_EXPORT_OUT).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'
import { createRequire } from 'node:module'
import { assertPreviewOnly, deployPreview, previewCommands, writePreviewUrl } from '../stamp/deploy-preview.mjs'
import {
  CHANNEL_THRESHOLD, DIFF_BUDGET, adapterScript, exportSingleHtml, formHandlerScript, parseUnicodeRange, pngDiff, rawDiff, routeHtmlFile, routeSlug, staticConfigFrom,
  staticExportBuild, usedCodepoints,
} from '../export/single-html.mjs'
import { loadTs } from '../stamp/ts-eval.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const sharp = createRequire(join(root, 'package.json'))('sharp')
const TMP = mkdtempSync(join(tmpdir(), 'p3t13-test-'))
process.on('exit', () => { try { rmSync(TMP, { recursive: true, force: true }) } catch {} })

// ─── 미리보기 배포: 프로덕션 가드 ───

const stub = (over = {}) => {
  const calls = []
  const run = async (cmd, args, o) => {
    calls.push({ cmd, args, env: o.env, cwd: o.cwd })
    return { code: 0, stdout: 'Inspect: https://vercel.com/x/y\nPreview: https://wf-preview-abc123-team.vercel.app\nhttps://wf-preview-abc123-team.vercel.app\n', stderr: '', ...over }
  }
  return { calls, run }
}
const cand = (name) => { const d = join(TMP, name); mkdirSync(join(d, 'site'), { recursive: true }); return d }

test('deploy: --prod 를 주면 프로세스를 띄우기 전에 던진다 (음성 대조)', async () => {
  for (const extraArgs of [['--prod'], ['--prod=true'], ['--PROD'], ['--target=production'], ['--target', 'production'], ['--environment=production'], ['--target=staging'], ['--target', 'custom']]) {
    const s = stub()
    const d = cand('guard')
    await assert.rejects(deployPreview(join(d, 'site'), { spawn: s.run, readSecret: () => null, extraArgs }), /프로덕션|preview 만/, JSON.stringify(extraArgs))
    assert.equal(s.calls.length, 0, `${JSON.stringify(extraArgs)} — spawn 이 불렸다`)
  }
  // production 글자가 든 프로젝트 이름도 막는다
  const s = stub()
  await assert.rejects(deployPreview(join(cand('guard2'), 'site'), { spawn: s.run, readSecret: () => null, project: 'my-production-site' }), /프로덕션/)
  assert.equal(s.calls.length, 0)
  // 양성 대조: 정상 인자는 통과한다(가드가 전부 막는 게 아니다)
  assert.doesNotThrow(() => assertPreviewOnly(['--yes', '--target=preview', '--project', 'wf-preview']))
  assert.doesNotThrow(() => assertPreviewOnly(['--target', 'preview']))
})

test('deploy: 가드는 명령 하나가 아니라 두 명령 모두를 실행 전에 본다', async () => {
  // 첫 명령(build)이 정상이어도 뒤 명령이 문제면 build 조차 돌지 않는다 — extraArgs 는 두 명령에 붙으므로 여기서는 명령 목록을 직접 검사한다
  const cmds = previewCommands({ extraArgs: [] })
  assert.equal(cmds.length, 2)
  for (const [, ...args] of cmds) assert.doesNotThrow(() => assertPreviewOnly(args))
  for (const c of cmds) assert.ok(!c.some((a) => /prod/i.test(a)), `--prod 가 없어야 한다: ${c.join(' ')}`)
  assert.ok(cmds.every((c) => c.includes('--target=preview')))
})

test('deploy: 실행하는 명령의 인자를 정확히 고정한다 · 토큰은 환경 변수로만 · 주소를 08-board.json 에 적는다', async () => {
  const d = cand('argv')
  // 이미 있는 08-board.json 의 data 는 보존한다(Task 12 가 쓴 것)
  writeFileSync(join(d, '08-board.json'), JSON.stringify({ inputHash: 'h1', producedAt: '2026-09-30T00:00:00.000Z', data: { verdict: 'x' } }))
  const s = stub()
  const r = await deployPreview(join(d, 'site'), { spawn: s.run, readSecret: (n) => (n === 'VERCEL_TOKEN' ? 'tok_SECRET_1234567890' : null), env: { PATH: 'p' } })
  assert.deepEqual(s.calls.map((c) => [c.cmd, ...c.args]), [
    ['vercel', 'build', '--yes', '--target=preview', '--project', 'wf-preview'],
    ['vercel', 'deploy', '--prebuilt', '--yes', '--target=preview', '--project', 'wf-preview'],
  ])
  assert.deepEqual(r.argv, [
    ['vercel', 'build', '--yes', '--target=preview', '--project', 'wf-preview'],
    ['vercel', 'deploy', '--prebuilt', '--yes', '--target=preview', '--project', 'wf-preview'],
  ])
  assert.equal(r.url, 'https://wf-preview-abc123-team.vercel.app')
  assert.ok(s.calls.every((c) => c.cwd === join(d, 'site')))
  assert.ok(s.calls.every((c) => c.env.VERCEL_TOKEN === 'tok_SECRET_1234567890'), '토큰은 자식 환경 변수로')
  assert.ok(s.calls.every((c) => !c.args.join(' ').includes('tok_SECRET')), '토큰은 인자에 없다')
  assert.ok(s.calls.every((c) => !c.args.some((a) => /^--prod|^-t$|^--token/.test(a))))
  const board = JSON.parse(readFileSync(join(d, '08-board.json'), 'utf8'))
  assert.equal(board.data.previewUrl, r.url)
  assert.equal(board.data.verdict, 'x')
  assert.equal(board.inputHash, 'h1')
})

test('deploy: 토큰이 없으면 환경 변수를 더하지 않는다(CLI 로그인) · 프로젝트 이름을 고를 수 있다', async () => {
  const s = stub()
  const d = cand('login')
  await deployPreview(join(d, 'site'), { spawn: s.run, readSecret: () => null, env: { PATH: 'p' }, project: 'cand-a1', board: false })
  assert.ok(s.calls.every((c) => !('VERCEL_TOKEN' in c.env)))
  assert.deepEqual(s.calls[1].args, ['deploy', '--prebuilt', '--yes', '--target=preview', '--project', 'cand-a1'])
  assert.equal(existsSync(join(d, '08-board.json')), false, 'board:false 면 쓰지 않는다')
  await assert.rejects(deployPreview(join(d, 'site'), { spawn: s.run, readSecret: () => null, project: 'Bad Name; rm -rf' }), /프로젝트 이름/)
})

test('deploy: 실패 오류에 토큰이 없다 · 주소가 없으면 도구 실패', async () => {
  const d = cand('fail')
  const fail = stub({ code: 1, stdout: '', stderr: 'Error: token tok_SECRET_ABCDEF rejected\nmore' })
  await assert.rejects(deployPreview(join(d, 'site'), { spawn: fail.run, readSecret: () => 'tok_SECRET_ABCDEF' }), (e) => { assert.match(e.message, /종료 1/); assert.doesNotMatch(e.message, /tok_SECRET_ABCDEF/); assert.match(e.message, /\*\*\*/); return true })
  assert.equal(fail.calls.length, 1, 'build 가 실패하면 deploy 를 돌리지 않는다')
  const none = stub({ stdout: 'done' })
  await assert.rejects(deployPreview(join(d, 'site'), { spawn: none.run, readSecret: () => null }), /배포 주소/)
  assert.equal(existsSync(join(d, '08-board.json')), false, '주소를 못 찾으면 08-board.json 을 쓰지 않는다')
})

test('deploy: writePreviewUrl 은 파일이 없거나 깨졌어도 run-dir 단계 파일 모양으로 쓴다', () => {
  const d = cand('board')
  writePreviewUrl(d, 'https://a-b.vercel.app', () => 'T')
  let j = JSON.parse(readFileSync(join(d, '08-board.json'), 'utf8'))
  assert.equal(j.data.previewUrl, 'https://a-b.vercel.app')
  assert.ok('inputHash' in j && 'producedAt' in j)
  writeFileSync(join(d, '08-board.json'), '{깨진')
  writePreviewUrl(d, 'https://c-d.vercel.app', () => 'T2')
  j = JSON.parse(readFileSync(join(d, '08-board.json'), 'utf8'))
  assert.equal(j.data.previewUrl, 'https://c-d.vercel.app')
})

// ─── 단일 HTML 변환 ───

const FONT_KO = Buffer.from('KOREAN-FONT-BYTES')
const FONT_CY = Buffer.from('CYRILLIC-FONT-BYTES')
const CSS = `@font-face{font-family:"Nanum";src:url(/_next/static/media/ko.woff2) format("woff2");unicode-range:U+AC00-D7A3,U+3131-3163}
@font-face{font-family:"Nanum";src:url(/_next/static/media/cy.woff2) format("woff2");unicode-range:U+0400-04FF}
@font-face{font-family:"Fallback";src:local("Arial");size-adjust:90%}
body{font-family:Nanum,Fallback;background:url(../media/bg.png)}
.x::after{content:"→"}`
const FIXTURE_HTML = `<!DOCTYPE html><html lang="ko" class="a"><head><meta charSet="utf-8"/><link rel="preload" href="/_next/static/media/ko.woff2" as="font" crossorigin="" type="font/woff2"/><link rel="stylesheet" href="/_next/static/chunks/a.css" data-precedence="next"/><link rel="preload" as="script" href="/_next/static/chunks/x.js"/><script src="/_next/static/chunks/x.js" async=""></script><script>document.documentElement.setAttribute("data-motion","on")</script><script type="application/ld+json">{"@type":"Bakery"}</script></head><body><main><h1>달빛 베이커리</h1><form action="javascript:throw new Error('React form unexpectedly submitted.')" method="post" class="f"><input name="name"/><input type="hidden" name="idempotencyKey" value="k"/><button type="submit" formAction="javascript:void(0)">보내기</button></form></main><script>(self.__next_f=self.__next_f||[]).push([1,"x"])</script></body></html>`

function fixtureSite(name, { html = FIXTURE_HTML, business = { name: '달빛 베이커리', email: 'hello@moonlight-bakery.kr', phone: '02-1234-5678' }, extra = {} } = {}) {
  const site = join(TMP, name, 'site')
  const out = join(site, '.next-export')
  mkdirSync(join(out, '_next', 'static', 'chunks'), { recursive: true })
  mkdirSync(join(out, '_next', 'static', 'media'), { recursive: true })
  mkdirSync(join(site, 'content'), { recursive: true })
  writeFileSync(join(out, 'index.html'), html)
  writeFileSync(join(out, 'services.html'), html)
  writeFileSync(join(out, '_next', 'static', 'chunks', 'a.css'), CSS)
  writeFileSync(join(out, '_next', 'static', 'media', 'ko.woff2'), FONT_KO)
  writeFileSync(join(out, '_next', 'static', 'media', 'cy.woff2'), FONT_CY)
  writeFileSync(join(out, '_next', 'static', 'media', 'bg.png'), Buffer.from('PNG-BYTES'))
  writeFileSync(join(site, 'content', 'site.json'), JSON.stringify({ locale: 'ko', business, ...extra }))
  return site
}

test('single: 외부 CSS 링크 0개 · 스타일 인라인 · 스크립트는 JSON-LD 만(폼 스크립트 제외)', async () => {
  const site = fixtureSite('single1')
  const r = await exportSingleHtml(site, '/', { build: false, shoot: false })
  const html = readFileSync(r.file, 'utf8')
  assert.equal((html.match(/<link\b[^>]*rel=["']?stylesheet/gi) ?? []).length, 0, '외부 CSS 링크')
  assert.equal((html.match(/<link\b[^>]*rel=["']?(?:preload|modulepreload|prefetch)/gi) ?? []).length, 0)
  assert.match(html, /<style data-wf-src="\/_next\/static\/chunks\/a\.css">/)
  assert.doesNotMatch(html, /<script[^>]*\ssrc=/i, '외부 스크립트 없음')
  assert.doesNotMatch(html, /__next_f/)
  assert.match(html, /<script type="application\/ld\+json">\{"@type":"Bakery"\}<\/script>/)
  assert.match(html, /<html lang="ko" class="a" data-motion="off" data-wf-single="1">/)
  assert.deepEqual(r.external, [], '남은 외부 참조')
  assert.equal(r.stylesInlined, 1)
  assert.equal(routeSlug('/'), 'index')
  assert.equal(r.file, join(TMP, 'single1', 'export', 'index.html'))
})

test('single: 글꼴은 쪽 글자를 덮는 조각만 남겨 data URI 로 · 안 쓰는 조각은 규칙째 지운다', async () => {
  const r = await exportSingleHtml(fixtureSite('single2'), '/', { build: false, shoot: false })
  const html = readFileSync(r.file, 'utf8')
  assert.equal(r.fontFacesKept, 2, '한글 조각 + local() 대체')
  assert.equal(r.fontFacesDropped, 1, '키릴 조각')
  assert.ok(html.includes(`data:font/woff2;base64,${FONT_KO.toString('base64')}`))
  assert.ok(!html.includes(FONT_CY.toString('base64')) && !html.includes('cy.woff2'))
  assert.ok(html.includes('data:image/png;base64,'), '배경 이미지 인라인')
  assert.doesNotMatch(html, /url\(\/_next|url\(\.\.\/media/)
  // 음성 대조: 영어만 있는 쪽은 한글 조각도 지운다
  const en = await exportSingleHtml(fixtureSite('single2b', { html: FIXTURE_HTML.replace('달빛 베이커리', 'Moonlight Bakery').replace('보내기', 'Send') }), '/', { build: false, shoot: false })
  assert.equal(en.fontFacesKept, 1, '한글 조각도 빠지고 local() 만 남는다')
  assert.equal(en.fontFacesDropped, 2)
})

test('single: unicode-range 해석(범위·단일·와일드카드) · 글자 집합', () => {
  assert.deepEqual(parseUnicodeRange('U+0-FF, U+30??, U+AC00-D7A3, U+2019'), [[0, 255], [0x3000, 0x30ff], [0xac00, 0xd7a3], [0x2019, 0x2019]])
  assert.equal(parseUnicodeRange(undefined), null)
  assert.throws(() => parseUnicodeRange('U+ZZ'), /못 읽/)
  const used = usedCodepoints('<p>가A&#66;&#x43;</p><script>zzz</script><style>.q{}</style>', '.a::before{content:"→"}')
  assert.ok(used.has('가'.codePointAt(0)) && used.has(66) && used.has(0x43) && used.has(0x2192))
  assert.ok(!used.has('z'.codePointAt(0)), '스크립트 안 글자는 세지 않는다')
})

test('single: 폼에는 action 이 없다 — 서버 주소 대신 adapter-static 경로', async () => {
  const r = await exportSingleHtml(fixtureSite('forms'), '/', { build: false, shoot: false })
  const html = readFileSync(r.file, 'utf8')
  const formTags = html.match(/<form\b[^>]*>/gi) ?? []
  assert.equal(formTags.length, 1)
  assert.equal(r.formsFound, 1)
  for (const t of formTags) assert.doesNotMatch(t, /\saction\s*=/i)
  // v0.0.12 리뷰 P1-2: 스크립트가 아직 안 붙은(큰 인라인 파일·스크립트 꺼짐) 상태의 제출이 GET 으로 입력값을 주소에 싣지 않게 method="post" 를 남긴다
  for (const t of formTags) assert.match(t, /\smethod="post"/i, t)
  assert.doesNotMatch(html, /javascript:/i, 'React 의 javascript: action·formAction 이 남지 않는다')
  assert.doesNotMatch(html, /formaction/i)
  const cfg = JSON.parse(html.match(/<script type="application\/json" id="wf-static-config">([\s\S]*?)<\/script>/)[1])
  assert.deepEqual(cfg, { email: 'hello@moonlight-bakery.kr', phone: '02-1234-5678', subject: '달빛 베이커리 문의' })
  assert.ok(html.includes('mailtoSubmit') && html.includes('__wfStatic'), '어댑터 코드를 실었다')
  // 폼이 없는 쪽은 스크립트가 JSON-LD 하나뿐이다
  const plain = await exportSingleHtml(fixtureSite('noform', { html: FIXTURE_HTML.replace(/<form[\s\S]*<\/form>/, '') }), '/', { build: false, shoot: false })
  const scripts = readFileSync(plain.file, 'utf8').match(/<script\b[^>]*>/gi)
  assert.deepEqual(scripts, ['<script type="application/ld+json">'])
})

// vm 안에서 폼 스크립트를 돌린다 — 가짜 문서로 제출 이벤트를 만든다.
function runForms(cfg, fields, exportedHtml) {
  const assigned = []
  const listeners = {}
  const el = (tag) => ({ tag, attrs: {}, children: [], textContent: '', setAttribute(k, v) { this.attrs[k] = v }, hasAttribute(k) { return k in this.attrs }, appendChild(c) { this.children.push(c) } })
  const form = { tagName: 'FORM', fields, getAttribute: () => null, nextElementSibling: null, parentNode: { insertBefore(n) { form.nextElementSibling = n } } }
  const document = {
    getElementById: (id) => (id === 'wf-static-config' ? { textContent: JSON.stringify(cfg) } : null),
    addEventListener: (t, fn) => { listeners[t] = fn },
    createElement: el, createTextNode: (text) => ({ text }),
  }
  class FormData { constructor(f) { this.f = f } forEach(cb) { for (const [k, v] of Object.entries(this.f.fields)) cb(v, k) } }
  const window = { location: { assign: (h) => assigned.push(h) }, open: (h) => assigned.push(h) }
  const ctx = vm.createContext({ window, document, FormData, navigator: {}, console })
  if (exportedHtml) for (const m of exportedHtml.matchAll(/<script>([\s\S]*?)<\/script>/g)) vm.runInContext(m[1], ctx) // 내보낸 파일에 실린 스크립트 그대로
  else { vm.runInContext(adapterScript(), ctx); vm.runInContext(formHandlerScript(), ctx) }
  let prevented = 0
  const fire = async () => { listeners.submit({ target: form, preventDefault: () => prevented++ }); await new Promise((r) => setImmediate(r)) }
  return { fire, assigned, form, prevented: () => prevented, api: window.__wfStatic }
}

test('single: 제출은 메일 앱을 연다 — adapter-static 실제 코드와 같은 주소·idempotencyKey 는 본문에 없다', async () => {
  const fields = { name: '홍길동', message: '내일 4시 예약해요', idempotencyKey: 'abc', empty: '' }
  const exported = await exportSingleHtml(fixtureSite('formrun'), '/', { build: false, shoot: false })
  const html = readFileSync(exported.file, 'utf8')
  const t = runForms({ email: 'hello@moonlight-bakery.kr', subject: '달빛 베이커리 문의' }, fields, html)
  await t.fire()
  assert.equal(t.prevented(), 1)
  assert.equal(t.assigned.length, 1)
  // 같은 입력을 TS 원천 그대로 불러 돌린 결과와 같아야 한다
  const real = await loadTs(join(root, 'registry', 'factory', 'contract', 'adapter-static.ts'))
  const opened = []
  await real.mailtoSubmit('hello@moonlight-bakery.kr', () => '달빛 베이커리 문의', { open: (h) => opened.push(h) })({ name: '홍길동', message: '내일 4시 예약해요' })
  assert.equal(t.assigned[0], opened[0])
  assert.match(t.assigned[0], /^mailto:hello@moonlight-bakery\.kr\?subject=/)
  assert.doesNotMatch(t.assigned[0], /abc|empty/)
  assert.match(t.form.nextElementSibling.textContent, /메일 앱/)
})

test('single: 보낼 곳이 없으면 열지 않고 「확인 필요」 안내 · 전화만 있으면 tel 링크 안내', async () => {
  const none = runForms({}, { name: 'a' })
  await none.fire()
  assert.equal(none.assigned.length, 0)
  assert.match(none.form.nextElementSibling.textContent, /확인 필요/)
  const tel = runForms({ phone: '02-1234-5678' }, { name: 'a' })
  await tel.fire()
  assert.equal(tel.assigned.length, 0)
  assert.match(tel.form.nextElementSibling.textContent, /전화/)
  assert.equal(tel.form.nextElementSibling.children.find((c) => c.tag === 'a').href, 'tel:0212345678')
  assert.equal(tel.api.telLink('02-1234-5678').data.href, 'tel:0212345678')
})

test('single: 연락 수단은 확인 필요·잘못된 값을 걸러 낸다', () => {
  assert.deepEqual(staticConfigFrom({ business: { name: '가게', email: '확인 필요', phone: '확인 필요' } }), { subject: '가게 문의' })
  assert.deepEqual(staticConfigFrom({ business: { name: 'X', email: 'not-an-email', phone: '02-1' } }), { phone: '02-1', subject: 'X 문의' })
  assert.deepEqual(staticConfigFrom({ business: { email: 'a@b.co' }, booking: { primary: { kind: 'kakao', value: 'https://pf.kakao.com/_abc' } } }), { email: 'a@b.co', kakao: 'https://pf.kakao.com/_abc' })
  assert.deepEqual(staticConfigFrom({ booking: { primary: { kind: 'kakao', value: 'https://evil.example/x' } } }), {})
})

test('single: 내보낸 폴더에서 쪽 파일을 찾는다 · 없으면 던진다', () => {
  const site = fixtureSite('routes')
  const dir = join(site, '.next-export')
  assert.equal(routeHtmlFile(dir, '/'), join(dir, 'index.html'))
  assert.equal(routeHtmlFile(dir, '/services'), join(dir, 'services.html'))
  mkdirSync(join(dir, 'a', 'b'), { recursive: true })
  writeFileSync(join(dir, 'a', 'b', 'index.html'), 'x')
  assert.equal(routeHtmlFile(dir, '/a/b/'), join(dir, 'a', 'b', 'index.html'))
  assert.throws(() => routeHtmlFile(dir, '/nope'), /쪽이 없다/)
  assert.equal(routeSlug('/booking/complete'), 'booking-complete')
})

test('single: 정적 내보내기 설정이 없는 사이트는 빌드 전에 멈춘다', async () => {
  const site = fixtureSite('noconfig')
  writeFileSync(join(site, 'next.config.ts'), 'export default {}\n')
  await assert.rejects(staticExportBuild(site, join(TMP, 'x.log')), /WF_STATIC_EXPORT/)
  await assert.rejects(exportSingleHtml(site, '/', { shoot: false }), /WF_STATIC_EXPORT/)
})

test('single: 사이트 템플릿 next.config.ts 가 WF_STATIC_EXPORT 로만 output export 를 켠다', () => {
  const cfg = readFileSync(join(root, 'factory', 'stamp', 'site-template', 'next.config.ts'), 'utf8')
  assert.match(cfg, /process\.env\.WF_STATIC_EXPORT === "1"/)
  assert.match(cfg, /output: "export"/)
  assert.match(cfg, /distDir: "\.next-export"/)
  assert.match(cfg, /unoptimized: true/)
  assert.match(cfg, /turbopack: \{ root:/, '뿌리 고정은 그대로')
})

// ─── 픽셀 차이 ───

const solid = (w, h, rgba = [255, 255, 255, 255]) => { const data = Buffer.alloc(w * h * 4); for (let i = 0; i < w * h; i++) data.set(rgba, i * 4); return { data, width: w, height: h } }
const paint = (img, x0, y0, x1, y1, rgba) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) img.data.set(rgba, (y * img.width + x) * 4); return img }

test('diff: 같은 그림은 0 · 넓이 1% 가 바뀌면 예산(0.5%)을 넘는다', () => {
  const a = solid(100, 100)
  assert.equal(rawDiff(a, solid(100, 100)).ratio, 0)
  const b = paint(solid(100, 100), 0, 0, 100, 1, [0, 0, 0, 255]) // 한 줄 = 1%
  const d = rawDiff(a, b)
  assert.equal(d.ratio, 0.01)
  assert.equal(d.changed, 100)
  assert.ok(d.ratio > DIFF_BUDGET, '1% 는 예산 초과')
  const tiny = paint(solid(200, 100), 0, 0, 99, 1, [0, 0, 0, 255]) // 99/20000 = 0.495%
  assert.ok(rawDiff(solid(200, 100), tiny).ratio <= DIFF_BUDGET, '0.495% 는 예산 안')
})

test('diff: 채널 차이가 16 이하이면 같은 픽셀이다 · 17 이상이면 다르다', () => {
  assert.equal(CHANNEL_THRESHOLD, 16)
  const a = solid(10, 10, [100, 100, 100, 255])
  assert.equal(rawDiff(a, solid(10, 10, [116, 84, 100, 255])).ratio, 0)
  assert.equal(rawDiff(a, solid(10, 10, [117, 100, 100, 255])).ratio, 1)
  assert.equal(rawDiff(a, solid(10, 10, [100, 100, 83, 255])).ratio, 1)
})

test('diff: 높이가 다르면 모자란 쪽 줄은 전부 다른 것으로 센다 · 너비가 다르면 던진다', () => {
  const d = rawDiff(solid(10, 10), solid(10, 20))
  assert.equal(d.ratio, 0.5)
  assert.equal(d.height, 20)
  assert.throws(() => rawDiff(solid(10, 10), solid(11, 10)), /너비/)
})

test('diff: PNG 두 장을 sharp 로 풀어 비교한다(같은 PNG 0 · 다른 PNG > 0)', async () => {
  const png = (rgb) => sharp({ create: { width: 40, height: 30, channels: 3, background: rgb } }).png().toBuffer()
  const white = await png({ r: 255, g: 255, b: 255 })
  assert.equal((await pngDiff(white, await png({ r: 255, g: 255, b: 255 }))).ratio, 0)
  assert.equal((await pngDiff(white, await png({ r: 0, g: 0, b: 0 }))).ratio, 1)
})

// ─── 실제 내보내기 1회 (잠금 안, STAMP_EXPORT_REAL=1) ───

test('real: local × 라이브러리 레시피 후보 한 쪽을 단일 HTML 로 내보내고 1440·375 스크린샷 차이가 0.5% 이하', { skip: process.env.STAMP_EXPORT_REAL !== '1' }, async () => {
  const { loadArchetypes } = await import('./archetypes.mjs')
  const { loadLibrary } = await import('./style-presets.mjs')
  const { openRun } = await import('../stamp/run-dir.mjs')
  const { buildSitemap, writeCandidateBlockers } = await import('../stamp/sitemap.mjs')
  const { chooseVariants } = await import('../stamp/variants.mjs')
  const { contentRequest, PLACEHOLDER } = await import('../stamp/content.mjs')
  const { generateSite } = await import('../stamp/gen-pages.mjs')
  const archetypes = await loadArchetypes()
  const library = loadLibrary()
  const runDir = process.env.STAMP_EXPORT_RUN ?? mkdtempSync(join(root, '.tmp', 'p3t13-run-'))
  mkdirSync(runDir, { recursive: true })
  const KO = { headline: '매일 아침 굽는 동네 빵집', tagline: '매일 아침 굽는 동네 식빵집', subhead: '우유와 밀가루만 넣어요', todayHours: '오늘 10:00~20:00에 열어요', addressLine: '서울특별시 마포구 달빛로 12, 1층', primaryCta: '전화로 자리 예약하기', secondaryCta: '가격표 열어 보기', item: '우유식빵', address: '서울특별시 마포구 달빛로 12, 1층', transit: '달빛역 2번 출구에서 걸어서 3분이에요', parking: '주차는 어려워요' }
  const facts = { name: '달빛 베이커리 (예시)', phone: '02-1234-5678', address: '서울특별시 마포구 달빛로 12, 1층', hours: '화-수 10:00-20:00', bizNo: '123-45-67890', email: 'hello@moonlight-bakery.kr', menu: '우유식빵 4,800원 · 소금빵 3,200원', faq: '주차·예약 안내', transit: '달빛역 2번 출구', parking: '주차 어려움', notice: '10월 3일 휴무', price: '식빵 4,800원' }
  const brief = { topic: '동네 식빵집', archetype: 'local', locale: 'ko', facts }
  const archetype = archetypes.local
  const sitemap = buildSitemap(archetype, brief)
  const c = { id: 'a', slot: 'library', source: 'library', recipe: process.env.STAMP_EXPORT_RECIPE ?? library.find((x) => x.id === 'r1-measure')?.id ?? library[0].id }
  const variants = chooseVariants(sitemap, [c], { seed: 7, weights: [] })
  const run = openRun(runDir)
  await run.step('a', '02-sitemap', {}, () => sitemap)
  await run.step('a', '03-variants', {}, () => variants.a)
  const request = contentRequest(c, sitemap, variants, 7, { archetype, brief })
  writeFileSync(join(runDir, 'a', '04-content.request.json'), JSON.stringify(request))
  const ph = PLACEHOLDER.ko
  const business = { ...request.seedContent.business }
  const content = {
    archetype: 'local', locale: 'ko', business,
    hours: [{ day: 'tu', opens: '10:00', closes: '20:00' }, { day: 'we', opens: '10:00', closes: '20:00' }],
    booking: { primary: { kind: 'tel', value: '02-1234-5678' } },
    mapLinks: { naver: 'https://map.naver.com/p/entry/place/1', kakao: 'https://place.map.kakao.com/1' },
    directions: { transit: KO.transit, parking: KO.parking },
    faq: [{ q: '주차가 되나요?', a: '주차는 어려워요.' }, { q: '예약이 필요한가요?', a: '전화로 예약하면 자리를 잡아 둬요.' }],
    menu: [{ name: '우유식빵', price: 4800 }, { name: '소금빵', price: 3200 }],
    facts: { ...request.seedContent.facts },
    slots: { copy: request.slots.map((s) => ({ id: s.id, role: s.role, text: s.placeholder ? ph : KO[s.id] ?? '자세한 내용은 물어봐 주세요.' })), images: [] },
  }
  await run.step('a', '04-content', {}, () => content)
  writeCandidateBlockers(runDir, 'a', sitemap)
  const site = await generateSite(runDir, c, { install: true, build: true, log: console.error })
  assert.equal(site.build.code, 0, `06-pages next build 종료 ${site.build.code} — ${site.build.log}`)
  const route = process.env.STAMP_EXPORT_ROUTE ?? '/'
  const beforeNext = existsSync(join(site.siteDir, '.next', 'BUILD_ID')) ? readFileSync(join(site.siteDir, '.next', 'BUILD_ID'), 'utf8') : null
  const r = await exportSingleHtml(site.siteDir, route, { log: console.error })
  const afterNext = existsSync(join(site.siteDir, '.next', 'BUILD_ID')) ? readFileSync(join(site.siteDir, '.next', 'BUILD_ID'), 'utf8') : null
  const out = { route, routes: site.routes, recipe: c.recipe, ...r, size: { bytes: r.bytes, kb: Math.round(r.bytes / 1024) }, buildIdKept: beforeNext === afterNext }
  if (process.env.STAMP_EXPORT_OUT) writeFileSync(process.env.STAMP_EXPORT_OUT, JSON.stringify(out, null, 2))
  console.error(JSON.stringify(out, null, 1))
  const html = readFileSync(r.file, 'utf8')
  assert.equal((html.match(/<link\b[^>]*rel=["']?stylesheet/gi) ?? []).length, 0)
  assert.deepEqual(r.external, [])
  for (const w of [1440, 375]) assert.ok(r.diff[w].ratio <= DIFF_BUDGET, `${w}px 서버 렌더 대비 차이 ${(r.diff[w].ratio * 100).toFixed(3)}% > 0.5%`)
  // 하이드레이션 뒤 화면과의 차이는 예산 밖 정보다(마운트 뒤에만 정해지는 값) — 도구가 눈먼 것이 아님을 보이는 양성 대조로도 쓴다: 값이 있고 숫자여야 한다
  for (const w of [1440, 375]) assert.ok(Number.isFinite(r.diffHydrated[w].ratio), `${w}px 하이드레이션 뒤 대비 값`)
  assert.equal(beforeNext, afterNext, '내보내기가 평소 .next 를 되돌려 놓았다')
})
