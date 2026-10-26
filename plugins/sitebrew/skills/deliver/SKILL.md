---
name: deliver
description: Copies the chosen, built candidate of a Sitebrew run into the user's own folder with a README (Korean, then English); optionally runs a completion check or makes a Vercel preview link. Use when the user is happy with a Sitebrew candidate and wants the files. Not for a temporary public link (`preview`) or design changes (`revise`). Trigger phrases - "deliver the site", "export the site", "give me the files", "copy it to my folder", "사이트 넘겨줘", "파일로 받고 싶어", "내 폴더에 저장", "Vercel 미리보기 링크"
---

# Deliver the chosen site

Run every `factory/...` command from the `sitebrew` folder: the Sitebrew repository root, which holds `factory/stamp/stamp.mjs`. It is `sitebrew` in the folder the user works in, or the folder named by `SITEBREW_DIR`. If `factory/stamp/deliver.mjs` is missing there, the kit is not installed: use the `setup` skill. A command written with `${CLAUDE_PLUGIN_ROOT}` is run from the plugin folder instead.

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

- Paste tool lines, README internal lines, build logs or absolute paths: they hold the user's folder names and internal English lines. Relay results in plain words (Korean: 해요체), one or two sentences, naming the target folder by its last part only. The one exception is the `실행:` command of step 3, which the user types: give it as printed.
- Name a provider or a part of the kit to the user: use only the result words of the README (「회원가입·로그인」, 「결제」).
- Call a `안내:` notice, a skipped preview or a "not placed" feature line a failure: the tool exits with code 0 and the copy is done. Only a `도구 실패:` line is a failure.
- Call the site publishable or "checked" while blockers, a `안내:` notice or a skipped or failed check stand: placeholder images and unverified legal pages become the user's risk once published, and the feature loop did not run through.
- Retry a failed or skipped completion check on your own: the cause (memory, missing browser, build error) is the same on the next run. A new delivery into a new empty folder, after the user fixed the cause and said yes again, is not a retry.
- Say a feature was added when the README lists it as not placed: it misstates the delivered site.
- Run an `npm install` yourself to clear a skipped check: it installs on the user's computer without their yes.
- Ask for a key, a token or an account login in the chat: the chat history is stored. The tool reads the Vercel token from the user's own environment.
- Run a production deployment: only previews are made, and the tool refuses a production deployment before it copies anything.
- Empty, delete or reuse the user's target folder yourself: it may hold their files, and a filled folder refuses a second delivery.

## Judgment calls

- Weigh the cost before you ask: minutes, memory, downloads. If the user says the PC is slow, busy or low on memory, say that first and let them decide.
- A Vercel preview link needs a Vercel account and token. To "show it to someone for a while", copy without `--deploy-preview` and offer the `preview` skill afterwards.
- Blockers that are only placeholder images and unverified legal pages are normal in preview mode: report them in one sentence; do not offer to fix them now.
- A filled folder refuses a second delivery: read a hand-typed target path back once first.

## 1. Decide everything before the copy

The copy, the completion check and the preview link go into one command, so collect the answers first, then run once. Silence, 「아직요」 and 「잘 모르겠어요」 count as no.

- **Run folder and letter.** List the built candidates from inside the `sitebrew` folder (the same line works in bash and PowerShell; the kit already needs Node 24.13 or newer):

  ```bash
  node -e "for (const f of require('node:fs').globSync('out/*/?/06-pages.json')) console.log(f)"
  ```

  A line `out/<name>/<letter>/06-pages.json` gives `<run folder>` = `out/<name>` and a built `<letter>` (Windows prints backslashes, `out\<name>\<letter>\06-pages.json`; the parts are the same). One run: use it. Several runs: ask the user once which site. None: the site is not built, so use the `new` skill, section 5. Several letters: use the one the user picked there; ask if you do not know it.
- **Product site?** Yes when the user chose sign-up, login or payment in the feature questions (`features.json` in the run folder; the `new` skill, section 2 item 4). The tool wires its back end during the copy: there is **no separate step** to attach it, and you start no back end. It decides the preview question and the kind of completion check below.
- **Target folder.** It must not exist or must be empty. The tool never overwrites the user's files and refuses a target inside the run folder. Spaces and non-ASCII characters are fine (for example `C:\Users\홍 길동\내 사이트`) inside the quotes.
- **Completion check.** Ask only where it can run: a product site (real-browser sign-up and checkout loop) or an intro site where the user chose the inquiry feature (one test inquiry). For any other site, or with no feature record, the tool only prints `skipped`: do not ask, treat it as no. Where it can run, ask: **「완성 확인을 돌려 볼까요? 몇 분 걸리고 메모리를 많이 써요」** (in the user's language; in Korean use this exact sentence). Run the check **only if the user says yes**. Do not add `--check-loop` for a "no", for silence, or for an unclear answer: the check runs inside the delivery command, so it is decided before the copy. After a yes the tool installs and builds in the target folder and runs the chosen features once from start to end: a few minutes, a lot of memory, **downloads packages from the internet** (`npm install`), and `node_modules`, `.next` and `.tmp/smoke` stay there (the user can delete them before sharing). Below 3 GB free memory at the start the tool skips instead of waiting. If free memory drops below 3 GB during the run, the product check can wait up to about 30 minutes and then fail: ask the user to close heavy programs before a yes.
- **Online preview link.** Ask only for a site that is not a product site: the tool never deploys a product folder (only the original site would be deployed, and it differs from the finished product). It needs the Vercel access token that the `doctor` skill lists, saved as a user environment variable on this computer; a `vercel login` alone is not enough. A real address with a domain is the hosting chapter of the runbook (last step), not this flag.

## 2. Copy

Pick the table row for the two yes/no answers, replace the three `<...>` values and run that one command once. The flags combine. Add `--lf <launch-factory folder>` only when `references/notices.md` says so; no other flag is needed. A product site uses a row with preview `no`.

| Completion check | Online preview | Command |
| --- | --- | --- |
| no | no | `node factory/stamp/deliver.mjs --run <run folder> --pick <letter> --to "<target folder>"` |
| yes | no | `node factory/stamp/deliver.mjs --run <run folder> --pick <letter> --to "<target folder>" --check-loop` |
| no | yes | `node factory/stamp/deliver.mjs --run <run folder> --pick <letter> --to "<target folder>" --deploy-preview` |
| yes | yes | `node factory/stamp/deliver.mjs --run <run folder> --pick <letter> --to "<target folder>" --check-loop --deploy-preview` |

The tool prints `전달 끝:` (target and number of files), the run command and, when blockers exist, `공개하기 전에 해결할 것 N건`. For an intro or default site the copy leaves out `node_modules`, `.next`, `.next-export`, `.vercel`, `.turbo`, `.env*` and `*.tsbuildinfo` of the original.

Exit codes:

- `0`: the copy is done. Step 3 may still report a notice or a skip.
- `1` with a `도구 실패: …` line and no `전달 끝:` line: the delivery did not finish. By the line:
  - `사이트(06-pages)가 없다`: nothing was copied; the site is not built. Finish it with the `new` skill, section 5, then run once more.
  - `원본 사이트 폴더 안`: nothing was copied; the target is inside the run folder. Ask for a folder outside `out/`, then run once more.
  - `비어 있지 않다` or `폴더가 아니라 파일이다`: nothing was copied; ask for a NEW empty folder, then run once more.
  - Other text: the tool can fail after it has begun writing, so the target folder may be partly filled, and a filled folder refuses the next delivery. Report the cause in plain words and say the folder may be partly filled. The user chooses: a NEW empty folder, or emptying this one themselves. Do not empty or delete it yourself. Then run once more.
- `1` with `전달 끝:` before the `도구 실패: …` line: the copy is done; the completion check or the preview deployment failed (the line names which). See step 3.
- `2`: argument error (a missing value, an unknown flag, a `--pick` other than `a`, `b`, `c`); nothing was copied. Correct the command.
- Any other code, or no output: report the last output lines; run nothing again.

## 3. Report

Tell the user in plain words:

- The target folder, the run command exactly as the `실행:` line prints it (`cd` into the folder, `npm install`, `npm run dev`; Node 20.9 or newer for the delivered site) and the **blockers**. In preview mode they always include placeholder images and unverified legal pages: do not hide them. The README also lists what to prepare before sign-up and payment work; relay only its result words (회원가입·로그인, 결제).
- If you applied a `revise` in this conversation after the last full stamp run, add that the blocker list may describe the site before the change: step 07 runs again only after the stamp command gets past the legal-review wait (exit code 3).
- The completion check, when it was asked: the tool prints `완성 확인: ok`, `완성 확인: skipped — <reason>` or `완성 확인: failed — <reason>`, and the README gets the same result.
  - `ok`: "완성 확인을 돌려 봤고 통과했어요. 고른 기능이 처음부터 끝까지 이어져요."
  - `failed`: say that it got stuck, give the cause in plain words and offer to look into it.
  - `skipped`: say that it did not run and why. A skip is **not** a failure and **not** a pass.

    | Reason in the line | Say | Agent action |
    | --- | --- | --- |
    | not enough free memory | free memory was under 3 GB | if wanted, the user closes heavy programs and you deliver again into a new empty folder with `--check-loop` after a new yes (this folder cannot re-run it) |
    | no Chrome or Edge | this computer has no Chrome or Edge | none; a later check needs a new delivery after a new yes |
    | the browser test tool is not installed (still missing after the tool's own `npm install`) | a test tool is missing although the tool installed the packages | none to run; the user checks that `package.json` lists `@playwright/test` in `devDependencies`; do not run an install for them |
    | the email that receives inquiries is not confirmed yet (preview state) | the inquiry check did not run, because the receiving email is not filled in yet; this is the normal preview state | the user fills the email in `content/site.json` (a new delivery copies the one in `<run folder>/<letter>/site/content/site.json`); a later check needs a new delivery after a new yes |
    | no `package.json` in the folder | the check did not run, because that folder is not the delivered site | none; the user checks that this is the delivered folder |
    | feature record or `launch-factory` not found or unreadable, feature table changed | the feature choice cannot be read | a `안내:` line is also printed: the MANDATORY line below |
    | no feature to check, or no steps in the full-loop test for the chosen features | nothing to check on this site | none |
- The preview, when it was asked: `미리보기: <url>` is the link to give. `미리보기 배포 건너뜀` means no deployment: say that the token is missing or the site is a product site, and that the copy is done. A failed deployment is exit code 1 after `전달 끝:`: report its line (the token is masked).

**MANDATORY:** read `references/notices.md` and relay as it says when the output has a line starting `안내:` or `제품 이름·언어를 못 바꾼 자리`, or when the README in the target folder has the text `넣지 않았어요` (search it once). **Do NOT** read it when none of these is there.

## Last step: the door to the runbook

When the files are delivered and you have reported the result, do this last. Nothing about keys, accounts or the runbook comes before it.

1. Read the state first:

```bash
node factory/runbook/runbook.mjs gate --run <run folder> --site "<target folder>"
```

The JSON is `{"door": "ask" | "skip" | "use"}`. If the command exits non-zero or prints no JSON, skip the question, say nothing about it and finish.

2. Only when the door is `ask`, ask **once**: 「이 사이트를 실제로 쓰실 건가요?」 (in the user's language; in Korean use this exact sentence). Record the answer by running the command of item 1 again with `--answer yes`, `--answer no` or `--answer unsure` added. 「잘 모르겠어요」 and 「아직요」 count as no (`unsure`).
3. A yes: continue with the `runbook` skill. Item 2 stored the yes in the run folder, so the `runbook` skill reads the door as `use` and does not ask again. If the output of item 2 has `"saved": false`, nothing could be stored: tell the `runbook` skill that the user said yes (it then adds `--answer yes` to its commands) and do not ask again. A no: say 「나중에 ‘런북’이라고 말하면 보여 드려요」 in one line and stop. When the door is `skip` or `use`, do not ask; `use` means the runbook skill can go on if the user wants it.

If you have no tool that runs commands (a chat window), ask the question once in the conversation and, on a yes, go on with the `runbook` skill in chatbot mode.

## Chatbot mode

Use this when the block "Where this runs" says `chatbot`. Copying the site is a command on the user's computer, so run nothing and never say a folder was written.

1. Ask the step 1 questions: the target folder, the completion check (yes/no; only where step 1 allows it) and the online preview link (yes/no; not for a product site).
2. Give one command for the user to paste inside the `sitebrew` folder: the row of the step 2 table for their two answers, with their folder in quotes. The row with no flags is `node factory/stamp/deliver.mjs --run out/my-site --pick a --to "<target folder>"` (replace `out/my-site` and `a` with the real run folder and letter; ask the user if you do not know them).
3. Say what they should see: a new folder with the site and a `README.md` that lists the run commands and the things to fix before publishing. Ask them to paste the printed blockers so you can put them into plain words. If they paste a `안내:` or `제품 이름·언어를 못 바꾼 자리` line, or the README text `넣지 않았어요`, read `references/notices.md`.
4. An online preview link (`--deploy-preview`) needs the Vercel access token of step 1 on the user's own computer and is skipped for a product site. It cannot be added after the copy, because the target folder must be empty for a second run: put it into the step-2 command. This is not the `preview` skill: that one opens a temporary public address from the delivered folder and needs no account, so offer it only when the user asks to show the site to someone for a while.
