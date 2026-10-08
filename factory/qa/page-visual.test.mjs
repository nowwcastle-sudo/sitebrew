// 쪽 시각 회귀·시계 고정 시험(P3-4 Task 7).
//  순수: 시계 고정 스크립트(vm — Date.now·new Date()·Date()·Intl 인자 없음은 고정, 인자 있는 Date 는 그대로) · 경로 → 파일 이름 · 칸 목록 · 고정 시각 오류
//  브라우저(가짜 서버 — 카운트다운·「지금 영업 중」·오늘 날짜가 있는 쪽, Chrome 하나):
//   · 고정 시계 아래 같은 쪽을 두 번(1.3초 간격) 찍으면 차이 0(A144)  · 음성 대조: 고정 없이 두 번 찍으면 문턱을 넘게 다르다
//   · 고정 시계 아래 「지금 영업 중」·카운트다운 글이 고정 시각 값이다(Asia/Seoul 12:00 → 영업 중, 남은 6:00:00)
//   · CLI: 촬영 → 같은 화면 비교 0 → 큰 변화는 종료 1 + 차이 이미지 → --owner-confirmed 없는 accept 는 종료 2 → accept → 다시 0 · 기준 없음은 실패 · 도구 실패는 요약 없음 · 골든 이름 검사
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { clockPinSource, pinMs, PIN_AT, PIN_TIMEZONE } from './clock-pin.mjs'
import { routeSlug, pageFile, pageJobs, capturePage } from './page-visual.mjs'
import { openSession, sleep } from '../board/block-board/page.mjs'
import { diffImages, judgeDiff, AREA_THRESHOLD } from '../board/block-board/visual.mjs'

// ── 순수 ──────────────────────────────────────────────────────────────────────────────────
const inVm = (src, code) => { const ctx = vm.createContext({}); vm.runInContext(src, ctx); return vm.runInContext(code, ctx) }
const FIXED = Date.parse('2026-06-15T12:00:00+09:00')

test('시계 고정: Date.now·new Date()·Date()·Intl 인자 없음은 고정, 인자 있는 Date 는 그대로', () => {
  const src = clockPinSource()
  assert.equal(inVm(src, 'Date.now()'), FIXED)
  assert.equal(inVm(src, 'new Date().getTime()'), FIXED)
  assert.equal(inVm(src, 'new Date().toISOString()'), '2026-06-15T03:00:00.000Z')
  assert.equal(inVm(src, 'Date()'), new Date(FIXED).toString())
  assert.equal(inVm(src, 'new Date(0).getTime()'), 0, '인자 있는 new Date 는 그대로')
  assert.equal(inVm(src, 'new Date(2020, 0, 1, 9).getFullYear()'), 2020)
  assert.equal(inVm(src, 'Date.UTC(2020, 0, 1)'), Date.UTC(2020, 0, 1))
  assert.equal(inVm(src, 'Date.parse("2021-01-01T00:00:00Z")'), Date.parse('2021-01-01T00:00:00Z'))
  assert.equal(inVm(src, 'new Date() instanceof Date'), true)
  assert.equal(inVm(src, 'new Date(5) instanceof Date'), true)
  assert.equal(inVm(src, 'new Date().constructor === Date'), true)
  // Intl: 인자 없는 format·formatToParts 가 고정 시각, 인자 있으면 그대로
  assert.equal(inVm(src, `new Intl.DateTimeFormat('en-US', { timeZone: 'UTC' }).format()`), '6/15/2026')
  assert.equal(inVm(src, `new Intl.DateTimeFormat('en-US', { timeZone: 'UTC' }).format(new Date(0))`), '1/1/1970')
  assert.equal(inVm(src, `new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', year: 'numeric' }).formatToParts().find((p) => p.type === 'year').value`), '2026')
  assert.equal(inVm(src, `[1, 2, 3].map(new Intl.DateTimeFormat('en-US', { timeZone: 'UTC' }).format).length`), 3, 'format 을 떼어 써도 깨지지 않는다')
})

test('시계 고정: 두 번 심어도 같다(이미 고정된 문서에 다시)', () => {
  const src = clockPinSource()
  const ctx = vm.createContext({})
  vm.runInContext(src, ctx)
  vm.runInContext(clockPinSource('2030-01-01T00:00:00Z'), ctx)
  assert.equal(vm.runInContext('Date.now()', ctx), FIXED, '먼저 건 고정이 이긴다 — 겹쳐 건다고 시각이 바뀌지 않는다')
})

test('시계 고정 시각: 숫자·ISO 를 받고 읽을 수 없으면 던진다', () => {
  assert.equal(pinMs(PIN_AT), FIXED)
  assert.equal(pinMs(1234), 1234)
  assert.throws(() => pinMs('내일 아침'), /읽을 수 없다/)
  assert.throws(() => clockPinSource('nope'), /읽을 수 없다/)
  assert.equal(PIN_TIMEZONE, 'Asia/Seoul')
})

test('경로 → 파일 이름 · 칸 목록', () => {
  assert.equal(routeSlug('/'), 'index')
  assert.equal(routeSlug(''), 'index')
  assert.equal(routeSlug('/pricing'), 'pricing')
  assert.equal(routeSlug('/a/b/'), 'a_b')
  assert.equal(routeSlug('/menu?x=1#top'), 'menu')
  assert.equal(pageFile('saas-g1', '/', 1440, 'light'), 'saas-g1/index-1440-light.webp')
  assert.equal(pageFile('saas-g1', '/account/cancel', 375, 'dark'), 'saas-g1/account_cancel-375-dark.webp')
  const jobs = pageJobs({ golden: 'g', routes: ['/', '/pricing'], widths: [1440, 375], themes: ['light', 'dark'] })
  assert.equal(jobs.length, 8)
  assert.deepEqual(jobs[0], { golden: 'g', route: '/', width: 1440, theme: 'light', file: 'g/index-1440-light.webp' })
  assert.throws(() => pageJobs({ golden: 'g', routes: ['/a/b', '/a_b'], widths: [1440], themes: ['light'] }), /겹친다/)
})

// ── 브라우저 ──────────────────────────────────────────────────────────────────────────────
let server, origin, tmp, mode = 'A', session
const TIME_PAGE = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>시간 의존 시험 쪽</title></head>
<body style="margin:0;font:32px sans-serif"><main>
<section id="cd" style="height:320px;display:flex;align-items:center;justify-content:center;color:#fff"><span>종료까지 <b id="left"></b></span></section>
<section id="hours" style="height:120px;padding:20px"><p>오늘은 <span id="today"></span> · <span id="open"></span></p></section>
</main>
<script>
const END = new Date('2026-06-15T18:00:00+09:00').getTime()
function render() {
  const ms = Math.max(0, END - Date.now()), s = Math.floor(ms / 1000)
  const p = (n) => String(n).padStart(2, '0')
  document.getElementById('left').textContent = p(Math.floor(s / 3600)) + ':' + p(Math.floor(s / 60) % 60) + ':' + p(s % 60)
  document.getElementById('cd').style.background = 'hsl(' + ((Math.floor(Date.now() / 1000) % 60) * 6) + ' 70% 35%)'
  document.getElementById('today').textContent = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'full' }).format()
  const h = new Date().getHours()
  document.getElementById('open').textContent = h >= 9 && h < 18 ? '지금 영업 중' : '영업 종료'
}
render(); setInterval(render, 100)
</script></body></html>`
const PRICING = (w) => `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>요금</title></head><body style="margin:0;background:#fff"><section style="height:400px"><div style="width:${w}px;height:100px;background:#1e40af"></div><p>요금 쪽</p></section></body></html>`

before(async () => {
  server = createServer((req, res) => {
    res.setHeader('content-type', 'text/html; charset=utf-8')
    if (req.url === '/') return res.end(TIME_PAGE)
    if (req.url.startsWith('/pricing')) return res.end(PRICING(mode === 'A' ? 120 : 375))
    res.statusCode = 404; res.end('없음')
  })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  origin = `http://127.0.0.1:${server.address().port}`
  tmp = mkdtempSync(join(tmpdir(), 'page-visual-test-'))
})
after(async () => { await session?.close().catch(() => {}); server?.close(); rmSync(tmp, { recursive: true, force: true }) })

test('고정 시계 아래 같은 쪽을 두 번 찍으면 차이 0 · 음성 대조: 고정 없이 두 번 찍으면 문턱을 넘게 다르다 (A144)', async () => {
  session = await openSession()
  const url = `${origin}/`
  const a1 = await capturePage(session, url, { width: 375, theme: 'light' })
  await sleep(1300) // 카운트다운·배경색이 1초 단위로 바뀌므로 간격을 둔다
  const a2 = await capturePage(session, url, { width: 375, theme: 'light' })
  const same = await diffImages(a1.png, a2.png)
  assert.equal(same.sizeMismatch, false)
  assert.equal(same.changed, 0, `고정 시계 아래 두 번 찍은 차이가 0 이어야 한다(나온 값 ${same.changed}칸)`)
  assert.equal(judgeDiff(same), false)
  // 음성 대조 — 같은 쪽·같은 간격, 고정만 뺀다
  const b1 = await capturePage(session, url, { width: 375, theme: 'light', pin: null })
  await sleep(1300)
  const b2 = await capturePage(session, url, { width: 375, theme: 'light', pin: null })
  const moved = await diffImages(b1.png, b2.png)
  assert.ok(moved.ratio > AREA_THRESHOLD, `고정 없이 찍으면 문턱(${AREA_THRESHOLD * 100}%)을 넘게 달라야 한다(나온 값 ${(moved.ratio * 100).toFixed(3)}%)`)
  assert.equal(judgeDiff(moved), true, '회귀 검사가 흔들림을 실패로 읽는다 — 그래서 고정이 필요하다')
  // 다크도 같다
  const d1 = await capturePage(session, url, { width: 1440, theme: 'dark' })
  await sleep(1100)
  const d2 = await capturePage(session, url, { width: 1440, theme: 'dark' })
  assert.equal((await diffImages(d1.png, d2.png)).changed, 0)
})

test('고정 시계 아래 글: Asia/Seoul 12:00 → 「지금 영업 중」·남은 06:00:00·고정 날짜, 다른 시각으로 고정하면 글이 바뀐다', async () => {
  session ??= await openSession()
  const read = async (pin) => {
    await capturePage(session, `${origin}/`, { width: 375, theme: 'light', pin })
    return session.ev(`[document.getElementById('left').textContent, document.getElementById('open').textContent, document.getElementById('today').textContent].join('|')`)
  }
  assert.equal(await read({ at: PIN_AT, timezone: PIN_TIMEZONE }), '06:00:00|지금 영업 중|2026년 6월 15일 월요일')
  // 밤 9시(서울)로 고정하면 영업 종료, 남은 시간 0 — 고정 값이 글에 실제로 들어간다(시험이 기본값만 우연히 맞추지 않는다)
  assert.equal(await read({ at: '2026-06-15T21:00:00+09:00', timezone: 'Asia/Seoul' }), '00:00:00|영업 종료|2026년 6월 15일 월요일')
  // 같은 순간을 다른 시간대로 읽으면 날짜·영업 판정이 호스트가 아니라 고정 시간대를 따른다: UTC 03:00 은 뉴욕 전날 23:00
  assert.match(await read({ at: '2026-06-15T03:00:00Z', timezone: 'America/New_York' }), /^06:00:00\|영업 종료\|2026년 6월 14일 일요일$/)
})

// ── CLI ───────────────────────────────────────────────────────────────────────────────────
const cli = (args) => new Promise((resolve) => {
  const p = spawn(process.execPath, [fileURLToPath(new URL('./page-visual.mjs', import.meta.url)), ...args], { stdio: ['ignore', 'pipe', 'pipe'] })
  let out = '', err = ''
  p.stdout.on('data', (d) => { out += d }); p.stderr.on('data', (d) => { err += d })
  p.on('exit', (code) => resolve({ code, out, err }))
})
const base = (name = 'base') => join(tmp, name)
const ARGS = (extra = {}) => ['g1', '--origin', origin, '--routes', extra.routes ?? '/pricing', '--widths', '375', '--themes', 'light', '--baseline', base(extra.base), '--out', join(tmp, 'out')]
const FILE = join('g1', 'pricing-375-light.webp')

test('CLI: 촬영 → 같은 화면 비교 0 → 큰 변화는 종료 1 + 차이 이미지 → 확인 없는 accept 는 2 → accept → 다시 0', async () => {
  mode = 'A'
  const cap = await cli(['--capture', ...ARGS()])
  assert.equal(cap.code, 0, cap.err)
  assert.ok(existsSync(join(base(), FILE)), '기준 파일이 골든 이름 폴더 아래 만들어졌다')
  assert.equal((await sharp(readFileSync(join(base(), FILE))).metadata()).width, 375)
  const same = await cli(['--compare', ...ARGS()])
  assert.equal(same.code, 0, same.out + same.err)
  mode = 'B'
  const changed = await cli(['--compare', ...ARGS()])
  assert.equal(changed.code, 1, changed.out)
  const s = JSON.parse(readFileSync(join(tmp, 'out', 'summary.json'), 'utf8'))
  assert.equal(s.failed, 1)
  assert.equal(s.rows[0].status, 'fail')
  assert.ok(s.rows[0].ratio > AREA_THRESHOLD)
  assert.ok(existsSync(s.rows[0].diffFile), '차이 이미지가 있다')
  assert.deepEqual(s.clock, { at: PIN_AT, timezone: PIN_TIMEZONE }, '요약에 시계 고정 조건이 남는다')
  const before = readFileSync(join(base(), FILE))
  const noConfirm = await cli(['--accept', ...ARGS()])
  assert.equal(noConfirm.code, 2, '운영자 확인(--owner-confirmed) 없이는 accept 하지 않는다')
  assert.match(noConfirm.err, /owner-confirmed/)
  assert.ok(readFileSync(join(base(), FILE)).equals(before), '거절된 accept 는 기준을 건드리지 않는다')
  const acc = await cli(['--accept', '--owner-confirmed', ...ARGS()])
  assert.equal(acc.code, 0, acc.err)
  assert.ok(!readFileSync(join(base(), FILE)).equals(before), '기준이 갈렸다')
  const after = await cli(['--compare', ...ARGS()])
  assert.equal(after.code, 0, after.out + after.err)
})

test('CLI: 시간 의존 쪽(/)은 고정 시계 아래 촬영·비교가 0 차이 · 기준 없는 칸은 통과가 아니라 실패', async () => {
  mode = 'A'
  const cap = await cli(['--capture', ...ARGS({ routes: '/', base: 'base-time' })])
  assert.equal(cap.code, 0, cap.err)
  assert.ok(existsSync(join(base('base-time'), 'g1', 'index-375-light.webp')))
  await sleep(1200)
  const cmp = await cli(['--compare', ...ARGS({ routes: '/', base: 'base-time' })])
  assert.equal(cmp.code, 0, cmp.out + cmp.err)
  assert.equal(JSON.parse(readFileSync(join(tmp, 'out', 'summary.json'), 'utf8')).rows[0].ratio, 0)
  const empty = await cli(['--compare', ...ARGS({ base: 'empty-base' })])
  assert.equal(empty.code, 1)
  const s = JSON.parse(readFileSync(join(tmp, 'out', 'summary.json'), 'utf8'))
  assert.equal(s.noBaseline, 1)
  assert.equal(s.rows[0].status, 'no-baseline')
})

test('CLI: 도구 실패(서버 없음·404 쪽)는 종료 1 + 「도구 실패:」 + 요약 없음(이전 요약도 지운다) · 인자 오류는 2', async () => {
  mkdirSync(join(tmp, 'out'), { recursive: true })
  writeFileSync(join(tmp, 'out', 'summary.json'), '{"stale":true}')
  const down = await cli(['--compare', 'g1', '--origin', 'http://127.0.0.1:1', '--routes', '/pricing', '--widths', '375', '--themes', 'light', '--baseline', base(), '--out', join(tmp, 'out')])
  assert.equal(down.code, 1)
  assert.match(down.err, /도구 실패:/)
  assert.equal(existsSync(join(tmp, 'out', 'summary.json')), false)
  writeFileSync(join(tmp, 'out', 'summary.json'), '{"stale":true}')
  const gone = await cli(['--compare', ...ARGS({ routes: '/없는쪽' })])
  assert.equal(gone.code, 1)
  assert.match(gone.err, /도구 실패:.*HTTP 404/)
  assert.equal(existsSync(join(tmp, 'out', 'summary.json')), false)
  assert.equal((await cli(['--compare'])).code, 2, '골든 이름이 없다')
  assert.equal((await cli(['--capture', '--compare', 'g1'])).code, 2, '모드가 둘이다')
  assert.equal((await cli(['--capture', '../escape'])).code, 2, '골든 이름에 경로를 못 쓴다')
  assert.equal((await cli(['--capture', 'g1', '--themes', 'sepia'])).code, 2)
})
