# Secrets and environment usage

Names only. No value appears in this file, in the repositories, or in any log of the export run.
Sources: `.env.example`, `factory/doctor.mjs`, `packages/env`, `.github/workflows/*` and a search of the source for `process.env.*` / `readSecret(...)` in the two kits (web-factory and launch-factory at the tags pinned in the plugin's `compat.json`). Refreshed against the web-factory source at `b0694a48` (factory v1: preview mode, optional keys, `WF_REQUIRE_KEYS`, `WF_DESIGN_RULES_DIR`, 3D object hero switches) and the launch-factory source at `0016a7a`.

**You need no key to start.** Without any key `npm run stamp` builds in preview mode (stock photo slots stay "image in progress" placeholders, generated-image slots become `higgsfield.request.json` requests, Korean legal pages stay "unverified" and the result is marked not publishable). Every row below says what turns off when a name is missing.

## How values are read

- Only from the process environment. The old Windows user-environment fallback is **off** unless `FACTORY_USER_ENV=1` is set (covered by `factory/scripts/secret-env-optin.test.mjs` and `packages/env/test/user-env-optin.test.mjs`).
- Windows, three ways:
  1. The plugin settings dialog of `sitebrew` (the four names `PEXELS_API_KEY`, `LAW_API_OC`, `VERCEL_TOKEN`, `HIGGSFIELD_DIR`). A session-start hook copies each non-empty option into the shell environment of that session; restart Claude Code after a change. A variable you set yourself wins. The copy is a plain-text file in the `session-env` folder of your Claude profile and is not removed automatically.
  2. Permanently, in PowerShell: `setx NAME "<your value>"`, then close and reopen Claude Code (a `setx` value reaches only terminals started afterwards).
  3. For one PowerShell window only: `$env:NAME = "<your value>"`, then start `claude` from that window.
- Never paste a key into the chat. The plugin's doctor prints a name, whether it is set, and its length.

"You supply it" means a plugin user must create the account or key themselves. Nothing here is shared with the maintainers.

## web-factory (the repository root)

### Keys and tokens (all optional)

| Name | Read by | Required? | What breaks without it | You supply it? |
|---|---|---|---|---|
| `LAW_API_OC` | `factory/legal/law-api.mjs`, `factory/doctor.mjs --stage legal\|stamp` | Optional. Needed only to publish a **Korean-language** site. English pages do not use it. | Preview mode: Korean legal drafts cannot be checked against the statute text (clauses stay `unverified`), so the site is marked not publishable. The doctor prints a note and exits 0. | Yes. The ID comes from an Open API application at open.law.go.kr (Korean National Law Information Center). |
| `PEXELS_API_KEY` | `factory/media/fetch-pexels.mjs`, `factory/stamp/media.mjs`, `doctor --stage media\|stamp` | Optional | No stock photos or videos are fetched; those slots stay "image in progress" placeholders. | Yes. Free key from pexels.com/api. The photo terms are Pexels' own; the public export ships no photo. |
| `VERCEL_TOKEN` | `factory/stamp/deploy-preview.mjs`, `doctor --stage publish` | Optional (only for `stamp --deploy-preview`). A logged-in `vercel` CLI works instead. | No online preview link. | Yes, your own Vercel account. |
| `POSTHOG_PROJECT_KEY` | `doctor --stage learn` | Optional | The `learn` doctor stage fails. Nothing else reads it. | Yes, your own PostHog project. |
| `GH_TOKEN` | shadcn CLI in CI (see README "Installing in CI") | Optional. Needed only when the registry repository you install from is private. | Private installs return 401. | Yes, a fine-grained read-only token of your own. |
| `INDEXNOW_KEY` | `registry/factory/ax/freshness.tsx` (installed into your site; your publish script calls `pingIndexNow`) | Optional | Search engines are not told about changed pages through IndexNow. | Yes, you create it. It is public by design: IndexNow reads it from a file on your own site. |

A key that is **set but wrong** always fails the doctor, in every mode.

### Paths and switches

| Name | Read by | Required? | What breaks without it | You supply it? |
|---|---|---|---|---|
| `CHROME_PATH` | `factory/qa/cdp.mjs` (every browser gate: step 07, board photos, `qa:*`) | Needed on Windows when Chrome is a per-user install. | The kit looks for a browser only at `C:/Program Files/Google/Chrome/Application/chrome.exe`, `C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe`, `/usr/bin/google-chrome` and `/usr/bin/chromium`. A Chrome under `%LOCALAPPDATA%\Google\Chrome` is not found. With no browser the gates stop with "Chrome/Edge not found". The plugin's doctor checks this. | Yes. Full path of `chrome.exe` or `msedge.exe`. |
| `HIGGSFIELD_DIR` | `factory/doctor.mjs` (stages `media`, `stamp`), `factory/media/build-media.mjs` | Optional. A folder of images you generated yourself. | Generated-image slots are not produced; they are written to `higgsfield.request.json`. A path that is set but does not exist fails the doctor. | Yes. The maintainers' generated-video folder is not part of the export. |
| `WF_REQUIRE_KEYS` | `factory/doctor.mjs` | Optional. `1` = strict mode (same as `--strict`). | Nothing. Default is preview mode. With `1`, a missing `LAW_API_OC`, `PEXELS_API_KEY` or `HIGGSFIELD_DIR` fails the doctor and `stamp` does not start. | You choose. |
| `WF_DESIGN_RULES_DIR` | `factory/lib/design-rules.mjs` | Optional. A folder of reference material (visual baselines for the regression gates, source collections). | Without it (and without a repository copy) those inputs are skipped with one line; the factory still runs. | Yes, your own folder. |
| `WF_CODEX_IMAGES` | `factory/stamp/object-media.mjs` | Optional. `1` lets the 3D object hero make its source image with the Codex CLI. | The hero falls back to a 2.5D image, then to a poster; with no image at all the kit does not pick that hero. | Needs `codex` installed and signed in. |
| `WF_GLTF_TOOLS` | `factory/media/optimize-glb.mjs` | Optional. Folder where you installed gltf-transform. | GLB models over 2 MB are not shrunk. | Yes. |
| `WF_MEDIA_PREVIEW` | `factory/stamp/media.mjs` | Optional. `1` fills photo slots with stock images marked "preview only". | Slots stay placeholders; the site stays not publishable either way. | You choose. |
| `FACTORY_USER_ENV` | `factory/lib/secret-env.mjs` | Optional. `1` turns on the Windows user-environment fallback. | Nothing. Default is off. | You choose. |

### Optional tools and tuning

| Name | Meaning (where it is read) |
|---|---|
| `WF_HYPERFRAMES` | `1` renders video backgrounds. Needs Chrome, ffmpeg and npx (`factory/media/render-hyperframes.mjs`). |
| `HYPERFRAMES_DIR` | Location of the Hyperframes tool (`factory/media/build-media.mjs`). |
| `WF_GITLEAKS_BIN` | Path to a gitleaks binary used by the commit hooks. |
| `CI_TEST_CONCURRENCY` | Number of test files that run at once in `npm run ci:test`. |
| `WF_NAV_TIMEOUT_MS`, `WF_CDP_TIMEOUT_MS`, `WF_TOOL_TIMEOUT_MS` | Time limits of the Chrome-driven gates (`factory/qa/cdp.mjs`). Raise them on a busy computer. |
| `WF_SH_TIMEOUT_MS` | Time limit of each install or build command the site generator runs (`factory/stamp/site-install.mjs`, default 20 minutes). |
| `WF_SESSION` | Signed-in/out scene for the Chrome gates (`--session`). |
| `WF_BUILD_CPUS`, `WF_BUILD_LOWMEM`, `WF_BUILD_SKIP_TYPECHECK`, `WF_BUILD_SPLIT_TYPECHECK`, `WF_STATIC_EXPORT`, `WF_DEFER_HYDRATION`, `WF_DEFER_FONTS`, `WF_STRICT_FADE`, `WF_INSTALL_TEST`, `WF_BOARD_SHOTS`, `WF_MOTION_LINKED_INDEX` | Build, gate and test switches read in `factory/stamp/*`, `factory/qa/*`, `factory/board/*`. Defaults are fine for normal use. |
| `WF_VISUAL_BASELINE`, `WF_PAGE_VISUAL_BASELINE` | Folders of reference screenshots for the visual regression gates. |
| `WF_SCENE_ORIGIN`, `WF_BOLD_GALLERY`, `WF_BOLD_RECIPE`, `WF_O3_GALLERY`, `WF_O3_RECIPE` | Address of a running gallery (`npm run build && npm start`) and recipe for the scene board and the browser tests of bold scenes and the 3D hero. |
| `STAMP_EXPORT_*`, `STAMP_PAGES_*`, `STAMP_SITE_FONTS` | Debug switches of the stamp pipeline and its tests. |
| `WF_OWNER_MARKERS`, `WF_ADD_RECIPE_KEEP`, `WF_ADD_RECIPE_COPY_DIR`, `WF_WRITE_APP_SHELL_BASELINE` | Test-only: comma-separated words that delivered files must not contain; keep or place the temporary copy of the add-a-recipe test; rewrite a test baseline. |
| `REL11_ORIGIN`, `REL12_ORIGIN`, `REL12_SHOTS`, `T7C_EXPECT_ALL`, `PROBE_SCENES`, `AI_TELL_KAS_SCAN`, `SHELL_FOCUS_NO_PADDING`, `FV1_EXTDEPS_PROBE`, `FV1_EXTDEPS_PROBE_ABSENT` | Variables read only by individual QA scripts or tests. |
| `REFCARDS_DIR`, `HARVEST_V2_DIR`, `LAUNCH_FACTORY_DIR` | Maintainer tooling that reads private reference material (card folders, harvest results). Ignore. |
| `CODEX_HOME`, `NODE_OPTIONS`, `NODE_ENV`, `GITHUB_STEP_SUMMARY`, `GITHUB_PATH`, `RUNNER_TEMP`, `LOCALAPPDATA`, `PATH` | Standard variables. |

## launch-factory (the launch-factory/ folder)

`LF_MODE=mock` starts the template with no provider key at all, for `next dev` only: a production build or server (`NODE_ENV=production`) refuses mock mode, because mock shows subscription states without a login. To smoke-test a production build on your own machine, set `LF_ALLOW_MOCK_PROD=1` for that run only; never set it where the site is deployed. `LF_MODE=live` needs the provider names below (`packages/env` enforces `DATABASE_URL`, `BETTER_AUTH_SECRET`, `PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET`, `RESEND_API_KEY` and `TURNSTILE_SECRET_KEY` at start-up; `EMAIL_FROM` and `NEXT_PUBLIC_APP_URL` are required by the mailer and by the live app). `npm run env:check` (offline) and `npm run doctor -- --stage sandbox` list the missing names without printing values.

### Required in live mode

| Name | Required? | What breaks without it | You supply it? |
|---|---|---|---|
| `LF_MODE` | Always (`mock` or `live`) | The build and production server stop. `next dev` falls back to mock. `mock` with `NODE_ENV=production` also stops unless `LF_ALLOW_MOCK_PROD=1`. | You set it. |
| `LF_ALLOW_MOCK_PROD` | No (local smoke tests only) | Nothing: without it a production build in mock mode stops, which is the safe default. | Only on your own machine, for one run. |
| `DATABASE_URL` | Live | No database. The app stops at start-up with the list of missing names. | Yes, your own Postgres. |
| `BETTER_AUTH_SECRET` | Live (32+ characters) | No sessions or sign-in. | Yes, generate your own. |
| `PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET` | Live | No billing calls; the webhook route answers 500. | Yes, your own Paddle account (sandbox first). |
| `RESEND_API_KEY`, `EMAIL_FROM` | Live | No mail. `EMAIL_FROM` must be a sender on a domain you verified at Resend. | Yes. |
| `TURNSTILE_SECRET_KEY` | Live | Sign-up and inquiry forms lose bot protection. | Yes, your own Cloudflare Turnstile. |
| `NEXT_PUBLIC_APP_URL` | Live | Cookies, callbacks and mail links have no base. Mock defaults to `http://localhost:3000`. | You set it. |

### Optional

| Name | What it controls | What breaks without it |
|---|---|---|
| `SUBJECT_REF_KEY` | 32+ characters, separate from `BETTER_AUTH_SECRET`. Makes the pseudonymous reference for retained transaction records when an account is deleted. The start-up check accepts it as optional, but only checks the format. | The account-deletion feature cannot build that reference. Generate your own and do not rotate it once records exist. |
| `PADDLE_CLIENT_TOKEN` | Paddle.js client token (`test_` sandbox, `live_` real). | Checkout goes to a Paddle payment link instead. |
| `LF_PADDLE_LIVE` | Real-payment switch. Empty means sandbox. | Nothing. Sandbox stays on. |
| `TURNSTILE_SITE_KEY` | Public widget key for the forms. | The widget is not drawn. |
| `POSTHOG_HOST`, `POSTHOG_PROJECT_KEY` | Analytics. Both are needed. | Only analytics turns off. |
| `POSTHOG_PERSONAL_API_KEY`, `POSTHOG_PROJECT_ID` | Deleting a departed user's data in PostHog. | That deletion step is not done. |
| `SENTRY_DSN` | Error reporting. The build copies it to `NEXT_PUBLIC_SENTRY_DSN` for the browser (live only). | Only error reporting turns off. |
| `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` | Source-map upload at build time. | No upload. Keep out of CI. |
| `INQUIRY_OWNER_EMAIL` | Where inquiry notices go. | The inquiry desk turns off. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `KAKAO_CLIENT_ID`, `KAKAO_CLIENT_SECRET`, `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET` | Social sign-in. Both halves of a pair are needed. | Email and password only. |
| `CRON_SECRET` | Bearer value for Vercel Cron routes. | Cron routes answer 401. |
| `GUMROAD_ACCESS_TOKEN`, `GUMROAD_PING_SECRET` | Fallback billing adapter. | Adapter unused. |
| `LF_PAYMENT_FAILED_EMAIL`, `LF_EU_SALES`, `LF_MARKETING_NIGHT_GUARD`, `LF_MOCK_SUB` | Behaviour switches (payment-failed mail, EU sales gate, night-time marketing guard, mock subscription state). | Defaults apply. |
| `LF_BUSINESS_NAME`, `LF_BUSINESS_OWNER`, `LF_BUSINESS_ADDRESS`, `LF_BUSINESS_PHONE`, `LF_BUSINESS_EMAIL`, `LF_BUSINESS_REG_NO`, `LF_MAIL_ORDER_NO`, `LF_HOSTING_PROVIDER` | Business details shown in the footer. Empty fields are hidden. | The business block is not drawn. You supply your own; nothing is hard-coded. |
| `FACTORY_USER_ENV`, `LF_NO_USER_ENV` | `FACTORY_USER_ENV=1` enables the Windows user-environment fallback; `LF_NO_USER_ENV=1` forces it off (tests set it). | Default is off. |

### Paths and tooling

| Name | Meaning |
|---|---|
| `LF_WF_REPO` | Optional. A different Sitebrew checkout for the conformance tests to read. The default is the repository root of the clone you are working in, so you normally leave it unset. |
| `LF_WF_CONFORMANCE_COMMIT` | Commit or tag in that checkout. Default is the pinned commit. |
| `WF_HOME` | Optional. A different Sitebrew checkout for `template:screens` to read. The default is the repository root of the clone you are working in. |
| `CHROME_PATH` | Chrome for `template:screens` and the smoke test (same lookup rule as in the web-factory table). |
| `LF_CI_REQUIRE_TOOLS`, `LF_CI_TOOLS_DIR`, `LF_CI_BASE`, `LF_SCREENS_MIN_FREE_GB`, `LF_SMOKE_MIN_FREE_GB`, `LF_VERIFY_LIVE`, `LF_REGISTRY_KEEP`, `LF_MOCK_SCENES`, `LF_CLIENT_IP_HEADER`, `LF_TRUSTED_PROXY`, `LF_TRUSTED_PROXY_CIDRS`, `SMOKE_*`, `LFOBS_DEBUG`, `WF_NAV_TIMEOUT_MS` | Tooling, smoke-test and proxy-header settings read in `scripts/*`, `template/*`, `packages/*`. |
| `BETTER_AUTH_URL`, `BETTER_AUTH_TRUSTED_ORIGINS`, `BETTER_AUTH_SECRETS` | Read inside the Better Auth library (and not set by this repository). |
| `CI`, `GITHUB_ACTIONS`, `GITHUB_REPOSITORY`, `GITHUB_STEP_SUMMARY`, `GITHUB_PATH`, `GITHUB_TOKEN`, `RUNNER_TEMP`, `NEXT_RUNTIME`, `VERCEL`, `PROGRAMFILES`, `LOCALAPPDATA`, `PATH`, `NODE_ENV` | Standard variables set by the platform or CI. |

### GitHub Actions (only when you run the workflows in your own fork)

| Name | Kind | Used by |
|---|---|---|
| `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `VERCEL_AUTOMATION_BYPASS_SECRET`, `PREVIEW_DATABASE_URL` | secrets | `.github/workflows/preview.yml` (manual `workflow_dispatch` only). `PREVIEW_DATABASE_URL` is optional (migration comparison). |
| `LF_PREVIEW_ALIAS`, `LF_PREVIEW_PLANS_JSON` | variables | `preview.yml`. `LF_PREVIEW_ALIAS` is new in this export (it replaced a hard-coded host name). |
| none | | `ci.yml` and `product-ci.yml` use no repository secret. |

The `backup.yml` workflow (`DATABASE_URL`, `BACKUP_PASSPHRASE`) is **not** part of the export.
