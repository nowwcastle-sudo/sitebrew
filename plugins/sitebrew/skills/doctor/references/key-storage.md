# Key storage: the plugin settings dialog (Claude Code only)

Load this when you explain way 1 of "Where to put key values" in SKILL.md, or when the doctor prints a `note env-bridge` line. Do not load it otherwise. It is part of the plugin build (copied with the skill).

- Claude Code keeps the options of the `sitebrew` plugin settings dialog in its secure credential store. At every session start a hook of this plugin copies each non-empty option into that session's shell, so restart Claude Code after changing an option.
- A variable the user already set in Windows wins over the option.
- A value that contains a single quote is not copied. The doctor prints a `note env-bridge` line.
- **PowerShell commands never receive a value that contains `/` or `\`** on Windows, so a folder such as `HIGGSFIELD_DIR` reaches Bash commands only. The doctor prints a `note env-bridge` line for it. For PowerShell set the plain variable yourself: `setx HIGGSFIELD_DIR "<folder>"`, then restart Claude Code.
- PowerShell receives the copied options only in Claude Code v2.1.296 or later. Test: restart, then run the doctor from PowerShell. If a key set in the dialog still shows `note <NAME>` (not set), that shell gets nothing: use way 2 (a plain environment variable).
- Tell the user the trade-off once: the copy is a plain-text file in the `session-env` folder of the user's own Claude profile, not in the secure store, and it is not removed automatically. Users who do not want that use way 2.
