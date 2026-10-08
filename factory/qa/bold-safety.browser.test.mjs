// 대담안 안전 — 실제 Chrome 으로 「동작 줄이기에서 정지 화면」을 재는 시험(factory v1 Task 4.2, D20). Chrome 을 띄우므로 실행 잠금 안에서만 돌린다.
//   양성: 정지 쪽 · 동작 줄이기 규칙을 지키는 쪽(CSS) = 정지.  음성: 규칙을 무시하는 CSS 애니메이션 · 스크립트가 값을 바꾸는 쪽 · 등장 대기로 글이 숨은 쪽 = 정지 아님.
//   깜빡임 상한은 CSS 키프레임 주기에서 읽는다(0.2초 주기 = 초당 5회 — 동작 줄이기 규칙을 지켜도 평소에는 깜빡이므로 그대로 센다).
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { measureBold } from './bold-safety.mjs'
import { BOLD_SCENE_KINDS, loadBoldIndex } from '../scripts/bold-scenes.mjs'
import { jobPath } from '../board/block-board/jobs.mjs'

const dir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'bold')
const srv = http.createServer((req, res) => {
  let body = null
  try { body = readFileSync(join(dir, req.url.replace(/^\/+/, ''))) } catch { /* 없는 파일 */ }
  if (body) res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(body)
  else res.writeHead(404).end('not found')
})
await new Promise((r) => srv.listen(0, '127.0.0.1', r))
const origin = `http://127.0.0.1:${srv.address().port}`
after(() => srv.close())

const measured = await measureBold(origin, ['/static.html', '/guarded.html', '/moving.html', '/js-moving.html', '/hidden.html'])
const at = (route) => measured.find((m) => m.route === route)

test('양성: 움직이는 것이 없는 쪽과 동작 줄이기 규칙을 지키는 쪽은 정지 화면이다', () => {
  for (const r of ['/static.html', '/guarded.html']) assert.deepEqual([r, at(r).static, at(r).problems], [r, true, []])
})

test('음성: 동작 줄이기를 무시하는 CSS 애니메이션은 정지가 아니다 — 1440·375 둘 다에서 잡힌다', () => {
  const m = at('/moving.html')
  assert.equal(m.static, false)
  assert.ok(m.problems.some((p) => p.includes('1440px')) && m.problems.some((p) => p.includes('375px')), m.problems.join('|'))
})

test('음성: 스크립트가 화면 값을 바꾸는 쪽(GSAP 같은 JS 장면)도 어긋난 간격으로 여러 번 표본한 값이 달라 정지가 아니다', () => {
  const m = at('/js-moving.html')
  assert.equal(m.static, false)
  assert.ok(m.problems.some((p) => /값이 바뀌는 요소/.test(p)), m.problems.join('|'))
})

test('음성: 등장을 기다리다 글이 숨은 쪽은 정지가 아니다(글이 숨지 않아야 한다)', () => {
  const m = at('/hidden.html')
  assert.equal(m.static, false)
  assert.ok(m.problems.some((p) => /숨은 글/.test(p)), m.problems.join('|'))
})

test('깜빡임 상한: 0.2초 주기 키프레임은 동작 줄이기 규칙이 있어도 초당 5회로 센다 · 정지 쪽은 0', () => {
  assert.equal(at('/moving.html').flashesPerSec, 5)
  assert.equal(at('/guarded.html').flashesPerSec, 5)
  assert.equal(at('/static.html').flashesPerSec, 0)
})

test('열리지 않는 쪽은 던진다(도구 실패로 읽힌다)', async () => {
  await assert.rejects(() => measureBold(origin, ['/nope.html']), /404|열리지|HTTP/)
})

// ── 실제 대담 장면(factory v1 Task 5.17 · C1) ────────────────────────────────────────────────────────────────
// 블록 메타에서 boldness "bold" 인 장면 블록 전부(원형마다 3개 이상으로 채운 것 — 새 히어로 6종·전폭 제목 배너·증거 패널·흐림→선명 온보딩 포함)를 갤러리에서
// 동작 줄이기 + 1440·375 로 열어 정지 화면인지 잰다(값이 바뀌는 요소·무한 반복·재생 중 영상·숨은 글 0). 갤러리는 `npm run build && npm start` 의 origin:
//   WF_BOLD_GALLERY=http://127.0.0.1:3000 node --test --test-force-exit --test-timeout=600000 factory/qa/bold-safety.browser.test.mjs   (Chrome 하나 — 실행 잠금 안에서만)
// origin 이 없으면 갤러리 시험은 건너뛰고(skip 이유가 출력에 남는다) 장면 목록 시험만 돈다 — 서버 없이도 「어느 장면을 재는가」는 고정된다.
const scenes = loadBoldIndex().filter((b) => b.boldness === 'bold' && BOLD_SCENE_KINDS.includes(b.kind)).map((b) => b.name).sort()
const gallery = process.env.WF_BOLD_GALLERY
const recipe = process.env.WF_BOLD_RECIPE || 'r1-measure'
const sceneRoute = (name) => jobPath({ block: name, recipe, theme: 'light' })

test('잴 장면 목록: 새 히어로 6종·전폭 제목 배너·증거 패널·흐림→선명 온보딩·detail 로 넓힌 히어로 둘이 모두 든다', () => {
  for (const n of ['object-3d-orbit', 'illustration-scene', 'map-first', 'mascot-greeting', 'video-montage', 'screenshot-window', 'identity-strip-banner', 'centered-proof-panel', 'ken-burns-stills', 'punch-in-statement'].map((v) => `block-hero-${v}`)) assert.ok(scenes.includes(n), `${n} 이 잴 장면에 없다`)
  assert.ok(scenes.includes('block-onboarding-empty-first-action'), '온보딩 장면')
})

test('실제 대담 장면 전부: 동작 줄이기에서 정지이고 글이 숨지 않는다(1440·375)', { skip: gallery ? false : 'WF_BOLD_GALLERY(갤러리 origin) 없음 — 서버를 띄우고 다시 돌린다' }, async () => {
  const real = await measureBold(gallery, scenes.map(sceneRoute)) // 시험 안에서 잰다 — 파일 머리에서 await 하면 먼저 등록된 시험이 끝난 뒤 실행기가 나가 버려 뒤 시험이 사라진다
  assert.equal(real.length, scenes.length)
  assert.deepEqual(real.filter((m) => !m.static).map((m) => `${m.route}: ${m.problems.join(' / ')}`), [])
  for (const m of real) assert.ok(m.flashesPerSec <= 3, `${m.route} 깜빡임 초당 ${m.flashesPerSec}회`)
})
