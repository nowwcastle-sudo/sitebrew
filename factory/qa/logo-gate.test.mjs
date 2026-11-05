// 머리글 로고 관문 판정(v0.2.6 T9) — 순수 함수와 파일 읽기만. Chrome 계측은 logo-gate.browser.test.mjs 가 본다.
// 실행: node --test --test-force-exit --test-timeout=60000 factory/qa/logo-gate.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { hasBrandLogo, judgeLogo, logoGateForCandidate } from './logo-gate.mjs'

const IMG = { present: true, kind: 'img', renderedHeight: 36, naturalWidth: 300, complete: true }

test('judgeLogo: 그림·마스크·SVG 로고가 20px 이상이면 통과, 글자뿐 · 깨진 그림 · 20px 미만 · 로고 칸 없음은 각각 다른 사유', () => {
  assert.deepEqual(judgeLogo({ '1440-light': IMG, '375-light': { ...IMG, kind: 'mask', complete: true }, '375-dark': { ...IMG, kind: 'svg' } }), { pass: true, problems: [] })
  const bad = judgeLogo({
    a: { ...IMG, kind: 'text', naturalWidth: 0, renderedHeight: 21 },
    b: { ...IMG, naturalWidth: 0, complete: false },
    c: { ...IMG, renderedHeight: 12 },
    d: { present: false, kind: 'none', renderedHeight: 0, naturalWidth: 0, complete: false },
  })
  assert.equal(bad.pass, false)
  assert.deepEqual(bad.problems.map((p) => p.split(':')[0]), ['a', 'b', 'c', 'd'])
  assert.match(bad.problems[0], /글자로 그려졌어요/)
  assert.match(bad.problems[1], /깨졌거나/)
  assert.match(bad.problems[2], /12px/)
  assert.match(bad.problems[3], /로고 칸이 머리글에 없어요/)
  assert.equal(judgeLogo({ ok: IMG, small: { ...IMG, renderedHeight: 20 } }).pass, true, '경계: 정확히 20px 는 통과')
})

test('judgeLogo: 잰 값이 하나도 없으면 통과가 아니라 던진다(못 잰 값은 통과가 아니다)', () => {
  assert.throws(() => judgeLogo({}), /로고 계측이 하나도 없다/)
  assert.throws(() => judgeLogo({ '1440-light': undefined }), /로고 계측이 하나도 없다/)
})

test('logoGateForCandidate: ux_gate.json 이 없거나 로고 계측이 없으면 도구 실패 · 글자뿐이면 판정 실패 · 그림이면 통과', () => {
  const dir = mkdtempSync(join(tmpdir(), 'logo-gate-'))
  const file = join(dir, 'ux_gate.json')
  const cand = { id: 'a' }
  const write = (gate) => writeFileSync(file, JSON.stringify({ gate }))
  const missing = logoGateForCandidate(cand, { uxGateFile: file })
  assert.deepEqual([missing.verdict, missing.toolFailure], ['tool', true])
  write({ '1440-light': { topNav: true } }) // 옛 ux-gate 가 남긴 파일: logo 칸이 없다
  assert.equal(logoGateForCandidate(cand, { uxGateFile: file }).toolFailure, true)
  write({ '1440-light': { logo: { ...IMG, kind: 'text' } }, '375-light': { logo: IMG } })
  const fail = logoGateForCandidate(cand, { uxGateFile: file })
  assert.deepEqual([fail.verdict, fail.exit, fail.toolFailure, fail.id, fail.tool], ['fail', 1, false, 'logo', 'logo'])
  assert.equal(fail.problems.length, 1)
  write({ '1440-light': { logo: IMG }, '375-light': { logo: IMG } })
  assert.deepEqual(logoGateForCandidate(cand, { uxGateFile: file }).verdict, 'pass')
})

test('hasBrandLogo: 후보의 브랜드 입력에 로고 경로가 있을 때만 — 공백·없음·브랜드 없음은 로고 없음(관문 생략)', () => {
  assert.equal(hasBrandLogo({ brand: { input: { logo: '/x/logo.svg' } } }), true)
  for (const c of [{}, { brand: {} }, { brand: { input: {} } }, { brand: { input: { logo: '  ' } } }, null]) assert.equal(hasBrandLogo(c), false)
})
