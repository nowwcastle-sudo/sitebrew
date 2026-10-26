생성 파일 — 손으로 고치지 않는다 / Generated file - do not edit by hand

# 장 카드 · Chapter cards

한 줄이 장 하나예요. 비용은 종류로만 말하고 금액은 사용자가 물을 때 공식 가격 쪽에서 확인해요.
One row is one chapter. Say cost by its kind only; give an amount only when the user asks, from the official price page.

## 목차 · Contents

- 장 카드 · Chapter cards
- 건너뛰면 · If skipped

| 장 id · Chapter id | 서비스 · Service | 역할 · Role | 필수/선택 · Required/optional | 비용 종류 · Cost kind | 먼저 할 장 · Do first | 들어가는 조건 · Joins when | 홈 도메인 · Home domain | 확인한 날 · Checked | 오래됨 기준일 · Old after | 단계 수 ko/en · Steps ko/en | 꼭 말할 이름 · Names to say |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| G-hosting | Vercel | hosting | 꼭 필요 / Always | 무료 한도 있음 / Free tier, 달마다 / Monthly | 없음 · none | 없음 · none | https://vercel.com | 2026-10-22 | 2027-01-20 | 6/6 | CRON_SECRET, LF_MODE, NEXT_PUBLIC_APP_URL |
| G-analytics | PostHog | analytics | 고른 기능에 필요 / Needed for a chosen feature | 무료 한도 있음 / Free tier, 쓴 만큼 / Pay for use | G-hosting | 없음 · none | https://posthog.com | 2026-10-22 | 2027-01-20 | 7/7 | POSTHOG_HOST, POSTHOG_PERSONAL_API_KEY, POSTHOG_PROJECT_ID, POSTHOG_PROJECT_KEY |
| G-biz-kr | National Tax Service, city/county/district office and PG company (Korea) | biz-kr | 선택 / Optional | 한 번 / One time, 팔 때마다 / Per sale | G-hosting | 고른 기능 · chosen feature: 카드 결제·정기구독 / Card payments and subscriptions, 상품 판매·카드·간편결제 / Sell products with card and easy pay; 언어 · language: ko | 없음 · none | 2026-10-22 | 2027-01-20 | 4/4 | LF_BUSINESS_ADDRESS, LF_BUSINESS_EMAIL, LF_BUSINESS_NAME, LF_BUSINESS_PHONE |
| G-db | Supabase | database | 고른 기능에 필요 / Needed for a chosen feature | 무료 한도 있음 / Free tier, 달마다 / Monthly | G-hosting | 없음 · none | https://supabase.com | 2026-10-22 | 2027-01-20 | 5/5 | DATABASE_URL |
| G-domain | Domain registrar (domain seller) | domain | 꼭 필요 / Always | 한 번 / One time | G-hosting | 없음 · none | 없음 · none | 2026-10-22 | 2027-01-20 | 5/5 | NEXT_PUBLIC_APP_URL |
| G-auth | Better Auth | auth | 고른 기능에 필요 / Needed for a chosen feature | 무료 / Free | G-db, G-domain | 없음 · none | https://better-auth.com | 2026-10-22 | 2027-01-20 | 7/7 | BETTER_AUTH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, KAKAO_CLIENT_ID, KAKAO_CLIENT_SECRET, NAVER_CLIENT_ID, NAVER_CLIENT_SECRET, NEXT_PUBLIC_APP_URL, SUBJECT_REF_KEY |
| G-admin | launch-factory | admin | 선택 / Optional | 무료 / Free | G-auth, G-db | 고른 기능 · chosen feature: 회원가입·로그인 / Sign-up and log-in, 상품 판매·카드·간편결제 / Sell products with card and easy pay, 예약 접수 / Booking, 문의·상담 메일 알림 / Inquiry email alerts, 후기·상품 문의 / Reviews and product questions, 뉴스레터 구독 / Newsletter subscriptions | 없음 · none | 2026-10-22 | 2027-01-20 | 12/12 | BOOKING_OWNER_EMAIL, INQUIRY_OWNER_EMAIL |
| G-email | Resend | email | 고른 기능에 필요 / Needed for a chosen feature | 무료 한도 있음 / Free tier, 쓴 만큼 / Pay for use | G-domain | 없음 · none | https://resend.com | 2026-10-22 | 2027-01-20 | 8/8 | EMAIL_FROM, LF_BUSINESS_ADDRESS, LF_BUSINESS_EMAIL, LF_BUSINESS_NAME, LF_BUSINESS_PHONE, LF_MARKETING_NIGHT_GUARD, NEXT_PUBLIC_APP_URL, RESEND_API_KEY |
| G-billing | Paddle | billing | 고른 기능에 필요 / Needed for a chosen feature | 팔 때마다 / Per sale | G-db, G-email | 고른 기능 · chosen feature: 카드 결제·정기구독 / Card payments and subscriptions | https://paddle.com | 2026-10-22 | 2027-01-20 | 13/13 | CRON_SECRET, DATABASE_URL, EMAIL_FROM, LF_EU_SALES, LF_MODE, LF_PADDLE_LIVE, LF_PAYMENT_FAILED_EMAIL, NEXT_PUBLIC_APP_URL, PADDLE_API_KEY, PADDLE_CLIENT_TOKEN, PADDLE_WEBHOOK_SECRET, RESEND_API_KEY, TURNSTILE_SECRET_KEY, TURNSTILE_SITE_KEY |
| G-booking | launch-factory | booking | 고른 기능에 필요 / Needed for a chosen feature | 무료 / Free | G-db, G-email | 없음 · none | 없음 · none | 2026-10-22 | 2027-01-20 | 1/1 | BOOKING_OWNER_EMAIL, CRON_SECRET |
| G-inquiry | 문의 접수 (메일 + 데이터베이스) | inquiry | 고른 기능에 필요 / Needed for a chosen feature | 무료 / Free | G-db, G-email | 없음 · none | 없음 · none | 2026-10-22 | 2027-01-20 | 5/5 | BETTER_AUTH_SECRET, CRON_SECRET, DATABASE_URL, EMAIL_FROM, INQUIRY_OWNER_EMAIL, LF_BUSINESS_EMAIL, RESEND_API_KEY, TURNSTILE_SECRET_KEY, TURNSTILE_SITE_KEY |
| G-notify | Solapi | notify-kr | 고른 기능에 필요 / Needed for a chosen feature | 쓴 만큼 / Pay for use | G-booking | 없음 · none | https://solapi.com | 2026-10-22 | 2027-01-20 | 5/5 | SOLAPI_API_KEY, SOLAPI_API_SECRET, SOLAPI_KAKAO_PFID, SOLAPI_SENDER |
| G-payments-kr | PortOne | payments-kr | 고른 기능에 필요 / Needed for a chosen feature | 팔 때마다 / Per sale | G-biz-kr, G-db, G-hosting | 고른 기능 · chosen feature: 상품 판매·카드·간편결제 / Sell products with card and easy pay | https://portone.io | 2026-10-22 | 2027-01-20 | 8/8 | CRON_SECRET, LF_MODE, NEXT_PUBLIC_PORTONE_CHANNEL_KEY, NEXT_PUBLIC_PORTONE_STORE_ID, PORTONE_API_SECRET, PORTONE_WEBHOOK_SECRET |
| G-commerce | launch-factory | commerce | 고른 기능에 필요 / Needed for a chosen feature | 무료 / Free | G-db, G-email, G-payments-kr | 고른 기능 · chosen feature: 상품 판매·카드·간편결제 / Sell products with card and easy pay | 없음 · none | 2026-10-22 | 2027-01-20 | 2/2 | CRON_SECRET, EMAIL_FROM |
| G-push | Web Push (VAPID) | push | 고른 기능에 필요 / Needed for a chosen feature | 무료 / Free | G-auth | 없음 · none | 없음 · none | 2026-10-22 | 2027-01-20 | 1/1 | VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY, VAPID_SUBJECT |
| G-search | 사이트 검색 (이 키트에 내장, Postgres) | search | 고른 기능에 필요 / Needed for a chosen feature | 무료 / Free | G-db | 없음 · none | 없음 · none | 2026-10-22 | 2027-01-20 | 0/0 | 없음 · none |
| G-security | Cloudflare Turnstile | security | 고른 기능에 필요 / Needed for a chosen feature | 무료 한도 있음 / Free tier | G-hosting | 없음 · none | https://www.cloudflare.com | 2026-10-22 | 2027-01-20 | 10/10 | CRON_SECRET, DATABASE_URL, TURNSTILE_SECRET_KEY, TURNSTILE_SITE_KEY |
| G-consent | Launch Factory consent | consent | 고른 기능에 필요 / Needed for a chosen feature | 무료 / Free | G-auth, G-email, G-security | 없음 · none | 없음 · none | 2026-10-22 | 2027-01-20 | 5/5 | BETTER_AUTH_SECRET, CRON_SECRET, LF_BUSINESS_ADDRESS, LF_BUSINESS_EMAIL, LF_BUSINESS_NAME, LF_BUSINESS_PHONE, LF_MARKETING_NIGHT_GUARD |
| G-newsletter | 뉴스레터 구독 명단 (이 키트에 내장, 확인 메일은 메일 서비스) | newsletter | 고른 기능에 필요 / Needed for a chosen feature | 무료 / Free | G-email, G-db, G-security | 없음 · none | 없음 · none | 2026-10-22 | 2027-01-20 | 1/1 | BETTER_AUTH_SECRET, EMAIL_FROM |
| G-reviews | 후기·상품 문의 (이 키트에 내장) | reviews | 고른 기능에 필요 / Needed for a chosen feature | 무료 / Free | G-db, G-security | 없음 · none | 없음 · none | 2026-10-22 | 2027-01-20 | 1/1 | REVIEWS_MODERATION |
| G-storage | S3 호환 저장소 (AWS S3 · Cloudflare R2 · MinIO) | storage | 고른 기능에 필요 / Needed for a chosen feature | 무료 한도 있음 / Free tier, 쓴 만큼 / Pay for use | G-db, G-security | 없음 · none | 없음 · none | 2026-10-22 | 2027-01-20 | 6/6 | STORAGE_ACCESS_KEY_ID, STORAGE_ENDPOINT, STORAGE_PUBLIC_BASE_URL, STORAGE_SECRET_ACCESS_KEY |

## 건너뛰면 · If skipped

- G-hosting (Vercel): 사이트가 인터넷에 올라가지 않아요. 진짜 주소가 없어서 도메인·로그인·결제·메일 설정을 이어 갈 수 없어요. / The site is not on the internet. Without a real address you cannot continue with the domain, sign-in, payment and email setup.
- G-analytics (PostHog): 방문자 수와 많이 본 쪽을 볼 수 없어요. 분석 스크립트와 동의 띠도 사이트에서 빠져요. / You cannot see visitor counts or the most viewed pages. The analytics script and the consent banner are also left out of the site.
- G-biz-kr (National Tax Service, city/county/district office and PG company (Korea)): 한국에서 돈을 받는 사이트로 열 수 없어요. 사업자 정보를 푸터에 보이지 못하고, 국내 카드 결제(PortOne)를 쓰려면 필요한 결제 계약도 할 수 없어요. / The site cannot open as one that takes money in Korea. It cannot show business details in the footer, and if you use Korean card payments (PortOne) it cannot sign the payment contract it requires.
- G-db (Supabase): 실제로 켜는 사이트가 데이터를 저장하지 못해요. 가입·로그인·문의·예약처럼 기록을 남기는 기능이 모두 켜지지 않아요. / The live site cannot store data. Every feature that keeps records, such as sign-in, inquiries and bookings, does not turn on.
- G-domain (Domain registrar (domain seller)): 호스팅이 준 임시 주소로만 열려요. 내 이름의 주소가 없고, 로그인·메일 링크도 그 임시 주소를 써요. / The site opens only on the temporary address the host gave you. There is no address with your own name, and sign-in and email links use that temporary address.
- G-auth (Better Auth): 가입과 로그인이 켜지지 않아요. 소셜 로그인은 건너뛰어도 이메일·비밀번호 로그인은 돼요. / Sign-up and sign-in do not turn on. You can skip social sign-in and still have email-and-password sign-in.
- G-admin (launch-factory): 들어온 주문·예약·문의·후기·뉴스레터 신청을 화면으로 볼 수 없어요. 데이터베이스를 직접 열어야 확인할 수 있어요. / You cannot see incoming orders, bookings, inquiries, reviews or newsletter sign-ups on a screen. You would have to open the database directly.
- G-email (Resend): 가입 확인·결제 안내·문의 알림 같은 메일이 진짜로 나가지 않아요. 개발 중에는 콘솔에만 찍혀요. / Mail such as sign-up confirmation, payment notices and inquiry alerts is not really sent. During development it only prints to the console.
- G-billing (Paddle): 카드 결제와 정기구독이 열리지 않아요. 요금제를 팔 수 없고 구독 상태도 받지 못해요. / Card payments and subscriptions do not open. You cannot sell plans or receive subscription state.
- G-booking (launch-factory): 새 예약 접수만 꺼져요. 이미 받은 예약의 조회·취소·안내는 그대로예요. / Only new booking intake turns off. Existing bookings keep look-up, cancel and reminders.
- G-inquiry (문의 접수 (메일 + 데이터베이스)): 문의 폼이 꺼지고 안내만 보여요. 방문자의 문의를 받지도 저장하지도 못해요. / The inquiry form is off and only a notice shows. Visitor inquiries are neither received nor saved.
- G-notify (Solapi): 카카오 알림톡·문자 안내만 꺼져요. 예약 안내는 메일로만 가요. / Only Kakao and text alerts turn off. Booking notices go by email only.
- G-payments-kr (PortOne): 상점에서 한국 카드와 간편결제를 받을 수 없어요. 장바구니와 주문 화면은 있어도 결제가 열리지 않아요. / The shop cannot take Korean card or easy-pay payments. The cart and order screens exist, but checkout does not open.
- G-commerce (launch-factory): 상점이 열리지 않아요. 장바구니와 주문, 재고 확보가 꺼지고, 사이트의 다른 부분은 그대로 켜져요. / The shop does not open. The cart, orders and stock holds turn off, and the rest of the site keeps running.
- G-push (Web Push (VAPID)): 웹 푸시만 꺼져요. 푸시 단추가 보이지 않아요. / Only web push turns off. There is no push button.
- G-search (사이트 검색 (이 키트에 내장, Postgres)): 검색 결과가 비어 있어요. 색인 작업을 한 번 돌리기 전에는 아무것도 나오지 않아요. / Search results stay empty. Nothing shows until the index job has run once.
- G-security (Cloudflare Turnstile): 가입·문의 폼의 봇 확인이 꺼지고, 예약된 정리 작업(Cron)이 거절돼요. 운영 중인 사이트에서는 폼과 Cron 이 켜지지 않을 수 있어요. / The bot check on sign-up and inquiry forms is off, and scheduled cleanup jobs (Cron) are rejected. On a live site the forms and Cron jobs may not start.
- G-consent (Launch Factory consent): 마케팅 메일 수신 동의를 받고 기록할 수 없어요. 동의 없이 광고 메일을 보내지 않도록, 이 기능 없이는 광고 메일도 보내지 마세요. / You cannot collect or record marketing email consent. Do not send marketing mail without this feature, so that nothing goes out without consent.
- G-newsletter (뉴스레터 구독 명단 (이 키트에 내장, 확인 메일은 메일 서비스)): 확인 메일을 보낼 수 없어서 구독이 시작되지 않아요. / Confirmation mail cannot be sent, so subscriptions never start.
- G-reviews (후기·상품 문의 (이 키트에 내장)): 후기와 상품 문의를 받을 수 없어요. 봇 확인 키(Turnstile)가 없으면 실제 운영에서 사이트가 시작되지 않아요. / Reviews and product questions will not work. Without the bot-check key (Turnstile), the site does not start in live mode.
- G-storage (S3 호환 저장소 (AWS S3 · Cloudflare R2 · MinIO)): 파일 올리기만 꺼져요. 사이트의 다른 부분은 그대로 켜져요. / Only file upload turns off. The rest of the site keeps running.
