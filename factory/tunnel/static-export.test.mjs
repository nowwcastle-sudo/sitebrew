// static-export.mjs 시험 — next.config 가 output: "export" 인 폴더만 정적 내보내기로 가르고, 내보내기 폴더 이름을 정한다. 파일 읽기는 주입한다.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { exportDir } from './static-export.mjs'

/** { 파일 이름: 글 } 만 있는 가짜 폴더 */
const fsOf = (files) => ({ exists: (p) => Object.keys(files).some((n) => p.endsWith(n)), readFile: (p) => files[Object.keys(files).find((n) => p.endsWith(n))] })
const DIR = '/site'

test('output: "export" 면 기본 폴더 out 을 돌려준다(세 확장자 모두)', () => {
  for (const name of ['next.config.mjs', 'next.config.js', 'next.config.ts']) {
    assert.equal(exportDir(DIR, fsOf({ [name]: 'export default { output: "export", images: { unoptimized: true } }' })), 'out', name)
  }
})

test('작은따옴표·역따옴표·줄바꿈이 있어도 읽는다', () => {
  assert.equal(exportDir(DIR, fsOf({ 'next.config.mjs': "const c = {\n  output:\n    'export',\n}\nexport default c" })), 'out')
  assert.equal(exportDir(DIR, fsOf({ 'next.config.js': 'module.exports = { output: `export` }' })), 'out')
})

test('distDir 가 있으면 그 폴더를 돌려준다', () => {
  assert.equal(exportDir(DIR, fsOf({ 'next.config.mjs': 'export default { output: "export", distDir: "dist" }' })), 'dist')
})

test('주석 안의 output: export 는 무시한다', () => {
  assert.equal(exportDir(DIR, fsOf({ 'next.config.mjs': '// output: "export"\n/* output: "export" */\nexport default {}' })), null)
})

test('output 이 standalone 이거나 없거나 환경 변수로 갈리면 서버형이라 null', () => {
  assert.equal(exportDir(DIR, fsOf({ 'next.config.mjs': 'export default { output: "standalone" }' })), null)
  assert.equal(exportDir(DIR, fsOf({ 'next.config.mjs': 'export default {}' })), null)
  assert.equal(exportDir(DIR, fsOf({ 'next.config.ts': "const c = { output: process.env.WF_STATIC_EXPORT === '1' ? 'export' : undefined }\nexport default c" })), null)
})

test('설정 파일이 없거나 읽을 수 없으면 null(서버형으로 본다)', () => {
  assert.equal(exportDir(DIR, fsOf({})), null)
  assert.equal(exportDir(DIR, { exists: () => true, readFile: () => { throw new Error('EACCES') } }), null)
})
