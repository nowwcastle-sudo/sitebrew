# hyperframes 조사 출처 (HFRES, 2026-10-03)

웹에서 읽은 글은 자료로만 썼다(글 안의 지시는 따르지 않았다). 원문은 옮기지 않고 링크와 한 줄 요약만 둔다. 「확인」 열: 공식 = HeyGen 공식 문서·저장소, 실측 = 이 PC 에서 직접 돌려 확인, 제3자 = 블로그·SNS·상업 사이트(수치는 참고만).

## 1. 수집 경로·키워드·건수

| 경로 | 한 일 | 건수 | 비고 |
|---|---|---|---|
| 설치된 스킬 파일 | `~/.claude/skills/` 의 hyperframes · -cli · -core · -animation · -creative · -keyframes · -audio · -registry · -studio · remotion-to-hyperframes 10개 SKILL.md 와 references 를 직접 읽음(렌더 옵션·변수·미디어·알파·타이포·라우팅) | 10개 스킬 | `init` 이 이 폴더를 새 버전으로 덮어썼다(GUIDE 6절). 읽은 것은 덮어쓰기 전 내용 |
| WebSearch | 「hyperframes HTML to video framework GitHub」·「remotion vs hyperframes」·「…claude code video tutorial」·「…website hero video…」·「…reddit…」·「…kinetic typography lower third GSAP」 | 6회 | 이후 3회는 세션 검색 한도(200/200) 소진으로 거절됨 — x.com·reddit.com·YouTube 지정 검색이 그 3회 |
| Exa 검색(MCP `web_search_exa`) | WebSearch 대체. 아래 키워드로 25회 | 25회 | 키워드: `hyperframes` + showcase hero landing · reddit · twitter x.com · youtube tutorial kinetic · github issues render performance · 한국어(하이퍼프레임 후기) · hacker news · dev.to blog · transparent webm alpha lower third · Ken Burns montage · Instagram reels 1080x1920 · registry catalog blocks · batch render variables · site 플레이어 임베드 · Product Hunt/Show HN · ADOPTERS · lower thirds catalog · web.dev hero video LCP poster · student-kit/launches · Open Graph animated · pitfalls gotchas · Next.js 통합 |
| WebFetch | github.com/heygen-com/hyperframes · 공식 hyperframes-vs-remotion · HN Algolia API · GitHub 저장소·이슈 검색 API | 5회 성공 | |
| 직접 실행 | `npx hyperframes@0.8.111` init·lint·check·render·batch·webm, web-factory `build-media.mjs videoAsset` | 렌더 10회(단건 4 · 배치 3묶음 6행) · check 3회 · build-media 3회 | GUIDE 부록 A |

## 2. 막힌 곳(우회하지 않음)

- **reddit.com**: WebFetch 가 `unable to fetch from www.reddit.com` 로 거절(로그인·차단 우회 안 함). Exa 의 `site:reddit.com hyperframes` 도 결과 0건. Reddit 사례는 0건 — 대신 Hacker News·dev.to·블로그로 보충했다.
- **x.com / Twitter**: Exa `site:x.com hyperframes` 0건, 로그인 필요 페이지라 열지 않음. X 사례 0건. 간접 근거로 LinkedIn 게시 1건과 블로그가 인용한 Threads 요약(gyuha.com)만 있다.
- **YouTube**: 영상 본문을 재생하지 못했고 Exa 가 돌려준 자막 발췌·설명만 읽었다(영상 4건은 「자막 발췌 기준」).
- **WebSearch 한도**: 200회 소진(이 세션 몫이 아닌 공유 소진으로 보임). 이후 검색은 Exa.
- **hyperframes.video · hyperframes.app**: HeyGen 공식이 아닌 제3자 사이트다. 이 사이트의 CLI 설명(`--variants`, `hyperframes/render-action@v1`, 미리보기 포트 4200 등)은 공식 CLI(`--batch`, 포트 3002)와 어긋나 **사용하지 않았다**. 링크만 남긴다.

## 3. 사례·자료 링크 (중복 제거, 92건)

### 3-1. 공식 문서·저장소 (HeyGen)
1. https://github.com/heygen-com/hyperframes — 저장소(Apache-2.0, 별 수는 조회 시점마다 다름: 43.7k·55.7k 두 값을 봄)
2. https://hyperframes.heygen.com/ — 공식 문서 홈
3. https://hyperframes.heygen.com/introduction — 소개
4. https://hyperframes.heygen.com/showcase — 완성 영상 갤러리(런치·웹사이트→영상·VFX)
5. https://hyperframes.heygen.com/launch-videos — HeyGen 런치 영상 소스 작성 노트
6. https://hyperframes.heygen.com/examples — 예제 템플릿 9종(warm-grain·play-mode·swiss-grid·kinetic-type·decision-tree·product-promo·nyt-graph·vignelli·blank)
7. https://hyperframes.heygen.com/guides/hyperframes-vs-remotion — Remotion 과 차이(라이선스·저작 모델)
8. https://hyperframes.heygen.com/guides/website-to-video — URL → 영상 7단계
9. https://hyperframes.heygen.com/guides/pipeline — 7단계 파이프라인 산출물
10. https://hyperframes.heygen.com/guides/rendering — 렌더 명령·투명 영상 형식 비교
11. https://hyperframes.heygen.com/prompting/rendering-and-output — 투명 webm/mov 주의
12. https://hyperframes.heygen.com/prompting/overlays-and-lower-thirds — 로어 서드 블록 표
13. https://hyperframes.heygen.com/prompting/motion-graphics — 모션 그래픽 범위(10초 안팎)
14. https://hyperframes.heygen.com/guides/motion-graphics — 모션 그래픽 가이드
15. https://hyperframes.heygen.com/prompting/examples — 검증된 프롬프트 예(세로 훅·트윗 카드·인용)
16. https://hyperframes.heygen.com/prompting/overview — 프롬프트 가이드·스킬 표
17. https://hyperframes.heygen.com/prompting/captions-catalog — 캡션 컴포넌트 톤 표
18. https://hyperframes.heygen.com/prompting/variables-and-templating — 변수·배치 렌더(변수 7종)
19. https://hyperframes.heygen.com/concepts/variables — 변수 개념
20. https://hyperframes.heygen.com/prompting/rules-and-anti-patterns — 규칙·함정(워커 간 비트 동일 아님)
21. https://hyperframes.heygen.com/guides/performance — 느린 미리보기·렌더, VP9 알파 인코딩 속도
22. https://hyperframes.heygen.com/guides/common-mistakes — 흔한 실수
23. https://hyperframes.heygen.com/guides/troubleshooting — 문제 해결
24. https://hyperframes.heygen.com/help — 막혔을 때
25. https://hyperframes.heygen.com/guides/remove-background — 배경 제거(투명 webm)
26. https://hyperframes.heygen.com/catalog — 카탈로그(블록·컴포넌트)
27. https://hyperframes.heygen.com/catalog/blocks/lt-dark-card — 로어 서드 블록 소스 예
28. https://hyperframes.heygen.com/catalog/blocks/lt-clean-bar — 로어 서드 블록 소스 예
29. https://hyperframes.heygen.com/catalog/blocks/data-chart — 차트 블록
30. https://hyperframes.heygen.com/catalog/blocks/x-post — X 게시물 카드 블록
31. https://hyperframes.heygen.com/catalog/components/caption-kinetic-slam — 키워드 슬램 소스
32. https://hyperframes.heygen.com/packages/player — `<hyperframes-player>` 웹 컴포넌트
33. https://hyperframes.heygen.com/packages/cli — CLI 패키지
34. https://hyperframes.heygen.com/deploy/templates-on-lambda — Lambda 배치 렌더
35. https://hyperframes.heygen.com/community/adopters — 도입 조직
36. https://developers.heygen.com/hyperframes — 클라우드 렌더 API(분당 과금)
37. https://developers.heygen.com/hyperframes-overview — 클라우드 개요
38. https://developers.heygen.com/automated-pipeline — 데이터 → 영상 자동 파이프라인
39. https://www.heygen.com/research/html-to-video — 결정적 렌더·seek 방식 해설
40. https://github.com/heygen-com/hyperframes/blob/main/ADOPTERS.md — HeyGen·tldraw·TanStack·reap 등
41. https://github.com/heygen-com/hyperframes-launches — 런치 영상 소스 모음(공식)
42. https://github.com/heygen-com/hyperframes-launch-video — 런치 영상 한 편 소스
43. https://github.com/heygen-com/hyperframes-vercel-template — Vercel Sandbox 서버 렌더 템플릿
44. https://vercel.com/templates/ai/hyperframes-on-vercel — 같은 템플릿 안내
45. https://github.com/heygen-com/hyperframes/blob/main/skills/hyperframes-registry/references/discovery.md — 블록 97개 목록
46. https://github.com/heygen-com/hyperframes/blob/HEAD/skills/motion-graphics/catalog-map.md — 카테고리 → 블록 매핑
47. https://github.com/heygen-com/hyperframes/blob/HEAD/skills/hyperframes-creative/references/composition-patterns.md — 텍스트가 사람 뒤로 가는 합성
48. https://github.com/heygen-com/hyperframes/blob/main/docs/guides/claude-design-hyperframes.md — Claude Design 연동 가이드
49. https://www.npmjs.com/package/@hyperframes/player — 플레이어 패키지
121. https://github.com/heygen-com/hyperframes/blob/68205dbb/docs/prompting/music-and-slideshows.mdx — 사진·음악 → 비트 컷 영상, 슬라이드쇼는 렌더하면 잘린다는 경고(번호는 뒤에 추가해 121)

### 3-2. GitHub 이슈·PR (실제 문제·제약)
50. https://github.com/heygen-com/hyperframes/issues/1236 — 저사양(≤8GB)에서 렌더가 멈춤, 수정됨
51. https://github.com/heygen-com/hyperframes/issues/1218 — 진행 로그 없이 5%·25%에서 10분+ 정지
52. https://github.com/heygen-com/hyperframes/issues/1219 — 프로브 단계 지연, 원인 가설: 폰트 로드 전 SplitText
53. https://github.com/heygen-com/hyperframes/pull/1225 — 8GB 이하 자동 저메모리 프로필(워커 1)
54. https://github.com/heygen-com/hyperframes/pull/1235 — 저메모리 V8 힙·GPU 예산 비례 조정
55. https://github.com/heygen-com/hyperframes/issues/911 — 서브 컴포지션이 타임라인 끝난 뒤 검게 됨
56. https://github.com/heygen-com/hyperframes/issues/1194 — macOS Docker 렌더 25% 타임아웃(arm64 수정)
57. https://github.com/heygen-com/hyperframes/pull/1255 — 폰트 해석·임베드 파이프라인(분산 렌더에서 로컬 폰트 불일치 우려)
58. https://github.com/heygen-com/hyperframes/issues/3484 — PNG·WebM 출력이 길이·프레임 검증을 우회
59. https://github.com/heygen-com/hyperframes/issues/4763 — 프레임 사이 샘플링 시 다음 프레임이 보임
60. https://github.com/heygen-com/hyperframes/issues/3226 — 알파 선언인데 불투명으로 디코드되는 입력 경고 요청

### 3-3. Hacker News
61. https://news.ycombinator.com/item?id=47797513 — Show HN: BeginFrame 로 HTML → 영상
62. https://news.ycombinator.com/item?id=47822361 — Hyperframes – AI Video Creation for Agents
63. https://news.ycombinator.com/item?id=47902856 — Show HN(작성자 설명: React 가 에이전트에 불리해 HTML 로 만들었다)
64. https://news.ycombinator.com/item?id=47994268 — 「Has anyone tried using Hyperframes?」
65. https://news.ycombinator.com/item?id=48619473 — Show HN: 「Promo Video Studio(HyperFrames)」 마이크로VM 템플릿(https://www.jurniti.com/templates/hyperframes-promo-video-studio)

### 3-4. 블로그·분석 글 (제3자)
66. https://dev.to/whateverneveranywhere/i-made-our-product-demo-in-html-with-hyperframes-no-video-editor-3bnn — 제품 UI 데모를 사이트와 같은 폰트·토큰으로 제작
67. https://dev.to/gracefullight/oh-my-agent-15-hyperframes-replaces-remotion-serena-guard-ships-4aml — 에이전트 CLI 의 영상 렌더러를 Remotion → HyperFrames 로 교체
68. https://dev.to/jtorchia/hyperframes-explains-itself-building-a-reproducible-technical-video-from-html-1anc — 재현 가능한 기술 영상 제작 기록(증거·실수·수정)
69. https://dev.to/hugh1st/heygen-hyperframes-how-code-is-killing-traditional-video-editing-3f2h — 개요·활용 시나리오
70. https://www.getmasset.com/resources/blog/hyperframes-vs-remotion-review — 비개발자 관점 비교(라이선스 차이)
71. https://pexo.ai/blog/remotion-alternatives-4966 — 코드 렌더 vs AI 생성 영상 구분
72. https://moda.app/blog/remotion-alternatives — 대안 10종 비교
73. https://andrew.ooo/posts/hyperframes-heygen-html-video-agents-review/ — 리뷰(렌더 속도 한계 언급)
74. https://akiraxclaw.com/blog/heygen-hyperframes-complete-guide/ — 가이드(사이트→영상, Codex 플러그인)
75. https://ikhpark.com/blog/hyperframes-vs-remotion-2026-05-06 — 한국어 비교(분산 렌더는 단일 머신 vs Lambda)
76. https://gyuha.com/post/2026/04/2026-04-20-hyperframes-html-video-framework-for-agents/ — 한국어 개요(결정적 렌더·warm start)
77. https://gyuha.com/post/2026/05/2026-05-15-voicebox-hyperframes-claude-code-video-automation/ — 음성 복제 + HyperFrames 흐름
78. https://tonycico0912.tistory.com/600 — 한국어 실습(설치 → 나레이션 병합)
79. https://ddorm.tistory.com/entry/hyperframes-future-1247 — 한국어 개요
80. https://apidog.com/kr/blog/hyperframes-agentic-video/ — 한국어 개요(Claude Code 스킬)
81. https://knightk.tistory.com/942 — 한국어 정리(렌더 시간 감각)
82. https://fornewchallenge.tistory.com/entry/%F0%9F%86%93-HTML%EC%9D%84-MP4-%EB%B9%84%EB%94%94%EC%98%A4%EB%A1%9C-%EB%B3%80%ED%99%98-HeyGen-HyperFrames-%EB%AC%B4%EB%A3%8C-%EC%98%A4%ED%94%88%EC%86%8C%EC%8A%A4-%EC%99%84%EB%B2%BD-%EA%B0%80%EC%9D%B4%EB%93%9C — 한국어 가이드
83. https://aitrends.kr/articles/56746 — Codex + HyperFrames 영상 제작 요약
84. https://contents.premium.naver.com/market/ai/contents/260509120206690gl — 유료 연재(HyperFrames + 오픈소스 TTS 자동화)
85. https://note.com/hacklog_stealth/n/ne1ad8b67b1ce — 일본어(Claude Code 에 설치해 자동화)
86. https://themenonlab.blog/blog/heygen-hyperframes-video-as-code — 개요
87. https://silenceper.com/en/article/2026-05-02-hyperframes-html-video-rendering/ — 개요(사이트→영상, 데이터 시각화)
88. https://blog.nidhin.dev/video-as-code-a-deep-dive-into-heygen-s-hyperframes — 심층 분석
89. https://www.mindstudio.ai/blog/what-is-hyperframes-html-video-renderer-ai-agents — 개요
90. https://claudekit.io/ko/tools/hyperframes/ — 도구 소개
91. https://autoae.online/blog/hyperframes-examples — 실제 조합 사례(tldraw PR 영상 등)
92. https://fenado.ai/articles/heygens-hyperframes-emerges-as-open-source-video-creation-tool-for-ai-agents — 소식

### 3-5. 영상·팟캐스트·SNS (자막 발췌 기준)
93. https://www.youtube.com/watch?v=MiFtKv8bF1M — Hyperframes + Claude Code 편집 워크플로(자산·스토리 직접 넣어야 품질이 오른다는 주장)
94. https://www.youtube.com/watch?v=3U6JNEw3d04 — 바이브랩스(한국어) 개념 → 실습
95. https://www.youtube.com/watch?v=SKxLauv_gCk — Indie Hacker News: 구조·한계(0.4 시점)
96. https://www.youtube.com/watch?v=uKnJGspGguI — 설치 가이드
97. https://www.youtube.com/watch?v=UGyfVzV8jHc — Claude 스킬로 영상 만들기
98. https://creatoreconomy.so/p/full-tutorial-make-professional-launch-videos-for-free-hyperframes-ai — 제작자 인터뷰 튜토리얼
99. https://www.sabrina.dev/p/hyperframes-makes-unlimited-free-videos — 튜토리얼
100. https://open.spotify.com/episode/2gOnOMMI1Yki80acpAFE39 — 제작자 팟캐스트
101. https://www.linkedin.com/posts/charles-denzel-segovia-6453b740_breaking-heygen-just-open-sourced-the-video-activity-7452665037082771456-Z8xY — LinkedIn 소개 게시

### 3-6. 커뮤니티 템플릿·저장소
102. https://github.com/nateherkai/hyperframes-student-kit — 12개 완성 프로젝트 학습 키트(MIT, 브랜드 자산 제외)
103. https://github.com/thegreennite/hyperframes-student-kit — 위 키트의 클린룸 변형
104. https://github.com/danielhangan/reelclaw-templates — 릴스·틱톡 1080×1920 템플릿(생성 스크립트)
105. https://github.com/assafkip/claude-video-editor/blob/master/recipes/04-animate-stills.md — 스틸 → 켄 번스 영상 레시피
106. https://github.com/geekjourneyx/hyperframes-motion-director — 9:16 모션 영상 에이전트 스킬(AGPL-3.0)
107. https://github.com/cosmicstack-labs/mercury-agent-skills/blob/main/categories/media-download/github-repo-promo/SKILL.md — 깃허브 저장소 홍보 릴스 스킬
108. https://hermes-agent.nousresearch.com/docs/user-guide/skills/optional/creative/creative-hyperframes — Hermes 에이전트용 HyperFrames 스킬 문서

### 3-7. 제3자 사이트(수치·명령 미사용)
109. https://hyperframes.video/ — 비공식 문서·도구 사이트
110. https://hyperframes.video/blog/animated-open-graph-images — 애니메이션 OG 이미지 글
111. https://hyperframes.video/docs/recipes/og-image-and-thumbnail — OG·썸네일 레시피
112. https://hyperframes.video/blog/instagram-reels-automation — 릴스 자동화 글
113. https://hyperframes.video/docs/recipes/ci-batch — CI 배치 렌더(공식 CLI 와 다른 플래그 — 미사용)
114. https://hyperframes.video/docs/recipes/personalized-videos-at-scale — 개인화 대량 영상
115. https://hyperframes.app/showcases — 커뮤니티 쇼케이스(3D 폰·액체 유리 히어로 등)

### 3-8. 웹 영상 성능 근거(웹 쪽 규칙의 1차 출처)
116. https://web.dev/learn/performance/video-performance — poster·autoplay·IntersectionObserver
117. https://web.dev/articles/lazy-loading-video — 영상 지연 로딩
118. https://developer.mozilla.org/docs/Learn_web_development/Extensions/Performance/video — 소리 없는 영상은 오디오 트랙 제거(약 20% 절감)
119. https://webperf-snippets.nucliweb.net/CoreWebVitals/LCP-Video-Candidate — 영상 LCP 점검
120. https://wppoland.com/en/performance-video-backgrounds-autoplay-guide-en/ — 배경 영상 가이드(점진적 향상·동작 줄이기)

합계: 번호 붙은 항목 121건 + 65번 안의 jurniti 주소 1건 = 고유 주소 122건(`count_urls.py` 로 센 값 — 공식 50 · 이슈/PR 11 · HN 5 · 블로그 27 · 영상/SNS 9 · 커뮤니티 저장소 7 · 제3자 사이트 7 · 웹 성능 5). 목표 40건 이상 충족. 단 Reddit·X 사례는 0건(2절).
