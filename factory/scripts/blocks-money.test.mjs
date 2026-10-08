// 금액 표시의 콘텐츠 통화(P3-3 detail 레인, 대장 C160) — _shared/price-tag formatPrice 가 최소 단위 정수(USD·EUR 센트)와 로캘을 받는다.
//   · 원화 출력은 글자 그대로여야 한다(P3-2 시각 기준선). 예전 식과 같은 값·기준 커밋(92813f4)의 블록 출력과 문자 단위로 같다.
//   · Intl.NumberFormat 의 통화별 소수 자릿수(ISO 4217, resolvedOptions().maximumFractionDigits — MDN Intl/NumberFormat/NumberFormat).
// 실행: node --test --test-force-exit --test-timeout=120000 factory/scripts/blocks-money.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'
import { stripFinalRound } from './lib/base-compare.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = join(root, '.tmp', 'blocks-money-test')
const BASE = '92813f4' // 이 변경 전 커밋 — KRW 출력 기준
const CHANGED = [
  'registry/factory/blocks/_shared/price-tag.tsx', 'registry/factory/blocks/_shared/product-price.tsx', 'registry/factory/blocks/_shared/billing-format.tsx', 'registry/factory/blocks/_shared/review-kit.tsx',
  'registry/factory/blocks/product-list/spec-summary.tsx', 'registry/factory/blocks/bottom-tab/sticky-action-bar.tsx', 'registry/factory/blocks/review-list/summary-near-price.tsx',
]
let baseOk = true
try { execFileSync('git', ['cat-file', '-e', `${BASE}:${CHANGED[0]}`], { cwd: root, stdio: 'ignore' }) } catch { baseOk = false }

const loaded = new Map()
// mode 'new' = 작업 트리, 'old' = 기준 커밋의 바뀐 파일 + 나머지는 작업 트리(모드마다 따로 변환해 서로 섞이지 않는다)
function transpile(abs, mode) {
  const key = `${mode}:${abs}`
  if (loaded.has(key)) return loaded.get(key)
  const rel = relative(root, abs).split('\\').join('/')
  const out = join(OUT, mode, rel.replace(/\.tsx?$/, '.mjs'))
  loaded.set(key, out)
  const text = mode === 'old' && CHANGED.includes(rel) ? execFileSync('git', ['show', `${BASE}:${rel}`], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 24 }) : readFileSync(abs, 'utf8')
  let { outputText } = ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } })
  outputText = outputText.replace(/(from\s+|import\s*\(\s*|import\s+)(["'])(@\/|\.\.?\/)([^"']+)\2/g, (_, kw, q, pre, p) => {
    const base = pre === '@/' ? join(root, p) : join(dirname(abs), pre, p)
    const src = [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts')].find((f) => existsSync(f) && /\.(mjs|tsx?)$/.test(f))
    if (!src) throw new Error(`import 대상 없음: ${pre}${p}`)
    return `${kw}${q}${pathToFileURL(src.endsWith('.mjs') ? src : transpile(src, mode)).href}${q}`
  })
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, outputText)
  return out
}
const load = (rel, mode = 'new') => import(pathToFileURL(transpile(join(root, rel), mode)).href)
const React = await import('react')
const { renderToStaticMarkup } = await import('react-dom/server')
const h = React.createElement
const PT = 'registry/factory/blocks/_shared/price-tag.tsx'

test('formatPrice: 원화는 예전 식과 글자까지 같다(기본 통화 KRW·옵션 없음·ko 로캘)', async () => {
  const { formatPrice } = await load(PT)
  const legacy = (n) => `${Math.round(n).toLocaleString('ko-KR')}원`
  for (const n of [0, 9900, 12900, 32900, 89000, 1239000, 12345.6]) {
    assert.equal(formatPrice(n), legacy(n), String(n))
    assert.equal(formatPrice(n, 'KRW'), legacy(n))
    assert.equal(formatPrice(n, 'KRW', { minor: true }), legacy(n), '원은 최소 단위가 곧 원이다')
    assert.equal(formatPrice(n, 'KRW', { minor: true, locale: 'ko-KR' }), legacy(n))
  }
  assert.equal(formatPrice(12900), '12,900원')
})

test('formatPrice: 기존 호출(옵션 없음)의 다른 통화는 예전처럼 화면 단위 금액 + ko-KR', async () => {
  const { formatPrice } = await load(PT)
  assert.equal(formatPrice(48, 'USD'), new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'USD' }).format(48))
  assert.equal(formatPrice(48, 'USD'), 'US$48.00')
})

test('formatPrice: USD·EUR 는 센트(최소 단위)를 받아 로캘대로 그린다 — en-US USD 4800 → $48.00', async () => {
  const { formatPrice, toMajor } = await load(PT)
  assert.equal(formatPrice(4800, 'USD', { minor: true, locale: 'en-US' }), '$48.00')
  assert.equal(formatPrice(4850, 'USD', { minor: true, locale: 'en-US' }), '$48.50')
  assert.equal(formatPrice(5, 'USD', { minor: true, locale: 'en-US' }), '$0.05')
  assert.equal(formatPrice(123456, 'USD', { minor: true, locale: 'en-US' }), '$1,234.56')
  assert.equal(formatPrice(4800, 'EUR', { minor: true, locale: 'en-US' }), '€48.00')
  assert.equal(formatPrice(4800, 'EUR', { minor: true, locale: 'de-DE' }).replace(/\u00a0/g, ' '), '48,00 €')
  assert.equal(formatPrice(4800, 'USD', { minor: true }), 'US$48.00', '로캘이 없으면 ko-KR')
  // 소수 자릿수가 없는 통화는 최소 단위가 곧 화면 단위
  assert.equal(formatPrice(4800, 'JPY', { minor: true, locale: 'en-US' }), '¥4,800')
  assert.equal(formatPrice(29000, 'KRW', { minor: true, locale: 'en-US' }), '₩29,000')
  assert.equal(toMajor(4800, 'USD'), 48)
  assert.equal(toMajor(4850, 'EUR'), 48.5)
  assert.equal(toMajor(29000, 'KRW'), 29000)
  assert.equal(toMajor(29000), 29000, '기본 통화 KRW')
})

const fixtureOf = async (rel, mode) => (await load(rel, mode)).fixture
const BLOCKS = {
  stickyBar: { file: 'registry/factory/blocks/bottom-tab/sticky-action-bar.tsx', fx: 'registry/factory/blocks/bottom-tab/sticky-action-bar.fixture.ts', name: 'BottomTabStickyActionBar' },
  specSummary: { file: 'registry/factory/blocks/product-list/spec-summary.tsx', fx: 'registry/factory/blocks/product-list/spec-summary.fixture.ts', name: 'ProductListSpecSummary' },
  nearPrice: { file: 'registry/factory/blocks/review-list/summary-near-price.tsx', fx: 'registry/factory/blocks/review-list/summary-near-price.fixture.ts', name: 'ReviewListSummaryNearPrice' },
}

// 바뀐 조각(price-tag·product-price·billing-format·review-kit)을 쓰는 다른 블록도 함께 본다 — 기본 호출(옵션 없음)이 그대로여야 한다
const SAME = {
  ...BLOCKS,
  gridCards: { file: 'registry/factory/blocks/product-list/grid-cards.tsx', fx: 'registry/factory/blocks/product-list/grid-cards.fixture.ts', name: 'ProductListGridCards' },
  rankedList: { file: 'registry/factory/blocks/product-list/ranked-list.tsx', fx: 'registry/factory/blocks/product-list/ranked-list.fixture.ts', name: 'ProductListRankedList' },
  photoGallery: { file: 'registry/factory/blocks/review-list/photo-gallery.tsx', fx: 'registry/factory/blocks/review-list/photo-gallery.fixture.ts', name: 'ReviewListPhotoGallery' },
  distributionFilter: { file: 'registry/factory/blocks/review-list/distribution-filter.tsx', fx: 'registry/factory/blocks/review-list/distribution-filter.fixture.ts', name: 'ReviewListDistributionFilter' },
  threeTier: { file: 'registry/factory/blocks/pricing/three-tier-cards.tsx', fx: 'registry/factory/blocks/pricing/three-tier-cards.fixture.ts', name: 'PricingThreeTierCards' },
}
test('원화 블록 출력은 기준 커밋(92813f4)과 글자까지 같다 — 예시 3벌(기본·최대·최소) × 블록 여덟', { skip: baseOk ? false : '기준 커밋을 읽을 수 없다(얕은 복제)' }, async () => {
  for (const [label, b] of Object.entries(SAME)) {
    const [newMod, oldMod, newFx, oldFx] = [await load(b.file, 'new'), await load(b.file, 'old'), await load(b.fx, 'new'), await load(b.fx, 'old')]
    for (const k of ['fixture', 'fixtureMax', 'fixtureMin']) {
      const a = renderToStaticMarkup(h(newMod[b.name], newFx[k]))
      const o = renderToStaticMarkup(h(oldMod[b.name], oldFx[k]))
      assert.ok(a.length > 200, `${label} ${k}: 그려졌다`)
      // 최종 라운드가 일부러 바꾼 모양(포커스 링 간격·이동 링크 role·빈 사진 표지·하단 빈 칸)은 걸러 내고 원화 글자를 비교한다
      assert.equal(stripFinalRound(a), stripFinalRound(o), `${label} ${k}: 원화 출력이 바뀌었다`)
    }
  }
})

test('구매 바: money 를 주면 통화 기호가 붙은 금액(단위 글자 없음), 안 주면 원화 + 단위', async () => {
  const b = BLOCKS.stickyBar
  const mod = await load(b.file)
  const fx = await fixtureOf(b.fx)
  const krw = renderToStaticMarkup(h(mod[b.name], fx))
  assert.match(krw, /32,900<\/span><span class="cn-block-bottom-unit">원<\/span>/)
  const usd = renderToStaticMarkup(h(mod[b.name], { copy: { ...fx.copy, price: 4800, originalPrice: 6000, unit: undefined, money: { currency: 'USD', locale: 'en-US' } } }))
  assert.match(usd, /\$48\.00/)
  assert.match(usd, /\$60\.00/)
  assert.equal(usd.includes('cn-block-bottom-unit'), false)
  assert.equal(usd.includes('원'), false)
})

test('상품 요약: copy.money 가 가격·정가·단위 가격을 그 통화로 그린다', async () => {
  const b = BLOCKS.specSummary
  const mod = await load(b.file)
  const fx = await fixtureOf(b.fx)
  const product = { ...fx.state.data[0], price: 4800, listPrice: 6000, unitPrice: { amount: 480, per: '100g' }, origin: undefined }
  const html = renderToStaticMarkup(h(mod[b.name], { copy: { ...fx.copy, money: { currency: 'USD', locale: 'en-US' } }, state: { status: 'ready', data: [product] } }))
  assert.match(html, />\$48\.00</)
  assert.match(html, />\$60\.00</)
  assert.match(html, /100g · \$4\.80/)
  assert.equal(/[0-9]원</.test(html), false, '금액 뒤에 원화 글자가 없다')
  // 통화 칸이 없으면 원화 그대로
  const krw = renderToStaticMarkup(h(mod[b.name], { copy: fx.copy, state: { status: 'ready', data: [{ ...product, price: 4800, listPrice: 6000 }] } }))
  assert.match(krw, />4,800원</)
})

test('가격 곁 리뷰: 금액은 최소 단위 정수 + 통화·로캘, JSON-LD Offer.price 는 화면 단위 숫자', async () => {
  const b = BLOCKS.nearPrice
  const mod = await load(b.file)
  const fx = await fixtureOf(b.fx)
  const usd = renderToStaticMarkup(h(mod[b.name], { ...fx, copy: { ...fx.copy, kit: { ...fx.copy.kit, locale: 'en-US' } }, product: { name: 'Dripper', price: 4800, currency: 'USD' } }))
  assert.match(usd, /data-price="billed"[^>]*>\$48\.00</)
  assert.match(usd, /"price":48,"priceCurrency":"USD"/)
  assert.match(usd, /September 2\d, 2026/, '날짜도 그 로캘로')
  const krw = renderToStaticMarkup(h(mod[b.name], fx))
  assert.match(krw, /data-price="billed"[^>]*>89,000원</)
  assert.match(krw, /"price":89000,"priceCurrency":"KRW"/)
})
