// 날짜 locale·timeZone(P3-5 I18N, 대장 D234) — _shared/billing-format 의 formatFrom·formatUntil·DateText 와 날짜를 읽는 블록 19개.
// 인자가 없으면 예전 출력과 글자까지 같고(기준 커밋 대조), locale "en"·timeZone 을 주면 영어 날짜·그 시간대의 날짜다. 찍어내기 06 은 영어 사이트 블록에 locale "en" 을 싣는다.
// 실행: node --test --test-force-exit --test-timeout=240000 factory/scripts/blocks-date-locale.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { BASE, baseOk, h, load, renderToStaticMarkup, stripFinalRound } from './lib/base-compare.mjs'
import { bindSection } from '../stamp/gen-pages.mjs'

const BF = 'registry/factory/blocks/_shared/billing-format.tsx'

const SAMPLE = ['2026-10-31T15:00:00.000Z', '2026-10-31T14:59:59.999Z', '2026-01-01T00:00:00Z', '2026-12-31T23:59:59Z', '2027-02-28T15:00:00Z', '2026-03-31T15:00:01Z', '2026-06-15T03:00:00+09:00']
const LEGACY = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric' })

test('D234: formatFrom·formatUntil — 인자가 없으면 예전 식(ko-KR·Asia/Seoul)과 글자까지 같다, "ko"·"ko-KR" 도 같다', async () => {
  const { formatFrom, formatUntil } = await load(BF)
  for (const iso of SAMPLE) {
    const from = LEGACY.format(new Date(iso))
    const until = LEGACY.format(new Date(new Date(iso).getTime() - 1))
    for (const loc of [undefined, 'ko', 'ko-KR']) {
      assert.equal(formatFrom(iso, loc), from, `${iso} from ${loc}`)
      assert.equal(formatUntil(iso, loc), until, `${iso} until ${loc}`)
    }
  }
  assert.equal(formatFrom('2026-10-30T15:00:00Z'), '2026년 10월 31일') // launch-factory F6 의 예
  assert.equal(formatUntil('2026-10-31T15:00:00Z'), '2026년 10월 31일')
})

test('D234: locale 을 주면 그 말로 적고("en" → en-US, Intl 태그 그대로), timeZone 을 주면 그 시간대의 날짜다', async () => {
  const { formatFrom, formatUntil } = await load(BF)
  assert.equal(formatFrom('2026-10-30T15:00:00Z', 'en'), 'October 31, 2026')
  assert.equal(formatFrom('2026-10-30T15:00:00Z', 'en-US'), 'October 31, 2026') // review-kit 이 주던 값 — 그대로
  assert.equal(formatFrom('2026-10-30T15:00:00Z', 'en-GB'), '31 October 2026')
  assert.equal(formatUntil('2026-10-31T15:00:00Z', 'en'), 'October 31, 2026')
  // 같은 순간이 시간대마다 다른 날짜: 10-31T15:00Z = 서울 11-01 0시 = 뉴욕 10-31 11시 = 로스앤젤레스 10-31 8시
  assert.equal(formatFrom('2026-10-31T15:00:00Z'), '2026년 11월 1일')
  assert.equal(formatFrom('2026-10-31T15:00:00Z', 'en', 'America/New_York'), 'October 31, 2026')
  assert.equal(formatFrom('2026-10-31T03:30:00Z', 'en', 'Asia/Seoul'), 'October 31, 2026')
  assert.equal(formatFrom('2026-10-31T03:30:00Z', 'ko', 'America/Los_Angeles'), '2026년 10월 30일')
  // 끝 순간 직전 규칙은 시간대와 함께 간다: 11-01T00:00 뉴욕(= 11-01T04:00Z)은 10월 31일까지
  assert.equal(formatUntil('2026-11-01T04:00:00Z', 'en', 'America/New_York'), 'October 31, 2026')
})

test('D234: DateText — 기본 출력은 예전 글자(time 요소·dateTime·data-numeric 그대로), locale·timeZone 은 글자만 바꾼다', async () => {
  const old = await load(BF, 'old')
  const cur = await load(BF)
  for (const iso of SAMPLE) for (const as of [undefined, 'until', 'since']) {
    const props = { iso, ...(as ? { as } : {}) }
    assert.equal(renderToStaticMarkup(h(cur.DateText, props)), renderToStaticMarkup(h(old.DateText, props)), `${iso} ${as}`)
  }
  const en = renderToStaticMarkup(h(cur.DateText, { iso: '2026-10-30T15:00:00Z', as: 'since', locale: 'en' }))
  assert.match(en, /<time[^>]*data-numeric[^>]*datetime="2026-10-30T15:00:00Z"[^>]*>October 31, 2026<\/time>/i)
  assert.doesNotMatch(en, /[가-힣]/)
})

// 날짜를 읽는 블록 — 한국어(locale 없음) 렌더가 기준 커밋과 같고, en 이면 한글 날짜가 없다
const DATE_BLOCKS = ['account/billing-manage', 'account/delete-account', 'account/notification-consents', 'account/security', 'retention/cancel-flow', 'retention/payment-failed-banner', 'retention/renewal-consent',
  'paywall/trial-ending', 'paywall/limit-meter', 'paywall/onboarding-offer', 'paywall/upgrade-modal', 'announcement/launch-banner', 'announcement/dismissible-inline', 'consent/preference-dialog',
  'product-info/notice-table', 'qna/answered-list', 'qna/ask-form', 'qna/search-first', 'lead-capture/cart-exit-offer']
const pascal = (s) => s.split(/[/-]/).map((w) => w[0].toUpperCase() + w.slice(1)).join('')
async function renderBlock(name, mode, extra = {}) {
  try {
    const mod = await load(`registry/factory/blocks/${name}.tsx`, mode)
    const fx = await load(`registry/factory/blocks/${name}.fixture.ts`, mode)
    const Comp = mod[pascal(name)]
    const out = {}
    for (const k of ['fixture', 'fixtureMax', 'fixtureMin']) out[k] = renderToStaticMarkup(h(Comp, { ...fx[k], ...extra }))
    return out
  } catch (e) {
    return { error: String(e?.message ?? e).split('\n')[0] }
  }
}
// MOBFIX(좁은 화면 표·줄바꿈): 날짜와 무관하게 마크업에 더해진 것만 양쪽에서 똑같이 지우고 견준다 — 표 의미 role·쌓기 표지(data-label·data-stack)·쌓기/단추 줄바꿈 훅·영수증 글 감싸기.
// 글자·날짜·요소 순서는 그대로 견준다(기준 커밋과 한국어 출력이 같아야 한다는 약속은 그대로다).
// REL10B: 필수 체크 칸 크기 훅(cn-block-offer-check)·이메일·전화 줄바꿈 자리(<wbr>)도 같은 식으로 지운다
const MOBFIX_HOOKS = /cn-block-(?:btn-wrap|stack-table|stack-kv|offer-check)/g
const stripMobfix = (html) => typeof html !== 'string' ? html : html
  .replace(/ focus-visible:ring-offset-2 focus-visible:ring-offset-background/g, '') // FINAL-WF3 항목 10: 버튼 포커스 링 바깥 간격
  .replace(/(<a\b[^>]*?) role="button"( tabindex="0")?/g, '$1').replace(/(<a\b[^>]*?) tabindex="0"(?= data-slot="button")/g, '$1').replace(/(<a\b[^>]*?) data-slot="button"/g, '$1').replace(/<span role="img"[^>]*data-photo-needed[^>]*><svg[^>]*>.*?<\/svg><span aria-hidden="true">[^<]*<\/span><\/span>/g, "").replace(/<svg[^>]*lucide-image[^>]*>.*?<\/svg>/g, "") // FINAL-WF3 항목 11: 이동하는 링크의 role="button" 제거
  .replace(/ role="(?:table|rowgroup|row|columnheader|rowheader|cell)"/g, '')
  .replace(/ data-(?:label|stack)="[^"]*"/g, '')
  .replace(MOBFIX_HOOKS, '')
  .replace(/<wbr\/?>/g, '')
  .replace(/ method="post"/g, '') // REL12 5a: 폼 method=post(하이드레이션 전 제출이 비밀번호를 주소에 싣지 않게) — 날짜와 무관한 속성
  .replace(/(<p data-receipt="" class="cn-block-uc-receipt">[\s\S]*?)<span class="cn-block-uc-receipt-text">([\s\S]*?)<\/span><\/p>/g, '$1$2</p>')
  .replace(/class="([^"]*)"/g, (_, c) => `class="${c.trim().replace(/\s+/g, ' ')}"`)
const norm = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, stripMobfix(stripFinalRound(v))]))
const DATE_KO = /\d{4}년 \d{1,2}월 \d{1,2}일/

test('D234: 날짜를 읽는 블록 19개 — 한국어(locale 없음) 렌더가 기준 커밋과 글자까지 같다, 날짜가 나오는 블록이 5개 이상이다(양성 대조)', { skip: !baseOk && `기준 커밋 ${BASE} 없음` }, async () => {
  let withDate = 0
  for (const name of DATE_BLOCKS) {
    const a = await renderBlock(name, 'old')
    const b = await renderBlock(name, 'new')
    // P3-7 AXWF(운영자 결정 2026-10-04): qna/ask-form 은 필수 동의 칸이 있어 WebMCP 속성(toolname·tooldescription)을 더 이상 달지 않는다 — 그 두 속성만 뺀 것과 같아야 한다
    if (name === 'qna/ask-form' && a.error === undefined) for (const k of Object.keys(a)) a[k] = a[k].replace(/ toolname="[^"]*"/g, '').replace(/ tooldescription="[^"]*"/g, '')
    assert.deepEqual(norm(b), norm(a), `${name}: 한국어 출력이 기준 커밋과 다르다`)
    if (b.error === undefined && Object.values(b).some((html) => DATE_KO.test(html))) withDate++
  }
  assert.ok(withDate >= 5, `날짜가 그려진 블록이 ${withDate}개뿐 — 시험이 날짜 경로를 못 본다`)
})

test('D234: 같은 블록에 locale "en" 을 주면 한글 날짜가 없고, 날짜가 있던 블록은 영어 날짜가 나온다', async () => {
  let swapped = 0
  for (const name of DATE_BLOCKS) {
    const ko = await renderBlock(name, 'new')
    const en = await renderBlock(name, 'new', { locale: 'en' })
    if (ko.error !== undefined) continue
    for (const k of Object.keys(ko)) {
      if (!DATE_KO.test(ko[k])) continue
      assert.doesNotMatch(en[k], DATE_KO, `${name} ${k}: en 인데 한글 날짜`)
      assert.match(en[k], /(?:January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}, \d{4}/, `${name} ${k}: 영어 날짜가 없다`)
      swapped++
    }
  }
  assert.ok(swapped >= 5, `en 으로 바뀐 날짜가 ${swapped}개뿐`)
  const tz = await renderBlock('account/security', 'new', { locale: 'en', timeZone: 'America/Los_Angeles' })
  assert.equal(tz.error, undefined)
})


// ── 찍어내기 06: 영어 사이트는 블록 props 에 locale "en", 한국어 사이트는 칸 없음(출력 그대로) ─────────────────────────────────────
const routes = { home: '/', pricing: '/pricing', signup: '/signup' }
const stampArgs = { routes, navLinks: () => [], primaryCta: () => ({ href: '/signup' }), secondaryHref: () => '/pricing', copyIndex: new Map() }
test('D234·D235: 찍어내기 06 bindSection — 영어 사이트의 블록 props 에 locale "en" 이 실리고 한국어 사이트에는 locale 칸이 없다', async () => {
  const content = { archetype: 'saas', business: { name: 'Moa Plan' }, site: { name: 'Moa Plan' } }
  for (const block of ['block-account-security', 'block-paywall-trial-ending', 'block-consent-preference-dialog']) {
    const ko = await bindSection({ key: 'home/x', block, content: { ...content, locale: 'ko' }, locale: 'ko', ...stampArgs })
    const en = await bindSection({ key: 'home/x', block, content: { ...content, locale: 'en' }, locale: 'en', ...stampArgs })
    assert.ok(ko.props && en.props, block)
    assert.equal('locale' in ko.props, false, `${block}: 한국어는 칸을 싣지 않는다`)
    assert.equal(en.props.locale, 'en', `${block}: 영어는 locale en`)
  }
})
