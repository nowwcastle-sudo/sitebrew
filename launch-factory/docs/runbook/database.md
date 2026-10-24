# 운영 런북(전문가용) — 데이터베이스

*Expert runbook: database. English follows the Korean part.*

- 대상: 이 모듈을 쓰기로 정한 사이트 운영자. 계정·연결 문자열은 운영자가 직접 만든다.
- 장 id: `G-db` (`features/outcomes.yaml` guides 열과 같다). 로그인·결제·문의·예약처럼 데이터를 저장하는 기능은 모두 이 장을 먼저 끝내야 한다.
- 값(연결 문자열·비밀번호)은 채팅·저장소·로그에 쓰지 않는다. 호스팅 대시보드나 `vercel env add <이름>` 표준 입력에 직접 넣는다.

## G-db — 데이터베이스 (Supabase Postgres)

- 왜 필요한가: 계정·구독·문의·예약 같은 기록을 저장할 Postgres 가 있어야 사이트가 실제로(`LF_MODE=live`) 켜진다. `LF_MODE=mock` 은 메모리 DB 라 가입이 필요 없다.
- 준비물: 이메일로 만들 수 있는 Supabase 계정. 호스팅(`G-hosting`)이 정해져 있어 환경 변수를 넣을 곳이 있어야 한다.
- 등록 1 — Supabase 가입.
- 등록 2 — 새 프로젝트 만들기(“새 프로젝트/만들기”처럼 보이는 버튼). 데이터베이스 비밀번호를 정해 비밀번호 관리자에 따로 보관한다. 지역은 서울(`Northeast Asia (Seoul)`)을 고른다 — 이 키트의 개인정보 방침 초안은 서울 DB 를 기준으로 한다. 다른 지역이면 방침의 DB 지역 값(`databaseRegion`)도 바꾼다.
- 등록 3 — 프로젝트 화면 위쪽의 “연결(Connect)”처럼 보이는 단추에서 연결 문자열 두 개를 복사한다. 앱용은 **트랜잭션 풀러(포트 6543)**, 마이그레이션용은 **직접 연결(포트 5432)**. 직접 연결은 IPv6 네트워크가 필요하고, IPv4 만 되는 PC 에서는 세션 풀러(포트 5432)를 쓴다. 문자열 안의 `[YOUR-PASSWORD]` 자리에 비밀번호를 넣는다 — `&` `#` `?` 공백 같은 예약 문자는 퍼센트 인코딩한다. 호스트·사용자 이름은 복사한 문자열 그대로 둔다(풀러 호스트는 지역으로 직접 만들 수 없고, 풀러의 사용자 이름은 직접 연결과 다르다).
- 설정 1: 앱용(6543) 연결 문자열을 호스팅의 환경 변수 `DATABASE_URL` 에 넣는다 — 호스팅 대시보드 또는 `vercel env add DATABASE_URL`(표준 입력). 형식은 `postgres://` 또는 `postgresql://` 로 시작해야 한다. 포트 6543 이면 키트가 prepared statement 를 자동으로 끈다(트랜잭션 풀러는 prepared statement 를 지원하지 않는다).
- 설정 2: 마이그레이션은 직접 연결(5432) 문자열로 한 번 돌린다. 배달된 사이트 폴더에서 이 PC 의 터미널 환경 변수로만 잠깐 넣는다.

  ```
  DATABASE_URL=<직접 연결 문자열> node db/migrate.mjs
  ```

  이미 적용한 파일은 건너뛴다. 포트 6543 이면 스크립트가 멈추고 직접 연결(5432)을 쓰라고 알린다. 새 버전을 받아 `db/migrations` 가 늘면 같은 명령을 다시 돌린다.
- 확인: 마이그레이션 끝에 `migrations applied` 한 줄이 나온다. 그 뒤 배포를 다시 하면 부팅이 `DATABASE_URL` 을 검사하고, 빠졌거나 형식이 틀리면 빠진 이름을 알리며 멈춘다(값은 알리지 않는다).
- 막힘:
  - `Use the direct connection (port 5432)…` 로 마이그레이션이 멈춤 → 6543 문자열을 넣었다. 직접 연결이나 세션 풀러(5432) 문자열로 바꾼다.
  - 연결이 거절되거나 비밀번호 오류 → 비밀번호의 예약 문자를 퍼센트 인코딩했는지, 복사한 사용자 이름·호스트를 그대로 썼는지 본다.
  - 직접 연결 문자열이 이 PC 에서 닿지 않음 → IPv4 만 되는 네트워크일 수 있다. 세션 풀러(5432) 문자열을 쓴다.
  - 무료 프로젝트가 멈춤 → Supabase 무료 프로젝트는 7일 동안 활동이 적으면 일시정지될 수 있다(정지 약 1주 전에 경고 메일이 온다). 정지 중에는 요청을 처리하지 못한다. 대시보드에서 프로젝트를 다시 켠다. 정지 뒤 복원할 수 있는 기간은 [확인 안 됨](Supabase 문서 안에서도 서로 다르게 적혀 있다). 정지를 막으려면 유료 요금제로 올리는 방법이 문서에 있다.
- 출처: Supabase 문서 — Connecting to Postgres(연결 방식·포트·prepared statement), Regions(서울 지역), About billing on Supabase(무료 프로젝트 개수), Project pausing(무료 프로젝트 일시정지). 이 저장소의 `packages/db`·`template/db/migrate.mjs`·`.env.example`.

---

# Expert runbook — database

*English follows the Korean part's structure.*

- Audience: the site owner who decided to use this module. You create the account and the connection strings yourself.
- Chapter id: `G-db` (same as the `guides` column in `features/outcomes.yaml`). Every feature that stores data (sign-in, billing, inquiry, booking) needs this chapter finished first.
- Never put a value (connection string, password) in chat, the repository or logs. Put it in the host dashboard or in `vercel env add <NAME>` (stdin).

## G-db

- Why: you need a Postgres database to store accounts, subscriptions, inquiries and bookings before the site can run for real (`LF_MODE=live`). `LF_MODE=mock` uses an in-memory database and needs no sign-up.
- You need: a Supabase account (an email address is enough) and a host (`G-hosting`) where you can set environment variables.
- Register 1 — Sign up for Supabase.
- Register 2 — Create a new project (a button that looks like New project or Create). Choose a database password and keep it in a password manager. Choose the Seoul region (`Northeast Asia (Seoul)`) — this kit's privacy-policy draft assumes a Seoul database. If you choose another region, also change the policy's DB region value (`databaseRegion`).
- Register 3 — Use the button near the top of the project page that looks like Connect to copy two connection strings. For the app, the **transaction pooler (port 6543)**. For migrations, the **direct connection (port 5432)**. The direct connection needs an IPv6 network; on an IPv4-only PC use the session pooler (port 5432). Replace `[YOUR-PASSWORD]` in the string with your password and percent-encode reserved characters such as `&`, `#`, `?` and spaces. Keep the host and user name exactly as copied (the pooler host cannot be built from the region, and the pooler user name differs from the direct one).
- Config 1: put the app string (6543) into the host environment variable `DATABASE_URL` — host dashboard or `vercel env add DATABASE_URL` (stdin). It must start with `postgres://` or `postgresql://`. On port 6543 the kit turns prepared statements off automatically (the transaction pooler does not support them).
- Config 2: run the migrations once with the direct connection (5432) string. In the delivered site folder, set it only as a terminal environment variable on this PC for that one command:

  ```
  DATABASE_URL=<direct connection string> node db/migrate.mjs
  ```

  Files that are already applied are skipped. On port 6543 the script stops and tells you to use the direct connection (5432). Run the same command again when a new version adds files to `db/migrations`.
- Check: the migration ends with one line, `migrations applied`. After you redeploy, startup checks `DATABASE_URL`; if it is missing or malformed it stops and names the missing variable (never the value).
- Stuck:
  - Migration stops with `Use the direct connection (port 5432)…` → you used the 6543 string. Switch to the direct or session pooler (5432) string.
  - Connection refused or password error → check that reserved characters in the password are percent-encoded and that you kept the copied user name and host.
  - The direct string does not connect from this PC → the network may be IPv4-only. Use the session pooler (5432) string.
  - A free project stopped → a Supabase free project can be paused after 7 days of low activity (a warning email arrives about a week before). While paused it cannot process requests. Resume it in the dashboard. How long a paused project can be restored is [not verified] (the Supabase docs disagree with themselves). The docs list upgrading to a paid plan as the way to avoid pausing.
- Sources: Supabase docs — Connecting to Postgres (connection modes, ports, prepared statements), Regions (Seoul), About billing on Supabase (free project count), Project pausing (free project pause). This repository's `packages/db`, `template/db/migrate.mjs` and `.env.example`.
