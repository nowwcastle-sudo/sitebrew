// MOTKIT-M 미디어 파이프라인 확장 — 순수 부분: 영상 받기(최소 길이·폭 상한)·사진 줄여 받기·프레임률 상한·hyperframes 출처 줄,
// 그리고 저장소에 올라간 motkit 갤러리 자산(약속한 크기·예산·출처 이음).
// 실행: node --test --test-force-exit --test-timeout=60000 factory/scripts/media-motkit.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { rankCandidates, pickVideoFile, pickVideoDownload, filterMinDuration, tooShort, photoLink } from '../media/fetch-pexels.mjs'
import { ffmpegArgs, creditRow, stillName, STILL_BUDGET } from '../media/build-media.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'))

test('pexels video: min-duration filters and sinks short clips; unknown duration (photos) is never short', () => {
  const vids = [
    { id: 1, width: 1920, height: 1080, duration: 5, alt: 'calm sea', people: false },
    { id: 2, width: 1920, height: 1080, duration: 12, alt: 'calm sea', people: false },
    { id: 3, width: 1920, height: 1080, duration: 30, alt: 'a man on the sea', people: true },
  ]
  assert.deepEqual(filterMinDuration(vids, 8).map((c) => c.id), [2, 3])
  assert.deepEqual(filterMinDuration(vids, 0).map((c) => c.id), [1, 2, 3])
  assert.deepEqual(rankCandidates(vids, { minWidth: 1920, minDuration: 8 }).map((c) => c.id), [2, 1, 3], 'people last, then short clips behind long ones')
  assert.deepEqual(rankCandidates(vids, { minWidth: 1920 }).map((c) => c.id), [1, 2, 3], 'without minDuration the order is as before')
  assert.equal(tooShort({ duration: undefined }, 8), false)
  assert.equal(tooShort({ duration: 7.9 }, 8), true)
})

test('pexels video: rendition is capped at maxWidth (no 4K download); default pick is unchanged; short or file-less items throw', () => {
  const files = [
    { file_type: 'video/mp4', width: 3840, link: 'uhd' },
    { file_type: 'video/mp4', width: 1920, link: 'hd' },
    { file_type: 'video/mp4', width: 1280, link: 'sd' },
  ]
  assert.equal(pickVideoFile(files, { minWidth: 1920 }).link, 'hd')
  assert.equal(pickVideoFile(files, { minWidth: 3840 }).link, 'uhd', 'no cap given: old behavior')
  assert.equal(pickVideoFile(files, { minWidth: 3840, maxWidth: 1920 }).link, 'hd', 'cap wins over the wanted width')
  assert.equal(pickVideoFile([files[0]], { minWidth: 1920, maxWidth: 1920 }).link, 'uhd', 'only a 4K file exists → smallest, never nothing')
  assert.equal(pickVideoDownload({ id: 9, duration: 12, video_files: files }, { minDuration: 8 }).link, 'hd')
  assert.throws(() => pickVideoDownload({ id: 9, duration: 5, video_files: files }, { minDuration: 8 }), /짧다/)
  assert.throws(() => pickVideoDownload({ id: 9, duration: 12, video_files: [] }, {}), /mp4/)
})

test('pexels photo: photoLink returns the original or the compress URL at a given width', () => {
  const item = { src: { original: 'https://images.pexels.com/photos/1/pexels-photo-1.jpeg' } }
  assert.equal(photoLink(item), item.src.original)
  assert.equal(photoLink(item, 2400), `${item.src.original}?auto=compress&cs=tinysrgb&w=2400`)
})

test('build: ffmpeg caps the frame rate at 30 (60fps sources must not eat the 3MB budget)', () => {
  const a = ffmpegArgs('in.mp4', 'out.mp4', { codec: 'h264', width: 1920, crf: 23 })
  assert.equal(a[a.indexOf('-fpsmax') + 1], '30')
  assert.ok(a.indexOf('-fpsmax') > a.indexOf('-i'), 'output option, after the input')
})

test('build: hyperframes credit row chains the source credit lines and carries the Apache-2.0 tool license; needs a template', () => {
  const chain = [
    { author: '작가 A', url: 'https://www.pexels.com/photo/a-1/', license: 'Pexels License' },
    { author: '작가 B', url: 'https://www.pexels.com/photo/b-2/', license: 'Pexels License' },
  ]
  const slot = { recipe: 'motkit', slot: 'reel-montage', source: 'hyperframes' }
  const row = creditRow(slot, { hyperframes: { template: 'ken-burns-stills', chain, created: '2026-10-03T00:00:00Z' }, file: 'motkit/reel-montage.mp4' })
  assert.deepEqual(Object.keys(row).sort(), ['author', 'fetchedAt', 'file', 'license', 'licenseUrl', 'recipe', 'slot', 'source', 'url'])
  assert.equal(row.url, 'hyperframes:template/ken-burns-stills')
  assert.ok(row.license.startsWith('Apache-2.0 도구로 합성, 내용은 공장 생성 — 원본: '))
  for (const c of chain) assert.ok(row.license.includes(c.url) && row.license.includes(c.author))
  assert.equal(creditRow(slot, { hyperframes: { template: 't', chain: [], created: 'x' }, file: 'f' }).license, 'Apache-2.0 도구로 합성, 내용은 공장 생성')
  assert.throws(() => creditRow(slot, { file: 'f' }), /hyperframes 기록 없음/)
})

test('committed media: the motkit gallery slots exist with the sizes the contract promised', { skip: "the public export ships no media files and an empty media manifest (third-party redistribution terms unconfirmed)" }, () => {
  const cfg = read('factory/media/media-sources.json')
  const { assets } = read('public/media/manifest.json')
  const credits = read('public/media/credits.json')
  const want = ['kinetic-video', 'reel-0', 'reel-1', 'reel-2', 'reel-3', 'reel-montage', 'punch', 'object-3d-orbit']
  assert.deepEqual(cfg.slots.filter((s) => s.recipe === 'motkit').map((s) => s.slot), want)
  const by = (slot) => assets.find((a) => a.recipe === 'motkit' && a.slot === slot)
  const bytes = (a, role) => a.files.find((f) => f.role === role).bytes
  for (const slot of ['kinetic-video', 'reel-montage']) {
    const a = by(slot)
    assert.equal(a.kind, 'video', slot)
    assert.ok(bytes(a, 'mp4') <= 3 * 1024 * 1024 && bytes(a, 'webm') <= 3 * 1024 * 1024, `${slot} video budget`)
    assert.ok(a.video.duration >= 7.95 && a.video.duration <= 8.1, `${slot} duration ${a.video.duration}`)
    assert.ok(a.files.some((f) => f.file === stillName('motkit', slot, 1440, 'webp', true)), `${slot} poster`)
  }
  assert.equal(by('kinetic-video').source, 'pexels')
  assert.equal(by('reel-montage').source, 'hyperframes')
  assert.deepEqual(cfg.slots.find((s) => s.slot === 'reel-montage').inputs, ['reel-0', 'reel-1', 'reel-2', 'reel-3'].map((s) => `motkit/${s}`))
  for (const slot of ['reel-0', 'reel-1', 'reel-2', 'reel-3', 'punch']) assert.ok(bytes(by(slot), 'still-max') <= STILL_BUDGET, `${slot} still budget`)
  assert.equal(by('punch').source, 'higgsfield')
  // 합성 영상의 출처 줄은 원본 네 장의 줄을 모두 잇는다.
  const mont = credits.find((c) => c.recipe === 'motkit' && c.slot === 'reel-montage')
  for (const s of ['reel-0', 'reel-1', 'reel-2', 'reel-3']) assert.ok(mont.license.includes(credits.find((c) => c.recipe === 'motkit' && c.slot === s).url), s)
})
