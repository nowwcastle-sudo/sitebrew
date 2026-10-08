# 제품 화면 레퍼런스 — 표

> `sources.json`에서 `node factory/scripts/build-product-screens.mjs`가 만든다. 손으로 고치지 않는다 — json 을 고치고 다시 만든다.
> 행 76개 · 주소 69개 · 마지막 확인 2026-10-03(전부 GET 200). 읽는 법·한계는 `README.md`.

영역 바로가기: [가입](#signup) · [로그인·인증·세션](#login) · [계정·내 정보](#account) · [결제·확인·완료](#payment) · [메일·알림·공지](#mail) · [오류·검증](#error) · [접근성·포용](#a11y) · [모바일·반응형](#mobile) · [문의·고지](#contact) · [AX(에이전트·검색)](#ax)

<a id="signup"></a>
## 가입 (6)

범위: 가입 폼·동의·이메일 확인·중복 입력.

| id | 출처 | 패턴 | 우리 항목 | 한 줄 요지 | 주소 |
|---|---|---|---|---|---|
| krds-08 | KRDS | 기본 패턴 > 동의 | A04 A05 D06 K04 | 일괄 동의와 항목별 동의를 묶어 보이고, 필수 동의와 선택 동의를 눈에 띄게 구분한다. | https://www.krds.go.kr/html/site/global/global_03.html |
| govuk-01 | GOV.UK | 패턴 > Confirm an email address | A01 A10 A14 | 이메일 확인은 사용자를 덜 막는 방식으로 설계하되 확인된 주소로 계정에 들어올 수 있게 한다. | https://design-system.service.gov.uk/patterns/confirm-an-email-address/ |
| govuk-02 | GOV.UK | 패턴 > Create accounts | A02 A07 B02 | 계정은 꼭 필요할 때만 만들게 하고, 가입 시점을 늦추며, 가입과 로그인을 시각으로 떼어 놓고 CAPTCHA 같은 장벽을 피한다. | https://design-system.service.gov.uk/patterns/create-accounts/ |
| w3c-02 | W3C | WCAG 2.2 Understanding 3.3.7 Redundant Entry | A04 N11 | 여러 단계 과정에서 이미 낸 정보는 다시 묻지 말고 자동 채움이나 선택으로 보여 준다. | https://www.w3.org/WAI/WCAG22/Understanding/redundant-entry.html |
| law-01 | 법제처 | 개인정보 보호법 제22조 동의를 받는 방법 | A04 A05 D06 K04 | 목적이 다른 동의는 따로 구분해 받고, 수집 목적·항목 같은 중요한 내용은 알아보기 쉽게 표시한다. | https://www.law.go.kr/LSW//lsLawLinkInfo.do?lsJoLnkSeq=900077468&lsId=011357&chrClsCd=010202&print=print |
| govuk-22 | GOV.UK | 패턴 > Email addresses | A02 A14 | 이메일 칸은 email 입력 형식과 자동완성 속성을 쓰고, 붙여넣기를 허용하며, 제출 전에 입력한 주소를 사용자에게 되비춰 확인시킨다. | https://design-system.service.gov.uk/patterns/email-addresses/ |

<a id="login"></a>
## 로그인·인증·세션 (14)

범위: 로그인 안내·방식 선택·비밀번호·2단계·재설정·세션 만료.

| id | 출처 | 패턴 | 우리 항목 | 한 줄 요지 | 주소 |
|---|---|---|---|---|---|
| krds-01 | KRDS | 서비스 패턴 > 로그인 > 로그인 안내 | B04 B02 | 로그인이 필요한 행동을 만나면 하던 일을 끊지 않는 안내창을 띄우고, 로그인 없이 계속할 선택지와 로그인했을 때의 이점을 같이 보여 준다. | https://www.krds.go.kr/html/site/service/service_03_03.html |
| krds-02 | KRDS | 서비스 패턴 > 로그인 > 로그인 방식 확인/선택 | B05 B06 B10 | 로그인 방식이 둘 이상이면 목록이나 탭으로 견주어 고르게 하고, 인증 방식의 복잡도와 이용 빈도에 맞춰 배치한다. | https://www.krds.go.kr/html/site/service/service_03_04.html |
| krds-03 | KRDS | 서비스 패턴 > 로그인 > 로그인 정보 입력 | A03 B01 B05 | 비밀번호는 기본으로 가리되 보기 토글을 두고, 실패 오류는 원인과 해결 방법을 구체로 알리며 제출 실패 뒤 포커스를 문제 칸으로 돌린다. | https://www.krds.go.kr/html/site/service/service_03_05.html |
| krds-04 | KRDS | 서비스 패턴 > 로그인 > 로그인 완료 | B01 H05 N10 | 로그인 성공 뒤 사용자 식별 표시·로그아웃 수단·세션 정보를 보이고, 사용자가 원래 가려던 화면으로 돌려보낸다. | https://www.krds.go.kr/html/site/service/service_03_06.html |
| krds-05 | KRDS | 서비스 패턴 > 로그인 > 서비스 이용(세션 연장) | B07 N12 | 세션 만료 20초 이상 전에 알리고, 연장 버튼과 로그아웃 버튼을 함께 준다. | https://www.krds.go.kr/html/site/service/service_03_07.html |
| krds-06 | KRDS | 서비스 패턴 > 로그인 > 로그아웃 | B03 B04 B07 | 직접 로그아웃과 세션 만료 자동 로그아웃을 구분해 피드백을 주고, 상황에 맞는 화면으로 보내며 홈 이동·다시 로그인 버튼을 둔다. | https://www.krds.go.kr/html/site/service/service_03_08.html |
| kwcag-07 | KWCAG 2.2 | 6.2.1 응답시간 조절 | B07 H09 | 시간 제한이 있는 콘텐츠는 사용자가 제한을 끄거나 늘릴 수 있어야 한다. (민간 게시본이다. 고시 원문은 kwcag-01(국립전파연구원)이 맡는다.) | https://a11ykr.github.io/kwcag22/ |
| kwcag-08 | KWCAG 2.2 | 7.3.3 접근 가능한 인증 | B10 C03 A07 | 로그인·인증 때 퍼즐 풀이나 기억·옮겨 적기만으로 통과하게 만들지 말고 대체 수단을 둔다. (민간 게시본이다. 고시 원문은 kwcag-01(국립전파연구원)이 맡는다.) | https://a11ykr.github.io/kwcag22/ |
| govuk-06 | GOV.UK | 패턴 > Passwords | A03 C01 | 최소 8자를 두고 최대 길이는 두지 않으며, 붙여넣기를 허용하고 흔한 비밀번호는 막는다. | https://design-system.service.gov.uk/patterns/passwords/ |
| govuk-07 | GOV.UK | 컴포넌트 > Password input | A03 B01 C01 | 보기 토글을 제공하고 가입 때는 새 비밀번호, 로그인 때는 현재 비밀번호 자동완성 값을 쓰며 길이 제한·붙여넣기 차단을 피한다. | https://design-system.service.gov.uk/components/password-input/ |
| govuk-11 | GOV.UK | 패턴 > Confirm a phone number | C03 C04 | 문자 보안 코드로 번호를 확인하고 2단계 인증을 구현하는 절차와 문구를 안내한다. | https://design-system.service.gov.uk/patterns/confirm-a-phone-number/ |
| w3c-01 | W3C | WCAG 2.2 Understanding 3.3.8 Accessible Authentication (Minimum) | B10 C03 A07 | 인증 단계에서 퍼즐 풀기·기억·코드 옮겨 적기에만 의존하지 말고 붙여넣기나 대체 수단을 허용한다. | https://www.w3.org/WAI/WCAG22/Understanding/accessible-authentication-minimum.html |
| nist-01 | NIST | SP 800-63B-4 인증 및 수명주기 관리 | A03 C01 C04 B08 | 비밀번호 길이를 우선하고 문자 조합 규칙과 주기적 변경 강요를 하지 않으며, 비밀번호 관리자·붙여넣기를 허용하고 추측 공격에는 횟수 제한을 건다. | https://pages.nist.gov/800-63-4/sp800-63b.html |
| owasp-01 | OWASP | Forgot Password Cheat Sheet | A02 C07 C08 B08 | 비밀번호 재설정은 계정 유무와 상관없이 같은 응답을 주고, 토큰에 만료를 두며, 변경 뒤 기존 세션을 끊는다. | https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html |

<a id="account"></a>
## 계정·내 정보 (3)

범위: 정정·삭제·파기·이름 칸.

| id | 출처 | 패턴 | 우리 항목 | 한 줄 요지 | 주소 |
|---|---|---|---|---|---|
| govuk-16 | GOV.UK | 패턴 > Names | D02 | 이름은 전체 이름 한 칸을 기본으로 하고 자동완성 속성을 달며, 나중에 고칠 수 있게 하고 호칭은 묻지 않는다. | https://design-system.service.gov.uk/patterns/names/ |
| law-03 | 법제처 | 개인정보 보호법 제36조 개인정보의 정정·삭제 | D03 D04 | 정보주체가 자신의 개인정보 정정·삭제를 요구할 수 있고 처리자는 절차와 예외를 갖춰 대응해야 한다. | https://www.law.go.kr/LSW//lsLawLinkInfo.do?lsJoLnkSeq=900078747&chrClsCd=010202 |
| law-04 | 법제처 | 개인정보 보호법 제21조 개인정보의 파기 | D04 D09 | 불필요해진 개인정보는 지체 없이 복구 불가능하게 파기하고, 법령상 보존 대상은 분리해 보관한다. | https://www.law.go.kr/LSW//lsLinkCommonInfo.do?lsJoLnkSeq=1020398651&chrClsCd=010202 |

<a id="payment"></a>
## 결제·확인·완료 (8)

범위: 제출 전 확인·되돌리기 어려운 행동·이중 제출·철회·완료 쪽·거래 조건 고지.

| id | 출처 | 패턴 | 우리 항목 | 한 줄 요지 | 주소 |
|---|---|---|---|---|---|
| krds-11 | KRDS | 기본 패턴 > 확인 | D04 M03 M05 F05 | 되돌리기 어렵거나 결과가 큰 행동 앞에 명시적 승인 단계를 둬 사용자가 다시 확인하고 실수를 줄이게 한다. | https://www.krds.go.kr/html/site/global/global_11.html |
| krds-19 | KRDS | 서비스 패턴 > 신청 > 확인·확정 | E04 F05 D04 | 제출 전에 핵심 정보를 요약해 보이고, 되돌릴 수 없는 행동은 확정·취소 버튼으로 분명히 알린다. | https://www.krds.go.kr/html/site/service/service_04_06.html |
| govuk-03 | GOV.UK | 패턴 > Check answers | E04 F05 | 제출 전에 입력한 내용을 한 화면에서 훑어 고칠 수 있게 해 확신을 주고 실수를 줄인다. | https://design-system.service.gov.uk/patterns/check-answers/ |
| govuk-14 | GOV.UK | 컴포넌트 > Button | E06 | 느린 연결이나 습관으로 생기는 이중 제출을 막는 더블클릭 방지 옵션이 있다. | https://design-system.service.gov.uk/components/button/ |
| w3c-07 | W3C | WCAG 2.2 Understanding 3.3.4 Error Prevention (Legal, Financial, Data) | D04 E04 M03 | 법적·금전 거래나 데이터 삭제 같은 중요한 제출은 되돌리기·검사·확인 중 하나를 제공한다. | https://www.w3.org/WAI/WCAG22/Understanding/error-prevention-legal-financial-data.html |
| law-06 | 법제처 | 전자상거래법 제17조 청약철회등 | K01 E04 | 통신판매 소비자는 정해진 기간 안에 청약철회를 할 수 있으므로 환불·철회 안내 쪽이 이를 반영해야 한다. | https://law.go.kr/LSW/lsLawLinkInfo.do?chrClsCd=010202&lsId=009318&lsJoLnkSeq=1000527255&print=print |
| law-07 | 법제처 | 전자상거래법 제13조 신원 및 거래조건 정보의 제공 | K03 K01 E08 | 통신판매업자는 상호·대표자·연락처·등록 정보와 가격·배송·환불·분쟁 해결 조건을 계약 전에 밝힌다. | https://www.law.go.kr/LSW//lsLawLinkInfo.do?lsJoLnkSeq=1000527501&lsId=009318&chrClsCd=010202&print=print |
| govuk-19 | GOV.UK | 패턴 > Confirmation pages | A01 A08 F05 E05 | 끝났다는 안심과 함께 접수 번호·다음 단계·문의처·기록 저장 수단을 주고, 북마크로 다시 와도 볼 수 있게 한다. | https://design-system.service.gov.uk/patterns/confirmation-pages/ |

<a id="mail"></a>
## 메일·알림·공지 (6)

범위: 광고성 정보 동의·수신 거부·발송 인증·푸시·알림 띠.

| id | 출처 | 패턴 | 우리 항목 | 한 줄 요지 | 주소 |
|---|---|---|---|---|---|
| krds-12 | KRDS | 기본 패턴 > 모바일 알림 | G06 D08 | 푸시·앱 내 메시지·알림센터를 중요도 단계로 나눠 보내고, 사용자가 알림 설정을 직접 조절하게 한다. | https://www.krds.go.kr/html/site/global/global_12.html |
| krds-13 | KRDS | 컴포넌트 > 긴급 공지(Critical alerts) | F02 H03 | 본문 위쪽 눈에 띄는 배너로 긴급하거나 중요한 공지를 일관된 모양으로 알린다. | https://www.krds.go.kr/html/site/component/component_04_02.html |
| govuk-13 | GOV.UK | 컴포넌트 > Notification banner | F02 A01 | 현재 화면 내용과 직접 관련 없는 중요 정보를 제목 앞에 아껴 쓰고, 성공 알림에는 보조기기가 즉시 읽는 역할을 준다. | https://design-system.service.gov.uk/components/notification-banner/ |
| law-05 | 법제처 | 정보통신망법 제50조 영리목적 광고성 정보 전송 제한 | G03 A05 D07 G06 | 광고성 정보는 사전 동의를 받고, 수신 거부·동의 철회가 쉬운 방법과 전송자 정보를 광고에 밝힌다. | https://www.law.go.kr/LSW/lsLawLinkInfo.do?chrClsCd=010202&lsJoLnkSeq=1000688185&lsId=000030 |
| rfc-01 | RFC | RFC 8058 원클릭 수신 거부 신호 | G03 | 메일 머리글에 원클릭 수신 거부 신호를 실어 수신자가 추가 확인 없이 한 번의 요청으로 구독을 끊게 한다. | https://www.rfc-editor.org/rfc/rfc8058 |
| google-01 | Google | 이메일 발송자 지침(Gmail) | G03 G04 | SPF·DKIM·DMARC 인증을 갖추고 대량 발송자는 마케팅 메일에 원클릭 수신 거부를 넣어야 한다. (열면 support.google.com/mail/answer/81126 으로 넘어간다.) | https://support.google.com/a/answer/81126 |

<a id="error"></a>
## 오류·검증 (10)

범위: 입력 검증·오류 문구·404·서비스 중단 쪽·오류 요약.

| id | 출처 | 패턴 | 우리 항목 | 한 줄 요지 | 주소 |
|---|---|---|---|---|---|
| krds-09 | KRDS | 기본 패턴 > 오류 | H01 H04 A02 | 오류 메시지는 무엇이 잘못됐는지와 어떻게 고치는지를 예의 있게 알려 빨리 복구하게 한다. | https://www.krds.go.kr/html/site/global/global_07.html |
| krds-10 | KRDS | 기본 패턴 > 입력폼 | H06 A03 | 입력폼은 한 열 세로 배치, 충분한 간격, 일관된 버튼 위치, 칸별 오류 메시지 구조로 짠다. | https://www.krds.go.kr/html/site/global/global_08.html |
| kwcag-06 | KWCAG 2.2 | 7.3.1 오류 정정 · 7.3.2 입력 레이블 제공 | H06 A03 | 입력 오류를 알려 고치게 하고, 모든 입력 칸에 무엇을 넣는지 알리는 레이블을 붙인다. (민간 게시본이다. 고시 원문은 kwcag-01(국립전파연구원)이 맡는다.) | https://a11ykr.github.io/kwcag22/ |
| govuk-04 | GOV.UK | 패턴 > There is a problem with the service pages | H01 H04 | 예기치 않은 서비스 오류 화면에 지원 경로와 입력 데이터 저장 여부를 함께 알린다. | https://design-system.service.gov.uk/patterns/problem-with-the-service-pages/ |
| govuk-05 | GOV.UK | 패턴 > Recover from validation errors | H06 A03 | 사용자가 다음으로 진행하려 할 때만 검증하고 서버 검증을 기본으로 하며, 오류 문구는 원인과 해결 방법을 말한다. | https://design-system.service.gov.uk/patterns/validation/ |
| govuk-10 | GOV.UK | 패턴 > Page not found pages | H02 | 404 화면은 페이지가 없다는 사실을 분명히 말하고 다음에 할 일을 안내한다. | https://design-system.service.gov.uk/patterns/page-not-found-pages/ |
| govuk-12 | GOV.UK | 컴포넌트 > Error summary | H06 | 오류가 여럿일 때 화면 위에 목록으로 모으고 각 항목이 해당 입력 칸으로 이동하게 한다. | https://design-system.service.gov.uk/components/error-summary/ |
| w3c-03 | W3C | WCAG 2.2 Understanding 3.3.1 Error Identification | H06 A03 | 오류가 난 칸을 가리키고 오류 내용을 글자로 설명해야 한다. | https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html |
| govuk-18 | GOV.UK | 패턴 > Service unavailable pages | H01 H04 K07 | 서비스가 왜 멈췄고 언제 다시 되는지 말하고, 문의처·대체 서비스·오프라인 방법처럼 다른 길을 함께 안내한다. | https://design-system.service.gov.uk/patterns/service-unavailable-pages/ |
| govuk-20 | GOV.UK | 컴포넌트 > Error message | A02 H04 H06 L04 | 질문 라벨을 가리키며 무엇이 틀렸고 어떻게 고치는지 쉬운 말로 쓰고, 보조기기용 숨은 「오류」 접두와 입력값 유지를 지킨다. | https://design-system.service.gov.uk/components/error-message/ |

<a id="a11y"></a>
## 접근성·포용 (18)

범위: KWCAG 2.2·WCAG 2.2·건너뛰기·초점·대비·모달·언어 바꾸기·공통 지침 입구.

| id | 출처 | 패턴 | 우리 항목 | 한 줄 요지 | 주소 |
|---|---|---|---|---|---|
| krds-14 | KRDS | 컴포넌트 > 모달 | J02 E04 | 모달이 열리면 포커스가 안으로 들어가 머물고, 닫히면 연 버튼으로 돌아가며, 승인이 필요한 모달은 닫기 버튼을 없앤다. | https://www.krds.go.kr/html/site/component/component_04_05.html |
| krds-15 | KRDS | 컴포넌트 > 건너뛰기 링크 | J01 | 키보드·스크린리더 이용자가 반복 영역을 넘어 본문으로 가는 링크를 보이는 형과 잠시 숨김 형으로 제공한다. | https://www.krds.go.kr/html/site/component/component_03_01.html |
| krds-17 | KRDS | 스타일 > 색상 | J08 | 색 단계에 대비율을 매긴 번호 체계로 글자·배경 조합이 WCAG 명도 대비를 만족하는지 바로 계산하게 한다. | https://www.krds.go.kr/html/site/style/style_02.html |
| krds-18 | KRDS | 소개 > 디지털 포용 | J09 J08 | 장애인·고령자·아동·외국인까지 이용자로 보고 KWCAG 2.2 와 WCAG 2.1 기준으로 스타일·컴포넌트·패턴을 만든다. | https://www.krds.go.kr/html/site/utility/utility_04.html |
| dgov-01 | 디지털정부 UI·UX 가이드라인 | 행정안전부 공공 웹·앱 UI/UX 혁신 소개(KRDS 연계) | A01 B01 J09 | 가이드라인 개발 경과와 KRDS 2025-01-16 개시, 적용 사례를 소개하는 행안부 안내 페이지다. | https://www.mois.go.kr/frt/sub/a06/b04/uixInnovation/screen.do |
| dgov-02 | 디지털정부 UI·UX 가이드라인 | 2025-08 수정본 배포 공지(본문·신구대비표 첨부) | A01 B01 H06 J09 | 2025년 8월 수정본 배포를 알리는 공지이며, 전체 가이드라인 문서와 신구대비표가 첨부로 붙어 있다. | https://www.mois.go.kr/frt/bbs/type001/commonSelectBoardArticle.do?bbsId=BBSMSTR_000000000045&nttId=120220 |
| dgov-03 | 디지털정부 UI·UX 가이드라인 | 가이드라인 소개(KRDS 내 페이지) | J09 J05 | 서비스 패턴 5종과 WCAG 2.1 AA 준수를 기준으로 하며, 모바일 OS 고유 컴포넌트와 앱 전용 화면은 다루지 않는다고 범위를 밝힌다. | https://www.krds.go.kr/html/site/utility/utility_07.html |
| kwcag-01 | KWCAG 2.2 | 고시 원문 KS X OT0003(국립전파연구원, 2022-12-28) | J01 J04 J08 H06 | 한국형 웹 콘텐츠 접근성 지침 2.2 표준 문서와 해설서를 내려받는 공식 게시 페이지다. | https://www.rra.go.kr/ko/reference/kcsList_view.do?nb_seq=5247&nb_type=6 |
| kwcag-02 | KWCAG 2.2 | NIA 보도자료: 2.2 개정(기존 24항목에 신규 9항목) | J05 J09 | 2.2 개정에서 키보드·음성 명령·확대 화면·인지 어려움 이용자를 위한 신규 검사항목이 더해졌음을 알린다. | https://www.nia.or.kr/site/nia_kor/ex/bbs/View.do?cbIdx=90549&bcIdx=25083&parentSeq=25083 |
| kwcag-03 | KWCAG 2.2 | 4원칙·33검사항목 전체 목록(민간 게시본, 고시 원문 아님) | J09 | 인식·운용·이해·견고 4원칙 아래 검사항목 33개의 번호와 이름을 한 페이지에서 대조할 수 있다. (민간 게시본이다. 고시 원문은 kwcag-01(국립전파연구원)이 맡는다.) | https://a11ykr.github.io/kwcag22/ |
| kwcag-04 | KWCAG 2.2 | 6.4.1 반복 영역 건너뛰기 | J01 | 반복되는 머리글·메뉴를 건너뛰고 본문으로 갈 수단을 제공해야 한다. (민간 게시본이다. 고시 원문은 kwcag-01(국립전파연구원)이 맡는다.) | https://a11ykr.github.io/kwcag22/ |
| kwcag-05 | KWCAG 2.2 | 6.4.2 제목 제공(페이지 제목) | J04 L01 | 페이지·프레임에 내용을 알려 주는 제목을 달아야 한다. (민간 게시본이다. 고시 원문은 kwcag-01(국립전파연구원)이 맡는다.) | https://a11ykr.github.io/kwcag22/ |
| kwcag-09 | KWCAG 2.2 | 5.4.3 텍스트 콘텐츠의 명도 대비 | J08 | 글자와 배경의 명도 대비가 기준 이상이어야 한다. (민간 게시본이다. 고시 원문은 kwcag-01(국립전파연구원)이 맡는다.) | https://a11ykr.github.io/kwcag22/ |
| kwcag-10 | KWCAG 2.2 | 6.1.2 초점 이동 | J02 J03 | 키보드 초점이 논리적 순서로 움직이고 눈에 보여야 한다. (민간 게시본이다. 고시 원문은 kwcag-01(국립전파연구원)이 맡는다.) | https://a11ykr.github.io/kwcag22/ |
| kwcag-11 | KWCAG 2.2 | 웹 접근성 품질마크 법적 근거(민간 인증기관 안내) | J09 | 품질인증 제도가 국가정보화기본법 개정으로 법적 근거를 얻은 경과와 인증기관 체계를 설명한다. 장애인차별금지법 언급은 이 페이지에 없었다. (민간 인증기관 안내다. 장애인차별금지법 언급은 이 쪽에 없다.) | https://www.websoul.co.kr/accessibility/certification.asp |
| govuk-15 | GOV.UK | 컴포넌트 > Language navigation | I06 | 여러 언어판이 있을 때 언어를 바꾸는 탐색을 제공한다. 이 컴포넌트는 시험 단계 표시가 있었다. (이 컴포넌트는 시험 단계 표시가 있다.) | https://design-system.service.gov.uk/components/language-navigation/ |
| w3c-05 | W3C | WCAG 2.2 Understanding 4.1.3 Status Messages | F02 H06 B03 | 포커스를 옮기지 않고도 보조기기가 상태 메시지를 읽도록 프로그램으로 표시한다. | https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html |
| govuk-21 | GOV.UK | 컴포넌트 > Skip link | J01 | 건너뛰기 링크를 본문 시작 직후(쿠키 띠가 있으면 그 뒤)에 두고, 기본 목표는 본문 영역으로 한다. | https://design-system.service.gov.uk/components/skip-link/ |

<a id="mobile"></a>
## 모바일·반응형 (3)

범위: 리플로·눌림 크기·화면 구획.

| id | 출처 | 패턴 | 우리 항목 | 한 줄 요지 | 주소 |
|---|---|---|---|---|---|
| krds-16 | KRDS | 스타일 > 레이아웃 | J06 J07 | 중단점 단계별 열 수·거터·최소 화면 여백을 정해 화면 크기에 따라 배치가 자연스럽게 바뀌게 한다. | https://www.krds.go.kr/html/site/style/style_05.html |
| w3c-04 | W3C | WCAG 2.2 Understanding 2.5.8 Target Size (Minimum) | J05 | 누를 대상은 최소 24×24 CSS 픽셀이거나 주변 간격이 충분해야 한다. | https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html |
| w3c-06 | W3C | WCAG 2.2 Understanding 1.4.10 Reflow | J06 | 320 CSS 픽셀 폭에서 가로 스크롤 없이 읽히게 해 확대 사용자를 돕는다. | https://www.w3.org/WAI/WCAG22/Understanding/reflow.html |

<a id="contact"></a>
## 문의·고지 (5)

범위: 문의 수단·도움·쿠키·처리방침.

| id | 출처 | 패턴 | 우리 항목 | 한 줄 요지 | 주소 |
|---|---|---|---|---|---|
| krds-07 | KRDS | 기본 패턴 > 도움 | K05 K07 K08 | 이용자 숙련도에 맞는 도움 컴포넌트를 골라 화면 사용법과 업무 절차를 쉽게 이해시킨다. | https://www.krds.go.kr/html/site/global/global_02.html |
| govuk-08 | GOV.UK | 패턴 > Contact a department or service team | K05 K06 C08 | 전화·이메일·웹챗 등 연락 수단과 응답 시간 정보를 이용자가 찾기 쉽게 보여 준다. | https://design-system.service.gov.uk/patterns/contact-a-department-or-service-team/ |
| govuk-09 | GOV.UK | 컴포넌트 > Cookie banner | K04 J07 | 필수가 아닌 쿠키는 수락·거부를 같은 무게로 고르게 하고, 선택 결과를 확인시키며 나중에 바꿀 수 있게 한다. | https://design-system.service.gov.uk/components/cookie-banner/ |
| law-02 | 법제처 | 개인정보 보호법 제30조 개인정보 처리방침의 수립 및 공개 | K01 K03 | 처리 목적·보유 기간·제3자 제공·파기 절차를 담은 처리방침을 정해 정보주체가 쉽게 볼 수 있게 공개한다. | https://www.law.go.kr/LSW/lsLawLinkInfo.do?chrClsCd=010202&lsJoLnkSeq=900078922 |
| govuk-17 | GOV.UK | 패턴 > Cookies page | K04 J07 | 쓰는 쿠키를 이름·목적·만료·제3자까지 쉬운 말로 나열한 전용 쪽을 두고, 푸터와 쿠키 띠에서 연결하며, 필수 아닌 쿠키의 수락·거부를 라디오로 고르고 저장 결과를 확인시킨다. | https://design-system.service.gov.uk/patterns/cookies-page/ |

<a id="ax"></a>
## AX(에이전트·검색) (3)

범위: llms.txt·WebMCP·쪽 제목.

| id | 출처 | 패턴 | 우리 항목 | 한 줄 요지 | 주소 |
|---|---|---|---|---|---|
| llmstxt-01 | llmstxt.org | /llms.txt 제안서 | L03 L04 | 사이트가 에이전트용으로 추린 내용을 마크다운 파일로 루트에 두자는 제안이다. 효과는 논쟁 중이다. (제안서다. 효과는 논쟁 중이다.) | https://llmstxt.org/ |
| gsc-01 | Google Search Central | 제목 링크 영향 주기 | L01 H02 | 쪽마다 구분되는 서술형 title 요소를 쓰고 키워드 나열이나 반복 문구를 피한다. | https://developers.google.com/search/docs/appearance/title-link |
| webmcp-01 | W3C WebMCP | WebMCP 커뮤니티 그룹 초안 | M01 M02 | 웹앱이 기능을 에이전트가 부를 도구로 노출하는 JavaScript API와 권한·프롬프트 주입 위험 모델을 정의한다. toolautosubmit 속성은 읽은 요약에서 확인되지 않았다. (커뮤니티 그룹 초안이다. toolautosubmit 속성은 확인되지 않았다.) | https://webmachinelearning.github.io/webmcp/ |

<a id="by-item"></a>
## 감사 항목 → 행 (거꾸로 찾기)

항목 73개에 행이 있다. 여기 없는 항목은 대응하는 1차 출처를 아직 못 찾은 것이다(`README.md` 「아직 없는 것」).

| 항목 | 행 id |
|---|---|
| A01 | dgov-01 dgov-02 govuk-01 govuk-13 govuk-19 |
| A02 | krds-09 govuk-02 owasp-01 govuk-20 govuk-22 |
| A03 | krds-03 krds-10 kwcag-06 govuk-05 govuk-06 govuk-07 w3c-03 nist-01 |
| A04 | krds-08 w3c-02 law-01 |
| A05 | krds-08 law-01 law-05 |
| A07 | kwcag-08 govuk-02 w3c-01 |
| A08 | govuk-19 |
| A10 | govuk-01 |
| A14 | govuk-01 govuk-22 |
| B01 | krds-03 krds-04 dgov-01 dgov-02 govuk-07 |
| B02 | krds-01 govuk-02 |
| B03 | krds-06 w3c-05 |
| B04 | krds-01 krds-06 |
| B05 | krds-02 krds-03 |
| B06 | krds-02 |
| B07 | krds-05 krds-06 kwcag-07 |
| B08 | nist-01 owasp-01 |
| B10 | krds-02 kwcag-08 w3c-01 |
| C01 | govuk-06 govuk-07 nist-01 |
| C03 | kwcag-08 govuk-11 w3c-01 |
| C04 | govuk-11 nist-01 |
| C07 | owasp-01 |
| C08 | govuk-08 owasp-01 |
| D02 | govuk-16 |
| D03 | law-03 |
| D04 | krds-11 krds-19 w3c-07 law-03 law-04 |
| D06 | krds-08 law-01 |
| D07 | law-05 |
| D08 | krds-12 |
| D09 | law-04 |
| E04 | krds-14 krds-19 govuk-03 w3c-07 law-06 |
| E05 | govuk-19 |
| E06 | govuk-14 |
| E08 | law-07 |
| F02 | krds-13 govuk-13 w3c-05 |
| F05 | krds-11 krds-19 govuk-03 govuk-19 |
| G03 | law-05 rfc-01 google-01 |
| G04 | google-01 |
| G06 | krds-12 law-05 |
| H01 | krds-09 govuk-04 govuk-18 |
| H02 | govuk-10 gsc-01 |
| H03 | krds-13 |
| H04 | krds-09 govuk-04 govuk-18 govuk-20 |
| H05 | krds-04 |
| H06 | krds-10 dgov-02 kwcag-01 kwcag-06 govuk-05 govuk-12 w3c-03 w3c-05 govuk-20 |
| H09 | kwcag-07 |
| I06 | govuk-15 |
| J01 | krds-15 kwcag-01 kwcag-04 govuk-21 |
| J02 | krds-14 kwcag-10 |
| J03 | kwcag-10 |
| J04 | kwcag-01 kwcag-05 |
| J05 | dgov-03 kwcag-02 w3c-04 |
| J06 | krds-16 w3c-06 |
| J07 | krds-16 govuk-09 govuk-17 |
| J08 | krds-17 krds-18 kwcag-01 kwcag-09 |
| J09 | krds-18 dgov-01 dgov-02 dgov-03 kwcag-02 kwcag-03 kwcag-11 |
| K01 | law-02 law-06 law-07 |
| K03 | law-02 law-07 |
| K04 | krds-08 govuk-09 law-01 govuk-17 |
| K05 | krds-07 govuk-08 |
| K06 | govuk-08 |
| K07 | krds-07 govuk-18 |
| K08 | krds-07 |
| L01 | kwcag-05 gsc-01 |
| L03 | llmstxt-01 |
| L04 | llmstxt-01 govuk-20 |
| M01 | webmcp-01 |
| M02 | webmcp-01 |
| M03 | krds-11 w3c-07 |
| M05 | krds-11 |
| N10 | krds-04 |
| N11 | w3c-02 |
| N12 | krds-05 |
