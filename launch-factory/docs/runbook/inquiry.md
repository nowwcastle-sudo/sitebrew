# 운영 런북(전문가용) — 문의 접수

*Expert runbook: inquiry intake. English follows the Korean part.*

- 대상: 방문자의 문의·상담 신청을 받아 저장하고 대표 메일로 알림받으려는 사이트 운영자. 부품은 `inquiry`(레지스트리 `feature-inquiry`). 외부 서비스에 새로 가입할 것은 없고, 메일(`G-email`)과 데이터베이스(`G-db`) 설정을 쓴다.
- 용도: 플러그인 런북 기능의 **내용 원천**이다. 전문가용은 이 글을 그대로 쓰고, 초보자용은 이 글의 항목을 풀어 쓴다.
- 값(키·비밀)은 채팅·저장소·로그에 쓰지 않는다. 호스팅 대시보드나 `vercel env add <이름>` 표준 입력에 직접 넣는다.
- `LF_MODE=mock`(기본)이면 `INQUIRY_OWNER_EMAIL` 이 없어도 가짜 주소로 켜진다. 진짜 알림을 받을 때만 설정한다.

## G-inquiry — 문의 접수

- 왜 필요한가: 문의 폼으로 들어온 글을 데이터베이스에 저장하고 대표 메일로 알려 주려면, 알림 받을 메일 주소와 메일 보내기(`G-email`)·데이터베이스(`G-db`)가 먼저 되어 있어야 한다.
- 준비물: 알림을 받을 대표 메일 주소(개인정보라 저장소에 적지 않는다), 끝낸 `G-db`·`G-email`, 호스팅 환경 변수 화면.
- 등록: 없음. 외부 서비스 계정은 새로 필요 없다. 봇 방어 키(`TURNSTILE_SECRET_KEY`·`TURNSTILE_SITE_KEY`)는 보안 장 `G-security` 에서 만든 값을 그대로 쓴다.
- 설정: 호스팅 환경 변수(대시보드 또는 `vercel env add <이름>` 표준 입력)에 `INQUIRY_OWNER_EMAIL`(알림 받을 대표 메일, 이메일 형식이 아니면 켜질 때 멈춘다)을 넣는다. `LF_BUSINESS_EMAIL` 로 대신하지 않는다 — 그것은 바닥글에 공개하는 표시 주소다. 함께 필요한 값은 이미 정한 것을 쓴다: 데이터베이스 `DATABASE_URL`, 봇 방어 `TURNSTILE_SECRET_KEY`·`TURNSTILE_SITE_KEY`, Cron 용 `CRON_SECRET`, 메일 `RESEND_API_KEY`·`EMAIL_FROM`, 인증 항목이 함께 설치되므로 `BETTER_AUTH_SECRET`.
- 설정: 문의 폼에는 숨은 입력 둘이 필요하다 — Turnstile 토큰 `cf-turnstile-response` 와, 폼을 열 때 만든 `idempotencyKey`.
- 설정: `lib/launch/support.ts` 에서 첫 응답 약속(`responseTime`), 접수 확인 메일(`receipt`), 사람이 읽는 문의 메일 주소(`email`)를 정한다. 지킬 수 있는 응답 시간만 적는다(없으면 null). 접수 확인 메일은 방문자가 적은 주소로 나가므로 요청 제한과 Turnstile 이 남용을 막는 유일한 장치다.
- 설정: `vercel.json` 에 `/api/cron/inquiry` Cron 을 더한다(저장소 안내의 스케줄은 하루 한 번). 일반 문의는 30일, 불만·분쟁 문의는 3년 보유 뒤 이 Cron 이 파기한다. `CRON_SECRET` 이 없으면 Cron 경로는 401 이다.
- 설정: 데이터베이스 마이그레이션을 한 번 돌린다(`DATABASE_URL` 은 직접 연결 주소로 `node db/migrate.mjs`).
- 확인: 배포 환경에서 문의 쪽에 폼이 그려지는지(`data-inquiry="enabled"`) → 시험 문의 하나 보내기 → 대표 메일에 알림 도착 → (접수 확인 메일을 켰다면) 폼에 적은 주소로 확인 메일 도착.
- 막힘: 폼 대신 안내만 보임 → live 에서 `INQUIRY_OWNER_EMAIL` 이 없어서 문의 창구만 꺼진 것이다(사이트는 켜진다, 접수는 거절되고 받은 척 저장하지 않는다. 쪽의 `data-inquiry` 표지가 `disabled`). 접수가 거절됨 → Turnstile 토큰 또는 요청 제한 확인. 알림 메일이 안 옴 → 메일 장의 `EMAIL_FROM` 인증 상태와 스팸함. 같은 요청이 두 번 저장됨 → 폼을 열 때 `idempotencyKey` 를 만드는지 확인.
- 출처: 저장소만 읽었다 — `.env.example`, `features/outcomes.yaml`, `registry/feature-inquiry` 의 설치 안내와 `support.ts`. 외부 서비스 문서는 이 장에서 읽지 않았다(외부 등록 없음).

---

# Expert runbook — inquiry intake

*Source of content for the plugin runbook feature. Expert version: use as is. Beginner version: expand each item.*

- For: sites that take visitor inquiries, store them, and email the owner. The part is `inquiry` (registry `feature-inquiry`). No new outside account is needed; it uses the email (`G-email`) and database (`G-db`) setup.
- Never put a key or secret in chat, the repository or logs. Use the host dashboard or `vercel env add <NAME>` (stdin).
- With `LF_MODE=mock` (default) it starts with a fake address even without `INQUIRY_OWNER_EMAIL`. Set it only to receive real alerts.

## G-inquiry

- Why: to save the inquiries from the form in the database and tell the owner by email, you need an address to notify and email sending (`G-email`) and the database (`G-db`) already working.
- What you need: the owner's email address for alerts (personal data, so not in the repository), finished `G-db` and `G-email`, the host's environment variable screen.
- Register: nothing. No new outside account. The bot-protection keys (`TURNSTILE_SECRET_KEY`, `TURNSTILE_SITE_KEY`) are the ones made in the security chapter `G-security`.
- Config: in the host environment (dashboard or `vercel env add <NAME>` stdin) set `INQUIRY_OWNER_EMAIL` (the owner address for alerts; a non-email value stops boot). Do not substitute `LF_BUSINESS_EMAIL` — that is the display address published in the footer. Reuse the values already set: database `DATABASE_URL`, bot protection `TURNSTILE_SECRET_KEY` and `TURNSTILE_SITE_KEY`, Cron `CRON_SECRET`, mail `RESEND_API_KEY` and `EMAIL_FROM`, and `BETTER_AUTH_SECRET` because the auth item is installed with it.
- Config: the inquiry form needs two hidden inputs — the Turnstile token `cf-turnstile-response` and an `idempotencyKey` made when the form opens.
- Config: in `lib/launch/support.ts` set the first-response promise (`responseTime`), the receipt mail (`receipt`) and the human-readable inquiry address (`email`). Promise only a response time you can keep (null if none). The receipt mail goes to the address the visitor typed, so rate limiting and Turnstile are the only guard against abuse.
- Config: add the `/api/cron/inquiry` Cron to `vercel.json` (the repository note uses a daily schedule). Ordinary inquiries are kept 30 days and complaint or dispute inquiries 3 years, then this Cron purges them. Without `CRON_SECRET` the Cron route returns 401.
- Config: run the database migration once (`node db/migrate.mjs` with the direct-connection `DATABASE_URL`).
- Check: on the deployed site the contact page draws the form (`data-inquiry="enabled"`) → send one test inquiry → the alert arrives at the owner address → (if the receipt mail is on) a confirmation arrives at the address typed in the form.
- Stuck: only a notice instead of the form → in live `INQUIRY_OWNER_EMAIL` is missing, so only the inquiry desk is off (the site still runs; intake is refused and nothing is saved as if received; the page's `data-inquiry` marker is `disabled`). Intake refused → check the Turnstile token or the rate limit. No alert mail → check `EMAIL_FROM` verification in the email chapter, and the spam folder. The same request saved twice → check that the form makes an `idempotencyKey` when it opens.
- Sources: this repository only — `.env.example`, `features/outcomes.yaml`, the install notes and `support.ts` of `registry/feature-inquiry`. No outside service docs were read for this chapter (nothing to register).
