# 운영 런북(전문가용) — 호스팅

*Expert runbook: hosting. English follows the Korean part.*

- 확인일: 2026-10-22. 외부 서비스 화면은 바뀐다. 90일이 지나면 다시 확인한다.
- 대상: 사이트를 인터넷에 올려 진짜 주소를 얻으려는 운영자. 모든 사이트가 이 장부터 읽는다.
- 용도: 플러그인 런북 기능의 **내용 원천**이다. 전문가용은 이 글을 그대로 쓰고, 초보자용은 이 글의 항목을 풀어 쓴다. 화면 이름·주소·경로는 깊이 적지 않는다(버전마다 다르다).
- 장 id: `G-hosting` (`need: always`).
- 값(키·비밀·번호)은 채팅·저장소·로그에 쓰지 않는다. `vercel env add <이름>` 표준 입력이나 호스팅 대시보드에 직접 넣는다.

## G-hosting — 호스팅 (Vercel)

- 왜: 사이트를 인터넷에 올려 **진짜 주소**를 얻는 장이다. 도메인·로그인·결제·메일 장이 모두 이 주소를 쓴다.
- 준비물: 사이트 코드가 든 폴더(또는 저장소), Vercel 에 가입할 이메일.
- 등록 1 — Vercel 계정을 만든다. 무료 플랜(Hobby)은 개인·비상업 용도로 정해져 있다. 결제·판매를 받는 사이트는 상업 용도라 유료 플랜이 맞다.
- 설정: Vercel 에 새 프로젝트를 만들고(새 프로젝트나 만들기처럼 보이는 버튼) 사이트 코드를 연결한다. 코드가 저장소의 하위 폴더에 있으면 프로젝트의 루트 폴더 설정을 그 폴더로 맞춘다. 함수 지역은 코드의 `vercel.json` 이 정한다(서울).
- 설정: 환경 변수 `LF_MODE` 를 `live` 로 넣는다. 운영 실행(Vercel 배포)에서 `mock` 이면 서버가 켜질 때 멈춘다. 비어 있어도 멈춘다.
- 설정: 환경 변수 `CRON_SECRET` 을 넣는다. 예측하기 어려운 긴 값(16자 이상)을 직접 만들어 대시보드나 `vercel env add CRON_SECRET` 표준 입력으로만 넣는다. 정기 실행(Cron)이 이 값을 Authorization 머리로 붙여 부르고, 값이 없으면 정기 실행 경로는 401 이다.
- 설정: 첫 배포를 한다. 새 프로젝트의 **첫 배포는 늘 Production 환경**이 된다(Preview 로 올리려 해도). 끝나면 배포 주소가 나온다 — 이것이 **진짜 주소**다.
- 설정: 환경 변수 `NEXT_PUBLIC_APP_URL` 에 그 주소(`https://` 로 시작, 경로 없이)를 넣고 **다시 배포**한다. 앱 주소는 쿠키·로그인 콜백·메일 링크의 기준이다. 환경 변수는 바꾼 뒤 **새로 만든 배포부터** 적용된다(이미 올라간 배포는 그대로).
- 환경 구분: Vercel 의 환경 변수는 Production·Preview·Development 로 따로 넣는다. 실제 손님이 쓰는 값은 Production 에 넣는다. Preview 주소에는 Vercel 로그인 보호가 걸려 있을 수 있어(프로젝트 설정에 따라 다르다) 외부 서비스의 웹훅이 막힌다 — 웹훅·결제 완료 알림은 Production 주소로 받는다.
- 다른 키(DB·로그인·메일·결제 등)는 각 기능의 장에서 같은 방식(대시보드 또는 표준 입력)으로 넣는다.
- 확인: 배포 상태가 정상(Ready)이다. 주소를 열면 사이트가 보이거나, 아직 다른 장의 이름이 없으면 오류 화면이다 — 오류 화면은 정상이다. 서버는 켜질 때 빠진 환경 변수 **이름**을 한 번에 로그에 남긴다(값은 남기지 않는다). 사이트 폴더에서 `npm run env:check -- --vercel production` 은 Production 에 있는 이름과 필수 이름을 견준다(값은 읽지 않는다). Vercel CLI 가 없거나 로그인·프로젝트 연결이 없으면 이 점검은 건너뛴다.
- 막힘 1 — 배포가 실패하고 Cron 이야기가 나온다: 무료 플랜(Hobby)의 Cron 은 하루에 한 번까지만 돌게 할 수 있다. 이 키트의 `vercel.json` 에는 한 시간·30분·10분마다 도는 Cron 이 있어 Hobby 에서는 배포가 거절된다. 유료 플랜으로 올리거나 Cron 을 하루 한 번 이하로 줄여야 하는데, 줄이면 그 기능(예약 안내·결제 상태 맞추기 등)이 늦어진다.
- 막힘 2 — 주소를 열면 오류 화면이다: 로그에서 빠진 이름을 읽고 그 이름을 넣은 뒤 다시 배포한다. 값은 로그에 나오지 않는다.
- 막힘 3 — 변수를 넣었는데 그대로다: 변수 변경은 새 배포부터 적용된다. 다시 배포한다.
- 막힘 4 — 주소가 Vercel 로그인 화면으로 간다: Preview 주소에 걸린 로그인 보호일 수 있다. 손님에게 보일 주소는 Production 주소다.
- 출처: Vercel 문서 — 환경 변수, 환경(Production·Preview·첫 배포), Cron 사용량과 플랜 한도, Hobby 플랜과 공정 사용 안내, `vercel env` 명령. 이 저장소의 `.env.example`, `template/vercel.json`, `scripts/env-check.mjs`.

---

# Expert runbook — hosting

*Source of content for the plugin runbook feature. Expert version: use as is. Beginner version: expand each item. Exact screen names, URLs and paths are deliberately not recorded here (they change per version). Checked 2026-10-22; re-check after 90 days.*

- Audience: an operator who wants to put the site on the internet and get its real address. Every site starts with this chapter.
- Chapter id: `G-hosting` (`need: always`).
- Never put a key, secret or number in chat, the repository or logs. Use `vercel env add <NAME>` (stdin) or the host dashboard.

## G-hosting

- Why: this chapter puts the site on the internet and gives it its **real address**. The domain, sign-in, payment and email chapters all use that address.
- What you need: the folder (or repository) that holds the site code, and an email address to sign up to Vercel.
- Register 1 — Create a Vercel account. The free plan (Hobby) is meant for personal, non-commercial use. A site that takes payments or sells things is commercial use, so a paid plan applies.
- Config: Create a new project in Vercel (a button that looks like New project or Create) and connect the site code. If the code is in a sub-folder of a repository, set the project's root folder setting to that folder. The function region comes from `vercel.json` in the code (Seoul).
- Config: Add the environment variable `LF_MODE` with the value `live`. In a production run (a Vercel deployment) the server stops at start when it is `mock`. It also stops when it is empty.
- Config: Add the environment variable `CRON_SECRET`. Make a long, hard-to-guess value (at least 16 characters) yourself and put it only in the dashboard or through `vercel env add CRON_SECRET` on stdin. Scheduled runs (Cron) call with this value in the Authorization header; without it the scheduled-run paths answer 401.
- Config: Make the first deployment. The **first deployment of a new project is always a Production deployment** (even if you try to make it a Preview). When it finishes you get a deployment address — this is the **real address**.
- Config: Add the environment variable `NEXT_PUBLIC_APP_URL` with that address (starting with `https://`, no path) and **deploy again**. The app address is the base for cookies, sign-in callbacks and email links. A changed environment variable applies only to deployments **created after the change** (deployments already live stay as they are).
- Environments: Vercel keeps environment variables separately for Production, Preview and Development. Put the values your real visitors use in Production. A Preview address can have Vercel sign-in protection (it depends on the project settings), which blocks outside webhooks — receive webhooks and payment notices on the Production address.
- Put the other keys (database, sign-in, email, payments and so on) in the same way (dashboard or stdin) in each feature's chapter.
- Check: the deployment status is healthy (Ready). Opening the address shows the site, or an error page while the names from other chapters are still missing — the error page is expected. At start the server writes the missing environment variable **names** to the log in one go (never the values). In the site folder, `npm run env:check -- --vercel production` compares the names in Production with the required names (it does not read values). If the Vercel CLI is missing, or you are not signed in or the project is not linked, this check is skipped.
- Stuck 1 — The deployment fails and mentions Cron: on the free plan (Hobby) a Cron can run at most once a day. This kit's `vercel.json` has Crons that run every hour, every 30 minutes and every 10 minutes, so the deployment is refused on Hobby. Move to a paid plan, or reduce the Crons to once a day or less; reducing them delays those features (booking reminders, syncing payment state and so on).
- Stuck 2 — The address shows an error page: read the missing names in the log, add them, and deploy again. Values never appear in the log.
- Stuck 3 — You added a variable but nothing changed: a variable change applies from the next deployment. Deploy again.
- Stuck 4 — The address goes to the Vercel sign-in page: that is the default protection on a Preview address. The address for visitors is the Production address.
- Sources: Vercel documentation — environment variables, environments (Production, Preview, first deployment), Cron usage and plan limits, the Hobby plan and fair-use guidelines, the `vercel env` command. This repository's `.env.example`, `template/vercel.json` and `scripts/env-check.mjs`.
