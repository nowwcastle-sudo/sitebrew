// 외부 의존 풀기(FV1 Task 7.2 · D24) — 05-media 가 키·폴더 없이 계속된다(미리보기 모드). 네트워크 0 · 가짜 fetch · 합성 그림.
//   · pexelsOptional: PEXELS_API_KEY 가 없으면 스톡 칸이 「이미지 준비 중」(stock-pending) 틀이 되고 fetch 는 한 번도 안 불린다. 기본(옵션 없음)은 예전 그대로 던진다.
//   · HIGGSFIELD_DIR 없음: 생성 칸은 higgsfield.request.json 요청으로 남고 계속된다. 폴더가 없는데 파일 이름을 적으면 이유를 말하며 던진다.
import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mediaPlan, fetchMedia, PLACEHOLDER_LABEL, REQUEST_FILE } from '../stamp/media.mjs'

const arch = {
  id: 'local',
  pages: [{ id: 'home', route: '/', sections: [
    { kind: 'hero', imageSlots: [{ id: 'hero', aspect: '16:9', source: 'real-required' }] },
    { kind: 'gallery', imageSlots: [{ id: 'space', aspect: '16:9', source: 'stock-ok' }] },
    { kind: 'story', imageSlots: [{ id: 'mood', aspect: '16:9', source: 'generated-ok' }] },
  ] }],
}
const cand = { id: 'a', slot: 'safe', source: 'library', recipe: 'r5-celadon' }
// 임시 폴더는 레인 폴더 %TEMP%/fv1-extdeps 아래에 만들고 파일이 끝나면 지운다(누적 방지).
const LANE = join(tmpdir(), 'fv1-extdeps')
mkdirSync(LANE, { recursive: true })
const made = []
const out = () => { const d = mkdtempSync(join(LANE, 'media-')); made.push(d); return d }
after(() => { for (const d of made) rmSync(d, { recursive: true, force: true }) })
const noFetch = () => { let n = 0; return { fetch: async () => { n++; throw new Error('네트워크를 부르면 안 된다') }, get calls() { return n } } }

test('pexelsOptional: 키가 없으면 스톡 칸이 stock-pending 틀이 되고 fetch 를 부르지 않는다', async () => {
  const f = noFetch()
  const plan = mediaPlan(arch, { locale: 'ko' }, cand)
  const r = await fetchMedia(plan, out(), { readSecret: () => null, fetch: f.fetch, pexelsOptional: true, higgsfieldDir: null })
  assert.equal(f.calls, 0)
  const by = Object.fromEntries(r.manifest.placeholders.map((p) => [p.slot, p]))
  assert.equal(by['home/gallery/space'].reason, 'stock-pending')
  assert.equal(by['home/gallery/space'].label, PLACEHOLDER_LABEL.pending.ko)
  assert.equal(by['home/hero/hero'].reason, 'real-required', '실사 필수 칸은 그대로 「실제 사진 필요」')
  assert.equal(r.manifest.assets.length, 0)
})

test('pexelsOptional + 영어: 틀 문구가 영어다', async () => {
  const r = await fetchMedia(mediaPlan(arch, { locale: 'en' }, cand), out(), { readSecret: () => null, fetch: noFetch().fetch, pexelsOptional: true, locale: 'en', higgsfieldDir: null })
  assert.equal(r.manifest.placeholders.find((p) => p.slot === 'home/gallery/space').label, PLACEHOLDER_LABEL.pending.en)
})

test('음성 대조: pexelsOptional 이 없으면 키가 없을 때 예전처럼 던진다', async () => {
  await assert.rejects(fetchMedia(mediaPlan(arch, {}, cand), out(), { readSecret: () => null, fetch: noFetch().fetch }), /PEXELS_API_KEY 없음/)
})

test('HIGGSFIELD_DIR 없음: 생성 칸은 요청 파일로 남고 계속된다', async () => {
  const dir = out()
  const r = await fetchMedia(mediaPlan(arch, {}, cand), dir, { readSecret: () => null, fetch: noFetch().fetch, pexelsOptional: true, higgsfieldDir: null })
  assert.deepEqual(r.requests.map((q) => q.slot), ['home/story/mood'])
  assert.ok(existsSync(join(dir, REQUEST_FILE)))
  const body = JSON.parse(readFileSync(join(dir, REQUEST_FILE), 'utf8'))
  assert.match(body.how, /HIGGSFIELD_DIR/)
  assert.ok(!body.how.includes('null'), body.how)
  assert.equal(r.manifest.placeholders.find((p) => p.slot === 'home/story/mood').reason, 'generate-pending')
})

test('HIGGSFIELD_DIR 없음 + 콘텐츠가 파일 이름을 적었으면 이유를 말하며 던진다', async () => {
  const plan = mediaPlan(arch, { media: { 'home/story/mood': { higgsfield: 'x.png' } } }, cand)
  await assert.rejects(fetchMedia(plan, out(), { readSecret: () => null, fetch: noFetch().fetch, pexelsOptional: true, higgsfieldDir: null }), /HIGGSFIELD_DIR 미설정/)
})

test('06: stock-pending 칸은 「이미지 준비 중」 blocker 로 남고 사이트는 끝까지 만들어진다', async () => {
  const { root, SAAS_BRIEF, saasContent, makeRun, gen } = await import('./lib/stamp-site-fixtures.mjs')
  const { mkdirSync, writeFileSync } = await import('node:fs')
  const R = await makeRun(join(root, '.tmp', 'extdeps-media-test'), SAAS_BRIEF, saasContent, {})
  const mdir = join(R.runDir, 'a', '05-media')
  mkdirSync(mdir, { recursive: true })
  writeFileSync(join(mdir, 'manifest.json'), JSON.stringify({ assets: [], placeholders: [{ recipe: 'r1-measure', slot: 'home/x/y', aspect: '16:9', reason: 'stock-pending', label: PLACEHOLDER_LABEL.pending.ko }] }))
  const s = await gen(R)
  assert.ok(s.blockers.includes('공개 불가 — 실제 사진 필요: home/x/y (이미지 준비 중)'), JSON.stringify(s.blockers.slice(0, 5)))
  assert.ok(existsSync(join(s.siteDir, 'content', 'site.json')))
})
