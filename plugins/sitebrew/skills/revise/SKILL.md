---
name: revise
description: Changes one part of a site Sitebrew already built - builds alternatives side by side with the current site on a compare board, applies the one the user picks, or undoes the last change. Use for a look change (bolder, calmer, a colour, a font), a section added, removed, moved or reworded, an undo, or when the three directions (the three candidate designs) look too alike. Not for a first build (new) or publishing (deliver). Trigger phrases - "change the font", "remove the FAQ section", "reword the hero", "make it bolder", "more white space", "use #0B6E4F", "make it green", "serif font", "add a reviews section", "move this up", "undo that", "undo that site change", "여백 좀 넓게", "고급스럽게", "히어로 바꿔줘", "색을 초록색으로", "명조로 바꿔줘", "FAQ 빼줘", "후기 섹션 추가해줘", "위로 올려줘", "문구 바꿔줘", "되돌려", "사이트 수정 되돌려", "너무 똑같아".
---

# Revise one part of a built site

This skill needs a run folder whose chosen candidate has reached kit stage 06 (file `<letter>/06-pages.json`; the `new` skill, step 5). Run every command from the `sitebrew` folder.

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

If `detect` itself errors although you have a command tool and `${CLAUDE_PLUGIN_ROOT}` is filled in, follow the last rule of the block above.

## Before the first command

Every revise command below (the ones with an action flag) carries `--run <run> --pick <pick>` and exactly one action flag: two action flags give exit code 2. `--redraw-wider` is the exception: `--run <run>` only. Replace the placeholders; never copy a value from an example.

- `<run>`: a run folder `out/<name>` inside the `sitebrew` folder that has `<letter>/06-pages.json`. List the built candidates from inside that folder (one line for bash and PowerShell):

  ```bash
  node -e "for (const f of require('node:fs').globSync('out/*/?/06-pages.json')) console.log(f)"
  ```

  A line `out/<name>/<letter>/06-pages.json` gives `<run>` = `out/<name>`. One run folder: use it. Several: ask the user once which site and keep the answer. None: the site is not built yet; use the `new` skill.
- The `sitebrew` folder is the one that holds `factory/stamp/stamp.mjs`: `./sitebrew` in the folder the user works in, or the folder named by `SITEBREW_DIR`.
- The listing line needs Node 24.13.0 or later (the kit's minimum). If `node --version` is lower, or `node` is missing, use the `doctor` skill.
- `<pick>`: the candidate letter (`a`, `b` or `c`) the user chose in the `new` skill, step 5. Ask if you do not know it.
- `--revise-readings` takes its JSON as one argument on one line. Single quotes work in bash and PowerShell 7; Windows PowerShell 5.1 and cmd.exe need the inner double quotes escaped as `\"` (cmd.exe also outer double quotes). Exit code 2 with `JSON 을 읽지 못했다` means the quotes were lost; nothing changed.
- Each step names the exit code its command should end with. For any other exit code, and for any marker line its step does not handle (`대기:`, `문구 응답이 검사에서 떨어졌다`, `이 안을 만든 뒤에…`), you MUST read `references/exit-codes.md` first. Do NOT load it while every command ends as its step says.

## Never

- Never build alternatives for a design wish before you have told the user your reading ("Show your reading"), and never use plain `--revise` for it: the user would pick between designs for a request they never saw you understand.
- Never treat exit code 3 of `--revise-readings` as a failure, and never rerun it: it ends with 3 after the alternatives are built (check: the output lists `v1` and ends with a `고르려면:` line). A rerun builds a second board with a new number. Plain `--revise` ends with 0 instead.
- Never take the first `lead` of a `near` result without comparing it with the user's words: examples are ranked by shared words, not meaning, so the first can point the other way.
- Never edit `04-content.json` or `board.json` by hand to apply a change: `--revise-pick` checks the new texts and that the site still matches the board, a hand edit checks neither. The only file you write is the one `factory/stamp/COPY.md` names.
- Never invent a colour code or a font the user did not say: the pick writes it into the site as if the user had chosen it.
- Never guess what a named site, brand or product looks like: the answer would be your guess, not the user's wish. Ask the `text.askUnknownReference` line ("Decide the readings").
- Never look for a way around a refused section (reviews on a medical site, removing the hero): the content rules of the site type forbid adding it or require keeping it. Say the tool's reason.
- Never reuse a number or an id from an example or from an earlier board in `--revise-pick`: the number names one board, and an old one picks a design the user never saw.
- Never run a pick and an undo (or two picks) back to back without showing the user the result in between: the user cannot tell which version of the site they have.
- Never report a change as done when the rebuild output has a line starting `경고: 수정으로 고른`: stage 06 drew another design for that section. Tell the user, with the reason on that line.

## Route

| The user asks for | Go to |
|---|---|
| To pick one of the alternatives just shown | Choose |
| To undo the last change | Undo |
| The three directions look too alike (「너무 똑같아」) | Too alike |
| Any other change: a look wish (spacing, colour, type, size, corners, depth, motion, a feel word, a likeness 「2번 시안처럼」), one section's look, a section added, removed or moved, other copy | Classify; its result tells you the rest |

## 1. Classify

Before you classify, ask yourself what the user is unhappy with: the thing, where on the site, how far. If you cannot say it in one sentence, ask one question first.

```bash
npm run stamp -- --run <run> --pick <pick> --revise "<the user's sentence>" --explain
```

It changes nothing. Expected: exit code 3, JSON and a `해석:` line. For a design sentence the JSON is the classification, and `result` is one of:

- `confirmed`: the dictionary found one reading. `readings` is the list, `say` the plain sentence, `lead` the main reading, `kind` its sort.
- `two`: the words fit two readings. `options` holds both, each with its `readings` and `say`.
- `near`: no dictionary word matched, but `nearest` lists similar example sentences with their `kind` and `lead`.
- `unknown`: the dictionary cannot place it. `ask` is a question, `choices` its plain-word answers.

For a sentence about one section, a structure change or copy (「히어로 더 차분하게」, 「FAQ 빼줘」, 「문구 짧게」) the JSON is the request itself: `scope`, `target`, `intent` and `text`. The `해석:` line starts with `<scope> <target> — `. What the JSON shows decides the next step:

| The JSON has | Next |
|---|---|
| `result` | Decide the readings |
| `scope: section` and `readings` (at the top or inside `classification`; already scoped, `section:hero`) | Decide the readings |
| `scope: section` and only `intent` (no `readings`) | Build the alternatives with plain `--revise` and the same sentence |
| `scope` of `remove`, `add`, `order` or `copy` | Build the alternatives with plain `--revise` and the same sentence |
| A `질문:` line instead of JSON | The rule below |

A `질문:` line is a question the tool decided to ask; nothing changed. Ask it as printed, put the answer into a new one-sentence request and classify again. A bare "yes" is read as vague, so write the value into the sentence: if the question proposes a value (`비슷한 색으로 바꿀까요? 예: #9B6D00`), say 「메인 색을 #9B6D00 로」. If it asks whether a change may apply to the whole site, that change has no section form (colour, brightness, colour strength, colour temperature, colour count, typeface, corners): on a yes, say the request again with the whole site in it (「사이트 전체 색을 파랑으로」), not 「히어로 색을 파랑으로」.

## 2. Decide the readings

The dictionary only sorts roughly. You decide the final readings from the classification and the user's own words.

- Use only dictionary names. The axes and their two ends are the `axes` of the dictionary (colour value, brightness, colour strength, colour temperature, colour count, contrast, type family, type size, spacing, corners, depth, motion). A reading is `{"axis": "<id>", "direction": "<end>" or "value": "<name>", "strength": 0|1|2, "scope": "site"}`. Add `"cap": true` for "not further than now" (「너무 차갑지 않게」). The scope is `site`, `page:<key>`, `section:<kind>` or `element:<name>`.
- **Strength**: 1 is one step along the axis `order`, 2 is two steps or the end, 0 keeps the level. With no amount from the user keep 1: a small step can be repeated, a big one can only be undone. The tool reads 「아주」 and 「훨씬」 as 2 and 「조금만」 as 1, and leaves 「많이」 at 1, so raise that one yourself.
- **Scope**: keep the scope the tool printed unless the user named a place. A named section always wins: `section:<kind>`, even when the tool printed `site` (「히어로만」 is `section:hero`). A sentence that names no place stays `site`. A section look sentence changes only that section, by swapping its design, so fewer alternatives may exist.
- `confirmed`: use the readings as they are; change a strength only when the user's words say so.
- `two`: pass both as `options`, so each reading gets its own alternative.
- `near`: read the user's sentence next to the `nearest` examples; use an example's `lead` only when it clearly fits. A word with no dictionary entry (「make it pop」) is `near`, not motion: ask with the dictionary labels (colour strength, contrast or size).
- A colour code (`#0B6E4F`), a colour name or a font family the user said is a value reading (`color-hue`, `type-family`).
- A colour to leave and a colour to reach (「빨간색을 파란색으로」, "change red to blue"): the tool reads only the colour to reach, so pass that one value. Colours said side by side (「빨강이랑 파랑」) are two values and each gets its own alternative.
- A request to copy another candidate (「2번 시안처럼」, 「아까 게 나았어」) is `{"copyFrom": "b"}` (candidates 1 to 3 are a to c) or `{"copyFrom": "previous"}`.
- A name that is neither a dictionary word nor one of the user's candidates (a site, a brand, a product: 「토스 사이트처럼」) is unknown. Ask the line `text.askUnknownReference` of `factory/vocab/grammar.yaml` word for word (the `ko` line for Korean, the `en` line otherwise), then treat the answer as a new, narrower request about colour, type or layout.
- You are not sure when `result` is `unknown`, when it is `near` and no `lead` clearly fits, or when the user's word names no end of an axis. Then ask one question with two or three choices in plain words, using the dictionary labels (`axes.<id>.label`, `endLabels`), and change nothing until the user answers. In every other case you are sure.
- Open `factory/vocab/design-lexicon.yaml` (its `axes` block only) when you must change an axis, end or label that the tool did not print.

## 3. Show your reading

Before building anything, say in one plain sentence, in the user's language and without technical words, how you read the request: the tool's `say` (or your version, if you changed the reading) and the dictionary labels. A feel word moves several axes (「고급스럽게」 changes spacing, colour count and the typeface, yet its `say` names only the first two): name every axis of the final readings, or the user picks a font change nobody mentioned. When you were sure in step 2, build in the same turn, because nothing is applied yet. When you asked, wait for the answer first.

## 4. Build the alternatives

For a design wish or a section look with readings (the user has heard your reading):

```bash
npm run stamp -- --run <run> --pick <pick> --revise-readings '<readings JSON>'
```

Replace `<readings JSON>` with your final readings: `{"readings": [...]}` (the current site plus other alternatives of this reading), `{"options": [{"readings": [...]}, {"readings": [...]}]}` (two readings, one alternative each) or `{"copyFrom": "..."}`. Expected: exit code 3, waiting for the pick (see Never).

For every other row of the table in Classify:

```bash
npm run stamp -- --run <run> --pick <pick> --revise "<the user's sentence>"
```

Use the user's own words, in Korean or English; the tool asks instead of guessing. Expected: exit code 0. The tool maps the sentence to one kind:

| The user says | What the tool does |
|---|---|
| remove a section ("FAQ 빼줘") | **remove**: one option without it. A section the site type requires (hero, footer, legal notice) is refused with a reason |
| add a section ("후기 섹션 추가해줘", optionally "메뉴 아래에") | **add**: two designs of it. It then waits for its copy (`대기:`) |
| move a section ("위치를 히어로 바로 아래로") | **order**: one option with the new order. The hero stays first and the footer last |
| shorter / warmer / more formal copy of a section | **copy** |
| a section look with no reading (「히어로 더 대담하게」) | **section**: swaps that section's design |

Both commands list the alternatives (`v1`, `v2`; sometimes only one, and the `참고:` line says why: for a section the tool never fills a missing alternative with a design of the other direction). Each has `axis: from → to` lines, or the block it uses, and how many reasons for "not publishable" it adds. The last line is `고르려면:`.

- A line `주의:` under an alternative means that design cannot hold the current text, usually a heading that is too long (for example `제목을 5자 이하(한글 기준)로 줄이면 됩니다`). Tell the user before they pick. If they still want it, revise the copy first (Classify with 「히어로 제목 짧게」), then pick.
- Show the user the compare page: `compare.html` in the same folder as the printed `board.json` (`09-revise/<number>/compare.html`). It shows the current site and the alternatives side by side. Call the alternatives 「1안」 and 「2안」 and name the id in brackets, 「1안 (v1)」, then describe each in plain words, in the user's language.

Nothing on the site changes before the user picks (Choose) or undoes (Undo). Say so if the user worries.

## 5. Choose

```bash
npm run stamp -- --run <run> --pick <pick> --revise-pick <number>:<id>
```

Take `<number>` from the `고르려면:` line (page-scope readings print one line per section, each with its own number) and `<id>` from the alternatives above it (`v1`, `v2`), exactly as printed. When the user says neither fits (「둘 다 아니에요」), use `<number>:none`: nothing is applied, the tool asks what should be different (exit code 3), and the answer is a new request for Classify.

Expected: exit code 0, a line saying what changed, then `낡은 단계: 06·07` and `다음:`. Tell the user in one sentence what changed. A line `주의:` between the two means the chosen design cannot hold the current text (as under an alternative in Build): relay it in one sentence and offer to shorten that text (Classify, 「히어로 제목 짧게」). A **section** choice swaps the block; **remove**, **add** and **order** change the page's section list (the texts move with their sections); **copy** writes the chosen texts into `04-content.json`.

`낡은 단계:` (the outdated stages: 06 the pages, 07 the quality gates) and `다음:` (what to run) describe one rebuild, not two. Run it once, before the user previews or delivers the site, because the site files change only then:

```bash
npm run stamp -- --brief <brief> --run <run> --pick <pick>
```

`<brief>` is the `brief` value in `<run>/stamp-summary.json`; the command is the one of the `new` skill, step 5. It may end with 3 (copy or a legal review file): the exit-code reference covers it.

## 6. Undo

When the user says 「되돌려」 or "undo that":

```bash
npm run stamp -- --run <run> --pick <pick> --revise-undo
```

It undoes the latest applied change of any kind (design, section, add, remove, order, copy); run it again to undo the one before. Expected: exit code 0 and a line saying it was undone (relay it in the user's language). The output has a stale-steps line but no `다음:`: the rebuild of Choose is the same one. That line starts `낡은 단계:` (Korean) or `Stale steps:` (the request was in English). With nothing to undo the tool exits 3 and prints `되돌릴 수정이 없어요.` or `There is no change to undo.`: nothing changed, tell the user. `--redraw-wider` is not covered: no command brings back the earlier three directions.

## 7. Too alike

When the user says the three directions look too alike (「너무 똑같아」): if the user can say what they dislike, make that one change (Classify) instead. `--redraw-wider` draws all three directions again and outdates every candidate, so a rebuild and a new pick follow; each call widens the spread more, and nothing restores the earlier directions.

```bash
npm run stamp -- --run <run> --redraw-wider
```

Expected: exit code 0. Tell the user, then rebuild all three candidates with the `new` skill's step 3 command (`npm run stamp -- --brief <brief> --run <run>`, no `--pick`) and let the user pick again. Any other exit code: read `references/exit-codes.md`.

## Limits to say out loud

- A new block may arrive without its on-screen texts: "example text left" is a blocker until the copy is written.
- A colour name is read as one representative code, and the board says which; ask for the exact code if it matters. A colour that cannot be made readable (a pale yellow as the main colour) gets a question, not a broken alternative.
- A change to one element applies to the whole site unless the tool says it can change that element alone; the `질문:` rule of Classify covers the question.
- The user's choice is remembered on this computer only (`preferences.json`, in the folder named by `CLAUDE_PLUGIN_DATA` if set, otherwise `~/.factory`). Nothing is sent anywhere.

## Chatbot mode

Use this when the block "Where this runs" says `chatbot`. A change needs the run folder on the user's computer and the kit's commands, so this window ran nothing and changes nothing: say so once. You MUST read `references/chatbot.md` and follow it. Do NOT load it in agent mode.
