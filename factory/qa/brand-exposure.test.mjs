// 브랜드 주색 노출 관문 판정(v0.2.6 T10) — 순수 함수와 어댑터 배선만(가짜 측정기). 실제 Chrome 계측은 brand-exposure.browser.test.mjs 가 본다.
// 실행: node --test --test-force-exit --test-timeout=60000 factory/qa/brand-exposure.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { brandColorOf, brandExposureForCandidate, brandExposureGate, floorFor } from './brand-exposure.mjs'

const cand = (extra = {}) => ({ id: 'a', brand: { input: { colors: ['#1F6B4A', '#F4EFE3'] } }, ...extra })

test('brandExposureGate: 하한은 colorStrategy 별 — Restrained 1% · Committed 15% · 그 밖·없음 1%, 못 잰 값은 통과가 아니다', () => {
  assert.deepEqual(brandExposureGate(cand({ colorStrategy: 'Restrained' }), { ratio: 0.03 }), { pass: true, ratio: 0.03, floor: 0.01 })
  assert.equal(brandExposureGate(cand({ colorStrategy: 'Restrained' }), { ratio: 0 }).pass, false)
  assert.equal(brandExposureGate(cand({ colorStrategy: 'Committed' }), { ratio: 0.1 }).pass, false)
  assert.equal(brandExposureGate(cand({ colorStrategy: 'Committed' }), { ratio: 0.15 }).pass, true, '경계: 하한과 같으면 통과')
  assert.equal(brandExposureGate(cand({ head: { colorStrategy: 'Committed' } }), { ratio: 0.1 }).floor, 0.15, '후보 머리 칸에서도 읽는다')
  for (const s of ['Full', 'Drenched', undefined]) assert.equal(floorFor(s), 0.01)
  assert.equal(brandExposureGate(cand(), { ratio: undefined }).pass, false)
})

test('brandColorOf: 브랜드 역할과 같은 첫 유채색 — 색 없음 · 브랜드 없음 · 색 이름은 null(관문 생략)', () => {
  assert.equal(brandColorOf(cand()), '#1F6B4A')
  assert.equal(brandColorOf({ brand: { input: { colors: ['#0a0'] } } }), '#0a0')
  for (const c of [{}, { brand: { input: null } }, { brand: { input: {} } }, { brand: { input: { colors: [] } } }, { brand: { input: { colors: ['초록'] } } }]) assert.equal(brandColorOf(c), null)
})

test('brandExposureForCandidate: 통과면 사유 없음 · 미만이면 사유 한 줄과 결과 파일 · 측정기가 던지면 도구 실패(통과 아님) · 이전 결과 파일은 지운다', async () => {
  const runDir = mkdtempSync(join(tmpdir(), 'brand-exp-'))
  const seen = []
  const measure = (ratio) => async (origin, route, o) => { seen.push({ origin, route, o }); return { ratio, samples: 100 } }
  const pass = await brandExposureForCandidate(runDir, cand({ colorStrategy: 'Restrained' }), { origin: 'http://x.test', measure: measure(0.03) })
  assert.deepEqual([pass.verdict, pass.exit, pass.toolFailure, pass.problems], ['pass', 0, false, []])
  assert.deepEqual(seen[0], { origin: 'http://x.test', route: '/', o: { colorHex: '#1F6B4A', threshold: 0.07 } })
  const resultFile = join(runDir, 'a', pass.resultFile)
  assert.ok(existsSync(resultFile))
  const fail = await brandExposureForCandidate(runDir, cand({ colorStrategy: 'Committed' }), { origin: 'http://x.test', route: '/ko', measure: measure(0.04) })
  assert.deepEqual([fail.verdict, fail.exit, fail.toolFailure], ['fail', 1, false])
  assert.match(fail.problems[0], /\/ko 첫 화면\(1440px\)에서 주색 #1F6B4A 근처 면적이 4% — 하한 15% 미만/)
  assert.equal(JSON.parse(readFileSync(resultFile, 'utf8')).pass, false)
  const boom = await brandExposureForCandidate(runDir, cand(), { origin: 'http://x.test', measure: async () => { throw new Error('탐색 실패') } })
  assert.deepEqual([boom.verdict, boom.toolFailure], ['tool', true])
  assert.match(boom.note, /^도구 실패: 탐색 실패/)
  assert.equal(existsSync(resultFile), false, '도구 실패는 앞 실행의 결과 파일을 남기지 않는다')
})

test('brandColorOf: 흰 바탕을 주색으로 세지 않고 첫 유채색을 고른다', () => {
  const pick = (colors) => brandColorOf({ brand: { input: { colors } } })
  assert.equal(pick(['#fff', '#1F6B4A', '#f00']), '#1F6B4A')
  assert.equal(pick(['#111', '#1F6B4A', '#f00']), '#1F6B4A')
  assert.equal(pick(['#fff', '#777', '#111']), '#111')
  assert.equal(pick(['#fff']), null)
  assert.equal(pick([' #0a0 ']), '#0a0')
  assert.equal(pick(['invalid', '#0a0']), null)
  assert.equal(pick([42, '#0a0']), null)
  assert.equal(pick(['oklch(0.6 0.15 150)', '#f00']), null)
  assert.equal(pick(['oklch(1 0 0)', '#f00']), '#f00')
})
