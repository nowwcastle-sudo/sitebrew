# Installing Sitebrew — instructions for AI agents

You are an AI coding agent (Claude Code, Codex or similar) and a person asked you to install Sitebrew for them. Follow the steps in order. Each step has a command, how to tell it worked, and what to do when it did not. Run every command in **PowerShell** unless a step says otherwise.

Sitebrew version: `v0.2.3` · npm package: `create-sitebrew@0.2.3` · repository: `https://github.com/nowwcastle-sudo/sitebrew`

## Rules for you

- **Ask the person before you install any program** (Node, Git, Claude Code, Codex, Chrome). Show the exact command first.
- **Ask the person which agent to set up**: `claude`, `codex` or `both`. Do not pick for them.
- **Never ask for, read or print an API key or token.** Sitebrew works without keys. Keys are added later by the person with `/plugin configure sitebrew@sitebrew`, not in chat.
- **Do not run anything as administrator.** The installer refuses to start in an administrator window.
- **Pin the version.** Use `create-sitebrew@0.2.3` and the tag `v0.2.3` exactly as written here. Do not use `@latest` or the `main` branch for the install.
- When a step fails twice for the same reason, stop and tell the person the command, the exit code and the last 20 lines of output.

## Step 1 — Check the operating system

```powershell
[System.Environment]::OSVersion.VersionString
```

- **Works:** the output starts with `Microsoft Windows NT 10.0` (Windows 10 and 11 both report 10.0).
- **Otherwise:** tell the person that Sitebrew is built and tested on Windows 10 and 11 only, and stop.

## Step 2 — Check the tools

First ask the person which agent to set up: `claude`, `codex` or `both`. Then run the lines below and compare with the minimum. Skip `claude --version` or `codex --version` when the person did not choose that agent.

```powershell
node -v
npm -v
git --version
claude --version
codex --version
```

| Tool | Works when | Install command (ask first) |
|---|---|---|
| Node | `v24.13.0` or newer (any newer version is fine) | `winget install --id OpenJS.NodeJS.LTS -e` |
| npm | `11.6.2` or newer (any newer version is fine) | comes with Node |
| Git | any version prints | `winget install --id Git.Git -e` |
| Claude Code | prints a version (only if the person chose `claude` or `both`) | `winget install --id Anthropic.ClaudeCode -e` |
| Codex | prints a version (only if the person chose `codex` or `both`) | `winget install --id OpenAI.Codex -e` |

- A command that is "not recognized" means the tool is missing.
- After you install Node or Git, **open a new PowerShell** (the old one does not see the new program) and run Step 2 again.
- Claude Code and Codex need the person to sign in once with their own account. Ask them to do it; do not do it for them.

## Step 3 — Choose the folder

Use `$HOME\sitebrew` unless the person asks for another place. Run the installer **from the home folder**, not from inside a copy of the `create-sitebrew` package (npm then looks for the command in the wrong place).

```powershell
Set-Location $HOME
Test-Path "$HOME\sitebrew"
```

- **Works:** `False` (the folder does not exist yet), or the folder exists and is empty.
- **Otherwise:** ask the person for another folder name. Never delete or empty a folder yourself.
- Folders under `C:\Windows` or `C:\Program Files` are refused by the installer.

## Step 4 — Preview the install

Replace `<tool>` with the person's answer (`claude`, `codex` or `both`). This changes nothing.

```powershell
npx --yes create-sitebrew@0.2.3 sitebrew --dry-run --tool <tool>
```

- **Works:** exit code `0` and lines that start with `[dry-run] would run:`. The first one clones `--branch v0.2.3`.
- Lines that start with `[dry-run] would ask:` are the installer's own questions (for example, whether to save the folder in `SITEBREW_DIR`). In Step 5, `--yes` answers them with yes.
- Show the planned lines to the person and ask: "Install now?" Continue only on a clear yes.

## Step 5 — Install

```powershell
npx --yes create-sitebrew@0.2.3 sitebrew --yes --tool <tool>
"exit=$LASTEXITCODE"
```

`--yes` answers yes to the installer's own questions: it clones Sitebrew into `sitebrew`, saves that folder in the user environment variable `SITEBREW_DIR` (so the tools find it from any folder), runs the environment check and installs the plugin. Tell the person this before you run it.

| Exit code | Meaning | What you do |
|---|---|---|
| 0 | Done | Go to Step 6 |
| 1 | A download, clone or plugin command failed | Check the internet connection, then run the same command once more |
| 2 | A wrong option or folder | Go back to Step 3 and choose another folder |
| 3 | Something is missing, or a new terminal is needed | Read the last lines: install what they name (ask first), open a new PowerShell, run again |
| 4 | The installer refused to start | It is an unpublished or administrator copy: use a normal PowerShell and the exact command above |

The one-line PowerShell installer (`get.ps1`) uses the same exit codes.

## Step 6 — Check the result

```powershell
node "$HOME\sitebrew\plugins\sitebrew\scripts\doctor.mjs" --kit "$HOME\sitebrew"
"exit=$LASTEXITCODE"
```

- **Works:** exit code `0`. Each line starts with `ok`, `note` or `info`, and the last line reads `doctor: N/M ok`. A `note` about an optional key (such as `VERCEL_TOKEN`) is fine: Sitebrew runs in preview mode without it.
- Exit code `1`: at least one line starts with `FAIL`. That line says how to fix it. Ask before installing anything it names. The doctor installs nothing itself; once the plugin is loaded, the `setup` skill (`/sitebrew:setup` in Claude Code; ask for it by name in Codex) installs what is missing, one item at a time and only after a yes to that item.

If the person chose `claude` or `both`, also run:

```powershell
claude plugin list
```

- **Works:** the list contains `sitebrew@sitebrew`.

## Step 7 — Tell the person what to do next

Tell them, in their language:

1. The install is done, and where Sitebrew is (`$HOME\sitebrew`).
2. Restart Claude Code or Codex so the plugin loads.
3. Open the agent in an **empty folder** for the new site and run `/sitebrew:doctor`, then `/sitebrew:new`. In Codex, say "make a site with the sitebrew new skill".
4. Optional keys (real photos, legal checks, preview links) are added with `/plugin configure sitebrew@sitebrew`. Never paste a key into the chat.

Then show them the last lines of the installer output.

## Other ways to install

If `npx` cannot be used, the same install is available as:

```powershell
npm create sitebrew@0.2.3 sitebrew -- --yes --tool <tool>
```

```powershell
irm https://raw.githubusercontent.com/nowwcastle-sudo/sitebrew/v0.2.3/get.ps1 | iex
```

The second one asks its questions in the terminal, so it suits a person typing, not an agent. More about Sitebrew is in [README.md](README.md).
