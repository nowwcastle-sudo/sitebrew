# 운영 런북(전문가용) — 한국 사업 등록

*Expert runbook: business registration in Korea. English follows the Korean part.*

- 확인일: 2026-10-22. 기관 안내는 바뀐다. 90일이 지나면 다시 확인한다.
- 대상: 한국어 사이트로 결제·판매를 받으려는 운영자. 카드에 `when: { locale: "ko", outcomes: [결제·판매 성과] }` 가 걸려 있어 한국어 사이트이고 결제·판매 성과를 고른 경우에만 넣는다.
- 용도: 플러그인 런북 기능의 **내용 원천**이다. 전문가용은 이 글을 그대로 쓰고, 초보자용은 이 글의 항목을 풀어 쓴다. 흐름만 짧게 적는다. 금액·수수료 숫자는 적지 않는다.
- 장 id: `G-biz-kr` (`need: optional`).

## G-biz-kr — 한국 사업 등록 (사업자등록 · 통신판매업 신고 · PG 가맹)

법률·세무 자문이 아니에요. 관할 기관(국세청·시군구)이나 전문가에게 확인하세요.

- 왜: 한국에서 사이트로 돈을 받으려면 순서가 있다. 사업자등록 → 통신판매업 신고 → 카드 결제(PG) 가맹 심사. 앞 단계가 끝나야 다음 단계 서류가 나온다.
- 준비물: 신분증, 사업 종류와 사업장 정보, 실제로 물건·서비스를 파는 사이트 주소(호스팅·도메인 장 뒤).
- 등록 1 — 사업자등록: 세무서를 찾아가거나 국세청 홈택스에서 신청한다. 사업을 시작한 날부터 20일 안에 신청한다. 처리에 며칠이 걸린다. 정확한 날수는 [확인 안 됨] — 세무서나 홈택스 안내에서 확인한다.
- 등록 2 — 통신판매업 신고: 사업자등록과 **별개의 신고**다. 사업장 관할 시군구에 정부24 또는 방문으로 신고한다. 처리에 며칠이 걸린다. 정확한 날수는 [확인 안 됨] — 정부24 안내나 관할 시군구에서 확인한다. 대금을 먼저 받는 방식이면 신고할 때 구매안전서비스 이용확인증을 내야 한다. 신고 대상이 아닌 경우(면제)가 있을 수 있으니 해당하는지는 관할 시군구에 확인한다.
- 등록 3 — PG 가맹: 이 키트에 어댑터가 있는 카드·간편결제 연동은 PortOne(V2) 하나다(성과 `shop`). PortOne 에서 전자결제를 신청하고 사업자 정보를 내면 PG 사가 평균 3영업일 안에 연락해 입점 가능 여부를 본다. 입점 가능 여부는 실제 상품이 팔리는 사이트가 세팅돼 있어야 확인된다. 계약 뒤 카드사 심사가 약 2주 걸리고, 심사가 끝나기 전에는 실제 결제가 실패한다. 승인 뒤 값을 호스팅에 넣는 일은 상점 결제 장(`G-payments-kr`)에서 한다. 해외 카드 구독(Paddle)은 `G-billing` 장이고 이 장의 PG 가맹과 다른 길이다.
- 설정: 등록이 끝나면 사이트에 사업자 정보를 넣는다. 환경 변수 `LF_BUSINESS_NAME`·`LF_BUSINESS_ADDRESS`·`LF_BUSINESS_PHONE`·`LF_BUSINESS_EMAIL` 을 호스팅 대시보드에 넣는다. 대표자·사업자등록번호·호스팅 제공자·통신판매업 신고번호 칸의 이름은 `.env.example` 의 「사업자 정보」 절에 있다. 신고번호는 신고가 끝난 뒤에만 넣는다. 푸터가 값이 있는 칸만 그린다.
- 확인: 사이트 푸터에 사업자 정보가 보인다. 사이트 폴더에서 `npm run doctor -- --stage preview` 를 돌리면 표시해야 할 칸이 비어 있을 때 경고한다(값은 출력하지 않는다).
- 막힘 1 — 순서가 거꾸로다: 통신판매업 신고와 PG 가맹은 사업자등록 서류가 있어야 한다. 사업자등록부터 한다.
- 막힘 2 — 신고 서류가 모자란다고 한다: 대금을 먼저 받는 방식이면 구매안전서비스 이용확인증이 빠졌는지 본다.
- 막힘 3 — PG 사가 입점이 어렵다고 한다: PG 사마다 받는 업종이 다르다. 사이트가 세팅돼 있어야 심사가 된다는 점도 본다.
- 막힘 4 — 계약했는데 실제 결제가 실패한다: 카드사 심사가 끝나기 전이다. 약 2주를 기다린다(고칠 수 없다).
- 출처: 국세청(사업자등록 안내·홈택스), 정부24(통신판매업 신고), 공정거래위원회(통신판매업 등록 정보), 한국소비자원 소비자24(구매안전서비스 안내), PortOne 개발자 문서·도움말(전자결제 신청, PG 계약, 카드사 심사). 이 저장소의 `.env.example`, `packages/payments-kr`.

---

# Expert runbook — business registration in Korea

*Source of content for the plugin runbook feature. Expert version: use as is. Beginner version: expand each item. Only the flow is written, short. No amounts or fees. Checked 2026-10-22; re-check after 90 days.*

- Audience: an operator who takes payments or sells through a Korean-language site. The card carries `when: { locale: "ko", outcomes: [payment or sale outcomes] }`, so this chapter is included only for a Korean-language site that chose a payment or sale outcome.
- Chapter id: `G-biz-kr` (`need: optional`).

## G-biz-kr

This is not legal or tax advice. Check with the authorities (the National Tax Service, your city/county/district office) or a professional.

- Why: taking money through a site in Korea has an order. Business registration → mail-order (online sales) business report → card payment (PG) merchant review. The papers for each step come from the step before it.
- What you need: an ID, the kind of business and the business address, and the address of the site that really sells the goods or service (after the hosting and domain chapters).
- Register 1 — Business registration: apply at a tax office or on the National Tax Service's Hometax. Apply within 20 days of the day you start the business. Processing takes a few days. The exact number of days was not checked [확인 안 됨] — confirm it with the tax office or Hometax.
- Register 2 — Mail-order business report: this is a **separate report** from business registration. Report to the city/county/district office that covers your business address, on Government24 or in person. Processing takes a few days. The exact number of days was not checked [확인 안 됨] — confirm it in the Government24 notice or with your local office. If you take payment before delivery, you must hand in a purchase-safety service confirmation with the report. Some businesses may be exempt from reporting; ask your local office whether you are.
- Register 3 — PG merchant contract: the card and easy-payment connection this kit has an adapter for is PortOne (V2) only (outcome `shop`). Apply for electronic payment at PortOne and give your business details; the PG company contacts you within 3 business days on average and checks whether it can take you on. That check needs the site that really sells the goods to be set up. After the contract, the card company review takes about 2 weeks, and real payments fail until it ends. Putting the values into the host after approval is done in the shop payments chapter (`G-payments-kr`). Overseas card subscriptions (Paddle) are the `G-billing` chapter and a different path from the PG contract here.
- Config: after registering, put your business details on the site. Add the environment variables `LF_BUSINESS_NAME`, `LF_BUSINESS_ADDRESS`, `LF_BUSINESS_PHONE` and `LF_BUSINESS_EMAIL` in the host dashboard. The names of the fields for the representative, the business registration number, the hosting provider and the mail-order report number are in the "business information" section of `.env.example`. Add the report number only after the report is done. The footer draws only the fields that have a value.
- Check: the site footer shows the business details. In the site folder, `npm run doctor -- --stage preview` warns when a field that must be shown is empty (it never prints the values).
- Stuck 1 — The order is backwards: the mail-order report and the PG contract need the business registration papers. Start with business registration.
- Stuck 2 — The report is said to lack papers: if you take payment before delivery, check whether the purchase-safety service confirmation is missing.
- Stuck 3 — The PG company says it is hard to take you on: each PG company accepts different kinds of business. Also check that the site is set up, since the review needs it.
- Stuck 4 — You signed but real payments fail: the card company review has not ended. Wait about 2 weeks (it cannot be sped up here).
- Sources: National Tax Service (business registration guide, Hometax), Government24 (mail-order business report), Fair Trade Commission (mail-order business registration information), Korea Consumer Agency Consumer24 (purchase-safety service guide), PortOne developer documents and help center (electronic payment application, PG contract, card company review). This repository's `.env.example` and `packages/payments-kr`.
