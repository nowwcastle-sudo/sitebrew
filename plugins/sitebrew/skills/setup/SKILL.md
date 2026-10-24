---
name: setup
description: Installs what Sitebrew needs on the user's computer, one item at a time and only after the user says yes to that item - Node.js, Git, a browser for the quality checks, the Sitebrew clone at the pinned tag and its packages (winget on Windows, Homebrew on macOS; Linux steps are shown, never run). In a chat window that cannot run commands it gives the same steps to paste into the user's own terminal, with what to see when each one works. Use when something is missing, on a new computer, or before the first site. Trigger phrases - "set up Sitebrew", "install what is needed", "get my computer ready for Sitebrew", "prepare my computer", "설치해 줘", "환경 설치", "처음 설정", "준비해 줘", "필요한 거 깔아 줘".
---

# Set up the computer for Sitebrew

Reply in the user's language. In Korean use 해요체. Never ask for a key value and never print one. This skill installs only what Sitebrew needs: no account, no key and no cost.

<!-- env-block:start -->
## Where this runs (read first)

Do not assume you can run commands on the user's computer. Check first:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/setup.mjs" detect
```

The JSON says `mode`.

- `agent`: you have a tool that runs commands on the user's own computer. Follow this skill as written.
- `chatbot`: you cannot run commands for the user (a chat window, a cloud sandbox). Run nothing and do not say you ran anything. Follow the "Chatbot mode" section of this skill: ask the same questions, and give the user the command to paste into their own terminal and what they should see when it works.
- `remote` is `true`: this is a cloud session, not the user's computer. Install nothing here; say so and use the chatbot steps.
- `unsure` is `true`: ask once, in the user's language, "Can this window run commands on your own computer?" Then add `--as agent` or `--as chatbot` to the command. The user can always choose `chatbot`.

If this command cannot run at all (no command tool, or `${CLAUDE_PLUGIN_ROOT}` is not filled in), you are in chatbot mode. In Codex use the folder two levels above this `SKILL.md` file instead of `${CLAUDE_PLUGIN_ROOT}`.
<!-- env-block:end -->

## Agent mode

The command `setup.mjs` never installs anything by itself. It prints a plan, and it runs one item only when you pass `--yes` for that item after the user said yes.

### 1. See what is missing

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/setup.mjs" plan
```

The JSON holds `plan.items`: each item has an `id`, a `status`, a `say` sentence in Korean and English, and `steps`. `plan.items` is empty when nothing is missing: say so and stop.

| `status` | What you do |
|---|---|
| `todo` | Ask for it (step 2). The plan has the exact steps; you run them with `run`. |
| `manual` | Never run it. Show the `say` sentence and the printed steps (`manualOnly` and administrator steps such as `apt` or `sudo` are for the user to run). |
| `blocked` | Say why, from `say`. Nothing can run until that is fixed (for example the repository owner is not set in this plugin version). |

A Sitebrew-like folder that is not a release, and a development commit, are left alone: the plan shows a manual step and never overwrites them.

### 2. Ask for each item, then run it

Ask **one item at a time**, in the order of the plan. Say in one sentence what the item installs and whether Windows or the system may ask for the administrator password (a step with `mayElevate: true` may start a second try that the system answers with such a prompt). When the item has a `where` folder, name it, so the user knows where it lands. Then ask 「설치해도 될까요?」 (in the user's language) and wait. Never install in the same turn as the question.

After a **yes** for that item only:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/setup.mjs" run <id> --yes
```

Add `--kit <folder>` when the plan was made for a Sitebrew folder that is not the current folder (use the same value as for `plan`). The setup program uses that folder only as the working folder of the steps; it never puts a user value into a step's command. `kit-setup` and `kit-clone` take a long time (many minutes): give the command the longest time limit your tool allows, or run it in the background, and never stop it early.

The command prints `status`, `tail` (the last 20 lines of output) and `blocksFollowing`. The exit code says the same:

| Exit | Meaning | What you do |
|---|---|---|
| `0` | done and checked again | Say it in one sentence and go on to the next item. |
| `1` | failed (or an internal error) | Show the `tail`. Say which item failed and why, using the `say` sentence of the item. Offer the human steps of `references/install-steps.md`. Do not retry without the user. |
| `2` | the command line was wrong (for example an id that is not in the table) | Fix the command from the plan. Do not guess an id. |
| `3` | refused (manual item, cloud session, chatbot mode) | Say that this item is for the user to do. Show the steps. |
| `4` | installed, but this terminal does not see it yet | Stop. Tell the user to close the terminal (or Claude Code), open it again and run this skill again. Do not run the items that follow. |

After the last item run `plan` once more. An empty plan means the computer is ready: then run the `doctor` skill for the full check.

### 3. A user says no

Skip that item. Say what it turns off, one sentence, and give the human steps of `references/install-steps.md`. Do not ask again in the same conversation.

## Chatbot mode

This window cannot run commands. Run nothing.

1. Read `references/install-steps.md`. If you cannot read it, ask the user to attach that file, or tell them where it is in the plugin folder.
2. Ask which system the user has (Windows, macOS or Linux). Give only that system's section, in the user's language.
3. Give **one item at a time**: the command in a code block, the sentence about the administrator prompt if there is one, and "what you see when it works". Wait for the user to say what they saw before the next item.
4. When a result is not the expected one, ask the user to paste the last lines of the output (never a key or a password) and decide from those lines. If you cannot decide, say so.
5. After an install the user closes the terminal and opens it again. Say so.
6. At the end the user runs `node --version` and `git --version`. Then go on to the `new` skill.

The `references/install-steps.md` file is generated from the same data table as the plan. It carries the Korean text first, then the English text.
