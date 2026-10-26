# 운영 런북(전문가용) — 방문자 통계 (PostHog)

*Expert runbook: visitor analytics with PostHog. English follows the Korean part.*

- 대상: 방문자 수와 많이 본 쪽을 보기로 정한 사이트 운영자. 모듈은 그대로 두고 계정·키는 운영자가 직접 만든다.
- 용도: 플러그인 런북 기능의 **내용 원천**이다. 화면 이름·주소·경로는 깊이 적지 않는다(버전마다 다르다).
- 장 id: `G-analytics` (`features/outcomes.yaml` guides 열과 같다). 보안 장(`G-security`)의 봇 확인·Cron 비밀은 이 부품의 성과에도 함께 붙는다.
- 값(키·비밀·번호)은 채팅·저장소·로그에 쓰지 않는다. `vercel env add <이름>` 표준 입력이나 호스팅 대시보드에 직접 넣는다.

## G-analytics — 방문자 통계 (PostHog)

- 왜: 방문자 수와 많이 본 쪽을 보려면 PostHog 프로젝트가 하나 있어야 하고, 사이트는 그 프로젝트의 공개 키와 수집 호스트를 알아야 한다.
- 준비물: 이메일로 만든 PostHog 계정(없으면 가입), 호스팅 환경 변수 화면(`G-hosting`).
- 등록 1 — PostHog 계정과 프로젝트 하나. **가입할 때 클라우드 지역(US 또는 EU)을 고른다.** 지역마다 따로 가입하는 별도 클라우드다(EU 는 별도 주소에서 가입). 만든 뒤 지역을 직접 바꾸는 화면은 문서에서 확인하지 못했다. 미국 클라우드에서 유럽 클라우드로 옮기려면 앱 안에서 지원 요청을 해야 하고, 일부 유료 요금제만 받는다. PostHog 는 GDPR 을 중요하게 보면 EU 클라우드(프랑크푸르트 서버)를 권한다. 한국 사이트라면 어느 지역이든 국외 이전이다 — 고지 표는 키트가 `POSTHOG_HOST` 의 지역으로 만든다.
- 등록 2 — 프로젝트 토큰(공개 프로젝트 키, `phc_` 로 시작)을 프로젝트 설정 화면에서 확인한다 → `POSTHOG_PROJECT_KEY`. 브라우저에 실리는 공개 값이다.
- 등록 3 — (선택, 계정 삭제 기능이 있는 사이트만) 프로젝트 설정의 개인 API 키 칸에서 키를 하나 만든다. 이름을 붙이고 `person:write` 범위를 준다. 만든 뒤 다시 볼 수 없으니 바로 호스팅 환경 변수에 넣는다 → `POSTHOG_PERSONAL_API_KEY`. 프로젝트 숫자 id 는 프로젝트 설정이나 주소창에서 읽는다 → `POSTHOG_PROJECT_ID`.
- 설정: `POSTHOG_HOST` — 수집 호스트. US `https://us.i.posthog.com`, EU `https://eu.i.posthog.com`. 앱 화면 호스트(`us.posthog.com`·`eu.posthog.com`)를 넣어도 키트가 수집 호스트로 맞춘다. 프록시처럼 지역을 못 정하는 주소나 `http://` 이면 켜질 때 멈춘다.
- 설정: `POSTHOG_PROJECT_KEY` 와 `POSTHOG_HOST` **둘 다** 있어야 분석이 켜진다. 하나라도 없으면 분석만 꺼진다 — 분석 스크립트·동의 띠·「쿠키 설정」 링크·서버 계측이 사라지고 사이트는 그대로 켜진다. 키에 공백이 섞이면 켜질 때 멈춘다.
- 설정: 세 이름을 헷갈리지 않는다.

| 이름 | 무엇 | 비밀 | 어디에 |
|---|---|---|---|
| `POSTHOG_PROJECT_KEY` | 프로젝트 토큰(공개 키) | 아니오(브라우저에 실린다) | 분석 켜기 |
| `POSTHOG_PERSONAL_API_KEY` | 개인 API 키(프로젝트 토큰과 다르다) | **예** | 탈퇴자 데이터 지움, 서버 전용 |
| `POSTHOG_PROJECT_ID` | 프로젝트 숫자 id | 아니오 | 탈퇴자 데이터 지움 |

- 설정: 값은 호스팅 대시보드나 `vercel env add <이름>`(표준 입력)으로 넣는다. 환경 변수를 바꾸면 이미 있는 배포에는 적용되지 않고 새 배포부터 적용된다.
- 동의: 방문자가 분석에 동의하기 전에는 아무것도 보내지 않는다. 브라우저에서는 동의 전에 분석 라이브러리를 불러오지도 않고, 서버 이벤트도 동의가 참일 때만 나간다. 동의 띠는 분석이 켜졌을 때만 그려진다. 이 동의는 분석 쿠키 동의이고, 마케팅 메일 수신 동의(`G-consent`)와 별개다.
- 탈퇴 지움: 계정 삭제 기능이 있고 분석이 켜져 있으면 파기 Cron 이 PostHog 의 사람·이벤트·녹화를 지운다. 이때 `POSTHOG_HOST` · `POSTHOG_PERSONAL_API_KEY` · `POSTHOG_PROJECT_ID` 가 모두 있어야 한다. 분석을 켰는데 뒤의 둘이 없으면 지움 단계가 실패로 남고 계속 다시 시도한다(DB 파기는 그대로 돈다). PostHog 쪽 삭제는 배경에서 처리된다.
- 확인: `npm run env:check -- --vercel` 경고 없음 → 새로 배포 → 사이트에 동의 띠가 나옴 → 허용 → PostHog 프로젝트의 이벤트 화면에 방문 기록이 보임. 허용 전에는 PostHog 로 가는 요청이 없는지 브라우저 개발자 도구의 네트워크 탭으로 본다.
- 막힘: 동의 띠가 안 나온다 → `POSTHOG_HOST` 나 `POSTHOG_PROJECT_KEY` 가 배포에 없다(분석이 꺼진 것). 환경 변수를 넣은 뒤 새로 배포했는지 본다.
- 막힘: 이벤트가 안 보인다 → 동의 전에는 0건이 정상이다. 동의했는데도 없으면 호스트의 지역이 프로젝트를 만든 지역과 같은지 본다(지역마다 별도 클라우드다).
- 막힘: 앱이 켜질 때 멈춘다 → `POSTHOG_HOST` 가 `https://` 가 아니거나 프록시 주소, 또는 `POSTHOG_PROJECT_KEY` 에 공백이 섞였다.
- 막힘: 탈퇴 파기 Cron 의 분석 지움이 실패로 남는다 → `POSTHOG_PERSONAL_API_KEY` 나 `POSTHOG_PROJECT_ID` 가 비었거나, 키가 개인 API 키가 아니라 프로젝트 토큰이다.
- 출처: PostHog 공식 문서 — 데이터 저장·개인정보 안내, GDPR 안내, 제품 분석 시작·가격 안내(무료 구간과 사용량 과금 구조), 라이브러리 설치 안내(프로젝트 토큰과 호스트), 마이그레이션 가이드의 개인 API 키·프로젝트 id 얻는 법(posthog.com). Vercel 환경 변수 문서(vercel.com). 이 저장소의 `.env.example`.

---

# Expert runbook — visitor analytics with PostHog

*Source of content for the plugin runbook feature. Expert version: use as is. Beginner version: expand each item. Screen names, URLs and paths are deliberately not recorded in detail (they change per version).*

Never put a key, secret or number in chat, the repository or logs. Use `vercel env add <NAME>` (stdin) or the host dashboard.

## G-analytics

- Why: to see visitor counts and the most viewed pages you need a PostHog project, and the site must know that project's public key and collection host.
- You need: a PostHog account (sign up if you have none) and the host's environment variables screen (`G-hosting`).
- Register 1 — a PostHog account and one project. **You choose the cloud region (US or EU) when you sign up.** Each region is a separate cloud (EU signs up at its own address). We did not find a screen to change the region yourself. Moving from US Cloud to EU Cloud needs a support request inside the app, and only some paid plans get it. PostHog recommends EU Cloud (servers in Frankfurt) if GDPR matters to you. For a Korean site either region is a transfer abroad — the kit builds the notice table from the region of `POSTHOG_HOST`.
- Register 2 — find the project token (the public project key, starts with `phc_`) in the project settings → `POSTHOG_PROJECT_KEY`. It is public; it is sent to the browser.
- Register 3 — (optional, only for sites with account deletion) create a personal API key in the project settings. Give it a label and the `person:write` scope. You cannot see it again after creating it, so put it into the host environment variables right away → `POSTHOG_PERSONAL_API_KEY`. Read the numeric project id from the project settings or the address bar → `POSTHOG_PROJECT_ID`.
- Config: `POSTHOG_HOST` — the collection host. US `https://us.i.posthog.com`, EU `https://eu.i.posthog.com`. If you enter an app host (`us.posthog.com`, `eu.posthog.com`) the kit corrects it to the collection host. An address whose region cannot be told (such as a proxy) or `http://` stops the app at start.
- Config: analytics turns on only when **both** `POSTHOG_PROJECT_KEY` and `POSTHOG_HOST` are set. If either is missing only analytics turns off — the analytics script, the consent banner, the "Cookie settings" link and server tracking disappear and the site still runs. A key with whitespace in it stops the app at start.
- Config: keep the three names apart.

| Name | What | Secret | Used for |
|---|---|---|---|
| `POSTHOG_PROJECT_KEY` | project token (public key) | no (sent to the browser) | turning analytics on |
| `POSTHOG_PERSONAL_API_KEY` | personal API key (not the project token) | **yes** | deleting a deleted user's data, server only |
| `POSTHOG_PROJECT_ID` | numeric project id | no | deleting a deleted user's data |

- Config: set values in the host dashboard or with `vercel env add <NAME>` (stdin). A changed environment variable does not apply to existing deployments, only to new ones.
- Consent: nothing is sent before the visitor agrees to analytics. In the browser the analytics library is not even loaded before consent, and server events go out only when consent is true. The consent banner is drawn only when analytics is on. This is analytics cookie consent; it is separate from marketing email consent (`G-consent`).
- Deleted users: when the site has account deletion and analytics is on, the purge Cron deletes the person, events and recordings in PostHog. For that `POSTHOG_HOST`, `POSTHOG_PERSONAL_API_KEY` and `POSTHOG_PROJECT_ID` must all be set. With analytics on and the last two missing, the deletion step stays as a failure and is retried (the database purge still runs). PostHog processes the deletion in the background.
- Check: `npm run env:check -- --vercel` shows no warning → deploy again → the consent banner appears → allow → visits show up in the project's events screen. Before allowing, look in the browser developer tools network tab to see that no request goes to PostHog.
- Stuck: no consent banner → `POSTHOG_HOST` or `POSTHOG_PROJECT_KEY` is missing from the deployment (analytics is off). Check that you deployed again after setting them.
- Stuck: no events → zero before consent is normal. If you allowed and still see none, check that the host region is the region where you created the project (each region is a separate cloud).
- Stuck: the app stops at start → `POSTHOG_HOST` is not `https://` or is a proxy address, or `POSTHOG_PROJECT_KEY` has whitespace in it.
- Stuck: the purge Cron's analytics deletion stays failed → `POSTHOG_PERSONAL_API_KEY` or `POSTHOG_PROJECT_ID` is empty, or the key is the project token instead of a personal API key.
- Sources: PostHog official docs — data storage and privacy, GDPR guide, product analytics start and pricing pages (free allowance and usage-based billing structure), library install guides (project token and host), migration guide on getting a personal API key and project id (posthog.com). Vercel environment variables docs (vercel.com). This repository's `.env.example`.
