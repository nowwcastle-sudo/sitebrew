# 운영 런북(전문가용) — 메일 보내기 (Resend)

*Expert runbook: sending email (Resend). English follows the Korean part.*

- 대상: 가입 확인·환영·결제·문의·예약 같은 메일을 실제로 보내야 하는 사이트 운영자. 부품은 `email`(레지스트리 `feature-email-resend`). 결제·문의·뉴스레터·예약 기능이 이 부품을 끌어온다.
- 용도: 플러그인 런북 기능의 **내용 원천**이다. 전문가용은 이 글을 그대로 쓰고, 초보자용은 이 글의 항목을 풀어 쓴다. 화면 이름·DNS 레코드 값은 적지 않는다(Resend 가 계정마다 보여 준다).
- 값(키·비밀)은 채팅·저장소·로그에 쓰지 않는다. 호스팅 대시보드나 `vercel env add <이름>` 표준 입력에 직접 넣는다.
- `LF_MODE=mock`(기본)이면 키 없이 메일이 콘솔에 찍힌다(`LF_MOCK_OUTBOX` 파일을 주면 한 줄씩 남긴다). 진짜 사용자에게 보낼 때만 등록한다.

## G-email — 메일 보내기 (Resend)

- 왜 필요한가: 사이트가 보내는 메일(가입 확인, 결제·가격 변경 안내, 문의·예약 알림 등)이 진짜로 나가려면 Resend 키와 DNS 로 인증한 발신 도메인이 필요하다.
- 준비물: 사이트 도메인과 그 도메인의 DNS 를 고칠 수 있는 곳(도메인 장 `G-domain`), 이메일 주소(Resend 가입).
- 등록 1 — Resend 계정을 만든다.
- 등록 2 — Resend 에 발신 도메인을 더한다. 사이트 도메인 그대로나 그 하위 도메인 중 하나를 고른다. Resend 가 DNS 레코드 목록(서비스가 보여 주는 레코드)을 낸다.
- 등록 3 — 그 레코드를 DNS 제공자에 그대로 추가한다. 보통 DKIM 서명용 레코드, 반송 처리용 `MX` 레코드, SPF 용 `TXT` 레코드가 나온다(발송 전용 하위 도메인에 붙는다). 값은 계정마다 다르니 Resend 화면에서 복사한다. 이어서 Resend 에서 DNS 확인을 누른다.
  - 기다림: 레코드를 바르게 넣으면 인증까지 시간이 걸리고 최대 72시간까지 걸릴 수 있다. 72시간 안에 레코드를 찾지 못하면 상태가 실패가 된다.
  - 권장: DMARC 는 자동으로 만들어지지 않는다. Resend 는 강하게 권장하므로 따로 추가한다(스팸함 방지).
- 등록 4 — Resend 에서 API 키를 만든다. 키는 만들 때 한 번만 보인다 → `RESEND_API_KEY`. 권한은 발송 전용(sending access)으로 줄 수 있고 특정 도메인으로 제한할 수도 있다. 발송 전용 키는 도메인 인증 상태를 읽지 못하므로 점검 도구(`scripts/doctor.mjs`)가 인증 확인 대신 경고를 낸다(고장은 아니다).
- 설정: 호스팅 환경 변수(대시보드 또는 `vercel env add <이름>` 표준 입력)에 `RESEND_API_KEY`, `EMAIL_FROM` 을 넣는다. `EMAIL_FROM` 은 `이름 <주소@인증한도메인>` 모양이고 **Resend 에서 인증한 도메인**이어야 한다. live 에서는 둘 다 필수다(없으면 켜질 때 멈춘다).
- 설정: 메일 안의 링크 기준 주소 `NEXT_PUBLIC_APP_URL`(배포 주소, live 필수)도 넣는다.
- 설정: 광고성 메일(`marketingAnnouncement` 템플릿)은 사업자 정보 `LF_BUSINESS_NAME`·`LF_BUSINESS_EMAIL`·`LF_BUSINESS_PHONE`·`LF_BUSINESS_ADDRESS` 가 모두 있어야 보낸다(하나라도 비면 던진다). 거래 메일은 영향이 없다. 광고성 메일을 한국 시각 밤 시간대에 보내지 않고 미루는 점검은 `LF_MARKETING_NIGHT_GUARD`(기본 켜짐, off 로 끈다).
- 설정: 제품 이름·기본 언어는 `lib/launch/config.ts` 의 `PRODUCT_NAME`·`DEFAULT_LOCALE` 을 제품에 맞게 고친다.
- 확인: 배포 환경에서 가입 확인 메일처럼 메일이 나가는 동작을 한 번 한다 → 받은편지함에 도착 → Resend 의 발송 기록(로그)에서 전달 상태를 본다. 점검 도구 `node scripts/doctor.mjs --stage preview` 의 `resend` 항목도 참고한다.
- 막힘: 인증이 오래 `pending` → 레코드 이름·값이 DNS 제공자에 정확히 들어갔는지, 같은 이름의 `MX` 가 충돌하지 않는지 본다(반송용 `MX` 는 발송 하위 도메인에 붙는다). 403 오류 → 인증 전에 `resend.dev` 테스트 주소로 보내면 계정 본인 주소로만 보낼 수 있다, 또는 `EMAIL_FROM` 이 인증한 도메인과 다르다. 메일이 스팸함으로 감 → SPF·DKIM·DMARC 셋이 모두 있는지 먼저 본다. 메일이 `suppressed` → 이전에 반송되거나 스팸 신고된 주소는 Resend 의 차단 목록에 올라 다시 보내지지 않는다. 광고성 헤더(`List-Unsubscribe`)가 DKIM 서명 대상에 들어가는지는 [확인 안 됨].
- 출처: Resend 문서(resend.com/docs) — 도메인 관리·인증 상태, 도메인이 인증되지 않을 때, API 키 만들기, 403 오류(resend.dev 도메인·도메인 불일치), 스팸 문제, 차단 목록. 저장소: `.env.example`, `registry/feature-email-resend` 의 설치 안내, `scripts/doctor.mjs`.

---

# Expert runbook — sending email (Resend)

*Source of content for the plugin runbook feature. Expert version: use as is. Beginner version: expand each item. Screen names and DNS record values are not recorded (Resend shows them per account).*

- For: sites that must really send mail (sign-up confirmation, welcome, payment, inquiry, booking). The part is `email` (registry `feature-email-resend`). The payment, inquiry, newsletter and booking features pull it in.
- Never put a key or secret in chat, the repository or logs. Use the host dashboard or `vercel env add <NAME>` (stdin).
- With `LF_MODE=mock` (default) mail is printed to the console with no key (give a `LF_MOCK_OUTBOX` file to keep one line per mail). Register only to send to real people.

## G-email

- Why: for the mail your site sends (sign-up confirmation, payment and price-change notices, inquiry and booking alerts) to really go out, you need a Resend key and a sender domain verified through DNS.
- What you need: your site domain and a place to edit its DNS (domain chapter `G-domain`), and an email address for the Resend sign-up.
- Register 1 — create a Resend account.
- Register 2 — add a sender domain in Resend. Pick your site domain itself or a subdomain of it. Resend lists the DNS records (the records the service shows).
- Register 3 — add those records to your DNS provider as shown. Usually you get a DKIM signing record, an `MX` record for bounce handling and an SPF `TXT` record (attached to a sending subdomain). Values differ per account, so copy them from the Resend screen. Then press the DNS verify action in Resend.
  - Waiting: with correct records verification takes some time and can take up to 72 hours. If Resend cannot find the records within 72 hours the status becomes failed.
  - Recommended: DMARC is not created automatically. Resend strongly recommends it, so add it yourself (it helps against spam placement).
- Register 4 — create an API key in Resend. The key is shown only once → `RESEND_API_KEY`. The permission can be sending-only and can be limited to one domain. A sending-only key cannot read the domain verification status, so the check tool (`scripts/doctor.mjs`) gives a warning instead of a verification result (not a fault).
- Config: put `RESEND_API_KEY` and `EMAIL_FROM` in the host environment (dashboard or `vercel env add <NAME>` stdin). `EMAIL_FROM` looks like `Name <address@verified-domain>` and the domain must be one **verified in Resend**. In live both are required (boot stops without them).
- Config: also set `NEXT_PUBLIC_APP_URL` (the deployed address, the base for links in mail; required in live).
- Config: advertising mail (the `marketingAnnouncement` template) is sent only when the business details `LF_BUSINESS_NAME`, `LF_BUSINESS_EMAIL`, `LF_BUSINESS_PHONE` and `LF_BUSINESS_ADDRESS` are all set (any one empty makes it throw). Transactional mail is not affected. The check that defers advertising mail at night in Korean time is `LF_MARKETING_NIGHT_GUARD` (on by default, off to disable).
- Config: set the product name and default language with `PRODUCT_NAME` and `DEFAULT_LOCALE` in `lib/launch/config.ts`.
- Check: on the deployed site do one action that sends mail, such as a sign-up confirmation → it arrives in the inbox → check the delivery status in Resend's sending log. The `resend` item of `node scripts/doctor.mjs --stage preview` also helps.
- Stuck: domain stays `pending` → check the record names and values were entered exactly at the DNS provider and no same-name `MX` conflicts (the bounce `MX` sits on the sending subdomain). 403 error → before verification, sending from the `resend.dev` test address works only to your own account address, or `EMAIL_FROM` does not match the verified domain. Mail lands in spam → first check that SPF, DKIM and DMARC all exist. Mail is `suppressed` → an address that hard-bounced or complained before is on Resend's suppression list and is not sent to again. Whether the `List-Unsubscribe` header is covered by the DKIM signature is [not verified].
- Sources: Resend docs (resend.com/docs) — managing domains and statuses, "what if my domain is not verifying", creating API keys, 403 errors (resend.dev domain, domain mismatch), spam placement, suppression list. This repository: `.env.example`, the install notes of `registry/feature-email-resend`, `scripts/doctor.mjs`.
