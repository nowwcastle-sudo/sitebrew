# 운영 런북(전문가용) — 후기 · 검색 · 파일 올리기 · 뉴스레터

*Expert runbook: reviews, search, file upload, newsletter. English follows the Korean part.*

- 확인일: 2026-10-22. 외부 서비스 화면은 바뀐다. 90일이 지나면 다시 확인한다.
- 대상: 이 모듈을 쓰기로 정한 사이트 운영자. 모듈은 그대로 두고 계정·키·도메인 인증은 운영자가 직접 한다.
- 용도: 플러그인 런북 기능의 **내용 원천**이다(`booking-notify-push.md` 와 같은 자리). 화면 이름·주소·경로는 깊이 적지 않는다(버전마다 다르다).
- 장 id: `G-reviews` · `G-search` · `G-storage` · `G-newsletter` (`features/outcomes.yaml` guides 열과 같다). 메일(`G-email`)·DB(`G-db`)는 각자 자기 장이 있다.
- 값(키·비밀)은 채팅·저장소·로그에 쓰지 않는다. `vercel env add <이름>` 표준 입력이나 호스팅 대시보드에 직접 넣는다.

## 0. 어디에 외부 계정이 필요한가

| 기능 | 새 외부 계정 | mock | live 에서 설정이 없으면 |
|---|---|---|---|
| 후기·상품 문의 | 없음 (봇 확인 Turnstile 은 보안 장에서 이미 정한 키를 쓴다) | 봇 확인 없이 돈다 | `TURNSTILE_SECRET_KEY` 없음 → 부팅이 멈춘다(켜진 척 검토 없이 받지 않는다) |
| 검색 | 없음 (Postgres 만) | 첫 질의에서 색인 파일로 자동 색인 | 색인 Cron 이 돌 때까지 결과가 비어 있다 |
| 파일 올리기 | **저장소 계정 하나** (S3 호환: AWS S3 · Cloudflare R2 · MinIO) | `.tmp/uploads` 폴더에 쓴다 | STORAGE 필수 5개 중 하나라도 없음 → 올리기만 꺼진다(사이트는 켜진다) |
| 뉴스레터 | 새 계정 없음. 메일 발송(`G-email` 의 Resend + 인증한 도메인)과 Turnstile 을 쓴다 | 메일은 콘솔에 찍힌다 | 메일 설정 없음 → 확인 메일을 못 보내 구독이 시작되지 않는다 |

뉴스레터 **발송**(소식 메일을 실제로 보내는 일)은 이 모듈의 일이 아니다. 모듈은 구독 명단·확인(이중 동의)·수신거부까지만 한다.

## 1. 환경 변수

정본은 `.env.example`. 선택 이름은 없어도 사이트가 켜진다.

| 이름 | 비밀 | 기능 | 없으면 |
|---|---|---|---|
| `STORAGE_ENDPOINT` · `STORAGE_BUCKET` · `STORAGE_REGION` | 아니오 | 파일 | 올리기 꺼짐 (R2 는 region `auto`) |
| `STORAGE_ACCESS_KEY_ID` · `STORAGE_SECRET_ACCESS_KEY` | **예** | 파일 | 올리기 꺼짐 |
| `STORAGE_PATH_STYLE` | 아니오 | 파일 (R2·MinIO 는 `true`) | 가상 호스트식 주소 |
| `STORAGE_PUBLIC_BASE_URL` | 아니오 | 파일 (공개 종류 avatar·image 를 CDN·공개 도메인으로 읽을 때) | 저장소 주소로 읽는다 |
| `REVIEWS_MODERATION` | 아니오 | 후기 (`after` 기본 · `before`) | `after` |
| `TURNSTILE_SECRET_KEY` · `TURNSTILE_SITE_KEY` | 앞 **예** | 후기·뉴스레터 폼 | 폼 항목이 요구 |
| `RESEND_API_KEY` · `EMAIL_FROM` | 앞 **예** | 뉴스레터 확인 메일 | 메일 못 보냄 |
| `BETTER_AUTH_SECRET` · `NEXT_PUBLIC_APP_URL` | 앞 **예** | 뉴스레터 링크 서명·주소 (32자 이상) | live 에서 멈춘다 |
| `CRON_SECRET` | **예** | 색인·파일·뉴스레터 Cron | Cron 이 401 |

## 2. Cron

`vercel.json` 에 이미 있다(템플릿 기준). 설치한 앱에 직접 더할 때만 아래를 넣는다. 모두 `CRON_SECRET` 이 없으면 401.

| 경로 | 일정 | 하는 일 |
|---|---|---|
| `/api/cron/search` | `20 4 * * *` | 색인 파일(`content/search-index.json`)로 종류별 색인을 바꾼다 |
| `/api/cron/newsletter` | `30 4 * * *` | 확인 안 한 신청(14일)·수신거부 기록(1년)을 지운다. 구독 중인 사람은 안 지운다 |
| `/api/cron/storage` | `40 4 * * *` | 끝내지 않은 올리기(24시간)·보유 기간이 지난 파일·탈퇴한 사람의 파일 객체를 지운다 |

## G-reviews — 후기 · 상품 문의

- 등록: 없음.
- 설정: 대상은 제품이 정한다 — `subjectType`(소문자·숫자·`-_`)과 `subjectId`. 게시 방식은 `REVIEWS_MODERATION`(`after` 바로 게시 후 검토 · `before` 검토 후 게시).
- 폼: 숨은 입력 `cf-turnstile-response` · `idempotencyKey`. 후기는 로그인한 사람만 한 대상에 한 번, 질문은 로그인 없이도 된다.
- 관리: 관리 화면 구획 `reviews`(`/admin/reviews`) — 검토 목록·판매자 답변·승인·숨김(사유 필수 — 구획이 고정 사유를 싣는다, 관리 기록 한 줄)·다시 보이기. 예전 서버 액션(`answerReview`·`setReviewStatus`·`listReviewsForModeration`)은 구획이 서비스를 직접 부르게 되며 없어졌다. 권한은 세션의 사용자 행(소유자·관리자)으로 정한다.
- 탈퇴: 작성자 이름을 「탈퇴한 사용자」로 바꾸고 사용자 연결을 끊는다. 글은 공개 콘텐츠라 남는다. 전체 템플릿의 `lib/launch/purgers.ts` 에 켜져 있다.
- 확인: 시험 후기 제출 → 목록·별점 요약에 반영 → 숨김 → 목록에서 빠짐.

## G-search — 사이트 검색

- 등록: 없음. 별도 검색 서비스 없이 Postgres `ILIKE` 로 찾는다(한국어 부분 문자열 가능, 제목 일치 가중).
- 색인: `content/search-index.json` 의 문서 목록. 형식이 틀리면 아무것도 바꾸지 않는다(옛 색인 유지).
- 첫 배포 뒤: Cron 이 돌기 전에는 비어 있다 — 한 번 직접 부른다: `curl -H "Authorization: Bearer $CRON_SECRET" https://<사이트>/api/cron/search`.
- 확인: 검색 상자에 문서 제목의 낱말 → 결과와 강조 범위. 빈 질의는 오류가 아니라 빈 결과.
- 주의: 문서가 수만 건을 넘으면 `ILIKE` 가 느려진다. 그때 별도 검색 서비스를 따로 검토한다(이 모듈 범위 밖).

## G-storage — 파일 올리기 (S3 호환 저장소)

- 등록 1 — 저장소 계정: AWS S3 · Cloudflare R2 · MinIO(직접 운영) 중 하나. 요금·무료 구간은 서비스마다 다르다(이 글은 확인하지 않았다).
- 등록 2 — 버킷 하나. 비공개 종류(`attachment`)는 버킷을 공개하지 않는다(짧은 서명 주소로만 읽는다).
- 등록 3 — 키: 이 버킷의 객체 쓰기·읽기·삭제만 허용한 전용 키. → `STORAGE_ACCESS_KEY_ID` · `STORAGE_SECRET_ACCESS_KEY`. 계정 전체 키를 쓰지 않는다.
- 등록 4 — CORS(브라우저가 직접 PUT 한다): 허용 출처에 사이트 주소, 메서드 `PUT`(공개 읽기면 `GET` 도), 머리 `content-type`.
- 등록 5 — 공개 읽기(avatar · image): 버킷 또는 공개 도메인이 읽기 공개여야 한다. CDN·공개 도메인을 쓰면 `STORAGE_PUBLIC_BASE_URL`.
- 설정: 다섯 필수(`STORAGE_ENDPOINT` · `BUCKET` · `REGION` · `ACCESS_KEY_ID` · `SECRET_ACCESS_KEY`). R2·MinIO 는 `STORAGE_PATH_STYLE=true`. 종류별 상한·형식은 정책 표(`packages/storage/src/policy.ts`): avatar 2MB(로그인 필요) · image 5MB · attachment 10MB(비공개, 보유 365일).
- 탈퇴: 전체 템플릿에서는 탈퇴한 사람의 파일이 장부에서 「지울 때」로 당겨지고 파기 직후와 파일 Cron 에서 객체가 지워진다.
- 확인: 로그인 → 작은 이미지 올리기 → 티켓 → 저장소에 객체가 생김 → 끝내기 → 주소로 보임. 올리기 단추가 안 나오거나 503 이면 STORAGE 다섯 개 중 빈 값을 본다. 브라우저 콘솔에 CORS 오류가 나면 등록 4.
- 막힘: `storage.notUploaded`(끝내기가 먼저 불림) → 업로드 PUT 이 실패한 것(CORS·서명 시계 어긋남). 속인 크기·형식은 객체가 지워지고 거절된다.

## G-newsletter — 뉴스레터 구독

- 등록: 새 계정 없음. `G-email` 의 Resend 계정과 인증한 도메인(`EMAIL_FROM`)이 먼저 있어야 확인 메일이 나간다. 봇 확인은 Turnstile.
- 동의: 체크박스는 **미리 체크하지 않는다**(정보통신망법 제50조). 문구를 고치면 `NEWSLETTER_CONSENT_VERSION` 판을 올린다 — 동의한 때의 판이 구독자 행에 남는다.
- 흐름: 신청 → 확인 메일(이중 동의) → 링크 확인 → 구독 시작 안내 메일. 이미 구독 중인 주소도 같은 응답(존재 여부를 알리지 않는다).
- 링크: 확인·수신거부 링크는 `BETTER_AUTH_SECRET` 에서 파생한 서명으로 만든다. 메일 보안 프로그램이 링크를 미리 열면 확인이 사람 손 전에 끝날 수 있다 — 필요하면 `/email` 쪽이 단추를 보이고 POST 하게 한다(항목 문서 4항).
- 보내기: 이 모듈의 일이 아니다. 서비스의 구독자 목록(`unsubscribeUrl` 포함)을 보내는 도구에 넘기고, 보내는 도구가 메일마다 본문 링크와 `List-Unsubscribe` 헤더(원클릭)에 수신거부 주소를 단다. 제목 「(광고)」 · 전송자 표시 · 사업자 정보는 보내는 쪽 몫이다.
- 확인: 시험 주소로 신청 → 확인 메일 수신 → 링크 → 구독 완료 → 같은 주소로 다시 신청해도 같은 화면. 메일이 안 오면 `G-email`(키·도메인 인증)을 본다.

---

# Expert runbook — reviews, search, file upload, newsletter

*Source of content for the plugin runbook feature (same place as `booking-notify-push.md`). Exact screen names, URLs and paths are deliberately not recorded (they change per version). Checked 2026-10-22; re-check after 90 days.*

Never put a key or secret in chat, the repository or logs. Use `vercel env add <NAME>` (stdin) or the host dashboard.

## 0. Where an outside account is needed

| Feature | New outside account | mock | live, when not configured |
|---|---|---|---|
| Reviews and product questions | None (bot check reuses the Turnstile keys from the security chapter) | Runs without a bot check | No `TURNSTILE_SECRET_KEY` → boot stops (it never accepts posts as if moderation were on) |
| Search | None (Postgres only) | First query auto-indexes from the index file | Results stay empty until the index Cron runs |
| File upload | **One storage account** (S3-compatible: AWS S3, Cloudflare R2, MinIO) | Writes to the `.tmp/uploads` folder | Any of the five required STORAGE names missing → upload only turns off (the site stays up) |
| Newsletter | No new account. Uses mail sending (`G-email`: Resend + a verified domain) and Turnstile | Mail is printed to the console | No mail setup → confirmation mail cannot be sent, so subscriptions never start |

Newsletter **sending** (actually mailing news) is not this module's job. The module covers the list, confirmation (double opt-in) and unsubscribe only.

## 1. Environment variables

Source of truth: `.env.example`. Optional names do not stop the site from starting.

| Name | Secret | Feature | If missing |
|---|---|---|---|
| `STORAGE_ENDPOINT` · `STORAGE_BUCKET` · `STORAGE_REGION` | no | Files | Upload off (R2: region `auto`) |
| `STORAGE_ACCESS_KEY_ID` · `STORAGE_SECRET_ACCESS_KEY` | **yes** | Files | Upload off |
| `STORAGE_PATH_STYLE` | no | Files (`true` for R2 and MinIO) | Virtual-host style addresses |
| `STORAGE_PUBLIC_BASE_URL` | no | Files (read public kinds avatar/image through a CDN or public domain) | Read from the storage address |
| `REVIEWS_MODERATION` | no | Reviews (`after` default, `before`) | `after` |
| `TURNSTILE_SECRET_KEY` · `TURNSTILE_SITE_KEY` | first: **yes** | Review and newsletter forms | Required by the form items |
| `RESEND_API_KEY` · `EMAIL_FROM` | first: **yes** | Newsletter confirmation mail | Mail cannot be sent |
| `BETTER_AUTH_SECRET` · `NEXT_PUBLIC_APP_URL` | first: **yes** | Newsletter link signing and address (32+ characters) | Boot stops in live |
| `CRON_SECRET` | **yes** | Index, file and newsletter Cron | Cron returns 401 |

## 2. Cron

Already in the template `vercel.json`. Add these by hand only to an installed app. All return 401 without `CRON_SECRET`.

| Path | Schedule | Does |
|---|---|---|
| `/api/cron/search` | `20 4 * * *` | Rebuilds the per-kind index from `content/search-index.json` |
| `/api/cron/newsletter` | `30 4 * * *` | Deletes unconfirmed requests (14 days) and unsubscribe records (1 year). Active subscribers are kept |
| `/api/cron/storage` | `40 4 * * *` | Deletes objects of unfinished uploads (24 hours), files past retention, and files of deleted accounts |

## G-reviews — reviews and product questions

- Register: nothing.
- Config: the subject is the product's choice — `subjectType` (lowercase, digits, `-_`) plus `subjectId`. Publishing mode is `REVIEWS_MODERATION` (`after` publish then review, `before` review then publish).
- Form: hidden inputs `cf-turnstile-response` and `idempotencyKey`. Reviews need a signed-in user, one per subject; questions work signed out.
- Admin: the `reviews` admin section (`/admin/reviews`) — moderation list, seller reply, approve, hide (reason required; the section sends a fixed reason, one audit line) and show again. The old server actions (`answerReview`, `setReviewStatus`, `listReviewsForModeration`) are gone: the section calls the service directly. Permission comes from the session user row (owner, admin).
- Account deletion: the author name becomes "Deleted user" and the user link is cut. The text stays as public content. Enabled in the full template's `lib/launch/purgers.ts`.
- Check: submit a test review → it shows in the list and the rating summary → hide it → it leaves the list.

## G-search — site search

- Register: nothing. No separate search service; Postgres `ILIKE` finds documents (Korean substrings work, title matches rank higher).
- Index: the document list in `content/search-index.json`. A malformed file changes nothing (the old index stays).
- After the first deploy: results are empty until the Cron runs. Call it once: `curl -H "Authorization: Bearer $CRON_SECRET" https://<site>/api/cron/search`.
- Check: type a word from a document title → results with highlight ranges. An empty query returns an empty result, not an error.
- Note: past tens of thousands of documents `ILIKE` gets slow; review a separate search service then (outside this module).

## G-storage — file upload (S3-compatible storage)

- Register 1 — a storage account: AWS S3, Cloudflare R2, or MinIO (self-run). Pricing and free tiers differ per service (not checked here).
- Register 2 — one bucket. Keep the bucket private for the private kind (`attachment`); it is read only through short signed addresses.
- Register 3 — a key limited to object write, read and delete on this bucket → `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY`. Do not use an account-wide key.
- Register 4 — CORS (the browser PUTs directly): allowed origin = the site address, method `PUT` (plus `GET` for public reads), header `content-type`.
- Register 5 — public reads (avatar, image): the bucket or a public domain must allow public reads. With a CDN or public domain, set `STORAGE_PUBLIC_BASE_URL`.
- Config: the five required names (`STORAGE_ENDPOINT`, `BUCKET`, `REGION`, `ACCESS_KEY_ID`, `SECRET_ACCESS_KEY`). R2 and MinIO need `STORAGE_PATH_STYLE=true`. Limits per kind are in the policy table (`packages/storage/src/policy.ts`): avatar 2 MB (sign-in required), image 5 MB, attachment 10 MB (private, kept 365 days).
- Account deletion: in the full template a deleted user's files are moved to "delete now" in the ledger; objects go right after the purge and in the file Cron.
- Check: sign in → upload a small image → ticket → the object appears in the bucket → complete → the address shows it. No upload button or a 503 means a blank among the five STORAGE names. A CORS error in the browser console means register 4.
- Stuck: `storage.notUploaded` (complete called first) → the PUT failed (CORS or signing clock skew). A forged size or type gets the object deleted and the request rejected.

## G-newsletter — newsletter subscription

- Register: no new account. The `G-email` Resend account and a verified domain (`EMAIL_FROM`) must exist first or confirmation mail is not sent. Bot check is Turnstile.
- Consent: the checkbox is **never pre-checked** (Korean Network Act art. 50). When you change the wording, bump `NEWSLETTER_CONSENT_VERSION` — the version consented to is stored on the subscriber row.
- Flow: request → confirmation mail (double opt-in) → click → welcome mail. A request for an address that already subscribes gets the same response (existence is not revealed).
- Links: confirm and unsubscribe links are signed with a secret derived from `BETTER_AUTH_SECRET`. A mail scanner that opens links first can confirm before a human clicks — if needed, make `/email` show a button that POSTs (item doc, point 4).
- Sending: not this module's job. Pass the service's subscriber list (with `unsubscribeUrl`) to your sending tool, which puts the unsubscribe address in each body link and in the `List-Unsubscribe` header (one-click). The "(광고)" subject prefix, sender identification and business details are the sender's duty.
- Check: subscribe a test address → confirmation mail arrives → click → subscribed → subscribe the same address again and see the same screen. No mail → check `G-email` (key, domain verification).
