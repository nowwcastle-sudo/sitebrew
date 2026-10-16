# launch-factory at `v0.1.2`

launch-factory owns the back end (auth, data, payments, email, analytics, jobs). A product starts by copying `template/`, then receives security patches by raising only the version of the `@launch-factory/*` packages. This release is the `launch-factory/` folder of Sitebrew `v0.1.2`.

## Get the repository and start in mock mode

```bash
git clone --branch v0.1.2 --depth 1 https://github.com/nowwcastle-sudo/sitebrew.git
cd sitebrew/launch-factory
npm run setup
npm run ci:verify
LF_MODE=mock npm run dev -w template
```

```powershell
$env:LF_MODE = "mock"; npm run dev -w template
```

- Open http://localhost:3000.
- `npm run setup` checks the environment, sets `.githooks` as `core.hooksPath` and runs `npm ci` when needed.
- `npm run ci:verify` runs the same checks as CI and prints PASS, FAIL or SKIP per step. A step is SKIP when an optional security tool (actionlint, zizmor, osv-scanner, gitleaks) is not installed. SKIP is not a pass.
- Mock mode needs no provider key. Tests use in-memory PGlite, so no database is needed.
- Run `template:screens` in PowerShell. Git Bash turns an argument such as `--only /pricing` into a path.

## Go live (after mock works)

1. Read `keys.md`. Create your own accounts and keys. Set them as environment variables. Do not paste values into the chat.
2. `npm run env:check` (offline) lists missing names. `npm run doctor -- --stage sandbox` checks that the keys still work. Use Paddle sandbox first.
3. Keep `LF_PADDLE_LIVE` empty until the user decides to take real payments.

## It sits in the same repository as web-factory

- launch-factory is the `launch-factory/` folder of the Sitebrew clone, and web-factory is the clone root. One tag (`v0.1.2`) covers both, so the two parts always match.
- `launch-factory/` has its own `package.json` and lock file. `npm ci` at the clone root does not install it, and `npm ci` inside it does not install the root.
- The conformance tests (`npm run conformance`) read the web-factory part of the same clone. `LF_WF_REPO` and `WF_HOME` default to the clone root; set them only to point at a different Sitebrew checkout.
- The vendored contract is locked in `packages/contract/contract.lock.json`. Check it offline with `npm run contract:check`.
- The locks that name a web-factory commit (`contract.lock.json`, `template/template.lock.json`) record the snapshot that Sitebrew was built from. Raising them is a maintainer job done with a new Sitebrew release, not something a site maker does.
