[English](README.md) · [한국어](README.ko.md) · [简体中文](README.zh-CN.md) · [Español](README.es.md) · [日本語](README.ja.md)

# Sitebrew

**몇 가지 질문에 답하면, 완성된 웹사이트 세 개가 나옵니다. 마음에 드는 하나를 가지세요.**

Sitebrew는 Claude Code와 Codex에서 쓰는 플러그인입니다. 만들고 싶은 사이트를 평소 말로 설명하면, 서로 다른 후보 세 개를 만듭니다. 하나를 고르고, 대화로 고친 뒤, 코드를 내 폴더로 가져갑니다. 코딩을 몰라도 되고, 처음 시작할 때 API 키도 필요 없습니다.

현재 버전 `v0.2.1` · MIT 라이선스 · Windows 10·11

## 왜 Sitebrew인가

- **추측 하나가 아니라 진짜 선택지 셋.** 프롬프트 하나를 몇 번이고 다시 쓰는 대신, 완성된 후보 세 개를 나란히 놓고 비교합니다.
- **내 것이 되는 코드.** 결과물은 내 폴더에 들어오는 Next.js·shadcn/ui 프로젝트입니다. 호스팅 빌더도, 종속도 없습니다.
- **지어내지 않습니다.** 전화번호처럼 알려 주지 않은 사실은 표시된 빈칸으로 남깁니다. 법률 문서는 검토되기 전까지 표시가 붙습니다.
- **키 없이도 돌아갑니다.** 키가 없으면 미리보기 모드로 만듭니다. 선택 키를 넣으면 실사 사진, 검토된 법률 문서, 미리보기 링크가 더해집니다.
- **10가지 사이트.** 브랜드, 지역 가게, 온라인 쇼핑몰, 상품 상세, 행사·대기 신청 페이지, 포트폴리오, 공공기관, SaaS, 모바일 앱(PWA), 관리자 대시보드를 한국어나 영어로 만듭니다.
- **움직임과 3D.** 히어로가 움직일 수 있고, 3D 오브젝트 히어로는 이미지 한 장에서 시작합니다(이미지 → 3D 모델). 도구가 없으면 2.5D 이미지로, 그다음 포스터로 물러납니다.
- **필요할 때 뒷단까지.** 같은 저장소의 launch-factory 키트가 회원가입, 결제, 메일, 분석을 붙입니다.

## 어떻게 돌아가나

1. **묻기.** `/sitebrew:new` 가 이름, 대상, 연락처, 분위기를 묻습니다. 모르는 것은 건너뛰어도 됩니다.
2. **찍어내기.** 공장이 검증된 부품(블록, 스타일 축, 레시피, 원형)을 조합해 후보 세 개를 만듭니다. 후보마다 배치·접근성·문구 품질 관문을 거칩니다.
3. **고르기.** 보드가 후보 세 개를 나란히 보여 주고, 그중 하나를 고릅니다.
4. **고치기.** `/sitebrew:revise` 로 구획 하나, 색, 글꼴, 움직임, 문구 하나를 바꿉니다.
5. **받기.** `/sitebrew:deliver` 가 고른 사이트를 내 폴더로 옮기고, 공개 전에 채울 것 목록을 함께 줍니다.

## 설치

### 필요한 것

| 항목 | 버전 | 필수 | Windows 설치 |
|---|---|---|---|
| Claude Code 또는 Codex | 최신 | 둘 중 하나 | `winget install Anthropic.ClaudeCode` / `winget install OpenAI.Codex` |
| Node | >=24.13.0 | 예 | `winget install OpenJS.NodeJS.LTS` |
| npm | >=11.6.2 | 예 | Node와 함께 설치됨 |
| Git | 최신 | 예 | `winget install Git.Git` |
| Chrome | 최신 | 아니오 | `winget install Google.Chrome` |

아래 설치 방식은 모두 빠진 것을 찾아 알려 줍니다. 무엇이든 설치하기 전에 먼저 묻습니다. PowerShell은 관리자가 아닌 일반 사용자로 엽니다.

### 다섯 가지 중 하나를 고르세요

| 방식 | 이럴 때 |
|---|---|
| 1. npm | Node가 이미 있을 때 |
| 2. npx | Node가 이미 있고 npx를 즐겨 쓸 때 |
| 3. PowerShell | Node와 Git까지 함께 확인하는 한 줄을 원할 때 |
| 4. 플러그인 | Claude Code나 Codex에 플러그인만 더하고 싶을 때 |
| 5. AI 에이전트 | Claude Code나 Codex가 대신 설치하게 하고 싶을 때 |

다섯 방식 모두 끝은 같습니다. `sitebrew` 폴더에 Sitebrew가 들어오고, 에이전트에 플러그인이 설치됩니다.

#### 1. npm

```powershell
npm create sitebrew@0.2.1 sitebrew
```

#### 2. npx

```powershell
npx create-sitebrew@0.2.1 sitebrew
```

두 방식은 옵션이 같습니다. `--dry-run` 은 아무것도 바꾸지 않고 할 일만 보여 줍니다. `--yes` 는 모든 질문에 「예」로 답합니다. `--tool` 은 `claude`, `codex`, `both` 중에서 고릅니다.

#### 3. PowerShell

```powershell
irm https://raw.githubusercontent.com/nowwcastle-sudo/sitebrew/v0.2.1/get.ps1 | iex
```

아무것도 설치하지 않고 할 일만 보려면:

```powershell
$env:SITEBREW_WHATIF = '1'
irm https://raw.githubusercontent.com/nowwcastle-sudo/sitebrew/v0.2.1/get.ps1 | iex
Remove-Item Env:SITEBREW_WHATIF
```

#### 4. 플러그인

Claude Code에서:

```text
/plugin marketplace add nowwcastle-sudo/sitebrew#v0.2.1
/plugin install sitebrew@sitebrew
```

Codex에서:

```powershell
codex plugin marketplace add nowwcastle-sudo/sitebrew --ref v0.2.1
codex plugin add sitebrew@sitebrew
```

#### 5. AI 에이전트

아래 글을 Claude Code나 Codex에 붙여 넣으세요. 에이전트는 에이전트용으로 쓴 단계별 안내 [AGENT_INSTALL.md](AGENT_INSTALL.md)를 따라 설치합니다.

```text
Install Sitebrew for me. Read https://raw.githubusercontent.com/nowwcastle-sudo/sitebrew/main/AGENT_INSTALL.md and follow it step by step. Ask me before you install any program, and ask me which agent to use. At the end, show me the last lines of the installer output.
```

설치가 도중에 멈추면 종료 코드와 할 일이 [AGENT_INSTALL.md](AGENT_INSTALL.md)에 있습니다.

## 첫 사이트 만들기

빈 폴더에서 Claude Code를 열고 실행하세요.

```text
/sitebrew:doctor
/sitebrew:new
```

`/sitebrew:doctor` 는 빠진 것을 고치는 방법 한 줄과 함께 보여 줍니다. Codex에서는 「sitebrew new 스킬로 사이트 만들어 줘」라고 말하세요. 선택 키와 전체 스킬 목록은 [플러그인 안내](plugins/sitebrew/README.md)에 있습니다.

## 개발자용

저장소는 세 부분입니다. 루트의 사이트 공장(web-factory), `launch-factory/` 의 뒷단 키트, `plugins/sitebrew/` 의 플러그인입니다.

```bash
git clone https://github.com/nowwcastle-sudo/sitebrew.git
cd sitebrew
npm run setup
npm run dev
```

병합 전 검사는 `npm run ci:verify` 한 줄입니다. 에이전트용 안내는 [docs/agents/agent-guide.md](docs/agents/agent-guide.md), 출시 키트 설명은 [launch-factory/README.md](launch-factory/README.md)에 있습니다.

부품만 다른 Next.js 프로젝트에 넣을 수도 있습니다. 주소에는 늘 태그를 붙이세요.

```bash
npx shadcn@4.22.1 add nowwcastle-sudo/sitebrew/factory-default#v0.2.1 -y -o
npx shadcn@4.22.1 add nowwcastle-sudo/sitebrew/factory-base#v0.2.1 -y -o
```

## 기여하기

기여를 환영합니다. 버그 제보, 아이디어, 새 레시피나 블록, 번역 모두 좋습니다. 시작하려면 [CONTRIBUTING.md](CONTRIBUTING.md)를 읽어 주세요. 짧습니다.

## 라이선스

MIT. [LICENSE](LICENSE)와 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)를 보세요.

## 릴리스 기록

| 태그 | 날짜 | 바뀐 것 | 기록 |
|---|---|---|---|
| `v0.2.1` | 2026-10-25 | 패치 판: shadcn 4.22.1을 한 곳에서 정확 고정(중첩 zod 공지 해소) · 광고 도착 쪽은 기본 noindex · 상품 목록에 ItemList, 행사 랜딩에 Event 구조화 데이터 · 공유 그림에 브랜드 로고 · 행사 랜딩 브리프가 일시·장소를 질문 · 레시피 추가 검증이 안내 문서를 그대로 따름 · web-factory v0.0.16 + launch-factory v0.2.2 (내부 버전) | — |
| `v0.2.0` | 2026-10-24 | 키 없이 mock 모드로 도는 뒷단 모듈(쇼핑·한국 결제, 예약, 알림·푸시, 후기, 검색, 저장소, 뉴스레터, 내 요청, 관리자) · Cloudflare 임시 터널로 만드는 공유 미리보기 링크 · 사이트를 쓰기로 정한 뒤에 보이는 주인용 안내와 런북 · 챗봇인지 에이전트인지 알아보는 스킬과, 빠진 것을 깔아 주는 새 설치 스킬 · web-factory v0.0.14 + launch-factory v0.2.0 (내부 버전) | — |
| `v0.1.2` | 2026-10-16 | 플러그인 디렉터리 심사 대응: doctor 가 클론 주소를 compat.json 에서 읽음, 플러그인 README 에 네트워크 호출 표, 릴리스 안내에 GitHub 릴리스 단계 추가, launch 킷 lucide-react 1.53.0 | — |
| `v0.1.1` | 2026-10-15 | Claude 플러그인 디렉터리 등록 준비: 줄바꿈 규칙이 더 이상 `plugins/sitebrew`에 닿지 않음, 플러그인 아이콘, 더 분명한 doctor 안내, 설치 방법 5가지, AGENT_INSTALL.md와 CONTRIBUTING.md | — |
| `v0.1.0` | 2026-10-15 | 첫 공개 릴리스 · web-factory v0.0.13 + launch-factory v0.1.2 (내부 버전) | — |
