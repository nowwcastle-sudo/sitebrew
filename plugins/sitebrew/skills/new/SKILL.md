---
name: new
description: Makes a new website with Sitebrew from a short conversation - asks a few questions about the business, writes a brief, then builds three site candidates (a board) to compare and pick from. Works without API keys (preview mode). Use for a new site, landing page, shop, portfolio or product page. Not for changing a finished site (use `revise`) or copying it out (use `deliver`). Trigger phrases - "make a website", "new site", "stamp a site", "build me a landing page", "make a site for my shop", "three design options", "사이트 만들어줘", "홈페이지 만들어줘", "랜딩 페이지 만들어줘", "새 사이트", "쇼핑몰 만들어줘", "시안 3개".
---

# Make a new site (conversation, then three candidates)

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

- Ask for or print an API key or secret value in the chat: it stays in the chat history.
- Invent a fact (phone, logo, photo, hours, price): the site publishes it as true.
- Write a colour code the user did not confirm: it becomes the brand colour.
- Add a question beyond the printed ones, or ask for a key, account or setting in that step: `brief` refuses an answer key the kit did not print (`모르는 답 칸`) and `features-write` refuses an id that `features` did not print.
- Describe a step as done that this window did not run: the user would believe a site exists that was never built.
- Set `WF_REQUIRE_KEYS=1` for the user: `stamp` then refuses to start without keys.
- Run `npm run setup` yourself: the `setup` skill owns installation and asks the user first.
- Stamp while `unread` of the brief is non-empty: the kit left that answer out, and fixing it later costs a new brief and another hour.
- Change `--run` between runs of one brief, or reuse a run folder for another brief: finished steps are found by folder (a new folder rebuilds the hour-long board) and `stamp-summary.json` still names the old brief for `--redraw-wider`.
- Run `--pick` before the user chose: it finishes only that candidate, legal drafts included.
- Run a failed stamp (exit 1) again unchanged, that is with no env value, file or flag different from the failed run: the same cause fails again after another hour.

## Judgment calls

- **Spend the questions where a mistake costs the hour.** The archetype and the `action` answer shape all three candidates; a missing phone, logo or photo only adds a "replace before publishing" mark.
- **An unclear answer is empty (`""`), never a guess.** That includes "none", "not yet" and "잘 모르겠어요": the kit drops 없음, none and 미정 itself but keeps "아직요" or "not yet" as a fact. A colour name is not a code: propose one and wait for the yes. Ask in the user's language: the printed Korean sentence for a user who writes Korean, a translation for anyone else.
- **After the board, choose the cheapest change.** Look, colour, font, section or copy: `revise`, same run folder. A **new brief** (changed archetype, `action`, name, audience, brand colours or fonts) needs a new run folder and another hour: say the cost first. Before the first stamp, fixing an `unread` item is not a new brief.

## 1. Check the setup

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/doctor.mjs" --data "${CLAUDE_PLUGIN_DATA}"
```

In Codex, where `${CLAUDE_PLUGIN_DATA}` is empty, leave `--data` out.

- `FAIL` lines block the work: fix them with the line printed under each item (a missing Git or Node.js goes to the `setup` skill, which installs after a yes to that item).
- `note` lines are optional items and never stop this skill. The line that starts `mode:` decides the build mode. `mode: preview` names the keys or folders (`PEXELS_API_KEY`, `LAW_API_OC`, `HIGGSFIELD_DIR`) that are missing: then stock photo slots stay "image in progress" placeholders (`PEXELS_API_KEY`), legal pages stay "unverified" (`LAW_API_OC`), generated-image slots stay requests (`HIGGSFIELD_DIR`) and the result is marked "not publishable". `mode: full` means none of that applies; a `note` about `cloudflared`, `VERCEL_TOKEN` or the launch-factory folder does not change the mode. Section 3 asks the user once.
- No clone yet: use the `setup` skill (its clone and packages items). Run every kit command below from the `sitebrew` folder (the Sitebrew repository root).

## 2. Intake: ask, do not invent

Choose the run-folder name now and use it in every command and path below: `my-site` in the examples (letters, digits, hyphens). A **handover** is known from the user's message, which names `out/answers.json` (the sentence in `references/chatbot-run.md`, "넘기는 말"). Only then skip items 1-4: ask nothing, take the archetype from that file and go to "Write the answers and the brief". A file at `out/answers.json` with no such message may be left from an earlier site, because this skill writes the same fixed paths (`out/answers.json`, `out/features.json`, `out/brief.json`) for every site. Ask once: "Use the saved answers from before?" A yes counts as a handover. A no or an unsure answer means the files are stale: do not read, delete or overwrite them; ask the user to move or rename them, wait, then start the interview at item 1.

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/intake.mjs" --kit . archetypes
node "${CLAUDE_PLUGIN_ROOT}/scripts/intake.mjs" --kit . questions <archetype>
```

A non-zero exit prints one error line: an unknown archetype lists the valid ones; "clone not found" means section 1 is not done.

1. Ask what the site is for in one line (the topic). Choose the archetype by the visitor's first action. The printed `archetypes` list is the authority; this table only reads it:

   | Visitor's first action | Archetype |
   |---|---|
   | Book, call or visit a place with opening hours | `local` |
   | Buy from several products | `commerce` |
   | Buy or order one product | `detail` |
   | Sign up for or try a web product with plans | `saas` |
   | Install and use an app (not a web product with plans) | `pwa` |
   | Act on one promise on a single page | `landing` |
   | Learn who a company is, then contact it (a promise on one page is `landing`) | `brand` |
   | See work samples, then hire (the organisation, not the samples, as the main content is `brand`) | `portfolio` |
   | Use a public service: hours, requests, status | `public` |
   | Read numbers or manage data after login | `dashboard` |

2. Run `questions <archetype>`. Ask the printed questions in order.
3. Brand answers:
   - `brandColors` (up to three codes such as `#0B6E4F`) makes candidate `c` a brand candidate. Pass the codes as the user gave them. For a colour name ("올리브 녹색") propose a code and write it only after the user says yes.
   - `brandFonts` (heading font, then body font): when the kit cannot install a font it uses the closest kit font and records the swap in `out/my-site/c/01-direction.json` (field `brand`). Tell the user about a swap.
4. **Ask what the site must do** (after the questions above, before the brief):

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/intake.mjs" --kit . features <archetype>
   ```

   - `[]` means this Sitebrew has nothing to ask (an older clone, or no launch-factory): ask nothing, say nothing about it, go on.
   - Otherwise it prints `{ id, ko, en }` yes/no questions. Ask them in the printed order, one at a time, with the `ko` sentence as printed (`en` for a user who does not write Korean). "잘 모르겠어요" and "아직요" count as no. Use the result words, never technical names. `references/features.md` (written at build time from the launch-factory table, so it can be absent) says what a choice adds: read it only when the user asks.
   - Write `out/features.json`: one `true` or `false` per printed `id`, for example `{ "signup": true }`. With no feature questions, write no file; an `out/features.json` that exists then is stale (see above), so ask the user to move it.

### Write the answers and the brief

Write `out/answers.json` unless a handover gave it (a stale file was moved first). Every id is optional: leave `""` for an unanswered question. `locale` is `ko` or `en`, the language of the site. Replace each `<...>`:

```json
{ "topic": "<one line>", "archetype": "<id>", "locale": "ko", "answers": { "name": "<answer>", "audience": "<answer>", "action": "<answer>", "contact": "<answer>", "logo": "<answer>", "mood": "<answer>", "brandColors": "<codes the user confirmed, or empty>", "brandFonts": "<heading font>, <body font>", "<archetype question id>": "<answer>" } }
```

`answers` takes only the ids that `questions <archetype>` printed, the archetype's own too (`claim`, `hours`...). Run these in this order; `<archetype>` is the `archetype` field of `out/answers.json`; skip the first command when there is no `out/features.json` (no feature questions, or a handover without that file):

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/intake.mjs" --kit . features-write --archetype <archetype> --input out/features.json --run out/my-site
node "${CLAUDE_PLUGIN_ROOT}/scripts/intake.mjs" --kit . brief --input out/answers.json --out out/brief.json
```

- `features-write` prints the chosen outcomes, including those the choice pulled in (paying needs signing up). Read them back in one sentence with only their `say.ko` words, never an `id` ("회원가입·로그인과 카드 결제를 넣을게요."). An error naming `features.json` means a value is not `true`/`false` or an id was not printed: fix the file and run it again.
- `brief` prints `previewOnly`, `missing` and `unread`. Read `missing` back as "still empty, shown as to-be-confirmed".
- `unread` not empty: stop. Each item is an answer the kit could not take (a colour name instead of a code, a fourth colour). Ask only those items again with the printed reason, update `out/answers.json` and run the `brief` command again with the same run folder. Run `features-write` again only when a feature answer changed. Repeat until `unread` is empty.

## 3. Build the three candidates

Before the first stamp, confirm the archetype matches the `action` answer and `unread` is empty. Then ask once, unless the doctor printed `mode: full` and `missing` is empty: "The three candidates are built in preview mode: <what the `mode: preview` line says is off: stock photos stay placeholders for `PEXELS_API_KEY`, legal pages stay unverified for `LAW_API_OC`, generated images stay requests for `HIGGSFIELD_DIR`>, the site is not publishable, and <the missing facts> stay to be confirmed. Build anyway?" With `mode: full`, leave the preview clause out and ask only about the missing facts. A handover already asked about empty answers (leave the missing facts out) but never about keys: ask about the keys when the doctor printed `mode: preview`. A yes: run the command. A no or an unsure answer: build nothing and return to section 2 so the user can fill the empty answers.

```bash
npm run stamp -- --brief out/brief.json --run out/my-site
```

- This builds candidates `a`, `b` and `c` up to step 08 and writes the board data. One Next.js site per candidate: the board takes **about an hour or more** (one measured run: 78 minutes on a busy PC) and about 3 GB of free memory. Say so before you start, and suggest closing heavy programs.
- Run it in your host's background (Claude Code: Bash `run_in_background`, which sends a notice when the command exits). `out/my-site/stamp-timings.json` gains one entry per finished step; `out/my-site/stamp-summary.json` (fields `exit`, `status`) is written when the command ends, so before that it holds the previous run. With no background mode, give the user the command for their own terminal and ask them to say when it ended.
- **Liveness check.** A step normally ends within 8 minutes; the slowest measured took 36 minutes beside other builds. With no new `stamp-timings.json` entry for 40 minutes, list the process (empty output means it ended):

  ```powershell
  Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like '*stamp.mjs*' } | Select-Object ProcessId
  ```
  ```bash
  pgrep -f factory/stamp/stamp.mjs
  ```
  Running: wait, because a second stamp on the same folder doubles the memory use. Ended without a new `stamp-summary.json`: run the same command again (finished steps are skipped).
- If the quality gates print `측정 못 함` (could not measure; slow or busy PC), double the timeouts (milliseconds; defaults 15000 and 45000) and run the same command again. Step 07 is measured again (`07 을 다시 잰다`); finished measurements are kept and the thresholds do not change:

  ```powershell
  $env:WF_NAV_TIMEOUT_MS = "30000"; $env:WF_CDP_TIMEOUT_MS = "90000"; npm.cmd run stamp -- --brief out/brief.json --run out/my-site
  ```
  ```bash
  WF_NAV_TIMEOUT_MS=30000 WF_CDP_TIMEOUT_MS=90000 npm run stamp -- --brief out/brief.json --run out/my-site
  ```
- A candidate marked "not publishable" is normal in preview mode. Read its reasons from `out/my-site/<a|b|c>/candidate.json` (`blockers`) and give the user the shortest list.

| Exit | Meaning | Do |
|---|---|---|
| `0` | Done. | Go to section 4. |
| `1` | A gate or tool failed. | Read `out/my-site/stamp-summary.json`, field `status`; run `doctor` and report the failing gate. Rerun only after a change (see Never). If the output says `Chrome/Edge not found`, the gates have no browser: follow the `browser` line of `doctor` (set `CHROME_PATH`), then run the same command again. |
| `2` | Argument error. | Nothing was built. Fix the command (`--brief` and `--run` paths) and run it again. |
| `3` | Waiting for you: step 04 wrote one `04-content.request.json` per candidate (the script never calls a language model). | Write the copy by following `factory/stamp/COPY.md` in the kit. Save each answer as `04-content.json` in the folder of its request (`out/my-site/<letter>/04-content.json`, letter `a`, `b` or `c`), then run the same command again. |
| anything else, or no code | The command was cut off. | Run the same command once more. The same result twice: stop and report it. |

## 4. Show the board and let the user pick

```bash
npm run board:direction -- out/my-site
```

It writes `out/my-site/direction-board/board.html` for the user to open. Summarise each candidate in two lines from `candidate.json` (where the look comes from, what blocks publishing). Then steer, do not decide:

- Compare the three on (1) fit to the `action` answer: the first screen leads a visitor to that action; (2) the number of `blockers`; (3) brand fit: when `brandColors` was given, `c` is built on them. Recommend one with one reason; the user chooses `a`, `b` or `c` in the chat.
- The user likes parts of several: pick the closest one, then change the rest with `revise`.
- The user rejects all three: ask what is wrong. "Too alike" is `--redraw-wider` of the `revise` skill on the same run folder, then the stamp command again (a rebuild, no new brief). A change that is a new brief (see Judgment calls) starts again at section 2 with a new run-folder name.

## 5. Finish the chosen one

```bash
npm run stamp -- --brief out/brief.json --run out/my-site --pick a
```

Replace `a` with the letter the user chose. For that candidate only, this also writes the legal pages as drafts. Exit 1: read `out/my-site/<pick>/candidate.json` (`blockers`) and `out/my-site/stamp-summary.json`, and run `doctor`. Exit 3 waits for a legal review file: follow `factory/legal/AGENT.md`, then run the same `--pick` command again. Without `LAW_API_OC` the review cannot be checked against the law, and the result stays "legal review not done, not publishable". That is correct, not a failure.

Then hand over to the `deliver` skill (copy the site to the user's folder) or the `revise` skill (change a design, colour or font, a section, or copy).

## Chatbot mode

Use this when the block "Where this runs" says `chatbot`. This window ran nothing: say so once and never describe a step as done. The whole Never list holds here; its items about commands apply to the commands you write for the user's own computer. The only commands you give are the install steps of the `setup` skill and the folder listing command of `references/chatbot-run.md` step 4; sections 1, 3, 4 and 5 cannot run here.

MANDATORY in chatbot mode: load `references/chatbot-run.md` and `references/intake-questions.md`, in that order, and follow them (install guide, interview, handover). Do NOT load either file in agent mode: the kit prints the questions there.
