// 방향 보드 페이지 동작 검사(P3-3 Task 12) — headless Chrome 에서 실제로 누른다(서버 없음, file://). 아티팩트는 게시하지 않는다.
// 보드 HTML 은 가짜 후보 3개(라이브러리 · 생성 · 브랜드)로 만들고, window.claude.use('db') 를 흉내 낸다(런타임 계약 0.2.60 — board2.behavior.test.mjs 와 같은 흉내).
// 저장 규칙은 레시피 보드 v2 와 같다: ① db 가 늦게 준비되면 그 전에 누른 것은 첫 스냅숏 뒤 한 번 쓰인다(같은 값은 다시 쓰지 않고, 고르기·올리기를 지울 수 있다)
//   ② 없는 문서는 만들기 바로 전에 다시 읽고 set ③ db 가 null → 쓰기 0·저장했다고 말하지 않는다 ④ invalid_argument → 읽기 전용 알림, 그 뒤 쓰기 없음
//   ⑤ 첫 스냅숏 1.5초 늦음 ⑥ onSnapshot 오류 + 다시 읽기 실패 → 다시 읽을 때까지 쌓아 둠 ⑦ 확정 읽기를 잃은 문서의 get 이 실패 → 쓰지 않고 다시 시도
//   ⑧ 두 탭이 같은 문서의 다른 칸(고르기 · 올리기)을 거의 동시에 고침 → 둘 다 남는다 ⑨ 카드: 출처 배지·공개 불가 사유·올리기 체크(생성·브랜드만)·1440 배치·375 가로 스크롤 없음·동작 줄이기.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { startChrome, connect, navigateAndWait } from '../../qa/cdp.mjs'
import { buildDirectionBoard } from './build.mjs'
import { GATE_CHROME_FLAGS } from '../recipe-board/jobs.mjs'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const RUN = 'run-t12'
const cands = [
  { id: 'a', slot: 'safe', source: 'library', recipe: 'r4-evidence', preset: null, palette: 'pal-recipe-r4-evidence', fonts: { display: 'Fraunces', body: 'Inter' }, why: '① 무난', blockers: [], state: 'ready', qa: { publishable: true, gates: { pass: 4 }, warnings: 0 }, brand: null, previewUrl: 'https://wf-preview-a.vercel.app', media: { mp4: 'a-A.mp4', webm: 'a-A.webm', poster: 'a-A-1440.webp', phone: 'a-A-375.webp' } },
  { id: 'b', slot: 'new', source: 'generated', recipe: 'x-run-t12-b', preset: 'gen-minimalism', palette: 'pal-x', fonts: { display: 'Geist', body: 'Inter' }, why: '② 새 조합', blockers: ['공개 불가 — 필수 섹션 블록 없음: home/notice', '공개 불가 — 확인 필요 사실: business.phone', '사유 3', '사유 4', '사유 5', '사유 6', '사유 7'], state: 'blocked', qa: { publishable: false, gates: { pass: 2, fail: 1 }, warnings: 1 }, brand: null, previewUrl: null, media: null },
  { id: 'c', slot: 'bold', source: 'brand', recipe: 'x-run-t12-c', preset: 'gen-dark-mode-first', palette: 'pal-y', fonts: { display: 'Pretendard', body: 'Pretendard' }, why: '③ 과감', blockers: [], state: 'unknown', qa: null, brand: { adjustments: [{ role: 'primary', theme: 'light', from: '#fc0', to: '#e6b800', reason: '명도만 조정' }], fontSubstitutions: [] }, previewUrl: null, media: null },
]
const dir = mkdtempSync(join(tmpdir(), 'dirboard-behavior-'))
const file = join(dir, 'board.html')
writeFileSync(file, buildDirectionBoard({ run: RUN, archetype: 'saas', brief: '치과 예약 안내', cands }))
const URL_ = pathToFileURL(file).href

// 흉내 db(한 탭): 쓰기·읽기를 window.__writes·__gets 에, 저장소를 window.__stored 에 남긴다. cfg: { delay, manual, nullDb, reject, stored, noClaude, snapDelay, snapFails, getFails }.
// manual: db 는 시험이 window.__readyDb() 를 부를 때 준비된다(시간이 아니라 순서로 — 부하가 걸려도 「준비 전」 구간이 줄지 않는다).
const MOCK = (cfg) => `(() => {
  const cfg = window.__cfg = ${JSON.stringify(cfg)};
  window.__writes = []; window.__gets = [];
  const stored = window.__stored = cfg.stored || {};
  const copy = (x) => JSON.parse(JSON.stringify(x));
  const merge = (a, b) => { const o = { ...a }; for (const [k, v] of Object.entries(b)) { if (v === null) delete o[k]; else o[k] = v && typeof v === 'object' && !Array.isArray(v) && o[k] && typeof o[k] === 'object' && !Array.isArray(o[k]) ? merge(o[k], v) : v; } return o; };
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
  chrome = await startChrome([...GATE_CHROME_FLAGS, '--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'], { prefix: 'dirboard-behavior-' })
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
const stored = (id = RUN) => ev(`window.__stored[${JSON.stringify(id)}] ?? null`)
const pressed = (id) => ev(`document.querySelector('[data-pick="${id}"]').getAttribute('aria-pressed')`)
const checked = (id) => ev(`document.querySelector('[data-promote="${id}"]').checked`)
async function until(read, ok, ms = 8000) { const t = Date.now(); let v = await read(); while (!ok(v) && Date.now() - t < ms) { await sleep(100); v = await read() } return v }
const without = (o, ...ks) => { const x = structuredClone(o); for (const k of ks) delete x[k]; return x }
const OLD = { run: RUN, board: 1, pick: 'a', note: '옛 메모', decidedAt: '2026-09-29T00:00:00.000Z' }

test('cards: source badges, blockers (all of them, folded past five), promote checkbox only on generated and brand cards, brand adjustments, preview link', async () => {
  await open({ noClaude: true })
  const r = await ev(`(() => { const q = (s) => [...document.querySelectorAll(s)]; return {
    badges: q('.card .badge').map((b) => b.textContent), promote: q('[data-promote]').map((x) => x.dataset.promote), picks: q('[data-pick]').map((x) => x.dataset.pick),
    blockers: q('#card-b [data-blocker]').length, folded: q('#card-b details')[0]?.open, visible: q('#card-b [data-blocker]').filter((x) => x.checkVisibility()).length,
    states: q('.publish').map((x) => x.dataset.state), adjust: q('#card-c [data-adjust]').length, preview: q('[data-preview]').map((x) => x.href), noPromoteOnA: !document.querySelector('#card-a [data-promote]') } })()`)
  assert.deepEqual(r.badges, ['검증', '생성', '브랜드'])
  assert.deepEqual(r.promote, ['b', 'c'])
  assert.deepEqual(r.picks, ['a', 'b', 'c'])
  assert.equal(r.blockers, 7); assert.equal(r.folded, false); assert.equal(r.visible, 5, '앞 5줄만 펼쳐 두고 나머지는 접는다')
  assert.deepEqual(r.states, ['ready', 'blocked', 'unknown'])
  assert.equal(r.adjust, 1)
  assert.deepEqual(r.preview, ['https://wf-preview-a.vercel.app/'])
  assert.equal(r.noPromoteOnA, true)
  assert.match(await ev(`document.querySelector('#card-b .publish').innerText`), /공개 불가[\s\S]*필수 섹션 블록 없음: home\/notice/)
  await ev(`document.querySelector('#card-b details').open = true`)
  assert.equal(await ev(`[...document.querySelectorAll('#card-b [data-blocker]')].filter((x) => x.checkVisibility()).length`), 7, '접힌 것을 열면 전부 보인다')
})

test('db ready late: choices made before it resolves are written once, after the first snapshot, only the changed fields — the old doc body stays; same value not rewritten; pick and promote can be cleared', async () => {
  await open({ manual: true, stored: { [RUN]: OLD } })
  await click('[data-pick="b"]')
  await click('[data-promote="b"]')
  await type('#note', '새 메모')
  assert.equal((await writes()).length, 0, '준비 전에는 쓰지 않는다')
  assert.match(await text('#save-status'), /확인하는 중/)
  assert.doesNotMatch(await text('#save-status'), /저장할 수 없습니다|저장했습니다/)
  assert.equal(await pressed('b'), 'true', '화면은 바로 바뀐다')
  await ev('window.__readyDb()')
  await until(writes, (w) => w.length >= 1)
  await until(() => text('#save-status'), (t) => /저장했습니다/.test(t))
  await sleep(500)
  const w = await writes()
  assert.equal(w.length, 1, JSON.stringify(w))
  assert.equal(w[0].c, 'picks'); assert.equal(w[0].id, RUN); assert.equal(w[0].op, 'update')
  const { decidedAt, ...d } = w[0].d
  assert.deepEqual(d, { pick: 'b', promote: { b: true }, note: '새 메모' })
  assert.ok(decidedAt)
  assert.deepEqual(await ev('window.__gets'), [], '첫 스냅숏이 확정 읽기다(따로 get 하지 않는다)')
  assert.equal(await pressed('a'), 'false', '옛 pick a 는 새 고르기로 바뀌었다')
  assert.equal(await checked('b'), true)
  // 같은 값은 다시 쓰지 않는다
  await type('#note', '새 메모')
  await sleep(1300)
  assert.equal((await writes()).length, 1)
  // 지우기: pick 을 다시 누르면 null, 올리기를 끄면 promote.b null
  await click('[data-pick="b"]')
  await until(writes, (x) => x.length >= 2)
  await click('[data-promote="b"]')
  await until(writes, (x) => x.length >= 3)
  await sleep(300)
  const w2 = await writes()
  assert.equal(w2.length, 3)
  assert.deepEqual(without(w2[1].d, 'decidedAt'), { pick: null }, '바뀐 칸만')
  assert.deepEqual(without(w2[2].d, 'decidedAt'), { promote: { b: null } })
  const s = await stored()
  assert.deepEqual(without(s, 'decidedAt'), { run: RUN, board: 1, note: '새 메모', promote: {} }, '지운 칸은 문서에서 사라진다(pick 없음 · promote 는 빈 객체)')
  assert.equal(await text('#picked'), '아직 고르지 않았습니다')
})

test('a run with no saved doc: the first write re-reads it and creates it with set ({ run, board: 1, … }); later writes are updates', async () => {
  await open({ stored: {} })
  await until(() => text('#db-status'), (t) => /고르면 바로 저장/.test(t))
  await click('[data-pick="c"]')
  await until(writes, (w) => w.length >= 1)
  await click('[data-promote="c"]')
  await until(writes, (w) => w.length >= 2)
  const w = await writes()
  assert.deepEqual(w.map((x) => x.op), ['set', 'update'])
  assert.deepEqual(await ev('window.__gets'), [RUN], '만들기 바로 전에 다시 읽었다')
  assert.deepEqual(without(w[0].d, 'decidedAt'), { run: RUN, board: 1, pick: 'c' })
  assert.deepEqual(without(await stored(), 'decidedAt'), { run: RUN, board: 1, pick: 'c', promote: { c: true } })
})

test('promote checkbox that the doc says but the board does not allow (library card) is ignored on load', async () => {
  await open({ stored: { [RUN]: { run: RUN, board: 1, pick: 'z', promote: { a: true, b: true, q: true } } } })
  await until(() => text('#db-status'), (t) => /고르면 바로 저장/.test(t))
  assert.equal(await checked('b'), true)
  assert.equal(await ev(`!document.querySelector('[data-promote="a"]')`), true)
  assert.equal(await text('#picked'), '아직 고르지 않았습니다', '없는 후보 pick 은 버린다')
})

test('db resolves null: nothing is written and the page never claims a save', async () => {
  await open({ delay: 200, nullDb: true })
  await click('[data-pick="a"]')
  await sleep(600)
  await click('[data-pick="b"]')
  assert.equal((await writes()).length, 0)
  assert.match(await text('#db-status'), /쓸 수 없는/)
  assert.match(await text('#save-status'), /저장되지 않습니다/)
  assert.doesNotMatch(await ev("document.querySelector('.wrap').innerText"), /저장했습니다/)
  assert.equal(await text('#picked'), '고른 안: B안', '화면은 저장과 상관없이 바뀐다')
})

test('write refused with invalid_argument: read-only notice once, no further write attempts', async () => {
  await open({ reject: 'invalid_argument' })
  await until(() => text('#db-status'), (t) => /고르면 바로 저장/.test(t))
  await click('[data-pick="a"]')
  await until(() => text('#db-status'), (t) => /읽기 전용/.test(t))
  assert.equal((await writes()).length, 1)
  await click('[data-pick="b"]')
  await click('[data-promote="c"]')
  await sleep(400)
  assert.equal((await writes()).length, 1, '읽기 전용 뒤에는 쓰지 않는다')
  assert.match(await text('#save-status'), /읽기 전용/)
})

test('the first snapshot arrives 1.5 s after db is ready — a click in between is held and written after the snapshot; the old doc body survives', async () => {
  await open({ stored: { [RUN]: OLD }, snapDelay: 1500 })
  await until(() => text('#db-status'), (t) => /읽는 중/.test(t))
  await click('[data-pick="c"]')
  await sleep(300)
  assert.equal((await writes()).length, 0, '첫 스냅숏 전에는 쓰지 않는다')
  assert.match(await text('#save-status'), /읽는 중/)
  await until(writes, (w) => w.length >= 1, 6000)
  await sleep(300)
  assert.equal((await writes()).length, 1)
  assert.equal((await writes())[0].op, 'update')
  assert.deepEqual(without(await stored(), 'decidedAt', 'pick'), without(OLD, 'decidedAt', 'pick'))
  assert.equal((await stored()).pick, 'c')
})

test('onSnapshot errors (and the re-read fails too) — writes are blocked with a notice until a re-read succeeds, then written; the old doc body survives', async () => {
  await open({ stored: { [RUN]: OLD }, snapFails: true, getFails: true })
  await until(() => text('#db-status'), (t) => /읽지 못했습니다/.test(t))
  await click('[data-pick="c"]')
  await sleep(600)
  assert.equal((await writes()).length, 0, '다시 읽기 전에는 쓰지 않는다')
  assert.match(await text('#save-status'), /다시 읽는 중/)
  await ev('window.__cfg.getFails = false')
  await until(writes, (w) => w.length >= 1, 8000)
  await sleep(300)
  assert.match(await text('#db-status'), /다시 읽었습니다|고르면 바로 저장/)
  assert.ok((await ev('window.__gets')).includes('*'), '컬렉션을 다시 읽었다')
  assert.equal((await stored()).pick, 'c')
  assert.equal((await stored()).note, '옛 메모')
})

test('get fails for a doc that must be read before writing — nothing is written, a retryable error shows, and the write goes through once the read works', async () => {
  // 확정 읽기를 잃은 문서(페이지의 loaded 를 끈다 — 캐시 스냅숏만 받은 것과 같은 상태)는 쓰기 전에 get 으로 읽는다. 그 get 이 실패하는 경우.
  await open({ stored: { [RUN]: OLD }, getFails: true, snapDelay: 10 })
  await until(() => text('#db-status'), (t) => /고르면 바로 저장/.test(t))
  await ev('loaded = false')
  await click('[data-pick="c"]')
  await until(() => text('#save-status'), (t) => /읽지 못해 아직 저장하지 않았습니다/.test(t), 4000)
  await sleep(1500)
  assert.equal((await writes()).length, 0, '읽지 못하면 쓰지 않는다(다시 시도하는 동안에도)')
  assert.ok((await ev('window.__gets')).filter((x) => x === RUN).length >= 2, '다시 시도한다')
  assert.match(await text('#save-status'), /곧 다시 시도합니다/)
  await ev('window.__cfg.getFails = false')
  await until(writes, (w) => w.length >= 1, 10000)
  await sleep(300)
  assert.equal((await stored()).pick, 'c')
})

// 두 탭이 같은 문서의 다른 칸을 거의 동시에 고친다. 저장소는 이 시험 프로세스에 하나 두고, 두 탭의 흉내 db 가 CDP 바인딩으로 부른다(실제 런타임처럼 한 탭의 쓰기가 두 탭 모두에 스냅숏으로 간다).
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
const mergeDoc = (a, b) => { const o = { ...a }; for (const [k, v] of Object.entries(b)) { if (v === null) delete o[k]; else o[k] = v && typeof v === 'object' && !Array.isArray(v) && o[k] && typeof o[k] === 'object' && !Array.isArray(o[k]) ? mergeDoc(o[k], v) : v } return o }

test('two tabs edit different fields of the same doc at almost the same time (pick · promote) — both fields and the old body survive; no set on an existing doc', async () => {
  const store = { [RUN]: structuredClone(OLD) }
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
    await Promise.all([clickIn(tabs[0].ev, '[data-pick="b"]'), (async () => { await clickIn(tabs[1].ev, '[data-promote="c"]'); await typeIn(tabs[1].ev, '#note', '다른 탭 메모') })()])
    const done = () => store[RUN].pick === 'b' && store[RUN].promote?.c === true && store[RUN].note === '다른 탭 메모'
    for (let i = 0; i < 80 && !done(); i++) await sleep(100)
    await sleep(500)
    const s = store[RUN]
    assert.equal(s.pick, 'b', 'A 탭의 칸')
    assert.equal(s.promote.c, true, 'B 탭의 칸')
    assert.equal(s.note, '다른 탭 메모', 'B 탭의 메모')
    assert.equal(s.run, RUN); assert.equal(s.board, 1)
    assert.ok(!ops.some((o) => o.op === 'set'), `있는 문서에 set 을 쓰지 않는다: ${JSON.stringify(ops.filter((o) => o.op === 'set'))}`)
    for (const t of tabs) {
      const seen = await until(() => t.ev(`[document.querySelector('[data-pick="b"]').getAttribute('aria-pressed'), document.querySelector('[data-promote="c"]').checked]`), (x) => x[0] === 'true' && x[1] === true)
      assert.deepEqual(seen, ['true', true], `탭 ${t.name}`)
    }
  } finally {
    for (const t of tabs) { t.ws.close(); await c.send('Target.closeTarget', { targetId: t.targetId }).catch(() => {}) }
  }
})

test('reduced motion: the card video is paused with autoplay off', async () => {
  await open({ noClaude: true }, { reduce: true })
  await sleep(300)
  const r = await ev(`[...document.querySelectorAll('.media video')].map((v) => ({ paused: v.paused, auto: v.autoplay }))`)
  assert.equal(r.length, 1)
  assert.deepEqual(r[0], { paused: true, auto: false })
})

test('1440: three cards side by side, sticky bar shows the pick; 375: no horizontal page scroll and the pick button is at least 44 px tall', async () => {
  await open({ noClaude: true })
  const box = await ev(`(() => { const r = (s) => { const b = document.querySelector(s).getBoundingClientRect(); return { top: b.top, width: b.width } }; return { a: r('#card-a'), b: r('#card-b'), c: r('#card-c') } })()`)
  assert.ok(box.a.top === box.b.top && box.b.top === box.c.top, '한 줄에 셋')
  assert.ok(box.a.width > 380, `카드 폭 ${box.a.width}`)
  await click('[data-pick="b"]')
  assert.equal(await text('#picked'), '고른 안: B안')
  assert.equal(await ev(`document.querySelector('#card-b').dataset.picked`), 'true')
  await open({ noClaude: true }, { width: 375, height: 812, mobile: true })
  const page = await ev(`({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, h: document.querySelector('[data-pick="a"]').getBoundingClientRect().height, promoteH: document.querySelector('.promote').getBoundingClientRect().height })`)
  assert.equal(page.sw, 375); assert.equal(page.cw, 375)
  assert.ok(page.h >= 44 && page.promoteH >= 44, JSON.stringify(page))
})
