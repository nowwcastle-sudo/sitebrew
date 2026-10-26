# 운영 런북(전문가용) — 마케팅 수신 동의

*Expert runbook: marketing consent. English follows the Korean part.*

- 대상: 광고성 메일(앞으로 문자·카카오·푸시)을 보내기로 정한 사이트 운영자. 외부 서비스에 새로 가입할 것은 없다.
- 용도: 플러그인 런북 기능의 **내용 원천**이다. 이 글은 저장소의 동의 기능이 실제로 하는 일만 적는다. 법률 자문이 아니다 — 법 해석은 전문가에게 확인한다.
- 장 id: `G-consent` (`features/outcomes.yaml` guides 열과 같다).
- 값(키·비밀)은 채팅·저장소·로그에 쓰지 않는다. `vercel env add <이름>` 표준 입력이나 호스팅 대시보드에 직접 넣는다.

## G-consent — 마케팅 수신 동의

- 왜: 광고성 정보는 받는 사람이 미리 동의한 채널로만 보낼 수 있어서, 채널별 동의·철회 이력과 수신거부·2년 재확인을 이 기능이 맡는다.
- 준비물: 로그인(`G-auth`)과 메일(`G-email`)이 먼저 켜져 있어야 한다. 동의 이력은 로그인한 사용자 기준이고, 통지·재확인 메일은 메일 항목으로 나간다. 비밀 값 `CRON_SECRET` 은 `G-security` 에서 만든다.
- 등록: 없음. 새 외부 계정이 필요 없다.
- 설정: 동의 상태는 채널별(이메일·문자·카카오·푸시)이고 기본은 모두 거부다. 사용자가 사람이 확인한 입력으로 바꿀 때만 바뀌며, 바뀔 때마다 이력이 한 줄 남는다. 설정 화면은 제품이 만든다(현재 값 읽기와 바꾸기 서버 액션을 부른다).
- 설정: 사업자 정보 `LF_BUSINESS_NAME` · `LF_BUSINESS_EMAIL` · `LF_BUSINESS_PHONE` · `LF_BUSINESS_ADDRESS` 가 **모두** 있어야 광고성 메일이 만들어진다. 하나라도 비면 광고성 메일은 던지고 나가지 않는다(거래 메일은 영향 없음). 값은 메일 장(`G-email`)에서 정한다.
- 설정: `BETTER_AUTH_SECRET` — 로그인 없이 누르는 수신거부·계속 받기 링크의 서명 비밀을 이 값에서 만든다. 바꾸면 이미 나간 메일의 링크가 열리지 않는다. 값은 인증 장(`G-auth`)에서 정한다.
- 설정: `CRON_SECRET` 과 Cron `/api/cron/consents`(하루 한 번, 템플릿 `vercel.json` 에 이미 있다). 비밀이 없으면 이 경로는 401 이라 2년 재확인 메일이 나가지 않는다.
- 설정: `LF_MARKETING_NIGHT_GUARD` — 비우면 켜져서 한국 시각 21시~다음 날 8시에는 광고성 메일 보내기를 아침으로 미룬다. `off` 로 끈다. 전자우편은 법상 야간 동의 대상이 아니라서, 법이 요구하는 점검이 아니라 보수적인 기본값이다.
- 동작: 광고성 메일은 키트의 광고 메일 보내기 함수로만 보낸다. 보내기 전에 채널 동의·재확인·야간을 점검하고, 메일러가 제목 「(광고)」·전송자 표시·한글·영문 수신거부 안내·로그인 없는 수신거부 링크·`List-Unsubscribe` 머리를 단다. 광고 메일을 보내는 화면과 문구는 제품이 만든다.
- 동작: 수신거부 링크는 누르면 바로 철회하고 이력을 남긴다. 이미 철회한 사람이 다시 누르거나 메일 보안 프로그램이 미리 열어도 통지가 되풀이되지 않는다. 철회한 사람은 「계속 받기」 링크로 되살아나지 않는다 — 다시 동의하려면 설정 화면에서 직접 한다.
- 동작: 동의·거부·철회를 표시할 때마다(같은 값을 다시 표시해도) 그 사람의 메일로 처리 결과 통지가 나간다. 보내기가 실패해도 설정 저장은 되돌리지 않는다. 실패한 통지는 발신함에 남고 알림 Cron 이 간격을 늘려 다시 보낸다. 이메일이 없는 계정(카카오 등)은 통지 메일을 보낼 수 없으니 그런 계정에 마케팅을 켜기 전에 다른 통지 수단을 정한다. 통지에 쓰는 전송자 명칭은 설정 파일의 제품 이름이다 — 법적 상호로 바꾼다.
- 동작: 2년 재확인 — 동의한 지 2년이 지난 이메일 수신자에게 전송자·동의 사실과 날짜·계속 받기/수신거부 링크가 든 메일을 한 통씩 보낸다. 답이 없는 사람에게는 계속 보낸다(규칙에 끊는다는 문구가 없다 — 법무 확인 필요). 재확인 메일을 아직 못 보낸 2년 넘은 동의에는 보내지 않는다.
- 동작: 가입 때의 약관·개인정보·만 14세 동의 기록은 인증 항목이 하고(그 기록은 DB 트리거가 수정과 비우기를 막는다), 이 기능은 그 이력을 이어 쓴다. 개인정보 수집·국외 이전 고지 표의 데이터도 이 기능이 만든다(화면은 제품 몫).
- 확인: 로그인 → 설정 화면에서 이메일 수신 켜기 → 처리 결과 통지 메일 도착 → 메일 안 수신거부 링크를 로그아웃 상태로 열기 → 철회 → 통지 메일 다시 도착. 재확인 Cron 은 `curl -H "Authorization: Bearer $CRON_SECRET" https://<사이트>/api/cron/consents` 로 한 번 불러 건수 응답(보낼 것·보냄·건너뜀·실패)을 본다.
- 막힘: 광고 메일이 안 나간다 → 이유를 본다. 동의 없음 · 재확인 대기(2년 넘었는데 재확인 메일 전) · 야간(다시 시도할 시각이 같이 온다). 사업자 정보가 비었으면 이유가 아니라 오류로 던진다.
- 막힘: 통지 메일이 안 온다 → 메일 항목(`G-email`) 설정을 본다. 이메일이 없는 계정이면 보낼 수 없다.
- 막힘: 재확인 Cron 이 401 → 배포에 `CRON_SECRET` 이 없다. 환경 변수는 새 배포부터 적용된다.
- 막힘: 수신거부 링크가 안 열린다 → 링크를 만든 뒤 `BETTER_AUTH_SECRET` 을 바꿨다.
- 출처: 이 저장소의 동의 기능(패키지와 설치 안내)·`.env.example`. 법 근거는 저장소의 법무 메모를 따르며 이 글은 확인하지 않았다 [확인 안 됨]. Vercel Cron 보안 문서(vercel.com).

---

# Expert runbook — marketing consent

*Source of content for the plugin runbook feature. This text records only what the repository's consent feature actually does. It is not legal advice — check legal interpretation with a professional.*

Never put a key or secret in chat, the repository or logs. Use `vercel env add <NAME>` (stdin) or the host dashboard.

## G-consent

- Why: marketing messages may only go to people who agreed in advance on that channel, so this feature keeps per-channel consent and withdrawal history, unsubscribe, and the two-year re-confirmation.
- You need: sign-in (`G-auth`) and email (`G-email`) already on. Consent history is per signed-in user, and notice and re-confirmation mails go through the email item. The secret `CRON_SECRET` is made in `G-security`.
- Register: nothing. No new outside account.
- Config: consent is per channel (email, text, Kakao, push) and every channel defaults to refused. It changes only on an input a person confirmed, and each change adds one history line. The settings screen is the product's job (it calls the read and change server actions).
- Config: the business details `LF_BUSINESS_NAME`, `LF_BUSINESS_EMAIL`, `LF_BUSINESS_PHONE` and `LF_BUSINESS_ADDRESS` must **all** be set for a marketing mail to be built. If any is empty the marketing mail throws and is not sent (transactional mail is not affected). Set the values in the email chapter (`G-email`).
- Config: `BETTER_AUTH_SECRET` — the signing secret of the sign-in-free unsubscribe and keep links is derived from it. If you change it, links in mails already sent stop opening. Set the value in the sign-in chapter (`G-auth`).
- Config: `CRON_SECRET` and the Cron `/api/cron/consents` (once a day; the template `vercel.json` already has it). Without the secret this path returns 401, so the two-year re-confirmation mail is never sent.
- Config: `LF_MARKETING_NIGHT_GUARD` — when empty it is on: at 21:00–08:00 Korean time marketing mail waits until the morning. Set `off` to turn it off. Email is not subject to the night-time consent rule by law, so this is a cautious default, not a legal requirement.
- Behavior: marketing mail goes only through the kit's marketing-mail function. Before sending it checks channel consent, re-confirmation and night time, and the mailer adds the "(광고)" subject mark, the sender details, Korean and English unsubscribe text, a sign-in-free unsubscribe link and the `List-Unsubscribe` header. The screen and wording for sending marketing mail are the product's job.
- Behavior: the unsubscribe link withdraws at once and writes history. Opening it again, or a mail security tool pre-opening it, does not repeat the notice. A person who withdrew is not revived by the keep link — to consent again they do it themselves on the settings screen.
- Behavior: every time consent, refusal or withdrawal is recorded (even the same value again) a result notice goes to that person's email. If sending fails the setting is still saved; the failed notice stays in an outbox and a notices Cron retries with growing gaps. An account with no email (for example Kakao) cannot get a notice mail, so decide another way to notify before turning marketing on for such accounts. The sender name in the notice is the product name in the config file — change it to the legal business name.
- Behavior: two-year re-confirmation — to email recipients whose consent is older than two years, one mail each with the sender, the fact and date of consent, and keep/unsubscribe links. People who do not answer keep getting mail (the rule has no wording about stopping — legal review needed). Consent older than two years whose re-confirmation mail has not been sent yet gets no marketing mail.
- Behavior: the sign-up records (terms, privacy, age 14) belong to the sign-in item (a database trigger blocks updating and truncating them); this feature continues that history. It also builds the data for the personal-data collection and transfer-abroad notice tables (the screen is the product's job).
- Check: sign in → turn on email on the settings screen → the result notice mail arrives → open the unsubscribe link in the mail while signed out → withdrawn → the notice mail arrives again. Call the re-confirmation Cron once with `curl -H "Authorization: Bearer $CRON_SECRET" https://<site>/api/cron/consents` and read the count response (due, sent, skipped, failed).
- Stuck: marketing mail does not go out → read the reason. No consent · re-confirmation pending (older than two years, mail not yet sent) · night (a retry time comes with it). Empty business details throw an error instead of a reason.
- Stuck: no notice mail → check the email setup (`G-email`). An account without email cannot receive it.
- Stuck: the re-confirmation Cron returns 401 → the deployment has no `CRON_SECRET`. Environment variables apply from the next deployment.
- Stuck: unsubscribe links do not open → `BETTER_AUTH_SECRET` was changed after the links were made.
- Sources: this repository's consent feature (package and install notes) and `.env.example`. The legal basis follows the repository's legal memo and was not checked here [not verified]. Vercel Cron security docs (vercel.com).
