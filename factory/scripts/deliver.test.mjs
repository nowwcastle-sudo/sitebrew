// 전달(factory v1 Task 4.5 · 합의안 D15) — 고른 안의 site/ 를 사용자 폴더로 복사(node_modules·.next 제외) + 실행 안내 README(ko·en) + saas·pwa 는 launch-factory 연결 안내
// + 미리보기 배포는 VERCEL_TOKEN 이 있을 때만(assertPreviewOnly). Review Focus 3: 사용자 폴더 경로에 공백·한글이 있어도(`홍 길동\내 사이트`) 복사·README·상대 경로가 깨지지 않는다.
// 실제 06(generateSite, install: false)이 만든 사이트로 시험한다 — 실제 Vercel 호출은 없다(deploy 를 주입한다).
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { after, before, test } from 'node:test'
import { DELIVER_COPY, deliver, parseDeliverArgs, renderReadme } from '../stamp/deliver.mjs'
import { gen, localBrief, localContent, makeRun, root, SAAS_BRIEF, saasContent } from './lib/stamp-site-fixtures.mjs'

const BASE = join(root, '.tmp', 'deliver-test')
mkdirSync(BASE, { recursive: true })
const tmp = mkdtempSync(join(BASE, 't-'))
const ODD = join(tmp, '홍 길동') // 공백과 한글이 든 사용자 폴더(Windows 의 C:\Users\홍 길동 같은 경로)
let saas, local
before(async () => {
  // 실행 폴더 자체도 공백·한글 경로 아래에 만든다 — 입구·찍어내기·전달이 모두 같은 경로에서 돈다
  saas = await makeRun(join(ODD, '실행 폴더'), SAAS_BRIEF, saasContent)
  await gen(saas)
  local = await makeRun(join(tmp, 'plain'), localBrief(), localContent)
  await gen(local)
})
after(() => { rmSync(tmp, { recursive: true, force: true }) })

const files = (d) => readdirSync(d, { recursive: true }).map(String).filter((p) => statSync(join(d, p)).isFile()).map((p) => p.split('\\').join('/')).sort()
const sha = (f) => createHash('sha256').update(readFileSync(f)).digest('hex')
const EXCLUDED = ['node_modules/pkg/index.js', '.next/BUILD_ID', '.next-export/index.html', '.vercel/project.json', '.env.local', 'tsconfig.tsbuildinfo']
function plantJunk(siteDir) {
  for (const f of EXCLUDED) { mkdirSync(join(siteDir, f, '..'), { recursive: true }); writeFileSync(join(siteDir, f), 'junk') }
}

test('공백·한글 경로(홍 길동\\내 사이트)로 복사된다 — 파일 목록·내용·상대 경로가 그대로이고 node_modules·.next·비밀 파일은 빠진다(Review Focus 3)', async () => {
  const siteDir = join(saas.runDir, 'a', 'site')
  plantJunk(siteDir)
  const to = join(ODD, '내 사이트')
  const r = await deliver(saas.runDir, 'a', { to })
  assert.equal(r.dir, resolve(to))
  assert.ok(r.dir.includes('홍 길동') && r.dir.includes('내 사이트'))
  const src = files(siteDir)
  const dst = files(to)
  const kept = src.filter((p) => !/^(?:node_modules|\.next|\.next-export|\.vercel)\//.test(p) && p !== '.env.local' && !p.endsWith('.tsbuildinfo'))
  assert.deepEqual(dst.filter((p) => p !== 'README.md' && p !== 'AGENTS.md' && !p.startsWith('.sitebrew/')), kept, '복사 목록이 원본에서 빠질 것만 뺀 것이다(.sitebrew 는 넘긴 것 기록 — 계획 5 Task 9)')
  for (const junk of EXCLUDED) assert.equal(existsSync(join(to, junk)), false, `${junk} 는 복사하지 않는다`)
  for (const p of ['package.json', 'content/site.json', 'app/layout.tsx', 'lib/site.tsx', 'app/page.tsx']) {
    assert.ok(existsSync(join(to, p)), p)
    assert.equal(sha(join(to, p)), sha(join(siteDir, p)), `${p} 내용이 같다`)
  }
  // 원본 경로(공백·한글 포함)가 복사본의 텍스트 파일 어디에도 박혀 있지 않다 — 상대 경로만 쓴다
  const needles = [saas.runDir, saas.runDir.split('\\').join('/')]
  for (const p of dst) {
    if (!/\.(?:json|tsx?|mjs|css|md|txt|svg)$/.test(p)) continue
    const text = readFileSync(join(to, p), 'utf8')
    for (const n of needles) assert.ok(!text.includes(n), `${p} 에 원본 절대 경로가 있다`)
  }
  // 원본은 그대로
  assert.ok(existsSync(join(siteDir, 'node_modules/pkg/index.js')))
  assert.equal(r.runCmd, `cd "${resolve(to)}" && npm install && npm run dev`)
  assert.ok(r.copied === kept.length && r.readme === join(to, 'README.md'))
})

test('README(ko·en): 실행 방법·폴더 안내·공개 전에 채울 것(공개 불가 사유)·경로 따옴표 — 경로에 공백·한글이 있어도 그대로', async () => {
  const to = join(ODD, '내 사이트 README')
  const r = await deliver(saas.runDir, 'a', { to })
  const md = readFileSync(join(to, 'README.md'), 'utf8')
  assert.match(md, /^# /m)
  assert.ok(md.indexOf('## 한국어') >= 0 && md.indexOf('## English') > md.indexOf('## 한국어'), '한국어 다음 영어')
  for (const needle of ['npm install', 'npm run dev', 'npm run build', 'npm start', 'http://localhost:3000', `cd "${resolve(to)}"`, 'content/site.json', 'Node.js 20.9']) assert.ok(md.includes(needle), needle)
  const ko = md.slice(md.indexOf('## 한국어'), md.indexOf('## English'))
  const en = md.slice(md.indexOf('## English'))
  assert.match(ko, /[가-힣]/)
  assert.doesNotMatch(en.split(resolve(to)).join(''), /[가-힣]/, '영어 쪽에는 한글이 없다(사용자 폴더 경로 인용만 빼고)')
  // 공개 불가 사유가 숨지 않는다: 파일에 있는 blockers 수와 첫 사유가 README 에 있다
  const blockers = JSON.parse(readFileSync(join(saas.runDir, 'a', 'candidate.json'), 'utf8')).blockers
  assert.ok(blockers.length > 3)
  assert.ok(md.includes(String(blockers.length)))
  assert.ok(md.includes(blockers[0].replace(/^공개 불가 — /, '')))
  assert.equal(r.blockers, blockers.length)
  assert.match(ko, /공개하기 전에/)
  assert.match(en, /before you (?:go live|publish)/i)
})

test('saas·pwa(product 완성)는 launch-factory 연결 안내가 들어가고, 사이트형(local)은 들어가지 않는다', async () => {
  const sToTo = join(tmp, 'saas-out')
  await deliver(saas.runDir, 'a', { to: sToTo })
  const sMd = readFileSync(join(sToTo, 'README.md'), 'utf8')
  assert.match(sMd, /launch-factory/)
  assert.match(sMd, /lib\/ports\.ts/)
  assert.match(sMd, /lib\/analytics\.ts/)
  const lTo = join(tmp, 'local-out')
  await deliver(local.runDir, 'a', { to: lTo })
  assert.doesNotMatch(readFileSync(join(lTo, 'README.md'), 'utf8'), /launch-factory/)
  // 순수 함수로도: 완성 방식이 product 인 원형(pwa 포함)만
  const base = { name: '예시', dir: '/x', runCmd: 'cd x', locale: 'ko', blockers: [], previewUrl: null }
  assert.match(renderReadme({ ...base, archetype: 'pwa', completion: 'product' }), /launch-factory/)
  assert.match(renderReadme({ ...base, archetype: 'saas', completion: 'product' }), /launch-factory/)
  assert.doesNotMatch(renderReadme({ ...base, archetype: 'brand', completion: 'site' }), /launch-factory/)
})

test('대상 폴더 규칙: 비어 있지 않으면 거절 · 원본 안으로 복사 거절 · 사이트가 없으면 06 부터 · 대상 없음', async () => {
  const full = join(tmp, 'full')
  mkdirSync(full, { recursive: true })
  writeFileSync(join(full, '내 파일.txt'), '지우면 안 되는 파일')
  await assert.rejects(() => deliver(saas.runDir, 'a', { to: full }), /비어 있지 않다/)
  assert.equal(readFileSync(join(full, '내 파일.txt'), 'utf8'), '지우면 안 되는 파일')
  assert.deepEqual(readdirSync(full), ['내 파일.txt'], '아무것도 쓰지 않았다')
  await assert.rejects(() => deliver(saas.runDir, 'a', { to: join(saas.runDir, 'a', 'site', 'copy') }), /원본 사이트 폴더 안/)
  await assert.rejects(() => deliver(saas.runDir, 'a', { to: saas.runDir }), /원본 사이트 폴더 안|실행 폴더/)
  await assert.rejects(() => deliver(saas.runDir, 'z', { to: join(tmp, 'nope') }), /06/)
  await assert.rejects(() => deliver(saas.runDir, 'a', {}), /to/)
  assert.equal(existsSync(join(tmp, 'nope')), false)
  // 빈 폴더는 받는다
  const empty = join(tmp, '빈 폴더')
  mkdirSync(empty, { recursive: true })
  assert.ok((await deliver(saas.runDir, 'a', { to: empty })).copied > 20)
})

test('미리보기 배포: VERCEL_TOKEN 이 없으면 건너뛰고(이유를 남긴다), 있으면 원본 사이트로 한 번 부른다 — 토큰 값은 어디에도 남지 않는다', async () => {
  const calls = []
  const deploy = async (siteDir, o) => { calls.push({ siteDir, o }); return { url: 'https://wf-preview-abc.vercel.app', argv: [] } }
  const none = await deliver(saas.runDir, 'a', { to: join(tmp, 'p-none'), deployPreview: true, deploy, readSecret: () => null })
  assert.equal(calls.length, 0)
  assert.equal(none.previewUrl, undefined)
  assert.match(none.previewSkipped, /VERCEL_TOKEN/)
  assert.doesNotMatch(readFileSync(join(tmp, 'p-none', 'README.md'), 'utf8'), /vercel\.app/)

  const SECRET = 'tok_SECRET_VALUE_12345'
  const ok = await deliver(saas.runDir, 'a', { to: join(tmp, 'p-ok'), deployPreview: true, deploy, readSecret: (n) => (n === 'VERCEL_TOKEN' ? SECRET : null) })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].siteDir, join(saas.runDir, 'a', 'site'), '설치가 끝난 원본 사이트를 배포한다(복사본은 node_modules 가 없다)')
  assert.equal(ok.previewUrl, 'https://wf-preview-abc.vercel.app')
  assert.ok(readFileSync(join(tmp, 'p-ok', 'README.md'), 'utf8').includes('https://wf-preview-abc.vercel.app'))
  for (const out of [JSON.stringify(ok), readFileSync(join(tmp, 'p-ok', 'README.md'), 'utf8')]) assert.ok(!out.includes(SECRET))

  // 배포가 실패해도 전달은 끝난다 — 오류 글에서 토큰이 가려진다
  const bad = await deliver(saas.runDir, 'a', { to: join(tmp, 'p-bad'), deployPreview: true, readSecret: () => SECRET, deploy: async () => { throw new Error(`도구 실패: vercel deploy 종료 1 (token ${SECRET})`) } })
  assert.equal(bad.previewUrl, undefined)
  assert.match(bad.previewError, /도구 실패: vercel deploy 종료 1/)
  assert.ok(!bad.previewError.includes(SECRET))
  assert.ok(existsSync(join(tmp, 'p-bad', 'package.json')))
  // 배포를 안 켜면 토큰도 읽지 않는다
  let read = 0
  await deliver(saas.runDir, 'a', { to: join(tmp, 'p-off'), deploy, readSecret: () => { read++; return SECRET } })
  assert.equal(read, 0)
})

test('미리보기는 프로덕션으로 갈 수 없다(assertPreviewOnly) — 토큰이 없어도 복사 전에 던진다', async () => {
  for (const readSecret of [() => null, () => 'tok']) {
    const to = join(tmp, `p-prod-${readSecret() ? 'tok' : 'none'}`)
    await assert.rejects(() => deliver(saas.runDir, 'a', { to, deployPreview: true, readSecret, deployOptions: { extraArgs: ['--prod'] }, deploy: async () => { throw new Error('호출되면 안 된다') } }), /프로덕션 배포는 이 도구가 하지 않는다/)
    assert.equal(existsSync(to), false, '아무것도 복사하지 않았다')
  }
  await assert.rejects(() => deliver(saas.runDir, 'a', { to: join(tmp, 'p-target'), deployPreview: true, readSecret: () => 'tok', deployOptions: { extraArgs: ['--target=production'] } }), /프로덕션|production/i)
})

test('CLI 인자: --run --pick --to [--deploy-preview]', () => {
  assert.deepEqual(parseDeliverArgs(['--run', 'out/x', '--pick', 'b', '--to', 'C:\\Users\\홍 길동\\내 사이트', '--deploy-preview']), { run: 'out/x', pick: 'b', to: 'C:\\Users\\홍 길동\\내 사이트', deployPreview: true })
  assert.deepEqual(parseDeliverArgs(['--run', 'x', '--pick', 'a', '--to', 'y']).deployPreview, false)
  for (const bad of [['--pick', 'a', '--to', 'y'], ['--run', 'x', '--to', 'y'], ['--run', 'x', '--pick', 'a'], ['--run', 'x', '--pick', 'z', '--to', 'y'], ['--run', 'x', '--pick', 'a', '--to', 'y', '--prod']]) {
    assert.throws(() => parseDeliverArgs(bad), /사용법|모르는 인자|--pick/, JSON.stringify(bad))
  }
})

// ── 흐름 5 Task 5.16 — 전달물 안내(AGENTS.md · 공개 뒤 할 일 8절) · 문구 규칙 둘 ──────────────────────────────

const AFTER_TOPICS = ['검색 등록', '트래픽이 갑자기 줄었을 때', '지역 등록', 'AI 봇', '도메인 이전', '네이버 AI 브리핑', '고치는 법', '운영 비용']
const hangul = /[가-힣]/
const baseInfo = { name: '예시', dir: '/x', runCmd: 'cd x', blockers: [], archetype: 'local', completion: 'site' }
const afterKo = (md) => md.slice(md.indexOf('### 공개한 뒤에 할 일'), md.indexOf('## English'))
// 전달 산출물에 운영자 개인 글자(계정 이름·메일 주소)가 새지 않는지 본다. 그 글자 자체는 원천에 두지 않는다 — 환경 변수 WF_OWNER_MARKERS(쉼표로 나눈 글자, 대소문자 무시)가
// 있으면 그 값들을 검사하고, 없으면 일반 꼴(개인 메일 주소 @gmail.com)만 검사한다.
const ownerMarkers = () => (process.env.WF_OWNER_MARKERS ?? '').split(',').map((v) => v.trim()).filter(Boolean).map((v) => new RegExp(v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'))

test('전달 폴더에 AGENTS.md 와 공개 뒤 할 일 절이 있다(경로에 공백·한글)', async () => {
  const to = join(ODD, '내 사이트 5-16')
  const r = await deliver(saas.runDir, 'a', { to })
  assert.ok(existsSync(join(r.dir, 'AGENTS.md')))
  const readme = readFileSync(join(r.dir, 'README.md'), 'utf8')
  for (const h of ['검색 등록', '지역 등록', 'AI 봇', '도메인 이전', '고치는 법', '운영 비용']) assert.match(readme, new RegExp(h))
  assert.ok(!files(join(saas.runDir, 'a', 'site')).includes('AGENTS.md'), '원본 사이트에는 AGENTS.md 를 쓰지 않는다(전달 때만 더한다)')
})

test('README: 공개 뒤 할 일 8절이 한국어와 영어 양쪽에 있고, 영어 쪽에는 한글이 없다', () => {
  const md = renderReadme(baseInfo)
  const en = md.slice(md.indexOf('## English'))
  assert.match(md, /### 공개한 뒤에 할 일/)
  assert.match(en, /### After you publish/)
  for (const t of AFTER_TOPICS) assert.ok(md.includes(`#### ${t}`), `ko: ${t}`)
  for (const t of ['Search registration', 'Traffic drop', 'Local listing', 'AI bots', 'Domain move', 'Naver AI Briefing', 'How to edit', 'Running costs']) assert.ok(en.includes(`#### ${t}`), `en: ${t}`)
  assert.doesNotMatch(en, hangul, '영어 쪽에는 한글이 없다')
})

test('README 공개 뒤 할 일: 절마다 1차 출처 주소와 확인 날짜가 있고, 확인하지 못한 값은 「확인 필요」다 — 금액을 지어내지 않는다', () => {
  const ko = afterKo(renderReadme(baseInfo))
  for (const url of [
    'https://support.google.com/webmasters/answer/34592',
    'https://support.google.com/webmasters/answer/7451001',
    'https://searchadvisor.naver.com/guide/seo-basic-intro',
    'https://support.google.com/business/answer/2911778',
    'https://help.naver.com/service/30026/contents/20366',
    'https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes',
    'https://contentsignals.org/',
    'https://nextjs.org/docs/app/api-reference/file-conventions/public-folder',
    'https://vercel.com/pricing',
  ]) assert.ok(ko.includes(url), `ko 출처: ${url}`)
  const parts = ko.split(/^#### /m).slice(1)
  assert.equal(parts.length, AFTER_TOPICS.length)
  for (const p of parts.filter((x) => !x.startsWith('운영 비용'))) {
    const head = p.split('\n')[0]
    assert.match(p, /https:\/\//, `${head}: 출처 주소`)
    assert.match(p, /확인 날짜 20\d\d-\d\d-\d\d/, `${head}: 확인 날짜`)
  }
})

test('README 공개 뒤 할 일 8절(운영 비용): 금액표 대신 런북 호스팅 장을 가리키는 한 문장뿐이다 — ko·en 모두 금액 없음(계획 5 Task 10)', () => {
  const md = renderReadme(baseInfo)
  const en = md.slice(md.indexOf('## English'))
  const costKo = afterKo(md).split(/^#### /m).find((p) => p.startsWith('운영 비용'))
  const costEn = en.split(/^#### /m).find((p) => p.startsWith('Running costs'))
  assert.equal(costKo.trim(), `운영 비용\n\n${DELIVER_COPY.runbookCosts.ko}`)
  assert.equal(costEn.trim(), `Running costs\n\n${DELIVER_COPY.runbookCosts.en}`)
  for (const t of [md, en]) assert.doesNotMatch(t, /\$\s?\d|\d\s?%|¢|\bcents\b|paddle\.com\/pricing/, '금액·수수료가 README 어디에도 없다')
})

test('README: 실제로 쓰기로 하면 「런북」이라고 말하라는 한 문장이 ko·en 에 한 번씩 있다(소개형·제품형 공통, 계획 5 Task 10)', () => {
  for (const info of [baseInfo, { ...baseInfo, archetype: 'saas', completion: 'product' }]) {
    const md = renderReadme(info)
    const ko = md.slice(md.indexOf('## 한국어'), md.indexOf('## English'))
    const en = md.slice(md.indexOf('## English'))
    assert.equal(ko.split(DELIVER_COPY.runbookPointer.ko).length, 2, info.completion)
    assert.equal(en.split(DELIVER_COPY.runbookPointer.en).length, 2, info.completion)
  }
})

test('README: 대표·사업 정보를 싣지 않는다 · 안내 절은 원형·사이트 이름과 무관하게 같다', () => {
  const a = renderReadme({ ...baseInfo, name: '가나' })
  const b = renderReadme({ ...baseInfo, name: '다라', dir: '/y', runCmd: 'cd y', archetype: 'saas', completion: 'product' })
  assert.equal(afterKo(a), afterKo(b))
  for (const bad of [...ownerMarkers(), /@gmail\.com/, /예시기관/, /\d{3}-\d{2}-\d{5}/]) assert.doesNotMatch(a, bad)
})

test('AGENTS.md: 사실 출처는 content/site.json 한 곳 · 고치는 규칙 · 하지 말 것 — ko 다음 en, 영어 쪽에는 한글이 없다', async () => {
  const to = join(tmp, '홍 길동 agents', '내 사이트')
  await deliver(local.runDir, 'a', { to })
  const md = readFileSync(join(to, 'AGENTS.md'), 'utf8')
  assert.ok(md.indexOf('## 한국어') >= 0 && md.indexOf('## English') > md.indexOf('## 한국어'))
  const ko = md.slice(md.indexOf('## 한국어'), md.indexOf('## English'))
  const en = md.slice(md.indexOf('## English'))
  for (const part of [ko, en]) {
    assert.match(part, /content\/site\.json/)
    assert.match(part, /npm run build/)
  }
  assert.match(ko, /### 고치는 규칙/)
  assert.match(ko, /### 하지 말 것/)
  assert.match(en, /### Editing rules/)
  assert.match(en, /### Do not/)
  assert.doesNotMatch(en, hangul)
  for (const bad of [...ownerMarkers(), /@gmail\.com/i]) assert.doesNotMatch(md, bad)
})

test('COPY.md 문구 칸 규칙: FAQ·소개 첫 문단은 직접 답 + 근거(수치·출처·날짜) · 글자 캡차와 「로봇이 아닙니다」 문구 금지(WCAG 3.3.8)', () => {
  const md = readFileSync(join(root, 'factory', 'stamp', 'COPY.md'), 'utf8')
  assert.match(md, /FAQ[^\n]*소개[^\n]*첫 문단[^\n]*직접 답[^\n]*(수치|출처|날짜)/, 'geo-answer-structure')
  assert.match(md, /캡차[^\n]*로봇이 아닙니다[^\n]*3\.3\.8/, 'ax-captcha-bot-wall')
})
