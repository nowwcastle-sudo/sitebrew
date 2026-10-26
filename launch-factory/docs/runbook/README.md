# 운영 런북 원천 — 규약

*Runbook sources — conventions. English follows the Korean part.*

이 폴더는 sitebrew 런북(사이트를 실제로 쓰기로 정한 뒤 무엇을 등록·설정할지 알려 주는 안내)의 **원천**이다. 사람이 쓰는 것은 장 글(`*.md`)·카드(`cards/<gid>.json`)·대안(`alternatives/<role>.json`)·`rubric.json`·`secret-shapes.json` 이고, `runbook.generated.json` 은 생성물이다. web-factory 와 플러그인은 생성물만 읽는다.

- **전문가용은 장 글을 그대로 보여 주고, 초보자용은 장 글을 풀어 쓴다.** 그래서 장 글에 있는 사실(기다리는 날수·고칠 수 없다는 경고·순서)이 초보자용의 한계다. 장 글에 없는 것은 초보자용에도 없다.
- 생성: `npm run runbook:gen` (`-- --check` 는 쓰지 않고 다르면 종료 1). 대조: `npm run runbook:check` (`-- --partial` · `-- --fresh <일>` · `-- --today YYYY-MM-DD`).
- `npm run ci:verify` 의 `runbook` 단계 = `npm run runbook:verify`(생성물 최신 + 교차 검사). 엄격 모드다 — 새 부품이 `guides` 를 더하면 장·카드도 같이 더해야 통과한다. 장이 아직 없을 때만 `-- --partial` 로 로컬에서 돌린다.
- 생성물은 손으로 고치지 않는다. 병합 충돌이 나면 원천을 합친 뒤 `npm run runbook:gen` 을 다시 돌린다.

## 1. 장 글 (`*.md`, 이 README 는 제외)

- 파일 하나에 장 여럿. 한국어 부분 → **줄 전체가 `---` 인 줄**(코드 블록 밖, 표의 `|---|` 는 아니다) → English 부분. 구분선이 없으면 검사가 실패한다.
- 장 = `## G-xxx — 제목`. 장 id 는 `G-` 뒤 소문자 낱말을 `-` 로 잇는다(`G-biz-kr`). 영어 부분은 `## G-xxx` 만 써도 된다(제목 생략). 같은 언어 안에서 같은 id 를 두 번 쓰지 않는다.
- 첫 `##` 앞의 머리말은 장도 공유 절도 아니다(문서 소개).
- `G-` 로 시작하지 않는 `##` 절(예: `## 0. mock 과 live`, `## 1. 환경 변수`)은 **그 파일의 공유 절**이다. 그 파일의 모든 장이 공유 절의 환경 이름을 물려받는다(범위 검사용). 초보자용이 반드시 말할 이름(`mustName`)은 **장 본문**의 이름뿐이다.
- 장 안의 항목 순서: 왜 필요한가(한 문장) → 준비물 → 등록 → 설정 → 확인 → 막힘(흔한 이유 2~4개) → 출처.
  - **등록·설정 칸은 행동 수를 센다**(초보자용 단계 수의 기준). 세는 모양 둘: 목록 줄 `- 등록 1 — …` · `- 설정: …`(영어 `Register`·`Config`) 하나에 하나, 또는 `### 등록`·`### 설정` 제목 아래 목록 줄 하나에 하나. `- 등록: 없음.`(영어 `Register: nothing.`)은 세지 않는다. 등록할 것이 없으면 「등록: 없음」으로 두고 단계를 지어내지 않는다.
- **환경 변수 이름은 따로 적지 않는다.** 백틱 안의 `UPPER_SNAKE` (예: `RESEND_API_KEY`)와 코드 블록 안의 같은 모양 낱말을 생성기가 읽는다. 값은 쓰지 않고 이름과 넣을 곳(호스팅 대시보드, `vercel env add <이름>` 표준 입력)만 쓴다.
- 사실은 공식 1차 출처에서 확인하고 「출처」 항목에 적는다. 못 찾으면 쓰지 않고 「[확인 안 됨]」으로 둔다. 확인한 날은 카드에만 적는다.
- **쓰지 않을 것:** 버튼 글자를 단정하는 문장(「‘새 프로젝트’나 ‘만들기’처럼 보이는 버튼」 정도로만) · URL 경로(서비스 홈 도메인만) · 화면 캡처 · 금액·수수료 숫자 · 키·토큰 값.

## 2. 카드 (`cards/<gid>.json`, 파일 하나 = 장 하나)

| 칸 | 뜻 |
|---|---|
| `service` | 서비스 이름 |
| `role` | 역할(소문자·`-`). 대안 파일 이름과 같다 |
| `need` | `always`(모든 사이트) · `feature`(고른 기능의 장) · `optional`(`when` 이 맞을 때) |
| `cost` | 비용 종류 하나 이상: `none` · `free-tier` · `usage` · `monthly` · `per-sale` · `one-time`. 금액은 쓰지 않는다 |
| `after` | 먼저 끝내야 할 장 id 목록(순서는 생성기가 위상 정렬, 순환은 실패) |
| `home` | 선택. `https://도메인` 만(경로 없음) |
| `checked` | 확인한 날 `YYYY-MM-DD`(오늘 이하). 90일이 지나면 런북 안에서 오래됨 경고 |
| `ifSkipped` | `{ ko, en }` 건너뛰면 무엇이 안 되는지 |
| `when` | 선택. `{ outcomes?: 성과 id[], locale?: "ko"\|"en" }` — 적힌 조건이 **모두**(AND) 맞을 때 넣는다. `locale` 은 사이트의 언어 |
| `devOnly` | 개발·mock 전용 이름(초보자용이 말하지 않아도 된다). 비어도 칸은 둔다 |
| `notEnv` | 백틱 안 대문자 낱말이지만 환경 변수가 아닌 것(예: `MARKETING_OPT_OUT_NUMBER`). 비어도 칸은 둔다 |

## 3. 대안 (`alternatives/<role>.json`, 배열)

항목: `service` · `tags`(`free` · `cheaper` · `better` · `ko` — 공식 가격·기능 쪽으로 근거를 확인한 것만) · `support`(`builtin` 이 키트에 있다 · `code` 어댑터 코드가 필요 · `no` 맞지 않음) · `item`(`builtin` 일 때만, `features/outcomes.yaml` 의 부품 이름 — 어떤 성과의 부품·closure 로 닿아야 한다) · `switchCost`·`note`(`{ ko, en }`) · `home`(선택) · `checked`. 금액은 쓰지 않는다.

## 4. 검사 (`npm run runbook:check`)

1. `features/outcomes.yaml` 의 모든 `guides` id 에 장 글과 카드가 있다.
2. 장 없는 카드 없음 · `after` 가 모르는 id 를 가리키지 않음 · 순환 없음.
3. 장의 환경 이름은 성과의 `needs` 나 레지스트리 `envVars` 에 있다(`devOnly`·`notEnv` 예외) — 오탈자 방지.
4. 성과의 `needs` 가 그 성과의 장(+ `always` 장) 어딘가에 있다(`uncovered` 가 비어야 한다).
5. 대안: 파일 이름 = 카드의 역할, `support`·`tags` 값, `builtin` 은 어떤 성과에 닿는다.
6. 장 글·카드·대안에 금액 모양이 없다.
7. 장 글·카드·대안·`rubric.json` 에 `secret-shapes.json` 의 키 모양이 없다. 키 모양 정규식은 이 표 한 곳뿐이다.
8. 확인일은 오늘 이하. `--fresh <일>` 이면 확인일 + 일수가 지난 항목이 있을 때 실패(출시 점검용).

모든 장이 모이기 전에는 `--partial` 로 돌린다(1·4 가 경고). **새 부품이 `guides` 를 더하면 장 글과 카드를 같이 더한다** — 그렇지 않으면 1번이 실패한다.

---

# Runbook sources — conventions

This folder holds the **sources** of the sitebrew runbook (the guide to what to register and set up once a site will really be used). People write the chapter files (`*.md`), cards (`cards/<gid>.json`), alternatives (`alternatives/<role>.json`), `rubric.json` and `secret-shapes.json`. `runbook.generated.json` is generated. web-factory and the plugin read only the generated file.

- **The expert version shows the chapter text as is; the beginner version expands it.** So the facts in the chapter (waiting days, warnings that cannot be fixed, order) are the limit of the beginner version. What is not in the chapter is not in the beginner version either.
- Generate: `npm run runbook:gen` (`-- --check` writes nothing and exits 1 when different). Cross-check: `npm run runbook:check` (`-- --partial` · `-- --fresh <days>` · `-- --today YYYY-MM-DD`).
- The `runbook` step of `npm run ci:verify` runs `npm run runbook:verify` (generated file current + cross check). It is strict: a part that adds `guides` must add the chapter and card too. Use `-- --partial` locally only while a chapter is not written yet.
- Never edit the generated file by hand. On a merge conflict, merge the sources and run `npm run runbook:gen` again.

## 1. Chapter files (`*.md`, except this README)

- Several chapters per file. Korean part → **a line that is exactly `---`** (outside code blocks; a table's `|---|` is not one) → English part. Without the rule line the check fails.
- A chapter is `## G-xxx — title`. The id is `G-` followed by lowercase words joined by `-` (`G-biz-kr`). The English part may write just `## G-xxx` (no title). Do not repeat an id within one language.
- Text before the first `##` is an introduction, neither a chapter nor a shared section.
- A `##` section that does not start with `G-` (for example `## 0. mock vs live`, `## 1. Environment variables`) is the file's **shared section**. Every chapter in the file inherits its environment names (for coverage). The names a beginner text must mention (`mustName`) come from the **chapter body** only.
- Order of items in a chapter: why it is needed (one sentence) → what you need → register → configure → check → stuck (2–4 common reasons) → sources.
  - **Register and configure items count actions** (the basis for the beginner step count). Two shapes count: one per list line `- Register 1 — …` · `- Config: …` (Korean `등록`·`설정`), or one per list line under a `### Register` / `### Config` heading. `- Register: nothing.` (Korean `등록: 없음.`) does not count. When there is nothing to register, write that and do not invent steps.
- **Do not list environment names separately.** The generator reads `UPPER_SNAKE` inside backticks (for example `RESEND_API_KEY`) and words of the same shape inside code blocks. Write only the name and where to put it (host dashboard, `vercel env add <NAME>` stdin), never the value.
- Check facts against official primary sources and list them under "sources". If you cannot find one, leave it out or mark it "[not verified]". The check date goes only on the card.
- **Do not write:** exact button labels as facts (only "a button that looks like New project or Create") · URL paths (home domain only) · screenshots · amounts or fees · key or token values.

## 2. Cards (`cards/<gid>.json`, one file per chapter)

| Field | Meaning |
|---|---|
| `service` | Service name |
| `role` | Role (lowercase, `-`). Same as the alternatives file name |
| `need` | `always` (every site) · `feature` (chapter of a chosen feature) · `optional` (when `when` matches) |
| `cost` | One or more cost kinds: `none` · `free-tier` · `usage` · `monthly` · `per-sale` · `one-time`. No amounts |
| `after` | Chapter ids to finish first (the generator sorts them; a cycle fails) |
| `home` | Optional. `https://domain` only (no path) |
| `checked` | Day checked, `YYYY-MM-DD` (not after today). After 90 days the runbook shows a staleness warning |
| `ifSkipped` | `{ ko, en }` what does not work when skipped |
| `when` | Optional. `{ outcomes?: outcome id[], locale?: "ko"\|"en" }` — included only when **all** written conditions match (AND). `locale` is the site language |
| `devOnly` | Development or mock-only names (a beginner text may skip them). Keep the field even when empty |
| `notEnv` | Uppercase words in backticks that are not environment variables (for example `MARKETING_OPT_OUT_NUMBER`). Keep the field even when empty |

## 3. Alternatives (`alternatives/<role>.json`, an array)

Entries: `service` · `tags` (`free` · `cheaper` · `better` · `ko` — only when checked against an official price or feature page) · `support` (`builtin` in this kit · `code` needs adapter code · `no` does not fit) · `item` (only with `builtin`; a part name from `features/outcomes.yaml` that some outcome reaches through its parts or closure) · `switchCost`, `note` (`{ ko, en }`) · `home` (optional) · `checked`. No amounts.

## 4. Checks (`npm run runbook:check`)

1. Every `guides` id in `features/outcomes.yaml` has a chapter and a card.
2. No card without a chapter · `after` names only known ids · no cycle.
3. A chapter's environment names are in an outcome's `needs` or a registry `envVars` (except `devOnly`, `notEnv`) — catches typos.
4. Each outcome's `needs` appear in that outcome's chapters (+ `always` chapters) (`uncovered` must be empty).
5. Alternatives: file name = a card's role, valid `support` and `tags`, `builtin` reaches some outcome.
6. No amount shapes in chapters, cards or alternatives.
7. No key shape from `secret-shapes.json` in chapters, cards, alternatives or `rubric.json`. That table is the only place for key-shape patterns.
8. Check dates are not after today. With `--fresh <days>`, fail when an item is older than that.

Until every chapter exists, run with `--partial` (rules 1 and 4 become warnings). **When a new part adds `guides`, add the chapter and the card with it** — otherwise rule 1 fails.
