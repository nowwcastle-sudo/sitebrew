// 히어로 미디어 파이프라인(Task 12) — 순수 부분: Pexels 검색·고르기·출처 기록·키 가리기, 빌드 폭·인코딩 인자·예산·출처 줄,
// 그리고 저장소에 올라간 결과(public/media/manifest.json·credits.json)가 목록(media-sources.json)·예산·계약과 맞는지.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { searchUrl, itemUrl, candidate, rankCandidates, pickVideoFile, sourceRecord, redact, PEOPLE, LICENSE_URL } from '../media/fetch-pexels.mjs'
import { planWidths, videoSteps, ffmpegArgs, posterArgs, creditRow, overBudget, stillName, videoName, STILL_BUDGET, VIDEO_BUDGET, REPO_TARGET } from '../media/build-media.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'))

test('pexels: search and item URLs carry query, orientation, size; reject bad kind or empty query', () => {
  const u = new URL(searchUrl({ kind: 'photos', query: 'radio tower', orientation: 'landscape', size: 'large', perPage: 12 }))
  assert.equal(u.origin + u.pathname, 'https://api.pexels.com/v1/search')
  assert.equal(u.searchParams.get('query'), 'radio tower')
  assert.equal(u.searchParams.get('orientation'), 'landscape')
  assert.equal(u.searchParams.get('size'), 'large')
  assert.equal(u.searchParams.get('per_page'), '12')
  assert.equal(new URL(searchUrl({ kind: 'videos', query: 'fog' })).pathname, '/videos/search')
  assert.equal(itemUrl('videos', '42'), 'https://api.pexels.com/videos/videos/42')
  assert.throws(() => searchUrl({ kind: 'gifs', query: 'x' }))
  assert.throws(() => searchUrl({ kind: 'photos', query: '' }))
})

test('pexels: candidates with people sink below people-free ones, then small ones, then by aspect distance', () => {
  const raw = [
    { id: 1, width: 6000, height: 4000, alt: 'A woman holding postcards', photographer: 'a', url: 'u1' },
    { id: 2, width: 900, height: 600, alt: 'Radio tower', photographer: 'b', url: 'u2' },
    { id: 3, width: 4000, height: 4000, alt: 'Radio tower square', photographer: 'c', url: 'u3' },
    { id: 4, width: 6000, height: 4000, alt: 'Radio tower wide', photographer: 'd', url: 'u4' },
  ].map((x) => candidate('photos', x))
  assert.equal(raw[0].people, true)
  assert.deepEqual(rankCandidates(raw, { minWidth: 1440, aspect: 1.5 }).map((c) => c.id), [4, 3, 2, 1])
  assert.ok(PEOPLE.test('Hands of an adult') && PEOPLE.test('welder working') && !PEOPLE.test('Misty pine forest'))
})

test('pexels: video file pick prefers the smallest mp4 at or above the target width, else the largest', () => {
  const files = [
    { file_type: 'video/mp4', width: 1280, link: 'a' },
    { file_type: 'video/mp4', width: 2560, link: 'b' },
    { file_type: 'video/mp4', width: 1920, link: 'c' },
    { file_type: 'video/webm', width: 1920, link: 'd' },
  ]
  assert.equal(pickVideoFile(files, { minWidth: 1920 }).link, 'c')
  assert.equal(pickVideoFile(files, { minWidth: 4000 }).link, 'b')
  assert.equal(pickVideoFile([], {}), null)
})

test('pexels: source record carries license and page URL; redact removes the key from any message', () => {
  const rec = sourceRecord({ kind: 'photos', item: { id: 7, width: 10, height: 5, alt: 'x', photographer: 'P', photographer_url: 'pu', url: 'https://www.pexels.com/photo/x-7/' }, recipe: 'r', slot: 's', file: 'f', fetchedAt: '2026-09-28T00:00:00Z' })
  assert.deepEqual([rec.source, rec.kind, rec.license, rec.licenseUrl, rec.url, rec.author], ['pexels', 'image', 'Pexels License', LICENSE_URL, 'https://www.pexels.com/photo/x-7/', 'P'])
  const key = 'abc123SECRETxyz'
  assert.equal(redact(`Pexels 401 — header ${key} and again ${key}`, key).includes(key), false)
  assert.equal(redact('no key here', null), 'no key here')
})

test('build: widths never enlarge; names; video steps fall back to 1280; ffmpeg args drop audio and pin codecs', () => {
  assert.deepEqual(planWidths([1440, 960, 480], 1200), [960, 480])
  assert.deepEqual(planWidths([1440], 800), [800])
  assert.equal(stillName('r5', 'band', 960, 'avif', true), 'r5/band-poster-960.avif')
  assert.equal(videoName('r5', 'band', 'mp4'), 'r5/band.mp4')
  assert.deepEqual(videoSteps('h264', 1920), [[1920, 23], [1920, 25], [1280, 23], [1280, 25], [1280, 27]])
  assert.deepEqual(videoSteps('vp9', 1280), [[1280, 36], [1280, 38], [1280, 40]])
  const h = ffmpegArgs('in.mp4', 'out.mp4', { codec: 'h264', width: 1280, crf: 23 })
  for (const x of ['-an', 'libx264', '+faststart', 'yuv420p', 'scale=1280:-2']) assert.ok(h.includes(x), x)
  assert.equal(h[h.indexOf('-crf') + 1], '23')
  assert.equal(h[h.indexOf('-t') + 1], '8')
  const v = ffmpegArgs('in.mp4', 'out.webm', { codec: 'vp9', width: 1920, crf: 36 })
  assert.ok(v.includes('libvpx-vp9') && v.includes('-an'))
  assert.deepEqual(posterArgs('a', 'b').slice(-3), ['-frames:v', '1', 'b'])
})

test('build: credit rows — pexels needs its record, higgsfield carries the owner license note; budget judge flags only over-budget files', () => {
  const slot = { recipe: 'r8-dusk', slot: 'grid', source: 'higgsfield', file: 'r8-A-pine.mp4' }
  const row = creditRow(slot, { higgsfield: { job: 'j1', model: 'kling', created: '2026-09-28' }, license: '생성물 — 운영자 계정 Higgsfield 생성(2026-09-28)', licenseUrl: 'https://higgsfield.ai/terms-of-use-agreement', file: 'r8-dusk/grid.mp4' })
  assert.deepEqual(Object.keys(row).sort(), ['author', 'fetchedAt', 'file', 'license', 'licenseUrl', 'recipe', 'slot', 'source', 'url'])
  assert.equal(row.license, '생성물 — 운영자 계정 Higgsfield 생성(2026-09-28)')
  // Task 13: 생성물의 상업적 사용 근거 — Higgsfield 1차 약관(Terms of Use Agreement) 주소.
  assert.equal(row.licenseUrl, 'https://higgsfield.ai/terms-of-use-agreement')
  assert.throws(() => creditRow({ ...slot, source: 'pexels' }, { file: 'x' }))
  const assets = [{ files: [{ file: 'a.webp', role: 'still-max', bytes: STILL_BUDGET + 1 }, { file: 'b.webp', role: 'still', bytes: STILL_BUDGET * 3 }, { file: 'c.mp4', role: 'mp4', bytes: VIDEO_BUDGET }] }]
  assert.deepEqual(overBudget(assets), [`a.webp ${STILL_BUDGET + 1} > ${STILL_BUDGET}`])
})

test('committed media: every slot in media-sources.json is built, files exist at the recorded size, budgets hold, one credit row per slot', { skip: 'the public export ships no media files (third-party redistribution terms unconfirmed)' }, () => {
  const cfg = read('factory/media/media-sources.json')
  const { assets } = read('public/media/manifest.json')
  const credits = read('public/media/credits.json')
  const id = (x) => `${x.recipe}/${x.slot}`
  assert.deepEqual(assets.map(id), cfg.slots.map(id))
  assert.deepEqual(credits.map(id), cfg.slots.flatMap((s) => (s.kind === 'model' ? [id(s), id(s)] : [id(s)])), '칸마다 출처 한 줄 — 3D 모델 칸(kind model)은 원본 이미지 줄과 GLB 줄 둘')
  let total = 0
  for (const a of assets) {
    for (const f of a.files) {
      const p = join(ROOT, 'public', 'media', f.file)
      assert.ok(existsSync(p), f.file)
      assert.equal(statSync(p).size, f.bytes, `${f.file} size`)
      total += f.bytes
    }
    if (a.kind === 'video') for (const k of ['mp4', 'webm']) assert.ok(a.files.some((f) => f.file === a.video[k]), `${id(a)} ${k}`)
    for (const w of a.widths) for (const ext of ['avif', 'webp']) assert.ok(a.files.some((f) => f.file === stillName(a.recipe, a.slot, w, ext, a.kind === 'video')), `${id(a)} ${w} ${ext}`)
  }
  assert.deepEqual(overBudget(assets), [])
  assert.ok(total <= REPO_TARGET, `total ${total}`)
  for (const c of credits) {
    for (const k of ['recipe', 'slot', 'file', 'source', 'url', 'author', 'license', 'fetchedAt']) assert.ok(c[k], `${id(c)} ${k}`)
    if (c.source === 'pexels') assert.equal(c.licenseUrl, LICENSE_URL, id(c))
    else if (c.source === 'hyperframes') assert.ok(c.license.startsWith('Apache-2.0 도구로 합성, 내용은 공장 생성') && c.licenseUrl === 'https://www.apache.org/licenses/LICENSE-2.0', id(c))
    else assert.ok((c.license === cfg.higgsfieldLicense || /^생성물 — 운영자 계정 Higgsfield 생성\(\d{4}-\d{2}-\d{2}\)( · 갤러리 예시 전용, 공개 키트 포함 전 약관 확인 필요)?$/.test(c.license)) && c.licenseUrl === cfg.higgsfieldLicenseUrl, id(c))
  }
  assert.equal(cfg.higgsfieldLicenseUrl, 'https://higgsfield.ai/terms-of-use-agreement')
})

test('block-contract media slots: ImageSlot has src/srcSet/alt/width/height/focal, VideoSlot has mp4/webm/poster/loop and muted: true only', () => {
  const src = readFileSync(join(ROOT, 'registry/factory/contract/block-contract.ts'), 'utf8')
  const body = (name) => src.match(new RegExp(`export interface ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? ''
  for (const k of ['src: string', 'srcSet: string', 'alt: string', 'width: number', 'height: number', 'focal?:']) assert.ok(body('ImageSlot').includes(k), `ImageSlot ${k}`)
  for (const k of ['kind: "video"', 'mp4: string', 'webm?: string', 'poster: ImageSlot', 'loop: boolean', 'muted: true', 'decorative?: boolean']) assert.ok(body('VideoSlot').includes(k), `VideoSlot ${k}`)
})
