// FINAL-WF6 항목 3(대장 C425) — 체크박스는 하이드레이션 전에도 접근 이름이 있다.
// 원인: Base UI Checkbox 는 `<span role="checkbox">` 라 이름을 `<label for>` 에서 레이아웃 효과로 뒤늦게 얻는다(useAriaLabelledBy 의 fallback — 서버 HTML 에는 없다).
//   찍어낸 사이트는 하이드레이션을 첫 칠·load·4초 중 먼저 오는 때로 미룬다(defer-hydration) — 그 사이에 axe 가 돌면 필수 동의 체크가 이름 없는 `aria-toggle-field-name`(serious)이다.
// 시험: Checkbox 를 쓰는 블록마다 서버 HTML(renderToStaticMarkup — 하이드레이션 없는 상태와 같다)을 실제 Chrome 에서 열어 axe 규칙을 돌린다.
// 실행: node --test --test-force-exit --test-timeout=600000 factory/qa/final-wf6-checkbox-name.test.mjs   (Chrome 필요)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { startChrome, connect, navigateAndWait, closeChrome } from './cdp.mjs'
import { blockItems, fixtureOf } from '../stamp/gen-pages.mjs'
import { loadTs } from '../stamp/ts-eval.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..')
const req = createRequire(join(root, 'package.json'))
const { renderToStaticMarkup } = req('react-dom/server')
const { createElement: h } = req('react')
const axeSrc = readFileSync(req.resolve('axe-core/axe.min.js'), 'utf8')
const TMP = join(process.env.WF6_TMP ?? tmpdir(), 'fv1-final-wf6', 'checkbox-name')
mkdirSync(TMP, { recursive: true })

const BLOCKS = [...blockItems().values()].filter((b) => /<Checkbox\b/.test(b.source)).sort((a, b) => (a.name < b.name ? -1 : 1))

async function ssrPage(b) {
  const mod = await loadTs(join(root, 'registry', 'factory', 'blocks', b.kind, `${b.variant}.tsx`))
  const props = await fixtureOf(b)
  const body = renderToStaticMarkup(h(mod[b.component], props))
  const file = join(TMP, `${b.name}.html`)
  writeFileSync(file, `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${b.name}</title></head><body><main>${body}</main></body></html>`)
  return file
}

test(`WF6 체크박스 접근 이름: Checkbox 를 쓰는 블록 ${BLOCKS.length}종의 서버 HTML(하이드레이션 전)에 aria-toggle-field-name 위반 0 · 체크박스가 실제로 그려졌다`, { timeout: 600000 }, async () => {
  const bad = [], withBoxes = [], renderFail = []
  const chrome = await startChrome(['--hide-scrollbars'], { prefix: 'wf6c-' })
  try {
    const { ws, send, ev } = await connect(chrome.wsUrl)
    await send('Page.enable'); await send('Runtime.enable')
    try {
      for (const b of BLOCKS) {
        let file
        try { file = await ssrPage(b) } catch (e) { renderFail.push(`${b.name}: ${String(e.message).slice(0, 120)}`); continue }
        await navigateAndWait(send, ev, pathToFileURL(file).href, { timeoutMs: 60000 })
        await ev(axeSrc)
        const r = await ev(`axe.run(document, { runOnly: { type: 'rule', values: ['aria-toggle-field-name'] }, resultTypes: ['violations'] }).then((r) => ({ v: r.violations.reduce((n, x) => n + x.nodes.length, 0), boxes: document.querySelectorAll('[role=checkbox]').length }))`)
        if (r.boxes > 0) withBoxes.push(b.name)
        if (r.v > 0) bad.push(`${b.name} ${r.v}곳`)
      }
    } finally { ws.close() }
  } finally {
    await closeChrome(chrome)
  }
  console.log('WF6 checkbox-name', JSON.stringify({ blocks: BLOCKS.length, withBoxes: withBoxes.length, bad, renderFail }))
  assert.deepEqual(bad, [])
  assert.ok(withBoxes.length >= 6, `체크박스가 그려진 블록이 ${withBoxes.length}종뿐이다 — 시험이 아무것도 안 잰다: ${withBoxes}`)
})
