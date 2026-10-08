// 실제 브라우저 클립보드 검사(Task 8) — Chrome 1개를 실행마다 띄운다(light). 서버는 프로세스 안 작은 node 서버 하나(빌드 없음).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { COPY_BLOCKS, INAPP_UA, SENTINEL, judge, parseArgs, summarize } from './clipboard-check.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const ROOT = join(here, '..', '..')
const TOOL = join(here, 'clipboard-check.mjs')
const FX = join(here, 'fixtures', 'clipboard')
const tmp = () => mkdtempSync(join(tmpdir(), 'clip-t-'))
const run = (args) => new Promise((res) => {
  const p = spawn(process.execPath, [TOOL, ...args], { stdio: ['ignore', 'pipe', 'pipe'] })
  let out = ''
  p.stdout.on('data', (d) => { out += d }); p.stderr.on('data', (d) => { out += d })
  p.on('exit', (code) => res({ code, out }))
})
const report = (dir) => JSON.parse(readFileSync(join(dir, 'clipboard-check.json'), 'utf8'))
const serve = () => new Promise((res) => {
  const srv = createServer((req, rsp) => {
    const f = join(FX, new URL(req.url, 'http://x').pathname.slice(1))
    if (!existsSync(f) || !f.startsWith(FX)) { rsp.writeHead(404); rsp.end('없는 쪽'); return }
    rsp.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); rsp.end(readFileSync(f))
  })
  srv.listen(0, '127.0.0.1', () => res({ origin: `http://127.0.0.1:${srv.address().port}`, close: () => new Promise((c) => srv.close(c)) }))
})

// ── 렌더 없음 ──
test('judge: pass only when the clipboard equals the expected text; sentinel = no-copy; other text = wrong-text; no expected text = na (not a pass)', () => {
  assert.equal(judge({ expected: 'a b', actual: ' a b\n' }).status, 'pass')
  assert.match(judge({ expected: 'a', actual: SENTINEL }).reason, /^no-copy/)
  assert.match(judge({ expected: 'a', actual: 'b' }).reason, /^wrong-text/)
  assert.equal(judge({ expected: 'a', actual: '' }).status, 'fail') // 빈 클립보드도 통과가 아니다
  assert.equal(judge({ expected: null, actual: 'a' }).status, 'na')
})

test('summarize: na and zero controls are not a pass; every table block must show every kind it promises', () => {
  const ok = { url: 'u', block: null, controls: [{ kind: 'copy-link', status: 'pass' }] }
  assert.equal(summarize([ok]).ok, true)
  assert.equal(summarize([{ ...ok, controls: [{ kind: 'copy-link', status: 'na' }] }]).ok, false)
  assert.equal(summarize([{ ...ok, controls: [] }]).ok, false)
  assert.equal(summarize([{ ...ok, controls: [] }], { allowNone: true }).ok, true)
  const blk = { url: 'u', block: 'referral-invite-panel', controls: [{ kind: 'copy-button', status: 'pass' }] } // 표는 copy-link 라고 했다
  const s = summarize([blk])
  assert.equal(s.ok, false); assert.deepEqual(s.kindsMissing, ['referral-invite-panel:copy-link'])
})

test('bad arguments exit 2', async () => {
  const out = tmp()
  for (const args of [[], ['http://127.0.0.1:1/'], ['--out', out], ['http://x/', '--out', out, '--gallery', 'http://y'], ['file:///a.html', '--out', out],
    ['http://127.0.0.1:1/', '--out', out, '--inapp', 'wechat'], ['--gallery', 'http://127.0.0.1:1', '--out', out, '--blocks', 'no-such-block'], ['http://127.0.0.1:1/', '--out', out, '--bogus']]) {
    assert.equal((await run(args)).code, 2, args.join(' '))
  }
  assert.deepEqual(parseArgs(['--out', out, '--gallery', 'http://g', '--blocks', 'referral-invite-panel']).blocks, ['referral-invite-panel'])
  assert.ok(INAPP_UA.kakao.includes('KAKAOTALK'))
})

// 표는 손으로 적은 것이라 소스와 어긋나면 새 복사 블록이 검사에서 빠진다 — 소스에서 복사를 부르는 블록을 찾아 표와 맞춘다
test('COPY_BLOCKS lists exactly the blocks whose source uses a copy control (LinkCopy·CopyButton·InAppEscape·copyText·kakao port)', () => {
  const dir = join(ROOT, 'registry', 'factory', 'blocks')
  const used = []
  for (const kind of readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory() && !d.name.startsWith('_'))) {
    for (const f of readdirSync(join(dir, kind.name)).filter((n) => n.endsWith('.tsx') && !n.includes('.fixture'))) {
      const src = readFileSync(join(dir, kind.name, f), 'utf8')
      if (/\b(LinkCopy|CopyButton|InAppEscape|copyText)\b/.test(src) || /\bkakao\?: \(/.test(src)) used.push(`${kind.name}-${f.replace(/\.tsx$/, '')}`)
    }
  }
  assert.deepEqual(COPY_BLOCKS.map((b) => b.block).sort(), used.sort())
  for (const b of COPY_BLOCKS) assert.ok(b.kinds.length > 0 && b.kinds.every((k) => ['copy-button', 'copy-link', 'kakao-channel', 'press-copy'].includes(k)), b.block)
  // 표에 적은 기대 글(press-copy)은 fixture 의 초대 주소와 같아야 한다 — 어긋나면 갤러리에서 조용히 다른 글을 기대한다
  const fixtureUrl = readFileSync(join(dir, 'referral', 'invite-panel.fixture.ts'), 'utf8').match(/INVITE_URL = "([^"]+)"/)[1]
  assert.equal(COPY_BLOCKS.find((b) => b.block === 'referral-success-moment-prompt').press.expect, fixtureUrl)
})

// ── Chrome(light) ──
test('real clipboard: good fixture passes all three control kinds; wrong text, "says copied but did not copy", unresolved expectation, no controls each fail (negative controls)', async () => {
  const srv = await serve()
  try {
    const good = tmp()
    const g = await run([`${srv.origin}/good.html`, '--out', good])
    assert.equal(g.code, 0, g.out)
    const gr = report(good)
    assert.equal(gr.summary.pass, 3); assert.equal(gr.summary.fail, 0)
    assert.deepEqual(gr.pages[0].controls.map((c) => c.how), ['readonly-input', 'address', 'data-copy-text'])
    assert.deepEqual(gr.pages[0].controls.map((c) => c.actual), ['https://example.com/r/abc123', '서울시 예시구 예시로 12, 3층 (예시)', 'ABCD-1234-EFGH'])

    const cases = [['wrong-text.html', /wrong-text/, 'fail'], ['no-copy.html', /no-copy/, 'fail'], ['unresolved.html', /기대하는 글을 정할 수 없다/, 'na']]
    for (const [file, why, status] of cases) {
      const out = tmp()
      const r = await run([`${srv.origin}/${file}`, '--out', out])
      assert.equal(r.code, 1, `${file}\n${r.out}`)
      assert.match(r.out, why)
      const c = report(out).pages[0].controls
      assert.equal(c.length, 1); assert.equal(c[0].status, status)
    }
    const none = tmp()
    assert.equal((await run([`${srv.origin}/none.html`, '--out', none])).code, 1)
    assert.match(readFileSync(join(none, 'clipboard-check.json'), 'utf8'), /pagesWithNone/)
    assert.equal((await run([`${srv.origin}/none.html`, '--out', none, '--allow-none'])).code, 0)
  } finally { await srv.close() }
})

test('real clipboard: kakao channel — form text reaches the clipboard and the chat window opens; nocopy · missing field · no window each fail', async () => {
  const srv = await serve()
  try {
    const good = tmp()
    const g = await run([`${srv.origin}/kakao.html`, '--out', good])
    assert.equal(g.code, 0, g.out)
    const c = report(good).pages[0].controls[0]
    assert.equal(c.kind, 'kakao-channel'); assert.equal(c.status, 'pass')
    assert.deepEqual(c.opened, ['https://pf.kakao.com/_WfExample/chat'])
    for (const [mode, why] of [['nocopy', /no-copy/], ['missingfield', /wrong-text.*빠졌다/], ['noopen', /채널 채팅 창이 열리지 않았다/]]) {
      const out = tmp()
      const r = await run([`${srv.origin}/kakao.html?mode=${mode}`, '--out', out])
      assert.equal(r.code, 1, `${mode}\n${r.out}`)
      assert.match(r.out, why)
    }
  } finally { await srv.close() }
})

test('tool failure (unreachable URL): exit 1, "도구 실패", no result file — a stale one is removed', async () => {
  const out = tmp()
  writeFileSync(join(out, 'clipboard-check.json'), '{"stale":true}')
  const r = await run(['http://127.0.0.1:9/', '--out', out])
  assert.equal(r.code, 1, r.out)
  assert.match(r.out, /도구 실패/)
  assert.ok(!existsSync(join(out, 'clipboard-check.json')))
})
