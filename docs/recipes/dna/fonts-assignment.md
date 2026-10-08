# 레시피 20안 서체 배정 (컨트롤러 확정 · 2026-09-27)

A안 = DNA 카드의 사이트 1, B안 = 사이트 2. 제목 스택은 `라틴 디스플레이 → 한글 제목체(displayKo) → 본문 → 시스템 한글` 순이라, 한 제목 안에서 영문·숫자는 라틴 서체로, 한글은 한글 제목체로 그려진다. 본문은 지금 머리 값을 그대로 둔다(한글 본문 가독성 — 대표 원칙 「본문은 한글」).

모든 서체는 `references/fonts/fonts.json`(Task 10a)에 있고, 1차 라이선스 URL·웹 전달 HTTP 200·렌더 확인을 거쳤다. 라틴 20종은 서로 모두 다르다. 한글 제목체 18종도 서로 모두 다르다(r6은 공공 규칙 §21-8로 Pretendard GOV 고정이라 `displayKo`를 두지 않는다).

| 레시피 | A 라틴 | A 한글 제목 | B 라틴 | B 한글 제목 | 본문(유지) |
|---|---|---|---|---|---|
| r1-measure | Martian Mono | Nanum Gothic Coding | Tektur | PyeojinGothic (펴진고딕) | IBM Plex Sans KR |
| r2-signal | Bricolage Grotesque | Do Hyeon | Dela Gothic One | Moirai One | Gothic A1 |
| r3-woodblock | Young Serif | Song Myung | Shrikhand | BM Euljiro (배민 을지로체) | Noto Sans KR |
| r4-evidence | Newsreader | MaruBuri | Spectral | SeochoBatang (서초바탕) | Noto Sans KR |
| r5-celadon | Bodoni Moda | Diphylleia | Tenor Sans | Grandiflora One | Pretendard |
| r6-civic | Unbounded | — (Pretendard GOV) | Fragment Mono | — (Pretendard GOV) | Pretendard GOV |
| r7-docs | Besley | NanumSquareRound | Libre Caslon Display | NaturalSans (자연산스) | Pretendard |
| r8-dusk | Big Shoulders | Gowun Batang | Alegreya | Nanum Brush Script | Nanum Gothic |
| r9-clay | Grandstander | Bagel Fat One | Titan One | Dongle | Gothic A1 |
| r10-console | Antonio | Orbit | Azeret Mono | Galmuri11 | Pretendard |

## 이유 (카드와 다르게 고른 곳만)

- **r1 B · 펴진고딕**: 사이트 2(기술 스타트업)의 넓은 제목을 옆으로 펼친 한글로 옮겼다. 카드 2순위 Orbit은 r10 A와 겹친다.
- **r2 B · Dela Gothic One**: 카드 2순위 Schibsted Grotesk는 10a에서 평범한 그로테스크로 탈락했다. 가운데 정렬 선언문형 3줄 제목에는 가로로 누른 초굵은 글자가 맞다.
- **r4 B · 서초바탕**: 증거·문서 성격인데, 판결문 서면에서 온 바탕체다. 카드 2순위 고운바탕은 r8 A와 겹친다.
- **r7 B · 자연산스**: 카드 2순위 고운바탕은 r8 A와 겹친다. 두꺼운 4칸 제목 옆에 곡선 산세리프를 둔다.
- **r8 B · 나눔손글씨 붓**: 사이트 2의 세로쓰기 한옥 스테이 제목을 붓글씨 세로쓰기로 바꿨다. 카드 2순위 마루부리는 r4 A와 겹친다.
- **r3 B · 배민 을지로체**: 운영자 지시로 약관을 직접 확인해 추가한 서체(OFL 1.1, woowahan.com/fonts/license)다. 을지로 간판 장인의 페인트 붓 글씨가 사이트 2(레트로 인쇄물)와 Shrikhand 짝에 카드 2순위 Gugi보다 맞다.
- **r9 B · 동글**: 카드 2순위 그대로다.
- **r10 B · Azeret Mono + 갈무리11**: 사이트 2의 「타자 제목·재단 표시」를 고정폭과 도트 한글로 옮겼다. 카드 2순위 Anton은 흔한 썸네일 서체다.

## 키트 추가 시 주의 (Task 10c)

- 키트에 없는 서체는 항목을 새로 만든다. 지금 키트에 있는 것은 Nanum Gothic Coding(외부 목록에만 있음 — 항목 없음), Gowun Batang(없음 — Gowun Dodum만), 본문 7종뿐이다.
- 비Google 서체 7종은 1차 CDN의 css `@import` 항목으로 싣는다. 해당 서체는 MaruBuri, NanumSquareRound, SeochoBatang, Galmuri11, 그리고 미러 전달인 펴진고딕·자연산스·배민 을지로체다. 미러(눈누의 jsDelivr 저장소)는 커밋 sha로 고정한 URL만 쓴다 — OFL이라 재배포가 허용되고, 자체 호스팅은 P3-3 내보내기 단계로 넘긴다. 깃허브 브랜치 URL은 커밋으로 고정한다(10a 판정 3).
- 한글 제목체 대부분이 굵기 하나(400)다. `displayKo`가 단일 굵기면 `.font-heading`에 `font-synthesis-weight: none`을 건다. 그래야 700 제목에서 한글 획이 가짜 굵기로 뭉개지지 않는다.
- 2,350자만 담은 서체(Do Hyeon·Song Myung·Diphylleia·Orbit·Moirai One·Gugi·Grandiflora One·Bagel Fat One)은 없는 글자가 다음 스택(본문)으로 떨어진다. 제목 예시 문구에서 그런 글자가 섞이는지 렌더 검사에서 본다.
