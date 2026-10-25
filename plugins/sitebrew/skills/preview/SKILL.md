---
name: preview
description: Opens a Sitebrew site folder on a temporary public link, with no account, key or cost, to send as a preview link; also checks or closes it. Use when the user wants a preview link, to share their site, to let someone see it on the internet for a while, to make localhost public, or asks if the link is still open. Not for a permanent address (hosting guidance) or for making the site folder (`deliver`). Trigger phrases - "preview link", "temporary public address", "open my site on the internet for a while", "let someone see my site", "share my site", "send a link to my client", "make localhost public", "is the link still open", "Sitebrew share link", "close the public address", "임시 공개 주소", "남한테 보여줄 주소 만들어 줘", "인터넷에 잠깐 열어 줘", "주소 아직 열려 있어?", "공개 주소 닫아 줘".
---

# Temporary public address for a delivered site

In Korean use 해요체.

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

- Never ask for a key, a token, a password or an account: none is needed.
- Never print environment values: the chat history is stored, so a secret printed once stays there, and the environment can hold keys of other tools.
- Never open a site that holds real customer data or real payments: anyone with the link can read that data, and the notices say "fake data only" and would be false.
- Never turn a no, silence or an unclear answer into a yes: the address would open without the user's consent.
- Never repeat the 「공개 주소를 열어도 될까요?」 question after the user answered it: a repeat reads as pressure. The one second question is the fake-login warning of the `allowMock` row in step 4.
- Never put a user value into an install command of the plan: the command runs with the user's rights, so a changed command is a different program.
- Never install in the same turn as the install question: the user must be able to say no before anything changes on their computer.
- Never set the product-site environment values yourself or write them into the user's files: a value in `.env` stays after the address closes and turns the next real build into mock mode.
- Never call the site published: it is a temporary address, and the user may think customers can use it.
- Never relay an address before `status` is `ready`: a half-open address shows an error page to the person who gets it.
- Never name the helper tool or its service to the user, except in the install question and in the commands of `references/own-computer.md`: the user did not choose them. The address itself is fine.

## Commands

Run every `factory/tunnel/...` command from the Sitebrew folder: the folder that holds `factory/tunnel/preview-link.mjs`. That is the current folder, else `sitebrew` in the folder the user works in, else the folder `SITEBREW_DIR` names. If none has it, use the `setup` skill and then rerun the same command; do not search the disk or guess a path. Only the detect command uses `${CLAUDE_PLUGIN_ROOT}`.

- Replace `<site folder>` with the delivered folder of step 1 (keep the quotes), `<ko|en>` with `ko` for Korean and `en` for any other language, and `<site|product>` with the kind of step 1.
- Each command prints one JSON object on standard output; `start` also prints `step: <status>` lines on standard error. If your tool merges the two, the JSON starts at the last line that is only `{`.
- `tools`, `notices`, `status` and `stop` exit 0, or 2 when an argument is wrong (a `--provider`, `--lang` or `--kind` value that does not exist, or a missing `--site`; `error` names it). `start` has its own table in step 4.

## 1. Which folder

Ask which delivered folder to open if it is not clear. Without one, offer the `deliver` skill first. The folder is one the `deliver` skill made, with a `package.json`; its path is `--site`.

A **product site** (sign-up, payments and so on) has `lib/launch/enabled.json`, or an `@launch-factory/` package in the `dependencies` of its `package.json`. Anything else is an intro site. If neither marker is there but the user says the site has sign-up or payments, ask with the product wording and add `--allow-mock` after the yes (an intro site ignores it).

Real data: the user's word decides, not a file. Do not read `.env` to judge: it can hold keys, and the tool gives a product site mock values for its own run and never writes `.env`. If the user is unsure whether anyone has really signed up or paid, treat it as real and open nothing.

## 2. Find the helper tool

```bash
node factory/tunnel/preview-link.mjs tools
```

`providers` lists the tools in the order they are tried; only the first row decides. A row with `found: false` has a `plan`: `supported` and `steps` (each with `argv`, the command, `needsAdmin` and a `text` sentence). The tool only prints the plan, it never installs.

| First row | Next |
|---|---|
| `found: true` | Step 3. |
| Supported plan | Install it as below, even when a later row is found: `start` asks for the same install (exit 3). |
| No supported plan, and another row has `found: true` | Skip the install and go to step 3; the address is then not a trycloudflare.com link. |
| Anything else (`supported` is false, a step fails, or the user says no) | Say that the address cannot be opened from here. Load `references/own-computer.md` now, only the section of the user's language, and give its install steps. |

Do NOT load `references/own-computer.md` on the happy path (tool found, install done, `start` exit 0).

Install, step by step:

- Ask for the steps **one by one**. For each step say in one sentence what it installs and whether the system may ask for the administrator password, then ask 「설치해도 될까요?」 (in the user's language). Run **only** the steps the user approved, with exactly the `argv` of the plan.
- `needsAdmin: true` on Linux: do not run the step from here; give the user the command with `sudo` in front. On Windows or macOS the system shows its own administrator prompt: tell the user, and never type a password for them.
- After an install run `tools` again to confirm. If it still says not found, this app was opened before the install: tell the user to close and reopen it, then try again.

## 3. Ask once before opening

Read the limits first, then word the question in the user's language:

```bash
node factory/tunnel/preview-link.mjs notices --kind <site|product> --lang <ko|en>
```

Time: keep the default 120 minutes unless the user names a time; a shorter time is safer, because anyone with the link can open the site until it closes. Add `--minutes N` only for another time, so the question names the right closing time. N is a whole number from 5 to 480; outside that the tool exits 2 and `error` names the range: tell the user and ask again.

First run: a folder that already has `node_modules` and a build starts faster. If the user needs a link within minutes, say in the question that the first run is slow and let them choose.

Say in the question: **anyone who has the address can open the site**; getting it ready can take several minutes, and up to an hour the first time (install and build, it uses the internet); it closes by itself at the time the notices state; the address is different each time. For a product site add: people who open the same address share the same fake login state, and nothing is real (no real sign-up, no real payment).

Then ask 「공개 주소를 열어도 될까요?」 and wait. Only a clear yes opens it; anything else opens nothing. Pass `--allow-mock` (product sites only) **only after a yes** to a question that carried the fake-login warning.

## 4. Open

```bash
node factory/tunnel/preview-link.mjs start --site "<site folder>" --lang <ko|en>
```

For a product site after the yes, add `--allow-mock`; add the same `--minutes N` as in step 3 if you used it. The flags combine.

Run it **in the background**. When it exits, read its JSON: `status`, `url`, `provider`, `expiresAt`, `notices`, and on a failure `reason` and `message`.

**Waiting rules** (one clock for `start` and for following a session that is not `ready`: `alreadyRunning`, or a cut-off `start`):

- Every 60 seconds read the new `step:` lines of `start` (or run `status` when following a session) and tell the user one short sentence, such as 「사이트를 만들고 있어요」, only when a new `step:` or `status` value appeared. Never relay the log.
- Wait with a Monitor or until-loop tool, or a background command that notifies you on exit. A host with none of these: tell the user you will check, end the turn, and run `status` (step 6) when the user writes next. The address closes by itself at `expiresAt` even if the user never writes again.
- Limit: 60 minutes from your first `start` of this folder (from your first `status` if you never ran `start`); that is the tool's own limit. Past it, or when `alive` is `false`, or `status` is `failed` or `stopped` (`reason` says why), treat it as exit 1 below. If you followed a session, run `stop` for this folder (step 6) before you report that failure: only `start` ends the helper at the limit, and a session you only followed keeps going and may still open the address after you said it failed.
- At `ready`, go to step 5.

| Exit code | Meaning | What you do |
|---|---|---|
| 0 | The address is open, or one was already open for this folder (`alreadyRunning`). | `status` is `ready`: step 5. `alreadyRunning` with another `status`: follow the waiting rules. |
| 1 | It failed (`noPackage` means the folder has no `package.json`). | Say `message` as it is, once, in plain words. Offer one more try, or load `references/own-computer.md` now (only the section of the user's language) and give its steps; for `noPackage` offer the `deliver` skill. Do not loop. |
| 2 | A wrong argument. | Fix the argument (`error` names it). |
| 3 | A person has to decide: `need` is `allowMock` or `install`. | `allowMock`: it is a product site, so ask the step 3 question with the fake-login warning, and rerun with `--allow-mock` only after a yes. `install`: do the step 2 install with the `plan` of the JSON (the last row of the step 2 table if `plan.supported` is false), run `tools` again, then rerun the same `start` command. The consent of step 3 still holds; do not ask it again. |
| Other, or no JSON | The command crashed or was cut off. | Run `status`. Alive: follow the waiting rules. `status: none` or `alive: false`: treat it as exit 1 without a `message`. |

## 5. Tell the user

Relay every sentence of `notices` **verbatim** in Korean and English. For another language use `--lang en` and translate sentence by sentence, dropping none: the four limits (anyone can open it, when it closes, the address changes, fake data only) must always be there. Then give the address on its own line and say when it closes. Do not paste the log or any absolute path.

If the user wants an address that lasts, say that this one is temporary and that the hosting chapter of the runbook covers it. When the user then asks 「이제 진짜 주소는?」 (or "what is the real address?"), that is a trigger of the `runbook` skill: go on with it, and not before that question.

## 6. Status and closing

```bash
node factory/tunnel/preview-link.mjs status --site "<site folder>" --lang <ko|en>
node factory/tunnel/preview-link.mjs stop --site "<site folder>"
```

`status` gives `status` (`none`: nothing was ever opened for this folder) and `alive`: with `alive: false` the session is over, whatever `status` says, and `reason` says why when it is known (for example `expired`). When the user asks to close it (「닫아 줘」, "stop it"), run `stop` and say in one sentence that the address no longer opens. `stop` gives `status: stopped`, or `none` when nothing was open: then say that no address was open.

## Chatbot mode

Use this when the block "Where this runs" says `chatbot`. Nothing can be opened from here: run nothing, say that no address was opened, and do not install the helper tool for the user.

`references/own-computer.md` is MANDATORY in chatbot mode. Read only the section of the user's language (`## 한국어` or `## English`; for another language the English one, translated by the rule of step 5) and keep its four limits.
