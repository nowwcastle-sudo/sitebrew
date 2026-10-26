---
name: runbook
description: Guides a Sitebrew site that the `deliver` skill already delivered into real use - the outside services to sign up for, their order, what stops if one is skipped, and cheaper alternatives. Use when the user decides to run the delivered site or asks for the runbook; the Korean words 도메인, 호스팅, 결제 and API 키 count only when they are about such a delivered site. Not while a site is made or changed (new, revise), not for general hosting questions. Trigger phrases - "runbook", "what do I need to run this site", "cheaper alternative", "런북", "운영 안내", "실제로 쓰려면 뭐가 필요해요", "더 싼 대안", "무료로 되는 건 없어요", "이제 진짜 주소는".
---

# Runbook: what to do to run the site for real

Use this only after delivery and the user's yes (step 1). Not while `new` or `revise` runs. Write Korean in 해요체.

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

Every command below is `node factory/runbook/runbook.mjs <command> ...`. Fill in these values before the first command:

- **sitebrew folder** (run the command there): the current folder if it holds `factory/runbook/runbook.mjs`, else `sitebrew` in the folder the user works in, else the folder `SITEBREW_DIR` names, else use the `setup` skill. If `detect` said `agent` but the file is missing, this is the wrong folder, not chatbot mode.
- **Always pass `--run "<run folder>" --site "<site folder>"`.** Run folder: the `out/<name>` folder of the build (the door is kept there). Site folder: the target folder the `deliver` skill wrote. Use the folders `deliver` reported; else list `out/` in the sitebrew folder and ask which run, and ask for the site folder (once each, never guess).
- Add `--lf <launch-factory folder>` only when the tool cannot find launch-factory, and `--lang ko|en` only for the other language (default: the site's).

The tool prints one JSON document on standard output and its messages on standard error. This agent path never reads `references/`; those files are for Chatbot mode only.

Route: 1 door (always first), 2 overview, 3 level (once), 4 expert or 5 beginner, 6 alternatives (any time), 7 resume (only when the user calls the runbook). Every step ends in a defined next action; the Never list is in Rules at the end.

| Exit code | Meaning | What you do |
|---|---|---|
| 0 | Done (`check`: no problems). | Go on. |
| 1, `check` only, standard error empty | The JSON has `problems`: the draft broke a rule. | Fix every problem in the draft (`text` says what) and run `check` again, **at most 2 times** (two fixes, so at most three runs). If a problem remains after the second fix, show the chapter and say in plain words what is still wrong. |
| 1 in any other case, or a code not listed here | Tool failure: `도구 실패:` on standard error (launch-factory not found, or its data does not match this web-factory), or the script did not run (a Node error). | Say the cause in one or two plain sentences with the next action in the message (for example pass `--lf`). Keep the chapters that still work. |
| 2 | A wrong argument; standard error names the allowed values or chapters. | Fix the argument and run again. |
| 3 | `ask`: the tool does not know which features the site has. | Ask the feature questions of `ask.questions` (step 2). |
| 4 | The `--out` file already exists. | Say so and ask for another new file name (step 4). |
| 5 | The door is not `use` (the JSON `door` says `ask` or `skip`). | Run `gate` without `--answer` (step 1) and do what its row says; on `skip`, stop. |

## 1. The door (always first)

The door is the user's yes to the runbook. The yes only opens the guidance (it signs up and pays for nothing). Ask it **once**:

- If the user asked for the runbook in their own words ("runbook", 「런북」, 「이제 진짜 주소는?」, 「실제로 쓰려면 뭐가 필요해요」), that is a yes. Ask nothing more and record it:

```bash
node factory/runbook/runbook.mjs gate --answer yes --run "<run folder>" --site "<site folder>"
```

- Otherwise read the state first:

```bash
node factory/runbook/runbook.mjs gate --run "<run folder>" --site "<site folder>"
```

The JSON is `{"door": "ask" | "skip" | "use"}`.

| door | What you do |
|---|---|
| `use` | The user said yes before. Do not ask again. Go to step 2. |
| `skip` | The user said no or not yet. Say one line, 「나중에 ‘런북’이라고 말하면 보여 드려요」 (in the user's language), and **stop**: no chapter, no key, no account. Only a runbook request that the user starts later reopens it (step 7). |
| `ask` | Ask once: 「이 사이트를 실제로 쓰실 건가요?」 (in the user's language; in Korean use this exact sentence). Record the reply with `gate --answer yes`, `gate --answer no` or `gate --answer unsure`: a clear yes is `yes`, a clear no is `no`, and anything else (「잘 모르겠어요」, 「아직요」, a question back, a new topic) is `unsure` and you do not ask again. The tool stores `no` and `unsure` alike, as `skip`. A yes goes to step 2; anything else: say the same one line and stop. |

If `gate --answer` prints `"saved": false`, nothing can be stored for this folder (an old site folder without a `.sitebrew` record), so the answer lives only in this conversation. After a `yes`, add `--answer yes` to every command that follows: the commands of the next steps accept `--answer` **only** in this case (elsewhere they exit 2: use `gate --answer`), and the only value you pass is `yes`. After a `no` or `unsure`, stop as in the `skip` row and pass no `--answer`; a later runbook request starts this step again.

## 2. The overview

```bash
node factory/runbook/runbook.mjs open --run "<run folder>" --site "<site folder>"
```

You use `text` (the overview, already in the right language), `plan.chapters` (the order to do them), `plan.missing`, `plan.stale`, `level` and `progress` (chapter id to `doing`, `done` or `skipped`). Show `text` as it is. A chapter in `plan.missing` is shown as 「아직 준비되지 않았어요」; do not hide it and do not write it yourself. Old chapters are marked in `text`; say that the screens may have changed.

**Exit code 3** means the tool has no record of the features this site has, and it does not guess. `ask.questions` lists the questions (`id`, `ko`, `en`). Ask each one once in the user's language as a yes or no question (「잘 모르겠어요」 is a no). Then run the command again with the ids of the yes answers, comma separated; for no yes at all pass an empty value:

```bash
node factory/runbook/runbook.mjs open --features <id>,<id> --run "<run folder>" --site "<site folder>"
```

This records the answer; it does not open the door. Say the result in the words of the question, not the ids.

If `level` is set, go by it (`expert`: step 4, `beginner`: step 5). If not, go to step 3.

## 3. The level

Ask once, unless the user already said it: 「초보자용(처음부터 하나씩 풀어서 알려 드려요)과 전문가용(핵심만 한꺼번에 보여 드려요) 중 어느 쪽이 좋아요?」. If the reply names neither, do not ask again: record `beginner`, the safe default. Record it:

```bash
node factory/runbook/runbook.mjs mark --level beginner --run "<run folder>" --site "<site folder>"
```

Use `--level expert` for the expert level. The user can change the level at any time; the chapters already done stay done. Then `expert` goes to step 4 and `beginner` to step 5.

## 4. Expert level

```bash
node factory/runbook/runbook.mjs chapter all --level expert --run "<run folder>" --site "<site folder>"
```

Show `text`: every chapter in short form. Then ask 「파일로 저장할까요?」. On a no, save nothing. Only after a yes, run the same command with a new file:

```bash
node factory/runbook/runbook.mjs chapter all --level expert --out "<new file path>" --run "<run folder>" --site "<site folder>"
```

Use a new full path inside the site folder, for example `"<site folder>/RUNBOOK.md"` (a bare name is saved in the sitebrew folder). On exit code 4 say that the file exists and ask for another name. On exit code 0 the JSON has `file`: tell the user where it is. One chapter alone: `chapter <gid> --level expert`.

The expert text records no progress. For each chapter the user reports as finished, skipped or stuck, run `mark <gid> done`, `mark <gid> skipped` or `mark <gid> doing` (the ids are `plan.chapters`) and answer as in step 5, point 5; with no marks, step 7 finds none done.

## 5. Beginner level, one chapter at a time

Go through `plan.chapters` of step 2 in that order. Skip a chapter whose `progress` is `done` or `skipped` (the user chose); take up a `doing` chapter first. For each chapter:

1. Get the material:

```bash
node factory/runbook/runbook.mjs chapter <gid> --level beginner --run "<run folder>" --site "<site folder>"
```

You use `brief.rubric`, `brief.helpLine` and `brief.chapter` (`title`, `service`, `home`, `labels`, `ifSkipped`, `mustName`, `body`, `stale`, `staleLine`, `check.closing`).

2. Write the chapter for a person who knows nothing about this. First ask: what will the user see first on that screen; what is the one thing that breaks if they skip it (`ifSkipped`); which fact here could be stale (`stale`). Then keep these rules, most important first:
   - Use only facts of `body`, the card values and the general words. An invented number, button or step sends the user to a screen that does not exist.
   - The only address you may write is `home`, without a path (no `home`: write none). Any other address is unchecked.
   - Say every name of `mustName`, as a name only; the service, its cost kind and whether it is required or optional (the `labels`); and what stops if the user skips it (`ifSkipped`).
   - Put `helpLine` in once, and `staleLine` if `stale` is true, letter for letter: they carry the checked date and the help route.
   - Follow `brief.rubric`, also for the step shape. End by asking `check.closing`.
   - If the user already owns a domain, keep the domain chapter (a domain is always needed): say which steps buy a domain (not needed) and which connect it (needed). Moving a domain from another seller is not checked in the data: say so.
3. **Check it.** Write the draft as a new UTF-8 file in the system temp folder, not the user's folder (for example `runbook-<gid>.md`). Then run:

```bash
node factory/runbook/runbook.mjs check <gid> --file "<draft file>" --run "<run folder>" --site "<site folder>"
```

Exit code 0 is a pass; exit code 1 is the fix loop of the exit-code table. Delete the draft file when you are done.
4. Show the chapter. It ends with the closing question 「다 했어요 / 막혔어요」.
5. Act on the reply, with the status from the table:

```bash
node factory/runbook/runbook.mjs mark <gid> <status> --run "<run folder>" --site "<site folder>"
```

| Reply | Command | What to say |
|---|---|---|
| 「다 했어요」 | `mark <gid> done` | Go to the next chapter. |
| 「막혔어요」 | None yet: the list below says when to mark `doing`. | Follow the list below, in its order. |
| 「건너뛸게요」 | `mark <gid> skipped` | Say again what stops (`ifSkipped`) and name the later chapters it stops: a later chapter can depend on an earlier one. Suggest a skip yourself only for a chapter whose `need` label says optional. |

Any other reply (a question, an unclear answer): answer from the chapter, ask the closing question again and mark nothing.

For 「막혔어요」, in this order:

1. Run `open` (step 2) and read `progress.<gid>`: a `doing` there is the durable record of an earlier stuck. If `mark` printed `"saved": false`, the tool keeps nothing: count from this conversation.
2. Run `mark <gid> doing`.
3. If it was already `doing`, show the expert text of the chapter (`chapter <gid> --level expert`) and tell the user to ask the support of that service. Otherwise ask what the user sees on the screen now and answer only from the chapter; for a fact it lacks, say it was not checked here and send the user to the help or support page of that service.

## 6. Alternatives (at any time, from any chapter)

When the user asks for something free, cheaper or better than the service in a chapter:

```bash
node factory/runbook/runbook.mjs alternatives <gid> --run "<run folder>" --site "<site folder>"
```

If you cannot tell what matters to the user, ask **one** question: 「가격, 쉬운 정도, 한국 지원 중 어느 쪽이 중요해요?」. Then narrow with `--want`: price is `cheaper` (`free` when the user asks for free), ease is `better`, support for Korea is `ko`. When nothing carries that tag, run it again without `--want` and say that none was marked that way.

The JSON has `current` and `options` (you say `switch`, `switchCost`, `note` and `checked`), or `{"none": true}` when the role has no table.

- Every answer states **whether this site supports it and what switching costs** (`switchCost`), plus `note` and the date `checked`. Say cost as a kind. For an amount, follow the amount rule in Rules.
- `switch` is `on`: say 「이미 켜져 있어요」. `reselect`: say 「기능을 다시 고르고 사이트를 다시 받으면 돼요」. `code` or `no`: **state the fact and the cost, and keep the runbook as it is**; the site would need new code or cannot use it.
- Several options carry the wanted tag: order them by `switch`: `on`, `reselect`, then `code` or `no`. A `free` option that needs `code` is not a cheap switch: say both. Within one `switch` value show all, with `switchCost` and `checked`; do not rank by price.
- `none`: say 「이 표 밖의 답이에요」, say that it was not checked here, and do not invent a service.

## 7. Resume

Only when the user calls the runbook first (for example 「런북」, 「어디까지 했죠?」). That call is the yes of step 1: record it with the first command of step 1, then run `open` (step 2). If `level` is unset, nothing was started: go to step 3. Otherwise say, in the user's language: 「지난번에 초보자용으로 N장까지 했어요. 이어서 할까요?」 with N the number of chapters marked `done` in `progress` (say 전문가용 instead of 초보자용 when `level` is `expert`; with N at 0 go by `level` without the sentence). A yes goes to step 4 (`expert`) or step 5 (`beginner`); a no ends here. Do not offer it unprompted.

## Rules

- **Never run `open`, `chapter`, `check`, `alternatives` or `mark` before `gate` printed `use`.** They exit 5 with no content, and the door is the user's yes, not yours to assume.
- **Never pass `--answer` to a command other than `gate`, except in the `"saved": false` case of step 1.** Those commands exit 2 when the answer can be stored, and where it cannot, the tool takes it as the user's door answer.
- **Never rerun `gate --answer` after a `skip` unless the user asks for the runbook again.** A new `yes` overwrites the user's no.
- **Never show a beginner the `chapter all` dump.** It is every chapter at once with no progress recorded; the tool refuses it at the beginner level (exit 2).
- **Never ask for a key value.** Say only the name and where to put it. If the user pastes one, do not repeat it: say it is exposed and must be issued again (「노출됐으니 다시 발급해야 해요」), because it stays in the chat history.
- **Never state a button name, a menu path or an address from memory.** Use the chapter text, the card and `home`: screens change, and only the chapter text was checked. Describe a button by its look. If the user cannot find it, ask what is on the screen and use the help sentence.
- **Never skip `check`** for a beginner chapter. It is the only thing that catches an invented number, button name or address before the user sees it.
- **Never write an amount from memory, from a chapter or card, or when `stale` is true.** Prices change and the data holds none. Give an amount only if the user asks, and only after you read a pricing page on the `home` domain of that service (the chapter's or the alternative's `home`) now; say the date. With no web tool, no `home`, or a page that cannot be read, say the price was not checked and tell the user to open the `home` address and look for its pricing page.
- **Never sign up, pay, or submit a review for the user.** Not even through a browser tool: you explain, the user does it (a payment or a review cannot be undone).
- **Never paste several beginner chapters at once.** Wait for the reply of step 5 before the next one: the user loses their place, and the marks stop matching what they did.
- **Never say an internal id or tool word to the user** (a chapter id such as `<gid>`, a feature `id`, `door`, `plan`, an exit code). Say the service name and the words of the tool's `text`: an id is on no screen, so the user cannot find what you point at.

## Chatbot mode

Use this when no tool runs commands on the user's own computer (a chat window without a terminal, or a cloud sandbox). The runbook tool is such a command, so run nothing and never say that a command ran or that anything was saved. Say once at the start that you work from the files of this skill. Follow steps 1 to 7 with these changes:

- No state: ask the door question of step 1 **once per conversation** (a no or an unsure ends it as in the `skip` row), ask the level, and keep the progress in the conversation ("지금까지 한 장: …", with the chapters where the user was stuck). Expert level: take the chapters of the coverage result one at a time, in the order of the chapter file, read each section as the bullet below says, and give its text to copy; never a whole file; you cannot save a file.
- `references/` is generated by `make-plugin.mjs` from the launch-factory source at build time. If it is missing, say this copy of the plugin was built without the runbook data (a build gap, not a broken install) and stop. Read only the file the step needs:
  - Step 2, `references/coverage.md` (about 4 KB), replaces the overview: one yes or no question per result in the words of its table (「잘 모르겠어요」 is a no). The chapters are those every site gets, those of each result and those whose condition holds.
  - Each chapter, `references/cards.md` (about 14 KB): the services, cost kinds, required or optional, what stops if skipped.
  - Each chapter, `references/chapters.ko.md` and `references/chapters.en.md` (about 90 KB each): the one in the user's language, the English one for any other language, never both. Read the intro and the contents list, then only the sections of the chapters you give now and the shared sections they name, each up to the next heading. Do not read a whole chapter file.
  - Before writing a beginner chapter only, `references/rubric.md` (about 9 KB): you cannot run `check`, so write by its rules, check the text against its checklist, fix it, and tell the user in one line that the tool could not be run and you checked with the list. When a chapter's "Old after" date is before today, use its old-chapter sentence.
  - Only when the user asks for alternatives, `references/alternatives.md` (about 26 KB): take the role section whose "In the runbook now" line lists the chapter and keep the options with the tag the user wants (`free`, `cheaper`, `better`, `ko`); if none has it, show all and say none was marked so. Its "support field" part gives the switch sentences.
- You cannot look up an amount. Say so and point to the home domain of the service in `references/cards.md`.
