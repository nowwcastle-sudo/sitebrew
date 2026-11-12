// v0.2.6 T18 — 예시 띠·법정 초안·JSON-LD: 예시 값(sample-facts.json)이 사이트에 남았을 때만 띠를 달고, 법정 초안·구조 데이터에는 싣지 않는다. 파일이 없으면 출력이 그대로다.
// 정적 검사(설치·빌드 없음). 실행: node --test --test-force-exit --test-timeout=300000 factory/scripts/stamp-sample-band.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'
import { root, localBrief, localContent, LOCAL_FACTS, makeRun as makeRunIn, gen } from './lib/stamp-site-fixtures.mjs'
import { ENUM_KEYS, blankSamples, readSampleTable, remainingKeys, samplePaths } from '../stamp/sample-band.mjs'

const TMP = join(root, '.tmp', 'stamp-sample-band-test')
const read = (...p) => readFileSync(join(...p), 'utf8')
const drafts = (runDir) => { const dir = join(runDir, 'a', '07-qa', 'legal'); return readdirSync(dir).filter((f) => f.endsWith('.draft.json')).map((f) => read(dir, f)).join('\n') }
const SAMPLE_FACTS = { phone: '02-0000-0000', email: 'hello@example.com', bizNo: '123-45-67890', address: '서울특별시 예시구 예시로 00길 0' }
const writeSample = (runDir, facts = SAMPLE_FACTS, over = {}) => writeFileSync(join(runDir, 'sample-facts.json'), JSON.stringify({ version: 1, label: '예시 정보 — 공개 불가', facts, ...over }))
const exampleBrief = () => localBrief({ ...LOCAL_FACTS, ...SAMPLE_FACTS })

test('sample-band: 예시 표 읽기 — 없는 파일·낡은 판·모양 틀림은 null, 열거형 키만 뺀다', () => {
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

test('sample-band: 짧은 예시 값(홍길동·예시상회·$29)도 표에 들고, 부분 글자 찾기는 칸 전체 일치로만 센다 · 열거형 목록은 sample-facts 의 scan:false 와 같다', () => {
  mkdirSync(TMP, { recursive: true })
  const run = mkdtempSync(join(TMP, 'short-'))
  writeSample(run, { representative: '홍길동', seller: '예시상회', price: '$29', returnsFeePayer: 'buyer' })
  const { table } = readSampleTable(run)
  assert.deepEqual(Object.keys(table).sort(), ['price', 'representative', 'seller'])
  assert.deepEqual(remainingKeys({ a: { name: '홍길동', cost: '$299' } }, table), ['representative'], '$299 는 $29 가 아니다')
  assert.deepEqual(remainingKeys({ cost: '$29' }, table), ['price'])
  assert.equal(blankSamples({ r: '홍길동' }, table, '확인 필요').r, '확인 필요', '법정 초안에서 대표자 예시가 빠진다')
  const src = readFileSync(join(root, 'factory', 'stamp', 'sample-facts.mjs'), 'utf8')
  const scanFalse = [...src.matchAll(/^\s{2}(\w+): \{[^\n]*scan: false/gm)].map((m) => m[1]).sort()
  assert.deepEqual([...ENUM_KEYS].sort(), scanFalse)
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
  assert.match(src, /shell: _h, sample: _sample, \.\.\.content \} = seoSite/, 'seoContent 가 sample 을 뺀다')
  assert.match(src, /text-xs leading-snug md:text-sm/, '띠 글자는 12px(데스크톱 14px)·두 줄 안에 든다')
  assert.match(src, /resolve\(content\.site, seoSite\)/, 'site 칸은 예시 값을 지운 사본에서 푼다')
})

test('T18 SEO: 페이지 제목·설명의 $ref 가 예시 값을 다시 드러내지 않는다', async () => {
  const lib = join(root, 'factory', 'stamp', 'site-template', 'lib')
  const src = read(lib, 'site.tsx')
  const site = {
    locale: 'ko', business: { phone: '02-0000-0000', name: '달빛' },
    site: { description: { $ref: 'business.phone' } },
    pages: { '/': { title: { $ref: 'business.name' }, description: { $ref: 'business.phone' } } },
    sample: { scrub: ['business.phone'] },
  }
  const code = `const siteJson = ${JSON.stringify(site)}\nconst NEEDS_CHECK = '확인 필요', NEEDS_CHECK_EN = 'To be confirmed'\n${read(lib, 'sample-scrub.ts')}\n${src.slice(src.indexOf('type Ref ='), src.indexOf('export const pageTitle'))}`
  const js = ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
  const { pageSeo, seoContent, contentAt } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)
  assert.equal(pageSeo('/').title, '달빛')
  assert.equal(pageSeo('/').description, '확인 필요')
  assert.equal(seoContent().site.description, '확인 필요')
  assert.equal(contentAt('business.phone'), '02-0000-0000', '시안 본문은 예시 정보를 보여 준다')
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
