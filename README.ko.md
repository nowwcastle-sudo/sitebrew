[English](README.md) · [한국어](README.ko.md) · [简体中文](README.zh-CN.md) · [Español](README.es.md) · [日本語](README.ja.md)

# Sitebrew

Sitebrew는 질문 몇 개에 답하면 웹사이트 후보 세 개를 만들어 주는 도구입니다. 세 후보를 나란히 보고 하나를 고릅니다. 고친 뒤 내 폴더로 받습니다. Claude Code나 Codex 안에서 플러그인으로 쓰고, 코드를 몰라도 됩니다.

현재 버전 `v0.1.0`.

- 사이트 종류는 10가지입니다: 브랜드, 동네 가게, 온라인 상점, 상품 상세, 행사·대기 명단 랜딩, 포트폴리오, 공공기관, SaaS, 모바일 앱(PWA), 관리 화면.
- 한국어 사이트와 영어 사이트를 만듭니다. 동네 가게와 공공기관은 한국어만 됩니다.
- 회원가입·결제가 필요한 서비스는 같은 저장소의 launch-factory 키트로 이어 붙입니다.
- Windows 10·11에서 만들고 시험했습니다.

## 필요한 것

| 항목 | 버전 | 필수 | Windows에서 설치 |
|---|---|---|---|
| Claude Code 또는 Codex | 최신 | 둘 중 하나 | `winget install Anthropic.ClaudeCode` / `winget install OpenAI.Codex` |
| Node | >=24.13.0 | 예 | `winget install OpenJS.NodeJS.LTS` |
| npm | >=11.6.2 | 예 | Node와 함께 설치됨 |
| Git | 최신 | 예 | `winget install Git.Git` |
| Chrome | 최신 | 아니요 | `winget install Google.Chrome` |

- 아래 설치기가 빠진 것을 찾아 알려 줍니다. 무엇을 설치할지 먼저 묻고, 답하기 전에는 아무것도 설치하지 않습니다.
- Claude Code나 Codex는 각 서비스 계정으로 로그인해야 씁니다.
- Chrome이 없으면 화면 검사 일부만 건너뜁니다. 사이트는 그대로 만들어집니다.
- PowerShell 여는 법: 시작 메뉴에서 「PowerShell」을 검색해 엽니다. 관리자 권한으로 열지 마세요. 관리자 창에서는 설치기가 멈춥니다.

## 설치

### 한 줄 설치 (권장)

PowerShell에 아래 한 줄을 붙여 넣습니다. 설치기는 현재 폴더 아래 `sitebrew` 폴더에 Sitebrew를 받고, 고른 에이전트에 플러그인을 설치합니다.

```powershell
irm https://raw.githubusercontent.com/nowwcastle-sudo/sitebrew/v0.1.0/get.ps1 | iex
```

아무것도 설치하지 않고 무엇을 할지만 보려면 이렇게 실행합니다.

```powershell
$env:SITEBREW_WHATIF = '1'
irm https://raw.githubusercontent.com/nowwcastle-sudo/sitebrew/v0.1.0/get.ps1 | iex
Remove-Item Env:SITEBREW_WHATIF
```

에이전트나 폴더를 직접 정하려면 옵션을 붙이는 형태를 씁니다. `-Tool`은 `claude`, `codex`, `both` 중 하나입니다. `-Yes`는 모든 질문에 「예」로 답합니다. `-WhatIf`는 미리보기만 합니다.

```powershell
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/nowwcastle-sudo/sitebrew/v0.1.0/install.ps1).TrimStart([char]0xFEFF))) -Tool claude -Folder "$HOME\sitebrew"
```

### npx로 설치

Node가 이미 있으면 이 방법도 됩니다. 저장소를 받은 뒤 플러그인 설치 명령 두 줄을 보여 주고, 「예」라고 답하면 바로 실행합니다.

```powershell
npx create-sitebrew@0.1.0 sitebrew
```

### 플러그인만 설치

Claude Code 안에서:

```text
/plugin marketplace add nowwcastle-sudo/sitebrew#v0.1.0
/plugin install sitebrew@sitebrew
```

Codex에서:

```powershell
codex plugin marketplace add nowwcastle-sudo/sitebrew --ref v0.1.0
codex plugin add sitebrew@sitebrew
```

설치를 확인하려면 `claude plugin list`를 실행합니다.

## 첫 사이트 만들기

1. 사이트 파일을 둘 빈 폴더에서 Claude Code를 엽니다.
2. `/sitebrew:doctor`로 빠진 것을 확인합니다. 빠진 항목마다 고치는 법이 한 줄씩 나옵니다.
3. `/sitebrew:new`를 실행하고 질문에 답합니다. 이름, 대상 고객, 연락처, 분위기 같은 것을 묻습니다. 모르는 것은 비워 둬도 됩니다.
4. 후보 세 개를 비교하고 하나를 고릅니다.
5. 바꾸고 싶은 곳이 있으면 `/sitebrew:revise`로 구획 하나, 색·서체·움직임, 문구 하나를 바꿉니다.
6. `/sitebrew:deliver`로 고른 사이트를 내 폴더에 받습니다. 함께 오는 안내 파일에 공개 전에 채울 것이 적혀 있습니다.

```text
/sitebrew:doctor
/sitebrew:new
```

Codex에서는 「sitebrew 의 new 스킬로 사이트를 만들어 줘」라고 말합니다. 영어 사이트를 원하면 처음에 「영어 사이트」라고 말합니다.

## 미리보기 모드와 빈칸

키가 없어도 시작할 수 있습니다. 키가 없으면 사이트가 미리보기 모드로 만들어지고 「공개 불가」 표시가 붙습니다. 무엇이 빠져서 공개할 수 없는지 한 줄씩 나옵니다.

- 「확인 필요」: 질문에서 비운 사실(전화번호, 사업자 정보 등)입니다. 지어내지 않고 빈칸으로 둡니다. 직접 채웁니다.
- 「실제 사진 필요」: 가게 사진, 제품 화면처럼 진짜 사진만 쓸 수 있는 자리입니다. 내 사진을 넣습니다.
- 「법률 검토 미완」: 약관·개인정보 처리방침 초안이 아직 법 조문과 대조되지 않았습니다.

아래 값은 모두 선택입니다. 플러그인을 켤 때 Claude Code가 묻습니다. 명령줄로 설치했다면 묻지 않으니 `/plugin configure sitebrew@sitebrew`로 넣습니다. 키 값을 대화창에 붙여 넣지 마세요.

| 이름 | 채우면 되는 것 |
|---|---|
| `PEXELS_API_KEY` | 빈 사진 자리 대신 실제 스톡 사진 |
| `LAW_API_OC` | 한국어 법정 쪽을 현행 법 조문과 대조 |
| `VERCEL_TOKEN` | 온라인 미리보기 주소 |
| `HIGGSFIELD_DIR` | 내가 만든 이미지·3D 모델 폴더 |

```text
/plugin configure sitebrew@sitebrew
```

3D 오브젝트 첫 화면(`object-3d-orbit`)은 이미지에서 시작합니다. 이미지 → GLB(3D 모델) → 화면 표시 순서입니다. 도구가 없으면 2.5D 그림, 그다음 포스터로 물러납니다. 이미지가 전혀 없으면 이 첫 화면은 고르지 않습니다.

## 용어

| 말 | 뜻 |
|---|---|
| 후보 | 같은 질문 답으로 만든 서로 다른 사이트 안. 한 번에 세 개 |
| 보드 | 후보를 나란히 놓고 고르는 화면 |
| 찍어내기 | 답에서 사이트를 만드는 과정(`npm run stamp`) |
| 미리보기 모드 | 키·사실이 빠진 채 만든 사이트. 보고 고르기에는 충분하지만 공개하면 안 됨 |
| 공개 불가 | 공개 전에 채울 것이 남았다는 표시. 사유가 같이 나옴 |
| 닥터 | 내 컴퓨터에 빠진 것과 고치는 법을 알려 주는 점검 |
| 검수대 | 부품과 블록을 하나씩 띄워 보는 개발용 화면(`npm run dev`) |

## 설치가 멈출 때

설치기는 끝나면 결과를 `$LASTEXITCODE`에 남깁니다. 터미널이 아닌 곳에서 실행하면 모든 질문에 「아니요」로 답한 것으로 봅니다.

| 코드 | 뜻 | 할 일 |
|---|---|---|
| 0 | 끝남, 또는 미리보기 | 화면 마지막 줄의 다음 할 일을 따릅니다 |
| 1 | 내려받기·복제·플러그인 명령 실패 | 인터넷 연결을 확인하고 같은 줄을 다시 실행합니다 |
| 2 | 옵션이나 폴더가 잘못됨 | `-Folder` 경로를 확인합니다. Windows·Program Files 아래는 안 됩니다 |
| 3 | 빠진 것이 있거나 답이 필요함 | 화면에 나온 설치 명령을 실행하거나 `-Yes`로 다시 실행합니다 |
| 4 | 시작 거부 | 관리자 창이면 보통 PowerShell 창에서 다시 실행합니다 |

`-Yes`로 실행하면 Sitebrew 폴더 위치를 사용자 환경 변수 `SITEBREW_DIR`에 저장하는 것까지 「예」로 답합니다.

## 개발자용

저장소는 세 부분입니다. `factory/`·`registry/`는 사이트 공장(web-factory)이고, `launch-factory/`는 회원가입·결제·메일·분석 키트입니다. `plugins/sitebrew/`는 플러그인, `packages/create-sitebrew/`는 npx 설치기입니다.

```bash
git clone https://github.com/nowwcastle-sudo/sitebrew.git
cd sitebrew
npm run setup
npm run dev
```

- `npm run setup`은 환경을 점검하고 필요하면 의존성을 설치합니다. `npm run dev`는 검수대를 엽니다.
- 병합 전 검사는 `npm run ci:verify` 한 줄입니다.
- 에이전트용 전체 안내는 [docs/agents/agent-guide.md](docs/agents/agent-guide.md)입니다.
- 레시피나 블록을 더하는 법은 [docs/guides/add-recipe.md](docs/guides/add-recipe.md)에 있습니다.
- launch-factory 사용법은 [launch-factory/README.md](launch-factory/README.md)에 있습니다.
- 릴리스 절차는 [docs/RELEASING.md](docs/RELEASING.md)입니다. 서체 라이선스는 [docs/qa/font-licenses.md](docs/qa/font-licenses.md)에 있습니다.

다른 Next.js 프로젝트에 부품만 설치할 수도 있습니다. 주소에는 항상 태그를 붙입니다.

```bash
npx shadcn@4.21.0 add nowwcastle-sudo/sitebrew/factory-default#v0.1.0 -y -o
npx shadcn@4.21.0 add nowwcastle-sudo/sitebrew/factory-base#v0.1.0 -y -o
npx shadcn@4.21.0 add nowwcastle-sudo/sitebrew/alert-dialog#v0.1.0 -y -o
```

## 라이선스

MIT입니다. [LICENSE](LICENSE)와 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)를 보세요.

## 릴리스 기록

| 태그 | 날짜 | 바뀐 것 | 기록 |
|---|---|---|---|
| `v0.1.0` | 2026-10-15 | 첫 공개 릴리스 · web-factory v0.0.13 + launch-factory v0.1.2 (내부 버전) | — |
