---
name: guide
description: Use Sitebrew (shadcn registry of components, recipes and blocks with a site-stamping pipeline, components.json installs) and launch-factory (auth, billing, email and analytics with a Next.js template, mock mode, ci:verify) at pinned release tags. Use to install Sitebrew parts, set up the launch-factory template, or look up the keys of the two kits. Not for building a whole site (use `new`) or installing Node.js or Git (use `setup`). Trigger phrases - "Sitebrew", "launch-factory", "factory registry", "install from the factory registry", "launch kit", "which keys exist", "Sitebrew 레지스트리에서 설치", "런치 키트".
---

# Sitebrew guide

Help the user use one repository, Sitebrew, that holds two parts which work together. One release tag, `v0.2.3`, covers both: pin every install and clone to it.

<!-- env-block:start -->
## Where this runs (read first)

Check first whether you can run commands on the user's own computer:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/setup.mjs" detect
```

Read the JSON from the top; the first line that applies decides:

- `remote` is `true`: a cloud session, not the user's computer. Install nothing here; say so and use the chatbot steps.
- `unsure` is `true`: ask once, in the user's language, "Can this window run commands on your own computer?" Then add `--as agent` or `--as chatbot` to the command.
- `mode` is `chatbot`: run nothing and do not say you ran anything. Follow the "Chatbot mode" section of this skill.
- `mode` is `agent`: follow this skill as written.

If the command cannot run: with a command tool, where the error says `node` is not found, Node.js is missing, so follow "No Node.js yet" in the `setup` skill; with no command tool, or with `${CLAUDE_PLUGIN_ROOT}` not filled in, you are in chatbot mode. In Codex use the plugin folder (the one that holds `scripts/setup.mjs`, two levels above this `SKILL.md` file) instead of `${CLAUDE_PLUGIN_ROOT}`.
<!-- env-block:end -->

## Never

- Never use `main` or an address without `#v0.2.3` (write `nowwcastle-sudo/sitebrew/<item>#v0.2.3`): with no tag the install reads the default branch and mixes versions.
- Never rewrite a shadcn command line from memory: the files pin `npx shadcn@4.22.1`, and a newer CLI changes flags and prompts. Copy the line from the route file.
- Never ask for, paste or print a key value: a key in the chat is exposed. Name the environment variable to set. Report only whether a name is set and its length (what `scripts/doctor.mjs` does).
- Never run `shadcn add` without `-y -o`: without `-o` a non-interactive shell stops at the overwrite prompt, writes nothing and still exits 0. With `-o` same-name files are overwritten: in a project with its own `components/ui` check `git status` first.
- Never count SKIP in `npm run ci:verify` as a pass: SKIP means an optional security tool did not run. Install the tool the line names, or report that step as unverified.
- Never invent a field in a stamp brief: the schema is strict, so an unknown field makes the brief fail to load. Copy the shape of an example in `factory/stamp/briefs/`.
- Never run live payment or production steps: taking real payments is the user's decision. Use mock mode or provider sandboxes; `LF_PADDLE_LIVE` stays empty during development.
- Never guess a GitHub account: an address that points at the wrong account installs someone else's code. The plugin build writes the publisher's account into every install address. If an address still shows an owner placeholder with double underscores in place of an account name, this build has no owner: stop and ask the user for the owner; do not fill it in yourself.
- Never run `npm run check:regen` with uncommitted changes: it fails on any `git diff`, including the user's own edits, so a failure proves nothing about the kit.
- Never run `npm run template:screens -- --only /pricing` in Git Bash: it rewrites `/pricing` into a Windows path and the gate checks no page. Use PowerShell.

## Parts

| Part | Where | Role |
|---|---|---|
| web-factory | the repository root | A shadcn registry: the official components rebuilt on Base UI, recipes (visual styles), blocks (page sections), archetypes (site types) and a `stamp` command that turns a short brief into site candidates. |
| launch-factory | the `launch-factory/` folder | The back-end launch kit (auth, data, payments, email, analytics, jobs as `@launch-factory/*` packages) and a `template/` Next.js app. |

## 1. Pick the route

Ask in order; the first yes decides. Load only the file of the chosen route.

- **site**: does the user want a finished site, not parts (with or without sign-up and payments)? Use the `new` skill (conversation, then three candidates) and load no reference.
- **stamp command**: does the user want only the raw `stamp` command line? Load only "Get the repository" (skip it when a clone already exists, see section 2) and "Stamp a site" in `references/web-factory.md`.
- **product**: does the user want a product with login, billing and mail, not a finished site? Load only `references/launch-factory.md` and start in mock mode. At its go-live step also load `references/keys.md`, tell the user which key names it lists for the providers they use, and let them create the accounts and set the variables themselves.
- **keys**: is the question only which keys exist? Load only `references/keys.md`. It is generated at build; if it is missing the build is incomplete, so reinstall the plugin (`node "${CLAUDE_PLUGIN_ROOT}/scripts/doctor.mjs"` still prints the key names it checks). `keys.md` is only a reference list of names, not the procedure: how to get an account and set up a real site is the runbook (the `runbook` skill).
- **parts**: otherwise. Install web-factory parts into an existing or new Next.js project (no clone is needed): load only "Use Sitebrew as a registry" in `references/web-factory.md`. It also says when to skip `init`.

Judgment calls:

- A project that already has files takes **parts** only: `deliver` copies a stamped site into an empty or new folder, never into one that has files. A whole site for that user is **site** in a new folder.
- A site with sign-up or payments is **site** (the `new` skill connects launch-factory); **product** fits a user who wants the back end and its template app first.
- Offer keys only when needed: `LAW_API_OC` to publish a Korean-language site, `PEXELS_API_KEY` for stock photos. Without keys everything still builds in preview mode.

## 2. Prepare

- Node `>=24.13.0` and npm `>=11.6.2`. In a Sitebrew clone (**site**, **product**) `npm run setup` reports what is missing and prints the install command for the user's OS; in the user's own project (**parts**) run `node -v` and `npm -v`. Neither installs system software: the `setup` skill does that, one item at a time, after a yes.
- Kit commands run from the `sitebrew` folder (the repository root): `./sitebrew` where the `setup` skill cloned it, or the folder named by `SITEBREW_DIR`.
- State two limits before the user starts. The repository ships no stock photos, generated video backgrounds or photo textures (redistribution terms were not confirmed): recipes render without them, and texture values X4 to X8 lack their photo layer until the user adds photos with the same file names. Without keys `stamp` builds a preview-only site that is not publishable.

## 3. Run

Run the commands of the loaded file in order. Replace only the `<placeholders>`; the file says where each value comes from. Later steps of **site** belong to other skills: `revise` changes one part of a built site, `deliver` copies it to the user's folder, `preview` opens it on a temporary public address, `doctor` lists what is missing, `setup` installs Node.js or Git.

## 4. Check before you say it works

- In a Sitebrew clone (**site**, **product**): run `npm run ci:verify` at the clone root (web-factory) or inside `launch-factory/`. Report the exit code and the step table. On a FAIL row read the last lines of that step, fix it and run again; do not say it works.
- In the user's own project (**parts**, no clone, so no `ci:verify`): confirm the added files exist in the folder that the `ui` alias of `components.json` names, and list what changed. If `git rev-parse --is-inside-work-tree` prints `true`, run `git status --short`. Otherwise, from the project root, list the files written in the last 30 minutes (replace `<ui-folder>`, normally `components/ui` or `src/components/ui`):

```bash
find <ui-folder> -type f -mmin -30
```

```powershell
Get-ChildItem <ui-folder> -Recurse -File | Where-Object LastWriteTime -gt (Get-Date).AddMinutes(-30)
```

## 5. When something fails

Read the last lines of the failing command first. `compat.json` in the plugin folder lists which Sitebrew tag this plugin version pins.

| Route | Symptom | Next step |
|---|---|---|
| any | Unsure what is missing | Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/doctor.mjs"` first (computer, clone, key names; names and lengths only). Then the doctor of the route: **site** `node factory/doctor.mjs --stage <stage>`; **product** `npm run doctor -- --stage dev`. |
| site, product | `npm run setup` ends with `setup: FAIL` | One line per missing item is above it. Install the items through the `setup` skill, then run `npm run setup` again. |
| parts | An install returns 401 | See "401" below. |
| parts | A part arrives as the latest version | The address had no `#v0.2.3`. Add it and run the `add` line again. |
| parts | `shadcn add` exits 0 but nothing changed | `-y -o` is missing. Add both and run the `add` line again. |
| site | `npm run stamp` exits 3 | It waits for input. Open the request file at the printed path, answer it per `factory/stamp/COPY.md` (copy) or `factory/legal/AGENT.md` (legal pages), then run the same command again. |
| site | `npm run stamp` exits 1 | Read `<run>/stamp-summary.json` (`<run>` is the `--run` folder) as described below, fix what its `status` names, then run the same command again. |
| site | `npm run stamp` exits 2 | An argument or the brief is wrong. Read the printed message (a summary, if written, has `status` `bad-brief`), fix it and run again. |
| any | Anything else | Quote the last lines of the failing command to the user, run the plugin doctor, and do not retry the same command unchanged. |

- **401.** The registry is public: it needs no token and `gh auth status` does not help. Check in order: (1) a stray token in that shell: bash `unset GH_TOKEN GITHUB_TOKEN`, PowerShell `Remove-Item Env:GH_TOKEN, Env:GITHUB_TOKEN -ErrorAction SilentlyContinue`, then run the `add` line again; (2) the address has the shape `nowwcastle-sudo/sitebrew/<item>#v0.2.3`; (3) `curl -I https://raw.githubusercontent.com/nowwcastle-sudo/sitebrew/v0.2.3/registry.json` answers 200 (PowerShell: `curl.exe`). A 404 means a wrong owner or tag, not a missing token.
- **`stamp-summary.json`.** `tool-failed`: a tool did not run, so no gate result counts yet; fix `failures[0].stage` first. Stage `doctor`: run `node factory/doctor.mjs --stage stamp` and follow its line. Stage `07-qa` with `측정 못 함`: run the same command again (it re-measures; it needs about 3 GB of free memory, and on a slow PC `WF_NAV_TIMEOUT_MS` and `WF_CDP_TIMEOUT_MS` can be raised). `gate-failed`: the tools ran, but the picked candidate (`candidates[]` with `active: true`) is not publishable, or `01-direction` found no three directions (`failures[0].rejected` says why: change the brief). Each `blockers` line starts with `공개 불가 — `. Blockers that need the user's input (real photo, site address, fact to confirm, sample contact, legal review) are normal in preview mode: report them and invent nothing. Fix the other blockers (sample text left, broken link, section not drawn) first: user input does not clear them.
- **Doctor `<stage>`.** `stamp`: before any stamp run. `legal`: Korean legal pages stay "unverified". `media`: photo or image slots stay placeholders. `publish`: `--deploy-preview` gives no link without `VERCEL_TOKEN` (a Vercel login alone does not give one). `learn`: PostHog only.

## Chatbot mode

Use this when the block "Where this runs" says `chatbot`. Nothing ran here: show every command in a code block for the user's own terminal and never say it was run. For installing Node.js, Git or the clone, give the steps of the `setup` skill (its install guide). If you cannot open the files under `references/`, say so once and ask the user to paste the file of the chosen route; never write the commands from memory, because the pinned tag and shadcn version are only there.
