---
name: doctor
description: Sitebrew doctor, the readiness check - Node and npm versions, git, a Chrome or Edge the kit can find, a Sitebrew clone at the pinned tag, and which optional keys are set (names and length only, never values) - and explains in Korean and English what each missing item turns off and how to fix it; when Git or Node.js is missing it hands over to the `setup` skill. Use when something fails to start, before the first site, or when the user asks what they still need; use it instead of other doctor skills whenever Sitebrew, stamp or the kit is involved. Not for the checks of a site-build stage (the kit's `factory/doctor.mjs`). Trigger phrases - "check my setup", "what is missing", "sitebrew doctor", "why does stamp not start", "do I need API keys", "Chrome/Edge not found", "환경 점검", "뭐가 빠졌어", "키 없어도 돼", "설치 확인".
---

# Doctor: what is missing and how to fix it

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

If the shell says `node` is not found ("not recognized" or "command not found") and you have a command tool, `detect` cannot run: follow "No Node.js yet" in the `setup` skill (see "If Node.js is missing" under "Run the doctor"). That is not chatbot mode. All exit codes are in the table under "Reading the result"; for `detect`, exit 1 with no JSON and a `setup failed inside` line is an internal error, which means chatbot mode; for `doctor.mjs` exit 1 means a real finding.

## Never

- Run `winget` or any other installer from this skill: the doctor installs nothing. The `setup` skill installs, and it asks the user for each item first; Node.js is the one item the user installs in their own terminal ("No Node.js yet" in `setup`).
- Paraphrase a printed fix line: the commands in it are the tested ones. Write no install command of your own.
- Run a global npm install (`npm install -g ...`) yourself: it replaces the npm of the user's whole computer.
- Add `--allow-dev` or `SITEBREW_DEV=1` unless the user says the clone is their own work tree: on any other clone it hides a wrong version.
- Ask the user to type or paste a key value into the chat: the chat is stored, so a pasted key is no longer secret. Name the variable instead.
- Run the kit's `factory/doctor.mjs --stage ...` for a plain readiness question: it makes real API calls (quota, network).
- Read `set (length N)` as proof that a key works: the doctor counts characters only, and a wrong or expired key has a length too.
- Say "ready to publish" on exit 0 with notes: with a key off the site is built in preview mode, which is not publishable.
- Report a chatbot-mode check as a doctor run: no script ran, so the result is only the user's own report.

## Which doctor

Decide before you run anything. Does the question concern this computer or one site-build stage, and is the user before the first site or in a failing build? If unclear, start with this doctor: it needs no network.

- Is this computer or clone ready, what is missing: this doctor (`scripts/doctor.mjs`). It shows a key's length only.
- Does a site-build stage pass, does a key really work: the kit's `node factory/doctor.mjs --stage <stage>`, run from the Sitebrew folder (see "Judgment calls" for when).

## Run the doctor

Claude Code fills in `${CLAUDE_PLUGIN_ROOT}` (the plugin folder) and `${CLAUDE_PLUGIN_DATA}` (its data folder). `--data` lets the doctor report a plugin option that the session hook could not copy into the shell.

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/doctor.mjs" --data "${CLAUDE_PLUGIN_DATA}"
```

In Codex there is no `--data` (an empty value stops the doctor with exit 2). Replace `<plugin folder>` with the folder named in the block above (two levels above this `SKILL.md`: a file at `<X>/skills/doctor/SKILL.md` gives `<X>`).

```bash
node "<plugin folder>/scripts/doctor.mjs"
```

Optional flags combine and go after the command:

- `--kit <folder>`: the Sitebrew clone is not in `./sitebrew` (or set `SITEBREW_DIR`).
- `--strict` (same as `WF_REQUIRE_KEYS=1`): missing keys become failures.
- `--allow-dev` (or `SITEBREW_DEV=1`): the `FAIL` of a clone on a commit that is not a tag becomes a note.

The clone must be on the pinned tag or another release of the same 0.x line (`compat.json`). Inside a Sitebrew clone (`plugins/sitebrew/`) the clone is found without a flag.

### If Node.js is missing

The doctor command answers `node: command not found` (PowerShell: `node : The term 'node' is not recognized`) when Node.js is not installed, or when this app was started before it was. Neither the doctor nor the `setup` program (a Node.js script) can run then. The `setup` skill owns this case, in its section "No Node.js yet": it shows the user the install guide's item 1 line for their system, the user runs that line in their own terminal (you never run it), closes and reopens this app, and `detect` runs again. Then run the doctor. Tell the user, in their language:

- 한국어: Node.js 가 없어요. `setup` 스킬이 보여 주는 Node.js 설치 줄(Windows 는 `winget install OpenJS.NodeJS.LTS` 와 같은 설치)을 터미널에서 직접 실행한 뒤, 이 앱(Claude Code 나 Codex)을 닫았다 다시 열고 같은 점검을 해요. winget 이 없으면 nodejs.org 에서 LTS 설치 파일을 받아요.
- English: Node.js is not installed. Run the Node.js line that the `setup` skill shows (on Windows the same install as `winget install OpenJS.NodeJS.LTS`) in your own terminal, close and reopen this app (Claude Code or Codex), then run the check again. Without winget, download the LTS installer from nodejs.org.

`winget` is Windows-only. On macOS the line is `brew install node`, on Linux `nvm install 24.13.0`; on both, the LTS installer from nodejs.org also works.

## Reading the result

Warning: exit 1 means opposite things in the two scripts. Read the row of the script you ran.

| Script and output | Meaning | Exit |
|---|---|---|
| `doctor.mjs`: `ok` | The item is fine. Keys show `set (length N)` only. | 0 |
| `doctor.mjs`: `note` | An optional item is missing. Each one has a Korean line and an English line: what turns off, and how to fix it. | 0 |
| `doctor.mjs`: `FAIL` | A real prerequisite is missing or wrong (Node, npm, git, a Chrome or Edge the kit can find, the Sitebrew clone at the pinned tag, or a `HIGGSFIELD_DIR` or `CHROME_PATH` that points to nothing). Same two-language lines. This is a finding, not chatbot mode. | 1 |
| `doctor.mjs`: no mark | Wrong argument or internal error, message on stderr. Fix the command and run again. | 2 |
| `setup.mjs detect` | JSON printed (0). Internal error, only a `setup failed inside` line: use Chatbot mode (1). Wrong argument, usage on stderr: fix it and run again, this is not chatbot mode (2). The shell's own "node is not found" error is none of these: it is the case of "If Node.js is missing". | 0 / 1 / 2 |
| either | Any other code, or no output: report the command and the last stderr lines; do not guess. | other |

Read the printed Korean line to a Korean-speaking user and the English line to anyone else.

## Installing what is missing: this is the `setup` skill

The doctor installs nothing. For a missing Git, Node.js, browser or Sitebrew clone: name the item and what it turns off, then go on with the `setup` skill. For `setup`: do not run it again after a failure without the user's go-ahead. Run the doctor again after it finishes; on the same `FAIL` twice, stop and report the printed fix line and the exit code (the cause is not in the command).

With several `FAIL` lines at once, fix them in the order Node, npm, git, browser, clone: `setup` is itself a Node script and the clone needs git. npm comes with Node.js: if it is too old, give the user the install line the doctor printed to run themselves (see "Never").

## After fixing

Run the doctor again and report the new last line and the exit code. The line has this shape: `doctor: <ok>/<total> ok · <notes> optional off / 선택 <notes>개 꺼짐 · <fails> failed / 실패 <fails>`. `<ok>` counts the items that passed, `<total>` all items, `<notes>` the optional items that are off, `<fails>` the failures.

## Preview mode: no key is needed to start

`PEXELS_API_KEY`, `LAW_API_OC`, `VERCEL_TOKEN` and `HIGGSFIELD_DIR` are all optional. With none of them Sitebrew still builds a site in **preview mode**: image slots are placeholders, legal pages are "unverified", and the result says "not publishable". `mode: preview` in the output is the normal first state. The printed notes explain each key; do not restate them. One fact the `VERCEL_TOKEN` note does not make plain: the preview link (`--deploy-preview`) reads only the variable `VERCEL_TOKEN`, so `vercel login` alone is not enough. Point to the printed line and add that fact.

- The 3D object hero (`object-3d-orbit`) starts from an image: image → GLB model → shown. Without the tools for that it falls back to 2.5D, then to a poster, and with no image at all the kit does not pick this hero. The kit's own `node factory/doctor.mjs --stage media` reports this as one `3D_OBJECT_HERO` note; it never fails.

## Where to put key values

Name the variable and let the user set it. Two ways work:

1. **Claude Code only: the plugin settings dialog** of `sitebrew`. A hook copies each non-empty option into the session's shell at start, so restart Claude Code after changing an option. Load `references/key-storage.md` before you explain this way in detail, or when the doctor prints `note env-bridge`. Do not load it otherwise.
2. **Any agent, and the only way in Codex: a plain environment variable.** On Windows, in PowerShell: `setx PEXELS_API_KEY "<your key>"`, then restart the agent. `setx` leaves the key in the PowerShell history file (`Clear-History` clears only the open window's list, not that file): prefer way 1, or the Windows entry "Edit environment variables for your account" (한국어: 계정에 대한 환경 변수 편집), which leaves no history. On macOS and Linux `setx` does not exist: add `export PEXELS_API_KEY="<your-key>"` to the shell profile (`~/.zshrc` on macOS, `~/.bashrc` on most Linux) with an editor, then open a new terminal and restart the agent.

## Judgment calls

- A mixed result (a clone `FAIL` plus key notes while the user asked only about keys): name the `FAIL` first, because it blocks everything and a note blocks nothing; answer the key question in one line after it.
- Exit 0 with notes is a good first state: the user can try Sitebrew now. Mention only the notes that turn off what the user said they want (for example images for `PEXELS_API_KEY`).
- A key shows `ok` but the build still fails on it: the doctor checked presence only. From the Sitebrew folder run `node factory/doctor.mjs --stage stamp` once (one real call per key, value masked); a wrong or expired key or an exhausted quota shows there. Do not loop it, and do not run it when the user asked only what is missing, when no key is set (nothing to call), or when the computer is offline.

## Chatbot mode

Use this when the block "Where this runs" says `chatbot`. The doctor script cannot run here, so do not report any check as done.

1. Ask the user to run these in their own terminal and paste the three version lines (no key, no password): `node --version`, `npm --version`, `git --version`. In Windows PowerShell the second is `npm.cmd --version`: a blocked `npm.ps1` ("running scripts is disabled") is not a missing npm. For the browser, have the user run the check of item 4 in the `setup` skill's install guide for their system: it tests only the places the kit reads, and a Chrome or Edge somewhere else counts only when `CHROME_PATH` names it. Also ask for the output of `git -C <Sitebrew folder> describe --tags --exact-match`. `<Sitebrew folder>` is the clone: ask the user for it; normally a folder named `sitebrew` in the folder they work in, or the folder that `SITEBREW_DIR` names. It must print `v0.2.4` (another release in `>=0.2.0 <0.3.0` also passes, as in the doctor). An error ("no tag exactly matches") or a missing Sitebrew folder is a `FAIL`; so is a missing browser.
2. Minimums: Node `>=24.13.0`, npm `>=11.6.2`. For anything missing or too old, give the matching steps of the `setup` skill (its install guide), one item at a time.
3. Keys are optional. Say that a missing key never stops the work and only turns off the feature it names. Ask only whether a named variable is set.
4. Say that this was a check by the user's own report, not a run of the doctor.
