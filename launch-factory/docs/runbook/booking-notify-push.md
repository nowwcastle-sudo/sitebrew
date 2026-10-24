# 운영 런북(전문가용) — 예약 · 한국 알림 · 웹 푸시

*Expert runbook: booking, Korean alerts, web push. English follows the Korean part.*

- 확인일: 2026-10-22. 외부 서비스 화면은 바뀐다. 90일이 지나면 다시 확인한다.
- 대상: 이 모듈을 쓰기로 정한 사이트 운영자. 모듈은 그대로 두고 계정·키·심사는 운영자가 직접 한다.
- 용도: 플러그인 런북 기능의 **내용 원천**이다. 전문가용은 이 글을 그대로 쓰고, 초보자용은 이 글의 항목을 풀어 쓴다. 화면 이름·주소·경로는 이 글에 깊이 적지 않는다(버전마다 다르다).
- 장 id: `G-booking` · `G-notify` · `G-push` (`features/outcomes.yaml` guides 열과 같다).
- 값(키·비밀·번호)은 채팅·저장소·로그에 쓰지 않는다. `vercel env add <이름>` 표준 입력이나 호스팅 대시보드에 직접 넣는다.

## 0. mock 과 live

`LF_MODE=mock`(기본)이면 셋 다 외부 호출 없이 돈다. 진짜 손님에게 보낼 때만 등록한다.

| 기능 | mock | live 에서 없으면 |
|---|---|---|
| 예약 | 가짜 대표 메일로 켜진다. 접수·조회·취소·확정 모두 동작 | `BOOKING_OWNER_EMAIL` 없음 → 접수만 꺼진다. 기존 예약의 조회·취소·안내는 그대로 |
| 한국 알림 | 발송함(`LF_MOCK_NOTIFY_OUTBOX` 경로)에 끝 4자리·템플릿·채널·시각만 기록 | `SOLAPI_API_KEY`·`SOLAPI_API_SECRET`·`SOLAPI_SENDER` 중 하나라도 없음 → 기능만 꺼진다. 예약 안내는 메일만 |
| 웹 푸시 | 구독 저장, 보내기는 기록만. mock 구독은 live 에서 못 쓴다 | VAPID 셋 중 하나라도 없거나 모양이 틀림 → 기능만 꺼진다(푸시 단추 없음) |

## 1. 환경 변수

정본은 `.env.example`. 선택 이름은 없어도 사이트가 켜진다.

| 이름 | 비밀 | 기능 | 없으면 |
|---|---|---|---|
| `BOOKING_OWNER_EMAIL` | 개인정보 | 예약 | 접수만 꺼짐 |
| `TURNSTILE_SECRET_KEY` · `TURNSTILE_SITE_KEY` · `CRON_SECRET` | 앞·뒤 예 | 예약 폼·Cron | 예약 항목이 요구(기존 값 재사용) |
| `SOLAPI_API_KEY` · `SOLAPI_API_SECRET` | **예** | 알림 | 알림 꺼짐 |
| `SOLAPI_SENDER` | 아니오 | 알림(등록한 발신번호, 숫자만) | 알림 꺼짐 |
| `SOLAPI_KAKAO_PFID` | 아니오 | 알림(카카오 채널 id) | 알림톡 없이 문자만 |
| `VAPID_PUBLIC_KEY` · `VAPID_SUBJECT` | 아니오 | 푸시(`mailto:` 또는 `https://`) | 푸시 꺼짐 |
| `VAPID_PRIVATE_KEY` | **예** | 푸시 | 푸시 꺼짐 |

`npm run env:check -- --vercel` 은 필수 이름과 `BOOKING_OWNER_EMAIL` 만 본다. Solapi·VAPID 이름은 아직 점검 밖이다.

## G-booking — 예약

- 등록: 없음. 알림 받을 메일 하나(`BOOKING_OWNER_EMAIL`, 이메일 형식이 아니면 부팅이 멈춘다).
- 설정: `lib/launch/booking-config.ts` — 서비스·영업시간·휴무일·수용량·취소 마감·안내 시각. `mode` `"instant"`(접수 즉시 확정) · `"request"`(관리 화면 예약 구획에서 확정 필요).
- Cron: `vercel.json` 에 `/api/cron/booking`, `*/30 * * * *`. 시작 전 안내·보유 기간 지난 예약 파기. `CRON_SECRET` 없으면 401.
- 폼: 숨은 입력 `cf-turnstile-response` · `idempotencyKey`(폼을 열 때 생성).
- 확인: `env:check` 경고 없음 → `/book` 이 폼을 그림 → 시험 예약 → 대표 메일 수신.
- 예약금: 서비스에 `deposit`(원)을 적고 `feature-booking-deposit`(결제 중개 `payments-kr` 필요)을 붙인다. 접수 → 결제 대기(자리는 `depositPolicy.holdMinutes`, 기본 30분 붙들림) → 결제하면 확정. 같은 Cron 이 기한 지난 결제 대기를 닫아 자리를 푼다. 취소하면 마감 안은 전액 환불(마감 뒤는 `laterRefundPercent`), 대표(관리 화면)가 취소하면 시각과 상관없이 전액 환불(`ownerCancelRefundPercent`, 기본 100, 0~100으로 바꿀 수 있다), 환불이 실패하면 예약은 취소되지 않고 다시 시도할 수 있다. 금액·결제 번호는 5년 보유. 한계: 새로고침하면 결제를 이어 하지 못한다(다시 예약하거나 기한까지 기다린다).

## G-notify — 카카오 알림톡 · 문자 (Solapi)

- 등록 1 — Solapi 계정(본인인증). 개인 계정은 하루 한도·발신번호 수가 작다. 기업 계정이 넉넉하다.
- 등록 2 — 발신번호(문자·대체발송에 필수): 사전 등록 번호만 발송 가능. 서류(통신서비스 이용증명원, 재직증명서 등), 검토 영업일 1~3일. → `SOLAPI_SENDER`.
- 등록 3 — API Key/Secret 발급 → `SOLAPI_API_KEY`·`SOLAPI_API_SECRET`. (콘솔 메뉴 위치는 버전마다 다르다. 이 글은 확인하지 않았다.)
- 등록 4 — 알림톡(선택): 카카오톡 채널 개설 → 비즈니스 심사(사업자등록증 또는 고유번호증, 대표자 인증, 며칠) → 채널 공개·검색 허용 ON, 고객센터 연락처 입력 → Solapi 에 채널 연동 → 채널 id `KA01PF…` → `SOLAPI_KAKAO_PFID`.
- 등록 5 — 알림톡 템플릿 심사: Solapi 에서 등록·검수 요청, 카카오 심사 보통 영업일 1~3일. **정보성 문구만 통과**(광고·결제 유도 문구는 반려·소명 대상). 요청한 템플릿은 수정 불가(오탈자도) — 새로 등록한다. 발송 이력이 1년 없으면 휴면. 통과 id → `lib/launch/notify-kr-config.ts` 의 `NOTIFY_TEMPLATES.alimtalkId`. 심사 전·중에는 문자로 나간다.
- 광고성 문자(`purpose: "marketing"`): 채널 동의(`feature-consents`) + 21시~다음날 8시 금지 + 「(광고)」 머리 + 무료수신거부 번호(`MARKETING_OPT_OUT_NUMBER`). 하나라도 어긋나면 `skipped` 와 이유. 발송 화면은 제품 몫.
- 확인: 전화번호로 시험 예약 → 문자/알림톡 수신 → Solapi 발송 내역(보관 12개월). 메일만 오면 `SOLAPI_*` 셋 중 빈 값.
- 막힘: 「이미 사용중인 채널」 → 다른 계정에 연동됨, Solapi 고객센터. 「채널 상태 확인」 → 채널 공개 ON 후 재연동. 관리자 알림 오류 → 카카오 관리자 추가인증. 알림톡 실패 시 문자로 대체되고, 문자도 안 되면 발신번호 등록 상태를 본다.
- 출처: Solapi 안내(solapi.com/guides, /kakao-ata-guide), 2026-10-22 확인.

## G-push — 웹 푸시 (VAPID)

- 등록: 없음(외부 계정 불필요). `npx web-push@3.6.7 generate-vapid-keys` 로 키 한 쌍.
- 설정: `VAPID_PUBLIC_KEY` · `VAPID_PRIVATE_KEY`(비밀) · `VAPID_SUBJECT`(`mailto:` 또는 `https://`). 하나라도 없거나 틀리면 푸시만 꺼진다. 키를 바꾸면 기존 구독이 못 쓰인다 — 바꾸지 않는다.
- 조건: HTTPS 필수(localhost 예외). iOS 는 홈 화면에 추가한 앱만 수신. 로그인한 사용자만(비로그인은 메일·알림톡). 권한은 사용자가 단추를 누를 때만 묻는다.
- 확인: 로그인 → 푸시 단추 → 허용 → 서버에서 `(await push()).sendToUser(userId, { title, body })` → 기기에 알림. 단추가 없으면 VAPID 셋을 본다.
- 막힘: 푸시 서비스 401·403 = 우리 VAPID 설정 문제(구독은 안 지운다). 404·410 = 폐기된 기기(자동 삭제). 보낼 시점은 제품 코드가 정한다.

---

# Expert runbook — booking, Korean alerts, web push

*Source of content for the plugin runbook feature. Expert version: use as is. Beginner version: expand each item. Exact screen names, URLs and paths are deliberately not recorded here (they change per version). Checked 2026-10-22; re-check after 90 days.*

Never put a key, secret or number in chat, the repository or logs. Use `vercel env add <NAME>` (stdin) or the host dashboard.

## 0. mock vs live

With `LF_MODE=mock` (default) all three run with no outside call. Register only to send to real customers.

| Feature | mock | live, when missing |
|---|---|---|
| Booking | Starts with a fake owner address; submit/look up/cancel/confirm all work | No `BOOKING_OWNER_EMAIL` → intake only turns off; existing bookings keep look-up, cancel, reminders |
| Korean alerts | Outbox file (`LF_MOCK_NOTIFY_OUTBOX`) gets last 4 digits, template, channel, time | Any of `SOLAPI_API_KEY`/`SOLAPI_API_SECRET`/`SOLAPI_SENDER` missing → feature off; booking notices by email only |
| Web push | Subscriptions stored, sends only logged; mock subscriptions are unusable in live | Any VAPID value missing or malformed → feature off (no push button) |

## 1. Environment variables

Source of truth: `.env.example`. Optional names do not stop the site from starting.

| Name | Secret | Feature | If missing |
|---|---|---|---|
| `BOOKING_OWNER_EMAIL` | personal data | Booking | Intake off |
| `TURNSTILE_SECRET_KEY` · `TURNSTILE_SITE_KEY` · `CRON_SECRET` | first and last: yes | Booking form/Cron | Required by the booking item (reuse existing values) |
| `SOLAPI_API_KEY` · `SOLAPI_API_SECRET` | **yes** | Alerts | Alerts off |
| `SOLAPI_SENDER` | no | Alerts (registered sender number, digits only) | Alerts off |
| `SOLAPI_KAKAO_PFID` | no | Alerts (Kakao channel id) | Text only, no Alimtalk |
| `VAPID_PUBLIC_KEY` · `VAPID_SUBJECT` | no | Push (`mailto:` or `https://`) | Push off |
| `VAPID_PRIVATE_KEY` | **yes** | Push | Push off |

`npm run env:check -- --vercel` checks required names and `BOOKING_OWNER_EMAIL` only; Solapi and VAPID names are not covered yet.

## G-booking

- Register: nothing. One address for notices (`BOOKING_OWNER_EMAIL`; a non-email value stops boot).
- Config: `lib/launch/booking-config.ts` — services, hours, closed days, capacity, cancel deadline, reminder time. `mode`: `"instant"` or `"request"` (needs confirming in the admin Bookings section).
- Cron: `/api/cron/booking`, `*/30 * * * *` in `vercel.json`. Reminders and retention purge. 401 without `CRON_SECRET`.
- Form: hidden inputs `cf-turnstile-response` and `idempotencyKey` (made when the form opens).
- Check: no `env:check` warning → `/book` draws the form → test booking → owner mail arrives.
- Deposit: put `deposit` (KRW) on a service and add `feature-booking-deposit` (needs the `payments-kr` gateway). Submit → pending payment (the slot is held for `depositPolicy.holdMinutes`, default 30) → paid means confirmed. The same cron closes expired holds and frees the slot. Cancelling inside the deadline refunds in full (after it, `laterRefundPercent`); when the owner cancels from the admin screen the customer gets `ownerCancelRefundPercent` back regardless of timing (default 100, settable 0–100); if the refund fails the booking is not cancelled and can be retried. Amount and payment id are kept 5 years. Limit: reloading loses the payment step (book again or wait for the hold to expire).

## G-notify — Kakao Alimtalk and text (Solapi)

- Register 1 — Solapi account (identity verification). Personal accounts have small daily limits and few sender numbers; business accounts have more.
- Register 2 — sender number (needed for text and fallback): only pre-registered numbers can send. Documents (telecom usage certificate, employment certificate, etc.), review 1–3 business days. → `SOLAPI_SENDER`.
- Register 3 — issue API Key/Secret → `SOLAPI_API_KEY`, `SOLAPI_API_SECRET`. (Console menu location varies by version; not verified here.)
- Register 4 — Alimtalk (optional): open a Kakao Talk Channel → business verification (business registration or unique-number certificate, representative ID, several days) → channel public and searchable ON, customer-service contact set → link the channel in Solapi → channel id `KA01PF…` → `SOLAPI_KAKAO_PFID`.
- Register 5 — Alimtalk template review: register and request review in Solapi; Kakao review usually 1–3 business days. **Only informational wording passes** (advertising or payment-inducing wording is rejected or needs justification). A submitted template cannot be edited (not even a typo) — register a new one. A template with no sends for a year goes dormant. Approved id → `NOTIFY_TEMPLATES.alimtalkId` in `lib/launch/notify-kr-config.ts`. Before and during review, text is sent instead.
- Advertising text (`purpose: "marketing"`): channel consent (`feature-consents`) + not 21:00–08:00 + "(광고)" prefix + free opt-out number (`MARKETING_OPT_OUT_NUMBER`). Any miss → `skipped` with a reason. The sending screen is the product's job.
- Check: test booking with a phone number → text/Alimtalk arrives → Solapi send history (kept 12 months). Email only → one of the three `SOLAPI_*` values is empty.
- Stuck: "channel already in use" → linked to another account, ask Solapi support. "Check channel status" → channel public ON, link again. Manager notification error → Kakao additional manager verification. Failed Alimtalk falls back to text; if text fails too, check sender registration.
- Source: Solapi guides (solapi.com/guides, /kakao-ata-guide), checked 2026-10-22.

## G-push — Web push (VAPID)

- Register: nothing external. `npx web-push@3.6.7 generate-vapid-keys` for a key pair.
- Config: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (secret), `VAPID_SUBJECT` (`mailto:` or `https://`). Any missing or wrong → push only turns off. Changing the key invalidates existing subscriptions — do not change it.
- Conditions: HTTPS required (localhost excepted). iOS receives push only in an app added to the Home Screen. Signed-in users only (others get email/Alimtalk). Permission is asked only on a button press.
- Check: sign in → push button → allow → `(await push()).sendToUser(userId, { title, body })` → notice on the device. No button → check the three VAPID values.
- Stuck: push service 401/403 = our VAPID setup (subscriptions are not deleted). 404/410 = dead device (removed automatically). When to send is product code.
