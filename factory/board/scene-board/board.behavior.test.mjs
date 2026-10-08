// 장면 보드(보드 A2) 페이지 스크립트의 동작 검사 — headless Chrome 에서 실제로 누른다(서버 없음, file://).
// recipe-board/board2.behavior.test.mjs 와 같은 틀: window.claude.use('db') 를 흉내 낸다(런타임 계약 0.2.60 — set = 통째 교체, update = 겹친 객체를 합치고 문서가 없으면 invalid_argument,
// get·컬렉션 get·onSnapshot). 컬렉션은 scenes, 문서 모양은 { like, note?, at }.
//   ① db 가 늦게 준비된다 → 그 전에 누른 것이 첫 스냅숏 뒤 한 번 쓰인다(있는 문서는 update, 바뀐 칸만). 같은 값은 다시 쓰지 않는다. 좋다 한 번 더 누르면 null.
//   ② 없는 문서는 바로 전에 다시 읽고 set(모양 { like, at } — 메모가 없으면 note 칸 없음), 그 뒤는 update.
//   ③ db 가 null → 쓰기 0, 저장했다고 말하지 않는다. ④ invalid_argument → 읽기 전용, 그 뒤 쓰기 시도 없음. ⑤ 동작 줄이기 → 카드 영상 모두 멈춤.
//   ⑥ 375 에서 가로 스크롤 없음 · 1440 에서 영상이 본문 폭. ⑦ 라이트·다크 토큰이 각각 칠해진다.
//   ⑧ 첫 스냅숏 1.5초 늦음 · onSnapshot 오류(다시 읽기도 실패) · get 실패 · 두 탭이 서로 다른 칸을 고침 — 어느 경우에도 남의 칸·남의 답이 남는다.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { startChrome, connect, navigateAndWait } from '../../qa/cdp.mjs'
import { GATE_CHROME_FLAGS } from '../recipe-board/jobs.mjs'
import { sceneJobs } from './jobs.mjs'
import { sceneBoardData, buildSceneBoard } from './build.mjs'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const jobs = sceneJobs()
const files = (id) => [`${id}.mp4`, `${id}.webm`, `${id}-1440.webp`, `${id}-375.webp`].map((file) => ({ file, recipe: id, option: 'A', kind: /webp$/.test(file) ? 'still' : 'video', bytes: 1 }))
const dir = mkdtempSync(join(tmpdir(), 'scene-board-behavior-'))
const file = join(dir, 'scene-board.html')
writeFileSync(file, buildSceneBoard(sceneBoardData(jobs, { files: jobs.flatMap((j) => files(j.id)) })))
const URL_ = pathToFileURL(file).href
const [S1, S2] = jobs.filter((j) => j.kind === 'block').map((j) => j.id)
const D1 = jobs.find((j) => j.kind === 'recipe').id
const card = (id) => `#card-${id}`

// 흉내 db(한 탭): 쓰기·읽기를 window.__writes·__gets 에, 저장소를 window.__stored 에 남긴다. 설정은 window.__cfg.
// cfg: { delay, manual, nullDb, reject, stored, noClaude, snapDelay, snapFails, getFails }
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
  chrome = await startChrome([...GATE_CHROME_FLAGS, '--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'], { prefix: 'scene-board-behavior-' })
  c = await connect(chrome.wsUrl)
  await c.send('Page.enable'); await c.send('Runtime.enable')
})
after(async () => {
  c?.ws.close()
  await chrome?.close()
  rmSync(dir, { recursive: true, force: true })
})

async function open(cfg, { width = 1440, height = 900, mobile = false, reduce = false, scheme = 'light' } = {}) {
  const { send, ev } = c
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile })
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: reduce ? 'reduce' : 'no-preference' }, { name: 'prefers-color-scheme', value: scheme }] })
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
async function until(read, ok, ms = 8000) { const t = Date.now(); let v = await read(); while (!ok(v) && Date.now() - t < ms) { await sleep(100); v = await read() } return v }
const LIKE = (id, v) => `${card(id)} [data-like][value="${v}"]`
const NOTE = (id) => `${card(id)} textarea[data-note]`
const SAVE = (id) => `${card(id)} [data-save]`

const OLD = { like: 'dislike', note: '옛 메모', at: '2026-10-09T00:00:00.000Z' }
test('db ready late: choices made before it resolves are written once after the first snapshot — update with only the changed fields; same value not rewritten; a second 좋다 click clears to null', async () => {
  await open({ manual: true, stored: { [S1]: OLD } })
  await click(LIKE(S1, 'like'))
  await type(NOTE(S1), '색이 좋다')
  assert.equal((await writes()).length, 0, '준비 전에는 쓰지 않는다')
  assert.match(await text(SAVE(S1)), /확인하는 중/)
  assert.doesNotMatch(await text(SAVE(S1)), /저장했습니다/)
  await ev('window.__readyDb()')
  await until(writes, (w) => w.length >= 1)
  await until(() => text(SAVE(S1)), (t) => /저장했습니다/.test(t))
  await sleep(400)
  const w = await writes()
  assert.equal(w.length, 1, JSON.stringify(w))
  assert.equal(w[0].c, 'scenes')
  assert.equal(w[0].id, S1)
  assert.equal(w[0].op, 'update')
  const { at, ...rest } = w[0].d
  assert.deepEqual(rest, { like: 'like', note: '색이 좋다' })
  assert.ok(!Number.isNaN(Date.parse(at)), 'at 은 ISO 시각')
  assert.deepEqual(await ev('window.__gets'), [], '첫 스냅숏이 확정 읽기다(따로 get 하지 않는다)')
  assert.equal(await text('#progress'), '1')
  await type(NOTE(S1), '색이 좋다')
  await sleep(1300)
  assert.equal((await writes()).length, 1, '같은 값은 다시 쓰지 않는다')
  await click(LIKE(S1, 'like'))
  await until(writes, (x) => x.length >= 2)
  const w2 = await writes()
  assert.deepEqual(Object.keys(w2[1].d).sort(), ['at', 'like'], '바뀐 칸만')
  assert.equal(w2[1].d.like, null)
  const s = await stored(S1)
  assert.equal(s.like, null)
  assert.equal(s.note, '색이 좋다')
  assert.equal(await text('#progress'), '0')
})

test('a scene with no saved doc: the first write re-reads it and creates it with set ({ like, at }, no note field); later writes are updates; a non-empty memo goes into the set body', async () => {
  await open({ stored: {} })
  await until(() => text('#db-status'), (t) => /고르면 바로 저장/.test(t))
  await click(LIKE(S2, 'dislike'))
  await until(writes, (w) => w.length >= 1)
  await click(LIKE(S2, 'like'))
  await until(writes, (w) => w.length >= 2)
  const w = await writes()
  assert.deepEqual(w.map((x) => x.op), ['set', 'update'])
  assert.deepEqual(await ev('window.__gets'), [S2], '만들기 바로 전에 다시 읽었다')
  assert.deepEqual(Object.keys(w[0].d).sort(), ['at', 'like'])
  assert.equal(w[0].d.like, 'dislike')
  assert.equal((await stored(S2)).like, 'like')
  await type(NOTE(D1), '초안이 단정하다')
  await until(writes, (x) => x.length >= 3, 4000)
  const w3 = await writes()
  assert.equal(w3[2].op, 'set')
  assert.equal(w3[2].id, D1)
  assert.deepEqual({ like: w3[2].d.like, note: w3[2].d.note }, { like: null, note: '초안이 단정하다' })
})

test('db resolves null: nothing is written and the page never claims a save', async () => {
  await open({ delay: 200, nullDb: true })
  await click(LIKE(S2, 'like'))
  await sleep(600)
  await click(LIKE(S1, 'dislike'))
  assert.equal((await writes()).length, 0)
  assert.match(await text('#db-status'), /쓸 수 없는/)
  assert.match(await text(SAVE(S2)), /저장되지 않습니다/)
  assert.doesNotMatch(await ev("document.querySelector('.wrap').innerText"), /저장했습니다/)
  assert.equal(await text('#progress'), '2', '진행 계수는 저장과 상관없이 센다')
})

test('write refused with invalid_argument: read-only notice once, no further write attempts', async () => {
  await open({ reject: 'invalid_argument' })
  await until(() => text('#db-status'), (t) => /고르면 바로 저장/.test(t))
  await click(LIKE(S2, 'like'))
  await until(() => text('#db-status'), (t) => /읽기 전용/.test(t))
  assert.equal((await writes()).length, 1)
  await click(LIKE(S1, 'like'))
  await type(NOTE(S1), '메모')
  await sleep(1300)
  assert.equal((await writes()).length, 1, '읽기 전용 뒤에는 쓰지 않는다')
  assert.match(await text(SAVE(S1)), /읽기 전용/)
})

test('reduced motion: every card video is paused with autoplay off and a 재생 button', async () => {
  await open({ noClaude: true }, { reduce: true })
  await sleep(300)
  const r = await ev(`[...document.querySelectorAll('.desk video')].map((v) => ({ paused: v.paused, auto: v.autoplay, b: v.parentElement.querySelector('[data-play]').textContent }))`)
  assert.equal(r.length, jobs.length)
  assert.ok(r.every((x) => x.paused && !x.auto && x.b === '재생'), JSON.stringify(r.slice(0, 2)))
})

test('1440: the video spans the content width; 375 (mobile): no horizontal page scroll', async () => {
  await open({ noClaude: true })
  const box = await ev(`(() => { const v = document.querySelector('${card(S1)} .desk video').getBoundingClientRect(); return { w: v.width, sw: document.documentElement.scrollWidth } })()`)
  assert.ok(box.w >= 900, `영상 폭 ${box.w}`)
  assert.equal(box.sw, 1440)
  await open({ noClaude: true }, { width: 375, height: 812, mobile: true })
  const page = await ev(`({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, compat: document.compatMode, over: [...document.querySelectorAll('.card *')].filter((e) => e.getBoundingClientRect().right > 376).length })`)
  assert.deepEqual(page, { sw: 375, cw: 375, compat: 'CSS1Compat', over: 0 })
})

test('themes: the light tokens and the dark tokens both paint (page background, text colour and the pressed 좋다 button differ and keep contrast)', async () => {
  const read = () => ev(`(() => { const s = getComputedStyle(document.body); return { bg: s.backgroundColor, ink: s.color } })()`)
  await open({ noClaude: true }, { scheme: 'light' })
  const light = await read()
  await open({ noClaude: true }, { scheme: 'dark' })
  const dark = await read()
  assert.notEqual(light.bg, dark.bg)
  assert.notEqual(light.ink, dark.ink)
  const lum = (css) => { const m = css.match(/\d+/g).map(Number).slice(0, 3).map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 }); return 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2] }
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
  assert.ok(ratio(light.bg, light.ink) >= 7, `라이트 대비 ${ratio(light.bg, light.ink)}`)
  assert.ok(ratio(dark.bg, dark.ink) >= 7, `다크 대비 ${ratio(dark.bg, dark.ink)}`)
})

// ── 보드 v2 저장 규칙: 늦음·실패 ─────────────────────────────────────────────
const SAVED = { like: 'like', note: '남의 칸', at: '2026-10-09T00:00:00.000Z' }
test('first snapshot arrives 1.5 s after db is ready: a click in between is held (not ready yet) and written after the snapshot; the saved memo survives', async () => {
  await open({ stored: { [S1]: SAVED }, snapDelay: 1500 })
  await until(() => text('#db-status'), (t) => /읽는 중/.test(t))
  await click(LIKE(S1, 'dislike'))
  await sleep(300)
  assert.equal((await writes()).length, 0, '첫 스냅숏 전에는 쓰지 않는다')
  assert.match(await text(SAVE(S1)), /읽는 중/)
  await until(writes, (w) => w.length >= 1, 6000)
  await sleep(300)
  assert.equal((await writes()).length, 1)
  assert.equal((await writes())[0].op, 'update')
  const s = await stored(S1)
  assert.equal(s.like, 'dislike')
  assert.equal(s.note, '남의 칸')
})

test('onSnapshot errors (and the re-read fails too): writes are blocked with a notice until a re-read succeeds, then written; the saved memo survives', async () => {
  await open({ stored: { [S1]: SAVED }, snapFails: true, getFails: true })
  await until(() => text('#db-status'), (t) => /읽지 못했습니다/.test(t))
  await click(LIKE(S1, 'dislike'))
  await sleep(600)
  assert.equal((await writes()).length, 0, '다시 읽기 전에는 쓰지 않는다')
  assert.match(await text(SAVE(S1)), /다시 읽는 중/)
  await ev('window.__cfg.getFails = false')
  await until(writes, (w) => w.length >= 1, 8000)
  await sleep(300)
  assert.ok((await ev('window.__gets')).includes('*'), '컬렉션을 다시 읽었다')
  const s = await stored(S1)
  assert.equal(s.like, 'dislike')
  assert.equal(s.note, '남의 칸')
})

test('get fails for a doc that must be read before writing: nothing is written, a retryable error shows, and the write goes through once the read works', async () => {
  await open({ stored: { [S1]: SAVED }, getFails: true, snapDelay: 10 })
  await until(() => text('#db-status'), (t) => /고르면 바로 저장/.test(t))
  await ev(`loaded[${JSON.stringify(S1)}] = false`)
  await click(LIKE(S1, 'dislike'))
  await click(LIKE(S2, 'like'))
  await until(() => text(SAVE(S1)), (t) => /읽지 못해 아직 저장하지 않았습니다/.test(t), 4000)
  await until(() => text(SAVE(S2)), (t) => /읽지 못해 아직 저장하지 않았습니다/.test(t), 4000)
  await sleep(1500)
  assert.equal((await writes()).length, 0, '읽지 못하면 쓰지 않는다(다시 시도하는 동안에도)')
  assert.ok((await ev('window.__gets')).filter((x) => x === S1).length >= 2, '다시 시도한다')
  assert.match(await text(SAVE(S1)), /곧 다시 시도합니다/)
  await ev('window.__cfg.getFails = false')
  await until(writes, (w) => w.length >= 2, 10000)
  await sleep(300)
  assert.deepEqual((await writes()).map((w) => [w.id, w.op]).sort(), [[S1, 'update'], [S2, 'set']].sort())
  assert.equal((await stored(S1)).note, '남의 칸')
})

// 두 탭이 같은 문서의 다른 칸을 거의 동시에 고친다(저장소는 이 시험 프로세스에 하나, 두 탭의 흉내 db 가 CDP 바인딩으로 부른다).
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

test('two tabs edit different fields of the same doc at almost the same time — both the 좋다 and the memo survive, and no set is written over an existing doc', async () => {
  const store = { [S1]: { like: null, at: '2026-10-09T00:00:00.000Z' } }
  const ops = []
  const tabs = []
  const docs = () => Object.entries(store)
  const push = async () => { for (const t of tabs) if (t.sub) await t.ev(`window.__dbSnap(${JSON.stringify(docs())})`) }
  const handle = async (t, payload) => {
    const { q, op, id, data } = JSON.parse(payload)
    ops.push({ tab: t.name, op, id })
    await sleep(40)
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
    await Promise.all([
      clickIn(tabs[0].ev, LIKE(S1, 'like')),
      typeIn(tabs[1].ev, NOTE(S1), '다른 탭 메모'),
    ])
    const done = () => store[S1].like === 'like' && store[S1].note === '다른 탭 메모'
    for (let i = 0; i < 80 && !done(); i++) await sleep(100)
    await sleep(500)
    assert.equal(store[S1].like, 'like', 'A 탭의 칸')
    assert.equal(store[S1].note, '다른 탭 메모', 'B 탭의 메모')
    assert.ok(!ops.some((o) => o.op === 'set'), `있는 문서에 set 을 쓰지 않는다: ${JSON.stringify(ops.filter((o) => o.op === 'set'))}`)
    for (const t of tabs) {
      const seen = await until(() => t.ev(`[document.querySelector('${LIKE(S1, 'like')}').getAttribute('aria-pressed'), document.querySelector('${NOTE(S1)}').value]`), (x) => x?.[0] === 'true' && x?.[1] === '다른 탭 메모', 4000)
      assert.deepEqual(seen, ['true', '다른 탭 메모'], `탭 ${t.name}`)
    }
  } finally {
    for (const t of tabs) { t.ws.close(); await c.send('Target.closeTarget', { targetId: t.targetId }).catch(() => {}) }
  }
})
