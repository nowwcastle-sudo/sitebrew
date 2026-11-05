// v0.2.6 Phase A 불변 검사 — 06 코드 열쇠가 T0 기준값에서 움직이지 않았는지 본다.
// 왜 시험인가: 레인 PR 은 main 이 아닌 가지(feat/v026-compare-dashboard)로 가서 사람이 print-pages-key 를 돌려야만 열쇠가 지켜졌다.
// 이 시험은 ci:test 가벼운 묶음에 자동으로 들고, ci.yml 의 가지 필터(feat/v026-*)가 레인 PR 에서 돌린다.
// 수명: Phase B 첫 커밋(T17 앞)에서 이 파일을 지운다(Phase B 가 열쇠를 일부러 바꾼다). 공개 main 에 들어가지 않는다.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { importClosure, pagesCodeKey } from '../stamp/pages-key.mjs'

// T0 기준값(INTENT.md 「기준값」) — 25f3fdf(v0.2.5) 에서 잰 값.
const T0_KEY = '558068537354068902e1c7ba4b710093d026847033d75ff0667099ea97b50768'
const T0_CLOSURE_SIZE = 55

test('Phase A: 06 코드 열쇠가 T0 기준값과 같다', () => {
  const key = pagesCodeKey()
  assert.equal(
    key,
    T0_KEY,
    `06 코드 열쇠가 바뀌었다(${key}). Phase A(T1~T16)는 닫힘 안 파일을 고치지 않는다 — node factory/scripts/print-pages-key.mjs 로 닫힘 목록을 보고 고친 파일을 되돌린다. `
      + '(registry/factory/**·registry.json·package.json·site-template/**·gen-pages/ui-copy 가 import 하는 factory 모듈이 닫힘이다.)',
  )
})

test('Phase A: 닫힘 파일 수가 55개로 그대로다', () => {
  assert.equal(importClosure().length, T0_CLOSURE_SIZE, '닫힘 파일 수가 달라졌다 — 닫힘 안 파일에 import 를 더했거나 뺐다')
})
