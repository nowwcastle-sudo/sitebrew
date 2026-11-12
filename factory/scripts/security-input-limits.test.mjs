// 보안 E — 외부 입력의 크기·목적지 제한(WF-4 문의 본문 · WF-9 공급자가 지정한 2차 다운로드).
//   ① safeFetch: https·허용 호스트·리디렉션 재검사·content-length·스트림 한도 · ② media(Pexels 영상·사진)·site-fonts 가 safeFetch 를 거치는가
//   ③ 문의 접수 readCapped(전달물 자산 — loadTs 로 불러 실제로 돈다)와 소개형 전달물이 그 파일도 복사하는가.
// 네트워크 없음(가짜 fetch). 실행: node --test --test-force-exit --test-timeout=200000 factory/scripts/security-input-limits.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { safeFetch, bareUrl, HOSTS, LIMITS } from '../lib/safe-fetch.mjs'
import { mediaPlan, fetchMedia } from '../stamp/media.mjs'
import { subsetSiteFonts } from '../stamp/site-fonts.mjs'
import { INQUIRY_ASSETS, INQUIRY_TARGETS, addInquiryMock } from '../stamp/deliver-intro.mjs'
import { loadTs } from '../stamp/ts-eval.mjs'
import { pexelsDownload } from '../media/fetch-pexels.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const sharp = createRequire(join(ROOT, 'package.json'))('sharp')
const PHOTOS = JSON.parse(readFileSync(join(ROOT, 'factory/scripts/fixtures/stamp-media/pexels-search.json'), 'utf8'))
const KEY = 'test-pexels-key-Zq81'
const tmp = () => mkdtempSync(join(tmpdir(), 'sec-e-'))
const ALLOW = ['images.pexels.com']
const redirect = (to, status = 302) => new Response(null, { status, headers: { location: to } })
/** 주소 → 응답 표로 만든 가짜 fetch. 부른 주소를 모두 남긴다(허용 밖 주소는 부르지 않아야 한다). */
const router = (table) => {
  const calls = []
  const fetch = async (url, init = {}) => {
    calls.push({ url: String(url), headers: init.headers ?? {}, redirect: init.redirect })
    const hit = Object.entries(table).find(([k]) => String(url).startsWith(k))
    return hit ? (typeof hit[1] === 'function' ? hit[1]() : hit[1]) : new Response('nope', { status: 404 })
  }
  return { fetch, calls }
}
/** 청크를 끝없이(또는 limit 만큼) 내놓는 스트림. pulled 에 실제로 뽑힌 바이트가 쌓인다. */
const flood = (chunk, limit = Infinity) => {
  const state = { pulled: 0, cancelled: false }
  const stream = new ReadableStream({
    pull(c) {
      if (state.pulled >= limit) return c.close()
      state.pulled += chunk
      c.enqueue(new Uint8Array(chunk))
    },
    cancel() { state.cancelled = true },
  })
  return { stream, state }
}

// ── safeFetch ──────────────────────────────────────────────────────────────
test('safeFetch: 정상 응답은 버퍼·상태·최종 주소를 돌려주고, redirect: manual 로 부른다', async () => {
  const { fetch, calls } = router({ 'https://images.pexels.com/a.jpg': new Response('JPEGDATA', { status: 200 }) })
  const r = await safeFetch('https://images.pexels.com/a.jpg?w=1', { allowHosts: ALLOW, maxBytes: 100, fetch })
  assert.equal(r.buffer.toString(), 'JPEGDATA')
  assert.deepEqual([r.status, r.url], [200, 'https://images.pexels.com/a.jpg?w=1'])
  assert.equal(calls[0].redirect, 'manual')
})

test('safeFetch: http·사용자 정보·기본 아닌 포트·허용 밖 호스트·점 접미 우회는 요청 전에 거절한다(주소의 쿼리는 오류 문장에 없다)', async () => {
  const { fetch, calls } = router({})
  const bad = [
    ['http://images.pexels.com/a.jpg', /https 만/],
    ['https://images.pexels.com@evil.example.net/a.jpg', /사용자 정보/],
    ['https://user:pw@images.pexels.com/a.jpg', /사용자 정보/],
    ['https://images.pexels.com:8443/a.jpg', /포트/],
    ['https://evil.example.net/a.jpg?token=SECRETQ', /허용 목록에 없는 호스트/],
    ['https://images.pexels.com.evil.example.net/a.jpg', /허용 목록에 없는 호스트/],
    ['https://127.0.0.1/a.jpg', /허용 목록에 없는 호스트/],
    ['file:///etc/passwd', /https 만/],
  ]
  for (const [u, re] of bad) await assert.rejects(safeFetch(u, { allowHosts: ALLOW, maxBytes: 100, fetch }), (e) => re.test(e.message) && !e.message.includes('SECRETQ') && !e.message.includes('pw@'), u)
  assert.equal(calls.length, 0, '거절된 주소로는 요청을 보내지 않는다')
  assert.equal(bareUrl('https://a.example/p/q?token=1#frag'), 'https://a.example/p/q')
})

test('safeFetch: 점으로 시작하는 허용 항목은 하위 도메인만 받는다(상위 자체·비슷한 이름은 아니다)', async () => {
  const { fetch } = router({ 'https://a.cdn.example/': new Response('ok') })
  assert.equal((await safeFetch('https://a.cdn.example/x', { allowHosts: ['.cdn.example'], maxBytes: 10, fetch })).status, 200)
  await assert.rejects(safeFetch('https://cdn.example/x', { allowHosts: ['.cdn.example'], maxBytes: 10, fetch }), /허용 목록/)
  await assert.rejects(safeFetch('https://evilcdn.example/x', { allowHosts: ['.cdn.example'], maxBytes: 10, fetch }), /허용 목록/)
})

test('safeFetch: 허용 → 허용 리디렉션은 따라가고, 허용 → 허용 밖(또는 http)은 거절하며 그 주소로 요청하지 않는다', async () => {
  const ok = router({ 'https://images.pexels.com/a': redirect('https://images.pexels.com/b'), 'https://images.pexels.com/b': new Response('B') })
  const r = await safeFetch('https://images.pexels.com/a', { allowHosts: ALLOW, maxBytes: 10, fetch: ok.fetch })
  assert.deepEqual([r.buffer.toString(), r.url], ['B', 'https://images.pexels.com/b'])
  const rel = router({ 'https://images.pexels.com/a': redirect('/c/d.jpg', 301), 'https://images.pexels.com/c/d.jpg': new Response('C') })
  assert.equal((await safeFetch('https://images.pexels.com/a', { allowHosts: ALLOW, maxBytes: 10, fetch: rel.fetch })).buffer.toString(), 'C', '상대 Location 도 풀어 따라간다')
  for (const to of ['https://evil.example.net/steal', 'http://images.pexels.com/b', 'https://169.254.169.254/latest/meta-data']) {
    const bad = router({ 'https://images.pexels.com/a': redirect(to) })
    await assert.rejects(safeFetch('https://images.pexels.com/a', { allowHosts: ALLOW, maxBytes: 10, fetch: bad.fetch }), /허용 목록에 없는 호스트|https 만/, to)
    assert.deepEqual(bad.calls.map((c) => c.url), ['https://images.pexels.com/a'], `${to} 로는 요청이 나가지 않는다`)
  }
})

test('safeFetch: 리디렉션 6번째는 거절, Location 없는 3xx 도 거절, 호스트가 바뀌는 리디렉션에는 Authorization 을 떼어 보낸다', async () => {
  const loop = router({ 'https://images.pexels.com/': redirect('https://images.pexels.com/loop') })
  await assert.rejects(safeFetch('https://images.pexels.com/x', { allowHosts: ALLOW, maxBytes: 10, fetch: loop.fetch }), /리디렉션이 5번을 넘었다/)
  assert.equal(loop.calls.length, 6, '처음 요청 + 따라간 5번')
  const none = router({ 'https://images.pexels.com/': new Response(null, { status: 302 }) })
  await assert.rejects(safeFetch('https://images.pexels.com/x', { allowHosts: ALLOW, maxBytes: 10, fetch: none.fetch }), /Location/)
  const hop = router({ 'https://api.pexels.com/': redirect('https://images.pexels.com/z'), 'https://images.pexels.com/z': new Response('Z') })
  await safeFetch('https://api.pexels.com/x', { allowHosts: ['api.pexels.com', 'images.pexels.com'], maxBytes: 10, headers: { Authorization: KEY, accept: 'x' }, fetch: hop.fetch })
  assert.equal(hop.calls[0].headers.Authorization, KEY, '첫 요청에는 인증 머리가 간다')
  assert.equal(hop.calls[1].headers.Authorization, undefined, '다른 호스트로 넘어가면 인증 머리를 뗀다')
  assert.equal(hop.calls[1].headers.accept, 'x')
})

test('safeFetch: content-length 가 한도를 넘으면 본문을 읽지 않고 거절한다', async () => {
  const { stream, state } = flood(1024)
  const { fetch } = router({ 'https://images.pexels.com/': new Response(stream, { status: 200, headers: { 'content-length': '999999' } }) })
  await assert.rejects(safeFetch('https://images.pexels.com/big', { allowHosts: ALLOW, maxBytes: 4096, fetch }), /한도\(4096 바이트\)보다 크다/)
  assert.equal(state.pulled <= 1024, true, `본문을 읽지 않았다(뽑힌 ${state.pulled} 바이트)`)
})

test('safeFetch: content-length 가 없거나 거짓이어도 스트림을 세다가 한도를 넘는 순간 끊는다(끝까지 읽지 않는다)', async () => {
  const { stream, state } = flood(1024)
  const { fetch } = router({ 'https://images.pexels.com/': new Response(stream, { status: 200 }) })
  await assert.rejects(safeFetch('https://images.pexels.com/inf', { allowHosts: ALLOW, maxBytes: 8192, fetch }), /한도\(8192 바이트\)를 넘었다/)
  assert.equal(state.cancelled, true, '스트림을 cancel 했다')
  assert.ok(state.pulled <= 8192 + 4 * 1024, `끝없는 본문을 끝까지 읽지 않았다(뽑힌 ${state.pulled} 바이트)`)
  const liar = flood(1024)
  const l = router({ 'https://images.pexels.com/': new Response(liar.stream, { status: 200, headers: { 'content-length': '10' } }) })
  await assert.rejects(safeFetch('https://images.pexels.com/liar', { allowHosts: ALLOW, maxBytes: 8192, fetch: l.fetch }), /한도/, '작다고 거짓말하는 content-length 도 소용없다')
  const exact = router({ 'https://images.pexels.com/': new Response(new Uint8Array(8192), { status: 200 }) })
  assert.equal((await safeFetch('https://images.pexels.com/e', { allowHosts: ALLOW, maxBytes: 8192, fetch: exact.fetch })).buffer.length, 8192, '한도와 같은 크기는 통과')
})

test('safeFetch: 성공이 아닌 응답은 던지지 않고 상태를 돌려준다(오류 페이지가 커도 64 KB 까지만 읽는다)', async () => {
  const { stream, state } = flood(8192)
  const { fetch } = router({ 'https://images.pexels.com/': new Response(stream, { status: 400 }) })
  const r = await safeFetch('https://images.pexels.com/x', { allowHosts: ALLOW, maxBytes: LIMITS.photo, fetch })
  assert.equal(r.status, 400)
  assert.ok(r.buffer.length <= 64 * 1024 && state.pulled <= 64 * 1024 + 3 * 8192, `뽑힌 ${state.pulled}`)
})

test('safeFetch: 요청 실패 메시지에 쿼리가 실리지 않고, 인자 오류는 바로 던진다', async () => {
  const boom = async () => { throw new Error('socket closed') }
  await assert.rejects(safeFetch('https://images.pexels.com/a.jpg?auth=SECRETQ', { allowHosts: ALLOW, maxBytes: 10, fetch: boom }), (e) => /요청 실패\(socket closed\)/.test(e.message) && !e.message.includes('SECRETQ'))
  await assert.rejects(safeFetch('https://images.pexels.com/a', { allowHosts: [], maxBytes: 10, fetch: boom }), /allowHosts/)
  await assert.rejects(safeFetch('https://images.pexels.com/a', { allowHosts: ALLOW, maxBytes: 0, fetch: boom }), /maxBytes/)
})

// ── 05 미디어(Pexels 사진·영상) ─────────────────────────────────────────────
const arch = { id: 'brand', pages: [{ id: 'home', route: '/', sections: [{ kind: 'hero', imageSlots: [{ id: 'hero', aspect: '16:9', source: 'stock-ok' }] }] }] }
const cand = { id: 'a', slot: 'safe', source: 'library', recipe: 'r5-celadon' }
const photoPlan = () => mediaPlan(arch, { locale: 'ko' }, cand)
const videoPlan = () => mediaPlan(arch, { locale: 'ko' }, cand, { variants: { 'home/hero': 'block-hero-video' }, mediaOf: () => ['video'] })
const videoItem = (link) => ({ id: 3, width: 3840, height: 2160, duration: 12, url: 'https://www.pexels.com/video/x-3/', user: { name: '촬영자', url: 'https://www.pexels.com/@x' }, video_files: [{ file_type: 'video/mp4', width: 1920, link }] })
const fakeBuildVideo = async (_s, _src, recipe, slot) => ({ width: 1440, height: 810, widths: [1440], video: { mp4: `${recipe}/${slot}.mp4`, webm: `${recipe}/${slot}.webm`, width: 1920, duration: 8 }, files: [{ file: `${recipe}/${slot}.mp4`, bytes: 1000, role: 'mp4' }] })
const photosTo = (original) => ({ photos: PHOTOS.photos.map((p) => ({ ...p, src: { ...p.src, original } })) })
const runMedia = async (plan, table) => {
  const out = tmp()
  const r = router({ 'https://api.pexels.com/': () => new Response(JSON.stringify(table.search), { status: 200 }), ...table.cdn })
  const run = fetchMedia(plan, out, { fetch: r.fetch, readSecret: () => KEY, sharp, higgsfieldDir: out, buildVideo: fakeBuildVideo, now: () => '2026-11-13T00:00:00Z' })
  return { run, calls: r.calls, out }
}

test('media: 공급자 JSON 이 허용 밖 호스트의 사진 주소를 주면 받지 않는다(그 주소로 요청이 나가지 않는다)', async () => {
  const { run, calls } = await runMedia(photoPlan(), { search: photosTo('https://evil.example.net/p.jpg'), cdn: {} })
  await assert.rejects(run, (e) => /허용 목록에 없는 호스트 evil\.example\.net/.test(e.message) && !e.message.includes(KEY) && !e.message.includes('auto=compress'))
  assert.equal(calls.some((c) => c.url.includes('evil.example.net')), false)
})

test('media: 허용 사진 호스트가 허용 밖으로 리디렉션해도 받지 않고, 허용 사진·영상 CDN(옛 vimeo 링크 포함)은 받는다', async () => {
  const jpeg = await sharp({ create: { width: 2400, height: 1350, channels: 3, background: '#7a6a58' } }).jpeg({ quality: 80 }).toBuffer()
  const r1 = await runMedia(photoPlan(), { search: photosTo('https://images.pexels.com/photos/1/o.jpeg'), cdn: { 'https://images.pexels.com/': redirect('https://evil.example.net/p.jpg') } })
  await assert.rejects(r1.run, /허용 목록에 없는 호스트 evil\.example\.net/)
  assert.equal(r1.calls.some((c) => c.url.includes('evil.example.net')), false)
  const r2 = await runMedia(photoPlan(), { search: photosTo('https://images.pexels.com/photos/1/o.jpeg'), cdn: { 'https://images.pexels.com/': () => new Response(jpeg, { status: 200 }) } })
  assert.equal((await r2.run).manifest.assets.length, 1, '정상 CDN 사진 → 받는다')
  const photoCall = r2.calls.find((c) => c.url.startsWith('https://images.pexels.com/'))
  assert.equal(photoCall.headers.Authorization, undefined, '2차 받기에는 인증 머리를 보내지 않는다')
  assert.equal(r2.calls[0].headers.Authorization, KEY, 'API 요청에만 인증 머리')
  for (const link of ['https://videos.pexels.com/video-files/3/hd.mp4', 'https://player.vimeo.com/external/3.hd.mp4']) {
    const v = await runMedia(videoPlan(), { search: { videos: [videoItem(link)] }, cdn: { [link]: () => new Response(Buffer.from('mp4-bytes'), { status: 200 }) } })
    assert.equal((await v.run).manifest.assets[0].kind, 'video', link)
  }
})

test('media: 영상 주소가 허용 밖·http 이거나 거대하면(content-length) 받지 않는다 — 큰 영상 본문은 읽지 않는다', async () => {
  for (const link of ['https://evil.example.net/v.mp4', 'http://videos.pexels.com/v.mp4']) {
    const v = await runMedia(videoPlan(), { search: { videos: [videoItem(link)] }, cdn: {} })
    await assert.rejects(v.run, /허용 목록에 없는 호스트|https 만/, link)
    assert.equal(v.calls.some((c) => c.url === link), false, `${link} 로 요청이 나가지 않는다`)
  }
  const link = 'https://videos.pexels.com/huge.mp4'
  const { stream, state } = flood(4096)
  const v = await runMedia(videoPlan(), { search: { videos: [videoItem(link)] }, cdn: { [link]: () => new Response(stream, { status: 200, headers: { 'content-length': String(LIMITS.video + 1) } }) } })
  await assert.rejects(v.run, /한도/)
  assert.ok(state.pulled <= 4096, '본문을 읽지 않았다')
})

test('media: 검색 응답이 한도를 넘거나 JSON 이 아니면 던진다(오류 문장에 키가 없다)', async () => {
  const out = tmp()
  const html = router({ 'https://api.pexels.com/': new Response('<html>' + KEY, { status: 200 }) })
  await assert.rejects(fetchMedia(photoPlan(), out, { fetch: html.fetch, readSecret: () => KEY, sharp }), (e) => /JSON 이 아니다/.test(e.message) && !e.message.includes(KEY))
  const big = router({ 'https://api.pexels.com/': new Response('x', { status: 200, headers: { 'content-length': String(LIMITS.json + 1) } }) })
  await assert.rejects(fetchMedia(photoPlan(), out, { fetch: big.fetch, readSecret: () => KEY, sharp }), /한도/)
})

test('fetch-pexels(CLI 쪽 받기): 허용 밖 호스트·사진 한도 초과는 파일을 쓰기 전에 거절하고, 정상 CDN 은 파일로 쓴다', async () => {
  const dir = tmp()
  const file = join(dir, 'r', 'slot.jpg')
  const evil = router({})
  await assert.rejects(pexelsDownload('https://evil.example.net/p.jpg', file, 'photos', evil.fetch), /허용 목록/)
  const huge = router({ 'https://images.pexels.com/': new Response('x', { status: 200, headers: { 'content-length': String(LIMITS.photo + 1) } }) })
  await assert.rejects(pexelsDownload('https://images.pexels.com/p.jpg', file, 'photos', huge.fetch), /한도/)
  assert.equal(existsSync(file), false)
  const good = router({ 'https://images.pexels.com/': new Response('JPG', { status: 200 }) })
  await pexelsDownload('https://images.pexels.com/p.jpg', file, 'photos', good.fetch)
  assert.equal(readFileSync(file, 'utf8'), 'JPG')
  const vim = router({ 'https://player.vimeo.com/': new Response('MP4', { status: 200 }) })
  await pexelsDownload('https://player.vimeo.com/external/1.mp4', join(dir, 'v.mp4'), 'videos', vim.fetch)
  assert.equal(readFileSync(join(dir, 'v.mp4'), 'utf8'), 'MP4')
})

// ── site-fonts ────────────────────────────────────────────────────────────
const LAYOUT = `import "./globals.css"
import { Nanum_Gothic_Coding } from "next/font/google";

const nanumGothicCodingNanumGothicCodingWf = Nanum_Gothic_Coding({subsets:['latin'],weight:['400','700'],variable:'--font-nanum-gothic-coding-wf'});

export default function RootLayout() { return null }
`
function fontSite() {
  const dir = tmp()
  for (const d of ['app', 'content']) mkdirSync(join(dir, d), { recursive: true })
  writeFileSync(join(dir, 'app', 'layout.tsx'), LAYOUT)
  writeFileSync(join(dir, 'app', 'globals.css'), '@import "tailwindcss";\n')
  writeFileSync(join(dir, 'content', 'site.json'), JSON.stringify({ pages: { '/': { id: 'home', title: '홈' } }, sections: {} }))
  writeFileSync(join(dir, 'app', 'page.tsx'), 'export default function P() { return <p>안녕하세요</p> }\n')
  return dir
}
const css = (url) => `@font-face {\n  font-family: 'X';\n  font-style: normal;\n  font-weight: 400;\n  font-display: swap;\n  src: url(${url}) format('woff2');\n  unicode-range: U+31-33;\n}\n`
const woff2 = Buffer.concat([Buffer.from('wOF2'), Buffer.alloc(200, 46)])
const fontsFetch = ({ woffUrl, cssRedirectTo = null, woffRedirectTo = null, woffBody = () => new Response(woff2, { status: 200 }) } = {}) => router({
  'https://fonts.googleapis.com/': () => (cssRedirectTo ? redirect(cssRedirectTo) : new Response(css(woffUrl), { status: 200 })),
  'https://fonts.gstatic.com/': () => (woffRedirectTo ? redirect(woffRedirectTo) : woffBody()),
})

test('site-fonts: css2 응답이 gstatic 이 아닌 woff2 주소를 주면(공급자가 지정한 2차 주소) 받지 않고 원래 로더를 둔다', async () => {
  const dir = fontSite()
  const f = fontsFetch({ woffUrl: 'https://evil.example.net/f.woff2' })
  const r = await subsetSiteFonts(dir, { fetch: f.fetch, weightsFor: () => [400] })
  assert.equal(r.converted.length, 0)
  assert.match(r.kept[0].reason, /허용 목록에 없는 호스트 evil\.example\.net/)
  assert.equal(f.calls.some((c) => c.url.includes('evil.example.net')), false)
  assert.equal(readFileSync(join(dir, 'app', 'layout.tsx'), 'utf8'), LAYOUT, '로더는 그대로')
})

test('site-fonts: gstatic 이 허용 밖으로 리디렉션하거나, css2 가 리디렉션하거나, woff2 가 한도를 넘으면 받지 않는다', async () => {
  const a = fontsFetch({ woffUrl: 'https://fonts.gstatic.com/s/f.woff2', woffRedirectTo: 'https://evil.example.net/f.woff2' })
  const ra = await subsetSiteFonts(fontSite(), { fetch: a.fetch, weightsFor: () => [400] })
  assert.match(ra.kept[0].reason, /허용 목록에 없는 호스트/)
  assert.equal(a.calls.some((c) => c.url.includes('evil.example.net')), false)
  const b = fontsFetch({ cssRedirectTo: 'https://evil.example.net/css' })
  const rb = await subsetSiteFonts(fontSite(), { fetch: b.fetch, weightsFor: () => [400] })
  assert.match(rb.kept[0].reason, /허용 목록에 없는 호스트/)
  const c = fontsFetch({ woffUrl: 'https://fonts.gstatic.com/s/f.woff2', woffBody: () => new Response('x', { status: 200, headers: { 'content-length': String(LIMITS.font + 1) } }) })
  const rc = await subsetSiteFonts(fontSite(), { fetch: c.fetch, weightsFor: () => [400] })
  assert.match(rc.kept[0].reason, /한도/)
})

test('site-fonts: 정상 gstatic 주소는 받는다(허용 목록에 구글 css2·gstatic 이 있다)', async () => {
  const dir = fontSite()
  const f = fontsFetch({ woffUrl: 'https://fonts.gstatic.com/s/f.woff2' })
  const r = await subsetSiteFonts(dir, { fetch: f.fetch, weightsFor: () => [400] })
  assert.equal(r.converted.length, 1)
  assert.ok(existsSync(join(dir, 'app', 'fonts', 'nanum-gothic-coding-400-g0.woff2')))
  assert.ok(HOSTS.googleCss.includes('fonts.googleapis.com') && HOSTS.googleFont.includes('fonts.gstatic.com'))
})

// ── 문의 접수 본문(WF-4) ─────────────────────────────────────────────────────
const { readCapped } = await loadTs(join(INQUIRY_ASSETS, 'read-capped.ts'))
const MAX = 16_384
const post = (body, headers = {}) => new Request('https://site.example/api/inquiry', { method: 'POST', body, headers, duplex: 'half' })

test('readCapped: content-length 가 한도보다 크면 본문을 읽지 않고 바로 tooBig(413)', async () => {
  const { stream, state } = flood(1024)
  const res = await readCapped(post(stream, { 'content-length': String(MAX + 1) }), MAX)
  assert.deepEqual(res, { ok: false, reason: 'tooBig' })
  assert.equal(state.pulled <= 1024, true, `본문을 읽지 않았다(뽑힌 ${state.pulled} 바이트)`)
})

test('readCapped: 헤더 없이 스트림이 한도를 넘으면 tooBig 이고 끝까지 읽지 않는다(읽은 바이트 수 확인)', async () => {
  const { stream, state } = flood(1024)
  const res = await readCapped(post(stream), MAX)
  assert.deepEqual(res, { ok: false, reason: 'tooBig' })
  assert.equal(state.cancelled, true)
  assert.ok(state.pulled <= MAX + 4 * 1024, `끝없는 본문을 끝까지 읽지 않았다(뽑힌 ${state.pulled} 바이트)`)
  const liar = flood(1024)
  assert.deepEqual(await readCapped(post(liar.stream, { 'content-length': '5' }), MAX), { ok: false, reason: 'tooBig' }, '작다고 거짓말하는 content-length 도 소용없다')
})

test('readCapped: 16 KB 이하 정상 JSON 은 그대로 통과하고(경계 포함) 한글이 청크 경계에서 깨지지 않는다', async () => {
  const body = JSON.stringify({ subject: '문의', message: '안녕하세요 — 가나다라마바사'.repeat(40) })
  const ok = await readCapped(post(body, { 'content-type': 'application/json' }), MAX)
  assert.equal(ok.ok, true)
  assert.deepEqual(JSON.parse(ok.text), JSON.parse(body))
  const bytes = new TextEncoder().encode(body)
  const split = new ReadableStream({ start(c) { for (let i = 0; i < bytes.length; i += 7) c.enqueue(bytes.slice(i, i + 7)); c.close() } })
  assert.equal((await readCapped(post(split), MAX)).text, body, '7바이트씩 쪼개 보내도 같은 글')
  const edge = await readCapped(post('a'.repeat(MAX)), MAX)
  assert.equal(edge.ok, true, '한도와 같은 크기는 통과')
  assert.deepEqual(await readCapped(post('a'.repeat(MAX + 1)), MAX), { ok: false, reason: 'tooBig' })
})

test('readCapped: 본문이 없으면 badBody(400)', async () => {
  assert.deepEqual(await readCapped(new Request('https://site.example/api/inquiry', { method: 'POST' }), MAX), { ok: false, reason: 'badBody' })
})

test('route.ts 는 request.text()/json() 으로 전체를 읽지 않고 readCapped 로 읽는다 · 기존 응답 모양(413 tooBig·400 badBody)을 유지한다', () => {
  const src = readFileSync(join(INQUIRY_ASSETS, 'route.ts'), 'utf8')
  assert.doesNotMatch(src, /request\.(text|json|formData|arrayBuffer|blob)\(/)
  assert.match(src, /import \{ readCapped \} from "\.\/read-capped"/)
  assert.match(src, /readCapped\(request, MAX_BYTES\)/)
  assert.match(src, /fail\(413, "tooBig"\)/)
  assert.match(src, /MAX_BYTES = 16_384/)
  // Next 라우트 파일은 정해진 이름만 내보낼 수 있다 — 크기 제한 읽기는 route.ts 가 아니라 따로 둔 파일이 내보낸다
  assert.doesNotMatch(src, /export (async )?function readCapped/)
})

test('소개형 전달물: addInquiryMock 이 read-capped.ts 도 route.ts 옆에 그대로 복사한다', () => {
  const dest = tmp()
  mkdirSync(join(dest, 'lib'), { recursive: true })
  writeFileSync(join(dest, 'lib', 'contact.ts'), '// 원래 연락 어댑터\n')
  const added = addInquiryMock(dest, { noOwner: { ko: 'a', en: 'b' } })
  assert.ok(added.includes('app/api/inquiry/read-capped.ts'), added.join())
  assert.equal(readFileSync(join(dest, INQUIRY_TARGETS.readCapped), 'utf8'), readFileSync(join(INQUIRY_ASSETS, 'read-capped.ts'), 'utf8'))
  assert.equal(dirname(join(dest, INQUIRY_TARGETS.readCapped)), dirname(join(dest, INQUIRY_TARGETS.route)), 'route.ts 와 같은 폴더(import "./read-capped")')
})
