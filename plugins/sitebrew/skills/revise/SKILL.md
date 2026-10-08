---
name: revise
description: Changes one part of a site that Sitebrew already built - one section's design, the colour (including an exact colour code or colour name), the type family, the motion level, a section added, removed or moved, or one section's copy - and shows the alternatives before anything changes. A vague or impossible request gets one question and changes nothing. Use after new, when the user wants a section bolder, calmer, different, gone, added, moved or reworded, or wants their own colour or font style. Trigger phrases - "revise the hero", "make this section bolder", "use #0B6E4F", "make it green", "serif font", "remove the FAQ", "add a reviews section", "move this up", "더 대담하게", "히어로 바꿔줘", "색을 초록색으로", "명조로 바꿔줘", "FAQ 빼줘", "후기 섹션 추가해줘", "위로 올려줘", "문구 바꿔줘".
---

# Revise one part of a built site

Reply in the user's language. This skill needs a run folder that has reached step 06 with a chosen candidate (the `new` skill, step 5). Run every command from the `sitebrew` folder.

## 1. Turn the request into one sentence the tool can map

The tool maps a sentence to one of these:

| The user says | What the tool does |
|---|---|
| a section + bolder / calmer / different ("히어로 더 대담하게") | **section**: two other designs of that section |
| a colour value: a code (`#0B6E4F`) or a colour name ("초록색으로") | **colour value**: two palettes built on that colour, both with readable contrast. A name is read as one representative code, and the board says which; ask the user for the exact code if it matters |
| a type family: 명조 / serif, 고딕 / sans, 손글씨, 둥근, mono | **type value**: two kit fonts of that family that draw Korean |
| colour / type / motion without a value ("색 다르게") | **axis**: the whole site, a different or bolder/calmer level |
| remove a section ("FAQ 빼줘") | **remove**: one option without it. A section the site type requires (hero, footer, legal notice) is refused with a reason |
| add a section ("후기 섹션 추가해줘", optionally "메뉴 아래에") | **add**: two designs of it. It then waits for its copy (exit 3, `대기:`) |
| move a section ("위치를 히어로 바로 아래로") | **order**: one option with the new order. The hero stays first and the footer last |
| shorter / warmer / more formal copy of a section | **copy** |

```bash
npm run stamp -- --run out/my-site --pick a --revise "make the hero bolder"
```

- Use the user's own words, in Korean or English. Do not paraphrase a vague wish into a precise one yourself.
- **Exit code 3 with a line starting `질문:`** means the request could not be mapped or cannot be done as asked. Nothing was changed. Ask the user that one question, put the answer into a new sentence, and run the command again. When the question proposes a value (for example `비슷한 색으로 바꿀까요? 예: #9B6D00`) and the user says yes, write that value into the new sentence ("메인 색을 #9B6D00 로"); a bare "yes" is read as vague again.
- A section that this site type cannot have (for example reviews on a medical site) is refused the same way, with the reason. Say the reason to the user; do not look for a way around it.
- Exit code 3 with `대기: 문구 수정 요청` is a copy revision: write the answer file by following `factory/stamp/COPY.md`, then run the same command again.
- Exit code 0 prints the number of alternatives (usually 2), for each one the block or axis it uses, and how many reasons for "not publishable" it adds. The current site is not changed yet.
- Exit code 1 is a tool failure. Report the last lines, and stop after a second failure with the same cause.

## 2. Let the user choose

Describe the alternatives in plain words (what changes, whether it adds new blockers). The before/after board data is in the printed `09-revise/<number>/board.json`. The user picks one, or keeps the current one.

```bash
npm run stamp -- --run out/my-site --pick a --revise-pick 1:v2
```

The value is `<number>:<alternative id>` exactly as printed (`고르려면:` line). A **section** swaps the block; an **axis**, colour value or type value replaces the recipe head of that candidate; **remove**, **add** and **order** change the page's section list (the texts move with their sections); **copy** writes the chosen texts into `04-content.json`. The tool then prints `낡은 단계: 06·07`: the pages and the quality gates are rebuilt by the next stamp run, so follow the `다음:` line it prints and run that command. If instead it prints `대기:` and exits with code 3, a new block still needs its screen texts: write them by following `factory/stamp/COPY.md`, then run the same command again.

## When the choice does not show up

- A line `주의:` under an alternative (or in the `--revise-pick` output) means that design cannot hold the current text, usually a heading that is too long (for example `제목을 5자 이하(한글 기준)로 줄이면 됩니다`). Tell the user before they pick. If they still want it, revise the copy first ("히어로 제목 짧게"), then pick.
- After the rebuild, a line starting `경고: 수정으로 고른` means step 06 drew another design for that section, with the reason. Tell the user; never report the change as done.
- `04-content … (stale)` or `대기:` after a pick means some texts must be written again for the new structure: follow `factory/stamp/COPY.md`, then run the printed `다음:` command again until it ends with 0 or with the legal-review wait (exit 3).

## Limits to say out loud

- A copy alternative is refused (nothing is written) when its text breaks the content checks (length, tone, example-text mark). The tool prints the problems; fix the answer file and run the same command again.
- A new block may arrive without its on-screen texts. It then shows "example text left" as a blocker until the copy is written.
- The user's choice is remembered on this computer only (`preferences.json`, in the folder named by `CLAUDE_PLUGIN_DATA` if set, otherwise `~/.factory`). Nothing is sent anywhere.
