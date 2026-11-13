// 브랜드 주색 노출 계측(v0.2.6 T10) — 실제 Chrome 으로 고정 쪽(1440×900)에서 주색 칸 비율을 잰다. Chrome 필요(heavy 목록).
// 판정(하한·사유)은 brand-exposure.test.mjs 가 본다. 여기서는 「쪽을 칠해 센 값이 맞는가」만 본다.
// 실행: node --test --test-force-exit --test-timeout=300000 factory/qa/brand-exposure.browser.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { measureBrandExposureAt } from './brand-exposure.mjs'

const origin = pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'brand')).href
const at = (page) => measureBrandExposureAt(origin, `/${page}.html`, { colorHex: '#1F6B4A', threshold: 0.07 })

test('주색 칸 비율: 32px 띠는 약 3.5% · 주색이 없으면 0 · 겹쳐 쌓은 같은 색 상자는 한 번만 센다 · 글자색·테두리색도 센다', async () => {
  const strip = await at('strip') // 1440×32 → 8px 칸 4줄 / 113줄
  assert.equal(strip.samples, 180 * 113)
  assert.ok(Math.abs(strip.ratio - 4 / 113) < 0.002, `띠 비율 ${strip.ratio}`)
  assert.equal((await at('none')).ratio, 0)
  const nested = await at('nested') // 180px 띠 안에 같은 색 상자 둘이 100% 높이로 겹쳐 있다 — 더하면 60% 근처가 된다
  assert.ok(Math.abs(nested.ratio - 23 / 113) < 0.002, `겹친 상자를 한 번만 센다 — ${nested.ratio}`)
  const text = await at('text') // 주색 큰 글자 한 줄 + 위 테두리 8px 한 줄
  assert.ok(text.ratio > 0.04 && text.ratio < 0.2, `글자·테두리 비율 ${text.ratio}`)
})

test('연한 글자가 주색 상자 위에 있어도 상자는 주색으로 센다 — 글자 줄 상자가 바탕을 지우지 않는다(v0.2.6 골든 brand-1 c: 초록 상자·버튼이 0.5% 로 잰 결함)', async () => {
  const box = await at('textbox') // 글자 크기에 딱 맞는 초록 상자 하나(글자색은 연한 초록빛 흰색)
  assert.ok(box.ratio > 0.03, `주색 상자 비율 ${box.ratio}`)
})

test('투명한 부모 아래의 주색은 화면에 보이지 않으므로 세지 않는다', async () => {
  assert.equal((await at('invisible')).ratio, 0)
})

test('그림이 가린 주색 바탕은 노출로 세지 않는다 — img·배경 그림이 띠를 덮으면 0, 절반만 덮으면 약 절반 · 덮지 않은 띠는 그대로 센다(정상 선례)', async () => {
  const band = 23 / 113 // 180px 띠 = 8px 칸 23줄
  assert.ok((await at('media-img')).ratio < 0.002, '사진이 덮은 주색 띠를 노출로 셌다')
  assert.ok((await at('media-bg')).ratio < 0.002, '배경 그림이 덮은 주색 띠를 노출로 셌다')
  const half = await at('media-half')
  assert.ok(Math.abs(half.ratio - band / 2) < 0.006, `절반만 덮은 띠 ${half.ratio}`)
  assert.ok(Math.abs((await at('nested')).ratio - band) < 0.002, '정상 선례: 덮지 않은 띠')
})
