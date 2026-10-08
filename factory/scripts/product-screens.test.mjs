// 제품 화면 레퍼런스 references/product-screens/sources.json 검사(P3-6 REFS). 모양·표 생성은 build-product-screens.mjs.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { AREAS, MD_PATH, loadDoc, problems, renderMd } from './build-product-screens.mjs'

const doc = loadDoc()

test('inbox 76 rows merged, no schema problems', () => {
  assert.equal(doc.rows.length, 76)
  assert.deepEqual(problems(doc), [])
})

test('per-source counts match the inbox (KRDS 19, GOV.UK 22, KWCAG 11, W3C 7, law 7, dgov 3, others 7)', () => {
  const n = (s) => doc.rows.filter((r) => r.source === s).length
  assert.equal(n('KRDS'), 19)
  assert.equal(n('GOV.UK'), 22)
  assert.equal(n('KWCAG 2.2'), 11)
  assert.equal(n('W3C'), 7)
  assert.equal(n('법제처'), 7)
  assert.equal(n('디지털정부 UI·UX 가이드라인'), 3)
})

test('every area has at least one row', () => {
  for (const [key] of AREAS) assert.ok(doc.rows.some((r) => r.area === key), key)
})

test('only pointers: summary stays short, no images or html', () => {
  for (const r of doc.rows) {
    assert.ok(r.summary.length <= 200, `${r.id} ${r.summary.length}`)
    assert.ok(!/<[a-z]|!\[/i.test(r.summary + r.pattern), r.id)
  }
})

test('sources.md is in sync with sources.json', () => {
  assert.equal(readFileSync(MD_PATH, 'utf8'), renderMd(doc))
})
