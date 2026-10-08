// QFIX3-LAYOUT — 측정 고침 시험(Task 6.3 4차). 판정 기준(문턱)은 그대로이고, 측정이 거짓으로 떨어뜨리던 길 넷을 고친다.
//   ① ux-gate: 20자 넘는 본문 글 상자가 없는 쪽(표 칸·이름표뿐인 관리 목록)은 「본문 측정 없음」으로 떨어졌다 → 그 쪽은 짧은 글(표 칸·문단·목록 항목)로 대비를 잰다(7:1 문턱은 그대로).
//   ② strict whatItDoes: 글자 쪼개기 제목(읽기용 sr-only 한 벌 + 눈에 보이는 aria-hidden 한 벌)은 textContent 가 두 배라 40자 문턱을 넘었다 → 접근 이름(aria-hidden 뺀 글)으로 읽는다.
//   ③ strict works: 작업 카드는 「그림 칸 + 제목」이 든 칸이다 — 사례 쪽이 있는 작업만 링크가 걸리므로 링크가 없는 카드도 센다(그림 칸이 없는 목록은 세지 않는다).
//   ④ strict cta: 「등록」·「기록」(register·record)도 주 행동 동사다(landing 사전 등록·pwa 기록 앱).
// Chrome 을 띄우므로 공용 무거운 단계 잠금 안에서만 돌린다.
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { spawn } from 'node:child_process'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { measureStrict } from '../qa/strict-archetype.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const qa = join(here, '..', 'qa')
const fixtures = join(qa, 'fixtures')
const srv = http.createServer((req, res) => {
  let body = null
  try { body = readFileSync(join(fixtures, 'strict', req.url.replace(/^\/+/, ''))) } catch { /* 없는 파일(favicon 등) */ }
  if (body) res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(body)
  else res.writeHead(404).end('not found')
})
await new Promise((r) => srv.listen(0, '127.0.0.1', r))
const origin = `http://127.0.0.1:${srv.address().port}`
after(() => srv.close())

const routes = ['/qfix3-what-split-h1.html', '/qfix3-slogan-split-h1.html', '/qfix3-works-nolink.html', '/qfix3-works-textonly.html', '/qfix3-cta-register.html', '/qfix3-cta-about.html', '/qfix3-cta-footer.html', '/qfix3-cta-bizreg.html']
const measured = await measureStrict(origin, routes)
const at = (route) => measured.find((m) => m.route === route).profiles

const runUx = (fixture) => new Promise((res) => {
  const out = mkdtempSync(join(tmpdir(), 'qfix3-ux-'))
  const p = spawn(process.execPath, [join(qa, 'ux-gate.mjs'), pathToFileURL(join(fixtures, fixture)).href, out], { stdio: 'ignore' })
  p.on('exit', (code) => res({ code, gate: (() => { try { return JSON.parse(readFileSync(join(out, 'ux_gate.json'), 'utf8')) } catch { return null } })() }))
})

test('② 글자 쪼개기 H1 은 접근 이름으로 읽어 「무엇을 하는지」 문장이 된다(양성) · 구호는 여전히 아니다(음성)', () => {
  for (const prof of ['desktop', 'mobile']) {
    const ok = at('/qfix3-what-split-h1.html')[prof].whatItDoes
    assert.ok(ok !== null && ok < 1, `${prof} 쪼갠 H1 whatItDoes = ${ok}`)
    assert.equal(at('/qfix3-slogan-split-h1.html')[prof].whatItDoes, null, `${prof} 구호가 통과했다`)
  }
})

test('③ 작업 카드: 그림 칸 + 제목이 든 칸 셋은 링크가 하나뿐이어도 센다(양성) · 그림 칸 없는 제목 목록은 세지 않는다(음성)', () => {
  for (const prof of ['desktop', 'mobile']) {
    const ok = at('/qfix3-works-nolink.html')[prof].works
    assert.ok(ok !== null && ok < 2, `${prof} works = ${ok}`)
    assert.equal(at('/qfix3-works-textonly.html')[prof].works, null, `${prof} 그림 칸 없는 목록이 작업 카드로 읽혔다`)
  }
})

test('④ 주 행동 동사에 「등록」·「기록」이 든다(양성) · 「소개 보기」만 있는 쪽은 여전히 주 행동이 없다(음성)', () => {
  for (const prof of ['desktop', 'mobile']) {
    const ok = at('/qfix3-cta-register.html')[prof].cta
    assert.ok(ok !== null && ok < 1, `${prof} cta = ${ok}`)
    assert.equal(at('/qfix3-cta-about.html')[prof].cta, null, `${prof} 소개 보기가 주 행동으로 읽혔다`)
  }
})

// FINAL-WF B10(S1-7): 등록·기록·record 는 단어 경계, 푸터·내비 안 링크는 주 행동 후보가 아니다.
test('④b 푸터의 「사전 등록 안내」·「사업자등록 확인」, 본문의 「사업자등록 확인」·「Records」는 주 행동이 아니다(음성) · 본문의 「기록하기」는 그대로 주 행동(양성, ④)', () => {
  for (const prof of ['desktop', 'mobile']) {
    assert.equal(at('/qfix3-cta-footer.html')[prof].cta, null, `${prof} 푸터 링크가 주 행동으로 읽혔다`)
    assert.equal(at('/qfix3-cta-bizreg.html')[prof].cta, null, `${prof} 사업자등록 확인·Records 가 주 행동으로 읽혔다`)
    assert.ok(at('/qfix3-cta-register.html')[prof].cta !== null, `${prof} 양성 대조: 오늘 달린 거리 기록하기`)
  }
})

test('① ux-gate: 짧은 표 칸뿐인 쪽도 대비를 잰다(통과) · 흐린 짧은 글은 7:1 로 떨어진다 · 잴 글이 하나도 없는 쪽은 여전히 측정 없음 실패', async () => {
  const good = await runUx('ux-short-cells.html')
  assert.equal(good.code, 0, JSON.stringify(good.gate?.fail))
  for (const row of Object.values(good.gate.gate)) assert.ok(row.bodyChecked >= 1, `bodyChecked ${row.bodyChecked}`)
  const low = await runUx('ux-short-cells-low.html')
  assert.equal(low.code, 3)
  assert.ok(low.gate.fail.some((f) => f.includes('body blocks < 7:1')), low.gate.fail.join(' | '))
  const none = await runUx('no-body.html')
  assert.equal(none.code, 3)
  assert.ok(none.gate.fail.some((f) => f.includes('bodyChecked 0')), none.gate.fail.join(' | '))
})

// ⑤ marketing-site 전환 검사: role=checkbox 로 그린 필수 동의(Base UI)도 사람처럼 체크하고 제출한다 — 못 체크하면 접수가 막혀 conv-reaches-receiver 가 거짓으로 떨어진다.
//    (PERF 병합 뒤 landing 의 사전 등록 폼이 처음으로 하이드레이션 안에 보여 이 길이 드러났다.)
// FINAL-WF B9: 숨은 required 체크 입력이 role=checkbox 와 짝이면 둘을 다 누르지 않는다(두 번 토글돼 체크가 풀린다).
for (const [name, fixture] of [['⑤ role=checkbox 필수 동의가 든 폼', 'qfix3-consent-form.html'], ['⑤b 숨은 required 체크 입력과 짝인 role=checkbox 필수 동의 폼(둘 다 누르면 풀린다)', 'qfix3-consent-form-paired.html']]) test(name + ': 체크하고 제출해 수신 경로에 닿는다 · 접수 확인 글도 본다', async () => {
  const { marketingSite } = await import('../qa/marketing-site.mjs')
  const page = readFileSync(join(fixtures, 'strict', fixture))
  const s2 = http.createServer((req, res) => {
    if (req.method === 'POST') { req.resume(); req.on('end', () => res.writeHead(200, { 'content-type': 'application/json' }).end('{"ok":true}')); return }
    res.writeHead(req.url === '/' ? 200 : 404, { 'content-type': 'text/html; charset=utf-8' }).end(req.url === '/' ? page : 'not found')
  })
  await new Promise((r) => s2.listen(0, '127.0.0.1', r))
  try {
    const out = await marketingSite(`http://127.0.0.1:${s2.address().port}`, { pages: [{ route: '/', id: 'home' }] }, { pageGate: false })
    const rule = (id) => out.rules.find((r) => r.id === id)
    assert.equal(rule('conv-reaches-receiver').status, 'pass', JSON.stringify(rule('conv-reaches-receiver')))
    assert.equal(rule('conv-confirmation').status, 'pass', JSON.stringify(rule('conv-confirmation')))
  } finally { s2.close() }
})
