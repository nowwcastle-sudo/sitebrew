# INTENT — Sitebrew v0.2.6 개선 라운드

작업 정본. 설계: `docs/superpowers/specs/2026-11-04-v026-compare-dashboard-design.md`. 계획: `docs/superpowers/plans/2026-11-04-v026-compare-dashboard.md`.
이 파일은 작업 현황판이다. 공개 main 병합 전에 코디네이터가 지운다(병합 대상 아님).

## 목표
후보 3개 실사이트 비교 대시보드(G1) · 예시 정보(G2) · 머리글 로고와 로고 시안(G3) · 포지셔닝과 「다른 세계」 방향 규칙(G4) · 마감 리뷰 루프(G5) · 보드 자료 결함(G6) · 작은 개선 S7~S11(G7) · 공개 PR v0.2.6(G8).

## 작업 방식
- 기준 커밋 25f3fdf(v0.2.5). 가지 `feat/v026-compare-dashboard`. 병합은 코디네이터만 한다.
- Phase A(T1~T16)는 06 코드 열쇠 안 파일을 바꾸지 않는다. Phase B(T17~T22)가 열쇠 안 변경을 한 묶음으로 한다. 과제마다 `node factory/scripts/print-pages-key.mjs`로 열쇠를 대조한다.
- 모듈형 코드: 책임 하나인 모듈, 명시적 인터페이스, 낮은 결합. 새 npm 의존·CDN·원격 호출 0. 포트는 127.0.0.1만.
- 새 단계 입력은 조건부 키 `...(x ? { x } : {})`. 시험은 `node --test --test-force-exit --test-timeout=300000 <파일>`.
- 각 스레드: PR 올림 → CI 통과 보고 → 실패 시 자동 수정·재검사 → 자동 리뷰 검토 후 수정 라운드. 배포·게시·태그·npm은 대표.
- 공개 main 병합 전 삭제·되돌림 목록: 이 INTENT.md · `.github/workflows/ci.yml`의 feat/v026-* 가지 필터 · `factory/scripts/phase-a-key.test.mjs`(T17 앞에서 이미 삭제) · `.gitleaks.toml`·`launch-factory/.gitleaks.toml`의 phase-a-key 허용 줄(범위 검사가 이력을 훑으므로 시험을 지운 뒤에도 공개 병합 전까지 둔다).
- Node ≥ 24.13 필요. 클라우드 컨테이너는 기본 node 22라 `export PATH=/opt/node24/bin:$PATH`를 먼저 한다.

## 기준값 (T0)
| 항목 | 값 |
|---|---|
| 06 코드 열쇠 `pagesCodeKey()` | `558068537354068902e1c7ba4b710093d026847033d75ff0667099ea97b50768` |
| 닫힘 파일 수 | 55 |
| ci:verify Linux 기준선 | Node 24.22.1·Chromium 있음(`CHROME_PATH=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome`, `NODE_OPTIONS=--max-old-space-size=6000`)에서 `node ci/verify.mjs --keep-going` 11분 42초. 실패 시험 0(tests=3126 pass=3104 skipped=22). check:regen·pincheck·readme·lint·lint:ui·blocks:check·registry:check·closure·typecheck·vocab 모두 0. 종료 1은 test:light 래칫 하나뿐: 건너뜀 22 < 기준선 25(`ci/baselines/skipped-tests.txt`를 22로 줄이라는 메시지, 시험 실패 아님). security:osv는 도구 없음 SKIP. 기준선 파일은 GitHub CI 값을 본 뒤 정한다 |

## pstack 정지 지점
| 지점 | 상태 | 명령 |
|---|---|---|
| P1 — T0 직후 | 완료(수동 절차, 문서 반영) | `/pstack:architect` … (계획 7절) |
| P2 — P1 반영 직후 | 완료(수동 절차, 문서 반영) | `/pstack:interrogate` … |
| P3 — Phase A 끝, T17 직전 | 대기 | `/pstack:blast-radius` … |
| P4 — PR 직전(선택) | 대기 | `/pstack:interrogate` 전체 diff |

## 전체 작업 목록
### Phase 0
- [x] T0 가지·기준값·환경·설계/계획 문서 (PR #59)
- [x] P1 architect 결과 반영 — `docs/superpowers/specs/2026-11-04-v026-p1-interfaces.md` (T7 null=`""` · T14 서체 Pretendard base64 · T20 가중 층별 · T21 계열 8종·colorStrategy 확정)
- [x] P2 interrogate 결과 반영 — `docs/superpowers/specs/2026-11-04-v026-p2-findings.md` (높음 5·중간 3·낮음 2, 계획에 반영)
- [x] T0b 열쇠 고정 시험 + ci.yml 가지 필터 (PR `feat/v026-t0b-key-guard` → 이 가지)
- [x] T0c 계열·거리 실행 가능성 표 — `docs/qa/v026-world-spread.md` · `factory/scripts/lib/world-spread-report.mjs` (거리 ≥ 2는 전 원형 가능 14.6~33.9%, 계열 모두 다름은 dashboard 1.4%·public 0.8% → 소프트 확정)

### Phase A — 06 열쇠 밖
- [x] T1 방향 보드 자료 결함 2건 (build.mjs loadBoardData)
- [x] T2 후보 중계 proxy.mjs
- [x] T3 bridge.js + 대시보드 compare-page.mjs (CI 가름 가드가 block-board/page.mjs 와 이름을 혼동해 compare-page 로 바꿨다)
- [x] T4 비교 서버 serve.mjs + `--serve`
- [x] T5 예시 고정 표 sample-facts.mjs
- [x] T6 stamp 병합·07 사유·법률 건너뛰기
- [x] T7 `intake brief --facts`
- [x] T8 deliver 차단
- [x] T9 07 머리글 2배 캡처·로고 관문 — `factory/qa/logo-gate.mjs`(logoProbe·judgeLogo·logoGateForCandidate) + ux-gate가 `header-<폭>-light-2x.png`·`gate[키].logo` 기록. Phase A에서는 06이 글자 로고만 그리므로 로고 있는 브리프는 T17 전까지 이 관문에서 실패한다(의도)
- [x] T10 07 brand-exposure 관문 — `factory/qa/brand-exposure.mjs`(8px 칸 문서순 칠하기, 하한 Restrained 1%·Committed 15%·그 밖 1%). `cand.colorStrategy`/`cand.head.colorStrategy`는 T21이 채울 때까지 없으면 1%
- [x] T11 마감 리뷰 조사 — PR #60 병합. `docs/superpowers/specs/2026-11-04-finish-review-mapping.md`. 확정: 리뷰어 정의 `plugins/sitebrew/agents/sitebrew-finish-reviewer.md`(tools: Read), Codex 대체 `plugins/sitebrew/skills/new/references/finish-reviewer.md`, 형식 정본 `references/review-format.md` 공유, ux-gate는 `hero-768-light.png`만 추가, T12 `factory/stamp/finish-review.mjs`(순수) · T13 `factory/stamp/finish-loop.mjs`(nextStep) 인터페이스는 문서 6절
- [x] T12 마감 리뷰어와 입출력 finish-review.mjs — `factory/stamp/finish-review.mjs`(parseReview·parseVerdict·collectReviewInputs), 리뷰어 에이전트·Codex 대체 문서·`review-format.md`, ux-gate `hero-768-light.png` 추가
- [x] T13 마감 리뷰 루프와 상한 — `factory/stamp/finish-loop.mjs`(nextStep·applyRound·runFinishLoop, 최대 2회), `stamp.mjs --finish-review`(첫 줄 `REVIEW <action> <round>`, 종료 3 = 파일 대기). 병합 순서는 T6→T9→T10→T13→T16
- [x] T14 로고 시안 생성 logo-candidates.mjs (PR #62)
- [x] T15 작은 개선 S8·S9·S10 (PR #62 — HIGGSFIELD_DIR 해석 한 곳 factory/lib/higgsfield-dir.mjs, 기본 폴더 ~/dev/Sitebrew, 문구 병렬 안내)
- [x] T16 07 후보 병렬 옵션 S11 (WF_QA_PARALLEL=1, 기본 끔)
- [ ] Phase A 마감: 열쇠 = T0 기준, ci:verify ≥ 기준선
- [ ] P3 blast-radius 결과 반영

### Phase B — 06 열쇠 묶음 (한 번에)
- [x] T17 머리글 이미지 로고 — `headerLogoOf`(site-files.mjs)·`shell.logo`(site.json)·site.tsx LogoMark(img·mask·다크 짝)·stamp.mjs 06 입력 조건부 키 `logo`(경로+sha256)·로고 관문이 a·b 도 잰다(`briefLogo`)·`BLOCKER.logo`(입력 갈래)
- [x] T18 예시 띠와 법정 초안 — `sample-band.mjs`(예시 값 찾기)·site.json `sample`{label,count,scrub}·SiteShell banner(SampleBand)·`lib/sample-scrub.ts`(JSON-LD·메타에서 예시 칸 뺌)·법정 초안 `blankSamples`
- [x] T19 브랜드 주색·테마·바탕 프리셋 — 첫 유채색=주색·`brandThemeOf`·`presetToRecipeHead` opts.defaultTheme·c 바탕=같은 테마 최고 novelty·질문 문구. 한계: 바탕 역할이 밝은 무채(L≥0.9)만이라 dark 는 아직 나오지 않는다(규칙은 구현됨)
- [x] T20 포지셔닝 — 9번째 선택 질문 `positioning`(missingFacts 에서 제외)·`positioning.mjs`(표 5종 frontier·trusted-local·simplest·premium·playful; 축 선호는 최대 2개까지만 가산)·가중 라이브러리 0.04·프리셋 0.06·팔레트 0.10. 모르는 말이면 효과 없음. 사이트 문구로 쓰지 않는다(COPY.md). 한계: 팔레트 테마 가산은 밝기 ±1 기준이 압도해 사실상 순서를 못 바꾼다(문서화만)
- [x] T21 「다른 세계」·팔레트·보라·후보 머리 — `material-family.mjs`(계열 8종·색 전략)·`visual-distance.mjs`(7칸 거리, 하드 규칙 ≥2 `visual-distance:safe|bold`, 계열은 소프트 FAMILY_BONUS 0.05 + `family-clash` 경고)·후보에 thesis·sig·world·risk·ownWorld·materialFamily·colorStrategy·b 팔레트 브랜드 색조 가산(±30°/보색)·보라 금지를 글자·강조·링으로 확장(레퍼런스 팔레트는 고르는 때 거름; palettes.json 원천은 저장소 밖이라 재생성 불가)
- [x] T22(부분) 기준 갱신 — mood 기준 해시·골든 씨앗 6개(detail-2 3·local-2 2·portfolio-2 1·public-2 9·pwa-1 2·landing-1 1)·앱 셸 sha 파일·bold 고정 사본 비교 범위. 06 열쇠 fcb8283051434fd50016aac50561b567195fd6b0e0d0cb25d94773930c994196 (닫힘 59파일; lib/site.tsx 가 pageTitle 등 5개 내보내기를 잃었던 것을 실빌드(T24)에서 발견해 복구, 시험 stamp-site-exports 추가). 06 정적 스윕(골든 20×3 = 60 사이트, stamp-final-wf6-links) 통과. [ ] 실빌드 3건은 T24 에서

### Phase C·D
- [x] T23 스킬 갱신(new·deliver·revise)과 v0.2.6 버전 올림(bump-version·gen:all·pincheck·README 5개 언어 ×2 행·설치 주소 고정). 릴리스 행 문구·날짜(2026-11-05)는 임시 — 릴리스 때 다듬는다. LF README 의 web-factory 고정·블록·contract 해시는 릴리스 때 잠금 동기화로 맞춘다
- [x] T24 검증 라운드 — GitHub CI(ci:verify 전체) 녹색. 부록 B 실런(--sample-facts) 01~08 완료: c 주색 초록·라이트 테마, b 전경 보라 없음, 세 후보 거리 ≥2, --serve(COMPARE/PICK, 남은 node 0)·--pick b 종료 1·deliver 종료 1, 마감 리뷰 1회(review-1.md parseReview 통과, 다음 걸음 `REVIEW apply 1`, 처방 둘 revise 읽기 확인). 실런에서 lib/site.tsx 내보내기 누락 결함을 찾아 고침. 남음: 골든 실빌드 3건(brand-1 로고·landing-2 영어·dashboard-1)은 문구 작성(9후보)이 필요해 이 세션에서 못 돌렸다 → 로컬 PC 재증명 필요. c 첫 화면 주색 면적 0%는 07 brand-exposure 가 공개 불가로 잡았다(관문 정상 동작; 고침은 마감 리뷰·수정 몫). 클라우드 한정: node_modules/.bin/next 심볼릭 링크 경로로 next build 하면 prerender 가 useContext null 로 실패해, 후보 사이트의 .bin/next 를 셸 래퍼로 바꿔 우회했다(코드 변경 아님).
- [ ] P4 최종 interrogate(선택)
- [ ] T25 PR (병합은 대표 승인 뒤, 코디네이터)

## 의존 / 병렬 힌트 (코디네이터용)
- P2 뒤 Phase A 병렬 가능 묶음(파일 겹침 기준): ① T1→T2→T3→T4(`factory/board/**`) ② T5→T6→T8(sample-facts·stamp.mjs·deliver) + T7(intake) ③ T9·T10(qa/ux-gate·brand-exposure) ④ T11→T12→T13(finish-review) ⑤ T14(logo-candidates) ⑥ T15·T16.
- `factory/stamp/stamp.mjs`·`qa.mjs`·`blocker-class.mjs`는 T6·T9·T10·T13·T16·T17이 같이 건드린다 — 이 파일을 건드리는 과제는 순서대로 병합한다.
- Phase B(T17~T21)는 06 열쇠 안 파일을 같이 건드리므로 한 스레드(또는 순차)로 한다. T22는 그 뒤.

## 레인 배정 (2026-11-04, 코디네이터)
| 레인 | 과제 | 비고 |
|---|---|---|
| guard (이 스레드) | T0b → T0c | T0b 병합 뒤 나머지 레인이 rebase한다 |
| board | T1–T4 | `factory/board/**`, T4에서 qa.mjs `startSite` 종료 버그 고침(P2 F1) |
| sample | T5–T8 | sample-facts·stamp 병합·intake·deliver. en 예시 전화는 +82 꼴(P2 F6) |
| gates | T9–T10 | ux-gate 머리글·brand-exposure |
| review | T12–T13 | finish-review·finish-loop |
| small | T14–T16 | logo-candidates·S8~S10·07 병렬 |
- 모든 레인 PR 본문에 「열쇠 일치: `558068…0768`」 한 줄. `stamp.mjs`·`qa.mjs`·`blocker-class.mjs`를 건드리는 레인(sample·gates·review·small)은 서로 순서대로 병합한다.

## 변경 이력
- 2026-11-04 · P2 반영: 높음 5건(F1 startSite 종료 버그·F2 정리 규칙·F3 계열 규칙 소프트화·F4 버전 올림 순서·F5 레인 CI 공백). 새 과제 T0b·T0c. ci.yml 가지 필터는 공개 main 병합 전에 되돌린다(삭제 목록).
- 2026-11-04 · P1 반영: 시그니처 문서 신설. 닫은 결정 4건. 계획 상단에 우선 배너. 닫힘 파일 수는 Phase B 뒤 55→58 예상(directions.mjs가 새 모듈 3개 import).
- 2026-11-04 · ci:verify 기준선 기록(위). T11 병합(#60)으로 열린 결정 중 리뷰어 정의 위치 확정.
- 2026-11-04 · T0 착수. 계획 문서(제1부+부록→specs, 제2부→plans)를 저장소에 옮김. 환경 확인: 클라우드 기본 node 22 → `/opt/node24` 사용.

## 현재 상태 / 다음 한 작업
- 상태: T0·T11·P1·P2 완료. PR #59(드래프트).
- 다음: T0b 병합 → 다른 레인 rebase. guard 레인이 T0c(계열·거리 표) 진행. 병합 순서 주의: stamp.mjs·qa.mjs·blocker-class.mjs는 T6·T9·T10·T13·T16·T17이 같이 건드린다.
