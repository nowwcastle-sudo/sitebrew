# 폰트 키트 라이선스 표 (P2′ Task 8, 2026-09-26 / P3-1 Task 3, 2026-09-27 추가 7종)

DESIGN §14-D는 「라이선스를 먼저 확인한다」를 MUST로 둔다. 키트에 넣은 서체는 모두 상업적 이용이 무료다. 대부분은 SIL Open Font License 1.1(OFL-1.1)이다. MaruBuri·NanumSquareRound(Task 10c)만 네이버 글꼴 라이선스다. 이 라이선스는 상업 사용·수정·재배포를 허용하고 글꼴 자체 판매만 금지한다(1차 페이지 https://hangeul.naver.com/font). 판정 근거는 아래 1차 출처다.

- **Google Fonts 서체:** google/fonts 저장소 `ofl/<폴더>/METADATA.pb`의 `license: "OFL"` 줄과 같은 폴더 `OFL.txt` 본문의 「SIL OPEN FONT LICENSE Version 1.1」을 확인했다. 2026-09-26에 curl로 읽었고 11종 모두 HTTP 200, 두 표시가 다 있었다. 2026-09-27에 새로 넣은 6종(Archivo·Jost·Black Han Sans·Jua·Gowun Dodum·Gasoek One)도 같은 방식으로 curl(`raw.githubusercontent.com/google/fonts/main/ofl/<폴더>/{METADATA.pb,OFL.txt}`)로 확인했다 — 6종 모두 HTTP 200, `license: "OFL"`.
- **Pretendard·Pretendard GOV:** 제작자 저장소(`orioncactus/pretendard`, 모노레포) 루트 `LICENSE`에서 「licensed under the SIL Open Font License, Version 1.1」과 Reserved Font Name 'Pretendard'를 확인했다. `pretendard-gov` npm 패키지(`packages/pretendard-gov`)는 별도 LICENSE 파일이 없고 같은 저장소·같은 루트 LICENSE 아래 있으며, 패키지 자체의 `package.json`도 `"license": "OFL-1.1"`을 명시한다(2026-09-27 확인).
- OFL은 임베딩·웹 사용·수정·재배포를 허용한다. 서체 파일만 따로 판매하는 것은 금지된다. 수정본에는 예약 이름(RFN)을 쓸 수 없다. 서브셋처럼 파일을 고쳐 재배포할 때는 RFN이 있는 서체(Pretendard 등)의 이름을 바꿔야 할 수 있다. 이 키트는 원본 패키지(npm `pretendard`·`pretendard-gov`, Google Fonts)를 그대로 싣기 때문에 해당하지 않는다.

| 항목 | 서체 | 공급 | 라이선스 | 1차 출처(라이선스) | 서체 페이지 | 역할 | 한글 |
|---|---|---|---|---|---|---|---|
| `font-ibm-plex-sans` | IBM Plex Sans | Google(가변) | OFL-1.1 | https://github.com/google/fonts/blob/main/ofl/ibmplexsans/OFL.txt | https://fonts.google.com/specimen/IBM+Plex+Sans | display | — |
| `font-ibm-plex-sans-kr` | IBM Plex Sans KR | Google(400·700) | OFL-1.1 | https://github.com/google/fonts/blob/main/ofl/ibmplexsanskr/OFL.txt | https://fonts.google.com/specimen/IBM+Plex+Sans+KR | body | ○ |
| `font-ibm-plex-mono` | IBM Plex Mono | Google(400·600) | OFL-1.1 | https://github.com/google/fonts/blob/main/ofl/ibmplexmono/OFL.txt | https://fonts.google.com/specimen/IBM+Plex+Mono | mono | — |
| `font-gothic-a1` | Gothic A1 | Google(400·500·700·800) | OFL-1.1 | https://github.com/google/fonts/blob/main/ofl/gothica1/OFL.txt | https://fonts.google.com/specimen/Gothic+A1 | body·display | ○ |
| `font-hahmlet` | Hahmlet | Google(가변) | OFL-1.1 | https://github.com/google/fonts/blob/main/ofl/hahmlet/OFL.txt | https://fonts.google.com/specimen/Hahmlet | display | ○ |
| `font-noto-sans-kr` | Noto Sans KR | Google(가변) | OFL-1.1 | https://github.com/google/fonts/blob/main/ofl/notosanskr/OFL.txt | https://fonts.google.com/specimen/Noto+Sans+KR | body | ○ |
| `font-noto-serif-kr` | Noto Serif KR | Google(가변) | OFL-1.1 | https://github.com/google/fonts/blob/main/ofl/notoserifkr/OFL.txt | https://fonts.google.com/specimen/Noto+Serif+KR | display·body | ○ |
| `font-nanum-myeongjo` | Nanum Myeongjo | Google(400·700·800) | OFL-1.1 | https://github.com/google/fonts/blob/main/ofl/nanummyeongjo/OFL.txt | https://fonts.google.com/specimen/Nanum+Myeongjo | display | ○ |
| `font-nanum-gothic` | Nanum Gothic | Google(400·700·800) | OFL-1.1 | https://github.com/google/fonts/blob/main/ofl/nanumgothic/OFL.txt | https://fonts.google.com/specimen/Nanum+Gothic | body | ○ |
| `font-dm-sans` | DM Sans | Google(가변) | OFL-1.1 | https://github.com/google/fonts/blob/main/ofl/dmsans/OFL.txt | https://fonts.google.com/specimen/DM+Sans | display | — |
| `font-manrope` | Manrope | Google(가변) | OFL-1.1 | https://github.com/google/fonts/blob/main/ofl/manrope/OFL.txt | https://fonts.google.com/specimen/Manrope | display | — |
| `font-sora` | Sora | Google(가변) | OFL-1.1 | https://github.com/google/fonts/blob/main/ofl/sora/OFL.txt | https://fonts.google.com/specimen/Sora | display | — |
| `font-pretendard` | Pretendard Variable(동적 서브셋) | npm `pretendard`(원천은 이름만, gen-fonts 가 package.json 범위 `^1.3.9` 로 고정), css `@import` | OFL-1.1 (RFN 'Pretendard') | https://github.com/orioncactus/pretendard/blob/main/LICENSE | https://github.com/orioncactus/pretendard | body·display | ○ |
| `font-archivo` | Archivo | Google(가변) | OFL-1.1 | https://github.com/google/fonts/blob/main/ofl/archivo/OFL.txt | https://fonts.google.com/specimen/Archivo | display | — |
| `font-jost` | Jost | Google(가변) | OFL-1.1 | https://github.com/google/fonts/blob/main/ofl/jost/OFL.txt | https://fonts.google.com/specimen/Jost | display | — |
| `font-black-han-sans` | Black Han Sans | Google(400 하나) | OFL-1.1 | https://github.com/google/fonts/blob/main/ofl/blackhansans/OFL.txt | https://fonts.google.com/specimen/Black+Han+Sans | display | ○ |
| `font-jua` | Jua | Google(400 하나) | OFL-1.1 | https://github.com/google/fonts/blob/main/ofl/jua/OFL.txt | https://fonts.google.com/specimen/Jua | display | ○ |
| `font-gowun-dodum` | Gowun Dodum | Google(400 하나) | OFL-1.1 | https://github.com/google/fonts/blob/main/ofl/gowundodum/OFL.txt | https://fonts.google.com/specimen/Gowun+Dodum | display | ○ |
| `font-gasoek-one` | Gasoek One | Google(400 하나) | OFL-1.1 | https://github.com/google/fonts/blob/main/ofl/gasoekone/OFL.txt | https://fonts.google.com/specimen/Gasoek+One | display | ○ |
| `font-pretendard-gov` | Pretendard GOV Variable(동적 서브셋) | npm `pretendard-gov`(원천은 이름만, gen-fonts 가 package.json 범위 `^1.3.9` 로 고정), css `@import` | OFL-1.1 | https://github.com/orioncactus/pretendard/blob/main/LICENSE | https://github.com/orioncactus/pretendard/tree/main/packages/pretendard-gov | body·display | ○ |
| `font-alegreya` | Alegreya | Google(가변) | OFL-1.1 | https://github.com/google/fonts/blob/main/ofl/alegreya/OFL.txt | https://fonts.google.com/specimen/Alegreya | display | — |
| `font-antonio` | Antonio | Google(가변) | OFL-1.1 | https://github.com/google/fonts/blob/main/ofl/antonio/OFL.txt | https://fonts.google.com/specimen/Antonio | display | — |
| `font-azeret-mono` | Azeret Mono | Google(가변) | OFL-1.1 | https://github.com/google/fonts/blob/main/ofl/azeretmono/OFL.txt | https://fonts.google.com/specimen/Azeret+Mono | display·mono | — |
| `font-bagel-fat-one` | Bagel Fat One | Google(400 하나) | OFL-1.1 | https://github.com/google/fonts/blob/main/ofl/bagelfatone/OFL.txt | https://fonts.google.com/specimen/Bagel+Fat+One | display | ○ |
| `font-besley` | Besley | Google(가변) | OFL-1.1 | https://github.com/google/fonts/blob/main/ofl/besley/OFL.txt | https://fonts.google.com/specimen/Besley | display | — |
| `font-big-shoulders` | Big Shoulders | Google(가변) | OFL-1.1 | https://github.com/google/fonts/blob/main/ofl/bigshoulders/OFL.txt | https://fonts.google.com/specimen/Big+Shoulders | display | — |
| `font-bm-euljiro` | BM Euljiro | jsDelivr gh `projectnoonnu/noonfonts_twelve@918ab62`(커밋 고정), `@font-face` 파일(registry:file → 소비자 `styles/wf-fonts/`, 굵기 400) | OFL-1.1 | https://www.woowahan.com/fonts/license | https://github.com/projectnoonnu/noonfonts_twelve/tree/918ab627023438babbc44544fe9102d54cf09cea | display | ○ |
| `font-bodoni-moda` | Bodoni Moda | Google(가변) | OFL-1.1 | https://github.com/google/fonts/blob/main/ofl/bodonimoda/OFL.txt | https://fonts.google.com/specimen/Bodoni+Moda | display | — |
| `font-bricolage-grotesque` | Bricolage Grotesque | Google(가변) | OFL-1.1 | https://github.com/google/fonts/blob/main/ofl/bricolagegrotesque/OFL.txt | https://fonts.google.com/specimen/Bricolage+Grotesque | display | — |
| `font-dela-gothic-one` | Dela Gothic One | Google(400 하나) | OFL-1.1 | https://github.com/google/fonts/blob/main/ofl/delagothicone/OFL.txt | https://fonts.google.com/specimen/Dela+Gothic+One | display | — |
| `font-diphylleia` | Diphylleia | Google(400 하나) | OFL-1.1 | https://github.com/google/fonts/blob/main/ofl/diphylleia/OFL.txt | https://fonts.google.com/specimen/Diphylleia | display | ○ |
| `font-do-hyeon` | Do Hyeon | Google(400 하나) | OFL-1.1 | https://github.com/google/fonts/blob/main/ofl/dohyeon/OFL.txt | https://fonts.google.com/specimen/Do+Hyeon | display | ○ |
| `font-dongle` | Dongle | Google(300·400·700) | OFL-1.1 | https://github.com/google/fonts/blob/main/ofl/dongle/OFL.txt | https://fonts.google.com/specimen/Dongle | display | ○ |
| `font-fragment-mono` | Fragment Mono | Google(400 하나) | OFL-1.1 | https://github.com/google/fonts/blob/main/ofl/fragmentmono/OFL.txt | https://fonts.google.com/specimen/Fragment+Mono | display·mono | — |
| `font-galmuri11` | Galmuri11 | jsDelivr npm `galmuri@2.40.3`(정확한 버전), css `@import url`(굵기 400·700) | OFL-1.1 | https://github.com/quiple/galmuri | https://github.com/quiple/galmuri | display | ○ |
| `font-gowun-batang` | Gowun Batang | Google(400·700) | OFL-1.1 | https://github.com/google/fonts/blob/main/ofl/gowunbatang/OFL.txt | https://fonts.google.com/specimen/Gowun+Batang | display | ○ |
| `font-grandiflora-one` | Grandiflora One | Google(400 하나) | OFL-1.1 | https://github.com/google/fonts/blob/main/ofl/grandifloraone/OFL.txt | https://fonts.google.com/specimen/Grandiflora+One | display | ○ |
| `font-grandstander` | Grandstander | Google(가변) | OFL-1.1 | https://github.com/google/fonts/blob/main/ofl/grandstander/OFL.txt | https://fonts.google.com/specimen/Grandstander | display | — |
| `font-libre-caslon-display` | Libre Caslon Display | Google(400 하나) | OFL-1.1 | https://github.com/google/fonts/blob/main/ofl/librecaslondisplay/OFL.txt | https://fonts.google.com/specimen/Libre+Caslon+Display | display | — |
| `font-martian-mono` | Martian Mono | Google(가변) | OFL-1.1 | https://github.com/google/fonts/blob/main/ofl/martianmono/OFL.txt | https://fonts.google.com/specimen/Martian+Mono | display·mono | — |
| `font-maru-buri` | MaruBuri | 1차 CDN `hangeul.pstatic.net`, css `@import url`(이 이름에는 굵기 400) | NAVER Font License | https://hangeul.naver.com/font | https://hangeul.naver.com/font | display | ○ |
| `font-moirai-one` | Moirai One | Google(400 하나) | OFL-1.1 | https://github.com/google/fonts/blob/main/ofl/moiraione/OFL.txt | https://fonts.google.com/specimen/Moirai+One | display | ○ |
| `font-nanum-brush-script` | Nanum Brush Script | Google(400 하나) | OFL-1.1 | https://github.com/google/fonts/blob/main/ofl/nanumbrushscript/OFL.txt | https://fonts.google.com/specimen/Nanum+Brush+Script | display | ○ |
| `font-nanum-gothic-coding` | Nanum Gothic Coding | Google(400·700) | OFL-1.1 | https://github.com/google/fonts/blob/main/ofl/nanumgothiccoding/OFL.txt | https://fonts.google.com/specimen/Nanum+Gothic+Coding | display·mono | ○ |
| `font-nanum-square-round` | NanumSquareRound | 1차 CDN `hangeul.pstatic.net`, css `@import url`(이 이름에는 굵기 400) | NAVER Font License | https://hangeul.naver.com/font | https://hangeul.naver.com/font | display | ○ |
| `font-natural-sans` | NaturalSans | jsDelivr gh `Project-Noonnu/2607201621@e74c395`(커밋 고정), `@font-face` 파일(registry:file → 소비자 `styles/wf-fonts/`, 굵기 400) | OFL-1.1 | https://notforall.tistory.com/39 | https://github.com/Project-Noonnu/2607201621/tree/e74c395af7d65481e09bcb9b462b4ad651d39c03 | display | ○ |
| `font-newsreader` | Newsreader | Google(가변) | OFL-1.1 | https://github.com/google/fonts/blob/main/ofl/newsreader/OFL.txt | https://fonts.google.com/specimen/Newsreader | display | — |
| `font-orbit` | Orbit | Google(400 하나) | OFL-1.1 | https://github.com/google/fonts/blob/main/ofl/orbit/OFL.txt | https://fonts.google.com/specimen/Orbit | display | ○ |
| `font-pyeojin-gothic` | PyeojinGothic | jsDelivr gh `projectnoonnu/2504-1@b05de91`(커밋 고정), `@font-face` 파일 3면(registry:file → 소비자 `styles/wf-fonts/`, Light 300·Regular 400·Bold 700) | OFL-1.1 | https://notforall.tistory.com/m/7 | https://github.com/projectnoonnu/2504-1/tree/b05de91c74dd2446ff63c937e2120157b2909518 | display | ○ |
| `font-seocho-batang` | SeochoBatang | jsDelivr gh `iwantanid/SeochoBatang-Font@acdbe07`(커밋 고정), `@font-face` 파일(registry:file → 소비자 `styles/wf-fonts/`, 굵기 400) | OFL-1.1 | https://github.com/iwantanid/SeochoBatang-Font | https://github.com/iwantanid/SeochoBatang-Font/tree/acdbe07748d6b5b59b74a69c13c2c213cadb445a | display | ○ |
| `font-shrikhand` | Shrikhand | Google(400 하나) | OFL-1.1 | https://github.com/google/fonts/blob/main/ofl/shrikhand/OFL.txt | https://fonts.google.com/specimen/Shrikhand | display | — |
| `font-song-myung` | Song Myung | Google(400 하나, subsets 없음 — next/font 가 preload 를 끈다) | OFL-1.1 | https://github.com/google/fonts/blob/main/ofl/songmyung/OFL.txt | https://fonts.google.com/specimen/Song+Myung | display | ○ |
| `font-spectral` | Spectral | Google(300·400·500·700) | OFL-1.1 | https://github.com/google/fonts/blob/main/ofl/spectral/OFL.txt | https://fonts.google.com/specimen/Spectral | display | — |
| `font-tektur` | Tektur | Google(가변) | OFL-1.1 | https://github.com/google/fonts/blob/main/ofl/tektur/OFL.txt | https://fonts.google.com/specimen/Tektur | display | — |
| `font-tenor-sans` | Tenor Sans | Google(400 하나) | OFL-1.1 | https://github.com/google/fonts/blob/main/ofl/tenorsans/OFL.txt | https://fonts.google.com/specimen/Tenor+Sans | display | — |
| `font-titan-one` | Titan One | Google(400 하나) | OFL-1.1 | https://github.com/google/fonts/blob/main/ofl/titanone/OFL.txt | https://fonts.google.com/specimen/Titan+One | display | — |
| `font-unbounded` | Unbounded | Google(가변) | OFL-1.1 | https://github.com/google/fonts/blob/main/ofl/unbounded/OFL.txt | https://fonts.google.com/specimen/Unbounded | display | — |
| `font-young-serif` | Young Serif | Google(400 하나) | OFL-1.1 | https://github.com/google/fonts/blob/main/ofl/youngserif/OFL.txt | https://fonts.google.com/specimen/Young+Serif | display | — |

## Task 3(2026-09-27)이 더한 7종 — 후보 9벌이 쓰는 서체

r2-signal(Archivo)·r5-celadon(Jost)·r3-woodblock(Black Han Sans, A/B 대안 Gasoek One)·r9-clay(Jua, A/B 대안 Gowun Dodum)·r6-civic(Pretendard GOV)의 서체 짝(`docs/recipes/candidates-2026-09-27.md` 「Task 3이 더할 서체」)을 그대로 넣었다. Archivo·Jost는 라틴 전용 가변 서체(next/font `font-data.json`에 `korean` subset이 없다 — Hahmlet과 같은 처지)라 본문은 항상 키트의 한글 서체(각각 Gothic A1·Pretendard)로 떨어진다(§20-3 MUST, `font-korean` lint). Black Han Sans·Jua·Gowun Dodum·Gasoek One은 next/font 데이터에 굵기가 400 하나뿐이라 제목 전용이고(§2 MUST), `korean-fonts.json`에서 이전에 `external: true`였던 항목을 키트 item으로 바꿨다.

**한글 글리프 실측(2026-09-27, 대상 4종 전부: Black Han Sans·Jua·Gowun Dodum·Gasoek One).** 넷 다 next/font `font-data.json`의 `subsets`에 `korean`이 없다(Hahmlet과 동일 처지 — `subsets: ["latin"]`/`["latin","latin-ext","vietnamese"]`/`["latin","latin-ext"]`는 이 사실을 그대로 반영한 값이지, 한글이 빠진다는 뜻이 아니다). 원인을 next/font 소스로 추적했다: `node_modules/next/dist/compiled/@next/font/dist/google/get-google-fonts-url.js`는 Google Fonts CSS2 API에 `subset` 쿼리 파라미터를 아예 보내지 않는다(요청 URL은 `family=…&display=…`뿐). Google의 CSS2 엔드포인트는 `&subset=latin`을 붙여도 붙이지 않아도 같은 응답(예: Black Han Sans 88개 `@font-face` 블록, 한글 유니코드 대역 포함)을 돌려준다는 것도 4종 전부 curl로 대조해 확인했다(`subsets` 옵션은 next/font 안에서 `preload` 자동 판단에만 쓰인다 — 위 「항목 형식과 한계」). 즉 next/font가 self-host하는 `@font-face`는 항상 그 서체가 가진 전체 유니코드 대역(한글 포함)을 unicode-range 조각으로 담고, 브라우저가 실제로 그리는 글자에 맞는 조각만 지연 로드한다.

이 추론을 실제 브라우저로도 4종 전부 확인했다(Google Fonts CSS를 그대로 부른 정적 페이지, `document.fonts.ready` 뒤 500ms 대기, CDP):

| 서체 | `document.fonts.check('32px "<서체>"', '가나다')` | 선언된 `@font-face` 조각 수 | `status: "loaded"`로 실제 로드된 조각 |
|---|---|---|---|
| Black Han Sans | true | 88 | 5(페이지에 쓴 한글·라틴 문자에 필요한 조각만) |
| Jua | true | 87 | 4 |
| Gowun Dodum | true | 95 | 6 |
| Gasoek One | true | 92 | 5 |

라틴 문자(`'A'`) 체크도 네 서체 모두 true였다(제목 전용 서체라 라틴도 그려야 한다). 화면에서도 네 제목 줄 모두 시스템 폰트가 아니라 각 서체 특유의 모양(Black Han Sans 두꺼운 각진 획·Jua 둥근 붓글씨체·Gowun Dodum 둥근 고딕·Gasoek One 굵은 디스플레이체)으로 그려졌다. 계산된 `font-family`만 보지 않고 실제 로드(`FontFace.status`)·실제 렌더(스크린샷) 두 가지를 CDP로 같이 봤다(스크래치 페이지·서버·스크린샷은 세션 임시 파일이라 커밋하지 않았고, 확인 뒤 지웠다).

## Task 10c(2026-09-27)가 더한 38종 — 레시피 20안의 제목 서체

컨트롤러 배정표 `docs/recipes/dna/fonts-assignment.md`의 라틴 제목체 20종과 한글 제목체 18종을 모두 키트 항목으로 넣었다. 라이선스 종류·1차 라이선스 URL·전달 경로는 Task 10a 데이터셋 `references/fonts/fonts.json`의 값을 그대로 옮겼다. 그 데이터셋은 라이선스 1차 URL, 웹 전달 HTTP 200, 렌더를 확인한 서체만 담는다. 한글 제목체는 `factory/qa/data/korean-fonts.json`에 `{ family, item }`으로 넣었다. 예전에 `external`이던 Nanum Gothic Coding·Gowun Batang·Do Hyeon·Song Myung·Orbit·MaruBuri도 item으로 바꿨다.

- **Google 31종**(`registry:font`)은 기존 형식을 따른다. 가변 서체는 `'<이름> Variable'`에 굵기를 비우고, 정적 서체는 굵기를 4개까지 적는다. Spectral은 7굵기 가운데 300·400·500·700을 싣는다. **Song Myung**은 next/font `font-data.json`의 subsets가 0개다. 그래서 `subsets`를 비웠다. next/font는 이 경우에만 preload를 스스로 끈다(`validate-google-font-function-call.js` `availableSubsets.length === 0`). shadcn은 비어 있는 subsets를 호출 인자에 쓰지 않는다. `gen-fonts`는 이 서체에 subsets를 적으면 문제로 잡는다.
- **Google 밖 7종**(`registry:item`)은 1차 CDN에서 css로 싣는다. npm 의존은 없다. 스타일시트가 있는 3종(MaruBuri·NanumSquareRound는 `hangeul.pstatic.net`, 갈무리11은 jsDelivr npm `galmuri@2.40.3`)은 `@import url("…")`로 싣는다. 파일만 있는 4종(서초바탕·펴진고딕·자연산스·배민 을지로체)은 `@font-face`로 싣는다 — Task 15(M8)부터 css 필드가 아니라 registry:file CSS 로 싣는다(아래 절). GitHub 파일은 jsDelivr `gh/<owner>/<repo>@<커밋 sha>`로 고정했다. `git ls-remote`로 커밋을 찾아 `meta.source`에도 적었다. 서초바탕 `main`은 `acdbe07`, 펴진고딕 `@1.0`(태그 v1.0)은 `b05de91`, 자연산스 `@jayeonsans-medium`은 `e74c395`, 배민 을지로체 `@1.0`(태그 v1.0)은 `918ab62`다. 브랜치·태그·`@latest`·버전 범위는 `gen-fonts` `cdnProblems`가 막는다. 네이버 CSS는 굵기마다 이름이 다르다(`MaruBuri`는 Regular 한 면, 굵은 면은 `MaruBuriBold` 등). 그래서 `meta.weight`를 `["400"]`으로 적었고, 레시피 단일 굵기 판정(`singleWeight`)이 이 값을 읽는다.
- **전달 URL 확인(2026-09-27, curl):** 고정한 8개 주소가 모두 HTTP 200이었다. woff2 4개·woff 1개·text/css 3개이고, Song Myung Google css2도 200이었다. 브라우저 로드 확인은 Task 10c 보고서에 있다(`document.fonts.check`).
- **Task 10c fix 1(리뷰 반영).**
  - **펴진고딕 굵기(I3).** fonts.json `delivery.mirror`는 Light 파일 하나를 가리켰고, 처음 항목은 그 파일을 400으로 등록했다. 그러면 r1 B의 700 한글 제목이 Light로 그려진다. 같은 고정 커밋 `b05de91`에 Regular·Bold가 있어서(jsDelivr 목록 확인, 셋 다 HTTP 200) Light 300·Regular 400·Bold 700 세 면으로 싣는다. `@font-face`는 배열이다. `gen-fonts`가 면 굵기 집합과 `meta.weight`가 같은지 본다.
  - **서체 변수 값(M6).** css 항목 9종(Pretendard·Pretendard GOV 포함)의 `--font-<slug>-wf` 값에서 끝의 일반형(`serif`·`sans-serif`)을 뺐다. 일반형이 있으면 레시피 스택 `var(--font-x-wf, …)`가 그 값으로 풀려, 없는 글자가 레시피 본문·한글 폴백 대신 플랫폼 일반형으로 떨어진다. `gen-fonts`의 `variable-generic`이 막는다.
  - **주소 고정(M7).** `raw.githubusercontent.com`·`github.com/…/raw/<ref>`는 커밋 sha, unpkg는 정확한 버전이어야 한다. 네이버 `hangeul.pstatic.net` 스타일시트는 버전 없는 1차 배포처라 그대로 허용한다.
- **미러 서체 3종(펴진고딕·자연산스·배민 을지로체)** 은 공식 웹폰트 URL이 없다. OFL 재배포 허용에 기대 눈누의 jsDelivr 저장소에서 싣는다. 자체 호스팅은 P3-3 내보내기 단계에서 한다(배정표 「키트 추가 시 주의」).

## Task 15(2026-09-28) — 파일만 있는 4종을 registry:file CSS로 (M8)

shadcn 4.21.0의 `css` 필드는 `@font-face`를 쓰지 못한다. BASE(64fa2bb) 모양을 새 소비자에 `add`하면 서초바탕(면 하나)은 `update-css: Unknown word "SeochoBatang"`로 종료 1, 펴진고딕(면 셋)은 종료 0이지만 `@font-face { 0 { … } 1 { … } 2 { … } }`처럼 면이 중첩 규칙으로 들어가 `@font-face` 자체에는 `src`·`font-family`가 없다.

- **원천:** 네 항목의 면은 `css["@font-face"]` 대신 `fontFace`(면 하나 또는 배열)에 둔다. 고정 주소·굵기·`font-display`·`font-style`은 그대로다(네 항목 모두 `unicode-range`는 원래 없었다).
- **생성물:** `gen-fonts`가 `registry/factory/fonts/faces/<slug>.css`를 쓰고, 항목에 `files: [{ path: "faces/<slug>.css", type: "registry:file", target: "styles/wf-fonts/<slug>.css" }]`와 `css: { "@import \"../styles/wf-fonts/<slug>.css\"": {} }`를 단다. shadcn은 `target`을 소비자 루트 기준으로 풀고 src 폴더가 있으면 `src/`를 붙인다. 그래서 전역 CSS가 `app/globals.css`·`src/app/globals.css`·`styles/globals.css` 어디에 있어도 같은 파일을 가리킨다. 문서 근거는 shadcn 4.21.0 `registry-item-json.mdx`(files·target, `~`)와 `examples.mdx`(css 필드의 파일 상대 `@plugin "./custom-plugin.js"`)이고, 자리 규칙은 `node_modules/shadcn/dist/chunk-B2MD6U5O.js`의 add 파일 자리 함수 `ar`에서 확인했다(`install-closure.mjs` `installPath`).
- **막기:** 어느 항목이든 `css`에 `@font-face`가 있으면 `gen-fonts`가 `font-face-css`로 멈춘다. `install-closure`는 css 필드의 상대 `@import`가 닫힘이 까는 파일에 떨어지는지 본다.
- **소비자 설치 확인:** `shadcn@4.21.0 init -t next -b base -p nova`(Next 16.3.4)에 로컬 빌드(`shadcn build`를 로컬 HTTP로 서빙)에서 네 항목을 하나씩 add했다. 매번 설치된 CSS를 postcss로 파싱했고, `next build`는 매번 종료 0이었다. 그 뒤 레시피 r4-evidence → r7-docs를 연달아 add했다. `consumer-markers`는 r7-docs 통과(r4-evidence는 실패 — 뒤 레시피가 이긴다), 전역 CSS의 `@font-face` 0개·깨진 면 0개, 네 `@import`는 각 1줄로 남았다. 헤드리스 Chrome에서 한글 문장을 그 서체로 그린 쪽은 네 서체 모두 `document.fonts.ready` 뒤 `document.fonts.check` true였다. FontFace는 모두 `loaded`(펴진고딕 300·400·700 셋)였고, 서체 파일 6개는 모두 HTTP 200이었다. 결과 표는 Task 15 보고서에 있다.
- **변수:** `--font-<slug>-wf`는 그대로다. Tailwind v4는 `@theme inline` 변수를 다른 값이 참조할 때만 내보낸다(이 서체를 스택에 쓰는 레시피가 있을 때). 예전 css 항목(NanumSquareRound 등)과 같은 동작이다.

## Task 15m(2026-09-29) — 재료 확장 키트 10종

운영자 요청(2026-09-29 재료 확장)의 승인 범위 「상위 서체 약 10개는 키트 항목으로도」에 따라 넣었다. 서체는 컨트롤러가 인기와 개성을 함께 보고 골랐다(`design-rules\factory\materials\sns\summary.md` 판정 4). 인기 근거와 순위는 `references/fonts/fonts.json`의 해당 서체 `rank_parts`(`kitItem`으로 이어진다)에 있다. 흔한 서체인 IBM Plex Mono와 Libre Baskerville은 키트에서 빼고 레퍼런스에만 남겼다.

| 항목 | 서체 | 공급 | 라이선스 | 1차 출처(라이선스) | 서체 페이지 | 역할 | 한글 |
|---|---|---|---|---|---|---|---|
| `font-yangjin` | 양진체 yangjin | jsDelivr gh `supernovice-lab/font@ccf7341`(커밋 고정 — 제작자 저장소, 태그 0.9 = 0.8), `@font-face` 파일(굵기 400) | 양진체 라이선스(상업 무료 · 수정·판매 금지 · 배포 형태 그대로) | https://github.com/supernovice-lab/font | https://github.com/supernovice-lab/font/tree/ccf73414cb70a8108cd85101adf74d3d4aa6a619 | display | ○ |
| `font-hakgyoansim-dunggeunmiso` | 학교안심 둥근미소 HakgyoansimDunggeunmiso | jsDelivr gh `projectnoonnu/2408-5@b6287cf`(커밋 고정, 눈누 미러), `@font-face` 파일(굵기 400 R · 700 B) | OFL-1.1 | https://copyright.keris.or.kr/wft/fntDwnldView?fntGrpId=GFT202408200000000000003 | https://github.com/projectnoonnu/2408-5/tree/b6287cfe294ed60927aa616a13af781e85a1ddf7 | display | ○ |
| `font-cafe24-oneprettynight` | 카페24 고운밤 Cafe24Oneprettynight | jsDelivr gh `projectnoonnu/noonfonts_twelve@149348b`(커밋 고정, 눈누 미러), `@font-face` 파일(굵기 400) | OFL-1.1(카페24 폰트 라이선스) | https://fonts.cafe24.com/ | https://github.com/projectnoonnu/noonfonts_twelve/tree/149348bb2c5a9b67e26a9f211c330ef9899038af | display | ○ |
| `font-cafe24-shiningstar` | 카페24 빛나는별 Cafe24Shiningstar | jsDelivr gh `projectnoonnu/noonfonts_twelve@149348b`(커밋 고정, 눈누 미러), `@font-face` 파일(굵기 400) | OFL-1.1(카페24 폰트 라이선스) | https://fonts.cafe24.com/ | https://github.com/projectnoonnu/noonfonts_twelve/tree/149348bb2c5a9b67e26a9f211c330ef9899038af | display | ○ |
| `font-londrina-solid` | Londrina Solid | Google(100·300·400·900) | OFL-1.1 | https://github.com/google/fonts/blob/main/ofl/londrinasolid/OFL.txt | https://fonts.google.com/specimen/Londrina+Solid | display | — |
| `font-libre-caslon-text` | Libre Caslon Text | Google(400·700) | OFL-1.1 | https://github.com/google/fonts/blob/main/ofl/librecaslontext/OFL.txt | https://fonts.google.com/specimen/Libre+Caslon+Text | display | — |
| `font-boogaloo` | Boogaloo | Google(400 하나) | OFL-1.1 | https://github.com/google/fonts/blob/main/ofl/boogaloo/OFL.txt | https://fonts.google.com/specimen/Boogaloo | display | — |
| `font-sirin-stencil` | Sirin Stencil | Google(400 하나) | OFL-1.1 | https://github.com/google/fonts/blob/main/ofl/sirinstencil/OFL.txt | https://fonts.google.com/specimen/Sirin+Stencil | display | — |
| `font-cherry-bomb-one` | Cherry Bomb One | Google(400 하나) | OFL-1.1 | https://github.com/google/fonts/blob/main/ofl/cherrybombone/OFL.txt | https://fonts.google.com/specimen/Cherry+Bomb+One | display | — |
| `font-sacramento` | Sacramento | Google(400 하나) | OFL-1.1 | https://github.com/google/fonts/blob/main/ofl/sacramento/OFL.txt | https://fonts.google.com/specimen/Sacramento | display | — |

- **라이선스 확인(2026-09-29, curl).** Google 6종은 google/fonts `ofl/<폴더>/OFL.txt`가 HTTP 200이고, `METADATA.pb`의 `license: "OFL"` 줄을 확인했다. 양진체는 고정 커밋의 `LICENSE` 원문을 읽었다: 「개인, 기업사용자 모두 상업적인 용도로 무료 사용이 가능」·「배포되는 형태 그대로 사용」. 학교안심·카페24는 fonts 레인과 컨트롤러가 1차 페이지를 확인했다(`references/fonts/fonts.json`의 `license.note`).
- **양진체는 다시 호스팅하지 않는다.** 라이선스가 「배포되는 형태 그대로」라서 제작자 페이지가 안내하는 제작자 저장소의 jsDelivr 주소만 쓴다. 태그 대신 그 태그의 커밋으로 고정했을 뿐 같은 저장소·같은 파일이다. P3-3 내보내기의 자체 호스팅 대상에서도 뺀다. 학교안심·카페24는 OFL이라 미러와 자체 호스팅이 허용된다.
- **와일드각 → 카페24 빛나는별.** 와일드각은 SNS 순위가 높지만, 제작자의 1차 라이선스 페이지를 찾지 못했다(눈누가 유일한 게재처이고 재배포 문구가 없다). 컨트롤러 판정대로 카페24 빛나는별로 바꿨다.
- **전달 URL(2026-09-29, curl):** 고정한 jsDelivr 주소 5개(woff2 2 · woff 3)가 모두 HTTP 200이었다.
- **소비자 없이 그려지는지(2026-09-29, headless Chrome 1회):** 탐침 페이지에서 확인했다. 한글 4종은 생성된 면 CSS(`registry/factory/fonts/faces/<slug>.css`, 배포되는 파일 그대로)를 싣고, 라틴 6종은 같은 굵기의 Google css2를 싣는다(소비자에서는 next/font가 같은 파일을 자체 호스팅한다). 굵기마다 `document.fonts.load` 뒤 `document.fonts.check`가 true였고, `CSS.getPlatformFontsForNode`에서 모든 표본 글리프를 웹폰트가 그렸다. **10/10 통과.** 한글 4종은 KS X 1001 밖 음절(똠햏뷁쀍)까지 웹폰트로 그려 11,172자다.
- **변수:** `--font-<slug>-wf`. `variableOverlaps`가 기존 `--font-libre-caslon-display-wf`와 새 `--font-libre-caslon-text-wf`는 서로의 부분 문자열이 아님을 확인한다(gen-fonts 종료 0).

## 목록을 정한 근거

- DESIGN §14-D 후보 가운데 Google이 공급하는 서체를 넣었다. Gothic A1·Hahmlet·Noto Sans/Serif KR·Nanum Gothic/Myeongjo·DM Sans·Manrope·Sora다. Nanum Gothic은 브리프 목록에는 없지만 §14-D 후보 줄(「Noto Sans/Serif KR·Nanum Gothic/Myeongjo(OFL)」)에 있어서 넣었다.
- 레시피 r1-measure가 참조하는 IBM Plex Sans·IBM Plex Sans KR·IBM Plex Mono를 넣었다. 셋 다 Google Fonts에 있다. 이 PC의 next 16.3.4 `font-data.json`에 있고, google/fonts `METADATA.pb`에도 있다.
- Pretendard는 §14-D 한글 1순위다. Google Fonts에는 없어서 npm 패키지의 동적 서브셋 CSS를 싣는다(`docs/qa/pretendard-install.md`).
- Inter는 넣지 않았다. 운영자 판정 「조정하면 후보」는 항목을 요구하지 않고, §14-D·브리프·r1 어디에도 필요하지 않다(컨트롤러 판정 5).
- Satoshi·Clash Display(Fontshare FFL)는 §14-D대로 조항 원문을 다시 확인하기 전까지 넣지 않는다. 눈누 재배포 서체도 보류다.

## 항목 형식과 한계

- Google 항목(`registry:font`)은 스파이크 4 형식을 따른다. `family`에는 fontsource 이름을 적는다(가변 서체는 `'<이름> Variable'`). `variable`은 `--font-<slug>-wf`다(`factory/scripts/lib/registry-lib.mjs` `fontVar`). 끝의 `-wf`는 shadcn의 부분 문자열 매칭 때문에 붙인 종결자다(Task 13a T9-c2). 옛 이름 `--font-<slug>`(v0.0.3)에서 올리는 법은 `docs/qa/p2-migration.md`에 있다. 가변 서체는 `weight`를 비우고(wght 축 전체를 파일 하나로), 정적 서체는 4개까지 적는다. `subsets`는 `["latin"]`이다. 한글 글리프는 next/font가 unicode-range 조각으로 필요한 만큼만 받는다. `dependency`는 fontsource 패키지다.
- 생성기(`factory/scripts/gen-fonts.mjs`)가 설치된 next의 Google Fonts 목록과 대조해 import 이름·굵기·subsets가 실제로 있는지 본다. `meta.licenseUrl`이 없으면 멈춘다.
- **preload는 항목에서 끌 수 없다(리뷰 M1).** shadcn 4.21.0 `registry-item`의 font 스키마에는 family·provider·import·variable·weight·subsets·selector·dependency만 있고 `preload`가 없다. 그래서 shadcn이 소비자 layout에 쓰는 next/font 호출은 기본값 `preload: true`로 돈다. next/font는 서체에 쓸 수 있는 subsets가 **0개일 때만** preload를 스스로 끈다(`validate-google-font-function-call.js`: `availableSubsets.length === 0` → `preload = false`). 이 키트의 서체는 모두 `latin`이 있어 여기에 해당하지 않는다. 한글 서체도 latin 조각만 미리 받고, 한글 조각은 unicode-range로 쓸 때 받는다. 저장소 갤러리의 `preload: false`(`gen-recipes-gallery.mjs`)는 소비자에게 전달되지 않는다.
- **Next가 아닌 소비자의 한계:** shadcn은 `@import "<dependency>"` 한 줄만 넣는다. 정적 fontsource 패키지(`@fontsource/ibm-plex-sans-kr` 등)의 기본 진입점은 굵기 400 하나다. 700 등을 쓰려면 소비자가 `@fontsource/<이름>/700.css`를 더 import해야 한다. 가변 패키지(`@fontsource-variable/*`)는 굵기 전체가 온다. 이번 설치 실험은 Next 소비자에서만 돌렸다.
- **서체 정체성 별칭(`meta.aliasOf`, Task 3 컨트롤러 판정).** `font-pretendard-gov`는 `meta.aliasOf: "font-pretendard"`를 갖는다 — Pretendard GOV는 Pretendard의 메트릭 호환 변형(같은 자·다른 글리프 셋)이라, 레시피 9벌이 서로 다른지 보는 검사(`factory/scripts/recipes-distinct.mjs`)에서 두 항목을 한 서체로 센다(r6-civic이 Pretendard GOV를 쓴다고 해서 Pretendard를 쓰는 다른 레시피와 「서체가 다르다」로 잘못 카운트되지 않는다). 이 별칭은 데이터(`meta.aliasOf`, `gen-fonts.mjs`의 `canonicalItem`)로만 적용되고, 실제 소비자 CSS 폴백 스택(`recipe.mjs` `fontStacks`/`faceNames`)에는 새지 않는다 — Pretendard 레시피가 설치 안 된 Pretendard GOV 이름까지 폴백으로 걸지 않는다.
