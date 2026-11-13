// v0.2.6 T0c — 계열·거리 점검 모듈의 순수 함수와 결정성(풀 파일만 읽는다, 브라우저 없음).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { distance, materialFamily, reportFor, reportAll, renderMarkdown, main, SNAPSHOT_FILE, MIN_DISTANCE } from './lib/world-spread-report.mjs'

const head = (axes, extra = {}) => ({ axes, motion: 'M1', defaultTheme: 'light', ...extra })

test('materialFamily: 앞에서부터 첫 일치', () => {
  assert.equal(materialFamily(head({ surface: 'C5' })), 'glass')
  assert.equal(materialFamily(head({ texture: 'X3', surface: 'C5' })), 'glass') // 유리가 콜라주보다 앞
  assert.equal(materialFamily(head({ texture: 'X2' })), 'print')
  assert.equal(materialFamily(head({ shadow: 'S3' })), 'paper')
  assert.equal(materialFamily(head({ display: 'D3' })), 'kinetic')
  assert.equal(materialFamily(head({ header: 'H5' })), 'editorial')
  assert.equal(materialFamily(head({ radius: 'R0', table: 'T4' }, { defaultTheme: 'dark' })), 'terminal')
  assert.equal(materialFamily(head({ radius: 'R1' })), 'plain')
})

test('distance: 칸이 다른 수, 빈 칸은 기본값(D1·X0)으로 본다', () => {
  assert.equal(distance(head({}), head({ display: 'D1', texture: 'X0' })), 0)
  assert.equal(distance(head({ surface: 'C1' }), head({ surface: 'C2', header: 'H3' })), 2)
  assert.equal(distance(head({}), head({}, { defaultTheme: 'dark' })), 1)
  assert.ok(MIN_DISTANCE === 2)
})

test('reportFor: 같은 입력이면 같은 글이고 조합 수가 풀 크기와 맞는다', () => {
  const r = reportFor('saas')
  assert.ok(r.libraryPool > 0 && r.generatedPool > 0)
  const g = r.generatedPool
  assert.equal(r.triples, r.libraryPool * ((g * (g - 1)) / 2))
  assert.ok(r.distOk <= r.triples && r.famOk <= r.distOk)
  assert.equal(renderMarkdown([r]), renderMarkdown([reportFor('saas')]))
})

test('main: 인자 없으면 표를 내보내고, --write 면 준 파일에 같은 표를 쓴다(저장소 스냅샷은 건드리지 않는다)', (t) => {
  const md = renderMarkdown(reportAll())
  const out = []
  main([], { out: (s) => out.push(s) })
  assert.deepEqual(out, [md])
  const dir = mkdtempSync(join(tmpdir(), 'world-spread-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const file = join(dir, 'nested', 'snapshot.md')
  out.length = 0
  main(['--write'], { file, out: (s) => out.push(s) })
  assert.equal(readFileSync(file, 'utf8'), md)
  assert.deepEqual(out, [`wrote ${file}\n`])
  assert.ok(SNAPSHOT_FILE.split(/[\\/]/).slice(-3).join('/') === 'docs/qa/v026-world-spread.md')
})
