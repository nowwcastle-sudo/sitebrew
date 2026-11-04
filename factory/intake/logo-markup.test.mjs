// 로고 시안의 순수 부분(v0.2.6 T14) — 명세 구성·입력 방어·서체 폴더·흰 바탕 투명화. 브라우저 없음. Chrome 으로 찍는 쪽은 logo-candidates.browser.test.mjs.
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import sharp from 'sharp'
import { extraFontFiles, whiteToAlpha } from './logo-assets.mjs'
import { geometricMark, logoPageHtml, logoSpecs, paletteOf, sheetHtml } from './logo-markup.mjs'

test('시안 명세: 글자형 2 + 기호+글자 4, Codex 는 켰을 때만 한 칸이고 추가 서체는 글자형으로 뒤에 붙는다', () => {
  const off = logoSpecs()
  assert.deepEqual(off.map((s) => s.kind), ['wordmark', 'wordmark', 'mark+wordmark', 'mark+wordmark', 'mark+wordmark', 'mark+wordmark'])
  assert.ok(off.every((s) => s.symbol === 'geometric'))
  const on = logoSpecs({ codex: true, extraFonts: ['LogoExtra1'] })
  assert.equal(on.filter((s) => s.symbol === 'codex').length, 1)
  assert.equal(on.length, 7)
  assert.deepEqual(on.at(-1), { id: 7, kind: 'wordmark', symbol: 'geometric', face: 'LogoExtra1', mark: null })
})

test('사용자 입력 방어: 상호의 HTML 은 이스케이프되고, 색 코드가 아닌 말은 기본 색으로 돌아가며, 모르는 기호 모양은 던진다', () => {
  const palette = paletteOf(['초록', 'red', '#0F7B5F'])
  assert.deepEqual(palette, { ink: '#0F7B5F', accent: '#0F7B5F' }) // 올바른 코드만 남는다
  assert.equal(paletteOf([]).ink, '#1F2937')
  const html = logoPageHtml({ specs: logoSpecs(), fonts: [], name: '<img src=x onerror=alert(1)>', palette, softness: 'balanced', headerHeight: 40 })
  assert.ok(!html.includes('<img src=x'), '상호가 태그로 실리지 않는다')
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'))
  assert.throws(() => geometricMark('nope', palette), /모르는 기호 모양/)
})

test('시트: 시안마다 1배(폭의 절반)와 2배(PNG 그대로) 이미지가 한 줄에 있다', () => {
  const html = sheetHtml({ items: [{ id: 1, kind: 'wordmark', width: 172, height: 80 }, { id: 2, kind: 'mark+wordmark', width: 264, height: 80 }], name: '새벽빵', headerHeight: 40 })
  assert.equal([...html.matchAll(/data-scale="1"><img src="(\d)\.png" width="(\d+)" height="40"/g)].map((m) => `${m[1]}:${m[2]}`).join(','), '1:86,2:132')
  assert.equal([...html.matchAll(/data-scale="2"><img src="(\d)\.png" width="(\d+)" height="80"/g)].map((m) => `${m[1]}:${m[2]}`).join(','), '1:172,2:264')
})

test('WF_LOGO_FONT_DIR: 브랜드 서체 이름에 맞는 파일만(최대 둘), 이름이 없으면 앞의 둘, 폴더가 없으면 없음', () => {
  const dir = mkdtempSync(join(tmpdir(), 'logo-fonts-'))
  try {
    for (const f of ['A-Brand-Sans.otf', 'Other.woff2', 'Zeta.otf', 'readme.txt']) writeFileSync(join(dir, f), 'x')
    assert.deepEqual(extraFontFiles(dir, ['Brand Sans']).map((p) => p.split(/[\\/]/).pop()), ['A-Brand-Sans.otf'])
    assert.deepEqual(extraFontFiles(dir, ['없는 서체']), []) // 맞는 것이 없으면 관계없는 서체를 끼우지 않는다
    assert.deepEqual(extraFontFiles(dir, []).map((p) => p.split(/[\\/]/).pop()), ['A-Brand-Sans.otf', 'Other.woff2'])
    assert.deepEqual(extraFontFiles(join(dir, 'missing'), ['x']), [])
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('Codex 그림의 흰 바탕은 투명이 되고 기호의 색은 그대로 남는다', async () => {
  const size = 12
  const raw = Buffer.alloc(size * size * 4, 255) // 불투명 흰색
  for (let y = 4; y < 8; y++) for (let x = 4; x < 8; x++) raw.set([220, 20, 20, 255], (y * size + x) * 4)
  const png = await sharp(raw, { raw: { width: size, height: size, channels: 4 } }).png().toBuffer()
  const out = await sharp(await whiteToAlpha(png)).raw().toBuffer()
  assert.equal(out[3], 0, '모서리(흰 바탕)는 투명')
  const mid = (5 * size + 5) * 4
  assert.deepEqual([...out.subarray(mid, mid + 4)], [220, 20, 20, 255])
})
