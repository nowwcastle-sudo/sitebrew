# create-sitebrew

Downloads [Sitebrew](https://github.com/nowwcastle-sudo/sitebrew) at its release tag `v0.1.0` and prints the next steps. Windows 10 and 11.

```powershell
npx create-sitebrew sitebrew
```

| Option | What it does |
|---|---|
| `[folder]` | Where Sitebrew goes (default `sitebrew`). Spaces and Korean characters are fine; keep the quotes. |
| `--dry-run` | Changes nothing. Prints what it would install and run. |
| `--yes` | Answers yes to the install questions. |
| `--tool claude\|codex\|both` | Which agent gets the Sitebrew plugin. |
| `--ref <tag>` | Another release tag (default `v0.1.0`). |

It asks before it installs anything. Missing Git or Node.js (`>=24.13.0`) is installed with winget only after you say yes. No API key is needed: without keys Sitebrew runs in preview mode.

After it finishes, open Claude Code in the folder and type `/sitebrew:new`. In Codex, ask it to use the sitebrew new skill.

The full guide is the repository README: https://github.com/nowwcastle-sudo/sitebrew#readme

---

## 한국어

Sitebrew 를 릴리스 태그 `v0.1.0` 로 내려받고 다음에 할 일을 알려 줍니다. Windows 10·11.

위 명령 한 줄이면 됩니다. 무엇을 설치하기 전에는 먼저 묻습니다. `--dry-run` 은 아무것도 바꾸지 않고 할 일만 보여 줍니다. API 키가 없어도 미리보기 모드로 돌아갑니다.

끝나면 그 폴더에서 Claude Code 를 열고 `/sitebrew:new` 를 입력하세요. Codex 에서는 「sitebrew new 스킬을 써 줘」라고 말하면 됩니다.

## License

MIT
