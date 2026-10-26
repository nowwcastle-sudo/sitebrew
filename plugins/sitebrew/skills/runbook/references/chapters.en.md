생성 파일 — 손으로 고치지 않는다 / Generated file - do not edit by hand

# Chapter texts (English)

The chapters are in the order of the data: what to do first comes first. The text below is every fact of the chapter. For a fact that is not in it, say it was not checked. The service data (cost kind, required, what stops if skipped) is on the chapter card.

## Contents

- G-hosting — Vercel
- G-analytics — PostHog
- G-biz-kr — National Tax Service, city/county/district office and PG company (Korea)
- G-db — Supabase
- G-domain — Domain registrar (domain seller)
- G-auth — Better Auth
- G-admin — launch-factory
- G-email — Resend
- G-billing — Paddle
- G-booking — launch-factory
- G-inquiry — 문의 접수 (메일 + 데이터베이스)
- G-notify — Kakao Alimtalk and text (Solapi)
- G-payments-kr — Korean payments (PortOne V2)
- G-commerce — shop (cart, orders, stock)
- G-push — Web push (VAPID)
- G-search — site search
- G-security — Cloudflare Turnstile
- G-consent — Launch Factory consent
- G-newsletter — newsletter subscription
- G-reviews — reviews and product questions
- G-storage — file upload (S3-compatible storage)
- Shared section: booking-notify-push
- Shared section: commerce-site-owner
- Shared section: reviews-search-storage-newsletter

## G-hosting — Vercel

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

## G-analytics — PostHog

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

## G-biz-kr — National Tax Service, city/county/district office and PG company (Korea)

This is not legal or tax advice. Check with the authorities (the National Tax Service, your city/county/district office) or a professional.

- Why: taking money through a site in Korea has an order. Business registration → mail-order (online sales) business report → card payment (PG) merchant review. The papers for each step come from the step before it.
- What you need: an ID, the kind of business and the business address, and the address of the site that really sells the goods or service (after the hosting and domain chapters).
- Register 1 — Business registration: apply at a tax office or on the National Tax Service's Hometax. Apply within 20 days of the day you start the business. Processing takes a few days. The exact number of days was not checked [확인 안 됨] — confirm it with the tax office or Hometax.
- Register 2 — Mail-order business report: this is a **separate report** from business registration. Report to the city/county/district office that covers your business address, on Government24 or in person. Processing takes a few days. The exact number of days was not checked [확인 안 됨] — confirm it in the Government24 notice or with your local office. If you take payment before delivery, you must hand in a purchase-safety service confirmation with the report. Some businesses may be exempt from reporting; ask your local office whether you are.
- Register 3 — PG merchant contract: the card and easy-payment connection this kit has an adapter for is PortOne (V2) only (outcome `shop`). Apply for electronic payment at PortOne and give your business details; the PG company contacts you within 3 business days on average and checks whether it can take you on. That check needs the site that really sells the goods to be set up. After the contract, the card company review takes about 2 weeks, and real payments fail until it ends. Putting the values into the host after approval is done in the shop payments chapter (`G-payments-kr`). Overseas card subscriptions (Paddle) are the `G-billing` chapter and a different path from the PG contract here.
- Config: after registering, put your business details on the site. Add the environment variables `LF_BUSINESS_NAME`, `LF_BUSINESS_ADDRESS`, `LF_BUSINESS_PHONE` and `LF_BUSINESS_EMAIL` in the host dashboard. The names of the fields for the representative, the business registration number, the hosting provider and the mail-order report number are in the "business information" section of `.env.example`. Add the report number only after the report is done. The footer draws only the fields that have a value.
- Check: the site footer shows the business details. In the site folder, `npm run doctor -- --stage preview` warns when a field that must be shown is empty (it never prints the values).
- Stuck 1 — The order is backwards: the mail-order report and the PG contract need the business registration papers. Start with business registration.
- Stuck 2 — The report is said to lack papers: if you take payment before delivery, check whether the purchase-safety service confirmation is missing.
- Stuck 3 — The PG company says it is hard to take you on: each PG company accepts different kinds of business. Also check that the site is set up, since the review needs it.
- Stuck 4 — You signed but real payments fail: the card company review has not ended. Wait about 2 weeks (it cannot be sped up here).
- Sources: National Tax Service (business registration guide, Hometax), Government24 (mail-order business report), Fair Trade Commission (mail-order business registration information), Korea Consumer Agency Consumer24 (purchase-safety service guide), PortOne developer documents and help center (electronic payment application, PG contract, card company review). This repository's `.env.example` and `packages/payments-kr`.

## G-db — Supabase

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

## G-domain — Domain registrar (domain seller)

- Why: to use **an address with your own name** instead of the one the host gave you. Connecting has three parts: buy the domain, point its address book (DNS) at the host, and change the address the app knows.
- What you need: the project you deployed in the hosting chapter, and a way to pay for the domain.
- Register 1 — Find out at a domain seller (a registrar) whether the name you want is free, and buy it. A domain is held for a set period and must be renewed before the period ends. Follow the seller's guide for how and for how long.
- Config: In the domain screen of the host (Vercel) project, add the domain you bought. Decide whether to use both the root domain (the name right before `.com`, for example) and a subdomain (for example one starting with `www`).
- Config: Point the address book (DNS) at the host. Pick one of two ways. (a) In the DNS screen of the seller where you bought the domain, add records — an A record for the root domain, a CNAME record for a subdomain. Use exactly the values Vercel shows in the project's domain screen. (b) Change the domain's nameservers to the ones Vercel shows — then Vercel manages the DNS. Before you change them, copy the records that exist now (MX for email, verification TXT and so on) to Vercel first. If you do not, email can stop (Vercel's warning).
- Config: Change the environment variable `NEXT_PUBLIC_APP_URL` to the new address (starting with `https://`, no path) and **deploy again**. A changed environment variable applies only to deployments created after the change.
- Config: Fix the other services that hold the old address, such as the callback address registered with a sign-in provider and the webhook address in payment or email services. Find the item with the same name in the matching chapter.
- Check: the Vercel domain screen shows the connection as healthy. Opening the new address shows the site, with the secure mark (HTTPS) in the address bar. Vercel issues the certificate automatically.
- Stuck 1 — You changed it but it does not open: DNS changes take time to spread. A nameserver change can take a day or two. There is nothing to fix; you can only wait. Meanwhile the Vercel screen may still show it as not connected.
- Stuck 2 — It is connected but a security warning shows: the certificate is issued after DNS has spread correctly. Wait a little. If the domain has a CAA record, change it to allow the certificate authority (Let's Encrypt).
- Stuck 3 — Vercel says the values are wrong: compare the record type (A for the root, CNAME for a subdomain) and the value, character by character, with what Vercel shows.
- Stuck 4 — The address stopped one day: check at the seller whether the domain's renewal date has passed.
- Sources: Vercel documentation — adding a domain to a project and DNS setup (A, CNAME, nameservers), domain troubleshooting (propagation time), automatic SSL certificates (including CAA records). This repository's `.env.example`.

## G-auth — Better Auth

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

## G-admin — launch-factory

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

## G-email — Resend

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

## G-billing — Paddle

- Why: to sell plans and receive subscription state, the site needs a Paddle account, prices, an API key and a webhook secret. If any is missing, checkout does not open.
- What you need: an email address, a deployed host (for the notification URL), and the email chapter (`G-email`) and database chapter (`G-db`) finished first. Before real payments, owner/business details and a public site with terms, privacy and refund pages.
- Register 1 — create a Paddle **sandbox** account and confirm the email. Sandbox and live are separate accounts; API keys, client-side tokens, notification destinations, products, prices and customers are not shared. Create the sandbox account even if you already have a live one. Sandbox takes test payments with no verification.
- Register 2 — in the sandbox dashboard create a product and its prices (one product with prices; for subscriptions give the price a billing cycle; a plan with a trial needs a separate price that has a trial period). Put the price ids (they start with `pri_`) into the config.
- Register 3 — create an API key in the sandbox. In the developer tools area, open the authentication menu, create a new API key, choose only the permissions you need and set an expiry. The key is shown only once → `PADDLE_API_KEY`. A key expires 90 days after it is created by default (Paddle docs: up to 1 year can be set), and billing calls fail once it has expired — before that, create a new key, replace the host environment variable and deploy again.
- Register 4 — create a notification destination in the sandbox. Type URL, address `https://<domain>/api/webhooks/paddle` (the path this repository serves). Events: subscription events (`subscription.*`) and the transaction events `transaction.completed`, `transaction.payment_failed`, `transaction.past_due`. Copy the destination's secret key → `PADDLE_WEBHOOK_SECRET`. Recreating a destination gives a new secret key, so update the host value too.
- Register 5 — set the default payment link in the sandbox. Sandbox needs no domain approval. Paddle's docs say to set it before creating transactions, and this repository's adapter also requires this link.
- Register 6 — if you use the overlay checkout, create a client-side token (same authentication menu). Sandbox tokens start with `test_`, live tokens with `live_` → `PADDLE_CLIENT_TOKEN` (a public value, not the API key). Left empty, checkout goes to the Paddle payment link.
- Register 7 — going live (only when you open for real): ① create a separate live account. ② Recreate products, prices, API key, client-side token and notification destination in live (sandbox ones do not carry over). ③ Submit your website (domain) for approval — the live checkout opens only on approved domains. ④ After approval, set the live default payment link (the host must equal an approved domain exactly or be its `www.` version; a subdomain such as `app.` needs its own approval). ⑤ An account administrator completes account verification (KYC/KYB): personal and business details, website address, a description of what you sell; more documents may be requested. ⑥ Add payout details.
  - Waiting: Paddle's docs say verification usually finishes within a day but can take several days depending on location and product. The docs give no number of days for domain approval. So start verification before the sandbox integration, and submit the domain in parallel. Automated review of verification waits until at least one domain is approved.
  - What the site needs (Paddle's verification prep): public terms, privacy and refund pages, prices that match the Paddle catalog, and a contact email or form reachable from the homepage.
- Config: host environment variables (dashboard or `vercel env add <NAME>` stdin): `LF_MODE` (live for a live deploy), `PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET`, `PADDLE_CLIENT_TOKEN` if you use the overlay, `NEXT_PUBLIC_APP_URL` (the deployed address), `CRON_SECRET` (for the billing Cron; without it the Cron route returns 401). Reuse the database value (`DATABASE_URL`) from `G-db`, the mail values (`RESEND_API_KEY`, `EMAIL_FROM`) from `G-email`, and the already set bot-protection values `TURNSTILE_SECRET_KEY` and `TURNSTILE_SITE_KEY`.
- Config: write the plans and Paddle price ids in `lib/launch/paddle-plans.ts`. If empty, checkout does not open (`unknown_plan`). A plan with a trial needs both the price id without trial and the price id with trial.
- Config: add the `/api/cron/billing` Cron to `vercel.json` (the repository note uses an hourly schedule).
- Config: keep the live switch `LF_PADDLE_LIVE` empty in sandbox. Only the value 1 goes to real payments — the site owner sets it after the live account, keys and destination are ready.
- Config: if you turned on Paddle's payment-recovery emails (Retain) in live, set `LF_PAYMENT_FAILED_EMAIL` to off (so the payment-failed notice is not sent twice). `LF_EU_SALES` decides whether you sell to EU payment countries (default open, off closes it).
- Config: starting checkout always requires the withdrawal-limit consent checkbox. There is no setting to turn it off.
- Check: in sandbox sign up → pick a plan → pay with a Paddle test card (from the official docs) → the Paddle dashboard's notification log shows success (2xx) → the site's billing screen shows the subscription state. Never use a real card. After going live, pass Paddle's full checklist (domain approved, verification complete), then try one live purchase with a 100% discount.
- Stuck: signature error (401) → often the destination was recreated and the secret changed; set the new `PADDLE_WEBHOOK_SECRET` on the host. A sandbox key used against live is rejected (do not mix sandbox and live keys). No notifications → your server must return 2xx within 5 seconds, otherwise Paddle retries (Paddle docs: sandbox 3 attempts within about 2 minutes, live up to 60 attempts over about 2 days). Host protection on a deploy preview also blocks Paddle's notifications. Live checkout does not open → the domain is not approved yet, or the default payment link host differs from the approved domain.
- Sources: Paddle developer docs (developer.paddle.com) — Sandbox, Set up checklist, Authentication (API keys, client-side tokens), Notification destinations, Respond to webhooks, Signature verification, Default payment link, creating products and prices, Verifications. This repository: `.env.example`, `features/outcomes.yaml`, the install notes of `registry/feature-billing-paddle`, `packages/billing-paddle`.

## G-booking — launch-factory

- Register: nothing. One address for notices (`BOOKING_OWNER_EMAIL`; a non-email value stops boot).
- Config: `lib/launch/booking-config.ts` — services, hours, closed days, capacity, cancel deadline, reminder time. `mode`: `"instant"` or `"request"` (needs confirming in the admin Bookings section).
- Cron: `/api/cron/booking`, `*/30 * * * *` in `vercel.json`. Reminders and retention purge. 401 without `CRON_SECRET`.
- Form: hidden inputs `cf-turnstile-response` and `idempotencyKey` (made when the form opens).
- Check: no `env:check` warning → `/book` draws the form → test booking → owner mail arrives.
- Deposit: put `deposit` (KRW) on a service and add `feature-booking-deposit` (needs the `payments-kr` gateway). Submit → pending payment (the slot is held for `depositPolicy.holdMinutes`, default 30) → paid means confirmed. The same cron closes expired holds and frees the slot. Cancelling inside the deadline refunds in full (after it, `laterRefundPercent`); when the owner cancels from the admin screen the customer gets `ownerCancelRefundPercent` back regardless of timing (default 100, settable 0–100); if the refund fails the booking is not cancelled and can be retried. Amount and payment id are kept 5 years. Limit: reloading loses the payment step (book again or wait for the hold to expire).

(This chapter also reads the shared section of the same file: booking-notify-push)

## G-inquiry — 문의 접수 (메일 + 데이터베이스)

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

## G-notify — Kakao Alimtalk and text (Solapi)

- Register 1 — Solapi account (identity verification). Personal accounts have small daily limits and few sender numbers; business accounts have more.
- Register 2 — sender number (needed for text and fallback): only pre-registered numbers can send. Documents (telecom usage certificate, employment certificate, etc.), review 1–3 business days. → `SOLAPI_SENDER`.
- Register 3 — issue API Key/Secret → `SOLAPI_API_KEY`, `SOLAPI_API_SECRET`. (Console menu location varies by version; not verified here.)
- Register 4 — Alimtalk (optional): open a Kakao Talk Channel → business verification (business registration or unique-number certificate, representative ID, several days) → channel public and searchable ON, customer-service contact set → link the channel in Solapi → channel id `KA01PF…` → `SOLAPI_KAKAO_PFID`.
- Register 5 — Alimtalk template review: register and request review in Solapi; Kakao review usually 1–3 business days. **Only informational wording passes** (advertising or payment-inducing wording is rejected or needs justification). A submitted template cannot be edited (not even a typo) — register a new one. A template with no sends for a year goes dormant. Approved id → `NOTIFY_TEMPLATES.alimtalkId` in `lib/launch/notify-kr-config.ts`. Before and during review, text is sent instead.
- Advertising text (`purpose: "marketing"`): channel consent (`feature-consents`) + not 21:00–08:00 + "(광고)" prefix + free opt-out number (`MARKETING_OPT_OUT_NUMBER`). Any miss → `skipped` with a reason. The sending screen is the product's job.
- Check: test booking with a phone number → text/Alimtalk arrives → Solapi send history (kept 12 months). Email only → one of the three `SOLAPI_*` values is empty.
- Stuck: "channel already in use" → linked to another account, ask Solapi support. "Check channel status" → channel public ON, link again. Manager notification error → Kakao additional manager verification. Failed Alimtalk falls back to text; if text fails too, check sender registration.
- Source: Solapi guides (solapi.com/guides, /kakao-ata-guide), checked 2026-10-22.

(This chapter also reads the shared section of the same file: booking-notify-push)

## G-payments-kr — Korean payments (PortOne V2)

- Why: to take Korean card and easy-pay money, the shop needs a PortOne account, a payment channel, a server secret and a webhook secret. If any of the four values is missing, only the shop turns off and the rest of the site stays on.
- What you need: the Korean business chapter `G-biz-kr` (business registration, mail-order report, PG contract) finished first. The deployed site address (used for the webhook URL and the return URL), and the database (`G-db`) and hosting (`G-hosting`) chapters finished. An account that can set host environment variables.
- Register 1 — sign up at PortOne. Per its guide, signing up is free with no separate contract, and you must confirm the verification email before you can log in. To take real payments, submit the electronic-payment application in the console: enter your business details and apply for the PG and payment methods you will use. The number of days this takes is [확인 안 됨] (for the PG's reply and the card company's review, see the PG contract item in `G-biz-kr`). You can test with a test channel even before applying.
- Register 2 — find your store id. A main store is created automatically when you sign up, and each store has its own value → `NEXT_PUBLIC_PORTONE_STORE_ID`. It is a public value used to open the payment window.
- Register 3 — create a payment channel. In the console's channel management choose the integration mode (test or live), the payment company (PG) and the payment module. For a test channel pick a shared test merchant id or enter a test id you were given. For a live channel enter the merchant id and extra details you received after signing with the PG. The channel key you get when the channel is created → `NEXT_PUBLIC_PORTONE_CHANNEL_KEY` (a public value). Easy-pay (KakaoPay, NaverPay, TossPay) needs separate per-PG/per-provider contracts and review.
- Register 4 — issue a V2 API Secret in the console under the identification codes / API keys area. Only owner and admin accounts can issue or delete it, and the value is shown only right after issuing (if you lose it, issue a new one). Use it on the server only and never expose it in the browser → `PORTONE_API_SECRET`. Put it into the host environment on the spot.
- Register 5 — register the webhook. In the console's payment-notification (webhook) management area choose the webhook version payment module V2 and a setting mode, test or live. You can keep a separate URL and webhook secret per mode. The URL is `https://<domain>/api/webhooks/portone`; the webhook secret you issue (`whsec_…`) → `PORTONE_WEBHOOK_SECRET`. After changing the URL, save it before sending a test notification (testing without saving goes to the previously saved URL).
- Config: put the four values into the host environment variables (dashboard or `vercel env add <NAME>` stdin). The two `NEXT_PUBLIC_*` values are baked into the bundle at build time, so redeploy after changing them. Never put a value in chat, the repository or logs.
- Config: for a deploy where real money moves, set `LF_MODE` to live. In mock, mock payments are used even if the PortOne values exist.
- Config: for the Cron that cleans up pending orders to run, `CRON_SECRET` must exist on the host (reuse the value set in `G-hosting`). Without it the expiry cleanup does not run.
- Test vs live: the integration mode is per channel and the webhook is per mode. Pass with a test channel first, then switch to the live channel's channel key and the live-mode webhook URL and secret and redeploy. Whether the API Secret differs between test and live is [확인 안 됨], and an explicit PortOne statement that test channels never charge was also [확인 안 됨] — make the first test a small amount.
- Flow: the server creates the order and fixes the amount (the server catalog is the source of truth; client amounts are never read) → browser `requestPayment` (currency `KRW`) → mobile returns via `redirectUrl` → the server **re-fetches** the payment from PortOne by `paymentId`.
- Where verification happens (`packages/commerce` `confirmPayment`): status must be `PAID` and `amount.total` and currency (KRW) must equal the order row. Still pending → `payment_pending` (retryable); amount/currency differs → that payment is refunded and `payment_amount_mismatch` returned. Redirect-return and webhook call the same `confirmPayment`; whoever wins the order row's conditional update does the confirm, the mail and the `purchase` event — once, however often it is called. PortOne's docs also say the order in which the browser completion and the webhook arrive is not guaranteed, so both paths confirm by re-fetching.
- Webhook (`handleWebhook`): verify the signature on the raw body (`request.text()`, Standard Webhooks, 5-minute tolerance) → dedupe by `webhook-id` → only `Transaction.Paid` moves an order, and it re-fetches by `paymentId`. Replies: 400 bad signature/headers/body · 200 handled, duplicate or unused event · 503 not yet paid at the provider (record rolled back so PortOne resends) · 404 shop off or mock. Failed/cancelled events are only recorded. Per PortOne's docs the connection and read timeouts are 30 seconds each, and a failed webhook is resent up to 5 times with intervals that grow exponentially (the docs list 0 → 1 → 4 → 16 → 64 → 256 minutes, with random jitter).
- Cron expiry: pending orders expire after 30 minutes (`holdMinutes`). `/api/cron/commerce`, `*/10 * * * *` in `vercel.json` (up to 100 per run). If the provider already shows `PAID` for an expiring order it is confirmed, not cancelled (missed webhook); otherwise it is cancelled and stock is returned.
- Cancel/refund: a pre-payment order is cancelled and stock returned. After payment (`paid`, `preparing`) the PortOne refund must succeed before the order becomes `refunded` — on failure the status stays and `refund_failed` (retryable) is returned. Orders already in preparation are refunded without returning stock. A payment that arrives for an already-cancelled order is refunded in full. SDK 0.19.0 sends no `Idempotency-Key`, so idempotency is held by our own state transitions.
- Check: ① one small test payment on a test channel → order `paid` + confirmation mail ② cancel/refund that order → `refunded` + stock restored ③ send a test notification from the webhook settings and confirm a 200 reply. Whether the console has a delivery log screen for real payment notifications is [확인 안 됨] ④ open the payment window and close it; confirm the Cron cleans it up after 30 minutes.
- Stuck: ① Shop actions return `provider_unavailable` → one of the four PortOne values is missing (redeploy after changing `NEXT_PUBLIC_*`). ② Webhook returns 400 → the secret is from the other mode, or the clock is off by more than 5 minutes. ③ Paid but the order stays pending → the webhook URL is not registered; waiting lets the re-fetch and the Cron confirm it. The full symptom table is section 4 of this file.
- Legal wording: PortOne-side wording on total-price display and withdrawal is [확인 안 됨] — the site's legal pages (`/terms`, `/refund`) are the owner's review.
- Sources: PortOne developer documents (developers.portone.io) — preparing a payment integration, integration info (channels, identification codes, webhook management), webhook integration, quick guide, PortOne REST API V2. Repository: `.env.example`, `packages/payments-kr`, `packages/commerce`.

(This chapter also reads the shared section of the same file: commerce-site-owner)

## G-commerce — shop (cart, orders, stock)

- Why: to sell goods directly, the site needs a product list, shipping and stock limits, and a payment connection (`G-payments-kr`). This module handles the cart, orders, stock holds and the order confirmation mail.
- What you need: payment connected (`G-payments-kr`), the database (`G-db`) and email (`G-email`) chapters finished. The name, price, stock limit and shipping for each product you sell.
- Register: nothing. The external service is covered entirely by `G-payments-kr` above.
- Config: write the products and shipping in the code configuration `PRODUCTS` and `SHIPPING` in `lib/launch/catalog.ts`. This is the source of truth for prices. Stock limits are set here too (`stock: null` means unlimited). Do not change prices while orders are in flight.
- Config: the order confirmation mail goes out through the email chapter's setup (`G-email`). The sender address is `EMAIL_FROM`. If the mail fails the order is still confirmed.
- Order loop: add → cart → address → `placeOrder` (30-minute stock hold, payment session) → pay → `confirmPayment` → order list. `placeOrder` and `cancelOrder` change nothing without a human confirmation (`confirmed: true`; `confirmation_required`, not an error). A user can hold only a limited number of pending orders (`too_many_pending`).
- Write actions pass the rate limit first; during impersonation only reads work.
- Screens and handling: a public product list page (`/products`; its cards go to `/cart?add=<product id>`), the cart, checkout and my-orders screens, and the orders and stock sections of the admin screens (`G-admin`) exist. When an account is deleted, paid orders stay for 60 months as a pseudonymous payment record with no key to identify the buyer, and the shipping address of finished orders is cleared at once. Data export includes the user's own orders. Not there yet: a sold-out marker (the web-factory block has none) and a full loop through the real PortOne window (only checkable where keys exist).
- Check: `commerceEnabled()` true (live: the four PortOne values; mock: always) → server action `catalog` returns products → small test payment → order `paid` → mail.
- Stuck: ① Stock not released after expiry/cancel → the Cron is not running (no `CRON_SECRET`). Not returning stock for a refund after preparation began is by design. ② `too_many_pending` → pending orders reached the limit; they free up when they expire after 30 minutes or are cancelled. ③ `confirmation_required` → not an error; it is waiting for a human confirmation.
- Sources: this repository's `.env.example`, `packages/commerce` and `docs/qa/p3a-commerce.md`. External-service facts are in `G-payments-kr`.

(This chapter also reads the shared section of the same file: commerce-site-owner)

## G-push — Web push (VAPID)

- Register: nothing external. `npx web-push@3.6.7 generate-vapid-keys` for a key pair.
- Config: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (secret), `VAPID_SUBJECT` (`mailto:` or `https://`). Any missing or wrong → push only turns off. Changing the key invalidates existing subscriptions — do not change it.
- Conditions: HTTPS required (localhost excepted). iOS receives push only in an app added to the Home Screen. Signed-in users only (others get email/Alimtalk). Permission is asked only on a button press.
- Check: sign in → push button → allow → `(await push()).sendToUser(userId, { title, body })` → notice on the device. No button → check the three VAPID values.
- Stuck: push service 401/403 = our VAPID setup (subscriptions are not deleted). 404/410 = dead device (removed automatically). When to send is product code.

(This chapter also reads the shared section of the same file: booking-notify-push)

## G-search — site search

- Register: nothing. No separate search service; Postgres `ILIKE` finds documents (Korean substrings work, title matches rank higher).
- Index: the document list in `content/search-index.json`. A malformed file changes nothing (the old index stays).
- After the first deploy: results are empty until the Cron runs. Call it once: `curl -H "Authorization: Bearer $CRON_SECRET" https://<site>/api/cron/search`.
- Check: type a word from a document title → results with highlight ranges. An empty query returns an empty result, not an error.
- Note: past tens of thousands of documents `ILIKE` gets slow; review a separate search service then (outside this module).

(This chapter also reads the shared section of the same file: reviews-search-storage-newsletter)

## G-security — Cloudflare Turnstile

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

## G-consent — Launch Factory consent

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

## G-newsletter — newsletter subscription

- Register: no new account. The `G-email` Resend account and a verified domain (`EMAIL_FROM`) must exist first or confirmation mail is not sent. Bot check is Turnstile.
- Consent: the checkbox is **never pre-checked** (Korean Network Act art. 50). When you change the wording, bump `NEWSLETTER_CONSENT_VERSION` — the version consented to is stored on the subscriber row.
- Flow: request → confirmation mail (double opt-in) → click → welcome mail. A request for an address that already subscribes gets the same response (existence is not revealed).
- Links: confirm and unsubscribe links are signed with a secret derived from `BETTER_AUTH_SECRET`. A mail scanner that opens links first can confirm before a human clicks — if needed, make `/email` show a button that POSTs (item doc, point 4).
- Sending: not this module's job. Pass the service's subscriber list (with `unsubscribeUrl`) to your sending tool, which puts the unsubscribe address in each body link and in the `List-Unsubscribe` header (one-click). The "(광고)" subject prefix, sender identification and business details are the sender's duty.
- Check: subscribe a test address → confirmation mail arrives → click → subscribed → subscribe the same address again and see the same screen. No mail → check `G-email` (key, domain verification).

(This chapter also reads the shared section of the same file: reviews-search-storage-newsletter)

## G-reviews — reviews and product questions

- Register: nothing.
- Config: the subject is the product's choice — `subjectType` (lowercase, digits, `-_`) plus `subjectId`. Publishing mode is `REVIEWS_MODERATION` (`after` publish then review, `before` review then publish).
- Form: hidden inputs `cf-turnstile-response` and `idempotencyKey`. Reviews need a signed-in user, one per subject; questions work signed out.
- Admin: the `reviews` admin section (`/admin/reviews`) — moderation list, seller reply, approve, hide (reason required; the section sends a fixed reason, one audit line) and show again. The old server actions (`answerReview`, `setReviewStatus`, `listReviewsForModeration`) are gone: the section calls the service directly. Permission comes from the session user row (owner, admin).
- Account deletion: the author name becomes "Deleted user" and the user link is cut. The text stays as public content. Enabled in the full template's `lib/launch/purgers.ts`.
- Check: submit a test review → it shows in the list and the rating summary → hide it → it leaves the list.

(This chapter also reads the shared section of the same file: reviews-search-storage-newsletter)

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

(This chapter also reads the shared section of the same file: reviews-search-storage-newsletter)

## Shared section: booking-notify-push

## 0. mock vs live


With `LF_MODE=mock` (default) all three run with no outside call. Register only to send to real customers.

| Feature | mock | live, when missing |
|---|---|---|
| Booking | Starts with a fake owner address; submit/look up/cancel/confirm all work | No `BOOKING_OWNER_EMAIL` → intake only turns off; existing bookings keep look-up, cancel, reminders |
| Korean alerts | Outbox file (`LF_MOCK_NOTIFY_OUTBOX`) gets last 4 digits, template, channel, time | Any of `SOLAPI_API_KEY`/`SOLAPI_API_SECRET`/`SOLAPI_SENDER` missing → feature off; booking notices by email only |
| Web push | Subscriptions stored, sends only logged; mock subscriptions are unusable in live | Any VAPID value missing or malformed → feature off (no push button) |

## 1. Environment variables


Source of truth: `.env.example`. Optional names do not stop the site from starting.

| Name | Secret | Feature | If missing |
|---|---|---|---|
| `BOOKING_OWNER_EMAIL` | personal data | Booking | Intake off |
| `TURNSTILE_SECRET_KEY` · `TURNSTILE_SITE_KEY` · `CRON_SECRET` | first and last: yes | Booking form/Cron | Required by the booking item (reuse existing values) |
| `SOLAPI_API_KEY` · `SOLAPI_API_SECRET` | **yes** | Alerts | Alerts off |
| `SOLAPI_SENDER` | no | Alerts (registered sender number, digits only) | Alerts off |
| `SOLAPI_KAKAO_PFID` | no | Alerts (Kakao channel id) | Text only, no Alimtalk |
| `VAPID_PUBLIC_KEY` · `VAPID_SUBJECT` | no | Push (`mailto:` or `https://`) | Push off |
| `VAPID_PRIVATE_KEY` | **yes** | Push | Push off |

`npm run env:check -- --vercel` checks required names and `BOOKING_OWNER_EMAIL` only; Solapi and VAPID names are not covered yet.

## Shared section: commerce-site-owner

## 0. mock vs live


With `LF_MODE=mock` (default) mock payments are used even if keys exist. Real money moves only in live with all four PortOne values set.

| Area | mock | live, any value missing |
|---|---|---|
| Payment gateway | Self-built mock (no keys, no outside call, memory only so pending payments vanish on restart). PortOne has no keyless sandbox, so previews use this mock | **Only the shop turns off.** `commerceEnabled()` is false |
| Webhook `/api/webhooks/portone` | 404 (not accepted) | 404 (not accepted without the secret) |
| Shop server actions | Work (mock payment `payWithMock`) | `provider_unavailable`, `retryable: false`; the site and other features stay on |
| Cron `/api/cron/commerce` | Expiry cleanup of a running shop | `{ skipped: "commerce_disabled" }` — not an error |

## 1. Environment variables


Source of truth: `.env.example`. All four are optional — the site starts without them and only the shop stays off.

| Name | Secret | Feature | If missing |
|---|---|---|---|
| `NEXT_PUBLIC_PORTONE_STORE_ID` | no (public in the browser) | Payment window | Shop off |
| `NEXT_PUBLIC_PORTONE_CHANNEL_KEY` | no (public in the browser) | Payment window (channel key) | Shop off |
| `PORTONE_API_SECRET` | **yes** | Server re-fetch, cancel/refund | Shop off |
| `PORTONE_WEBHOOK_SECRET` (`whsec_…`) | **yes** | Webhook signature check | Shop off |
| `CRON_SECRET` | **yes** | Auth for `/api/cron/commerce` (reuse the existing value) | Cron 401 — expiry cleanup does not run |
| `EMAIL_FROM` (+ mail item setup) | no | Order confirmation mail | Mail only is skipped (logged via `onError`; the order still confirms) |

`NEXT_PUBLIC_*` values are baked in at build time — redeploy after changing them. No value is printed anywhere; the reason for being off names the variables only. Channels and webhooks are separate per test/live mode (official); whether the API Secret differs between them is [확인 안 됨].

## 3. Cheaper options (placeholder for the check)


- Korean payments have options beyond PortOne: other Korean PGs and aggregators, link-based payment, bank transfer only. This document records no fees or prices (they change and were not checked).
- When asked "is there a cheaper way?", the plugin only explains what can sit in this module's payment slot (`PaymentGateway`) and what to check. Comparisons come from each provider's official pricing, checked by the owner.

## 4. Stuck (symptom → cause → fix)


| Symptom | Cause | Fix |
|---|---|---|
| Shop actions return `provider_unavailable` (`retryable: false`), only a shop notice shows | In live, one or more of the four PortOne values is missing (or blank) | Check the four names with `npm run env:check` and the host env (redeploy after `NEXT_PUBLIC_*` changes). The reason names variables only |
| Webhook returns 400 | Wrong `PORTONE_WEBHOOK_SECRET` (including a secret of the other mode), body parsed before verifying, clock off by more than 5 minutes | Use the secret of the matching mode. Read the logged reason (`signature_mismatch`, `missing_headers`, `timestamp_*`) |
| Webhook returns 500 | Malformed secret (not `whsec_…`) or a DB error | Fix the secret format for config errors. On a DB error the record is rolled back and PortOne resends |
| Webhook returns 404 | Shop off or mock | As the first row / confirm `LF_MODE=live` |
| Paid but `payment_amount_mismatch` | Server order amount/currency differs from the PortOne payment (catalog price changed after the order, currency mismatch) | An automatic refund is attempted (on failure `onError` raises an ops alert — cancel at PortOne by hand). Do not change prices while orders are in flight |
| Order stays `pending_payment` | Webhook late or unregistered, mobile redirect did not return | `confirmPayment` re-fetches, so it confirms when you wait (503 is the retry signal); the 10-minute Cron re-checks expired ones. Check webhook URL registration and `CRON_SECRET` |
| Stock not released after expiry/cancel | Cron not running (no `CRON_SECRET` → 401, no crons in the deployed `vercel.json`) or a refund after preparation began (stock is not returned) | Fix the Cron setup. The after-preparation case is by design — adjust stock by hand |
| Refund returns `refund_failed` | PortOne rejected the cancel (already cancelled, over the cancellable amount, etc.) or a wrong API Secret | Status is unchanged — fix the cause and cancel again. Mapping of PortOne error codes: [확인 안 됨] |
| Payment window does not open | Wrong `storeId`/`channelKey`, channel not approved, reused `paymentId` | Check the two public values and the channel state. The server mints a fresh `paymentId` |

## Shared section: reviews-search-storage-newsletter

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
