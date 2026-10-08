# 새 레시피 한 벌 더하기 · Add one recipe

한국어가 먼저이고, 영어는 아래 [English](#english)에 있다. 코드 블록은 두 언어가 함께 쓴다.

이 문서는 사람 또는 에이전트가 레시피 1벌(새 첫 화면 히어로 장면 1개 포함)을 더하는 순서를 정한다.
시험 `factory/scripts/add-recipe-guide.test.mjs` 가 이 문서의 코드 블록을 저장소 사본에 그대로 적용하고 `npm run gen:all` 이 0 으로 끝나는지 본다.
문서와 코드가 어긋나면 그 시험이 실패한다.

## 먼저 알아 둘 것

- 레시피 원천은 `registry/factory/recipes/<id>/DESIGN.md` 한 파일이다. 머리(YAML)가 값을 정하고, 본문은 쓰는 법을 적는다.
- 기존 레시피를 복사해 이름과 색만 바꾸면 `npm run gen:all` 이 거부한다. 이유는 세 가지다.
  1. 차이 검사: 기존 모든 레시피와 축 7개 중 2개 이상 달라야 하고, 색 또는 서체가 달라야 한다.
  2. 서체 고유 검사: 첫 화면 제목 서체(`fonts.display`)와 한글 제목체(`fonts.displayKo`)는 모든 레시피의 A·B 얼굴 사이에서 겹치지 않아야 한다.
  3. 히어로 고유 검사: 히어로 장면 하나는 레시피 하나(A 또는 B 얼굴 한 곳)만 쓴다. 지금 카탈로그의 히어로는 모두 쓰이고 있어서, 새 레시피는 **새 히어로 장면**을 함께 더해야 한다.
- 생성물은 손으로 고치지 않는다. 원천을 고치고 `npm run gen:all` 이 다시 쓰게 한다.
- 히어로 장면은 두 곳에만 등록한다. 표 `factory/scripts/recipe.mjs` 의 `HEROES` 한 줄과 틀 파일 `app/qa/recipes/heroes/<히어로 id>.tsx` 한 벌이다.
  `gen-recipes-gallery` 가 표를 읽어 틀 파일을 자동으로 잇는다(`.tmp/recipes/heroes.ts`). 틀 파일이 없으면 생성이 멈춘다.
- 아래 예시는 `r17-signpost`(안내판) 레시피와 `offset-card-stack` 히어로이다. 값은 지금 저장소의 기존 레시피와 겹치지 않게 골랐다.
  여러분의 레시피는 id·이름·값을 바꿔 쓴다.

## 1단계. 번호와 이름을 정한다

폴더 이름이 곧 id 이다. 꼴은 `r<번호>-<이름>` 이고, 번호는 지금 가장 큰 번호보다 하나 크게 쓴다.

```sh
ls registry/factory/recipes
```

PowerShell 에서는 `Get-ChildItem registry/factory/recipes` 를 쓴다. id 는 소문자·숫자·가운데 줄(`-`)만 쓴다.

## 2단계. 축 7개를 고른다

축 7개는 `radius`(반경), `button`, `input`, `surface`, `table`, `header`, `shadow` 이다. 값의 목록은 `registry/factory/styles/compat.json` 의 `axes` 에 있다.
조건은 둘이다.

- 기존 레시피 **모두**와 2개 이상 다르다. 기존 값은 아래 명령으로 본다.
- 호환표를 통과한다. 각진 값(`R0`·`B1`·`I3`·`C2`·`T4`·`H3`·`S2`·`C6`·`C8`)은 나머지 값(`B2`·`B3`·`I1`·`I2`·`C1`·`C3`·`H1`·`H4`·`H5`·`R1`·`R2`·`R3` …)과 섞지 않는다(`compat.json` 의 `families`). `header: H4` 는 `dashboard` 원형 전용이다.

```sh
grep -h "^id:\|^axes:" registry/factory/recipes/*/DESIGN.md
```

PowerShell: `Select-String -Path registry/factory/recipes/*/DESIGN.md -Pattern '^(id|axes):' | % { $_.Line }`

고른 조합은 이 명령으로 먼저 확인한다. `위반 0` 이어야 한다(종료 코드 0).

```sh
node factory/scripts/compat.mjs radius=R1 button=B2 input=I1 surface=C1 table=T1 header=H5 shadow=S3
```

선택 축 `display`(D1~D3)와 `texture`(X0~X8)는 적지 않아도 된다. 적으면 히어로와 짝 규칙이 생긴다(D2·D3 는 제목이 전폭인 히어로에서만).

## 3단계. 서체를 고른다

- `fonts.display`(라틴 제목체)와 `fonts.displayKo`(한글 제목체)는 기존 모든 레시피의 A·B 얼굴과 달라야 한다. 쓰는 중인 서체는 아래 명령으로 본다.
- `fonts.body` 는 같아도 된다. 한글을 그리는 서체여야 한다(`factory/qa/data/korean-fonts.json` 안의 서체).
- 서체는 키트 항목이어야 한다: `registry/factory/fonts/font-<이름>.json`. `item` 칸에 항목 이름을, `weight` 에 그 항목이 가진 굵기를 적는다.
- 키트에 없는 서체가 필요하면 항목 파일을 새로 만든다. 방법은 `docs/recipes/dna/fonts-assignment.md` 의 「키트 추가 시 주의」에 있다. 이 문서의 예시는 키트에 있는 서체만 쓴다.

```sh
grep -rhoE "item: font-[a-z0-9-]+" registry/factory/recipes | sort -u
```

## 4단계. 색을 정한다

- 색 논리 `colorLogic`(K1~K9)과 모션 `motion`(M0~M3)을 고른다. 이 예시는 가장 단순한 `K1`·`M1` 이다.
- `color.light` 와 `color.dark` 는 키가 같아야 하고, 값은 모두 `oklch(...)` 로 쓴다. 필수 키는 `background`·`foreground`·`card`·`popover`(각 `-foreground` 짝)·`primary`·`secondary`·`muted`·`accent`(각 `-foreground` 짝)·`muted-foreground`·`destructive`·`border`·`input`·`ring` 과 상태색 `success`·`warning`·`info`(각 `-foreground` 짝)이다.
- `npm run gen:all` 이 대비를 잰다. 본문 글자와 바탕은 7:1, 그 밖의 글자 짝은 4.5:1, `ring`·입력 테두리는 3:1 이상이다. 위반은 `FAIL`, 목표 미달은 `WARN` 으로 나온다. `WARN` 은 통과한다.
- 따뜻한 색(색상각 60~95°)의 바탕은 채도 C 를 0.012 이하로 둔다(`palette-cream`). Tailwind 기본 스케일의 색을 그대로 복사하면 안 된다(`palette-tailwind`).
- 레시피가 이미 많이 쓰는 모양(거의 흰 바탕 + 잉크 주색)으로 쏠리지 않게 `qa:diversity` 가 분포를 본다. 상한은 벌 수에 비례한다.

## 5단계. 새 히어로 장면을 더한다

히어로 id 는 구성을 말하는 이름으로 짓는다(레시피 이름이 아니다). 기존 id 와 달라야 하고, 꼴은 소문자·숫자·가운데 줄이다.

**5-1. 카탈로그 표에 한 줄 더한다.** `factory/scripts/recipe.mjs` 의 `export const HEROES = {` 바로 아래 줄에 넣는다. 순서는 상관없다.

```js file=factory/scripts/recipe.mjs after="export const HEROES = {"
  'offset-card-stack': { label: '어긋나게 쌓인 카드 3장 + 왼쪽 정렬 제목' },
```

**5-2. 틀 파일 한 벌을 만든다.** 파일 이름은 히어로 id 와 같고, 기본 내보내기로 `HeroProps`(`r` 레시피 부품 · `o` 이 얼굴의 면·기법 · `zone`)를 받는 컴포넌트를 둔다.
머리·다음 칸 머리·면 구획 조각은 `app/qa/recipes/heroes/parts.tsx` 에 있다. 색은 레시피 토큰(`bg-card`·`text-muted-foreground` …)만 쓰고 `white`·`black`·`rgb()` 를 쓰지 않는다.

```tsx file=app/qa/recipes/heroes/offset-card-stack.tsx
// 검수대 히어로 틀(예시): 어긋나게 쌓인 카드 세 장 + 왼쪽 정렬 제목. 블록 없이 레시피 부품(r.ui.*)과 레시피 토큰만 쓴다.
import { Face, HeroFrame, NavLinks, NextHint, faceAt } from "./parts"
import type { HeroProps } from "./types"

const CARDS = [
  { title: "평일 오전", body: "문을 여는 시간과 오늘의 안내를 한곳에서 봅니다(예시)." },
  { title: "찾아오는 길", body: "정류장에서 걸어서 오 분, 입구는 파란 간판 쪽입니다(예시)." },
  { title: "처음 오셨다면", body: "접수대에서 이름만 말씀해 주세요(예시)." },
]

export default function OffsetCardStack({ r, o }: HeroProps) {
  const { Button } = r.ui.button
  return (
    <HeroFrame>
      <header className="flex h-16 items-center gap-6 px-6 md:px-10">
        <p className="font-heading text-lg">동네 안내판(예시)</p>
        <NavLinks items={["안내", "오시는 길", "문의"]} className="ms-auto hidden text-sm md:flex" linkClass="hover:underline underline-offset-4 aria-[current=page]:font-bold" />
      </header>
      <section aria-label="첫 화면" className="px-6 pt-10 pb-16 md:px-10">
        <h1 className="font-heading max-w-[14ch] text-[clamp(2.5rem,7vw,5.5rem)] leading-[0.95]">오늘 필요한 안내가 한 장에</h1>
        <p className="mt-4 max-w-[48ch] leading-[1.7]">시간, 길, 접수 방법을 카드 세 장으로 정리했습니다(예시).</p>
        <Button className="mt-6">안내 보기</Button>
        <ul className="mt-12 grid gap-4 md:grid-cols-3">
          {CARDS.map((c, i) => (
            <li key={c.title} style={{ marginTop: `${i * 1.5}rem` }}>
              <Face k={faceAt(o, i)} fallback="bg-card text-card-foreground border" className="rounded-lg p-5">
                <h2 className="font-heading text-xl">{c.title}</h2>
                <p className="mt-2 text-sm leading-[1.7]">{c.body}</p>
              </Face>
            </li>
          ))}
        </ul>
      </section>
      <NextHint label="이용 안내" title="처음이어도 어렵지 않습니다" body="접수부터 안내까지 십 분이면 충분합니다. 궁금한 점은 접수대에서 바로 물어보세요(예시)." className="bg-background" />
    </HeroFrame>
  )
}
```

기존 히어로를 블록으로 만들어 두는 방식(`registry/factory/blocks/hero/`)은 이 단계에 필요 없다. 그 방식을 따르는 저장소 시험은 9단계에 적었다.
이 히어로가 B 얼굴(`alternates.hero`)에만 쓰이는 경우에도 같은 두 곳에 등록한다.

## 6단계. 레시피 파일을 쓴다

`registry/factory/recipes/<id>/DESIGN.md` 를 만든다. 머리 칸의 뜻은 이렇다.

| 칸 | 뜻 |
|---|---|
| `id` · `name` · `mood` | 폴더 이름과 같은 id · 이름 · 분위기 낱말 3개 |
| `axes` | 2단계의 축 7개 |
| `motion` · `colorLogic` · `dynamics` | 모션 · 색 논리 · 역동 기법 1~3개(`recipe.mjs` `DYNAMICS`) |
| `signature` · `hero` | 대표 장면 1~3개(첫 칸은 `hero`) · 5단계의 히어로 id |
| `icons` · `fonts` · `color` | 아이콘 · 3단계의 서체 · 4단계의 색 |
| `references` | 근거 2개 이상(카드 id 또는 경로·주소) |
| `archetypes` | 맞는 원형 1개 이상. `registry/factory/archetypes/` 의 파일 이름이다 |

본문에는 `## 분위기` · `## 쓰는 법` · `## 하지 말 것` · `## 레퍼런스에서 가져온 기법` 네 절이 모두 있어야 한다.

```yaml file=registry/factory/recipes/r17-signpost/DESIGN.md
---
id: r17-signpost
name: 안내판
mood: [안내, 따뜻, 또렷]
axes: { radius: R1, button: B2, input: I1, surface: C1, table: T1, header: H5, shadow: S3 }
motion: M1
colorLogic: K1
dynamics: [clip-reveal]
signature: [hero, ledger]
hero: offset-card-stack
icons: { library: lucide, weight: G1 }
fonts:
  display: { family: "Londrina Solid", item: font-londrina-solid, weight: 400, tuned: "첫 화면·섹션 제목 전용. 굵기 400, 행간 0.95" }
  displayKo: { family: "Jua", item: font-jua }
  body: { family: "Noto Sans KR", item: font-noto-sans-kr, tuned: "본문 16px/1.7 굵기 400·700" }
color:
  light:
    background: "oklch(0.9500 0.0120 85.00)"
    foreground: "oklch(0.2200 0.0300 60.00)"
    card: "oklch(0.9800 0.0100 85.00)"
    card-foreground: "oklch(0.2200 0.0300 60.00)"
    popover: "oklch(0.9800 0.0100 85.00)"
    popover-foreground: "oklch(0.2200 0.0300 60.00)"
    primary: "oklch(0.4000 0.0900 200.00)"
    primary-foreground: "oklch(0.9800 0.0100 200.00)"
    secondary: "oklch(0.9200 0.0250 85.00)"
    secondary-foreground: "oklch(0.2200 0.0300 60.00)"
    muted: "oklch(0.9200 0.0250 85.00)"
    muted-foreground: "oklch(0.4200 0.0300 60.00)"
    accent: "oklch(0.9000 0.0500 70.00)"
    accent-foreground: "oklch(0.3000 0.0800 60.00)"
    border: "oklch(0.6000 0.0300 70.00)"
    input: "oklch(0.5200 0.0300 70.00)"
    ring: "oklch(0.4000 0.0900 200.00)"
    destructive: "oklch(0.5 0.19 27)"
    success: "oklch(0.5 0.1 155)"
    success-foreground: "oklch(0.985 0.005 155)"
    warning: "oklch(0.55 0.12 60)"
    warning-foreground: "oklch(0.985 0.005 60)"
    info: "oklch(0.47 0.15 255)"
    info-foreground: "oklch(0.985 0.004 255)"
  dark:
    background: "oklch(0.2000 0.0200 60.00)"
    foreground: "oklch(0.9400 0.0150 85.00)"
    card: "oklch(0.2400 0.0220 60.00)"
    card-foreground: "oklch(0.9400 0.0150 85.00)"
    popover: "oklch(0.2400 0.0220 60.00)"
    popover-foreground: "oklch(0.9400 0.0150 85.00)"
    primary: "oklch(0.7800 0.0900 200.00)"
    primary-foreground: "oklch(0.1800 0.0300 200.00)"
    secondary: "oklch(0.2800 0.0250 60.00)"
    secondary-foreground: "oklch(0.9400 0.0150 85.00)"
    muted: "oklch(0.2800 0.0250 60.00)"
    muted-foreground: "oklch(0.7400 0.0250 80.00)"
    accent: "oklch(0.3400 0.0500 70.00)"
    accent-foreground: "oklch(0.9400 0.0300 80.00)"
    border: "oklch(0.5200 0.0300 70.00)"
    input: "oklch(0.6000 0.0300 70.00)"
    ring: "oklch(0.7800 0.0900 200.00)"
    destructive: "oklch(0.7 0.16 25)"
    success: "oklch(0.74 0.11 155)"
    success-foreground: "oklch(0.19 0.02 155)"
    warning: "oklch(0.8 0.12 75)"
    warning-foreground: "oklch(0.2 0.03 75)"
    info: "oklch(0.74 0.12 255)"
    info-foreground: "oklch(0.19 0.014 255)"
references:
  - docs/inputs/style_axes.md#K1
  - docs/recipes/dna/index.md
archetypes: [local, landing]
---

## 분위기

따뜻한 모래색 바탕에 짙은 청록 주색 하나를 쓰는 안내판 같은 화면이다. 글자는 먹갈색이고, 강조는 주색 한 점이다.

## 쓰는 법

- 맞는 원형은 동네 가게·시설 안내(local)와 한 가지를 알리는 한 쪽짜리 소개(landing)이다.
- 첫 화면은 히어로 `offset-card-stack` 이다: 왼쪽 정렬 제목 아래에 카드 세 장이 조금씩 어긋나게 쌓인다.
- 모션은 M1 이다. 카드는 위에서 걷는 clip-reveal 로 등장하고, 동작 줄이기에서는 완성된 채 보인다.

## 하지 말 것

- 주색을 두 가지로 늘리지 않는다. 버튼·링크·강조는 청록 하나다.
- 카드 그림자를 겹쳐 쌓아 깊이를 만들지 않는다. 어긋남으로만 깊이를 준다.

## 레퍼런스에서 가져온 기법

- 안내판 : 큰 제목 한 줄과 짧은 설명 한 줄, 그 아래 카드가 한 묶음이다.
```

B 얼굴(`alternates`)은 선택이다. 쓰려면 `registry/factory/recipes/r1-measure/DESIGN.md` 의 `alternates` 칸을 본보기로 삼는다. 이 절의 예시는 쓰지 않는다.

## 7단계. 생성하고 검사한다

아래 명령을 차례로 돌린다. 모두 종료 코드 0 이어야 한다. `npm run gen:all` 은 약 1분이 걸리고, 끝에 차이·서체·히어로·다양성 검사를 함께 돈다.

```sh run
npm run gen:all
npm run qa:distinct
npm run qa:diversity
npm run blocks:check
npm run qa:recipes
```

- 실패 문장은 규칙 id 로 시작한다(`schema`·`compat`·`palette-cream`·`contrast`·`font-weight` …). 그 문장이 가리키는 칸만 고치고 다시 돌린다.
- `qa:recipes` 는 히어로 틀 파일이 있는지, 카탈로그 id 마다 틀이 이어지는지 본다. `prebuild`·`predev`·`pretypecheck` 가 자동으로 돌리기도 한다.
- `gen:all` 이 새로 쓰는 생성물은 `registry/factory/r/registry.json` · `registry/factory/r/<id>/` · `registry/factory/recipes/<id>/README.generated.md` · `ai/tasks/*.json` · `references/styles/presets.json` · `references/palettes/recipe-derived.json` · `references/fonts/pairs.json` 이다. 원천과 함께 커밋한다.

## 8단계. 화면으로 본다

화면 확인은 선택이고 무겁다(`next` 개발 서버와 브라우저가 필요하다). 먼저 타입 검사를 돌린다.

```sh
npm run typecheck
```

개발 서버(`npm run dev`)를 띄우고 `/qa/recipes?r=<id>` 를 연다. 첫 화면은 `&scene=hero`, B 얼굴은 `&alt=B`, 어두운 테마는 `&theme=dark` 를 붙인다.

## 9단계. 저장소 시험을 맞춘다

7단계까지가 `gen:all` 이 닫히는 조건이다. 이 저장소에 정식으로 더하려면 `npm run ci:verify` 도 0 이어야 한다.
아래 시험은 지금(2026-10-11, 레시피 15벌·히어로 24개 기준) 개수나 규약을 고정해 두고 있다. 새 레시피를 더하면 이 값을 함께 고친다.
시험 이름으로 찾는다.

| 시험 파일 | 고정한 것 | 할 일 |
|---|---|---|
| `factory/scripts/recipes-confirmed.test.mjs` | 라이브러리 레시피 수 15 · 히어로 블록 중 `titleWidth` 전폭 집합(A20) | 수를 고친다. 히어로를 블록으로 만들었다면 그 블록 메타에 `titleWidth` 를 적는다 |
| `factory/scripts/recipe-task8.test.mjs` | B 얼굴이 없는 레시피는 `r5-celadon` 하나(A10) · 히어로 CSS 위생이 `registry/factory/blocks/hero/<id>.tsx` 를 읽음 | 새 레시피에 `alternates` 를 적는다. 히어로마다 블록이 있어야 하는 시험이라 블록을 만든다 |
| `factory/scripts/gen-recipes-gallery.test.mjs` | 모든 카탈로그 히어로 틀이 `.tmp/blocks/<레시피>/hero/<id>` 블록 사본을 부른다 | 히어로를 블록(`registry/factory/blocks/hero/`)으로 만들고 틀이 그 사본을 부르게 한다 |
| `factory/scripts/blocks.test.mjs` | 히어로 종류의 목록(`HERO_IDS` ∪ `MOTION_HEROES` ∪ `FV1_HEROES`) | 목록 기댓값에 새 히어로를 더한다 |
| `docs/recipes/dna/check-unique.mjs` | 레시피마다 DNA 카드 `docs/recipes/dna/<id>.md` 와 `index.md` 한 줄 | 카드를 쓴다(사이트·팔레트·서체·히어로 수가 다른 카드와 겹치지 않게) |

히어로를 블록으로 만드는 방법은 아래 「새 블록 한 개 더하기」를 따른다. 블록 없는 틀(5-2)로도 `gen:all` 과 `qa:recipes` 는 닫히지만, 위 표의 시험 세 개는 블록을 기대한다.

## 새 블록 한 개 더하기

블록은 `registry/factory/blocks/<kind>/<variant>.*` 파일 세 개로 이루어진다. 본보기가 될 같은 kind 의 블록을 복사해 이름을 바꾼다.

1. `<variant>.tsx`: 렌더 컴포넌트. 컴포넌트 이름은 kind·variant 의 파스칼 표기(예: `hero/video-montage` → `HeroVideoMontage`)이고, 뿌리에 `data-block="<kind>-<variant>"` 를 둔다.
2. `<variant>.block.json`: 메타. `variant` 를 새 이름으로 바꾸고, **`layout` 은 다른 블록과 겹치지 않는 새 값**으로 바꾼다(겹치면 `gen:all` 이 거부한다).
3. `<variant>.fixture.ts`: 예시 콘텐츠(`fixture`·`fixtureMax`·`fixtureMin`).

그 뒤 아래 두 명령이 0 이어야 한다. `_compiled/<kind>/<variant>.tsx` 가 생기면 컴파일된 것이다. 부를 수 있는 층과 메타 칸의 전체 규칙은 `docs/agents/agent-guide.md` 의 `registry/factory/blocks/` 행에 있다.

```sh
npm run gen:all
npm run blocks:check
```

---

## English

This guide shows how a person or an agent adds one recipe, including one new hero scene.
The test `factory/scripts/add-recipe-guide.test.mjs` applies the code blocks of this file to a copy of the repository and checks that `npm run gen:all` exits 0.
If the guide and the code drift apart, that test fails. The code blocks above are shared by both languages.

### What to know first

- A recipe has one source file: `registry/factory/recipes/<id>/DESIGN.md`. The YAML head sets the values. The body explains how to use the recipe.
- If you copy a recipe and change only the name and the colour, `npm run gen:all` refuses it. There are three checks.
  1. Difference check: against every existing recipe, at least 2 of the 7 axes differ, and the colour or the typeface differs.
  2. Typeface-unique check: the display typeface (`fonts.display`) and the Korean display typeface (`fonts.displayKo`) must not repeat across the A and B faces of any recipe.
  3. Hero-unique check: one hero scene belongs to one place only (one face of one recipe). Every hero in the catalog is in use, so a new recipe needs a **new hero scene**.
- Do not edit generated files. Edit the source and run `npm run gen:all`.
- A hero scene is registered in two places only: one line in the `HEROES` table of `factory/scripts/recipe.mjs`, and one frame file `app/qa/recipes/heroes/<hero id>.tsx`. `gen-recipes-gallery` reads the table and wires the frame files. It stops if a frame file is missing.

### Steps

1. **Name.** Folder name = id = `r<next number>-<name>` (`ls registry/factory/recipes`).
2. **Axes.** Pick the 7 axes (`radius`, `button`, `input`, `surface`, `table`, `header`, `shadow`; values in `registry/factory/styles/compat.json`). They must differ in at least 2 axes from every existing recipe, and must pass `node factory/scripts/compat.mjs ...`. Do not mix the angular family (`R0`, `B1`, `I3`, `C2`, `T4`, `H3`, `S2`, `C6`, `C8`) with any other value. `H4` is for the `dashboard` archetype only.
3. **Typefaces.** `display` and `displayKo` must be unused by every other recipe (both faces). Use font kit items from `registry/factory/fonts/` and weights the item has. `body` may repeat, but it must draw Korean.
4. **Colour.** Choose `colorLogic` and `motion`. Give `color.light` and `color.dark` the same keys, all in `oklch(...)`. Contrast is measured by `gen:all` (`FAIL` stops, `WARN` does not). Warm backgrounds (hue 60 to 95 degrees) need chroma at most 0.012.
5. **New hero scene.** Add one line to `HEROES` (block 5-1) and one frame file (block 5-2).
6. **Recipe file.** Write `DESIGN.md` (block in step 6). It needs the four body sections: `## 분위기`, `## 쓰는 법`, `## 하지 말 것`, `## 레퍼런스에서 가져온 기법`.
7. **Generate and check.** Run the five commands in step 7. All must exit 0. Commit the generated files together with the source.
8. **See it (optional, heavy).** `npm run typecheck`, then open `/qa/recipes?r=<id>` on the dev server.
9. **Repository tests.** `gen:all` is the first gate. To merge the recipe into this repository, `npm run ci:verify` must also pass. Some tests pin the number of recipes and the hero rules. See the table in step 9 and update those values.

### Adding one block

Copy a block of the same kind (`<kind>/<variant>.tsx`, `.block.json`, `.fixture.ts`). Rename the component, set the new `variant`, and give `layout` a value no other block has. Then run `npm run gen:all` and `npm run blocks:check`. The full rules are in the `registry/factory/blocks/` row of `docs/agents/agent-guide.md`.
