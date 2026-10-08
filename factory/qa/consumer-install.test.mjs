// consumer-install: 인자 해석과 의존 주소 로컬화(순수 함수). 실제 설치(init·add·build)는 네트워크·무거운 빌드라 시험 밖이다 — 사용법은 도구 머리말.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { parseArgs, localize } from './consumer-install.mjs'

const tool = fileURLToPath(new URL('./consumer-install.mjs', import.meta.url))

test('parseArgs: 항목·파일·fetch·포트를 읽는다', () => {
  const o = parseArgs(['--dir', 'D:/x', '--add', 'r1-measure,font-boogaloo', '--file', 'app/opengraph-image.tsx=a.tsx', '--build', '--fetch', '/opengraph-image:image/png', '--port', '4980'])
  assert.deepEqual(o.add, ['r1-measure', 'font-boogaloo'])
  assert.deepEqual(o.files, [{ dst: 'app/opengraph-image.tsx', src: 'a.tsx' }])
  assert.deepEqual(o.fetch, [{ path: '/opengraph-image', type: 'image/png' }])
  assert.equal(o.port, 4980)
  assert.equal(o.build, true)
  assert.equal(o.batch, false)
  assert.equal(parseArgs(['--dir', 'x', '--add', 'a,b', '--batch']).batch, true)
})

test('parseArgs: 음성 대조 — --dir·--add 없음, --fetch 만, 잘못된 경로·포트·모르는 인자는 던진다', () => {
  assert.throws(() => parseArgs(['--add', 'a']), /--dir/)
  assert.throws(() => parseArgs(['--dir', 'x']), /--add/)
  assert.throws(() => parseArgs(['--dir', 'x', '--add', 'a', '--fetch', '/a']), /--build/)
  assert.throws(() => parseArgs(['--dir', 'x', '--add', 'a', '--build', '--fetch', 'a']), /--fetch/)
  assert.throws(() => parseArgs(['--dir', 'x', '--add', 'a', '--port', '80']), /--port/)
  assert.throws(() => parseArgs(['--dir', 'x', '--add', 'a', '--nope']), /알 수 없는/)
  assert.throws(() => parseArgs(['--dir', '--add', 'a']), /--dir 값/)
})

test('localize: 이 저장소 주소만 ../localreg 로 바꾸고 나머지·없는 의존은 그대로', () => {
  const { item, changed } = localize({ name: 'x', registryDependencies: ['nowwcastle-sudo/sitebrew/utils#v0.0.6', 'https://ui.shadcn.com/r/styles/new-york-v4/button.json', '../localreg/y.json'] })
  assert.equal(changed, 1)
  assert.deepEqual(item.registryDependencies, ['../localreg/utils.json', 'https://ui.shadcn.com/r/styles/new-york-v4/button.json', '../localreg/y.json'])
  const none = localize({ name: 'z' })
  assert.equal(none.changed, 0)
  assert.equal('registryDependencies' in none.item, false)
  assert.equal(localize({ name: 'w', registryDependencies: ['nowwcastle-sudo/sitebrew/utils'] }).changed, 0, '태그 없는 주소는 바꾸지 않는다(항상 태그로 고정)')
})

test('CLI: 인자 오류는 종료 2, --dry-run 은 설치 없이 계획만 찍고 0', () => {
  assert.equal(spawnSync(process.execPath, [tool, '--add', 'a']).status, 2)
  const r = spawnSync(process.execPath, [tool, '--dir', 'D:/nowhere-wf', '--add', 'r1-measure', '--dry-run'], { encoding: 'utf8' })
  assert.equal(r.status, 0)
  assert.equal(JSON.parse(r.stdout).add[0], 'r1-measure')
})
