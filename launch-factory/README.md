[English](README.md) · [한국어](README.ko.md) · [简体中文](README.zh-CN.md) · [Español](README.es.md) · [日本語](README.ja.md)

# launch-factory

This repository is the launch kit that pairs with web-factory, the repository of screen blocks. It owns the back end: auth, data, payments, email, analytics, and jobs. A product starts by copying `template/`, then receives security patches by raising only the version of the `@launch-factory/*` packages.

Current version `v0.2.0` · web-factory pin `v0.2.0` · blocks `f2174f6e` · contract `f2174f6e` (the commit of tag v0.2.0)

- Blocks know nothing about providers. Adapters implement the web-factory ports. The same conformance suite checks that an adapter reproduces the same scenarios as the mock.
- A feature bundle (adapter, server actions, webhook routes, schema, migrations) is one entry in `registry.json`. The record of pinned versions is in [`docs/versions.md`](docs/versions.md).
- The canonical contract source is `registry/factory/contract/` in web-factory.

## Requirements

`npm run setup` checks everything below. It reports what is missing and gives the install command for your OS. It does not install system software.

| Item | Version | Required | Windows | macOS | Linux |
|---|---|---|---|---|---|
| Node | >=24.13.0 | Required | `winget install OpenJS.NodeJS.LTS --version 24.13.0` | `nvm install 24.13.0` | `nvm install 24.13.0` |
| npm | >=11.6.2 | Required | Installed with Node | Installed with Node | Installed with Node |
| git | Latest | Required | `winget install Git.Git` | `brew install git` | `sudo apt install git` |
| web-factory checkout | Tag `v0.0.12` | Optional | `git clone`, then put the path in `LF_WF_REPO` | `git clone`, then put the path in `LF_WF_REPO` | `git clone`, then put the path in `LF_WF_REPO` |
| Chrome | Latest | Optional | `winget install Google.Chrome` | `brew install --cask google-chrome` | `sudo apt install chromium` |
| gh | Latest | Optional | `winget install GitHub.cli` | `brew install gh` | `sudo apt install gh` |
| vercel | Latest | Optional | `npm i -g vercel` | `npm i -g vercel` | `npm i -g vercel` |
| gitleaks | CI pin 8.30.1 | Optional | `winget install Gitleaks.Gitleaks` | `brew install gitleaks` | [Release file](https://github.com/gitleaks/gitleaks/releases/tag/v8.30.1) |
| actionlint | CI pin 1.7.12 | Optional | `winget install rhysd.actionlint` | `brew install actionlint` | [Release file](https://github.com/rhysd/actionlint/releases/tag/v1.7.12) |
| zizmor | CI pin 1.30.1 | Optional | `winget install zizmor.zizmor` | `brew install zizmor` | `pipx install zizmor` |
| osv-scanner | CI pin 2.6.0 | Optional | `winget install Google.OSVScanner` | `brew install osv-scanner` | [Release file](https://github.com/google/osv-scanner/releases/tag/v2.6.0) |

A missing optional item has these effects.

- web-factory checkout: Without it, the conformance tests show SKIP. With it, the tests read the location `LF_WF_REPO` points to, and that location must contain the `v0.0.12` commit. If the environment variable is not set, the code uses a default path, so always set `LF_WF_REPO` on any other PC.
- Chrome: `npm run template:screens` does not run. If Chrome is not installed in the default location, put the path to the executable in `CHROME_PATH`.
- The four security tools: `npm run ci:verify` marks the matching steps as SKIP. CI downloads and uses the pinned versions in `scripts/ci/tools.json`. To count a missing tool as a failure locally too, set `LF_CI_REQUIRE_TOOLS=1`.
- gitleaks: The pre-commit secret scan hook only prints a notice and lets the commit through.
- gh: Clones and pushes the private repository and signs you in to GitHub (`gh auth login`).
- vercel: Needed for preview deployments and for `npm run env:check -- --vercel`.

Other requirements:

- Memory: The build and the screen gate need about 3GB of free memory. If there is not enough, `template:screens` waits (`LF_SCREENS_MIN_FREE_GB`).
- Line endings: `.gitattributes` fixes them to LF, so the `core.autocrlf` setting does not matter.
- Shell: All scripts are Node, so PowerShell and bash behave the same. Git Bash turns an argument such as `--only /pricing` of `template:screens` into a path, so run it in PowerShell.
- DB: Tests use in-memory PGlite, so there is nothing to install. A live connection uses the `DATABASE_URL` from Supabase.

### Environment variables

The repository does not store values. The canonical list of names is [`.env.example`](.env.example).

| State | What you need |
|---|---|
| mock (default development) | `LF_MODE=mock` only. It starts without any provider key. |
| live | `LF_MODE=live`, the provider keys, and `DATABASE_URL`. `npm run env:check` (offline) and `npm run doctor -- --stage sandbox` report missing names. |
| Optional | `INQUIRY_OWNER_EMAIL`, `POSTHOG_*`, `SENTRY_DSN`. If one is missing, only that feature turns off. |
| Shop (optional) | `NEXT_PUBLIC_PORTONE_STORE_ID`, `NEXT_PUBLIC_PORTONE_CHANNEL_KEY`, `PORTONE_API_SECRET`, `PORTONE_WEBHOOK_SECRET`. All four are needed in live mode; if one is missing, only the shop turns off. In mock mode the shop works with no key (a mock payment confirmation step). |
| Paths | `LF_WF_REPO` (the web-factory checkout the conformance tests read) · `WF_HOME` (the web-factory checkout `template:screens` reads) · `CHROME_PATH` |

## Getting started

If the repository is private, sign in to GitHub before you clone it.

```bash
git clone https://github.com/nowwcastle-sudo/sitebrew.git
cd sitebrew/launch-factory
npm run setup
npm run ci:verify
```

- `npm run setup`: Checks the environment and sets `.githooks` as `core.hooksPath`. If `node_modules` is missing or out of date, it runs `npm ci`. If a required item is missing, the exit code is 1 and the last line is `setup: FAIL`.
- `npm run ci:verify`: Runs the same set of checks as CI. It shows PASS, FAIL, or SKIP for each step in a table. If any step is FAIL, the exit code is 1.

Start the template in mock mode.

```bash
LF_MODE=mock npm run dev -w template
```

```powershell
$env:LF_MODE = "mock"; npm run dev -w template
```

Check it at http://localhost:3000.

## Common tasks

| Task | Command |
|---|---|
| Unit tests | `npm test` |
| Pre-run check (whether the keys still work) | `npm run doctor -- --stage dev` (`sandbox` and `preview` also exist) |
| Rebuild and check the registry | `npm run registry:build` · `npm run registry:check` |
| Template screen gate (about 4 minutes to build) | `npm run template:screens` |
| Check that the README matches the current state | `npm run readme:check` |

### Raising the web-factory pin

When web-factory publishes a new tag `vX.Y.Z`, raise the pin in this order.

```bash
npm run contract:sync -- --from <web-factory-path> --ref vX.Y.Z
node scripts/template-sync.mjs blocks --from <web-factory-path> --ref vX.Y.Z
git diff template/package.json
```

1. If `git diff template/package.json` shows dependency versions that sync raised, revert them.
2. Change `WF_CONFORMANCE_COMMIT` in `scripts/lib/wf-conformance.mjs` to the commit hash of the new tag.
3. Change the web-factory row in `docs/versions.md` and the "web-factory pin" in this README to the new tag.
4. Check that `npm run ci:verify` exits with 0.

### Cutting a new release

Follow the steps in [`docs/RELEASING.md`](docs/RELEASING.md). Updating the README and running `npm run readme:check -- --tag vX.Y.Z` are required steps before you tag.

## Troubleshooting

| What you see | Cause | Fix |
|---|---|---|
| `setup: FAIL — 필수 누락 …` | A required tool is missing or its version is too low | Run the `→` command shown on each line, then run `npm run setup` again. |
| `web-factory 체크아웃 없음` · `web-factory 커밋 … 을 찾지 못함` | The `LF_WF_REPO` path does not exist, or it has no `v0.0.12` commit | Clone web-factory, run `git -C <path> fetch --tags`, then put that path in `LF_WF_REPO`. |
| `SKIP(도구 없음)` | An optional security tool is missing | This is not a failure. Install the tool and the step runs. |
| `[pre-commit] gitleaks 가 설치돼 있지 않아 … 건너뛴다` | The hook is installed, but gitleaks is not | Run the gitleaks command from the Requirements table. |
| `--only /pricing` finds no page | Git Bash turns `/pricing` into a path | Run it in PowerShell. |

## Release history

| Tag | Date | Changes | Record |
|---|---|---|---|
| `v0.2.0` | 2026-10-24 | launch-factory v0.2.1 (internal version) · Security patch: next 16.4.3, zod 4.6.7, body-parser, fast-uri and undici updates · web-factory pinned to `v0.2.0` | — |
