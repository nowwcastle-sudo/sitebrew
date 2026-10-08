// FV1 Task 6.3 원인 고치기(QFIX) [4] — 영어 사이트에 남던 한글 화면 문구(dashboard-2 trend-charts·landing-2 lead-capture).
// 갈래: 사업을 말하지 않는 일반 화면 이름표(로딩·승인 안내·필수 표시·형식 오류 문구)는 번역표(ui-labels-en.mjs)로 닫는다. 사업 문장이면 화면 문구 칸(ui-copy.mjs)으로 보낸다 — 아래 다섯 글은 모두 앞쪽이다.
// 실행: node --test --test-force-exit --test-timeout=200000 factory/scripts/stamp-qfix-labels.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { blockItems, fixtureOf } from '../stamp/gen-pages.mjs'
import { leaves } from '../stamp/site-bind.mjs'
import { localizeEnglishLabels } from '../stamp/ui-labels-en.mjs'

const EN_GENERIC_LABELS = [
  ['block-lead-capture-inline-newsletter', 'copy.humanHint', '직접 확인하고 눌러 주세요'],
  ['block-lead-capture-inline-newsletter', 'copy.email.marker', '(필수)'],
  ['block-lead-capture-inline-newsletter', 'copy.email.invalid', '이메일 형식이 맞지 않아요. @와 도메인을 확인해 주세요.'],
  ['block-lead-capture-inline-newsletter', 'copy.fieldErrorTitle', '입력한 내용을 확인해 주세요'],
]
for (const [block, path, ko] of EN_GENERIC_LABELS) {
  test(`[4] ${block} ${path} 는 일반 화면 이름표라 영어 번역표(ui-labels-en)로 닫힌다`, async () => {
    const b = blockItems().get(block)
    const fx = await fixtureOf(b)
    const before = leaves(fx).find((l) => l.path === path)
    assert.equal(before?.value, ko, `예시 글이 바뀌었다 — 번역표 키를 맞춘다: ${before?.value}`)
    localizeEnglishLabels(fx)
    const after = leaves(fx).find((l) => l.path === path)
    assert.ok(after && !/[가-힣]/.test(after.value), `${path} 에 한글이 남았다: ${after?.value}`)
  })
}

test('[4] 영어 대시보드: 목록 표 자료가 있어 패널이 ready 로 그려져도 빈 상태 안내(copy.empty)에 예시 한글이 남지 않는다 — 생성기 영어 이름표로 채운다', async () => {
  const { bindSection } = await import('../stamp/gen-pages.mjs')
  const content = {
    archetype: 'dashboard', locale: 'en', decision: { dashboard_type: 'operational', refresh: 'Refreshes every 15 minutes' }, kpis: [],
    table: { columns: [{ id: 'col1', label: 'Clinic', numeric: false }, { id: 'col2', label: 'No-shows', numeric: true }], density: 40, rows: [{ col1: 'Downtown', col2: 4 }] },
    slots: { copy: [], images: [] },
  }
  const r = await bindSection({ key: 'operational/trend-charts', block: 'block-dashboard-panel-trend-plus-table', content, copyIndex: new Map(), routes: { home: '/' }, locale: 'en', navLinks: () => [], primaryCta: () => ({ href: '#' }), secondaryHref: () => '#' })
  assert.ok(r.props, r.why)
  assert.equal(r.props.state.status, 'ready')
  const hangul = leaves(r.props).filter((l) => l.ref === null && typeof l.value === 'string' && /[가-힣]/.test(l.value)).map((l) => `${l.path}=${l.value}`)
  assert.deepEqual(hangul, [])
})

test('[4] 영어 사이트의 주제별 FAQ: 예시 제목(「주제별 자주 묻는 질문」)이 한글로 남지 않는다', async () => {
  const { bindSection } = await import('../stamp/gen-pages.mjs')
  const content = { archetype: 'detail', locale: 'en', faq: [{ q: 'Is it safe?', a: 'Yes', topic: 'Care' }, { q: 'Which filter?', a: 'Cone', topic: 'Use' }], slots: { copy: [], images: [] } }
  const r = await bindSection({ key: 'product-detail/qna', block: 'block-faq-grouped-by-topic', content, copyIndex: new Map(), routes: { home: '/' }, locale: 'en', navLinks: () => [], primaryCta: () => ({ href: '#' }), secondaryHref: () => '#' })
  assert.ok(r.props, r.why)
  assert.deepEqual(leaves(r.props).filter((l) => l.ref === null && /[가-힣]/.test(String(l.value))).map((l) => `${l.path}=${l.value}`), [])
})
