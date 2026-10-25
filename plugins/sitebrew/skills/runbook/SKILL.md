---
name: runbook
description: Guides the user through running a delivered Sitebrew site for real, only after the user has decided to use it. It says which outside services to register with, in what order, what each one costs by kind (never an amount from memory), whether it is required or optional, and what stops working if it is skipped. It has two levels, beginner (one chapter at a time, in plain words) and expert (all chapters at once, saved to a file on request), and it answers questions about free, cheaper or better alternatives with the fact of whether this site supports them and what switching costs. It never asks for a key value and never signs up or pays for the user. Use after deliver when the user says they will really use the site, or at any time when the user asks for the runbook. Trigger phrases - "runbook", "what do I need to run this site", "cheaper alternative", "런북", "운영 안내", "실제로 쓰려면 뭐가 필요해요", "더 싼 대안", "무료로 되는 건 없어요", "이제 진짜 주소는".
---

# Runbook: what to do to run the site for real

Reply in the user's language. In Korean use 해요체, plain words, no metaphors. Run from the `sitebrew` folder. The site is a folder the `deliver` skill made, and the run folder it came from (for example `out/my-site`).

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

Use this only after the user has decided to use the site (step 1). While a site is being made or changed (`new`, `revise`), do not talk about the runbook, keys or accounts.

Every command below is `node factory/runbook/runbook.mjs <command> ...` with the folder arguments `--run "<run folder>" --site "<site folder>"` (one of them is enough; keep the quotes, spaces and Korean characters are fine). Add `--lf <launch-factory folder>` when the tool cannot find launch-factory, and `--lang ko|en` only when the user wants the other language (the default is the language of the site). The tool prints one JSON document on standard output and its messages on standard error. It never prints a key value.

| Exit code | Meaning | What you do |
|---|---|---|
| 0 | Done (for `check`: no problems). | Go on. |
| 1 | For `check`: the JSON lists problems. Otherwise a tool failure: standard error starts with `도구 실패:` (launch-factory not found, or its data does not match this web-factory). | Say the cause in one or two plain sentences with the next action in the message (for example to pass `--lf`). Do not hide the chapters that still work. |
| 2 | A wrong argument. | Fix the argument. |
| 3 | `ask`: the tool does not know which features the site has. | Step 3. |
| 4 | The `--out` file already exists. | Step 4. |
| 5 | The door is closed. | Go back to step 1 and run `gate`. |

## 1. The door (always first)

Before any chapter, the runbook needs a yes from the user. Ask it **once**:

- If the user asked for the runbook in their own words ("runbook", 「런북」, 「이제 진짜 주소는?」, 「실제로 쓰려면 뭐가 필요해요」), that is a yes. Record it and ask nothing:

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
| `skip` | The user said no or not yet. Say one line, 「나중에 ‘런북’이라고 말하면 보여 드려요」 (in the user's language), and **stop**: no chapter, no key, no account. |
| `ask` | Ask once: 「이 사이트를 실제로 쓰실 건가요?」 (in the user's language; in Korean use this exact sentence). Record the answer with `gate --answer yes`, `gate --answer no` or `gate --answer unsure`. 「잘 모르겠어요」 and 「아직요」 count as no (`unsure`). A yes goes to step 2; anything else is a skip: say the same one line and stop. |

The answer belongs to the run, so the same run is never asked again, even when the site is delivered into another folder.

If `gate --answer` answers `"saved": false`, nothing can be stored for this folder (an old site folder without a `.sitebrew` record). The answer then lives only in the conversation, so add `--answer yes` to every command that follows. The commands of the next steps accept `--answer` **only** in this case; where a record can be kept they exit 2 and the right command is `gate --answer`.

## 2. The level

Ask once, unless the user already said it: 「초보자용(처음부터 하나씩 풀어서 알려 드려요)과 전문가용(핵심만 한꺼번에 보여 드려요) 중 어느 쪽이 좋아요?」. Record it:

```bash
node factory/runbook/runbook.mjs mark --level beginner --run "<run folder>" --site "<site folder>"
```

Use `--level expert` for the expert level. The user can change the level at any time; the chapters already done stay done.

## 3. The overview

```bash
node factory/runbook/runbook.mjs open --run "<run folder>" --site "<site folder>"
```

The JSON has `text` (the overview, already in the right language), `plan` (`chapters` in the order to do them, `missing`, `stale`), `level` and `progress`. Show `text` as it is: a table with the service, what it does, the cost kind, required or optional, and what happens if it is skipped. A chapter in `plan.missing` is shown as 「아직 준비되지 않았어요」; do not hide it and do not write it yourself. Old chapters are marked in `text`; say that the screens may have changed.

**Exit code 3** means the tool has no record of the features this site has, and it does not guess. `ask.questions` lists the questions (`id`, `ko`, `en`). Ask each one once in the user's language as a yes or no question (「잘 모르겠어요」 is a no). Then run the command again with the ids of the yes answers, comma separated; for no yes at all pass an empty value:

```bash
node factory/runbook/runbook.mjs open --features <id>,<id> --run "<run folder>" --site "<site folder>"
```

This records the answer; it does not open the door. Do not say the ids to the user: say the result in the words of the question.

## 4. Expert level

```bash
node factory/runbook/runbook.mjs chapter all --level expert --run "<run folder>" --site "<site folder>"
```

Show `text`: every chapter in short form. Then ask 「파일로 저장할까요?」. Only after a yes, run the same command with a new file:

```bash
node factory/runbook/runbook.mjs chapter all --level expert --out "<new file path>" --run "<run folder>" --site "<site folder>"
```

Use a new file in the user's folder (for example `RUNBOOK.md`). The tool never overwrites. On exit code 4 say that the file exists, ask for another name, and do not delete or replace the old file. On exit code 0 the JSON has `file`: tell the user where it is. One chapter alone: `chapter <gid> --level expert`.

## 5. Beginner level, one chapter at a time

Go through `plan.chapters` of step 3 in that order and skip the chapters whose `progress` is `done`. For each chapter:

1. Get the material:

```bash
node factory/runbook/runbook.mjs chapter <gid> --level beginner --run "<run folder>" --site "<site folder>"
```

The JSON `brief` has `rubric` (the writing rules in the right language), `helpLine` and `chapter`: `title`, `service`, `home`, `cost` and `need` (with `labels`), `ifSkipped`, `mustName` (names you must say), `body` (all the facts), `stale` and `staleLine`, and `check.closing`.

2. Write the chapter for a person who knows nothing about this: follow `brief.rubric`. Use only facts of `body`, the card values and the general words. Say the service, its cost kind and whether it is required or optional (the `labels`), and what stops if the user skips it (`ifSkipped`). Number the steps (`1.`, `2.`), one action each, at most two sentences each. Say every name of `mustName`, as a name only. Put `helpLine` in once, letter for letter. If `stale` is true, put `staleLine` in letter for letter. The only address you may write is `home`, without a path. End by asking `check.closing`.
3. **Check it.** Write the draft into a new file in the system's temporary folder (not the user's folder), then run:

```bash
node factory/runbook/runbook.mjs check <gid> --file "<draft file>" --run "<run folder>" --site "<site folder>"
```

Exit code 0 is a pass. On exit code 1 the JSON has `problems` (`rule`, `detail`, `text`): fix every problem in the draft and check again, **at most 2 times**. If a problem is still there after the second fix, do not hide it: show the chapter and say in plain words what is still wrong (use the `text` sentence). Delete the draft file when you are done.

4. Show the chapter. It ends with the closing question 「다 했어요 / 막혔어요」.
5. 「다 했어요」: run `mark <gid> done` and go to the next chapter. 「막혔어요」: run `mark <gid> doing`, and ask what the user sees on the screen now. Answer only from the chapter. For a fact the chapter does not have, say it was not checked here and say where to ask: the help or support page of that service. When the same chapter is stuck a **third** time, show its expert text (`chapter <gid> --level expert`) and tell the user to ask the support of that service. 「건너뛸게요」: run `mark <gid> skipped` and say again what stops (`ifSkipped`).

```bash
node factory/runbook/runbook.mjs mark <gid> done --run "<run folder>" --site "<site folder>"
```

The status is `doing`, `done` or `skipped`. Show one chapter at a time; do not paste the next one before the user answers.

## 6. Alternatives (at any time, from any chapter)

When the user asks for something free, cheaper or better than the service in a chapter:

```bash
node factory/runbook/runbook.mjs alternatives <gid> --run "<run folder>" --site "<site folder>"
```

If you cannot tell what matters to the user, ask **one** question: 「가격, 쉬운 정도, 한국 지원 중 어느 쪽이 중요해요?」. Then narrow with `--want`: price is `cheaper` (`free` when the user asks for free), ease is `better`, support for Korea is `ko`. When nothing carries that tag, run it again without `--want` and say that none was marked that way.

The JSON has `current` and `options`, each with `service`, `tags`, `switchCost`, `note`, `home`, `checked` and `switch`, or `{"none": true}` when the role has no table.

- Every answer states **whether this site supports it and what switching costs** (`switchCost`), plus `note` and the date `checked`. Say cost as a kind. Give an amount only if the user asks, and only after you check the official price page of that service now; say the date. If you cannot check, say so.
- `switch` is `on`: say 「이미 켜져 있어요」. `reselect`: say 「기능을 다시 고르고 사이트를 다시 받으면 돼요」. `code` or `no`: **state the fact and the cost, and keep the runbook as it is**; the site would need new code or cannot use it.
- `none`: say 「이 표 밖의 답이에요」, say that it was not checked here, and do not invent a service.

## 7. Resume

Only when the user calls the runbook first (for example 「런북」, 「어디까지 했죠?」). Run `open` and read `level` and `progress`. Say, in the user's language: 「지난번에 초보자용으로 N장까지 했어요. 이어서 할까요?」 with N the number of chapters marked `done`. Do not offer it unprompted.

## Rules

- **Never ask for a key value.** Say only the name and where to put it. If the user pastes a value, do not repeat it: say it is exposed and must be issued again (「노출됐으니 다시 발급해야 해요」).
- **Never state a button name, a menu path or an address from memory.** Use the chapter text, the card and `home`. Describe a button by its look. If the user cannot find it, ask what is on the screen and use the help sentence.
- **Never skip `check`** for a beginner chapter.
- **Do not start while a site is being made or changed** (`new`, `revise`), and do not start before the door of step 1 is open.
- **If an alternative is not `builtin` (`switch` is `code` or `no`), state the fact and do not change the runbook.**
- **Never sign up, pay, or submit a review for the user.** You explain; the user does it.
- Keep part names and technical names out of what you say: use the service names and the result words of the tool.

## Chatbot mode

Use this when you have no tool that runs commands on the user's own computer (a chat window without a terminal, or a cloud sandbox). The runbook tool is a command on the user's computer, so run nothing and never say that a command ran or that anything was saved. Say once at the start that you work from the files of this skill. Do the same steps from the files in `references/`:

- There is no state. Ask the door question of step 1 **once per conversation**, ask the level, and keep the progress in the conversation ("지금까지 한 장: …").
- Ask which results the site has, in the words of the table in `references/coverage.md`. The chapters are the ones every site gets, plus those of each result, plus the ones whose condition holds (the same file). The table of services, cost kinds, required or optional, and what stops if skipped is `references/cards.md`. The chapter texts are `references/chapters.ko.md` and `references/chapters.en.md` (about 90 KB each, one file per language: use the one in the user's language and the English one for any other language, never both); alternatives are `references/alternatives.md`. Each chapter file starts with a notice and an intro, then a contents list, then one `##` section per chapter and a few shared sections that chapters name. Read the intro and the contents list, then only the sections of the chapters you are giving now and the shared sections they name, each up to the next chapter or shared-section heading. Do not read a whole chapter file.
- You cannot run `check`. Write a beginner chapter by the rules of `references/rubric.md`, check it yourself against its checklist, fix it, and tell the user in one line that the tool could not be run and you checked with the list.
- You cannot look up an amount. Say so and point to the home domain of the service in `references/cards.md`.
- Compare a chapter's "Old after" date with today's date; when it is earlier, use the old-chapter sentence of `references/rubric.md`.
- If `references/` is missing, say that this copy of the plugin was built without the runbook data and stop.
