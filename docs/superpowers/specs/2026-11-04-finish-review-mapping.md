# 마감 검수 → revise 매핑 조사 (v0.2.6 T11)

기준 커밋: 25f3fdf (v0.2.5). 코드 변경 없음. 이 문서가 T12·T13의 인터페이스를 확정한다.

## 0. 결론 먼저

1. revise가 처리하는 처방은 7갈래다. 문구 · 구획 빼기/넣기/순서 · 레시피 축(색·서체·모서리·그림자·대비·여백·모션) · 히어로 계열(방향만).
2. revise가 처리하지 못하는 것은 4가지다. 로고 크기 · 모바일 헤더 줄 수 · 이름 지정 히어로 변형 · 사실·사진. 이 넷은 `human` 처방이다.
3. 검수자는 `plugins/sitebrew/agents/sitebrew-finish-reviewer.md` 에 둔다. Claude Code는 `agents/` 를 자동으로 찾는다. 매니페스트는 바꾸지 않는다. Codex는 `skills/new/references/finish-reviewer.md` 의 같은 세션 역할 절로 대신한다.
4. 768 첫 화면 캡처 한 장만 `ux-gate.mjs` 에 더한다. 쪽 전체 높이 캡처는 이미 타일(`tile_<폭>_<nn>.png`)로 있다. 더하지 않는다.
5. 한 라운드는 약 25~30분, 2라운드는 약 1시간이다. 기록된 W1b 시간에서 계산한 값이며 이번에 새로 재지 않았다.

## 1. revise 어휘 전수

출처: `skills/revise/SKILL.md`, `references/exit-codes.md`, `factory/stamp/revise*.mjs`, `factory/vocab/design-lexicon.yaml`, `factory/stamp/handles.yaml`.

### 1.1 범위 4갈래 (`parseRevision`)

| 범위 | 말 예시 | 결과 |
|---|---|---|
| `section` | 「히어로를 더 대담하게」 · 「가격표를 차분하게」 | 같은 구획의 허용 변형 중 상위 n개를 교체안으로 낸다 |
| `copy` | 「히어로 문구 더 짧게」 · 「따뜻하게」 · 「격식 있게」 | 에이전트가 `copy.response.json` 을 쓴다. revise는 LLM을 부르지 않는다 |
| `remove` / `add` / `order` | 「FAQ 빼줘」 · 「후기 추가」 · 「가격을 소개 위로」 | 구조 조작 (`revise-structure.mjs`) |
| `design` | 「색을 초록색으로」 · 「모서리 더 둥글게」 | 레시피 머리 사본을 옮긴 안 a·b |

### 1.2 구조 조작 제약

- 필수 구획(원형 `required`)은 못 뺀다. 되묻는다.
- 쪽에 구획이 하나도 안 남는 빼기는 못 한다.
- 히어로는 항상 첫째, 푸터 같은 전역 구획은 마지막이다. 옮기지 못한다.
- 순서 바꾸기는 같은 쪽 안에서만 된다.
- 넣기는 원형이 허용한 선택 블록 구획만 된다. 이미 있으면 되묻는다.
- 사실이 있어야 그려지는 구획(`FACT_GATED`)은 사실 없이 못 넣는다. 지금: local `home/notice` · local `product-detail/bookable-item` · portfolio `home/about`.
- 안 개수: remove·order는 1, add는 허용 변형 상위 2.

### 1.3 디자인 축 12개와 손잡이

| 축 | kind | 칸 | 구획 범위 |
|---|---|---|---|
| color-hue | value | 주색 | 안 됨 (사이트 전체) |
| color-lightness · saturation · temperature | palette | 팔레트 후보 | 안 됨 |
| palette-count | rank | `colorLogic` | 안 됨 |
| type-family | value | 서체 범주 | 안 됨 |
| type-scale | order | `axes.display` (D1~D3) | 됨 (element 「제목」 포함) |
| shape | order | `axes.radius` (R0~R3) | 안 됨 |
| depth | rank | `axes.shadow` (S0~S3) | 됨 |
| contrast | rank | `axes.surface` | 됨 |
| spacing | order | 여백 | 됨 |
| motion | order | M0~M3 | 됨 |

구획 범위는 사전 `sectionIntent` 가 있는 축만 된다. 그 축은 변형 교체로 처리한다 (`rankSection`).

### 1.4 어휘 밖 (손잡이가 없다)

- 헤더 축 H1~H5 (손잡이 없음).
- 질감 축 X · 디스플레이 축 D의 이름 지정 선택.
- 로고 크기.
- SiteShell의 접힘·줄 수 동작 (`ui-src/site-shell*.tsx`).
- 이름으로 고르는 히어로 변형 (`rankSection` 이 순위로 고른다).

### 1.5 되묻기와 종료 코드

- 종료 3은 오류가 아니다. 입력 대기다 (안 고름 · 문구 대기 · 되묻기).
- 못 읽은 말(근사·모름)은 80자 미만 질문 하나만 돌려주고 아무것도 바꾸지 않는다.
- 맞출 수 없는 색(노랑·베이지·흰색 …)은 안을 만들지 않고 「비슷한 색으로 바꿀까요?」 로 되묻는다.
- 배경·글자 색을 말하면 주색만 바꾼다고 되묻는다.

## 2. 검수 소견 유형 → revise 처방표

처방 `kind` 는 `revise` 아니면 `human` 이다. `command` 는 `--revise` 에 넘길 한 문장이다.

| # | 소견 유형 | kind | command 형태 | 비고 |
|---|---|---|---|---|
| 1 | 문구가 길다 · 약하다 · 어색하다 | revise | `<구획> 문구를 더 짧게` · `…따뜻하게` · `…격식 있게` | 에이전트가 응답 파일을 쓴다. 사람 대기가 아니다 |
| 2 | 구획 순서가 어색하다 | revise | `<구획A>를 <구획B> 위로` · `<구획>을 맨 위로` | 같은 쪽만. 히어로·푸터는 `human` |
| 3 | 불필요한 구획 | revise | `<구획> 빼줘` | 필수 구획이면 `human` |
| 4 | 빠진 구획 | revise | `<구획> 추가해줘` | 사실 필요 구획이면 `human` (사실 입력) |
| 5 | 주색이 맞지 않는다 | revise | `색을 <이름>으로` · `메인 색을 #RRGGBB로` | 이름 표 14색 + 6색. 노랑·베이지·흰색은 되묻기 → `human` |
| 6 | 색이 칙칙하다 · 너무 튄다 · 차갑다 | revise | `색을 더 밝게` · `채도를 낮춰` · `따뜻하게` | palette 축 |
| 7 | 서체 인상이 맞지 않는다 | revise | `서체를 명조로` · `제목을 더 크게` | 서체 이름이 키트에 없으면 `human` |
| 8 | 모서리·그림자 인상 | revise | `모서리를 더 둥글게` · `그림자를 줄여` | 호환표 위반은 함께 옮겨 고친다 |
| 9 | 대비가 약하다 (인상) | revise | `대비를 높여줘` | 축 contrast. 측정 대비 실패는 a11y 관문 몫이라 검수 소견이 아니다 |
| 10 | 여백이 답답하다 · 휑하다 | revise | `여백을 더 넓게` · `더 촘촘하게` | 구획 범위 가능 |
| 11 | 움직임이 과하다 · 부족하다 | revise | `움직임을 줄여` | M0~M3 |
| 12 | 히어로 계열이 안 맞는다 | revise | `히어로를 더 대담하게` · `차분하게` | 방향만 말한다. 특정 변형 이름은 못 고른다 → 그 요구는 `human` |
| 13 | 로고가 작다 · 크다 | human | — | 손잡이 없음. 로고 파일 교체는 사람 몫 |
| 14 | 모바일 헤더가 두 줄 이상 | human | — | 헤더 축 H·SiteShell 접힘 코드 몫. 코드 수정은 06 열쇠가 바뀐다 → 이번 라운드 밖 |
| 15 | 사진 없음 · 품질 낮음 · 실제 사진 필요 | human | — | 입력 대기 사유 |
| 16 | 사실 오류 · 자리표시 남음 | human | — | 사실은 브리프 몫 |
| 17 | 레이아웃 깨짐 · 겹침 · 잘림 | human | — | 코드 결함이다. 보고서에 남긴다 |
| 18 | 원형이 맞지 않는다 | human | — | 판정 `rebuild`. 새 브리프 필요 |

규칙:

- 소견 하나는 처방 하나다. 한 소견이 revise와 human에 걸리면 human으로 둔다.
- `human` 처방이 하나라도 있으면 `nextStep` 은 `ask-human` 이다. 자동 라운드를 돌리지 않는다.
- 같은 구획에 처방이 여럿이면 한 번에 적용하지 않는다. 라운드 안에서 순서대로 적용하고 매번 새로 읽는다. 구획이 다르면 한 라운드에서 함께 적용해도 된다.

## 3. 검수자 위치 · 에이전트 지원

### 3.1 조사 결과

- Claude Code 플러그인은 플러그인 루트의 `agents/` 를 자동으로 찾는다. `plugin.json` 의 `agents` 키는 필요 없다. 키를 쓰면 자동 탐색이 꺼진다.
- 에이전트 이름은 `sitebrew:<이름>` 이다.
- 쓸 수 있는 frontmatter: `name` · `description` · `model` · `effort` · `maxTurns` · `tools` · `disallowedTools` · `skills` · `memory` · `background` · `omitClaudeMd` · `isolation` (`worktree`만) · `color`.
- 무시되는 필드: `permissionMode` · `hooks` · `mcpServers` · `initialPrompt`.
- Codex 매니페스트(`.codex-plugin/plugin.json`)는 `skills` 와 `interface` 뿐이다. 에이전트가 없다.
- 현재 `plugins/sitebrew/` 에 `agents/` 가 없다. `plugin.json` 은 건드릴 것이 없다.
- `plugins/sitebrew/test/contract.test.mjs` 는 `skills/` 의 `.md` 만 훑는다. `agents/` 파일이 있어도 깨지지 않고, 안의 명령은 검사하지 않는다. T14에서 에이전트 파일의 `npm run` · `node factory/…` 도 같은 검사에 넣는다.

### 3.2 결정

| 대상 | 위치 | 내용 |
|---|---|---|
| Claude Code | `plugins/sitebrew/agents/sitebrew-finish-reviewer.md` | 새 컨텍스트의 검수자. 도구는 `Read` 만 준다 (`tools: Read`). 이미지를 읽고 `review-<n>.md` 본문을 돌려준다. 파일은 호출한 쪽이 쓴다 |
| Codex | `plugins/sitebrew/skills/new/references/finish-reviewer.md` | 같은 세션 역할 절. 같은 형식을 지시한다. 새 컨텍스트는 없다. 한계는 절 맨 위에 적는다 |

- 새 컨텍스트 검수자를 쓰는 이유: 만든 쪽이 자기 결과를 보면 같은 가정을 반복한다.
- 두 파일은 형식 절(소견 줄 · 판정 줄)을 공유한다. 형식 정본은 `parseReview` 한 곳이다. 본문을 복사하지 않고 한 참조 파일(`references/review-format.md`)을 둘 다 가리킨다.
- 에이전트가 `model` 을 갖는지는 T14에서 정한다. 이 문서는 강제하지 않는다.

## 4. ux-gate 캡처 (768 · 전체 높이)

### 4.1 현재

- `hero-{1440,375}-{light,dark}.png` — 첫 화면.
- `tile_<폭>_<nn>.png` — 라이트 전용 뷰포트 타일. 폭당 최대 14장. 넘치면 `truncated: true`.
- 위치: `<후보>/07-qa/ux/<slug>/gate/`.
- 768 캡처는 없다.

### 4.2 결정

- 쪽 전체 높이: **더하지 않는다.** 타일이 이미 전체를 덮는다. `collectReviewInputs` 가 타일을 이어서 읽는다. `truncated` 이면 소견에 「일부만 봄」 을 남긴다.
- 768 첫 화면: **더한다.** `hero-768-light.png` 한 장만. 모바일↔데스크톱 사이 깨짐(헤더 접힘 경계)은 375·1440 사이에서만 보이기 때문이다.
- 변경 범위: `factory/qa/ux-gate.mjs` 하나. 판정에 쓰지 않는 참고 캡처다. 종료 코드·`report.json` 판정은 바뀌지 않는다.
- 06 코드 열쇠 영향: 없다. `ux-gate.mjs` 는 열쇠 밖이다.
- 07 캐시 영향: 없다. 07 입력 해시는 `{pages, legal hashes}` 뿐이다. 새 캡처는 07이 다시 돌 때만 생긴다. 이미 끝난 실행에는 768 캡처가 없다. `collectReviewInputs` 는 없어도 던지지 않고 `kind` 목록에서 뺀다.
- 이미지 예산: 검수 입력은 쪽당 `hero` 4장 + `768` 1장 + 타일 최대 4장으로 자른다. 쪽이 많으면 홈과 주 전환 쪽을 먼저 넣는다. 기본 상한은 24장이다. 넘으면 `blockers` 에 「일부 쪽 생략」 을 남긴다.

## 5. 라운드 비용

기록된 값(CLAUDE.md W1b 실측, 부하 있는 PC). 이번에 새로 재지 않았다.

| 단계 | 시간 |
|---|---|
| 06 첫 후보 (템플릿 설치 포함) | 10~23분 |
| 고른 안 06 다시 (템플릿 데워짐) | 약 7.2분 |
| 07 한 후보 | 5~13분 |

### 5.1 CLI 경로의 비용

`--revise` 는 안 n=2 를 모두 06 + 07으로 만든다. 처방 하나에 안마다 약 7분 + 07 일부가 든다. 처방 하나가 약 15~20분이다. 처방 3개를 CLI로 돌리면 한 시간이 넘는다. 자동 경로에 쓰지 않는다.

### 5.2 자동 경로 (권고)

`revise()` 모듈 API를 `{ n: 1, install: false }` 로 부른다. 설치·빌드·07이 없다. 파일만 만든다. 그 뒤 고른 안을 적용하고 06·07을 **한 번만** 다시 돈다.

| 단계 | 시간 |
|---|---|
| 검수 (이미지 읽기, 에이전트) | 약 3~5분 (추정) |
| 처방 적용 (`install:false`, `n:1`, 처방 수만큼) | 수초~수십초 |
| 고른 안 적용 + 06 다시 | 약 7분 |
| 07 다시 | 5~13분 |
| 판정 검수 | 약 3~5분 (추정) |
| **한 라운드** | **약 20~30분** |
| 2라운드 (상한) | 약 40~60분 |

- 문구 처방은 에이전트가 응답 파일을 쓰므로 에이전트 시간이 더 든다. 처방당 1~2분 (추정).
- 처방이 구획을 겹치게 건드리면 한 번에 적용하지 않고 라운드를 나눈다. 비용이 한 라운드 늘 수 있다.
- 보드 전체(3안)에 검수를 돌리면 3배다. 검수는 고른 안 하나에만 돈다.

### 5.3 확인 필요 (T13 시험에서)

- `install:false` 로 만든 제안에 `applyAxis` 경로가 `recipe/DESIGN.md` 사본을 제대로 남기는지.
- `install:false` 에서 `titleOverflow` · `reviseFallbacks` 경고가 나오는지. 안 나오면 06 다시 돈 뒤 판정 검수가 잡는다.

## 6. T12 · T13 인터페이스 확정

### 6.1 T12 `factory/stamp/finish-review.mjs` (순수 모듈)

```
collectReviewInputs(runDir, pick)
  → { shots: [{ path, width, kind }], head, brief, blockers }
```
- `kind`: `hero-light` · `hero-dark` · `hero-768` · `tile`.
- `width`: 375 · 768 · 1440.
- `head`: 선택 후보의 레시피 머리 요약(축 값). `brief`: 브리프 사실. `blockers`: `candidate.json` 공개 불가 사유.
- 이미지는 4.2 예산으로 자른다. 파일을 못 읽으면 던지지 않고 목록에서 뺀다. 한 장도 없으면 `shots: []`.

```
parseReview(md)
  → { round, disposition: 'ship'|'fix'|'rebuild'|'recapture',
      findings: [{ id, where, problem, prescription: { kind: 'revise'|'human', command?, note? } }] }
```
- 형식이 어긋나면 `ReviewFormatError` 를 던진다.
- `kind: 'revise'` 는 `command` 가 필수다. `human` 은 `command` 가 없다. `note` 는 선택 (사람이 할 일 한 줄).
- `disposition`: 소견 0이면 `ship`. `revise` 처방만이면 `fix`. `human` 처방이나 원형 불일치면 `rebuild`. 캡처 부족·잘림이면 `recapture`.

```
parseVerdict(md)
  → { round, results: [{ id, status: 'resolved'|'partial'|'unresolved' }], regressions }
```
- `regressions`: 새로 생긴 문제 줄 목록 (문자열 배열). 없으면 `[]`.

파일: `<run>/<pick>/09-review/review-<n>.md` · `verdict-<n>.md`. 라운드 번호 `n` 은 1부터다.

### 6.2 T13 `factory/stamp/finish-loop.mjs`

```
nextStep(runDir, pick) → { action: 'review'|'apply'|'verdict'|'ask-human'|'done', round }
```
stdout 한 줄: `REVIEW <action> <round>`.

판정 순서:

1. `review-<n>.md` 없음 → `review`.
2. `review-<n>.md` 있고 `disposition` 이 `ship` → `done`.
3. `human` 처방이 있거나 `disposition` 이 `rebuild` → `ask-human`.
4. `fix` 이고 적용 전 → `apply`. 적용 뒤 `verdict-<n>.md` 없음 → `verdict`.
5. `verdict` 에 `unresolved` · `partial` · `regressions` 가 있고 `n < 2` → 다음 라운드 `review`.
6. 같은 조건에서 `n = 2` → `ask-human`. 전부 `resolved` 이고 `regressions` 가 없으면 `done`.
7. `recapture` → 같은 라운드 `review` 한 번. 연속 두 번째면 `ask-human`.

- 자동 상한은 2라운드다.
- 사람 대기 지점은 새로 만들지 않는다. 자동 찍어내기 경로는 `ask-human` 을 출력할 뿐 멈추지 않는다. 사람 대기는 `--finish-review` 를 명시한 경로에서만 일어난다 (설계 A6).
- 종료 3은 오류가 아니다 (`revise` 와 같다).
- 적용은 `revise(runDir, pick, request, { n: 1, install: false })` → 안 적용 → 06·07 한 번. 문구 처방은 에이전트가 응답 파일을 쓴다.

### 6.3 06 코드 열쇠 안전

새 파일은 모두 06 코드 열쇠 밖이다.

- `factory/stamp/finish-review.mjs` · `finish-loop.mjs` — 열쇠 밖.
- `factory/qa/ux-gate.mjs` 768 캡처 — 열쇠 밖.
- `plugins/sitebrew/agents/*` · `skills/new/references/*` — 열쇠 밖.

`node factory/scripts/print-pages-key.mjs` 로 변경 전후 열쇠가 같은지 T12·T13 PR마다 확인한다.

## 7. 남은 위험

- 검수 에이전트의 이미지 판독 품질은 이 조사로 알 수 없다. T15 골든 1건으로 본다.
- 처방 어휘가 사용자 말 사전에 없는 말로 쓰이면 `parseRevision` 이 되묻는다. 검수자 지시서에 허용 문장 목록을 넣는다 (T14).
- `human` 처방이 많은 사이트는 자동 라운드를 못 돈다. 이것은 설계된 동작이다.
