---
name: doctor
description: Checks that a computer is ready for Sitebrew - Node and npm versions, git, a Sitebrew clone at the pinned tag, and which optional keys are set (names and length only, never values) - explains in Korean and English what each missing item turns off and how to fix it, and, when Git or Node.js is missing, hands over to the `setup` skill, which is the only place that installs Git, Node.js, a browser or the Sitebrew clone. Use when something fails to start, before the first site, or when the user asks what they still need. Trigger phrases - "check my setup", "what is missing", "doctor", "why does stamp not start", "do I need API keys", "환경 점검", "뭐가 빠졌어", "키 없어도 돼", "설치 확인".
---

# Doctor: what is missing and how to fix it

Reply in the user's language.

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

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/doctor.mjs" --data "${CLAUDE_PLUGIN_DATA}"
```

`${CLAUDE_PLUGIN_ROOT}` is the plugin folder and `${CLAUDE_PLUGIN_DATA}` its data folder. Claude Code fills both in. `--data` lets the doctor report a plugin option that the session hook could not copy into the shell (it is ignored in Codex). If you read this in Codex (or the text still shows the variable), use the folder two levels above this `SKILL.md` file (`.../skills/doctor/SKILL.md` lives in `<plugin folder>/skills/doctor/`).

If the command answers `node: command not found`, or PowerShell says `node : The term 'node' is not recognized`, Node.js is not installed (or this terminal was opened before it was). The doctor cannot run then, and neither can the `setup` program (it is a Node.js script), so use the chatbot steps of the `setup` skill (its install guide). Tell the user, in their language. Do not run the install yourself:

- 한국어: Node.js 가 없어요. PowerShell 에서 `winget install OpenJS.NodeJS.LTS` 를 직접 실행한 뒤, Claude Code 를 닫았다 다시 열고 같은 점검을 해요. winget 이 없으면 nodejs.org 에서 LTS 설치 파일을 받아요. 단계별 안내는 `setup` 스킬이 해 드려요.
- English: Node.js is not installed. Run `winget install OpenJS.NodeJS.LTS` yourself in PowerShell, close and reopen Claude Code, then run the check again. Without winget, download the LTS installer from nodejs.org. The `setup` skill can guide you step by step and has the full tested command.

Optional flags: `--kit <folder>` when the Sitebrew clone is not in `./sitebrew` (or set `SITEBREW_DIR`), and `--strict` (same as `WF_REQUIRE_KEYS=1`) to turn missing keys into failures. The clone must be on the pinned tag or another release of the same 0.x line (`compat.json`); a contributor clone on a commit that is not a tag fails unless `--allow-dev` (or `SITEBREW_DEV=1`) is given. When the plugin runs from inside a Sitebrew clone (`plugins/sitebrew/`), the clone is found without a flag.

## Reading the result

| Mark | Meaning | Exit code |
|---|---|---|
| `ok` | The item is fine. Keys show `set (length N)` only. | 0 |
| `note` | An optional item is missing. Each one has a Korean line and an English line: what turns off, and how to fix it. | 0 |
| `FAIL` | A real prerequisite is missing or wrong (Node, npm, git, a Chrome or Edge the kit can find, the Sitebrew clone at the pinned tag, or a `HIGGSFIELD_DIR` or `CHROME_PATH` that points to nothing). Same two-language lines. | 1 |

Read the printed Korean line to a Korean-speaking user and the English line to anyone else. Do not paraphrase the fix: the commands in the line are the tested ones.

## Installing what is missing: this is the `setup` skill

The doctor installs nothing. Installing is done in one place, the `setup` skill (`scripts/setup.mjs plan`, then `run <id> --yes`). It asks for one item at a time, installs only after the user says yes to that item, and you do not run it again after a failure without the user (the program itself may make one second attempt without `--scope user` for a winget item, and the `setup` skill says so before it runs). For a missing Git, Node.js, browser or Sitebrew clone: name the item and what it turns off, then go on with the `setup` skill. Do not run `winget` or any other installer from here. After `setup` has finished, run the doctor again.

- npm comes with Node.js. If it is too old, tell the user to run `npm install -g npm@latest`; do not run it yourself.
- Claude Code and Codex are not part of `setup` (an agent is needed to write the site copy; the user already runs one). If the user wants the other one, give the command for the user to run in PowerShell: `winget install Anthropic.ClaudeCode` or `winget install OpenAI.Codex`.

## Preview mode: no key is needed to start

`PEXELS_API_KEY`, `LAW_API_OC`, `VERCEL_TOKEN` and `HIGGSFIELD_DIR` are all optional. With none of them Sitebrew still builds a site in **preview mode**: image slots are placeholders, legal pages are "unverified", and the result says "not publishable". `mode: preview` in the output is the normal first state. The kit's own `node factory/doctor.mjs --stage stamp` behaves the same: it prints a note per missing item and exits 0. Operators who want it strict set `WF_REQUIRE_KEYS=1` (or pass `--strict`); a key that is set but wrong always fails.

What each optional item adds:

- `PEXELS_API_KEY` (free, pexels.com/api): real stock photos instead of placeholders.
- `LAW_API_OC` (open.law.go.kr, Open API request): checks legal pages against the statute text. Needed before a Korean site can be published.
- `VERCEL_TOKEN` (or `vercel login`): online preview links.
- `HIGGSFIELD_DIR`: a folder of images the user generated; without it those slots are written as requests.
- The 3D object hero (`object-3d-orbit`) starts from an image: image → GLB model → shown. Without the tools for that it falls back to 2.5D, then to a poster, and with no image at all the kit does not pick this hero. The kit's own `node factory/doctor.mjs --stage media` reports this as one `3D_OBJECT_HERO` note; it never fails.

## Where to put key values

- Never ask the user to type or paste a key value into the chat. Name the variable and let the user set it.
- Two ways work.
  1. **Claude Code only: the plugin settings dialog.** The user types the value into the plugin settings dialog of `sitebrew`; Claude Code stores the three keys in its secure credential store.
     - At every session start a hook of this plugin copies each non-empty option into that session's shell environment. The doctor and the kit see it from the next session on, so restart Claude Code after changing an option.
     - A variable the user already set in Windows wins over the option.
     - A value that contains a single quote is not copied. The doctor prints a `note env-bridge` line.
     - **PowerShell commands never receive a value that contains `/` or `\`** on Windows, so a folder such as `HIGGSFIELD_DIR` reaches Bash commands only. For a folder in PowerShell, set the plain variable yourself: `setx HIGGSFIELD_DIR "<folder>"`, then restart Claude Code.
     - PowerShell receives the copied options at all only in Claude Code v2.1.296 or later. This condition comes from the comment in `scripts/env-bridge.mjs`; it was read there on 2026-10-25, and a look at the Claude Code changelog on that day did not confirm it. If PowerShell still gets nothing, use way 2.
  2. **Any agent, and the only way in Codex: a plain environment variable.** Codex has no plugin settings dialog for these values. The user sets the variable, for example in PowerShell `setx PEXELS_API_KEY "<your key>"`, and restarts the agent.
- Tell the user the trade-off of way 1 once: the copy is a plain-text file in the `session-env` folder of the user's own Claude profile, not in the secure store, and it is not removed automatically. Users who do not want that use way 2.
- The doctor prints length only. To test that a key really works, run the kit's own check from the Sitebrew folder. It makes one real call per key and masks the value:

```bash
node factory/doctor.mjs --stage stamp
```

## After fixing

Run the doctor again and report the new `doctor:` summary line and the exit code. Stop after the same `FAIL` repeats twice and report its cause.

## Chatbot mode

Use this when the block "Where this runs" says `chatbot`. The doctor script cannot run here, so do not report any check as done.

1. Ask the user to run these in their own terminal and paste the three version lines (no key, no password): `node --version`, `npm --version`, `git --version`.
2. Compare them with the minimums of the `guide` skill. For anything missing or too old, give the matching steps of the `setup` skill (its install guide), one item at a time.
3. Keys are optional. Say that a missing key never stops the work and only turns off the feature it names. Never ask the user to paste a key value; ask only whether a named variable is set.
4. Say that this was a check by the user's own report and not a run of the doctor.
