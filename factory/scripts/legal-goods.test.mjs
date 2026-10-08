// P3-4 일관성 레인(P4CON) 수정 1 — 물품 판매(detail·commerce) 법정 초안은 서비스·구독 문장이 아니라 물품 문장이다.
// 근거는 2026-10-01 국가법령정보센터 실측(전자상거래법 MST 282793·시행령 MST 288143, 시행일 2026-07-21) — 보고서 task-consistency-report.md 「공식 문서 근거」.
// 실행: node --test --test-force-exit --test-timeout=60000 factory/scripts/legal-goods.test.mjs
import { test } from "node:test"
import assert from "node:assert/strict"
import { draftLegalPages, legalContext, PLACEHOLDER } from "../legal/drafts.mjs"

const ECOM = "전자상거래 등에서의 소비자보호에 관한 법률"
const pages = ["privacy", "terms", "refund", "withdrawal"]
const detailArch = { id: "detail", legal: { pages, laws: { ko: [], en: [] } } }
const commerceArch = { id: "commerce", legal: { pages, laws: { ko: [], en: [] } } }
const saasArch = { id: "saas", legal: { pages, laws: { ko: [], en: [] } } }

const business = { name: "솜결", representative: "김하늘", bizRegNo: "123-45-67890", mailOrderNo: "제2026-서울마포-0001호", address: "서울특별시 마포구 월드컵로 120", phone: "02-1234-5678", email: "help@example.com" }
const detail = {
  business,
  product: {
    name: "손바느질 린넨 앞치마",
    price: 39000,
    currency: "KRW",
    taxIncluded: true,
    shipping: { fee: 3000, freeThreshold: 50000, courier: "한빛택배", leadDays: 3 },
    returns: { feePayer: "buyer", withdrawalDays: 7, exclusions: [] },
  },
  notice: { category: "의류", rows: [{ label: "소재", value: "린넨 100%" }, { label: "세탁 방법", value: "30도 손세탁" }] },
  legal: { paymentProvider: "토스페이먼츠", returnAddress: "서울특별시 마포구 월드컵로 120 반품 접수", exchange: "받은 날부터 7일 안에 같은 상품으로 바꿔 드려요", warranty: "구입일부터 1년", prepayProtection: "소비자피해보상보험 — 예시보증", returnFee: "택배 실비 6,000원" },
}
const saas = {
  business,
  product: { name: "견적노트", url: "https://gyeonjeok.example.com" },
  plans: [{ name: "월 요금제", monthlyPrice: 9900, currency: "KRW", vatIncluded: true }],
  facts: { trial: "첫 14일 무료, 카드 등록 없이 시작", price: "월 9,900원", claim: "견적서를 링크로 보내요" },
  legal: { paymentProvider: "토스페이먼츠", provisionTiming: "결제 직후", withdrawalPolicy: "limited" },
}
const byId = (d, page, id) => d[page].clauses.find((c) => c.id === id)
const text = (d, page, id) => byId(d, page, id)?.text ?? ""
const cites = (c, law, article) => c.needs.some((n) => n.law === law && n.article === article)

test("legalContext: 물품 판매 원형(detail·commerce)·상품 배송 사실이 있는 콘텐츠는 goods, 서비스(saas)는 아니다", () => {
  assert.equal(legalContext(detail, detailArch).goods, true)
  assert.equal(legalContext({ business, products: [{ name: "빵" }], shipping: { fee: 3000, courier: "한빛택배", leadDays: 2 } }, commerceArch).goods, true)
  assert.equal(legalContext(saas, saasArch).goods, false)
  // 원형이 표에 없어도 콘텐츠의 product.shipping 이 있으면 물품
  assert.equal(legalContext({ business, product: { name: "꽃", shipping: { fee: 0, courier: "한빛택배", leadDays: 1 } } }, { id: "brand", legal: { pages: ["terms"], laws: { ko: [], en: [] } } }).goods, true)
  assert.equal(legalContext({ business, product: { name: "앱" } }, { id: "brand", legal: { pages: ["terms"], laws: { ko: [], en: [] } } }).goods, false, "배송 사실 없이 product 만 있으면 서비스")
})

test("goods 환불: 철회 기간은 상품을 받은 날부터 — 서비스 제공 기준 문장이 없다(제17조①1 단서·②·③)", () => {
  const d = draftLegalPages(detail, detailArch, "ko")
  const win = byId(d, "refund", "refund.window")
  assert.match(win.text, /상품을 받은 날부터 7일/)
  assert.match(win.text, /알 수 있었던 날부터 7일/, "제17조①2 — 안 날 또는 알 수 있었던 날")
  assert.match(win.text, /방해가 끝난 날부터 7일/, "제17조①3 — 철회 방해 행위가 끝난 날")
  assert.match(win.text, /상품을 받은 날부터 3개월, 그 사실을 안 날 또는 알 수 있었던 날부터 30일/, "제17조③ — 표시·계약과 다른 이행")
  assert.doesNotMatch(win.text, /서비스|제공이 시작|유료 이용/)
  assert.ok(cites(win, ECOM, "제17조"))
  // 같은 기산일이 철회 안내 쪽에도 그대로
  assert.match(text(d, "withdrawal", "withdrawal.how"), /상품을 받은 날부터 7일/)
  assert.doesNotMatch(text(d, "withdrawal", "withdrawal.how"), /서비스|유료 이용/)
  // 사업자가 더 긴 기간을 약정했으면 그 기간(제17조① 괄호)
  const longer = draftLegalPages({ ...detail, product: { ...detail.product, returns: { ...detail.product.returns, withdrawalDays: 14 } } }, detailArch, "ko")
  assert.match(text(longer, "refund", "refund.window"), /상품을 받은 날부터 14일/)
})

test("goods 환급: 상품을 돌려받은 날부터 3영업일·상품 반환·카드 결제업자 요청·위약금 없음(제18조①②③⑨)", () => {
  const d = draftLegalPages(detail, detailArch, "ko")
  for (const [page, id] of [["refund", "refund.effect"], ["withdrawal", "withdrawal.effect"]]) {
    const c = byId(d, page, id)
    assert.match(c.text, /상품을 돌려받은 날부터 3영업일 안에/, id)
    assert.doesNotMatch(c.text, /^철회하면 철회한 날부터 3영업일/, `${id} — 서비스 기산일이 아니다`)
    assert.match(c.text, /지연배상금/)
    assert.match(c.text, /지체 없이 .*카드사/)
    assert.match(c.text, /이미 받은 상품은 돌려보내/)
    assert.match(c.text, /위약금이나 손해배상은 청구하지 않아요/)
    assert.ok(cites(c, ECOM, "제18조"))
  }
  // 서비스(saas)는 종전 문장 — 철회한 날부터 3영업일
  assert.match(text(draftLegalPages(saas, saasArch, "ko"), "refund", "refund.effect"), /철회한 날부터 3영업일/)
})

test("goods 반품 배송비: 철회(제17조①)는 고객 부담·표시·계약과 다르면 회사 부담, 회사가 다 내기로 했으면 그대로(제18조⑨⑩)", () => {
  const buyer = byId(draftLegalPages(detail, detailArch, "ko"), "refund", "refund.returnCost")
  assert.match(buyer.text, /마음이 바뀌어 철회하면 .*배송비는 고객이 내고/)
  assert.match(buyer.text, /안내나 계약과 다르게 왔다면 .*회사가 내요/)
  assert.match(buyer.text, /반품 보낼 곳과 방법: 서울특별시 마포구 월드컵로 120 반품 접수/)
  assert.ok(cites(buyer, ECOM, "제18조") && cites(buyer, ECOM, "제13조"))
  assert.equal(buyer.missing, undefined)
  const seller = byId(draftLegalPages({ ...detail, product: { ...detail.product, returns: { ...detail.product.returns, feePayer: "seller" } } }, detailArch, "ko"), "refund", "refund.returnCost")
  assert.match(seller.text, /철회 이유와 상관없이 회사가 내요/)
  assert.doesNotMatch(seller.text, /고객이 내고/)
  // 반품 주소·부담 주체를 모르면 지어내지 않고 빈 사실
  const bare = draftLegalPages({ ...detail, legal: {}, product: { ...detail.product, returns: { withdrawalDays: 7, exclusions: [] } } }, detailArch, "ko")
  assert.deepEqual(byId(bare, "refund", "refund.returnCost").missing.sort(), ["legal.returnAddress", "product.returns.feePayer"])
  assert.deepEqual(byId(bare, "refund", "refund.exchangeWarranty").missing.sort(), ["legal.exchange", "legal.warranty"])
  // 서비스에는 없다
  assert.equal(byId(draftLegalPages(saas, saasArch, "ko"), "refund", "refund.returnCost"), undefined)
})

test("goods 철회 제한: 고객 책임 훼손은 늘, 제17조②2~5는 운영자가 정한 정책(full|limited)과 콘텐츠 제한 사유가 맞을 때만 — 어긋나면 빈 사실", () => {
  const d0 = draftLegalPages(detail, detailArch, "ko")
  const base = byId(d0, "refund", "refund.limits")
  assert.match(base.text, /고객 책임으로 없어지거나 훼손된 경우에는 철회할 수 없어요/)
  assert.match(base.text, /포장을 뜯은 경우는 철회할 수 있어요/, "제17조②1 단서")
  assert.deepEqual(base.missing, ["legal.withdrawalPolicy"], "정책도 제한 사유도 없으면 운영자에게 받는다(기본값 없음)")
  // full: 그 밖의 제한 없음
  const full = byId(draftLegalPages({ ...detail, legal: { ...detail.legal, withdrawalPolicy: "full" } }, detailArch, "ko"), "refund", "refund.limits")
  assert.match(full.text, /그 밖에는 철회에 제한을 두지 않아요|위 경우 말고는 철회에 제한을 두지 않아요/)
  assert.equal(full.missing, undefined)
  assert.equal(cites(full, `${ECOM} 시행령`, "제21조"), false)
  // limited: 콘텐츠의 제한 사유를 싣고 포장·화면 표시 약속(제17조⑥), 시행령 제21조를 근거에
  const lim = byId(
    draftLegalPages({ ...detail, legal: { ...detail.legal, withdrawalPolicy: "limited" }, product: { ...detail.product, returns: { ...detail.product.returns, exclusions: ["세탁하거나 사용한 상품", "주문을 받아 따로 만든 상품"] } } }, detailArch, "ko"),
    "refund",
    "refund.limits",
  )
  assert.match(lim.text, /- 세탁하거나 사용한 상품/)
  assert.match(lim.text, /쉽게 알 수 있게 미리 표시해요/)
  assert.match(lim.text, /표시하지 않은 상품은 이 이유로 철회를 막지 않아요/)
  assert.match(lim.text, /주문을 받아 따로 만든 상품은 .*서면\(전자문서\)으로 동의를 받은 경우에만/, "시행령 제21조 — 주문 제작 사전 고지와 동의")
  assert.ok(cites(lim, `${ECOM} 시행령`, "제21조"))
  assert.equal(lim.missing, undefined)
  // 정책 없이 제한 사유만 있으면 limited 로 읽는다(운영자가 적은 사실이다)
  const implied = byId(draftLegalPages({ ...detail, product: { ...detail.product, returns: { ...detail.product.returns, exclusions: ["세탁하거나 사용한 상품"] } } }, detailArch, "ko"), "refund", "refund.limits")
  assert.match(implied.text, /- 세탁하거나 사용한 상품/)
  assert.equal(implied.missing, undefined)
  // full 인데 제한 사유가 있으면 서로 어긋난다 — 한쪽을 고르지 않고 빈 사실로 남긴다
  const clash = byId(draftLegalPages({ ...detail, legal: { ...detail.legal, withdrawalPolicy: "full" }, product: { ...detail.product, returns: { ...detail.product.returns, exclusions: ["세탁하거나 사용한 상품"] } } }, detailArch, "ko"), "refund", "refund.limits")
  assert.deepEqual(clash.missing, ["legal.withdrawalPolicy"])
  assert.doesNotMatch(clash.text, /세탁하거나 사용한 상품/)
  // 철회 안내 쪽에도 같은 제한 조항(제17조②·⑥)이 있다
  const both = draftLegalPages({ ...detail, legal: { ...detail.legal, withdrawalPolicy: "limited" }, product: { ...detail.product, returns: { ...detail.product.returns, exclusions: ["세탁하거나 사용한 상품"] } } }, detailArch, "ko")
  assert.equal(text(both, "withdrawal", "withdrawal.limits"), text(both, "refund", "refund.limits"))
  assert.match(text(both, "withdrawal", "withdrawal.limits"), /- 세탁하거나 사용한 상품/)
})

test("goods 약관: 상품·공급 방법·공급 시기, 결제대금예치·피해보상보험 선택 고지(제13조②10·제24조②③), 정기결제·체험 문장은 콘텐츠에 있을 때만", () => {
  const d = draftLegalPages(detail, detailArch, "ko")
  const svc = byId(d, "terms", "terms.service")
  assert.match(svc.text, /상품: 손바느질 린넨 앞치마/)
  assert.match(svc.text, /종류: 의류/)
  assert.match(svc.text, /소재 린넨 100%/)
  assert.match(svc.text, /공급 방법: .*한빛택배/)
  assert.match(svc.text, /배송비 3,000원\(50,000원 이상 무료\)/)
  assert.match(svc.text, /공급 시기: 결제 후 영업일 기준 3일 안에 출고해요/)
  assert.doesNotMatch(svc.text, /서비스|이용 시작 시기|웹 브라우저/)
  assert.equal(svc.missing, undefined)
  assert.ok(cites(svc, ECOM, "제13조"))
  // 선지급식 통신판매 — 결제대금예치·소비자피해보상보험 선택, 신용카드 거래 제외
  const pp = byId(d, "terms", "terms.prepayProtection")
  assert.ok(pp, "물품 약관에는 선지급 보호 조항")
  assert.match(pp.text, /결제대금예치/)
  assert.match(pp.text, /소비자피해보상보험/)
  assert.match(pp.text, /신용카드로 대금을 지급하는 거래에는 적용하지 않아요/)
  assert.match(pp.text, /소비자피해보상보험 — 예시보증/)
  assert.ok(cites(pp, ECOM, "제13조") && cites(pp, ECOM, "제24조"))
  assert.equal(pp.missing, undefined)
  // 제공자를 모르면 빈 사실 — commerce 는 business.escrowProvider 를 읽는다
  assert.deepEqual(byId(draftLegalPages({ ...detail, legal: { ...detail.legal, prepayProtection: undefined } }, detailArch, "ko"), "terms", "terms.prepayProtection").missing, ["legal.prepayProtection"])
  const com = draftLegalPages({ business: { ...business, escrowProvider: "예시에스크로" }, products: [{ name: "빵" }], shipping: { fee: 3000, courier: "한빛택배", leadDays: 2 }, legal: { paymentProvider: "토스페이먼츠" } }, commerceArch, "ko")
  assert.match(text(com, "terms", "terms.prepayProtection"), /예시에스크로/)
  assert.equal(byId(com, "terms", "terms.prepayProtection").missing, undefined)
  // 결제 조항: 정기결제 문장·무료→유료 전환 조항이 없다(콘텐츠에 요금제·체험이 없으니)
  const pay = byId(d, "terms", "terms.payment")
  assert.match(pay.text, /가격: 39,000원\(부가세 포함\)/)
  assert.doesNotMatch(pay.text, /정기 결제|오르기 전 30일|해지/)
  assert.equal(pay.needs.some((n) => n.article === "제20조의2"), false)
  assert.equal(byId(d, "terms", "terms.trialConversion"), undefined)
  const change = byId(d, "terms", "terms.change")
  assert.doesNotMatch(change.text, /요금이 오르거나|무료 이용이 유료|해지할 수 있어요/)
  assert.match(change.text, /바뀐 약관은 이미 주문한 거래에는 적용하지 않아요/)
  assert.equal(change.needs.some((n) => n.article === "제20조의2"), false)
  assert.ok(change.notes.some((n) => n.kind === "convention"))
  // 콘텐츠에 요금제(월 가격)가 있으면 구독이라 정기결제 문장이 다시 생긴다
  const sub = draftLegalPages({ ...detail, plans: [{ name: "월", monthlyPrice: 9900, currency: "KRW" }] }, detailArch, "ko")
  assert.match(text(sub, "terms", "terms.payment"), /오르기 전 30일 안에/)
  assert.ok(legalContext({ ...detail, plans: [{ name: "월", monthlyPrice: 9900 }] }, detailArch).recurring)
  assert.equal(legalContext(detail, detailArch).recurring, false)
})

test("saas(서비스)는 종전 서비스·구독 문장 — 물품 조항이 생기지 않는다(음성 대조)", () => {
  const d = draftLegalPages(saas, saasArch, "ko")
  assert.match(text(d, "refund", "refund.window"), /서비스 제공이 서면을 받은 때보다 늦게 시작되면/)
  assert.ok(byId(d, "terms", "terms.trialConversion"))
  assert.match(text(d, "terms", "terms.payment"), /오르기 전 30일 안에/)
  assert.match(text(d, "terms", "terms.service"), /서비스: 견적노트/)
  for (const id of ["terms.prepayProtection"]) assert.equal(byId(d, "terms", id), undefined, id)
  for (const id of ["refund.returnCost", "refund.exchangeWarranty"]) assert.equal(byId(d, "refund", id), undefined, id)
  assert.doesNotMatch(d.refund.markdown, /상품을 돌려받은 날부터/)
  assert.equal(legalContext(saas, saasArch).goods, false)
  assert.equal(legalContext(saas, saasArch).recurring, true)
})

test("철회 제한 조항은 철회 안내 쪽(withdrawal)에도 같은 글이다(서비스·물품 모두 — 결제 화면 고지와 한 덩어리)", () => {
  const svc = draftLegalPages(saas, saasArch, "ko")
  const a = byId(svc, "refund", "refund.limits")
  const b = byId(svc, "withdrawal", "withdrawal.limits")
  assert.ok(b, "saas 철회 안내에 제한 조항")
  assert.equal(b.text, a.text)
  assert.ok(cites(b, ECOM, "제17조"))
  const goods = draftLegalPages(detail, detailArch, "ko")
  assert.equal(byId(goods, "withdrawal", "withdrawal.limits").text, byId(goods, "refund", "refund.limits").text)
})

test("placeholder: 물품 초안에 지어낸 사실이 없다 — 사실을 다 빼면 조항마다 「확인 필요」 경로가 남는다", () => {
  const d = draftLegalPages({ business: { name: "솜결" }, product: { name: "앞치마", shipping: {} } }, detailArch, "ko")
  const ph = PLACEHOLDER.ko
  assert.ok(byId(d, "terms", "terms.service").text.includes(ph))
  assert.ok(byId(d, "terms", "terms.prepayProtection").text.includes(ph))
  assert.ok(byId(d, "refund", "refund.returnCost").text.includes(ph))
  assert.ok(byId(d, "refund", "refund.exchangeWarranty").text.includes(ph))
})

// 대장 C358 — commerce 약관의 가격 줄은 브리프 문장(facts.price 「13,000원부터」)이 아니라 상품 목록(products)의 가격이 정한다.
// 골든 commerce-1: 드립백 10입이 9,900원인데 약관은 「13,000원부터」였다(전자상거래법 제13조 ②3·⑤ 가격 표시 불일치).
const listed = (facts, products) => ({ business, products, shipping: { fee: 3500, freeThreshold: 40000, courier: "한빛택배", leadDays: 1 }, ...(facts ? { facts } : {}) })
const P = (price) => ({ name: `상품${price}`, price })

test("C358 commerce 가격: 상품 목록의 최저가가 브리프 문장 대신 쓰인다(부가세 표기만 브리프에서 옮긴다)", () => {
  const d = draftLegalPages(listed({ price: "13,000원부터(부가세 포함)" }, [P(13000), P(16000), P(9900)]), commerceArch, "ko")
  const t = text(d, "terms", "terms.payment")
  assert.match(t, /가격: 9,900원부터\(상품마다 달라요, 부가세 포함\)/)
  assert.doesNotMatch(t, /13,000원부터/, "브리프 문장이 그대로 남았다")
  assert.match(t, /배송비 3,500원\(40,000원 이상 무료\)/)
})

test("C358 commerce 가격: 상품이 하나뿐이거나 값이 같으면 「부터」가 없다 · 부가세 표기가 브리프에 없으면 적지 않는다(지어내지 않는다)", () => {
  const one = text(draftLegalPages(listed({ price: "9,900원" }, [P(9900)]), commerceArch, "ko"), "terms", "terms.payment")
  assert.match(one, /가격: 9,900원 · 배송비/)
  assert.doesNotMatch(one, /부터|부가세/)
  const same = text(draftLegalPages(listed(undefined, [P(5000), P(5000)]), commerceArch, "ko"), "terms", "terms.payment")
  assert.match(same, /가격: 5,000원 · 배송비/)
})

test("C358 음성 대조: 상품 목록에 숫자 가격이 없으면 예전처럼 브리프 문장을 쓴다 · 상세(product.price)는 그대로", () => {
  const noNum = text(draftLegalPages(listed({ price: "13,000원부터(부가세 포함)" }, [{ name: "빵" }]), commerceArch, "ko"), "terms", "terms.payment")
  assert.match(noNum, /가격: 13,000원부터\(부가세 포함\)/)
  const d = draftLegalPages(detail, detailArch, "ko")
  assert.match(text(d, "terms", "terms.payment"), /가격: 39,000원\(부가세 포함\)/)
})

test("C358 en commerce: 상품 목록 가격이 브리프 문장보다 먼저다", () => {
  const en = text(draftLegalPages({ ...listed({ price: "From 13,000 won" }, [P(13000), P(9900)]), business: { ...business, email: "hello@x.com" } }, commerceArch, "en"), "terms", "terms.delivery")
  assert.match(en, /Prices start from ₩9,900 \(the price differs by item\)\./)
  assert.doesNotMatch(en, /13,000/)
})
