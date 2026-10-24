---
name: deliver
description: Copies the chosen site candidate from a Sitebrew run into the user's own folder, writes a README (Korean then English) with the run commands and the list of things to fix before publishing, and can make an online preview link when a Vercel login or token exists. Safe for folder paths with spaces and Korean characters. Use when the user is happy with a candidate and wants the files. Trigger phrases - "deliver the site", "give me the files", "export the site", "copy it to my folder", "사이트 넘겨줘", "파일로 받고 싶어", "내 폴더에 저장", "미리보기 링크".
---

# Deliver the chosen site

Reply in the user's language. Run from the `sitebrew` folder. The run must have the chosen candidate built to step 06 (the `new` skill, step 5).

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

## 1. Ask for the target folder

- It must **not exist or must be empty**. The tool never overwrites the user's files and refuses a target inside the run folder.
- Spaces and non-ASCII characters are fine (for example `C:\Users\홍 길동\내 사이트`). Keep the quotes around the path.
- Ask one more question before you copy: **「완성 확인을 돌려 볼까요? 몇 분 걸리고 메모리를 많이 써요」** (in the user's language; in Korean use this exact sentence). Run the check **only if the user says yes**. Do not add `--check-loop` for a "no", for silence, or for an unclear answer. The check runs inside the delivery command, so it has to be decided before the copy, not after.

## 2. Copy

```bash
node factory/stamp/deliver.mjs --run out/my-site --pick a --to "<target folder>"
```

The tool prints the target, the number of files copied, the run command, and `공개하기 전에 해결할 것 N건` when blockers exist. It leaves out `node_modules`, `.next`, `.vercel`, `.turbo`, `.env*` and `*.tsbuildinfo`. The README it writes lists the same blockers.

The blockers come from the last quality check (step 07) of that candidate. After a `revise`, step 07 runs again only when the stamp command gets past the legal-review wait; while it still waits there (exit code 3), the list can describe the site before the change. Say this to the user when a revise was applied after the last full run.

Report to the user: the folder, the run command from the output (`cd` into the folder, `npm install`, `npm run dev`; Node 20.9 or newer for the delivered site), and the **blockers in plain words**. In preview mode these always include placeholder images and unverified legal pages. Do not hide them and do not call the site publishable while the list is not empty.

### Notice lines (`안내:`)

The tool may print a line starting with `안내:` after the run command. It means the feature choice was **not applied** and the folder came out the default way for its type. The same sentence is in the README. Relay it in the user's language, in one or two plain sentences (Korean: 해요체), with no part names and no absolute paths:

- No feature record in the run folder: the user has not answered the feature questions for this run. Offer to ask them (the `new` skill, step 4), then deliver again into an empty folder.
- The feature table changed after the choice: the old answers do not fit any more. Ask the feature questions again, write the choice again with `features-write`, and deliver again.
- launch-factory was not found: the choice is on record but cannot be read. Deliver again with `--lf <launch-factory folder>`; the same flag goes to `intake.mjs features` and `features-write`.
- Product name or share-preview language not set everywhere: tell the user to open the folder and check the name and language.

A notice is **not a failure** and the copy is done. Do not call the site a product site while one of the first three is shown.

### Features not applied to an intro site

For an intro site (not a product site) the README can list a chosen feature with the line 「…는 소개형 사이트에 넣을 곳이 없어서 넣지 않았어요」 or 「…는 이 시안에 문의 폼이나 신청 블록이 없어서 넣지 않았어요」. The tool does not print these lines; read them from the README. Relay each one in the user's language, in one plain sentence (Korean: 해요체), with the feature's result word from the README and no part names:

- "No place in an intro site": this feature only works in a product site. Offer to ask the feature questions again if the user wants a product site.
- "No contact form or sign-up block": the inquiry feature needs a design with a form. Offer another candidate that has one, or a `revise` that adds a contact section, then deliver again into an empty folder.

These lines are **not a failure**. Do not say the feature was added.

### Completion check (only after a yes)

```bash
node factory/stamp/deliver.mjs --run out/my-site --pick a --to "<target folder>" --check-loop
```

- After the copy, the tool installs and builds inside the target folder and runs the chosen features once, from start to end: a product site goes through its sign-up and checkout loop in a real browser, an intro site with an inquiry form sends one test inquiry. It takes a few minutes, uses a lot of memory, **downloads packages from the internet** (`npm install` in the target folder) and leaves `node_modules`, `.next` and `.tmp/smoke` there; the README says so, and the user can delete them before sharing the folder.
- It prints one line, `완성 확인: ok`, `완성 확인: skipped — <reason>` or `완성 확인: failed — <reason>`. The README gets the same result.
- Tell the user the result in the user's language, in plain words and one or two sentences (Korean: 해요체). Do not paste the tool line or the build log, and do not show absolute paths from it.
  - `ok`: "완성 확인을 돌려 봤고 통과했어요. 고른 기능이 처음부터 끝까지 이어져요."
  - `skipped`: say that it did not run and why (not enough free memory: free 3 GB or more and run it again; no Chrome or Edge on this computer; the browser test tool is not installed, so give the one `npm install` command from the reason and do not run it for the user; the folder has no `package.json`, so check that it is the delivered folder; the feature record could not be read, so ask the feature questions again; no feature to check). A skip is **not** a failure and **not** a pass. Do not call the site "checked".
  - `failed`: say that it got stuck and give the cause in plain words. The copy is still done. The tool exits with code 1. Offer to look into the cause, and do not retry in a loop.
- Memory is checked once at the start: below 3 GB free the tool skips instead of waiting. If free memory drops below 3 GB during the run, the product check can wait up to about 30 minutes for memory and then fail. Tell the user to close other heavy programs before a yes.

## 3. Online preview link (optional)

```bash
node factory/stamp/deliver.mjs --run out/my-site --pick a --to "<target folder>" --deploy-preview
```

- Only a **preview** deployment is ever made. A production deployment is refused before anything runs.
- It needs a Vercel login on this computer. Without one, the tool prints `미리보기 배포 건너뜀` and still finishes the copy. That is not a failure.
- Never ask for a key or a token in the chat. How to get an account and a real address is the hosting chapter of the runbook (last step below), not part of this step.
- If the deployment fails, the copy is still done. The tool exits with code 1 and prints the reason with the token masked. Report that line.

## Product sites (sign-up, payments and so on)

Whether a site is a product site follows the feature choice in `features.json` of the run folder (the `new` skill, step 4), not the site type alone. A product site comes out of the copy with its back end already wired by the tool. There is **no separate step** to attach it, and you do not start a back end for the user here.

What the user does next, in plain words (Korean: 해요체):

1. Open the folder, run `npm install`, then `npm run dev`. The README in the folder shows the exact commands. Node 20.9 or newer.
2. Read the README. It lists what the user has to prepare before the chosen features work for real (accounts and keys, named in plain words).

Never ask for a key or an account in the chat. Keep every provider and part name out of what you say: use only the result words of the README ("회원가입·로그인", "결제").

## Chatbot mode

Use this when the block "Where this runs" says `chatbot`. Copying the site is a command on the user's computer, so run nothing and never say a folder was written.

1. Ask for the target folder (it must not exist or be empty; spaces and Korean characters are fine) and whether to run the completion check first (the same yes/no question as above).
2. Give the command for the user to paste inside the `sitebrew` folder, with their folder in quotes: `node factory/stamp/deliver.mjs --run out/my-site --pick a --to "<target folder>"` (`--check-loop` only after a yes).
3. Say what they should see: a new folder with the site and a `README.md` (Korean, then English) that lists the run commands and the things to fix before publishing. Ask them to paste the printed blockers so you can put them into plain words.
4. An online preview link needs the `preview` skill and a command tool. Say so and offer the steps for the user's own computer.

## Last step: the door to the runbook

When the files are delivered and you have reported the result, do this last. Nothing about keys, accounts or the runbook comes before it.

1. Read the state first:

```bash
node factory/runbook/runbook.mjs gate --run out/my-site --site "<target folder>"
```

The JSON is `{"door": "ask" | "skip" | "use"}`.

2. Only when the door is `ask`, ask **once**: 「이 사이트를 실제로 쓰실 건가요?」 (in the user's language; in Korean use this exact sentence). Record the answer with `gate --answer yes`, `gate --answer no` or `gate --answer unsure`. 「잘 모르겠어요」 and 「아직요」 count as no (`unsure`).
3. A yes: continue with the `runbook` skill. A no: say 「나중에 ‘런북’이라고 말하면 보여 드려요」 in one line and stop. When the door is `skip` or `use`, do not ask; `use` means the runbook skill can go on if the user wants it.

If you have no tool that runs commands (a chat window), ask the question once in the conversation and, on a yes, go on with the `runbook` skill in chatbot mode.
