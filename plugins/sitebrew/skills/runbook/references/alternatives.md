생성 파일 — 손으로 고치지 않는다 / Generated file - do not edit by hand

# 대안 · Alternatives

역할 하나마다 런북에 있는 서비스 말고 쓸 수 있는 서비스예요. 사실과 바꾸는 비용만 말하고, 런북 장은 바꾸지 않아요.
For each role, services other than the one in the runbook. State the fact and the cost of switching only; do not change the runbook chapters.

## 목차 · Contents

- 지원 칸 읽는 법 · How to read the support field
- analytics
- auth
- billing
- database
- domain
- email
- hosting
- newsletter
- notify-kr
- payments-kr
- push
- search
- storage
- 이 표 밖의 답 · Roles with no row here

### 지원 칸 읽는 법 · How to read the support field

- `builtin` — 이 키트에 들어 있어요. 아래 「이 결과를 고른 사이트」에 든 기능을 고른 사이트면 「이미 켜져 있어요」, 아니면 「기능을 다시 고르고 사이트를 다시 받으면 돼요」. / It is in this kit. If the site chose one of the results listed under "via", say it is already on; otherwise say to choose the feature again and get the site again.
- `code` — 어댑터 코드를 새로 써야 해요. 사실과 바꾸는 비용을 말하고 런북은 그대로 둬요. / New adapter code is needed. Say the fact and the cost of switching; the runbook stays as it is.
- `no` — 이 키트로는 안 돼요. 사실을 말하고 런북은 그대로 둬요. / Not possible with this kit. Say the fact; the runbook stays as it is.

태그 · tags: `free` 무료 쪽 · `cheaper` 더 싼 쪽 · `better` 더 나은 쪽 · `ko` 한국 지원 / `free` a free option · `cheaper` a cheaper option · `better` a better option · `ko` support for Korea

## analytics

지금 런북의 서비스 · In the runbook now: PostHog (G-analytics)

- **Umami** — 태그 · tags: free · 지원 · support: `code` · 확인한 날 · checked: 2026-10-22 · https://umami.is
  - 바꾸는 비용 · Switch cost: 키트에는 어댑터가 없어요. 계측 포트를 구현하는 어댑터 코드를 새로 써야 하고, 동의 전에는 아무것도 보내지 않는 동작도 직접 지켜야 해요. / The kit has no adapter for it. You have to write a new adapter that implements the analytics port, and keep the rule of sending nothing before consent yourself.
  - 설명 · Note: 클라우드에 무료 플랜이 있고, 오픈소스라 직접 설치(셀프 호스팅)해 쓰면 무료예요. 서버는 미국과 유럽에 있고 쿠키를 쓰지 않는다고 안내해요. / The cloud service has a free plan, and the open-source version is free to self-host. It says its servers are in the US and the EU and that it does not use cookies.

- **Plausible** — 태그 · tags: - · 지원 · support: `code` · 확인한 날 · checked: 2026-10-22 · https://plausible.io
  - 바꾸는 비용 · Switch cost: 키트에는 어댑터가 없어요. 계측 포트를 구현하는 어댑터 코드를 새로 써야 해요. / The kit has no adapter for it. You have to write a new adapter that implements the analytics port.
  - 설명 · Note: 무료 플랜은 안내되지 않고 무료 체험이 있어요. 유럽에서 운영하고 쿠키를 쓰지 않는다고 안내해요. 코드는 공개되어 있어 직접 설치할 수 있어요. / No free plan is listed, but there is a free trial. It says it is hosted in the EU and uses no cookies. The code is public and can be self-hosted.

## auth

지금 런북의 서비스 · In the runbook now: Better Auth (G-auth)

- **Clerk** — 태그 · tags: free · 지원 · support: `code` · 확인한 날 · checked: 2026-10-22 · https://clerk.com
  - 바꾸는 비용 · Switch cost: 이 키트의 로그인·가입 화면과 계정 표가 Better Auth 기준이라, Clerk로 바꾸려면 인증 어댑터를 새로 써야 해요. / This kit's sign-in screens and account tables are built on Better Auth, so using Clerk means writing a new auth adapter.
  - 설명 · Note: 호스팅형 서비스예요. 무료 요금제가 있다고 가격 쪽에 나와 있어요. 이 키트에는 Clerk 어댑터가 없어요. / It is a hosted service. Its pricing page lists a free plan. This kit has no Clerk adapter.

- **Auth.js** — 태그 · tags: - · 지원 · support: `code` · 확인한 날 · checked: 2026-10-22 · https://authjs.dev
  - 바꾸는 비용 · Switch cost: 이 키트의 로그인·가입 화면과 계정 표가 Better Auth 기준이라, Auth.js로 바꾸려면 인증 어댑터를 새로 써야 해요. / This kit's sign-in screens and account tables are built on Better Auth, so using Auth.js means writing a new auth adapter.
  - 설명 · Note: 직접 호스팅하는 라이브러리예요. 이 키트에는 Auth.js 어댑터가 없어요. / It is a library you host yourself. This kit has no Auth.js adapter.

## billing

지금 런북의 서비스 · In the runbook now: Paddle (G-billing)

- **Paddle** — 태그 · tags: - · 지원 · support: `builtin` · 확인한 날 · checked: 2026-10-22 · https://paddle.com
  - 이 결과를 고른 사이트 · via: 카드 결제·정기구독 / Card payments and subscriptions
  - 바꾸는 비용 · Switch cost: 이 키트의 기본이에요. 바꿀 것이 없어요. / This is the kit's default. Nothing to change.
  - 설명 · Note: 키트에 어댑터가 있고 성과 payments 에 연결돼 있어요. / The kit has the adapter and it is wired to the payments outcome.

- **Gumroad** — 태그 · tags: - · 지원 · support: `code` · 확인한 날 · checked: 2026-10-22 · https://gumroad.com
  - 바꾸는 비용 · Switch cost: 레지스트리에 대비 어댑터(feature-billing-gumroad)가 있지만 기능 표의 선택지로는 이어져 있지 않아요. 직접 조립하고, 해지·등급 변경·결제수단 변경은 Gumroad 화면에서 해야 해요. / The registry has a standby adapter (feature-billing-gumroad) but it is not wired into the feature table's choices. You assemble it yourself, and cancel, plan change and payment-method change are done in Gumroad's own screens.
  - 설명 · Note: Paddle 승인 전 대비용으로 만들어진 어댑터예요. / The adapter was made as a fallback before Paddle approval.

- **Stripe** — 태그 · tags: - · 지원 · support: `code` · 확인한 날 · checked: 2026-10-22 · https://stripe.com
  - 바꾸는 비용 · Switch cost: 키트에 어댑터가 없어요. 결제 포트(BillingPort)에 맞는 어댑터와 웹훅 경로를 직접 써야 해요. / The kit has no adapter. You write an adapter for the billing port (BillingPort) and the webhook route yourself.
  - 설명 · Note: 가격·세금 처리 방식은 이 목록에서 확인하지 않았어요. / Pricing and tax handling were not checked for this list.

## database

지금 런북의 서비스 · In the runbook now: Supabase (G-db)

- **Neon** — 태그 · tags: free · 지원 · support: `builtin` · 확인한 날 · checked: 2026-10-22 · https://neon.com
  - 이 결과를 고른 사이트 · via: 예약 접수 / Booking, 예약금 받기 / Booking deposits, 문의·상담 메일 알림 / Inquiry email alerts, 카카오 알림톡·문자 안내 / Kakao and SMS alerts, 마케팅 메일 수신 동의 / Marketing email consent, 내 신청 내역 확인 / My requests, 뉴스레터 구독 / Newsletter subscriptions, 카드 결제·정기구독 / Card payments and subscriptions, 웹 푸시 알림 / Web push notifications, 후기·상품 문의 / Reviews and product questions, 사이트 안 검색 / Site search, 상품 판매·카드·간편결제 / Sell products with card and easy pay, 회원가입·로그인 / Sign-up and log-in, 사진·파일 올리기 / Photo and file uploads
  - 바꾸는 비용 · Switch cost: 연결 문자열만 바꾸면 돼요. 코드를 쓸 필요는 없어요. / Change only the connection string. No code is needed.
  - 설명 · Note: Postgres라서 이 키트의 db 부품이 그대로 붙어요. 무료 요금제가 있고 무료 요금제의 컴퓨팅은 5분 동안 활동이 없으면 멈춰요. 서울 지역이 없고(가장 가까운 곳은 싱가포르), 이 키트는 포트 6543만 풀러로 보고 prepared statement를 꺼요. Neon의 풀러 연결은 prepared statement를 지원한다고 문서에 있어 그대로 두지만, 이 키트로 직접 돌려 보지는 않았어요. 마이그레이션은 직접 연결 문자열로 해요. / It is Postgres, so this kit's db part attaches as is. It has a free plan, and free-plan compute suspends after 5 minutes of inactivity. There is no Seoul region (the closest is Singapore). This kit treats only port 6543 as a pooler and turns prepared statements off; Neon's docs say its pooled connection supports protocol-level prepared statements, so they stay on, but this was not run against the kit. Run migrations with the direct connection string.

## domain

지금 런북의 서비스 · In the runbook now: Domain registrar (domain seller) (G-domain)

- **Vercel Domains** — 태그 · tags: - · 지원 · support: `code` · 확인한 날 · checked: 2026-10-22 · https://vercel.com
  - 바꾸는 비용 · Switch cost: 호스팅과 같은 곳에서 도메인을 살 수 있어요. 가격과 연결 단계가 줄어드는지는 [확인 안 됨]. / You can buy a domain at the same place as the host. Price and whether it shortens the connection steps are [not verified].
  - 설명 · Note: 이 키트는 도메인을 파는 곳을 가리지 않아요. 어디서 사든 연결 방법은 같은 장을 따라요. / This kit does not care where you buy the domain. The connection steps in the same chapter apply wherever you buy.

- **Cloudflare Registrar** — 태그 · tags: - · 지원 · support: `code` · 확인한 날 · checked: 2026-10-22 · https://www.cloudflare.com
  - 바꾸는 비용 · Switch cost: 다른 곳에서 산 도메인을 옮기는 절차는 [확인 안 됨]. 새로 사서 연결하는 방법은 같은 장을 따라요. / The steps for moving a domain bought elsewhere are [not verified]. For a new purchase, follow the connection steps in the same chapter.
  - 설명 · Note: 가격과 기능은 [확인 안 됨] — 비교하지 않았어요. / Price and features are [not verified] — they were not compared.

- **Gabia (Korean domain seller)** — 태그 · tags: - · 지원 · support: `code` · 확인한 날 · checked: 2026-10-22 · https://www.gabia.com
  - 바꾸는 비용 · Switch cost: 한국어 화면과 결제 방법이 필요한 분은 국내 도메인 업체를 고를 수 있어요. 연결 방법은 같은 장을 따라요. / If you need Korean screens and Korean payment methods, you can choose a Korean domain seller. The connection steps in the same chapter apply.
  - 설명 · Note: 가격과 기능, 한국어 지원 범위는 [확인 안 됨]. / Price, features and the extent of Korean support are [not verified].

## email

지금 런북의 서비스 · In the runbook now: Resend (G-email)

- **Resend** — 태그 · tags: free · 지원 · support: `builtin` · 확인한 날 · checked: 2026-10-22 · https://resend.com
  - 이 결과를 고른 사이트 · via: 예약 접수 / Booking, 예약금 받기 / Booking deposits, 문의·상담 메일 알림 / Inquiry email alerts, 내 신청 내역 확인 / My requests, 뉴스레터 구독 / Newsletter subscriptions, 카드 결제·정기구독 / Card payments and subscriptions, 후기·상품 문의 / Reviews and product questions, 상품 판매·카드·간편결제 / Sell products with card and easy pay
  - 바꾸는 비용 · Switch cost: 이 키트의 기본이에요. 바꿀 것이 없어요. / This is the kit's default. Nothing to change.
  - 설명 · Note: 공식 가격 쪽에 무료 요금제가 있어요. / The official pricing page lists a free plan.

- **Postmark** — 태그 · tags: free · 지원 · support: `code` · 확인한 날 · checked: 2026-10-22 · https://postmarkapp.com
  - 바꾸는 비용 · Switch cost: 전송기(createMailer)에 맞는 어댑터를 직접 써야 하고, 발신 도메인 인증을 Postmark 에서 다시 해야 해요. / You write an adapter for the mailer (createMailer) and verify the sender domain again in Postmark.
  - 설명 · Note: 공식 가격 쪽에 기한 없는 무료 개발자 요금제가 있어요. / The official pricing page lists a free developer plan with no expiry.

- **Amazon SES** — 태그 · tags: - · 지원 · support: `code` · 확인한 날 · checked: 2026-10-22 · https://aws.amazon.com
  - 바꾸는 비용 · Switch cost: 전송기(createMailer)에 맞는 어댑터를 직접 써야 하고, AWS 계정과 발신 도메인 인증이 필요해요. / You write an adapter for the mailer (createMailer), and need an AWS account and sender-domain verification.
  - 설명 · Note: 공식 가격 쪽은 사용량에 따라 내는 방식이고 무료는 AWS 전체 무료 이용 크레딧으로 안내돼요. / The official pricing page is pay-as-you-go, and the free part is described as general AWS free-tier credits.

## hosting

지금 런북의 서비스 · In the runbook now: Vercel (G-hosting)

- **Netlify** — 태그 · tags: - · 지원 · support: `code` · 확인한 날 · checked: 2026-10-22 · https://www.netlify.com
  - 바꾸는 비용 · Switch cost: 이 키트는 Vercel 기준으로 확인했어요. 정기 실행(Cron) 설정이 Vercel 의 vercel.json 에 있어서, 다른 곳으로 옮기면 정기 실행을 그곳 방식으로 다시 만들어야 해요. / This kit was checked on Vercel. The scheduled runs (Cron) are set in Vercel's vercel.json, so on another host you must rebuild them in that host's way.
  - 설명 · Note: 가격과 기능은 [확인 안 됨] — 비교하지 않았어요. / Price and features are [not verified] — they were not compared.

- **Cloudflare** — 태그 · tags: - · 지원 · support: `code` · 확인한 날 · checked: 2026-10-22 · https://www.cloudflare.com
  - 바꾸는 비용 · Switch cost: 이 키트는 Vercel 기준으로 확인했어요. 정기 실행(Cron) 설정이 Vercel 의 vercel.json 에 있어서, 다른 곳으로 옮기면 정기 실행을 그곳 방식으로 다시 만들어야 해요. / This kit was checked on Vercel. The scheduled runs (Cron) are set in Vercel's vercel.json, so on another host you must rebuild them in that host's way.
  - 설명 · Note: 가격과 기능, 이 키트가 그대로 올라가는지는 [확인 안 됨] — 확인하지 않았어요. / Price, features and whether this kit runs there as is are [not verified] — they were not checked.

- **Your own server** — 태그 · tags: - · 지원 · support: `code` · 확인한 날 · checked: 2026-10-22
  - 바꾸는 비용 · Switch cost: 서버 준비, HTTPS 인증서, 정기 실행, 배포 자동화를 직접 맡아야 해요. 이 키트는 이런 서버에서 돌려 본 것을 확인하지 않았어요. / You take over server setup, the HTTPS certificate, scheduled runs and deployment automation. This kit was not checked on such a server.
  - 설명 · Note: 가격과 안정성은 [확인 안 됨]. / Price and reliability are [not verified].

## newsletter

지금 런북의 서비스 · In the runbook now: 뉴스레터 구독 명단 (이 키트에 내장, 확인 메일은 메일 서비스) (G-newsletter)

- **Stibee (스티비)** — 태그 · tags: ko · 지원 · support: `code` · 확인한 날 · checked: 2026-10-22 · https://stibee.com
  - 바꾸는 비용 · Switch cost: 이 키트의 구독자 목록(listSubscribed)을 스티비로 옮기는 코드가 필요해요. 수신거부가 두 곳에서 어긋나지 않게 맞춰야 해요. / You need code that moves this kit's subscriber list (listSubscribed) into Stibee, and you must keep unsubscribes in step between the two.
  - 설명 · Note: 이 모듈은 메일을 보내지 않고 구독자 목록만 내요. 스티비는 한국어 이메일 발송 서비스이고 공식 도움말에 API·웹훅 항목이 있어요. 무료 요금제와 API 세부는 확인하지 못했어요. / This module does not send mail; it only lists subscribers. Stibee is a Korean-language email sending service and its help site has an API and webhook section. A free plan and API details were not confirmed.

## notify-kr

지금 런북의 서비스 · In the runbook now: Solapi (G-notify)

- **Naver Cloud SENS** — 태그 · tags: ko · 지원 · support: `code` · 확인한 날 · checked: 2026-10-22 · https://www.ncloud.com
  - 바꾸는 비용 · Switch cost: 발송부(solapi.ts)와 같은 모양의 어댑터를 새로 써야 해요. 발신번호 등록과 알림톡 템플릿 심사는 SENS 에서 다시 해요. / You must write a new adapter shaped like the sender (solapi.ts). Sender-number registration and Alimtalk template review are done again in SENS.
  - 설명 · Note: 공식 개요에 따르면 SMS·LMS·MMS 와 카카오톡 알림톡·브랜드 메시지를 미리 승인된 템플릿으로 보내요. 무료 구간은 확인하지 못했어요. / Per the official overview it sends SMS, LMS, MMS and KakaoTalk Alimtalk and BrandMessage through pre-approved templates. A free tier was not confirmed.

## payments-kr

지금 런북의 서비스 · In the runbook now: PortOne (G-payments-kr)

- **PortOne 안에서 PG 고르기 (토스페이먼츠 · KG이니시스 · NHN KCP · 나이스정보통신 · 웰컴페이먼츠)** — 태그 · tags: ko · 지원 · support: `builtin` · 확인한 날 · checked: 2026-10-22 · https://portone.io
  - 이 결과를 고른 사이트 · via: 예약금 받기 / Booking deposits, 상품 판매·카드·간편결제 / Sell products with card and easy pay
  - 바꾸는 비용 · Switch cost: 코드는 그대로예요. PortOne 콘솔에서 고른 PG 의 채널을 새로 만들고, 채널 키 값만 바꿔 다시 배포해요. PG 마다 계약과 심사가 따로 있어요. / No code change. Create a channel for the PG you pick in the PortOne console, change only the channel key value and redeploy. Each PG has its own contract and review.
  - 설명 · Note: PortOne 문서의 PG 목록에 올라 있는 한국 PG 예요. PG 별 수수료와 계약 조건은 이 목록에서 확인하지 않았어요. 각 PG 의 공식 안내에서 직접 확인하세요. / These are Korean PGs listed in PortOne's documents. Fees and contract terms per PG were not checked here. Check them in each PG's official guide.

- **토스페이먼츠 (PortOne 없이 직접 연동)** — 태그 · tags: ko · 지원 · support: `code` · 확인한 날 · checked: 2026-10-22 · https://www.tosspayments.com
  - 바꾸는 비용 · Switch cost: 결제 자리(PaymentGateway)의 세 메서드(결제 준비·재조회·취소)와 웹훅 처리를 토스페이먼츠 API 로 새로 써야 해요. 환경 변수도 새로 정해요. / You must write the three methods of the payment slot (PaymentGateway: prepare, re-fetch, cancel) and the webhook handling against the Toss Payments API. The environment variables are new too.
  - 설명 · Note: 공식 문서에 따르면 가입만 하면 테스트 키를 받아 연동을 시작할 수 있고, 테스트 환경의 결제 승인은 가상이라 결제수단에서 금액이 빠지지 않아요. 실결제용 키는 전자결제 신청 뒤에 확인할 수 있어요. 이 키트에는 어댑터가 없어요. / Per the official docs, you can start integrating with a test key right after signing up, and approvals in the test environment are virtual, so nothing is taken from the payment method. Keys for real payments appear after the electronic-payment application. This kit has no adapter for it.

## push

지금 런북의 서비스 · In the runbook now: Web Push (VAPID) (G-push)

- **OneSignal** — 태그 · tags: - · 지원 · support: `code` · 확인한 날 · checked: 2026-10-22 · https://onesignal.com
  - 바꾸는 비용 · Switch cost: 구독 저장과 보내기를 OneSignal 방식으로 바꿔야 해요. 구독 방식이 달라서 사용자가 알림을 다시 허용해야 할 수 있어요. / Subscription storage and sending must move to OneSignal's way. Subscriptions differ, so users may need to allow notifications again.
  - 설명 · Note: 공식 안내에 따르면 HTTPS, OneSignal 서비스 워커와 자바스크립트 SDK 가 필요해요(통합 방식에 따라 다름). 무료 요금제 여부는 확인하지 못했어요. 이 키트의 VAPID 방식은 외부 계정이 필요 없어요. / Per the official setup page it needs HTTPS, the OneSignal service worker and its JavaScript SDK (depends on integration type). A free plan was not confirmed. This kit's VAPID way needs no outside account.

## search

지금 런북의 서비스 · In the runbook now: 사이트 검색 (이 키트에 내장, Postgres) (G-search)

- **Meilisearch** — 태그 · tags: - · 지원 · support: `code` · 확인한 날 · checked: 2026-10-22 · https://www.meilisearch.com
  - 바꾸는 비용 · Switch cost: 검색 서비스 코드를 바꿔야 해요: 색인을 보내는 코드와 검색 호출을 새로 쓰고, 서버를 직접 운영하거나 클라우드를 골라요. / Replace the search service code: write new indexing and query calls, then run a server yourself or pick the cloud.
  - 설명 · Note: 공식 문서에 따르면 직접 올려 쓸 수 있고(단일 실행 파일과 REST API) 호스팅 클라우드도 있어요. 한국어 처리는 확인하지 못했어요. / Per the official docs you can self-host it (a single binary with a REST API) and there is also a hosted cloud. Korean-language handling was not confirmed.

- **Typesense** — 태그 · tags: - · 지원 · support: `code` · 확인한 날 · checked: 2026-10-22 · https://typesense.org
  - 바꾸는 비용 · Switch cost: 검색 서비스 코드를 바꿔야 해요: 색인과 검색 호출을 새로 쓰고 서버를 직접 운영하거나 클라우드를 골라요. / Replace the search service code: write new indexing and query calls, then run a server yourself or pick the cloud.
  - 설명 · Note: 공식 사이트에 따르면 오픈소스이고 직접 설치해 쓸 수 있으며 호스팅 클라우드(Typesense Cloud)도 있어요. 한국어 지원은 확인하지 못했어요. / Per the official site it is open source, can be self-hosted, and has a hosted cloud (Typesense Cloud). Korean support was not confirmed.

- **Algolia** — 태그 · tags: - · 지원 · support: `code` · 확인한 날 · checked: 2026-10-22 · https://www.algolia.com
  - 바꾸는 비용 · Switch cost: 검색 서비스 코드를 바꿔야 해요: 색인과 검색 호출을 새로 써요. 서버는 운영하지 않아도 돼요. / Replace the search service code: write new indexing and query calls. You do not run a server.
  - 설명 · Note: 공식 문서에 따르면 호스팅 검색 서비스(API 방식)예요. 무료 요금제와 한국어 지원은 확인하지 못했어요. / Per the official docs it is a hosted search service (API based). A free plan and Korean support were not confirmed.

## storage

지금 런북의 서비스 · In the runbook now: S3 호환 저장소 (AWS S3 · Cloudflare R2 · MinIO) (G-storage)

- **Cloudflare R2** — 태그 · tags: free · 지원 · support: `builtin` · 확인한 날 · checked: 2026-10-22 · https://www.cloudflare.com
  - 이 결과를 고른 사이트 · via: 사진·파일 올리기 / Photo and file uploads
  - 바꾸는 비용 · Switch cost: 코드는 그대로예요. 환경 변수 값만 바꿔요(주소·리전 auto·경로 방식 true). / No code change. Only the environment values change (endpoint, region auto, path style true).
  - 설명 · Note: 공식 가격 안내에 따르면 Standard 저장 공간에는 월 무료 구간이 있고, R2 에서 나가는 전송에는 요금이 붙지 않아요. 연결한 다른 서비스는 요금이 붙을 수 있어요. / Per the official pricing page, Standard storage has a monthly free tier and egress from R2 is not charged. Other services connected to a bucket may still charge.

- **Backblaze B2** — 태그 · tags: - · 지원 · support: `builtin` · 확인한 날 · checked: 2026-10-22 · https://www.backblaze.com
  - 이 결과를 고른 사이트 · via: 사진·파일 올리기 / Photo and file uploads
  - 바꾸는 비용 · Switch cost: 코드는 그대로예요. 주소·키 값을 바꾸고 CORS 를 B2 쪽에서 따로 설정해요. / No code change. Change the endpoint and keys, and set CORS on the B2 side separately.
  - 설명 · Note: 공식 문서에 따르면 S3 호환 API 이고 서명 주소로 올리기·내려받기를 지원해요. 객체별 접근 권한(ACL)·객체 태그·브라우저 POST 올리기는 지원하지 않아요. 이 키트는 서명 주소 PUT 을 쓰므로 첫 시험 올리기로 꼭 확인하세요. / Per the official docs it has an S3-compatible API and supports signed-URL upload and download. Per-object ACLs, object tags and browser POST uploads are not supported. This kit uses signed-URL PUT, so confirm with a first test upload.

- **AWS S3** — 태그 · tags: - · 지원 · support: `builtin` · 확인한 날 · checked: 2026-10-22 · https://aws.amazon.com
  - 이 결과를 고른 사이트 · via: 사진·파일 올리기 / Photo and file uploads
  - 바꾸는 비용 · Switch cost: 코드는 그대로예요. 환경 변수 값(주소·리전·버킷·키)만 바꿔요. / No code change. Only the environment values change (endpoint, region, bucket, keys).
  - 설명 · Note: 공식 가격 안내에 따르면 새 계정은 한정된 기간 동안 쓸 수 있는 무료 이용 크레딧을 받아요. 기간이 지나면 일반 요금이에요. / Per the official pricing page, new accounts get free-tier credits for a limited period. After that, normal pricing applies.

## 이 표 밖의 답 · Roles with no row here

아래 역할은 대안 표가 없어요. 「이 표 밖의 답이에요」라고 말하고, 확인하지 않은 것을 지어내지 않아요.
These roles have no alternatives table. Say the answer is outside this table and do not invent what was not checked.

- admin
- biz-kr
- booking
- commerce
- consent
- inquiry
- reviews
- security
