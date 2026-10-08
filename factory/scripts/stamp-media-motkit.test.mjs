// MOTKIT-M 05 미디어 확장 — 변형 인식 계획(video·stills) · Pexels 영상·사진 4장 · 보드 미리보기 전용 모드 · hyperframes 칸 · 06 연결(wireMedia).
// 핵심 불변식: 공개 빌드에 스톡이 실사 필수 칸으로 들어가는 길이 없다. 네트워크 없음(가짜 fetch), sharp 는 합성 그림으로 실제 구동, 영상 인코딩·렌더는 주입.
// 실행: node --test --test-force-exit --test-timeout=60000 factory/scripts/stamp-media-motkit.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { mediaPlan, fetchMedia, pickVideo, blockMediaNames, previewMode, HF_REQUEST_FILE, PLACEHOLDER_LABEL } from '../stamp/media.mjs'
import { wireMedia, PREVIEW_LABEL } from '../stamp/site-media.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const sharp = createRequire(join(ROOT, 'package.json'))('sharp')
const PHOTOS = JSON.parse(readFileSync(join(ROOT, 'factory/scripts/fixtures/stamp-media/pexels-search.json'), 'utf8'))
const KEY = 'test-pexels-key-Zq81'
const cand = { id: 'a', slot: 'safe', source: 'library', recipe: 'r5-celadon' }

const arch = {
  id: 'brand',
  pages: [
    { id: 'home', route: '/', sections: [
      { kind: 'hero', imageSlots: [{ id: 'hero', aspect: '16:9', source: 'stock-ok' }, { id: 'second', aspect: '16:9', source: 'stock-ok' }] },
      { kind: 'story', imageSlots: [{ id: 'mood', aspect: '16:9', source: 'generated-ok' }] },
      { kind: 'gallery', imageSlots: [{ id: 'space', aspect: '16:9', source: 'stock-ok' }] },
    ] },
    { id: 'about', route: '/about', sections: [{ kind: 'team', imageSlots: [{ id: 'portrait', aspect: '4:5', source: 'real-required' }] }] },
  ],
}
const MEDIA = { 'block-hero-video': ['video'], 'block-hero-stills': ['stills'], 'block-hero-punch': ['punch'], 'block-hero-old': ['field'], 'block-story-video': ['video'], 'block-team-stills': ['stills'] }
const mediaOf = (b) => MEDIA[b] ?? []
const V = (hero, extra = {}) => ({ 'home/hero': hero, ...extra })

// ── 계획 ──────────────────────────────────────────────────────────────────
test('plan: blocks that declare neither video nor stills (or no variants at all) give the exact same plan as before', () => {
  const base = mediaPlan(arch, { locale: 'ko' }, cand)
  assert.deepEqual(mediaPlan(arch, { locale: 'ko' }, cand, { variants: undefined }), base)
  assert.deepEqual(mediaPlan(arch, { locale: 'ko' }, cand, { variants: V('block-hero-old', { 'home/story': 'block-story-old' }), mediaOf }), base)
  assert.deepEqual(mediaPlan(arch, { locale: 'ko' }, cand, { variants: V('block-hero-punch'), mediaOf }), base, 'punch keeps the current single-image behavior')
  assert.deepEqual(mediaPlan(arch, { locale: 'ko' }, cand, { variants: V('block-unknown'), mediaOf }), base)
  for (const r of base) assert.equal('kind' in r, false, 'old rows carry no kind field')
})

test('plan: a video block turns its first stock-ok slot into one Pexels video row; the section keeps other slots as photos', () => {
  const plan = mediaPlan(arch, { locale: 'ko' }, cand, { variants: V('block-hero-video'), mediaOf })
  const hero = plan.filter((r) => r.slot.startsWith('home/hero/'))
  assert.deepEqual(hero.map((r) => [r.slot, r.source, r.kind ?? 'photo']), [['home/hero/hero', 'pexels', 'video'], ['home/hero/second', 'pexels', 'photo']])
  assert.ok(hero[0].query)
  assert.deepEqual(plan.filter((r) => !r.slot.startsWith('home/hero/')).map((r) => r.source), ['higgsfield', 'pexels', 'placeholder'], 'other sections are unchanged')
})

test('plan: generated-ok slots in video/stills blocks use Pexels, but a named Higgsfield file wins', () => {
  const v = mediaPlan(arch, { locale: 'ko' }, cand, { variants: { 'home/story': 'block-story-video' }, mediaOf }).find((r) => r.slot === 'home/story/mood')
  assert.deepEqual([v.source, v.kind], ['pexels', 'video'])
  const named = mediaPlan(arch, { locale: 'ko', media: { 'home/story/mood': { higgsfield: 'x.mp4' } } }, cand, { variants: { 'home/story': 'block-story-video' }, mediaOf }).find((r) => r.slot === 'home/story/mood')
  assert.deepEqual([named.source, named.file], ['higgsfield', 'x.mp4'])
})

test('plan: a stills block gets four photo rows named <slot>#0..#3 with the same query; real-required stays a placeholder in public mode', () => {
  const plan = mediaPlan(arch, { locale: 'ko', media: { 'home/hero/hero': { query: 'misty lake' } } }, cand, { variants: V('block-hero-stills', { 'about/team': 'block-team-stills' }), mediaOf })
  const hero = plan.filter((r) => r.slot.startsWith('home/hero/hero'))
  assert.deepEqual(hero.map((r) => r.slot), [0, 1, 2, 3].map((i) => `home/hero/hero#${i}`))
  assert.ok(hero.every((r) => r.source === 'pexels' && r.query === 'misty lake' && r.kind === undefined))
  const team = plan.filter((r) => r.slot.startsWith('about/team/'))
  assert.deepEqual(team.map((r) => [r.slot, r.source]), [['about/team/portrait', 'placeholder']], 'public mode: a stills block never turns a real-required slot into stock')
})

test('plan: owner file beats everything; named hyperframes render becomes a hyperframes row (real-required excluded in public mode)', () => {
  const content = { locale: 'ko', media: { 'home/hero/hero': { file: 'D:/owner/a.jpg' }, 'home/gallery/space': { hyperframes: { template: 'ken-burns-stills', inputs: ['a', 'b'] } }, 'about/team/portrait': { hyperframes: { template: 'ken-burns-stills', inputs: [] } } } }
  const plan = mediaPlan(arch, content, cand, { variants: V('block-hero-video'), mediaOf })
  assert.equal(plan.find((r) => r.slot === 'home/hero/hero').source, 'brand')
  const hf = plan.find((r) => r.slot === 'home/gallery/space')
  assert.deepEqual([hf.source, hf.template, hf.inputs, hf.variables], ['hyperframes', 'ken-burns-stills', ['a', 'b'], null])
  assert.equal(plan.find((r) => r.slot === 'about/team/portrait').source, 'placeholder')
})

test('plan (preview mode): real-required slots become stock rows marked previewOnly with the placeholder label; owner files still win; public mode is untouched', () => {
  const content = { locale: 'ko', media: { 'about/team/portrait': { query: 'ceramic studio' } } }
  const pub = mediaPlan(arch, content, cand)
  const prev = mediaPlan(arch, content, cand, { preview: true })
  const row = prev.find((r) => r.slot === 'about/team/portrait')
  assert.deepEqual([row.source, row.previewOnly, row.label, row.query], ['pexels', true, PLACEHOLDER_LABEL.ko, 'ceramic studio'])
  assert.equal(pub.find((r) => r.slot === 'about/team/portrait').source, 'placeholder')
  assert.deepEqual(prev.filter((r) => r.slot !== 'about/team/portrait'), pub.filter((r) => r.slot !== 'about/team/portrait'), 'non-real-required rows are identical in both modes')
  assert.ok(prev.filter((r) => r.previewOnly).length === 1)
  const owned = mediaPlan(arch, { locale: 'ko', media: { 'about/team/portrait': { file: 'D:/owner/p.jpg' } } }, cand, { preview: true }).find((r) => r.slot === 'about/team/portrait')
  assert.deepEqual([owned.source, owned.previewOnly], ['brand', undefined])
  const vid = mediaPlan(arch, { locale: 'en' }, cand, { preview: true, variants: { 'about/team': 'block-story-video' }, mediaOf }).find((r) => r.slot === 'about/team/portrait')
  assert.deepEqual([vid.source, vid.kind, vid.previewOnly, vid.label], ['pexels', 'video', true, PLACEHOLDER_LABEL.en])
})

test('plan helpers: previewMode reads WF_MEDIA_PREVIEW=1 only; block meta.media comes from the real registry', () => {
  assert.equal(previewMode({}), false)
  assert.equal(previewMode({ WF_MEDIA_PREVIEW: '0' }), false)
  assert.equal(previewMode({ WF_MEDIA_PREVIEW: '1' }), true)
  assert.deepEqual(blockMediaNames('block-hero-baseline-split'), ['field'])
  assert.deepEqual(blockMediaNames('block-not-a-block'), [])
})

test('pickVideo: drops short clips and used ids, prefers people-free 1920+ wide near 16:9', () => {
  const v = (id, o = {}) => ({ id, width: 1920, height: 1080, duration: 12, url: `https://www.pexels.com/video/calm-sea-${id}/`, user: { name: 'u', url: 'x' }, video_files: [], ...o })
  const list = [v(1, { duration: 4 }), v(2, { url: 'https://www.pexels.com/video/a-man-on-a-boat-2/' }), v(3, { width: 1280, height: 720 }), v(4), v(5, { width: 3840, height: 2160 })]
  assert.equal(pickVideo(list).id, 4, 'people-free, ≥1920 wide, closest to 16:9; equal candidates keep list order')
  assert.equal(pickVideo(list, { exclude: new Set([4, 5]) }).id, 3, 'short and people clips never win while a people-free one is left')
  assert.equal(pickVideo([v(1, { duration: 4 })]), null)
})

// ── 받기 ──────────────────────────────────────────────────────────────────
async function fakePexels({ videos = [], photos = PHOTOS.photos } = {}) {
  const jpeg = await sharp({ create: { width: 2400, height: 1350, channels: 3, background: '#7a6a58' } }).jpeg({ quality: 80 }).toBuffer()
  const calls = []
  const fetch = async (url, init = {}) => {
    calls.push({ url: String(url), auth: init.headers?.Authorization ?? null })
    const u = String(url)
    if (u.startsWith('https://api.pexels.com/videos/search')) return new Response(JSON.stringify({ videos }), { status: 200 })
    if (u.startsWith('https://api.pexels.com/v1/search')) return new Response(JSON.stringify({ photos }), { status: 200 })
    if (u.startsWith('https://images.pexels.com/')) return new Response(jpeg, { status: 200 })
    if (u.startsWith('https://videos.pexels.com/')) return new Response(Buffer.from('mp4-bytes'), { status: 200 })
    return new Response('nope', { status: 404 })
  }
  return { fetch, calls }
}
const vid = (id, o = {}) => ({
  id, width: 3840, height: 2160, duration: 12, url: `https://www.pexels.com/video/dusk-lights-${id}/`, user: { name: '촬영자', url: 'https://www.pexels.com/@x' },
  video_files: [
    { file_type: 'video/mp4', width: 3840, link: `https://videos.pexels.com/uhd-${id}.mp4` },
    { file_type: 'video/mp4', width: 1920, link: `https://videos.pexels.com/hd-${id}.mp4` },
    { file_type: 'video/mp4', width: 1280, link: `https://videos.pexels.com/sd-${id}.mp4` },
  ], ...o,
})
const fakeBuildVideo = (built) => async (_sharp, src, recipe, slot) => {
  built.push({ src, recipe, slot })
  return { width: 1440, height: 810, widths: [1440], video: { mp4: `${recipe}/${slot}.mp4`, webm: `${recipe}/${slot}.webm`, width: 1920, duration: 8 }, files: [{ file: `${recipe}/${slot}.mp4`, bytes: 1000, role: 'mp4' }] }
}
const run = async (plan, deps = {}) => {
  const out = await mkdtemp(join(tmpdir(), 'mk-'))
  const p = await fakePexels(deps.pexels)
  const built = []
  const r = await fetchMedia(plan, out, { fetch: p.fetch, readSecret: () => KEY, sharp, higgsfieldDir: out, buildVideo: fakeBuildVideo(built), now: () => '2026-10-03T00:00:00Z', ...deps.fetchDeps })
  return { out, calls: p.calls, built, ...r }
}

test('fetch video: searches landscape videos, skips short and people clips, downloads the ≤1920 rendition, credits the video page', async () => {
  const videos = [vid(1, { duration: 5 }), vid(2, { url: 'https://www.pexels.com/video/a-man-walking-2/' }), vid(3)]
  const plan = mediaPlan(arch, { locale: 'ko' }, cand, { variants: V('block-hero-video'), mediaOf }).filter((r) => r.slot === 'home/hero/hero')
  const { manifest, credits, calls, built } = await run(plan, { pexels: { videos } })
  const search = calls.find((c) => c.url.includes('/videos/search'))
  assert.equal(new URL(search.url).searchParams.get('orientation'), 'landscape')
  assert.equal(search.auth, KEY)
  assert.equal(calls.some((c) => c.url.includes('/v1/search')), false, 'no photo search for a video row')
  assert.deepEqual(calls.filter((c) => c.url.startsWith('https://videos.pexels.com/')).map((c) => c.url), ['https://videos.pexels.com/hd-3.mp4'], 'the 1920 rendition, never the 4K one')
  assert.equal(built.length, 1)
  assert.ok(built[0].src.endsWith('home.hero.hero.mp4'))
  assert.deepEqual([manifest.assets[0].kind, manifest.assets[0].source, manifest.assets[0].slot], ['video', 'pexels', 'home/hero/hero'])
  assert.deepEqual([credits[0].source, credits[0].url, credits[0].licenseUrl], ['pexels', 'https://www.pexels.com/video/dusk-lights-3/', 'https://www.pexels.com/license/'])
  assert.deepEqual(manifest.placeholders, [])
})

test('fetch video: when no clip is long enough the stage fails loudly (no silent photo fallback)', async () => {
  const plan = mediaPlan(arch, { locale: 'ko' }, cand, { variants: V('block-hero-video'), mediaOf }).filter((r) => r.slot === 'home/hero/hero')
  await assert.rejects(run(plan, { pexels: { videos: [vid(1, { duration: 5 })] } }), /8초 이상인 영상이 없다/)
})

test('fetch stills: four distinct photos from one search; file names have no "#"; assets and credits per photo', async () => {
  const plan = mediaPlan(arch, { locale: 'ko' }, cand, { variants: V('block-hero-stills'), mediaOf }).filter((r) => r.slot.startsWith('home/hero/hero'))
  assert.equal(plan.length, 4)
  const { manifest, credits, calls, out } = await run(plan)
  assert.equal(calls.filter((c) => c.url.includes('/v1/search')).length, 1, 'the identical search is made once')
  assert.equal(calls.filter((c) => c.url.startsWith('https://images.pexels.com/')).length, 4)
  assert.deepEqual(manifest.assets.map((a) => a.slot), [0, 1, 2, 3].map((i) => `home/hero/hero#${i}`))
  assert.equal(new Set(credits.map((c) => c.url)).size, 4, 'four different photos')
  for (const a of manifest.assets) for (const f of a.files) { assert.ok(!f.file.includes('#'), f.file); assert.ok(existsSync(join(out, f.file)), f.file) }
  assert.deepEqual(manifest.placeholders, [])
})

test('fetch (public mode): real-required slots make no Pexels call and stay placeholders, even when the block wants stills or video', async () => {
  const plan = mediaPlan(arch, { locale: 'ko' }, cand, { variants: { 'about/team': 'block-team-stills' }, mediaOf }).filter((r) => r.slot.startsWith('about/team'))
  const { manifest, credits, calls } = await run(plan)
  assert.equal(calls.length, 0)
  assert.deepEqual(manifest.assets, [])
  assert.deepEqual(manifest.placeholders.map((p) => [p.slot, p.reason]), [['about/team/portrait', 'real-required']])
  assert.deepEqual(credits, [])
})

test('fetch (preview mode): a real-required slot is filled with stock marked previewOnly AND stays in placeholders (once, even for four stills)', async () => {
  const content = { locale: 'ko', media: { 'about/team/portrait': { query: 'ceramic studio' } } }
  const single = await run(mediaPlan(arch, content, cand, { preview: true }).filter((r) => r.slot.startsWith('about/team')))
  assert.equal(single.manifest.assets.length, 1)
  assert.equal(single.manifest.assets[0].previewOnly, true)
  assert.deepEqual(single.manifest.placeholders.map((p) => [p.slot, p.reason, p.label]), [['about/team/portrait', 'real-required', PLACEHOLDER_LABEL.ko]])
  assert.equal(single.credits[0].previewOnly, true)

  const stills = await run(mediaPlan(arch, content, cand, { preview: true, variants: { 'about/team': 'block-team-stills' }, mediaOf }).filter((r) => r.slot.startsWith('about/team')))
  assert.equal(stills.manifest.assets.length, 4)
  assert.ok(stills.manifest.assets.every((a) => a.previewOnly === true))
  assert.deepEqual(stills.manifest.placeholders.map((p) => p.slot), ['about/team/portrait'], 'the blocker slot is the base slot, listed once')
  assert.ok(stills.credits.every((c) => c.previewOnly === true))

  const vids = await run(mediaPlan(arch, content, cand, { preview: true, variants: { 'about/team': 'block-story-video' }, mediaOf }).filter((r) => r.slot.startsWith('about/team')), { pexels: { videos: [vid(7)] } })
  assert.deepEqual([vids.manifest.assets[0].kind, vids.manifest.assets[0].previewOnly, vids.manifest.placeholders.length], ['video', true, 1])

  // 일반(채워진) 칸에는 previewOnly 가 없다.
  const normal = await run(mediaPlan(arch, content, cand, { preview: true }).filter((r) => r.slot === 'home/gallery/space'))
  assert.equal('previewOnly' in normal.manifest.assets[0], false)
  assert.equal('previewOnly' in normal.credits[0], false)
})

// ── hyperframes 칸 ────────────────────────────────────────────────────────
const hfArch = { id: 'brand', pages: [{ id: 'home', route: '/', sections: [{ kind: 'hero', imageSlots: [{ id: 'hero', aspect: '16:9', source: 'stock-ok' }] }, { kind: 'gallery', imageSlots: [{ id: 'a', aspect: '16:9', source: 'stock-ok' }, { id: 'b', aspect: '16:9', source: 'stock-ok' }] }] }] }
const hfContent = { locale: 'ko', media: { 'home/hero/hero': { hyperframes: { template: 'ken-burns-stills', inputs: ['home/gallery/a', 'home/gallery/b'] } } } }
// 입력 칸이 앞에 오도록 hero 줄을 맨 뒤로 보낸다.
const hfPlan = () => { const p = mediaPlan(hfArch, hfContent, cand); return [...p.filter((r) => r.source !== 'hyperframes'), ...p.filter((r) => r.source === 'hyperframes')] }

test('hyperframes row: rendered from the earlier photos when a renderer is available; credit chains the photo credits; asset source is hyperframes', async () => {
  const rendered = []
  const renderHyperframes = async ({ template, out, inputs }) => { rendered.push({ template, inputs }); await writeFile(out, 'mp4') }
  const r = await run(hfPlan(), { fetchDeps: { renderHyperframes } })
  assert.equal(rendered.length, 1)
  assert.equal(rendered[0].template, 'ken-burns-stills')
  assert.deepEqual(rendered[0].inputs.map((p) => p.split(/[\\/]/).pop()), ['home.gallery.a.jpg', 'home.gallery.b.jpg'])
  const row = r.credits.find((c) => c.slot === 'home/hero/hero')
  assert.equal(row.source, 'hyperframes')
  for (const c of r.credits.filter((c) => c.source === 'pexels')) assert.ok(row.license.includes(c.url), c.slot)
  assert.ok(row.license.startsWith('Apache-2.0 도구로 합성, 내용은 공장 생성'))
  const asset = r.manifest.assets.find((a) => a.slot === 'home/hero/hero')
  assert.deepEqual([asset.kind, asset.source], ['video', 'hyperframes'])
  assert.deepEqual(r.manifest.placeholders, [])
  assert.equal(existsSync(join(r.out, HF_REQUEST_FILE)), false)
})

test('hyperframes row: without a renderer it writes hyperframes.request.json and leaves a render-pending placeholder (no video, no text baked)', async () => {
  const prevEnv = process.env.WF_HYPERFRAMES
  delete process.env.WF_HYPERFRAMES
  try {
    const r = await run(hfPlan())
    assert.equal(r.manifest.assets.some((a) => a.slot === 'home/hero/hero'), false)
    assert.deepEqual(r.manifest.placeholders.map((p) => [p.slot, p.reason]), [['home/hero/hero', 'render-pending']])
    const req = JSON.parse(readFileSync(join(r.out, HF_REQUEST_FILE), 'utf8'))
    assert.deepEqual(req.requests.map((q) => [q.slot, q.template, q.inputs]), [['home/hero/hero', 'ken-burns-stills', ['home/gallery/a', 'home/gallery/b']]])
    assert.equal(r.hyperframesRequests.length, 1)
  } finally {
    if (prevEnv !== undefined) process.env.WF_HYPERFRAMES = prevEnv
  }
})

test('hyperframes row: an input slot that is not earlier in the plan is an error', async () => {
  const plan = mediaPlan(hfArch, hfContent, cand) // hero(hyperframes) 가 입력 칸보다 앞
  await assert.rejects(run(plan, { fetchDeps: { renderHyperframes: async () => {} } }), /입력 칸이 앞에 없다/)
})

// ── 06 연결: wireMedia ───────────────────────────────────────────────────
const still = (slot, over = {}) => ({
  recipe: 'r5-celadon', slot, hero: null, kind: 'image', source: 'pexels', width: 1440, height: 810, widths: [1440],
  files: [{ file: `r5-celadon/${slot.replace(/[/#]/g, '.')}-1440.webp`, bytes: 4, role: 'still-max', w: 1440 }], ...over,
})
const video = (slot, over = {}) => ({
  recipe: 'r5-celadon', slot, hero: null, kind: 'video', source: 'pexels', width: 1440, height: 810, widths: [1440],
  video: { mp4: 'r5-celadon/v.mp4', webm: 'r5-celadon/v.webm', width: 1920, duration: 8 },
  files: [{ file: 'r5-celadon/v-poster-1440.webp', bytes: 4, role: 'still-max', w: 1440 }, { file: 'r5-celadon/v.mp4', bytes: 4, role: 'mp4' }], ...over,
})
const slots = [{ id: 'portrait' }]
const wire = (assets, o = {}) => { const props = {}; const got = wireMedia({ props, sectionKey: 'about/team', imageSlots: slots, assets, recipeId: 'r5-celadon', hasMediaProp: true, ...o }); return { props, got } }
const OPEN = [{ recipe: 'r5-celadon', slot: 'about/team/portrait', reason: 'real-required', label: '실제 사진 필요' }]

test('wire: a normal (non-preview) asset is wired without a label, in both modes', () => {
  for (const allowPreview of [false, true]) {
    const { props, got } = wire([video('about/team/portrait')], { allowPreview })
    assert.equal(props.media.kind, 'video')
    assert.equal('previewLabel' in props.media, false)
    assert.equal(got.slot, 'about/team/portrait')
  }
})

test('wire (public mode): a previewOnly asset is NEVER wired — not with its placeholder listed, not for video, still, or stills', () => {
  const asset = video('about/team/portrait', { previewOnly: true })
  for (const o of [{}, { placeholders: OPEN }, { allowPreview: false, placeholders: OPEN }]) {
    const { props, got } = wire([asset], o)
    assert.equal(got, null, JSON.stringify(Object.keys(o)))
    assert.equal('media' in props, false)
  }
  const imgOnly = wire([still('about/team/portrait', { previewOnly: true })], { placeholders: OPEN })
  assert.equal(imgOnly.got, null)
  const stills = Array.from({ length: 4 }, (_, i) => still(`about/team/portrait#${i}`, { previewOnly: true }))
  const s = wire(stills, { hasMediaProp: false, hasStillsProp: true, placeholders: OPEN })
  assert.equal(s.got, null)
  assert.equal('stills' in s.props, false)
})

test('wire (preview mode): a previewOnly asset is wired with the visible label (ko / en) only while its placeholder blocker is listed', () => {
  const asset = still('about/team/portrait', { previewOnly: true })
  const ko = wire([asset], { allowPreview: true, placeholders: OPEN })
  assert.equal(ko.props.media.previewLabel, '미리보기 전용 사진')
  assert.equal(ko.props.media.previewLabel, PREVIEW_LABEL.ko)
  const en = wire([asset], { allowPreview: true, placeholders: OPEN, locale: 'en' })
  assert.equal(en.props.media.previewLabel, 'Preview-only photo')
  const vid = wire([video('about/team/portrait', { previewOnly: true })], { allowPreview: true, placeholders: OPEN })
  assert.equal(vid.props.media.previewLabel, PREVIEW_LABEL.ko)
  assert.equal(vid.props.media.poster.previewLabel, undefined, 'the badge sits on the slot, not on its poster')
  // 매니페스트가 어긋나 placeholders 에 그 칸이 없으면(공개 불가 사유가 사라짐) 미리보기 모드여도 잇지 않는다.
  assert.equal(wire([asset], { allowPreview: true, placeholders: [] }).got, null)
  assert.equal(wire([asset], { allowPreview: true }).got, null)
  assert.equal(wire([asset], { allowPreview: true, placeholders: [{ slot: 'other/slot/x' }] }).got, null)
})

test('wire: stills fill props.stills in index order with labels in preview mode; a mixed set (one previewOnly) is all-or-nothing in public mode', () => {
  const mk = (i, over = {}) => still(`about/team/portrait#${i}`, over)
  const set = [mk(2, { previewOnly: true }), mk(0, { previewOnly: true }), mk(3, { previewOnly: true }), mk(1, { previewOnly: true })]
  const ok = wire(set, { hasMediaProp: false, hasStillsProp: true, allowPreview: true, placeholders: OPEN })
  assert.equal(ok.props.stills.length, 4)
  assert.deepEqual(ok.props.stills.map((s) => s.src.match(/portrait\.(\d)/)[1]), ['0', '1', '2', '3'], 'ordered by #index')
  assert.ok(ok.props.stills.every((s) => s.previewLabel === PREVIEW_LABEL.ko))
  assert.equal(ok.got.length, 4, 'every wired asset is returned so its files get copied')
  const mixed = [mk(0), mk(1), mk(2), mk(3, { previewOnly: true })]
  assert.equal(wire(mixed, { hasMediaProp: false, hasStillsProp: true, placeholders: OPEN }).got, null)
  const real = wire([mk(0), mk(1), mk(2), mk(3)], { hasMediaProp: false, hasStillsProp: true })
  assert.equal(real.props.stills.length, 4)
  assert.equal(real.props.stills.some((s) => 'previewLabel' in s), false)
  // 블록이 stills 칸을 안 가졌으면 stills 자산은 쓰이지 않는다.
  assert.equal(wire([mk(0), mk(1), mk(2), mk(3)], { hasMediaProp: true, hasStillsProp: false }).got, null)
})

test('wire: a block with both media and stills gets both when both assets exist', () => {
  const slot = 'about/team/portrait'
  const { props, got } = wire([video(slot), ...[0, 1, 2].map((i) => still(`${slot}#${i}`))], { hasStillsProp: true })
  assert.equal(props.stills.length, 3)
  assert.equal(props.media.kind, 'video')
  assert.equal(got.length, 4, 'all four assets are returned so their files get copied')
})
