// 법정 페이지 초안(J13 1단계, §9 Q19: 초안 → 법률 AI 에이전트 → 대표 최종 검토).
// 콘텐츠 객체 하나에서 페이지마다 markdown 과 조항 목록을 만든다. 조항마다 검토할 법·조(needs)를 달아
// 법률 에이전트(factory/legal/AGENT.md)가 현행 조문과 대조해 07-qa/legal/<page>.review.json 을 쓴다.
//
// 입력 콘텐츠(사실만 — 없는 값은 지어내지 않고 「확인 필요」/"To be confirmed" 로 그린다):
//   content.business  content-core `Business`(name·representative·bizRegNo·mailOrderNo·address·phone·email)
//   content.legal     법정 페이지 전용 사실(모두 선택):
//     collects: { item, purpose, retention }[]   수집 항목(폼·가입·결제에서 실제로 받는 것)
//     processors: { name, task, country? }[]     처리 위탁·전송처(어댑터: 호스팅·메일·결제·계측)
//     officer: { name, contact }                 개인정보 보호책임자
//     marketingConsent: boolean                  광고성 정보 수신 동의를 받는가(true 면 privacy.marketing 조항)
//     marketingChannels: string[]                동의를 받는 채널(예: ["이메일", "문자", "푸시"]) — marketingConsent 일 때 빈 사실이면 「확인 필요」
//     ageGate: 14 | "guardian"                   만 14세 미만 처리 — 14 = 가입 차단·나이 확인, "guardian" = 법정대리인 동의(계약 페이지가 있는 원형은 빈 사실이면 「확인 필요」)
//     paymentProvider: string                    결제 공급자(예: "paddle", "toss") — 유료면 빈 사실이면 「확인 필요」
//     trial: string                              무료 체험 사실(없으면 content.facts.trial 또는 요금제 trialDays 로 본다)
//     paperRecords: boolean                      종이 문서를 실제로 보관·파기하는가(true 일 때만 종이 파기 문장)
//     security: string[]                         개인정보 안전성 확보 조치(시행령 제31조①3 — 방침 필수 기재, 빈 사실이면 「확인 필요」)
//     autoCollect: boolean · autoCollectItems: string[]   이용 통계 등 자동 수집 장치를 쓰는가 · 그 항목과 도구(autoCollect 일 때 privacy.autoCollect 조항)
//     withdrawalPolicy: "full" | "limited"       청약철회 정책(full = 결제 뒤 기간 안 이용 여부 무관 철회 허용, limited = 제공 개시 부분 철회 불가) — 유료 환불 쪽, 운영자가 정한다. 빈 사실이면 「확인 필요」
//     provisionTiming: string                    서비스 이용 시작 시기(예: "결제 직후") — terms.service, 빈 사실이면 「확인 필요」
//     retention: string | string[]               보관 기간 또는 기간을 정하는 기준(en privacy.retention — 항목마다 collects[].retention 이 있으면 그것이 먼저, 없으면 이 사실. GDPR 제13조②(a))
//     returnAddress·warranty: string             반품 보낼 곳·상품 보증/사후 서비스(ko·en 물품이 함께 읽는다) · withdrawalFunction: string  온라인 철회 기능이 어디 있는지(en 물품 withdrawal.how, 소비자권리지침 제11a조 — 없으면 빈 사실)
//     officer.self: boolean                     대표자가 개인정보 보호책임자(소상공인 — 법 제31조②·시행령 제32조①). true 면 대표자·회사 연락처로 채운다
//   유료·체험 판정은 legalContext(content, archetype) — 요금제 가격·결제 공급자·원형의 환불/청약철회 페이지로 유료, 체험 사실이 있고 유료면 무료→유료 전환 조항.
//   조문이 아니라 관행·회사 약속인 문장은 조항의 notes[{ kind: "convention", text }] 에 밝힌다(법률 에이전트가 판정에 반영).
//     governingLaw: string                       준거법(en 약관)
//     effectiveDate: string                      시행일(YYYY-MM-DD)
//   archetype.legal = { pages: LegalPage[], laws: { ko: string[], en: string[] } }  (원형 JSON v1, P3-3 Task 1)

export const LEGAL_PAGES = ["privacy", "terms", "refund", "withdrawal"]
export const PLACEHOLDER = { ko: "확인 필요", en: "To be confirmed" }

const PIPA = "개인정보 보호법"
const ECOM = "전자상거래 등에서의 소비자보호에 관한 법률"
const TERMS_ACT = "약관의 규제에 관한 법률"
const NETWORK_ACT = "정보통신망 이용촉진 및 정보보호 등에 관한 법률"
// 시행령은 law-api 가 「<법률명> 시행령」 으로 찾는다(decreeName). 기간·예외·기준이 시행령에 있는 조항은 needs 에 시행령을 함께 단다.
const PIPA_DECREE = `${PIPA} 시행령`
const ECOM_DECREE = `${ECOM} 시행령`
const NETWORK_DECREE = `${NETWORK_ACT} 시행령`
const GDPR = "GDPR (Regulation (EU) 2016/679)"
const CCPA = "CCPA (Cal. Civ. Code)"
const CRD = "Consumer Rights Directive 2011/83/EU"
const UCTD = "Unfair Contract Terms Directive 93/13/EEC"
const ROME1 = "Rome I Regulation (EC) No 593/2008"
const PADDLE = "Paddle Buyer Terms"

const need = (law, ...articles) => articles.map((article) => ({ law, article }))

/** 사실 읽기 도우미 — 값이 비면 placeholder 를 돌려주고 missing 에 경로를 남긴다. f.miss(path) 는 값이 있어도 못 쓰는 사실을 빈 사실로 남긴다. */
function factReader(content, locale) {
  const ph = PLACEHOLDER[locale]
  const reader = (missing) => {
    const f = (path) => {
      const v = path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), content)
      // 자리 표시 글자(ko 「확인 필요」·en "To be confirmed" — content-core NEEDS_CHECK)가 값으로 들어와도 빈 사실이다(대장 C102): 04-content 가 빈 사실 자리에
      // 그 글자를 적어 스키마 검사를 통과시키므로, 여기서 값으로 읽으면 조항에 missing 이 안 남아 legal-gate·ops-gate 가 놓친다.
      const empty = v == null || (typeof v === "string" && (v.trim() === "" || Object.values(PLACEHOLDER).includes(v.trim()))) || (Array.isArray(v) && v.length === 0)
      if (empty) {
        missing.push(path)
        return ph
      }
      return v
    }
    // 서로 어긋나 어느 쪽도 고를 수 없는 사실(예: 철회 정책 full 인데 철회 제한 사유가 있다)은 빈 사실로 남긴다
    f.miss = (path) => {
      missing.push(path)
      return ph
    }
    return f
  }
  reader.locale = locale
  return reader
}

/**
 * 영어 초안의 빈 사실 이름표(FINAL-WF4 EN9): 「To be confirmed: <무엇>」 한 줄에 쓰는 사람이 읽는 이름. 표에 없는 경로는 경로 그대로.
 * 한국어 초안은 예전 그대로(문장 가운데 「확인 필요」)라 이 표를 쓰지 않는다.
 */
const EN_FACT_LABELS = {
  'business.name': 'business name', 'business.address': 'business address', 'business.email': 'contact email', 'business.phone': 'contact phone',
  'legal.collects': 'data collected and why', 'legal.processors': 'processors and transfers', 'legal.retention': 'retention periods', 'legal.effectiveDate': 'effective date',
  'legal.governingLaw': 'governing law', 'legal.paymentProvider': 'payment provider', 'legal.withdrawalPolicy': 'withdrawal policy (full or limited)',
  'legal.returnAddress': 'return address', 'legal.warranty': 'after-sales service and guarantees', 'legal.withdrawalFunction': 'online withdrawal function',
  'product.taxIncluded': 'whether prices include VAT', 'product.price': 'price',
}
const enFactLabel = (path) => EN_FACT_LABELS[path] ?? (/\.feePayer$/.test(path) ? 'who pays for returning the goods' : /\.exclusions$/.test(path) ? 'exceptions to the right of withdrawal' : /\.(?:courier)$/.test(path) ? 'courier' : /\.fee$/.test(path) ? 'delivery fee' : /\.leadDays$/.test(path) ? 'shipping time' : path.replace(/\.\d+\./g, '.'))

/** notes: 조문으로 확인되지 않는 문장의 출처 메모([{ kind, text }]) — 법률 에이전트가 읽는다. */
function clause(reader, id, title, needs, body, extra = {}) {
  const missing = []
  let text = body(reader(missing))
  // 영어(FINAL-WF4 EN9): 빈 사실이 문장 가운데 "To be confirmed" 로 끼면 문장이 깨지고 읽는 사람이 무엇이 비었는지 모른다 — 빈 사실이 하나라도 있으면 조항 전체를 「To be confirmed: <무엇>」 한 줄로.
  // 법률 에이전트·legal-gate 는 missing 경로로 읽으므로 그대로다. 한국어는 예전 그대로.
  if (reader.locale === "en" && missing.length) text = `${PLACEHOLDER.en}: ${[...new Set(missing.map(enFactLabel))].join("; ")}.`
  return { id, title, text, needs, ...(extra.notes?.length ? { notes: extra.notes } : {}), ...(missing.length ? { missing: [...new Set(missing)] } : {}) }
}

const isObj = (v) => v != null && typeof v === "object" && !Array.isArray(v)
/** 물품(재화)을 파는 원형 — 나머지는 콘텐츠에 상품 배송 사실(product.shipping)이 있을 때만 물품으로 본다. */
const GOODS_ARCHETYPES = new Set(["detail", "commerce"])

const filled = (v) => v != null && !(typeof v === "string" && (v.trim() === "" || Object.values(PLACEHOLDER).includes(v.trim()))) && !(Array.isArray(v) && v.length === 0)

/**
 * 어떤 조항을 넣을지 정하는 조건. 콘텐츠·원형이 말하는 것만 본다(지어내지 않는다).
 *   paid    유료: legal.paymentProvider 가 있거나, 값이 있는 요금제(plans)가 있거나, 원형이 환불·청약철회 페이지를 둔다
 *   trial   무료 체험: legal.trial 또는 facts.trial 이 있거나, 요금제에 trialDays > 0
 *   goods    물품 판매: 원형이 detail·commerce 이거나 콘텐츠에 상품 배송(product.shipping)이 있다 — 철회 기산일(상품을 받은 날)·환급(상품을 돌려받은 날)·반품 배송비·선지급 보호 조항이 서비스 문장을 대신한다
 *   recurring 정기결제: 서비스는 paid 와 같다. 물품은 콘텐츠에 월·연 요금제 가격이나 체험 사실이 있을 때만(없으면 정기결제·체험 문장을 쓰지 않는다)
 *   trialConversion  trial 이면서 recurring — 무료→유료 전환 조항
 *   contract 이용약관 페이지를 둔다(계정·계약이 있는 사이트)
 *   marketing 광고성 정보 수신 동의를 받는다(legal.marketingConsent === true)
 *   ageGate  가입·계약이 있거나(legal.ageGate 값이 있거나) 이용약관 페이지가 있다 — 만 14세 미만 조항
 *   autoCollect  이용 통계 등 자동 수집 장치를 쓴다(legal.autoCollect === true) — 자동 수집 장치 조항(개인정보 보호법 제30조①7 「해당하는 경우」)
 */
export function legalContext(content, archetype) {
  const pages = archetype?.legal?.pages ?? []
  const plans = Array.isArray(content?.plans) ? content.plans : []
  const priced = plans.some((p) => [p?.monthlyPrice, p?.yearlyPrice, p?.price].some((n) => typeof n === "number" && n > 0))
  const paid = filled(content?.legal?.paymentProvider) || priced || pages.includes("refund") || pages.includes("withdrawal")
  const trial = filled(content?.legal?.trial) || filled(content?.facts?.trial) || plans.some((p) => Number(p?.trialDays) > 0)
  const contract = pages.includes("terms")
  const goods = GOODS_ARCHETYPES.has(archetype?.id) || isObj(content?.product?.shipping)
  const subscriptionPlans = plans.some((p) => [p?.monthlyPrice, p?.yearlyPrice].some((n) => typeof n === "number" && n > 0))
  const recurring = goods ? paid && (subscriptionPlans || trial) : paid
  return {
    paid,
    trial,
    goods,
    recurring,
    trialConversion: recurring && trial,
    contract,
    marketing: content?.legal?.marketingConsent === true,
    ageGate: contract || filled(content?.legal?.ageGate),
    autoCollect: content?.legal?.autoCollect === true,
  }
}

const bullets = (rows) => rows.map((r) => `- ${r}`).join("\n")

// ── 한국어 ──────────────────────────────────────────────────────────
// 조항 조건(x = legalContext): 유료(paid)·무료 체험(trial)·계약 페이지(contract)·광고성 정보(marketing)·나이 확인(ageGate).
// 근거: 2026-09-30 국가법령정보센터 실측 — 근거 표는 .superpowers/sdd/2026-09-29-p3-3-stamp/task-legal-report.md.
const CONVENTION_NOTICE =
  "알림 기간 7일·30일은 약관법이 정한 기간이 아니라 회사가 지키겠다고 정하는 약속이다(약관법 제6조는 일반 원칙만 둔다). 공정거래위원회 표준약관과 같은 관행인지는 1차 출처(ftc.go.kr 표준약관 원문)로 확인한다 — 확인 필요"

/** 사업자 이름: 법인명이 상호와 다르면 「법인명(서비스명 상호)」 — 처리자·판매자는 법인이다. */
const operatorName = (c, f) => {
  const legal = c.business?.legalName
  const name = f("business.name")
  return legal && legal !== name ? `${legal}(서비스명 ${name})` : name
}

/** 청약철회 기간 문장(refund.window·withdrawal.how 가 함께 쓴다): 전자상거래법 제17조 ①③ */
const withdrawalWindow = (x) =>
  `계약 내용을 적은 서면(전자문서 포함)을 받은 날부터 7일 안에 청약을 철회할 수 있어요. 서비스 제공이 서면을 받은 때보다 늦게 시작되면 제공이 시작된 날부터 7일이에요.` +
  (x.trialConversion ? ` 무료 체험 뒤 유료로 바뀐 경우에는 서면을 받은 날과 유료 이용을 시작한 날 가운데 늦은 날부터 7일을 세요.` : "") +
  ` 서면을 받지 못했거나 사업자 주소가 적히지 않은 서면을 받았다면 사업자 주소를 안 날부터 7일이에요. 서비스가 안내나 계약과 다르게 제공되면 제공받은 날부터 3개월, 그 사실을 안 날부터 30일 안에도 철회할 수 있어요.`

/** 환급 문장(refund.effect·withdrawal.effect): 전자상거래법 제18조 ②③⑨ */
const refundEffect = () =>
  `철회하면 철회한 날부터 3영업일 안에 결제한 대금을 돌려드려요. 환급이 늦어지면 법이 정한 지연배상금(연 15%)을 함께 드려요. 카드로 결제했다면 카드사에 대금 청구를 멈추거나 취소해 달라고 요청해요. 철회를 이유로 위약금이나 손해배상은 청구하지 않아요.`

// ── 물품(재화) 판매 문장 ─────────────────────────────────────────────────────────────────────────
// 근거: 전자상거래법 제17조(청약철회등)·제18조(효과)·제13조②(계약 전 고지)·제15조①(선지급식 공급)·제24조②③(결제대금예치·피해보상보험), 시행령 제21조.
// 서비스 문장과 기산일·환급일·반품 비용이 다르다 — 서비스 문장을 그대로 쓰면 제17조①1 단서(재화는 공급받은 날)·제18조②1(재화를 반환받은 날)과 어긋난다.
const won = (n, currency = "KRW") =>
  currency === "KRW" ? `${Number(n).toLocaleString("ko-KR")}원` : currency === "JPY" ? `${Number(n).toLocaleString("ko-KR")}엔` : `${(Number(n) / 100).toLocaleString("en-US")} ${currency}`

/** 배송 사실의 자리: detail 은 product.shipping, commerce 는 shipping. 값이 없으면 product.shipping 자리가 빈 사실로 남는다. */
const shipOf = (c) => (isObj(c.product?.shipping) ? { path: "product.shipping", v: c.product.shipping } : isObj(c.shipping) ? { path: "shipping", v: c.shipping } : { path: "product.shipping", v: {} })
const returnsOf = (c) => (isObj(c.product?.returns) ? { path: "product.returns", v: c.product.returns } : isObj(c.returns) ? { path: "returns", v: c.returns } : { path: "product.returns", v: {} })
const returnDays = (c) => Math.max(7, Number(returnsOf(c).v.withdrawalDays) || 7)

/** 철회 기간 문장(물품): 제17조 ①1 단서·①2·①3·③. 사업자가 더 긴 기간을 약정했으면 ①의 각 호 기간이 그 기간이다(제17조① 괄호). */
const goodsWindow = (days) =>
  `계약 내용을 적은 서면(전자문서 포함)을 받은 날부터 ${days}일 안에 청약을 철회할 수 있어요. 서면을 받은 때보다 상품이 늦게 도착하면 상품을 받은 날부터 ${days}일이에요.` +
  ` 서면을 받지 못했거나 사업자 주소가 적히지 않은 서면을 받았다면 사업자 주소를 안 날 또는 알 수 있었던 날부터 ${days}일이에요. 철회를 방해받았다면 방해가 끝난 날부터 ${days}일이에요.` +
  ` 상품이 안내나 계약과 다르게 왔다면 상품을 받은 날부터 3개월, 그 사실을 안 날 또는 알 수 있었던 날부터 30일 안에도 철회할 수 있어요.`

/** 환급 문장(물품): 제18조 ①②1③⑨. 돌려받은 날부터 3영업일이다. */
const goodsRefundEffect = () =>
  `철회하면 이미 받은 상품은 돌려보내 주세요. 상품을 돌려받은 날부터 3영업일 안에 결제한 대금을 돌려드려요. 상품을 아직 받지 않은 채 철회하면 철회한 날부터 3영업일 안에 결제한 대금을 돌려드려요. 환급이 늦어지면 법이 정한 지연배상금(연 15%)을 함께 드려요.` +
  ` 카드로 결제했다면 지체 없이 카드사에 대금 청구를 멈추거나 취소해 달라고 요청하고, 이미 카드사에서 대금을 받았다면 지체 없이 카드사에 돌려준 뒤 그 사실을 알려 드려요. 철회를 이유로 위약금이나 손해배상은 청구하지 않아요.`

/** 철회 제한 정책 읽기: 서비스는 운영자가 정한 legal.withdrawalPolicy. 물품은 콘텐츠의 제한 사유(returns.exclusions)와 짝이 맞아야 한다 — 어긋나면 고르지 않는다. */
function withdrawalPolicyOf(c, x) {
  const raw = filled(c.legal?.withdrawalPolicy) ? c.legal.withdrawalPolicy : null
  if (!x.goods) return { policy: raw, exclusions: [], conflict: false }
  const exclusions = (Array.isArray(returnsOf(c).v.exclusions) ? returnsOf(c).v.exclusions : []).filter(filled)
  if (raw === "full" && exclusions.length) return { policy: null, exclusions, conflict: true }
  if (raw === "limited" || (raw === null && exclusions.length)) return { policy: "limited", exclusions, conflict: false }
  return { policy: raw, exclusions, conflict: false }
}
const CUSTOM_MADE = /주문\s*제작|맞춤|따로 만든|개별(?:적으로)?\s*(?:생산|제작)/

/** 철회 제한 조항(refund.limits·withdrawal.limits 가 같은 글) — 결제 화면의 제한 고지·필수 체크와 한 덩어리다. */
function withdrawalLimitsText(f, c, x) {
  const { policy, exclusions, conflict } = withdrawalPolicyOf(c, x)
  if (x.goods) {
    const base = `받은 상품이 고객 책임으로 없어지거나 훼손된 경우에는 철회할 수 없어요. 다만 상품을 확인하려고 포장을 뜯은 경우는 철회할 수 있어요.`
    if (conflict) return `${base}\n\n그 밖의 철회 제한 여부: ${f.miss("legal.withdrawalPolicy")}`
    if (policy === null) return `${base}\n\n그 밖의 철회 제한 여부: ${f("legal.withdrawalPolicy")}`
    if (policy === "full") return `${base}\n\n위 경우 말고는 철회에 제한을 두지 않아요. 상품을 써 보거나 포장을 뜯었어도 기간 안에 철회할 수 있어요.`
    if (policy === "limited") {
      const rows = exclusions.length ? exclusions : [f.miss(`${returnsOf(c).path}.exclusions`)]
      const custom = exclusions.some((e) => CUSTOM_MADE.test(String(e)))
        ? ` 주문을 받아 따로 만든 상품은 주문하기 전에 철회를 제한한다는 사실을 따로 알리고 고객에게 서면(전자문서)으로 동의를 받은 경우에만 철회를 제한해요.`
        : ""
      return `${base}\n\n다음 경우에도 철회할 수 없어요.\n\n${bullets(rows)}\n\n철회할 수 없는 상품은 포장이나 구매 화면에서 쉽게 알 수 있게 미리 표시해요. 표시하지 않은 상품은 이 이유로 철회를 막지 않아요.${custom}`
    }
    return `철회 제한 여부: ${policy}`
  }
  // 서비스: 운영자가 정한 정책(full = 이용 여부와 상관없이 철회 허용, limited = 제공이 개시된 부분은 철회 불가 — 제17조②5·⑥)
  const p = f("legal.withdrawalPolicy")
  const trial = x.trial ? ` 무료 체험으로 먼저 써 볼 수 있어요.` : ""
  if (p === "full") return `유료 이용을 시작한 뒤에도 위 기간 안에는 서비스를 이용했는지와 상관없이 철회할 수 있어요.${trial}`
  if (p === "limited")
    return `유료 결제 기간이 시작되면 그때부터 이용할 수 있어요. 그 결제 기간에 이미 제공된 부분은 철회할 수 없어요. 여러 부분으로 나눌 수 있는 서비스라면 제공이 시작되지 않은 부분은 철회할 수 있어요. 철회할 수 없다는 사실은 결제 전에 알려 드려요.${trial}`
  return `철회 제한 여부: ${p}`
}
const withdrawalLimitsNeeds = (c, x) => [...need(ECOM, "제17조"), ...(x.goods && withdrawalPolicyOf(c, x).policy === "limited" ? need(ECOM_DECREE, "제21조") : [])]

/** 상품·공급 방법·공급 시기(terms.service 물품판) — 제13조②2·2의2·4. 모르는 사실은 지어내지 않고 빈 사실이다. */
function goodsServiceRows(f, c) {
  const ship = shipOf(c)
  const fee = f(`${ship.path}.fee`)
  const free = typeof ship.v.freeThreshold === "number" ? `(${won(ship.v.freeThreshold)} 이상 무료)` : ""
  const feeText = fee === 0 ? "무료" : typeof fee === "number" ? won(fee) : fee
  const lead = f(`${ship.path}.leadDays`)
  const rows = Array.isArray(c.notice?.rows) ? c.notice.rows.filter((r) => filled(r?.label) && filled(r?.value)) : []
  return bullets([
    c.product?.name || !Array.isArray(c.products) ? `상품: ${f("product.name")}` : `상품: 이 쇼핑몰에서 파는 상품 — 상품마다 이름·가격·상품 정보를 상품 화면에 적어요`,
    ...(filled(c.notice?.category) ? [`종류: ${c.notice.category}`] : []),
    ...(rows.length ? [`상품 정보: ${rows.map((r) => `${r.label} ${r.value}`).join(" · ")}`] : c.product ? [`상품 정보: ${f("notice.rows")}`] : []),
    `공급 방법: 택배 배송(택배사 ${f(`${ship.path}.courier`)}) · 배송비 ${feeText}${free}`,
    ...(filled(c.legal?.supplyLimits) ? [`공급 제한: ${c.legal.supplyLimits}`] : []), // 판매일시·지역·수량·인도지역에 제한이 있으면 그 내용(시행령 제20조2호) — 없으면 줄이 없다
    `공급 시기: ${lead === 0 ? "결제 당일에 출고해요" : typeof lead === "number" ? `결제 후 영업일 기준 ${lead}일 안에 출고해요` : lead}`,
  ])
}

/**
 * 상품 목록(commerce products)의 판매가 — 숫자 가격이 있는 상품의 가장 낮은 값과 서로 다른 값의 수. 없으면 null.
 * 브리프 사실 `facts.price`(「13,000원부터」)는 사람이 쓴 문장이라 상품 목록과 어긋날 수 있다(C358 — 드립백 9,900원이 목록에 있는데 약관은 13,000원부터) — 가격은 상품 목록이 정한다.
 */
function listPrices(c) {
  if (!Array.isArray(c.products)) return null
  const n = c.products.map((p) => p?.price).filter((v) => typeof v === "number" && Number.isFinite(v) && v >= 0)
  return n.length ? { min: Math.min(...n), distinct: new Set(n).size } : null
}

/** 결제 조항의 가격 줄(물품): 콘텐츠 product.price(최소 단위 정수)·부가세 포함 여부. 없으면 상품 목록의 가격, 그도 없으면 facts.price 문장. */
function goodsPrice(c) {
  const p = c.product
  // 배송비는 가격과 같은 줄에 둔다 — 가격 화면 밖에서 추가 비용(배송비)이 처음 나오면 marketing-site total-first-screen(시행령 다크패턴)이 떨어진다(실측: 이 쪽 약관)
  const ship = shipOf(c).v
  const fee = typeof ship.fee === "number" ? ` · 배송비 ${ship.fee === 0 ? "무료" : won(ship.fee)}${typeof ship.freeThreshold === "number" ? `(${won(ship.freeThreshold)} 이상 무료)` : ""}` : ""
  if (typeof p?.price === "number") return ` 가격: ${won(p.price, p.currency ?? "KRW")}${typeof p.taxIncluded === "boolean" ? `(부가세 ${p.taxIncluded ? "포함" : "별도"})` : ""}${fee}.`
  const list = listPrices(c)
  if (list) {
    // 부가세 표기는 상품 목록에 칸이 없다 — 브리프 사실 문장에 적힌 것만 옮긴다(없으면 적지 않는다)
    const vat = /부가세\s*(포함|별도)/.exec(String(c.facts?.price ?? ""))?.[0].replace(/\s+/g, " ")
    return list.distinct > 1 ? ` 가격: ${won(list.min)}부터(상품마다 달라요${vat ? `, ${vat}` : ""})${fee}.` : ` 가격: ${won(list.min)}${vat ? `(${vat})` : ""}${fee}.`
  }
  return filled(c.facts?.price) ? ` 가격: ${c.facts.price}${fee}.` : ""
}

/** 물품 환불 쪽에만 있는 조항: 반품 방법·배송비(제18조⑨⑩, 제13조②6), 교환·보증(제13조②6). */
function goodsRefundExtra(r, c) {
  const ret = returnsOf(c)
  return [
    clause(r, "refund.returnCost", "반품 방법과 배송비", [...need(ECOM, "제13조"), ...need(ECOM, "제18조"), ...need(ECOM_DECREE, "제20조")], (f) => {
      const payer = f(`${ret.path}.feePayer`)
      const phone = f("business.phone")
      const email = f("business.email")
      const cost =
        payer === "seller"
          ? `상품을 돌려보내는 배송비는 철회 이유와 상관없이 회사가 내요.`
          : payer === "buyer"
            ? `마음이 바뀌어 철회하면 상품을 돌려보내는 배송비는 고객이 내고, 위약금이나 손해배상은 받지 않아요. 상품이 안내나 계약과 다르게 왔다면 돌려보내는 배송비는 회사가 내요.\n\n고객이 내는 반품 배송비: ${f("legal.returnFee")}`
            : `반품 배송비 부담: ${payer}`
      return `받은 날부터 ${returnDays(c)}일 안에 반품할 수 있어요. 반품하려면 전화 ${phone} 또는 메일 ${email}로 먼저 알려 주세요. ${cost}\n\n반품 보낼 곳과 방법: ${f("legal.returnAddress")}`
    }),
    clause(r, "refund.exchangeWarranty", "교환과 품질 보증", [...need(ECOM, "제13조"), ...need(ECOM, "제17조")], (f) =>
      `교환 조건과 방법: ${f("legal.exchange")}. 품질 보증 기준: ${f("legal.warranty")}. 상품이 안내나 계약과 다르게 왔다면 상품을 받은 날부터 3개월, 그 사실을 안 날 또는 알 수 있었던 날부터 30일 안에 청약을 철회할 수 있어요.`,
    ),
  ]
}

const KO = {
  title: { privacy: "개인정보 처리방침", terms: "이용약관", refund: "환불 정책", withdrawal: "청약철회 안내" },
  privacy: (r, c, x) => [
    clause(r, "privacy.purpose", "개인정보를 처리하는 목적", need(PIPA, "제15조", "제30조"), (f) => {
      const rows = f("legal.collects")
      return Array.isArray(rows)
        ? `${operatorName(c, f)}은(는) 아래 목적으로만 개인정보를 처리해요. 목적이 바뀌면 미리 알리고 필요한 동의를 다시 받아요.\n\n${bullets([...new Set(rows.map((x) => x.purpose))])}`
        : `처리 목적: ${rows}`
    }),
    clause(r, "privacy.items", "처리하는 개인정보 항목과 보유 기간", need(PIPA, "제15조", "제21조"), (f) => {
      const rows = f("legal.collects")
      const refusal = `\n\n동의를 거부할 수 있어요. 필수 항목을 거부하면 서비스를 이용할 수 없고, 선택 항목을 거부해도 서비스는 이용할 수 있어요.`
      return (Array.isArray(rows) ? `${bullets(rows.map((x, i) => `${x.item} — ${x.purpose} · 보유 기간 ${f(`legal.collects.${i}.retention`)}`))}` : `수집 항목과 보유 기간: ${rows}`) + refusal
    }),
    clause(
      r,
      "privacy.consent",
      "동의를 받는 방법",
      [...need(PIPA, "제22조"), ...(x.marketing ? need(NETWORK_ACT, "제50조") : [])],
      () =>
        `필수 항목과 선택 항목은 따로 동의를 받아요. 선택 항목에 동의하지 않아도 서비스를 이용할 수 있어요.` +
        (x.marketing ? `\n\n광고성 정보는 따로 동의한 분께만 보내요. 동의는 언제든 거둘 수 있어요.` : ""),
    ),
    // 동의 없이 처리하는 정보는 항목과 법적 근거를 동의 처리와 구분해 공개한다(개인정보 보호법 제22조③) — 주문 이행(제15조①4)·법령 보존(제15조①2)
    ...(x.goods
      ? [
          clause(r, "privacy.noConsent", "동의 없이 처리하는 개인정보", [...need(PIPA, "제15조"), ...need(PIPA, "제22조")], (f) => {
            const rows = f("legal.collects")
            return (
              `주문한 상품을 보내고 대금을 결제·환불하는 데 꼭 필요한 정보와 법령에 따라 보존해야 하는 정보는 동의 없이 처리해요. ` +
              `처리하는 항목: ${Array.isArray(rows) ? rows.map((k) => k.item).join(" · ") : rows}. 법적 근거: 개인정보 보호법 제15조 제1항 제2호(법령상 의무 준수)와 제4호(계약 이행).`
            )
          }),
        ]
      : []),
    ...(x.marketing
      ? [
          clause(r, "privacy.marketing", "광고성 정보 수신", [...need(NETWORK_ACT, "제50조"), ...need(NETWORK_DECREE, "제61조")], (f) => {
            const channels = f("legal.marketingChannels")
            return (
              `광고성 정보는 미리 명시적으로 동의한 채널(${Array.isArray(channels) ? channels.join("·") : channels})로만 보내요. 오후 9시부터 다음 날 오전 8시에는 전자우편을 뺀 채널로 따로 동의한 경우에만 보내요.\n\n` +
              `동의는 언제든 거둘 수 있고, 거두면 더 보내지 않아요. 광고성 정보마다 보내는 사람의 이름과 연락처, 수신을 거부하는 방법을 적어요. 수신을 거부하는 데 드는 통신 요금은 받지 않아요.`
            )
          }),
        ]
      : []),
    ...(x.ageGate
      ? [
          clause(r, "privacy.children", "만 14세 미만 아동", need(PIPA, "제22조의2"), (f) => {
            const gate = f("legal.ageGate")
            if (gate === "guardian") return `만 14세 미만 아동의 개인정보를 처리하려면 법정대리인의 동의를 받고, 법정대리인이 동의했는지 확인해요.`
            if (gate === 14) return `만 14세 미만 아동은 회원으로 가입할 수 없어요. 가입할 때 만 14세 이상인지 확인해요.`
            return `만 14세 미만 아동 처리: ${gate}`
          }),
        ]
      : []),
    ...(x.autoCollect
      ? [
          // 고른 동의 블록이 실제로 묻는 쿠키 항목(legal.cookieCategories — gen-pages 가 동의 블록에서 뽑는다)이 있으면 그 항목만 적는다 —
          // 화면에 마케팅 쿠키 스위치가 있는데 방침이 이용 통계만 적는 어긋남을 막는다. 없으면(항목을 모르는 호출) 종전 문장.
          clause(r, "privacy.autoCollect", Array.isArray(c.legal?.cookieCategories) ? "쿠키와 자동으로 수집하는 정보" : "자동으로 수집하는 정보(이용 통계)", need(PIPA, "제30조"), (f) => {
            const items = f("legal.autoCollectItems")
            const cats = Array.isArray(c.legal?.cookieCategories) ? c.legal.cookieCategories.filter((k) => filled(k?.label)) : null
            return (
              (cats
                ? `사이트 이용 기록을 자동으로 모으는 장치(쿠키 등)는 동의한 분의 것만 모아요. 동의는 설정에서 항목별로 언제든 바꿀 수 있고, 동의하지 않아도 서비스는 그대로 이용할 수 있어요.\n\n` +
                  `사이트에서 동의를 묻는 쿠키 항목:\n\n${bullets(cats.map((k) => `${k.label}${filled(k.body) ? ` — ${k.body}` : ""}`))}\n\n`
                : `이용 통계를 내려고 사이트 이용 기록을 자동으로 모으는 장치를 쓸 때는 동의한 분의 것만 모아요. 동의는 설정에서 언제든 바꿀 수 있고, 동의하지 않아도 서비스는 그대로 이용할 수 있어요.\n\n`) +
              `수집 항목과 도구: ${Array.isArray(items) ? items.join(" · ") : items}`
            )
          }),
        ]
      : []),
    clause(r, "privacy.outsourcing", "처리 위탁과 국외 이전", need(PIPA, "제26조", "제28조의8"), (f) => {
      const rows = f("legal.processors")
      return Array.isArray(rows)
        ? `서비스 운영을 위해 아래 업체에 처리를 맡겨요.\n\n${bullets(rows.map((x) => `${x.name} — ${x.task}${x.country ? ` · 이전 국가 ${x.country}` : ""}`))}`
        : `위탁받는 곳과 이전 국가: ${rows}`
    }),
    clause(r, "privacy.destruction", "개인정보의 파기", need(PIPA, "제21조", "제30조"), () => {
      const paper = c.legal?.paperRecords === true ? ` 종이 문서는 분쇄하거나 태워요.` : ""
      return (
        `보유 기간이 끝나거나 목적을 이루면 지체 없이 파기해요. 전자 파일은 복구할 수 없게 지워요.${paper}` +
        (x.paid ? `\n\n다만 법령에 따라 보존해야 하는 정보(계약·결제 기록 등)는 아래 「법령에 따라 보존하는 정보」에 적은 기간 동안 다른 개인정보와 분리해 보관한 뒤 파기해요.` : "")
      )
    }),
    ...(x.paid
      ? [
          clause(r, "privacy.retention", "법령에 따라 보존하는 정보", [...need(ECOM, "제6조"), ...need(ECOM_DECREE, "제6조"), ...need(PIPA, "제21조", "제30조")], () =>
            `「전자상거래 등에서의 소비자보호에 관한 법률」에 따라 아래 기록은 개인정보 이용 동의를 철회한 뒤에도 정해진 기간 동안 보존하고, 다른 개인정보와 분리해 보관해요.\n\n` +
            bullets(["계약 또는 청약철회 등에 관한 기록: 5년", `대금 결제 및 ${x.goods ? "상품" : "서비스"} 공급에 관한 기록: 5년`, "소비자 불만 또는 분쟁 처리에 관한 기록: 3년"]) +
            `\n\n보존하는 개인정보 항목: 거래 주체를 식별할 수 있는 정보(이름·이메일 주소 등)와 위 기록에 담긴 정보예요.` +
            `\n\n보존 기간이 끝나면 지체 없이 파기해요.`,
          ),
        ]
      : []),
    clause(r, "privacy.rights", "정보주체의 권리", [...need(PIPA, "제35조", "제36조", "제37조"), ...need(PIPA_DECREE, "제41조")], (f) =>
      `언제든 개인정보 열람·정정·삭제·처리 정지를 요구하거나 동의를 철회할 수 있어요. 요구는 ${f("business.email")}로 보내 주세요. 열람은 요구를 받은 날부터 10일 안에 할 수 있게 하고, 정정·삭제·처리 정지는 지체 없이 처리한 뒤 결과를 알려요.` +
      (x.paid ? ` 다만 다른 법령에서 수집 대상으로 정한 정보(전자상거래법에 따른 계약·결제 기록 등)는 삭제를 요구할 수 없어요.` : ""),
    ),
    clause(r, "privacy.security", "개인정보의 안전성 확보 조치", [...need(PIPA, "제30조"), ...need(PIPA_DECREE, "제31조")], (f) => {
      const rows = f("legal.security")
      return Array.isArray(rows) ? `개인정보를 안전하게 지키려고 아래 조치를 해요.\n\n${bullets(rows)}` : `안전성 확보 조치: ${rows}`
    }),
    clause(r, "privacy.officer", "개인정보 보호책임자", [...need(PIPA, "제31조"), ...need(PIPA_DECREE, "제32조")], (f) =>
      // 대표자가 책임자일 때(소상공인 — 법 제31조②·시행령 제32조①)는 legal.officer.self: true 로 대표자·회사 연락처를 쓴다
      c.legal?.officer?.self === true
        ? `책임자: 대표자 ${f("business.representative")}\n연락처: ${f("business.email")} · 전화 ${f("business.phone")}`
        : `책임자: ${f("legal.officer.name")}\n연락처: ${f("legal.officer.contact")}`,
    ),
    clause(r, "privacy.controller", "개인정보처리자", need(PIPA, "제30조"), (f) =>
      [operatorName(c, f), c.business?.representative ? `대표자 ${c.business.representative}` : null, f("business.address"), `전화 ${f("business.phone")}`, `메일 ${f("business.email")}`].filter(Boolean).join(" · "),
    ),
    clause(r, "privacy.effective", "시행일", need(PIPA, "제30조"), (f) => `이 방침은 ${f("legal.effectiveDate")}부터 적용해요. 내용이 바뀌면 이 쪽에 바뀐 내용과 적용일을 알려요.`),
  ],
  terms: (r, c, x) => [
    clause(r, "terms.provider", "사업자 정보", need(ECOM, "제10조", "제13조"), (f) =>
      bullets([
        `상호: ${operatorName(c, f)}`,
        `대표자: ${f("business.representative")}`,
        `사업자등록번호: ${f("business.bizRegNo")}`,
        `통신판매업 신고번호: ${f("business.mailOrderNo")}`,
        `주소: ${f("business.address")}`,
        `전화: ${f("business.phone")}`,
        `메일: ${f("business.email")}`,
      ]),
    ),
    clause(r, "terms.explain", "약관의 게시와 설명", need(TERMS_ACT, "제3조"), () =>
      x.goods
        ? `이 약관은 사이트 첫 화면에서 누구나 볼 수 있게 두고, 청약철회·환불·배송처럼 중요한 내용은 주문하기 전에 따로 알려 드려요. 약관 사본이 필요하면 요청해 주세요.`
        : `이 약관은 서비스 첫 화면에서 누구나 볼 수 있게 두고, 중요한 내용은 가입 전에 따로 알려 드려요. 약관 사본이 필요하면 요청해 주세요.`,
    ),
    clause(
      r,
      "terms.change",
      x.goods ? "약관의 변경" : "서비스와 약관의 변경",
      [...need(TERMS_ACT, "제6조"), ...(x.recurring ? [...need(ECOM, "제13조"), ...need(ECOM_DECREE, "제20조의2")] : [])],
      () =>
        (x.goods ? `약관을 바꿀 때는 적용일과 바꾸는 이유를 미리 알려 드려요.` : `서비스나 약관을 바꿀 때는 적용일과 바꾸는 이유를 미리 알려 드려요.`) +
        ` 고객에게 불리한 변경은 적용 30일 전에, 그 밖의 변경은 적용 7일 전에 알려요.` +
        (x.goods ? ` 바뀐 약관은 이미 주문한 거래에는 적용하지 않아요.` : "") +
        (x.recurring ? ` 요금이 오르거나 무료 이용이 유료로 바뀌는 경우에는 알리는 데서 그치지 않고 고객의 동의를 받은 뒤에만 적용해요. 동의하지 않으면 해지할 수 있어요.` : ""),
      { notes: [{ kind: "convention", text: CONVENTION_NOTICE }] },
    ),
    ...(x.paid
      ? [
          clause(r, "terms.payment", "결제", [...need(ECOM, "제13조"), ...(x.recurring ? need(ECOM_DECREE, "제20조의2") : [])], (f) => {
            const price = x.goods ? goodsPrice(c) : filled(c.facts?.price) ? ` 요금: ${c.facts.price}.` : ""
            return (
              `결제 대행 업체: ${f("legal.paymentProvider")}. 결제는 이 업체를 통해 처리해요.${price} 가격과 결제 방법·시기는 결제 전에 화면에 보여 드려요.` +
              (x.recurring
                ? `\n\n정기 결제 요금을 올릴 때는 오르기 전 30일 안에 오르는 일시와 오르기 전후의 가격, 결제 방법을 알리고 고객의 동의를 받아요. 오르는 요금을 취소하거나 해지하는 조건과 방법, 그 효과도 함께 알려요.`
                : "")
            )
          }),
          x.goods
            ? clause(r, "terms.service", "상품의 내용과 공급 방법", [...need(ECOM, "제13조"), ...need(ECOM, "제15조"), ...need(ECOM_DECREE, "제20조")], (f) => goodsServiceRows(f, c))
            : clause(r, "terms.service", "서비스의 내용과 이용 방법", need(ECOM, "제13조"), (f) =>
                bullets([
                  `서비스: ${c.product?.name ?? f("business.name")}`,
                  `내용: ${f("facts.claim")}`,
                  ...(c.product?.url ? [`이용 방법: 웹 브라우저에서 ${c.product.url}에 접속해 이용해요`] : []),
                  `이용 시작 시기: ${f("legal.provisionTiming")}`,
                ]),
              ),
          ...(x.goods
            ? [
                clause(r, "terms.supplyFailure", "상품을 보내기 어려울 때", need(ECOM, "제15조"), () =>
                  `주문한 상품을 보내기 어렵다는 것을 알게 되면 지체 없이 그 이유를 알려 드려요. 이미 대금을 받았다면 대금을 받은 날부터 3영업일 안에 돌려드리거나 돌려드리는 데 필요한 조치를 해요.`,
                ),
                clause(r, "terms.withdrawalNotice", "청약철회와 환불", need(ECOM, "제13조"), () =>
                  `상품을 받은 뒤 마음이 바뀌어도 받은 날부터 ${returnDays(c)}일 안에 청약을 철회할 수 있어요. 자세한 기한·방법·환급은 「청약철회 안내」와 「환불 정책」에 있어요.`,
                ),
                clause(r, "terms.contractDocument", "계약 내용 서면", need(ECOM, "제13조"), (f) =>
                  `주문이 끝나면 상호와 대표자, 상품 이름과 내용, 가격과 결제 방법·시기, 공급 방법과 시기, 청약철회 기한·방법·효과, 교환·반품·환불 조건, 불만 처리 방법이 적힌 계약 내용 서면을 상품을 보낼 때까지 드려요. 드리는 방법: ${f("legal.contractDelivery")}`,
                ),
                // 대금을 먼저 받고 상품을 보내는 선지급식 통신판매(제15조①)는 결제대금예치·피해보상보험 선택 고지가 필요하다(제13조②10, 제24조②). 신용카드 거래는 제외(제24조③2).
                clause(r, "terms.prepayProtection", "결제대금예치와 소비자피해보상보험", [...need(ECOM, "제13조"), ...need(ECOM, "제24조")], (f) =>
                  `상품 대금을 먼저 내고 상품을 받는 거래에서는, 고객이 원하면 상품을 받을 때까지 대금을 제3자에게 맡기는 결제대금예치를 쓰거나 회사가 소비자피해보상보험계약 등을 맺는 방법을 선택할 수 있어요. 선택하면 그 방법으로 처리해요.\n\n` +
                  `이용 방법: ${f(filled(c.legal?.prepayProtection) || !filled(c.business?.escrowProvider) ? "legal.prepayProtection" : "business.escrowProvider")}. 신용카드로 대금을 지급하는 거래에는 적용하지 않아요.`,
                ),
              ]
            : []),
          clause(r, "terms.minors", "미성년자의 이용", need(ECOM, "제13조"), () =>
            `미성년자가 법정대리인의 동의 없이 계약을 맺은 경우에는 미성년자 본인이나 법정대리인이 그 계약을 취소할 수 있어요. 이 내용을 계약을 맺기 전에 미성년자에게 알려요.`,
          ),
          clause(r, "terms.complaint", "불만과 피해 처리", need(ECOM, "제13조"), (f) =>
            `불만이나 피해 보상 요청은 전화 ${f("business.phone")} · 메일 ${f("business.email")}로 받아요. 접수한 내용은 확인한 뒤 처리 결과를 알려 드려요.`,
          ),
        ]
      : []),
    ...(x.trialConversion
      ? [
          clause(r, "terms.trialConversion", "무료 체험과 유료 전환", [...need(ECOM, "제13조"), ...need(ECOM_DECREE, "제20조의2")], () =>
            `무료 체험이 끝난 뒤 유료 이용으로 바뀌려면, 바뀌기 전 30일 안에 바뀌는 일시와 바뀌기 전후의 가격, 결제 방법을 알리고 고객의 동의를 받아요. 동의하지 않으면 유료로 바뀌지 않아요. 유료 전환을 취소하거나 해지하는 조건과 방법, 그 효과도 함께 알려요.`,
          ),
        ]
      : []),
    clause(r, "terms.liability", "책임의 제한", need(TERMS_ACT, "제6조", "제7조"), () =>
      `회사의 잘못으로 고객에게 손해가 생기면 법이 정한 범위에서 배상해요. 천재지변처럼 회사가 막을 수 없는 사유로 생긴 손해는 예외예요.` +
      (x.goods ? ` 상품이 안내나 계약과 다르면 「환불 정책」에 따라 청약을 철회할 수 있어요.` : ""),
    ),
    clause(r, "terms.dispute", "분쟁 해결", need(TERMS_ACT, "제14조"), () => `분쟁이 생기면 먼저 성실히 협의해요. 소송은 민사소송법이 정한 관할 법원에 제기할 수 있어요.`),
  ],
  refund: (r, c, x) => [
    clause(r, "refund.window", "청약철회 기간", need(ECOM, "제13조", "제17조"), () => (x.goods ? goodsWindow(returnDays(c)) : withdrawalWindow(x))),
    // 철회 정책은 운영자가 정하는 사실이다(legal.withdrawalPolicy). 두 값은 서로 어긋나는 문장을 만들지 않게 짝으로 쓴다
    // (결제 화면의 제한 고지·필수 체크도 같은 값이 정한다 — gen-pages applyWithdrawalPolicy):
    //   "full"    유료 결제 뒤 위 기간 안에는 이용 여부와 상관없이 철회 허용(제17조②5 의 제한을 쓰지 않는다 — 조문보다 유리)
    //   "limited" 제공이 개시된 부분은 철회 불가(제17조②5), 결제 전에 알린다(같은 조 ⑥). 그 결제 기간에 이미 제공된 부분이 철회 불가라는 뜻이다.
    // 물품은 콘텐츠의 제한 사유(product.returns.exclusions)와 짝이 맞는다(제17조②1~4·⑥, 시행령 제21조) — withdrawalLimitsText.
    clause(r, "refund.limits", "철회가 제한되는 경우", withdrawalLimitsNeeds(c, x), (f) => withdrawalLimitsText(f, c, x)),
    clause(r, "refund.effect", "환급", [...need(ECOM, "제18조"), ...need(ECOM_DECREE, "제21조의3")], () => (x.goods ? goodsRefundEffect() : refundEffect())),
    ...(x.goods ? goodsRefundExtra(r, c) : []),
    clause(r, "refund.contact", "환불 문의", need(ECOM, "제13조"), (f) => `전화 ${f("business.phone")} · 메일 ${f("business.email")}`),
  ],
  withdrawal: (r, c, x) => [
    clause(r, "withdrawal.how", "청약철회 방법", need(ECOM, "제13조", "제17조"), (f) =>
      x.goods
        ? `${goodsWindow(returnDays(c))}\n\n${f("business.email")}로 알려 주시면 돼요. 이메일을 보낸 날 철회의 효력이 생겨요. 이미 받은 상품은 돌려보내 주세요. 반품 방법과 배송비는 「환불 정책」에 있어요.\n\n철회 서식\n\n` +
          bullets([`받는 곳: ${f("business.email")}`, `제목: 청약철회 요청`, `내용: 성명, 주문자 이메일 주소, 주문번호, 상품명, 결제일, 「청약을 철회합니다」`])
        : `${withdrawalWindow(x)}\n\n${f("business.email")}로 알려 주시면 돼요. 이메일을 보낸 날 철회의 효력이 생겨요.\n\n철회 서식\n\n` +
          bullets([`받는 곳: ${f("business.email")}`, `제목: 청약철회 요청`, `내용: 성명, 가입한 이메일 주소, 결제일, 「청약을 철회합니다」`]),
    ),
    // 철회 제한은 환불 정책과 같은 글이다 — 결제 화면의 제한 고지·필수 체크와 이 쪽 문장이 어긋나지 않게 한 곳에서 만든다.
    clause(r, "withdrawal.limits", "철회가 제한되는 경우", withdrawalLimitsNeeds(c, x), (f) => withdrawalLimitsText(f, c, x)),
    clause(r, "withdrawal.effect", "철회의 효과", [...need(ECOM, "제18조"), ...need(ECOM_DECREE, "제21조의3")], () => (x.goods ? goodsRefundEffect() : refundEffect())),
    clause(r, "withdrawal.provider", "사업자 정보", need(ECOM, "제13조"), (f) =>
      bullets([
        `상호: ${operatorName(c, f)}`,
        `대표자: ${f("business.representative")}`,
        `사업자등록번호: ${f("business.bizRegNo")}`,
        `통신판매업 신고번호: ${f("business.mailOrderNo")}`,
        `주소: ${f("business.address")}`,
        `전화: ${f("business.phone")}`,
        `메일: ${f("business.email")}`,
      ]),
    ),
  ],
}


// ── English ─────────────────────────────────────────────────────────
// 근거(2026-10-01 EUR-Lex 실측 — 대장 C250 ①·C166): 소비자권리지침 2011/83/EU 현행 통합본 02011L0083-20260927 제6·9·11·11a·13·14·16조와 부속서 I(B),
// GDPR (EU) 2016/679 제7(3)·12(3)·13·15~22·77조. 물품(x.goods — 한국어와 같은 스위치)이면 서비스·구독 문장 대신 물품 문장을 쓴다.
const isPaddle = (c) => /paddle/i.test(c.legal?.paymentProvider ?? "")

const enMoney = (n, currency = "USD") => {
  const minor = currency === "KRW" || currency === "JPY" ? 0 : 2
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: minor, maximumFractionDigits: minor }).format(minor ? Number(n) / 100 : Number(n))
}
/** 철회 기간(일): 지침은 14일 이상 — 사업자가 더 길게 정했으면 그 기간(제9조①). */
const enDays = (c) => Math.max(14, Number(returnsOf(c).v.withdrawalDays) || 14)

/** 서비스 철회 기간 — 지침 제9조①②(a): 철회 기간은 계약 체결일부터 센다(서비스). 기간 숫자는 법정 기본값 14일이거나 콘텐츠가 더 길게 정한 값이다(enDays). */
const enServiceWindow = (c) =>
  `If you are a consumer, you can withdraw from this contract without giving a reason within ${enDays(c)} days from the day the contract is concluded (Directive 2011/83/EU, Article 9).`

/** 서비스 환급 — 제13조①: 철회를 안 날부터 14일 안(법정 기한)·같은 결제 수단. 제14조③: 철회 기간 안에 이용을 시작했으면 그때까지 이용분은 비례해 낸다. */
const enServiceRefund = () =>
  `We reimburse all payments we received from you without undue delay and no later than 14 days after the day we are informed of your decision to withdraw (Directive 2011/83/EU, Article 13). ` +
  `We use the same means of payment you used for the original payment, unless you expressly agree otherwise, and you pay no fees for the refund. ` +
  `If you asked us to start the service during the withdrawal period, you pay a proportionate amount for what we have provided up to the time you told us you withdraw (Article 14(3)).`

/** 서비스 철회 예외 — 운영자가 정한 legal.withdrawalPolicy(full|limited)를 읽는다. 정하지 않았으면 빈 사실. limited 는 제14조③·제16조(a) 문장(법정). */
function enServiceExceptions(f, c, x) {
  const { policy } = withdrawalPolicyOf(c, x)
  if (policy === null) return `Exceptions to the right of withdrawal: ${f("legal.withdrawalPolicy")}`
  if (policy === "full") return `None of the legal exceptions to the right of withdrawal applies to the services we sell. You can withdraw within the period above whether or not you have used the service.`
  if (policy === "limited") return `Once a service has been fully performed, you can no longer withdraw, but only if you expressly consented to the service starting during the withdrawal period and acknowledged that you would lose the right of withdrawal once it was fully performed (Directive 2011/83/EU, Article 16(a)).`
  return `Exceptions to the right of withdrawal: ${f.miss("legal.withdrawalPolicy")}`
}

/** 소비자가 물품을 받은 날부터 — 제9조②(b)(i)(ii). 구매일부터가 아니다. */
const enGoodsWindow = (c) => {
  const n = enDays(c)
  return (
    `You can withdraw from your order without giving a reason within ${n} days after the day you receive the goods (or the day a third party you name, other than the carrier, receives them). ` +
    `If you order several goods in one order and they are delivered separately, the ${n} days start on the day you receive the last item. ` +
    `If one item is delivered in several lots or pieces, they start on the day you receive the last lot or piece.`
  )
}

/** 환급 문장(물품) — 제13조①②③: 통지받은 날부터 14일·같은 결제 수단·가장 싼 표준 배송을 넘는 비용 제외·물품 반송 확인 전까지 보류 가능. */
const enGoodsRefund = () =>
  `We reimburse all payments we received from you, including the costs of standard delivery, without undue delay and no later than 14 days after the day we are informed of your decision to withdraw. ` +
  `We use the same means of payment you used for the original payment, unless you expressly agree otherwise, and you pay no fees for the refund. ` +
  `If you chose a type of delivery other than the least expensive standard delivery we offer, we do not refund the extra delivery costs. ` +
  `Unless we have offered to collect the goods ourselves, we may withhold the refund until we have received the goods back or you have shown evidence that you sent them back, whichever is earlier.`

/** 반품: 제14조①② — 반송 기한(통지일부터 14일, 발송하면 지킨 것)·반품 비용·가치 감소. 비용 부담과 반품 주소는 콘텐츠 사실, 없으면 빈 사실. */
function enGoodsReturn(f, c) {
  const ret = returnsOf(c)
  const payer = f(`${ret.path}.feePayer`)
  const cost =
    payer === "seller"
      ? `We bear the cost of returning the goods.`
      : payer === "buyer"
        ? `You only bear the direct cost of returning the goods.`
        : `Who bears the cost of returning the goods: ${payer}.`
  return (
    `Send the goods back to us, or hand them over to us or a person we authorise, without undue delay and no later than 14 days after the day you tell us you are withdrawing. You meet the deadline if you send the goods back before the 14 days end. ${cost} ` +
    `You are only liable for any loss in value of the goods that results from handling them beyond what is needed to establish their nature, characteristics and functioning.\n\nReturn address: ${f("legal.returnAddress")}`
  )
}

/** 제16조 물품 예외 중 콘텐츠의 제한 사유가 가리키는 것만 조문 표현으로 — 어느 항에도 안 맞는 사유는 예외로 싣지 않는다(지침이 허용하는 예외만 안내할 수 있다). */
const ART16_GOODS = [
  { id: "i", re: /\b(?:audio|video|software|cds?|dvds?|recordings?)\b/i, text: "sealed audio or video recordings or sealed computer software that you unsealed after delivery" },
  { id: "e", re: /hygien|health|unseal|\bsealed\b|underwear|cosmetic|earring|swimwear/i, text: "sealed goods that are not suitable for return for health protection or hygiene reasons and that you unsealed after delivery" },
  { id: "c", re: /made[- ]to[- ](?:order|measure)|custom[- ]?(?:made|ised|ized)|personali[sz]ed|bespoke|specifications?/i, text: "goods made to your specifications or clearly personalised" },
  { id: "d", re: /perish|spoil|deteriorat|expire|\bfresh\b/i, text: "goods that are liable to deteriorate or expire rapidly" },
  { id: "f", re: /inseparabl|mixed with/i, text: "goods that, after delivery, are according to their nature inseparably mixed with other items" },
  { id: "j", re: /newspaper|magazine|periodical/i, text: "a newspaper, periodical or magazine (other than a subscription)" },
]
function art16Split(c, x) {
  const { policy, exclusions, conflict } = withdrawalPolicyOf(c, x)
  const grounds = new Map()
  const unmatched = []
  for (const e of exclusions) {
    const g = ART16_GOODS.find((k) => k.re.test(String(e)))
    if (g) grounds.set(g.id, g.text)
    else unmatched.push(String(e))
  }
  return { policy, conflict, grounds: [...grounds.values()], unmatched }
}

/** 철회 예외(refund·withdrawal 두 쪽이 같은 글) — 한국어 철회 제한과 같은 사실을 읽는다: legal.withdrawalPolicy(full|limited)·product.returns.exclusions. 정책도 사유도 없으면 운영자에게 받는다(기본값 없음). */
function enGoodsExceptions(f, c, x) {
  const { policy, conflict, grounds, unmatched } = art16Split(c, x)
  if (conflict) return `Exceptions to the right of withdrawal: ${f.miss("legal.withdrawalPolicy")}`
  if (policy === null) return `Exceptions to the right of withdrawal: ${f("legal.withdrawalPolicy")}`
  if (policy === "full") return `None of the legal exceptions to the right of withdrawal applies to the goods we sell. You can withdraw from any order within the period above.`
  const rows = [...grounds, ...(unmatched.length || !grounds.length ? [`Other exceptions: ${f.miss(`${returnsOf(c).path}.exclusions`)}`] : [])]
  return `You cannot withdraw from an order for these goods:\n\n${bullets(rows)}`
}
const enExceptionNotes = (c, x) => {
  const { unmatched } = art16Split(c, x)
  return unmatched.length
    ? [{ kind: "unmapped-exclusion", text: `Content exclusions that match no Article 16 ground of Directive 2011/83/EU are not published as exceptions: ${unmatched.map((u) => `"${u}"`).join(", ")}. Only the exceptions in Article 16 can take away the right of withdrawal.` }]
    : []
}

/** 철회 안내(물품): 제9·11조·부속서 I(B). 온라인 철회 기능(제11a조 — 2026-06-19부터 적용)은 콘텐츠 사실 legal.withdrawalFunction 이 있을 때만 말하고, 없으면 빈 사실이다. */
function enGoodsWithdrawHow(f, c) {
  const n = enDays(c)
  const email = f("business.email")
  return (
    `You have ${n} days from the day you receive the goods to withdraw without giving a reason. Tell us by email to ${email}. You can use the model withdrawal form below or make any other clear statement that you withdraw. Your notice is in time if you send it before the ${n} days end.\n\n` +
    `You can also withdraw online: ${f("legal.withdrawalFunction")}\n\n` +
    `Model withdrawal form (complete and send it only if you want to withdraw):\n\n` +
    bullets([
      `To: ${f("business.name")}, ${f("business.address")}, ${email}`,
      `I hereby give notice that I withdraw from my contract of sale of the following goods: [goods]`,
      `Ordered on / received on: [date]`,
      `Name of consumer: [name]`,
      `Address of consumer: [address]`,
      `Signature of consumer (only if this form is notified on paper): [signature]`,
      `Date: [date]`,
    ])
  )
}

/** 가격·배송 안내(물품) — 제6조①(e)(g): 세금 포함 총 가격·추가 배송비·배송 방법과 시기·불만 처리. 배송비·택배사는 콘텐츠 사실. */
function enGoodsDelivery(f, c) {
  const p = c.product
  const ship = shipOf(c)
  const money = (n) => enMoney(n, p?.currency ?? "USD")
  const vat = typeof p?.taxIncluded === "boolean" ? ` (VAT ${p.taxIncluded ? "included" : "not included"})` : p ? ` (VAT: ${f("product.taxIncluded")})` : ""
  const price =
    typeof p?.price === "number"
      ? `Price: ${money(p.price)}${vat}.`
      : listPrices(c)
        ? `Price${listPrices(c).distinct > 1 ? "s start from" : ":"} ${enMoney(listPrices(c).min, "KRW")}${listPrices(c).distinct > 1 ? " (the price differs by item)" : ""}.` // 상품 목록이 가격을 정한다(C358) — 브리프 사실 문장과 어긋날 수 있다
        : filled(c.facts?.price)
        ? `Price: ${c.facts.price}.`
        : Array.isArray(c.products)
          ? `The price of each item is shown on its product page before you order.`
          : `Price: ${f("product.price")}.`
  const fee = f(`${ship.path}.fee`)
  const feeText = fee === 0 ? "free" : typeof fee === "number" ? money(fee) : fee
  const free = typeof ship.v.freeThreshold === "number" ? ` (free over ${money(ship.v.freeThreshold)})` : ""
  const lead = f(`${ship.path}.leadDays`)
  const leadText = lead === 0 ? "We ship on the day you order." : typeof lead === "number" ? `We ship within ${lead} business day${lead === 1 ? "" : "s"} after you order.` : `Shipping time: ${lead}.`
  return `${price} Delivery by ${f(`${ship.path}.courier`)}. Delivery fee: ${feeText}${free}. ${leadText} Complaints: email ${f("business.email")}.`
}

const EN = {
  title: { privacy: "Privacy Policy", terms: "Terms of Service", refund: "Refund Policy", withdrawal: "Right of Withdrawal" },
  privacy: (r, c) => [
    clause(r, "privacy.controller", "Who we are", [...need(GDPR, "Art. 13"), ...need(CCPA, "§1798.100")], (f) => `${f("business.name")}, ${f("business.address")}. Contact: ${f("business.email")}.`),
    clause(r, "privacy.data", "What we collect and why", [...need(GDPR, "Art. 6", "Art. 13"), ...need(CCPA, "§1798.100")], (f) => {
      const rows = f("legal.collects")
      return Array.isArray(rows) ? bullets(rows.map((x) => `${x.item} — ${x.purpose}`)) : `Data collected and purposes: ${rows}`
    }),
    clause(r, "privacy.processors", "Who we share it with", need(GDPR, "Art. 13", "Art. 44"), (f) => {
      const rows = f("legal.processors")
      return Array.isArray(rows) ? bullets(rows.map((x) => `${x.name} — ${x.task}${x.country ? ` (${x.country})` : ""}`)) : `Processors and transfers: ${rows}`
    }),
    // 보관 기간(제13조②(a))은 수집 항목마다 적은 retention 이 있으면 그것을, 없으면 전용 사실 legal.retention(기간 또는 기간을 정하는 기준)을 읽는다 — 빈 사실은 legal.collects 가 아니라 이 자리로 남는다.
    clause(r, "privacy.retention", "How long we keep it", need(GDPR, "Art. 13"), (f) => {
      const rows = Array.isArray(c.legal?.collects) && c.legal.collects.length ? c.legal.collects : null
      if (rows) return bullets(rows.map((x, i) => `${x.item}: ${f(`legal.collects.${i}.retention`)}`))
      const v = f("legal.retention")
      return `Retention: ${Array.isArray(v) ? v.join("; ") : v}`
    }),
    // 정보주체의 권리 — GDPR 제15~20·22조, 제7조③(동의 철회), 제12조③(처리 기한), 제77조(감독기관 불만). CCPA 문장은 종전 그대로(판매·공유 여부는 사실이 아니라 권리 안내).
    clause(r, "privacy.rights", "Your rights", [...need(GDPR, "Art. 7(3)", "Art. 12(3)", "Art. 15", "Art. 16", "Art. 17", "Art. 18", "Art. 20", "Art. 22", "Art. 77"), ...need(CCPA, "§1798.105", "§1798.120")], (f) =>
      `You have these rights over your personal data. To use any of them, email ${f("business.email")}.\n\n` +
      bullets([
        `Access: ask whether we process your data, get a copy of it and the information in Article 15 of the GDPR.`,
        `Rectification: have inaccurate data corrected and incomplete data completed.`,
        `Erasure: have your data erased where one of the grounds in Article 17 applies.`,
        `Restriction: have us restrict processing in the cases in Article 18, for example while you contest the accuracy of the data.`,
        `Portability: receive the data you gave us in a structured, commonly used, machine-readable format and have it passed to another controller, where we process it on the basis of your consent or a contract and by automated means.`,
        `Automated decisions: not to be subject to a decision based solely on automated processing, including profiling, that has legal effects on you or similarly significantly affects you, unless an exception in Article 22(2) applies.`,
        `Withdrawing consent: where we process your data on the basis of your consent, withdraw it at any time. Withdrawing does not affect the lawfulness of processing before you withdrew.`,
        `Opting out: opt out of any sale or sharing of your data.`,
      ]) +
      `\n\nWe respond without undue delay and within one month of receiving your request. We can extend that period by two further months where necessary, and we tell you if we do.\n\n` +
      `You can also lodge a complaint with a supervisory authority, in particular in the EU Member State where you live or work or where you think your rights were infringed.`,
    ),
    // 반대권은 다른 정보와 분리해 명시한다 — 제21조④
    clause(r, "privacy.object", "Your right to object", need(GDPR, "Art. 21"), () =>
      `Where we process your data on the basis of our legitimate interests, you can object at any time, on grounds relating to your particular situation. We then stop processing unless we show compelling legitimate grounds that override your interests, rights and freedoms, or we need the data to establish, exercise or defend legal claims.\n\n` +
      `You can object at any time to processing of your data for direct marketing. Once you object, we no longer process your data for that purpose.`,
    ),
    clause(r, "privacy.effective", "Last updated", need(GDPR, "Art. 13"), (f) => `This policy applies from ${f("legal.effectiveDate")}.`),
  ],
  terms: (r, c, x) => [
    clause(r, "terms.provider", "Who we are", need(CRD, "Art. 6"), (f) =>
      x.goods ? `${f("business.name")}, ${f("business.address")}. Contact: ${f("business.email")}, phone ${f("business.phone")}.` : `${f("business.name")}, ${f("business.address")}. Contact: ${f("business.email")}.`,
    ),
    ...(c.legal?.paymentProvider || x.goods
      ? [
          clause(r, "terms.payment", "Payment", isPaddle(c) ? need(PADDLE, "Merchant of Record") : need(CRD, "Art. 6"), (f) =>
            isPaddle(c)
              ? `Orders are processed by our online reseller Paddle.com, which is the Merchant of Record for all our orders.`
              : `Payments are processed by ${f("legal.paymentProvider")}. Prices are shown before you pay.`,
          ),
        ]
      : []),
    ...(x.goods
      ? [
          clause(r, "terms.delivery", "Price and delivery", need(CRD, "Art. 6"), (f) => enGoodsDelivery(f, c)),
          clause(
            r,
            "terms.guarantee",
            "Legal guarantee",
            need(CRD, "Art. 6"),
            (f) =>
              `The goods we sell are covered by the legal guarantee of conformity for goods that applies in your country of residence. Under EU law it lasts at least two years. It applies in addition to your right of withdrawal. After-sales service and commercial guarantees: ${f("legal.warranty")}.`,
            { notes: [{ kind: "unverified", text: "Article 6(1)(l) asks for this reminder in the harmonised notice referred to in Article 22a; the notice itself is not reproduced here and Article 22a was not read — unverified." }] },
          ),
        ]
      : []),
    clause(r, "terms.liability", "Limitation of liability", need(UCTD, "Art. 3"), () => `Nothing in these terms limits liability that cannot be limited by law.`),
    clause(r, "terms.law", "Governing law", need(ROME1, "Art. 6"), (f) => `These terms are governed by ${f("legal.governingLaw")}. Consumers keep the protection of the law of their country of residence.`),
  ],
  refund: (r, c, x) =>
    x.goods
      ? [
          clause(r, "refund.window", `${enDays(c)}-day withdrawal period`, [...need(CRD, "Art. 9"), ...(isPaddle(c) ? need(PADDLE, "Refunds") : [])], () => enGoodsWindow(c)),
          clause(r, "refund.exceptions", "Exceptions", [...need(CRD, "Art. 16"), ...need(CRD, "Art. 6")], (f) => enGoodsExceptions(f, c, x), { notes: enExceptionNotes(c, x) }),
          clause(r, "refund.returnCost", "Returning the goods and who pays", [...need(CRD, "Art. 14"), ...need(CRD, "Art. 6")], (f) => enGoodsReturn(f, c)),
          clause(r, "refund.effect", "How refunds are paid", need(CRD, "Art. 13"), () => enGoodsRefund()),
          clause(r, "refund.contact", "Contact", need(CRD, "Art. 6"), (f) => `Email ${f("business.email")}.`),
        ]
      : [
          clause(r, "refund.window", "Withdrawal period", [...need(CRD, "Art. 9"), ...(isPaddle(c) ? need(PADDLE, "Refunds") : [])], () => enServiceWindow(c)),
          clause(r, "refund.effect", "How refunds are paid", [...need(CRD, "Art. 13"), ...need(CRD, "Art. 14")], () => enServiceRefund()),
          clause(r, "refund.contact", "Contact", need(CRD, "Art. 6"), (f) => `Email ${f("business.email")}.`),
        ],
  withdrawal: (r, c, x) =>
    x.goods
      ? [
          clause(r, "withdrawal.how", "How to withdraw", need(CRD, "Art. 9", "Art. 11", "Art. 11a"), (f) => enGoodsWithdrawHow(f, c), {
            notes: [{ kind: "scope", text: "Article 11a (withdrawal function for contracts concluded through an online interface) applies in Member States from 19 June 2026 under Directive (EU) 2023/2673 Article 2(1). The draft names the function only when the content says where it is (legal.withdrawalFunction); it does not make the site have one." }],
          }),
          clause(r, "withdrawal.returnGoods", "Sending the goods back", need(CRD, "Art. 14"), (f) => enGoodsReturn(f, c)),
          clause(r, "withdrawal.exceptions", "Exceptions", [...need(CRD, "Art. 16"), ...need(CRD, "Art. 6")], (f) => enGoodsExceptions(f, c, x), { notes: enExceptionNotes(c, x) }),
          clause(r, "withdrawal.effect", "Effect of withdrawal", need(CRD, "Art. 13"), () => enGoodsRefund()),
        ]
      : [
          clause(r, "withdrawal.how", "How to withdraw", need(CRD, "Art. 9", "Art. 11"), (f) => `You have ${enDays(c)} days from the day the contract is concluded to withdraw without giving a reason. Tell us by email to ${f("business.email")}. Your notice is in time if you send it before the ${enDays(c)} days end.`),
          clause(r, "withdrawal.exceptions", "Exceptions", [...need(CRD, "Art. 14"), ...need(CRD, "Art. 16")], (f) => enServiceExceptions(f, c, x)),
          clause(r, "withdrawal.effect", "Effect of withdrawal", [...need(CRD, "Art. 13"), ...need(CRD, "Art. 14")], () => enServiceRefund()),
        ],
}

/**
 * 콘텐츠 → 법정 페이지 초안.
 * @returns {Record<string, { markdown: string, clauses: { id, title, text, needs: { law, article }[], missing?: string[] }[] }>}
 */
export function draftLegalPages(content, archetype, locale) {
  if (locale !== "ko" && locale !== "en") throw new Error(`locale 은 ko 또는 en: ${locale}`)
  const pages = archetype?.legal?.pages
  if (!Array.isArray(pages)) throw new Error(`원형 ${archetype?.id ?? "?"}에 legal.pages 가 없다(원형 JSON v1)`)
  const T = locale === "ko" ? KO : EN
  const reader = factReader(content ?? {}, locale)
  const ctx = legalContext(content, archetype)
  const out = {}
  for (const page of pages) {
    if (!LEGAL_PAGES.includes(page)) throw new Error(`모르는 법정 페이지: ${page}`)
    const clauses = T[page](reader, content ?? {}, ctx)
    const markdown = `# ${T.title[page]}\n\n` + clauses.map((c) => `## ${c.title}\n\n${c.text}\n`).join("\n")
    out[page] = { markdown, clauses }
  }
  return out
}

/**
 * 법률 검토를 못 했을 때(키 없음·API 실패 — Review Focus 4)의 review.json 내용: 모든 조항 unverified.
 * 찍어내기는 멈추지 않고 이것을 07-qa/legal/<page>.review.json 에 쓰며, legal-gate 는 1 이다.
 */
export function pendingReview(drafts, reason) {
  const out = {}
  for (const [page, d] of Object.entries(drafts)) {
    out[page] = d.clauses.map((c) => ({ clause: c.id, verdict: "unverified", basis: [], note: reason }))
  }
  return out
}

/** 07-qa 의 「검토 전」 자리 파일인가(위 pendingReview 가 쓴 것) — 조항이 모두 unverified 이고 note 가 「법률 에이전트 검토 전」으로 시작한다(doctor 실패 사유가 든 파일은 진짜 검토 대기가 아니다). 06 의 초안 낡음 검사·stamp 의 검토 상태가 같은 판정을 쓴다. */
export function isPendingReview(text) {
  try {
    const list = JSON.parse(text)
    return Array.isArray(list) && list.length > 0 && list.every((x) => x?.verdict === "unverified" && /^법률 에이전트 검토 전/.test(String(x.note ?? "")))
  } catch { return false }
}
