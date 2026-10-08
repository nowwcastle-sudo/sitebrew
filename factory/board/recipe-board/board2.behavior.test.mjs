// 보드 페이지 스크립트의 동작 검사(Task 10f 리뷰 M1·M4·L5·L6·L7, 대표 피드백 2026-09-28, Task 16 리뷰 14 #1·#2) — headless Chrome 에서 실제로 누른다(서버 없음, file://).
// 보드 HTML 은 원천 머리 + 가짜 촬영 목록으로 만들고(자산 파일은 없다 — 영상·그림은 비어 보인다), window.claude.use('db') 를 흉내 낸다.
// 흉내 db 는 런타임 계약 0.2.60 을 따른다: set = 통째 교체, update = 겹친 객체를 합치고 문서가 없으면 invalid_argument, get·컬렉션 get·onSnapshot.
//   ① db 가 늦게 준비된다 → 그 전에 누른 것이 첫 스냅숏 뒤 한 번 쓰인다. 같은 값은 다시 쓰지 않는다. 고르기를 지울 수 있다.
//   ② db 가 null → 쓰기 0, 저장했다고 말하지 않는다. ③ 쓰기가 invalid_argument → 읽기 전용 알림, 그 뒤 쓰기 시도 없음.
//   ④ 동작 줄이기 → 카드 영상 모두 멈춤. ⑤ 1440·⑥ 375 배치와 크게 보기.
//   ⑦ 저장된 3판 답·2판 답을 지우지 않는다(리뷰 14 #1): 첫 스냅숏이 1.5초 늦음 · onSnapshot 오류 · get 실패 · 두 탭이 서로 다른 칸을 고침(#2).
//      네 경우 모두 2판 답(v2)·3판 답(문서 본문)·다른 탭의 칸이 남아야 한다.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { startChrome, connect, navigateAndWait } from '../../qa/cdp.mjs'
import { buildBoard2, board2Data } from './build2.mjs'
import { optionJobs, manifestOf } from './video.mjs'
import { loadHeads, loadBoardHeads, GATE_CHROME_FLAGS } from './jobs.mjs'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
// 이 시험은 게시한 4판 보드의 레시피(고정본 heads-at-board.json 의 10벌)를 본다. 라이브러리에 r12~r16 이 확정으로 들어와도(FV1 레인 DRAFTS) 4판 기록은 그대로이고,
// 새 레시피는 보드 A2(scene-board)에서 판정했다 — 판정 기록 파일(recipe-board*-decisions.json)에는 새 레시피 항목이 없다.
const BOARD_IDS = new Set(loadBoardHeads().map((h) => h.id))
const heads = loadHeads().filter((h) => BOARD_IDS.has(h.id))
const options = optionJobs(heads).map((j) => ({
  recipe: j.recipe, option: j.option, fonts: ['x'], fontsOk: true,
  videos: [{ file: j.files.mp4, codec: 'h264', bytes: 1, duration: 6, crf: 22 }, { file: j.files.video, codec: 'vp9', bytes: 1, duration: 6, crf: 26 }],
  stills: [[1440, 900], [375, 812]].map(([w, h]) => ({ file: j.files[w], width: w, height: h, dpr: 2, bytes: 1, fonts: ['x'] })),
  reducedMotion: { still: true, diff: 0, running: 0 },
}))
const dir = mkdtempSync(join(tmpdir(), 'board2-behavior-'))
const file = join(dir, 'board2.html')
writeFileSync(file, buildBoard2(board2Data(heads, manifestOf({ origin: 'x', options }))))
const URL_ = pathToFileURL(file).href

// 흉내 db(한 탭): 쓰기·읽기를 window.__writes·__gets 에, 저장소를 window.__stored 에 남긴다. 설정은 window.__cfg(시험 도중 바꿀 수 있다).
// cfg: { delay, manual, nullDb, reject, stored, noClaude, snapDelay, snapFails, getFails }.
// manual: db 는 시험이 window.__readyDb() 를 부를 때 준비된다(시간이 아니라 순서로 — 부하가 걸려도 「준비 전」 구간이 줄지 않는다, Task 11 fix).
const MOCK = (cfg) => `(() => {
  const cfg = window.__cfg = ${JSON.stringify(cfg)};
  window.__writes = []; window.__gets = [];
  const stored = window.__stored = cfg.stored || {};
  const copy = (x) => JSON.parse(JSON.stringify(x));
  const merge = (a, b) => { const o = { ...a }; for (const [k, v] of Object.entries(b)) o[k] = v && typeof v === 'object' && !Array.isArray(v) && o[k] && typeof o[k] === 'object' && !Array.isArray(o[k]) ? merge(o[k], v) : v; return o; };
  const docSnap = (id) => ({ id, exists: id in stored, data: () => (id in stored ? copy(stored[id]) : undefined), metadata: { fromCache: false, hasPendingWrites: false } });
  const snap = () => ({ docs: Object.keys(stored).map(docSnap), metadata: { fromCache: false, hasPendingWrites: false } });
  const later = (v) => new Promise((r) => setTimeout(() => r(v), 30));
  const db = { collection: (c) => ({
    doc: (id) => ({
      set: (d) => { window.__writes.push({ c, id, op: 'set', d: copy(d) }); if (cfg.reject) return Promise.reject({ code: cfg.reject, message: 'rejected' }); stored[id] = copy(d); return later(); },
      update: (d) => { window.__writes.push({ c, id, op: 'update', d: copy(d) }); if (cfg.reject) return Promise.reject({ code: cfg.reject, message: 'rejected' }); if (!(id in stored)) return Promise.reject({ code: 'invalid_argument', message: 'missing' }); stored[id] = merge(stored[id], copy(d)); return later(); },
      get: () => { window.__gets.push(id); return cfg.getFails ? Promise.reject({ code: 'unavailable', message: 'get failed' }) : later(docSnap(id)); },
    }),
    get: () => { window.__gets.push('*'); return cfg.getFails ? Promise.reject({ code: 'unavailable', message: 'get failed' }) : later(snap()); },
    onSnapshot: (cb, err) => { if (cfg.snapFails) setTimeout(() => err({ code: 'unavailable', message: 'bridge' }), 50); else setTimeout(() => cb(snap()), cfg.snapDelay || 10); return () => {}; },
  }) };
  if (cfg.noClaude) return;
  window.claude = { use: (name) => new Promise((r) => { const ready = () => r(cfg.nullDb ? null : db); if (cfg.manual) window.__readyDb = ready; else setTimeout(ready, cfg.delay || 0) }) };
})()`

let chrome, c
before(async () => {
  // 두 탭 시험(리뷰 14 #2)이 뒤에 연 탭을 쓴다 — 뒤 탭의 타이머·렌더 늦춤을 끈다(부하에서 평가가 45초 답 없이 멈췄다, Task 16 전체 실행).
  chrome = await startChrome([...GATE_CHROME_FLAGS, '--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'], { prefix: 'board2-behavior-' })
  c = await connect(chrome.wsUrl)
  await c.send('Page.enable'); await c.send('Runtime.enable')
})
after(async () => {
  c?.ws.close()
  await chrome?.close()
  rmSync(dir, { recursive: true, force: true })
})

async function open(cfg, { width = 1440, height = 900, mobile = false, reduce = false } = {}) {
  const { send, ev } = c
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile })
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: reduce ? 'reduce' : 'no-preference' }, { name: 'prefers-color-scheme', value: 'light' }] })
  const { result } = await send('Page.addScriptToEvaluateOnNewDocument', { source: MOCK(cfg) })
  await navigateAndWait(send, ev, URL_, { timeoutMs: 20000 })
  await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: result.identifier })
  await sleep(100)
}
const ev = (x) => c.ev(x)
const clickIn = (e, sel) => e(`(() => { const x = document.querySelector(${JSON.stringify(sel)}); if (!x) throw new Error('없음 ' + ${JSON.stringify(sel)}); x.click(); return 1 })()`)
const typeIn = (e, sel, text) => e(`(() => { const x = document.querySelector(${JSON.stringify(sel)}); x.focus(); x.value = ${JSON.stringify(text)}; x.dispatchEvent(new Event('input', { bubbles: true })); x.blur(); return 1 })()`)
const click = (sel) => clickIn(ev, sel)
const type = (sel, text) => typeIn(ev, sel, text)
const text = (sel) => ev(`document.querySelector(${JSON.stringify(sel)}).textContent`)
const writes = () => ev('window.__writes')
const stored = (id) => ev(`window.__stored[${JSON.stringify(id)}] ?? null`)
const R1 = '#card-r1-measure', R2 = '#card-r2-signal', R6 = '#card-r6-civic'
// 조건이 참이 될 때까지 기다린다(최대 ms) — 고정 sleep 대신(부하에서 흔들리지 않게). 시간 안에 안 되면 마지막 값을 돌려준다.
async function until(read, ok, ms = 8000) { const t = Date.now(); let v = await read(); while (!ok(v) && Date.now() - t < ms) { await sleep(100); v = await read() } return v }
const without = (o, ...ks) => { const x = structuredClone(o); for (const k of ks) delete x[k]; return x }

const V2_R1 = { recipe: 'r1-measure', likes: { B: 'dislike' }, note: '옛 메모', decidedAt: '2026-09-27T00:00:00.000Z' }
test('db ready late: choices made before it resolves are written once, after the first snapshot, into the v4 slot of the saved doc — the old v2 doc body stays as it was; same value not rewritten; pick can be cleared', async () => {
  await open({ manual: true, stored: { 'r1-measure': V2_R1 } })
  await click(`${R1} [data-like="A"][value="like"]`)
  await click(`${R1} [data-aspect="color"][data-opt="A"][value="like"]`)
  await type(`${R1} textarea[data-note-opt="A"]`, '색이 좋다')
  assert.equal((await writes()).length, 0, '준비 전에는 쓰지 않는다')
  assert.match(await text(`${R1} [data-save]`), /확인하는 중/)
  assert.doesNotMatch(await text(`${R1} [data-save]`), /저장할 수 없습니다|저장했습니다/)
  await ev('window.__readyDb()')
  await until(writes, (w) => w.length >= 1)
  await until(() => text(`${R1} [data-save]`), (t) => /저장했습니다/.test(t))
  await sleep(500)
  const w = await writes()
  assert.equal(w.length, 1, JSON.stringify(w))
  assert.equal(w[0].c, 'likes')
  assert.equal(w[0].id, 'r1-measure')
  // 있는 문서라 update — v4 안의 고친 칸만. 옛 2판 문서 본문(윗단)은 건드리지 않는다.
  assert.equal(w[0].op, 'update')
  const { decidedAt, ...v4 } = w[0].d.v4
  assert.deepEqual(Object.keys(w[0].d), ['v4'])
  assert.deepEqual(v4, { board: 4, likes: { A: 'like' }, aspects: { A: { color: 'like' } }, notes: { A: '색이 좋다' } })
  assert.ok(decidedAt)
  assert.deepEqual(without(await stored('r1-measure'), 'v4'), V2_R1, '2판 답(문서 본문)이 그대로')
  assert.deepEqual(await ev('window.__gets'), [], '첫 스냅숏이 확정 읽기다(따로 get 하지 않는다)')
  assert.equal(await text('#progress'), '0', '4판에서 B는 아직 고르지 않았다')
  assert.equal(await ev(`document.querySelector('${R1} [data-like="B"][value="dislike"]').getAttribute('aria-pressed')`), 'false', '2판 답은 눌린 상태가 아니라 작은 줄로')
  assert.equal(await text(`${R1} [data-prev="B"][data-round="2"]`), '2판 답: 별로')
  assert.equal(await text(`${R1} [data-prev="A"][data-round="2"]`), '2판 답: 없음')
  assert.equal(await ev(`document.querySelector('${R1} [data-prev="A"][data-round="3"]').hidden`), true, '3판 답이 없으면 숨긴다')
  assert.equal(await text(`${R1} [data-prev-recipe="2"]`), '2판 전체 메모 「옛 메모」')
  // 같은 값: 메모를 같은 값으로 다시 입력해도 쓰지 않는다(L5).
  await type(`${R1} textarea[data-note-opt="A"]`, '색이 좋다')
  await sleep(1300)
  assert.equal((await writes()).length, 1, '같은 값은 다시 쓰지 않는다')
  // 고르기 → 지우기(L7): 지운 칸은 null(읽을 때 버린다).
  await click(`${R1} input[data-pick][value="A"]`)
  await until(writes, (x) => x.length >= 2)
  await click(`${R1} input[data-pick][value=""]`)
  await until(writes, (x) => x.length >= 3)
  await sleep(300)
  const w2 = await writes()
  assert.equal(w2.length, 3)
  assert.equal(w2[1].d.v4.pick, 'A')
  assert.equal(w2[2].d.v4.pick, null, '고르지 않음 → null')
  assert.deepEqual(Object.keys(w2[2].d.v4).sort(), ['board', 'decidedAt', 'pick'], '바뀐 칸만')
  const s = await stored('r1-measure')
  assert.deepEqual(without(s, 'v4'), V2_R1)
  assert.deepEqual(without(s.v4, 'decidedAt'), { board: 4, likes: { A: 'like' }, aspects: { A: { color: 'like' } }, notes: { A: '색이 좋다' }, pick: null })
})

test('a recipe with no saved doc: the first write re-reads it and creates it with set ({ recipe, board: 4, v4 }); later writes are updates', async () => {
  await open({ stored: {} })
  await until(() => text('#db-status'), (t) => /고르면 바로 저장/.test(t))
  await click(`${R2} [data-like="A"][value="like"]`)
  await until(writes, (w) => w.length >= 1)
  await click(`${R2} [data-like="B"][value="dislike"]`)
  await until(writes, (w) => w.length >= 2)
  const w = await writes()
  assert.deepEqual(w.map((x) => x.op), ['set', 'update'])
  assert.deepEqual(await ev('window.__gets'), ['r2-signal'], '만들기 바로 전에 다시 읽었다')
  assert.deepEqual(without(w[0].d, 'v4'), { recipe: 'r2-signal', board: 4 })
  assert.deepEqual((await stored('r2-signal')).v4.likes, { A: 'like', B: 'dislike' })
})

test('db resolves null: nothing is written and the page never claims a save', async () => {
  await open({ delay: 200, nullDb: true })
  await click(`${R2} [data-like="A"][value="like"]`)
  await sleep(600)
  await click(`${R2} [data-like="B"][value="dislike"]`)
  assert.equal((await writes()).length, 0)
  assert.match(await text('#db-status'), /쓸 수 없는/)
  assert.match(await text(`${R2} [data-save]`), /저장되지 않습니다/)
  assert.doesNotMatch(await ev("document.querySelector('.wrap').innerText"), /저장했습니다/)
  assert.equal(await text('#progress'), '1', '진행 계수는 저장과 상관없이 센다')
})

test('write refused with invalid_argument: read-only notice once, no further write attempts', async () => {
  await open({ reject: 'invalid_argument' })
  await until(() => text('#db-status'), (t) => /고르면 바로 저장/.test(t))
  await click(`${R2} [data-like="A"][value="like"]`)
  await until(() => text('#db-status'), (t) => /읽기 전용/.test(t))
  assert.equal((await writes()).length, 1)
  await click(`${R2} [data-like="B"][value="like"]`)
  await click(`${R1} [data-aspect="motion"][data-opt="B"][value="dislike"]`)
  await sleep(400)
  assert.equal((await writes()).length, 1, '읽기 전용 뒤에는 쓰지 않는다')
  assert.match(await text(`${R1} [data-save]`), /읽기 전용/)
})

test('reduced motion: every card video is paused with autoplay off and a 재생 button', async () => {
  await open({ noClaude: true }, { reduce: true })
  await sleep(300)
  const r = await ev(`[...document.querySelectorAll('.desk video')].map((v) => ({ paused: v.paused, auto: v.autoplay, b: v.parentElement.querySelector('[data-play]').textContent }))`)
  // 9벌 A·B + r5-celadon(선택 보드 2판·Task 10f — B 없음) A만 = 19.
  assert.equal(r.length, 19)
  assert.ok(r.every((x) => x.paused && !x.auto && x.b === '재생'), JSON.stringify(r.slice(0, 2)))
})

test('1440: each option spans the content width, A above B, phone at 375 px; 크게 보기 shows 1440 px video, A↔B at the same place, Esc closes and returns focus', async () => {
  await open({ noClaude: true })
  const box = await ev(`(() => { const r = (s) => document.querySelector(s).getBoundingClientRect(); const a = r('${R1} [data-option="A"] .desk video'), b = r('${R1} [data-option="B"] .desk video'), p = r('${R1} [data-option="A"] .phone img'), card = r('${R1}'); return { aw: a.width, bw: b.width, aBottom: a.bottom, bTop: b.top, pw: p.width, card: card.width, sw: document.documentElement.scrollWidth } })()`)
  assert.ok(box.aw >= 1250 && box.bw >= 1250, `영상 폭 ${box.aw} · ${box.bw}`)
  assert.ok(box.aBottom < box.bTop, 'A 위 B 아래')
  assert.equal(Math.round(box.pw), 375)
  assert.equal(box.sw, 1440)
  await click(`${R1} [data-big="A"]`)
  await sleep(200)
  const v1 = await ev(`(() => { const d = document.getElementById('viewer'), v = d.querySelector('.v-video').getBoundingClientRect(); return { open: d.open, w: v.width, h: v.height, x: v.left, title: d.querySelector('#viewer-title').textContent, src: d.querySelector('.v-video').dataset.src, pressed: d.querySelector('[data-v-opt="A"]').getAttribute('aria-pressed') } })()`)
  assert.equal(v1.open, true)
  assert.equal(v1.w, 1440)
  assert.equal(v1.h, 900)
  assert.match(v1.title, /A안/)
  assert.match(v1.src, /^video\/r1-measure-A\.(mp4|webm)$/)
  assert.equal(v1.pressed, 'true')
  await click('#viewer [data-v-opt="B"]')
  const v2 = await ev(`(() => { const d = document.getElementById('viewer'), v = d.querySelector('.v-video').getBoundingClientRect(); return { w: v.width, x: v.left, title: d.querySelector('#viewer-title').textContent, src: d.querySelector('.v-video').dataset.src } })()`)
  assert.equal(v2.w, 1440)
  assert.equal(v2.x, v1.x, '같은 자리')
  assert.match(v2.title, /B안/)
  assert.match(v2.src, /^video\/r1-measure-B\.(mp4|webm)$/)
  await click('#viewer [data-v-view="phone"]')
  const ph = await ev(`(() => { const d = document.getElementById('viewer'); return { img: d.querySelector('.v-phone').getBoundingClientRect().width, video: d.querySelector('.v-video').hidden } })()`)
  assert.deepEqual(ph, { img: 375, video: true })
  await c.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
  await c.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
  await sleep(200)
  assert.equal(await ev(`document.getElementById('viewer').open`), false)
  assert.equal(await ev(`document.activeElement === document.querySelector('${R1} [data-big="A"]')`), true, '초점이 크게 보기 단추로 돌아온다')
  // 닫기 단추도 닫는다.
  await click(`${R2} [data-big="B"]`)
  await click('#viewer [data-v-close]')
  assert.equal(await ev(`document.getElementById('viewer').open`), false)
})

test('375 (mobile): no horizontal page scroll; the overlay fits the screen and its stage scrolls to the native 1440 px video', async () => {
  await open({ noClaude: true }, { width: 375, height: 812, mobile: true })
  const page = await ev(`({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, compat: document.compatMode })`)
  assert.deepEqual(page, { sw: 375, cw: 375, compat: 'CSS1Compat' })
  await click(`${R1} [data-big="A"]`)
  await sleep(200)
  const v = await ev(`(() => { const d = document.getElementById('viewer'), s = d.querySelector('.v-stage'), x = d.querySelector('[data-v-close]').getBoundingClientRect(), dr = d.getBoundingClientRect(); return { dw: dr.width, stageSW: s.scrollWidth, stageCW: s.clientWidth, closeRight: x.right, closeBottom: x.bottom, closeH: x.height } })()`)
  assert.equal(Math.round(v.dw), 375)
  assert.ok(v.stageSW >= 1440 && v.stageCW <= 375, JSON.stringify(v))
  assert.ok(v.closeRight <= 375 && v.closeBottom <= 812 && v.closeH >= 44, JSON.stringify(v))
  await click('#viewer [data-v-close]')
})

// ── 보드 4판(Task 16): 3판·2판 답 표시(합성한 글자) · 이전 판 답 보존 · 안이 하나인 레시피 ──
const R5 = '#card-r5-celadon'
// 2판 문서(운영자가 2판에서 실제로 남긴 모양 — r2 는 A 별로·B 좋다·B를 골랐다).
const V2_R2 = { recipe: 'r2-signal', likes: { A: 'dislike', B: 'like' }, aspects: { A: { color: 'like', layout: 'dislike', motion: 'dislike', type: 'like' } }, notes: { A: '움직임이 너무 단순함' }, pick: 'B', decidedAt: '2026-09-27T20:09:32.239Z' }
// 3판 문서(운영자가 3판에서 실제로 남긴 r2 — 두 안 좋다, B(= 2판 A안, cropped-title-list)를 골랐다). 지금 A = cropped-title-list = 3판 B = 2판 A.
const V3_R2 = { recipe: 'r2-signal', board: 3, likes: { A: 'like', B: 'like' }, pick: 'B', decidedAt: '2026-09-28T09:23:26.706Z', v2: V2_R2 }
test('board 4 (r2 double swap): cropped-title-list (now A) shows its v3 B and v2 A answers, inline-chip-title (now B) its v3 A and v2 B; picks map to 「지금의」 options; re-rating writes v4 only and a saved v4 reloads', async () => {
  await open({ stored: { 'r2-signal': V3_R2 } })
  await until(() => text(`${R2} [data-prev="A"][data-round="3"]`), (t) => /3판 답/.test(t))
  assert.equal(await text(`${R2} [data-prev="A"][data-round="3"]`), '3판 답: 좋다 (3판 B안)')
  assert.equal(await text(`${R2} [data-prev="A"][data-round="2"]`), '2판 답: 별로 · 색감 좋다 · 글씨체 좋다 · 배치 별로 · 움직임 별로 · 2판 메모 「움직임이 너무 단순함」')
  assert.equal(await text(`${R2} [data-prev="B"][data-round="3"]`), '3판 답: 좋다 (3판 A안)')
  assert.equal(await text(`${R2} [data-prev="B"][data-round="2"]`), '2판 답: 좋다')
  assert.equal(await text(`${R2} [data-prev-recipe="3"]`), '3판에서 고른 안: 지금의 A안')
  assert.equal(await text(`${R2} [data-prev-recipe="2"]`), '2판에서 고른 안: 지금의 B안', '2판 pick B = inline-chip-title = 지금 B')
  assert.equal(await ev(`[...document.querySelectorAll('${R2} [aria-pressed="true"]')].length`), 0, '4판 답은 빈 채로 시작')
  await click(`${R2} [data-like="B"][value="like"]`)
  await until(writes, (w) => w.length >= 1)
  const w = await writes()
  assert.equal(w.length, 1)
  assert.deepEqual(w[0].d.v4.likes, { B: 'like' })
  const s1 = await stored('r2-signal')
  assert.deepEqual(without(s1, 'v4'), V3_R2, '3판 답(본문)·2판 답(v2) 그대로')
  // 저장된 문서를 다시 열면: 4판 답은 눌린 상태로, 이전 판 답은 작은 줄로 그대로.
  await open({ stored: { 'r2-signal': s1 } })
  await until(() => text(`${R2} [data-prev="A"][data-round="3"]`), (t) => /3판 답/.test(t))
  assert.equal(await ev(`document.querySelector('${R2} [data-like="B"][value="like"]').getAttribute('aria-pressed')`), 'true')
  assert.equal(await text(`${R2} [data-prev="A"][data-round="3"]`), '3판 답: 좋다 (3판 B안)')
  await click(`${R2} [data-like="A"][value="dislike"]`)
  await until(writes, (x) => x.length >= 1)
  const s2 = await stored('r2-signal')
  assert.deepEqual(s2.v4.likes, { A: 'dislike', B: 'like' })
  assert.deepEqual(without(s2, 'v4'), V3_R2, '두 번째 4판 쓰기도 이전 판 답을 지우지 않는다')
  assert.equal(await text('#progress'), '1', 'r2 는 두 안을 다 골랐다')
})

// 운영자가 3판에서 실제로 남긴 r6 — B(identity-strip-banner) 좋다·B를 골랐다. 지금 A = identity-strip-banner.
const V3_R6 = { recipe: 'r6-civic', board: 3, aspects: { A: { color: 'like', layout: 'like', motion: 'dislike', type: 'like' } }, likes: { B: 'like' }, notes: { A: '움직임이 너무 단순해.', B: '움직임은 단순하지만, 깔끔해서 오히려 좋아' }, pick: 'B', decidedAt: '2026-09-28T09:25:39.525Z', v2: { recipe: 'r6-civic', likes: { A: 'like', B: 'like' }, decidedAt: '2026-09-27T20:11:29.175Z' } }
test('board 4 (r6): the stored v3 pick B lands on the current A (identity-strip-banner), with its v3 answer and memo; the too-simple old A is now B', async () => {
  await open({ stored: { 'r6-civic': V3_R6 } })
  await until(() => text(`${R6} [data-prev-recipe="3"]`), (t) => /3판/.test(t))
  assert.equal(await text(`${R6} [data-prev-recipe="3"]`), '3판에서 고른 안: 지금의 A안')
  assert.equal(await text(`${R6} [data-prev="A"][data-round="3"]`), '3판 답: 좋다 (3판 B안) · 3판 메모 「움직임은 단순하지만, 깔끔해서 오히려 좋아」')
  assert.equal(await text(`${R6} [data-prev="B"][data-round="3"]`), '3판 답: 색감 좋다 · 글씨체 좋다 · 배치 좋다 · 움직임 별로 (3판 A안) · 3판 메모 「움직임이 너무 단순해.」')
})

test('board 4: a one-option recipe (r5-celadon) shows one option, counts as done with A alone, asks 「이 안으로 정할까요」 and hides B in the viewer; its dropped v2 B answer is not shown', async () => {
  await open({ stored: { 'r5-celadon': { recipe: 'r5-celadon', likes: { A: 'like' }, aspects: { B: { layout: 'dislike', motion: 'dislike' } }, notes: { B: '빈 공간이 많다' }, pick: 'A', decidedAt: '2026-09-27T20:11:13.887Z' } } })
  await until(() => text(`${R5} [data-prev="A"][data-round="2"]`), (t) => /2판 답/.test(t))
  assert.equal(await ev(`document.querySelectorAll('${R5} .opt').length`), 1)
  assert.equal(await text(`${R5} [data-prev="A"][data-round="2"]`), '2판 답: 좋다')
  assert.doesNotMatch(await ev(`document.querySelector('${R5}').innerText`), /빈 공간이 많다/)
  assert.equal(await text(`${R5} [data-prev-recipe="2"]`), '2판에서 고른 안: 지금의 A안')
  assert.match(await text(`${R5} .pick legend`), /이 안으로 정할까요/)
  await click(`${R5} [data-like="A"][value="like"]`)
  assert.equal(await text('#progress'), '1', 'A 하나로 판정 끝')
  await click(`${R5} [data-big="A"]`)
  await sleep(150)
  assert.deepEqual(await ev(`[...document.querySelectorAll('#viewer [data-v-opt]')].map((b) => [b.dataset.vOpt, b.hidden])`), [['A', false], ['B', true]])
  await click('#viewer [data-v-close]')
})

// ── 리뷰 14 #1: 대표의 실제 r1 3판 문서 모양으로 네 가지 늦음·실패를 돌린다. 어느 경우에도 3판 답(본문)·2판 답(v2)이 남아야 한다. ──
const V3_R1 = { recipe: 'r1-measure', board: 3, likes: { A: 'like' }, notes: { B: '모바일에서 3600의 배치가 좀 이상하게 되어 있음.' }, decidedAt: '2026-09-28T09:22:46.965Z', v2: { recipe: 'r1-measure', likes: { A: 'like', B: 'like' }, decidedAt: '2026-09-27T20:00:00.000Z' } }
const keptR1 = async (label) => {
  const s = await stored('r1-measure')
  assert.deepEqual(without(s, 'v4'), V3_R1, `${label}: 3판 답·2판 답 그대로`)
  assert.deepEqual(s.v4?.likes, { B: 'like' }, `${label}: 4판 답`)
}

test('review 14 #1a: the first snapshot arrives 1.5 s after db is ready — a click in between is held (not ready yet) and written after the snapshot; v2 and the v3 answer survive', async () => {
  await open({ stored: { 'r1-measure': V3_R1 }, snapDelay: 1500 })
  await until(() => text('#db-status'), (t) => /읽는 중/.test(t))
  await click(`${R1} [data-like="B"][value="like"]`)
  await sleep(300)
  assert.equal((await writes()).length, 0, '첫 스냅숏 전에는 쓰지 않는다')
  assert.match(await text(`${R1} [data-save]`), /읽는 중/)
  await until(writes, (w) => w.length >= 1, 6000)
  await sleep(300)
  assert.equal((await writes()).length, 1)
  assert.equal((await writes())[0].op, 'update')
  await keptR1('#1a')
  assert.equal(await text(`${R1} [data-prev="B"][data-round="3"]`), '3판 답: 없음 · 3판 메모 「모바일에서 3600의 배치가 좀 이상하게 되어 있음.」')
})

test('review 14 #1b: onSnapshot errors (and the re-read fails too) — writes are blocked with a notice until a re-read succeeds, then written; v2 and the v3 answer survive', async () => {
  await open({ stored: { 'r1-measure': V3_R1 }, snapFails: true, getFails: true })
  await until(() => text('#db-status'), (t) => /읽지 못했습니다/.test(t))
  await click(`${R1} [data-like="B"][value="like"]`)
  await sleep(600)
  assert.equal((await writes()).length, 0, '다시 읽기 전에는 쓰지 않는다')
  assert.match(await text(`${R1} [data-save]`), /다시 읽는 중/)
  await ev('window.__cfg.getFails = false')
  await until(writes, (w) => w.length >= 1, 8000)
  await sleep(300)
  assert.match(await text('#db-status'), /다시 읽었습니다|고르면 바로 저장/)
  assert.ok((await ev('window.__gets')).includes('*'), '컬렉션을 다시 읽었다')
  await keptR1('#1b')
})

test('review 14 #1c: get fails for a doc that must be read before writing — nothing is written, a retryable error shows, and the write goes through once the read works; v2 and the v3 answer survive', async () => {
  // 캐시 스냅숏(확정 아님)만 온 문서는 쓰기 전에 get 으로 다시 읽어야 한다 — 그 get 이 실패하는 경우.
  // 없는 문서(r2)는 만들기 전에, 확정 읽기를 잃은 문서(r1 — 페이지의 loaded 를 끈다, 캐시 스냅숏만 받은 것과 같은 상태)는 쓰기 전에 get 으로 읽는다.
  await open({ stored: { 'r1-measure': V3_R1 }, getFails: true, snapDelay: 10 })
  await until(() => text('#db-status'), (t) => /고르면 바로 저장/.test(t))
  await ev(`loaded['r1-measure'] = false`)
  await click(`${R1} [data-like="B"][value="like"]`)
  await click(`${R2} [data-like="A"][value="like"]`)
  await until(() => text(`${R1} [data-save]`), (t) => /읽지 못해 아직 저장하지 않았습니다/.test(t), 4000)
  await until(() => text(`${R2} [data-save]`), (t) => /읽지 못해 아직 저장하지 않았습니다/.test(t), 4000)
  await sleep(1500)
  assert.equal((await writes()).length, 0, '읽지 못하면 쓰지 않는다(다시 시도하는 동안에도)')
  assert.ok((await ev('window.__gets')).filter((x) => x === 'r1-measure').length >= 2, '다시 시도한다')
  assert.match(await text(`${R1} [data-save]`), /곧 다시 시도합니다/)
  await ev('window.__cfg.getFails = false')
  await until(writes, (w) => w.length >= 2, 10000)
  await sleep(300)
  await keptR1('#1c')
  assert.deepEqual((await writes()).map((w) => [w.id, w.op]).sort(), [['r1-measure', 'update'], ['r2-signal', 'set']])
})

// ── 리뷰 14 #2: 두 탭이 같은 문서의 다른 칸을 거의 동시에 고친다. 저장소는 이 시험 프로세스에 하나 두고, 두 탭의 흉내 db 가 CDP 바인딩으로 부른다(실제 런타임처럼
//    한 탭의 쓰기가 두 탭 모두에 스냅숏으로 간다). 어느 쪽도 다른 탭의 칸·3판 답·2판 답을 지우지 않아야 한다. ──
const RELAY = `(() => {
  let q = 0; const waits = {}; const subs = [];
  const wrap = (id, v) => ({ id, exists: v != null, data: () => (v == null ? undefined : JSON.parse(JSON.stringify(v))), metadata: { fromCache: false, hasPendingWrites: false } });
  window.__dbReply = (i, r) => { const w = waits[i]; delete waits[i]; if (r.err) w.j(r.err); else w.r(r.res); };
  window.__dbSnap = (docs) => { const s = { docs: docs.map(([id, v]) => wrap(id, v)), metadata: { fromCache: false, hasPendingWrites: false } }; for (const cb of subs) cb(s); };
  const call = (op, id, data) => new Promise((r, j) => { const i = ++q; waits[i] = { r, j }; window.__dbCall(JSON.stringify({ q: i, op, id, data })); });
  const db = { collection: () => ({
    doc: (id) => ({ get: () => call('get', id).then((v) => wrap(id, v)), set: (d) => call('set', id, d), update: (d) => call('update', id, d) }),
    get: () => call('list').then((docs) => ({ docs: docs.map(([id, v]) => wrap(id, v)), metadata: { fromCache: false, hasPendingWrites: false } })),
    onSnapshot: (cb) => { subs.push(cb); call('sub'); return () => {}; },
  }) };
  window.claude = { use: () => Promise.resolve(db) };
})()`
const mergeDoc = (a, b) => { const o = { ...a }; for (const [k, v] of Object.entries(b)) o[k] = v && typeof v === 'object' && !Array.isArray(v) && o[k] && typeof o[k] === 'object' && !Array.isArray(o[k]) ? mergeDoc(o[k], v) : v; return o }

test('review 14 #2: two tabs edit different fields of the same doc at almost the same time — both fields, the v3 answer and v2 survive', async () => {
  const store = { 'r1-measure': structuredClone(V3_R1) }
  const ops = []
  const tabs = []
  const docs = () => Object.entries(store)
  const push = async () => { for (const t of tabs) if (t.sub) await t.ev(`window.__dbSnap(${JSON.stringify(docs())})`) }
  const handle = async (t, payload) => {
    const { q, op, id, data } = JSON.parse(payload)
    ops.push({ tab: t.name, op, id })
    await sleep(40) // 왕복 지연 — 두 탭의 쓰기가 겹치게
    let res = null, err = null
    if (op === 'get') res = store[id] ?? null
    else if (op === 'list') res = docs()
    else if (op === 'set') store[id] = structuredClone(data)
    else if (op === 'update') { if (!(id in store)) err = { code: 'invalid_argument', message: 'missing' }; else store[id] = mergeDoc(store[id], data) }
    else if (op === 'sub') t.sub = true
    await t.ev(`window.__dbReply(${q}, ${JSON.stringify({ res, err })})`)
    if (op === 'set' || op === 'update') await push()
    if (op === 'sub') await t.ev(`window.__dbSnap(${JSON.stringify(docs())})`)
  }
  for (const name of ['A', 'B']) {
    const { result } = await c.send('Target.createTarget', { url: 'about:blank', newWindow: true })
    const t = { name, targetId: result.targetId, sub: false }
    const conn = await connect(`ws://127.0.0.1:${chrome.port}/devtools/page/${result.targetId}`, { onEvent: (d) => { if (d.method === 'Runtime.bindingCalled' && d.params.name === '__dbCall') handle(t, d.params.payload).catch(() => {}) } })
    Object.assign(t, conn)
    await t.send('Page.enable'); await t.send('Runtime.enable')
    await t.send('Emulation.setFocusEmulationEnabled', { enabled: true })
    await t.send('Runtime.addBinding', { name: '__dbCall' })
    await t.send('Page.addScriptToEvaluateOnNewDocument', { source: RELAY })
    await navigateAndWait(t.send, t.ev, URL_, { timeoutMs: 20000 })
    tabs.push(t)
  }
  try {
    for (const t of tabs) await until(() => t.ev(`document.getElementById('db-status').textContent`), (s) => /고르면 바로 저장/.test(s))
    // 두 탭이 거의 동시에 서로 다른 칸을 고친다: A 탭은 B안 좋다, B 탭은 A안 색감 별로와 A안 메모.
    await Promise.all([
      clickIn(tabs[0].ev, `${R1} [data-like="B"][value="like"]`),
      (async () => { await clickIn(tabs[1].ev, `${R1} [data-aspect="color"][data-opt="A"][value="dislike"]`); await typeIn(tabs[1].ev, `${R1} textarea[data-note-opt="A"]`, '다른 탭 메모') })(),
    ])
    const done = () => store['r1-measure'].v4?.likes?.B === 'like' && store['r1-measure'].v4?.aspects?.A?.color === 'dislike' && store['r1-measure'].v4?.notes?.A === '다른 탭 메모'
    for (let i = 0; i < 80 && !done(); i++) await sleep(100)
    await sleep(500)
    const s = store['r1-measure']
    assert.deepEqual(without(s, 'v4'), V3_R1, '3판 답·2판 답 그대로')
    assert.equal(s.v4.likes.B, 'like', 'A 탭의 칸')
    assert.equal(s.v4.aspects.A.color, 'dislike', 'B 탭의 칸')
    assert.equal(s.v4.notes.A, '다른 탭 메모', 'B 탭의 메모')
    assert.ok(!ops.some((o) => o.op === 'set'), `있는 문서에 set 을 쓰지 않는다: ${JSON.stringify(ops.filter((o) => o.op === 'set'))}`)
    // 두 탭 화면도 서로의 칸을 보인다(스냅숏이 온 뒤 다시 얹은 내 칸과 함께).
    for (const t of tabs) {
      const seen = await until(() => t.ev(`[document.querySelector('${R1} [data-like="B"][value="like"]').getAttribute('aria-pressed'), document.querySelector('${R1} [data-aspect="color"][data-opt="A"][value="dislike"]').getAttribute('aria-pressed')]`), (x) => x?.[0] === 'true' && x?.[1] === 'true', 4000)
      assert.deepEqual(seen, ['true', 'true'], `탭 ${t.name}`)
    }
  } finally {
    for (const t of tabs) { t.ws.close(); await c.send('Target.closeTarget', { targetId: t.targetId }).catch(() => {}) }
  }
})
