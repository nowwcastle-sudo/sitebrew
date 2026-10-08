# Sitebrew — 에이전트 입구 · Agent entrance

이 파일은 짧은 입구다. 규칙 전문(원천과 생성물 표 · 작업 → 스킬 표 · 기본 shadcn과 다르게 동작하는 것 · 금지)은 [`docs/agents/agent-guide.md`](docs/agents/agent-guide.md)에 있다. 할 일에 맞는 절만 거기서 읽는다.

## 한국어

Sitebrew는 한 저장소에 든 세 부분이다. 루트의 web-factory는 shadcn 레지스트리이자 사이트 찍어내기 파이프라인이다. 부품·스타일 축·레시피·블록·원형을 조합해, 목적 한 줄에서 사이트 후보 세 개를 만든다. `launch-factory`는 인증·결제·메일·분석 같은 뒷단을 맡는 출시 키트다. `plugins/sitebrew`는 이 둘을 Claude Code·Codex에서 대화로 쓰게 하는 플러그인이다. 키가 하나도 없어도 미리보기 모드로 돈다.

## English

Sitebrew is three parts in one repository. web-factory, at the root, is a shadcn registry and a site-stamping pipeline: it combines parts, style axes, recipes, blocks and archetypes into three site candidates from a one-line goal. `launch-factory` is the back-end launch kit (auth, billing, email, analytics). `plugins/sitebrew` is the Claude Code and Codex plugin that drives both from a conversation. No API key is needed: without keys everything runs in preview mode.

## 폴더 지도 · Folder map

| 경로 · Path | 무엇 · What |
|---|---|
| `registry/factory` | 원천: 부품(`ui-src`)·스타일 축(`styles`)·레시피(`recipes`)·블록(`blocks`)·원형(`archetypes`) / sources: parts, style axes, recipes, blocks, archetypes |
| `factory` | 도구: 찍어내기(`stamp`)·품질 관문(`qa`)·생성기(`scripts`)·대화 입구(`intake`)·점검(`doctor.mjs`) / tools: stamping, gates, generators, intake, doctor |
| `ai` | 생성물: 에이전트용 gotchas·원형별 과업 / generated: agent gotchas and per-archetype tasks |
| `docs` | 규칙·가이드·품질 기록 / rules, guides, QA notes (full agent guide: `docs/agents/agent-guide.md`) |
| `launch-factory` | 출시 키트: 템플릿(`template`)·기능 묶음(`registry`)·스크립트 / launch kit: template, feature bundles, scripts |
| `plugins/sitebrew` | 플러그인 / the plugin |
| `packages/create-sitebrew` | `npx create-sitebrew` 설치기 / the npx installer |
| `ci` | 검사 묶음 / CI checks |

## 자주 쓰는 명령 · Common commands

| 하려는 일 · Task | 명령 · Command |
|---|---|
| 환경 점검과 설치 / check the environment, install | `npm run setup` |
| 단계별 키·도구 점검 / per-stage key and tool check | `node factory/doctor.mjs --stage stamp` |
| 생성물 전부 다시 만들기 / regenerate everything | `npm run gen:all` |
| 생성물이 원천과 같은지 / generated files match sources | `npm run check:regen` |
| 점검 벤치 / inspection bench | `npm run dev` |
| 사이트 찍어내기 / stamp a site | `npm run stamp -- --brief out/brief.json --run out/my-site` |
| 전체 검사 / full verify | `npm run ci:verify` |
| 가벼운 시험 / light tests | `npm run ci:test` |

launch-factory 안에서는 `npm run doctor` · `npm run registry:check` · `npm test` 를 쓴다. / Inside `launch-factory`: `npm run doctor`, `npm run registry:check`, `npm test`.

## 먼저 지킬 것 · Rules to keep in mind

- 원천만 고친다. 생성물은 손으로 고치지 않고 `npm run gen:all` 으로 다시 만든다. / Edit sources only; regenerate generated files with `npm run gen:all`.
- 부품·블록 코드에 모양 값(반경·간격·색)을 직접 쓰지 않는다. 모양은 스타일 축 훅으로만 낸다. / No hard-coded shape values in part or block code; shape comes from the style-axis hooks.
- 레시피·원형·예시 문구에 실존 브랜드나 회사 이름을 쓰지 않는다(가상 이름과 「예시」 표시). / No real brand or company names in recipes, archetypes or sample copy.
- 키 값(`PEXELS_API_KEY`·`LAW_API_OC` 등)은 화면과 기록에 찍지 않는다. 있는지만 본다. / Never print a key value; check only whether it is set.
- 설치 주소에는 항상 `#<tag>` 를 붙인다. 태그 없이는 `main` 을 읽는다. / Always pin install addresses with `#<tag>`; without a tag the command reads `main`.

## 규칙 전문 · Full rules

[`docs/agents/agent-guide.md`](docs/agents/agent-guide.md) — 1 목적 · 2 읽는 순서 · 3 원천과 생성물 표 · 4 작업 → 스킬 표 · 5 gotchas · 6 금지. 새 레시피나 블록을 더하는 순서는 [`docs/guides/add-recipe.md`](docs/guides/add-recipe.md).
