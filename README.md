[English](README.md) · [한국어](README.ko.md) · [简体中文](README.zh-CN.md) · [Español](README.es.md) · [日本語](README.ja.md)

# Sitebrew

Sitebrew answers a few questions with three website candidates. You compare the three side by side and pick one. You adjust it, then get it in your own folder. It runs as a plugin inside Claude Code or Codex, and you do not need to know how to code.

Current version `v0.1.0`.

- It makes 10 kinds of sites: brand, local business, online store, product detail, event or waitlist landing page, portfolio, public office, SaaS, mobile app (PWA) and admin dashboard.
- It makes Korean and English sites. Local business and public office sites are Korean only.
- Services that need sign-up and payments connect to the launch-factory kit in the same repository.
- It is built and tested on Windows 10 and 11.

## What you need

| Item | Version | Required | Install on Windows |
|---|---|---|---|
| Claude Code or Codex | Latest | One of the two | `winget install Anthropic.ClaudeCode` / `winget install OpenAI.Codex` |
| Node | >=24.13.0 | Yes | `winget install OpenJS.NodeJS.LTS` |
| npm | >=11.6.2 | Yes | Comes with Node |
| Git | Latest | Yes | `winget install Git.Git` |
| Chrome | Latest | No | `winget install Google.Chrome` |

- The installer below finds what is missing and tells you. It asks before it installs anything, and installs nothing until you answer.
- Claude Code and Codex need you to sign in with an account of that service.
- Without Chrome, only some screen checks are skipped. Sites are still made.
- To open PowerShell, search for "PowerShell" in the Start menu. Do not open it as administrator: the installer stops in an administrator window.

## Install

### One-line install (recommended)

Paste the line below into PowerShell. The installer gets Sitebrew into a `sitebrew` folder under the current folder and installs the plugin into the agent you choose.

```powershell
irm https://raw.githubusercontent.com/nowwcastle-sudo/sitebrew/v0.1.0/get.ps1 | iex
```

To see what it would do without installing anything, run this:

```powershell
$env:SITEBREW_WHATIF = '1'
irm https://raw.githubusercontent.com/nowwcastle-sudo/sitebrew/v0.1.0/get.ps1 | iex
Remove-Item Env:SITEBREW_WHATIF
```

To choose the agent or the folder yourself, use the form that takes options. `-Tool` is one of `claude`, `codex` or `both`. `-Yes` answers yes to every question. `-WhatIf` only previews.

```powershell
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/nowwcastle-sudo/sitebrew/v0.1.0/install.ps1).TrimStart([char]0xFEFF))) -Tool claude -Folder "$HOME\sitebrew"
```

### Install with npx

If you already have Node, this also works. It gets the repository, shows the two plugin install commands and runs them when you answer yes.

```powershell
npx create-sitebrew@0.1.0 sitebrew
```

### Install only the plugin

In Claude Code:

```text
/plugin marketplace add nowwcastle-sudo/sitebrew#v0.1.0
/plugin install sitebrew@sitebrew
```

In Codex:

```powershell
codex plugin marketplace add nowwcastle-sudo/sitebrew --ref v0.1.0
codex plugin add sitebrew@sitebrew
```

To check the install, run `claude plugin list`.

## Make your first site

1. Open Claude Code in an empty folder for the site files.
2. Run `/sitebrew:doctor` to see what is missing. Each missing item comes with one line on how to fix it.
3. Run `/sitebrew:new` and answer the questions: name, audience, contact details, mood and so on. You can leave out what you do not know.
4. Compare the three candidates and pick one.
5. To change something, use `/sitebrew:revise` for one section, the colors, type or motion, or one piece of copy.
6. Use `/sitebrew:deliver` to get the chosen site in your own folder. The guide that comes with it lists what to fill in before you publish.

```text
/sitebrew:doctor
/sitebrew:new
```

In Codex, say "make a site with the sitebrew new skill". For an English site, say "English site" at the start.

## Preview mode and blanks

You can start without any key. Without keys the site is made in preview mode and marked "not publishable". One line says what is missing for each reason.

- "To be confirmed": a fact you left out in the questions (phone number, business details and so on). It is left blank, never made up. You fill it in.
- "Real photo needed": a place where only a real photo fits, such as the shop or the product screen. You add your photo.
- "Legal review pending": the terms and privacy policy drafts are not yet checked against the law.

All values below are optional. Claude Code asks for them when you enable the plugin. If you installed from the command line it does not ask, so add them with `/plugin configure sitebrew@sitebrew`. Never paste a key into the chat.

| Name | What it adds |
|---|---|
| `PEXELS_API_KEY` | Real stock photos instead of empty photo places |
| `LAW_API_OC` | Korean legal pages checked against the current statute text |
| `VERCEL_TOKEN` | Online preview links |
| `HIGGSFIELD_DIR` | A folder of your own images and 3D models |

```text
/plugin configure sitebrew@sitebrew
```

The 3D object hero (`object-3d-orbit`) starts from an image: image → GLB (3D model) → shown on screen. Without the tools it falls back to a 2.5D image, then to a poster. With no image at all, this hero is not picked.

## Words used here

| Word | Meaning |
|---|---|
| Candidate | One version of the site made from the same answers. Three at a time |
| Board | The screen where you put the candidates side by side and pick |
| Stamp | Making a site from your answers (`npm run stamp`) |
| Preview mode | A site made while keys or facts are missing. Good for choosing, not for publishing |
| Not publishable | A mark that something must be filled in before you publish. The reason comes with it |
| Doctor | A check that says what is missing on your computer and how to fix it |
| Inspection bench | A developer screen that shows parts and blocks one by one (`npm run dev`) |

## When the install stops

The installer leaves its result in `$LASTEXITCODE`. Run outside a terminal, it treats every question as answered "no".

| Code | Meaning | What to do |
|---|---|---|
| 0 | Done, or preview | Follow the next step on the last line |
| 1 | A download, clone or plugin command failed | Check the internet connection and run the same line again |
| 2 | A wrong option or folder | Check the `-Folder` path. Folders under Windows or Program Files are refused |
| 3 | Something is missing or needs your answer | Run the install command shown, or run again with `-Yes` |
| 4 | Refused to start | In an administrator window, run again in a normal PowerShell window |

With `-Yes` it also answers yes to saving the Sitebrew folder in the user environment variable `SITEBREW_DIR`.

## For developers

The repository has three parts. `factory/` and `registry/` are the site factory (web-factory), and `launch-factory/` is the sign-up, payment, email and analytics kit. `plugins/sitebrew/` is the plugin and `packages/create-sitebrew/` is the npx installer.

```bash
git clone https://github.com/nowwcastle-sudo/sitebrew.git
cd sitebrew
npm run setup
npm run dev
```

- `npm run setup` checks the environment and installs the dependencies if needed. `npm run dev` opens the inspection bench.
- The check before a merge is one line: `npm run ci:verify`.
- The full guide for agents is [docs/agents/agent-guide.md](docs/agents/agent-guide.md).
- How to add a recipe or a block is in [docs/guides/add-recipe.md](docs/guides/add-recipe.md).
- How to use launch-factory is in [launch-factory/README.md](launch-factory/README.md).
- The release steps are in [docs/RELEASING.md](docs/RELEASING.md). Font licenses are in [docs/qa/font-licenses.md](docs/qa/font-licenses.md).

You can also install only the parts into another Next.js project. Always add the tag to the address.

```bash
npx shadcn@4.21.0 add nowwcastle-sudo/sitebrew/factory-default#v0.1.0 -y -o
npx shadcn@4.21.0 add nowwcastle-sudo/sitebrew/factory-base#v0.1.0 -y -o
npx shadcn@4.21.0 add nowwcastle-sudo/sitebrew/alert-dialog#v0.1.0 -y -o
```

## License

MIT. See [LICENSE](LICENSE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Release history

| Tag | Date | Changes | Record |
|---|---|---|---|
| `v0.1.0` | 2026-10-15 | First public release · web-factory v0.0.13 + launch-factory v0.1.2 (internal versions) | — |
