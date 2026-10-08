// 06-pages 의 사이트 일관성 손질(P3-4 P4CON — 골든 법률 검토·첫 실측 07-qa 가 잡은 사이트 안 어긋남). 순수 함수만 둔다(생성기 gen-pages 가 부른다).
//   · linkLegalRoutes   블록 예시가 적은 법정 링크(#terms·#privacy 등 — 사이트에 없는 앵커)를 사이트맵의 실제 법정 쪽 경로(/terms·/privacy)로 잇는다
//   · applyWithdrawalPolicy  운영자가 정한 철회 정책(legal.withdrawalPolicy)이 full 이면 결제 블록의 철회 제한 고지·필수 체크를 뺀다 — 환불 정책 글과 같은 사실 하나가 둘을 정한다
//   · cookieCategoriesOf     고른 동의 블록이 실제로 묻는 쿠키 항목 — 처리방침 초안이 그 항목만 적는다
import { at, delLeaf, isRef, leaves, pathKeys, pathOf, resolveRefs, setLeaf } from './site-bind.mjs'

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

// ── 법정 링크 ───────────────────────────────────────────────────────────
/** 블록 예시의 법정 앵커 → 원형 법정 쪽 id. 잎 값이 이 앵커와 정확히 같을 때만 바꾼다(다른 앵커는 그대로). */
export const LEGAL_ANCHORS = { '#terms': 'terms', '#privacy': 'privacy', '#refund': 'refund', '#withdrawal': 'withdrawal' }

/**
 * props 안의 법정 앵커 잎을 실제 경로로 바꾼다(제자리). routes = { <쪽 id>: <경로> }(사이트맵).
 * @returns {{ linked: { path: string, from: string, to: string }[], dead: { path: string, anchor: string, page: string }[] }}
 *   dead = 이어질 법정 쪽이 사이트맵에 없어 앵커가 그대로 남은 잎(공개 불가 사유)
 */
export function linkLegalRoutes(props, routes) {
  const linked = []
  const dead = []
  for (const l of leaves(props)) {
    if (typeof l.value !== 'string') continue
    const page = LEGAL_ANCHORS[l.value.trim()]
    if (!page) continue
    const to = routes?.[page]
    if (typeof to === 'string' && to.startsWith('/')) {
      setLeaf(props, l.path, to)
      linked.push({ path: l.path, from: l.value, to })
    } else dead.push({ path: l.path, anchor: l.value, page })
  }
  return { linked, dead }
}

// ── 철회 정책 ───────────────────────────────────────────────────────────
/** 결제 블록(paywall 네 변형)의 철회 고지·필수 체크 칸 경로 — PlanOffer 카피. */
export const WITHDRAWAL_COPY_PATH = 'copy.offer.withdrawal'

/**
 * 철회 정책이 "full"(사업자가 제한을 두지 않는다)이면 결제 블록의 철회 제한 고지·필수 체크(copy.offer.withdrawal)를 뺀다.
 * "limited"이거나 정해지지 않았으면 그대로 둔다(정해지지 않은 건 법정 쪽의 「확인 필요」 사유가 잡는다).
 * @param {Record<string, { block?: string, props?: any }>} sections
 * @returns {string[]} 고지·체크를 뺀 섹션 키
 */
export function applyWithdrawalPolicy(sections, policy) {
  if (policy !== 'full') return []
  const out = []
  for (const [key, sec] of Object.entries(sections)) {
    const offer = sec?.props?.copy?.offer
    if (isObj(offer) && 'withdrawal' in offer) {
      delete offer.withdrawal
      out.push(key)
    }
  }
  return out
}

/** 결제 블록이 철회 고지·필수 체크를 그리는 섹션 키(정책과 화면이 맞는지 검사하는 쪽이 쓴다). */
export const sectionsWithWithdrawalNotice = (sections) =>
  Object.entries(sections).filter(([, s]) => isObj(s?.props?.copy?.offer) && 'withdrawal' in s.props.copy.offer).map(([k]) => k)

// ── 쿠키 항목 ───────────────────────────────────────────────────────────
const CATEGORY_LABEL = { ko: { analytics: '방문 분석', marketing: '마케팅' }, en: { analytics: 'Analytics', marketing: 'Marketing' } }
const CATEGORY_ORDER = ['analytics', 'marketing']

/**
 * 고른 동의 블록(쿠키 설정 창·하단 띠·지도 자리 안내)이 실제로 묻는 쿠키 항목. 처리방침 초안이 이 항목만 적는다.
 *   preference-dialog  분석·마케팅 스위치 둘(문구는 블록 카피 그대로)
 *   bottom-banner      [모두 허용·거부]가 분석·마케팅 둘을 함께 정한다
 *   inline-notice      props.category 하나
 * @returns {{ id: 'analytics'|'marketing', label: string, body?: string }[]}  분석 → 마케팅 순서, 중복 없음
 */
export function cookieCategoriesOf(sections, content, locale = 'ko') {
  const byId = new Map()
  const put = (id, label, body) => {
    if (!CATEGORY_ORDER.includes(id)) return
    const prev = byId.get(id)
    byId.set(id, { id, label: prev?.label ?? label, ...(prev?.body || body ? { body: prev?.body ?? body } : {}) })
  }
  const text = (v) => {
    const got = isRef(v) ? at(content, v.$ref) : v
    return typeof got === 'string' && got.trim() ? got.trim() : undefined
  }
  for (const sec of Object.values(sections)) {
    const block = sec?.block ?? ''
    if (!/-consent-(?:preference-dialog|bottom-banner|inline-notice)$/.test(block)) continue
    const props = resolveRefs(sec.props, content)
    if (/preference-dialog$/.test(block)) {
      for (const id of CATEGORY_ORDER) {
        const c = props?.copy?.categories?.[id]
        put(id, text(c?.label) ?? CATEGORY_LABEL[locale]?.[id] ?? id, text(c?.body))
      }
    } else if (/bottom-banner$/.test(block)) {
      for (const id of CATEGORY_ORDER) put(id, CATEGORY_LABEL[locale]?.[id] ?? id)
    } else if (/inline-notice$/.test(block)) {
      const id = props?.category
      if (typeof id === 'string') put(id, CATEGORY_LABEL[locale]?.[id] ?? id)
    }
  }
  return CATEGORY_ORDER.filter((id) => byId.has(id)).map((id) => byId.get(id))
}

// ── 앱 화면 앵커(FINAL-WF2 AB15) ────────────────────────────────────────────────────────
/** 블록 예시의 앱 화면 앵커 → 사이트맵의 쪽 id(null 이면 이 사이트에 이어질 쪽이 생길 수 없다 — 예시 앱의 「예약 페이지 만들기」 같은 화면). */
export const APP_ANCHORS = {
  '#sign-in': 'login', '#sign-up': 'signup', '#password-reset': 'password-reset', '#settings-credentials': 'account',
  '#create-page': null, '#help-start': null, '#share-link': null, '#alerts': null, '#invite-staff': null,
  // FINAL-WF6 WF4a — 온보딩 블록의 「건너뛰기」(#dashboard)·「예시 먼저 보기」(#sample): 예시 앱 화면이라 이어질 쪽이 없다 — 선택 칸이면 링크를 빼고, 필수면 계정 쪽·홈으로
  '#dashboard': null, '#sample': null,
}

/**
 * props 안의 앱 화면 앵커 잎(`href: "#sign-in"` …)을 사이트의 실제 경로로 바꾼다(제자리). 이어질 쪽이 사이트에 없으면 그 링크를 뺀다 —
 * 링크가 든 칸이 선택이면 그 칸을, 아니면 선택인 가장 가까운 윗칸을 통째로 뺀다(링크만 남은 빈 단추를 그리지 않는다). 뺄 수 없으면 dead 로 남긴다(빌드 뒤 링크 검사가 막는다).
 * @param {Set<string>} optional  블록 소스의 선택 칸 이름(`optionalKeys`)
 * @param {Record<string, string|null>} [extra]  쪽마다 다른 앵커의 행선지(FINAL-WF6 — `#pricing`·`#cookie-settings`: 그 쪽에 없는 섹션 id 를 사이트 전체에서 찾은 결과).
 *   문자열이면 그 주소로, null 이면 이어질 곳이 없다 — 선택 칸이면 뺀다(필수면 dead 로 남기고, 예시 앱 화면용 홈 대체는 하지 않는다).
 */
export function linkAppRoutes(props, routes, optional, extra = {}) {
  const linked = []
  const dropped = []
  const dead = []
  for (let round = 0; round < 12; round++) {
    let again = false
    for (const l of leaves(props)) {
      if (typeof l.value !== 'string' || !(Object.hasOwn(APP_ANCHORS, l.value.trim()) || Object.hasOwn(extra, l.value.trim())) || !/(?:^|\.)href$/.test(l.path)) continue
      const anchor = l.value.trim()
      const viaExtra = Object.hasOwn(extra, anchor)
      const page = Object.hasOwn(APP_ANCHORS, anchor) ? APP_ANCHORS[anchor] : null
      const to = viaExtra ? extra[anchor] : page ? routes?.[page] : null
      if (typeof to === 'string' && to.startsWith('/')) { setLeaf(props, l.path, to); linked.push({ path: l.path, from: anchor, to }); again = true; continue }
      const keys = pathKeys(l.path).slice(0, -1) // href 를 든 객체까지
      let cut = 0
      for (let n = keys.length; n >= 1; n--) if (typeof keys[n - 1] === 'string' && optional.has(keys[n - 1])) { cut = n; break }
      if (cut) { const target = pathOf(keys.slice(0, cut)); delLeaf(props, target); dropped.push({ path: target, anchor }); again = true; break }
      // 뺄 수 없는 필수 링크(가입 완료의 다음 행동)가 예시 앱 화면(page null)을 가리키면 이 사이트의 계정 쪽, 없으면 홈으로 — 죽은 앵커보다 닿는 곳이 낫다
      const fallback = page === null && !viaExtra ? (routes?.account ?? routes?.home) : null
      if (typeof fallback === 'string' && fallback.startsWith('/')) { setLeaf(props, l.path, fallback); linked.push({ path: l.path, from: anchor, to: fallback }); again = true; continue }
      if (!dead.some((d) => d.path === l.path)) dead.push({ path: l.path, anchor })
    }
    if (!again) break
  }
  return { linked, dropped, dead }
}

// ── 쪽에 없는 섹션 앵커(FINAL-WF6 C426·WF4a) ────────────────────────────────────────────────
/**
 * 블록 예시의 `#pricing`(구독 관리의 「요금제 고르기」)·`#cookie-settings`(푸터·배너의 「쿠키 설정」)는 같은 쪽에 그 섹션이 있을 때만 닿는다.
 * 쪽(`here`)에 그 id 가 없으면 사이트 전체에서 그 id 를 그린 쪽을 찾아 `<경로>#<id>` 로, 없으면 요금제는 요금제 쪽 경로로, 쿠키는 null(이어질 곳 없음 — 호출자가 링크를 뺀다).
 * @param {{ here: string, idsByPage: Map<string, Set<string>>, routes: Record<string, string>, pricing?: { page: string, id: string } | null, pricingIds?: string[] }} input
 *   idsByPage = 쪽 id → 그 쪽에 그려지는 섹션 id 집합(전역은 'global' — 모든 쪽에 닿는다). pricing = 실제로 그려진 요금제 섹션(없으면 null).
 *   pricingIds = 요금제 섹션 앵커로 쓰였을 id 들(`pricing` 외 — 03 이 어림한 id 가 안 그려졌을 때 그 앵커도 같이 푼다).
 * @returns {Record<string, string|null>}  `linkAppRoutes` 의 extra
 */
export function pageAnchorTargets({ here, idsByPage, routes, pricing = null, pricingIds = [] }) {
  const has = (page, id) => !!(idsByPage.get(page)?.has(id) || idsByPage.get('global')?.has(id))
  const host = (id) => [...idsByPage].find(([p, ids]) => p !== 'global' && ids.has(id))?.[0] ?? null
  const to = (page, id) => (typeof routes?.[page] === 'string' ? `${routes[page]}#${id}` : null)
  const out = {}
  if (!has(here, 'cookie-settings')) out['#cookie-settings'] = host('cookie-settings') ? to(host('cookie-settings'), 'cookie-settings') : null
  for (const id of new Set(['pricing', ...pricingIds])) {
    if (has(here, id)) continue
    const where = host(id)
    out[`#${id}`] = where ? to(where, id) : pricing && has(pricing.page, pricing.id) ? to(pricing.page, pricing.id) : routes?.pricing ?? null
  }
  return out
}
