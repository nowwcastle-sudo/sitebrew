# Sitebrew v0.2.6 개선 라운드 — 통합 설계

이 문서 하나로 작업을 시작할 수 있게 썼다. 로컬 PC·NAS 경로는 쓰지 않는다.

모든 경로는 공개 저장소 nowwcastle-sudo/sitebrew 루트 기준 상대 경로다.

줄 번호는 기준 커밋 25f3fdf(v0.2.5) 기준이다. main이 움직였으면 같은 이름으로 다시 찾는다.

작성일은 2026-11-04다.

설계 출처는 셋이다. 솔결재 사이트 시안 제작(impeccable 방식 3안 + 비교 대시보드)에서 나온 개선안 S1~S13, arena 선별(2후보 합성), 코드 조사 3건.


## 제1부 — 통합 설계


## 1. 의도와 이유

Sitebrew는 사이트 후보 3개(a·b·c)를 사람 없이 빌드한 뒤 운영자가 하나를 고르게 한다. 실제 제작(솔결재)에서 문제 다섯 가지가 드러났다.

고르는 화면이 약하다.

방향 보드(npm run board:direction)는 글 카드뿐이다.

플러그인이 --capture를 부르지 않아 늘 「첫 화면 영상 없음 — 촬영 전」이 나온다.

카드의 why·palette·fonts도 데이터 결함으로 비어 있다. 그래서 운영자가 07-qa 폴더의 스크린샷을 따로 찾아야 했다.

impeccable 방식으로 실제 사이트 3개를 한 화면에서 폭별로 둘러보는 비교 대시보드를 만들어 보니 고르기가 쉬웠다.

대표는 이 대시보드를 「반드시 필요」하다고 지정했다. 시제품(부록 A)에는 「이대로 진행해」라고 확정했다.

시안이 빈칸투성이다.

블로커 37건 중 18건이 「확인 필요 사실」(사업자번호·주소·대표자 등)이었다.

대표 방향: 「일단 가상의 정보로 집어넣고 빠르게 시안 뽑은 뒤에 마음에 들면 실제 정보로 교체」.

로고가 머리글에 안 나온다.

머리글은 글자 전용이다(factory/stamp/site-template/lib/site.tsx:77-92).

로고 파일은 브랜드 후보 c의 파비콘·OG에만 쓰인다. 그마저 currentColor SVG가 아니면 도형으로 조용히 바뀐다(factory/stamp/site-files.mjs:41-51).

로고를 만드는 단계가 없다. 급히 만든 평면 SVG는 대표가 「너무 svg 스러워」라며 거절했다.

세 후보가 덜 달랐고 브랜드 색이 안 보였다. 실측 결과는 이렇다.

c는 채도가 가장 높은 주황을 주색으로 골랐다(factory/stamp/brand.mjs:128-136 assignRoles).

c는 생성 후보의 어두운 바탕 프리셋을 물려받았다(factory/stamp/directions.mjs:234, factory/scripts/style-presets.mjs:386).

b는 분위기 「대담한」 가산 때문에 보라 네온 팔레트가 됐다(style-presets.mjs:336-340).

브랜드 주색 #0F7B5F의 화면 픽셀 비율은 세 후보 모두 0%였다.

세 후보의 표면·머리글·그림자·디스플레이·질감 축이 모두 같았다(C1·H1·S0·D1·X0).

포지셔닝(예: 「업계 최전선 AI」)을 받는 질문이 없다.

마감 리뷰가 없다.

고른 안을 독립 리뷰어가 보고 고칠 곳을 정하는 단계가 없다.

impeccable에서는 이 단계(finish-reviewer, ship/fix/rebuild 판정)로 B안 품질이 크게 올랐다.


## 2. 출발점과 작업 환경

저장소는 https://github.com/nowwcastle-sudo/sitebrew다.

기준 커밋: main = 25f3fdf(v0.2.5)

작업 가지: feat/v026-compare-dashboard

저장소 구조

키트는 factory/ 아래에 있다.

stamp 파이프라인: factory/stamp/

보드: factory/board/

intake: factory/intake/

품질 관문: factory/qa/

시험: factory/scripts/*.test.mjs·factory/**/*.test.mjs

플러그인은 plugins/sitebrew/ 아래에 있다: skills/<이름>/SKILL.md, scripts/intake.mjs, test/contract.test.mjs.

공개 릴리스 절차는 docs/RELEASING.md에 있다.

실행 환경은 클라우드 Linux를 가정한다.

Node ≥ 24.13.0, npm ≥ 11.6.2

Chrome 또는 Chromium(CHROME_PATH)

stamp 한 판에 메모리 약 3GB, 시간 약 1시간 이상

외부 키는 이번 라운드에 필요 없다. Pexels·LAW_API_OC 없이 preview 모드로 충분하다. Codex 이미지 생성은 선택이다. 없으면 꺼진 경로로 시험한다.

이 저장소 밖의 내부 원본 저장소는 이번 작업에서 다루지 않는다. 10절 「후속(로컬 전용)」으로 넘긴다.

nowwcastle-sudo/web-factory

내부 launch-factory

_tools/plugin-src(로컬 전용)


## 3. 목표

G1 비교 대시보드(S1)

npm run board:direction -- <run> --serve 한 번으로 후보 3개를 실제 사이트로 한 화면에 띄운다.

화면에서 할 수 있는 것은 이렇다.

폭 1440/768/390 전환

같은 쪽 함께 이동, 스크롤 맞춤

셋 나란히 / 하나 크게 보기

공개 불가 사유 두 갈래 확인, 메모, 고르기 확인창, 비교표

고르면 --pick으로 이어진다. 형태는 부록 A 시제품을 따른다.

G2 예시 정보(S6)

시안 단계에서 빈 필수 사실(사업자 표시·거래 조건)을 키트 고정 표의 예시 값으로 채운다.

예시 값은 실행 폴더 한 파일에 모은다.

사이트에 「예시 정보가 들어 있다」는 띠를 단다.

모두 실제 값으로 바꾸기 전에는 전달(deliver)을 막는다.

G3 로고(S2·S5·S13)

브리프 확인 턴에서 로고 시안 약 6개를 만들어 고르게 한다.

고르거나 받은 로고가 a·b·c 모두의 머리글에 이미지로 나온다.

07이 머리글을 2배로 잘라 찍고, 관문이 로고가 보이는지 확인한다.

G4 방향(S3·S4)

포지셔닝을 묻고, 그 답이 01 방향 선택을 실제로 움직이게 한다.

세 후보가 눈에 보이는 축과 재료 계열에서 서로 다르게 한다.

브랜드 첫 색을 주색으로 한다.

b 팔레트를 브랜드 색과 어울리게 한다.

보라 금지를 글자색·강조색까지 넓힌다.

07에서 브랜드 주색이 화면에 보이는지 잰다.

G5 마감 리뷰(F9 변형)

--pick 뒤 격리 리뷰어가 고른 안의 스크린샷을 보고 판정한다. 판정은 ship / fix / rebuild / recapture 가운데 하나다.

fix 지적은 revise로 고친다.

다시 찍은 뒤 지적별로 해결·부분·미해결을 채점하는 판정 패스를 돈다.

무인 상한은 2라운드다.

G6 보드 자료 결함: 카드 why·palette·fonts 공란과 brief 경로 결함을 고친다.

G7 작은 개선(S7~S11)

S7: 사실 수정 경로 intake brief --facts

S8: doctor와 stamp의 Higgsfield 폴더 점검 기준 통일

S9: 설치 폴더 안내 — 로컬 개발 폴더를 먼저 제안하고, 클라우드 동기화 폴더는 경고

S10: 문구 단계(04) 후보 병렬 안내

S11: 07 품질 검사 후보 병렬 선택 옵션

G8 공개 PR: 공개 main을 향한 PR 하나를 올린다. 플러그인 v0.2.6 버전 올림을 포함한다.


## 4. 반목표 (작동해도 실패로 친다)

A1. 06 코드 열쇠가 Phase B 밖에서 바뀐다. 열쇠를 바꾸는 변경은 Phase B 한 단계에 모으고, 골든 재증명은 한 번만 한다.

A2. 예시 정보가 남은 채 전달 폴더가 만들어진다.

A3. 예시 값이 실존 사업자·개인·도로명과 겹치거나, 후기·고객사·수상 같은 사회적 증거를 지어낸다.

A4. 대시보드를 끈 뒤 node/next 프로세스가 남는다.

A5. 새 외부 의존이 생긴다. npm 패키지·원격 API·텔레메트리·ffmpeg 같은 바이너리·CDN 글꼴이 모두 해당한다.

A6. stamp 무인 실행 경로에 새 사람 대기 지점이 생긴다.

사람 대기는 기존 intake 질문과 보드 고르기 두 곳뿐이다.

로고 시안 고르기는 intake 확인 턴 안에서 한다.

마감 리뷰는 무인 2라운드 뒤에만 사람에게 묻는다.

A7. 전달된 사이트의 보안 헤더(CSP frame-ancestors 'none')가 느슨해진다.

A8. 포지셔닝 문구(「업계 최전선」 등)가 그대로 사이트 카피에 게시 문구로 들어간다. 포지셔닝은 전략 입력이지 게시 문구가 아니다.


## 5. 제약

06 코드 열쇠(factory/stamp/pages-key.mjs:3-8)

열쇠는 다음 셋을 해시한다.

registry/factory/**·registry.json·package.json

site-template/**

gen-pages.mjs·ui-copy.mjs에서 따라간 import 닫힘(약 55개 파일)

닫힘 안: stamp/gen-pages.mjs, site-files.mjs, site-media.mjs, content-sections.mjs, content.mjs, brief.mjs, brand.mjs, directions.mjs(compile-candidate.mjs 경유), mood.mjs, scripts/style-presets.mjs, sitemap.mjs, app-shell.mjs, legal/drafts.mjs 등

닫힘 밖: stamp/stamp.mjs, qa.mjs, deliver.mjs, blocker-class.mjs, qa/ux-gate.mjs, intake/*, board/**, 플러그인

열쇠 안 파일을 바꾸면 끝난 06(후보당 10~20분)이 모두 다시 돌고, 골든도 다시 증명해야 한다.

package.json·registry/**·SiteShell(registry/factory/ui-src/site-shell.tsx)은 이번 라운드에 바꾸지 않는다.

바꾸면 gen:styles·15개 레시피 사본·check:regen·블록 시험이 번진다.

그래서 새 npm 스크립트를 만들지 않는다. 대시보드는 기존 board:direction의 --serve 깃발로 띄운다.

단계 입력 해시는 키 정렬 JSON sha256이다(factory/stamp/run-dir.mjs:13-19).

새 입력은 ...(x ? { x } : {}) 조건부 키로 넣는다. 그러면 그 입력이 없는 기존 실행의 해시가 그대로다.

선례: stamp.mjs:367-368, :378

impeccable(Apache-2.0)의 코드·문장은 옮기지 않는다.

흐름의 아이디어만 쓰므로 LICENSE·NOTICE 의무가 없다.

PR 본문에 「impeccable(Apache-2.0)의 흐름을 참고, 코드·문장 미포함」 한 줄을 적는다.

공개 플러그인 목표: 다른 Windows 사용자도 문제없이 써야 한다.

경로 공백·한글을 처리한다(node:path만 쓴다).

셸 없이 spawn하고 windowsHide를 켠다.

포트는 127.0.0.1에만 묶는다.

PowerShell에서는 npm.cmd를 쓴다.

플러그인 파일이 바뀌면 version-bump 워크플로가 버전 올림을 요구한다 → v0.2.6.

plugins/sitebrew/skills/new/references/intake-questions.md는 원래 생성물이다(머리말 「Do not edit by hand」, 생성기는 공개 저장소 밖 _tools).

이번에는 질문 정의(factory/intake/questions.mjs)와 같은 내용으로 손으로 맞춘다.

PR 본문에 「원본 생성기 반영은 후속」이라고 적는다.


## 6. 정해진 것


### 6.1 대표 결정 (원문)

S1 대시보드는 반드시 넣는다. 형태는 확정 시제품(부록 A)을 따른다.

S6: 「일단 가상의 정보로 집어넣고 빠르게 시안 뽑은 뒤에 마음에 들면 실제 정보로 교체」.

가상 값은 한곳에 모아 「예시」 표지를 단다.

모두 바꾸기 전에는 공개를 막는다.

공개 반영: 「공개 main에 바로 PR」. v0.2.4·v0.2.5와 같은 제자리 방식이다.

거래 조건 예시: 「넣음」.

가격·배송·반품·행사 일정·예약/지도 링크도 예시로 채운다.

대표는 시안 화면이 밖에 보일 위험을 알고 정했다. 사이트 전체 「예시」 띠로 그 위험을 줄인다.

범위: 「이번에 한 번에 설계하고 INTENT.md로 작업목록 관리하면서 구현 계획 짜고 진행」.

그래서 미룬 항목이 없다.

06 열쇠를 바꾸는 작업은 한 단계로 묶는다.

S12(생성 이미지 로컬 저장)는 선택으로 낮췄고, 이번에는 하지 않는다.


### 6.2 설계 결정 (뒤집을 조건 함께)

비교 대시보드

D1. 명령은 npm run board:direction -- <run> --serve다. 새 npm 스크립트는 package.json이 06 열쇠라서 기각했다.

D2. 후보 사이트는 CSP frame-ancestors 'none'·script-src 'self'를 보낸다(factory/stamp/site-template/security-headers.mjs:13-24). 그래서 iframe에 그대로 안 뜨고, 포트가 달라 출처도 다르다. 해결 방식은 이렇다.

후보마다 next start(127.0.0.1)와 중계(127.0.0.1)를 하나씩 둔다.

중계는 text/html 응답에서만 두 가지를 바꾼다.

frame-ancestors를 대시보드 주소로 바꾼다.

</head> 앞에 <script src="/__sitebrew/bridge.js">를 넣는다.

bridge는 postMessage로 경로·스크롤을 맞춘다.

사이트 파일·빌드는 바꾸지 않는다.

D3. 확정 결과는 <run>/direction-board/picks.json에 쓴다.

문서 모양은 기존 picks 문서 {run, board, pick, promote, note, decidedAt}(factory/board/direction-board/record.mjs:3)를 따른다.

공개 플러그인 흐름은 record.mjs를 부르지 않고, 승격 버튼도 두지 않는다. record는 추적 파일 factory/board/pairs.jsonl을 더럽히고, 승격은 registry/factory/recipes/**(06 열쇠)를 쓰기 때문이다.

record.mjs --doc picks.json 호환은 시험만 둔다.

D4. 시제품과 다른 점은 셋이다.

글꼴은 시스템 글꼴(system-ui, "Malgun Gothic", "Apple SD Gothic Neo", sans-serif)을 쓰고, CDN은 쓰지 않는다.

열마다 배율(「실제 크기의 31%」)을 표시한다.

확인창 단계 문구를 Sitebrew 흐름으로 바꾼다(T3).

예시 정보

D5. 예시 값은 brief에 굽지 않는다.

stamp가 --sample-facts로 <run>/sample-facts.json을 만들고, 메모리에서 {...sample, ...brief.facts}로 덧씌운다. 그래서 brief.json에는 실제 사실만 남는다.

파일이 있으면 깃발 없이도 읽는다. 그래서 보드 실행과 --pick 실행의 입력이 같다.

D6. 채우는 범위는 그 실행에서 지금 「확인 필요 사실」 blocker가 될 필수 키만이다. 사업자 표시와 거래 조건이 여기에 든다.

채우지 않는 것: 선택 섹션 사실(sitemap.mjs SECTION_FACTS), legal.*, 사회적 증거(reviews·testimonials·clients·awards·recognition).

값 규칙

메일·도메인: example.com

사업자번호: 검증 숫자가 틀린 번호

도로명: 존재하지 않는 이름

가격: 그 원형에서 흔한 형식의 둥근 숫자

D7. 실제 값을 넣는 길

질문에 있는 사실은 out/answers.json에 넣는다.

질문에 없는 사실은 intake brief --facts out/facts.json으로 넣는다(FACT_NAMES 키만 받는다).

facts.json의 null은 「우리에게 없는 사실」이다. 예시를 지우고, 지금과 같은 「확인 필요」(전달을 막지 않음)로 돌아간다.

D8. 07은 남은 예시마다 공개 불가 — 예시 정보 남음: <이름>(입력 대기 갈래)을 더한다.

deliver는 이 사유가 있을 때만 복사 전에 종료 1로 멈춘다.

다른 공개 불가 사유는 지금처럼 README에 적고 넘긴다.

기존 사유 BLOCKER.example='공개 불가 — 예시 문구 남음: '(gen-pages.mjs:45)와 이름이 겹치지 않게 한다.

D9. 예시가 남은 상태에서 --pick은 법률 검토 대기를 건너뛰고 입력 대기로 끝난다.

법정 초안 입력에서는 예시에서 온 business.*를 비우고, 초안은 「확인 필요」로 그린다.

로고

D10. 머리글 이미지 로고

고치는 곳은 셋이다.

site.tsx shellProps

gen-pages.mjs(복사·siteJson.shell.logo)

site-files.mjs(새 판정 함수)

markSvg는 그대로 둔다. stamp-site-files.test.mjs:93-104가 고정한다.

다크 처리

currentColor SVG: CSS mask-image + background:currentColor

고정색 로고: 옆 파일 logo.dark.<ext>가 있을 때만 다크 짝을 쓴다. brand.logoDark 스키마 칸은 기각했다.

대시보드·PWA 사이드바(app-sidebar)는 글자 로고를 유지한다.

D11. 로고 시안 생성

글자: Chrome 래스터(factory/qa/cdp.mjs)

기호: 코드 기하 도형. 선택으로 Codex 이미지(factory/stamp/object-media.mjs codexImage, WF_CODEX_IMAGES=1)를 쓴다.

시안 약 6개를 out/logo-candidates/에 PNG와 한 장짜리 HTML 시트로 낸다.

고르기는 새 질문이 아니다. new 스킬 2절 「Brand answers」 확인 턴에서 하고, 기존 logo 칸에 시안 파일 경로를 넣는다.

방향

D12. 포지셔닝

COMMON 9번째 선택 질문 positioning을 둔다.

답은 brief.facts.positioning에 넣는다. facts가 z.record라서 BriefSchema는 바꾸지 않는다.

새 표 factory/stamp/positioning.mjs가 답을 구조 선호로 바꾼다. 대상은 모션·색논리·기본 테마·디스플레이·재료 계열이다.

선호는 listPresets 점수, librarySafePool 정렬, c 바탕 프리셋 선택에 들어간다.

포지셔닝이 없으면 선호 항은 0이다.

D13. 「다른 세계」 규칙은 모든 브리프에 켠다.

새 visualDistance는 surface·header·shadow·display·texture·기본 테마·히어로 계열을 센다. 세 후보 사이에 이 값이 2 이상이어야 한다.

재료 계열 분류표를 두고, 세 후보의 계열이 서로 달라야 한다. 같으면 family-clash다.

기존 axisDistance·AXIS_COUNT는 그대로 둔다.

뒤집는 조건: 골든 재증명에서 세트 조건을 못 채우는 원형이 있으면, 그 원형만 규칙을 끄고 기록한다.

D14. 브랜드 수정

assignRoles를 「브리프 첫 유채색 = 주색」으로 바꾸고, 질문 문구에도 명시한다.

head.defaultTheme는 브랜드 바탕 밝기로 정한다. 프리셋 hints가 덮지 않게 한다.

c 바탕 프리셋은 브랜드 밝기·채도에 맞춘다.

b 팔레트 점수에 브랜드 주색 hue 근접 가산을 준다(유사색 ±30°·보색).

보라 금지(palette-rules.mjs:51)는 foreground·accent·ring까지 넓힌다.

D15. 후보 머리에 네 칸을 더한다. 모두 템플릿으로 만들고 모델 호출은 없다. 보드와 비교표가 이 칸을 읽는다.

thesis(한 줄 논지)

ownWorld(팔레트·서체·계열·테마 요약)

colorStrategy(Restrained / Committed / Full / Drenched)

materialFamily

D16. 07 brand-exposure 관문

DOM 면적 가중으로 잰다. getComputedStyle의 배경·글자·테두리 색에 getBoundingClientRect 면적을 곱한다.

히어로 1440에서 브랜드 주색 근처(OKLab 거리 0.07 이내) 면적이 하한 미만이면 blocker다.

하한은 colorStrategy별로 다르다. Restrained 1%, Committed 15%이고, 골든 실측 뒤 조정한다.

픽셀 방식은 sharp가 devDependency뿐이라 기각했다.

브랜드 색이 있을 때만 돈다.

마감 리뷰

D17. 리뷰어는 Sitebrew가 새로 쓴 에이전트 정의다.

입력: 07 스크린샷, 새 전체 높이·768 캡처, 후보 머리, 브리프.

출력: <run>/<pick>/09-review/review-<n>.md. disposition과 지적 목록을 담고, 지적마다 revise 명령 형태의 처방을 붙인다.

revise로 못 옮기는 지적은 「사람 결정」으로 둔다.

무인 fix는 최대 2라운드다.

서브에이전트가 없는 하네스(Codex)에서는 같은 세션이 「리뷰어 역할」 절을 읽고 수행하고, 격리가 아님을 한 줄로 밝힌다.

작은 개선

D18. 작은 개선은 조사를 먼저 하고 확정한다(T15·T16).

S8: 점검 기준을 하나로 맞춘다.

S9: 설치 폴더 안내를 바꾼다.

S10: 문구만 바꾼다.

S11: 선택 깃발 WF_QA_PARALLEL=1로 넣고, 기본은 끈다.


## 7. 단계와 pstack 호출 지점

pstack 스킬은 실행 에이전트가 직접 부르지 않는다. 아래 지점에서 멈추고, 대표에게 정확한 명령을 주어 실행을 요청한다.


| 지점 | 대표에게 요청할 명령 | 목적 |
| --- | --- | --- |
| P1 — T0 직후 | /pstack:architect 이 문서(제1부 설계 + 제2부 계획)의 모듈 경계·함수 시그니처·자료 구조를 코드보다 먼저 확정해. 특히 factory/board/compare/*, factory/stamp/sample-facts.mjs, positioning.mjs, visual-distance, 로고 시안 생성, 마감 리뷰 산출물 형식. | 결과로 제2부 Interfaces 칸을 고친다 |
| P2 — P1 반영 직후 | /pstack:interrogate 이 설계와 구현 계획을 깨 봐. 06 코드 열쇠 불변(Phase A), 예시 정보 누출, 중계의 CSP 처리, 프로세스 잔존, 골든 재증명 범위를 집중해서. | 사각지대 |
| P3 — Phase A 끝, T17 직전 | /pstack:blast-radius Phase B 변경(site.tsx·gen-pages·site-files·directions·brand·style-presets·positioning)이 바뀐 파일 밖에서 깨뜨릴 것을 찾아 실제로 돌려 확인해. | 06 열쇠 묶음 파급 |
| P4 — PR 직전(선택) | /pstack:interrogate 작업 가지 전체 diff를 깨 봐. | 최종 적대 검토 |

실행 에이전트가 직접 쓸 스킬:

superpowers:subagent-driven-development

superpowers:test-driven-development

superpowers:verification-before-completion

superpowers:finishing-a-development-branch


## 8. 범위에서 뺀 것 (미룸이 아니라 기각)

후보별 사이트맵·섹션 순서 분기와 월드 표

문구 칸이 id·순서로 짝지어져 있어서(revise-structure.mjs:7,11) 글이 밀린다.

02~07·보드 전체가 영향을 받는다.

「다른 세계」 요구는 D13으로 푼다.

impeccable의 concept-seed 원격 API, detect 바이너리, comp-led 상태기계, live/generate, hooks, provenance 바이너리

외부 의존, 재현 불가, 07과의 중복, 권한 검사를 끈 에이전트 실행 때문이다.

대시보드·PWA 사이드바 이미지 로고, markSvg 변경


## 9. 완료 조건

Phase A가 끝난 시점에 pagesCodeKey()가 기준과 같다. 바뀐 파일 ∩ importClosure() = 0개다.

Phase B 뒤에는 다음을 확인한다.

stamp-app-shell 기준을 재생성하고 통과한다.

stamp-mood-baseline.json·골든 표·씨앗을 의도대로 갱신하고 golden.test.mjs가 통과한다.

골든 실빌드 3건(--golden commerce-2, --golden brand-1, 비브랜드 1건)이 돈다.

대시보드 headless Chrome 시험(frame-ancestors 'none' 픽스처 3개)에서 다음이 모두 된다.

iframe 3개

폭·쪽·안쪽 링크 따라가기·스크롤 동기(오차 ≤5%)·크게 보기

확인창 → picks.json → 종료 0

자식 PID 0개

S6 시험: 채움 범위, 실제 값 우선, null, 07 사유, input 갈래, deliver 종료 1·폴더 없음, 예시가 없을 때 기존 출력 불변.

로고 시험: 머리글 이미지, 다크 짝, 크기, alt, 못 쓰는 로고의 blocker, 07 머리글 2배 캡처, 로고 관문.

방향 시험: 포지셔닝이 없을 때 선호 0, 부록 B 브리프에서 「다른 세계」 규칙 작동, 첫 색 = 주색, 라이트 테마, 보라 확장, brand-exposure.

마감 리뷰 시험: 리뷰 파일 형식, 2라운드 상한, revise 처방 형식.

npm run ci:verify 녹색(Linux 기준선)과 node --test --test-force-exit --test-timeout=300000 "plugins/sitebrew/test/*.test.mjs" 통과.

실런 1회(부록 B, --sample-facts)에서 다음을 확인한다.

--serve

1440/768/390 스크린샷과 부록 A 대조

머리글 로고, 예시 띠

deliver 종료 1

남은 node 0개

PR을 연다. 병합은 대표 승인 뒤에 한다. 공개 main 병합은 플러그인 디렉터리·조직 동기화에 닿기 때문이다.


## 10. 후속 (로컬 전용 — 이 작업에서 하지 않음)

내부 web-factory·_tools/plugin-src에 역이식한다.

_tools/gen-chat-references.mjs로 intake-questions.md를 다시 생성한다.

_tools/repo-src-render.mjs의 PUBLIC_TAG='v0.2.3'과 compat.json을 정리한다.

공개 전용 변경 5묶음을 역이식한다: 의존 갱신 #50~#58, osv 예외 #41, dependabot #51, v0.2.4·v0.2.5 릴리스 커밋.

v0.2.6 태그·GitHub Release·npm 게시는 대표가 직접 한다.


---

## 부록 A — 확정된 비교 대시보드 시제품 (대표 「이대로 진행해」)

솔결재 시안 3개용 정적 시제품이다. 실제 구현과 다른 점은 셋이다.

C 배열은 예시다. 실제로는 loadBoardData·notes.json으로 채운다.

같은 출처 정적 파일이라 contentWindow를 직접 썼다. 실제로는 T2·T3의 중계와 postMessage로 바꾼다.

Pretendard CDN은 시스템 글꼴로 바꾼다.


```html
<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>시안 비교 대시보드 (시제품)</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css">
<style>
  :root { --bg:#f3f3f1; --panel:#fff; --ink:#17171a; --muted:#61616a; --line:#dcdcd7; --accent:#1f4fd8; --ok:#1d7a4a; --warn:#b7791f; --bad:#b4232c; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font:16px/1.55 "Pretendard", system-ui, sans-serif; }
  button, select, textarea { font:inherit; }
  .bar { position:sticky; top:0; z-index:20; background:var(--panel); border-bottom:1px solid var(--line); padding:12px 20px; display:flex; flex-wrap:wrap; gap:14px 22px; align-items:center; }
  .bar h1 { font-size:18px; margin:0; }
  .brief { color:var(--muted); font-size:14px; }
  .group { display:flex; gap:6px; align-items:center; }
  .group > span { font-size:13px; color:var(--muted); margin-right:2px; }
  .seg button { border:1px solid var(--line); background:#fff; padding:6px 12px; border-radius:6px; cursor:pointer; }
  .seg button[aria-pressed="true"] { background:var(--ink); color:#fff; border-color:var(--ink); }
  .grid { display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:16px; padding:16px 20px 8px; }
  .grid.focus { grid-template-columns:minmax(0,1fr); }
  .grid.focus .col:not(.on) { display:none; }
  .col { background:var(--panel); border:1px solid var(--line); border-radius:10px; overflow:hidden; display:flex; flex-direction:column; }
  .col.picked { outline:3px solid var(--accent); }
  .head { padding:14px 16px 10px; border-bottom:1px solid var(--line); }
  .head .top { display:flex; justify-content:space-between; align-items:baseline; gap:8px; }
  .head h2 { margin:0; font-size:18px; }
  .kind { font-size:12px; color:var(--muted); border:1px solid var(--line); border-radius:99px; padding:1px 8px; white-space:nowrap; }
  .thesis { margin:6px 0 8px; font-size:14px; color:var(--muted); }
  .chips { display:flex; gap:6px; flex-wrap:wrap; align-items:center; font-size:12px; color:var(--muted); }
  .sw { width:18px; height:18px; border-radius:4px; border:1px solid rgba(0,0,0,.15); }
  .badges { display:flex; gap:6px; flex-wrap:wrap; margin-top:8px; }
  .b { font-size:12px; padding:2px 8px; border-radius:99px; background:#f0f0ed; }
  .b.ok { color:var(--ok); } .b.warn { color:var(--warn); } .b.bad { color:var(--bad); }
  .stage { position:relative; background:#e9e9e6; overflow:hidden; }
  .stage iframe { position:absolute; top:0; left:0; border:0; transform-origin:0 0; background:#fff; }
  .foot { padding:12px 16px 16px; border-top:1px solid var(--line); display:grid; gap:10px; }
  details summary { cursor:pointer; font-size:14px; }
  details ul { margin:6px 0 0; padding-left:18px; font-size:13px; color:var(--muted); }
  textarea { width:100%; min-height:56px; border:1px solid var(--line); border-radius:6px; padding:8px; font-size:14px; resize:vertical; }
  .actions { display:flex; gap:8px; flex-wrap:wrap; }
  .actions button { border:1px solid var(--line); background:#fff; border-radius:6px; padding:8px 12px; cursor:pointer; }
  .actions .pick { background:var(--accent); color:#fff; border-color:var(--accent); }
  .table { margin:8px 20px 40px; background:var(--panel); border:1px solid var(--line); border-radius:10px; overflow:auto; }
  table { border-collapse:collapse; width:100%; font-size:14px; }
  th, td { text-align:left; padding:10px 14px; border-bottom:1px solid var(--line); vertical-align:top; }
  th { color:var(--muted); font-weight:600; width:180px; }
  .note { margin:0 20px 6px; font-size:13px; color:var(--muted); }
  dialog { border:1px solid var(--line); border-radius:10px; padding:22px; max-width:520px; }
  dialog h2 { margin-top:0; font-size:20px; }
  @media (max-width:1100px) { .grid { grid-template-columns:minmax(0,1fr); } }
</style>
</head>
<body>
<div class="bar">
  <h1>솔결재 · 시안 3개 비교</h1>
  <span class="brief">대상: 장기요양기관 운영자 · 첫 행동: 무료로 시작하기 · 분위기: 대담한</span>
  <div class="group seg" id="vp"><span>화면 폭</span>
    <button data-w="1440" aria-pressed="true">데스크톱</button><button data-w="768">태블릿</button><button data-w="390">휴대폰</button></div>
  <div class="group seg" id="pg"><span>쪽</span>
    <button data-p="index" aria-pressed="true">홈</button><button data-p="ai">AI 기능</button><button data-p="pricing">요금</button><button data-p="founder">만든 사람</button><button data-p="start">시작하기</button></div>
  <div class="group seg" id="lay"><span>보기</span>
    <button data-l="three" aria-pressed="true">셋 나란히</button><button data-l="focus">하나 크게</button></div>
  <label class="group"><input type="checkbox" id="sync" checked> <span>스크롤 함께</span></label>
</div>
<p class="note">시제품이에요. 위 버튼은 세 시안에 한꺼번에 적용돼요. 안쪽 메뉴를 눌러도 쪽이 바뀌어요.</p>

<div class="grid" id="grid"></div>

<div class="table"><table id="cmp"></table></div>

<dialog id="dlg">
  <h2 id="dlgTitle"></h2>
  <p>고르면 이렇게 이어져요.</p>
  <ol>
    <li>독립 마감 리뷰(impeccable finish-reviewer)</li>
    <li>리뷰가 짚은 곳 한꺼번에 고치기 → 다시 찍기</li>
    <li>디자인 규칙 문서(DESIGN.md) 만들기</li>
    <li>가상 정보를 실제 정보로 바꾸기 → 공개 준비</li>
  </ol>
  <p id="dlgMemo" style="color:#61616a;font-size:14px"></p>
  <div class="actions"><button class="pick" id="ok">이 안으로 확정</button><button id="cancel">취소</button></div>
</dialog>

<script>
const C = [
  { id:'a', dir:'a-passbook', name:'A · 운영 통장', kind:'추첨이 고른 안', thesis:'AI가 이번 달 운영을 통장정리처럼 한 줄씩 적어 줘요.',
    sw:['#13234a','#c9a24a','#e6ece8'], fonts:'Hahmlet · Pretendard', det:0, blockers:['사업자 정보 확인 필요','요금 금액 없음','기능 출시 시기 「준비 중」 13개'],
    row:{ msg:'이번 달 운영, AI가 통장정리하듯 한 줄씩 적어 드려요', act:'무료로 시작하기(금색 버튼)', sig:'기록이 한 줄씩 찍히고 마지막 줄이 「확인 필요」로 멈춤', logo:'금박 글자 + 지폐 문양', risk:'은행 통장 연상이 AI 제품으로 읽힐지' } },
  { id:'b', dir:'b-gyeoljae', name:'B · 결재판', kind:'impeccable 추천 안', thesis:'AI가 기안하고 운영자님은 결재만 해요.',
    sw:['#4a1519','#f4f5f3','#d23b2a'], fonts:'나눔명조 · Pretendard', det:2, blockers:['사업자 정보 확인 필요','요금 금액 없음','재료 재제작 중(리뷰 판정 rebuild)'],
    row:{ msg:'서류는 AI가 기안해요. 운영자님은 결재만 하세요.', act:'빈 결재 칸 누르기 → 도장 → 신청', sig:'결재 칸을 누르면 인주 도장이 찍힘', logo:'돌에 새긴 「청춘」 낙관 + 명조 글자', risk:'가장 익숙한 사무 의식이라 새로움이 덜할 수 있음' } },
  { id:'c', dir:'c-catalog', name:'C · CC 카탈로그', kind:'도전 안', thesis:'업계 최전선 AI를 번호 붙은 카탈로그로 보여 줘요.',
    sw:['#0b0b0b','#f2f2ee','#7a8f6a'], fonts:'Wanted Sans · Pretendard', det:12, blockers:['사업자 정보 확인 필요','요금 금액 없음','자동 점검 경고 12건(구분선 오판 추정)'],
    row:{ msg:'말하면, 조회하고 계산하고 초안까지 해요.', act:'무료로 시작하기(흰 버튼)', sig:'맥박선이 흐르고 색 띠에 올리면 기능 이름이 보임', logo:'맥박선 마크 + 직접 그린 글자 + CC-00', risk:'50~60대에게 검은 바탕이 차갑게 느껴질 수 있음' } },
];
let W = 1440, P = 'index', picked = null, focusId = null;
const grid = document.getElementById('grid');

grid.innerHTML = C.map(c => `
  <section class="col" id="col-${c.id}">
    <div class="head">
      <div class="top"><h2>${c.name}</h2><span class="kind">${c.kind}</span></div>
      <p class="thesis">${c.thesis}</p>
      <div class="chips">${c.sw.map(s=>`<span class="sw" style="background:${s}" title="${s}"></span>`).join('')}<span>${c.fonts}</span></div>
      <div class="badges">
        <span class="b ${c.det===0?'ok':c.det<5?'warn':'bad'}">자동 점검 경고 ${c.det}건</span>
        <span class="b warn">공개 전 남은 것 ${c.blockers.length}가지</span>
        <span class="b ok">5쪽 모두 열림</span>
      </div>
    </div>
    <div class="stage" data-id="${c.id}"><iframe title="${c.name} 미리보기" loading="lazy"></iframe></div>
    <div class="foot">
      <details><summary>공개 전에 남은 것</summary><ul>${c.blockers.map(x=>`<li>${x}</li>`).join('')}</ul></details>
      <textarea placeholder="이 안에 대한 메모(마음에 드는 곳, 고칠 곳)" data-memo="${c.id}"></textarea>
      <div class="actions">
        <button class="pick" data-pick="${c.id}">이 안으로 고르기</button>
        <button data-focus="${c.id}">크게 보기</button>
        <button data-new="${c.dir}">새 탭으로 열기</button>
      </div>
    </div>
  </section>`).join('');

const rows = [['첫 화면 문장','msg'],['주 행동','act'],['기억에 남는 동작','sig'],['로고','logo'],['솔직한 위험','risk']];
document.getElementById('cmp').innerHTML =
  `<tr><th></th>${C.map(c=>`<th>${c.name}</th>`).join('')}</tr>` +
  rows.map(([label,key]) => `<tr><th>${label}</th>${C.map(c=>`<td>${c.row[key]}</td>`).join('')}</tr>`).join('');

function render() {
  document.querySelectorAll('.stage').forEach(st => {
    const c = C.find(x => x.id === st.dataset.id), f = st.querySelector('iframe');
    const colW = st.clientWidth || st.parentElement.clientWidth;
    const scale = Math.min(1, colW / W), viewH = W === 390 ? 844 : W === 768 ? 1024 : 900;
    const src = `${c.dir}/${P}.html`;
    if (!f.src.endsWith(src)) f.src = src;
    f.style.width = W + 'px'; f.style.height = viewH + 'px'; f.style.transform = `scale(${scale})`;
    st.style.height = Math.round(viewH * scale) + 'px';
    if (W < colW) { f.style.left = Math.round((colW - W) / 2) + 'px'; } else { f.style.left = '0'; }
  });
}
function press(groupId, attr, val) {
  document.querySelectorAll(`#${groupId} button`).forEach(b => b.setAttribute('aria-pressed', String(b.dataset[attr] === val)));
}
document.getElementById('vp').onclick = e => { const b = e.target.closest('button'); if (!b) return; W = +b.dataset.w; press('vp','w',b.dataset.w); render(); };
document.getElementById('pg').onclick = e => { const b = e.target.closest('button'); if (!b) return; P = b.dataset.p; press('pg','p',P); render(); };
document.getElementById('lay').onclick = e => { const b = e.target.closest('button'); if (!b) return; setLayout(b.dataset.l); };
function setLayout(l, id) {
  press('lay','l',l); grid.classList.toggle('focus', l === 'focus');
  if (l === 'focus') { focusId = id || focusId || 'b'; document.querySelectorAll('.col').forEach(c => c.classList.toggle('on', c.id === 'col-' + focusId)); }
  requestAnimationFrame(render);
}
grid.addEventListener('click', e => {
  const t = e.target.closest('button'); if (!t) return;
  if (t.dataset.focus) setLayout('focus', t.dataset.focus);
  if (t.dataset.new) window.open(`${t.dataset.new}/${P}.html`, '_blank');
  if (t.dataset.pick) {
    picked = t.dataset.pick; const c = C.find(x => x.id === picked);
    document.getElementById('dlgTitle').textContent = `${c.name}으로 고를까요?`;
    const memo = document.querySelector(`[data-memo="${picked}"]`).value.trim();
    document.getElementById('dlgMemo').textContent = memo ? `남긴 메모: ${memo}` : '메모 없이 골라요.';
    document.getElementById('dlg').showModal();
  }
});
document.getElementById('cancel').onclick = () => document.getElementById('dlg').close();
document.getElementById('ok').onclick = () => {
  document.querySelectorAll('.col').forEach(c => c.classList.toggle('picked', c.id === 'col-' + picked));
  document.getElementById('dlg').close();
};
// 스크롤 함께: 한 시안을 스크롤하면 나머지도 같은 비율로 움직인다
let syncing = false;
function hookScroll(f) {
  try {
    const w = f.contentWindow;
    w.addEventListener('scroll', () => {
      if (!document.getElementById('sync').checked || syncing) return;
      const d = w.document.documentElement, ratio = w.scrollY / Math.max(1, d.scrollHeight - w.innerHeight);
      syncing = true;
      document.querySelectorAll('.stage iframe').forEach(o => { if (o !== f) { const ow = o.contentWindow, od = ow.document.documentElement; ow.scrollTo(0, ratio * (od.scrollHeight - ow.innerHeight)); } });
      requestAnimationFrame(() => syncing = false);
    });
    w.addEventListener('pagehide', () => {});
  } catch (_) {}
}
document.querySelectorAll('.stage iframe').forEach(f => f.addEventListener('load', () => {
  hookScroll(f);
  try { const p = f.contentWindow.location.pathname.split('/').pop().replace('.html',''); if (p && p !== P) { P = p; press('pg','p',P); render(); } } catch (_) {}
}));
addEventListener('resize', render);
render();
</script>
</body>
</html>
```


## 부록 B — 시험·실런용 솔결재형 브리프

out/answers.json(intake 입력)에 넣을 값이다. 연락처는 예약 형식의 예시이고, 실제 개인 정보는 넣지 않는다.


```json
{ "topic": "장기요양기관 운영자를 위한 AI 업무 도구 가입", "archetype": "saas", "locale": "ko",
  "answers": { "name": "솔결재", "audience": "장기요양기관 운영자(시설장·사회복지사), 다기관 법인 대표와 단일 기관 시설장", "action": "무료로 시작하기", "contact": "hello@example.com", "logo": "", "mood": "대담한", "brandColors": "#0F7B5F, #FF6B35, #14213D", "brandFonts": "", "positioning": "업계 최전선 AI" } }

```

v0.2.5에서 이 브리프로 관찰된 증상이다. 회귀 확인에 쓴다.

c 라이트 primary가 주황 oklch(0.5746 0.1902 37.49)였다.

c defaultTheme이 dark(preset-dark-mode-first)였다.

b foreground가 보라 oklch(0.4758 0.2998 274.66)였다.

세 후보의 surface·header·shadow·display·texture가 모두 C1·H1·S0·D1·X0이었다.

히어로 1440에서 초록 #0F7B5F 면적이 세 후보 모두 0%였다.

홈 사이트맵은 세 후보 모두 hero, social-proof, workflow-features, integrations, final-cta였다. 이것은 유지되는 것이 정상이다.

