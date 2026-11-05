# Finish review: file format

Two files per round, in `<run>/<pick>/09-review/`. The kit reads them with a strict parser (`factory/stamp/finish-review.mjs`); a file that breaks these rules is rejected and the round is asked for again. Write plain text only, one line per value.

## `review-<n>.md`

```
# Review 1
disposition: fix

## F1
where: hero / 375px
problem: The title runs into the logo.
prescription: revise "make the hero calmer"

## F2
where: header
problem: The logo is too small to read.
prescription: human Send a larger logo file.
```

- Line 1 is `# Review <n>`; `<n>` is the round and must match the file name.
- `disposition:` is required, once, before the first finding. The value is one of:
  - `ship`: nothing to fix. There must be no finding.
  - `fix`: every finding can be fixed with a `revise` prescription. At least one finding.
  - `rebuild`: the site does not fit the brief or a finding needs a person (`human`). This stops the automatic loop.
  - `recapture`: the screenshots are missing or cut off, so you cannot judge. No finding is needed.
- A finding is a block that starts with `## F<number>`: `F1`, `F2`, and so on, each once.
- A finding has exactly three lines, all required and not empty: `where:`, `problem:`, `prescription:`.
- `prescription:` is `revise "<one sentence>"` (straight double quotes) or `human <one line for the person>`. The `human` line may be left empty after the word `human`.
- One finding, one prescription. If one finding needs both a `revise` and a person, write `human`.

## `verdict-<n>.md`

Written after the fixes were rebuilt. One status per finding of `review-<n>.md`.

```
# Verdict 1
F1: resolved
F2: unresolved
regression: The footer is cut off on mobile.
```

- Line 1 is `# Verdict <n>`.
- One line `F<number>: resolved|partial|unresolved` per finding. A finding without a line counts as unresolved.
- `regression: <one line>` once per new problem the fixes caused. Leave the line out when there is none.

## What the kit does next

`ship` ends the loop. `fix` applies each `revise` prescription, rebuilds once, and asks for a verdict. After a verdict where every finding is `resolved` and there is no regression, the loop ends; otherwise a second round starts, and after the second round a person decides. `rebuild`, any `human` prescription and a second `recapture` stop the loop and wait for a person.
