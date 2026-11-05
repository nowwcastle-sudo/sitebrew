# v0.2.6 T0c — 계열·거리 실행 가능성 표

기준: 25f3fdf(v0.2.5) 프리셋 풀. 읽기 전용 점검(`factory/scripts/lib/world-spread-report.mjs`)이 만든 스냅샷이다. 풀이 바뀌면 `node factory/scripts/lib/world-spread-report.mjs --write` 로 다시 만든다.
거리 칸: surface·header·shadow·display·texture + 기본 테마(히어로는 프리셋에 없어 뺌 → 아래쪽 어림). 최소 거리 2. 계열표는 P1 문서 4.6절의 임시 사본이다.

## 원형별 풀

| 원형 | 라이브러리 | 생성 | 계열(전체) |
|---|---|---|---|
| brand | 14 | 52 | plain 42 · print 8 · kinetic 6 · paper 4 · editorial 3 · collage 3 |
| commerce | 14 | 52 | plain 42 · print 8 · kinetic 6 · paper 4 · collage 3 · editorial 3 |
| dashboard | 10 | 39 | plain 44 · print 3 · paper 2 |
| detail | 14 | 52 | plain 42 · print 8 · kinetic 6 · paper 4 · editorial 3 · collage 3 |
| local | 14 | 52 | plain 42 · print 8 · kinetic 6 · paper 4 · editorial 3 · collage 3 |
| portfolio | 14 | 52 | plain 42 · print 8 · kinetic 6 · paper 4 · editorial 3 · collage 3 |
| public | 8 | 35 | plain 39 · editorial 2 · paper 2 |
| pwa | 14 | 52 | plain 42 · print 8 · kinetic 6 · paper 4 · editorial 3 · collage 3 |
| saas | 14 | 52 | plain 42 · print 8 · kinetic 6 · paper 4 · editorial 3 · collage 3 |
| landing | 14 | 52 | plain 42 · print 8 · kinetic 6 · paper 4 · editorial 3 · collage 3 |

## 세 후보가 모든 쌍에서 거리 ≥ 2 인 조합

조합 = 라이브러리 a 하나 × 생성 b·c 둘. 「계열 모두 다름」은 그 가운데 세 계열이 서로 다른 것(소프트 선호 — 하드 규칙 아님).

| 원형 | 조합 수 | 거리 ≥ 2 | 비율 | 계열 모두 다름 | 비율 | 생성끼리 쌍(거리 ≥ 2) | a 로 쓸 수 있는 라이브러리 |
|---|---|---|---|---|---|---|---|
| brand | 18564 | 6287 | 33.9% | 2324 | 12.5% | 839/1326 (63.3%) | 14/14 |
| commerce | 18564 | 6287 | 33.9% | 2324 | 12.5% | 839/1326 (63.3%) | 14/14 |
| dashboard | 7410 | 1837 | 24.8% | 105 | 1.4% | 462/741 (62.3%) | 10/10 |
| detail | 18564 | 6287 | 33.9% | 2324 | 12.5% | 839/1326 (63.3%) | 14/14 |
| local | 18564 | 6287 | 33.9% | 2324 | 12.5% | 839/1326 (63.3%) | 14/14 |
| portfolio | 18564 | 6287 | 33.9% | 2324 | 12.5% | 839/1326 (63.3%) | 14/14 |
| public | 4760 | 694 | 14.6% | 38 | 0.8% | 326/595 (54.8%) | 8/8 |
| pwa | 18564 | 6287 | 33.9% | 2324 | 12.5% | 839/1326 (63.3%) | 14/14 |
| saas | 18564 | 6287 | 33.9% | 2324 | 12.5% | 839/1326 (63.3%) | 14/14 |
| landing | 18564 | 6287 | 33.9% | 2324 | 12.5% | 839/1326 (63.3%) | 14/14 |
- 하드 규칙(거리 ≥ 2)이 풀 수준에서 불가능한 원형: 없음. 조합 비율은 brand 33.9% · commerce 33.9% · dashboard 24.8% · detail 33.9% · local 33.9% · portfolio 33.9% · public 14.6% · pwa 33.9% · saas 33.9% · landing 33.9%.
- 「계열 모두 다름」이 조합의 5% 미만인 원형: dashboard 1.4%, public 0.8%. 불가능은 아니지만 하드 규칙으로 두면 후보 선택이 이 소수 조합에 몰린다 → 계열은 소프트로 둔다(P2 F3).
- 풀 수준 가능은 실제 01 이 성공한다는 뜻이 아니다. 팔레트·린트·다양성 검사와 씨앗이 더 거른다. 골든 20개의 01 전수 비교는 T22 ①이 한다.
