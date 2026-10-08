# references/palettes/

색 팔레트 조합 레퍼런스(2026-09-27 운영자 요청 「색감 파레트 콤보도 규칙을 성립한 다음에 레퍼런스에 쓰이도록」). 규칙의 정본은 `DESIGN.md` §5-A 「팔레트 조합」이고, 규칙 감사는 `design-rules\factory\audit-2026-09-25\rules\1d-palettes.md`(pal-01~08)다. 이 폴더는 그 규칙을 판정 결과와 함께 데이터로 옮긴 것이다.

## 출처와 수

`palettes.json` 한 파일, 팔레트 806개(`id` 순 정렬). 2026-09-27 352개에 2026-09-29 재료 등록분 454개(`batch: "materials-2026-09-29"`, 아래 「재료 등록분」)를 더했다.

| `source.kind` | 수 | 출처 |
|---|---|---|
| `sns-owner` | 27 | 운영자가 카카오톡 나챗방에 저장한 인스타그램 팔레트 게시글 6건(링크봇 캐시). uiux.build·dyslovedesign·zbalosch·uxintace·dopelycolors·the_prodesign 게시글의 견본 |
| `sns` | 179 | 추가 수집: 인스타그램 `#colorpalette`·`#컬러조합`, Threads `color palette`(X는 팔레트 이미지가 없어 0건). 게시글 28건 = 159. 재료 등록분 20(인스타그램 `#컬러팔레트`, 2026-09-29) |
| `dataset` | 166 | ui-ux-pro-max 2.13.0 `data/colors.csv` 192행(제품 유형별 역할 매김 팔레트). 16역할이 완전히 같은 행 21묶음(47행)을 하나로 합쳐 서로 다른 팔레트 166개 — 같은 팔레트를 쓰는 제품 유형은 `product_types`에 모두 남긴다 |
| `site` | 434 | 재료 등록분: Colorhunt 인기(301) · Awwwards SOTD·SOTM 수상 사이트 CSS 실측(85, 전부 `brand-derived`) · Coolors 저장 수 상위(45) · 2026 트렌드 기사(3) |

수집·측정 기록(저장소 밖): `design-rules\factory\palettes\collect-report.md`(SNS 수집, 헥스 출처·품질 표시, 반복 구조 상위 10), `compare-sns-dataset.md`(두 원천 같은 척도 비교). 이미지는 받지 않았고 색값만 남겼다. 팔레트 이름은 옮기지 않았다(실존 브랜드 이름이 섞여 있다) — 원문은 `source.url`. 실존 브랜드에서 따온 팔레트는 이름 대신 `brand_derived: true`와 금지 `brand-derived`로 표시한다(아래 금지 표).

## 가중(`weight`)

- SNS 0.2 — 참여 유도 게시물과 널리 도는 재순환 팔레트(coolors 등)가 섞여 있고, 17%는 글자로 쓸 4.5:1 쌍이 하나도 없다. 대표 저장분도 같은 0.2다(공급원은 SNS 그대로).
- 데이터셋 0.6 — 역할마다 대비가 보장돼 있다(본문 7:1 99%, 주색 위 글자 4.5:1 100%). 대신 생성 데이터라 주색의 92%가 Tailwind v3 기본 hex이고 차분한 팔레트가 0%다 — 심사된 사이트 관측(1.0)보다는 낮게 둔다.
- SNS 반복 구조는 데이터셋이나 1차 출처와 맞을 때만 규칙(MUST·SHOULD)이 됐다. 나머지는 `docs/inputs/style_axes.md` 「팔레트 조합 재료」다.

## 한 원소의 모양

```jsonc
{
  "id": "pal-sns-<platform>-<게시글>-<n>" | "pal-uupm-<csv 행 번호>",
  "source": { "url", "platform", "author", "kind": "sns-owner" | "sns" | "dataset" },
  "weight": 0.2 | 0.6,
  "mood": [],                // SNS 게시글 자기 말만
  "harmony": "neutral+accent" | "analogous" | "monochrome" | "complementary" | "split" | "triad" | "polychrome",
  "role_source": "post+pal-07" | "pal-07" | "pair" | "augmented" | "dataset",
  "brand_derived"?: true,              // 실존 브랜드 파생(이름은 싣지 않음)
  "augmented"?: true,                  // 바탕으로 쓸 색(C ≤ 0.04)이 없어 팔레트 밖 바탕을 더함(pal-01)
  "added"?: { "background": "oklch(…)", "variant": "light" | "dark" },  // 더한 바탕 — colors[] 에는 없다, roles.background 도 이 문자열
  "roles": { "background", "foreground", "primary", "primary-foreground", "accent"?, "muted"?, "border"? },  // 값은 colors[].hex 중 하나(보강이면 background·primary-foreground 가 added.background 일 수 있다)
  "colors": [{ "hex": "#RRGGBB", "oklch": [L, C, H] }],   // L·C 소수 4자리, H 1자리
  "contrast": { "fg_bg", "primaryFg_primary" },
  "bans": [], "ban_detail"?: [],
  "use": "recipe" | "decor-only",
  "product_types"?: []       // dataset 만
}
```

## 역할 배정(`roles`)

- **데이터셋**: 행이 적은 역할 그대로(`background`·`foreground`·`primary`·`primary-foreground`·`accent`·`muted`·`border`). border가 `rgba(…)`인 19행은 border를 뺀다.
- **SNS, 게시글이 역할을 적은 곳(19팔레트)**: 적힌 역할을 먼저 쓴다 — `primary` → primary, `background`·`backdrop`·`negative space`·`canvas` → background(없으면 `surface`), `anchor`·`base`·`foundation`·`dark`·`ground`(L < 0.5) → foreground, `accent`·`highlight`·`glow`·`key message` → primary가 비었으면 primary, 아니면 accent. 빈 역할은 아래 자동 배정으로 채운다(`role_source: "post+pal-07"`).
- **채도 상한(모든 SNS 배정)**: background 후보는 C ≤ 0.04, muted·border 후보는 C ≤ 0.06 — 원색 바탕·원색 테두리를 레퍼런스로 내지 않는다. background 후보가 하나도 없으면 아래 「바탕 보강」으로 간다. muted·border 후보가 없으면 그 역할을 비운다.
- **SNS 2색 쌍(`role_source: "pair"`)**: 밝은 쪽(게시글이 바탕을 적었으면 그것) → background, 다른 쪽 → foreground, 채도가 큰 쪽 → primary, 나머지 → primary-foreground. 밝은 쪽의 C가 0.04를 넘으면(2색 쌍 53개 중 37개 — 옅은 쪽도 색이 진한 쌍이 많다) 「바탕 보강」으로 간다.
- **바탕 보강(`role_source: "augmented"`, pal-01 「못 채우면 팔레트 밖의 짙은 닻색이나 밝은 면색을 더해 채운다」)**: 바탕 후보가 없으면 바탕을 하나 더한다. 밝은 면은 `oklch(0.975, min(0.010, 가장 밝은 색 C), 가장 밝은 색 H)`이고 글자는 가장 어두운 색이다. 가장 어두운 색이 L ≤ 0.25이고 색 과반이 L ≥ 0.6이면(어두운 바탕 위 밝은 색으로 읽히는 팔레트) 짙은 닻 `oklch(0.16, min(0.012, 가장 어두운 색 C), 가장 어두운 색 H)`도 후보가 되고, 그때 글자는 가장 밝은 색이다. 둘 다 후보면 `use` 판정식을 통과하는 쪽을, 둘 다 같으면 fg/bg 대비가 큰 쪽을 고르고 `added.variant`에 적는다. 나머지 팔레트 색에서 채도 가장 높음 → primary, 주색과 45° 넘게 떨어진 C ≥ 0.05 색 → accent, `primary-foreground`는 바탕·글자 중 primary 위 대비가 큰 쪽. 더한 바탕은 `colors[]`에 넣지 않는다(원본 팔레트를 바꾸지 않는다) — `augmented: true`, `added.background`. 판정식·금지는 같다(더한 바탕은 C ≤ 0.012라 크림에 걸리지 않고, 브랜드 파생·Tailwind 금지는 그대로 걸린다).
- **SNS 자동 배정(pal-07, 3색 이상)**: 가장 밝음 → background, 바탕과 대비가 가장 큰 색(보통 가장 어두움) → foreground, 남은 색 중 채도 가장 높음 → primary, 주색과 45° 넘게 떨어진 C ≥ 0.05 색 → accent, 바탕과 명도 0.2 안의 색 → muted, 바탕·글자 중간 명도에 가장 가까운 색 → border.
- 3색 이상: `primary-foreground`는 background·foreground 중 primary 위 대비가 큰 쪽.

## 금지(`bans`) — DESIGN §5-A

| 값 | 규칙 | 판정 | 대상 |
|---|---|---|---|
| `brand-derived` | 레시피·예시에 실존 브랜드를 쓰지 않는다(`docs/agents/agent-guide.md` §6) | 원천 이름에 「Inspired」나 괄호 속 브랜드·스튜디오, 또는 수집 메모에 「Brand-derived」·「Real brand identities」 | 팔레트 전체(SNS 17개: 브랜드 「Inspired」 9 · 실제 브랜드 아이덴티티 8) |
| `cream-background` | pal-03 (§5-A 셋째 줄, §13 크림·베이지) | 색상 60~95°, C > 0.012. 데이터에서는 바탕 L ≥ 0.6일 때만(어두운 갈색 바탕을 크림으로 잡지 않게) — lint는 명도 조건 없이 라이트 background에 건다 | background(보강이면 더한 바탕) |
| `accent-hue-groups` | pal-02 (§5-A 둘째 줄) | C ≥ 0.05인 색을 45° 안끼리 묶어 3묶음 이상 | SNS는 background·foreground 닻을 뺀 팔레트 색, 데이터셋은 primary·secondary·accent·ring |
| `tailwind-default` | pal-04 (§5-A 넷째 줄) | C ≥ 0.05이고 Tailwind v3 기본 hex(흑백 제외 241색)와 OKLab 거리 < 0.005 | primary·accent |
| `ai-tell-violet` | §13 AI 티 보라(컨트롤러 판정 2026-09-29) | 주색 OKLCH 색상각 265~300이고 C > 0.15(`isAiTellViolet`). 채도 낮은 보라·바탕·면 보라는 대상 밖 | 모든 팔레트의 primary(Task 16a, 컨트롤러 판정 2026-09-29 23:08 — 처음에는 재료 등록분만). 2026-09-27 이전 352개 중 32개가 새로 걸렸고 그중 recipe 였던 것은 `pal-sns-instagram-de9uynfabjg-3` 하나(→ decor-only). **라이브러리 레시피에서 온 팔레트(`source: "recipe:<id>"`)만 뺀다** — 레시피 자체는 바꾸지 않는다. 레시피 쪽에서 규칙에 걸리는 것: `pal-recipe-r2-signal`(A, 두 테마)·`pal-recipe-r4-evidence-b`(B, 라이트) |

문턱은 `factory/scripts/lib/palette-rules.mjs` 하나에 있고 레시피 lint(`recipe.mjs` `palette-tailwind`·`palette-cream`)도 같은 값을 쓴다. pal-04 문턱은 2026-09-27에 0.02 → 0.005 + 채도 0.05 이상으로 보정했다 — 0.02는 OKLCH 램프로 지은 r1-measure의 옅은 색 4개(회색·옅은 틴트 영역은 기본 스케일이 촘촘하다)까지 걸었다.

**pal-04 때문에 데이터셋 팔레트는 대부분 `decor-only`다(166 중 160이 `tailwind-default`). 의도한 결과다.** 데이터셋의 가치는 역할 구조와 대비 보장이지 hex가 아니다 — 레시피는 데이터셋에서 역할 배치·명도 사다리를 가져오고, 색은 색상각만 참고해 OKLCH로 다시 만든다. 데이터는 있는 그대로 기록했다(고치지 않았다).

## `use` 판정식(pal-01)

```
use = roles 있음 && contrast.fg_bg >= 7 && contrast.primaryFg_primary >= 4.5 && bans 가 비었음 ? "recipe" : "decor-only"
```

대비는 저장한 `oklch`로 `factory/scripts/lib/contrast-lib.mjs` `ratio`가 잰다. `decor-only`는 일러스트·배경 그래픽·차트 아닌 면에만 쓴다(DESIGN §5-A 첫 줄).

현재 수(2026-09-29 재료 등록 뒤 전체 806): recipe 300 · decor-only 506 · 금지 brand-derived 102 · cream-background 48 · accent-hue-groups 25 · tailwind-default 165 · ai-tell-violet 30 · 바탕 보강 248(recipe 146) · 어두운 바탕 recipe 61. 그 전(2026-09-27 fix 2): recipe 85(sns-owner 11 · sns 69 · dataset 5) · decor-only 267 · roles null 0 · 2색 쌍 역할 16(recipe 9) · 바탕 보강 65(밝은 면 63 · 짙은 닻 2, recipe 37) · 어두운 바탕 recipe 10 · 금지 brand-derived 17 · cream-background 34 · accent-hue-groups 13 · tailwind-default 162. 보강 팔레트를 인용할 때는 더한 바탕이 원 게시글에 없는 색임을 결정 기록에 적는다.

## 레시피가 인용하는 법

레시피 머리 `references`에 팔레트 `id`를 적는다(카드 id·URL과 같은 자리, 2개 이상 규칙에 함께 센다).

```yaml
references: [pal-sns-instagram-ddujmhojbb4-1, color-palette-navy-anchor, layout-l20]
```

`use: recipe`인 팔레트는 역할 배치와 색상각을 가져온다. 그래도 레시피 색은 OKLCH로 다시 쓰고 `lintRecipe`(두 테마 대비·pal-03·pal-04)를 통과해야 한다. `decor-only` 팔레트는 분위기·장식 참고로만 적는다. 반복 구조 카드는 `references/patterns/color-palette-*.md`.

## 재료 등록분(P3-2 Task 15m, 2026-09-29)

운영자 요청(2026-09-29 「sns나 검색 엔진에서 … 선호도를 알 수 있는 정량적 요소를 통해 선별해서 등록」)으로 모은 팔레트다. 행마다 `batch: "materials-2026-09-29"`가 붙는다.

- **원천:** palettes 레인 389개(Colorhunt·Awwwards·트렌드 기사, `design-rules\factory\materials\palettes\candidates.jsonl`) + Coolors 69개(bsk 레인 `bsk\coolors.jsonl`) + SNS 21개(sns 레인). Coolors·SNS는 레인 측정기 `materials\palettes\measure-candidates.mjs`(palette-lib + 이 저장소 `build-palettes.mjs`의 `assignRoles`·`augmentVariants`·`bansOf`)로 같은 방식으로 쟀다.
- **중복:** 두 팔레트 색끼리 가장 가까운 OKLab 거리의 양방향 평균이 0.04 미만이면 같은 팔레트다. 기존 352개와 겹친 34+14개, 레인 안에서 겹친 97+5개, Coolors·SNS가 레인과 겹친 6개를 뺐다. 뺀 쪽의 근거는 남은 쪽 `evidence`·`merged_from`으로 옮겼다.
- **컨트롤러 판정 1:** Awwwards 수상 사이트 팔레트 85개는 실제 사이트 정체성 색이라 `brand-derived` 금지(decor-only)를 유지한다. 금지가 없을 때의 판정은 `use_without_brand_ban`에 기록만 한다(recipe 72 — 레인 보고의 76에서 보라 판정 4개가 빠졌다). 레시피에는 다른 색과 섞는 재료로만 쓴다.
- **컨트롤러 판정 2:** 주색이 색상각 265~300·C > 0.15이면 `ai-tell-violet` 금지로 decor-only(30개).
- **순위 `rank_score`(0~1):** `sns-crawler\research\merge_sources.py`(weights.json 2026-09-29.1)의 `(Σ w·p + 1×0.5) ÷ (Σ w + 1)`. p는 출처 안 백분위다. 가중 awwwards 1.0(심사 점수) · colorhunt 0.5(좋아요) · coolors 0.5(저장 수, weights.json에 없어 행 가중) · curation 0.5(트렌드 기사 언급 수) · sns 1.0. 출처별 값·백분위·가중은 `rank_parts`에 있다. **SNS 팔레트 20개는 새 SNS 점수기(rescore_2026-09-29, 서체·스타일만 다시 채점)에 없어 sns 레인의 옛 점수를 그대로 썼다**(`sns_score_version`에 표시).
- **추가 칸:** `harmony_detail`·`patterns`·`hue_family`·`dark_first`·`tags`·`evidence[{url, signal, type}]`·`rank_score`·`rank_parts`·`merged_from`·`use_without_brand_ban`. `mood`는 게시글 자기 말이 아니라 측정기 `moodOf`(색 수치·출처 태그)가 붙인 값이다.
- **수(2026-09-29):** 454개 = recipe 215 · decor-only 239. 출처별 recipe/decor: Colorhunt 201/100 · Awwwards 0/85 · Coolors 9/36 · SNS 2/18 · 기사 3/0. 어두운 바탕 recipe 51.

## 레시피 분해분(P3-2 Task 16a, 접합면 J5)

라이브러리 레시피 10벌(과 보드 B안 9벌)의 색이 팔레트로 들어온다 — 대표 판단(2026-09-29) 「검증된 레시피에 사용된 스타일 종류와 팔레트, 서체도 포함해」.

- 원천은 레시피 머리다. `factory/scripts/build-presets.mjs`(gen:all)가 `style-presets.mjs recipePalette`로 `references/palettes/recipe-derived.json`을 만들고, `build-palettes.mjs`가 그 파일을 입력(`--recipes`, 기본 이 경로)으로 읽어 `palettes.json`에 그대로 싣는다. **palettes.json 을 손으로 고치지 않는다** — 다음 빌드가 지운다.
- 모양: `id: "pal-recipe-<id>"`(B안은 `-b`), `source: "recipe:<id>"`(문자열), `role_source: "recipe"`, `weight: 1`, `mood` = 레시피 mood, `colorLogic`·`defaultTheme`, 그리고 **`theme: { light, dark }` = 레시피 color 두 벌 그대로**(presetToRecipeHead 가 이 값을 그대로 써 왕복이 같다). `roles`·`colors`(hex)·`contrast`·`bans`·`use`는 다른 팔레트와 같은 식(`bansOf`)으로 다시 판정한다 — 역할은 레시피 기본 테마의 색, muted·border 는 C ≤ 0.06 일 때만.
- 19개 모두 `use: "recipe"`. 보라 금지만 면제한다(위 표).
- 승격된 레시피도 `recipes/`에 들어오면 다음 gen:all 이 같은 함수로 recipe-derived.json 에 넣는다. palettes.json 에는 `build-palettes.mjs`를 다시 돌려야 들어가고, 그 전에는 `style-presets.mjs loadPalettePool`이 두 파일을 합쳐 읽는다(`palettes.test.mjs`가 둘이 어긋나면 실패한다).

## 다시 만드는 법

원천이 저장소 밖이라 `gen:all`에 넣지 않았다.

```
# 재료 등록분(저장소 밖, design-rules\factory\materials\register)
node palettes-raw.mjs && node ../palettes/measure-candidates.mjs raw-extra.jsonl measured-extra.jsonl
node palettes-register.mjs && python sns-crawler/research/merge_sources.py --sns sns_empty.jsonl --other other_palette.jsonl --out merged_palette.jsonl
node palettes-register.mjs --final && copy registered.jsonl ..\palettes\registered.jsonl
# 저장소
node factory/scripts/build-presets.mjs     # 레시피 분해분(recipe-derived.json) — gen:all 에도 있다
node factory/scripts/build-palettes.mjs
```

기본 입력 폴더는 `design-rules\factory\palettes`(`palettes.jsonl`·`dataset-uupm.jsonl`), 재료 등록분은 `--materials`(기본 `design-rules\factory\materials\palettes\registered.jsonl`, `none`이면 뺀다 — 뺀 결과는 2026-09-27 파일과 바이트까지 같다). 다른 곳이면 `--src <폴더>`, 다른 출력이면 `--out <파일>`. 만든 뒤 `node --test --test-force-exit --test-timeout=60000 "factory/scripts/*.test.mjs"`(`palettes.test.mjs`)로 확인한다. 측정 함수는 `factory/scripts/lib/palette-lib.mjs`(원천 측정 스크립트와 같은 파일의 사본, contrast-lib import만 상대 경로), Tailwind 대조표는 `factory/scripts/lib/tailwind-v3-colors.json`(v3.4.17 `src/public/colors.js`).
