// FINAL-WF6 갤러리 시험(Chrome) — 항목 3(필수 동의 체크박스 접근 이름 · 대장 C425) · 항목 4(lead-capture 이메일 칸 폭 · WF4b). 갤러리 서버(next start)가 있어야 돈다.
// 실행: WF6_ORIGIN=http://localhost:4130 node --test --test-force-exit --test-timeout=900000 factory/qa/final-wf6-gallery.test.mjs   (WF6_ORIGIN 이 없으면 건너뛴다)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { startChrome, connect, navigateAndWait, closeChrome } from './cdp.mjs'
import { blockItems } from '../stamp/gen-pages.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const ORIGIN = process.env.WF6_ORIGIN?.replace(/\/$/, '') ?? null
const skip = !ORIGIN && 'WF6_ORIGIN(갤러리 서버 주소)이 없다'
const axeSrc = skip ? '' : readFileSync(createRequire(join(root, 'package.json')).resolve('axe-core/axe.min.js'), 'utf8')

async function withChrome(fn, { width = 1440, height = 900 } = {}) {
  const chrome = await startChrome(['--hide-scrollbars'], { prefix: 'wf6g-' })
  try {
    const { ws, send, ev } = await connect(chrome.wsUrl)
    await send('Page.enable'); await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
    try { return await fn({ send, ev }) } finally { ws.close() }
  } finally {
    await closeChrome(chrome)
  }
}
const gallery = (b, r = 'r1-measure') => `${ORIGIN}/qa/blocks?b=${b}&r=${r}&frame=1`
async function openGalleryBlock({ send, ev }, url) {
  await navigateAndWait(send, ev, url, { timeoutMs: 120000 })
  for (let i = 0; i < 1200 && !(await ev('!!document.querySelector("[data-qa-ready]")')); i++) await sleep(100)
  await sleep(900)
}

// ── 항목 3: 필수 동의 체크박스(role=checkbox)는 어느 폭에서도 접근 이름이 있다 ──────────────────────────────────────────
// axe aria-toggle-field-name(serious) — 블록 안의 Checkbox 를 쓰는 블록 전부를 1440·375 에서 연다. 체크박스가 실제로 있는 블록만 센다(양성 대조: 한 개도 없으면 실패).
const CHECKBOX_BLOCKS = [...blockItems().values()].filter((b) => /<Checkbox\b/.test(b.source)).map((b) => b.name).sort()
for (const width of [1440, 375]) {
  test(`WF6 ${width}px: Checkbox 를 쓰는 블록 ${CHECKBOX_BLOCKS.length}종 — 체크박스 접근 이름 위반(aria-toggle-field-name) 0 · 체크박스가 실제로 그려졌다`, { skip, timeout: 900000 }, async () => {
    const bad = [], seen = []
    await withChrome(async (s) => {
      for (const b of CHECKBOX_BLOCKS) {
        await openGalleryBlock(s, gallery(b))
        await s.ev(axeSrc)
        const r = await s.ev(`axe.run(document, { runOnly: { type: 'rule', values: ['aria-toggle-field-name'] }, resultTypes: ['violations', 'passes'] }).then((r) => ({ v: r.violations.reduce((n, x) => n + x.nodes.length, 0), p: r.passes.reduce((n, x) => n + x.nodes.length, 0), boxes: document.querySelectorAll('[role=checkbox]').length }))`)
        if (r.boxes > 0) seen.push(b)
        if (r.v > 0) bad.push(`${b} ${r.v}곳`)
      }
    }, { width })
    console.log(`WF6 checkbox ${width}px`, JSON.stringify({ blocks: CHECKBOX_BLOCKS.length, withBoxes: seen.length, bad }))
    assert.deepEqual(bad, [])
    assert.ok(seen.length >= 3, `체크박스가 그려진 블록이 ${seen.length}종뿐이다 — 시험이 아무것도 안 잰다: ${seen}`)
  })
}

// ── 항목 4: lead-capture 이메일 칸 폭 ≥ 240px (1440·768·375), 안내 글·단추 이름이 길어도 ─────────────────────────────────
const LEAD = ['block-lead-capture-inline-newsletter', 'block-lead-capture-magnet-preview']
const LONG_EN = 'I agree to receive the newsletter and product updates by email, and I understand that I can unsubscribe at any time from every message'
for (const width of [1440, 768, 375]) {
  for (const longText of [false, true]) {
    test(`WF6 ${width}px lead-capture 이메일 칸 ≥ 240px${longText ? ' (영어 긴 안내·단추 글로 바꾼 뒤)' : ''}`, { skip, timeout: 600000 }, async () => {
      const got = {}
      await withChrome(async (s) => {
        for (const b of LEAD) {
          await openGalleryBlock(s, gallery(b))
          if (longText) await s.ev(`(() => { for (const el of document.querySelectorAll('form p, form label, form button[type=submit]')) if (!el.querySelector('input,button')) el.textContent = ${JSON.stringify(LONG_EN)} })()`)
          got[b] = await s.ev(`(() => { const i = document.querySelector('form input[type=email]'); return i ? Math.round(i.getBoundingClientRect().width) : -1 })()`)
        }
      }, { width })
      console.log(`WF6 lead ${width}px long=${longText}`, JSON.stringify(got))
      for (const [b, w] of Object.entries(got)) assert.ok(w >= 240, `${b}: 이메일 칸 ${w}px`)
    })
  }
}
