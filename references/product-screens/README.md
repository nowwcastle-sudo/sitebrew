# references/product-screens/

제품 화면(가입·로그인·계정·결제·메일·오류·접근성·모바일·문의·AX)을 만들거나 감사할 때 보는 **1차 출처 포인터** 모음이다. 공식 디자인 시스템·지침·법령·표준 쪽을 가리킨다. 본문은 싣지 않는다.

## 빨리 찾기

- 영역으로 찾는다 → `sources.md` 위쪽의 영역 바로가기. 영역은 10개다.
- 감사 항목 ID(A01~N12)로 찾는다 → `sources.md` 맨 아래 「감사 항목 → 행」 표. 항목 ID 하나가 어느 행에 걸렸는지 한 줄로 나온다.
- 기계가 읽는다 → `sources.json`(`rows[]`: `id`·`area`·`source`·`pattern`·`url`·`items`·`summary`·`status`·`checked`·`note?`).

| 영역(`area`) | 행 | 무엇을 보나 |
|---|---|---|
| `signup` 가입 | 6 | 동의 받는 법·이메일 확인·중복 입력 금지 |
| `login` 로그인·인증·세션 | 14 | 로그인 안내·방식 선택·비밀번호·2단계·세션 만료·접근 가능한 인증 |
| `account` 계정·내 정보 | 3 | 정정·삭제·파기·이름 칸 |
| `payment` 결제·확인·완료 | 8 | 제출 전 확인·되돌리기 어려운 행동·이중 제출·청약철회·완료 쪽 |
| `mail` 메일·알림·공지 | 6 | 광고성 정보 동의·원클릭 수신 거부·발송 인증·알림 띠 |
| `error` 오류·검증 | 10 | 검증 시점·오류 문구·오류 요약·404·서비스 중단 쪽 |
| `a11y` 접근성·포용 | 18 | KWCAG 2.2·WCAG 2.2·건너뛰기·초점·대비·모달·언어 바꾸기·공통 지침 입구 |
| `mobile` 모바일·반응형 | 3 | 리플로·눌림 크기·화면 구획 |
| `contact` 문의·고지 | 5 | 문의 수단·도움·쿠키·처리방침 |
| `ax` AX | 3 | llms.txt·WebMCP·쪽 제목 |

행은 76개, 고유 주소는 69개다. 출처별로 KRDS 19 · GOV.UK 22 · KWCAG 2.2 11 · W3C 7 · 법제처 7 · 디지털정부 UI·UX 가이드라인 3, 나머지(NIST·RFC 8058·Google 발송자 지침·OWASP·llmstxt.org·Google Search Central·W3C WebMCP)는 1개씩이다.

## 쓰는 법

1. 블록·원형을 만들 때, 해당 영역 표에서 행을 고르고 **주소를 직접 열어 읽는다**. 한 줄 요지는 길잡이일 뿐이다.
2. 규칙·결정 문서에 근거를 달 때는 `sources.json`의 행 id(`krds-05`)와 주소, 읽은 날짜를 함께 적는다.
3. 원문 문장·그림을 저장소에 옮기지 않는다. 요지는 우리 말로 다시 쓴다(`references/README.md`의 「포인터만」 원칙).
4. 항목에 행이 없으면 「출처 없음」으로 둔다. 비슷한 행을 억지로 붙이지 않는다.

## 읽을 때 주의

- **KRDS**: 서비스 패턴은 방문·검색·로그인·신청·정책 정보 확인 5종이다. 회원가입·본인 확인·문의 전용 패턴은 없다. 이 영역은 로그인(방식 선택)·동의·도움·입력폼·오류 기본 패턴이 맡는다.
- **KWCAG 2.2**: 4원칙·14지침·33검사항목이다. `a11ykr.github.io` 행(kwcag-03~10)은 민간 게시본이다. 고시 원문은 `kwcag-01`(국립전파연구원)이다. `kwcag-11`(웹 접근성 품질마크)은 민간 인증기관 안내다.
- **A02(이미 있는 이메일에 로그인 링크)와 OWASP 계정 열거 방지는 서로 당긴다.** 항목을 판정할 때 둘의 절충을 함께 적는다(`owasp-01`·`govuk-02`·`govuk-22`).
- **법령 행**: 법제처 쪽은 조문 번호까지 확인했다(제22·30·36·21조, 정보통신망법 제50조, 전자상거래법 제17·13조). 법 개정 뒤 조문 번호가 바뀔 수 있으니 인용 전에 현행 조문을 다시 연다.
- **GOV.UK `govuk-15`(Language navigation)**: 시험 단계 표시가 있다.
- **효과가 정해지지 않은 것**: `llmstxt-01`(llms.txt)은 제안서이고 효과는 논쟁 중이다. `webmcp-01`은 커뮤니티 그룹 초안이다.

## 아직 없는 것

아래는 1차 출처를 찾지 못했거나 주소를 확인하지 못해 표에 넣지 않았다. 다음 병합 때 후보가 된다.

- 회원가입·본인 확인·문의 전용 KRDS 패턴(없음). 대신 「개인 식별 정보 입력」(`https://www.krds.go.kr/html/site/global/global_01.html`)과 도움 패널(`https://www.krds.go.kr/html/site/component/component_08_01.html`)이 있다 — 열림은 확인했고 표에는 안 넣었다.
- KRDS 서비스 패턴 > 신청 > 완료(`service_04_07.html`)·텍스트 입력 필드·단계 표시기·화면 크기 조정·선명한 화면 모드·체크박스·토스트 컴포넌트 — 열림은 확인했고 표에는 안 넣었다.
- 「디지털 정부서비스 UI/UX 가이드라인」 본문 PDF(2025-08 수정본)와 KWCAG 2.2 공식 해설서 — 첨부 파일이라 열지 않았다. 장별 쪽번호 대응은 없다.
- 장애인차별금지법 제21조·지능정보화 기본법 제47조·개인정보 보호법 제35조(열람)·제35조의2(전송 요구)·제37조(처리 정지·동의 철회)·전자상거래법 제21조·제8조 — 개별 조문 주소를 확인하지 못했다.
- 한국웹접근성인증평가원 등 인증기관 공식 쪽 — 연결이 끊기거나 인증서가 맞지 않았다.
- 거래 메일 규칙(G02)·빈 상태·첫 사용(H08)·AX 에이전트 승인 경계(M01~M06)의 직접 대응 출처 — 못 찾았다. M 영역은 `webmcp-01` 한 건이다.
- GOV.UK 중 열림만 확인한 쪽: Start using a service·Interruption pages·Navigate a service·Dates·Payment card details·Question pages·Complete multiple tasks. 같은 사이트의 `patterns/`·`components/` 경로 규칙으로 열린다.

## 주소 확인 기록

2026-10-03, 병합할 때 고유 주소 69개를 모두 다시 열었다(`curl -s -L -A "Mozilla/5.0"` GET). **전부 200, 죽은 주소 0건**이다. 알아 둘 점:

- `law.go.kr` 법령 쪽 주소 7개는 HEAD 요청에 404를 돌려주고 GET에는 200을 준다. 조문 번호는 응답 본문에서 확인했다. 확인할 때 HEAD만 쓰지 않는다.
- `w3.org` 쪽 7개는 Node `fetch` 기본 헤더에는 403을 주고 브라우저형 `User-Agent`의 curl에는 200을 준다.
- `support.google.com/a/answer/81126`은 `support.google.com/mail/answer/81126`으로 넘어간다(200).
- 다시 확인하려면 `sources.json`의 `url`을 위 방식으로 GET해 `status`·`checked`를 갱신한다. 죽은 주소는 행에서 지우거나 `note`에 적고 `status`를 실제 값으로 바꾼다 — 단 `product-screens.test.mjs`는 `status`가 200이 아닌 행을 막으므로, 죽은 주소를 남기려면 행을 지우는 것이 기본이다.

## 만드는 법·검사

```
node factory/scripts/build-product-screens.mjs          # sources.json → sources.md
node factory/scripts/build-product-screens.mjs --check  # 일치 검사(종료 코드)
node --test factory/scripts/product-screens.test.mjs    # 76행·출처별 수·영역·포인터만·표 일치
```

원천 `design-rules\ux-audit\references-inbox.md`는 2026-10-03에 한 번 병합했다. 병합 뒤 정본은 `sources.json`이다. 이 폴더는 `gen:all` 밖이다.
