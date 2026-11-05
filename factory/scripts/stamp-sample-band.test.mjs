// v0.2.6 T18 — 예시 띠·법정 초안·JSON-LD: 예시 값(sample-facts.json)이 사이트에 남았을 때만 띠를 달고, 법정 초안·구조 데이터에는 싣지 않는다. 파일이 없으면 출력이 그대로다.
// 정적 검사(설치·빌드 없음). 실행: node --test --test-force-exit --test-timeout=300000 factory/scripts/stamp-sample-band.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'
import { root, localBrief, localContent, LOCAL_FACTS, makeRun as makeRunIn, gen } from './lib/stamp-site-fixtures.mjs'
import { blankSamples, readSampleTable, remainingKeys, samplePaths } from '../stamp/sample-band.mjs'

const TMP = join(root, '.tmp', 'stamp-sample-band-test')
const read = (...p) => readFileSync(join(...p), 'utf8')
const drafts = (runDir) => { const dir = join(runDir, 'a', '07-qa', 'legal'); return readdirSync(dir).filter((f) => f.endsWith('.draft.json')).map((f) => read(dir, f)).join('\n') }
const SAMPLE_FACTS = { phone: '02-0000-0000', email: 'hello@example.com', bizNo: '123-45-67890', address: '서울특별시 예시구 예시로 00길 0' }
const writeSample = (runDir, facts = SAMPLE_FACTS, over = {}) => writeFileSync(join(runDir, 'sample-facts.json'), JSON.stringify({ version: 1, label: '예시 정보 — 공개 불가', facts, ...over }))
const exampleBrief = () => localBrief({ ...LOCAL_FACTS, ...SAMPLE_FACTS })

test('sample-band: 예시 표 읽기 — 없는 파일·낡은 판·모양 틀림은 null, 6자 미만 값은 뺀다', () => {
  mkdirSync(TMP, { recursive: true })
  const run = mkdtempSync(join(TMP, 'unit-'))
  assert.equal(readSampleTable(run), null)
  writeFileSync(join(run, 'sample-facts.json'), '{ 깨짐')
  assert.equal(readSampleTable(run), null)
  writeSample(run, SAMPLE_FACTS, { version: 2 })
  assert.equal(readSampleTable(run), null)
  writeSample(run, { ...SAMPLE_FACTS, returnsFeePayer: 'buyer' })
  const t = readSampleTable(run)
  assert.deepEqual(Object.keys(t.table).sort(), ['address', 'bizNo', 'email', 'phone'])
  assert.equal(t.label, '예시 정보 — 공개 불가')
})

test('sample-band: 글자 그대로 같은 칸만 예시로 본다 — 경로·남은 키·비우기(받은 값은 안 바꾼다)', () => {
  const table = { phone: '02-0000-0000', email: 'hello@example.com' }
  const content = { business: { phone: '02-0000-0000', email: 'real@shop.kr', name: '달빛' }, list: [{ tel: ' 02-0000-0000 ' }] }
  assert.deepEqual(samplePaths(content, table), ['business.phone', 'list.0.tel'])
  assert.deepEqual(remainingKeys(content, table), ['phone'], '실제 메일로 바꾼 사실은 남은 예시가 아니다')
  const frozen = JSON.stringify(content)
  const blank = blankSamples(content, table, '확인 필요')
  assert.equal(blank.business.phone, '확인 필요'); assert.equal(blank.business.email, 'real@shop.kr'); assert.equal(JSON.stringify(content), frozen)
})

test('T18 generateSite: 예시 값이 남으면 site.json 에 sample(개수·경로)을 싣고, 법정 초안은 그 값을 쓰지 않는다 · 파일이 없으면 예전 그대로', async () => {
  const withSample = await makeRunIn(TMP, exampleBrief(), localContent)
  writeSample(withSample.runDir)
  const s = await gen(withSample)
  const site = JSON.parse(read(s.siteDir, 'content', 'site.json'))
  assert.equal(site.sample.label, '예시 정보 — 공개 불가')
  assert.ok(site.sample.count >= 3, `남은 예시 ${site.sample.count}`)
  for (const path of ['business.phone', 'business.email']) assert.ok(site.sample.scrub.includes(path), `${path} 가 JSON-LD 에서 빠질 칸이다`)
  const draft = drafts(withSample.runDir)
  assert.ok(!draft.includes('123-45-67890') && !draft.includes('02-0000-0000') && !draft.includes('hello@example.com'), '예시 값이 법정 초안에 들어갔다')
  assert.match(draft, /확인 필요/)

  const plain = await makeRunIn(TMP, exampleBrief(), localContent)
  const p = await gen(plain)
  assert.equal('sample' in JSON.parse(read(p.siteDir, 'content', 'site.json')), false, '예시 파일이 없으면 site.json 에 sample 이 없다')
  assert.ok(drafts(plain.runDir).includes('hello@example.com'), '파일이 없으면 초안은 사실을 그대로 쓴다')
})

test('T18 generateSite: 예시를 모두 실제 값으로 바꿨으면 띠도 없다(파일이 남아 있어도)', async () => {
  const R = await makeRunIn(TMP, localBrief(), localContent) // LOCAL_FACTS 의 실제 값 — 예시 표와 겹치는 글자가 없다
  writeSample(R.runDir, { phone: '02-0000-0000', email: 'hello@example.com', address: '서울특별시 예시구 예시로 00길 0' })
  const site = JSON.parse(read((await gen(R)).siteDir, 'content', 'site.json'))
  assert.equal('sample' in site, false)
})

test('T18 템플릿: 예시 띠는 모든 쪽 SiteShell banner 로, 구조 데이터 입력(seoContent)에서는 sample 을 빼고 예시 칸을 자리 표시로 바꾼다', () => {
  const src = read(root, 'factory', 'stamp', 'site-template', 'lib', 'site.tsx')
  assert.match(src, /site\.sample \? \{ banner: <SampleBand count=\{site\.sample\.count\} \/>/)
  assert.match(src, /이 시안에는 예시 정보 \$\{n\}개가 들어 있어요\. 공개 전에 실제 정보로 바꿔야 해요\./)
  assert.match(src, /This draft contains \$\{n\} sample details\. Replace them with real ones before publishing\./)
  assert.match(src, /shell: _h, sample, \.\.\.content \} = site/, 'seoContent 가 sample 을 뺀다')
  assert.match(src, /text-xs leading-snug md:text-sm/, '띠 글자는 12px(데스크톱 14px)·두 줄 안에 든다')
})

test('T18 scrubSamples: 예시 칸만 자리 표시로 바꾸고 받은 값·다른 칸은 그대로 둔다', async () => {
  const file = join(root, 'factory', 'stamp', 'site-template', 'lib', 'sample-scrub.ts')
  const out = join(TMP, 'sample-scrub.mjs'); mkdirSync(TMP, { recursive: true })
  writeFileSync(out, ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText)
  const { scrubSamples } = await import(pathToFileURL(out).href)
  const content = { business: { phone: '02-0000-0000', email: 'real@shop.kr' }, branches: [{ tel: '02-0000-0000' }] }
  const frozen = JSON.stringify(content)
  const got = scrubSamples(content, ['business.phone', 'branches.0.tel', 'nope.deep.path'], '확인 필요')
  assert.deepEqual(got, { business: { phone: '확인 필요', email: 'real@shop.kr' }, branches: [{ tel: '확인 필요' }] })
  assert.equal(JSON.stringify(content), frozen)
})
