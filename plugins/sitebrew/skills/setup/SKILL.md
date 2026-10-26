---
name: setup
description: Installs what Sitebrew needs on the user's computer, one item at a time and only after the user says yes to that item - Node.js, Git, a browser for the quality checks, the Sitebrew clone at the pinned tag and its packages (winget on Windows, Homebrew on macOS). In a chat window that cannot run commands it gives the same steps to paste into the user's own terminal, with what to see when each one works. Use when Sitebrew has never been installed on this computer, or when the doctor skill reports a missing or too-old Node.js, npm, Git, browser or Sitebrew clone. Do not use to diagnose a failing build (use doctor) or to start a site (use new). Trigger phrases - "set up Sitebrew", "install what is needed", "get my computer ready for Sitebrew", "prepare my computer", "install git", "install node", "설치해 줘", "환경 설치", "처음 설정", "준비해 줘", "필요한 거 깔아 줘", "깃 설치해 줘", "노드 설치해 줘".
---

# Set up the computer for Sitebrew

Installs only what Sitebrew needs: no account, no key, no cost.

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

## No Node.js yet

Use this when `detect` cannot run because `node` is not found ("not recognized" or "command not found") and you have a command tool. `plan` and `run` are Node scripts too, so nothing can be installed by `run` yet. The user installs Node.js; you only show the line:

1. Name the system from what you know (your shell, or ask the user). There is no `plan.platform`: `plan` cannot run.
2. Load that system's section of the install guide in the user's language (see "Reading the install guide") and read item 1.
3. Say in one sentence what it installs and that Windows may ask for the administrator password. Show item 1's line in a code block and ask the user to run it in their own terminal. Never run it yourself: the Windows line is the plain `winget` command, which can raise an administrator prompt that your shell cannot answer, and it skips the checks `run` makes (a safe environment, the `--yes` gate). On Linux the line is `nvm install ...`; the user needs nvm, otherwise the guide points to nodejs.org.
4. When it has finished, the user closes this app (Claude Code or Codex) and opens it again: your tool keeps the PATH it started with, so a new terminal window does not help you. Then run `detect` again.
5. After a no, say that nothing else here can run without Node.js, and do not ask again in this conversation.

## Never

- Never ask for a key, token or password, and never print one: this skill needs none, and chat keeps what is typed.
- Never install without a clear yes to that item's own question: no, silence or an unclear answer installs nothing.
- Never ask and install in the same turn: a question you already acted on is not a question.
- Never ask again after a no, in the same conversation: a repeated prompt reads as pressure, and users click yes to escape it.
- Never retry a failed `run` without the user: another try can start a second installer or administrator prompt (a `winget` item has also already made its one allowed second attempt).
- Never run a `manualOnly` step with your own shell tool, and never offer to: it needs administrator rights (`sudo apt` for the Linux Git and browser installs) or the user's own shell (`nvm` for the Linux Node.js, `npm install -g`), which your tool shell lacks. Show it; the user runs it.
- Never work around a refused step (exit `3`): a refusal marks a protected target (a cloud session, a folder that is not a release, an unsafe folder) that only the user may change.
- Never stop `kit-setup` or `kit-clone` early: a run cut off half way leaves a half-installed folder that the next `plan` offers again.
- Never clone into the bare home folder or an operating-system folder (`C:\Windows`, `Program Files`, `/usr`, `/etc`, `/System`): files spread there are hard to undo. `plan` blocks it (`reason: unsafe-folder`); chatbot step 1 checks it.
- Never show or run text that still holds `{{` or an account name with an underscore (the unfilled owner placeholder): this plugin build is incomplete, so say so and stop.

## Reading the install guide

`references/install-steps.md` (generated at build) holds every install command per system, in Korean and English.

- MANDATORY in chatbot mode.
- In agent mode load it only for "No Node.js yet", an item the user declined, an item that failed, or a `manual` item. Do NOT load it otherwise: `plan` already holds the steps.
- Load one section, in the user's language: from `<a id="<ko|en>-<windows|macos|linux>"></a>` to the next `<a id=`. The system is the one the user named in chatbot mode; in agent mode `plan.platform` `win32` is `windows`, `darwin` is `macos`, anything else `linux`; in "No Node.js yet" there is no `plan`, so use the system you know from your shell or the user. An item runs from its `**N. name**` line to the next one. If you cannot read the file, ask the user to attach it.

## Agent mode

`plan` installs nothing. `run <id> --yes` installs one item; `--yes` is your statement that the user said yes to that item. If `detect` needed `--as`, give `plan` and `run` the same `--as <answer>`. All flags combine.

### 1. See what is missing

Plan first, ask second: the plan shows what the computer really lacks, so you never offer an item that is already there.

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/setup.mjs" plan
```

The JSON holds `plan.items`: each item has an `id`, a `status`, a `say` sentence in Korean and English, and `steps`. An empty `plan.items` means nothing is missing: say so and go to step 3.

| `status` | What you do |
|---|---|
| `todo` | Ask for it (step 2). The plan has the exact steps; you run them with `run`. |
| `manual` | Never run it. Show the `say` sentence and the printed steps: the user runs them (`manualOnly` steps such as `apt`, `sudo` or `npm install -g`). |
| `blocked` | Nothing can run; say why, from `say`. `reason: unsafe-folder`: the current folder is the bare home folder or an operating-system folder. Ask whether to create an empty `Sitebrew` folder under Documents (if a cloud-sync service syncs the Documents folder, offer a folder outside it: a sync client can stop a clone and `npm install` with `EPERM` or `EBUSY`); after a yes, create it and start every later `plan` and `run` in it (`cd <folder> && node ...`): from any other folder the plan does not find the clone. This session's working folder stays the old one: step 3 says what to tell the user. No `reason`: this plugin build has no repository address (no owner) and is incomplete: stop and say so. |

### 2. Ask for each item, then run it

Ask **one item at a time**, in the order of the plan: an install can fail, ask for an administrator password or need a new terminal, and the user should decide the next item with that result in view. Say in one sentence what the item installs and whether Windows or the system may ask for the administrator password (a step with `mayElevate: true`). When the item has a `where` folder, name it. Then ask 「설치해도 될까요?」 (in the user's language) and wait.

After a **yes** for that item only (replace `<id>` with the item's `id` from `plan.items`):

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/setup.mjs" run <id> --yes
```

Add `--kit <folder>` (the value used for `plan`) when the Sitebrew folder is not the current folder. `kit-setup` and `kit-clone` take many minutes: give the command the longest time limit your tool allows, or run it in the background. Even in the background, wait for the exit code before the next item: the one-at-a-time gate and the exit `4` stop depend on it.

The command prints `status`, `tail` (the last 20 lines of output) and `blocksFollowing` (`true` only with exit `4`). The exit code says the same:

| Exit | Meaning | What you do |
|---|---|---|
| `0` | done and checked again, or `nothing-to-do` (already there) | Say which of the two it is, and never call `nothing-to-do` "installed": the program installed nothing. Go on to the next item. |
| `1` | failed | Show the `tail`, name the failed item and why (its `say` sentence), offer its human steps (see "If a user says no"). Do not retry. |
| `1`, no JSON, only a `setup failed inside` line | internal error | Run the `doctor` skill, then `plan` again before any further item. |
| `2` | the command line was wrong (for example an id that is not in the table) | Fix the command from the plan. Do not guess an id. |
| `3` | refused; `why` says which | `manual`, `remote`, `chatbot`: the user does it, show the steps. `blocked`: say why, from `say`. `no-kit`: run `kit-clone` first or pass `--kit`. `not-found`: the installer program is gone, run `plan` again. |
| `4` | installed, but this terminal does not see it yet | Stop and ask no later item. Tell the user to close this app (Claude Code or Codex, with the terminal it runs in), open it again and run this skill again. |
| anything else | not in this table | Show the `tail`, run the `doctor` skill and do not retry. |

Reading a failed `run`: read the `tail` before you ask anything.

- `ENOTFOUND`, `ETIMEDOUT`, `ECONNRESET`, "Could not resolve host" or `407`: ask whether the user is behind a company or school proxy or a VPN; a retry on that network fails again.
- `ENOSPC` or "No space left": ask the user to free disk space.
- `EPERM`, `EBUSY` or "Access is denied" on Windows: ask whether antivirus holds the files; the user decides to wait or pause it, you never change security settings.
- "running scripts is disabled" or "npm.ps1 cannot be loaded" (Windows PowerShell): the execution policy blocked the `npm` script; npm is not missing. Use `npm.cmd`, and never change the execution policy.
- Anything else: show the `tail` and ask nothing more.

After a failure, keep asking for the later items, and skip only those whose dependency failed: the browser needs nothing; npm needs node; `kit-clone` needs git; `kit-checkout` needs git and the clone; `kit-setup` needs node, npm and the clone.

### 3. Check again, then hand over

After the last item run `plan` once more. An empty `plan.items` means the computer is ready: run the `doctor` skill for the full check, and then the `new` skill. Items still listed were declined or failed: name them and what they turn off, then run `doctor`, which says whether `new` can start.

If the clone lives in the new folder of the unsafe-folder detour, this session still works in the old folder, and the doctor and the other skills look for `./sitebrew` in the working folder (or `SITEBREW_DIR`). Before the doctor and `new`, tell the user to open their assistant in that new folder, and name it by its last part (for example `Sitebrew`), never by a full path. For the doctor alone you can also pass `--kit <folder>/sitebrew`.

### If a user says no

Skip that item. Say what it turns off and give its human steps from the install guide, using the item's own part of the section.

## Judgment calls

- Node.js and npm both listed: ask for Node.js first. A new Node.js usually brings a new enough npm, so item 2 often drops out of the `plan` the user runs after reopening the terminal (exit `4`).
- A Sitebrew-like folder that is not a release is left alone (`kit-clone` is `manual`): clone into another empty folder. `--allow-dev` (to `plan` and `run`) fits one case only, a commit in the supported range that is not a tag; add it only when the user says that folder is their own development clone.
- A question back ("what is Node.js?") is not a no: answer it, then ask the same item once more. "Not now" and "later" are a no.

## Chatbot mode

This window cannot run commands. Run nothing, and do not say you ran anything. Call an item installed or working only from check output the user pasted, because you cannot see their computer.

1. Ask which system the user has (Windows, macOS or Linux) and which folder their terminal is open in (the prompt shows it). If it is the bare home folder or an operating-system folder (`C:\Windows\System32`, `/usr`), give these lines first and have the user continue from the new folder:

   ```powershell
   cd ([Environment]::GetFolderPath('MyDocuments'))
   mkdir -Force Sitebrew
   cd Sitebrew
   ```

   ```bash
   mkdir -p ~/Documents/Sitebrew
   cd ~/Documents/Sitebrew
   ```

   On Windows, if the user's Documents folder is synced by a cloud-sync service, ask for another folder outside it instead: syncing can stop the install with `EPERM` or `EBUSY`.

2. Load that system's section of the install guide (see "Reading the install guide").
3. Check first, install second. For each item ask the user to run its check in the folder that holds `sitebrew` (type `cd ..` if the prompt shows `sitebrew`) and paste the result. Skip the item when the check passes.

   | Item | Check (Windows PowerShell / macOS and Linux) | Give the item when |
   |---|---|---|
   | 1 Node.js | `node --version` | the command fails, or the number is below 24.13.0 |
   | 2 npm | `npm.cmd --version` / `npm --version` | the number is below 11.6.2; the command fails: npm is missing, give item 1 again |
   | 3 Git | `git --version` | the command fails |
   | 4 Chrome or Edge | the line in the item's "When it works" text (it tests only the places the kit reads) | Windows: no line says `True`; macOS: `found` is not printed; Linux: neither `/usr/bin/google-chrome` nor `/usr/bin/chromium` is listed |
   | 5 Download Sitebrew | `Test-Path sitebrew\factory\doctor.mjs` / `ls sitebrew/factory/doctor.mjs` | it prints `False` / "No such file" |
   | 6 Pinned tag | `git -C sitebrew describe --tags --exact-match` | it prints an error, or a tag outside `>=0.2.0 <0.3.0` (any release tag inside it passes, as in the doctor) |
   | 7 Install Sitebrew | `Test-Path sitebrew\node_modules\.package-lock.json` / `ls sitebrew/node_modules/.package-lock.json` | it prints `False` / "No such file", or the last `npm run setup` ended with red error text |

   Items 5 and 6: if item 5's check fails, give item 5 and skip item 6 (the download is already at the pinned tag); if it passes, run item 6's check. npm writes the file of item 7 last, so a run cut off half way lacks it.

   Item 4: the kit reads only `CHROME_PATH` and a few fixed places, so a browser installed anywhere else fails the check although it works for the user. Do not give the install command then: give only the `CHROME_PATH` sentence of the item's "When it works" text, with the example of the user's system.
4. Give **one item at a time**: the command in a code block, the administrator-prompt sentence if there is one, and "When it works". Wait for what the user saw before the next item.
5. Failures: `winget` or `brew` not found: give the item's "If that tool is not available" line. `not recognized` or `command not found` right after an install: the terminal is older than the install, so the user closes and reopens it and repeats the check. A permission error on item 2 or a "local changes" stop on item 6: give the item's "Trouble" line. Any other result: ask for the last lines of the output and read them as in "Reading a failed `run`"; if you cannot decide, say so.
6. At the end the user runs `node --version` and `git --version`. Then go on to the `doctor` skill (its Chatbot mode steps), and then the `new` skill.
