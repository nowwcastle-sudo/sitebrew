// 로고 시안을 Chrome 으로 실제로 찍는다(v0.2.6 T14). Chrome 이 없으면 건너뛴다 — 무거운 시험 목록(ci/tests-heavy.txt).
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, test } from 'node:test'
import sharp from 'sharp'
import { chromePath } from '../qa/cdp.mjs'
import { makeLogoCandidates } from './logo-candidates.mjs'

let hasChrome = true
try { chromePath() } catch { hasChrome = false }
const SKIP = hasChrome ? false : 'Chrome 이 없다(CHROME_PATH)'
const dirs = []
const tmp = () => { const d = mkdtempSync(join(tmpdir(), 'logo-test-')); dirs.push(d); return d }
after(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }) })
const INPUT = { name: '새벽빵', mood: '따뜻한', colors: ['#0F7B5F', '#F59E0B'] }
const pixels = async (file) => { const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); return { ...info, data } }

test('Codex 없이 6개: 높이는 머리글의 2배, 바탕은 투명, 브랜드 색이 실제로 칠해지고 시트가 같이 나온다', { skip: SKIP, timeout: 120000 }, async () => {
  const outDir = tmp()
  const r = await makeLogoCandidates({ ...INPUT, outDir })
  assert.equal(r.items.length, 6)
  for (const it of r.items) {
    const p = await pixels(it.path)
    assert.equal(p.height, 80)
    assert.equal(p.width, it.width)
    assert.equal(p.data[3], 0, `${it.id}번 시안의 모서리는 투명`)
    let brand = 0
    for (let i = 0; i < p.data.length; i += 4) if (p.data[i + 3] > 200 && Math.abs(p.data[i] - 0x0f) < 12 && Math.abs(p.data[i + 1] - 0x7b) < 12 && Math.abs(p.data[i + 2] - 0x5f) < 12) brand++
    assert.ok(brand > 100, `${it.id}번 시안에 브랜드 주색 픽셀이 ${brand}개뿐`)
  }
  assert.ok(existsSync(join(outDir, 'sheet.png')) && existsSync(join(outDir, 'sheet.html')))
  assert.ok((await sharp(r.sheet).metadata()).width > 300)
})

test('같은 입력이면 같은 그림이다(Codex 제외)', { skip: SKIP, timeout: 120000 }, async () => {
  const hash = async (r) => createHash('sha256').update(Buffer.concat(await Promise.all(r.items.map(async (it) => (await pixels(it.path)).data)))).digest('hex')
  assert.equal(await hash(await makeLogoCandidates({ ...INPUT, outDir: tmp() })), await hash(await makeLogoCandidates({ ...INPUT, outDir: tmp() })))
})

test('Codex 기호: 성공하면 흰 바탕이 빠진 채 6번 자리에 들어가고, 실패하면 던지지 않고 기하 기호로 채우며 까닭을 남긴다', { skip: SKIP, timeout: 120000 }, async () => {
  const src = tmp()
  const raw = Buffer.alloc(64 * 64 * 4, 255)
  for (let y = 16; y < 48; y++) for (let x = 16; x < 48; x++) raw.set([0, 0, 255, 255], (y * 64 + x) * 4) // 흰 바탕 한가운데 파란 네모
  const file = join(src, 'codex.png')
  writeFileSync(file, await sharp(raw, { raw: { width: 64, height: 64, channels: 4 } }).png().toBuffer())
  const ok = await makeLogoCandidates({ ...INPUT, outDir: tmp(), codex: true }, { codexImage: async () => ({ file }) })
  assert.equal(ok.items.length, 6)
  assert.equal(ok.items[5].symbol, 'codex')
  assert.equal(ok.warnings, undefined)
  const p = await pixels(ok.items[5].path)
  let blue = 0
  for (let i = 0; i < p.data.length; i += 4) if (p.data[i + 3] > 200 && p.data[i + 2] > 200 && p.data[i] < 60) blue++
  assert.ok(blue > 200, `Codex 기호가 그려지지 않았다(파란 픽셀 ${blue})`)

  const bad = await makeLogoCandidates({ ...INPUT, outDir: tmp(), codex: true }, { codexImage: async () => { throw new Error('도구 실패: codex 로그인 없음') } })
  assert.equal(bad.items.length, 6)
  assert.ok(bad.items.every((it) => it.symbol === 'geometric'))
  assert.match(bad.warnings[0], /codex 로그인 없음/)
})

test('Chrome 이 없으면 던지지 않고 skipped: no-chrome 이다 · 이름이 없으면 던진다', async () => {
  const none = await makeLogoCandidates({ ...INPUT, outDir: join(tmpdir(), 'logo-never') }, { chromePath: () => { throw new Error('Chrome/Edge not found') } })
  assert.deepEqual(none, { sheet: null, items: [], skipped: 'no-chrome' })
  assert.ok(!existsSync(join(tmpdir(), 'logo-never')), '아무것도 쓰지 않는다')
  await assert.rejects(makeLogoCandidates({ ...INPUT, name: '  ', outDir: tmp() }), /이름/)
})
