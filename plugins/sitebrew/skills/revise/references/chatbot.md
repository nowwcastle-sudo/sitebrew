# Revise in chatbot mode

This window ran nothing and changes nothing. The user runs every command on their own computer, in the `sitebrew` folder, and pastes the output back. Follow `SKILL.md` with these differences.

1. Help the user word the request in one sentence (what, where, how much) and read it back as only a reading. Ask for the run folder name and the candidate letter; never use example values.
2. Give each command with its placeholders filled by the user's answers, for the user to paste. Say what they should see: for Classify a JSON block and a `해석:` line; for Build alternatives and a `고르려면:` line, or a `질문:` line. Ask them to paste the output back. After Build, ask them to open `compare.html`.
3. Read the pasted output as in `SKILL.md`. For an exit code or marker line its steps do not handle, use the exit-code table the skill loads with it.
4. On a `대기:` line this window cannot write the copy file: tell the user to give that output to Claude Code or Codex in the `sitebrew` folder, which follows `factory/stamp/COPY.md`; then they run the same command again.
5. Give the pick command only after the user names an alternative, and the undo command only after the user asks to undo. After a pick or an undo, give the rebuild command of Choose.
