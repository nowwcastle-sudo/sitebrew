// P4CON — 재생성한 detail-ko 초안의 법률 재검토(2026-10-01, 법률 에이전트 1회)가 짚은 문구·구조 결함 반영.
// 조문은 law-api 현행본으로 대조했다(전자상거래법 MST 282793·시행령 MST 288143 시행 2026-07-21, 개인정보 보호법 MST 283839) — 보고서 「공식 문서 근거」.
// 실행: node --test --test-force-exit --test-timeout=60000 factory/scripts/legal-goods-rereview.test.mjs
import { test } from "node:test"
import assert from "node:assert/strict"
import { draftLegalPages } from "../legal/drafts.mjs"

const ECOM = "전자상거래 등에서의 소비자보호에 관한 법률"
const pages = ["privacy", "terms", "refund", "withdrawal"]
const detailArch = { id: "detail", legal: { pages, laws: { ko: [], en: [] } } }
const saasArch = { id: "saas", legal: { pages, laws: { ko: [], en: [] } } }
const business = { name: "솜결", representative: "김하늘", bizRegNo: "123-45-67890", mailOrderNo: "제2026-서울마포-0001호", address: "서울특별시 마포구 월드컵로 120", phone: "02-1234-5678", email: "help@example.com" }
const detail = {
  business,
  product: { name: "손바느질 린넨 앞치마", price: 39000, currency: "KRW", taxIncluded: true, shipping: { fee: 3000, freeThreshold: 50000, courier: "한빛택배", leadDays: 3 }, returns: { feePayer: "buyer", withdrawalDays: 7, exclusions: [] } },
  notice: { category: "의류", rows: [{ label: "소재", value: "린넨 100%" }] },
  legal: { paymentProvider: "토스페이먼츠", returnAddress: "서울특별시 마포구 월드컵로 120 반품 접수", exchange: "받은 날부터 7일 안에 같은 상품으로 바꿔 드려요", warranty: "구입일부터 1년", prepayProtection: "소비자피해보상보험 — 예시보증" },
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

test("재검토 ① 거래기록 보존(시행령 제6조①3): 물품은 「상품 공급」, 동의는 「철회한 뒤에도」(제6조②3)", () => {
  const goods = text(draftLegalPages(detail, detailArch, "ko"), "privacy", "privacy.retention")
  assert.match(goods, /대금 결제 및 상품 공급에 관한 기록: 5년/)
  assert.doesNotMatch(goods, /서비스 공급/)
  assert.match(goods, /개인정보 이용 동의를 철회한 뒤에도/)
  assert.doesNotMatch(goods, /동의를 거둔/)
  const svc = text(draftLegalPages(saas, saasArch, "ko"), "privacy", "privacy.retention")
  assert.match(svc, /대금 결제 및 서비스 공급에 관한 기록: 5년/)
  assert.match(svc, /개인정보 이용 동의를 철회한 뒤에도/)
})

test("재검토 ② 약관 설명(약관법 제3조②③): 물품은 주문하기 전, 서비스는 가입 전", () => {
  const goods = text(draftLegalPages(detail, detailArch, "ko"), "terms", "terms.explain")
  assert.match(goods, /청약철회·환불·배송처럼 중요한 내용은 주문하기 전에 따로 알려 드려요/)
  assert.doesNotMatch(goods, /가입|서비스 첫 화면/)
  assert.match(text(draftLegalPages(saas, saasArch, "ko"), "terms", "terms.explain"), /가입 전에 따로 알려 드려요/)
})

test("재검토 ③ 책임의 제한(약관법 제6조②1·제7조): 고의·중과실만 책임지는 것으로 읽히지 않는다", () => {
  for (const [c, a] of [[detail, detailArch], [saas, saasArch]]) {
    const t = text(draftLegalPages(c, a, "ko"), "terms", "terms.liability")
    assert.match(t, /회사의 잘못으로 고객에게 손해가 생기면 법이 정한 범위에서 배상해요/)
    assert.match(t, /천재지변처럼 회사가 막을 수 없는 사유로 생긴 손해는 예외예요/)
    assert.doesNotMatch(t, /중대한 과실/)
  }
  assert.match(text(draftLegalPages(detail, detailArch, "ko"), "terms", "terms.liability"), /상품이 안내나 계약과 다르면 「환불 정책」에 따라 청약을 철회할 수 있어요/)
  assert.doesNotMatch(text(draftLegalPages(saas, saasArch, "ko"), "terms", "terms.liability"), /환불 정책/)
})

test("재검토 ④ 환급: 상품을 받기 전 철회는 철회한 날부터 3영업일(제18조②3), 지연배상금 연 15%(시행령 제21조의3)", () => {
  const d = draftLegalPages(detail, detailArch, "ko")
  for (const [page, id] of [["refund", "refund.effect"], ["withdrawal", "withdrawal.effect"]]) {
    const t = text(d, page, id)
    assert.match(t, /상품을 아직 받지 않은 채 철회하면 철회한 날부터 3영업일 안에 결제한 대금을 돌려드려요/, id)
    assert.match(t, /지연배상금\(연 15%\)/, id)
  }
  assert.match(text(draftLegalPages(saas, saasArch, "ko"), "refund", "refund.effect"), /지연배상금\(연 15%\)/)
  assert.ok(cites(byId(d, "refund", "refund.effect"), `${ECOM} 시행령`, "제21조의3"))
})

test("재검토 ⑤ 새 물품 조항: 공급 곤란(제15조②)·청약철회 안내(제13조②5·6)·계약 내용 서면(제13조② 본문)·동의 없이 처리(개인정보 보호법 제22조③) — 서비스에는 없다", () => {
  const d = draftLegalPages(detail, detailArch, "ko")
  const sf = byId(d, "terms", "terms.supplyFailure")
  assert.match(sf.text, /지체 없이 그 이유를 알려 드려요/)
  assert.match(sf.text, /대금을 받은 날부터 3영업일 안에 돌려드리거나/)
  assert.ok(cites(sf, ECOM, "제15조"))
  const wn = byId(d, "terms", "terms.withdrawalNotice")
  assert.match(wn.text, /받은 날부터 7일 안에 청약을 철회할 수 있어요/)
  assert.match(wn.text, /「청약철회 안내」와 「환불 정책」/)
  assert.ok(cites(wn, ECOM, "제13조"))
  const cd = byId(d, "terms", "terms.contractDocument")
  assert.match(cd.text, /계약 내용 서면을 상품을 보낼 때까지 드려요/)
  assert.deepEqual(cd.missing, ["legal.contractDelivery"], "드리는 방법은 대표 사실")
  assert.equal(byId(draftLegalPages({ ...detail, legal: { ...detail.legal, contractDelivery: "주문 확인 메일에 붙여 드려요" } }, detailArch, "ko"), "terms", "terms.contractDocument").missing, undefined)
  const nc = byId(d, "privacy", "privacy.noConsent")
  assert.match(nc.text, /동의 없이 처리해요/)
  assert.ok(cites(nc, "개인정보 보호법", "제22조") && cites(nc, "개인정보 보호법", "제15조"))
  assert.deepEqual(nc.missing, ["legal.collects"])
  const s = draftLegalPages(saas, saasArch, "ko")
  for (const id of ["terms.supplyFailure", "terms.withdrawalNotice", "terms.contractDocument"]) assert.equal(byId(s, "terms", id), undefined, id)
  assert.equal(byId(s, "privacy", "privacy.noConsent"), undefined)
})

test("재검토 ⑥ 반품 비용(시행령 제20조1호 — 교환·반품 비용은 내용과 금액)·공급 제한(제20조2호 — 있을 때만)", () => {
  const buyer = byId(draftLegalPages(detail, detailArch, "ko"), "refund", "refund.returnCost")
  assert.deepEqual(buyer.missing, ["legal.returnFee"], "고객이 내는 반품 배송비 금액은 대표 사실")
  assert.ok(cites(buyer, `${ECOM} 시행령`, "제20조"))
  const fee = byId(draftLegalPages({ ...detail, legal: { ...detail.legal, returnFee: "택배 실비 6,000원" } }, detailArch, "ko"), "refund", "refund.returnCost")
  assert.match(fee.text, /고객이 내는 반품 배송비: 택배 실비 6,000원/)
  assert.equal(fee.missing, undefined)
  const seller = byId(draftLegalPages({ ...detail, product: { ...detail.product, returns: { ...detail.product.returns, feePayer: "seller" } } }, detailArch, "ko"), "refund", "refund.returnCost")
  assert.doesNotMatch(seller.text, /고객이 내는 반품 배송비/)
  assert.equal(seller.missing, undefined, "회사가 다 내면 금액 사실이 필요 없다")
  // 공급 제한은 있을 때만 줄이 생긴다(없다고 지어내지 않는다)
  assert.doesNotMatch(text(draftLegalPages(detail, detailArch, "ko"), "terms", "terms.service"), /공급 제한/)
  assert.match(text(draftLegalPages({ ...detail, legal: { ...detail.legal, supplyLimits: "제주·도서 지역은 배송하지 않아요" } }, detailArch, "ko"), "terms", "terms.service"), /공급 제한: 제주·도서 지역은 배송하지 않아요/)
})

test("실측 ⑦ 약관 쪽의 가격 줄: 배송비가 가격과 같은 줄에 먼저 나온다(marketing-site total-first-screen — 추가 비용이 첫 가격 화면 밖에서 처음 나오면 MUST 실패)", () => {
  const d = draftLegalPages(detail, detailArch, "ko")
  const pay = text(d, "terms", "terms.payment")
  assert.ok(pay.includes("가격: 39,000원(부가세 포함) · 배송비 3,000원(50,000원 이상 무료)"), pay)
  // 약관 쪽 글 전체에서 「배송비」가 처음 나오는 조항은 가격을 말하는 조항이다
  const clauses = d.terms.clauses
  const firstFee = clauses.findIndex((c) => c.text.includes("배송비"))
  const firstPrice = clauses.findIndex((c) => c.text.includes("가격:"))
  assert.ok(firstPrice >= 0 && firstFee === firstPrice, `가격 조항 ${firstPrice} · 첫 배송비 조항 ${firstFee}`)
  // 배송비가 공짜면 「무료」, 배송비 사실이 없으면 줄을 붙이지 않는다(지어내지 않는다)
  assert.ok(text(draftLegalPages({ ...detail, product: { ...detail.product, shipping: { ...detail.product.shipping, fee: 0, freeThreshold: undefined } } }, detailArch, "ko"), "terms", "terms.payment").includes("배송비 무료"))
  assert.equal(text(draftLegalPages({ ...detail, product: { ...detail.product, shipping: { courier: "한빛택배", leadDays: 3 } } }, detailArch, "ko"), "terms", "terms.payment").includes("배송비"), false)
})
