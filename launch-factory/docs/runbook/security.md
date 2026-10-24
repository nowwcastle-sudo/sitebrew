# 운영 런북(전문가용) — 보안 보호 (요청 제한 · 봇 확인 · Cron 비밀)

*Expert runbook: request limits, bot check and the Cron secret. English follows the Korean part.*

- 대상: 가입·문의 같은 공개 폼이나 Cron 을 쓰는 사이트 운영자. 거의 모든 기능 장이 이 장의 값(`TURNSTILE_SITE_KEY` · `TURNSTILE_SECRET_KEY` · `CRON_SECRET`)을 함께 쓴다.
- 용도: 플러그인 런북 기능의 **내용 원천**이다. 화면 이름·주소·경로는 깊이 적지 않는다(버전마다 다르다).
- 장 id: `G-security` (`features/outcomes.yaml` guides 열과 같다).
- 값(키·비밀)은 채팅·저장소·로그에 쓰지 않는다. `vercel env add <이름>` 표준 입력이나 호스팅 대시보드에 직접 넣는다.

## G-security — 요청 제한 · 봇 확인 · Cron 비밀

- 왜: 공개 폼이 봇과 반복 요청에 뚫리지 않게 하고, Cron 경로를 아무나 부르지 못하게 하려고 봇 확인 키 한 쌍과 Cron 비밀 하나를 정한다.
- 준비물: 환경 변수를 넣을 호스팅 화면(`G-hosting`), 요청 제한 기록을 저장할 DB 연결 `DATABASE_URL`(값은 `G-db` 에서 정한다), Cloudflare 계정.
- 등록 1 — Cloudflare 계정을 만든다(이미 있으면 그대로). Turnstile 은 Cloudflare 대시보드 안의 서비스다. 무료 플랜은 검증 요청이 무제한이고 위젯 수와 위젯당 호스트 수에 한도가 있다.
- 등록 2 — Turnstile 위젯을 하나 만든다. 이름, 위젯을 쓸 호스트(사이트 도메인), 위젯 모드(Managed · Non-Interactive · Invisible 중 하나)를 정한다. 호스트는 도메인 이름만 쓴다 — 스킴·포트·경로·와일드카드는 받지 않고, 루트 도메인을 적으면 그 하위 도메인도 포함된다. 만들고 나면 사이트 키와 비밀 키가 나온다 → `TURNSTILE_SITE_KEY`(공개) · `TURNSTILE_SECRET_KEY`(비밀, 안전하게 보관).
- 설정: `TURNSTILE_SITE_KEY` — 위젯을 그릴 때 쓰는 공개 값. live 에서 필수다.
- 설정: `TURNSTILE_SECRET_KEY` — 서버가 토큰을 검증할 때 쓰는 비밀. live 에서 필수이고 없으면 만들 때 던진다. 브라우저에 보내지 않는다. 개발 mock 에서는 키 없이 통과한다.
- 설정: 위젯은 폼 안에 숨은 입력 `cf-turnstile-response` 를 넣고 토큰을 서버가 검증한다. 토큰은 만든 뒤 5분 안에 한 번만 검증된다. 사용자가 늦게 제출하면 위젯을 새로 고쳐야 한다. 서버 검증은 키트가 한다.
- 설정: `CRON_SECRET` — 값은 16자 이상의 무작위 문자열로 직접 만든다(Vercel 은 비밀번호 생성기를 권한다). 호스팅 프로젝트의 환경 변수 `CRON_SECRET` 으로 넣으면 Vercel 이 Cron 을 부를 때 `Authorization` 머리에 `Bearer` 와 함께 자동으로 붙인다. 키트의 Cron 경로는 이 값이 없거나 다르면 401 로 거절하고, 값이 없을 때 열어 두지 않는다. 값은 채팅에 쓰지 않는다.
- 설정: 환경 변수를 바꾸면 이미 있는 배포에는 적용되지 않고 새 배포부터 적용된다. Turnstile 비밀 키를 바꿀 때는 Cloudflare 가 두 시간 동안 옛 키와 새 키를 둘 다 받아 주니 그 사이에 바꾼다.
- 설정: 요청 제한은 경로 이름별 규칙이다(기본 `signUp` · `signIn` · `passwordReset` · `inquiry` · `checkoutStart`). 한도를 넘으면 429 와 `Retry-After` 로 답한다. 새 경로는 규칙을 더해야 하고, 규칙 없는 이름은 던진다(한도 없이 통과하지 않는다). 폼을 두 번 보내도 한 번만 처리하는 멱등 키 표도 같은 DB 를 쓴다.
- 설정: 정리 Cron `/api/cron/security`(하루 한 번, 템플릿 `vercel.json` 에 이미 있다)가 지난 제한 기록과 멱등 키를 지운다. 이 Cron 도 `CRON_SECRET` 이 없으면 401 이다.
- 설정: 요청 제한은 요청 머리의 IP 로 센다. 기본은 어떤 머리도 믿지 않아서 IP 를 못 찾으면 경로마다 공용 통 하나로 센다(정상 방문자도 함께 막힐 수 있다). Vercel 에서는 자동으로 알맞은 머리를 믿는다. 다른 호스트라면 신뢰 프록시 종류, 앞단이 덮어쓰는 클라이언트 IP 머리 하나, 프록시 주소 중 하나를 환경 변수로 정한다 — 이름은 보안 항목 설치 안내 7번에 있다.
- 확인: `npm run env:check -- --vercel` 경고 없음 → 새로 배포 → 가입이나 문의 폼에 위젯이 보임 → 제출이 통과함. Cron 은 `curl -H "Authorization: Bearer $CRON_SECRET" https://<사이트>/api/cron/security` 가 200, 머리 없이 부르면 401.
- 막힘: 폼이 봇 확인 실패로 거절한다 → 토큰이 5분 지났거나 이미 한 번 검증된 토큰이다(`timeout-or-duplicate`). 위젯을 새로 고쳐 다시 제출한다.
- 막힘: 위젯이 안 뜨거나 거절된다 → 위젯의 호스트 목록에 사이트 도메인(미리보기 배포의 도메인 포함)이 없다. 목록을 고친다. 템플릿은 Turnstile 에 필요한 CSP 출처를 이미 넣어 두었다.
- 막힘: 모든 Cron 이 401 → 배포에 `CRON_SECRET` 이 없다. 넣은 뒤 새로 배포한다.
- 막힘: 정상 방문자가 429 를 만난다 → IP 를 못 찾아 공용 통으로 세는 중일 수 있다. Vercel 이 아닌 호스트라면 위의 IP 설정을 본다.
- 출처: Cloudflare Turnstile 공식 문서 — 위젯 만들기, 호스트 관리, 클라이언트 렌더링, 서버 검증(siteverify), 비밀 키 교체, 플랜 안내(developers.cloudflare.com). Vercel 문서 — Cron 보안(`CRON_SECRET`), 환경 변수(vercel.com). 이 저장소의 `.env.example`과 보안 항목 설치 안내.

---

# Expert runbook — request limits, bot check and the Cron secret

*Source of content for the plugin runbook feature. Expert version: use as is. Beginner version: expand each item. Screen names, URLs and paths are deliberately not recorded in detail (they change per version).*

Never put a key or secret in chat, the repository or logs. Use `vercel env add <NAME>` (stdin) or the host dashboard.

## G-security

- Why: to keep public forms from bots and repeated requests, and to keep anyone from calling Cron paths, you set one bot-check key pair and one Cron secret.
- You need: the host screen for environment variables (`G-hosting`), the database connection `DATABASE_URL` that stores request-limit records (its value is set in `G-db`), and a Cloudflare account.
- Register 1 — create a Cloudflare account (use yours if you have one). Turnstile is a service inside the Cloudflare dashboard. The free plan has unlimited verification requests and limits on the number of widgets and hostnames per widget.
- Register 2 — create one Turnstile widget. Choose a name, the hostnames where the widget will be used (your site domain) and a widget mode (Managed, Non-Interactive or Invisible). Write hostnames as plain domain names — schemes, ports, paths and wildcards are not accepted, and a root domain also covers its subdomains. After creating it you get a site key and a secret key → `TURNSTILE_SITE_KEY` (public) and `TURNSTILE_SECRET_KEY` (secret, store it safely).
- Config: `TURNSTILE_SITE_KEY` — the public value used to draw the widget. Required in live.
- Config: `TURNSTILE_SECRET_KEY` — the secret the server uses to verify tokens. Required in live; without it the app throws when it builds the checker. Never send it to the browser. In development mock it passes without a key.
- Config: the widget puts a hidden input `cf-turnstile-response` into the form and the server verifies the token. A token is verified once, within 5 minutes of being made. If a user submits late, the widget must be refreshed. The kit does the server check.
- Config: `CRON_SECRET` — make the value yourself as a random string of at least 16 characters (Vercel suggests a password generator). Put it in the hosting project's environment variables as `CRON_SECRET`; when Vercel calls a Cron it adds the value automatically in the `Authorization` header with `Bearer`. The kit's Cron paths reject a missing or different value with 401, and never stay open when the value is missing. Do not write the value in chat.
- Config: a changed environment variable does not apply to existing deployments, only to new ones. When you rotate the Turnstile secret key, Cloudflare accepts both the old and new key for two hours, so swap it within that time.
- Config: request limits are rules per route name (by default `signUp`, `signIn`, `passwordReset`, `inquiry`, `checkoutStart`). Over the limit it answers 429 with `Retry-After`. A new route needs a rule added, and a name without a rule throws (it never passes without a limit). The idempotency-key table, which makes a form sent twice count once, uses the same database.
- Config: the cleanup Cron `/api/cron/security` (once a day; the template `vercel.json` already has it) deletes old limit records and idempotency keys. It also returns 401 without `CRON_SECRET`.
- Config: request limits count by the IP in request headers. By default no header is trusted, so if the IP cannot be found it counts in one shared bucket per route (normal visitors can be blocked together). On Vercel the right header is trusted automatically. On another host, set through environment variables the kind of trusted proxy, one client-IP header that your front layer overwrites, or the proxy addresses — the names are in install note 7 of the security item.
- Check: `npm run env:check -- --vercel` shows no warning → deploy again → the widget shows on the sign-up or inquiry form → submit passes. For Cron, `curl -H "Authorization: Bearer $CRON_SECRET" https://<site>/api/cron/security` returns 200, and without the header it returns 401.
- Stuck: the form is rejected for a failed bot check → the token is older than 5 minutes or was already verified once (`timeout-or-duplicate`). Refresh the widget and submit again.
- Stuck: the widget does not show or is refused → the widget's hostname list lacks your site domain (including the domain of preview deployments). Fix the list. The template already includes the CSP sources Turnstile needs.
- Stuck: every Cron returns 401 → the deployment has no `CRON_SECRET`. Set it and deploy again.
- Stuck: normal visitors get 429 → the IP may not be found, so counting is in the shared bucket. On a host other than Vercel, see the IP settings above.
- Sources: Cloudflare Turnstile official docs — creating a widget, hostname management, client-side rendering, server-side validation (siteverify), rotating the secret key, plans (developers.cloudflare.com). Vercel docs — Cron security (`CRON_SECRET`), environment variables (vercel.com). This repository's `.env.example` and the security item's install notes.
