# 토스 카드 등록 시험 경로

## 생성 앱

결제 기능을 고른 뒤 launch-factory 폴더에서 다음과 같이 명시적으로 조립한다. 경로는 각자의 시안·기능 파일과 비어 있는 출력 경로로 바꾼다.

```powershell
node scripts/compose/compose-product.mjs --site <시안-폴더> --features <features.json> --to <출력-폴더> --billing-provider toss-test
```

이 선택의 생성 앱은 개발 mock에서 모의 공급자와 공식 시험 상점 설정을 허용한다. 운영 빌드와 live 모드는 차단하고 공용 결제 화면의 모의 유료 전환도 막는다. `/account/billing/toss-test`는 아래 시험 설정을 명시해야 열린다. Cron `/api/cron/toss-test`는 인증된 호출을 시험할 수 있으며 자동 배포 스케줄은 등록하지 않는다. 옵션을 생략하면 토스 시험 경로는 생성하지 않는다.

## 현재 상태와 제한

카드 등록 후 첫 청구 확인을 누르면 서버에 저장된 시험 금액으로 청구 원장을 만든다. 공식 시험 상점 모드는 토스 시험 API를 호출한다. 서버 로그인, 같은 오리진, 구독 소유자와 이전 시도를 검사하며 응답이 불명확한 경우 재승인하지 않는다. 시험 청구 성공은 유료 기능을 켜지 않는다.

템플릿에는 모의 월 갱신 Cron, 미확정 주문 재조회, 해지와 계정 탈퇴 연결이 있다. 기본 fake transport는 주문 조회 성공을 만들지 않으므로 미확정 주문은 확인 불가 상태로 남고 다시 승인하지 않는다. 실제 SDK와 CSP, 공식 시험 상점은 검증하지 않았다. `requestBillingAuth`에는 상위 창 이동을 위해 `windowTarget: self`를 전달한다.

이 기능은 실결제 기능이 아니다. 개발 서버에서 `LF_MODE=mock`, `LF_TOSS_TEST=1`과 시험 설정을 명시한 경우에만 `/account/billing/toss-test`가 열린다. 실제 Better Auth 서버 세션이 필요하며 대리 세션은 거절한다. 카드 등록은 유료 권한을 주지 않고 화면에 `카드 등록 완료 · 결제 전`으로 표시한다.

- `LF_TOSS_TEST_FAKE=1`: `TOSS_TEST_CLIENT_KEY=test_ck_fake`, `TOSS_TEST_SECRET_KEY=test_sk_fake`만 허용한다. 브라우저 fake SDK와 서버 fake transport가 동작하며 외부 토스 호출은 없다. 화면은 모의 결과라고 표시한다.
- `LF_TOSS_TEST_FAKE=0`: 공식 빌링 시험 상점의 `TOSS_TEST_CLIENT_KEY`, `TOSS_TEST_SECRET_KEY`, `TOSS_TEST_MERCHANT_ID`와 쓰기 가능한 별도 로컬 디렉터리의 절대 경로 `TOSS_TEST_DB_DIRECTORY`를 서버에 설정한다. 앱은 그 아래 상점 ID 폴더에 계정과 주문을 저장한다. 개발 서버는 한 프로세스만 띄우고, 재시작할 때 디렉터리·상점 ID·암호화 키를 유지한다. 모의 모드는 별도 메모리 DB를 사용한다. 등록·청구·해지의 공식 시험 연결은 아직 검증하지 않았다.
- 두 경우 모두 `TOSS_TEST_ENCRYPTION_KEY`에 서버 전용 32바이트 키의 64자리 16진수 값이 필요하다. `NEXT_PUBLIC_APP_URL`은 포트를 포함한 정확한 HTTPS 오리진이다. live 키, live 모드, 프로덕션 빌드는 거절한다.
- 앱은 서버가 확인한 Better Auth 세션을 쓰며 화면 시안용 mock 로그인 쿠키는 받지 않는다. 템플릿 mock 모드의 기존 로그인 화면은 이 Better Auth 세션을 만들지 않으므로 수동으로 시험하려면 별도의 실제 서버 테스트 계정과 로그인 절차가 필요하다. E2E 러너는 예약 도메인 계정의 이메일 확인만 준비하고 Better Auth 로그인 API로 실제 세션을 발급한다. 개발 서버는 로컬에서 실행하고, 프록시를 쓴다면 외부 요청의 `Host`·`X-Forwarded-Host`·`X-Forwarded-Proto`를 신뢰할 수 있는 프록시가 덮어써야 한다.
- 발급 응답 유실 시 재발급하지 않는다. 실패 리디렉션은 기존 등록을 변경하지 않으며 미완료 세션이 만료될 때까지 재시도를 막는다. 토스가 빌링키를 다시 조회할 수 없으므로 미확정 발급의 복구 절차는 후속 작업이다.

콜백의 authKey·state·customerKey는 응답에 싣지 않는다. Next 개발 서버의 콜백 요청 로그는 제외하고 Sentry 이벤트·breadcrumb도 차단한다. **별도로 외부 프록시와 호스팅 접근 로그에서 `/api/toss/registration/complete` 및 `/api/toss/registration/fail`의 쿼리 문자열을 기록하지 않도록 설정해야 한다.**

계정 탈퇴 시 새 청구를 차단하고 미확정 주문과 빌링키 삭제를 확인한 뒤 파기를 진행한다. 공급자의 발급·삭제 결과가 불명이면 파기를 보류한다. 파기 작업은 요청을 5분간 선점하며, 실패한 요청은 1시간 뒤 재시도한다. 확인된 결제와 연결된 계약 및 거래 기록은 가명으로 보존한다. 본인 데이터 내보내기에는 시험 구독의 요금제·금액·기간·상태를 포함하며 빌링키는 제외한다.

저장소의 `launch-factory` 폴더에서 다음 명령을 실행한다. Git for Windows의 OpenSSL과 설치된 Chrome이 필요하다.

```powershell
node --test template/test/toss-app.test.mjs
$env:TOSS_E2E_OPENSSL = Join-Path $env:ProgramFiles 'Git\usr\bin\openssl.exe'
$env:TOSS_E2E_SANDBOX = '0'
$env:TOSS_E2E_DELETE = '0'
$env:TOSS_E2E_BILLING = '0'
$env:TOSS_E2E_PENDING = '1'
node --test template/test/toss-app.e2e.mjs
```

위 브라우저 시험은 인증 계정·SDK·공급자 응답을 가짜로 준비하고 미확정 표시를 검사한다. 실제 결제 승인 요청은 없다. 시험 종료 때 자신이 띄운 브라우저와 서버를 종료하고 시험 폴더를 정리한다.

스케줄러는 도래한 청구를 먼저 처리하고 조회 건수·시간을 제한한다. 장기 연체와 복호화 실패는 보류하며, 차기 청구일이 없는 과거 결제는 수동 확인이 필요하다. 미확정 발급·삭제 복구와 실제 SDK/CSP 및 공식 시험 상점 검증은 남아 있다. 토스페이·네이버페이는 별도 심사가 필요하고 카카오페이 정기결제는 지원하지 않는다.
