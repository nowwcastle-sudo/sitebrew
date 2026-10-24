[English](README.md) · [한국어](README.ko.md) · [简体中文](README.zh-CN.md) · [Español](README.es.md) · [日本語](README.ja.md)

# launch-factory

web-factory(화면 블록 저장소)와 짝을 이루는 출시 키트로, 뒷단인 인증·데이터·결제·메일·계측·작업을 이 저장소가 맡는다. 제품은 `template/` 을 복제해 시작하고 `@launch-factory/*` 패키지 판만 올려서 보안 패치를 받는다.

현재 버전 `v0.2.0` · web-factory 고정 `v0.2.0` · 블록 `f2174f6e` · contract `f2174f6e` (태그 v0.2.0 의 커밋)

- 블록은 공급자를 모르고 어댑터가 web-factory 포트를 구현한다. 같은 적합성 묶음으로 어댑터가 mock 과 같은 시나리오를 재현하는지 검사한다.
- 기능 번들(어댑터·서버 액션·웹훅 경로·스키마·마이그레이션)은 `registry.json` 의 항목 하나로 묶인다. 판을 고정한 내역은 [`docs/versions.md`](docs/versions.md)에 있다.
- 계약 정본은 web-factory 의 `registry/factory/contract/` 다.

## 필요 환경

`npm run setup` 이 아래를 모두 점검하고 빠진 것과 이 OS 의 설치 명령을 알린다. 시스템 소프트웨어는 설치하지 않는다.

| 항목 | 판 | 필수 | Windows | macOS | Linux |
|---|---|---|---|---|---|
| Node | >=24.13.0 | 필수 | `winget install OpenJS.NodeJS.LTS --version 24.13.0` | `nvm install 24.13.0` | `nvm install 24.13.0` |
| npm | >=11.6.2 | 필수 | Node 와 함께 설치됨 | Node 와 함께 설치됨 | Node 와 함께 설치됨 |
| git | 최신 | 필수 | `winget install Git.Git` | `brew install git` | `sudo apt install git` |
| web-factory 체크아웃 | 태그 `v0.0.12` | 선택 | `git clone` 후 `LF_WF_REPO` 에 경로 | `git clone` 후 `LF_WF_REPO` 에 경로 | `git clone` 후 `LF_WF_REPO` 에 경로 |
| Chrome | 최신 | 선택 | `winget install Google.Chrome` | `brew install --cask google-chrome` | `sudo apt install chromium` |
| gh | 최신 | 선택 | `winget install GitHub.cli` | `brew install gh` | `sudo apt install gh` |
| vercel | 최신 | 선택 | `npm i -g vercel` | `npm i -g vercel` | `npm i -g vercel` |
| gitleaks | CI 고정 8.30.1 | 선택 | `winget install Gitleaks.Gitleaks` | `brew install gitleaks` | [릴리스 파일](https://github.com/gitleaks/gitleaks/releases/tag/v8.30.1) |
| actionlint | CI 고정 1.7.12 | 선택 | `winget install rhysd.actionlint` | `brew install actionlint` | [릴리스 파일](https://github.com/rhysd/actionlint/releases/tag/v1.7.12) |
| zizmor | CI 고정 1.30.1 | 선택 | `winget install zizmor.zizmor` | `brew install zizmor` | `pipx install zizmor` |
| osv-scanner | CI 고정 2.6.0 | 선택 | `winget install Google.OSVScanner` | `brew install osv-scanner` | [릴리스 파일](https://github.com/google/osv-scanner/releases/tag/v2.6.0) |

선택 항목이 없으면 이런 일이 안 된다.

- web-factory 체크아웃: 없으면 적합성 시험이 SKIP 으로 표시된다. 있으면 `LF_WF_REPO` 가 가리키는 곳을 읽는데 거기에 `v0.0.12` 커밋이 있어야 한다. 환경 변수가 없으면 코드 기본 경로를 쓰므로, 다른 PC 에서는 `LF_WF_REPO` 를 꼭 지정한다.
- Chrome: `npm run template:screens` 가 돌지 않는다. 설치 위치가 기본 경로가 아니면 `CHROME_PATH` 에 실행 파일 경로를 넣는다.
- 보안 도구 넷: `npm run ci:verify` 가 해당 단계를 SKIP 으로 표시한다. CI 는 `scripts/ci/tools.json` 의 고정판을 받아 쓴다. 로컬에서도 없으면 실패로 세려면 `LF_CI_REQUIRE_TOOLS=1` 을 준다.
- gitleaks: 커밋 전 비밀값 검사 훅이 안내만 하고 통과한다.
- gh: 비공개 저장소 clone·push 와 GitHub 로그인(`gh auth login`)에 쓴다.
- vercel: 미리보기 배포와 `npm run env:check -- --vercel` 에 필요하다.

그 밖의 기준:

- 메모리: 빌드와 화면 관문은 빈 메모리 약 3GB 가 필요하다. 모자라면 `template:screens` 가 기다린다(`LF_SCREENS_MIN_FREE_GB`).
- 줄 끝: `.gitattributes` 가 LF 로 고정하므로 `core.autocrlf` 설정과 무관하다.
- 셸: 스크립트는 모두 Node 라서 PowerShell 과 bash 가 같다. `template:screens` 의 `--only /pricing` 같은 인자는 Git Bash 가 경로로 바꾸므로 PowerShell 에서 준다.
- DB: 시험은 메모리 안의 PGlite 를 쓰므로 설치할 것이 없다. live 연결은 Supabase 의 `DATABASE_URL` 이다.

### 환경 변수

값은 저장소에 두지 않는다. 이름 목록은 [`.env.example`](.env.example)이 정본이다.

| 상태 | 필요한 것 |
|---|---|
| mock(기본 개발) | `LF_MODE=mock` 하나. 공급자 키가 없어도 켜진다. |
| live | `LF_MODE=live` 와 공급자 키·`DATABASE_URL`. 빠진 이름은 `npm run env:check`(오프라인)와 `npm run doctor -- --stage sandbox` 가 알린다. |
| 선택 | `INQUIRY_OWNER_EMAIL`·`POSTHOG_*`·`SENTRY_DSN`. 없으면 그 기능만 꺼진다. |
| 상점(선택) | `NEXT_PUBLIC_PORTONE_STORE_ID`·`NEXT_PUBLIC_PORTONE_CHANNEL_KEY`·`PORTONE_API_SECRET`·`PORTONE_WEBHOOK_SECRET`. live 에서는 넷이 모두 있어야 한다. 하나라도 없으면 상점만 꺼진다. mock 에서는 키 없이 모의 결제 확인 단계로 돈다. |
| 경로 | `LF_WF_REPO`(적합성 시험이 읽는 web-factory 체크아웃) · `WF_HOME`(`template:screens` 가 읽는 web-factory 체크아웃) · `CHROME_PATH` |

## 시작하기

저장소가 비공개라면 clone 전에 GitHub 로그인이 필요하다.

```bash
git clone https://github.com/nowwcastle-sudo/sitebrew.git
cd sitebrew/launch-factory
npm run setup
npm run ci:verify
```

- `npm run setup`: 환경을 점검하고 `.githooks` 를 `core.hooksPath` 로 설정한다. `node_modules` 가 없거나 낡았으면 `npm ci` 를 돌린다. 필수가 빠지면 종료 코드 1이고 마지막 줄이 `setup: FAIL` 이다.
- `npm run ci:verify`: CI 와 같은 검사 한 벌이다. 단계마다 PASS·FAIL·SKIP 을 표로 보이고 FAIL 이 하나라도 있으면 종료 코드 1이다.

템플릿을 mock 모드로 띄운다.

```bash
LF_MODE=mock npm run dev -w template
```

```powershell
$env:LF_MODE = "mock"; npm run dev -w template
```

http://localhost:3000 에서 확인한다.

## 자주 하는 일

| 하려는 일 | 명령 |
|---|---|
| 단위 시험 | `npm test` |
| 실행 전 점검(키가 살아 있는지) | `npm run doctor -- --stage dev` (`sandbox`·`preview` 도 있다) |
| 레지스트리 다시 만들기·검사 | `npm run registry:build` · `npm run registry:check` |
| 템플릿 화면 관문(약 4분 빌드) | `npm run template:screens` |
| README 가 현재와 맞는지 | `npm run readme:check` |

### web-factory 고정 올리기

web-factory 에 새 태그 `vX.Y.Z` 가 나오면 다음 순서로 올린다.

```bash
npm run contract:sync -- --from <web-factory-path> --ref vX.Y.Z
node scripts/template-sync.mjs blocks --from <web-factory-path> --ref vX.Y.Z
git diff template/package.json
```

1. `git diff template/package.json` 에 sync 가 올려 쓴 의존이 보이면 되돌린다.
2. `scripts/lib/wf-conformance.mjs` 의 `WF_CONFORMANCE_COMMIT` 을 새 태그의 커밋 해시로 바꾼다.
3. `docs/versions.md` 의 web-factory 행과 이 README 의 「web-factory 고정」 을 새 태그로 바꾼다.
4. `npm run ci:verify` 가 0 인지 본다.

### 새 버전 내기

[`docs/RELEASING.md`](docs/RELEASING.md)의 순서를 따른다. README 갱신과 `npm run readme:check -- --tag vX.Y.Z` 가 태그 전 필수 단계다.

## 막혔을 때

| 보이는 것 | 원인 | 해결 |
|---|---|---|
| `setup: FAIL — 필수 누락 …` | 필수 도구가 없거나 낮은 판이다 | 줄마다 붙은 `→` 명령을 실행하고 `npm run setup` 을 다시 돌린다. |
| `web-factory 체크아웃 없음` · `web-factory 커밋 … 을 찾지 못함` | `LF_WF_REPO` 경로가 없거나 `v0.0.12` 커밋이 없다 | web-factory 를 clone 하고 `git -C <path> fetch --tags` 를 한 뒤 `LF_WF_REPO` 에 그 경로를 넣는다. |
| `SKIP(도구 없음)` | 선택 보안 도구가 없다 | 실패가 아니다. 설치하면 단계가 돈다. |
| `[pre-commit] gitleaks 가 설치돼 있지 않아 … 건너뛴다` | 훅은 걸려 있고 gitleaks 가 없다 | 필요 환경 표의 gitleaks 명령을 실행한다. |
| `--only /pricing` 이 아무 쪽도 못 찾는다 | Git Bash 가 `/pricing` 을 경로로 바꾼다 | PowerShell 에서 돌린다. |

## 릴리스 기록

| 태그 | 날짜 | 내용 | 기록 |
|---|---|---|---|
| `v0.2.0` | 2026-10-24 | launch-factory v0.2.1 (internal version) · 보안 패치: next 16.4.3, zod 4.6.7, body-parser·fast-uri·undici 갱신 · web-factory `v0.2.0` 고정 | — |
