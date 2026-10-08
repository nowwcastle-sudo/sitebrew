# references/fonts/ — 무료 상용 폰트 레퍼런스 (Task 10a, 2026-09-27 · 재료 확장 P3-2 Task 15m, 2026-09-29)

생성된 사이트가 AI가 만든 것처럼 보이는 가장 큰 이유는 모두 같은 서체를 쓴다는 점이다. 운영자 지시 원문은 이렇다.

> "sns 게시글에서 무료 상용 폰트 레퍼런스 사이트를 찾아서 긁어온 다음, 그 중에서 독특하고, 기존 서체와 궤를 달리하는 매력적인 폰트를 모두 긁어와서 web-factory 레퍼런스에 넣어놔."

`fonts.json`은 기준을 모두 통과한 서체만 담은 **선별본**이다. 살펴본 후보 전체(기각 포함, 기각 사유 포함)와 수집 도구는 저장소 밖 `design-rules\factory\fonts\`에 있다.

| 파일 | 내용 |
|---|---|
| `fonts.json` | 선별본. `counts`(한글·라틴·분류별·기각 수)와 `fonts[]` |
| `design-rules\factory\fonts\fonts.jsonl` | 살펴본 후보 전부. 기각은 `reject`에 사유를 적었다 |
| `design-rules\factory\fonts\sites.md` | 폰트 레퍼런스 사이트 목록. SNS 언급 수, 라이선스 정책, robots.txt 판정, 사용 방법을 적었다 |
| `design-rules\factory\fonts\sns_posts.jsonl` | 이번 SNS 수집 원본 |
| `design-rules\factory\fonts\validate.mjs` | 검사기. 종료 코드 0이 통과다. `--live`를 주면 배포 URL을 다시 요청한다 |
| `design-rules\factory\fonts\collect-report.md` | 수집 과정 보고 |

## 선별 규칙

1. **라이선스 1차 출처.** 상업 사용과 웹 임베딩이 모두 허용된다는 것을 **제작처 자신의 페이지**에서 확인했다. 인정한 출처는 Google Fonts의 `google/fonts` 저장소 `METADATA.pb`·OFL.txt, 폰트 자체의 GitHub 저장소 라이선스, Fontshare 라이선스 페이지, 네이버 한글한글 아름답게, 제작자 블로그다. 눈누 같은 모음 사이트의 요약은 2차 자료로만 썼다. 조건이 불분명하면 `commercial`·`webEmbedding`을 false로 두고 기각했다. 「무료」라고 추측하지 않았다.
2. **웹 배포 경로가 HTTP 200으로 응답.** Google CSS2 API, Fontshare CSS API, 네이버 공식 CDN, 제작자 npm 패키지, 제작자 GitHub 저장소(jsDelivr 경유), Fontsource 가운데 하나 이상이다(`verified.webfontStatus`·`webfontUrl`).
3. **실제로 그려짐.** 스페시먼 페이지에서 배포 경로로 서체를 불러와 `document.fonts.load` 뒤 `document.fonts.check('32px "<family>"', '가' | 'Ag')`가 true였다. 그리고 Chrome `CSS.getPlatformFontsForNode`에서 그 글리프를 그린 폰트가 웹폰트(`isCustomFont`)였다. 시스템 폰트로 대체되어 조용히 통과하는 경우를 막는다(`verified.renders`).
4. **기존 키트와 궤가 다름.** 키트 20종(Archivo·Black Han Sans·DM Sans·Gasoek One·Gothic A1·Gowun Dodum·Hahmlet·IBM Plex Mono/Sans/Sans KR·Jost·Jua·Manrope·Nanum Gothic/Myeongjo·Noto Sans/Serif KR·Pretendard(GOV)·Sora)은 후보가 아니다. Pretendard·Noto·Inter처럼 읽히는 평범한 네오그로테스크·고딕은 기각했다.
5. **AI 과다 사용 기본값.** Inter·Geist·Manrope·DM Sans·Plus Jakarta Sans·Space Grotesk·Poppins·Fraunces·Instrument Serif·Playfair·Cormorant·Lora·Syne·Montserrat·Roboto·Open Sans가 해당한다(`DESIGN.md` 693–705행 부근). `aiOverused: true`로 표시하고 기각했으며 40종 집계에 넣지 않는다.
6. **분포.** 한글과 라틴 각각에서 어느 분류도 30%를 넘지 않는다.

## 필드

| 필드 | 뜻 |
|---|---|
| `id` | 케밥 표기 식별자 |
| `family` | CSS `font-family`에 그대로 쓰는 이름. GitHub 파일을 직접 싣는 서체는 `@font-face`에서 이 이름을 선언한다 |
| `script` | `ko`·`latin`·`ko+latin`. 한글 집계는 `latin`이 아닌 것 전부다 |
| `foundry` | 제작처(배포처) |
| `category` | display-heavy·condensed·wide·serif-display·editorial-serif·slab·script-handwriting·brush·pixel·stencil·mono·rounded·geometric·experimental(블랙레터·탈네모 포함)·retro-techno(레트로 간판체 포함) |
| `styleTags` | 성격 태그. 한글 서체는 명조 디스플레이·붓글씨·손글씨·레트로 간판체·두꺼운 제목체·둥근체·픽셀·탈네모 같은 한국어 태그를 쓴다 |
| `weights` · `variable` | 굵기. 가변 서체는 `[min, max]`다 |
| `koreanCoverage` | `11172`(KS X 1001 밖 음절 똠·햏·뷁·쀍까지 웹폰트로 그려짐)·`2350`·`partial`. 라틴은 null. 렌더 검사에서 실측했다 |
| `license` | `type`, `url`(1차), `summary`(한 줄 한국어), `commercial`, `webEmbedding`, `note`(조건·제약) |
| `delivery` | `google`(css2 family 문자열), `fontsource`(npm 패키지), `npm`(제작자 패키지), `cdn`(공식 URL: Fontshare API·네이버 CDN·제작자 저장소 jsDelivr). 확장 필드는 둘이다. `cdnFiles`(GitHub 파일 여러 개)와 `mirror`(아래 주의 참고) |
| `foundOn` · `snsMentions` | 발견한 페이지 URL과, 서체 이름을 언급한 SNS 게시글 URL |
| `character` | 무엇이 다르고 어디서 빛나는지를 적은 한 줄 |
| `pairsWith` | 짝 후보(이 목록의 서체나 키트 서체) |
| `aiOverused` | AI 기본값 목록 해당 여부 |
| `verified` | `licenseCheckedAt`, `licenseCheckedBy`(사람이 브라우저로 확인한 경우만), `webfontStatus`, `webfontUrl`, `renders`, `renderDetail`(실제로 글리프를 그린 폰트) |
| `reject` | 선별본에서는 항상 null |

## 컨트롤러가 직접 확인한 라이선스 (2026-09-27 추가)

자동화 도구로는 1차 라이선스를 확인하지 못한 제작처가 셋 있었다. 컨트롤러가 일반 브라우저로 원문을 읽었고, 해당 항목에는 `verified.licenseCheckedBy: "controller (browser), 2026-09-27"`를 붙였다(fonts.jsonl에서는 기각 포함 21개). 선별된 것은 13종이다.

| 제작처 | 1차 라이선스 | 선별 |
|---|---|---|
| 배달의민족 | https://www.woowahan.com/fonts/license: SIL OFL 1.1, 웹페이지 사용 허용, 파일 판매만 금지 | 을지로체·을지로10년후체·을지로오래오래체·꾸불림체·한나체 Pro (5) |
| 여기어때 잘난체 | https://gccompany.co.kr/font의 라이선스 가이드 PDF: 웹페이지 ○, 임베딩 △ | 잘난체 (1). **폰트를 싣는 곳 옆에 저작권 표기와 라이선스 전문을 함께 둔다.** 폰트에 공백 글리프가 없다 |
| 카페24 | https://fonts.cafe24.com/의 「폰트 라이선스 안내」: 웹폰트 포함 사용범위 제한 없음, OFL 적용, 판매 금지 | 써라운드·클래식타입·모야모야·슈퍼매직·단정해·동동·쑥쑥 (7) |

13종 모두 공식 웹폰트 URL이 없어 `delivery.mirror`(눈누 jsDelivr)로 싣는다. 잘난체는 OFL이 아니다. 라이선스가 「라이선스 전문을 포함하면 재배포 가능」이라서만 미러를 쓸 수 있다(`license.redistributionWithLicense: true`). 검사기는 이 표시와 note의 「라이선스 전문」 문구가 없으면 OFL이 아닌 미러를 실패시킨다.

## 쓰기 전에 알아둘 것

- **Fontshare(ITF FFL 2.0) 서체**는 상업 사용과 자사 웹 임베딩이 허용된다. 그러나 서브셋, 포맷 변환, 재배포, 제3자(고객·SaaS 사용자) 제공은 금지다. 고객 사이트에 쓸 때는 Fontshare API로 직접 싣거나 고객이 직접 받아야 한다. `license.note`에 조항을 적어 두었다.
- **`delivery.mirror`**는 공식 웹폰트 URL이 없고 라이선스가 재배포를 허용하는 서체에만 쓴다(OFL, 또는 잘난체처럼 전문 동봉 조건의 재배포 허용). 눈누 jsDelivr 미러라 공식 경로가 아니다. 운영에서는 자체 호스팅을 권장한다. 현재 선별본에서 35종이 이 경로를 쓴다(2026-09-27 15종 + 재료 등록분 20종).
- **GitHub 직접 서체**(Collletttivo·uncut.wtf 출처)는 저장소 브랜치를 가리킨다. 레시피에 넣을 때는 태그나 커밋으로 고정하거나 자체 호스팅한다.
- 이 폴더는 레퍼런스다. 레시피·키트(`registry/factory/fonts/`)에 넣으려면 `docs/qa/font-licenses.md` 절차(라이선스 표·한글 실측)를 따로 밟는다.

## 재료 확장 (P3-2 Task 15m, 2026-09-29)

운영자 요청(2026-09-29): 「폰트 … sns(x, insta, thread)나 검색 엔진에서 찾아서 … 좋아요나 조회수 등 선호도를 알 수 있는 정량적 요소를 통해 선별해서 등록」. 목표는 한글 +30 · 라틴 +70이다.

**수(2026-09-29):** 선별본 398종 = 한글 94(+36) · 라틴 304(+93). 새로 넣은 129종에는 `batch: "materials-2026-09-29"`가 붙는다. `counts.batch`에 수와 기각 수가 있다.

| 출처 | 수 | 원천(저장소 밖 `design-rules\factory\materials\`) |
|---|---|---|
| fonts 레인 | 128(한글 35 · 라틴 93) | `fonts\fonts.candidates.json` — Google Fonts 인기·트렌드, jsDelivr 월 요청, 눈누 조회, Fontshare 조회, 큐레이션 목록. 후보 144, 기각 16(시각 판정 13 · 라이선스 확인 실패 1 · 파일 404 1 · 신호 없음 1) |
| SNS 한글(sns 레인에만 나온 서체) | 1 | 아직 등록되지 않은 한글 서체 가운데 새 SNS 점수기 순위 상위 24종을 fonts 레인 방식(1차 라이선스 URL · 상업+웹 임베딩 · 전달 200 · 2,350자)으로 확인했다(`fonts\sns_ko\license_check.json`). 통과는 Sandoll 삼립호빵체(OFL) 하나다 |

**SNS 한글 24종 가운데 떨어진 23종**
- 1차 라이선스 페이지를 확인하지 못함(14): 와일드각 · 에스코어 드림 · 창원단감아삭체 · 베스킨라빈스체 · 가나초콜릿체 · 빙그레체 · 티몬 몬소리체 · SB 어그로체 · 로커스 상상체 · 조선100년체 · HS산토끼체 · 양주 별산체, 그리고 이름이 실제 서체와 맞지 않는 박다현체 · 별반체
- 재배포 금지이고 공식 웹폰트도 없음(3): OK단단체 · 클립아트코리아체 · 교보손글씨 2024
- 유료(2): 산돌 공병각타블렛 · 산돌 광수
- 라이선스 조항끼리 어긋남(1): 전기안전체 — 공공누리 1유형이라고 적고서 임베딩·재배포는 따로 금지한다
- 1차 페이지 404(1): 속초바다 돋움(속초시 페이지)
- 비OFL 라이선스에 재배포 허가가 분명하지 않아 미러를 쓸 수 없음(2): 런드리고딕(「오픈라이센스」라고만 하고 OFL 명시·재배포 문구가 없다) · 어비(1차 페이지가 http뿐이고 비OFL이다)
- 다시 보지 않은 서체(컨트롤러 판정): 이전에 기각한 Inter · Poppins · Open Sans · Space Grotesk · 지마켓산스 · 페이퍼로지 · Geist, 유료 Proxima Nova, 전에 떨어진 카페24 아네모네 · 이사만루 · 이롭게바탕

**검사기.** `design-rules\factory\fonts\validate.mjs`의 `FIRST_PARTY`에 두 호스트를 더했다. 원본은 같은 폴더의 `_백업_원본_validate.mjs`다.
- KERIS 교육저작권지원센터 서체 페이지 `copyright.keris.or.kr/wft/fntDwnldView?fntGrpId=GFT…` — 학교안심 14종, 컨트롤러 판정
- 산돌구름 서체 페이지 `www.sandollcloud.com/font/<번호>.html` — 삼립호빵체의 공동 소유자

398종에서 종료 코드 0이다.

**순위 `rank_score`(0~1, 재료 등록분에만 있다).** SNS 점수기 버전은 `sns-crawler\research` weights.json 2026-09-29.1(rescore_2026-09-29)이다. 합치는 식은 같은 폴더의 `merge_sources.py`를 쓴다.

```
rank_score = (Σ_s w_s × p_s + 1 × 0.5) ÷ (Σ_s w_s + 1)      p_s = 출처 s 안의 백분위
가중: gf_popularity 1.0(Google 순위, 작을수록 좋음) · jsdelivr 0.5(월 요청) · noonnu 0.5 · fontshare 0.5 · curation 0.5(큐레이션 목록 수) · sns 1.0
```

- `merge_sources`는 gf_popularity와 jsdelivr를 coverage full로 본다(값이 없으면 0). Google 밖 서체에는 Google 순위가 처음부터 없으므로, **두 무리로 나눠 따로 백분위를 낸다**(`rank_group`).
  - `font-google`: Google 순위 · @fontsource 패키지 요청
  - `font-other`: jsDelivr 파일 요청 · 눈누 · Fontshare
  - 두 무리의 점수는 같은 척도(백분위 + 사전값)지만 모집단이 다르다.
- SNS 백분위의 모집단은 점수기가 채점한 서체 139종 전부다(이름이 맞은 19종만이 아니다).
- 「학교안심」 「카페24」처럼 가족 이름으로 언급한 SNS 글은 그 가족의 서체마다 같은 값으로 붙였다(evidence에 「가족 전체 언급」으로 표시).
- fonts 레인의 gf_trending은 weights.json 출처에 없어 넣지 않았다. 레인의 옛 점수(0~100)는 버렸다.
- 출처별 값·백분위·가중은 `rank_parts`에 있다.

**키트로 올린 10종**(`kitItem`, `docs/qa/font-licenses.md`의 「Task 15m」 절)
- 한글: 양진체 · 학교안심 둥근미소 · 카페24 고운밤 · 카페24 빛나는별(와일드각은 1차 라이선스를 확인하지 못해 컨트롤러 판정대로 바꿨다)
- 라틴: Londrina Solid · Libre Caslon Text · Boogaloo · Sirin Stencil · Cherry Bomb One · Sacramento

**다시 만드는 법.** 저장소 밖 `design-rules\factory\materials\register`에서, 저장소의 `fonts.json`이 이 묶음 없이 있을 때 돌린다.

```
node fonts-register.mjs
python sns-crawler/research/merge_sources.py --sns sns_font.jsonl --other other_font.jsonl --out merged_font.jsonl
node fonts-register.mjs --final
node design-rules/factory/fonts/validate.mjs        # 종료 코드 0
```

## 서체 짝 `pairs.json` (P3-2 Task 16a, 접합면 J5)

라이브러리 레시피 10벌(과 보드 B안 서체 9벌)의 `fonts`를 그대로 옮긴 짝 목록이다 — `{ id: "pair-recipe-<id>"(B안은 -b), source: "recipe:<id>", fonts }`.
생성물이다: `factory/scripts/build-presets.mjs`(gen:all)가 레시피 머리에서 만든다(손으로 고치지 않는다). 찍어내기 ②가 `presetToRecipeHead(preset, palette, pair)`의 셋째 인자로 쓰고,
짝을 주지 않으면 프리셋의 서체 힌트(`recipeHints.fonts` — 이 파일 fonts.json 의 id, 키트 항목이 있는 서체 먼저)에서 `hintPair`가 제목 서체를 고르고 본문 Pretendard·고정폭 IBM Plex Mono 를 붙인다.
