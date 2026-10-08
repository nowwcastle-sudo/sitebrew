// 시각 회귀 시험(Task 7a Step 4).
//  순수: 같은 이미지 차이 0 · 한 점만 바뀌면 문턱 안 · 1% 영역이 바뀌면 실패 · 채널 차 16 이하는 무시·17 부터 셈 · 크기가 다르면 실패
//  브라우저(가짜 서버 — 갤러리 모양 한 쪽): 촬영 → 같은 화면 비교 0 → 화면이 1% 넘게 바뀌면 종료 1 + 실패 목록·차이 이미지 → accept → 다시 비교 0 → 기준 없음은 실패 → 도구 실패는 요약 없음
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { diffImages, judgeDiff, AREA_THRESHOLD, CHANNEL_DIFF } from './visual.mjs'

const png = (w, h, fill, patch) => {
  const buf = Buffer.alloc(w * h * 4)
  for (let i = 0; i < w * h; i++) buf.set([...fill, 255], i * 4)
  if (patch) for (let y = patch.y; y < patch.y + patch.h; y++) for (let x = patch.x; x < patch.x + patch.w; x++) buf.set([...patch.rgb, 255], (y * w + x) * 4)
  return sharp(buf, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer()
}

test('같은 이미지: 차이 0', async () => {
  const a = await png(100, 100, [255, 255, 255])
  const d = await diffImages(a, a)
  assert.equal(d.changed, 0)
  assert.equal(d.ratio, 0)
  assert.equal(judgeDiff(d), false)
})

test('한 점만 바꾼 이미지: 0.01% 라 문턱(0.5%) 안', async () => {
  const d = await diffImages(await png(100, 100, [255, 255, 255]), await png(100, 100, [255, 255, 255], { x: 3, y: 3, w: 1, h: 1, rgb: [0, 0, 0] }))
  assert.equal(d.changed, 1)
  assert.equal(judgeDiff(d), false)
})

test('1% 영역(10×10 / 100×100)이 바뀌면 실패 — 문턱은 0.5%', async () => {
  assert.equal(AREA_THRESHOLD, 0.005)
  const d = await diffImages(await png(100, 100, [255, 255, 255]), await png(100, 100, [255, 255, 255], { x: 10, y: 10, w: 10, h: 10, rgb: [0, 0, 0] }))
  assert.equal(d.changed, 100)
  assert.equal(d.ratio, 0.01)
  assert.equal(judgeDiff(d), true)
  assert.ok(d.diff, '차이 이미지가 나온다')
  // 경계 대조: 0.4%(40픽셀)는 통과, 0.6%(60픽셀)는 실패
  assert.equal(judgeDiff(await diffImages(await png(100, 100, [255, 255, 255]), await png(100, 100, [255, 255, 255], { x: 0, y: 0, w: 40, h: 1, rgb: [0, 0, 0] }))), false)
  assert.equal(judgeDiff(await diffImages(await png(100, 100, [255, 255, 255]), await png(100, 100, [255, 255, 255], { x: 0, y: 0, w: 60, h: 1, rgb: [0, 0, 0] }))), true)
})

test('채널 차 16 이하는 무시하고 17 부터 센다(무손실이 아닌 부호화 잡음을 삼킨다)', async () => {
  assert.equal(CHANNEL_DIFF, 16)
  const base = await png(50, 50, [100, 100, 100])
  assert.equal((await diffImages(base, await png(50, 50, [116, 100, 100]))).changed, 0)
  assert.equal((await diffImages(base, await png(50, 50, [117, 100, 100]))).changed, 2500)
})

test('크기가 다르면 비교하지 않고 실패한다', async () => {
  const d = await diffImages(await png(100, 100, [255, 255, 255]), await png(100, 120, [255, 255, 255]))
  assert.equal(d.sizeMismatch, true)
  assert.equal(judgeDiff(d), true)
})

// ── CLI(가짜 서버 + Chrome) ────────────────────────────────────────────────────────────────────
let server, origin, tmp, page = 'A'
const html = (w) => `<!doctype html><html><body style="margin:0;background:#fff"><div data-qa-block="b" data-qa-ready><section data-block="faq-two-column-index" style="height:400px"><div style="width:${w}px;height:100px;background:#1e40af"></div><p>시험 화면</p></section></div></body></html>`
before(async () => {
  server = createServer((req, res) => { res.setHeader('content-type', 'text/html; charset=utf-8'); res.end(html(page === 'A' ? 120 : 375)) })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  origin = `http://127.0.0.1:${server.address().port}`
  tmp = mkdtempSync(join(tmpdir(), 'visual-test-'))
})
after(() => { server?.close(); rmSync(tmp, { recursive: true, force: true }) })

const cli = (args) => new Promise((resolve) => {
  const p = spawn(process.execPath, [fileURLToPath(new URL('./visual.mjs', import.meta.url)), ...args], { stdio: ['ignore', 'pipe', 'pipe'] })
  let out = '', err = ''
  p.stdout.on('data', (d) => { out += d }); p.stderr.on('data', (d) => { err += d })
  p.on('exit', (code) => resolve({ code, out, err }))
})
const ARGS = (baseDir = 'base') => ['--only', 'block-faq-two-column-index', '--recipes', 'r1-measure', '--widths', '375', '--themes', 'light', '--baseline', join(tmp, baseDir), '--out', join(tmp, 'out')]
const FILE = join('base', 'block-faq-two-column-index', 'r1-measure-375-light.webp')

test('촬영 → 같은 화면 비교 0 → 큰 변화는 종료 1 + 차이 이미지 → accept → 다시 0', async () => {
  page = 'A'
  const cap = await cli(['--capture', origin, ...ARGS()])
  assert.equal(cap.code, 0, cap.err)
  assert.ok(existsSync(join(tmp, FILE)), '기준 파일이 만들어졌다')
  assert.equal((await sharp(readFileSync(join(tmp, FILE))).metadata()).width, 375)
  const same = await cli(['--compare', origin, ...ARGS()])
  assert.equal(same.code, 0, same.out + same.err)
  page = 'B' // 파란 막대가 120px → 375px: 문서의 약 6% 가 바뀐다
  const changed = await cli(['--compare', origin, ...ARGS()])
  assert.equal(changed.code, 1, changed.out)
  const s = JSON.parse(readFileSync(join(tmp, 'out', 'summary.json'), 'utf8'))
  assert.equal(s.failed, 1)
  assert.equal(s.rows[0].status, 'fail')
  assert.ok(s.rows[0].ratio > AREA_THRESHOLD)
  assert.ok(existsSync(s.rows[0].diffFile), '차이 이미지가 있다')
  const acc = await cli(['--accept', origin, ...ARGS()])
  assert.equal(acc.code, 0, acc.err)
  const after = await cli(['--compare', origin, ...ARGS()])
  assert.equal(after.code, 0, after.out + after.err)
})

test('기준이 없는 칸은 통과가 아니라 실패(기준 없음)', async () => {
  page = 'A'
  const r = await cli(['--compare', origin, ...ARGS('empty-base')])
  assert.equal(r.code, 1)
  const s = JSON.parse(readFileSync(join(tmp, 'out', 'summary.json'), 'utf8'))
  assert.equal(s.noBaseline, 1)
  assert.equal(s.rows[0].status, 'no-baseline')
})

test('도구 실패(서버 없음)는 종료 1 + 「도구 실패:」 + 요약 없음(이전 요약도 지운다)', async () => {
  mkdirSync(join(tmp, 'out'), { recursive: true })
  writeFileSync(join(tmp, 'out', 'summary.json'), '{"stale":true}')
  const r = await cli(['--compare', 'http://127.0.0.1:1', ...ARGS()])
  assert.equal(r.code, 1)
  assert.match(r.err, /도구 실패:/)
  assert.equal(existsSync(join(tmp, 'out', 'summary.json')), false)
})
