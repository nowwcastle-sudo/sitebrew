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
- 공개 main 병합 전 삭제·되돌림 목록: 이 INTENT.md · `.github/workflows/ci.yml`의 feat/v026-* 가지 필터 · `factory/scripts/phase-a-key.test.mjs`(T17 앞에서 이미 삭제).
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
- [ ] T0b 열쇠 고정 시험 + ci.yml 가지 필터 (Phase A 첫 레인)
- [ ] T0c 계열·거리 실행 가능성 표 (Phase A 첫 레인, Phase B 전 필수)

### Phase A — 06 열쇠 밖
- [ ] T1 방향 보드 자료 결함 2건 (build.mjs loadBoardData)
- [ ] T2 후보 중계 proxy.mjs
- [ ] T3 bridge.js + 대시보드 page.mjs
- [ ] T4 비교 서버 serve.mjs + `--serve`
- [ ] T5 예시 고정 표 sample-facts.mjs
- [ ] T6 stamp 병합·07 사유·법률 건너뛰기
- [ ] T7 `intake brief --facts`
- [ ] T8 deliver 차단
- [ ] T9 07 머리글 2배 캡처·로고 관문
- [ ] T10 07 brand-exposure 관문
- [x] T11 마감 리뷰 조사 — PR #60 병합. `docs/superpowers/specs/2026-11-04-finish-review-mapping.md`. 확정: 리뷰어 정의 `plugins/sitebrew/agents/sitebrew-finish-reviewer.md`(tools: Read), Codex 대체 `plugins/sitebrew/skills/new/references/finish-reviewer.md`, 형식 정본 `references/review-format.md` 공유, ux-gate는 `hero-768-light.png`만 추가, T12 `factory/stamp/finish-review.mjs`(순수) · T13 `factory/stamp/finish-loop.mjs`(nextStep) 인터페이스는 문서 6절
- [x] T12 마감 리뷰어와 입출력 finish-review.mjs — `factory/stamp/finish-review.mjs`(parseReview·parseVerdict·collectReviewInputs), 리뷰어 에이전트·Codex 대체 문서·`review-format.md`, ux-gate `hero-768-light.png` 추가
- [x] T13 마감 리뷰 루프와 상한 — `factory/stamp/finish-loop.mjs`(nextStep·applyRound·runFinishLoop, 최대 2회), `stamp.mjs --finish-review`(첫 줄 `REVIEW <action> <round>`, 종료 3 = 파일 대기). 병합 순서는 T6→T9→T10→T13→T16
- [ ] T14 로고 시안 생성 logo-candidates.mjs
- [ ] T15 작은 개선 S8·S9·S10
- [ ] T16 07 후보 병렬 옵션 S11
- [ ] Phase A 마감: 열쇠 = T0 기준, ci:verify ≥ 기준선
- [ ] P3 blast-radius 결과 반영

### Phase B — 06 열쇠 묶음 (한 번에)
- [ ] T17 머리글 이미지 로고
- [ ] T18 예시 띠와 법정 초안
- [ ] T19 브랜드 주색·테마·바탕 프리셋
- [ ] T20 포지셔닝
- [ ] T21 「다른 세계」·팔레트·보라·후보 머리 4칸
- [ ] T22 기준 갱신과 골든 재증명(실빌드 3건)

### Phase C·D
- [ ] T23 스킬 갱신과 v0.2.6(버전 올림)
- [ ] T24 검증 라운드(ci:verify·플러그인 시험·실런·9절 대조표)
- [ ] P4 최종 interrogate(선택)
- [ ] T25 PR (병합은 대표 승인 뒤, 코디네이터)

## 의존 / 병렬 힌트 (코디네이터용)
- P2 뒤 Phase A 병렬 가능 묶음(파일 겹침 기준): ① T1→T2→T3→T4(`factory/board/**`) ② T5→T6→T8(sample-facts·stamp.mjs·deliver) + T7(intake) ③ T9·T10(qa/ux-gate·brand-exposure) ④ T11→T12→T13(finish-review) ⑤ T14(logo-candidates) ⑥ T15·T16.
- `factory/stamp/stamp.mjs`·`qa.mjs`·`blocker-class.mjs`는 T6·T9·T10·T13·T16·T17이 같이 건드린다 — 이 파일을 건드리는 과제는 순서대로 병합한다.
- Phase B(T17~T21)는 06 열쇠 안 파일을 같이 건드리므로 한 스레드(또는 순차)로 한다. T22는 그 뒤.

## 변경 이력
- 2026-11-04 · P2 반영: 높음 5건(F1 startSite 종료 버그·F2 정리 규칙·F3 계열 규칙 소프트화·F4 버전 올림 순서·F5 레인 CI 공백). 새 과제 T0b·T0c. ci.yml 가지 필터는 공개 main 병합 전에 되돌린다(삭제 목록).
- 2026-11-04 · P1 반영: 시그니처 문서 신설. 닫은 결정 4건. 계획 상단에 우선 배너. 닫힘 파일 수는 Phase B 뒤 55→58 예상(directions.mjs가 새 모듈 3개 import).
- 2026-11-04 · ci:verify 기준선 기록(위). T11 병합(#60)으로 열린 결정 중 리뷰어 정의 위치 확정.
- 2026-11-04 · T0 착수. 계획 문서(제1부+부록→specs, 제2부→plans)를 저장소에 옮김. 환경 확인: 클라우드 기본 node 22 → `/opt/node24` 사용.

## 현재 상태 / 다음 한 작업
- 상태: T0·T11·P1·P2 완료. PR #59(드래프트).
- 다음: 코디네이터가 Phase A 레인을 분기한다. 첫 레인은 T0b·T0c(+ T4의 startSite 고침). 병합 순서 주의: stamp.mjs·qa.mjs·blocker-class.mjs는 T6·T9·T10·T13·T16·T17이 같이 건드린다.
