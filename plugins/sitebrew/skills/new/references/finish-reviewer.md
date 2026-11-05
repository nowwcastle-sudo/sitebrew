# Finish reviewer for agents without sub-agents (Codex)

Claude Code runs the finish review in a separate sub-agent (`agents/sitebrew-finish-reviewer.md`), so the reviewer starts with a clean context and does not see how the site was built. Codex has no sub-agents. In Codex you do the review yourself, in the same session.

**Say this to the user once, before you start:** "This review is done by me in the same session that built the site, not by an independent reviewer, so it can repeat my own blind spots."

Then follow the same rules as the sub-agent:

1. Collect the screenshots listed by the kit (the paths in `<run>/<pick>/07-qa/ux/<page>/gate/`: `hero-1440-light.png`, `hero-1440-dark.png`, `hero-375-light.png`, `hero-375-dark.png`, `hero-768-light.png`, and the first `tile_<width>_<nn>.png` files). Home page first; at most 24 images.
2. Open each image and judge only what you see. Do not read the site source while you judge, and do not use what you remember about how a section was built.
3. Follow `agents/sitebrew-finish-reviewer.md`: the sections "What to look at", "Prescriptions" and "Verdict mode" are the instructions for this task. Read that file as text; ignore its `tools` header.
4. Write the result to `<run>/<pick>/09-review/review-<n>.md` (or `verdict-<n>.md`) in the review file format that SKILL.md links. Then run the finish-review command again; it prints one `REVIEW <action> <round>` line that tells you the next step.
