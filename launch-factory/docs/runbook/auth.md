# 운영 런북(전문가용) — 로그인·가입

*Expert runbook: sign-in and sign-up. English follows the Korean part.*

- 대상: 이 모듈을 쓰기로 정한 사이트 운영자. 이메일·비밀번호 로그인은 외부 계정이 필요 없다. 소셜 로그인(Google · 카카오 · 네이버)을 켜려는 공급자만 각 개발자 콘솔에 앱을 등록한다.
- 장 id: `G-auth` (`features/outcomes.yaml` guides 열과 같다). 먼저 `G-db` 를 끝낸다 — 계정·세션 표는 그 마이그레이션이 만든다.
- 값(비밀·클라이언트 시크릿)은 채팅·저장소·로그에 쓰지 않는다. 호스팅 대시보드나 `vercel env add <이름>` 표준 입력에 직접 넣는다.

## G-auth — 로그인·가입 (Better Auth)

- 왜 필요한가: 로그인 세션과 확인 메일 링크를 서명하는 비밀 하나와, 콜백·메일 링크가 돌아올 앱 주소가 있어야 `LF_MODE=live` 에서 가입·로그인이 켜진다.
- 준비물: `G-db` 가 끝난 프로젝트(마이그레이션 적용). 배포 주소(호스팅이 주는 주소 또는 연결한 도메인). 소셜 로그인을 쓸 때만 해당 공급자 계정.
- 등록 1 — (선택, Google 로그인) Google Cloud 콘솔에서 프로젝트를 만들고 사용자 인증 정보에서 OAuth 클라이언트 ID 를 “웹 애플리케이션” 종류로 만든다. 승인된 리디렉션 URI 에 `https://<도메인>/api/auth/callback/google`(로컬 시험은 `http://localhost:3000/api/auth/callback/google`)을 넣는다. 나온 클라이언트 ID·시크릿을 `GOOGLE_CLIENT_ID`·`GOOGLE_CLIENT_SECRET` 에 넣는다. 리디렉션 URI 가 앱 주소와 다르면 `redirect_uri_mismatch` 가 난다.
- 등록 2 — (선택, 카카오 로그인) 카카오디벨로퍼스에서 앱을 만든다. [카카오 로그인] 사용 설정을 ON 으로 한다(OFF 면 `KOE004`). 리다이렉트 URI 에 `https://<도메인>/api/auth/callback/kakao` 를 등록한다(틀리면 `KOE006`). [동의항목]을 설정한다. 앱의 REST API 키를 `KAKAO_CLIENT_ID` 에, 그 키의 클라이언트 시크릿을 `KAKAO_CLIENT_SECRET` 에 넣는다. 이메일(`account_email`)을 받으려면 비즈 앱이어야 한다(Better Auth 문서). 일부 개인정보 동의항목은 비즈 앱 전환 → 신청 자격 확인 → 비즈니스 정보 심사 뒤 추가 기능을 신청해야 하고 그 심사에는 며칠이 걸린다(정확한 날수는 [확인 안 됨] — 카카오 안내에서 확인한다). 비즈 앱 전까지는 이메일이 없으므로 이 키트가 카카오 회원번호로 만든 대체 주소를 계정 이메일로 쓴다.
- 등록 3 — (선택, 네이버 로그인) 네이버 개발자 센터에서 애플리케이션을 등록한다(처음 한 번 휴대폰 인증). 사용 API 에 “네이버 로그인”을 넣고 서비스 환경(PC 웹·모바일 웹)에 서비스 URL 과 네이버 로그인 Callback URL `https://<도메인>/api/auth/callback/naver` 를 넣는다(Callback URL 은 최대 5개). 나온 클라이언트 아이디·시크릿을 `NAVER_CLIENT_ID`·`NAVER_CLIENT_SECRET` 에 넣는다. 실서비스로 열려면 검수를 요청해 승인받아야 하고, 승인 전에는 로그인할 수 있는 아이디가 제한된다.
- 설정 1: 비밀 `BETTER_AUTH_SECRET` 을 만든다. 32자 이상이어야 하고 엔트로피가 높아야 한다(Better Auth 문서). 만드는 표준 방법은 `openssl rand -base64 32`. 만든 값은 화면에 붙여 넣지 말고 호스팅 대시보드 또는 `vercel env add BETTER_AUTH_SECRET`(표준 입력)에 바로 넣는다. 32자 미만이면 live 에서 부팅이 멈춘다. 서명 비밀을 바꾸지 않는다. 확인 메일의 “제가 가입한 게 아니에요” 링크의 서명 비밀이 `BETTER_AUTH_SECRET` 에서 만들어지므로, 바꾸면 이미 나간 그 링크가 더는 맞지 않는다.
- 설정 2: 앱 주소 `NEXT_PUBLIC_APP_URL` 을 `https://` 로 시작하는 배포 주소로 넣는다. live 에서는 필수다 — 이 키트는 이 값을 인증의 기준 주소로 쓰며, 소셜 로그인 콜백과 메일 링크가 이 주소로 만들어진다. 배포 주소는 첫 배포 뒤에야 알 수 있으니 순서는 배포 → 주소 확인 → 값 추가 → 다시 배포. 도메인을 연결하면(`G-domain`) 그 주소로 바꾸고 다시 배포한다.
- 설정 3: 소셜 공급자는 `<공급자>_CLIENT_ID` 와 `<공급자>_CLIENT_SECRET` 을 **둘 다** 넣은 것만 켜진다. 하나만 있으면 켜지지 않는다(점검 도구가 경고한다). 하나도 없으면 이메일·비밀번호 로그인만 있다.
- 설정 4: 비밀 `SUBJECT_REF_KEY` 를 만든다. 32자 이상이어야 하며 live 에서는 필수다. 탈퇴한 사람의 거래 기록을 이메일 없이 가리키는 데 쓰는 키라서, 바꾸거나 잃어버리면 옛 기록을 찾지 못한다. 값은 화면에 붙여 넣지 말고 호스팅 대시보드 또는 `vercel env add SUBJECT_REF_KEY`(표준 입력)에 바로 넣고, 한 번 정하면 바꾸지 않는다.
- 확인: 배포 주소에서 가입 화면이 열린다 → 이메일로 가입하면 확인 메일이 온다. 소셜을 켰다면 로그인 화면에 그 공급자 버튼이 보이고 눌러서 공급자 화면을 거쳐 돌아온다. 소셜로 처음 오면 약관·개인정보·만 14세 확인을 거쳐야 계정이 생긴다(가입 없이 소셜로 로그인하면 `/sign-in?error=signup_disabled` 로 돌아와 안내를 본다).
- 막힘:
  - 부팅이 멈추고 `BETTER_AUTH_SECRET` 또는 `NEXT_PUBLIC_APP_URL` 을 알림 → live 에서 필수다. 이름이 호스팅 환경에 있는지, 값이 32자 이상인지 본다. 환경 변수를 바꾼 뒤에는 다시 배포한다.
  - 소셜 로그인에서 `redirect_uri_mismatch`(Google) / `KOE006`(카카오) → 공급자 콘솔에 등록한 콜백 주소가 `NEXT_PUBLIC_APP_URL` 의 주소와 글자까지 같은지 본다. 주소가 `localhost` 로 만들어지면 앱 주소 환경 변수가 빠진 것이다.
  - 카카오 `KOE004` → [카카오 로그인] 사용 설정이 OFF 이다. ON 으로 바꾼다.
  - 소셜 버튼이 안 보임 → 그 공급자의 ID·시크릿 둘 중 하나가 비어 있다.
- 출처: Better Auth 문서 — Installation(비밀·기준 주소), Google · Kakao 공급자 안내(콜백 주소·비즈 앱), Concepts/CLI(`secret` 명령). 카카오디벨로퍼스 — 카카오 로그인 설정하기(사용 설정·리다이렉트 URI·동의항목·심사). 네이버 개발자 센터 — 오픈 API 사전 준비 사항, 네이버 로그인 개발가이드(검수). Google Identity 문서. 이 저장소의 `.env.example`·`packages/auth`·`registry/feature-auth-betterauth`.

---

# Expert runbook — sign-in and sign-up

*English follows the Korean part's structure.*

- Audience: the site owner who decided to use this module. Email-and-password sign-in needs no outside account. Register an app in each developer console only for the social providers you turn on (Google, Kakao, Naver).
- Chapter id: `G-auth` (same as the `guides` column in `features/outcomes.yaml`). Finish `G-db` first — its migrations create the account and session tables.
- Never put a value (secret, client secret) in chat, the repository or logs. Put it in the host dashboard or in `vercel env add <NAME>` (stdin).

## G-auth

- Why: sign-in and sign-up run in `LF_MODE=live` only when there is one secret that signs sessions and email links, and an app address that callbacks and email links return to.
- You need: a project where `G-db` is done (migrations applied). A deployed address (from the host or a connected domain). A provider account only for each social sign-in you use.
- Register 1 — (optional, Google sign-in) In the Google Cloud console create a project, then under credentials create an OAuth client ID of type “Web application”. Add `https://<domain>/api/auth/callback/google` (for local tests `http://localhost:3000/api/auth/callback/google`) as an authorized redirect URI. Put the client ID and secret into `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. If the redirect URI differs from the app address you get `redirect_uri_mismatch`.
- Register 2 — (optional, Kakao sign-in) Create an app in Kakao Developers. Set Kakao Login's use setting to ON (OFF gives `KOE004`). Register `https://<domain>/api/auth/callback/kakao` as a redirect URI (a wrong one gives `KOE006`). Set the consent items. Put the app's REST API key into `KAKAO_CLIENT_ID` and that key's client secret into `KAKAO_CLIENT_SECRET`. Receiving the email (`account_email`) requires a Biz App (Better Auth docs). Some personal-data consent items need Biz App conversion → eligibility check → business information review before you apply for the extra feature, and that review takes some days (the exact number of days was not checked [확인 안 됨] — confirm it in Kakao's notice). Without a Biz App there is no email, so this kit uses a substitute address built from the Kakao member number as the account email.
- Register 3 — (optional, Naver sign-in) Register an application in Naver Developers (phone verification once, the first time). Add “Naver Login” as an API and, under the service environment (PC web and mobile web), enter the service URL and the Naver Login callback URL `https://<domain>/api/auth/callback/naver` (up to 5 callback URLs). Put the client ID and secret into `NAVER_CLIENT_ID` and `NAVER_CLIENT_SECRET`. To open it to everyone you must request a review and be approved; before approval only a limited set of accounts can sign in.
- Config 1: create the secret `BETTER_AUTH_SECRET`. It must be at least 32 characters with high entropy (Better Auth docs). Standard way: `openssl rand -base64 32`. Do not paste the value on screen; put it straight into the host dashboard or `vercel env add BETTER_AUTH_SECRET` (stdin). Under 32 characters, startup stops in live. do not change the signing secret later. The signing key of the “I didn't sign up” link in the confirmation email is derived from `BETTER_AUTH_SECRET`, so changing it breaks links already sent.
- Config 2: set the app address `NEXT_PUBLIC_APP_URL` to the deployed address starting with `https://`. It is required in live — this kit uses it as the base address for auth, so social callbacks and email links are built from it. You only know the address after the first deploy, so the order is deploy → note the address → add the value → deploy again. When you connect a domain (`G-domain`), change it to that address and deploy again.
- Config 3: a social provider turns on only when `<PROVIDER>_CLIENT_ID` and `<PROVIDER>_CLIENT_SECRET` are **both** set. With only one, it stays off (the check tool warns). With none, there is only email-and-password sign-in.
- Config 4: create the secret `SUBJECT_REF_KEY`. It must be at least 32 characters and is required in live. It is the key that points to a deleted person's transaction records without their email, so if you change or lose it the old records can no longer be found. Do not paste the value on screen; put it straight into the host dashboard or `vercel env add SUBJECT_REF_KEY` (stdin). Once set, do not change it.
- Check: the sign-up page opens at the deployed address → signing up with an email sends a confirmation email. If you turned on a social provider, the sign-in page shows its button and you return after the provider's page. A first-time social visitor must pass the terms, privacy and age-14 check before an account exists (signing in with a social account without signing up returns to `/sign-in?error=signup_disabled`, which explains it).
- Stuck:
  - Startup stops and names `BETTER_AUTH_SECRET` or `NEXT_PUBLIC_APP_URL` → both are required in live. Check the name exists in the host environment and the secret is 32+ characters. Deploy again after changing environment variables.
  - `redirect_uri_mismatch` (Google) / `KOE006` (Kakao) on social sign-in → the callback registered in the provider console must match the `NEXT_PUBLIC_APP_URL` address character for character. If the address is built as `localhost`, the app address variable is missing.
  - Kakao `KOE004` → Kakao Login's use setting is OFF. Turn it ON.
  - A social button is missing → one of that provider's ID and secret is empty.
- Sources: Better Auth docs — Installation (secret, base address), Google and Kakao provider pages (callback address, Biz App), Concepts/CLI (`secret` command). Kakao Developers — Kakao Login setup (use setting, redirect URI, consent items, review). Naver Developers — Open API prerequisites, Naver Login development guide (review). Google Identity docs. This repository's `.env.example`, `packages/auth` and `registry/feature-auth-betterauth`.
