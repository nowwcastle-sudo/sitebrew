---
name: preview
description: Opens a delivered Sitebrew site folder on a temporary public address (a trycloudflare.com link) so the user can show it to someone, with no account, no key and no cost. Asks once before anything is opened, installs the one helper tool only after a yes, builds the site in production mode, gives the address together with the limits (anyone can open it, it closes by itself, the address changes next time, fake data only), and closes it on request. Without a command-running tool it gives the steps for the user's own computer instead. Use after deliver, when the user wants a link to show the site online for a while; this is not hosting. Trigger phrases - "temporary public address", "open my site on the internet for a while", "let someone see my site", "close the public address", "임시 공개 주소", "남한테 보여줄 주소 만들어 줘", "인터넷에 잠깐 열어 줘", "공개 주소 닫아 줘".
---

# Temporary public address for a delivered site

Reply in the user's language. In Korean use 해요체. Run from the `sitebrew` folder. The site is a folder the `deliver` skill made: it has a `package.json`.

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

This opens the site on a link like `https://….trycloudflare.com` from the user's own computer. It is temporary and open to anyone who has the link. It is **not hosting**.

## 0. Decide the environment first

The block "Where this runs" above decides it. If you have **no tool that runs commands on the user's computer** (a chat window without a terminal; mode `chatbot`), this is chatbot mode. Do not pretend to run anything. Give the steps of `references/own-computer.md` in the user's language, say that nothing was opened, and stop. In every other case continue with step 1.

## 1. Which folder

Ask which delivered folder to open if it is not clear. Without one, offer the `deliver` skill first. Use the folder's path as `--site` and keep the quotes (spaces and Korean characters are fine).

A folder is a **product site** (sign-up, payments and so on) when it has `lib/launch/enabled.json`, or an `@launch-factory/` package in its `package.json`. Anything else is an intro site.

## 2. Find the helper tool

```bash
node factory/tunnel/preview-link.mjs tools
```

The JSON says whether the helper tool is on this computer. If not, it holds an install plan: `steps` (each with its command, whether it needs administrator rights, and a sentence) and `supported`. The tool only prints the plan, it never installs.

- Ask for the steps **one by one**. For each step say in one sentence what it installs and whether Windows or the system may ask for the administrator password, then ask 「설치해도 될까요?」 (in the user's language). Run **only** the steps the user approved, with exactly the command of the plan. Never put a user value into it.
- After an install run `tools` again to confirm. A terminal opened before the install may not see the new program: tell the user to close and reopen Claude Code, then try again.
- When `supported` is false, a step fails, or the user says no: say that the address cannot be opened from here and give the install steps of `references/own-computer.md`. Never install in the same turn as the question.

## 3. Ask once before opening

Opening a public address puts the site outside. Ask **once**, in the user's language, and wait for the answer. To word it, read the limits first:

```bash
node factory/tunnel/preview-link.mjs notices --kind <site|product> --lang <ko|en>
```

Say in the question: **anyone who has the address can open the site**; getting it ready can take several minutes (install and build, it uses the internet); it closes by itself after the time the notices state; the address is different each time. For a product site add: people who open the same address share the same fake login state, and nothing is real (no real sign-up, no real payment).

Then ask 「공개 주소를 열어도 될까요?」. Only a clear yes opens it. No, silence or an unclear answer means: open nothing. Do not ask the same question again later; do not turn a no into a yes.

Pass `--allow-mock` (product sites only) **only after a yes** to a question that carried the fake-login warning.

## 4. Open

```bash
node factory/tunnel/preview-link.mjs start --site "<site folder>" --lang <ko|en>
```

For a product site after the yes, add `--allow-mock` to the same command. Add `--minutes N` (5 to 480) only when the user asked for another time; the default is 120.

Run it **in the background**. It waits until the address is ready or the attempt failed, and it writes one progress line per stage to the error output. Relay each new stage to the user in one short sentence (for example 「사이트를 만들고 있어요」), not the log. It can take up to an hour the first time. When the background command exits, read its JSON: `status`, `url`, `provider`, `expiresAt`, `notices`, and on a failure `reason` and `message`.

| Exit code | Meaning | What you do |
|---|---|---|
| 0 | The address is open (or one was already open for this folder: `alreadyRunning`). | Step 5. |
| 1 | It failed. | Say `message` as it is, once, in plain words. Offer one more try or the steps of `references/own-computer.md`. Do not loop. |
| 2 | A wrong argument or folder. | Fix the argument; check the folder has a `package.json`. |
| 3 | A person has to decide: `need` is `allowMock` or `install`. | `allowMock`: it is a product site, so ask the step 3 question with the fake-login warning, and rerun with `--allow-mock` only after a yes. `install`: go back to step 2 with the `plan`. |

## 5. Tell the user

Relay every sentence of `notices` **verbatim**, in the user's language. If the user's language is neither Korean nor English, use `--lang en` and translate sentence by sentence without dropping one: the four limits (anyone can open it, when it closes, the address changes, fake data only) must always be there. Then give the address on its own line and say when it closes.

Do not name the helper tool or the service behind it. The `trycloudflare.com` address itself is fine. Do not paste the log or any absolute path.

If the user wants an address that lasts, say that this one is temporary and that the hosting chapter of the runbook covers it. When the user then asks 「이제 진짜 주소는?」 (or "what is the real address?"), that is a trigger of the `runbook` skill: go on with it. Do not start the runbook yourself without that question.

## 6. Status and closing

```bash
node factory/tunnel/preview-link.mjs status --site "<site folder>"
node factory/tunnel/preview-link.mjs stop --site "<site folder>"
```

`status` tells whether the session is still alive. When the user asks to close it (「닫아 줘」, "stop it"), run `stop` and say in one sentence that the address no longer opens. It also closes when the computer is turned off or the time is over.

## Rules

- Never ask for a key, a token, a password or an account: none is needed. Do not print environment values.
- Do not open anything without the yes of step 3. Do not set the product-site environment values yourself or write them into the user's files: the tool gives them to the running site only.
- Do not install anything the user did not approve one by one.
- This is never a production deployment. Do not call the site published.

## Chatbot mode

Use this when the block "Where this runs" says `chatbot`. Nothing can be opened from here: run nothing, say that no address was opened, and give the steps of `references/own-computer.md` in the user's language (step 0 above). Do not install the helper tool for the user; the guide shows the user how.
