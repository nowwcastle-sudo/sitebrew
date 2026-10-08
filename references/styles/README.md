# references/styles/ — UI 스타일 사전 (P3-2 Task 15m, 2026-09-29)

운영자 요청(2026-09-29 16:53): 「UI 스타일 … sns(x, insta, thread)나 검색 엔진에서 찾아서 web-factory에 등록해. … 좋아요나 조회수 등 선호도를 알 수 있는 정량적 요소를 통해 선별해서 찾은 다음 등록하면 돼.」

`styles.json` 한 파일에 스타일 62개와 새 축 값 제안 8개(Task 16a 뒤 — 구현된 7개는 `implemented`)가 있다. 코드에 들어간 스타일 축(B·I·C·T·H·R·S, `registry/factory/styles/`)과 달리, 이 파일은 **이름 있는 스타일이 어느 축 값 조합으로 만들어지는지**와 그 인기 근거를 적은 레퍼런스다. 접합면 J4의 정본이다. Task 16a `style-presets.mjs`가 `allow`·`allow-with-rules` 스타일을 프리셋으로 바꾸고, `ban`은 레시피에 쓰지 않는다.

| 판정 | 수 | 스타일 |
|---|---|---|
| `allow` | 7 | corporate-trust · flat-design · krds-public · micro-interaction · monochrome · narrow-document · split-screen |
| `allow-with-rules` | 46 | 조건(DESIGN §13·kill-ai-slop 번호)을 `verdictReason`에 적었다 |
| `ban` | 9 | aurora-mesh-gradient · cyberpunk · frutiger-aero · glassmorphism · liquid-glass · neon-glow · neumorphism · sci-fi-hud · terminal-mono |

## 출처

| 레인 | 수 | 원천(저장소 밖 `design-rules\factory\materials\`) |
|---|---|---|
| styles | 54 | `styles\candidates.jsonl` — One Page Love 등재 수, 해외 트렌드 기사 58건 언급, GitHub 토픽 저장소 수, 네이버 블로그 total(신조어 12개), SaaS Landing Page 태그, 네이버 트렌드 문서 630건 언급 |
| sns | 30 | `sns\candidates.jsonl`(정의·축·판정) — X·Threads·Instagram 게시글. 22개는 styles 레인 스타일과 같아 합쳤고 8개(apple-style · bauhaus · card-ui · cyberpunk · kitsch · material-design · micro-interaction · neon-glow)는 새 항목이다 |
| bsk | — | `bsk\signals.jsonl` — Dribbble 태그 샷 수 40개(레인이 스타일 id를 붙인 30개), siteinspire 분류 사이트 수(스타일 id가 붙은 18분류) |

- SNS 레인 id → 사전 id 대응표는 `build-styles.mjs SNS_TO_ID`다(예 `neobrutalism` → `neo-brutalism`, `dark-mode` → `dark-mode-first`, `mesh-gradient` → `aurora-mesh-gradient`, `brutalism` → `brutalist-editorial-hybrid`).
- 두 레인의 판정이 다르면 엄격한 쪽을 쓴다(`ban` > `allow-with-rules` > `allow`). 갈린 것은 5개다: glassmorphism·liquid-glass·neumorphism(sns `allow-with-rules` → `ban`, 컨트롤러 판정 유지), minimalism·swiss-typographic(sns `allow` → `allow-with-rules`).
- Behance는 약관(Adobe 6.18 데이터 마이닝 금지) 때문에 정성 메모만 있다(`bsk\behance_notes.txt`). 순위에 넣지 않았다.

## 순위 `rank_score`(0~1)

SNS 점수기 버전: **`sns-crawler\research` weights.json 2026-09-29.1, rescore_2026-09-29**(`score.py` — 플랫폼×쿼리 안 백분위 0.7 + 플랫폼 전체 0.3, 계정·게시글 하나씩, 광고 ×0.5, 댓글유도 댓글 0, 나열글 할인, 부정 문맥 제외). 합치는 식은 같은 폴더의 `merge_sources.py`다.

```
rank_score = (Σ_s w_s × p_s + 1 × 0.5) ÷ (Σ_s w_s + 1)
p_s = 출처 s 안에서 그 스타일 값의 백분위(중간 순위), 출처가 없는 스타일은 그 항을 건너뛴다(모두 coverage partial)
```

| 출처 `rank_parts` 키 | 가중 w | 값 |
|---|---|---|
| `sns` | 1.0 | 새 점수기 점수(30개 모두 있음) |
| `opl` | 1.0 | One Page Love 등재 수(weights.json 밖 — styles 레인 가중을 행에 적는다) |
| `trend` | 1.0 | 트렌드 기사 58건 중 언급 수(같음) |
| `github` | 0.5 | GitHub 토픽 저장소 수 |
| `naver` | 0.5 | 네이버 블로그 total(신조어만) |
| `slp` | 0.5 | SaaS Landing Page 태그 수(행 가중) |
| `curation` | 0.5 | siteinspire 분류 사이트 수(한 스타일에 분류가 여럿이면 합) |
| `naver_docs` | 0.25 | 네이버 트렌드 문서 630건 중 언급(행 가중) |
| `dribbble` | **0.2** | Dribbble 태그 샷 수(스펙 §4 「드리블 가중 0.2」) |

끝의 `1 × 0.5`는 사전값이라 출처가 하나뿐인 스타일은 가운데로 당겨진다. 출처별 `value`·`pct`·`weight`가 `rank_parts`에 있고, `styles-ref.test.mjs`가 이 값들로 점수를 다시 계산해 맞춰 본다.

상위 10: dark-mode-first 0.820 · minimalism 0.802 · illustrative 0.773 · 3d-lite 0.740 · neon-glow(ban) 0.725 · sticker-playful 0.707 · handmade-imperfect 0.696 · dopamine-colorful 0.690 · oversized-typographic 0.664 · glassmorphism(ban) 0.642.

## 한 원소의 모양 (`styles-ref.mjs StyleRef`, zod 4)

| 칸 | 뜻 |
|---|---|
| `id` · `name` | 케밥 식별자 · 한국어 이름 |
| `visualRules` | 무엇이 특징인지 2~8줄 |
| `axes` | 기본 벌 — 레시피 머리 `axes` 칸 이름(`button`·`input`·`surface`·`table`·`header`·`radius`·`shadow`) → 값. 값은 모두 `registry/factory/styles/axes/<축>/`에 있다. 스타일이 정하지 않는 축은 비운다 |
| `axesVariants` | 기본 벌 대신 통째로 쓰는 다른 벌(레인의 `B1\|B4 · R0\|R1` 둘째 자리). 호환표를 통과한 벌만 남는다 |
| `axesNotes` | 비운 이유(반경 「mid」는 반경 축에 중간 값이 없어 base 반경), 버린 변형 벌과 이유 |
| `recipeFields` | 축이 아닌 레시피 필드: `motion`(M0~M3) · `colorLogic`(K1~K8 목록) · `defaultTheme` |
| `newAxisValues` | 이 스타일이 필요로 하는 **구현 안 된** 새 축 값 — `proposals[].id` |
| `archetypes` · `archetypesExcluded` | 어울리는 원형(호환표 조건을 통과한 것만) · 조건에 걸려 뺀 원형과 이유 |
| `compatNote` | 레인이 적은 호환·주의 메모 |
| `verdict` · `verdictReason` | `allow`·`allow-with-rules`·`ban`과 근거(DESIGN §13 · kill-ai-slop 번호 · 접근성). 두 레인 근거를 모두 적는다 |
| `evidence[]` | `{url, signal, type}` — OPL·기사·GitHub·네이버·SNS 게시글(`sns-post:<플랫폼>`)·Dribbble·siteinspire |
| `rank_score` · `rank_parts` | 위 순위 |
| `lanes` · `note` | 어느 레인에서 왔는지 · 사람 확인이 필요한 메모(예: 웹툰 컷 신뢰도 낮음) |

## 구현된 제안(`implemented`) — P3-2 Task 16a

C6 굵은 테두리 색면 카드 · C8 웹툰 컷 · H5 마스트헤드 · R3 유기 곡선 · K9 단색 램프 · D 축(D1 표준·D2 초대형·D3 키네틱) · X 축(X0 없음·X1 그레인·X2 인쇄·X3 콜라주)이 축 폴더(`registry/factory/styles/axes/`)·색 논리 목록에 들어왔다.
`build-styles.mjs`는 레인이 「C6*」처럼 제안 표시로 적은 자리를 이제 진짜 값으로 읽어 스타일 `axes`(D·X 는 `display`·`texture` 칸)·`recipeFields.colorLogic`(K9)에 넣고, 그 제안을 `proposals`에서 빼 `implemented[]`(`{ id, axis, name, task, usedBy }`)에 남긴다.
구현된 값이 레인 벌의 다른 축과 반경 계열로 부딪히면(웹툰 컷 C8(0 계열) × B2·H1(중간)) 부딪힌 축만 0 계열 값(B1·H3)으로 바꾼 벌을 기본 벌로 쓰고, 레인이 적은 원래 벌(C8 없이)을 변형 벌로 남긴다(`axesNotes`).

## 스타일 프리셋 `presets.json` — P3-2 Task 16a (J4·J5)

`allow`·`allow-with-rules` 스타일 53개마다 축 조합 프리셋 하나 + 라이브러리 레시피 10벌마다 하나(`source: "recipe:<id>"`) = 63개. 생성물이다: `factory/scripts/build-presets.mjs`(gen:all) — 손으로 고치지 않는다. 읽는 곳은 `factory/scripts/style-presets.mjs`(`listPresets`·`presetToRecipeHead`·`recipeToMaterials`·`pickPalettes`) — P3-3 찍어내기 ②·③의 입구.

| 칸 | 뜻 |
|---|---|
| `id` · `styleId` · `source` | `preset-<스타일 id>`(`catalog:<id>`) 또는 `preset-recipe-<레시피 id>`(`recipe:<id>`) |
| `axes` | 9축 전부(B·I·C·T·H·R·S·D·X). 스타일에 없는 축은 스타일의 반경 계열에 맞는 기본값(0 계열 B1·I3·C2·T4·H3, 아니면 B3·I1·C1·T2·H1)으로 채우고 `rules`에 적는다. **반경이 없는 스타일(ban 제외 29개 — 전체 62개 중 32개)**은 시각 규칙(「알약」→R2, 「각진·모서리 0」→R0, 「둥근·부드러운」→R1)에서 고르고, 규칙이 정하지 않으면 R1 — 어느 쪽이든 `rules`의 「반경:」 줄에 적는다 |
| `recipeHints` | `fonts`(references/fonts id, 키트 항목 먼저) · `paletteMoods` · `motion` · `colorLogic`(목록) · `defaultTheme`? · (레시피 프리셋은 `dynamics`) |
| `archetypes` · `rules` | 호환표·레시피 규칙을 통과한 원형 · 시각 규칙·판정 조건·채운 값 기록 |
| `rank_score` | 사전 순위(레시피 프리셋은 사전값 0.5) — `listPresets` 점수 = rank_score × 원형 적합도(1·0.5·0) |
| `novelty` | 라이브러리 레시피 10벌과 11개 속성(9축 + motion + colorLogic) 중 다른 비율의 최솟값(0 = 라이브러리 조합, 1 = 모두 다름) — Q7 ③ 「과감한 안」 |
| `sample` | 대표 초안: `pickPalettes` 순위대로 팔레트를 대 보고 lint 가 깨끗한 첫 팔레트 id(서체는 `hintPair`). 53개 모두 있다 |

레시피용 팔레트는 `use: "recipe"`만 쓴다(`presetToRecipeHead`가 decor-only 를 거절한다). 역할 몇 개뿐인 팔레트는 `derivePalette`가 두 테마·모든 색 키(K6~K8 면·칸 키 포함)로 펴는데, 색상각·채도는 두고 명도만 움직여 대비를 맞춘다. 질감(X1·X2) 프리셋은 무늬 위 대비(lint `texture-contrast`)까지 맞춘다. 검수대 `/qa/presets`(`npm run qa:presets`)가 프리셋마다 축 값으로 컴파일한 부품을 대표 초안 색으로 그린다(접촉 시트). 검사 `style-presets.test.mjs`.

## 새 축 값 제안(`proposals`) — 구현 안 됨

Task 16a 뒤 남은 제안: C9 · H6 · S4 · S5 · C5 렌즈, 그리고 sns 레인의 C7 재질 표면·기하 도형 장식층·크롬 이미지 재료(sns 레인이 D1·D2라 불렀지만 디스플레이 축 D와 이름이 겹쳐 따로 적었다). 모두 `status: "not-implemented"`다. `plan`은 대표 판단(2026-09-29 21:58)이다: C6·C8·H5·R3·K9·D·X는 Task 16a에서 구현, S4·C5 렌즈는 금지 스타일 전용이라 건너뜀, C9·H6은 근거가 적어 건너뜀, 나머지는 미정. 구현되면 축 폴더에 값이 생기고 `styles-ref.test.mjs`가 「제안이 이미 구현됨」으로 실패한다 — 그때 제안을 지우고 해당 스타일 `axes`로 옮긴다.

## 검사

`node --test --test-force-exit --test-timeout=60000 factory/scripts/styles-ref.test.mjs` — 필수 칸(zod) · 축 값이 축 폴더에 있는지(축 폴더와 `compat.json` 목록이 같은지도) · 기본 벌·변형 벌·원형마다 호환표 충돌 없음(`checkCompat`·`checkRecipeRules`) · 판정 집합 · 컨트롤러 금지 판정 · 순위 재계산 · 제안 양방향 참조 · 음성 대조 3건(칸 빠짐·모르는 판정, 없는 축 값·반경 계열 충돌, 원형 조건 4종).

## 고치는 법

원천이 저장소 밖이라 `gen:all`에 넣지 않았다. 원천(레인 파일·SNS 점수)을 고친 뒤:

```
node factory/scripts/build-styles.mjs          # python 으로 merge_sources.py 를 부른다 — 중간 파일은 materials/register/
node --test --test-force-exit --test-timeout=60000 factory/scripts/styles-ref.test.mjs
```

새 스타일을 손으로 더할 때도 레인 파일에 행을 넣고 다시 만든다(이 파일을 직접 고치면 다음 빌드가 덮는다). SNS 레인에 새 id가 생기면 같은 스타일인지 보고 `SNS_TO_ID`에 적는다. 표에 없으면 새 항목이 된다.
