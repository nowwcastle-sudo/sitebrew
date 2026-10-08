// 06-pages 의 문구 묶기(P3-3 Task 9, 대장 C101) — 블록 예시(fixture)의 모양에 콘텐츠 값을 잇는다.
//   섹션 props = 그 블록의 예시 props 를 바탕으로, 콘텐츠에서 온 값을 $ref(콘텐츠 경로 가리킴)로 바꿔 넣은 것이다.
//   · 사실(상호·가격·전화·주소·날짜·개수)은 콘텐츠에서만 온다. 예시 모듈의 문구는 UI 이름표·캡션(슬롯 밖 copy)에만 쓴다(C101).
//   · $ref 를 쓰는 이유(J9): 사이트에서 콘텐츠 값은 content/site.json 한 곳에만 있고, props 는 그 자리를 가리킨다. 손볼 때 이 파일 하나만 고친다(§9 Q6).
//   · 콘텐츠로 묶지 못하고 예시에서 남은 글자가 예시 표지(「예시」·"(example)")·예시 사업체 이름·숫자를 담으면 공개 불가(blocker)다.
//   · 사실을 묶을 자료가 콘텐츠에 없으면 binder 가 null 을 돌려주고, 섹션은 그려지지 않는다(예시 사실을 대신 싣지 않는다).
import { isNeedsCheck } from './needs-check.mjs'

// ── $ref ────────────────────────────────────────────────────────────────
export const ref = (path, extra = {}) => ({ $ref: path, ...extra })
export const isRef = (v) => v !== null && typeof v === 'object' && !Array.isArray(v) && typeof v.$ref === 'string'
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

export const at = (obj, path) => String(path).split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj)

// tel: 링크 만들기 — lib/phone normalizePhone 과 같은 규칙이어야 하지만 여기서는 화면 값을 숫자만 남기고 +82 형식으로 옮긴다(자리 표시면 '#').
export function telHref(raw) {
  if (typeof raw !== 'string' || isNeedsCheck(raw)) return '#'
  const t = raw.trim()
  const digits = t.replace(/\D/g, '')
  if (!digits) return '#'
  if (t.startsWith('+')) return `tel:+${digits}`
  if (/^1[5-9]\d{2}\d{4}$/.test(digits)) return `tel:${digits}`
  return `tel:+82${digits.replace(/^0/, '')}`
}

/** $ref 를 콘텐츠 값으로 푼다(생성 때 검사·점검용 — 사이트 실행 때는 template lib/site.ts 가 같은 규칙으로 푼다). */
// 사이트 템플릿 lib/site.tsx 의 isMailAddress(content-core MAILTO_ADDRESS)와 같은 식 — mailto: 로 쓸 수 없는 값(? & # % / = 가 든 주소)은 #(FINAL-WF E3).
export const MAIL_ADDRESS = /^[^\s@<>()[\]\\,;:"?&#%/=]+@[^\s@<>()[\]\\,;:".?&#%/=]+(\.[^\s@<>()[\]\\,;:".?&#%/=]+)*\.[A-Za-z]{2,}$/
export function resolveRefs(v, content) {
  if (isRef(v)) {
    const got = at(content, v.$ref)
    if (got === undefined) throw new Error(`$ref 대상이 콘텐츠에 없다: ${v.$ref}`)
    if (v.as === 'tel') return telHref(got)
    if (v.as === 'mailto') return typeof got === 'string' && got.trim() && !isNeedsCheck(got) && MAIL_ADDRESS.test(got.trim()) ? `mailto:${got.trim()}` : '#'
    return typeof v.template === 'string' && typeof got === 'string' ? v.template.replace('{}', got) : got
  }
  if (Array.isArray(v)) return v.map((x) => resolveRefs(x, content))
  if (isObj(v)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, resolveRefs(x, content)]))
  return v
}

/** props 안 모든 $ref 의 경로(중복 없이). */
export function refsOf(v, out = new Set()) {
  if (isRef(v)) out.add(v.$ref)
  else if (Array.isArray(v)) v.forEach((x) => refsOf(x, out))
  else if (isObj(v)) Object.values(v).forEach((x) => refsOf(x, out))
  return out
}

/** 잎 목록 [{ path, value, ref, num? }] — 문자열은 value, $ref 는 풀지 않고 ref 표시만, 숫자는 num(P4CON: 예시 사업 수치가 숫자 칸으로 새는 길도 본다). */
export function leaves(v, path = '', out = []) {
  if (isRef(v)) out.push({ path, value: null, ref: v.$ref })
  else if (typeof v === 'string') out.push({ path, value: v, ref: null })
  else if (typeof v === 'number') out.push({ path, value: null, ref: null, num: v })
  else if (Array.isArray(v)) v.forEach((x, i) => leaves(x, `${path}[${i}]`, out))
  else if (isObj(v)) for (const [k, x] of Object.entries(v)) leaves(x, path ? `${path}.${k}` : k, out)
  return out
}

// ── 예시 표지(C101) ─────────────────────────────────────────────────────
export const EXAMPLE_MARKER = /예시|\((?:example|sample)\)/i
// 콘텐츠 값(브리프가 준 사실)용 — 가상 주소의 도로명 「예시로 45」·「예시길 3」은 표지가 아니라 주소다(골든 브리프 7개가 쓴다, P3-4 Task 4 실측: 푸터 주소가 「예시 문구 남음」으로 떨어졌다).
// 숫자(번지)가 따르는 도로명만 뺀다 — 「예시」 낱말·「(예시)」·「예시로 쓰세요」는 그대로 표지다.
export const hasExampleMarker = (v) => EXAMPLE_MARKER.test(String(v).replace(/예시(?=(?:로|길|대로)\s*\d)/g, ''))
// QFIX [2] — 가상 사업이라는 표시: **사업 이름 칸(name·legalName·short_name)의 맨 끝 「(예시)」·"(example)" 하나**만 콘텐츠 값 검사에서 면제한다.
// 골든 브리프는 이 하나로 가상임을 밝히고, 그 밖의 사실 값(택배사·역 이름·수상 이름 …)에는 「예시」를 쓰지 않는다. 실제 사용자의 사이트는 어디에 「예시」가 남아도 막힌다
// (이름 가운데·앞·두 번째 표지·이름이 아닌 칸의 끝 표지는 모두 표지다). `path` 는 콘텐츠 경로(`business.name`)나 그 끝 이름이다.
const NAME_LEAF = /^(?:(?:business|organization|agency|manifest|facts|site|product)\.)?(?:name|legalName|short_name)$/
const NAME_END_MARKER = /\s*[(（](?:예시|example)[)）]\s*$/i
export const hasExampleMarkerAt = (path, v) => {
  const s = String(v)
  return hasExampleMarker(NAME_LEAF.test(String(path)) ? s.replace(NAME_END_MARKER, '') : s)
}
// 사업 사실을 나르는 숫자 칸 이름 — 예시 모듈이 literal 로 적으면 그 수치가 그대로 화면에 나간다. 화면 동작 값(defaultOpen·pageSize·resendAfter·depth·count…)은 뺀다.
export const FACT_NUMBER_KEYS = /^(?:price|originalPrice|listPrice|monthlyPrice|yearlyPrice|annualPrice|amount|fee|freeThreshold|remoteExtra|returnFee|withdrawalDays|refundDays|leadDays|days|people|invited|joined|earnedMonths|score|avg)$/
// 사실 목록의 이름 칸 경로(leaves 경로 — `copy.services.items[0].label`). 이 목록이 literal 로 남으면 예시 사실이다.
export const FACT_LIST_PATH = /(?:^|\.)(?:services\.items|quickLinks|shortcuts|departments|doctors|branches)\[\d+\]\.(?:label|name|title)$/
export const EXAMPLE_ADDRESS =/@example\.(?:com|org|net)\b|(?:^|\/\/)(?:[\w-]+\.)?example\.(?:com|org|net)\b/i

/**
 * 콘텐츠로 묶이지 않고 예시에서 남은 글자(literal 잎)에서 공개 불가 사유를 찾는다.
 * @param {{ path: string, value: string|null, ref: string|null }[]} list  leaves(props)
 * @param {Set<string>} exampleNames  예시 모듈이 쓰는 가상 사업체 이름(collectExampleNames)
 * @returns {{ path: string, why: 'marker'|'name'|'digits'|'link'|'number', value: string }[]}
 */
export function exampleIssues(list, exampleNames = new Set()) {
  const out = []
  for (const { path, value, num } of list) {
    // 숫자 칸: 사업 사실(가격·배송비·기간·인원…)을 나르는 키의 literal 숫자는 예시 수치다 — 문자열 검사만으로는 새어 나갔다(예: 배송·반품 안내의 3,000원)
    if (typeof num === 'number') {
      const nk = path.split('.').at(-1).replace(/\[\d+\]$/, '')
      if (FACT_NUMBER_KEYS.test(nk)) out.push({ path, why: 'number', value: String(num) })
      continue
    }
    if (typeof value !== 'string' || !value.trim()) continue
    const key = path.split('.').at(-1).replace(/\[\d+\]$/, '')
    // 링크: 예시 모듈에 적힌 바깥 주소·전화 링크는 예시 사실(가게 지도·전화)이라 새면 안 된다. 사이트 안 경로·앵커는 이름표다.
    if (/^(?:href|url)$/.test(key)) { if (/^(?:https?:\/\/|tel:|mailto:)/i.test(value.trim())) out.push({ path, why: 'link', value }); continue }
    if (/^(?:src|id|kind|icon|type|aspect|source|status|day|opens|closes|start|end|currentHref|locale|faces|announcementId|toolName|ref|at|now|endsAt|startsAt)$/.test(key)) continue
    // 사실 목록의 이름(대장 C299): 서비스·바로가기·진료과·의료진·지점 목록이 예시 literal 로 남으면 표지·숫자·가상 이름이 없어도 이 사업의 것이 아니다
    // (공공 히어로의 「자주 찾는 서비스」 주민 등본·전입 신고 …이 그대로 나갔다). 콘텐츠($ref)로 묶인 목록은 literal 이 아니라 여기 안 온다.
    if (FACT_LIST_PATH.test(path)) { out.push({ path, why: 'list', value }); continue }
    if (EXAMPLE_MARKER.test(value) || EXAMPLE_ADDRESS.test(value)) out.push({ path, why: 'marker', value })
    else if ([...exampleNames].some((n) => n && value.includes(n))) out.push({ path, why: 'name', value })
    else if (/\d/.test(value) && !/^\{[a-z]+\}$/.test(value) && !/^[#/]/.test(value)) out.push({ path, why: 'digits', value })
  }
  return out
}

// ── 앱 화면 목업(대장 C310 부수 발견) ─────────────────────────────────────
// 히어로의 앱 창·패널·터미널 목업(`copy.window`·`copy.panel`·`copy.terminal`·`copy.workspace` …)은 그 제품의 화면을 흉내 낸 그림이라 안의 글(작업 공간 이름·목록·카드 제목)이
// 전부 블록 예시의 가상 앱 글이다. 표지(「예시」)·숫자·가상 이름이 없으면 exampleIssues 가 못 잡아 골든 saas-1/b 견적노트 사이트에 「갈피」·「배송 조사」·「봉투 두께 비교」가 그대로 나갔고
// blockers 에는 「실제 사진 필요」뿐이었다. 사이트 콘텐츠에는 이 안의 칸이 없고(앱 화면 글 수십 개 — 04 ui: 칸 상한 MAX_UI_SLOTS 의 몇 배) 사업 사실도 아니므로 문구 칸으로 바꾸지 않고
// 「예시 문구 남음」으로 낸다. 03(readiness)·04(문구 칸 요청)는 exampleIssues 만 보므로 이 검사는 거기 섞지 않는다 — 06 에서만 돈다(골든 03·04 입력이 바뀌지 않는다).
export const MOCKUP_KEYS = ['window', 'panel', 'terminal', 'workspace', 'app', 'screen', 'mockup', 'device', 'browser', 'console']
const MOCKUP_PATH = new RegExp(`(?:^|\\.)(?:${MOCKUP_KEYS.join('|')})(?:\\.|\\[)`)
const MOCKUP_SKIP_KEYS = /^(?:href|url|src|id|kind|icon|type|aspect|source|locale|faces|at|now)$/
/**
 * 콘텐츠로 묶이지 않고 앱 화면 목업 안에 남은 글자(literal 잎)를 「mockup」 사유로 돌려준다. 콘텐츠($ref)로 묶인 잎·링크·식별자 칸은 건너뛴다.
 * @param {{ path: string, value: string|null, ref: string|null }[]} list  leaves(props) 중 ref 가 없는 것
 * @param {Iterable<string>} alreadyFlagged  exampleIssues 가 이미 잡은 경로(되풀이하지 않는다)
 */
export function mockupIssues(list, alreadyFlagged = []) {
  const seen = new Set(alreadyFlagged)
  const byRoot = new Map()
  for (const { path, value, ref } of list) {
    if (ref !== null && ref !== undefined) continue
    if (typeof value !== 'string' || !value.trim() || seen.has(path)) continue
    const m = MOCKUP_PATH.exec(path)
    if (!m) continue
    if (MOCKUP_SKIP_KEYS.test(path.split('.').at(-1).replace(/\[\d+\]$/, ''))) continue
    const root = path.slice(0, m.index + m[0].length - 1) // 목업 칸 자체의 경로(copy.window)
    if (!byRoot.has(root)) byRoot.set(root, [])
    byRoot.get(root).push({ path, value })
  }
  // 목업 하나 = 이슈 하나: 앱 화면 글 수십 개가 한 덩어리 사유다. 잎 수대로 세면 같은 섹션의 폴백 비용(남는 이슈 수)이 부풀어,
  // 03 이 고른 변형이 예시 표지 한 곳짜리 다른 변형으로 바뀌어 후보마다 다른 첫 화면이 같아진다.
  return [...byRoot].map(([path, ls]) => ({ path, why: 'mockup', value: `${ls[0].value}${ls.length > 1 ? ` 외 ${ls.length - 1}곳` : ''}`, leaves: ls.map((l) => l.path) }))
}

// ── 블록 예시의 사업 내용 글(레인 EXLEAK) ───────────────────────────────────────────────────────────────
// exampleIssues 는 표지(「예시」)·숫자·가상 이름이 든 글만 잡는다. 「이번 주 빵」·「Loud ideas, quiet craft」·「SIGNAL」·「작업 의뢰」처럼 평범한 낱말로 쓴 예시 사업 이야기는 못 봐서
// 골든 commerce-1 b(커피 로스터리)의 홈 제목이 빵집 문구로, brand-1 a(한옥 찻집)의 히어로가 디자인 스튜디오 문구로 나갔다(08-board blockers 에 「예시 문구 남음」 없음).
// 검사는 대조다: 콘텐츠($ref)로 묶이지 않고 literal 로 남은 글이 그 블록 fixture 에 그대로 있으면 — 콘텐츠(브리프 사실·04 문구)에도 없는 한 — 그 사업의 글이 아니다.
// 03(readiness)·04(문구 칸 요청)는 이 검사를 보지 않는다 — 06 에서만 돈다(mockupIssues 와 같은 길이라 골든 03·04 입력이 바뀌지 않는다).
// 어떤 칸을 사업 내용으로 볼지(범위):
//   · 히어로·마지막 행동 띠 — fixture 문구가 거의 다 가상 사업 이야기다. 화면 이름표(첫 화면·…Label 이름표·전부 보기)·링크·식별자만 뺀다.
//   · 그 밖의 사업 사실 블록(상품 목록·특징·후기·신뢰·FAQ …) — 머리 문구(copy.title·lead·eyebrow …)와 목록 항목의 이름·본문만 본다. 오류·빈 상태·버튼 안내는 UI 낱말이다.
//   · 제품 화면(UI_SLOT_KINDS)·본문(content)·푸터·영업시간·요금제·메뉴 같은 UI 이름표 블록은 보지 않는다 — 안의 글이 이름표라 사업을 말하지 않는다(판단 보류는 보고서에 남는다).
const LEAK_ALL_KINDS = new Set(['hero', 'final-cta'])
const LEAK_HEAD_KINDS = new Set(['product-list', 'features', 'social-proof', 'trust', 'faq', 'integrations', 'review-list', 'lead-capture', 'referral', 'dashboard-panel', 'qna', 'product-info', 'shipping-returns'])
const LEAK_HEAD_PATH = /^copy\.(?:title|headline|heading|subtitle|subhead|lead|lede|eyebrow|kicker|tagline)$/
const LEAK_ITEM_PATH = /^copy\.(?:items|steps|points|quotes|testimonials|logos|entries)\[\d+\]\.(?:title|name|body|text|quote|author|description)$/
const LEAK_EXEMPT_PATH = /^copy\.(?:label|moreCta\.label|services\.label)$/
const LEAK_EXEMPT_KEY = /(?:Label|Alt|^(?:href|url|src|id|kind|icon|type|aspect|source|status|day|opens|closes|start|end|currentHref|locale|faces|announcementId|toolName|ref|at|now|endsAt|startsAt|size|typed|defaultStep|number|value|vatNote|shortcut))$/
// 생성기·블록이 들고 있는 일반 화면 낱말 — fixture 와 같아도 사업 내용이 아니다(작은 표). 상품 목록 제목·상세 구매 이름표는 아래 표가 정본이다.
export const PRODUCT_LIST_UI = { ko: { title: '전체 상품' }, en: { title: 'All products' } }
// 단계 특징(numbered-steps)의 제목: 예시의 「세 단계면 시작합니다」는 단계 수를 주장한다 — 단계는 콘텐츠(workflowSteps)가 정하니 생성기의 중립 이름표를 쓴다.
export const FEATURES_UI = { ko: { title: '이용 방법' }, en: { title: 'How it works' } }
// 5.11(C5 자료 연결) — binder 가 새로 묶는 블록의 화면 이름표(사업 사실을 주장하지 않는 낱말만). 예시 제목의 단계 수·고객 수 주장을 싣지 않는다.
//   proofTitle: 근거 한 줄(claim)만 있고 로고가 없는 사회적 증거 줄의 제목 · matrixCaption: 요금제 × 기능 표의 캡션(예시 「세 가지」는 요금제 수를 주장한다)
export const PROOF_UI = {
  ko: { proofTitle: '숫자로 보기', recognitionTitle: '수상과 인증', clientsTitle: '함께한 곳' },
  en: { proofTitle: 'By the numbers', recognitionTitle: 'Awards and recognition', clientsTitle: 'Worked with' },
}
// QFIX [1] — 로고 줄의 증거 한 줄이 되는 문구 칸 id(섹션 이름 → 칸). 원형 JSON 에서 이 칸의 role 이 수상·인증(award)·고객 이름(client)이다.
export const EVIDENCE_SLOT = { recognition: 'award', 'client-roster': 'client' }
// 요금제 행동 버튼 글(FINAL-WF2 AB10): 금액이 0 이면 「무료로 시작」, 문의형(금액 없음)이면 문의, 그 밖(유료)은 고르기 — 유료 요금제 버튼에 「무료로 시작」을 쓰지 않는다.
export const PRICING_UI = { ko: { matrixCaption: '요금제별 월 금액과 포함 기능', ctaFree: '무료로 시작', ctaPaid: '선택하기', ctaContact: '문의하기' }, en: { matrixCaption: 'Monthly price and included features by plan', ctaFree: 'Start for free', ctaPaid: 'Choose this plan', ctaContact: 'Contact us' } }
// 가격 곁 한 줄(5.13): 부가세 표기와 합계 안내 — 사실(부가세 포함/별도, 배송비 유무)에서 고르는 문장이고 숫자는 적지 않는다(금액은 콘텐츠 값이 따로 보인다).
// 가격 글 판정(FINAL-WF B7): 「13,000원」·「$9」뿐 아니라 한국어 단위 「9천원」·「1만원대」·「3만 5천원」도 가격이다.
export const PRICE_TEXT = /\d[\d,]*(?:\.\d+)?\s?(?:(?:만(?:\s?\d[\d,]*\s?천)?|천|억)\s?)?(?:원|₩|KRW|USD|달러|€)|[₩$€]\s?\d/
export const PRICE_NOTE_UI = {
  ko: { vatIncluded: '가격은 모두 부가세 포함이에요', vatExcluded: '가격은 모두 부가세 별도예요', totalWithShipping: '합계는 상품 가격에 배송비를 더한 금액이에요', totalNoShipping: '배송비는 없어요. 표시된 가격이 합계예요', vatExempt: '부가세 면세예요' },
  en: { vatIncluded: 'All prices include VAT', vatExcluded: 'All prices exclude VAT', totalWithShipping: 'The total is the product price plus shipping', totalNoShipping: 'There is no shipping fee. The price shown is the total', vatExempt: 'VAT exempt' },
}
// 본문이 하나도 안 그려진 쪽의 빈 상태 안내(5.13, UX H08 — 무엇이 비었나 + 첫 행동 하나): 앱 고유 주 화면처럼 콘텐츠로 그릴 수 없는 쪽이 머리글·띠만 남아 본문 0 이 되는 것을 막는다. 사실을 주장하지 않는 낱말만 쓴다.
export const EMPTY_PAGE_UI = {
  ko: { title: '아직 보여 줄 내용이 없어요', body: '이 화면에 들어갈 내용을 채우는 중이에요. 처음 화면에서 시작해 주세요.', home: '처음 화면으로' },
  en: { title: 'Nothing to show here yet', body: 'The content for this screen is still being filled in. Please start from the home page.', home: 'Go to the home page' },
}
// 본문이 아닌 띠·틀(머리·공지·동의·하단 바·떠 있는 행동·푸터·현재 위치·뼈대) — 이 블록만 그려진 쪽은 본문이 없다.
export const CHROME_BLOCK = /^block-(?:nav|announcement|consent|bottom-tab|floating-action|footer)-|^block-content-(?:breadcrumb|skeleton)$/
export const hasBodyBlock = (blocks) => blocks.some((b) => !CHROME_BLOCK.test(b))
// 로그인해야 보이는 쪽의 서버 HTML(FINAL-WF4 EN2): account·billing·cancel 쪽의 블록은 포트를 클라이언트에서 읽어 서버가 그린 HTML 에는 「Loading …」뿐이다 — 쪽이 무엇이고 로그아웃이면 어디로 가는지 글이 없었다.
// 블록의 읽기 상태는 건드리지 않고, 영어 사이트의 이 쪽 끝에 빈 상태 안내 블록(state-screen/empty-guide)을 한 장 더 그린다: 로그인 링크 하나. 한국어 사이트는 그대로(null).
export const SIGNIN_GUIDE_PAGES = new Set(['account', 'billing', 'cancel'])
export const SIGNIN_GUIDE_UI = { en: { title: 'Sign in to see this page', body: 'Your account, billing and plan changes show here once you are signed in.', label: 'Sign in' } }
export const signInGuideProps = (locale, loginHref) => {
  const u = SIGNIN_GUIDE_UI[locale]
  return u && typeof loginHref === 'string' && loginHref ? { copy: { title: u.title, body: u.body, primary: { label: u.label, href: loginHref } } } : null
}
// 제품 화면 머리글 한 줄 설명(FINAL-WF4 EN2): 영어 장면의 `copy.lead` 는 「(example)」 표지가 붙어 06 이 선택 칸이라 뺐고, 서버 HTML 에는 제목과 「Loading」만 남았다.
// 표지만 뗀 글이 어느 제품에나 맞는 화면 설명인 블록만 표로 둔다(사업을 말하는 lead — 체크리스트의 「10분」·해지의 「세 단계」 — 는 싣지 않는다).
export const EN_SCREEN_LEADS = {
  'block-account-profile-settings': 'Change your sign-in details and security settings here.',
  'block-account-billing-manage': 'Change your plan, next billing date and payment method here.',
  'block-retention-cancel-flow': 'Cancel your subscription here.',
  'block-paywall-limit-meter': "See how much of your plan's limit you've used.",
}
export const emptyGuideProps = (locale) => {
  const u = EMPTY_PAGE_UI[locale === 'en' ? 'en' : 'ko']
  return { copy: { title: u.title, body: u.body, primary: { label: u.home, href: '/' } } }
}
// 신청 폼(lead-capture)의 화면 이름표 — 예시의 소식지·체크리스트 사업 문구(「소식지 구독하기」·「이번 주 목요일부터 받아요」·「메일은 1분 안에 도착해요」)를 대신한다.
// 제출은 서버 없이 되는 정적 어댑터(메일 앱 열기, lib/contact.ts makeLeadPorts)라 「메일을 보냈어요」가 아니라 「메일 앱에서 보내기를 눌러 주세요」가 사실이다.
// 사업이 정하는 문구(제목·받는 것·버튼 글자·수집 고지·안심 한 줄)는 04 문구 칸(leadTitle·leadWhat·submitLabel·consentNote·riskReducer)에서 온다.
export const LEAD_UI = {
  ko: {
    emailRequired: '이메일을 적어 주세요.', consentLabel: '(필수) 안내 메일을 받는 데 동의해요', consentRequired: '안내 메일 수신에 동의해 주세요.',
    unsubscribe: '메일 맨 아래 「수신 거부」를 누르면 언제든 바로 끊겨요.', pending: '여는 중', serverErrorTitle: '신청하지 못했어요',
    doneTitle: '메일 앱에서 마무리해 주세요', doneBody: '열린 메일 앱에서 {email} 신청 내용을 확인하고 보내기를 눌러 주세요.',
    magnetContentsTitle: '담긴 것', magnetConsent: '(선택) 새 자료가 나오면 메일로도 받을게요', magnetArrival: '신청하면 메일 앱이 열려요. 내용을 확인하고 보내기를 눌러 주세요.',
  },
  en: {
    emailRequired: 'Enter your email.', consentLabel: '(Required) I agree to receive the emails', consentRequired: 'Please agree to receive the emails.',
    unsubscribe: 'Use “Unsubscribe” at the bottom of any email to stop at any time.', pending: 'Opening', serverErrorTitle: 'Could not sign you up',
    doneTitle: 'Finish in your mail app', doneBody: 'Check the request for {email} in the mail app that just opened, then press send.',
    magnetContentsTitle: 'What’s inside', magnetConsent: '(Optional) Email me when new material comes out', magnetArrival: 'Your mail app opens when you sign up. Check it and press send.',
  },
}
// 대시보드 패널의 화면 이름표 — 숫자는 launch-factory 가 실행 때 채운다. 콘텐츠에 KPI·경고·표가 없으면 빈 상태(무엇이 비었나 + 이유)를 그린다(UX H08).
export const DASHBOARD_UI = {
  ko: { loadingLabel: '불러오는 중이에요', emptyTitle: '아직 보여 줄 데이터가 없어요', emptyBody: '데이터가 쌓이면 이 자리에 먼저 보여요', refreshLabel: '갱신 주기', helpLabel: '도움말 보기', tableCaption: '데이터 표', titles: { 'kpi-first': '핵심 지표', 'action-list': '조치가 필요한 일', 'trend-plus-table': '추세와 목록' } },
  en: { loadingLabel: 'Loading', emptyTitle: 'There is no data to show yet', emptyBody: 'Once data comes in, it shows up here first', refreshLabel: 'Refreshes', helpLabel: 'View help', tableCaption: 'Data table', titles: { 'kpi-first': 'Key metrics', 'action-list': 'Needs action', 'trend-plus-table': 'Trends and list' } },
}
// 히어로 주 행동 버튼의 이름표: 문구 칸(primaryCta)이 없는 원형(commerce·brand·public…)에서는 예시 버튼 글(「장보기」·「발급 신청」·「전시 예약」)이 그대로 나갔다.
// 버튼이 가는 곳(가입·전화·문의·요금제·상품 목록)이 정해져 있을 때만 그곳의 이름을 쓴다 — 갈 곳이 없으면 이름표도 없다.
export const CTA_UI = {
  ko: { signup: '시작하기', tel: '전화하기', contact: '문의하기', pricing: '요금제 보기', products: '상품 보기', about: '소개 보기' },
  en: { signup: 'Get started', tel: 'Call us', contact: 'Contact us', pricing: 'View pricing', products: 'Shop products', about: 'About us' },
}
// 어느 사업에나 맞는 구역 제목(사업·상품·수치를 말하지 않는다) — fixture 와 같아도 누설이 아니다.
const GENERIC_HEADINGS = ['자주 묻는 질문', '주제별 자주 묻는 질문', '상품 정보', '배송·반품 안내', '반품은 이렇게 해요', '구매 후기', '사진으로 보는 후기', '방문 후기', '상품 문의', '궁금한 점을 남겨 주세요', '궁금한 점을 찾아 보세요', '사업자 정보', '분류별 연동', '쓰던 도구와 그대로 이어집니다', '결제 수단을 골라 주세요', '먼저 쓴 분들의 이야기', '이런 곳이 씁니다', '편한 방법으로 물어보세요']
const GENERIC_UI_WORDS = [...GENERIC_HEADINGS, '전부 보기', '전체 보기', '더 보기', '자세히 보기', '더 알아보기', '시작하기', '문의하기', '예약하기', '전화하기', 'Learn more', 'Get started', 'Contact us', 'View all', 'See all']
let uiWordsCache
const uiWords = () => {
  if (uiWordsCache) return uiWordsCache
  const set = new Set(GENERIC_UI_WORDS)
  const walk = (v) => { if (typeof v === 'string') set.add(v.trim()); else if (Array.isArray(v)) v.forEach(walk); else if (isObj(v)) Object.values(v).forEach(walk) }
  walk(DETAIL_UI)
  walk(PRODUCT_LIST_UI)
  walk(FEATURES_UI)
  walk(PROOF_UI)
  walk(PRICING_UI)
  walk(MENU_PRICE_UI)
  walk(CONTACT_DONE_UI)
  walk(DASHBOARD_UI)
  walk(LEAD_UI)
  walk(PRICE_NOTE_UI)
  walk(EMPTY_PAGE_UI)
  walk(CTA_UI)
  walk(TABLE_UI)
  walk(INFO_UI)
  walk(POLICY_UI)
  walk(TOAST_UI)
  return (uiWordsCache = set)
}
/** 콘텐츠의 글자(문구 칸·사실 값) 집합 — sections 는 빼고(섹션 props 는 이 검사가 보는 대상이다). 사업이 정말 그 말을 쓰면 fixture 와 같아도 누설이 아니다. */
export function contentTextsOf(content) {
  const out = new Set()
  const walk = (v, key) => {
    if (typeof v === 'string') { const t = v.trim(); if (t.length >= 2) out.add(t) } else if (Array.isArray(v)) v.forEach((x) => walk(x, key)); else if (isObj(v)) for (const [k, x] of Object.entries(v)) if (k !== 'sections') walk(x, k)
  }
  walk(content, '')
  return out
}
/**
 * 콘텐츠로 묶이지 않고 블록 예시(fixture)에서 그대로 남은 사업 내용 글을 「leak」 사유로 돌려준다.
 * @param {{ path: string, value: string|null, ref: string|null }[]} list  leaves(props) 중 ref 가 없는 것
 * @param {object} fixture  binder 가 손대기 전의 블록 예시 props
 * @param {{ kind: string, contentTexts?: Set<string>, alreadyFlagged?: Iterable<string> }} opts
 */
export function leakIssues(list, fixture, { kind, contentTexts = new Set(), alreadyFlagged = [] } = {}) {
  const all = LEAK_ALL_KINDS.has(kind)
  if (!all && !LEAK_HEAD_KINDS.has(kind)) return []
  const example = new Set(leaves(fixture).filter((l) => typeof l.value === 'string').map((l) => l.value.trim()))
  const seen = new Set(alreadyFlagged)
  const out = []
  for (const { path, value, ref: r } of list) {
    if (r !== null && r !== undefined) continue
    if (typeof value !== 'string' || seen.has(path)) continue
    const v = value.trim()
    if (!v || !example.has(v) || !/[A-Za-z가-힣]/.test(v) || /^(?:[#/]|https?:|tel:|mailto:)/i.test(v)) continue
    const key = path.split('.').at(-1).replace(/\[\d+\]$/, '')
    const inScope = all ? !LEAK_EXEMPT_PATH.test(path) && !LEAK_EXEMPT_KEY.test(key) : LEAK_HEAD_PATH.test(path) || LEAK_ITEM_PATH.test(path)
    if (!inScope || uiWords().has(v) || contentTexts.has(v)) continue
    out.push({ path, why: 'leak', value })
  }
  return out
}

/**
 * 누설 이슈를 한 덩어리로 묶는다 — 목업 하나가 이슈 하나이듯(mockupIssues) 한 섹션의 누설 글이 몇 개든 이슈는 하나다.
 * 잎 수대로 세면 이슈 주도 폴백(06 bindKey)이 「누설 글 다섯 개짜리 변형」보다 「가짜 앱 창 변형」(이슈 셋)을 낫다고 읽어 더 나쁜 변형으로 바뀐다.
 */
export function groupLeakIssues(list) {
  if (!list.length) return []
  return [{ path: list[0].path, why: 'leak', value: `${list[0].value}${list.length > 1 ? ` 외 ${list.length - 1}곳` : ''}`, leaves: list.map((i) => i.path) }]
}

// ── 다른 말·다른 사업의 화면 문구(레인 LEGFIX, 대장 C359 · C333 와 겹친다 — 문구 칸 설계가 아니라 새는 길을 막는 사유만) ─────────────────────────────────────────────
// 제품 화면(UI_SLOT_KINDS) 블록 예시는 한국어이고 예약·일정 사업의 말투다(「예약 페이지 만들기」·「쓰던 예약 장부 옮기기」·「엑셀 파일을 올려…」). 위 leakIssues 는 이 종류를 일부러 안 본다
// (안의 글이 UI 이름표 — 판단 보류, C333). 그래서 골든 saas-1·2·pwa-1·2 의 온보딩·빈 화면에 그 문구가 그대로 나가도 08-board blockers 에 안 떴고, 영어 사이트(saas-2·pwa-2·portfolio-2)의
// 제품 화면·머리글 이름표는 통째로 한국어였다. 두 가지만 사유로 낸다(둘 다 한 섹션 = 이슈 하나):
//   · 영어 사이트의 섹션 props 에 콘텐츠($ref)로 안 묶인 한글 글이 남음 — 어느 블록 종류든 사이트 언어와 다른 글이다.
//   · 한국어 사이트의 제품 화면 블록에 예약·일정 사업의 문구가 남는데 콘텐츠(브리프 사실·04 문구)가 예약·일정 사업이 아님 — 콘텐츠가 그 말을 쓰면(예약 앱 등) 누설이 아니다.
// 제품 화면 예시(온보딩·빈 화면·알림 설정·해지 흐름)가 쓰는 예약·일정 사업의 구체 문구만 본다. 「해지 예약」·「PDF·엑셀」처럼 어느 서비스에나 있는 말은 걸리지 않게 낱말 하나가 아니라 글 모양으로 건다
// (골든 saas-1 실측: 낱말만 걸면 「해지 예약」·「PDF·엑셀」이 오탐). 콘텐츠가 예약·일정·손님·장부·방문 중 하나라도 말하면 예약 사업이라 이 말들이 이 사업의 말이다(검사 안 함) — 「다른 사업」의 문구만 잡는다.
export const BOOKING_DOMAIN_WORDS = ['예약', '일정', '손님', '장부', '방문']
export const FOREIGN_BIZ_PATTERNS = [/손님/, /장부/, /예약 (?:페이지|알림|받기)|예약표|받은 예약|새 예약/, /엑셀 파일/, /(?:만든|첫|오늘) 일정|일정 알림/]
const HANGUL = /[가-힣]/
// 영어 장면(fixtureEn)의 사업 주장(FINAL-WF4 EN1): 영어 장면은 업종 낱말(예약·카페 …)은 없지만 「프로젝트·팀원·보고서·PDF·엑셀·파일」 같은 특정 제품의 말은 든다
// (「Create your first project」·「Report export is on the Pro plan」·「Invite a teammate」). 이 제품이 그 말을 하는 사업이 아니면 영어 사이트에 그대로 나가면 안 된다 —
// 04 화면 문구 칸으로 다시 쓰게 하고(ui-copy.mjs uiLeavesOf), 그래도 literal 로 남으면 06 이 사유로 낸다(foreignTextIssue). 콘텐츠가 그 말을 쓰면(프로젝트 관리 도구 등) 그 낱말은 이 사업의 말이다.
// 「PDF」 한 낱말(Print or save as PDF)·「card on file」은 어느 제품에나 있는 말이라 거는 글 모양에서 뺀다.
export const EN_SCENE_CLAIM_PATTERNS = [/\bprojects?\b/i, /\bteammates?\b/i, /\bteam chat\b/i, /\breports?\b/i, /\bExcel\b/, /\bfiles\b|\bupload a file\b/i, /\bPriority support\b/i]
// 식별자 칸(href·id·trigger·limitKey …)의 값은 화면 글이 아니다
export const EN_SCENE_ID_KEY = /(?:^|\.)(?:href|url|src|id|kind|icon|type|trigger|limitKey|planId|planIds|locale)(?:\[\d+\])?$/
export const isEnSceneClaim = (v, path = '') => typeof v === 'string' && !EN_SCENE_ID_KEY.test(path) && EN_SCENE_CLAIM_PATTERNS.some((re) => re.test(v))
/**
 * @param {{ path: string, value: string|null, ref: string|null }[]} list  leaves(props)
 * @param {{ locale: string, kind: string, contentTexts?: Set<string> }} opts
 * @returns {{ why: 'locale'|'biz', count: number, sample: string, words?: string[], paths: string[] } | null}
 */
export function foreignTextIssue(list, { locale, kind, contentTexts = new Set() } = {}) {
  const literal = list.filter((l) => l.ref === null && typeof l.value === 'string')
  if (locale === 'en') {
    const hit = literal.filter((l) => HANGUL.test(l.value))
    if (hit.length) return { why: 'locale', count: hit.length, sample: hit[0].value, paths: hit.map((l) => l.path) }
    if (!UI_SLOT_KINDS.has(kind)) return null
    const texts = [...contentTexts]
    const usable = EN_SCENE_CLAIM_PATTERNS.filter((re) => !texts.some((t) => re.test(t))) // 콘텐츠가 말하는 낱말은 이 사업의 말
    const claims = literal.filter((l) => !EN_SCENE_ID_KEY.test(l.path) && usable.some((re) => re.test(l.value)))
    if (!claims.length) return null
    const words = [...new Set(claims.flatMap((l) => usable.map((re) => re.exec(l.value)?.[0]?.toLowerCase()).filter(Boolean)))]
    return { why: 'biz', count: claims.length, sample: claims[0].value, words, paths: claims.map((l) => l.path) }
  }
  if (!UI_SLOT_KINDS.has(kind)) return null
  const texts = [...contentTexts]
  if (texts.some((t) => BOOKING_DOMAIN_WORDS.some((w) => t.includes(w)))) return null
  const hit = literal.filter((l) => FOREIGN_BIZ_PATTERNS.some((re) => re.test(l.value)))
  if (!hit.length) return null
  const words = [...new Set(hit.flatMap((l) => FOREIGN_BIZ_PATTERNS.map((re) => re.exec(l.value)?.[0]).filter(Boolean)))]
  return { why: 'biz', count: hit.length, sample: hit[0].value, words, paths: hit.map((l) => l.path) }
}

/** 예시 모듈 exports 들에서 가상 사업체 이름을 모은다: business.name·legalName·brand·product(name)·company 문자열. */
export function collectExampleNames(fixtures) {
  const names = new Set()
  const walk = (v, key) => {
    if (typeof v === 'string') {
      if (['brand', 'company', 'legalName', 'shopName', 'serviceName'].includes(key) && v.trim().length >= 2) names.add(v.trim())
    } else if (Array.isArray(v)) v.forEach((x) => walk(x, key))
    else if (isObj(v)) for (const [k, x] of Object.entries(v)) {
      if ((key === 'business' || key === 'product') && k === 'name' && typeof x === 'string' && x.trim().length >= 2) names.add(x.trim())
      else walk(x, k)
    }
  }
  for (const f of fixtures) walk(f, '')
  // 마커가 붙은 이름은 마커 검사가 잡는다 — 여기서는 마커 없는 이름도 잡으려고 마커를 뗀 이름을 같이 넣는다.
  for (const n of [...names]) { const bare = n.replace(/\s*[（(]예시[）)]\s*$/, '').trim(); if (bare.length >= 2) names.add(bare) }
  return names
}

// 예시 모듈 머리 주석이 밝히는 가상 사업체 이름·업종 낱말 — 수출한 값의 「brand·company…」 칸에 없는 이름(가입·로그인 블록의 「모아플랜」, 쿠키 문구의 「빵집」)도 잡는다.
//   「<이름>(예시)」 · 「가상 <업종> 「<이름>」」 → 이름 / 「가상 <업종어>」 → 업종 끝말(집·가게·공방·미용실·한의원·정수기·디자이너)
//   근거: 골든 saas 사이트에 「모아플랜 계정 만들기」·「다른 사이트에서 우리 빵집 광고…」가 그대로 나갔다 — 이름이 brand 칸에 없고 표지·숫자도 없어 exampleIssues 가 통과시켰다(P4CON 수정 3).
const TRADE_WORD = /(?:빵집|[가-힣]{1,4}가게|[가-힣]{1,4}공방|미용실|한의원|정수기|디자이너)$/
const GENERIC_NAME = new Set(['예시', '서비스', '회사', '인물'])
export function collectExampleNamesFromSource(sources) {
  const names = new Set()
  const add = (n) => { const t = String(n).replace(/\s*[（(]예시[）)]\s*$/, '').trim(); if (t.length >= 2 && !GENERIC_NAME.has(t)) names.add(t) }
  for (const src of sources) {
    const text = String(src)
    for (const m of text.matchAll(/「([^」\n]{2,30}?)\s*[（(]예시[）)]」/g)) add(m[1])
    for (const m of text.matchAll(/가상[^「\n]{0,30}「([^」\n(（]{2,24}?)」/g)) add(m[1])
    for (const m of text.matchAll(/가상\s+([^「\n,.]{1,30})/g)) for (const w of m[1].split(/\s+/)) if (TRADE_WORD.test(w) && w.length >= 2) names.add(w)
  }
  return names
}

// ── props 도구 ──────────────────────────────────────────────────────────
export function setAt(obj, path, value) {
  const keys = path.split('.')
  let o = obj
  for (const k of keys.slice(0, -1)) {
    if (!isObj(o[k]) && !Array.isArray(o[k])) return false
    o = o[k]
  }
  o[keys.at(-1)] = value
  return true
}
export const hasAt = (obj, path) => at(obj, path) !== undefined
export function delAt(obj, path) {
  const keys = path.split('.')
  let o = obj
  for (const k of keys.slice(0, -1)) { o = o?.[k]; if (o == null) return }
  delete o[keys.at(-1)]
}

/** 블록 소스에서 선택 칸 이름(`name?:`) 집합. */
export const optionalKeys = (source) => new Set([...String(source).matchAll(/\b(\w+)\?:/g)].map((m) => m[1]))

/**
 * 예시 표지·예시 이름·숫자가 남은 글자 중 선택 칸(타입에 `?:`)인 것은 지운다 — 없는 편이 거짓 문구보다 낫다.
 * 필수 칸은 그대로 두고, 공개 불가 사유(exampleIssues)로 남는다. 지운 경로를 돌려준다.
 */
export function dropOptionalExamples(props, source, exampleNames, { ancestors = true, keepDigits = false, extra = null } = {}) {
  const opt = optionalKeys(source)
  const dropped = []
  for (let round = 0; round < 4; round++) {
    let again = false
    // extra(props): 같은 모양의 이슈 목록을 더하는 검사(06 의 누설 대조 leakIssues — 03·04 는 안 넘기므로 영향 없다)
    for (const issue of [...exampleIssues(leaves(props), exampleNames), ...(extra ? extra(props) : [])]) {
      if (keepDigits && issue.why === 'digits') continue // 제품 화면의 숫자(「만 14세」「8자 이상」)는 화면이 지키는 값일 수 있다 — 빼지 않고 문구 칸으로 다시 쓴다
      // 그 칸이 선택이면 그 칸을, 아니면 선택인 가장 가까운 윗칸(객체·배열 — 예: 예시 날짜가 든 special·예시 문구가 든 tool)을 통째로 뺀다. 배열 원소 하나는 빼지 않는다(개수는 콘텐츠가 정한다).
      const keys = pathKeys(issue.path)
      const lastKey = keys.at(-1)
      let cut = typeof lastKey === 'string' && opt.has(lastKey) ? keys.length : 0
      if (!cut && ancestors) for (let n = keys.length - 1; n >= 1; n--) if (typeof keys[n - 1] === 'string' && opt.has(keys[n - 1])) { cut = n; break }
      if (!cut) continue
      const target = pathOf(keys.slice(0, cut))
      if (getLeaf(props, target) === undefined) continue
      delLeaf(props, target)
      dropped.push(target)
      again = true
    }
    if (!again) break
  }
  return dropped
}

// ── 잎 경로 도구: "copy.steps[1].body" ↔ ["copy","steps",1,"body"] ────────────────────────────────────
export function pathKeys(path) {
  const out = []
  for (const m of String(path).matchAll(/([^.[\]]+)|\[(\d+)\]/g)) out.push(m[2] !== undefined ? Number(m[2]) : m[1])
  return out
}
export const pathOf = (keys) => keys.reduce((s, k) => (typeof k === 'number' ? `${s}[${k}]` : s ? `${s}.${k}` : String(k)), '')
export function getLeaf(obj, path) {
  return pathKeys(path).reduce((o, k) => (o == null ? undefined : o[k]), obj)
}
export function setLeaf(obj, path, value) {
  const keys = pathKeys(path)
  let o = obj
  for (const k of keys.slice(0, -1)) { if (o == null || typeof o !== 'object') return false; o = o[k] }
  if (o == null || typeof o !== 'object') return false
  o[keys.at(-1)] = value
  return true
}
export function delLeaf(obj, path) {
  const keys = pathKeys(path)
  let o = obj
  for (const k of keys.slice(0, -1)) { o = o?.[k]; if (o == null) return }
  if (Array.isArray(o) && typeof keys.at(-1) === 'number') o.splice(keys.at(-1), 1)
  else delete o[keys.at(-1)]
}

// ── 쪽 이름표(생성기가 갖는 UI 이름표 — 콘텐츠 사실이 아니다) ─────────────────────────────────────
export const PAGE_LABELS = {
  home: { ko: '홈', en: 'Home' }, pricing: { ko: '요금제', en: 'Pricing' }, campaign: { ko: '캠페인', en: 'Campaign' }, signup: { ko: '가입', en: 'Sign up' },
  login: { ko: '로그인', en: 'Log in' }, onboarding: { ko: '시작하기', en: 'Get started' }, account: { ko: '내 계정', en: 'Account' }, billing: { ko: '결제', en: 'Billing' },
  cancel: { ko: '해지', en: 'Cancel' }, 'product-detail': { ko: '상품', en: 'Product' }, 'booking-complete': { ko: '예약 완료', en: 'Booking complete' },
  about: { ko: '소개', en: 'About' }, contact: { ko: '문의', en: 'Contact' }, privacy: { ko: '개인정보 처리방침', en: 'Privacy Policy' }, terms: { ko: '이용약관', en: 'Terms of Service' },
  refund: { ko: '환불 정책', en: 'Refund Policy' }, withdrawal: { ko: '청약철회 안내', en: 'Right of Withdrawal' },
  // C304 — 원형 JSON 의 나머지 쪽 id 전부(없으면 pageLabel 이 id 를 영문 그대로 제목·메뉴에 내보냈다). 가드: stamp-page-labels.test.mjs
  news: { ko: '소식', en: 'News' }, careers: { ko: '채용', en: 'Careers' }, 'category-list': { ko: '상품 목록', en: 'Products' }, cart: { ko: '장바구니', en: 'Cart' },
  operational: { ko: '운영 현황', en: 'Operations' }, analytics: { ko: '분석', en: 'Analytics' }, 'admin-list': { ko: '관리 목록', en: 'Admin list' },
  'case-study': { ko: '작업 사례', en: 'Case study' }, main: { ko: '메인', en: 'Main' }, sub: { ko: '안내', en: 'Guide' }, 'sub-detail': { ko: '상세', en: 'Details' },
  offline: { ko: '오프라인', en: 'Offline' }, settings: { ko: '설정', en: 'Settings' }, completion: { ko: '완료', en: 'Done' },
}
export const pageLabel = (id, locale) => PAGE_LABELS[id]?.[locale] ?? id.replace(/-/g, ' ')

// ── binder ─────────────────────────────────────────────────────────────
// ctx: { content, key, kind, block, fixture(변경 가능한 복사본), slot(id, n?) → 콘텐츠 경로|undefined, routes: { [pageId]: route }, locale, brandName: 콘텐츠 경로,
//        primaryCta(): { label?: ref, href: string|ref }|null }
// 돌려줌: props(바꾼 것) 또는 null(사실을 묶을 자료가 없다 — 섹션을 그리지 않는다).
const arr = (v) => (Array.isArray(v) ? v : [])

/** 쓸 수 있는 글자 값: 비어 있지 않고 「확인 필요」 자리 표시도 아니다(FIT-7). */
export const usableText = (v) => typeof v === 'string' && v.trim() !== '' && !isNeedsCheck(v)
/** 행동(버튼·링크)이 가는 곳이 비었는가: 콘텐츠 값을 가리키는 $ref 인데 그 값이 없거나 「확인 필요」(FIT-7 — 대상 없는 tel:·mailto: 버튼을 남기지 않는다). */
export const refTargetMissing = (content, href) => { if (!isRef(href)) return false; const v = at(content, href.$ref); return v !== undefined && !usableText(v) } // 값이 아예 없는 $ref 는 resolveRefs 가 이름을 붙여 던진다 — 여기서는 값이 있는데 비었거나 「확인 필요」인 것만

/** 슬롯 문구가 있으면 그 경로의 ref, 없으면 undefined. */
const slotRef = (ctx, ...ids) => {
  for (const id of ids) { const p = ctx.slot(id); if (p) return ref(p) }
  return undefined
}

/**
 * 보조 버튼이 가는 곳(FINAL-WF2 AB14): 글(04 문구 칸)이 말하는 행동과 도착지가 같은 근거에서 나온다 — 「메일로 문의」는 메일 링크, 「전화」는 tel 링크, 「요금제」는 요금제 쪽.
 * 글이 어느 쪽도 가리키지 않으면 예전 그대로(ctx.secondaryHref). 쓸 수 있는 메일·전화 값이 콘텐츠에 없으면 그 행동을 지어내지 않고 예전 그대로다.
 */
const MAIL_PATHS = ['business.email', 'organization.email', 'contact.email', 'facts.email', 'agency.email']
const PHONE_PATHS = ['business.phone', 'organization.phone', 'agency.mainPhone', 'facts.phone']
// 영어 사이트(FINAL-WF4 EN4·EN5): 글이 말하는 곳을 못 찾으면 예전처럼 요금제 쪽으로 보내지 않는다 — 「See how reminders work」가 /pricing 으로 가던 길.
// 기능·작동 방식을 말하는 글은 같은 사이트의 기능 구획(ctx.featuresHref), 소개를 말하는 글은 소개 쪽으로 가고, 맞는 곳이 없으면 null(호출하는 쪽이 버튼을 뺀다). 한국어 사이트는 예전 그대로다.
const EN_FEATURES_TEXT = /\bhow\b[^.]*\bwork|\bin action\b|\bfeatures?\b|\blearn more\b|\bsee (?:it|what|the details)\b|\bexplore\b|\btour\b|\bfind out\b/i
const EN_ABOUT_TEXT = /\babout\b|\bour (?:story|team|mission)\b|\bwho we are\b/i
export function secondaryDest(ctx, labelRef) {
  const fallback = ctx.secondaryHref?.() ?? '#'
  const en = ctx.locale === 'en'
  const text = isRef(labelRef) ? at(ctx.content, labelRef.$ref) : labelRef
  if (typeof text !== 'string') return en ? null : fallback
  const usable = (paths) => paths.find((p) => { const v = at(ctx.content, p); return typeof v === 'string' && v.trim() !== '' && !isNeedsCheck(v) })
  if (/메일|이메일|e-?mail/i.test(text)) { const m = usable(MAIL_PATHS); if (m) return ref(m, { as: 'mailto' }) }
  if (/전화|통화|\bcall\b|\bphone\b/i.test(text)) { const t = usable(PHONE_PATHS); if (t) return ref(t, { as: 'tel' }) }
  if (/요금|가격|\bpricing\b|\bplans?\b/i.test(text) && ctx.routes?.pricing) return ctx.routes.pricing
  if (!en) return fallback
  if (/\b(?:write|message|contact|reach)\b/i.test(text)) { const m = usable(MAIL_PATHS); if (m) return ref(m, { as: 'mailto' }) }
  if (EN_FEATURES_TEXT.test(text)) { const f = ctx.featuresHref?.(); if (f) return f }
  if (EN_ABOUT_TEXT.test(text) && ctx.routes?.about) return ctx.routes.about
  return null
}

/** 보조 버튼 하나를 묶는다: 가는 곳이 있으면 { …기존, label, href }, 없으면(영어 사이트) 선택 칸은 빼고 필수 칸이면 예전 도착지로 둔다. */
function bindSecondary(ctx, p, c, key, secondary) {
  const dest = secondaryDest(ctx, secondary)
  if (dest !== null) { c[key] = { ...c[key], label: secondary, href: dest }; return }
  if (!ctx.drop(p, `copy.${key}`)) c[key] = { ...c[key], label: secondary, href: ctx.secondaryHref?.() ?? '#' }
}

/** 문구 칸 없는 버튼의 { label, href }: 가는 곳의 이름표(CTA_UI) → 없으면 콘텐츠 바로가기(quickLinks)의 첫 항목(공공 — 원형의 「바로가기 1개」) → 없으면 null. */
function generatedCta(ctx, cta) {
  const kind = ctaKindOf(ctx, cta.href)
  if (kind) return { label: CTA_UI[ctx.locale === 'en' ? 'en' : 'ko'][kind], href: cta.href }
  const ok = (v) => typeof v === 'string' && v.trim() !== '' && !isNeedsCheck(v)
  const ql = arr(at(ctx.content, 'quickLinks')).findIndex((l) => isObj(l) && ok(l.label) && ok(l.href))
  return ql >= 0 ? { label: ref(`quickLinks.${ql}.label`), href: ref(`quickLinks.${ql}.href`) } : null
}

/** 주 행동 버튼이 가는 곳의 종류 — 가입·전화·문의(예약 값)·요금제·상품 목록. 갈 곳이 정해지지 않았으면(href '#') null. */
function ctaKindOf(ctx, href) {
  if (isRef(href)) return href.as === 'tel' ? 'tel' : 'contact'
  const r = ctx.routes ?? {}
  if (href && href === r.signup) return 'signup'
  if (href && href === r.pricing) return 'pricing'
  if (href && href === r['category-list']) return 'products'
  if (href && href === r.about) return 'about'
  return null
}

// 부제 칸이 없는 첫 화면의 lede 를 채울 04 문구 칸 id(앞 것이 먼저) — 이 사업이 무엇인지 말하는 문단이다.
export const LEDE_SLOTS = ['summary', 'tileBody', 'body', 'lead', 'text', 'origin']
const SERVICE_ICONS = ['file', 'home', 'calendar', 'user', 'map', 'download']
const MAX_SERVICE_TILES = 8
function bindHero(ctx) {
  const p = ctx.fixture
  const headline = slotRef(ctx, 'headline', 'tagline', 'title', 'h1') // h1: portfolio 첫 화면(statement)의 한 문장 칸 — 이 칸을 못 읽어 예시 제목(「Loud ideas…」)이 그대로 나갔다(EXLEAK)
  const c = p.copy ?? {}
  if (headline) {
    if (typeof c.title === 'string') c.title = headline
    if (Array.isArray(c.titleLines)) c.titleLines = typeof c.titleLines[0] === 'object' ? [{ ...c.titleLines[0], text: headline }] : [headline]
    if (Array.isArray(c.lines) && typeof c.lines[0] === 'string') c.lines = [headline]
  }
  const sub = slotRef(ctx, 'subhead', 'lede', 'oneLiner') // oneLiner: 공공 히어로의 한 줄 설명 칸(예시 부제 「주민 등본부터 건축 서류까지…」가 그대로 나가던 길, C299)
  if (sub && typeof c.lede === 'string') c.lede = sub
  // 문단 목록(banded-full-bleed — C393): 예시의 짧은 문단들은 이 사업의 글이 아니다. 부제 문구 칸이 있으면 그것 하나, 없으면 문단 없이(제목 + 버튼) — 지어내지 않는다.
  // portfolio 만 묶는다: brand·commerce·local 은 예전부터 이 칸이 구조상 누설로 남아(stamp-variants-leak.test.mjs) 03 이 이 변형을 뒤로 미룬다 — 거기까지 묶으면 한국어 사이트의 03 고름이 바뀐다.
  if (ctx.content?.archetype === 'portfolio' && Array.isArray(c.paragraphs) && c.paragraphs.every((x) => typeof x === 'string')) c.paragraphs = sub ? [sub] : []
  // 문구 칸(부제)이 없는 원형(brand·commerce 의 첫 화면 칸은 제목 하나뿐)이 필수 lede 가 있는 모션 히어로(kinetic-type-video·ken-burns-stills)를 고르면
  // 블록 예시 문단(「… 모든 문구는 예시입니다」)이 남아 06 이 늘 오일 프레임으로 폴백했다(SHOWA, v0.0.9 시안 촬영에서 발견). 같은 사이트 04 문구 중 이 사업을 한 문단으로 말하는 칸(LEDE_SLOTS)으로 채운다 — 04 가 쓴 글이라 지어내지 않는다.
  if (!sub && typeof c.lede === 'string') {
    const alt = LEDE_SLOTS.map((id) => ctx.slotAnyId?.(id)).find(Boolean)
    if (alt) c.lede = ref(alt)
  }
  // QFIX3 첫 가격이 히어로 제목에 있으면(commerce 「상품 + 가격」) 그 구획 안에 총액·부가세 한 줄이 있어야 한다(marketing total-first-screen — 첫 가격 구획에 총액 문구가 없고
  // 배송비가 구획 밖에서 처음 나오던 길). 상품 목록 머리말과 같은 문장(금액은 쓰지 않는다)을 lede 뒤에 template 으로 붙인다 — 원문은 $ref 그대로라 04 문구를 고치면 같이 바뀐다.
  if (ctx.content?.archetype === 'commerce' && isRef(c.lede)) {
    const titleText = isRef(c.title) ? at(ctx.content, c.title.$ref) : c.title
    const ledeText = at(ctx.content, c.lede.$ref)
    const fee = at(ctx.content, 'shipping.fee')
    const ui = PRICE_NOTE_UI[ctx.locale === 'en' ? 'en' : 'ko']
    const lines = [typeof fee === 'number' ? (fee > 0 ? ui.totalWithShipping : ui.totalNoShipping) : null, vatText(ctx)].filter(Boolean)
    if (typeof titleText === 'string' && PRICE_TEXT.test(titleText) && typeof ledeText === 'string' && lines.length) {
      c.lede = { ...c.lede, template: `{}${/[.!?。]$/.test(ledeText.trim()) ? ' ' : '. '}${lines.join('. ')}.` }
    }
  }
  const cta = ctx.primaryCta()
  // QFIX2 [5] 문의 메일로 가는 주 버튼(portfolio): 글은 04 가 쓴 협업 제안 칸(cta) — 이 원형엔 primaryCta 칸이 없어 같은 사이트의 cta 칸을 쓴다
  const toMail = isRef(cta?.href) && cta.href.as === 'mailto'
  const primary = slotRef(ctx, 'primaryCta') ?? (toMail && ctx.slotAnyId?.('cta') ? ref(ctx.slotAnyId('cta')) : undefined)
  // 주 버튼 글(문구 칸)이 「확인 필요」이거나 가는 곳(예약 수단 값)이 비었으면 이 버튼은 눌러도 갈 곳이 없다(FIT-7, W1b C4): 선택 칸이면 그리지 않고,
  // 필수 칸이면 이 변형을 쓰지 않는다(null — 03·06 폴백이 버튼 없는 변형으로 바꾼다). 까닭은 「확인 필요 사실」이 따로 남기므로 품질 사유로 또 세지 않는다(inputWait).
  const hrefDead = !!cta && refTargetMissing(ctx.content, cta.href)
  const labelDead = refTargetMissing(ctx.content, primary) // 글 칸(slots.copy.N.text)이 「확인 필요」
  let blockedByDeadButton = false
  const dropDead = (key, dead) => {
    if (!dead || !isObj(c[key])) return false
    if (!ctx.drop(p, `copy.${key}`)) { ctx.why = '예약 수단(전화번호)이 아직 없어(확인 필요) 이 변형의 필수 버튼이 갈 곳이 없다 — 번호는 「확인 필요 사실」로 따로 막는다'; ctx.inputWait = true; blockedByDeadButton = true }
    return true
  }
  if (dropDead('primaryCta', hrefDead || labelDead)) { /* 갈 곳 없는 주 버튼을 뺐다 */ }
  else if (isObj(c.primaryCta) && primary && cta) c.primaryCta = { ...c.primaryCta, label: primary, href: cta.href }
  else if (isObj(c.primaryCta) && !primary && cta) {
    // 문구 칸이 없는 원형: 버튼이 가는 곳의 이름표(CTA_UI)로 쓴다. 갈 곳이 없으면 선택 칸은 빼고, 필수 칸이면 예시 글이 남아 06 이 「예시 문구 남음」(leak)으로 낸다.
    const g = generatedCta(ctx, cta)
    if (g) c.primaryCta = { ...c.primaryCta, ...g }
    else ctx.drop(p, 'copy.primaryCta')
  }
  // 한 낱말 히어로(grid-lines-baseline-word)의 필수 버튼 filmCta(예시 「숲 소리 듣기」)도 같은 길이다 — 이 블록은 주 버튼 칸이 없다.
  if (dropDead('filmCta', hrefDead)) { /* 갈 곳 없는 버튼을 뺐다 */ }
  else if (isObj(c.filmCta) && cta) {
    const g = generatedCta(ctx, cta)
    if (g) c.filmCta = { ...c.filmCta, ...g }
    else ctx.drop(p, 'copy.filmCta')
  }
  if (blockedByDeadButton) return null
  const secondary = slotRef(ctx, 'secondaryCta')
  if (isObj(c.secondaryCta)) {
    if (secondary) bindSecondary(ctx, p, c, 'secondaryCta', secondary)
    else ctx.drop(p, "copy.secondaryCta")
  }
  // 장면 이름(vertical-title-slides): 예시의 「해 질 녘 마당」 같은 장면 이름은 이 사업의 장면이 아니다 — 콘텐츠에 장면 자료가 없으니 생성기가 갖는 UI 이름표(「첫째 장면」)로 바꾼다.
  // (예시 이름 스캔이 다른 블록 예시의 가상 이름 「솔바람」을 넓게 모으면서 「새벽 솔바람」이 예시 문구로 잡혀 이 변형이 늘 공개 불가로 떨어졌다 — 대장 C296 폴백 도착지)
  if (Array.isArray(c.slides) && c.slides.every((s) => typeof s === 'string')) c.slides = c.slides.map((_, i) => (ctx.locale === 'en' ? ['First', 'Second', 'Third', 'Fourth', 'Fifth'][i] ?? 'Next' : ['첫째', '둘째', '셋째', '넷째', '다섯째'][i] ?? '다음')) // 숫자는 예시 수치로 읽히니 서수 낱말로
  // 자주 찾는 서비스 칸(공공 히어로 crosshair-quadrants·identity-strip-banner, 대장 C299): 예시의 서비스 이름(주민 등본·전입 신고 …)은 이 기관의 서비스가 아니다 —
  // 표지·숫자가 없어 예시 표지 검사가 못 잡고 본문 바로가기 섹션과 겹쳐 그려졌다. 콘텐츠 바로가기(quickLinks)로만 잇고, 없으면 선택 칸은 빼고(그리지 않는다) 필수 칸이면 null
  // (다른 변형으로 폴백 · 「자료 연결 안 됨」). 아이콘은 이름표가 아니라 장식이라 차례로 돌려 쓴다(서비스의 뜻을 아이콘으로 짐작하지 않는다).
  if (isObj(c.services) && Array.isArray(c.services.items)) {
    const ok = (v) => typeof v === 'string' && v.trim() !== '' && !isNeedsCheck(v)
    const idx = arr(at(ctx.content, 'quickLinks')).map((l, i) => (isObj(l) && ok(l.label) && ok(l.href) ? i : -1)).filter((i) => i >= 0).slice(0, MAX_SERVICE_TILES)
    if (idx.length) c.services = { ...c.services, items: idx.map((i, n) => ({ label: ref(`quickLinks.${i}.label`), href: ref(`quickLinks.${i}.href`), icon: SERVICE_ICONS[n % SERVICE_ICONS.length] })) }
    else if (!ctx.drop(p, 'copy.services')) { ctx.why = '「자주 찾는 서비스」 칸을 채울 바로가기(quickLinks)가 콘텐츠에 없다 — 예시의 서비스 이름을 싣지 않는다'; return null }
  }
  // 캡션 줄(local 첫 화면): 오늘 시간·주소 줄
  if (Array.isArray(c.captionLines)) {
    const lines = [slotRef(ctx, 'todayHours'), slotRef(ctx, 'addressLine')].filter(Boolean)
    if (lines.length) c.captionLines = lines
  }
  // ── 히어로 6변형(FV1 Task 5.7) ── 제목·부제·버튼은 위 공통 길이 이미 묶었다. 아래는 새 변형이 더 가진 칸만 다룬다.
  const variant = String(ctx.block ?? '').replace(/^block-hero-/, '')
  const usable = (v) => typeof v === 'string' && v.trim() !== '' && !isNeedsCheck(v)
  if (variant === 'object-3d-orbit') {
    // 무대 이름은 상호로 만든다(예시의 「도자 그릇」은 이 사업의 오브젝트가 아니다). 정지 단추 이름은 생성기의 UI 이름표 — 모델이 올라왔을 때만 단추가 생긴다.
    // 모델·원본 이미지(model·media)는 여기서 잇지 않는다 — 05-media 의 manifest 를 06(site-media wireMedia)이 잇는다. 둘 다 없으면 03 이 이 변형을 고르지 않는다(object-media.mjs applyObjectReadiness).
    const brand = brandPathOf(ctx)
    if (brand && typeof c.stageLabel === 'string') c.stageLabel = ref(brand, { template: ctx.locale === 'en' ? '{} 3D scene' : '{} 3D 장면' })
    if ('pauseLabel' in c) c.pauseLabel = ctx.locale === 'en' ? 'Pause rotation' : '회전 멈추기'
    // 사진·모델이 아직 없으면(05 가 「실제 사진 필요」 자리를 남긴 칸) 빈 무대에 그 안내를 보인다 — 안내 없는 회색 빈칸을 그리지 않는다(FINAL-WF2 #27). 사진이 이어지면 이 글은 그려지지 않는다.
    if (isObj(c) && !('emptyLabel' in c)) c.emptyLabel = ctx.locale === 'en' ? 'Real photo needed' : '실제 사진 필요'
  }
  if (variant === 'map-first') {
    // 지점 표지는 콘텐츠의 상호·주소(hours-location 과 같은 자료)·전화·지도 링크에서만 온다. 지점이 하나라 표지는 지도 한가운데다(위치는 사실이 아니다).
    // 영업 시간은 이 변형이 그리지 않는다(같은 쪽 hours-location 이 맡는다). 주소가 없으면 지도에 놓을 곳이 없다.
    const base = ['business', 'agency'].find((b) => usable(at(ctx.content, `${b}.name`)) && usable(at(ctx.content, `${b}.address`)))
    if (!base) { ctx.why = '지도에 놓을 상호·주소(business 또는 agency 의 name·address)가 콘텐츠에 없다 — 지점을 지어내지 않는다'; return null }
    const phonePath = base === 'agency' ? 'agency.mainPhone' : 'business.phone'
    const maps = at(ctx.content, 'mapLinks')
    const href = usable(maps?.naver) ? ref('mapLinks.naver') : usable(maps?.kakao) ? ref('mapLinks.kakao') : null
    c.branches = [{ id: 'main', name: ref(`${base}.name`), address: ref(`${base}.address`), x: 50, y: 50, ...(usable(at(ctx.content, phonePath)) ? { phone: ref(phonePath) } : {}), ...(href ? { href } : {}) }]
  }
  if (variant === 'mascot-greeting') {
    // 캐릭터의 상표·저작권 확인 문구는 사실이다 — 콘텐츠에 그 자료 칸이 아직 없다. 확인했다고 지어내지 않고 이 변형을 쓰지 않는다(다른 변형으로 폴백).
    ctx.why = '캐릭터의 상표·저작권 확인 문구(rightsNote) 자료가 콘텐츠에 없다 — 확인했다고 지어내지 않는다'
    return null
  }
  return p
}

// QFIX [3] — 주제별 FAQ 의 질문 수 단위(「3개」)와 비교표의 화면 이름표. 사업을 주장하지 않는 낱말만.
export const FAQ_UI = { ko: { countUnit: '개' }, en: { countUnit: '' } }
export const COMPARE_UI = {
  ko: { title: '다른 방식과 비교', caption: '이 상품과 다른 방식을 비교한 표', criteriaLabel: '비교 기준', yesLabel: '있음', noLabel: '없음' },
  en: { title: 'Compared with another option', caption: 'A table comparing this product with another option', criteriaLabel: 'Criteria', yesLabel: 'Yes', noLabel: 'No' },
}

function bindFaq(ctx) {
  const faq = arr(at(ctx.content, 'faq'))
  if (!faq.length) { if (ctx.content.archetype === 'detail') ctx.why = '묻고 답한 질문(Q&A) 자료가 상세페이지 콘텐츠에 없다 — 질문을 지어내지 않는다'; return null }
  const p = ctx.fixture
  const items = faq.map((_, i) => ({ q: ref(`faq.${i}.q`), a: ref(`faq.${i}.a`) }))
  if (Array.isArray(p.copy?.items)) p.copy.items = items
  else if (Array.isArray(p.copy?.topics)) {
    // 주제별 묶음: 모든 질문에 주제(topic)가 적혀 있을 때만 — 처음 나온 순서로 같은 주제를 한 칸에 모은다(QFIX [3]). 주제 이름을 지어내지 않는다.
    const topicOf = (x) => (isObj(x) && typeof x.topic === 'string' && x.topic.trim() ? x.topic.trim() : null)
    if (faq.some((x) => topicOf(x) === null)) { ctx.why = '모든 질문에 주제(topic)가 적혀 있지 않다 — 주제 이름을 지어내지 않는다'; return null }
    const first = new Map()
    faq.forEach((x, i) => { const t = topicOf(x); if (!first.has(t)) first.set(t, i) })
    p.copy.topics = [...first].map(([t, i]) => ({ name: ref(`faq.${i}.topic`), items: faq.flatMap((x, j) => (topicOf(x) === t ? [items[j]] : [])) }))
    if (typeof p.copy.countUnit === 'string') p.copy.countUnit = FAQ_UI[ctx.locale === 'en' ? 'en' : 'ko'].countUnit // 예시의 「개」는 한국어 단위다
  } else return null
  return p
}

/**
 * 콘텐츠 요금제 → 주소에 싣는 요금제 id: 콘텐츠가 id 를 주면 그것, 아니면 이름의 영문 낱말(「Pro」→ pro), 한글 이름처럼 만들 수 없으면 plan-<순서 글자>(a, b …).
 * 같은 id 는 순서 글자를 붙여 가른다. 숫자는 쓰지 않는다 — 숫자가 든 literal 은 예시 수치로 읽혀 「예시 문구 남음」이 된다(exampleIssues digits).
 */
export function planIdsOf(plans) {
  const seen = new Map()
  const letter = (i) => String.fromCharCode(97 + (i % 26))
  return plans.map((pl, i) => {
    const raw = typeof pl?.id === 'string' && pl.id.trim() ? pl.id : typeof pl?.name === 'string' ? pl.name : ''
    const base = String(raw).toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-+|-+$/g, '') || `plan-${letter(i)}`
    const n = seen.get(base) ?? 0
    seen.set(base, n + 1)
    return n === 0 ? base : `${base}-${letter(n)}`
  })
}

function bindPricing(ctx) {
  const plans = arr(at(ctx.content, 'plans'))
  if (!plans.length || !Array.isArray(ctx.fixture.copy?.plans)) return null
  const p = ctx.fixture
  const shape = p.copy.plans[0] ?? {}
  if ('annualMonthlyPrice' in shape || 'annualPrice' in shape) return null // 연 결제 가격 변형은 그 값의 콘텐츠 칸이 없다
  const matrix = Array.isArray(p.copy.features) // 기능 × 요금제 표(feature-matrix): 행 = 요금제들의 포함 기능 합집합
  // 월·연 전환 변형(toggle-annual)은 연 결제 할인율(copy.annualDiscount — 블록 예시 0.2)로 연 금액을 계산해 보인다. 콘텐츠 plans 에는 연 가격·할인율 칸이 없어
  // 예시의 20% 가 그대로 나갔다(C359 — 연 결제를 팔지 않는 요금제에 「연 ○○원 한 번에」). 사실이 없는 값은 지어내지 않는다 — 묶지 않고 다른 변형(월 가격 줄)으로 폴백한다.
  if ('annualDiscount' in p.copy) { ctx.why = '연 결제 할인율·연 가격이 콘텐츠(plans)에 없다 — 연 결제를 지어내지 않는다'; return null }
  // 가격 칸 이름은 원형 콘텐츠 스키마가 정한다 — saas 는 `monthlyPrice`(월 가격), landing 은 `price`(참가권·이용권 1회 가격).
  // 블록 props 이름은 `monthlyPrice` 그대로다(null = 문의형, 0 = 무료를 블록이 그린다).
  const priceKey = ctx.content.archetype === 'landing' ? 'price' : 'monthlyPrice'
  if (priceKey === 'price' && typeof p.copy.perMonth === 'string') p.copy.perMonth = '' // 1회 가격에 「/월」을 붙이지 않는다
  p.copy.plans = plans.map((pl, i) => ({
    name: ref(`plans.${i}.name`),
    monthlyPrice: ref(`plans.${i}.${priceKey}`),
    currency: ref(`plans.${i}.currency`),
    ...(typeof pl.vatIncluded === 'boolean' ? { vatIncluded: ref(`plans.${i}.vatIncluded`) } : {}), // 세금 표기(요금표가 「부가세 포함/별도」를 그린다)
    features: arr(pl.features).map((_, j) => ref(`plans.${i}.features.${j}`)),
  }))
  // 요금제 id(FINAL-WF4 EN6): 예시의 planIds(「starter」·「team」·「multi」)는 이 사업의 요금제가 아니다 — 가입 주소의 ?plan= 이 콘텐츠 요금제(Free·Pro)와 어긋났다. 콘텐츠 요금제 순서대로 id 를 만든다.
  if (Array.isArray(p.copy.planIds)) p.copy.planIds = planIdsOf(plans)
  if (matrix) {
    // 표의 행: 모든 요금제의 포함 기능을 첫 등장 순서로, 같은 글은 한 행(칸 값은 요금제 features 안의 같은 글자를 찾는다). 첫 등장 자리를 $ref 로 가리킨다.
    const rows = new Map()
    plans.forEach((pl, i) => arr(pl.features).forEach((f, j) => { if (typeof f === 'string' && !rows.has(f)) rows.set(f, ref(`plans.${i}.features.${j}`)) }))
    if (!rows.size) { ctx.why = '요금제에 포함 기능 목록이 없어 기능 표의 행을 만들 수 없다'; return null }
    p.copy.features = [...rows.values()]
    if (typeof p.copy.caption === 'string') p.copy.caption = PRICING_UI[ctx.locale === 'en' ? 'en' : 'ko'].matrixCaption // 예시 캡션의 「세 가지」는 요금제 수를 주장한다
  }
  if (!ctx.drop(p, "copy.recommended")) return null // 어느 요금제를 추천할지는 콘텐츠가 정하지 않았다
  const cta = ctx.primaryCta()
  if (cta && isObj(p.copy.cta)) p.copy.cta = { ...p.copy.cta, href: cta.href }
  if (isObj(p.copy.cta)) {
    const ui = PRICING_UI[ctx.locale === 'en' ? 'en' : 'ko']
    const prices = plans.map((pl) => pl[priceKey])
    p.copy.planCtas = prices.map((price) => ({ label: price === 0 ? ui.ctaFree : price == null ? ui.ctaContact : ui.ctaPaid, href: p.copy.cta.href }))
    if (prices.every((price) => typeof price === 'number' && price > 0)) p.copy.cta = { ...p.copy.cta, label: ui.ctaPaid }
  }
  return p
}

// 특징·단계 항목의 출처(C5 자료 연결, 5.11): ① 구조 칸 — saas workflowSteps · landing features({ title, body }) ② 04 가 항목마다 쓴 문구 칸 쌍 —
// landing featureTitle/featureBody · brand tileTitle/tileBody(같은 칸 id 를 항목 수만큼 쓴다). saas 의 stepTitle/stepBody 는 「단계 전체의 제목 하나」라 항목이 아니다(COPY.md).
const FEATURE_SLOT_PAIRS = [['featureTitle', 'featureBody'], ['tileTitle', 'tileBody']]
function featureItems(ctx) {
  for (const root of ['workflowSteps', 'features']) {
    const list = arr(at(ctx.content, root))
    if (list.length && list.every((x) => isObj(x) && typeof x.title === 'string' && typeof x.body === 'string')) return list.map((_, i) => ({ title: ref(`${root}.${i}.title`), body: ref(`${root}.${i}.body`) }))
  }
  for (const [titleId, bodyId] of FEATURE_SLOT_PAIRS) {
    const rows = []
    for (let n = 0; ; n++) { const tp = ctx.slot(titleId, n); const bp = ctx.slot(bodyId, n); if (!tp || !bp) break; rows.push({ title: ref(tp), body: ref(bp) }) }
    if (rows.length) return rows
  }
  return []
}

function bindFeatures(ctx) {
  const c = ctx.fixture.copy ?? {}
  if (Array.isArray(c.rows) && Array.isArray(c.them)) {
    // 비교표(QFIX [3]): 콘텐츠 compare(우리 이름·다른 방식 이름·줄마다 기준/우리/다른 방식 값)가 있을 때만 — 비교 값을 지어내지 않는다. 다른 방식은 하나(그 이름 열 하나).
    const cmp = at(ctx.content, 'compare')
    const rows = isObj(cmp) ? arr(cmp.rows) : []
    if (!rows.length || typeof cmp.usLabel !== 'string' || typeof cmp.themLabel !== 'string') { ctx.why = '비교표(우리 대 다른 방식)에 쓸 「다른 방식」 자료가 콘텐츠에 없다 — 비교 값을 지어내지 않는다'; return null }
    const u = COMPARE_UI[ctx.locale === 'en' ? 'en' : 'ko']
    c.title = u.title
    c.caption = u.caption
    c.criteriaLabel = u.criteriaLabel
    c.yesLabel = u.yesLabel
    c.noLabel = u.noLabel
    c.us = ref('compare.usLabel')
    c.them = [ref('compare.themLabel')]
    c.rows = rows.map((_, i) => ({ label: ref(`compare.rows.${i}.label`), us: ref(`compare.rows.${i}.us`), them: [ref(`compare.rows.${i}.them`)] }))
    ctx.drop(ctx.fixture, 'copy.lead') // 예시의 머리말·각주는 다른 사업의 글이다
    ctx.drop(ctx.fixture, 'copy.footnote')
    return ctx.fixture
  }
  const items = featureItems(ctx)
  if (!items.length) { ctx.why = '특징·단계 항목(콘텐츠 workflowSteps·features 또는 항목마다 쓴 문구 칸)이 없다'; return null }
  if (Array.isArray(c.steps)) c.steps = items
  else if (Array.isArray(c.cells)) c.cells = items // 벤토 칸: 예시의 큰 수치(stat)는 싣지 않는다 — 칸마다 제목·본문만
  else return null
  if (typeof c.title === 'string') c.title = FEATURES_UI[ctx.locale === 'en' ? 'en' : 'ko'].title // 예시 제목의 단계 수 주장(「세 단계면…」)을 싣지 않는다
  return ctx.fixture
}

// 사회적 증거: ① 후기 벽·휩 후기 — 콘텐츠 testimonials 의 실명·직함·소속과 후기 본문. 후기 본문 칸(quote)이 없는 원형(saas: 실명·직함·소속·「구체 결과」만)은 구체 결과 글을 본문으로 쓴다
// (스키마가 말하는 후기 = 이름 붙은 사람의 구체 결과다). 별도 결과 줄(result)은 본문이 따로 있을 때만. ② 로고 줄 — 로고 이름(clients)이 없어도 「참인 규모」 한 줄(claim)이 있으면 그것만 그린다.
function bindSocialProof(ctx) {
  const t = arr(at(ctx.content, 'testimonials'))
  const p = ctx.fixture
  if (Array.isArray(p.copy?.quotes)) {
    const body = (x) => (typeof x?.quote === 'string' ? 'quote' : typeof x?.result === 'string' ? 'result' : null)
    if (!t.length || !t.every((x) => body(x) && ['name', 'title', 'company'].every((k) => typeof x[k] === 'string'))) return null
    p.copy.quotes = t.map((x, i) => {
      const f = body(x)
      return { quote: ref(`testimonials.${i}.${f}`), name: ref(`testimonials.${i}.name`), title: ref(`testimonials.${i}.title`), company: ref(`testimonials.${i}.company`), ...(f === 'quote' && x.result ? { result: ref(`testimonials.${i}.result`) } : {}) }
    })
    return p
  }
  if (Array.isArray(p.copy?.logos)) {
    // 근거 한 줄만으로 그리는 것은 landing 뿐이다 — landing 의 claim 칸 역할이 「참인 신청자 수·참여 기관 수·지난 행사 규모(기준일)」, 곧 그 자체가 증거다(원형 JSON).
    // saas 등의 claim 은 제품 약속 문장일 수 있어 증거 칸에 싣지 않는다(후기·고객 로고가 있어야 한다). 자리 표시(「확인 필요」)도 증거가 아니다.
    // QFIX [1] — 수상·인증(recognition)·고객(client-roster) 섹션은 04 가 쓴 문구 칸(award: 발급 기관·연도가 붙은 수상·인증 / client: 고객 이름 글자)이 그 자체로 증거 한 줄이다
    // (원형 JSON 의 칸 역할이 증거다 — 제품 약속일 수 있는 saas claim 과 다르다). brand·portfolio 는 로고 이름 칸(clients)이 스키마에 없어 이 한 줄만 그린다.
    const sectionKind = String(ctx.key).split('/')[1]
    const evidenceId = ctx.content.archetype === 'landing' ? 'claim' : EVIDENCE_SLOT[sectionKind]
    const claimPath = evidenceId ? ctx.slot(evidenceId) : undefined
    const claimText = claimPath ? at(ctx.content, claimPath) : undefined
    const claim = evidenceId && typeof claimText === 'string' && claimText.trim() !== '' && !isNeedsCheck(claimText) ? claimPath : undefined
    const clients = arr(at(ctx.content, 'clients')).filter((x) => isObj(x) && typeof x.name === 'string')
    if (!claim && !clients.length) { ctx.why = EVIDENCE_SLOT[sectionKind] ? `이 섹션의 증거 한 줄(문구 칸 ${EVIDENCE_SLOT[sectionKind]}: ${sectionKind === 'recognition' ? '수상·인증 이름과 연도' : '고객 이름'})이 콘텐츠에 없다` : '고객 로고 이름도, 증거가 되는 근거 한 줄(landing 문구 칸 claim)도 콘텐츠에 없다'; return null }
    p.copy.logos = clients.map((_, i) => ({ name: ref(`clients.${i}.name`) }))
    if (claim) p.copy.claim = ref(claim)
    else ctx.drop(p, 'copy.claim')
    const ui = PROOF_UI[ctx.locale === 'en' ? 'en' : 'ko']
    if (typeof p.copy.title === 'string') p.copy.title = (sectionKind === 'recognition' && ui.recognitionTitle) || (sectionKind === 'client-roster' && ui.clientsTitle) || ui.proofTitle // 「이런 곳이 씁니다」는 로고가 있다는 주장이다
    return p
  }
  return null
}

function bindIntegrations(ctx) {
  const items = arr(at(ctx.content, 'integrations'))
  const p = ctx.fixture
  if (!items.length) return null
  const one = (i) => ({ name: ref(`integrations.${i}.name`), url: ref(`integrations.${i}.url`), kind: ref(`integrations.${i}.kind`) })
  if (Array.isArray(p.copy?.items)) { p.copy.items = items.map((_, i) => one(i)); return p }
  return null // 분류 탭 변형은 분류 이름이 필요하다
}

function bindFinalCta(ctx) {
  const p = ctx.fixture
  const c = p.copy ?? {}
  // 이 섹션에 문구 칸이 없으면(캠페인 쪽 등) 같은 사이트의 다른 마지막 행동 띠 문구를 쓴다 — 같은 행동을 다시 권한다
  const own = (...ids) => slotRef(ctx, ...ids) ?? ids.map((id) => ctx.slotAny?.('final-cta', id)).filter(Boolean).map((r) => ref(r))[0]
  const title = own('headline', 'title')
  if (title && typeof c.title === 'string') c.title = title
  const cta = ctx.primaryCta()
  const primary = own('primaryCta')
  if (isObj(c.primary) && primary && cta) c.primary = { ...c.primary, label: primary, href: cta.href }
  const secondary = own('secondaryCta')
  if (isObj(c.secondary)) {
    if (secondary) bindSecondary(ctx, p, c, 'secondary', secondary)
    else ctx.drop(p, "copy.secondary")
  }
  if (!title || !primary) return null // 제목·주 행동 문구가 콘텐츠에 없으면 예시 문구로 채우지 않는다
  return p
}

// QFIX2 [6] 제품 푸터(footer/product-legal): 사업자 정보는 copy.business 가 아니라 최상위 `business` 칸이고 8칸 모두 선택이다. 예전에는 이 칸을 몰라 사실이 있는데도 못 그렸고(사업자 정보 표시 없음)
// 블록 예시 값(Example Owner 등)이 남았으며 한국어 사이트에 영어 이름표가 나갔다. 사실이 있는 칸만 콘텐츠 $ref 로 잇고, 사실이 없는 칸(호스팅 업체)은 뺀다.
// 전자상거래법 제10조 표시를 해야 하는 사이트(콘텐츠 business 가 있다)인데 둘 이상 못 그리면 이 변형을 쓰지 않는다(null → 06 이 다른 푸터 변형으로 폴백).
export const PRODUCT_LEGAL_UI = {
  ko: { navLabel: '약관과 지원', links: { terms: '이용약관', privacy: '개인정보 처리방침', refund: '환불 정책', contact: '문의하기' }, cookieSettings: '쿠키 설정', businessTitle: '사업자 정보', labels: { name: '상호', owner: '대표자', address: '주소', phone: '전화', email: '이메일', registrationNo: '사업자등록번호', mailOrderNo: '통신판매업 신고번호', hostingProvider: '호스팅 서비스 제공자' } },
  en: { navLabel: 'Legal and support', links: { terms: 'Terms of Service', privacy: 'Privacy Policy', refund: 'Refund Policy', contact: 'Contact' }, cookieSettings: 'Cookie settings', businessTitle: 'Business information', labels: { name: 'Company', owner: 'Representative', address: 'Address', phone: 'Phone', email: 'Email', registrationNo: 'Business registration no.', mailOrderNo: 'Mail-order business no.', hostingProvider: 'Hosting provider' } },
}
export const KOREA_ONLY_BUSINESS_FIELDS = new Set(['registrationNo', 'mailOrderNo'])
const PRODUCT_LEGAL_FIELDS = { owner: 'representative', address: 'address', phone: 'phone', email: 'email', registrationNo: 'bizRegNo', mailOrderNo: 'mailOrderNo' }
function productLegalBusiness(ctx, p, c, { biz, base, namePath }) {
  const ui = PRODUCT_LEGAL_UI[ctx.locale === 'en' ? 'en' : 'ko']
  const next = { name: ref(namePath) }
  for (const [key, src0] of Object.entries(PRODUCT_LEGAL_FIELDS)) {
    if (ctx.locale === 'en' && KOREA_ONLY_BUSINESS_FIELDS.has(key)) continue // 사업자등록번호·통신판매업 번호는 한국 전용 칸 — 영어 사이트 푸터에 싣지 않는다(FINAL-WF4 EN10)
    const src = base === 'agency' && src0 === 'phone' ? 'mainPhone' : src0
    if (isObj(biz) && typeof biz[src] === 'string' && biz[src].trim() !== '') next[key] = ref(`${base}.${src}`)
  }
  if (!next.email && typeof at(ctx.content, 'contact.email') === 'string') next.email = ref('contact.email')
  if (isObj(at(ctx.content, 'business')) && Object.keys(next).length - 1 < 2) { ctx.why = '사업자 정보를 둘 이상 그릴 수 없다 — 전자상거래법 제10조 표시를 할 수 없는 푸터는 쓰지 않는다'; return false }
  p.business = next
  c.navLabel = ui.navLabel
  c.businessTitle = ui.businessTitle
  c.businessLabels = { ...ui.labels }
  if (isObj(c.links)) {
    const routes = ctx.routes ?? {}
    c.links = Object.fromEntries(Object.entries(ui.links).filter(([k]) => routes[k]).map(([k, label]) => [k, { label, href: routes[k] }]))
  }
  if (isObj(c.cookieSettings)) c.cookieSettings = { ...c.cookieSettings, label: ui.cookieSettings }
  return true
}

function bindFooter(ctx) {
  const p = ctx.fixture
  const c = p.copy ?? {}
  const biz = at(ctx.content, 'business') ?? at(ctx.content, 'organization') ?? at(ctx.content, 'agency')
  // 회사 정보 칸이 없는 원형(portfolio·pwa·dashboard — brief.mjs factPath 가 이름을 facts 에 둔다)은 이름(facts.name·manifest.name)과 portfolio 의 문의 메일(contact.email)만 잇는다(5.11).
  const fallbackName = isObj(biz) ? null : brandPathOf(ctx)
  if (!isObj(biz) && !fallbackName) return null
  const base = at(ctx.content, 'business') ? 'business' : at(ctx.content, 'organization') ? 'organization' : 'agency'
  const namePath = fallbackName ?? `${base}.name`
  if (typeof c.brand === 'string') c.brand = ref(namePath)
  if (typeof c.title === 'string' && 'lead' in c) { /* stacked-legal: 제목은 이름표 */ }
  if (String(ctx.block).endsWith('-product-legal') && !productLegalBusiness(ctx, p, c, { biz, base, namePath })) return null
  if (isObj(c.business)) {
    const next = {}
    // 공공 기관 정보(agency)는 대표전화 칸 이름이 mainPhone 이다 — 사업자 정보 줄의 phone 으로 잇는다(빠지면 business-info 가 전화 없이 normalizePhone 을 불러 빌드가 멈췄다, 레인 CONTENT 골든 public-1)
    const alias = base === 'agency' ? { phone: 'mainPhone' } : {}
    if (fallbackName) {
      for (const k of Object.keys(c.business)) { if (k === 'name') next.name = ref(fallbackName); else if (k === 'email' && typeof at(ctx.content, 'contact.email') === 'string') next.email = ref('contact.email') }
    } else for (const k of Object.keys(c.business)) {
      const src = alias[k] ?? k
      if (ctx.locale === 'en' && (KOREA_ONLY_BUSINESS_FIELDS.has(k) || k === 'bizRegNo' || k === 'ftcLookupUrl')) continue // 한국 전용 칸(사업자등록번호·통신판매업 번호·공정위 조회) — 영어 사이트 푸터에 싣지 않는다(FINAL-WF4 EN10)
      // 값이 자리표시(「확인 필요」)인 바깥 링크(공정위 조회 주소 등)는 링크를 그리지 않는다(FINAL-WF2 AB13) — 「확인 필요 사실」 사유는 그대로 남는다. 약관·처리방침 주소는 06 이 이 사이트의 쪽으로 잇는다(ownPolicyLinks)
      if (/Url$/.test(k) && !/^(?:terms|privacy)Url$/.test(k) && typeof biz[src] === 'string' && isNeedsCheck(biz[src])) continue
      if (biz[src] !== undefined) next[k] = ref(`${base}.${src}`)
    }
    if (!next.name) return null
    c.business = next
  }
  ctx.drop(p, "copy.tagline")
  // 저작권 줄은 이름표(© 연도)와 콘텐츠 상호를 합친 파생 값이다 — 상호는 $ref 로 잇고 앞뒤 글자만 템플릿에 둔다
  if (typeof c.copyright === 'string') c.copyright = ref(namePath, { template: `© ${new Date().getFullYear()} {}` })
  const links = ctx.navLinks()
  if (Array.isArray(c.columns)) c.columns = [{ title: ctx.locale === 'ko' ? '바로가기' : 'Pages', links }]
  if (Array.isArray(c.links)) c.links = links
  return p
}

// QFIX [1] — 하단 탭(icon-tabs): 탭은 이 사이트의 최상위 목적지다. 하위 화면·오프라인·완료 화면·법정 쪽·가입류 쪽은 목적지가 아니다.
// pwa 원형 조건: 「최상위 목적지 3~5개일 때」만 둔다(그림 줄이 2개 탭이면 상단 이동으로 충분하다) — 모자라면 선택 섹션을 뺀다(omit). 아이콘은 이름표가 아니라 장식이라
// 쪽 뜻이 아는 것(홈·설정·검색 …)은 맞는 그림, 모르는 것은 겹치지 않게 돌려 쓴다(SERVICE_ICONS 와 같은 원칙).
const TAB_NOT_DESTINATION = new Set(['sub-detail', 'detail', 'offline', 'completion', 'done', 'signup', 'login', 'onboarding', 'account', 'billing', 'cancel', 'booking-complete', 'privacy', 'terms', 'refund', 'withdrawal'])
const TAB_ICON_BY_PAGE = { home: 'home', settings: 'settings', search: 'search', explore: 'search', favorites: 'heart', saved: 'heart', cart: 'cart', profile: 'user', me: 'user', account: 'user', calendar: 'calendar', schedule: 'calendar', notifications: 'bell', alerts: 'bell', map: 'map' }
const TAB_ICON_SPARE = ['calendar', 'bell', 'user', 'map', 'heart', 'search', 'cart']
function bindIconTabs(ctx) {
  const p = ctx.fixture
  const c = p.copy ?? {}
  const idByRoute = new Map(Object.entries(ctx.routes ?? {}).map(([id, route]) => [route, id]))
  const seen = new Set()
  const dests = ctx.navLinks().filter((l) => {
    const id = idByRoute.get(l.href)
    if (!id || TAB_NOT_DESTINATION.has(id) || seen.has(l.href)) return false
    seen.add(l.href)
    return true
  })
  if (dests.length < 3) { ctx.why = `최상위 목적지가 ${dests.length}개라 하단 탭을 두지 않는다(3~5개일 때만 — pwa 원형 조건)`; ctx.omit = true; return null }
  const used = new Set()
  const spare = [...TAB_ICON_SPARE]
  const tabs = dests.slice(0, 5).map((l) => {
    const known = TAB_ICON_BY_PAGE[idByRoute.get(l.href)]
    const icon = known && !used.has(known) ? known : (spare.find((i) => !used.has(i)) ?? 'home')
    used.add(icon)
    return { label: l.label, href: l.href, icon }
  })
  p.copy = { ...c, navLabel: t(ctx, '주 메뉴', 'Main menu'), tabs }
  delete p.currentHref // 현재 위치는 쪽마다 다르다 — 고정 props 에 한 쪽을 박지 않는다
  return p
}

function bindBottomTab(ctx) {
  const p = ctx.fixture
  const c = p.copy ?? {}
  if (String(ctx.block).endsWith('-icon-tabs')) return bindIconTabs(ctx)
  if (ctx.content.archetype === 'detail' && isObj(c.primary) && typeof c.price === 'number') return bindDetailBuyBar(ctx)
  const primary = at(ctx.content, 'booking.primary')
  if (isObj(c.call) && isObj(c.booking)) {
    const phone = ref('business.phone')
    // 전화번호가 「확인 필요」면 tel: 대상이 없는 [전화하기] 버튼이 된다 — 줄을 그리지 않는다. 까닭은 「확인 필요 사실: business.phone」 하나로만 남긴다(FIT-7, inputWait).
    if (!usableText(at(ctx.content, 'business.phone'))) { if (at(ctx.content, 'business.phone') !== undefined) { ctx.why = '전화번호가 아직 없어(확인 필요) 전화 단추를 그릴 수 없다 — 번호는 「확인 필요 사실」로 따로 막는다'; ctx.inputWait = true } return null }
    c.call = { ...c.call, phone }
    const cta = ctx.primaryCta()
    if (!cta) return null
    c.booking = { ...c.booking, href: cta.href }
    // 예약 수단이 전화뿐이면(예약 버튼이 가는 곳이 전화 링크) [전화하기]와 [예약하기]가 같은 곳이다 — 버튼 하나만(FINAL-WF2 #21). 예약 쪽이 있으면 그 쪽으로 간다(위 href).
    // 예약 버튼이 가는 곳이 비어 있으면(예약 수단 값이 「확인 필요」) 그 버튼도 그리지 않는다.
    if ((isRef(cta.href) && cta.href.as === 'tel') || refTargetMissing(ctx.content, cta.href)) delete c.booking
    const today = slotRef(ctx, 'todayHours')
    if (today) c.note = today
    else if (!ctx.drop(p, "copy.note")) return null
    void primary
    return p
  }
  return null
}

function bindTrust(ctx) {
  const p = ctx.fixture
  if (!isObj(p.business)) return null
  const base = at(ctx.content, 'business') ? 'business' : null
  if (!base) return null
  const next = {}
  for (const k of Object.keys(p.business)) if (at(ctx.content, `business.${k}`) !== undefined) next[k] = ref(`business.${k}`)
  if (!next.name) return null
  p.business = next
  return p
}

// 부가세 표기(5.13, marketing price-notation·total-first-screen): 가격 사실(브리프 가격 문장·메뉴 사실·가격 문구 칸)이 부가세 포함/별도를 말할 때만 그 말을 가격 곁에 싣는다 — 말하지 않으면 짐작하지 않는다(null).
const VAT_INCLUDED = /(?:VAT|부가세|부가가치세)\s*포함|세금\s*포함|(?:VAT|tax)\s+(?:is\s+)?included|(?:including|includes?|incl\.?)\s*(?:VAT|tax)/i
const VAT_EXCLUDED = /(?:VAT|부가세|부가가치세)\s*별도|세금\s*별도|(?:VAT|tax)\s+(?:is\s+)?(?:excluded|extra)|(?:excluding|excludes?|excl\.?)\s*(?:VAT|tax)/i
// 면세(QFIX3): 「부가세 면세」·「VAT exempt」처럼 세금 낱말과 면세가 붙은 말만 센다 — 「면세점」 같은 낱말은 아니다. 면세 여부는 사업자가 아는 사실이라 생성기가 짐작하지 않는다.
const VAT_EXEMPT = /(?:VAT|부가세|부가가치세)\s*면세|면세\s*(?:사업자|용역|상품)|(?:VAT|tax)[\s-]+exempt|exempt\s+from\s+(?:VAT|tax)/i
// 부분 면세(FINAL-WF B3): 「일부 면세 상품」·「면세 상품과 과세 상품」은 가격 전부가 면세라는 말이 아니다 — 한 줄로 단정하지 않는다(null).
const VAT_PARTIAL = /일부\s*(?:품목|상품|메뉴)?(?:은|는|이|가)?\s*면세|면세\s*(?:품목|상품|메뉴)?\s*(?:과|와|및|,)\s*과세|과세\s*(?:품목|상품|메뉴)?\s*(?:과|와|및|,)\s*면세|(?:some|partly|partially)\s+(?:items?\s+|products?\s+)?(?:are\s+)?(?:VAT|tax)?[\s-]*exempt|(?:exempt|non-?taxable)\s+and\s+(?:taxable|non-?exempt)\s+(?:items|products)/i
export function vatStatusOf(content) {
  const texts = []
  for (const k of ['price', 'menu']) if (typeof at(content, `facts.${k}`) === 'string') texts.push(at(content, `facts.${k}`))
  for (const c of arr(at(content, 'slots.copy'))) if (isObj(c) && ['price', 'item', 'planName'].includes(c.id) && typeof c.text === 'string') texts.push(c.text)
  const inc = texts.some((t) => VAT_INCLUDED.test(t))
  const exc = texts.some((t) => VAT_EXCLUDED.test(t))
  const exe = texts.some((t) => VAT_EXEMPT.test(t))
  if (texts.some((t) => VAT_PARTIAL.test(t))) return null
  // 「부가세 포함」을 말하면 면세 낱말이 섞여도 포함으로 읽는다(S1 회귀) — 면세 낱말만 있고 포함·별도가 없을 때만 exempt.
  return inc && !exc ? 'included' : exc && !inc && !exe ? 'excluded' : exe && !inc && !exc ? 'exempt' : null
}
const vatText = (ctx) => {
  const st = vatStatusOf(ctx.content)
  return st ? PRICE_NOTE_UI[ctx.locale === 'en' ? 'en' : 'ko'][st === 'included' ? 'vatIncluded' : st === 'exempt' ? 'vatExempt' : 'vatExcluded'] : null
}

// 가격표 구획 제목(FINAL-WF2 #28): 예시의 「오늘의 메뉴」는 카페의 말이다 — 주야간보호의 비급여 가격표에도 그대로 나갔다. 원형 문구 칸에 제목이 없으니 어느 사업에나 맞는 이름표를 쓴다(항목 이름·가격은 콘텐츠 사실).
export const MENU_PRICE_UI = { ko: { title: '가격 안내', category: '가격표' }, en: { title: 'Prices', category: 'Price list' } }
function bindMenuPrice(ctx) {
  const menu = arr(at(ctx.content, 'menu'))
  const p = ctx.fixture
  if (!menu.length) return null
  const mu = MENU_PRICE_UI[ctx.locale === 'en' ? 'en' : 'ko']
  if (isObj(p.copy) && typeof p.copy.title === 'string') p.copy.title = mu.title
  // 가격표 아래 한 줄: 가격 사실이 부가세 포함/별도를 말할 때만 싣는다(말하지 않으면 예시 각주는 선택 칸이라 지워진다). 각주 칸이 없는 변형은 머리말 아래 줄(lead)에.
  const note = vatText(ctx)
  if (note && isObj(p.copy)) { if ('footnote' in p.copy) p.copy.footnote = note; else p.copy.lead = note }
  if (Array.isArray(p.items)) {
    // 사진 줄(photo-rows)은 분류 없이 평평한 items 다 — 메뉴 사진 칸(local menu[].photo, 실사 필수)이 있으면 잇고 없으면 블록이 빈 자리를 그린다.
    p.items = menu.map((m, i) => ({ name: ref(`menu.${i}.name`), price: ref(`menu.${i}.price`), ...(isObj(m?.photo) ? { photo: ref(`menu.${i}.photo`) } : {}) }))
    if (p.copy && "origin" in p.copy) ctx.drop(p, "copy.origin")
    return p
  }
  if (!Array.isArray(p.categories)) return null
  p.categories = [{ name: mu.category, items: menu.map((m, i) => ({ name: ref(`menu.${i}.name`), price: ref(`menu.${i}.price`) })) }]
  if (p.copy && "origin" in p.copy) ctx.drop(p, "copy.origin")
  return p
}

function bindHoursLocation(ctx) {
  const p = ctx.fixture
  const hours = at(ctx.content, 'hours')
  if (!Array.isArray(hours) || !hours.length || !isObj(p.copy) || !Array.isArray(p.hours)) return null
  const dir = at(ctx.content, 'directions')
  // 회사 정보 칸(business)이 없는 공공 기관은 agency(주소·대표전화 mainPhone)가 같은 자리다(QFIX [3] public main/agency-info)
  const base = ['business', 'agency'].find((b) => at(ctx.content, `${b}.address`))
  if (!base) return null
  const phonePath = base === 'agency' ? 'agency.mainPhone' : 'business.phone'
  p.hours = hours.map((_, i) => ref(`hours.${i}`))
  if (typeof p.copy.address === 'string') p.copy.address = ref(`${base}.address`)
  // 변형마다 다른 칸: 오시는 길(대중교통·주차) · 지도 링크 · 전화 — 있는 칸만 콘텐츠로 잇고, 콘텐츠에 자료가 없으면 그 칸을 뺀다.
  // 「확인 필요」 자리 표시는 자료가 아니다 — 교통·주차 칸이 「확인 필요」 글자로 나가지 않는다(사유는 「확인 필요 사실」이 따로 남긴다, FIT-7)
  if (isObj(p.copy.transit)) { if (isObj(dir) && usableText(dir.transit)) p.copy.transit = { ...p.copy.transit, text: ref('directions.transit') }; else if (!ctx.drop(p, 'copy.transit')) return null }
  if (isObj(p.copy.parking)) { if (isObj(dir) && usableText(dir.parking)) p.copy.parking = { ...p.copy.parking, text: ref('directions.parking') }; else if (!ctx.drop(p, 'copy.parking')) return null }
  const maps = at(ctx.content, 'mapLinks')
  const usable = (v) => typeof v === 'string' && v.trim() !== '' && !isNeedsCheck(v) // 자리 표시 글자는 링크가 아니다 — 링크 없음으로 그린다(blocker 는 06 이 남긴다)
  if (Array.isArray(p.copy.maps)) p.copy.maps = [p.copy.maps[0] && usable(maps?.naver) ? { ...p.copy.maps[0], href: ref('mapLinks.naver') } : null, p.copy.maps[1] && usable(maps?.kakao) ? { ...p.copy.maps[1], href: ref('mapLinks.kakao') } : null].filter(Boolean)
  if (isObj(p.copy.directions)) { if (usable(maps?.naver)) p.copy.directions = { ...p.copy.directions, href: ref('mapLinks.naver') }; else if (!ctx.drop(p, 'copy.directions')) return null }
  if ('telephone' in p) {
    if (usableText(at(ctx.content, phonePath))) p.telephone = ref(phonePath)
    else if (!ctx.drop(p, 'telephone')) { if (at(ctx.content, phonePath) !== undefined) { ctx.why = '전화번호가 아직 없어(확인 필요) 전화 칸을 그릴 수 없다 — 번호는 「확인 필요 사실」로 따로 막는다'; ctx.inputWait = true } return null }
  }
  // 특수일·공휴일(대장 A105 — Task 7a-fix 가 더한 칸): 콘텐츠에 있으면 잇고, 없으면 뺀다 — 예시 날짜(개천절·한글날)가 사이트에 새면 안 된다.
  const has = (path) => { const v = at(ctx.content, path); return Array.isArray(v) ? v.length > 0 : v !== undefined && v !== null }
  for (const [prop, path] of [['special', 'hoursSpecial'], ['holidays', 'holidays'], ['holidayPolicy', 'holidayPolicy']]) {
    if (!(prop in p)) continue
    if (has(path)) p[prop] = ref(path)
    else if (!ctx.drop(p, prop)) return null
  }
  delete p.now // 지금 시각은 실행 때 블록이 잰다
  return p
}

// 예약 완료(local): 캘린더 일정 제목은 콘텐츠 상호로 만들고(요청 번호 「{ref}」는 블록이 채운다), 설명글(예시 문구)은 뺀다. 전화는 콘텐츠 전화다.
function bindConfirmation(ctx) {
  const p = ctx.fixture
  const c = p.copy ?? {}
  const base = at(ctx.content, 'business') ? 'business' : at(ctx.content, 'product') ? 'product' : null
  if (isObj(c.calendar)) {
    if (base && typeof at(ctx.content, `${base}.name`) === 'string') c.calendar.eventTitle = ref(`${base}.name`, { template: ctx.locale === 'ko' ? '{} 예약 {ref}' : '{} booking {ref}' })
    else if (!ctx.drop(p, 'copy.calendar')) return null
    ctx.drop(p, 'copy.calendar.description')
  }
  if (isObj(c.help) && typeof c.help.phone === 'string') {
    if (usableText(at(ctx.content, 'business.phone'))) c.help.phone = ref('business.phone')
    else ctx.drop(p, 'copy.help.phone')
  }
  // 요청한 예약(날짜·인원·요청 번호)은 예시가 아니라 방문자가 보낸 값이다 — 폼을 보낸 뒤 이 쪽 주소의 ?ref=&at=&people= 에서 잎이 읽는다(lib/booking.ts). 없으면 그리지 않는다.
  if (isObj(p.booking)) delete p.booking
  return p
}

// ── 넓힌 binder(P3-3 Task 9b, 대장 C111) ─────────────────────────────────────────────────────────────
// pwa 는 앱 이름이 manifest.name, 회사 정보 칸이 없는 원형(portfolio·dashboard)은 facts.name(브리프 이름 사실 원문)이다(brief.mjs factPath).
const brandPathOf = (ctx) => ['site.name', 'business.name', 'product.name', 'organization.name', 'agency.name', 'manifest.name', 'facts.name'].find((p) => typeof at(ctx.content, p) === 'string')
const routeOf = (ctx) => ctx.routes[String(ctx.key).split('/')[0]] ?? '/'
const t = (ctx, ko, en) => (ctx.locale === 'ko' ? ko : en)

// 내비게이션 블록(쪽 안 앱바 — pwa): 이름·메뉴는 콘텐츠·사이트맵에서. 머리글(global/header)은 SiteShell 이 그리므로 여기 오지 않는다(C110).
function bindNav(ctx) {
  const p = ctx.fixture
  const c = p.copy ?? {}
  const brand = brandPathOf(ctx)
  if (!brand) return null
  const links = ctx.navLinks()
  p.currentHref = routeOf(ctx)
  if (typeof c.brand === 'string') c.brand = ref(brand)
  if (typeof c.title === 'string') c.title = ref(brand)
  if (Array.isArray(c.links)) c.links = links
  if (Array.isArray(c.tabs)) c.tabs = links
  if (typeof c.navLabel === 'string') c.navLabel = t(ctx, '주 메뉴', 'Main menu')
  if (typeof c.tabsLabel === 'string') c.tabsLabel = t(ctx, '주 메뉴', 'Main menu')
  if (isObj(c.action)) {
    const cta = ctx.primaryCta()
    const label = slotRef(ctx, 'primaryCta')
    if (cta && label) c.action = { label, href: cta.href }
    else if (!ctx.drop(p, 'copy.action')) return null
  }
  ctx.drop(p, 'copy.back') // 뒤로 링크·행동 아이콘은 예시 주소(#home)를 가리킨다 — 콘텐츠에 이 자리가 없다
  ctx.drop(p, 'copy.actions')
  return p
}

// 공지: 날짜 붙은 한 줄 공지(local·public notices)를 맨 위 띠(top-bar)로. 그날이 지나면 그리지 않는다(endsAt = 그날 끝, 서울 시각).
// 다른 변형(제목·본문·기간이 따로인 것)은 콘텐츠에 그 칸이 없어 null — 03-variants 가 다른 변형을 고르게 폴백한다.
function bindAnnouncement(ctx) {
  const p = ctx.fixture
  // 새 판 알림 토스트(update-toast, BIND2): 사실이 아니라 실행 때 서비스 워커 신호로 뜨는 알림이다 — 화면 이름표(TOAST_UI)면 충분하다. 제목은 콘텐츠 pwa strings.updateAvailable 가 있으면 그 글(06 앱 셸과 같은 출처).
  // 예시의 안내 글·판 이름은 싣지 않는다. 새 판이 기다린다는 신호가 오기 전에는 보이지 않게 available = false 로 둔다 — 잎(앱 셸)이 서비스 워커 상태로 켠다(가짜 알림 없음).
  if (String(ctx.block).endsWith('-update-toast')) {
    const u = TOAST_UI[ctx.locale === 'en' ? 'en' : 'ko']
    const given = at(ctx.content, 'strings.updateAvailable')
    p.copy = { title: typeof given === 'string' && given.trim() && !isNeedsCheck(given) ? ref('strings.updateAvailable') : u.title, update: u.update, later: u.later }
    p.available = false
    delete p.version
    return p
  }
  const c = p.copy ?? {}
  // 공지 전광판(notice-ticker, 5.11): 콘텐츠 notices 의 글(text 또는 title)·날짜·주소를 항목으로. 전체 보기 링크는 가는 쪽이 정해지지 않아 싣지 않는다(선택 칸).
  if (Array.isArray(c.items)) {
    const list = arr(at(ctx.content, 'notices'))
    const textKey = (n) => (isObj(n) ? (typeof n.text === 'string' ? 'text' : typeof n.title === 'string' ? 'title' : null) : null)
    const idx = list.map((n, i) => (textKey(n) ? i : -1)).filter((i) => i >= 0)
    if (!idx.length) { ctx.why = '공지(notices)가 콘텐츠에 없다'; return null }
    c.items = idx.map((i) => ({ text: ref(`notices.${i}.${textKey(list[i])}`), ...(typeof list[i].url === 'string' ? { href: ref(`notices.${i}.url`) } : {}), ...(typeof list[i].date === 'string' ? { date: ref(`notices.${i}.date`) } : {}) }))
    ctx.drop(p, 'copy.viewAll')
    return p
  }
  // QFIX [1] — 맨 위 띠(top-bar)·본문 안 알림 판(dismissible-inline)은 끝나는 날(endsAt)이 필수다(마케팅 A8 — 공지에는 기간이 있다). 날짜 붙은 공지(notices)가 없으면 끝나는 날을 지어내지 않는다:
  // 선택 섹션(commerce notice-bar)은 공개 불가로 막지 않고 뺀다(omit — 필수 섹션은 이 까닭과 함께 그대로 막힌다).
  const noDated = () => { ctx.why = '공지에는 끝나는 날이 있어야 한다(A8) — 사실에 날짜 붙은 공지(notices)가 없다. 끝나는 날을 지어내지 않는다'; ctx.omit = true; return null }
  const dated = arr(at(ctx.content, 'notices')).some((n) => isObj(n) && typeof n.date === 'string')
  if (typeof c.message !== 'string') {
    if (!dated) return /-dismissible-inline$/.test(String(ctx.block)) ? noDated() : null
    ctx.why = '본문 안 알림 판은 제목·본문·행동 문구가 따로 필요한데 공지(notices)는 한 줄 글이다'
    return null
  }
  const first = arr(at(ctx.content, 'notices'))[0]
  const field = isObj(first) ? (typeof first.text === 'string' ? 'text' : typeof first.title === 'string' ? 'title' : null) : null
  if (!field || typeof first.date !== 'string') return noDated()
  c.message = ref(`notices.0.${field}`)
  ctx.drop(p, 'copy.link')
  ctx.drop(p, 'copy.countdown')
  p.announcementId = ref('notices.0.date', { template: 'notice-{}' })
  p.endsAt = ref('notices.0.date', { template: '{}T23:59:59+09:00' })
  ctx.drop(p, 'startsAt')
  ctx.drop(p, 'showCountdown')
  delete p.now
  return p
}

// 문의 폼: 보내기·전화·카카오 채널은 정적 어댑터(mailto·tel·카카오 채널 — 서버 없이 되는 것)를 잎이 끼운다(lib/contact.ts). props 에는 넣지 않는다.
const CONTACT_DONE_UI = {
  ko: { title: '메일 창을 열었어요 — 보내기를 눌러야 문의가 가요', body: '열린 메일 앱에서 내용을 확인하고 보내기를 눌러 주세요.' },
  en: { title: 'Your email app should have opened — press send to deliver your message', body: 'Check the message in the mail app that just opened, then press send.' },
}
function bindContactForm(ctx) {
  const p = ctx.fixture
  const c = p.copy ?? {}
  if (Array.isArray(c.steps) || Array.isArray(p.dates)) return null // 단계 예약 폼은 가능한 날짜·시간표가 필요하다 — 콘텐츠에 없다
  delete p.call
  delete p.kakao
  // 완료 문구(FINAL-WF2 AB19): 찍어낸 사이트의 문의 폼은 정적 어댑터(mailtoSubmit — 메일 앱 열기)라 보내는 순간 문의가 간 것이 아니다 — 「받았어요」는 거짓 성공이다.
  // 서버 접수(launch-factory 어댑터)로 바뀌는 사이트는 이 두 줄을 예시 문구(받았어요)로 되돌린다. 접수 번호 줄은 번호가 있을 때만 그려지므로 그대로 둔다.
  if (isObj(c.form) && isObj(c.form.done)) c.form.done = { ...c.form.done, ...CONTACT_DONE_UI[ctx.locale === 'en' ? 'en' : 'ko'] }
  const phone = at(ctx.content, 'business.phone')
  if (isObj(c.call)) {
    if (usableText(phone)) c.call.number = ref('business.phone')
    else if (!ctx.drop(p, 'copy.call')) return null
  }
  if (isObj(c.kakao)) {
    const hasKakao = arr(at(ctx.content, 'booking.secondary')).some((x) => x?.kind === 'kakao') || at(ctx.content, 'booking.primary.kind') === 'kakao'
    if (!hasKakao && !ctx.drop(p, 'copy.kakao')) return null
  }
  return p
}

// 판매 순위가 곧 내용인 블록(대장 C334, v0.0.9 FB9) — 「1위…」「지난 7일 판매량 기준」은 판매 순위 자료가 있어야 쓸 수 있는 주장이다.
// 콘텐츠 스키마(commerce Product)에는 판매 순위 칸이 없고 상품 배열 순서는 진열 순서일 뿐이라, 지금은 자료가 있을 수 없다 → 묶지 않고(null) 03·06 폴백이 같은 섹션의 다른 변형(순위를 안 말하는 목록)으로 바꾼다.
// 순위 칸이 생기면 salesRankOf 만 고친다(상품마다 양의 정수 순위가 있고 배열이 순위 오름차순일 때만 자료로 본다 — 목록은  로 배열 그대로 읽으므로).
export const SALES_RANK_BLOCKS = new Set(['block-product-list-ranked-list'])
export const salesRankOf = (content) => { const ps = arr(at(content, 'products')); return ps.length && ps.every((p, i) => Number.isInteger(p?.salesRank) && p.salesRank > 0 && (i === 0 || p.salesRank > ps[i - 1].salesRank)) ? ps.map((p) => p.salesRank) : null }

// 상품 목록(commerce products): 읽기 상태를 준비됨 + 콘텐츠 상품으로. 사양 요약 변형(copy.specs)은 콘텐츠에 사양 칸이 없어 null.
function bindProductList(ctx) {
  if (ctx.content.archetype === 'detail') return bindDetailPurchase(ctx)
  const p = ctx.fixture
  const products = arr(at(ctx.content, 'products'))
  if (SALES_RANK_BLOCKS.has(ctx.block) && !salesRankOf(ctx.content)) { ctx.why = '판매 순위 자료가 없다 — 순위(1위…)를 지어내지 않는다'; ctx.omit = true; return null }
  if (!products.length || !isObj(p.state) || Array.isArray(p.copy?.specs)) return null
  p.state = { status: 'ready', data: ref('products') }
  ctx.drop(p, 'skeletonCount')
  // 카드 링크(FINAL-WF2 AB1): 블록 예시의 상세 주소 틀(/products/{slug})은 사이트맵에 상세 쪽이 있을 때만 맞다 — 없으면 카드마다 404 링크라 틀을 비워 이름만 보인다(구매 경로가 막히는 것은 사이트맵의 몫).
  if (isObj(p.copy) && typeof p.copy.hrefTemplate === 'string' && !ctx.routes?.['product-detail']) p.copy.hrefTemplate = ''
  // 같은 쪽에 거르기 줄(도구 줄·분류 칩)이 결과 수를 상태 알림으로 알리면 목록은 알림을 또 내지 않는다(FINAL-WF2 #24 — 「상품 3개」 알림 셋이 겹쳤다)
  if (isObj(p.copy) && typeof p.copy.countTemplate === 'string' && arr(ctx.pageKinds).some((k) => k === 'list-toolbar' || k === 'filter-chips')) p.copy.countTemplate = ''
  // 목록 제목(EXLEAK): 예시의 「이번 주 빵」·「많이 팔린 빵」은 이 가게의 말이 아니다 — 콘텐츠에 상품 묶음 이름·섹션 문구 칸이 없으니 생성기가 든 화면 이름표(PRODUCT_LIST_UI)로 쓴다.
  // 이름표는 사실을 주장하지 않는다(「신상품」·「인기」는 콘텐츠에 없는 분류라 쓰지 않는다 — 같은 상품 전체를 그린다).
  if (isObj(p.copy) && typeof p.copy.title === 'string') p.copy.title = PRODUCT_LIST_UI[ctx.locale === 'en' ? 'en' : 'ko'].title
  // 가격 곁 합계·부가세 한 줄(5.13, marketing total-first-screen·price-notation): 배송비가 있는지/없는지(콘텐츠 shipping.fee)와 부가세 포함·별도(가격 사실)에서 고르는 문장 — 금액은 쓰지 않는다. 사실이 없으면 그 문장을 쓰지 않는다.
  const ui = PRICE_NOTE_UI[ctx.locale === 'en' ? 'en' : 'ko']
  const fee = at(ctx.content, 'shipping.fee')
  const lines = [typeof fee === 'number' ? (fee > 0 ? ui.totalWithShipping : ui.totalNoShipping) : null, vatText(ctx)].filter(Boolean)
  if (lines.length && ctx.isOptional('lead')) p.copy.lead = lines.join(ctx.locale === 'en' ? '. ' : '. ') + '.'
  return p
}

// ── 상세페이지(detail) binder(P3-3 detail 레인, 대장 C160·C142) ──────────────────────────────────────────
// 구매 영역(product-list spec-summary)·가격 곁 리뷰(review-list summary-near-price)·하단 구매 바(bottom-tab sticky-action-bar)는 콘텐츠 `product`·`reviews` 에서 묶는다.
// 비교표(features compare-table)·Q&A(faq)는 detail 콘텐츠에 「다른 방식」·「묻고 답한 질문」 자료가 없어 묶지 않는다(자료를 지어내지 않는다 — 섹션은 그려지지 않고 blocker).
// 금액은 최소 단위 정수(ports Money — KRW 원·USD/EUR 센트)라 블록이 product.currency 로 그린다(price-tag formatPrice { minor }). 한국어 + 원화는 블록 예전 출력 그대로(money 를 주지 않는다).
// 화면 이름표(버튼·라벨)는 콘텐츠 사실이 아니라 생성기가 든 ko/en 이름표다(PAGE_LABELS 와 같은 자리).
const DETAIL_UI = {
  ko: {
    buy: '바로 구매', cart: '장바구니 담기', soldOut: '품절', listPrice: '정가', discount: '{p}%', unitPrice: '{per}당 {price}', vatIncluded: '부가세 포함', vatExcluded: '부가세 별도',
    summaryTitle: '상품 요약', specTitle: '상품 정보', originLabel: '원산지', unitPriceLabel: '단위 가격', loading: '상품 정보를 불러오는 중이에요',
    emptyTitle: '판매가 끝난 상품이에요', errorTitle: '상품 정보를 불러오지 못했어요', retry: '다시 시도',
    region: '구매', priceLabel: '판매가',
    kit: { starsLabel: '평균 별점 {avg}점', countLine: '리뷰 {count}개 · {date} 기준', verified: '구매 인증', reply: '판매자 답변', ratingShort: '별점 {rating}점', photoSlot: '사진 자리' },
    reviewAuthor: '고객', replyAuthor: '판매자', highlightsTitle: '먼저 읽어 볼 리뷰', critical: '가장 낮은 별점 리뷰', allReviews: '리뷰 {count}개 모두 보기',
  },
  en: {
    buy: 'Buy now', cart: 'Add to cart', soldOut: 'Sold out', listPrice: 'List price', discount: '{p}% off', unitPrice: '{price} per {per}', vatIncluded: 'VAT included', vatExcluded: 'VAT not included',
    summaryTitle: 'Product summary', specTitle: 'Product details', originLabel: 'Origin', unitPriceLabel: 'Unit price', loading: 'Loading product details',
    emptyTitle: 'This product is no longer available', errorTitle: 'Could not load product details', retry: 'Try again',
    region: 'Purchase', priceLabel: 'Price',
    kit: { starsLabel: 'Average rating {avg} out of five', countLine: '{count} reviews · as of {date}', verified: 'Verified purchase', reply: 'Seller reply', ratingShort: 'Rated {rating} out of five', photoSlot: 'Photo placeholder' },
    reviewAuthor: 'Customer', replyAuthor: 'Seller', highlightsTitle: 'Reviews to read first', critical: 'Lowest-rated review', allReviews: 'See all {count} reviews',
  },
}
const detailUi = (ctx) => DETAIL_UI[ctx.locale === 'en' ? 'en' : 'ko']
const DETAIL_BUY_HREF = '#product' // 구매 영역 섹션(spec-summary 의 기본 id) — 결제는 launch-factory 포트가 붙일 자리, 그 전에는 옵션을 고르는 구매 영역으로 간다
/** 콘텐츠 통화로 그릴 때만({ currency, locale }) — 한국어 + 원화는 null(블록이 예전 그대로 그린다). */
function detailMoney(ctx) {
  const cur = at(ctx.content, 'product.currency')
  if ((cur ?? 'KRW') === 'KRW' && ctx.locale !== 'en') return null
  return { currency: typeof cur === 'string' ? ref('product.currency') : 'KRW', locale: ctx.locale === 'en' ? 'en-US' : 'ko-KR' }
}
const detailProduct = (ctx) => {
  const p = at(ctx.content, 'product')
  return isObj(p) && typeof p.name === 'string' && typeof p.price === 'number' ? p : null
}

// 구매 영역(product-list spec-summary): 상품명·가격(통화)·옵션·배송 한 줄(문구 칸 shipping). 사양 표(copy.specs)는 고시 표와 겹치고 섹션이 따로(A62)라 뺀다.
function bindDetailPurchase(ctx) {
  const p = ctx.fixture
  const prod = detailProduct(ctx)
  if (!prod || !isObj(p.state) || !isObj(p.copy?.buyCta)) return null
  const u = detailUi(ctx)
  const c = p.copy
  const gallery = arr(at(ctx.content, 'slots.images')).findIndex((im) => im?.id === 'gallery-main' && typeof im.src === 'string')
  const thumb = gallery >= 0 ? ref(`slots.images.${gallery}`) : { id: 'gallery-main', aspect: '1:1', source: 'real-required', alt: ref('product.name') }
  p.state = {
    status: 'ready',
    data: [{
      slug: 'product', name: ref('product.name'), price: ref('product.price'),
      options: arr(prod.options).map((o, i) => ({ name: ref(`product.options.${i}.name`), values: arr(o.values).map((_, j) => ({ label: ref(`product.options.${i}.values.${j}`), soldOut: false })) })),
      thumbs: [thumb],
    }],
  }
  c.title = u.summaryTitle
  c.price = { discount: u.discount, listPrice: u.listPrice, unitPrice: u.unitPrice, vatNote: prod.taxIncluded ? u.vatIncluded : u.vatExcluded }
  const money = detailMoney(ctx)
  if (money) c.money = money
  c.soldOutLabel = u.soldOut
  const shipping = slotRef(ctx, 'shipping')
  if (shipping) c.shippingNote = shipping
  else ctx.drop(p, 'copy.shippingNote')
  c.buyCta = { label: u.buy, href: DETAIL_BUY_HREF }
  c.cartCta = { label: u.cart, href: DETAIL_BUY_HREF }
  ctx.drop(p, 'copy.specs')
  c.specTitle = u.specTitle
  c.originLabel = u.originLabel
  c.unitPriceLabel = u.unitPriceLabel
  c.loadingLabel = u.loading
  c.empty = { title: u.emptyTitle }
  c.error = { title: u.errorTitle, retryLabel: u.retry }
  return p
}

// 하단 구매 바(bottom-tab sticky-action-bar): 이름·가격(통화)·구매·장바구니. 정가는 콘텐츠에 없어 뺀다.
function bindDetailBuyBar(ctx) {
  const p = ctx.fixture
  const prod = detailProduct(ctx)
  if (!prod) return null
  const u = detailUi(ctx)
  const c = p.copy
  c.regionLabel = u.region
  c.name = ref('product.name')
  c.priceLabel = u.priceLabel
  c.price = ref('product.price')
  ctx.drop(p, 'copy.originalPrice')
  ctx.drop(p, 'copy.originalPriceLabel')
  const money = detailMoney(ctx)
  if (money) { c.money = money; delete c.unit } else c.unit = '원'
  c.primary = { label: u.buy, href: DETAIL_BUY_HREF }
  c.secondary = { label: u.cart, href: DETAIL_BUY_HREF }
  return p
}

// 리뷰(review-list): 콘텐츠 reviews 의 별점·본문·날짜·판매자 답글만 잇는다(작성자 이름·구매 인증·옵션은 콘텐츠에 없어 싣지 않는다 — 작성자는 「고객」 이름표).
// 평균·개수는 콘텐츠 product.rating(있으면), 없으면 reviews 목록에서 센 값. 기준일은 가장 최근 리뷰 날짜. 분포는 목록의 리뷰에서 센 값(이 변형은 쓰지 않는다).
// summary-near-price 만 묶는다 — 분포 필터·사진 갤러리는 「리뷰를 쓰면 주는 보상」 안내가 필수 문구인데 콘텐츠에 그 칸이 없어 지어내지 않는다(blocker).
function bindReviewList(ctx) {
  const p = ctx.fixture
  if (ctx.content.archetype !== 'detail') { ctx.why = '이 블록 종류는 콘텐츠와 아직 이어지지 않았다'; return null }
  const reviews = arr(at(ctx.content, 'reviews'))
  if (!(isObj(p.product) && isObj(p.summary) && isObj(p.copy?.kit) && typeof p.copy.priceNote === 'string')) { ctx.why = '이 변형은 리뷰 적립(쓴 뒤 지급) 안내 문구가 필수인데 콘텐츠에 그 칸이 없다'; return null }
  const prod = detailProduct(ctx)
  if (!prod) return null
  const shipping = slotRef(ctx, 'shipping') ?? (ctx.slotAny?.('purchase-area', 'shipping') ? ref(ctx.slotAny('purchase-area', 'shipping')) : undefined)
  if (!shipping) { ctx.why = '배송 한 줄(문구 칸 shipping)이 콘텐츠에 없다'; return null }
  const u = detailUi(ctx)
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  for (const r of reviews) if (distribution[r.rating] !== undefined) distribution[r.rating]++
  const rating = at(ctx.content, 'product.rating')
  // C96(컨트롤러 판정 2026-10-01): 리뷰 0건이면 막지 않고 빈 상태로 그린다 — 별점 줄·먼저 읽을 리뷰·평점 JSON-LD 는 블록이 개수 0 에서 스스로 접는다. 가짜·예시 리뷰는 넣지 않는다.
  const newest = reviews.length ? reviews.reduce((best, r, i) => (String(r.date) > String(reviews[best].date) ? i : best), 0) : -1
  p.product = { name: ref('product.name'), price: ref('product.price'), ...(typeof at(ctx.content, 'product.currency') === 'string' ? { currency: ref('product.currency') } : {}) }
  p.summary = {
    avg: isObj(rating) && reviews.length ? ref('product.rating.avg') : reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : undefined,
    count: isObj(rating) && reviews.length ? ref('product.rating.count') : reviews.length, // 리뷰가 없으면 별점 줄 자체가 없다(기준일을 댈 리뷰가 없다)
    asOf: newest >= 0 ? ref(`reviews.${newest}.date`) : '',
    distribution,
  }
  if (!reviews.length) delete p.summary.avg // 평균을 댈 리뷰가 없다 — 0 이라는 수치도 지어내지 않는다(블록은 개수 0 에서 평점 줄을 그리지 않는다)
  p.reviews = reviews.map((r, i) => ({
    id: `r${i + 1}`, rating: ref(`reviews.${i}.rating`), body: ref(`reviews.${i}.text`), author: u.reviewAuthor, date: ref(`reviews.${i}.date`),
    ...(arr(r.photos).length ? { photos: ref(`reviews.${i}.photos`) } : {}),
    ...(isObj(r.sellerReply) ? { reply: { author: u.replyAuthor, body: ref(`reviews.${i}.sellerReply.text`), date: ref(`reviews.${i}.sellerReply.date`) } } : {}),
  }))
  p.copy.kit = { ...u.kit, ...(ctx.locale === 'en' ? { locale: 'en-US' } : {}) }
  p.copy.priceNote = prod.taxIncluded ? u.vatIncluded : u.vatExcluded
  p.copy.cta = { label: u.buy, href: DETAIL_BUY_HREF }
  p.copy.shipping = shipping
  p.copy.highlightsTitle = u.highlightsTitle
  p.copy.critical = u.critical
  p.copy.all = { label: u.allReviews, href: '#review-summary' }
  return p
}

// ── 거르기 줄(filter-bar, FV1 Task 5.9) ─────────────────────────────────────────────────────────────────────
// 거르기 이름·선택지는 콘텐츠에서만 뽑는다(지어내지 않는다). 이름표(「분류」·「정렬」·「전체」…)는 생성기가 든 ko/en 이름표다. 거른 상태는 주소 쿼리에 있고, 항목을 거르고 늘어놓는 일은
// 블록이 target 셀렉터로 직접 한다(상품 카드·표 행이 data-filter-<이름>·data-sort-<키> 속성을 단다).
//   · chips(commerce 분류 칩): 모든 상품에 분류(product.category)가 적히고 서로 다른 분류가 둘 이상일 때만. 아니면 그리지 않는다(눌러도 거를 것이 없는 칩을 만들지 않는다).
//   · toolbar: commerce 는 정렬(가격순 — 상품 카드의 data-sort-price)·결과 수, dashboard 는 갱신 주기 줄(콘텐츠 decision.refresh). 기간 선택지는 콘텐츠에 없어 그리지 않는다 — 값으로 차트를 다시 그릴 수 없는 사이트에 눌러도 안 변하는 기간 select 를 두지 않는다.
//   · search-filter(dashboard 목록 표 위): 콘텐츠 table.rows 가 있을 때만 — 검색은 표 행 글을 거르고, 거르기 select 는 값이 2~8가지인 글자 열 하나(첫 열 빼고)에서 만든다.
const FILTER_UI = {
  ko: { cat: '분류', all: '전체', productCount: '상품 {shown}개', clearCat: '분류 거르기 풀기', toolLabel: '상품 목록 도구', sort: '정렬', recommended: '추천순', priceAsc: '낮은 가격순', priceDesc: '높은 가격순', sortReset: '정렬 초기화', refresh: '갱신 주기', listTool: '목록 도구', searchLabel: '목록 검색', search: '검색', searchHint: '표에서 찾기', rows: '결과 {shown}건', reset: '필터 초기화' },
  en: { cat: 'Category', all: 'All', productCount: '{shown} products', clearCat: 'Clear category filter', toolLabel: 'Product list tools', sort: 'Sort', recommended: 'Recommended', priceAsc: 'Price: low to high', priceDesc: 'Price: high to low', sortReset: 'Reset sort', refresh: 'Refresh', listTool: 'List tools', searchLabel: 'Search the list', search: 'Search', searchHint: 'Find in the table', rows: '{shown} results', reset: 'Clear filters' },
}
const filterUi = (ctx) => FILTER_UI[ctx.locale === 'en' ? 'en' : 'ko']
const PRODUCT_ITEM = '[data-filter-item]'
const TABLE_ROW = '[data-block^="data-table-"] [data-row]'

function bindFilterBar(ctx) {
  const p = ctx.fixture
  const u = filterUi(ctx)
  const variant = String(ctx.block).replace(/^block-filter-bar-/, '')
  const products = arr(at(ctx.content, 'products'))
  if (variant === 'chips') {
    const cats = products.map((x) => (isObj(x) && typeof x.category === 'string' && x.category.trim() ? x.category.trim() : null))
    if (products.length < 2 || cats.some((c) => c === null)) { ctx.why = '모든 상품에 분류(category)가 적혀 있지 않다 — 거르기 이름을 지어내지 않는다'; return null }
    const firstOf = [...new Set(cats)].map((c) => cats.indexOf(c))
    if (firstOf.length < 2) { ctx.why = '서로 다른 분류가 하나뿐이라 거를 것이 없다'; return null }
    p.options = firstOf.map((i) => ({ value: ref(`products.${i}.category`), label: ref(`products.${i}.category`) }))
    // 결과 수 알림은 한 쪽에 하나만(FINAL-WF2 #24): 같은 쪽에 목록 도구 줄(list-toolbar)이 있으면 그 줄이 알린다
    p.copy = { label: u.cat, allLabel: u.all, ...(arr(ctx.pageKinds).includes('list-toolbar') ? {} : { count: u.productCount }), resetLabel: u.clearCat }
    p.param = 'category'
    p.mode = 'single'
    p.target = PRODUCT_ITEM
    delete p.resultCount
    delete p.initial
    return p
  }
  if (variant === 'toolbar') {
    delete p.resultCount
    delete p.initial
    if (ctx.content.archetype === 'dashboard') {
      const refresh = at(ctx.content, 'decision.refresh')
      if (typeof refresh !== 'string' || !refresh.trim()) { ctx.why = '갱신 주기(decision.refresh)가 콘텐츠에 없다'; return null }
      p.copy = { label: u.listTool, asOf: { label: u.refresh, value: ref('decision.refresh') } }
      p.controls = []
      return p
    }
    if (products.length < 2) { ctx.why = '상품이 둘 이상 있어야 정렬할 것이 생긴다'; return null }
    p.copy = { label: u.toolLabel, count: u.productCount, resetLabel: u.sortReset }
    p.controls = [{ id: 'sort', label: u.sort, param: 'sort', defaultValue: 'recommended', options: [{ value: 'recommended', label: u.recommended }, { value: 'price-asc', label: u.priceAsc }, { value: 'price-desc', label: u.priceDesc }] }]
    p.target = PRODUCT_ITEM
    p.sortTarget = PRODUCT_ITEM
    p.filterParams = []
    return p
  }
  // search-filter
  const table = at(ctx.content, 'table')
  const rows = isObj(table) ? arr(table.rows) : []
  if (!rows.length) { ctx.why = '거를 표 자료(table.rows)가 콘텐츠에 없다'; return null }
  const cols = arr(table.columns).filter((c) => isObj(c) && !c.numeric)
  const facetCol = cols.slice(1).find((c) => {
    const vals = rows.map((r) => (isObj(r) ? r[c.id] : null))
    const distinct = new Set(vals.filter((v) => typeof v === 'string' && v.trim()))
    return vals.every((v) => typeof v === 'string' && v.trim()) && distinct.size >= 2 && distinct.size <= 8
  })
  p.copy = { label: u.searchLabel, search: { label: u.search, placeholder: u.searchHint }, count: u.rows, resetLabel: u.reset }
  p.facets = []
  if (facetCol) {
    const ci = arr(table.columns).indexOf(facetCol)
    const seen = new Map()
    rows.forEach((r, i) => { const v = r[facetCol.id]; if (!seen.has(v)) seen.set(v, i) })
    p.facets = [{ id: 'facet', label: ref(`table.columns.${ci}.label`), param: 'filter', allLabel: u.all, options: [...seen.values()].map((i) => ({ value: ref(`table.rows.${i}.${facetCol.id}`), label: ref(`table.rows.${i}.${facetCol.id}`) })) }]
  }
  p.target = TABLE_ROW
  delete p.resultCount
  delete p.initial
  return p
}
// 대시보드 패널(dashboard-panel 세 변형, 5.11): 콘텐츠의 KPI(kpis)·경고(alerts — 제목은 항목마다 쓴 문구 칸 alert)·표(table)를 잇고, 갱신 주기(decision.refresh)를 「갱신 주기 …」로 보인다.
// 쓸 데이터가 없는 변형은 지어낸 숫자 대신 빈 상태(state.status = empty — 무엇이 비었나 + 이유 한 줄, UX H08)로 그린다. 실제 값은 실행 때 launch-factory 가 채운다.
// 예시의 사업 문구(「예약 추세」·「오늘 예약 목록」·「예약 경로」 거르기·「예약 받기 설정」)는 싣지 않는다.
function bindDashboardPanel(ctx) {
  const p = ctx.fixture
  const c = p.copy
  if (!isObj(p.state) || !isObj(c)) return null
  const u = DASHBOARD_UI[ctx.locale === 'en' ? 'en' : 'ko']
  const kind = String(ctx.block).replace('block-dashboard-panel-', '')
  const kpis = arr(at(ctx.content, 'kpis'))
  const alerts = arr(at(ctx.content, 'alerts'))
  const table = at(ctx.content, 'table')
  const refresh = at(ctx.content, 'decision.refresh')
  const asOf = typeof refresh === 'string' && refresh.trim() !== '' ? ref('decision.refresh') : null
  let data = null
  if (asOf) {
    if (kind === 'kpi-first' && kpis.length) data = { asOf, kpis: ref('kpis') }
    else if (kind === 'trend-plus-table' && (kpis.length || isObj(table))) data = { asOf, kpis: kpis.length ? ref('kpis') : [], ...(isObj(table) ? { table: ref('table') } : {}) }
    else if (kind === 'action-list') {
      const actions = []
      alerts.forEach((a, i) => {
        const title = ctx.slot('alert', i)
        if (title && arr(a?.actions).length) actions.push({ id: ref(`alerts.${i}.id`), severity: ref(`alerts.${i}.severity`), title: ref(title), recordUrl: ref(`alerts.${i}.recordUrl`), actions: arr(a.actions).map((_, j) => ({ label: ref(`alerts.${i}.actions.${j}`), href: ref(`alerts.${i}.recordUrl`) })) })
      })
      if (actions.length) data = { asOf, kpis: [], actions }
    }
  }
  c.title = u.titles[kind] ?? u.titles['kpi-first']
  if ('loadingLabel' in c) c.loadingLabel = u.loadingLabel // 예시의 「추세와 예약 목록을 불러오는 중이에요」는 예약 사업 낱말이라 일반 이름표로(QFIX [4])
  ctx.drop(p, 'copy.lead')
  if ('asOfLabel' in c) c.asOfLabel = u.refreshLabel
  if (isObj(c.filter)) ctx.drop(p, 'copy.filter') // 예시의 「예약 경로」 거르기 — 어느 열로 거를지는 콘텐츠가 정하지 않았다
  if ('tableCaption' in c) c.tableCaption = u.tableCaption
  // 빈 상태 안내(copy.empty)는 자료가 있어 ready 로 그릴 때도 필수 칸이라 예시 글이 남는다(「예약 받기 설정」 — 영어 사이트에 한글로 남았다, QFIX [4]) — 늘 생성기 이름표로 채운다.
  // 첫 행동 하나(UX H08): 콘텐츠에 도움말 주소가 있으면 그곳으로 — 없으면 지어내지 않고 안내 글만
  const help = at(ctx.content, 'helpUrl')
  c.empty = { title: u.emptyTitle, body: u.emptyBody, ...(typeof help === 'string' && help.trim() !== '' && !isNeedsCheck(help) ? { action: { label: u.helpLabel, href: ref('helpUrl') } } : {}) }
  p.state = data ? { status: 'ready', data } : { status: 'empty' }
  return p
}

// 신청 폼(lead-capture, 5.11): 제목·받는 것·버튼 글자·수집 고지·안심 한 줄은 04 가 쓴 문구 칸(leadTitle·leadWhat·submitLabel·consentNote·riskReducer), 신청하면 보내는 자료는 콘텐츠 leadMagnet.
// 그 밖의 폼 이름표(필수 안내·오류 제목·완료 안내)는 예시의 소식지·체크리스트 사업 문구 대신 생성기의 LEAD_UI 를 쓴다. 제출은 잎이 정적 어댑터(lib/contact.ts makeLeadPorts)로 끼운다.
/** 콘텐츠가 구독 해지 수단을 말하는가 — 브리프 사실·04 문구 어디든 해지(unsubscribe·opt out) 낱말이 든 글이 있으면 있다고 본다. */
const UNSUBSCRIBE_TEXT = /unsubscrib|opt[ -]?out|수신 ?거부|구독 ?(?:해지|취소)/i
export const hasUnsubscribeFact = (content) => [...contentTextsOf(content)].some((t) => UNSUBSCRIBE_TEXT.test(t))
function bindLeadCapture(ctx) {
  const p = ctx.fixture
  const c = p.copy
  if (!isObj(c)) return null
  const u = LEAD_UI[ctx.locale === 'en' ? 'en' : 'ko']
  const title = ctx.slot('leadTitle')
  const what = ctx.slot('leadWhat')
  const submit = ctx.slot('submitLabel')
  if (!title || !what || !submit) { ctx.why = '신청 폼의 제목·받는 것·버튼 글자 문구 칸(leadTitle·leadWhat·submitLabel)이 콘텐츠에 없다'; return null }
  const consent = ctx.slot('consentNote')
  c.title = ref(title)
  c.submit = ref(submit)
  c.pending = u.pending
  c.serverErrorTitle = u.serverErrorTitle
  c.done = { title: u.doneTitle, body: u.doneBody }
  if (isObj(c.email)) c.email = { ...c.email, required: u.emailRequired }
  if (typeof c.what === 'string' && typeof c.when === 'string') {
    // 소식지 한 줄 폼: 「언제·무슨 약속」 줄은 안심 한 줄(riskReducer)이 맡는다 — 없으면 예시의 「매주 목요일」을 쓸 수 없다
    const risk = ctx.slot('riskReducer')
    if (!risk) { ctx.why = '안심 한 줄 문구 칸(riskReducer)이 콘텐츠에 없다'; return null }
    c.what = ref(what)
    c.when = ref(risk)
    ctx.drop(p, 'copy.sample')
    c.consent = { label: consent ? ref(consent) : u.consentLabel, required: u.consentRequired }
    // 해지 약속(FINAL-WF4 EN8): 「메일 맨 아래 수신 거부를 누르면 언제든 끊겨요」는 해지 수단이 있다는 사실의 주장이다. 영어 사이트는 콘텐츠(브리프 사실·04 문구)가 해지 수단을 말할 때만 싣는다 — 한국어 사이트는 예전 그대로.
    if (ctx.locale !== 'en' || hasUnsubscribeFact(ctx.content)) c.unsubscribe = u.unsubscribe
    else delete c.unsubscribe
    return p
  }
  if (isObj(c.preview)) {
    const lm = at(ctx.content, 'leadMagnet')
    if (!isObj(lm) || typeof lm.title !== 'string') { ctx.why = '신청하면 보내는 자료(콘텐츠 leadMagnet)가 없다'; return null }
    c.lead = ref(what)
    c.preview = {
      cover: { ...c.preview.cover, alt: ref('leadMagnet.title', { template: ctx.locale === 'en' ? '{} cover' : '{} 표지' }) },
      name: ref('leadMagnet.title'),
      ...(typeof lm.format === 'string' ? { meta: ref('leadMagnet.format') } : {}),
      contentsTitle: u.magnetContentsTitle,
      contents: typeof lm.what === 'string' ? [ref('leadMagnet.what')] : [],
    }
    ctx.drop(p, 'copy.name') // 이름 칸은 선택 — 신청에 이름이 필요한지는 콘텐츠가 정하지 않았다
    c.consent = u.magnetConsent
    c.privacy = consent ? ref(consent) : u.consentRequired
    c.arrival = u.magnetArrival
    return p
  }
  return null
}

// ── 쪽 나누기 병합(FV1 Task 5.9 · BIND2) ─────────────────────────────────────────────────────────────────
// 쪽 나누기 부품 섹션(noBlock part = pagination)은 같은 쪽에 목록 표 블록(data-table)이 있으면 표가 표 아래에 함께 그린다 — 06 gen-pages 와 binder 빈자리 감사가 같은 규칙을 쓴다.
export const paginationMergedIntoTable = (page, s) =>
  s.status === 'part' && (s.parts ?? []).includes('pagination') && page.sections.some((x) => x.status === 'block' && (x.blockKinds ?? []).includes('data-table'))

// ── 목록 표(data-table, BIND2) ───────────────────────────────────────────────────────────────────────────
// 콘텐츠 `table`(columns: id·label·numeric / rows: 열 id → 값 — dashboard 가 search-filter binder 와 같은 모양으로 읽는다)을 표 블록의 TableData 로 잇는다.
// 열 이름·칸 값은 $ref 이고 열 id(칸 값의 열쇠)·행 번호(`row-N`)·열 종류(numeric|text)·정렬 가능 여부만 생성기가 정한다. 첫 열은 사람이 읽는 식별자(콘텐츠 규칙 「첫 열은 식별자」).
// 거르기 select 는 값이 2~8가지인 글자 열(첫 열 빼고)에서만 — 눌러도 거를 것이 없는 select 를 만들지 않는다. 행 상세 링크는 콘텐츠에 없어 싣지 않는다(가짜 링크 없음).
// 묶음 작업(bulk-select)은 정지·보관·지우기를 받아 줄 서버가 이 사이트에 없고 작업 이름도 콘텐츠에 없다 — 눌러도 되는 척하는 단추를 그리지 않는다(원형 허용 목록에서도 뺐다).
// 이름표(「전체 목록」·검색·정렬·쪽 이동·빈 상태 …)는 사실을 주장하지 않는 생성기의 ko/en 표다. 행이 없으면 지어내지 않고 빈 상태로 그린다.
export const TABLE_UI = {
  ko: {
    title: '전체 목록', caption: '목록 표', region: '목록 표', searchLabel: '목록 검색', searchHint: '표에서 찾기', filterAll: '전체', reset: '필터 초기화', count: '전체 {total}건 중 {shown}건',
    sort: { asc: '{column} 오름차순으로 정렬돼 있어요. 누르면 내림차순으로 바꿔요', desc: '{column} 내림차순으로 정렬돼 있어요. 누르면 정렬을 풀어요', hint: '누르면 {column} 순으로 정렬해요' },
    pager: { label: '쪽 이동', prev: '이전', next: '다음', range: '{from}–{to} / 전체 {total}건', page: '{page} / {pages}쪽' },
    empty: { title: '표시할 항목이 아직 없어요', body: '항목이 생기면 이 표에 보여요.' },
    noResults: { title: '조건에 맞는 항목이 없어요', body: '검색어나 거르기 조건을 바꾸거나 모두 풀어 보세요.', reset: '필터 초기화' },
    loading: '목록을 불러오는 중이에요', error: { title: '목록을 불러오지 못했어요', retryLabel: '다시 시도' }, viewAll: '전체 {total}건 보기',
  },
  en: {
    title: 'All records', caption: 'Records table', region: 'Records table', searchLabel: 'Search the list', searchHint: 'Find in the table', filterAll: 'All', reset: 'Clear filters', count: '{shown} of {total}',
    sort: { asc: 'Sorted by {column}, ascending. Press to sort descending', desc: 'Sorted by {column}, descending. Press to clear the sort', hint: 'Press to sort by {column}' },
    pager: { label: 'Pagination', prev: 'Previous', next: 'Next', range: '{from}–{to} of {total}', page: 'Page {page} of {pages}' },
    empty: { title: 'Nothing to show yet', body: 'Items show up in this table once they exist.' },
    noResults: { title: 'No items match', body: 'Change the search or the filters, or clear them all.', reset: 'Clear filters' },
    loading: 'Loading the list', error: { title: 'Could not load the list', retryLabel: 'Try again' }, viewAll: 'View all {total}',
  },
}
const SAFE_COLUMN_ID = /^[^.[\]$\s][^.[\]$]*$/ // 열 id 는 $ref 경로 조각이라 점·대괄호가 없어야 한다

function bindDataTable(ctx) {
  const variant = String(ctx.block).replace(/^block-data-table-/, '')
  if (variant === 'bulk-select') { ctx.why = '묶음 작업(정지·보관·지우기)을 받아 줄 서버가 이 사이트에 없고 작업 이름도 콘텐츠에 없다 — 눌러도 되는 척하는 단추를 그리지 않는다'; return null }
  if (variant !== 'admin-list' && variant !== 'compact') return null
  const table = at(ctx.content, 'table')
  const cols = isObj(table) ? arr(table.columns) : []
  if (!cols.length || !cols.every((c) => isObj(c) && typeof c.id === 'string' && SAFE_COLUMN_ID.test(c.id) && typeof c.label === 'string' && c.label.trim())) {
    ctx.why = '목록 표 자료(table.columns·rows)가 콘텐츠에 없다 — 열과 행을 지어내지 않는다'
    return null
  }
  const u = TABLE_UI[ctx.locale === 'en' ? 'en' : 'ko']
  const p = ctx.fixture
  const rawRows = arr(table.rows)
  const rows = rawRows
    .map((r, i) => (isObj(r) ? { id: `row-${i + 1}`, cells: Object.fromEntries(cols.filter((c) => r[c.id] !== undefined).map((c) => [c.id, ref(`table.rows.${i}.${c.id}`)])) } : null))
    .filter(Boolean)
  // 거르기 select: 첫 열 밖의 글자 열 중 모든 행에 값이 있고 서로 다른 값이 2~8가지인 열
  const facet = new Set()
  cols.forEach((c, ci) => {
    if (ci === 0 || c.numeric === true) return
    const vals = rawRows.map((r) => (isObj(r) ? r[c.id] : null))
    const distinct = new Set(vals.filter((v) => typeof v === 'string' && v.trim()))
    if (vals.length && vals.every((v) => typeof v === 'string' && v.trim()) && distinct.size >= 2 && distinct.size <= 8) facet.add(ci)
  })
  const columns = cols.map((c, ci) => ({
    id: c.id, label: ref(`table.columns.${ci}.label`), kind: c.numeric === true ? 'numeric' : 'text', sortable: true,
    ...(ci === 0 ? { primary: true } : {}), ...(variant === 'admin-list' && facet.has(ci) ? { filter: true } : {}), ...(ci >= 4 ? { secondary: true } : {}), // 4번째 열부터는 좁은 화면에서 숨긴다(열은 중요한 순)
  }))
  const base = { title: u.title, caption: u.caption, regionLabel: u.region, sort: u.sort, empty: u.empty, loading: u.loading, error: u.error }
  p.state = rows.length ? { status: 'ready', data: { columns, rows } } : { status: 'empty' }
  if (variant === 'compact') {
    // 작은 표는 받은 행을 모두 보인다 — 숨은 행에 닿는 길이 없으니 「전체 보기」 링크는 그려지지 않는다(링크가 필요한 prop 이라 이 쪽 경로를 둔다)
    p.copy = { ...base, viewAll: { label: u.viewAll, href: ctx.routes?.[String(ctx.key).split('/')[0]] ?? '#' } }
    p.limit = Math.max(rows.length, 1)
  } else {
    p.copy = { ...base, search: { label: u.searchLabel, placeholder: u.searchHint }, filterAll: u.filterAll, reset: u.reset, count: u.count, pager: u.pager, noResults: u.noResults }
  }
  return p
}

// ── 상품 정보·배송 반품(detail, BIND2) ────────────────────────────────────────────────────────────────────
// 고시 표(product-info)는 콘텐츠 `notice`(품목·항목 이름·값)에서, 사양(spec-and-notice 왼쪽)은 `specs`(이름·값)에서, 배송·반품 표(shipping-returns)는 `product.shipping`·`product.returns` 에서 온다.
// 항목 이름·값은 모두 $ref 다 — 블록은 고시 항목 이름을 모른다. 고시 항목의 행 id 는 법이 정한 항목 이름(제조국·A/S 책임자와 전화번호·품질보증기준)을 알아본 것뿐이다(핵심 먼저 변형이 고른다).
// 값이 없는 칸(도서산간 추가 배송비·환불 영업일)은 지어내지 않고 싣지 않는다 → 블록이 「확인 필요」로 그리고 07 ops-gate 가 공개를 막는다.
// 화면 이름표는 사실을 주장하지 않는 생성기의 ko/en 표다.
export const INFO_UI = {
  ko: { title: '상품 정보', factsTitle: '먼저 확인할 것', tableTitle: '상품정보제공고시 전체', specTitle: '사양', noticeTitle: '상품정보제공고시', notice: { caption: '상품정보제공고시 — {category}', columns: { label: '항목', value: '내용' }, unavailable: '제공할 수 없어요 — {reason}' } },
  en: { title: 'Product information', factsTitle: 'Check these first', tableTitle: 'Full product information notice', specTitle: 'Specifications', noticeTitle: 'Product information notice', notice: { caption: 'Product information notice — {category}', columns: { label: 'Item', value: 'Details' }, unavailable: 'Not available — {reason}' } },
}
// 법이 정한 고시 항목 이름 → 행 id(공정위 고시의 항목 이름 그대로 — 영어 사이트의 항목 이름은 같은 말이 아니라 알아보지 못한다)
const NOTICE_IDS = [['origin', /제조국|원산지/], ['as', /A\/S|AS\s*책임/i], ['warranty', /품질\s*보증/], ['maker', /제조자|수입자/], ['care', /세탁|취급/]]
const KEY_FACT_IDS = ['origin', 'as', 'warranty'] // 원형 핵심 과업의 답 — 제조국 · A/S 연락처 · 품질보증기준

function noticeOf(ctx) {
  const n = at(ctx.content, 'notice')
  const rows = isObj(n) ? arr(n.rows) : []
  if (ctx.content.archetype !== 'detail' || !isObj(n) || typeof n.category !== 'string' || !n.category.trim() || !rows.length) { ctx.why = '상품정보제공고시 자료(notice.category·rows)가 콘텐츠에 없다'; return null }
  const used = new Set()
  const out = []
  rows.forEach((r, i) => {
    if (!isObj(r) || typeof r.label !== 'string' || !r.label.trim()) return
    const known = NOTICE_IDS.find(([id, rx]) => !used.has(id) && rx.test(r.label))
    if (known) used.add(known[0])
    out.push({ id: known ? known[0] : `row-${i + 1}`, label: ref(`notice.rows.${i}.label`), ...(typeof r.value === 'string' && r.value.trim() ? { value: ref(`notice.rows.${i}.value`) } : {}) })
  })
  return out.length ? { category: ref('notice.category'), rows: out } : null
}

function bindProductInfo(ctx) {
  const p = ctx.fixture
  const notice = noticeOf(ctx)
  if (!notice) return null
  const u = INFO_UI[ctx.locale === 'en' ? 'en' : 'ko']
  const variant = String(ctx.block).replace(/^block-product-info-/, '')
  p.notice = notice
  delete p.asOf
  p.copy = { title: u.title, notice: u.notice }
  if (variant === 'key-facts-first') {
    p.highlight = KEY_FACT_IDS.filter((id) => notice.rows.some((r) => r.id === id))
    if (!p.highlight.length) { ctx.why = '고시 표에 먼저 보일 핵심 항목(제조국·A/S 연락처·품질보증기준)이 없다'; return null }
    Object.assign(p.copy, { factsTitle: u.factsTitle, tableTitle: u.tableTitle })
  } else if (variant === 'spec-and-notice') {
    const specs = arr(at(ctx.content, 'specs'))
    p.specs = specs.map((s, i) => (isObj(s) && typeof s.label === 'string' && s.label.trim() && typeof s.value === 'string' && s.value.trim() ? { id: `spec-${i + 1}`, label: ref(`specs.${i}.label`), value: ref(`specs.${i}.value`) } : null)).filter(Boolean)
    if (!p.specs.length) { ctx.why = '사양 자료(specs)가 콘텐츠에 없다 — 사양 항목을 지어내지 않는다'; return null }
    Object.assign(p.copy, { specTitle: u.specTitle, noticeTitle: u.noticeTitle })
  } else if (variant !== 'notice-table') return null
  return p
}

export const POLICY_UI = {
  ko: {
    title: '배송·반품 안내', returnTitle: '반품은 이렇게 해요', detailTitle: '자세한 조건', shippingCaption: '배송', returnsCaption: '반품·교환·환불', stepsTitle: '반품 순서', tableCaption: '배송·반품 조건', columns: { label: '항목', value: '안내' },
    steps: [
      { title: '반품 신청', body: '받은 날부터 정해진 기한 안에 판매자에게 반품한다고 알려 주세요.' },
      { title: '상품 보내기', body: '받은 상품을 처음 온 포장 그대로 보내 주세요.' },
      { title: '상태 확인', body: '도착한 상품의 상태를 확인하고 그 결과를 알려 드려요.' },
      { title: '환불', body: '상품이 도착한 날부터 {days}영업일 안에 결제한 수단으로 돌려 드려요.' },
    ],
    vatIncluded: '표시한 금액은 모두 부가세(VAT)가 포함된 금액이에요', vatExcluded: '표시한 금액에는 부가세(VAT)가 포함돼 있지 않아요',
    policy: {
      labels: { method: '배송 방법', lead: '출고', fee: '배송비', remote: '도서산간·제주', withdrawal: '단순 변심 반품 기한', returnFee: '반품 배송비', exclusions: '반품이 안 되는 경우', defect: '상품이 다르거나 하자가 있을 때', refund: '환불' },
      lead: '주문 후 {days}영업일 안에 보내요', leadSame: '주문한 날 바로 보내요', freeOver: '{threshold} 이상 주문하면 무료예요', free: '무료예요', remote: '{amount}이 더 들어요', remoteNone: '추가 비용이 없어요',
      withdrawal: '상품을 받은 날부터 {days}일 안에 신청할 수 있어요', returnFeeBuyer: '단순 변심이면 반품 배송비는 구매자가 내요', returnFeeBuyerAmount: '단순 변심이면 반품 배송비 {fee}을 구매자가 내요', returnFeeSeller: '반품 배송비는 판매자가 내요(무료 반품)',
      exclusionsNote: '전자상거래법에 따라 아래 경우에는 청약철회를 할 수 없어요', exclusionsNone: '따로 정한 불가 사유는 없어요',
      defect: '받은 날부터 {months}개월 안, 문제를 안 날부터 {days}일 안에 교환·반품할 수 있고 배송비는 판매자가 내요', refund: '반품 상품이 도착한 날부터 {days}영업일 안에 환불해요. 늦어지면 지연배상금을 드려요',
    },
  },
  en: {
    title: 'Shipping and returns', returnTitle: 'How returns work', detailTitle: 'Details', shippingCaption: 'Shipping', returnsCaption: 'Returns, exchanges and refunds', stepsTitle: 'Return steps', tableCaption: 'Shipping and return terms', columns: { label: 'Item', value: 'Details' },
    steps: [
      { title: 'Request a return', body: 'Tell the seller you want to return the item within the return window, counted from the day you received it.' },
      { title: 'Send it back', body: 'Send the item back in the packaging it came in.' },
      { title: 'We check it', body: 'We check the condition of the returned item and let you know the result.' },
      { title: 'Refund', body: 'We refund the payment method you used within {days} business days of the item arriving.' },
    ],
    vatIncluded: 'All amounts shown include VAT', vatExcluded: 'Amounts shown do not include VAT',
    policy: {
      labels: { method: 'Shipping method', lead: 'Dispatch', fee: 'Shipping fee', remote: 'Remote areas and islands', withdrawal: 'Change-of-mind return window', returnFee: 'Return shipping', exclusions: 'Items that cannot be returned', defect: 'Wrong or defective items', refund: 'Refund' },
      lead: 'Ships within {days} business days of your order', leadSame: 'Ships the same day you order', freeOver: 'Free on orders of {threshold} or more', free: 'Free', remote: '{amount} extra', remoteNone: 'No extra charge',
      withdrawal: 'You can request a return within {days} days of receiving the item', returnFeeBuyer: 'If you change your mind, you pay the return shipping', returnFeeBuyerAmount: 'If you change your mind, you pay {fee} for return shipping', returnFeeSeller: 'We pay the return shipping (free returns)',
      exclusionsNote: 'The items below cannot be returned', exclusionsNone: 'No items are excluded from returns',
      defect: 'If the item is wrong or defective, you can exchange or return it within {months} months of receiving it and within {days} days of finding the problem, and we pay the shipping', refund: 'We refund within {days} business days of the returned item arriving. If we are late, we pay late-payment compensation',
    },
  },
}

function bindShippingReturns(ctx) {
  if (ctx.content.archetype !== 'detail') return null
  const prod = at(ctx.content, 'product')
  const sh = isObj(prod) ? prod.shipping : null
  const rt = isObj(prod) ? prod.returns : null
  if (!isObj(sh) || typeof sh.fee !== 'number') { ctx.why = '배송 칸(product.shipping)이 콘텐츠에 없다'; return null }
  if (!isObj(rt) || typeof rt.withdrawalDays !== 'number' || !['buyer', 'seller'].includes(rt.feePayer)) { ctx.why = '반품 칸(product.returns)이 콘텐츠에 없다'; return null }
  const p = ctx.fixture
  const u = POLICY_UI[ctx.locale === 'en' ? 'en' : 'ko']
  const variant = String(ctx.block).replace(/^block-shipping-returns-/, '')
  p.facts = {
    shipping: {
      ...(typeof sh.courier === 'string' && sh.courier.trim() ? { method: ref('product.shipping.courier') } : {}),
      ...(typeof sh.leadDays === 'number' ? { leadDays: ref('product.shipping.leadDays') } : {}),
      fee: ref('product.shipping.fee'),
      ...(typeof sh.freeThreshold === 'number' ? { freeThreshold: ref('product.shipping.freeThreshold') } : {}),
      ...(sh.remoteExtra !== undefined ? { remoteExtra: ref('product.shipping.remoteExtra') } : {}),
      currency: typeof prod.currency === 'string' ? ref('product.currency') : 'KRW',
      minor: true, // 상세페이지 금액은 최소 단위 정수(원·센트)다
      locale: ctx.locale === 'en' ? 'en-US' : 'ko-KR',
    },
    returns: {
      feePayer: ref('product.returns.feePayer'),
      withdrawalDays: ref('product.returns.withdrawalDays'),
      ...(Array.isArray(rt.exclusions) ? { exclusions: ref('product.returns.exclusions') } : {}),
      ...(typeof rt.refundDays === 'number' ? { refundDays: ref('product.returns.refundDays') } : {}),
    },
  }
  const vat = typeof prod.taxIncluded === 'boolean' ? (prod.taxIncluded ? u.vatIncluded : u.vatExcluded) : null
  const policy = { ...u.policy, vatNote: vat ?? '' }
  if (variant === 'policy-tables') p.copy = { title: u.title, shippingCaption: u.shippingCaption, returnsCaption: u.returnsCaption, columns: u.columns, policy }
  else if (variant === 'at-a-glance-cards') p.copy = { title: u.title, detailTitle: u.detailTitle, policy }
  else if (variant === 'return-steps') p.copy = { title: u.returnTitle, stepsTitle: u.stepsTitle, tableCaption: u.tableCaption, columns: u.columns, steps: u.steps, policy }
  else return null
  return p
}

export const TOAST_UI = {
  ko: { title: '새 판이 나왔어요', update: '지금 새로 고침', later: '나중에' },
  en: { title: 'A new version is available', update: 'Refresh now', later: 'Later' },
}

export const BINDERS = {
  'data-table': bindDataTable, 'product-info': bindProductInfo, 'shipping-returns': bindShippingReturns,
  'lead-capture': bindLeadCapture,
  'dashboard-panel': bindDashboardPanel,
  hero: bindHero, faq: bindFaq, pricing: bindPricing, features: bindFeatures, 'social-proof': bindSocialProof, integrations: bindIntegrations,
  'final-cta': bindFinalCta, footer: bindFooter, 'bottom-tab': bindBottomTab, trust: bindTrust, 'menu-price': bindMenuPrice, 'hours-location': bindHoursLocation, confirmation: bindConfirmation,
  'review-list': bindReviewList,
  nav: bindNav, announcement: bindAnnouncement, 'contact-form': bindContactForm, 'product-list': bindProductList, 'filter-bar': bindFilterBar,
}

// ── 화면 문구 칸(C112) ────────────────────────────────────────────────────────────────────────────
// 제품 화면(로그인·가입·계정·결제·해지·완료·동의)과 문의 폼은 블록 예시의 안내 문장에 예시 표지·가상 도메인·지어낸 숫자가 있다. 이 종류의 섹션은 04-content 가
// 남은 예시 잎마다 문구 칸("<쪽>/<섹션>/ui:<잎 경로>")을 요청하고, 06-pages 가 그 문구를 $ref 로 잇는다. 잎이 너무 많은 블록(> MAX_UI_SLOTS)은 요청하지 않는다(폴백이 다른 변형을 본다).
export const UI_SLOT_KINDS = new Set(['auth', 'consent', 'account', 'paywall', 'retention', 'confirmation', 'onboarding', 'state-screen', 'contact-form'])
export const MAX_UI_SLOTS = 12
// binder 가 이미 콘텐츠로 묶는 잎(접두) — 문구 칸으로 요청하지 않는다.
export const UI_CLAIMS = {
  confirmation: ['copy.calendar', 'copy.help.phone', 'booking'],
  'contact-form': ['copy.call.number', 'call', 'kakao'],
  hero: ['copy.title', 'copy.titleLines', 'copy.lines', 'copy.lede', 'copy.primaryCta', 'copy.secondaryCta', 'copy.captionLines', 'copy.services', 'copy.slides', 'copy.stageLabel', 'copy.branches', 'copy.objects', 'copy.rightsNote'], // slides: bindHero 가 장면 이름을 서수 이름표로 바꾼다(C296) — 03 readiness 가 이것을 「못 채움」으로 읽어 깨끗한 변형(vertical-title-slides)을 늘 피했다(EXLEAK)
  'final-cta': ['copy.title', 'copy.primary', 'copy.secondary'],
}
// 마커만 남은 블록에만 문구 칸을 요청하는 종류: 히어로·마지막 행동 띠는 가상 데모(수치·앱 창)가 붙은 변형이 있다 — 숫자·이름이 남은 블록은 요청하지 않는다(지어낸 수치를 쓰게 하지 않는다).
// 캡션·이름표처럼 예시 표지만 남은 블록은 문구 칸으로 다시 쓴다.
export const UI_MARKER_ONLY_KINDS = new Set(['hero', 'final-cta'])

// 예시 문구가 사실(가격·목록·수치·후기)을 담는 블록 — 묶는 binder 가 없거나 null 이면 그리지 않는다(예시 사실을 싣지 않는다).
export const FACT_KINDS = new Set(['product-list', 'review-list', 'dashboard-panel', 'social-proof', 'pricing', 'features', 'integrations', 'menu-price', 'hours-location', 'trust', 'footer', 'faq', 'bottom-tab', 'announcement', 'lead-capture', 'referral', 'contact-form', 'filter-bar', 'data-table', 'product-info', 'shipping-returns'])
// 예시 모듈이 이름표·구조 문구뿐이고 데이터는 포트(목·어댑터)가 주는 블록 — binder 없이 예시 문구를 쓰되 표지 검사를 받는다.
export const LABEL_KINDS = new Set(['auth', 'consent', 'account', 'state-screen', 'paywall', 'retention', 'confirmation', 'onboarding', 'hero', 'final-cta'])
