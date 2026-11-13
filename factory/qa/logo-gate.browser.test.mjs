// 머리글 로고 계측과 2배 머리글 캡처(v0.2.6 T9) — 실제 Chrome 으로 ux-gate.mjs 를 고정 쪽에 돌려 gate[키].logo 와 header-<폭>-light-2x.png 를 본다.
// 판정(통과·실패 사유)은 logo-gate.test.mjs 가 보고, 여기서는 「쪽에서 읽은 값이 맞는가」만 본다. Chrome 필요(heavy 목록).
// 실행: node --test --test-force-exit --test-timeout=300000 factory/qa/logo-gate.browser.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { judgeLogo } from './logo-gate.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const fixture = (f) => pathToFileURL(join(here, 'fixtures', 'logo', f)).href
const uxGate = (f) => new Promise((res) => {
  const out = mkdtempSync(join(tmpdir(), 'logo-ux-'))
  spawn(process.execPath, [join(here, 'ux-gate.mjs'), fixture(f), out], { stdio: 'ignore' }).on('exit', () => res(out)) // 종료 코드는 보지 않는다 — 고정 쪽의 본문 대비 등은 이 시험의 관심이 아니다
})
const logoOf = (out) => JSON.parse(readFileSync(join(out, 'ux_gate.json'), 'utf8')).gate['1440-light'].logo
// PNG 헤더의 너비·높이(IHDR) — 외부 의존 없이 2배 캡처 크기를 확인한다
const pngSize = (file) => { const b = readFileSync(file); return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) } }

test('쪽에서 읽은 로고 값: 숨은 다크 짝이 앞에 있어도 보이는 그림을 잰다 · mask 로고 · 글자뿐 · 깨진 그림이 서로 다르게 읽히고 2배 머리글이 찍힌다', async () => {
  const img = await uxGate('img.html')
  assert.deepEqual(logoOf(img), { present: true, kind: 'img', renderedHeight: 36, naturalWidth: 300, complete: true, visible: true }, 'viewBox 만 있는 SVG 도 naturalWidth > 0')
  const { width, height } = pngSize(join(img, 'header-1440-light-2x.png'))
  assert.equal(width, 2880, '1440px 폭의 2배')
  assert.ok(height >= 2 * 60 && height < 2 * 200, `머리글 높이의 2배 안팎 — ${height}`)
  assert.equal(pngSize(join(img, 'header-375-light-2x.png')).width, 750)
  assert.equal(existsSync(join(img, 'header-1440-dark-2x.png')), false, '2배 머리글은 라이트만')

  assert.equal(logoOf(await uxGate('mask.html')).kind, 'mask')
  const text = logoOf(await uxGate('text.html'))
  assert.deepEqual([text.kind, text.naturalWidth], ['text', 0])
  const broken = logoOf(await uxGate('broken.html'))
  assert.deepEqual([broken.kind, broken.complete], ['img', false])
  // 쪽에서 읽은 값을 판정에 그대로 넣으면 그림 로고만 통과한다
  assert.equal(judgeLogo({ k: logoOf(img) }).pass, true)
  assert.equal(judgeLogo({ k: text }).pass, false)
  assert.equal(judgeLogo({ k: broken }).pass, false)
})

test('보이지 않는 로고만 있으면 실패한다 — 숨긴(visibility) 그림 · 투명한(opacity 0) 그림은 높이가 있어도 「화면에 보이는 로고」가 아니다 · 정상 선례(숨은 짝 + 보이는 그림)는 통과', async () => {
  for (const f of ['hidden.html', 'transparent.html']) {
    const p = logoOf(await uxGate(f))
    assert.equal(p.visible, false, `${f}: 보이지 않는 로고를 보인다고 읽었다`)
    const j = judgeLogo({ k: p })
    assert.equal(j.pass, false, `${f}: 보이지 않는 로고가 관문을 통과했다`)
    assert.match(j.problems[0], /보이지 않아요/)
  }
  assert.equal(judgeLogo({ k: logoOf(await uxGate('img.html')) }).pass, true, '정상 선례')
})
