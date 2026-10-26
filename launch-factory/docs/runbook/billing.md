# 운영 런북(전문가용) — 카드 결제 · 정기구독 (Paddle)

*Expert runbook: card payments and subscriptions (Paddle). English follows the Korean part.*

- 대상: 카드 결제·정기구독(성과 `payments`)을 쓰기로 정한 사이트 운영자. 부품은 `billing-paddle`(레지스트리 `feature-billing-paddle`). 한국 결제(PortOne 등)는 다른 부품(`payments-kr`)이라 이 장에서 다루지 않는다.
- 용도: 플러그인 런북 기능의 **내용 원천**이다. 전문가용은 이 글을 그대로 쓰고, 초보자용은 이 글의 항목을 풀어 쓴다. 화면 이름·메뉴 위치는 깊이 적지 않는다(문서마다 표기가 다르고 버전마다 바뀐다).
- 값(키·비밀·토큰)은 채팅·저장소·로그에 쓰지 않는다. 호스팅 대시보드나 `vercel env add <이름>` 표준 입력에 직접 넣는다.

## G-billing — 카드 결제 · 정기구독 (Paddle)

- 왜 필요한가: 사이트가 요금제를 팔고 구독 상태를 받으려면 Paddle 계정, 가격, API 키, 알림(웹훅) 비밀이 있어야 한다. 이 중 어느 하나라도 없으면 결제가 열리지 않는다.
- 준비물: 이메일(계정 가입·확인), 사이트가 올라간 호스팅(알림 주소), 메일 장(`G-email`)과 데이터베이스 장(`G-db`)을 먼저 끝낸 상태. 실결제 전에는 사업자·본인 정보와 약관·개인정보처리방침·환불 정책 쪽이 공개된 사이트.
- 등록 1 — Paddle **샌드박스** 계정을 만들고 이메일을 확인한다. 샌드박스와 실결제 계정은 서로 다른 계정이고 API 키·클라이언트 토큰·알림 대상·상품·가격·고객이 서로 공유되지 않는다. 실결제 계정이 있어도 샌드박스 계정은 따로 만든다. 샌드박스는 인증 없이 바로 시험 결제를 받는다.
- 등록 2 — 샌드박스 대시보드에서 상품과 가격을 만든다(상품 하나에 가격을 붙인다. 정기구독이면 가격에 결제 주기를 두고, 체험이 있는 요금제는 체험 기간이 있는 가격을 따로 만든다). 만든 가격 id(`pri_` 로 시작)를 설정에 적는다.
- 등록 3 — 샌드박스에서 API 키를 만든다. 대시보드의 개발자 도구 쪽 인증 메뉴에서 새 API 키를 만들고, 필요한 권한만 고르고, 만료일을 정한다. 키는 만들 때 한 번만 보인다 → `PADDLE_API_KEY`. 키는 만든 뒤 기본 90일이 지나면 만료되고(Paddle 문서: 최대 1년까지 정할 수 있다) 만료되면 결제 호출이 실패하니, 만료 전에 새 키를 만들어 호스팅 환경 변수를 바꾸고 다시 배포한다.
- 등록 4 — 샌드박스에서 알림 대상(notification destination)을 만든다. 유형은 URL, 주소는 `https://<도메인>/api/webhooks/paddle`(저장소가 실제로 받는 경로). 받을 이벤트는 구독 이벤트(`subscription.*`)와 거래 이벤트(`transaction.completed`·`transaction.payment_failed`·`transaction.past_due`)다. 만든 뒤 그 알림 대상의 비밀 키를 복사한다 → `PADDLE_WEBHOOK_SECRET`. 알림 대상을 다시 만들면 비밀 키가 새로 나오니 호스팅 값도 바꾼다.
- 등록 5 — 샌드박스에서 기본 결제 링크(default payment link)를 정한다. 샌드박스는 도메인 승인이 필요 없다. Paddle 문서는 거래를 만들기 전에 기본 결제 링크를 정하라고 하고, 이 저장소의 어댑터도 이 링크를 요구한다.
- 등록 6 — 오버레이 결제를 쓰면 클라이언트 토큰을 만든다(같은 인증 메뉴). 샌드박스 토큰은 `test_` 로, 실결제 토큰은 `live_` 로 시작한다 → `PADDLE_CLIENT_TOKEN`(공개 값, API 키와 다르다). 비워 두면 결제는 Paddle 결제 링크로 이동한다.
- 등록 7 — 실결제 전환(서비스를 열 때만): ① 실결제 계정을 따로 만든다. ② 상품·가격·API 키·클라이언트 토큰·알림 대상을 실결제 쪽에 **다시** 만든다(샌드박스 것은 옮겨지지 않는다). ③ 웹사이트(도메인) 승인을 신청한다 — 실결제 결제창은 승인된 도메인에서만 열린다. ④ 도메인 승인 뒤 실결제 기본 결제 링크를 정한다(호스트가 승인된 도메인과 정확히 같거나 그 `www.` 판이어야 하고, `app.` 같은 하위 도메인은 따로 승인받는다). ⑤ 계정 인증(KYC/KYB)을 계정 관리자가 마친다 — 개인 정보와 사업 정보, 사이트 주소, 판매할 것의 설명이 필요하고 서류를 더 요구받을 수 있다. ⑥ 정산(payout) 정보를 넣는다.
  - 기다림: 인증은 보통 하루 안에 끝나지만 지역과 상품에 따라 며칠이 걸릴 수 있다고 Paddle 문서가 쓴다. 도메인 승인 날수는 문서에 없다. 그래서 인증을 샌드박스 연동보다 먼저 시작하고, 도메인 승인은 인증과 나란히 신청한다. 인증의 자동 심사는 승인된 도메인이 하나 이상 있어야 진행된다.
  - 사이트가 갖춰야 하는 것(Paddle 인증 준비 항목): 약관·개인정보처리방침·환불 정책 쪽이 공개돼 있고, 사이트의 가격이 Paddle 상품 가격과 맞고, 홈에서 닿는 연락처(이메일 또는 문의 폼)가 있다.
- 설정: 호스팅 환경 변수(대시보드 또는 `vercel env add <이름>` 표준 입력)에 `LF_MODE`(live 배포는 live), `PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET`, 오버레이를 쓰면 `PADDLE_CLIENT_TOKEN`, `NEXT_PUBLIC_APP_URL`(배포 주소), `CRON_SECRET`(결제 Cron 용, 없으면 Cron 경로가 401)을 넣는다. 데이터베이스 값(`DATABASE_URL`)은 `G-db`, 메일 값(`RESEND_API_KEY`·`EMAIL_FROM`)은 `G-email` 에서 넣은 것을 쓴다. 가입·결제 폼의 봇 방어 값 `TURNSTILE_SECRET_KEY`·`TURNSTILE_SITE_KEY` 는 이미 넣은 값을 재사용한다.
- 설정: `lib/launch/paddle-plans.ts` 에 요금제와 Paddle 가격 id 를 적는다. 비어 있으면 결제가 열리지 않는다(`unknown_plan`). 체험이 있는 요금제는 체험 없는 가격 id 와 체험 있는 가격 id 를 둘 다 적는다.
- 설정: `vercel.json` 에 `/api/cron/billing` Cron 을 더한다(저장소 안내의 스케줄은 매시 정각).
- 설정: 실결제 스위치 `LF_PADDLE_LIVE` 는 샌드박스에서 비워 둔다. 값을 1 로 넣어야 실결제(production)로 간다 — 실결제 계정·키·알림 대상이 모두 준비된 뒤 사이트 주인만 넣는다.
- 설정: 실결제에서 Paddle 의 결제 복구 메일(Retain)을 켰다면 `LF_PAYMENT_FAILED_EMAIL` 을 off 로 둔다(결제 실패 안내가 두 번 나가지 않게). EU 결제 국가에 팔지 정하는 값은 `LF_EU_SALES`(기본 열림, off 로 닫는다).
- 설정: 결제 시작은 언제나 청약철회 제한 동의 체크를 요구한다. 끄는 설정은 없다.
- 확인: 샌드박스에서 가입 → 요금제 선택 → Paddle 시험 카드(공식 문서의 시험 카드)로 결제 → Paddle 대시보드의 알림 기록에 성공(2xx)이 찍힘 → 사이트의 결제 관리 화면에 구독 상태가 보임. 실카드는 쓰지 않는다. 실결제 전환 뒤에는 Paddle 문서의 전체 점검표(도메인 승인·인증 완료)를 지난 뒤 100% 할인 거래로 한 번 시험한다.
- 막힘: 서명 오류(401) → 알림 대상을 다시 만들어 비밀 키가 바뀐 경우가 많다, 호스팅의 `PADDLE_WEBHOOK_SECRET` 을 새 값으로. 샌드박스 키로 실결제 쪽을 부르면 거절된다(샌드박스·실결제 키를 섞지 않는다). 알림이 안 들어옴 → 서버가 5초 안에 2xx 를 줘야 하고, 아니면 Paddle 이 다시 보낸다(Paddle 문서: 샌드박스는 약 2분 안에 3번, 실결제는 약 2일 동안 최대 60번). 배포 미리보기에 호스팅 보호 인증이 걸려 있으면 Paddle 알림도 막힌다. 실결제 결제창이 안 열림 → 도메인 승인 전이거나 기본 결제 링크의 호스트가 승인된 도메인과 다르다.
- 출처: Paddle 개발자 문서(developer.paddle.com) — Sandbox 안내, 출시 점검표(Set up checklist), Authentication(API 키·클라이언트 토큰), Notification destinations·Respond to webhooks·Signature verification, Default payment link, 상품·가격 만들기, Verifications. 저장소: `.env.example`, `features/outcomes.yaml`, `registry/feature-billing-paddle` 의 설치 안내, `packages/billing-paddle`.

---

# Expert runbook — card payments and subscriptions (Paddle)

*Source of content for the plugin runbook feature. Expert version: use as is. Beginner version: expand each item. Menu names and screen locations are not recorded in depth (docs use different names, and they change per version).*

- For: sites that chose card payments and subscriptions (outcome `payments`). The part is `billing-paddle` (registry `feature-billing-paddle`). Korean payments (PortOne and others) are a different part (`payments-kr`) and are not covered here.
- Never put a key, secret or token in chat, the repository or logs. Put it in the host dashboard or `vercel env add <NAME>` (stdin).

## G-billing

- Why: to sell plans and receive subscription state, the site needs a Paddle account, prices, an API key and a webhook secret. If any is missing, checkout does not open.
- What you need: an email address, a deployed host (for the notification URL), and the email chapter (`G-email`) and database chapter (`G-db`) finished first. Before real payments, owner/business details and a public site with terms, privacy and refund pages.
- Register 1 — create a Paddle **sandbox** account and confirm the email. Sandbox and live are separate accounts; API keys, client-side tokens, notification destinations, products, prices and customers are not shared. Create the sandbox account even if you already have a live one. Sandbox takes test payments with no verification.
- Register 2 — in the sandbox dashboard create a product and its prices (one product with prices; for subscriptions give the price a billing cycle; a plan with a trial needs a separate price that has a trial period). Put the price ids (they start with `pri_`) into the config.
- Register 3 — create an API key in the sandbox. In the developer tools area, open the authentication menu, create a new API key, choose only the permissions you need and set an expiry. The key is shown only once → `PADDLE_API_KEY`. A key expires 90 days after it is created by default (Paddle docs: up to 1 year can be set), and billing calls fail once it has expired — before that, create a new key, replace the host environment variable and deploy again.
- Register 4 — create a notification destination in the sandbox. Type URL, address `https://<domain>/api/webhooks/paddle` (the path this repository serves). Events: subscription events (`subscription.*`) and the transaction events `transaction.completed`, `transaction.payment_failed`, `transaction.past_due`. Copy the destination's secret key → `PADDLE_WEBHOOK_SECRET`. Recreating a destination gives a new secret key, so update the host value too.
- Register 5 — set the default payment link in the sandbox. Sandbox needs no domain approval. Paddle's docs say to set it before creating transactions, and this repository's adapter also requires this link.
- Register 6 — if you use the overlay checkout, create a client-side token (same authentication menu). Sandbox tokens start with `test_`, live tokens with `live_` → `PADDLE_CLIENT_TOKEN` (a public value, not the API key). Left empty, checkout goes to the Paddle payment link.
- Register 7 — going live (only when you open for real): ① create a separate live account. ② Recreate products, prices, API key, client-side token and notification destination in live (sandbox ones do not carry over). ③ Submit your website (domain) for approval — the live checkout opens only on approved domains. ④ After approval, set the live default payment link (the host must equal an approved domain exactly or be its `www.` version; a subdomain such as `app.` needs its own approval). ⑤ An account administrator completes account verification (KYC/KYB): personal and business details, website address, a description of what you sell; more documents may be requested. ⑥ Add payout details.
  - Waiting: Paddle's docs say verification usually finishes within a day but can take several days depending on location and product. The docs give no number of days for domain approval. So start verification before the sandbox integration, and submit the domain in parallel. Automated review of verification waits until at least one domain is approved.
  - What the site needs (Paddle's verification prep): public terms, privacy and refund pages, prices that match the Paddle catalog, and a contact email or form reachable from the homepage.
- Config: host environment variables (dashboard or `vercel env add <NAME>` stdin): `LF_MODE` (live for a live deploy), `PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET`, `PADDLE_CLIENT_TOKEN` if you use the overlay, `NEXT_PUBLIC_APP_URL` (the deployed address), `CRON_SECRET` (for the billing Cron; without it the Cron route returns 401). Reuse the database value (`DATABASE_URL`) from `G-db`, the mail values (`RESEND_API_KEY`, `EMAIL_FROM`) from `G-email`, and the already set bot-protection values `TURNSTILE_SECRET_KEY` and `TURNSTILE_SITE_KEY`.
- Config: write the plans and Paddle price ids in `lib/launch/paddle-plans.ts`. If empty, checkout does not open (`unknown_plan`). A plan with a trial needs both the price id without trial and the price id with trial.
- Config: add the `/api/cron/billing` Cron to `vercel.json` (the repository note uses an hourly schedule).
- Config: keep the live switch `LF_PADDLE_LIVE` empty in sandbox. Only the value 1 goes to real payments — the site owner sets it after the live account, keys and destination are ready.
- Config: if you turned on Paddle's payment-recovery emails (Retain) in live, set `LF_PAYMENT_FAILED_EMAIL` to off (so the payment-failed notice is not sent twice). `LF_EU_SALES` decides whether you sell to EU payment countries (default open, off closes it).
- Config: starting checkout always requires the withdrawal-limit consent checkbox. There is no setting to turn it off.
- Check: in sandbox sign up → pick a plan → pay with a Paddle test card (from the official docs) → the Paddle dashboard's notification log shows success (2xx) → the site's billing screen shows the subscription state. Never use a real card. After going live, pass Paddle's full checklist (domain approved, verification complete), then try one live purchase with a 100% discount.
- Stuck: signature error (401) → often the destination was recreated and the secret changed; set the new `PADDLE_WEBHOOK_SECRET` on the host. A sandbox key used against live is rejected (do not mix sandbox and live keys). No notifications → your server must return 2xx within 5 seconds, otherwise Paddle retries (Paddle docs: sandbox 3 attempts within about 2 minutes, live up to 60 attempts over about 2 days). Host protection on a deploy preview also blocks Paddle's notifications. Live checkout does not open → the domain is not approved yet, or the default payment link host differs from the approved domain.
- Sources: Paddle developer docs (developer.paddle.com) — Sandbox, Set up checklist, Authentication (API keys, client-side tokens), Notification destinations, Respond to webhooks, Signature verification, Default payment link, creating products and prices, Verifications. This repository: `.env.example`, `features/outcomes.yaml`, the install notes of `registry/feature-billing-paddle`, `packages/billing-paddle`.
