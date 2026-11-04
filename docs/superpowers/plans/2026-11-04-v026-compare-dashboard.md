# Sitebrew v0.2.6 개선 라운드 — 구현 계획

설계: `docs/superpowers/specs/2026-11-04-v026-compare-dashboard-design.md`

For agentic workers: REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking. 제1부 7절의 pstack 지점(P1~P4)에서는 멈추고 대표에게 명령 실행을 요청한다.


**P1 확정(2026-11-04): 시그니처와 열린 결정은 `docs/superpowers/specs/2026-11-04-v026-p1-interfaces.md`가 우선한다. 아래 Interfaces와 충돌하면 그 문서를 따른다. 닫은 결정: T7 null = `brief.facts[키]=""`(별도 파일 없음) · T14 서체 = Pretendard OTF base64 임베드 · T20 가중 = 라이브러리 0.04/프리셋 0.06/팔레트 0.10(층별 상한) · T21 계열 8종·colorStrategy 표. T11 리뷰어 위치는 PR #60 값. T12 `finish-review.mjs`(순수)와 T13 `finish-loop.mjs`(nextStep)는 파일을 나눈다. `visualDistance`는 `visual-distance.mjs`에 둔다.**


**Goal: 다음 다섯 가지를 Sitebrew 키트·플러그인에 넣고, 공개 main에 PR(v0.2.6)을 올린다.**

후보 3개 실사이트 비교 대시보드

시안용 예시 정보

머리글 이미지 로고와 로고 시안

포지셔닝과 「다른 세계」 방향 규칙

마감 리뷰 루프


**Architecture:**

Phase A는 06 코드 열쇠 밖의 변경이다: 보드·대시보드 서버, stamp·qa·deliver·intake·플러그인.

Phase B는 06 열쇠 안의 변경 한 묶음이다: site-template·gen-pages·site-files·directions·brand·style-presets·positioning.

Phase B 뒤 골든을 한 번 재증명한다.

새 외부 의존은 없다. 기존 factory/qa/cdp.mjs·factory/stamp/run-proc.mjs·node:http만 쓴다.


**Tech Stack: Node 24 ESM(.mjs), node:test, Next.js(후보 사이트), Chrome CDP, zod(BriefSchema).**


**Spec: 이 문서의 제1부.**


**Global Constraints**

기준 커밋은 25f3fdf(v0.2.5), 가지는 feat/v026-compare-dashboard다.

package.json·registry/**·registry/factory/ui-src/site-shell.tsx는 바꾸지 않는다.

Phase A(T1~T16)는 06 열쇠 안 파일을 바꾸지 않는다. 과제마다 끝에 pagesCodeKey()가 같은지 확인한다(T0 스크립트).

새 npm 의존·원격 호출·CDN은 0이다. 포트는 모두 127.0.0.1이다.

새 단계 입력은 조건부 키 ...(x ? { x } : {})로만 넣는다.

자식 프로세스는 셸 없이 windowsHide:true로 띄우고 run-proc.mjs killTree로 끈다. 경로는 node:path만 쓴다.

사이트·대시보드 문구는 한국어(locale ko)이고, 영어 사이트는 ui-copy의 en 규칙을 따른다.

시험은 node --test --test-force-exit --test-timeout=300000 <파일>로 돌린다.

커밋 메시지는 conventional 접두 + 한국어 설명이다(예: feat(board): 후보 비교 대시보드 서버). 작은 단위로 자주 커밋한다.

제1부 6.1 대표 결정 원문과 제1부 4절 반목표는 모든 과제에 적용된다.


**Review Focus**

실행 폴더 경로에 공백·한글이 있을 때(D:\내 사이트\out\청춘) 서버·중계·spawn이 깨지지 않는다. → T4 픽스처 시험

Next 클라이언트 이동(load 이벤트 없음)에서도 쪽 버튼이 따라간다. → T3·T4 pushState 시험

지난 실행 비정상 종료로 남은 서버·점유 포트를 다음 --serve가 정리한다. → T4 pids 시험

실제 값을 일부만 채우거나 facts.json에 null이 있을 때 남은 예시와 deliver 차단이 정확하다. → T5·T8

가로로 매우 긴 로고·큰 래스터·깨진 SVG는 조용히 사라지지 않고 blocker가 된다. → T17


**File Structure**


| 파일 | 책임 | 과제 |
| --- | --- | --- |
| factory/board/direction-board/build.mjs(수정) | loadBoardData 결함 2건, --serve 깃발 | T1, T4 |
| factory/board/compare/proxy.mjs(새) | HTML 응답의 CSP 교체, bridge 주입 | T2 |
| factory/board/compare/bridge.js(새) | nav·scroll·title 보냄, go·scroll 받음 | T3 |
| factory/board/compare/page.mjs(새) | 대시보드 HTML 생성(부록 A 형태) | T3 |
| factory/board/compare/serve.mjs(새) | 후보 기동·중계·대시보드 서버·확정·수명·정리 | T4 |
| factory/board/compare/compare.test.mjs(새) | 중계·페이지 단위 시험 | T2, T3 |
| factory/board/compare/compare.behavior.test.mjs(새) | headless Chrome 동작 시험 | T4 |
| factory/stamp/sample-facts.mjs(새, stamp.mjs만 import) | 예시 고정 표·채움 범위·남은 예시 | T5 |
| factory/stamp/stamp.mjs(수정) | --sample-facts·병합·07 조건부 키·--pick 법률 건너뛰기·로고 전달·리뷰 진입 | T6, T13, T17 |
| factory/stamp/qa.mjs(수정) | QA_PREFIX.sample·logo·brand, 새 관문 연결 | T6, T9, T10 |
| factory/stamp/blocker-class.mjs(수정) | 새 접두 분류 | T6, T9, T10 |
| factory/intake/to-brief.mjs(수정) | --facts, null, 선택 질문 missing 예외 | T7, T20 |
| plugins/sitebrew/scripts/intake.mjs(수정) | brief --facts, logo-candidates | T7, T14 |
| factory/stamp/deliver.mjs(수정) | 예시 남으면 복사 전 종료 1 | T8 |
| factory/qa/ux-gate.mjs(수정) | 머리글 2배 캡처·로고 계측·768·전체 높이 캡처 | T9, T12 |
| factory/qa/brand-exposure.mjs(새) | DOM 면적 가중 주색 노출 | T10 |
| factory/intake/logo-candidates.mjs(새) | 로고 시안 6개 | T14 |
| 리뷰어 정의(새, T11로 위치 확정) | 마감 리뷰어 | T12 |
| factory/stamp/finish-review.mjs(새) | 리뷰 입력·파싱·검증·라운드 | T12, T13 |
| factory/stamp/site-files.mjs(수정, B) | headerLogoOf(path) | T17 |
| factory/stamp/gen-pages.mjs(수정, B) | 로고 복사·shell.logo·blocker·siteJson.sample·구조분해 제외·법정 초안 | T17, T18 |
| factory/stamp/site-template/lib/site.tsx(수정, B) | 이미지 로고·예시 띠 | T17, T18 |
| factory/stamp/brand.mjs(수정, B) | 첫 색 주색·defaultTheme | T19 |
| factory/stamp/directions.mjs(수정, B) | c 바탕·visualDistance·family-clash·머리 4칸·포지셔닝 | T19~T21 |
| factory/scripts/style-presets.mjs(수정, B) | 브랜드 hue·선호 | T20, T21 |
| factory/scripts/lib/palette-rules.mjs(수정, B) | 보라 확장 | T21 |
| factory/stamp/positioning.mjs(새, B) | 포지셔닝 표 | T20 |
| factory/stamp/material-family.mjs(새, B) | 재료 계열 분류표 | T21 |
| factory/intake/questions.mjs(수정) | positioning, 「첫 색이 주색」 | T19, T20 |
| factory/stamp/COPY.md(수정) | 예시·포지셔닝 규칙, 병렬 안내 | T6, T15, T20 |
| plugins/sitebrew/skills/{new,deliver,doctor,setup,revise}/SKILL.md, .../new/references/intake-questions.md(수정) | 스킬 흐름 | T23 |


## Phase 0


### Task 0: 가지·기준값·환경


**Files:**

Create: docs/superpowers/specs/2026-11-04-v026-compare-dashboard-design.md — 제1부와 부록

Create: docs/superpowers/plans/2026-11-04-v026-compare-dashboard.md — 제2부

Create: factory/scripts/print-pages-key.mjs


**Interfaces:**

Produces: node factory/scripts/print-pages-key.mjs를 실행하면 stdout에 { key: <64hex>, closure: [<repo 상대 경로>...] }가 나온다.

- [ ] Step 1: git checkout -b feat/v026-compare-dashboard 25f3fdf 후 npm ci를 실행한다. 종료 0이어야 한다.
- [ ] Step 2: print-pages-key.mjs를 만든다. factory/stamp/pages-key.mjs의 pagesCodeKey()·importClosure()를 불러 JSON으로 출력한다. 이 파일은 열쇠 닫힘 밖에 둔다.
- [ ] Step 3: 실행해서 나온 key 값을 PR 초안 메모에 적는다.
- [ ] Step 4: npm run ci:verify로 Linux 기준선(실패 0, 건너뜀 수)을 기록한다. Chrome이 없으면 CHROME_PATH를 설정한다. 그래도 안 되면 「headless 시험 불가」로 기록하고 대표에게 알린다.
- [ ] Step 5: 설계·계획 문서를 커밋한다: docs: v0.2.6 개선 라운드 설계·계획.
- [ ] Step 6: P1 정지. 대표에게 P1 명령을 주고 /pstack:architect 결과대로 Interfaces를 고쳐 커밋한다. 이어서 P2 정지: /pstack:interrogate에서 증명된 지적을 계획에 반영하고 커밋한다.

## Phase A — 06 열쇠 밖 (T1~T16)


### Task 1: 방향 보드 자료 결함 2건


**Files:**

Modify: factory/board/direction-board/build.mjs:37-67

Test: factory/scripts/stamp-board.test.mjs, factory/board/direction-board/board.behavior.test.mjs


**Interfaces:**

Produces: loadBoardData(runDir) → { brief, candidates: [{ id, head: { why, preset, palette, fonts, thesis?, ownWorld?, colorStrategy?, materialFamily? }, blockers, summary, previewUrl }] }

head는 factory/board/promote.mjs:33 readCandidateHead(candDir)로 01-direction.json을 병합해 만든다.

brief는 <run>/stamp-summary.json의 brief 경로를 먼저 읽고, 없으면 <run>/brief.json을 읽는다.

- [ ] Step 1: 실패 시험 두 개를 쓴다.
loadBoardData는 01-direction 머리로 why·palette·fonts를 채운다

brief는 stamp-summary.json 경로에서 읽는다

- [ ] Step 2: 실패를 확인한다.
- [ ] Step 3: 구현한다.
- [ ] Step 4: 기존 두 시험까지 통과시킨다. null이던 기대값은 값이 있는 쪽으로 고친다.
- [ ] Step 5: 열쇠 불변을 확인하고 커밋한다.

### Task 2: 후보 중계(proxy)


**Files:**

Create: factory/board/compare/proxy.mjs

Test: factory/board/compare/compare.test.mjs


**Interfaces:**

Produces: startProxy({ upstreamPort, dashboardOrigin, bridgeSource }) → Promise<{ port, origin, close() }>

요청은 그대로 넘기고 accept-encoding: identity로 강제한다.

text/html 응답은 두 가지를 바꾸고 content-length를 다시 잰다.

CSP의 frame-ancestors 'none'을 frame-ancestors <dashboardOrigin>으로 바꾼다.

첫 </head> 앞에 <script src="/__sitebrew/bridge.js"></script>를 한 번 넣는다.

GET /__sitebrew/bridge.js에는 bridgeSource(text/javascript)를 돌려준다.

HTML이 아닌 응답은 바이트 그대로 넘긴다.

- [ ] Step 1: 실패 시험을 쓴다. 가짜 상위 서버로 확인할 것:
CSP 교체와 'none' 제거

bridge 태그 1회

길이 일치

PNG 바이트 동일

bridge 200

close() 뒤 포트 닫힘

- [ ] Step 2: 실패를 확인한다.
- [ ] Step 3: 구현한다. HTML은 버퍼로, 나머지는 파이프로 처리한다.
- [ ] Step 4: 통과를 확인한다.
- [ ] Step 5: 열쇠 불변을 확인하고 커밋한다.

### Task 3: bridge.js와 대시보드 페이지


**Files:**

Create: factory/board/compare/bridge.js, factory/board/compare/page.mjs

Test: factory/board/compare/compare.test.mjs


**Interfaces:**

bridge 규약

보냄: { sb:1, type:'nav', path }, { sb:1, type:'scroll', ratio }, { sb:1, type:'title', title }

받음: { sb:1, type:'go', path }, { sb:1, type:'scroll', ratio }

history.pushState·replaceState를 감싸고, popstate·load에서 nav를 보낸다.

부모 출처는 document.referrer origin만 믿는다.

renderComparePage(data: CompareData) → string

// CompareData

{ title, briefLine, routes: [{ path, label }], candidates: [{ id, name, kind, origin, fallbackImg, head: { thesis, palette: [hex], fonts, colorStrategy }, badges: { aiTell, qualityN, inputN, routesOpen, routesTotal }, blockers: { quality: [str], input: [str] }, row: { msg, act, sig, logo, risk } }], scaleNote: true }

- [ ] Step 1: 실패 시험을 쓴다. HTML에 다음이 모두 있어야 한다.
폭 버튼 3개(data-w="1440|768|390")

쪽 버튼(routes 수만큼), 보기 버튼 2개, #sync

#col-a|b|c와 iframe src=<origin><path>

data-scale

비교표 5행(값 없는 행은 숨김), <dialog>

https:// 0개

- [ ] Step 2: 실패를 확인한다.
- [ ] Step 3: 부록 A 기준으로 구현한다. 시제품과 다른 점:
스크롤·쪽 추적은 postMessage로 한다.

메모는 localStorage(키 sitebrew-compare:<run>:<id>, try/catch)에 둔다.

확인창 문구는 이렇다: 「① 고른 안 완성(--pick, 관문 재검사) ② 예시 정보 n개를 실제 값으로 바꾸기 ③ 마감 리뷰와 고칠 곳(revise) ④ 전달(deliver, 예시가 남으면 막힘)」.

확정하면 POST /api/pick {pick, note}를 보낸다.

fallbackImg가 있으면 iframe 대신 이미지와 「실사이트 못 띄움」 배지를 보인다.

- [ ] Step 4: 통과를 확인한다.
- [ ] Step 5: 열쇠 불변을 확인하고 커밋한다.

### Task 4: 비교 서버와 --serve


**Files:**

Create: factory/board/compare/serve.mjs

Modify: factory/board/direction-board/build.mjs:450-488

Test: factory/board/compare/compare.behavior.test.mjs


**Interfaces:**


**Consumes:**

T1~T3 결과물

startSite(siteDir)(factory/stamp/qa.mjs:162), killTree(factory/stamp/run-proc.mjs:10), splitBlockers(factory/stamp/blocker-class.mjs:64), factory/qa/cdp.mjs


**Produces:**

serveCompare(runDir, { idleMs = 7_200_000, log = console.log, deps } = {}) → Promise<{ url, pick: Promise<'a'|'b'|'c'|null>, stop() }>

stdout COMPARE <url>, PICK <id>

<run>/direction-board/picks.json(원자 쓰기), serve.pids.json

선택 notes.json { "<id>": { thesis?, sig?, risk? } }(에이전트가 씀)

종료 코드: 확정·stop 0, 무입력 초과 4, 후보 0개 기동 1

- [ ] Step 1: 실패 시험을 쓴다. 픽스처는 frame-ancestors 'none'·script-src 'self' 가짜 사이트 3개이고, run 폴더 이름은 런 폴더 공백/청춘이다. 시험은 이렇다.
세 iframe title 메시지

768 → 폭 768

요금 → 세 칸 /pricing

안쪽 링크(pushState) → 쪽 버튼 변경

스크롤 비율 차 ≤0.05

크게 보기 → 열 1개

확정 → picks.json {run, board:1, pick:'b', note, decidedAt} → 종료 0

종료 뒤 자식 PID 0

남은 pids는 명령줄에 그 run site 경로가 있을 때만 끈다

record.mjs --doc picks.json 종료 0

- [ ] Step 2: 실패를 확인한다.
- [ ] Step 3: 구현한다.
<cand>/site/.next/BUILD_ID가 있으면 startSite로 띄운다. 없으면 fallbackImg = <cand>/07-qa/ux/home/gate/hero-1440-light.png를 쓴다.

build.mjs는 --serve면 serveCompare 종료 코드로 끝난다.

- [ ] Step 4: 통과를 확인한다.
- [ ] Step 5: 열쇠 불변을 확인하고 커밋한다: feat(board): 후보 3개 실사이트 비교 대시보드(--serve).

### Task 5: 예시 고정 표와 범위 계산


**Files:**

Create: factory/stamp/sample-facts.mjs

Test: factory/stamp/sample-facts.test.mjs


**Interfaces:**


**Produces:**

sampleScope({ archetype, brief }) → string[]

지금 「확인 필요 사실」이 될 필수 키를 돌려준다.

규칙은 factory/stamp/brief.mjs requiredFacts·factPath, factory/stamp/content.mjs:28 FACT_NAMES에서 가져온다. 이 파일들은 import만 하고 고치지 않는다.

buildSampleFacts({ archetype, brief, locale }) → { version:1, label, facts }

remainingSamples(sample, brief) → string[]  (brief.facts에 키가 있으면 빈 문자열도 답한 것으로 본다. P1 확정)

제외: SECTION_FACTS, legal.*, reviews|testimonials|clients|awards|recognition

값 규칙

메일 example.com

사업자번호 123-45-67891 꼴(검증식 불일치)

도로명 「예시로 00길」

전화 02-0000-0000

가격: 원형별 둥근 숫자(saas 월 49,000원, commerce 29,000원)

en 표: example.com, +1 555-0100

- [ ] Step 1: 실패 시험을 쓴다.
빈 필수 사업자 사실 채움

답한 사실 안 채움

제외 집합 절대 안 채움

사업자번호 검증식 불통과

메일 example.com

remainingSamples는 실제 값·null 제외

결정론

- [ ] Step 2: 실패를 확인한다.
- [ ] Step 3: 구현한다.
- [ ] Step 4: 통과를 확인한다.
- [ ] Step 5: 열쇠 불변을 확인하고 커밋한다.

### Task 6: stamp 병합·07 사유·법률 건너뛰기


**Files:**

Modify: factory/stamp/stamp.mjs — 인자 :54-105, loadBrief 직후, 07 입력 :402, --pick 법률 :386-399

Modify: factory/stamp/qa.mjs:37 — QA_PREFIX.sample = '공개 불가 — 예시 정보 남음: '

Modify: factory/stamp/blocker-class.mjs:22 — INPUT

Modify: factory/stamp/COPY.md — 「예시 정보는 키트 표가 넣고 sample 파일이 표지를 맡는다. 모델은 사실을 지어내지 않는다」

Test: 새 factory/scripts/stamp-sample.test.mjs, factory/scripts/blocker-class.test.mjs


**Interfaces:**

Consumes: T5.

Produces: 다음 동작을 만든다.

--sample-facts면 파일이 없을 때 만든다. 파일이 있으면 깃발 없이 읽는다.

병합된 brief를 01부터 쓴다.

07 blockers에 QA_PREFIX.sample + <키>를 넣는다.

qaInputs에는 남은 목록이 있을 때만 sample 키를 넣는다.

예시가 남은 --pick은 종료 1(입력 대기)로 끝난다.

- [ ] Step 1: 실패 시험을 쓴다.
01 입력에 예시 값

실제 값 우선

07 사유 + publishable:false

blockerClass === 'input'

sample 없는 07 inputHash 불변

예시 남은 --pick 종료 1

- [ ] Step 2: 실패를 확인한다.
- [ ] Step 3: 구현한다.
- [ ] Step 4: 통과를 확인한다.
- [ ] Step 5: 열쇠 불변을 확인하고 커밋한다.

### Task 7: intake brief --facts(S7)


**Files:**

Modify: factory/intake/to-brief.mjs:52-80,92,101, plugins/sitebrew/scripts/intake.mjs:74-90

Test: factory/intake/intake.test.mjs


**Interfaces:**

build(answers, { facts })는 FACT_NAMES·factPath 키만 받는다. 모르는 키는 모르는 사실 칸: <키>로 거절한다.

stdout에 factsApplied를 낸다.

null은 brief.facts[키]="" 로 쓴다(P1 확정). BriefSchema는 그대로이고 briefToSeed·content.mjs가 빈 문자열을 이미 "없음"으로 읽는다. stamp 병합 {...sample, ...brief.facts}에서 빈 문자열이 예시를 덮고, remainingSamples는 brief.facts에 키가 있으면 남은 예시에서 뺀다. 별도 facts.json 파일은 없다.

- [ ] Step 1: 실패 시험을 쓴다.
--facts bizNo가 brief.facts에 들어간다

모르는 키 거절

null 키는 brief.facts에 빈 문자열로 들어가 남은 예시에서 빠지고 07 예시 사유가 사라진다

- [ ] Step 2: 실패를 확인한다.
- [ ] Step 3: 구현한다.
- [ ] Step 4: 통과를 확인한다.
- [ ] Step 5: 열쇠 불변을 확인하고 커밋한다.

### Task 8: deliver 차단


**Files:**

Modify: factory/stamp/deliver.mjs:278-292 앞

Test: factory/scripts/deliver.test.mjs


**Interfaces:**

고른 후보 blockers에 QA_PREFIX.sample 접두가 있으면:

대상 폴더를 만들지 않는다.

stderr에 예시 정보가 남아 전달하지 않습니다: <키 목록>을 쓴다.

종료 1로 끝난다.

다른 사유는 지금처럼 처리한다.

- [ ] Step 1: 실패 시험을 쓴다.
예시 사유 → 종료 1, 폴더 없음, 목록

예시 없음 → 기존 출력과 바이트 같음

- [ ] Step 2: 실패를 확인한다.
- [ ] Step 3: 구현한다.
- [ ] Step 4: 통과를 확인한다.
- [ ] Step 5: 열쇠 불변을 확인하고 커밋한다.

### Task 9: 07 머리글 2배 캡처·로고 관문(S5·S13)


**Files:**

Modify: factory/qa/ux-gate.mjs:89-100

Modify: factory/stamp/qa.mjs — QA_PREFIX.logo = '공개 불가 — 로고가 머리글에 안 보임: '

Modify: factory/stamp/blocker-class.mjs — QUALITY

Test: factory/scripts/stamp-qa.test.mjs


**Interfaces:**

캡처: [data-slot=site-shell-header] 상자를 Page.captureScreenshot({ clip:{ x:0, y:0, width:w, height:rect.bottom+8, scale:2 } })로 찍어 <cand>/07-qa/ux/<slug>/gate/header-<w>-light-2x.png에 둔다.

계측: gate.logo = { present, kind:'img'|'mask'|'text', renderedHeight, naturalWidth, complete }

판정: 로고가 있는 brief에서 다음 중 하나면 blocker다. 로고가 없는 brief는 이 관문을 생략한다.

kind==='text'

complete===false

renderedHeight<20

- [ ] Step 1: 실패 시험을 쓴다.
img 로고 통과 + 2x 파일

깨진 img 사유

로고 brief + 글자만 사유

로고 없는 brief 생략

- [ ] Step 2: 실패를 확인한다.
- [ ] Step 3: 구현한다.
- [ ] Step 4: 통과를 확인한다.
- [ ] Step 5: 열쇠 불변을 확인하고 커밋한다.

### Task 10: 07 brand-exposure 관문(S4)


**Files:**

Create: factory/qa/brand-exposure.mjs

Modify: factory/stamp/qa.mjs:331 — adapterGate, QA_PREFIX.brand = '공개 불가 — 브랜드 주색이 화면에 거의 안 보임: '

Modify: factory/stamp/blocker-class.mjs — QUALITY

Test: factory/qa/brand-exposure.test.mjs


**Interfaces:**

measureBrandExposure(page, { colorHex, threshold = 0.07 }) → { ratio, samples }

캔버스 색 변환 헬퍼는 factory/qa/ai-tell.mjs:183 probe 방식을 참고해 새로 쓴다.

brandExposureGate(cand) → { pass, ratio, floor }

하한: Restrained 0.01, Committed 0.15, 그 밖 0.01

입력 색: cand.brand.input.colors[0]

- [ ] Step 1: 실패 시험을 쓴다.
주색 3% → 통과

0% → 사유

브랜드 없음 → 생략

- [ ] Step 2: 실패를 확인한다.
- [ ] Step 3: 구현한다.
- [ ] Step 4: 통과를 확인한다.
- [ ] Step 5: 열쇠 불변을 확인하고 커밋한다.

### Task 11: 마감 리뷰 조사(F9 — 먼저 확정)


**Files:**

Create: docs/superpowers/specs/2026-11-04-finish-review-mapping.md

코드를 쓰지 않는다. 결과로 T12·T13 Interfaces를 확정한다.

- [ ] Step 1: revise 어휘 전체를 목록으로 만든다. 볼 곳은 plugins/sitebrew/skills/revise/SKILL.md·references, factory/stamp/revise-*.mjs, stamp.mjs revise 인자다.
- [ ] Step 2: 지적 유형 → revise 처방 대응표를 만든다. 유형은 문구, 섹션 순서·삭제·추가, 레시피 축(색·서체·둥글기·그림자), 히어로 계열, 로고 크기, 모바일 머리글 줄 수, 대비다. 옮길 수 없는 유형은 「사람 결정」으로 둔다.
- [ ] Step 3: plugins/sitebrew/.claude-plugin/plugin.json이 agents/를 지원하는지 확인한다.
지원하면 plugins/sitebrew/agents/sitebrew-finish-reviewer.md에 둔다.

지원하지 않으면 skills/new/references/finish-reviewer.md에 둔다.

Codex 대체 경로도 정한다.

- [ ] Step 4: 리뷰용 768 첫 화면과 쪽별 전체 높이(1440·375) 캡처를 ux-gate.mjs에 추가할지 정한다. 이 파일은 열쇠 밖이고, 07 입력은 바꾸지 않는다.
- [ ] Step 5: 회차 비용(revise 뒤 06·07 재실행 시간)을 잰다. 문서를 쓰고 커밋한다.

### Task 12: 마감 리뷰어와 리뷰 입출력


**Files:**

Create: factory/stamp/finish-review.mjs, 리뷰어 정의(T11 위치), factory/stamp/finish-review.test.mjs

Modify: factory/qa/ux-gate.mjs — T11에서 정했으면


**Interfaces:**

collectReviewInputs(runDir, pick) → { shots: [{ path, width, kind }], head, brief, blockers }

parseReview(md) → { round, disposition:'ship'|'fix'|'rebuild'|'recapture', findings: [{ id, where, problem, prescription: { kind:'revise'|'human', command? } }] }

형식이 틀리면 ReviewFormatError를 던진다.

parseVerdict(md) → { round, results: [{ id, status:'resolved'|'partial'|'unresolved' }], regressions }

파일 위치: <run>/<pick>/09-review/review-<n>.md, verdict-<n>.md

리뷰어 지시(새로 작성): 「격리된 눈으로 스크린샷만 보고 판정한다. 후보 머리의 논지·세계와 어긋난 곳, 첫 화면, 모바일, 대비, 로고, 만든 티가 나는 곳을 본다. 지적마다 revise 처방을 붙이고, 못 옮기면 human. 사실을 지어내지 않는다」

- [ ] Step 1: 실패 시험을 쓴다.
바른 형식 → 객체

disposition 4어휘 밖 → 오류

prescription.kind 검증

verdict 3상태

입력에 header-2x·hero·타일 포함

- [ ] Step 2: 실패를 확인한다.
- [ ] Step 3: 구현한다.
- [ ] Step 4: 통과를 확인한다.
- [ ] Step 5: 열쇠 불변을 확인하고 커밋한다.

### Task 13: 마감 리뷰 루프와 상한


**Files:**

Modify: factory/stamp/stamp.mjs(--pick 성공 뒤 진입. 형태는 T11로 정한다), factory/stamp/finish-review.mjs

Test: factory/stamp/finish-review.test.mjs


**Interfaces:**

nextStep(runDir, pick) → { action:'review'|'apply'|'verdict'|'ask-human'|'done', round }

리뷰가 없으면 review

fix이고 revise 처방이면 apply → 다시 찍기 → verdict

미해결이 있고 round<2면 review

round≥2이거나 human 처방이거나 rebuild면 ask-human

ship이면 done

stdout REVIEW <action> <round>

- [ ] Step 1: 실패 시험을 쓴다. 분기마다 하나씩 6개이고, 세 번째 fix → ask-human도 넣는다.
- [ ] Step 2: 실패를 확인한다.
- [ ] Step 3: 구현한다.
- [ ] Step 4: 통과를 확인한다.
- [ ] Step 5: 열쇠 불변을 확인하고 커밋한다.

### Task 14: 로고 시안 생성(S2)


**Files:**

Create: factory/intake/logo-candidates.mjs, factory/intake/logo-candidates.test.mjs

Modify: plugins/sitebrew/scripts/intake.mjs — logo-candidates --input out/answers.json --out out/logo-candidates


**Interfaces:**

makeLogoCandidates({ name, mood, colors, fonts, outDir, codex=false }) → Promise<{ sheet, items: [{ id, path, width, height, kind:'wordmark'|'mark+wordmark', symbol:'geometric'|'codex' }] }>

6개를 만든다.

글자형 2개(서체 2종)

기호+글자 4개(기하 3 + Codex 1, Codex가 꺼지면 기하 4)

렌더링은 factory/qa/cdp.mjs Chrome으로 한다. Emulation.setDefaultBackgroundColorOverride({ color:{r:0,g:0,b:0,a:0} })로 투명 PNG를 만들고, 크기는 머리글 높이의 2배로 한다.

서체는 node_modules/pretendard OTF(ExtraBold·Light)를 base64 data URL로 HTML @font-face에 넣는다. 네트워크 0. WF_LOGO_FONT_DIR가 있으면 그 폴더 서체를 추가 후보로 쓴다. Chrome이 없으면 던지지 않고 skipped:"no-chrome".

시트에는 각 시안을 1배·2배로 함께 보인다(S13).

Codex로는 기호만 만든다.

- [ ] Step 1: 실패 시험을 쓴다.
codex:false → 6개·투명 픽셀

시트 1배·2배

결정론(codex 제외)

- [ ] Step 2: 실패를 확인한다.
- [ ] Step 3: 구현한다.
- [ ] Step 4: 통과를 확인한다. Chrome이 없으면 skip하고 그 사실을 표시한다.
- [ ] Step 5: 열쇠 불변을 확인하고 커밋한다.

### Task 15: 작은 개선 묶음(S8·S9·S10)


**Files:**

S8: plugins/sitebrew/scripts/doctor.mjs와 키트의 HIGGSFIELD_DIR 해석(factory/stamp/stamp.mjs:220-227 근처, factory/stamp/media.mjs, build-media.mjs:22)

S9: plugins/sitebrew/scripts/setup.mjs, skills/setup/SKILL.md

S10: factory/stamp/COPY.md, skills/new/SKILL.md 3절

Test: plugins/sitebrew/test/contract.test.mjs, doctor 스냅샷

- [ ] Step 1: 실패 시험을 쓴다: doctor와 stamp가 같은 HIGGSFIELD_DIR 후보·우선순위로 같은 결과.
- [ ] Step 2: 공통 함수 하나로 S8을 구현하고 통과시킨다.
- [ ] Step 3: S9를 고친다. 기본 제안은 ~/dev/Sitebrew이고, 문서 폴더가 클라우드 동기화 대상이면 경고한다. 스냅샷을 갱신한다.
- [ ] Step 4: S10 문장을 넣는다: 「후보 3개 문구는 서로 독립이라 하네스가 하위 에이전트를 지원하면 후보마다 하나씩 병렬로 쓴다. 각자 04-content.request.json만 읽고 자기 04-content.json만 쓴다」.
- [ ] Step 5: 계약 시험과 열쇠 불변을 확인하고 커밋한다.

### Task 16: 07 후보 병렬 선택 옵션(S11)


**Files:**

Modify: factory/stamp/stamp.mjs(07 루프)와 관문 잠금

Test: factory/scripts/stamp-cli.test.mjs


**Interfaces:**

WF_QA_PARALLEL=1이면 후보를 동시에 최대 3개 돌린다. 기본은 끈다.

결과 파일과 해시는 직렬 실행과 같아야 한다.

- [ ] Step 1: Chrome·포트·잠금 공유 지점을 조사한다. 병렬이 안전하지 않으면 「조사 결과 보류」를 PR에 적고 이 과제를 끝낸다.
- [ ] Step 2: 실패 시험을 쓴다: 병렬 07 == 직렬 07.
- [ ] Step 3: 구현한다.
- [ ] Step 4: 통과를 확인한다.
- [ ] Step 5: 열쇠 불변을 확인하고 커밋한다.
Phase A 마감:

key가 T0과 같아야 한다.

ci:verify 결과가 T0 기준선과 같거나 더 나아야 한다.

그다음 P3 정지: /pstack:blast-radius를 요청하고, 그 결과를 Phase B 과제에 반영한다.


## Phase B — 06 열쇠 묶음 (T17~T22, 한 번에)


### Task 17: 머리글 이미지 로고


**Files:**

Modify: factory/stamp/site-files.mjs — 새 headerLogoOf, markSvg는 그대로

Modify: factory/stamp/gen-pages.mjs

generateSite opts logo(:847)

public/brand/ 복사

siteJson.shell(:1301) 조건부 logo

blocker

Modify: factory/stamp/site-template/lib/site.tsx:77-92

Modify: factory/stamp/stamp.mjs:498-502 전달, 06 입력 :378 ...(logo ? { logo: { path, sha256 } } : {})

Test: stamp-site-files.test.mjs, stamp-pages.test.mjs, part-labels.test.mjs, site-a11y-fixes.test.mjs


**Interfaces:**

headerLogoOf(path)는 판정 결과를 돌려준다.

쓸 수 있으면 { ok:true, ext, width, height, mode:'mask'|'img', darkPath? }

못 쓰면 { ok:false, reason }. 이유는 넷이다: 형식, 비율 > 6:1, > 1MB, SVG viewBox 없음.

mode는 currentColor SVG면 mask, 그 밖은 img다.

siteJson.shell.logo = { src:'/brand/logo.<ext>', width, height, mode, srcDark?, headerAxis }

못 쓰는 로고는 blocker 공개 불가 — 로고 머리글 미적용: <사유>를 낸다.

site.tsx

높이: 기본 32px, H2 28px, H5 데스크톱 48px. 「헤더 안쪽 높이 − 16px」로 clamp한다.

width·height 속성을 넣고 w-auto max-w-full object-contain object-left, alt={브랜드명}을 쓴다.

mask 모드는 <span role="img" aria-label>로 그린다.

글자 로고 출력 문자열은 그대로 유지한다: <a href="/" className="font-heading inline-flex min-h-11 items-center">, ...(locale === "en" ? { locale } : {}).

- [ ] Step 1: 실패 시험을 쓴다.
currentColor SVG → mask

PNG 300×100 → img 32px

8:1 거절

logo.dark.png → srcDark

로고 없는 site.json 불변

a·b·c 모두 shell.logo

stamp-site-files.test.mjs:93-104 통과

- [ ] Step 2: 실패를 확인한다.
- [ ] Step 3: 구현한다.
- [ ] Step 4: 통과를 확인한다.
- [ ] Step 5: 커밋한다. 열쇠가 바뀌는 것은 의도다.

### Task 18: 예시 띠와 법정 초안


**Files:**

Modify: factory/stamp/gen-pages.mjs

<runDir>/sample-facts.json을 읽어 siteJson.sample = { label, count }(조건부)

:1438,1457 구조분해에서 sample 제외

draftInput(:1180-1190)에서 예시 유래 business.*를 비움

Modify: factory/stamp/site-template/lib/site.tsx

shellProps는 site.sample이 있으면 SiteShell banner를 반환

:60 seoContent에서 sample 제외

Test: stamp-pages.test.mjs, 법정 초안 시험


**Interfaces:**

띠 문구(ko): 이 시안에는 예시 정보 {count}개가 들어 있어요. 공개 전에 실제 정보로 바꿔야 해요.

띠 문구(en): This draft contains {count} sample details. Replace them with real ones before publishing.

띠 크기: 375폭에서 ≤56px, 한 줄 12~14px

- [ ] Step 1: 실패 시험을 쓴다.
sample → 모든 쪽 banner

없음 → 불변

JSON-LD·메타에 sample 없음

초안에 예시 bizNo 없음·「확인 필요」

- [ ] Step 2: 실패를 확인한다.
- [ ] Step 3: 구현한다.
- [ ] Step 4: 통과를 확인한다.
- [ ] Step 5: 커밋한다.

### Task 19: 브랜드 주색·테마·바탕 프리셋


**Files:**

Modify: factory/stamp/brand.mjs:128-136, :193-200

Modify: factory/stamp/directions.mjs:234

Modify: factory/intake/questions.mjs:62 — 「첫 번째 색이 주색이 돼요」

Test: stamp-directions.test.mjs, 새 factory/stamp/brand.test.mjs


**Interfaces:**

assignRoles: 첫 유채색(C ≥ 0.05)이 primary다.

head.defaultTheme: 브랜드 바탕 역할 색이 L < 0.35면 dark, 아니면 light다. 프리셋 hints가 덮지 않는다.

c 바탕: 같은 테마 프리셋 가운데 novelty 최고를 고른다.

- [ ] Step 1: 실패 시험을 쓴다. 부록 B 색 [#0F7B5F, #FF6B35, #14213D]로:
c primary hue ≈ 160±15

light

c 바탕 light

- [ ] Step 2: 실패를 확인한다.
- [ ] Step 3: 구현한다.
- [ ] Step 4: 통과를 확인한다.
- [ ] Step 5: 커밋한다.

### Task 20: 포지셔닝


**Files:**

Create: factory/stamp/positioning.mjs

Modify:

factory/intake/questions.mjs — COMMON 9번째 선택 질문

factory/intake/to-brief.mjs:101 — 선택 missing 예외

factory/scripts/style-presets.mjs — listPresets 선호

factory/stamp/directions.mjs — keyOf, c 바탕

factory/stamp/COPY.md — 「positioning은 전략 입력이지 게시 문구가 아니다」

plugins/sitebrew/skills/new/references/intake-questions.md — 손으로 맞춤

plugins/sitebrew/skills/new/SKILL.md:104

Test: factory/intake/intake.test.mjs:38(.slice(8) → .slice(9)), intake-brand.test.mjs:14, factory/stamp/positioning.test.mjs, stamp-mood.test.mjs


**Interfaces:**

질문: { id:'positioning', fact:'positioning', optional:true, ko:'어떤 자리를 노리나요? (예: 업계 최전선 기술, 믿을 수 있는 동네 전문가, 가장 쉬운 선택)', en:… }

positioningProfile(text) → { tags, prefs: { motion?, colorLogic?, theme?, display?, family? } }

태그 5종: frontier, trusted-local, simplest, premium, playful

낱말 매칭은 mood.mjs 방식을 따른다.

가중(P1 확정): 라이브러리 a 안 축당 POS_LIBRARY_W=0.04(최대 2축), 프리셋 점수 축당 POS_PRESET_W=0.06(최대 2축), 팔레트 테마 일치 POS_PALETTE_W=0.10. 원형 적합도 한 단계(0.1)를 뒤집지 못한다.

- [ ] Step 1: 실패 시험을 쓴다.
포지셔닝 없음 → 01 출력 T19 직후와 같음

frontier → M2+·K6+ 선호 반영

COPY 규칙 줄 존재

slice(9)

- [ ] Step 2: 실패를 확인한다.
- [ ] Step 3: 구현한다.
- [ ] Step 4: 통과를 확인한다.
- [ ] Step 5: 커밋한다.

### Task 21: 「다른 세계」·팔레트·보라·후보 머리 4칸


**Files:**

Create: factory/stamp/material-family.mjs

Modify: factory/stamp/directions.mjs, factory/scripts/style-presets.mjs:336(brand 인자), factory/scripts/lib/palette-rules.mjs:51

Test: stamp-directions.test.mjs, material-family.test.mjs, golden.test.mjs, bold.test.mjs


**Interfaces:**

visualDistance(a, b) → number: 셈하는 축은 surface·header·shadow·display·texture·defaultTheme·히어로 계열이다.

materialFamily(head) → 'paper'|'print'|'collage'|'glass'|'editorial'|'kinetic'|'terminal'|'plain'

분류표는 P1 문서 4.6절이 확정한다(glass → collage → print → paper → kinetic → editorial → terminal → plain, 앞에서부터 첫 일치). visualDistance는 factory/stamp/visual-distance.mjs, 칸 7개(surface·header·shadow·display·texture·defaultTheme·hero).

규칙: 모든 쌍에서 visualDistance ≥ 2이고 계열이 서로 달라야 한다. 위반은 rejected에 규칙 id로 기록한다.

colorStrategy(P1 확정): K1·K3·K5·K9 Restrained, K4·K6·K7 Committed, K2·K8 Full.

thesis 템플릿: {계열} 세계에서 {색 전략} 색으로 {포지셔닝 또는 원형 목표}를 보여 줘요.

- [ ] Step 1: 실패 시험을 쓴다.
부록 B: 쌍마다 ≥2·계열 3종

b primary hue 초록 ±30° 또는 보색

foreground 보라 C 0.30 탈락

머리 4칸

- [ ] Step 2: 실패를 확인한다.
- [ ] Step 3: 구현한다.
- [ ] Step 4: 통과를 확인한다. golden·bold·mood 실패는 T22에서 처리한다.
- [ ] Step 5: 커밋한다.

### Task 22: 기준 갱신과 골든 재증명


**Files:**

Modify: factory/scripts/fixtures/stamp-app-shell/other-archetypes.json(머리 baseCommit), factory/scripts/stamp-mood-baseline.json, 골든 씨앗·표(docs/qa/p3-4-golden.md, factory/stamp/golden.mjs)

- [ ] Step 1: WF_WRITE_APP_SHELL_BASELINE=1 node --test --test-force-exit --test-timeout=300000 factory/scripts/stamp-app-shell.test.mjs로 재생성한다. 환경 변수 없이 다시 돌려 통과를 확인한다.
- [ ] Step 2: mood 기준은 그 시험의 갱신 방법으로 재생성한다. diff 요약을 PR 「의도한 기준 변경」에 적는다.
- [ ] Step 3: golden.test.mjs가 깨지면 golden.mjs findSeed 절차로 씨앗과 표를 갱신한다. 세트 조건을 못 채우는 원형은 D13의 뒤집는 조건을 적용한다.
- [ ] Step 4: 골든 실빌드 3건을 백그라운드로 돌린다. 하나에 25~45분 걸린다.
node factory/stamp/stamp.mjs --golden commerce-2

node factory/stamp/stamp.mjs --golden brand-1

비브랜드 1건

확인할 것: 로고, header-1440-light-2x.png, brand-exposure, 계열

환경이 무거운 빌드를 못 하면 PR에 적고 대표에게 「로컬 골든 재증명 필요」를 알린다.

- [ ] Step 5: 선택: --all-golden(약 3시간). 커밋: test: v0.2.6 기준 갱신과 골든 재증명.

## Phase C — 플러그인 흐름과 버전


### Task 23: 스킬 갱신과 v0.2.6


**Files:**

Modify: plugins/sitebrew/skills/{new,deliver,revise}/SKILL.md, .../new/references/*, node ci/bump-version.mjs 0.2.6이 바꾸는 파일

Test: node --test --test-force-exit --test-timeout=300000 "plugins/sitebrew/test/*.test.mjs"(contract.test.mjs:236-303), ci/check-single-version.mjs

new 스킬 바뀌는 절

2절

positioning 질문을 묻는다.

「Brand answers」 턴에서 로고 파일이 없으면 시안을 만든다: node <plugin>/scripts/intake.mjs --kit . logo-candidates --input out/answers.json --out out/logo-candidates.

시트를 보여 준다. 번호를 고르면 answers.logo에 넣고, 안 고르면 비워 둔다.

질문에 없는 실제 사실은 out/facts.json에 쓰고 brief --facts로 넣는다.

3절

빌드 전에 묻는다: 「빈 사실 N개는 예시 정보로 채워 시안을 완성하고, 고른 뒤 실제 값으로 바꿔야 전달돼요. 빌드할까요?」

--sample-facts로 빌드한다.

S10 병렬 안내를 따른다.

4절

npm run board:direction -- out/my-site --serve를 백그라운드로 띄운다.

COMPARE <url>을 전달하고, 내장 브라우저가 있으면 연다.

두 줄 요약을 direction-board/notes.json에 쓴다.

PICK <id>가 나오면 5절로 간다.

대화로 고르면 curl -X POST <url>/api/stop(PowerShell은 Invoke-WebRequest -Method Post)으로 끈다.

남은 프로세스가 0개인지 확인한다.

대시보드가 실패하면 기존 HTML 보드로 내려간다.

5절

예시 사유로 종료 1이 나면 남은 키를 묻는다. 지금 답하지 않아도 된다.

이어서 마감 리뷰 루프를 돈다: REVIEW <action> <round>, 2라운드 뒤 사용자에게 묻는다.

Never

기존 줄 「Invent a fact (phone, logo, photo, hours, price)」는 유지한다.

예외 한 줄을 더한다: 「키트 표가 넣은 예시 정보와, 키트가 만든 로고 시안을 사용자가 고른 것은 지어낸 사실이 아니다. 예시 정보는 전달 전에 반드시 실제 값으로 바뀐다」

한 줄을 더한다: 「positioning 답을 사이트 문구로 그대로 쓰지 않는다」

deliver 스킬: 예시 정보 때문에 종료 1이 나는 경우의 의미와, 실제 값을 넣는 길을 적는다.

- [ ] Step 1: 계약 시험에 새 문장·참조 기대를 더한다.
new는 --serve와 --sample-facts를 안내한다

Never에 예시 정보 예외

- [ ] Step 2: 실패를 확인한다.
- [ ] Step 3: 스킬을 고친다. intake-questions.md는 손으로 맞추고, 머리말은 유지한다.
- [ ] Step 4: node ci/bump-version.mjs 0.2.6을 실행하고 docs/RELEASING.md의 PR 전 단계를 돈다: README 행, npm run gen:all, registry:pincheck -- v0.2.6, check-single-version. 태그·태그 push·npm publish는 하지 않는다.
- [ ] Step 5: 통과하면 커밋한다: chore(release): v0.2.6 플러그인 흐름과 버전.

## Phase D — 검증과 PR


### Task 24: 검증 라운드

- [ ] Step 1: npm run ci:verify → 녹색이어야 한다. 건너뜀 수는 T0 이하여야 한다.
- [ ] Step 2: node --test --test-force-exit --test-timeout=300000 "plugins/sitebrew/test/*.test.mjs" → 실패 0이어야 한다.
- [ ] Step 3: 실런을 한다.
순서

부록 B로 intake brief를 실행한다.

npm run stamp -- --brief out/brief.json --run out/youthcare --sample-facts를 백그라운드로 돌린다. 종료 3이면 COPY.md대로 문구를 쓰고 다시 돌린다.

npm run board:direction -- out/youthcare --serve

확인

1440/768/390 headless 스크린샷을 부록 A와 대조한다.

로고, 띠, 계열 3종

/api/stop 뒤 pgrep -f out/youthcare가 비어 있다.

--pick b가 종료 1이다.

deliver가 종료 1이다.

out/facts.json에 실제 값을 넣고 다시 --pick하면 사유가 사라진다.

- [ ] Step 4: 마감 리뷰 루프를 1회 돈다. 09-review/review-1.md가 parseReview를 통과하고 nextStep 출력이 맞는지 본다.
- [ ] Step 5: superpowers:verification-before-completion으로 제1부 9절 1~9를 대조한다. 항목마다 실제 출력(종료 코드·건수·경로)을 붙인 PR 본문 표를 만든다.
- [ ] Step 6: P4 정지(선택). /pstack:interrogate를 요청하고 증명된 지적을 고친다.

### Task 25: PR

- [ ] Step 1: git push -u origin feat/v026-compare-dashboard 후 gh pr create --base main을 실행한다.
제목: 「v0.2.6: 후보 비교 대시보드·예시 정보·머리글 로고·방향 규칙·마감 리뷰」

본문

요약

9절 검증 표

의도한 기준 변경

impeccable 참고 고지

「intake-questions.md 원본 생성기 반영은 후속」

10절 후속

미검증 항목

- [ ] Step 2: CI(ci·plugin-checks·version-bump·security)를 확인하고, 실패하면 고친다.
- [ ] Step 3: 병합하지 않는다. 대표에게 PR 주소와 검증 표를 보고하고 병합 승인을 받는다. 태그·Release·npm은 대표가 한다.
자체 점검

설계 대비 누락

목표: G1 → T1~T4 · G2 → T5~T8·T18 · G3 → T9·T14·T17 · G4 → T10·T19~T21 · G5 → T11~T13 · G6 → T1 · G7 → T7·T15·T16 · G8 → T23·T25

반목표: A1 → 과제별 Step 5·Phase A 마감 · A2 → T8 · A3 → T5 · A4 → T4 · A5 → Global Constraints · A6 → T13·T23 · A7 → T2 · A8 → T20·T23

이름 일관성: startProxy, renderComparePage, serveCompare, buildSampleFacts, remainingSamples, sampleScope, headerLogoOf, measureBrandExposure, brandExposureGate, positioningProfile, visualDistance, materialFamily, collectReviewInputs, parseReview, parseVerdict, nextStep, makeLogoCandidates

열린 결정(P1에서 확정)

T7 null 저장 위치

T14 서체 로드 경로

T20 가중값

T21 재료 계열 표·나머지 colorStrategy

T11 리뷰어 정의 위치

