[English](README.md) · [한국어](README.ko.md) · [简体中文](README.zh-CN.md) · [Español](README.es.md) · [日本語](README.ja.md)

# Sitebrew

**Answer a few questions. Get three finished websites. Keep the one you like.**

Sitebrew is a plugin for Claude Code and Codex. You describe your site in plain words. It builds three different candidates, you pick one, you adjust it in the conversation, and you take the code into your own folder. You do not need to know how to code, and you do not need an API key to start.

Current version `v0.2.1` · MIT license · Windows 10 and 11

## Why Sitebrew

- **Three real options, not one guess.** You compare three finished candidates side by side instead of rewriting one prompt again and again.
- **Code you own.** The result is a Next.js and shadcn/ui project in your folder. There is no hosted builder and no lock-in.
- **Nothing made up.** A fact you did not give, such as a phone number, stays a marked blank. Legal pages stay marked until they are checked.
- **Works without keys.** Without keys the site is made in preview mode. Optional keys add real photos, checked legal pages and preview links.
- **10 kinds of sites.** Brand, local business, online store, product detail, event or waitlist page, portfolio, public office, SaaS, mobile app (PWA) and admin dashboard, in Korean or English.
- **Motion and 3D.** Heroes can move, and the 3D object hero starts from one image (image → 3D model). Without the tools it falls back to a 2.5D image, then to a poster.
- **A back end when you need it.** The launch-factory kit in the same repository adds sign-up, payments, email and analytics.

## How it works

1. **Ask.** `/sitebrew:new` asks for the name, the audience, the contact details and the mood. You can skip what you do not know.
2. **Stamp.** The factory combines tested parts (blocks, style axes, recipes and archetypes) into three candidates. Each candidate goes through quality gates for layout, accessibility and copy.
3. **Pick.** The board shows the three candidates side by side, and you choose one.
4. **Revise.** `/sitebrew:revise` changes one section, the colors, the type, the motion or one piece of copy.
5. **Deliver.** `/sitebrew:deliver` copies the chosen site into your folder with a list of what to fill in before you publish.

## Install

### What you need

| Item | Version | Required | Install on Windows |
|---|---|---|---|
| Claude Code or Codex | Latest | One of the two | `winget install Anthropic.ClaudeCode` / `winget install OpenAI.Codex` |
| Node | >=24.13.0 | Yes | `winget install OpenJS.NodeJS.LTS` |
| npm | >=11.6.2 | Yes | Comes with Node |
| Git | Latest | Yes | `winget install Git.Git` |
| Chrome | Latest | No | `winget install Google.Chrome` |

Every installer below finds what is missing and tells you. It asks before it installs anything. Open PowerShell as a normal user, not as administrator.

### Pick one of five ways

| Way | Use it when |
|---|---|
| 1. npm | You already have Node |
| 2. npx | You already have Node and prefer npx |
| 3. PowerShell | You want one line that also checks Node and Git |
| 4. Plugin | You only want to add the plugin to Claude Code or Codex |
| 5. Your AI agent | You want Claude Code or Codex to do the install for you |

All five end in the same place: Sitebrew in a `sitebrew` folder and the plugin in your agent.

#### 1. npm

```powershell
npm create sitebrew@0.2.1 sitebrew
```

#### 2. npx

```powershell
npx create-sitebrew@0.2.1 sitebrew
```

Both take the same options: `--dry-run` shows the plan and changes nothing, `--yes` answers yes to every question, and `--tool` chooses `claude`, `codex` or `both`.

#### 3. PowerShell

```powershell
irm https://raw.githubusercontent.com/nowwcastle-sudo/sitebrew/v0.2.1/get.ps1 | iex
```

To see what it would do without installing anything:

```powershell
$env:SITEBREW_WHATIF = '1'
irm https://raw.githubusercontent.com/nowwcastle-sudo/sitebrew/v0.2.1/get.ps1 | iex
Remove-Item Env:SITEBREW_WHATIF
```

#### 4. Plugin

In Claude Code:

```text
/plugin marketplace add nowwcastle-sudo/sitebrew#v0.2.1
/plugin install sitebrew@sitebrew
```

In Codex:

```powershell
codex plugin marketplace add nowwcastle-sudo/sitebrew --ref v0.2.1
codex plugin add sitebrew@sitebrew
```

#### 5. Your AI agent

Paste this into Claude Code or Codex. The agent follows [AGENT_INSTALL.md](AGENT_INSTALL.md), a step-by-step guide written for agents.

```text
Install Sitebrew for me. Read https://raw.githubusercontent.com/nowwcastle-sudo/sitebrew/main/AGENT_INSTALL.md and follow it step by step. Ask me before you install any program, and ask me which agent to use. At the end, show me the last lines of the installer output.
```

If an install stops, its exit code and what to do are in [AGENT_INSTALL.md](AGENT_INSTALL.md).

## Make your first site

Open Claude Code in an empty folder and run:

```text
/sitebrew:doctor
/sitebrew:new
```

`/sitebrew:doctor` lists what is missing, with one line on how to fix each item. In Codex, say "make a site with the sitebrew new skill". The optional keys and the full skill list are in the [plugin guide](plugins/sitebrew/README.md).

## For developers

The repository has three parts: the site factory (web-factory) at the root, the back-end kit in `launch-factory/` and the plugin in `plugins/sitebrew/`.

```bash
git clone https://github.com/nowwcastle-sudo/sitebrew.git
cd sitebrew
npm run setup
npm run dev
```

The check before a merge is `npm run ci:verify`. The guide for agents is [docs/agents/agent-guide.md](docs/agents/agent-guide.md), and the launch kit is described in [launch-factory/README.md](launch-factory/README.md).

You can also add the parts to another Next.js project. Always pin the tag:

```bash
npx shadcn@4.22.1 add nowwcastle-sudo/sitebrew/factory-default#v0.2.1 -y -o
npx shadcn@4.22.1 add nowwcastle-sudo/sitebrew/factory-base#v0.2.1 -y -o
```

## Contributing

Contributions are welcome: bug reports, ideas, new recipes or blocks, and translations. Read [CONTRIBUTING.md](CONTRIBUTING.md) to start. It is short.

## License

MIT. See [LICENSE](LICENSE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Release history

| Tag | Date | Changes | Record |
|---|---|---|---|
| `v0.2.1` | 2026-10-25 | Patch release: shadcn 4.22.1 pinned in one place (clears the nested zod advisory) · campaign pages are noindex by default · product lists carry ItemList and event landings carry Event structured data · the share card shows the brand logo · event landing briefs ask for date and venue · the add-recipe check follows the guide · web-factory v0.0.16 + launch-factory v0.2.2 (internal versions) | — |
| `v0.2.0` | 2026-10-24 | Back-end modules that run in mock mode without keys (shop and Korean payments, booking, notifications and push, reviews, search, storage, newsletter, my requests, admin) · shareable preview links through a Cloudflare quick tunnel · owner guides and a runbook shown once you decide to use the site · the skill now detects chatbot or agent mode, and a new setup skill installs what is missing · web-factory v0.0.14 + launch-factory v0.2.0 (internal versions) | — |
| `v0.1.2` | 2026-10-16 | Plugin directory review: the doctor reads the clone address from compat.json, the plugin README lists its network calls, the release guide adds the GitHub release step; lucide-react 1.53.0 in the launch kit | — |
| `v0.1.1` | 2026-10-15 | Ready for the Claude plugin directory: line-ending rules no longer touch `plugins/sitebrew`, plugin icon, clearer doctor note, five install methods, AGENT_INSTALL.md and CONTRIBUTING.md | — |
| `v0.1.0` | 2026-10-15 | First public release · web-factory v0.0.13 + launch-factory v0.1.2 (internal versions) | — |
