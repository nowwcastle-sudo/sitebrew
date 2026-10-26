// deliver 분기(sitebrew v0.2.0 계획 3 Task 9) — 실행 폴더의 features.json 에 따라 제품형(launch-factory composeProduct)·소개형(가짜 문의 접수)·옛 경로(+안내 한 줄)로 갈린다.
// 가벼운 시험이다: 사이트는 실제 06(generateSite, install: false)이 만든 것이고, launch-factory 는 표 사본(fixtures)과 composeProduct 흉내를 둔 가짜 폴더로 세운다.
// 진짜 composeProduct·빌드·서버·접수 한 번은 deliver-product.test.mjs(heavy).
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { after, before, test } from 'node:test'
import { loadOutcomes, writeFeatures } from '../intake/features.mjs'
import { OUTBOX_KEYS } from '../stamp/check-loop.mjs'
import { DELIVER_COPY, deliver, parseDeliverArgs } from '../stamp/deliver.mjs'
import { INQUIRY_ASSETS, INQUIRY_EXPECT, INQUIRY_TARGETS, deliverIntro, hasInquiryForm } from '../stamp/deliver-intro.mjs'
import { commandLine, deliverProduct } from '../stamp/deliver-product.mjs'
import { gen, localBrief, localContent, makeRun, root, SAAS_BRIEF, saasContent } from './lib/stamp-site-fixtures.mjs'

const BASE = join(root, '.tmp', 'deliver-branch-test')
mkdirSync(BASE, { recursive: true })
const tmp = mkdtempSync(join(BASE, 't-'))
const TABLE_FILE = join(root, 'factory', 'intake', 'fixtures', 'outcomes.sample.json')
const table = JSON.parse(readFileSync(TABLE_FILE, 'utf8'))
const hangul = /[가-힣]/

// 가짜 launch-factory: 표 + 한 바퀴 단계 표 + composeProduct 흉내(받은 인자를 composed.json 에 적고 템플릿 뿌리 메타 두 줄을 만든다)
const LF = join(tmp, 'fake-lf')
mkdirSync(join(LF, 'features'), { recursive: true })
mkdirSync(join(LF, 'template', 'e2e'), { recursive: true })
mkdirSync(join(LF, 'scripts', 'compose'), { recursive: true })
cpSync(TABLE_FILE, join(LF, 'features', 'outcomes.generated.json'))
writeFileSync(join(LF, 'template', 'e2e', 'loop-steps.json'), JSON.stringify({ steps: { signup: ['signUp'], payments: ['checkout'], inquiry: ['contact'] } }))
writeFileSync(
  join(LF, 'scripts', 'compose', 'compose-product.mjs'),
  `import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
export function composeProduct({ siteDir, features, table, lfDir, to, name }) {
  mkdirSync(join(to, 'app'), { recursive: true })
  mkdirSync(join(to, 'content'), { recursive: true })
  cpSync(join(siteDir, 'content', 'site.json'), join(to, 'content', 'site.json'))
  writeFileSync(join(to, 'composed.json'), JSON.stringify({ siteDir, features, lfDir, hash: table.hash }))
  // launch-factory 의 rootMeta 단계 흉내: 제품 이름·OG 언어를 시안의 것으로 바꾸고, 못 찾은 자리는 rootMetaSkipped 로 돌려준다
  const locale = JSON.parse(readFileSync(join(siteDir, 'content', 'site.json'), 'utf8')).locale
  writeFileSync(join(to, 'content', 'copy.en.ts'), 'export const PRODUCT_NAME = ' + JSON.stringify(name) + '\\n')
  const alt = join(lfDir, 'stub-layout.txt')
  const layout = existsSync(alt) ? readFileSync(alt, 'utf8') : 'export const m = { openGraph: { locale: "en_US" } }\\n'
  const rootMetaSkipped = layout.includes('locale: "en_US"') ? [] : ['app/layout.tsx']
  writeFileSync(join(to, 'app', 'layout.tsx'), layout.replace('locale: "en_US"', 'locale: "' + (locale === 'en' ? 'en_US' : 'ko_KR') + '"'))
  return { rootMetaSkipped, dir: to, copied: ['a', 'b'], dropped: ['c'], runCmd: [{ cwd: to, command: 'npm', args: ['install'] }, { cwd: to, command: 'npm', args: ['run', 'dev'] }] }
}
`,
)
// 둘째 가짜 launch-factory: 템플릿 layout 에서 OG 언어 자리가 사라진 모양(rootMetaSkipped 시험용)
const LF_MOVED = join(tmp, 'fake-lf-moved')
cpSync(LF, LF_MOVED, { recursive: true })
writeFileSync(join(LF_MOVED, 'stub-layout.txt'), 'export const m = { openGraph: {} }\n')
// 이 PC 의 형제 launch-factory 가 우연히 잡히지 않게: LF 를 못 찾는 경우는 아무것도 없는 wfRoot 로 시험한다
const NO_LF = { wfRoot: join(tmp, 'nowhere', 'wf'), env: {} }
const WITH_LF = { lf: LF, env: {} }

// landing 사이트: saas 시험 콘텐츠를 landing 스키마 모양(oneLiner·plans.price)으로 줄인다
const landingPatch = (c) => ({ archetype: 'landing', locale: c.locale, business: c.business, oneLiner: '예약을 한 화면에서 받아요', plans: c.plans.map((p) => ({ name: p.name, price: p.monthlyPrice, currency: p.currency, features: p.features })), facts: c.facts, slots: c.slots })
let saas, local, landing
before(async () => {
  landing = await makeRun(join(tmp, 'landing'), { ...SAAS_BRIEF, archetype: 'landing', topic: '앱 소개 한 장' }, saasContent, { patch: landingPatch })
  await gen(landing)
  saas = await makeRun(join(tmp, 'saas'), SAAS_BRIEF, saasContent)
  await gen(saas)
  local = await makeRun(join(tmp, 'local'), localBrief(), localContent)
  await gen(local)
})
after(() => { rmSync(tmp, { recursive: true, force: true }) })

const files = (d) => readdirSync(d, { recursive: true }).map(String).filter((p) => statSync(join(d, p)).isFile()).map((p) => p.split('\\').join('/')).sort()
const kept = (siteDir) => files(siteDir).filter((p) => !/^(?:node_modules|\.next|\.next-export|\.vercel)\//.test(p) && p !== '.env.local' && !p.endsWith('.tsbuildinfo'))
const features = (runDir, outcomes, hash = table.hash) => writeFeatures(runDir, { version: 1, table: hash, outcomes })
const dropFeatures = (runDir) => rmSync(join(runDir, 'features.json'), { force: true })
const readme = (dir) => readFileSync(join(dir, 'README.md'), 'utf8')
let n = 0
const out = (name) => join(tmp, 'out', `${name}-${n++}`)
// deliver 가 더하는 것: README.md · AGENTS.md · .sitebrew/(넘긴 것 기록 — 계획 5 Task 9)
const added = (p) => p === 'README.md' || p === 'AGENTS.md' || p.startsWith('.sitebrew/')
const sameAsSite = (r, siteDir) => assert.deepEqual(files(r.dir).filter((p) => !added(p)), kept(siteDir), '복사 목록이 원본에서 빠질 것만 뺀 것이다')

test('features.json 없음: 파일 목록은 지금 deliver 와 같고, README 에 안내 한 줄(ko·en)이 더해진다', async () => {
  dropFeatures(local.runDir)
  const r = await deliver(local.runDir, 'a', { to: out('nofeat'), ...WITH_LF })
  assert.equal(r.branch, 'legacy')
  sameAsSite(r, join(local.runDir, 'a', 'site'))
  const md = readme(r.dir)
  assert.ok(md.includes(DELIVER_COPY.noticeNoFeatures.ko) && md.includes(DELIVER_COPY.noticeNoFeatures.en))
  assert.equal(r.notice, DELIVER_COPY.noticeNoFeatures.ko)
  assert.doesNotMatch(md, /launch-factory/, '안내에 launch-factory 이름이 없다(사이트형 README 그대로)')
})

test('표 hash 다름: 지금 경로 + 「표가 바뀌었어요」, launch-factory 는 부르지 않는다', async () => {
  features(saas.runDir, ['signup'], 'stale-hash')
  const r = await deliver(saas.runDir, 'a', { to: out('hash'), ...WITH_LF })
  assert.equal(r.branch, 'legacy')
  assert.equal(existsSync(join(r.dir, 'composed.json')), false)
  sameAsSite(r, join(saas.runDir, 'a', 'site'))
  const md = readme(r.dir)
  assert.ok(md.includes(DELIVER_COPY.noticeTableChanged.ko) && md.includes(DELIVER_COPY.noticeTableChanged.en))
  assert.match(DELIVER_COPY.noticeTableChanged.ko, /표가 바뀌었어요/)
  // 옛 경로이므로 원형(saas)의 completion 안내가 그대로 남는다
  assert.match(md, /### launch-factory 연결/)
})

test('M3 깨진 features.json · 표 version 불일치: 던지지 않고 옛 경로 + 안내 한 줄(ko·en)', async () => {
  const bad = [
    ['not json', '{not json'],
    ['모양이 틀림', JSON.stringify({ version: 1, table: table.hash })],
    ['features version 다름', JSON.stringify({ version: 2, table: table.hash, outcomes: ['signup'] })],
  ]
  for (const [why, text] of bad) {
    writeFileSync(join(saas.runDir, 'features.json'), text)
    const r = await deliver(saas.runDir, 'a', { to: out('badfeat'), ...WITH_LF })
    assert.equal(r.branch, 'legacy', why)
    assert.equal(existsSync(join(r.dir, 'composed.json')), false, why)
    sameAsSite(r, join(saas.runDir, 'a', 'site'))
    assert.equal(r.notice, DELIVER_COPY.noticeBadFeatures.ko, why)
    const md = readme(r.dir)
    assert.ok(md.includes(DELIVER_COPY.noticeBadFeatures.ko) && md.includes(DELIVER_COPY.noticeBadFeatures.en), why)
  }
  // 표 version 불일치: launch-factory 쪽 표의 version 이 이 코드가 아는 값이 아니다 → 「표가 바뀌었어요」
  const lfV2 = join(tmp, 'fake-lf-v2')
  cpSync(LF, lfV2, { recursive: true })
  writeFileSync(join(lfV2, 'features', 'outcomes.generated.json'), JSON.stringify({ ...table, version: 2 }))
  features(saas.runDir, ['signup'])
  const v = await deliver(saas.runDir, 'a', { to: out('table-v2'), lf: lfV2, env: {} })
  assert.equal(v.branch, 'legacy')
  assert.equal(existsSync(join(v.dir, 'composed.json')), false)
  assert.equal(v.notice, DELIVER_COPY.noticeTableChanged.ko)
  // version 은 맞는데 모양이 틀린 표는 launch-factory 쪽 결함이라 조용히 넘기지 않는다
  const lfBroken = join(tmp, 'fake-lf-broken')
  cpSync(LF, lfBroken, { recursive: true })
  writeFileSync(join(lfBroken, 'features', 'outcomes.generated.json'), JSON.stringify({ version: 1, hash: 'x' }))
  await assert.rejects(deliver(saas.runDir, 'a', { to: out('table-broken'), lf: lfBroken, env: {} }), /outcomes/)
})

test('launch-factory 못 찾음: 지금 경로 + 「launch-factory 를 못 찾았어요」', async () => {
  features(saas.runDir, ['signup', 'payments'])
  const r = await deliver(saas.runDir, 'a', { to: out('nolf'), ...NO_LF })
  assert.equal(r.branch, 'legacy')
  sameAsSite(r, join(saas.runDir, 'a', 'site'))
  const md = readme(r.dir)
  assert.ok(md.includes(DELIVER_COPY.noticeNoLf.ko) && md.includes(DELIVER_COPY.noticeNoLf.en))
  assert.match(DELIVER_COPY.noticeNoLf.ko, /launch-factory 를 못 찾았어요/)
})

test('saas {signup,payments} + LF: composeProduct 가 닫힌 집합으로 불리고, README 에 명령 배열·고른 기능·영어 화면 안내가 있다 — 필요한 것·안내 장 목록 대신 런북 한 문장(계획 5 Task 10)', async () => {
  features(saas.runDir, ['signup', 'payments'])
  const r = await deliver(saas.runDir, 'a', { to: out('product'), ...WITH_LF })
  assert.equal(r.branch, 'product')
  const composed = JSON.parse(readFileSync(join(r.dir, 'composed.json'), 'utf8'))
  assert.deepEqual(composed.features.outcomes, ['signup', 'payments'])
  assert.equal(composed.hash, table.hash)
  assert.equal(composed.siteDir, join(saas.runDir, 'a', 'site'))
  assert.equal(resolve(composed.lfDir), resolve(LF))
  assert.equal(r.runCmd, `cd "${r.dir}" && npm install && npm run dev`)
  const md = readme(r.dir)
  const ko = md.slice(md.indexOf('## 한국어'), md.indexOf('## English'))
  const en = md.slice(md.indexOf('## English'))
  for (const part of [ko, en]) {
    assert.match(part, /npm install\nnpm run dev/)
    for (const id of ['G-billing', 'G-auth', 'G-db', 'G-email', 'PADDLE_API_KEY', 'BETTER_AUTH_SECRET']) assert.ok(!part.includes(id), `문 앞에는 장·키 이름 목록이 없다: ${id}`)
    assert.doesNotMatch(part, /launch-factory 연결|Connect to launch-factory/, '제품형은 가짜 어댑터를 바꾸라는 옛 안내를 쓰지 않는다')
  }
  assert.ok(ko.includes(DELIVER_COPY.productEnglish.ko) && en.includes(DELIVER_COPY.productEnglish.en), '제품 화면은 지금 영어')
  assert.ok(ko.includes(DELIVER_COPY.runbookPointer.ko) && en.includes(DELIVER_COPY.runbookPointer.en), '런북 한 문장(ko·en)')
  // I7: 법정 쪽(개인정보·약관·환불)이 템플릿의 영어 초안이라는 한 줄 — 공개 전에 바꿔야 한다
  assert.ok(ko.includes(DELIVER_COPY.productLegal.ko) && en.includes(DELIVER_COPY.productLegal.en), '법정 쪽은 영어 초안')
  assert.equal(ko.split(DELIVER_COPY.productLegal.ko).length, 2, '한 줄만 있다')
  // M6: deliverProduct 는 쓰는 값만 돌려준다
  const p = await deliverProduct({ lfDir: LF, srcSite: join(saas.runDir, 'a', 'site'), dest: out('product-keys'), features: { version: 1, table: table.hash, outcomes: ['signup'] }, table, name: 'x', locale: 'ko' })
  assert.deepEqual(Object.keys(p).sort(), ['commands', 'described', 'dir', 'rootMetaSkipped'])
  // 계획 5 Task 10: README 에서 목록을 뺐어도 needs·guides 계산은 남는다(런북이 쓴다)
  assert.ok(p.described.guides.includes('G-auth') && p.described.needs.includes('BETTER_AUTH_SECRET'), JSON.stringify(p.described))
  assert.ok(ko.includes('회원가입·로그인') && ko.includes('카드 결제·정기구독'))
  assert.ok(en.includes('Sign-up and log-in'))
  assert.doesNotMatch(en.split(r.dir).join(''), hangul, '영어 쪽에는 한글이 없다')
  assert.equal(r.notice, undefined)
  assert.equal(r.rootMetaSkipped, undefined)
  // 가짜 모드(LF_MODE=mock)는 build 다음 start 로 켜지지 않는다 — 제품형 README 는 그 순서를 안내하지 않고 dev 로 확인하라고 한다
  assert.ok(ko.includes(DELIVER_COPY.productCheck.ko) && en.includes(DELIVER_COPY.productCheck.en))
  for (const part of [ko, en]) assert.doesNotMatch(part, /(?:다음에|and then) `npm start` ?(?:로 먼저|\.)/)
  assert.doesNotMatch(md, /npm run build` 다음에 `npm start` 로 먼저 확인해요|check with `npm run build` and then `npm start`/)
})

test('제품형 + 미리보기 배포 요청: 원본 사이트를 배포하지 않고 이유를 남기며 README 에 주소가 없다', async () => {
  features(saas.runDir, ['signup'])
  const calls = []
  const deploy = async (siteDir) => { calls.push(siteDir); return { url: 'https://wf-preview-abc.vercel.app', argv: [] } }
  const r = await deliver(saas.runDir, 'a', { to: out('product-preview'), ...WITH_LF, deployPreview: true, deploy, readSecret: () => 'tok_SECRET' })
  assert.equal(r.branch, 'product')
  assert.deepEqual(calls, [], '제품형은 배포를 부르지 않는다')
  assert.equal(r.previewUrl, undefined)
  assert.equal(r.previewSkipped, DELIVER_COPY.previewSkippedProduct.ko)
  const md = readme(r.dir)
  assert.ok(md.includes(DELIVER_COPY.previewSkippedProduct.ko) && md.includes(DELIVER_COPY.previewSkippedProduct.en))
  assert.doesNotMatch(md, /vercel\.app|VERCEL_TOKEN|tok_SECRET/)
  // 소개형은 지금처럼 배포를 부른다
  features(local.runDir, [])
  const i = await deliver(local.runDir, 'a', { to: out('intro-preview'), ...WITH_LF, deployPreview: true, deploy, readSecret: () => 'tok_SECRET' })
  assert.equal(i.previewUrl, 'https://wf-preview-abc.vercel.app')
  assert.equal(calls.length, 1)
})

test('뿌리 메타 자리를 못 찾으면 rootMetaSkipped 와 README 안내 한 줄(ko·en)이 남는다', async () => {
  features(saas.runDir, ['signup'])
  const r = await deliver(saas.runDir, 'a', { to: out('meta-moved'), lf: LF_MOVED, env: {} })
  assert.equal(r.branch, 'product')
  assert.deepEqual(r.rootMetaSkipped, ['app/layout.tsx'])
  const md = readme(r.dir)
  assert.ok(md.includes(DELIVER_COPY.noticeRootMeta.ko) && md.includes(DELIVER_COPY.noticeRootMeta.en))
  assert.match(readFileSync(join(r.dir, 'content', 'copy.en.ts'), 'utf8'), /예약노트/, '찾은 자리는 바뀐다')
  const ok = await deliver(saas.runDir, 'a', { to: out('meta-ok'), ...WITH_LF })
  assert.doesNotMatch(readme(ok.dir), /Example App/)
})

test('landing {signup}: 제품형(소개형 종류에서 회원가입 「예」)', async () => {
  features(landing.runDir, ['signup'])
  const r = await deliver(landing.runDir, 'a', { to: out('landing-product'), ...WITH_LF })
  assert.equal(r.branch, 'product')
  assert.deepEqual(JSON.parse(readFileSync(join(r.dir, 'composed.json'), 'utf8')).features.outcomes, ['signup'])
  assert.match(readme(r.dir), /### 고른 기능\n\n- 회원가입·로그인\n/)
})

test('제품 폴더의 뿌리 메타: 제품 이름과 OG 언어가 시안의 것으로 바뀐다(템플릿 자리 표시가 남지 않는다)', async () => {
  features(saas.runDir, ['signup'])
  const r = await deliver(saas.runDir, 'a', { to: out('meta'), ...WITH_LF })
  const site = JSON.parse(readFileSync(join(saas.runDir, 'a', 'site', 'content', 'site.json'), 'utf8'))
  assert.equal(site.locale, 'ko')
  assert.equal(readFileSync(join(r.dir, 'content', 'copy.en.ts'), 'utf8'), 'export const PRODUCT_NAME = "예약노트"\n')
  assert.match(readFileSync(join(r.dir, 'app', 'layout.tsx'), 'utf8'), /locale: "ko_KR"/)
})

test('saas 가입·결제 둘 다 아니요(outcomes 가 비었다) → 소개형: composeProduct 를 부르지 않고 launch-factory 연결 안내도 없다', async () => {
  features(saas.runDir, [])
  const r = await deliver(saas.runDir, 'a', { to: out('intro-saas'), ...WITH_LF })
  assert.equal(r.branch, 'intro')
  assert.equal(existsSync(join(r.dir, 'composed.json')), false)
  sameAsSite(r, join(saas.runDir, 'a', 'site'))
  assert.doesNotMatch(readme(r.dir), /launch-factory/)
  assert.equal(r.notice, undefined)
})

test('local {signup}: 제품형', async () => {
  features(local.runDir, ['signup'])
  const r = await deliver(local.runDir, 'a', { to: out('local-product'), ...WITH_LF })
  assert.equal(r.branch, 'product')
  assert.ok(existsSync(join(r.dir, 'composed.json')))
})

test('local {inquiry} + 문의 폼 블록: route.ts 가 더해지고 lib/contact.ts 가 contact.mock.ts 로 바뀌며 나머지는 그대로다', async () => {
  const site = JSON.parse(readFileSync(join(local.runDir, 'a', 'site', 'content', 'site.json'), 'utf8'))
  assert.equal(await hasInquiryForm(site), true, '시험 사이트(local)에 문의 폼이나 신청 블록이 있어야 한다')
  features(local.runDir, ['inquiry'])
  const r = await deliver(local.runDir, 'a', { to: out('local-inquiry'), ...WITH_LF })
  assert.equal(r.branch, 'intro')
  const src = join(local.runDir, 'a', 'site')
  assert.equal(readFileSync(join(r.dir, INQUIRY_TARGETS.route), 'utf8'), readFileSync(join(INQUIRY_ASSETS, 'route.ts'), 'utf8'))
  assert.equal(readFileSync(join(r.dir, INQUIRY_TARGETS.contact), 'utf8'), readFileSync(join(INQUIRY_ASSETS, 'contact.mock.ts'), 'utf8'))
  const inquiry = ['app/api/inquiry/route.ts', 'lib/inquiry-copy.json']
  assert.deepEqual(files(r.dir).filter((p) => !added(p) && !inquiry.includes(p)), kept(src))
  // 접수 코드가 읽는 문장은 deliver-copy.json 의 inquiryRuntime 사본이다
  assert.deepEqual(JSON.parse(readFileSync(join(r.dir, INQUIRY_TARGETS.copy), 'utf8')), DELIVER_COPY.inquiryRuntime)
  // 바뀐 파일은 lib/contact.ts 하나뿐이다
  for (const p of kept(src).filter((x) => x !== 'lib/contact.ts')) assert.equal(readFileSync(join(r.dir, p)).equals(readFileSync(join(src, p))), true, p)
  const md = readme(r.dir)
  assert.ok(md.includes(DELIVER_COPY.inquiryMock.ko) && md.includes(DELIVER_COPY.inquiryMock.en))
  assert.doesNotMatch(md, /launch-factory/)
})

test('lead 블록 시안도 같은 결과: 신청 블록만 있어도 접수가 붙고, makeLeadPorts 가 같은 contact.mock.ts 안에 있다', async () => {
  const dest = out('lead')
  cpSync(join(local.runDir, 'a', 'site'), dest, { recursive: true, filter: (s) => !/node_modules|.next/.test(s) })
  const lead = { sections: { s1: { block: 'block-lead-capture-inline-newsletter' } } }
  const runtimeCopy = DELIVER_COPY.inquiryRuntime
  const r = await deliverIntro({ dest, features: { version: 1, table: table.hash, outcomes: ['inquiry'] }, site: lead, runtimeCopy })
  assert.deepEqual(r, { inquiry: true, added: ['app/api/inquiry/route.ts', 'lib/contact.ts', 'lib/inquiry-copy.json'] })
  assert.match(readFileSync(join(dest, INQUIRY_TARGETS.contact), 'utf8'), /export function makeLeadPorts/)
  const none = await deliverIntro({ dest: out('lead-no'), features: { version: 1, table: table.hash, outcomes: [] }, site: lead, runtimeCopy })
  assert.deepEqual(none, { inquiry: false, added: [] }, '문의를 안 골랐으면 붙이지 않는다')
})

test('문의를 골랐어도 시안에 문의 폼·신청 블록이 없으면 접수를 붙이지 않는다', async () => {
  const site = JSON.parse(readFileSync(join(saas.runDir, 'a', 'site', 'content', 'site.json'), 'utf8'))
  assert.equal(await hasInquiryForm(site), false)
  features(saas.runDir, ['inquiry'])
  const r = await deliver(saas.runDir, 'a', { to: out('saas-inquiry'), ...WITH_LF })
  assert.equal(r.branch, 'intro')
  assert.equal(existsSync(join(r.dir, INQUIRY_TARGETS.route)), false)
  assert.doesNotMatch(readme(r.dir), /app\/api\/inquiry/)
  // I4: 넣지 못한 기능은 README 가 한 줄(ko·en)로 알린다 — say 이름표를 쓴다
  const md = readme(r.dir)
  const ko = md.slice(md.indexOf('## 한국어'), md.indexOf('## English'))
  const en = md.slice(md.indexOf('## English'))
  assert.ok(ko.includes(DELIVER_COPY.featureNotAppliedForm.ko.replace('{say}', '문의·상담 메일 알림')), ko)
  assert.ok(en.includes(DELIVER_COPY.featureNotAppliedForm.en.replace('{say}', 'Inquiry email alerts')), en)
  // 결함 15: 줄들 앞에 절 제목이 한 번 붙는다
  assert.equal(ko.split(DELIVER_COPY.featureNotAppliedTitle.ko).length, 2, ko)
  assert.equal(en.split(DELIVER_COPY.featureNotAppliedTitle.en).length, 2, en)
  assert.ok(ko.indexOf(DELIVER_COPY.featureNotAppliedTitle.ko) < ko.indexOf('문의·상담 메일 알림'))
})

test('I4 소개형에 넣을 곳이 없는 기능(방문자 수·마케팅 동의)은 README 에 한 줄씩 알린다. 문의 접수가 붙었으면 문의 줄은 없다', async () => {
  features(local.runDir, ['inquiry', 'marketing', 'analytics'])
  const r = await deliver(local.runDir, 'a', { to: out('unapplied'), ...WITH_LF })
  assert.equal(r.branch, 'intro')
  assert.ok(existsSync(join(r.dir, INQUIRY_TARGETS.route)), '시험 사이트(local)에는 문의 폼이 있어 접수가 붙는다')
  const md = readme(r.dir)
  const ko = md.slice(md.indexOf('## 한국어'), md.indexOf('## English'))
  const en = md.slice(md.indexOf('## English'))
  const line = (k, lang, say) => DELIVER_COPY[k][lang].replace('{say}', say)
  for (const [part, lang, says] of [[ko, 'ko', ['마케팅 메일 수신 동의', '방문자 수 통계']], [en, 'en', ['Marketing email consent', 'Visitor statistics']]]) {
    for (const say of says) assert.equal(part.split(line('featureNotAppliedType', lang, say)).length, 2, `${lang}: ${say} 한 줄`)
    assert.ok(part.includes(DELIVER_COPY.inquiryMock[lang]), `${lang}: 문의 접수 안내는 그대로`)
  }
  assert.ok(!ko.includes('문의·상담 메일 알림') && !en.includes('Inquiry email alerts'), '반영한 기능은 줄이 없다')
  assert.equal((ko.match(/넣지 않았어요/g) ?? []).length, 2)
  // 아무것도 안 골랐거나 반영한 것뿐이면 줄이 없다
  features(local.runDir, ['inquiry'])
  const only = await deliver(local.runDir, 'a', { to: out('applied-only'), ...WITH_LF })
  assert.doesNotMatch(readme(only.dir), /넣지 않았어요|was not added|has no place/)
  features(local.runDir, [])
  const none = await deliver(local.runDir, 'a', { to: out('none'), ...WITH_LF })
  assert.doesNotMatch(readme(none.dir), /넣지 않았어요|was not added|has no place/)
})

test('hasInquiryForm: 문의 폼(contact 특성)·신청 폼(lead 특성) 블록이 있으면 참, 없으면 거짓 — blockTraits 가 정한다', async () => {
  const sec = (block) => ({ sections: { s1: { block: 'block-hero-punch-in-statement' }, s2: { block } } })
  assert.equal(await hasInquiryForm(sec('block-contact-form-inline-short')), true)
  assert.equal(await hasInquiryForm(sec('block-lead-capture-inline-newsletter')), true)
  assert.equal(await hasInquiryForm(sec('block-features-numbered-steps')), false)
  assert.equal(await hasInquiryForm({}), false)
  assert.equal(await hasInquiryForm(sec('block-없는-블록')), false)
})

test('README 새 문장은 deliver-copy.json 에서 온다: 모든 문장이 ko·en 둘 다 있고 영어에는 한글이 없다', async () => {
  const keys = Object.keys(DELIVER_COPY).filter((k) => !k.startsWith('_'))
  for (const k of ['productRunLead', 'productEnglish', 'productCheck', 'previewSkippedProduct', 'noticeTableChanged', 'noticeNoLf', 'noticeNoFeatures', 'noticeBadFeatures', 'noticeRootMeta', 'runbookPointer', 'runbookCosts', 'productLegal', 'featureNotAppliedType', 'featureNotAppliedForm', 'inquiryRuntime']) assert.ok(keys.includes(k), k)
  // M8: 접수 코드가 읽는 문장 묶음에 문의 보내기 제목·받는 메일 없음이 들어 있다
  for (const k of ['subject', 'formSubject', 'leadSubject', 'noOwner']) assert.ok(DELIVER_COPY.inquiryRuntime[k].ko && DELIVER_COPY.inquiryRuntime[k].en, k)
  // 한 칸이 { ko, en } 이거나(README 문장), { 이름: { ko, en } } 묶음이다(inquiryRuntime)
  const pairs = keys.flatMap((k) => ('ko' in DELIVER_COPY[k] ? [[k, DELIVER_COPY[k]]] : Object.entries(DELIVER_COPY[k]).map(([n, v]) => [`${k}.${n}`, v])))
  for (const [k, v] of pairs) {
    assert.ok(v.ko && v.en, k)
    assert.match(v.ko, hangul, `${k}.ko`)
    assert.doesNotMatch(v.en, hangul, `${k}.en`)
  }
  // 소개형 자산(전달물에 들어가는 코드)에도 새 사용자 문장이 없다: 한글 글자 리터럴은 원래 lib/contact.ts 에 있던 것뿐이다
  const literals = (src) => src.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n').match(/"[^"\n]*[가-힣][^"\n]*"|'[^'\n]*[가-힣][^'\n]*'|`[^`\n]*[가-힣][^`\n]*`/g) ?? []
  const baseContact = new Set(literals(readFileSync(join(root, 'factory', 'stamp', 'site-template', 'lib', 'contact.ts'), 'utf8')))
  assert.deepEqual(literals(readFileSync(join(INQUIRY_ASSETS, 'route.ts'), 'utf8')), [], 'route.ts 에는 사용자 문장이 없다(lib/inquiry-copy.json)')
  // M8: 원래 lib/contact.ts 에 있던 문장(받는 메일 없음·제목)도 contact.mock.ts 에서는 lib/inquiry-copy.json 으로 옮겼다 — 한글 글자 리터럴이 하나도 없다
  assert.ok(baseContact.size > 0, '원본 lib/contact.ts 에는 한글 문장이 있다(찍어낸 사이트·골든은 그대로)')
  assert.deepEqual(literals(readFileSync(join(INQUIRY_ASSETS, 'contact.mock.ts'), 'utf8')), [], 'contact.mock.ts 에는 사용자 문장이 없다(lib/inquiry-copy.json)')
  // 소스에 새 문장이 직접 박혀 있지 않다: deliver-product.mjs·deliver-intro.mjs 에는 한글 사용자 문장이 없다(주석 제외)
  for (const f of ['deliver-product.mjs', 'deliver-intro.mjs']) {
    const code = readFileSync(join(root, 'factory', 'stamp', f), 'utf8').split('\n').filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*') && !l.trim().startsWith('/**'))
    const strings = code.join('\n').match(/'[^'\n]*[가-힣][^'\n]*'|`[^`\n]*[가-힣][^`\n]*`/g) ?? []
    // 개발자 오류(throw)와 JSDoc 안 설명은 허용 — 사용자 문장을 만드는 문자열만 본다
    const user = strings.filter((s) => !/Error\(|^`lib\/contact\.ts 가 없다/.test(s))
    assert.deepEqual(user.filter((s) => !s.startsWith('`lib/contact.ts')), [], `${f}: 사용자 문장은 deliver-copy.json 에 둔다`)
  }
})

test('CLI 인자: --lf 가 더해지고, 없으면 키 자체가 없다(옛 모양 그대로)', () => {
  assert.deepEqual(parseDeliverArgs(['--run', 'x', '--pick', 'a', '--to', 'y', '--lf', 'D:/lf']), { run: 'x', pick: 'a', to: 'y', deployPreview: false, lf: 'D:/lf' })
  assert.equal('lf' in parseDeliverArgs(['--run', 'x', '--pick', 'a', '--to', 'y']), false)
  assert.throws(() => parseDeliverArgs(['--run', 'x', '--pick', 'a', '--to', 'y', '--lf']), /--lf 값이 없다/)
})

test('commandLine: 명령 배열을 한 줄로 만든다', () => {
  assert.equal(commandLine([{ cwd: 'D:/x y', command: 'npm', args: ['install'] }, { cwd: 'D:/x y', command: 'npm', args: ['run', 'dev'] }]), 'cd "D:/x y" && npm install && npm run dev')
})

// ── 문의 접수 자산 ──────────────────────────────────────────────────────────

test('문의 접수 자산: expect.json 은 접수 한 번 뒤의 줄 수이고, route.ts 의 기록 줄은 launch-factory OutboxLine 모양이다', () => {
  assert.deepEqual(INQUIRY_EXPECT, { inquiryNotice: 1 })
  const route = readFileSync(join(INQUIRY_ASSETS, 'route.ts'), 'utf8')
  const fixture = JSON.parse(readFileSync(join(root, 'factory', 'scripts', 'fixtures', 'outbox.line.json'), 'utf8'))
  const lineKeys = /const line = \{([^}]*)\}/.exec(route)[1].split(',').map((s) => s.trim().split(':')[0].trim())
  assert.deepEqual(lineKeys.sort(), Object.keys(fixture).sort(), '기록 줄 칸이 OutboxLine 과 같다(본문은 싣지 않는다)')
  for (const t of Object.keys(INQUIRY_EXPECT)) assert.ok(route.includes(`"${t}"`), `route.ts 가 template ${t} 를 쓴다`)
})

test('contact.mock.ts: 지금 lib/contact.ts 의 전화·카카오 갈래와 makeContactPorts·makeLeadPorts 를 그대로 두고 보내기만 /api/inquiry · 정적 빌드는 mailto', () => {
  const base = readFileSync(join(root, 'factory', 'stamp', 'site-template', 'lib', 'contact.ts'), 'utf8')
  const mock = readFileSync(join(INQUIRY_ASSETS, 'contact.mock.ts'), 'utf8')
  for (const keep of ['export function makeContactPorts', 'export function makeLeadPorts', 'kakaoChannelSubmit<Input>(kakaoUrl, text)', 'call: usable(phone) ? telLink(phone) : undefined', 'mailtoSubmit<Input>(email, () => subject, { body: text })']) {
    assert.ok(base.includes(keep) && mock.includes(keep), keep)
  }
  // M8: 문장은 lib/inquiry-copy.json(inquiryRuntime)에서 읽는다 — 원본은 문장을 코드에 두고, 전달물은 사본에서 읽는다
  assert.ok(base.includes('makeContactPorts({ ko: "신청", en: "Sign-up request" })') && mock.includes('makeContactPorts(copy.leadSubject)'))
  assert.ok(mock.includes('copy.noOwner[locale]') && mock.includes('copy.formSubject[locale]'))
  assert.ok(mock.includes('"/api/inquiry"') && mock.includes('process.env.NEXT_PUBLIC_WF_STATIC === "1"'))
  assert.ok(!base.includes('/api/inquiry'), '찍어낸 사이트(골든)의 lib/contact.ts 는 그대로다')
})

test('찍어낸 사이트 틀(site-template)에는 문의 접수가 들어 있지 않다 — 자산은 stamp 가 복사하지 않는 deliver-assets 에 있다', () => {
  const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]))
  const tpl = join(root, 'factory', 'stamp', 'site-template')
  assert.equal(walk(tpl).some((f) => /api[\\/]inquiry/.test(f)), false)
  const cfg = readFileSync(join(tpl, 'next.config.ts'), 'utf8')
  assert.match(cfg, /NEXT_PUBLIC_WF_STATIC: "1"/)
  assert.doesNotMatch(cfg, /rmSync/, '사용자의 파일을 지우지 않는다')
})

// next.config.ts 를 진짜로 불러 본다(Node 24 는 타입을 벗겨 .ts 를 바로 읽는다): 정적 내보내기 동안만 옆으로 치우고, 프로세스가 끝나면 제자리·내용 그대로
const runConfig = (dir, staticExport) => {
  writeFileSync(join(dir, 'probe.mjs'), "import { existsSync } from 'node:fs'\nawait import('./next.config.ts')\nconsole.log(JSON.stringify({ moved: !existsSync('app/api/inquiry'), aside: existsSync('.wf-saved-inquiry') }))\n")
  const r = spawnSync(process.execPath, ['probe.mjs'], { cwd: dir, encoding: 'utf8', env: { ...process.env, WF_STATIC_EXPORT: staticExport ? '1' : '' } })
  assert.equal(r.status, 0, r.stderr)
  return JSON.parse(r.stdout.trim().split('\n').at(-1))
}
const siteWithRoute = (name, body = 'export const POST = 1\n') => {
  const dir = mkdtempSync(join(tmp, `${name}-`))
  for (const f of ['next.config.ts', 'security-headers.mjs']) cpSync(join(root, 'factory', 'stamp', 'site-template', f), join(dir, f))
  mkdirSync(join(dir, 'app', 'api', 'inquiry'), { recursive: true })
  writeFileSync(join(dir, 'app', 'api', 'inquiry', 'route.ts'), body)
  return dir
}

test('next.config.ts 정적 내보내기: 빌드하는 동안만 app/api/inquiry 를 옆으로 치우고, 끝나면 내용 그대로 되돌린다 — 사용자의 파일을 지우지 않는다', () => {
  const body = '// 사용자가 고친 접수 코드\nexport const POST = 42\n'
  const dir = siteWithRoute('cfg-static', body)
  assert.deepEqual(runConfig(dir, true), { moved: true, aside: true }, '빌드 중에는 경로가 없다')
  assert.equal(readFileSync(join(dir, 'app', 'api', 'inquiry', 'route.ts'), 'utf8'), body, '끝나면 그대로 돌아와 있다')
  assert.equal(existsSync(join(dir, '.wf-saved-inquiry')), false)
  assert.deepEqual(runConfig(dir, false), { moved: false, aside: false }, '평소 실행은 건드리지 않는다')
  assert.equal(readFileSync(join(dir, 'app', 'api', 'inquiry', 'route.ts'), 'utf8'), body)
})

test('next.config.ts: 강제 종료로 옆 폴더가 남았으면 다음 평소 실행이 제자리로 되돌린다 · 접수 폴더가 없는 사이트는 아무 일도 없다', () => {
  const dir = siteWithRoute('cfg-leftover')
  renameSync(join(dir, 'app', 'api', 'inquiry'), join(dir, '.wf-saved-inquiry'))
  assert.deepEqual(runConfig(dir, false), { moved: false, aside: false })
  assert.ok(existsSync(join(dir, 'app', 'api', 'inquiry', 'route.ts')))
  const bare = mkdtempSync(join(tmp, 'cfg-bare-'))
  for (const f of ['next.config.ts', 'security-headers.mjs']) cpSync(join(root, 'factory', 'stamp', 'site-template', f), join(bare, f))
  assert.deepEqual(runConfig(bare, true), { moved: true, aside: false }, '폴더가 처음부터 없으니 옆 폴더도 만들어지지 않는다')
})

// 가짜 메일 기록 한 줄의 모양은 launch-factory(packages/email/outbox.schema.json · test/outbox.line.json)가 정한다 — 사본이 같은지 launch-factory 를 찾을 수 있을 때만 맞춰 본다
// 건너뜀 기준선(ci/baselines/skipped-tests.txt)은 모든 PC·CI 에서 같아야 한다 — launch-factory 가 필요한 가벼운 시험은 LF_DIR 이 있을 때만 돈다(찾기 규칙 resolveLf 를 쓰지 않는다)
const REAL_LF = process.env.LF_DIR || null
test('fixtures/outbox.line.json 은 launch-factory 의 것과 같다 (LF_DIR 이 있을 때)', { skip: REAL_LF ? false : 'LF_DIR 없음' }, () => {
  const mine = readFileSync(join(root, 'factory', 'scripts', 'fixtures', 'outbox.line.json'), 'utf8')
  const theirs = readFileSync(join(REAL_LF, 'packages', 'email', 'test', 'outbox.line.json'), 'utf8')
  assert.deepEqual(JSON.parse(mine), JSON.parse(theirs))
  // M4: 손으로 적은 키 목록(OUTBOX_KEYS)은 launch-factory 의 스키마가 정한 필수 칸과 같다(새 시험을 더하지 않고 건너뜀 기준선을 지킨다)
  const schema = JSON.parse(readFileSync(join(REAL_LF, 'packages', 'email', 'outbox.schema.json'), 'utf8'))
  assert.deepEqual([...schema.required].sort(), OUTBOX_KEYS)
  assert.deepEqual(Object.keys(JSON.parse(mine)).sort(), OUTBOX_KEYS)
})

// 경계 시험: 진짜 표를 web-factory 가 읽어(loadOutcomes) 진짜 composeProduct 에 넘겨도 던지지 않는다 — 검사기가 칸을 지우면(closure) 여기서 잡힌다. 설치·빌드는 하지 않는다.
test('진짜 launch-factory 표 → deliver 제품형(진짜 composeProduct)이 던지지 않고 켜짐 목록을 쓴다 (LF_DIR 이 있을 때)', { skip: REAL_LF ? false : 'LF_DIR 없음' }, async () => {
  const real = loadOutcomes(REAL_LF)
  const mod = await import(pathToFileURL(join(REAL_LF, 'scripts', 'compose', 'compose-product.mjs')).href)
  const drop = await import(pathToFileURL(join(REAL_LF, 'scripts', 'compose', 'rules', 'drop.mjs')).href)
  const chosen = { version: 1, table: real.hash, outcomes: ['signup'] }
  mod.checkFeatures(chosen, real)
  const on = drop.turnedOn(real, chosen)
  assert.ok(on.has('auth'), 'signup 이 켜는 부품에 auth')
  assert.ok(drop.droppedOf(real.pages, on).length >= 0)
  writeFeatures(saas.runDir, chosen)
  const r = await deliver(saas.runDir, 'a', { to: out('real-compose'), lf: REAL_LF, env: {} })
  assert.equal(r.branch, 'product')
  const enabled = JSON.parse(readFileSync(join(r.dir, 'lib', 'launch', 'enabled.json'), 'utf8'))
  assert.ok(enabled.parts.includes('auth'))
  assert.equal(r.rootMetaSkipped, undefined)
})


// ── 계획 5 Task 9 — deliver 가 넘긴 것을 .sitebrew/delivered.json 에 남긴다(런북은 이것만 읽는다) ──────────────────────────────
const AT = '2026-10-22T05:00:00.000Z'
const now = () => new Date(AT)
const recorded = (dir) => JSON.parse(readFileSync(join(dir, '.sitebrew', 'delivered.json'), 'utf8'))

test('Task 9 제품형 {signup,payments}: applied 에 둘 · completion composed · 표 해시 · 시각 — 실행 폴더와 전달 폴더에 같은 기록, 전달 폴더에 .gitignore(*)', async () => {
  features(saas.runDir, ['signup', 'payments'])
  const r = await deliver(saas.runDir, 'a', { to: out('rec-product'), ...WITH_LF, now })
  const d = recorded(r.dir)
  assert.deepEqual(d, { version: 1, applied: ['signup', 'payments'], unapplied: [], completion: 'composed', locale: 'ko', tableHash: table.hash, deliveredAt: AT })
  assert.deepEqual(recorded(saas.runDir), d)
  assert.equal(readFileSync(join(r.dir, '.sitebrew', '.gitignore'), 'utf8'), '*\n')
})

test('Task 9 소개형: 아무것도 안 골랐으면 applied [] · 못 넣은 기능은 unapplied 에 있고 applied 에 없다 · completion site', async () => {
  features(local.runDir, [])
  const none = await deliver(local.runDir, 'a', { to: out('rec-intro'), ...WITH_LF, now })
  assert.deepEqual(recorded(none.dir), { version: 1, applied: [], unapplied: [], completion: 'site', locale: 'ko', tableHash: table.hash, deliveredAt: AT })
  features(local.runDir, ['inquiry', 'marketing', 'analytics'])
  const mixed = await deliver(local.runDir, 'a', { to: out('rec-unapplied'), ...WITH_LF, now })
  assert.deepEqual([recorded(mixed.dir).applied, recorded(mixed.dir).unapplied], [['inquiry'], ['marketing', 'analytics']])
  features(saas.runDir, ['inquiry']) // 문의 폼이 없는 시안: 문의도 못 넣었다
  const noForm = await deliver(saas.runDir, 'a', { to: out('rec-noform'), ...WITH_LF, now })
  assert.deepEqual([recorded(noForm.dir).applied, recorded(noForm.dir).unapplied], [[], ['inquiry']])
})

test('Task 9 features.json 없음 → applied null(선택을 모름) · 표를 안 읽었으니 tableHash null · 옛 경로라도 고른 기록이 있으면 그 기능은 unapplied', async () => {
  dropFeatures(local.runDir)
  const r = await deliver(local.runDir, 'a', { to: out('rec-nofeat'), ...WITH_LF, now })
  assert.deepEqual(recorded(r.dir), { version: 1, applied: null, unapplied: [], completion: 'site', locale: 'ko', tableHash: null, deliveredAt: AT })
  features(saas.runDir, ['signup'], 'stale-hash')
  const stale = await deliver(saas.runDir, 'a', { to: out('rec-stale'), ...WITH_LF, now })
  assert.deepEqual(recorded(stale.dir), { version: 1, applied: null, unapplied: ['signup'], completion: 'site', locale: 'ko', tableHash: table.hash, deliveredAt: AT })
})
