# 운영 런북(전문가용) — 관리 화면 (주문 · 예약 · 문의 · 후기 · 뉴스레터 · 사용자)

*Expert runbook: the admin screens. English follows the Korean part.*

- 대상: 사이트를 연 뒤 들어온 주문·예약·문의·후기·뉴스레터 신청·가입자를 직접 보고 처리하려는 운영자. 부품은 `admin-console`(레지스트리 `feature-admin-console`). 외부 서비스에 새로 가입할 일은 없다.
- 용도: 플러그인 런북 기능의 **내용 원천**이다. 전문가용은 이 글을 그대로 쓰고, 초보자용은 이 글의 항목을 풀어 쓴다.
- 장 id: `G-admin`. 이 장은 성과(`features/outcomes.yaml`)의 안내 번호 열에 없다. 켜는 질문이 따로 없기 때문이다 — 카드의 `when` 이 맞을 때(관리할 것이 있는 기능을 하나라도 고른 사이트)만 넣는다.
- 값(키·비밀)은 채팅·저장소·로그에 쓰지 않는다. 이 장에는 새 비밀 값이 없다.
- 이 글은 저장소의 코드와 문서만 읽고 썼다. 시험은 서버 쪽 코드(접근 벽 · 확인 벽 · 목록 → 상세 → 행동 한 바퀴)까지만 돌렸다. **실제 브라우저로 `/admin` 을 열어 본 적은 없고, 실제 PortOne 결제창도 돌린 적이 없다.** 주문 환불이 진짜 결제대행사에서 어떻게 보이는지는 확인하지 않았다 [확인 안 됨].

## G-admin — 관리 화면

- 왜 필요한가: 방문자가 남긴 것을 사장님이 한곳에서 보고 처리하려고 한다. 주문 발송, 예약 확정·취소, 문의 답변 상태, 후기 승인·숨김, 뉴스레터 명단, 가입자 정지를 이 화면이 한다. 화면은 설치되지만, 들어오는 사람을 정하는 일(소유자 메일 또는 관리자)은 운영자가 해야 켜진다.
- 준비물: 로그인(`G-auth`)과 데이터베이스(`G-db`)가 끝나 있어야 한다. 소유자 메일 경로를 쓰려면 문의 알림 메일 `INQUIRY_OWNER_EMAIL` 이나 예약 알림 메일 `BOOKING_OWNER_EMAIL` 중 쓰는 쪽이 정해져 있어야 하고, 그 주소로 가입해 메일 확인까지 마친 계정이 있어야 한다. 관리자 경로를 쓰려면 데이터베이스에 직접 한 줄을 고칠 수 있는 길(데이터베이스 서비스가 주는 질의 도구)이 있어야 한다.
- 등록: 없음. 외부 서비스 계정은 새로 필요 없다.
- 설정: 구획 일곱 개가 있고 부품이 꺼지면 그 구획도 사라진다 — 주문(`orders`)·재고(`stock`)는 판매(`commerce`), 예약(`bookings`), 문의(`inquiries`), 후기(`reviews`), 뉴스레터(`newsletter`), 사용자(`users`). 사이드바에는 들어온 사람이 볼 수 있는 구획만 보인다.
- 설정: 들어올 수 있는 사람은 두 종류다. **소유자** — 로그인했고 메일 확인을 마친 주소가 그 구획의 소유자 메일과 같은 사람(앞뒤 공백·대소문자는 무시, 둘 다 비어 있으면 안 된다). 문의·후기는 `INQUIRY_OWNER_EMAIL`, 예약은 `BOOKING_OWNER_EMAIL` 이다. 소유자는 2단계 인증 없이 들어온다. **관리자** — 사용자 행의 역할이 `admin` 이고 2단계 인증을 켠 사람. 역할은 쉼표 목록(`admin,support`)이어도 `admin` 이 들어 있으면 관리자다. 주문·재고·뉴스레터·사용자 구획은 관리자만 연다.
- 설정: 로그아웃한 사람, 관리자가 대신 들어온 세션(대리 로그인), 정지된 사람은 어떤 구획도 못 연다. 관리자 역할이어도 2단계 인증이 없으면 `two_factor_required` 로 막힌다(같은 사람이 그 구획의 소유자 메일이면 소유자로는 들어온다).
- 설정: 첫 관리자는 화면으로 만들지 않는다. 데이터베이스의 사용자 행에서 `role` 을 `admin` 으로 바꾼다. 그리고 `template/lib/launch/features.ts` 의 `AUTH_FEATURES` 를 `{ twoFactor: true, admin: true }` 로 바꾼다 — 기본값은 둘 다 꺼짐이고, 꺼져 있으면 관리자 입구는 열리지 않으며 사용자 구획도 사라진다.
- 설정: **지금 템플릿의 한계** — 계정 화면의 「2단계 인증」 줄은 일부러 숨겨져 있어, 화면에서 2단계 인증을 켜는 길이 없다. 그래서 관리자 전용 구획(주문 · 재고 · 뉴스레터 · 사용자)을 화면으로만 열 수는 아직 없다. 소유자 경로(문의 · 예약 · 후기)는 이 한계와 무관하게 열린다. 2단계 인증 등록 화면은 후속 일이다.
- 설정: 행동(상태 바꾸기·취소·숨김·정지)은 서버가 사람 확인 입력(`confirmed: true`)을 받지 않으면 실행하지 않는다. 되돌리기 어려운 행동은 구획당 하나가 위험 행동으로 따로 표시된다 — 주문 취소(환불), 예약 취소, 문의 불만 표시, 후기 숨김, 뉴스레터 수신 거부 처리, 사용자 정지. 관리자 전용 행동은 소유자에게 안 보이고 `forbidden` 이다.
- 설정: 연락처 열(메일·전화·이름)은 목록과 요약에서 일부만 보이게 가려 나간다(예: `k***@example.com`). 주문 상세의 받는 분·전화·주소는 배송에 써야 해서 가리지 않는다 — 읽을 때마다 접속 기록이 남는다.
- 설정: 읽기마다 접속 기록(`access_logs`) 한 줄, 행동마다 행동 기록(`admin_actions`) 한 줄이 남는다. 행동 기록에는 폼에 적은 값을 남기지 않는다. 읽기 기록이 실패하면 읽기도 거부한다. 요청 제한은 읽기 분당 120번, 쓰기 분당 30번이고 행동 입구에서 분당 60번이 한 번 더 걸린다.
- 설정: 화면(`/admin`, `/admin/<구획>`, `/admin/<구획>/<기록 id>`)은 검색엔진에 올리지 않는다(`noindex`). 구획이 던진 오류는 화면에 일반 문구로만 나가고, 서버 로그에는 오류 이름과 위치만 남는다.
- 설정: 설치 뒤 `next.config.ts` 의 `transpilePackages` 에 쓰는 `@launch-factory/*` 를 모두 적고, `serverExternalPackages` 에 `@electric-sql/pglite` 를 더한다(이 항목의 설치 안내 7번). 구획을 더하는 법은 `docs/guides/admin-sections.md` 에 있다.
- 설정: 예약 취소 환불 — 예약금이 있는 예약을 대표(소유자)나 시스템이 취소하면 때와 상관없이 기본으로 전액을 돌려준다. 비율은 `lib/launch/booking-config.ts` 의 `depositPolicy.ownerCancelRefundPercent`(0~100)로 바꾼다. 손님이 직접 취소할 때의 규정(취소 마감까지 전액, 그 뒤는 `laterRefundPercent`)은 그대로다.
- 설정: 알려진 한계 — 같은 사람이 `adminAct`(분당 60번)와 콘솔 쓰기(분당 30번) 두 한도를 함께 지난다. 검색 칸은 서버가 맞춘다 — 사용자·뉴스레터는 이메일, 문의는 접수 번호·이름·연락처, 예약은 접수 번호·이름·연락처(메일·전화), 후기는 제목·본문·작성자 이름이다. 후기에는 작성자의 이메일을 남기지 않아 이메일로는 찾을 수 없다(브라우저 시험으로 확인했다).
- 확인: 소유자 경로 — 소유자 메일로 가입·메일 확인 → 로그인 → `/admin` 에 문의·예약·후기 구획이 보임 → 시험 기록 하나를 열어 상세가 보임 → 행동 하나를 확인 입력과 함께 실행 → 상태가 바뀜. 관리자 경로 — 위 두 가지(역할 · `AUTH_FEATURES`)를 바꾸고 2단계 인증을 켠 계정이 있을 때 사용자·주문 구획이 보임. 막히는 쪽 확인 — 로그아웃 상태로 `/admin` 을 열면 로그인 안내만 보인다.
- 막힘: `/admin` 에 「들어갈 수 없음」만 보임 → 로그아웃, 대리 로그인, 정지, 소유자 메일 불일치(메일 확인을 안 마친 주소 포함), 또는 관리자 역할인데 2단계 인증이 없는 경우다. 어느 쪽인지는 화면이 숨기고 같은 문구로 답한다. 계정의 메일 확인 여부와 `role` 값을 먼저 본다.
- 막힘: 「볼 구획 없음」 → 들어오긴 했지만 그 사람이 열 수 있는 구획이 없다. 소유자 메일이 맞는 구획이 없거나, 관리자 전용 구획만 켜져 있는데 관리자가 아니다.
- 막힘: 사용자 구획이 안 보임 → `AUTH_FEATURES` 둘 중 하나가 꺼져 있다.
- 막힘: 행동이 `confirmation_required` 로 멈춤 → 오류가 아니라 사람 확인 대기다. 확인 단계를 지나야 실행된다.
- 막힘: 행동이 `invalid_state` 로 막힘 → 이미 그 상태다(예: 이미 취소됨). 두 번 눌러도 한 번만 실행되게 막아 둔 것이다.
- 막힘: 주문 취소를 눌렀는데 성공이라고 안 나옴 → 환불 도중 상태가 바뀌었다는 알림이다. 주문 상태를 다시 열어 확인한다.
- 출처: 저장소만 읽었다 — `registry/feature-admin-console` 의 설치 안내, `docs/guides/admin-sections.md`, `packages/admin-console` 의 입장 판단(`admit.ts`), 템플릿의 `lib/launch/admin-console.ts`·`admin-identity.ts`·`features.ts`와 구획 모듈 `lib/launch/admin-sections/`, 계획 3d 기록(PR 본문의 「남은 일」). 외부 서비스의 화면·주소는 없다.

---

# Expert runbook — the admin screens (orders, bookings, inquiries, reviews, newsletter, users)

*Source of content for the plugin runbook feature. Expert version: use as is. Beginner version: expand each item.*

- For: operators who, after launch, want to see and handle the orders, bookings, inquiries, reviews, newsletter sign-ups and members that arrive. The part is `admin-console` (registry `feature-admin-console`). No new outside account is needed.
- Chapter id: `G-admin`. It is not in the guide-number column of `features/outcomes.yaml`, because there is no question that turns it on — the card's `when` decides (a site that picked at least one feature that has something to manage).
- Never put a key or secret in chat, the repository or logs. This chapter has no new secret.
- This text was written from the repository's code and documents only. Tests went as far as the server-side code (access wall, confirmation wall, one loop of list → detail → action). **A real browser was never used to open `/admin`, and no real PortOne payment window was run.** How an order refund looks at a real payment provider was not checked [not verified].

## G-admin

- Why: so the owner can see and handle what visitors leave in one place. The screens cover shipping orders, confirming or cancelling bookings, inquiry status, approving or hiding reviews, the newsletter list and banning members. The screens are installed, but they only turn on once the operator decides who may enter (an owner email or an admin).
- You need: sign-in (`G-auth`) and the database (`G-db`) done. For the owner-email route, the inquiry alert email `INQUIRY_OWNER_EMAIL` or the booking alert email `BOOKING_OWNER_EMAIL` (whichever you use) must be set, and an account that signed up with that address and finished email verification must exist. For the admin route you need a way to edit one row in the database directly (a query tool from your database service).
- Register: nothing. No new outside service account is needed.
- Config: there are seven sections, and a section disappears when its part is off — orders (`orders`) and stock (`stock`) belong to selling (`commerce`), then bookings (`bookings`), inquiries (`inquiries`), reviews (`reviews`), newsletter (`newsletter`) and users (`users`). The sidebar shows only the sections the signed-in person may open.
- Config: two kinds of people can enter. **Owner** — signed in, email verified, and the verified address equals the section's owner email (leading/trailing spaces and case are ignored; both must be non-empty). Inquiries and reviews use `INQUIRY_OWNER_EMAIL`, bookings use `BOOKING_OWNER_EMAIL`. An owner enters without two-step sign-in. **Admin** — the user row's role is `admin` and the person has two-step sign-in on. A comma-separated role list (`admin,support`) counts as admin when it contains `admin`. The orders, stock, newsletter and users sections open for admins only.
- Config: a signed-out visitor, an admin impersonation session and a banned user cannot open any section. An admin role without two-step sign-in is stopped with `two_factor_required` (the same person still enters as owner for a section whose owner email matches theirs).
- Config: the first admin is not made from a screen. In the database, change `role` on the user row to `admin`. Then change `AUTH_FEATURES` in `template/lib/launch/features.ts` to `{ twoFactor: true, admin: true }` — both default to off; while off, the admin entrance stays closed and the users section is hidden.
- Config: **limit of the current template** — the "two-step sign-in" row on the account screen is hidden on purpose, so there is no screen to turn two-step sign-in on. That means the admin-only sections (orders, stock, newsletter, users) cannot yet be opened from screens alone. The owner route (inquiries, bookings, reviews) works regardless. A two-step enrollment screen is follow-up work.
- Config: an action (change status, cancel, hide, ban) is not run until the server receives the human confirmation input (`confirmed: true`). One action per section may be marked dangerous — cancelling an order (refund), cancelling a booking, marking an inquiry as a complaint, hiding a review, marking a newsletter address unsubscribed, banning a user. Admin-only actions are hidden from owners and answer `forbidden`.
- Config: contact columns (email, phone, name) go out partly hidden in lists and summaries (for example `k***@example.com`). The order detail shows the recipient, phone and address in full because shipping needs them — each read writes an access log.
- Config: every read writes one access-log line (`access_logs`) and every action writes one action-log line (`admin_actions`). The action log does not keep the values typed into forms. If the read log fails, the read is refused too. Rate limits are 120 reads and 30 writes per minute, and the action entrance adds 60 per minute.
- Config: the screens (`/admin`, `/admin/<section>`, `/admin/<section>/<record id>`) are not indexed by search engines (`noindex`). An error thrown inside a section shows only a generic message; the server log keeps only the error name and place.
- Config: after install, list every `@launch-factory/*` package you use in `transpilePackages` of `next.config.ts` and add `@electric-sql/pglite` to `serverExternalPackages` (install note 7 of this item). How to add a section is in `docs/guides/admin-sections.md`.
- Config: booking cancel refunds — when the owner or the system cancels a booking that has a deposit, the full amount is refunded by default, whatever the time. Change the percentage with `depositPolicy.ownerCancelRefundPercent` (0 to 100) in `lib/launch/booking-config.ts`. The rules for a customer's own cancel (full refund until the cancel deadline, then `laterRefundPercent`) are unchanged.
- Config: known limits — the same person passes two limits at once, `adminAct` (60 per minute) and the console write limit (30 per minute). The search box is answered by the server — users and newsletter by email, inquiries by reference, name and contact, bookings by reference, name and contact (email or phone), reviews by title, text and author name. Reviews keep no author email, so an email cannot find a review (checked with a browser test).
- Check: owner route — sign up with the owner email and verify it → sign in → `/admin` shows the inquiry, booking and review sections → open one test record and see its detail → run one action with the confirmation input → the status changes. Admin route — after changing the role and `AUTH_FEATURES` and with an account that has two-step sign-in on, the users and orders sections show. Blocked route — opening `/admin` while signed out shows only a sign-in notice.
- Stuck: `/admin` shows only "cannot enter" → signed out, impersonation, banned, owner email mismatch (including an address whose email is not verified), or an admin role without two-step sign-in. The screen hides which one and answers with the same text. Check the account's email verification and `role` first.
- Stuck: "no section to show" → you are in, but no section opens for you. No owner email matches, or only admin-only sections are on and you are not an admin.
- Stuck: the users section is missing → one of the two `AUTH_FEATURES` flags is off.
- Stuck: an action stops with `confirmation_required` → that is a wait for human confirmation, not an error. It runs after the confirmation step.
- Stuck: an action is blocked with `invalid_state` → it is already in that state (for example already cancelled). This is the guard that keeps a double press to one run.
- Stuck: cancelling an order does not report success → the status changed during the refund and the screen says so. Open the order again and check its state.
- Sources: the repository only — the install notes of `registry/feature-admin-console`, `docs/guides/admin-sections.md`, the admission logic in `packages/admin-console` (`admit.ts`), the template's `lib/launch/admin-console.ts`, `admin-identity.ts`, `features.ts` and the section modules in `lib/launch/admin-sections/`, and the plan 3d record (the "what is left" list in the PR body). There are no outside service screens or addresses.
