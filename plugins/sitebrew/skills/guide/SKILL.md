---
name: guide
description: Guides the use of Sitebrew (a shadcn registry of components, recipes and blocks, with a site-stamping pipeline) and launch-factory (auth, billing, email and analytics back end with a Next.js template) at pinned release tags. Use when the user wants to install Sitebrew parts or blocks into a Next.js project with shadcn, set up the launch-factory template, connect it to Sitebrew, or learn which keys and environment variables the two kits can use. To make a whole new site, use new instead. Trigger phrases - "Sitebrew", "launch-factory", "factory registry", "install from the factory registry", "launch kit", "which keys exist", "레지스트리에서 설치", "런치 키트".
---

# Sitebrew guide

Help the user use one repository, Sitebrew, that holds two parts which work together. Pin every install and clone to its release tag. Never use `main`.

| Part | Where | Pinned tag | Role |
|---|---|---|---|
| web-factory | the repository root | `v0.1.1` | A shadcn registry. It holds the official shadcn components rebuilt on Base UI with baseline UI rules, recipes (visual styles), blocks (page sections), archetypes (site types) and a `stamp` command that turns a short brief into site candidates. |
| launch-factory | the `launch-factory/` folder | `v0.1.1` | The back-end launch kit: auth, data, payments, email, analytics and jobs as `@launch-factory/*` packages, plus a `template/` Next.js app. It has its own `package.json` and `npm ci`; installing the root does not install it. |

The install addresses in this guide name the GitHub account that hosts the Sitebrew repository. Use them as written.

## Decide what the user wants

1. Install web-factory parts into an existing or new Next.js project: follow "Use Sitebrew as a registry" in `references/web-factory.md`.
2. Generate a whole site from a brief: use the `new` skill (conversation, then three candidates). `revise` changes one part of a built site, `deliver` copies the chosen site to the user's folder, `doctor` lists what is missing. For the raw `stamp` command line, follow "Stamp a site" in `references/web-factory.md`. No key is needed to start: the kit builds in preview mode.
3. Start a product with auth, billing and mail: follow `references/launch-factory.md` (the `launch-factory/` folder of the clone). Start in mock mode.
4. Find out which keys exist: read `references/keys.md`. It lists names only. For site making every key is optional; each row says what turns off when the name is missing. The Windows way to set a name is in its first section.

## Rules to follow in every case

- Pin to the tag. Write install addresses as `nowwcastle-sudo/sitebrew/<item>#v0.1.1`. An address without `#tag` reads the default branch and mixes versions.
- Check the Node version first: Node `>=24.13.0` and npm `>=11.6.2`. `npm run setup` reports what is missing and prints the install command for the user's OS. It does not install system software.
- Confirm shadcn CLI syntax in the repository README before you change a command. The READMEs pin `npx shadcn@4.21.0`.
- Never ask the user to paste a key value into the chat, and never print one. Tell the user which environment variable name to set and let them set it. Report only whether a name is set and its length (`node "${CLAUDE_PLUGIN_ROOT}/scripts/doctor.mjs"` does exactly that).
- Do not run live payment or production steps. Use mock mode or provider sandboxes. `LF_PADDLE_LIVE` stays empty during development.
- Run a repository's own check before you say it works: `npm run ci:verify` in either repository. Report the exit code and the step table.
- The Windows user-environment fallback for keys is off by default. Set `FACTORY_USER_ENV=1` only when the user wants keys read from Windows user variables.

## What the public repositories do not contain

State these limits before the user starts, because they decide what works.

- Stock photos, generated video backgrounds and photo textures from the private history are not included (redistribution terms were not confirmed). Recipes render without those images. The texture values X4 to X8 render without their photo layer until the user adds their own photos with the same file names.
- The author's design rule documents (`DESIGN §` references in the code) are private files outside the repository. Comments and docs that cite them have no target in the public copy.
- `LAW_API_OC`, `PEXELS_API_KEY` and `HIGGSFIELD_DIR` (a directory) are **optional**. Without them `npm run stamp` still runs, in preview mode: stock photo slots stay "image in progress" placeholders, generated-image slots become `higgsfield.request.json` requests, and the legal pages stay "unverified", so the site is marked not publishable. `node factory/doctor.mjs --stage stamp` prints one note per missing item (Korean line and English line) and exits 0. An operator who wants it strict sets `WF_REQUIRE_KEYS=1` or passes `--strict`. A key that is set but wrong always fails. `WF_DESIGN_RULES_DIR` (visual baselines, source collections) is optional too. Read `references/keys.md` for the names.
- launch-factory conformance tests read the web-factory part of the same clone. Run them from inside the Sitebrew clone; `LF_WF_REPO` can point to another Sitebrew checkout.

## When something fails

- Read the last lines of the failing command. `npm run setup` ends with `setup: FAIL` and one line per missing item.
- An install that returns 401 means the token is wrong or the repository is private. Remove the wrong token variable and check `gh auth status`.
- A part that arrives as the latest version means the address had no `#tag`.
- `npm run doctor -- --stage dev` (launch-factory) and `node factory/doctor.mjs --stage <stamp|legal|media|publish|learn>` (web-factory) report which key or tool is missing without printing values.
- `node "${CLAUDE_PLUGIN_ROOT}/scripts/doctor.mjs"` checks Node, npm, git, the Sitebrew clone at the pinned tag and the key names before any of that (see `doctor`). `compat.json` in the plugin folder lists which Sitebrew tag this plugin version pins.
