# Pretendard 설치 실험과 폰트 키트 설치 실험 (P2′ Task 8, 2026-09-26)

> **지금 이름(Task 13a 뒤).** 이 문서는 서체 변수 개명 전 실험 기록이다. 13a 뒤 키트 변수는 `--font-<slug>-wf`다 — 여기의 `--font-pretendard`는 지금 `--font-pretendard-wf`이고, 레시피 스택은 `var(--font-pretendard-wf, …)`를 읽는다(`factory/scripts/lib/registry-lib.mjs` `fontVar`, 옮기는 법은 `docs/qa/p2-migration.md`). 설치 경로(css `@import` + npm 의존)와 결론은 그대로다. 의존은 지금 package.json 범위로 고정된 `pretendard@^1.3.9`다(최종 리뷰 M6·M7).

- 도구: shadcn 4.21.0, Next 16.3.4(Turbopack), Tailwind v4, Windows 11 + Git Bash, 헤드리스 Chrome(CDP)
- 설치 폴더: `/d/dev/_wf_install8`(실험 뒤 삭제했다)
- 방식은 Task 7 `recipe-install-test.md`와 같다. `npm run gen:all`, 이어서 `npx shadcn@4.21.0 build -o .tmp/r`(종료 0, json 142개)를 돌린다. `.tmp/r/*.json`을 `localreg/`로 복사하면서 의존 주소 `nowwcastle-sudo/sitebrew/<이름>#v0.0.3`을 `../localreg/<이름>.json`으로 바꿨다. 바꾼 주소는 494개이고, 남은 원격 의존 주소는 0개다(`registry.json`의 homepage만 남는다).
- 서체 판정은 계산된 `font-family`만으로 하지 않는다. 계산값은 선언된 목록일 뿐이라, CDP `CSS.getPlatformFontsForNode`로 **실제로 그린 서체와 글리프 수**를 함께 봤다.

## 결론

| 질문 | 결과 |
|---|---|
| Pretendard 경로 ①(항목 `css` `@import` + `dependencies: ["pretendard@^1"]`)이 되는가 | **된다 — ①을 채택했다.** 경로 ②(`registry:file` + README 안내)는 쓰지 않는다 |
| r1 서체 항목 3개가 소비자에서 실제로 그려지는가 | 된다 — 본문 한글은 IBM Plex Sans KR 웹 폰트, 제목 라틴은 IBM Plex Sans, 숫자 고정폭은 IBM Plex Mono |
| 서체 항목 없는 Windows 소비자의 고정폭 스택(T5-c6·T7-M8) | 숫자는 Consolas, 한글은 맑은 고딕. 고치기 전 스택은 숫자까지 맑은 고딕(음성 대조) |

## 1. 폰트 항목과 r1 설치 — 통과

```bash
cd /d/dev/_wf_install8
npx shadcn@4.21.0 init -t next -b base -p nova -n consumer -y --no-monorepo   # 종료 0
cd consumer
npx shadcn@4.21.0 add ../localreg/font-ibm-plex-sans-kr.json -y -o            # 종료 0
npx shadcn@4.21.0 add ../localreg/r1-measure.json -y -o                        # 종료 0 (font-ibm-plex-sans·-mono 는 의존으로 따라 들어온다)
npm run build                                                                   # 종료 0
npx next start -p 3918                                                          # / → 200
```

shadcn이 바꾼 것:

- `app/layout.tsx`에 `IBM_Plex_Sans_KR({subsets:['latin'],weight:['400','700'],variable:'--font-ibm-plex-sans-kr'})`가 들어간다. `IBM_Plex_Mono`(400·600)와 `IBM_Plex_Sans`(가변, weight 없음)도 들어간다. 세 `.variable` 클래스는 `<html className>`에 붙는다.
- `app/globals.css` `@theme inline`에 `--font-ibm-plex-*: var(--font-ibm-plex-*)` 세 줄이 들어가고, 레시피 서체 스택 `--font-sans`·`--font-heading`·`--font-mono`가 들어간다.
- **주의:** 첫 `add font-…` 때 shadcn이 init 판 `<html className>`에 있던 `"font-sans"` 클래스를 지웠다. 본문 서체는 globals의 `@layer base { html { @apply font-sans } }`로 그대로 적용되어 결과에는 영향이 없었다.

`/`의 탐침 문단 결과(CDP, 웹 폰트 로드 완료 뒤):

| 요소 | 계산된 font-family(앞부분) | 실제로 그린 서체 |
|---|---|---|
| `h1.font-heading` 「도면 계측 예시 제목 Heading 2026」 | `"IBM Plex Sans", "IBM Plex Sans Fallback", "IBM Plex Sans KR", …` | IBM Plex Sans(웹) ×16 · IBM Plex Sans KR(웹) ×8 |
| `p` 본문 「한글 본문 문장입니다. 예시 수치 1,234,567원.」 | `"IBM Plex Sans KR", "IBM Plex Sans KR Fallback", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif` | IBM Plex Sans KR(웹) ×30 |
| `p.font-mono` 「0123456789 한글 고정폭」 | `"IBM Plex Mono", "IBM Plex Mono Fallback", ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", "IBM Plex Sans KR", …` | IBM Plex Mono(웹) ×12 · IBM Plex Sans KR(웹) ×5 |

라틴 디스플레이 서체 뒤에서 한글 제목이 본문 한글 서체로 떨어진다(Review Focus 5). 고정폭 숫자는 IBM Plex Mono로, 한글만 한글 서체로 넘어간다.

## 2. Pretendard 경로 ① — 통과, 채택

항목 `font-pretendard`(`registry:item`)는 다음과 같다. 원천은 `registry/factory/fonts/font-pretendard.json`이다.

```json
"dependencies": ["pretendard@^1"],
"css": { "@import \"pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css\"": {} },
"cssVars": { "theme": { "font-pretendard": "\"Pretendard Variable\", Pretendard, sans-serif" } }
```

같은 소비자에서 `npx shadcn@4.21.0 add ../localreg/font-pretendard.json -y -o`는 종료 0이었다. 바뀐 것:

- `package.json`에 `"pretendard": "^1.3.9"`가 들어갔다(npm 설치까지 됐다).
- `app/globals.css` 4행, 기존 `@import` 줄들 바로 뒤, 다른 규칙보다 앞에 `@import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";`가 들어갔다. `@theme inline`에는 `--font-pretendard: "Pretendard Variable", Pretendard, sans-serif;`가 들어갔다.
- `npm run build` 종료 0. 경고·오류는 0줄이다. Tailwind가 패키지 CSS를 풀어 넣으면서 woff2 상대 경로를 다시 잡아, `.next/static/media`에 Pretendard 조각 92개가 나왔다.

렌더 결과는 두 경우 모두 통과다.

| 경우 | 계산된 font-family | 실제로 그린 서체 |
|---|---|---|
| (b) 문단이 `style={{fontFamily:"var(--font-pretendard)"}}` | `"Pretendard Variable", Pretendard, sans-serif` | Pretendard Variable(웹) ×14 |
| (c) 레시피 상황: 페이지 소스에 `--font-pretendard`가 한 번도 없고, `@theme inline`의 `--font-sans`만 `var(--font-pretendard, "Pretendard", …)`로 바꿈 | `"Pretendard Variable", Pretendard, sans-serif, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif` | 본문 Pretendard Variable(웹) ×30 |

(c)는 Tailwind v4가 `@theme` 변수를 다른 테마 값이 참조할 때도 내보내는지 확인하려고 돌렸다. 내보낸다(`getComputedStyle(html)` 의 `--font-pretendard` = 위 값). 그러니 Pretendard를 본문으로 쓰는 레시피도 `var(…)`로 이 항목을 받는다. 지금 이름은 `var(--font-pretendard-wf, …)`다. 위 실험은 Task 8 당시의 옛 이름(`--font-pretendard`)으로 했고, Task 13a에서 종결자 `-wf`가 붙었다(`docs/qa/p2-migration.md`).

### 한계

- `Pretendard`(정적 이름)로는 웹 폰트가 잡히지 않는다. 동적 서브셋 CSS는 `Pretendard Variable`이라는 이름만 등록한다. 그래서 항목이 없는 소비자에서는 레시피 스택의 기본값 `"Pretendard"`가 로컬 설치본이 있을 때만 맞고, 없으면 시스템 한글로 떨어진다. 항목이 있으면 변수 값이 `"Pretendard Variable"`을 먼저 둔다.
- 저장소 갤러리 `/qa/recipes`는 아직 next/font/google 로더만 쓴다. Pretendard를 쓰는 레시피는 갤러리 칸 위에 「Google Fonts 밖」 표시가 계속 뜬다(`gen-recipes-gallery.mjs`).
- Next가 아닌 소비자는 확인하지 않았다(선언된 사용 환경은 Next 소비자).

## 3. 서체 항목 없는 소비자의 고정폭 스택 — 통과(T5-c6·T7-M8)

`registry/factory/r/r1-measure/r1-measure.css`(순수 CSS, var() 없음)만 붙인 정적 HTML을 이 PC에서 그렸다. 이 PC에는 IBM Plex가 설치되어 있지 않다.

| 스택 | `0123456789 한글 고정폭`을 그린 서체 |
|---|---|
| 지금 `--font-mono: "IBM Plex Mono", ui-monospace, "SFMono-Regular", Menlo, Consolas, "Liberation Mono", "IBM Plex Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", monospace` | Consolas(로컬) ×12 · Malgun Gothic(로컬) ×5 |
| 고치기 전(음성 대조) `"IBM Plex Mono", "SFMono-Regular", Menlo, "IBM Plex Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", monospace` | Malgun Gothic(로컬) ×17 — 숫자까지 비례폭 |

`recipe.mjs` `fontStacks()`는 고정폭 항목 var()의 기본값 안과 스택 바깥 모두에서 한글 서체보다 앞에 시스템 고정폭(`SYSTEM_MONO`)을 둔다. 검사는 `gen-fonts.test.mjs`의 「mono stacks」다(고정폭 항목 있음·null·키 없음 × var()·순수 CSS, 그리고 r1).

## 로그

원본 로그(`init.log`·`add-font.log`·`add-r1.log`·`add-pretendard.log`·`build-a/b/c.log`·`start-a/b/c.log`·`probe-c.json`·`probe-plain.txt`, 단계별 `layout.tsx`·`globals.css` 사본)는 커밋하지 않았다. 세션 스크래치 `install-logs-t8/`에 두었다.

## 4. Pretendard GOV(P3-1 Task 3, 2026-09-27)

r6-civic(KRDS 공공 원형, factory-rules.md §21-8)이 쓰는 서체다. `docs/recipes/candidates-2026-09-27.md`의 2026-09-27 판정대로 npm `pretendard-gov@1.3.9`(OFL-1.1)를 Pretendard와 같은 경로(항목 `css` `@import` + `dependencies`)로 키트에 넣었다.

- **설치:** `npm install pretendard-gov@1.3.9`. `package.json`은 npm이 그대로 `"pretendard-gov": "^1.3.9"`로 적어, 이미 있는 `"pretendard": "^1.3.9"`와 표기가 같다.
- **동적 서브셋 CSS 경로:** 설치된 패키지 안 `node_modules/pretendard-gov/dist/web/variable/pretendardvariable-gov-dynamic-subset.css`다(Pretendard의 `dist/web/variable/pretendardvariable-dynamic-subset.css`와 같은 자리, 파일 이름만 `-gov-`가 끼어 있다). 정적 굵기 버전은 `dist/web/static/pretendard-gov-dynamic-subset.css`(안 쓴다 — 가변 경로를 Pretendard와 맞춘다).
- **CSS가 등록하는 이름:** `font-family: 'Pretendard GOV Variable'` 하나뿐이다(Pretendard의 동적 서브셋 CSS가 `'Pretendard Variable'`만 등록하는 것과 같은 구조). 항목 `font-pretendard-gov.json`의 `cssVars.theme["font-pretendard-gov-wf"]`는 `"Pretendard GOV Variable", "Pretendard GOV"`다 — 로컬에 정적 `Pretendard GOV`(비-Variable) 설치본이 있는 소비자를 위한 폴백까지 Pretendard 항목과 같은 형태로 적었다. 끝의 `sans-serif`는 Task 10c fix 1(리뷰 M6)에서 뺐다. 두 항목 모두 그렇다. 서체 변수가 일반형으로 끝나면, 레시피 스택 `var(--font-x-wf, …)`가 그 값으로 풀릴 때 없는 글자가 레시피 본문·한글 폴백을 건너뛰고 플랫폼 일반형으로 떨어진다. 위 실험 기록(3절)의 값은 당시 그대로다.
- **패키지 메타:** `node_modules/pretendard-gov/package.json`은 `"license": "OFL-1.1"`, `repository`는 `orioncactus/pretendard`(모노레포, `directory: "packages/pretendard-gov"`)다. 별도 LICENSE 파일은 그 하위 폴더에 없고, 저장소 루트 `LICENSE`를 그대로 쓴다(`docs/qa/font-licenses.md` 참고).
- **Pretendard 와의 관계:** 메트릭 호환 변형이라 항목 `meta.aliasOf: "font-pretendard"`를 달았다 — 레시피 사이 차이 검사(`factory/scripts/recipes-distinct.mjs`)가 두 항목을 같은 서체로 센다(컨트롤러 판정, `docs/recipes/candidates-2026-09-27.md` 「Pretendard GOV ↔ Pretendard는 서체 차이로 세지 않는다」). 실제 소비자 CSS 폴백 스택에는 이 별칭이 섞이지 않는다 — `font-licenses.md` 「서체 정체성 별칭」 절 참고.
- **korean-fonts.json:** 「Pretendard GOV」·「Pretendard GOV Variable」 두 항목이 `external: true`에서 `item: "font-pretendard-gov"`로 바뀌었다.
- 설치 실험(shadcn add·`npm run build`·CDP 렌더 확인)은 Pretendard와 같은 절차이므로 따로 반복하지 않았다 — 위 1·2절의 결론이 그대로 적용된다(동적 서브셋 CSS `@import` 한 줄 + npm 의존, `@theme inline`에 변수가 나오고 var() 참조 체인이 값을 전달한다). Next가 아닌 소비자는 이번에도 확인하지 않았다.
