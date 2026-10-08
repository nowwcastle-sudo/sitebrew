---
name: new
description: Makes a new website from a short conversation with Sitebrew - asks a few questions about the business, writes a brief, then builds three site candidates (a board) for the user to compare and pick from. Works without any API key in preview mode. Use when the user wants a new site, landing page, shop, portfolio or product page made, or says they have no keys yet. Trigger phrases - "make a website", "new site", "stamp a site", "build me a landing page", "three design options", "사이트 만들어줘", "홈페이지 만들어줘", "랜딩 페이지 만들어줘", "새 사이트", "시안 3개".
---

# Make a new site (conversation, then three candidates)

Reply in the user's language. Never ask the user to paste a key value into the chat and never print one.

## 1. Check the setup

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/doctor.mjs" --data "${CLAUDE_PLUGIN_DATA}"
```

`${CLAUDE_PLUGIN_ROOT}` is the plugin folder and `${CLAUDE_PLUGIN_DATA}` its data folder; Claude Code fills both in (`--data` lets the doctor tell you when a plugin option could not be copied into the shell; in Codex it is ignored). In Codex (or if the text still shows the variable) use the folder two levels above this `SKILL.md` file, in every `${CLAUDE_PLUGIN_ROOT}` command of this skill.

- `FAIL` lines block the work. Fix them with the Korean or English line printed under each item (follow the `doctor` skill if the user needs more help; it also offers to install a missing Git or Node.js, after the user says yes).
- `note` lines are optional keys. A missing key never stops this skill. The site is built in **preview mode**: stock photo slots stay as "image in progress" placeholders, legal pages stay "unverified", and the result is marked "not publishable". Tell the user this once, in one sentence, and go on.
- No clone yet: run the clone command that the doctor printed, then `npm run setup` inside `sitebrew`. Do all kit commands below from the `sitebrew` folder (the Sitebrew repository root).
- A user who wants the check to be strict (stop when a key is missing) sets `WF_REQUIRE_KEYS=1`. The kit's `stamp` then refuses to start without the keys. Do not set it for the user.

## 2. Intake: ask, do not invent

The kit's intake is a set of functions. This plugin script calls them:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/intake.mjs" --kit . archetypes
node "${CLAUDE_PLUGIN_ROOT}/scripts/intake.mjs" --kit . questions saas
```

1. Ask what the site is for in one line (the topic). Pick the archetype with the user: `brand` (company or brand introduction), `commerce` (online shop), `dashboard` (admin or data screen), `detail` (one product page), `local` (shop, clinic or any place with opening hours), `portfolio` (work samples), `public` (public service site), `pwa` (installable app), `saas` (software product), `landing` (a single page with one promise).
2. Run `questions <archetype>`. Ask the printed questions in order, in the user's language (translate them when the user does not write Korean). A question the user cannot answer gets an empty answer. "None" and "not yet" are also read as empty. What the answers change:
   - `mood` (one word such as 따뜻한, 대담한, 차분한) tilts the palettes of the candidates and the tone of the copy.
   - `brandColors` (up to three colour codes such as `#0B6E4F`) makes candidate `c` a brand candidate built on those colours. Pass the codes as the user gave them. A user who gives a colour name ("올리브 녹색") gets a proposed code back from you to confirm; never put a code the user did not confirm.
   - `brandFonts` (heading font, then body font) is used when the kit can install it; otherwise the closest kit font of the same kind is used, and the swap is written in `out/my-site/c/01-direction.json` (field `brand`). Tell the user about a swap.
3. **Never fill a gap with an invented fact.** A missing logo, phone number or photo stays missing. The brief is then marked `previewOnly`: the site uses placeholder assets and a "replace before publishing" mark.
4. Write the answers to `out/answers.json` and make the brief:

```json
{ "topic": "<one line>", "archetype": "<id>", "locale": "ko", "answers": { "name": "<answer>", "audience": "<answer>", "mood": "<answer>", "brandColors": "#0B6E4F, #F4EFE3" } }
```

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/intake.mjs" --kit . brief --input out/answers.json --out out/brief.json
```

The command prints `previewOnly`, the `missing` facts and `unread`. Read the missing facts back to the user as "still empty, shown as to-be-confirmed". Each `unread` item is an answer the kit could not take (for example a colour name instead of a code, or a fourth colour): ask that question again with the printed reason, update `out/answers.json` and run the `brief` command again before you stamp.

## 3. Build the three candidates

```bash
npm run stamp -- --brief out/brief.json --run out/my-site
```

- This builds candidates `a`, `b` and `c` up to step 08 and writes the board data. It builds a Next.js site per candidate, so the board of three takes **about an hour, often more**: a first run on a PC that was also busy with other work took 78 minutes, 23 of them for one candidate's site build. It needs about 3 GB of free memory. Say so before you start, and suggest closing heavy programs.
- Claude Code's Bash tool stops a command after 2 minutes by default and 10 minutes at most. Run `npm run setup` and `npm run stamp` with the longest timeout or in the background, wait until they end, and poll the tail of the log and `out/my-site/stamp-timings.json` (one entry is added per finished step) instead of guessing. If a command is cut off, run the same command again: finished steps are skipped.
- On a slow or busy PC the quality gates may print `측정 못 함` (could not measure). Raise `WF_NAV_TIMEOUT_MS` and `WF_CDP_TIMEOUT_MS` (milliseconds), close heavy programs, and run the same command again: a step 07 that could not measure is measured again (the output says `07 을 다시 잰다`), while finished measurements are kept. The pass/fail thresholds do not change.
- The script never calls a language model. At step 04 it writes `04-content.request.json`, prints the file path and **exits with code 3**. Write the copy by following `factory/stamp/COPY.md` in the kit, then run the same command again. A finished step is skipped on re-run.
- Exit codes: `0` done, `1` a gate or tool failed (read `out/my-site/stamp-summary.json`, field `status`), `2` argument error, `3` waiting for you (step 04 copy). Report the exit code with the last output lines. If the output says `Chrome/Edge not found`, the quality gates have no browser: run `doctor` and follow its `browser` line (set `CHROME_PATH`), then run the same command again.
- A candidate marked "not publishable" is normal in preview mode. Read its reasons from `out/my-site/<a|b|c>/candidate.json` (`blockers`) and give the user the shortest list.

## 4. Show the board and let the user pick

```bash
npm run board:direction -- out/my-site
```

It writes `out/my-site/direction-board/board.html`. Tell the user the path. Summarise each candidate in two lines from `candidate.json` (where the look comes from, what blocks publishing). The user chooses `a`, `b` or `c` in the chat.

## 5. Finish the chosen one

```bash
npm run stamp -- --brief out/brief.json --run out/my-site --pick a
```

For the chosen candidate only, this also writes the legal pages as drafts. It may exit with code 3 again, waiting for a legal review file: follow `factory/legal/AGENT.md`. Without `LAW_API_OC` the review cannot be checked against the law, and the result stays "legal review not done, not publishable". That is correct, not a failure.

Then hand over to the `deliver` skill (copy the site to the user's folder) or the `revise` skill (change a section's design, the colour or font, add, remove or move a section, or reword copy).
