// FV1 FOLLOW — C391①(web-factory 쪽): 3D 오브젝트 히어로를 쓴 사이트의 전달 README 에만 「이미지 → GLB → 표시, 도구가 없으면 2.5D → 포스터 → 고르지 않음」 한 줄(ko·en).
// 실행: node --test --test-force-exit --test-timeout=200000 factory/scripts/stamp-follow-c391.test.mjs
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { after, test } from 'node:test'
import { deliver, renderReadme } from '../stamp/deliver.mjs'

const hangul = /[ㄱ-ㆎ가-힣]/
const base = { name: '예시', dir: '/x', runCmd: 'cd x', archetype: 'brand', completion: 'site', blockers: [] }
const tmp = mkdtempSync(join(tmpdir(), 'fv1-follow-c391-'))
after(() => { rmSync(tmp, { recursive: true, force: true }) })

test('C391①: objectHero 일 때만 README 에 3D 오브젝트 히어로 한 줄이 ko·en 로 든다(영어 쪽에는 한글이 없다)', () => {
  const md = renderReadme({ ...base, objectHero: true })
  const en = md.slice(md.indexOf('## English'))
  assert.match(md.slice(0, md.indexOf('## English')), /3D 오브젝트 첫 화면.*이미지.*GLB.*2\.5D.*포스터.*고르지 않아요/s)
  assert.match(en, /3D object hero.*image.*GLB.*2\.5D.*poster.*does not pick/s)
  assert.doesNotMatch(en, hangul)
  for (const t of [renderReadme(base), renderReadme({ ...base, objectHero: false })]) assert.doesNotMatch(t, /GLB/, '그 히어로를 안 쓴 사이트에는 한 줄이 없다')
})

function fakeRun(name, sections) {
  const runDir = join(tmp, name)
  const site = join(runDir, 'a', 'site')
  mkdirSync(join(site, 'content'), { recursive: true })
  writeFileSync(join(site, 'package.json'), '{"name":"x"}')
  writeFileSync(join(site, 'content', 'site.json'), JSON.stringify({ archetype: 'brand', business: { name: '달빛 공방(예시)' }, sections }))
  return runDir
}

test('C391①: deliver 는 site.json 에 object-3d-orbit 블록이 있는 사이트만 README 에 그 줄을 싣는다', async () => {
  const withHero = await deliver(fakeRun('with', { 'home/hero': { block: 'block-hero-object-3d-orbit', props: {} } }), 'a', { to: join(tmp, 'out-with') })
  const without = await deliver(fakeRun('without', { 'home/hero': { block: 'block-hero-banded-full-bleed', props: {} } }), 'a', { to: join(tmp, 'out-without') })
  assert.match(readFileSync(withHero.readme, 'utf8'), /GLB/)
  assert.doesNotMatch(readFileSync(without.readme, 'utf8'), /GLB/)
})
