---
name: revise
description: Changes one part of a site that Sitebrew already built - the look (spacing, colour including an exact colour code or name, type family, size, corners, depth, motion), one section's design, a section added, removed or moved, or one section's copy. It first says how it read the request, then shows the current site and two alternatives side by side before anything changes, and the last change can be undone. A vague or impossible request gets one question and changes nothing. Use after new, when the user wants something bolder, calmer, airier, different, gone, added, moved, reworded or undone, or says the three directions look too alike. Trigger phrases - "revise the hero", "make this section bolder", "more white space", "use #0B6E4F", "make it green", "serif font", "remove the FAQ", "add a reviews section", "move this up", "undo that", "여백 좀 넓게", "고급스럽게", "히어로 바꿔줘", "색을 초록색으로", "명조로 바꿔줘", "FAQ 빼줘", "후기 섹션 추가해줘", "위로 올려줘", "문구 바꿔줘", "되돌려", "너무 똑같아".
---

# Revise one part of a built site

Reply in the user's language. This skill needs a run folder that has reached step 06 with a chosen candidate (the `new` skill, step 5). Run every command from the `sitebrew` folder. `--pick a` names the candidate that is being changed.

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

Two rules hold in every step:

- Nothing on the site changes before the user picks an alternative (step 5). Say so if the user worries.
- Never make up a reading outside the dictionary, and always show your reading to the user before the alternatives are built.

Exit codes of the revise commands of `npm run stamp` (`--revise…` and `--redraw-wider`; the steps below say what to do with each):

| Code | Meaning |
|---|---|
| 0 | Done: a pick or an undo was applied, `--redraw-wider` drew the directions again, or a plain `--revise` built alternatives straight from the dictionary. |
| 1 | The tool failed, or the run folder has no built site yet (step 06 is missing). |
| 2 | The arguments or the readings JSON are wrong, or `--redraw-wider` has no earlier run to redo. Nothing was changed. |
| 3 | Not an error: the tool waits for a person or for the agent. Look for one of the markers below in the output (a `참고:` line or a log line may come first). |

What exit code 3 means, by what the output shows:

| The output shows | Meaning | Where |
|---|---|---|
| JSON and a `해석:` line (`--explain`) | The classification of a design sentence, or the request itself for a section, structure or copy sentence. | step 1 |
| An alternatives list with `고르려면:` | The alternatives are ready to compare and pick. | step 4 |
| `질문:` | The tool needs one answer from the user. Ask it as printed; nothing was changed. | steps 1, 4, "Sections, structure and copy" |
| `대기: 문구 수정 요청` or `대기:` after a pick | Some texts must be written by following `factory/stamp/COPY.md`; then run the same command again. | "Sections, structure and copy" |
| 「이 안을 만든 뒤에 사이트가 바뀌어서 지금과 맞지 않아요…」 | The site changed after the alternatives were built. Build them again with the same words. | step 5 |
| A question about what should be different (after a pick of `none`) | Nothing applied. Put the answer into a new sentence and start again at step 1. | step 5 |
| `되돌릴 수정이 없어요.` | Nothing to undo. | step 6 |
| A message that the directions cannot get more different, or that picking them again would drop an applied design change | Nothing changed. Offer a specific change, or undo the applied changes first. | step 7 |
| A message that the copy answer failed the content checks (length, tone, example-text mark) | Nothing was written. The tool prints the problems; fix the answer file and run the same command again. | "Sections, structure and copy", "Limits to say out loud" |

## Design requests: seven steps

A design request is a wish about the look: spacing, colour, type, size, corners, depth, motion, a feel such as "고급스럽게", a likeness such as "2번 시안처럼", for the whole site, one page or one section. Adding, removing or moving a section and rewriting copy keep their own commands (last part of this file).

### 1. Classify

```bash
npm run stamp -- --run out/my-site --pick a --revise "여백 좀 넓게" --explain
```

It changes nothing. Exit code 3 is the normal result: it prints JSON and a `해석:` line. Exit code 1 means the run folder has no built site yet (step 06 is missing; run the stamp command of the `new` skill first). Exit code 2 means the arguments are wrong.

For a design sentence the JSON is the classification, and `result` is one of:

- `confirmed`: the dictionary found one reading. `readings` is the list, `say` the plain sentence, `lead` the main reading, `kind` its sort.
- `two`: the words fit two readings. `options` holds both, each with its `readings` and `say`.
- `near`: no dictionary word matched, but `nearest` lists similar example sentences with their `kind` and `lead`.
- `unknown`: the dictionary cannot place it. `ask` is a question, `choices` its plain-word answers.

For a sentence about one section, a structure change or copy (「히어로 더 차분하게」, 「FAQ 빼줘」, 「문구 짧게」) the JSON is the request itself: `scope` (`section`, `remove`, `add`, `order` or `copy`), `target`, `intent` and `text`. The `해석:` line starts with `<scope> <target> — `. When the dictionary also read a direction in a section sentence, the request carries `classification`, and its `readings` are already scoped to the section (`section:hero`); pass them as they are in step 4.

A line with `질문:` instead of JSON is a question the tool already decided to ask (for example a value that was negated, or two kinds of change in one sentence). Ask it as printed and stop.

### 2. Decide the final readings

The dictionary only sorts roughly. You decide the final readings from the classification and the user's own words.

- Use only dictionary names. The axes and their two ends are the `axes` in `factory/vocab/design-lexicon.yaml` (colour value, brightness, colour strength, colour temperature, colour count, contrast, type family, type size, spacing, corners, depth, motion). A reading is `{"axis": "<id>", "direction": "<end>" or "value": "<name>", "strength": 0|1|2, "scope": "site"}`. Strength 1 is one step, 2 is two steps, 0 keeps the level. Add `"cap": true` for "not further than now" (「너무 차갑지 않게」). The scope is `site`, `page:<key>`, `section:<kind>` or `element:<name>`.
- A colour to leave and a colour to reach (「빨간색을 파란색으로」, 「초록에서 파랑으로」, "change red to blue"): the tool reads only the colour to reach. Pass that one value. Colours said side by side (「빨강이랑 파랑」, 「빨강이나 파랑」) are two values and each gets its own alternative.
- `confirmed`: use the readings as they are. Change a strength or scope only when the user's words say so (「많이」 is 2, 「히어로만」 is the hero section).
- `two`: pass both as `options`, so each reading gets its own alternative.
- `near`: read the user's sentence next to the `nearest` examples. Use one example's `lead` only when it clearly fits.
- A colour code (`#0B6E4F`), a colour name or a font family the user said is a value reading (`color-hue`, `type-family`). Never invent a code or a font the user did not say.
- A request to copy another candidate (「2번 시안처럼」, 「아까 게 나았어」) is `{"copyFrom": "b"}` (candidates 1 to 3 are a to c) or `{"copyFrom": "previous"}`.
- A name that is neither a dictionary word nor one of the user's candidates (a site, a brand, a product: 「토스 사이트처럼」) is unknown. Do not guess what it looks like. Ask the line `text.askUnknownReference` in `factory/vocab/grammar.yaml` word for word (the `ko` line for Korean, the `en` line otherwise). Then treat the answer as a new, narrower request about colour, type or layout.
- When you are not sure, ask one question with two or three choices in plain words, using the labels from the dictionary (`axes.<id>.label`, `endLabels`). Change nothing until the user answers.

### 3. Show your reading first

Before building anything, say in one plain sentence how you read the request. Use the tool's `say` and the dictionary labels; no technical words. Example: 「여백을 넓히는 쪽으로 이해했어요. 지금 모습과 두 가지 안을 나란히 보여 드릴게요.」 If you changed the tool's reading in step 2, say your version. You do not need to wait for an answer: nothing is applied yet.

### 4. Build the alternatives

```bash
npm run stamp -- --run out/my-site --pick a --revise-readings '{"readings":[{"axis":"spacing","direction":"airy","strength":1,"scope":"site"}]}'
```

The input is `{"readings": [...]}` (the current site plus other alternatives of this reading), `{"options": [{"readings": [...]}, {"readings": [...]}]}` (two readings, one alternative each) or `{"copyFrom": "..."}`.

- Exit code 2: the input does not fit the dictionary. The tool lists each problem. Fix the JSON and run it again; nothing was changed.
- Exit code 3 with a list: the alternatives are ready (`v1`, `v2`; sometimes only one, and the `참고:` line says why). For a section reading the tool never fills a missing alternative with a design of the other direction: if a section has no bolder design left, there are fewer alternatives and the reason is given. Each has `axis: from → to` lines. A `주의:` line under an alternative means that design cannot hold the current text; tell the user before they pick.
- Exit code 3 with `질문:`: ask it and change nothing.
- Show the user the compare page: `compare.html` in the same folder as the printed `board.json` (`09-revise/<number>/compare.html`). It shows the current site and the alternatives side by side. Call the alternatives 「1안」 and 「2안」 and name the id in brackets: 「1안 (v1)」, 「2안 (v2)」. The compare page and the `고르려면:` line use the same ids, and `--revise-pick` takes the id (`1:v1`). Describe each alternative in plain words, for example 「1안(v1)은 구획 사이가 한 단계 시원해요. 새로 생기는 문제는 없어요.」

A plain `--revise "<text>"` without `--explain` also builds the alternatives straight from the dictionary's own reading (exit code 0). Use it for section, structure and copy requests. For a design request use steps 1 to 4, so the final reading is yours and the user saw it.

### 5. Choose

```bash
npm run stamp -- --run out/my-site --pick a --revise-pick 1:v1
```

The value is `<number>:<alternative id>` exactly as printed (`고르려면:` line). Exit code 3 with 「이 안을 만든 뒤에 사이트가 바뀌어서 지금과 맞지 않아요…」: the site changed after these alternatives were built (another alternative was picked, or a change was undone). Nothing was changed. Build the alternatives again with the same words (step 4), then pick from the new board.

Exit code 0: the look of the candidate is changed. The tool prints `낡은 단계: 06·07`; the pages and quality gates are rebuilt by the next stamp run, so follow the `다음:` line it prints. Say what changed: 「여백을 한 단계 넓혔어요.」

If the user says neither fits (「둘 다 아니에요」):

```bash
npm run stamp -- --run out/my-site --pick a --revise-pick 1:none
```

Exit code 3: nothing is applied, and the tool prints a question about what should be different. Put the answer into a new sentence and start again at step 1, as for any vague wish.

### 6. Undo

When the user says 「되돌려」 or "undo that":

```bash
npm run stamp -- --run out/my-site --pick a --revise-undo
```

Exit code 0: the most recently applied change is undone (a design, section, structure or copy change alike). Run it again to undo the one before. Say: 「방금 바꾼 것을 되돌렸어요.」 Then follow the `낡은 단계:` line as after step 5. Exit code 3 (`되돌릴 수정이 없어요.`): there is nothing to undo; say so.

### 7. Too alike

When the user says the three directions look too alike (「너무 똑같아」):

```bash
npm run stamp -- --run out/my-site --redraw-wider
```

No `--pick`. The three directions are chosen again with more differences between them, and the steps built on them are marked outdated. Exit code 0: tell the user, then run the stamp command from the `new` skill again for the same run folder to rebuild, and let the user pick a candidate again. Each call widens the spread more. Exit code 3: they cannot get more different, or a design change you applied is still active (the tool says that picking the directions again would drop it, and changes nothing). Say so: offer a specific change instead (step 1), or undo the applied changes first (step 6) and ask again. Exit code 2: there is no earlier run to redo.

## Sections, structure and copy

These requests keep the plain `--revise` command. The tool maps the sentence to one of these:

| The user says | What the tool does |
|---|---|
| a section + bolder / calmer / different ("히어로 더 대담하게") | **section**: two other designs of that section |
| remove a section ("FAQ 빼줘") | **remove**: one option without it. A section the site type requires (hero, footer, legal notice) is refused with a reason |
| add a section ("후기 섹션 추가해줘", optionally "메뉴 아래에") | **add**: two designs of it. It then waits for its copy (exit 3, `대기:`) |
| move a section ("위치를 히어로 바로 아래로") | **order**: one option with the new order. The hero stays first and the footer last |
| shorter / warmer / more formal copy of a section | **copy** |

```bash
npm run stamp -- --run out/my-site --pick a --revise "make the hero bolder"
```

- Use the user's own words, in Korean or English. The tool asks instead of guessing.
- **Exit code 3 with a line starting `질문:`** means the request could not be mapped or cannot be done as asked. Nothing was changed. Ask the user that one question, put the answer into a new sentence, and run the command again. When the question proposes a value (for example `비슷한 색으로 바꿀까요? 예: #9B6D00`) and the user says yes, write that value into the new sentence ("메인 색을 #9B6D00 로"); a bare "yes" is read as vague again.
- A section that this site type cannot have (for example reviews on a medical site) is refused the same way, with the reason. Say the reason to the user; do not look for a way around it.
- Exit code 3 with `대기: 문구 수정 요청` is a copy revision: write the answer file by following `factory/stamp/COPY.md`, then run the same command again.
- Exit code 0 prints the number of alternatives (usually 2), for each one the block or axis it uses, and how many reasons for "not publishable" it adds. The current site is not changed yet.
- Exit code 1 is a tool failure. Report the last lines, and stop after a second failure with the same cause.

Choose with `--revise-pick <number>:<alternative id>` as in step 5, and undo with `--revise-undo` as in step 6. A **section** choice swaps the block; **remove**, **add** and **order** change the page's section list (the texts move with their sections); **copy** writes the chosen texts into `04-content.json`. If a pick prints `대기:` and exits with code 3, a new block still needs its screen texts: write them by following `factory/stamp/COPY.md`, then run the same command again.

## When the choice does not show up

- A line `주의:` under an alternative (or in the `--revise-pick` output) means that design cannot hold the current text, usually a heading that is too long (for example `제목을 5자 이하(한글 기준)로 줄이면 됩니다`). Tell the user before they pick. If they still want it, revise the copy first ("히어로 제목 짧게"), then pick.
- After the rebuild, a line starting `경고: 수정으로 고른` means step 06 drew another design for that section, with the reason. Tell the user; never report the change as done.
- `04-content … (stale)` or `대기:` after a pick means some texts must be written again for the new structure: follow `factory/stamp/COPY.md`, then run the printed `다음:` command again until it ends with 0 or with the legal-review wait (exit 3).

## Limits to say out loud

- A copy alternative is refused (nothing is written) when its text breaks the content checks (length, tone, example-text mark). The tool prints the problems; fix the answer file and run the same command again.
- A new block may arrive without its on-screen texts. It then shows "example text left" as a blocker until the copy is written.
- A colour name is read as one representative code, and the board says which; ask the user for the exact code if it matters. A colour that cannot be made readable (a pale yellow as the main colour) gets a question, not a broken alternative.
- A change to one element applies to the whole site unless the tool can change that element alone (today: the headline size). The tool asks 「사이트 전체에 적용돼요. 괜찮아요?」 first; pass the user's answer on.
- The user's choice is remembered on this computer only (`preferences.json`, in the folder named by `CLAUDE_PLUGIN_DATA` if set, otherwise `~/.factory`). Nothing is sent anywhere.

## Chatbot mode

Use this when the block "Where this runs" says `chatbot`. A change needs the run folder on the user's computer and the kit's commands, so this window changes nothing.

1. Help the user word the request in one sentence (what, where, how much). Read it back as your reading, using the words of this skill's dictionary, and say it is only a reading.
2. Give the command to paste inside the `sitebrew` folder: `npm run stamp -- --run out/my-site --pick a --revise "<the sentence>" --explain`. Say what they should see: how the request was read, then two alternatives next to the current one, and that nothing has changed yet.
3. Ask the user to paste the printed reading or question. Never give the pick or undo commands before they chose an alternative.
4. Say once that this window ran nothing.
