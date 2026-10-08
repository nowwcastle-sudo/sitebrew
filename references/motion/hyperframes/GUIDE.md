# web-factory 에서 hyperframes 쓰기 — 절차서

작성 2026-10-03 · HFRES 레인 · 기준 CLI `hyperframes@0.8.111` · 이 PC(Windows 11, i7-12700K 20스레드, RAM 31.8GB, Node 24.13, ffmpeg 8.1.2)에서 직접 돌린 것만 「실측」으로 적었다.
표기: **[실측]** 이 PC 에서 돌려 확인 · **[공식]** HeyGen 문서·저장소에서 읽음 · **[미검증]** 읽기만 했거나 돌려 보지 않음. 근거 링크는 `sources.md` 번호, 장면 후보는 `templates.json`, 돌린 예제는 `examples/`.

## 0. 한눈에

1. hyperframes 는 **HTML 한 장(+GSAP 타임라인)을 헤드리스 Chrome 이 프레임마다 찍어 ffmpeg 로 굽는** 영상 도구다. 같은 입력이면 같은 프레임이 나온다. 라이선스 Apache-2.0(렌더당 과금·인원 제한 없음). [공식, sources 1·7]
2. web-factory 에서는 **히어로·구간용 짧은 영상(≤8초)과 소셜 공유 영상을 브리프 사실로 찍어내는 렌더 단계**로 쓴다. 출력은 기존 `factory/media/build-media.mjs` 가 H.264 + VP9 + 포스터(≤3MB)로 다시 맞추고 블록 `VideoSlot` 에 넣는다. 이 연결은 **이 PC 에서 끝까지 돌려 통과했다**(부록 A, `overBudget []`).
3. 브리프 사실은 `data-composition-variables` 로 선언하고 `render --batch rows.json --strict-variables` 로 한 번에 N개 찍는다. [실측]
4. **히어로 배경에 글자를 굽지 않는다.** 히어로 블록은 h1·CTA 를 이미 그린다. 글자 템플릿은 소개 구간·소셜·OG 에 쓰고, 영상 속 글자는 반드시 같은 쪽 DOM 글로도 둔다(6절).
5. **영상의 0초 프레임이 포스터이자 LCP 이자 동작 줄이기 정지 그림이다.** 0초가 비어 있으면 포스터가 빈 화면이 된다(이번에 실제로 겪음, 3절 S5).
6. 렌더 비용(이 PC): 8초 1080p30 영상 1개에 **약 15~25초**, 원본 mp4 1.5~1.9MB(합성 영상 위 로어 서드는 7.1MB), build-media 거친 뒤 mp4 0.6~2.2MB·webm 0.2~1.5MB. 가장 큰 위험은 속도가 아니라 **한글 폰트 준비·첫 프레임 규칙·`init` 의 전역 스킬 덮어쓰기**다(4절).

## 1. 무엇인가

| 항목 | 내용 | 확인 |
|---|---|---|
| 정체 | HTML·CSS·미디어·시크 가능한 애니메이션 → 결정적 MP4. GSAP·CSS·Lottie·Three.js·Anime.js·WAAPI 어댑터 | 공식 1 |
| 요건 | Node ≥ 22, FFmpeg, 헤드리스 Chrome(CLI 가 관리). 빌드 단계 없음 | 공식 1·33, 실측(Node 24.13) |
| 라이선스 | 도구 Apache-2.0. Remotion 은 4인 이상 회사 유료(소스공개 라이선스) | 공식 7, 제3자 70 |
| 출력 | `mp4`(H.264, 기본) · `webm`(VP9 + **알파**) · `mov`(ProRes 4444 알파) · `gif` · `png-sequence` · `hls`. fps 24/30/60, 기본 30 | 공식 10, 스킬 문서 |
| 알파 | webm 은 **브라우저에서만** 알파가 보인다(편집기는 검게 보임, Safari 미지원). 투명 출력은 html·body·root 에 배경을 칠하지 않아야 한다 | 공식 11, 실측(부록 A) |
| 품질 | `--quality draft` 반복용 · `looks`(기본, CRF 16) · `delivery`(high) | 스킬 `preview-render.md` |
| 크기·길이 | 크기는 루트 `data-width/height`, 길이는 루트 `data-duration` — **변수로 바꿀 수 없다**(컴파일 때 한 번 읽음) | 공식 18·22 |
| 규모 | 로컬 · HeyGen 클라우드(분당 과금) · AWS Lambda · Cloud Run. 분산 렌더는 Remotion 이 더 성숙 | 공식 36·34, 제3자 75 |
| 카탈로그 | 블록·컴포넌트 97개(셰이더 전환 14·로어 서드·소셜 카드·차트·지도 등). `npx hyperframes catalog --query "<영어로 원하는 움직임>"` | 공식 45 |
| 도입 | HeyGen·tldraw(PR 영상 자동화)·TanStack(검토 중)·reap | 공식 40 |
| 저장소 지표 | 별 43.7k·55.7k 두 값을 서로 다른 시점에 봄, 0.8.x 대(조사 시점 0.8.111) | 공식 1 |

## 2. web-factory 에 넣을 것 — 우선순위

| 순위 | 넣을 것 | 이유 | 현재 상태 |
|---|---|---|---|
| 1 | **글자 없는 히어로·구간 배경 영상**(켄 번스 사진 몽타주, 실사 영상 + 막) 렌더 → build-media → VideoSlot | 블록 `VideoSlot`·build-media 예산·포스터·보일 때만 재생이 이미 있다. 빠진 것은 「영상을 만드는 단계」뿐이고 hyperframes 가 그 단계를 브리프 사실·대표 사진으로 결정적으로 채운다 | 켄 번스 예제 lint·렌더 통과(check 는 이름 포스터 예제에서만 돌림), build-media 연결은 합성 영상으로 통과(부록 A) |
| 2 | **브리프 사실 → 소셜·OG·소개 구간 영상**(이름 포스터·로어 서드·숫자 카운트업) 일괄 렌더 | `--batch --strict-variables` 가 사실 칸 오타를 렌더 전에 막고 사업체 N곳을 한 번에 굽는다. 글자 템플릿은 히어로가 아니라 여기에 맞다 | 이름 포스터 2행 배치 통과 |
| 3 | **투명 로어 서드 webm**(웹페이지 안 영상·사진 위 이름표) | 영상에 구운 글자와 달리 문구 변경 시 가볍고, 알파가 브라우저에서 확인됨 | 렌더·알파 픽셀 확인 통과. Safari 대체(정지 이름표)는 별도 필요 |

하지 말 것: 히어로 배경에 가게 이름·한 줄 소개를 굽기 · 자주 바뀌는 사실(영업시간·가격)을 영상에 굽기 · 슬라이드 덱을 `render` 로 굽기(첫 장만 나오고 조용히 잘린다, 공식 121) · 소리 있는 영상(web-factory 영상은 소리 없음).

## 3. 절차

### S0. 장면 고르기
`templates.json` 에서 원형·자리에 맞는 템플릿을 고른다. `facts` 가 브리프에 없으면 그 템플릿은 고르지 않는다(지어내지 않는다). `heroBackground` 가 `avoid` 인 것은 히어로 전폭 배경에 쓰지 않는다.

### S1. 작업 폴더 (init 없이)
`hyperframes init` 은 **전역 스킬을 덮어쓴다**(4절 함정 1). 그래서 `hyperframes.json` + `meta.json` 을 복사해 시작한다 — 이 방식으로 만든 폴더 3개에서 lint·render 가 돌았다 [실측]. `check` 는 `init` 으로 만든 이름 포스터 폴더에서만 돌렸고 복사 폴더에서는 안 돌렸다.
```bash
# 예: 새 템플릿 폴더 <t>
mkdir -p <t>/assets && cp examples/kinetic-name-poster-loop/hyperframes.json examples/kinetic-name-poster-loop/meta.json <t>/
```
`init` 을 꼭 써야 하면 환경 변수 `HYPERFRAMES_SKIP_SKILLS=1` 을 먼저 둔다(`--skip-skills` 플래그는 「일시 무시」라고 도움말에 적혀 있다) — **이 값은 돌려서 확인하지 않았다** [미검증, `init --help` 기준].

### S2. 폰트 — 한글은 직접 싣는다
- 공식이 미리 묶어 둔 18개 폰트에 **한글은 없다**(Noto Sans JP 뿐). 한글 이름의 구글 폰트는 렌더 때 인터넷에서 받아 오고 lint 경고가 난다 — 분산·오프라인에서는 실패한다. [공식 skill typography]
- 정석: 로컬 파일 + `@font-face`. 이 PC 에서는 npm `@fontsource/noto-sans-kr`(라이선스 OFL-1.1, `package.json license` 확인)의 `700.css` 와 `files/*-700-normal.woff2` 125개(합계 2.6MB)를 `assets/` 로 복사하고 CSS 의 `url()` 만 `./fonts/…woff2` 로 고쳤다 [실측]. web-factory 서체 후보는 `references/fonts/fonts.json`(94개 한글) — 라이선스가 영상 삽입·임베드를 허용하는지는 서체마다 `docs/qa/font-licenses.md` 로 확인한다.
- 글자 폭을 재서 크기를 맞출 때는 **폰트 로드를 기다린 뒤** 잰다: `document.fonts.load('700 100px "Noto Sans KR"', 쓸글자).then(()=>document.fonts.ready).then(…타임라인 만들고 등록…)`. 기다리지 않으면 대체 폰트 폭으로 재서 `check` 가 `text_box_overflow` 를 낸다 [실측 — 부록 A check #1].

### S3. 브리프 사실 주입
```html
<html data-composition-variables='[
  {"id":"name","type":"string","label":"출력 파일 이름(slug)","default":"hero"},
  {"id":"store_name","type":"string","label":"가게 이름","default":"달빛 베이커리","maxLength":14},
  {"id":"tagline","type":"string","label":"한 줄 소개","default":"매일 새벽 구운 빵","maxLength":22},
  {"id":"accent","type":"color","label":"포인트 색","default":"#f2b84b"}]'>
```
- 글자: `data-var-text="tagline"`(요소 자신의 글 교체) 또는 `window.__hyperframes.getVariables()`. 색: 스칼라 변수는 자동으로 `--accent` CSS 변수가 된다. 이미지: `data-var-src`. 변수 타입 7종(string·number·color·boolean·enum·font·image). [공식 18·19]
- **함정**: 같은 요소에 `data-var-text` 를 달고 JS 로 글자를 `<span>` 으로 쪼개면 **글이 두 번 찍힌다**(자식은 보존되고 변수 글이 덧붙는다) — 「달빛 베이커리달빛 베이커리」로 렌더돼 실제로 겪었다. 쪼갤 요소는 `data-var-text` 를 빼고 JS 로만 채운다 [실측].
- `rows.json` 한 행 = 한 사업체. `--strict-variables` 는 **행의 모든 키(출력 이름 `{name}` 포함)가 선언돼 있어야** 통과한다 — 처음엔 `Variable "name" is not declared` 로 종료 1 (5.6초) [실측].
```bash
npx --yes hyperframes@0.8.111 render --batch rows.json --output "renders/{name}.mp4" --batch-concurrency 1 --strict-variables --workers 1 --quality looks
```
`manifest.json`(행별 변수·상태·시간)이 출력 폴더에 생긴다. 변수로 값만 바꾸는 단건은 `--variables '{"store_name":"…"}'`.

### S4. 문구 제약 (영상용)
- 글자 길이는 `maxLength` 로 막고 큰 글자는 `fit` 로 줄인다(예제는 폭 1600px 안에 한 줄 맞춤). 3초 보이는 글은 2초 안에 읽혀야 한다 — 낱말을 줄인다. [공식 skill typography]
- 브리프 사실 그대로만 쓴다(숫자·후기 지어내기 금지). 한 줄 소개가 없으면 `topic` 의 앞 구를 쓰지 말고 템플릿을 바꾼다.

### S5. 첫 프레임 = 완성 포즈 (poster-first)
build-media 는 **영상 첫 프레임**을 포스터(AVIF·WebP 폭별)로 만들고, 포스터가 첫 칠·LCP 후보·동작 줄이기 그림이다. 입장 애니메이션이 0초에서 시작하면 포스터가 빈 화면이다 — 실제로 빈 포스터(webp 2,156바이트)가 나왔고, 고친 뒤 15,584바이트가 됐다 [실측].
- 규칙: 0초 = 완성 레이아웃. 움직임은 중간(예: 4.6초 퇴장 → 5.4초 재입장)에 두고 **끝 프레임 = 첫 프레임**으로 맞춰 반복 이음매를 없앤다. 이 PC 첫·끝 프레임 SSIM 0.988(PSNR 32.6dB, 인코더 노이즈 수준) [실측].
- GSAP 함정: 나중에 시작하는 `tl.fromTo(...)` 는 기본이 `immediateRender: true` 라 **0초에 시작 상태를 먼저 적용**해 포스터를 비운다 → 늦은 `fromTo` 에는 `immediateRender: false`. 첫 장면 요소는 입장 트윈을 두지 않는다(`immediateRender:false` 여도 시작 전 보임 → 시작 순간 숨김 → 다시 보임으로 깜박인다).
- 투명 오버레이는 반대로 **첫·끝 프레임이 비어야** 한다(영상 위에서 깨끗이 사라져야 함).

### S6. 검사 관문
```bash
npx --yes hyperframes@0.8.111 lint     # 구조. 에러 0 이어야 check 가 레이아웃·대비를 잰다
npx --yes hyperframes@0.8.111 check    # 런타임·레이아웃·모션·대비(WCAG AA) — 종료 코드 0 이어야 렌더
```
- lint 에러가 있으면 check 의 레이아웃·대비 숫자가 `0 sample(s)` 로 나와 통과처럼 보인다 — 에러부터 지운다. [공식 skill core]
- 경고 `studio_missing_editable_id`(id 달기) · `nested_structure_needs_subcomposition`(타임라인 요소 안에 자식이 있음 — 다장면이면 장면마다 서브 컴포지션으로 분리)은 렌더를 막지 않는다. 한 장면 예제 4개는 경고 1~4개가 남은 채 렌더했다 [실측].
- 렌더는 `check` 통과 뒤. 공식 지침은 렌더 전에 미리보기 승인을 요구하나 web-factory 자동 단계는 `check` 종료 코드 0 + 첫 프레임 육안(스냅샷)으로 대신한다.

### S7. 렌더
```bash
npx --yes hyperframes@0.8.111 render --quality looks --workers 1 --output renders/hero.mp4
```
- 1080p·30fps·8초 = 240프레임. `--workers 1` 로 고정한다(8GB 이하 호스트는 자동으로 저메모리 프로필 → 워커 1·스크린샷 캡처, 공식 53). 워커가 여러 개면 워커 사이 프레임이 비트 단위로 같지 않다(±1레벨 미세 차) — 비트 동일이 필요하면 `--workers 1`. [공식 20]
- 렌더 요약 둘째 줄의 캡처 방식·GPU·단계 시간을 읽는다(예: `drawelement capture · hardware gpu · setup 1.6s · capture 10.5s`).
- 빌드는 `npx` 시동이 한 호출당 약 10초 얹힌다(배치 2행 벽시계 56~69초 vs 행 렌더 합 45~53초) [실측].
- 파일 확인: `ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate,pix_fmt -show_entries format=duration,size -of default=nw=1 out.mp4` → h264·1920×1080·30fps·yuv420p·8.000초 [실측].

### S8. 예산 맞춤 (build-media)
web-factory 의 `build-media.mjs` 가 내보내는 `videoAsset()` 을 그대로 부른다(`examples/fit-build-media.mjs` — sharp 는 `<sitebrew checkout>` 의 것을 빌려 쓴다, 출력은 별도 폴더):
```bash
node examples/fit-build-media.mjs <렌더mp4> <출력폴더> <recipe> <slot> 1920
```
규칙(`build-media.mjs` 코드): 소리 제거(`-an`) · **8초로 자름**(`-t 8`) · H.264 는 1920폭 crf 23 → 25, 그다음 1280폭 crf 23 → 25 → 27, VP9 는 같은 순서로 crf 36 → 38, 1280폭 36 → 38 → 40 · 형식마다 ≤ 3MB · 포스터 = 첫 프레임 → 폭 1440·960·480 AVIF+WebP(가장 큰 WebP ≤ 250KB). 실측 결과는 부록 A. 원본을 CRF 16 으로 구운 뒤 crf 23 으로 한 번 더 압축하므로 화질이 한 번 더 떨어진다 — 상관없다고 판단했으나 육안 비교는 안 했다 [미검증].
- 영상이 8초보다 길면 뒤가 잘린다 → 루트 `data-duration="8"` 로 맞춘다.
- 영상 원본이 합성하기 어려운 복잡한 실사면 렌더 mp4 가 커진다(합성 testsrc2 위 로어 서드 7.1MB → build-media 로 mp4 2.16MB·webm 1.47MB, 한 단계로 예산 통과).

### S9. 블록에 연결 (VideoSlot)
`media-sources.json` 칸 → `build-media` → `public/media/manifest.json` → `heroes/media.tsx` 의 `videoSlot(recipe, slot, { alt, decorative, focal, source })` 이 `VideoSlot`(mp4·webm·poster·loop·muted·width·height)로 바꿔 히어로 `media` props 로 넘긴다. 재생은 `MediaVideo` 가 맡는다: 포스터 위에 `<video preload="none" muted loop playsInline>`, **보일 때만·탭이 보일 때만·동작 줄이기가 아닐 때만** 재생, 동작 줄이기로 바뀌면 멈추고 0초로 되돌린다.
- **지금 없는 코드(이 레인은 고치지 않음)**: `media-sources.json` 의 `source` 는 `pexels`·`higgsfield` 둘뿐이고 `creditRow()` 가 그 둘만 안다. hyperframes 출력을 칸에 넣으려면 ① `source: "hyperframes"` + 폴더(`HYPERFRAMES_DIR`) ② `creditRow` 분기(`license`: 「Apache-2.0 도구로 합성, 내용은 공장 생성」+ 원본 영상·사진 출처 줄을 이어 적기) ③ `stamp/media.mjs` 가 칸마다 렌더하고 도구가 없으면 `hyperframes.request.json` 을 남기는 갈래(higgsfield.request.json 과 같은 모양)가 필요하다. 설계는 이 절까지, 구현은 다음 과제.
- `alt`: 영상에 글자가 없으면 `decorative: true`(aria-hidden). 글자를 구웠다면 `decorative: false` + `alt` 에 그 글 전체(영상 속 글자는 읽기 도구에 안 읽힌다) — 그리고 같은 사실을 DOM 글로도 둔다.

### S10. 출처 줄
영상에 실사 원본(Pexels)·Higgsfield 원본을 썼으면 `credits.json` 에 그 줄을 이어 적는다(hyperframes 렌더는 변환일 뿐 원본 라이선스를 지우지 않는다). 폰트(OFL-1.1 등)·GSAP(3.14.2 CDN, web-factory 는 3.15.0 고정 — `docs/qa/motion-licenses.md` 의 Standard 'No Charge' 라이선스) 줄도 `docs/qa` 표에 있는지 확인한다.

## 4. 알려진 함정

| # | 함정 | 근거 |
|---|---|---|
| 1 | **`hyperframes init` 이 전역 스킬을 덮어쓴다.** `~/.claude/skills/hyperframes*`(9개)를 다시 쓰고(수정 시각 00:17 — 내용이 이전과 달랐는지는 비교하지 못함), `~/.agents`·`~/.codex`·`~/.gemini`·`~/.copilot`·`~/.continue`·`~/.config/opencode` 의 `skills/` 에도 9개씩 넣거나 갱신한다(`.agents/.skill-lock.json` 갱신). 이 조사에서 `init` 한 번이 2분 40초 걸렸고 위 폴더들의 수정 시각이 00:17~00:18 로 바뀌었다 | 실측(수정 시각 목록) |
| 2 | 한글 폰트 폭을 폰트 로드 전에 재면 `check` 레이아웃 실패 | 실측 |
| 3 | `data-var-text` + JS 글자 쪼개기 = 글 두 번 | 실측 |
| 4 | `--strict-variables` 는 출력 이름 키까지 선언을 요구 | 실측 |
| 5 | 0초 프레임이 비면 포스터가 빈 화면 | 실측 |
| 6 | 서브 컴포지션이 자기 타임라인 끝난 뒤 검게 보일 수 있다(수정 이력 있음, 호스트가 더 길 때 잔존 이슈 #1540) | 공식 55 |
| 7 | ≤8GB 호스트에서 렌더가 멈추거나 5%·25% 에서 10분 정지(수정됨 — 0.8 대에서는 저메모리 프로필) | 공식 50~54 |
| 8 | `<video>` 에 `crossorigin`·타이밍 달린 조상 래퍼·`play()` 호출 금지, `<audio>` 에는 `id` 필수 | 공식 22, 스킬 core |
| 9 | 영상 요소의 width·height·top·left 를 직접 트윈하면 프레임이 멈춘다 → 감싸는 div 를 트윈 | 공식 22 |
| 10 | 슬라이드 덱(`/slideshow`)은 `render` 하면 첫 장만 조용히 잘린다 | 공식 121 |
| 11 | 알파 webm: `ffprobe` 의 `pix_fmt` 은 `yuv420p` 가 정상, 알파는 `ALPHA_MODE=1` 태그로 확인 | 공식 11, 실측 |
| 12 | GSAP 을 `cdn.jsdelivr.net` 에서 받는 예제 구조 — 렌더가 인터넷을 요구한다(오프라인·분산에서 실패 가능). web-factory 는 고정 버전 gsap 를 로컬 파일로 두는 편이 안전하나 **오프라인 렌더는 시험하지 않았다** | 미검증 |
| 13 | `check` 시간이 14초에서 2분 16초까지 흔들렸다(원인 확인 안 됨 — 같은 시간대 PC 부하 가능성) | 실측 |
| 14 | hyperframes.video 같은 제3자 사이트의 명령(`--variants`·`render-action` 등)은 공식 CLI 에 없다 — 따라 쓰지 않는다 | sources 2절 |

## 5. 접근성·성능 체크표 (영상을 블록에 넣을 때)

| 항목 | 규칙 | 근거 |
|---|---|---|
| 동작 줄이기 | `MediaVideo` 가 이미 처리: 정지 + 0초 포스터. **그래서 0초 프레임이 의미 있는 완성 그림이어야 한다**(S5). 글자를 구웠으면 정지 포스터만으로도 뜻이 통해야 한다 | web-factory `media.tsx`, wppoland 120 |
| 자막 | 소리 없는 영상이라 자막 불필요. 소리를 넣게 되면 영상 속 글자가 아니라 `<track>` 자막·대본 | 공식 skill media-use |
| 글자 중복 | 구운 글자 = 같은 쪽 DOM 글에도 존재. 히어로는 h1·CTA 가 있으니 전폭 배경에 이름을 또 굽지 않는다 | 이 문서 0절 |
| LCP | LCP 는 **포스터**(`priority` → `eager`·`fetchPriority=high`). 영상 파일은 `preload="none"`, 보일 때 재생 시작. 포스터는 AVIF·WebP | web.dev 116·117, 119 |
| 용량 | 형식마다 ≤ 3MB, 소리 제거(MDN: 소리 없는 영상은 트랙을 빼면 약 20% 절감), 모바일은 포스터만 보이는 갈래를 쓸 수 있으나 현재 `MediaVideo` 는 폭 조건이 없다 | build-media, MDN 118, wppoland 120 |
| 세이프존 | 세로 영상(릴스·쇼츠)은 플랫폼 UI 가 하단·우측을 가린다 — 수치는 공식 문서에 없어 확인 안 됨 | 템플릿 `vertical-hook-short` |
| 대비 | `check` 의 WCAG AA 대비 검사(글자 뒤 실제 픽셀 표본)를 통과해야 렌더. 이름 포스터 예제는 통과(37/37), 나머지 3개 예제는 check 미실행 | 실측 |

## 6. 패턴별 적용법

1. **히어로 배경 영상** — 글자 없는 켄 번스 몽타주(`ken-burns-photo-montage`, 대표 제공 사진 3장)나 실사 영상 + scrim. 글자를 얹지 않는다. 렌더 → S8 → S9. 키네틱 타이포·로어 서드는 히어로 배경이 아니라 소개 구간·소셜에. 글자 없는 그림 칸이 있는 히어로(`twin-panels`·`staggered-oval-frame`·`banded-full-bleed` 의 밴드)는 `pane` 으로 허용.
2. **소셜 공유·OG·쇼츠** — 세로 1080×1920(`vertical-hook-short`)·정사각 1080×1080·1200×630(`og-share-card-video`). 크기는 루트 `data-width/height` 라 **크기마다 별도 컴포지션**이다. 정지 OG 이미지(`og-image`)가 정본이고 `og:video` 는 플랫폼별 지원이 확인 안 됨 — 지금은 게시용 파일로만.
3. **Pexels 실사 위 합성** — `video-lower-third-over-footage`: `<video id class="clip" data-start data-duration muted playsinline>` + 형제 scrim + 로어 서드. 원본 영상은 로컬 파일(렌더 중 네트워크 금지, 공식 24). 이 PC 는 합성 영상(testsrc2)으로 시험했고 **Pexels 실제 영상으로는 안 돌렸다**(키·실사 사용 안 함). 실제 파일 크기·렌더 시간은 영상마다 다르다.
4. **브리프 사실 → 영상 문구 자동 생성** — 사실 칸 이름은 `factory/stamp/briefs` 의 `facts` 키 그대로(name·claim·address·hours·price·menu·metrics·awards·founded·story·notice·products). `rows.json` 변환기(브리프 → 행)는 아직 없다 — 첫 구현 때 `maxLength` 초과·빈 사실을 렌더 전에 걸러 템플릿을 바꾼다.
5. **제약** — 렌더 시간·용량은 6절 표. 라이선스: 도구 Apache-2.0, 서체·GSAP·원본 영상은 각자 라이선스(S10). 커뮤니티 템플릿 중 `hyperframes-motion-director` 는 AGPL-3.0(코드를 가져다 쓰지 않는다), `hyperframes-student-kit` 은 MIT 이되 AIS 브랜드 자산은 제외, 상용 게시 전 미디어 권리 확인이 필요하다고 스스로 적었다(sources 102·106).

## 7. 비용·용량·라이선스 한 표 (이 PC 실측 + 공식)

| 항목 | 값 | 확인 |
|---|---|---|
| 렌더 시간 | 1080p30 8초: 이름 포스터 21.6·24.7초 · 켄 번스 14.4초 · 합성 영상 + 로어 서드 25.9초 · 투명 webm(1280×720·5초) 27.4초 | 실측 |
| 호출 오버헤드 | 첫 `init` 2분 40초(스킬 링크 포함) · `lint` 약 10초 · `check` 14~24초(한 번 2분 16초) · `npx` 시동 약 10초/호출 | 실측 |
| 원본 용량 | mp4 1.55~1.95MB(CRF 16) · 합성 영상 위 7.1MB · webm 알파 5초 155KB | 실측 |
| build-media 뒤 | 이름 포스터: mp4 614KB · webm 192KB · 포스터 webp 15.6KB(1440)/10.1KB(960)/4.8KB(480) · 합성 영상: mp4 2.16MB · webm 1.47MB · 모두 `overBudget []` | 실측 |
| 3개 후보 × 영상 1개 | 렌더 약 25초 × 3 + build-media 12~18초 × 3 ≈ 2분(직렬) | 계산(실측 단가) |
| 메모리 | 이 PC 는 31.8GB 라 저메모리 프로필 아님. 최대 사용량은 재지 않았다. 호스트 RAM ≤ 8GB 이면 자동으로 워커 1·스크린샷 캡처 | 공식 53, 최대치 미측정 |
| 도구 라이선스 | Apache-2.0(상용 OK, 렌더당 과금 없음). 클라우드 렌더는 분당 과금 | 공식 1·36 |
| 폰트 | `@fontsource/noto-sans-kr` OFL-1.1 [실측: package.json]. 다른 서체는 `docs/qa/font-licenses.md` | 실측 |

## 8. 미검증·막힌 것·다음 과제

- Reddit 사례 0건(WebFetch 차단) · X 사례 0건(Exa 0건·로그인 필요) · YouTube 는 자막 발췌만(sources 2절).
- 실제 Pexels·Higgsfield 영상으로 합성한 렌더, Safari/모바일 실기기 재생, 오프라인 렌더, `HYPERFRAMES_SKIP_SKILLS=1` 효과, 카탈로그 블록 `add` 후 렌더, Docker(`--docker`)·클라우드는 돌리지 않았다.
- `ken-burns-photo-montage` 의 캡션을 비운 판(히어로용)은 구현하지 않았다.
- web-factory 코드 변경이 필요한 부분(S9): `source: "hyperframes"`·`creditRow`·`stamp/media.mjs` 갈래·브리프 → `rows.json` 변환기.
- 이 레인이 만든 것: 이 폴더의 `GUIDE.md`·`templates.json`·`sources.md`·`examples/`(예제 index.html 4개 + rows.json + fit 스크립트) 뿐이다. 스크래치 작업 폴더(렌더 mp4·폰트 125개)는 세션 임시 폴더에 있고 저장소에 넣지 않았다. 커밋하지 않았다.

## 부록 A. 이 PC 실측 로그 (2026-10-03 00:15~00:52)

모든 명령은 `npx --yes hyperframes@0.8.111 …`, 작업 폴더는 세션 스크래치(저장소 밖).

| # | 명령(요약) | 결과 |
|---|---|---|
| 1 | `--version` | `0.8.111` (콜드 18.5초) |
| 2 | `init wf-hero --non-interactive` | 종료 0 · **2분 40.8초** · 전역 스킬 6개 폴더 갱신(4절 1번) |
| 3 | `lint` (이름 포스터 1차본) | 에러 0 · 경고 4 · 9.7초 |
| 4 | `check` #1 (폰트 로드 안 기다림) | **종료 1** — `text_box_overflow`(span.ch 가 오른쪽 88px 넘침)·`canvas_overflow` · 1분 3.4초 |
| 5 | `check` #2 (`document.fonts.load` 후 측정) | 종료 0 — Runtime 0/0 · Layout 0 issues/9 samples · Motion 0 · Contrast 13/13 · 23.6초 |
| 6 | 단건 렌더 `--quality looks --workers 1` (0초 빈 프레임판) | 종료 0 · 8.0초 · 1,678,899바이트 · 렌더 39.0초 · ffprobe h264 1920×1080 30fps yuv420p 8.000초 |
| 7 | `render --batch rows.json … --strict-variables` (1차) | **종료 1** — `Variable "name" is not declared` · 5.6초 |
| 8 | 같은 배치(선언 후, `data-var-text` 중복 글 버그판) | 종료 0 · 행 2개 완료 — **육안 확인에서 글이 두 번 찍힌 것 발견**(3절 S3 함정) |
| 9 | `check`(중복 고침) | 종료 0 · 대비 34/34 · 14.6초 |
| 10 | build-media 연결(0초 빈 프레임판) | 종료 0 · 포스터 webp **2,156바이트(빈 화면)** — 5절 발견 |
| 11 | `check`(poster-first 타임라인) | 종료 0 · 대비 37/37 · 2분 16.8초 |
| 12 | 배치 최종(poster-first, `renders3/`) | 종료 0 · bakery 1,841,155바이트 24.7초 · clinic 1,948,757바이트 21.6초 · 육안 확인(clinic 3.5초 프레임: 이름·선·소개 모두 정상) |
| 13 | 첫·끝 프레임 비교 | SSIM 0.9877 · PSNR 32.57dB (완전 동일은 아님) |
| 14 | `fit-build-media.mjs` (bakery 최종) | 종료 0 · 12.0초 · mp4 613,584(crf 23, 1920) · webm 192,313(crf 36) · 포스터 webp 15,584/10,144/4,846 · avif 9,960/6,326/3,652 · `overBudget []` |
| 15 | 켄 번스 단건 렌더 | 종료 0 · 1,553,621바이트 · 14.4초 · `drawelement capture` · 0초 프레임 육안 확인(캡션 보임) |
| 16 | 합성 영상 + 로어 서드 렌더 | 종료 0 · **7,484,470바이트** · 25.9초 · 원본 bg.mp4 3.1MB(testsrc2 합성) |
| 17 | 위 렌더 → `fit-build-media.mjs` | 종료 0 · 18.1초 · mp4 2,164,785 · webm 1,473,702 · 포스터 webp 26,296 · `overBudget []` |
| 18 | 투명 오버레이 `render --format webm` (1280×720·5초) | 종료 0 · 158,452바이트(154.7KB) · 27.4초 · `ALPHA_MODE=1` · 코너(5,5) RGBA (0,0,0,0) · 카드 안(140,580) RGBA (9,7,5,185) · t=0 전체 알파 최댓값 0 |
| 19 | 예제 4개 `lint` | 에러 0 (경고 3·1·1) |

## 부록 B. 예제 파일
- `examples/kinetic-name-poster-loop/` — 이름 포스터(변수 5개 + `rows.json` 2행, `hyperframes.json`·`meta.json` 포함). 한글 폰트 CSS·woff2 는 넣지 않았다(S2 로 만든다).
- `examples/ken-burns-photo-montage/` — 사진 3장 켄 번스. 이미지(`assets/s1~s3.jpg`)는 넣지 않았다(ffmpeg `gradients` 합성 이미지로 시험).
- `examples/video-lower-third/` — `assets/bg.mp4` 가 필요(시험은 `ffmpeg -f lavfi -i testsrc2=size=1280x720:rate=30 -t 8` 합성).
- `examples/alpha-lower-third/` — 투명 webm 오버레이(루트에 배경 없음).
- `examples/fit-build-media.mjs` — `build-media.mjs` 의 `videoAsset()` 호출기(sharp 는 `<sitebrew checkout>` 의 것).
