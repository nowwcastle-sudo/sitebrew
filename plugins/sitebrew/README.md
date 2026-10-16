[English](README.md) · [한국어](README.ko.md) · [简体中文](README.zh-CN.md) · [Español](README.es.md) · [日本語](README.ja.md)

# sitebrew

sitebrew is a Claude Code plugin with five skills. They guide you through web-factory (a shadcn registry and site-stamping pipeline) and launch-factory (a back-end launch kit for auth, billing, email and analytics). It always uses the pinned release tags below, never `main`. `compat.json` lists which kit tags each guide version pins.

## Pinned versions

| Part | Tag |
|---|---|
| web-factory | `v0.1.2` |
| launch-factory | `v0.1.2` |

## Install

From the marketplace in this repository:

```bash
/plugin marketplace add nowwcastle-sudo/sitebrew#v0.1.2
/plugin install sitebrew@sitebrew
```

To try it without installing, start Claude Code with `claude --plugin-dir <path>`, where the path is the `plugins/sitebrew` folder of a Sitebrew clone.

In Codex, add the marketplace first and then the plugin (`codex plugin --help` lists both commands):

```bash
codex plugin marketplace add nowwcastle-sudo/sitebrew --ref v0.1.2
codex plugin add sitebrew@sitebrew
```

The session hook that copies plugin options into the shell is for Claude Code only (the Codex install loads no hook). In Codex set plain environment variables; the `doctor` skill shows how.

## Skills

| Skill | Use it to |
|---|---|
| `new` | Answer a few questions and get three site candidates to compare and pick from. |
| `revise` | Change one section, one design axis or one piece of copy of a built site. |
| `deliver` | Copy the chosen site into your own folder, with a README that lists what to fix before publishing. |
| `doctor` | See what is missing on your computer and how to fix it, in Korean and English. |
| `guide` | Install web-factory parts, start the launch-factory template, find out which keys exist. |

Start with these two:

```text
/sitebrew:doctor
/sitebrew:new
```

## Keys are optional

No key is needed to start. Without keys the kit builds sites in preview mode: stock photo slots stay as "image in progress" placeholders, legal pages stay "unverified", and the result is marked not publishable. Each missing item is reported with one line that says what it turns off.

When you enable the plugin, Claude Code asks for four optional values (`userConfig`). Leave them empty to stay in preview mode. Installing from the command line (`claude plugin install`) does not ask for these values; set them afterwards with `/plugin configure sitebrew@sitebrew` inside Claude Code.

| Name | Sensitive | What it adds |
|---|---|---|
| `PEXELS_API_KEY` | yes | Real stock photos instead of placeholders. |
| `LAW_API_OC` | yes | Legal pages checked against the statute text. |
| `VERCEL_TOKEN` | yes | Online preview links. |
| `HIGGSFIELD_DIR` | no (a folder) | Your own generated images. |

Claude Code keeps the three keys in its secure credential store, not in a settings file. The kit reads plain environment variables, so at every session start a hook of this plugin copies each option you filled in into that session's shell environment (restart Claude Code after you change an option). A variable you set yourself, for example with `setx`, always wins. The copy is a plain-text file in the `session-env` folder of your Claude profile and is not removed automatically; if you do not want that, set a normal environment variable instead. The plugin never prints a key value: its doctor reports a name, whether it is set, and its length. The copy lives at `~/.claude/session-env/<session id>/` (delete that folder to remove it); on Windows its access follows the permissions of your user profile.

The 3D object hero (`object-3d-orbit`) starts from an image: image → GLB model → shown. Without the tools for that, it falls back to 2.5D, then to a poster, and with no image at all the kit does not pick this hero.

## Network calls

The plugin sends nothing to its maintainers. The kit it drives calls an outside service only when you set the matching key:

| Service | When | What is sent |
|---|---|---|
| Pexels | `PEXELS_API_KEY` is set (step 05, media) | search words for stock photos and videos |
| Korean statute API (law.go.kr) | `LAW_API_OC` is set (legal review) | the names of the statutes to check |
| Vercel | `VERCEL_TOKEN` is set and you pass `--deploy-preview` | the built site files |

Setting up the kit downloads the repository from GitHub and packages from the npm registry. The launch-factory kit stays in mock mode until you connect services of your own.

## What sitebrew does

- Installs web-factory parts into a Next.js project with `npx shadcn@4.21.0 add nowwcastle-sudo/sitebrew/<item>#v0.1.2 -y -o`.
- Walks you through `npm run stamp`, which turns a brief into site candidates.
- Starts the launch-factory template in mock mode, then lists what live mode needs.
- Tells you which keys you must create yourself. It lists names only and never asks you for a value.

## Limits you should know

- The public repositories do not include the stock photos, generated videos and photo textures of the private history. Their redistribution terms were not confirmed.
- Without `LAW_API_OC` the legal pages cannot be checked against the law, so a site stays marked not publishable until you add it.
- launch-factory conformance tests read the web-factory part of the same clone; run them from inside the Sitebrew clone.

The full list of keys is in `skills/guide/references/keys.md`.

## License

MIT. See `LICENSE`.
