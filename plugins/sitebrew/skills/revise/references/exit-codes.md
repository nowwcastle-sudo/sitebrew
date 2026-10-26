# Exit codes and marker lines of the revise commands

Read this when a command ended with an exit code its step did not expect, or printed a marker line the step does not handle. The `질문:` line is handled in the Classify step of `SKILL.md`, not here.

## Every command

- Exit code 1: the tool failed (the output starts `도구 실패:`), or the run folder has no built site yet (stage 06 is missing: run the stamp command of the `new` skill first). Report the last lines. After a second failure with the same cause, stop.
- Exit code 2: wrong arguments. `--revise-readings` also gives 2 for bad JSON or a reading outside the dictionary (`읽기 입력이 틀렸다:` and `문제` lines), and `--redraw-wider` when there is no earlier run to redo. Exit code 2 changes nothing.
- Exit code 3 is not an error: the tool waits for a person or for the agent. A `참고:` line or a log line may come first.

## Exit code per command

| Command | Exit code 0 | Exit code 3 |
|---|---|---|
| `--revise "<text>"` | Alternatives built: a `고르려면:` line | A marker below, or a `질문:` line |
| `--revise "<text>" --explain` | never | Always: JSON and a `해석:` line, or `질문:` |
| `--revise-readings '<json>'` | never | Success: alternatives and a `고르려면:` line, or a marker below |
| `--revise-pick <number>:<id>` | The pick is applied | A marker below |
| `--revise-pick <number>:none` | never | Always: a question about what should be different |
| `--revise-undo` | The latest change is undone | `되돌릴 수정이 없어요.` or `There is no change to undo.` (nothing changed; tell the user) |
| `--redraw-wider` | The directions are drawn again | Nothing changed. Either the directions cannot be spread more (offer a specific change instead), or an applied change is still active (undo it first, then ask again) |

## Marker lines on an exit code 3

| The output shows | Do |
|---|---|
| `대기:` for copy (`문구 수정 요청`, `새 블록의 화면 문구 칸 요청` or `04-content …`) without `문제` lines | Texts must be written. Open `factory/stamp/COPY.md` only now, write the answer file it names, then run the same command again (after a pick: the rebuild the `다음:` line names, until it ends with 0 or with another marker). |
| `문구 응답이 검사에서 떨어졌다`, or `문제` lines (length, tone, example-text mark) under a `대기:` line | The answer failed the content checks and nothing was written to the site. Fix the answer file named in the output, then run the same command again. |
| `대기: 법률 검토` (only in a rebuild) | A legal review file is needed. This is expected, not a failure: follow `factory/legal/AGENT.md`; do not retry before it is written. |
| `이 안을 만든 뒤에 사이트가 바뀌어서 지금과 맞지 않아요…` | The site changed after these alternatives were built (a pick or an undo). Nothing changed. Build them again with the same words, then pick from the new board. |
| Anything else | Report the output verbatim. Change nothing. Do not retry. |
