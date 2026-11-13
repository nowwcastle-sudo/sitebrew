// palette-lib 의 측정 함수 시험 — SNS 수집과 colors.csv 측정이 같은 식을 쓰므로, 식이 바뀌면 두 보고서의 표가 함께 어긋난다.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  makeColor, css, selfCheck, hexToOklch, contrast, pairsOf, hueDist, hueSpread, clusters, harmony, accentCountOf,
  isCream, isPurpleDominant, tooManyAccents, spanBucket, SPAN_KEYS, minLBucket, MINL_KEYS, maxLBucket, MAXL_KEYS,
  HUE_BINS, PATTERNS, SNS_TOP10, patternTags,
} from './lib/palette-lib.mjs'

// 색 하나를 oklch 값으로 바로 만든다(판정 함수는 반올림한 oklch 만 읽는다).
const col = (L, C, H, hex = '#123456') => ({ hex, oklch: [L, C, H] })

test('hex → oklch → hex 왕복이 1/255 안이고, makeColor 는 # 유무·대소문자를 같게 읽는다', () => {
  for (const hex of ['000000', 'FFFFFF', 'ff0000', '0b6e4f', '7f7f7f', 'c0ffee']) {
    assert.ok(selfCheck(hex, hexToOklch(hex)) <= 1, hex)
  }
  const a = makeColor('#0b6e4f'), b = makeColor('0B6E4F')
  assert.deepEqual(a, b)
  assert.equal(a.hex, '#0B6E4F')
  assert.equal(a._rt <= 1, true)
  assert.match(css([0.5, 0.1, 120]), /^oklch\(0\.500000 0\.100000 120\.0000\)$/)
  assert.equal(hexToOklch('808080')[2], 0, '무채색의 색상각은 0 이다')
})

test('대비는 흑백 21:1, 같은 색 1:1 이고 pairsOf 는 모든 짝을 한 번씩 센다', () => {
  const [k, w, r] = ['#000000', '#FFFFFF', '#FF0000'].map(makeColor)
  assert.equal(contrast(k, w), 21)
  assert.equal(contrast(w, w), 1)
  const pairs = pairsOf([k, w, r])
  assert.deepEqual(pairs.map(([a, b]) => `${a}-${b}`), ['#000000-#FFFFFF', '#000000-#FF0000', '#FFFFFF-#FF0000'])
})

test('색상환 거리·퍼짐·묶음은 0°/360° 를 건너 잰다', () => {
  assert.equal(hueDist(350, 10), 20)
  assert.equal(hueSpread([10]), 0)
  assert.equal(Math.round(hueSpread([350, 10, 20])), 30)
  const cs = clusters([355, 5, 180])
  assert.equal(cs.length, 2)
  assert.ok(cs.some((h) => hueDist(h, 0) < 1), '355·5 는 0° 근처 한 묶음')
})

test('harmony 는 유채색 수와 색상 분포로 여덟 갈래를 가른다', () => {
  const kinds = (hs, extra = []) => harmony([...hs.map((h) => col(0.6, 0.15, h)), ...extra])[0]
  assert.equal(harmony([col(0.2, 0.01, 0), col(0.9, 0.02, 0)])[0], 'monochrome')
  assert.equal(harmony([col(0.2, 0.01, 0), col(0.6, 0.2, 30)])[0], 'neutral+accent')
  assert.equal(kinds([30, 50]), 'monochrome')
  assert.equal(kinds([30, 100]), 'analogous')
  assert.equal(kinds([20, 200]), 'complementary')
  assert.equal(kinds([0, 100]), 'analogous', '두 묶음이 120° 미만이면 넓은 유사색')
  assert.equal(kinds([0, 120, 240]), 'triad')
  assert.equal(kinds([0, 60, 200]), 'split')
  assert.equal(kinds([0, 90, 180, 270]), 'polychrome')
  assert.equal(accentCountOf([col(0.5, 0.05, 0), col(0.5, 0.049, 0)]), 1, 'C 0.05 부터 강조색')
})

test('금지 판정: 크림·보라 우세·강조색 셋 이상', () => {
  assert.equal(isCream(col(0.95, 0.03, 80)), true)
  assert.equal(isCream(col(0.95, 0.03, 120)), false)
  assert.equal(isPurpleDominant(col(0.5, 0.15, 290)), true)
  assert.equal(isPurpleDominant(col(0.5, 0.05, 290)), false)
  assert.equal(tooManyAccents(3), true)
  assert.equal(tooManyAccents(2), false)
})

test('빈도 구간은 경계값을 위 구간에 넣고, 키 목록에 있는 이름만 낸다', () => {
  assert.deepEqual([0.29, 0.3, 0.5, 0.7, 0.85].map((s) => spanBucket({ lightnessSpan: s })), SPAN_KEYS)
  assert.deepEqual([0.25, 0.4, 0.41].map((l) => minLBucket({ lightnessRange: [l, 1] })), MINL_KEYS)
  assert.deepEqual([0.95, 0.85, 0.84].map((l) => maxLBucket({ lightnessRange: [0, l] })), MAXL_KEYS)
  for (const h of [0, 29, 30, 75, 115, 165, 220, 265, 310, 340, 359]) {
    assert.equal(HUE_BINS.filter(([, f]) => f(h)).length, 1, `색상 ${h}° 는 한 칸에만`)
  }
})

test('패턴 태그: 각 패턴은 그 조건을 채운 행에서만 붙고, SNS 상위 10 은 모두 정의된 패턴이다', () => {
  const ids = PATTERNS.map(([id]) => id)
  for (const id of SNS_TOP10) assert.ok(ids.includes(id), id)
  const row = (colors, extra = {}) => {
    const Ls = colors.map((c) => c.oklch[0])
    const lightnessRange = [Math.min(...Ls), Math.max(...Ls)]
    return { colors, accentCount: accentCountOf(colors), harmony: harmony(colors)[0], lightnessRange, lightnessSpan: lightnessRange[1] - lightnessRange[0], ...extra }
  }
  const has = (r, id) => patternTags(r).includes(id)
  // 따뜻한 갈색 바닥 + 미색 바탕 + 중간 명도 + 차가운 색
  const warm = row([col(0.3, 0.05, 40), col(0.95, 0.02, 85, '#F7F1E6'), col(0.6, 0.08, 230), col(0.7, 0.12, 30)])
  for (const id of ['offwhite', 'warm_dark_anchor', 'dark_light_mid', 'cool_plus_warm_accent']) assert.ok(has(warm, id), id)
  for (const id of ['muted', 'navy_anchor', 'pure_white', 'two_color']) assert.ok(!has(warm, id), id)
  // 남색 바닥 + 순백 두 색 짝
  const pair = row([col(0.3, 0.08, 250), col(1, 0, 0, '#FFFFFF')])
  for (const id of ['navy_anchor', 'two_color', 'deep_pale_pair', 'pure_white', 'muted']) assert.ok(has(pair, id), id)
  // 무채 검정 + 흰 바탕 + 형광 둘
  const neon = row([col(0.15, 0.005, 0, '#111111'), col(0.97, 0.01, 90), col(0.9, 0.2, 130), col(0.6, 0.2, 20)])
  for (const id of ['neutral_black_anchor', 'neon_on_black', 'black_white_2vivid']) assert.ok(has(neon, id), id)
  assert.ok(!has(neon, 'black_white_1accent'), '강조색이 둘이면 1accent 가 아니다')
  // 극단 없음 + 단색 명도 경사 + 파스텔
  const mid = row([col(0.4, 0.02, 200), col(0.6, 0.03, 210), col(0.8, 0.04, 205)])
  assert.ok(has(mid, 'no_extremes'))
  const ramp = row([col(0.2, 0.1, 140), col(0.4, 0.1, 145), col(0.6, 0.1, 150), col(0.85, 0.06, 150)])
  assert.ok(has(ramp, 'single_hue_ramp'))
  const pastel = row([col(0.3, 0.02, 0), col(0.85, 0.05, 20), col(0.88, 0.06, 200)])
  assert.ok(has(pastel, 'pastels_dark_anchor'))
  const oneAccent = row([col(0.15, 0, 0), col(0.97, 0.01, 90), col(0.6, 0.15, 250)])
  assert.ok(has(oneAccent, 'black_white_1accent'))
})
