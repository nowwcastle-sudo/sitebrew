// lang-mix 관문(UXGATE1 · G9)의 실제 블록 대조 — v0.0.8 시절(기준 커밋 fdf8a09)의 코드와 지금(v0.0.9) 코드를 같은 영어 장면으로 그려 같은 관문에 넣는다.
//  · 양성 대조: 기준 커밋 코드는 locale "en" 을 줘도 날짜를 「2026년 11월 1일」로 그리고 쪽 이동 접근 이름이 「쪽 이동」이다 → 관문이 잡아야 한다(종료 1).
//  · 현재 코드: 같은 장면에서 영어 날짜·영어 접근 이름 → 한글 0(종료 0). 한국어 장면(locale 없음)도 영어 날짜 0.
// 블록 마크업은 SSR(renderToStaticMarkup — blocks-date-locale.test.mjs 와 같은 로더)로 만들어 정적 HTML 쪽으로 쓰고, lang-mix.mjs 를 자식 프로세스로 돌린다.
// 블록 예시 글(fixture)은 한국어라 영어 장면의 문구 전체를 재면 어차피 실패한다 — 날짜는 `--scope time`, 부품 접근 이름은 `--scope nav` 로 locale 이 바꾸는 부분만 잰다.
// 실행: node --test --test-force-exit --test-timeout=600000 factory/qa/lang-mix-blocks.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { runTool } from './fixtures/run-tool.mjs'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { baseOk, BASE, h, load, renderToStaticMarkup } from '../scripts/lib/base-compare.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const pascal = (s) => s.split(/[/-]/).map((w) => w[0].toUpperCase() + w.slice(1)).join('')
// 날짜를 읽는 블록(blocks-date-locale.test.mjs DATE_BLOCKS 와 같은 표)
const DATE_BLOCKS = ['account/billing-manage', 'account/delete-account', 'account/notification-consents', 'account/security', 'retention/cancel-flow', 'retention/payment-failed-banner', 'retention/renewal-consent',
  'paywall/trial-ending', 'paywall/limit-meter', 'paywall/onboarding-offer', 'paywall/upgrade-modal', 'announcement/launch-banner', 'announcement/dismissible-inline', 'consent/preference-dialog',
  'product-info/notice-table', 'qna/answered-list', 'qna/ask-form', 'qna/search-first', 'lead-capture/cart-exit-offer']

const run = (args) => runTool(join(here, 'lang-mix.mjs'), args)
const wrap = (lang, body) => `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><title>block</title></head><body><main>${body}</main></body></html>`

async function renderDateBlock(name, mode, extra) {
  try {
    const mod = await load(`registry/factory/blocks/${name}.tsx`, mode)
    const fx = await load(`registry/factory/blocks/${name}.fixture.ts`, mode)
    return renderToStaticMarkup(h(mod[pascal(name)], { ...fx.fixture, ...extra }))
  } catch { return null }
}

test('실제 블록: 날짜 블록을 영어 장면(locale "en")으로 그리면 기준 커밋 코드는 한글 날짜를 내 관문이 잡고, 지금 코드는 영어 날짜라 통과한다', { skip: !baseOk && `기준 커밋 ${BASE} 없음` }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'lang-mix-blocks-'))
  mkdirSync(join(dir, 'old'), { recursive: true }); mkdirSync(join(dir, 'new'), { recursive: true }); mkdirSync(join(dir, 'ko'), { recursive: true })
  const old = [], cur = [], ko = []
  for (const name of DATE_BLOCKS) {
    const koHtml = await renderDateBlock(name, 'new', {})
    if (!koHtml || !/<time/.test(koHtml)) continue // 날짜를 안 그리는 예시는 잴 것이 없다
    const f = (sub, lang, html) => { const p = join(dir, sub, `${name.replace('/', '__')}.html`); writeFileSync(p, wrap(lang, html)); return pathToFileURL(p).href }
    ko.push(f('ko', 'ko', koHtml))
    const oldEn = await renderDateBlock(name, 'old', { locale: 'en' })
    const newEn = await renderDateBlock(name, 'new', { locale: 'en' })
    if (oldEn && newEn) { old.push(f('old', 'en', oldEn)); cur.push(f('new', 'en', newEn)) }
  }
  assert.ok(cur.length >= 5, `날짜가 그려진 블록 쪽이 ${cur.length}개뿐 — 시험이 날짜 경로를 못 본다`)

  const oldOut = join(dir, 'out-old'), curOut = join(dir, 'out-new'), koOut = join(dir, 'out-ko')
  // 예시 글(fixture)의 한국어 문구(「… 기준」·「… 답변」)가 <time> 안에 같이 그려지는 블록이 있다 — 문구는 locale 이 아니라 copy 가 정하므로(영어 사이트는 04 가 영어 문구를 넣는다) 이 두 낱말만 허용하고 날짜 부분은 그대로 잰다.
  const allowFile = join(dir, 'allow.json'); writeFileSync(allowFile, JSON.stringify({ strings: ['기준', '답변'] }))
  const a = await run([...old, '--locale', 'en', '--scope', 'time', '--out', oldOut, '--allow', allowFile])
  assert.equal(a.code, 1, a.out + a.err)
  const oldJ = JSON.parse(readFileSync(join(oldOut, 'lang-mix.json'), 'utf8'))
  assert.equal(oldJ.summary.fail, old.length, `기준 커밋 코드의 영어 장면 ${old.length}쪽이 모두 걸려야 한다`)
  for (const p of oldJ.pages) assert.ok(p.findings.some((f) => f.rule === 'hangul' && f.src === 'time' && /\d{4}년/.test(f.text)), p.url)

  const b = await run([...cur, '--locale', 'en', '--scope', 'time', '--out', curOut, '--allow', allowFile])
  assert.equal(b.code, 0, b.out + b.err)
  const curJ = JSON.parse(readFileSync(join(curOut, 'lang-mix.json'), 'utf8'))
  assert.equal(curJ.summary.fail, 0)
  assert.ok(curJ.summary.strings >= cur.length, `잰 날짜 ${curJ.summary.strings}개`) // 0 개를 재고 통과한 것이 아니다

  const c = await run([...ko, '--locale', 'ko', '--scope', 'time', '--out', koOut])
  assert.equal(c.code, 0, c.out + c.err) // 한국어 장면(locale 없음)의 날짜는 영어 월 이름이 아니다
  console.log(`# 실제 블록 ${cur.length}쪽: 기준 커밋(en) 실패 ${oldJ.summary.fail}/${old.length} · 지금(en) 실패 ${curJ.summary.fail}/${cur.length} · 지금(ko) 실패 ${JSON.parse(readFileSync(join(koOut, 'lang-mix.json'), 'utf8')).summary.fail}/${ko.length}`)
})

test('실제 부품: 쪽 이동·이동 경로의 접근 이름은 기준 커밋에서 locale "en" 을 줘도 한글(「쪽 이동」), 지금은 영어 — 「닫기」 와 같은 종류', { skip: !baseOk && `기준 커밋 ${BASE} 없음` }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'lang-mix-parts-'))
  const page = async (mode, locale) => {
    const P = await load('registry/factory/ui-src/pagination.tsx', mode)
    const el = h(P.Pagination, { locale }, h(P.PaginationContent, null,
      h(P.PaginationItem, null, h(P.PaginationPrevious, { href: '#', locale })),
      h(P.PaginationItem, null, h(P.PaginationEllipsis, { locale })),
      h(P.PaginationItem, null, h(P.PaginationNext, { href: '#', locale }))))
    const p = join(dir, `${mode}-${locale}.html`)
    writeFileSync(p, wrap(locale, renderToStaticMarkup(el)))
    return pathToFileURL(p).href
  }
  const old = await page('old', 'en')
  const cur = await page('new', 'en')
  const a = await run([old, '--locale', 'en', '--out', join(dir, 'o1')])
  assert.equal(a.code, 1, a.out + a.err)
  const oj = JSON.parse(readFileSync(join(dir, 'o1', 'lang-mix.json'), 'utf8'))
  assert.ok(oj.pages[0].findings.some((f) => f.src === 'aria-label' && f.rule === 'hangul'), JSON.stringify(oj.pages[0].findings))
  const b = await run([cur, '--locale', 'en', '--out', join(dir, 'o2')])
  assert.equal(b.code, 0, b.out + b.err)
  assert.ok(JSON.parse(readFileSync(join(dir, 'o2', 'lang-mix.json'), 'utf8')).pages[0].strings >= 3)
})

// ── FV1 Task 5.14: 영어 사이트의 푸터·오프라인 안내 — 06 의 binder(번역표 + 화면 문구 칸)를 거친 영어 장면에 한글이 없다 ──
// 양성 대조: 같은 블록의 예시(fixture)를 그대로 그린 장면은 한글 이름표라 관문이 잡는다(종료 1). 지금(binder 를 거친 것)은 종료 0.
test('영어 사이트 블록: 푸터 셋·오프라인 안내를 binder 를 거쳐 영어로 그리면 lang-mix 가 통과하고, 예시 그대로는 걸린다', async () => {
  const { bindSection } = await import('../stamp/gen-pages.mjs')
  const { resolveRefs } = await import('../stamp/site-bind.mjs')
  const { uiLeavesOf } = await import('../stamp/ui-copy.mjs')
  const { loadTs } = await import('../stamp/ts-eval.mjs')
  const { root } = await import('../scripts/lib/stamp-site-fixtures.mjs')
  const base = join(tmpdir(), 'fv1-apply-qb')
  mkdirSync(base, { recursive: true })
  const dir = mkdtempSync(join(base, 'lang-mix-en-'))
  const content = { archetype: 'brand', locale: 'en', organization: { name: 'Kiln & Kettle Studio', representative: 'Alex Kim', bizRegNo: '123-45-67890', address: '12 Studio Road, Seoul', phone: '+82-2-555-0100', email: 'hello@kiln.example.org' }, slots: { copy: [{ id: 'x', role: '', text: 'Your saved schedule' }], images: [] } }
  const cases = [['footer', 'columns-business', 'FooterColumnsBusiness'], ['footer', 'compact-strip', 'FooterCompactStrip'], ['footer', 'stacked-legal', 'FooterStackedLegal'], ['state-screen', 'offline-cached', 'StateScreenOfflineCached']]
  const fixed = []
  const raw = []
  for (const [kind, variant, name] of cases) {
    const block = `block-${kind}-${variant}`
    const mod = await loadTs(join(root, 'registry', 'factory', 'blocks', kind, `${variant}.tsx`))
    const fx = await loadTs(join(root, 'registry', 'factory', 'blocks', kind, `${variant}.fixture.ts`))
    const uiLeaves = (await uiLeavesOf(block, { locale: 'en' })).map((l) => ({ path: l.path, ref: 'slots.copy.0.text' }))
    const r = await bindSection({ key: `${kind}/${variant}`, block, content, copyIndex: new Map(), routes: { home: '/' }, locale: 'en', navLinks: () => [{ label: 'Home', href: '/' }], primaryCta: () => ({ href: '/' }), secondaryHref: () => '/', uiLeaves })
    assert.ok(r.props, block)
    const put = (sub, html) => { const p = join(dir, `${sub}-${variant}.html`); writeFileSync(p, wrap('en', html)); return pathToFileURL(p).href }
    fixed.push(put('fixed', renderToStaticMarkup(h(mod[name], resolveRefs(r.props, content)))))
    raw.push(put('raw', renderToStaticMarkup(h(mod[name], fx.fixture))))
  }
  const a = await run([...raw, '--locale', 'en', '--out', join(dir, 'out-raw')])
  assert.equal(a.code, 1, a.out + a.err)
  const b = await run([...fixed, '--locale', 'en', '--out', join(dir, 'out-fixed')])
  assert.equal(b.code, 0, b.out + b.err)
  const bj = JSON.parse(readFileSync(join(dir, 'out-fixed', 'lang-mix.json'), 'utf8'))
  assert.equal(bj.summary.fail, 0)
  assert.ok(bj.summary.strings >= fixed.length * 3, `잰 글 ${bj.summary.strings}개`) // 0 개를 재고 통과한 것이 아니다
})
