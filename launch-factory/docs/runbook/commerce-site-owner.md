# 운영 런북(전문가용) — 상점 · 국내 결제 (PortOne V2)

*Expert runbook: shop and Korean payments (PortOne V2). English follows the Korean part.*

- 확인일: 2026-10-22. 외부 서비스 화면은 바뀐다. 90일이 지나면 다시 확인한다.
- 대상: 이 모듈로 상품을 직접 팔기로 정한 사이트 운영자. 모듈은 그대로 두고 계정·계약·키는 운영자가 직접 한다.
- 용도: 플러그인 런북 기능의 **내용 원천**이다. 전문가용은 이 글을 그대로 쓰고, 초보자용은 이 글의 항목을 풀어 쓴다. 콘솔 단추 이름·주소·경로는 이 글에 깊이 적지 않는다(버전마다 다르다). 사실표 기준: `@portone/browser-sdk` 0.1.13 · `@portone/server-sdk` 0.19.0.
- 장 id: `G-payments-kr` · `G-commerce` (`features/outcomes.yaml` guides 열과 같다).
- 값(키·비밀·번호)은 채팅·저장소·로그에 쓰지 않는다. `vercel env add <이름>` 표준 입력이나 호스팅 대시보드에 직접 넣는다.

## 0. mock 과 live

`LF_MODE=mock`(기본)이면 키가 있어도 모의 결제를 쓴다. 진짜 돈이 오가는 것은 live 에서 PortOne 값 넷이 다 있을 때뿐이다.

| 구분 | mock | live, 값이 하나라도 없으면 |
|---|---|---|
| 결제 게이트웨이 | 자체 mock(키 없음·외부 호출 없음·메모리만 써서 서버가 다시 뜨면 결제 대기가 사라진다). PortOne 은 키 없는 샌드박스를 주지 않아 미리보기는 이 mock 이 맡는다 | **상점만 꺼진다**. `commerceEnabled()` 가 false |
| 웹훅 `/api/webhooks/portone` | 404 (받지 않는다) | 404 (비밀이 없으면 받지 않는다) |
| 상점 서버 액션 | 동작(모의 결제 `payWithMock`) | `provider_unavailable`, `retryable: false`. 사이트·다른 기능은 켜진 채 |
| Cron `/api/cron/commerce` | 켜진 상점의 만료 정리 | `{ skipped: "commerce_disabled" }` — 오류 아님 |

## 1. 환경 변수

정본은 `.env.example`. 넷 모두 선택이다 — 없어도 사이트가 켜지고, 상점만 꺼진다.

| 이름 | 비밀 | 기능 | 없으면 |
|---|---|---|---|
| `NEXT_PUBLIC_PORTONE_STORE_ID` | 아니오(브라우저 노출) | 결제창 | 상점 꺼짐 |
| `NEXT_PUBLIC_PORTONE_CHANNEL_KEY` | 아니오(브라우저 노출) | 결제창(채널 키) | 상점 꺼짐 |
| `PORTONE_API_SECRET` | **예** | 서버 재조회·취소/환불 | 상점 꺼짐 |
| `PORTONE_WEBHOOK_SECRET` (`whsec_…`) | **예** | 웹훅 서명 확인 | 상점 꺼짐 |
| `CRON_SECRET` | **예** | `/api/cron/commerce` 인증(기존 값 재사용) | Cron 401 — 만료 정리가 안 돈다 |
| `EMAIL_FROM` (+ 메일 항목 설정) | 아니오 | 주문 확인 메일 | 메일만 안 간다(`onError` 로 기록, 주문은 확정된다) |

`NEXT_PUBLIC_*` 는 빌드 때 번들에 들어간다 — 바꾸면 다시 배포한다. 어디에도 값을 찍지 않고 꺼진 까닭에는 이름만 나온다. 채널과 웹훅은 테스트/실연동 모드별로 따로이고(공식), API Secret 이 모드별로 따로인지는 [확인 안 됨].

## G-payments-kr — 국내 결제 (PortOne V2)

- 왜 필요한가: 상점이 한국 카드·간편결제로 돈을 받으려면 PortOne 계정과 결제 채널, 서버용 비밀, 웹훅 비밀이 있어야 한다. 값 넷 중 하나라도 없으면 상점만 꺼지고 사이트의 다른 부분은 켜진 채로 남는다.
- 준비물: 사업자등록·통신판매업 신고·PG 가맹을 다루는 `G-biz-kr` 를 먼저 끝낸 상태. 올라간 사이트의 주소(웹훅 주소와 복귀 주소에 쓴다), 데이터베이스(`G-db`)와 호스팅(`G-hosting`)이 끝난 상태. 호스팅 환경 변수에 값을 넣을 수 있는 계정.
- 등록 1 — PortOne 에 가입한다. 공식 안내에 따르면 가입은 별도 계약 없이 무료이고, 가입 뒤 인증 메일을 확인해야 로그인된다. 실결제를 받으려면 콘솔의 전자결제 신청에서 사업자 정보를 입력하고 쓸 PG·결제수단을 신청한다. 이 신청의 소요 일수는 [확인 안 됨]이다(PG 연락과 카드사 심사 기간은 `G-biz-kr` 의 PG 가맹 항목을 본다). 전자결제를 신청하기 전에도 테스트 채널로 먼저 시험할 수 있다.
- 등록 2 — 상점 아이디(store id)를 확인한다. 가입하면 대표 상점이 자동으로 만들어지고, 상점마다 고유한 값이 있다 → `NEXT_PUBLIC_PORTONE_STORE_ID`. 결제창을 열 때 쓰는 공개 값이다.
- 등록 3 — 결제 채널을 만든다. 콘솔의 채널 관리에서 연동 모드(테스트 또는 실연동)와 결제대행사(PG), 결제 모듈을 고른다. 테스트 채널은 공용 테스트 상점 아이디를 고르거나 직접 받은 테스트 아이디를 넣는다. 실연동 채널은 PG 와 계약한 뒤 받은 상점 아이디와 추가 정보를 넣는다. 채널을 만들면 얻는 채널 키 → `NEXT_PUBLIC_PORTONE_CHANNEL_KEY`(공개 값). 간편결제(카카오페이·네이버페이·토스페이)는 PG·사별 계약과 심사가 따로 필요하다.
- 등록 4 — 콘솔의 식별코드·API Keys 쪽에서 V2 API Secret 을 발급한다. 발급과 삭제는 소유자·관리자 계정만 할 수 있고, 값은 발급 직후에만 보인다(잊으면 새로 발급한다). 서버에서만 쓰고 브라우저에 노출하지 않는다 → `PORTONE_API_SECRET`. 보이는 그 자리에서 호스팅 환경 변수에 넣는다.
- 등록 5 — 웹훅을 등록한다. 콘솔의 결제알림(웹훅) 관리 쪽에서 웹훅 버전은 결제모듈 V2, 설정 모드는 테스트 또는 실연동 중 하나를 고른다. 모드마다 주소와 웹훅 시크릿을 따로 둘 수 있다. 주소는 `https://<도메인>/api/webhooks/portone`, 발급받은 웹훅 시크릿(`whsec_…`) → `PORTONE_WEBHOOK_SECRET`. 주소를 바꿨으면 저장한 뒤에 시험 알림을 보낸다(저장하지 않고 시험하면 이전에 저장한 주소로 간다).
- 설정: 위 넷을 호스팅 환경 변수에 넣는다(대시보드 또는 `vercel env add <이름>` 표준 입력). `NEXT_PUBLIC_*` 둘은 빌드 때 번들에 들어가므로 바꾸면 다시 배포한다. 값은 채팅·저장소·로그에 쓰지 않는다.
- 설정: 실제 돈이 오가는 배포는 `LF_MODE` 를 live 로 둔다. mock 에서는 PortOne 값이 있어도 모의 결제를 쓴다.
- 설정: 결제 대기 주문을 정리하는 Cron 이 돌려면 `CRON_SECRET` 이 호스팅에 있어야 한다(`G-hosting` 에서 정한 값을 그대로 쓴다). 없으면 만료 정리가 안 돈다.
- 테스트와 실결제: 연동 모드는 채널마다, 웹훅은 모드마다 따로다. 테스트 채널로 먼저 통과시킨 뒤 실연동 채널의 채널 키와 실연동 모드의 웹훅 주소·시크릿으로 바꿔 다시 배포한다. API Secret 이 모드별로 따로인지는 [확인 안 됨]이고, 테스트 채널이 실제 돈을 청구하지 않는다는 PortOne 쪽 명시 문장도 [확인 안 됨]이다 — 첫 시험은 소액으로 한다.
- 결제 흐름: 서버가 주문을 만들고 금액을 정한다(가격의 정본은 서버 상품표, 클라이언트 금액은 읽지 않는다) → 브라우저가 `requestPayment`(통화 `KRW`) → 모바일은 `redirectUrl` 로 돌아온다 → 서버가 `paymentId` 로 PortOne 을 **다시 조회**한다.
- 검증 위치(`packages/commerce` `confirmPayment`): 상태가 `PAID` 여야 하고 `amount.total` 과 통화(KRW)가 주문 행과 같아야 한다. 아직 대기면 `payment_pending`(재시도 가능), 금액·통화가 다르면 그 결제를 환불하고 `payment_amount_mismatch`. 리디렉션 반환과 웹훅이 같은 `confirmPayment` 를 부르고 주문 행의 조건부 갱신을 이긴 쪽만 확정·메일·계측(`purchase`)을 한다 — 몇 번 불러도 한 번이다. PortOne 문서도 브라우저 완료와 웹훅 도착 순서는 보장하지 않는다고 하므로 두 길 모두 재조회로 확정한다.
- 웹훅(`handleWebhook`): 원문 본문(`request.text()`)으로 서명 확인(Standard Webhooks, 시간 허용 5분) → `webhook-id` 중복 제거 → `Transaction.Paid` 만 주문을 움직이고 `paymentId` 로 재조회한다. 응답: 400 서명·헤더·본문 오류 / 200 처리·중복·쓰지 않는 이벤트 / 503 아직 결제 완료로 안 보임(기록을 되돌려 PortOne 이 다시 보낸다) / 404 상점 꺼짐·mock. 실패·취소 이벤트는 받아 두기만 한다. PortOne 문서에 따르면 연결·읽기 제한 시간은 각각 30초이고, 실패한 웹훅은 최대 5번까지 다시 보내며 간격은 지수로 늘어난다(문서 표기 0 → 1 → 4 → 16 → 64 → 256분, 무작위 지연 포함).
- Cron 만료: 결제 대기 주문은 30분(`holdMinutes`) 뒤 만료. `vercel.json` 의 `/api/cron/commerce`, `*/10 * * * *`(한 번에 최대 100건). 만료 대상이 공급자에서 이미 `PAID` 면 취소하지 않고 확정한다(웹훅을 놓친 경우). 아니면 취소하고 재고를 돌려준다.
- 취소·환불: 결제 전 주문은 취소+재고 반환. 결제 후(`paid`·`preparing`)는 PortOne 환불이 성공해야 `refunded` 가 된다 — 실패하면 상태 그대로 `refund_failed`(재시도 가능). 준비가 시작된 주문은 환불해도 재고를 되돌리지 않는다. 취소된 주문에 늦게 들어온 결제는 전액 환불한다. SDK 0.19.0 은 `Idempotency-Key` 를 보내지 않아 멱등은 우리 쪽 상태 전이가 지킨다.
- 확인: ① 테스트 채널로 소액 결제 1건 → 주문 `paid` + 확인 메일 ② 그 주문 취소/환불 → `refunded` + 재고 복구 ③ 웹훅 설정 쪽의 시험 알림으로 200 응답을 확인한다. 실제 결제 알림의 발송 내역 화면이 있는지는 [확인 안 됨] ④ 결제창만 열고 닫아 30분 뒤 Cron 이 정리하는지.
- 막힘: ① 상점 액션이 `provider_unavailable` → PortOne 값 넷 중 빠진 이름이 있다(`NEXT_PUBLIC_*` 는 바꾼 뒤 재배포). ② 웹훅이 400 → 시크릿이 다른 모드의 것이거나 시계가 5분 넘게 어긋났다. ③ 결제는 됐는데 주문이 대기로 남음 → 웹훅 주소 미등록, 기다리면 재조회·Cron 이 확정한다. 증상 표 전체는 이 파일의 4절이다.
- 법적 고지: 총액 표시·청약철회 문구 등 PortOne 쪽 문구는 [확인 안 됨] — 사이트 법정 쪽(`/terms`·`/refund`)은 대표 검토 몫.
- 출처: PortOne 개발자 문서(developers.portone.io) — 결제 연동 준비하기, 연동 정보(채널·식별코드·웹훅 관리), 웹훅 연동하기, 퀵 가이드, PortOne REST API V2. 저장소: `.env.example`, `packages/payments-kr`, `packages/commerce`.

## G-commerce — 상점 (장바구니 · 주문 · 재고)

- 왜 필요한가: 사이트가 상품을 직접 팔려면 상품표·배송비·재고를 정하고 결제(`G-payments-kr`)를 이어야 한다. 이 모듈이 장바구니·주문·재고 확보·주문 확인 메일을 맡는다.
- 준비물: 결제가 연결된 상태(`G-payments-kr`), 데이터베이스(`G-db`), 메일(`G-email`). 팔 상품의 이름·가격·재고 제한·배송비.
- 등록: 없음. 외부 서비스는 위 `G-payments-kr` 가 전부다.
- 설정: 상품과 배송비를 코드 설정 `lib/launch/catalog.ts` 의 `PRODUCTS`·`SHIPPING` 에 적는다. 가격의 정본이 여기다. 재고 제한도 여기서 정한다(`stock: null` 은 무제한). 주문이 진행되는 동안에는 가격을 바꾸지 않는다.
- 설정: 주문 확인 메일은 메일 장(`G-email`)의 설정으로 나간다. 보내는 주소는 `EMAIL_FROM` 이다. 메일이 안 가도 주문은 확정된다.
- 주문 한 바퀴: 담기 → 장바구니 → 배송지 → `placeOrder`(재고 30분 확보, 결제 세션 생성) → 결제 → `confirmPayment` → 주문 내역. `placeOrder`·`cancelOrder` 는 사람 확인(`confirmed: true`) 없이는 상태를 바꾸지 않는다(`confirmation_required`, 오류 아님). 한 사람이 동시에 가질 수 있는 결제 대기 주문 수에 한도가 있다(`too_many_pending`).
- 쓰기 액션은 요청 제한을 먼저 지나고, 대리 로그인 중에는 읽기만 된다.
- 화면과 처리: 공개 상품 목록 쪽(`/products`, 카드는 `/cart?add=<상품 id>` 로 간다), 장바구니·결제·내 주문 화면, 관리 화면의 주문·재고 구획(`G-admin`)이 있다. 계정을 지우면 결제된 주문은 소비자를 알아볼 키가 없는 가명 결제 기록으로 60개월 남고, 끝난 주문의 배송지는 바로 비워진다. 내 정보 내려받기에는 본인 주문이 들어간다. 아직 없는 것: 품절 표지(웹 팩토리 블록에 없다), 진짜 PortOne 결제창 한 바퀴(키가 있는 환경에서만 확인할 수 있다).
- 확인: `commerceEnabled()` 가 true(live 는 PortOne 값 넷, mock 은 항상) → 서버 액션 `catalog` 가 상품을 돌려줌 → 소액 시험 결제 → 주문 `paid` → 메일.
- 막힘: ① 만료·취소했는데 재고가 안 돌아옴 → Cron 이 안 돈다(`CRON_SECRET` 없음). 준비 중 이후의 환불은 재고를 되돌리지 않는 것이 의도다. ② `too_many_pending` → 결제 대기 주문이 한도에 닿았다. 30분 뒤 만료되거나 취소하면 풀린다. ③ `confirmation_required` → 오류가 아니라 사람 확인 대기다.
- 출처: 이 저장소의 `.env.example`, `packages/commerce`, `docs/qa/p3a-commerce.md`. 외부 서비스 사실은 `G-payments-kr` 에 있다.

## 3. 더 싼 방법이 있는지 (확인용 자리)

- 국내 결제에는 PortOne 밖의 방법도 있다: 다른 국내 PG·결제 중개사, 링크로 받는 결제, 계좌이체만 받기 등. 수수료·요금은 이 글에 적지 않는다(바뀌고, 확인하지 않았다).
- 플러그인은 「더 싼 방법 없나요?」 질문을 받으면 이 모듈의 결제 자리(`PaymentGateway`)에 무엇이 들어갈 수 있는지와 확인할 항목만 안내한다. 비교 수치는 사업자가 각 공급자 공식 요금 안내에서 직접 확인한다.

## 4. 막힘 (증상 → 원인 → 처리)

| 증상 | 원인 | 처리 |
|---|---|---|
| 상점 액션이 `provider_unavailable`(`retryable: false`), 상점 안내만 보임 | live 에서 PortOne 값 넷 중 하나 이상 없음(또는 공백) | `npm run env:check` 와 호스팅 env 에서 넷의 이름을 확인(`NEXT_PUBLIC_*` 는 변경 뒤 재배포). 꺼진 까닭은 이름만 나온다 |
| 웹훅이 400 | `PORTONE_WEBHOOK_SECRET` 틀림(모드가 다른 시크릿 포함)·본문을 파싱한 뒤 검증·시간이 5분 넘게 어긋남 | 시크릿을 해당 모드 것으로 교체. 로그의 reason(`signature_mismatch`·`missing_headers`·`timestamp_*`) 확인 |
| 웹훅이 500 | 시크릿 형식 오류(`whsec_…` 아님) 또는 DB 오류 | 설정 오류면 시크릿 형식을 확인. DB 오류는 기록이 되돌려지고 PortOne 이 재전송해 처리된다 |
| 웹훅이 404 | 상점 꺼짐 또는 mock | 위 첫 줄과 같다 / `LF_MODE=live` 확인 |
| 결제는 됐는데 `payment_amount_mismatch` | 서버 주문 금액·통화가 PortOne 결제와 다름(주문 뒤 상품표 가격 변경, 통화 불일치 등) | 자동 환불이 시도된다(실패하면 `onError` 로 운영 알림 — PortOne 에서 직접 취소). 주문 중에 가격을 바꾸지 않는다 |
| 주문이 `pending_payment` 로 남음 | 웹훅 지연·미등록, 모바일 리디렉션 복귀 실패 | `confirmPayment` 가 재조회하므로 기다리면 확정된다(503 은 재시도 신호). 10분 Cron 이 만료분을 재조회해 확정한다. 웹훅 주소 등록 여부·`CRON_SECRET` 확인 |
| 만료·취소했는데 재고가 안 돌아옴 | Cron 이 안 돎(`CRON_SECRET` 없음 → 401, 배포에 `vercel.json` crons 없음) 또는 준비 중 이후의 환불(재고를 되돌리지 않는다) | Cron 설정을 확인. 준비 중 이후 환불은 의도된 동작이라 재고를 수동으로 맞춘다 |
| 환불이 `refund_failed` | PortOne 취소 거절(이미 취소·취소 가능 금액 초과 등) 또는 API Secret 오류 | 상태는 그대로 — 원인 확인 뒤 다시 취소한다. 정확한 오류 코드 해석은 PortOne 응답 기준(세부는 [확인 안 됨]) |
| 결제창이 안 열림 | `storeId`·`channelKey` 오류, 채널 미승인, 이미 결제된 `paymentId` 재사용 | 두 공개 값과 채널 상태 확인. `paymentId` 는 서버가 새로 채번한다 |

---

# Expert runbook — shop and Korean payments (PortOne V2)

*Source of content for the plugin runbook feature. Expert version: use as is. Beginner version: expand each item. Console button names, URLs and paths are deliberately not recorded (they change per version). Facts baseline: `@portone/browser-sdk` 0.1.13, `@portone/server-sdk` 0.19.0. Checked 2026-10-22; re-check after 90 days.*

Never put a key, secret or number in chat, the repository or logs. Use `vercel env add <NAME>` (stdin) or the host dashboard.

## 0. mock vs live

With `LF_MODE=mock` (default) mock payments are used even if keys exist. Real money moves only in live with all four PortOne values set.

| Area | mock | live, any value missing |
|---|---|---|
| Payment gateway | Self-built mock (no keys, no outside call, memory only so pending payments vanish on restart). PortOne has no keyless sandbox, so previews use this mock | **Only the shop turns off.** `commerceEnabled()` is false |
| Webhook `/api/webhooks/portone` | 404 (not accepted) | 404 (not accepted without the secret) |
| Shop server actions | Work (mock payment `payWithMock`) | `provider_unavailable`, `retryable: false`; the site and other features stay on |
| Cron `/api/cron/commerce` | Expiry cleanup of a running shop | `{ skipped: "commerce_disabled" }` — not an error |

## 1. Environment variables

Source of truth: `.env.example`. All four are optional — the site starts without them and only the shop stays off.

| Name | Secret | Feature | If missing |
|---|---|---|---|
| `NEXT_PUBLIC_PORTONE_STORE_ID` | no (public in the browser) | Payment window | Shop off |
| `NEXT_PUBLIC_PORTONE_CHANNEL_KEY` | no (public in the browser) | Payment window (channel key) | Shop off |
| `PORTONE_API_SECRET` | **yes** | Server re-fetch, cancel/refund | Shop off |
| `PORTONE_WEBHOOK_SECRET` (`whsec_…`) | **yes** | Webhook signature check | Shop off |
| `CRON_SECRET` | **yes** | Auth for `/api/cron/commerce` (reuse the existing value) | Cron 401 — expiry cleanup does not run |
| `EMAIL_FROM` (+ mail item setup) | no | Order confirmation mail | Mail only is skipped (logged via `onError`; the order still confirms) |

`NEXT_PUBLIC_*` values are baked in at build time — redeploy after changing them. No value is printed anywhere; the reason for being off names the variables only. Channels and webhooks are separate per test/live mode (official); whether the API Secret differs between them is [확인 안 됨].

## G-payments-kr — Korean payments (PortOne V2)

- Why: to take Korean card and easy-pay money, the shop needs a PortOne account, a payment channel, a server secret and a webhook secret. If any of the four values is missing, only the shop turns off and the rest of the site stays on.
- What you need: the Korean business chapter `G-biz-kr` (business registration, mail-order report, PG contract) finished first. The deployed site address (used for the webhook URL and the return URL), and the database (`G-db`) and hosting (`G-hosting`) chapters finished. An account that can set host environment variables.
- Register 1 — sign up at PortOne. Per its guide, signing up is free with no separate contract, and you must confirm the verification email before you can log in. To take real payments, submit the electronic-payment application in the console: enter your business details and apply for the PG and payment methods you will use. The number of days this takes is [확인 안 됨] (for the PG's reply and the card company's review, see the PG contract item in `G-biz-kr`). You can test with a test channel even before applying.
- Register 2 — find your store id. A main store is created automatically when you sign up, and each store has its own value → `NEXT_PUBLIC_PORTONE_STORE_ID`. It is a public value used to open the payment window.
- Register 3 — create a payment channel. In the console's channel management choose the integration mode (test or live), the payment company (PG) and the payment module. For a test channel pick a shared test merchant id or enter a test id you were given. For a live channel enter the merchant id and extra details you received after signing with the PG. The channel key you get when the channel is created → `NEXT_PUBLIC_PORTONE_CHANNEL_KEY` (a public value). Easy-pay (KakaoPay, NaverPay, TossPay) needs separate per-PG/per-provider contracts and review.
- Register 4 — issue a V2 API Secret in the console under the identification codes / API keys area. Only owner and admin accounts can issue or delete it, and the value is shown only right after issuing (if you lose it, issue a new one). Use it on the server only and never expose it in the browser → `PORTONE_API_SECRET`. Put it into the host environment on the spot.
- Register 5 — register the webhook. In the console's payment-notification (webhook) management area choose the webhook version payment module V2 and a setting mode, test or live. You can keep a separate URL and webhook secret per mode. The URL is `https://<domain>/api/webhooks/portone`; the webhook secret you issue (`whsec_…`) → `PORTONE_WEBHOOK_SECRET`. After changing the URL, save it before sending a test notification (testing without saving goes to the previously saved URL).
- Config: put the four values into the host environment variables (dashboard or `vercel env add <NAME>` stdin). The two `NEXT_PUBLIC_*` values are baked into the bundle at build time, so redeploy after changing them. Never put a value in chat, the repository or logs.
- Config: for a deploy where real money moves, set `LF_MODE` to live. In mock, mock payments are used even if the PortOne values exist.
- Config: for the Cron that cleans up pending orders to run, `CRON_SECRET` must exist on the host (reuse the value set in `G-hosting`). Without it the expiry cleanup does not run.
- Test vs live: the integration mode is per channel and the webhook is per mode. Pass with a test channel first, then switch to the live channel's channel key and the live-mode webhook URL and secret and redeploy. Whether the API Secret differs between test and live is [확인 안 됨], and an explicit PortOne statement that test channels never charge was also [확인 안 됨] — make the first test a small amount.
- Flow: the server creates the order and fixes the amount (the server catalog is the source of truth; client amounts are never read) → browser `requestPayment` (currency `KRW`) → mobile returns via `redirectUrl` → the server **re-fetches** the payment from PortOne by `paymentId`.
- Where verification happens (`packages/commerce` `confirmPayment`): status must be `PAID` and `amount.total` and currency (KRW) must equal the order row. Still pending → `payment_pending` (retryable); amount/currency differs → that payment is refunded and `payment_amount_mismatch` returned. Redirect-return and webhook call the same `confirmPayment`; whoever wins the order row's conditional update does the confirm, the mail and the `purchase` event — once, however often it is called. PortOne's docs also say the order in which the browser completion and the webhook arrive is not guaranteed, so both paths confirm by re-fetching.
- Webhook (`handleWebhook`): verify the signature on the raw body (`request.text()`, Standard Webhooks, 5-minute tolerance) → dedupe by `webhook-id` → only `Transaction.Paid` moves an order, and it re-fetches by `paymentId`. Replies: 400 bad signature/headers/body · 200 handled, duplicate or unused event · 503 not yet paid at the provider (record rolled back so PortOne resends) · 404 shop off or mock. Failed/cancelled events are only recorded. Per PortOne's docs the connection and read timeouts are 30 seconds each, and a failed webhook is resent up to 5 times with intervals that grow exponentially (the docs list 0 → 1 → 4 → 16 → 64 → 256 minutes, with random jitter).
- Cron expiry: pending orders expire after 30 minutes (`holdMinutes`). `/api/cron/commerce`, `*/10 * * * *` in `vercel.json` (up to 100 per run). If the provider already shows `PAID` for an expiring order it is confirmed, not cancelled (missed webhook); otherwise it is cancelled and stock is returned.
- Cancel/refund: a pre-payment order is cancelled and stock returned. After payment (`paid`, `preparing`) the PortOne refund must succeed before the order becomes `refunded` — on failure the status stays and `refund_failed` (retryable) is returned. Orders already in preparation are refunded without returning stock. A payment that arrives for an already-cancelled order is refunded in full. SDK 0.19.0 sends no `Idempotency-Key`, so idempotency is held by our own state transitions.
- Check: ① one small test payment on a test channel → order `paid` + confirmation mail ② cancel/refund that order → `refunded` + stock restored ③ send a test notification from the webhook settings and confirm a 200 reply. Whether the console has a delivery log screen for real payment notifications is [확인 안 됨] ④ open the payment window and close it; confirm the Cron cleans it up after 30 minutes.
- Stuck: ① Shop actions return `provider_unavailable` → one of the four PortOne values is missing (redeploy after changing `NEXT_PUBLIC_*`). ② Webhook returns 400 → the secret is from the other mode, or the clock is off by more than 5 minutes. ③ Paid but the order stays pending → the webhook URL is not registered; waiting lets the re-fetch and the Cron confirm it. The full symptom table is section 4 of this file.
- Legal wording: PortOne-side wording on total-price display and withdrawal is [확인 안 됨] — the site's legal pages (`/terms`, `/refund`) are the owner's review.
- Sources: PortOne developer documents (developers.portone.io) — preparing a payment integration, integration info (channels, identification codes, webhook management), webhook integration, quick guide, PortOne REST API V2. Repository: `.env.example`, `packages/payments-kr`, `packages/commerce`.

## G-commerce — shop (cart, orders, stock)

- Why: to sell goods directly, the site needs a product list, shipping and stock limits, and a payment connection (`G-payments-kr`). This module handles the cart, orders, stock holds and the order confirmation mail.
- What you need: payment connected (`G-payments-kr`), the database (`G-db`) and email (`G-email`) chapters finished. The name, price, stock limit and shipping for each product you sell.
- Register: nothing. The external service is covered entirely by `G-payments-kr` above.
- Config: write the products and shipping in the code configuration `PRODUCTS` and `SHIPPING` in `lib/launch/catalog.ts`. This is the source of truth for prices. Stock limits are set here too (`stock: null` means unlimited). Do not change prices while orders are in flight.
- Config: the order confirmation mail goes out through the email chapter's setup (`G-email`). The sender address is `EMAIL_FROM`. If the mail fails the order is still confirmed.
- Order loop: add → cart → address → `placeOrder` (30-minute stock hold, payment session) → pay → `confirmPayment` → order list. `placeOrder` and `cancelOrder` change nothing without a human confirmation (`confirmed: true`; `confirmation_required`, not an error). A user can hold only a limited number of pending orders (`too_many_pending`).
- Write actions pass the rate limit first; during impersonation only reads work.
- Screens and handling: a public product list page (`/products`; its cards go to `/cart?add=<product id>`), the cart, checkout and my-orders screens, and the orders and stock sections of the admin screens (`G-admin`) exist. When an account is deleted, paid orders stay for 60 months as a pseudonymous payment record with no key to identify the buyer, and the shipping address of finished orders is cleared at once. Data export includes the user's own orders. Not there yet: a sold-out marker (the web-factory block has none) and a full loop through the real PortOne window (only checkable where keys exist).
- Check: `commerceEnabled()` true (live: the four PortOne values; mock: always) → server action `catalog` returns products → small test payment → order `paid` → mail.
- Stuck: ① Stock not released after expiry/cancel → the Cron is not running (no `CRON_SECRET`). Not returning stock for a refund after preparation began is by design. ② `too_many_pending` → pending orders reached the limit; they free up when they expire after 30 minutes or are cancelled. ③ `confirmation_required` → not an error; it is waiting for a human confirmation.
- Sources: this repository's `.env.example`, `packages/commerce` and `docs/qa/p3a-commerce.md`. External-service facts are in `G-payments-kr`.

## 3. Cheaper options (placeholder for the check)

- Korean payments have options beyond PortOne: other Korean PGs and aggregators, link-based payment, bank transfer only. This document records no fees or prices (they change and were not checked).
- When asked "is there a cheaper way?", the plugin only explains what can sit in this module's payment slot (`PaymentGateway`) and what to check. Comparisons come from each provider's official pricing, checked by the owner.

## 4. Stuck (symptom → cause → fix)

| Symptom | Cause | Fix |
|---|---|---|
| Shop actions return `provider_unavailable` (`retryable: false`), only a shop notice shows | In live, one or more of the four PortOne values is missing (or blank) | Check the four names with `npm run env:check` and the host env (redeploy after `NEXT_PUBLIC_*` changes). The reason names variables only |
| Webhook returns 400 | Wrong `PORTONE_WEBHOOK_SECRET` (including a secret of the other mode), body parsed before verifying, clock off by more than 5 minutes | Use the secret of the matching mode. Read the logged reason (`signature_mismatch`, `missing_headers`, `timestamp_*`) |
| Webhook returns 500 | Malformed secret (not `whsec_…`) or a DB error | Fix the secret format for config errors. On a DB error the record is rolled back and PortOne resends |
| Webhook returns 404 | Shop off or mock | As the first row / confirm `LF_MODE=live` |
| Paid but `payment_amount_mismatch` | Server order amount/currency differs from the PortOne payment (catalog price changed after the order, currency mismatch) | An automatic refund is attempted (on failure `onError` raises an ops alert — cancel at PortOne by hand). Do not change prices while orders are in flight |
| Order stays `pending_payment` | Webhook late or unregistered, mobile redirect did not return | `confirmPayment` re-fetches, so it confirms when you wait (503 is the retry signal); the 10-minute Cron re-checks expired ones. Check webhook URL registration and `CRON_SECRET` |
| Stock not released after expiry/cancel | Cron not running (no `CRON_SECRET` → 401, no crons in the deployed `vercel.json`) or a refund after preparation began (stock is not returned) | Fix the Cron setup. The after-preparation case is by design — adjust stock by hand |
| Refund returns `refund_failed` | PortOne rejected the cancel (already cancelled, over the cancellable amount, etc.) or a wrong API Secret | Status is unchanged — fix the cause and cancel again. Mapping of PortOne error codes: [확인 안 됨] |
| Payment window does not open | Wrong `storeId`/`channelKey`, channel not approved, reused `paymentId` | Check the two public values and the channel state. The server mints a fresh `paymentId` |
