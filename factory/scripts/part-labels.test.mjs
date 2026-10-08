// 부품 접근 이름 문구 표(P3-5 I18N, 대장 D235) — ui-src/locale-labels(ko·en): ko 값은 예전 부품 코드의 글자 그대로, en 값에는 한글이 없다, 부품은 한국어 글을 표 밖에 새로 쓰지 않는다.
// 서버 렌더되는 부품(breadcrumb·pagination·site-shell)은 locale 이 없으면 기준 커밋 출력과 같고, en 이면 영어 이름이다. 대화상자 등 클라이언트 부품은 코드가 표를 읽는지 정적으로 본다.
// 실행: node --test --test-force-exit --test-timeout=240000 factory/scripts/part-labels.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { BASE, baseOk, git, h, html, load, renderToStaticMarkup, root, stripFinalRound } from './lib/base-compare.mjs'

const HANGUL = /[가-힣]/
const LABELS = 'registry/factory/ui-src/locale-labels.tsx'

test('D235: 문구 표 — ko·en 키가 같고, ko 값은 기준 커밋 ui-src 의 글자 그대로이며, en 값에는 한글이 없다', { skip: !baseOk && `기준 커밋 ${BASE} 없음` }, async () => {
  const { UI_LABELS, uiLabels } = await load(LABELS)
  assert.deepEqual(Object.keys(UI_LABELS.en).sort(), Object.keys(UI_LABELS.ko).sort())
  const files = git('ls-tree', '--name-only', BASE, 'registry/factory/ui-src/').split('\n').filter((f) => f.endsWith('.tsx'))
  const baseSource = files.map((f) => git('show', `${BASE}:${f}`)).join('\n')
  // REL10B: 블록 공유 조각(_shared/scroll-hint)이 읽는 새 키 — 기준 커밋 부품에 없다(값은 여기서 못 박는다)
  // FINAL-WF3: 375 접이식 메뉴 단추 이름 — 기준 커밋 부품에 없던 새 칸
  const ADDED = { scrollHint: '옆으로 밀어 보세요', siteMenu: '메뉴' }
  for (const [k, v] of Object.entries(UI_LABELS.ko)) if (k in ADDED) assert.equal(v, ADDED[k], `ko.${k}`); else assert.ok(baseSource.includes(`"${v}"`) || baseSource.includes(`>${v}<`) || baseSource.includes(`\n          ${v}\n`) || baseSource.includes(`>${v}</`), `ko.${k} 「${v}」 이 기준 커밋 부품에 없다`)
  const SAME = new Set(['stepSkip']) // 예전 부품이 영어 「Skip」 을 기본으로 그렸다 — 한국어 출력 불변이라 그대로
  for (const [k, v] of Object.entries(UI_LABELS.en)) {
    assert.ok(v.trim(), `en.${k} 가 비었다`)
    assert.doesNotMatch(v, HANGUL, `en.${k} 에 한글`)
    if (!SAME.has(k)) assert.notEqual(v, UI_LABELS.ko[k], `en.${k} 가 ko 와 같다`)
  }
  assert.equal(uiLabels(), UI_LABELS.ko)
  assert.equal(uiLabels('ko'), UI_LABELS.ko)
  assert.equal(uiLabels('en'), UI_LABELS.en)
  assert.equal(uiLabels('fr'), UI_LABELS.ko, '모르는 로캘은 한국어(예전 출력)')
})

test('D235: 부품(ui-src)은 한국어 글을 표 밖에 새로 쓰지 않는다 — 문자열·JSX 글에 한글이 있으면 실패(개발 경고 「[…]」 와 표 파일만 예외)', () => {
  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  const dir = join(root, 'registry', 'factory', 'ui-src')
  const bad = []
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.tsx') && x !== 'locale-labels.tsx')) {
    const src = strip(readFileSync(join(dir, f), 'utf8'))
    for (const m of src.matchAll(/(["'`])((?:\\.|(?!\1)[^\\\n])*)\1/g)) if (HANGUL.test(m[2]) && !m[2].startsWith('[')) bad.push(`${f}: ${m[2]}`)
    for (const m of src.matchAll(/>([^<>{}\n]*[가-힣][^<>{}\n]*)</g)) bad.push(`${f}: JSX ${m[1].trim()}`)
  }
  assert.deepEqual(bad, [], '부품에 표 밖 한국어 글이 있다 — locale-labels 표에 ko·en 값을 함께 더하고 uiLabels(locale) 로 읽는다')
})

const PART = (n) => `registry/factory/ui/${n}.tsx`

test('D235: 서버 렌더되는 부품(breadcrumb·pagination·site-shell)은 locale 이 없으면 기준 커밋 출력과 같고, en 이면 영어 이름이다', { skip: !baseOk && `기준 커밋 ${BASE} 없음` }, async () => {
  const [bo, bn] = [await load(PART('breadcrumb'), 'old'), await load(PART('breadcrumb'))]
  const crumb = (m, p = {}) => html(h(m.Breadcrumb, p, h(m.BreadcrumbList, null, h(m.BreadcrumbItem, null, h(m.BreadcrumbLink, { href: '/' }, '홈')), h(m.BreadcrumbEllipsis, p))))
  // 글 내용은 기준 커밋과 같다(class 는 뺀다 — FB9 D237 이 breadcrumb 훅의 글자 크기·색을 일부러 바꿨다: 모양은 breadcrumb-legible.test.mjs 가 본다)
  const noClass = (x) => x.replace(/ class="[^"]*"/g, '')
  assert.equal(noClass(crumb(bn)), noClass(crumb(bo)))
  assert.match(crumb(bn), /aria-label="이동 경로"[\s\S]*더 보기/)
  assert.match(crumb(bn, { locale: 'en' }), /aria-label="Breadcrumb"[\s\S]*>More</)
  assert.equal(crumb(bn, { 'aria-label': '경로' }).includes('aria-label="경로"'), true, '문구 prop 이 표보다 앞선다')

  const [po, pn] = [await load(PART('pagination'), 'old'), await load(PART('pagination'))]
  const pag = (m, p = {}) => html(h(m.Pagination, p, h(m.PaginationContent, null, h(m.PaginationItem, null, h(m.PaginationPrevious, { href: '#', ...p })), h(m.PaginationItem, null, h(m.PaginationEllipsis, p)), h(m.PaginationItem, null, h(m.PaginationNext, { href: '#', ...p })))))
  assert.equal(stripFinalRound(pag(pn)), stripFinalRound(pag(po)))
  for (const s of ['aria-label="쪽 이동"', 'aria-label="이전 쪽으로"', '>이전<', '>다음<', '쪽 더 있음']) assert.ok(pag(pn).includes(s), s)
  const pe = pag(pn, { locale: 'en' })
  for (const s of ['aria-label="Pagination"', 'aria-label="Go to previous page"', 'aria-label="Go to next page"', '>Previous<', '>Next<', 'More pages']) assert.ok(pe.includes(s), `en ${s}`)
  assert.doesNotMatch(pe, HANGUL)
  assert.ok(html(h(pn.PaginationPrevious, { href: '#', text: '뒤로' })).includes('>뒤로<'), 'text prop 이 표보다 앞선다')

  const [so, sn] = [await load(PART('site-shell'), 'old'), await load(PART('site-shell'))]
  const business = { name: '모아플랜(예시)', representative: '김예시', bizRegNo: '123-45-67890', mailOrderNo: '2026-서울-0000', ftcLookupUrl: 'https://example.com/ftc', address: '서울시 예시구', phone: '02-1234-5678', email: 'hi@example.com', termsUrl: '/terms', privacyUrl: '/privacy' }
  const shell = (m, p = {}) => html(h(m.SiteShell, { archetype: 'saas', logo: '로고', pageTitle: '제목', nav: [{ label: '요금', href: '/pricing' }], banner: '띠', business, ...p }, h('p', null, '본문')))
  // 글·접근 이름은 기준 커밋과 같다(class 는 뺀다 — FINAL-WF3 375 접이식 메뉴가 띠의 배치 클래스를 일부러 바꿨다: 모양은 qa:shell 이 본다)
  assert.equal(noClass(stripFinalRound(shell(sn))), noClass(stripFinalRound(shell(so))), 'ko 기본 출력이 기준 커밋과 같다')
  for (const s of ['주 메뉴', '공식 배너', '본문 바로가기', '상호', '대표자', '사업자등록번호', '통신판매업신고번호', '사업자정보 확인', '주소', '연락처', '이용약관', '개인정보 처리방침']) assert.ok(shell(sn).includes(s), s)
  const se = shell(sn, { locale: 'en' })
  for (const s of ['aria-label="Main menu"', 'aria-label="Official banner"', 'Skip to main content', 'Business name', 'Representative', 'Business registration no.', 'Mail-order business no.', 'Verify business information', 'Address', 'Contact', 'Terms of Service', 'Privacy Policy']) assert.ok(se.includes(s), `en ${s}`)
  assert.ok(shell(sn, { locale: 'en', navLabel: '메뉴', skipLabel: '건너뛰기' }).includes('aria-label="메뉴"'), '문구 prop 이 표보다 앞선다')
})

test('D235: 클라이언트 부품의 접근 이름도 표에서 읽는다 — 부품 코드가 uiLabels(locale) 를 부르고 locale 칸이 있다(상태가 있어야 그려지는 부품은 갤러리 관문이 본다)', () => {
  const dir = join(root, 'registry', 'factory', 'ui-src')
  const use = { dialog: ['close'], sheet: ['close'], carousel: ['carouselPrev', 'carouselNext'], combobox: ['comboboxOpen', 'comboboxClear', 'comboboxChipRemove'], command: ['commandTitle', 'commandDescription'],
    'message-scroller': ['scrollToEnd', 'scrollToStart'], questionnaire: ['stepPrev', 'stepNext', 'stepSkip'], resizable: ['resize'], sidebar: ['sidebar', 'sidebarDescription', 'sidebarToggle'],
    slider: ['sliderValue'], spinner: ['loading'], toast: ['toastRegion', 'toastClose'], breadcrumb: ['breadcrumb', 'breadcrumbMore'], pagination: ['paginationNav', 'paginationPrev', 'paginationNext', 'paginationPrevAria', 'paginationNextAria', 'paginationMore'],
    'site-shell': ['siteNav', 'siteBanner', 'siteSkip', 'bizName', 'bizRepresentative', 'bizRegNo', 'bizMailOrderNo', 'bizLookup', 'bizAddress', 'bizContact', 'terms', 'privacy', 'siteMenu'] }
  const all = new Set()
  // REL10B: 부품이 아니라 블록 공유 조각이 읽는 키
  const scrollHint = readFileSync(join(root, 'registry', 'factory', 'blocks', '_shared', 'scroll-hint.tsx'), 'utf8')
  assert.match(scrollHint, /uiLabels\(locale\)\.scrollHint/, 'scroll-hint 가 표에서 scrollHint 를 읽지 않는다')
  all.add('scrollHint')
  for (const [part, keys] of Object.entries(use)) {
    const src = readFileSync(join(dir, `${part}.tsx`), 'utf8')
    assert.match(src, /locale\?: UiLocale/, `${part}: locale 칸이 없다`)
    for (const k of keys) { assert.match(src, new RegExp(`\\.${k}\\b`), `${part}: ${k} 를 표에서 읽지 않는다`); all.add(k) }
  }
  const labels = readFileSync(join(dir, 'locale-labels.tsx'), 'utf8')
  const keys = [...labels.slice(labels.indexOf('const KO'), labels.indexOf('} as const')).matchAll(/^  (\w+):/gm)].map((m) => m[1])
  assert.deepEqual(keys.filter((k) => !all.has(k)), [], '표에만 있고 부품이 안 읽는 키')
})

test('D235: 대화상자를 여는 블록 셋은 locale 을 DialogContent 에 넘긴다', () => {
  for (const f of ['consent/preference-dialog', 'paywall/upgrade-modal', 'lead-capture/cart-exit-offer']) {
    const src = readFileSync(join(root, 'registry', 'factory', 'blocks', `${f}.tsx`), 'utf8')
    // 쿠키 설정 대화상자는 공유 조각(_shared/consent-prefs — P3-6)으로 옮겨졌다: 블록은 locale 을 그 조각에 넘기고 조각이 DialogContent 에 넘긴다
    if (f === 'consent/preference-dialog') {
      assert.match(src, /<ConsentPrefsDialog[\s\S]*?locale=\{locale\}/, f)
      assert.match(readFileSync(join(root, 'registry', 'factory', 'blocks', '_shared', 'consent-prefs.tsx'), 'utf8'), /<DialogContent\s+locale=\{locale\}/, f)
      continue
    }
    assert.match(src, /<DialogContent locale=\{locale\}/, f)
  }
})

test('D235: 찍어내기 사이트 템플릿 — shellProps 는 영어 사이트에만 locale "en" 을 싣는다(한국어는 칸 없음 — SiteShell 출력 그대로)', () => {
  const site = readFileSync(join(root, 'factory', 'stamp', 'site-template', 'lib', 'site.tsx'), 'utf8')
  assert.match(site, /\.\.\.\(locale === "en" \? \{ locale \} : \{\}\)/)
})
